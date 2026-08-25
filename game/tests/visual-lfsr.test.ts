/**
 * Calco BYTE-EXACTO del revoltijo visual de transiciones EGA (EGA.DRV fn32 0x1fa8-0x1fbb).
 * Vectores computados directamente del paso del ASM (add 0x9248 · ror16 3 · xor 0x9248 ·
 * add 0x11); si la implementación diverge del binario, estos números no casan.
 */
import { describe, it, expect } from "vitest";
import { ror16, nextVisualState, visualByte, visualSequence } from "../src/core/transition/visualLfsr.js";

describe("ror16 — rotación derecha de 16 bits (ror ax,1 ×n)", () => {
  it("ror16(0x9248, 3) = 0x1249 (los 3 bits bajos 000 rotan al tope)", () => {
    expect(ror16(0x9248, 3)).toBe(0x1249);
  });
  it("rota, no desplaza: bits bajos vuelven arriba", () => {
    expect(ror16(0x0001, 1)).toBe(0x8000);
    expect(ror16(0x8000, 1)).toBe(0x4000);
    expect(ror16(0xabcd, 0)).toBe(0xabcd);
  });
});

describe("nextVisualState — un paso del revoltijo (0x1fa8-0x1fbb)", () => {
  it("paso desde 0: ((ror16(0x9248,3) ^ 0x9248) + 0x11) = 0x8012", () => {
    // 0+0x9248=0x9248 → ror3=0x1249 → ^0x9248=0x8001 → +0x11=0x8012
    expect(nextVisualState(0)).toBe(0x8012);
  });
  it("es determinista y de 16 bits (nunca excede 0xffff)", () => {
    for (let s = 0; s < 0x10000; s += 0x137) {
      const n = nextVisualState(s);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(0xffff);
      expect(nextVisualState(s)).toBe(n); // determinista
    }
  });
});

describe("visualSequence / visualByte — secuencia calcada", () => {
  it("secuencia desde seed 0 = states exactos del ASM", () => {
    expect(visualSequence(0, 6)).toEqual([0x8012, 0xd014, 0x1e14, 0x0454, 0x00ac, 0x0027]);
  });
  it("byte por columna (al) desde seed 0", () => {
    const states = visualSequence(0, 6);
    expect(states.map(visualByte)).toEqual([0x12, 0x14, 0x14, 0x54, 0xac, 0x27]);
  });
  it("seed 0x7664 (word en cs:[0x1f94]) → primer state 0x136e", () => {
    expect(visualSequence(0x7664, 1)[0]).toBe(0x136e);
  });
});
