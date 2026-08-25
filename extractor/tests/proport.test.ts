import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decompressLzw } from "../src/parsers/lzw.js";
import { packProportFont, parseProport, PROPORT_FIRST_CHAR } from "../src/parsers/proport.js";
import { U5_DIR } from "./helpers.js";

const read = (name: string) => new Uint8Array(readFileSync(`${U5_DIR}/${name}`));

/**
 * PROPORT.PCS = fuente proporcional de las cinemáticas de la intro. Formato
 * derivado+citado; ver re/notes/intro-blit-formats.md §3.3.
 */
describe("parseProport (PROPORT.PCS)", () => {
  const glyphs = parseProport(decompressLzw(read("PROPORT.PCS")));

  it("91 glifos, mapeados a ASCII 0x20..0x7a", () => {
    expect(glyphs.length).toBe(91);
    expect(glyphs[0]!.code).toBe(0x20); // espacio
    expect(glyphs[90]!.code).toBe(0x7a); // 'z'
  });

  it("todos alto=8, ancho proporcional 0..8; el espacio tiene ancho 0", () => {
    for (const g of glyphs) {
      expect(g.height).toBe(8);
      expect(g.width).toBeGreaterThanOrEqual(0);
      expect(g.width).toBeLessThanOrEqual(8);
    }
    expect(glyphs[0]!.width).toBe(0); // espacio
  });

  it("la 'V' (idx 54 = 0x36) mide 6 px de ancho y tiene forma", () => {
    const v = glyphs.find((g) => g.code === 0x56)!; // 'V'
    expect(v.code).toBe(PROPORT_FIRST_CHAR + 0x36);
    expect(v.width).toBe(6);
    // Fila 0 de la 'V': ##..## (bits en los extremos).
    expect(v.mask[0]).toBe(1);
    expect(v.mask[5]).toBe(1);
    expect(v.mask[2]).toBe(0);
  });

  it("packProportFont produce un atlas de 8 px de alto + manifiesto por carácter", () => {
    const font = packProportFont(glyphs);
    expect(font.height).toBe(8);
    expect(font.glyphs.length).toBe(91);
    // Los avances acumulados dan el ancho total del atlas.
    const sumW = glyphs.reduce((s, g) => s + g.width, 0);
    expect(font.width).toBe(sumW);
    expect(font.glyphs[0]).toMatchObject({ code: 0x20, x: 0, width: 0 });
  });
});
