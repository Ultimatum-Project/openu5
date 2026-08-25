/**
 * i18n — guard de la EXTENSIÓN ESPAÑOLA de la fuente PROPORCIONAL
 * (`tools/gen-proport-ext.mjs`). El atlas `proport-font.png` es gitignored y lo
 * carga el navegador (proport.ts), así que aquí guardamos el DISEÑO fuente (la
 * tabla `EXT_GLYPHS` del generador): que cubre exactamente los glifos que el
 * español necesita en la vía proporcional y que cada bitmap está bien formado
 * (8 filas, ancho uniforme > 0, sólo tinta/transparente). Si un glifo se rompe o
 * falta, el texto lírico de la intro (The Summoning / gitana) perdería ese signo
 * (glifo ausente = avance 0 en proport.ts, el carácter DESAPARECE).
 */
import { describe, expect, it } from "vitest";
// @ts-expect-error — generador .mjs sin tipos (tool), importado sólo por su tabla.
import { EXT_GLYPHS, HEIGHT } from "../tools/gen-proport-ext.mjs";

interface ExtGlyph {
  code: number;
  rows: string[];
}
const GLYPHS = EXT_GLYPHS as ExtGlyph[];

/** Los glifos ES que la vía proporcional necesita (minúsculas acentuadas + ñ/ü + ¿¡). */
const REQUIRED = "áéíóúüñ¿¡";

describe("proport ext — cobertura del español", () => {
  it("cubre EXACTAMENTE los codepoints NFC de áéíóúüñ¿¡", () => {
    const have = new Set(GLYPHS.map((g) => g.code));
    const want = new Set([...REQUIRED].map((c) => c.codePointAt(0)!));
    expect(have).toEqual(want);
  });

  it("cada carácter español requerido tiene su glifo (no desaparecería al render)", () => {
    const byCode = new Map(GLYPHS.map((g) => [g.code, g]));
    for (const ch of REQUIRED) {
      const g = byCode.get(ch.codePointAt(0)!);
      expect(g, `falta glifo para «${ch}»`).toBeDefined();
    }
  });

  it("NO autora mayúsculas acentuadas (convención de época: acento omitido en capital)", () => {
    // Á É Í Ó Ú Ñ Ü — la celda 8px no deja techo sobre la mayúscula; se omiten a
    // propósito. Este test CONGELA esa decisión (si algún día se autoran, se revisa).
    for (const cp of [0xc1, 0xc9, 0xcd, 0xd3, 0xda, 0xd1, 0xdc]) {
      expect(GLYPHS.some((g) => g.code === cp)).toBe(false);
    }
  });
});

describe("proport ext — bitmaps bien formados", () => {
  it("cada glifo: 8 filas, ancho uniforme > 0, sólo '#'/'.'", () => {
    for (const g of GLYPHS) {
      expect(g.rows).toHaveLength(HEIGHT);
      const w = g.rows[0]!.length;
      expect(w).toBeGreaterThan(0);
      for (const row of g.rows) {
        expect(row).toHaveLength(w); // ancho uniforme (rectángulo)
        expect(/^[#.]*$/.test(row)).toBe(true);
      }
    }
  });

  it("cada glifo tiene al menos un píxel de tinta (no es una celda vacía)", () => {
    for (const g of GLYPHS) {
      expect(g.rows.join("").includes("#"), `glifo ${g.code.toString(16)} vacío`).toBe(true);
    }
  });

  it("codes únicos", () => {
    expect(new Set(GLYPHS.map((g) => g.code)).size).toBe(GLYPHS.length);
  });
});
