/**
 * TILES DE POBLADO POR HORA (task #48, TOWN 0x0170 town_time_tile_transform).
 *
 * Derivación: re/disasm/TOWN.OVL.asm 0x0170-0x0211, cargador 0x0408 (rama de noche
 * 0x0508), tick horario 0x15c8 (call a 0x14=20 y 5). get_tile_ptr 0x4402 indexa
 * fila*32+col → el vecino conmutado por la fase 1 es el del SUR (fila+1).
 *
 * Validado contra assets/maps/smallmaps.json: los 28 arcos 0x87 tienen 0x44
 * BrickFloor justo al sur → xor 0xdd = 0x99 Portcullis. Los tablones de puente
 * (0x48/0x49) están en las entradas de castillos/keeps (Skara Brae, Blackthorn,
 * Bordermarch, ...). Sin RNG en la rutina (sólo get_tile_ptr) → no toca el stream.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import {
  TownHourTiles,
  isBridgePlank,
  isNightTileHour,
} from "../src/core/world/townHourTiles.js";
import { getActiveMap } from "../src/core/world/map.js";

const ARCH = 0x87;
const BRICKFLOOR = 0x44;
const PORTCULLIS = 0x99;
const PLANK_L = 0x48;
const PLANK_R = 0x49;
const WATER = 0x03;
const GRASS = 5;

const TOWN_ID = 6; // un id cualquiera de small map

// Coordenadas del mapa de prueba.
const ARCH_X = 10, ARCH_Y = 5; // arco; su reja (sur) en (10,6)
const GATE_Y = 6;
const PLANKS = [
  { x: 15, y: 20 },
  { x: 16, y: 20 },
];

/** Small map 32×32 de hierba con un arco (+ reja 0x44 al sur) y 2 tablones. */
function townWorld(): WorldData {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => GRASS));
  tiles[ARCH_Y]![ARCH_X] = ARCH;
  tiles[GATE_Y]![ARCH_X] = BRICKFLOOR; // vecino sur del arco (la reja)
  tiles[PLANKS[0]!.y]![PLANKS[0]!.x] = PLANK_L;
  tiles[PLANKS[1]!.y]![PLANKS[1]!.x] = PLANK_R;
  const loc: SmallMapLocation = { id: TOWN_ID, name: "Testburg", floors: [{ z: 0, tiles }] };
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => GRASS));
  return { overworld, underworld: overworld, smallMaps: new Map([[TOWN_ID, loc]]) };
}

describe("townHourTiles helpers", () => {
  it("isNightTileHour: reja/puente activos <5 ó >=20 (gate 0x04fa), día 5..19", () => {
    for (const h of [20, 21, 23, 0, 3, 4]) expect(isNightTileHour(h)).toBe(true);
    for (const h of [5, 6, 12, 18, 19]) expect(isNightTileHour(h)).toBe(false);
  });

  it("isBridgePlank: 0x48/0x49 (and 0xfe == 0x48), no otros", () => {
    expect(isBridgePlank(0x48)).toBe(true);
    expect(isBridgePlank(0x49)).toBe(true);
    expect(isBridgePlank(0x44)).toBe(false);
    expect(isBridgePlank(0x03)).toBe(false);
  });
});

describe("TownHourTiles.recompute (unidad pura)", () => {
  const base = () => getActiveMap(townWorld(), TOWN_ID, 0);

  it("DÍA (hora 12): capa vacía, todo devuelve el tile base", () => {
    const m = new TownHourTiles();
    m.recompute(base(), TOWN_ID, 0, 12, 0, 31);
    expect(m.effectiveTile(TOWN_ID, 0, ARCH_X, GATE_Y, BRICKFLOOR)).toBe(BRICKFLOOR);
    expect(m.effectiveTile(TOWN_ID, 0, PLANKS[0]!.x, PLANKS[0]!.y, PLANK_L)).toBe(PLANK_L);
  });

  it("NOCHE (hora 22): reja baja (0x44→0x99) y puente izado (0x48/0x49→0x03)", () => {
    const m = new TownHourTiles();
    m.recompute(base(), TOWN_ID, 0, 22, 0, 31); // party lejos de tablones
    expect(m.effectiveTile(TOWN_ID, 0, ARCH_X, GATE_Y, BRICKFLOOR)).toBe(PORTCULLIS);
    for (const p of PLANKS) {
      expect(m.effectiveTile(TOWN_ID, 0, p.x, p.y, PLANK_L)).toBe(WATER);
    }
    // El arco mismo NO cambia; sólo su vecino sur.
    expect(m.effectiveTile(TOWN_ID, 0, ARCH_X, ARCH_Y, ARCH)).toBe(ARCH);
  });

  it("madrugada (hora 4, banda nocturna): también aplica", () => {
    const m = new TownHourTiles();
    m.recompute(base(), TOWN_ID, 0, 4, 0, 31);
    expect(m.effectiveTile(TOWN_ID, 0, ARCH_X, GATE_Y, BRICKFLOOR)).toBe(PORTCULLIS);
    expect(m.effectiveTile(TOWN_ID, 0, PLANKS[0]!.x, PLANKS[0]!.y, PLANK_L)).toBe(WATER);
  });

  it("SALTO fase 2 (0x01bc): party sobre un tablón → NINGÚN puente se iza, PERO la reja SÍ baja", () => {
    const m = new TownHourTiles();
    m.recompute(base(), TOWN_ID, 0, 22, PLANKS[0]!.x, PLANKS[0]!.y);
    // Reja (fase 1) no se salta:
    expect(m.effectiveTile(TOWN_ID, 0, ARCH_X, GATE_Y, BRICKFLOOR)).toBe(PORTCULLIS);
    // Puente entero sin izar (ni el que pisa ni el otro):
    for (const p of PLANKS) {
      expect(m.effectiveTile(TOWN_ID, 0, p.x, p.y, PLANK_L)).toBe(PLANK_L);
    }
  });

  it("effectiveTile inerte fuera de la (loc,planta) calculada", () => {
    const m = new TownHourTiles();
    m.recompute(base(), TOWN_ID, 0, 22, 0, 31);
    expect(m.effectiveTile(TOWN_ID, 1, ARCH_X, GATE_Y, BRICKFLOOR)).toBe(BRICKFLOOR); // otra planta
    expect(m.effectiveTile(99, 0, ARCH_X, GATE_Y, BRICKFLOOR)).toBe(BRICKFLOOR); // otra loc
  });

  it("reset() vacía la capa", () => {
    const m = new TownHourTiles();
    m.recompute(base(), TOWN_ID, 0, 22, 0, 31);
    m.reset();
    expect(m.effectiveTile(TOWN_ID, 0, ARCH_X, GATE_Y, BRICKFLOOR)).toBe(BRICKFLOOR);
  });

  it("no toca tiles ajenos (hierba) de noche", () => {
    const m = new TownHourTiles();
    m.recompute(base(), TOWN_ID, 0, 22, 0, 31);
    expect(m.effectiveTile(TOWN_ID, 0, 0, 0, GRASS)).toBe(GRASS);
  });
});

// ── Integración por Game (la capa entra en activeMap.tileAt = render + passability) ──

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2,
    monthsAtInn: 0, helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff,
    ring: 0xff, amulet: 0xff, partyStatus: 0, ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar(), makeChar({ name: "Iolo" })],
    partySize: 2, activeCharacter: 0, food: 100, keys: 5, skullKeys: 0,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0,
    position: { location: TOWN_ID, floor: 0, x: 15, y: 30 },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 12,
  };
  return { ...base, ...over } as GameState;
}

const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const combatResources: CombatResources = {
  combatMaps: [], enemyDefs: [], attackValues: [],
  attackRangeValues: [], defenseValues: [],
};

function townGame(hour: number, over: Partial<GameState> = {}): Game {
  const st = makeState({
    time: { year: 139, month: 4, day: 7, hour, minute: 0 },
    prevHour: hour,
    position: { location: TOWN_ID, floor: 0, x: 15, y: 30 },
    ...over,
  });
  return new Game({} as ExtractedInitialState, townWorld(), gameData, st, {
    combatResources,
  });
}

describe("Game.activeMap — capa horaria integrada (task #48)", () => {
  it("de día el mapa es el estático (reja abierta, puente bajado)", () => {
    const g = townGame(12);
    expect(g.activeMap.tileAt(ARCH_X, GATE_Y)).toBe(BRICKFLOOR);
    expect(g.activeMap.tileAt(PLANKS[0]!.x, PLANKS[0]!.y)).toBe(PLANK_L);
  });

  it("de noche activeMap muestra reja 0x99 y foso 0x03 (feed de render + passability)", () => {
    const g = townGame(22);
    expect(g.activeMap.tileAt(ARCH_X, GATE_Y)).toBe(PORTCULLIS);
    expect(g.activeMap.tileAt(PLANKS[0]!.x, PLANKS[0]!.y)).toBe(WATER);
    expect(g.activeMap.tileAt(PLANKS[1]!.x, PLANKS[1]!.y)).toBe(WATER);
  });

  it("refreshHourTiles tras cambiar la hora a 22 resincroniza (deep-link / save)", () => {
    const g = townGame(12);
    expect(g.activeMap.tileAt(ARCH_X, GATE_Y)).toBe(BRICKFLOOR);
    g.state.time.hour = 22;
    g.refreshHourTiles();
    expect(g.activeMap.tileAt(ARCH_X, GATE_Y)).toBe(PORTCULLIS);
    expect(g.activeMap.tileAt(PLANKS[0]!.x, PLANKS[0]!.y)).toBe(WATER);
  });

  it("en el overworld (loc 0) la capa queda inerte", () => {
    const g = townGame(22, { position: { location: 0, floor: 0, x: 100, y: 100 } });
    // location 0: sin small map; activeMap del overworld no aplica la capa.
    expect(g.activeMap.location).toBe(0);
    expect(g.activeMap.tileAt(100, 100)).toBe(GRASS);
  });

  it("TICK VIVO: al fichar la hora 20 en un turno de pueblo, reja baja y puente se iza (TOWN 0x15c8)", () => {
    // 19:59 → un paso de pueblo avanza el reloj 1 min hasta las 20:00 (anochecer).
    const g = townGame(19, {
      time: { year: 139, month: 4, day: 7, hour: 19, minute: 59 },
      prevHour: 19,
      position: { location: TOWN_ID, floor: 0, x: 15, y: 30 },
    });
    expect(g.activeMap.tileAt(ARCH_X, GATE_Y)).toBe(BRICKFLOOR); // aún de día
    g.move("north"); // (15,30)→(15,29) hierba; el turno cruza a las 20:00
    expect(g.state.time.hour).toBe(20);
    expect(g.activeMap.tileAt(ARCH_X, GATE_Y)).toBe(PORTCULLIS); // reja bajada
    expect(g.activeMap.tileAt(PLANKS[0]!.x, PLANKS[0]!.y)).toBe(WATER); // puente izado
  });
});
