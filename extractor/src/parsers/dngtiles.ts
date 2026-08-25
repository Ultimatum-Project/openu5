/**
 * Parser del PACK DE PERSPECTIVA de mazmorra (DNG1/DNG2/DNG3.16 descomprimidos).
 *
 * Estos ficheros NO son el atlas 16×16 de TILES.16: son los BITMAPS de las
 * rodajas de pared en perspectiva que el renderer first-person de DNGLOOK.OVL
 * blitea para componer el pasillo (re/notes/dnglook-raster-spec.md §2, §3). Los
 * tres comparten estructura idéntica (mismo número de imágenes y anchos) y son
 * tres VARIANTES de textura de muro que el juego elige por mazmorra: DNG1 = oliva,
 * DNG2 = rojiza, DNG3 = piedra gris (verificado visualmente en la extracción).
 *
 * Contenedor (tras el LZW, cada .16 descomprime a 54666 B):
 * - `u16` count (= 28 ranuras).
 * - `count` × `u32` LE: offset de cada imagen dentro del blob (0 = ranura vacía).
 * - cada imagen: `u16` width, `u16` height (= 164 en todas), y luego
 *   `width/2 × height` bytes 4bpp packed, row-major, nibble ALTO = píxel izquierdo
 *   (misma convención de pixelado que TILES.16, tiles.ts).
 *
 * Verificación de tamaño por imagen: `4 + width/2 × 164` == hueco al siguiente
 * offset (p.ej. 24×164 → 4 + 12·164 = 1972 B). Anchos observados: 8/16/24/32/56/80.
 */
import { EGA_PALETTE } from "./tiles.js";

/** Altura fija (px) de toda rodaja de perspectiva del pack. */
export const DNG_VIEW_HEIGHT = 164;
/** Número de ranuras de imagen del contenedor (28; 2 nulas: índices 8 y 24). */
export const DNG_VIEW_COUNT = 28;

export interface DngViewImage {
  width: number;
  height: number;
  /** RGBA `width*height*4`, alpha siempre 255 (índice 0 = negro opaco). */
  rgba: Uint8Array;
}

/**
 * Descompone el blob descomprimido de un DNGn.16 en sus imágenes de perspectiva.
 * Las ranuras vacías (offset 0) devuelven `null` para conservar el índice.
 */
export function parseDngView(dec: Uint8Array): (DngViewImage | null)[] {
  const u16 = (o: number): number => dec[o]! | (dec[o + 1]! << 8);
  const u32 = (o: number): number =>
    (dec[o]! | (dec[o + 1]! << 8) | (dec[o + 2]! << 16) | (dec[o + 3]! << 24)) >>> 0;

  const count = u16(0);
  if (count < 1 || count > 256) {
    throw new Error(`parseDngView: count improbable (${count})`);
  }
  const tableEnd = 2 + count * 4;

  const images: (DngViewImage | null)[] = [];
  for (let i = 0; i < count; i++) {
    const off = u32(2 + i * 4);
    if (off === 0) {
      images.push(null);
      continue;
    }
    if (off < tableEnd || off + 4 > dec.length) {
      throw new Error(`parseDngView: offset fuera de rango en imagen ${i} (${off})`);
    }
    const width = u16(off);
    const height = u16(off + 2);
    const rowBytes = width >> 1; // 4bpp: 2 px/byte
    const needed = 4 + rowBytes * height;
    if (width < 1 || (width & 1) !== 0 || height < 1 || off + needed > dec.length) {
      throw new Error(
        `parseDngView: dimensiones inválidas en imagen ${i} (${width}×${height})`,
      );
    }

    const rgba = new Uint8Array(width * height * 4);
    let src = off + 4;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x += 2) {
        const byte = dec[src++]!;
        writePixel(rgba, y * width + x, (byte >> 4) & 0x0f);
        writePixel(rgba, y * width + x + 1, byte & 0x0f);
      }
    }
    images.push({ width, height, rgba });
  }
  return images;
}

/**
 * Parser de ITEMS.16 (banco de FEATURES en perspectiva, handle a9c4 del binario:
 * `dng_blit_piece` rama cercana @DUNGEON:0x1431/0x1442). El contenedor son **20
 * PARES (offImagen, offMáscara-AND) de u16** — mismo esquema que MON*.16: tabla
 * en `2 + i·4` (imagen) / `2 + i·4 + 2` (máscara). Cada entrada lleva cabecera
 * `u16 width, u16 height`; la imagen es 4bpp packed (nibble ALTO = píxel izq.,
 * como TILES.16) y la máscara **1bpp MSB-first** (`width/8` B/fila) con cabecera
 * idéntica a la de su imagen (verificado: los 20 pares casan w×h y size==gap).
 *
 * Semántica AND/OR del blit EGA: pantalla = (pantalla AND máscara) OR imagen →
 * bit de máscara **1 = conserva fondo (transparente)**, **0 = píxel del sprite**
 * (aunque su color sea 0: el interior NEGRO del cofre abierto es OPACO). Por eso
 * la transparencia sale de la MÁSCARA, no del keying color-0. Aquí se HORNEA en
 * el alpha del RGBA (255 opaco / 0 transparente).
 *
 * Las 20 imágenes reales (careo decor-mazmorra, ITEMS.16 re-parseado):
 * 0-3 escalera, 4-7 fuente, 8-11 trampa, 12-15 cofre cerrado, 16-19 cofre
 * abierto — cada grupo a 4 profundidades (la más cercana primero).
 */
export function parseItemsView(dec: Uint8Array): (DngViewImage | null)[] {
  const u16 = (o: number): number => dec[o]! | (dec[o + 1]! << 8);
  const count = u16(0);
  if (count < 1 || count > 256) throw new Error(`parseItemsView: count improbable (${count})`);
  const tableEnd = 2 + count * 4;

  const images: (DngViewImage | null)[] = [];
  for (let i = 0; i < count; i++) {
    const offImg = u16(2 + i * 4);
    const offMask = u16(2 + i * 4 + 2);
    if (offImg === 0) {
      images.push(null);
      continue;
    }
    if (offImg < tableEnd || offImg + 4 > dec.length || offMask < tableEnd || offMask + 4 > dec.length) {
      throw new Error(`parseItemsView: offset fuera de rango en imagen ${i} (${offImg}/${offMask})`);
    }
    const width = u16(offImg);
    const height = u16(offImg + 2);
    const rowBytes = width >> 1; // imagen 4bpp: 2 px/byte
    if (width < 1 || (width & 7) !== 0 || height < 1 || offImg + 4 + rowBytes * height > dec.length) {
      throw new Error(`parseItemsView: dimensiones inválidas en imagen ${i} (${width}×${height})`);
    }
    // La máscara repite la cabecera w×h de su imagen (invariante del contenedor).
    if (u16(offMask) !== width || u16(offMask + 2) !== height) {
      throw new Error(
        `parseItemsView: cabecera de máscara no casa en imagen ${i} ` +
          `(${u16(offMask)}×${u16(offMask + 2)} vs ${width}×${height})`,
      );
    }
    const maskRowBytes = width >> 3; // máscara 1bpp: 8 px/byte
    if (offMask + 4 + maskRowBytes * height > dec.length) {
      throw new Error(`parseItemsView: máscara fuera de rango en imagen ${i}`);
    }

    const rgba = new Uint8Array(width * height * 4);
    let src = offImg + 4;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x += 2) {
        const byte = dec[src++]!;
        writePixel(rgba, y * width + x, (byte >> 4) & 0x0f);
        writePixel(rgba, y * width + x + 1, byte & 0x0f);
      }
      // Alpha por MÁSCARA AND (1bpp MSB-first): bit 1 = fondo (alpha 0).
      for (let x = 0; x < width; x++) {
        const mByte = dec[offMask + 4 + y * maskRowBytes + (x >> 3)]!;
        const transparent = (mByte >> (7 - (x & 7))) & 1;
        rgba[(y * width + x) * 4 + 3] = transparent ? 0 : 255;
      }
    }
    images.push({ width, height, rgba });
  }
  return images;
}

function writePixel(rgba: Uint8Array, pixelIndex: number, colorIndex: number): void {
  const [r, g, b] = EGA_PALETTE[colorIndex]!;
  const o = pixelIndex * 4;
  rgba[o] = r;
  rgba[o + 1] = g;
  rgba[o + 2] = b;
  rgba[o + 3] = 255;
}

/** Rectángulo de una imagen dentro del atlas (px). */
export interface AtlasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DngAtlas {
  rgba: Uint8Array;
  width: number;
  height: number;
  /** Metadatos para que la piel blitee sub-rectángulos por variante e índice. */
  meta: {
    height: number;
    count: number;
    /** Una entrada por variante (DNG1/2/3), en orden. */
    variants: { name: string; rects: (AtlasRect | null)[] }[];
  };
}

/**
 * Empaqueta varias variantes (cada una = las 28 imágenes de un DNGn.16) en un
 * único atlas RGBA: una FILA por variante (y = v·164), imágenes concatenadas a su
 * ancho natural de izquierda a derecha; las ranuras nulas se saltan y su rect es
 * `null`. Devuelve el atlas + los rects para el runtime.
 */
export function dngViewsToAtlas(
  variants: { name: string; images: (DngViewImage | null)[] }[],
): DngAtlas {
  if (variants.length === 0) throw new Error("dngViewsToAtlas: sin variantes");
  const height = DNG_VIEW_HEIGHT;

  // Ancho del atlas = máximo ancho de fila entre variantes.
  let atlasW = 0;
  for (const v of variants) {
    let rowW = 0;
    for (const im of v.images) if (im) rowW += im.width;
    atlasW = Math.max(atlasW, rowW);
  }
  const atlasH = variants.length * height;
  const rgba = new Uint8Array(atlasW * atlasH * 4);

  const metaVariants: { name: string; rects: (AtlasRect | null)[] }[] = [];
  variants.forEach((v, vi) => {
    const rowY = vi * height;
    let x = 0;
    const rects: (AtlasRect | null)[] = [];
    for (const im of v.images) {
      if (!im) {
        rects.push(null);
        continue;
      }
      blit(rgba, atlasW, im, x, rowY);
      rects.push({ x, y: rowY, w: im.width, h: im.height });
      x += im.width;
    }
    metaVariants.push({ name: v.name, rects });
  });

  return {
    rgba,
    width: atlasW,
    height: atlasH,
    meta: { height, count: variants[0]!.images.length, variants: metaVariants },
  };
}

function blit(
  dst: Uint8Array,
  dstW: number,
  im: DngViewImage,
  ox: number,
  oy: number,
): void {
  for (let y = 0; y < im.height; y++) {
    const srcRow = y * im.width * 4;
    const dstRow = ((oy + y) * dstW + ox) * 4;
    dst.set(im.rgba.subarray(srcRow, srcRow + im.width * 4), dstRow);
  }
}
