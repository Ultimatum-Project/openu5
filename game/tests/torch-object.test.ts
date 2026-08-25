/**
 * Fase 1.5 · Antorcha: get() sobre un objeto de kind "torch" (SJOG get_special_item
 * 0x1458, rama de ANTORCHAS @0x1504). Coger → torches += n (cap 0x63) + elimina el
 * objeto + línea «N torch!»/«N torches!».
 *
 * ⚠ CABECERA CORREGIDA (#54 pieza 11). La versión anterior decía «rama sconce 0x148c»
 * y «el string 0x8c4e», y las DOS eran de otro kind — el mismo error que t#63 ya había
 * corregido en game.ts pero que NUNCA se propagó a este fichero: 0x148c es la rama de
 * la PIEDRA LUNAR (kind 0x19), que imprime DS 0x8c4e "A moonstone!" y escribe
 * `[bx+0x5840]=0xff` (tabla de LOCATION de las 8 piedras). La antorcha es kind 0x0d y
 * su rama es 0x1504, que sí toca el contador. No había, pues, «dos ramas que F1.5
 * unifica»: hay UNA.
 *
 * Derivación de la rama real (re/disasm/SJOG.OVL.asm 0x1504-0x1539, cuerpo entero):
 *  - 0x150f `call 0x5abe(0x20, 1, [bp+6])` = print_int(relleno=' ', ancho=1, valor).
 *    Identificada por CONTROL POSITIVO, no por el nombre: CAST.OVL 0x1aff imprime la
 *    HORA con la misma firma (0x20,1,hora) y luego 0x3a ':' + minutos → "H:MM".
 *  - 0x1512 `call 0x58d0(DS 0x8c8a)` = " torch" (DATA.OVL, fileoff = DS+0x10).
 *  - 0x1519 `cmp [bp+6],1 / jne` → 0x8c92 "!\n" si ==1, 0x8c96 "es!\n" si no. El plural
 *    va en el SUFIJO; la rama hermana de gemas (0x153c) usa 0x8ca6 "s!" — control que
 *    confirma que el sufijo es por-familia y no un "es" genérico.
 *  - 0x1536 `call 0x7f70(0x63, [bp+6], g_torches=0x57ae)` = add_capped, cap 0x63.
 *  - `[bp+6]` es UN SOLO valor que alimenta mensaje Y contador (imposible que difieran).
 *    Viene del byte slot+5 del registro (caller 0x199f empuja `[bx+0x5c5f]`). Los objetos
 *    kind "torch" del port no llevan ese byte → el port acredita 1 (cifra del PORT).
 *  - El resto del jump-table de get_special_item (0x147d, ⚠O3) sigue sin portarse. 0 RNG.
 * Cita: re/disasm/SJOG.OVL.asm 0x1458/0x1504, CAST.OVL.asm 0x1aff, DATA.OVL 0x8c8a/0x8c92/0x8c96.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState, WorldObject } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import { lootItemName } from "../src/core/world/commands.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";

const PAWS = 0x16;
const TORCH_TILE = 0x8f; // placeholder ⚠: el sembrado real de la antorcha es O5; load-bearing es `kind`.

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
    position: { location: PAWS, floor: 0, x: 3, y: 22 },
    transport: "foot", torchTurns: 0,
    questFlags: {}, journal: [],
    equipmentQuantities: new Array(48).fill(0),
    spellQuantities: new Array(48).fill(0),
    scrollQuantities: new Array(8).fill(0),
    potionQuantities: new Array(8).fill(0),
    reagentQuantities: new Array(8).fill(0),
  };
  return { ...base, ...over } as GameState;
}

function pawsWorld(): WorldData {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  const paws: SmallMapLocation = { id: PAWS, name: "Paws", floors: [{ z: 0, tiles }] };
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return { overworld, underworld: overworld, smallMaps: new Map([[PAWS, paws]]) };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

function makeGame(s: GameState, world: WorldData): Game {
  return new Game({} as ExtractedInitialState, world, gameData, s);
}

const torchAt = (over: Partial<WorldObject> = {}): WorldObject => ({
  location: PAWS, floor: 0, x: 3, y: 21, tile: TORCH_TILE, kind: "torch", ...over,
});

describe("F1.5 · coger antorcha (get_special_item 0x1458 rama 0x1504)", () => {
  it("get() hacia una antorcha sube torches y elimina el objeto", () => {
    const game = makeGame(makeState({ worldObjects: [torchAt()], torches: 2 }), pawsWorld());
    const events = game.get("north"); // party (3,22), antorcha al N (3,21)
    expect(game.state.torches).toBe(3);
    expect(game.state.worldObjects).toEqual([]);
    expect(events.some((e) => e.kind === "party-changed")).toBe(true);
  });

  // #54 pieza 11 — el TEXTO. Antes se emitía «Torch!», un string FABRICADO (no existe
  // en DATA.OVL). La rama 0x1504 imprime entero + " torch" + sufijo por cantidad.
  it("emite «1 torch!»: entero (print_int 0x5abe) + DS 0x8c8a + sufijo singular 0x8c92", () => {
    const game = makeGame(makeState({ worldObjects: [torchAt()], torches: 2 }), pawsWorld());
    const texts = game.get("north").filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toContain("1 torch!");
    expect(texts).not.toContain("Torch!"); // el placeholder no vuelve por otra vía
  });

  // El plural NO se ejerce hoy por el (G)et de antorcha (el port acredita 1), pero la
  // MISMA función compone ambas ramas: se sella aquí para que el sufijo 0x8c96 "es!"
  // quede cubierto por un aserto y no sólo por el comentario. Cantidad ≠ 1 ⇒ plural.
  it("el sufijo plural 0x8c96 es «es!», no «s!» (contraste con la rama de gemas 0x153c)", () => {
    expect(lootItemName(13, 3)).toBe("3 torches!"); // 0x8c8a + 0x8c96
    expect(lootItemName(13, 1)).toBe("1 torch!"); // 0x8c8a + 0x8c92
    expect(lootItemName(8, 3)).toBe("3 gems!"); // rama hermana: 0x8c9c + 0x8ca6 "s!"
  });

  it("torches en cap 0x63 no rebasa", () => {
    const game = makeGame(makeState({ worldObjects: [torchAt()], torches: 0x63 }), pawsWorld());
    game.get("north");
    expect(game.state.torches).toBe(0x63); // cap SJOG 0x1504 add-helper 0x7f70 arg 0x63
  });

  it("sin antorcha-objeto, get() conserva el comportamiento actual", () => {
    const game = makeGame(makeState(), pawsWorld());
    const events = game.get("north");
    const texts = events.filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toContain("Nothing to get!"); // cero regresión
  });
});
