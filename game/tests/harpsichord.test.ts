/**
 * Matcher de la melodía del clavicémbalo (TOWN 0x0E70-0x0EE8, task #54 G2).
 * Ver re/notes/interactions-piano-fire-audit.md §1.4.
 */
import { describe, it, expect } from "vitest";
import { advanceMelody, HARPSICHORD_MELODY } from "../src/core/world/harpsichord.js";

/** Toca una secuencia de dígitos y devuelve (progreso final, nº de completados). */
function play(digits: number[]): { progress: number; completions: number } {
  let progress = 0;
  let completions = 0;
  for (const d of digits) {
    const step = advanceMelody(progress, d);
    progress = step.progress;
    if (step.complete) completions++;
  }
  return { progress, completions };
}

describe("clavicémbalo — matcher de melodía secreta", () => {
  it("la melodía exacta (6 7 8 9 8 7 8 7 6 7 6 5 3) completa una vez y resetea", () => {
    const r = play([...HARPSICHORD_MELODY]);
    expect(r.completions).toBe(1);
    expect(r.progress).toBe(0); // resetea tras completar
  });

  it("una nota mal en medio NO completa", () => {
    const wrong: number[] = [...HARPSICHORD_MELODY];
    wrong[5] = 0; // rompe la 6ª nota
    expect(play(wrong).completions).toBe(0);
  });

  it("prefijo repetido: tocar un 6 tras un fallo rearma al progreso 1", () => {
    // Empezamos bien (6,7) y fallamos; luego un 6 debe dejar progress=1 (0ed6/0ee0).
    let progress = advanceMelody(0, 6).progress; // 1
    progress = advanceMelody(progress, 7).progress; // 2
    progress = advanceMelody(progress, 5).progress; // fallo (esperaba 8) → digit 5 ≠ 6 → 0
    expect(progress).toBe(0);
    progress = advanceMelody(progress, 6).progress; // 6 = MELODY[0] → 1
    expect(progress).toBe(1);
  });

  it("rebobinado especializado: progress 10 con nota 8 → 3 (0eae/0eb5)", () => {
    // Fuerza progress=10, luego una nota que no es MELODY[10] (=6) pero sí 8 → 3.
    // MELODY[0..9] = 6 7 8 9 8 7 8 7 6 7 → llega a progress 10.
    let progress = 0;
    for (const d of [6, 7, 8, 9, 8, 7, 8, 7, 6, 7]) progress = advanceMelody(progress, d).progress;
    expect(progress).toBe(10);
    progress = advanceMelody(progress, 8).progress; // fallo (esperaba 6), digit 8 → 3
    expect(progress).toBe(3);
  });

  it("rebobinado especializado: progress 11 con nota 7 → 2 (0ec2/0ec9)", () => {
    let progress = 0;
    for (const d of [6, 7, 8, 9, 8, 7, 8, 7, 6, 7, 6]) progress = advanceMelody(progress, d).progress;
    expect(progress).toBe(11);
    progress = advanceMelody(progress, 7).progress; // fallo (esperaba 5), digit 7 → 2
    expect(progress).toBe(2);
  });

  it("nota basura tras un fallo → progreso 0", () => {
    let progress = advanceMelody(0, 6).progress; // 1
    progress = advanceMelody(progress, 2).progress; // fallo, 2 no es 6 → 0
    expect(progress).toBe(0);
  });
});
