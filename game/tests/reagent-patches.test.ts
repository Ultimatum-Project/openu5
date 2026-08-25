/**
 * PARCELAS DE REACTIVO SILVESTRE — `search_daily_reagent_patch` SJOG.OVL 0x045a-0x0510
 * (#91, pieza 9b del lote de mecánica #54).
 *
 * Tres casillas del mapa de Britannia dan reactivo al buscarlas, UNA VEZ AL DÍA y SÓLO
 * a medianoche. Son los dos reactivos que ninguna tienda vende (mandrake root y
 * nightshade), que es el control positivo de que las tablas están bien leídas.
 *
 * CUATRO tablas paralelas de DATA.OVL (fileoff = DS + 0x10), stride 1/1/1/2, 3 entradas:
 *   X    DS 0x3e66 = 182 · 97 · 44        (0x046c `cmp [si+0x3e66], [bp+6]`)
 *   Y    DS 0x3e6a =  54 · 165 · 137      (0x0477 `cmp [si+0x3e6a], [bp+4]`)
 *   slot DS 0x3e6e =   7 ·   7 ·   6      (0x0493 `mov al,[si+0x3e6e]`)
 *   NOMBRE DS 0x3e72 = punteros 0x8692 · 0x86a2 · 0x86b2 → «mandrake root!» ×2 y
 *        «nightshade!» (0x0464 `[bp-8]=0x3e72`, 0x04f6 `add [bp-8],2`, 0x04db
 *        `mov bx,[bp-8] / push [bx] / call 0x58d0`).
 *   ★ La 4ª tabla la daba por NO LEÍDA la derivación heredada (§9b «los push de
 *     0x04bf-0x04cc apuntan a un formateador, no leí su tabla»). Es de punteros por
 *     PARCELA, no por reactivo — por eso «mandrake root!» está DOS veces en DATA.OVL.
 *
 * ★ CORRECCIÓN A LA DERIVACIÓN HEREDADA, en el punto que sostiene la pieza: `cmp di,0xa`
 *   (0x04ba) NO es un selector singular/plural. Elige el ANCHO DE CAMPO (1 ó 2) del
 *   impresor de enteros `print_int_padded` (0x5abe → kernel 0x1A3E, sesgo de banda 3
 *   −0x4080), que cuenta dígitos contra la tabla de potencias de diez DS 0x5404 =
 *   {10,100,1000,10000} y rellena con [bp+4] = 0x20 (espacio). Ancho == nº de dígitos
 *   ⇒ relleno SIEMPRE 0 ⇒ el número sale desnudo en los dos casos. No hay dos formas
 *   del mensaje: la cadena es « sprigs of\n» SIEMPRE (y encaja, porque rand(2,15) no
 *   puede dar 1).
 *
 * Cadena emitida = <n> + DS 0x86be « sprigs of\n» + nombre + DS 0x86ca «\n».
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Game, type GameData } from "../src/core/game.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { OriginalRng } from "../src/core/rng-original.js";
import { advanceClock } from "../src/core/world/survival.js";
import {
  REAGENT_PATCHES,
  harvestReagentPatch,
  reagentPatchIndexAt,
} from "../src/core/world/reagent-patches.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const initial = load<ExtractedInitialState>("../assets/initial-state.json");

/** Estado mínimo para las pruebas de unidad de la rutina (idioma de month-end-reset). */
function stateAt(hour: number, day: number, over: Partial<GameState> = {}): GameState {
  return {
    characters: [],
    time: { year: 139, month: 4, day, hour, minute: 0 },
    reagentQuantities: [0, 0, 0, 0, 0, 0, 0, 0],
    turnsSinceStart: 0,
    torchTurns: 0,
    ...over,
  } as unknown as GameState;
}

describe("tablas de parcela (DATA.OVL DS 0x3e66/0x3e6a/0x3e6e/0x3e72)", () => {
  it("★ las TRES parcelas, verbatim del fichero", () => {
    expect(REAGENT_PATCHES.map((p) => [p.x, p.y]), "X DS 0x3e66 · Y DS 0x3e6a").toEqual([
      [182, 54], [97, 165], [44, 137],
    ]);
    expect(REAGENT_PATCHES.map((p) => p.reagent), "slot DS 0x3e6e; 7=MandrakeRoot 6=NightShade en el orden de magic/spells.ts:79").toEqual([7, 7, 6]);
    expect(REAGENT_PATCHES.map((p) => p.name), "4ª tabla DS 0x3e72 → DS 0x8692/0x86a2/0x86b2").toEqual([
      "mandrake root!", "mandrake root!", "nightshade!",
    ]);
  });

  it("el bucle es de TRES (0x04fb `cmp si,3 / jge`), ni una más", () => {
    expect(REAGENT_PATCHES.length, "0x04fb cmp si,3").toBe(3);
  });

  it("una casilla cualquiera no es parcela", () => {
    expect(reagentPatchIndexAt(100, 100), "sin casar X e Y no hay parcela (0x0475/0x047e jne)").toBe(-1);
    expect(reagentPatchIndexAt(54, 182), "★ control: X e Y NO son intercambiables").toBe(-1);
  });
});

describe("search_daily_reagent_patch (SJOG 0x045a-0x0510)", () => {
  const rand = () => vi.fn((_lo: number, _hi: number) => 5);

  it("★ SÓLO a medianoche: a cualquier otra hora no da nada y NO tira el dado", () => {
    // 0x0480 `cmp [g_hour], ah` con ah==0 (puesto en 0x0470 `sub ah,ah`) ⇒ hora 0.
    for (const hour of [1, 6, 12, 23]) {
      const s = stateAt(hour, 7);
      const r = rand();
      expect(harvestReagentPatch(s, 182, 54, r), `hora ${hour}: 0x0480 jne ⇒ sin cosecha`).toBeNull();
      expect(r, "y sin tirada: el rand de 0x049a está DESPUÉS del gate").not.toHaveBeenCalled();
    }
  });

  it("★ a medianoche cosecha, suma al slot y sella el día", () => {
    const s = stateAt(0, 7);
    const r = rand();
    const got = harvestReagentPatch(s, 182, 54, r);
    expect(got?.reagent, "slot DS 0x3e6e[0] = 7 = MandrakeRoot").toBe(7);
    expect(got?.qty, "0x049a `push 2 / push 0xf / call rand_range` = rand(2,15)").toBe(5);
    expect(r, "★ EXACTAMENTE UNA tirada, y con (2,15) — el primer push es el MIN").toHaveBeenCalledExactlyOnceWith(2, 15);
    expect(s.reagentQuantities[7], "0x04aa `add [bx+0x5850], al`").toBe(5);
    expect(s.reagentPatchFoundDay?.[0], "0x048f `mov [si+0x5858], al` (al = g_day)").toBe(7);
  });

  it("★ una vez al día: la segunda búsqueda del MISMO día no da nada ni tira", () => {
    // 0x0486 `cmp [si+0x5858], [g_day] / je siguiente`.
    const s = stateAt(0, 7);
    harvestReagentPatch(s, 182, 54, rand());
    const r2 = rand();
    expect(harvestReagentPatch(s, 182, 54, r2), "0x048d je ⇒ ya cosechada hoy").toBeNull();
    expect(r2, "sin cosecha no hay tirada").not.toHaveBeenCalled();
    expect(s.reagentQuantities[7], "y el inventario no crece").toBe(5);
  });

  it("al día siguiente vuelve a dar", () => {
    const s = stateAt(0, 7);
    harvestReagentPatch(s, 182, 54, rand());
    s.time.day = 8;
    expect(harvestReagentPatch(s, 182, 54, rand())?.qty, "sello 7 != día 8 ⇒ 0x048d no salta").toBe(5);
    expect(s.reagentQuantities[7], "acumula sobre lo que ya había").toBe(10);
  });

  it("★ cada parcela tiene su PROPIO sello (tres bytes 0x5858/0x5859/0x585A)", () => {
    // Control positivo del bucle indexado: cosechar la 0 no debe sellar la 1 ni la 2.
    const s = stateAt(0, 7);
    harvestReagentPatch(s, 182, 54, rand());
    expect(harvestReagentPatch(s, 97, 165, rand())?.reagent, "parcela 1: sello independiente").toBe(7);
    expect(harvestReagentPatch(s, 44, 137, rand())?.reagent, "parcela 2 = NightShade (DS 0x3e6e[2]=6)").toBe(6);
    expect(s.reagentPatchFoundDay, "los tres bytes sellados").toEqual([7, 7, 7]);
    expect(s.reagentQuantities[7], "las dos de mandrake suman en el MISMO slot").toBe(10);
    expect(s.reagentQuantities[6], "y la de nightshade en el suyo").toBe(5);
  });

  it("tope 99 (0x04ae `cmp [bx+0x5850],0x63` / 0x04b5 `mov …,0x63`)", () => {
    const s = stateAt(0, 7, { reagentQuantities: [0, 0, 0, 0, 0, 0, 0, 95] });
    const got = harvestReagentPatch(s, 182, 54, vi.fn(() => 15));
    expect(s.reagentQuantities[7], "95+15 = 110 recortado a 0x63").toBe(0x63);
    expect(got?.qty, "★ pero lo TIRADO se informa entero: el tope recorta el inventario, no el mensaje").toBe(15);
  });

  it("una casilla que no es parcela no consume tirada", () => {
    const s = stateAt(0, 7);
    const r = rand();
    expect(harvestReagentPatch(s, 100, 100, r)).toBeNull();
    expect(r, "★ RADIO DE RNG: fuera de las 3 casillas el stream no se toca").not.toHaveBeenCalled();
  });
});

describe("mensaje (DS 0x86be + nombre + DS 0x86ca)", () => {
  const LOC = 0;
  function world(): WorldData {
    const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
    return { overworld, underworld: overworld, smallMaps: new Map<number, SmallMapLocation>() };
  }
  const gameData: GameData = {
    locationsX: Array.from({ length: 32 }, () => 250),
    locationsY: Array.from({ length: 32 }, () => 250),
    locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
  };

  /** Party al SUR de la parcela 0 (182,54), a medianoche. Busca hacia el norte. */
  function gameEnParcela(seed: number): { game: Game; state: GameState } {
    const state = createNewGame(initial);
    state.position = { location: LOC, floor: 0, x: 182, y: 55 };
    state.time = { ...state.time, day: 7, hour: 0, minute: 0 };
    state.reagentQuantities = [0, 0, 0, 0, 0, 0, 0, 0];
    const game = new Game(initial, world(), gameData, state);
    game.reseed(seed);
    return { game, state };
  }

  it("★ «<n> sprigs of\\nmandrake root!\\n» tras la prosa de mueble", () => {
    const seed = 1234;
    const qty = new OriginalRng(seed).next(2, 15); // misma posición del stream
    const { game, state } = gameEnParcela(seed);
    const texts = game.search("north").filter((e) => e.kind === "message").map((e) => e.text ?? "");
    expect(texts.join(""), "DS 0x86be ' sprigs of\\n' + DS 0x8692 + DS 0x86ca").toContain(
      `${qty} sprigs of\nmandrake root!\n`,
    );
    expect(texts.join(""), "★ y NO cae al «nothing of note.» de la tabla fija: 0x0b94 `or ax,ax / jne` corta la cadena antes de 0x0b9b").not.toContain("nothing of note.");
    expect(state.reagentQuantities[7], "el reactivo entra en el inventario").toBe(qty);
  });

  it("★ el número sale DESNUDO también con dos dígitos (no hay singular/plural)", () => {
    // La derivación heredada leía `cmp di,0xa` (0x04ba) como selector singular/plural.
    // Es el ANCHO DE CAMPO del impresor de enteros kernel 0x1A3E, y como el ancho es
    // exactamente el nº de dígitos el relleno de espacios es 0 en los DOS casos.
    // Este caso es el que distingue las dos lecturas: con la heredada habría una
    // segunda forma del mensaje para n >= 10, y no la hay.
    const s = stateAt(0, 7);
    const got = harvestReagentPatch(s, 44, 137, vi.fn(() => 12));
    expect(`${got?.qty} sprigs of\n${got?.name}\n`, "misma plantilla que para n < 10").toBe(
      "12 sprigs of\nnightshade!\n",
    );
  });

  /**
   * Cuenta las tiradas consumidas entre dos semillas. Cada `next()` da EXACTAMENTE un
   * paso crudo del generador (rng-original.ts `nextRaw16`) y la transición es
   * biyectiva sobre 16 bits, así que el número de pasos es inequívoco.
   */
  function tiradas(desde: number, hasta: number, tope = 64): number {
    const r = new OriginalRng(desde);
    for (let n = 0; n <= tope; n++) {
      if (r.getSeed() === hasta) return n;
      r.nextRaw16();
    }
    return -1;
  }

  it("★ RADIO DE RNG: la cosecha consume UNA tirada más que el mismo turno sin cosechar", () => {
    // El turno de (S)earch tiene tiradas propias (runContextTurn), así que «el stream
    // avanza un paso» sería falso. Lo que mide la pieza es el DELTA contra el turno
    // gemelo que no cosecha: exactamente +1, la rand(2,15) de 0x049a.
    const seed = 4321;

    const { game: gA } = gameEnParcela(seed);
    gA.search("north");
    const conCosecha = tiradas(seed, gA.liveSeed());

    const { game: gB, state: sB } = gameEnParcela(seed);
    sB.time = { ...sB.time, hour: 13 }; // el gate de medianoche corta
    gB.search("north");
    const sinCosecha = tiradas(seed, gB.liveSeed());

    expect(sinCosecha, "el turno control consume tiradas medibles").toBeGreaterThanOrEqual(0);
    expect(conCosecha, "★ +1 y sólo +1: el gate de 0x0480 va ANTES del rand de 0x049a").toBe(sinCosecha + 1);
  });

  it("fuera de medianoche el (S)earch sigue hasta la tabla fija", () => {
    const { game, state } = gameEnParcela(4321);
    state.time = { ...state.time, hour: 13 };
    const texts = game.search("north").filter((e) => e.kind === "message").map((e) => e.text ?? "");
    expect(texts.join(""), "0x0480 falla ⇒ 0x45a devuelve 0 ⇒ 0x0b9b sigue a la tabla fija (0x514 → 0x636)").toContain("nothing of note.");
    expect(state.reagentQuantities[7], "y no entra reactivo").toBe(0);
  });
});

describe("cero de fin de mes de los TRES sellos (ULTIMA.EXE 0x505e/0x5061/0x5064)", () => {
  it("★ el rollover de MES borra los tres bytes 0x5858-0x585A", () => {
    const s = stateAt(23, 28, { reagentPatchFoundDay: [11, 12, 13] });
    s.time.minute = 59;
    advanceClock(s, 1);
    expect(s.time.day, "día a 1 (0x506a)").toBe(1);
    expect(s.reagentPatchFoundDay, "0x505e/0x5061/0x5064: `sub al,al` y tres escrituras").toEqual([0, 0, 0]);
  });

  it("un rollover de DÍA que no cambia de mes deja los sellos intactos", () => {
    // Control positivo, gemelo del de skullTreeFoundDay: el borrado cuelga del
    // `cmp [g_day],0x1c`, no de la medianoche.
    const s = stateAt(23, 17, { reagentPatchFoundDay: [11, 12, 13] });
    s.time.minute = 59;
    advanceClock(s, 1);
    expect(s.time.day).toBe(18);
    expect(s.reagentPatchFoundDay, "sin cambio de mes no hay borrado").toEqual([11, 12, 13]);
  });

  it("tras el borrado la parcela vuelve a dar el día 1", () => {
    const s = stateAt(23, 28, { reagentPatchFoundDay: [1, 0, 0] });
    s.time.minute = 59;
    advanceClock(s, 1);
    s.time.hour = 0;
    expect(harvestReagentPatch(s, 182, 54, vi.fn(() => 3))?.qty, "sello 0 != día 1 ⇒ hallable").toBe(3);
  });
});
