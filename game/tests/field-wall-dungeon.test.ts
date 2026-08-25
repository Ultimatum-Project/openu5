/**
 * In Flam / In Nox / In Zu / In Sanct Grav — CREACIÓN del muro de campo en MAZMORRA.
 * `CAST.OVL cast_field_wall` 0x004c, rama `g_location < 0x80`.
 *
 * 🔴 Esta es la ÚNICA rama no-combate que el binario tiene: `0054 cmp byte [g_location],0x80`
 * / `jb 0x5e` parte en **mazmorra vs combate**, sin rama de sobremundo. Y la máscara por
 * hechizo `DS:0x1C90` vale `0x03` (mazmorra+combate) para los cuatro índices 14/15/16/20 —
 * leída del volcado estático Y de la RAM viva del binario, más un cast real que no consume
 * ni hechizo ni maná en pueblo ni en exterior: `re/notes/field-grav-gate-testigo-20260808.md`.
 * Hasta ahora el clon sólo tenía la vía de SOBREMUNDO (sello de 5 celdas en `mapOverrides`),
 * que era además INALCANZABLE porque `castSpell` devuelve «Not here!» antes; y en mazmorra
 * el hechizo era un NO-OP. Resultado: el clon sabía MIRAR un campo, PISARLO y DISOLVERLO
 * (`dissolveFacingField`) y no podía crearlo.
 *
 * Las tres piezas del cuerpo, y lo que cada aserto defiende:
 *  1. `0071` la celda es la de ENFRENTE por la orientación, con `and ax,7` en LOS DOS ejes
 *     (`0086`, `0096`) ⇒ envuelve en el toro de 8×8.
 *  2. `00b8 test byte [bp-8],0xf7` ⇒ sólo escribe sobre suelo vacío (0x00 / 0x08); sobre
 *     cualquier otra cosa devuelve 0 y la cola 0x11a6 imprime "Failed!".
 *  3. `00c6 al = tile & 8` / `00ce or al,[bx+0x4596]` ⇒ CONSERVA el bit 3 (iluminado). Es la
 *     norma del overlay al reescribir terreno de mazmorra, la misma que ya calca
 *     `openDungeonChest` (`134a-1351`); la excepción es `an_ylem_dissolve_tile`.
 * En ÉXITO el binario devuelve 0xFFFF (`0103`) — ni 1 ni 0 ⇒ la cola NO imprime: sembrar es
 * SILENCIOSO. Cero RNG en toda la rama `0x004c-0x00ea`.
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
import { FIELD_WALL_TILE } from "../src/core/magic/tables.js";
import { SPELL_WEAPON_STATS, combatCastEffect } from "../src/core/combat/combat.js";
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

/** Mazmorra sintética 8×8×8 de pasadizo vacío. */
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
const FIRE = FIELD_WALL_TILE[0]!; // In Flam Grav = arg 0 → 0x82

describe("Dungeon.applyFieldWall — la celda de ENFRENTE, con wrap en los dos ejes", () => {
  it("mirando al norte siembra en (x, y-1) y NO en la celda del grupo", () => {
    const d = dng({ x: 4, y: 4, facing: "north" });
    expect(d.applyFieldWall(FIRE)).toEqual([]); // éxito = silencio
    expect(d.cellAt(3, 4, 3)).toEqual({ type: CellType.MagicField, sub: MagicFieldType.Fire });
    expect(d.cellAt(3, 4, 4)).toEqual({ type: CellType.Nothing, sub: 0 });
  });

  it("las cuatro orientaciones dan las cuatro celdas vecinas, ninguna otra", () => {
    const esperado: Record<string, [number, number]> = {
      north: [4, 3], south: [4, 5], east: [5, 4], west: [3, 4],
    };
    for (const [facing, [ex, ey]] of Object.entries(esperado)) {
      const d = dng({ x: 4, y: 4, facing: facing as DungeonPos["facing"] });
      d.applyFieldWall(FIRE);
      const sembradas: string[] = [];
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++)
          if (d.cellAt(3, x, y).type === CellType.MagicField) sembradas.push(`${x},${y}`);
      expect(sembradas).toEqual([`${ex},${ey}`]);
    }
  });

  it("ENVUELVE en el toro (`and ax,7` de 0086/0096): desde y=0 mirando al norte cae en y=7", () => {
    const d = dng({ x: 0, y: 0, facing: "north" });
    d.applyFieldWall(FIRE);
    expect(d.cellAt(3, 0, 7).type).toBe(CellType.MagicField);
  });

  it("siembra en la PLANTA actual, no en otra", () => {
    const d = dng({ floor: 5, x: 4, y: 4, facing: "east" });
    d.applyFieldWall(FIRE);
    expect(d.cellAt(5, 5, 4).type).toBe(CellType.MagicField);
    expect(d.cellAt(3, 5, 4).type).toBe(CellType.Nothing);
  });
});

describe("Dungeon.applyFieldWall — la guarda 0xf7 y el bit 3", () => {
  it("sobre suelo ILUMINADO (0x08) SÍ siembra, y CONSERVA el bit 3 (00c6 `& 8`)", () => {
    const d = dng({ x: 4, y: 4, facing: "north" });
    (d as unknown as { setCell(f: number, x: number, y: number, c: DungeonCell): void })
      .setCell(3, 4, 3, { type: CellType.Nothing, sub: LIT_BIT });
    expect(d.applyFieldWall(FIRE)).toEqual([]);
    expect(d.cellAt(3, 4, 3)).toEqual({
      type: CellType.MagicField,
      sub: MagicFieldType.Fire | LIT_BIT,
    });
  });

  it("sobre una celda NO vacía (muro) NO siembra y devuelve 'Failed!' (res=0 → cola 0x11a6)", () => {
    const d = dng({ x: 4, y: 4, facing: "north" });
    (d as unknown as { setCell(f: number, x: number, y: number, c: DungeonCell): void })
      .setCell(3, 4, 3, { type: CellType.Wall, sub: 0 });
    expect(d.applyFieldWall(FIRE)).toEqual([{ kind: "message", text: "Failed!" }]);
    expect(d.cellAt(3, 4, 3)).toEqual({ type: CellType.Wall, sub: 0 });
  });

  it("los bits 0-2 del subtipo TAMBIÉN cierran la guarda (0xf7 los incluye)", () => {
    const d = dng({ x: 4, y: 4, facing: "north" });
    (d as unknown as { setCell(f: number, x: number, y: number, c: DungeonCell): void })
      .setCell(3, 4, 3, { type: CellType.Nothing, sub: 0x1 });
    expect(d.applyFieldWall(FIRE)).toEqual([{ kind: "message", text: "Failed!" }]);
    expect(d.cellAt(3, 4, 3).type).toBe(CellType.Nothing);
  });

  it("sobre un campo YA sembrado no vuelve a sembrar (0x8_ no pasa la guarda)", () => {
    const d = dng({ x: 4, y: 4, facing: "north" });
    d.applyFieldWall(FIRE);
    expect(d.applyFieldWall(FIELD_WALL_TILE[3]!)).toEqual([{ kind: "message", text: "Failed!" }]);
    expect(d.cellAt(3, 4, 3).sub).toBe(MagicFieldType.Fire); // el primero, sin pisar
  });
});

describe("Los cuatro hechizos → los cuatro tipos de campo (DS:0x4596 ↔ MagicFieldType)", () => {
  const casos: [number, number, string][] = [
    [0, MagicFieldType.Fire, "In Flam Grav"],
    [1, MagicFieldType.Poison, "In Nox Grav"],
    [2, MagicFieldType.Sleep, "In Zu Grav"],
    [3, MagicFieldType.Energy, "In Sanct Grav"],
  ];
  for (const [arg, tipo, nombre] of casos) {
    it(`${nombre} (arg ${arg}) siembra el tipo ${tipo}`, () => {
      const d = dng({ x: 4, y: 4, facing: "north" });
      d.applyFieldWall(FIELD_WALL_TILE[arg]!);
      expect(d.cellAt(3, 4, 3)).toEqual({ type: CellType.MagicField, sub: tipo });
    });
  }

  it("el campo sembrado es el MISMO objeto que An Grav sabe disolver (crear ↔ disolver)", () => {
    const d = dng({ x: 4, y: 4, facing: "north" });
    d.applyFieldWall(FIRE);
    expect(d.dissolveFacingField()).toBe(true);
    expect(d.cellAt(3, 4, 3)).toEqual({ type: CellType.Nothing, sub: 0 });
  });
});

describe("Game.applyDungeonFieldWall — el puente que usa el (C)ast de mazmorra", () => {
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

  it("delega en la mazmorra viva: siembra la celda de enfrente y NO emite mensaje", () => {
    const g = gameEnMazmorra();
    expect(g.applyDungeonFieldWall(FIRE)).toEqual([]);
    expect(g.dungeonState!.cellAt(3, 4, 3)).toEqual({
      type: CellType.MagicField, sub: MagicFieldType.Fire,
    });
  });

  it("propaga el 'Failed!' cuando la celda no está vacía", () => {
    const g = gameEnMazmorra();
    (g.dungeonState as unknown as { setCell(f: number, x: number, y: number, c: DungeonCell): void })
      .setCell(3, 4, 3, { type: CellType.Wall, sub: 0 });
    expect(g.applyDungeonFieldWall(FIRE)).toEqual([{ kind: "message", text: "Failed!" }]);
  });

  it("sin mazmorra activa no fabrica nada (ni mensaje ni escritura)", () => {
    const g = gameEnMazmorra();
    g.dungeonState = null;
    expect(g.applyDungeonFieldWall(FIRE)).toEqual([]);
  });
});

describe("El descriptor del hechizo llega con el tile de DS:0x4596", () => {
  it("castSpell en MAZMORRA devuelve fieldWall con fieldTile 0x82 para In Flam Grav", () => {
    const g: GameState = createNewGame(init);
    g.spellQuantities[14] = 3;
    const caster = g.characters[3]!;
    caster.level = 8;
    caster.currentMp = 30;
    const def = defs.find((d) => d.key === "In_Flam_Grav")!;
    const r = castSpell(g, caster, def, { location: 0x21, inCombat: false },
      new CombatRng(new OriginalRng(0x1234)));
    expect(r.ok).toBe(true);
    expect(r.effect).toEqual({ kind: "fieldWall", arg: 0, fieldTile: 0x82, combatWeapon: 0x35 });
  });

  it("y en SOBREMUNDO / PUEBLO no llega descriptor ninguno: «Not here!» (máscara 0x03)", () => {
    for (const location of [0, 0x0a]) {
      const g: GameState = createNewGame(init);
      g.spellQuantities[14] = 3;
      const caster = g.characters[3]!;
      caster.level = 8;
      caster.currentMp = 30;
      const def = defs.find((d) => d.key === "In_Flam_Grav")!;
      const r = castSpell(g, caster, def, { location, inCombat: false },
        new CombatRng(new OriginalRng(0x1234)));
      expect(r.ok).toBe(false);
      expect(r.message).toBe("Not here!");
      expect(r.effect).toBeNull();
    }
  });
});

/**
 * #91 P3 — la rama de COMBATE: los cuatro In*Grav son un ATAQUE con arma-hechizo.
 *
 * `cast_field_wall` rama `g_location >= 0x80` (CAST.OVL 0x00ec-0x0100) hace
 * `g_cmb_weapon = [bx+0x4592]` · `push g_cmb_actor` · `push g_cmb_weapon` ·
 * `call 0xffffc14a` — MISMO destino y MISMOS dos argumentos que
 * `cmb_set_weapon_then_attack` (0x0032-0x0044), el que ya produce `combatAttack`.
 *
 * 🔴 Y NO SIEMBRA CAMPO. Cadena leída entera: `attack_dispatch_by_reach` (COMSUBS 0x0c52)
 * → `player_ranged_attack` (0x0a68) o `melee_strike_resolve` (0x0bf8) → `hit_roll`
 * (COMBAT 0x14d6). La tabla de tiles `DS:0x4596` se referencia UNA sola vez en todo el
 * corpus: la rama de MAZMORRA. ⇒ los `attackValues` 18/0/21/0 se TRANSCRIBEN: In Zu Grav
 * e In Sanct Grav valen CERO en combate. Defecto del ORIGINAL.
 */
describe("#91 P3 — las armas-hechizo de campo en combate (DS:0x4592)", () => {
  it("los cuatro descriptores traen el arma de combate que toca", () => {
    const esperado: [string, number][] = [
      ["In_Flam_Grav", 0x35], ["In_Nox_Grav", 0x33],
      ["In_Zu_Grav", 0x34], ["In_Sanct_Grav", 0x36],
    ];
    for (const [key, arma] of esperado) {
      const g: GameState = createNewGame(init);
      const def = defs.find((d) => d.key === key)!;
      g.spellQuantities[def.index] = 3;
      const caster = g.characters[3]!;
      caster.level = 8;
      caster.currentMp = 30;
      const r = castSpell(g, caster, def, { location: 0x81, inCombat: true },
        new CombatRng(new OriginalRng(0x1234)));
      expect(r.ok).toBe(true);
      expect((r.effect as { kind: string; combatWeapon: number }).combatWeapon).toBe(arma);
    }
  });

  it("las cuatro armas tienen ficha en el motor, y las de CERO daño se transcriben tal cual", () => {
    // Si faltara alguna, el ataque saldría sin `attack`/`range` y el hechizo sería un
    // no-op del CLON en vez del no-op del ORIGINAL — que es otra cosa.
    for (const [arma, dmg] of [[0x33, 18], [0x34, 0], [0x35, 21], [0x36, 0]] as const) {
      expect(SPELL_WEAPON_STATS[arma]).toEqual({ attack: dmg, range: 15 });
    }
  });
});

describe("combatCastEffect — el puente fieldWall → combatAttack", () => {
  it("traduce los cuatro In*Grav al arma de combate de DS:0x4592", () => {
    for (const [arg, arma] of [[0, 0x35], [1, 0x33], [2, 0x34], [3, 0x36]] as const) {
      const fx = { kind: "fieldWall", arg, fieldTile: FIELD_WALL_TILE[arg]!, combatWeapon: arma } as const;
      expect(combatCastEffect(fx)).toEqual({ kind: "combatAttack", weaponId: arma });
    }
  });

  it("usa el arma (0x4592), NO el tile de campo (0x4596) — son tablas distintas", () => {
    const fx = { kind: "fieldWall", arg: 0, fieldTile: 0x82, combatWeapon: 0x35 } as const;
    expect(combatCastEffect(fx)).toEqual({ kind: "combatAttack", weaponId: 0x35 });
    expect((combatCastEffect(fx) as { weaponId: number }).weaponId).not.toBe(0x82);
  });

  it("NO es un despachador: cualquier otro efecto pasa tal cual, y null sigue null", () => {
    const otro = { kind: "combatAttack", weaponId: 0x31 } as const;
    expect(combatCastEffect(otro)).toBe(otro);
    expect(combatCastEffect(null)).toBeNull();
    expect(combatCastEffect(undefined)).toBeNull();
  });
});
