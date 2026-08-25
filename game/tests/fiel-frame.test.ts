/**
 * CHROME EGA (E1-S8b) — fija la geometría LITERAL derivada de paint_screen_frame
 * (0x637e) y que applyFrame la emita en el orden del binario. Los índices de
 * color son Clase C (píxel-diff); aquí se verifica la ESTRUCTURA.
 */
import { describe, expect, it } from "vitest";
import {
  FRAME_FILLS,
  FRAME_GLYPHS,
  FRAME_SEGMENTS,
  SCREEN_H,
  SCREEN_W,
  VIEWPORT,
  applyFrame,
} from "../src/skin/fiel/frame.js";
import { FaithfulFont, type GlyphSource } from "../src/skin/fiel/font.js";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  style: string;
}

function spyCtx(): { ctx: CanvasRenderingContext2D; rects: Rect[]; count: { glyphs: number } } {
  const rects: Rect[] = [];
  const count = { glyphs: 0 };
  const state = { fillStyle: "" };
  const ctx = {
    get fillStyle() {
      return state.fillStyle;
    },
    set fillStyle(v: string) {
      state.fillStyle = v;
    },
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h, style: state.fillStyle });
    },
    drawImage() {
      count.glyphs++;
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, rects, count };
}

describe("frame.ts — geometría derivada (0x637e)", () => {
  it("la caja del viewport son las 4 esquinas (7,7)-(184,184)", () => {
    const xs = FRAME_SEGMENTS.slice(0, 4).flatMap((s) => [s.x0, s.x1]);
    const ys = FRAME_SEGMENTS.slice(0, 4).flatMap((s) => [s.y0, s.y1]);
    expect(Math.min(...xs)).toBe(7);
    expect(Math.max(...xs)).toBe(0xb8); // 184
    expect(Math.min(...ys)).toBe(7);
    expect(Math.max(...ys)).toBe(0xb8);
  });

  it("el viewport 11×11 arranca en (8,8) con tiles de 16 px = 176×176", () => {
    expect(VIEWPORT).toEqual({ x: 8, y: 8, tile: 16, tiles: 11 });
    expect(VIEWPORT.tile * VIEWPORT.tiles).toBe(176); // cabe en la caja (7..184)
  });

  it("los glifos de esquina son runas 0x7b/0x7c/0x7d en celdas (0,0)/(39,0)/(0,23)", () => {
    expect(FRAME_GLYPHS.map((g) => g.code)).toEqual([0x7b, 0x7c, 0x7d]);
    expect(FRAME_GLYPHS[1]).toMatchObject({ col: 0x27, row: 0 }); // col 39
    expect(FRAME_GLYPHS[2]).toMatchObject({ col: 0, row: 0x17 }); // fila 23
  });

  it("la barra superior cubre el ancho completo (0..319, y 0..6)", () => {
    expect(FRAME_FILLS[0]).toEqual({ x0: 0, y0: 0, x1: 0x13f, y1: 6 });
  });

  it("el separador viewport|panel está en x=185..191", () => {
    const sep = FRAME_FILLS.find((r) => r.x0 === 0xb9 && r.x1 === 0xbf && r.y1 === 0xbf);
    expect(sep).toBeDefined();
  });
});

describe("applyFrame — emite el chrome en orden", () => {
  it("clear a pantalla completa + barras + glifos + segmentos", () => {
    const font = new FaithfulFont({} as GlyphSource);
    const spy = spyCtx();
    applyFrame(spy.ctx, font);
    // 1 clear + 7 barras + 3 limpiezas de celda de esquina (OPACO, redondea) + 14
    // segmentos = 25 fillRect; 3 glifos. La limpieza a negro por glifo de esquina calca
    // el `put_glyph` OPACO del binario (el bisel corta la barra azul → esquina redondeada #74).
    expect(spy.rects.length).toBe(1 + FRAME_FILLS.length + FRAME_GLYPHS.length + FRAME_SEGMENTS.length);
    expect(spy.count.glyphs).toBe(FRAME_GLYPHS.length);
    // El primer rect es el clear de 320×200 desde (0,0).
    expect(spy.rects[0]).toMatchObject({ x: 0, y: 0, w: SCREEN_W, h: SCREEN_H });
  });
});
