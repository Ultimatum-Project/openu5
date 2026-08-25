/**
 * BANDA CELESTE (E1-S8b) — fija las fórmulas de posición sol/luna por hora
 * derivadas de 0x4adb (`re/notes/ui-text-layer.md §9`) y los glifos (sol 0x2A,
 * luna dígito 0x30+fase).
 */
import { describe, expect, it } from "vitest";
import { MOON_PHASE_BASE, SKY_CELLS, SUN_GLYPH, skyMarks } from "../src/skin/fiel/sky.js";

const sun = (m: ReturnType<typeof skyMarks>) => m.find((x) => x.isSun);
const moons = (m: ReturnType<typeof skyMarks>) => m.filter((x) => !x.isSun);

describe("skyMarks — sol (17 - hour, 0x4ac8)", () => {
  it("mediodía (12): sol en celda 5", () => {
    const s = sun(skyMarks(12, 0, 0));
    expect(s).toMatchObject({ cell: 5, code: SUN_GLYPH });
  });
  it("amanecer (6): sol en celda 11; ocaso (17): celda 0", () => {
    expect(sun(skyMarks(6, 0, 0))?.cell).toBe(11);
    expect(sun(skyMarks(17, 0, 0))?.cell).toBe(0);
  });
  it("de noche (0, 20) el sol no está visible", () => {
    expect(sun(skyMarks(0, 0, 0))).toBeUndefined();
    expect(sun(skyMarks(20, 0, 0))).toBeUndefined();
  });
});

describe("skyMarks — lunas (felucca 8-hour, trammel 2-hour, +24 si <-12)", () => {
  it("a medianoche (0): felucca celda 8, trammel celda 2", () => {
    const m = skyMarks(0, 3, 5);
    const cells = m.filter((x) => !x.isSun).map((x) => x.cell);
    expect(cells).toContain(8); // felucca 8-0
    expect(cells).toContain(2); // trammel 2-0
  });
  it("la fase se codifica como dígito 0x30+fase", () => {
    const m = skyMarks(0, 3, 5);
    const codes = m.filter((x) => !x.isSun).map((x) => x.code);
    expect(codes).toContain(MOON_PHASE_BASE + 3); // felucca fase 3
    expect(codes).toContain(MOON_PHASE_BASE + 5); // trammel fase 5
  });
  it("wrap: a las 23h felucca envuelve a celda 9 (8-23=-15 → +24=9)", () => {
    const fel = moons(skyMarks(23, 0, 0)).find((x) => x.cell === 9);
    expect(fel).toBeDefined();
  });
  it("las celdas siempre caen en 0..11", () => {
    for (let h = 0; h < 24; h++) {
      for (const mark of skyMarks(h, 0, 0)) {
        expect(mark.cell).toBeGreaterThanOrEqual(0);
        expect(mark.cell).toBeLessThan(SKY_CELLS);
      }
    }
  });
});
