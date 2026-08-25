/**
 * #22 · Search deja el hallazgo VISIBLE en la casilla hasta el (G)et.
 *
 * Conducta REAL del original (observada por el usuario: la skull key dibujada junto al árbol
 * de Minoc): search_fixed_hidden_items (SJOG 0x0514) NO concede el ítem — COLOCA un objeto
 * visible en g_world_objects (call 0x7af4, 0x05bd-0x05e7) e imprime su NOMBRE
 * (print_object_name 0x12a, 0x05ef, mismo dispatcher que lootOpenLine). El grant llega con el
 * (G)et, que despacha por get_special_item 0x1458 (rama keys 0x1568: bit alto de `quality` →
 * skull keys). Este test conduce el ciclo completo a nivel Game (Search direccional → objeto
 * visible en la casilla → Get → grant + desaparece), con el árbol de Minoc como testigo.
 *
 * Citas: re/disasm/SJOG.OVL.asm 0x05bd-0x05f3 (place+name), 0x1458/0x1568 (get keys),
 * 0x0b9b (Search cae a search_fixed_hidden_items), re/notes/sjog.md §0x0514.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState, WorldObject } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import { lootItemName, lootOpenLine, POTION_COLORS } from "../src/core/world/commands.js";
import type { SearchObject } from "../src/core/world/search.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";

const MINOC = 5;
const TREE = 46; // tile 0x2E, intransitable
const SKULL_KEY_TILE = 0x107; // ItemKey (id 7) en el banco alto

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
    skullKeys: 0,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: MINOC, floor: 0, x: 2, y: 3 }, // al SUR del árbol (2,2)
    transport: "foot", torchTurns: 0,
    questFlags: {}, journal: [], worldObjects: [],
    equipmentQuantities: new Array(48).fill(0),
    spellQuantities: new Array(48).fill(0),
    scrollQuantities: new Array(8).fill(0),
    potionQuantities: new Array(8).fill(0),
    reagentQuantities: new Array(8).fill(0),
  };
  return { ...base, ...over } as GameState;
}

function minocWorld(): WorldData {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  tiles[2]![2] = TREE; // árbol de calaveras en (2,2), intransitable
  const minoc: SmallMapLocation = { id: MINOC, name: "Minoc", floors: [{ z: 0, tiles }] };
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return { overworld, underworld: overworld, smallMaps: new Map([[MINOC, minoc]]) };
}

/**
 * searchObjects con el árbol de Minoc en el ÍNDICE 14 (0x0e = gate DIARIO, la rama que salta
 * el bitmap 0x585c). Los demás índices llevan coordenadas que nunca casan con (2,2)@loc5.
 */
function searchTable(): SearchObject[] {
  const filler = (i: number): SearchObject => ({ id: 2, quality: 1, location: 99, floor: 9, x: i, y: i });
  const table: SearchObject[] = Array.from({ length: 16 }, (_, i) => filler(i));
  table[14] = { id: 7, quality: 0x85, location: MINOC, floor: 0, x: 2, y: 2 }; // 5 skull keys
  return table;
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
  searchObjects: searchTable(),
};

function makeGame(s: GameState): Game {
  return new Game({} as ExtractedInitialState, minocWorld(), gameData, s);
}

const searchObjAt = (g: Game, x: number, y: number): WorldObject | undefined =>
  g.state.worldObjects?.find((o) => o.kind === "search" && o.x === x && o.y === y);

describe("#22 · Search → objeto visible → Get (árbol de Minoc)", () => {
  it("Search HACIA el árbol coloca un objeto VISIBLE en (2,2) y NO concede llaves aún", () => {
    const g = makeGame(makeState());
    const events = g.search("north"); // party (2,3) → mira a (2,2)

    // El objeto quedó colocado, visible, sin grant.
    const obj = searchObjAt(g, 2, 2);
    expect(obj).toBeDefined();
    expect(obj!.kind).toBe("search");
    expect(obj!.search).toMatchObject({ id: 7, quality: 0x85 });
    expect(g.state.skullKeys).toBe(0); // NADA hasta el (G)et

    // Se pinta como entidad en el banco alto (id+0x100 = skull key).
    const render = g.lootRenderTiles();
    expect(render).toContainEqual({ x: 2, y: 2, tile: SKULL_KEY_TILE });

    // El mensaje del acierto es el NOMBRE del objeto (print_object_name 0x12a = lootOpenLine).
    const msgs = events.filter((e) => e.kind === "message").map((e) => (e as { text: string }).text);
    expect(msgs).toContain("\nThou dost find\n" + lootOpenLine(7)); // prosa C6 + "a ring of keys!"
  });

  it("Get HACIA el árbol concede 5 SKULL keys, retira el objeto y limpia la casilla", () => {
    const g = makeGame(makeState());
    g.search("north");
    expect(searchObjAt(g, 2, 2)).toBeDefined();

    const events = g.get("north");
    expect(g.state.skullKeys).toBe(5); // grant diferido (quality 0x85 → 5 skull keys)
    expect(g.state.keys).toBe(0); // el bit alto NO toca las llaves normales
    expect(searchObjAt(g, 2, 2)).toBeUndefined(); // objeto retirado
    expect(g.lootRenderTiles()).not.toContainEqual({ x: 2, y: 2, tile: SKULL_KEY_TILE });

    const msgs = events.filter((e) => e.kind === "message").map((e) => (e as { text: string }).text);
    // ⚠ ESTE ASERTO NO PROBABA NADA: comparaba `lootItemName` CONSIGO MISMA, así que
    // pasaba con cualquier cadena que devolviera. Ahora es un literal, y además el
    // objeto del árbol lleva quality 0x85 ⇒ el lado ALTO del cmp de 0x1568. #133
    expect(msgs).toContain("5 odd keys!"); // DS 0x8CAA + DS 0x8CBE
  });

  it("el objeto sigue VISIBLE entre Search y Get; re-Search el mismo día no lo duplica (gate diario)", () => {
    const g = makeGame(makeState());
    g.search("north");
    const before = g.state.worldObjects!.filter((o) => o.kind === "search").length;
    expect(before).toBe(1);

    // Mismo día: el gate diario (skullTreeFoundDay) bloquea; sin nuevo objeto ni "acierto".
    const events = g.search("north");
    const after = g.state.worldObjects!.filter((o) => o.kind === "search").length;
    expect(after).toBe(1); // NO se apiló un segundo
    const msgs = events.filter((e) => e.kind === "message").map((e) => (e as { text: string }).text);
    expect(msgs).toContain("\nThou dost find\nnothing of note.\n"); // prosa C6 (SJOG 0xae8 + 0x636)

    // Y el original sigue ahí para cogerlo.
    expect(g.get("north").length).toBeGreaterThan(0);
    expect(g.state.skullKeys).toBe(5);
  });

  it("Get sin Search previo sobre el árbol no da nada (no hay objeto colocado)", () => {
    const g = makeGame(makeState());
    g.get("north");
    expect(g.state.skullKeys).toBe(0);
  });
});

// Color de poción de botín: "A <color> potion!" (SJOG 0x163C: 0x8CF8 "A " + 0x419C[color]
// + 0x8CFC " potion!"). El `qty` de una poción de botín ES su color (rec[5]=0..7):
// overworld lootPlaceQty(3)=base-1 con base=rand(1,8); mazmorra rand(0,7).
describe("lootItemName — color de poción (0x419C)", () => {
  it("tabla de colores byte-exacta (DS 0x419C, minúsculas)", () => {
    expect([...POTION_COLORS]).toEqual([
      "blue", "yellow", "red", "green", "orange", "purple", "black", "white",
    ]);
  });

  it("compone 'A <color> potion!' para cada índice de color 0..7", () => {
    expect(lootItemName(3, 0)).toBe("A blue potion!");
    expect(lootItemName(3, 2)).toBe("A red potion!");
    expect(lootItemName(3, 5)).toBe("A purple potion!");
    expect(lootItemName(3, 7)).toBe("A white potion!");
    // Todos los índices producen un color válido de la tabla.
    for (let c = 0; c < 8; c++) {
      expect(lootItemName(3, c)).toBe(`A ${POTION_COLORS[c]} potion!`);
    }
  });
});
