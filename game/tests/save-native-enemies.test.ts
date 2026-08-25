/**
 * Task #57 — persistencia NATIVA de enemigos errantes en la tabla de objetos 0x6B4 del
 * SAVED.GAM (espejo de `place_actor` kernel 0x3A74; derivación en
 * re/notes/native-persist-enemies.md). El sidecar sigue siendo autoritativo; la tabla
 * nativa es el espejo (escrito en el overworld) y el FALLBACK de carga para un SAVED.GAM
 * DOS puro sin sidecar.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createNewGame, type GameState } from "../src/core/state.js";
import {
  exportNativeSave,
  importNativeSave,
  SAVED_GAM_SIZE,
  type SaveSidecar,
} from "../src/core/saveNative.js";
import {
  enemyDefIndexToTile,
  enemyTileToDefIndex,
  isWaterEnemyDef,
  WATER_ENEMY_DEF_INDICES,
  type OverworldEnemy,
} from "../src/core/world/enemies.js";
import { buildEnemyDefs } from "../src/core/combat/enemies.js";
import { canonicalInit } from "./helpers/canonical-init.js";
import additionalFlags from "../src/core/data/AdditionalEnemyFlags.json";

// `game/assets/` son datos EXTRAÍDOS del juego: no viajan al repo público, así que
// un `import ... from "../assets/data.json"` estático hacía FALLAR `tsc --noEmit`
// allí (TS2307), y con él los jobs typecheck y build del CI público — este era el
// único fichero del árbol que lo hacía. Lectura en runtime, el mismo idiom que sus
// hermanos (amulet-negate, attack, camp-ambush…): tsc ya no lo resuelve y el test
// sigue leyendo lo mismo. Este spec está fuera de `test:pure` por dependencia real
// de assets (vitest.pure.config.ts:77), así que el CI público no lo ejecuta.
function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<Record<string, unknown>>("../assets/data.json");

const blankTemplate = (): Uint8Array => new Uint8Array(SAVED_GAM_SIZE);
const OBJ = 0x6b4;
const slotOff = (n: number): number => OBJ + n * 8;

/** Estado overworld (location 0) base + los enemigos dados. */
function overworldState(enemies: OverworldEnemy[], floor = 0): GameState {
  const s = createNewGame(canonicalInit());
  s.position = { location: 0, floor, x: 40, y: 50 };
  s.overworldEnemies = enemies;
  return s;
}

/** Simula un SAVED.GAM DOS "puro": mismo .gam pero sin la lista en el sidecar. */
function stripEnemies(sidecar: SaveSidecar): SaveSidecar {
  const clone = JSON.parse(JSON.stringify(sidecar)) as SaveSidecar;
  delete clone.gameState.overworldEnemies;
  return clone;
}

describe("save-native #57 — mapeo defIndex↔tile↔agua (anclado a las fuentes)", () => {
  const defs = buildEnemyDefs(
    {
      enemyStats: data.enemyStats as number[][],
      enemyFlags: data.enemyFlags as number[][],
      enemyAttackRange: data.enemyAttackRange as number[],
      monsterNamesMixed: data.monsterNamesMixed as string[],
      monsterNamesUpper: data.monsterNamesUpper as string[],
    },
    additionalFlags as never,
  );

  it("enemyDefIndexToTile espeja buildEnemyDefs para los 48 índices", () => {
    for (let i = 0; i < 48; i++) expect(enemyDefIndexToTile(i)).toBe(defs[i]!.tile);
  });

  it("enemyTileToDefIndex es el inverso exacto (y null para no-enemigos)", () => {
    for (let i = 0; i < 48; i++) expect(enemyTileToDefIndex(defs[i]!.tile)).toBe(i);
    // Tiles que no son de enemigo: byte de terreno / NPC / desalineados del stride.
    expect(enemyTileToDefIndex(0x100)).toBeNull(); // < base 320
    expect(enemyTileToDefIndex(0x141)).toBeNull(); // 321, no divisible por 4 desde 320
    expect(enemyTileToDefIndex(0x200)).toBeNull(); // 512, fuera de rango (> índice 47)
  });

  it("WATER_ENEMY_DEF_INDICES coincide con IsWaterEnemy de AdditionalEnemyFlags.json", () => {
    const fromJson = new Set<number>();
    (additionalFlags as { IsWaterEnemy: boolean }[]).forEach((f, i) => {
      if (f.IsWaterEnemy) fromJson.add(i);
    });
    expect(new Set(WATER_ENEMY_DEF_INDICES)).toEqual(fromJson);
    expect(isWaterEnemyDef(18)).toBe(true); // Sea Serpent
    expect(isWaterEnemyDef(41)).toBe(false); // Troll
  });
});

describe("save-native #57 — espejo nativo en 0x6B4 (escritura)", () => {
  it("escribe el registro de 8 B del binario en el slot del enemigo (Troll)", () => {
    // Troll: defIndex 41 → tile 320+164=484=0x1E4 → byte +0 = 0xE4.
    const troll: OverworldEnemy = { slot: 5, defIndex: 41, tile: 0x1e4, water: false, x: 0x30, y: 0x2a };
    const { gam } = exportNativeSave(overworldState([troll], 0), blankTemplate());
    const o = slotOff(5);
    expect([gam[o], gam[o + 1], gam[o + 2], gam[o + 3], gam[o + 4], gam[o + 5], gam[o + 6], gam[o + 7]])
      .toEqual([0xe4, 0xe4, 0x30, 0x2a, 0x00, 0x00, 0x00, 0x00]);
  });

  it("pirata: byte +0 = 0x2C, casco en +5 y windCtr en +7", () => {
    const pirate: OverworldEnemy = {
      slot: 3, defIndex: 8, tile: 0x12c, water: true, x: 10, y: 20, hull: 0x50, windCtr: 3,
    };
    const { gam } = exportNativeSave(overworldState([pirate], 0), blankTemplate());
    const o = slotOff(3);
    expect([gam[o], gam[o + 1], gam[o + 5], gam[o + 7]]).toEqual([0x2c, 0x2c, 0x50, 3]);
  });

  it("obj0 (avatar) intacto y slots sin enemigo a cero", () => {
    const troll: OverworldEnemy = { slot: 10, defIndex: 41, tile: 0x1e4, water: false, x: 1, y: 2 };
    const { gam } = exportNativeSave(overworldState([troll]), blankTemplate());
    // slot 0 (avatar) = pos; slot 1 (sin enemigo) a cero.
    expect(gam[0x6b6]).toBe(40); // obj0 X = position.x
    expect(gam.slice(slotOff(1), slotOff(1) + 8).every((b) => b === 0)).toBe(true);
  });

  it("byte-neutro en town (location≠0): no toca los slots 1..23 aunque haya enemigos", () => {
    const s = createNewGame(canonicalInit());
    s.position = { location: 15, floor: 0, x: 5, y: 6 };
    s.overworldEnemies = [{ slot: 4, defIndex: 41, tile: 0x1e4, water: false, x: 1, y: 2 }];
    const { gam } = exportNativeSave(s, blankTemplate());
    // Pool 1..23 sigue a cero (la plantilla en blanco lo estaba) → byte-neutro.
    expect(gam.slice(slotOff(1), slotOff(24)).every((b) => b === 0)).toBe(true);
  });
});

describe("save-native #57 — round-trip y fallback DOS", () => {
  const threeEnemies: OverworldEnemy[] = [
    { slot: 2, defIndex: 20, tile: enemyDefIndexToTile(20), water: false, x: 11, y: 12 }, // Giant Rat
    { slot: 8, defIndex: 41, tile: enemyDefIndexToTile(41), water: false, x: 33, y: 34 }, // Troll
    { slot: 15, defIndex: 8, tile: enemyDefIndexToTile(8), water: true, x: 55, y: 56, hull: 0x64, windCtr: 2 }, // Pirata
  ];

  it("round-trip por SIDECAR (autoritativo): 3 enemigos en slots no contiguos, idéntico", () => {
    const state = overworldState(structuredClone(threeEnemies));
    const { gam, sidecar } = exportNativeSave(state, blankTemplate());
    const loaded = importNativeSave(gam, JSON.parse(JSON.stringify(sidecar)));
    expect(loaded.overworldEnemies).toEqual(threeEnemies);
  });

  it("FALLBACK: un SAVED.GAM sin sidecar-enemies reconstruye de la tabla nativa (loc 0)", () => {
    const { gam, sidecar } = exportNativeSave(overworldState(structuredClone(threeEnemies)), blankTemplate());
    const loaded = importNativeSave(gam, stripEnemies(sidecar));
    // Reconstruido campo a campo desde 0x6B4 (defIndex por fórmula, water por set).
    expect(loaded.overworldEnemies).toEqual(threeEnemies);
  });

  it("FALLBACK preserva casco/windCtr del pirata desde +5/+7", () => {
    const pirate: OverworldEnemy = {
      slot: 7, defIndex: 8, tile: enemyDefIndexToTile(8), water: true, x: 5, y: 6, hull: 0x3a, windCtr: 9,
    };
    const { gam, sidecar } = exportNativeSave(overworldState([pirate]), blankTemplate());
    const loaded = importNativeSave(gam, stripEnemies(sidecar));
    expect(loaded.overworldEnemies).toEqual([pirate]);
  });

  it("export→import(nativo)→export es byte-idéntico en la tabla 0x6B4 (idempotente)", () => {
    const { gam, sidecar } = exportNativeSave(overworldState(structuredClone(threeEnemies)), blankTemplate());
    const reloaded = importNativeSave(gam, stripEnemies(sidecar)); // reconstruye de 0x6B4
    const roundtrip = exportNativeSave(reloaded, gam.slice()); // re-exporta sobre el mismo .gam
    expect(roundtrip.gam.slice(slotOff(1), slotOff(24))).toEqual(gam.slice(slotOff(1), slotOff(24)));
  });

  it("compat: un sidecar viejo CON enemigos manda sobre la tabla nativa (loc 0)", () => {
    // .gam con Troll en slot 5 pero sidecar apuntando a un pirata en slot 9 → gana el sidecar.
    const { gam } = exportNativeSave(overworldState([{ slot: 5, defIndex: 41, tile: 0x1e4, water: false, x: 1, y: 2 }]), blankTemplate());
    const sidecarEnemy: OverworldEnemy = { slot: 9, defIndex: 8, tile: 0x12c, water: true, x: 7, y: 8, hull: 100 };
    const { sidecar } = exportNativeSave(overworldState([sidecarEnemy]), blankTemplate());
    const loaded = importNativeSave(gam, JSON.parse(JSON.stringify(sidecar)));
    expect(loaded.overworldEnemies).toEqual([sidecarEnemy]);
  });

  it("FALLBACK ignora slots que no son de enemigo (NPC/objeto) sin romper", () => {
    const { gam, sidecar } = exportNativeSave(overworldState([]), blankTemplate());
    // Siembra a mano un slot con un tile de NPC (byte +0 = 0x48 → tile 0x148 SÍ mapea a idx2;
    // usamos un tile desalineado 0x41 → 0x141, que enemyTileToDefIndex rechaza).
    const o = slotOff(6);
    gam[o] = 0x41; gam[o + 1] = 0x41; gam[o + 2] = 3; gam[o + 3] = 4;
    const loaded = importNativeSave(gam, stripEnemies(sidecar));
    expect(loaded.overworldEnemies).toEqual([]); // el slot no-enemigo se ignora
  });
});
