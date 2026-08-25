/**
 * Primitivas de la tabla de objetos del mundo `g_world_objects` (DS:0x5C5A,
 * 32 slots × 8 B). Espejo byte-a-byte de dos rutinas del binario (task #13):
 *
 *  - `find_free_actor_slot` (SJOG 0x0000): barre los slots 31→1 y devuelve el
 *    PRIMER slot con tile (+0) == 0. NUNCA toca el slot 0 (= vehículo activo del
 *    jugador). Devuelve 0 cuando no hay hueco (aborta la colocación de botín).
 *  - `write_object_slot` (kernel 0x3A74, near-call overlay 0x7AF4): escribe los
 *    SEIS primeros bytes del registro (+0..+5) y deja +6/+7 intactos.
 *
 * Sentinel de slot libre: en la tabla VIVA (0x5C5A) libre ⇔ tile (+0) == 0
 * (`find_free_actor_slot` y los 3 borrados de Get/trampa/cofre escriben tile 0).
 * El formato on-disk SAVED.GAM (0x6B4, ⚠O1) usa 0xFC como sentinel; el clon NO
 * cruza ese borde para el botín (los objetos-suelo de interior no persisten y el
 * overworld usa la lista viva), así que el mapeo 0↔0xFC se resuelve por
 * construcción: "ausencia del array vivo" ≡ tile 0. Ver port-f13-report §5.
 *
 * Citas: `re/disasm/ULTIMA.EXE.asm` pool 0x3A74; `re/disasm/SJOG.OVL.asm`
 * 0x0000 / 0x0F88 (loot_place) / 0x112C (open_chest_world); `.superpowers/sdd/scout-7af4.md`.
 */

import { POOL_SLOT_COUNT, SLOT_TILE_FREE as POOL_SLOT_TILE_FREE, findFreeActorSlot } from "./actorPool.js";

/** Sentinel de slot libre en la tabla VIVA 0x5C5A: tile (+0) == 0. (Fuente: actorPool, #103.) */
export const SLOT_TILE_FREE = POOL_SLOT_TILE_FREE;

/** Nº total de slots de la tabla (32; slot 0 = vehículo del jugador). (Fuente: actorPool, #103.) */
export const OBJECT_SLOT_COUNT = POOL_SLOT_COUNT;

/** Bytes de un registro de slot: +0..+7 (write_object_slot toca +0..+5). */
export type ObjectSlot = [number, number, number, number, number, number, number, number];

/** Registro vacío (los 8 bytes a 0 = slot libre). */
export function emptySlot(): ObjectSlot {
  return [0, 0, 0, 0, 0, 0, 0, 0];
}

/**
 * `find_free_actor_slot` (SJOG 0x0000): barrido 31→1, primer slot con tile==0.
 * Slot 0 = vehículo activo del jugador, jamás se devuelve. 0 = sin hueco.
 * `slots[i].tile` es el byte +0 del registro i. Adaptador sobre la implementación
 * ÚNICA del pool unificado (`actorPool.findFreeActorSlot`, #103).
 */
export function findFreeObjectSlot(slots: ReadonlyArray<{ tile: number }>): number {
  const occupied = new Set<number>();
  for (let i = 1; i < OBJECT_SLOT_COUNT; i++) {
    if ((slots[i]?.tile ?? SLOT_TILE_FREE) !== SLOT_TILE_FREE) occupied.add(i);
  }
  return findFreeActorSlot(occupied);
}

/**
 * `write_object_slot` (0x3A74): escribe los 6 primeros bytes del registro
 * (+0..+5); +6 y +7 NO se tocan (los ajusta el llamador, p.ej. loot_place fija
 * +7 = 0 en overworld / 0x20 en mazmorra tras esta escritura).
 */
export function writeObjectSlot(
  slot: ObjectSlot,
  b0: number,
  b1: number,
  b2: number,
  b3: number,
  b4: number,
  b5: number,
): void {
  slot[0] = b0 & 0xff;
  slot[1] = b1 & 0xff;
  slot[2] = b2 & 0xff;
  slot[3] = b3 & 0xff;
  slot[4] = b4 & 0xff;
  slot[5] = b5 & 0xff;
}
