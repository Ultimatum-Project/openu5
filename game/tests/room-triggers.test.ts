/**
 * TRIGGERS de SALA de mazmorra (.CBT) — COMBAT.OVL 0x111A, llamado desde el mover de
 * combate SJOG.OVL 0x1d3c tras colocar un combatiente en (x,y), GATE g_unk_58a1&0x82
 * (= `roomCombat`; el combate de campo omite el flag → sin triggers).
 *
 * DERIVACIÓN (re/disasm):
 *  - COMBAT 0x111A: recorre los 8 triggers; si la celda del combatiente == su `at`,
 *    escribe el `sprite` del trigger en newPos1 y newPos2 (cada uno sólo si sus coords
 *    < 0xB — `cmp 0xb / jae skip`), y desactiva el trigger one-shot (0xFF en at.x/at.y).
 *  - SJOG 0x1d3c empuja (X,Y) DESTINO del que ACABA de moverse — party O enemigo — y
 *    llama al check bajo `test [g_unk_58a1],0x82`.
 *
 * Efecto real: abre muros (0x4F StoneBrickWall → 0x44 BrickFloor) o siembra lava (0x8F).
 * Sin esto, salas como combatmap 29 (Deceit, 9 Headless sellados tras 0x4F) parecían
 * INGANABLES: pisar la placa (5,5) abre el bolsillo → melé → ganable.
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
import { tileInfo } from "../src/core/tiles.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");
const defs = (): EnemyDef[] => buildEnemyDefs(data, additionalFlags);

/** BFS 4-vecinos sobre tiles ANDABLES (tileInfo.walkable) desde `start`. */
function reachable(tiles: number[][], start: { x: number; y: number }): boolean[][] {
  const seen = tiles.map((r) => r.map(() => false));
  const q = [start];
  seen[start.y]![start.x] = true;
  while (q.length) {
    const { x, y } = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= 11 || ny >= 11) continue;
      if (seen[ny]![nx]) continue;
      const t = tiles[ny]![nx]!;
      if (!tileInfo(t).walkable) continue;
      seen[ny]![nx] = true;
      q.push({ x: nx, y: ny });
    }
  }
  return seen;
}

const FLOOR = 0x44; // BrickFloor (andable)
const WALL = 0x4f; // StoneBrickWall (sella)
const LAVA = 0x8f; // Lava (la escriben algunas placas)

/** Malla 11×11 toda FLOOR con celdas (x,y)→tile sobreescritas. */
function grid(overrides: Record<string, number>): number[][] {
  const t: number[][] = [];
  for (let y = 0; y < 11; y++) {
    const row: number[] = [];
    for (let x = 0; x < 11; x++) row.push(overrides[`${x},${y}`] ?? FLOOR);
    t.push(row);
  }
  return t;
}
function synthMap(
  tiles: number[][],
  triggers: CombatMapData["triggers"],
  units: CombatMapData["units"] = [{ sprite: 0x40, x: 10, y: 10 }], // 1 enemigo idx0 lejos
): CombatMapData {
  return {
    index: 999,
    territory: "dungeon",
    name: null,
    tiles,
    // el mover al que se le pega la party: sur → todos a cuestas lejos del área de test
    playerStarts: {
      south: [{ x: 0, y: 10 }, { x: 1, y: 10 }, { x: 2, y: 10 }, { x: 3, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 10 }],
      north: [{ x: 0, y: 0 }],
      east: [{ x: 10, y: 0 }],
      west: [{ x: 0, y: 0 }],
    },
    units,
    triggers,
  };
}
function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}
function party(state: GameState): PartyCombatant[] {
  return state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));
}
function makeCombat(map: CombatMapData, roomCombat: boolean): Combat {
  const state = freshState();
  return new Combat({
    map,
    entryDirection: "south",
    party: party(state),
    enemies: { fixedFromMap: true, defs: defs() },
    seed: 1,
    state,
    defenseValues: data.defenseValues,
    roomCombat,
  });
}

/** Coloca un PJ adyacente a `at` por el oeste, FUERZA su turno (independiente del orden
 *  de iniciativa del mapa) y despeja la celda destino de otros ocupantes; devuelve el PJ. */
function primeMoverWestOf(combat: Combat, ax: number, ay: number): { id: number; x: number; y: number } {
  const player = combat.combatants.find((c) => c.kind === "player" && c.status === "active")!;
  // fuerza que sea su turno: currentUnit devuelve `currentActor` si está activo.
  (combat as unknown as { currentActor: unknown }).currentActor = player;
  for (const c of combat.combatants) {
    if (c === player) continue;
    if ((c.x === ax && c.y === ay) || (c.x === ax - 1 && c.y === ay)) { c.x = 0; c.y = 0; }
  }
  player.x = ax - 1;
  player.y = ay;
  return player;
}

describe("triggers de sala (.CBT) — COMBAT 0x111A / SJOG 0x1d3c", () => {
  it("pisar la placa `at` ABRE el muro (0x4F→0x44) en newPos1 y newPos2 (ambos < 11)", () => {
    const map = synthMap(grid({ "2,2": WALL, "8,8": WALL }), [
      { sprite: FLOOR, at: { x: 5, y: 5 }, pos1: { x: 2, y: 2 }, pos2: { x: 8, y: 8 } },
    ]);
    const combat = makeCombat(map, /*roomCombat*/ true);
    expect(combat.mapTiles[2]![2]).toBe(WALL);
    expect(combat.mapTiles[8]![8]).toBe(WALL);
    primeMoverWestOf(combat, 5, 5);
    combat.playerMove("east"); // (4,5) → (5,5) = la placa
    expect(combat.mapTiles[2]![2], "newPos1 abierto").toBe(FLOOR);
    expect(combat.mapTiles[8]![8], "newPos2 abierto").toBe(FLOOR);
  });

  it("combate de CAMPO (roomCombat=false) NO dispara triggers", () => {
    const map = synthMap(grid({ "2,2": WALL }), [
      { sprite: FLOOR, at: { x: 5, y: 5 }, pos1: { x: 2, y: 2 }, pos2: { x: 2, y: 2 } },
    ]);
    const combat = makeCombat(map, /*roomCombat*/ false);
    primeMoverWestOf(combat, 5, 5);
    combat.playerMove("east");
    expect(combat.mapTiles[2]![2], "sin trigger en campo").toBe(WALL);
  });

  it("one-shot: la placa NO se re-dispara una segunda vez", () => {
    const map = synthMap(grid({}), [
      { sprite: LAVA, at: { x: 5, y: 5 }, pos1: { x: 3, y: 3 }, pos2: { x: 3, y: 3 } },
    ]);
    const combat = makeCombat(map, true);
    primeMoverWestOf(combat, 5, 5);
    combat.playerMove("east");
    expect(combat.mapTiles[3]![3], "1ª vez siembra lava").toBe(LAVA);
    // Fidelidad del DATO: el one-shot escribe 0xFF en at.x/at.y (no un flag) — COMBAT 0x111A.
    const trg = (combat as unknown as { triggers: { at: { x: number; y: number } }[] }).triggers[0]!;
    expect([trg.at.x, trg.at.y], "at consumido = (0xFF,0xFF)").toEqual([0xff, 0xff]);
    // Deshacemos el efecto en la rejilla y RE-pisamos la placa (turno forzado de nuevo):
    // el trigger ya está consumido (one-shot) → NO re-escribe.
    combat.mapTiles[3]![3] = FLOOR;
    primeMoverWestOf(combat, 5, 5);
    combat.playerMove("east");
    expect(combat.mapTiles[3]![3], "2ª vez NO re-siembra (one-shot)").toBe(FLOOR);
  });

  it("#29 REAL (combatmap 29 = Deceit): pisar (5,5) DESELLA el bolsillo de los 9 Headless", () => {
    // combatmap 29 (array pos 29 = DUNGEON.CBT[13]) = 2 Dragon + 9 Headless (ch16b los
    // nombra BIEN). Los 9 Headless están sellados tras muro 0x4F en x1-3/y4-6. La placa
    // (5,5) escribe 0x44 BrickFloor sobre ese muro → los desella (los 2 Dragon quedan en
    // DryStone pero son RANGED-alcanzables). ch16b sigue verde porque su resolver ranged
    // NO pisa (5,5); este test PRUEBA que la placa SÍ abriría el bolsillo si se pisara.
    const map = combatMaps[29]!;
    const sealedCell = { x: 1, y: 5 }; // una de las celdas selladas de Headless
    const spawn = map.playerStarts.south[0]!; // (4,8), entrada por el sur (facing norte)

    const combat = makeCombat(map, /*roomCombat*/ true);
    // ANTES: el Daemon sellado NO es alcanzable a pie desde el spawn.
    expect(reachable(combat.mapTiles, spawn)[sealedCell.y]![sealedCell.x], "sellado al entrar").toBe(false);
    // (5,5) SÍ es alcanzable (área abierta) — la party puede llegar a la placa.
    expect(reachable(combat.mapTiles, spawn)[5]![5], "la placa es alcanzable").toBe(true);

    // Un PJ pisa la placa (5,5).
    primeMoverWestOf(combat, 5, 5);
    combat.playerMove("east");

    // DESPUÉS: el bolsillo de Daemon quedó conectado al área de la party → melé posible.
    expect(reachable(combat.mapTiles, spawn)[sealedCell.y]![sealedCell.x], "deSELLado tras la placa").toBe(true);
  });

  it("guarda de coords: un destino con coord ≥ 11 se SALTA sin tocar la rejilla", () => {
    const map = synthMap(grid({ "0,0": WALL }), [
      { sprite: FLOOR, at: { x: 5, y: 5 }, pos1: { x: 0, y: 0 }, pos2: { x: 11, y: 11 } },
    ]);
    const combat = makeCombat(map, true);
    primeMoverWestOf(combat, 5, 5);
    expect(() => combat.playerMove("east")).not.toThrow();
    expect(combat.mapTiles[0]![0], "pos1 válido aplicado").toBe(FLOOR);
    // pos2 (11,11) fuera de rango: no crashea ni escribe fuera de la malla 11×11.
    expect(combat.mapTiles.length).toBe(11);
  });
});
