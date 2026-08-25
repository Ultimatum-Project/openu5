/**
 * Runner de paridad de los BUCLES de contexto (Task 3.13): reproduce el core
 * del clon (world/loops/*.ts con OriginalRng) para cruzarlo contra el modelo
 * asm-derivado en Python (re/tools/loops_parity.py). Mismo patrón que
 * transport-run.ts / npc-run.ts.
 *
 * Escenario JSON como único argumento CLI, con `kind`:
 *   "outdoor": {seed, tile, floor, hour, members, ticks}
 *       → {trace:[{site,lo,hi,value}...], seedAfter}   (viento→housekeeping→spawn)
 *   "town":    {seed, hour, members, ticks, secondWorldTurn?}
 *       → {trace, seedAfter}
 *   "spawnThreshold": {cases:[{tile,floor,hour}...]}
 *       → {thresholds:[...]}
 *   "guard":   {seed, guards:[{x,y,tile}...], steps}
 *       → {rands, positions:[[x,y]...], seedAfter}
 *   "bridge":  {seed, members:[{dex,str,status}...]}
 *       → {fired, onFoot, dexRolls, payerIndex, toll, seedAfter}
 *
 * Salida: una línea JSON a stdout. Errores por stderr, exit 1.
 */
import { OriginalRng } from "../rng-original.js";
import type { CharacterState, GameState } from "../state.js";
import { maybeChangeWind } from "../world/wind.js";
import { spawnThreshold } from "../world/loops/spawn.js";
import { bridgeTrollAmbush } from "../world/loops/hazards.js";
import { guardWander } from "../world/loops/guards.js";
import { outdoorTurn, townTurn, type RngTraceEntry } from "../world/loops/turn.js";
import { tileToMonsterId } from "../combat/encounters.js";

declare const process: {
  argv: string[];
  stderr: { write(chunk: string): void };
  exit(code?: number): never;
};

function stubChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "P",
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

interface Member {
  dex?: number;
  str?: number;
  status?: string;
}

function stubState(members: Member[], loc: number, floor: number, hour: number): GameState {
  const characters = members.map((m) =>
    stubChar({ dexterity: m.dex ?? 20, strength: m.str ?? 20, status: m.status ?? "G" }),
  );
  return {
    characters,
    partySize: characters.length,
    food: 100,
    time: { year: 139, month: 4, day: 7, hour, minute: 0 },
    turnsSinceStart: 0,
    position: { location: loc, floor, x: 100, y: 100 },
    transport: "foot",
    torchTurns: 0,
    prevHour: hour,
  } as GameState;
}

function runOutdoor(spec: {
  seed: number;
  tile: number;
  floor: number;
  hour: number;
  members: Member[];
  ticks: number;
  onSwamp?: boolean;
  onBridge?: boolean;
}): unknown {
  const rng = new OriginalRng(spec.seed);
  const rand = (lo: number, hi: number) => rng.next(lo, hi);
  const st = stubState(spec.members, 0, spec.floor, spec.hour);
  const trace: RngTraceEntry[] = [];
  for (let i = 0; i < spec.ticks; i++) {
    const r = outdoorTurn(st, rand, {
      tileUnderParty: spec.tile,
      onSwamp: spec.onSwamp,
      onBridge: spec.onBridge,
    });
    trace.push(...r.trace);
  }
  return { trace, seedAfter: rng.getSeed() };
}

function runTown(spec: {
  seed: number;
  hour: number;
  members: Member[];
  ticks: number;
  secondWorldTurn?: boolean;
  confused?: boolean;
  damageTile?: boolean;
  onSwampTile?: boolean;
}): unknown {
  const rng = new OriginalRng(spec.seed);
  const rand = (lo: number, hi: number) => rng.next(lo, hi);
  const st = stubState(spec.members, 6, 0, spec.hour);
  const trace: RngTraceEntry[] = [];
  for (let i = 0; i < spec.ticks; i++) {
    const r = townTurn(st, rand, {
      consumesTurn: true,
      secondWorldTurn: spec.secondWorldTurn,
      confused: spec.confused,
      damageTile: spec.damageTile,
      onSwampTile: spec.onSwampTile,
    });
    trace.push(...r.trace);
  }
  return { trace, seedAfter: rng.getSeed() };
}

function runSpawnThreshold(spec: {
  cases: { tile: number; floor: number; hour: number }[];
}): unknown {
  return { thresholds: spec.cases.map((c) => spawnThreshold(c.tile, c.floor, c.hour)) };
}

function runGuard(spec: {
  seed: number;
  guards: { x: number; y: number; tile: number }[];
  steps: number;
}): unknown {
  const rng = new OriginalRng(spec.seed);
  const rand = (lo: number, hi: number) => rng.next(lo, hi);
  const guards = spec.guards.map((g) => ({ ...g }));
  let rands = 0;
  for (let s = 0; s < spec.steps; s++) rands += guardWander(rand, guards, () => false);
  return {
    rands,
    positions: guards.map((g) => [g.x, g.y]),
    seedAfter: rng.getSeed(),
  };
}

function runSpawnPick(spec: {
  seed: number;
  tile: number;
  floor: number;
  count: number;
}): unknown {
  // Fix B (#19): cruza el picker fiel (tile_to_monster 0x0E4E + weighted_pick
  // 0x0E04) contra el modelo asm de Python. `rand` registra cada draw en la traza.
  const rng = new OriginalRng(spec.seed);
  const trace: RngTraceEntry[] = [];
  const rand = (lo: number, hi: number): number => {
    const v = rng.next(lo, hi);
    const site = hi === 0xff ? "pick" : hi === 0x40 ? "gate" : hi === 7 ? "whirl" : hi === 3 ? "sand" : "misc";
    trace.push({ site, lo, hi, value: v });
    return v;
  };
  const ids: number[] = [];
  for (let i = 0; i < spec.count; i++) ids.push(tileToMonsterId(spec.tile, spec.floor, rand));
  return { trace, ids, seedAfter: rng.getSeed() };
}

function runBridge(spec: { seed: number; members: Member[] }): unknown {
  const rng = new OriginalRng(spec.seed);
  const rand = (lo: number, hi: number) => rng.next(lo, hi);
  const st = stubState(spec.members, 0, 0, 12);
  // El tick de viento interno (0x1C0B) va entre el gate y las tiradas de DEX.
  const r = bridgeTrollAmbush(st, rand, () => {
    if (st.timeSpell !== "T") maybeChangeWind(st, rand);
  });
  return {
    fired: r.fired,
    onFoot: r.onFoot,
    dexRolls: r.dexRolls,
    payerIndex: r.payerIndex,
    toll: r.toll,
    seedAfter: rng.getSeed(),
  };
}

function main(): void {
  const arg = process.argv[2];
  if (!arg) {
    process.stderr.write("uso: loops-run.ts <scenario.json>\n");
    process.exit(1);
  }
  const spec = JSON.parse(arg) as { kind: string } & Record<string, unknown>;
  let out: unknown;
  switch (spec.kind) {
    case "outdoor":
      out = runOutdoor(spec as never);
      break;
    case "town":
      out = runTown(spec as never);
      break;
    case "spawnThreshold":
      out = runSpawnThreshold(spec as never);
      break;
    case "spawnPick":
      out = runSpawnPick(spec as never);
      break;
    case "guard":
      out = runGuard(spec as never);
      break;
    case "bridge":
      out = runBridge(spec as never);
      break;
    default:
      process.stderr.write(`kind desconocido: ${spec.kind}\n`);
      process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(out));
}

main();
