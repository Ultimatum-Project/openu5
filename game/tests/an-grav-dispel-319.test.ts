/**
 * An Grav (idx 18) — DISIPA el campo mágico en MAZMORRA. `CAST2.OVL:0x07bc`, rama
 * `g_location < 0x80`. Ficha #319; acta `re/notes/hechizos-inertes-319.md` §4 y
 * cableado en `re/notes/hechizos-inertes-319-cableado.md`.
 *
 * Las piezas que cada aserto defiende (offsets del cuerpo re-careado):
 *  · 0x07f2-0x0820: PRIMERO la celda BAJO el grupo (cualquier campo: `and al,0xf0 /
 *    cmp al,0x80`, las cuatro clases y sus variantes iluminadas).
 *  · 0x0822-0x083d: si no, la DE ENFRENTE — deltas por facing de las tablas DS 0x24d6
 *    (dx) / 0x24de (dy), leídas en crudo de DATA.OVL: dx=(0,1,0,-1), dy=(-1,0,1,0) —
 *    con `and ax,7` en LOS DOS ejes (0x0827/0x0831): envuelve el toro 8×8.
 *  · 0x084b `and byte [bx],8`: conserva el bit ILUMINADO, borra todo lo demás.
 *  · Éxito: `Field destroyed!` (DS 0x954c, crudo `Field destroyed!\n\0`) y res=0xFFFF
 *    ⇒ la cola 0x11a6 NO añade "Success!". Fallo: res=0 ⇒ "Failed!" (DS 0x4660).
 *  · CERO rand_range en la rama entera.
 * La rama de COMBATE (0x0866, pool 0x5c5a de #103) queda SIN cablear — pendiente
 * declarado del acta §6; aquí sólo se afirma la rama de mazmorra.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import {
  DungeonState,
  CellType,
  LIT_BIT,
  MagicFieldType,
  type DungeonCell,
  type DungeonData,
  type DungeonPos,
} from "../src/core/dungeon/index.js";
import { buildSpellDefs, type MagicDefsJson, type SpellDef } from "../src/core/magic/spells.js";
import { castSpell } from "../src/core/magic/cast.js";
import { CombatRng } from "../src/core/combat/formulas.js";
import { OriginalRng } from "../src/core/rng-original.js";

function load<T>(rel: string): T {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, "")) as T;
}
const init = load<ExtractedInitialState>("../assets/initial-state.json");
const defs: SpellDef[] = buildSpellDefs(load<MagicDefsJson>("../src/core/data/MagicDefinitions.json"));

/** Mazmorra sintética 8×8×8 vacía (misma forma que field-wall-dungeon.test.ts). */
function emptyDungeon(location: number): DungeonData {
  const floors: DungeonCell[][][] = [];
  for (let f = 0; f < 8; f++) {
    const grid: DungeonCell[][] = [];
    for (let y = 0; y < 8; y++) {
      const row: DungeonCell[] = [];
      for (let x = 0; x < 8; x++) row.push({ type: CellType.Nothing, sub: 0 });
      grid.push(row);
    }
    floors.push(grid);
  }
  return { location, name: `synthetic-${location}`, floors };
}
function pos(over: Partial<DungeonPos> = {}): DungeonPos {
  return { dungeon: 33, floor: 3, x: 4, y: 4, facing: "north", ...over };
}
function dng(over: Partial<DungeonPos> = {}): DungeonState {
  return new DungeonState([emptyDungeon(33)], pos(over));
}
type SetCell = { setCell(f: number, x: number, y: number, c: DungeonCell): void };
const plant = (d: DungeonState, f: number, x: number, y: number, c: DungeonCell): void =>
  (d as unknown as SetCell).setCell(f, x, y, c);
const FIELD_DESTROYED = [{ kind: "message", text: "Field destroyed!" }];
const FAILED = [{ kind: "message", text: "Failed!" }];

describe("Dungeon.anGravDispel — bajo los pies PRIMERO, enfrente después", () => {
  it("con campo BAJO el grupo lo disipa AHÍ, aunque también haya uno enfrente", () => {
    const d = dng({ x: 4, y: 4, facing: "north" });
    plant(d, 3, 4, 4, { type: CellType.MagicField, sub: MagicFieldType.Poison });
    plant(d, 3, 4, 3, { type: CellType.MagicField, sub: MagicFieldType.Fire });
    expect(d.anGravDispel()).toEqual(FIELD_DESTROYED);
    expect(d.cellAt(3, 4, 4)).toEqual({ type: CellType.Nothing, sub: 0 }); // el pisado, fuera
    expect(d.cellAt(3, 4, 3).type).toBe(CellType.MagicField); // el de enfrente, INTACTO
  });

  it("sin campo bajo los pies cae al de ENFRENTE por el facing", () => {
    const esperado: Record<string, [number, number]> = {
      north: [4, 3], south: [4, 5], east: [5, 4], west: [3, 4],
    };
    for (const [facing, [ex, ey]] of Object.entries(esperado)) {
      const d = dng({ x: 4, y: 4, facing: facing as DungeonPos["facing"] });
      plant(d, 3, ex, ey, { type: CellType.MagicField, sub: MagicFieldType.Sleep });
      expect(d.anGravDispel()).toEqual(FIELD_DESTROYED);
      expect(d.cellAt(3, ex, ey)).toEqual({ type: CellType.Nothing, sub: 0 });
    }
  });

  it("ENVUELVE en el toro (`and ax,7` de 0827/0831): desde y=0 al norte disipa en y=7", () => {
    const d = dng({ x: 0, y: 0, facing: "north" });
    plant(d, 3, 0, 7, { type: CellType.MagicField, sub: MagicFieldType.Fire });
    expect(d.anGravDispel()).toEqual(FIELD_DESTROYED);
    expect(d.cellAt(3, 0, 7).type).toBe(CellType.Nothing);
  });

  it("opera en la PLANTA actual, no en otra", () => {
    const d = dng({ floor: 5, x: 4, y: 4, facing: "east" });
    plant(d, 5, 5, 4, { type: CellType.MagicField, sub: MagicFieldType.Fire });
    plant(d, 3, 5, 4, { type: CellType.MagicField, sub: MagicFieldType.Fire });
    expect(d.anGravDispel()).toEqual(FIELD_DESTROYED);
    expect(d.cellAt(5, 5, 4).type).toBe(CellType.Nothing);
    expect(d.cellAt(3, 5, 4).type).toBe(CellType.MagicField); // la otra planta, intacta
  });
});

describe("Dungeon.anGravDispel — la máscara `and [bx],8` y el test 0x80 del tile", () => {
  it("conserva el bit ILUMINADO: campo 0x8A (Fire|LIT) queda en suelo 0x08, no en 0x00", () => {
    const d = dng({ x: 4, y: 4, facing: "north" });
    plant(d, 3, 4, 3, { type: CellType.MagicField, sub: MagicFieldType.Fire | LIT_BIT });
    expect(d.anGravDispel()).toEqual(FIELD_DESTROYED);
    expect(d.cellAt(3, 4, 3)).toEqual({ type: CellType.Nothing, sub: LIT_BIT });
  });

  it("las CUATRO clases de campo pasan el test (`and 0xf0 == 0x80`), energía incluida", () => {
    for (const sub of [MagicFieldType.Sleep, MagicFieldType.Poison, MagicFieldType.Fire, MagicFieldType.Energy]) {
      const d = dng({ x: 4, y: 4, facing: "north" });
      plant(d, 3, 4, 3, { type: CellType.MagicField, sub });
      expect(d.anGravDispel()).toEqual(FIELD_DESTROYED);
      expect(d.cellAt(3, 4, 3).type).toBe(CellType.Nothing);
    }
  });

  it("NEGATIVO: sin campo ni debajo ni enfrente → 'Failed!' y NINGUNA celda tocada", () => {
    const d = dng({ x: 4, y: 4, facing: "north" });
    expect(d.anGravDispel()).toEqual(FAILED);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        expect(d.cellAt(3, x, y)).toEqual({ type: CellType.Nothing, sub: 0 });
  });

  it("NEGATIVO: un muro enfrente NO es un campo (0xB_ no pasa el `cmp al,0x80`)", () => {
    const d = dng({ x: 4, y: 4, facing: "north" });
    plant(d, 3, 4, 3, { type: CellType.Wall, sub: 0 });
    expect(d.anGravDispel()).toEqual(FAILED);
    expect(d.cellAt(3, 4, 3)).toEqual({ type: CellType.Wall, sub: 0 });
  });

  it("crear ↔ disolver: el campo de applyFieldWall es EXACTAMENTE lo que An Grav disipa", () => {
    const d = dng({ x: 4, y: 4, facing: "north" });
    expect(d.applyFieldWall(0x82)).toEqual([]); // In Flam Grav siembra enfrente
    expect(d.anGravDispel()).toEqual(FIELD_DESTROYED); // An Grav lo quita del mismo sitio
    expect(d.cellAt(3, 4, 3)).toEqual({ type: CellType.Nothing, sub: 0 });
  });
});

describe("Game.applyAnGravDispel — el puente del (C)ast de mazmorra", () => {
  function gameEnMazmorra(): Game {
    const g = new Game(
      {} as ExtractedInitialState,
      { overworld: [], underworld: [], smallMaps: new Map() } as unknown as WorldData,
      { locationsX: [], locationsY: [], locationNames: [] } as GameData,
      createNewGame(init),
      {
        combatResources: {
          combatMaps: [], enemyDefs: [], attackValues: [], attackRangeValues: [], defenseValues: [],
        } as CombatResources,
      },
    );
    g.dungeonState = dng({ x: 4, y: 4, facing: "north" });
    return g;
  }

  it("delega en la mazmorra viva y propaga el 'Field destroyed!'", () => {
    const g = gameEnMazmorra();
    plant(g.dungeonState!, 3, 4, 3, { type: CellType.MagicField, sub: MagicFieldType.Fire });
    expect(g.applyAnGravDispel()).toEqual(FIELD_DESTROYED);
    expect(g.dungeonState!.cellAt(3, 4, 3).type).toBe(CellType.Nothing);
  });

  it("sin mazmorra activa no fabrica nada", () => {
    const g = gameEnMazmorra();
    g.dungeonState = null;
    expect(g.applyAnGravDispel()).toEqual([]);
  });
});

describe("castSpell con An Grav — ventana 0x03 (mazmorra+combate) y cero RNG", () => {
  function cast(location: number, inCombat = false) {
    const g: GameState = createNewGame(init);
    g.spellQuantities[18] = 3;
    const caster = g.characters[3]!;
    caster.level = 8;
    caster.currentMp = 30;
    const def = defs.find((d) => d.index === 18)!;
    const rng = new CombatRng(new OriginalRng(0x1234));
    const antes = rng.rng.getSeed();
    const r = castSpell(g, caster, def, { location, inCombat }, rng);
    return { r, antes, despues: rng.rng.getSeed() };
  }

  it("en MAZMORRA (loc 0x21) devuelve el descriptor dispelField", () => {
    const { r } = cast(0x21);
    expect(r.ok).toBe(true);
    expect(r.effect).toEqual({ kind: "dispelField" });
  });

  it("NEGATIVO donde el binario calla: exterior y pueblo → «Not here!» (máscara 0x03)", () => {
    for (const location of [0, 0x0a]) {
      const { r } = cast(location);
      expect(r.ok).toBe(false);
      expect(r.message).toBe("Not here!");
      expect(r.effect).toBeNull();
    }
  });

  it("CERO tiradas en la rama de mazmorra: la semilla no se mueve", () => {
    const { antes, despues } = cast(0x21);
    expect(despues).toBe(antes);
  });
});
