import { describe, expect, it } from "vitest";
import { OriginalRng, timeHashSeed } from "../src/core/rng-original.js";

/**
 * Vectores de referencia derivados del asm del kernel (ULTIMA.EXE,
 * rutina rand_range en el offset de código 0x2092; ver re/notes/rng.md).
 * Calculados con el modelo Python de la fórmula re-derivada:
 *
 *   x = (seed + 0x9248) & 0xFFFF
 *   x = ror16(x, 3)
 *   x = x ^ 0x9248
 *   x = (x + 0x11) & 0xFFFF
 *   seed = x; retorno = lo + ((x & 0x7FFF) % (hi - lo + 1))
 *
 * La misma secuencia está verificada contra el binario real corriendo en
 * dosbox-x (re/tools/test_rng_parity.py: siembra 0x1234 en g_rng_seed y
 * observa la evolución de la semilla en cada entrada a la rutina).
 */
const RAW_FROM_1234 = [0x06d8, 0x817d, 0x3041, 0xaa2a, 0xd5d7, 0x7f5c, 0x108d, 0x2623];
const RAW_FROM_0000 = [0x8012, 0xd014, 0x1e14, 0x0454, 0x00ac, 0x0027, 0x6016, 0x4c14];
const RAW_FROM_FFFF = [0x6011, 0xac14, 0x1594, 0x06c4, 0x017a, 0xc041, 0xb82a, 0xdb17];

describe("OriginalRng.nextRaw16 (secuencia de la semilla, bit a bit)", () => {
  it("reproduce la secuencia cruda desde seed 0x1234", () => {
    const rng = new OriginalRng(0x1234);
    expect(RAW_FROM_1234.map(() => rng.nextRaw16())).toEqual(RAW_FROM_1234);
  });

  it("reproduce la secuencia cruda desde seed 0x0000", () => {
    const rng = new OriginalRng(0);
    expect(RAW_FROM_0000.map(() => rng.nextRaw16())).toEqual(RAW_FROM_0000);
  });

  it("reproduce la secuencia cruda desde seed 0xFFFF (wrap de 16 bits)", () => {
    const rng = new OriginalRng(0xffff);
    expect(RAW_FROM_FFFF.map(() => rng.nextRaw16())).toEqual(RAW_FROM_FFFF);
  });

  it("la semilla viva es el último valor crudo (el original la guarda en g_rng_seed)", () => {
    const rng = new OriginalRng(0x1234);
    rng.nextRaw16();
    rng.nextRaw16();
    expect(rng.getSeed()).toBe(RAW_FROM_1234[1]);
  });

  it("seed() trunca a 16 bits como el srand del kernel (mov [g_rng_seed], ax)", () => {
    const rng = new OriginalRng(0);
    rng.seed(0x11234);
    expect(rng.getSeed()).toBe(0x1234);
    expect(rng.nextRaw16()).toBe(RAW_FROM_1234[0]);
  });
});

describe("OriginalRng.next (rand_range(lo, hi) inclusivo, como el kernel)", () => {
  it("next(1, 8) desde 0x1234: lo + ((raw & 0x7FFF) % (hi-lo+1))", () => {
    const rng = new OriginalRng(0x1234);
    const got = [1, 6, 2, 3, 8, 5, 6, 4].map(() => rng.next(1, 8));
    expect(got).toEqual([1, 6, 2, 3, 8, 5, 6, 4]);
  });

  it("next(0, 63) desde 0x1234 (call site 0x2f70 del kernel: push 0 / push 0x3f)", () => {
    const rng = new OriginalRng(0x1234);
    const got = [24, 61, 1, 42, 23, 28, 13, 35].map(() => rng.next(0, 63));
    expect(got).toEqual([24, 61, 1, 42, 23, 28, 13, 35]);
  });

  it("consume exactamente un paso crudo por llamada", () => {
    const a = new OriginalRng(0x0042);
    const b = new OriginalRng(0x0042);
    a.next(1, 6);
    b.nextRaw16();
    expect(a.getSeed()).toBe(b.getSeed());
  });

  it("hi === lo devuelve siempre lo pero avanza la semilla (div por 1 en el asm)", () => {
    const rng = new OriginalRng(0x1234);
    expect(rng.next(5, 5)).toBe(5);
    expect(rng.getSeed()).toBe(RAW_FROM_1234[0]);
  });

  it("hi < lo es división por cero en el 8086: aquí, error explícito", () => {
    const rng = new OriginalRng(0x1234);
    expect(() => rng.next(8, 1)).toThrow();
  });

  it("la guarda NO mueve el stream: el throw no consume paso ni toca el dominio legal", () => {
    // La guarda es divergencia deliberada (el original cuelga con #DE, ver §1.5 del
    // registro de bugs). Divergir del cuelgue es lícito; MOVER EL STREAM no lo sería.
    // Estas dos mitades lo fijan:
    //  (a) el rango imposible lanza SIN avanzar la semilla — un llamador que capture
    //      la excepción sigue en el mismo punto del stream (el throw precede al paso
    //      crudo, y este test se pone rojo si alguien lo reordena);
    //  (b) el dominio legal sale idéntico exista o no la guarda: misma secuencia que
    //      la del vector fijo de arriba, sin desplazamiento.
    const rng = new OriginalRng(0x1234);
    const semillaAntes = rng.getSeed();
    expect(() => rng.next(1, 0)).toThrow(RangeError);
    expect(rng.getSeed()).toBe(semillaAntes); // (a) cero pasos consumidos

    const conIntentoFallido = new OriginalRng(0x1234);
    try {
      conIntentoFallido.next(1, 0);
    } catch {
      /* ignorado a propósito: es el caso del llamador que captura */
    }
    const limpio = new OriginalRng(0x1234);
    const a = [0, 0, 0, 0].map(() => conIntentoFallido.next(1, 8));
    const b = [0, 0, 0, 0].map(() => limpio.next(1, 8));
    expect(a).toEqual(b); // (b) el dominio legal, intacto
  });
});

describe("timeHashSeed (hash de la hora DOS, rutina 0x2056)", () => {
  it("reproduce el hash del asm (vectores del modelo Python)", () => {
    expect(timeHashSeed(0, 0, 0, 0)).toBe(0x1eb);
    expect(timeHashSeed(12, 34, 56, 78)).toBe(0x93d);
    expect(timeHashSeed(23, 59, 59, 99)).toBe(0x6a4);
  });
  it("siempre cae en [0, 0xFFF] (and ax, 0xfff)", () => {
    for (let h = 0; h < 24; h += 7)
      for (let m = 0; m < 60; m += 13)
        expect(timeHashSeed(h, m, (h * m) % 60, (h + m) % 100)).toBeLessThanOrEqual(0xfff);
  });
});
