/**
 * ACAMPADA — (H)ole up & camp (kernel_camp_holeup 0x3C9A + CMDS 0x0552) — extraída
 * de la clase Game (lote 2 del refactor de monolitos, patrón TRAMO 3/ARQ-3):
 * precondiciones de contexto, cama de pueblo, bucle de sueño con emboscada
 * (AMBUSH_TABLE), despertar con curación + APARICIÓN, rechazo con turno y
 * reparación de casco. Los MOTORES puros (campHoleUp/campApparition/repairHull/
 * ringRegenSweep) ya vivían en world/commands.ts / quest/lordbritish.ts /
 * world/transport.ts / world/survival.ts; aquí va la ORQUESTACIÓN con contexto
 * estrecho. Game delega (fachada, firmas intactas). Comentarios-cita ÍNTEGROS.
 */
import type { GameState } from "../state.js";
import type { GameEvent } from "../game.js";
import type { DungeonState } from "../dungeon/dungeon.js";
import type { EnemyDef, EntryDirection } from "../combat/index.js";
import { CombatMapIndex } from "../combat/index.js";
import type { OverworldEnemy } from "./enemies.js";
import { advanceClock, ringRegenSweep, type RandFn, type SkyRefreshCtx } from "./survival.js";
import { campHoleUp } from "./commands.js";
import { isFrigateSailsUp, repairHull, HULL_MAX } from "./transport.js";
import { campApparition } from "../quest/lordbritish.js";
import { sfxEvent } from "../sfx.js";
import { tf } from "../../i18n/index.js";

/** Tile LeftBed (0xAB) — (H)ole up sobre él en un pueblo → dormir en cama (CMDS 0x0552,
 * despacho 0x32b9 `cmp 0xab`). RightBed (0xAC) NO cuenta: el original sólo comprueba 0xAB. */
const LEFT_BED_TILE = 0xab;

/**
 * Tabla de enemigos de la emboscada del bucle de sueño (CMDS.OVL 0x0239-0x0244:
 * `rand(0,7)` indexa 8 bytes en DS 0x1734 = DATA.OVL fileoff 0x1744). Cada byte es
 * directamente el `OverworldEnemy.defIndex` (índice de TIPO en la tabla de 48):
 * confirmado por disasm en la resolución del bloqueo #8 — `kernel_spawn_actor`
 * (0x6506, vía 0x6BC2) usa el byte `[bp+0xc]<<3+0x13c1` para derivar el sprite y lo
 * guarda como el campo TIPO del actor (`[si+3]`), mismo espacio que `TROLL_DEF_INDEX`
 * (41=0x29). Los 8 bytes → `enemyDefs[i].name`: 0x29 Troll·0x14 Giant Rat·0x15 Bat·
 * 0x18 Slime·0x16 Giant Spider·0x19 Gremlin·0x24 Headless·0x14 Giant Rat (Giant Rat
 * sale doble ⇒ 25%). Anclada byte a byte a DATA.OVL por `camp-ambush.test.ts` (rompe
 * la circularidad del volcado a mano; patrón de `_load_data_ovl_tables`). Refs:
 * re/notes/camp-ambush-resolution.md (§1), re/notes/camp-ambush-spec.md §2.1. */
export const AMBUSH_TABLE = [0x29, 0x14, 0x15, 0x18, 0x16, 0x19, 0x24, 0x14] as const;

/**
 * Record 5 de KARMA.DAT (offset de byte 0x29f=671, byte-exacto) — el que la nota de
 * death-resurrection declaró "inalcanzable" por la vía del refuge (su tabla DS 0x1a74
 * tiene basura en el 6º offset). SÍ es alcanzable por la APARICIÓN de acampada: con
 * karma≥80 (index≥4) OUTSUBS 0x0923 `jge 0x940` salta la tabla y carga el offset FIJO
 * 0x29f (0x094c `push 0x29f` → loader 0x256e). Entrecomillado como los demás (prefijo
 * DS 0x77e0 `\n"` + putchar '"' 0x095a). Ver re/notes/camp-apparition-scene.md §5.
 */
const CAMP_KARMA_MESSAGES: readonly string[] = [
  "\"Well armed art thou to fight Death's embrace, O enlightened one! Thy destiny awaits thee!\"", // KARMA.DAT rec5 (camp, karma 80-99)
];

/** Contexto estrecho de la acampada (lo arma Game.campCtx()). */
export interface CampCtx {
  state: GameState;
  rand: RandFn;
  /**
   * ★ #176 — contexto del refresco del LATCH de fases lunares que corre en la cola de
   * `advance_clock` (0x514a-0x5161). Lo produce `Game.skyRefreshCtx`. Sin él el latch
   * no se toca (arneses puros).
   */
  sky?: SkyRefreshCtx;
  /** Modo mazmorra 3D activo (gate de contexto 0x3d5b: sin chequeo de terreno). */
  dungeonState: DungeonState | null;
  /** Tabla de tipos de enemigo (combatResources?.enemyDefs); undefined en mocks. */
  enemyDefs: EnemyDef[] | undefined;
  /** Tabla de records 0-4 de KARMA.DAT (compartida con el refuge, vive en Game). */
  refugeKarmaMessages: readonly string[];
  mapTileWithOverrides(x: number, y: number): number;
  /**
   * GUARDA 2 del paseo del vigía (`CS COMBAT.OVL:0x0000` vía CMDS 0x03a6): ¿está LIBRE la
   * casilla `(col,row)` de la arena de acampada? INYECTADO por `Game` —igual que
   * `isValidGuard` en `CampPromptCtx`— para que el núcleo no tenga que saber leer la arena
   * ni la formación, y para no obligar a la piel a alcanzar el core en runtime (lo prohíbe
   * `skin-import-guard`). Ausente (arneses puros) ⇒ se trata todo como libre.
   */
  campCellFree?: (col: number, row: number) => boolean;
  /**
   * Puesto de formación del vigía en la arena de acampada — de dónde ARRANCA el paseo.
   * INYECTADO por `Game` por lo mismo que `campCellFree`: la formación la conoce la capa
   * que tiene la arena, no el núcleo. Lo consume `camp()` (la versión atómica) para
   * enhebrar la celda igual que hace la piel paso a paso; ausente ⇒ el paseo no corre.
   */
  campGuardStartCell?: (guardIdx: number) => CampGuardCell | null;
  /**
   * SNAP de los NPC a su tramo horario — `npc_activate_all_town` TOWN.OVL 0x1694
   * (#158). Lo provee `Game.wakeSnapNpcs` (→ `NpcManager.enterMap`). Va en el CTX y no
   * dentro de `Game.bedSleep` porque el binario lo llama DENTRO del bucle de sueño
   * (`CMDS 0x0677`), una vez por paso, no una vez al final. Medido (#241): no consume
   * RNG, y N llamadas dejan el MISMO estado final que 1 a la hora de destino.
   */
  snapNpcsToSchedule(): void;
  /**
   * `find_object_at_xy(x, y, floor)` — ULTIMA.EXE 0x368E. Barre `g_world_objects`
   * 0x5C5A slots 1..31 (si 0x5c62→0x5d52, stride 8) comparando los campos +2/+3/+4 con
   * los TRES argumentos, y devuelve el byte +0 del slot que casa (0 = ninguno). En el
   * binario esa tabla lleva objetos Y actores en la MISMA lista (npc/manager.ts:86); el
   * port las tiene separadas, así que el equivalente consulta las dos. Lo provee
   * `Game.objectOrNpcAt`. Devuelve `true` = «hay ocupante en la casilla».
   */
  objectOrNpcAt(x: number, y: number, floor: number): boolean;
  runContextTurn(opts: { consumed: boolean }): GameEvent[];
  startCombat(
    enemy: OverworldEnemy,
    entryDirection: EntryDirection,
    opts: { combatMapIndex?: number; intro?: "attacked" | "none"; removeFromMap?: boolean },
  ): GameEvent[];
}

/**
 * Precondiciones del comando (H)ole up & camp — kernel_camp_holeup 0x3C9A
 * (0x3cb4-0x3da3). Strings verbatim de DATA.OVL. Devuelve:
 *  - {ok:true, ship:false} → acampar a pie / en mazmorra (flujo normal).
 *  - {ok:true, ship:true}  → a bordo de fragata → reparar casco (repairHull).
 *  - {ok:true, bed:true}   → en un pueblo SOBRE una cama (tile 0xAB LeftBed) → dormir en
 *    cama (CMDS 0x0552): prompt de horas + pasar tiempo, SIN watch/emboscada/heal.
 *  - {ok:false, message}   → contexto inválido. `inTown` marca el rechazo de
 *    pueblo/castillo/dwelling (imprime su propia cabecera "Hole up-", no "Hole up & camp!").
 */
export function campContext(
  ctx: CampCtx,
):
  | { ok: true; ship: boolean; bed?: boolean }
  | { ok: false; message: string; inTown?: boolean } {
  // Mazmorra: sin chequeo de terreno/vehículo (0x3d5b/0x3d76/0x3d90 saltan con
  // g_location >= 0x21).
  if (ctx.dungeonState) return { ok: true, ship: false };
  // A bordo de fragata → rama de reparación de casco (0x3cb7 `and 0xf8; cmp 0x20`).
  if (ctx.state.transport === "ship") {
    // "Sails must be lowered!" (0xa2dc+0xa2ec) si la vela sigue izada (0x3cc7
    // `cmp [g_char_anim_states+1],0x24; jae`). Derivado del tile de transporte.
    const tt = ctx.state.transportTile;
    if (tt !== undefined && isFrigateSailsUp(tt)) {
      return { ok: false, message: "Sails must be\nlowered!\n\n" };
    }
    return { ok: true, ship: true };
  }
  // Pueblo/castillo/dwelling/keep (g_location 0x01-0x20): NO se acampa en el suelo. El
  // despachador de 'H' (kernel 0x3288) sólo llama a camp (0x3C9A) con g_location==0
  // (overworld) o >0x20 (mazmorra); para 0x01-0x20 desvía a la rama pueblo (0x329c) que lee
  // el tile BAJO el party: si es una CAMA (tile 0xAB = LeftBed) → dormir en cama (CMDS
  // 0x0552, 0x32b9 `cmp 0xab; je`); si NO → "Hole up- Only in bed!" (DATA.OVL 0xa170+0xa17a)
  // y COBRA turno (el reject salta a 0x31ee con [bp-2]=1 por defecto). Sólo el overworld y la
  // mazmorra admiten acampar a la intemperie. (Corrige: 0xAB es LeftBed, NO casco de barco.)
  const loc = ctx.state.position.location;
  if (loc >= 1 && loc <= 0x20) {
    const under = ctx.mapTileWithOverrides(ctx.state.position.x, ctx.state.position.y);
    if (under === LEFT_BED_TILE) return { ok: true, ship: false, bed: true }; // 0xAB → dormir en cama
    return { ok: false, message: "Hole up- Only in bed!\n", inTown: true };
  }
  // Overworld a pie: rechazo sobre agua (tiles 1..3; tile 0 permitido) —
  // 0x3d7d `cmp 0; je` (0 OK) + 0x3d83 `cmp 4; jae` (>=4 OK) ⇒ sólo 1..3 rechaza.
  if (ctx.state.position.location === 0) {
    const under = ctx.mapTileWithOverrides(ctx.state.position.x, ctx.state.position.y);
    if (under >= 1 && under <= 3) return { ok: false, message: "On land or ship!\n\n" }; // 0xa30e
    // Cualquier otro vehículo que no sea "a pie" → "On foot!" (0x3d97-0x3da0).
    if (ctx.state.transport !== "foot") return { ok: false, message: "On foot!\n" }; // 0xa322
  }
  return { ok: true, ship: false };
}

/**
 * Dormir en una CAMA de pueblo — CMDS 0x0552 (despachado por 'H' sobre tile 0xAB
 * LeftBed). A diferencia del camp a la intemperie: **NO hay watch, NO hay emboscada y
 * NO hay curación** (0x0552 no llama al helper 0x0400) — sólo pasa el tiempo con el
 * party dormido ('G'→'S'→'G', 0x05fa/0x06bf; transitorio, invisible al discretizar).
 * Sólo "Zzzzzzz..." (DS 0x421e). `hours` 1..9.
 *
 * EL BUCLE DEL BINARIO, leído entero (entra por `jmp 0x63b`, o sea la comprobación de
 * hora va ANTES del primer avance):
 * ```
 *   0634  push 1 / call 0x617a          ; DELAY de fotograma (ULTIMA.EXE 0x20FA, int 1Ch)
 *   063b  cmp si, g_hour / je 0x692     ; ¿ya es la hora de destino? → sale del bucle
 *   0647  push 0xa / call 0xffff8ffc    ; ★ advance_clock(10) = ULTIMA.EXE 0x4F7C
 *   064e  si la hora CAMBIÓ a 20 o a 5 → call 0xffffbb1a (transición día/noche)
 *   0677  call 0xffffbb0e               ; ★ EL SNAP → TOWN.OVL 0x1694
 *   0688  call 0x770e                   ; ★ EL GATE, con (g_party_x, g_party_y, g_floor)
 *   068b  or ax,ax / je 0x634           ; 0 ⇒ otra vuelta; ≠0 ⇒ cae a 0x068f
 *   068f  mov si,0xffff → 0x692 → 0x069d imprime DS 0x422a "Thrown out of bed!\n"
 * ```
 * ⇒ ORDEN por paso: **avanzar reloj → snap → gate**, y el gate que ACIERTA **termina el
 * sueño** (0x068f cae al epílogo común de 0x0692, no vuelve a 0x0634). El port hace lo
 * mismo con su paso de 1 h.
 *
 * EL GATE (#149/#230, derivación cerrada). `call 0x770e` @0x0688 con la terna empujada en
 * 0x067a/0x0680/0x0684 = (g_party_x, g_party_y, g_floor): LA CASILLA PROPIA de la party,
 * ninguna vecina. 0x770e = ULTIMA.EXE 0x368E `find_object_at_xy`, CUERPO LEÍDO (no sólo por
 * uso): barre g_world_objects 0x5C5A slots 1..31 (si 0x5c62→0x5d52, stride 8), compara los
 * campos +2/+3/+4 con los tres args, devuelve el byte +0 del slot que casa (0 si ninguno) y
 * deja su índice en g_cmb_scratch_x (0x36D8); con g_location>0x7f se salta la comparación de
 * planta (0x36c0). ⇒ dispara si hay CUALQUIER registro de esa tabla EN TU CASILLA, y en el
 * binario objetos y actores comparten tabla (npc/manager.ts:86); la cama es TERRENO (tile
 * 0xAB), no un registro de 0x5C5A.
 *
 * ★ ALCANZABLE, y por eso está cableado (#230, `re/notes/eslabon-230-acta.md`): el snap
 * `npc_activate_all_town` (TOWN 0x1694) llama a TOWN 0x1726, que en 0x182f/0x1836/0x183d
 * escribe X/Y/Z del tramo horario en `[si+0x5c5c]/[5d]/[5e]` = los campos +2/+3/+4 de
 * 0x5C5A **que el gate compara**. O sea: el snap de la hora N puede meter a un NPC en tu
 * casilla y el gate lo encuentra en esa MISMA iteración. La lectura vieja de este docblock
 * («0x1694 escribe sólo la banda de runtime, el eslabón es aparte») era prudente de más.
 *
 * DIVERGENCIA DECLARADA (Clase C, medida en #241 — no oculta). Es UNA, y describe el
 * estado ACTUAL del port (⚠ esta lista se lee como estado del CLON, no del binario):
 *  · HORA DE DESTINO: el binario sale cuando `g_hour == target` (0x063b) con
 *    `target = g_hour + hours` y **`-0x17` (23), no `-0x18`**, si pasa de 0x17 (0x05ab);
 *    el port duerme `hours` horas completas. Cabo con tarjeta propia — el binario duerme
 *    hasta el filo de hora, y al envolver por medianoche su destino sale UNA HORA TARDE.
 *
 * (Aquí vivía una segunda viñeta, «CADENCIA: el port da 1 paso de 60 min por hora», que
 * quedó RANCIA al aterrizar `5d7e0a04`: el bucle de abajo ya da los SEIS pasos de diez
 * minutos con snap+gate en cada uno. Se retira, no se reescribe — una lista de
 * divergencias que contradice al código veinte líneas más abajo sólo engaña al lector
 * DILIGENTE, que es quien la abre y se la cree. No la re-añadas desde una rama vieja.)
 *
 * EL EPÍLOGO (0x0692-0x06e1), común a LAS DOS salidas — portado en #250:
 * ```
 *   06a4-06cc  por miembro (si=0x55b3, stride 0x20): 'S'(0x53) → 'G'(0x47)
 *   06d5  fe069658  inc byte ptr [g_party_x]          ; ★ SALE DE LA CAMA AL ESTE
 *   06d9  c606e62401 mov byte ptr [g_unk_24e6], 1     ; marca de repintado (#228)
 *   06de  fe065c5c  inc byte ptr [0x5C5C]             ; ★ ver abajo: NO es un contador
 * ```
 * ★★ QUÉ ES 0x06de, medido y no supuesto (#250/#251). El disasm lo etiqueta
 * `g_char_anim_states+2` y el ledger ficha 0x5C5A como «animation states», pero los BYTES
 * son `inc [0x5C5C]` y 0x5C5A+2 = 0x5C5C = **el campo +2 del SLOT 0** de la misma tabla que
 * barre `find_object_at_xy` (slot 1 empieza en 0x5C62, stride 8). Dos testigos independientes
 * fijan qué es ese campo: TOWN 0x160d-0x161c y ULTIMA.EXE 0x53a6-0x53b5 copian
 * `g_party_x`→0x5C5C, `g_party_y`→0x5C5D, `g_floor`→0x5C5E. ⇒ el slot 0 es **el registro del
 * PROPIO party** (por eso 0x368E arranca en el slot 1: para no encontrarse a sí mismo), y
 * 0x06de es **el MISMO +1 de 0x06d5 replicado en el espejo de la tabla de objetos**, no una
 * animación ni una tercera escritura. El port tiene UNA sola representación de la posición
 * (`state.position`), así que el +1 se aplica UNA vez: replicarlo sería moverse dos casillas.
 *
 * ★ ¿ES CIEGO EL +1? Sí en el código —`inc` pelado, cero tests, y nada aguas abajo lo corrige
 * (tras 0x06de sólo van `call 0x6980` repintado y `call 0xffff9990`, luego `ret`)—, pero el
 * DATO lo hace seguro: barridas las 32 small maps, las **264 casillas LeftBed (0xAB) tienen
 * RightBed (0xAC) al este, 264/264, cero contraejemplos**, y las dos son transitables. La
 * cama es de DOS tiles y se duerme en la izquierda (el despacho sólo acepta 0xAB, 0x32b9),
 * así que el paso al este cae siempre en la mitad derecha. Es escritura ciega con invariante
 * de datos — NO extrapolar a su hermana #227 (allí el mismo patrón cae en muro el 48 % de las
 * veces; ver `game.ts::spawnWishHorse`).
 *
 * NO portado y por qué: `g_unk_24e6` es la marca de repintado de #228 (58 accesos, un solo
 * lector) y el port no modela esa capa; anotado allí, no inventamos campo.
 */
export function bedSleep(ctx: CampCtx, hours: number): GameEvent[] {
  // Versión ATÓMICA (tests/paridad), COMPUESTA de las mismas tres piezas que conduce la
  // piel paso a paso (`bedSleepBegin`/`bedSleepStep`/`bedSleepEnd`). Se compone en vez de
  // duplicarse a propósito: es lo que hace IMPOSIBLE que el camino atómico y el paceado
  // diverjan en orden de llamadas —y por tanto en consumo de RNG— sin que un test lo diga.
  // (La acampada tiene el mismo reparto, pero allí `camp()` reimplementa el bucle y su
  // docblock ha tenido que PROMETER «idéntico orden de rands»; aquí no hay nada que
  // prometer porque hay un solo cuerpo.)
  const events: GameEvent[] = bedSleepBegin(ctx);
  const bedSteps = hours * BED_STEPS_PER_HOUR;
  for (let step = 0; step < bedSteps; step++) {
    const s = bedSleepStep(ctx);
    events.push(...s.events);
    if (s.thrownOut) break; // el binario NO vuelve a 0x0634: cae al epílogo
  }
  events.push(...bedSleepEnd(ctx));
  return events;
}

/**
 * ENTRADA del sueño en cama — «Zzzzzzz...» + el roster 'G'→'S' (CMDS 0x05e6-0x0611).
 *
 * El ORDEN es el del binario y no es indiferente: el bucle de roster (0x05f5) va ANTES
 * del `print` (0x0611), así que al pintarse el mensaje los durmientes ya están en 'S'.
 * Aquí el evento del mensaje se emite primero porque `applyEvents` lo consume DESPUÉS de
 * que esta función haya mutado el estado — el orden observable es el mismo.
 *
 * Y es la pieza que cierra el apagón de #296: el `set_color(0)` + `fill_rect(8,8,0xb7,0xb7)`
 * (0x0614-0x0624) cae JUSTO detrás de este bloque, o sea que la cortina negra se monta con
 * el roster ya dormido y el «Zzzzzzz...» ya impreso. Quien conduzca esto paso a paso monta
 * la cortina aquí; el core no la conoce (es presentación).
 */
export function bedSleepBegin(ctx: CampCtx): GameEvent[] {
  const events: GameEvent[] = [{ kind: "message", text: "Zzzzzzz...\n" }]; // DS 0x421e
  // 0x05f5-0x05fa: sólo los 'G'(0x47) se duermen a 'S'(0x53); un 'P'/'D' se queda como está.
  for (const ch of ctx.state.characters.slice(0, ctx.state.partySize)) {
    if (ch.status === "G") ch.status = "S";
  }
  return events;
}

/**
 * UN PASO del bucle de sueño en cama = DIEZ MINUTOS (0x0634-0x068d).
 *
 * LA HORA DE CAMA SON SEIS PASOS DE DIEZ MINUTOS (0x0647 `advance_clock(10)` POR PASO) —
 * y DIEZ, no cinco: la cadencia de la cama NO es la del camp (que va de 5 en 5, 12 por
 * hora). Son rutinas distintas con ritmos distintos y unificarlas metería en una el ritmo
 * de la otra. El comentario de esta línea ya citaba el `advance_clock(10)` mientras el
 * código avanzaba 60 de golpe — el mismo desajuste comentario/estructura que el bucle
 * postizo del anillo en `campSleepStep`.
 *
 * Y no es cosmético: el SNAP de NPCs y el gate de «Thrown out of bed!» corren en CADA
 * paso (0x0677 antes del gate, en la misma vuelta), así que con un paso de 60' el port
 * daba 6× MENOS OPORTUNIDADES de que te echaran de la cama (ficha #22).
 *
 * ⚠ El paso NO recibe ni `h` ni `hours`: a diferencia de `campSleepStep` —donde la
 * emboscada se gatea por cruce de hora y la ÚLTIMA hora no tira— aquí el cuerpo del bucle
 * es idéntico en todas las vueltas (0x0634 es un único punto de retorno). Pasarle el
 * índice invitaría a inventarse un gate que el binario no tiene.
 *
 * ★ Lo que este paso NO modela, y está en el binario: el `delay_ticks(1)` de 0x0634-0x0638
 * (kernel 0x20FA), que es lo que hace VISIBLE el sueño en 1988. Es presentación pura (no
 * toca estado ni RNG) y por eso vive en la piel — `ui/bed-sleep.ts` lo conduce con su
 * reloj de pared. Ver la nota de cadencia de ese fichero antes de tocar el número.
 */
export function bedSleepStep(ctx: CampCtx): { events: GameEvent[]; thrownOut: boolean } {
  const events: GameEvent[] = [];
  advanceClock(ctx.state, BED_STEP_MINUTES, ctx.rand, ctx.sky); // 0x0647
  ctx.snapNpcsToSchedule(); // 0x0677 → TOWN 0x1694, ANTES del gate y en la misma vuelta
  const pos = ctx.state.position;
  if (ctx.objectOrNpcAt(pos.x, pos.y, pos.floor)) {
    // 0x0688 find_object_at_xy(g_party_x, g_party_y, g_floor) != 0 ⇒ 0x068f si=0xFFFF
    events.push({ kind: "message", text: "Thrown out of bed!\n" }); // 0x069d, DS 0x422a
    return { events, thrownOut: true }; // el sueño TERMINA aquí
  }
  return { events, thrownOut: false };
}

/**
 * EPÍLOGO del sueño en cama (0x0692-0x06e1), común a LAS DOS salidas (horas agotadas y
 * «Thrown out of bed!»). Roster 'S'→'G', el `+1` al este y el refresco del HUD.
 * La derivación entera —incluido por qué el `+1` es ciego y aun así seguro— vive en el
 * docblock de `bedSleep`, arriba.
 */
export function bedSleepEnd(ctx: CampCtx): GameEvent[] {
  // 0x06ba-0x06bf: sólo los 'S' vuelven a 'G' ⇒ el viaje de ida y vuelta es la IDENTIDAD
  // para quien no estaba sano (el 'P' envenenado sigue 'P'), que es justo lo que hace el asm.
  for (const ch of ctx.state.characters.slice(0, ctx.state.partySize)) {
    if (ch.status === "S") ch.status = "G";
  }
  ctx.state.position.x += 1; // 0x06d5 `inc byte ptr [g_party_x]` — sin test, ver docblock
  return [{ kind: "party-changed" }]; // el reloj (y fase día/noche) cambió
}

/**
 * Nº de miembros despiertos elegibles para montar guardia — bucle 0x3e06-0x3e24:
 * cuenta status 'G'(0x47) o 'P'(0x50). El prompt "Wilt thou set a watch?" sólo
 * aparece si el conteo es > 1 (0x3e2c `cmp [bp-4],1; jle`).
 */
export function campWatchCount(ctx: CampCtx): number {
  let n = 0;
  for (let i = 0; i < ctx.state.partySize && i < ctx.state.characters.length; i++) {
    const s = ctx.state.characters[i]?.status;
    if (s === "G" || s === "P") n++;
  }
  return n;
}

/**
 * Comando (H)ole up & camp — kernel_camp_holeup 0x3C9A → sleep 0x6360/0x5f86 +
 * helper de curación 0x0400 (CMDS 0x0552). `hours` ∈ 1..9 (0 = cancelado, se
 * gestiona en el wiring SIN llamar aquí). `guardIdx` = índice del miembro que
 * hace guardia (-1 = ninguno; el de guardia NO se cura, 0x0461).
 *
 * Reloj: 0x0066-0x0079 fija target_hour = (g_hour + hours) mod 24 ⇒ **pasan N
 * horas de juego** (la escena las anima en pasos advance_clock(5), 0x0318). El
 * port discretiza: advanceClock(60) por hora (el modelo 1-acción-1-paso descarta
 * la cadencia por frame, L4 fuera de base). El stream vivo (rand) recorre el
 * re-sorteo de Shadowlords a medianoche.
 *
 * ⚠️ DIVERGENCIA de stream (Clase C, `deliberate-divergences.md`; NO seed-exacto): el
 * **bucle de sueño** del binario (CMDS 0x01ee-0x030c, previo al helper 0x0400) tira
 * `rand(0,63)==0` en CADA límite de hora cruzado (~N−1 veces por acampada de N h,
 * MISMO stream `call 0x6112`); si acierta (~1/64), hace combat-setup + "Ambushed!"
 * (0x0247) y **retorna temprano SIN heal/gate/aparición**. El port NO modela este
 * bucle → para acampadas de 2+ h el stream ya diverge ANTES del helper 0x0400. Ver la
 * rama real de "Ambushed!" en `port-t7-review.md` ⚖️1.
 *
 * Curación parcial + gate de la APARICIÓN: `campHoleUp` corre **UNA SOLA VEZ POR
 * ACAMPADA** (NO por hora): el helper 0x0400 se ejecuta una vez al montar la escena y
 * el cooldown `g_unk_588c` (recarga 0x0E, 0x0505) bloquea repeticiones dentro de las
 * ≤9 h. Consumo de rands = (#elegibles) heal + 1 gate. ⚠️ Clase C: el gate real
 * `g_unk_588c<1` y la puerta `hours>5` (0x03f4/0x0453) no se reproducen headless.
 *
 * Evento (0x04e7-0x0502): la tirada rand(0,99)<25 llama al handler 0xbfd6, resuelto
 * por oráculo runtime (`re/notes/oracle-camp-event.md`) a kernel 0x7F56 → OUTSUBS
 * `camp_results` 0x0658 = la **APARICIÓN** (NO una emboscada). Sólo entonces corre
 * `campApparition`: "An apparition!" (DS 0x7750, 0x0660) + cura total + status='G' +
 * level-up + MP por clase para cada miembro, en el orden del asm. SIN el gate → nada
 * de esto, pero el rand del gate se consume igual — **orden exacto SÓLO DENTRO del
 * helper 0x0400 aislado** (heal-parcial → gate 25% → rand(1,3) por level-up); NO para
 * el stream de `camp()` completo (ver la divergencia del bucle de sueño, arriba). El
 * discurso de karma (0x090e-0x0961) está CABLEADO (`campKarmaMessage`, karma/20 →
 * KARMA.DAT recs 0-3 o rec5) + el cierre "…vanishes…" (0x0964). Derivación completa:
 * re/notes/camp-apparition-scene.md.
 */
export function camp(ctx: CampCtx, hours: number, guardIdx = -1): GameEvent[] {
  // Versión ATÓMICA (tests/paridad): "Zzzz..." → N pasos de sueño en orden →
  // despertar. En CADA cruce de hora, ANTES del helper de curación, el binario
  // tira el roll de emboscada (CMDS 0x021d, `rand(0,63)==0`, ~1/64): N−1 rolls
  // por acampada de N h (la última hora == target_hour sale por 0x01f3 antes del
  // check). Al acertar RETORNA TEMPRANO (0x0306 ax=1) SIN curación/gate/aparición
  // (spec §3). La piel conduce estos MISMOS pasos uno a uno (campSleepStep +
  // campWake) para hacer VISIBLE el paso del tiempo, con idéntico orden de rands.
  const events: GameEvent[] = [{ kind: "message", text: "Zzzzzz...\n\n" }]; // DATA.OVL DS 0x41d4
  // ★ EL VIGÍA PASEA TAMBIÉN POR AQUÍ. El binario tiene UNA sola rutina
  // (`camp_sleep_scene`): el bloque del paseo (0x0337) cuelga del mismo bucle que la
  // emboscada y sólo se salta con `[bp+6] == -1` (sin vigía). Si esta versión atómica no
  // enhebrara la celda, con vigía consumiría 12 tiradas MENOS por hora que la piel — y la
  // promesa de «idéntico orden de rands» de este mismo docblock sería falsa sin ponerse
  // roja. La celda de arranque la da el ctx (`campGuardStartCell`, inyectada por Game);
  // sin ella —arneses puros, `guardIdx` -1— el paseo no corre, que es el caso 0x0337.
  let cell = guardIdx >= 0 ? (ctx.campGuardStartCell?.(guardIdx) ?? null) : null;
  for (let h = 0; h < hours; h++) {
    const step = campSleepStep(ctx, h, hours, cell);
    cell = step.guardCell;
    events.push(...step.events);
    if (step.ambush) return events; // early-return: sin campWake ni "Party rested!"
  }
  events.push(...campWake(ctx, guardIdx));
  return events;
}

/**
 * Un paso (1 h) del bucle de sueño — CMDS 0x01ee-0x030c. Avanza el reloj 60 min
 * (cruza la hora; el re-sorteo de Shadowlords a medianoche corre por el stream
 * vivo) y, salvo en la ÚLTIMA hora (== target_hour, sale por 0x01f3 ANTES del
 * check), tira `rand(0,63)==0` (0x021d, ~1/64). Al acertar elige enemigo con
 * `rand(0,7)` (0x0239, AMBUSH_TABLE), imprime "Ambushed!" y monta combate: la
 * acampada se corta (`ambush:true`) → el caller NO llama a campWake (0x0306 ax=1).
 *
 * ★ Entre las DOS tiradas el binario RE-SIEMBRA por reloj (CMDS `0x022b call 0x60d6`
 * time_hash + `0x022f call 0x60fe` srand); el port conserva su stream a propósito —
 * techo registrado en `re/notes/rng.md` §«Techos de paridad», no se deriva aquí (#197-T4).
 *
 * Aislado de `camp()` para que el wiring de la piel conduzca la secuencia paso a
 * paso (reloj visible avanzando) SIN alterar el orden de rands: las llamadas y su
 * orden son EXACTAMENTE las del bucle atómico. El sub-evento de guardia (watch,
 * §4) es Clase C y no se modela, así que este paso no consulta `guardIdx`.
 */
/** Celda de la ARENA de acampada (11×11, coords 0..10) donde está el vigía. */
export interface CampGuardCell {
  col: number;
  row: number;
}

/** Límite del tablero de once que aplica la guarda del binario (0..10, ambos inclusive). */
export const CAMP_ARENA_MAX = 10;

/**
 * Arena de acampada («CampFire», índice 0 de combatmaps) y celda de la HOGUERA.
 *
 * El ÍNDICE vive aquí, en el núcleo, porque lo necesitan los dos lados: la piel para pintar
 * la escena y `Game` para construir el predicado de casilla libre de la guarda 2 del paseo.
 * Quien lo importa desde la piel es `coreview` — el adaptador, único punto de la piel que
 * puede alcanzar el core.
 *
 * ⚠ La CELDA DE LA HOGUERA está DUPLICADA a propósito con la de `skin/campScene.ts`: la
 * guarda de arquitectura (`skin-import-guard`) PROHÍBE que una piel alcance el core en
 * runtime (sólo por tipos), así que compartirla por import está vetado por diseño. Lo que
 * evita que la duplicación se pudra es un test de coherencia que se pone rojo si divergen.
 */
export const CAMP_ARENA_INDEX = 0;
export const CAMP_FIRE_CELL = { col: 5, row: 5 } as const;

/**
 * CADENCIA DEL BUCLE DE DORMIR — y son DOS, no una.
 *
 * `camp` avanza el reloj de **5 en 5 minutos** (CMDS 0x0314 `push 5; call advance_clock`)
 * ⇒ 12 pasos por hora. La rama de **CAMA** de pueblo usa **10** ⇒ 6 pasos por hora (ficha
 * #22). Son rutinas distintas con ritmos distintos: **no hay un solo número que valga para
 * las dos**, y unificarlas metería en una la cadencia de la otra. El port daba UN paso de
 * 60' en ambas: misma hora de reloj, 12× (resp. 6×) menos muestreo.
 */
export const CAMP_STEP_MINUTES = 5;
export const CAMP_STEPS_PER_HOUR = 60 / CAMP_STEP_MINUTES; // 12
export const BED_STEP_MINUTES = 10;
export const BED_STEPS_PER_HOUR = 60 / BED_STEP_MINUTES; // 6

/**
 * PASEO DEL VIGÍA — una hora. `CS CMDS.OVL:0x0000 camp_sleep_scene`, tramo 0x0337-0x03e8.
 *
 * Es un PASEO ALEATORIO POR LOS CUATRO VIENTOS, no el vaivén de dos celdas que el port
 * tenía: aquello venía de una muestra corta de vídeo congelada como si fuera la regla
 * (evidencia refutada en la ficha #61). Medido, en este orden EXACTO:
 *
 *  1. `rand(0..3)` (0x0340-0x0347) y **sólo se mueve si sale EXACTAMENTE 2** (0x034a
 *     `cmp ax,2; je`) ⇒ una hora de cada cuatro. Si no sale 2, **NO vuelve a tirar**.
 *  2. Si se mueve, SEGUNDA `rand(0..3)` (0x0363-0x036a) para la dirección, entre las
 *     CUATRO ortogonales: 0=N (`dec y` 0x0382) · 1=S (`inc y` 0x03d8) · 2=E (`inc x`
 *     0x03de) · 3=O (`dec x` 0x03e4).
 *  3. DOS guardas, y **ninguna re-tira**: si cualquiera falla el vigía se queda quieto
 *     ESA hora, con la(s) tirada(s) ya gastada(s).
 *     · 0x038e (`CS ULTIMA.EXE:0x6d82`): ambas coordenadas estrictamente entre −1 y 11,
 *       o sea **0..10** — son los límites del TABLERO DE ONCE, no un recorte de cámara
 *       (esto es lo que cerró el cabo de la ficha #61 EN CONTRA de la reconciliación:
 *       la ranura del vídeo conserva sus TRES alcanzables, no dos).
 *     · 0x03a6 (`CS COMBAT.OVL:0x0000`): la casilla tiene que estar LIBRE — terreno
 *       transitable y sin durmiente encima. Se inyecta como `isFree` porque el predicado
 *       vive en quien conoce la arena y la formación, no aquí.
 *
 * El ORDEN de las dos tiradas es parte del fix: quien tire siempre las dos consume el
 * DOBLE de stream. Con `[bp+6] == -1` (sin vigía) el binario se salta el bloque entero
 * (0x0337) ⇒ CERO tiradas; por eso el llamador no debe invocar esto sin vigía.
 *
 * PURA: ni DOM ni estado global — celda entrante, dos tiradas, celda saliente.
 */
export function campGuardWalk(
  cell: CampGuardCell,
  rand: RandFn,
  isFree: (col: number, row: number) => boolean,
): CampGuardCell {
  if (rand(0, 3) !== 2) return cell; // 0x034a: sólo el 2 mueve; sin segunda tirada
  const dir = rand(0, 3); // 0x036a
  let { col, row } = cell;
  if (dir === 0) row -= 1; // N (0x0382)
  else if (dir === 1) row += 1; // S (0x03d8)
  else if (dir === 2) col += 1; // E (0x03de)
  else col -= 1; // O (0x03e4)
  // Guarda 1: dentro del tablero de once (0x038e/0x0391) — falla ⇒ quieto, sin re-tirar.
  if (col < 0 || col > CAMP_ARENA_MAX || row < 0 || row > CAMP_ARENA_MAX) return cell;
  // Guarda 2: casilla libre (0x03a6/0x03a9) — falla ⇒ quieto, sin re-tirar.
  if (!isFree(col, row)) return cell;
  return { col, row }; // commit (en el binario es DOBLE: actor + ranura de sprite)
}

export function campSleepStep(
  ctx: CampCtx,
  h: number,
  hours: number,
  guardCell: CampGuardCell | null = null,
): { events: GameEvent[]; ambush: boolean; guardCell: CampGuardCell | null } {
  const events: GameEvent[] = [];
  let cell = guardCell;
  // LA HORA SON DOCE PASOS DE CINCO MINUTOS (0x0314 `push 5; call advance_clock`; el
  // cuerpo del reloj —`CS ULTIMA.EXE:0x4f7c`— hace `add byte [g_minute], al` y envuelve
  // con `cmp 0x3b / sub 0x3c`, o sea que el argumento son MINUTOS). El port daba UN paso
  // de 60': misma hora de reloj, pero 12× menos MUESTREO y cero paseos del vigía.
  // El barrido del anillo (0x400C, caller 0x0207) ya estaba modelado 12 veces por hora
  // —el comentario viejo lo decía— pero colgado de un bucle postizo; ahora cuelga del
  // paso real, que es de donde cuelga en el binario.
  // ✅ PARTIR LA HORA EN DOCE **NO** MULTIPLICA EL CONSUMO DE RNG DEL RELOJ (medido en el
  // cuerpo de `advance_clock`, `CS ULTIMA.EXE:0x4f7c`, a raíz de la ficha #101). Su ÚNICA
  // tirada vive en el re-sorteo de Shadowlords de MEDIANOCHE (0x4ff0 en adelante), anidada
  // DOS niveles: sólo se llega con `minuto > 59` (0x4fc8) **y** `hora > 23` (0x4fe6). Como
  // doce pasos de 5' cruzan el minuto 60 y la hora 24 exactamente las mismas veces que uno
  // de 60', el bloque corre el MISMO número de veces. ⇒ la cadencia fiel es inocua aquí.
  // ⚠ Y las TRES llamadas a `0x3f36` que sí van por invocación NO son RNG: leído su cuerpo
  // (0x3f36-0x3f50) es una RESTA SATURANTE (`if [bx] <= arg then 0 else [bx] -= arg`), o sea
  // el descuento de temporizadores — y 12×(−5) deja el mismo suelo que 1×(−60).
  for (let step = 0; step < CAMP_STEPS_PER_HOUR; step++) {
    advanceClock(ctx.state, CAMP_STEP_MINUTES, ctx.rand, ctx.sky);
    ringRegenSweep(ctx.state.characters, ctx.state.partySize, ctx.rand, (i) => {
      const ch = ctx.state.characters[i]!;
      ch.currentHp = Math.min(ch.currentHp + 1, ch.maxHp);
    });
    // Paseo del vigía: POR PASO (0x0337 cae desde 0x030c en TODAS las iteraciones, sin
    // el gate de cruce de hora que sí tiene la emboscada) ⇒ 12 oportunidades por hora,
    // ~3 movimientos. Sin vigía no se tira nada.
    if (cell) cell = campGuardWalk(cell, ctx.rand, ctx.campCellFree ?? (() => true));
  }
  // EMBOSCADA: UNA POR HORA, no por paso. El binario la gatea por CAMBIO DE HORA
  // (0x020d `cmp g_hour,[bp-0x1e]`; si no cambió salta a 0x030c y no tira). Partir la
  // hora en doce SIN este gate dispararía la emboscada 12× — la regresión de stream que
  // este mismo cambio podría haber introducido, y por la que existe su mutante.
  if (h < hours - 1 && ctx.rand(0, 63) === 0) {
    const type = AMBUSH_TABLE[ctx.rand(0, 7)]!; // 0x0239 → tabla DS 0x1734
    events.push(...startCampAmbush(ctx, type));
    return { events, ambush: true, guardCell: cell };
  }
  return { events, ambush: false, guardCell: cell };
}

/**
 * Despertar de la acampada — helper de curación 0x0400 (CMDS 0x0552), UNA vez por
 * acampada (no por hora). Sólo corre si NINGÚN roll de `campSleepStep` acertó (la
 * emboscada retorna temprano, epílogo 0x0306). Curación parcial + gate de la
 * APARICIÓN al 25 % (0x04f4→0x0502 call 0xbfd6 = OUTSUBS camp_results, `campHoleUp`);
 * el level-up real ocurre AQUÍ, no en el diálogo de LB, y SÓLO si el gate cruza.
 * El de guardia (`guardIdx`) no se cura (0x0461). Cierra con "Party rested!".
 */
export function campWake(ctx: CampCtx, guardIdx = -1): GameEvent[] {
  const events: GameEvent[] = [];
  const members = ctx.state.characters.slice(0, ctx.state.partySize);
  const res = campHoleUp(members, ctx.rand, guardIdx);
  if (res.apparition) {
    // La ESCENA de la aparición (OUTSUBS camp_results 0x0658, derivación completa en
    // re/notes/camp-apparition-scene.md): "An apparition!" (0x0660) → sweep de
    // materialización (0x067b) → arpegio de 6 notas (0x0683-0x06a2, tabla [0x3a26]) →
    // la figura 0x174 se materializa EN LA HOGUERA (0x06b9 `0x6dd8(5,5,0x174)` — wipe
    // de celda, reutiliza el slot de anim del fuego 0x5caa) → BUCLE POR MIEMBRO vivo
    // (0x07fb, orden de roster, muertos fuera 0x080f): cura+despertar (tile de pie,
    // 0x0868-0x0874) → campanilla (0x0896) → flash XOR blanco del viewport (0x08aa
    // `0x0b86(8,8,0xb7,0xb7)`) → acorde largo (0x08c1, POR miembro) → arenga si sube
    // de nivel → discurso de KARMA (0x090e) → "…vanishes…" (0x0964) + dissolve de la
    // figura al tile de hoguera (0x097e `0x6dd8(5,5,[g_unk_adb9])`). El core marca el
    // ORDEN; la piel pacea (pulsos ApparitionFlash) y pone timbre/flash.
    events.push({ kind: "message", text: "An apparition!\n" }); // DS 0x7750 (OUTSUBS 0x0660)
    events.push(sfxEvent("apparition-materialize")); // 0x067b (sweep TRAS el print, cf. 0x0660<0x067b)
    events.push(sfxEvent("apparition-arpeggio")); // 0x0683-0x06a2 ×6 (tabla DS 0x3a26)
    const ap = campApparition(ctx.state, ctx.rand);
    // Por miembro VIVO, en orden de roster: campanilla + acorde + (arenga de level-up).
    // El acorde 0x08c1 va DENTRO del bucle 0x07fb → suena POR MIEMBRO, no una vez.
    for (const step of ap.steps) {
      events.push(sfxEvent("apparition-heal-chime")); // 0x0896
      events.push(sfxEvent("apparition-chord")); // 0x08c1 (por miembro)
      if (step.message) events.push({ kind: "message", text: step.message });
    }
    // Discurso de KARMA (0x090e-0x0961): '\n"' (DS 0x77e0) + record de KARMA.DAT
    // seleccionado por karma/20 + '"' (putchar 0x22 @0x095a). Se emite en DOS
    // mensajes ('\n' + record-entrecomillado) para que el record reuse su key i18n.
    events.push({ kind: "message", text: "\n" }); // DS 0x77e0 (la comilla va en el record)
    events.push({ kind: "message", text: campKarmaMessage(ctx) });
    events.push({ kind: "message", text: "\n\nThe strangely familiar old man vanishes...\n" }); // DS 0x77f8 (0x0964)
  }
  events.push({ kind: "message", text: "Party rested!\n" }); // DS 0x41ec
  events.push({ kind: "party-changed" });
  return events;
}

/**
 * Rechazo de contexto de (H)ole up & camp — kernel 0x3cd8→0x3ee5. El binario
 * imprime el mensaje y **jmp 0x3ee5** que fija `g_unk_24e6=1` ⇒ el rechazo **SÍ
 * consume el turno estándar** (a diferencia de la cancelación del prompt de horas,
 * que sale por 0x3eea sin turno). Cobra el coste de contexto vía runContextTurn.
 */
export function campReject(ctx: CampCtx, message: string): GameEvent[] {
  const events: GameEvent[] = [{ kind: "message", text: message }];
  events.push(...ctx.runContextTurn({ consumed: true }));
  return events;
}

/**
 * Reparación de casco al acampar a bordo de la fragata — kernel 0x3C9A rama
 * 0x3cf8-0x3d50. advance_clock(5)×5 = 25 min y `hull += rand(1,3)` (cap 99,
 * repite mientras hull<10). repairHull ya porta la fórmula (3.7). Imprime
 * "Hull now <n>!" (0xa2f8+0xa302).
 */
export function campRepairShip(ctx: CampCtx): GameEvent[] {
  const events: GameEvent[] = [];
  const before = ctx.state.shipHull ?? HULL_MAX;
  const r = repairHull(before, ctx.rand);
  ctx.state.shipHull = r.hull;
  advanceClock(ctx.state, r.minutes, ctx.rand, ctx.sky);
  // i18n: plantilla catalogada («Hull now {}!\n\n»); con `${}` nativo salía en inglés
  // bajo 'es' (#126). El `\n\n` es PÁRRAFO (rewrap lo conserva), va verbatim en la key.
  events.push({ kind: "message", text: tf("Hull now {}!\n\n", r.hull) }); // 0xa2f8+valor+0xa302
  events.push({ kind: "party-changed" });
  return events;
}

/**
 * Discurso de la APARICIÓN de acampada (OUTSUBS 0x090e-0x0950): `index = g_karma/20`
 * (0x0915-0x091c `div 0x14`); si index<4 (0x0923) → record de la tabla DS 0x1a74
 * (= recs 0-3, los mismos del refuge); si index≥4 (karma 80-99) → record 5 (offset
 * fijo 0x29f, 0x0940-0x094f). A diferencia del refuge (que con 80-99 recita el rec4
 * "Return once more to the world…"), el camp recita el rec5 "Thy destiny awaits thee!".
 */
function campKarmaMessage(ctx: CampCtx): string {
  // `?? 0` defensivo: fixtures de test con estado parcial (karma real siempre existe).
  const idx = Math.floor(Math.max(0, ctx.state.karma ?? 0) / 20);
  if (idx < 4) return ctx.refugeKarmaMessages[idx]!; // 0x0928: tabla 0x1a74 recs 0-3
  return CAMP_KARMA_MESSAGES[0]!; // 0x0940: offset fijo 0x29f = rec5
}

/**
 * Emboscada del bucle de sueño (CMDS.OVL 0x022b-0x02fc): al acertar el roll de
 * emboscada, monta combate REAL contra un enemigo de `AMBUSH_TABLE`. El camp de
 * overworld a pie tiene `flags = 0x0004` (⇒ `flag&2 = 0`), la vía `0x6BC2`
 * (render_animated_tile → `kernel_spawn_actor` 0x6506: COLOCA un actor del tipo en
 * el array `0xba14`), NO la `0x7C3E` de terreno. Tras el spawn `camp()` retorna
 * ax=1 y la entrada de combate REAL es la cadena kernel-residente 0xb714/0xb8a4/
 * 0xdf80 (FUERA de los overlays volcados) — el MISMO hueco que el peaje de trolls.
 * El port lo modela con el patrón troll ya aceptado (deliberate-divergences §3):
 * `OverworldEnemy` SINTÉTICO en party_x/y → `startCombat` (fork del stream vivo).
 * La arena es `CampFire` (arena dedicada de camp, inalcanzable por terreno — ver
 * startCombat). "Ambushed!" (DS 0x41e0, 0x0247) es la intro propia de la emboscada
 * (reemplaza el "{name} attacks!"; que 0xdf80 lo añada además es un residual de
 * runtime, un solo witness DOSBox lo dirá). Estados de entrada: el estándar del port
 * (los miembros dormidos NO despiertan selectivamente — el histograma 'G'/'P'/'S'
 * del asm 0x0254-0x02bc queda Clase C). Refs: re/notes/camp-ambush-resolution.md,
 * camp-ambush-spec.md §2/§3.
 */
function startCampAmbush(ctx: CampCtx, defIndex: number): GameEvent[] {
  const pos = ctx.state.position;
  const def = ctx.enemyDefs?.[defIndex];
  const enemy: OverworldEnemy = {
    slot: 0, // combat-only (camp ambush): nunca en la tabla de vagabundeo
    defIndex,
    tile: def?.tile ?? 0, // sprite del def; el enemigo nunca se dibuja en el mapa
    water: false,
    x: pos.x,
    y: pos.y,
  };
  const events: GameEvent[] = [{ kind: "message", text: "Ambushed!\n\n" }]; // DS 0x41e0 (fileoff 0x41f0), CMDS 0x0247
  events.push(
    ...ctx.startCombat(enemy, "south", {
      combatMapIndex: CombatMapIndex.CampFire, // arena dedicada de camp (inalcanzable por combatMapForTile); la fuerza la entrada kernel 0xdf80 [= CS 0x6150 → ULTIMA.EXE:0x6150]
      intro: "none", // "Ambushed!\n\n" (0x0247) es la pre-línea; startCombat no añade nada (0xdf80 NO imprime "attacks!" — lote D)
      removeFromMap: false, // sintético: no vive en overworldEnemies
    }),
  );
  return events;
}
