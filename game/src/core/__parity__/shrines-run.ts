/**
 * Runner de paridad de SANTUARIOS / MANTRAS / POZO / MOONGATES (Task 3.8):
 * reproduce el core del clon (world/shrines.ts, world/wishingwell.ts,
 * world/moongates.ts) para cruzarlo contra el modelo asm-derivado en Python
 * (re/tools/shrines_parity.py). Mismo patrón que transport-run.ts / npc-run.ts.
 *
 * Ninguna mecánica consume RNG: la paridad es de VALOR determinista.
 *
 * Escenario JSON como único argumento CLI, con `kind`:
 *   "moongate": {day, hour, minute, moonstones:[{x,y,buried,z}]}
 *       → {teleported, phase?, x?, y?, z?, reason?}
 *   "donation": {gold, karma, cycles}     → {accepted, gold, karma, cost}
 *   "quest":    {virtue, karma, str, dex, int}
 *       → {karma, str, dex, int, attrs:[...]}
 *   "restore":  {virtue, typedVirtue, typedMantras:[3], x, y}  → {restored}
 *   "wish":     {gold, wish, location}     → {kind, gold}
 *
 * Salida: una línea JSON a stdout. Errores por stderr, exit 1.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { CharacterState, GameState } from "../state.js";
import {
  activeGatePhase,
  moongateDestination,
  isMidnightGateEdge,
} from "../world/moongates.js";
import {
  shrineMode,
  shrineShowMantra,
  shrineCodexLesson,
  shrineDonate,
  shrineCompleteQuest,
  shrineRestore,
  type ShrineData,
} from "../world/shrines.js";
import { wishingWell } from "../world/wishingwell.js";

declare const process: {
  argv: string[];
  stderr: { write(chunk: string): void };
  exit(code?: number): never;
};

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), "../../../assets");
function shrineData(): ShrineData {
  const d = JSON.parse(readFileSync(`${ASSETS}/data.json`, "utf-8")) as {
    virtues: string[];
    mantras: string[];
    shrineX: number[];
    shrineY: number[];
  };
  return { virtues: d.virtues, mantras: d.mantras, shrineX: d.shrineX, shrineY: d.shrineY };
}
function moonPhasesRaw(): number[] {
  return (JSON.parse(readFileSync(`${ASSETS}/data.json`, "utf-8")) as { moonPhases: number[] })
    .moonPhases;
}

function stub(fields: Partial<GameState>): GameState {
  return { gold: 0, karma: 0, ...fields } as GameState;
}

interface Moonstone {
  x: number;
  y: number;
  buried: boolean;
  z: number;
  location: number;
}

function runMoongate(spec: {
  day: number;
  hour: number;
  minute: number;
  moonstones: Moonstone[];
}): unknown {
  // Reproduce EXACTAMENTE la ruta de Game.checkMoongate llamando a las funciones
  // reales del clon (activeGatePhase / isMidnightGateEdge / moongateDestination).
  const time = { year: 139, month: 1, day: spec.day, hour: spec.hour, minute: spec.minute };
  const state = stub({ moonstones: spec.moonstones });
  const raw = moonPhasesRaw();
  const phase = activeGatePhase(time, raw, state);
  if (phase === null) return { teleported: false, reason: "daylight" };
  if (isMidnightGateEdge(time)) return { teleported: false, reason: "midnight-edge" };
  const dest = moongateDestination(state, time, raw);
  if (!dest) return { teleported: false, reason: "in-inventory" };
  return { teleported: true, phase, x: dest.x, y: dest.y, z: dest.z };
}

function runFlow(spec: {
  virtue: number;
  questBitmap?: number;
  visitedBitmap?: number;
  action: "mode" | "show-mantra" | "codex" | "complete";
}): unknown {
  const st = stub({
    karma: 50,
    shrineQuestBitmap: spec.questBitmap ?? 0,
    shrineVisitedBitmap: spec.visitedBitmap ?? 0,
  });
  const v = spec.virtue;
  if (spec.action === "mode") return { mode: shrineMode(st, v) };
  if (spec.action === "show-mantra") {
    shrineShowMantra(st, v, shrineData());
    return {
      questBitmap: st.shrineQuestBitmap ?? 0,
      visitedBitmap: st.shrineVisitedBitmap ?? 0,
      mode: shrineMode(st, v),
    };
  }
  if (spec.action === "codex") {
    const r = shrineCodexLesson(st);
    return {
      virtue: r.virtue,
      questBitmap: st.shrineQuestBitmap ?? 0,
      visitedBitmap: st.shrineVisitedBitmap ?? 0,
      ceremony: r.ceremony,
    };
  }
  // complete
  shrineCompleteQuest(st, v, { strength: 15, dexterity: 15, intelligence: 15 } as CharacterState);
  return {
    questBitmap: st.shrineQuestBitmap ?? 0,
    visitedBitmap: st.shrineVisitedBitmap ?? 0,
    mode: shrineMode(st, v),
  };
}

function runDonation(spec: { gold: number; karma: number; cycles: number }): unknown {
  const st = stub({ gold: spec.gold, karma: spec.karma });
  const r = shrineDonate(st, spec.cycles);
  return { accepted: r.accepted, gold: st.gold, karma: st.karma, cost: r.cost };
}

function runQuest(spec: {
  virtue: number;
  karma: number;
  str: number;
  dex: number;
  int: number;
}): unknown {
  const st = stub({ karma: spec.karma, shrineQuestBitmap: 1 << spec.virtue });
  const avatar = {
    strength: spec.str,
    dexterity: spec.dex,
    intelligence: spec.int,
  } as CharacterState;
  const r = shrineCompleteQuest(st, spec.virtue, avatar);
  return {
    karma: st.karma,
    str: avatar.strength,
    dex: avatar.dexterity,
    int: avatar.intelligence,
    attrs: r.attrs,
  };
}

function runRestore(spec: {
  virtue: number;
  typedVirtue: string;
  typedMantras: string[];
  x: number;
  y: number;
}): unknown {
  const st = stub({ shrineDestroyed: (() => {
    const a = new Array(8).fill(0);
    a[spec.virtue] = 0x80;
    return a;
  })() });
  const r = shrineRestore(st, spec.virtue, spec.typedVirtue, spec.typedMantras, spec.x, spec.y, shrineData());
  return { restored: r.restored, destroyedAfter: st.shrineDestroyed?.[spec.virtue] ?? 0 };
}

function runWish(spec: { gold: number; wish: string; location: number }): unknown {
  const st = stub({ gold: spec.gold, position: { location: spec.location, floor: 0, x: 0, y: 0 } });
  const r = wishingWell(st, spec.wish);
  return { kind: r.kind, gold: st.gold };
}

const RUNNERS: Record<string, (spec: never) => unknown> = {
  moongate: runMoongate as (spec: never) => unknown,
  donation: runDonation as (spec: never) => unknown,
  quest: runQuest as (spec: never) => unknown,
  restore: runRestore as (spec: never) => unknown,
  wish: runWish as (spec: never) => unknown,
  flow: runFlow as (spec: never) => unknown,
};

function main(): void {
  const arg = process.argv[2];
  if (!arg) {
    process.stderr.write("uso: shrines-run.ts '<json>'\n");
    process.exit(1);
  }
  const spec = JSON.parse(arg) as { kind: string };
  const runner = RUNNERS[spec.kind];
  if (!runner) {
    process.stderr.write(`kind desconocido: ${spec.kind}\n`);
    process.exit(1);
  }
  const out = runner(spec as never);
  console.log(JSON.stringify(out));
}

main();
