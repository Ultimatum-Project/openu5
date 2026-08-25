/**
 * IN QUAS XEN (idx 38) — el clon de la criatura apuntada, ficha #340.
 * Derivación: `in_quas_xen_clone_creature` CAST.OVL:0x0b28 → `ret` en 0x0c97 (154 filas).
 * Los cinco `call` cruzados están resueltos en el docblock de `castIllusion`
 * (game/src/core/combat/combat.ts) con `dispatch_table`, base near-call de CAST.OVL 0xbf80.
 *
 * Lo que estos tests AFIRMAN (no sólo niegan):
 *  - la celda EXACTA donde cae el clon, en crudo, para tres semillas;
 *  - que el clon es una COPIA del registro del objetivo (no una criatura nueva);
 *  - que el consumo de RNG son 2 tiradas `rand0(15)` POR INTENTO y que el bucle
 *    NO tiene cota (una semilla gasta 10 intentos, más que el retry-8 del summon);
 *  - que la salida sin objetivo ocurre ANTES del picker (no mueve el stream).
 *
 * Las cifras de celda y de tiradas se obtuvieron por REPLAY INDEPENDIENTE de
 * `OriginalRng` desde el estado pre-cast (no calculadas desde `castIllusion`), y van
 * aquí como literales.
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
import { OriginalRng } from "../src/core/rng-original.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const defs = (): EnemyDef[] => buildEnemyDefs(data, additionalFlags);

/** Arena 11×11 de hierba (tile 5, transitable): lo único que rechaza una celda es
 *  un ocupante, así que el picker queda aislado del terreno. */
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
  units: Array.from({ length: 16 }, (_, i) => ({ sprite: 0, x: i % 11, y: 8 + Math.floor(i / 11) })),
  triggers: [],
});

/** Escenario fijo: el PJ activo en (2,2) apunta al enemigo de (4,2). */
function escena(seed: number): { combat: Combat; caster: Combatant; objetivo: Combatant } {
  const state: GameState = createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
  const party: PartyCombatant[] = state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));
  const melee = defs().find((d) => d.attackRange === 1)!;
  const combat = new Combat({
    map: openMap(),
    entryDirection: "east",
    party,
    enemies: [{ def: melee, count: 2 }],
    seed,
    state,
    defenseValues: data.defenseValues,
    enemyDefs: defs(),
  });
  const caster = combat.combatants.find((c) => c.kind === "player")!;
  const objetivo = combat.combatants.filter((c) => c.kind === "enemy")[0]!;
  caster.x = 2;
  caster.y = 2;
  for (const c of combat.combatants) c.counter = 300;
  caster.counter = 1;
  objetivo.x = 4;
  objetivo.y = 2;
  return { combat, caster, objetivo };
}

/** Cuántas `rand0(15)` separan dos estados del stream, por replay independiente. */
function tiradasEntre(semillaInicial: number, semillaFinal: number): number {
  const r = new OriginalRng(semillaInicial);
  for (let i = 0; i <= 200; i++) {
    if (r.getSeed() === semillaFinal) return i;
    r.next(0, 15);
  }
  return -1;
}

describe("In Quas Xen — colocación del clon (CAST.OVL:0x0b28 + COMBAT.OVL:0x120e)", () => {
  // Celdas EN CRUDO: primer par (x,y) de la secuencia `rand0(15)` con ambos ≤10 y
  // la celda desocupada, replicado aparte con OriginalRng desde el estado pre-cast.
  const casos: [number, number, number, number][] = [
    // semilla, x, y, tiradas rand0(15)
    [0x1234, 5, 10, 4],
    [7, 9, 1, 20],
    [99, 2, 6, 4],
  ];

  for (const [seed, x, y, tiradas] of casos) {
    it(`semilla ${seed}: el clon cae en (${x},${y}) tras ${tiradas} tiradas`, () => {
      const { combat, objetivo } = escena(seed);
      const antes = combat.rngSeed;
      const n0 = combat.combatants.length;
      combat.playerCast({ kind: "illusion" }, { x: objetivo.x, y: objetivo.y });

      const nuevos = combat.combatants.slice(n0);
      expect(nuevos).toHaveLength(1);
      expect({ x: nuevos[0]!.x, y: nuevos[0]!.y }).toEqual({ x, y });
      expect(tiradasEntre(antes, combat.rngSeed)).toBe(tiradas);
    });
  }

  it("el bucle NO tiene cota: la semilla 7 gasta 10 intentos, más que el retry-8 del summon", () => {
    // 20 tiradas / 2 por intento = 10 intentos. Un picker con el tope del summon
    // (SUMMON_MAX_ATTEMPTS = 8) habría abandonado sin clonar en el 8º.
    const { combat, objetivo } = escena(7);
    const antes = combat.rngSeed;
    const n0 = combat.combatants.length;
    combat.playerCast({ kind: "illusion" }, { x: objetivo.x, y: objetivo.y });
    const intentos = tiradasEntre(antes, combat.rngSeed) / 2;
    expect(intentos).toBe(10);
    expect(intentos).toBeGreaterThan(8);
    expect(combat.combatants).toHaveLength(n0 + 1); // y SÍ clonó pese a pasar de 8
  });

  it("el clon COPIA el registro del objetivo (movsw×4 dos veces), con id propio", () => {
    const { combat, objetivo } = escena(0x1234);
    const n0 = combat.combatants.length;
    const antesDelClon = {
      enemyDef: objetivo.enemyDef,
      hp: objetivo.hp,
      maxHp: objetivo.maxHp,
      str: objetivo.str,
      dex: objetivo.dex,
      int: objetivo.int,
      speed: objetivo.speed,
      charmed: objetivo.charmed,
    };
    combat.playerCast({ kind: "illusion" }, { x: objetivo.x, y: objetivo.y });
    const clon = combat.combatants[n0]!;

    // AFIRMA la copia campo a campo (no basta con «no es el lanzador»).
    expect(clon.enemyDef).toBe(antesDelClon.enemyDef);
    expect(clon.hp).toBe(antesDelClon.hp);
    expect(clon.maxHp).toBe(antesDelClon.maxHp);
    expect(clon.str).toBe(antesDelClon.str);
    expect(clon.dex).toBe(antesDelClon.dex);
    expect(clon.int).toBe(antesDelClon.int);
    expect(clon.charmed).toBe(antesDelClon.charmed); // el bit 0x01 (bando) viaja en la copia
    // La velocidad se COPIA: el clon no pasa por `kernel_spawn_actor`, así que no
    // re-tira el rand0(7) del spawn (por eso el total de tiradas es PAR).
    expect(clon.speed).toBe(antesDelClon.speed);
    // …y es un actor DISTINTO, en otra celda.
    expect(clon.id).not.toBe(objetivo.id);
    expect({ x: clon.x, y: clon.y }).not.toEqual({ x: objetivo.x, y: objetivo.y });
  });

  it("sin criatura en la celda apuntada no clona Y no mueve el stream (jge de 0x0b67)", () => {
    const { combat } = escena(0x1234);
    const antes = combat.rngSeed;
    const n0 = combat.combatants.length;
    combat.playerCast({ kind: "illusion" }, { x: 9, y: 9 }); // celda vacía de la arena
    expect(combat.combatants).toHaveLength(n0); // no clona
    expect(combat.rngSeed).toBe(antes); // la salida precede al picker: 0 tiradas
  });
});
