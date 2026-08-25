/**
 * Aspecto de la piel fiel (F-0, decisión del usuario) — `faithfulCanvasSize`
 * bloquea el ratio: PÍXEL CUADRADO por defecto (320/200), 4:3 época opcional.
 */
import { describe, expect, it } from "vitest";
import {
  aspectStretchEnabled,
  faithfulCanvasSize,
  mobileCanvasSize,
  setAspectStretch,
  ASPECT_SETTING_KEY,
} from "../src/skin/fiel/skin.js";

function fakeStore(): Pick<Storage, "getItem" | "setItem"> & {
  data: Map<string, string>;
} {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe("faithfulCanvasSize — lock de ratio", () => {
  it("cuadrado (default 1.0): ratio 320/200 con escala entera, a cualquier tamaño", () => {
    for (const [w, h] of [
      [1000, 1000],
      [640, 480],
      [1920, 1080],
      [321, 201],
    ] as const) {
      const s = faithfulCanvasSize(w, h, 1.0);
      expect(s.width / s.height).toBeCloseTo(320 / 200, 6); // 1.6, píxel cuadrado
      expect(s.width % 320).toBe(0); // escala entera
      expect(s.width).toBeLessThanOrEqual(Math.max(320, w)); // cabe (letterbox)
      expect(s.height).toBeLessThanOrEqual(Math.max(200, h));
    }
  });

  it("4:3 época (1.2): ratio 4:3 (320×240 lógico)", () => {
    const s = faithfulCanvasSize(1000, 1000, 1.2);
    expect(s.width / s.height).toBeCloseTo(4 / 3, 6);
  });

  it("escala mínima 1× aunque el contenedor sea diminuto (nunca 0)", () => {
    expect(faithfulCanvasSize(10, 10, 1.0)).toEqual({ width: 320, height: 200 });
    expect(faithfulCanvasSize(10, 10, 1.2)).toEqual({ width: 320, height: 240 });
  });

  it("REGRESIÓN escritorio: la escala fiel es SIEMPRE entera (múltiplo de 320) — no la toca el móvil", () => {
    // Anchos donde una escala fraccionaria diferiría (1.2×, 1.9×): la fiel DEBE seguir floor.
    expect(faithfulCanvasSize(390, 435, 1.0).width).toBe(320); // floor(1.21)=1
    expect(faithfulCanvasSize(844, 390, 1.0).width).toBe(320); // floor(1.95)=1
    expect(faithfulCanvasSize(700, 500, 1.0).width).toBe(640); // floor(2.18)=2
  });
});

describe("mobileCanvasSize — ajuste FRACCIONAL de móvil (llena la región)", () => {
  it("llena por ancho preservando el ratio, con escala NO entera", () => {
    // Región típica de portrait tras reservar la banda de controles.
    const s = mobileCanvasSize(390, 435, 1.0);
    expect(s.width).toBeCloseTo(390, 6); // llena el ancho (limita el ancho)
    expect(s.width / s.height).toBeCloseTo(320 / 200, 6); // ratio bloqueado
    expect(s.width % 320).not.toBe(0); // fraccional (a diferencia de la fiel)
  });

  it("llena por alto cuando el alto es el límite (apaisado)", () => {
    const s = mobileCanvasSize(844, 390, 1.0);
    expect(s.height).toBeCloseTo(390, 6); // llena el alto
    expect(s.width).toBeCloseTo(390 * (320 / 200), 6);
  });

  it("respeta el aspecto 4:3 época", () => {
    const s = mobileCanvasSize(480, 1000, 1.2);
    expect(s.width / s.height).toBeCloseTo(4 / 3, 6);
    expect(s.width).toBeCloseTo(480, 6);
  });
});

describe("setting de aspecto 4:3 — toggle persistente (shell)", () => {
  it("default: píxel cuadrado (setting ausente ⇒ false)", () => {
    expect(aspectStretchEnabled(fakeStore())).toBe(false);
  });

  it("set(true) persiste '1'; set(false) persiste '0'; la lectura los refleja", () => {
    const store = fakeStore();
    setAspectStretch(true, store);
    expect(store.data.get(ASPECT_SETTING_KEY)).toBe("1");
    expect(aspectStretchEnabled(store)).toBe(true);
    setAspectStretch(false, store);
    expect(aspectStretchEnabled(store)).toBe(false);
  });

  it("sin storage: no lanza y lee false", () => {
    expect(aspectStretchEnabled(undefined)).toBe(false);
    expect(() => setAspectStretch(true, undefined)).not.toThrow();
  });
});
