/**
 * Máquina de etapas de la moongate (piel fiel). Deriva de `g_moongate_anim`
 * 0..16: sube 1/paso de noche (puerta presente), baja 1/paso de día, clamp; la
 * revelación va anclada abajo (la puerta sale del suelo, vídeo K).
 */
import { describe, expect, it } from "vitest";
import {
  MOONGATE_DEPART_HOLD_MS,
  MOONGATE_STAGES,
  MOONGATE_STAGE_MS,
  MOONGATE_TRANSIT_STAGE_MS,
  advanceMoongateStageMs,
  moongateRevealRect,
  stepMoongateStage,
} from "../src/skin/fiel/moongate.js";

describe("stepMoongateStage", () => {
  it("sube hacia 16 con la puerta presente y satura", () => {
    let s = 0;
    for (let i = 0; i < 20; i++) s = stepMoongateStage(s, true);
    expect(s).toBe(MOONGATE_STAGES);
  });

  it("baja hacia 0 con la puerta ausente y satura", () => {
    let s = MOONGATE_STAGES;
    for (let i = 0; i < 20; i++) s = stepMoongateStage(s, false);
    expect(s).toBe(0);
  });

  it("un paso avanza exactamente una etapa en cada sentido", () => {
    expect(stepMoongateStage(7, true)).toBe(8);
    expect(stepMoongateStage(7, false)).toBe(6);
  });
});

describe("moongateRevealRect", () => {
  it("etapa 0 → nada; etapa 16 → celda llena", () => {
    expect(moongateRevealRect(0, 16)).toEqual({ offY: 16, h: 0 });
    expect(moongateRevealRect(16, 16)).toEqual({ offY: 0, h: 16 });
  });

  it("etapa media revela la mitad inferior de la celda", () => {
    expect(moongateRevealRect(8, 16)).toEqual({ offY: 8, h: 8 });
  });

  it("clampa etapas fuera de rango", () => {
    expect(moongateRevealRect(-3, 16)).toEqual({ offY: 16, h: 0 });
    expect(moongateRevealRect(99, 16)).toEqual({ offY: 0, h: 16 });
  });
});

describe("advanceMoongateStageMs", () => {
  it("un paso de MOONGATE_STAGE_MS ≈ 1 etapa", () => {
    expect(advanceMoongateStageMs(0, true, MOONGATE_STAGE_MS)).toBeCloseTo(1);
    expect(advanceMoongateStageMs(5, false, MOONGATE_STAGE_MS)).toBeCloseTo(4);
  });

  it("sube y satura en 16 con la puerta presente", () => {
    expect(advanceMoongateStageMs(15.5, true, MOONGATE_STAGE_MS)).toBe(
      MOONGATE_STAGES,
    );
  });

  it("baja y satura en 0 con la puerta ausente", () => {
    expect(advanceMoongateStageMs(0.4, false, MOONGATE_STAGE_MS)).toBe(0);
  });

  it("dt grande no se pasa de rango (clamp)", () => {
    expect(advanceMoongateStageMs(8, true, 10000)).toBe(MOONGATE_STAGES);
    expect(advanceMoongateStageMs(8, false, 10000)).toBe(0);
  });

  it("cadencia de cruce (stageMs explícito) es más pausada que la de ambiente", () => {
    // Con MOONGATE_TRANSIT_STAGE_MS, un dt de MOONGATE_STAGE_MS avanza MENOS de una
    // etapa (el cruce se cierra más despacio que la aparición de ambiente).
    const amb = MOONGATE_STAGES - advanceMoongateStageMs(MOONGATE_STAGES, false, MOONGATE_STAGE_MS);
    const cruce =
      MOONGATE_STAGES -
      advanceMoongateStageMs(MOONGATE_STAGES, false, MOONGATE_STAGE_MS, MOONGATE_TRANSIT_STAGE_MS);
    expect(amb).toBeCloseTo(1);
    expect(cruce).toBeLessThan(amb);
    expect(cruce).toBeCloseTo(MOONGATE_STAGE_MS / MOONGATE_TRANSIT_STAGE_MS);
  });

  it("un paso de MOONGATE_TRANSIT_STAGE_MS ≈ 1 etapa de cierre", () => {
    expect(
      advanceMoongateStageMs(10, false, MOONGATE_TRANSIT_STAGE_MS, MOONGATE_TRANSIT_STAGE_MS),
    ).toBeCloseTo(9);
  });
});

describe("constantes de cadencia del cruce", () => {
  it("el cierre del cruce es más lento que el de ambiente y hay hold de salida", () => {
    // El hold es de SALIDA (puerta llena sobre el origen: barrido 0x2192 + wipe
    // 0x1068 + beep pre-bucle). La llegada NO tiene fase scripted: el único bucle
    // del cruce (0x4912-0x492b) es descendente y deja g_moongate_anim=0; la subida
    // en el destino es del compositor de ambiente (0x475a).
    expect(MOONGATE_TRANSIT_STAGE_MS).toBeGreaterThan(MOONGATE_STAGE_MS);
    expect(MOONGATE_DEPART_HOLD_MS).toBeGreaterThan(0);
  });
});
