/**
 * Parser de la fuente de juego IBM.CH de Ultima V.
 *
 * Formato (verificado byte a byte, re/notes/ui-text-layer.md §1):
 * - 128 glifos consecutivos de 8×8 px = 1024 bytes; 8 bytes/glifo.
 * - 1 bpp mono, 1 byte por fila (8 filas/glifo), MSB primero:
 *   bit 7 = píxel IZQUIERDO, bit 0 = píxel derecho.
 * - El kernel indexa el glifo como `char << 3` (0x16df) → offset = code·8; los
 *   códigos 0x80–0xFA se enmascaran a `code & 0x7F` (0x1787) y 0xFB–0xFF son
 *   códigos de control de atributo (no glifos). Por eso la tabla es de 128.
 *
 * Contraste de validación: glifo 'A' (0x41) @ off 0x208 = 1E 36 66 7E 66 66 C6 00.
 */

export const GLYPH_W = 8;
export const GLYPH_H = 8;
export const GLYPH_COUNT = 128;
export const BYTES_PER_GLYPH = 8;

const EXPECTED_BYTES = GLYPH_COUNT * BYTES_PER_GLYPH; // 1024

/**
 * Divide los 1024 bytes de IBM.CH en 128 glifos, cada uno un `Uint8Array` de 8
 * bytes (1 byte/fila; bit 7 = píxel más a la izquierda). Copia (no comparte
 * memoria con la entrada).
 */
export function parseFont(data: Uint8Array): Uint8Array[] {
  if (data.length !== EXPECTED_BYTES) {
    throw new Error(
      `parseFont: se esperaban ${EXPECTED_BYTES} bytes (IBM.CH), llegaron ${data.length}`,
    );
  }
  const glyphs: Uint8Array[] = [];
  for (let g = 0; g < GLYPH_COUNT; g++) {
    const src = g * BYTES_PER_GLYPH;
    glyphs.push(data.slice(src, src + BYTES_PER_GLYPH));
  }
  return glyphs;
}

/** ¿Está encendido el píxel (col,row) del glifo? (bit 7 = col 0, MSB primero). */
export function glyphPixel(glyph: Uint8Array, col: number, row: number): boolean {
  return (glyph[row]! & (0x80 >> col)) !== 0;
}

/**
 * Renderiza un glifo a un buffer RGBA de 8×8: píxel encendido = `fg` opaco,
 * apagado = transparente (alpha 0). El fondo transparente deja que la piel
 * componga el glifo sobre el color de ventana que toque (consola sobre negro,
 * etc.) y permite teñirlo.
 */
export function glyphToRgba(
  glyph: Uint8Array,
  fg: [number, number, number] = [0xff, 0xff, 0xff],
): Uint8Array {
  const rgba = new Uint8Array(GLYPH_W * GLYPH_H * 4);
  for (let row = 0; row < GLYPH_H; row++) {
    for (let col = 0; col < GLYPH_W; col++) {
      if (!glyphPixel(glyph, col, row)) continue; // transparente
      const o = (row * GLYPH_W + col) * 4;
      rgba[o] = fg[0];
      rgba[o + 1] = fg[1];
      rgba[o + 2] = fg[2];
      rgba[o + 3] = 255;
    }
  }
  return rgba;
}

/**
 * Compone el atlas RGBA de la fuente: `cols` glifos por fila (16 por defecto →
 * 128×64 px, rejilla 16×8). El código de glifo `c` cae en la celda
 * (c % cols, ⌊c / cols⌋); la piel lo mapea igual para blitear. Blanco sobre
 * transparente (tintable por la piel).
 */
export function fontToAtlasRgba(
  glyphs: Uint8Array[],
  cols = 16,
): { rgba: Uint8Array; width: number; height: number } {
  if (cols < 1) throw new Error("fontToAtlasRgba: cols debe ser >= 1");
  if (glyphs.length === 0) throw new Error("fontToAtlasRgba: sin glifos");

  const rows = Math.ceil(glyphs.length / cols);
  const width = cols * GLYPH_W;
  const height = rows * GLYPH_H;
  const rgba = new Uint8Array(width * height * 4);

  for (let g = 0; g < glyphs.length; g++) {
    const cell = glyphToRgba(glyphs[g]!);
    const ox = (g % cols) * GLYPH_W;
    const oy = Math.floor(g / cols) * GLYPH_H;
    for (let y = 0; y < GLYPH_H; y++) {
      const srcRow = y * GLYPH_W * 4;
      const dstRow = ((oy + y) * width + ox) * 4;
      rgba.set(cell.subarray(srcRow, srcRow + GLYPH_W * 4), dstRow);
    }
  }
  return { rgba, width, height };
}
