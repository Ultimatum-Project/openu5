/**
 * INVISIBILIDAD DEL PARTY — el tile de RENDER `0x1d` (#12).
 *
 * Reporte del usuario jugando: «si se ve invisibilidad». El clon marcaba el flag y
 * NO cambiaba nada de lo que se dibuja, así que el PJ invisible seguía saliendo con
 * el sprite de su clase.
 *
 * Lo que hace el binario (MEDIDO, ver re/notes/invisible-render-0x1d.md):
 *   - los TRES caminos de invisibilidad del PARTY escriben el campo `+1` (tile de
 *     RENDER) de la tabla de actores de mundo `0x5C5A` con el byte `0x1d`:
 *       Sanct Lor      `CAST.OVL:0x0b12`
 *       Ring 0x2A      `ULTIMA.EXE:0x67d1`
 *       poción negra   `CAST.OVL:0x150d` (+ cola compartida `0x1510` → también `+0`)
 *   - el byte va al BANCO ALTO al pintarse (`FONT.OVL:0x02e5 add ah,1`) ⇒ sprite
 *     `0x11d` = la silueta azul hueca del atlas.
 *   - el ENEMIGO invisible es OTRO camino: `COMSUBS.OVL:0x0236` escribe `+1 = 0`
 *     (el mismo valor del borrado de la tabla) ⇒ no se pinta. Ese filtro del clon
 *     se queda; este fichero lo cubre como CONTROL.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import type { CharacterState } from "../src/core/state.js";
import {
  buildEnemyDefs,
  type EnemyDef,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../src/core/combat/enemies.js";
import { Combat, type CombatMapData, type PartyCombatant } from "../src/core/combat/combat.js";
import { RING_INVIS } from "../src/core/equip.js";
import { TILE_INVISIBLE } from "../src/core/world/transport.js";
import type { CastEffect } from "../src/core/magic/cast.js";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import { CoreViewImpl } from "../src/skin/coreview.js";
import { VIEW_WINDOW } from "../src/skin/api.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");
const defs = (): EnemyDef[] => buildEnemyDefs(data, additionalFlags);
const freshState = (): GameState =>
  createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
const party = (state: GameState): PartyCombatant[] =>
  state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));

function makeCombat(state: GameState): Combat {
  return new Combat({
    map: combatMaps[0]!,
    entryDirection: "east",
    party: party(state),
    enemies: [{ def: defs()[12]!, count: 1 }],
    seed: 777,
    state,
    defenseValues: data.defenseValues,
  });
}

// --------------------------------------------------------------- escritores ---

describe("los tres caminos del PARTY escriben el tile de render 0x1d", () => {
  it("la constante es el byte del binario", () => {
    expect(TILE_INVISIBLE).toBe(0x1d);
  });

  it("Sanct Lor (36) pone invisible=true Y renderTile=0x1d (CAST:0x0b12 + 0x0b17)", () => {
    const state = freshState();
    const combat = makeCombat(state);
    // `playerCast` exige que el turno sea del PJ activo (`requirePlayerTurn`):
    // se fuerza la iniciativa igual que en combat-spells.test.ts.
    const cur = combat.combatants.find((c) => c.kind === "player")!;
    combat.combatants.forEach((c) => { c.counter = 300; });
    cur.counter = 1;
    expect(combat.currentUnit).toBe(cur);
    // `effectFor` (cast.ts:207, `case 36`) devuelve exactamente este descriptor;
    // aquí se inyecta directo para no arrastrar maná/reactivos al testigo.
    combat.playerCast({ kind: "invisibilitySelf" } as CastEffect, null);
    expect(cur.invisible).toBe(true);
    expect(cur.renderTile).toBe(0x1d); // ← sin la mitad del tile esto es undefined
  });

  it("el Ring of Invisibility (0x2A) pone renderTile=0x1d al montar la arena (0x67d1)", () => {
    const state = freshState();
    const first = state.characters.find((c) => c.partyStatus === 0) as CharacterState;
    first.ring = RING_INVIS;
    const combat = makeCombat(state);
    const withRing = combat.combatants.find((c) => c.kind === "player" && c.invisible)!;
    expect(withRing).toBeDefined();
    expect(withRing.renderTile).toBe(0x1d);
  });

  it("CONTROL: sin anillo ni conjuro, ningún PJ lleva renderTile (no se pinta de más)", () => {
    const combat = makeCombat(freshState());
    const players = combat.combatants.filter((c) => c.kind === "player");
    expect(players.length).toBeGreaterThan(0);
    expect(players.every((c) => c.renderTile === undefined)).toBe(true);
    expect(players.every((c) => !c.invisible)).toBe(true);
  });
});

// ------------------------------------------------------------------ pantalla ---

/**
 * Testigo de LO QUE SE PINTA: la ventana 11×11 que la piel recibe. Es la capa donde
 * el usuario vio el defecto, y la única que distingue «el flag está puesto» de «el
 * sprite cambió».
 */
describe("la ventana de combate pinta la silueta 0x11d, no el sprite de la clase", () => {
  const grassWorld = (): WorldData => {
    const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
    return { overworld, underworld: overworld, smallMaps: new Map() };
  };
  const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
  const combatResources: CombatResources = {
    combatMaps: [],
    enemyDefs: [],
    attackValues: [],
    attackRangeValues: [],
    defenseValues: [],
  };
  const chr = (over: Partial<CharacterState> = {}): CharacterState =>
    ({
      name: "T", gender: 0x0b, class: "A", status: "G",
      strength: 20, dexterity: 20, intelligence: 20,
      currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
      helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
      partyStatus: 0, ...over,
    }) as CharacterState;

  const cell = (x: number, y: number): number => y * VIEW_WINDOW + x;

  function windowWith(combatants: unknown[]): ArrayLike<number> {
    const state = {
      characters: [chr({ name: "Avatar", class: "A" })],
      partySize: 1, activeCharacter: 0, food: 100, gold: 0,
      time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
      turnsSinceStart: 0,
      position: { location: 0, floor: 0, x: 100, y: 100 },
      transport: "foot", torchTurns: 0, torches: 0, prevHour: 12,
    } as unknown as GameState;
    const game = new Game({} as ExtractedInitialState, grassWorld(), gameData, state, {
      combatResources,
    });
    (game as unknown as { combat: unknown }).combat = {
      mapTiles: [],
      combatants,
      lootTiles: () => [],
      get activeActor() {
        return null;
      },
    };
    return new CoreViewImpl(game).snapshot().window;
  }

  const AVATAR1 = 0x14c; // sprite de la clase 'A' (party_anim_build 0x6936)

  it("PJ invisible → 0x11d (0x1d + banco alto), NO su Avatar1", () => {
    const w = windowWith([
      {
        id: 1, kind: "player", charIdx: 0, x: 3, y: 4,
        status: "active", invisible: true, renderTile: 0x1d,
      },
    ]);
    expect(w[cell(3, 4)]).toBe(0x11d);
    expect(w[cell(3, 4)]).not.toBe(AVATAR1);
  });

  it("PJ visible → sigue siendo Avatar1 (el fix no repinta a quien no toca)", () => {
    const w = windowWith([
      { id: 1, kind: "player", charIdx: 0, x: 3, y: 4, status: "active", invisible: false },
    ]);
    expect(w[cell(3, 4)]).toBe(AVATAR1);
  });

  it("PJ polimorfiado (poción púrpura) → RATA 0x190, no la SILLA 0x90 del banco bajo", () => {
    // Mismo defecto de banco que la invisibilidad, en el camino que ya existía: el
    // byte 0x90 iba CRUDO a la ventana y el atlas 0x90 es una silla de madera.
    const w = windowWith([
      {
        id: 1, kind: "player", charIdx: 0, x: 2, y: 2,
        status: "active", invisible: false, renderTile: 0x90,
      },
    ]);
    expect(w[cell(2, 2)]).toBe(0x190);
    expect(w[cell(2, 2)]).not.toBe(0x90);
  });

  it("invisible + polimorfiado a la vez → manda la SILUETA, no la rata", () => {
    // Precedencia MEDIDA: el despertar/revivir (`ULTIMA.EXE:0x6800`, gate del pestillo
    // `0x08` en 0x6816) re-impone `+1 := 0x1d` desde el flag `0x10` (0x6841) y sólo copia
    // `+0`→`+1` (0x6856-0x685a) si el flag está BAJO. El flag es la verdad duradera de un
    // PJ, así que el clon lo hace mandar sobre el tile. Reserva declarada en la nota §3.
    const w = windowWith([
      {
        id: 1, kind: "player", charIdx: 0, x: 1, y: 1,
        status: "active", invisible: true, renderTile: 0x90,
      },
    ]);
    expect(w[cell(1, 1)]).toBe(0x11d);
    expect(w[cell(1, 1)]).not.toBe(0x190);
  });

  it("CONTROL enemigo: el invisible sigue SIN pintarse (COMSUBS:0x0236 escribe 0)", () => {
    const w = windowWith([
      {
        id: 2, kind: "enemy", x: 5, y: 5, status: "active",
        invisible: true, enemyDef: { tile: 0x150 },
      },
    ]);
    expect(w[cell(5, 5)]).not.toBe(0x150);
    expect(w[cell(5, 5)]).not.toBe(0x11d); // ni la silueta: su camino escribe 0, no 0x1d
  });
});
