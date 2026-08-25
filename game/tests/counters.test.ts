/**
 * Helpers de suma saturante del kernel del original (#17). El binario tiene DOS
 * sumadores genéricos que SATURAN (no wrapean):
 *  - add_byte_capped (kernel 0x9C60 [= CS 0x3ef0 → ULTIMA.EXE:0x3ef0]): cap 99 (0x63) — contadores u8 (keys/gems/torches).
 *  - add_word_capped (kernel 0x9C84 [= CS 0x3f14 → ULTIMA.EXE:0x3f14]): cap 9999 (0x270F) — palabras u16 (gold/food/exp).
 * Citas: re/notes/shops.md:68-69 (0x9C60 cap 99 / 0x0F3D→0x9C84 cap 9999).
 */
import { describe, expect, it } from "vitest";
import { addByteCapped, addWordCapped, CAP_BYTE, CAP_WORD } from "../src/core/counters.js";

describe("addByteCapped (0x9C60, cap 99)", () => {
  it("suma normal por debajo del tope", () => {
    expect(addByteCapped(10, 5)).toBe(15);
  });
  it("satura a 99 al rebasar (no wrapea)", () => {
    expect(addByteCapped(98, 5)).toBe(99);
    expect(addByteCapped(99, 40)).toBe(99);
  });
  it("aterriza exacto en el tope", () => {
    expect(addByteCapped(90, 9)).toBe(99);
  });
  it("CAP_BYTE = 99 (0x63)", () => {
    expect(CAP_BYTE).toBe(99);
  });
});

describe("addWordCapped (0x9C84, cap 9999)", () => {
  it("suma normal por debajo del tope", () => {
    expect(addWordCapped(1000, 500)).toBe(1500);
  });
  it("satura a 9999 al rebasar (no wrapea)", () => {
    expect(addWordCapped(9998, 5)).toBe(9999);
    expect(addWordCapped(9999, 9999)).toBe(9999);
  });
  it("aterriza exacto en el tope", () => {
    expect(addWordCapped(9990, 9)).toBe(9999);
  });
  it("CAP_WORD = 9999 (0x270F)", () => {
    expect(CAP_WORD).toBe(9999);
  });
});
