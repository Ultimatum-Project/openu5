/**
 * F1.10-T4 · Corona y Cetro de Lord British en sus POSICIONES REALES.
 *
 * Derivación (ver progress.md F1.10-T4): la corona y el cetro NO se siembran por código
 * (como los shards/amuleto del Underworld) ni son tiles estáticos del mapa: son SLOTS-OBJETO
 * del fichero .NPC (misma tabla 0x5C5A que los cofres del castillo, task #3), con su `type`
 * = tile de trama:
 *   - Corona: Palace_of_Blackthorn (loc 18), slot 1, type 0xB5, (15,13), z3.
 *   - Cetro:  Stonegate (loc 29), slot 9, type 0xB6, (15,15), z0.
 * El cetro está CONFIRMADO por TOWN.OVL 0x1253 (cmp g_location,0x1d(29) / cmp g_sceptre,0 →
 * retira el NPC #9 si g_sceptre!=0 — exactamente el slot 9, type 0xB6).
 *
 * Modelo: objetos de interior kind "plot" hidratados por Game.hydrateInteriorObjects, gateados
 * por !tomado (espejo observable de la retirada del binario: cetro por TOWN 0x1253, corona por
 * el propio (G)et que borra el slot del world-object table vía kernel 0xBB9E [= CS 0x7b1e → TOWN.OVL:0x011e]/0xBB86). El (G)et
 * sobre el tile los recoge (SJOG apply_item_grant, ramas 0x16e6 corona / 0x1706 cetro),
 * fijando lbArtifacts.crown/sceptre e imprimiendo su string byte-exacto de DATA.OVL.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { grantPlotItem } from "../src/core/quest/items.js";

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
    turnsSinceStart: 0,
    position: { location: 18, floor: 3, x: 15, y: 12 },
    transport: "foot", torchTurns: 0,
    questFlags: {}, journal: [], worldObjects: [],
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    npcDead: [],
    equipmentQuantities: new Array(48).fill(0),
    spellQuantities: new Array(48).fill(0),
    scrollQuantities: new Array(8).fill(0),
    potionQuantities: new Array(8).fill(0),
    reagentQuantities: new Array(8).fill(0),
  };
  return { ...base, ...over } as GameState;
}

/** Slot .NPC mínimo (posición fija en las 3 franjas de horario). */
function slot(over: Partial<NpcSlot> & { slot: number }): NpcSlot {
  return {
    aiTypes: [0, 0, 0], x: [0, 0, 0], y: [0, 0, 0], z: [0, 0, 0],
    times: [0, 0, 0, 0], type: 0, dialogNumber: 0, ...over,
  };
}

/** CASTLE/KEEP.NPC recortados: sólo los slots-objeto de trama que nos importan. */
const NPC_DATA: Record<number, NpcSlot[]> = {
  18: [
    slot({ slot: 0 }),
    slot({ slot: 1, type: 0xb5, x: [15, 15, 15], y: [13, 13, 13], z: [3, 3, 3] }), // corona
  ],
  29: [
    slot({ slot: 0 }),
    slot({ slot: 9, type: 0xb6, x: [15, 15, 15], y: [15, 15, 15], z: [0, 0, 0] }), // cetro
  ],
};

function floorGrid(): number[][] {
  return Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
}

function world(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  const underworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  const smallMaps = new Map<number, SmallMapLocation>();
  const blackthorn: SmallMapLocation = {
    id: 18, name: "Palace_of_Blackthorn",
    floors: [-1, 0, 1, 2, 3].map((z) => ({ z, tiles: floorGrid() })),
  };
  const stonegate: SmallMapLocation = {
    id: 29, name: "Stonegate", floors: [{ z: 0, tiles: floorGrid() }],
  };
  smallMaps.set(18, blackthorn);
  smallMaps.set(29, stonegate);
  return { overworld, underworld, smallMaps };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

function makeGame(s: GameState): Game {
  return new Game({} as ExtractedInitialState, world(), gameData, s, {
    npcManager: new NpcManager(NPC_DATA),
  });
}

const plotOf = (g: Game) => (g.state.worldObjects ?? []).filter((o) => o.kind === "plot");

describe("F1.10-T4 · grantPlotItem corona/cetro (strings byte-exactos DATA.OVL)", () => {
  it("corona = DS 0x8D3A verbatim + fija lbArtifacts.crown", () => {
    const s = makeState();
    expect(grantPlotItem(s, "crown")).toBe("The Crown of Lord British!\n");
    expect(s.lbArtifacts.crown).toBe(true);
  });

  it("cetro = DS 0x8D56 verbatim + fija lbArtifacts.sceptre", () => {
    const s = makeState();
    expect(grantPlotItem(s, "sceptre")).toBe("The Sceptre of Lord British!\n");
    expect(s.lbArtifacts.sceptre).toBe(true);
  });
});

describe("F1.10-T4 · Corona en Palace of Blackthorn (loc 18, slot 1, 0xB5, (15,13) z3)", () => {
  it("hydrateInteriorObjects siembra la corona en su posición REAL como objeto plot", () => {
    const g = makeGame(makeState());
    g.hydrateInteriorObjects(18);
    const plots = plotOf(g);
    expect(plots).toHaveLength(1);
    const crown = plots[0]!;
    expect(crown.plotItem).toBe("crown");
    expect({ x: crown.x, y: crown.y, floor: crown.floor, loc: crown.location, tile: crown.tile }).toEqual({
      x: 15, y: 13, floor: 3, loc: 18, tile: 0xb5,
    });
  });

  it("(G)et sobre la corona la recoge: flag + string byte-exacto + retira el objeto", () => {
    const g = makeGame(makeState({ position: { location: 18, floor: 3, x: 15, y: 12 } }));
    g.hydrateInteriorObjects(18);
    const events = g.get("south"); // party (15,12) → corona (15,13)
    expect(g.state.lbArtifacts.crown).toBe(true);
    const msg = events.find((e) => e.kind === "message");
    expect(msg && "text" in msg ? msg.text : "").toBe("The Crown of Lord British!\n");
    expect(plotOf(g)).toHaveLength(0); // retirada tras el Get
  });

  it("no-renacimiento: con la corona ya tomada, hydrateInteriorObjects NO la re-siembra", () => {
    const g = makeGame(makeState({ lbArtifacts: { amulet: false, crown: true, sceptre: false } }));
    g.hydrateInteriorObjects(18);
    expect(plotOf(g)).toHaveLength(0);
  });
});

describe("F1.10-T4 · Cetro en Stonegate (loc 29, slot 9, 0xB6, (15,15) z0)", () => {
  it("hydrateInteriorObjects siembra el cetro en su posición REAL como objeto plot", () => {
    const g = makeGame(makeState({ position: { location: 29, floor: 0, x: 15, y: 14 } }));
    g.hydrateInteriorObjects(29);
    const plots = plotOf(g);
    expect(plots).toHaveLength(1);
    const sceptre = plots[0]!;
    expect(sceptre.plotItem).toBe("sceptre");
    expect({ x: sceptre.x, y: sceptre.y, floor: sceptre.floor, loc: sceptre.location, tile: sceptre.tile }).toEqual({
      x: 15, y: 15, floor: 0, loc: 29, tile: 0xb6,
    });
  });

  it("(G)et sobre el cetro lo recoge: flag + string byte-exacto + retira el objeto", () => {
    const g = makeGame(makeState({ position: { location: 29, floor: 0, x: 15, y: 14 } }));
    g.hydrateInteriorObjects(29);
    const events = g.get("south"); // party (15,14) → cetro (15,15)
    expect(g.state.lbArtifacts.sceptre).toBe(true);
    const msg = events.find((e) => e.kind === "message");
    expect(msg && "text" in msg ? msg.text : "").toBe("The Sceptre of Lord British!\n");
    expect(plotOf(g)).toHaveLength(0);
  });

  it("no-renacimiento: con el cetro ya tomado, hydrateInteriorObjects NO lo re-siembra (espejo TOWN 0x1253)", () => {
    const g = makeGame(makeState({
      position: { location: 29, floor: 0, x: 15, y: 14 },
      lbArtifacts: { amulet: false, crown: false, sceptre: true },
    }));
    g.hydrateInteriorObjects(29);
    expect(plotOf(g)).toHaveLength(0);
  });
});

describe("F1.10-T4 · ciclo de vida entrada→salida→re-entrada (sin duplicar)", () => {
  it("re-hidratar Blackthorn sin recoger la corona deja EXACTAMENTE 1 (no duplica)", () => {
    const g = makeGame(makeState());
    g.hydrateInteriorObjects(18); // entrada
    g.hydrateInteriorObjects(18); // re-entrada (discardInteriorObjects debe purgar el plot previo)
    expect(plotOf(g)).toHaveLength(1);
    expect(plotOf(g)[0]!.plotItem).toBe("crown");
  });

  it("re-hidratar Stonegate sin recoger el cetro deja EXACTAMENTE 1 (no duplica)", () => {
    const g = makeGame(makeState({ position: { location: 29, floor: 0, x: 15, y: 14 } }));
    g.hydrateInteriorObjects(29);
    g.hydrateInteriorObjects(29);
    expect(plotOf(g)).toHaveLength(1);
    expect(plotOf(g)[0]!.plotItem).toBe("sceptre");
  });

  it("tras recoger la corona, re-hidratar Blackthorn deja 0 (el gate !tomado manda)", () => {
    const g = makeGame(makeState({ position: { location: 18, floor: 3, x: 15, y: 12 } }));
    g.hydrateInteriorObjects(18);
    g.get("south"); // recoge la corona
    expect(plotOf(g)).toHaveLength(0);
    g.hydrateInteriorObjects(18); // re-entrada tras el pickup
    expect(plotOf(g)).toHaveLength(0);
  });

  it("desacople: hydrateUnderworldPlot NO borra un plot de interior (corona sin tomar, floor 3)", () => {
    // Corona de interior colgada en worldObjects (p.ej. dejada al no recogerla). Entrar al
    // Underworld sólo debe tocar la capa de floor 0xFF, no los plot de pueblo.
    const g = makeGame(makeState({
      position: { location: 0, floor: 0xff, x: 100, y: 100 },
      worldObjects: [
        { location: 18, floor: 3, x: 15, y: 13, tile: 0xb5, kind: "plot", plotItem: "crown" },
      ],
    }));
    g.hydrateUnderworldPlot();
    const crown = (g.state.worldObjects ?? []).filter((o) => o.plotItem === "crown");
    expect(crown).toHaveLength(1); // la corona de interior sobrevive (floor 3 ≠ 0xFF)
  });
});
