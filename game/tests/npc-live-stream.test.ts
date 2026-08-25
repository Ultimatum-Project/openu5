/**
 * #57 — El wander de NPCs consume el STREAM VIVO único del juego (liveRng), no un
 * OriginalRng paralelo. Y cae en su posición exacta del turno de pueblo:
 * DESPUÉS de housekeeping/post_turn, ANTES del 2º world_turn del npc_engine
 * (npc_tick_all TOWN 0x166E → wander NPC.OVL:0x0C50, mismo kernel rand 0x2092).
 *
 * Estrategia derivada (no observada): se reconstruye la secuencia del turno con
 * el MISMO código de producción (townTurn + NpcManager.tick) sobre una semilla
 * fija y se exige que el g_rng_seed final del Game calce con esa referencia. Un
 * stream paralelo (el bug) NO tocaría liveRng, así que el seed divergiría.
 */
import { describe, expect, it } from "vitest";
import { Game, type GameData, type GameSystems } from "../src/core/game.js";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { DoorManager } from "../src/core/world/doors.js";
import { OriginalRng } from "../src/core/rng-original.js";
import { townTurn } from "../src/core/world/loops/turn.js";

const TOWN = 2; // location de pueblo sintético
const FLOOR = 0;
const SMALL = 32;
const FLOOR_TILE = 68; // suelo transitable en todo el mapa (el wander nunca lo bloquea el borde)
const SEED = 1234;

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
    ring: 0xff, // sin Ring of Regeneration → housekeeping no tira el rand(0,7) del anillo
    amulet: 0xff,
    partyStatus: 0,
    ...over,
  };
}

function makeState(): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar(), makeChar({ name: "Iolo" })],
    partySize: 2,
    activeCharacter: 0,
    food: 100,
    // Hora 8, minuto 0: +1 min no cruza medianoche → advanceClock sin rand de re-roll SL.
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 0 },
    prevHour: 8,
    turnsSinceStart: 0,
    // Party en (1,1); los NPC wandering viven en el centro, lejos del party.
    position: { location: TOWN, floor: FLOOR, x: 1, y: 1 },
    transport: "foot",
    torchTurns: 0,
    torches: 2,
    wind: 0,
    windDriftCtr: 0,
    openDoors: [],
    npcDead: [],
    npcMet: [],
  };
  return base as GameState;
}

function makeWorld(): WorldData {
  const tiles: number[][] = [];
  for (let y = 0; y < SMALL; y++) {
    const row: number[] = [];
    for (let x = 0; x < SMALL; x++) row.push(FLOOR_TILE);
    tiles.push(row);
  }
  const loc: SmallMapLocation = { id: TOWN, name: "TEST", floors: [{ z: FLOOR, tiles }] };
  return { overworld: [], underworld: [], smallMaps: new Map([[TOWN, loc]]) };
}

/** Dos NPC WANDER (aiType 1) en el centro de la planta del jugador. */
function makeNpcData(): Record<number, NpcSlot[]> {
  const wander = (slot: number, x: number, y: number): NpcSlot => ({
    slot,
    aiTypes: [1, 1, 1], // WANDER en todo horario
    x: [x, x, x],
    y: [y, y, y],
    z: [FLOOR, FLOOR, FLOOR],
    times: [0, 0, 0, 0], // scheduleIndex → 0 estable
    type: 112, // sprite de PERSONA (guardia): NO un tile-objeto (task #3 saca los
    // slots-objeto {1,14,27,30} de NpcManager → un type-objeto no wandering aquí)
    dialogNumber: 0,
  });
  return { [TOWN]: [wander(1, 15, 15), wander(2, 18, 18)] };
}

const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };

function makeGame(): Game {
  const systems: GameSystems = {
    npcManager: new NpcManager(makeNpcData()),
    doors: new DoorManager(),
  };
  return new Game({} as ExtractedInitialState, makeWorld(), gameData, makeState(), systems);
}

/**
 * Replica derivada de UN turno de pueblo: townTurn (viento→reloj→post_turn→
 * housekeeping) con el wander en el hook afterHousekeeping y el 2º world_turn.
 * Devuelve el g_rng_seed final. Si `withWander` es false, el hook es no-op
 * (esqueleto del turno SIN consumir el wander) — el estado del bug.
 */
function referenceSeed(withWander: boolean): number {
  const rng = new OriginalRng(SEED);
  const rand = (lo: number, hi: number): number => rng.next(lo, hi);
  const world = makeWorld();
  const state = makeState();
  const doors = new DoorManager();
  const mgr = new NpcManager(makeNpcData(), rng);
  mgr.enterMap(TOWN, state);
  townTurn(state, rand, {
    consumesTurn: true,
    secondWorldTurn: mgr.npcsAt(TOWN, FLOOR).length > 0,
    afterHousekeeping: withWander ? () => mgr.tick(state, world, doors) : undefined,
  });
  return rng.getSeed();
}

describe("#57 — wander de NPCs sobre el stream vivo", () => {
  it("el g_rng_seed tras un turno de pueblo es el DERIVADO (townTurn + wander en orden)", () => {
    const game = makeGame();
    game.reseed(SEED);
    game.confirmTownExit(false); // TOWN 0x15D4: 1 min consumido (townTurn + wander)
    expect(game.liveSeed()).toBe(referenceSeed(true));
  });

  it("el wander SÍ avanza liveRng (stream compartido, no paralelo)", () => {
    const game = makeGame();
    game.reseed(SEED);
    game.confirmTownExit(false);
    // Con dos NPC wandering en la planta, npc_tick_all consume ≥2 rand del stream
    // vivo: el seed final NO puede coincidir con el esqueleto sin wander.
    expect(game.liveSeed()).not.toBe(referenceSeed(false));
  });

  it("las posiciones de los NPC tras el turno son las derivadas del stream vivo", () => {
    const game = makeGame();
    game.reseed(SEED);
    game.confirmTownExit(false);

    // Referencia: mismo turno con el wander sobre la misma semilla.
    const rng = new OriginalRng(SEED);
    const rand = (lo: number, hi: number): number => rng.next(lo, hi);
    const world = makeWorld();
    const state = makeState();
    const doors = new DoorManager();
    const mgr = new NpcManager(makeNpcData(), rng);
    mgr.enterMap(TOWN, state);
    townTurn(state, rand, {
      consumesTurn: true,
      secondWorldTurn: mgr.npcsAt(TOWN, FLOOR).length > 0,
      afterHousekeeping: () => mgr.tick(state, world, doors),
    });

    const got = game
      .npcManager!.npcsAt(TOWN, FLOOR)
      .map((n) => [n.slot, n.x, n.y])
      .sort();
    const want = mgr
      .npcsAt(TOWN, FLOOR)
      .map((n) => [n.slot, n.x, n.y])
      .sort();
    expect(got).toEqual(want);
  });
});
