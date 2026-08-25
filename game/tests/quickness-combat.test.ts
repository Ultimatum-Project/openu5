/**
 * REL TYM ('Q', quickness) en COMBATE — tarjeta #203.
 *
 * Derivado LEYENDO `re/disasm/COMBAT.OVL.asm` (rutina de turno de IA 0x03f4, cuya
 * identidad fija el caller 0x0c84-0x0c90: `call 0xffffb3b6(g_cmb_actor)` no-cero →
 * `call 0x3f4`, cero → `call 0x63e` = turno de PJ). El tramo:
 *
 * | offset   | bytes / mnemónico                          | destino  | lectura |
 * |----------|--------------------------------------------|----------|---------|
 * | `0x0418` | `cmp byte ptr [g_time_spell], 0x54`        | —        | 'T' An Tym |
 * | `0x041d` | `jne 0x422`                                | `0x0422` | |
 * | `0x041f` | `jmp 0x540`                                | `0x0540` | turno perdido |
 * | `0x0422` | `cmp byte ptr [g_time_spell], 0x51`        | —        | **'Q' Rel Tym** |
 * | `0x0427` | `jne 0x43a`                                | `0x043a` | **INACTIVO: no llega al rand** |
 * | `0x0429` | `sub ax, ax` / `push ax`                   | —        | min = 0 |
 * | `0x042c` | `mov ax, 1` / `push ax`                    | —        | max = 1 |
 * | `0x0430` | `call 0x7e02`                              | CS 0x2092 | **rand_range(0, 1)** |
 * | `0x0433` | `or ax, ax`                                | —        | |
 * | `0x0435` | `jne 0x43a`                                | `0x043a` | ≠0 → el turno SIGUE |
 * | `0x0437` | `jmp 0x540`                                | `0x0540` | ==0 → turno perdido ENTERO |
 * | `0x0540` | `mov sp, bp` / `pop bp` / `ret`            | —        | epílogo: nada más corre |
 *
 * Tres cosas que este fichero SELLA y que la implementación vecina de Rel Tym en
 * overworld (`game.ts` outdoorWorldTurnRuns) y mazmorra (`dungeon.ts` worldAdvances)
 * NO tienen — allí es un TOGGLE determinista (`xor` de un flag de fase), aquí es una
 * MONEDA AL AIRE:
 *   (1) el turno se pierde exactamente cuando `rand(0,1) == 0`, por semilla, no en
 *       alternancia;
 *   (2) perderlo consume EXACTAMENTE una tirada y nada más (0x0437 salta al epílogo:
 *       ni el wake-roll de 0x0446, ni huida, ni especial, ni ataque, ni movimiento);
 *   (3) con el hechizo INACTIVO el `jne` de 0x0427 se come el `call` → CERO consumo,
 *       y el stream queda byte-idéntico (candado del final del fichero: son sellos
 *       e2e de salas de combate los que dependen de esto).
 *
 * Los valores de semilla y los `seedAfter` del candado están MEDIDOS sobre main
 * @994d4fc2 (pre-fix) con este mismo arnés.
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
import { Combat, type CombatMapData, type PartyCombatant } from "../src/core/combat/combat.js";
import { OriginalRng } from "../src/core/rng-original.js";

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

/**
 * El valor que el binario compara en 0x0422 es el BYTE 0x51; el port guarda la
 * letra en `state.timeSpell`. Literal + candado (no se importa nada que el fix
 * cree: el fix no exporta símbolo nuevo, solo añade la rama).
 */
const QUICKNESS_BYTE = 0x51; // COMBAT 0x0422: cmp byte ptr [g_time_spell], 0x51
const QUICKNESS = String.fromCharCode(QUICKNESS_BYTE);
const TIME_STOP_BYTE = 0x54; // COMBAT 0x0418: cmp byte ptr [g_time_spell], 0x54
const TIME_STOP = String.fromCharCode(TIME_STOP_BYTE);

/** Índice 12: dex 30, hp 99 — el mismo enemigo del arnés de time-stop. */
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

interface Outcome {
  seedBefore: number;
  seedAfter: number;
  acted: boolean;
  kinds: string[];
  enemyAt: { x: number; y: number };
  partyHp: number;
}

/**
 * UN turno de IA con el enemigo adyacente al PJ (`tickEnemyTurnStep` = 0x03f4 + cierre).
 * `startSeed` fuerza el estado del generador justo antes del turno: sirve para construir
 * el CONTROL de «mismo turno, stream adelantado una tirada».
 */
function oneEnemyTurn(seed: number, spell: string | undefined, startSeed?: number): Outcome {
  const state = freshState();
  if (spell !== undefined) state.timeSpell = spell;
  const combat = makeCombat(state, seed);
  const player = combat.combatants.find((c) => c.kind === "player")!;
  const enemy = combat.combatants.find((c) => c.kind === "enemy")!;
  player.x = 5;
  player.y = 5;
  enemy.x = 6;
  enemy.y = 5; // adyacente: sin gate, ataca
  enemy.counter = 1;
  player.counter = 100; // actúa el enemigo
  if (startSeed !== undefined) combat.rng.rng.seed(startSeed);
  const seedBefore = combat.rng.rng.getSeed();
  const events = combat.tickEnemyTurnStep();
  return {
    seedBefore,
    seedAfter: combat.rng.rng.getSeed(),
    acted: events.some((e) => ACTION_KINDS.has(e.kind)),
    kinds: events.map((e) => e.kind),
    enemyAt: { x: enemy.x, y: enemy.y },
    partyHp: combat.combatants.filter((c) => c.kind === "player").reduce((s, c) => s + c.hp, 0),
  };
}

/**
 * TURNO PERDIDO = el cuerpo de 0x03f4 no llegó a correr: se gastó EXACTAMENTE la moneda
 * de 0x0430 y no hubo acción ninguna. Es el predicado observable del `jmp 0x540`.
 */
function turnLost(o: Outcome): boolean {
  return o.seedAfter === afterOneRoll(o.seedBefore) && !o.acted;
}

/** La moneda de 0x0430 leída del MISMO estado de semilla, con el rand del kernel. */
function coinOf(seedBefore: number): number {
  return new OriginalRng(seedBefore).next(0, 1);
}
/** La semilla tras EXACTAMENTE una tirada rand(0,1) — el único paso que 0x0430 da. */
function afterOneRoll(seedBefore: number): number {
  const r = new OriginalRng(seedBefore);
  r.next(0, 1);
  return r.getSeed();
}

/**
 * Semillas MEDIDAS pre-fix en las que la vía inactiva (a) ACTÚA y (b) NO deja la
 * semilla en `afterOneRoll` — es decir, donde «turno perdido con 1 sola tirada» es
 * distinguible del comportamiento normal. Sin este filtro el control sería
 * DEGENERADO: hay semillas (1, 4, 10, 18, 24, 28, 30, 31, 34, 38) en las que el
 * enemigo ya no actúa y ya consume una sola tirada sin Rel Tym ninguno.
 */
const COIN0_SEEDS = [2, 3, 6, 7, 9, 13, 16, 19, 22, 23, 25, 29, 32, 35, 36, 39];
const COIN1_SEEDS = [5, 8, 11, 12, 14, 15, 17, 21, 26, 27, 33, 37, 40];

describe("Rel Tym en combate — la moneda de 0x0430 (#203)", () => {
  it("el byte comparado en 0x0422 es la letra que el port guarda (candado literal↔port)", () => {
    expect(QUICKNESS).toBe("Q");
    expect(TIME_STOP).toBe("T");
  });

  it("las semillas del arnés son las que dicen ser: control NO degenerado", () => {
    // Precondición de los tres tests siguientes: sin hechizo, en TODAS estas
    // semillas el enemigo actúa y la semilla final NO es la de una sola tirada.
    for (const seed of [...COIN0_SEEDS, ...COIN1_SEEDS]) {
      const off = oneEnemyTurn(seed, undefined);
      expect(off.acted, `seed ${seed}: el control sin hechizo debe ACTUAR`).toBe(true);
      expect(
        off.seedAfter,
        `seed ${seed}: el control no debe coincidir con «una sola tirada»`,
      ).not.toBe(afterOneRoll(off.seedBefore));
    }
    for (const seed of COIN0_SEEDS) expect(coinOf(oneEnemyTurn(seed, undefined).seedBefore)).toBe(0);
    for (const seed of COIN1_SEEDS) expect(coinOf(oneEnemyTurn(seed, undefined).seedBefore)).toBe(1);
  });

  it("moneda 0 → el enemigo pierde el turno ENTERO: sin acción, sin mover, sin daño (COMBAT.OVL:0x0430 rand(0,1); 0x0435 jne / 0x0437 jmp 0x540, tramo 0x0422-0x0437)", () => {
    for (const seed of COIN0_SEEDS) {
      const off = oneEnemyTurn(seed, QUICKNESS);
      // Referencia de «turno no jugado»: An Tym, cuyo salto a 0x0540 ya está portado.
      const frozen = oneEnemyTurn(seed, TIME_STOP);
      expect(
        off.acted,
        `seed ${seed}: COMBAT.OVL:0x0437 jmp 0x540 — con rand(0,1)==0 el turno se pierde ENTERO (el control sin Rel Tym sí actúa)`,
      ).toBe(false);
      expect(off.enemyAt, `seed ${seed}: turno perdido ⇒ el enemigo no se mueve (0x0437)`).toEqual({
        x: 6,
        y: 5,
      });
      expect(off.partyHp, `seed ${seed}: turno perdido ⇒ la party no recibe daño (0x0437)`).toBe(
        frozen.partyHp,
      );
    }
  });

  it("moneda 0 → consume EXACTAMENTE una tirada y ninguna más (COMBAT.OVL:0x0430 es la ÚNICA call antes de 0x0437 jmp 0x540)", () => {
    for (const seed of COIN0_SEEDS) {
      const off = oneEnemyTurn(seed, QUICKNESS);
      expect(
        off.seedAfter,
        `seed ${seed}: COMBAT.OVL:0x0430-0x0437 — el turno perdido gasta 1 rand(0,1) y salta al epílogo 0x0540`,
      ).toBe(afterOneRoll(off.seedBefore));
    }
  });

  it("moneda 1 → el turno SIGUE, byte a byte, con el stream adelantado UNA tirada (COMBAT.OVL:0x0435 jne 0x43a)", () => {
    // `jne 0x43a` cae en el MISMO punto al que salta el `jne 0x0427` del caso inactivo:
    // el cuerpo del turno es idéntico, la única diferencia es que la moneda ya se gastó.
    // Control exacto: el mismo turno SIN Rel Tym, arrancado desde la semilla adelantada.
    // (Ojo: `acted` NO sirve de discriminante aquí — con el stream corrido hay semillas,
    // p.ej. 27, en las que el turno corre entero y aun así no produce acción visible.)
    for (const seed of COIN1_SEEDS) {
      const off = oneEnemyTurn(seed, QUICKNESS);
      const control = oneEnemyTurn(seed, undefined, afterOneRoll(off.seedBefore));
      expect(
        turnLost(off),
        `seed ${seed}: COMBAT.OVL:0x0435 jne 0x43a — con rand(0,1)!=0 el turno NO se pierde`,
      ).toBe(false);
      expect(
        { kinds: off.kinds, enemyAt: off.enemyAt, partyHp: off.partyHp, seed: off.seedAfter },
        `seed ${seed}: tras 0x0435 el turno corre igual que sin Rel Tym con el stream +1 tirada`,
      ).toEqual({
        kinds: control.kinds,
        enemyAt: control.enemyAt,
        partyHp: control.partyHp,
        seed: control.seedAfter,
      });
    }
  });

  it("★ es una MONEDA, no el TOGGLE del vecino: el turno se pierde en las semillas de rand(0,1)==0 y solo en ésas (COMBAT.OVL:0x0430)", () => {
    // Rel Tym en overworld (game.ts outdoorWorldTurnRuns) y mazmorra (dungeon.ts
    // worldAdvances) es un XOR determinista; copiar ese patrón aquí daría un
    // ALTERNADO independiente de la semilla. Este test lo discrimina: la partición
    // observada debe coincidir CASILLA A CASILLA con el predicado del rand.
    const seeds = [...COIN0_SEEDS, ...COIN1_SEEDS].sort((a, b) => a - b);
    const lost: number[] = [];
    const kept: number[] = [];
    for (const seed of seeds) (turnLost(oneEnemyTurn(seed, QUICKNESS)) ? lost : kept).push(seed);
    expect(
      lost,
      "COMBAT.OVL:0x0430 rand(0,1)==0 — el conjunto EXACTO de turnos perdidos, no una alternancia",
    ).toEqual(COIN0_SEEDS.slice().sort((a, b) => a - b));
    expect(kept).toEqual(COIN1_SEEDS.slice().sort((a, b) => a - b));
  });

  it("★ CANDADO DE STREAM: con Rel Tym INACTIVO el `jne` de 0x0427 se come el `call` ⇒ cero consumo y semilla final idéntica a la medida en main @994d4fc2", () => {
    // VERDE ANTES Y DESPUÉS del fix. Si alguna vez este test se pone rojo, el fix
    // ha metido una tirada en la vía inactiva y los sellos e2e de salas de combate
    // (digest exacto) se han movido.
    const LOCK: Array<[seed: number, seedAfter: number]> = [
      [1, 0xa165],
      [2, 0xd8da],
      [3, 0xdcda],
      [4, 0x1352],
      [5, 0x6ae8],
      [6, 0x0f04],
      [7, 0x0dcc],
      [8, 0x7157],
      [9, 0x1554],
      [10, 0xc707],
      [11, 0x7d7e],
      [12, 0xe62c],
    ];
    for (const [seed, expected] of LOCK) {
      expect(
        oneEnemyTurn(seed, undefined).seedAfter,
        `seed ${seed}: sin hechizo temporal, COMBAT.OVL:0x0427 jne 0x43a salta el rand de 0x0430`,
      ).toBe(expected);
      // 'P' (protección) es otro g_time_spell VIVO que no es 0x51 ni 0x54: el gate
      // discrimina el VALOR del byte, no «hay hechizo temporal».
      expect(
        oneEnemyTurn(seed, "P").seedAfter,
        `seed ${seed}: g_time_spell='P' no es 0x51 ⇒ 0x0427 salta igual`,
      ).toBe(expected);
    }
  });
});
