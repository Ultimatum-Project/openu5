/**
 * Parser de mapas de pueblo (small maps 32×32) de Ultima V.
 *
 * Cada planta = 32×32 tiles = 1024 bytes (0x400) row-major, 1 byte/tile.
 * Las plantas de todas las locations de un mismo fichero se almacenan
 * consecutivas en el orden de la tabla LOCATIONS (= orden de edificios en el
 * fichero), por lo que el offset de cada planta es acumulativo.
 *
 * Ver docs/formats/maps.md §2.
 */

import { LOCATIONS } from "../data/locations.js";
import type { LocationInfo } from "../data/locations.js";

const FLOOR_SIZE = 32; // tiles por lado
const FLOOR_BYTES = FLOOR_SIZE * FLOOR_SIZE; // 1024

export interface FloorMap {
  z: number;
  tiles: number[][]; // [y][x], 32×32
}

export interface LocationMaps {
  id: number;
  name: string;
  floors: FloorMap[];
}

export interface SmallMapFiles {
  castle: Uint8Array;
  towne: Uint8Array;
  dwelling: Uint8Array;
  keep: Uint8Array;
}

function fileFor(loc: LocationInfo, files: SmallMapFiles): Uint8Array {
  switch (loc.datFile) {
    case "CASTLE":
      return files.castle;
    case "TOWNE":
      return files.towne;
    case "DWELLING":
      return files.dwelling;
    case "KEEP":
      return files.keep;
  }
}

/** Lee una planta de 32×32 (row-major) a partir de un offset de bytes. */
function readFloor(data: Uint8Array, offset: number): number[][] {
  const tiles: number[][] = [];
  for (let y = 0; y < FLOOR_SIZE; y++) {
    const row = new Array<number>(FLOOR_SIZE);
    for (let x = 0; x < FLOOR_SIZE; x++) {
      row[x] = data[offset + y * FLOOR_SIZE + x]!;
    }
    tiles.push(row);
  }
  return tiles;
}

/**
 * Parsea las 32 locations con mapa pequeño a partir de los 4 ficheros .DAT.
 * Las plantas se leen consecutivas dentro de cada fichero en el orden de
 * LOCATIONS.
 */
export function parseSmallMaps(files: SmallMapFiles): LocationMaps[] {
  // offset acumulado por fichero (cada planta consume FLOOR_BYTES).
  const offsets: Record<LocationInfo["datFile"], number> = {
    CASTLE: 0,
    TOWNE: 0,
    DWELLING: 0,
    KEEP: 0,
  };

  return LOCATIONS.map((loc) => {
    const data = fileFor(loc, files);
    const floors: FloorMap[] = loc.floors.map((z) => {
      const offset = offsets[loc.datFile];
      offsets[loc.datFile] = offset + FLOOR_BYTES;
      return { z, tiles: readFloor(data, offset) };
    });
    return { id: loc.id, name: loc.name, floors };
  });
}
