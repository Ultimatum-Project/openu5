/**
 * F-0 del ASCENSO desde el Underworld (ch16). Dos correcciones de fidelidad al
 * despacho de (E)nter, derivadas de MAINOUT.OVL:
 *
 *  F-0 #1 — cmd_enter (0x08de) NO tiene guarda de planta: despacha por TILE bajo
 *           la party sin mirar g_floor. El viejo `if (pos.floor === 0xff) →
 *           "Enter What?"` (espejo del clon) amordazaba las entradas del Underworld.
 *  F-0 #2 — nivel de entrada (0x088f-0x08be): desde SUPERFICIE → cima (planta 0);
 *           desde el UNDERWORLD → FONDO (planta 7, (7,7), mirando Oeste); EXCEPTO
 *           Doom (id 40), que SIEMPRE entra por la cima.
 *
 * Las 8 mazmorras existen físicamente en el Underworld en su coord de data.json
 * (verificado en underworld.json); tras el sello (Y)ell heredado, (E)nter sobre la
 * entrada re-carga la mazmorra por el fondo → se sube a Britannia (el capítulo).
 */
import { describe, it, expect } from "vitest";
import { Game, type GameData, type GameSystems } from "../src/core/game.js";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import type { WorldData } from "../src/core/world/map.js";
import type { DungeonData } from "../src/core/dungeon/dungeon.js";
import { wordSpokenFlag } from "../src/core/quest/words.js";

const WORDS = ["FALLAX", "VILIS", "INOPIA", "MALUM", "AVIDUS", "INFAMA", "IGNAVUS", "VERAMOCOR"];
const DECEIT = 33; // idx 32 en las tablas de coordenada
const DOOM = 40; // idx 39; solo-Underworld; entra por la cima aun desde el Underworld
const DECEIT_AT = { x: 240, y: 73 }; // coord real de Deceit en el Underworld (data.json)
const DOOM_AT = { x: 128, y: 128 }; // coord real de Doom (agua en superficie / cave en Underworld)
const DUNGEON_TILE = 0x18; // ENTERABLE_TILES → "Enter dungeon"

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Avatar",
    gender: 0x0b,
    class: "A",
    status: "G",
    strength: 20,
    dexterity: 20,
    intelligence: 20,
    currentMp: 10,
    currentHp: 50,
    maxHp: 60,
    exp: 0,
    level: 2,
    monthsAtInn: 0,
    helmet: 0xff,
    armor: 0xff,
    weapon: 0xff,
    shield: 0xff,
    ring: 0xff,
    amulet: 0xff,
    partyStatus: 0,
    ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar()],
    partySize: 1,
    activeCharacter: 0,
    food: 100,
    karma: 50,
    time: { year: 139, month: 5, day: 10, hour: 8, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0xff, x: DECEIT_AT.x, y: DECEIT_AT.y },
    transport: "foot",
    transportTile: 0x1c,
    // Sello heredado: la Palabra de las dos mazmorras ya se gritó (estado de mundo).
    questFlags: { [wordSpokenFlag(DECEIT)]: true, [wordSpokenFlag(DOOM)]: true },
    prevHour: 8,
  };
  return { ...base, ...over } as GameState;
}

/** Mapa con tile de entrada de mazmorra en las coords de Deceit y Doom (ambos mapas). */
function makeWorld(): WorldData {
  const mk = (): number[][] => Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  const overworld = mk();
  const underworld = mk();
  for (const m of [overworld, underworld]) {
    m[DECEIT_AT.y]![DECEIT_AT.x] = DUNGEON_TILE;
    m[DOOM_AT.y]![DOOM_AT.x] = DUNGEON_TILE;
  }
  return { overworld, underworld, smallMaps: new Map() };
}

function makeGameData(): GameData {
  const locationsX = Array.from({ length: 40 }, () => 200);
  const locationsY = Array.from({ length: 40 }, () => 200);
  locationsX[32] = DECEIT_AT.x;
  locationsY[32] = DECEIT_AT.y;
  locationsX[39] = DOOM_AT.x;
  locationsY[39] = DOOM_AT.y;
  return {
    locationsX,
    locationsY,
    locationNames: Array.from({ length: 40 }, (_, i) => `Loc${i + 1}`),
    wordsOfPower: WORDS,
  };
}

/** Deceit/Doom con 8 plantas 8×8; escalera-up de planta 0 en (1,1). */
function makeDungeon(location: number, name: string): DungeonData {
  const floors = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ type: 0, sub: 0 }))),
  );
  floors[0]![1]![1] = { type: 1, sub: 0 }; // LadderUp de la cima
  return { location, name, floors };
}

function makeGame(s: GameState = makeState()): Game {
  const systems: GameSystems = { dungeons: [makeDungeon(DECEIT, "Deceit"), makeDungeon(DOOM, "Doom")] };
  return new Game({} as ExtractedInitialState, makeWorld(), makeGameData(), s, systems);
}

const texts = (ev: { kind: string; text?: string }[]): string[] =>
  ev.filter((e) => e.kind === "message").map((e) => e.text ?? "");

describe("F-0 #1 — cmd_enter sin guarda de planta (0x08de)", () => {
  it("(E)nter sobre la entrada de Deceit en el Underworld NO devuelve 'Enter What?' y entra", () => {
    const game = makeGame();
    const ev = game.enter();
    const msgs = texts(ev);
    expect(msgs).not.toContain("Enter What?");
    expect(msgs).toContain("Enter dungeon");
    expect(ev.some((e) => e.kind === "dungeon-entered")).toBe(true);
  });
});

describe("F-0 #2 — nivel de entrada por planta de origen (0x088f)", () => {
  it("desde el Underworld: Deceit carga por el FONDO (planta 7, (7,7), mirando Oeste)", () => {
    const game = makeGame();
    game.enter();
    expect(game.dungeonState).not.toBeNull();
    expect(game.dungeonState!.pos).toMatchObject({
      dungeon: DECEIT,
      floor: 7,
      x: 7,
      y: 7,
      facing: "west",
    });
  });

  it("EXCEPCIÓN Doom (id 40): desde el Underworld entra por la CIMA (planta 0, (1,1))", () => {
    const game = makeGame(makeState({ position: { location: 0, floor: 0xff, x: DOOM_AT.x, y: DOOM_AT.y } }));
    game.enter();
    expect(game.dungeonState!.pos).toMatchObject({ dungeon: DOOM, floor: 0 });
    expect(game.dungeonState!.pos.floor).not.toBe(7);
  });

  it("REGRESIÓN: desde SUPERFICIE (floor 0) Deceit entra por la CIMA (planta 0), (1,1) intacto", () => {
    const game = makeGame(
      makeState({ position: { location: 0, floor: 0, x: DECEIT_AT.x, y: DECEIT_AT.y } }),
    );
    game.enter();
    expect(game.dungeonState!.pos).toMatchObject({ dungeon: DECEIT, floor: 0, x: 1, y: 1, facing: "south" });
  });
});
