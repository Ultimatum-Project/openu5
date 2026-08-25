/**
 * Píxel-swap de banderas de estructura del overworld — calco de la rutina `fn32`
 * del EGA.DRV (selector 0x60, `@0x243a`) que el original llama en CADA pasada del
 * animador (`0x6fd6`, cola de `0x4552`). Ver `re/notes/flag-fire-anim-runtime.md`.
 *
 * MECANISMO: `fn32` muta el BITMAP del tile EN EL ATLAS (no en el dibujado; el blit
 * `fn27` es crudo). Cada pasada, si el bit asignado de una **semilla RNG LOCAL del
 * driver** (`cs:0x1f94`, privada, NO el `g_rng` de gameplay → render-segura per #17)
 * está a 1, intercambia dos bloques del bitmap del tile — un SWAP auto-inverso, así
 * que la bandera va y viene (ondea). Es una mutación GLOBAL del atlas: todas las
 * instancias del tile en pantalla comparten el mismo frame.
 *
 * Formato del tile: TILES.16 es CHUNKY 4bpp, 8 B/fila (2 px/byte), 16 filas
 * (`docs/formats/tiles-lzw.md §2`) ⇒ los offsets de byte del swap mapean a FILAS de
 * píxeles: `[0:8)↔[16:24)` = fila 0 ↔ fila 2; `[16:20)↔[32:36)` = mitad izq (px 0-7)
 * de la fila 2 ↔ fila 4. Verificado: el par produce el ondeo del gallardete en
 * 0x14/0x15 (contrastado con los frames en vivo del scout).
 *
 * Estructuras que animan (medido, 24 ticks): 0x12 Keep (bit0), 0x14 SmallCastle
 * (bit1), 0x15 LargeCastle (bit2), 0x3e gallardete de Lord British (bit3). Village
 * 0x13 y Lighthouse 0x1b son ESTÁTICAS; el resto del castillo de LB (0x3a-0x3f) es
 * mosaico estático (sólo su gallardete 0x3e ondea, por este mismo swap fn32).
 */

/** Especificación de swap de una bandera: tile, bit de semilla, y filas a permutar. */
export interface FlagSwap {
  /** id de tile del atlas. */
  tile: number;
  /** bit de la semilla local que gatea el swap esta pasada. */
  bit: number;
  /** filas de píxel a intercambiar (chunky, 8 B/fila). */
  rowA: number;
  rowB: number;
  /** rango de columnas [xlo,xhi) a permutar (izq-mitad = 0..8 para el swap de 4 B). */
  xlo: number;
  xhi: number;
}

/**
 * Las 3 banderas animadas y su swap (offsets de byte de `fn32` traducidos a filas
 * chunky). Village 0x13 y faro 0x1b NO están → estáticas (fiel).
 */
export const FLAG_SWAPS: readonly FlagSwap[] = [
  { tile: 0x12, bit: 0, rowA: 0, rowB: 2, xlo: 0, xhi: 16 }, // Keep       — swap 8 B [0:8)↔[16:24)
  { tile: 0x14, bit: 1, rowA: 2, rowB: 4, xlo: 0, xhi: 8 }, //  SmallCastle — swap 4 B [16:20)↔[32:36)
  { tile: 0x15, bit: 2, rowA: 0, rowB: 2, xlo: 0, xhi: 16 }, // LargeCastle — swap 8 B [0:8)↔[16:24)
  // Gallardete de LORD BRITISH (tile 0x3e del mosaico CastleBritian): `fn32` en
  // si=0x1f00 (=0x3e·128), swap 8 B, gate bit3 (scout `flag-fire-anim-runtime.md`
  // línea 2470). El resto del castillo (0x3a-0x3f) es mosaico ESTÁTICO — sólo el
  // gallardete azul (filas 0-2) ondea, no el ciclo de bytecode (que morfearía).
  { tile: 0x3e, bit: 3, rowA: 0, rowB: 2, xlo: 0, xhi: 16 }, // LB pennant — swap 8 B [0:8)↔[16:24)
];

const TILE_W = 16;

/**
 * PRNG LOCAL del driver (`cs:0x1f94`): `seed = (ror3(seed+0x9248) ^ 0x9248) + 0x11`
 * en 16 bits — mismo algoritmo que el RNG del kernel `0x2092` pero SEMILLA SEPARADA
 * (declarado: NO consume ni desalinea `g_rng_seed`, render-seguro per #17).
 */
export function advanceDrvSeed(seed: number): number {
  let s = (seed + 0x9248) & 0xffff;
  s = ((s >> 3) | (s << 13)) & 0xffff; // ror3 en 16 bits
  s = (s ^ 0x9248) & 0xffff;
  return (s + 0x11) & 0xffff;
}

/**
 * Estado de flutter de las banderas (semilla local + paridad de swap por tile).
 * Cada `tick()` (una pasada del animador, ~110 ms): para cada bandera, si su bit de
 * la semilla actual está a 1, invierte su paridad (el swap es auto-inverso); luego
 * avanza la semilla. `isSwapped(tile)` = ¿mostrar el frame B (permutado)?
 */
export class FlagSwapRunner {
  private seed: number;
  private readonly parity = new Map<number, boolean>();

  constructor(seed = 0x1f94) {
    this.seed = seed & 0xffff;
    for (const f of FLAG_SWAPS) this.parity.set(f.tile, false);
  }

  tick(): void {
    for (const f of FLAG_SWAPS) {
      if (this.seed & (1 << f.bit)) this.parity.set(f.tile, !this.parity.get(f.tile));
    }
    this.seed = advanceDrvSeed(this.seed);
  }

  /** ¿El tile muestra ahora el frame B (bitmap permutado)? */
  isSwapped(tile: number): boolean {
    return this.parity.get(tile) ?? false;
  }
}

/** ¿Este tile es una bandera con swap? (para el fast-path del render). */
export function flagSwapFor(tile: number): FlagSwap | undefined {
  return FLAG_SWAPS.find((f) => f.tile === tile);
}

/**
 * Aplica el swap de filas de una bandera a un tile RGBA 16×16 (Uint8ClampedArray,
 * 4 B/px, row-major) IN PLACE. Puro y testeable (sin DOM). Auto-inverso: aplicarlo
 * dos veces vuelve al original.
 */
export function applyFlagSwap(rgba: Uint8ClampedArray, swap: FlagSwap): void {
  for (let x = swap.xlo; x < swap.xhi; x++) {
    const ia = (swap.rowA * TILE_W + x) * 4;
    const ib = (swap.rowB * TILE_W + x) * 4;
    for (let k = 0; k < 4; k++) {
      const t = rgba[ia + k]!;
      rgba[ia + k] = rgba[ib + k]!;
      rgba[ib + k] = t;
    }
  }
}
