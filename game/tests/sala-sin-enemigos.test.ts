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

/**
 * FAMILIA `0xEC` = GRUPO ALEATORIO DE ENEMIGOS, y qué queda de la sala-vacía.
 *
 * ★ ESTE FICHERO CAMBIÓ DE PREMISA (#54 tanda 2). Nació para de-riesgar el fix `0xec`
 * **en su versión antigua**, que NO colocaba nada para esa familia: de ahí salían CUATRO
 * salas con roster vacío (cm49 Wrong r1, cm50 Wrong r2, cm68 Covetous r4, cm69 Covetous r5,
 * las únicas cuyo roster es 100 % `0xEC`) y este fichero probaba que el motor no colgaba.
 *
 * Aquella versión se apoyaba en una cita del port que está **REFUTADA POR CUERPO**: decía
 * que los 4 bytes que la rama `0xEC` lee «la rutina NUNCA los inicializa». Los inicializa —
 * `DNGLOOK.OVL 0x1273-0x128c` tira `rand(0,7)` CUATRO veces contra la tabla `DS 0x385e`
 * (`DATA.OVL` fileoff 0x386e = `14 15 16 22 21 18 1f 18`) y el consumo `0x12ee-0x12f7` lee
 * `pool[tile & 3]`. Es el «Random enemy groups» del wiki. Derivación:
 * `re/notes/dnglook-117e-body.md` §2 y `re/notes/0xec-mecanismo-derivado.md`.
 *
 * ⇒ **La sala vacía ya no existe en el corpus**: esas 4 salas reciben roster REAL. Las
 * guardas de «0 enemigos no cuelga y no cierra el combate» siguen valiendo como guardas del
 * motor, así que se conservan — pero sobre un mapa SINTÉTICO, no fingiendo que un `.CBT` las
 * produce. Lo que antes medía este fichero lo disolvió la variante; lo que aquí queda es lo
 * que sobrevive a la disolución, dicho como lo que es.
 */
function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
type DataJson = EnemyDataInput & { defenseValues: number[]; spellAttackRange: number[] };
const data = load<DataJson>("../assets/data.json");
const additional = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const enemyDefs: EnemyDef[] = buildEnemyDefs(data, additional);
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

/** Las 4 salas cuyo roster es 100 % familia `0xEC` ⇒ lo decide ENTERO la tirada. */
const SALAS_100_EC = [49, 50, 68, 69] as const;

/** La tabla del binario, VERBATIM (`DATA.OVL` fileoff 0x386e = DS `0x385e`). */
const EC_TABLE = [0x14, 0x15, 0x16, 0x22, 0x21, 0x18, 0x1f, 0x18];
/** Índice PLACEHOLDER al que caía el 236 por el filtro genérico: `(236-0x40)>>2`. */
const WHIRPOOL_PLACEHOLDER = 43;

function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}
function party(state: GameState): PartyCombatant[] {
  const members = state.characters.filter((c) => c.partyStatus === 0);
  for (const c of members) {
    c.level = 8;
    c.maxHp = 240;
    c.currentHp = 240;
    c.status = "G";
  }
  return members.map((record) => ({
    charIdx: state.characters.indexOf(record),
    record,
    weapons: [{ attack: 40, range: 5 }],
  }));
}
function combatOn(map: CombatMapData, seed = 0): Combat {
  const state = freshState();
  return new Combat({
    map,
    entryDirection: "south",
    party: party(state),
    enemies: { fixedFromMap: true, defs: enemyDefs },
    seed,
    state,
    defenseValues: data.defenseValues,
    spellAttackRange: data.spellAttackRange,
    enemyDefs,
    roomCombat: true,
  });
}
function room(pos: number, seed = 0): Combat {
  return combatOn(combatMaps[pos]!, seed);
}
/** Mapa sintético: copia de cm71 con las unidades que se le pidan. */
function mapaCon(units: { sprite: number; x: number; y: number }[]): CombatMapData {
  return { ...combatMaps[71]!, units };
}

describe("familia 0xEC: el grupo aleatorio, sobre el motor vivo", () => {
  it("las 4 salas reciben enemigos REALES, uno por unidad 0xEC, en vez de roster vacío", () => {
    // El resto de sus unidades son OBJETOS de arena (sprites <0x40 / familia 0xe8), que no
    // eran ni son combatientes: cm49 7 de 9 · cm50 14 de 16 · cm68 14 de 16 · cm69 15 de 16.
    for (const pos of SALAS_100_EC) {
      const ec = (combatMaps[pos]!.units ?? []).filter((u) => (u.sprite & 0xfc) === 0xec).length;
      const enemigos = room(pos).combatants.filter((c) => c.kind === "enemy");
      expect(
        enemigos.length,
        `cm${pos}: una unidad 0xEC = un enemigo del grupo aleatorio (DNGLOOK 0x12ee-0x12f7)`,
      ).toBe(ec);
      expect(enemigos.length, `cm${pos}: y ya no queda vacía`).toBeGreaterThan(0);
    }
  });

  it("todo enemigo colocado por la rama 0xEC sale de la TABLA de 8, nunca del placeholder 43", () => {
    for (const pos of SALAS_100_EC) {
      for (const seed of [0, 1, 7, 12345]) {
        for (const e of room(pos, seed).combatants.filter((c) => c.kind === "enemy")) {
          const idx = e.enemyDef!.index;
          expect(
            EC_TABLE,
            `cm${pos} seed ${seed}: índice ${idx} debe estar en DS 0x385e (DATA.OVL 0x386e)`,
          ).toContain(idx);
          expect(idx, "jamás el Whirpool1/x de stats cero").not.toBe(WHIRPOOL_PLACEHOLDER);
        }
      }
    }
  });

  it("★ el índice lo eligen los 2 BITS BAJOS del tile: 236 y 237 dan enemigos DISTINTOS", () => {
    // `12ee: mov bl,[bp-8] / 12f1: and bx,3 / 12f7: mov al,[bx-6]` ⇒ 236→pool[0], 237→pool[1],
    // y los 4 slots del pool son tiradas INDEPENDIENTES. Si el port tratase el 237 igual que
    // el 236 (la conducta vieja, y la que sigue describiendo `spriteToEnemyIndex`), los dos
    // tiles darían siempre lo mismo y este aserto no encontraría ningún seed que los separe.
    const mapa = mapaCon([
      { sprite: 236, x: 3, y: 3 },
      { sprite: 237, x: 5, y: 3 },
    ]);
    const difieren = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((seed) => {
      const es = combatOn(mapa, seed).combatants.filter((c) => c.kind === "enemy");
      return es[0]!.enemyDef!.index !== es[1]!.enemyDef!.index;
    });
    expect(
      difieren.length,
      "con 8 entradas de tabla y 2 tiradas independientes, en 10 seeds los tiles 236 y 237 se separan al menos una vez",
    ).toBeGreaterThan(0);
  });

  it("mismo tile ⇒ MISMO enemigo dentro de la escena (el pool se tira UNA vez por montaje)", () => {
    // El bucle de las 4 tiradas corre una sola vez (0x1273-0x128c), ANTES del bucle de las 16
    // unidades: dos unidades del mismo tile leen el MISMO slot del pool.
    const mapa = mapaCon([
      { sprite: 238, x: 2, y: 2 },
      { sprite: 238, x: 4, y: 2 },
      { sprite: 238, x: 6, y: 2 },
    ]);
    for (const seed of [0, 3, 99]) {
      const idxs = combatOn(mapa, seed)
        .combatants.filter((c) => c.kind === "enemy")
        .map((c) => c.enemyDef!.index);
      expect(new Set(idxs).size, `seed ${seed}: las 3 unidades 238 comparten pool[2]`).toBe(1);
    }
  });

  it("NO-REGRESIÓN: cm71 (16 Ghost, sin ninguna 0xEC) sigue con sus 16", () => {
    expect(room(71).combatants.filter((c) => c.kind === "enemy").length).toBe(16);
  });
});

describe("sala con CERO enemigos: guarda del motor sobre mapa SINTÉTICO", () => {
  // Ya NO la produce ningún `.CBT` (ver cabecera): las 4 salas que la producían con la
  // versión vieja del fix reciben ahora roster real. La guarda se conserva porque el motor
  // sigue teniendo que aguantar el caso —es el que el lead señaló, «array vacío donde el
  // código asume ≥1»— pero se monta a mano en vez de atribuírselo a una sala del corpus.
  const VACIO = mapaCon([]);

  it("la party SÍ entra al tablero (el roster no queda vacío del todo)", () => {
    const c = combatOn(VACIO).combatants;
    expect(c.length).toBeGreaterThan(0);
    expect(c.every((x) => x.kind === "player")).toBe(true);
  });

  it("★ NO CUELGA: avanzar el turno con 0 enemigos termina y LATCHEA VICTORIA", () => {
    // Si algo asumiera >=1 enemigo (bucle sin progreso, %0, findNextActor sin cota), esto
    // colgaría el proceso de test en vez de fallar. Que el test COMPLETE es parte del aserto.
    const c = combatOn(VACIO);
    expect(Array.isArray(c.playerPass())).toBe(true);
    expect(c.victory, "bando enemigo vacío + party viva ⇒ VICTORY latcheada").toBe(true);
  });

  it("`over` sigue siendo FIEL: limpiar el bando enemigo NO cierra el combate", () => {
    // COMBAT:0x0B94 — el bucle sale sólo cuando el bando PARTY se vacía; con 0 enemigos el
    // combate queda ABIERTO (la party recoge botín y sale andando). Guarda contra "arreglar"
    // esto cerrando el combate al vaciar enemigos, que sería divergencia.
    const c = combatOn(VACIO);
    c.playerPass();
    expect(
      c.over,
      "0 enemigos NO cierra el combate — FIEL por COMBAT:0x0B94 (el bucle sale sólo al vaciarse el bando PARTY)",
    ).toBe(false);
  });
});
