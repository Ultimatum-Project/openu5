/**
 * Unit de la TELEMETRÍA del Grand Tour (e2e/grandtour/telemetry.ts) — carril
 * tour-telemetry.
 *
 * GUARDA CENTRAL (cero impacto sin env): sin `U5_TOUR_TELEMETRY` las funciones de
 * registro deben ser NO-OP totales — ni page.evaluate, ni disco. Se prueba con una
 * page ENVENENADA cuyo `evaluate` LANZA: si el no-op tocara la página, el test
 * revienta. Esto respalda la promesa de que el tour sin la env queda byte-idéntico
 * (la telemetría jamás conduce; sólo observa cuando se le pide).
 *
 * Con la env: cada record apendiza UNA línea JSON válida con los campos del esquema
 * v1 (chapter "?" fuera de Playwright — test.info() lanza bajo vitest y se degrada).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  recordCombatEnd,
  recordCombatRound,
  recordDungeonStep,
  recordWaitTurn,
  recordWalkStep,
  telemetryEnabled,
  telemetryPath,
} from "../e2e/grandtour/telemetry";

/** Page ENVENENADA: cualquier interacción lanza. Prueba el no-op por construcción. */
const poisonedPage = {
  evaluate: () => {
    throw new Error("telemetría apagada NO debe tocar la página");
  },
} as unknown as Page;

/** Page FALSA para el modo activo: evaluate devuelve una sonda canned. */
const fakePage = {
  evaluate: async () => ({ ctx: "town", echo: "Blocked!", npcAtIntended: false, liveTile: 68 }),
} as unknown as Page;

const POS = { location: 3, floor: 0, x: 10, y: 12 };

let saved: string | undefined;
let dir: string;

beforeEach(() => {
  saved = process.env.U5_TOUR_TELEMETRY;
  delete process.env.U5_TOUR_TELEMETRY;
  dir = mkdtempSync(join(tmpdir(), "u5-telemetry-"));
});

afterEach(() => {
  if (saved === undefined) delete process.env.U5_TOUR_TELEMETRY;
  else process.env.U5_TOUR_TELEMETRY = saved;
  rmSync(dir, { recursive: true, force: true });
});

describe("telemetría APAGADA (sin U5_TOUR_TELEMETRY) — no-op total", () => {
  it("telemetryEnabled/telemetryPath reflejan el apagado (y el string vacío)", () => {
    expect(telemetryEnabled()).toBe(false);
    expect(telemetryPath()).toBeNull();
    process.env.U5_TOUR_TELEMETRY = "   ";
    expect(telemetryEnabled()).toBe(false);
  });

  it("ningún record toca la página ni el disco (page envenenada + tmpdir intacto)", async () => {
    const out = join(dir, "nunca.jsonl");
    await recordWalkStep(poisonedPage, {
      key: "ArrowLeft",
      before: POS,
      after: POS,
      intended: { x: 9, y: 12 },
      plannedTile: 68,
      openedDoor: false,
      goal: { x: 5, y: 9 },
    });
    await recordWaitTurn(poisonedPage, "walkTo:no-path", POS);
    await recordDungeonStep(poisonedPage, {
      before: { x: 1, y: 1, floor: 0, facing: "north" },
      intended: { x: 1, y: 2 },
      after: null,
    });
    await recordCombatRound(poisonedPage, { resolver: "arena", round: 3, ax: 5, ay: 5, enemies: 2, stuck: 0 });
    await recordCombatEnd(poisonedPage, { resolver: "arena", resolved: true, ms: 1234 });
    expect(existsSync(out)).toBe(false);
  });
});

describe("telemetría ENCENDIDA (env → ruta JSONL)", () => {
  it("recordWalkStep de un paso BLOQUEADO apendiza una línea v1 con la evidencia viva", async () => {
    const out = join(dir, "tour.jsonl");
    process.env.U5_TOUR_TELEMETRY = out;
    await recordWalkStep(fakePage, {
      key: "ArrowLeft",
      before: POS,
      after: POS, // no llegó a intended → bloqueado
      intended: { x: 9, y: 12 },
      plannedTile: 68,
      openedDoor: false,
      goal: { x: 5, y: 9 },
    });
    const lines = readFileSync(out, "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    const e = JSON.parse(lines[0]!);
    expect(e).toMatchObject({
      v: 1,
      kind: "walk-step",
      chapter: "?", // fuera de un test de Playwright, test.info() lanza → "?"
      ctx: "town",
      key: "ArrowLeft",
      moved: false,
      intended: { x: 9, y: 12 },
      plannedTile: 68,
      echo: "Blocked!",
      npcAtIntended: false,
      liveTile: 68,
    });
    expect(typeof e.t_ms).toBe("number");
  });

  it("un paso que AVANZÓ no arrastra evidencia de bloqueo y las entradas se acumulan", async () => {
    const out = join(dir, "tour.jsonl");
    process.env.U5_TOUR_TELEMETRY = out;
    await recordWalkStep(fakePage, {
      key: "ArrowRight",
      before: POS,
      after: { ...POS, x: 11 },
      intended: { x: 11, y: 12 },
      plannedTile: 4,
      openedDoor: true,
      goal: { x: 15, y: 12 },
    });
    await recordWaitTurn(fakePage, "pursue:no-path", POS);
    await recordCombatEnd(fakePage, { resolver: "room", resolved: false, ms: 10 });
    const lines = readFileSync(out, "utf8").trim().split("\n");
    expect(lines).toHaveLength(3);
    const step = JSON.parse(lines[0]!);
    expect(step.moved).toBe(true);
    expect(step.openedDoor).toBe(true);
    expect("npcAtIntended" in step).toBe(false);
    const wait = JSON.parse(lines[1]!);
    expect(wait).toMatchObject({ kind: "wait-turn", reason: "pursue:no-path", pos: { loc: 3, x: 10, y: 12 } });
    const end = JSON.parse(lines[2]!);
    expect(end).toMatchObject({ kind: "combat-end", resolver: "room", resolved: false, ms: 10 });
  });

  it("una page ROTA degrada la sonda (ctx unknown) sin lanzar — la telemetría nunca tumba un capítulo", async () => {
    const out = join(dir, "tour.jsonl");
    process.env.U5_TOUR_TELEMETRY = out;
    await recordWaitTurn(poisonedPage, "wait", POS);
    const e = JSON.parse(readFileSync(out, "utf8").trim());
    expect(e).toMatchObject({ kind: "wait-turn", ctx: "unknown", echo: "" });
  });
});
