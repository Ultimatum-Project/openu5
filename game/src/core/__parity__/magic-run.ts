/**
 * Runner de paridad de MAGIA (Task 3.3). Reproduce en el core del clon un
 * lanzamiento de hechizo desde una instantánea del oráculo DOSBox y emite los
 * GLOBALES observables tras el cast (los mismos que el lado DOSBox lee de la
 * RAM: g_light_spell_mins, g_time_spell/turns, g_wind, food, y el registro del
 * PJ afectado). El binario y el clon parten de la MISMA semilla y del MISMO
 * estado sembrado, así que los efectos deterministas (luz/estado/viento) deben
 * calcar sin depender del RNG, y los con tirada (Mani/comida) casan al sembrar
 * la semilla capturada.
 *
 * Entrada (argv[2], JSON):
 *   { seed, spell, casterIndex, targetIndex?, ctx:{location,inCombat,windArrow?},
 *     roster:[{class,status,str,dex,int,mp,hp,maxHp,exp,level}],
 *     spellQuantities:{idx:qty}, food, karma }
 * Salida (stdout, última línea): { ok, message, effect, lightSpellMins,
 *   timeSpell, timeSpellTurns, wind, food, party:[{hp,mp,status,level,maxHp,exp}] }
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CharacterState, GameState } from "../state.js";
import { OriginalRng } from "../rng-original.js";
import { CombatRng } from "../combat/formulas.js";
import { buildSpellDefs, type MagicDefsJson } from "../magic/spells.js";
import {
  castSpell,
  applyMani,
  applyVasMani,
  applyCure,
  applyAwaken,
  applyResurrect,
  type CastContext,
} from "../magic/cast.js";

declare const process: {
  argv: string[];
  stdout: { write(c: string): void };
  stderr: { write(c: string): void };
  exit(c?: number): never;
};

interface RosterIn {
  class?: string;
  status?: string;
  str?: number;
  dex?: number;
  int?: number;
  mp?: number;
  hp?: number;
  maxHp?: number;
  exp?: number;
  level?: number;
}

interface Input {
  seed: number;
  spell: string;
  casterIndex: number;
  targetIndex?: number;
  ctx: CastContext;
  roster: RosterIn[];
  spellQuantities?: Record<string, number>;
  food?: number;
  karma?: number;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const magicDefsJson = JSON.parse(
  readFileSync(resolve(HERE, "../data/MagicDefinitions.json"), "utf8").replace(/^﻿/, ""),
) as MagicDefsJson;
const defs = buildSpellDefs(magicDefsJson);

function char(r: RosterIn): CharacterState {
  return {
    name: "",
    gender: 0x0b,
    class: r.class ?? "M",
    status: r.status ?? "G",
    strength: r.str ?? 15,
    dexterity: r.dex ?? 15,
    intelligence: r.int ?? 20,
    currentMp: r.mp ?? 20,
    currentHp: r.hp ?? 30,
    maxHp: r.maxHp ?? 30,
    exp: r.exp ?? 0,
    level: r.level ?? 8,
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

function main(): void {
  const input = JSON.parse(process.argv[2] ?? "{}") as Input;
  const characters = input.roster.map(char);
  const spellQuantities = new Array<number>(48).fill(0);
  for (const [k, v] of Object.entries(input.spellQuantities ?? {})) {
    spellQuantities[Number(k)] = v;
  }
  const state = {
    version: 1,
    characters,
    partySize: characters.length,
    activeCharacter: 0,
    food: input.food ?? 0,
    gold: 0,
    keys: 0,
    gems: 0,
    torches: 0,
    skullKeys: 0,
    grapple: false,
    magicCarpets: 0,
    equipmentQuantities: [],
    spellQuantities,
    scrollQuantities: [],
    potionQuantities: [],
    reagentQuantities: [],
    specialItems: { spyglass: false, hmsCape: false, sextant: false, pocketWatch: false, blackBadge: false, woodenBox: false },
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    moonstones: [],
    karma: input.karma ?? 50,
    time: { year: 139, month: 1, day: 1, hour: 8, minute: 0 },
    turnsSinceStart: 0,
    position: { location: input.ctx.location, floor: 0, x: 0, y: 0 },
    transport: "foot",
    torchTurns: 0,
    npcDead: [],
    npcMet: [],
    questFlags: {},
    journal: [],
  } as unknown as GameState;

  const def = defs.find((d) => d.key === input.spell);
  if (!def) {
    process.stderr.write(`hechizo desconocido: ${input.spell}\n`);
    process.exit(1);
  }
  const rng = new CombatRng(new OriginalRng(input.seed));
  const caster = characters[input.casterIndex]!;
  const r = castSpell(state, caster, def, input.ctx, rng);

  // Efectos con objetivo: aplicar sobre el PJ elegido (picker del original).
  if (r.ok && r.effect && input.targetIndex !== undefined) {
    const target = characters[input.targetIndex]!;
    switch (r.effect.kind) {
      case "healTarget":
        if (r.effect.mode === "full") applyVasMani(target);
        else applyMani(target, rng);
        break;
      case "cure":
        applyCure(target);
        break;
      case "awaken":
        applyAwaken(target);
        break;
      case "resurrect":
        applyResurrect(target, state.karma);
        break;
      default:
        break;
    }
  }

  const out = {
    ok: r.ok,
    message: r.message,
    consumed: r.consumed,
    effect: r.effect,
    lightSpellMins: state.lightSpellMins ?? 0,
    timeSpell: state.timeSpell ?? "",
    timeSpellTurns: state.timeSpellTurns ?? 0,
    wind: state.wind ?? 0,
    food: state.food,
    seedAfter: rng.rng.getSeed(),
    party: characters.map((c) => ({
      hp: c.currentHp,
      mp: c.currentMp,
      status: c.status,
      level: c.level,
      maxHp: c.maxHp,
      exp: c.exp,
    })),
  };
  process.stdout.write(JSON.stringify(out) + "\n");
}

main();
