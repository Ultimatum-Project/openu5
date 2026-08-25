/**
 * Cañones a pie — comando (F)ire en pueblo/combate. Derivación byte a byte de
 * CMDS.OVL cmd_fire (0x0AEA → rama pueblo 0x0B16), ver re/notes/cannon-fire.md.
 *
 * A diferencia de la ANDANADA de fragata (loc 0, CMDS 0x0962 → transport.ts), el
 * cañón a pie NO pide dirección con getdir: escanea los 4 vecinos ortogonales del
 * party buscando un tile de cañón y dispara en la dirección que el propio tile del
 * cañón codifica (bits bajos). Estas son las primitivas puras de esa lógica.
 */

import type { Direction } from "./movement.js";

/**
 * Tile de cañón: 0xB4..0xB7 (`(tile & 0xFC) === 0xB4`). El predicado del binario es
 * exactamente `and al,0xFC; cmp al,0xB4` (CMDS 0x0B2F/0x0B4A/0x0B60/0x0B7A) y el mismo
 * que usa Push para clasificar el mueble giratorio (CMDS is_pushable 0x14BD, cmds.md §3).
 */
const CANNON_TILE_BASE = 0xb4;
export function isCannonTile(tile: number): boolean {
  return (tile & 0xfc) === CANNON_TILE_BASE;
}

/**
 * Dirección de disparo = orientación del tile del cañón (`tile & 3`):
 *   0 → Norte · 1 → Este · 2 → Sur · 3 → Oeste.
 * Doble anclaje en el ASM: (a) el switch de cmd_fire 0x0BBC (orient 0→dx0/dy-1,
 * 1→dx+1/dy0, 2→dx0/dy+1, 3→dx-1/dy0) y (b) `dir_vector_to_facing` 0x1504, que al
 * empujar un cañón fija su tile a base 0xB4 + {N:0, E:1, S:2, O:3}. AMBAS coinciden.
 *
 * ⚠ Nota: los NOMBRES de TileData.json (Ultima5Redux) rotulan 0xB5=CannonDown y
 * 0xB6=CannonRight, lo que INVIERTE Este/Sur respecto al motor. El ASM manda: 0xB5
 * dispara al ESTE y 0xB6 al SUR.
 */
export function cannonFireDir(tile: number): Direction {
  switch (tile & 3) {
    case 0:
      return "north";
    case 1:
      return "east";
    case 2:
      return "south";
    default:
      return "west";
  }
}

/**
 * Tile que colisiona con la bola cuando la celda NO tiene ocupante (CMDS 0x0C75-0x0C87,
 * tras `call 0x8482` = puntero al tile base): rangos EXACTOS 0x97..0x99 y 0xB8..0xBB.
 * Son puertas mágicas/rastrillo (0x97 MagicLockDoor, 0x98 …WithView, 0x99 Portcullis) y
 * puertas normales/cerradas ±ventana (0xB8..0xBB). El resto de terreno es transparente:
 * la bola lo sobrevuela. Es una lista LITERAL del binario, NO el flag rangeWeaponPassable
 * de TileData (que difiere: 0x99 Portcullis lo marca pasable pero el cañón lo destruye).
 */
export function isCannonSolid(tile: number): boolean {
  return (tile >= 0x97 && tile <= 0x99) || (tile >= 0xb8 && tile <= 0xbb);
}

/** Tile de relleno tras destruir un muro/puerta: 0x44 BrickFloor (CMDS 0x0D2E `mov [bx],0x44`). */
export const CANNON_RUBBLE_TILE = 0x44;

/**
 * 🔴 LOS DOS ALCANCES DEL CAÑÓN SON DISTINTOS, y las dos superficies se parecen tanto que
 * invitan a copiar el de al lado. Se declaran JUNTOS aquí para que la diferencia se lea de
 * una vez y nadie la unifique «por simetría» (la ficha #311 dio 3 para las dos al generalizar
 * el de la andanada; el cañón a pie siempre estuvo en 4, y así lo derivó y portó #32).
 *
 * Comparten, eso sí, el stub del vuelo (0xffffbc6a) y el barrido de sonido (0x842E) — lo que
 * NO comparten es ni el alcance ni el ORIGEN de la bala (ver `skin/world-fx.ts`).
 */
/** ANDANADA: contador `[bp-0xc]` 0,1,2 con post-incremento y `cmp 3` (CMDS 0x0AA5) ⇒ 3 celdas. */
export const BROADSIDE_RANGE = 3;
/**
 * CAÑÓN A PIE: contador `[bp-0x16]` inicializado a **5** (CMDS 0x0C15) con **pre-decremento**
 * y test `> 0` (0x0C2C/0x0C2F) ⇒ 5→4,3,2,1 avanzan y el 0 corta = **4 celdas**, contadas
 * desde la celda DEL CAÑÓN (que ya está a una del grupo). El 5 del literal no es el alcance.
 */
export const CANNON_FOOT_RANGE = 4;

/** Vecinos ortogonales en el ORDEN del escaneo del binario (N,E,S,O; primer cañón gana). */
export const CANNON_NEIGHBOR_SCAN: { dir: Direction; dx: number; dy: number }[] = [
  { dir: "north", dx: 0, dy: -1 }, // CMDS 0x0B27 [0xAB87]
  { dir: "east", dx: 1, dy: 0 }, // CMDS 0x0B42 [0xABA8]
  { dir: "south", dx: 0, dy: 1 }, // CMDS 0x0B58 [0xABC7]
  { dir: "west", dx: -1, dy: 0 }, // CMDS 0x0B72 [0xABA6]
];
