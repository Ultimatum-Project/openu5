/**
 * Driver del picker de miembro fiel (`select_party_member` 0x2d7a) usado por Ready/Cast/
 * Swap/…: imprime el título, coloca el cursor en el roster (inverso), mueve con flechas,
 * elige con 1-N/Enter/Space/0, cancela con ESC. Arnés con espías (sin DOM). El marcador
 * visual (cursor inverso) lo pinta la piel; aquí se blinda el FLUJO.
 */
import { describe, expect, it } from "vitest";
import {
  startPartyMemberPicker,
  type PartyMemberPickerDeps,
  type PartySelectPrompt,
} from "../src/core/partyMemberPicker.js";

function harness(partySize = 4) {
  const prints: string[] = [];
  const cursors: (number | null)[] = [];
  const selected: number[] = [];
  let cancelled = 0;
  let prompt: PartySelectPrompt | null = null;
  const deps: PartyMemberPickerDeps = {
    print: (t) => prints.push(t),
    setSelectCursor: (idx) => cursors.push(idx),
    setPrompt: (p) => { prompt = p; },
    partySize: () => partySize,
    onSelect: (idx) => selected.push(idx),
    onCancel: () => { cancelled++; },
  };
  const key = (k: string): void => {
    if (!prompt) throw new Error("picker cerrado");
    prompt.onKey(k);
  };
  return {
    prints, cursors, selected,
    cancelledCount: () => cancelled,
    promptOpen: () => prompt !== null,
    start: (title = "Ready — who?") => startPartyMemberPicker(title, deps),
    key,
  };
}

describe("partyMemberPicker — arranque", () => {
  it("imprime el título y coloca el cursor en el 1er miembro (roster inverso)", () => {
    const h = harness();
    h.start("Ready — who?");
    expect(h.prints).toEqual(["Ready — who?"]);
    expect(h.cursors.at(-1)).toBe(0); // cursor inicial en el miembro 0
    expect(h.promptOpen()).toBe(true);
  });
});

describe("partyMemberPicker — navegación", () => {
  it("flecha abajo/derecha mueve el cursor (wrap); sigue abierto", () => {
    const h = harness(4);
    h.start();
    h.key("ArrowDown");
    expect(h.cursors.at(-1)).toBe(1);
    h.key("ArrowRight");
    expect(h.cursors.at(-1)).toBe(2);
    expect(h.promptOpen()).toBe(true);
    expect(h.selected).toEqual([]);
  });

  it("flecha arriba en el 0 envuelve al último (party de 4 → 3)", () => {
    const h = harness(4);
    h.start();
    h.key("ArrowUp");
    expect(h.cursors.at(-1)).toBe(3);
  });
});

describe("partyMemberPicker — selección", () => {
  it("Enter confirma el cursor actual", () => {
    const h = harness();
    h.start();
    h.key("ArrowDown"); // cursor → 1
    h.key("Enter");
    expect(h.selected).toEqual([1]);
    expect(h.promptOpen()).toBe(false); // cerrado
    expect(h.cursors.at(-1)).toBeNull(); // cursor retirado
  });

  it("número directo (3 → miembro 2) confirma sin mover", () => {
    const h = harness(4);
    h.start();
    h.key("3");
    expect(h.selected).toEqual([2]);
    expect(h.promptOpen()).toBe(false);
  });

  it("número fuera del party → IGNORA (getkey re-lee), sigue abierto", () => {
    const h = harness(3);
    h.start();
    h.key("5"); // party de 3 → 5 inválido
    expect(h.selected).toEqual([]);
    expect(h.promptOpen()).toBe(true);
  });

  it("Space confirma el cursor; '0' NO (se ignora — #280)", () => {
    const a = harness(); a.start(); a.key(" "); expect(a.selected).toEqual([0]);
    // '0' por la vía select_party_member_default (arg=0) la ignora el binario: el picker
    // sigue ARMADO y no selecciona nada. Se comprueba que el cursor sigue vivo enviando
    // después un Enter, que sí confirma el miembro al que se había movido.
    const b = harness(); b.start(); b.key("ArrowDown"); b.key("0");
    expect(b.selected).toEqual([]);
    b.key("Enter");
    expect(b.selected).toEqual([1]);
  });
});

describe("partyMemberPicker — cancelación", () => {
  it("ESC cancela (sin onSelect), cierra y llama onCancel", () => {
    const h = harness();
    h.start();
    h.key("Escape");
    expect(h.selected).toEqual([]);
    expect(h.cancelledCount()).toBe(1);
    expect(h.promptOpen()).toBe(false);
    expect(h.cursors.at(-1)).toBeNull();
  });
});
