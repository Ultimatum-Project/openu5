import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCombatMaps } from "../src/parsers/combatmap.js";
import { U5_DIR } from "./helpers.js";

const read = (name: string) => new Uint8Array(readFileSync(`${U5_DIR}/${name}`));

describe("parseCombatMaps (BRIT.CBT + DUNGEON.CBT — 11×11)", () => {
  const brit = read("BRIT.CBT");
  const dungeon = read("DUNGEON.CBT");

  it("los ficheros miden 5632 y 39424 bytes", () => {
    expect(brit.length).toBe(5632);
    expect(dungeon.length).toBe(39424);
  });

  it("produce 128 mapas (16 britannia + 112 dungeon)", () => {
    const maps = parseCombatMaps(brit, dungeon);
    expect(maps).toHaveLength(128);
    expect(maps.filter((m) => m.territory === "britannia")).toHaveLength(16);
    expect(maps.filter((m) => m.territory === "dungeon")).toHaveLength(112);
  });

  it("los mapas de britannia llevan nombre; los de dungeon null", () => {
    const maps = parseCombatMaps(brit, dungeon);
    expect(maps[0]!.name).toBe("CampFire");
    expect(maps[15]!.name).toBe("Bay");
    expect(maps[16]!.name).toBeNull();
    expect(maps[16]!.territory).toBe("dungeon");
  });

  it("cada mapa es una rejilla 11×11 con tiles en rango byte", () => {
    for (const m of parseCombatMaps(brit, dungeon)) {
      expect(m.tiles).toHaveLength(11);
      for (const row of m.tiles) {
        expect(row).toHaveLength(11);
        for (const t of row) {
          expect(t).toBeGreaterThanOrEqual(0);
          expect(t).toBeLessThanOrEqual(255);
        }
      }
    }
  });

  it("CampFire (índice 0) tiene ≥1 dirección de entrada válida (start con x>0)", () => {
    const campfire = parseCombatMaps(brit, dungeon)[0]!;
    const dirs = ["east", "west", "south", "north"] as const;
    for (const d of dirs) expect(campfire.playerStarts[d]).toHaveLength(6);
    // Observado: west arranca en (1,2) y south en (6,6); east/north empiezan en x=0.
    const validDirs = dirs.filter(
      (d) => (campfire.playerStarts[d][0]?.x ?? 0) > 0,
    );
    expect(validDirs.length).toBeGreaterThanOrEqual(1);
    expect(campfire.playerStarts.west[0]).toEqual({ x: 1, y: 2 });
  });

  it("CampFire tiene LAS 16 unidades (sprite crudo 0xA0) — re-baselineado 2026-07-25", () => {
    const campfire = parseCombatMaps(brit, dungeon)[0]!;
    // ⚠ RE-BASELINE: este test pinneaba el DEFECTO. Decía «16 map-units, una en (0,0)
    // filtrada → 15 restantes» y trataba ese filtro como comportamiento observado. El
    // original NO filtra por posición: `DNGLOOK.OVL 0x117E @0x12ab` descarta la ranura
    // sólo si el SPRITE es 0, y `ULTIMA.EXE 0x60EC` copia las 16 con `rep movsw` sin una
    // sola comparación. La ranura en (0,0) es una unidad REAL y ahora se emite.
    // Derivación: re/notes/cbt-unidades-0-0-y-cruce-movil.md
    expect(campfire.units).toHaveLength(16);
    for (const u of campfire.units) expect(u.sprite).toBe(0xa0);
    expect(campfire.units.filter((u) => u.x === 0 && u.y === 0)).toHaveLength(1);
    // Sin triggers (todos los sprites de la fila 0 son 0).
    expect(campfire.triggers).toHaveLength(0);
  });

  it("rechaza ficheros truncados", () => {
    expect(() => parseCombatMaps(new Uint8Array(10), dungeon)).toThrow();
    expect(() => parseCombatMaps(brit, new Uint8Array(10))).toThrow();
  });
});

/**
 * CRITERIO DE RANURA VACÍA = `sprite === 0`, no `(x,y) === (0,0)`.
 *
 * Guarda del sapo de datos cerrado el 2026-07-25 (`re/notes/cbt-unidades-0-0-y-cruce-movil.md`).
 * El parser filtraba por POSICIÓN y descartaba unidades que el original SÍ coloca:
 *
 *   · SALAS  — `DNGLOOK.OVL 0x117E` @0x12ab: `or al,al / jmp` sobre el SPRITE (fila 5);
 *              X e Y se leen DESPUÉS del filtro (0x1305 / 0x130f) y no se comparan nunca.
 *   · BRIT   — `ULTIMA.EXE 0x60EC`: `rep movsw` de las 16 ranuras, cero comparaciones.
 *
 * Sin esta guarda, un refactor puede volver a «limpiar» las ranuras en (0,0) y perder
 * 6 unidades + 17 ranuras de posición, moviendo dificultad Y consumo de RNG.
 */
describe("ranura vacía = sprite 0 (DNGLOOK 0x12ab), NUNCA la posición (0,0)", () => {
  const brit = read("BRIT.CBT");
  const dungeon = read("DUNGEON.CBT");
  const maps = parseCombatMaps(brit, dungeon);

  it("ninguna unidad emitida tiene sprite 0", () => {
    for (const m of maps) for (const u of m.units) expect(u.sprite).not.toBe(0);
  });

  it("★ las unidades en la celda (0,0) NO se descartan: se emiten 6 que antes se perdían", () => {
    const enCero = maps.flatMap((m, i) =>
      m.units.filter((u) => u.x === 0 && u.y === 0).map((u) => `#${i}:0x${u.sprite.toString(16)}`),
    );
    // #0 CampFire ×1 · #43 Destard r11 ×1 · #71 Covetous r7 ×3 · #126 Doom r14 ×1
    expect(enCero.sort()).toEqual(
      ["#0:0xa0", "#126:0xd4", "#43:0x9c", "#71:0x9c", "#71:0x9c", "#71:0x9c"].sort(),
    );
  });

  it("#43 recupera las CUATRO esquinas (la colocación simétrica que el filtro rompía)", () => {
    const esquinas = maps[43]!.units
      .filter((u) => u.sprite === 0x9c)
      .map((u) => `${u.x},${u.y}`)
      .sort();
    expect(esquinas).toEqual(["0,0", "0,10", "10,0", "10,10"]);
  });

  it("#9 Basement sigue vacío: sus 16 ranuras son sprite 0 de verdad", () => {
    expect(maps[9]!.units).toHaveLength(0);
  });

  it("las 3 salas sin unidades del .CBT crudo siguen a 0 (#19, #80, #112)", () => {
    for (const n of [19, 80, 112]) expect(maps[n]!.units, `mapa ${n}`).toHaveLength(0);
  });
});
