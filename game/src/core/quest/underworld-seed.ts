/**
 * Sembrador del Underworld — shards y amuleto de Lord British en sus posiciones REALES.
 *
 * Port de OUTSUBS `seed_underworld_plot` 0x0566 (re/disasm/OUTSUBS.OVL.asm:0566-05ed).
 * El binario ejecuta esta rutina al CARGAR el mapa exterior; sólo siembra si
 * g_floor != 0 (el Underworld — la cara inferior del mapa del mundo), y escribe los
 * slots-objeto en la tabla g_world_objects (DS:0x5C5A): el amuleto en el slot 28
 * (0x5C5A+224 = 0x5D3A) y los tres shards en los slots 29-31 (0x5D42/0x5D4A/0x5D52,
 * stride 8). El disassembler etiquetó 0x5D3A como `g_char_anim_states+224`, pero
 * 0x5C5A+0xE0 cae DENTRO de la tabla de objetos del mundo.
 *
 * Formato del slot (6 bytes escritos, stride 8): [tile, tile, X, Y, 0xFF, z].
 *
 * Shards (bucle si=0..2, 0x059d-0x05e0):
 *   - Gate no-tomado:  `cmp [si+0x57b6],0 / jne skip`   → sólo si el shard i no fue tomado.
 *   - Gate SL vivo:    `cmp [si+0x58c8],0x80 / jae skip` → sólo si su Shadowlord sigue vivo (<0x80).
 *   - tile = 0xB4 FIJO para los tres (`al=0xb4` incondicional en 0x05b8, escrito en [di] y [di+1]).
 *   - X = [si+0x3a06], Y = [si+0x3a0a], z = [si+0x3a0e] (tabla de shards, T1).
 *   - Orden índice→shard (strings DS 0x8D18/24/2E): 0=Falsehood, 1=Hatred, 2=Cowardice.
 *
 * Amuleto (bloque 0x057c-0x0598, todo INMEDIATOS — no está en la tabla):
 *   - Gate: `cmp [g_amulet_lb],0 / jne 0x59d` → sólo si el amuleto NO fue tomado
 *     (g_amulet_lb==0). No hay gate de Shadowlord: es un slot independiente.
 *   - tile 0xB7 en (0x69,0xE1) = (105,225), z=0xF3.
 *
 * El byte z (0xF0..0xF3) no lo consume ninguna ruta portada; se PRESERVA en el modelo
 * (WorldObject.plotZ). Semántica **DERIVADA** (`re/notes/oracle-underworld-z.md`, grado A
 * estático): el juego sólo lee `z & 3` (SJOG 0x16b9 `and si,3`) = índice de shard; el
 * nibble alto 0xF0 es inerte. El port deriva esa identidad por `plotItem` al sembrar, que
 * es lo mismo que z&3 — de ahí que no consumirlo sea correcto y no un hueco.
 */
import type { PlotItemId, WorldObject } from "../state.js";

/** obj+4 del slot: los cuatro objetos de trama viven en el Underworld (floor byte 0xFF). */
export const UNDERWORLD_PLOT_FLOOR = 0xff;

/** Tile de los tres shards (OUTSUBS 0x05b8: `al=0xb4`, mismo para i=0..2). */
export const SHARD_TILE = 0xb4;

/** Tile del amuleto (OUTSUBS 0x0581: `al=0xb7`). */
export const AMULET_TILE = 0xb7;

/** Constante de código del amuleto: (105,225), z=0xF3 (OUTSUBS 0x0589-0x0598, inmediatos). */
export const AMULET_SPAWN = { x: 0x69, y: 0xe1, z: 0xf3 } as const;

/** Orden de la tabla de shards (índice → item), fijado por los strings DS 0x8D18/24/2E. */
const SHARD_ITEMS: readonly PlotItemId[] = [
  "shard-falsehood",
  "shard-hatred",
  "shard-cowardice",
] as const;

export interface ShardSpawn {
  x: number;
  y: number;
  /** Byte z del slot (0xF0/0xF1/0xF2); se preserva sin usar. */
  z: number;
}

export interface UnderworldSeedInput {
  /** Tabla de shards de DATA.OVL 0x3a06 (data.json.shardSpawns): 3 entradas en orden. */
  shardSpawns: ShardSpawn[];
  /** Por índice 0..2: ¿el shard ya fue tomado? (espejo de [si+0x57b6]!=0). */
  shardTaken: readonly boolean[];
  /** Por índice 0..2: ¿su Shadowlord sigue vivo? (espejo de [si+0x58c8]<0x80). */
  shadowlordAlive: readonly boolean[];
  /** ¿El amuleto ya fue tomado? (espejo de g_amulet_lb!=0). */
  amuletTaken: boolean;
}

/**
 * Devuelve los WorldObjects de trama a sembrar en el Underworld según los gates.
 * Función pura: el caller (Game.hydrateUnderworldPlot) purga los "plot" previos y
 * empalma esta lista en state.worldObjects. Espejo exacto del bucle 0x059d-0x05e0 y
 * del bloque del amuleto 0x057c-0x0598.
 */
export function seedUnderworldPlotObjects(input: UnderworldSeedInput): WorldObject[] {
  const objs: WorldObject[] = [];

  // Amuleto primero (el binario lo escribe antes del bucle de shards, slot 28).
  if (!input.amuletTaken) {
    objs.push({
      location: 0,
      floor: UNDERWORLD_PLOT_FLOOR,
      x: AMULET_SPAWN.x,
      y: AMULET_SPAWN.y,
      tile: AMULET_TILE,
      kind: "plot",
      plotItem: "amulet",
      plotZ: AMULET_SPAWN.z,
    });
  }

  for (let i = 0; i < SHARD_ITEMS.length; i++) {
    const spawn = input.shardSpawns[i];
    if (!spawn) continue; // sin dato = no siembra (defensivo)
    if (input.shardTaken[i]) continue; // 0x05a7: shard tomado → skip
    if (!input.shadowlordAlive[i]) continue; // 0x05ae: SL muerto → skip
    objs.push({
      location: 0,
      floor: UNDERWORLD_PLOT_FLOOR,
      x: spawn.x,
      y: spawn.y,
      tile: SHARD_TILE,
      kind: "plot",
      plotItem: SHARD_ITEMS[i],
      plotZ: spawn.z,
    });
  }

  return objs;
}
