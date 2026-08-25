/**
 * #140 · Los planos del HMS Cape: la rama `quality == 0xFF` de get_special_item.
 *
 * EL DEFECTO (escisión del ítem 4 de #133, mismo género): `apply_item_grant`
 * (SJOG 0x1458) despacha el id 4 por la jump-table `cs:[bx-0x2962]` y aterriza en
 * 0x15C6, que abre con `cmp word ptr [bp+6], 0xff`. El port sólo portó el destino
 * del `jne` (0x15DC, «A scroll: <runa>»), así que con quality 0xFF emitía
 * «A scroll: AT!» (0xff & 7 = 7) y NO concedía nada.
 *
 * LA RAMA QUE FALTABA (SJOG 0x15C6-0x15D9), leída byte a byte:
 *   15c6: cmp word ptr [bp + 6], 0xff
 *   15cb: jne 0x15dc                    ← lo único que estaba portado
 *   15cd: mov ax, 0x8cc2 ; push ; call 0x58d0   ← DS 0x8CC2
 *   15d4: mov byte ptr [g_hms_cape], 0xff       ← EL FLAG DE TRAMA
 *   15d9: jmp 0x177a
 * DS 0x8CC2 leído de DATA.OVL (fileoff = DS+0x10) = «The plans for the HMS Cape!\n»,
 * byte a byte. El port emite la forma SIN el \n final, como el resto de
 * `lootItemName` (el salto lo pone el impresor; ver #108).
 *
 * ALCANZABILIDAD: UN solo objeto del juego, `data.json searchObjects[12]` =
 * {id:4, quality:255, location:21, floor:0, x:15, y:2} — East Britanny (The Oaken
 * Oar), en una fila de estanterías donde los índices 88/89/90 son pergaminos
 * normales (quality 1) en (13,2)/(14,2)/(16,2). Antes de este fix el flag
 * `specialItems.hmsCape` era un CONSUMIDOR ENTERO SIN PRODUCTOR: sólo entraba
 * cargando un .GAM.
 *
 * ⚠ EL VALOR TIENE QUE LLEGAR (lección de #133/#130): `applySearchGrant` recibe el
 * `quality` crudo y el call-site del (G)et nombra con `quality`, no con el retorno
 * del grant — si no, la rama nueva sería INALCANZABLE. Por eso hay un test por cada
 * lado: el nombre (lootItemName) y el grant (applySearchGrant), más el ciclo entero
 * a nivel Game, que es el único que prueba que los dos están cableados al mismo valor.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState, WorldObject } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import { lootItemName } from "../src/core/world/commands.js";
import { applySearchGrant, type SearchObject } from "../src/core/world/search.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";

const OAKEN_OAR = 21; // East Britanny — location de searchObjects[12]
const SHELF = 0x5a; // tile «shelf»: prosa de mueble «\nOn the shelf\nthou dost find\n»
const PLANS_TILE = 0x104; // id 4 + 0x100 (SEARCH_ID_TILE_OFFSET)

/** La entrada REAL del juego, copiada de game/assets/data.json searchObjects[12]. */
const PLANS_ENTRY: SearchObject = { id: 4, quality: 255, location: OAKEN_OAR, floor: 0, x: 15, y: 2 };
/** Un pergamino NORMAL de la misma estantería (searchObjects[90]) — control positivo. */
const SCROLL_ENTRY: SearchObject = { id: 4, quality: 1, location: OAKEN_OAR, floor: 0, x: 16, y: 2 };

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
    food: 100, gold: 1000, keys: 0, gems: 0, torches: 2, karma: 50, skullKeys: 0,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: OAKEN_OAR, floor: 0, x: 15, y: 3 }, // al SUR de la estantería (15,2)
    transport: "foot", torchTurns: 0,
    questFlags: {}, journal: [], worldObjects: [],
    equipmentQuantities: new Array(48).fill(0),
    spellQuantities: new Array(48).fill(0),
    scrollQuantities: new Array(8).fill(0),
    potionQuantities: new Array(8).fill(0),
    reagentQuantities: new Array(8).fill(0),
    specialItems: {
      grapple: false, magicCarpet: false, spyglass: false, hmsCape: false,
      pocketWatch: false, blackBadge: false, woodenBox: false, sextant: false,
    } as GameState["specialItems"],
  };
  return { ...base, ...over } as GameState;
}

function oakenOarWorld(): WorldData {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  tiles[2]![15] = SHELF; // [y][x]: la estantería de los planos en (15,2)
  tiles[2]![16] = SHELF; // la del pergamino normal, control
  const loc: SmallMapLocation = { id: OAKEN_OAR, name: "East Britanny", floors: [{ z: 0, tiles }] };
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return { overworld, underworld: overworld, smallMaps: new Map([[OAKEN_OAR, loc]]) };
}

/** Tabla con los planos en el índice 12 (el REAL) y el pergamino de control en el 90. */
function searchTable(): SearchObject[] {
  const filler = (i: number): SearchObject => ({ id: 2, quality: 1, location: 99, floor: 9, x: i, y: i });
  const table: SearchObject[] = Array.from({ length: 113 }, (_, i) => filler(i));
  table[12] = PLANS_ENTRY;
  table[90] = SCROLL_ENTRY;
  return table;
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
  searchObjects: searchTable(),
};

const makeGame = (s: GameState): Game => new Game({} as ExtractedInitialState, oakenOarWorld(), gameData, s);

const searchObjAt = (g: Game, x: number, y: number): WorldObject | undefined =>
  g.state.worldObjects?.find((o) => o.kind === "search" && o.x === x && o.y === y);

const messages = (evs: ReturnType<Game["get"]>): string[] =>
  evs.filter((e) => e.kind === "message").map((e) => (e as { text: string }).text);

describe("#140 · HMS Cape: la rama 0xFF de get_special_item (SJOG 0x15C6)", () => {
  describe("(a) el NOMBRE — lootItemName, lado alto del cmp de 0x15c6", () => {
    it("quality 0xFF da el mensaje verbatim de DS 0x8CC2, no «A scroll: AT!»", () => {
      expect(lootItemName(4, 0xff)).toBe("The plans for the HMS Cape!");
    });

    it("CONTROL POSITIVO: el lado bajo del cmp sigue intacto (pergamino normal)", () => {
      // Los 20 id-4 restantes de la tabla llevan quality 1..7 → rama 0x15DC.
      expect(lootItemName(4, 1)).toBe("A scroll: RH!"); // 0x41AC[1]
      expect(lootItemName(4, 7)).toBe("A scroll: AT!"); // 0x41AC[7] — el que salía MAL con 0xFF
    });
  });

  describe("(b) el GRANT — applySearchGrant, `mov byte [g_hms_cape], 0xff` (0x15d4)", () => {
    it("id 4 + quality 0xFF pone specialItems.hmsCape", () => {
      const s = makeState();
      applySearchGrant(s, { id: 4, quality: 0xff });
      expect(s.specialItems.hmsCape).toBe(true);
    });

    it("CONTROL POSITIVO: un pergamino normal NO toca el flag de trama", () => {
      const s = makeState();
      applySearchGrant(s, { id: 4, quality: 1 });
      expect(s.specialItems.hmsCape).toBe(false);
    });
  });

  describe("(c) el CICLO ENTERO a nivel Game — que el valor LLEGA sin enmascarar", () => {
    it("Search + Get sobre searchObjects[12] concede los planos Y los nombra", () => {
      const g = makeGame(makeState());
      g.search("north"); // party (15,3) → estantería (15,2)
      const obj = searchObjAt(g, 15, 2);
      expect(obj).toBeDefined();
      expect(obj!.search).toMatchObject({ id: 4, quality: 0xff });
      expect(g.state.specialItems.hmsCape).toBe(false); // nada hasta el (G)et

      const evs = g.get("north");
      expect(g.state.specialItems.hmsCape).toBe(true); // 0x15d4
      expect(messages(evs)).toContain("The plans for the HMS Cape!"); // 0x15cd, DS 0x8CC2
      expect(searchObjAt(g, 15, 2)).toBeUndefined(); // objeto retirado de la casilla
    });

    it("CONTROL POSITIVO: la estantería de al lado da pergamino y NO planos", () => {
      const s = makeState();
      s.position = { location: OAKEN_OAR, floor: 0, x: 16, y: 3 };
      const g = makeGame(s);
      g.search("north"); // → (16,2), searchObjects[90], quality 1
      const evs = g.get("north");
      expect(g.state.specialItems.hmsCape).toBe(false);
      expect(messages(evs)).toContain("A scroll: RH!");
    });
  });
});
