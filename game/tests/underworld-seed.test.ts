/**
 * Sembrador del Underworld (F1.10-T2): shards y amuleto en sus posiciones REALES.
 *
 * Port de OUTSUBS 0x0566 (re/disasm/OUTSUBS.OVL.asm:0566-05ed). Al cargar el mapa
 * exterior con g_floor != 0 (Underworld), por cada shard i=0..2 se siembra un
 * slot-objeto [tile,tile,x,y,0xFF,z] SI el shard NO fue tomado ([si+0x57b6]==0) Y su
 * Shadowlord sigue VIVO ([si+0x58c8]<0x80). El amuleto (bloque 0x057c-0x0598, con
 * inmediatos) se siembra SI g_amulet_lb==0 (no tomado), sin gate de Shadowlord.
 *
 * Coords REALES (DATA.OVL, tabla 0x3a06, verificadas en T1):
 *   Falsehood(192,80,0xF0) · Hatred(130,65,0xF1) · Cowardice(176,184,0xF2)
 * Amuleto (constante de código): tile 0xB7 en (105,225), z=0xF3.
 */
import { describe, it, expect } from "vitest";
import {
  seedUnderworldPlotObjects,
  SHARD_TILE,
  AMULET_TILE,
  AMULET_SPAWN,
  UNDERWORLD_PLOT_FLOOR,
  type UnderworldSeedInput,
} from "../src/core/quest/underworld-seed.js";

const SHARD_SPAWNS = [
  { x: 192, y: 80, z: 0xf0 },
  { x: 130, y: 65, z: 0xf1 },
  { x: 176, y: 184, z: 0xf2 },
];

function input(over: Partial<UnderworldSeedInput> = {}): UnderworldSeedInput {
  return {
    shardSpawns: SHARD_SPAWNS,
    shardTaken: [false, false, false],
    shadowlordAlive: [true, true, true],
    amuletTaken: false,
    ...over,
  };
}

describe("seedUnderworldPlotObjects", () => {
  it("siembra los 3 shards + amuleto en un arranque fresco (nada tomado, SL vivos)", () => {
    const objs = seedUnderworldPlotObjects(input());
    expect(objs).toHaveLength(4);
  });

  it("los 3 shards usan tile 0xB4 FIJO (no 0xB4/0xB5/0xB6), en las coords reales, floor 0xFF, loc 0", () => {
    const objs = seedUnderworldPlotObjects(input());
    const shards = objs.filter((o) => o.plotItem?.startsWith("shard-"));
    expect(shards.map((o) => o.tile)).toEqual([SHARD_TILE, SHARD_TILE, SHARD_TILE]);
    expect(shards.map((o) => o.tile)).toEqual([0xb4, 0xb4, 0xb4]);
    expect(shards.map((o) => ({ x: o.x, y: o.y }))).toEqual([
      { x: 192, y: 80 },
      { x: 130, y: 65 },
      { x: 176, y: 184 },
    ]);
    for (const s of shards) {
      expect(s.location).toBe(0);
      expect(s.floor).toBe(UNDERWORLD_PLOT_FLOOR);
      expect(s.floor).toBe(0xff);
      expect(s.kind).toBe("plot");
    }
  });

  it("el byte z (0xF0/0xF1/0xF2) se PRESERVA por shard aunque no se use aún", () => {
    const objs = seedUnderworldPlotObjects(input());
    const shards = objs.filter((o) => o.plotItem?.startsWith("shard-"));
    expect(shards.map((o) => o.plotZ)).toEqual([0xf0, 0xf1, 0xf2]);
  });

  it("mapea índice→item: 0=Falsehood, 1=Hatred, 2=Cowardice", () => {
    const objs = seedUnderworldPlotObjects(input());
    const shards = objs.filter((o) => o.plotItem?.startsWith("shard-"));
    expect(shards.map((o) => o.plotItem)).toEqual([
      "shard-falsehood",
      "shard-hatred",
      "shard-cowardice",
    ]);
  });

  it("el amuleto usa tile 0xB7 en (105,225), z=0xF3, floor 0xFF", () => {
    const objs = seedUnderworldPlotObjects(input());
    const amulet = objs.find((o) => o.plotItem === "amulet")!;
    expect(amulet.tile).toBe(AMULET_TILE);
    expect(amulet.tile).toBe(0xb7);
    expect({ x: amulet.x, y: amulet.y }).toEqual({ x: 105, y: 225 });
    expect(amulet.plotZ).toBe(0xf3);
    expect(amulet.floor).toBe(0xff);
    expect(AMULET_SPAWN).toEqual({ x: 105, y: 225, z: 0xf3 });
  });

  it("NO siembra un shard ya tomado", () => {
    const objs = seedUnderworldPlotObjects(input({ shardTaken: [true, false, false] }));
    expect(objs.map((o) => o.plotItem)).not.toContain("shard-falsehood");
    expect(objs.map((o) => o.plotItem)).toContain("shard-hatred");
    expect(objs.map((o) => o.plotItem)).toContain("shard-cowardice");
    expect(objs.map((o) => o.plotItem)).toContain("amulet");
  });

  it("NO siembra un shard cuyo Shadowlord está muerto (>=0x80 en el binario)", () => {
    const objs = seedUnderworldPlotObjects(input({ shadowlordAlive: [true, false, true] }));
    expect(objs.map((o) => o.plotItem)).toContain("shard-falsehood");
    expect(objs.map((o) => o.plotItem)).not.toContain("shard-hatred");
    expect(objs.map((o) => o.plotItem)).toContain("shard-cowardice");
  });

  it("NO siembra el amuleto ya tomado; el gate del amuleto NO depende de ningún Shadowlord", () => {
    const objs = seedUnderworldPlotObjects(input({ amuletTaken: true }));
    expect(objs.map((o) => o.plotItem)).not.toContain("amulet");
    // Los shards siguen: el amuleto no comparte gate con ellos.
    expect(objs.filter((o) => o.plotItem?.startsWith("shard-"))).toHaveLength(3);
  });

  it("todo tomado / SL muertos → no siembra nada", () => {
    const objs = seedUnderworldPlotObjects(
      input({ shardTaken: [true, true, true], amuletTaken: true }),
    );
    expect(objs).toHaveLength(0);
  });
});
