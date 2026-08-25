/**
 * Ciclo de vida del TrollSneak (ui/troll-sneak.ts) — TRAMO 1 del refactor
 * estructural (auditoría MANT-1/ARQ-2): el pacer del cruce del puente con trolls
 * (MAINOUT 0x1c0e-0x1ca6, pausas run-n-frames 0x3AE6) era un closure de boot().
 * Cubre por UNIDAD:
 *   · unidad 0 (automatización): drain SÍNCRONO completo, byte-idéntico;
 *   · unidad >0: pausa en cada beat con pauseUnits (n × unitMs) y el RESTO del
 *     turno (troll-toll-prompt o nada) DIFERIDO hasta agotar los beats;
 *   · cancel() a mitad: cero mensajes/applyEvents posteriores.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TrollSneak } from "../src/ui/troll-sneak.js";
import type { Game, TrollSneakScript } from "../src/core/game.js";

(globalThis as Record<string, unknown>).window ??= globalThis;

type Events = ReturnType<Game["move"]>;

function makeHarness(unitMs: number) {
  const calls = {
    messages: [] as string[],
    appends: [] as string[],
    applied: [] as Events[],
  };
  const ctl = new TrollSneak({
    unitMs,
    hud: {
      message: (t) => calls.messages.push(t),
      messageAppend: (t) => calls.appends.push(t),
    },
    applyEvents: (e) => calls.applied.push(e),
    refreshAwaiting: () => {},
    cancelAutoWalk: () => {},
  });
  return { ctl, calls };
}

const SCRIPT: TrollSneakScript = {
  beats: [
    { message: "Thou spieth trolls under the bridge!", pauseUnits: 10 },
    { message: "Iolo sneaks across.." },
    { append: ".", pauseUnits: 5 },
    { append: ".", pauseUnits: 5 },
  ],
} as TrollSneakScript;

const REST = [{ kind: "message", text: "Caught!" }] as unknown as Events;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("TrollSneak — unidad 0 (webdriver)", () => {
  it("drena TODO síncrono y aplica el resto del turno de inmediato", () => {
    const { ctl, calls } = makeHarness(0);
    ctl.run(SCRIPT, REST);
    expect(ctl.active).toBe(false);
    expect(calls.messages).toEqual([
      "Thou spieth trolls under the bridge!",
      "Iolo sneaks across..",
    ]);
    expect(calls.appends).toEqual([".", "."]);
    expect(calls.applied).toEqual([REST]);
  });
});

describe("TrollSneak — unidad 55 (calco 1 tick INT 1Ch ≈ 55 ms)", () => {
  it("pausa n×unitMs en cada beat con pauseUnits y difiere el resto del turno", () => {
    const { ctl, calls } = makeHarness(55);
    ctl.run(SCRIPT, REST);
    // 1er beat impreso, pausa de 10 unidades en vuelo.
    expect(ctl.active).toBe(true);
    expect(calls.messages).toEqual(["Thou spieth trolls under the bridge!"]);
    expect(calls.applied).toEqual([]); // el turno diferido NO se cuela en medio
    vi.advanceTimersByTime(10 * 55);
    // 2º beat (sin pausa) + 3º (punto, pausa de 5) en la misma pasada.
    expect(calls.messages).toEqual([
      "Thou spieth trolls under the bridge!",
      "Iolo sneaks across..",
    ]);
    expect(calls.appends).toEqual(["."]);
    vi.advanceTimersByTime(5 * 55); // 4º beat (último punto, pausa de 5)
    expect(calls.appends).toEqual([".", "."]);
    expect(ctl.active).toBe(true); // aún queda la pausa final
    vi.advanceTimersByTime(5 * 55);
    expect(ctl.active).toBe(false);
    expect(calls.applied).toEqual([REST]); // reanudado al agotar los beats
  });

  it("cancel() a mitad de secuencia: cero beats/applyEvents posteriores", () => {
    const { ctl, calls } = makeHarness(55);
    ctl.run(SCRIPT, REST);
    ctl.cancel();
    expect(ctl.active).toBe(false);
    vi.advanceTimersByTime(55 * 100);
    expect(calls.messages).toEqual(["Thou spieth trolls under the bridge!"]);
    expect(calls.applied).toEqual([]);
  });
});
