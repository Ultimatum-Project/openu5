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
 * #353 — SIEMBRA de los objetos de arena del `.CBT` (sprites `<0x40`, tipo 2).
 *
 * 1988 no se limita a EXCLUIR esos sprites del roster: los COLOCA como objetos de la
 * arena (ULTIMA.EXE 0x6506 fase 2, 0x66a6-0x66bb) y les calcula CANTIDAD inline en el
 * bucle de 16 slots (DNGLOOK.OVL 0x131d-0x1381). Derivación completa con el orden de
 * consumo de RNG: `re/notes/siembra-objetos-cbt-353.md`.
 *
 * ★ ESPERADOS EN CRUDO. Las posiciones/sprites salen del volcado de DUNGEON.CBT
 * (registro 9 = posicional cm25; filas 5/6/7, cols 11-26) y las CANTIDADES de una
 * réplica INDEPENDIENTE en Python del rand_range del kernel (0x2092, ley de
 * re/notes/rng.md: add 0x9248 / ror3 / xor 0x9248 / add 0x11; retorno
 * lo + ((seed & 0x7fff) % span)) aplicada al orden de consumo DERIVADO DEL ASM — no de
 * ejecutar el sujeto. Ningún esperado de este fichero se calcula llamando al port.
 *
 * ★ El ORDEN de consumo es parte del aserto: con seed 0x1234 y planta 3, el oro de cm25
 * da [5, 38] con el consumo INTERCALADO del binario (pre-roll de 4 rands 0x1273 → slot a
 * slot: enemigo=1 rand de velocidad, dinero/ítem=1 rand de cantidad, cofre/decorado=0) y
 * daría [16, 5] si la siembra fuera una fase SEPARADA de los spawns (medido con la misma
 * réplica). El aserto de 5/38 encierra la geometría del bucle, no sólo la ley.
 */
function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
type DataJson = EnemyDataInput & { defenseValues: number[]; spellAttackRange: number[] };
const data = load<DataJson>("../assets/data.json");
const additional = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const enemyDefs: EnemyDef[] = buildEnemyDefs(data, additional);
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}
function party(state: GameState): PartyCombatant[] {
  const members = state.characters.filter((c) => c.partyStatus === 0);
  return members.map((record) => ({
    charIdx: state.characters.indexOf(record),
    record,
    weapons: [{ attack: 40, range: 5 }],
  }));
}
function room(pos: number, seed: number, dungeonFloor: number): Combat {
  const state = freshState();
  return new Combat({
    map: combatMaps[pos]!,
    entryDirection: "south",
    party: party(state),
    enemies: { fixedFromMap: true, defs: enemyDefs },
    seed,
    state,
    defenseValues: data.defenseValues,
    spellAttackRange: data.spellAttackRange,
    enemyDefs,
    roomCombat: true,
    dungeonFloor,
  });
}

/**
 * cm25 (= DUNGEON.CBT registro 9, Deceit r9), slots CRUDOS del volcado (fila5,fila6,fila7):
 *   (216,5,5) (1,9,1) (1,9,9) (2,8,4) (2,9,6) (3,9,2) (3,8,6) (4,8,1) (4,8,9)
 *   (8,9,4) (8,9,8) (12,9,5) (216,6,3) (216,4,8) (220,4,2) (220,6,7)
 * = 5 enemigos (216→índice 38 ×3, 220→39 ×2) + 2 cofres + 2 dineros + 7 ítems.
 */
const CM25 = 25;
const SEED = 0x1234;
const FLOOR = 3;

describe("#353 (a): cm25 siembra EXACTAMENTE sus ranuras, cantidades de la réplica del kernel", () => {
  const c = room(CM25, SEED, FLOOR);

  it("los DOS cofres, con contenido determinista 3*floor+7 = 16 (DNGLOOK 0x1328-0x1339)", () => {
    expect(c.chestAt(9, 1)).toBe(true);
    expect(c.chestAt(9, 9)).toBe(true);
    expect(c.chestContentsAt(9, 1)).toBe(16); // 3*3+7, EN CRUDO
    expect(c.chestContentsAt(9, 9)).toBe(16);
  });

  it("el ORO intercalado con los spawns: [5, 38] — la firma del orden del bucle (0x1341-0x1358)", () => {
    // Réplica independiente: pre-roll(4) + velocidad del 216 del slot 0 + rand(1,40)=5;
    // el segundo dinero cae tras potion/scroll/… NO: cae inmediatamente después (slot 4),
    // tras el primero — [5, 38]. Con fases separadas la réplica da [16, 5]: el aserto
    // discrimina la geometría.
    expect(c.lootPileAt(8, 4)).toEqual([{ id: 2, category: "gold", qty: 5 }]);
    expect(c.lootPileAt(9, 6)).toEqual([{ id: 2, category: "gold", qty: 38 }]);
  });

  it("los 7 ítems con su ley base+rand(0,span−1) (0x1365-0x1377, tablas DS 0x383f/0x384d)", () => {
    expect(c.lootPileAt(9, 2)).toEqual([{ id: 3, category: "potion", qty: 3 }]);
    expect(c.lootPileAt(8, 6)).toEqual([{ id: 3, category: "potion", qty: 6 }]);
    expect(c.lootPileAt(8, 1)).toEqual([{ id: 4, category: "scroll", qty: 4 }]);
    expect(c.lootPileAt(8, 9)).toEqual([{ id: 4, category: "scroll", qty: 3 }]);
    expect(c.lootPileAt(9, 4)).toEqual([{ id: 8, category: "gems", qty: 2 }]);
    expect(c.lootPileAt(9, 8)).toEqual([{ id: 8, category: "gems", qty: 6 }]);
    // Amuleto (id 12): 0x2d + rand(0,2) = 45..47 → 47. La interpretación de la tabla se
    // auto-confirma: el rango son los ids de amuleto del equipo (0x2d-0x2f).
    expect(c.lootPileAt(9, 5)).toEqual([{ id: 12, category: "equipment", qty: 47 }]);
  });

  it("y NADA más: 11 piezas en total (2 cofres + 9 pilas), cero decorados", () => {
    expect(c.lootTiles().length).toBe(11);
  });

  it("el stream COMPLETO de la construcción cuadra con la réplica: seed final 0xcbbc", () => {
    // 4 pre-roll + 3 rands de los slots 0/3/4 no… — la cuenta entera, en orden: pool(4),
    // speed(216), gold, gold, potion, potion, scroll, scroll, gem, gem, amulet,
    // speed(216), speed(216), speed(220), speed(220) = 18 rands desde 0x1234 → 0xcbbc.
    expect(c.rng.rng.getSeed()).toBe(0xcbbc);
  });
});

describe("#353 (b): sala sin objetos siembra CERO", () => {
  it("cm71 (16 Ghost, ningún sprite <0x40): capa de botín vacía", () => {
    const c = room(71, SEED, FLOOR);
    expect(c.lootTiles().length).toBe(0);
    expect(c.chestAt(0, 0)).toBe(false);
  });
});

describe("#353 (c): el roster de combatientes NO cambia — los <0x40 siguen fuera", () => {
  it("cm25: exactamente 5 enemigos, índices 38×3 y 39×2 (crudo del volcado)", () => {
    const enemigos = room(CM25, SEED, FLOOR).combatants.filter((k) => k.kind === "enemy");
    const indices = enemigos.map((e) => e.enemyDef!.index).sort((a, b) => a - b);
    expect(indices).toEqual([38, 38, 38, 39, 39]);
  });

  it("cm16 (registro 0, 2 cofres + 12 monstruos): 12 enemigos y 2 cofres", () => {
    const c = room(16, SEED, 0);
    expect(c.combatants.filter((k) => k.kind === "enemy").length).toBe(12);
    expect(c.chestAt(4, 9)).toBe(true);
    expect(c.chestAt(6, 9)).toBe(true);
  });
});

describe("#353 (d): la ley del cofre es determinista por PLANTA (3*floor+7), valores crudos", () => {
  // cm16 = registro 0: cofres en (4,9) y (6,9). La ley no consume rand: mismo valor con
  // cualquier semilla (se cruza con dos).
  const casos: Array<[number, number]> = [
    [0, 7],
    [1, 10],
    [3, 16],
    [7, 28],
  ];
  for (const [floor, esperado] of casos) {
    it(`planta ${floor} → ${esperado}`, () => {
      for (const seed of [0, 0xbeef]) {
        const c = room(16, seed, floor);
        expect(c.chestContentsAt(4, 9)).toBe(esperado);
        expect(c.chestContentsAt(6, 9)).toBe(esperado);
      }
    });
  }
});

describe("#353: decorados (si ≥ 0x10) — capa visual sin cantidad ni rand", () => {
  it("cm24 (registro 8): el cadáver 0x1e se pinta y NO es recogible", () => {
    // Slots crudos rec 8: (30,…) + dinero + ítems + 12 enemigos. El 30 = 0x1e cadáver.
    const m = combatMaps[24]!;
    const corpse = m.units.find((u) => u.sprite === 30)!;
    const c = room(24, SEED, FLOOR);
    const deco = c.lootTiles().find((l) => l.x === corpse.x && l.y === corpse.y);
    expect(deco?.tile).toBe(30); // la piel lo blitea +0x100 = 0x11E DeadBody
    expect(c.lootPileAt(corpse.x, corpse.y).length).toBe(0); // no hay pieza que Get
  });
});

describe("#353 cabo (G)et: el decorado sembrado NO casa el barrido de cmd_get (SJOG 0x196a-0x197d)", () => {
  // Derivado del cuerpo de cmd_get (SJOG 0x18CE, el MISMO que corre en la arena vía el
  // funnel de COMBAT.OVL): el barrido de la tabla de objetos (slots 1..31, 0x193d-0x19bd)
  // sólo ACEPTA kind < 0x10, kind == 0x19, kind == 0x1b o familia 0xb4 (0x196a-0x197d).
  // Un decorado (cadáver 0x1e, mancha 0x1f, espejo 0x3c) NO casa ninguna condición: el
  // barrido lo SALTA, agota los 31 slots (0x19b7: si ≥ 0x5d5a → slot 0x20) y cae al
  // fallback por TILE (0x19c0), que sobre suelo de arena termina en "Nothing to get!"
  // (0x1b28, DS 0x8e64). El decorado NO se retira. Careo del port: resolveBoardGet no
  // tiene rama para lootLayer-sin-pila → mismo mensaje, decorado intacto.
  it("(G)et hacia el cadáver de cm24 → 'Nothing to get!' y el decorado SIGUE", () => {
    const m = combatMaps[24]!;
    const corpse = m.units.find((u) => u.sprite === 30)!;
    const c = room(24, SEED, FLOOR);
    // La iniciativa puede dar el primer turno a un enemigo: avanza hasta un PJ.
    for (let guard = 0; c.currentUnit?.kind === "enemy" && guard < 50; guard++) c.tickEnemyTurns();
    const cur = c.currentUnit!;
    expect(cur.kind).toBe("player");
    cur.x = corpse.x - 1;
    cur.y = corpse.y;
    const textos = c
      .playerGet("east")
      .filter((e) => e.kind === "message")
      .map((e) => (e as { text: string }).text);
    expect(textos).toContain("Nothing to get!");
    const deco = c.lootTiles().find((l) => l.x === corpse.x && l.y === corpse.y);
    expect(deco?.tile).toBe(30); // no se retiró
  });
});

describe("#353 cabo cm64/cm65 (registros 48/49, Covetous r0/r1): re-medición del tablero de HOY", () => {
  // Los veredictos de re/notes/remolinos-causa-unica-deadends.md se midieron sobre un
  // tablero con la familia 0xEC a medias: 0xec entraba como placeholder 43 (stats cero)
  // y 0xed se TIRABA en silencio por el resto %4. Esperados EN CRUDO del volcado:
  //   reg 48 = 0xec×4 (→pool[0]) + 0xed×6 (→pool[1]) + Ghost 0x9c + <0x40: cadáver 0x1e,
  //            dinero×2, ítems 5 y 6 (4 rands de siembra).
  //   reg 49 = 0xec×6 + 0xed×6 + Ghost + <0x40: cadáver, dinero, cofre (1 rand).
  // Cantidades/índices con seed 0x1234 y planta 3: réplica Python independiente del
  // rand_range 0x2092 (la misma del describe (a), validada contra el seed final 0xcbbc).
  const IDX_POOL = [0x14, 0x15, 0x16, 0x22, 0x21, 0x18, 0x1f, 0x18]; // DATA.OVL 0x386e

  it("cm64: 11 enemigos REALES (4×20 + 6×24 + Ghost 23 con esta seed), CERO placeholder 43", () => {
    const c = room(64, SEED, FLOOR);
    const idx = c.combatants
      .filter((k) => k.kind === "enemy")
      .map((e) => e.enemyDef!.index)
      .sort((a, b) => a - b);
    expect(idx).toEqual([20, 20, 20, 20, 23, 24, 24, 24, 24, 24, 24]);
    expect(idx).not.toContain(43);
  });

  it("cm64 siembra: oro [16, 5] intercalado, arma 31, ítem-6 qty 5, cadáver en (9,5) — seed final 0x1999", () => {
    const c = room(64, SEED, FLOOR);
    expect(c.lootPileAt(9, 4)).toEqual([{ id: 2, category: "gold", qty: 16 }]);
    expect(c.lootPileAt(9, 6)).toEqual([{ id: 2, category: "gold", qty: 5 }]);
    expect(c.lootPileAt(8, 4)).toEqual([{ id: 5, category: "equipment", qty: 31 }]);
    expect(c.lootPileAt(8, 6)).toEqual([{ id: 6, category: "equipment", qty: 5 }]);
    expect(c.lootTiles().find((l) => l.x === 9 && l.y === 5)?.tile).toBe(30);
    expect(c.rng.rng.getSeed()).toBe(0x1999);
  });

  it("cm65: 13 enemigos REALES (6×20 + 6×24 + Ghost 23), cofre 16, oro 16, cadáver — seed final 0xcbbc", () => {
    const c = room(65, SEED, FLOOR);
    const idx = c.combatants
      .filter((k) => k.kind === "enemy")
      .map((e) => e.enemyDef!.index)
      .sort((a, b) => a - b);
    expect(idx).toEqual([20, 20, 20, 20, 20, 20, 23, 24, 24, 24, 24, 24, 24]);
    expect(c.chestAt(1, 6)).toBe(true);
    expect(c.chestContentsAt(1, 6)).toBe(16); // 3*3+7, determinista
    expect(c.lootPileAt(1, 4)).toEqual([{ id: 2, category: "gold", qty: 16 }]);
    expect(c.lootTiles().find((l) => l.x === 1 && l.y === 5)?.tile).toBe(30);
    expect(c.rng.rng.getSeed()).toBe(0xcbbc);
  });

  it("con CUALQUIER seed: todo enemigo de cm64/cm65 sale de la tabla del pool o es el Ghost — el DEADEND-por-contabilidad ya no puede construirse", () => {
    const permitidos = new Set([...IDX_POOL, 23]); // 23 = Ghost 0x9c, el único no-0xEC
    for (const pos of [64, 65]) {
      for (const seed of [1, 7, 0x1234, 0xbeef, 0x7fff]) {
        for (const e of room(pos, seed, FLOOR).combatants.filter((k) => k.kind === "enemy")) {
          expect(permitidos.has(e.enemyDef!.index), `cm${pos} seed ${seed}`).toBe(true);
          expect(e.hp, `cm${pos} seed ${seed}: enemigo sin HP = incontabilizable`).toBeGreaterThan(0);
        }
      }
    }
  });
});
