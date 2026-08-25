/**
 * MENÚ DEBUG · fachada DebugApi. Verifica que cada mutación:
 *   1. escribe el campo CORRECTO del estado vivo (game.state — la struct del save),
 *   2. NO consume el RNG stream (game.liveSeed() intacto tras cada operación),
 *   3. dispara `notify` (refresco de vista).
 * La regla cero-rand es el contrato duro del diseño: el debug fija estado, no
 * ejecuta mecánica. El teletransporte replica la receta del deep-link (enterMap +
 * hydrateInteriorObjects, deterministas), así que tampoco mueve la semilla.
 */
import { describe, expect, it, vi } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData, type CombatResources } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { NpcManager } from "../src/core/npc/manager.js";
import { createDebugApi } from "../src/debug/debugApi.js";
import { bestGearFromData, fillablePartySize, maxMpForClass } from "../src/debug/shortcuts.js";
import { EQUIPMENT_NOTHING } from "../src/core/equip.js";
import { SHADOWLORDS, shadowlordDeadFlag, canReachDoom } from "../src/core/quest/shadowlords.js";
import { endgameReady } from "../src/core/quest/lordbritish.js";

const TOWN = 6;

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test",
    gender: 0x0b,
    class: "A",
    status: "G",
    strength: 20,
    dexterity: 18,
    intelligence: 15,
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
    skullKeys: 0,
    grapple: false,
    magicCarpets: 0,
    equipmentQuantities: Array.from({ length: 48 }, () => 0),
    spellQuantities: Array.from({ length: 48 }, () => 0),
    scrollQuantities: Array.from({ length: 8 }, () => 0),
    potionQuantities: Array.from({ length: 8 }, () => 0),
    reagentQuantities: Array.from({ length: 8 }, () => 0),
    specialItems: { spyglass: false, hmsCape: false, sextant: false, pocketWatch: false, blackBadge: false, woodenBox: false },
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    moonstones: Array.from({ length: 8 }, () => ({ x: 0, y: 0, buried: false, z: 0, location: 0xff })),
    karma: 40,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot",
    torchTurns: 3,
    npcDead: Array.from({ length: 32 }, () => [] as boolean[]),
    npcMet: Array.from({ length: 32 }, () => [] as boolean[]),
    questFlags: {},
    journal: [],
  };
  return { ...base, ...over } as GameState;
}

function makeLocation(id: number): SmallMapLocation {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  return { id, name: `Loc${id}`, floors: [{ z: 0, tiles }, { z: 1, tiles }] };
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

function makeGame(s: GameState, combatResources?: CombatResources): Game {
  return new Game({} as ExtractedInitialState, makeWorld(), gameData, s, {
    npcManager: new NpcManager({}),
    combatResources,
  });
}

function setup(over: Partial<GameState> = {}, combatResources?: CombatResources) {
  const game = makeGame(makeState(over), combatResources);
  game.reseed(0x4d2);
  const notify = vi.fn();
  const api = createDebugApi(game, notify);
  return { game, api, notify, seed0: game.liveSeed() };
}

/** Tablas de combate mínimas con un "mejor" conocido por slot (48 ids). */
function makeCombatResources(
  attack: Record<number, number>,
  defense: Record<number, number>,
): CombatResources {
  const arr = (m: Record<number, number>): number[] =>
    Array.from({ length: 48 }, (_, i) => m[i] ?? 0);
  return {
    combatMaps: [],
    enemyDefs: [],
    attackValues: arr(attack),
    attackRangeValues: [],
    defenseValues: arr(defense),
  } as unknown as CombatResources;
}

describe("DebugApi — mutaciones directas, cero-rand", () => {
  it("teleportOverworld fija posición (con wrap) sin mover la semilla", () => {
    const { game, api, notify, seed0 } = setup();
    api.teleportOverworld(300, -1); // wrap 256×256 → (44, 255)
    expect(game.state.position).toEqual({ location: 0, floor: 0, x: 44, y: 255 });
    expect(game.liveSeed()).toBe(seed0);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("teleportOverworld underworld usa floor 0xFF", () => {
    const { game, api } = setup();
    api.teleportOverworld(10, 20, true);
    expect(game.state.position).toEqual({ location: 0, floor: 0xff, x: 10, y: 20 });
  });

  it("goToLocation entra al small map (enterMap + hydrate) sin consumir rand", () => {
    const { game, api, seed0 } = setup();
    api.goToLocation(TOWN, 1);
    expect(game.state.position).toEqual({ location: TOWN, floor: 1, x: 15, y: 30 });
    expect(game.liveSeed()).toBe(seed0);
  });

  it("goToLocation(0) vuelve al overworld conservando x/y", () => {
    const { game, api } = setup({ position: { location: TOWN, floor: 0, x: 7, y: 9 } });
    // primero al overworld necesita coords; el sentinel usa la posición actual.
    api.teleportOverworld(80, 90);
    api.goToLocation(0, 0);
    expect(game.state.position.location).toBe(0);
    expect(game.state.position.floor).toBe(0);
  });

  it("setCharacterNumber escribe el campo correcto del record", () => {
    const { game, api, seed0 } = setup();
    api.setCharacterNumber(1, "currentHp", 33);
    expect(game.state.characters[1]!.currentHp).toBe(33);
    expect(game.liveSeed()).toBe(seed0);
  });

  it("setCharacterText escribe name/class/status", () => {
    const { game, api } = setup();
    api.setCharacterText(0, "name", "Shamino");
    api.setCharacterText(0, "class", "F");
    api.setCharacterText(0, "status", "P");
    const c = game.state.characters[0]!;
    expect([c.name, c.class, c.status]).toEqual(["Shamino", "F", "P"]);
  });

  it("setEquipSlot escribe el byte del slot (enmascarado a 8 bits)", () => {
    const { game, api } = setup();
    api.setEquipSlot(0, "weapon", 0x11);
    expect(game.state.characters[0]!.weapon).toBe(0x11);
  });

  it("setResource / setFlag escriben provisiones y grapple", () => {
    const { game, api, seed0 } = setup();
    api.setResource("gold", 8803);
    api.setResource("keys", 12);
    api.setFlag("grapple", true);
    expect(game.state.gold).toBe(8803);
    expect(game.state.keys).toBe(12);
    expect(game.state.grapple).toBe(true);
    expect(game.liveSeed()).toBe(seed0);
  });

  it("setClock / setWind / setTransport escriben mundo y reloj", () => {
    const { game, api } = setup();
    api.setClock("hour", 22);
    api.setWind(3);
    api.setTransport("ship");
    expect(game.state.time.hour).toBe(22);
    expect(game.state.wind).toBe(3);
    expect(game.state.transport).toBe("ship");
  });

  it("setQuantity escribe el índice correcto del array de inventario", () => {
    const { game, api } = setup();
    api.setQuantity("reagentQuantities", 3, 9);
    api.setQuantity("equipmentQuantities", 26, 5);
    expect(game.state.reagentQuantities[3]).toBe(9);
    expect(game.state.equipmentQuantities[26]).toBe(5);
  });

  it("setQuantity ignora índices fuera de rango sin lanzar", () => {
    const { game, api } = setup();
    expect(() => api.setQuantity("reagentQuantities", 99, 1)).not.toThrow();
    expect(game.state.reagentQuantities.length).toBe(8);
  });

  it("setSpecialItem / setShard / setLbArtifact escriben los booleanos de trama", () => {
    const { game, api, seed0 } = setup();
    api.setSpecialItem("sextant", true);
    api.setShard("hatred", true);
    api.setLbArtifact("crown", true);
    expect(game.state.specialItems.sextant).toBe(true);
    expect(game.state.shards.hatred).toBe(true);
    expect(game.state.lbArtifacts.crown).toBe(true);
    expect(game.liveSeed()).toBe(seed0);
  });

  it("setMoonstoneField escribe x/y/buried/z de la moonstone indicada", () => {
    const { game, api } = setup();
    api.setMoonstoneField(2, "x", 100);
    api.setMoonstoneField(2, "y", 200);
    api.setMoonstoneField(2, "buried", true);
    api.setMoonstoneField(2, "z", 0xff);
    expect(game.state.moonstones![2]).toEqual({ x: 100, y: 200, buried: true, z: 0xff, location: 0 });
  });

  it("setQuestFlag marca/desmarca banderas libres", () => {
    const { game, api } = setup();
    api.setQuestFlag("word:33", true);
    expect(game.state.questFlags["word:33"]).toBe(true);
    api.setQuestFlag("word:33", false);
    expect(game.state.questFlags["word:33"]).toBe(false);
  });

  it("setOptionalNumber / setWorldArrayElement escriben trama numérica (inicializa arrays)", () => {
    const { game, api, seed0 } = setup();
    api.setOptionalNumber("shrineQuestBitmap", 0xab);
    expect(game.state.shrineQuestBitmap).toBe(0xab);
    api.setWorldArrayElement("shadowlordLocs", 1, 7);
    expect(game.state.shadowlordLocs).toEqual([0, 7, 0]);
    api.setWorldArrayElement("shrineDestroyed", 3, 0x80);
    expect(game.state.shrineDestroyed![3]).toBe(0x80);
    expect(game.state.shrineDestroyed!.length).toBe(8);
    expect(game.liveSeed()).toBe(seed0);
  });

  it("setCharacterNumber con gender/partyStatus escribe los bytes del record", () => {
    const { game, api } = setup();
    api.setCharacterNumber(0, "gender", 0x0c);
    api.setCharacterNumber(0, "partyStatus", 0xff);
    expect(game.state.characters[0]!.gender).toBe(0x0c);
    expect(game.state.characters[0]!.partyStatus).toBe(0xff);
  });

  it("setResource(partySize/activeCharacter) escribe los campos globales de party", () => {
    const { game, api } = setup();
    api.setResource("partySize", 4);
    api.setResource("activeCharacter", 2);
    expect(game.state.partySize).toBe(4);
    expect(game.state.activeCharacter).toBe(2);
  });

  it("maximizeAll pone party + recursos + inventario al tope (cero-rand)", () => {
    const { game, api, seed0, notify } = setup();
    api.maximizeAll();
    const s = game.state;
    for (const c of s.characters.slice(0, s.partySize)) {
      expect(c.status).toBe("G");
      // 30, no 99: cap del quirk byte-wrap (stats >35 wrapean el scheduler y los
      // umbrales del binario — re/notes/audit-byte-wrap.md; pedido del usuario).
      expect([c.strength, c.dexterity, c.intelligence]).toEqual([30, 30, 30]);
      expect(c.exp).toBe(9999);
      expect(c.level).toBe(8); // levelForExp(9999)
      expect(c.maxHp).toBe(240); // 30·8
      expect(c.currentHp).toBe(240);
      expect(c.currentMp).toBe(30); // clase 'A' → MP = INT (=30, cap byte-wrap)
    }
    expect([s.gold, s.food]).toEqual([9999, 9999]);
    expect([s.keys, s.gems, s.torches, s.skullKeys, s.magicCarpets]).toEqual([99, 99, 99, 99, 99]);
    expect(s.karma).toBe(99);
    expect(s.grapple).toBe(true);
    expect(s.equipmentQuantities.every((q) => q === 99)).toBe(true);
    expect(s.reagentQuantities.every((q) => q === 99)).toBe(true);
    expect(game.liveSeed()).toBe(seed0);
    expect(notify).toHaveBeenCalled();
  });

  it("maximizeAll otorga TODOS los ítems especiales (regalía/esquirlas/specialItems/garfio) cero-rand", () => {
    const { game, api, seed0 } = setup();
    // Precondición: nada otorgado.
    const s0 = game.state;
    expect(Object.values(s0.specialItems).every((v) => v === false)).toBe(true);
    expect(Object.values(s0.lbArtifacts).every((v) => v === false)).toBe(true);
    expect(Object.values(s0.shards).every((v) => v === false)).toBe(true);
    api.maximizeAll();
    const s = game.state;
    expect(Object.values(s.specialItems).every((v) => v === true)).toBe(true);
    expect(Object.values(s.lbArtifacts).every((v) => v === true)).toBe(true);
    expect(Object.values(s.shards).every((v) => v === true)).toBe(true);
    expect(s.grapple).toBe(true);
    expect(game.liveSeed()).toBe(seed0); // cero-rand
  });

  it("maximizeAll respeta el MP por clase (Bard=INT/2, Fighter=0)", () => {
    const { game, api } = setup({
      characters: [makeChar({ name: "Bard", class: "B", intelligence: 5 }), makeChar({ name: "Fig", class: "F" })],
      partySize: 2,
    });
    api.maximizeAll();
    expect(game.state.characters[0]!.currentMp).toBe(15); // 30>>1 (cap byte-wrap)
    expect(game.state.characters[1]!.currentMp).toBe(0); // Fighter sin MP
  });

  it("bestEquipAll equipa el mejor por slot; arma de 2 manos excluye escudo (cero-rand)", () => {
    // Mejor: helmet id3, armor id15, arma id34 (type 0x30 = 2 manos) → escudo vacío,
    // ring id44, amulet id47. defenseValues altos en esos slots; ataque alto en id34.
    const cr = makeCombatResources({ 34: 99, 40: 40 }, { 3: 10, 15: 20, 8: 15, 44: 5, 47: 8 });
    const { game, api, seed0 } = setup({}, cr);
    api.bestEquipAll();
    const c = game.state.characters[0]!;
    expect(c.helmet).toBe(3);
    expect(c.armor).toBe(15);
    expect(c.weapon).toBe(34);
    expect(c.shield).toBe(EQUIPMENT_NOTHING); // arma de 2 manos ocupa ambas
    expect(c.ring).toBe(44);
    expect(c.amulet).toBe(47);
    // Stock garantizado del ítem equipado.
    expect(game.state.equipmentQuantities[34]).toBeGreaterThanOrEqual(1);
    expect(game.liveSeed()).toBe(seed0);
  });

  it("bestEquipAll con arma de 1 mano SÍ equipa escudo", () => {
    const cr = makeCombatResources({ 40: 40 }, { 8: 15 }); // id40 = type 0x20 (1 mano)
    const { game, api } = setup({}, cr);
    api.bestEquipAll();
    const c = game.state.characters[0]!;
    expect(c.weapon).toBe(40);
    expect(c.shield).toBe(8);
  });

  it("bestEquipAll sin tablas de combate es no-op inofensivo (cero-rand)", () => {
    const { game, api, seed0 } = setup(); // sin combatResources
    const before = { ...game.state.characters[0]! };
    api.bestEquipAll();
    expect(game.state.characters[0]!.weapon).toBe(before.weapon);
    expect(game.liveSeed()).toBe(seed0);
  });

  it("maxPartyAll llena el party con miembros reales del roster y los maximiza (cero-rand)", () => {
    const roster = Array.from({ length: 6 }, (_, i) => makeChar({ name: `M${i}`, partyStatus: 0xff }));
    const cr = makeCombatResources({ 34: 99 }, { 15: 20 });
    const { game, api, seed0 } = setup({ characters: roster, partySize: 1 }, cr);
    api.maxPartyAll();
    const s = game.state;
    expect(s.partySize).toBe(6); // llenó a los 6 reales
    for (const c of s.characters) {
      expect(c.partyStatus).toBe(0); // en party
      expect(c.level).toBe(8);
      expect(c.weapon).toBe(34); // mejor arma
    }
    expect(game.liveSeed()).toBe(seed0);
  });

  it("killShadowlords marca los 3 flags shadowlord-dead y habilita endgame con regalía (cero-rand)", () => {
    const { game, api, seed0, notify } = setup();
    // La regalía es la OTRA condición de endgameReady; la ponemos para probar el gate.
    game.state.lbArtifacts = { amulet: true, crown: true, sceptre: true };
    expect(endgameReady(game.state)).toBe(false); // Shadowlords aún vivos
    api.killShadowlords();
    for (const which of SHADOWLORDS) {
      expect(game.state.questFlags[shadowlordDeadFlag(which)]).toBe(true);
    }
    expect(canReachDoom(game.state)).toBe(true);
    expect(endgameReady(game.state)).toBe(true); // los 3 muertos + regalía ⇒ endgame listo
    expect(game.liveSeed()).toBe(seed0); // cero-rand
    expect(notify).toHaveBeenCalled();
  });

  it("killShadowlords NO habilita endgame sin la regalía (sólo pone los flags de historia)", () => {
    const { game, api } = setup(); // lbArtifacts todos false por defecto
    api.killShadowlords();
    expect(canReachDoom(game.state)).toBe(true);
    expect(endgameReady(game.state)).toBe(false); // falta la regalía
  });

  it("editor de save: transportes / runtime / NPC / salas / blackthorn escriben el campo correcto (cero-rand)", () => {
    const { game, api, seed0 } = setup();
    api.setTransportTile(0x12);
    api.setShipField("shipHull", 77);
    api.setShipField("hmsCapeToggle", 1);
    api.setTimeSpell("Q");
    api.setRuntimeNumber("lightSpellMins", 40);
    api.setNpcFlag("dead", 5, 3, true);
    api.setNpcFlag("met", 5, 3, true);
    api.setDungeonRoomCleared(2, 9, true);
    expect(game.state.transportTile).toBe(0x12);
    expect(game.state.shipHull).toBe(77);
    expect(game.state.hmsCapeToggle).toBe(1);
    expect(game.state.timeSpell).toBe("Q");
    expect(game.state.lightSpellMins).toBe(40);
    expect(game.state.npcDead[5]![3]).toBe(true);
    expect(game.state.npcMet[5]![3]).toBe(true);
    // dungIdx 2, room 9 → bit (2<<4)+9 = 41 → byte 5, bit 1.
    expect(game.state.dungeonRoomsCleared![5]! & (1 << 1)).toBe(1 << 1);
    expect(game.liveSeed()).toBe(seed0);
  });

  it("setTimeSpell('') limpia el efecto; setDungeonRoomCleared(false) apaga el bit", () => {
    const { game, api } = setup();
    api.setTimeSpell("P");
    expect(game.state.timeSpell).toBe("P");
    api.setTimeSpell("");
    expect(game.state.timeSpell).toBeUndefined();
    api.setDungeonRoomCleared(0, 4, true);
    expect(game.state.dungeonRoomsCleared![0]! & (1 << 4)).toBe(1 << 4);
    api.setDungeonRoomCleared(0, 4, false);
    expect(game.state.dungeonRoomsCleared![0]! & (1 << 4)).toBe(0);
  });

  it("clearOverworldEnemies vacía el pool (cero-rand)", () => {
    const { game, api, seed0 } = setup({ overworldEnemies: [{ defIndex: 1, tile: 0x140, water: false, x: 1, y: 2 }] as never });
    api.clearOverworldEnemies();
    expect(game.state.overworldEnemies).toEqual([]);
    expect(game.liveSeed()).toBe(seed0);
  });

  it("BARRIDO cero-rand: NINGUNA operación del API mueve g_rng_seed", () => {
    const { game, api, seed0 } = setup();
    api.teleportOverworld(12, 34);
    expect(game.liveSeed()).toBe(seed0);
    api.teleportOverworld(1, 2, true);
    expect(game.liveSeed()).toBe(seed0);
    api.goToLocation(TOWN, 0);
    expect(game.liveSeed()).toBe(seed0);
    api.goToLocation(0, 0);
    expect(game.liveSeed()).toBe(seed0);
    api.setPosition(0, 0, 5, 6);
    api.setCharacterNumber(0, "strength", 50);
    api.setCharacterNumber(0, "level", 8);
    api.setCharacterText(0, "status", "S");
    api.setEquipSlot(0, "helmet", 4);
    api.setResource("gold", 999);
    api.setFlag("grapple", true);
    api.setClock("minute", 59);
    api.setWind(4);
    api.setTransport("horse");
    api.setQuantity("spellQuantities", 10, 3);
    api.setSpecialItem("spyglass", true);
    api.setShard("cowardice", true);
    api.setLbArtifact("sceptre", true);
    api.setMoonstoneField(0, "buried", true);
    api.setQuestFlag("dbg:test", true);
    api.setOptionalNumber("shadowlordDoomBits", 8);
    api.setWorldArrayElement("shrineDestroyed", 0, 0x80);
    api.setCharacterNumber(0, "gender", 0x0c);
    api.setResource("partySize", 3);
    api.killShadowlords();
    api.setTransportTile(0x1c);
    api.setShipField("sailDir", 2);
    api.setTimeSpell("N");
    api.setRuntimeNumber("prevHour", 5);
    api.setNpcFlag("met", 0, 0, true);
    api.setDungeonRoomCleared(6, 15, true);
    api.clearOverworldEnemies();
    expect(game.liveSeed()).toBe(seed0);
  });
});

/** Mazmorra mínima: 8 plantas 8×8 de pasillo, sin escaleras (entrada por defecto (1,1)). */
function makeDungeon(location: number, name: string) {
  const floors = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ type: 0, sub: 0 }))),
  );
  return { location, name, floors };
}

function makeGameWithDungeons(s: GameState) {
  return new Game({} as ExtractedInitialState, makeWorld(), gameData, s, {
    npcManager: new NpcManager({}),
    dungeons: [makeDungeon(33, "Deceit"), makeDungeon(40, "Doom")],
  });
}

describe("DebugApi — selector de mapa (teleportSmallMap / teleportDungeon)", () => {
  it("teleportSmallMap aterriza en la celda EXACTA (enterMap+hydrate) sin mover la semilla", () => {
    const game = makeGame(makeState());
    game.reseed(0x4d2);
    const seed0 = game.liveSeed();
    const notify = vi.fn();
    const api = createDebugApi(game, notify);
    api.teleportSmallMap(TOWN, 1, 20, 25);
    expect(game.state.position).toEqual({ location: TOWN, floor: 1, x: 20, y: 25 });
    expect(game.liveSeed()).toBe(seed0); // cero-rand: misma receta determinista que goToLocation
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("teleportSmallMap(0,…) delega en el overworld (floor 0xFF si underworld)", () => {
    const game = makeGame(makeState());
    const api = createDebugApi(game, vi.fn());
    api.teleportSmallMap(0, 0xff, 12, 34);
    expect(game.state.position).toEqual({ location: 0, floor: 0xff, x: 12, y: 34 });
  });

  it("teleportDungeon entra y reubica la party a (floor,x,y) exactos", () => {
    const game = makeGameWithDungeons(makeState());
    const api = createDebugApi(game, vi.fn());
    api.teleportDungeon(33, 3, 5, 6);
    expect(game.dungeonState).not.toBeNull();
    expect(game.dungeonState!.pos.dungeon).toBe(33);
    expect(game.dungeonState!.pos.floor).toBe(3);
    expect(game.dungeonState!.pos.x).toBe(5);
    expect(game.dungeonState!.pos.y).toBe(6);
  });

  it("teleportDungeon dentro de la MISMA mazmorra no re-entra (conserva facing)", () => {
    const game = makeGameWithDungeons(makeState());
    const api = createDebugApi(game, vi.fn());
    api.teleportDungeon(33, 0, 1, 1);
    game.dungeonState!.pos.facing = "north";
    api.teleportDungeon(33, 7, 4, 4); // misma mazmorra: sólo mueve pos
    expect(game.dungeonState!.pos.facing).toBe("north");
    expect(game.dungeonState!.pos).toMatchObject({ dungeon: 33, floor: 7, x: 4, y: 4 });
  });
});

describe("shortcuts — helpers puros", () => {
  it("maxMpForClass sigue la regla de campHoleUp por clase", () => {
    expect(maxMpForClass("A", 30)).toBe(30);
    expect(maxMpForClass("M", 42)).toBe(42);
    expect(maxMpForClass("B", 31)).toBe(15); // 31>>1
    expect(maxMpForClass("F", 99)).toBe(0);
    expect(maxMpForClass("S", 99)).toBe(0);
  });

  it("fillablePartySize cuenta records reales contiguos (tope 6, mín 1)", () => {
    const named = (n: number) => makeChar({ name: n ? "x" : "" });
    expect(fillablePartySize([named(1), named(1), named(0), named(1)])).toBe(2);
    expect(fillablePartySize(Array.from({ length: 8 }, () => named(1)))).toBe(6); // tope 6
    expect(fillablePartySize([named(0)])).toBe(1); // mín 1 (siempre el Avatar)
  });

  it("bestGearFromData sin tablas devuelve todo vacío (no desequipa a ciegas)", () => {
    const g = bestGearFromData({});
    expect([g.helmet, g.armor, g.weapon, g.shield, g.ring, g.amulet]).toEqual(
      Array(6).fill(EQUIPMENT_NOTHING),
    );
  });
});
