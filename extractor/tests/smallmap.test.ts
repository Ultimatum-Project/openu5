import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSmallMaps } from "../src/parsers/smallmap.js";
import { U5_DIR } from "./helpers.js";

const read = (name: string) => new Uint8Array(readFileSync(`${U5_DIR}/${name}`));

const files = () => ({
  castle: read("CASTLE.DAT"),
  towne: read("TOWNE.DAT"),
  dwelling: read("DWELLING.DAT"),
  keep: read("KEEP.DAT"),
});

describe("parseSmallMaps (mapas de pueblo 32×32)", () => {
  it("los 4 .DAT miden 16384 bytes (16 plantas × 1024)", () => {
    const f = files();
    expect(f.castle.length).toBe(16384);
    expect(f.towne.length).toBe(16384);
    expect(f.dwelling.length).toBe(16384);
    expect(f.keep.length).toBe(16384);
  });

  it("devuelve las 32 locations, cada planta 32×32", () => {
    const maps = parseSmallMaps(files());
    expect(maps.length).toBe(32);

    for (const loc of maps) {
      for (const floor of loc.floors) {
        expect(floor.tiles.length).toBe(32);
        expect(floor.tiles.every((row) => row.length === 32)).toBe(true);
      }
    }
  });

  it("Lord British Castle tiene 5 plantas (z −1..3); Iolo's Hut tiene 1 (z 0)", () => {
    const maps = parseSmallMaps(files());

    const lbc = maps.find((m) => m.name === "Lord_Britishs_Castle")!;
    expect(lbc.floors.map((f) => f.z)).toEqual([-1, 0, 1, 2, 3]);

    const iolo = maps.find((m) => m.name === "Iolos_Hut")!;
    expect(iolo.floors.map((f) => f.z)).toEqual([0]);
  });

  it("Britain (id 2) planta 0: tile de entrada [30][15] = 68 (valor real observado)", () => {
    const maps = parseSmallMaps(files());
    const britain = maps.find((m) => m.id === 2)!;
    expect(britain.name).toBe("Britain");

    const floor0 = britain.floors.find((f) => f.z === 0)!;
    // Posición inicial del jugador al entrar: (x=15, y=30). El tile observado
    // en los datos reales es 0x44 (68), transitable-plausible para una entrada.
    expect(floor0.tiles[30]![15]).toBe(68);
  });
});
