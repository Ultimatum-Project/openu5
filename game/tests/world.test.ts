/**
 * Tests del mundo con los assets REALES extraídos (game/assets/).
 * Si fallan por ausencia de assets: ejecutar `npm run extract` primero.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { getActiveMap, type WorldData, type SmallMapLocation } from "../src/core/world/map.js";
import { isPassable, tryMove, resolveStep, locationAt } from "../src/core/world/movement.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), "../assets");
const readJson = <T>(p: string): T =>
  JSON.parse(readFileSync(`${ASSETS}/${p}`, "utf-8")) as T;

let world: WorldData;
let init: ExtractedInitialState;

beforeAll(() => {
  const smallMapsRaw = readJson<SmallMapLocation[]>("maps/smallmaps.json");
  world = {
    overworld: readJson("maps/overworld.json"),
    underworld: readJson("maps/underworld.json"),
    smallMaps: new Map(smallMapsRaw.map((l) => [l.id, l])),
  };
  init = readJson("initial-state.json");
});

const newGame = (): GameState => createNewGame(init);

describe("mundo real extraído", () => {
  it("el overworld es 256×256 y la esquina NW es agua", () => {
    const map = getActiveMap(world, 0, 0);
    expect(map.width).toBe(256);
    expect(map.tileAt(0, 0)).toBe(1); // Water1 (chunk disperso)
  });

  it("el overworld wrappea este-oeste y norte-sur", () => {
    const map = getActiveMap(world, 0, 0);
    expect(map.tileAt(-1, 0)).toBe(map.tileAt(255, 0));
    expect(map.tileAt(0, -1)).toBe(map.tileAt(0, 255));
  });

  it("la partida nueva empieza en Iolo's Hut (location 13) sobre tile transitable", () => {
    const state = newGame();
    expect(state.position.location).toBe(13);
    const map = getActiveMap(world, 13, 0);
    const tile = map.tileAt(state.position.x, state.position.y);
    expect(isPassable(tile, "foot")).toBe(true);
  });

  it("moverse sobre tile transitable avanza posición y reloj", () => {
    const state = newGame();
    state.position = { location: 0, floor: 0, x: 84, y: 106 }; // cerca de Iolo's Hut, overworld
    // busca una dirección transitable desde aquí
    const before = { ...state.position };
    const minutesBefore = state.time.minute;
    const result = tryMove(state, getActiveMap(world, state.position.location, state.position.floor), "north");
    expect(result.exitedMap).toBe(false);
    const movedOrBlocked =
      (result.moved && (state.position.x !== before.x || state.position.y !== before.y)) ||
      (!result.moved && result.message === "Blocked!");
    expect(movedOrBlocked).toBe(true);
    expect(
      state.time.minute !== minutesBefore || state.time.hour !== 8,
    ).toBe(true); // el turno siempre avanza el reloj
    expect(state.turnsSinceStart).toBe(1);
  });

  it("no se puede caminar sobre el agua, sí navegar", () => {
    expect(isPassable(1, "foot")).toBe(false);
    expect(isPassable(1, "ship")).toBe(true);
  });

  it("salir por el borde de un small map devuelve exitedMap", () => {
    const state = newGame(); // Iolo's Hut, planta 0
    state.position.x = 0;
    state.position.y = 15;
    const result = tryMove(state, getActiveMap(world, state.position.location, state.position.floor), "west");
    expect(result.exitedMap).toBe(true);
  });

  it("borde de pueblo: el destino (relleno del viewport) se valida ANTES de salir (TOWN 0x788)", () => {
    // El binario valida la transitabilidad del tile de destino antes de abrir el
    // prompt de salida; al pisar fuera del 32×32 ese destino es el relleno del
    // viewport = Grass (5), transitable a pie/caballo/alfombra, así que una salida
    // a pie SIEMPRE pasa el gate (por eso el comportamiento observable a pie no
    // cambia). Para EJERCITAR el gate usamos un transporte para el que Grass es
    // intransitable (barco: isPassable(5,"ship")=false); el paso al borde produce
    // "Blocked!" en vez de exitedMap y cobra el minuto de pueblo (0x15D4). Es un
    // estado sintético (no hay barcos en pueblo) que prueba la regla pura.
    expect(isPassable(5, "foot")).toBe(true);
    expect(isPassable(5, "ship")).toBe(false);

    const map = getActiveMap(world, 13, 0);

    const onFoot = newGame();
    onFoot.position.x = 0;
    onFoot.position.y = 15;
    onFoot.transport = "foot";
    expect(tryMove(onFoot, map, "west").exitedMap).toBe(true); // Grass transitable → sale

    const blocked = newGame();
    blocked.position.x = 0;
    blocked.position.y = 15;
    blocked.transport = "ship";
    const minBefore = blocked.time.minute;
    const res = tryMove(blocked, map, "west");
    expect(res.exitedMap).toBe(false);
    expect(res.message).toBe("Blocked!");
    expect(blocked.time.minute).toBe(minBefore + 1); // pueblo bloqueado = 1 min

    // resolveStep (ruta viva) refleja la misma decisión sin consumir el turno.
    const geo = newGame();
    geo.position.x = 0;
    geo.position.y = 15;
    geo.transport = "ship";
    const step = resolveStep(geo, map, "west");
    expect(step.exitedMap).toBe(false);
    expect(step.blocked).toBe(true);
    expect(step.message).toBe("Blocked!");
    expect(step.minutes).toBe(1);
  });

  it("locationAt encuentra locations del overworld (datos DATA.OVL)", () => {
    const data = readJson<{ locationsX: number[]; locationsY: number[] }>("data.json");
    expect(data.locationsX.length).toBe(40);
    // Iolo's Hut es la location 13: su índice 12 en las tablas
    const id = locationAt(data.locationsX, data.locationsY, data.locationsX[12]!, data.locationsY[12]!);
    expect(id).toBe(13);
  });
});
