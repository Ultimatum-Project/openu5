/**
 * F1.10-T2 · Sembrador del Underworld a nivel Game (Game.hydrateUnderworldPlot).
 * Port de OUTSUBS 0x0566: al ENTRAR al Underworld (loc 0 · floor 0xFF) se re-siembran
 * los shards (tile 0xB4) y el amuleto (tile 0xB7) en sus coords REALES, gateados por
 * la trama. Fuera del Underworld el método es no-op (no toca la capa "plot").
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { shadowlordDeadFlag } from "../src/core/quest/shadowlords.js";
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
    position: { location: 0, floor: 0xff, x: 100, y: 100 },
    transport: "foot", torchTurns: 0,
    questFlags: {}, journal: [],
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    equipmentQuantities: new Array(48).fill(0),
    spellQuantities: new Array(48).fill(0),
    scrollQuantities: new Array(8).fill(0),
    potionQuantities: new Array(8).fill(0),
    reagentQuantities: new Array(8).fill(0),
  };
  return { ...base, ...over } as GameState;
}

function world(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  const underworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  const smallMaps = new Map<number, SmallMapLocation>();
  return { overworld, underworld, smallMaps };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
  shardSpawns: [
    { x: 192, y: 80, z: 0xf0 },
    { x: 130, y: 65, z: 0xf1 },
    { x: 176, y: 184, z: 0xf2 },
  ],
};

function makeGame(s: GameState): Game {
  return new Game({} as ExtractedInitialState, world(), gameData, s);
}

const plotOf = (g: Game) => (g.state.worldObjects ?? []).filter((o) => o.kind === "plot");

describe("F1.10-T2 · Game.hydrateUnderworldPlot", () => {
  it("siembra los 3 shards + amuleto al entrar al Underworld en fresco", () => {
    const g = makeGame(makeState());
    g.hydrateUnderworldPlot();
    const plot = plotOf(g);
    expect(plot.map((o) => o.plotItem).sort()).toEqual(
      ["amulet", "shard-cowardice", "shard-falsehood", "shard-hatred"].sort(),
    );
  });

  it("planta el tile 0xB4 del shard en su coord real, visible en tileAt del Underworld", () => {
    const g = makeGame(makeState());
    g.hydrateUnderworldPlot();
    expect(g.activeMap.tileAt(192, 80)).toBe(0xb4); // Falsehood
    expect(g.activeMap.tileAt(130, 65)).toBe(0xb4); // Hatred
    expect(g.activeMap.tileAt(176, 184)).toBe(0xb4); // Cowardice
    expect(g.activeMap.tileAt(105, 225)).toBe(0xb7); // amuleto
    expect(g.activeMap.tileAt(50, 50)).toBe(5); // base intacto en otra celda
  });

  it("es idempotente: re-sembrar no duplica", () => {
    const g = makeGame(makeState());
    g.hydrateUnderworldPlot();
    g.hydrateUnderworldPlot();
    expect(plotOf(g)).toHaveLength(4);
  });

  it("NO siembra un shard ya tomado", () => {
    const g = makeGame(makeState({ shards: { falsehood: true, hatred: false, cowardice: false } }));
    g.hydrateUnderworldPlot();
    expect(plotOf(g).map((o) => o.plotItem)).not.toContain("shard-falsehood");
    expect(plotOf(g).map((o) => o.plotItem)).toContain("shard-hatred");
  });

  it("NO siembra un shard cuyo Shadowlord está muerto (questFlags)", () => {
    const s = makeState();
    s.questFlags[shadowlordDeadFlag("hatred")] = true;
    const g = makeGame(s);
    g.hydrateUnderworldPlot();
    expect(plotOf(g).map((o) => o.plotItem)).toContain("shard-falsehood");
    expect(plotOf(g).map((o) => o.plotItem)).not.toContain("shard-hatred");
  });

  it("NO siembra el amuleto ya tomado; los shards no dependen del amuleto", () => {
    const g = makeGame(makeState({ lbArtifacts: { amulet: true, crown: false, sceptre: false } }));
    g.hydrateUnderworldPlot();
    expect(plotOf(g).map((o) => o.plotItem)).not.toContain("amulet");
    expect(plotOf(g).filter((o) => o.plotItem?.startsWith("shard-"))).toHaveLength(3);
  });

  it("fuera del Underworld (floor 0) es no-op: no siembra NI borra plots existentes", () => {
    const s = makeState({ position: { location: 18, floor: 0, x: 15, y: 5 } });
    // Un plot preexistente (sembrado en una visita previa al Underworld) sobrevive.
    s.worldObjects = [
      { location: 0, floor: 0xff, x: 192, y: 80, tile: 0xb4, kind: "plot", plotItem: "shard-falsehood", plotZ: 0xf0 },
    ];
    const g = makeGame(s);
    g.hydrateUnderworldPlot();
    expect(plotOf(g)).toHaveLength(1); // intacto: recoger la corona en un pueblo no borra shards
  });

});

describe("F1.10-T3 · recogida real de trama con (G)et sobre 0xB4/0xB7", () => {
  const msgs = (evs: { text?: string }[]) => evs.map((e) => e.text ?? "");

  it("(G)et hacia un shard: fija el flag, imprime el mensaje byte-exacto (doble print) y el tile 0xB4 desaparece", () => {
    // Party ADYACENTE al shard de Falsehood (192,80), mirando al este.
    const g = makeGame(makeState({ position: { location: 0, floor: 0xff, x: 191, y: 80 } }));
    g.hydrateUnderworldPlot();
    expect(g.activeMap.tileAt(192, 80)).toBe(0xb4);
    const events = g.get("east");
    // DOS prints del original (SJOG 0x16b6): prefijo DS 0x8D0A + nombre DS 0x8D18, verbatim.
    expect(msgs(events)).toContain("The Shard of\nFalsehood!\n");
    expect(g.state.shards.falsehood).toBe(true);
    expect(g.activeMap.tileAt(192, 80)).toBe(5); // base restaurado (tile retirado)
  });

  it("tras (G)et el shard NO se re-siembra (el gate no-tomado ya no pasa); los otros siguen", () => {
    const g = makeGame(makeState({ position: { location: 0, floor: 0xff, x: 191, y: 80 } }));
    g.hydrateUnderworldPlot();
    g.get("east"); // recoge Falsehood
    expect(plotOf(g).map((o) => o.plotItem)).not.toContain("shard-falsehood");
    // Hatred, Cowardice y amuleto permanecen sembrados.
    expect(plotOf(g).map((o) => o.plotItem).sort()).toEqual(
      ["amulet", "shard-cowardice", "shard-hatred"].sort(),
    );
    // Re-entrar al Underworld (re-hidratar) tampoco lo re-siembra.
    g.hydrateUnderworldPlot();
    expect(plotOf(g).map((o) => o.plotItem)).not.toContain("shard-falsehood");
  });

  it("(G)et hacia el amuleto (tile 0xB7): fija lbArtifacts.amulet y lo retira", () => {
    // Amuleto en (105,225); party al oeste, mirando al este.
    const g = makeGame(makeState({ position: { location: 0, floor: 0xff, x: 104, y: 225 } }));
    g.hydrateUnderworldPlot();
    expect(g.activeMap.tileAt(105, 225)).toBe(0xb7);
    const events = g.get("east");
    expect(msgs(events)).toContain("The Amulet of Lord British!\n"); // DS 0x8D74, un solo print
    expect(g.state.lbArtifacts.amulet).toBe(true);
    expect(plotOf(g).map((o) => o.plotItem)).not.toContain("amulet");
    expect(g.activeMap.tileAt(105, 225)).toBe(5);
  });

  it("cada shard cablea su flag correcto (Hatred desde el sur)", () => {
    // Hatred en (130,65); party al norte, mirando al sur.
    const g = makeGame(makeState({ position: { location: 0, floor: 0xff, x: 130, y: 64 } }));
    g.hydrateUnderworldPlot();
    const events = g.get("south");
    expect(msgs(events)).toContain("The Shard of\nHatred!\n"); // DS 0x8D0A + 0x8D24
    expect(g.state.shards.hatred).toBe(true);
    expect(g.state.shards.falsehood).toBe(false);
    expect(g.state.shards.cowardice).toBe(false);
  });

  it("guard: (G)et sobre un plot cuyo ítem YA está tomado lo retira sin romper (idempotente)", () => {
    // Estado imposible por el seed (que no siembra tomados), pero verificamos el guard:
    // un plot manualmente presente para un shard ya tomado se recoge sin efecto adverso.
    const s = makeState({ position: { location: 0, floor: 0xff, x: 191, y: 80 } });
    s.shards.falsehood = true;
    s.worldObjects = [
      { location: 0, floor: 0xff, x: 192, y: 80, tile: 0xb4, kind: "plot", plotItem: "shard-falsehood", plotZ: 0xf0 },
    ];
    const g = makeGame(s);
    const events = g.get("east");
    expect(msgs(events)).toContain("The Shard of\nFalsehood!\n");
    expect(g.state.shards.falsehood).toBe(true); // sigue tomado (idempotente)
    // Re-derivada la capa: no queda ningún plot de Falsehood (gate no-tomado no pasa).
    expect(plotOf(g).map((o) => o.plotItem)).not.toContain("shard-falsehood");
  });

  it("(G)et hacia una celda sin plot ni comida imprime 'Nothing to get!'", () => {
    const g = makeGame(makeState({ position: { location: 0, floor: 0xff, x: 50, y: 50 } }));
    g.hydrateUnderworldPlot();
    const events = g.get("east");
    expect(msgs(events)).toContain("Nothing to get!");
  });
});

describe("F1.10-T3 · strings byte-exactos de la jump-table de trama (fix review)", () => {
  function bareState(over: Partial<GameState> = {}): GameState {
    return {
      shards: { falsehood: false, hatred: false, cowardice: false },
      lbArtifacts: { amulet: false, crown: false, sceptre: false },
      ...over,
    } as GameState;
  }

  it("grantPlotItem: shard = doble print (prefijo DS 0x8D0A + nombre) verbatim de DATA.OVL BASE", () => {
    expect(grantPlotItem(bareState(), "shard-falsehood")).toBe("The Shard of\nFalsehood!\n"); // 0x8D0A+0x8D18
    expect(grantPlotItem(bareState(), "shard-hatred")).toBe("The Shard of\nHatred!\n"); // 0x8D0A+0x8D24
    expect(grantPlotItem(bareState(), "shard-cowardice")).toBe("The Shard of\nCowardice!\n"); // 0x8D0A+0x8D2E
  });

  it("grantPlotItem: amuleto = un solo print DS 0x8D74", () => {
    expect(grantPlotItem(bareState(), "amulet")).toBe("The Amulet of Lord British!\n");
  });

  it("grantPlotItem fija el flag correcto por ítem", () => {
    const s = bareState();
    grantPlotItem(s, "shard-hatred");
    expect(s.shards.hatred).toBe(true);
    expect(s.shards.falsehood).toBe(false);
    grantPlotItem(s, "amulet");
    expect(s.lbArtifacts.amulet).toBe(true);
  });

  // Corona (DS 0x8D3A) y cetro (DS 0x8D56) por grantPlotItem — su recogida como objetos "plot"
  // de interior (Blackthorn/Stonegate) se cubre en crown-sceptre.test.ts (F1.10-T4). El modelo
  // Search-radio fabricado (questItemSpots/searchQuestItem) quedó RETIRADO.
  it("grantPlotItem: corona y cetro = string byte-exacto + flag lbArtifacts", () => {
    const c = bareState();
    expect(grantPlotItem(c, "crown")).toBe("The Crown of Lord British!\n");
    expect(c.lbArtifacts.crown).toBe(true);
    const s = bareState();
    expect(grantPlotItem(s, "sceptre")).toBe("The Sceptre of Lord British!\n");
    expect(s.lbArtifacts.sceptre).toBe(true);
  });
});
