/**
 * Ruido de llama del fuego (`render/firenoise.ts`, calco de `fn32` @0x23ba).
 * Verifica el PRNG local, el mapa fuego→máscara, y el XOR enmascarado por-píxel.
 */
import { describe, expect, it } from "vitest";
import {
  FIRE_MASKS,
  isFireTile,
  FireNoisePrng,
  applyFireNoise,
} from "../src/render/firenoise.js";

describe("FIRE_MASKS — fuego → tile-máscara", () => {
  it("antorchas/braseros 0xb0-b3 → máscaras 0xc0-c3", () => {
    expect(FIRE_MASKS.get(0xb0)).toBe(0xc0);
    expect(FIRE_MASKS.get(0xb3)).toBe(0xc3);
    expect(FIRE_MASKS.get(0xde)).toBe(0xc2);
  });
  it("isFireTile distingue fuego de no-fuego", () => {
    expect(isFireTile(0xb0)).toBe(true);
    expect(isFireTile(0x12)).toBe(false); // bandera, otro carril
    expect(isFireTile(0xd8)).toBe(false); // fuente, reloj maestro
  });
});

describe("FireNoisePrng — local, determinista", () => {
  it("mismo seed → misma secuencia de nibbles [0,15]", () => {
    const a = new FireNoisePrng(0x1234);
    const b = new FireNoisePrng(0x1234);
    for (let i = 0; i < 50; i++) {
      const v = a.nextNibble();
      expect(v).toBe(b.nextNibble());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(15);
    }
  });
});

describe("applyFireNoise — XOR enmascarado por-píxel", () => {
  it("máscara 0 ⇒ píxel intacto (candelabro no parpadea)", () => {
    const base = new Uint8Array([5, 7, 9, 3]);
    const mask = new Uint8Array([0, 0, 0, 0]);
    const out = new Uint8Array(4);
    applyFireNoise(base, mask, out, new FireNoisePrng());
    expect(Array.from(out)).toEqual([5, 7, 9, 3]);
  });

  it("máscara con bits ⇒ el resultado difiere sólo en esos píxeles y sólo en esos bits", () => {
    const base = new Uint8Array(64).fill(0b1010);
    const mask = new Uint8Array(64);
    // sólo la mitad tiene máscara (bits 0b0011 → sólo pueden cambiar los 2 bits bajos)
    for (let i = 0; i < 32; i++) mask[i] = 0b0011;
    const out = new Uint8Array(64);
    applyFireNoise(base, mask, out, new FireNoisePrng(0xbeef));
    for (let i = 0; i < 64; i++) {
      if (mask[i] === 0) expect(out[i]).toBe(0b1010); // intacto
      else {
        // los 2 bits altos (0b1000) NO cambian (fuera de máscara)
        expect(out[i]! & 0b1100).toBe(0b1000);
      }
    }
  });

  it("es un XOR (idempotente con el mismo ruido): resultado ∈ [0,15]", () => {
    const base = new Uint8Array(16).fill(0xf);
    const mask = new Uint8Array(16).fill(0xf);
    const out = new Uint8Array(16);
    applyFireNoise(base, mask, out, new FireNoisePrng());
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(15);
    }
  });
});
