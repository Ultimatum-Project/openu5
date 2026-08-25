/**
 * EMBOSCADA AL ENTRAR A DOOM — MAINOUT enter_map_location 0x7d8-0x812.
 *
 * Al pulsar (E)nter sobre la entrada de Doom (loc id 40) a pie, el binario comprueba
 * si algún Shadowlord sigue vivo (AND de los 3 bytes g_shadowlord_locs; bit7 SET =
 * muerto). Si ALGUNO vive → imprime "\nAttacked at entrance!\n" (DS 0x2a2f) y monta
 * combate contra un Shadowlord (def 47, arena Psychedelic = muros ShadowlordBoundary)
 * RETORNANDO sin cargar la mazmorra: la emboscada es la GUARDA de Doom. Si TODOS
 * muertos → descenso normal (0x837), sin emboscada. La comprobación es EXCLUSIVA de
 * Doom (`cmp [bp-2], 0x27`): las otras 7 mazmorras nunca emboscan.
 *
 * Testigo del original: doom-entrada-sandalwood.mov f0115 (yell VERAMOCOR → terremoto
 * → Enter cave → "Attacked at entrance!" + "SHADOW LORD" + "*** CONFLICT ***" + arena
 * magenta de cueva).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { Game, type GameData, type GameSystems, type CombatResources } from "../src/core/game.js";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import type { WorldData } from "../src/core/world/map.js";
import type { DungeonData } from "../src/core/dungeon/dungeon.js";
import { wordSpokenFlag } from "../src/core/quest/words.js";
import { SHADOWLORDS, shadowlordDeadFlag } from "../src/core/quest/shadowlords.js";
import {
  buildEnemyDefs,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../src/core/combat/enemies.js";
import { CombatMapIndex } from "../src/core/combat/index.js";
import type { CombatMapData } from "../src/core/combat/combat.js";

const WORDS = ["FALLAX", "VILIS", "INOPIA", "MALUM", "AVIDUS", "INFAMA", "IGNAVUS", "VERAMOCOR"];
const DECEIT = 33; // idx 32 en las tablas de coordenada
const DOOM = 40; // idx 39; entrada emboscada por el Shadowlord
const DECEIT_AT = { x: 240, y: 73 };
const DOOM_AT = { x: 128, y: 128 };
const DUNGEON_TILE = 0x18; // ENTERABLE_TILES → "Enter dungeon"
const SHADOWLORD_DEF = 0x2f; // 47 = 'SHADOW LORD'

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

const combatResources: CombatResources = {
  combatMaps,
  enemyDefs: buildEnemyDefs(data, additionalFlags),
  attackValues: [],
  attackRangeValues: [],
  defenseValues: data.defenseValues,
};

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Elwood",
    gender: 0x0b,
    class: "A",
    status: "G",
    strength: 20,
    dexterity: 20,
    intelligence: 20,
    currentMp: 10,
    currentHp: 50,
    maxHp: 60,
    exp: 0,
    level: 2,
    monthsAtInn: 0,
    helmet: 0xff,
    armor: 0xff,
    weapon: 0xff,
    shield: 0xff,
    ring: 0xff,
    amulet: 0xff,
    partyStatus: 0,
    ...over,
  };
}

/** Flags de mundo: la Palabra de ambas mazmorras ya se gritó (sello abierto). */
function baseQuestFlags(): Record<string, boolean> {
  return { [wordSpokenFlag(DECEIT)]: true, [wordSpokenFlag(DOOM)]: true };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar(), makeChar({ name: "Iolo" })],
    partySize: 2,
    activeCharacter: 0,
    food: 100,
    karma: 50,
    time: { year: 139, month: 4, day: 10, hour: 8, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0xff, x: DOOM_AT.x, y: DOOM_AT.y },
    transport: "foot",
    transportTile: 0x1c,
    questFlags: baseQuestFlags(),
    prevHour: 8,
  };
  return { ...base, ...over } as GameState;
}

function makeWorld(): WorldData {
  const mk = (): number[][] =>
    Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  const overworld = mk();
  const underworld = mk();
  for (const m of [overworld, underworld]) {
    m[DECEIT_AT.y]![DECEIT_AT.x] = DUNGEON_TILE;
    m[DOOM_AT.y]![DOOM_AT.x] = DUNGEON_TILE;
  }
  return { overworld, underworld, smallMaps: new Map() };
}

function makeGameData(): GameData {
  const locationsX = Array.from({ length: 40 }, () => 200);
  const locationsY = Array.from({ length: 40 }, () => 200);
  locationsX[32] = DECEIT_AT.x;
  locationsY[32] = DECEIT_AT.y;
  locationsX[39] = DOOM_AT.x;
  locationsY[39] = DOOM_AT.y;
  // locationNames POBLADO a propósito (antes iba `[]`): con el array vacío
  // `locationNameBanner` sale por su `if (!name) return` y NO emite banner para NINGUNA
  // mazmorra (control degenerado). OJO a la asimetría (#234, medida en #233): poblarlo NO
  // hace discriminante a la aserción NEGATIVA de D9 — esa pasa igual con el array vacío,
  // por vacuidad. Todo el valor probatorio del relleno vive en el CONTROL POSITIVO de
  // Deceit de abajo: vaciar locationNames pone en rojo exactamente ESE caso y solo ese
  // (la pareja negativa+positiva es la que mide; la negativa sola no). Índice EMPAQUETADO
  // del extractor: ids 1-13 → id-1, ids ≥19 → id-6 (tabla DS 0x1e3a); Deceit 33 → 27,
  // Doom 40 → 34.
  const locationNames = Array.from({ length: 35 }, (_, i) => `LOC${i}`);
  locationNames[27] = "DECEIT";
  locationNames[34] = "DOOM";
  return { locationsX, locationsY, locationNames, wordsOfPower: WORDS };
}

function makeDungeon(location: number, name: string): DungeonData {
  const floors = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ type: 0, sub: 0 }))),
  );
  floors[0]![1]![1] = { type: 1, sub: 0 };
  return { location, name, floors };
}

function makeGame(s: GameState = makeState()): Game {
  const systems: GameSystems = {
    dungeons: [makeDungeon(DECEIT, "Deceit"), makeDungeon(DOOM, "Doom")],
    combatResources,
  };
  return new Game({} as ExtractedInitialState, makeWorld(), makeGameData(), s, systems);
}

const texts = (ev: { kind: string; text?: string }[]): string[] =>
  ev.filter((e) => e.kind === "message").map((e) => e.text ?? "");

/** questFlags con los 3 Shadowlords muertos (AND de locs con bit7 → sin emboscada). */
function allShadowlordsDead(): Record<string, boolean> {
  const f = baseQuestFlags();
  for (const k of SHADOWLORDS) f[shadowlordDeadFlag(k)] = true;
  return f;
}

describe("emboscada de Doom — dispara con Shadowlord vivo (0x7d8-0x812)", () => {
  it("(E)nter sobre Doom con un Shadowlord vivo: 'Attacked at entrance!' + combate, NO desciende", () => {
    const game = makeGame();
    const ev = game.enter();
    const msgs = texts(ev);
    expect(msgs).toContain("Enter dungeon"); // eco del comando (ENTER_LINES)
    expect(msgs).toContain("\nAttacked at entrance!\n"); // DS 0x2a2f
    expect(game.combat).not.toBeNull(); // combate montado (0xdf80)
    expect(game.dungeonState).toBeNull(); // NO se cargó la mazmorra (guarda de Doom)
    expect(ev.some((e) => e.kind === "combat-started")).toBe(true);
  });

  it("el enemigo es un Shadow Lord (def 47) en la arena Psychedelic (ShadowlordBoundary)", () => {
    const game = makeGame();
    game.enter();
    const enemy = game.combat?.combatants.find((c) => c.kind === "enemy");
    expect(enemy?.enemyDef?.index).toBe(SHADOWLORD_DEF);
    // `mapTiles` es ahora una COPIA mutable (los triggers de sala la mutan); comparamos
    // CONTENIDO, no identidad — sigue probando que la arena es Psychedelic, no el terreno.
    expect(game.combat?.mapTiles).toEqual(combatMaps[CombatMapIndex.Psychedelic]!.tiles);
  });

  it("emite el grupo 'SHADOW LORD' y el banner '*** CONFLICT ***'", () => {
    const game = makeGame();
    const msgs = texts(game.enter());
    // el nombre de grupo va centrado en la consola ancho-16 (padding envolvente)
    expect(msgs.some((m) => m.includes("SHADOW LORD"))).toBe(true);
    expect(msgs).toContain("*** CONFLICT ***\n");
  });
});

describe("emboscada de Doom — casos SIN emboscada", () => {
  it("con los 3 Shadowlords muertos: descenso normal (dungeonState), sin emboscada ni combate", () => {
    const game = makeGame(makeState({ questFlags: allShadowlordsDead() }));
    const ev = game.enter();
    const msgs = texts(ev);
    expect(msgs).not.toContain("\nAttacked at entrance!\n");
    expect(game.combat).toBeNull();
    expect(game.dungeonState).not.toBeNull();
    expect(game.dungeonState!.pos).toMatchObject({ dungeon: DOOM, floor: 0 }); // Doom entra por la cima
  });

  // ★ D9 — DOOM NO IMPRIME BANNER DE NOMBRE, y no por el estado de los Shadowlords.
  // El emisor del banner (MAINOUT 0x816: `\n\n` DS 0x2a47 + 0xFC + nombre + 0xFB) sólo se
  // alcanza por `07dc: jne 0x816`, o sea SÓLO cuando `07d8: cmp [bp-2],0x27` NO casa. Con
  // Doom el flujo se va a 0x7de-0x812 y de ahí sale por «Attacked at entrance!» + emboscada
  // o, con el AND de los tres g_shadowlord_locs ≥ 0x80, por `07f4: jae 0x837` al `\n` final.
  // En ninguna de las dos ramas se imprime el nombre.
  it("★ D9 con los 3 Shadowlords muertos: NO imprime el banner «DOOM» (0x07dc `jne 0x816`)", () => {
    const game = makeGame(makeState({ questFlags: allShadowlordsDead() }));
    const msgs = texts(game.enter());
    expect(msgs.some((m) => m.includes("DOOM"))).toBe(false);
    expect(game.dungeonState).not.toBeNull(); // pero SÍ desciende
  });

  it("★ D9 CONTROL: otra mazmorra (Deceit) SÍ imprime su banner — el gate es exclusivo de Doom", () => {
    // CONTROL POSITIVO del mismo emisor: si el fix hubiera silenciado el banner en general
    // en vez de sólo en Doom, este caso caería. Deceit llega a 0x816 por el `jne`.
    const game = makeGame(
      makeState({
        position: { location: 0, floor: 0xff, x: DECEIT_AT.x, y: DECEIT_AT.y },
        questFlags: allShadowlordsDead(),
      }),
    );
    const msgs = texts(game.enter());
    expect(msgs.some((m) => m.includes("DECEIT"))).toBe(true);
  });

  it("otra mazmorra (Deceit) con Shadowlord vivo NO embosca (check exclusivo de Doom, 0x7d8)", () => {
    const game = makeGame(
      makeState({ position: { location: 0, floor: 0xff, x: DECEIT_AT.x, y: DECEIT_AT.y } }),
    );
    const ev = game.enter();
    expect(texts(ev)).not.toContain("\nAttacked at entrance!\n");
    expect(game.combat).toBeNull();
    expect(game.dungeonState).not.toBeNull();
    expect(game.dungeonState!.pos.dungeon).toBe(DECEIT);
  });
});
