/**
 * Fase 1.5 · Naves orgánicas: `buyShip` coloca un objeto-nave en el muelle (MAINOUT
 * 0x0D22 / spawnPurchasedShip), `Board` sobre el objeto-nave siembra el vehículo activo
 * (slot0: transport/hull/skiffs) DESDE el objeto y lo RETIRA, `X-it` en tierra lo RE-CREA
 * (nave aparcada persistente, scout-objects O6). board/spawnPurchasedShip NO se
 * reimplementan. 0 RNG nuevo.
 *
 * ⚠ Matiz slot0-vs-objeto (transport.md §6 + §7): el casco/skiffs de la nave APARCADA
 * viven en el OBJETO (obj+5 = g_hull DS:0x5C5F sólo cuando es slot0; obj+7 = g_skiffs
 * 0x5C61). spawnDockShip NO ensucia state.shipHull/shipSkiffs (que son slot0 = vehículo
 * ACTIVO). Al abordar (§7A), slot0 toma el hull/skiffs del objeto ANTES de que board()
 * los lea para los avisos DANGER/WARNING. Al X-it en tierra (§7B), el objeto se re-crea
 * con el hull/skiffs VIVOS del estado.
 *
 * Citas: re/notes/transport.md §6 (colocación 0x0D22), §7A (Board 0x07F6), §7B (X-it
 * 0x0EB4); .superpowers/sdd/scout-objects.md O6.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState, WorldObject } from "../src/core/state.js";
import { serialize, deserialize } from "../src/core/state.js";
import { ACTOR_TILE_BANK, Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";

const PAWS = 0x16;

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
    position: { location: PAWS, floor: 0, x: 3, y: 21 },
    transport: "foot", torchTurns: 0, magicCarpets: 0,
    questFlags: {}, journal: [],
    equipmentQuantities: new Array(48).fill(0),
    spellQuantities: new Array(48).fill(0),
    scrollQuantities: new Array(8).fill(0),
    potionQuantities: new Array(8).fill(0),
    reagentQuantities: new Array(8).fill(0),
  };
  return { ...base, ...over } as GameState;
}

/** Mundo de prueba: PAWS 32×32 todo hierba (5 = walkable → landNearby siempre true). */
function pawsWorld(): WorldData {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
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

const shipObj = (g: Game): WorldObject | undefined =>
  g.state.worldObjects?.find((o) => o.kind === "ship");

describe("F1.5 · spawnDockShip coloca la nave en el muelle (0x0D22)", () => {
  it("fragata (flags 0x82): hull 99, 2 skiffs, tile 0x125, overlayada en el muelle", () => {
    const game = makeGame(makeState(), pawsWorld());
    game.spawnDockShip(3, 21, 0x82);
    // #137 · el byte +0 del registro de objeto es 0x25; la capa de mundo del port guarda el
    // tile COMPLETO del banco alto, 0x125 `ShipNoSailsRight` (0x25 a secas es `Path6`).
    expect(shipObj(game)).toMatchObject({ x: 3, y: 21, tile: 0x25 + ACTOR_TILE_BANK, hull: 99, skiffs: 2, kind: "ship" });
    expect(game.activeMap.tileAt(3, 21)).toBe(0x25 + ACTOR_TILE_BANK); // overlay del tileAt compuesto
  });

  it("skiff (flags 0x40): tile 0x129, 0 skiffs a bordo", () => {
    const game = makeGame(makeState(), pawsWorld());
    game.spawnDockShip(5, 21, 0x40);
    expect(shipObj(game)).toMatchObject({ x: 5, y: 21, tile: 0x29 + ACTOR_TILE_BANK, hull: 99, skiffs: 0 });
  });

  it("⚠ NO ensucia slot0: a pie, state.shipHull/shipSkiffs quedan intactos", () => {
    // El casco/skiffs de la nave APARCADA viven en el OBJETO, no en slot0 (vehículo
    // activo). Comprar a pie no debe fijar shipHull/shipSkiffs. transport.md §6/§7.
    const game = makeGame(makeState({ shipHull: undefined, shipSkiffs: undefined }), pawsWorld());
    game.spawnDockShip(3, 21, 0x82);
    expect(game.state.shipHull).toBeUndefined();
    expect(game.state.shipSkiffs).toBeUndefined();
  });
});

describe("F1.5 · Board siembra slot0 desde el objeto y lo retira (0x07F6)", () => {
  it("aborda la nave del muelle: transport=ship, objeto retirado, hull/skiffs sembrados", () => {
    const game = makeGame(makeState(), pawsWorld());
    game.spawnDockShip(3, 21, 0x82); // party está en (3,21) = celda de la nave
    const events = game.board();
    expect(game.state.transport).toBe("ship");
    expect(game.state.transportTile).toBe(0x25);
    expect(game.state.shipHull).toBe(99);
    expect(game.state.shipSkiffs).toBe(2);
    expect(shipObj(game)).toBeUndefined(); // retirada del mundo (pasa a slot0)
    expect(events.some((e) => e.kind === "map-changed")).toBe(true);
  });

  it("⚠ nave DAÑADA: hull 50 en el objeto → shipHull 50 al abordar (aviso DANGER si <10)", () => {
    const game = makeGame(makeState(), pawsWorld());
    game.spawnDockShip(3, 21, 0x82);
    shipObj(game)!.hull = 50; // colisión previa la dejó a 50
    game.board();
    expect(game.state.shipHull).toBe(50); // slot0 tomó el hull del OBJETO, no el default 99
  });

  it("⚠ nave muy dañada (hull 5): al abordar sale el aviso DANGER", () => {
    const game = makeGame(makeState(), pawsWorld());
    game.spawnDockShip(3, 21, 0x82);
    shipObj(game)!.hull = 5;
    const events = game.board();
    const texts = events.filter((e) => e.kind === "message").map((e) => e.text ?? "");
    expect(texts.some((t) => t.includes("DANGER"))).toBe(true); // hull<10 leído del objeto
    expect(game.state.shipHull).toBe(5);
  });
});

describe("F1.5 · X-it re-atraca la nave con el hull/skiffs vivos (0x0EB4)", () => {
  it("desembarcar en tierra desde fragata re-crea el objeto-nave con el estado vivo", () => {
    const game = makeGame(makeState(), pawsWorld());
    game.state.transport = "ship";
    game.state.transportTile = 0x24; // fragata velas arriadas N
    game.state.shipHull = 40;
    game.state.shipSkiffs = 1;
    const events = game.exitVehicle();
    expect(shipObj(game)).toMatchObject({ x: 3, y: 21, hull: 40, skiffs: 1, kind: "ship" });
    expect(game.state.transport).toBe("foot");
    expect(game.state.transportTile).toBe(0x1c);
    expect(events.some((e) => e.kind === "map-changed")).toBe(true);
  });

  it("el tile aparcado preserva el facing de la fragata (velas arriadas 0x24-0x27)", () => {
    const game = makeGame(makeState(), pawsWorld());
    game.state.transport = "ship";
    game.state.transportTile = 0x26; // fragata velas arriadas S
    game.state.shipHull = 99;
    game.state.shipSkiffs = 2;
    game.exitVehicle();
    expect(shipObj(game)!.tile).toBe(0x26 + ACTOR_TILE_BANK); // facing preservado, banco alto (#137)
  });

  it("X-it de fragata a un SKIFF (sin tierra, rama 2) SÍ amarra la fragata, con N−1 esquifes", () => {
    // Este caso afirmaba «sólo la rama de TIERRA re-crea el objeto» — el modelo viejo del
    // port, REFUTADO por la derivación de #270 (re/notes/xit-esquife-270.md §1-§2): las
    // TRES ramas de cmd_xit (CMDS.OVL 0x0FAA tierra · 0x0FC1 esquife · 0x0FDD alfombra)
    // guardan el MISMO byte de fragata en [bp-2] y caen en la MISMA cola 0x0FF4 que emite
    // el objeto. Fix en c9f7e738 (#272, merge 556e3c93); la contabilidad §4: la rama del
    // esquife deja N−1 en la nave. La guarda dedicada vive en
    // xit-fragata-amarrada-270.test.ts; aquí queda el caso con el facing y el tile.
    const noLand = pawsWorld();
    // rodea al party de agua profunda (1 = no walkable) para forzar la rama sin tierra
    const t = noLand.smallMaps.get(PAWS)!.floors[0]!.tiles;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) t[y]![x] = 1;
    const game = makeGame(makeState(), noLand);
    game.state.transport = "ship";
    game.state.transportTile = 0x24;
    game.state.shipHull = 99;
    game.state.shipSkiffs = 2;
    game.exitVehicle();
    expect(shipObj(game)).toMatchObject({
      x: 3,
      y: 21,
      tile: 0x24 + ACTOR_TILE_BANK, // velas arriadas, facing intacto ([bp-2] sin tocar)
      hull: 99,
      skiffs: 1, // §4: el esquife botado se RESTA de la nave (0x0FC1: [bp-8] = N−1)
      kind: "ship",
    });
    expect(game.state.transportTile).toBe(0x28); // 0x24 + 4 = skiff
  });
});

describe("F1.5 · ciclo completo comprar→abordar→navegar→X-it→re-abordar", () => {
  it("el hull sobrevive daño de navegación y persiste tras aparcar/re-abordar", () => {
    const game = makeGame(makeState(), pawsWorld());
    // comprar
    game.spawnDockShip(3, 21, 0x82);
    // abordar
    game.board();
    expect(game.state.shipHull).toBe(99);
    // "navegar": simula una colisión que dejó el casco a 55
    game.state.shipHull = 55;
    game.state.shipSkiffs = 2;
    // X-it en tierra (aparca)
    game.exitVehicle();
    const parked = shipObj(game);
    expect(parked).toMatchObject({ hull: 55, skiffs: 2 });
    expect(game.state.transport).toBe("foot");
    // re-abordar: slot0 vuelve a tomar el hull vivo del objeto
    game.board();
    expect(game.state.shipHull).toBe(55); // daño de colisión conservado
    expect(game.state.shipSkiffs).toBe(2);
    expect(shipObj(game)).toBeUndefined();
  });
});

describe("F1.5 · persistencia de la nave aparcada (save/load)", () => {
  it("una nave aparcada sobrevive serialize/deserialize con hull/skiffs", () => {
    const game = makeGame(makeState(), pawsWorld());
    game.state.transport = "ship";
    game.state.transportTile = 0x24;
    game.state.shipHull = 40;
    game.state.shipSkiffs = 1;
    game.exitVehicle(); // aparca en (3,21)
    const reloaded = deserialize(serialize(game.state));
    const parked = reloaded.worldObjects?.find((o) => o.kind === "ship");
    expect(parked).toMatchObject({ x: 3, y: 21, hull: 40, skiffs: 1, kind: "ship" });
  });
});
