/**
 * Runner de paridad de MAZMORRA (Task 3.4). Reproduce en el core del clon un
 * evento de mazmorra (paso sobre trampa/campo/foso, beber en fuente, klimb)
 * partiendo de un grid sintético y una semilla del RNG EXACTO del kernel, y
 * emite el ESTADO observable resultante (HP/estado de cada PJ, posición, planta,
 * semilla final y eventos). El lado DOSBox siembra el mismo grid + semilla y lee
 * los mismos globales, de modo que el stream de rand y el estado deben calcar.
 *
 * Entrada (argv[2], JSON):
 *   { seed, roster:[{dex,hp,maxHp,status}], activeCharacter?,
 *     pos:{dungeon,floor,x,y,facing}, cells:[{floor,x,y,type,sub}],
 *     action:"forward"|"back"|"left"|"right"|"klimb"|"drink"|"open"|"search"|"get",
 *     klimbDir?:"up"|"down" }
 * Salida (stdout, última línea):
 *   { pos, floor, seedAfter, party:[{hp,maxHp,status,dex}], events, messages }
 */
import type { CharacterState, GameState } from "../state.js";
import { OriginalRng } from "../rng-original.js";
import {
  DungeonState,
  type DungeonCell,
  type DungeonData,
  type DungeonEvent,
  type Facing,
} from "../dungeon/dungeon.js";

declare const process: {
  argv: string[];
  stdout: { write(c: string): void };
  stderr: { write(c: string): void };
  exit(c?: number): never;
};

interface RosterIn {
  dex?: number;
  hp?: number;
  maxHp?: number;
  status?: string;
}

interface CellIn {
  floor: number;
  x: number;
  y: number;
  type: number;
  sub: number;
}

interface Input {
  seed: number;
  roster: RosterIn[];
  activeCharacter?: number;
  torchTurns?: number;
  pos: { dungeon: number; floor: number; x: number; y: number; facing: Facing };
  cells?: CellIn[];
  action: "forward" | "back" | "left" | "right" | "klimb" | "drink" | "open" | "search" | "get";
  klimbDir?: "up" | "down";
}

function char(r: RosterIn): CharacterState {
  return {
    name: "",
    gender: 0x0b,
    class: "F",
    status: r.status ?? "G",
    strength: 15,
    dexterity: r.dex ?? 15,
    intelligence: 15,
    currentMp: 0,
    currentHp: r.hp ?? 30,
    maxHp: r.maxHp ?? 30,
    exp: 0,
    level: 1,
    monthsAtInn: 0,
    helmet: 0xff,
    armor: 0xff,
    weapon: 0xff,
    shield: 0xff,
    ring: 0xff,
    amulet: 0xff,
    partyStatus: 0,
  };
}

/** Grid 8×8×8 de suelo (Nothing) con overrides del spec. */
function buildDungeon(location: number, cells: CellIn[]): DungeonData {
  const floors: DungeonCell[][][] = [];
  for (let f = 0; f < 8; f++) {
    const plane: DungeonCell[][] = [];
    for (let y = 0; y < 8; y++) {
      const row: DungeonCell[] = [];
      for (let x = 0; x < 8; x++) row.push({ type: 0, sub: 0 });
      plane.push(row);
    }
    floors.push(plane);
  }
  for (const c of cells) {
    if (floors[c.floor]?.[c.y]?.[c.x]) floors[c.floor]![c.y]![c.x] = { type: c.type, sub: c.sub };
  }
  return { location, name: "TEST", floors };
}

function main(): void {
  const input = JSON.parse(process.argv[2] ?? "{}") as Input;
  const characters = input.roster.map(char);
  const state = {
    version: 1,
    characters,
    partySize: characters.length,
    activeCharacter: input.activeCharacter ?? 0,
    gold: 0,
    turnsSinceStart: 0,
    // Antorcha encendida por defecto (el Search de mazmorra exige luz, gate E4-1);
    // los escenarios pueden apagarla con torchTurns:0 para probar el gate.
    torchTurns: input.torchTurns ?? 100,
  } as unknown as GameState;

  const data = buildDungeon(input.pos.dungeon, input.cells ?? []);
  const rng = new OriginalRng(input.seed);
  const dg = new DungeonState([data], input.pos, rng);

  let events: DungeonEvent[];
  switch (input.action) {
    case "forward":
      events = dg.forward(state);
      break;
    case "back":
      events = dg.back(state);
      break;
    case "left":
      events = dg.turnLeft();
      break;
    case "right":
      events = dg.turnRight();
      break;
    case "klimb":
      events = dg.klimb(state, input.klimbDir);
      break;
    case "drink":
      events = dg.drinkFountain(state);
      break;
    case "open":
      events = dg.openChest(state);
      break;
    case "get":
      // get_dungeon 0x179E (residual-3): el botín del cofre 0x70 se acredita AQUÍ,
      // no en el open — los escenarios O→G encadenan dos runs o dos acciones.
      events = dg.getHere(state);
      break;
    case "search":
      events = dg.search(state);
      break;
    default:
      process.stderr.write(`acción desconocida: ${input.action}\n`);
      process.exit(1);
  }

  const out = {
    pos: { x: dg.pos.x, y: dg.pos.y, facing: dg.pos.facing },
    floor: dg.pos.floor,
    seedAfter: rng.getSeed(),
    gold: state.gold,
    party: characters.map((c) => ({
      hp: c.currentHp,
      maxHp: c.maxHp,
      status: c.status,
      dex: c.dexterity,
    })),
    events,
    messages: events.filter((e) => e.kind === "message").map((e) => e.text),
  };
  process.stdout.write(JSON.stringify(out) + "\n");
}

main();
