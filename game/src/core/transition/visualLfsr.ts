/**
 * PRNG/permutación VISUAL de las transiciones de pantalla EGA — calco byte-exacto del
 * paso de EGA.DRV fn32 (sel 0x60, revelado planar; `re/disasm/EGA.DRV.asm` 0x1fa8-0x1fbb):
 *
 *   ax = state (cs:[0x1f94])
 *   ax += 0x9248            ; 0x1fac add ax, 0x9248
 *   ax = ror16(ax, 3)       ; 0x1faf-0x1fb3 ror ax,1 ×3 (rotate right 16-bit por 3)
 *   ax ^= 0x9248            ; 0x1fb5 xor ax, 0x9248
 *   ax += 0x11             ; 0x1fb8 add ax, 0x11
 *   state = ax             ; 0x1fbb
 *
 * ⚠ NO es un LFSR de tap clásico pese al nombre del brief — es un revoltijo determinista
 * de 16 bits (add/ror/xor/add). Lo llamamos "LFSR visual" por continuidad con lote-C. Es
 * PURO y SEPARADO del `g_rng` de simulación (0 gameplay): sólo permuta el orden de revelado
 * de píxeles/columnas de la transición. Determinista ⇒ CALCO EXACTO, no aproximación.
 *
 * El byte BAJO (`al`) es el que el driver usa por columna/píxel (0x1fbf `mov [si+3], al`…).
 */

const POLY = 0x9248;
const MASK16 = 0xffff;

/** Rotación derecha de 16 bits (calco de `ror ax,1` ×n). */
export function ror16(value: number, count: number): number {
  const v = value & MASK16;
  const c = count & 15;
  return ((v >>> c) | (v << (16 - c))) & MASK16;
}

/**
 * Un paso del revoltijo visual EGA (0x1fa8-0x1fbb). `state` y el retorno son words de 16
 * bits. Byte-exacto: `next = ((ror16(state + 0x9248, 3) ^ 0x9248) + 0x11) & 0xffff`.
 */
export function nextVisualState(state: number): number {
  let ax = (state + POLY) & MASK16; // add ax, 0x9248
  ax = ror16(ax, 3); // ror ax,1 ×3
  ax = (ax ^ POLY) & MASK16; // xor ax, 0x9248
  ax = (ax + 0x11) & MASK16; // add ax, 0x11
  return ax;
}

/** El byte que el driver consume por columna/píxel = `al` (byte bajo del state). */
export function visualByte(state: number): number {
  return state & 0xff;
}

/**
 * Genera la secuencia de `count` states a partir de `seed` (el primer valor emitido es el
 * de aplicar UN paso a `seed`, como el driver: lee state, lo avanza, usa `al`). Devuelve los
 * states completos (16 bits); usa `visualByte` para el byte por columna.
 */
export function visualSequence(seed: number, count: number): number[] {
  const out: number[] = [];
  let s = seed & MASK16;
  for (let i = 0; i < count; i++) {
    s = nextVisualState(s);
    out.push(s);
  }
  return out;
}
