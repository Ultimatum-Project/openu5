/**
 * FASE 2 DEL COMBATE FIEL · Lote 1 — targeting del JUGADOR por BANDO (line-stop de
 * `playerAttackDir`, espejo de `selectTarget` COMBAT:0x0D30) + ARRANQUE del cursor
 * de Aim.
 *
 * RE-BASELINE (hotfix combate #4, re/notes/combate-hotfix-20260722.md): el
 * «auto-target al rival más cercano» de `aimGeometry` era FABRICADO — COMSUBS
 * 0x0504 @0x0511-0x0568 arranca el cursor sobre el ÚLTIMO OBJETIVO recordado del
 * actor (scratch 0x5C5A+idx*8 +7, `lastTargetId`; lo escriben el confirm del melé
 * 0x0C52 @0x0d04-0x0d16 y el disparo 0x0A68 @0x0b12/0x0b34) si sigue vivo y en
 * alcance, y si no sobre la CELDA DEL PROPIO ACTOR (@0x0562). No hay barrido de
 * cercanía. El line-stop por BANDO de `playerAttackDir` (poseídos apuntables,
 * aliados charmed saltados) sigue vigente — es del vuelo, no del cursor.
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

function load<T>(rel: string): T {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");

function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}
function byName(name: string): EnemyDef {
  const d = buildEnemyDefs(data, additionalFlags).find((e) => e.name === name);
  if (!d) throw new Error(`enemigo no encontrado: ${name}`);
  return d;
}

/** Arena 11×11 de HIERBA abierta: melé y raycast alcanzan sin obstáculos de tile. */
function openField(): CombatMapData {
  const GRASS = 5;
  const tiles: number[][] = [];
  for (let y = 0; y < 11; y++) {
    const row: number[] = [];
    for (let x = 0; x < 11; x++) row.push(GRASS);
    tiles.push(row);
  }
  const starts = { east: [{ x: 0, y: 5 }], west: [{ x: 0, y: 5 }], south: [{ x: 0, y: 5 }], north: [{ x: 0, y: 5 }] };
  // 2 slots de unit → hasta 2 enemigos (los tests con count:1 sólo colocan uno). Las
  // posiciones se sobrescriben tras construir el combate.
  return { index: 998, territory: "britannia", name: "SyntheticOpenField", tiles, playerStarts: starts, units: [{ sprite: 0, x: 10, y: 5 }, { sprite: 0, x: 10, y: 9 }], triggers: [] };
}

function makeCombat(weapon: { id?: number; attack: number; range: number }) {
  const state = freshState();
  const spider = byName("Giant Spider"); // melé, terrestre
  const p: PartyCombatant[] = state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [weapon] }));
  const combat = new Combat({
    map: openField(),
    entryDirection: "east",
    party: p,
    enemies: [{ def: spider, count: 1 }],
    seed: 7,
    state,
    defenseValues: data.defenseValues,
  });
  const players = combat.combatants.filter((c) => c.kind === "player");
  const enemy = combat.combatants.find((c) => c.kind === "enemy")!;
  return { combat, players, enemy };
}

describe("aimGeometry / playerAttackDir — targeting por BANDO (fase 2 lote 1)", () => {
  it("aimGeometry: sin objetivo recordado el cursor arranca sobre el PROPIO actor (COMSUBS 0x0504 @0x0562)", () => {
    const { combat, players, enemy } = makeCombat({ attack: 10, range: 1 });
    const [A, B, C] = players;
    A!.counter = 1; B!.counter = 200; C!.counter = 200; enemy.counter = 200;
    A!.x = 5; A!.y = 5;
    B!.x = 6; B!.y = 5; // adyacente a A — irrelevante: no hay barrido de cercanía
    C!.x = 0; C!.y = 0;
    enemy.x = 6; enemy.y = 6; // adyacente también — tampoco captura el cursor

    expect(combat.currentUnit).toBe(A);
    expect(combat.aimGeometry()!.initial).toEqual({ x: A!.x, y: A!.y });
  });

  it("aimGeometry: el ÚLTIMO OBJETIVO recordado captura el cursor si sigue en alcance (@0x0539-0x0560)", () => {
    const { combat, players, enemy } = makeCombat({ id: 0x1a, attack: 99, range: 3 });
    const [A, B, C] = players;
    A!.counter = 1; B!.counter = 200; C!.counter = 200; enemy.counter = 200;
    A!.x = 0; A!.y = 5;
    B!.x = 0; B!.y = 0; C!.x = 0; C!.y = 10;
    enemy.x = 3; enemy.y = 5; // dist 3 = alcance del arco

    expect(combat.currentUnit).toBe(A);
    A!.lastTargetId = enemy.id; // memoria del scratch 0x5C61
    expect(combat.aimGeometry()!.initial).toEqual({ x: enemy.x, y: enemy.y });

    // Fuera de alcance → cae al propio actor (fallback @0x0562).
    enemy.x = 9;
    expect(combat.aimGeometry()!.initial).toEqual({ x: A!.x, y: A!.y });

    // Muerto → también fallback (flags &0x30 en el asm; isActive en el port).
    enemy.x = 3;
    enemy.status = "dead";
    expect(combat.aimGeometry()!.initial).toEqual({ x: A!.x, y: A!.y });
  });

  it("aimGeometry: un miembro POSEÍDO (charmed) recordado como objetivo captura el cursor", () => {
    const { combat, players, enemy } = makeCombat({ attack: 10, range: 1 });
    const [A, B, C] = players;
    A!.counter = 1; B!.counter = 200; C!.counter = 200; enemy.counter = 200;
    A!.x = 5; A!.y = 5;
    B!.x = 6; B!.y = 5; B!.charmed = true; // poseído adyacente
    C!.x = 0; C!.y = 0;
    enemy.x = 5; enemy.y = 9;

    expect(combat.currentUnit).toBe(A);
    A!.lastTargetId = B!.id; // p.ej. tras un melé previo contra el poseído
    expect(combat.aimGeometry()!.initial).toEqual({ x: B!.x, y: B!.y });
  });

  it("playerAttackDir: la línea de tiro se detiene en el miembro POSEÍDO (charmed)", () => {
    const { combat, players, enemy } = makeCombat({ id: 0x1a, attack: 99, range: 3 });
    const [A, B, C] = players;
    A!.counter = 1; B!.counter = 200; C!.counter = 200; enemy.counter = 200;
    A!.x = 0; A!.y = 5; A!.speed = 99; // DEX alta → acierto garantizado
    B!.x = 2; B!.y = 5; B!.charmed = true; B!.hp = 1; B!.maxHp = 1;
    C!.x = 0; C!.y = 0;
    enemy.x = 3; enemy.y = 5;

    expect(combat.currentUnit).toBe(A);
    const events = combat.playerAttackDir(1, 0); // Este: la línea para en B (poseído), no en el enemigo
    const hit = events.find((e) => e.kind === "attacked" && e.hit);
    expect(hit, "el disparo acertó").toBeTruthy();
    expect(hit!.targetId, "el objetivo fue el poseído, no el enemigo").toBe(B!.id);
  });

  it("playerAttack MELÉ escribe la memoria de objetivo → el siguiente Aim arranca sobre él (0x0C52 @0x0d04-0x0d16)", () => {
    const { combat, players, enemy } = makeCombat({ attack: 10, range: 1 });
    const [A, B, C] = players;
    A!.counter = 1; B!.counter = 200; C!.counter = 200; enemy.counter = 199;
    A!.x = 5; A!.y = 5; B!.x = 0; B!.y = 0; C!.x = 1; C!.y = 1;
    enemy.x = 6; enemy.y = 5; // adyacente
    enemy.hp = 999; enemy.maxHp = 999; // sobrevive al golpe

    expect(combat.currentUnit).toBe(A);
    combat.playerAttack(6, 5); // melé con ocupante → lastTargetId = enemigo
    expect(A!.lastTargetId).toBe(enemy.id);
  });
});
