/**
 * Task #3 — Objetos de INTERIOR rehidratados por-entrada desde los slots-objeto del
 * .NPC (sustituye al inventado TREASURY_CHESTS). Cofres del sótano del castillo de
 * Lord British (loc 17, floor -1) como cofre-objeto de la capa g_world_objects (F1.5):
 *
 *   (a) al ENTRAR al castillo se siembran los 3 cofres en sus coords REALES del .NPC;
 *   (b) (O)pen sobre uno → botín EXACTO de chestLoot (seed fija) + objeto eliminado;
 *   (c) salir al overworld y RE-ENTRAR → el cofre HA VUELTO (regeneración por-entrada);
 *   (d) guardar DENTRO del castillo con un cofre saqueado → cargar → SIGUE saqueado
 *       (matiz SAVED.GAM 0x6B4 = objetos del ENTORNO ACTUAL);
 *   (e) guardar, salir, re-entrar → vuelve;
 *   (f) naves/objetos del OVERWORLD (loc 0) NO se resetean al viajar;
 *   (g) migración de saves con overrides viejos de TREASURY (muro/barril + treasuryLoot);
 *   (h) el "muro roto" (#F13-1) ya no ocurre: las coords de muro quedan intactas.
 *
 * Derivación de coords: re/notes/npc-object-actors.md (slots 23/24/25 tile 257 en
 * (16,21)/(17,22)/(13,23) z=0xFF, cadáver slot 28 tile 286 en (9,9)). Contenido de
 * cofre = INTERIOR_CHEST_CONTENTS (Clase C, hueco O5). Persistencia interior/overworld:
 * .superpowers/sdd/scout-regen.md Re-análisis 2 (Redux InitializeFromLegacy: sólo el
 * mapa donde GUARDAS restaura del save; re-entrar re-siembra fresco).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { Game, type GameData, INTERIOR_CHEST_CONTENTS } from "../src/core/game.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { DoorManager } from "../src/core/world/doors.js";
import type { WorldData, SmallMapLocation } from "../src/core/world/map.js";
import {
  createNewGame,
  serialize,
  deserialize,
  type ExtractedInitialState,
  type GameState,
} from "../src/core/state.js";
import { chestLoot, applyLootGrant, type LootGrant } from "../src/core/world/commands.js";
import { OriginalRng } from "../src/core/rng-original.js";

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), "../assets");
const readJson = <T>(p: string): T =>
  JSON.parse(readFileSync(`${ASSETS}/${p}`, "utf-8")) as T;

const CASTLE_LB = 17;

let world: WorldData;
let init: ExtractedInitialState;
let npcData: Record<number, NpcSlot[]>;
let look2: string[];

beforeAll(() => {
  const smallMapsRaw = readJson<SmallMapLocation[]>("maps/smallmaps.json");
  world = {
    overworld: readJson("maps/overworld.json"),
    underworld: readJson("maps/underworld.json"),
    smallMaps: new Map(smallMapsRaw.map((l) => [l.id, l])),
  };
  init = readJson("initial-state.json");
  npcData = readJson<Record<number, NpcSlot[]>>("npcs.json");
  look2 = readJson<string[]>("look2.json");
});

const gameData = (): GameData => ({
  locationsX: Array.from({ length: 33 }, () => 250),
  locationsY: Array.from({ length: 33 }, () => 250),
  locationNames: Array.from({ length: 33 }, (_, i) => `Loc${i}`),
  look2,
});

function newGame(state: GameState): Game {
  return new Game(init, world, gameData(), state, {
    npcManager: new NpcManager(npcData),
    doors: new DoorManager(),
  });
}

/** Game en el castillo LB (loc 17) en el floor/pos dados, con los objetos ya sembrados. */
function enteredCastle(floor: number, at: { x: number; y: number }): Game {
  const state = createNewGame(init);
  state.position = { location: CASTLE_LB, floor, x: at.x, y: at.y };
  const game = newGame(state);
  game.hydrateInteriorObjects(CASTLE_LB); // espejo de checkLocationEntry (entrada fresca)
  return game;
}

/** Coord (x,y,floor) de cada cofre en worldObjects, ordenadas. */
function chestCoords(game: Game): string[] {
  return (game.state.worldObjects ?? [])
    .filter((o) => o.kind === "chest")
    .map((o) => `${o.x},${o.y},${o.floor}`)
    .sort();
}

describe("(a) entrada al castillo siembra los 3 cofres reales del .NPC", () => {
  it("los cofres existen en (16,21)/(17,22)/(13,23) floor -1", () => {
    const game = enteredCastle(-1, { x: 15, y: 21 });
    expect(chestCoords(game)).toEqual(["13,23,-1", "16,21,-1", "17,22,-1"]);
  });

  it("cada cofre lleva contents = INTERIOR_CHEST_CONTENTS (Clase C, O5)", () => {
    const game = enteredCastle(-1, { x: 15, y: 21 });
    for (const o of game.state.worldObjects!.filter((w) => w.kind === "chest")) {
      expect(o.contents).toBe(INTERIOR_CHEST_CONTENTS);
    }
  });

  it("el cadáver (slot 28, tile 286) también se hidrata como objeto en (9,9)", () => {
    const game = enteredCastle(-1, { x: 15, y: 21 });
    const corpse = game.state.worldObjects!.find((o) => o.tile === 286);
    expect(corpse).toMatchObject({ x: 9, y: 9, floor: -1, kind: "prop" });
  });
});

describe("(b) (O)pen sobre un cofre da el botín EXACTO de chestLoot y lo elimina", () => {
  it("botín = chestLoot(contents, seed) y el objeto desaparece", () => {
    const SEED = 0x4d2;
    const game = enteredCastle(-1, { x: 15, y: 21 }); // party al oeste del cofre (16,21)
    game.reseed(SEED);

    // Botín esperado: primer consumidor de RNG tras reseed es chestLoot (sin trampa).
    const expected: LootGrant[] = chestLoot(INTERIOR_CHEST_CONTENTS & 0x7f, ((): (lo: number, hi: number) => number => {
      const rng = new OriginalRng(SEED);
      return (lo, hi) => rng.next(lo, hi);
    })());
    const stub = { gold: 0, keys: 0, gems: 0, torches: 0, food: 0 } as unknown as GameState;
    for (const g of expected) applyLootGrant(stub, g);

    const before = { ...game.state };
    game.open("east");

    // #13: el cofre desaparece y su botín queda AL SUELO (kind "loot") en (16,21); NADA se
    // acredita al abrir. El (G)et posterior recoge pieza a pieza y acredita los contadores.
    expect(game.state.worldObjects!.find((o) => o.x === 16 && o.y === 21 && o.floor === -1 && o.kind === "chest")).toBeUndefined();
    expect(game.state.gold).toBe(before.gold); // sin acreditar al abrir
    // Recoge todo el botín-suelo de (16,21) (party al oeste → Get-Este).
    let guard = 0;
    while (game.state.worldObjects!.some((o) => o.kind === "loot" && o.x === 16 && o.y === 21) && guard++ < 40) {
      game.get("east");
    }
    // Tras recoger todo, los contadores simples igualan el botín EXACTO de chestLoot.
    expect(game.state.gold).toBe(before.gold + stub.gold);
    expect(game.state.keys).toBe(before.keys + stub.keys);
    expect(game.state.gems).toBe(before.gems + stub.gems);
    expect(game.state.torches).toBe(before.torches + stub.torches);
    expect(game.state.food).toBe(before.food + stub.food);
  });
});

describe("(c) salir al overworld y RE-ENTRAR regenera el cofre saqueado", () => {
  it("el cofre saqueado vuelve a nacer tras salir y re-entrar (mecánica del original)", () => {
    const game = enteredCastle(-1, { x: 15, y: 21 });
    game.open("east"); // saquea (16,21)
    expect(game.state.worldObjects!.find((o) => o.x === 16 && o.y === 21 && o.floor === -1 && o.kind === "chest")).toBeUndefined();

    game.confirmTownExit(true); // salir al overworld → descarta objetos de interior (cofres + botín-suelo)
    expect(game.state.position.location).toBe(0);
    expect(chestCoords(game)).toEqual([]);

    // Re-entrada (espejo de checkLocationEntry): re-posiciona y re-siembra fresco.
    game.state.position = { location: CASTLE_LB, floor: -1, x: 15, y: 21 };
    game.hydrateInteriorObjects(CASTLE_LB);
    expect(chestCoords(game)).toEqual(["13,23,-1", "16,21,-1", "17,22,-1"]); // ¡ha vuelto!
  });
});

describe("(d) guardar DENTRO del castillo conserva el cofre saqueado (matiz 0x6B4)", () => {
  it("save inside → load → el cofre saqueado SIGUE saqueado; los otros 2 siguen", () => {
    const game = enteredCastle(-1, { x: 15, y: 21 });
    game.open("east"); // saquea (16,21)

    const loaded = deserialize(serialize(game.state));
    const g2 = newGame(loaded); // el constructor NO re-hidrata (confía en el save)

    expect(g2.state.worldObjects!.find((o) => o.x === 16 && o.y === 21 && o.floor === -1 && o.kind === "chest")).toBeUndefined();
    expect(g2.state.worldObjects!.filter((o) => o.kind === "chest")).toHaveLength(2);
  });
});

describe("(e) guardar, salir, re-entrar → el cofre vuelve", () => {
  it("desde un save interior con 2 cofres, salir+re-entrar regenera los 3", () => {
    const src = enteredCastle(-1, { x: 15, y: 21 });
    src.open("east");
    const g2 = newGame(deserialize(serialize(src.state)));

    g2.confirmTownExit(true); // salir
    expect(g2.state.worldObjects!.filter((o) => o.kind === "chest")).toHaveLength(0);

    g2.state.position = { location: CASTLE_LB, floor: -1, x: 15, y: 21 };
    g2.hydrateInteriorObjects(CASTLE_LB);
    expect(g2.state.worldObjects!.filter((o) => o.kind === "chest")).toHaveLength(3);
  });
});

describe("(f) los objetos del OVERWORLD NO se resetean al viajar a un interior", () => {
  it("una nave atracada en loc 0 sobrevive a entrar y salir de un pueblo", () => {
    const state = createNewGame(init);
    state.position = { location: 0, floor: 0, x: 80, y: 80 };
    state.worldObjects = [
      { location: 0, floor: 0, x: 50, y: 50, tile: 0x25, kind: "ship", hull: 99, skiffs: 0 },
    ];
    const game = newGame(state);

    // Entrar al castillo (hidrata interior; la nave del overworld intacta).
    game.state.position = { location: CASTLE_LB, floor: -1, x: 15, y: 21 };
    game.hydrateInteriorObjects(CASTLE_LB);
    expect(game.state.worldObjects!.find((o) => o.kind === "ship")).toBeDefined();

    // Salir: sólo se descartan los objetos de interior; la nave persiste.
    game.confirmTownExit(true);
    expect(game.state.worldObjects!.find((o) => o.kind === "ship")).toMatchObject({
      location: 0,
      x: 50,
      y: 50,
    });
    expect(game.state.worldObjects!.filter((o) => o.kind === "chest")).toHaveLength(0);
  });
});

describe("(g) migración de saves con overrides viejos de TREASURY", () => {
  it("borra los overrides de muro/barril de las 8 coords TREASURY y el treasuryLoot; preserva overrides legítimos", () => {
    const old = createNewGame(init) as GameState & { treasuryLoot?: Record<string, number> };
    old.mapOverrides = {
      "17:-1:6:10": 257, // muro (79) tapado por cofre inventado → borrar
      "17:-1:10:10": 68, // muro saqueado (BrickFloor) → borrar
      "17:-1:14:10": 257,
      "17:-1:16:22": 257, // barril (166) tapado → borrar
      "2:0:5:5": 149, // override legítimo (comida) → preservar
    };
    old.treasuryLoot = { "0": 712 };

    const loaded = deserialize(serialize(old)) as GameState & { treasuryLoot?: unknown };
    expect(loaded.mapOverrides!["17:-1:6:10"]).toBeUndefined();
    expect(loaded.mapOverrides!["17:-1:10:10"]).toBeUndefined();
    expect(loaded.mapOverrides!["17:-1:14:10"]).toBeUndefined();
    expect(loaded.mapOverrides!["17:-1:16:22"]).toBeUndefined();
    expect(loaded.mapOverrides!["2:0:5:5"]).toBe(149);
    expect(loaded.treasuryLoot).toBeUndefined();
  });
});

describe("(h) el 'muro roto' (#F13-1) ya no ocurre", () => {
  it("las coords de muro (6,10)/(10,10)/(14,10) siguen siendo StoneBrickWall tras el ciclo", () => {
    const game = enteredCastle(-1, { x: 15, y: 21 });
    const WALLS: [number, number][] = [[6, 10], [10, 10], [14, 10]];

    // Ningún cofre se siembra sobre un muro.
    for (const [x, y] of WALLS) {
      expect(game.state.worldObjects!.find((o) => o.x === x && o.y === y)).toBeUndefined();
      expect(game.activeMap.tileAt(x, y)).toBe(79);
    }

    // Abrir el cofre real (16,21) NO deja override en los muros.
    game.open("east");
    for (const [x, y] of WALLS) {
      expect(game.activeMap.tileAt(x, y)).toBe(79);
      expect(game.state.mapOverrides?.[`17:-1:${x}:${y}`]).toBeUndefined();
    }
  });
});
