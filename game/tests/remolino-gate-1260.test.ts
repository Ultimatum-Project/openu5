/**
 * GATE 0x1260 DEL TURNO DEL REMOLINO — careo #343 (carril careo-fragata).
 *
 * MAINOUT `monster_hits_special_tile` 0x1248: tras reconocer al remolino
 * (0x125A `and al,0xfc / cmp al,0xec`), 0x1260 compara `g_transport_tile` con
 * 0x1C EXACTO (`cmp byte [g_transport_tile],0x1c / jne 0x126e`):
 *   - t == 0x1C → `call damage_ship` (0x1267) y FUERA (0x126A `jmp 0x1313`):
 *     el actor NO se borra (0x1277/0x127B no corren), NO hay "WHIRLPOOL!"
 *     (0x127F no corre), NO hay teleport (0x12B2-0x12C0 no corren). Y
 *     `damage_ship` gatea `(t&0xF8)==0x20` en 0x10A4 (sólo fragata) → con
 *     0x1C es un no-op SIN tirada (el rand(1,30) de 0x10B8 queda detrás del
 *     gate). Conducta neta: el contacto no tiene efecto y el remolino sigue.
 *   - t != 0x1C (fragata, esquife, alfombra 0x14/0x15, incluso 0x1D) → la vía
 *     completa: borra actor, "WHIRLPOOL!", damage_ship, g_floor=0xFF,
 *     party=(0x22,0x12).
 *
 * Testigo vivo del gate: re/notes/testigo-remolino-343.md §2 (t=0x1C medido
 * cruzando agua profunda; contacto = sin teleport). El port succionaba
 * INCONDICIONALMENTE (game.ts outdoorWorldTurn) — con t=0x1C el remolino
 * arrastraba al Underworld a una party A PIE en la orilla, imposible en 1988.
 *
 * Esperados EN CRUDO del binario (0x1C · 0xFF · 0x22 · 0x12 · "\nWHIRLPOOL!\n"),
 * no derivados del sujeto.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import type { OverworldEnemy } from "../src/core/world/enemies.js";
import type { RandFn } from "../src/core/world/survival.js";

// --- fixture mínimo (mismo idioma que remolino-282-ocupacion.test.ts) --------
function makeChar(): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20, currentMp: 10,
    currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  } as CharacterState;
}
function makeState(over: Partial<GameState> = {}): GameState {
  return {
    version: 1,
    characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 100, magicCarpets: 0,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0, position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 12, wind: 0,
    specialItems: { spyglass: false, hmsCape: false, sextant: false, pocketWatch: false, blackBadge: false, woodenBox: false },
    ...over,
  } as GameState;
}
/**
 * Mundo de HIERBA (tile 5) con UNA casilla de agua profunda (tile 1) en
 * (100,99): el remolino queda CLAVADO ahí (su deriva no puede pisar hierba) y
 * todo turno chase contacta con la party de (100,100). La geometría y el
 * stream de rand son IDÉNTICOS en las tres pruebas: el control positivo
 * acota la ventana (si con fragata el contacto reubica en K pases, con 0x1C
 * el mismo contacto ocurrió en los mismos K pases).
 */
function shoreWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array<number>(256).fill(5));
  overworld[99]![100] = 1; // fila y=99, columna x=100
  return { overworld, underworld: overworld, smallMaps: new Map() };
}
const gameData: GameData = { locationsX: [], locationNames: [], locationsY: [] };
/**
 * `combatResources` presente: sin el, `outdoorWorldTurn` corta ANTES del tick
 * de enemigos (game.ts `!this.combatResources → return []`) y el remolino no
 * jugaria jamas — el test moriria en un falso verde de ausencia. Vacio basta:
 * el rng parcheado impide todo spawn (roll=30 nunca < threshold).
 */
const emptyResources: CombatResources = {
  combatMaps: [], enemyDefs: [], attackValues: [], attackRangeValues: [], defenseValues: [],
};
function makeGame(s: GameState): Game {
  const g = new Game({} as ExtractedInitialState, shoreWorld(), gameData, s, {
    combatResources: emptyResources,
  });
  // rand determinista = hi (precedente: camp-guard-walk.test.ts patchRng):
  //   maybeChangeWind rand(0,63)=63 → sin cambio de viento;
  //   rollSpawnGate rand(1,30)=30 → sin spawn (threshold>30 nunca);
  //   modo del remolino rand(0,1)=1 → CHASE en todo turno ON (fase alterna).
  const fixed: RandFn = (_lo, hi) => hi;
  (g as unknown as { liveRng: { next: RandFn } }).liveRng.next = fixed;
  return g;
}
function whirlpoolAt(x: number, y: number): OverworldEnemy {
  return { defIndex: 43, tile: 0x1ec, water: true, x, y, slot: 1, phase: 0 } as OverworldEnemy;
}

const K = 8; // pases; el control positivo DEBE reubicar dentro de esta ventana

function runPasses(g: Game, k = K): { texts: string[]; relocatedAt: number | null } {
  const texts: string[] = [];
  let relocatedAt: number | null = null;
  for (let i = 0; i < k; i++) {
    for (const e of g.pass()) {
      if ("text" in e && typeof e.text === "string") texts.push(e.text);
    }
    if (relocatedAt === null && g.state.position.floor === 0xff) relocatedAt = i;
  }
  return { texts, relocatedAt };
}

describe("gate 0x1260 — contacto del remolino segun g_transport_tile", () => {
  it("CONTROL POSITIVO (fragata 0x24): el contacto reubica dentro de la ventana K", () => {
    const st = makeState({ transport: "ship", transportTile: 0x24, sailDir: 0, shipHull: 99 });
    const g = makeGame(st);
    g.overworldEnemies.enemies.push(whirlpoolAt(100, 99));

    const r = runPasses(g);

    expect(r.relocatedAt).not.toBeNull(); // acota la ventana para el caso 0x1C
    expect(st.position.floor).toBe(0xff); // literales 0x12B2-0x12C0
    expect(st.position.x).toBe(0x22);
    expect(st.position.y).toBe(0x12);
    expect(r.texts).toContain("\nWHIRLPOOL!\n"); // DS 0x6b04 (0x127F)
    expect(g.overworldEnemies.enemies).toHaveLength(0); // 0x1277/0x127B borran al actor
    // damage_ship 0x12AF: rand(1,30) al casco (con el rng parcheado, 30) — el
    // testigo #343 midio 99→75/86→61; el port succionaba con el casco INTACTO.
    expect(st.shipHull).toBe(69); // 99 − 30 (0x10CB)
  });

  it("damage_ship 0x12AF con dano >= casco: la nave se hunde (0x10D6) Y el teleport corre igual", () => {
    const st = makeState({
      transport: "ship", transportTile: 0x24, sailDir: 0, shipHull: 10, shipSkiffs: 1,
    });
    const g = makeGame(st);
    g.overworldEnemies.enemies.push(whirlpoolAt(100, 99));

    const r = runPasses(g);

    expect(r.relocatedAt).not.toBeNull(); // el teleport de 0x12B2 corre tras el hundimiento
    expect(st.position.floor).toBe(0xff);
    expect(r.texts).toContain("Ship sunk!"); // 0x10D6
    expect(st.transport).toBe("skiff"); // con skiffs a bordo, conversion 0x28+facing
    expect(st.shipHull).toBe(10); // el casco NO se toca al hundir (transport.md §7E)
  });

  it("t == 0x1C: el contacto NO reubica, NO habla y NO borra al remolino (0x1267→0x126A)", () => {
    const st = makeState({ transport: "foot", transportTile: 0x1c });
    const g = makeGame(st);
    g.overworldEnemies.enemies.push(whirlpoolAt(100, 99));

    const r = runPasses(g);

    // La MISMA ventana K en la que el control reubicó: aquí no pasa nada.
    expect(r.relocatedAt).toBeNull();
    expect({ f: st.position.floor, x: st.position.x, y: st.position.y })
      .toEqual({ f: 0, x: 100, y: 100 });
    expect(r.texts).not.toContain("\nWHIRLPOOL!\n");
    expect(g.overworldEnemies.enemies).toHaveLength(1); // el remolino sigue vivo
    // Y tampoco arranca combate (el turno del remolino jamas es combate).
    expect(r.texts.join("")).not.toContain("CONFLICT");
  });

  it("el compare es EXACTO a 0x1C: con t=0x1D la via completa corre (jne 0x126e)", () => {
    // 0x1D (a pie INVISIBLE como tile de render) NO pasa el gate: el binario
    // compara el byte 0x1C literal, no la clase (&0xFC seria 0x1C para ambos).
    const st = makeState({ transport: "foot", transportTile: 0x1d });
    const g = makeGame(st);
    g.overworldEnemies.enemies.push(whirlpoolAt(100, 99));

    const r = runPasses(g);

    expect(r.relocatedAt).not.toBeNull();
    expect(st.position.floor).toBe(0xff);
    expect(r.texts).toContain("\nWHIRLPOOL!\n");
  });
});
