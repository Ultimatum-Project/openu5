// @vitest-environment jsdom
/**
 * #368 — la PRIMERA tecla tras cerrar el panel de repeticiones con RATÓN se tragaba
 * (medido en el e2e: 5 de 6 grabadas). Mecanismo, con sus dos mitades:
 *
 *   1. `close()` sólo ocultaba (`panel.hidden = true`) y el foco se quedaba en el botón
 *      pulsado, DENTRO del panel oculto.
 *   2. El `keydown` del panel hacía `stopPropagation` incondicional — también oculto —
 *      así que la tecla nacida en ese foco retenido burbujeaba por el panel y moría ahí,
 *      sin llegar jamás al `keydown` de `window` (main.ts:~5357), que es el ÚNICO sitio
 *      donde el juego consume y el grabador anota (`keyRec.note`/`commit`).
 *
 * El arreglo son las dos mitades y cada una tiene aquí su aserto PROPIO (quitar una
 * sola ⇒ su test en rojo): `close()` suelta el foco, y el panel/la barra ocultos son
 * INERTES al teclado. El testigo del juego es un listener en `window` en burbuja — la
 * MISMA superficie y fase que el consumidor real.
 *
 * El tramo navegador de esta ficha lo asevera el e2e YA existente (`e2e/replay-ui.spec.ts`,
 * «6 keys» en la fila de la lista): no se añade spec para no mover la población.
 */
import { afterEach, describe, expect, it } from "vitest";
import { mountReplayUi, type ReplayUiHandle } from "../src/ui/replay-ui.js";
import { KeyRecorder } from "../src/replay/recorder.js";
import { ReplayPlayer } from "../src/replay/player.js";
import type { ReplayAnchor } from "../src/replay/types.js";

const PANEL = '[data-testid="u5-replay-panel"]';
const BAR = '[data-testid="u5-replay-bar"]';

/** Deps mínimas REALES (KeyRecorder y ReplayPlayer de verdad — sin `as` que pudra el fixture). */
function monta(): { ui: ReplayUiHandle; panel: HTMLElement; bar: HTMLElement } {
  const ui = mountReplayUi(document.body, {
    recorder: new KeyRecorder(),
    player: new ReplayPlayer({
      restore: () => {},
      ready: () => true,
      deliver: () => {},
      turn: () => 0,
    }),
    anchor: (): ReplayAnchor => {
      throw new Error("anchor() no participa en estos tests");
    },
    defaultLabel: () => "test",
    message: () => {},
  });
  return {
    ui,
    panel: document.querySelector<HTMLElement>(PANEL)!,
    bar: document.querySelector<HTMLElement>(BAR)!,
  };
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

let vivo: ReplayUiHandle | null = null;
afterEach(() => {
  vivo?.destroy();
  vivo = null;
  document.body.innerHTML = "";
});

describe("#368 — el panel de repeticiones cerrado no roba el teclado del juego", () => {
  it("CONTROL del testigo: una tecla nacida en body SÍ llega a window", () => {
    const { ui } = monta();
    vivo = ui;
    const w = testigo();
    tecla(document.body, "ArrowRight");
    expect(w.keys).toEqual(["ArrowRight"]);
    w.retira();
  });

  it("close() SUELTA el foco: tras cerrar con el botón, el foco vuelve a body", () => {
    const { ui, panel } = monta();
    vivo = ui;
    ui.open();
    const closeBtn = panel.querySelector<HTMLButtonElement>('[data-act="close"]')!;
    // Chromium enfoca el botón en el mousedown del clic que cierra: se reproduce ese foco.
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn); // control: el fixture enfoca de verdad
    ui.close();
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(document.body);
  });

  it("panel OCULTO = INERTE: un keydown nacido dentro llega a window", () => {
    const { ui, panel } = monta();
    vivo = ui;
    ui.open();
    ui.close();
    const w = testigo();
    // Sin exigir foco: se dispara directamente en el botón del panel oculto — es la
    // guarda del listener lo que se mide, no el blur.
    tecla(panel.querySelector('[data-act="close"]')!, "ArrowUp");
    expect(w.keys).toEqual(["ArrowUp"]);
    w.retira();
  });

  it("CONTROL: panel VISIBLE sigue conteniendo su teclado (escribir no es jugar)", () => {
    const { ui, panel } = monta();
    vivo = ui;
    ui.open();
    const w = testigo();
    tecla(panel.querySelector('[data-act="close"]')!, "ArrowDown");
    expect(w.keys).toEqual([]);
    w.retira();
  });

  it("el camino del usuario entero: clic en Cerrar y la SIGUIENTE tecla llega al juego", () => {
    const { ui, panel } = monta();
    vivo = ui;
    ui.open();
    const closeBtn = panel.querySelector<HTMLButtonElement>('[data-act="close"]')!;
    closeBtn.focus(); // el mousedown de Chromium
    closeBtn.click(); // dispara close() por el listener real del botón
    expect(panel.hidden).toBe(true);
    const w = testigo();
    // La tecla del usuario nace donde esté el foco AHORA — exactamente el gesto del e2e.
    tecla(document.activeElement ?? document.body, "ArrowRight");
    expect(w.keys).toEqual(["ArrowRight"]);
    w.retira();
  });
});

describe("#368 — la barra de transporte, misma clase de defecto", () => {
  const status = (state: "paused" | "idle") => ({
    state,
    index: 0,
    total: 1,
    turn: 0,
    lastTurn: 1,
    speed: 1,
  });

  it("al ocultarse (estado idle) suelta el foco de sus controles", () => {
    const { ui, bar } = monta();
    vivo = ui;
    ui.onPlayerStatus(status("paused"));
    expect(bar.hidden).toBe(false);
    const play = bar.querySelector<HTMLButtonElement>('[data-act="playpause"]')!;
    play.focus();
    expect(document.activeElement).toBe(play); // control del fixture
    ui.onPlayerStatus(status("idle"));
    expect(bar.hidden).toBe(true);
    expect(document.activeElement).toBe(document.body);
  });

  it("barra OCULTA = INERTE: el keydown llega a window; VISIBLE, se contiene", () => {
    const { ui, bar } = monta();
    vivo = ui;
    const w = testigo();
    ui.onPlayerStatus(status("idle"));
    tecla(bar.querySelector('[data-act="playpause"]')!, "ArrowLeft");
    expect(w.keys).toEqual(["ArrowLeft"]);
    ui.onPlayerStatus(status("paused"));
    tecla(bar.querySelector('[data-act="playpause"]')!, "ArrowRight");
    expect(w.keys).toEqual(["ArrowLeft"]); // la segunda NO pasó
    w.retira();
  });
});
