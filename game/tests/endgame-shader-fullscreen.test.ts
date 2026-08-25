/**
 * GUARDA de la PARTICIÓN de fases del endgame en la piel shader (fix endgame-pieles,
 * 2026-08-22): toda fase del guión del cierre está en EXACTAMENTE uno de los dos
 * conjuntos del compose —
 *   · `ENDGAME_TRANSP_PHASES` (fases de SALA: el viewport lleva la sala del trono y
 *     los actores; la UI lateral SIGUE en pantalla, como en el binario), o
 *   · `ENDGAME_FULLSCREEN_PHASES` (fases de PANTALLA COMPLETA: la fiel pinta el frame
 *     entero sin chrome — historia/pergamino/disolución — y el compose del shader
 *     presenta ese frame Y NADA MÁS; el binario compone cada página sobre un clear
 *     de (0,0)-(319,199) + present total, acta re/notes/endgame-banda-limpieza-187).
 *
 * El defecto que esta guarda deja cerrado: la shader recomponía chrome vectorial +
 * texto HD + bandas ENCIMA de la historia y el pergamino (UI lateral fija con los
 * oros y texto de consola solapado — capturas del usuario, 2026-08-22). Una fase
 * NUEVA del guión que no se clasifique aquí rompe la guarda en rojo, en vez de caer
 * en silencio a la vía de sala (que la taparía con la UI).
 *
 * Los esperados van EN CRUDO (las 9 fases de `EndgameSceneView["phase"]`, api.ts),
 * no derivados de los sujetos.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ENDGAME_FULLSCREEN_PHASES,
  ENDGAME_TRANSP_PHASES,
  endgameFullScreen,
} from "../src/skin/shader/endgame-transp.js";
import type { EndgameSceneView } from "../src/skin/api.js";

/** Las 9 fases del guión, EN CRUDO (espejo de api.ts `EndgameSceneView["phase"]`). */
const ALL_PHASES: EndgameSceneView["phase"][] = [
  "greenScene",
  "dialogue",
  "orbMoongate",
  "dissolve",
  "storyHouse",
  "storyDream",
  "scroll",
  "terminalFreeze",
  "terminalPrison",
];

describe("partición sala/pantalla-completa del endgame en el shader", () => {
  it("los dos conjuntos son DISJUNTOS", () => {
    for (const p of ENDGAME_TRANSP_PHASES) {
      expect(ENDGAME_FULLSCREEN_PHASES.has(p), `fase ${p} en ambos conjuntos`).toBe(false);
    }
  });

  it("los dos conjuntos CUBREN las 9 fases del guión (ninguna sin clasificar)", () => {
    for (const p of ALL_PHASES) {
      expect(
        ENDGAME_TRANSP_PHASES.has(p) || ENDGAME_FULLSCREEN_PHASES.has(p),
        `fase ${p} sin clasificar: caería en silencio a la vía de sala del compose`,
      ).toBe(true);
    }
    expect(ENDGAME_TRANSP_PHASES.size + ENDGAME_FULLSCREEN_PHASES.size).toBe(ALL_PHASES.length);
  });

  it("las fases de pantalla completa son las del frame-entero de la fiel, EN CRUDO", () => {
    // paintSnapshot (fiel/skin.ts) retorna antes del chrome en story*/scroll/terminalFreeze
    // y applyEndgameDissolve ennegrece el frame COMPLETO en dissolve.
    expect([...ENDGAME_FULLSCREEN_PHASES].sort()).toEqual(
      ["dissolve", "scroll", "storyDream", "storyHouse", "terminalFreeze"].sort(),
    );
    expect(endgameFullScreen({ phase: "scroll" })).toBe(true);
    expect(endgameFullScreen({ phase: "dialogue" })).toBe(false);
  });

  /**
   * GUARDA DE FUENTE, declarada como tal (`ShaderSkin` no monta en jsdom — misma frontera
   * que `cannon-projectile.test.ts` §3). Cierra el hueco de la clase #278: un predicado
   * correcto al que NADIE llama deja el defecto exactamente donde estaba. Y comprueba el
   * SITIO, que es donde vive el arreglo: el corte va tras el blit del frame fiel (paso 1)
   * y ANTES del texto HD (1b) — que es el primero de los pasos que recomponían la UI.
   */
  it("el compose de la shader CORTA en esas fases, tras el frame fiel y antes del texto HD", () => {
    const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const src = readFileSync(resolve(raiz, "src/skin/shader/skin.ts"), "utf8");
    const iFiel = src.indexOf("ctx.drawImage(src, 0, 0, SCREEN_W, SCREEN_H, 0, 0, bb.width, bb.height)");
    const iCorte = src.indexOf("if (snap?.endgameScene && endgameFullScreen(snap.endgameScene))");
    const iHd = src.indexOf("this.blitHdTextCached(ctx, s)");
    expect(iFiel, "control positivo: el blit del frame fiel (paso 1) existe HOY").toBeGreaterThan(0);
    expect(iHd, "control positivo: el paso (1b) de texto HD existe HOY").toBeGreaterThan(0);
    expect(iCorte, "el compose NO corta en las fases de pantalla completa (UI encima)").toBeGreaterThan(0);
    expect(iFiel).toBeLessThan(iCorte);
    expect(iCorte).toBeLessThan(iHd);
    // El cuerpo del corte RETORNA (un `if` que sólo suelta el tween seguiría pintando).
    expect(src.slice(iCorte, iCorte + 200)).toContain("return;");
  });
});
