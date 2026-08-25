/**
 * CONTRATO del contador de world-turns del arnés (task #8).
 *
 * El Grand Tour sincroniza sus esperas sobre `state.turnsSinceStart` en vez de reloj
 * real (nav.ts `getTurns`/`settle`/`burnTurn`). Ese contrato exige un invariante EXACTO
 * del motor: `turnsSinceStart` sube +1 por CADA world-turn CONSUMIDO (paso con éxito,
 * bump de pared en pueblo, NPC-bloqueado) y NO sube cuando la tecla no consume turno
 * (bump en EXTERIOR: sólo viento, sin reloj ni world-turn — MAINOUT 0xC30). El
 * incremento vive en `turn_housekeeping` (survival.ts), que corre UNA vez por turno
 * consumido. Si alguien mueve ese ++ (p.ej. a los world-turns extra de terreno lento),
 * el arnés dejaría de ver "1 tick por paso" y su sincronización se rompería: este test
 * lo blinda. NO valida bytes de save (el .GAM satura a u8 aparte); valida el CONTADOR
 * VIVO, que es monótono y sin techo en memoria.
 */
import { describe, expect, it } from "vitest";
import type {
  CharacterState,
  ExtractedInitialState,
  GameState,
} from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapFloor, SmallMapLocation, WorldData } from "../src/core/world/map.js";

const LOC = 17;
const FLOOR_TILE = 0x44; // BrickFloor (transitable)
const WALL_TILE = 0x01; // no transitable (IsWalking_Passable=false) → bump
const GRASS_TILE = 5; // exterior transitable

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
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: LOC, floor: 0, x: 5, y: 5 },
    transport: "foot",
    torchTurns: 0,
    torches: 2,
    prevHour: 8,
  };
  return { ...base, ...over } as GameState;
}

/** Small map 32×32 de BrickFloor con overrides `{ "x,y": tile }`. */
function floor(z: number, overrides: Record<string, number> = {}): SmallMapFloor {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => FLOOR_TILE));
  for (const [k, t] of Object.entries(overrides)) {
    const [x, y] = k.split(",").map(Number);
    tiles[y!]![x!] = t;
  }
  return { z, tiles };
}

/** Overworld 256×256 de grass con overrides `{ "x,y": tile }`. */
function makeWorld(loc: SmallMapLocation, overworldOverrides: Record<string, number> = {}): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => GRASS_TILE));
  for (const [k, t] of Object.entries(overworldOverrides)) {
    const [x, y] = k.split(",").map(Number);
    overworld[y!]![x!] = t;
  }
  return { overworld, underworld: overworld, smallMaps: new Map([[LOC, loc]]) };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 100),
  locationsY: Array.from({ length: 32 }, () => 100),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

function makeGame(loc: SmallMapLocation, s: GameState, ov: Record<string, number> = {}): Game {
  return new Game({} as ExtractedInitialState, makeWorld(loc, ov), gameData, s);
}

/** Un pueblo de una sola planta, plana, con overrides de tile. */
function town(overrides: Record<string, number> = {}): SmallMapLocation {
  return { id: LOC, name: "TestTown", floors: [floor(0, overrides)] };
}

describe("turnsSinceStart = contador de world-turns del arnés (task #8)", () => {
  it("un paso CON ÉXITO en pueblo lo sube +1", () => {
    const game = makeGame(town(), makeState());
    const before = game.state.turnsSinceStart;
    game.move("east"); // (5,5)→(6,5), casilla libre
    expect(game.state.position.x).toBe(6);
    expect(game.state.turnsSinceStart).toBe(before + 1);
  });

  it("un BUMP de pared en pueblo (turno consumido, sin mover) lo sube +1", () => {
    // Muro justo al este: el paso se bloquea pero el pueblo cobra 1 min (TOWN 0x15D4).
    const game = makeGame(town({ "6,5": WALL_TILE }), makeState());
    const before = game.state.turnsSinceStart;
    const events = game.move("east");
    expect(game.state.position.x).toBe(5); // no se movió
    expect(events.some((e) => e.kind === "message" && e.text === "Blocked!")).toBe(true);
    expect(game.state.turnsSinceStart).toBe(before + 1); // pero el turno SÍ pasó
  });

  it("N pasos en pueblo → exactamente +N (una casilla por tick, sin dobles)", () => {
    const game = makeGame(town(), makeState({ position: { location: LOC, floor: 0, x: 2, y: 5 } }));
    const before = game.state.turnsSinceStart;
    const N = 6;
    for (let i = 0; i < N; i++) game.move("east");
    expect(game.state.position.x).toBe(2 + N);
    expect(game.state.turnsSinceStart).toBe(before + N);
  });

  it("un paso CON ÉXITO en el exterior (loc 0) lo sube +1", () => {
    const s = makeState({ position: { location: 0, floor: 0, x: 100, y: 100 } });
    const game = makeGame(town(), s);
    const before = game.state.turnsSinceStart;
    game.move("east"); // grass → grass
    expect(game.state.turnsSinceStart).toBe(before + 1);
  });

  it("un BUMP en el EXTERIOR NO lo sube (0 min: sólo viento, sin world-turn — MAINOUT 0xC30)", () => {
    // Muro (agua/montaña no transitable) al este en el overworld.
    const s = makeState({ position: { location: 0, floor: 0, x: 100, y: 100 } });
    const game = makeGame(town(), s, { "101,100": WALL_TILE });
    const before = game.state.turnsSinceStart;
    game.move("east");
    expect(game.state.position.x).toBe(100); // bloqueado
    expect(game.state.turnsSinceStart).toBe(before); // sin world-turn: contador quieto
  });
});
