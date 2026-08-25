// @vitest-environment jsdom
/**
 * #370 — la PRIMERA tecla tras cerrar el panel de partidas con RATÓN se tragaba.
 * MEDIDO en el juego real (sonda Chromium, worktree fix-370): tras el clic en Close el
 * foco queda RETENIDO en el botón dentro del panel `display:none` (Chromium lo recoloca
 * a `body` de forma ASÍNCRONA, un frame después) y la tecla inmediata muere en el
 * `stopPropagation` incondicional del panel oculto — sin llegar al `keydown` de `window`
 * (main.ts), el ÚNICO sitio donde el juego consume. Barrido de retardos: a 0 ms SE TRAGA,
 * a 16 ms llega. Misma estructura y misma ventana de un frame que #368 (replay-ui).
 *
 * El arreglo son las dos mitades del patrón compartido (`ui/foco.ts`) y cada una tiene
 * aquí su aserto PROPIO (quitar una sola ⇒ su test en rojo): `hide()` suelta el foco, y
 * el panel oculto es INERTE al teclado. El testigo del juego es un listener en `window`
 * en burbuja — la MISMA superficie y fase que el consumidor real.
 *
 * El SELECTOR (ui/selector.ts) comparte la estructura latente pero NO la ficha: su
 * `show()` tiene CERO llamadores en src/ desde #268 (pickers fieles) — nunca se muestra,
 * nunca retiene foco. Queda declarado en la nota del carril, no se toca aquí.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { SavePanel } from "../src/ui/savepanel.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";

function load<T>(rel: string): T {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/** GameState REAL (createNewGame sobre el initial-state extraído — sin `as` que pudra el fixture). */
function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}

/** Deps mínimas REALES: los callbacks son el contrato del consumidor, aquí no-ops legítimos. */
function monta(): { panel: SavePanel; root: HTMLElement } {
  const panel = new SavePanel(document.body, {
    onLoad: () => {},
    onMessage: () => {},
    onAnalyticsEvent: () => {},
  });
  return { panel, root: panel.rootEl };
}

/** Testigo del juego: listener de `window` en BURBUJA (misma fase que main.ts). */
function testigo(): { keys: string[]; retira: () => void } {
  const keys: string[] = [];
  const fn = (ev: KeyboardEvent): void => {
    keys.push(ev.key);
  };
  window.addEventListener("keydown", fn);
  return { keys, retira: () => window.removeEventListener("keydown", fn) };
}

const tecla = (donde: EventTarget, key: string): void => {
  donde.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
};

afterEach(() => {
  document.body.innerHTML = "";
  window.localStorage.clear();
});

describe("#370 — el panel de partidas cerrado no roba el teclado del juego", () => {
  it("CONTROL del testigo: una tecla nacida en body SÍ llega a window", () => {
    monta();
    const w = testigo();
    tecla(document.body, "ArrowRight");
    expect(w.keys).toEqual(["ArrowRight"]);
    w.retira();
  });

  it("hide() SUELTA el foco: tras cerrar con el botón Close, el foco vuelve a body", () => {
    const { panel, root } = monta();
    panel.show(freshState(), "Britain");
    const closeBtn = root.querySelector<HTMLButtonElement>(".save-btn-close")!;
    // Chromium enfoca el botón en el mousedown del clic que cierra: se reproduce ese foco.
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn); // control: el fixture enfoca de verdad
    closeBtn.click(); // dispara hide() por el listener real del botón
    expect(panel.visible).toBe(false);
    expect(document.activeElement).toBe(document.body);
  });

  it("panel OCULTO = INERTE: un keydown nacido dentro llega a window", () => {
    const { panel, root } = monta();
    panel.show(freshState(), "Britain");
    panel.hide();
    const w = testigo();
    // Sin exigir foco: se dispara directamente en el botón del panel oculto — es la
    // guarda del listener lo que se mide, no el blur.
    tecla(root.querySelector(".save-btn-close")!, "ArrowUp");
    expect(w.keys).toEqual(["ArrowUp"]);
    w.retira();
  });

  it("CONTROL: panel VISIBLE sigue conteniendo su teclado (escribir un nombre no es jugar)", () => {
    const { panel, root } = monta();
    panel.show(freshState(), "Britain");
    const w = testigo();
    tecla(root.querySelector(".save-name")!, "ArrowDown");
    expect(w.keys).toEqual([]);
    w.retira();
  });

  it("Escape VISIBLE sigue cerrando el panel sin llegar al juego (F1 de la auditoría UX intacto)", () => {
    const { panel, root } = monta();
    panel.show(freshState(), "Britain");
    const w = testigo();
    tecla(root.querySelector(".save-name")!, "Escape");
    expect(panel.visible).toBe(false);
    expect(w.keys).toEqual([]);
    w.retira();
  });

  it("el camino del usuario entero: clic en Close y la SIGUIENTE tecla llega al juego", () => {
    const { panel, root } = monta();
    panel.show(freshState(), "Britain");
    const closeBtn = root.querySelector<HTMLButtonElement>(".save-btn-close")!;
    closeBtn.focus(); // el mousedown de Chromium
    closeBtn.click();
    expect(panel.visible).toBe(false);
    const w = testigo();
    // La tecla del usuario nace donde esté el foco AHORA — exactamente el gesto de la sonda.
    tecla(document.activeElement ?? document.body, "ArrowRight");
    expect(w.keys).toEqual(["ArrowRight"]);
    w.retira();
  });
});
