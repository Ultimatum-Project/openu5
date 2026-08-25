/**
 * Runner de la RUTA CRÍTICA gitana→endgame (Task F.2): el escenario maestro de
 * regresión de toda la migración. Encadena en UN SOLO stream de RNG
 * (`g_rng_seed` — un único word global en el original, DS:0x5420) las fases del
 * juego que consumen aleatoriedad, en el orden del binario:
 *
 *   1. gitana        creación de personaje (FONT pick_virtue rand(0,7) con
 *                    rechazo) desde seed 0 → stats deterministas + avanza semilla
 *   2. outdoor×K     turnos del bucle exterior (MAINOUT 0x0A84: viento→hazard→
 *                    housekeeping→spawn) continuando desde la semilla de la gitana
 *   3. bridge        una emboscada de trolls (MAINOUT 0x1BE8)
 *   4. town×M        turnos del bucle de pueblo (TOWN 0x141E: viento-por-tecla→
 *                    despertar→housekeeping)
 *   5. endgame       informe de tiempo de juego (ENDGAME 0x0407, determinista)
 *
 * La clave: una ÚNICA semilla threadea todas las fases (reconstruida por valor
 * entre fases = el global persistente). Cruza contra el modelo Python compuesto
 * (re/tools/master_parity.py) exigiendo semilla + traza + estado idénticos en
 * cada checkpoint. Es la unificación del stream que 3.13 dejó a F.2.
 *
 * Escenario JSON como único arg CLI (ver re/parity/master/*.json). Salida: una
 * línea JSON con {gypsy, checkpoints[], seedFinal, endgameReport}. Errores por
 * stderr, exit 1.
 */
import { readFileSync } from "node:fs";
import { OriginalRng } from "../rng-original.js";
import type { CharacterState, GameState } from "../state.js";
import { GypsyTournament, type GypsyBase } from "../creation/gypsy.js";
import { maybeChangeWind } from "../world/wind.js";
import { bridgeTrollAmbush } from "../world/loops/hazards.js";
import { outdoorTurn, townTurn } from "../world/loops/turn.js";
import { formatQuestReport } from "../quest/endgame.js";

declare const process: {
  argv: string[];
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
  exit(code?: number): never;
};

interface Member {
  dex?: number;
  str?: number;
  status?: string;
}

interface PhaseSpec {
  kind: "outdoor" | "bridge" | "town";
  tile?: number;
  floor?: number;
  hour?: number;
  ticks?: number;
  onSwamp?: boolean;
  onBridge?: boolean;
  secondWorldTurn?: boolean;
  confused?: boolean;
  damageTile?: boolean;
  onSwampTile?: boolean;
}

interface Scenario {
  name?: string;
  seed?: number;
  gypsy: { base?: GypsyBase; answers: ("A" | "B")[] };
  members: Member[];
  phases: PhaseSpec[];
  endgameTime: { year: number; month: number; day: number };
}

/** Cada llamada a rand del stream, sin etiqueta de site (invariante cross-model). */
interface RandCall {
  lo: number;
  hi: number;
  value: number;
}

interface Checkpoint {
  phase: string;
  seedBefore: number;
  seedAfter: number;
  trace: RandCall[];
}

function stubChar(m: Member): CharacterState {
  return {
    name: "P",
    gender: 0x0b,
    class: "A",
    status: m.status ?? "G",
    strength: m.str ?? 20,
    dexterity: m.dex ?? 20,
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
  } as CharacterState;
}

function stubState(members: Member[], loc: number, floor: number, hour: number): GameState {
  const characters = members.map(stubChar);
  return {
    characters,
    partySize: characters.length,
    gold: 500,
    food: 100,
    time: { year: 139, month: 4, day: 7, hour, minute: 0 },
    turnsSinceStart: 0,
    position: { location: loc, floor, x: 100, y: 100 },
    transport: "foot",
    torchTurns: 0,
    prevHour: hour,
  } as GameState;
}

function main(): void {
  const path = process.argv[2];
  if (!path) {
    process.stderr.write("uso: master-run.ts <scenario.json>\n");
    process.exit(1);
  }
  const scn = JSON.parse(readFileSync(path, "utf-8")) as Scenario;
  const seed0 = scn.seed ?? 0;

  // ── Fase 1: gitana ────────────────────────────────────────────────────────
  const base: GypsyBase = scn.gypsy.base ?? { strength: 15, dexterity: 15, intelligence: 15 };
  const tournament = new GypsyTournament(base, seed0);
  for (const ans of scn.gypsy.answers) {
    tournament.next();
    tournament.answer(ans);
  }
  const gStats = tournament.finalize();
  let seed = tournament.seedAfter();

  // El Avatar (miembro 0) hereda los stats de la gitana; el resto vienen del
  // escenario (compañeros de INIT.GAM). Ambos modelos usan la misma party, así
  // que las ramas dependientes de DEX/STR (troll, pantano) casan.
  const members: Member[] = scn.members.map((m, i) =>
    i === 0 ? { ...m, dex: gStats.dexterity, str: gStats.strength } : m,
  );

  // ── Fases 2-4: bucles encadenados por la semilla ─────────────────────────
  const checkpoints: Checkpoint[] = [];
  scn.phases.forEach((p, idx) => {
    const rng = new OriginalRng(seed);
    const seedBefore = seed;
    const trace: RandCall[] = [];
    // Tracer genérico: captura CADA llamada al stream (lo,hi,value), sin
    // etiqueta de site (los sites son internos de cada modelo). El invariante
    // cross-model es "las mismas rands en el mismo orden" + la semilla final.
    const rand = (lo: number, hi: number) => {
      const value = rng.next(lo, hi);
      trace.push({ lo, hi, value });
      return value;
    };
    if (p.kind === "outdoor") {
      const st = stubState(members, 0, p.floor ?? 0, p.hour ?? 12);
      for (let i = 0; i < (p.ticks ?? 1); i++) {
        outdoorTurn(st, rand, {
          tileUnderParty: p.tile ?? 5,
          onSwamp: p.onSwamp,
          onBridge: p.onBridge,
        });
      }
    } else if (p.kind === "bridge") {
      const st = stubState(members, 0, 0, p.hour ?? 12);
      // El tick de viento interno (0x1C0B) va entre el gate y las tiradas de DEX.
      bridgeTrollAmbush(st, rand, () => {
        if (st.timeSpell !== "T") maybeChangeWind(st, rand);
      });
    } else if (p.kind === "town") {
      const st = stubState(members, 6, 0, p.hour ?? 12);
      for (let i = 0; i < (p.ticks ?? 1); i++) {
        townTurn(st, rand, {
          consumesTurn: true,
          secondWorldTurn: p.secondWorldTurn,
          confused: p.confused,
          damageTile: p.damageTile,
          onSwampTile: p.onSwampTile,
        });
      }
    }
    seed = rng.getSeed();
    checkpoints.push({ phase: `${p.kind}#${idx}`, seedBefore, seedAfter: seed, trace });
  });

  // ── Fase 5: endgame (determinista, sin RNG) ──────────────────────────────
  const endState = stubState(members, 0, 0, 12);
  endState.time = { ...endState.time, ...scn.endgameTime, hour: 12, minute: 0 };
  const endgameReport = formatQuestReport(endState);

  const out = {
    gypsy: {
      strength: gStats.strength,
      dexterity: gStats.dexterity,
      intelligence: gStats.intelligence,
      currentMp: gStats.currentMp,
      matchups: tournament.resolved,
      seedAfter: tournament.seedAfter(),
    },
    checkpoints,
    seedFinal: seed,
    endgameReport,
  };
  process.stdout.write(JSON.stringify(out) + "\n");
}

main();
