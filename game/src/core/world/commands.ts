/**
 * Comandos sueltos EXACTOS — CMDS.OVL + SJOG.OVL (Task 3.9).
 *
 * Reglas re-derivadas del asm (citas `offset: → regla`); evidencia y ledger en
 * `re/notes/cmds.md` y `re/verified/cmds.md`. CBASE(CMDS/SJOG)=0xBF80.
 * `rand(lo,hi)` = kernel 0x2092, INCLUSIVO en ambos extremos (`re/notes/rng.md`);
 * aquí es la firma `RandFn = (lo, hi) => number`.
 *
 * Estas funciones son PURAS sobre entradas explícitas (tile, DEX del roster,
 * `contents` del cofre, planta…) para poder verificar el STREAM de rand contra
 * el binario aun cuando el modelo de objetos del clon no se carga headless
 * (bloqueo BSS: los cofres/objetos son registros de 8 B que sólo existen con un
 * mapa real). El runner de paridad (`__parity__/cmds-run.ts`) las ejercita con
 * una semilla del RNG exacto y compara semilla final + estado + botín.
 */
import type { CharacterState, GameState } from "../state.js";
import { t, tf } from "../../i18n/index.js";
import { addByteCapped, addWordCapped } from "../counters.js";
// `with { type: "json" }`: OBLIGATORIO para que este módulo se pueda importar desde el
// LOADER ESM de Node 22 (el que usa Playwright al cargar los specs). Sin el atributo,
// `e2e/objects.spec.ts` —que importa `lootOpenLine` de aquí para NO duplicar la cadena
// derivada— hacía fallar el arranque de TODA la suite e2e por defecto (59 specs sin
// poder ni listarse desde el 2026-07-22; los tours no lo veían porque usan configs
// propias que no cargan este spec). Vite y vitest ya soportan el atributo.
import longEquipNames from "../data/longEquipNames.json" with { type: "json" };
import type { RandFn } from "./survival.js";

const STATUS_DEAD = "D";
const STATUS_POISON = "P";

// ───────────────────────────── Klimb con garfio (CMDS 0x1C20) ──────────────
// Klimb exterior con Grapple sobre montaña (tile 0x0C). Por cada miembro VIVO
// (en orden de roster): rand(1,30); si DEX >= roll escala sin daño; si DEX <
// roll → "Fell!" + daño rand(1,5) a ese miembro. Los muertos NO tiran
// (1cb3: cmp status,'D'; je skip ANTES del 1cc0: call rand). Orden de consumo
// crítico: dex-roll(m0)[,dmg(m0)], dex-roll(m1)[,dmg(m1)], …

/** Tile de montaña: único escalable con garfio (1c8e: cmp 0xc). */
export const KLIMB_MOUNTAIN_TILE = 0x0c;
/** Tile intransitable declarado por Klimb (1c84: cmp 0xd → "Impassable!"). */
export const KLIMB_IMPASSABLE_TILE = 0x0d;

export interface KlimbFall {
  /** índice de roster del miembro que cayó. */
  member: number;
  /** daño rand(1,5) aplicado. */
  damage: number;
}

export interface KlimbResult {
  falls: KlimbFall[];
  messages: string[];
}

/**
 * Tirada de Klimb-con-garfio por miembro. Muta HP/estado de los que caen.
 * `members[i]` = registro de roster (usa `dexterity`, `status`, `currentHp`).
 */
export function klimbGrapple(members: CharacterState[], rand: RandFn): KlimbResult {
  const falls: KlimbFall[] = [];
  const messages: string[] = [];
  for (let i = 0; i < members.length; i++) {
    const m = members[i]!;
    if (m.status === STATUS_DEAD) continue; // 1cb3: los muertos no tiran
    const roll = rand(1, 30); // 1cc0: rand(1,30)
    if (m.dexterity >= roll) continue; // 1cca: DEX >= roll → escala sin daño
    const damage = rand(1, 5); // 1cde: daño rand(1,5)
    m.currentHp = Math.max(0, m.currentHp - damage); // 6ad2 → apply_damage (clamp)
    if (m.currentHp === 0) m.status = STATUS_DEAD;
    falls.push({ member: i, damage });
    messages.push("Fell!"); // 0x904a: "Fell!\n" a secas, sin nombre
  }
  return { falls, messages };
}

// ───────────────────────────── New Order (CMDS 0x0DDC) ─────────────────────
// Swap de dos registros de roster. El Avatar (índice 0) NO se puede mover
// (0e0c: idx1==0 → " must lead!"). Sin RNG, sin turno (no setea g_unk_24e6).

export interface NewOrderResult {
  ok: boolean;
  message: string;
}

/** Reordena la marcha intercambiando dos miembros; el Avatar queda anclado. */
export function newOrder(
  characters: CharacterState[],
  idx1: number,
  idx2: number,
): NewOrderResult {
  if (idx1 < 0 || idx2 < 0 || idx1 >= characters.length || idx2 >= characters.length) {
    return { ok: false, message: "nobody!" };
  }
  if (idx1 === 0 || idx2 === 0) {
    // 0e0c / segundo prompt: seleccionar al Avatar → nombre + " must lead!"
    const name = characters[0]!.name || "The Avatar";
    return { ok: false, message: tf("{} must lead!", name) };
  }
  if (idx1 === idx2) return { ok: true, message: "" };
  const tmp = characters[idx1]!;
  characters[idx1] = characters[idx2]!;
  characters[idx2] = tmp;
  return { ok: true, message: "" };
}

// ───────────────────────────── Push (CMDS 0x161A) ──────────────────────────
// Empuje/intercambio de objeto adyacente. Predicado is_pushable_tile (0x14ba):
// tiles {0x5B, 0x90..0x93, 0xA5, 0xA6}; además la clase cañón (tile&0xFC)==0xB4
// es empujable (16da). Sin RNG. Celda fuente se rellena con 0x45 (cañón) o
// 0x44 (suelo).

const CANNON_CLASS = 0xb4;
const FILL_FLOOR = 0x44;
const FILL_CANNON = 0x45;

/**
 * ¿El tile es un objeto empujable? Predicado is_pushable_tile (CMDS 0x14BA),
 * transcrito rango a rango del asm (14bd-14fc):
 *   0x5B; 0x90..0x93; 0xA5..0xA6; 0xA8..0xA9; 0xAD..0xAF; 0xB4..0xB7.
 */
export function isPushableTile(tile: number): boolean {
  return (
    tile === 0x5b ||
    (tile >= 0x90 && tile <= 0x93) ||
    (tile >= 0xa5 && tile <= 0xa6) ||
    (tile >= 0xa8 && tile <= 0xa9) ||
    (tile >= 0xad && tile <= 0xaf) ||
    (tile >= 0xb4 && tile <= 0xb7)
  );
}

/** Tile con el que se rellena la celda fuente tras empujar (16da). */
export function pushFillTile(sourceTile: number): number {
  return (sourceTile & 0xfc) === CANNON_CLASS ? FILL_CANNON : FILL_FLOOR;
}

/**
 * Reorientación del objeto empujado/tirado — CMDS 0x1504, llamado SÓLO desde el
 * empuje (0x1548 @0x158e, flip=0) y el tirón (0x15b0 @0x15f0, flip=1) para las
 * clases (tile&0xFC) == 0x90 o == 0xB4 (el llamador enmascara en 0x1575/0x15dd).
 * Índice por el DELTA del empujón: N(0,−1)→+0 · E(1,0)→+1 (0x1507-0x1513) ·
 * S(0,1)→+2 (0x1516-0x1522) · O(−1,0)→+3 (0x1526-0x1532); el TIRÓN lo invierte
 * con XOR 2 (0x1536-0x153c; la clase tiene los 2 bits bajos a 0, así que
 * (cls+idx)^2 == cls+(idx^2)). Las demás clases conservan su tile tal cual
 * (0x157f/0x15e7 saltan la llamada). Derivación: re/notes/combat-commands.md.
 */
export function pushOrientedTile(tile: number, dx: number, dy: number, pull: boolean): number {
  const cls = tile & 0xfc;
  if (cls !== 0x90 && cls !== CANNON_CLASS) return tile;
  let idx = 0;
  if (dx === 1 && dy === 0) idx = 1;
  else if (dx === 0 && dy === 1) idx = 2;
  else if (dx === -1 && dy === 0) idx = 3;
  if (pull) idx ^= 2;
  return cls + idx;
}

// ───────────────────────────── Jimmy (SJOG 0x0D4A) ─────────────────────────
// Forzar cerraduras. La llave se gasta SÓLO al fallar; la cerradura mágica
// siempre rompe. RNG: 1×rand por intento.

export type LockKind = "door" | "magic" | "chestObject" | "dungeonChest" | "prisoner";

export interface JimmyInput {
  kind: LockKind;
  /** tile de la cerradura (puerta 0xB9/0xBB; cofre-objeto con bit 0x80). */
  tile: number;
  dex: number;
  /** planta (0..7) para cofre de sala de mazmorra. */
  floor?: number;
  /** g_location, para el cepo (mazmorra ≥0x80 = libera sin karma/NPC). */
  location?: number;
}

export interface JimmyResult {
  success: boolean;
  /** true si se rompió una llave (se descuenta g_keys). */
  keyBroke: boolean;
  /** nuevo tile de la cerradura tras el intento (o el mismo). */
  newTile: number;
  message: string;
  /** cepo 0x84/0x85 liberado con éxito en pueblo → el llamador libera al NPC. */
  freed?: boolean;
  /** karma a sumar (cap 99) al liberar un prisionero en pueblo. */
  karmaDelta?: number;
}

/**
 * Un intento de Jimmy. NO descuenta la llave aquí; el llamador hace
 * `if (result.keyBroke) state.keys--`. Precondición `g_keys>=1` la valida el
 * llamador ("No Keys!").
 */
export function jimmyLock(input: JimmyInput, rand: RandFn): JimmyResult {
  const { kind, tile, dex } = input;
  switch (kind) {
    case "door": {
      // 0xB9/0xBB: rand(0,29); éxito ⇔ DEX > roll → tile−1 (0xB8/0xBA), sin llave.
      const roll = rand(0, 29); // 0dd4
      if (dex > roll) {
        return { success: true, keyBroke: false, newTile: tile - 1, message: "Unlocked!\n" };
      }
      return { success: false, keyBroke: true, newTile: tile, message: "Key broke!\n" };
    }
    case "magic": {
      // 0x97/0x98: cerradura mágica → SIEMPRE rompe (sin tirada de rand).
      return { success: false, keyBroke: true, newTile: tile, message: "Key broke!\n" };
    }
    case "chestObject": {
      // ★ GATE PREVIO 0x0bc7 `cmp al,0x80` / `jae 0xbd2` (#182 D5). `tile` aquí NO es un tile
      // de mapa: es el BYTE +5 del registro de objeto (0x0bc0 `mov al,[bx+0x5c5f]` con
      // bx=idx<<3). Con el bit 0x80 LIMPIO no hay nada que forzar: 0x0bcb carga DS 0x8A58
      // («Key broke!\n») y salta a 0x0c1d, que imprime + suena + `dec [g_keys]` (0x0c34)
      // **sin llegar al `call 0x6112` de 0x0bf9** ⇒ CERO tiradas. Es el caso COMÚN, no un
      // borde: los cofres de interior nacen con `contents` 8 (bit limpio).
      // El bit 0x80 es el MISMO que (O)pen lee como TRAMPA (`open_chest_world` 0x120b
      // `cmp byte [bp-6],0x7f`/ja, y 0x1214 `and byte [bp-6],0x7f` se queda el contenido) ⇒
      // jimmy sobre cofre-objeto = DESARMARLO.
      if ((tile & 0x80) === 0) {
        return { success: false, keyBroke: true, newTile: tile, message: "Key broke!\n" };
      }
      // 0x0BAA: threshold = ((tile&0x7F) − DEX + 0x1E) >> 1; rand(1,30);
      // rand ≤ threshold = FALLO; rand > threshold = éxito (limpia bit 0x80).
      // La resta es 16-bit y el shift es `shr` SIN SIGNO (0x0bec `d1e8`); el
      // resultado se trunca a BYTE (0x0bee `mov [bp-4],al`) y se re-extiende a
      // word para el cmp (0x0bfc-0x0c01). Con DEX editada > (tile&0x7f)+30 el
      // original WRAPEA (umbral enorme → SIEMPRE "Key broke!"); un `>>` con
      // signo aquí daría umbral negativo → éxito siempre (auditoría byte-wrap,
      // re/notes/audit-byte-wrap.md).
      const threshold = ((((tile & 0x7f) - dex + 0x1e) & 0xffff) >>> 1) & 0xff;
      const roll = rand(1, 30);
      if (roll <= threshold) {
        return { success: false, keyBroke: true, newTile: tile, message: "Key broke!\n" };
      }
      return { success: true, keyBroke: false, newTile: tile & 0x7f, message: "Success!\n" };
    }
    case "dungeonChest": {
      // 0x0C3E: threshold = (floor*2 − DEX + 0x1E) >> 1; rand(1,30); mismo criterio.
      // Resta 16-bit + `shr` SIN SIGNO (0x0ca6 `d1e8`), umbral guardado y comparado
      // como WORD (0x0ca8/0x0cf1) — igual que dungeon.ts::jimmyHere. Con DEX editada
      // > floor·2+30 el original wrapea a umbral enorme (SIEMPRE "Key broke!").
      const floor = input.floor ?? 0;
      const threshold = (((floor * 2) - dex + 0x1e) & 0xffff) >>> 1;
      const roll = rand(1, 30);
      if (roll <= threshold) {
        return { success: false, keyBroke: true, newTile: tile, message: "Key broke!\n" };
      }
      // éxito: tile = 0x40 | (tile&8) "Chest unlocked"
      return {
        success: true,
        keyBroke: false,
        newTile: 0x40 | (tile & 8),
        message: "Chest unlocked\n",
      };
    }
    case "prisoner": {
      // Cepo/grilletes 0x84/0x85 (SJOG 0x0E22). El `cmp loc,0x80; jae 0e42` SÓLO
      // salta el check de ocupante (0x770e); UNA VEZ SUPERADO ESE GATE, pueblo y
      // mazmorra convergen en la tirada: `rand(0,29)` (0e54); DEX > roll = éxito,
      // si no "Key broke!" + dec en AMBOS contextos. El split por localización es
      // sólo el EFECTO del éxito (0e76: cmp loc,0x7f; jae → tile 0x44; si no
      // libera NPC + karma+2).
      // ⚠ Este comentario decía «rand(0,29) SIEMPRE» y era FALSO como propiedad del
      // binario (#194): en PUEBLO sin ocupante, `0x0e38 or ax,ax / 0x0e3a jne 0xe42`
      // cae a `0x0e3c mov ax,0x8afe` («No one is there!») y `0x0e3f jmp 0xd70`, que
      // RETORNA ANTES de 0x0e54 ⇒ esa vía NO consume tirada. El «siempre» sólo vale
      // DENTRO de esta función, que el caller ya sólo alcanza tras el gate — y por eso
      // el gate vive en game.ts ANTES de jimmyLock (ver su cabecera, #148): si entrara
      // después, el stream RNG ya se habría movido.
      const roll = rand(0, 29); // 0e54 (tras el gate de ocupante)
      if (dex > roll) {
        if ((input.location ?? 0) >= 0x7f) {
          return { success: true, keyBroke: false, newTile: 0x44, message: "Unlocked\n" };
        }
        // 0x0ec4 `mov ax,0x8b36` → DS 0x8b36 = DATA.OVL fileoff 0x8b46 =
        // b'\n"I thank thee!"\n' VERBATIM, con AMBAS comillas. Es la de SJOG, sin
        // atribución; la homónima DS 0x7988 (`\n"I thank thee!"\nsays $.\n`, SHOPPES
        // 0x063d) es la de tienda y NO es esta. #142.
        return {
          success: true,
          keyBroke: false,
          newTile: tile,
          message: '\n"I thank thee!"\n',
          freed: true,
          karmaDelta: 2,
        };
      }
      return { success: false, keyBroke: true, newTile: tile, message: "Key broke!\n" };
    }
  }
}

// ───────────────────────── Trampa de cofre (kernel 0x2FD0 = SJOG 0x7050) ────
// Selección de tipo + efecto. cf. `task-3.9-trap-loot-tables.md §1`.
// Tabla de tipos DS:0x559e: ACID 3/8 POISON 2/8 BOMB 2/8 GAS 1/8 — es una
// DISTRIBUCIÓN, no una permutación (rand(0,3) daría las frecuencias mal).
// En la banda ALTA (loc>0x7f): sólo ACID/POISON (rand(0,1)).
// ⚠ Esa banda NO es «mazmorra»: el original escribe g_location 0x21..0x28 en mazmorra
// (#123), por DEBAJO de la frontera, así que en mazmorra sale la tabla completa — lo
// que ya dice bien dungeon.ts:1035. El único inmediato >0x7f del corpus es 0xFF, y
// siempre acompañado de aparcar la localización real en otra global (DUNGEON 0x00a8,
// CAST2 0x0ea4, CMDS 0x0332) ⇒ 0xFF = localización SUSPENDIDA por una escena. Etiqueta
// definitiva: #184. Derivación: re/notes/mix-trap-105-acta.md §5.4-5.5.

/**
 * CENTINELA de localización suspendida — el valor que el binario deja en `g_location`
 * (DS:0x5893) mientras corre una escena que se lleva el mapa por delante. Leído del
 * cuerpo, dos sitios independientes con la MISMA pareja salvar-centinela-restaurar:
 *   ULTIMA.EXE `run_combat_encounter` 0x5f86 — `5fa8 mov al,[g_location]` /
 *     `5fab mov [g_unk_5894],al` (SOMBRA) / `5fb4 mov byte [g_location],0xff` /
 *     `6091-6094` restaura desde la sombra al salir.
 *   DUNGEON.OVL `dng_enter_room` 0x0000 — `007e/0081` salva, `00a8` pone 0xFF,
 *     `00d5`/`0106` restauran.
 * ⇒ DOS variables con DOS papeles: quien necesite «dónde estoy de verdad» lee la
 * SOMBRA (así lo hace el gate de (C)ast de combate, COMBAT.OVL 0x0936 `g_unk_5894==0x12`);
 * quien lea `g_location` durante el combate lee 0xFF. Ficha #41.
 */
export const COMBAT_LOCATION_SENTINEL = 0xff; // DS:0x5893 durante combate/sala

export const TRAP_TYPE_TABLE = [0, 0, 0, 1, 1, 2, 2, 3] as const; // DS:0x559e
export type TrapType = "ACID" | "POISON" | "BOMB" | "GAS";
const TRAP_NAMES: Record<number, TrapType> = { 0: "ACID", 1: "POISON", 2: "BOMB", 3: "GAS" };

export interface TrapResult {
  type: TrapType;
  message: string;
  /**
   * SLOTS del roster (índices, en orden ascendente) que reciben una invocación de
   * `kernel_apply_damage` 0x2a52 — que es a la vez el daño Y su presentación:
   * INVIERTE la fila del roster del slot (0x2a28 @0x2a59, XOR del rect x 0xc0..0x137
   * · y idx·8+8..+0xf), suena NB(10,1600,2000) @0x2a68, y DES-invierte (@0x2a6e).
   * El CALLER emite con esto el guión de presentación (evento "poison-tick", el bus
   * de #213 para esa misma cadena flash+blip; ★ #328 — antes sólo sonaban los cues
   * y el flash de fila no se enseñaba). Derivación por tipo:
   * ACID = [opener] (0x302b→0x3032, incondicional); BOMB = un slot por miembro
   * VIVO del grupo, en orden de bucle (0x2aa8, check 'D' @0x2ac1 ANTES del daño);
   * POISON/GAS = [] (sólo status, mudos y sin flash). El bang de apertura
   * NB(40,3000,500) @0x2fe3 (cue `dungeon-trap`) también lo emite el caller —
   * aquí no hay presentación.
   */
  damageSlots: number[];
}

/**
 * Cota de los efectos que BARREN gente (BOMB 0x2aa8, GAS 0x3054) y del guarda de
 * 0x2fa6: `min(g_party_size, 6)`. Las dos mitades salen del asm:
 *  - el 6 es el bucle: `inc si; cmp si,6; jl` (@0x2ad9-0x2add y @0x3061-0x3065) —
 *    el roster son SEIS ranuras de 0x20 bytes en DS:0x55b3 (`add di,0x20` @0x2ad6);
 *  - el g_party_size (DS:0x585b) es el guarda de dentro: BOMB @0x2ab7-0x2abf
 *    (`mov cl,[g_party_size]; cmp ax,cx; jae 0x2ad6`, ANTES del check 'D' @0x2ac1,
 *    así que ni siquiera consume el rand(1,8)) y 0x2fa6 @0x2faa-0x2fb2
 *    (`mov al,[g_party_size]; cmp [bp+4],ax; jae 0x2fca` → sale sin tocar nada).
 * En el port `members` es el ROSTER (puede llevar gente que no va EN EL GRUPO), así
 * que barrerlo entero tiraba un rand por cada uno: con partySize=3 y 16 en el roster,
 * BOMB hacía 17 tiradas donde el original hace 4. Ficha #41.
 * Misma convención que loops/hazards.ts (`i < state.partySize && i < 6`).
 */
const trapSweep = (partySize: number, members: CharacterState[]): number =>
  Math.min(partySize, 6, members.length);

/**
 * Aplica la trampa del cofre al abrir. Muta HP/estado del roster.
 * `opener` = índice del miembro que abre; `members` = roster completo;
 * `partySize` = g_party_size (DS:0x585b), la cota de los barridos — ver `trapSweep`.
 * `location` = g_location; >0x7f es la banda de escena (NO mazmorra: ver cabecera).
 *
 * TRES callers en el original, resueltos por banda (el grep por texto ve 0 de 3):
 * SJOG 0x1222 (cofre del mundo), SJOG 0x1323 (cofre de mazmorra) y CMDS 0x1c04 =
 * Mix con los reagentes equivocados — este último SIN cablear en el port (#105).
 */
export function chestTrap(
  location: number,
  opener: number,
  members: CharacterState[],
  rand: RandFn,
  partySize: number,
): TrapResult {
  let type: number;
  if (location > 0x7f) {
    type = rand(0, 1); // 2ff4: mazmorra → sólo ACID(0)/POISON(1)
  } else {
    const r = rand(0, 7); // 3001
    type = TRAP_TYPE_TABLE[r]!; // 3006: byte [r + 0x559e]
  }
  const name = TRAP_NAMES[type] ?? "ACID";
  const sweep = trapSweep(partySize, members);
  // Slots de daño ANTES de mutar (BOMB censa los vivos como el check 'D' 0x2ac1,
  // previo a cada golpe del bucle 0x2aa8; ACID = el que abre, incondicional
  // @0x302b-0x3032 `push [bp+6]` = opener → call 0x2a52).
  const damageSlots =
    type === 0
      ? [opener]
      : type === 2
        ? members
            .slice(0, sweep)
            .map((m, i) => (m.status !== STATUS_DEAD ? i : -1))
            .filter((i) => i >= 0)
        : [];
  applyTrapEffect(type, opener, members, rand, sweep);
  // El anuncio va por t() del COMPUESTO («ACID!»→«¡ÁCIDO!») — la plantilla genérica
  // «{}!» es compartida (gritos de hechizo, identidad en ES) y no puede tintarse; bajo
  // 'es' el enum se colaba en inglés (hallazgo del soak de mazmorras 2026-07-20).
  return { type: name, message: t(`${name}!`), damageSlots };
}

const alive = (c: CharacterState): boolean => c.status !== STATUS_DEAD;

function damageMember(m: CharacterState, dmg: number): void {
  m.currentHp = Math.max(0, m.currentHp - dmg); // 2a52: apply_damage con clamp
  if (m.currentHp === 0) m.status = STATUS_DEAD;
}

function applyTrapEffect(
  type: number,
  opener: number,
  members: CharacterState[],
  rand: RandFn,
  sweep: number,
): void {
  switch (type) {
    case 0: {
      // ACID (0x3abe): x = rand(0,60) >> 1; if x==0 x=1; daño al que abre.
      let x = rand(0, 60) >> 1;
      if (x === 0) x = 1;
      const m = members[opener];
      if (m) damageMember(m, x);
      break;
    }
    case 1: {
      // POISON (0x3042 → 0x2fa6): envenena SÓLO al que abre (sin daño), si vivo Y
      // dentro del GRUPO — el `jae 0x2fca` @0x2fb2 devuelve sin tocar nada si el
      // índice llega >= g_party_size.
      if (opener >= sweep) break;
      const m = members[opener];
      if (m && alive(m)) m.status = STATUS_POISON;
      break;
    }
    case 2: {
      // BOMB (0x2aa8): por cada miembro del GRUPO que esté VIVO, rand(1,8) de daño.
      // El guarda de g_party_size @0x2abf va ANTES del check 'D' @0x2ac1, y ambos
      // saltan al `inc si` sin llegar al rand ⇒ los de fuera no consumen tirada.
      for (let i = 0; i < sweep; i++) {
        const m = members[i]!;
        if (alive(m)) damageMember(m, rand(1, 8));
      }
      break;
    }
    case 3: {
      // GAS (0x305b-0x3065): llama a 0x2fa6 con si = 0..5, y 0x2fa6 filtra por
      // g_party_size (@0x2fb2) y por 'D' (@0x2fbf) — el neto es el mismo barrido.
      for (let i = 0; i < sweep; i++) {
        const m = members[i]!;
        if (alive(m)) m.status = STATUS_POISON;
      }
      break;
    }
    // default (type>3): nada.
  }
}

// ───────────────────────────── Botín de cofre (SJOG 0x1040/0x10B8) ──────────
// Categoría por id de item (switch de GET, §2.6).
export type LootCategory =
  | "chest" | "gold" | "potion" | "scroll" | "equipment"
  | "keys" | "gems" | "torches" | "food" | "sandalwood" | "unknown";

export function lootCategory(id: number): LootCategory {
  switch (id) {
    case 1: return "chest";
    case 2: return "gold";
    case 3: return "potion";
    case 4: return "scroll";
    case 5: case 6: case 9: case 10: case 11: case 12: return "equipment";
    case 7: return "keys";
    case 8: return "gems";
    case 13: return "torches";
    case 14: return "sandalwood";
    case 15: return "food";
    default: return "unknown";
  }
}

export interface LootGrant {
  id: number;
  category: LootCategory;
  qty: number;
}

/**
 * Nombre impreso al (G)et de una pieza de botín-suelo — apply_item_grant
 * (SJOG get_special_item 0x1458), verbatim de DATA.OVL. El id del objeto-suelo
 * (slot+0) despacha el switch: id>0xc → 0x172e; 9..0xc → 0x1670; 1..8 →
 * jump-table `cs:[bx-0x2962]`. Formato con nº (0x5ABE/0x7F94/0x7F70 imprimen la
 * cantidad) + pluralización derivada del asm (`cmp qty,1; jne` → sing./plur.):
 *
 *  - id 2  → " gold!"  (0x1620/0x8CF0)                    [EXACTO]
 *  - id 7  → " key(s)!" (0x1568/0x158E, 0x8CB4/0x8CBE)    [EXACTO]
 *  - id 8  → " gem(s)!" (0x153C, 0x8C9C/0x8CA6)           [EXACTO]
 *  - id 13 → " torch(es)!" (0x1504, 0x8C8A/0x8C96)        [EXACTO]
 *  - id 15 → " food!"  (0x14CA/0x8C6E)                    [EXACTO]
 *  - id 3  → "A <color> potion!" (0x163C/0x8CF8+0x419C+0x8CFC) [EXACTO]: color = el
 *            value de la poción (rec[5]=qty, 0..7) → tabla 0x419C (POTION_COLORS).
 *  - id 4  → "A scroll: <name>" (0x15C6/0x8CE0+0x41AC): nombre 0x41AC no derivado (C).
 *  - id 5/6/9..12 → equipo/arma/armadura (0x1670): nombre de la tabla 0x17F6, ya
 *    volcada en longEquipNames.json (carril buy-herrero) + "!" (0x8D06). [EXACTO]
 *  - id 14 → "A sandalwood box!" (0x14F0/0x8C76) — no aparece en el botín de cofre.
 *  - id 1  → "Open it first!" (0x1482/0x8C3E): pieza = cofre anidado.
 *
 * `qty` = el byte slot+5 (ya truncado a 8 bits al colocar). Ver port-f13-report §Get.
 */
/**
 * Línea impresa al ABRIR el cofre, UNA por pieza colocada, tras "Found:" — dispatcher
 * de texto SJOG **0x12A** (jump-table local en file-off **0x1B0**, 31 handlers; base de
 * carga del overlay 0xBF80 → `case_local = word − 0xBF80`). loot_place lo llama
 * INCONDICIONALMENTE por cada objeto (`0x1035: push [bp+0x10]; call 0x12A`, arg = id).
 * Strings verbatim de DATA.OVL (fileoff = DS+0x10), **derivadas byte a byte** de la tabla:
 *
 *   1 "a chest!" (0x850E) · 2 "a sack of gold!" (0x8518) · 3 "a potion!" (0x852A) ·
 *   4 "a scroll!" (0x8536) · 5 "a weapon!" (0x8542) · 6 "a shield!" (0x854E) ·
 *   7 "a ring of keys!" (0x855A) · 8 "a gem!" (0x856C) · 9 "a helm!" (0x8574) ·
 *   10 "a ring!" (0x857E) · 11 "some armour!" (0x8588) · 12 "an amulet!" (0x8596) ·
 *   13 "some torches!" (0x85A2) · 15 "some food!" (0x85B2) · 25 "a strange rock!" (0x85BE) ·
 *   30 "a rotting body!" (0x85D0) · 31 "a moldy corpse!" (0x85E2) · resto "Nothing of note." (0x85F4).
 *
 * OJO: es una tabla DISTINTA de `lootItemName` (el nombre del (G)et vía 0x1458): p.ej.
 * id2 → Open "a sack of gold!" vs Get "50 gold!". id14 (sandalwood) NO tiene handler aquí
 * (→ "Nothing of note.") y tampoco aparece en el botín de cofre. ⚠ El mismo 0x12A lo
 * comparten otros creadores de objetos (el strange rock 0x19 apunta a search_dungeon 0x043c);
 * aquí sólo se cablea la rama de open_chest_world/loot_place. Cita: SJOG.OVL.asm 0x12A /
 * tabla 0x1B0, DATA.OVL 0x850E-0x85F4.
 */
/**
 * Tabla id→nombre del dispatcher 0x12A (const de OBJETO, no switch): así el barrido
 * AST de `extract-user-strings` la aflora vía la allowlist `DISPLAY_CONSTS` (el
 * call-site `text: lootOpenLine(id)` es una llamada a función que el sink `text:` no
 * resuelve). Sin esto, los 17 literales quedaban INVISIBLES al manifest → sin key en
 * el corpus → intraducibles bajo lang=es (fuga de inglés cazada por el soak b15). Cada
 * valor es VERBATIM de DATA.OVL 0x850E-0x85F4, sin el `\n` final del pool (el pool
 * `textShopLookGather` los porta con `\n`; loot_place imprime la línea pelada).
 */
const LOOT_OPEN_NAMES: Record<number, string> = {
  1: "a chest!",
  2: "a sack of gold!",
  3: "a potion!",
  4: "a scroll!",
  5: "a weapon!",
  6: "a shield!",
  7: "a ring of keys!",
  8: "a gem!",
  9: "a helm!",
  10: "a ring!",
  11: "some armour!",
  12: "an amulet!",
  13: "some torches!",
  15: "some food!",
  25: "a strange rock!",
  30: "a rotting body!",
  31: "a moldy corpse!",
};

export function lootOpenLine(id: number): string {
  return LOOT_OPEN_NAMES[id] ?? "Nothing of note.";
}

/**
 * Nombres de color de poción (DS 0x419c, 8 punteros — verbatim, EN MINÚSCULAS). El
 * "value" de una poción de botín (rec[5] = qty) ES su color 0..7: overworld
 * `lootPlaceQty(3)=base-1` con base=rand(1,8) → 0..7; mazmorra `rand(0,7)`
 * (dungeonChestLoot). apply_item_grant (0x1643) indexa esta tabla con ese byte SIN
 * enmascarar (asume 0..7). i18n: cada color es una key propia (es.json blue→azul…);
 * la composición ES la cablea el carril i18n (color por t() antes de componer).
 */
export const POTION_COLORS = [
  "blue", "yellow", "red", "green", "orange", "purple", "black", "white",
] as const;

/**
 * Nombres ABREVIADOS de scroll (iniciales rúnicas del hechizo) — tabla DS 0x41AC
 * (DATA.OVL fileoff 0x41BC, 8 word-ptrs → strings en 0x8C2E-0x8C4D, verbatim):
 * VL=Vas Lor · RH=Rel Hur · IS=In Sanct · IA=In An · IQW=In Quas Wis ·
 * KXC=Kal Xen Corp · IMC=In Mani Corp · AT=An Tym. apply_item_grant id4 (SJOG
 * 0x15ea) indexa con (value & 7). No se traducen (sílabas rúnicas).
 */
const SCROLL_CODES = ["VL", "RH", "IS", "IA", "IQW", "KXC", "IMC", "AT"] as const;

/** Nombres de equipo por código 0..47 — tabla DS 0x17F6 (DATA.OVL 0x1806), ya
 *  volcada byte a byte en longEquipNames.json (carril buy-herrero). */
const EQUIP_NAMES: string[] = (longEquipNames as { names: string[] }).names;

/**
 * Strings FIJOS de `lootItemName` que sólo viven en un `return` del switch (no
 * son sink del barrido AST): constante-display allowlistada en DISPLAY_CONSTS
 * (extract-user-strings.mjs) para que entren al manifiesto/corpus y la capa
 * i18n pueda traducirlos («Open it first!» ya aflora por su otro call-site con
 * `text:` en game.ts; éste no tiene ninguno).
 */
const LOOT_GRANT_STRINGS = {
  /** id14 (0x14F0): caja de sándalo — plano, lo traduce el choke sobre el string entero. */
  sandalwood: "A sandalwood box!",
  /**
   * id4 con quality 0xFF (0x15CD, DS 0x8CC2 «The plans for the HMS Cape!\n»): el lado
   * ALTO del `cmp word ptr [bp+6],0xff` de 0x15C6. Sin el `\n` final, como el resto de
   * `lootItemName` — el salto lo pone el impresor (#108). #140.
   */
  hmsCapePlans: "The plans for the HMS Cape!",
  /**
   * kind 0x19 = 25, la PIEDRA LUNAR (#357): rama 0x148C de get_special_item, alcanzada por
   * la cadena secundaria (0x172D `cmp ax,0x19` / 0x1733 `jmp 0x148c`) desde la segunda
   * excepción escrita a mano del barrido de cmd_get (0x196F `cmp cx,0x19` / je). Imprime
   * DS 0x8C4E «A moonstone!\n» (DATA.OVL fileoff 0x8C5E; controles vecinos 0x8C3E «Open it
   * first!» y 0x8C5C «A magic carpet!»). Sin el case, el default «An item!» usurpaba el
   * nombre. El GRANT (0x1493-0x1496 `[bx+0x5840]=0xFF`) ya vivía en applySearchGrant.
   */
  moonstone: "A moonstone!",
} as const;

export function lootItemName(id: number, qty: number): string {
  // Plantillas POSICIONALES por `tf()`: el choke de consola (coreview.pushConsole) t() el
  // string COMPUESTO, así que un «50 gold!» concreto NO casa la key template «{} gold!» y
  // saldría en inglés bajo 'es'. tf(plantilla, qty) hace lookup de la PLANTILLA + interpola,
  // de modo que la línea de botín se traduce (identidad byte-exacta en 'en'). Singular/plural
  // = DOS plantillas (el binario tiene ambas cadenas: keys 0x8CB4/0x8CBE, gems 0x8C9C/0x8CA6,
  // torches 0x8C8A/0x8C96). Los casos PLANOS (sandalwood/scroll/item) ya los traduce el choke
  // sobre el string entero, no necesitan tf.
  switch (id) {
    case 2: return tf("{} gold!", qty); // 0x1620/0x8CF0 " gold!" (sin plural)
    // El cmp de 0x1568 tiene DOS lados y sólo estaba portado el bajo. El valor que
    // llega es UNO SOLO (el `[bp+6]` del binario): el bit 0x80 marca «odd key» —la
    // llave de calavera— y los 7 bits bajos son la CUENTA, que 0x156e desenmascara
    // antes de imprimir. Alcanzable con el objeto {id:7, quality:0x85} de Trinsic.
    case 7: {
      const odd = qty > 0x7f; // 0x1568 cmp [bp+6],0x7f / jle 0x158e
      const n = qty & 0x7f; //   0x156e and [bp+6],0x7f
      // 0x15b1 cmp …,1 → sufijo DS 0x8CBA '!\n' vs DS 0x8CBE 's!\n' (dos cadenas).
      if (odd) return n === 1 ? tf("{} odd key!", n) : tf("{} odd keys!", n); // 0x1581, DS 0x8CAA
      return n === 1 ? tf("{} key!", n) : tf("{} keys!", n); // 0x158E, DS 0x8CB4
    }
    case 8: return qty === 1 ? tf("{} gem!", qty) : tf("{} gems!", qty); // 0x153C, 0x8C9C/0x8CA6
    case 13: return qty === 1 ? tf("{} torch!", qty) : tf("{} torches!", qty); // 0x1504, 0x8C8A/0x8C96
    case 15: return tf("{} food!", qty); // 0x14CA/0x8C6E " food!" (sin plural)
    case 14: return LOOT_GRANT_STRINGS.sandalwood; // 0x14F0 (plano; traducible por el choke)
    // Piedra lunar (kind 0x19 = 25, MOONSTONE_SEARCH_ID): `qty` transporta la FASE, no una
    // cantidad — el nombre es fijo (rama 0x148C, ver docstring de LOOT_GRANT_STRINGS). #357
    case 25: return LOOT_GRANT_STRINGS.moonstone; // 0x148C / DS 0x8C4E
    case 1: return "Open it first!"; // 0x1482 (cofre anidado)
    // Poción: "A <color> potion!" (0x163C: 0x8CF8 "A " + 0x419C[color] + 0x8CFC
    // " potion!"). El color = `qty` (rec[5], el value de la poción de botín = 0..7).
    case 3: return tf("A {} potion!", t(POTION_COLORS[qty & 7]!)); // i18n: color por t() (femenino: «¡Una poción Roja!»)
    // Scroll: el handler del id 4 (0x15C6) abre con `cmp word ptr [bp+6],0xff` y tiene
    // DOS salidas. Sólo estaba portada la del `jne` — el mismo defecto que la odd key
    // (#133), a ~90 bytes de distancia en la misma rutina.
    case 4: {
      // 0x15c6/0x15cb: quality 0xFF NO es un pergamino, son los planos del HMS Cape.
      // Imprime DS 0x8CC2 y escribe g_hms_cape (el grant vive en applySearchGrant). #140
      if (qty === 0xff) return LOOT_GRANT_STRINGS.hmsCapePlans; // 0x15cd
      // 0x15DC: "A scroll: " (0x8CE0) + nombre rúnico 0x41AC[(qty)&7] + "!\n" (0x8CEC).
      // El nombre-de-array ya NO es Clase C: tabla SCROLL_CODES derivada (o-loot).
      // La FUENTE del nombre la lleva lootItemSegments (#364-c): el binario lo imprime
      // con set_font(1) entre el "A scroll: " y el "!" latinos (SJOG 0x15e7/0x15fd).
      return tf("A scroll: {}!", SCROLL_CODES[qty & 7]!); // SJOG 0x15dc-0x1604
    }
    // Equipo: NOMBRE pelado + "!\n" (0x16a8 push [0x17F6[code]] + 0x8D06 "!\n") —
    // sin artículo. code = qty (0..47); fuera de rango cae al fallback declarado.
    // t(nombre) + "!" literal (sin plantilla "{}!": una plantilla sin letra no
    // entra al corpus y el genérico {} debe quedar identidad — guarda i18n-tf).
    case 5: case 6: case 9: case 10: case 11: case 12: {
      const name = EQUIP_NAMES[qty];
      return name !== undefined ? t(name) + "!" : "An item!"; // SJOG 0x16a3-0x16b2
    }
    default: return "An item!";
  }
}

/**
 * #364-c — TRAMOS {text,rune} del anuncio de botín cuando el binario cambia de fuente
 * A MITAD DE FILA: sólo el scroll (id 4, quality ≠ 0xFF) — apply_item_grant imprime
 * "A scroll: " en font 0, el nombre rúnico 0x41AC[(qty)&7] con set_font(1) (SJOG
 * 0x15e7) y vuelve a font 0 para el "!\n" (0x15fd). Para el resto de ids devuelve
 * undefined (fila homogénea: el camino por-fila de siempre).
 *
 * Los tramos se DERIVAN del mismo `lootItemName` (re-anclando el código rúnico dentro
 * de la plantilla ya traducida) para que text === concat(segments) se cumpla también
 * bajo i18n, sin duplicar el literal. Si la traducción no conserva el código (no puede
 * pasar: `{}` interpola verbatim), se devuelve undefined y la fila queda latina entera.
 */
export function lootItemSegments(
  id: number,
  qty: number,
): readonly { text: string; rune: boolean }[] | undefined {
  if (id !== 4 || qty === 0xff) return undefined;
  const code = SCROLL_CODES[qty & 7]!;
  const full = lootItemName(id, qty);
  const at = full.indexOf(code);
  if (at < 0) return undefined;
  const segs: { text: string; rune: boolean }[] = [];
  if (at > 0) segs.push({ text: full.slice(0, at), rune: false });
  segs.push({ text: code, rune: true }); // el nombre rúnico (set_font(1), tabla DS 0x41AC)
  if (at + code.length < full.length) segs.push({ text: full.slice(at + code.length), rune: false });
  return segs;
}

// Tabla FIJA (DS:0x4124/0x412C/0x4134) — 8 filas.
const FIXED_ITEM = [1, 2, 3, 4, 7, 8, 13, 15];
const FIXED_GUARD = [25, 3, 17, 17, 9, 15, 7, 7];
const FIXED_MAXQTY = [10, 90, 8, 8, 2, 2, 2, 2];

// Tabla ALEATORIA (DS:0x413C/0x416C) — 48 entradas.
// item[48] @ DATA.OVL 0x414C (verificado byte a byte contra el binario real; el
// arnés Python re/tools/cmds_parity.py lo re-lee de DATA.OVL y asegura igualdad).
const RANDOM_ITEM = [
  0x09, 0x09, 0x09, 0x09, 0x06, 0x06, 0x06, 0x06, 0x06, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b,
  0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05,
  0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x0a, 0x0a, 0x0a, 0x0c, 0x0c, 0x0c,
];
const RANDOM_GUARD = [
  0x0a, 0x0a, 0x0f, 0x14, 0x0a, 0x0f, 0x14, 0x1c, 0xff, 0x0f, 0x0f, 0x14, 0x14, 0x14, 0x18, 0xff,
  0x05, 0x0a, 0x0a, 0x0a, 0x0a, 0x0a, 0x0a, 0x0a, 0x0f, 0x0f, 0x0f, 0x0a, 0x0f, 0x0a, 0x14, 0x14,
  0x14, 0x14, 0x14, 0xff, 0x17, 0x17, 0x17, 0xff, 0xff, 0xff, 0x17, 0x17, 0x17, 0x17, 0x0f, 0xff,
];

/**
 * loot_place (0x0F88): cantidad final según el ID del item (que el binario usa
 * como "mode"): 1→rand(1,contents); 2→rand(1,3·contents); 3/4→base−1; else→base.
 * Consume rand SÓLO para id 1 y 2.
 */
function lootPlaceQty(id: number, base: number, contents: number, rand: RandFn): number {
  if (id === 1) return rand(1, contents); // 0fa4
  if (id === 2) return rand(1, 3 * contents); // 0fb6
  if (id === 3 || id === 4) return base - 1; // 0f9b: dec
  return base; // 0fc6
}

/**
 * Botín de cofre del mundo: tabla fija (0x1040, filas 7..0) + tabla aleatoria
 * (0x10B8, floor(contents/2)+1 intentos). Reproduce el orden EXACTO de rand.
 * Devuelve los items concedidos (para cruce de stream + estado).
 */
export function chestLoot(contents: number, rand: RandFn): LootGrant[] {
  const grants: LootGrant[] = [];
  // Fija: si=7..0
  for (let si = 7; si >= 0; si--) {
    const guard = FIXED_GUARD[si]!;
    if (guard > contents) continue; // 1083: guard>contents → sin tirada
    const roll = rand(1, 30); // 1090
    if (guard > roll) continue; // 1099
    const maxqty = FIXED_MAXQTY[si]!;
    const base = maxqty === 1 ? 1 : rand(1, maxqty); // 109d/1050
    const id = FIXED_ITEM[si]!;
    const qty = lootPlaceQty(id, base, contents, rand);
    grants.push({ id, category: lootCategory(id), qty });
  }
  // Aleatoria: floor(contents/2)+1 iteraciones
  const iters = (contents >> 1) + 1;
  for (let n = 0; n < iters; n++) {
    const idx = rand(0, 47); // 10db
    const guard = RANDOM_GUARD[idx]!;
    if (guard > contents) continue; // 10e6: sin 2ª tirada
    const roll = rand(1, 30); // 10f2
    if (guard > roll) continue; // 10fb
    const id = RANDOM_ITEM[idx]!;
    const qty = lootPlaceQty(id, idx, contents, rand); // base = idx (equipo → else)
    grants.push({ id, category: lootCategory(id), qty });
  }
  return grants;
}

/**
 * Aplica un LootGrant de cofre al estado (SJOG open_chest_world 0x112C, tras loot_fixed
 * 0x1040 + loot_random 0x10B8). Contadores simples (gold/keys/gems/torches/food) EXACTOS.
 * Ítem-arrays DERIVADOS (cierra ⚠ O-loot, auditoría de cobertura): apply_item_grant
 * indexa los quantity-arrays con el VALUE del objeto (rec[5] = grant.qty):
 *   · potion  (id3, SJOG 0x1656-0x166c): potionQuantities[qty] += 1 — qty = color 0..7
 *     SIN máscara (los generadores garantizan el rango), cap 0x63.
 *   · scroll  (id4, SJOG 0x1607-0x161d): scrollQuantities[qty & 7] += 1, cap 0x63.
 *     (value 0xFF = planos del HMS Cape, objeto pre-colocado — no sale de cofres.)
 *   · equipment (id5/6/9-12, SJOG 0x1670-0x16a3): qty = CÓDIGO de equipo 0..47 →
 *     equipmentQuantities[code] += 1; munición (0x1B Arrows / 0x1D Quarrels) += 5
 *     (call 0x7f70(&[0x57C0+code], 5, 0x63)); cap 0x63.
 *   · sandalwood (id14, SJOG 0x14F0): g_wooden_box = 0xFF → specialItems.woodenBox.
 * El rand ya se consumió al calcular el grant (chestLoot) → esto NO toca el stream vivo.
 */
export function applyLootGrant(state: GameState, grant: LootGrant): void {
  switch (grant.category) {
    // Caps del original: gold/food u16 → 9999 (add_word_capped 0x9C84); keys/gems/torches
    // u8 → 99 (add_byte_capped 0x9C60). Ver src/core/counters.ts.
    case "gold": state.gold = addWordCapped(state.gold, grant.qty); break;
    case "keys": state.keys = addByteCapped(state.keys, grant.qty); break;
    case "gems": state.gems = addByteCapped(state.gems, grant.qty); break;
    case "torches": state.torches = addByteCapped(state.torches, grant.qty); break;
    case "food": state.food = addWordCapped(state.food, grant.qty); break;
    case "potion": {
      const i = grant.qty; // color 0..7 (sin máscara, como 0x1656)
      if (state.potionQuantities?.[i] !== undefined) {
        state.potionQuantities[i] = addByteCapped(state.potionQuantities[i]!, 1);
      }
      break;
    }
    case "scroll": {
      const i = grant.qty & 7; // 0x15ed `and bx,7`
      if (state.scrollQuantities?.[i] !== undefined) {
        state.scrollQuantities[i] = addByteCapped(state.scrollQuantities[i]!, 1);
      }
      break;
    }
    case "equipment": {
      const code = grant.qty; // código de equipo 0..47 (índice de 0x57C0)
      if (state.equipmentQuantities?.[code] !== undefined) {
        const add = code === 0x1b || code === 0x1d ? 5 : 1; // munición en lotes de 5
        state.equipmentQuantities[code] = addByteCapped(state.equipmentQuantities[code]!, add);
      }
      break;
    }
    case "sandalwood":
      state.specialItems.woodenBox = true; // 0x14F0 g_wooden_box=0xFF
      break;
    // "chest" (id 1) en el mundo es un cofre anidado (no un contador); "unknown" defensivo.
    case "chest": case "unknown": break;
  }
}

// Botín de sala de mazmorra (DS:0x41BC/0x41C4/0x41CC) — 7 filas.
const DUNGEON_GUARD = [2, 4, 5, 10, 20, 25, 25];
const DUNGEON_MAXAMT = [31, 0, 3, 3, 3, 7, 7];
const DUNGEON_ITEM = [15, 2, 7, 8, 13, 0xff, 0xff];

/**
 * Botín de cofre abierto en sala de mazmorra (0x179E), filas si=0..6.
 * Reproduce el orden EXACTO de rand. `floor` = planta 0..7.
 */
export function dungeonChestLoot(floor: number, rand: RandFn): LootGrant[] {
  const grants: LootGrant[] = [];
  for (let si = 0; si <= 6; si++) {
    const roll = rand(1, floor * 4 + 4); // 182b
    if (DUNGEON_GUARD[si]! > roll) continue; // 183f: sin tirada de cantidad
    if (si === 5) {
      const qty = rand(0, 7); // 1851
      grants.push({ id: 3, category: "potion", qty }); // type 3 = POCIÓN
    } else if (si === 6) {
      const qty = rand(0, 7); // 186a
      grants.push({ id: 4, category: "scroll", qty }); // type 4 = SCROLL
    } else if (si === 1) {
      const qty = rand(1, floor * 8); // 187d..1896
      grants.push({ id: 2, category: "gold", qty }); // ORO
    } else {
      const qty = rand(1, DUNGEON_MAXAMT[si]!); // 188c..1896
      const id = DUNGEON_ITEM[si]!;
      grants.push({ id, category: lootCategory(id), qty });
    }
  }
  return grants;
}

// ───────────────────────────── Camp / Hole-up (CMDS 0x0552) ────────────────
// Por miembro elegible: HP += rand(1,63) (clamp maxHP) + restaura MP; y una tirada
// rand(0,99) < 25 dispara la APARICIÓN (handler 0xbfd6 = OUTSUBS camp_results, ver
// re/notes/oracle-camp-event.md — NO una emboscada). Helper de curación 0x0400.

export interface CampResult {
  /** El gate `rand(0,99)<25` (0x04f4) cruzó → corre la aparición (camp_results 0x0658).
   *  NO es una emboscada: el call-site del gate (CMDS 0x0502) salta a 0xbfd6 = la
   *  aparición benévola (cura total + status='G' + level-up + discurso de karma). */
  apparition: boolean;
}

/**
 * Curación parcial + gate de la APARICIÓN de una acampada — helper 0x0400 (CMDS 0x0552).
 * Corre **UNA SOLA VEZ POR ACAMPADA**, NO por hora: el bucle externo de la escena
 * sólo avanza el reloj en pasos de 5 min hasta `target_hour`, y esta pasada de
 * curación se ejecuta una vez (el cooldown `g_unk_588c` recarga a 0x0E al terminar,
 * 0x0505, y bloquea cualquier repetición dentro de la ventana de ≤9 h de la
 * acampada). Por miembro vivo NO-guardia: `HP += rand(1,63)` (clamp maxHP, SIN gate
 * de HP-lleno — el binario tira igual y satura, 0x046e) y restaura MP por clase
 * (0 rand, 0x0483-0x04e2): Avatar/Mage → MP=INT; Bard → INT/2; Fighter → sin MP.
 * Luego UNA tirada `rand(0,99) < 25` (0x04f4): si cruza, el binario llama al handler
 * `0xbfd6` (0x0502) = la APARICIÓN (OUTSUBS camp_results 0x0658; cura total, status='G',
 * level-up, discurso de karma), NO una emboscada — resuelto por oráculo runtime, ver
 * `re/notes/oracle-camp-event.md`. La aparición la cablea `Game.camp()` sobre este flag.
 * Total de rands DE ESTE HELPER = (#elegibles) heal + 1 gate. ⚠ NO es el total de la
 * ACAMPADA: si el gate cruza, `Game.camp()` llama a continuación a `campApparition`
 * (`quest/lordbritish.ts`, OUTSUBS 0x0752), que tira **1 `rand(1,3)` MÁS por miembro que
 * SUBE de nivel** — 0 si no sube ninguno, que es por lo que la cuenta vieja cuadraba en
 * el caso común. Corregido en #259: contaba el CUERPO de la rutina y no su callee
 * (familia #218), y su propio hermano lo dice — `lordbritish.ts` pone ese rand DENTRO
 * de esta misma secuencia (CMDS 0x046e → 0x04f4 → 0x0502 → OUTSUBS 0x0752).
 *
 * Esta cura parcial (0x046e) es DISTINTA e independiente de la cura total de la
 * aparición: corre en TODA acampada elegible (subject a los gates hours>5/cooldown),
 * mientras la cura total sólo cruza el 25 %. NO se retira (es la cura base de acampar).
 *
 * `guardIdx` = índice (en `members`) del que hace guardia; NO se cura ni recupera
 * MP (0x0461 `cmp si,[bp+6]; je skip` y 0x0481 idem para el MP). -1 = sin guardia.
 * (La APARICIÓN, en cambio, SÍ cura al de guardia — su loop no respeta el watch.)
 *
 * ⚠️ Gates NO reproducibles headless (Clase C, ver `deliberate-divergences.md §3`):
 * el cooldown horario `g_unk_588c<1` (asumido 0 = 1ª acampada) y la puerta
 * `[bp+4] hours>5` de 0x03f4/0x0453 (que salta el helper entero con horas≤5). El
 * clon los omite. EXCLUIDO del set seed-exacto.
 */
export function campHoleUp(
  members: CharacterState[],
  rand: RandFn,
  guardIdx = -1,
): CampResult {
  for (let i = 0; i < members.length; i++) {
    const m = members[i]!;
    if (m.status === STATUS_DEAD) continue;
    if (i === guardIdx) continue; // el de guardia no cura ni recupera MP (0x0461/0x0481)
    m.currentHp = Math.min(m.maxHp, m.currentHp + rand(1, 63)); // 046e (sin gate HP-lleno)
    if (m.class === "A" || m.class === "M") {
      m.currentMp = m.intelligence; // 0499: A/M → MP = INT
    } else if (m.class === "B") {
      m.currentMp = m.intelligence >> 1; // 04d6: B → MP = INT/2
    }
  }
  const apparition = rand(0, 99) < 25; // 04f4 → 0x0502 call 0xbfd6 (UNA vez por acampada)
  return { apparition };
}

// ───────────────────────────── Search puerta secreta (SJOG 0x095C) ─────────
// Determinista, cero rand. Puerta secreta: tile 0x4E → 0xB9 ó 0xB8.
//
// ★ EL DISCRIMINADOR ES `g_floor >= 0x80`, NO «es mazmorra» (#150). La rama entera,
// literal (SJOG.OVL CS:0x0b33):
//
//   0b33: 837ef24e    cmp word ptr [bp - 0xe], 0x4e     ; el tile apuntado
//   0b37: 7535        jne 0xb6e
//   0b39: b8488a      mov ax, 0x8a48                    ; DATA.OVL file 0x8a58
//   0b3c: 50          push ax                           ;   b'a hidden door!\n'
//   0b3d: e8904d      call 0x58d0                       ; print_string
//   0b40: 803e955880  cmp byte ptr [g_floor], 0x80      ; ★ DS:0x5895, comparado como
//   0b45: 7311        jae 0xb58                         ;   BYTE SIN SIGNO (jae)
//   0b47: ff76f8      push word ptr [bp - 8]            ; ── rama floor < 0x80 ──
//   0b4d: e83279      call 0x8482                       ; tile_addr
//   0b52: c607b9      mov byte ptr [bx], 0xb9           ;   → 0xB9
//   0b55: eb0f        jmp 0xb66
//   0b58: ff76f8      push word ptr [bp - 8]            ; ── rama floor >= 0x80 ──
//   0b5e: e82179      call 0x8482
//   0b63: c607b8      mov byte ptr [bx], 0xb8           ;   → 0xB8
//   0b66: 800ee62402  or byte ptr [g_unk_24e6], 2       ; turno consumido
//
// Y «mazmorra» no puede ser el criterio porque esta rama es INALCANZABLE en mazmorra:
// la cabecera de la misma rutina (CS:0x0969 `cmp [g_location],0x20 / jbe` + CS:0x0970
// `cmp 0x29 / jae`) desvía TODO el rango 0x21-0x28 a `call 0x646` (la búsqueda de
// mazmorra) y retorna. Si llegas al 0x0b33, NO estás en mazmorra.
//
// QUÉ ES `floor >= 0x80`: el piso leído como byte SIN SIGNO ⇒ **piso bajo tierra**.
// Cubre el Underworld (0xFF) y los SÓTANOS de pueblos/castillos (z = −1, que como byte
// es 0xFF). Es el mismo criterio ya derivado en `survival.ts lightLevel` (0x50BA
// `cmp byte [g_floor],0x7f; ja`), que además documenta la trampa: **en el port `floor`
// es un número CON SIGNO** (−1 para el sótano), así que hay que enmascarar a byte —
// un `floor >= 0x80` literal daría false para −1 y dejaría el sótano sin arreglar.
const SECRET_DOOR_TILE = 0x4e;
const REVEALED_DOOR_ABOVE = 0xb9; // floor < 0x80 (superficie y plantas altas)
const REVEALED_DOOR_BELOW = 0xb8; // floor >= 0x80 (sótano z=−1 / Underworld 0xFF)

/**
 * Revela una puerta secreta al buscar. Devuelve el tile revelado o null.
 * `floor` es `state.position.floor` del port (con signo: −1 = sótano, 0xFF = Underworld);
 * se enmascara a byte para reproducir el `cmp byte [g_floor],0x80 / jae` de CS:0x0b40.
 */
export function revealSecretDoor(tile: number, floor: number): number | null {
  if (tile !== SECRET_DOOR_TILE) return null;
  return (floor & 0xff) >= 0x80 ? REVEALED_DOOR_BELOW : REVEALED_DOOR_ABOVE;
}
