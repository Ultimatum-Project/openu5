/**
 * PANEL del picker de (U)se — careo contra el CRUDO del binario.
 *
 * ── DE DÓNDE SALE ESTE FICHERO ─────────────────────────────────────────────────
 * El carril `sbs-dosbox` grabó un side-by-side «original ⇄ port» cargando el MISMO
 * save, y el fotograma t=48 s pilló el panel de (U)se diciendo tres cosas distintas
 * (su divergencia D2). Este fichero fija las tres CON EL BINARIO DELANTE, no con la
 * captura: los esperados son el volcado de DATA.OVL y la lectura de
 * `print_list_row` @0x05e2, y la captura sólo dice DÓNDE mirar.
 *
 * ── LA CADENA DE MONTAJE DE UNA FILA (verbatim, ZSTATS.OVL) ────────────────────
 *   0f90: push idx / push 0xb9ee / push 0x1916 / push 0x20   ; ← el SEPARADOR es 0x20
 *   0f9e: call 0x5e2                                          ;   (0x2d es de Ztats)
 *   05f0: mov al, [bx+si]        ; al = tabla_extendida[idx]
 *   05f5: cmp al, 0xff / je 0x62e ; ★ 0xff ⇒ NI número NI separador: cero celdas
 *   05fb: or al,al / je 0x60e     ;   0 ⇒ "--" (DS 0x9778) — INALCANZABLE aquí:
 *                                 ;   find_next_owned @0x05ba con modo 0xff sólo
 *                                 ;   lista bytes ≠ 0 (el "--" es del picker de
 *                                 ;   (R)eady, que pasa un índice de PJ como modo)
 *   0600: push 2 / push 0x20 / call 0x385e ; si no: 2 díg. justificados, pad ESPACIO
 *   0622: putchar(sep)
 *   0638/0664/068e: ramas de sigilo `*`/`!`/`(` de la name-table
 *   06ac: print_string(name)      ; rama «otro»: la cadena TAL CUAL
 *   06b9: mientras col < 0xe → putchar(' ')  ; ★ la fila mide 14 celdas (1..14 de la
 *                                            ;   ventana; contenido = 13)
 *
 * ── POR QUÉ 13 CELDAS EXPLICA LAS ABREVIATURAS ────────────────────────────────
 * `Shard/Cowrdce` y `HMS Cape Plan` miden 13 JUSTAS; `Magic Crpt`/`Skull Keys` miden
 * 10, que con los 2 díg. y el separador vuelven a dar 13. La name-table no es
 * «fea»: está dimensionada al pergamino. Los nombres largos que emitía el port
 * (`Shard of Falsehood` = 18) no caben y se truncaban.
 */
import { describe, it, expect, afterEach } from "vitest";
import type { ReadyPickerRowView, ReadyPickerView } from "../src/skin/api.js";
import { READY_PICKER_RECT, layoutReadyPicker, readyRowCells } from "../src/skin/fiel/ready.js";
import { USE_QTY_HIDDEN, buildUseRows, type UseRowsState } from "../src/core/usePicker.js";
import { USE_UI } from "../src/core/world/cmd-strings.js";
import { setLang, BASE_LANG } from "../src/i18n/index.js";

/** Ancho de contenido del pergamino = 13 celdas (marco de 15 menos las dos barras │). */
const INNER = 13;

/** Fila como texto; los glifos de control (sigilos 0x1c/0x1d) salen como `<1c>`. */
function rowText(cells: readonly number[]): string {
  return cells
    .map((c) => (c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : `<${c.toString(16).padStart(2, "0")}>`))
    .join("")
    .replace(/ +$/, "");
}

function useRow(name: string, qty: number): ReadyPickerRowView {
  return { name, qty, equipped: false, glyph: 0 };
}

/** Estado vacío del picker; se sobreescribe lo que haga falta. */
function state(over: Partial<UseRowsState> = {}): UseRowsState {
  return {
    scrollQuantities: [0, 0, 0, 0, 0, 0, 0, 0],
    potionQuantities: [0, 0, 0, 0, 0, 0, 0, 0],
    magicCarpets: 0,
    skullKeys: 0,
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    specialItems: {
      spyglass: false,
      hmsCape: false,
      sextant: false,
      pocketWatch: false,
      blackBadge: false,
      woodenBox: false,
    },
    ...over,
  };
}

/**
 * EL ESCENARIO DEL FOTOGRAMA t=48 del side-by-side, reconstruido de los bytes del
 * propio `blackthorn-pruebas/SAVED.GAM`: 2 pergaminos In Sanct (id 0x02), 3 pociones
 * amarillas (color 1), 1 alfombra (GAM 0x20a = 1), 3 llaves de calavera (0x20b = 3),
 * reloj de bolsillo (0x217 = 0xff — INIT.GAM ya lo trae así) e insignia negra
 * (0x218 ≠ 0).
 */
function fotogramaT48(): UseRowsState {
  return state({
    scrollQuantities: [0, 0, 2, 0, 0, 0, 0, 0],
    potionQuantities: [0, 3, 0, 0, 0, 0, 0, 0],
    magicCarpets: 1,
    skullKeys: 3,
    specialItems: { ...state().specialItems, pocketWatch: true, blackBadge: true },
  });
}

describe("cabecera del pergamino (banner) — DS 0x48b8", () => {
  it("es 'Items:', no el eco del dispatcher 'Use item'", () => {
    // `cmd_use_item` CAST.OVL manda DOS cadenas pegadas en el DGROUP:
    //   @0x17c8 → 0x48b1 "Item: "  a la CONSOLA (0x58d0)
    //   @0x17d9 → 0x48b8 "Items:"  a la CABECERA del panel (0x8ed0)
    // El port ponía "Use item", que es CMD_STRINGS.use (DS 0xa24c) y vive en la
    // consola: en el fotograma se ven las DOS cosas a la vez, cada una en su sitio.
    expect(USE_UI.banner).toBe("Items:");
    expect(USE_UI.item).toBe("Item: ");
    expect(USE_UI.banner).not.toBe("Use item");
  });
});

describe("columna de cantidad — 0xff quita la columna ENTERA (print_list_row @0x05f5)", () => {
  it("contable: 2 díg. justificados a la derecha con pad ESPACIO + separador 0x20", () => {
    // `print_number(qty, 2, 0x20)` @0x0600 y `putchar(0x20)` @0x0622: el 1 deja un
    // hueco DELANTE, que es lo que desplaza el nombre una celda respecto a los flags.
    const { cells } = readyRowCells(useRow("Magic Crpt", 1), INNER, "use");
    expect(rowText(cells)).toBe(" 1 Magic Crpt");
    expect(cells.length).toBe(INNER); // 2 + 1 + 10 = 13 justas
  });

  it("flag 0xff: CERO celdas de cantidad — el nombre arranca en la primera celda", () => {
    const { cells } = readyRowCells(useRow("Pocket Watch", USE_QTY_HIDDEN), INNER, "use");
    expect(rowText(cells)).toBe("Pocket Watch");
    expect(cells[0]).toBe("P".charCodeAt(0)); // no ' ', no '-', no '0'
  });

  it("el flag NO se pinta como '--' (eso es del picker de (R)eady, no de éste)", () => {
    // El relleno "--" (DS 0x9778) sólo lo alcanza `print_list_row` con qty==0, y en
    // modo 'U' `find_next_owned` @0x05ba nunca lista un 0. Si alguien vuelve a mapear
    // el flag a 0, esta fila reaparecería como "--…" y el aserto cae.
    const { cells } = readyRowCells(useRow("Black Badge", USE_QTY_HIDDEN), INNER, "use");
    expect(rowText(cells).startsWith("--")).toBe(false);
    // …y el MISMO nombre en la variante 'ready' con qty 0 SÍ da "--": el contraste
    // demuestra que la diferencia está donde debe (variante), no en el nombre.
    const ready = readyRowCells(useRow("Black Badge", 0), INNER, "ready");
    expect(rowText(ready.cells).startsWith("--")).toBe(true);
  });

  it("el separador es 0x20 (picker), no el 0x2d del visor de Ztats", () => {
    const { cells } = readyRowCells(useRow("Skull Keys", 3), INNER, "use");
    expect(cells[2]).toBe(0x20);
    expect(rowText(cells)).toBe(" 3 Skull Keys");
  });
});

describe("los nombres son la name-table 0x1916 VERBATIM", () => {
  it("los cuatro que cazó el fotograma t=48", () => {
    const rows = buildUseRows(fotogramaT48());
    const painted = rows.map((r) => rowText(readyRowCells(useRow(r.name, r.qty), INNER, "use").cells));
    // Orden = orden de la tabla extendida: scroll(0x02) → poción(0x09) → alfombra
    // (0x10) → llaves (0x11) → reloj (0x23) → insignia (0x24).
    expect(painted).toEqual([
      " 2 <1c> + IS", //   *IS  → deco DS 0x977c (glifo 0x1c + " + ") + sigla rúnica
      " 3 <1d> + Yellow", // !   → deco DS 0x9782 + color DS 0x19C2[1]
      " 1 Magic Crpt", //  DS 0x04b3 (el port decía "Carpet")
      " 3 Skull Keys", //  DS 0x04be (decía "Skull Key")
      "Pocket Watch", //   DS 0x053e (decía "-- Watch")
      "Black Badge", //    DS 0x054b (decía "-- Badge")
    ]);
  });

  it("los largos del binario caben JUSTOS en las 13 celdas (por eso están abreviados)", () => {
    for (const name of ["Shard/Cowrdce", "HMS Cape Plan"]) {
      const { cells } = readyRowCells(useRow(name, USE_QTY_HIDDEN), INNER, "use");
      expect(rowText(cells)).toBe(name); // sin truncar, sin hueco
      expect(name.length).toBe(INNER);
    }
    // El nombre largo que emitía el port ANTES no cabía: control positivo del ancho.
    expect("Shard of Falsehood".length).toBeGreaterThan(INNER);
  });

  it("gema lunar: sigilo '(' → 'Moonstone ' (DS 0x9788) + el dígito de la fase", () => {
    const rows = buildUseRows(state({ moonstones: [{ buried: true }, { buried: false }] }));
    expect(rows.map((r) => r.name)).toEqual(["(1"]);
    const { cells } = readyRowCells(useRow(rows[0]!.name, rows[0]!.qty), INNER, "use");
    expect(rowText(cells)).toBe("Moonstone 1");
  });
});

describe("el panel entero (layoutReadyPicker, variante 'use')", () => {
  afterEach(() => setLang(BASE_LANG, { persist: false }));

  function panel(): ReadyPickerView {
    const rows = buildUseRows(fotogramaT48());
    return {
      phase: "pick",
      title: USE_UI.banner,
      rows: rows.map((r) => useRow(r.name, r.qty)),
      cursor: 0,
      scroll: 0,
      variant: "use",
    };
  }

  it("marco de 15×9 con las 6 filas en rel 1..6 y la 7ª vacía", () => {
    const { win, cursorRow } = layoutReadyPicker(READY_PICKER_RECT, panel());
    expect(win.cols).toBe(15); // cols 24..38
    const line = (r: number): string =>
      rowText(Array.from(win.cells.slice(r * win.cols + 1, r * win.cols + 1 + INNER)));
    expect(line(1)).toBe(" 2 <1c> + IS");
    expect(line(3)).toBe(" 1 Magic Crpt");
    expect(line(5)).toBe("Pocket Watch");
    expect(line(6)).toBe("Black Badge");
    expect(line(7)).toBe(""); // 7 filas de contenido: la última queda en blanco
    expect(cursorRow).toBe(1); // la barra de selección, sobre el primer ítem
  });

  it("bajo ES ninguna fila rebasa las 13 celdas del pergamino", () => {
    // El original NUNCA trunca; la capa de display de la piel (ZTATS_ITEM_SHORT_ES)
    // es la que mantiene la ES dentro del campo. Si una traducción larga se colara
    // sin abreviatura, la fila saldría cortada a media palabra.
    setLang("es", { persist: false });
    const { win } = layoutReadyPicker(READY_PICKER_RECT, panel());
    for (let r = 1; r <= 6; r++) {
      const cells = Array.from(win.cells.slice(r * win.cols + 1, r * win.cols + 1 + INNER));
      // la celda 13 (la última) puede estar ocupada, pero la barra │ de la col 14 no:
      expect(win.cells[r * win.cols + 14]).toBe(0x17);
      expect(cells.length).toBe(INNER);
    }
  });
});
