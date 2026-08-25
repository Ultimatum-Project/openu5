/**
 * ORDEN de la DISOLUCIÓN a pantalla completa del ENDGAME (GAP 5, task #34) — CALCO.
 *
 * DERIVACIÓN CERRADA (endgame-derivation.md §F, carril dissolve-painter): la rutina
 * pintora real es **EGA.DRV fn34 (SEL 0x66) CLC @0x2570** — fizzle-fade de rect por
 * LFSR de GALOIS de anchura variable (tabla de taps 0x254d; full-screen 64000 px →
 * 16 bits, poly 0xB400), seed 1, `x=state%w, y=state/w`, skip fuera de rango, 1 píxel
 * por paso, y el píxel (0,0) al FINAL del ciclo. El disparo del endgame: ENDGAME.OVL
 * 0x004b empuja el rect (0,0,0x13f,0xc7) y llama al residente 0x0f46 con el backbuffer
 * NEGRO del teardown ⇒ el frame se deshace a negro píxel a píxel. (El modelo previo
 * usaba fn32 — era la pasada de ANIMACIÓN de tileset, no la pintora: aproximación
 * retirada. `visualLfsr.ts` queda re-asignado a llamas/ruido, su rol real.)
 *
 * Cadencia: el gate de crackle/delay/abort (cs:[0x253d]) queda apagado por el primer
 * draw de tile ⇒ la disolución del endgame es SILENCIOSA y a velocidad de I/O; la
 * cadencia visible (~2-3 s del testigo) es Clase-C de la piel, no de este orden.
 */
import { fizzlePolyForSize, fizzleStep } from "./fizzle.js";

/** Semilla del fizzle (fn34 arranca el LFSR en 1 — EGA.DRV 0x25c8). */
const ENDGAME_DISSOLVE_SEED = 1;

/**
 * Permutación de `count` índices de píxel en el orden EXACTO de fn34: secuencia del
 * LFSR de Galois (poly por ancho de count−1; estados 1..2^w−1 con skip >= count) y el
 * índice 0 al FINAL del ciclo, como el driver. Puro; O(2^w).
 */
export function endgameDissolveOrder(count: number, seed = ENDGAME_DISSOLVE_SEED): Uint32Array {
  const out = new Uint32Array(count);
  const poly = fizzlePolyForSize(count);
  let n = 0;
  let s = seed & 0xffff;
  const start = s;
  do {
    if (s < count && s !== 0 && n < count - 1) out[n++] = s;
    s = fizzleStep(s, poly);
  } while (s !== start && n < count - 1);
  out[n++] = 0; // píxel (0,0) al final del ciclo (fn34 @0x25f8)
  // Defensa determinista (poly no-maximal): completa ascendente lo no visitado.
  if (n < count) {
    const seen = new Uint8Array(count);
    for (let i = 0; i < n; i++) seen[out[i]!] = 1;
    for (let p = 0; p < count && n < count; p++) if (!seen[p]) out[n++] = p;
  }
  return out;
}
