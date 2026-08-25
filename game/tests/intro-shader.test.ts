/**
 * Filtro «shader» de la intro (task #70b) — política de filtrado por fase.
 *
 * El overlay xBR es ADITIVO y sólo filtra ARTE, nunca texto. Aquí se fija el plan
 * puro `introFilterPlan`: qué fases filtran y con qué huecos de texto (sin DOM).
 */
import { describe, expect, it } from "vitest";
import { introFilterPlan } from "../src/ui/intro-shader.js";
import { INTRO_PANEL } from "../src/skin/fiel/intro.js";
import { SCREEN_H, SCREEN_W } from "../src/skin/fiel/frame.js";

describe("intro shader — plan de filtro por fase (#70b)", () => {
  it("logo y title: pantalla entera, sin huecos (arte puro)", () => {
    for (const p of ["logo", "title"]) {
      const plan = introFilterPlan(p);
      expect(plan.region).toBe("full");
      expect(plan.holes).toHaveLength(0);
    }
  });

  it("attract: pantalla entera con hueco en la banda de rótulo del demo", () => {
    const plan = introFilterPlan("attract");
    expect(plan.region).toBe("full");
    expect(plan.holes).toHaveLength(1);
    // El hueco está en la fila de rótulo (y=192) del pie del panel, no en el arte.
    const hole = plan.holes[0]!;
    expect(hole.y).toBeGreaterThanOrEqual(INTRO_PANEL.y1 - 9);
    expect(hole.y + hole.h).toBeLessThanOrEqual(SCREEN_H);
  });

  it("menu y credits: sólo la franja superior de arte (logo), panel inferior NEAREST", () => {
    for (const p of ["menu", "credits"]) {
      const plan = introFilterPlan(p);
      expect(plan.region).not.toBe("full");
      expect(plan.region).not.toBeNull();
      const rect = plan.region as { x: number; y: number; w: number; h: number };
      expect(rect).toEqual({ x: 0, y: 0, w: SCREEN_W, h: INTRO_PANEL.y0 });
      expect(plan.holes).toHaveLength(0);
    }
  });

  it("gitana (name/sex/quiz/story): filtra el ARTE registrado (texto fuera → nearest)", () => {
    for (const p of ["name", "sex", "quiz", "story"]) {
      expect(introFilterPlan(p).region).toBe("art");
      expect(introFilterPlan(p).holes).toHaveLength(0);
    }
  });

  it("fases desconocidas: sin filtro (overlay transparente)", () => {
    expect(introFilterPlan("whatever").region).toBeNull();
  });
});
