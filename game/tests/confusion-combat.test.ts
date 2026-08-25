/**
 * CONFUSIÓN (Quas An Wis) en COMBATE — #42 ítem 2. Con `state.timeSpell === "C"`
 * (g_time_spell==0x43) la selección de objetivo de la IA (COMBAT 0x0D30) tira
 * `rand30() > INT(actor)`; si pasa, el actor confundido INVIERTE el bando objetivo
 * (0x0d79) y ataca a su PROPIO bando. La tirada se consume SÓLO bajo 'C' (gate
 * 0x0d62), tras determinar el bando y antes del barrido → el stream normal no cambia.
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
import {
  Combat,
  type Combatant,
  type CombatMapData,
  type PartyCombatant,
} from "../src/core/combat/combat.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");
const defs = (): EnemyDef[] => buildEnemyDefs(data, additionalFlags);
const campFire = (): CombatMapData => combatMaps[0]!;
const freshState = (): GameState =>
  createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
const party = (state: GameState): PartyCombatant[] =>
  state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));

/** Un enemigo cuerpo a cuerpo (attackRange 1). */
const meleeDef = (): EnemyDef => defs().find((d) => d.attackRange === 1)!;

/** Coloca 2 enemigos adyacentes (5,5)/(6,5) y la party lejos (1,1). E1 actúa primero. */
function twoEnemies(
  state: GameState,
  seed: number,
): { combat: Combat; e1: Combatant; e2: Combatant } {
  const md = meleeDef();
  const combat = new Combat({
    map: campFire(),
    entryDirection: "east",
    party: party(state),
    enemies: [{ def: md, count: 2 }],
    seed,
    state,
    defenseValues: data.defenseValues,
  });
  const enemies = combat.combatants.filter((c) => c.kind === "enemy");
  const players = combat.combatants.filter((c) => c.kind === "player");
  const e1 = enemies[0]!;
  const e2 = enemies[1]!;
  e1.x = 5; e1.y = 5;
  e2.x = 6; e2.y = 5; // adyacente a E1
  players.forEach((p, i) => { p.x = 1; p.y = 1 + i; }); // la party, lejos
  e1.counter = 1; e2.counter = 300; // E1 actúa; E2 no llega a actuar
  players.forEach((p) => { p.counter = 300; });
  return { combat, e1, e2 };
}

describe("Confusión en combate — el actor confundido ataca a su propio bando (#42 · COMBAT 0x0D30)", () => {
  it("bajo 'C' con INT=0 (siempre confuso) E1 MELEA a E2 (mismo bando), no a la party lejana", () => {
    const state = freshState();
    state.timeSpell = "C";
    const { combat, e1, e2 } = twoEnemies(state, 555);
    e1.int = 0; // rand30() (1..30) > 0 siempre → confuso garantizado
    e2.int = 30; // rand30() > 30 imposible → E2 nunca se confunde

    combat.tickEnemyTurns();

    // El melee fija target.lastAttacker ANTES de la tirada de acierto (0x0226):
    // prueba de a QUIÉN apuntó E1, con o sin acierto.
    expect(e2.lastAttacker).toBe(e1.id); // E1 atacó a su propio bando
  });

  it("SIN 'C' el mismo E1 NO ataca a E2 (apunta a la party); discriminante del gate", () => {
    const state = freshState(); // timeSpell undefined
    const { combat, e1, e2 } = twoEnemies(state, 555);
    e1.int = 0; // irrelevante sin 'C' (no se tira)

    combat.tickEnemyTurns();

    expect(e2.lastAttacker).not.toBe(e1.id); // E1 no melea a su bando
    expect(e2.lastAttacker).toBeNull();
  });

  it("bajo 'C' con INT alta (>= 30) el actor RESISTE la confusión (rand30 nunca supera INT)", () => {
    const state = freshState();
    state.timeSpell = "C";
    const { combat, e1, e2 } = twoEnemies(state, 555);
    e1.int = 30; // rand30() > 30 imposible → nunca confuso → targeting normal

    combat.tickEnemyTurns();

    expect(e2.lastAttacker).toBeNull(); // no atacó a su bando
  });
});
