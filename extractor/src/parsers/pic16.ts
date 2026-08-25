/**
 * Decoder de los CONTENEDORES de imagen .16 de la intro (CREATE.16, STORY*.16) —
 * las láminas de escena y los retratos de la cinemática (E1-S13c).
 *
 * FORMATO (DERIVADO Y CITADO del asm — ver `re/notes/intro-blit-formats.md §3.1`):
 *   - El fichero en disco es LZW (cabecera de 4 B de longitud; `decompressLzw`, el
 *     mismo contenedor que TILES.16/DNG*.16). Carga+descompresión =
 *     `kernel_load_dat_record` (kernel 0x256e, INTRO `call 0xffffa3ae`).
 *   - Tras LZW: un ARCHIVO de sub-imágenes:
 *       [u16 count][count × u32 offset]  (tabla de offsets al inicio de cada img)
 *       cada sub-imagen: [u16 width][u16 height][píxeles 4bpp]
 *   - Píxeles: 4bpp, 2 por byte (nibble ALTO = píxel izquierdo), índice EGA 0..15,
 *     sobre la paleta EGA de U5 (sin brown-fix). **CADA FILA ocupa un STRIDE de
 *     `ceil(w/8)·4` bytes** (ancho redondeado ARRIBA a múltiplo de 8 px, alineado a
 *     4 B); los px de padding (x ≥ w) se descartan. El blit lo hacen los wrappers
 *     `gfx_cmd_sel4b` (0x8b8c→kernel 0x0d4c, SEL 0x4b → EGA.DRV 0x12b4, láminas de
 *     escena) y `gfx_blit_sel66` (0x8d86→0x0f46, SEL 0x66, pantallas completas); el
 *     stride es propiedad del FICHERO descomprimido (no hay unpack software aparte).
 *
 * El STRIDE es el hallazgo del scout (#34/#36): la versión previa leía las filas
 * CONTIGUAS y sólo acertaba con `w%8==0` (láminas grandes); con anchos no-múltiplos
 * de 8 (símbolos de virtud CREATE img2-9, logo ULTIMA.16 319×61) cada fila se
 * desfasaba → "ruido". Verificado `span == ceil(w/8)·4·h` en 22/22 sub-imágenes.
 *
 * Evidencia: CREATE.16 = 11 imgs (retrato gitana img0 168×96, pebeteros/símbolos de
 * virtud img2-9). STORY1.16 = 3 imgs (img0 176×192 = cartón de escena). ULTIMA.16 =
 * 5 imgs (img0 319×61 = logo gótico "Ultima V"). Cabecera = 2+count·4 B.
 */

import { u16le } from "./binary.js";

/** Una sub-imagen decodificada: dimensiones + índices EGA por píxel (row-major). */
export interface Pic16Image {
  width: number;
  height: number;
  /** width*height índices EGA (0..15), row-major. */
  pixels: Uint8Array;
}

function u32le(d: Uint8Array, o: number): number {
  return (d[o]! | (d[o + 1]! << 8) | (d[o + 2]! << 16) | (d[o + 3]! << 24)) >>> 0;
}

/** Una entrada del atlas de intro: nombre lógico + rect en el atlas. */
export interface Pic16AtlasEntry {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Atlas empaquetado (RGBA) + manifiesto de rects para el runtime. */
export interface Pic16Atlas {
  rgba: Uint8Array;
  width: number;
  height: number;
  entries: Pic16AtlasEntry[];
}

/**
 * Empaqueta imágenes 4bpp (con su nombre lógico) en un atlas RGBA VERTICAL
 * (stack) + manifiesto. Simple y determinista: ancho = máx ancho, cada imagen
 * en su banda; el runtime blitea la región por nombre. `palette` = EGA de U5.
 */
export function packPic16Atlas(
  named: readonly { name: string; image: Pic16Image }[],
  palette: readonly (readonly [number, number, number])[],
): Pic16Atlas {
  const width = named.reduce((m, n) => Math.max(m, n.image.width), 1);
  const height = named.reduce((s, n) => s + n.image.height, 0) || 1;
  const rgba = new Uint8Array(width * height * 4);
  const entries: Pic16AtlasEntry[] = [];
  let y = 0;
  for (const { name, image } of named) {
    for (let py = 0; py < image.height; py++) {
      for (let px = 0; px < image.width; px++) {
        const idx = image.pixels[py * image.width + px]!;
        const c = palette[idx] ?? [0, 0, 0];
        const o = ((y + py) * width + px) * 4;
        rgba[o] = c[0]!;
        rgba[o + 1] = c[1]!;
        rgba[o + 2] = c[2]!;
        rgba[o + 3] = 255;
      }
    }
    entries.push({ name, x: 0, y, width: image.width, height: image.height });
    y += image.height;
  }
  return { rgba, width, height, entries };
}

/**
 * Desempaqueta una sub-imagen 4bpp con FILAS alineadas: cada fila ocupa
 * `stride = ceil(w/8)·4` bytes (ancho redondeado a múltiplo de 8 px, alineado a 4
 * B); los px de padding (x ≥ w) se descartan. nibble ALTO = píxel izquierdo.
 * (`intro-blit-formats.md §3.1`.)
 */
function unpackImage(d: Uint8Array, off: number): Pic16Image {
  const width = u16le(d, off);
  const height = u16le(d, off + 2);
  const pixels = new Uint8Array(width * height);
  const rowBytes = Math.ceil(width / 8) * 4; // fila alineada a 4 B (8 px)
  const base = off + 4;
  for (let y = 0; y < height; y++) {
    const rowOff = base + y * rowBytes;
    for (let x = 0; x < width; x++) {
      const byte = d[rowOff + (x >> 1)] ?? 0;
      pixels[y * width + x] = (x & 1) ? byte & 0x0f : (byte >> 4) & 0x0f;
    }
  }
  return { width, height, pixels };
}

/**
 * Decodifica el archivo .16 (YA descomprimido de LZW) en sus sub-imágenes. La
 * tabla de offsets al inicio delimita cada una; cada sub-imagen lleva su w/h.
 */
export function parsePic16(decompressed: Uint8Array): Pic16Image[] {
  const count = u16le(decompressed, 0);
  const images: Pic16Image[] = [];
  for (let i = 0; i < count; i++) {
    const off = u32le(decompressed, 2 + i * 4);
    if (off + 4 > decompressed.length) break;
    images.push(unpackImage(decompressed, off));
  }
  return images;
}
