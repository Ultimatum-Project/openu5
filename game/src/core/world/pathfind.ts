/**
 * A* sobre el mapa activo, 4 direcciones. Usado por click-to-move (QoL)
 * y por el movimiento de NPCs hacia sus puestos de horario.
 */
import type { TransportMode } from "../state.js";
import { isPassable } from "./movement.js";
import type { ActiveMap } from "./map.js";

export interface Point {
  x: number;
  y: number;
}

const DIRS: Point[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
];

/**
 * Devuelve el camino de `from` a `to` (excluyendo `from`, incluyendo `to`)
 * o null si no hay ruta. Limitado a `maxNodes` expansiones para no colgarse
 * en mapas grandes.
 */
export function findPath(
  map: ActiveMap,
  from: Point,
  to: Point,
  transport: TransportMode,
  opts?: { maxNodes?: number; isBlocked?: (x: number, y: number) => boolean },
): Point[] | null {
  const maxNodes = opts?.maxNodes ?? 4000;
  const key = (x: number, y: number) => y * map.width + x;
  const norm = (p: Point): Point =>
    map.wraps
      ? {
          x: ((p.x % map.width) + map.width) % map.width,
          y: ((p.y % map.height) + map.height) % map.height,
        }
      : p;

  const start = norm(from);
  const goal = norm(to);
  if (start.x === goal.x && start.y === goal.y) return [];

  const dist = (a: Point, b: Point): number => {
    let dx = Math.abs(a.x - b.x);
    let dy = Math.abs(a.y - b.y);
    if (map.wraps) {
      dx = Math.min(dx, map.width - dx);
      dy = Math.min(dy, map.height - dy);
    }
    return dx + dy;
  };

  interface Node {
    p: Point;
    g: number;
    f: number;
    parent: Node | null;
  }
  const open: Node[] = [{ p: start, g: 0, f: dist(start, goal), parent: null }];
  const gScore = new Map<number, number>([[key(start.x, start.y), 0]]);
  let expanded = 0;

  while (open.length > 0 && expanded < maxNodes) {
    // extraer el de menor f (cola simple; los mapas son pequeños)
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i]!.f < open[bestIdx]!.f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0]!;
    expanded++;

    if (current.p.x === goal.x && current.p.y === goal.y) {
      const path: Point[] = [];
      let n: Node | null = current;
      while (n && n.parent) {
        path.push(n.p);
        n = n.parent;
      }
      return path.reverse();
    }

    for (const d of DIRS) {
      let nx = current.p.x + d.x;
      let ny = current.p.y + d.y;
      if (map.wraps) {
        nx = ((nx % map.width) + map.width) % map.width;
        ny = ((ny % map.height) + map.height) % map.height;
      } else if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) {
        continue;
      }
      const tile = map.tileAt(nx, ny);
      const isGoal = nx === goal.x && ny === goal.y;
      if (!isGoal && !isPassable(tile, transport)) continue;
      if (isGoal && !isPassable(tile, transport)) {
        // destino no transitable (p.ej. NPC, puerta): parar en la casilla anterior
        continue;
      }
      if (opts?.isBlocked?.(nx, ny)) continue;
      const g = current.g + 1;
      const k = key(nx, ny);
      if (g < (gScore.get(k) ?? Infinity)) {
        gScore.set(k, g);
        open.push({
          p: { x: nx, y: ny },
          g,
          f: g + dist({ x: nx, y: ny }, goal),
          parent: current,
        });
      }
    }
  }
  return null;
}

/** Dirección del primer paso entre dos puntos adyacentes (para tryMove). */
export function stepDirection(
  from: Point,
  to: Point,
  map: ActiveMap,
): "north" | "south" | "east" | "west" | null {
  let dx = to.x - from.x;
  let dy = to.y - from.y;
  if (map.wraps) {
    if (dx > map.width / 2) dx -= map.width;
    if (dx < -map.width / 2) dx += map.width;
    if (dy > map.height / 2) dy -= map.height;
    if (dy < -map.height / 2) dy += map.height;
  }
  if (dx === 1 && dy === 0) return "east";
  if (dx === -1 && dy === 0) return "west";
  if (dx === 0 && dy === 1) return "south";
  if (dx === 0 && dy === -1) return "north";
  return null;
}
