/**
 * Parser del MAPA de la escena final de Ultima V (task #20, Lote 1).
 *
 * `endgame_main` (ENDGAME.OVL 0x0648) carga, en su init, un registro de
 * `MISCMAPS.DAT` con el loader open+lseek+read (ULTIMA.EXE 0x7234):
 *
 *   ENDGAME 0x066f:  push 0x8480   ; fname → DATA.OVL fo 0x8490 = "MISCMAPS.DAT"
 *                    push 0xac64   ; dest  (buffer de mapa de la escena)
 *                    push 0xb0     ; len   = 176
 *                    push 0x210    ; seek  = 528
 *                    call load(seek,len,dest,fname)
 *
 * ⇒ `MISCMAPS.DAT[528:704]` = **el tile-map de la sala del endgame** (el estudio/
 * casa del Avatar; ver la narración END.DAT rec0-1 "your own long-deserted house").
 * Es el ÚNICO dato binario de tiles del endgame (el resto — END.DAT/ENDMSG.DAT — es
 * TEXTO; ver `endgame-msg.ts`).
 *
 * FORMATO (censo de bytes verificado): 176 B = **11 filas × 16 B de stride**, con las
 * columnas 0-10 = tiles reales y 11-15 = relleno 0x00 (el mismo layout de 11-de-ancho
 * de `MISCMAPS.DAT` que derivó `re/notes/intro-summoning-scene-engine.md §6`). Da un
 * mapa de **11×11** (tamaño estándar U5 de dwelling): borde de muro `0x4d`
 * (LargeRockWall), esquinas transparentes `0xff`, suelo `0x44`, y mobiliario — cama
 * `0xab/0xac`, espejo `0x9d`, estantería `0x5c/0x5d`, mesa `0x92/0x94/0x96/0x9b`,
 * cocina `0xbf`, antorchas `0xb0/0xb1`.
 *
 * Extrae SÓLO datos (la rejilla de índices de tile del atlas). El render (backdrop +
 * texto paginado encima) es del driver de la piel (Lote 2). Ningún byte de EA viaja a
 * tracked: sólo el JSON derivado.
 */

import { decompressLzw } from "./lzw.js";
import { parsePic16, type Pic16Image } from "./pic16.js";

/** LSEEK dentro de MISCMAPS.DAT (ENDGAME 0x066b push 0x210). */
export const SCENE_SEEK = 0x210; // 528
/** Bytes leídos (ENDGAME 0x0667 push 0xb0). */
export const SCENE_LEN = 0xb0; // 176
/** Stride de fila del buffer de MISCMAPS (11 cols reales + 5 de relleno 0x00). */
export const SCENE_STRIDE = 16;
/** Dimensiones del mapa de dwelling (11×11, estándar U5). */
export const SCENE_COLS = 11;
export const SCENE_ROWS = 11;

/** Mapa de la sala del endgame (rejilla de índices de tile). */
export interface EndgameScene {
  /** Fichero de origen (traza). */
  source: "MISCMAPS.DAT";
  /** LSEEK aplicado (528). */
  seek: number;
  /** Bytes leídos (176). */
  len: number;
  /** Ancho/alto del mapa (11×11). */
  cols: number;
  rows: number;
  /** `tiles[row][col]` = índice de tile del atlas (cols 0-10 del stride de 16). */
  tiles: number[][];
}

/**
 * Extrae el mapa de la sala del endgame de `MISCMAPS.DAT`. Reproduce el
 * LSEEK(528)+READ(176) del init y trocea el buffer en la rejilla 11×11 (stride 16,
 * descartando las 5 columnas de relleno por fila).
 */
export function parseEndgameScene(miscmaps: Uint8Array): EndgameScene {
  const buf = miscmaps.subarray(SCENE_SEEK, SCENE_SEEK + SCENE_LEN);
  const tiles: number[][] = [];
  for (let r = 0; r < SCENE_ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < SCENE_COLS; c++) row.push(buf[r * SCENE_STRIDE + c] ?? 0);
    tiles.push(row);
  }
  return {
    source: "MISCMAPS.DAT",
    seek: SCENE_SEEK,
    len: SCENE_LEN,
    cols: SCENE_COLS,
    rows: SCENE_ROWS,
    tiles,
  };
}

/**
 * Las 3 láminas EGA a pantalla completa de las pantallas de historia del cierre
 * (GAP 6): la casa del Avatar, el sueño de Blackthorn y el fondo del pergamino.
 * `endgame_main` las blitea con el cargador `.16` (EGA.DRV sel 0x4b), igual que la
 * intro compone STORYn.16 sobre el texto de STORY.DAT — el cierre compone estas sobre
 * las páginas de END.DAT (ver `parseEndgameNarration`).
 */
export const ENDGAME_ART_FILES = [
  { name: "end1", file: "END1.16" }, // casa del Avatar (narración END.DAT pág 0-1)
  { name: "end2", file: "END2.16" }, // The Dream / trono de Blackthorn (pág 3-5)
  { name: "endsc", file: "ENDSC.16" }, // fondo del pergamino final
] as const;

/** Una lámina de historia decodificada: nombre + fichero + sus sub-imágenes 4bpp. */
export interface EndgameArt {
  name: string;
  file: string;
  images: Pic16Image[];
}

/**
 * Decodifica las láminas EGA de las pantallas de historia del endgame (END1/END2/
 * ENDSC.16). Son ficheros LZW de sub-imágenes 4bpp — el MISMO formato `pic16` que
 * STORYn.16 de la intro. NO se redibujan: se EXTRAEN. `read(file)` entrega los bytes
 * crudos del `.16`.
 */
export function parseEndgameArts(read: (file: string) => Uint8Array): EndgameArt[] {
  return ENDGAME_ART_FILES.map(({ name, file }) => ({
    name,
    file,
    images: parsePic16(decompressLzw(read(file))),
  }));
}
