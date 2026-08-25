/**
 * Parser de ficheros .NPC (CASTLE/TOWNE/DWELLING/KEEP.NPC).
 *
 * Cada fichero contiene 8 pueblos × 576 bytes (0x240). Por pueblo (base = town*576):
 *   base+0x000..0x1FF : 32 × NpcSchedule de 16 bytes
 *       +0  aiTypes[3]  +3 x[3]  +6 y[3]  +9 z[3]  +12 times[4]
 *   base+0x200..0x21F : 32 × npcType (byte)
 *   base+0x220..0x23F : 32 × dialogNumber (byte, = npcIndex del .TLK)
 *
 * El slot 0 no se usa. El orden de pueblos dentro del fichero es el mismo que el
 * de las plantas de su .DAT (ver docs/formats/maps.md §2).
 */

const TOWN_SIZE = 576;
const TOWNS_PER_FILE = 8;
const SLOTS_PER_TOWN = 32;
const SCHEDULE_SIZE = 16;
const TYPE_OFFSET = 0x200;
const DIALOG_OFFSET = 0x220;

export interface NpcSlot {
  slot: number;
  aiTypes: [number, number, number];
  x: [number, number, number];
  y: [number, number, number];
  z: [number, number, number];
  times: [number, number, number, number];
  type: number;
  dialogNumber: number;
}

function parseTown(bytes: Uint8Array, base: number): NpcSlot[] {
  const slots: NpcSlot[] = [];
  for (let slot = 0; slot < SLOTS_PER_TOWN; slot++) {
    const s = base + slot * SCHEDULE_SIZE;
    slots.push({
      slot,
      aiTypes: [bytes[s]!, bytes[s + 1]!, bytes[s + 2]!],
      x: [bytes[s + 3]!, bytes[s + 4]!, bytes[s + 5]!],
      y: [bytes[s + 6]!, bytes[s + 7]!, bytes[s + 8]!],
      z: [bytes[s + 9]!, bytes[s + 10]!, bytes[s + 11]!],
      times: [bytes[s + 12]!, bytes[s + 13]!, bytes[s + 14]!, bytes[s + 15]!],
      type: bytes[base + TYPE_OFFSET + slot]!,
      dialogNumber: bytes[base + DIALOG_OFFSET + slot]!,
    });
  }
  return slots;
}

/** Parsea un fichero .NPC entero: 8 pueblos × 32 slots. */
export function parseNpcFile(bytes: Uint8Array): NpcSlot[][] {
  const towns: NpcSlot[][] = [];
  for (let town = 0; town < TOWNS_PER_FILE; town++) {
    towns.push(parseTown(bytes, town * TOWN_SIZE));
  }
  return towns;
}

/**
 * Location ids (enum Location de maps.md §2) por posición dentro de cada fichero.
 * El orden coincide con el de las plantas del .DAT correspondiente.
 */
const LOCATION_ORDER = {
  castle: [17, 18, 19, 20, 21, 22, 23, 24],
  towne: [1, 2, 3, 4, 5, 6, 7, 8],
  dwelling: [9, 10, 11, 12, 13, 14, 15, 16],
  keep: [25, 26, 27, 28, 29, 30, 31, 32],
} as const;

/**
 * Parsea los 4 ficheros .NPC y devuelve un mapa location id → 32 slots.
 */
export function parseAllNpcs(files: {
  castle: Uint8Array;
  towne: Uint8Array;
  dwelling: Uint8Array;
  keep: Uint8Array;
}): Record<number, NpcSlot[]> {
  const result: Record<number, NpcSlot[]> = {};
  for (const key of ["castle", "towne", "dwelling", "keep"] as const) {
    const towns = parseNpcFile(files[key]);
    const order = LOCATION_ORDER[key];
    for (let i = 0; i < order.length; i++) {
      result[order[i]!] = towns[i]!;
    }
  }
  return result;
}
