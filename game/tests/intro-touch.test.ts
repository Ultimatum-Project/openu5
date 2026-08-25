/**
 * INTRO TÁCTIL (carril intro-touch) — 3 ajustes del usuario, piezas PURAS:
 *
 *  1. MENÚ TAPPABLE: `menuRowHit` mapea un tap (py lógico 0..199) a la opción del
 *     menú RENDERIZADO — sustituye al popup de botones-clon (doble menú). La zona
 *     de cada opción es su fila de rejilla; el test de PARIDAD verifica que las
 *     filas del hit-test son EXACTAMENTE las que pinta `renderTitleMenu` (misma
 *     fuente única `menuFirstRow` — si el pintado se mueve, el hit-test le sigue).
 *  2. (el input invisible del nombre es DOM — cubierto por el flujo e2e móvil;
 *     el eco en canvas ya existía: renderCreatePanel `:<tecleado>` + ola.)
 *  3. CURSOR DE CREACIÓN: reloj de OLA (`waveClockStep`, ~110 ms = la cadencia del
 *     getstring de consola ya derivada) que repinta menú/nombre de continuo — antes
 *     el cursor del nombre se congelaba (sólo repintaba al teclear); y el FUEGO
 *     (`firePhaseAnimates`) arde también en nombre/sexo (mismo chrome del título).
 */
import { describe, expect, it } from "vitest";
import { menuFirstRow, menuRowHit, renderTitleMenu } from "../src/skin/fiel/intro.js";
import {
  WAVE_FRAMES,
  WAVE_TICK_MS,
  waveClockStep,
  waveFrameIndex,
  wavePhaseAnimates,
} from "../src/skin/fiel/introAnim.js";

const OPTIONS = [
  "Journey Onward",
  "Create New Character",
  "Transfer from Ultima IV",
  "Ultima V Introduction",
  "Acknowledgements",
  "Return to the View",
];

describe("menuRowHit (menú tappable sobre el canvas)", () => {
  it("con logo: las 6 opciones viven en las filas 17..22 (y 136..183), contiguas", () => {
    expect(menuRowHit(17 * 8, 6, true)).toBe(0); // borde superior de Journey
    expect(menuRowHit(17 * 8 + 7, 6, true)).toBe(0); // último px de la fila
    expect(menuRowHit(18 * 8 + 4, 6, true)).toBe(1); // Create New Character
    expect(menuRowHit(22 * 8 + 7, 6, true)).toBe(5); // Return to the View
  });

  it("fuera del bloque de opciones → null (ni banda Select, ni copyright, ni logo)", () => {
    expect(menuRowHit(17 * 8 - 1, 6, true)).toBeNull(); // fila 16 (borde/Select)
    expect(menuRowHit(23 * 8, 6, true)).toBeNull(); // bajo la última opción
    expect(menuRowHit(0, 6, true)).toBeNull(); // logo
    expect(menuRowHit(24 * 8, 6, true)).toBeNull(); // copyright
  });

  it("sin logo (fallback textual): el bloque arranca en la fila 9", () => {
    expect(menuRowHit(9 * 8, 6, false)).toBe(0);
    expect(menuRowHit(14 * 8 + 3, 6, false)).toBe(5);
    expect(menuRowHit(8 * 8 + 7, 6, false)).toBeNull();
  });

  it("PARIDAD con el pintado: la fila del hit-test de la opción i ES la fila que renderTitleMenu resalta al seleccionarla", () => {
    for (const logo of [true, false]) {
      for (let i = 0; i < OPTIONS.length; i++) {
        const grid = renderTitleMenu({
          title: "ULTIMA V",
          subtitle: "Warriors of Destiny",
          options: OPTIONS,
          selected: i,
          selectPrompt: "Select: ",
          copyright: "Copyright 1988 Lord British",
          logo,
        });
        const row = grid.highlightRow; // fila REAL pintada de la opción i
        expect(row).toBe(menuFirstRow(logo) + i);
        expect(menuRowHit(row * 8 + 4, OPTIONS.length, logo)).toBe(i);
      }
    }
  });
});

describe("waveClockStep (cursor de ola de la intro, ~110 ms)", () => {
  // 110 ms = 2 ticks BIOS (54.94 ms). Cadencia MEDIDA contra el original, no supuesta:
  // `re/notes/audio-cadencias-corpus.md:13` carea el cursor de consola del vídeo-H
  // (~100-110 ms de toggle) contra esos 2 ticks.
  it("cadencia de 2 ticks BIOS: 4 fases de 110 ms en ciclo continuo (la del getstring de consola)", () => {
    expect(WAVE_TICK_MS).toBe(110);
    expect(WAVE_FRAMES).toBe(4);
    expect(waveFrameIndex(0)).toBe(0);
    expect(waveFrameIndex(109)).toBe(0);
    expect(waveFrameIndex(110)).toBe(1);
    expect(waveFrameIndex(110 * 4)).toBe(0); // wrap
  });

  it("en NOMBRE la ola avanza (el cursor congelado era el bug) y en MENÚ también (Select:)", () => {
    for (const phase of ["name", "menu"]) {
      expect(wavePhaseAnimates(phase)).toBe(true);
      const t0 = waveClockStep(phase, 0, -1);
      expect(t0).toEqual({ frame: 0, changed: true });
      const t1 = waveClockStep(phase, WAVE_TICK_MS, t0.frame);
      expect(t1).toEqual({ frame: 1, changed: true });
      // Dentro de la misma fase de ola no repinta.
      expect(waveClockStep(phase, WAVE_TICK_MS + 50, t1.frame).changed).toBe(false);
    }
  });

  it("fuera de las fases con ola no avanza (no repinta por ella)", () => {
    for (const phase of ["sex", "attract", "logo", "quiz", "story", "credits"]) {
      expect(wavePhaseAnimates(phase)).toBe(false);
      expect(waveClockStep(phase, 999, 2)).toEqual({ frame: 2, changed: false });
    }
  });
});
