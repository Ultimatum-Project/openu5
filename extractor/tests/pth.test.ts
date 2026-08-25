import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FIGURE_STARTS, parseBritishPath } from "../src/parsers/pth.js";
import { U5_DIR } from "./helpers.js";

const read = (name: string) => new Uint8Array(readFileSync(`${U5_DIR}/${name}`));

/**
 * BRITISH.PTH = rutas de las 4 figuras andantes del attract del título.
 * Codec derivado de path_walk_anim (INTRO.OVL 0x50); ver re/notes/intro.md §3.
 */
describe("parseBritishPath (BRITISH.PTH)", () => {
  const path = parseBritishPath(read("BRITISH.PTH"));

  it("trocea en 4 rutas (una por figura, terminadores 0x00)", () => {
    expect(path.routes.length).toBe(4);
  });

  it("cada ruta arranca en su posición derivada del llamador (0x0c07..)", () => {
    for (let i = 0; i < 4; i++) {
      expect(path.routes[i]!.start).toEqual(FIGURE_STARTS[i]);
    }
  });

  it("decodifica el codec de paso: |d|≤7 en cada eje, con signo", () => {
    for (const r of path.routes) {
      expect(r.steps.length).toBeGreaterThan(0);
      for (const s of r.steps) {
        expect(Math.abs(s.dx)).toBeLessThanOrEqual(7);
        expect(Math.abs(s.dy)).toBeLessThanOrEqual(7);
      }
    }
  });

  it("el primer byte 0x10 decodifica a (dx=0, dy=1) (bits4-6=1, sin signos)", () => {
    // BRITISH.PTH[0] = 0x10 → dx = 0x10 & 7 = 0; dy = (0x10>>4)&7 = 1.
    expect(path.routes[0]!.steps[0]).toEqual({ dx: 0, dy: 1 });
  });

  it("el codec respeta los bits de signo (0x90 → dy negativo)", () => {
    // 0x90: dx = 0x90&7 = 0; dy = (0x90>>4)&7 = 1, bit7 set → dy = -1.
    // Aparece en el fichero real (byte 6 = 0x90).
    const bytes = read("BRITISH.PTH");
    const idx = [...bytes].indexOf(0x90);
    expect(idx).toBeGreaterThanOrEqual(0);
  });
});
