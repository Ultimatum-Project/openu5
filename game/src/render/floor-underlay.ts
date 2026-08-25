/**
 * ¿Puede un tile servir de SUELO sintetizado bajo una decoración recortable (fuente, brasero,
 * campo, moongate, boundary…)? Capa de VISTA pura: `render/` puede leer `core/tiles` (Regla C
 * del guard de costuras) — las pieles NO, por eso este predicado vive aquí y las pieles
 * (`skin/shader/contour-transp.ts`) lo importan desde `render/`, no desde el core.
 *
 * Regla del usuario: «hay que quitar paredes — nunca hay nada con fondo de pared». Suelo =
 * pisable a pie O agua (barca/esquife): hierba/ladrillo/madera/alfombra/puente/escaleras
 * (walkable), lava (walkable en TileData) y agua (boat/skiff). Excluye MUROS y no-suelos:
 * piedra seca, puertas, ventanas y las propias decoraciones de suelo (walk=0, no-agua) — de
 * estas últimas las relevantes ya las filtra el `skip` del llamante, pero la guarda las cubre.
 */
import { TILE_INFO } from "../core/tiles.js";

export function isFloorUnderlayCandidate(tile: number): boolean {
  const info = TILE_INFO[tile];
  if (!info) return false;
  return info.walkable || info.boatPassable || info.skiffPassable;
}
