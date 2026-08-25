/**
 * Fase 1.4 · Pozo de deseos (LOOKOBJ.OVL 0x0042). Trigger = (L)ook hacia el tile 0xa1
 * (NO transitable → nunca se pisa). "Drop a coin?" → 1 oro → "Thy wish?" → si contiene
 * {Corvette,Ferrari,Lamborghini,Lotus,Porsche,Horse} Y estás en Paws(0x16)/Empath(0x1F)
 * → caballo (tile 0x10) vía mapOverride; si no, "No effect" (la moneda se gasta igual).
 * 0 RNG. Reglas del motor puro (world/wishingwell.ts) NO se reimplementan.
 * Citas: re/notes/shrines.md §4, .superpowers/sdd/scout-shrines.md.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { ACTOR_TILE_BANK, Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { WELL_TILE, WISH_SPAWN_TILE } from "../src/core/world/wishingwell.js";

/**
 * #137 · `WISH_SPAWN_TILE` es el BYTE del registro de objeto (0x10). La capa de mundo del
 * port guarda el tile COMPLETO del banco alto — 0x110 `HorseRight`; 0x10 a secas es `Hut`.
 */
const HORSE_IN_WORLD = WISH_SPAWN_TILE + ACTOR_TILE_BANK;

const PAWS = 0x16;

function makeChar(): CharacterState {
  return {
    name: "Avatar", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff, partyStatus: 0,
  };
}

/** Small map de Paws con un pozo en (3,21) y el party en (3,22) (justo al S). */
function pawsWorld(): WorldData {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  tiles[21]![3] = WELL_TILE; // 0xa1
  const paws: SmallMapLocation = { id: PAWS, name: "Paws", floors: [{ z: 0, tiles }] };
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return { overworld, underworld: overworld, smallMaps: new Map([[PAWS, paws]]) };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 10, karma: 50,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: PAWS, floor: 0, x: 3, y: 22 }, // 1 al S del pozo
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 8,
  };
  return { ...base, ...over } as GameState;
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

function makeGame(s: GameState, world: WorldData): Game {
  return new Game({} as ExtractedInitialState, world, gameData, s);
}

const tileOverride = (g: Game, x: number, y: number): number | undefined =>
  g.state.mapOverrides?.[`${g.state.position.location}:0:${x}:${y}`];

describe("F1.4 · pozo de deseos", () => {
  it("mirar el pozo emite well-drop-prompt", () => {
    const game = makeGame(makeState(), pawsWorld());
    const events = game.look("north"); // (3,22) mira (3,21) = pozo
    expect(events.some((e) => e.kind === "well-drop-prompt")).toBe(true);
  });

  it("dropCoin(true) con oro → pide el deseo (well-wish-prompt)", () => {
    const game = makeGame(makeState({ gold: 10 }), pawsWorld());
    game.look("north");
    const events = game.dropCoin(true);
    expect(events.some((e) => e.kind === "well-wish-prompt")).toBe(true);
  });

  it("deseo 'Horse' en Paws → gasta 1 oro y coloca un caballo adyacente (mapOverride)", () => {
    const game = makeGame(makeState({ gold: 10 }), pawsWorld());
    game.look("north");
    game.dropCoin(true);
    const events = game.makeWish("Horse");
    expect(game.state.gold).toBe(9); // moneda gastada
    // Caballo en la primera casilla adyacente transitable (N,E,S,O): (3,21) es el pozo
    // (no transitable) → (4,22) al E es hierba.
    expect(tileOverride(game, 4, 22)).toBe(HORSE_IN_WORLD);
    expect(events.some((e) => e.kind === "map-changed")).toBe(true);
  });

  it("deseo sin match → 'No effect' pero la moneda se gasta igual", () => {
    const game = makeGame(makeState({ gold: 10 }), pawsWorld());
    game.look("north");
    game.dropCoin(true);
    game.makeWish("Banana");
    expect(game.state.gold).toBe(9);
    expect(tileOverride(game, 4, 22)).toBeUndefined(); // ningún caballo
  });

  it("dropCoin(true) sin oro → no pide deseo", () => {
    const game = makeGame(makeState({ gold: 0 }), pawsWorld());
    game.look("north");
    const events = game.dropCoin(true);
    expect(events.some((e) => e.kind === "well-wish-prompt")).toBe(false);
  });

  it("dropCoin(false) declina: sin cobro, sin prompt de deseo, sin caballo", () => {
    const game = makeGame(makeState({ gold: 10 }), pawsWorld());
    game.look("north");
    const events = game.dropCoin(false);
    expect(events.some((e) => e.kind === "well-wish-prompt")).toBe(false);
    expect(game.state.gold).toBe(10); // N/ESC no cobra (LOOKOBJ 0x0052 getkey crudo)
    expect(tileOverride(game, 4, 22)).toBeUndefined(); // ningún caballo
  });

  // Integración cruzada — LA invariante de la task: el caballo del pozo no es sólo un tile,
  // debe ser MONTABLE. Ejerce override→caminar-encima→(B)oard→montado con el motor real.
  it("el caballo del pozo es MONTABLE: caminar sobre él y (B)oard monta (transportTile 0x12)", () => {
    const game = makeGame(makeState({ gold: 10 }), pawsWorld());
    game.look("north");
    game.dropCoin(true);
    game.makeWish("Horse");
    expect(tileOverride(game, 4, 22)).toBe(HORSE_IN_WORLD); // caballo al E

    game.move("east"); // el party camina sobre la casilla del caballo
    expect(game.state.position.x).toBe(4);

    const events = game.board(); // (B)oard sobre el tile del caballo (override)
    expect(game.state.transport).toBe("horse");
    // 0x10 (caballo del MUNDO) + 2 = MONTADO. El valor no cambia; la etiqueta vieja decía
    // «facing N» y era falsa: 0x12 es el caballo montado mirando al ESTE (transport_face
    // MAINOUT 0x0111 `cmp [bp+4],1` con facing 1=E, ver mountFaceTile). Montar (+2) y
    // girar son operaciones distintas sobre el mismo byte — confundirlas era la
    // contradicción del port consigo mismo (#62).
    expect(game.state.transportTile).toBe(0x12);
    expect(events.some((e) => e.kind === "message" && e.text === "horse")).toBe(true);
  });
});

/**
 * #227 — la COORDENADA es (party_x + 1, party_y) FIJA, no un barrido.
 *
 * LOOKOBJ 0x056b-0x0578 empuja `g_party_x`, `g_party_y`, `g_floor` y el handler, en
 * 0x0132-0x014e, empuja `[bp+8]` **incrementado** (0x013c `inc ax`) + `[bp+6]` + `[bp+4]`
 * a `set_actor_record` (ULTIMA.EXE 0x3A74). El «+1» se lo lleva la X: una casilla al ESTE.
 *
 * ★ POR QUÉ HACEN FALTA ESTOS DOS CASOS: la fixture `pawsWorld()` de arriba tiene el POZO
 * justo al NORTE del party, así que el barrido viejo (N,E,S,O) descartaba el norte y elegía
 * el este — **el mismo resultado que la coordenada fija**. Es decir, los tests que ya
 * existían NO discriminaban los dos algoritmos: pasaban con cualquiera de los dos. Aquí el
 * pozo va al OESTE y el norte queda LIBRE, que es la única geometría donde las dos reglas
 * dan celdas distintas.
 */
describe("#227 · la casilla del caballo del pozo", () => {
  /** Pozo al OESTE del party; todo lo demás transitable ⇒ N y E son ambos candidatos. */
  function worldPozoAlOeste(): WorldData {
    const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
    tiles[22]![2] = WELL_TILE; // el pozo al O del party (3,22)
    const paws: SmallMapLocation = { id: PAWS, name: "Paws", floors: [{ z: 0, tiles }] };
    const ow = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
    return { overworld: ow, underworld: ow, smallMaps: new Map([[PAWS, paws]]) };
  }

  it("★ DISCRIMINANTE: con el NORTE libre el caballo va al ESTE (x+1), no al norte", () => {
    const game = makeGame(makeState({ gold: 10 }), worldPozoAlOeste());
    game.look("west");
    game.dropCoin(true);
    game.makeWish("Horse");
    // PRECONDICIÓN: el norte ERA un candidato válido para el barrido viejo (si no, el test
    // no mediría nada — es la trampa que tenían los casos de arriba).
    expect(tileOverride(game, 3, 21), "el barrido viejo (N primero) lo habría puesto aquí").toBeUndefined();
    expect(tileOverride(game, 4, 22), "0x013c `inc ax` sobre g_party_x ⇒ (x+1, y)").toBe(HORSE_IN_WORLD);
  });

  it("★ la guarda `walkable` que el binario NO tiene: al este un muro ⇒ NO se coloca nada", () => {
    // El binario colocaría igual (escribe un REGISTRO en la tabla de objetos DS:0x5C5A y el
    // terreno de debajo no se toca). El port escribe en la capa de TERRENO, así que colocar
    // «a ciegas» BORRARÍA el muro — una mecánica que el original no tiene. Divergencia
    // DECLARADA y gated tras #152/F1.5 + #137; ver el docblock de `spawnWishHorse`.
    const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
    tiles[22]![2] = WELL_TILE;
    tiles[22]![4] = 0x4d; // LargeRockWall al ESTE — el caso real: 27 de 56 posiciones (48,2 %)
    const paws: SmallMapLocation = { id: PAWS, name: "Paws", floors: [{ z: 0, tiles }] };
    const ow = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
    const game = makeGame(makeState({ gold: 10 }), { overworld: ow, underworld: ow, smallMaps: new Map([[PAWS, paws]]) });
    game.look("west");
    game.dropCoin(true);
    game.makeWish("Horse");
    expect(tileOverride(game, 4, 22), "no se pisa el muro").toBeUndefined();
    expect(tileOverride(game, 3, 21), "y TAMPOCO se busca otra casilla: ya no hay barrido").toBeUndefined();
  });
});
