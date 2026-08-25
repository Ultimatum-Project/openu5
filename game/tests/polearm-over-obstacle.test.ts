/**
 * Polearm «(p) attack over obstacles» — FIEL (COMSUBS:0x0822 rama 0x087e).
 *
 * El binario desvía Morning Star (0x19) y Halberd (0x22) del vuelo con raycast
 * de línea-de-tiro (0x12de) a un golpe DIRECTO por encima del obstáculo. El resto
 * de armas de rango >1 (arcos, honda, hacha mágica…) SÍ vuelan y las bloquea un
 * tile intermedio opaco. Derivación completa en re/notes/polearm-attack.md.
 *
 * Este test fija el caso mínimo: obstáculo entre atacante y objetivo a rango 2 →
 * el Halberd PEGA, un arma de rango que no es asta se BLOQUEA («Blocked by wall!»).
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
import { Combat, type CombatMapData, type CombatEvent } from "../src/core/combat/combat.js";
import { WEAPON_HALBERD, WEAPON_MORNING_STAR } from "../src/core/combat/formulas.js";
import { tileInfo } from "../src/core/tiles.js";

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
function byName(name: string): EnemyDef {
  const d = buildEnemyDefs(data, additionalFlags).find((e) => e.name === name);
  if (!d) throw new Error(`enemigo no encontrado: ${name}`);
  return d;
}
const campFire = (): CombatMapData => combatMaps[0]!;

/** Primer tile que NO es range-weapon-passable (un muro): sirve de obstáculo. */
function firstBlockerTile(): number {
  for (let t = 0; t < 256; t++) {
    if (tileInfo(t) && tileInfo(t).rangeWeaponPassable === false) return t;
  }
  throw new Error("no hay ningún tile no-range-passable en la tabla");
}

/**
 * Arena: PJ en (4,5), obstáculo en (5,5), enemigo en (6,5) — distancia 2 en línea
 * recta, la celda intermedia es un muro. El PJ actúa primero.
 */
function arena(weaponId: number, range: number): {
  combat: Combat;
  enemy: { x: number; y: number };
} {
  const state = freshState();
  const wall = firstBlockerTile();
  // Copia profunda del mapa CampFire con un muro plantado en (5,5).
  const base = campFire();
  const tiles = base.tiles.map((row) => row.slice());
  tiles[5]![5] = wall;
  const map: CombatMapData = { ...base, tiles };

  const combat = new Combat({
    map,
    entryDirection: "east",
    party: [
      {
        charIdx: 0,
        record: state.characters[0]!,
        weapons: [{ id: weaponId, attack: 50, range }],
      },
    ],
    enemies: [{ def: byName("Skeleton"), count: 1 }],
    seed: 7,
    state,
    defenseValues: data.defenseValues,
  });

  const player = combat.combatants.find((c) => c.kind === "player")!;
  const enemy = combat.combatants.find((c) => c.kind === "enemy")!;
  player.x = 4;
  player.y = 5;
  enemy.x = 6;
  enemy.y = 5;
  player.counter = 1; // el PJ actúa primero
  enemy.counter = 200;
  return { combat, enemy: { x: enemy.x, y: enemy.y } };
}

describe("Polearm ataca por encima de obstáculos (COMSUBS:0x0822 0x087e)", () => {
  it("precondición: el tile-obstáculo NO es range-weapon-passable", () => {
    expect(tileInfo(firstBlockerTile()).rangeWeaponPassable).toBe(false);
  });

  it("Halberd (0x22, rango 2) PEGA sobre el muro intermedio", () => {
    const { combat, enemy } = arena(WEAPON_HALBERD, 2);
    const events: CombatEvent[] = combat.playerAttack(enemy.x, enemy.y);
    expect(events.some((e) => e.text === "Blocked by wall!")).toBe(false);
    expect(events.some((e) => e.kind === "attacked")).toBe(true);
  });

  it("Morning Star (0x19, rango 2) PEGA sobre el muro intermedio", () => {
    const { combat, enemy } = arena(WEAPON_MORNING_STAR, 2);
    const events = combat.playerAttack(enemy.x, enemy.y);
    expect(events.some((e) => e.text === "Blocked by wall!")).toBe(false);
    expect(events.some((e) => e.kind === "attacked")).toBe(true);
  });

  it("un arco (0x1a, rango 2) — NO asta — vuela hasta el muro y se DESPERDICIA (fiel)", () => {
    const { combat, enemy } = arena(0x1a, 2);
    const events = combat.playerAttack(enemy.x, enemy.y);
    // El proyectil NO pega sobre el muro (no es asta): se detiene en la celda opaca.
    // Tiro DESPERDICIADO fiel: SIN «Blocked by wall!» (fabricado), sin golpe, con anim.
    expect(events.some((e) => e.text === "Blocked by wall!")).toBe(false);
    expect(events.some((e) => e.kind === "attacked")).toBe(false); // no golpea al enemigo tras el muro
    expect(events.some((e) => e.kind === "projectile")).toBe(true); // vuela hasta el muro
  });

  it("aimGeometry arranca sobre el PJ; con memoria de objetivo, la validación es distancia PURA (0x04D4, sin LOS)", () => {
    // RE-BASELINE hotfix #4: el arranque «sobre el enemigo alcanzable» era
    // fabricado — COMSUBS 0x0504 arranca en el ÚLTIMO OBJETIVO recordado
    // (`lastTargetId`, scratch 0x5C61) o en el PROPIO PJ (@0x0562). La validación
    // del recordado mide SOLO distancia (@0x055a call 0x04D4) — el muro intermedio
    // NO desvalida (el line-stop del asta/arco es del VUELO, no del cursor).
    const halberd = arena(WEAPON_HALBERD, 2).combat;
    expect(halberd.currentUnit?.kind).toBe("player"); // ceba currentActor
    const geomH = halberd.aimGeometry();
    expect(geomH).not.toBeNull();
    expect(geomH!.initial).toEqual({ x: 4, y: 5 }); // sin memoria → el PJ

    const bow = arena(0x1a, 2).combat;
    expect(bow.currentUnit?.kind).toBe("player");
    const bowEnemy = bow.combatants.find((c) => c.kind === "enemy")!;
    bow.currentUnit!.lastTargetId = bowEnemy.id;
    const geomB = bow.aimGeometry();
    expect(geomB).not.toBeNull();
    // Recordado a dist 2 ≤ alcance 2 → captura el cursor AUNQUE el muro bloquee
    // el vuelo (distancia pura, sin LOS).
    expect(geomB!.initial).toEqual({ x: 6, y: 5 });
  });
});
