import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Game } from "../src/core/game.js";

vi.mock("../src/core/world/pathfind.js", () => ({ findPath: vi.fn(), stepDirection: vi.fn() }));
import { findPath, stepDirection } from "../src/core/world/pathfind.js";
import { AutoWalk, AUTOWALK_STEP_MS } from "../src/ui/autowalk.js";

(globalThis as Record<string, unknown>).window ??= globalThis;

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(findPath).mockReset();
  vi.mocked(stepDirection).mockReset();
});

describe("AutoWalk tap interaction", () => {
  it("uses the shortest reachable adjacent route and reports the final facing direction", () => {
    const position = { x: 0, y: 0 };
    const moves: string[] = [];
    const game = {
      activeMap: {},
      state: { position, transport: "foot" },
      move: (direction: string) => { moves.push(direction); position.x += 1; return []; },
    } as unknown as Game;
    vi.mocked(findPath)
      .mockReturnValueOnce(null as never)
      .mockReturnValueOnce([{ x: 1, y: 0 }, { x: 2, y: 0 }] as never)
      .mockReturnValueOnce([{ x: 1, y: 0 }] as never)
      .mockReturnValueOnce(null as never);
    vi.mocked(stepDirection).mockReturnValueOnce("east" as never).mockReturnValueOnce("south" as never);
    const arrived = vi.fn();
    const walk = new AutoWalk({ game, applyEvents: () => undefined });
    expect(walk.walkAdjacentTo({ x: 1, y: 1 }, arrived)).toBe(true);
    vi.advanceTimersByTime(AUTOWALK_STEP_MS * 2);
    expect(moves).toEqual(["east"]);
    expect(arrived).toHaveBeenCalledWith("south");
  });
});
