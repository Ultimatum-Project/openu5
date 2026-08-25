/**
 * Combate sobre el stream vivo (Fase 1.1, Task 3). El binario comparte un único
 * g_rng_seed que COMBAT.OVL/COMSUBS.OVL churnean; el clon lo modela sembrando el
 * CombatRng con `liveRng.getSeed()` en el encuentro y resincronizando el stream
 * vivo con `Combat.finalSeed` al cerrar (endCombat). Este test fija ambas mitades:
 *   (a) dos combates con la MISMA semilla producen la MISMA traza y el mismo
 *       finalSeed (el combate es determinista por semilla — fork del stream);
 *   (b) tras endCombat, liveRng.getSeed() === finalSeed (resync del g_rng_seed).
 * Cita: combat.ts cabecera (RNG = kernel OriginalRng), re/verified/combat.md.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  createNewGame,
  type ExtractedInitialState,
  type GameState,
} from "../src/core/state.js";
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
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";

function load<T>(rel: string): T {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>(
  "../src/core/data/AdditionalEnemyFlags.json",
);
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}

function defs(): EnemyDef[] {
  return buildEnemyDefs(data, additionalFlags);
}

function byName(name: string): EnemyDef {
  const d = defs().find((e) => e.name === name);
  if (!d) throw new Error(`enemigo no encontrado: ${name}`);
  return d;
}

function party(state: GameState): PartyCombatant[] {
  return state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({
      charIdx: i,
      record,
      weapons: [{ attack: 10, range: 1 }],
    }));
}

const campFire = (): CombatMapData => combatMaps[0]!;

/** Corre un combate hasta el final con una IA de PJ trivial (atacar si adyacente). */
function runToEnd(combat: Combat): CombatEvent[] {
  const events: CombatEvent[] = [];
  let ticks = 0;
  while (!combat.over && ticks < 400) {
    ticks++;
    const cur = combat.currentUnit;
    if (!cur) break;
    if (cur.kind === "enemy") {
      events.push(...combat.tickEnemyTurns());
      continue;
    }
    const foe = combat.combatants.find((c) => c.kind === "enemy" && c.status === "active");
    if (!foe) {
      // Bando enemigo limpio: la VICTORIA no cierra el combate (linger). Para llegar al
      // fin real, la party SALE andando por el borde (misma salida para todos). Determinista.
      events.push(...combat.playerEscape("east"));
      continue;
    }
    const dist = Math.max(Math.abs(cur.x - foe.x), Math.abs(cur.y - foe.y));
    if (dist <= 1) events.push(...combat.playerAttack(foe.x, foe.y));
    else events.push(...combat.playerPass());
  }
  return events;
}

function newSpiderCombat(state: GameState, seed: number): Combat {
  return new Combat({
    map: campFire(),
    entryDirection: "east",
    party: party(state),
    enemies: [{ def: byName("Giant Spider"), count: 1 }],
    seed,
    state,
    defenseValues: data.defenseValues,
  });
}

// --- Game mínimo para ejercitar endCombat (no necesita combatResources) -------

function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => 5),
  );
  return { overworld, underworld: overworld, smallMaps: new Map() };
}
const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const combatResources: CombatResources = {
  combatMaps: [],
  enemyDefs: [],
  attackValues: [],
  attackRangeValues: [],
  defenseValues: [],
};

function makeGame(state: GameState): Game {
  return new Game({} as ExtractedInitialState, makeWorld(), gameData, state, {
    combatResources,
  });
}

describe("combate sobre el stream vivo (F.2, Task 3)", () => {
  it("(a) misma semilla ⇒ misma traza y mismo finalSeed", () => {
    // Estados independientes para no compartir mutación de HP entre las dos peleas.
    const a = newSpiderCombat(freshState(), 0x51a3);
    const b = newSpiderCombat(freshState(), 0x51a3);
    const evA = runToEnd(a);
    const evB = runToEnd(b);
    expect(a.over).toBe(true);
    expect(JSON.stringify(evA)).toBe(JSON.stringify(evB));
    // El fork es determinista: el CombatRng termina en el mismo g_rng_seed.
    expect(a.finalSeed).toBe(b.finalSeed);
  });

  it("(a') semillas distintas divergen (el combate consume el stream)", () => {
    const a = newSpiderCombat(freshState(), 0x0001);
    const b = newSpiderCombat(freshState(), 0x7fff);
    runToEnd(a);
    runToEnd(b);
    // Semillas distintas ⇒ trazas distintas ⇒ finalSeed distinto (con prob. ~1).
    expect(a.finalSeed).not.toBe(b.finalSeed);
  });

  it("(b) endCombat resincroniza liveRng con Combat.finalSeed", () => {
    const state = freshState();
    const combat = newSpiderCombat(state, 0x2020);
    runToEnd(combat);
    const finalSeed = combat.finalSeed;

    const game = makeGame(state);
    // Inyecta el combate ya resuelto y ciérralo por el camino real (endCombat).
    (game as unknown as { combat: Combat }).combat = combat;
    game.endCombat();
    // El stream vivo continúa desde donde lo dejó el combate (g_rng_seed compartido).
    expect((game as unknown as { liveRng: { getSeed(): number } }).liveRng.getSeed()).toBe(
      finalSeed,
    );
  });

  it("(c) endCombat NO re-acredita el oro del botín (ya se recogió con (G)et sobre el tablero)", () => {
    const state = freshState();
    state.gold = 9990;
    const game = makeGame(state);
    // El botín entra al estado al RECOGER cada pieza en la arena con (G)et
    // (Combat.resolveBoardGet → applyLootGrant, que ya satura con add_word_capped) — el
    // (O)pen sólo lo derrama al suelo. endCombat NO debe volver a sumarlo
    // (sería doble conteo): la victoria no cierra el combate, el oro ya está en el estado.
    const stub = {
      victory: true,
      escapeFloorDelta: null,
      combatants: [] as unknown[],
      finalSeed: 0,
      collectSpoils: () => ({ gold: 100, xpByChar: new Map<number, number>() }),
    };
    (game as unknown as { combat: unknown }).combat = stub;
    game.endCombat();
    expect(state.gold).toBe(9990); // SIN cambio: endCombat no acredita botín
  });

  it("(d) endCombat NO imprime 'Leave!' de cierre — es PER-MIEMBRO en la salida por el borde (careo-combate T9)", () => {
    // RE-BASELINE T9: el "Leave!" del vídeo-O f140 era el eco del ÚLTIMO miembro
    // saliendo (SJOG 0x1bb2 → 0x1bf4 DS 0x8ea6, uno por miembro — Combat.playerEscape);
    // el print único de cierre del port DUPLICABA esa línea. endCombat no imprime nada
    // propio en la victoria (VICTORY! ya se anunció al limpiar el bando, 0x0cf6).
    const game = makeGame(freshState());
    const stub = {
      victory: true,
      escapeFloorDelta: null,
      combatants: [] as unknown[],
      finalSeed: 0,
      collectSpoils: () => ({ gold: 0, xpByChar: new Map<number, number>() }),
    };
    (game as unknown as { combat: unknown }).combat = stub;
    const texts = game
      .endCombat()
      .filter((e) => e.kind === "message")
      .map((e) => (e as { text: string }).text);
    expect(texts).not.toContain("Leave!");
    // "VICTORY!" ya se anunció DENTRO del combate (al limpiar el bando enemigo, 0x0cf6):
    // endCombat NO re-anuncia victoria ni imprime cierre.
    expect(texts).not.toContain("VICTORY!");
  });

  it("(e) 'BATTLE IS LOST!' NO imprime 'Leave!' (party aniquilada, nadie sale)", () => {
    const game = makeGame(freshState());
    const stub = {
      victory: false,
      escapeFloorDelta: null,
      combatants: [] as unknown[],
      finalSeed: 0,
      collectSpoils: () => ({ gold: 0, xpByChar: new Map<number, number>() }),
    };
    (game as unknown as { combat: unknown }).combat = stub;
    const texts = game
      .endCombat()
      .filter((e) => e.kind === "message")
      .map((e) => (e as { text: string }).text);
    expect(texts).toContain("BATTLE IS LOST!");
    expect(texts).not.toContain("Leave!");
  });

  it("(b') el fork NO consume el stream vivo; el combate churnea su copia", () => {
    // El seed del combate es una COPIA del valor vivo (fork): construir el
    // combate no avanza liveRng; sólo endCombat lo resincroniza con finalSeed.
    const state = freshState();
    const game = makeGame(state);
    const live = game as unknown as { liveRng: { seed(n: number): void; getSeed(): number } };
    live.liveRng.seed(0x1234);
    const before = live.liveRng.getSeed();
    const combat = newSpiderCombat(state, live.liveRng.getSeed());
    expect(live.liveRng.getSeed()).toBe(before); // el fork no toca el stream vivo
    runToEnd(combat);
    expect(combat.finalSeed).not.toBe(before); // el combate SÍ churnea su copia
  });
});
