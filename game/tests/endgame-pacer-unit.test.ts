/**
 * Ciclo de vida del EndgamePacer (ui/endgame-pacer.ts) — TRAMO 1 del refactor
 * estructural (auditoría MANT-1/ARQ-2): el pacer del cierre (#34) era un closure
 * de boot() inimportable (endgaming/endgameTimer/endgameAwaitKey). Cubre por
 * UNIDAD el CABLEADO del pacer (no las cadencias Clase C, que son del testigo):
 *   · beats de TEXTO paceados POR TECLA (getkey 0x83dc): consumeKey avanza;
 *   · fases de animación/terminales se TRAGAN la tecla (consumeKey no-op);
 *   · `active` queda armado PARA SIEMPRE en terminalFreeze (bucle 0x04f9);
 *   · reset(): teardown completo (timer + flag + awaitKey + escena) — la clase
 *     de R3 (cargar partida mid-escena).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EndgamePacer, EG_GREEN_MS } from "../src/ui/endgame-pacer.js";
import type { EndgameScript } from "../src/core/endgame/sequence.js";
import type { EndgameSceneView } from "../src/skin/api.js";
import type { Game } from "../src/core/game.js";

(globalThis as Record<string, unknown>).window ??= globalThis;

function makeHarness() {
  const calls = {
    scenes: [] as (EndgameSceneView | null)[],
    messages: [] as string[],
    appends: [] as string[],
    sfx: [] as string[],
  };
  const game = {
    state: {
      partySize: 2,
      characters: [
        { class: "A", name: "Avatar" },
        { class: "B", name: "Iolo" },
      ],
    },
  } as unknown as Game;
  const pacer = new EndgamePacer({
    game,
    view: {
      setEndgameScene: (s) => calls.scenes.push(s),
      emitSfx: (cue) => calls.sfx.push(cue.id),
    },
    hud: {
      message: (t) => calls.messages.push(t),
      messageAppend: (t) => calls.appends.push(t),
    },
    refreshAwaiting: () => {},
    cancelAutoWalk: () => {},
    sceneMs: (ms) => ms,
    sceneBeatMs: null,
    endgameRoom: null,
  });
  return { pacer, calls };
}

/** Guión mínimo: llegada (pausa muda) → diálogo por tecla → freeze terminal. */
const SCRIPT: EndgameScript = {
  ending: "victory",
  beats: [
    { phase: "greenScene" },
    { phase: "dialogue", message: "Ah, my friend...", reply: "Yes" },
    { phase: "dialogue", message: "It is done." },
    { phase: "terminalFreeze" },
  ],
} as EndgameScript;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("EndgamePacer — espina de fases del guión", () => {
  it("greenScene pausa MUDA (EG_GREEN_MS sin delayUnits) y avanza sola al diálogo", () => {
    const { pacer, calls } = makeHarness();
    pacer.run(SCRIPT);
    expect(pacer.active).toBe(true);
    expect(calls.scenes[0]!.phase).toBe("greenScene");
    expect(calls.messages).toEqual([]); // el diálogo aún no llegó
    vi.advanceTimersByTime(EG_GREEN_MS);
    expect(calls.messages).toEqual(["Ah, my friend..."]);
    expect(calls.appends).toEqual(["Yes"]); // auto-respuesta (DS 0x84b4) inline
  });

  it("los beats de diálogo pacean POR TECLA (getkey 0x83dc): consumeKey avanza", () => {
    const { pacer, calls } = makeHarness();
    pacer.run(SCRIPT);
    vi.advanceTimersByTime(EG_GREEN_MS); // → diálogo 1 (awaitKey armado)
    vi.advanceTimersByTime(60_000);
    expect(calls.messages).toEqual(["Ah, my friend..."]); // sin tecla NO avanza
    pacer.consumeKey();
    expect(calls.messages).toEqual(["Ah, my friend...", "It is done."]);
  });

  it("terminalFreeze: `active` queda armado PARA SIEMPRE y la tecla se traga", () => {
    const { pacer, calls } = makeHarness();
    pacer.run(SCRIPT);
    vi.advanceTimersByTime(EG_GREEN_MS);
    pacer.consumeKey(); // → diálogo 2
    pacer.consumeKey(); // → terminalFreeze
    const scenesBefore = calls.scenes.length;
    expect(calls.scenes[scenesBefore - 1]!.phase).toBe("terminalFreeze");
    expect(pacer.active).toBe(true);
    pacer.consumeKey(); // freeze: no hay awaitKey → no-op
    pacer.consumeKey();
    vi.advanceTimersByTime(60_000);
    expect(calls.scenes.length).toBe(scenesBefore); // nada se repinta ni avanza
    expect(pacer.active).toBe(true); // bucle infinito 0x04f9
  });
});

describe("EndgamePacer — teardown (la clase de R3)", () => {
  it("reset() a mitad de escena: timer cancelado, flag abajo, escena desmontada", () => {
    const { pacer, calls } = makeHarness();
    pacer.run(SCRIPT);
    pacer.reset();
    expect(pacer.active).toBe(false);
    expect(calls.scenes[calls.scenes.length - 1]).toBe(null); // setEndgameScene(null)
    const msgs = calls.messages.length;
    vi.advanceTimersByTime(60_000);
    expect(calls.messages.length).toBe(msgs); // el timer del greenScene no sobrevivió
    pacer.consumeKey();
    expect(calls.messages.length).toBe(msgs); // awaitKey olvidado
  });
});
