/**
 * F1.7-T4 · Blackthorn MERMA de la Falsedad viva (pieza E). SHOPPES.OVL:0x019a
 * `post_purchase_gold_rand`, cableada al stream vivo del juego tras cada pago del
 * grupo SHOPPES.OVL.
 *
 * Mecanismo derivado del asm (re/notes/shops.md §0.3, re/notes/blackthorn.md §6,
 * SHOPPES.OVL:0x019a):
 *   019a: cmp byte [g_shadowlord_here_idx (0x5958)], 0
 *   019f: jne 0x1b4                       ; GATE PRIMERO: si != Falsedad → ret, SIN rand
 *   01a1..01ac: push &g_gold, push 1, push 0x40
 *   01ad: call 0x7e02 (rand_range 1..64 inclusive)   ; roll SÓLO con la Falsedad
 *   01b1: call 0x9cc4 = kernel 0x3f54 sub_word_floored(&g_gold, roll)  ; gold -= roll (suelo 0)
 *   01b4: ret
 * El binario la invoca tras CADA `sub [g_gold],ax` de SHOPPES.OVL — 5 sitios, todos
 * con el patrón `sub [gold];call 0x19a`: gremio (0x037b), reactivos (0x0623),
 * herrero-compra (0x0ab1), transporte/caballo (0x0951), curandero (0x14ed). NO en
 * la venta (entrada de oro) ni en SHOPPES2 (taberna/astillero) / SHOPPES3 (posada),
 * cuyos `sub [gold]` van seguidos de kernel 0x9dfa [= CS 0x7fda → SHOPPES.OVL:0x019a], no de la merma. `g_shadowlord_
 * here_idx==0` = la Falsedad (Shadowlord 0) reina en la ciudad (TOWN 0x02b6 recorre
 * g_shadowlord_locs vs g_location).
 *
 * Aquí se verifica el CABLEADO: `game.shopPostPurchaseDrain()` tira exactamente 1
 * rand(1,64) del stream vivo (this.rand → liveRng) SÓLO con la Falsedad presente,
 * merma el oro con suelo 0, y NO avanza la semilla cuando la Falsedad no está
 * (gate antes del rand). El motor puro (postPurchaseDrain / postPurchaseGoldDrain /
 * shadowlordPresentIndex) tiene su cobertura sin RNG en shops.test.ts / blackthorn.test.ts.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { OriginalRng } from "../src/core/rng-original.js";
import { buyEquipment } from "../src/core/shops/shops.js";

const TOWN = 6; // Trinsic (una ciudad con herrero, para el flujo de compra)

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test",
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

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    version: 1,
    characters: [makeChar({ name: "Avatar" }), makeChar({ name: "Iolo" })],
    partySize: 2,
    activeCharacter: 0,
    food: 100,
    gold: 100,
    keys: 5,
    gems: 3,
    torches: 2,
    equipmentQuantities: Array.from({ length: 48 }, () => 0),
    reagentQuantities: Array.from({ length: 8 }, () => 0),
    karma: 40,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: TOWN, floor: 0, x: 5, y: 5 },
    transport: "foot",
    torchTurns: 3,
    prevHour: 8,
    npcDead: Array.from({ length: 32 }, () => [] as boolean[]),
    npcMet: Array.from({ length: 32 }, () => [] as boolean[]),
  };
  return { ...base, ...over } as GameState;
}

function makeLocation(id: number): SmallMapLocation {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  return { id, name: `Loc${id}`, floors: [{ z: 0, tiles }, { z: 1, tiles }, { z: 2, tiles }] };
}

function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return { overworld, underworld: overworld, smallMaps: new Map([[TOWN, makeLocation(TOWN)]]) };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 100),
  locationsY: Array.from({ length: 32 }, () => 100),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

function makeGame(s: GameState): Game {
  return new Game({} as ExtractedInitialState, makeWorld(), gameData, s);
}

describe("F1.7-T4 — merma de la Falsedad viva (SHOPPES 0x019a, cableado al stream)", () => {
  it("con la Falsedad en la ciudad: 1 rand(1,64) del stream vivo y merma el oro", () => {
    const game = makeGame(
      makeState({ gold: 100, position: { location: TOWN, floor: 0, x: 5, y: 5 }, shadowlordLocs: [TOWN, 3, 7] }),
    );
    game.reseed(0x1234);
    // Referencia: la misma semilla debe producir el mismo rand(1,64) y dejar la
    // semilla exactamente una tirada más adelante.
    const ref = new OriginalRng(0x1234);
    const expectedRoll = ref.next(1, 64);

    const drained = game.shopPostPurchaseDrain();
    expect(drained).toBe(expectedRoll);
    expect(game.state.gold).toBe(100 - expectedRoll);
    expect(game.liveSeed()).toBe(ref.getSeed()); // avanzó EXACTAMENTE 1 rand
  });

  it("sin la Falsedad (otro Shadowlord): 0 merma y la semilla del stream NO avanza", () => {
    const game = makeGame(
      makeState({ gold: 100, position: { location: TOWN, floor: 0, x: 5, y: 5 }, shadowlordLocs: [2, TOWN, 7] }),
    );
    game.reseed(0x1234);
    const before = game.liveSeed();
    expect(game.shopPostPurchaseDrain()).toBe(0);
    expect(game.state.gold).toBe(100);
    expect(game.liveSeed()).toBe(before); // gate antes del rand → 0 rands consumidos
  });

  it("sin Shadowlords situados (shadowlordLocs sin fijar): no-op, sin consumir rand", () => {
    const game = makeGame(makeState({ gold: 100 }));
    game.reseed(0x99);
    const before = game.liveSeed();
    expect(game.shopPostPurchaseDrain()).toBe(0);
    expect(game.state.gold).toBe(100);
    expect(game.liveSeed()).toBe(before);
  });

  it("flujo completo: compra (herrero) + merma resta precio + roll del mismo stream", () => {
    const game = makeGame(
      makeState({ gold: 200, position: { location: TOWN, floor: 0, x: 5, y: 5 }, shadowlordLocs: [TOWN, 3, 7] }),
    );
    game.reseed(7);
    const ref = new OriginalRng(7);

    const price = 116;
    const r = buyEquipment(game.state, 26, price); // buyEquipment NO consume rand
    expect(r.ok).toBe(true);
    expect(game.state.gold).toBe(200 - price);

    const expectedRoll = ref.next(1, 64);
    const drained = game.shopPostPurchaseDrain();
    expect(drained).toBe(expectedRoll);
    expect(game.state.gold).toBe(200 - price - expectedRoll);
    expect(game.liveSeed()).toBe(ref.getSeed());
  });

  it("suelo 0: la merma no deja el oro negativo aunque el roll lo supere", () => {
    // Repite hasta forzar un roll >= gold (con gold=1 basta cualquier roll>=1).
    const game = makeGame(
      makeState({ gold: 1, position: { location: TOWN, floor: 0, x: 5, y: 5 }, shadowlordLocs: [TOWN, 3, 7] }),
    );
    game.reseed(0x2222);
    const drained = game.shopPostPurchaseDrain();
    expect(drained).toBe(1); // sólo se pudo mermar el oro disponible
    expect(game.state.gold).toBe(0);
  });
});
