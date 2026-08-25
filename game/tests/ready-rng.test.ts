/**
 * F1.6 — Ready/equip cableado al STREAM VIVO.
 *
 * El único RNG del comando (R)eady es el "Ring vanishes!" 1/16 (ZSTATS
 * try_equip_or_unequip 0x0e01..0x0e15: `if item ∈ {0x2a,0x2c} then rand(0,15)==0`).
 * Antes de F1.6 `main.ts` invocaba `equipItem` SIN pasar `randRange`, así que el
 * roll usaba el valor fijo 1 y el anillo NUNCA se desvanecía en juego. `game.readyItem`
 * enruta ese rand por `this.rand` (el liveRng compartido con todo el turno).
 *
 * Los "esperados" NO se observan: se DERIVAN corriendo una segunda `OriginalRng`
 * sembrada idéntica y consultando `next(0,15)` en el mismo punto del flujo — así
 * el test fija el ORDEN y el NÚMERO exacto de tiradas, no una fotografía.
 *
 * Cita del flujo (re/notes/zstats.md §Ready, re/disasm/ZSTATS.OVL.asm):
 *   0x0e01 cmp bx,0x2a · 0x0e06 cmp bx,0x2c · 0x0e0b jmp (ni uno → SIN rand)
 *   0x0e15 call rand_range(0,15) · 0x0e18 or ax,ax / je → vanish (return 1)
 * El rand se tira DESPUÉS de colocar el item (0x0df2), sólo en un equip exitoso de
 * un anillo 0x2a/0x2c; jamás en toggle-off, equip fallido, u otros ítems.
 */
import { describe, expect, it } from "vitest";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import type { WorldData } from "../src/core/world/map.js";
import { OriginalRng } from "../src/core/rng-original.js";

const RING_INVIS = 0x2a; //  42 — anillo, se desvanece 1/16
const RING_VANISH_2 = 0x2c; //  44 — el otro anillo del set de vanish
const RING_NO_VANISH = 0x2b; //  43 — tipo anillo, pero FUERA del set → no tira
const HELMET_0 = 0x00; //   0 — tipo casco (0x80) → no tira

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Avatar",
    gender: 0x0b,
    class: "A",
    status: "G",
    strength: 30,
    dexterity: 20,
    intelligence: 20,
    currentMp: 10,
    currentHp: 50,
    maxHp: 60,
    exp: 0,
    level: 3,
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

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar()],
    partySize: 1,
    activeCharacter: 0,
    food: 100,
    time: { year: 139, month: 4, day: 7, hour: 2, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot",
    torchTurns: 0,
    torches: 2,
    prevHour: 2,
    equipmentQuantities: new Array(48).fill(0),
  };
  return { ...base, ...over } as GameState;
}

function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return { overworld, underworld: overworld, smallMaps: new Map() };
}

const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const combatResources: CombatResources = {
  combatMaps: [],
  enemyDefs: [],
  attackValues: [],
  attackRangeValues: [],
  defenseValues: [],
};

function makeGame(s: GameState = makeState()): Game {
  return new Game({} as ExtractedInitialState, makeWorld(), gameData, s, { combatResources });
}

/** Deja el anillo `id` disponible y el slot libre para forzar un equip exitoso. */
function armReady(game: Game, id: number): void {
  game.state.characters[0]!.ring = 0xff;
  game.state.equipmentQuantities[id] = 1;
}

describe("Ready-RNG (F1.6) — Ring vanishes! 1/16 por el stream vivo", () => {
  it("la secuencia de vanish CALCA next(0,15)==0 y consume 1 rand por equip exitoso", () => {
    const seed = 0x1234;
    const N = 64;
    const game = makeGame();
    game.reseed(seed);
    const ref = new OriginalRng(seed); // derivación paralela, mismo punto del flujo

    const got: boolean[] = [];
    const exp: boolean[] = [];
    for (let i = 0; i < N; i++) {
      armReady(game, RING_INVIS); // cada intento = equip fresco → siempre tira
      const r = game.readyItem(0, RING_INVIS);
      got.push(r.vanished === true);
      exp.push(ref.next(0, 15) === 0);
    }

    expect(got).toEqual(exp);
    // El stream vivo quedó EXACTAMENTE donde el de referencia → N tiradas, ni una más.
    expect(game.liveSeed()).toBe(ref.getSeed());
    // Prueba de no-trivialidad: en 64 intentos (~4 esperados) hubo al menos un vanish.
    expect(exp.some(Boolean)).toBe(true);
    // Y no fueron TODOS vanish (1/16, no 1/1).
    expect(exp.every(Boolean)).toBe(false);
  });

  it("el otro anillo del set (0x2c) también tira, con la MISMA secuencia derivada", () => {
    const seed = 0x0abc;
    const game = makeGame();
    game.reseed(seed);
    const ref = new OriginalRng(seed);
    for (let i = 0; i < 32; i++) {
      armReady(game, RING_VANISH_2);
      const r = game.readyItem(0, RING_VANISH_2);
      expect(r.vanished === true).toBe(ref.next(0, 15) === 0);
    }
    expect(game.liveSeed()).toBe(ref.getSeed());
  });

  it("un anillo FUERA del set {0x2a,0x2c} (0x2b) equipa pero NO tira el rand", () => {
    const game = makeGame();
    game.reseed(0x1234);
    const before = game.liveSeed();
    armReady(game, RING_NO_VANISH);
    const r = game.readyItem(0, RING_NO_VANISH);
    expect(r.ok).toBe(true);
    expect(r.vanished).toBeFalsy();
    expect(game.state.characters[0]!.ring).toBe(RING_NO_VANISH); // sigue puesto
    expect(game.liveSeed()).toBe(before); // stream intacto
  });

  it("un ítem no-anillo (casco) NO tira el rand", () => {
    const game = makeGame();
    game.reseed(0x1234);
    const before = game.liveSeed();
    game.state.equipmentQuantities[HELMET_0] = 1;
    const r = game.readyItem(0, HELMET_0);
    expect(r.ok).toBe(true);
    expect(game.liveSeed()).toBe(before);
  });

  it("desequipar un anillo de vanish (toggle-off) NO tira el rand", () => {
    const game = makeGame();
    game.reseed(0x77);
    game.state.characters[0]!.ring = RING_INVIS; // ya puesto
    const before = game.liveSeed();
    const r = game.readyItem(0, RING_INVIS); // mismo id → toggle-off
    expect(r.removed).toBe(true);
    expect(game.liveSeed()).toBe(before);
  });

  it("un equip FALLIDO (slot de anillo ocupado) NO tira el rand", () => {
    const game = makeGame();
    game.reseed(0x55);
    game.state.characters[0]!.ring = RING_NO_VANISH; // otro anillo ya puesto
    game.state.equipmentQuantities[RING_INVIS] = 1;
    const before = game.liveSeed();
    const r = game.readyItem(0, RING_INVIS);
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Only one magic ring may be worn at a time!");
    expect(game.liveSeed()).toBe(before);
  });

  it("Ready es ACCIÓN LIBRE: no avanza reloj ni turnos (ZSTATS no toca g_unk_24e6)", () => {
    const game = makeGame();
    game.reseed(0x1);
    const time0 = { ...game.state.time };
    const turns0 = game.state.turnsSinceStart;
    armReady(game, RING_INVIS);
    game.readyItem(0, RING_INVIS);
    expect(game.state.time).toEqual(time0);
    expect(game.state.turnsSinceStart).toBe(turns0);
  });
});
