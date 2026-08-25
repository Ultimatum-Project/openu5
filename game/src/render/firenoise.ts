/**
 * Titileo de FUEGO (antorchas/braseros) — calco del bloque de "ruido de llama" de
 * `fn32` del EGA.DRV (`@0x23ba`, scout `flag-fire-anim-runtime.md` apéndice/adjudicación
 * `anim-composition-adjudication.md`). Es un mecanismo DISTINTO del swap de banderas
 * (`flagswap.ts`): NO son frames ni un swap de 2 estados, es RUIDO PROCEDURAL enmascarado.
 *
 * MECANISMO (por pasada del animador, INCONDICIONAL → titila 24/24, sin gate de bit):
 *   para cada pixel p del tile de fuego:  fuego[p] ^= ( ruidoPRNG[p] & mascara[p] )
 * donde:
 *  - `ruidoPRNG` = ruido del RNG LOCAL del driver (cs:0x1f94), fresco cada pasada
 *    (declarado: NO el `g_rng` de gameplay → render-seguro #17).
 *  - `mascara` = un TILE de forma-de-llama ESTÁTICO (0xc0-c3 etc.) que define QUÉ
 *    píxeles (y qué planos/bits) pueden parpadear — sólo la llama, no el candelabro.
 * El XOR es por-plano (bit a bit del índice EGA), equivalente por-píxel a
 * `idx ^= (noise & maskIdx)`. Estocástico ⇒ no hay "frame B" fijo; se valida por
 * parecido visual con el vídeo (L7). NADA de ciclar ids 0xb0→b3 (morfea).
 *
 * El fuego se COLOCA como tile estático (no es actor bytecode — adjudicación del scout);
 * su titileo es SÓLO esta capa fn32. Incluye la LLAMA AZUL 0xde (BlueFlame, máscara 0xc2).
 * OJO: el tile 0xdc NO es una hoguera — es el MOONGATE (MOONGATE_TILE=220), animado por su
 * propio carril (blit parcial 0x1112 + contador de subida [0x5887], `fiel/moongate.ts`), no
 * aquí. La "hoguera 0xdc" de notas previas fue un mislabel (0xdc=Moongate, 0xde=BlueFlame).
 */

/** Fuego → su tile-máscara de llama (medido por el scout, cuadra con el mapa 24/24). */
export const FIRE_MASKS: ReadonlyMap<number, number> = new Map([
  [0xb0, 0xc0],
  [0xb1, 0xc1],
  [0xb2, 0xc2],
  [0xb3, 0xc3],
  [0xbc, 0xcc],
  [0xbd, 0xcd],
  [0xbe, 0xce],
  [0xbf, 0xcf],
  [0xde, 0xc2],
]);

/** ¿Este tile es un fuego con titileo fn32? */
export function isFireTile(tile: number): boolean {
  return FIRE_MASKS.has(tile);
}

/**
 * Paleta EGA de U5 (canónica con brown-fix, `docs/formats/tiles-lzw.md §3`); el
 * atlas del port se genera con ESTA tabla, así que el mapeo RGBA↔índice es exacto.
 * El ruido de llama opera en espacio de ÍNDICE (el XOR es por-plano), así que hace
 * falta ida y vuelta índice↔RGBA.
 */
const EGA_U5: readonly [number, number, number][] = [
  [0x00, 0x00, 0x00], [0x00, 0x00, 0xaa], [0x00, 0xaa, 0x00], [0x00, 0xaa, 0xaa],
  [0xaa, 0x00, 0x00], [0xaa, 0x00, 0xaa], [0xaa, 0x55, 0x00], [0xaa, 0xaa, 0xaa],
  [0x55, 0x55, 0x55], [0x55, 0x55, 0xff], [0x55, 0xff, 0x55], [0x55, 0xff, 0xff],
  [0xff, 0x55, 0x55], [0xff, 0x55, 0xff], [0xff, 0xff, 0x55], [0xff, 0xff, 0xff],
];

const RGB_TO_IDX: ReadonlyMap<number, number> = new Map(
  EGA_U5.map(([r, g, b], i) => [(r << 16) | (g << 8) | b, i]),
);

/** RGBA (Uint8ClampedArray, 4 B/px) → índices EGA (Uint8Array, 1/px). Match exacto. */
export function rgbaToIndices(rgba: Uint8ClampedArray, out: Uint8Array): void {
  for (let p = 0; p < out.length; p++) {
    const o = p * 4;
    out[p] = RGB_TO_IDX.get((rgba[o]! << 16) | (rgba[o + 1]! << 8) | rgba[o + 2]!) ?? 0;
  }
}

/** Índices EGA → RGBA (opaco). Escribe en `rgba` (4 B/px). */
export function indicesToRgba(indices: Uint8Array, rgba: Uint8ClampedArray): void {
  for (let p = 0; p < indices.length; p++) {
    const [r, g, b] = EGA_U5[indices[p]!]!;
    const o = p * 4;
    rgba[o] = r;
    rgba[o + 1] = g;
    rgba[o + 2] = b;
    rgba[o + 3] = 255;
  }
}

/**
 * PRNG LOCAL del driver para el ruido de llama (mismo algoritmo que `flagswap`,
 * `ror3(seed+0x9248)^0x9248+0x11` de 16 bits) — declarado, no toca `g_rng`.
 */
export class FireNoisePrng {
  private s: number;
  constructor(seed = 0x1f94) {
    this.s = seed & 0xffff;
  }
  /** Siguiente nibble de ruido [0,15] (un índice EGA de 4 bits). */
  nextNibble(): number {
    let s = (this.s + 0x9248) & 0xffff;
    s = ((s >> 3) | (s << 13)) & 0xffff;
    s = (s ^ 0x9248) & 0xffff;
    this.s = (s + 0x11) & 0xffff;
    return this.s & 0x0f;
  }
}

/**
 * Aplica una pasada de ruido de llama a los índices EGA de un tile de fuego (16×16,
 * fila-mayor) IN PLACE, dado los índices de su máscara. Puro y testeable.
 * `out[p] = base[p] ^ (prng.nibble & mask[p])` — sólo cambian los píxeles donde la
 * máscara tiene bits (la llama); el candelabro (máscara 0) queda intacto.
 */
export function applyFireNoise(
  base: Uint8Array,
  mask: Uint8Array,
  out: Uint8Array,
  prng: FireNoisePrng,
): void {
  for (let p = 0; p < base.length; p++) {
    const m = mask[p]!;
    out[p] = m === 0 ? base[p]! : (base[p]! ^ (prng.nextNibble() & m)) & 0x0f;
  }
}
