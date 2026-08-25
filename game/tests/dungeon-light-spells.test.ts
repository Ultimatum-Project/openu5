/**
 * Pack de hechizos de MAZMORRA (task #47): luz de In Lor/Vas Lor en la vista 3D
 * (profundidad 4) y Uus Por / Des Por (cambio de planta mágico).
 *
 * Derivación: `re/notes/dungeon.md §3/§4`, `re/notes/magic.md §5/§7` y el
 * desensamblado `re/disasm/{DUNGEON,CAST}.OVL.asm` (gate de luz 0x1AD6, raycast
 * 0x1B0C, change_level 0x1C6A, dng_landing_ok 0x1C0C, handlers CAST 0x0FD2/0x0FFC).
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
  visibleDepth,
  isDark,
  type DungeonCell,
  type DungeonData,
  type DungeonPos,
} from "../src/core/dungeon/index.js";

function load<T>(rel: string): T {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, "")) as T;
}

function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}

/** Mazmorra sintética 8×8×8 de pasadizo vacío (nibble alto 0), para controlar
 *  el aterrizaje celda a celda sin depender del layout real. */
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

describe("luz en la vista 3D (visibleDepth / isDark)", () => {
  it("sin antorcha ni hechizo de luz → oscuridad total (profundidad 0)", () => {
    const s = freshState();
    s.torchTurns = 0;
    s.lightSpellMins = 0;
    expect(visibleDepth(s)).toBe(0);
    expect(isDark(s)).toBe(true);
  });

  it("con antorcha encendida → profundidad 4", () => {
    const s = freshState();
    s.torchTurns = 5;
    s.lightSpellMins = 0;
    expect(visibleDepth(s)).toBe(4);
    expect(isDark(s)).toBe(false);
  });

  it("con hechizo In Lor activo (sin antorcha) → profundidad 4", () => {
    const s = freshState();
    s.torchTurns = 0;
    s.lightSpellMins = 100; // In Lor (CAST2:0x08ea escribe 100 minutos)
    expect(visibleDepth(s)).toBe(4);
    expect(isDark(s)).toBe(false);
  });

  it("antorcha y hechizo dan la MISMA profundidad (el gate no los distingue)", () => {
    const s = freshState();
    s.torchTurns = 5;
    s.lightSpellMins = 255; // Vas Lor
    expect(visibleDepth(s)).toBe(4);
  });

  it("lightSpellMins ausente (undefined) se trata como 0", () => {
    const s = freshState();
    s.torchTurns = 0;
    delete (s as { lightSpellMins?: number }).lightSpellMins;
    expect(visibleDepth(s)).toBe(0);
    expect(isDark(s)).toBe(true);
  });
});

describe("Uus Por / Des Por — magicChangeLevel", () => {
  it("Des Por baja una planta sobre pasadizo vacío: 'Down!' + floor-changed", () => {
    const dg = new DungeonState([emptyDungeon(33)], pos({ floor: 3 }));
    const ev = dg.magicChangeLevel(freshState(), 1);
    expect(ev[0]).toEqual({ kind: "message", text: "Down!" });
    expect(ev.some((e) => e.kind === "floor-changed")).toBe(true);
    expect(dg.pos.floor).toBe(4);
  });

  it("Uus Por sube una planta sobre pasadizo vacío: 'Up!' + floor-changed", () => {
    const dg = new DungeonState([emptyDungeon(33)], pos({ floor: 3 }));
    const ev = dg.magicChangeLevel(freshState(), -1);
    expect(ev[0]).toEqual({ kind: "message", text: "Up!" });
    expect(dg.pos.floor).toBe(2);
  });

  it("conserva la posición (x,y) al cambiar de planta", () => {
    const dg = new DungeonState([emptyDungeon(33)], pos({ floor: 3, x: 5, y: 2 }));
    dg.magicChangeLevel(freshState(), 1);
    expect(dg.pos.x).toBe(5);
    expect(dg.pos.y).toBe(2);
    expect(dg.pos.floor).toBe(4);
  });

  it("celda destino ocupada (muro) → 'Down!' + 'Failed!' y NO cambia de planta", () => {
    const d = emptyDungeon(33);
    // (x=4,y=4) en la planta 4 (destino de bajar desde 3) = muro → landing bloqueado.
    d.floors[4]![4]![4] = { type: CellType.Wall, sub: 0 };
    const dg = new DungeonState([d], pos({ floor: 3, x: 4, y: 4 }));
    const ev = dg.magicChangeLevel(freshState(), 1);
    // Re-baseline audio-costuras: el «Failed!» además SUENA (glide 800→2000 @0x1cfb,
    // evento `sfx` sin texto) — se comparan sólo los mensajes.
    expect(ev.filter((e) => e.kind === "message").map((e) => e.text)).toEqual(["Down!", "Failed!"]);
    expect(ev.some((e) => e.kind === "sfx" && e.sfx === "dungeon-fail")).toBe(true);
    expect(dg.pos.floor).toBe(3); // sin cambio
  });

  it("cualquier nibble-alto ≠ 0 bloquea el aterrizaje (no sólo muros): una escalera falla", () => {
    const d = emptyDungeon(33);
    d.floors[2]![4]![4] = { type: CellType.LadderUp, sub: 0 }; // hi 0x1 ≠ 0
    const dg = new DungeonState([d], pos({ floor: 3, x: 4, y: 4 }));
    const ev = dg.magicChangeLevel(freshState(), -1);
    expect(ev.filter((e) => e.kind === "message").map((e) => e.text)).toEqual(["Up!", "Failed!"]);
    expect(dg.pos.floor).toBe(3);
  });

  it("Uus Por en la planta superior (0) → 'Up!' + salida a Britannia", () => {
    const dg = new DungeonState([emptyDungeon(33)], pos({ floor: 0 }));
    const ev = dg.magicChangeLevel(freshState(), -1);
    expect(ev[0]).toEqual({ kind: "message", text: "Up!" });
    expect(ev.some((e) => e.kind === "exit-overworld")).toBe(true);
    expect(dg.pos.floor).toBe(0); // no baja; el motor lo saca de la mazmorra
  });

  it("Des Por en la planta más profunda (7) → 'Down!' + salida al Underworld", () => {
    const dg = new DungeonState([emptyDungeon(33)], pos({ floor: 7 }));
    const ev = dg.magicChangeLevel(freshState(), 1);
    expect(ev[0]).toEqual({ kind: "message", text: "Down!" });
    expect(ev.some((e) => e.kind === "exit-underworld")).toBe(true);
    expect(dg.pos.floor).toBe(7);
  });

  it("Doom (location 40) → fallo SILENCIOSO: sin mensaje ni cambio de planta", () => {
    const dg = new DungeonState([emptyDungeon(40)], pos({ dungeon: 40, floor: 3 }));
    const ev = dg.magicChangeLevel(freshState(), 1);
    expect(ev).toEqual([]);
    expect(dg.pos.floor).toBe(3);
  });
});

// Integración GameEngine → magicChangeLevel + traducción de eventos (mismo camino que
// dungeonCommand): cobra el turno de mazmorra y emite los GameEvents al aplicador de UI.
function grassWorld(): WorldData {
  const o = Array.from({ length: 64 }, () => Array.from({ length: 64 }, () => 5));
  return { overworld: o, underworld: o, smallMaps: new Map() };
}
const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const combatResources: CombatResources = {
  combatMaps: [], enemyDefs: [], attackValues: [], attackRangeValues: [], defenseValues: [],
};
function makeDungeonGame(dpos: DungeonPos, dungeon: DungeonData): Game {
  const state = freshState();
  state.position = { location: dpos.dungeon, floor: dpos.floor, x: dpos.x, y: dpos.y };
  state.torchTurns = 50;
  const g = new Game({} as ExtractedInitialState, grassWorld(), gameData, state, { combatResources });
  g.dungeonState = new DungeonState([dungeon], dpos);
  return g;
}

describe("GameEngine — cast de mazmorra (wiring)", () => {
  it("dungeonMagicChangeLevel(+1) baja de planta y emite 'Down!'", () => {
    const g = makeDungeonGame(pos({ floor: 3 }), emptyDungeon(33));
    const ev = g.dungeonMagicChangeLevel(1);
    expect(ev.some((e) => e.kind === "message" && e.text === "Down!")).toBe(true);
    expect(g.dungeonState!.pos.floor).toBe(4);
  });

  it("dungeonMagicChangeLevel(-1) en planta 0 SALE de la mazmorra (dungeonState=null)", () => {
    const g = makeDungeonGame(pos({ floor: 0 }), emptyDungeon(33));
    const ev = g.dungeonMagicChangeLevel(-1);
    expect(ev.some((e) => e.kind === "message" && e.text === "Up!")).toBe(true);
    expect(g.dungeonState).toBeNull(); // exitDungeonTo desmonta la mazmorra
  });

  it("dungeonSpellTurn cobra el turno sin cambiar de planta (In Lor)", () => {
    const g = makeDungeonGame(pos({ floor: 3 }), emptyDungeon(33));
    g.state.lightSpellMins = 100; // como si castSpell(In Lor) ya lo hubiera fijado
    const floorBefore = g.dungeonState!.pos.floor;
    expect(() => g.dungeonSpellTurn()).not.toThrow();
    expect(g.dungeonState!.pos.floor).toBe(floorBefore);
    expect(g.dungeonLightDepth).toBe(4); // la luz del hechizo mantiene la vista a 4
  });
});
