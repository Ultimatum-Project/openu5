/**
 * Parser de los MAPAS de las escenas de SANTUARIO y CODEX (ficha #277).
 *
 * Al (E)ntrar en un santuario, el original NO se queda en el sobremundo: el wrapper
 * `enter_shrine_scene_dispatch` (CAST2.OVL 0x0e76) carga un mapa PROPIO de 11×11 y corre
 * la escena encima. La carga es el mismo loader open+lseek+read (ULTIMA.EXE 0x7234) que
 * usa el endgame, sobre el MISMO fichero:
 *
 *   CAST2 0x0ed2-0x0ef6:  cmp [bp-4],0x11        ; tile bajo la party: 0x11 Codex / si no, santuario
 *                         push 0xb0 / push 0x160 ; seek  = 176 (santuario) / 352 (Codex)
 *                         push 0xb0              ; len   = 176
 *                         push 0xac64            ; dest  (buffer de escena)
 *                         push 0x95fc / 0x960a   ; fname → ambos "MISCMAPS.DAT"
 *   CAST2 0x0f0c-0x0f3f:  expande 11 filas × 11 B (stride 16) a 0xAD14 — el buffer de mapa
 *                         del régimen `g_location > 0x7f` (get_tile_ptr, kernel 0x4402), el
 *                         mismo de las arenas. Por eso 0x0ea4 pone `g_location = 0xFF`.
 *
 * ⇒ `MISCMAPS.DAT[176:352]` = santuario · `MISCMAPS.DAT[352:528]` = cámara del Codex.
 * MISMO formato que `endgame-scene.ts` (11 filas × 16 B de stride, columnas 0-10 útiles y
 * 11-15 de relleno 0x00), de donde se reutilizan las constantes de forma.
 *
 * Los dos registros estaban SIN extraer: el pipeline ya leía MISCMAPS.DAT para el demo
 * (704) y el endgame (528) y saltaba justo estos dos. Extrae SÓLO datos (la rejilla de
 * índices de tile del atlas); la escena —caminata, arrodillarse, vuelta— la deriva el core
 * (`game/src/core/world/shrine-scene.ts`). Ningún byte de EA viaja a tracked: sólo el JSON.
 */

import { SCENE_LEN, SCENE_STRIDE, SCENE_COLS, SCENE_ROWS } from "./endgame-scene.js";

/** LSEEK del mapa del SANTUARIO dentro de MISCMAPS.DAT (CAST2 0x0ee1 `push 0xb0`). */
export const SHRINE_SCENE_SEEK = 0xb0; // 176
/** LSEEK del mapa de la cámara del CODEX (CAST2 0x0ed8 `push 0x160`). */
export const CODEX_SCENE_SEEK = 0x160; // 352
/**
 * LSEEK de la SALA DEL TRONO de la captura de Blackthorn (#324): el registro 0. La
 * carga vive en BLCKTHRN.OVL 0x0706-0x0715 (kernel 0x256E, 0xB0 bytes de
 * "MISCMAPS.DAT" — fname DS 0x7000 — a 0xAC64, sin seek) y 0x072F-0x075D la expande
 * al buffer de arena 0xAD14 con el MISMO stride 16→32 que shrine/Codex.
 */
export const CAPTURE_SCENE_SEEK = 0x0; // 0

/** Mapa de una escena de MISCMAPS (rejilla de índices de tile). */
export interface MiscScene {
  /** Fichero de origen (traza). */
  source: "MISCMAPS.DAT";
  /** LSEEK aplicado. */
  seek: number;
  /** Bytes leídos (176). */
  len: number;
  /** Ancho/alto del mapa (11×11). */
  cols: number;
  rows: number;
  /** `tiles[row][col]` = índice de tile del atlas (cols 0-10 del stride de 16). */
  tiles: number[][];
}

/** Los mapas de escena de MISCMAPS que consumen los overlays de rito y captura. */
export interface ShrineScenes {
  /** Tile ≠ 0x11 → santuario: explanada con sendero y brasero-altar en (5,5). */
  shrine: MiscScene;
  /** Tile == 0x11 → cámara del Codex: sala de ladrillo con el atril en (5,2). */
  codex: MiscScene;
  /** #324 → sala del trono de la captura de Blackthorn (registro 0): grilletes 0x85 en
   *  los 6 asientos de party, trono tras (5,5), mesa (5,7), reloj (5,9), puerta sur. */
  capture: MiscScene;
}

/** Trocea un registro de 176 B de MISCMAPS en la rejilla 11×11 (stride 16). */
function sceneAt(miscmaps: Uint8Array, seek: number): MiscScene {
  const buf = miscmaps.subarray(seek, seek + SCENE_LEN);
  const tiles: number[][] = [];
  for (let r = 0; r < SCENE_ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < SCENE_COLS; c++) row.push(buf[r * SCENE_STRIDE + c] ?? 0);
    tiles.push(row);
  }
  return { source: "MISCMAPS.DAT", seek, len: SCENE_LEN, cols: SCENE_COLS, rows: SCENE_ROWS, tiles };
}

/** Extrae los mapas de santuario (176), Codex (352) y captura (0) de `MISCMAPS.DAT`. */
export function parseShrineScenes(miscmaps: Uint8Array): ShrineScenes {
  return {
    shrine: sceneAt(miscmaps, SHRINE_SCENE_SEEK),
    codex: sceneAt(miscmaps, CODEX_SCENE_SEEK),
    capture: sceneAt(miscmaps, CAPTURE_SCENE_SEEK),
  };
}
