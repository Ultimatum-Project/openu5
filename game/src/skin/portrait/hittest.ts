/**
 * RE-FLOW VERTICAL — hit-test INVERSO (PURO, sin DOM).
 *
 * La otra mitad del trabajo. La fiel y la shader invierten una transformada UNIFORME
 * (`px = (clientX−left)/width · 320`): con el re-flow eso caería fuera del mapa y el
 * scrollback del log dejaría de responder. Aquí se invierte PANE A PANE: dado un punto
 * en coords del canvas de destino se busca el pane que lo contiene y se devuelve el
 * punto en coords LÓGICAS 320×200 — desde ahí, el consumidor aplica EXACTAMENTE la misma
 * aritmética que la fiel (`floor((px−VIEWPORT.x)/tile)`, `pointInConsole`…).
 *
 * Por qué así y no con una tabla de casos: la inversa por pane hace que la semántica del
 * tap sea, por construcción, la MISMA que la del layout clásico (misma fórmula, mismas
 * constantes importadas) — no una réplica que pueda derivar.
 */
import { VIEW_WINDOW } from "../api.js";
import { VIEWPORT } from "../fiel/frame.js";
import type { Pane, PortraitLayout } from "./layout.js";

/** Punto en la pantalla LÓGICA del original (320×200), con la región de la que sale. */
export type Hit =
  | { region: "map"; col: number; row: number; px: number; py: number }
  | { region: "log"; px: number; py: number }
  | { region: "panel"; px: number; py: number }
  | { region: "sky"; px: number; py: number }
  | { region: "winds"; px: number; py: number }
  | null;

/** ¿El punto de destino cae dentro del pane? (semiabierto por arriba, como los canvas). */
export function paneContains(p: Pane, dx: number, dy: number): boolean {
  return dx >= p.dx && dx < p.dx + p.dw && dy >= p.dy && dy < p.dy + p.dh;
}

/** Destino → FUENTE lógica dentro de un pane (inversa exacta del `drawImage`). */
export function paneToSource(p: Pane, dx: number, dy: number): { px: number; py: number } {
  return {
    px: p.sx + ((dx - p.dx) / p.dw) * p.sw,
    py: p.sy + ((dy - p.dy) / p.dh) * p.sh,
  };
}

/**
 * Hit-test del re-flow. `dx`/`dy` van en px del CANVAS DE DESTINO (el llamador ya
 * convirtió las coords de cliente con `getBoundingClientRect` y la escala CSS→backbuffer).
 *
 * Orden de consulta = orden de PINTADO invertido: las bandas (cielo/vientos) pisan la
 * caja, así que se prueban ANTES; y la costura antes que log/panel.
 */
export function portraitHitTest(L: PortraitLayout, dx: number, dy: number): Hit {
  if (L.kind === "clasico") return classicHit(L.full, dx, dy);
  const p = L.panes;
  if (paneContains(p.sky, dx, dy)) return { region: "sky", ...paneToSource(p.sky, dx, dy) };
  if (paneContains(p.winds, dx, dy)) return { region: "winds", ...paneToSource(p.winds, dx, dy) };
  if (paneContains(p.box, dx, dy)) {
    const { px, py } = paneToSource(p.box, dx, dy);
    return { region: "map", ...cellOf(px, py), px, py };
  }
  if (paneContains(p.seamLog, dx, dy)) return { region: "log", ...paneToSource(p.seamLog, dx, dy) };
  if (paneContains(p.log, dx, dy)) return { region: "log", ...paneToSource(p.log, dx, dy) };
  if (p.seamPanel && paneContains(p.seamPanel, dx, dy)) {
    return { region: "panel", ...paneToSource(p.seamPanel, dx, dy) };
  }
  if (paneContains(p.panel, dx, dy)) return { region: "panel", ...paneToSource(p.panel, dx, dy) };
  // Las dos piezas en que se parte el panel al estirar la caja de jugadores (01-08). Sin
  // esto, la mitad inferior de la columna (KPIs y el tramo estirado) dejaría de ser
  // «panel» para el hit-test y el scroll de la lista de Ztats moriría ahí en silencio.
  if (p.panelStretch && paneContains(p.panelStretch, dx, dy)) {
    return { region: "panel", ...paneToSource(p.panelStretch, dx, dy) };
  }
  if (p.panelBottom && paneContains(p.panelBottom, dx, dy)) {
    return { region: "panel", ...paneToSource(p.panelBottom, dx, dy) };
  }
  return null;
}

/**
 * Celda del visor 11×11 para un punto lógico. MISMA fórmula que
 * `fiel/skin.ts` (`floor((px − VIEWPORT.x) / tile)`) con las MISMAS constantes
 * importadas: el re-flow gana escala, jamás tiles.
 */
export function cellOf(px: number, py: number): { col: number; row: number } {
  return {
    col: Math.floor((px - VIEWPORT.x) / VIEWPORT.tile),
    row: Math.floor((py - VIEWPORT.y) / VIEWPORT.tile),
  };
}

/** ¿La celda cae dentro de la ventana lógica? (el tap fuera del visor no camina). */
export function cellInWindow(col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < VIEW_WINDOW && row < VIEW_WINDOW;
}

/** Hit del layout clásico/bypass: transformada uniforme del 320×200 letterboxeado. */
function classicHit(full: Pane, dx: number, dy: number): Hit {
  if (!paneContains(full, dx, dy)) return null;
  const { px, py } = paneToSource(full, dx, dy);
  const { col, row } = cellOf(px, py);
  if (cellInWindow(col, row)) return { region: "map", col, row, px, py };
  // Fuera del visor: la clasificación panel/log la hace el consumidor con sus rects de
  // celdas (CONSOLE_RECT / ZTATS_LIST_RECT), igual que hoy hacen fiel y shader.
  return { region: py >= 88 ? "log" : "panel", px, py };
}

/** ¿El punto lógico cae dentro de un rect de CELDAS de 8 px (calco de `pointInConsole`)? */
export function inCellRect(
  rect: { leftCol: number; topRow: number; rightCol: number; botRow: number },
  px: number,
  py: number,
): boolean {
  return (
    px >= rect.leftCol * 8 &&
    px < (rect.rightCol + 1) * 8 &&
    py >= rect.topRow * 8 &&
    py < (rect.botRow + 1) * 8
  );
}
