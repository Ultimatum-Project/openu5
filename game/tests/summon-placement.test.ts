/**
 * COLOCACIÓN DEL SUMMON EN COMBATE — CAST2.OVL:0x4c2 (bucle 0x4ec–0x521, bail 0x542).
 *
 * Oráculo relevo-5 (`re/notes/summon-gate-resolved.md`) CERRÓ la mecánica: el picker del
 * summon es el de TABLERO `0x120e` (=`randomBoardCell`: `rand0(15)²`, aceptada si ambas ≤10),
 * NO uno local-al-caster (corrige witness #5, que confundió el label file-relativo de overlay
 * `0x9cb6` con una rutina distinta). El daemon-cast lo envuelve en HASTA 8 intentos; cada
 * tirada FUERA de reja (>10) CUENTA como intento gastado (no reintenta gratis); la primera
 * celda en reja + pasable + desocupada spawnea; agotados los 8 ⇒ no aparece criatura (el maná
 * ya se gastó). Contest ally/hostil `rand30()<INT` sólo en el cast; hostil imprime "Oops..."
 * (DS 0x9532 = fileoff 0x9542). El pergamino salta el contest → siempre aliado, silencioso.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { pickSummonCell, type CombatRng } from "../src/core/combat/formulas.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { OriginalRng } from "../src/core/rng-original.js";
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

// --- picker puro con RNG inyectado -----------------------------------------

/** CombatRng falso: `rand0` devuelve la secuencia guionizada (el arg `n` se ignora,
 *  el picker siempre pide rand0(15)); cuenta las tiradas consumidas. */
function scriptedRng(seq: number[]): CombatRng & { consumed: () => number } {
  let i = 0;
  return {
    rand0: () => {
      if (i >= seq.length) throw new Error(`rng underflow at draw ${i}`);
      return seq[i++]!;
    },
    consumed: () => i,
  } as unknown as CombatRng & { consumed: () => number };
}

const allFree = () => true;
const allBlocked = () => false;

describe("pickSummonCell — bucle de HASTA 8 intentos (CAST2:0x4c2)", () => {
  it("cuaja al 1er intento: 1 celda en reja + libre ⇒ la devuelve, 2 rands", () => {
    const rng = scriptedRng([3, 4]);
    const cell = pickSummonCell(rng, 8, allFree);
    expect(cell).toEqual({ x: 3, y: 4 });
    expect(rng.consumed()).toBe(2); // exactamente 1 par de tiradas
  });

  it("cuaja al 8º intento: 7 fallos (fuera de reja) + acierto ⇒ 16 rands", () => {
    // 7 intentos con x=15 (fuera de reja, y da igual) + 8º = (5,5) libre.
    const seq = [
      15, 0, 15, 1, 15, 2, 15, 3, 15, 4, 15, 5, 15, 6, // 7 intentos fallidos
      5, 5, // 8º: en reja + libre
    ];
    const rng = scriptedRng(seq);
    const cell = pickSummonCell(rng, 8, allFree);
    expect(cell).toEqual({ x: 5, y: 5 });
    expect(rng.consumed()).toBe(16); // 2 rands por intento, SIEMPRE (incl. los fallidos)
  });

  it("cuaja al 8º con 7 celdas OCUPADAS en reja + 8ª libre", () => {
    // 7 intentos en (2,2) ocupada + 8º en (7,3) libre.
    const seq = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 7, 3];
    const free = (x: number, y: number) => x === 7 && y === 3;
    const rng = scriptedRng(seq);
    const cell = pickSummonCell(rng, 8, free);
    expect(cell).toEqual({ x: 7, y: 3 });
    expect(rng.consumed()).toBe(16);
  });

  it("BAIL: 8 tiradas fuera de reja ⇒ null, 16 rands consumidos (maná gastado, sin criatura)", () => {
    const seq = Array.from({ length: 16 }, (_, k) => (k % 2 === 0 ? 15 : 0)); // 8× (15,0)
    const rng = scriptedRng(seq);
    expect(pickSummonCell(rng, 8, allFree)).toBeNull();
    expect(rng.consumed()).toBe(16);
  });

  it("BAIL: 8 celdas en reja pero TODAS ocupadas ⇒ null", () => {
    const seq = Array.from({ length: 16 }, () => 2); // 8× (2,2), todas bloqueadas
    const rng = scriptedRng(seq);
    expect(pickSummonCell(rng, 8, allBlocked)).toBeNull();
    expect(rng.consumed()).toBe(16);
  });

  it("una tirada FUERA de reja CUENTA como intento (no reintenta gratis): 1 intento fuera ⇒ null", () => {
    // Guarda de regresión de la propiedad load-bearing del oráculo: con maxAttempts=1 y una
    // única tirada fuera de reja, NO se busca otra celda — el intento se gasta y se hace bail.
    const rng = scriptedRng([15, 0]);
    expect(pickSummonCell(rng, 1, allFree)).toBeNull();
    expect(rng.consumed()).toBe(2);
  });

  it("aceptación ≤10 en AMBOS ejes (reja 11×11, borde inclusivo)", () => {
    expect(pickSummonCell(scriptedRng([10, 10]), 1, allFree)).toEqual({ x: 10, y: 10 }); // borde OK
    expect(pickSummonCell(scriptedRng([11, 10]), 1, allFree)).toBeNull(); // x fuera
    expect(pickSummonCell(scriptedRng([10, 11]), 1, allFree)).toBeNull(); // y fuera
  });

  it("variante COMSUBS 1-intento: acierta al primero o hace bail (sin bucle)", () => {
    expect(pickSummonCell(scriptedRng([4, 4]), 1, allFree)).toEqual({ x: 4, y: 4 });
    expect(pickSummonCell(scriptedRng([2, 2]), 1, allBlocked)).toBeNull();
  });
});

// --- integración: daemon-cast por playerCast --------------------------------

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const defs = (): EnemyDef[] => buildEnemyDefs(data, additionalFlags);
const meleeDef = (): EnemyDef => defs().find((d) => d.attackRange === 1)!;
const freshState = (): GameState =>
  createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
const party = (state: GameState): PartyCombatant[] =>
  state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));

/** Arena 11×11 abierta (grass) para maximizar celdas de spawn libres. */
const openMap = (): CombatMapData => ({
  index: -1,
  territory: "test",
  name: "test",
  tiles: Array.from({ length: 11 }, () => new Array(11).fill(5)),
  playerStarts: {
    east: [{ x: 2, y: 2 }],
    west: [{ x: 2, y: 2 }],
    north: [{ x: 2, y: 2 }],
    south: [{ x: 2, y: 2 }],
  },
  units: [{ sprite: 0, x: 9, y: 9 }],
  triggers: [],
});

function daemonScene(state: GameState, seed: number): { combat: Combat; caster: Combatant } {
  const combat = new Combat({
    map: openMap(),
    entryDirection: "east",
    party: party(state),
    enemies: [{ def: meleeDef(), count: 1 }],
    seed,
    state,
    defenseValues: data.defenseValues,
    enemyDefs: defs(),
  });
  const players = combat.combatants.filter((c) => c.kind === "player");
  const caster = players[0]!;
  caster.x = 5; caster.y = 5; caster.speed = 99;
  combat.combatants.forEach((c) => { c.counter = 300; });
  caster.counter = 1;
  expect(combat.currentUnit).toBe(caster);
  return { combat, caster };
}

const DAEMON_TYPE = 0x26;
const isDaemon = (c: Combatant) => c.enemyDef?.index === DAEMON_TYPE;

describe("castSummonDaemon (Kal Xen Corp) — contest ally/hostil + 'Oops...'", () => {
  it("INT=0 (contest imposible): daemon HOSTIL + 'Oops...' cuando spawnea", () => {
    // rand30()>=1 siempre; con INT=0 el contest rand30<0 NUNCA pasa ⇒ hostil.
    // Se buscan semillas donde el picker de tablero cuaja (arena casi vacía).
    let sawHostile = false;
    for (const seed of [1, 2, 3, 4, 5, 7, 11, 42]) {
      const state = freshState();
      const { combat, caster } = daemonScene(state, seed);
      caster.int = 0;
      const before = combat.combatants.filter(isDaemon).length;
      const events = combat.playerCast({ kind: "summonDaemon" }, null);
      const spawned = combat.combatants.filter(isDaemon).length > before;
      if (!spawned) continue;
      const daemon = combat.combatants.filter(isDaemon).at(-1)!;
      expect(daemon.charmed).toBe(false); // hostil
      expect(events.some((e) => e.kind === "message" && e.text === "Oops...")).toBe(true);
      sawHostile = true;
      break;
    }
    expect(sawHostile).toBe(true); // al menos una semilla cuajó el spawn
  });

  it("INT=99 (contest siempre pasa): daemon ALIADO y SIN 'Oops...' (silencioso)", () => {
    let sawAlly = false;
    for (const seed of [1, 2, 3, 4, 5, 7, 11, 42]) {
      const state = freshState();
      const { combat, caster } = daemonScene(state, seed);
      caster.int = 99;
      const before = combat.combatants.filter(isDaemon).length;
      const events = combat.playerCast({ kind: "summonDaemon" }, null);
      const spawned = combat.combatants.filter(isDaemon).length > before;
      if (!spawned) continue;
      const daemon = combat.combatants.filter(isDaemon).at(-1)!;
      expect(daemon.charmed).toBe(true); // aliado
      expect(events.some((e) => e.kind === "message" && e.text === "Oops...")).toBe(false);
      sawAlly = true;
      break;
    }
    expect(sawAlly).toBe(true);
  });

  it("pergamino (alwaysAlly): daemon ALIADO sin contest ni 'Oops...' aunque INT=0", () => {
    let sawAlly = false;
    for (const seed of [1, 2, 3, 4, 5, 7, 11, 42]) {
      const state = freshState();
      const { combat, caster } = daemonScene(state, seed);
      caster.int = 0; // irrelevante: el pergamino salta el contest
      const before = combat.combatants.filter(isDaemon).length;
      const events = combat.playerCast({ kind: "summonDaemon", alwaysAlly: true }, null);
      const spawned = combat.combatants.filter(isDaemon).length > before;
      if (!spawned) continue;
      const daemon = combat.combatants.filter(isDaemon).at(-1)!;
      expect(daemon.charmed).toBe(true);
      expect(events.some((e) => e.kind === "message" && e.text === "Oops...")).toBe(false);
      sawAlly = true;
      break;
    }
    expect(sawAlly).toBe(true);
  });
});

// --- In Bet Xen: UNA celda para las CUATRO (CAST.OVL:0x07b4, ficha #6) -------
//
// `in_bet_xen_swarms` (CAST.OVL:0x07b4, cuerpo sellado en frontier-manual) tiene DOS
// bucles, y la clave está en dónde vuelve el segundo:
//   BUCLE 1 (0x07c7, retry-8) — `random_board_cell` (COMBAT.OVL:0x120e, 2 rand por
//     intento) + `combat_cell_occupancy_test(0xbc, x, y)`. Deja la celda elegida en
//     g_cmb_scratch_x/g_cmb_scratch_y. Si los 8 intentos fallan, di=0 y la rutina
//     RETORNA SIN INVOCAR NADA (`or di,di / je 0x83c` @0x07f3).
//   BUCLE 2 (0x07fe) — `kernel_spawn_actor(0x1f, 0, x, y, g_floor)` hasta CUATRO veces
//     (`inc di` / `cmp di,4` @0x0834-0x0838). Su salto de vuelta es **`jmp 0x7fe`**
//     (@0x083a): cae DEBAJO del picker, que está en 0x07c7. ⇒ las cuatro criaturas se
//     invocan con la MISMA x,y — se re-empujan g_cmb_scratch_x/y sin volver a tocarlas.
//
// El port llamaba a `pickSummonCell` UNA VEZ POR CRIATURA: colocación distinta (las
// esparcía por el tablero) y consumo de rand distinto (hasta 4×16 = 64 en vez de ≤16).
const SWARM = 0x1f;
const swarmEffect = { kind: "summonSwarms" as const, monsterType: SWARM, maxCount: 4 };
const isSwarm = (c: Combatant): boolean => c.enemyDef?.index === SWARM;

/** Tiradas consumidas entre dos semillas: avanza un RNG de referencia desde `from`
 *  hasta reencontrar `to`. Cada tirada del kernel es UN paso crudo (`next` → `nextRaw16`),
 *  así que el nº de pasos ES el nº de tiradas. −1 si no se alcanza dentro del tope. */
function drawsBetween(from: number, to: number, cap = 400): number {
  const ref = new OriginalRng(from);
  for (let n = 0; n <= cap; n++) {
    if (ref.getSeed() === to) return n;
    ref.nextRaw16();
  }
  return -1;
}

describe("In Bet Xen — las CUATRO en la celda del bucle 1 (CAST.OVL:0x07b4)", () => {
  /** Semilla cuyo PRIMER intento del picker cae en reja y libre (k=1). Se comprueba
   *  dentro del test con el nº de tiradas, no se da por supuesto. */
  const SEED_K1 = 3;

  it("las 4 criaturas comparten UNA sola celda (jmp 0x7fe, no 0x7c7)", () => {
    const state = freshState();
    const { combat } = daemonScene(state, SEED_K1);
    const before = combat.combatants.filter(isSwarm).length;
    combat.playerCast(swarmEffect, null);
    const swarms = combat.combatants.filter(isSwarm);
    expect(swarms.length - before).toBe(4); // el tope de `cmp di,4`
    const celdas = new Set(swarms.map((c) => `${c.x},${c.y}`));
    expect(celdas.size).toBe(1); // ← con el defecto: hasta 4 celdas distintas
  });

  it("consume UN picker, no cuatro: 2·k + 4 tiradas (k=1 ⇒ 6, no 12)", () => {
    const state = freshState();
    const { combat } = daemonScene(state, SEED_K1);
    const antes = combat.finalSeed;
    combat.playerCast(swarmEffect, null);
    const tiradas = drawsBetween(antes, combat.finalSeed);
    // Regla DERIVADA del asm (no leída de la implementación): 2 rand por intento del
    // ÚNICO picker (bucle 1) + 1 rand de velocidad por criatura invocada (rand0(7) de
    // `enemySpawnSpeed`, dentro de kernel_spawn_actor). Con k=1: 2·1 + 4 = 6.
    // Con el defecto son CUATRO pickers: 4·2 + 4 = 12.
    expect(tiradas).toBe(6);
  });

  it("si el picker agota los 8 intentos NO invoca nada (or di,di / je 0x83c)", () => {
    const state = freshState();
    const { combat } = daemonScene(state, SEED_K1);
    // Tablero saturado: ninguna celda libre ⇒ los 8 intentos fallan.
    for (let y = 0; y <= 10; y++) {
      for (let x = 0; x <= 10; x++) {
        combat.combatants.push({
          ...combat.combatants[0]!,
          id: 9000 + y * 11 + x,
          kind: "enemy",
          x,
          y,
        } as Combatant);
      }
    }
    const before = combat.combatants.filter(isSwarm).length;
    combat.playerCast(swarmEffect, null);
    expect(combat.combatants.filter(isSwarm).length).toBe(before);
  });
});
