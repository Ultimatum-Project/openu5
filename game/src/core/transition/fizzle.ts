/**
 * FIZZLE-FADE de pantalla EGA (fn34, sel 0x66) — LFSR de Galois clásico, calco byte-exacto
 * de EGA.DRV (`re/disasm/EGA.DRV.asm`): a diferencia del "revoltijo" de fn32 (visualLfsr.ts),
 * esto SÍ es un LFSR de taps maximal-length que visita cada valor 1..(2^w−1) exactamente una
 * vez → el ORDEN de revelado de píxeles del fizzle.
 *
 * Paso (0x25ec-0x25fe): estado inicial 1; por iteración:
 *   lsb = state & 1; state >>= 1; if (lsb) state ^= poly;   // shr + xor condicional por carry
 * hasta que state vuelve a 1 (periodo completo). El `poly` se elige por el ANCHO EN BITS del
 * tamaño de la región (0x2599-0x25a9 cuenta los bits y hace `cs:[bx·2 + 0x254d]`).
 *
 * CABLEADO (parcial) — y el disparador NO resiste el análisis estático. La cabecera previa
 * decía "SIN CABLEAR … 0 callers": las dos mitades eran falsas y quedan retiradas aquí.
 *
 * · Callers del residente 0x0f46 — SEIS, no cero. Medidos por BANDA (`callers_por_banda.py`,
 *   control positivo de 0x7a8e en verde: 3 por banda, 0 por grep): BLCKTHRN.OVL 0x098c y
 *   0x0bfa, ENDGAME.OVL 0x004b, INTRO.OVL 0x037e y 0x060c, SJOG.OVL 0x08af. El cero anterior
 *   era artefacto del censo por grep sobre el texto del disasm, que no resuelve el sesgo
 *   near-call inter-overlay (#158/#173). Los seis empujan un rect LITERAL, legible en el
 *   sitio: no hay pregunta que mande a DOSBox. Identidad y rects, ya cerrados en el ledger
 *   bajo `fx_rect_dissolve` (`re/ledger/frontier.json`).
 *
 * · Este módulo SÍ corre hoy, por UNO de los seis: ENDGAME 0x004b (rect 0,0,0x13f,0xc7 =
 *   pantalla entera). Cadena viva extremo a extremo — `endgameDissolve.ts:18` (importa
 *   `fizzlePolyForSize`/`fizzleStep`) → `ui/endgame-pacer.ts:174` → `skin/fiel/skin.ts:70`
 *   y 2628 → `skin/fiel/endgame-frame.ts:473`, alcanzable desde `main.ts:61` y 744. La
 *   entrada `16: 0xb400` de abajo es de ese consumidor, no de un hueco.
 *
 * · Los otros CINCO no pasan por aquí (censo de importadores: los únicos son
 *   `endgameDissolve.ts` y `game/tests/fizzle.test.ts`). BLCKTHRN ×2 y SJOG pintan el
 *   VIEWPORT (rect 8,8,0xb7,0xb7) y no tienen consumidor en el port. El fizzlefade del
 *   intro tiene implementación PROPIA y distinta —barajado Fisher-Yates sembrado,
 *   `ui/faithful-intro.ts:416` y `skin/fiel/introAnim.ts:44`—, que NO es este LFSR: si
 *   alguna vez se quiere el intro byte-exacto, ese es el trabajo, y es de derivación.
 *
 * HIGIENE DE CATÁLOGO — ADJUDICADA (30-07-2026, carril docs/audit-resto). El offset 0x0f46
 * arrastra TRES nombres vivos: `fx_rect_dissolve` (`frontier.json`, `coverage-depth.md:605`),
 * `gfx_blit_sel66` (`coverage.json` segmento 33, `kernel-sweep-4.md:229`) y "fizzle" (este
 * módulo). Los dos del ledger apuntan al MISMO cuerpo —`ULTIMA.EXE` start 3910, tamaño 40 en
 * las dos fichas— y NO son identidades rivales: son el mismo sitio nombrado a DOS ALTURAS.
 * Leídos los 40 bytes, la rutina es un envoltorio de driver y nada más: prólogo, `push si/di/ds`,
 * los 4 argumentos a dx/cx/bx/ax, `call 0x8e6`, `clc`, `mov [g_snd_driver_fn], 0x66`,
 * `lcall`, `ret 8`. NO hay LFSR ni disolución en este cuerpo — el efecto vive en el handler
 * del selector 0x66 del driver. O sea: `gfx_blit_sel66` nombra lo que la rutina ES, y
 * `fx_rect_dissolve` nombra lo que el driver HACE cuando se le entra por ahí con `clc`.
 * Ranura neutral: el sentido lo pone el productor, no el envoltorio.
 * NO se renombra ninguna ficha: los dos nombres son ciertos en su altura, y una sustitución
 * global rompería el repo (CAST y TALK tienen su propio 0x0f46, ajeno a éste).
 *
 * ⚠ TRAMPA AL VERIFICARLO: en el disasm NO existe ninguna línea que empiece por `0f46:` —
 * un pad-byte en 0f45 se traga el prólogo (`0f45: 00558b`), que es la familia de prólogos
 * ocultos #80/#81. Buscar `^0f46:` da CERO EN FALSO; hay que leer desde 0f45.
 */

/**
 * Polinomios de realimentación (máscaras de tap) por ANCHO EN BITS, tabla DS 0x254d de
 * EGA.DRV (extraída byte-a-byte). Índice = ancho de bits (2..15); son polinomios de LFSR
 * de Galois maximal-length.
 */
export const FIZZLE_POLY: Readonly<Record<number, number>> = {
  2: 0x0003, 3: 0x0006, 4: 0x000c, 5: 0x0014, 6: 0x0030, 7: 0x0060, 8: 0x00b8,
  9: 0x0110, 10: 0x0240, 11: 0x0500, 12: 0x0ca0, 13: 0x1b00, 14: 0x3500, 15: 0x6000,
  // 16: la entrada que FALTABA (GAP-5 §F, tabla 0x254d completa): el caso del endgame
  // full-screen (64000 px → 16 bits). Sin ella caía al fallback de 15 bits, que NO
  // cubre 64000 posiciones.
  16: 0xb400,
} as const;

/** Ancho en bits de `n` (nº de bits para representar n; el driver lo cuenta a shr, 0x259b). */
export function bitWidth(n: number): number {
  let w = 0;
  let v = n;
  while (v > 0) {
    w++;
    v >>= 1;
  }
  return w;
}

/** Polinomio del fizzle para una región de `size` posiciones (poly por ancho de `size`). */
export function fizzlePolyForSize(size: number): number {
  // bitWidth(size−1), no bitWidth(size) (GAP-5 §F): el LFSR genera 1..2^w−1 — para
  // `size` posiciones (índices 0..size−1 con el 0 emitido al FINAL del ciclo, como
  // fn34) el ancho correcto es el de size−1. Con bitWidth(size), un size potencia
  // de 2 (p.ej. 64: w=7) doblaba el espacio y el skip-fuera-de-rango descartaba
  // la mitad de los estados.
  const w = bitWidth(Math.max(1, size - 1));
  return FIZZLE_POLY[w] ?? FIZZLE_POLY[16]!;
}

/**
 * Un paso del LFSR de Galois del fizzle (0x25ec-0x25f3). `state`/retorno son de 16 bits.
 */
export function fizzleStep(state: number, poly: number): number {
  const lsb = state & 1;
  let s = (state >>> 1) & 0xffff;
  if (lsb) s = (s ^ poly) & 0xffff;
  return s;
}

/**
 * Secuencia COMPLETA del fizzle para un `poly` (seed 1 hasta volver a 1): la permutación
 * de 1..(2^w−1) que da el orden de revelado. Maximal-length ⇒ longitud = 2^w−1, sin repes.
 * `limit` acota defensivamente (por si un poly no-maximal no cerrara el ciclo).
 */
export function fizzleSequence(poly: number, limit = 0x10000): number[] {
  const out: number[] = [];
  let s = 1;
  do {
    out.push(s);
    s = fizzleStep(s, poly);
  } while (s !== 1 && out.length < limit);
  return out;
}
