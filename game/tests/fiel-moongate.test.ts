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

  // ── #166/G1: la cadencia del CIERRE del cruce es DERIVABLE, no Clase C ──────
  //
  // `kernel_moongate_enter` 0x48a8, bucle 0x4912-0x492b (ULTIMA.EXE):
  //     490d: mov byte [g_moongate_anim], 0x0f      ; 15 etapas
  //     4912: ... call 0x1112                        ; blit parcial(anim,5,5)
  //     4920: mov ax, 2 ; push ax
  //     4924: call 0x20fa                            ; delay(2)
  //     4927: dec byte [g_moongate_anim] ; jne 0x4912
  //
  // `delay(n)` 0x20fa NO es un bucle de CPU: engancha INT 1Ch (int 21h/25h @0x2133),
  // su handler 0x2159 hace `inc word [0x5448]`, y 0x2138-0x213f espera a que el
  // contador alcance n. INT 1Ch es el tick del PIT y **el binario no reprograma el
  // canal 0 en NINGUNO de los 28 ficheros** (no hay `out 0x43`/`out 0x40` ni un solo
  // `mov dx,0x4[0-3]` que acabe en un `out`; los únicos puertos tocados son 0x42/0x61
  // = altavoz). ⇒ el tick es el del BIOS, 1193182/65536 = 18.2065 Hz, y la cadencia
  // sale en MILISEGUNDOS, independiente de la máquina.
  //
  // Los esperados van EN CRUDO (no derivados de la constante bajo prueba).
  const TICK_MS = 1000 / 18.2065; // 54.9254 ms — tick INT 1Ch del BIOS

  it("una etapa del cierre son DOS ticks del PIT = 109.85 ms (delay(2) @0x4924)", () => {
    expect(TICK_MS).toBeCloseTo(54.9254, 3); // control: el tick es el del BIOS
    expect(MOONGATE_TRANSIT_STAGE_MS).toBeCloseTo(109.85, 1);
  });

  it("el cierre completo son 15 etapas × delay(2) = 30 ticks = 1647.8 ms", () => {
    const cierre = 15 * MOONGATE_TRANSIT_STAGE_MS;
    expect(cierre).toBeCloseTo(1647.8, 0);
  });

  it("el cierre derivado casa con el testigo LF dentro de UN fotograma de vídeo", () => {
    // Tres cruces INDEPENDIENTES del corpus Lord Fenton, medidos por la altura del
    // cuerpo de puerta (EGA 9) en la celda (5,5) fotograma a fotograma a 30 fps:
    // ep21 t=115.967→117.600 · ep12 t=820.033→821.700 · ep27 t=1406.000→1407.633.
    // Los 15 intervalos alternan 100/133 ms (11 y 4), que es exactamente lo que da
    // muestrear un periodo real de 109.85 ms en rejilla de 33.3 ms.
    const testigosLF = [1633.3, 1666.7, 1633.3]; // ms, EN CRUDO
    const cierre = 15 * MOONGATE_TRANSIT_STAGE_MS;
    for (const lf of testigosLF) expect(Math.abs(cierre - lf)).toBeLessThan(1000 / 30);
  });
});
