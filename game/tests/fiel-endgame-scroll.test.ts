/**
 * ENDGAME-SCROLL — el pergamino animado del cierre (task #20, Lote 4). Valida el
 * word-wrap a 39 columnas (text_accum_char 0x023a) y el revelado progresivo.
 */
import { describe, expect, it } from "vitest";
import {
  wrapScrollLine,
  wrapScroll,
  buildScrollReveal,
  SCROLL_COLS,
} from "../src/skin/fiel/endgame-scroll.js";

describe("wrapScrollLine (word-wrap a 39 cols, ENDGAME 0x023a)", () => {
  it("no parte líneas que caben en 39 columnas", () => {
    expect(wrapScrollLine("THE QUEST OF THE AVATAR IS FOREVER")).toEqual([
      "THE QUEST OF THE AVATAR IS FOREVER",
    ]);
  });

  it("corta por palabras sin exceder 39 columnas", () => {
    const long =
      "the Avatar saved the life of our sovereign Lord British, thereby saving our people and our land.";
    const wrapped = wrapScrollLine(long);
    expect(wrapped.length).toBeGreaterThan(1);
    for (const l of wrapped) expect(l.length).toBeLessThanOrEqual(SCROLL_COLS);
    // reconstruye el texto original (mismas palabras, en orden).
    expect(wrapped.join(" ").split(/\s+/)).toEqual(long.split(/\s+/));
  });

  it("preserva las líneas vacías (separadores de párrafo)", () => {
    expect(wrapScrollLine("")).toEqual([""]);
  });

  it("una palabra más larga que 39 se emite entera (sin partir a mitad)", () => {
    const w = "A".repeat(50);
    expect(wrapScrollLine(w)).toEqual([w]);
  });
});

describe("buildScrollReveal (revelado progresivo del pergamino)", () => {
  const scroll = [
    "Be it known that on the 5th Day of the 4th Month",
    "of the Year 139,",
    "",
    "THE QUEST OF THE AVATAR IS FOREVER",
  ];

  it("un frame por línea ajustada, revelando una más cada vez", () => {
    const frames = buildScrollReveal(scroll);
    const totalWrapped = wrapScroll(scroll).length;
    expect(frames.length).toBe(totalWrapped);
    // cada frame añade exactamente una línea.
    frames.forEach((f, i) => expect(f.visible.length).toBe(i + 1));
    // el último frame contiene el pergamino completo.
    expect(frames[frames.length - 1]!.visible).toEqual(wrapScroll(scroll));
  });

  it("es determinista (misma entrada → mismos frames)", () => {
    expect(buildScrollReveal(scroll)).toEqual(buildScrollReveal(scroll));
  });

  it("el pergamino completo nunca excede 39 columnas por línea", () => {
    const last = buildScrollReveal(scroll).at(-1)!;
    for (const l of last.visible) expect(l.length).toBeLessThanOrEqual(SCROLL_COLS);
  });
});
