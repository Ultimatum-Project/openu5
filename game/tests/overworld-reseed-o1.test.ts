/**
 * Witness O1 — HUECO 1: la pool de monstruos errantes del overworld NO sobrevive una visita a
 * un interior. El binario hace `memset` de la tabla de objetos al entrar a una localización
 * (MAINOUT.OVL 0x0857; re/notes/witness-o1-0x6b4.md §3), así que el port la VACÍA al entrar a
 * un pueblo (loadSmallMap) o mazmorra (enterDungeon). Antes el port RESTAURABA los mismos
 * monstruos al volver al overworld (divergencia del sidecar). Al volver, el spawn los reseed-ea.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapFloor, SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { OverworldEnemies } from "../src/core/world/enemies.js";

const TOWN_LOC = 17; // idx 16 en locationsX/Y → id 1-based 17
const TOWN_TILE = 0x10; // tile enterable (ENTERABLE_TILES) del overworld
const PX = 50;
const PY = 50;

function makeChar(): CharacterState {
  return {
    name: "Avatar", gender: 0x0b, class: "A", status: "G", strength: 20, dexterity: 20,
    intelligence: 20, currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2,
    monthsAtInn: 0, helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff,
    amulet: 0xff, partyStatus: 0,
  };
}

function makeState(): GameState {
  return {
    characters: [makeChar()],
    partySize: 1,
    activeCharacter: 0,
    food: 100,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: PX, y: PY }, // OVERWORLD, sobre el tile del pueblo
    transport: "foot",
    torchTurns: 0,
    torches: 2,
    prevHour: 8,
  } as GameState;
}

function makeFloor(z: number): SmallMapFloor {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 0x44));
  return { z, tiles };
}

function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  overworld[PY]![PX] = TOWN_TILE; // el tile bajo la party es enterable
  const town: SmallMapLocation = { id: TOWN_LOC, name: "TestTown", floors: [makeFloor(0)] };
  return { overworld, underworld: overworld, smallMaps: new Map([[TOWN_LOC, town]]) };
}

// locationAt(PX,PY) debe devolver TOWN_LOC (=idx+1 → idx 16). El resto de coords ≠ (PX,PY).
const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, (_, i) => (i === TOWN_LOC - 1 ? PX : 250)),
  locationsY: Array.from({ length: 32 }, (_, i) => (i === TOWN_LOC - 1 ? PY : 250)),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

describe("witness O1 §3 — reseed: entrar a un interior VACÍA la pool de overworld", () => {
  it("(E)nter a un pueblo desde el overworld limpia overworldEnemies", () => {
    const game = new Game({} as never, makeWorld(), gameData, makeState());
    // Pool con monstruos vivos en el overworld.
    game.overworldEnemies.enemies.push(
      { defIndex: 4, tile: 0x94, water: false, x: 60, y: 60 },
      { defIndex: 8, tile: 0x2c, water: true, x: 61, y: 61, hull: 40 },
    );
    expect(game.overworldEnemies.enemies.length).toBe(2);
    game.enter();
    // Entró al pueblo…
    expect(game.state.position.location).toBe(TOWN_LOC);
    // …y la pool overworld quedó vacía (memset del binario).
    expect(game.overworldEnemies.enemies).toEqual([]);
    expect(game.state.overworldEnemies).toEqual([]);
  });

  it("OverworldEnemies.clear() vacía el estado vinculado (mecanismo)", () => {
    const st = makeState();
    const oe = new OverworldEnemies();
    oe.bind(st);
    oe.enemies.push({ defIndex: 4, tile: 0x94, water: false, x: 1, y: 2 });
    expect(st.overworldEnemies).toHaveLength(1);
    oe.clear();
    expect(st.overworldEnemies).toEqual([]);
  });
});
