/**
 * Tests del LAYOUT del overlay de pergamino del picker de READY (piel fiel,
 * `skin/fiel/ready.ts`): formato de fila (`[cuenta|"--"][glifo/espacio][nombre]`),
 * marco de lista, fila del cursor y glifo de flecha. Modelo PURO de rejilla (sin
 * canvas). Calca `item_page_controller` @0x0f2e (modo 'R') + `print_list_row` @0x05e2.
 */
import { describe, it, expect, afterEach } from "vitest";
import type { ReadyPickerRowView, ReadyPickerView } from "../src/skin/api.js";
import {
  MIX_REAGENT_RECT,
  READY_PICKER_RECT,
  layoutReadyPicker,
  readyArrowGlyph,
  readyRowCells,
} from "../src/skin/fiel/ready.js";
import { setLang, BASE_LANG } from "../src/i18n/index.js";

/** Lee una fila de la ventana como texto (glifos imprimibles; controles→'·'). */
function rowText(cells: Uint8Array, cols: number, row: number): string {
  let s = "";
  for (let c = 0; c < cols; c++) {
    const code = cells[row * cols + c]!;
    s += code >= 0x20 && code < 0x7f ? String.fromCharCode(code) : code === 0x20 ? " " : "·";
  }
  return s.trimEnd();
}

function view(rows: ReadyPickerRowView[], cursor = 0, scroll = 0): ReadyPickerView {
  return { phase: "pick", title: "Elwood", rows, cursor, scroll };
}

describe("readyRowCells — formato de fila (print_list_row @0x05e2)", () => {
  it("ítem no equipado: cuenta 2-díg + espacio + nombre", () => {
    const { cells, highlightCols } = readyRowCells(
      { name: "Dagger", qty: 6, equipped: false, glyph: 0x04 },
      13,
    );
    const text = cells.map((c) => String.fromCharCode(c)).join("").trimEnd();
    expect(text).toBe(" 6 Dagger"); // "_6" (pad espacio) + espacio separador + nombre
    expect(highlightCols).toEqual([]); // sin realce (no equipado)
  });

  it("ítem equipado sin cuenta suelta: '--' + glifo REALZADO + nombre (testigo --♥Chain)", () => {
    const { cells, highlightCols } = readyRowCells(
      { name: "Chain", qty: 0, equipped: true, glyph: 0x03 },
      13,
    );
    // Col 0-1 = "--", col 2 = glifo 0x03, luego el nombre.
    expect(cells[0]).toBe("-".charCodeAt(0));
    expect(cells[1]).toBe("-".charCodeAt(0));
    expect(cells[2]).toBe(0x03);
    expect(highlightCols).toEqual([2]); // sólo el glifo va realzado
    expect(String.fromCharCode(...cells.slice(3, 8))).toBe("Chain");
  });

  it("variante 'mix': NO marcado = base ' NN NAME' (nombre COMPLETO en col 4, sin marca)", () => {
    const { cells, highlightCols } = readyRowCells(
      { name: "Sulfur Ash", qty: 4, equipped: false, glyph: 0x0f },
      16,
      "mix",
    );
    // col0 espacio inicial · col1-2 cuenta · col3 espacio base · col4+ nombre COMPLETO
    expect(cells[0]).toBe(0x20); // espacio inicial (0x1939)
    // ★ CERO-pad, no espacio: el relleno de print_number es POR CALL-SITE, y el de Mix
    // es `0x1950 mov ax,0x30 / push ax` (el 3er arg de `0x1954 call 0x5abe`). Ready y
    // ZStats empujan 0x20 y SIGUEN con espacio — su control es el aserto " 6 Dagger" de
    // «ítem no equipado» en este mismo fichero. #200.
    expect(String.fromCharCode(cells[1]!, cells[2]!)).toBe("04");
    expect(cells[3]).toBe(0x20); // espacio base (0x1957); sin marca al no estar seleccionado
    expect(String.fromCharCode(...cells.slice(4, 14))).toBe("Sulfur Ash"); // nombre íntegro
    expect(highlightCols).toEqual([]);
  });

  // 🔴 Este caso ASERTABA la lectura refutada — «marca 0xfd/0xf/0xfd SOBREESCRIBE cols
  // 3-5», con `cells[6] === 'n'` porque «Gi» quedaba solapada. El aserto no era débil:
  // era FIEL a una premisa falsa, y por eso pasó verde encima del bug. `0xfd` no es un
  // glifo, es el toggle de VÍDEO INVERSO de `putchar` (kernel @0x1778→@0x17a5, que salta
  // a @0x1767 SIN pintar ni avanzar; el efecto se consuma en @0x1845 `not word ptr
  // es:[di]`). Se conserva el enunciado viejo aquí, tachado, porque llegó a citarse.
  it("variante 'mix': MARCADO = UNA celda (col 3) en vídeo INVERSO; el nombre queda ENTERO", () => {
    const { cells, inverseCols } = readyRowCells(
      { name: "Ginseng", qty: 6, equipped: true, glyph: 0x0f },
      16,
      "mix",
    );
    expect(cells[3]).toBe(0x0f); // ☼ marcado (0x1a19), en la col 3 (gotoxy 0x1a02)
    expect(inverseCols).toEqual([3]); // envuelto en los dos putchar(0xfd) 0x1a0d/0x1a25
    // ★ El control que refuta la lectura vieja: el nombre no pierde NI UNA letra.
    expect(String.fromCharCode(...cells.slice(4, 11))).toBe("Ginseng");
  });
});

describe("readyRowCells — i18n: el nombre display pasa por t() (choke de la piel)", () => {
  // El estado de idioma es de módulo: restaurar a 'en' tras cada caso.
  afterEach(() => setLang(BASE_LANG, { persist: false }));

  it("'en' = identidad estricta (calco intacto, pixeldiff byte-exacto)", () => {
    const { cells } = readyRowCells({ name: "Dagger", qty: 6, equipped: false, glyph: 0x04 }, 13);
    const text = cells.map((c) => String.fromCharCode(c)).join("").trimEnd();
    expect(text).toBe(" 6 Dagger");
  });

  it("'es' con hit: el nombre se traduce en el sitio (Dagger → Daga)", () => {
    setLang("es", { persist: false });
    const { cells } = readyRowCells({ name: "Dagger", qty: 6, equipped: false, glyph: 0x04 }, 13);
    const text = cells.map((c) => String.fromCharCode(c)).join("").trimEnd();
    expect(text).toBe(" 6 Daga");
  });

  it("'es' usa la abreviatura de picker en vez de truncar (ruling ≤10)", () => {
    setLang("es", { persist: false });
    // "Chain Coif": la ES de tienda («Cofia de Malla») desbordaría el campo de 10;
    // el override PICKER_SHORT_ES da la abreviatura revisada «Cofia Mall» (nada trunca
    // a lo bruto en el picker — ruling del lead 2026-07-19, guarda §4).
    const { cells } = readyRowCells({ name: "Chain Coif", qty: 1, equipped: false, glyph: 0x01 }, 13);
    const text = cells.map((c) => String.fromCharCode(c)).join("").trimEnd();
    expect(text).toBe(" 1 Cofia Mall");
  });
});

describe("layoutReadyPicker — marco + filas + cursor + flechas", () => {
  const rows: ReadyPickerRowView[] = Array.from({ length: 10 }, (_, i) => ({
    name: `wpn${i}`,
    qty: i + 1,
    equipped: false,
    glyph: 0x04,
  }));

  it("dibuja el marco de lista y las 7 filas visibles desde el scroll", () => {
    const { win, cursorRow } = layoutReadyPicker(READY_PICKER_RECT, view(rows, 0, 0));
    // La fila rel 1 (primera de contenido) muestra el primer ítem visible.
    expect(rowText(win.cells, win.cols, 1)).toContain("wpn0");
    // La fila rel 7 muestra el 7º ítem (índice 6).
    expect(rowText(win.cells, win.cols, 7)).toContain("wpn6");
    expect(cursorRow).toBe(1); // cursor 0 con scroll 0 → fila rel 1
  });

  it("con scroll, la ventana muestra los ítems desplazados y sitúa el cursor", () => {
    const { win, cursorRow } = layoutReadyPicker(READY_PICKER_RECT, view(rows, 7, 1));
    expect(rowText(win.cells, win.cols, 1)).toContain("wpn1"); // primer visible = índice 1
    expect(cursorRow).toBe(7); // cursor 7, scroll 1 → fila rel 7
  });

  it("el glifo de flecha: ▼ con overflow abajo, ↕ con ambos, null sin overflow", () => {
    expect(readyArrowGlyph(view(rows, 0, 0))).toBe(0x19); // hay abajo
    expect(readyArrowGlyph(view(rows, 3, 2))).toBe(0x12); // ambos
    expect(readyArrowGlyph(view(rows.slice(0, 5), 0, 0))).toBeNull(); // 5 ítems, sin overflow
  });
});

describe("(M)ix NO lleva pergamino — y por eso caben sus 8 reagentes", () => {
  const reagents: ReadyPickerRowView[] = [
    "Sulfur Ash", "Ginseng", "Garlic", "Sp. Silk",
    "Blood Moss", "Blk. Pearl", "Nightshade", "Mandrake",
  ].map((name) => ({ name, qty: 9, equipped: false, glyph: 0 }));

  const mixView = (cursor = 0): ReadyPickerView => ({
    phase: "pick",
    title: "Reagents:",
    rows: reagents,
    cursor,
    scroll: 0,
    variant: "mix",
  });

  it("★ ni una barra │ (0x17) ni una esquina (0x10/0x13/0x14/0x16) en toda la rejilla", () => {
    // NEGATIVA FUERTE con la ventana cubriendo el fenómeno: en las 189 instrucciones
    // del cuerpo de `mix_reagent_select` (CMDS.OVL 0x18be..0x1a6f) no hay UN putchar de
    // glifo de caja, y su único llamador (`cmd_mix` @0x1b5d) tampoco pinta marco antes
    // — sus 0x18/0x19/0x1a/0x1b @0x1b41-0x1b53 son las flechas del pie, cada una
    // seguida de coma (0x2c). Mix emite un FLUJO sobre la ventana recién borrada.
    const { win, framed } = layoutReadyPicker(MIX_REAGENT_RECT, mixView());
    expect(framed).toBe(false);
    for (const glyph of [0x10, 0x11, 0x13, 0x14, 0x15, 0x16, 0x17]) {
      expect([...win.cells]).not.toContain(glyph);
    }
  });

  it("★ CONTROL POSITIVO: la MISMA rejilla en variante 'ready' SÍ tiene el marco", () => {
    // Sin este control, el aserto de arriba pasaría con `drawListFrame` roto para todos.
    const readyRows: ReadyPickerRowView[] = reagents.map((r) => ({ ...r }));
    const { win, framed } = layoutReadyPicker(READY_PICKER_RECT, view(readyRows, 0, 0));
    expect(framed).toBe(true);
    expect([...win.cells]).toContain(0x17); // │
    expect([...win.cells]).toContain(0x10); // ┌
  });

  it("★ los OCHO reagentes caben (filas rel 1..8), sin scroll y sin perder el 8º", () => {
    // El bucle @0x1932-0x196d emite `\n` ANTES de cada fila, así que aterrizan en las
    // filas rel 1..8; con top=1/bot=9 el 8º da 8+1=9 ≤ 9 y el scroll del putchar
    // (@0x174f `cmp al,[si+3] / jle`) NO dispara. Con marco sólo cabrían 7 — que es el
    // síntoma que el acta de Mix dejó anotado sin causa (su cabo abierto (b)).
    const { win } = layoutReadyPicker(MIX_REAGENT_RECT, mixView());
    expect(rowText(win.cells, win.cols, 1)).toBe(" 09 Sulfur Ash");
    expect(rowText(win.cells, win.cols, 8)).toBe(" 09 Mandrake");
    // ★ Y arranca en la col 0 de la ventana, no en la 1: el espacio de @0x1939 es el
    // primer carácter del FLUJO, no el margen de un marco que no existe.
    expect(win.cells[1 * win.cols + 0]).toBe(0x20);
    expect(win.cells[1 * win.cols + 1]).toBe("0".charCodeAt(0));
  });
});

// ── Variante "shop": ventana «Arms» de venta del herrero (T-004b) ────────────────
// Calco de `list_wares` (SHOPPES.OVL 0x0c80): fila ` N-Abbrev` (cuenta 2 celdas
// space-pad + '-' + nombre corto 0x1972, SIN precio), página de 5 filas (`cmp si,5`
// @0x0dd6) y banda ▲/▼/↕ por (scroll, total). Testigo clip #31 arms_sell_list.png.
describe("variante 'shop' — fila `N-Abbrev` (list_wares 0x0c80)", () => {
  it("cuenta de 1 dígito: celda en blanco + dígito + '-' + nombre, a ras del borde derecho", () => {
    // Medición del testigo: barra interior de 13 celdas, texto en las cols 1..12
    // (` 1-Main Gauch` = 13 justas, nombre pegado al borde derecho).
    const { cells, highlightCols } = readyRowCells(
      { name: "Main Gauch", qty: 1, equipped: false, glyph: 0 },
      13,
      "shop",
    );
    expect(String.fromCharCode(...cells)).toBe(" 1-Main Gauch");
    expect(highlightCols).toEqual([]); // sin glifo de clase en la ventana de venta
  });

  it("las filas del testigo: ` 4-Sht. Sword` y ` 1-Bow` con pad de espacios al ancho", () => {
    const sword = readyRowCells({ name: "Sht. Sword", qty: 4, equipped: false, glyph: 0 }, 13, "shop");
    expect(String.fromCharCode(...sword.cells)).toBe(" 4-Sht. Sword");
    const bow = readyRowCells({ name: "Bow", qty: 1, equipped: false, glyph: 0 }, 13, "shop");
    // El pad de 13 espacios (DS 0x7c50) limpia el resto de la fila tras el nombre corto.
    expect(String.fromCharCode(...bow.cells)).toBe(" 1-Bow       ");
  });

  it("cuenta de 2 dígitos llena el campo (12 → `12-Bow`, sin celda en blanco)", () => {
    const { cells } = readyRowCells({ name: "Bow", qty: 12, equipped: false, glyph: 0 }, 13, "shop");
    expect(String.fromCharCode(...cells)).toBe("12-Bow       ");
  });
});

describe("variante 'shop' — página de 4 filas + marco corto + banda", () => {
  const armsRows: ReadyPickerRowView[] = Array.from({ length: 7 }, (_, i) => ({
    name: `Arm${i}`,
    qty: i + 1,
    equipped: false,
    glyph: 0,
  }));
  const shopView = (rows: ReadyPickerRowView[], cursor = 0, scroll = 0): ReadyPickerView => ({
    phase: "pick",
    title: "Arms",
    variant: "shop",
    rows,
    cursor,
    scroll,
  });

  it("marco de 4 filas de contenido (borde inferior en rel 5) dentro del MISMO rect", () => {
    // Página de 4 (corrección buy-herrero: list_wares contenido rel 1..4, cmp ax,5 @0x0d9d).
    const { win, cursorRow } = layoutReadyPicker(READY_PICKER_RECT, shopView(armsRows));
    // Contenido en rel 1..4: primer ítem visible arriba, 4º en la última fila de la página.
    expect(rowText(win.cells, win.cols, 1)).toContain("1-Arm0");
    expect(rowText(win.cells, win.cols, 4)).toContain("4-Arm3");
    // rel 5 = borde inferior del marco corto (glifos de caja, sin texto de ítem);
    // rel 6..8 (el resto del rect del panel) quedan en blanco.
    expect(rowText(win.cells, win.cols, 5)).not.toContain("Arm");
    expect(rowText(win.cells, win.cols, 6)).toBe("");
    expect(rowText(win.cells, win.cols, 7)).toBe("");
    expect(rowText(win.cells, win.cols, 8)).toBe("");
    expect(cursorRow).toBe(1);
  });

  it("scroll de página de 4: la ventana muestra desde `scroll` y sitúa el cursor", () => {
    const { win, cursorRow } = layoutReadyPicker(READY_PICKER_RECT, shopView(armsRows, 6, 3));
    expect(rowText(win.cells, win.cols, 1)).toContain("4-Arm3"); // primer visible = índice 3
    expect(rowText(win.cells, win.cols, 4)).toContain("7-Arm6"); // último visible = índice 6
    expect(cursorRow).toBe(4); // cursor 6 − scroll 3 + 1
  });

  it("glifo de banda por página de 4: ▼ sólo-después, ▲ sólo-antes, ↕ ambos, null si cabe", () => {
    // 7 ítems, página de 4 (flag @0x0dde-0x0e1d: +2 prev, +1 next).
    expect(readyArrowGlyph(shopView(armsRows, 0, 0))).toBe(0x19); // hay tras la página → ▼
    expect(readyArrowGlyph(shopView(armsRows, 6, 3))).toBe(0x18); // hay antes → ▲
    expect(readyArrowGlyph(shopView(armsRows, 3, 1))).toBe(0x12); // antes Y después → ↕
    expect(readyArrowGlyph(shopView(armsRows.slice(0, 4), 0, 0))).toBeNull(); // 4 justas: sin banda
    expect(readyArrowGlyph(shopView(armsRows.slice(0, 5), 0, 0))).toBe(0x19); // 5 ya desbordan → ▼
  });
});
