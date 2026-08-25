/**
 * Elección del GRUPO de player-starts al ENTRAR a una sala de mazmorra (carril arena-entry).
 *
 * DERIVACIÓN (byte-exacta + CENSO — sin oráculo; un patrón replicable de derivación-por-censo):
 *  - El .CBT de cada sala define 4 grupos de player-starts (filas 1-4 = east/west/south/north);
 *    grupo X = borde de spawn X (verificado en agregado sobre 128 combatmaps: north≈y1.9 arriba,
 *    south≈y5.9 abajo, west≈x0.8 izq, east≈x4.4 der).
 *  - El port HARDCODEABA "south" (game.ts startDungeonRoomCombat). NO es fiel: de las 112 salas
 *    de mazmorra REFERENCIADAS por celdas-sala de dungeons.json, **33 tienen el grupo SOUTH
 *    DEGENERADO (todo (0,0))** → con south-fijo spawnearían en (0,0). ⇒ el binario elige el borde
 *    por `g_dng_facing` (dng_enter_room DUNGEON.OVL 0x0000 lee g_dng_facing @0x0019).
 *  - MAPPING facing→grupo, DERIVADO DEL DATO (método salas-de-un-solo-lado): tomando las salas
 *    enterables desde EXACTAMENTE un lado (un solo vecino andable) con EXACTAMENTE un grupo real,
 *    **72 salas así en las 8 mazmorras, 72/72 con el MISMO patrón, 0 contraejemplos**: el grupo
 *    real = el borde del que VIENES = **OPUESTO del facing** (marchas al norte → vienes del sur →
 *    spawn en el borde SUR → grupo "south"). Casa con map29 y con la física. Es el UNIVERSO de
 *    casos no-ambiguos → prueba más fuerte que un run de oráculo (1 punto). Por eso los grupos
 *    degenerados existen: son las direcciones NO-enterables de cada sala (nunca se usan).
 *  - GUARD anti-(0,0): el binario NUNCA elige un grupo degenerado (toda dir enterable tiene grupo
 *    real), así que `roomEntryDirectionFor` cae al primer grupo real sólo como defensa muda.
 */
import type { EntryDirection } from "./combat.js";

export type DungeonFacing = "north" | "east" | "south" | "west";

/** Borde OPUESTO al facing = grupo de player-starts elegido (DERIVADO: 72/72 salas, ver header). */
export const OPPOSITE_EDGE: Record<DungeonFacing, EntryDirection> = {
  north: "south",
  south: "north",
  east: "west",
  west: "east",
};

/**
 * ¿El grupo de starts es DEGENERADO (todo (0,0))? El .CBT rellena con (0,0) las direcciones por
 * las que una sala NO se entra. Ante un grupo degenerado el binario o spawnea en (0,0) o cae a
 * otro grupo — comportamiento PENDIENTE DE ORÁCULO (Q2). El guard permite decidirlo en un sitio.
 */
export function isDegenerateStarts(pts: ReadonlyArray<{ x: number; y: number }>): boolean {
  return pts.length > 0 && pts.every((p) => p.x === 0 && p.y === 0);
}

/** GRUPO de entrada de una sala dado el facing de marcha = `OPPOSITE_EDGE[facing]` (pura). */
export function roomEntryDirection(facing: DungeonFacing): EntryDirection {
  return OPPOSITE_EDGE[facing];
}

/**
 * Borde de entrada FINAL para una sala: `OPPOSITE_EDGE[facing]` + guard defensivo anti-(0,0).
 * El binario NUNCA elige un grupo degenerado (cada dirección enterable de una sala tiene grupo
 * real; las degeneradas son las NO-enterables), así que el guard no debería dispararse en juego
 * normal — pero ante una entrada anómala (p.ej. caer por un foso a una sala) cae al PRIMER grupo
 * real en orden fijo (south→north→east→west) en vez de spawnear la party en (0,0). Determinista.
 */
export function roomEntryDirectionFor(
  playerStarts: Record<EntryDirection, ReadonlyArray<{ x: number; y: number }>>,
  facing: DungeonFacing,
): EntryDirection {
  const primary = OPPOSITE_EDGE[facing];
  if (!isDegenerateStarts(playerStarts[primary] ?? [])) return primary;
  const fallback = (["south", "north", "east", "west"] as const).find(
    (d) => !isDegenerateStarts(playerStarts[d] ?? []),
  );
  return fallback ?? primary;
}
