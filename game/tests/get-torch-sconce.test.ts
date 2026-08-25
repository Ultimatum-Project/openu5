/**
 * (G)et sobre la ANTORCHA DE PARED (tiles 0xB0 RightSconce / 0xB1 LeftSconce).
 *
 * Derivación (re/disasm/SJOG.OVL.asm, cmd_get 0x18CE):
 *  - Dispatch del tile: @0x1b1b-0x1b25 `cmp ax,0xb0 / cmp ax,0xb1` → jmp 0x19e8.
 *  - @0x19f3 `mov byte [bx],0x44` — el tile se sustituye por SUELO DE LADRILLO 0x44.
 *  - @0x1a05 `mov byte [g_torch_mins],0x64` — la luz pasa a 100 minutos EXACTOS
 *    (ASIGNACIÓN, no suma; DS 0x58A7 = state.torchTurns). SIN +1 al contador de
 *    antorchas (g_torches 0x57ae no se toca) y SIN karma (la rama salta directa
 *    al exit 0x1b2e sin pasar por el dec de 0x1a58).
 *  - @0x1a0a print "Borrowed!" (DS 0x8de8) + @0x1a21 glide 0x842e(0x32,1,0x7d0,0x320)
 *    = GL(800→2000,1,50) → cue "torch-borrowed".
 *  - SIN gate de dirección (a diferencia de los platos 0x9A-0x9C): el testigo
 *    (aulddragon part01, cabaña de Iolo) la coge por S/E/W indistintamente.
 * Careo: OCR part01.ocrlog.txt:1563-1578 — "Look-South → a flickering torch",
 * "Get-South → Borrowed!" (×4 antorchas, direcciones S/E/E/W).
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";

const PAWS = 0x16;
const RIGHT_SCONCE = 0xb0;
const LEFT_SCONCE = 0xb1;
const BRICK_FLOOR = 0x44;

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

/** Paws 32×32 de suelo 5, con sconces plantadas donde pida el caso. */
function pawsWorld(sconces: Array<{ x: number; y: number; tile: number }> = []): WorldData {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  for (const s of sconces) tiles[s.y]![s.x] = s.tile;
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

describe("(G)et antorcha de pared (cmd_get 0x18CE rama 0xB0/0xB1 @0x19e8)", () => {
  it("Get-South sobre 0xB0: Borrowed!, tile→0x44, luz=100 min, SIN +torch y SIN karma", () => {
    // Party (3,22), sconce al sur (3,23) — el sitio del testigo (Look ya la ve).
    const game = makeGame(makeState(), pawsWorld([{ x: 3, y: 23, tile: RIGHT_SCONCE }]));
    const events = game.get("south");

    const texts = events.filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toContain("Borrowed!"); // DS 0x8de8 @0x1a0a
    // 0x64 asignados @0x1a05; el exit compartido 0x1b2e corre el turno (1 min de
    // reloj, advanceClock −1) → 0x63 observable tras el comando, igual que el binario.
    expect(game.state.torchTurns).toBe(0x63);
    expect(game.activeMap.tileAt(3, 23)).toBe(BRICK_FLOOR); // mov [bx],0x44 @0x19f3
    expect(game.state.torches).toBe(2); // g_torches NO se toca (sin +1 inventario)
    expect(game.state.karma).toBe(50); // sin dec de karma (salta el 0x1a58)
    expect(events.some((e) => e.kind === "sfx" && e.sfx?.id === "torch-borrowed")).toBe(true); // @0x1a21
  });

  it("la variante izquierda 0xB1 se coge igual", () => {
    const game = makeGame(makeState(), pawsWorld([{ x: 3, y: 21, tile: LEFT_SCONCE }]));
    const events = game.get("north");
    const texts = events.filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toContain("Borrowed!");
    expect(game.activeMap.tileAt(3, 21)).toBe(BRICK_FLOOR);
    expect(game.state.torchTurns).toBe(0x63); // 100 asignados − 1 min del turno
  });

  it("funciona desde las 4 direcciones (sin gate de dirección, testigo S/E/W)", () => {
    const dirs = [
      { dir: "north" as const, x: 3, y: 21 },
      { dir: "south" as const, x: 3, y: 23 },
      { dir: "east" as const, x: 4, y: 22 },
      { dir: "west" as const, x: 2, y: 22 },
    ];
    for (const { dir, x, y } of dirs) {
      const game = makeGame(makeState(), pawsWorld([{ x, y, tile: RIGHT_SCONCE }]));
      const events = game.get(dir);
      const texts = events.filter((e) => e.kind === "message").map((e) => e.text);
      expect(texts, `dir=${dir}`).toContain("Borrowed!");
      expect(game.activeMap.tileAt(x, y), `dir=${dir}`).toBe(BRICK_FLOOR);
      expect(game.state.torchTurns, `dir=${dir}`).toBe(0x63); // 100 − 1 min del turno
    }
  });

  it("la luz se ASIGNA a 100, no se suma (mov, no add)", () => {
    const game = makeGame(
      makeState({ torchTurns: 200 }),
      pawsWorld([{ x: 3, y: 23, tile: RIGHT_SCONCE }]),
    );
    game.get("south");
    expect(game.state.torchTurns).toBe(0x63); // 200 → 100 (mov) − 1 min del turno; no 299
  });

  it("re-Get sobre la celda ya descolgada da Nothing to get! (el 0x44 no es cogible)", () => {
    const game = makeGame(makeState(), pawsWorld([{ x: 3, y: 23, tile: RIGHT_SCONCE }]));
    game.get("south"); // descuelga
    const events = game.get("south"); // la celda ya es BrickFloor 0x44
    const texts = events.filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toContain("Nothing to get!");
    expect(game.state.torches).toBe(2);
  });

  it("caso viejo intacto: sin nada delante, Nothing to get!", () => {
    const game = makeGame(makeState(), pawsWorld());
    const events = game.get("north");
    const texts = events.filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toContain("Nothing to get!"); // DS 0x8e64, cero regresión
  });
});

/**
 * DETECTORES #119 TANDA 3 — cosecha, antorcha de pared y comida de mesa son escrituras
 * de TERRENO, y el terreno es VOLÁTIL: la antorcha REAPARECE y el trigo REBROTA al
 * recargar el mapa.
 *
 * DERIVACIÓN (el discriminador es el PUNTERO, no el nombre de la mecánica). Las tres
 * ramas del (G)et piden el puntero a `tile_addr` (ULTIMA.EXE 0x4402) y escriben por él,
 * dentro del búfer de terreno vivo `DS:0x6608` — no en la tabla de objetos `DS:0x5c5a`:
 *
 *   antorcha de pared  SJOG 0x19ee `call 0x8482` → 0x19f3 `mov byte [bx],0x44`
 *   cosecha de trigo   SJOG 0x1a30 `call 0x8482` → 0x1a35 `mov byte [bx],0x2c`
 *   comida de mesa     SJOG 0x1a76 / 0x1a9e `call 0x8482` → `mov byte [bx],0x95`
 *                      y 0x1ae8 `…,0x9B` / 0x1afc `…,0x9A` (las mitades)
 *
 * Y ese búfer cae FUERA de la ventana de SAVED.GAM ([0x55A6,0x6606)) y lo reescribe de
 * disco el cargador TOWN 0x0408 en cada entrada y cada cambio de planta. Ver
 * re/notes/terreno-119-acta.md; y MEDIDO EN VIVO en re/notes/terreno-121-acta.md.
 *
 * ⚠ HONESTIDAD SOBRE EL ORDEN: esta tanda NO tuvo failing-first — al mover los tres
 * call-sites la suite siguió VERDE, porque NINGÚN test cubría dónde caía la escritura.
 * El rojo se demostró por MUTACIÓN dirigida (revertir los tres a `setMapOverride` pone
 * en rojo exactamente los tres detectores de abajo y nada más), que es el control que
 * queda al descubrir el hueco después. Está en el acta §T3.2.
 */
describe("#119 tanda 3 · cosecha/antorcha/comida son TERRENO (volátil)", () => {
  const KEEP_TILE = 0x13; // ENTERABLE_TILES[1]
  const WHEAT = 0x2d, PLOWED = 0x2c;

  /** Paws + un keep enterable en el overworld, para forzar la carga de mapa por enter(). */
  function pawsConEntrada(sconces: Array<{ x: number; y: number; tile: number }>) {
    const w = pawsWorld(sconces);
    w.overworld[100]![120] = KEEP_TILE;
    const data: GameData = {
      ...gameData,
      locationsX: gameData.locationsX.map((v, i) => (i === PAWS - 1 ? 120 : v)),
      locationsY: gameData.locationsY.map((v, i) => (i === PAWS - 1 ? 100 : v)),
    };
    return { w, data };
  }

  function recargar(g: Game, s: GameState): void {
    s.position = { location: 0, floor: 0, x: 120, y: 100 } as GameState["position"];
    g.enter();
  }

  it("★ la antorcha de pared REAPARECE tras recargar el mapa (y no viaja en el save)", () => {
    const { w, data } = pawsConEntrada([{ x: 3, y: 23, tile: RIGHT_SCONCE }]);
    const s = makeState();
    const g = new Game({} as ExtractedInitialState, w, data, s);
    g.get("south");
    // CONTROL POSITIVO: la sconce SÍ desapareció mientras dura la residencia.
    expect(g.activeMap.tileAt(3, 23), "0x19f3: sustituida por suelo").toBe(BRICK_FLOOR);
    expect(Object.keys(s.mapOverrides ?? {})).toEqual([]); // nada en la capa persistida
    recargar(g, s);
    expect(s.position.location, "se re-entró de verdad").toBe(PAWS);
    expect(g.activeMap.tileAt(3, 23), "TOWN 0x0408 relee: la antorcha vuelve").toBe(RIGHT_SCONCE);
    expect(g.activeMap.tileAt(4, 23), "…y el suelo de al lado sigue siendo suelo").toBe(5);
  });

  it("★ el trigo cosechado REBROTA tras recargar el mapa", () => {
    const { w, data } = pawsConEntrada([{ x: 3, y: 23, tile: WHEAT }]);
    const s = makeState();
    const g = new Game({} as ExtractedInitialState, w, data, s);
    const antes = s.food;
    g.get("south");
    expect(s.food, "la cosecha sí dio comida").toBe(antes + 1);
    expect(g.activeMap.tileAt(3, 23), "0x1a35: queda arado").toBe(PLOWED);
    expect(Object.keys(s.mapOverrides ?? {})).toEqual([]);
    recargar(g, s);
    expect(g.activeMap.tileAt(3, 23), "el trigo vuelve del .DAT").toBe(WHEAT);
  });

  it("★ el plato comido VUELVE A ESTAR SERVIDO tras recargar el mapa", () => {
    const FOOD_BOTH = 0x9c;
    const { w, data } = pawsConEntrada([{ x: 3, y: 23, tile: FOOD_BOTH }]);
    const s = makeState();
    const g = new Game({} as ExtractedInitialState, w, data, s);
    g.get("south"); // dy=+1 ⇒ se lleva la mitad de su lado (queda 0x9B)
    expect(g.activeMap.tileAt(3, 23), "quedó media bandeja").not.toBe(FOOD_BOTH);
    expect(Object.keys(s.mapOverrides ?? {})).toEqual([]);
    recargar(g, s);
    expect(g.activeMap.tileAt(3, 23), "el plato vuelve entero").toBe(FOOD_BOTH);
  });
});
