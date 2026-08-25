/**
 * Runner de paridad (Task 0.4, extendido en Task 3.1): ejecuta un
 * escenario sobre el core determinista y vuelca los campos de estado
 * pedidos como JSON a stdout.
 *
 * Lo invoca re/tools/parity.py por subprocess (tsx) para comparar el clon
 * contra el binario original corriendo en dosbox-x (el oráculo). Recibe el
 * escenario como ÚNICO argumento CLI (JSON):
 *
 *   {
 *     "initial": {
 *       "time": {year,month,day,hour,minute},
 *       "prevHour"?, "food"?, "torches"?, "torchTurns"?,
 *       "position"?: {location,floor,x,y},
 *       "party"?: [{status,hp,maxHp,ring}],
 *       "rngSeed"?
 *     },
 *     "actions": [ {"op":"pass_turn","times"?},
 *                  {"op":"move","dir":"north|south|east|west","times"?},
 *                  {"op":"ignite"} ],
 *     "fields":  ["minute","food","x","y","torch_mins","party_hp",...]
 *   }
 *
 * (Compat Task 0.4: initial plano {year,...,minute} también se acepta.)
 *
 * Los movimientos usan los MAPAS REALES extraídos (game/assets); salir
 * por el borde de un pueblo aplica la transición al overworld en las
 * coordenadas de la location (misma regla que el original, sin prompt).
 *
 * Salida (stdout, una línea): JSON plano con los campos pedidos.
 * Errores: mensaje por stderr y exit code 1.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createNewGame, type ExtractedInitialState, type GameState } from "../state.js";
import type { GameTime } from "../time.js";
import { getActiveMap, type SmallMapLocation, type WorldData } from "../world/map.js";
import { advanceTurn, tryMove, type Direction } from "../world/movement.js";
import { igniteTorch, type RandFn } from "../world/survival.js";
import { OriginalRng } from "../rng-original.js";

declare const process: {
  argv: string[];
  stderr: { write(chunk: string): void };
  exit(code?: number): never;
};

interface ParityAction {
  op: string;
  times?: number;
  dir?: Direction;
  /** Solo lado DOSBox (tecla del prompt de salida); aquí se ignora. */
  confirm?: string;
  anchor?: string;
}

interface PartySeed {
  status: string;
  hp: number;
  maxHp: number;
  ring: number;
}

interface ParityInitial {
  time?: GameTime;
  prevHour?: number;
  food?: number;
  torches?: number;
  torchTurns?: number;
  position?: { location: number; floor: number; x: number; y: number };
  party?: PartySeed[];
  rngSeed?: number;
  turnsSinceStart?: number;
  // compat Task 0.4: reloj plano
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
}

interface ParityScenarioInput {
  initial: ParityInitial;
  actions: ParityAction[];
  fields: string[];
}

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), "../../../assets");
const readJson = <T>(p: string): T =>
  JSON.parse(readFileSync(`${ASSETS}/${p}`, "utf-8")) as T;

interface Loaded {
  world: WorldData;
  locationsX: number[];
  locationsY: number[];
}

let loaded: Loaded | null = null;
function loadWorld(): Loaded {
  if (loaded) return loaded;
  const smallMapsRaw = readJson<SmallMapLocation[]>("maps/smallmaps.json");
  const data = readJson<{ locationsX: number[]; locationsY: number[] }>("data.json");
  loaded = {
    world: {
      overworld: readJson("maps/overworld.json"),
      underworld: readJson("maps/underworld.json"),
      smallMaps: new Map(smallMapsRaw.map((l) => [l.id, l])),
    },
    locationsX: data.locationsX,
    locationsY: data.locationsY,
  };
  return loaded;
}

function makeState(input: ParityScenarioInput): GameState {
  const init = input.initial;
  const time: GameTime = init.time ?? {
    year: init.year!,
    month: init.month!,
    day: init.day!,
    hour: init.hour!,
    minute: init.minute!,
  };
  const base = readJson<ExtractedInitialState>("initial-state.json");
  const state = createNewGame(base);
  state.time = { ...time };
  state.prevHour = init.prevHour ?? time.hour;
  state.turnsSinceStart = init.turnsSinceStart ?? 0;
  if (init.food !== undefined) state.food = init.food;
  if (init.torches !== undefined) state.torches = init.torches;
  state.torchTurns = init.torchTurns ?? 0;
  if (init.position) state.position = { ...init.position };
  if (init.party) {
    state.partySize = init.party.length;
    for (let i = 0; i < init.party.length; i++) {
      const seed = init.party[i]!;
      const ch = state.characters[i];
      if (!ch) throw new Error(`initial.party[${i}] sin registro base`);
      ch.status = seed.status;
      ch.currentHp = seed.hp;
      ch.maxHp = seed.maxHp;
      ch.ring = seed.ring;
    }
  }
  return state;
}

function exitToOverworld(state: GameState, data: Loaded): void {
  const idx = state.position.location - 1;
  const x = data.locationsX[idx];
  const y = data.locationsY[idx];
  if (x === undefined || y === undefined) {
    throw new Error(`location ${state.position.location} sin coordenadas`);
  }
  state.position = { location: 0, floor: 0, x, y };
}

function applyAction(state: GameState, action: ParityAction, rand: RandFn): void {
  const times = action.times ?? 1;
  switch (action.op) {
    case "pass_turn": {
      for (let i = 0; i < times; i++) advanceTurn(state, undefined, rand);
      break;
    }
    case "move": {
      if (!action.dir) throw new Error("move sin dir");
      const data = loadWorld();
      for (let i = 0; i < times; i++) {
        const map = getActiveMap(
          data.world,
          state.position.location,
          state.position.floor,
        );
        const result = tryMove(state, map, action.dir, rand);
        if (result.exitedMap) exitToOverworld(state, data);
      }
      break;
    }
    case "ignite": {
      // El comando consume turno aunque no haya antorchas (el dispatcher
      // devuelve 1 por defecto; kernel-survival.md §3).
      igniteTorch(state, rand);
      advanceTurn(state, undefined, rand);
      break;
    }
    default:
      throw new Error(`acción desconocida: ${action.op}`);
  }
}

function extractField(state: GameState, fieldName: string): number | number[] {
  switch (fieldName) {
    case "year":
    case "month":
    case "day":
    case "hour":
    case "minute":
      return state.time[fieldName];
    case "prev_hour":
      return state.prevHour ?? state.time.hour;
    case "turnsSinceStart":
      return state.turnsSinceStart;
    case "food":
      return state.food;
    case "torches":
      return state.torches;
    case "torch_mins":
      return state.torchTurns;
    case "location":
      return state.position.location;
    case "floor":
      return state.position.floor;
    case "x":
      return state.position.x;
    case "y":
      return state.position.y;
    case "party_size":
      return state.partySize;
    case "party_hp":
      return state.characters.slice(0, state.partySize).map((c) => c.currentHp);
    default:
      throw new Error(`campo desconocido: ${fieldName}`);
  }
}

function main(): void {
  const raw = process.argv[2];
  if (!raw) throw new Error("uso: tsx run.ts '<escenario JSON>'");
  const scenario = JSON.parse(raw) as ParityScenarioInput;
  if (!scenario.initial?.time && scenario.initial?.year === undefined) {
    throw new Error("escenario sin initial.time");
  }

  const state = makeState(scenario);
  const rng = new OriginalRng(scenario.initial.rngSeed ?? 0);
  const rand: RandFn = (lo, hi) => rng.next(lo, hi);
  for (const action of scenario.actions ?? []) applyAction(state, action, rand);

  const out: Record<string, number | number[]> = {};
  for (const fieldName of scenario.fields ?? []) {
    out[fieldName] = extractField(state, fieldName);
  }
  console.log(JSON.stringify(out));
}

try {
  main();
} catch (err) {
  process.stderr.write(`parity-runner: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
}
