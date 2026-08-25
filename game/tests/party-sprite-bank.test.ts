/**
 * GUARDA DE REGRESIÓN — TODO tile que la piel puede pintar para la PARTY va en BANCO
 * ALTO (≥ `ACTOR_TILE_BANK` = 0x100).
 *
 * POR QUÉ EXISTE (#264, reporte del usuario con vídeo del 14-08): `CoreViewImpl.avatarTile()`
 * mezclaba LOS DOS ESPACIOS DE TILE (#137 · `re/notes/board-137-acta.md` §2) en un solo
 * `return`. El predicado `onFoot` compara contra BYTES (`0x1c`/`0x1d`, que es lo que modela
 * `core/world/transport.ts` para `g_transport_tile`), pero la rama MONTADA devolvía ese byte
 * EN CRUDO a un consumidor que lo indexa como TILE COMPLETO — mientras la rama a pie sí
 * devolvía banco alto. Efecto en pantalla: al abordar la fragata, `transportTile` = 0x24 se
 * pintaba como el TERRENO 0x24 (el «tile de basura» del fotograma 6 del vídeo), y lo mismo en
 * TODA travesía de TODO vehículo desde el contrato de pieles — anterior a #137.
 *
 * POR QUÉ NO LO CAZÓ NADIE: la capa de OBJETOS del mundo sí guarda el tile completo (0x124),
 * así que la nave fondeada se pintaba bien; y los specs navales asertan ESTADO (`transportTile`,
 * `mode`) con cabecera declarando «nunca píxeles». Un bug visible en cada travesía con la suite
 * legítimamente verde. Por eso esta guarda NO asertan estado: pregunta por LO QUE SE PINTA.
 *
 * QUÉ VIGILA, y por qué en la VENTANA y no llamando a `avatarTile()`: esa función es privada y,
 * sobre todo, no es el sujeto — el sujeto es la celda que la piel recibe. Se lee el centro de
 * `snapshot().window` (donde el core hornea la party) y el actor de motion `id="party"` (la vía
 * del shader, que es la piel DE FÁBRICA): los DOS consumidores del mismo valor.
 *
 * POBLACIÓN, derivada de la cabecera de `core/world/transport.ts` (codificación de
 * `g_transport_tile`, DS 0x587C) y NO de literales copiados aquí:
 *   a pie      0x1C visible · 0x1D invisible · `undefined` (partida nueva)
 *   caballo    0x12/0x13 (montado E/O — el `+2` de `board`; 0x10/0x11 es el del MUNDO, sin jinete)
 *   alfombra   0x14/0x15
 *   fragata    0x20-0x23 velas izadas · 0x24-0x27 arriadas   (4 facings: `(tile&0xFC)+facing`)
 *   esquife    0x28-0x2B
 * más las POSES a pie, que salen por otra rama (`poseSpriteForTile`): sillas 0x90-0x93 y la
 * cabecera de cama 0xab, cuyo sprite depende del tile BAJO el líder, no del transporte.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { ACTOR_TILE_BANK, Game, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import {
  TILE_FOOT,
  TILE_INVISIBLE,
  TILE_HORSE,
  TILE_CARPET,
  TILE_FRIGATE_SAILS_UP,
  TILE_FRIGATE_SAILS_DOWN,
  TILE_SKIFF,
} from "../src/core/world/transport.js";
import { LEFT_BED_TILE } from "../src/skin/partyPose.js";
import { CoreViewImpl } from "../src/skin/coreview.js";
import { VIEW_WINDOW, VIEW_HALF } from "../src/skin/api.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const freshState = (): GameState =>
  createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));

/** Mundo de hierba 256×256 con una casilla sembrable bajo la party (para las poses). */
const world = (underParty: number, at: { x: number; y: number }): WorldData => {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  overworld[at.y]![at.x] = underParty;
  return { overworld, underworld: overworld, smallMaps: new Map() };
};
const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };

const PARTY_AT = { x: 100, y: 100 };
const CENTER_CELL = VIEW_HALF * VIEW_WINDOW + VIEW_HALF;

/**
 * Lo que la piel recibe para la party: [celda central de la ventana, tile del actor de
 * motion "party"]. Mediodía y sin antorchas — el centro nunca se censura, pero el régimen
 * de luz queda fijado para que la guarda no dependa de la hora de la partida nueva.
 */
function paintedForParty(over: {
  transportTile?: number;
  underParty?: number;
}): [number, number | undefined] {
  const state = freshState();
  state.position = { location: 0, floor: 0, x: PARTY_AT.x, y: PARTY_AT.y };
  state.time = { ...state.time, hour: 12, minute: 0 };
  state.transportTile = over.transportTile;
  const game = new Game(
    {} as ExtractedInitialState,
    world(over.underParty ?? 5, PARTY_AT),
    gameData,
    state,
    {},
  );
  const snap = new CoreViewImpl(game).snapshot();
  const party = snap.actors?.find((a) => a.id === "party");
  return [snap.window[CENTER_CELL]!, party?.tile];
}

/** Facings 0..3 de un tile base de barco (`(tile&0xFC)+facing`, transport_face 0x0152). */
const facings = (base: number): number[] => [0, 1, 2, 3].map((f) => base + f);

describe("todo tile que la piel pinta para la party está en BANCO ALTO (#264)", () => {
  const MOUNTED: readonly [string, number][] = [
    ["caballo montado E", TILE_HORSE + 2],
    ["caballo montado O", TILE_HORSE + 3],
    ["alfombra E", TILE_CARPET],
    ["alfombra O", TILE_CARPET + 1],
    ...facings(TILE_FRIGATE_SAILS_UP).map(
      (t, i) => [`fragata velas izadas facing ${i}`, t] as [string, number],
    ),
    ...facings(TILE_FRIGATE_SAILS_DOWN).map(
      (t, i) => [`fragata velas arriadas facing ${i}`, t] as [string, number],
    ),
    ...facings(TILE_SKIFF).map((t, i) => [`esquife facing ${i}`, t] as [string, number]),
  ];

  it.each(MOUNTED)("montado en %s: la celda central NO es el byte pelado", (_label, byte) => {
    const [center, motion] = paintedForParty({ transportTile: byte });
    // EL ASERTO DEL DEFECTO: sin `+ ACTOR_TILE_BANK` esto valdría `byte` (0x24 = terreno).
    expect(center).toBeGreaterThanOrEqual(ACTOR_TILE_BANK);
    expect(center).toBe(byte + ACTOR_TILE_BANK);
    // El shader (piel de fábrica) consume el MISMO valor por otra vía: los dos o ninguno.
    expect(motion).toBe(center);
  });

  const ON_FOOT: readonly [string, number | undefined][] = [
    ["a pie visible", TILE_FOOT],
    ["a pie INVISIBLE", TILE_INVISIBLE],
    ["sin transportTile (partida nueva)", undefined],
  ];

  it.each(ON_FOOT)("a pie (%s): banco alto", (_label, byte) => {
    const [center, motion] = paintedForParty({ transportTile: byte });
    expect(center).toBeGreaterThanOrEqual(ACTOR_TILE_BANK);
    expect(motion).toBe(center);
  });

  const POSES: readonly [string, number][] = [
    ["silla respaldo Forward", 0x90],
    ["silla respaldo Left", 0x91],
    ["silla respaldo Back", 0x92],
    ["silla respaldo Right", 0x93],
    ["cabecera de cama", LEFT_BED_TILE],
  ];

  it.each(POSES)("pose a pie sobre %s: banco alto", (_label, under) => {
    const [center, motion] = paintedForParty({ transportTile: TILE_FOOT, underParty: under });
    expect(center).toBeGreaterThanOrEqual(ACTOR_TILE_BANK);
    expect(motion).toBe(center);
  });

  /**
   * CONTROL DE INSTRUMENTO: que el aserto de arriba pueda FALLAR. Si el arnés no pintase la
   * party en el centro (mundo mal montado, modo que no es `world`, censura tapando el centro),
   * todos los asertos pasarían por leer TERRENO de banco bajo... salvo que el terreno de este
   * mundo es 5, que NO está en banco alto: el control lo hace explícito leyendo una celda
   * VECINA y exigiendo que sea terreno pelado. Sin él, un arnés roto se leería como guarda viva.
   */
  it("CONTROL: el terreno vecino SÍ está en banco bajo (el arnés distingue party de suelo)", () => {
    const state = freshState();
    state.position = { location: 0, floor: 0, x: PARTY_AT.x, y: PARTY_AT.y };
    state.time = { ...state.time, hour: 12, minute: 0 };
    state.transportTile = TILE_FRIGATE_SAILS_DOWN;
    const game = new Game({} as ExtractedInitialState, world(5, PARTY_AT), gameData, state, {});
    const win = new CoreViewImpl(game).snapshot().window;
    expect(win[CENTER_CELL]).toBe(TILE_FRIGATE_SAILS_DOWN + ACTOR_TILE_BANK);
    expect(win[CENTER_CELL + 1]).toBeLessThan(ACTOR_TILE_BANK);
  });
});
