/**
 * GUARDA de los dos colaterales DECLARADOS de #273 (re/notes/xit-pila-273.md §7.1/§7.2),
 * derivados de cmd_xit (CMDS.OVL 0x0EB4) y verificados instrucción a instrucción sobre
 * re/disasm/CMDS.OVL.asm en este carril:
 *
 * PIEZA A — el X-it del ESQUIFE deja el esquife en el mundo (ruta C, 0x0F72-0x0F9A):
 *   0x0F90 imprime "skiff!" (DS 0x43CA) · 0x0F97 `mov al,[g_transport_tile]` ·
 *   0x0F9A `jmp 0x0F6C` — entra en la rama del caballo SALTÁNDOSE su `sub al,2`
 *   (0x0F6A), o sea `[bp-2]` = el tile del esquife TAL CUAL (0x28-0x2B, facing
 *   preservado) · 0x0F43 `g_transport_tile = 0x1C` · cola 0x0FF4 emite el objeto en la
 *   celda del party (0x1003/0x1007 push party_x/party_y → place 0x7AF4). El port
 *   devolvía sólo `transportTile: TILE_FOOT` y el esquife se EVAPORABA (familia del
 *   fotograma 11 de #264/#270).
 *
 * PIEZA B — 2ª vía de aceptación del X-it de ALFOMBRA (ruta A, 0x0F20-0x0F36):
 *   0x0F20 `call 0x73E` (tierra ORTOGONAL); si devuelve 0, NO rechaza aún:
 *   0x0F27 `push 0x1C` · 0x0F2B `push [bp-6]` (tile bajo el party) · 0x0F31
 *   `call 0x6CCC` — resuelto con dispatch_table/verify_cites (base near-call de
 *   CMDS.OVL = 0xBF80 ⇒ kernel ULTIMA.EXE 0x2C4C, test de passability por CLASE;
 *   0x1C>>2=7 = modo a pie). Si ≠0 acepta igual (isla de 1 tile). La MISMA primitiva
 *   cierra cada ortogonal de 0x73E (CMDS 0x0788:0x07A6-0x07AD `0x6CCC(0x1C, tile)`),
 *   así que el predicado del port para ambas es el mismo `tileInfo().walkable`.
 *   El rechazo (ambas vías a 0) re-llama 0x73E en 0x0F4C y cae en DS 0x4386
 *   "\nNo land nearby!\n". El port sólo miraba `landNearby`.
 *
 * PIEZA ADYACENTE (necesaria para el round-trip de A) — (B)oard del esquife SIN `+2`:
 *   la rama skiff de cmd_board (CMDS 0x0898-0x08B5) hace 0x08B2 `mov al,[bp-0xa]`
 *   (el byte del objeto) y 0x08B5 `jmp 0x0875` — DIRECTO al store, saltándose el
 *   `add al,2` de 0x0873, que es EXCLUSIVO del caballo (0x0870-0x0873). El port
 *   hacía `worldTile + 2`: re-abordar un esquife aparcado 0x2A/0x2B daba 0x2C/0x2D
 *   (clase de nave suelta / inválida) y 0x28/0x29 cambiaba el facing.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import {
  board,
  exitTransport,
  TILE_FOOT,
  TILE_CARPET,
  TILE_SKIFF,
} from "../src/core/world/transport.js";
import { TILE_BY_NAME } from "../src/core/tiles.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const freshState = (): GameState =>
  createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));

const WATER = TILE_BY_NAME.get("Water1")!;
const GRASS = TILE_BY_NAME.get("Grass")!;
const AT = { x: 100, y: 100 };
const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };

/**
 * Mar abierto. `tierraOrtogonal` pone hierba al ESTE (para 0x73E);
 * `tierraDebajo` pone hierba BAJO el party (para la 2ª vía 0x0F2B).
 */
const world = (opts: { tierraOrtogonal?: boolean; tierraDebajo?: boolean }): WorldData => {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => WATER));
  if (opts.tierraOrtogonal) overworld[AT.y]![AT.x + 1] = GRASS;
  if (opts.tierraDebajo) overworld[AT.y]![AT.x] = GRASS;
  return { overworld, underworld: overworld, smallMaps: new Map() };
};

function juego(transportTile: number, mundo: WorldData): { state: GameState; game: Game } {
  const state = freshState();
  state.position = { location: 0, floor: 0, x: AT.x, y: AT.y };
  state.transportTile = transportTile;
  state.worldObjects = [];
  const game = new Game({} as ExtractedInitialState, mundo, gameData, state, {});
  return { state, game };
}

const overrideEn = (state: GameState, x: number, y: number): number | undefined =>
  state.mapOverrides?.[`0:0:${x}:${y}`];

// ── PIEZA A · función pura ─────────────────────────────────────────────────────

describe("X-it de esquife: el esquife se APARCA (cmd_xit ruta C, 0x0F72-0x0F9A)", () => {
  it("deja dropTile = tile del esquife TAL CUAL, facing preservado (0x0F97 sin el −2)", () => {
    // Esperados EN CRUDO: 0x29 aparca 0x29, 0x2b aparca 0x2b — no `transport − 2`
    // (el −2 es del caballo, 0x0F6A; la ruta C entra en 0x0F6C, DESPUÉS de él).
    const st = freshState();
    const r = exitTransport(st, 0x29, true);
    expect(r.ok).toBe(true);
    expect(r.transportTile).toBe(0x1c); // g_transport_tile = 0x1C (0x0F43)
    expect(r.dropTile).toBe(0x29);
    expect(exitTransport(st, 0x2b, true).dropTile).toBe(0x2b);
  });

  it("CONTROL: los rechazos de la ruta C no aparcan nada", () => {
    const st = freshState();
    expect(exitTransport(st, TILE_SKIFF, false).dropTile).toBeUndefined(); // sin tierra
    expect(exitTransport(st, TILE_SKIFF, true, true).dropTile).toBeUndefined(); // agua 0x6A
  });
});

// ── PIEZA A · cableado (Game) ─────────────────────────────────────────────────

describe("X-it de esquife a nivel Game: aparca en la celda del party y se re-aborda", () => {
  it("round-trip: X-it deja el override 0x129 y (B)oard vuelve a montar 0x29", () => {
    const { state, game } = juego(0x29, world({ tierraOrtogonal: true }));
    const ev = game.exitVehicle();
    expect(ev.some((e) => e.kind === "message" && e.text === "skiff!")).toBe(true);
    expect(state.transportTile).toBe(0x1c);
    // La cola 0x0FF4 coloca el objeto en (party_x, party_y); capa de mundo = banco alto (#137).
    expect(overrideEn(state, AT.x, AT.y)).toBe(0x129);
    // Re-abordar: cmd_board rama skiff 0x08B2→0x0875 SIN `add al,2`.
    game.board();
    expect(state.transportTile).toBe(0x29);
    expect(overrideEn(state, AT.x, AT.y), "el esquife abordado sale del mundo (0x093E)").toBeUndefined();
  });
});

// ── PIEZA ADYACENTE · board sin +2 ────────────────────────────────────────────

describe("(B)oard de esquife: tile del objeto TAL CUAL (0x08B2 → jmp 0x0875, sin el add de 0x0873)", () => {
  it("0x28→0x28 y 0x2b→0x2b (con +2, 0x2b daba 0x2d = fuera de la clase esquife)", () => {
    const st = freshState();
    expect(board(st, 0x28, TILE_FOOT).transportTile).toBe(0x28);
    expect(board(st, 0x2b, TILE_FOOT).transportTile).toBe(0x2b);
  });

  it("CONTROL POSITIVO del vecino: el caballo SÍ suma 2 (0x0870-0x0873)", () => {
    const st = freshState();
    expect(board(st, 0x10, TILE_FOOT).transportTile).toBe(0x12);
  });
});

// ── PIEZA B · función pura ─────────────────────────────────────────────────────

describe("X-it de alfombra: 2ª vía de aceptación (0x0F27-0x0F36, kernel 0x2C4C)", () => {
  it("sin tierra ortogonal pero con suelo pisable a pie → acepta (isla de 1 tile)", () => {
    const st = freshState();
    const r = exitTransport(st, TILE_CARPET, false, false, true);
    expect(r.ok).toBe(true);
    expect(r.message).toBe("carpet!"); // DS 0x437D
    expect(r.transportTile).toBe(0x1c);
    expect(r.dropTile).toBe(0x1b); // literal 0x0F3F
  });

  it("CONTROL: sin tierra ortogonal NI suelo pisable → No land nearby! (DS 0x4386)", () => {
    const st = freshState();
    expect(exitTransport(st, TILE_CARPET, false, false, false)).toEqual({
      ok: false,
      message: "No land nearby!",
    });
  });

  it("CONTROL: la 1ª vía (tierra ortogonal) sigue aceptando sin mirar el suelo", () => {
    const st = freshState();
    const r = exitTransport(st, TILE_CARPET, true, false, false);
    expect(r.ok).toBe(true);
    expect(r.dropTile).toBe(0x1b);
  });

  it("la 2ª vía es de la ALFOMBRA, no del esquife: la ruta C sigue exigiendo 0x73E", () => {
    // En cmd_xit el `call 0x6CCC` de 0x0F31 vive SOLO en la ruta A (0x0F20-0x0F36);
    // la ruta C (0x0F72) rechaza con 0x73E==0 sin segunda oportunidad.
    const st = freshState();
    expect(exitTransport(st, TILE_SKIFF, false, false, true)).toEqual({
      ok: false,
      message: "No land nearby!",
    });
  });
});

// ── PIEZA B · cableado (Game) ─────────────────────────────────────────────────

describe("X-it de alfombra a nivel Game: isla de 1 tile", () => {
  it("party sobre hierba rodeada de agua: acepta y deja la alfombra (0x11B)", () => {
    const { state, game } = juego(TILE_CARPET, world({ tierraDebajo: true }));
    const ev = game.exitVehicle();
    expect(ev.some((e) => e.kind === "message" && e.text === "carpet!")).toBe(true);
    expect(state.transportTile).toBe(0x1c);
    expect(overrideEn(state, AT.x, AT.y)).toBe(0x11b);
  });

  it("CONTROL: todo agua (ni ortogonal ni debajo) → rechaza y sigue en alfombra", () => {
    const { state, game } = juego(TILE_CARPET, world({}));
    const ev = game.exitVehicle();
    expect(ev.some((e) => e.kind === "message" && e.text === "No land nearby!")).toBe(true);
    expect(state.transportTile).toBe(TILE_CARPET);
    expect(overrideEn(state, AT.x, AT.y)).toBeUndefined();
  });
});
