/**
 * Parser de tiles de Ultima V (TILES.16 descomprimido).
 *
 * Formato (docs/formats/tiles-lzw.md §2):
 * - 512 tiles consecutivos de 16×16 px = 65536 bytes; 128 bytes/tile.
 * - 4bpp chunky packed: 2 píxeles por byte, row-major (izquierda→derecha).
 * - Nibble ALTO = píxel izquierdo, nibble BAJO = píxel derecho.
 *
 * Paleta: EGA canónica de 16 colores (docs §3, EGA_CANONICAL).
 */

export const TILE_SIZE = 16;
export const TILE_COUNT = 512;
const BYTES_PER_TILE = 128; // 16 filas × 8 bytes (2 px/byte)
const RGBA_PER_TILE = TILE_SIZE * TILE_SIZE * 4; // 1024

/**
 * FUENTE ÚNICA de la paleta EGA de U5 (índice 0..15 → RGB). Los assets de tiles
 * se generan a partir de esta tabla; el runtime consume el PNG resultante, no
 * una copia propia (el minimapa/viewgem usan colores artísticos por nombre de
 * tile, no índices EGA).
 *
 * Paleta EGA canónica del BIOS CON brown-fix: índice 6 = #AA5500 (marrón).
 * La adjudicación con witness runtime (re/notes/palette-idx6-verdict.md) mostró
 * que el original —renderizado por DOSBox-X— pinta idx6 MARRÓN #AA5500 (frames
 * reales par-iolohut-original.png: 16160 px marrón, 0 oliva). La tabla estática
 * DATA.OVL @0x52ee (reg6=0x06) se leyó bien pero su escritura al ATC nunca se
 * witnessó: "tabla leída ≠ paleta aplicada". SUPERSEDE la hipótesis oliva de #25.
 * Los otros 15 índices coinciden con el IRGB estándar.
 */
export const EGA_PALETTE: [number, number, number][] = [
  [0x00, 0x00, 0x00], // 0 negro
  [0x00, 0x00, 0xaa], // 1 azul
  [0x00, 0xaa, 0x00], // 2 verde
  [0x00, 0xaa, 0xaa], // 3 cian
  [0xaa, 0x00, 0x00], // 4 rojo
  [0xaa, 0x00, 0xaa], // 5 magenta
  [0xaa, 0x55, 0x00], // 6 marrón (EGA con brown-fix; palette-idx6-verdict.md)
  [0xaa, 0xaa, 0xaa], // 7 gris claro
  [0x55, 0x55, 0x55], // 8 gris oscuro
  [0x55, 0x55, 0xff], // 9 azul brillante
  [0x55, 0xff, 0x55], // 10 verde brillante
  [0x55, 0xff, 0xff], // 11 cian brillante
  [0xff, 0x55, 0x55], // 12 rojo brillante
  [0xff, 0x55, 0xff], // 13 magenta brillante
  [0xff, 0xff, 0x55], // 14 amarillo
  [0xff, 0xff, 0xff], // 15 blanco
];

/**
 * Convierte los 65536 bytes descomprimidos en 512 tiles RGBA de 16×16.
 * Cada tile de salida son 1024 bytes (16×16×4, alpha siempre 255).
 */
export function parseTiles(decompressed: Uint8Array): Uint8Array[] {
  const expected = TILE_COUNT * BYTES_PER_TILE;
  if (decompressed.length !== expected) {
    throw new Error(
      `parseTiles: se esperaban ${expected} bytes, llegaron ${decompressed.length}`,
    );
  }

  const tiles: Uint8Array[] = [];
  for (let t = 0; t < TILE_COUNT; t++) {
    const src = t * BYTES_PER_TILE;
    const rgba = new Uint8Array(RGBA_PER_TILE);
    for (let i = 0; i < BYTES_PER_TILE; i++) {
      const byte = decompressed[src + i]!;
      const hi = (byte >> 4) & 0x0f; // píxel izquierdo
      const lo = byte & 0x0f; // píxel derecho
      const px = i * 2; // índice del píxel izquierdo dentro del tile
      writePixel(rgba, px, hi);
      writePixel(rgba, px + 1, lo);
    }
    tiles.push(rgba);
  }
  return tiles;
}

function writePixel(rgba: Uint8Array, pixelIndex: number, colorIndex: number): void {
  const [r, g, b] = EGA_PALETTE[colorIndex]!;
  const o = pixelIndex * 4;
  rgba[o] = r;
  rgba[o + 1] = g;
  rgba[o + 2] = b;
  rgba[o + 3] = 255;
}

/**
 * Compone un atlas RGBA colocando los tiles en una rejilla de `cols` columnas.
 * Las filas restantes (si el número de tiles no llena la última fila) quedan
 * transparentes.
 */
export function tilesToAtlasRgba(
  tiles: Uint8Array[],
  cols: number,
): { rgba: Uint8Array; width: number; height: number } {
  if (cols < 1) throw new Error("tilesToAtlasRgba: cols debe ser >= 1");
  if (tiles.length === 0) throw new Error("tilesToAtlasRgba: sin tiles");

  // Todos los tiles deben ser cuadrados del mismo tamaño; lo derivamos del primero.
  const tilePixels = tiles[0]!.length / 4;
  const tileSize = Math.sqrt(tilePixels);
  if (!Number.isInteger(tileSize)) {
    throw new Error("tilesToAtlasRgba: tiles no cuadrados");
  }

  const rows = Math.ceil(tiles.length / cols);
  const width = cols * tileSize;
  const height = rows * tileSize;
  const rgba = new Uint8Array(width * height * 4);

  for (let t = 0; t < tiles.length; t++) {
    const tile = tiles[t]!;
    const col = t % cols;
    const row = Math.floor(t / cols);
    const ox = col * tileSize;
    const oy = row * tileSize;
    for (let y = 0; y < tileSize; y++) {
      const srcRow = y * tileSize * 4;
      const dstRow = ((oy + y) * width + ox) * 4;
      rgba.set(tile.subarray(srcRow, srcRow + tileSize * 4), dstRow);
    }
  }

  return { rgba, width, height };
}
