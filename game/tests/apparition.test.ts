/**
 * APARICIÓN del campamento (camp_results): la FIGURA (0x174) QUIETA en el centro (5,5)
 * cura a la party con N pulsos (uno por miembro vivo) de inversión de paleta + campanilla,
 * SIN moverse. Blinda: nº de pulsos, figura fija en el centro, ventana invert/gap,
 * expiración. Derivación: CAMP_APARICION.mov a 60 fps (figura cyan fija en (5,5)).
 */
import { describe, expect, it } from "vitest";
import {
  ApparitionFlash,
  apparitionPhaseAt,
  apparitionDurationMs,
  APPARITION_INVERT_MS,
  APPARITION_GAP_MS,
  APPARITION_SPEECH_HOLD_MS,
  APPARITION_FIGURE_TILE,
  APPARITION_FIGURE_CELL,
} from "../src/skin/fiel/apparition.js";

const PERIOD = APPARITION_INVERT_MS + APPARITION_GAP_MS;

describe("apparition — disparo y nº de pulsos", () => {
  it("inactivo hasta disparar; 0 pulsos no activa", () => {
    const a = new ApparitionFlash();
    expect(a.active).toBe(false);
    a.trigger(1000, 0);
    expect(a.active).toBe(false);
  });

  it("trigger con N pulsos activa; expira tras N periodos + cola de discurso", () => {
    // RE-BASELINE (carril aparición): tras el último pulso la escena AGUANTA la cola
    // de discurso (karma 0x090e + "vanishes…" 0x0964; el original espera tecla 0x0961
    // y cierra con el dissolve 0x097e) — con todos de pie y sin invertir.
    const a = new ApparitionFlash();
    a.trigger(1000, 3);
    expect(a.active).toBe(true);
    expect(a.frame(1000 + 3 * PERIOD - 1)).not.toBeNull(); // último pulso vivo
    const hold = a.frame(1000 + 3 * PERIOD + 1)!; // cola de discurso
    expect(hold.invert).toBe(false);
    expect(hold.pulse).toBe(2); // todos despiertos (último pulso)
    expect(a.frame(1000 + 3 * PERIOD + APPARITION_SPEECH_HOLD_MS)).toBeNull(); // expira
    expect(a.active).toBe(false);
  });

  it("apparitionDurationMs = pulsos × periodo + cola de discurso", () => {
    expect(apparitionDurationMs(3)).toBe(3 * PERIOD + APPARITION_SPEECH_HOLD_MS);
    expect(apparitionDurationMs(0)).toBe(0);
  });

  it("pulse = índice del pulso en curso (despierta members[0..pulse])", () => {
    const a = new ApparitionFlash();
    a.trigger(0, 3);
    expect(a.frame(10)!.pulse).toBe(0);
    expect(a.frame(PERIOD + 10)!.pulse).toBe(1);
    expect(a.frame(2 * PERIOD + 10)!.pulse).toBe(2);
  });
});

describe("apparition — figura FIJA en el centro (no se mueve)", () => {
  it("la celda de la figura es SIEMPRE el centro (5,5), en cada pulso", () => {
    const a = new ApparitionFlash();
    a.trigger(0, 3);
    expect(a.frame(10)!.figureCell).toEqual({ col: 5, row: 5 });
    expect(a.frame(PERIOD + 10)!.figureCell).toEqual({ col: 5, row: 5 });
    expect(a.frame(2 * PERIOD + 10)!.figureCell).toEqual({ col: 5, row: 5 });
    expect(APPARITION_FIGURE_CELL).toEqual({ col: 5, row: 5 });
  });

  it("invierte durante la ventana de inversión de cada pulso, no en el hueco", () => {
    const a = new ApparitionFlash();
    a.trigger(0, 3);
    expect(a.frame(50)!.invert).toBe(true); // pulso 0, invert
    expect(a.frame(APPARITION_INVERT_MS + 10)!.invert).toBe(false); // hueco
    expect(a.frame(PERIOD + 50)!.invert).toBe(true); // pulso 1, invert
  });

  it("la figura usa el tile de aparición (0x174)", () => {
    expect(APPARITION_FIGURE_TILE).toBe(0x174);
  });

  it("apparitionPhaseAt: invert → gap → speech → done", () => {
    expect(apparitionPhaseAt(0, 3)).toBe("invert");
    expect(apparitionPhaseAt(APPARITION_INVERT_MS - 1, 3)).toBe("invert");
    expect(apparitionPhaseAt(APPARITION_INVERT_MS + 1, 3)).toBe("gap");
    expect(apparitionPhaseAt(3 * PERIOD, 3)).toBe("speech"); // cola de discurso (karma)
    expect(apparitionPhaseAt(3 * PERIOD + APPARITION_SPEECH_HOLD_MS, 3)).toBe("done");
  });
});

describe("apparition — clear", () => {
  it("clear() desactiva y frame() devuelve null", () => {
    const a = new ApparitionFlash();
    a.trigger(0, 3);
    a.clear();
    expect(a.active).toBe(false);
    expect(a.frame(50)).toBeNull();
  });
});
