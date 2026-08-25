/**
 * guard_wander en vivo (T1-T3, F.2) — TOWN 0x0C78 cableado en el PASO 5 del turno
 * de pueblo (@0x165F), ANTES de npc_tick_all (0x166E), sobre el liveRng compartido.
 *
 * Estrategia (misma que npc-live-stream.test.ts): se reconstruye el turno con el
 * MISMO código de producción sobre una semilla fija y se exige que el consumo de
 * rand + las posiciones calquen la referencia derivada del MOTOR PURO `guardWander`.
 * El foco es el ORDEN DE RANDS: por guardia (orden de slot) 1 rand si no actúa /
 * 3 si actúa, guardias ANTES que NPCs.
 */
import { describe, expect, it } from "vitest";
import { Game, type GameData, type GameSystems } from "../src/core/game.js";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { DoorManager } from "../src/core/world/doors.js";
import { OriginalRng } from "../src/core/rng-original.js";
import { townTurn } from "../src/core/world/loops/turn.js";
import { guardWander, type GuardState } from "../src/core/world/loops/guards.js";

const TOWN = 2;
const FLOOR = 0;
const SMALL = 32;
const FLOOR_TILE = 68; // transitable en todo el mapa; sin tiles 0xA2/0x43 (neighborBlocks=false)
const SEED = 4242;

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20, currentMp: 10, currentHp: 50, maxHp: 60,
    exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  };
}

function makeState(): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar(), makeChar({ name: "Iolo" })],
    partySize: 2, activeCharacter: 0, food: 100,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 0 },
    prevHour: 8, turnsSinceStart: 0,
    position: { location: TOWN, floor: FLOOR, x: 1, y: 1 }, // party lejos de los guardias
    transport: "foot", torchTurns: 0, torches: 2, wind: 0, windDriftCtr: 0,
    openDoors: [], npcDead: [], npcMet: [],
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

/** Un slot-guardia FIXED (aiType 0): type 16/17 = tile 0x10/0x11 (`&0xFE==0x10`). */
function guard(slot: number, type: 16 | 17, x: number, y: number): NpcSlot {
  return {
    slot, aiTypes: [0, 0, 0], x: [x, x, x], y: [y, y, y], z: [FLOOR, FLOOR, FLOOR],
    times: [0, 0, 0, 0], type, dialogNumber: 0,
  };
}
/** Un NPC WANDER (aiType 1), persona (sprite type 112). */
function wanderer(slot: number, x: number, y: number): NpcSlot {
  return {
    slot, aiTypes: [1, 1, 1], x: [x, x, x], y: [y, y, y], z: [FLOOR, FLOOR, FLOOR],
    times: [0, 0, 0, 0], type: 112, dialogNumber: 0,
  };
}

// 3 guardias en slots 5/2/9 (desordenados a propósito) + 1 no-guardia en su planta.
function makeNpcData(): Record<number, NpcSlot[]> {
  return {
    [TOWN]: [
      guard(5, 16, 15, 15),
      guard(2, 17, 20, 10),
      guard(9, 16, 8, 22),
    ],
  };
}

const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
function makeGame(npcData: Record<number, NpcSlot[]>): Game {
  const systems: GameSystems = { npcManager: new NpcManager(npcData), doors: new DoorManager() };
  return new Game({} as ExtractedInitialState, makeWorld(), gameData, makeState(), systems);
}

describe("T1 — guardsOnFloor: selección + orden de slot", () => {
  it("aísla los actores tile 0x10/0x11 de la planta, en orden de slot ascendente", () => {
    const mgr = new NpcManager(makeNpcData());
    mgr.enterMap(TOWN, makeState());
    const g = mgr.guardsOnFloor(TOWN, FLOOR);
    expect(g.map((n) => n.slot)).toEqual([2, 5, 9]); // orden de slot, no de inserción
    expect(g.every((n) => (n.type & 0xfe) === 0x10)).toBe(true);
  });

  it("excluye guardias de otra planta y NPCs normales", () => {
    const data = { [TOWN]: [guard(1, 16, 15, 15), wanderer(2, 16, 16)] };
    const st = makeState();
    const mgr = new NpcManager(data);
    mgr.enterMap(TOWN, st);
    expect(mgr.guardsOnFloor(TOWN, FLOOR).map((n) => n.slot)).toEqual([1]); // el wanderer no
    expect(mgr.guardsOnFloor(TOWN, 1)).toEqual([]); // otra planta
  });
});

describe("T3 — tickGuards calca el motor puro guardWander (orden de rands + posiciones)", () => {
  it("consume el mismo stream y deja las mismas posiciones que guardWander sobre la misma semilla", () => {
    const rng = new OriginalRng(SEED);
    const mgr = new NpcManager(makeNpcData(), rng);
    const state = makeState();
    const world = makeWorld();
    mgr.enterMap(TOWN, state);
    mgr.tickGuards(state, world, new DoorManager());

    // Referencia: motor puro sobre una semilla gemela, mismos guardias en ORDEN DE SLOT,
    // predicados equivalentes al mapa (todo transitable, sin 0xA2/0x43, party lejos →
    // destino sólo acotado por bounds).
    const ref = new OriginalRng(SEED);
    const refRand = (lo: number, hi: number): number => ref.next(lo, hi);
    const refGuards: GuardState[] = [
      { x: 20, y: 10, tile: 17 }, // slot 2
      { x: 15, y: 15, tile: 16 }, // slot 5
      { x: 8, y: 22, tile: 16 }, // slot 9
    ];
    guardWander(refRand, refGuards, () => false, (x, y) => x < 0 || y < 0 || x >= SMALL || y >= SMALL);

    // Mismo g_rng_seed final ⇒ mismo NÚMERO y ORDEN de rands consumidos.
    expect(rng.getSeed()).toBe(ref.getSeed());
    // Mismas posiciones/facing por slot.
    const got = mgr.guardsOnFloor(TOWN, FLOOR).map((n) => [n.x, n.y, n.type]);
    expect(got).toEqual(refGuards.map((g) => [g.x, g.y, g.tile]));
  });

  it("es determinista y NO consume rand si no hay guardias en la planta", () => {
    const rng = new OriginalRng(SEED);
    const mgr = new NpcManager({ [TOWN]: [wanderer(1, 16, 16)] }, rng);
    const state = makeState();
    mgr.enterMap(TOWN, state);
    mgr.tickGuards(state, makeWorld(), new DoorManager());
    expect(rng.getSeed()).toBe(new OriginalRng(SEED).getSeed()); // intacto
  });
});

describe("T3 — integración: guard_wander en el turno de pueblo vivo (antes de npc_tick_all)", () => {
  it("el g_rng_seed tras un turno es el DERIVADO (townTurn + guardias→NPCs en orden)", () => {
    const game = makeGame(makeNpcData());
    game.reseed(SEED);
    game.confirmTownExit(false); // consume 1 turno de pueblo

    // Referencia: mismo turno, hook = tickGuards ANTES de tick (el orden 0x165F→0x166E).
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
      afterHousekeeping: () => {
        mgr.tickGuards(state, world, doors);
        mgr.tick(state, world, doors);
      },
    });
    expect(game.liveSeed()).toBe(rng.getSeed());
  });

  it("los guardias SÍ consumen el stream vivo (seed != esqueleto sin guard_wander)", () => {
    const withGuards = makeGame(makeNpcData());
    withGuards.reseed(SEED);
    withGuards.confirmTownExit(false);

    // Esqueleto: mismo turno pero SIN guardias en los datos (guard_wander no consume nada).
    const skeleton = makeGame({ [TOWN]: [] });
    skeleton.reseed(SEED);
    skeleton.confirmTownExit(false);

    expect(withGuards.liveSeed()).not.toBe(skeleton.liveSeed());
  });
});

describe("T4 — un guardia CON horario es DOBLE-PROCESADO (witness confirmó solapamiento FIEL)", () => {
  // witness-guard-wander-overlap.md: el binario mueve al guardia aiType-1 en-planta por AMBOS
  // motores en el mismo turno — guard_wander (0x165F) Y npc_tick_all (0x166E), cada uno con su
  // RNG, en ese orden. El port NO excluye los type 16/17 del tick: replica el doble consumo.
  const iolo = (): Record<number, NpcSlot[]> => ({
    [TOWN]: [wanderer(1, 15, 15)].map((n) => ({ ...n, type: 17 })), // aiType 1 PERO tile-guardia 0x11
  });

  it("guard_wander y npc_tick_all consumen AMBOS del stream por el mismo guardia, en orden", () => {
    const rng = new OriginalRng(SEED);
    const mgr = new NpcManager(iolo(), rng);
    const state = makeState();
    const world = makeWorld();
    const doors = new DoorManager();
    mgr.enterMap(TOWN, state);

    const s0 = rng.getSeed();
    mgr.tickGuards(state, world, doors); // PASO 5 — guard_wander 0x165F
    const s1 = rng.getSeed();
    mgr.tick(state, world, doors); //        PASO 5b — npc_tick_all 0x166E
    const s2 = rng.getSeed();

    expect(s1).not.toBe(s0); // guard_wander consumió RNG por el guardia (scan 0x5C5A tile 0x11)
    expect(s2).not.toBe(s1); // npc_tick_all consumió TAMBIÉN por el MISMO guardia (aiType 1 wander)
  });

  it("el guardia entra a la vez en guardsOnFloor (tile) y en el tick de NPC (aiType wander)", () => {
    const mgr = new NpcManager(iolo(), new OriginalRng(SEED));
    mgr.enterMap(TOWN, makeState());
    // Es guardia (tile 0x11) para guard_wander …
    expect(mgr.guardsOnFloor(TOWN, FLOOR).map((n) => n.slot)).toEqual([1]);
    // … y sigue en la lista de NPCs (aiType 1) para npc_tick_all — no se excluye (fiel).
    expect(mgr.npcsAt(TOWN, FLOOR).map((n) => n.slot)).toContain(1);
  });
});
