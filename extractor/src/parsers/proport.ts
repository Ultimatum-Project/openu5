/**
 * Decoder de PROPORT.PCS — la fuente PROPORCIONAL de las cinemáticas de la intro
 * (The Summoning + la gitana usan texto proporcional, no la IBM.CH monoespaciada).
 *
 * DERIVADO Y CITADO del asm (`re/notes/intro-blit-formats.md §3.3`): mismo
 * contenedor LZW que .16/.BIT; tras descomprimir, un archivo indexado de glifos.
 * El renderer proporcional vive en FONT.OVL (thunk far `0xfb26` →
 * `kernel_overlay_stubs+0x2d0`), que INTRO/`play_introduction` invocan.
 *
 * FORMATO:
 *   [u16 count][count × u16 offset]
 *   por glifo (registro FIJO de 12 B): [u16 width][u16 height=8][8 × byte de fila,
 *                1bpp, MSB = píxel izquierdo]
 *   - count = 91; los 91 registros miden 12 B (4 de cabecera + 8 filas).
 *   - height = 8 SIEMPRE; width ∈ 0..8 (el avance PROPORCIONAL: el renderer avanza
 *     `width` px, no 8). Glifo 0 = espacio (w=0).
 *   - Mapa de carácter: glifo `i` (0..90) → ASCII `0x20 + i` → ` `(0x20)..`z`(0x7a).
 */

import { u16le } from "./binary.js";

/** Un glifo proporcional: ancho de avance + bitmap 1bpp de 8 filas. */
export interface ProportGlyph {
  /** Código ASCII (0x20 + índice). */
  code: number;
  /** Ancho de avance en px (0..8) — proporcional. */
  width: number;
  /** Alto (siempre 8). */
  height: number;
  /** width*height (bits 0/1), row-major, MSB = píxel izquierdo. */
  mask: Uint8Array;
}

/** Primer código ASCII del mapa de glifos (glifo 0 = espacio 0x20). */
export const PROPORT_FIRST_CHAR = 0x20;

/** Desempaqueta un glifo (8 filas 1bpp, MSB=izq) a partir de su offset. */
function unpackGlyph(d: Uint8Array, off: number, code: number): ProportGlyph {
  const width = u16le(d, off);
  const height = u16le(d, off + 2);
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const byte = d[off + 4 + y] ?? 0;
    for (let x = 0; x < width; x++) {
      mask[y * width + x] = (byte >> (7 - x)) & 1; // MSB = píxel izquierdo
    }
  }
  return { code, width, height, mask };
}

/**
 * Decodifica PROPORT.PCS (YA descomprimido de LZW) en sus 91 glifos, mapeando
 * cada índice a su código ASCII (`0x20 + idx`).
 */
export function parseProport(decompressed: Uint8Array): ProportGlyph[] {
  const count = u16le(decompressed, 0);
  const glyphs: ProportGlyph[] = [];
  for (let i = 0; i < count; i++) {
    const off = u16le(decompressed, 2 + i * 2);
    if (off + 4 > decompressed.length) break;
    glyphs.push(unpackGlyph(decompressed, off, PROPORT_FIRST_CHAR + i));
  }
  return glyphs;
}

/** Manifiesto de la fuente proporcional: atlas RGBA + rects/anchos por carácter. */
export interface ProportFont {
  rgba: Uint8Array;
  width: number;
  height: number;
  /** Por índice de glifo: código ASCII, x en el atlas, ancho de avance. */
  glyphs: { code: number; x: number; width: number }[];
}

/**
 * Empaqueta los glifos en un atlas HORIZONTAL (tira de 8 px de alto) en BLANCO
 * sobre transparente + manifiesto de {code, x, width}. El runtime blitea cada
 * glifo por su rect y avanza `width` px (proporcional). Glifos de ancho 0 (espacio)
 * no ocupan atlas pero llevan su avance.
 */
export function packProportFont(glyphs: readonly ProportGlyph[]): ProportFont {
  const height = 8;
  const totalW = glyphs.reduce((s, g) => s + g.width, 0) || 1;
  const rgba = new Uint8Array(totalW * height * 4);
  const manifest: { code: number; x: number; width: number }[] = [];
  let x = 0;
  for (const g of glyphs) {
    manifest.push({ code: g.code, x, width: g.width });
    for (let gy = 0; gy < g.height; gy++) {
      for (let gx = 0; gx < g.width; gx++) {
        if (!g.mask[gy * g.width + gx]) continue;
        const o = (gy * totalW + x + gx) * 4;
        rgba[o] = 255;
        rgba[o + 1] = 255;
        rgba[o + 2] = 255;
        rgba[o + 3] = 255;
      }
    }
    x += g.width;
  }
  return { rgba, width: totalW, height, glyphs: manifest };
}
