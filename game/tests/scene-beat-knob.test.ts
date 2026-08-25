import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  advanceMoongateStageMs,
  MOONGATE_STAGES,
  MOONGATE_STAGE_MS,
} from "../src/skin/fiel/moongate.js";

/**
 * TICKET #18 — UN SOLO KNOB (`?scenebeat=<ms>`) para las CINCO escenas modales.
 *
 * Estado de partida: `refuge`, `camp` y `endgame` ya compartían `sceneMs` (main.ts).
 * Faltaban dos: `troll-sneak` (tenía knob propio `?trollbeat` + auto-0 bajo webdriver)
 * y `moongate` (única paceada por el bucle rAF con `dt`, no por `window.setTimeout`).
 *
 * INVARIANTE DE SEGURIDAD que estas guardas protegen: **con el knob AUSENTE nada
 * cambia**. El knob es OPT-IN por URL y — a diferencia de `combeat` — NO se arma solo
 * bajo `navigator.webdriver`. De ahí que la pasada de VÍDEO (que no lo pasa) conserve
 * las cadencias reales y siga capturando el cierre completo tras el moongate rojo, que
 * es el criterio de aceptación del usuario.
 */
const mainSrc = readFileSync(fileURLToPath(new URL("../src/main.ts", import.meta.url)), "utf8");
const skinSrc = readFileSync(
  fileURLToPath(new URL("../src/skin/fiel/skin.ts", import.meta.url)),
  "utf8",
);

describe("moongate: el knob entra por el bucle rAF (5ª escena)", () => {
  it("sin knob, la etapa avanza proporcional a dt (comportamiento previo INTACTO)", () => {
    const half = advanceMoongateStageMs(0, true, MOONGATE_STAGE_MS, MOONGATE_STAGE_MS);
    expect(half).toBe(1); // exactamente una etapa por MOONGATE_STAGE_MS
    expect(advanceMoongateStageMs(8, false, MOONGATE_STAGE_MS, MOONGATE_STAGE_MS)).toBe(7);
  });

  it("con stageMs = 0 SALTA al destino en un frame (abre y cierra)", () => {
    expect(advanceMoongateStageMs(0, true, 16, 0)).toBe(MOONGATE_STAGES);
    expect(advanceMoongateStageMs(MOONGATE_STAGES, false, 16, 0)).toBe(0);
  });

  it("stageMs = 0 con dt = 0 NO produce NaN (0/0 envenenaría la etapa para siempre)", () => {
    const v = advanceMoongateStageMs(5, true, 0, 0);
    expect(Number.isNaN(v)).toBe(false);
    expect(v).toBe(MOONGATE_STAGES);
  });

  it("el clamp sigue vigente en los dos extremos", () => {
    expect(advanceMoongateStageMs(MOONGATE_STAGES, true, 10_000, 10)).toBe(MOONGATE_STAGES);
    expect(advanceMoongateStageMs(0, false, 10_000, 10)).toBe(0);
  });
});

describe("guardas de CABLEADO (el knob llega a las dos escenas que faltaban)", () => {
  it("troll-sneak honra `scenebeat`, con `trollbeat` por delante y webdriver detrás", () => {
    const bloque = mainSrc.slice(
      mainSrc.indexOf("const trollBeatParam"),
      mainSrc.indexOf("const trollSneakCtl"),
    );
    expect(bloque).toContain("SCENE_BEAT_MS");
    // precedencia: el override propio se evalúa ANTES que el knob común…
    expect(bloque.indexOf("trollBeatParam !== null")).toBeLessThan(bloque.indexOf("SCENE_BEAT_MS"));
    // …y el knob común ANTES que el auto-0 de automatización (que es el fallback).
    expect(bloque.indexOf("SCENE_BEAT_MS")).toBeLessThan(bloque.indexOf("navigator.webdriver"));
  });

  it("la piel fiel recibe el knob por constructor y lo aplica a la moongate", () => {
    expect(mainSrc).toContain("new FaithfulSkin({ sceneBeatMs: SCENE_BEAT_MS })");
    expect(skinSrc).toContain("private moongateStageMs(");
    // los DOS call-sites (cruce y ambiente) pasan por el helper
    const usos = skinSrc.split("this.moongateStageMs(").length - 1;
    expect(usos, "cruce + ambiente").toBe(2);
  });

  it("el knob NO se arma solo bajo webdriver (así el VÍDEO conserva la cadencia real)", () => {
    const decl = mainSrc.slice(
      mainSrc.indexOf("const sceneBeatParam"),
      mainSrc.indexOf("const sceneMs ="),
    );
    expect(decl).toContain("scenebeat");
    expect(decl).not.toContain("webdriver");
  });
});
