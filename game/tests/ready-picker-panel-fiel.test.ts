/**
 * GUARDA de fidelidad del PANEL de (R)eady — hermana de `use-picker-panel-fiel.test.ts`.
 *
 * El carril `usepicker-fidelidad` (#149) derivó el panel de (U)se y dejó un cabo
 * apuntando aquí: el `--` que el port pintaba en (U)se **es de este panel**, porque
 * (R)eady pasa un ÍNDICE DE PERSONAJE como modo y por eso puede listar un ítem con
 * cuenta 0 (está equipado). Esta guarda deriva el panel de (R)eady entero y fija sus
 * esperados EN CRUDO (`re/notes/ready-picker-panel.md`).
 *
 * Los tres llamadores de `print_list_row` @0x05e2 — (U)se, (R)eady y la lista «Items»
 * de Ztats — comparten UNA rutina de fila (`listRowCells`), así que cada aserto de
 * aquí es además un aserto sobre las otras dos superficies.
 *
 * Fuentes: `re/disasm/ZSTATS.OVL.asm` + `re/disasm/ULTIMA.EXE.asm` (destinos
 * cross-overlay resueltos con `re/tools/dispatch_table.py`, base ZSTATS 0xE1E0) y el
 * volcado de `DATA.OVL` (`fileoff = DS + 0x10`).
 */
import { describe, it, expect, afterEach } from "vitest";
import type { ReadyPickerRowView } from "../src/skin/api.js";
import {
  READY_PICKER_RECT,
  layoutReadyPicker,
  readyRowCells,
} from "../src/skin/fiel/ready.js";
import { listRowCells } from "../src/skin/fiel/ztats.js";
import { READY_GLYPH_TABLE, buildReadyRows } from "../src/core/readyPicker.js";
import shortEquipNames from "../src/core/data/shortEquipNames.json" with { type: "json" };
import { READY_UI } from "../src/core/world/cmd-strings.js";
import { setLang, BASE_LANG } from "../src/i18n/index.js";

/** Ancho de CONTENIDO del pergamino = 13 celdas (marco de 15, barras en 0 y 14). */
const INNER = 13;

const row = (o: Partial<ReadyPickerRowView> & { name: string }): ReadyPickerRowView => ({
  qty: 0,
  equipped: false,
  glyph: 0,
  ...o,
});

/** Texto de una fila de celdas (los <0x20 se marcan con '·': son control/rúnicos). */
const text = (cells: number[]): string =>
  cells.map((c) => (c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : "·")).join("");

afterEach(() => setLang(BASE_LANG));

// ── §1 · Los DOS argumentos que el modo 'R' cambia en print_list_row ────────────

describe("la name-table de (R)eady es la 0x1962 (equipo), no la 0x1916 de (U)se", () => {
  /**
   * `item_page_controller` @0x0f2e ramifica por el modo ANTES de llamar a la fila:
   *   0f40: 837e0452  cmp word ptr [bp + 4], 0x52      ; 'R'
   *   0f46: c746eec057  mov word ptr [bp - 0x12], 0x57c0 ; tabla de cuentas de EQUIPO
   *   0f4b: c746f83000  mov word ptr [bp - 8], 0x30      ; 48 entradas
   *   0f54: c746eeeeb9  mov word ptr [bp - 0x12], 0xb9ee ; (modo 'U': tabla extendida)
   *   0f59: c746f82600  mov word ptr [bp - 8], 0x26      ; 38 entradas
   * y empuja 0x1962 (@0x0f87) en vez de 0x1916 (@0x0f96) como name-table.
   */
  it("son 48 nombres, volcados VERBATIM de DS 0x1962", () => {
    const names = shortEquipNames.names;
    expect(names).toHaveLength(0x30);
    // Cuatro anclas del volcado, una por bloque de la tabla (cascos/escudos/
    // armaduras/armas) + la última entrada.
    expect(names[0x00]).toBe("Leath Helm");
    expect(names[0x04]).toBe("Sm. Shield");
    expect(names[0x0d]).toBe("Chain");
    expect(names[0x1e]).toBe("Long Sword");
    expect(names[0x2f]).toBe("Ankh");
  });

  it("★ el ancho DICTA las abreviaturas: ninguna pasa de 10 y 22 miden 10 justas", () => {
    // La fila mide 14 celdas y arranca en la col 1 del marco ⇒ 13 de contenido; la
    // columna de cuenta de (R)eady NUNCA se oculta (§2), así que gasta 2+1 SIEMPRE
    // ⇒ al nombre le quedan 10. Que 22 de 48 midan EXACTAMENTE 10 y ninguna se pase
    // es la confirmación de que la lectura del ancho es la buena (mismo argumento
    // que la tabla 0x1916 de (U)se, donde el tope es 13 porque allí sí se oculta).
    const names = shortEquipNames.names;
    expect(Math.max(...names.map((n) => n.length))).toBe(10);
    expect(names.filter((n) => n.length === 10)).toHaveLength(22);
  });

  it("★ NINGUNO lleva sigilo `*`/`!`/`(` ⇒ (R)eady no tiene nombres RÚNICOS", () => {
    // `print_list_row` ramifica por el PRIMER byte del nombre (@0x0638 `*`, @0x0664
    // `!`, @0x068e `(`) y esas tres ramas son las que encienden RUNES.CH sobre el
    // NOMBRE. La tabla de equipo no tiene ni una: 0 de 48. Lo único rúnico de una
    // fila de (R)eady es el separador de §3.
    const sigils = shortEquipNames.names.filter((n) => "*!(".includes(n[0]!));
    expect(sigils).toEqual([]);
  });
});

// ── §2 · La columna de cuenta: qué imprime con un ÍNDICE DE PJ como modo ────────

describe("la columna de cuenta de (R)eady — modo = índice de PJ", () => {
  it("cuenta>0: 2 díg. justificados con pad ESPACIO (print_number(ax,2,0x20) @0x0600)", () => {
    const { cells } = readyRowCells(row({ name: "Dagger", qty: 3 }), INNER);
    expect(text(cells)).toBe(" 3 Dagger    ");
  });

  it("★ cuenta 0 + EQUIPADO: `--` (DS 0x9778) — el caso que NO existe en (U)se", () => {
    // @0x05f9 `or al,al / je 0x60e` → print(0x9778)="--". En (U)se es inalcanzable
    // (`find_next_owned` con modo 0xff sólo devuelve índices de byte ≠0); aquí SÍ,
    // porque @0x05bf-0x05cc, con modo ≠0xff, acepta un índice de cuenta 0 cuando
    // `is_item_equipped` (@0x0518) dice que sí. Testigo: la fila `--♥Chain`.
    const { cells } = readyRowCells(
      row({ name: "Chain", qty: 0, equipped: true, glyph: 0x03 }),
      INNER,
    );
    expect(text(cells).slice(0, 2)).toBe("--");
    expect(cells[2]).toBe(0x03); // el separador es el glifo de clase (§3)
    expect(text(cells).slice(3)).toBe("Chain     ");
  });

  it("★ la columna NUNCA se OCULTA en (R)eady: la tabla 0x57c0 topa en 99", () => {
    // El tercer estado de @0x05f5 (`cmp al,0xff / je 0x62e` ⇒ ni número ni
    // separador) es el que gobierna (U)se, y aquí es INALCANZABLE: los tres
    // escritores de 0x57c0 topan el byte en 0x63=99 —SJOG @0x1697 `cmp …,0x64` +
    // @0x169e `mov …,0x63`; SHOPPES @0x0a5e/@0x0ac1 igual; ZSTATS @0x0ccd `cmp
    // …,0x63` antes del `inc` @0x0cd4—, así que nunca vale 0xff.
    // ⇒ toda fila de (R)eady arranca su NOMBRE en la celda 3. Simetría exacta con
    // (U)se, donde el inalcanzable es el `--`.
    for (const qty of [0, 1, 42, 99]) {
      const { cells } = readyRowCells(row({ name: "Ankh", qty, equipped: qty === 0 }), INNER);
      expect(text(cells).slice(3)).toBe("Ankh         ".slice(0, INNER - 3));
    }
  });
});

// ── §3 · El separador: espacio, o el glifo de clase EN LA FUENTE RÚNICA ─────────

describe("el separador de (R)eady se decide POR FILA (@0x104b-0x1070)", () => {
  it("NO equipado → 0x20 (la rama @0x1061 → @0x0f7c)", () => {
    const { cells, highlightCols } = readyRowCells(row({ name: "Bow", qty: 2 }), INNER);
    expect(cells[2]).toBe(0x20);
    expect(highlightCols).toEqual([]); // nada rúnico en la fila
  });

  it("EQUIPADO → `byte[0x1ae8 + id]`, y esa celda va en RUNES.CH", () => {
    // 1064: 8b5ef0    mov bx, word ptr [bp - 0x10]
    // 1067: 8a87e81a  mov al, byte ptr [bx + 0x1ae8]
    // 106d: 8946f6    mov word ptr [bp - 0xa], ax      ; ← el separador
    // y `print_list_row` @0x0615 lo envuelve en set_font(1)/set_font(0) por ser <0x20.
    const { cells, highlightCols } = readyRowCells(
      row({ name: "Chain Coif", qty: 1, equipped: true, glyph: 0x01 }),
      INNER,
    );
    expect(cells[2]).toBe(0x01);
    expect(highlightCols).toEqual([2]);
  });

  it("★ la tabla 0x1ae8 volcada: 48 bytes, TODOS <0x20 ⇒ el marcador es rúnico SIEMPRE", () => {
    expect(READY_GLYPH_TABLE).toHaveLength(0x30);
    expect(READY_GLYPH_TABLE.every((g) => g >= 0x01 && g <= 0x1e)).toBe(true);
    // Agrupada por CLASE en la cabeza (4 cascos → 0x01, 5 escudos → 0x02, 7
    // armaduras → 0x03) y con glifo propio por arma a partir de 0x10.
    expect(READY_GLYPH_TABLE.slice(0x00, 0x04)).toEqual([1, 1, 1, 1]);
    expect(READY_GLYPH_TABLE.slice(0x04, 0x09)).toEqual([2, 2, 2, 2, 2]);
    expect(READY_GLYPH_TABLE.slice(0x09, 0x10)).toEqual([3, 3, 3, 3, 3, 3, 3]);
    expect(READY_GLYPH_TABLE[0x2f]).toBe(0x1b);
    // El testigo `--♥Chain`: Chain = id 0x0d, y ese ♥ es RUNES.CH[0x03].
    expect(READY_GLYPH_TABLE[0x0d]).toBe(0x03);
  });

  it("★ CONTROL POSITIVO de la rama de fuente: un separador ≥0x20 NO es rúnico", () => {
    // El discriminante @0x0615 es `cmp [bp+4],0x20 / jae` — el umbral, no «es de
    // (R)eady». Instanciado DONDE EXISTE la diferencia: mismo llamador, dos
    // separadores a un byte de distancia del umbral.
    expect(listRowCells({ idx: 0, name: "Chain", qty: 0 }, INNER, 0x1f).runeCols).toEqual([2]);
    expect(listRowCells({ idx: 0, name: "Chain", qty: 0 }, INNER, 0x20).runeCols).toEqual([]);
  });

  it("★ los otros DOS llamadores de print_list_row no ejercen la rama (0x2d y 0x20)", () => {
    // `render_item_list` @0x0765 empuja 0x2d; el picker de (U)se @0x0f9a empuja
    // 0x20. Por eso la rama de fuente del separador estaba LATENTE hasta (R)eady.
    expect(listRowCells({ idx: 0, name: "Torch", qty: 5 }, INNER, 0x2d).cells[2]).toBe(0x2d);
    expect(listRowCells({ idx: 0, name: "Torch", qty: 5 }, INNER, 0x2d).runeCols).toEqual([]);
    expect(listRowCells({ idx: 0, name: "Torch", qty: 5 }, INNER, 0x20).runeCols).toEqual([]);
  });
});

// ── §4 · Una sola rutina de fila para las TRES superficies ──────────────────────

describe("(R)eady y (U)se salen del MISMO print_list_row, sólo cambian argumentos", () => {
  it("la fila de (R)eady es `listRowCells` con la name-table y el separador del modo 'R'", () => {
    const equipped = row({ name: "Long Sword", qty: 0, equipped: true, glyph: 0x11 });
    expect(readyRowCells(equipped, INNER)).toEqual({
      cells: listRowCells({ idx: 0, name: "Long Sword", qty: 0 }, INNER, 0x11).cells,
      highlightCols: listRowCells({ idx: 0, name: "Long Sword", qty: 0 }, INNER, 0x11).runeCols,
    });
  });

  it("el choke i18n es de DISPLAY: en 'en' las dos vías son byte-idénticas", () => {
    const r = readyRowCells(row({ name: "Mace", qty: 7 }), INNER);
    expect(r.cells).toEqual(listRowCells({ idx: 0, name: "Mace", qty: 7 }, INNER, 0x20).cells);
  });

  it("bajo ES ninguna fila rebasa las 13 celdas del pergamino", () => {
    setLang("es");
    for (const name of shortEquipNames.names) {
      const { cells } = readyRowCells(row({ name, qty: 9, equipped: false }), INNER);
      expect(cells).toHaveLength(INNER);
    }
  });
});

// ── §5 · Población de filas: poseídos O equipados (find_next_owned con charIdx) ─

describe("buildReadyRows — `find_next_owned` @0x05a4 con modo = índice de PJ", () => {
  const deps = (qty: Record<number, number>, eq: number[]) => ({
    qtyOf: (id: number) => qty[id] ?? 0,
    isEquipped: (id: number) => eq.includes(id),
    nameOf: (id: number) => shortEquipNames.names[id]!,
  });

  it("acepta cuenta≠0 (@0x05ba `cmp byte[bx+si],0 / jne`) y equipados de cuenta 0", () => {
    const rows = buildReadyRows(deps({ 0x10: 2 }, [0x0d]));
    expect(rows.map((r) => [r.equipId, r.qty, r.equipped])).toEqual([
      [0x0d, 0, true], // Chain: 0 en el pack pero PUESTO → fila `--♥Chain`
      [0x10, 2, false], // Dagger: 2 sueltas
    ]);
  });

  it("cuenta 0 y NO equipado se SALTA (@0x05c3 `je` → siguiente índice)", () => {
    expect(buildReadyRows(deps({}, []))).toEqual([]);
  });

  it("el glifo de cada fila sale de la tabla 0x1ae8 por su id", () => {
    const rows = buildReadyRows(deps({ 0x00: 1, 0x04: 1, 0x09: 1 }, []));
    expect(rows.map((r) => r.glyph)).toEqual([0x01, 0x02, 0x03]);
  });
});

// ── §6 · El panel entero: cabecera, marco y consola ─────────────────────────────

describe("el panel de (R)eady (cmd_ready @0x1296)", () => {
  it("★ la CABECERA del panel es el NOMBRE DEL PJ, no una cadena fija", () => {
    // 12dd: 8b46fc  mov ax, word ptr [bp - 4]      ; índice del PJ
    // 12e0: b105    mov cl, 5                      ; registro de 32 bytes
    // 12e4: 05a855  add ax, 0x55a8                 ; → el registro EMPIEZA por el nombre
    // 12e8: e88559  call 0x6c70                    ; = ULTIMA.EXE 0x4e50 draw_panel_banner
    // Y 0x6c70 es LA MISMA rutina que CAST @0x8ed0, la que pinta «Items:» en (U)se
    // (las dos resuelven a ULTIMA.EXE 0x4e50 con sus bases: 0xE1E0 / 0xBF80).
    // O sea: mismo banner ►texto◄, distinto texto — y en (R)eady el texto es un DATO.
    const layout = layoutReadyPicker(READY_PICKER_RECT, {
      phase: "pick",
      title: "Shamino",
      rows: [row({ name: "Dagger", qty: 1 })],
      cursor: 0,
      scroll: 0,
    });
    // El banner lo blitea skin.ts desde `title`; aquí se fija que NO viaja como
    // celda del pergamino (la fila 0 del marco es el borde, no un rótulo).
    expect(layout.win.cells[0]).not.toBe("S".charCodeAt(0));
  });

  it("las tres cadenas de consola, verbatim de DATA.OVL", () => {
    expect(READY_UI.item).toBe("Item: "); // DS 0x9998, @0x12cc → consola
    expect(READY_UI.empty).toBe("Thou art empty-handed!"); // DS 0x997e, @0x12c3
    expect(READY_UI.done).toBe("Done"); // DS 0x9970, @0x123e (ESC en modo 'R')
  });

  it("marco de 15×9 con 7 filas de contenido (draw_list_frame(8) @0x12ee)", () => {
    const rows = Array.from({ length: 9 }, (_, i) => row({ name: "Bow", qty: i + 1 }));
    const { win } = layoutReadyPicker(READY_PICKER_RECT, {
      phase: "pick",
      title: "Iolo",
      rows,
      cursor: 0,
      scroll: 0,
    });
    expect(win.cols).toBe(15);
    expect(win.rows).toBe(9);
    // Barras verticales en las cols 0 y 14 de las filas 1..7 (@0x04c4-0x04e4).
    for (let r = 1; r <= 7; r++) {
      expect(win.cells[r * 15 + 0]).toBe(0x17);
      expect(win.cells[r * 15 + 14]).toBe(0x17);
    }
    // Sólo 7 de las 9 filas caben: la página corta en `cmp ax,8` @0x0fbf.
    expect(win.cells[8 * 15 + 1]).toBe(0x15); // borde inferior, no contenido
  });
});
