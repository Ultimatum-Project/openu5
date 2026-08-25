/**
 * Tests del MODELO del picker de READY (`core/readyPicker.ts`) — la PRESENTACIÓN del
 * comando (task #78): qué ítems lista, formato de fila (cuenta / "--" + glifo de
 * equipado), y la navegación del cursor (`item_page_controller` @0x0f2e, modo 'R').
 * La MECÁNICA de equipar (encumbrance, etc.) se testea aparte en `equip.test.ts`.
 */
import { describe, it, expect } from "vitest";
import {
  READY_GLYPH_TABLE,
  READY_VISIBLE_ROWS,
  buildReadyRows,
  initReadyPicker,
  readyPickerKey,
  type ReadyRowDeps,
} from "../src/core/readyPicker.js";

/** Deps de prueba: qty por id + set de equipados + nombres triviales. */
function deps(qty: Record<number, number>, equipped: Set<number>): ReadyRowDeps {
  return {
    qtyOf: (id) => qty[id] ?? 0,
    isEquipped: (id) => equipped.has(id),
    nameOf: (id) => `item${id}`,
  };
}

describe("buildReadyRows — membresía y formato (find_next_owned charIdx, @0x05a4)", () => {
  it("lista los ítems POSEÍDOS (qty>0) en orden de id ascendente", () => {
    const rows = buildReadyRows(deps({ 1: 1, 4: 1, 9: 2, 16: 6 }, new Set()));
    expect(rows.map((r) => r.equipId)).toEqual([1, 4, 9, 16]);
    expect(rows.every((r) => !r.equipped)).toBe(true);
  });

  it("INCLUYE un ítem equipado aunque su cuenta en el pack sea 0 (testigo --♥Chain)", () => {
    // Chain Mail id 14 equipado, 0 sueltas: aparece con qty 0 + glifo de clase.
    const rows = buildReadyRows(deps({ 1: 1, 14: 0 }, new Set([14])));
    const chain = rows.find((r) => r.equipId === 14)!;
    expect(chain).toBeDefined();
    expect(chain.qty).toBe(0); // se pintará "--"
    expect(chain.equipped).toBe(true);
    expect(chain.glyph).toBe(READY_GLYPH_TABLE[14]); // 0x03 (♥ CP437)
  });

  it("un ítem con qty>0 Y equipado muestra la cuenta suelta + el glifo", () => {
    const rows = buildReadyRows(deps({ 16: 2 }, new Set([16])));
    const dagger = rows.find((r) => r.equipId === 16)!;
    expect(dagger.qty).toBe(2); // aún queda 1 suelta → cuenta, no "--"
    expect(dagger.equipped).toBe(true);
  });

  it("no lista ítems que no se poseen ni se llevan puestos", () => {
    const rows = buildReadyRows(deps({}, new Set()));
    expect(rows).toEqual([]);
  });
});

describe("readyPickerKey — navegación del cursor (item_page_controller @0x0f2e)", () => {
  const N = 10; // 10 ítems (overflow sobre las 7 filas visibles)

  it("↓/↑ mueven el cursor una fila, con clamp en los extremos (sin wrap)", () => {
    let m = initReadyPicker();
    expect(m.cursor).toBe(0);
    const down = readyPickerKey(m, "ArrowDown", N);
    expect(down.kind).toBe("move");
    if (down.kind === "move") m = down.model;
    expect(m.cursor).toBe(1);
    // En el tope, ↑ no hace nada (clamp).
    m = { cursor: 0, scroll: 0 };
    expect(readyPickerKey(m, "ArrowUp", N).kind).toBe("none");
    // En el fondo, ↓ no hace nada.
    m = { cursor: N - 1, scroll: N - READY_VISIBLE_ROWS };
    expect(readyPickerKey(m, "ArrowDown", N).kind).toBe("none");
  });

  it("el scroll sigue al cursor al pasar de la ventana visible de 7", () => {
    let m = initReadyPicker();
    // Baja 7 veces: al llegar a la fila 7 (índice 7) la ventana debe scrollear.
    for (let i = 0; i < 7; i++) {
      const r = readyPickerKey(m, "ArrowDown", N);
      if (r.kind === "move") m = r.model;
    }
    expect(m.cursor).toBe(7);
    expect(m.scroll).toBe(7 - READY_VISIBLE_ROWS + 1); // 1: la fila 7 cae en la última visible
  });

  it("PgDn/PgUp saltan 7; Home/End van a los bordes", () => {
    let m = initReadyPicker();
    const pd = readyPickerKey(m, "PageDown", N);
    if (pd.kind === "move") m = pd.model;
    expect(m.cursor).toBe(READY_VISIBLE_ROWS); // 0 → 7
    const end = readyPickerKey(m, "End", N);
    if (end.kind === "move") m = end.model;
    expect(m.cursor).toBe(N - 1);
    const home = readyPickerKey(m, "Home", N);
    if (home.kind === "move") m = home.model;
    expect(m.cursor).toBe(0);
  });

  it("RETURN y Space equipan el ítem del cursor (sin cerrar); ESC cierra", () => {
    const m = { cursor: 3, scroll: 0 };
    expect(readyPickerKey(m, "Enter", N)).toEqual({ kind: "equip", index: 3 });
    expect(readyPickerKey(m, " ", N)).toEqual({ kind: "equip", index: 3 });
    expect(readyPickerKey(m, "Escape", N)).toEqual({ kind: "close" });
  });

  it("una lista vacía cierra ante cualquier tecla (defensivo)", () => {
    expect(readyPickerKey(initReadyPicker(), "ArrowDown", 0)).toEqual({ kind: "close" });
  });
});

// (El bloque de `readyScrollArrows` se retiró con la función zombi — auditoría D6.
// El indicador vivo es `readyArrowGlyph` de skin/fiel/ready.ts, cubierto en
// tests/fiel-ready.test.ts.)
