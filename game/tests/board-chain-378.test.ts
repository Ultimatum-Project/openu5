/**
 * GUARDA de #378 — la cadena fragata→caballo→a pie→re-abordar: hull/skiffs se CONSERVAN.
 *
 * El cabo de re/notes/trama-nativa-238-231.md §3 decía «el binario dejaría hull/skiffs a 0
 * vía el epílogo de board 0x093E» y estaba SIN MEDIR. Derivado en crudo (re/notes/
 * board-epilogo-378.md, sobre re/disasm/CMDS.OVL.asm + ULTIMA.EXE.asm con
 * verify_cites.resolve) y medido en vivo (re/tools/probe_board_chain_378.py):
 *
 *  - El epílogo 0x093E-0x0949 de cmd_board empuja SEIS ceros + la ranura del objeto
 *    ABORDADO a `write_object_record` (CMDS `call 0x7af4` ⇒ kernel 0x3A74), que escribe
 *    SOLO +0..+5 del registro `0x5C5A + ranura·8`. La ranura es ≥1 SIEMPRE (el finder
 *    0x368E arranca en dx=1/si=0x5C62 y barre hasta 0x5D5A): el epílogo NO puede tocar
 *    la ranura 0 (g_hull 0x5C5F = obj0+5, g_skiffs 0x5C61 = obj0+7).
 *  - g_hull/g_skiffs solo los escribe la rama FRAGATA de cmd_board (0x08F4/0x0936,
 *    copiando +5/+7 del registro abordado). Caballo (0x083B-0x0878), alfombra
 *    (0x087C-0x0895) y esquife (0x08A1-0x08B5) NO los tocan.
 *  - Al re-abordar la fragata, hull/skiffs vuelven de SU registro amarrado, que cmd_xit
 *    escribió (+5 = g_hull en la cola 0x100F-0x1016; +7 = [bp-8] en 0x1020-0x1023).
 *
 * ⇒ el binario CONSERVA a través de la cadena — lo mismo que el port hace en estado.
 * Esta guarda sella (a) la conducta de la cadena a nivel Game y (b) los DOS escritores
 * de export que seguían la premisa refutada («board vuelca el registro del objeto
 * abordado a slot0») escribiendo 0 con caballo/alfombra/esquife activos: obj0+5/+7 de
 * exportNativeSave y el registro 0 de buildNativeOol.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import {
  exportNativeSave,
  importNativeSave,
  buildNativeOol,
  SAVED_GAM_SIZE,
} from "../src/core/saveNative.js";
import { TILE_BY_NAME } from "../src/core/tiles.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const freshState = (): GameState =>
  createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));

const WATER = TILE_BY_NAME.get("Water1")!;
const GRASS = TILE_BY_NAME.get("Grass")!;
const AT = { x: 100, y: 100 }; // celda de la fragata (agua)
const LAND = { x: 101, y: 100 }; // hierba ortogonal (0x73E) — aquí pasta el caballo
const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };

/** Mar abierto con una lengua de hierba al ESTE de AT. */
const mundo = (): WorldData => {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => WATER));
  overworld[LAND.y]![LAND.x] = GRASS;
  overworld[LAND.y]![LAND.x + 1] = GRASS;
  return { overworld, underworld: overworld, smallMaps: new Map() };
};

function juego(): { state: GameState; game: Game } {
  const state = freshState();
  state.position = { location: 0, floor: 0, x: AT.x, y: AT.y };
  state.transportTile = 0x24; // fragata velas arriadas, facing W
  state.transport = "ship";
  state.shipHull = 0x2a; // casco DAÑADO (42 < 99): el valor que la cadena debe conservar
  state.shipSkiffs = 3;
  state.magicCarpets = 0;
  state.worldObjects = [];
  const game = new Game({} as ExtractedInitialState, mundo(), gameData, state, {});
  return { state, game };
}

describe("#378 · cadena fragata→caballo→a pie a nivel Game: hull/skiffs conservados", () => {
  it("X-it fragata → (B)oard caballo NO pisa shipHull/shipSkiffs (rama caballo 0x083B-0x0878)", () => {
    const { state, game } = juego();
    // 1 · X-it a tierra: la fragata se amarra como objeto con su hull/skiffs (cola 0x0FF4).
    const ev = game.exitVehicle();
    expect(ev.some((e) => e.kind === "message" && e.text === "ship!")).toBe(true);
    expect(state.transportTile).toBe(0x1c);
    const nave = state.worldObjects!.find((o) => o.kind === "ship")!;
    expect(nave.hull).toBe(0x2a); // +5 del registro = g_hull (cmd_xit 0x100F)
    expect(nave.skiffs).toBe(3); // +7 del registro (cmd_xit 0x1020-0x1023, rama tierra: todos)
    // 2 · a la hierba, donde espera un caballo (capa de objetos, #137).
    state.position = { ...state.position, x: LAND.x, y: LAND.y };
    game.setMapOverride(LAND.x, LAND.y, 0x110); // HorseRight (banco alto)
    game.board();
    expect(state.transportTile).toBe(0x12); // 0x0873 add al,2
    // EL CRUX del cabo: el epílogo 0x093E borra el registro del CABALLO (ranura ≥1),
    // jamás la ranura 0 — g_hull/g_skiffs quedan intactos.
    expect(state.shipHull).toBe(0x2a);
    expect(state.shipSkiffs).toBe(3);
  });

  it("…y al volver a la fragata, hull/skiffs vuelven del REGISTRO amarrado (0x08DC/0x08FE)", () => {
    const { state, game } = juego();
    game.exitVehicle();
    state.position = { ...state.position, x: LAND.x, y: LAND.y };
    game.setMapOverride(LAND.x, LAND.y, 0x110);
    game.board(); // a caballo
    game.exitVehicle(); // pie a tierra; el caballo queda aparcado
    expect(state.transportTile).toBe(0x1c);
    // La diferencia INSTANCIADA donde existe (doctrina del testigo elegido): en la cadena
    // de una sola nave, registro y estado coinciden y la siembra registro→slot0 no tiene
    // nada que exhibir (un mutante sin ella pasaba). En el binario el restore lee el
    // REGISTRO del objeto (0x08DC/0x08FE), no los globales — con DOS naves se distinguen:
    // simulamos el residuo de otra fragata en los globales antes de re-abordar ésta.
    state.shipHull = 0x63;
    state.shipSkiffs = 1;
    // 3 · de vuelta a la nave amarrada.
    state.position = { ...state.position, x: AT.x, y: AT.y };
    game.board();
    expect(state.transportTile).toBe(0x24);
    expect(state.shipHull).toBe(0x2a); // restaurado del OBJETO (obj+5 → g_hull, 0x08F4), no del estado
    expect(state.shipSkiffs).toBe(3); // restaurado del OBJETO (obj+7 → g_skiffs, 0x0936)
    expect(state.worldObjects!.some((o) => o.kind === "ship")).toBe(false); // epílogo 0x093E
  });
});

describe("#378 · export obj0+5/+7: el residuo sobrevive con CUALQUIER transporte en el overworld", () => {
  // g_hull/g_skiffs son GLOBALES de la ranura 0 que caballo/alfombra/esquife no escriben
  // (derivación en la cabecera). El export del port escribía 0 con «otro vehículo» activo
  // siguiendo la premisa refutada; los esperados van EN CRUDO (0x63/0x02 = los bytes del
  // careo 15-a-2 de #231).
  const conResiduo = (transportTile: number): Uint8Array => {
    const st = freshState();
    st.position = { location: 0, floor: 0, x: 50, y: 60 };
    st.transportTile = transportTile;
    st.shipHull = 0x63;
    st.shipSkiffs = 0x02;
    const { gam } = exportNativeSave(st, new Uint8Array(SAVED_GAM_SIZE));
    return gam;
  };

  it("a CABALLO (0x12): obj0+5/+7 = 0x63/0x02 — la rama caballo no toca 0x5C5F/0x5C61", () => {
    const gam = conResiduo(0x12);
    expect(gam[0x6b9]).toBe(0x63);
    expect(gam[0x6bb]).toBe(0x02);
  });

  it("en ESQUIFE (0x28) y ALFOMBRA (0x14): idem — sus ramas de board tampoco los tocan", () => {
    for (const tt of [0x28, 0x14]) {
      const gam = conResiduo(tt);
      expect(gam[0x6b9], `+5 con transporte 0x${tt.toString(16)}`).toBe(0x63);
      expect(gam[0x6bb], `+7 con transporte 0x${tt.toString(16)}`).toBe(0x02);
    }
  });

  it("CONTROL · en INTERIOR el 0 se conserva (memset MAINOUT 0x0857; +7=6 sin derivar)", () => {
    const st = freshState();
    st.position = { location: 17, floor: 0, x: 15, y: 26 };
    st.transportTile = 0x12; // a caballo en interior
    st.shipHull = 0x63;
    st.shipSkiffs = 0x02;
    const { gam } = exportNativeSave(st, new Uint8Array(SAVED_GAM_SIZE));
    expect(gam[0x6b9]).toBe(0);
    expect(gam[0x6bb]).toBe(0);
  });

  it("round-trip nativo SIN sidecar a caballo: el residuo vuelve (import ya adoptaba)", () => {
    const gam = conResiduo(0x12);
    const st = importNativeSave(gam, {
      version: 1,
      qol: { journal: [] },
      gameState: { transport: "horse", questFlags: {} },
    } as never);
    expect(st.shipHull).toBe(0x63);
    expect(st.shipSkiffs).toBe(0x02);
  });
});

describe("#378 · buildNativeOol reg 0: mismo espejo, misma regla (obj0+5/+7 del overworld)", () => {
  it("a PIE con residuo: +5/+7 = 0x63/0x02 (este writer ni siquiera llevaba el fix de #231)", () => {
    const st = freshState();
    st.position = { location: 0, floor: 0, x: 10, y: 20 };
    st.transportTile = 0x1c;
    st.shipHull = 0x63;
    st.shipSkiffs = 0x02;
    st.overworldEnemies = [];
    const ool = buildNativeOol(st, null);
    expect(ool[5]).toBe(0x63);
    expect(ool[7]).toBe(0x02);
  });

  it("a CABALLO con residuo: idem", () => {
    const st = freshState();
    st.position = { location: 0, floor: 0, x: 10, y: 20 };
    st.transportTile = 0x12;
    st.shipHull = 0x63;
    st.shipSkiffs = 0x02;
    st.overworldEnemies = [];
    const ool = buildNativeOol(st, null);
    expect(ool[0]).toBe(0x12);
    expect(ool[5]).toBe(0x63);
    expect(ool[7]).toBe(0x02);
  });
});
