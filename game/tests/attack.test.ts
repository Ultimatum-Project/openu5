/**
 * F1.8-T3 — Comando (A)ttack en el mapa. Dispatcher kernel 0x3216 → overworld
 * MAINOUT 0x06ec / pueblo TOWN 0x09e6 / mazmorra DUNGEON 0x1d4a.
 *
 * Fija la conducta del motor (`game.attack`):
 *  - OVERWORLD con enemigo errante adyacente → INICIA combate (0x778 → 0xdf80 =
 *    startCombat, con el fork del stream vivo). Sin objetivo → "Nothing to
 *    attack!" (str 0x2a10).
 *  - Convención de turno propia: el handler NO cobra el turno estándar (0x06f2
 *    fija [bp-2]=0 y nunca lo pone a 1) → el reloj no avanza por Attack; el
 *    tiempo lo gobierna el combate que arranca (≠ Camp/Pass).
 *  - PUEBLO: karma/guardias/combate-en-pueblo NO modelado → Clase C; `attack`
 *    responde "Nothing to attack!" sin fabricar el resto.
 *
 * El wiring tecla→método (pendingDirCommand "attack") vive en main.ts y lo
 * ejercita game/e2e/attack.spec.ts.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import {
  buildEnemyDefs,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../src/core/combat/enemies.js";
import type { CombatMapData } from "../src/core/combat/combat.js";
import type { WorldData } from "../src/core/world/map.js";
import { setLang, BASE_LANG } from "../src/i18n/index.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar({ name: "" }), makeChar({ name: "Iolo" })],
    partySize: 2, activeCharacter: 0, food: 100,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 0 },
    turnsSinceStart: 0, position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 8,
  };
  return { ...base, ...over } as GameState;
}

const TOWN_LOC = 2;

/**
 * Overworld 256×256 de tile `base` + un small map de pueblo (loc 2, 32×32 hierba)
 * con `townTile` opcional en (15,15) para probar el gate de agua en pueblo.
 */
function makeWorld(base = 5, townTile = 5): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array<number>(256).fill(base));
  const townTiles = Array.from({ length: 32 }, () => Array<number>(32).fill(5));
  townTiles[15]![15] = townTile;
  const smallMaps = new Map([
    [TOWN_LOC, { id: TOWN_LOC, name: "Test Town", floors: [{ z: 0, tiles: townTiles }] }],
  ]);
  return { overworld, underworld: overworld, smallMaps };
}

const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const combatResources: CombatResources = {
  combatMaps,
  enemyDefs: buildEnemyDefs(data, additionalFlags),
  attackValues: [],
  attackRangeValues: [],
  defenseValues: data.defenseValues,
};

function makeGame(s: GameState = makeState(), world: WorldData = makeWorld()): Game {
  const g = new Game({} as ExtractedInitialState, world, gameData, s, { combatResources });
  g.reseed(4242);
  return g;
}

const minutesOf = (g: Game): number => g.state.time.hour * 60 + g.state.time.minute;

describe("(A)ttack overworld — MAINOUT 0x06ec", () => {
  it("con enemigo errante adyacente en la dirección: INICIA combate", () => {
    const g = makeGame();
    // Enemigo (goblin, def 0) justo al ESTE de la party (100,100).
    g.overworldEnemies.enemies.push({ defIndex: 0, tile: 0x94, water: false, x: 101, y: 100 });
    expect(g.combat).toBeNull();
    const ev = g.attack("east");
    expect(ev.some((e) => e.kind === "combat-started")).toBe(true);
    expect(g.combat).not.toBeNull(); // el combate arrancó
    // El enemigo errante deja el mapa (pasa a ser combatiente).
    expect(g.overworldEnemies.enemies.some((e) => e.x === 101 && e.y === 100)).toBe(false);
    // PLAYER-INITIATED (lote D vía A): SIN pre-línea "Attacked!" ni el fabricado
    // "{name} attacks!" (el eco "Attack-<dir>" ya lo puso el comando) — PERO SÍ la
    // identificación de grupo (monsterNamesUpper[0]="WIZARDS") + "*** CONFLICT ***".
    const msgs = ev.filter((e) => e.kind === "message").map((e) => e.text ?? "");
    const joined = msgs.join(" ");
    expect(joined).not.toContain("Attacked!");
    expect(joined).not.toContain("attacks!");
    expect(joined).toContain("WIZARDS"); // grupo (def 0)
    expect(msgs).toContain("*** CONFLICT ***\n"); // DS 0xa438
  });

  it("enemy-initiated: secuencia 'Attacked!' → GRUPO (centrado) → '*** CONFLICT ***', NUNCA '{} attacks!'", () => {
    const g = makeGame();
    // Encuentro enemy-initiated: el errante alcanza al grupo (lote D vía B).
    const ev = g.startCombat({ slot: 0, defIndex: 0, tile: 0x94, water: false, x: 100, y: 100 });
    const msgs = ev.filter((e) => e.kind === "message").map((e) => e.text ?? "");
    // Orden fiel: pre-línea → grupo → CONFLICT (antes de combat-started).
    expect(msgs).toEqual(["Attacked!\n", "    WIZARDS\n", "*** CONFLICT ***\n"]); // (16−7)/2=4 esp.
    expect(msgs.join(" ")).not.toContain("attacks!"); // el fabricado se purgó
  });

  it("es: el banner de grupo usa el canon Upper de es.json RE-CENTRADO sobre la forma traducida", () => {
    // Cableado i18n del call-site del grupo (game.ts): monsterNamesUpper[0]="WIZARDS" →
    // t()="MAGOS" (es.json, Ruling A). El padding se recalcula sobre la forma YA traducida:
    // (16−5)/2=5 espacios (vs 4 en 'en' con "WIZARDS"). "Attacked!"/"*** CONFLICT ***" siguen
    // en inglés a nivel de EVENTO (los traduce el choke-point de pushConsole al render, no el
    // core) — sólo el grupo, ENVUELTO en padding, necesita traducirse en el core.
    try {
      setLang("es", { persist: false });
      const g = makeGame();
      const ev = g.startCombat({ slot: 0, defIndex: 0, tile: 0x94, water: false, x: 100, y: 100 });
      const msgs = ev.filter((e) => e.kind === "message").map((e) => e.text ?? "");
      expect(msgs).toEqual(["Attacked!\n", "     MAGOS\n", "*** CONFLICT ***\n"]); // (16−5)/2=5 esp.
    } finally {
      setLang(BASE_LANG, { persist: false });
    }
  });

  it("sin objetivo en esa dirección: 'Nothing to attack!' y NO arranca combate", () => {
    const g = makeGame();
    g.overworldEnemies.enemies.push({ defIndex: 0, tile: 0x94, water: false, x: 101, y: 100 });
    // Ataca al OESTE (99,100): ahí no hay enemigo (el enemigo está al este).
    const ev = g.attack("west");
    expect(ev.some((e) => e.kind === "message" && e.text === "Nothing to attack!\n")).toBe(true);
    expect(g.combat).toBeNull();
  });

  it("convención de turno propia: 'Nothing to attack!' NO avanza el reloj", () => {
    const g = makeGame();
    const before = minutesOf(g);
    const ev = g.attack("north");
    expect(ev.some((e) => e.kind === "message" && e.text === "Nothing to attack!\n")).toBe(true);
    // Attack no cobra el turno estándar (handler [bp-2]=0, sin g_unk_24e6).
    expect(minutesOf(g)).toBe(before);
  });
});

describe("(A)ttack pueblo — TOWN 0x09e6 (Clase C: combate/karma/guardias no modelado)", () => {
  it("en pueblo (tierra, a pie) responde 'Nothing to attack!' sin fabricar combate/karma", () => {
    const g = makeGame(makeState({ position: { location: TOWN_LOC, floor: 0, x: 15, y: 15 } }));
    const before = minutesOf(g);
    const ev = g.attack("east");
    expect(ev.some((e) => e.kind === "message" && e.text === "Nothing to attack!\n")).toBe(true);
    expect(g.combat).toBeNull();
    expect(minutesOf(g)).toBe(before);
  });
});

/**
 * Gate pre-getdir (MAINOUT 0x70d / TOWN 0xa08): sólo sobre AGUA (tile de la party
 * <4). Overworld → skiff/alfombra rechazan; fragata pasa. Pueblo → cualquier
 * transporte ≠ a pie rechaza. En tierra nunca rechaza (jae). Verificado byte a byte.
 */
describe("(A)ttack — gate 'On foot!' por vehículo/terreno (attackContext)", () => {
  it("overworld sobre AGUA en skiff (0x28) → 'On foot!' sin getdir ni combate", () => {
    const g = makeGame(
      makeState({ transport: "skiff", transportTile: 0x28, position: { location: 0, floor: 0, x: 100, y: 100 } }),
      makeWorld(1), // overworld todo agua (tile 1 < 4)
    );
    expect(g.attackContext().ok).toBe(false);
    const ev = g.attack("east");
    expect(ev.some((e) => e.kind === "message" && e.text === "On foot!\n")).toBe(true);
    expect(g.combat).toBeNull();
  });

  it("overworld sobre AGUA en alfombra (0x14) → 'On foot!'", () => {
    const g = makeGame(
      makeState({ transport: "carpet", transportTile: 0x14, position: { location: 0, floor: 0, x: 100, y: 100 } }),
      makeWorld(1),
    );
    expect(g.attackContext().ok).toBe(false);
    expect(g.attack("east").some((e) => e.text === "On foot!\n")).toBe(true);
  });

  it("overworld sobre AGUA en FRAGATA (0x20) → NO rechaza (pasa; sin enemigo → 'Nothing to attack!')", () => {
    const g = makeGame(
      makeState({ transport: "ship", transportTile: 0x20, position: { location: 0, floor: 0, x: 100, y: 100 } }),
      makeWorld(1),
    );
    expect(g.attackContext().ok).toBe(true); // la fragata no cae en las máscaras skiff/alfombra
    expect(g.attack("east").some((e) => e.text === "Nothing to attack!\n")).toBe(true);
  });

  it("overworld en TIERRA a pie → NO rechaza (el gate sólo mira agua)", () => {
    const g = makeGame(); // tile 5 (tierra), a pie
    expect(g.attackContext().ok).toBe(true);
  });

  it("pueblo sobre AGUA en skiff → 'On foot!' (cualquier no-a-pie)", () => {
    const g = makeGame(
      makeState({ transport: "skiff", transportTile: 0x28, position: { location: TOWN_LOC, floor: 0, x: 15, y: 15 } }),
      makeWorld(5, 1), // (15,15) del pueblo = agua (tile 1)
    );
    expect(g.attackContext().ok).toBe(false);
    expect(g.attack("east").some((e) => e.text === "On foot!\n")).toBe(true);
  });

  it("pueblo a CABALLO en TIERRA → NO rechaza (gate condicionado a agua; caballo no pisa agua)", () => {
    const g = makeGame(
      makeState({ transport: "horse", transportTile: 0x10, position: { location: TOWN_LOC, floor: 0, x: 15, y: 15 } }),
      makeWorld(5, 5), // (15,15) = tierra
    );
    // El caballo sobre tierra pasa el gate (cmp [bx],4 jae): sólo el vehículo SOBRE
    // AGUA rechaza. Confirma la derivación byte-exacta (no "cualquier no-a-pie").
    expect(g.attackContext().ok).toBe(true);
  });
});
