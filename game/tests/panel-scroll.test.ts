/**
 * SCROLL DE LISTAS DEL PANEL (carril panel-scroll) — QoL de shell sobre Ztats.
 *
 * HALLAZGO de la investigación (guía del diseño): las 4 listas de Ztats (0xd
 * reactivos · 0xe items · 0xf quest · 0x10 equipo) YA scrollean de forma FIEL —
 * `ZtatsState.scroll` conducido por ↑/↓/PgUp/PgDn/Home/End en `ztatsKeyReducer`,
 * clamp `[0, owned-ZTATS_LIST_ROWS]`, indicador ▲▼↕ (`ztatsListArrowGlyph`) — y la
 * lista COMPLETA ya viaja en `snapshot.inventory` (no hace falta exponer nada tipo
 * `consoleHistory`). Por eso la QoL es un ALIAS DE ENTRADA (`listScrollBy`): la
 * rueda/arrastre muta el MISMO estado por el MISMO clamp — sin modo nuevo, sin
 * render paralelo (byte-idéntico con la rueda quieta, por construcción) y SIN el
 * peligro de re-usar el reductor con flechas sintéticas (que en una lista SIN
 * overflow caen al ciclo del eje y CAMBIARÍAN DE PÁGINA).
 */
import { describe, expect, it } from "vitest";
import {
  listScrollBy,
  ztatsKeyReducer,
  ZTATS_LIST_ROWS,
  type ZtatsState,
} from "../src/skin/fiel/ztats.js";

/** Estado en una página de LISTA (0xe = items) con scroll dado. */
function listState(scroll = 0, page = 0xe): ZtatsState {
  return { mode: "page", page, scroll, cursor: 0 };
}

describe("listScrollBy — alias de entrada del scroll fiel de listas", () => {
  it("desplaza con el clamp fiel: negativo = abajo (como ↓), positivo = arriba (como ↑)", () => {
    // 20 ítems → maxScroll = 20-7 = 13 (mismo clamp que el reductor).
    expect(listScrollBy(listState(0), -3, 20)?.scroll).toBe(3); // rueda abajo
    expect(listScrollBy(listState(5), 2, 20)?.scroll).toBe(3); // rueda arriba
    expect(listScrollBy(listState(12), -99, 20)?.scroll).toBe(13); // clamp fondo
    expect(listScrollBy(listState(5), 99, 20)?.scroll).toBe(0); // clamp tope
  });

  it("NO-OP (null) sin interacción efectiva: sin cambio, delta 0, o fracción <1 línea", () => {
    expect(listScrollBy(listState(0), 2, 20)).toBeNull(); // ya en el tope
    expect(listScrollBy(listState(13), -1, 20)).toBeNull(); // ya en el fondo
    expect(listScrollBy(listState(4), 0, 20)).toBeNull();
    expect(listScrollBy(listState(4), 0.7, 20)).toBeNull(); // trunc → 0 líneas
  });

  it("NO-OP fuera de una página de lista (stats/armas/provisiones/select)", () => {
    expect(listScrollBy({ mode: "page", page: 0, scroll: 0, cursor: 0 }, -3, 20)).toBeNull();
    expect(listScrollBy({ mode: "page", page: 1, scroll: 0, cursor: 0 }, -3, 20)).toBeNull(); // armas
    expect(listScrollBy({ mode: "page", page: 0xc, scroll: 0, cursor: 0 }, -3, 20)).toBeNull();
    expect(listScrollBy({ mode: "select", page: 0, scroll: 0, cursor: 0 }, -3, 20)).toBeNull();
  });

  it("lista SIN overflow: NO-OP y JAMÁS cambia de página (a diferencia de ↑/↓ del reductor)", () => {
    // 5 ítems ≤ 7 filas → nada que desplazar. El reductor fiel, con la misma
    // situación, cae al ciclo del eje (ArrowDown → página siguiente): la rueda NO.
    const st = listState(0);
    expect(listScrollBy(st, -3, 5)).toBeNull();
    const reducerResult = ztatsKeyReducer(st, "ArrowDown", { partySize: 2, ownedCount: 5 });
    expect(reducerResult.state?.page).not.toBe(st.page); // el reductor SÍ navega…
    // …y por eso la QoL no lo reusa: la rueda desplaza, no navega.
  });

  it("PARIDAD con el reductor fiel: cada línea equivale a un ↑/↓ (mismo estado resultante)", () => {
    const ctx = { partySize: 2, ownedCount: 20 };
    // -1 línea (rueda abajo) ≡ ArrowDown
    const viaWheel = listScrollBy(listState(4), -1, 20);
    const viaKey = ztatsKeyReducer(listState(4), "ArrowDown", ctx).state;
    expect(viaWheel).toEqual(viaKey);
    // +1 línea (rueda arriba) ≡ ArrowUp
    const viaWheelUp = listScrollBy(listState(4), 1, 20);
    const viaKeyUp = ztatsKeyReducer(listState(4), "ArrowUp", ctx).state;
    expect(viaWheelUp).toEqual(viaKeyUp);
    // Un barrido grande equivale a End/Home (mismos bordes del clamp).
    expect(listScrollBy(listState(4), -999, 20)?.scroll).toBe(
      ztatsKeyReducer(listState(4), "End", ctx).state?.scroll,
    );
    expect(listScrollBy(listState(4), 999, 20)?.scroll).toBe(
      ztatsKeyReducer(listState(4), "Home", ctx).state?.scroll,
    );
  });

  it("todo estado que produce es alcanzable por teclas (scroll ∈ [0, owned-7], entero)", () => {
    for (const [delta, owned] of [[-1, 8], [-7, 30], [5, 48], [-999, 10]] as const) {
      const next = listScrollBy(listState(3), delta, owned);
      if (next === null) continue;
      const maxScroll = Math.max(0, owned - ZTATS_LIST_ROWS);
      expect(Number.isInteger(next.scroll)).toBe(true);
      expect(next.scroll).toBeGreaterThanOrEqual(0);
      expect(next.scroll).toBeLessThanOrEqual(maxScroll);
      // Nada más cambia: página/cursor/modo intactos (desplaza, no navega).
      expect(next.page).toBe(0xe);
      expect(next.cursor).toBe(0);
      expect(next.mode).toBe("page");
    }
  });
});
