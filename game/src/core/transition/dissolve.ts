/**
 * DISSOLVE / WIPE de pantalla EGA (fn37, sel 0x6f) — calco del recorrido de la tabla de
 * ORDEN de EGA.DRV (`re/disasm/EGA.DRV.asm` pass_down 0x1d13 / pass_up 0x1d54). A diferencia
 * del fizzle (LFSR de taps) y del revoltijo de fn32, el dissolve es un WIPE DIRIGIDO POR
 * DATOS: una tabla de bytes = índices de FILA con 0xFF como marcador de LOTE; el driver
 * acumula flags de fila y en cada 0xFF revela el lote (transition_step 0x1c93, filas en 2
 * mitades con delay). Son 6 LOTES por dissolve (contador cs:[0x1b23]=6, 0x1d1f).
 *
 * pass_down (0x1d13): índice de count−1 a 0 (decrece); no-0xFF → flag[fila]=1; 0xFF → revela
 *   el lote y decrementa el contador de 6; a 0 → fin. Es el revelado (flag=1).
 * pass_up (0x1d54): índice de 1 hacia arriba (crece); mismo recorrido con flag=0 (el pase
 *   inverso / ocultado).
 *
 * ⚠ SIN CONSUMIDOR DE PRODUCCIÓN — pero el disparador NO es un cero. La rutina 0x0d72
 * (página de 7 líneas centradas + dissolve) tiene UN caller, no cero: INTRO.OVL 0x0b49,
 * medido por BANDA (`callers_por_banda.py`, control positivo de 0x7a8e en verde). El "0
 * callers" anterior era artefacto del censo por grep sobre el disasm, que no resuelve el
 * sesgo near-call inter-overlay (#158/#173); queda retirado.
 * Lo que SÍ sigue siendo cierto: este módulo no lo importa nadie en `game/src` — su único
 * importador es `game/tests/dissolve.test.ts`. Es el ALGORITMO del recorrido; la TABLA de
 * orden concreta (DS 0x1e8c) y la CADENCIA (delay busy-wait 0x1c24, Clase-C) siguen sin
 * volcar, y ESO —no el llamador— es lo que queda en la cola de oráculo (lote-D B3).
 */
import { type DissolveBand } from "./dissolveTable.js";

/** Marcador de LOTE en la tabla de orden (fin de lote → revelar lo acumulado). 0x1d38. */
export const DISSOLVE_BATCH_MARKER = 0xff;

/** Nº de lotes de un dissolve completo (contador cs:[0x1b23]=6, 0x1d1f). */
export const DISSOLVE_STEPS = 6;

export type DissolveDirection = "down" | "up";

/**
 * Recorre la tabla de `order` (índices de fila 0..N con 0xFF de fin-de-lote) y devuelve los
 * LOTES de revelado: cada lote es el array de índices de fila acumulados desde el 0xFF
 * anterior, en el orden en que el driver los marca. Calco de pass_down/pass_up:
 *
 *   - "down": empieza en `order.length − 1` y DECRECE (0x1d1a `dec ax`); lee `order[i]`.
 *   - "up":   empieza en 1 y CRECE (0x1d54 `=1`, 0x1d67 `inc`).
 *   - byte ≠ 0xFF → acumula la fila en el lote actual.
 *   - byte == 0xFF → cierra el lote (lo emite) y consume un paso; tras `maxSteps` lotes, para.
 *
 * PURO: no pinta ni retrasa; sólo el orden de filas por lote. `maxSteps` = 6 (DISSOLVE_STEPS).
 */
export function dissolvePass(
  order: readonly number[],
  direction: DissolveDirection = "down",
  maxSteps = DISSOLVE_STEPS,
): number[][] {
  const batches: number[][] = [];
  let current: number[] = [];
  let steps = 0;
  let i = direction === "down" ? order.length - 1 : 1;
  const inBounds = (): boolean => i >= 0 && i < order.length;
  while (inBounds() && steps < maxSteps) {
    const b = order[i]!;
    if (direction === "down") i--;
    else i++;
    if (b === DISSOLVE_BATCH_MARKER) {
      batches.push(current); // cierra el lote (0x1c93 revela lo acumulado)
      current = [];
      steps++;
    } else {
      current.push(b & 0xff); // flag[fila]=1 (0x1d4b)
    }
  }
  return batches;
}

// ── Programación de scanlines del page-dissolve (fn37) ──────────────────────────

/**
 * Un LOTE de revelado del melt: las scanlines ABSOLUTAS (0..199) que se descubren en un
 * paso, en el orden en que el driver las marca. La animación de la piel revela un lote por
 * tick (cadencia Clase-C).
 */
export type DissolveRevealBatch = readonly number[];

/**
 * Genera la SECUENCIA DE REVELADO del page-dissolve a partir de las bandas (extraídas de
 * EGA.DRV): concatena, banda por banda (de la más interior 75→ a la más exterior 46→), los
 * lotes de la pasada DOWN (`dissolvePass`, calcada de pass_down del driver), mapeando cada
 * índice intra-banda a su scanline ABSOLUTA `startRow + índice`. El resultado es la lista
 * ordenada de lotes de scanlines que el melt descubre — lo BYTE-EXACTO del efecto; la piel
 * solo tiene que pintar esas scanlines de la página en ese orden. Los lotes vacíos (0xff
 * seguidos, puro delay del original) se descartan aquí: en canvas no aportan píxeles, solo
 * ritmo, y el ritmo lo pone la cadencia Clase-C de la piel.
 */
export function dissolveRevealBatches(
  bands: readonly DissolveBand[],
): DissolveRevealBatch[] {
  const out: DissolveRevealBatch[] = [];
  for (const band of bands) {
    // El driver usa un contador de 6 lotes por pasada, pero la tabla trae más 0xff que
    // eso; el pase real se detiene al agotar los índices. Pedimos todos los lotes de la
    // tabla (maxSteps = nº de 0xff) para no truncar el revelado de la banda.
    const markers = band.order.filter((b) => b === DISSOLVE_BATCH_MARKER).length;
    for (const batch of dissolvePass(band.order, "down", markers)) {
      if (batch.length === 0) continue; // lote de puro delay (sin scanlines): fuera
      out.push(batch.map((idx) => band.startRow + idx));
    }
  }
  return out;
}
