/**
 * GUARDA #272 (fix de la derivación #270): al salir de la fragata, la nave se AMARRA como
 * objeto del mundo en las TRES ramas — tierra, esquife y alfombra — y cada una se lleva los
 * esquifes que dice el binario.
 *
 * POR QUÉ EXISTE: el usuario grabó (#264, fotograma 11) que al hacer X-it en mar abierto el
 * barco DESAPARECÍA. La causa no era render ni importación: `exitTransport` sólo fijaba
 * `parkedShipTile` en la rama de tierra, así que las otras dos consumían la fragata. La
 * derivación (`re/notes/xit-esquife-270.md`) midió que en `cmd_xit` (CMDS.OVL:0x0EB4) las tres
 * ramas guardan el MISMO `[bp-2]` —el byte de la nave— y convergen en la cola 0x0FF4, que
 * emite el objeto: **el binario conserva en las tres**.
 *
 * LA CONTABILIDAD, que es la parte que un fix por simetría se salta (§4 de la nota):
 *   tierra    0x0FB5 `mov al,[skiffs]` SIN dec   → el objeto se lleva TODOS
 *   esquife   0x0FCF `dec al`                    → el objeto se lleva N−1 (uno te lo llevas)
 *   alfombra  salta a 0x0FB5, decrementa CARPETS → el objeto se lleva TODOS
 * En el port eso NO está ramificado en `game.ts`: sale del ORDEN entre los dos ficheros
 * (`exitTransport` muta `state.shipSkiffs` y `exitVehicle` lo lee después). Un acoplamiento
 * así se rompe en silencio, así que aquí va un caso por rama con su cifra.
 *
 * 🔴 FUERA DE ALCANCE, declarado: que `state.shipSkiffs` siga existiendo como contador GLOBAL
 * del jugador además del `skiffs` del objeto es la división de pool de #103/#231, y no se
 * toca aquí. Esta guarda fija lo que se lleva el OBJETO, que es lo que #270 derivó.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { ACTOR_TILE_BANK, Game, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import {
  TILE_FOOT,
  TILE_CARPET,
  TILE_FRIGATE_SAILS_DOWN,
  TILE_SKIFF,
} from "../src/core/world/transport.js";
import { TILE_BY_NAME } from "../src/core/tiles.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const freshState = (): GameState =>
  createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));

/** Tiles por NOMBRE, no por número mágico: `Water1` no es caminable, `Grass` sí. */
const WATER = TILE_BY_NAME.get("Water1")!;
const GRASS = TILE_BY_NAME.get("Grass")!;

const AT = { x: 100, y: 100 };
const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };

/** Mar abierto; con `conTierra`, una casilla de hierba al ESTE (predicado 0x073E ortogonal). */
const world = (conTierra: boolean): WorldData => {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => WATER));
  if (conTierra) overworld[AT.y]![AT.x + 1] = GRASS;
  return { overworld, underworld: overworld, smallMaps: new Map() };
};

function salirDeLaFragata(over: {
  conTierra: boolean;
  skiffs: number;
  carpets: number;
}): { state: GameState; game: Game } {
  const state = freshState();
  state.position = { location: 0, floor: 0, x: AT.x, y: AT.y };
  state.transportTile = TILE_FRIGATE_SAILS_DOWN;
  state.transport = "ship";
  state.shipSkiffs = over.skiffs;
  state.magicCarpets = over.carpets;
  state.shipHull = 42; // casco reconocible: viaja al objeto (campo +5 del binario)
  state.worldObjects = [];
  const game = new Game(
    {} as ExtractedInitialState,
    world(over.conTierra),
    gameData,
    state,
    {},
  );
  game.exitVehicle();
  return { state, game };
}

/** La nave amarrada que dejó el X-it, o undefined si no se emitió ninguna. */
const naveAmarrada = (state: GameState) =>
  (state.worldObjects ?? []).find((o) => o.kind === "ship");

describe("X-it de fragata: la nave se AMARRA en las TRES ramas (#270/#272)", () => {
  it("TIERRA: amarra con TODOS los esquifes y el jugador queda a pie", () => {
    const { state } = salirDeLaFragata({ conTierra: true, skiffs: 3, carpets: 0 });
    const nave = naveAmarrada(state);
    expect(nave).toBeDefined();
    expect(nave!.tile).toBe(TILE_FRIGATE_SAILS_DOWN + ACTOR_TILE_BANK);
    expect(nave!.hull).toBe(42);
    expect(nave!.skiffs).toBe(3); // 0x0FB5: sin `dec`
    expect(state.transportTile).toBe(TILE_FOOT);
  });

  it("ESQUIFE (sin tierra): amarra con N−1 y el jugador sale EN esquife", () => {
    const { state } = salirDeLaFragata({ conTierra: false, skiffs: 3, carpets: 0 });
    const nave = naveAmarrada(state);
    // EL ASERTO DEL DEFECTO DEL VÍDEO: antes del fix no había objeto ninguno.
    expect(nave).toBeDefined();
    expect(nave!.tile).toBe(TILE_FRIGATE_SAILS_DOWN + ACTOR_TILE_BANK);
    expect(nave!.skiffs).toBe(2); // 0x0FCF `dec al`: el que te llevas sale de la nave
    expect(state.transportTile).toBe(TILE_SKIFF); // 0x24 + 4
  });

  it("ALFOMBRA (sin tierra, sin esquifes): amarra con TODOS y gasta una ALFOMBRA", () => {
    const { state } = salirDeLaFragata({ conTierra: false, skiffs: 0, carpets: 2 });
    const nave = naveAmarrada(state);
    expect(nave).toBeDefined();
    expect(nave!.skiffs).toBe(0); // salta a 0x0FB5: sin `dec` (aquí no hay ninguno que llevarse)
    expect(state.magicCarpets).toBe(1); // 0x0FDD: lo consumido es la alfombra
    expect(state.transportTile).toBe(TILE_CARPET);
  });

  /**
   * CONTROL NEGATIVO: la cuarta rama del binario (0x0FEE) NO sale — imprime «No skiffs on
   * board!» y retorna sin tocar nada. Sin este caso, un fix que amarrase SIEMPRE (incluso al
   * fallar) pasaría los tres asertos de arriba y dejaría al jugador con una nave duplicada:
   * una amarrada y otra bajo los pies.
   */
  it("CONTROL: sin tierra, sin esquifes y sin alfombras NO amarra nada y sigues a bordo", () => {
    const { state } = salirDeLaFragata({ conTierra: false, skiffs: 0, carpets: 0 });
    expect(naveAmarrada(state)).toBeUndefined();
    expect(state.transportTile).toBe(TILE_FRIGATE_SAILS_DOWN);
  });

  /**
   * EL ACOPLAMIENTO DE ORDEN, explícito: los esquifes del objeto los lee `exitVehicle` de
   * `state.shipSkiffs` DESPUÉS de que `exitTransport` haya mutado. Este caso lo fija como
   * propiedad observable —la rama del esquife es la ÚNICA que resta— para que mover el
   * decremento no pueda pasar en silencio.
   */
  it("sólo la rama del ESQUIFE resta: mismo N inicial, dos cifras distintas en el objeto", () => {
    const tierra = salirDeLaFragata({ conTierra: true, skiffs: 3, carpets: 0 });
    const mar = salirDeLaFragata({ conTierra: false, skiffs: 3, carpets: 0 });
    expect(naveAmarrada(tierra.state)!.skiffs).toBe(3);
    expect(naveAmarrada(mar.state)!.skiffs).toBe(2);
    expect(naveAmarrada(tierra.state)!.skiffs! - naveAmarrada(mar.state)!.skiffs!).toBe(1);
  });
});
