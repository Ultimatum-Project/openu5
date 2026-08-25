/**
 * Gótica de intro HD (task #73 EJE 2, L7 — cableado). Verifica, sin navegador:
 *  (1) el sumidero de `FaithfulProportFont` es OUTPUT-NEUTRAL (con o sin sumidero, la
 *      fuente blitea EXACTAMENTE los mismos rects → la intro fiel queda byte-idéntica) y
 *      ENUMERA las celdas correctas (code + posición lógica + ancho de tinta);
 *  (2) `HdProportFont.drawGlyph` mapea code → rect fuente del atlas HD y destino, y hace
 *      no-op (fallback) para un código ausente.
 * Los píxeles de los atlas se validan en el generador (font_proport.py); aquí se fija el
 * CABLEADO (sumidero + mapeo del re-blit).
 */
import { describe, expect, it } from "vitest";
import {
  FaithfulProportFont,
  type ProportGlyphRecord,
  type ProportGlyphRect,
} from "../src/skin/fiel/proport.js";
import { HdProportFont } from "../src/skin/shader/hdproport.js";

interface DrawCall {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/** Contexto 2D espía: registra los drawImage de 9 argumentos. */
function spyCtx(): { ctx: CanvasRenderingContext2D; calls: DrawCall[] } {
  const calls: DrawCall[] = [];
  const ctx = {
    drawImage(
      _img: unknown,
      sx: number,
      sy: number,
      sw: number,
      sh: number,
      dx: number,
      dy: number,
      dw: number,
      dh: number,
    ) {
      calls.push({ sx, sy, sw, sh, dx, dy, dw, dh });
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const ATLAS = {} as CanvasImageSource;
// Manifiesto 8px de juguete: 'A'=0x41 en x=0 w=6, 'B'=0x42 en x=6 w=7, espacio w=0.
const GLYPHS: ProportGlyphRect[] = [
  { code: 0x20, x: 0, width: 0 },
  { code: 0x41, x: 0, width: 6 },
  { code: 0x42, x: 6, width: 7 },
];

describe("FaithfulProportFont — sumidero de captura (L7)", () => {
  it("es OUTPUT-NEUTRAL: con o sin sumidero, los mismos drawImage al atlas", () => {
    const font = FaithfulProportFont.fromManifest(ATLAS, 8, GLYPHS);
    const a = spyCtx();
    font.drawLine(a.ctx, "AB", 10, 20);
    const b = spyCtx();
    const recs: ProportGlyphRecord[] = [];
    font.setGlyphSink({ frameStart: () => {}, record: (r) => recs.push(r) });
    font.drawLine(b.ctx, "AB", 10, 20);
    expect(b.calls).toEqual(a.calls); // pintado idéntico
  });

  it("ENUMERA cada glifo con code + posición lógica + ancho de tinta", () => {
    const font = FaithfulProportFont.fromManifest(ATLAS, 8, GLYPHS);
    const recs: ProportGlyphRecord[] = [];
    let started = 0;
    font.setGlyphSink({ frameStart: () => (started += 1), record: (r) => recs.push(r) });
    font.beginFrame();
    // "A B": A en x=10 (w=6, +1 tracking → avance 7), espacio (w=4), B en x=10+7+4=21.
    font.drawLine(spyCtx().ctx, "A B", 10, 20);
    expect(started).toBe(1);
    expect(recs).toEqual([
      { code: 0x41, x: 10, y: 20, width: 6 },
      { code: 0x42, x: 21, y: 20, width: 7 },
    ]);
  });

  it("no enumera el espacio (glifo w=0) ni códigos ausentes", () => {
    const font = FaithfulProportFont.fromManifest(ATLAS, 8, GLYPHS);
    const recs: ProportGlyphRecord[] = [];
    font.setGlyphSink({ frameStart: () => {}, record: (r) => recs.push(r) });
    font.drawLine(spyCtx().ctx, "A?A", 0, 0); // '?' (0x3f) no está en el manifiesto
    expect(recs.map((r) => r.code)).toEqual([0x41, 0x41]);
  });
});

describe("HdProportFont.drawGlyph — mapeo del re-blit HD (L7)", () => {
  // Manifiesto HD ×4: 'A' en x=0 w=24, 'B' en x=24 w=28, alto 32.
  const HD = HdProportFont.fromManifest(ATLAS, {
    height: 32,
    glyphs: [
      { code: 0x41, x: 0, width: 24 },
      { code: 0x42, x: 24, width: 28 },
    ],
  });

  it("blitea la celda HD del código al rect de dispositivo dado", () => {
    const { ctx, calls } = spyCtx();
    // Glifo 'B' capturado en (x=21,y=20,width=7) a escala s=6 → dest (126,120,42,48).
    HD.drawGlyph(ctx, 0x42, 21 * 6, 20 * 6, 7 * 6, 8 * 6);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ sx: 24, sy: 0, sw: 28, sh: 32, dx: 126, dy: 120, dw: 42, dh: 48 });
  });

  it("no-op (fallback) para un código ausente del atlas", () => {
    const { ctx, calls } = spyCtx();
    HD.drawGlyph(ctx, 0x3f, 0, 0, 24, 48); // '?' no está
    expect(calls).toHaveLength(0);
  });
});
