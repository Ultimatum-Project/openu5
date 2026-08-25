/**
 * PORT F1.11 — Escaleras de pueblo AUTOMÁTICAS + (K)limb de small map.
 *
 * Regla EXACTA del binario (re/notes/town-klimb.md, disasm TOWN.OVL 0x0810/0x052E/
 * 0x0B82, strings DATA.OVL 0x265a/0x265f/0x2723/0x272a/0x2735):
 *
 *  - Las escaleras 0xC4-0xC7 (StairsN/E/S/W) transicionan de planta al PISARLAS
 *    (TOWN 0x0810 → 0x052E). orient = tile-0xC4; dir del paso N=0 E=1 S=2 W=3.
 *    orient==dir → sube ("Up!"); orient==dir^2 → baja ("Down!"); si no, cruza sin
 *    cambiar de planta. La posición (x,y) NO cambia.
 *  - (K)limb en small map (0x0B82) NO toca las escaleras: sólo escalas
 *    (0xC8 sube / 0xC9 baja), reja 0x86 (baja) y "encaramarse" a roca/valla con
 *    K+dir. A caballo → "-On foot!". El prefijo impreso siempre es "Klimb-".
 */
import { describe, expect, it } from "vitest";
import type {
  CharacterState,
  ExtractedInitialState,
  GameState,
} from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapFloor, SmallMapLocation, WorldData } from "../src/core/world/map.js";

const LOC = 17; // idx 16 en locationsX/Y
const FLOOR_TILE = 0x44; // BrickFloor (transitable)

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

/** Small map 32×32 lleno de BrickFloor con overrides `{ "x,y": tile }` por casilla. */
function floor(z: number, overrides: Record<string, number> = {}): SmallMapFloor {
  const tiles = Array.from({ length: 32 }, () =>
    Array.from({ length: 32 }, () => FLOOR_TILE),
  );
  for (const [k, t] of Object.entries(overrides)) {
    const parts = k.split(",");
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    tiles[y]![x] = t;
  }
  return { z, tiles };
}

function makeWorld(loc: SmallMapLocation): WorldData {
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => 5),
  );
  return { overworld, underworld: overworld, smallMaps: new Map([[LOC, loc]]) };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 100),
  locationsY: Array.from({ length: 32 }, () => 100),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

function makeGame(loc: SmallMapLocation, s: GameState = makeState()): Game {
  return new Game({} as ExtractedInitialState, makeWorld(loc), gameData, s);
}

/** Location con floors -1,0,1 y la MISMA escalera en (5,5) de las tres plantas. */
function stairLocation(stairTile: number): SmallMapLocation {
  const ov = { "5,5": stairTile };
  return {
    id: LOC,
    name: "TestKeep",
    floors: [floor(-1, ov), floor(0, ov), floor(1, ov)],
  };
}

const STAIRS_N = 0xc4;
const STAIRS_E = 0xc5;
const STAIRS_S = 0xc6;
const STAIRS_W = 0xc7;
const DELTA = { north: { dx: 0, dy: -1 }, south: { dx: 0, dy: 1 }, east: { dx: 1, dy: 0 }, west: { dx: -1, dy: 0 } };

/**
 * Pisa la escalera de (5,5) entrando desde la casilla adyacente en `dir`.
 * Coloca al party en (5,5)-delta y da un paso en `dir`.
 */
function stepOntoStair(game: Game, dir: keyof typeof DELTA) {
  const { dx, dy } = DELTA[dir];
  game.state.position.x = 5 - dx;
  game.state.position.y = 5 - dy;
  game.state.position.floor = 0;
  return game.move(dir);
}

describe("Escaleras de small map: transición AUTOMÁTICA al pisar (TOWN 0x0810→0x052E)", () => {
  // orient==dir → sube; orient==dir^2 → baja; resto → cruza sin cambiar planta.
  const cases: Array<[number, string, keyof typeof DELTA, number, string | null]> = [
    // StairsN (orient 0)
    [STAIRS_N, "StairsN", "north", 1, "Up!"],
    [STAIRS_N, "StairsN", "south", -1, "Down!"],
    [STAIRS_N, "StairsN", "east", 0, null],
    [STAIRS_N, "StairsN", "west", 0, null],
    // StairsE (orient 1)
    [STAIRS_E, "StairsE", "east", 1, "Up!"],
    [STAIRS_E, "StairsE", "west", -1, "Down!"],
    [STAIRS_E, "StairsE", "north", 0, null],
    // StairsS (orient 2)
    [STAIRS_S, "StairsS", "south", 1, "Up!"],
    [STAIRS_S, "StairsS", "north", -1, "Down!"],
    // StairsW (orient 3)
    [STAIRS_W, "StairsW", "west", 1, "Up!"],
    [STAIRS_W, "StairsW", "east", -1, "Down!"],
  ];

  for (const [tile, name, dir, delta, msg] of cases) {
    it(`${name} + paso ${dir} → planta ${delta >= 0 ? "+" : ""}${delta}${msg ? ` ("${msg}")` : " (sin cambio)"}`, () => {
      const game = makeGame(stairLocation(tile));
      const events = stepOntoStair(game, dir);

      expect(game.state.position.floor).toBe(delta);
      // La posición (x,y) NO cambia con la transición: sigue en la escalera.
      expect(game.state.position.x).toBe(5);
      expect(game.state.position.y).toBe(5);
      if (msg) {
        expect(events.some((e) => e.kind === "message" && e.text === msg)).toBe(true);
        expect(events.some((e) => e.kind === "map-changed")).toBe(true);
      } else {
        expect(events.some((e) => e.kind === "message" && (e.text === "Up!" || e.text === "Down!"))).toBe(false);
      }
    });
  }

  it("NO prefija 'Klimb-' en la transición automática (va por 0x052E directo, sin 0x2723)", () => {
    const game = makeGame(stairLocation(STAIRS_E));
    const events = stepOntoStair(game, "east");
    expect(events.some((e) => e.kind === "message" && e.text === "Up!")).toBe(true);
    expect(events.some((e) => e.kind === "message" && e.text === "Klimb-Up!")).toBe(false);
  });
});

describe("(K)limb en small map (TOWN 0x0B82): escalas, reja, encaramarse — NUNCA escaleras", () => {
  it("K sobre LadderUp (0xC8) → sube, 'Klimb-Up!'", () => {
    const loc: SmallMapLocation = {
      id: LOC, name: "K", floors: [floor(0, { "5,5": 0xc8 }), floor(1, { "5,5": 0xc9 })],
    };
    const game = makeGame(loc);
    const events = game.klimb();
    expect(game.state.position.floor).toBe(1);
    expect(events.some((e) => e.kind === "message" && e.text === "Klimb-Up!")).toBe(true);
  });

  it("K sobre LadderDown (0xC9) → baja, 'Klimb-Down!'", () => {
    const loc: SmallMapLocation = {
      id: LOC, name: "K", floors: [floor(-1, { "5,5": 0xc8 }), floor(0, { "5,5": 0xc9 })],
    };
    const game = makeGame(loc);
    const events = game.klimb();
    expect(game.state.position.floor).toBe(-1);
    expect(events.some((e) => e.kind === "message" && e.text === "Klimb-Down!")).toBe(true);
  });

  it("K sobre reja Grate (0x86) → baja, 'Klimb-Down!' (TOWN 0x0BBB)", () => {
    const loc: SmallMapLocation = {
      id: LOC, name: "K", floors: [floor(-1, { "5,5": 0x86 }), floor(0, { "5,5": 0x86 })],
    };
    const game = makeGame(loc);
    const events = game.klimb();
    expect(game.state.position.floor).toBe(-1);
    expect(events.some((e) => e.kind === "message" && e.text === "Klimb-Down!")).toBe(true);
  });

  it("K sobre una ESCALERA (0xC4-0xC7) NO cambia de planta: emite needs-direction (no es caso de Klimb)", () => {
    const game = makeGame(stairLocation(STAIRS_N));
    const before = game.state.position.floor;
    const events = game.klimb();
    expect(game.state.position.floor).toBe(before); // regresión: se retiró el K-sube-escaleras inventado
    expect(events.some((e) => e.kind === "needs-direction" && e.command === "klimb")).toBe(true);
  });

  it("K+dir sobre valla (0xCA) → el party se ENCARAMA (cruza la casilla), sin cambio de planta", () => {
    const loc: SmallMapLocation = { id: LOC, name: "K", floors: [floor(0, { "6,5": 0xca })] };
    const game = makeGame(loc);
    game.state.position = { location: LOC, floor: 0, x: 5, y: 5 };
    const events = game.klimb("east");
    expect(game.state.position.x).toBe(6);
    expect(game.state.position.y).toBe(5);
    expect(game.state.position.floor).toBe(0);
    expect(events.some((e) => e.kind === "moved")).toBe(true);
  });

  it("K+dir sobre roca baja (0x4C) → el party se encarama", () => {
    const loc: SmallMapLocation = { id: LOC, name: "K", floors: [floor(0, { "5,4": 0x4c })] };
    const game = makeGame(loc);
    game.state.position = { location: LOC, floor: 0, x: 5, y: 5 };
    game.klimb("north");
    expect(game.state.position).toMatchObject({ x: 5, y: 4, floor: 0 });
  });

  it("K+dir sobre casilla normal → 'Klimb-What?', sin moverse ni cobrar turno (0x0C38 [bp-2]=0)", () => {
    const loc: SmallMapLocation = { id: LOC, name: "K", floors: [floor(0)] };
    const game = makeGame(loc);
    game.state.position = { location: LOC, floor: 0, x: 5, y: 5 };
    const minBefore = game.state.time.minute;
    const events = game.klimb("east");
    expect(game.state.position).toMatchObject({ x: 5, y: 5 });
    expect(events.some((e) => e.kind === "message" && e.text === "Klimb-What?")).toBe(true);
    // Asimetría (fix #50): "What?" (target inválido) NO avanza el reloj.
    expect(game.state.time.minute).toBe(minBefore);
  });

  it("cancelar el prompt de dirección de Klimb COBRA 1 turno (TOWN 0x0C3E [bp-2]=1)", () => {
    // Contraparte de la asimetría: el getdir cancelado sí avanza el reloj 1 min.
    const loc: SmallMapLocation = { id: LOC, name: "K", floors: [floor(0)] };
    const game = makeGame(loc);
    game.state.position = { location: LOC, floor: 0, x: 5, y: 5 };
    const minBefore = game.state.time.minute;
    game.klimbCancel();
    expect(game.state.time.minute).toBe(minBefore + 1); // turno de pueblo = 1 min
  });

  it("K a caballo → 'Klimb--On foot!' (TOWN 0x0B94, string 0x272a), sin acción", () => {
    const loc: SmallMapLocation = { id: LOC, name: "K", floors: [floor(0, { "5,5": 0xc8 }), floor(1)] };
    const game = makeGame(loc, makeState({ transport: "horse" }));
    const events = game.klimb();
    expect(game.state.position.floor).toBe(0);
    expect(events.some((e) => e.kind === "message" && e.text === "Klimb--On foot!")).toBe(true);
  });
});
