/**
 * H2b del carril endgame-visual: el CEREBRO del pacer de la piel (puro, sin DOM).
 *
 * Calca el patrón de refugeScene.ts (módulo PURO derivado) + el pacer de main.ts. El
 * `endgamePaceMode` deriva del testigo/disasm el MODO de avance de cada fase:
 *   - TEXTO (dialogue/story*) = KEY-paced: el original espera tecla entre páginas
 *     (kernel_print_ds 0x75c0 + wait `call 0x83dc`), como el diálogo del trono.
 *   - ANIMACIÓN (green/moongate/dissolve/scroll) = TIMER-paced: auto-avanza a reloj de
 *     pared (delays 0x7e6a), como la escena de refuge.
 *   - TERMINAL (freeze/prison) = fin del pacer (freeze sin input / sala-prisión jugable).
 *
 * El pacer modal DOM vive en main.ts (presentación, validada en la ventana frame-a-frame);
 * aquí se prueba el CEREBRO: `planEndgame(ending, text)` = beats + su modo, AMBAS ramas
 * (requisito del lead: victory y stranded llegan al pacer).
 */
import { describe, it, expect } from "vitest";
import { endgamePaceMode, planEndgame } from "../src/skin/endgameScene.js";
// El TEST sí puede leer el core en runtime (no es piel): arma el guión como lo hará el
// core (buildEndgameScript) y se lo pasa al pacer, que en producción lo recibe por el evento.
import { buildEndgameScript } from "../src/core/endgame/sequence.js";

const TEXT = {
  dialogue: Array.from({ length: 11 }, (_, i) => `rec${i}`),
  narration: Array.from({ length: 6 }, (_, i) => `page${i}`),
};

describe("endgamePaceMode — derivación del modo de avance por fase", () => {
  it("TEXTO (dialogue/story*) = key-paced (espera de tecla, 0x83dc)", () => {
    expect(endgamePaceMode("dialogue")).toBe("key");
    expect(endgamePaceMode("storyHouse")).toBe("key");
    expect(endgamePaceMode("storyDream")).toBe("key");
  });

  it("ANIMACIÓN (green/moongate/dissolve/scroll) = timer-paced (delays 0x7e6a)", () => {
    for (const p of ["greenScene", "orbMoongate", "dissolve", "scroll"] as const) {
      expect(endgamePaceMode(p)).toBe("timer");
    }
  });

  it("TERMINAL (freeze/prison) = fin del pacer", () => {
    expect(endgamePaceMode("terminalFreeze")).toBe("terminal");
    expect(endgamePaceMode("terminalPrison")).toBe("terminal");
  });
});

describe("planEndgame — AMBAS ramas llegan al pacer (requisito del lead)", () => {
  it("victoria: plan completo, cada beat con su modo, termina en terminalFreeze", () => {
    const plan = planEndgame(buildEndgameScript("victory", TEXT));
    expect(plan.length).toBeGreaterThan(0);
    const last = plan[plan.length - 1]!;
    expect(last.beat.phase).toBe("terminalFreeze");
    expect(last.mode).toBe("terminal");
    // Los beats de diálogo y de historia van KEY-paced; ninguno queda sin clasificar.
    expect(plan.filter((s) => s.beat.phase === "dialogue").every((s) => s.mode === "key")).toBe(true);
    expect(plan.every((s) => s.mode === "key" || s.mode === "timer" || s.mode === "terminal")).toBe(true);
    // Sólo el ÚLTIMO beat es terminal (el pacer no termina antes de tiempo).
    expect(plan.filter((s) => s.mode === "terminal")).toHaveLength(1);
  });

  it("stranded: comparte prólogo, termina en terminalPrison (jugable, no freeze)", () => {
    const plan = planEndgame(buildEndgameScript("stranded", TEXT));
    const last = plan[plan.length - 1]!;
    expect(last.beat.phase).toBe("terminalPrison");
    expect(last.mode).toBe("terminal");
    // La rama varada NO llega a moongate/dissolve/story/scroll.
    const phases = new Set(plan.map((s) => s.beat.phase));
    for (const p of ["orbMoongate", "dissolve", "storyHouse", "storyDream", "scroll", "terminalFreeze"] as const) {
      expect(phases.has(p)).toBe(false);
    }
  });
});
