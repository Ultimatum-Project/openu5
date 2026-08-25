/**
 * Animación del AGUA — calco de la capa `fn32` del EGA.DRV (@0x1fe6-0x23b7, ANTES
 * del bloque de fuego 0x23ba y del swap de banderas 0x243a). Ver
 * `re/notes/water-anim-audit.md` (spec derivado del disasm).
 *
 * Es una capa DISTINTA del reloj maestro `0x44b8` (ciclo de tile-id: cascada 0xd4-d7,
 * fuente 0xd8-db) y de las otras capas fn32 (`flagswap.ts` banderas, `firenoise.ts`
 * fuego). El agua tiene DOS submecanismos, ambos DETERMINISTAS (sin RNG):
 *
 *  B. SCROLL (0x1fe6-0x20b0): scroll vertical CIRCULAR de 1 fila (8 B = 16 px de
 *     ancho) hacia ABAJO cada pasada, incondicional (24/24), sobre los tiles base de
 *     agua/lava: 0x01 Water1, 0x02 Water2, 0x03 WaterCoast, 0x8f Lava. Tras 16
 *     pasadas vuelve al bitmap original.
 *
 *  C. COMPOSITE (0x20b2-0x23b7): compone el agua 0x03 (que YA scrolleó en B — el
 *     orden importa) dentro del canal de ríos/costa/esquinas, vía una máscara de canal
 *     ESTÁTICA (plano-3/intensidad de un tile-máscara). Por píxel:
 *        frame[p] = mask[p] ? water03_scrolled[p] : tileEstático[p]
 *     Derivado del blit enmascarado del DRV `T = (bank AND notMask) OR (water AND mask)`
 *     (el `not` sobre la máscara se aplica y revierte en la pasada → máscara estática).
 *
 * Puro y sin PixiJS: opera sobre RGBA (Uint8ClampedArray, 4 B/px, row-major, 16×16),
 * apto para la piel fiel (canvas 2D). El scroll de filas es idéntico en RGBA o planar
 * (mueve filas enteras), así que es fiel byte-a-byte al efecto del DRV.
 */
import { rgbaToIndices } from "./firenoise.js";

const TILE_W = 16;
const TILE_H = 16;
const ROW_BYTES = TILE_W * 4;

/** Tiles base con SCROLL (mecanismo B). Offsets atlas 0x80/0x100/0x180/0x4780. */
export const WATER_SCROLL_TILES: readonly number[] = [0x01, 0x02, 0x03, 0x8f];

/** El tile-fuente que la capa COMPOSITE inyecta en los canales (agua costera 0x03). */
export const WATER_SOURCE_TILE = 0x03;

/** ¿Este tile lleva scroll fn32 (mecanismo B)? */
export function isWaterScrollTile(tile: number): boolean {
  return WATER_SCROLL_TILES.includes(tile);
}

/**
 * Tiles de CANAL (mecanismo C) → su tile-máscara (fn32 lee el plano-3 del máscara
 * como forma del canal). Ríos 0x60-0x6f (máscaras 0x70-0x7f), costa 0x34-0x37 y
 * esquinas 0xe4-0xe7 (máscaras 0xd0-0xd3). Los bloques extendidos de combate
 * (0x108/0x1b4 con ruido) quedan fuera de alcance overworld (diferidos).
 */
export const WATER_COMPOSITE_MASKS: ReadonlyMap<number, number> = new Map([
  // Ríos + puentes de troll: 0x60-0x6f → 0x70-0x7f (bloque asm 0x20b2, cx=16).
  ...Array.from({ length: 16 }, (_, i) => [0x60 + i, 0x70 + i] as [number, number]),
  // Costa exterior: 0x34-0x37 → 0xd0-0xd3 (bloque asm 0x2259, cx=4).
  ...Array.from({ length: 4 }, (_, i) => [0x34 + i, 0xd0 + i] as [number, number]),
  // Esquinas con agua: 0xe4-0xe7 → 0xd0-0xd3 (bloque asm 0x2308, cx=4).
  ...Array.from({ length: 4 }, (_, i) => [0xe4 + i, 0xd0 + i] as [number, number]),
]);

/** ¿Este tile es un canal compuesto (mecanismo C)? */
export function isWaterCompositeTile(tile: number): boolean {
  return WATER_COMPOSITE_MASKS.has(tile);
}

/**
 * Orden de FILAS del atlas `water-xbrz.png` pre-horneado (piel shader, task
 * water-look): todos los tiles de agua (scroll + composite) DEDUPLICADOS y
 * ORDENADOS ascendente. DEBE casar byte-a-byte con el horneador
 * `game/tools/water-xbrz/bake_water_xbrz.py` (`sorted(set(scroll + composite))`),
 * o la piel bliteará el tile equivocado. La fila de un tile de agua = su índice aquí.
 */
export function bakedWaterTileOrder(): readonly number[] {
  const set = new Set<number>([...WATER_SCROLL_TILES, ...WATER_COMPOSITE_MASKS.keys()]);
  return [...set].sort((a, b) => a - b);
}

/**
 * Scroll vertical CIRCULAR de un tile RGBA 16×16 `offset` filas hacia ABAJO
 * (`out[fila r] = base[fila (r - offset) mod 16]`; la fila 15 va a la 0). Calco del
 * bloque de scroll de `fn32` (salva la última fila, corre 0..14 → 1..15, restaura).
 * Puro; `base` y `out` son Uint8ClampedArray de 16·16·4 B.
 */
export function scrollRowsDown(
  base: Uint8ClampedArray,
  offset: number,
  out: Uint8ClampedArray,
): void {
  const off = ((offset % TILE_H) + TILE_H) % TILE_H;
  for (let r = 0; r < TILE_H; r++) {
    const src = ((r - off) % TILE_H + TILE_H) % TILE_H;
    const s = src * ROW_BYTES;
    const d = r * ROW_BYTES;
    for (let k = 0; k < ROW_BYTES; k++) out[d + k] = base[s + k]!;
  }
}

/**
 * Máscara de canal (1 = agua/canal, 0 = orilla) de un tile-máscara RGBA 16×16:
 * el bit de INTENSIDAD (plano 3, bit3 del índice EGA) de cada píxel, como usa `fn32`
 * (`and [si+3]` = plano 3, difundido a los 4 planos). Devuelve Uint8Array de 256.
 */
export function channelMaskFromTile(maskRgba: Uint8ClampedArray): Uint8Array {
  const idx = new Uint8Array(TILE_W * TILE_H);
  rgbaToIndices(maskRgba, idx);
  const mask = new Uint8Array(TILE_W * TILE_H);
  for (let p = 0; p < mask.length; p++) mask[p] = (idx[p]! >> 3) & 1;
  return mask;
}

/**
 * Compone el canal: `out[p] = mask[p] ? water[p] : bank[p]` (por píxel RGBA). `bank`
 * = tile de canal estático (orilla), `water` = agua 0x03 ya scrolleada, `mask` =
 * forma del canal (`channelMaskFromTile`). Puro; RGBA 16·16·4 B, mask de 256.
 */
export function compositeChannel(
  bank: Uint8ClampedArray,
  water: Uint8ClampedArray,
  mask: Uint8Array,
  out: Uint8ClampedArray,
): void {
  for (let p = 0; p < mask.length; p++) {
    const o = p * 4;
    const src = mask[p] ? water : bank;
    out[o] = src[o]!;
    out[o + 1] = src[o + 1]!;
    out[o + 2] = src[o + 2]!;
    out[o + 3] = src[o + 3]!;
  }
}
