/**
 * DUNGEON.DAT — 8 mazmorras × 8 niveles × rejilla 8×8.
 *
 * Fichero de 4096 bytes exactos. Mazmorra n en offset `n*512`; nivel f en
 * `n*512 + f*64`; tile (col,row) en byte `row*8 + col`. Cada byte: nibble alto =
 * tipo, nibble bajo = subtipo/flags. Ver docs/formats/maps.md §3.
 */

/** Tipo de tile de mazmorra (nibble alto del byte). */
export const DungeonTileType = {
  Nothing: 0x0,
  LadderUp: 0x1,
  LadderDown: 0x2,
  LadderUpDown: 0x3,
  Chest: 0x4,
  Fountain: 0x5,
  Trap: 0x6,
  OpenChest: 0x7,
  MagicField: 0x8,
  Unknown9: 0x9,
  RoomsBroke: 0xa,
  Wall: 0xb,
  SecondaryWall: 0xc,
  SecretDoor: 0xd,
  NormalDoor: 0xe,
  Room: 0xf,
} as const;

export type DungeonTileType =
  (typeof DungeonTileType)[keyof typeof DungeonTileType];

export interface DungeonCell {
  /** Nibble alto: uno de DungeonTileType (0..15). */
  type: number;
  /** Nibble bajo: subtipo/flags dependiente del tipo. */
  sub: number;
}

export interface Dungeon {
  /** Location enum (33..40): Deceit..Doom. */
  location: number;
  name: string;
  /** [floor][y][x] — 8 plantas de 8×8. */
  floors: DungeonCell[][][];
}

/** Orden fijo de las 8 mazmorras (= Location 33..40). */
const DUNGEON_LOCATIONS: { location: number; name: string }[] = [
  { location: 33, name: "Deceit" },
  { location: 34, name: "Despise" },
  { location: 35, name: "Destard" },
  { location: 36, name: "Wrong" },
  { location: 37, name: "Covetous" },
  { location: 38, name: "Shame" },
  { location: 39, name: "Hythloth" },
  { location: 40, name: "Doom" },
];

const DUNGEON_COUNT = 8;
const FLOORS = 8;
const SIZE = 8; // 8×8 por planta

export function parseDungeons(dat: Uint8Array): Dungeon[] {
  const expected = DUNGEON_COUNT * FLOORS * SIZE * SIZE;
  if (dat.length < expected) {
    throw new Error(
      `DUNGEON.DAT truncado: ${dat.length} bytes, se esperaban ${expected}`,
    );
  }

  const dungeons: Dungeon[] = [];
  for (let d = 0; d < DUNGEON_COUNT; d++) {
    const floors: DungeonCell[][][] = [];
    for (let f = 0; f < FLOORS; f++) {
      const floor: DungeonCell[][] = [];
      for (let y = 0; y < SIZE; y++) {
        const row: DungeonCell[] = [];
        for (let x = 0; x < SIZE; x++) {
          const b = dat[d * 512 + f * 64 + y * SIZE + x] ?? 0;
          let type = b >> 4;
          const sub = b & 0x0f;
          // Caso especial: Nothing con subByte 8 se reinterpreta como LadderUp.
          if (type === DungeonTileType.Nothing && sub === 8) {
            type = DungeonTileType.LadderUp;
          }
          row.push({ type, sub });
        }
        floor.push(row);
      }
      floors.push(floor);
    }
    const meta = DUNGEON_LOCATIONS[d]!;
    dungeons.push({ location: meta.location, name: meta.name, floors });
  }
  return dungeons;
}
