/**
 * TIME-STOP (An Tym) en COMBATE — #42 ítem 3. Con `state.timeSpell === "T"`
 * (g_time_spell==0x54) el original CONGELA a los enemigos:
 *   1. saltan su turno entero — COMBAT 0x0418 (`cmp [g_time_spell],0x54 / jmp 0x540`),
 *      antes de cualquier tirada (cero consumo de RNG ese turno);
 *   2. su DEX efectiva de DEFENSA es 1 — COMBAT 0x139A (rama 0x139d-0x13b5, gate
 *      `flag 0x40` = combatiente ENEMIGO, confirmado por COMBAT 0x12b0) → son
 *      trivialmente golpeables.
 * El flag 0x40 vive en el array de combate DS:0xba16 (no en el bitmap estático
 * enemyFlags, donde 0x40=ranged); en el port es `kind === "enemy"`.
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
  type CombatMapData,
  type CombatEvent,
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

/** Índice 12: dex 30, hp 99 — dex alta para discriminar la defensa. */
const HIGH_DEX_ENEMY = 12;
const ACTION_KINDS = new Set(["attacked", "missed", "moved", "died"]);

function makeCombat(state: GameState, seed: number): Combat {
  return new Combat({
    map: campFire(),
    entryDirection: "east",
    party: party(state),
    enemies: [{ def: defs()[HIGH_DEX_ENEMY]!, count: 1 }],
    seed,
    state,
    defenseValues: data.defenseValues,
  });
}

describe("Time-stop en combate — enemigos congelados (#42 · COMBAT 0x0418 + 0x139A)", () => {
  it("bajo time-stop el enemigo SALTA su turno: sin acción, sin daño a la party (0x0418)", () => {
    const state = freshState();
    state.timeSpell = "T";
    const combat = makeCombat(state, 777);
    const player = combat.combatants.find((c) => c.kind === "player")!;
    const enemy = combat.combatants.find((c) => c.kind === "enemy")!;
    player.x = 5; player.y = 5;
    enemy.x = 6; enemy.y = 5; // adyacente → sin congelar, atacaría
    enemy.counter = 1; player.counter = 100; // el enemigo actúa primero
    const hpBefore = combat.combatants
      .filter((c) => c.kind === "player")
      .reduce((s, c) => s + c.hp, 0);

    const events = combat.tickEnemyTurns();

    // Ningún evento de ACCIÓN del enemigo (solo avances de turno).
    expect(events.some((e) => ACTION_KINDS.has(e.kind))).toBe(false);
    // La party no recibe daño; el enemigo no se movió.
    const hpAfter = combat.combatants
      .filter((c) => c.kind === "player")
      .reduce((s, c) => s + c.hp, 0);
    expect(hpAfter).toBe(hpBefore);
    expect({ x: enemy.x, y: enemy.y }).toEqual({ x: 6, y: 5 });
  });

  it("SIN time-stop el mismo enemigo adyacente SÍ actúa (discriminante del gate)", () => {
    const state = freshState(); // timeSpell undefined
    const combat = makeCombat(state, 777);
    const player = combat.combatants.find((c) => c.kind === "player")!;
    const enemy = combat.combatants.find((c) => c.kind === "enemy")!;
    player.x = 5; player.y = 5;
    enemy.x = 6; enemy.y = 5;
    enemy.counter = 1; player.counter = 100;

    const events = combat.tickEnemyTurns();
    expect(events.some((e) => ACTION_KINDS.has(e.kind))).toBe(true);
  });

  it("bajo time-stop la DEX de defensa del enemigo = 1 → se acierta MÁS (0x139A), monótono", () => {
    // Mismo seed con/sin time-stop: el stream RNG es idéntico hasta la tirada de
    // acierto (defenseStat no consume rand), así que la diferencia de acierto es
    // puramente el umbral (dex real vs 1). Barremos semillas: los aciertos bajo
    // time-stop son un SUPERCONJUNTO de los normales (monótono) y estrictamente más.
    let hitsNormal = 0;
    let hitsFrozen = 0;
    let violations = 0;
    const SEEDS = 60;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const attack = (timeStop: boolean): boolean => {
        const state = freshState();
        if (timeStop) state.timeSpell = "T";
        const combat = makeCombat(state, seed);
        const player = combat.combatants.find((c) => c.kind === "player")!;
        const enemy = combat.combatants.find((c) => c.kind === "enemy")!;
        player.x = 5; player.y = 5;
        enemy.x = 6; enemy.y = 5;
        player.counter = 1; enemy.counter = 200; // el PJ pega primero
        const hpBefore = enemy.hp;
        const ev: CombatEvent[] = combat.playerAttack(enemy.x, enemy.y);
        // "acierto" = el enemigo perdió HP o hubo evento attacked con daño.
        return enemy.hp < hpBefore || ev.some((e) => e.kind === "attacked" && (e.damage ?? 0) > 0);
      };
      const n = attack(false);
      const f = attack(true);
      if (n) hitsNormal++;
      if (f) hitsFrozen++;
      if (n && !f) violations++; // congelar NUNCA debe empeorar el acierto
    }
    expect(violations).toBe(0); // monotonía: normal ⊆ frozen
    expect(hitsFrozen).toBeGreaterThan(hitsNormal); // dex 1 acierta estrictamente más
  });
});
