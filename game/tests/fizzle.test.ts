/**
 * Calco BYTE-EXACTO del LFSR de Galois del fizzle-fade EGA (fn34, EGA.DRV 0x25ec-0x25fe).
 * Vectores computados del paso del ASM; maximal-length ⇒ permutación completa sin repes.
 */
import { describe, it, expect } from "vitest";
import {
  FIZZLE_POLY,
  bitWidth,
  fizzlePolyForSize,
  fizzleStep,
  fizzleSequence,
} from "../src/core/transition/fizzle.js";

describe("tabla de polinomios (DS 0x254d, byte-exacta)", () => {
  it("polinomios maximal-length por ancho de bits", () => {
    expect(FIZZLE_POLY[4]).toBe(0x000c);
    expect(FIZZLE_POLY[8]).toBe(0x00b8);
    expect(FIZZLE_POLY[12]).toBe(0x0ca0);
    expect(FIZZLE_POLY[15]).toBe(0x6000);
  });
});

describe("bitWidth / fizzlePolyForSize", () => {
  it("ancho en bits (nº de shifts hasta 0, 0x259b)", () => {
    expect(bitWidth(0)).toBe(0);
    expect(bitWidth(1)).toBe(1);
    expect(bitWidth(15)).toBe(4);
    expect(bitWidth(16)).toBe(5);
    expect(bitWidth(255)).toBe(8);
  });
  it("poly por tamaño de región (por ancho de size)", () => {
    expect(fizzlePolyForSize(15)).toBe(FIZZLE_POLY[4]);
    expect(fizzlePolyForSize(200)).toBe(FIZZLE_POLY[8]);
  });
});

describe("fizzleStep — LFSR de Galois (shr + xor condicional por carry)", () => {
  it("desde 1 con poly width-4 (0x000c): 1 → 0x0c (lsb=1 → shr=0 → ^0x0c)", () => {
    expect(fizzleStep(1, 0x000c)).toBe(0x0c);
  });
  it("estado par (lsb=0) sólo desplaza, sin xor", () => {
    expect(fizzleStep(0x0c, 0x000c)).toBe(0x06); // 0x0c>>1=6, lsb=0
  });
});

describe("fizzleSequence — permutación de revelado", () => {
  it("width-4 (poly 0x000c): permutación completa de 15 valores, orden exacto del ASM", () => {
    expect(fizzleSequence(0x000c)).toEqual([
      0x1, 0xc, 0x6, 0x3, 0xd, 0xa, 0x5, 0xe, 0x7, 0xf, 0xb, 0x9, 0x8, 0x4, 0x2,
    ]);
  });
  it("es MAXIMAL-LENGTH: periodo 2^w−1, sin repetidos (widths 4/5/8)", () => {
    for (const [w, poly] of [[4, 0x000c], [5, 0x0014], [8, 0x00b8]] as const) {
      const seq = fizzleSequence(poly);
      expect(seq.length).toBe(2 ** w - 1);
      expect(new Set(seq).size).toBe(2 ** w - 1); // sin repes
      expect(seq[0]).toBe(1);
    }
  });
});
