/**
 * Ciclo de vida del CombatPacer (ui/combat-pacer.ts) — TRAMO 1 del refactor
 * estructural (auditoría MANT-1/ARQ-2/Q2): el pacer de la tanda enemiga + cola
 * de teclas era un closure de boot() INIMPORTABLE por vitest — la clase exacta
 * de la regresión combatPacer (#53) aterrizaba en verde por construcción. Estos
 * tests cubren por UNIDAD lo que antes sólo se ejercitaba en vivo:
 *   · beat>0: un beat arma el timeout, cada beat corre UN tickEnemyTurnStep,
 *     las teclas se ENCOLAN durante la tanda y se drenan EN ORDEN al terminar;
 *   · beat=0 (webdriver): drain síncrono byte-idéntico (tickEnemyTurns);
 *   · cierre: combat.over → endCombat; combate desaparecido → cola vaciada;
 *   · guard anti-bucle (128).
 * (El spec e2e combat-pacer.spec.ts cubre la integración con `?combeat` real.)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CombatPacer, type PacerCombat, type PacerEvent } from "../src/ui/combat-pacer.js";

interface StubCombat extends PacerCombat {
  over: boolean;
  currentUnit: { kind: string; charmed?: boolean } | null;
  steps: number;
}

function makeCombat(): StubCombat {
  const combat: StubCombat = {
    over: false,
    currentUnit: { kind: "enemy" },
    steps: 0,
    tickEnemyTurnStep(): readonly PacerEvent[] {
      combat.steps++;
      return [{ kind: "moved" }];
    },
    tickEnemyTurns(): readonly PacerEvent[] {
      // Drena la tanda ENTERA (como combat.ts, guard 512): tras una llamada
      // el turno vuelve al jugador.
      combat.steps++;
      combat.currentUnit = { kind: "player" };
      return [{ kind: "moved" }];
    },
  };
  return combat;
}

interface Harness {
  pacer: CombatPacer;
  combat: StubCombat | null;
  out: PacerEvent[][];
  keys: string[];
  endCombatCalls: number;
  refreshCalls: number;
  setCombat(c: StubCombat | null): void;
}

function makeHarness(beatMs: number): Harness {
  const h: Harness = {
    pacer: undefined as unknown as CombatPacer,
    combat: makeCombat(),
    out: [],
    keys: [],
    endCombatCalls: 0,
    refreshCalls: 0,
    setCombat(c) {
      h.combat = c;
    },
  };
  h.pacer = new CombatPacer({
    beatMs,
    combat: () => h.combat,
    combatOut: (evs) => h.out.push([...evs]),
    endCombat: () => {
      h.endCombatCalls++;
      h.combat = null; // applyEvents(game.endCombat()) desmonta el combate
    },
    hudRefresh: () => {},
    refreshAwaiting: () => {
      h.refreshCalls++;
    },
    handleKey: (key) => h.keys.push(key),
  });
  return h;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("CombatPacer — beat>0 (paceo real T11)", () => {
  it("arma el beat ANTES de la primera acción y corre UN tickEnemyTurnStep por beat", () => {
    const h = makeHarness(400);
    h.pacer.pump();
    // El beat corre también antes de la primera acción (main-loop 0x0B94).
    expect(h.pacer.pacing).toBe(true);
    expect(h.combat!.steps).toBe(0);
    vi.advanceTimersByTime(400);
    expect(h.combat!.steps).toBe(1);
    // Sigue siendo turno enemigo → la cadena re-arma sola.
    expect(h.pacer.pacing).toBe(true);
    vi.advanceTimersByTime(400);
    expect(h.combat!.steps).toBe(2);
  });

  it("pump() con tanda en vuelo es no-op (la cadena sigue sola)", () => {
    const h = makeHarness(400);
    h.pacer.pump();
    h.pacer.pump();
    h.pacer.pump();
    vi.advanceTimersByTime(400);
    expect(h.combat!.steps).toBe(1); // ni beats duplicados ni pasos extra
  });

  it("al volver el turno al PJ la tanda termina y drena la cola EN ORDEN", () => {
    const h = makeHarness(400);
    h.pacer.pump();
    h.pacer.enqueue("a");
    h.pacer.enqueue("ArrowUp");
    expect(h.pacer.queued).toBe(2);
    // El siguiente paso devuelve el turno al jugador:
    h.combat!.tickEnemyTurnStep = () => {
      h.combat!.steps++;
      h.combat!.currentUnit = { kind: "player" };
      return [{ kind: "turn" }];
    };
    vi.advanceTimersByTime(400);
    expect(h.pacer.pacing).toBe(false);
    expect(h.keys).toEqual(["a", "ArrowUp"]); // mismo orden, ninguna perdida
    expect(h.pacer.queued).toBe(0);
  });

  it("un PJ POSEÍDO (charmed) también se pacea como la IA", () => {
    const h = makeHarness(400);
    h.combat!.currentUnit = { kind: "player", charmed: true };
    h.pacer.pump();
    expect(h.pacer.pacing).toBe(true);
  });

  it("combate over → endCombat; la cola pendiente se vacía si el combate desapareció", () => {
    const h = makeHarness(400);
    h.pacer.pump();
    h.pacer.enqueue("x");
    h.combat!.tickEnemyTurnStep = () => {
      h.combat!.steps++;
      h.combat!.over = true;
      return [{ kind: "died" }];
    };
    vi.advanceTimersByTime(400);
    expect(h.endCombatCalls).toBe(1);
    // endCombat desmontó el combate → la tecla encolada NO se re-entrega.
    expect(h.keys).toEqual([]);
    expect(h.pacer.queued).toBe(0);
    expect(h.pacer.pacing).toBe(false);
  });

  it("guard anti-bucle: una IA que nunca cede corta en 128 pasos", () => {
    const h = makeHarness(400);
    h.pacer.pump();
    vi.advanceTimersByTime(400 * 200);
    expect(h.combat!.steps).toBeLessThanOrEqual(128);
    expect(h.pacer.pacing).toBe(false); // la cadena terminó (guard), no cuelga
  });
});

describe("CombatPacer — beat 0 (automatización webdriver)", () => {
  it("drena la tanda SÍNCRONA con tickEnemyTurns (byte-idéntico al flujo previo)", () => {
    const h = makeHarness(0);
    h.pacer.pump();
    expect(h.pacer.pacing).toBe(false); // jamás arma timeout
    expect(h.combat!.steps).toBe(1); // una llamada drena la tanda entera
    expect(h.out).toEqual([[{ kind: "moved" }]]);
  });

  it("combate over en beat 0 → endCombat síncrono", () => {
    const h = makeHarness(0);
    h.combat!.tickEnemyTurns = () => {
      h.combat!.steps++;
      h.combat!.over = true;
      return [];
    };
    h.pacer.pump();
    expect(h.endCombatCalls).toBe(1);
  });
});
