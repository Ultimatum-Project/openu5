/**
 * Mapa activo: acceso uniforme a tiles del overworld/underworld (256×256,
 * con wrap) y small maps (32×32 por plantas, sin wrap).
 */

export interface SmallMapFloor {
  z: number;
  tiles: number[][];
}

export interface SmallMapLocation {
  id: number;
  name: string;
  floors: SmallMapFloor[];
}

/** Datos de mundo cargados desde los assets extraídos. */
export interface WorldData {
  overworld: number[][]; // [y][x] 256×256
  underworld: number[][];
  smallMaps: Map<number, SmallMapLocation>; // por location id (1..32)
}

export const LARGE_MAP_SIZE = 256;
export const SMALL_MAP_SIZE = 32;

export interface ActiveMap {
  kind: "overworld" | "underworld" | "small";
  location: number; // 0 para large maps
  floor: number;
  width: number;
  height: number;
  wraps: boolean;
  tileAt(x: number, y: number): number;
  /**
   * Tile con el que el original RELLENA las celdas del viewport que caen FUERA de
   * un small map (32×32 sin wrap). Derivado del kernel `0x4402` (get_tile_ptr):
   * para g_location 1..0x7f, cualquier coord con x<0 | y<0 | x>31 | y>31 salta a
   * 0x4496 y devuelve el PUNTERO FIJO DS:0x6A07 — que es el ÚLTIMO byte del buffer
   * 32×32 (base 0x6608, +0x3FF) = la celda (31,31) del propio mapa. NO es un clamp
   * de índice, NO es un wrap, NO es una constante hardcodeada: es siempre la celda
   * (31,31). En Britain (31,31)=5 (hierba), lo que explica el "relleno de hierba"
   * del borde sur observado en el píxel-diff (caso britain_legit) y reconcilia la
   * tabla per-mapa de Ultima5Redux `SmallMap.GetOutOfBoundsSprite` (Sin Vraal=Desert,
   * Sutek/Grendel=Swamp, Stonegate=Hills = sus respectivas celdas (31,31)).
   * Los large maps (wrap toroidal) nunca lo usan → -1 (= TILE_OFFMAP, negro).
   */
  edgeFillTile: number;
}

export function wrapCoord(v: number): number {
  return ((v % LARGE_MAP_SIZE) + LARGE_MAP_SIZE) % LARGE_MAP_SIZE;
}

export function getActiveMap(
  world: WorldData,
  location: number,
  floor: number,
): ActiveMap {
  if (location === 0) {
    const isUnderworld = floor === 0xff;
    const tiles = isUnderworld ? world.underworld : world.overworld;
    return {
      kind: isUnderworld ? "underworld" : "overworld",
      location: 0,
      floor,
      width: LARGE_MAP_SIZE,
      height: LARGE_MAP_SIZE,
      wraps: true,
      tileAt: (x, y) => tiles[wrapCoord(y)]![wrapCoord(x)]!,
      edgeFillTile: -1, // wrap toroidal: nunca hay off-map
    };
  }
  const loc = world.smallMaps.get(location);
  if (!loc) throw new Error(`Location sin small map: ${location}`);
  const floorData = loc.floors.find((f) => f.z === floor);
  if (!floorData) {
    throw new Error(`Location ${location} (${loc.name}) sin planta ${floor}`);
  }
  return {
    kind: "small",
    location,
    floor,
    width: SMALL_MAP_SIZE,
    height: SMALL_MAP_SIZE,
    wraps: false,
    tileAt: (x, y) => {
      if (x < 0 || y < 0 || x >= SMALL_MAP_SIZE || y >= SMALL_MAP_SIZE) return -1;
      return floorData.tiles[y]![x]!;
    },
    // Off-map = celda (31,31) del buffer (kernel 0x4402 → puntero fijo 0x6A07). Ver
    // el doc de `ActiveMap.edgeFillTile`. Fallback -1 si el mapa no fuese 32×32.
    edgeFillTile:
      floorData.tiles[SMALL_MAP_SIZE - 1]?.[SMALL_MAP_SIZE - 1] ?? -1,
  };
}
