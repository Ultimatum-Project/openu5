/**
 * #148 · CEPO/GRILLETES: la tercera familia del (J)immy (SJOG 0x0D4A).
 *
 * El (J)immy del binario despacha TRES familias por el tile apuntado (0x0daa-0x0dc4):
 * puertas 0xB9/0xBB (→0x0DC8), cerraduras mágicas 0x97/0x98 (→0x0E1C) y CEPO/GRILLETES
 * 0x84/0x85 (→0x0E22), que libera a un PRISIONERO. El port TENÍA la lógica
 * (`jimmyLock` case "prisoner", derivada y citada) pero la rama estaba MUERTA:
 * `Game.jimmy()` sólo despachaba 'door'/'magic' y Stocks/Manacles caían al «No lock!».
 *
 * CABLEARLA A PELO FABRICA KARMA Y TIRADAS. El binario tiene DOS gates que el port no
 * implementaba, más un tercero que la tarjeta dejaba abierto y aquí queda derivado:
 *
 *  (1) OCUPANTE — 0x0E22-0x0E3F. `cmp [g_location],0x80 / jae 0xe42` SALTA el chequeo en
 *      mazmorra; en pueblo llama `0x770e(x, y, floor)` y si devuelve 0 imprime
 *      «No one is there!\n» (DS 0x8AFE) y RETORNA por 0x0d70 — sin tirar el dado
 *      (0x0e54 aún no ha corrido) y sin tocar g_keys.
 *      0x770e = ULTIMA.EXE 0x368E: barre g_world_objects (0x5C5A, stride 8, 32 slots)
 *      buscando x/y/z, y ★ ESCRIBE EL ÍNDICE DE SLOT ENCONTRADO en g_cmb_scratch_x
 *      (0x5876, `mov [0x5876],dx` @0x36D8) — que es el valor que 0x0E42 recoge en [bp-2]
 *      y le pasa después al resolutor de NPC. Sin ese out-param el flujo no se entiende.
 *
 *  (2) RESOLUCIÓN DEL NPC — 0x0E7D-0x0E8C. Sólo en pueblo (0x0E76 `cmp [g_location],0x7f`
 *      / jae → rama mazmorra). `call 0xffffbb9e` = stub kernel 0x7B1E → TOWN.OVL 0x011E
 *      `find_npc_by_objIdx` (resuelto con re/tools/verify_cites.py + dispatch_table.stubs;
 *      SJOG es banda 3, near_call_base 0xBF80). Si devuelve 0xFFFF imprime
 *      «Couldn't find this npc\n\n» (DS 0x8B1C) y RETORNA SIN KARMA.
 *
 *  (3) EL GATE QUE LA TARJETA DEJABA ABIERTO — 0x0EA7 `call 0xffffbb7a` = stub 0x7AFA →
 *      TOWN.OVL 0x0000 = `npc_dead_bit_test` (ya VERIFICADA cuerpo a cuerpo en
 *      re/ledger/frontier.json): mira el bit `1 << slot` de la máscara de 32 bits
 *      [0x5B56 + g_location*4] = el bitmap npcDead (SAVED.GAM 0x5B4). Si el bit YA está
 *      puesto (`jne 0xeda`) se SALTA el agradecimiento, el karma y los tres bytes de
 *      horario — es el anti-farmeo. Y en AMBOS caminos 0x0EDD llama a `0xffffbb86` =
 *      TOWN.OVL 0x0052 `npc_dead_bit_set`, que CONSUME el slot.
 *      CONTROL POSITIVO de que ese par es el bitmap npcDead y no otra cosa: la rama de la
 *      CORONA (SJOG 0x16E6) usa exactamente las mismas dos llamadas para retirar su slot
 *      del .NPC tras el (G)et.
 *
 * EFECTO POR LOCALIZACIÓN (0x0E76): `cmp [g_location],0x7f` / jae → 0x0EE4 escribe tile
 * 0x44 y «Unlocked!\n» (DS 0x8B48) + `or [g_unk_24e6],2` (turno consumido); si no, libera
 * al NPC. ★ Los dos umbrales NO son el mismo: el ocupante usa 0x80 y el efecto 0x7F.
 *
 * TURNO: la rama de mazmorra marca turno consumido (0x0EF2) y la de PUEBLO **no** — en
 * 0x0E90-0x0EDD no hay ningún `or [g_unk_24e6],2`. El fallo tampoco (igual que la puerta).
 *
 * RNG: `rand(0,29)` @0x0E54, UNA tirada, en pueblo y en mazmorra por igual (el gate de
 * 0x0E22 sólo se salta el chequeo de ocupante, no la tirada). Antes de este fix el port
 * consumía CERO en estos tiles.
 */
import { describe, expect, it } from "vitest";
import { Game, type GameData, type GameSystems } from "../src/core/game.js";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { DoorManager } from "../src/core/world/doors.js";

const TOWN = 2;
const DUNGEON_LOC = 0x81; // >= 0x80: salta el ocupante Y toma la rama de tile 0x44
const SMALL = 32;
const FLOOR_TILE = 68; // 0x44 BrickFloor, transitable
const STOCKS = 0x84;
const MANACLES = 0x85;
const PRISONER_SLOT = 3;

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20, currentMp: 10, currentHp: 50, maxHp: 60,
    exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    version: 1, characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 100, keys: 5, gems: 0, torches: 2, karma: 50, skullKeys: 0,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0,
    position: { location: TOWN, floor: 0, x: 5, y: 6 }, // al SUR del cepo (5,5)
    transport: "foot", torchTurns: 0,
    questFlags: {}, journal: [], worldObjects: [],
    npcDead: Array.from({ length: 32 }, () => [] as boolean[]),
    npcMet: Array.from({ length: 32 }, () => [] as boolean[]),
    equipmentQuantities: new Array(48).fill(0),
    spellQuantities: new Array(48).fill(0),
    scrollQuantities: new Array(8).fill(0),
    potionQuantities: new Array(8).fill(0),
    reagentQuantities: new Array(8).fill(0),
  };
  return { ...base, ...over } as GameState;
}

/** Mundo con el cepo en (5,5) de `loc`. */
function worldWith(loc: number, tile = STOCKS): WorldData {
  const tiles = Array.from({ length: SMALL }, () => Array.from({ length: SMALL }, () => FLOOR_TILE));
  tiles[5]![5] = tile;
  const map: SmallMapLocation = { id: loc, name: `Loc${loc}`, floors: [{ z: 0, tiles }] };
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => FLOOR_TILE));
  return { overworld, underworld: overworld, smallMaps: new Map([[loc, map]]) };
}

/** Un prisionero EN la casilla del cepo, con dialogNumber != 0 (el campo de #130). */
function prisonerSlots(): Record<number, NpcSlot[]> {
  const slot: NpcSlot = {
    slot: PRISONER_SLOT,
    aiTypes: [0, 0, 0],
    x: [5, 5, 5], y: [5, 5, 5], z: [0, 0, 0],
    times: [0, 8, 16, 24],
    type: 0x40, // persona (>= 0x40: el gate de tipo de npc_dead_bit_test @TOWN 0x0007)
    dialogNumber: 33,
  };
  return { [TOWN]: [slot] };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
  searchObjects: [],
};

function makeGame(s: GameState, opts: { npcs?: boolean; loc?: number; tile?: number } = {}): Game {
  const loc = opts.loc ?? TOWN;
  const npcManager = new NpcManager(opts.npcs === false ? {} : prisonerSlots());
  const systems: GameSystems = { npcManager, doors: new DoorManager() };
  const g = new Game({} as ExtractedInitialState, worldWith(loc, opts.tile), gameData, s, systems);
  npcManager.enterMap(loc, s);
  return g;
}

const msgs = (evs: ReturnType<Game["jimmy"]>): string[] =>
  evs.filter((e) => e.kind === "message").map((e) => (e as { text: string }).text);

describe("#148 · (J)immy sobre cepo/grilletes (SJOG 0x0E22)", () => {
  it("los tiles 0x84/0x85 ya NO caen al «No lock!» — la familia está viva", () => {
    for (const tile of [STOCKS, MANACLES]) {
      const g = makeGame(makeState(), { tile });
      expect(msgs(g.jimmy("north"))).not.toContain("No lock!\n");
    }
  });

  describe("GATE 1 — ocupante (0x770e / ULTIMA.EXE 0x368E)", () => {
    it("cepo VACÍO en pueblo: «No one is there!», sin gastar llave y SIN tirar el dado", () => {
      const s = makeState();
      const g = makeGame(s, { npcs: false }); // nadie en (5,5)
      const before = g.liveSeed();

      const evs = g.jimmy("north");

      expect(msgs(evs)).toContain("No one is there!\n"); // DS 0x8AFE
      expect(s.keys).toBe(5); // 0x0E3F retorna por 0x0d70: NO pasa por el `dec [g_keys]`
      expect(g.liveSeed()).toBe(before); // la tirada de 0x0E54 no llegó a correr
      expect(s.karma).toBe(50);
    });

    it("en MAZMORRA (loc >= 0x80) el chequeo se SALTA: sin ocupante sigue adelante", () => {
      // 0x0E22 `cmp [g_location],0x80 / jae 0xe42` — el cepo de mazmorra no tiene NPC.
      const s = makeState({ position: { location: DUNGEON_LOC, floor: 0, x: 5, y: 6 } });
      const g = makeGame(s, { npcs: false, loc: DUNGEON_LOC });
      expect(msgs(g.jimmy("north"))).not.toContain("No one is there!\n");
    });
  });

  describe("GATE 2 — resolución del NPC (0xffffbb9e / TOWN.OVL 0x011E)", () => {
    it("★ COLAPSA con el gate 1: en el clon un cepo sólo puede tener NPC encima", () => {
      // El binario encadena DOS consultas sobre la MISMA tabla 0x5C5A (0x770e da el slot,
      // 0x011E lo traduce a NPC); el clon parte esa tabla en `worldObjects` + NpcManager y
      // un worldObject SOBREESCRIBE el tile compuesto ⇒ una casilla con objeto encima ya no
      // lee 0x84/0x85 y ni siquiera entra al (J)immy de cepo. Este test SELLA ese hecho para
      // que nadie lea la rama de 0x0E89 como cubierta: con objeto encima el tile deja de ser
      // cepo, y sin NPC lo que sale es el mensaje del gate 1.
      const s = makeState({
        worldObjects: [
          { location: TOWN, floor: 0, x: 5, y: 5, tile: 0x101, kind: "prop" },
        ] as GameState["worldObjects"],
      });
      const g = makeGame(s, { npcs: false });
      expect(msgs(g.jimmy("north"))).toContain("No lock!\n"); // el objeto tapó el cepo

      // Y sin objeto y sin NPC: gate 1, nunca «Couldn't find this npc».
      const g2 = makeGame(makeState(), { npcs: false });
      const out = msgs(g2.jimmy("north"));
      expect(out).toContain("No one is there!\n");
      expect(out).not.toContain("Couldn't find this npc\n\n"); // DS 0x8B1C sigue sin emisor
    });
  });

  describe("GATE 3 — npc_dead_bit_test (0x0EA7 / TOWN.OVL 0x0000): anti-farmeo", () => {
    it("con el bit YA puesto hay éxito pero NI gracias NI karma (0x0EAC jne 0xeda)", () => {
      // Estado que `enterMap` normalmente impide (filtra los slots con npcDead), así que se
      // pone el bit DESPUÉS del spawn: es la vía defensiva descrita en el docblock.
      const s = makeState({ characters: [makeChar({ dexterity: 30 })] });
      const g = makeGame(s);
      (s.npcDead[TOWN - 1] ??= [])[PRISONER_SLOT] = true;

      const out = msgs(g.jimmy("north"));
      expect(out).not.toContain('\n"I thank thee!"\n');
      expect(s.karma).toBe(50); // el add_capped de 0x0ED3 queda saltado
      expect(s.npcDead[TOWN - 1]![PRISONER_SLOT]).toBe(true); // 0x0EDD marca igualmente
    });
  });

  describe("ÉXITO en pueblo — liberar al prisionero (0x0E90-0x0ED7)", () => {
    it("agradece, suma KARMA +2, limpia el dialogNumber y consume el slot", () => {
      // DEX 30 ⇒ `cmp cx,ax / ja` SIEMPRE cruza: rand(0,29) <= 29 < 30. Sin condicionales.
      const s = makeState({ characters: [makeChar({ dexterity: 30 })] });
      const g = makeGame(s);
      const npc = g.npcManager!.npcsAt(TOWN, 0)[0]!;
      expect(npc.dialogNumber).toBe(33);

      const evs = g.jimmy("north");
      // DS 0x8B36 = DATA.OVL fileoff 0x8B46 = b'\n"I thank thee!"\n' VERBATIM (#142).
      expect(msgs(evs)).toContain('\n"I thank thee!"\n');

      expect(s.karma).toBe(52); // 0x0ED3 add_capped(&g_karma, 2, 0x63)
      expect(npc.dialogNumber).toBe(0); // 0x0EA0 `mov word [si],0` — el campo de #130
      expect(s.npcDead[TOWN - 1]![PRISONER_SLOT]).toBe(true); // 0x0EDD npc_dead_bit_set
      expect(s.keys).toBe(5); // el éxito no rompe llave
    });

    it("el KARMA está capado a 0x63 (add_capped 0x7F70, no una suma cruda)", () => {
      const s = makeState({ karma: 98, characters: [makeChar({ dexterity: 30 })] });
      const g = makeGame(s);
      expect(msgs(g.jimmy("north"))).toContain('\n"I thank thee!"\n');
      expect(s.karma).toBe(99);
    });
  });

  describe("ÉXITO en mazmorra (loc >= 0x7f) — 0x0EE4", () => {
    it("pone tile 0x44 y dice «Unlocked», sin karma ni NPC", () => {
      const s = makeState({
        position: { location: DUNGEON_LOC, floor: 0, x: 5, y: 6 },
        characters: [makeChar({ dexterity: 30 })], // éxito garantizado
      });
      const g = makeGame(s, { npcs: false, loc: DUNGEON_LOC });
      expect(msgs(g.jimmy("north"))).toContain("Unlocked\n"); // DS 0x8B48
      expect(s.karma).toBe(50); // esta rama NO toca el karma
      expect(g.activeMap.tileAt(5, 5)).toBe(0x44); // 0x0EEF `mov byte [bx],0x44`
    });
  });

  describe("FALLO de la tirada (0x0E6F)", () => {
    it("«Key broke!» y −1 llave, en el MISMO tile", () => {
      // DEX 0 ⇒ `cmp cx,ax / ja` nunca cruza: rand(0,29) >= 0 siempre.
      const s = makeState({ characters: [makeChar({ dexterity: 0 })] });
      const g = makeGame(s);
      const evs = g.jimmy("north");
      expect(msgs(evs)).toContain("Key broke!\n"); // DS 0x8B10
      expect(s.keys).toBe(4);
      expect(s.karma).toBe(50);
      expect(s.npcDead[TOWN - 1]![PRISONER_SLOT]).toBeFalsy();
    });
  });

  describe("RNG — impacto de stream declarado", () => {
    it("un intento con ocupante consume EXACTAMENTE una tirada (0x0E54)", () => {
      const s = makeState({ characters: [makeChar({ dexterity: 0 })] });
      const g = makeGame(s);
      const before = g.liveSeed();
      g.jimmy("north");
      expect(g.liveSeed()).not.toBe(before);
    });
  });
});
