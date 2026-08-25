/**
 * ATTRACT-FIGURES — las 4 figuras andantes de BRITISH.PTH del demo de portada
 * (task #19 seguimiento). El attract del original camina **4 figuras** por sus rutas
 * reales (INTRO.OVL `path_walk_anim` 0x0050; `[0x5356]=0x113`=tile 275 del sprite;
 * `re/notes/intro-attract-loop.md`): las rutas 0 y 1 arrancan sobre el TÍTULO
 * (y=44/64) y las 2 y 3 DENTRO de la caja del demo (y=143/167), caminando por el
 * cuarto. Cada ruta son cientos de pasos de ±1 px ya decodificados en `pth.ts`
 * (`british-path.json`: 856/548/411/964 pasos). Módulo PURO (avance de ruta +
 * clasificación de carril); el blit del sprite vive en `ui/faithful-intro.ts`.
 */

/** Una ruta de figura (parser `pth.ts` → british-path.json). */
export interface AttractFigureRoute {
  start: { x: number; y: number };
  steps: readonly { dx: number; dy: number }[];
}

/** Estado vivo de una figura: en qué ruta va, el paso, la posición y hacia dónde mira. */
export interface FigureState {
  routeIdx: number;
  stepIdx: number;
  x: number;
  y: number;
  /** -1 = mira a la IZQUIERDA (sprite base RidingHorseLeft 0x113), 1 = a la derecha (espejo). */
  facing: -1 | 1;
}

/** Coloca cada figura al ARRANQUE de su ruta, mirando a la izquierda (sprite base). */
export function initFigures(routes: readonly AttractFigureRoute[]): FigureState[] {
  return routes.map((r, i) => ({
    routeIdx: i,
    stepIdx: 0,
    x: r.start.x,
    y: r.start.y,
    facing: -1,
  }));
}

/**
 * Avanza UNA figura un paso por su ruta; al agotarla, REINICIA en su arranque (bucle
 * de attract del original — las rutas se repiten mientras el demo corre). El sentido
 * (`facing`) sigue el signo del paso horizontal; los pasos verticales lo conservan.
 * Puro (devuelve estado nuevo).
 */
export function stepFigure(f: FigureState, route: AttractFigureRoute): FigureState {
  if (f.stepIdx >= route.steps.length) {
    return { routeIdx: f.routeIdx, stepIdx: 0, x: route.start.x, y: route.start.y, facing: f.facing };
  }
  const s = route.steps[f.stepIdx]!;
  const facing = s.dx > 0 ? 1 : s.dx < 0 ? -1 : f.facing;
  return {
    routeIdx: f.routeIdx,
    stepIdx: f.stepIdx + 1,
    x: f.x + s.dx,
    y: f.y + s.dy,
    facing,
  };
}

/** Avanza TODAS las figuras un paso (cada una por su ruta). Puro. */
export function stepFigures(
  figs: readonly FigureState[],
  routes: readonly AttractFigureRoute[],
): FigureState[] {
  return figs.map((f) => stepFigure(f, routes[f.routeIdx]!));
}

/**
 * Umbral de Y que separa los dos CARRILES de figuras (medido de british-path.json:
 * las rutas del título arrancan en y=44/64, las de la caja en y=143/167). Una figura
 * cuyo arranque cae por encima camina sobre el TÍTULO; por debajo, dentro de la CAJA.
 */
export const FIGURE_LANE_Y = 100;

/** Carril de una ruta según su Y de arranque: 'title' (sobre el logo) o 'box' (en el panel). */
export function figureLane(route: AttractFigureRoute): "title" | "box" {
  return route.start.y < FIGURE_LANE_Y ? "title" : "box";
}
