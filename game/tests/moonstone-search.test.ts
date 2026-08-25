/**
 * Lado (S)EARCH de la moonstone — `search_moonstone` SJOG 0x03A8 (#54 pieza «moonstone»,
 * §11 de re/notes/lote-mecanica-pendiente.md).
 *
 * EL HUECO QUE CIERRA: el port tenía el estado (`state.moonstones`) y hasta la función
 * (`digUpMoonstone`, con 3 tests verdes) pero NINGÚN consumidor de producción — sólo la
 * llamaban los tests. Lógica sellada, cableado sin sellar, otra vez. El único camino que
 * sacaba una piedra del suelo era el Use/moongate; buscar sobre la casilla no hacía nada.
 *
 * DERIVACIÓN (cuerpo entero 0x03A8-0x0457):
 *  - Bucle de las 8 piedras (0x03b5, `mov [bp-4],8` + `dec/jns`) exigiendo que casen las
 *    CUATRO tablas paralelas: 0x5830, 0x5838, 0x5848 (los tres args; el caller 0x0b81
 *    empuja x, y y `g_floor`) y 0x5840 == `g_location`.
 *  - Anti-duplicado (0x03ee-0x0412): barre los 0x20 slots de objeto y, si ya hay uno de
 *    kind 0x19 con el MISMO número de piedra ahí, NO coloca otro.
 *  - Éxito: place-object 0x7AF4 con kind 0x19 (0x043c), print DS 0x8680 «a strange rock!»
 *    (0x043f) y `or [g_unk_24e6],2` (redibujar). Devuelve 1; si nada casa, 0.
 *  - ORDEN: el despachador llama a esta ANTES que a la tabla fija de 113 entradas
 *    (0x0b81 `call 0x3a8` → `or ax,ax / jne` y sólo con 0 sigue a 0x0b8b).
 *  - CERO RNG en toda la rutina.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Game, type GameData } from "../src/core/game.js";
import { applySearchGrant, MOONSTONE_SEARCH_ID } from "../src/core/world/search.js";
import { buriedMoonstoneAt, digUpMoonstone } from "../src/core/world/moongates.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const initial = load<ExtractedInitialState>("../assets/initial-state.json");

const LOC = 0; // Britannia
function world(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  const smallMaps = new Map<number, SmallMapLocation>();
  return { overworld, underworld: overworld, smallMaps };
}
const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

/** Party en (100,100) con la piedra de fase `phase` enterrada al norte, en (100,99). */
function gameConPiedra(phase = 3): { game: Game; state: GameState } {
  const state = createNewGame(initial);
  state.position = { location: LOC, floor: 0, x: 100, y: 100 };
  state.moonstones[phase] = { x: 100, y: 99, z: 0, buried: true, location: LOC };
  const game = new Game(initial, world(), gameData, state);
  return { game, state };
}

describe("(S)earch sobre una moonstone enterrada (SJOG 0x03A8)", () => {
  it("★ la MATERIALIZA como objeto visible y dice «a strange rock!» — sin concederla", () => {
    const { game, state } = gameConPiedra(3);
    const texts = game.search("north").filter((e) => e.kind === "message").map((e) => e.text ?? "");
    expect(texts.some((t) => t.includes("a strange rock!"))).toBe(true); // DS 0x8680
    const obj = (state.worldObjects ?? []).find((o) => o.search?.id === MOONSTONE_SEARCH_ID);
    expect(obj).toBeDefined();
    expect(obj!.x).toBe(100);
    expect(obj!.y).toBe(99);
    // ★ LO QUE NO PASA: el Search NO la pasa al inventario. Ese es el reparto del binario
    // (colocar aquí, acreditar en el (G)et) y el port ya lo respetaba para la tabla fija.
    expect(state.moonstones[3]!.buried).toBe(true);
  });

  it("anti-duplicado (0x03ee-0x0412): re-buscar NO apila una segunda piedra", () => {
    const { game, state } = gameConPiedra(3);
    game.search("north");
    game.search("north");
    game.search("north");
    const n = (state.worldObjects ?? []).filter((o) => o.search?.id === MOONSTONE_SEARCH_ID).length;
    expect(n).toBe(1);
  });

  it("el (G)et es quien la acredita: buried → false (rama 0x148c, `[bx+0x5840]=0xFF`)", () => {
    const state = createNewGame(initial);
    state.moonstones[3] = { x: 100, y: 99, z: 0, buried: true, location: LOC };
    expect(applySearchGrant(state, { id: MOONSTONE_SEARCH_ID, quality: 3 })).toBe(1);
    expect(state.moonstones[3]!.buried).toBe(false);
  });

  it("★ control NEGATIVO: sin piedra enterrada ahí, el Search cae a la tabla fija", () => {
    // Sin él, un cableado que dijera «a strange rock!» SIEMPRE pasaría el primer test.
    const state = createNewGame(initial);
    state.position = { location: LOC, floor: 0, x: 100, y: 100 };
    for (const m of state.moonstones) m.buried = false;
    const game = new Game(initial, world(), gameData, state);
    const texts = game.search("north").filter((e) => e.kind === "message").map((e) => e.text ?? "");
    expect(texts.some((t) => t.includes("a strange rock!"))).toBe(false);
    expect((state.worldObjects ?? []).some((o) => o.search?.id === MOONSTONE_SEARCH_ID)).toBe(false);
  });

  it("control NEGATIVO 2: la piedra de OTRA casilla no se halla desde aquí", () => {
    const { game, state } = gameConPiedra(3);
    state.moonstones[3] = { x: 7, y: 7, z: 0, buried: true, location: LOC }; // lejos
    const texts = game.search("north").filter((e) => e.kind === "message").map((e) => e.text ?? "");
    expect(texts.some((t) => t.includes("a strange rock!"))).toBe(false);
  });
});

describe("buriedMoonstoneAt — la consulta que faltaba (no muta, a diferencia de digUp)", () => {
  it("devuelve la fase y NO toca el estado; digUpMoonstone sí lo toca", () => {
    const state = createNewGame(initial);
    state.moonstones[5] = { x: 12, y: 34, z: 0, buried: true, location: LOC };
    expect(buriedMoonstoneAt(state, 12, 34, 0)).toBe(5);
    expect(state.moonstones[5]!.buried).toBe(true); // la consulta no desentierra
    expect(buriedMoonstoneAt(state, 12, 35, 0)).toBeNull();
    expect(digUpMoonstone(state, 12, 34, 0)).toBe(5);
    expect(state.moonstones[5]!.buried).toBe(false);
  });
});

/**
 * Lado (G)ET de la moonstone — ficha #357, el careo que #346 §7 dejó declarado.
 *
 * DERIVACIÓN (SJOG.OVL.asm): el barrido de cmd_get acepta kind==0x19 por su segunda
 * condición escrita a mano (0x196f `cmp cx,0x19` / 0x1972 `je 0x197f`) y get_item_switch
 * lo despacha por la cadena secundaria (0x172d `cmp ax,0x19` / 0x1733 `jmp 0x148c`).
 * La rama 0x148c hace TRES cosas: imprime DS 0x8C4E «A moonstone!\n» (fileoff 0x8C5E de
 * DATA.OVL, verificado con los controles vecinos 0x8C3E «Open it first!» y 0x8C5C
 * «A magic carpet!»), escribe `[bx+0x5840] = 0xFF` con bx = [bp+6] = nº de piedra
 * (0x1493-0x1496; 0x5840 = tabla de LOCATION, 0xFF = «en la mochila») y sale por la
 * cola común 0x177A (borra la ranura del objeto + turno 0x178E).
 *
 * CANALES del port para ese único registro del binario (equivalencia #137/#346):
 *  - worldObjects kind "search" (productor: search_moonstone portado, game.ts) — este test.
 *  - override de banco alto: SIN productor de 0x119 en todo game/src (censo de
 *    setMapOverride: 0x110 establo, dropTile de X-it, 0x110 wish) ⇒ canal vacío A PROPÓSITO,
 *    porque el único productor del binario es el Search y el port lo escribe en worldObjects.
 */
describe("(G)et sobre la piedra materializada por Search — rama 0x148c (#357)", () => {
  it("★ la acredita, la nombra «A moonstone!» (DS 0x8C4E) y retira el objeto (cola 0x177A)", () => {
    const { game, state } = gameConPiedra(3);
    game.search("north"); // materializa (0x7AF4 con kind 0x19)
    expect((state.worldObjects ?? []).some((o) => o.search?.id === MOONSTONE_SEARCH_ID)).toBe(true);
    const texts = game.get("north").filter((e) => e.kind === "message").map((e) => e.text ?? "");
    // El NOMBRE es el de la rama 0x148c, no el genérico «An item!» del default.
    expect(texts.some((t) => t.includes("A moonstone!"))).toBe(true);
    expect(texts.some((t) => t.includes("An item!"))).toBe(false);
    // `[bx+0x5840] = 0xFF` (0x1496): a la mochila.
    expect(state.moonstones[3]!.buried).toBe(false);
    expect(state.moonstones[3]!.location).toBe(0xff);
    // Cola 0x177A: la ranura del objeto queda vacía.
    expect((state.worldObjects ?? []).some((o) => o.search?.id === MOONSTONE_SEARCH_ID)).toBe(false);
  });

  it("control NEGATIVO: sin Search previo no hay objeto y el (G)et no concede piedra", () => {
    const { game, state } = gameConPiedra(3);
    const texts = game.get("north").filter((e) => e.kind === "message").map((e) => e.text ?? "");
    expect(texts.some((t) => t.includes("A moonstone!"))).toBe(false);
    expect(state.moonstones[3]!.buried).toBe(true); // sigue enterrada
  });
});
