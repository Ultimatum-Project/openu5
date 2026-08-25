/**
 * Tests de integración del cableado de los bucles de contexto en Game (Task
 * 3.13): tiles especiales del exterior (pantano/veneno) y el gate de spawn/
 * viento en tickTurn. Las reglas de RNG puras están en tests/loops.test.ts.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test",
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
    characters: [makeChar(), makeChar({ name: "Iolo" })],
    partySize: 2,
    activeCharacter: 0,
    food: 100,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot",
    torchTurns: 0,
    torches: 2,
    prevHour: 12,
  };
  return { ...base, ...over } as GameState;
}

function makeWorld(tiles: Record<string, number> = {}): WorldData {
  const overworld = Array.from({ length: 256 }, (_, y) =>
    Array.from({ length: 256 }, (_, x) => tiles[`${x},${y}`] ?? 5),
  );
  return { overworld, underworld: overworld, smallMaps: new Map() };
}

const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const makeGame = (s: GameState, tiles: Record<string, number> = {}): Game =>
  new Game({} as ExtractedInitialState, makeWorld(tiles), gameData, s);

describe("Game — tiles especiales del bucle exterior (Task 3.13)", () => {
  it("pantano (tile 4) a pie: envenena (DEX 0 ⇒ rand(1,30)>0 siempre)", () => {
    const s = makeState();
    s.characters.forEach((c) => (c.dexterity = 0));
    // Sur de (100,100) es (100,101): pantano.
    const game = makeGame(s, { "100,101": 4 });
    const events = game.move("south");
    expect(s.position).toMatchObject({ x: 100, y: 101 });
    expect(s.characters[0]!.status).toBe("P");
    expect(s.characters[1]!.status).toBe("P");
    expect(events.some((e) => e.kind === "message" && e.text === "Poisoned!")).toBe(true);
  });

  it("pantano con DEX alta: nadie se envenena (rand(1,30) <= 30 <= DEX)", () => {
    const s = makeState();
    s.characters.forEach((c) => (c.dexterity = 30));
    const game = makeGame(s, { "100,101": 4 });
    game.move("south");
    expect(s.characters[0]!.status).toBe("G");
    expect(s.characters[1]!.status).toBe("G");
  });

  it("montado (no a pie) sobre pantano: NO envenena", () => {
    const s = makeState({ transport: "horse" });
    s.characters.forEach((c) => (c.dexterity = 0));
    const game = makeGame(s, { "100,101": 4 });
    game.move("south");
    expect(s.characters[0]!.status).toBe("G");
  });
});
