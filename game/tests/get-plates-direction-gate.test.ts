/**
 * (G)et sobre los PLATOS DE MESA (tiles 0x9A alto / 0x9B bajo / 0x9C ambos) —
 * GATE DE DIRECCIÓN.
 *
 * Derivación (`re/disasm/SJOG.OVL.asm`, cmd_get 0x18CE; nota en `re/notes/cmds.md §10`,
 * tarea #35). El «comer si alcanzable» que la nota describía en prosa es un gate sobre el
 * DELTA de la dirección elegida (`g_cmb_scratch_x/y`):
 *  - 0x9A (mitad ALTA) @0x1a6a: `cmp word [bp-0xe],1` / `jne 0x1a88` → exige dy == +1.
 *  - 0x9B (mitad BAJA) @0x1a92: `cmp word [bp-0xe],-1` / `jne 0x1ac4` → exige dy == −1.
 *  - 0x9C (AMBAS)      @0x1aca: `cmp word [bp-0xa],1` / `cmp word [bp-0xa],-1` → si
 *    dx == ±1 salta a 0x1ad6 (rechazo). Si no, @0x1adc-0x1b01 elige la mitad que te
 *    llevas: dy==+1 deja 0x9B y dy==−1 deja 0x9A.
 *  - ÉXITO: tile ← 0x95 (0x9A/0x9B) o la otra mitad (0x9C), y las TRES ramas caen en la
 *    COLA DE LA COSECHA @0x1a44-0x1a66: +1 comida (`call 0x7f94` con 0x270f/1/0x57a8) y
 *    `cmp [g_karma],0 / jne / dec [g_karma]` — mismo delta que segar trigo.
 *  - RECHAZO: imprime y salta a 0x1a8b→0x1b2e SIN tocar el marcador de turno 0x24e6 ⇒
 *    NO consume turno, igual que "Nothing to get!".
 *
 * STRINGS resueltos en `original/u5/play/DATA.OVL` con `fileoff = DS + 0x10` (convención
 * de `cast-input.md §5`), validados en la misma lectura contra dos controles ya conocidos
 * del repo (DS 0x8de8 = "Borrowed!\n", DS 0x8df4 = "Crops picked!\n"):
 *  - éxito  DS 0x8e04 / 0x8e24 / 0x8e58 = "Mmmmm...!\n"        (los tres, idénticos)
 *  - rechazo DS 0x8e10 / 0x8e30 / 0x8e44 = "Can't reach plate!\n" (los tres, idénticos)
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";

const PAWS = 0x16;
const TABLE_MIDDLE = 0x95; // 149 — lo que queda tras comerse una mitad
const FOOD_TOP = 0x9a; // 154
const FOOD_BOTTOM = 0x9b; // 155
const FOOD_BOTH = 0x9c; // 156

const EAT = "Mmmmm...!"; // DS 0x8e04/0x8e24/0x8e58
const CANT = "Can't reach plate!"; // DS 0x8e10/0x8e30/0x8e44

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Avatar", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    version: 1, characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 1000, keys: 0, gems: 0, torches: 2, karma: 50,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: PAWS, floor: 0, x: 3, y: 22 },
    transport: "foot", torchTurns: 0,
    questFlags: {}, journal: [],
    equipmentQuantities: new Array(48).fill(0),
    spellQuantities: new Array(48).fill(0),
    scrollQuantities: new Array(8).fill(0),
    potionQuantities: new Array(8).fill(0),
    reagentQuantities: new Array(8).fill(0),
  };
  return { ...base, ...over } as GameState;
}

/** Paws 32×32 de suelo 5, con el plato plantado donde pida el caso. */
function pawsWorld(plates: Array<{ x: number; y: number; tile: number }> = []): WorldData {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  for (const p of plates) tiles[p.y]![p.x] = p.tile;
  const paws: SmallMapLocation = { id: PAWS, name: "Paws", floors: [{ z: 0, tiles }] };
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return { overworld, underworld: overworld, smallMaps: new Map([[PAWS, paws]]) };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

function makeGame(s: GameState, world: WorldData): Game {
  return new Game({} as ExtractedInitialState, world, gameData, s);
}

/** Celda adyacente a la party (3,22) en cada rumbo. */
const CELL = {
  north: { x: 3, y: 21 },
  south: { x: 3, y: 23 },
  east: { x: 4, y: 22 },
  west: { x: 2, y: 22 },
} as const;
type Dir = keyof typeof CELL;

function texts(events: ReturnType<Game["get"]>): string[] {
  return events.filter((e) => e.kind === "message").map((e) => e.text as string);
}

describe("(G)et platos 0x9A/0x9B/0x9C — gate de dirección (SJOG 0x18CE)", () => {
  // ── Las 6 combinaciones del encargo: 3 tiles × alcanza / no alcanza ──────────────

  it("0x9A (mitad ALTA) SÓLO se come desde el norte estirando al SUR (dy==+1) @0x1a6a", () => {
    const { x, y } = CELL.south;
    const game = makeGame(makeState(), pawsWorld([{ x, y, tile: FOOD_TOP }]));
    const events = game.get("south");

    expect(texts(events)).toContain(EAT); // DS 0x8e04
    expect(game.activeMap.tileAt(x, y)).toBe(TABLE_MIDDLE); // mov [bx],0x95 @0x1a7b
    expect(game.state.food).toBe(101); // cola de la cosecha: +1 @0x1a50
    expect(game.state.karma).toBe(49); // dec [g_karma] @0x1a62
  });

  it("0x9A NO se alcanza desde los otros 3 rumbos → Can't reach plate! y nada cambia", () => {
    for (const dir of ["north", "east", "west"] as Dir[]) {
      const { x, y } = CELL[dir];
      const game = makeGame(makeState(), pawsWorld([{ x, y, tile: FOOD_TOP }]));
      const events = game.get(dir);

      expect(texts(events), `dir=${dir}`).toContain(CANT); // DS 0x8e10 @0x1a88
      expect(texts(events), `dir=${dir}`).not.toContain(EAT);
      expect(game.activeMap.tileAt(x, y), `dir=${dir}`).toBe(FOOD_TOP); // el plato sigue ahí
      expect(game.state.food, `dir=${dir}`).toBe(100);
      expect(game.state.karma, `dir=${dir}`).toBe(50);
    }
  });

  it("0x9B (mitad BAJA) SÓLO se come desde el sur estirando al NORTE (dy==−1) @0x1a92", () => {
    const { x, y } = CELL.north;
    const game = makeGame(makeState(), pawsWorld([{ x, y, tile: FOOD_BOTTOM }]));
    const events = game.get("north");

    expect(texts(events)).toContain(EAT); // DS 0x8e24
    expect(game.activeMap.tileAt(x, y)).toBe(TABLE_MIDDLE); // mov [bx],0x95 @0x1aa3
    expect(game.state.food).toBe(101);
    expect(game.state.karma).toBe(49);
  });

  it("0x9B NO se alcanza desde los otros 3 rumbos → Can't reach plate! y nada cambia", () => {
    for (const dir of ["south", "east", "west"] as Dir[]) {
      const { x, y } = CELL[dir];
      const game = makeGame(makeState(), pawsWorld([{ x, y, tile: FOOD_BOTTOM }]));
      const events = game.get(dir);

      expect(texts(events), `dir=${dir}`).toContain(CANT); // DS 0x8e30 @0x1ac4
      expect(game.activeMap.tileAt(x, y), `dir=${dir}`).toBe(FOOD_BOTTOM);
      expect(game.state.food, `dir=${dir}`).toBe(100);
      expect(game.state.karma, `dir=${dir}`).toBe(50);
    }
  });

  it("0x9C se come por N/S y te llevas LA MITAD DE TU LADO @0x1adc-0x1b01", () => {
    // Desde arriba (dy==+1) te comes la de arriba → queda la de ABAJO (0x9B).
    {
      const { x, y } = CELL.south;
      const game = makeGame(makeState(), pawsWorld([{ x, y, tile: FOOD_BOTH }]));
      const events = game.get("south");
      expect(texts(events)).toContain(EAT); // DS 0x8e58
      expect(game.activeMap.tileAt(x, y)).toBe(FOOD_BOTTOM); // mov [bx],0x9b @0x1aed
      expect(game.state.food).toBe(101);
      expect(game.state.karma).toBe(49);
    }
    // Desde abajo (dy==−1) te comes la de abajo → queda la de ARRIBA (0x9A).
    {
      const { x, y } = CELL.north;
      const game = makeGame(makeState(), pawsWorld([{ x, y, tile: FOOD_BOTH }]));
      const events = game.get("north");
      expect(texts(events)).toContain(EAT);
      expect(game.activeMap.tileAt(x, y)).toBe(FOOD_TOP); // mov [bx],0x9a @0x1b01
    }
  });

  it("0x9C RECHAZA el lateral (dx==±1) aunque haya comida en las dos mitades @0x1aca", () => {
    for (const dir of ["east", "west"] as Dir[]) {
      const { x, y } = CELL[dir];
      const game = makeGame(makeState(), pawsWorld([{ x, y, tile: FOOD_BOTH }]));
      const events = game.get(dir);

      expect(texts(events), `dir=${dir}`).toContain(CANT); // DS 0x8e44 @0x1ad6
      expect(game.activeMap.tileAt(x, y), `dir=${dir}`).toBe(FOOD_BOTH); // intacto
      expect(game.state.food, `dir=${dir}`).toBe(100);
    }
  });

  // ── Detalles de la cola compartida ──────────────────────────────────────────────

  it("el RECHAZO no consume turno (0x1a8b→0x1b2e no toca el marcador 0x24e6)", () => {
    const world = pawsWorld([{ x: CELL.east.x, y: CELL.east.y, tile: FOOD_BOTH }]);
    const game = makeGame(makeState(), world);
    const before = { ...game.state.time };
    game.get("east"); // rechazado
    expect(game.state.time).toEqual(before); // el reloj NO avanza

    // CONTRASTE: el éxito sí corre el turno (cae al exit compartido con runContextTurn).
    const ok = makeGame(makeState(), pawsWorld([{ x: CELL.south.x, y: CELL.south.y, tile: FOOD_BOTH }]));
    const t0 = { ...ok.state.time };
    ok.get("south");
    expect(ok.state.time).not.toEqual(t0);
  });

  it("karma 0 se queda en 0: el dec va guardado por `cmp [g_karma],0 / jne` @0x1a58", () => {
    const { x, y } = CELL.south;
    const game = makeGame(makeState({ karma: 0 }), pawsWorld([{ x, y, tile: FOOD_TOP }]));
    game.get("south");
    expect(game.state.karma).toBe(0); // no baja de 0 (ni envuelve a 255)
    expect(game.state.food).toBe(101); // la comida sí se cobra
  });

  it("comer deja la mesa NO cogible: el 2º Get da Nothing to get! (0x95 cae al 0x1b28)", () => {
    const { x, y } = CELL.south;
    const game = makeGame(makeState(), pawsWorld([{ x, y, tile: FOOD_TOP }]));
    game.get("south"); // 0x9A → 0x95
    const events = game.get("south");
    expect(texts(events)).toContain("Nothing to get!"); // DS 0x8e64
    expect(game.state.food).toBe(101); // no se cobra dos veces
  });
});
