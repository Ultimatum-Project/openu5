/**
 * Caja Food/Gold/Fecha del panel (F-D) — F:food izq, G:gold der, fecha centrada
 * (video-diff §A-bis punto 2).
 */
import { describe, expect, it } from "vitest";
import { panelInfoGrid } from "../src/skin/fiel/panel.js";

const COLS = 14;

describe("panelInfoGrid (F-D)", () => {
  it("L1: F:food a la izquierda, G:gold justificado a la derecha", () => {
    const g = panelInfoGrid(19, 8803, 5, 4, 139, COLS, 2);
    const r0 = String.fromCharCode(...g.slice(0, COLS));
    expect(r0.startsWith("F:19")).toBe(true);
    expect(r0.endsWith("G:8803")).toBe(true); // gold pegado al borde derecho
  });

  it("L2: fecha MES-DÍA-año centrada (orden del original)", () => {
    // args = (food, gold, day, month, year, …); día=4, mes=5 → render "5-4-139"
    // (MES-DÍA-año, orden del original; fijado por el arnés mismo-estado #26 f2).
    const g = panelInfoGrid(19, 8803, 4, 5, 139, COLS, 2);
    const raw = String.fromCharCode(...g.slice(COLS, COLS * 2));
    expect(raw.trim()).toBe("5-4-139"); // mes(5)-día(4)-año
    expect(raw.startsWith(" ")).toBe(true); // centrada: margen a la izquierda
  });
});
