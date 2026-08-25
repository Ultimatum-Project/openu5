/**
 * CLASE DE MOVIMIENTO del enemigo — `kernel_tile_passable` ULTIMA.EXE 0x2C4C (#54 pieza 1,
 * ticket #48). Sella el cambio estructural: el port decidía la pasabilidad de un enemigo
 * con TRES booleanos de Redux (isWater / canFlyOverWater / canPassWalls) y ahora la decide
 * la CLASE del binario, que es EXCLUYENTE y sale de una tabla de 64 bytes.
 *
 * Cadena (derivada en `re/notes/mapeo-enemigo-mover.md`, 3 anclas independientes):
 *   mover = 0x40 + 4·i  ⇒  clase = DATA.OVL[0x5504 + (mover>>2)] = tabla[16+i]
 *   0x2C4C @0x2c4f: `bx = mover>>2` (dos `sar`), `al=[bx+0x54F4]`, `cmp ax,0x0a / ja` →
 *   FALSE para todo >10, y jump-table 0x2D60 con 11 handlers para 0..10.
 *
 * POR QUÉ ESTE FICHERO EXISTE: el cambio dejó la suite entera VERDE, y eso no prueba nada
 * —los veredictos de sala que tocan el radio (Ghost en cm64/cm65) viven en
 * `e2e/grandtour/`, que es playwright y no corre aquí—. Sin estos asertos, «Ghost
 * atraviesa muros» sería una afirmación sin testigo en el arnés que sí corre.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildEnemyDefs,
  ENEMY_MOVE_CLASS,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
  type EnemyDef,
} from "../src/core/combat/enemies.js";
import { Combat, type CombatMapData, type PartyCombatant } from "../src/core/combat/combat.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { tileInfo } from "../src/core/tiles.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const freshState = (): GameState =>
  createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
const defByIndex = (i: number): EnemyDef => {
  const d = buildEnemyDefs(data, additionalFlags)[i];
  if (!d) throw new Error(`enemigo ${i} ausente`);
  return d;
};

/**
 * MURO de prueba: 0x38. Lo que lo hace válido no es su nombre sino sus tres propiedades,
 * asertadas abajo — no es agua (así que la clase 4 lo cruza) y no lo pisa ni el bitmap de
 * a pie ni el terrestre (así que la clase 0 no).
 */
const WALL = 0x38;

describe("tabla de clases — VERBATIM de DATA.OVL 0x5504[16+i]", () => {
  it("las 48 entradas están y ninguna es un valor fuera del dispatch", () => {
    expect(ENEMY_MOVE_CLASS).toHaveLength(48);
    for (const c of ENEMY_MOVE_CLASS) {
      expect(c === 255 || (c >= 0 && c <= 10)).toBe(true);
    }
  });

  it("★ clase 4 (atraviesa muros) = EXACTAMENTE {23 Ghost, 47 Shadow Lord}", () => {
    const c4 = ENEMY_MOVE_CLASS.flatMap((c, i) => (c === 4 ? [i] : []));
    expect(c4).toEqual([23, 47]);
    // Redux sólo marcaba al Ghost: el Shadow Lord es la corrección que aporta el binario.
  });

  it("clase 1 (sólo agua) = {16,17,18,19}; Redux marcaba de más 8 Pirates y 43 Whirlpool", () => {
    expect(ENEMY_MOVE_CLASS.flatMap((c, i) => (c === 1 ? [i] : []))).toEqual([16, 17, 18, 19]);
    expect(ENEMY_MOVE_CLASS[8]).toBe(0); // Pirates NO es acuático para el binario
    expect(ENEMY_MOVE_CLASS[43]).toBe(9); // Whirlpool es mono-tile, no clase 1
  });

  it("clase 2 = {13,15,21,28,38,39,44} — difiere del CanFlyOverWater de Redux en 5 de 9", () => {
    expect(ENEMY_MOVE_CLASS.flatMap((c, i) => (c === 2 ? [i] : []))).toEqual([
      13, 15, 21, 28, 38, 39, 44,
    ]);
    // Sólo en el binario: 13 Apparation · 15 Lord British · 38 Daemon.
    // Sólo en Redux: 23 Ghost (aquí es clase 4) y 37 Wisp (aquí es clase 0).
    expect(ENEMY_MOVE_CLASS[37]).toBe(0);
  });

  it("las 4 clases mono-tile y la 255, que el port no modelaba en absoluto", () => {
    expect(ENEMY_MOVE_CLASS[46]).toBe(7); // RotWorm  → sólo Swamp (t==4), 0x2d42
    expect(ENEMY_MOVE_CLASS[45]).toBe(8); // Corpser  → sólo Grass (t==5), 0x2d4e
    expect(ENEMY_MOVE_CLASS[43]).toBe(9); // Whirlpool→ sólo Water1 (t==1), 0x2d54
    expect(ENEMY_MOVE_CLASS[40]).toBe(10); // Sand Trap→ sólo Desert1 (t==7), 0x2d5a
    expect(ENEMY_MOVE_CLASS[42]).toBe(255); // Poison Field → `ja` ⇒ bloqueado SIEMPRE
  });

  it("ANCLAS de #30: rata i=20 clase 0 · Ghost i=23 clase 4 · Whirlpool i=43 clase 9", () => {
    expect(ENEMY_MOVE_CLASS[20]).toBe(0);
    expect(ENEMY_MOVE_CLASS[23]).toBe(4);
    expect(ENEMY_MOVE_CLASS[43]).toBe(9);
  });
});

describe("los handlers, sobre el tile (calco de 0x2C4C)", () => {
  // Réplica local de las ramas puras del kernel. No llama a Combat porque lo que se sella
  // aquí es la ARITMÉTICA del binario, que es lo que se calcó; el careo con la clase la
  // hace `tilePassableFor`, y el muro lo prueba el bloque de abajo.
  const isWater = (t: number): boolean => t < 4 || (t & 0xf0) === 0x60;

  it("is_water (0x2C2E) = t<4 ∨ (t&0xF0)==0x60 — y NADA más", () => {
    for (const t of [0, 1, 2, 3]) expect(isWater(t)).toBe(true); // `cmp [bp+4],4 / jl`
    for (const t of [0x60, 0x65, 0x6f]) expect(isWater(t)).toBe(true); // `and 0xF0 / cmp 0x60`
    for (const t of [4, 5, 7, 0x38, 0x5f, 0x70, 0x8f]) expect(isWater(t)).toBe(false);
  });

  it("★ el MURO de prueba cumple lo que el aserto necesita (no se toma su nombre por bueno)", () => {
    expect(isWater(WALL)).toBe(false); // ⇒ la clase 4 lo cruza (`!is_water`)
    expect(tileInfo(WALL).landEnemyPassable).toBe(false); // ⇒ la clase 0 no
    expect(tileInfo(WALL).walkable).toBe(false); // ⇒ el party tampoco
  });

  it("clase 4 cruza el muro y NO cruza el agua — es «no-agua», no «todo»", () => {
    const class4 = (t: number): boolean => !isWater(t); // 0x2cca
    expect(class4(WALL)).toBe(true); // ← lo que el port NO hacía antes
    expect(class4(1)).toBe(false); // agua: sigue bloqueada
    expect(class4(0x64)).toBe(false); // agua rápida: bloqueada
  });

  it("clase 255 está bloqueada en TODO tile (`cmp ax,0x0a / ja 0x2ca9`)", () => {
    const blocked = (cls: number): boolean => cls > 10;
    expect(blocked(255)).toBe(true);
    expect(blocked(10)).toBe(false); // el límite es inclusivo por arriba
  });
});

/**
 * EL CABLEADO, no sólo la lógica. Todo lo de arriba podría estar verde con
 * `tilePassableFor` sin tocar: la lección de bindTap («lógica sellada ≠ cableado sellado»)
 * dice que el aserto que vale es el que corre el motor. Arena partida por un MURO macizo:
 * el enemigo empieza al oeste y el jugador al este, y sólo se pueden encontrar si la clase
 * del enemigo cruza la pared.
 */
function arenaConMuro(def: EnemyDef): { combat: Combat; enemy: { x: number; y: number } } {
  const tiles: number[][] = [];
  for (let y = 0; y < 11; y++) {
    const row: number[] = [];
    for (let x = 0; x < 11; x++) row.push(x === 5 ? WALL : 5); // columna 5 = muro; resto grass
    tiles.push(row);
  }
  const map: CombatMapData = {
    index: 998,
    territory: "britannia",
    name: "SyntheticWall",
    tiles,
    playerStarts: {
      east: [{ x: 9, y: 5 }], west: [{ x: 9, y: 5 }],
      south: [{ x: 9, y: 5 }], north: [{ x: 9, y: 5 }],
    },
    units: [{ sprite: 0, x: 2, y: 5 }],
    triggers: [],
  };
  const state = freshState();
  const party: PartyCombatant[] = state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }))
    .slice(0, 1);
  const combat = new Combat({
    map, entryDirection: "east",
    party, enemies: [{ def, count: 1 }],
    seed: 4242, state, defenseValues: data.defenseValues,
  });
  const enemy = combat.combatants.find((c) => c.kind === "enemy")!;
  const player = combat.combatants.find((c) => c.kind === "player")!;
  player.x = 9; player.y = 5;
  enemy.x = 2; enemy.y = 5;
  enemy.hp = enemy.maxHp = 9999;
  player.hp = player.maxHp = 9999;
  return { combat, enemy };
}

/** Corre turnos y devuelve la x MÁXIMA que alcanzó el enemigo (el muro está en x=5). */
function maxXAlcanzada(def: EnemyDef): number {
  const { combat, enemy } = arenaConMuro(def);
  let maxX = enemy.x;
  for (let i = 0; i < 200 && !combat.over; i++) {
    const cur = combat.currentUnit;
    if (!cur) break;
    if (cur.kind === "enemy") combat.tickEnemyTurns();
    else combat.playerPass();
    if (enemy.x > maxX) maxX = enemy.x;
  }
  return maxX;
}

describe("★ CABLEADO vivo: el muro sólo lo cruza quien el binario dice", () => {
  it("Ghost (i=23, clase 4) ATRAVIESA el muro y llega al otro lado", () => {
    const ghost = defByIndex(23);
    expect(ghost.moveClass).toBe(4); // la def lleva la clase, no un booleano
    expect(maxXAlcanzada(ghost)).toBeGreaterThan(5);
    // FAILING-FIRST COMPROBADO, no supuesto: con `case 4` devuelto a
    // `info.landEnemyPassable` (el comportamiento anterior), ESTE aserto —y sólo éste de
    // los cuatro del bloque— cae. Es el que sostiene «el Ghost atraviesa muros».
  });

  it("★ control NEGATIVO: la rata (i=20, clase 0) NO pasa del muro", () => {
    // Sin él, un cableado que devolviera `true` a todo dejaría verde el aserto de arriba
    // y habríamos sellado una fabricación en vez de un calco. También cae si se rompe.
    const rata = defByIndex(20);
    expect(rata.moveClass).toBe(0);
    expect(maxXAlcanzada(rata)).toBeLessThan(5);
  });

  /**
   * ⚠ POR QUÉ EL SHADOW LORD Y EL POISON FIELD NO TIENEN ASERTO VIVO AQUÍ.
   * Los escribí, pasaron, y al comprobar el failing-first resultó que pasaban POR OTRO
   * MOTIVO — o sea que no medían la clase. Un aserto que no puede fallar por la razón que
   * dice es peor que no tenerlo, así que los retiro y dejo escrito el porqué:
   *
   *  · Shadow Lord (i=47): `attackRange` 9 y camino propio. En la traza no CAMINA a través
   *    del muro: salta de (3,9) a (10,5) con el combate ya `over`. Ese maxX>5 no es
   *    «cruzó la pared», es su comportamiento especial. Esta arena no aísla su clase.
   *  · Poison Field (i=42): además de clase 255 lleva `doesNotMove=true`, que ya lo
   *    inmoviliza por sí solo — el aserto habría pasado igual con la clase mal cableada.
   *    Es, de hecho, el ÚNICO enemigo de clase 255, así que no hay forma de aislarla por
   *    conducta emergente con los datos reales.
   *
   * De los dos queda sellado lo que SÍ es comprobable sin confusión: su entrada en la
   * tabla (bloque de arriba), que es donde vive la corrección respecto a Redux.
   */
});
