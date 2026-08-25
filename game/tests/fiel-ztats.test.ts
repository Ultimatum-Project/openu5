/**
 * Páginas de Ztats FIELES (calco ronda 2) — presentación REAL del comando Z
 * re-derivada de ZSTATS.OVL con las cadenas EXTRAÍDAS del binario:
 *   · SELECCIÓN de jugador primero (`select_player` 0x0000).
 *   · Ficha de STATS en dos columnas (`draw_stat_page` 0x0082).
 *   · Página de ARMAS (`draw_arms_page` 0x02a8) y PROVISIONES (0x039c).
 *   · Las 4 listas con marco de pergamino (`render_item_list` 0x06e8).
 */
import { describe, expect, it } from "vitest";
import {
  armsTitleUnderline,
  drawListFrame,
  isArmsPage,
  listForPage,
  listRowCells,
  renderArmsPage,
  renderItemListPage,
  renderProvisionsPage,
  renderStatPage,
  ztatsBannerText,
  ztatsKeyReducer,
  ztatsListArrowGlyph,
  ZTATS_LIST_ROWS,
  ZTATS_PAGE_PROVISIONS,
  type ZtatsState,
} from "../src/skin/fiel/ztats.js";
import { setLang, BASE_LANG } from "../src/i18n/index.js";
import { TextWindow } from "../src/skin/fiel/textwindow.js";
import type {
  InventoryListItem,
  InventoryMemberEquip,
  InventoryView,
  ViewSnapshot,
  ZtatsMemberView,
} from "../src/skin/api.js";

const MEMBER: ZtatsMemberView = {
  name: "Iolo",
  charClass: "B", // Bard (indent 2)
  status: "G", //    Good Health
  gender: "M", //    ♂ (0x0b)
  str: 16,
  dex: 24,
  int: 13,
  hp: 45,
  maxHp: 60,
  mp: 8,
  exp: 1200,
  level: 3,
};

const PANEL = { leftCol: 24, topRow: 1, rightCol: 38, botRow: 10 }; // 15×10

/** Texto de una fila de la rejilla (trailing trim). */
function row(w: TextWindow, r: number): string {
  let s = "";
  for (let c = 0; c < w.cols; c++)
    s += String.fromCharCode(w.cells[r * w.cols + c]!);
  return s.replace(/\s+$/, "");
}

describe("renderStatPage — ficha en dos columnas (draw_stat_page 0x0082)", () => {
  const w = renderStatPage(PANEL, MEMBER);

  it("fila 0: `♂ Lv-N Clase` (género glifo 0x0b, indent por clase 0x1a58)", () => {
    // Bard → indent 2; ♂ = 0x0b; " Lv-3 Bard".
    expect(w.cells[0 * w.cols + 2]).toBe(0x0b); // ♂ tras 2 espacios de indent
    expect(row(w, 0)).toContain("Lv-3 Bard");
  });

  it("fila 1: estado de salud centrado (tabla 0x1a6a → 'Good Health')", () => {
    expect(row(w, 1).trim()).toBe("Good Health");
  });

  it("dos columnas: Str=/HP: (fila3), Int=/HM: (fila4), Dex=/Ex: (fila5)", () => {
    expect(row(w, 3)).toBe("Str=16  HP:  45"); // Str +0x0c pad'0' · HP +0x10 word
    expect(row(w, 4)).toBe("Int=13  HM:  60"); // Int +0x0e · maxHP +0x12 (¡visible!)
    expect(row(w, 5)).toBe("Dex=24  Ex:1200"); // Dex +0x0d · Exp +0x14 word
  });

  it("fila 7: `    Magic: N` (currentMP +0x0f, pad ESPACIO no '0')", () => {
    expect(row(w, 7)).toBe("    Magic: 8"); // MP=8, pad espacio (0x20)
  });

  it("el NIVEL va en la cabecera, no como línea de stat", () => {
    for (let r = 2; r < w.rows; r++) expect(row(w, r).startsWith("Lv")).toBe(false);
  });
});

describe("renderProvisionsPage — página 0xc (0x039c)", () => {
  const base = { food: 20, gold: 100, keys: 3, gems: 2, torches: 5, grapple: false };

  it("Food/Gold con ': ' (4 díg.), Keys/Gems/Torches con puntos (2 díg.)", () => {
    const w = renderProvisionsPage(PANEL, base);
    expect(row(w, 1)).toBe(" Food:   20");
    expect(row(w, 2)).toBe(" Gold:  100");
    expect(row(w, 4)).toBe(" Keys....... 3");
    expect(row(w, 5)).toBe(" Gems....... 2");
    expect(row(w, 6)).toBe(" Torches.... 5");
  });

  it("gancho SÓLO si se posee (0x044f, string 0x976e)", () => {
    expect(row(renderProvisionsPage(PANEL, base), 7)).toBe("");
    expect(row(renderProvisionsPage(PANEL, { ...base, grapple: true }), 7)).toBe(
      " Grapple",
    );
  });

  it("ES: 'Comida:' con las cifras de Comida y Oro alineadas en columna común", () => {
    // Testigo del usuario: bajo 'es' 'Com.:' pasa a 'Comida:' y los números de Food/Gold
    // se desplazan a la DERECHA alineados entre sí (labels padded a 9 celdas → cifra en
    // col 9). 'Oro:' se rellena para casar el ancho. EN queda byte-exacto (arriba).
    setLang("es", { persist: false });
    try {
      const w = renderProvisionsPage(PANEL, base);
      expect(row(w, 1)).toBe(" Comida:   20"); // 4-díg. a la dcha, acaba en col 12
      expect(row(w, 2)).toBe(" Oro:     100"); // MISMA columna de cifra que Comida
      // Alineación: el último dígito de ambos cae en la misma columna (12).
      expect(row(w, 1).length).toBe(row(w, 2).length);
    } finally {
      setLang(BASE_LANG, { persist: false });
    }
  });
});

describe("renderArmsPage — página de armas (draw_arms_page 0x02a8)", () => {
  const equip: InventoryMemberEquip = {
    helmet: "Iron Helm",
    armor: "Scale",
    weapon: "Silver Swd",
    shield: null,
    ring: null,
    amulet: null,
    spells: [],
  };

  it("título 'Arms' + ítems equipados por nombre (slots +0x19.., vacíos saltados)", () => {
    const w = renderArmsPage(PANEL, equip);
    expect(row(w, 0).trim()).toBe("Arms");
    expect(row(w, 2)).toBe(" Iron Helm");
    expect(row(w, 3)).toBe(" Scale");
    expect(row(w, 4)).toBe(" Silver Swd");
  });

  it("subrayado del título 'Arms'/'Armas' (attr 0xfe): tramo centrado bajo la fila 0", () => {
    // Sólo las páginas de armas (impares 1,3,…,11) llevan subrayado.
    expect(isArmsPage(1)).toBe(true);
    expect(isArmsPage(3)).toBe(true);
    expect(isArmsPage(0)).toBe(false); // stats
    expect(isArmsPage(ZTATS_PAGE_PROVISIONS)).toBe(false);
    expect(isArmsPage(0xf)).toBe(false); // lista
    // 'Arms' (4) centrado en 15 celdas: start=floor((15-4)/2)=5, len=4.
    expect(armsTitleUnderline(15)).toEqual({ row: 0, startCol: 5, len: 4 });
    // ES: 'Armas' (5) → start=5, len=5 (el subrayado sigue al rótulo traducido).
    setLang("es", { persist: false });
    try {
      expect(armsTitleUnderline(15)).toEqual({ row: 0, startCol: 5, len: 5 });
    } finally {
      setLang(BASE_LANG, { persist: false });
    }
  });

  it("todos los slots vacíos → '(None ready)' (0x9716)", () => {
    const empty: InventoryMemberEquip = {
      helmet: null,
      armor: null,
      weapon: null,
      shield: null,
      ring: null,
      amulet: null,
      spells: [],
    };
    const w = renderArmsPage(PANEL, empty);
    let all = "";
    for (let r = 0; r < w.rows; r++) all += row(w, r);
    expect(all).toContain("(None ready)");
  });
});

// ── Estado y reductor: SELECCIÓN + eje de páginas ───────────────────────────────

const page = (p: number, scroll = 0, cursor = 0): ZtatsState => ({
  mode: "page",
  page: p,
  scroll,
  cursor,
});
const select = (cursor = 0): ZtatsState => ({
  mode: "select",
  page: 0,
  scroll: 0,
  cursor,
});

describe("ztatsKeyReducer — SELECCIÓN de jugador primero (select_player 0x0000)", () => {
  const ctx = { partySize: 3 };

  it("CERRADO: sólo Z abre → modo SELECT (candidato 0); otras teclas no se consumen", () => {
    expect(ztatsKeyReducer(null, "z", ctx)).toEqual({ state: select(0), handled: true });
    expect(ztatsKeyReducer(null, "ArrowRight", ctx)).toEqual({ state: null, handled: false });
    expect(ztatsKeyReducer(null, "1", ctx)).toEqual({ state: null, handled: false });
  });

  it("SELECT: flechas mueven el candidato circular en la party", () => {
    expect(ztatsKeyReducer(select(0), "ArrowDown", ctx).state).toEqual(select(1));
    expect(ztatsKeyReducer(select(1), "ArrowRight", ctx).state).toEqual(select(2));
    expect(ztatsKeyReducer(select(0), "ArrowUp", ctx).state).toEqual(select(2)); // wrap
    expect(ztatsKeyReducer(select(2), "ArrowDown", ctx).state).toEqual(select(0)); // wrap
  });

  it("SELECT: Enter/Space confirman el candidato → ficha de stats (member*2)", () => {
    expect(ztatsKeyReducer(select(1), "Enter", ctx).state).toEqual(page(2, 0, 1));
    expect(ztatsKeyReducer(select(2), " ", ctx).state).toEqual(page(4, 0, 2));
  });

  it("SELECT: '1'-'6' eligen directo (acotado a la party); ESC cierra", () => {
    expect(ztatsKeyReducer(select(0), "3", ctx).state).toEqual(page(4, 0, 2)); // miembro 2
    expect(ztatsKeyReducer(select(0), "5", ctx).state).toEqual(select(0)); // fuera de party
    expect(ztatsKeyReducer(select(1), "Escape", ctx)).toEqual({ state: null, handled: true });
  });

  it("SELECT: '0' CONFIRMA el candidato (migración #17b al picker compartido; antes se tragaba)", () => {
    // select_party_member (0x2d7a): Enter/Space/'0' confirman. El reducer viejo de Ztats se
    // comía el '0'; al delegar en selectPartyMemberKey ahora confirma como en el Camp/Cast.
    expect(ztatsKeyReducer(select(2), "0", ctx).state).toEqual(page(4, 0, 2));
    expect(ztatsKeyReducer(select(0), "0", ctx).state).toEqual(page(0, 0, 0));
  });

  it("SELECT: teclas no reconocidas se TRAGAN (modal), sin cambiar de estado", () => {
    expect(ztatsKeyReducer(select(1), "x", ctx)).toEqual({ state: select(1), handled: true });
  });
});

describe("ztatsKeyReducer — eje de páginas (cmd_zstats 0x0a3a)", () => {
  const ctx = { partySize: 3 };

  it("PAGE: SPACE y ESC cierran por igual", () => {
    expect(ztatsKeyReducer(page(1), " ", ctx)).toEqual({ state: null, handled: true });
    expect(ztatsKeyReducer(page(4), "Escape", ctx)).toEqual({ state: null, handled: true });
  });

  it("RING §2: recorrido next completo sin entrar al hueco 6..0xb", () => {
    const seen: number[] = [];
    let s: ZtatsState = page(0);
    for (let i = 0; i < 12; i++) {
      seen.push(s.page);
      s = ztatsKeyReducer(s, "ArrowRight", ctx).state!;
    }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 0xc, 0xd, 0xe, 0xf, 0x10, 0]);
  });

  it("RING §2: los 4 gates de wrap (party*2−1→0xc, 0x10→0, 0→0x10, 0xc→party*2−1)", () => {
    expect(ztatsKeyReducer(page(5), "ArrowRight", ctx).state!.page).toBe(0xc);
    expect(ztatsKeyReducer(page(0x10), "ArrowRight", ctx).state!.page).toBe(0);
    expect(ztatsKeyReducer(page(0), "ArrowLeft", ctx).state!.page).toBe(0x10);
    expect(ztatsKeyReducer(page(0xc), "ArrowLeft", ctx).state!.page).toBe(5);
  });

  it("PAGE: '1'-'6' saltan a la ficha del miembro; '0' → provisiones", () => {
    expect(ztatsKeyReducer(page(0), "3", ctx).state).toEqual(page(4, 0, 2));
    expect(ztatsKeyReducer(page(4), "5", ctx).state).toEqual(page(4, 0, 0)); // fuera de party
    expect(ztatsKeyReducer(page(2), "0", ctx).state!.page).toBe(ZTATS_PAGE_PROVISIONS);
  });

  it("NO-lista (stats): las 4 flechas ciclan el eje", () => {
    expect(ztatsKeyReducer(page(2), "ArrowUp", ctx).state!.page).toBe(1);
    expect(ztatsKeyReducer(page(2), "ArrowLeft", ctx).state!.page).toBe(1);
    expect(ztatsKeyReducer(page(2), "ArrowDown", ctx).state!.page).toBe(3);
    expect(ztatsKeyReducer(page(2), "ArrowRight", ctx).state!.page).toBe(3);
  });

  it("F9 NO se consume (hot-swap)", () => {
    expect(ztatsKeyReducer(page(1), "F9", ctx)).toEqual({ state: page(1), handled: false });
  });
});

describe("ztatsKeyReducer — sub-bucle de LISTA (render_item_list 0x06e8)", () => {
  const P = 3;

  it("con OVERFLOW: ↑/↓ scrollean 1; PgUp/PgDn 7; ←/→ cambian de página; Home/End bordes", () => {
    const ctx = { partySize: P, ownedCount: 20 }; // maxScroll = 13
    expect(ztatsKeyReducer(page(0xd, 0), "ArrowDown", ctx).state).toEqual(page(0xd, 1));
    expect(ztatsKeyReducer(page(0xd, 5), "ArrowUp", ctx).state).toEqual(page(0xd, 4));
    expect(ztatsKeyReducer(page(0xd, 0), "PageDown", ctx).state).toEqual(page(0xd, ZTATS_LIST_ROWS));
    expect(ztatsKeyReducer(page(0xd, 13), "PageDown", ctx).state!.scroll).toBe(13); // clamp
    expect(ztatsKeyReducer(page(0xd, 0), "Home", ctx).state).toEqual(page(0xd, 0));
    expect(ztatsKeyReducer(page(0xd, 0), "End", ctx).state).toEqual(page(0xd, 13));
    // ←/→ cambian de página del eje (no scrollean), scroll reset.
    expect(ztatsKeyReducer(page(0xd, 5), "ArrowRight", ctx).state).toEqual(page(0xe, 0));
    expect(ztatsKeyReducer(page(0xd, 5), "ArrowLeft", ctx).state).toEqual(
      page(ZTATS_PAGE_PROVISIONS, 0),
    );
  });

  it("SIN overflow: ↑/↓ ciclan el eje como fuera de una lista (no scroll)", () => {
    const ctx = { partySize: P, ownedCount: 5 }; // cabe entero → maxScroll 0
    // Abajo → axisNext (0xd → 0xe); Arriba → axisPrev (0xd → 0xc provisiones).
    expect(ztatsKeyReducer(page(0xd, 0), "ArrowDown", ctx).state!.page).toBe(0xe);
    expect(ztatsKeyReducer(page(0xd, 0), "ArrowUp", ctx).state!.page).toBe(ZTATS_PAGE_PROVISIONS);
  });
});

// ── Visor de listas: marco de pergamino + filas ─────────────────────────────────

const LIST_RECT = { leftCol: 24, topRow: 1, rightCol: 38, botRow: 10 }; // 15×10

describe("drawListFrame — marco de pergamino (0x045e §4)", () => {
  it("7 filas de contenido: barras 1..7, borde inferior en la fila 8", () => {
    const w = new TextWindow(LIST_RECT);
    drawListFrame(w, ZTATS_LIST_ROWS);
    expect(w.cols).toBe(15);
    expect(w.cells[0]).toBe(0x10); // ┌
    expect(w.cells[14]).toBe(0x13); // ┐
    expect(w.cells[ZTATS_LIST_ROWS * 15 + 0]).toBe(0x17); // barra vertical fila 7
    const br = ZTATS_LIST_ROWS + 1; // 8
    expect(w.cells[br * 15 + 0]).toBe(0x14); // └
    expect(w.cells[br * 15 + 14]).toBe(0x16); // ┘
  });
});

describe("listRowCells — una fila (0x05e2 §5)", () => {
  const inner = 13;
  const s = (r: { cells: number[] }): string =>
    r.cells.map((c) => String.fromCharCode(c)).join("").replace(/\s+$/, "");

  it("qty 2 díg. pad espacio + separador '-' + nombre", () => {
    expect(s(listRowCells({ idx: 0, name: "Torch", qty: 8 }, inner))).toBe(" 8-Torch");
    expect(s(listRowCells({ idx: 1, name: "Gem", qty: 12 }, inner))).toBe("12-Gem");
  });

  it("qty==0xff oculta la columna de cantidad y el separador", () => {
    expect(s(listRowCells({ idx: 2, name: "Key", qty: 0xff }, inner))).toBe("Key");
  });

  // ★ `0x3abe` es set_FONT (RUNES.CH), no un realce — ver `RowLayout.runeCols`: los
  // glifos del DOSBox careados uno a uno casan con RUNES.CH y con ninguno de IBM.CH.
  // Lo que cada rama fija es el ALCANCE de la fuente rúnica, y las tres son distintas.
  it("prefijo '*' (@0x0638): decoración 0x977c + la SIGLA, las dos en rúnicas", () => {
    const r = listRowCells({ idx: 3, name: "*IS", qty: 2 }, inner);
    expect(r.cells[3]).toBe(0x1c); //  glifo de la decoración '*'
    expect(s(r)).toBe(` 2-${String.fromCharCode(0x1c)} + IS`);
    // set_font(0) va DESPUÉS del nombre (@0x0652) ⇒ cols 3..9 = deco(4) + "IS"(2)…
    expect(r.runeCols).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it("prefijo '!' (@0x0664): SÓLO la decoración es rúnica; el COLOR sale latino", () => {
    const r = listRowCells({ idx: 4, name: "!Yellow", qty: 3 }, inner);
    expect(r.cells[3]).toBe(0x1d);
    // set_font(0) va ANTES de la cadena-lado (@0x0677): 4 celdas de deco y ninguna más.
    expect(r.runeCols).toEqual([3, 4, 5, 6]);
    expect(s(r)).toContain("Yellow");
  });

  it("prefijo '(' (@0x068e): 'Moonstone ' latino y SÓLO el dígito en rúnicas", () => {
    const r = listRowCells({ idx: 5, name: "(3", qty: 0xff }, inner);
    expect(s(r)).toBe("Moonstone 3");
    // "Moonstone " ocupa las cols 0..9 (se imprime ANTES del conmutador) y el dígito
    // cae en la 10, que es la ÚNICA rúnica.
    expect(r.runeCols).toEqual([10]);
  });

  it("sin sigilo: ninguna celda rúnica (control negativo del alcance)", () => {
    expect(listRowCells({ idx: 6, name: "Skull Keys", qty: 5 }, inner).runeCols).toEqual([]);
  });

  it("ES: abreviaturas de columna (ZTATS_ITEM_SHORT_ES) — caben SIN recorte", () => {
    // Ruling del lead: override de display keyed por nombre EN, sólo bajo lang≠'en'.
    // Cada abreviatura debe caber en las 13 celdas del pergamino (con la cuenta delante
    // los contables, o el ícono `+ ` las pociones). EN queda byte-exacto (identidad).
    // EN: identidad (nombres binarios verbatim).
    expect(s(listRowCells({ idx: 0, name: "Skull Keys", qty: 5 }, inner))).toBe(" 5-Skull Keys");
    setLang("es", { persist: false });
    try {
      // Contables (≤10 con "NN-"): la abreviatura ES no rebasa la columna.
      expect(s(listRowCells({ idx: 0, name: "Skull Keys", qty: 5 }, inner))).toBe(" 5-Ll. Calav.");
      expect(s(listRowCells({ idx: 1, name: "Magic Crpt", qty: 1 }, inner))).toBe(" 1-Alfombra");
      expect(s(listRowCells({ idx: 2, name: "Wooden Box", qty: 1 }, inner))).toBe(" 1-Caja Sánd.");
      // Ocultos (≤13, sin número).
      expect(s(listRowCells({ idx: 3, name: "Pocket Watch", qty: 0xff }, inner))).toBe("Reloj");
      expect(s(listRowCells({ idx: 4, name: "Shard/Falsehd", qty: 0xff }, inner))).toBe("Esq. Falsedad");
      // Ninguna fila ES rebasa las 13 celdas (sin truncado).
      for (const [name, qty] of [
        ["Skull Keys", 5], ["Magic Crpt", 1], ["Wooden Box", 1], ["Pocket Watch", 0xff],
        ["Shard/Cowrdce", 0xff], ["!Yellow", 3], ["!Orange", 1], ["!Purple", 2],
      ] as const) {
        const r = listRowCells({ idx: 0, name, qty }, inner);
        expect(r.cells.length, `${name} cabe en inner`).toBe(inner);
      }
    } finally {
      setLang(BASE_LANG, { persist: false });
    }
  });
});

describe("renderItemListPage — visor completo (0x06e8 §3)", () => {
  const items: InventoryListItem[] = Array.from({ length: 20 }, (_, i) => ({
    idx: i,
    name: `Item${i}`,
    qty: i + 1,
  }));

  it("marco + 7 filas; el título NO va en el marco (es el banner)", () => {
    const w = renderItemListPage(LIST_RECT, items, 0);
    expect(w.cells[0]).toBe(0x10); // marco presente
    expect(row(w, 0)).not.toContain("Item"); // fila 0 = borde, sin ítems
    expect(row(w, 1)).toContain("1-Item0");
    expect(row(w, 7)).toContain("Item6");
    let all = "";
    for (let r = 0; r < w.rows; r++) all += row(w, r);
    expect(all).not.toContain("Item7"); // sólo 7 con scroll 0
  });

  it("scroll: la ventana muestra desde el offset", () => {
    const w = renderItemListPage(LIST_RECT, items, ZTATS_LIST_ROWS);
    expect(row(w, 1)).toContain("Item7");
  });

  it("lista vacía → '(None owned!)' (0x9794), no 'Nothing!'", () => {
    const w = renderItemListPage(LIST_RECT, [], 0);
    let all = "";
    for (let r = 0; r < w.rows; r++) all += row(w, r);
    expect(all).toContain("(None owned!)");
  });
});

describe("ztatsListArrowGlyph — indicador de scroll (render_item_list 0x077f-0x0819)", () => {
  const N = 20; // lista con overflow (> ZTATS_LIST_ROWS)
  it("tope (scroll 0): sólo ▼(0x19) — hay ítems abajo, ninguno arriba", () => {
    expect(ztatsListArrowGlyph(0, N)).toBe(0x19);
  });
  it("en medio: ↕(0x12) — hay ítems por ambos lados", () => {
    expect(ztatsListArrowGlyph(ZTATS_LIST_ROWS, N)).toBe(0x12);
  });
  it("fondo (scroll = total-ROWS): sólo ▲(0x18) — hay arriba, nada abajo", () => {
    expect(ztatsListArrowGlyph(N - ZTATS_LIST_ROWS, N)).toBe(0x18);
  });
  it("sin overflow (cabe entera): null — no hay banda", () => {
    expect(ztatsListArrowGlyph(0, ZTATS_LIST_ROWS)).toBeNull(); // exactamente 7
    expect(ztatsListArrowGlyph(0, 3)).toBeNull(); //               3 ítems
    expect(ztatsListArrowGlyph(0, 0)).toBeNull(); //               vacía
  });
});

describe("listForPage / ztatsBannerText — títulos EXACTOS del binario", () => {
  const inv = {
    reagents: [{ idx: 0, name: "Ash", qty: 1 }],
    items: [{ idx: 0, name: "Bolt", qty: 1 }],
    quest: [{ idx: 0, name: "Sextant", qty: 1 }],
    equipment: [{ idx: 0, name: "Dagger", qty: 2 }],
    provisions: { food: 1, gold: 1, keys: 0, gems: 0, torches: 0, grapple: false },
    members: [],
  } as unknown as InventoryView;

  it("0xd→Reagents, 0xe→Spells, 0xf→Items, 0x10→Armaments", () => {
    expect(listForPage(inv, 0xd).title).toBe("Reagents");
    expect(listForPage(inv, 0xe).title).toBe("Spells");
    expect(listForPage(inv, 0xf).title).toBe("Items");
    expect(listForPage(inv, 0x10).title).toBe("Armaments");
  });

  it("banner: select→'Select:', provisiones→'Equipment', stats→nombre, lista→título", () => {
    const snap = { inventory: inv, ztats: [MEMBER] } as unknown as ViewSnapshot;
    expect(ztatsBannerText(select(0), snap)).toBe("Select:");
    expect(ztatsBannerText(page(ZTATS_PAGE_PROVISIONS), snap)).toBe("Equipment");
    expect(ztatsBannerText(page(0), snap)).toBe("Iolo"); // stats del miembro 0
    expect(ztatsBannerText(page(0xd), snap)).toBe("Reagents");
  });
});
