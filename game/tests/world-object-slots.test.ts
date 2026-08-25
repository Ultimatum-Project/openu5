/**
 * #13 · Primitivas de la tabla de objetos g_world_objects (0x5C5A): espejo de
 * find_free_actor_slot (SJOG 0x0000) y write_object_slot (kernel 0x3A74).
 * Contrato verificado contra el asm en scout-7af4.md §2/§7.
 */
import { describe, expect, it } from "vitest";
import {
  findFreeObjectSlot,
  writeObjectSlot,
  emptySlot,
  SLOT_TILE_FREE,
  OBJECT_SLOT_COUNT,
} from "../src/core/world/worldObjects.js";

describe("#13 · find_free_actor_slot (0x0000)", () => {
  it("barre 31→1 y devuelve el slot MÁS ALTO libre (tile 0)", () => {
    const slots = Array.from({ length: OBJECT_SLOT_COUNT }, () => ({ tile: SLOT_TILE_FREE }));
    slots[0] = { tile: 1 }; // vehículo
    expect(findFreeObjectSlot(slots)).toBe(31); // primer libre barriendo desde 31
  });

  it("salta los slots ocupados (tile≠0) desde arriba", () => {
    const slots = Array.from({ length: OBJECT_SLOT_COUNT }, () => ({ tile: SLOT_TILE_FREE }));
    slots[0] = { tile: 1 };
    slots[31] = { tile: 0x40 };
    slots[30] = { tile: 0x40 };
    expect(findFreeObjectSlot(slots)).toBe(29);
  });

  it("NUNCA devuelve el slot 0 (vehículo del jugador) aunque esté 'libre'", () => {
    const slots = Array.from({ length: OBJECT_SLOT_COUNT }, () => ({ tile: 0x40 }));
    slots[0] = { tile: SLOT_TILE_FREE }; // slot 0 con tile 0
    expect(findFreeObjectSlot(slots)).toBe(0); // 0 = SIN hueco (no lo usa como libre)
  });

  it("tabla llena (1..31 ocupados) → 0 (sin hueco, aborta colocación)", () => {
    const slots = Array.from({ length: OBJECT_SLOT_COUNT }, () => ({ tile: 0x40 }));
    expect(findFreeObjectSlot(slots)).toBe(0);
  });
});

describe("#13 · write_object_slot (0x3A74)", () => {
  it("escribe los 6 primeros bytes (+0..+5) y deja +6/+7 intactos", () => {
    const rec = emptySlot();
    rec[6] = 0xaa;
    rec[7] = 0xbb;
    writeObjectSlot(rec, 0x02, 0x02, 10, 20, 3, 42);
    expect(rec).toEqual([0x02, 0x02, 10, 20, 3, 42, 0xaa, 0xbb]);
  });

  it("trunca cada byte a 8 bits (oro >255 hace wrap, fiel al slot+5 de 1 byte)", () => {
    const rec = emptySlot();
    writeObjectSlot(rec, 0x02, 0x02, 5, 6, 0, 300);
    expect(rec[5]).toBe(300 & 0xff); // 44
  });
});
