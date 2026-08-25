/**
 * ATTRACT-FIGURES — las 4 figuras andantes de BRITISH.PTH del demo (task #19 seg.).
 * Avance de ruta + clasificación de carril (título vs caja). Deriva:
 * `re/notes/intro-attract-loop.md` (path_walk_anim 0x0050, tile 0x113).
 */
import { describe, expect, it } from "vitest";
import {
  figureLane,
  FIGURE_LANE_Y,
  initFigures,
  stepFigure,
  stepFigures,
  type AttractFigureRoute,
  type FigureState,
} from "../src/skin/fiel/attract-figures.js";

// Rutas mínimas: una del título (y44) y una de la caja (y143), como british-path.json.
const routes: AttractFigureRoute[] = [
  { start: { x: 68, y: 44 }, steps: [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }] },
  { start: { x: 78, y: 143 }, steps: [{ dx: 0, dy: 1 }, { dx: 0, dy: 1 }] },
];

describe("initFigures", () => {
  it("coloca cada figura en el arranque de su ruta, mirando a la izquierda", () => {
    const figs = initFigures(routes);
    expect(figs).toEqual([
      { routeIdx: 0, stepIdx: 0, x: 68, y: 44, facing: -1 },
      { routeIdx: 1, stepIdx: 0, x: 78, y: 143, facing: -1 },
    ]);
  });
});

describe("stepFigure (avance de un paso por la ruta)", () => {
  it("suma el delta del paso, avanza stepIdx y orienta según dx", () => {
    let f = initFigures(routes)[0]!;
    f = stepFigure(f, routes[0]!); // dx=1 → mira derecha
    expect(f).toEqual({ routeIdx: 0, stepIdx: 1, x: 69, y: 44, facing: 1 });
    f = stepFigure(f, routes[0]!); // dx=0 → conserva facing
    expect(f).toEqual({ routeIdx: 0, stepIdx: 2, x: 69, y: 45, facing: 1 });
    f = stepFigure(f, routes[0]!); // dx=-1 → mira izquierda
    expect(f).toEqual({ routeIdx: 0, stepIdx: 3, x: 68, y: 45, facing: -1 });
  });

  it("al AGOTAR la ruta reinicia en el arranque (bucle de attract), conservando facing", () => {
    let f: FigureState = { routeIdx: 1, stepIdx: 2, x: 78, y: 145, facing: 1 }; // ruta 1 agotada (len 2)
    f = stepFigure(f, routes[1]!);
    expect(f).toEqual({ routeIdx: 1, stepIdx: 0, x: 78, y: 143, facing: 1 });
  });

  it("recorrer la ruta entera vuelve exactamente al arranque (ciclo cerrado)", () => {
    let f = initFigures(routes)[1]!;
    const start = { x: f.x, y: f.y };
    for (let i = 0; i < routes[1]!.steps.length; i++) f = stepFigure(f, routes[1]!);
    // un paso más = wrap al arranque
    f = stepFigure(f, routes[1]!);
    expect({ x: f.x, y: f.y, stepIdx: f.stepIdx }).toEqual({ ...start, stepIdx: 0 });
  });
});

describe("stepFigures (todas a la vez)", () => {
  it("avanza cada figura por SU ruta en paralelo", () => {
    const figs = stepFigures(initFigures(routes), routes);
    expect(figs[0]).toMatchObject({ x: 69, y: 44, stepIdx: 1 }); // ruta0 paso0 dx=1
    expect(figs[1]).toMatchObject({ x: 78, y: 144, stepIdx: 1 }); // ruta1 paso0 dy=1
  });
});

describe("figureLane (carril título vs caja)", () => {
  it("clasifica por la Y de arranque respecto al umbral", () => {
    expect(figureLane(routes[0]!)).toBe("title"); // y44 < 100
    expect(figureLane(routes[1]!)).toBe("box"); // y143 >= 100
    expect(FIGURE_LANE_Y).toBe(100);
  });

  it("las 4 Y reales de british-path.json caen en los carriles esperados", () => {
    const ys = [44, 64, 143, 167];
    const lanes = ys.map((y) => figureLane({ start: { x: 0, y }, steps: [] }));
    expect(lanes).toEqual(["title", "title", "box", "box"]);
  });
});
