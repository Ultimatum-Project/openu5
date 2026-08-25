/**
 * Fase 1.5 · Capa de objetos del mundo (g_world_objects 0x5C5A). Un objeto estacionario
 * (cofre/antorcha/nave) se overlaya en el tileAt compuesto POR ENCIMA de mapOverrides →
 * render + bloqueo de paso gratis. La lista vive en GameState (persiste en el save, como
 * overworldEnemies tras fix #49). 0 RNG. Citas: .superpowers/sdd/scout-objects.md,
 * re/notes/transport.md §6.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState, WorldObject } from "../src/core/state.js";
import { deserialize, serialize } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import { tileInfo } from "../src/core/tiles.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";

const PAWS = 0x16;
const CHEST_TILE = 0x40;

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

const chestObj = (x: number, y: number): WorldObject => ({
  location: PAWS, floor: 0, x, y, tile: CHEST_TILE, kind: "chest", contents: 0x20, trapped: false,
});

describe("F1.5 · overlay de objetos del mundo", () => {
  it("un objeto tapa el tile base en tileAt", () => {
    const s = makeState({ worldObjects: [chestObj(4, 22)] });
    const game = makeGame(s, pawsWorld());
    expect(game.activeMap.tileAt(4, 22)).toBe(CHEST_TILE); // objeto
    expect(game.activeMap.tileAt(5, 22)).toBe(5);          // base (hierba)
  });

  it("el objeto gana a un mapOverride de la misma celda", () => {
    const s = makeState({
      worldObjects: [chestObj(4, 22)],
      mapOverrides: { [`${PAWS}:0:4:22`]: 44 }, // arado (permanente)
    });
    const game = makeGame(s, pawsWorld());
    expect(game.activeMap.tileAt(4, 22)).toBe(CHEST_TILE); // objeto POR ENCIMA
  });

  it("un objeto de OTRA location/floor no aparece", () => {
    const s = makeState({ worldObjects: [{ ...chestObj(4, 22), location: 0x1f }] });
    const game = makeGame(s, pawsWorld());
    expect(game.activeMap.tileAt(4, 22)).toBe(5); // base: el objeto es de Empath
  });

  it("worldObjects persiste round-trip (serialize→deserialize)", () => {
    const s = makeState({ worldObjects: [chestObj(4, 22)] });
    const restored = deserialize(serialize(s));
    expect(restored.worldObjects).toEqual([chestObj(4, 22)]);
  });

  it("un save viejo sin worldObjects deserializa a lista vacía (o undefined normalizado)", () => {
    const s = makeState();
    delete (s as { worldObjects?: unknown }).worldObjects;
    const restored = deserialize(serialize(s));
    expect(restored.worldObjects ?? []).toEqual([]);
  });
});

/**
 * #195 · El Shadowlord convocado se pinta del BANCO DE MÓVILES (`tile | 0x100`).
 *
 * El byte de ranura del binario es 0xFC (TOWN 0x3a1) y el blit de celda le suma 0x100
 * (`FONT.OVL 0x02a2`, el `ah+=1` de 0x02e3) ⇒ sprite 0x1FC. El tile BASE 0xFC es
 * `Bellows1`: sin el `+0x100` la Llama de la Verdad enseñaba un fuelle dorado donde
 * debía estar Faulinei, que es justo lo que el usuario reportó en `partida-faulinei`.
 */
const SHADOWLORD_SLOT_BYTE = 0xfc; // = ritual.ts SHADOWLORD_TILE (centinela del gate)
const shadowlordObj = (x: number, y: number): WorldObject => ({
  location: PAWS, floor: 0, x, y, tile: SHADOWLORD_SLOT_BYTE, kind: "shadowlord",
});

describe("#195 · el Shadowlord se pinta del banco de móviles, no del banco base", () => {
  it("tileAt devuelve 0x1FC (ShadowLord1), no el 0xFC de Bellows1", () => {
    const s = makeState({ worldObjects: [shadowlordObj(4, 22)] });
    const game = makeGame(s, pawsWorld());
    // MUTANTE 1 — revertir a `obj.tile` pelado devuelve 252 y mata este aserto.
    expect(game.activeMap.tileAt(4, 22), "FONT 0x02a2/0x02e3: sprite = tile | 0x100").toBe(0x1fc);
    expect(tileInfo(0x1fc)?.name, "el 0x1FC del atlas es el Shadowlord").toBe("ShadowLord1");
    expect(tileInfo(SHADOWLORD_SLOT_BYTE)?.name, "y el 0xFC pelado era el fuelle").toBe("Bellows1");
  });

  it("el +0x100 es SÓLO del Shadowlord: el resto de la capa sigue crudo", () => {
    const s = makeState({ worldObjects: [chestObj(4, 22)] });
    const game = makeGame(s, pawsWorld());
    // MUTANTE 2 — sumar 0x100 a TODA la capa (cofres, antorchas, naves atracadas)
    // rompería el render de todo el mobiliario; este aserto lo mata.
    expect(game.activeMap.tileAt(4, 22), "el cofre NO va al banco alto").toBe(CHEST_TILE);
  });

  it("el DATO sigue siendo 0xFC: el centinela que leen el gate del ritual y sus predicados", () => {
    const s = makeState({ worldObjects: [shadowlordObj(4, 22)] });
    const game = makeGame(s, pawsWorld());
    game.activeMap.tileAt(4, 22); // pintar no muta
    // Si alguien «arregla» el sprite cambiando el DATO a 0x1FC, el gate del ritual
    // (`endgame/use-tools.ts:72` `tileAbove === SHADOWLORD_TILE`), `shadowlordPresentAt`,
    // `removeShadowlordAt` y `shadowlordPresentInMap` dejan de casar y el ritual muere.
    expect(s.worldObjects?.[0]?.tile).toBe(SHADOWLORD_SLOT_BYTE);
  });

  it("la passability NO cambia con el fix: 0xFC y 0x1FC son ambos infranqueables", () => {
    // La capa de objetos alimenta TAMBIÉN el paso (comentario de `game.ts` tileAt), así
    // que cambiar el tile devuelto sólo es inocuo si los dos tienen el mismo perfil.
    for (const t of [SHADOWLORD_SLOT_BYTE, 0x1fc]) {
      expect(tileInfo(t)?.walkable, `tile ${t} walkable`).toBe(false);
      expect(tileInfo(t)?.landEnemyPassable, `tile ${t} landEnemyPassable`).toBe(false);
    }
  });
});
