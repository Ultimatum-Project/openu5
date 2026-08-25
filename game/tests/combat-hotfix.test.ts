/**
 * HOTFIX combate 2026-07-22 (re/notes/combate-hotfix-20260722.md) — piezas de core:
 *
 *  1. `tickEnemyTurnStep()` = UNA acción de IA por llamada (el paso del while de
 *     `tickEnemyTurns`), para que la piel pacee la tanda a ~400 ms/acción (T11).
 *     Encadenar pasos debe ser BYTE-IDÉNTICO al drain entero (misma secuencia de
 *     eventos y mismo consumo de RNG) — es la garantía de paridad del fix #1.
 *  2. `playerAttackCancel()` — ESC/Space-en-el-actor del Aim de ataque: el binario
 *     CONSUME el golpe (COMSUBS 0x0C52 @0x0cef-0x0cfa "Nothing!" en melé; 0x0A68
 *     @0x0ab8 silencio en ranged) y el turno cae al agotar la cola de armas.
 *  3. `playerYieldTurn()` — cesión de turno del Set Active Plr (COMBAT @0x0b79:
 *     salida sin acción y sin housekeeping); 0 rands, sin mensaje.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import {
  buildEnemyDefs,
  type EnemyDef,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../src/core/combat/enemies.js";
import { Combat, type CombatMapData, type PartyCombatant, type CombatEvent } from "../src/core/combat/combat.js";

function load<T>(rel: string): T {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");

function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}
function byName(name: string): EnemyDef {
  const d = buildEnemyDefs(data, additionalFlags).find((e) => e.name === name);
  if (!d) throw new Error(`enemigo no encontrado: ${name}`);
  return d;
}

/** Arena 11×11 de hierba abierta (misma síntesis que aim-side-aware). */
function openField(): CombatMapData {
  const GRASS = 5;
  const tiles: number[][] = [];
  for (let y = 0; y < 11; y++) {
    const row: number[] = [];
    for (let x = 0; x < 11; x++) row.push(GRASS);
    tiles.push(row);
  }
  const starts = { east: [{ x: 0, y: 5 }], west: [{ x: 0, y: 5 }], south: [{ x: 0, y: 5 }], north: [{ x: 0, y: 5 }] };
  return {
    index: 997, territory: "britannia", name: "SyntheticHotfixField", tiles,
    playerStarts: starts,
    units: [
      { sprite: 0, x: 10, y: 5 }, { sprite: 0, x: 10, y: 9 },
      { sprite: 0, x: 10, y: 1 }, { sprite: 0, x: 9, y: 3 },
    ],
    triggers: [],
  };
}

function makeCombat(opts?: { seed?: number; count?: number; weapons?: { id?: number; attack: number; range: number }[] }): Combat {
  const state = freshState();
  for (const c of state.characters) { c.currentHp = 200; c.maxHp = 200; }
  const p: PartyCombatant[] = state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: opts?.weapons ?? [{ attack: 10, range: 1 }] }));
  return new Combat({
    map: openField(),
    entryDirection: "east",
    party: p,
    enemies: [{ def: byName("Giant Spider"), count: opts?.count ?? 3 }],
    seed: opts?.seed ?? 4242,
    state,
    defenseValues: data.defenseValues,
  });
}

/** Pasa los turnos de PJ hasta que el siguiente actor sea IA (o agote la guarda). */
function reachAiTurn(combat: Combat): void {
  let guard = 0;
  while (guard++ < 32) {
    const cur = combat.currentUnit;
    if (!cur || combat.over) return;
    if (cur.kind === "enemy" || cur.charmed) return;
    combat.playerPass();
  }
}

describe("tickEnemyTurnStep — una acción de IA por llamada (paceo T11)", () => {
  it("cada paso procesa como mucho UN actor de IA y devuelve al tocar un PJ", () => {
    const combat = makeCombat();
    reachAiTurn(combat);
    expect(combat.currentUnit?.kind).toBe("enemy");
    let steps = 0;
    let guard = 0;
    while (!combat.over && (combat.currentUnit?.kind === "enemy" || combat.currentUnit?.charmed) && guard++ < 64) {
      const before = combat.currentUnit;
      combat.tickEnemyTurnStep();
      steps++;
      // Tras un paso, el actor de IA anterior ya no es el actual (avanzó UN turno).
      expect(combat.currentUnit).not.toBe(before);
    }
    expect(steps).toBeGreaterThan(0);
    // Al agotar la tanda, el actual es un PJ controlable (o el combate acabó).
    if (!combat.over) expect(combat.currentUnit?.kind).toBe("player");
    // Con la tanda agotada, un paso extra es no-op sin eventos.
    expect(combat.tickEnemyTurnStep()).toEqual([]);
  });

  it("PARIDAD: encadenar pasos = drain entero de tickEnemyTurns (eventos y RNG idénticos)", () => {
    // Dos combates gemelos (misma seed): en A se drena la tanda con
    // tickEnemyTurns(); en B se encadena tickEnemyTurnStep(). La secuencia de
    // eventos debe ser IDÉNTICA — mismo consumo del stream de RNG en el mismo
    // orden (la garantía que protege digests/paridad bajo beat>0).
    const a = makeCombat({ seed: 909, count: 4 });
    const b = makeCombat({ seed: 909, count: 4 });
    reachAiTurn(a);
    reachAiTurn(b);
    const evA = a.tickEnemyTurns();
    const evB: CombatEvent[] = [];
    let guard = 0;
    while (!b.over && (b.currentUnit?.kind === "enemy" || b.currentUnit?.charmed) && guard++ < 512) {
      evB.push(...b.tickEnemyTurnStep());
    }
    expect(evB).toEqual(evA);
    // Y los dos mundos quedan en el mismo estado observable de arena.
    const snap = (c: Combat) => c.combatants.map((u) => ({ id: u.id, x: u.x, y: u.y, hp: u.hp, status: u.status }));
    expect(snap(b)).toEqual(snap(a));
    expect(b.currentUnit?.id).toBe(a.currentUnit?.id);
  });
});

describe("playerAttackCancel — el Aim cancelado CONSUME el golpe (COMSUBS 0x0C52/0x0A68)", () => {
  it("melé: 'Nothing!' + el turno avanza (DS 0x9a8a)", () => {
    const combat = makeCombat();
    const cur = combat.currentUnit!;
    expect(cur.kind).toBe("player");
    const ev = combat.playerAttackCancel();
    expect(ev.some((e) => e.kind === "message" && e.text === "Nothing!")).toBe(true);
    expect(combat.currentUnit).not.toBe(cur); // turno gastado
  });

  it("ranged: silencio (0x0A68 @0x0ab8 sale sin print) + turno gastado", () => {
    const combat = makeCombat({ weapons: [{ id: 0x1a, attack: 99, range: 3 }] });
    const cur = combat.currentUnit!;
    expect(cur.kind).toBe("player");
    const ev = combat.playerAttackCancel();
    expect(ev.some((e) => e.text === "Nothing!")).toBe(false);
    expect(combat.currentUnit).not.toBe(cur);
  });

  it("con DOS armas, la primera cancelación NO cierra el turno (queda la cola)", () => {
    const combat = makeCombat({
      weapons: [
        { id: 0x02, attack: 5, range: 1 },
        { id: 0x03, attack: 5, range: 1 },
      ],
    });
    const cur = combat.currentUnit!;
    expect(cur.kind).toBe("player");
    combat.playerAttackCancel(); // arma 1 cancelada ("Nothing!")
    expect(combat.currentUnit).toBe(cur); // sigue su turno (arma 2 pendiente)
    combat.playerAttackCancel(); // arma 2 cancelada
    expect(combat.currentUnit).not.toBe(cur); // ahora sí avanza
  });
});

describe("playerYieldTurn — cesión de turno del Set Active (COMBAT @0x0b79)", () => {
  it("avanza el turno sin mensajes y sin consumir RNG del combate", () => {
    const a = makeCombat({ seed: 31337 });
    const b = makeCombat({ seed: 31337 });
    const curA = a.currentUnit!;
    expect(curA.kind).toBe("player");
    const ev = a.playerYieldTurn();
    expect(ev.filter((e) => e.kind === "message" || e.kind === "echo")).toEqual([]);
    expect(a.currentUnit).not.toBe(curA);
    // Gemelo: playerReady (advanceTurn puro ya verificado) aterriza en el MISMO
    // siguiente actor — yield no consume rands extra.
    b.currentUnit;
    b.playerReady();
    expect(a.currentUnit?.id).toBe(b.currentUnit?.id);
  });
});
