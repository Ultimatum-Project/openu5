/**
 * i18n F1c — ENRUTADO Latino-1 de acentos por CODEPOINT (fiel/font.ts +
 * fiel/textwindow.ts). Verifica que:
 *  (A) un cp≥0xA0 poblado se blitea del atlas de EXTENSIÓN con la fórmula L5;
 *  (B) sin atlas ext, o cp no poblado (NBSP/SHY), cae al atlas BASE (comportamiento
 *      actual) — así el inglés (ASCII) es byte-idéntico por construcción;
 *  (C) `printString` guarda los acentos LITERALES en la rejilla (no los mascara),
 *      alimentando el enrutado de la fuente.
 */
import { describe, expect, it } from "vitest";
import {
  FaithfulFont,
  GLYPH_PX,
  isExtGlyph,
  extGlyphCell,
  glyphCell,
  type GlyphSource,
} from "../src/skin/fiel/font.js";
import { TextWindow } from "../src/skin/fiel/textwindow.js";

const BASE = { tag: "base" } as unknown as GlyphSource;
const EXT = { tag: "ext" } as unknown as GlyphSource;

interface Call { img: unknown; sx: number; sy: number }
function spyCtx(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const ctx = {
    drawImage(img: unknown, sx: number, sy: number) {
      calls.push({ img, sx, sy });
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

describe("isExtGlyph — poblado = U+00A1..FF salvo 0xAD (SHY); 0xA0 (NBSP) no", () => {
  it("acepta acentos Latino-1", () => {
    for (const cp of [0xa1, 0xbf, 0xc1, 0xe1, 0xf1, 0xfc, 0xff]) expect(isExtGlyph(cp)).toBe(true);
  });
  it("rechaza NBSP/SHY, ASCII y el rango de atributo bajo", () => {
    for (const cp of [0xa0, 0xad, 0x41, 0x20, 0x00, 0x7f, 0x80, 0x9f]) expect(isExtGlyph(cp)).toBe(false);
  });
});

describe("extGlyphCell — rejilla 16×N desde 0xA0 (fórmula spec L5)", () => {
  it("0xA0 → (0,0); 0xA1 → (cell,0); 0xB0 → (0,cell)", () => {
    expect(extGlyphCell(0xa0, 8)).toEqual({ sx: 0, sy: 0 });
    expect(extGlyphCell(0xa1, 8)).toEqual({ sx: 8, sy: 0 });
    expect(extGlyphCell(0xb0, 8)).toEqual({ sx: 0, sy: 8 });
  });
  it("ñ (0xF1): col=(0xF1-0xA0)%16, row=//16, a 32px (HD)", () => {
    const i = 0xf1 - 0xa0;
    expect(extGlyphCell(0xf1, 32)).toEqual({ sx: (i % 16) * 32, sy: Math.floor(i / 16) * 32 });
  });
});

describe("FaithfulFont.drawGlyph — enrutado por codepoint", () => {
  it("CON atlas ext: un acento (ñ 0xF1) sale del atlas EXT en su celda", () => {
    const font = new FaithfulFont(BASE, EXT);
    const { ctx, calls } = spyCtx();
    font.drawGlyph(ctx, 0xf1, 0, 0, 1);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.img).toBe(EXT);
    expect({ sx: calls[0]!.sx, sy: calls[0]!.sy }).toEqual(extGlyphCell(0xf1, GLYPH_PX));
  });

  it("CON atlas ext: un ASCII ('A' 0x41) sigue saliendo del atlas BASE", () => {
    const font = new FaithfulFont(BASE, EXT);
    const { ctx, calls } = spyCtx();
    font.drawGlyph(ctx, 0x41, 0, 0, 1);
    expect(calls[0]!.img).toBe(BASE);
    expect({ sx: calls[0]!.sx, sy: calls[0]!.sy }).toEqual(glyphCell(0x41));
  });

  it("SIN atlas ext: el acento cae al atlas BASE (enmascarado, comportamiento actual)", () => {
    const font = new FaithfulFont(BASE); // sin ext
    const { ctx, calls } = spyCtx();
    font.drawGlyph(ctx, 0xf1, 0, 0, 1);
    expect(calls[0]!.img).toBe(BASE);
    expect({ sx: calls[0]!.sx, sy: calls[0]!.sy }).toEqual(glyphCell(0xf1)); // 0xF1 & 0x7F
  });

  it("NBSP/SHY con atlas ext: caen al BASE (no poblados)", () => {
    const font = new FaithfulFont(BASE, EXT);
    const { ctx, calls } = spyCtx();
    font.drawGlyph(ctx, 0xa0, 0, 0, 1); // NBSP
    font.drawGlyph(ctx, 0xad, 0, 0, 1); // SHY
    expect(calls[0]!.img).toBe(BASE);
    expect(calls[1]!.img).toBe(BASE);
  });
});

describe("TextWindow — printString guarda acentos LITERALES (no mascara)", () => {
  const rect = { leftCol: 0, topRow: 0, rightCol: 40, botRow: 4 };

  it("«¡Canción!» conserva ¡(0xA1), ó(0xF3), n(0x6E) en la rejilla", () => {
    const w = new TextWindow(rect);
    w.printString("¡Canción!");
    const row0 = Array.from(w.cells.slice(0, w.cols));
    expect(row0[0]).toBe(0xa1); // ¡ literal (no mascarado a 0x21 '!')
    expect(row0).toContain(0xf3); // ó literal
    expect(row0[1]).toBe(0x43); // 'C' ASCII intacto
  });

  it("putGlyph escribe el codepoint literal y avanza el cursor", () => {
    const w = new TextWindow(rect);
    w.putGlyph(0xf1); // ñ
    expect(w.cells[0]).toBe(0xf1);
    expect(w.curCol).toBe(1);
  });

  it("un string ASCII (inglés) no cambia: byte-idéntico celda a celda", () => {
    const a = new TextWindow(rect);
    const b = new TextWindow(rect);
    a.printString("Blocked!");
    b.printString("Blocked!");
    expect(Array.from(a.cells)).toEqual(Array.from(b.cells));
    expect(a.cells[0]).toBe(0x42); // 'B'
  });
});
