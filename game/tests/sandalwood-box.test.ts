/**
 * #51 · Caja de Sándalo de Lord British OBTENIBLE por juego.
 *
 * Gap de la auditoría #49 (TOP-2): la caja se colocaba en su slot real pero el tipo 14
 * se clasificaba como "prop" INERTE, y `applyLootGrant("sandalwood")` era no-op, así que
 * `state.specialItems.woodenBox` NUNCA se activaba fuera de debug/save → la rama del final
 * "bueno" (ENDGAME 0x0648: Y ∧ g_wooden_box, lordbritish.ts:174) quedaba muerta.
 *
 * Fix: la caja pasa a ser un objeto de trama kind "plot" (como corona/cetro), hidratado
 * por Game.hydrateInteriorObjects y recogible por (G)et vía grantPlotItem, que fija
 * `specialItems.woodenBox` — el MISMO flag que gatea la re-hidratación (no re-nace tras el
 * pickup). Posición real (assets/npcs.json): LB castle (loc 17), slot 31, type 14, (18,12),
 * z2 — tras el pasadizo secreto que revela la melodía del clavicémbalo (task #29/#54).
 *
 * DISCRIMINANTE: antes del fix, hydrateInteriorObjects creaba un worldObject kind "prop"
 * (no "plot"), (G)et no lo tomaba y woodenBox seguía en false. Espeja crown-sceptre.test.ts.
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
    // LB castle (loc 17), floor 2, una casilla al NORTE de la caja (18,12).
    position: { location: 17, floor: 2, x: 18, y: 11 },
    transport: "foot", torchTurns: 0,
    questFlags: {}, journal: [], worldObjects: [],
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    specialItems: { spyglass: false, hmsCape: false, sextant: false, pocketWatch: false, blackBadge: false, woodenBox: false },
    npcDead: [],
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

/** CASTLE.NPC recortado: sólo el slot-objeto de la caja de sándalo (slot 31, real). */
const NPC_DATA: Record<number, NpcSlot[]> = {
  17: [
    slot({ slot: 0 }),
    slot({ slot: 31, type: 14, x: [18, 18, 18], y: [12, 12, 12], z: [2, 2, 2] }), // caja de sándalo
  ],
};

function floorGrid(): number[][] {
  return Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
}

function world(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  const underworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  const smallMaps = new Map<number, SmallMapLocation>();
  const lbCastle: SmallMapLocation = {
    id: 17, name: "Lord_Britishs_Castle",
    floors: [-1, 0, 1, 2, 3].map((z) => ({ z, tiles: floorGrid() })),
  };
  smallMaps.set(17, lbCastle);
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

describe("#51 · grantPlotItem caja de sándalo (0x14F0) fija g_wooden_box", () => {
  it("wooden-box = 'A sandalwood box!\\n' verbatim (DATA.OVL 0x8C86) + fija specialItems.woodenBox", () => {
    const s = makeState();
    // String byte-exacto del binario (SJOG 0x14f0 imprime DS 0x8C76 = "A sandalwood box!\n").
    expect(grantPlotItem(s, "wooden-box")).toBe("A sandalwood box!\n");
    expect(s.specialItems.woodenBox).toBe(true);
  });
});

describe("#51 · Caja de sándalo en LB castle (loc 17, slot 31, type 14, (18,12) z2)", () => {
  it("hydrateInteriorObjects la siembra como objeto PLOT (no 'prop') en su posición real", () => {
    const g = makeGame(makeState());
    g.hydrateInteriorObjects(17);
    const plots = plotOf(g);
    expect(plots).toHaveLength(1);
    const box = plots[0]!;
    expect(box.plotItem).toBe("wooden-box");
    expect({ x: box.x, y: box.y, floor: box.floor, loc: box.location, tile: box.tile }).toEqual({
      x: 18, y: 12, floor: 2, loc: 17, tile: 14,
    });
  });

  it("(G)et sobre la caja la recoge: woodenBox + string byte-exacto + retira el objeto", () => {
    const g = makeGame(makeState());
    g.hydrateInteriorObjects(17);
    const events = g.get("south"); // party (18,11) → caja (18,12)
    expect(g.state.specialItems.woodenBox).toBe(true);
    const msg = events.find((e) => e.kind === "message");
    expect(msg && "text" in msg ? msg.text : "").toBe("A sandalwood box!\n");
    expect(plotOf(g)).toHaveLength(0); // retirada tras el Get
  });

  it("no-renacimiento: con la caja ya tomada, hydrateInteriorObjects NO la re-siembra", () => {
    const g = makeGame(makeState({
      specialItems: { spyglass: false, hmsCape: false, sextant: false, pocketWatch: false, blackBadge: false, woodenBox: true },
    }));
    g.hydrateInteriorObjects(17);
    expect(plotOf(g)).toHaveLength(0);
  });

  it("ciclo entrada→salida→re-entrada sin recoger: EXACTAMENTE 1 (no duplica)", () => {
    const g = makeGame(makeState());
    g.hydrateInteriorObjects(17);
    g.hydrateInteriorObjects(17); // re-entrada: discardInteriorObjects purga el plot previo
    expect(plotOf(g)).toHaveLength(1);
    expect(plotOf(g)[0]!.plotItem).toBe("wooden-box");
  });

  it("tras recoger la caja, re-hidratar LB castle deja 0 (el gate !tomado manda)", () => {
    const g = makeGame(makeState());
    g.hydrateInteriorObjects(17);
    g.get("south"); // recoge la caja
    expect(plotOf(g)).toHaveLength(0);
    g.hydrateInteriorObjects(17); // re-entrada tras el pickup
    expect(plotOf(g)).toHaveLength(0);
  });
});
