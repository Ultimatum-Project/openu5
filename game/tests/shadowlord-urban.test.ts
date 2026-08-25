/**
 * F1.10-T6 · Shadowlords urbanos — presencia en pueblos (spawn/anuncio/efectos).
 *
 * Reglas EXACTAS del binario (TOWN.OVL 0x11f0 tail; consumidores TALK.OVL); ver
 * re/notes/shadowlord-urban.md para las citas. Cubierto aquí:
 *  - anuncio "An air of <cualidad> doth surround thee..." (0x11b8) + caso Stonegate
 *    (los tres vivos, orden 2→1→0).
 *  - predicado de posesión (0x10f2): SIEMPRE consume 1 rand; elegible = presente ∧
 *    person-tile [0x40,0x74) ∧ rand(0,1)==0.
 *  - posesión (0x1156): 32 rand EXACTOS (uno por slot), sólo Astaroth/Nosfentor;
 *    Faulinei/ninguno = 0 rand.
 *  - integración de entrada: sprite físico + anuncio + posesión al entrar al pueblo.
 *  - talk a un poseído (0xFD/0xFE): frases hardcodeadas.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { OriginalRng } from "../src/core/rng-original.js";
import {
  announceText,
  isPersonType,
  possessGateRoll,
  shadowlordEntryAnnouncements,
  SHADOWLORD_SPRITE_X,
  SHADOWLORD_SPRITE_Y,
  SHADOWLORD_TILE,
  STONEGATE_LOCATION,
} from "../src/core/world/shadowlord-urban.js";

// SHADOWLORD_TILE de shadowlord-urban.ts == 0xFC (mismo tile que el ritual).
const SL_TILE = SHADOWLORD_TILE ?? 0xfc;

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Avatar", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    version: 1, characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 1000, keys: 0, gems: 0, torches: 2, karma: 50,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    prevHour: 8, turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 10, y: 10 },
    transport: "foot", torchTurns: 0, wind: 0, windDriftCtr: 0,
    questFlags: {}, journal: [], worldObjects: [], openDoors: [],
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    npcDead: [], npcMet: [],
    equipmentQuantities: new Array(48).fill(0),
    spellQuantities: new Array(48).fill(0),
    scrollQuantities: new Array(8).fill(0),
    potionQuantities: new Array(8).fill(0),
    reagentQuantities: new Array(8).fill(0),
  };
  return { ...base, ...over } as GameState;
}

function slot(over: Partial<NpcSlot> & { slot: number }): NpcSlot {
  return {
    aiTypes: [0, 0, 0], x: [0, 0, 0], y: [0, 0, 0], z: [0, 0, 0],
    times: [0, 0, 0, 0], type: 0, dialogNumber: 0, ...over,
  };
}

/** Un NPC-persona (type 0x48) en (x,y) con horario presente y diálogo normal. */
function person(s: number, x: number, y: number): NpcSlot {
  return slot({ slot: s, type: 0x48, x: [x, x, x], y: [y, y, y], z: [0, 0, 0], times: [8, 0, 0, 0], dialogNumber: 5 });
}

const TOWN = 2; // Britain (g_location 2, ciudad de la virtud → los SL vagan aquí)

function floorGrid(): number[][] {
  return Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
}

function world(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  const underworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  // Tile de overworld enterable en las coords de entrada (cmd_enter despacha por
  // tile): 0x14 "towne" en TOWN (10,11), 0x12 "keep" en Stonegate (10,13). Sin esto,
  // (E)nter caería en "Enter What?" (el original NO auto-entra al pisar).
  overworld[11]![10] = 0x14;
  overworld[13]![10] = 0x12;
  const smallMaps = new Map<number, SmallMapLocation>();
  smallMaps.set(TOWN, { id: TOWN, name: "Britain", floors: [{ z: 0, tiles: floorGrid() }] });
  smallMaps.set(STONEGATE_LOCATION, {
    id: STONEGATE_LOCATION, name: "Stonegate", floors: [{ z: 0, tiles: floorGrid() }],
  });
  return { overworld, underworld, smallMaps };
}

/** Un NPC daemon (type 144, NO person-tile), presente, en (x,y). */
function daemon(s: number, x: number, y: number): NpcSlot {
  return slot({ slot: s, type: 144, x: [x, x, x], y: [y, y, y], z: [0, 0, 0], times: [8, 0, 0, 0], dialogNumber: 0 });
}

const NPC_DATA: Record<number, NpcSlot[]> = {
  // slot #4 = persona (como TODAS las 8 ciudades de la virtud reales, type 0x50-0x70)
  // → el gate de tipo (bug slot4, TOWN 0x111f) pasa.
  [TOWN]: [
    slot({ slot: 0 }), person(1, 12, 12), person(2, 18, 18), person(3, 20, 20), person(4, 10, 10),
  ],
  [STONEGATE_LOCATION]: [slot({ slot: 0 })],
};

/** locationsX/Y: TOWN entra en (10,11), Stonegate en (10,13). */
const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, (_, i) =>
    i === TOWN - 1 ? 10 : i === STONEGATE_LOCATION - 1 ? 10 : 250),
  locationsY: Array.from({ length: 32 }, (_, i) =>
    i === TOWN - 1 ? 11 : i === STONEGATE_LOCATION - 1 ? 13 : 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

function makeGame(s: GameState): Game {
  const g = new Game({} as ExtractedInitialState, world(), gameData, s, {
    npcManager: new NpcManager(NPC_DATA),
  });
  return g;
}

// ---------------------------------------------------------------------------
// Puros: anuncio
// ---------------------------------------------------------------------------
describe("F1.10-T6 · anuncio (TOWN 0x11b8, strings DATA.OVL)", () => {
  it("announceText usa la cualidad exacta por índice", () => {
    expect(announceText(0)).toContain("falsehood");
    expect(announceText(1)).toContain("hatred");
    expect(announceText(2)).toContain("cowardice");
    expect(announceText(1)).toContain("An air of");
    expect(announceText(1)).toContain("doth surround thee...");
  });

  it("ciudad normal: sólo el SL presente (shadowlordLocs==location)", () => {
    const s = makeState({ position: { location: TOWN, floor: 0, x: 15, y: 15 }, shadowlordLocs: [99, TOWN, 99] });
    expect(shadowlordEntryAnnouncements(s)).toEqual([1]); // Astaroth
  });

  it("ciudad sin SL: sin anuncios", () => {
    const s = makeState({ position: { location: TOWN, floor: 0, x: 15, y: 15 }, shadowlordLocs: [7, 8, 6] });
    expect(shadowlordEntryAnnouncements(s)).toEqual([]);
  });

  it("Stonegate (0x1d): los TRES vivos en orden 2→1→0", () => {
    const s = makeState({ position: { location: STONEGATE_LOCATION, floor: 0, x: 15, y: 15 }, shadowlordLocs: [1, 2, 3] });
    expect(shadowlordEntryAnnouncements(s)).toEqual([2, 1, 0]);
  });

  it("Stonegate: excluye los destruidos (loc >= 0x80)", () => {
    const s = makeState({ position: { location: STONEGATE_LOCATION, floor: 0, x: 15, y: 15 }, shadowlordLocs: [0xff, 2, 0xff] });
    expect(shadowlordEntryAnnouncements(s)).toEqual([1]); // sólo Astaroth vivo
  });
});

// ---------------------------------------------------------------------------
// Puros: gate de posesión (0x10f2) — rand SIEMPRE + bug del slot #4
// ---------------------------------------------------------------------------
describe("F1.10-T6 · possessGateRoll (TOWN 0x10f2) + isPersonType", () => {
  it("isPersonType = [0x40,0x74)", () => {
    expect(isPersonType(0x40)).toBe(true);
    expect(isPersonType(0x73)).toBe(true);
    expect(isPersonType(0x74)).toBe(false);
    expect(isPersonType(0x3f)).toBe(false);
    expect(isPersonType(144)).toBe(false); // daemon
  });

  it("consume el rand SIEMPRE (aunque no sea elegible) — 0x1139 antes del return", () => {
    let calls = 0;
    const rand = () => { calls++; return 0; };
    expect(possessGateRoll(false, true, rand)).toBe(false); // ausente
    expect(possessGateRoll(true, false, rand)).toBe(false); // slot4 no-persona
    expect(calls).toBe(2);
  });

  it("elegible = presente ∧ slot4IsPerson ∧ rand==0 (el tipo NO es del slot evaluado)", () => {
    expect(possessGateRoll(true, true, () => 0)).toBe(true);
    expect(possessGateRoll(true, true, () => 1)).toBe(false); // rand 1 → 50% no
    expect(possessGateRoll(false, true, () => 0)).toBe(false); // no presente
    expect(possessGateRoll(true, false, () => 0)).toBe(false); // 🐛 slot #4 no-persona → gate falla
  });
});

// ---------------------------------------------------------------------------
// NpcManager.possessForShadowlord — 32 rand EXACTOS, marca dialogNumber
// ---------------------------------------------------------------------------
describe("F1.10-T6 · posesión (TOWN 0x1156) — RNG exacto + bug slot #4", () => {
  function loadedFrom(data: Record<number, NpcSlot[]>, loc: number): NpcManager {
    const state = makeState({ position: { location: loc, floor: 0, x: 15, y: 15 } });
    const mgr = new NpcManager(data);
    mgr.enterMap(loc, state);
    return mgr;
  }
  const loaded = () => loadedFrom(NPC_DATA, TOWN); // slot #4 persona; slots 1..4 persona

  it("Astaroth (1): consume EXACTAMENTE 32 rand (uno por slot), args (0,1)", () => {
    let calls = 0;
    loaded().possessForShadowlord(TOWN, 1, (lo, hi) => { calls++; expect([lo, hi]).toEqual([0, 1]); return 1; });
    expect(calls).toBe(32);
  });

  it("Astaroth rand==0 (slot #4 persona): los 4 person-NPC → 0xFE, aiType 7", () => {
    const mgr = loaded();
    mgr.possessForShadowlord(TOWN, 1, () => 0);
    const npcs = mgr.npcsAt(TOWN, 0);
    expect(npcs.length).toBe(4);
    for (const n of npcs) {
      expect(n.dialogNumber).toBe(0xfe);
      expect(n.aiTypes).toEqual([7, 7, 7]);
    }
  });

  it("Nosfentor (2) rand==0 (slot #4 persona): person-NPC → 0xFD, aiType 3", () => {
    const mgr = loaded();
    mgr.possessForShadowlord(TOWN, 2, () => 0);
    for (const n of mgr.npcsAt(TOWN, 0)) {
      expect(n.dialogNumber).toBe(0xfd);
      expect(n.aiTypes).toEqual([3, 3, 3]);
    }
  });

  // 🐛 BUG-FOR-BUG: el gate de tipo usa el slot #4 CONSTANTE (TOWN 0x111f-0x1121).
  it("🐛 Astaroth posee un NPC NO-persona (daemon) si el slot #4 es persona (0x85e sin re-check)", () => {
    // slot #4 persona → gate pasa; slot 5 = daemon presente. Astaroth NO re-chequea.
    const data = { 90: [slot({ slot: 0 }), person(4, 10, 10), daemon(5, 12, 12)] };
    const mgr = loadedFrom(data, 90);
    mgr.possessForShadowlord(90, 1, () => 0);
    const dae = mgr.npcAt(90, 0, 12, 12);
    expect(dae?.dialogNumber).toBe(0xfe); // el daemon fue poseído (bug-for-bug)
  });

  it("🐛 Nosfentor con slot #4 NO-persona → no posee a NADIE aunque haya person-NPCs", () => {
    // slot #4 = daemon (no persona) → gate de tipo falla para TODOS.
    const data = { 91: [slot({ slot: 0 }), person(1, 12, 12), daemon(4, 10, 10)] };
    const mgr = loadedFrom(data, 91);
    let calls = 0;
    mgr.possessForShadowlord(91, 2, () => { calls++; return 0; });
    expect(calls).toBe(32); // el conteo de rand NO cambia
    expect(mgr.npcAt(91, 0, 12, 12)?.dialogNumber).toBe(5); // el person-NPC NO fue poseído
  });

  it("🐛 Nosfentor (0x8d4) RE-CHEQUEA el tipo real: NO posee al daemon aunque pase el gate", () => {
    const data = { 92: [slot({ slot: 0 }), person(4, 10, 10), daemon(5, 12, 12)] };
    const mgr = loadedFrom(data, 92);
    mgr.possessForShadowlord(92, 2, () => 0);
    expect(mgr.npcAt(92, 0, 12, 12)?.dialogNumber).toBe(0); // daemon intacto (dialog 0)
    expect(mgr.npcAt(92, 0, 10, 10)?.dialogNumber).toBe(0xfd); // la persona SÍ (0xFD)
  });

  it("rand==1 (50% no) → nadie poseído pero SÍ se gastan los 32 rand", () => {
    const mgr = loaded();
    let calls = 0;
    mgr.possessForShadowlord(TOWN, 1, () => { calls++; return 1; });
    expect(calls).toBe(32);
    for (const n of mgr.npcsAt(TOWN, 0)) expect(n.dialogNumber).toBe(5);
  });

  it("Faulinei (0) y ninguno: NO consume rand ni cambia NPCs (rama 0x11b1)", () => {
    const mgr = loaded();
    let calls = 0;
    mgr.possessForShadowlord(TOWN, 0, () => { calls++; return 0; });
    expect(calls).toBe(0);
    for (const n of mgr.npcsAt(TOWN, 0)) expect(n.dialogNumber).toBe(5);
  });

  it("PARIDAD DE STREAM: el g_rng_seed avanza EXACTAMENTE 32 next(0,1) y la posesión = las tiradas", () => {
    // Modelo independiente: OriginalRng 32× next(0,1). El slot si (0..31) se posee sii
    // presente ∧ slot4-persona ∧ roll==0 (Astaroth, sin re-check). NPC_DATA[TOWN]: slots
    // 1/2/3/4 persona (presentes), slot #4 persona → gate de tipo pasa.
    const SEED = 98765;
    const ref = new OriginalRng(SEED);
    const rolls = Array.from({ length: 32 }, () => ref.next(0, 1));
    const present = new Set([1, 2, 3, 4]); // slots con horario en NPC_DATA[TOWN]
    const possessedSlots = new Set<number>();
    for (let si = 0; si < 32; si++) if (present.has(si) && rolls[si] === 0) possessedSlots.add(si);
    // Clon: mismo stream.
    const mgr = loaded();
    const live = new OriginalRng(SEED);
    mgr.possessForShadowlord(TOWN, 1, (lo, hi) => live.next(lo, hi));
    expect(live.getSeed()).toBe(ref.getSeed()); // 32 rand idénticos
    const got = new Set(mgr.npcsAt(TOWN, 0).filter((n) => n.dialogNumber === 0xfe).map((n) => n.slot));
    expect(got).toEqual(possessedSlots);
  });
});

// ---------------------------------------------------------------------------
// Integración: entrada a un pueblo con SL presente
// ---------------------------------------------------------------------------
describe("F1.10-T6 · entrada al pueblo (TOWN 0x11f0)", () => {
  function enterWith(locs: number[] | undefined): { g: Game; events: ReturnType<Game["move"]> } {
    const s = makeState({ position: { location: 0, floor: 0, x: 10, y: 10 }, shadowlordLocs: locs });
    const g = makeGame(s);
    g.reseed(12345);
    g.move("south"); // (10,10)→(10,11): PISA el tile de TOWN (paso normal; ya no auto-entra)
    const events = g.enter(); // (E)nter sobre la localización → carga TOWN + shadowlords urbanos
    return { g, events };
  }
  const texts = (evs: ReturnType<Game["move"]>) => evs.filter((e) => e.kind === "message").map((e: any) => e.text);

  it("Falsehood presente: anuncio 'falsehood' + sprite físico 0xFC en (15, SL_SPAWN_Y[2]) + SIN posesión", () => {
    const { g, events } = enterWith([TOWN, 99, 99]); // Faulinei (idx 0) en TOWN
    expect(g.state.position.location).toBe(TOWN);
    expect(texts(events).some((t) => t.includes("falsehood") && t.includes("doth surround thee"))).toBe(true);
    const sprite = (g.state.worldObjects ?? []).filter((o) => o.kind === "shadowlord" && o.location === TOWN);
    expect(sprite).toHaveLength(1);
    expect(sprite[0]).toMatchObject({ tile: SL_TILE, x: SHADOWLORD_SPRITE_X, y: SHADOWLORD_SPRITE_Y[TOWN], floor: 0 });
    // Faulinei no posee: ningún NPC con dialogNumber >= 0xFD
    expect(g.npcManager!.npcsAt(TOWN, 0).every((n) => n.dialogNumber < 0xfd)).toBe(true);
  });

  it("Astaroth presente: anuncio 'hatred' + sprite + posesión aplicada (algún 0xFE sobre el stream)", () => {
    // Busca una semilla en que al menos un NPC quede poseído (rand==0 en su slot).
    let possessedFound = false;
    for (let seed = 1; seed < 40 && !possessedFound; seed++) {
      const s = makeState({ position: { location: 0, floor: 0, x: 10, y: 10 }, shadowlordLocs: [99, TOWN, 99] });
      const g = makeGame(s);
      g.reseed(seed);
      g.move("south"); // pisa el tile de TOWN
      const events = g.enter(); // (E)nter → anuncio + posesión urbana
      expect(texts(events).some((t) => t.includes("hatred"))).toBe(true);
      if (g.npcManager!.npcsAt(TOWN, 0).some((n) => n.dialogNumber === 0xfe)) possessedFound = true;
    }
    expect(possessedFound).toBe(true);
  });

  it("ciudad sin SL: sin anuncio ni sprite", () => {
    const { g, events } = enterWith([7, 8, 6]); // ningún SL en TOWN
    expect(g.state.position.location).toBe(TOWN);
    expect(texts(events).some((t) => t.includes("doth surround thee"))).toBe(false);
    expect((g.state.worldObjects ?? []).some((o) => o.kind === "shadowlord")).toBe(false);
  });

  it("shadowlordLocs undefined: no explota, sin anuncio", () => {
    const { g, events } = enterWith(undefined);
    expect(g.state.position.location).toBe(TOWN);
    expect(texts(events).some((t) => t.includes("doth surround thee"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Talk a un NPC poseído (TALK 0x03a6/0x03cc)
// ---------------------------------------------------------------------------
describe("F1.10-T6 · talk a un poseído (TALK 0x03a6/0x03cc)", () => {
  function gameWithPossessed(dialogNumber: number): Game {
    const s = makeState({ position: { location: TOWN, floor: 0, x: 12, y: 13 } });
    const g = makeGame(s);
    g.npcManager!.enterMap(TOWN, s);
    // Pone el NPC del slot 1 (en 12,12) poseído; el party está en (12,13) → norte.
    const npc = g.npcManager!.npcAt(TOWN, 0, 12, 12);
    npc!.dialogNumber = dialogNumber;
    return g;
  }

  it("Nosfentor 0xFD → 'Don't hurt me! Please go away!'", () => {
    const g = gameWithPossessed(0xfd);
    const evs = g.tryTalkPossessed("north");
    expect(evs).not.toBeNull();
    expect((evs![0] as any).text).toContain("Don't hurt me!");
    expect((evs![0] as any).text).toContain("Please go away!");
  });

  it("Astaroth 0xFE → hostil 'Begone, vermin!'", () => {
    const g = gameWithPossessed(0xfe);
    const evs = g.tryTalkPossessed("north");
    expect((evs![0] as any).text).toContain("Begone");
  });

  it("NPC normal → null (cae a talkTarget)", () => {
    const g = gameWithPossessed(5);
    expect(g.tryTalkPossessed("north")).toBeNull();
  });
});
