/**
 * FASE 1 (conquerRoom) — PRUEBA JUGADA de que una sala sellada por PLACA se GANA cuando el
 * resolver aprende a PISAR la placa. Caso insignia: combatmap 29 (Deceit, la sala de ch16b)
 * = 2 Dragon + 9 Headless. Los 9 Headless están sellados tras muro 0x4F; los 2 Dragon en un
 * bolsillo DryStone alcanzable a distancia. SIN pisar la placa (5,5) el resolver ranged mata
 * los 2 Dragon y se ATASCA en los 9 Headless (= el "dead-end" que ch16b asevera, artefacto
 * del resolver). CON la capacidad nueva "ir a pisar la placa", el muro se abre (COMBAT 0x111A)
 * y los 9 Headless pasan a melé/tiro → VICTORY.
 *
 * Este driver a nivel de MOTOR (no e2e) es el núcleo reutilizable del arnés conquerRoom: la
 * política de plato se porta luego a nav.ts para los capítulos de la Fase 2.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { buildEnemyDefs, type EnemyDef, type AdditionalEnemyFlag, type EnemyDataInput } from "../src/core/combat/enemies.js";
import { Combat, type CombatMapData, type PartyCombatant, type Dir8 } from "../src/core/combat/combat.js";
import { tileInfo } from "../src/core/tiles.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8").replace(/^﻿/, "")) as T;
}
type DataJson = EnemyDataInput & { defenseValues: number[]; spellAttackRange: number[] };
const data = load<DataJson>("../assets/data.json");
const additional = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const enemyDefs: EnemyDef[] = buildEnemyDefs(data, additional);
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");
const GRID = 11;

const DELTA: Record<Dir8, { dx: number; dy: number }> = {
  north: { dx: 0, dy: -1 }, south: { dx: 0, dy: 1 }, east: { dx: 1, dy: 0 }, west: { dx: -1, dy: 0 },
  ne: { dx: 1, dy: -1 }, nw: { dx: -1, dy: -1 }, se: { dx: 1, dy: 1 }, sw: { dx: -1, dy: 1 },
};
const cheb = (ax: number, ay: number, bx: number, by: number): number => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const walk = (t: number): boolean => tileInfo(t).walkable;
const shootable = (t: number): boolean => tileInfo(t).rangeWeaponPassable;

/** LOS de proyectil: raycast por celdas (Math.round), opaco = 1ª celda no rangeWeaponPassable. */
function hasLos(tiles: number[][], ax: number, ay: number, tx: number, ty: number): boolean {
  const dx = tx - ax, dy = ty - ay;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) return true;
  for (let i = 1; i <= steps; i++) {
    const x = Math.round(ax + (dx * i) / steps), y = Math.round(ay + (dy * i) / steps);
    if (x === tx && y === ty) return true;
    if (!shootable(tiles[y]?.[x] ?? -1)) return false;
  }
  return true;
}

/** BFS: primer paso cardinal del actor hacia una celda ADYACENTE a `goal` (o el goal si `onto`). */
function stepToward(tiles: number[][], ax: number, ay: number, goal: { x: number; y: number }, occ: Set<string>, onto: boolean): Dir8 | null {
  const key = (x: number, y: number) => `${x}:${y}`;
  const adj = new Set<string>();
  if (onto) adj.add(key(goal.x, goal.y));
  else for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) adj.add(key(goal.x + dx, goal.y + dy));
  const prev = new Map<string, { x: number; y: number; dir: Dir8 }>();
  const seen = new Set([key(ax, ay)]);
  let q = [{ x: ax, y: ay }];
  const DIRS: Array<[number, number, Dir8]> = [[0, -1, "north"], [0, 1, "south"], [-1, 0, "west"], [1, 0, "east"]];
  while (q.length) {
    const nq: Array<{ x: number; y: number }> = [];
    for (const cur of q) {
      if (adj.has(key(cur.x, cur.y))) {
        let c = key(cur.x, cur.y); let first: Dir8 | null = null;
        while (prev.has(c)) { const p = prev.get(c)!; first = p.dir; c = key(p.x, p.y); }
        return first;
      }
      for (const [dx, dy, dir] of DIRS) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
        const k = key(nx, ny);
        if (seen.has(k)) continue;
        const isGoalOnto = onto && nx === goal.x && ny === goal.y;
        if (!isGoalOnto && !walk(tiles[ny]![nx]!)) continue;
        if (occ.has(k) && !isGoalOnto) continue;
        seen.add(k); prev.set(k, { x: cur.x, y: cur.y, dir }); nq.push({ x: nx, y: ny });
      }
    }
    q = nq;
  }
  return null;
}

interface Verdict { outcome: "VICTORY" | "DEADEND_FIEL" | "FAIL"; turns: number; deaths: number; digest: string; }

/**
 * conquerRoomDrive — política JUGADA con capacidad de PLACA. Cada turno de un PJ activo:
 *  1) si un enemigo está a alcance con LOS despejada → dispara/golpea;
 *  2) si no hay enemigo batible pero queda una PLACA sin disparar alcanzable → va y la PISA;
 *  3) si no, avanza (BFS) hacia el enemigo más cercano; 4) si encajonado, pasa.
 * Verdict: VICTORY si el motor da victoria; DEADEND_FIEL si se agotan placas y enemigos y
 * NINGUNO es batible; FAIL en timeout ambiguo.
 *
 * OJO CON LA ETIQUETA `DEADEND_FIEL`: es el nombre de un ESTADO DE ESTA TAXONOMÍA, no un
 * veredicto de fidelidad. Lo que mide es que ESTA política, sobre el motor del port, se
 * queda sin jugadas — no que el original tampoco deje ganar la sala. Un dead-end de
 * fidelidad se adjudica contra el binario y por sala (regla del carril de sellos; ver el
 * sello RETIRADO POR FABRICADO de `ch16b-dead-end-fabricado.md`). El identificador se
 * conserva porque es un valor comparado en el arnés; lo que se corrige es la prosa.
 */
function conquerRoomDrive(combat: Combat, reach: number, maxTurns = 1500): Verdict {
  const steppedPlates = new Set<string>();
  let turns = 0;
  const alive = (): Array<{ x: number; y: number }> =>
    combat.combatants.filter((c) => c.kind === "enemy" && c.status !== "dead" && c.status !== "fled").map((e) => ({ x: e.x, y: e.y }));

  while (!combat.over && turns++ < maxTurns) {
    const cur = combat.currentUnit;
    if (!cur) break;
    if (cur.kind !== "player" || cur.status !== "active" || cur.charmed) { combat.tickEnemyTurns(); continue; }
    const tiles = combat.mapTiles;
    const enemies = combat.combatants.filter((c) => c.kind === "enemy" && c.status !== "dead" && c.status !== "fled");
    if (!enemies.length) break;
    const occ = new Set(combat.combatants.filter((c) => c.status !== "dead" && c.status !== "fled" && c.id !== cur.id).map((c) => `${c.x}:${c.y}`));

    // 1) atacar al batible más cercano (melé adyacente o ranged con LOS dentro de `reach`).
    const batibles = enemies
      .filter((e) => cheb(cur.x, cur.y, e.x, e.y) <= reach && hasLos(tiles, cur.x, cur.y, e.x, e.y))
      .sort((a, b) => cheb(cur.x, cur.y, a.x, a.y) - cheb(cur.x, cur.y, b.x, b.y) || a.hp - b.hp);
    if (batibles[0]) { combat.playerAttack(batibles[0].x, batibles[0].y); continue; }

    // 2) ¿alguna PLACA sin pisar y ANDABLE, alcanzable? → ir a pisarla (abre el muro).
    const plates = (combat as unknown as { map: CombatMapData }).map.triggers
      .filter((t) => t.at.x < GRID && t.at.y < GRID && walk(tiles[t.at.y]![t.at.x]!) && !steppedPlates.has(`${t.at.x}:${t.at.y}`));
    let acted = false;
    if (plates.length) {
      const plate = plates.sort((a, b) => cheb(cur.x, cur.y, a.at.x, a.at.y) - cheb(cur.x, cur.y, b.at.x, b.at.y))[0]!;
      if (cur.x === plate.at.x && cur.y === plate.at.y) { steppedPlates.add(`${plate.at.x}:${plate.at.y}`); }
      else {
        const dir = stepToward(tiles, cur.x, cur.y, plate.at, occ, /*onto*/ true);
        if (dir) {
          const before = `${cur.x},${cur.y}`;
          combat.playerMove(dir);
          const me = combat.combatants.find((c) => c.id === cur.id)!;
          if (`${me.x},${me.y}` !== before) {
            if (me.x === plate.at.x && me.y === plate.at.y) steppedPlates.add(`${plate.at.x}:${plate.at.y}`);
            continue;
          }
        }
      }
      // si pisó la placa este turno (sin moverse) o no hubo paso, sigue al enemigo abajo.
      acted = cur.x === plate.at.x && cur.y === plate.at.y;
      if (acted) { combat.playerPass(); continue; }
    }

    // 3) avanzar hacia el enemigo más cercano (BFS a celda adyacente).
    const target = [...enemies].sort((a, b) => cheb(cur.x, cur.y, a.x, a.y) - cheb(cur.x, cur.y, b.x, b.y))[0]!;
    const dir = stepToward(tiles, cur.x, cur.y, target, occ, /*onto*/ false);
    if (dir) {
      const before = `${cur.x},${cur.y}`;
      combat.playerMove(dir);
      const me = combat.combatants.find((c) => c.id === cur.id)!;
      if (`${me.x},${me.y}` !== before) continue;
    }
    combat.playerPass(); // 4) encajonado / sin ruta ni placa → pasa
  }

  const remaining = alive();
  const deaths = combat.combatants.filter((c) => c.kind === "player" && c.status === "dead").length;
  let outcome: Verdict["outcome"];
  if (combat.victory) outcome = "VICTORY";
  else if (remaining.length > 0 && turns < maxTurns) outcome = "DEADEND_FIEL"; // over sin victoria = party vaciada, pero...
  else outcome = "FAIL";
  // Precisión: si el motor no dio `over` y agotamos turnos con enemigos vivos = FAIL (ambiguo).
  if (!combat.over) outcome = remaining.length ? "FAIL" : "VICTORY";
  const digest = `${outcome}:t${turns}:d${deaths}:e${remaining.length}:p${steppedPlates.size}`;
  return { outcome, turns, deaths, digest };
}

function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}
/** Party con loadout ranged fuerte (espejo de ch16b seedLoadout: mejor caso). */
function rangedParty(state: GameState, reach: number): PartyCombatant[] {
  const members = state.characters.filter((c) => c.partyStatus === 0);
  for (const c of members) { c.level = 8; c.maxHp = 240; c.currentHp = 240; c.strength = 30; c.dexterity = 30; c.intelligence = 30; c.status = "G"; }
  return members.map((record, i) => ({ charIdx: state.characters.indexOf(record), record, weapons: [{ attack: 40, range: reach }] }));
}
function makeRoom29(seed: number, reach: number): Combat {
  const state = freshState();
  return new Combat({
    map: combatMaps[29]!,
    entryDirection: "south", // hardcode del port en main (opuesto) — spawn en el área abierta (ch16b entra al sur)
    party: rangedParty(state, reach),
    enemies: { fixedFromMap: true, defs: enemyDefs },
    seed,
    state,
    defenseValues: data.defenseValues,
    spellAttackRange: data.spellAttackRange,
    enemyDefs,
    roomCombat: true, // sala de mazmorra (g_unk_58a1&0x82) → los triggers de placa disparan
  });
}

describe("FASE 1 conquerRoom — sala sellada por placa se GANA al pisar la placa", () => {
  it("combatmap 29 (2 Dragon + 9 Headless): composición esperada", () => {
    const combat = makeRoom29(0, 5);
    const byName: Record<string, number> = {};
    for (const e of combat.combatants.filter((c) => c.kind === "enemy")) byName[e.enemyDef!.name] = (byName[e.enemyDef!.name] ?? 0) + 1;
    expect(byName["Dragon"]).toBe(2);
    expect(byName["Headless"]).toBe(9);
  });

  it("SIN pisar la placa el resolver se ATASCA (Headless sellados) — el 'dead-end' de ch16b", () => {
    // Política SIN placa: sólo ataca con LOS y avanza; nunca pisa (5,5).
    const combat = makeRoom29(0, 5);
    const steppedAll = new Set<string>();
    // marca todas las placas como "ya pisadas" para deshabilitar el paso-2 → simula el resolver viejo.
    for (const t of (combat as unknown as { map: CombatMapData }).map.triggers) steppedAll.add(`${t.at.x}:${t.at.y}`);
    // driver sin placa = conquerRoomDrive con placas pre-marcadas: reimplementamos el efecto
    // corriendo el drive pero con las placas neutralizadas vía un mapa sin triggers.
    const noPlateMap: CombatMapData = { ...combatMaps[29]!, triggers: [] };
    const state = freshState();
    const combat2 = new Combat({
      map: noPlateMap, entryDirection: "south", party: rangedParty(state, 5),
      enemies: { fixedFromMap: true, defs: enemyDefs }, seed: 0, state,
      defenseValues: data.defenseValues, spellAttackRange: data.spellAttackRange, enemyDefs,
      roomCombat: true,
    });
    const v = conquerRoomDrive(combat2, 5);
    expect(v.outcome, "sin placa NO se ganan los 9 Headless sellados").not.toBe("VICTORY");
    void combat; void steppedAll;
  });

  it("PISANDO la placa (5,5) el muro se abre y la sala se GANA (VICTORY)", () => {
    const combat = makeRoom29(0, 5);
    const v = conquerRoomDrive(combat, 5);
    expect(v.outcome, `veredicto jugado: ${v.digest}`).toBe("VICTORY");
  });

  it("determinismo ×2: dos corridas frescas dan el MISMO digest", () => {
    const a = conquerRoomDrive(makeRoom29(0, 5), 5);
    const b = conquerRoomDrive(makeRoom29(0, 5), 5);
    expect(a.digest).toBe(b.digest);
  });
});
