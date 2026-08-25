import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DungeonTileType, parseDungeons } from "../src/parsers/dungeon.js";
import { U5_DIR } from "./helpers.js";

const read = (name: string) => new Uint8Array(readFileSync(`${U5_DIR}/${name}`));

describe("parseDungeons (DUNGEON.DAT — 8×8×8 nibbles)", () => {
  const dat = read("DUNGEON.DAT");

  it("DUNGEON.DAT mide 4096 bytes exactos", () => {
    expect(dat.length).toBe(4096);
  });

  it("produce 8 mazmorras (locations 33..40) × 8 plantas de 8×8", () => {
    const dungeons = parseDungeons(dat);
    expect(dungeons).toHaveLength(8);
    expect(dungeons.map((d) => d.location)).toEqual([
      33, 34, 35, 36, 37, 38, 39, 40,
    ]);
    expect(dungeons[0]!.name).toBe("Deceit");
    expect(dungeons[7]!.name).toBe("Doom");
    for (const d of dungeons) {
      expect(d.floors).toHaveLength(8);
      for (const floor of d.floors) {
        expect(floor).toHaveLength(8);
        for (const row of floor) expect(row).toHaveLength(8);
      }
    }
  });

  it("Deceit planta 0 contiene escaleras (valores reales observados)", () => {
    const deceit = parseDungeons(dat)[0]!;
    const floor0 = deceit.floors[0]!;
    // Observado: LadderUp (type 1) en (x=1,y=1); LadderDown (type 2) en (x=5,y=3).
    expect(floor0[1]![1]).toEqual({ type: DungeonTileType.LadderUp, sub: 0 });
    expect(floor0[3]![5]).toEqual({ type: DungeonTileType.LadderDown, sub: 0 });
    // Al menos una escalera (type 1,2,3) en la planta.
    const hasLadder = floor0.some((row) =>
      row.some((c) => c.type >= 1 && c.type <= 3),
    );
    expect(hasLadder).toBe(true);
  });

  it("todos los tiles usan types 0..15", () => {
    for (const d of parseDungeons(dat)) {
      for (const floor of d.floors) {
        for (const row of floor) {
          for (const cell of row) {
            expect(cell.type).toBeGreaterThanOrEqual(0);
            expect(cell.type).toBeLessThanOrEqual(15);
            expect(cell.sub).toBeGreaterThanOrEqual(0);
            expect(cell.sub).toBeLessThanOrEqual(15);
          }
        }
      }
    }
  });

  it("reinterpreta Nothing (type 0) con sub 8 como LadderUp", () => {
    // El caso especial nunca deja type 0 + sub 8 en la salida.
    const dungeons = parseDungeons(dat);
    let reinterpreted = 0;
    for (const d of dungeons) {
      for (const floor of d.floors) {
        for (const row of floor) {
          for (const cell of row) {
            expect(cell.type === 0 && cell.sub === 8).toBe(false);
            if (cell.type === DungeonTileType.LadderUp && cell.sub === 8) {
              reinterpreted++;
            }
          }
        }
      }
    }
    // Observado: 25 celdas type0/sub8 en el fichero → LadderUp con sub 8.
    expect(reinterpreted).toBe(25);
  });

  it("rechaza ficheros truncados", () => {
    expect(() => parseDungeons(new Uint8Array(100))).toThrow();
  });
});
