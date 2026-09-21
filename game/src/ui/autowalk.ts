/** Engine-owned path walking used by tap-to-move and tap-to-interact. */
import type { Game } from "../core/game.js";
import { findPath, stepDirection } from "../core/world/pathfind.js";

export interface AutoWalkDeps {
  game: Game;
  applyEvents: (events: ReturnType<Game["move"]>) => void;
}

export const AUTOWALK_STEP_MS = 140;

export class AutoWalk {
  private handle: number | null = null;

  constructor(private readonly deps: AutoWalkDeps) {}

  get active(): boolean { return this.handle !== null; }

  cancel(): void {
    if (this.handle !== null) {
      clearInterval(this.handle);
      this.handle = null;
    }
  }

  walkTo(target: { x: number; y: number }, onArrive?: () => void): void {
    const { game } = this.deps;
    const path = findPath(game.activeMap, game.state.position, target, game.state.transport);
    if (!path) return;
    if (path.length) this.follow(path, onArrive);
    else onArrive?.();
  }

  /** Walk to the shortest reachable cardinal neighbour, then face/use target. */
  walkAdjacentTo(target: { x: number; y: number }, onArrive: (direction: "north" | "south" | "east" | "west") => void): boolean {
    const { game } = this.deps;
    const goals = [
      { x: target.x, y: target.y - 1 },
      { x: target.x + 1, y: target.y },
      { x: target.x, y: target.y + 1 },
      { x: target.x - 1, y: target.y },
    ];
    const candidates = goals
      .map((goal) => ({ goal, path: findPath(game.activeMap, game.state.position, goal, game.state.transport) }))
      .filter((candidate): candidate is { goal: { x: number; y: number }; path: { x: number; y: number }[] } => candidate.path !== null)
      .sort((a, b) => a.path.length - b.path.length);
    const best = candidates[0];
    if (!best) return false;
    const arrive = () => {
      const direction = stepDirection(game.state.position, target, game.activeMap);
      if (direction) onArrive(direction);
    };
    if (best.path.length === 0) arrive();
    else this.follow(best.path, arrive);
    return true;
  }

  private follow(path: { x: number; y: number }[], onArrive?: () => void): void {
    const { game, applyEvents } = this.deps;
    this.cancel();
    let step = 0;
    this.handle = window.setInterval(() => {
      if (step >= path.length) {
        this.cancel();
        onArrive?.();
        return;
      }
      const direction = stepDirection(game.state.position, path[step]!, game.activeMap);
      step++;
      if (!direction) return this.cancel();
      const events = game.move(direction);
      applyEvents(events);
      if (events.some((event) => event.kind === "message" && event.text === "Blocked!")) this.cancel();
    }, AUTOWALK_STEP_MS);
  }
}
