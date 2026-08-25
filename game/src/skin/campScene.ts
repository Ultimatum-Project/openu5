/**
 * DERIVACIÓN PURA de la ESCENA de acampada (H)ole up & camp — el montaje que el
 * original pinta al dormir a la intemperie en el overworld a pie: entra en la arena
 * CampFire y coloca al party alrededor de la hoguera (kernel `party_anim_build` 0x6936).
 * Presentación PURA (regla #71: pintar no muta el core): sin DOM, sin RNG, sin estado.
 * `coreview.ts` la alimenta con el estado leído (incl. la formación leída de la arena);
 * la piel fiel la pinta.
 *
 * Autoridad byte-fiel: `re/notes/camp-scene-kernel.md` (cita = `re/disasm/ULTIMA.EXE.asm`
 * + offset; los .segments.md sólo orientan). Rutinas clave:
 *  - camp cmd 0x3c9a: el vigía sólo se valida por ESTADO 'G' (0x3ec6 `cmp [bx+0x55b3],'G'`),
 *    NO por clase. ⚠️ De ahí NO se sigue «no hay easter egg del bardo en el binario»: el
 *    check de clase vive en la rutina de SUEÑO que 0x3c9a llama, `CMDS.OVL 0x0113`
 *    (`cmp byte [bx],0x42` = 'B'), con su sprite, su melodía y su reloj congelado —
 *    DERIVADO en `re/notes/camp-bard-anim.md`. Ver `CAMP_BARD_SEED` abajo.
 *  - 0x6936/0x6a52: leen la formación por índice de miembro de `[bx+0x1724]` (X) y
 *    `[bx+0x172c]` (Y). Esa tabla NO es estática: 0x60ec la COPIA en runtime desde
 *    0xad7f/0xad85, que 0x256e acaba de CARGAR del registro de la arena (0x160 bytes).
 *    Es decir, la formación = los `playerStarts` de la arena CampFire — no una tabla
 *    horneada. (La lectura estática vieja DATA.OVL fo 0x1734 = [7,8,8,9,9,9] era el
 *    DEFAULT del buffer destino, SOBREESCRITO en runtime; refutada por el vídeo.)
 *  - 0x68ae (finalize durmiente): `mov byte ptr [bx+0x5c5b], 0x1e` → tile 0x11e del banco
 *    alto = DeadBody (durmiente tumbado); único tile, no por clase.
 *
 * Clase C (no aquí): la cadencia real-time del vigía y de la hoguera, y la figura de la
 * aparición (25%). También la TASA por frame de la animación del bardo: el asm fija la
 * estructura (52 redibujos, 1 frame y 1 nota cada uno, `camp-bard-anim.md §3/§7`) pero no
 * los ms — el port lo cicla al reloj de su animador por-actor.
 */
import type { CampSceneView } from "./api.js";
import { SPRITE_BANK } from "../render/tileanim.js";

/**
 * Celda de la hoguera — spawn `kernel_spawn_actor 0x6506(kind=2, x=5, y=5)` (0x6b7e).
 * Confirmada por combatMaps idx 0 "CampFire" (tile 179=0xb3 en [5][5]) y por el vídeo.
 */
/**
 * Celda de la HOGUERA. DUPLICADA a propósito con `CAMP_FIRE_CELL` de `core/world/camp.ts`:
 * la piel la necesita para PINTARLA y el núcleo para la guarda de casilla libre del paseo
 * del vigía, y la guarda de arquitectura (`skin-import-guard`) prohíbe que una piel alcance
 * el core en RUNTIME (sólo por tipos). Las dos copias las ata un test —`camp-fire-cell-
 * coherencia`— que falla si divergen; sin él la duplicación sí sería deuda.
 */
export const CAMP_FIRE_CELL = { col: 5, row: 5 } as const;
/**
 * Tile de la hoguera — TileData "CampFire" (índice 179 = 0xb3). CONFIRMADO por el
 * vídeo del usuario (CAMP.mov): brasero rojo con llamas amarillas en el centro de la
 * formación. El sprite exacto por planta (`al = floor*3+7`, 0x6bad) es Clase C.
 */
const CAMP_FIRE_TILE = 179;
/**
 * Tile del DURMIENTE en el suelo — TileData "DeadBody" (**0x11e = 286**): figura verde
 * TUMBADA EN DIAGONAL sobre el suelo. CORREGIDO por el testigo lado-a-lado del usuario:
 * el 0x11a "SleepingInBed" (persona en cama AZUL) se leía como una cama en mitad del
 * campo (absurdo) — NO es eso. El durmiente de camp es el sprite de cuerpo tumbado
 * 0x11e (el pose 'S' finalize 0x68ae), medido pixel a pixel contra el atlas. Sólo el de
 * guardia queda DE PIE con el sprite de su clase.
 */
export const CAMP_SLEEPER_TILE = 0x11e;
/**
 * Byte de sprite del guardia BARDO tocando — **`0x5F` LITERAL DEL ASM**, ya no inferido.
 *
 * ★ ESLABÓN CERRADO (2026-08-05). `camp-scene-kernel.md §6/§7` dejaba como «residuo
 * no-bloqueante» el código que asigna el sprite del laúd a un actor de clase 'B'
 * (y el §5 concluía «no hay bardo en este kernel» mirando SÓLO el comando `0x3c9a`).
 * Está en la rutina de SUEÑO que 0x3c9a llama — **CMDS.OVL 0x0000**, prólogo:
 * ```
 *  0113  mov bx,[bp-0x34]           ; = 0x55b2 + i*0x20  → LETRA DE CLASE del miembro i
 *  0116  cmp byte ptr [bx], 0x42    ; ★ 'B' = BARD
 *  011b  cmp [bp-0x20], [bp+6]      ; ★ y ese i ES el vigía (arg guardIdx)
 *  0123  cmp byte ptr [g_unk_a9ce],0; ★ y el SONIDO está ON (flag ^S, sfx-catalog §1)
 *  012a  mov [bp-4], <slot>         ;   → slot del actor del bardo
 *  ...
 *  017c  mov al, 0x5f               ; ★★ EL BYTE
 *  017e  mov byte ptr [di+1], al    ;   [objrec+1] = 0x5F  (frame MOSTRADO)
 *  0181  mov byte ptr [bx],   al    ;   [objrec+0] = 0x5F  (base/semilla del programa)
 *  0183  mov byte ptr [0x6a08], 1   ; ★ cursor de la MELODÍA a 1
 *  0188  push 0x34 / call 0x7b66    ; ★ kernel 0x3AE6(52) = 52×{redraw 0x5910 + 1 tick}
 *  0191  ...restaura ambos bytes...
 * ```
 * ⇒ el port ya NO depende del nombre "BardPlaying1" de TileData ni del vídeo para el id.
 *
 * El TILE se obtiene `SPRITE_BANK + byte` (compositor `0x56e1 add ah,1`) ⇒ **0x15F**, NO 0x15C:
 * 0x5C es sólo la BASE del grupo (`[reg+0]&0xfc`, que es lo que castea el gate del motor
 * de sonido `0x4207`), pero el byte ESCRITO —y por tanto el frame sembrado y el de la
 * rama «apagada» del programa— es 0x5F. Ver `re/notes/camp-bard-anim.md`.
 */
export const CAMP_BARD_SEED = 0x5f;
/**
 * Tile del guardia BARDO tocando = `SPRITE_BANK | CAMP_BARD_SEED` = **0x15f** (TileData
 * "BardPlaying4"). El grupo 0x15c-0x15f SÍ se anima: base 0x5c, programa `02 03 04 05`
 * (progid 0, oráculo vivo §4quater) y **sin gate del 50 %** (`0x4611 cmp 0x5c; je`) ⇒
 * un frame por redibujo. Ver `campBardActor` y `re/notes/camp-bard-anim.md`.
 */
export const CAMP_BARD_PLAYING_TILE = SPRITE_BANK | CAMP_BARD_SEED;

/**
 * Tile DE PIE al DESPERTAR en la escena de la aparición — OUTSUBS camp_results
 * 0x0850-0x0874: `strchr_index("AMBFDTPRS" DS 0x7760, clase)` (call 0x4d76) indexa la
 * tabla de bytes DS 0x1ade (DATA.OVL fo 0x1aee) = `4c 40 44 48 4c 4c 4c 4c 4c`, que se
 * escribe en los DOS frames del slot de anim del actor (banco alto, como el durmiente
 * 0x1e→0x11e). ⇒ A→0x14c (Avatar1), M→0x140 (Wizard1), B→0x144 (Bard1), F→0x148
 * (Fighter1), y D/T/P/R/S→0x14c (¡Avatar!, no su sprite de escena — quirk fiel; en
 * saves reales sólo hay A/B/F/M, donde coincide con `combatPartyTile`).
 */
const APPARITION_WAKE_TILE: Readonly<Record<string, number>> = {
  A: 0x14c, M: 0x140, B: 0x144, F: 0x148,
};
const APPARITION_WAKE_TILE_DEFAULT = 0x14c; // resto de letras de "AMBFDTPRS" → 0x4c

/** Tile de despertar de la aparición para una letra de clase (tabla DS 0x1ade). */
function apparitionWakeTile(charClass: string): number {
  return APPARITION_WAKE_TILE[charClass] ?? APPARITION_WAKE_TILE_DEFAULT;
}
/** Estado mínimo de un miembro para la escena (leído del roster por coreview). */
export interface CampSceneMemberInput {
  /** Letra de estado del roster ('G'/'P'/'S'/'D'…). 'D' (muerto) ⇒ no se coloca. */
  status: string;
  /** Tile de combate de su clase (`combatPartyTile`, ya resuelto por coreview). */
  tile: number;
  /** Letra de clase ('A'/'B'/'F'/'M'…) — para el easter egg del bardo (clase 'B'). */
  charClass: string;
}

/** Entrada de `buildCampScene`: contexto de gate + roster + guardia. */
export interface CampSceneInput {
  /** ¿Se está acampando ahora? (lo fija main.ts vía `setCampScene`). */
  active: boolean;
  /**
   * ¿Es un camp de OVERWORLD a pie? (modo mundo + location 0, no combate/mazmorra/
   * pueblo). Sólo entonces el original monta la escena de party (flag&2=0 → 0x6936);
   * el camp de mazmorra usa la vía de arena de terreno (0x7C3E), no modelada aquí.
   */
  overworldFoot: boolean;
  /** Miembros del party en ORDEN de roster (índices 0..partySize-1). */
  members: readonly CampSceneMemberInput[];
  /**
   * Formación por índice de miembro, en coords de arena {col,row} — leída por coreview de
   * los `playerStarts["south"]` de la arena CampFire (lo que el kernel carga en runtime;
   * ver cabecera). `formation[idx]` = celda del miembro idx. Vacía ⇒ no se coloca a nadie.
   */
  formation: readonly { col: number; row: number }[];
  /** `g_party_size` — acota la formación a 0..6 miembros. */
  partySize: number;
  /** Índice de roster del miembro de guardia, o -1 (nadie vela). */
  guardIdx: number;
  /** Hora de sueño transcurrida (0,1,2…) — mueve al guardia por su ronda (1 paso/hora). */
  /**
   * Celda de arena del VIGIA esta hora, o `null` si no hay vigia. La calcula el NUCLEO
   * (`campSleepStep` → `campGuardWalk`, paseo aleatorio con dos tiradas) una vez por hora;
   * aqui SOLO SE LEE. Antes se derivaba de `hour` con `campGuardPatrolCell`, que alternaba
   * dos celdas fijas por paridad SIN tirar dados — el defecto que reporto el usuario.
   */
  guardCell: { col: number; row: number } | null;
  /**
   * FASE 1 del easter egg de Iolo: el vigía-BARDO TOCA el laúd (tile tocando, quieto en su
   * puesto) mientras el reloj está congelado. La fija main.ts sólo durante la canción; al
   * acabar pasa a false y el bardo vela como cualquier guardia (sprite normal, patrulla).
   * Sin efecto si el vigía no es bardo. Witness-derived (CAMP_IOLO_MUSICA.mov); ver brief.
   */
  songPhase: boolean;
}

/**
 * Construye la escena de acampada, o `null` si no aplica (no se acampa, o no es un
 * camp de overworld a pie). PURA: no muta la entrada ni referencia estado externo;
 * dos llamadas con la misma entrada devuelven objetos nuevos y equivalentes.
 *
 * Formación (kernel 0x6936 §2b): recorre el roster idx=0..partySize-1; los MUERTOS
 * (status 'D', 0x69e1) se SALTAN dejando su hueco vacío; el resto se coloca en
 * `input.formation[idx]` (= playerStarts["south"] de la arena) con el tile que toque.
 * La hoguera va en (5,5). Si no hay celda de formación para un idx (formación más corta),
 * ese miembro se omite (defensivo; no debería pasar con party ≤ 6).
 */
export function buildCampScene(input: CampSceneInput): CampSceneView | null {
  if (!input.active || !input.overworldFoot) return null;
  const n = Math.min(input.partySize, input.formation.length);
  const members = [];
  for (let idx = 0; idx < n; idx++) {
    const m = input.members[idx];
    if (!m || m.status === "D") continue; // muerto: no se explota a la escena (0x69e1 skip)
    const slot = input.formation[idx];
    if (!slot) continue; // sin celda de arena para este idx (defensivo)
    const guard = idx === input.guardIdx;
    if (guard) {
      // GUARDIA. Easter egg de Iolo (DOS FASES, witness-derived de CAMP_IOLO_MUSICA.mov;
      // NO en este kernel — camp cmd 0x3c9a sólo valida al vigía por estado 'G' en 0x3ec6,
      // sin clase/música/reloj; grep negativo de push 0x15c y de driver de música citado en
      // camp-asm.md):
      //  · FASE 1 (canción, songPhase=true): si el vigía es BARDO (clase 'B') TOCA el laúd
      //    (tile 0x15c, auto-anima) QUIETO en su puesto, con el reloj congelado (lo para
      //    main.ts). El sol de la tira de cielo no avanza — medido 8-13 s en el testigo.
      //  · FASE 2 (vigilia): el bardo (o cualquier vigía) PASEA junto a su puesto con su
      //    sprite normal (campGuardPatrolCell), reloj corriendo.
      const playing = m.charClass === "B" && input.songPhase;
      const cell = playing ? slot : (input.guardCell ?? slot);
      members.push({
        charIdx: idx,
        col: cell.col,
        row: cell.row,
        tile: playing ? CAMP_BARD_PLAYING_TILE : m.tile,
        guard: true,
        bard: playing,
        awakeTile: apparitionWakeTile(m.charClass),
      });
    } else {
      // Durmiente: TUMBADO en el suelo (0x11e, de 0x68ae) en su celda de formación.
      members.push({
        charIdx: idx,
        col: slot.col,
        row: slot.row,
        tile: CAMP_SLEEPER_TILE,
        guard: false,
        bard: false,
        awakeTile: apparitionWakeTile(m.charClass),
      });
    }
  }
  return {
    members,
    fire: { col: CAMP_FIRE_CELL.col, row: CAMP_FIRE_CELL.row, tile: CAMP_FIRE_TILE },
  };
}

/** Id estable del actor sintético del bardo para el animador por-actor de la piel. */
export const CAMP_BARD_ACTOR_ID = "camp-bard";

/**
 * Prefijo de id de los ACTORES de la escena de camp (#366, 4ª instancia de la clase
 * #351): `bakeCampArena` empuja cada miembro (durmientes + vigía) como `ActorView`
 * con id `camp:<charIdx>` (estable entre horas/fases: el vigía patrulla y el shader
 * puede deslizar su paso) para que la piel shader los componga con transparencia por
 * su vía terreno+actores. El bardo tocando usa `CAMP_BARD_ACTOR_ID` (su runner propio).
 */
export const CAMP_ACTOR_ID_PREFIX = "camp:";

/** Id de actor del miembro `charIdx` de la escena de camp. */
export function campActorId(charIdx: number): string {
  return CAMP_ACTOR_ID_PREFIX + String(charIdx);
}

/**
 * ¿Es `id` un actor de la ESCENA DE CAMP (miembro o bardo)? Lo consultan:
 *  · la piel FIEL (`buildActorFrames`), para NO pasarlos por el intérprete por-actor
 *    de mundo — la fiel ya los hornea en `window` y los anima por grupos (`perTurn`);
 *    meterlos en `actorProg` movería sus frames (bases de clase 0x40-0x4c habilitadas)
 *    y la 1988 dejaría de ser byte-idéntica;
 *  · la piel SHADER (transparencia modo `avatar` = «sólo la party»): los miembros de
 *    la escena SON la party, así que cuentan como `party` para ese modo.
 */
export function isCampActorId(id: string): boolean {
  return id === CAMP_BARD_ACTOR_ID || id.startsWith(CAMP_ACTOR_ID_PREFIX);
}

/**
 * ACTOR SINTÉTICO del bardo tocando, para que la piel lo pase por el intérprete
 * `0x4552` por-actor (`ActorProgRunner`) — o `null` si no hay bardo tocando.
 *
 * POR QUÉ HACE FALTA (defecto que arregla): la escena de camp se HORNEA en la ventana
 * de terreno (`coreview.bakeCampArena`) y NO puebla `snapshot.actors` (eso sólo lo hace
 * `bakeMapWindow`, que la escena sustituye) ⇒ el bardo no llegaba al animador por-actor
 * y caía al reloj de grupos, que para el banco alto (≥`SPRITE_BANK`) es **`perTurn`**
 * (`tileanim.ts:117`) — y durante la canción el reloj de juego está CONGELADO ⇒ 0 turnos
 * ⇒ sprite ESTÁTICO. Eso es exactamente lo reportado. En el original el bucle
 * `0x3AE6(52)` llama a `0x5910` 52 veces y CADA una corre `0x4552` (0x5941) sobre la
 * tabla `0x5c5a`, donde el bardo SÍ está: el reloj de mundo parado no congela el
 * animador de sprites, que va por REDIBUJO.
 *
 * `seed` = el byte crudo 0x5F (`CAMP_BARD_SEED`), no la base 0x5C: el original siembra
 * `[reg+0] = [reg+1] = 0x5F` y su rama «apagada» del op5 relee `[reg+0]`
 * (`0x467c`), así que el ciclo visible es **0x15D·0x15E·0x15F y nunca 0x15C**.
 *
 * PURA: no toca estado; el PC/timer del programa viven en el runner de la piel.
 */
export function campBardActor(
  scene: CampSceneView | null,
): { id: string; tile: number; seed: number; col: number; row: number } | null {
  if (!scene) return null;
  const m = scene.members.find((x) => x.bard);
  if (!m) return null;
  return {
    id: CAMP_BARD_ACTOR_ID,
    tile: CAMP_BARD_PLAYING_TILE,
    seed: CAMP_BARD_SEED,
    col: m.col,
    row: m.row,
  };
}
