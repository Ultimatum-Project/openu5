/**
 * BRIT.CBT / DUNGEON.CBT — mapas de combate 11×11.
 *
 * 352 bytes (0x160) por mapa = 11 filas × 32 bytes. BRIT.CBT = 16 mapas
 * (5632 B); DUNGEON.CBT = 112 mapas (39424 B). Ver docs/formats/maps.md §4.
 *
 * Layout por fila (bytes 0..10 = tiles [x] de la rejilla; 11..31 = metadatos):
 *   Fila 0 : sprites de 8 triggers (bytes 11..18)
 *   Filas 1-4: 6 PJs por dirección de entrada (1=east,2=west,3=south,4=north);
 *              X del PJ p en 11+p, Y en 17+p
 *   Fila 5 : sprite de 16 map-units (bytes 11..26)
 *   Fila 6 : X de cada map-unit
 *   Fila 7 : Y de cada map-unit
 *   Fila 8 : trigger positions   — X en 11..18, Y en 19..26
 *   Fila 9 : trigger newPosition1 — X en 11..18, Y en 19..26
 *   Fila 10: trigger newPosition2 — X en 11..18, Y en 19..26
 */

export type CombatTerritory = "britannia" | "dungeon";
export type CombatDirection = "east" | "west" | "south" | "north";

export interface Point {
  x: number;
  y: number;
}

export interface CombatUnit {
  /** Sprite crudo tal cual está en el fichero (enemigo real = sprite + 0x100). */
  sprite: number;
  x: number;
  y: number;
}

export interface CombatTrigger {
  sprite: number;
  at: Point;
  pos1: Point;
  pos2: Point;
}

export interface CombatMap {
  index: number;
  territory: CombatTerritory;
  name: string | null;
  /** [y][x] — rejilla 11×11 de tiles. */
  tiles: number[][];
  playerStarts: Record<CombatDirection, Point[]>;
  units: CombatUnit[];
  triggers: CombatTrigger[];
}

/** Nombres de los 16 mapas de BRIT.CBT por índice. */
const BRITANNIA_NAMES = [
  "CampFire",
  "Swamp",
  "Glade",
  "Treed",
  "Desert",
  "CleanTree",
  "Mountains",
  "BigBridge",
  "Brick",
  "Basement",
  "Psychedelic",
  "BoatOcean",
  "BoatNorth",
  "BoatSouth",
  "BoatBoat",
  "Bay",
] as const;

const MAP_BYTES = 352;
const ROW_BYTES = 32;
const GRID = 11;

const DIRECTIONS: CombatDirection[] = ["east", "west", "south", "north"];

function parseOneMap(
  data: Uint8Array,
  base: number,
  index: number,
  territory: CombatTerritory,
  name: string | null,
): CombatMap {
  const at = (row: number, col: number): number =>
    data[base + row * ROW_BYTES + col] ?? 0;

  // Tiles: bytes 0..10 de cada una de las 11 filas → [y][x].
  const tiles: number[][] = [];
  for (let y = 0; y < GRID; y++) {
    const row: number[] = [];
    for (let x = 0; x < GRID; x++) row.push(at(y, x));
    tiles.push(row);
  }

  // Posiciones iniciales de 6 PJs por dirección (filas 1..4).
  const playerStarts = {
    east: [],
    west: [],
    south: [],
    north: [],
  } as Record<CombatDirection, Point[]>;
  for (let d = 0; d < DIRECTIONS.length; d++) {
    const dir = DIRECTIONS[d]!;
    const row = 1 + d;
    for (let p = 0; p < 6; p++) {
      playerStarts[dir].push({ x: at(row, 11 + p), y: at(row, 17 + p) });
    }
  }

  // 16 map-units: sprite (fila 5), X (fila 6), Y (fila 7).
  //
  // ★ CRITERIO DE RANURA VACÍA = `sprite === 0` — DERIVADO, no supuesto (2026-07-25).
  // Antes decía «(0,0) = vacío» y filtraba por POSICIÓN. Era falso, y descartaba enemigos
  // que el original SÍ crea. Derivación en `re/notes/cbt-unidades-0-0-y-cruce-movil.md`:
  //
  //   · SALAS de mazmorra — `DNGLOOK.OVL 0x117E` (2ª mitad, bucle de 16 desde 0x1291):
  //       12a4  mov al, byte ptr [bx - 0x524c]   ; 0xADB4 = búfer + fila 5 → SPRITE
  //       12ab  or al, al
  //       12af  jmp 0x1385                      ; ★ sprite == 0 ⇒ SALTA LA RANURA ★
  //       1305  mov al, byte ptr [bx - 0x522c]   ; fila 6 → X   ┐ leídas DESPUÉS
  //       130f  mov al, byte ptr [bx - 0x520c]   ; fila 7 → Y   ┘ del filtro
  //     El único descarte es el sprite; la POSICIÓN no se mira nunca.
  //
  //   · ENCUENTROS (BRIT) — `ULTIMA.EXE 0x60EC` copia las 16 ranuras enteras con
  //     `rep movsw` (X→0x1704, Y→0x1714), sin una sola comparación.
  //
  // ⇒ Una ranura con sprite real en (0,0) SE COLOCA. Y este criterio es además el MISMO
  // que usan los triggers diez líneas más abajo y el consumidor del port
  // (`combat.ts` `spriteToEnemyIndex(...) === null → continue`): deja de haber dos
  // respuestas distintas a «¿está vacía esta ranura?» en el mismo fichero.
  const units: CombatUnit[] = [];
  for (let u = 0; u < 16; u++) {
    const sprite = at(5, 11 + u);
    if (sprite === 0) continue; // ranura vacía (DNGLOOK 0x12ab)
    units.push({ sprite, x: at(6, 11 + u), y: at(7, 11 + u) });
  }

  // 8 triggers: sprite (fila 0), at (fila 8), pos1 (fila 9), pos2 (fila 10).
  const triggers: CombatTrigger[] = [];
  for (let t = 0; t < 8; t++) {
    const sprite = at(0, 11 + t);
    if (sprite === 0) continue; // sprite 0 = trigger vacío
    triggers.push({
      sprite,
      at: { x: at(8, 11 + t), y: at(8, 19 + t) },
      pos1: { x: at(9, 11 + t), y: at(9, 19 + t) },
      pos2: { x: at(10, 11 + t), y: at(10, 19 + t) },
    });
  }

  return { index, territory, name, tiles, playerStarts, units, triggers };
}

export function parseCombatMaps(
  britCbt: Uint8Array,
  dungeonCbt: Uint8Array,
): CombatMap[] {
  if (britCbt.length < 16 * MAP_BYTES) {
    throw new Error(
      `BRIT.CBT truncado: ${britCbt.length} bytes, se esperaban ${16 * MAP_BYTES}`,
    );
  }
  if (dungeonCbt.length < 112 * MAP_BYTES) {
    throw new Error(
      `DUNGEON.CBT truncado: ${dungeonCbt.length} bytes, se esperaban ${112 * MAP_BYTES}`,
    );
  }

  const maps: CombatMap[] = [];
  for (let i = 0; i < 16; i++) {
    maps.push(
      parseOneMap(britCbt, i * MAP_BYTES, i, "britannia", BRITANNIA_NAMES[i]!),
    );
  }
  for (let i = 0; i < 112; i++) {
    maps.push(parseOneMap(dungeonCbt, i * MAP_BYTES, i, "dungeon", null));
  }
  return maps;
}
