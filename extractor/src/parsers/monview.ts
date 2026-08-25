/**
 * Parser de MON0-7.16 — los 8 BANCOS DE SPRITE del MONSTRUO ERRANTE de mazmorra
 * 3D (identificación registrada por la auditoría de cobertura, ítem
 * mon16-corridor-sprites; antes misatribuidos en dungeon3d-audit.md §4b como
 * cola de la tabla de muros).
 *
 * Derivación (DUNGEON.OVL.asm 0x0151-0x01C0): al armar el errante, el motor
 * tira `rand(0,7)` (0x0151-0x0158) → índice de banco; lee sus ATRIBUTOS de las
 * tablas DS 0x173C (tile/clase: 14 15 16 17 18 19 1C 1B) y DS 0x1744 (flags:
 * 60 A0 00 90 80 60 00 00), y carga PEREZOSAMENTE el fichero vía la tabla de
 * punteros-a-nombre DS 0x25FA (DATA.OVL fileoff 0x260A) = "MON0.16".."MON7.16"
 * (`push word [bx*2+0x25FA]; call load` @0x01BC). La tabla de VARIANTES DE MURO
 * de DNGLOOK (DS 0x25F2) termina justo antes: sus 4 entradas reales son
 * ITEMS/DNG1/DNG2/DNG3 — los "[4..7]=MON0..3" que se leían eran el SOLAPE con
 * esta tabla, no muros.
 *
 * Contenedor (tras el LZW; los 8 bancos descomprimen a 2614 B exactos):
 * - `u16` count (= 6 slots).
 * - `count` × (`u16` offImagen, `u16` offMáscara) — tabla de PARES.
 * - Orden de slots: 2 FRAMES de animación × 3 PROFUNDIDADES
 *   [f0: cerca 24×66 · media 16×25 · lejos 8×6][f1: ídem].
 * - Imagen: `u16` w, `u16` h, `w/2×h` bytes 4bpp packed (nibble alto = píxel izq.,
 *   como TILES.16).
 * - Máscara: `u16` w, `u16` h, `w/8×h` bytes 1bpp (MSB = píxel izq.);
 *   **bit 0 = píxel del sprite (opaco), bit 1 = fondo (transparente)** — es una
 *   AND-mask de silueta (cubre también los píxeles negros interiores; verificado
 *   por correlación con los índices ≠0 del bitmap).
 *
 * Tamaños verificados contra los offsets (MON0): imagen 4+w/2·h y máscara
 * 4+w/8·h cierran exactamente los 12 huecos de la tabla.
 */
import { EGA_PALETTE } from "./tiles.js";
import type { DngViewImage } from "./dngtiles.js";

/** Nº de slots por banco: 2 frames × 3 profundidades. */
export const MON_VIEW_COUNT = 6;

/**
 * Descompone el blob descomprimido de un MONn.16 en sus 6 sprites RGBA
 * (alpha por la AND-mask: bit 0 = opaco). Devuelve slots en el orden del
 * contenedor (frame0 cerca/media/lejos, frame1 ídem).
 */
export function parseMonView(dec: Uint8Array): (DngViewImage | null)[] {
  const u16 = (o: number): number => dec[o]! | (dec[o + 1]! << 8);
  const count = u16(0);
  if (count < 1 || count > 64) throw new Error(`parseMonView: count improbable (${count})`);
  const tableEnd = 2 + count * 4;

  const images: (DngViewImage | null)[] = [];
  for (let i = 0; i < count; i++) {
    const offImg = u16(2 + i * 4);
    const offMask = u16(4 + i * 4);
    if (offImg === 0) {
      images.push(null);
      continue;
    }
    if (offImg < tableEnd || offImg + 4 > dec.length) {
      throw new Error(`parseMonView: offset de imagen fuera de rango en slot ${i} (${offImg})`);
    }
    const width = u16(offImg);
    const height = u16(offImg + 2);
    const rowBytes = width >> 1; // 4bpp
    if (width < 2 || (width & 1) !== 0 || height < 1 || offImg + 4 + rowBytes * height > dec.length) {
      throw new Error(`parseMonView: dimensiones inválidas en slot ${i} (${width}×${height})`);
    }
    // Máscara: mismas dimensiones, 1bpp. Sin máscara válida → todo opaco.
    let maskBits: Uint8Array | null = null;
    if (offMask >= tableEnd && offMask + 4 <= dec.length) {
      const mw = u16(offMask);
      const mh = u16(offMask + 2);
      const mRow = mw >> 3;
      if (mw === width && mh === height && offMask + 4 + mRow * mh <= dec.length) {
        maskBits = dec.subarray(offMask + 4, offMask + 4 + mRow * mh);
      }
    }
    if (!maskBits) {
      throw new Error(`parseMonView: máscara inválida en slot ${i} (${offMask})`);
    }

    const rgba = new Uint8Array(width * height * 4);
    let src = offImg + 4;
    const mRowBytes = width >> 3;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x += 2) {
        const byte = dec[src++]!;
        putMasked(rgba, maskBits, mRowBytes, width, x, y, (byte >> 4) & 0x0f);
        putMasked(rgba, maskBits, mRowBytes, width, x + 1, y, byte & 0x0f);
      }
    }
    images.push({ width, height, rgba });
  }
  return images;
}

function putMasked(
  rgba: Uint8Array,
  mask: Uint8Array,
  mRowBytes: number,
  width: number,
  x: number,
  y: number,
  color: number,
): void {
  const bit = (mask[y * mRowBytes + (x >> 3)]! >> (7 - (x & 7))) & 1;
  const [r, g, b] = EGA_PALETTE[color]!;
  const o = (y * width + x) * 4;
  rgba[o] = r;
  rgba[o + 1] = g;
  rgba[o + 2] = b;
  rgba[o + 3] = bit === 0 ? 255 : 0; // AND-mask: bit 0 = sprite, bit 1 = fondo
}
