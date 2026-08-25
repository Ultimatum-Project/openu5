/**
 * #37 — REPLAY data-driven del volcado LIMPIO del oráculo (captura 2, run5).
 *
 * Ata el move-loop REAL del port a la EVIDENCIA EMPÍRICA del binario: por cada turno
 * capturado reconstruye el escenario del genérico (posición del snapshot previo + party
 * del snapshot del turno), siembra OriginalRng con el seed capturado del axis, corre
 * `OverworldEnemies.tick` de verdad, y asevera:
 *   (a) la SECUENCIA de rand consumida = la del volcado ([axis] | [axis,drift]);
 *   (b) en turnos SIN drift, la POSICIÓN final del genérico = la del snapshot capturado
 *       (mismo seed → mismo valor rand → mismo movimiento que el DOS real: el binding duro).
 *
 * La cita = el volcado mismo (re/notes/captures/overworld_ai_capture2_run5.json). Si
 * alguien rompe el orden de consumo de rand en enemies.ts, este test canta con el dato
 * del binario, no con una expectativa escrita a mano.
 *
 * ALCANCE: sólo el actor GENÉRICO (idx12), el ÚNICO que se movió en la captura y el
 * caso EMPÍRICAMENTE confirmado. Remolino/pirata (rama ESTÁTICA) se cerrarán con una
 * captura 3 dirigida (el pirata no se movió aquí; su cadencia por viento no se ejerció).
 * Turno 0 se excluye: anomalía del arranque (el genérico se movió sin axis-rand capturado).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { OverworldEnemies } from "../src/core/world/enemies.js";
import { OriginalRng } from "../src/core/rng-original.js";
import type { GameState } from "../src/core/state.js";
import type { ActiveMap } from "../src/core/world/map.js";
import type { RandFn } from "../src/core/world/survival.js";

interface Snap { idx: number; x: number; y: number; }
interface Capture {
  scenario: { actors_before: Snap[] };
  stream: Array<{ kind: string; n?: number; site?: string; seed_before?: number }>;
  per_turn_snaps: Array<{ turn: number; actors: Snap[] }>;
}

const CAP: Capture = JSON.parse(
  readFileSync(fileURLToPath(new URL(
    "../../re/notes/captures/overworld_ai_capture2_run5.json", import.meta.url)), "utf8"),
);

const GENERIC = 12; // el único actor móvil de la captura
const OPEN: ActiveMap = { width: 256, height: 256, tileAt: () => 1 } as unknown as ActiveMap;   // agua pasable
const BLOCKED: ActiveMap = { width: 256, height: 256, tileAt: () => 4 } as unknown as ActiveMap; // tierra: intransitable para enemigo de agua

function makeState(px: number, py: number): GameState {
  return { position: { x: px, y: py, floor: 0 }, wind: 0, overworldEnemies: [] } as unknown as GameState;
}
function actor(snap: Snap[], idx: number): Snap | undefined {
  return snap.find((a) => a.idx === idx);
}

/** Rands del turno del genérico (axis/drift + seed) + el seed del spawn de ese turno.
 * `spawnSeed` sirve para detectar lecturas de seed RANCIAS: cuando el axis leyó el
 * MISMO seed que el spawn (48469==48469 en el turno 1), la lectura del oráculo fue racy
 * (el spawn ya consumió el rand entre medias) → ese seed no es fiable para clavar la
 * posición; la SECUENCIA de rand sí lo es. */
function genericRandsByTurn(): Array<{ turn: number; spawnSeed: number | null; rands: Array<{ site: string; seed: number }> }> {
  const out: Array<{ turn: number; spawnSeed: number | null; rands: Array<{ site: string; seed: number }> }> = [];
  let cur: { turn: number; spawnSeed: number | null; rands: Array<{ site: string; seed: number }> } | null = null;
  for (const e of CAP.stream) {
    if (e.kind === "turn") {
      cur = { turn: e.n!, spawnSeed: null, rands: [] };
      out.push(cur);
    } else if (e.kind === "rand" && e.site === "spawn" && cur) {
      cur.spawnSeed = e.seed_before!;
    } else if (e.kind === "rand" && (e.site === "axis" || e.site === "drift") && cur) {
      cur.rands.push({ site: e.site, seed: e.seed_before! });
    }
  }
  return out;
}

describe("#37 REPLAY: el port reproduce el consumo de rand del volcado del binario", () => {
  const turns = genericRandsByTurn();

  it("hay turnos con movimiento del genérico en el volcado", () => {
    expect(turns.some((t) => t.rands.length > 0)).toBe(true);
  });

  for (const t of turns) {
    if (t.turn === 0 || t.rands.length === 0) continue; // turno 0 anómalo / sin move
    const hasDrift = t.rands.some((r) => r.site === "drift");
    const staleSeed = t.spawnSeed !== null && t.rands[0]!.seed === t.spawnSeed; // lectura racy
    it(`turno ${t.turn}: consume ${hasDrift ? "[axis,drift]" : "[axis]"}${!hasDrift && !staleSeed ? " y clava la posición" : ""}`, () => {
      // posición de inicio del genérico = snapshot al FINAL del turno anterior
      // (per_turn_snaps[N-1]); actors_before es el inicio del turno 0, que se excluye.
      const prev = CAP.per_turn_snaps[t.turn - 1]!.actors;
      const start = actor(prev, GENERIC)!;
      const snapNow = CAP.per_turn_snaps[t.turn]!.actors;
      const party = actor(snapNow, 0)!;       // idx0 = avatar/party
      const endExpected = actor(snapNow, GENERIC)!;
      const axisSeed = t.rands[0]!.seed;

      const rng = new OriginalRng(axisSeed);
      const recorded: Array<[number, number]> = [];
      const rand: RandFn = (lo, hi) => { recorded.push([lo, hi]); return rng.next(lo, hi); };

      const st = makeState(party.x, party.y);
      const mgr = new OverworldEnemies();
      mgr.bind(st);
      mgr.enemies.push({ slot: GENERIC, defIndex: 0, tile: 0x94, water: true, x: start.x, y: start.y });
      mgr.tick(st, hasDrift ? BLOCKED : OPEN, { picker: () => null, rand, shouldSpawn: false });

      // (a) secuencia de rand EXACTA del volcado
      expect(recorded).toEqual(hasDrift ? [[0, 1], [0, 3]] : [[0, 1]]);

      const e = mgr.enemies[0]!;
      if (!hasDrift && !staleSeed) {
        // (b) MISMO seed → MISMO valor axis → MISMO paso que el DOS real. Sólo en
        // turnos con seed NO rancio (axis ≠ spawn): con lectura racy el seed no vale
        // para clavar la posición, pero la secuencia de rand (arriba) sí queda atada.
        expect({ x: e.x, y: e.y }).toEqual({ x: endExpected.x, y: endExpected.y });
      } else if (hasDrift) {
        // en drift, el seed tras el axis == el seed_before del drift capturado
        const driftSeed = t.rands.find((r) => r.site === "drift")!.seed;
        expect(new OriginalRng(axisSeed).next(0, 1) >= 0).toBe(true); // sanity
        const midSeed = (() => { const r = new OriginalRng(axisSeed); r.next(0, 1); return r.getSeed(); })();
        expect(midSeed).toBe(driftSeed);
      }
    });
  }
});
