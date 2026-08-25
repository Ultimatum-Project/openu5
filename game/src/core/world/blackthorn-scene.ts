/**
 * ESCENA de la CAPTURA de Blackthorn (ficha #324, la mitad VISUAL de #288) — guion PURO
 * derivado de `blackthorn_capture` (BLCKTHRN.OVL 0x060e) y de su intérprete de cutscene
 * `anim_vm` (0x00be). El texto ya era fiel (blackthorn-capture.ts); lo que faltaba era
 * TODO lo demás: apagón de venda, sala del trono con la party engrilletada, guardias que
 * desfilan, Blackthorn materializándose, el compañero arrastrado a la mesa de tortura,
 * el reloj de arena que se vacía ronda a ronda, el péndulo, y la salida escoltada.
 *
 * ── EL MAPA ────────────────────────────────────────────────────────────────────────────
 * BLCKTHRN 0x0706-0x0715: kernel 0x256E carga 0xB0 bytes de "MISCMAPS.DAT" (fname DS
 * 0x7000) en 0xAC64 = registro 0 del fichero (seek 0). 0x072F-0x075D lo expande 11 filas
 * × 11 B (stride fuente 16, destino 0x20) al buffer de arena 0xAD14 — el régimen
 * `g_location = 0xFF` (0x06FC), el mismo de shrine/Codex (#277). La rejilla viaja como
 * asset del extractor (`shrine-scene.json`, clave `capture`), jamás como literal.
 * Celda (x,y) = buffer[y*32+x] (adjudicado: los grilletes 0x85 del mapa caen EXACTOS en
 * las 6 posiciones de party de la tabla 0x1F0A/0x1F42/0x1F48 leída como x=0x1F42).
 *
 * ── LOS OBJETOS (g_world_objects 0x5C5A, 8 B/slot: +0/+1 tile, +2 x, +3 y) ─────────────
 * 0x06E5-0x06F7 limpia los 32 slots (kernel 0x3A74 con seis ceros). Reparto de la escena:
 *   · slots 0..numLiving-1 = la party (0x075F-0x07C9): asiento = tabla DS 0x1F0A
 *     (fila numLiving, 8 B/fila) → código → x=DS 0x1F42[c], y=DS 0x1F48[c]; tile por
 *     CLASE: strchr (kernel 0x4D76) de la letra en DS 0x701A "AMBFDTPRS" → DS 0x1ADE
 *     [0x4C,0x40,0x44,0x48,0x4C,...] (+0x100 en el atlas: Avatar1/Wizard1/Bard1/Fighter1).
 *   · slots 6/7 = guardias (0x07F4-0x0821, `write_object_record(idx,f5..f0)` con f3=y=0xA,
 *     f2=x=4/6, tile 0x70 → 0x170 Guard1): entran por el hueco de la puerta SUR.
 *   · slot 8 = Blackthorn (0x0842-0x0875): primero tile 0x16 (0x116 HolyFloorSymbol),
 *     luego el fizzle-in LFSR `fx_tile_fizzle_in` (kernel 0x1068, tile 0x178) y el
 *     registro queda en 0x78 → 0x178 Blackthorn1, en (5,5) ante la puerta del trono.
 *
 * ── EL INTÉRPRETE anim_vm (0x00be) ─────────────────────────────────────────────────────
 * Bytecode en DATA.OVL (DS → fileoff+0x10). Jump-table cs:[bx-0x5BFA] = fichero 0x0176:
 *   op 0 fin · op 1 dual (el siguiente move lleva 2º byte slot/dir) · op 2 n = repeat
 *   op 3/4 sonido de paso ON/OFF (no aparecen en estos guiones; di=1 SIEMPRE)
 *   op 5 n = pausa run-n-frames (kernel 0x3AE6) · op 6 t,x,y = plot tile en el mapa
 *   op 7 = tick 0x5910 · op 8 = beep_delay(repeat) · op 9 n = borra el objeto n
 *   op ≥ 0x10 = PASO: base&0xFC → slot (0x10→6, 0x14→7, 0x18→8, 0x1C→0, 0x20→1,
 *   `dir_to_delta` 0x002e) y &3 → dir (0=N dec y, 1=E inc x, 2=S inc y, 3=W dec x);
 *   por paso, si di: beep_delay(1) = sfx_footstep (kernel 0x433E) + pausa(2).
 * Los CINCO guiones (bytes verbatim en los builders): 0x3702 (guardias entran), 0x370E
 * (el guardia va a soltarte), 0x36DA (aviso: el compañero a la mesa + reloj de arena),
 * 0x369E (final: puerta oeste + salida escoltada + desfile), 0x3716 (Blackthorn se va).
 *
 * ── UNIDAD DE TIEMPO ───────────────────────────────────────────────────────────────────
 * `frames` = unidades de run-n-frames 0x3AE6 (≈1 tick INT 1Ch), la MISMA calibración
 * compartida del port (PAUSE_UNIT_MS = 55, skin/world-fx.ts). Los arrastres del apagón
 * usan delay_ticks_int1c(5) (kernel 0x20FA, 0x069B/0x06D5) — también ticks ⇒ frames:5.
 *
 * Módulo PURO: no toca GameState, ni RNG, ni reloj. La orquestación (qué segmento y
 * entre qué textos) vive en blackthorn-capture.ts; la presentación en el pacer de UI.
 */

/** Rejilla 11×11 de la sala del trono (asset `shrine-scene.json` clave `capture`). */
export type CaptureSceneTiles = readonly (readonly number[])[];

/** Una figura horneable: celda + tile del atlas (actores ya con su +0x100). */
export interface CaptureFigure {
  slot: number;
  x: number;
  y: number;
  tile: number;
}

/** Un parche de mapa (op 6 del VM / escrituras directas al buffer 0xAD14). */
export interface CaptureMapPatch {
  x: number;
  y: number;
  tile: number;
}

/**
 * Un beat del guion. `figures` = snapshot COMPLETO de los objetos visibles tras el beat
 * (ausente = sin cambio); `patch` se acumula sobre la rejilla; `frames` en unidades
 * 0x3AE6; `footstep` = sfx_footstep 0x433E; `sfx` = cue puntual (barridos 0x2192);
 * `mount` = a partir de aquí la vista es la SALA (antes, el apagón de la venda).
 * (La EXPLOSIÓN del sacrificio no es un beat: viaja como evento `cell-explosion` del
 * core, tras el segmento — ver `sacrificeVictimCell` y blackthorn-capture.ts.)
 */
export interface CaptureSceneBeat {
  figures?: readonly CaptureFigure[];
  patch?: CaptureMapPatch;
  frames: number;
  footstep?: boolean;
  sfx?: "blackthorn-materialize" | "shard-sweep";
  mount?: boolean;
}

/**
 * Guion de un SEGMENTO de la escena (los textos y esperas de tecla van FUERA, como
 * eventos hermanos). `blackout` = el segmento corre sobre el viewport ennegrecido
 * (venda, 0x0676 set_color(0) + 0x0689 fill_rect(8,8,183,183)); `dismount` = al agotar
 * los beats la escena se desmonta (el depósito 0x08E7 restaura la pantalla).
 */
export interface CaptureSceneScript {
  blackout?: boolean;
  /** Rejilla base — sólo en el segmento que monta la sala (beat con `mount`). */
  tiles?: CaptureSceneTiles;
  beats: CaptureSceneBeat[];
  dismount?: boolean;
}

/** Estado VIVO de la escena entre segmentos (lo posee Game junto al interrogatorio). */
export interface CaptureSceneState {
  /** Objetos por slot del binario (0..5 party, 6/7 guardias, 8 Blackthorn). `visible:
   *  false` = tiles a 0 (op 9) pero x/y RETENIDOS — el explosion_fx del sacrificio
   *  apunta a las coords del slot 1 aunque su objeto ya no se pinte (0x0414-0x0426). */
  objects: ({ x: number; y: number; tile: number; visible: boolean } | null)[];
}

/** Dirección de un paso del VM (dir_to_delta 0x002e: &3). */
type Dir = "N" | "E" | "S" | "W";

/** Op del guion derivado (espejo 1:1 del bytecode; bytes citados en cada builder). */
type AnimOp =
  | { op: "step"; moves: readonly { slot: number; dir: Dir }[]; times: number }
  | { op: "pause"; frames: number }
  | { op: "plot"; x: number; y: number; tile: number }
  | { op: "remove"; slot: number }
  | { op: "steps"; n: number }; // beep_delay(n): n × {pisada + pausa(2)}
// (op 7 `tick 0x5910` es un repintado/housekeeping sin observable propio en el port:
//  el beat siguiente ya repinta; no se modela.)

/** Asientos por numLiving (DS 0x1F0A + n*8; la fila 0 del fichero es relleno ASCII). */
const SEAT_CODES: readonly (readonly number[])[] = [
  [],
  [4], // n=1: el Avatar solo
  [4, 5],
  [4, 5, 0],
  [4, 5, 3, 0],
  [4, 5, 2, 1, 0],
  [4, 5, 3, 2, 1, 0],
];
/** x del asiento por código (DS 0x1F42). */
const SEAT_X: readonly number[] = [0, 1, 9, 10, 3, 7];
/** y del asiento por código (DS 0x1F48). Códigos 0-3 = fila de celdas y=1; 4/5 = los
 *  grilletes flanqueando el trono (Avatar (3,5), compañero (7,5)) — los 0x85 del mapa. */
const SEAT_Y: readonly number[] = [1, 1, 1, 1, 5, 5];

/**
 * Tile de actor por letra de CLASE (DS 0x701A "AMBFDTPRS" → DS 0x1ADE, +0x100 atlas).
 * El port sólo tiene A/M/B/F; el resto del binario cae a 0x4C = Avatar1, que es también
 * el default aquí.
 */
const CLASS_TILE: Readonly<Record<string, number>> = {
  A: 0x14c, // Avatar1
  M: 0x140, // Wizard1
  B: 0x144, // Bard1
  F: 0x148, // Fighter1
};
const CLASS_TILE_DEFAULT = 0x14c;

/** Guardias (0x07F4-0x0821): tile 0x70 → 0x170 Guard1, entran por la puerta sur. */
export const GUARD_TILE = 0x170;
export const GUARD_A_START = { x: 4, y: 10 } as const; // slot 6
export const GUARD_B_START = { x: 6, y: 10 } as const; // slot 7
/** Blackthorn (slot 8): círculo sagrado (0x0842 tile 0x16) → fizzle → 0x178 (0x0857/0x0863). */
export const HOLY_SYMBOL_TILE = 0x116;
export const BLACKTHORN_TILE = 0x178;
export const BLACKTHORN_CELL = { x: 5, y: 5 } as const;

/** El reloj de arena de la escalada, en (5,9) (celda 293 = 9*32+5 del buffer 0xAD14). */
export const HOURGLASS_CELL = { x: 5, y: 9 } as const;
/** Lleno al montarlo (guion 0x36DA `06 e9 05 09`). */
export const HOURGLASS_FULL_TILE = 0xe9; // Hourglass2
/**
 * Estados de la escalada (interrogate 0x054A, switch de 0x05BA sobre la ronda `si`):
 * si==1 → 0xEB (0x05DA) · si==2 → 0xE8 (0x05E2, el vacío del mapa base). El caso si==0
 * → 0xEA (0x05D2) es INALCANZABLE: `warned` se arma siempre en la ronda 0 (el primer
 * fallo va por 0x05F4), así que ningún fallo con warned llega con si==0 — código muerto
 * del binario, documentado y NO portado.
 */
export const HOURGLASS_ROUND_TILES: Readonly<Record<number, number>> = {
  1: 0xeb, // Hourglass4
  2: 0xe8, // Hourglass1 (vaciado)
};

/** La mesa de tortura en (5,7) (celda 229): con el compañero encadenado / tras la hoja. */
export const TORTURE_CELL = { x: 5, y: 7 } as const;
export const TORTURE_BODY_TILE = 0x82; // TortureTableWithBody1 (0x36DA `06 82 05 07`)
export const TORTURE_AFTER_TILE = 0x80; // TortureChair1 (sacrifice_member 0x0429)

/** La puerta secreta oeste en (0,4): se abre a suelo y se vuelve a cerrar (0x369E). */
export const WEST_DOOR_CELL = { x: 0, y: 4 } as const;
export const WEST_DOOR_OPEN_TILE = 0x44; // BrickFloor
export const WEST_DOOR_SHUT_TILE = 0xbb; // LockedDoorView

/** Pausa de un paso del VM (beep_delay(1) = pisada + kernel 0x3AE6(2)). */
const STEP_FRAMES = 2;
/** Pausa de cada arrastre del apagón (kernel 0x20FA delay_ticks_int1c(5), 0x069B/0x06D5). */
const DRAG_STEP_FRAMES = 5;

const DIR_DELTA: Readonly<Record<Dir, { dx: number; dy: number }>> = {
  N: { dx: 0, dy: -1 },
  E: { dx: 1, dy: 0 },
  S: { dx: 0, dy: 1 },
  W: { dx: -1, dy: 0 },
};

/** Snapshot inmutable de las figuras VISIBLES del estado. */
function figuresOf(state: CaptureSceneState): CaptureFigure[] {
  const out: CaptureFigure[] = [];
  state.objects.forEach((o, slot) => {
    if (o && o.visible) out.push({ slot, x: o.x, y: o.y, tile: o.tile });
  });
  return out;
}

/**
 * Ejecuta un guion derivado del VM sobre el estado (mutándolo) y devuelve sus beats.
 * Cada PASO es un beat con snapshot (di=1 en los cinco guiones ⇒ pisada siempre).
 */
function runAnim(state: CaptureSceneState, ops: readonly AnimOp[]): CaptureSceneBeat[] {
  const beats: CaptureSceneBeat[] = [];
  for (const op of ops) {
    if (op.op === "pause") {
      beats.push({ frames: op.frames });
    } else if (op.op === "steps") {
      for (let i = 0; i < op.n; i++) beats.push({ frames: STEP_FRAMES, footstep: true });
    } else if (op.op === "plot") {
      beats.push({ patch: { x: op.x, y: op.y, tile: op.tile }, frames: 0 });
    } else if (op.op === "remove") {
      const o = state.objects[op.slot];
      if (o) o.visible = false; // op 9 borra los tiles; x/y QUEDAN (ver CaptureSceneState)
      beats.push({ figures: figuresOf(state), frames: 0 });
    } else {
      for (let t = 0; t < op.times; t++) {
        for (const m of op.moves) {
          const o = state.objects[m.slot];
          if (o) {
            o.x += DIR_DELTA[m.dir].dx;
            o.y += DIR_DELTA[m.dir].dy;
          }
        }
        beats.push({ figures: figuresOf(state), frames: STEP_FRAMES, footstep: true });
      }
    }
  }
  return beats;
}

/**
 * Estado inicial de la escena: la party engrilletada en sus asientos (0x075F-0x07C9).
 * `classes` = letras de clase de los primeros numLiving registros del roster (el binario
 * recorre los primeros numLiving registros, sin filtrar por status, 0x0779 stride 0x20).
 */
export function initCaptureScene(classes: readonly string[]): CaptureSceneState {
  const objects: CaptureSceneState["objects"] = Array.from({ length: 9 }, () => null);
  const n = Math.min(classes.length, 6);
  const codes = SEAT_CODES[n] ?? [];
  for (let i = 0; i < n; i++) {
    const code = codes[i] ?? 0;
    objects[i] = {
      x: SEAT_X[code] ?? 0,
      y: SEAT_Y[code] ?? 0,
      tile: CLASS_TILE[classes[i] ?? ""] ?? CLASS_TILE_DEFAULT,
      visible: true,
    };
  }
  return { objects };
}

/**
 * SEGMENTO 1 (apagón): pausa(2) (0x0672) + 5 arrastres {delay 5 ticks + pisada}
 * (0x069B-0x06AE). Corre con el viewport en negro (la venda). El print del arrastre
 * («Strong guards drag thee away!», 0x06B0) va DESPUÉS, como evento hermano.
 */
export function buildBlackoutIntroScript(): CaptureSceneScript {
  const beats: CaptureSceneBeat[] = [{ frames: 2 }];
  for (let i = 0; i < 5; i++) beats.push({ frames: DRAG_STEP_FRAMES, footstep: true });
  return { blackout: true, beats };
}

/**
 * SEGMENTO 2: 18 arrastres más (0x06B9-0x06E0; con el sonido de la máquina APAGADO el
 * binario da 3 — el port modela sonido ON, `g_unk_a9ce`≠0) y el MONTAJE de la sala
 * (limpieza de slots + carga + party sentada, 0x06E5-0x07C9) con la pausa(0x10) de
 * 0x07D1 ya a la vista. Tras esto: «chained and manacled!».
 */
export function buildThroneMountScript(
  state: CaptureSceneState,
  tiles: CaptureSceneTiles,
): CaptureSceneScript {
  const beats: CaptureSceneBeat[] = [];
  for (let i = 0; i < 18; i++) beats.push({ frames: DRAG_STEP_FRAMES, footstep: true });
  beats.push({ mount: true, figures: figuresOf(state), frames: 0x10 });
  return { blackout: true, tiles, beats };
}

/** SEGMENTO 3: la pausa(0x32) de 0x07DF, entre «chained» y «Footsteps!». */
export function buildChainedPauseScript(): CaptureSceneScript {
  return { beats: [{ frames: 0x32 }] };
}

/**
 * SEGMENTO 4: beep_delay(8) (0x07ED, los pasos que se acercan) → guardias en la puerta
 * sur (0x07F4-0x0821) → guion 0x3702 → barrido de materialización (tone_sweep 0x082B:
 * (0xAF0,1,0x32C8,0x64,5)) con el círculo sagrado (0x0842) → Blackthorn (fizzle 0x0857 +
 * registro 0x0863; la textura del fizzle LFSR es Clase C — aquí aparece al corte) →
 * pausa(8) (0x0878). Después: el saludo de Blackthorn.
 *
 * Guion 0x3702 (DATA.OVL 0x3712): `08 01 10 14 02 03 01 13 15 05 08 00` =
 * beep_delay(1) · dual{s6 N, s7 N} · repeat 3 · dual{s6 W, s7 E} · pausa(8).
 * Los guardias acaban en (1,9) y (9,9), apostados tras los prisioneros.
 */
export function buildBlackthornEntryScript(state: CaptureSceneState): CaptureSceneScript {
  const beats: CaptureSceneBeat[] = [];
  for (let i = 0; i < 8; i++) beats.push({ frames: STEP_FRAMES, footstep: true });
  state.objects[6] = { ...GUARD_A_START, tile: GUARD_TILE, visible: true };
  state.objects[7] = { ...GUARD_B_START, tile: GUARD_TILE, visible: true };
  beats.push({ figures: figuresOf(state), frames: 0 });
  beats.push(
    ...runAnim(state, [
      { op: "steps", n: 1 },
      { op: "step", moves: [{ slot: 6, dir: "N" }, { slot: 7, dir: "N" }], times: 1 },
      { op: "step", moves: [{ slot: 6, dir: "W" }, { slot: 7, dir: "E" }], times: 3 },
      { op: "pause", frames: 8 },
    ]),
  );
  state.objects[8] = { ...BLACKTHORN_CELL, tile: HOLY_SYMBOL_TILE, visible: true };
  beats.push({ figures: figuresOf(state), sfx: "blackthorn-materialize", frames: 0 });
  const bt = state.objects[8];
  if (bt) bt.tile = BLACKTHORN_TILE;
  beats.push({ figures: figuresOf(state), frames: 8 });
  return { beats };
}

/**
 * SEGMENTO 5: guion 0x370E (DATA.OVL 0x371E): `05 0b 13 02 04 10 11 00` = pausa(11) ·
 * s6 W · repeat 4 · s6 N · s6 E. El guardia A deja su puesto de (1,9): W→(0,9),
 * N×4→(0,5), E→(1,5) — echa a andar hacia el Avatar (3,5) para soltarlo… y entonces
 * Blackthorn dice «Wait!». Corre tras el «GUARD! Release…» (0x08BF).
 */
export function buildGuardReleaseScript(state: CaptureSceneState): CaptureSceneScript {
  return {
    beats: runAnim(state, [
      { op: "pause", frames: 11 },
      { op: "step", moves: [{ slot: 6, dir: "W" }], times: 1 },
      { op: "step", moves: [{ slot: 6, dir: "N" }], times: 4 },
      { op: "step", moves: [{ slot: 6, dir: "E" }], times: 1 },
    ]),
  };
}

/**
 * AVISO (primer fallo con party>1) — guion 0x36DA (DATA.OVL 0x36EA), llamado desde
 * 0x051C entre el rec7 y el rec8: `05 16 12 02 07 11 22 02 02 01 13 23 22 05 03 06 82
 * 05 07 09 01 07 02 05 13 10 05 0c 02 03 17 06 e9 05 09 02 03 15 00` =
 * pausa(22) · s6 S · repeat 7 · s6 E · s1 S · repeat 2 · dual{s6 W, s1 W} · s1 S ·
 * pausa(3) · plot 0x82@(5,7) · borra obj 1 · tick · repeat 5 · s6 W · s6 N · pausa(12) ·
 * repeat 3 · s7 W · plot 0xE9@(5,9) · repeat 3 · s7 E.
 * El guardia A marcha al compañero (slot 1) hasta la mesa de tortura (5,7) — su objeto
 * se borra y la celda pasa a 0x82 (cuerpo encadenado) — y vuelve EXACTO a (1,5); el
 * guardia B monta el reloj de arena LLENO (0xE9) en (5,9) y regresa a (9,9).
 */
export function buildWarningScript(state: CaptureSceneState): CaptureSceneScript {
  return {
    beats: runAnim(state, [
      { op: "pause", frames: 22 },
      { op: "step", moves: [{ slot: 6, dir: "S" }], times: 1 },
      { op: "step", moves: [{ slot: 6, dir: "E" }], times: 7 },
      { op: "step", moves: [{ slot: 1, dir: "S" }], times: 1 },
      { op: "step", moves: [{ slot: 6, dir: "W" }, { slot: 1, dir: "W" }], times: 2 },
      { op: "step", moves: [{ slot: 1, dir: "S" }], times: 1 },
      { op: "pause", frames: 3 },
      { op: "plot", ...TORTURE_CELL, tile: TORTURE_BODY_TILE },
      { op: "remove", slot: 1 },
      { op: "step", moves: [{ slot: 6, dir: "W" }], times: 5 },
      { op: "step", moves: [{ slot: 6, dir: "N" }], times: 1 },
      { op: "pause", frames: 12 },
      { op: "step", moves: [{ slot: 7, dir: "W" }], times: 3 },
      { op: "plot", ...HOURGLASS_CELL, tile: HOURGLASS_FULL_TILE },
      { op: "step", moves: [{ slot: 7, dir: "E" }], times: 3 },
    ]),
  };
}

/**
 * ESCALADA (fallo en ronda 1 ó 2, warned ya armado): la arena cae — un solo parche
 * sobre (5,9) (interrogate 0x05DA/0x05E2). Ver HOURGLASS_ROUND_TILES (y el caso 0xEA
 * inalcanzable). Ronda sin tile propio ⇒ null (la 3 va al péndulo, no aquí).
 */
export function buildHourglassScript(round: number): CaptureSceneScript | null {
  const tile = HOURGLASS_ROUND_TILES[round];
  if (tile === undefined) return null;
  return { beats: [{ patch: { ...HOURGLASS_CELL, tile }, frames: 0 }] };
}

/**
 * SACRIFICIO (sacrifice_member 0x03AE, ambos modos): pausa(10) (0x03C9) · sirena
 * (0x03D0-0x0411: DOS bucles espejo de tone_sweep con los MISMOS cinco argumentos que
 * el ritual del shard — (0xA50,1,0xC8,si,0), si=2000→25000→2000 de 0x32 en 0x32,
 * 460+460 llamadas ⇒ se reusa el cue `shard-sweep`) · explosion_fx_at_cell (kernel
 * 0x3522) en las coords del slot 1 (0x0414-0x041E — las ÚLTIMAS: (7,5) si nunca hubo
 * aviso, (5,7) si ya estaba en la mesa) · su objeto se apaga (0x0421-0x0426) · la celda
 * de la mesa queda en 0x80 (0x0429). Los prints y la espera de tecla van fuera.
 */
export function buildSacrificeScript(state: CaptureSceneState): CaptureSceneScript {
  const victim = state.objects[1];
  if (victim) victim.visible = false;
  return {
    beats: [
      { frames: 10 },
      { sfx: "shard-sweep", frames: 0 },
      {
        figures: figuresOf(state),
        patch: { ...TORTURE_CELL, tile: TORTURE_AFTER_TILE },
        frames: 0,
      },
    ],
  };
}

/**
 * Celda del explosion_fx_at_cell del sacrificio (0x0414-0x041E): las ÚLTIMAS coords del
 * slot 1 — su asiento (7,5) si nunca hubo aviso, la mesa (5,7) si ya fue arrastrado
 * (op 9 del VM apaga el objeto pero RETIENE x/y, como el binario). Leer ANTES de
 * `buildSacrificeScript` no es necesario (no toca x/y), pero el evento la usa tras él.
 */
export function sacrificeVictimCell(state: CaptureSceneState): { x: number; y: number } {
  const victim = state.objects[1];
  return victim ? { x: victim.x, y: victim.y } : { ...TORTURE_CELL };
}

/**
 * FINAL de traición/mazmorra — guion 0x369E (DATA.OVL 0x36AE), llamado desde 0x0510
 * (tras la espera de tecla): `13 06 44 00 04 07 11 11 02 02 01 13 1f 12 11 11 10 01 13
 * 1f 01 13 1c 01 10 1c 1c 12 06 bb 00 04 08 19 02 04 01 1a 12 1a 11 09 08 02 03 11 12
 * 09 06 02 03 17 16 09 07 02 06 08 00` =
 * s6 W · plot 0x44@(0,4) [la puerta oeste SE ABRE] · tick · s6 E ×2 · repeat 2 ·
 * dual{s6 W, s0 W} [escolta al AVATAR] · s6 S·E·E·N [lo rodea] · dual{s6 W, s0 W} ·
 * dual{s6 W, s0 N} · dual{s6 N, s0 N} · s0 N [sale por la puerta al corredor de celdas]
 * · s6 S · plot 0xBB@(0,4) [la puerta SE CIERRA] · beep_delay(1) · s8 E · repeat 4 ·
 * dual{s8 S, s6 S} · s8 S · s6 E · borra 8 [Blackthorn sale por la puerta sur] ·
 * repeat 3 · s6 E · s6 S · borra 6 · repeat 3 · s7 W · s7 S · borra 7 · beep_delay(6)
 * [seis pisadas que se alejan]. Tras esto, el depósito (dismount).
 */
export function buildFinaleScript(state: CaptureSceneState): CaptureSceneScript {
  return {
    dismount: true,
    beats: runAnim(state, [
      { op: "step", moves: [{ slot: 6, dir: "W" }], times: 1 },
      { op: "plot", ...WEST_DOOR_CELL, tile: WEST_DOOR_OPEN_TILE },
      { op: "step", moves: [{ slot: 6, dir: "E" }], times: 2 },
      { op: "step", moves: [{ slot: 6, dir: "W" }, { slot: 0, dir: "W" }], times: 2 },
      { op: "step", moves: [{ slot: 6, dir: "S" }], times: 1 },
      { op: "step", moves: [{ slot: 6, dir: "E" }], times: 2 },
      { op: "step", moves: [{ slot: 6, dir: "N" }], times: 1 },
      { op: "step", moves: [{ slot: 6, dir: "W" }, { slot: 0, dir: "W" }], times: 1 },
      { op: "step", moves: [{ slot: 6, dir: "W" }, { slot: 0, dir: "N" }], times: 1 },
      { op: "step", moves: [{ slot: 6, dir: "N" }, { slot: 0, dir: "N" }], times: 1 },
      { op: "step", moves: [{ slot: 0, dir: "N" }], times: 1 },
      { op: "step", moves: [{ slot: 6, dir: "S" }], times: 1 },
      { op: "plot", ...WEST_DOOR_CELL, tile: WEST_DOOR_SHUT_TILE },
      { op: "steps", n: 1 },
      { op: "step", moves: [{ slot: 8, dir: "E" }], times: 1 },
      { op: "step", moves: [{ slot: 8, dir: "S" }, { slot: 6, dir: "S" }], times: 4 },
      { op: "step", moves: [{ slot: 8, dir: "S" }], times: 1 },
      { op: "step", moves: [{ slot: 6, dir: "E" }], times: 1 },
      { op: "remove", slot: 8 },
      { op: "step", moves: [{ slot: 6, dir: "E" }], times: 3 },
      { op: "step", moves: [{ slot: 6, dir: "S" }], times: 1 },
      { op: "remove", slot: 6 },
      { op: "step", moves: [{ slot: 7, dir: "W" }], times: 3 },
      { op: "step", moves: [{ slot: 7, dir: "S" }], times: 1 },
      { op: "remove", slot: 7 },
      { op: "steps", n: 6 },
    ]),
  };
}

/**
 * SALIDA de Blackthorn tras el PÉNDULO — guion 0x3716 (DATA.OVL 0x3726): `05 04 19 02
 * 05 1a 09 08 07 00` = pausa(4) · s8 E · repeat 5 · s8 S · borra 8 · tick. Sólo corre
 * si el slot 8 sigue en pie (0x08D9 `cmp [0x5C9A],0`): las salidas por 0x369E ya lo
 * borraron. Tras esto, el depósito (dismount).
 */
export function buildBlackthornExitScript(state: CaptureSceneState): CaptureSceneScript {
  return {
    dismount: true,
    beats: runAnim(state, [
      { op: "pause", frames: 4 },
      { op: "step", moves: [{ slot: 8, dir: "E" }], times: 1 },
      { op: "step", moves: [{ slot: 8, dir: "S" }], times: 5 },
      { op: "remove", slot: 8 },
    ]),
  };
}

/** ¿Sigue Blackthorn en escena? (el gate de 0x08D9 sobre el tile del slot 8). */
export function blackthornOnStage(state: CaptureSceneState): boolean {
  return state.objects[8]?.visible === true;
}
