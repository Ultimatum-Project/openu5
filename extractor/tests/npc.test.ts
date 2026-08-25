import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseNpcFile, parseAllNpcs } from "../src/parsers/npc.js";
import { U5_DIR } from "./helpers.js";

const read = (name: string) => new Uint8Array(readFileSync(`${U5_DIR}/${name}`));

const NPC_TYPE_NONE = 0xff;

describe("parseNpcFile (.NPC: 8 pueblos × 32 slots)", () => {
  for (const name of ["CASTLE.NPC", "TOWNE.NPC", "DWELLING.NPC", "KEEP.NPC"]) {
    it(`${name} mide 4608 bytes (8 × 576)`, () => {
      expect(read(name).length).toBe(4608);
    });

    it(`${name} produce 8 pueblos × 32 slots`, () => {
      const towns = parseNpcFile(read(name));
      expect(towns.length).toBe(8);
      for (const town of towns) expect(town.length).toBe(32);
    });

    it(`${name}: los times de slots con schedule están en 0-23`, () => {
      const towns = parseNpcFile(read(name));
      for (const town of towns) {
        for (const slot of town) {
          if (slot.type === NPC_TYPE_NONE) continue;
          for (const t of slot.times) {
            expect(t).toBeGreaterThanOrEqual(0);
            expect(t).toBeLessThanOrEqual(23);
          }
        }
      }
    });
  }

  it("Britain (TOWNE índice 1) tiene >5 NPCs con dialogNumber>0", () => {
    const towns = parseNpcFile(read("TOWNE.NPC"));
    const britain = towns[1]!;
    const withDialog = britain.filter((n) => n.dialogNumber > 0);
    expect(withDialog.length).toBeGreaterThan(5);
  });
});

describe("parseAllNpcs (mapeo a location id)", () => {
  const map = parseAllNpcs({
    castle: read("CASTLE.NPC"),
    towne: read("TOWNE.NPC"),
    dwelling: read("DWELLING.NPC"),
    keep: read("KEEP.NPC"),
  });

  it("cubre las 32 locations entrables (1-32)", () => {
    for (let loc = 1; loc <= 32; loc++) {
      expect(map[loc]).toBeDefined();
      expect(map[loc]!.length).toBe(32);
    }
  });

  it("Britain = location 2 (primer pueblo de TOWNE, índice 1)", () => {
    const townes = parseNpcFile(read("TOWNE.NPC"));
    expect(map[2]).toEqual(townes[1]);
  });

  it("Lord British's Castle = location 17 (primer pueblo de CASTLE)", () => {
    const castles = parseNpcFile(read("CASTLE.NPC"));
    expect(map[17]).toEqual(castles[0]);
  });
});
