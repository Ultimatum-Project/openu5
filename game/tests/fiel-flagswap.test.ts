/**
 * Píxel-swap de banderas (`render/flagswap.ts`, calco de `fn32` del EGA.DRV).
 * Verifica el PRNG local, la paridad de swap por bit, y el swap de filas.
 */
import { describe, expect, it } from "vitest";
import {
  FLAG_SWAPS,
  advanceDrvSeed,
  FlagSwapRunner,
  flagSwapFor,
  applyFlagSwap,
} from "../src/render/flagswap.js";

describe("advanceDrvSeed — PRNG local del driver", () => {
  it("es determinista y de 16 bits", () => {
    let s = 0x1234;
    const seen: number[] = [];
    for (let i = 0; i < 50; i++) {
      s = advanceDrvSeed(s);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(0xffff);
      seen.push(s);
    }
    // reproducible desde el mismo seed
    let s2 = 0x1234;
    for (let i = 0; i < 50; i++) {
      s2 = advanceDrvSeed(s2);
      expect(s2).toBe(seen[i]);
    }
  });
});

describe("FlagSwapRunner — flutter por bit de semilla", () => {
  it("las 3 banderas empiezan sin permutar", () => {
    const r = new FlagSwapRunner();
    expect(r.isSwapped(0x12)).toBe(false);
    expect(r.isSwapped(0x14)).toBe(false);
    expect(r.isSwapped(0x15)).toBe(false);
  });

  it("un bit a 1 invierte la paridad de su bandera (auto-inverso)", () => {
    // seed con bit0=1, bit1=0, bit2=1 → tras 1 tick: 0x12 y 0x15 permutan, 0x14 no.
    const r = new FlagSwapRunner(0b101);
    r.tick();
    expect(r.isSwapped(0x12)).toBe(true); // bit0
    expect(r.isSwapped(0x14)).toBe(false); // bit1
    expect(r.isSwapped(0x15)).toBe(true); // bit2
  });

  it("tiles no-bandera (Village 0x13, faro 0x1b) nunca permutan", () => {
    const r = new FlagSwapRunner(0xffff);
    for (let i = 0; i < 10; i++) r.tick();
    expect(r.isSwapped(0x13)).toBe(false);
    expect(r.isSwapped(0x1b)).toBe(false);
  });

  it("a lo largo de muchos ticks las banderas fluctúan (~50% del tiempo)", () => {
    const r = new FlagSwapRunner(0xabcd);
    let on = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      r.tick();
      if (r.isSwapped(0x12)) on++;
    }
    // gate de 1 bit ⇒ ~50% de las pasadas invierten; la paridad pasa ~mitad del tiempo on.
    expect(on).toBeGreaterThan(N * 0.2);
    expect(on).toBeLessThan(N * 0.8);
  });
});

describe("applyFlagSwap — swap de filas chunky, auto-inverso", () => {
  function mkTile(): Uint8ClampedArray {
    // 16×16 RGBA; el canal R = número de fila (para verificar el swap).
    const a = new Uint8ClampedArray(16 * 16 * 4);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) a[(y * 16 + x) * 4] = y;
    return a;
  }

  it("0x15 permuta la fila 0 con la fila 2 (todo el ancho)", () => {
    const t = mkTile();
    applyFlagSwap(t, flagSwapFor(0x15)!);
    expect(t[(0 * 16 + 5) * 4]).toBe(2); // fila 0 ahora tiene el contenido de la 2
    expect(t[(2 * 16 + 5) * 4]).toBe(0);
    expect(t[(1 * 16 + 5) * 4]).toBe(1); // fila 1 intacta
  });

  it("0x14 permuta SÓLO la mitad izquierda (x<8) de las filas 2 y 4", () => {
    const t = mkTile();
    applyFlagSwap(t, flagSwapFor(0x14)!);
    expect(t[(2 * 16 + 3) * 4]).toBe(4); // izq: permutado
    expect(t[(2 * 16 + 12) * 4]).toBe(2); // der: intacto
  });

  it("aplicarlo dos veces vuelve al original (auto-inverso)", () => {
    const t = mkTile();
    const orig = t.slice();
    applyFlagSwap(t, flagSwapFor(0x15)!);
    applyFlagSwap(t, flagSwapFor(0x15)!);
    expect(Array.from(t)).toEqual(Array.from(orig));
  });

  it("hay 4 banderas animadas (0x12/0x14/0x15 + gallardete LB 0x3e)", () => {
    expect(FLAG_SWAPS.map((f) => f.tile).sort((a, b) => a - b)).toEqual([
      0x12, 0x14, 0x15, 0x3e,
    ]);
  });

  it("el gallardete de LB (0x3e) usa bit3 y swap de filas 0<->2", () => {
    const lb = flagSwapFor(0x3e)!;
    expect(lb.bit).toBe(3);
    expect([lb.rowA, lb.rowB]).toEqual([0, 2]);
    expect([lb.xlo, lb.xhi]).toEqual([0, 16]);
  });
});
