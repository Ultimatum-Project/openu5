/**
 * M2 (auditoría del port 27-07) — el `keyHandler` de la piel fiel es de CAPTURA en `window`,
 * así que corre ANTES del `stopPropagation` en burbuja de los paneles DOM del shell. Su único
 * gate era `awaitingCommand` del core, que los paneles QoL no tocan: con el juego en su prompt
 * de comando, teclear un nombre de partida con 'z' abría un Ztats invisible detrás del panel y
 * dejaba el input muerto.
 *
 * Se sella el PREDICADO, no el listener: el handler vive dentro de `mount()` y exige canvas,
 * fuentes y una `CoreView` viva.
 */
import { describe, expect, it } from "vitest";
import { isDomTextEntryTarget } from "../src/skin/fiel/skin.js";

/** Objetivo de evento de mentira. `closest` devuelve un match sólo para los selectores dados. */
function target(
  tagName: string,
  opts: { editable?: boolean; ancestros?: string[] } = {},
): { tagName: string; isContentEditable: boolean; closest: (sel: string) => unknown } {
  const ancestros = opts.ancestros ?? [];
  return {
    tagName,
    isContentEditable: opts.editable ?? false,
    closest: (sel: string) => (ancestros.includes(sel) ? { sel } : null),
  };
}

describe("M2 — el teclado de un widget DOM no es del juego", () => {
  it("BLOQUEA el <input> del panel de guardado (el repro de la ficha: teclear «Zelda»)", () => {
    expect(isDomTextEntryTarget(target("INPUT", { ancestros: [".save-panel"] }))).toBe(true);
  });

  it("BLOQUEA un <input> suelto y un <textarea>, aunque no cuelguen de ningún panel", () => {
    expect(isDomTextEntryTarget(target("INPUT"))).toBe(true);
    expect(isDomTextEntryTarget(target("TEXTAREA"))).toBe(true);
  });

  it("BLOQUEA contenteditable", () => {
    expect(isDomTextEntryTarget(target("DIV", { editable: true }))).toBe(true);
  });

  it("BLOQUEA un botón DENTRO de .save-panel — el panel manda, no sólo sus cajas de texto", () => {
    expect(isDomTextEntryTarget(target("BUTTON", { ancestros: [".save-panel"] }))).toBe(true);
  });

  // ★ CONTROL NEGATIVO. Sin él este fichero pasaría con un predicado que devuelve `true`
  // siempre — y eso mataría el teclado del juego entero, que es un fallo mucho peor que el
  // que arregla. El canvas es el objetivo normal de una tecla de juego.
  it("DEJA PASAR el canvas del juego y el <body> — la vía normal del teclado sigue viva", () => {
    expect(isDomTextEntryTarget(target("CANVAS"))).toBe(false);
    expect(isDomTextEntryTarget(target("BODY"))).toBe(false);
    expect(isDomTextEntryTarget(null)).toBe(false);
    expect(isDomTextEntryTarget(undefined)).toBe(false);
  });

  // El objetivo puede venir de un entorno sin `closest` (jsdom viejo, nodos de texto).
  it("no explota si el objetivo no trae `closest`", () => {
    expect(isDomTextEntryTarget({ tagName: "DIV" })).toBe(false);
    expect(isDomTextEntryTarget({ tagName: "INPUT" })).toBe(true);
  });
});
