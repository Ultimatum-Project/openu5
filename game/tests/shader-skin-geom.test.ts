/**
 * Piel «shader» (task #70) — geometría de composición de las DOS capas.
 *
 * La piel sube la pantalla lógica 320×200 a un backbuffer ×S y blitea el mundo
 * filtrado EXACTAMENTE sobre el rect del viewport; el texto/chrome (fuera de ese
 * rect) queda a escala entera y byte-idéntico a la fiel. Aquí se fija esa geometría
 * (pura, sin DOM/WebGL — el filtro y el swap se verifican en QA de navegador).
 */
import { describe, expect, it } from "vitest";
import { shaderCanvasSize, shaderWorldRect } from "../src/skin/shader/skin.js";
import { SCREEN_H, SCREEN_W, VIEWPORT } from "../src/skin/fiel/frame.js";

const WORLD_PX = VIEWPORT.tiles * VIEWPORT.tile; // 176

describe("piel shader — geometría de las dos capas", () => {
  it("backbuffer = pantalla lógica ×S", () => {
    expect(shaderCanvasSize(1)).toEqual({ width: SCREEN_W, height: SCREEN_H });
    expect(shaderCanvasSize(6)).toEqual({ width: 1920, height: 1200 });
  });

  it("el rect del mundo es el VIEWPORT escalado (8,8)+176 → (48,48)+1056 a ×6", () => {
    expect(shaderWorldRect(1)).toEqual({ x: 8, y: 8, size: WORLD_PX });
    expect(shaderWorldRect(6)).toEqual({ x: 48, y: 48, size: 1056 });
  });

  it("el mundo filtrado cabe SIEMPRE dentro del backbuffer (no pisa el borde)", () => {
    for (const s of [1, 2, 3, 6, 9]) {
      const bb = shaderCanvasSize(s);
      const wr = shaderWorldRect(s);
      expect(wr.x).toBeGreaterThanOrEqual(0);
      expect(wr.y).toBeGreaterThanOrEqual(0);
      expect(wr.x + wr.size).toBeLessThanOrEqual(bb.width);
      expect(wr.y + wr.size).toBeLessThanOrEqual(bb.height);
    }
  });

  it("el rect del mundo es proporcional a S (escala lineal exacta)", () => {
    const base = shaderWorldRect(1);
    for (const s of [2, 3, 6, 9]) {
      const wr = shaderWorldRect(s);
      expect(wr.x).toBe(base.x * s);
      expect(wr.y).toBe(base.y * s);
      expect(wr.size).toBe(base.size * s);
    }
  });
});
