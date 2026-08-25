/**
 * Ciclo de vida del AutoWalk (ui/autowalk.ts) — TRAMO 1 del refactor estructural
 * (auditoría MANT-1/ARQ-2 + hallazgo R1): el interval del tap-to-walk vivía como
 * closure de boot() — la regresión R1 (el interval seguía moviendo la party
 * durante el combate) sólo era detectable en vivo. Cubre por UNIDAD:
 *   · walkTo: un paso de game.move por tick (140 ms) siguiendo el camino A*;
 *   · "Blocked!" corta la marcha; fin de camino corta la marcha;
 *   · cancel() (lo que combat-started/map-changed/tecla manual llaman) detiene
 *     el interval — cero movimientos posteriores.
 * findPath/stepDirection se mockean: aquí se prueba el CONDUCTOR, no el A*.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Game } from "../src/core/game.js";

vi.mock("../src/core/world/pathfind.js", () => ({
  findPath: vi.fn(),
  stepDirection: vi.fn(),
}));
import { findPath, stepDirection } from "../src/core/world/pathfind.js";
import { AutoWalk, AUTOWALK_STEP_MS } from "../src/ui/autowalk.js";

(globalThis as Record<string, unknown>).window ??= globalThis;

type Events = ReturnType<Game["move"]>;

function makeHarness(moveEvents: () => Events) {
  const calls = { moves: [] as string[], applied: [] as Events[] };
  const game = {
    activeMap: {},
    state: { position: { x: 0, y: 0 }, transport: "foot" },
    move: (dir: string) => {
      calls.moves.push(dir);
      return moveEvents();
    },
  } as unknown as Game;
  const ctl = new AutoWalk({ game, applyEvents: (e) => calls.applied.push(e) });
  return { ctl, calls };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(findPath).mockReset();
  vi.mocked(stepDirection).mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("AutoWalk — conductor del tap-to-walk", () => {
  it("da un paso de game.move por tick de 140 ms y corta al agotar el camino", () => {
    const { ctl, calls } = makeHarness(() => [] as never as Events);
    vi.mocked(findPath).mockReturnValue([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ] as never);
    vi.mocked(stepDirection).mockReturnValue("east" as never);
    ctl.walkTo({ x: 2, y: 0 });
    expect(ctl.active).toBe(true);
    expect(calls.moves).toEqual([]); // el primer paso espera su tick
    vi.advanceTimersByTime(AUTOWALK_STEP_MS);
    expect(calls.moves).toEqual(["east"]);
    vi.advanceTimersByTime(AUTOWALK_STEP_MS);
    expect(calls.moves).toEqual(["east", "east"]);
    vi.advanceTimersByTime(AUTOWALK_STEP_MS); // step >= path.length → cancel
    expect(ctl.active).toBe(false);
    expect(calls.moves).toEqual(["east", "east"]);
  });

  it("sin camino (findPath null/vacío) es no-op", () => {
    const { ctl, calls } = makeHarness(() => [] as never as Events);
    vi.mocked(findPath).mockReturnValue(null as never);
    ctl.walkTo({ x: 5, y: 5 });
    expect(ctl.active).toBe(false);
    vi.advanceTimersByTime(AUTOWALK_STEP_MS * 5);
    expect(calls.moves).toEqual([]);
  });

  it('"Blocked!" corta la marcha (el evento pasa por applyEvents igualmente)', () => {
    const { ctl, calls } = makeHarness(
      () => [{ kind: "message", text: "Blocked!" }] as unknown as Events,
    );
    vi.mocked(findPath).mockReturnValue([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ] as never);
    vi.mocked(stepDirection).mockReturnValue("east" as never);
    ctl.walkTo({ x: 3, y: 0 });
    vi.advanceTimersByTime(AUTOWALK_STEP_MS);
    expect(calls.moves).toEqual(["east"]);
    expect(calls.applied.length).toBe(1); // el turno del paso SÍ se aplicó
    expect(ctl.active).toBe(false); // pero la marcha se cortó
    vi.advanceTimersByTime(AUTOWALK_STEP_MS * 5);
    expect(calls.moves).toEqual(["east"]);
  });

  it("cancel() detiene el interval (combat-started/map-changed/tecla manual)", () => {
    const { ctl, calls } = makeHarness(() => [] as never as Events);
    vi.mocked(findPath).mockReturnValue([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ] as never);
    vi.mocked(stepDirection).mockReturnValue("east" as never);
    ctl.walkTo({ x: 2, y: 0 });
    vi.advanceTimersByTime(AUTOWALK_STEP_MS);
    ctl.cancel();
    expect(ctl.active).toBe(false);
    vi.advanceTimersByTime(AUTOWALK_STEP_MS * 10);
    expect(calls.moves).toEqual(["east"]); // cero movimientos tras el cancel
  });

  it("stepDirection null (camino invalidado) corta la marcha sin mover", () => {
    const { ctl, calls } = makeHarness(() => [] as never as Events);
    vi.mocked(findPath).mockReturnValue([{ x: 1, y: 0 }] as never);
    vi.mocked(stepDirection).mockReturnValue(null as never);
    ctl.walkTo({ x: 1, y: 0 });
    vi.advanceTimersByTime(AUTOWALK_STEP_MS);
    expect(ctl.active).toBe(false);
    expect(calls.moves).toEqual([]);
  });
});

describe("MoongateTransitGate (ui/moongate-gate.ts)", () => {
  it("default false; bind ata el probe real de las pieles", async () => {
    const { MoongateTransitGate } = await import("../src/ui/moongate-gate.js");
    const gate = new MoongateTransitGate();
    expect(gate.transiting).toBe(false);
    let on = false;
    gate.bind(() => on);
    expect(gate.transiting).toBe(false);
    on = true;
    expect(gate.transiting).toBe(true);
  });
});
