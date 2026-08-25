/**
 * AutoWalk — conductor del tap-to-walk (QoL click-para-caminar, A*).
 *
 * Extraído de boot() (auditoría MANT-1/ARQ-2: el interval vivía como closure
 * inimportable). Estado con ciclo de vida: UN interval de 140 ms que da un paso
 * de `game.move` por tick siguiendo el camino de `findPath`; se cancela ante
 * cualquier comando manual, combate (hallazgo R1), cambio de mapa o "Blocked!".
 *
 * Deps inyectadas (patrón shop-console.ts): `game` y `applyEvents` llegan como
 * closures del composition root — el módulo no importa presentación.
 */
import type { Game } from "../core/game.js";
import { findPath, stepDirection } from "../core/world/pathfind.js";

export interface AutoWalkDeps {
  game: Game;
  applyEvents: (events: ReturnType<Game["move"]>) => void;
}

/** Cadencia del paso automático (idéntica al interval original de boot()). */
export const AUTOWALK_STEP_MS = 140;

export class AutoWalk {
  private handle: number | null = null;

  constructor(private readonly deps: AutoWalkDeps) {}

  /** ¿Hay una auto-marcha en curso? */
  get active(): boolean {
    return this.handle !== null;
  }

  cancel(): void {
    if (this.handle !== null) {
      clearInterval(this.handle);
      this.handle = null;
    }
  }

  /**
   * tap-tile: camina hacia (x,y) por A* (findPath) a un paso por tick.
   * Sin camino → no-op. Cada paso pasa por `game.move` + `applyEvents`
   * (el MISMO pipeline que una flecha); "Blocked!" corta la marcha.
   */
  walkTo(target: { x: number; y: number }): void {
    const { game, applyEvents } = this.deps;
    const map = game.activeMap;
    const path = findPath(map, game.state.position, target, game.state.transport);
    if (!path || path.length === 0) return;
    let step = 0;
    this.handle = window.setInterval(() => {
      if (step >= path.length) {
        this.cancel();
        return;
      }
      const dir = stepDirection(game.state.position, path[step]!, game.activeMap);
      step++;
      if (!dir) {
        this.cancel();
        return;
      }
      const events = game.move(dir);
      applyEvents(events);
      if (events.some((e) => e.kind === "message" && e.text === "Blocked!")) {
        this.cancel();
      }
    }, AUTOWALK_STEP_MS);
  }
}
