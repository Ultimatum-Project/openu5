/**
 * Comando (V)iew a gem — vista aérea del mapa. MECÁNICA calcada byte a byte del
 * case V del dispatcher (ULTIMA.EXE.asm 0x341A-0x344D):
 *
 *   0x341e  push 0xa258 ; call print   → "View a gem!\n" (DS 0xa258) SIEMPRE, antes del gate
 *   0x3421  cmp [g_gems],0 ; je 0x344a  → sin gemas
 *   0x344a  mov ax,0xa266 ; ...print    → "You have none!\n" (DS 0xa266)
 *   0x3428  dec [g_gems]                → consume 1 gema SIEMPRE (antes de pintar)
 *   0x342c  cmp [g_location],0x21 ; jae  → mazmorra (DNGLOOK 0x06a8) vs resto (LOOKOBJ 0x10fc)
 *   [bp-2]=1 en TODAS las ramas (prólogo 0x317e) → cobra 1 turno (incluso sin gemas).
 *
 * Strings verbatim de DATA.OVL (fileoff = DS+0x10): 0xa258="View a gem!\n",
 * 0xa266="You have none!\n". El RENDER (buildGemView) es fiel-suficiente (L3):
 * ventana 32×32 de la ventana cargada del mapa (gem_view LOOKOBJ 0x10fc, doble
 * bucle 0x1132-0x1162, `ext_a172(chunk_origin+col,+row)`), marcador en la
 * posición del jugador (party−chunk_origin, 0x1109/0x110f); mazmorra = planta 8×8.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { buildGemView, GEM_WINDOW, DUNGEON_GEM_DISPLAY, DUNGEON_GEM_CENTER } from "../src/core/world/gem-view.js";
import { DungeonState, type DungeonData } from "../src/core/dungeon/dungeon.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PAWS = 0x16; // small map < 0x21 (no mazmorra)
const GRASS = 5;

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const dungeons = load<DungeonData[]>("../assets/maps/dungeons.json");

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
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 100, y: 100 },
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

/** Mundo con un overworld 256×256 y el small map de Paws 32×32, ambos de hierba. */
function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => GRASS));
  const townTiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => GRASS));
  const paws: SmallMapLocation = { id: PAWS, name: "Paws", floors: [{ z: 0, tiles: townTiles }] };
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

const texts = (events: { kind: string; text?: string }[]): string[] =>
  events.filter((e) => e.kind === "message").map((e) => e.text ?? "");

describe("(V)iew — gate de gemas (0x3421)", () => {
  it("sin gemas: 'You have none!' y NO abre vista (el eco '>View a gem!' lo pone el dispatch)", () => {
    const game = makeGame(makeState({ gems: 0 }), makeWorld());
    const events = game.view();
    // El eco ">View a gem!" (DS 0xa258, 0x341e) lo emite el dispatch (main.ts hud.echo),
    // NO game.view(). Aquí solo el RESULTADO. #77.
    expect(texts(events)).not.toContain("View a gem!\n");
    expect(texts(events)).toContain("You have none!\n"); // DS 0xa266 (0x344a)
    expect(events.some((e) => e.kind === "gem-view")).toBe(false);
    expect(game.state.gems).toBe(0); // no consume nada
  });

  it("sin gemas TAMBIÉN cobra el turno ([bp-2]=1 en la rama je → 0x33ea → 0x31ee)", () => {
    const game = makeGame(makeState({ gems: 0 }), makeWorld());
    const before = game.state.time.minute;
    game.view();
    expect(game.state.time.minute).toBe(before + 2); // overworld grass = 2 min (MAINOUT 0xC39)
  });
});

describe("(V)iew — consumo de 1 gema (0x3428)", () => {
  it("con gemas: consume EXACTAMENTE 1 + abre la vista (el eco lo pone el dispatch)", () => {
    const game = makeGame(makeState({ gems: 3 }), makeWorld());
    const events = game.view();
    expect(texts(events)).not.toContain("View a gem!\n"); // eco en el dispatch, no en el core (#77)
    expect(texts(events)).not.toContain("You have none!\n");
    expect(game.state.gems).toBe(2); // 3 → 2, exactamente 1
    expect(events.some((e) => e.kind === "gem-view")).toBe(true);
  });

  it("DIFIERE el turno al cierre: view() no avanza el reloj; afterGemView() sí (overworld=2 min)", () => {
    // Orden del binario (fix review): gem_view (call 0x343d) es bloqueante y el bucle
    // de contexto cobra el turno tras su retorno (epílogo 0x31ee) → el turno corre al
    // CERRAR la vista, no al abrirla.
    const game = makeGame(makeState({ gems: 1 }), makeWorld());
    const before = game.state.time.minute;
    game.view();
    expect(game.state.time.minute).toBe(before); // turno DIFERIDO: reloj intacto con el panel abierto
    game.afterGemView(); // la UI lo invoca al cerrar el panel
    expect(game.state.time.minute).toBe(before + 2); // ahora sí, el turno del contexto
  });
});

describe("(V)iew — el mapa mostrado corresponde al entorno (0x342c)", () => {
  it("overworld (location 0): ventana 32×32 ANCLADA a chunk_origin (NO centrada en el jugador)", () => {
    const world = makeWorld();
    world.overworld[100]![100] = 42; // tile distintivo bajo el jugador
    const game = makeGame(makeState({ gems: 1, position: { location: 0, floor: 0, x: 100, y: 100 } }), world);
    const gv = game.view().find((e) => e.kind === "gem-view")!.gemView!;
    expect(gv.environment).toBe("overworld");
    expect(gv.width).toBe(GEM_WINDOW);
    expect(gv.height).toBe(GEM_WINDOW);
    // party 100=0x64: bloque 0x60, low nibble 4<8 → chunk_origin=0x50 (MAINOUT 0x0019);
    // marcador = party − origin = 20 (columnas 8..23, NUNCA fijo en 16). El original ancla
    // la ventana a la caché de chunks, no la centra en el jugador (task #76 r3).
    expect(gv.marker).toEqual({ x: 20, y: 20 });
    expect(gv.tiles[gv.marker.y]![gv.marker.x]).toBe(42); // el tile del jugador cae en el marcador
  });

  it("pueblo (0 < location < 0x21): mapa 32×32 completo, marcador en el jugador", () => {
    const world = makeWorld();
    const paws = world.smallMaps.get(PAWS)!;
    paws.floors[0]!.tiles[7]![5] = 9;
    const game = makeGame(makeState({ gems: 1, position: { location: PAWS, floor: 0, x: 5, y: 7 } }), world);
    const gv = game.view().find((e) => e.kind === "gem-view")!.gemView!;
    expect(gv.environment).toBe("town");
    expect(gv.width).toBe(GEM_WINDOW);
    expect(gv.marker).toEqual({ x: 5, y: 7 }); // chunk_origin=(0,0) → marcador = posición del jugador
    expect(gv.tiles[7]![5]).toBe(9);
  });

  it("mazmorra (location >= 0x21): display 22×22 centrado en la party (DNGLOOK 0x0388)", () => {
    const state = makeState({ gems: 1, position: { location: 0x21, floor: 0, x: 5, y: 5 } });
    const game = makeGame(state, makeWorld());
    game.dungeonState = new DungeonState(dungeons, { dungeon: 33, floor: 0, x: 5, y: 5, facing: "north" });
    const gv = game.view().find((e) => e.kind === "gem-view")!.gemView!;
    expect(gv.environment).toBe("dungeon");
    expect(gv.width).toBe(DUNGEON_GEM_DISPLAY);
    expect(gv.height).toBe(DUNGEON_GEM_DISPLAY);
    // El marcador queda FIJO en el centro (11,11), no en la posición cruda del jugador.
    expect(gv.marker).toEqual({ x: DUNGEON_GEM_CENTER, y: DUNGEON_GEM_CENTER });
  });
});

describe("buildGemView — helper puro", () => {
  it("overworld lee la ventana con wrap toroidal alrededor del jugador", () => {
    const world = makeWorld();
    const state = makeState({ position: { location: 0, floor: 0, x: 0, y: 0 } });
    // party en (0,0): origen (−16,−16) → lee wrapCoord → (240..)/(0..15). No debe petar.
    const gv = buildGemView(state, world, null);
    expect(gv.environment).toBe("overworld");
    expect(gv.tiles.length).toBe(GEM_WINDOW);
    expect(gv.tiles[0]!.length).toBe(GEM_WINDOW);
    expect(gv.marker).toEqual({ x: 16, y: 16 });
  });
});
