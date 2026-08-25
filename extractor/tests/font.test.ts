import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BYTES_PER_GLYPH,
  GLYPH_COUNT,
  fontToAtlasRgba,
  glyphPixel,
  glyphToRgba,
  parseFont,
} from "../src/parsers/font.js";
import { U5_DIR } from "./helpers.js";

const fontData = () => new Uint8Array(readFileSync(`${U5_DIR}/IBM.CH`));

describe("parseFont (IBM.CH — 8×8 mono, 128 glifos, MSB = píxel izquierdo)", () => {
  it("devuelve 128 glifos de 8 bytes cada uno", () => {
    const glyphs = parseFont(fontData());
    expect(glyphs.length).toBe(GLYPH_COUNT);
    for (const g of glyphs) expect(g.length).toBe(BYTES_PER_GLYPH);
  });

  it("rechaza un tamaño que no sea 1024 bytes", () => {
    expect(() => parseFont(new Uint8Array(1023))).toThrow();
    expect(() => parseFont(new Uint8Array(2048))).toThrow();
  });

  it("glifo 'A' (0x41) byte a byte = 1E 36 66 7E 66 66 C6 00", () => {
    const a = parseFont(fontData())[0x41]!;
    expect([...a]).toEqual([0x1e, 0x36, 0x66, 0x7e, 0x66, 0x66, 0xc6, 0x00]);
  });

  it("glifo 'B' (0x42) byte a byte = FC 66 66 7C 66 66 FC 00", () => {
    const b = parseFont(fontData())[0x42]!;
    expect([...b]).toEqual([0xfc, 0x66, 0x66, 0x7c, 0x66, 0x66, 0xfc, 0x00]);
  });

  it("el espacio (0x20) y el glifo 0 están en blanco (8 bytes a cero)", () => {
    const glyphs = parseFont(fontData());
    expect([...glyphs[0x20]!]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect([...glyphs[0x00]!]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("glyphPixel lee el bit correcto (MSB = columna 0)", () => {
    // Fila 0 de 'A' = 0x1E = 0001 1110 → columnas 3,4,5,6 encendidas.
    const a = parseFont(fontData())[0x41]!;
    expect(glyphPixel(a, 0, 0)).toBe(false);
    expect(glyphPixel(a, 3, 0)).toBe(true);
    expect(glyphPixel(a, 6, 0)).toBe(true);
    expect(glyphPixel(a, 7, 0)).toBe(false);
    // Fila 6 de 'A' = 0xC6 = 1100 0110 → columnas 0,1,5,6.
    expect(glyphPixel(a, 0, 6)).toBe(true);
    expect(glyphPixel(a, 1, 6)).toBe(true);
    expect(glyphPixel(a, 2, 6)).toBe(false);
  });
});

describe("RUNES.CH — fuente RÚNICA de la banda celeste (fuente 1 del kernel)", () => {
  const runesData = () => new Uint8Array(readFileSync(`${U5_DIR}/RUNES.CH`));

  it("mismo formato que IBM.CH: 128 glifos de 8 bytes", () => {
    const glyphs = parseFont(runesData());
    expect(glyphs.length).toBe(GLYPH_COUNT);
    for (const g of glyphs) expect(g.length).toBe(BYTES_PER_GLYPH);
  });

  it("el SOL (0x2A) es la ráfaga de 8 rayos, no un rombo ni un dígito", () => {
    // Cruz llena (fila/columna centrales) + rayos diagonales — el sol del cielo.
    const sun = parseFont(runesData())[0x2a]!;
    expect([...sun]).toEqual([0x10, 0x54, 0x38, 0xfe, 0x38, 0x54, 0x10, 0x00]);
    // Suma de píxeles > 0 (no es el glifo en blanco).
    const inkSum = sun.reduce((n, b) => n + (b.toString(2).match(/1/g)?.length ?? 0), 0);
    expect(inkSum).toBeGreaterThan(0);
  });

  it("0x2A difiere de IBM.CH (RUNES ≠ IBM: son fuentes distintas)", () => {
    const runesSun = parseFont(runesData())[0x2a]!;
    const ibmStar = parseFont(fontData())[0x2a]!; // en IBM.CH 0x2A es un rombo '*'
    expect([...runesSun]).not.toEqual([...ibmStar]);
  });

  it("las fases lunares (0x30-0x37) son glifos con tinta (círculos, no dígitos vacíos)", () => {
    const glyphs = parseFont(runesData());
    for (let phase = 0; phase < 8; phase++) {
      const g = glyphs[0x30 + phase]!;
      const ink = g.reduce((n, b) => n + (b.toString(2).match(/1/g)?.length ?? 0), 0);
      expect(ink).toBeGreaterThan(0);
    }
  });
});

describe("glyphToRgba", () => {
  it("píxel encendido = fg opaco, apagado = transparente", () => {
    const a = parseFont(fontData())[0x41]!;
    const rgba = glyphToRgba(a, [0xff, 0xff, 0xff]);
    expect(rgba.length).toBe(8 * 8 * 4);
    // (col0,row0) apagado → alpha 0; (col3,row0) encendido → blanco opaco.
    expect(rgba[3]).toBe(0); // alpha del píxel (0,0)
    const o = (0 * 8 + 3) * 4;
    expect([rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3]]).toEqual([0xff, 0xff, 0xff, 255]);
  });

  it("respeta el color de primer plano", () => {
    const a = parseFont(fontData())[0x41]!;
    const rgba = glyphToRgba(a, [0xaa, 0x55, 0x00]);
    const o = (0 * 8 + 3) * 4;
    expect([rgba[o], rgba[o + 1], rgba[o + 2]]).toEqual([0xaa, 0x55, 0x00]);
  });
});

describe("fontToAtlasRgba", () => {
  it("compone un atlas 128×64 (16 cols × 8 filas)", () => {
    const glyphs = parseFont(fontData());
    const atlas = fontToAtlasRgba(glyphs, 16);
    expect(atlas.width).toBe(128);
    expect(atlas.height).toBe(64);
    expect(atlas.rgba.length).toBe(128 * 64 * 4);
  });

  it("coloca el glifo 'A' (0x41) en la celda (col 1, fila 4)", () => {
    // 0x41 = 65 → col 65 % 16 = 1, fila ⌊65/16⌋ = 4. Su fila 0 (0x1E) tiene el
    // primer píxel encendido en la columna 3.
    const glyphs = parseFont(fontData());
    const atlas = fontToAtlasRgba(glyphs, 16);
    const cellX = 1 * 8;
    const cellY = 4 * 8;
    const px = ((cellY + 0) * atlas.width + (cellX + 3)) * 4;
    expect(atlas.rgba[px + 3]).toBe(255); // opaco
    const off = ((cellY + 0) * atlas.width + (cellX + 0)) * 4;
    expect(atlas.rgba[off + 3]).toBe(0); // transparente
  });
});
