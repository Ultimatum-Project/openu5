/**
 * #170 · GUARDA DE CABECERA de `talk_to_npc` (TALK.OVL CS:0x00ed) — el mercader no
 * atiende A CABALLO. Candidato vivo del censo del género de #129.
 *
 * EL ORIGINAL, literal, tras el prólogo:
 *
 *   00e6: 55            push bp
 *   00e9: 83ec04        sub sp, 4
 *   00ed: a07c58        mov al, byte ptr [g_transport_tile]   ; DS:0x587C
 *   00f0: 24fe          and al, 0xfe
 *   00f2: 3c12          cmp al, 0x12                 ; ← MONTADO (0x12/0x13) y nada más
 *   00f4: 7512          jne 0x108                    ; no montado → conversación normal
 *   00f6: 817e048300    cmp word ptr [bp + 4], 0x83  ; ← EXCEPCIÓN por dialogNumber
 *   00fb: 740b          je 0x108                     ; HorseSeller → conversación normal
 *   00fd: b87290        mov ax, 0x9072               ; DATA.OVL file 0x9082 =
 *   0100: 50            push ax                      ;   b'A merchant says:\n"GET THAT
 *   0101: e8cc57        call 0x58d0                  ;      HORSE OUT OF HERE!"\n'
 *   0104: e9d300        jmp 0x1da                    ; ABORTA (salta al epílogo)
 *
 * ★ SÓLO MERCADERES — el dato que decide dónde va la guarda. `talk_to_npc` NO es la
 * rutina de todos los NPC: el despachador bifurca antes en `CS:0x0396`
 * (`cmp word ptr [bp-2],0x80 / jge 0x3a6`), y con dialogNumber < 0x80 se va a
 * `CS:0x03a0 call 0x127e` = el intérprete de scripts TLK, que nunca pasa por 0x00e6.
 * Sólo la familia >= 0x80 llega al `CS:0x0401 call 0xe6`. Por eso el mensaje dice
 * «A merchant says», y por eso cablear la guarda a la cabeza del (T)alk gatearía a
 * TODOS los aldeanos del juego — una divergencia inventada, no un calco.
 *
 * ★ MONTADO ≠ CABALLO. `and 0xfe / cmp 0x12` = 0x12-0x13. En este byte 0x10/0x11 es el
 * caballo DEL MUNDO (sin jinete) y 0x12/0x13 el party a lomos (transport.ts lo documenta
 * desde antes). Usar `isHorse()` (0x10-0x13) sería la sobre-captura que arrastró la seña
 * de #129; de ahí `isMounted()`, con el mismo mask del binario.
 *
 * LA EXCEPCIÓN 0x83 = HorseSeller (SHOP_TYPES de main.ts). Coherente: al tratante de
 * caballos se llega a caballo, que es lo que vas a venderle.
 */
import { describe, expect, it } from "vitest";
import { Game, type GameData, type GameSystems } from "../src/core/game.js";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { DoorManager } from "../src/core/world/doors.js";

const TOWN = 2;
const SMALL = 32;
const FLOOR_TILE = 68; // 0x44 BrickFloor
const NPC_X = 5;
const NPC_Y = 5;
const REFUSAL = 'A merchant says:\n"GET THAT HORSE OUT OF HERE!"\n';

/** Los 8 de la familia (SHOP_TYPES), con su tipo de tienda para el nombre del caso. */
const MERCHANTS: ReadonlyArray<readonly [number, string]> = [
  [0x81, "Blacksmith"],
  [0x82, "Barkeeper"],
  [0x84, "Shipwright"],
  [0x85, "MagicSeller"],
  [0x86, "GuildMaster"],
  [0x87, "Healer"],
  [0x88, "InnKeeper"],
];
const HORSE_SELLER = 0x83;

function makeChar(): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20, currentMp: 10, currentHp: 50, maxHp: 60,
    exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  };
}

function makeState(transportTile: number | undefined): GameState {
  return {
    version: 1, characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 100, keys: 5, gems: 0, torches: 2, karma: 50, skullKeys: 0,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0,
    position: { location: TOWN, floor: 0, x: NPC_X, y: NPC_Y + 1 }, // al SUR del NPC
    transport: "foot", transportTile, torchTurns: 0,
    questFlags: {}, journal: [], worldObjects: [],
    npcDead: Array.from({ length: 32 }, () => [] as boolean[]),
    npcMet: Array.from({ length: 32 }, () => [] as boolean[]),
    equipmentQuantities: new Array(48).fill(0),
    spellQuantities: new Array(48).fill(0),
    scrollQuantities: new Array(8).fill(0),
    potionQuantities: new Array(8).fill(0),
    reagentQuantities: new Array(8).fill(0),
  } as unknown as GameState;
}

function world(): WorldData {
  const tiles = Array.from({ length: SMALL }, () => Array.from({ length: SMALL }, () => FLOOR_TILE));
  const map: SmallMapLocation = { id: TOWN, name: "TestTown", floors: [{ z: 0, tiles }] };
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => FLOOR_TILE));
  return { overworld, underworld: overworld, smallMaps: new Map([[TOWN, map]]) };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
  searchObjects: [],
};

/** Un NPC con `dialogNumber` en (5,5); el party mira al NORTE hacia él. */
function makeGame(transportTile: number | undefined, dialogNumber: number): Game {
  const slot: NpcSlot = {
    slot: 3,
    aiTypes: [0, 0, 0],
    x: [NPC_X, NPC_X, NPC_X], y: [NPC_Y, NPC_Y, NPC_Y], z: [0, 0, 0],
    times: [0, 8, 16, 24],
    type: 0x54, // el tipo real de la familia de mercaderes en npcs.json
    dialogNumber,
  };
  const state = makeState(transportTile);
  const npcManager = new NpcManager({ [TOWN]: [slot] });
  const systems: GameSystems = { npcManager, doors: new DoorManager() };
  const g = new Game({} as ExtractedInitialState, world(), gameData, state, systems);
  npcManager.enterMap(TOWN, state);
  return g;
}
const texts = (evs: ReturnType<Game["tryTalkMountedMerchant"]>): string[] =>
  (evs ?? []).filter((e) => e.kind === "message").map((e) => (e as { text: string }).text);

describe("#170 · el mercader no atiende a caballo (TALK.OVL CS:0x00ed)", () => {
  // POSITIVOS: montado (los DOS rumbos) × los 7 mercaderes que NO son el tratante.
  for (const tile of [0x12, 0x13]) {
    for (const [dlg, name] of MERCHANTS) {
      it(`montado 0x${tile.toString(16)} × ${name} (0x${dlg.toString(16)}) → rechaza`, () => {
        const g = makeGame(tile, dlg);
        expect(texts(g.tryTalkMountedMerchant("north"))).toEqual([REFUSAL]);
      });
    }
  }

  it("★ LA EXCEPCIÓN: montado × HorseSeller (0x83) → NO rechaza (CS:0x00f6)", () => {
    for (const tile of [0x12, 0x13]) {
      expect(makeGame(tile, HORSE_SELLER).tryTalkMountedMerchant("north")).toBeNull();
    }
  });

  // NEGATIVOS de TRANSPORTE — el gate es `and 0xfe / cmp 0x12`, no «es caballo».
  it("a pie (0x1C) → no rechaza", () => {
    expect(makeGame(0x1c, 0x81).tryTalkMountedMerchant("north")).toBeNull();
  });
  it("★ caballo DEL MUNDO sin jinete (0x10/0x11) → NO rechaza — `isHorse` los cogería", () => {
    for (const tile of [0x10, 0x11]) {
      expect(makeGame(tile, 0x81).tryTalkMountedMerchant("north")).toBeNull();
    }
  });
  it("alfombra (0x14/0x15) y fragata (0x20) → no rechazan: el gate es de CABALLO", () => {
    for (const tile of [0x14, 0x15, 0x20]) {
      expect(makeGame(tile, 0x81).tryTalkMountedMerchant("north")).toBeNull();
    }
  });
  it("sin transportTile (undefined) → no rechaza (default a pie)", () => {
    expect(makeGame(undefined, 0x81).tryTalkMountedMerchant("north")).toBeNull();
  });

  // NEGATIVOS de FAMILIA — el `jge 0x80` de CS:0x0396 deja fuera a los NPC con script TLK.
  it("★ montado × ALDEANO normal (dialogNumber < 0x80) → NO rechaza", () => {
    // Es el control que impide colocar la guarda a la cabeza del (T)alk: si estuviera
    // ahí, cualquier vecino del juego echaría al jugador por ir a caballo.
    for (const dlg of [0, 1, 12, 33, 0x7f]) {
      expect(makeGame(0x12, dlg).tryTalkMountedMerchant("north")).toBeNull();
    }
  });
  it("montado × poseído (0xFD/0xFE) y guardia (0xFF) → no rechaza: tienen handler propio", () => {
    for (const dlg of [0xfd, 0xfe, 0xff]) {
      expect(makeGame(0x12, dlg).tryTalkMountedMerchant("north")).toBeNull();
    }
  });

  it("sin NPC en la casilla apuntada → no rechaza", () => {
    expect(makeGame(0x12, 0x81).tryTalkMountedMerchant("south")).toBeNull();
  });
});
