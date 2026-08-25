import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDataOvl } from "../src/parsers/dataovl.js";
import { U5_DIR } from "./helpers.js";

const bytes = new Uint8Array(readFileSync(`${U5_DIR}/DATA.OVL`));
const ovl = parseDataOvl(bytes);

// Muestras reales observadas del DATA.OVL original (MS-DOS):
//   spells[0]  = "In Lor"      (primer hechizo)
//   virtues[0] = "Honesty"     (primera virtud)
//   mantras[0] = "Ahm"         (mantra de Honesty)
//   reagents[0] = "Sulfur Ash"
//   wordsOfPower = FALLAX..VERAMOCOR
describe("parseDataOvl (DATA.OVL de Ultima V)", () => {
  it("wordsOfPower son las 8 palabras de poder esperadas", () => {
    expect(ovl.wordsOfPower).toEqual([
      "FALLAX",
      "VILIS",
      "INOPIA",
      "MALUM",
      "AVIDUS",
      "INFAMA",
      "IGNAVUS",
      "VERAMOCOR",
    ]);
  });

  it("reagents tiene 8 entradas y la primera es Sulfur Ash", () => {
    expect(ovl.reagents.length).toBe(8);
    expect(ovl.reagents[0]!.toLowerCase()).toContain("sulfur");
  });

  it("potions tiene 8 colores", () => {
    expect(ovl.potions.length).toBe(8);
    expect(ovl.potions).toContain("Blue");
  });

  it("spells: el fichero real contiene 48 entradas (el doc decía 47)", () => {
    // Discrepancia con el doc §3 (dice 47): el DATA.OVL real da 48.
    expect(ovl.spells.length).toBe(48);
    expect(ovl.spells[0]).toBe("In Lor");
  });

  it("virtues y mantras: 8 cada una, con Honesty→Ahm", () => {
    expect(ovl.virtues.length).toBe(8);
    expect(ovl.mantras.length).toBe(8);
    expect(ovl.virtues[0]).toBe("Honesty");
    expect(ovl.mantras[0]).toBe("Ahm");
  });

  it("locationsX/Y tienen 40 coordenadas", () => {
    expect(ovl.locationsX.length).toBe(40);
    expect(ovl.locationsY.length).toBe(40);
  });

  it("moonPhases tiene 56 bytes (28 días × 2)", () => {
    expect(ovl.moonPhases.length).toBe(56);
  });

  it("britOverlayChunks tiene 256 bytes e incluye 0xFF (agua)", () => {
    expect(ovl.britOverlayChunks.length).toBe(256);
    expect(ovl.britOverlayChunks).toContain(0xff);
  });

  it("enemyStats son 48 filas de 8 valores", () => {
    expect(ovl.enemyStats.length).toBe(48);
    for (const row of ovl.enemyStats) expect(row.length).toBe(8);
  });

  it("enemyFlags son 48 filas de 2 valores", () => {
    expect(ovl.enemyFlags.length).toBe(48);
    for (const row of ovl.enemyFlags) expect(row.length).toBe(2);
  });

  it("equipmentBasePrices tiene 48 precios (uint16)", () => {
    expect(ovl.equipmentBasePrices.length).toBe(48);
  });

  it("equipIndexes aplica valueModifier +0x10", () => {
    expect(ovl.equipIndexes.length).toBe(48);
    // primer índice crudo = 0x42 → +0x10 = 0x52
    expect(ovl.equipIndexes[0]).toBe(0x52);
  });

  it("searchObjects son 114 (0x72) entradas con las 6 tablas paralelas", () => {
    expect(ovl.searchObjects.length).toBe(0x72);
    const first = ovl.searchObjects[0]!;
    expect(typeof first.id).toBe("number");
    expect(typeof first.quality).toBe("number");
    expect(typeof first.x).toBe("number");
    expect(typeof first.y).toBe("number");
  });

  it("initialFloorIndexes tiene 8 bytes por fichero de mapa", () => {
    expect(ovl.initialFloorIndexes.towne.length).toBe(8);
    expect(ovl.initialFloorIndexes.dwelling.length).toBe(8);
    expect(ovl.initialFloorIndexes.castle.length).toBe(8);
    expect(ovl.initialFloorIndexes.keep.length).toBe(8);
  });

  it("weaponsSoldByMerchants son 9 ciudades × 8 armas", () => {
    expect(ovl.weaponsSoldByMerchants.length).toBe(9);
    for (const row of ovl.weaponsSoldByMerchants) expect(row.length).toBe(8);
  });

  it("resurrectPrices son 8 valores uint16", () => {
    expect(ovl.resurrectPrices.length).toBe(8);
  });

  it("docks e inn beds con las longitudes esperadas", () => {
    expect(ovl.docksX.length).toBe(4);
    expect(ovl.docksY.length).toBe(4);
    expect(ovl.innBedsX.length).toBe(6);
    expect(ovl.innBedsY.length).toBe(6);
  });

  // Tabla de siembra de los 3 shards en el Underworld. La lee el sembrador de
  // OUTSUBS.OVL:0x0566 con 3 columnas paralelas indexadas por si=0..2:
  //   X = [si+0x3A06], Y = [si+0x3A0A], Z = [si+0x3A0E]  (DS; fileoff = DS+0x10).
  // Cada columna tiene stride 4 (un 4º byte índice-3 sin usar). El orden 0/1/2
  // = Falsehood/Hatred/Cowardice (g_shards DS 0x57B6 + strings DS 0x8D18/24/2E).
  // El amuleto NO está aquí: sus coords (105,225) están cableadas en OUTSUBS
  // 0x0589-0x0598 — es dato de código, no de DATA.OVL.
  describe("shardSpawns (sembrador Underworld OUTSUBS 0x0566)", () => {
    it("son 3 entradas con las coords exactas de DATA.OVL", () => {
      expect(ovl.shardSpawns).toEqual([
        { x: 192, y: 80, z: 0xf0 }, // Falsehood
        { x: 130, y: 65, z: 0xf1 }, // Hatred
        { x: 176, y: 184, z: 0xf2 }, // Cowardice
      ]);
    });

    it("el campo z refleja al amuleto (0xF3): 0xF0/0xF1/0xF2, NO es floor", () => {
      // El Underworld es planta 0; z=0xF0.. es metadato de slot (semántica
      // pendiente de oráculo), coherente con el amuleto cableado z=0xF3.
      expect(ovl.shardSpawns.map((s) => s.z)).toEqual([0xf0, 0xf1, 0xf2]);
    });
  });

  // Las 4 tablas fijas de spawn de errantes (weighted_pick 0x0E04 / tile_to_monster
  // 0x0E4E). Volcado byte-a-byte de DATA.OVL (DS 0x2BC0..0x2BF6, fileoff = DS+0x10).
  describe("spawnTables (weighted_pick 0x0E04)", () => {
    const t = ovl.spawnTables;
    it("cada tabla de pesos suma EXACTAMENTE 256 (= rand(0,255))", () => {
      for (const tab of [t.waterSurface, t.waterUnderworld, t.landSurface, t.landUnderworld]) {
        expect(tab.weights.reduce((a, b) => a + b, 0)).toBe(256);
        expect(tab.ids.length).toBe(tab.weights.length);
      }
    });

    it("waterSurface (DS ids 0x2BD4, pesos 0x2BF0): 5 entradas de agua", () => {
      expect(t.waterSurface.ids).toEqual([0x8c, 0x84, 0x88, 0x80, 0x2c]);
      expect(t.waterSurface.weights).toEqual([72, 72, 40, 38, 34]);
    });

    it("waterUnderworld (DS ids 0x2BDA, pesos 0x2BF6): Squid/Sea Serpent 128/128", () => {
      expect(t.waterUnderworld.ids).toEqual([0x84, 0x88]);
      expect(t.waterUnderworld.weights).toEqual([128, 128]);
    });

    it("landSurface (DS ids 0x2BC0, pesos 0x2BDC): 12 entradas de tierra", () => {
      expect(t.landSurface.ids).toEqual([
        0xc0, 0xc8, 0x90, 0x98, 0xbc, 0xc4, 0xd0, 0xe4, 0xcc, 0xd4, 0xdc, 0xd8,
      ]);
      expect(t.landSurface.weights).toEqual([60, 50, 40, 30, 20, 15, 15, 10, 10, 3, 2, 1]);
    });

    it("landUnderworld (DS ids 0x2BCC, pesos 0x2BE8): 7 entradas", () => {
      expect(t.landUnderworld.ids).toEqual([0x94, 0x90, 0x98, 0xf0, 0xf4, 0xd8, 0xdc]);
      expect(t.landUnderworld.weights).toEqual([64, 56, 56, 32, 32, 8, 8]);
    });

    it("todos los ids son (tile de sprite − 0x100), múltiplos de 4", () => {
      const all = [
        ...t.waterSurface.ids, ...t.waterUnderworld.ids,
        ...t.landSurface.ids, ...t.landUnderworld.ids,
      ];
      for (const id of all) expect(id % 4).toBe(0);
    });
  });
});
