/**
 * ENDGAME-SCENE — el driver PROCEDURAL de la cinemática final de Ultima V (task #20,
 * Lote 2). Reproduce EN NUESTRO MOTOR la escena que `ENDGAME.OVL` anima al ganar.
 *
 * A diferencia del demo del attract (`demo-scene.ts`, un intérprete de 16 opcodes sobre
 * un bytecode de MISCMAPS.DAT), el endgame es CÓDIGO PROCEDURAL: `endgame_main`
 * (ENDGAME.OVL 0x0648) coreografía sprites con dos primitivas —`move_sprite_toward`
 * (0x0510) y `wander_sprite` (0x05a2)— sobre la MISMA tabla de actores 0x5c5a (32 slots,
 * stride 8) y el mismo present por frame (`0xffff9856`, 15×). Derivación en
 * `.superpowers/sdd/brief-endgame.md` + este módulo cita los offsets del disasm.
 *
 * FLUJO (endgame_main, byte-derivado):
 *   1. Lord British entra: sprite en (col5,row8) → camina a (5,3) [0x06f9, target 5/3].
 *   2. Saludo al party: cada miembro camina a su sitio (tablas de destino DATA.OVL
 *      0x3e5a=col / 0x3e60=row) mientras LB lo saluda [bucle 0x073b-0x0829].
 *   3. Pregunta de la caja (Y/N) [0x0833-0x08b9] — texto ENDMSG.DAT (records 0..2).
 *   4. FORK `g_wooden_box` [0x08c2]:
 *      · Rama BUENA (respondió 'Y' ∧ tiene la caja): LB abre la caja, narración del Orb
 *        (ENDMSG records 3..9), tono, se PLANTA el moongate (tile 0xdc) que SUBE 16 pasos
 *        (contador 0x5887 1..0x10, el mismo de `fiel/moongate.ts`), el party CAMINA al
 *        gate (5,4) y desaparece, el gate BAJA 16 pasos, se restaura el suelo, y se llama
 *        al epílogo de texto (endgame_throne_scene 0x0000 → 6 páginas de END.DAT) + el
 *        pergamino/datestamp (0x0326, ya portado en `core/quest/endgame.ts`).
 *      · Rama ALTERNATIVA (sin caja / respondió 'N'): "pull up a chair… we shall be here
 *        a while" (ENDMSG record 10), LB se sienta y el party DEAMBULA para siempre
 *        (bucle infinito 0x0ac9 de `wander_sprite`) — el gag del final incompleto.
 *
 * Este módulo es PURO y DETERMINISTA (semilla fija para el wander, decisión del lead
 * coherente con #37/demo): decide la SECUENCIA de frames (posiciones de sprites, etapa
 * del moongate, SFX y CUES de texto). El blit real y el wiring de los strings aprobados
 * de ENDMSG/END.DAT son de lotes posteriores (render = Lote 4; strings+fork formal =
 * Lote 3). Los CUES referencian por índice los registros extraídos en Lote 1
 * (`endgame.json`), sin fijar aquí el texto.
 */

import { MOONGATE_TILE } from "./demo-scene.js";

/** Tile del moongate que se planta en el gate (ENDGAME 0x0992 al=0xdc). Re-exporta el del demo. */
export { MOONGATE_TILE };

/**
 * RNG determinista LOCAL del wander (LCG, mismos coeficientes que `core/combat/rng.ts`).
 * Se inlina aquí para respetar la separación core↔piel (una piel no importa internals del
 * core en runtime; `skin-import-guard`). Sólo se necesita `int(n)` = entero en [0, n).
 */
export class EndgameRng {
  private s: number;
  constructor(seed: number) {
    this.s = (seed >>> 0) || 1;
  }
  /** Entero en [0, n) (0 si n<=0). */
  int(n: number): number {
    if (n <= 0) return 0;
    this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0;
    return Math.floor((this.s / 0x100000000) * n);
  }
}

/** Suelo caminable — `wander_sprite` sólo pisa 0x44 (ENDGAME 0x0607 cmp 0x44). */
export const FLOOR_TILE = 0x44;
/** Pasos de apertura/cierre del moongate (contador 0x5887 1..0x10). */
export const MOONGATE_STEPS = 16;

/** Posición de arranque de Lord British (anim states +250=col, +251=row: 5/8). */
export const LB_START = { col: 5, row: 8 } as const;
/** Destino de Lord British junto al trono (ENDGAME 0x06f9 target col5/row3). */
export const LB_THRONE = { col: 5, row: 3 } as const;
/** Celda del moongate / punto de salida del party (ENDGAME 0x09f5 target col5/row4). */
export const GATE_CELL = { col: 5, row: 4 } as const;

/**
 * Destinos de formación del party en el saludo (DATA.OVL 0x3e5a col / 0x3e60 row,
 * indexados por miembro). 6 entradas (tamaño máx. de party de U5).
 */
export const PARTY_LINEUP: ReadonlyArray<{ col: number; row: number }> = [
  { col: 5, row: 5 },
  { col: 4, row: 6 },
  { col: 6, row: 6 },
  { col: 3, row: 7 },
  { col: 5, row: 7 },
  { col: 7, row: 7 },
];

/** Un actor de la cinemática (tabla 0x5c5a; stride 8: tile en +0/+1, col +2, fila +3). */
export interface EndgameActor {
  tile: number;
  col: number;
  row: number;
  active: boolean;
}

/**
 * Un CUE de texto emitido en un frame. Los índices apuntan a `endgame.json` (Lote 1):
 * `dialogue` = ENDMSG.DAT records, `narration` = END.DAT pages, `prompt` = la pregunta
 * Y/N de la caja, `scroll` = el pergamino/datestamp (core/quest/endgame.ts). El texto y
 * el fork formal se cablean en Lote 3.
 */
export type EndgameCue =
  | { kind: "dialogue"; index: number }
  | { kind: "prompt" }
  | { kind: "narration"; page: number }
  | { kind: "scroll" };

/** Un frame renderizado de la cinemática. */
export interface EndgameFrame {
  /** Actores activos (sprite = `tile | 0x100`, igual que el demo; lo aplica el render). */
  actors: ReadonlyArray<{ tile: number; col: number; row: number }>;
  /** Etapa del moongate en `GATE_CELL` (1..16 subiendo/bajando) o `null` si no hay gate. */
  moongate: number | null;
  /** SFX disparado en este frame. */
  sfx: EndgameSfx | null;
  /** Cue de texto emitido en este frame (o `null`). */
  cue: EndgameCue | null;
}

export type EndgameSfx = "tone" | "chime";

/** Opciones del driver (estado de juego + fork). */
export interface EndgameOptions {
  /** Sprite (índice de tile del atlas) de Lord British. */
  lordBritishTile: number;
  /** Sprites de los miembros del party, en orden (define `partySize`). */
  partyTiles: readonly number[];
  /** ¿La party lleva la Sandalwood Box? (`g_wooden_box`). */
  hasBox: boolean;
  /** ¿Se respondió 'Y' a la pregunta de la caja? */
  answeredYes: boolean;
  /** Mapa 11×11 de la sala (MISCMAPS.DAT[528:704]); gate para el wander. */
  map: ReadonlyArray<ReadonlyArray<number>>;
  /** Semilla del wander (fija por defecto — determinismo del port). */
  seed?: number;
  /** Tope de frames del bucle de wander de la rama alternativa (el original es infinito). */
  alternateFrames?: number;
}

/**
 * `move_sprite_toward` (ENDGAME 0x0510): avanza el actor UN tile hacia (targetCol,
 * targetRow), eligiendo el eje con MAYOR distancia restante. Devuelve `true` si se movió,
 * `false` si ya estaba en el destino o está inactivo. Byte-exacto: `dcol=|col-tc|`,
 * `drow=|row-tr|`; si `dcol >= drow` mueve en columna, si no en fila.
 */
export function moveSpriteToward(a: EndgameActor, targetCol: number, targetRow: number): boolean {
  if (!a.active) return false;
  if (a.col === targetCol && a.row === targetRow) return false;
  const dcol = Math.abs(a.col - targetCol);
  const drow = Math.abs(a.row - targetRow);
  if (dcol >= drow) {
    a.col += a.col <= targetCol ? 1 : -1;
  } else {
    a.row += a.row <= targetRow ? 1 : -1;
  }
  return true;
}

/**
 * `wander_sprite` (ENDGAME 0x05a2): con una probabilidad (gate RNG), intenta hasta 8
 * veces mover el actor 1 tile en dirección aleatoria a una celda de suelo (0x44). Si no
 * encuentra suelo en 8 intentos, no se mueve. Determinista bajo `rng`.
 */
export function wanderSprite(
  a: EndgameActor,
  map: ReadonlyArray<ReadonlyArray<number>>,
  rng: EndgameRng,
): void {
  if (!a.active) return;
  // Gate: rand(0..1); si 0, no deambula este frame (ENDGAME 0x05c0 call rand(1)).
  if (rng.int(2) === 0) return;
  for (let attempt = 0; attempt < 8; attempt++) {
    const dir = rng.int(4); // 0=E,1=W,2=S,3=N (ENDGAME 0x0600/0x61e/0x622/0x626)
    let col = a.col;
    let row = a.row;
    if (dir === 0) col += 1;
    else if (dir === 1) col -= 1;
    else if (dir === 2) row += 1;
    else row -= 1;
    if ((map[row]?.[col] ?? -1) === FLOOR_TILE) {
      a.col = col;
      a.row = row;
      return;
    }
  }
}

/** Semilla por defecto del wander (fija — determinismo del port, GL#2 del lead). */
export const DEFAULT_SEED = 0x5c5a;
/** Tope por defecto del bucle de wander alternativo (el original no termina). */
const DEFAULT_ALTERNATE_FRAMES = 64;

/**
 * Construye la lista DETERMINISTA de frames de la cinemática del endgame. Reproduce la
 * coreografía de `endgame_main` (ver cabecera): entrada de LB, saludo al party, y el
 * FORK de la caja. El llamador reproduce los frames en orden; los CUES le dicen cuándo
 * mostrar cada texto/pergamino (strings en Lote 3, blit en Lote 4).
 */
export function buildEndgameCutscene(opts: EndgameOptions): EndgameFrame[] {
  const {
    lordBritishTile,
    partyTiles,
    hasBox,
    answeredYes,
    map,
    seed = DEFAULT_SEED,
    alternateFrames = DEFAULT_ALTERNATE_FRAMES,
  } = opts;

  const frames: EndgameFrame[] = [];
  const rng = new EndgameRng(seed);

  // Tabla de actores: slot 0 = Lord British; slots 1..N = party.
  const lb: EndgameActor = { tile: lordBritishTile, col: LB_START.col, row: LB_START.row, active: true };
  const party: EndgameActor[] = partyTiles.map((tile, i) => ({
    tile,
    col: PARTY_LINEUP[i]?.col ?? GATE_CELL.col,
    row: (PARTY_LINEUP[i]?.row ?? GATE_CELL.row) + 2, // entran desde abajo del sitio
    active: true,
  }));

  const activeActors = (): EndgameActor[] => [lb, ...party].filter((a) => a.active);
  const snapshot = (moongate: number | null, sfx: EndgameSfx | null, cue: EndgameCue | null): void => {
    frames.push({
      actors: activeActors().map((a) => ({ tile: a.tile, col: a.col, row: a.row })),
      moongate,
      sfx,
      cue,
    });
  };

  // --- Fase A: Lord British entra y camina al trono (0x06f9) ---
  snapshot(null, null, null);
  while (moveSpriteToward(lb, LB_THRONE.col, LB_THRONE.row)) snapshot(null, null, null);

  // --- Fase A': saludo al party; cada miembro camina a su sitio (0x073b-0x0829) ---
  party.forEach((m, i) => {
    // El saludo de LB al miembro (texto real en Lote 3; aquí un cue de diálogo por miembro).
    snapshot(null, null, { kind: "dialogue", index: 0 });
    const dest = PARTY_LINEUP[i] ?? GATE_CELL;
    while (moveSpriteToward(m, dest.col, dest.row)) snapshot(null, null, null);
  });

  // --- Fase B: pregunta de la caja (0x0833) ---
  snapshot(null, null, { kind: "prompt" });

  // --- Fase C: FORK g_wooden_box (0x08c2) ---
  const goodEnding = answeredYes && hasBox;
  if (!goodEnding) {
    buildAlternateEnding(frames, snapshot, lb, party, map, rng, alternateFrames);
    return frames;
  }

  // Rama BUENA: narración de la caja + el Orb (ENDMSG records 3..9) (0x0917-0x0965).
  for (let index = 3; index <= 9; index++) snapshot(null, null, { kind: "dialogue", index });

  // Tono + el moongate SUBE 16 pasos en el gate (0x0973-0x09ac).
  snapshot(null, "tone", null);
  for (let stage = 1; stage <= MOONGATE_STEPS; stage++) {
    const sfx: EndgameSfx | null = stage === 1 ? "chime" : null;
    snapshot(stage, sfx, null);
  }

  // El party camina al gate (5,4) y desaparece uno a uno (0x09d7-0x0a24).
  for (const m of party) {
    while (moveSpriteToward(m, GATE_CELL.col, GATE_CELL.row)) snapshot(MOONGATE_STEPS, null, null);
    m.active = false; // entra en el gate
    snapshot(MOONGATE_STEPS, "chime", null);
  }

  // El moongate BAJA 16 pasos y se restaura el suelo (0x0a27-0x0a45).
  for (let stage = MOONGATE_STEPS; stage >= 1; stage--) snapshot(stage, null, null);
  snapshot(null, null, null); // suelo restaurado (0x6e50 tile 0x44)

  // Epílogo de texto: 6 páginas de END.DAT (endgame_throne_scene 0x0000, call 0 en 0x0a6d).
  for (let page = 0; page < 6; page++) snapshot(null, null, { kind: "narration", page });

  // Pergamino de cierre + playtime (endgame_datestamp 0x0326, ya portado).
  snapshot(null, null, { kind: "scroll" });

  return frames;
}

/**
 * Rama alternativa (0x0a76): "pull up a chair… we shall be here a while" (ENDMSG record
 * 10), LB se sienta, y el party deambula. El original es un bucle INFINITO; el port lo
 * acota a `alternateFrames` (el llamador lo repite si quiere prolongar el gag).
 */
function buildAlternateEnding(
  frames: EndgameFrame[],
  snapshot: (moongate: number | null, sfx: EndgameSfx | null, cue: EndgameCue | null) => void,
  lb: EndgameActor,
  party: EndgameActor[],
  map: ReadonlyArray<ReadonlyArray<number>>,
  rng: EndgameRng,
  alternateFrames: number,
): void {
  snapshot(null, null, { kind: "dialogue", index: 10 });
  // LB se sienta (0x0a8b dec fila).
  lb.row -= 1;
  snapshot(null, null, null);
  // Deambular acotado (0x0ac9 bucle infinito de wander_sprite sobre el party).
  for (let f = 0; f < alternateFrames; f++) {
    for (const m of party) wanderSprite(m, map, rng);
    snapshot(null, null, null);
  }
}
