/**
 * #195 — CABLEADO de la marchitación al mapa vivo (TOWN 0x1239 `call 0x2ae` →
 * 0x02E7 `call 0x212`), y su canal: TERRENO VOLÁTIL, no `mapOverrides`.
 *
 * Este fichero es el failing-first MEDIDO del carril: importa sólo módulos que YA
 * existen en `main` (`Game`), así que antes del fix falla por la ASERCIÓN — «el pueblo
 * sigue intacto» — y no por un módulo que no se resuelve (failing-first-import-trap).
 * La derivación del tramo vive en `shadowlord-wither.test.ts` y en el acta
 * `re/notes/shadowlord-urbano-acta.md §1`.
 *
 * Por qué el canal es el volátil (#113/#119): el cargador TOWN 0x0408 REESCRIBE los
 * 0x400 bytes de `DS:0x6608` desde el .DAT en cada entrada y cada cambio de planta, y
 * 0x6608 cae FUERA de la ventana de SAVED.GAM ([0x55A6,0x6606)). La marchitación
 * escribe por `tile_addr` sobre ese búfer ⇒ no viaja en el save y muere en la siguiente
 * carga. El orden dentro de `loadSmallMap` es load-bearing: `clearVolatileTerrain()`
 * PRIMERO (es la re-lectura de disco) y la marchitación DESPUÉS, igual que en el
 * binario 0x1236 `call 0x408` precede a 0x1239 `call 0x2ae`.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { ACTOR_TILE_BANK, Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { SHADOWLORD_TILE } from "../src/core/world/shadowlord-urban.js";

/** New Magincia. Control BUENO del acta: N=47 (2 árboles + 45 trigos), no degenerado. */
const MAGINCIA = 8;
/** Moonglow. Control DEGENERADO del acta: N=0 — quien sondee aquí no ve nada. */
const MOONGLOW = 1;
/** Stonegate, la guarida: tiene N=8 elegibles y aun así NO marchita (nadie está «aquí»). */
const STONEGATE = 29;

const TILE_TREE = 0x2e;
const TILE_DEAD_TREE = 0x2b;
const TILE_GRASS = 0x05;
/** Tile de entrada pintado en el overworld para forzar la carga por la vía pública `enter()`. */
const KEEP_TILE = 0x13;
const ENTRY_X = 120;
const ENTRY_Y = 100;

function makeChar(): CharacterState {
  return {
    name: "Avatar", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  };
}

/** Mapa 32×32 de hierba con `trees` árboles sembrados en la fila 0 (posiciones fijas). */
function makeLocation(id: number, trees: number): SmallMapLocation {
  const build = (): number[][] => {
    const t = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => TILE_GRASS));
    for (let i = 0; i < trees; i++) t[Math.floor(i / 32)]![i % 32] = TILE_TREE;
    return t;
  };
  return { id, name: `Loc${id}`, floors: [{ z: 0, tiles: build() }, { z: 1, tiles: build() }] };
}

function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => TILE_GRASS));
  return {
    overworld,
    underworld: overworld,
    smallMaps: new Map([
      [MAGINCIA, makeLocation(MAGINCIA, 47)],
      [MOONGLOW, makeLocation(MOONGLOW, 0)],
      [STONEGATE, makeLocation(STONEGATE, 8)],
    ]),
  };
}

/** Tablas de location FRESCAS por juego: `enterTown` las MUTA, y compartirlas entre
 *  casos hacía que `locationAt` resolviese la coordenada al primer id ya registrado. */
function makeGameData(): GameData {
  return {
    locationsX: Array.from({ length: 32 }, () => 0),
    locationsY: Array.from({ length: 32 }, () => 0),
    locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  return {
    version: 1,
    characters: [makeChar()],
    partySize: 1,
    activeCharacter: 0,
    food: 100, gold: 100, keys: 0, gems: 0, torches: 0,
    equipmentQuantities: Array.from({ length: 48 }, () => 0),
    reagentQuantities: Array.from({ length: 8 }, () => 0),
    karma: 40,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: ENTRY_X, y: ENTRY_Y },
    transport: "foot",
    torchTurns: 0,
    prevHour: 8,
    npcDead: Array.from({ length: 32 }, () => [] as boolean[]),
    npcMet: Array.from({ length: 32 }, () => [] as boolean[]),
    ...over,
  } as GameState;
}

/** Construye el juego y ENTRA a `loc` por la vía pública (`enter()` sobre su tile). */
function enterTown(loc: number, state: GameState): Game {
  const game = new Game({} as ExtractedInitialState, makeWorld(), makeGameData(), state);
  game.world.overworld[ENTRY_Y]![ENTRY_X] = KEEP_TILE;
  game.data.locationsX[loc - 1] = ENTRY_X;
  game.data.locationsY[loc - 1] = ENTRY_Y;
  game.enter();
  if (game.state.position.location !== loc) {
    throw new Error(`el arnés no entró a ${loc} (quedó en ${game.state.position.location})`);
  }
  return game;
}

/** Cuenta cuántas celdas del mapa VIVO valen `tile` (32×32). */
function countTiles(game: Game, tile: number): number {
  let n = 0;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) if (game.activeMap.tileAt(x, y) === tile) n++;
  }
  return n;
}

describe("#195 — la marchitación al entrar al pueblo ocupado", () => {
  it("★ CONTROL NEGATIVO: sin Shadowlord en la ciudad el pueblo queda INTACTO (0x021a/0x0221)", () => {
    // Precondición del control (#187): el mapa TIENE los 47 elegibles; lo que falta es el
    // Shadowlord. Sin él, `g_shadowlord_here_idx` sigue 0xFF y 0x0212 sale sin tocar nada.
    const game = enterTown(MAGINCIA, makeState({ shadowlordLocs: [0xff, 0xff, 0xff] }));
    expect(countTiles(game, TILE_TREE), "47 árboles sembrados, ninguno debe morir sin SL").toBe(47);
    expect(countTiles(game, TILE_DEAD_TREE)).toBe(0);
  });

  it("★ con un Shadowlord en la ciudad MUEREN árboles — y el pueblo NO queda intacto", () => {
    const game = enterTown(MAGINCIA, makeState({ shadowlordLocs: [MAGINCIA, 0xff, 0xff] }));
    const vivos = countTiles(game, TILE_TREE);
    expect(vivos, "a 7/8 por tile sobre N=47 el pueblo no puede seguir entero").toBeLessThan(47);
    expect(vivos + countTiles(game, TILE_DEAD_TREE), "ni se crean ni se pierden árboles").toBe(47);
  });

  it("★ el canal es VOLÁTIL: la marchitación NO viaja a mapOverrides (#113/#119)", () => {
    const state = makeState({ shadowlordLocs: [MAGINCIA, 0xff, 0xff] });
    const game = enterTown(MAGINCIA, state);
    expect(
      countTiles(game, TILE_DEAD_TREE),
      "precondición: algo tiene que haber muerto para que el canal sea medible",
    ).toBeGreaterThan(0);
    expect(
      Object.keys(state.mapOverrides ?? {}),
      "el terreno de small map NO se persiste (0x6608 fuera de SAVED.GAM)",
    ).toEqual([]);
  });

  it("MISMO DÍA ⇒ mismo patrón; día distinto ⇒ patrón distinto (srand(g_day), 0x022a)", () => {
    const patron = (day: number): string => {
      const game = enterTown(
        MAGINCIA,
        makeState({
          shadowlordLocs: [MAGINCIA, 0xff, 0xff],
          time: { year: 139, month: 4, day, hour: 8, minute: 35 },
        }),
      );
      const out: string[] = [];
      for (let x = 0; x < 32; x++) if (game.activeMap.tileAt(x, 0) === TILE_DEAD_TREE) out.push(`${x}`);
      return out.join(",");
    };
    expect(patron(7)).toBe(patron(7));
    expect(patron(7)).not.toBe(patron(8));
  });

  it("★ caso DEGENERADO (Moonglow, N=0): el SL SÍ está, y aun así no cambia una brizna", () => {
    // La trampa que registra el acta: quien sondee aquí ve «no pasa nada» y concluye que la
    // mecánica no existe. El discriminador es que el SL está COLOCADO —su sprite 0xFC está
    // en el mapa— y aun así no muere vegetación, porque no la hay.
    const game = enterTown(MOONGLOW, makeState({ shadowlordLocs: [MOONGLOW, 0xff, 0xff] }));
    // El sprite del SL sale por `activeMap.tileAt` en el banco de MÓVILES (0xFC + 0x100 =
    // 0x1FC, ShadowLord1) desde 22be20b6 (#195, fix del «soplador»: el dato del objeto
    // sigue siendo 0xFC, lo que se movió es lo que esta vía COMPUESTA devuelve — igual
    // que la nave de ship-object.test.ts, `0x25 + ACTOR_TILE_BANK`).
    expect(
      countTiles(game, SHADOWLORD_TILE + ACTOR_TILE_BANK),
      "precondición: el SL está colocado",
    ).toBe(1);
    expect(countTiles(game, TILE_GRASS), "todo lo demás sigue siendo hierba").toBe(32 * 32 - 1);
  });

  it("★ STONEGATE tiene N=8 elegibles y NO marchita: la guarida no está «ocupada»", () => {
    // El discriminador entre «hay vegetación» y «hay Shadowlord COLOCADO»: en Stonegate se
    // anuncian los tres vivos (TOWN 0x1275) pero g_shadowlord_here_idx sigue 0xFF porque
    // ningún `g_shadowlord_locs[i]` vale 0x1d — la tabla los pone en ciudades 1..8.
    const game = enterTown(STONEGATE, makeState({ shadowlordLocs: [2, 5, 7] }));
    expect(countTiles(game, TILE_TREE), "los 8 árboles de Stonegate siguen vivos").toBe(8);
  });
});
