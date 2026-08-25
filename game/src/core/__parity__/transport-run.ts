/**
 * Runner de paridad de TRANSPORTE (Task 3.7): reproduce el core del clon
 * (wind.ts / transport.ts con OriginalRng) para cruzarlo contra el modelo
 * asm-derivado en Python (re/tools/transport_parity.py). Mismo patrón que
 * npc-run.ts / combat-run.ts.
 *
 * Recibe un escenario JSON como único argumento CLI, con `kind`:
 *   "wind-stream": {seed, ticks}
 *       → {winds:[...], seedAfter, changes}  (RNG del cambio de viento)
 *   "drift":       {wind, sailDir, ticks}
 *       → {advances:[bool...], ctrAfter}     (cadencia determinista)
 *   "broadside":   {seed, transport, dir, hasTarget, targetHull}
 *       → {ok, damage, sunk, seedAfter}
 *   "repair":      {seed, hull}
 *       → {hull, rolls, minutes, seedAfter}
 *
 * Salida: una línea JSON a stdout. Errores por stderr, exit 1.
 */
import { OriginalRng } from "../rng-original.js";
import type { GameState } from "../state.js";
import { maybeChangeWind, windDriftStep } from "../world/wind.js";
import { broadside, repairHull } from "../world/transport.js";
import type { Direction } from "../world/movement.js";

declare const process: {
  argv: string[];
  stderr: { write(chunk: string): void };
  exit(code?: number): never;
};

/** Estado mínimo para las funciones (solo tocan los campos náuticos). */
function stubState(fields: Partial<GameState>): GameState {
  return { wind: 0, windDriftCtr: 0, ...fields } as GameState;
}

function runWindStream(spec: { seed: number; ticks: number; wind0?: number }): unknown {
  const rng = new OriginalRng(spec.seed);
  const st = stubState({ wind: spec.wind0 ?? 0 });
  const winds: number[] = [];
  let changes = 0;
  for (let i = 0; i < spec.ticks; i++) {
    if (maybeChangeWind(st, (lo, hi) => rng.next(lo, hi))) changes++;
    winds.push(st.wind ?? 0);
  }
  return { winds, seedAfter: rng.getSeed(), changes };
}

function runDrift(spec: { wind: number; sailDir: number; ticks: number }): unknown {
  const st = stubState({ wind: spec.wind, sailDir: spec.sailDir, windDriftCtr: 0 });
  const advances: boolean[] = [];
  for (let i = 0; i < spec.ticks; i++) advances.push(windDriftStep(st));
  return { advances, ctrAfter: st.windDriftCtr ?? 0 };
}

function runBroadside(spec: {
  seed: number;
  transport: number;
  dir: Direction;
  hasTarget: boolean;
  targetHull: number;
}): unknown {
  const rng = new OriginalRng(spec.seed);
  const r = broadside(spec.transport, spec.dir, spec.hasTarget, spec.targetHull, (lo, hi) =>
    rng.next(lo, hi),
  );
  return { ok: r.ok, damage: r.damage ?? 0, sunk: r.sunk ?? false, seedAfter: rng.getSeed() };
}

function runRepair(spec: { seed: number; hull: number }): unknown {
  const rng = new OriginalRng(spec.seed);
  const r = repairHull(spec.hull, (lo, hi) => rng.next(lo, hi));
  return { hull: r.hull, rolls: r.rolls, minutes: r.minutes, seedAfter: rng.getSeed() };
}

function main(): void {
  const raw = process.argv[2];
  if (!raw) throw new Error("uso: tsx transport-run.ts '<escenario JSON>'");
  const spec = JSON.parse(raw) as { kind: string } & Record<string, unknown>;
  let out: unknown;
  switch (spec.kind) {
    case "wind-stream":
      out = runWindStream(spec as never);
      break;
    case "drift":
      out = runDrift(spec as never);
      break;
    case "broadside":
      out = runBroadside(spec as never);
      break;
    case "repair":
      out = runRepair(spec as never);
      break;
    default:
      throw new Error(`kind desconocido: ${spec.kind}`);
  }
  console.log(JSON.stringify(out));
}

try {
  main();
} catch (err) {
  process.stderr.write(`transport-run: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
}
