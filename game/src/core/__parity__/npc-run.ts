/**
 * Runner de paridad de NPC (Task 3.5). Reproduce en el core del clon el
 * movimiento de un NPC de small map (wander / big-wander / horario) partiendo de
 * un grid sintético y una semilla del RNG EXACTO del kernel, y emite la
 * trayectoria (posición turno a turno) más la semilla final. El lado modelo
 * (re/tools/npc_parity.py, KernelRng) predice el MISMO stream de rand y las
 * mismas casillas, de modo que trayectoria y semilla deben calcar.
 *
 * El wander (NPC.OVL:0x0C50) consume por turno: rand(0,255) [skip ~50% si bit3=0]
 * y, si se mueve, rand(0,64) [dir=(r&3)+1, span 65]. El RNG es el stream compartido, uno
 * por NpcManager, consumido en orden de slot.
 *
 * Entrada (argv[2], JSON):
 *   { seed, location, floor, hour,
 *     npc:{ slot, aiType, post:{x,y}, start:{x,y}, type? },
 *     player:{floor,x,y}?, walls:[[x,y],...]?, turns }
 * Salida (stdout, última línea):
 *   { positions:[[x,y],...], seedAfter }
 */
import type { GameState } from "../state.js";
import type { SmallMapLocation, WorldData } from "../world/map.js";
import { DoorManager } from "../world/doors.js";
import { NpcManager, type NpcSlot } from "../npc/manager.js";
import { OriginalRng } from "../rng-original.js";

declare const process: {
  argv: string[];
  stdout: { write(c: string): void };
  stderr: { write(c: string): void };
  exit(c?: number): never;
};

interface Input {
  seed: number;
  location: number;
  floor: number;
  hour: number;
  npc: {
    slot: number;
    aiType: number;
    post: { x: number; y: number };
    start: { x: number; y: number };
    type?: number;
  };
  // Horario completo opcional (paridad de schedule_index): sobreescribe el
  // horario simple derivado de post/start. x/y/z tienen 3 entradas, times 4.
  sched?: {
    aiTypes: [number, number, number];
    x: [number, number, number];
    y: [number, number, number];
    z: [number, number, number];
    times: [number, number, number, number];
  };
  player?: { floor: number; x: number; y: number };
  walls?: [number, number][];
  turns: number;
}

const SMALL = 32;
const FLOOR_TILE = 68; // suelo transitable
const WALL_TILE = 1; // muro no transitable

function buildWorld(input: Input): WorldData {
  const tiles: number[][] = [];
  for (let y = 0; y < SMALL; y++) {
    const row: number[] = [];
    for (let x = 0; x < SMALL; x++) row.push(FLOOR_TILE);
    tiles.push(row);
  }
  for (const [wx, wy] of input.walls ?? []) {
    if (tiles[wy]?.[wx] !== undefined) tiles[wy]![wx] = WALL_TILE;
  }
  const loc: SmallMapLocation = {
    id: input.location,
    name: "TEST",
    floors: [{ z: input.floor, tiles }],
  };
  return {
    overworld: [],
    underworld: [],
    smallMaps: new Map([[input.location, loc]]),
  };
}

function buildNpcData(input: Input): Record<number, NpcSlot[]> {
  const { slot, aiType, post, start, type } = input.npc;
  let s: NpcSlot;
  if (input.sched) {
    s = {
      slot,
      aiTypes: input.sched.aiTypes,
      x: input.sched.x,
      y: input.sched.y,
      z: input.sched.z,
      times: input.sched.times,
      type: type ?? 112, // persona por defecto (task #3: {1,14,27,30} son objetos, no NPCs)
      dialogNumber: 0,
    };
  } else {
    // Horario estable (scheduleIndex → 0 siempre): la posición 0 = start; el
    // wander mide su radio desde ese puesto.
    s = {
      slot,
      aiTypes: [aiType, aiType, aiType],
      x: [start.x, post.x, post.x],
      y: [start.y, post.y, post.y],
      z: [input.floor, input.floor, input.floor],
      times: [0, 0, 0, 0],
      type: type ?? 112, // persona por defecto (task #3: {1,14,27,30} son objetos, no NPCs)
      dialogNumber: 0,
    };
  }
  return { [input.location]: [s] };
}

function main(): void {
  const input = JSON.parse(process.argv[2] ?? "{}") as Input;
  const world = buildWorld(input);
  const npcData = buildNpcData(input);
  const rng = new OriginalRng(input.seed);
  const mgr = new NpcManager(npcData, rng);
  const doors = new DoorManager();

  const player = input.player ?? { floor: input.floor, x: 0, y: 0 };
  const state = {
    version: 1,
    position: { location: input.location, floor: player.floor, x: player.x, y: player.y },
    time: { year: 139, month: 1, day: 1, hour: input.hour, minute: 0 },
    turnsSinceStart: 0,
    npcDead: [],
  } as unknown as GameState;

  mgr.enterMap(input.location, state);
  const spawnNpc = mgr
    .npcsAt(input.location, input.floor)
    .find((n) => n.slot === input.npc.slot);
  const spawn: [number, number, number] = spawnNpc
    ? [spawnNpc.x, spawnNpc.y, spawnNpc.z]
    : [-1, -1, -1];

  const positions: [number, number][] = [];
  for (let t = 0; t < input.turns; t++) {
    state.turnsSinceStart++;
    mgr.tick(state, world, doors);
    const npc = mgr
      .npcsAt(input.location, input.floor)
      .find((n) => n.slot === input.npc.slot);
    if (npc) positions.push([npc.x, npc.y]);
    else positions.push([-1, -1]);
  }

  process.stdout.write(
    JSON.stringify({ spawn, positions, seedAfter: rng.getSeed() }) + "\n",
  );
}

main();
