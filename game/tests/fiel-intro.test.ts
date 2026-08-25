/**
 * CINEMÁTICAS FIELES (E1-S13) — renderizadores puros + reductor del menú de
 * portada. Sin navegador: se opera sobre el `CharGrid` (rejilla de glifos) y se
 * afirma sobre su contenido de texto, y se prueba la navegación JCTUAR.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_INTRO_COLORS,
  GRID_COLS,
  GRID_ROWS,
  GYPSY_SCENE,
  INTRO_PANEL,
  INTRO_PANEL_COLOR,
  MENU_COMMANDS,
  menuDispatch,
  menuKeyReducer,
  paintIntroGrid,
  paintIntroPanelBorder,
  renderQuestion,
  renderStoryPage,
  renderTitleCard,
  renderTitleMenu,
  type CharGrid,
} from "../src/skin/fiel/intro.js";
import type { FaithfulFont } from "../src/skin/fiel/font.js";

const MENU = [
  "Journey Onward",
  "Create New Character",
  "Transfer from Ultima IV",
  "Ultima V Introduction",
  "Acknowledgements",
  "Return to the View",
];

/** Reconstruye una fila de la rejilla como string (para asertar el texto). */
function rowText(grid: CharGrid, row: number): string {
  let s = "";
  for (let c = 0; c < grid.cols; c++) s += String.fromCharCode(grid.cells[row * grid.cols + c]!);
  return s.replace(/\s+$/g, "");
}
function gridText(grid: CharGrid): string {
  const rows: string[] = [];
  for (let r = 0; r < grid.rows; r++) rows.push(rowText(grid, r));
  return rows.join("\n");
}

describe("renderTitleMenu", () => {
  const grid = renderTitleMenu({
    title: "ULTIMA V",
    subtitle: "Warriors of Destiny",
    options: MENU,
    selected: 0,
    selectPrompt: "Select: ",
    copyright: "Copyright 1988 Lord British",
  });

  it("es una rejilla de pantalla completa (40×25)", () => {
    expect(grid.cols).toBe(GRID_COLS);
    expect(grid.rows).toBe(GRID_ROWS);
    expect(GRID_COLS).toBe(40);
    expect(GRID_ROWS).toBe(25);
  });

  it("muestra el logo, subtítulo, las 6 opciones y el copyright EXACTOS", () => {
    const text = gridText(grid);
    expect(text).toContain("ULTIMA V");
    expect(text).toContain("Warriors of Destiny");
    for (const opt of MENU) expect(text).toContain(opt);
    // "Select:" NO va en la rejilla: es una BANDA de borde (paintTitleBand fila 15).
    expect(text).toContain("Copyright 1988 Lord British");
  });

  it("resalta la seleccionada con highlightRow y SIN bullet/flecha (witness f094–f098)", () => {
    const g2 = renderTitleMenu({
      title: "ULTIMA V",
      subtitle: "Warriors of Destiny",
      options: MENU,
      selected: 3,
      selectPrompt: "Select: ",
      copyright: "Copyright 1988 Lord British",
    });
    expect(g2.highlightRow).toBeGreaterThanOrEqual(0);
    expect(rowText(g2, g2.highlightRow)).toContain("Ultima V Introduction");
    // (c) SIN bullet en las OPCIONES: ninguna fila de opción arranca con el chevron
    // 0x10 (►) del modelo viejo; su primera celda no-blanca es la letra de la
    // etiqueta. (El 0x10/0x11 sólo decora el prompt "►Select:◄", no las opciones.)
    for (const label of MENU) {
      for (let rr = 0; rr < g2.rows; rr++) {
        if (rowText(g2, rr).trimStart().startsWith(label)) {
          const fc = rowText(g2, rr).search(/\S/);
          expect(g2.cells[rr * g2.cols + fc]).toBe(label.charCodeAt(0));
        }
      }
    }
    const r = g2.highlightRow;
    const firstCol = rowText(g2, r).search(/\S/); // primera celda no-blanca
    expect(g2.cells[r * g2.cols + firstCol]).toBe("U".charCodeAt(0));
  });

  it('"Select:" NO va en la rejilla (es una BANDA de borde, no texto del interior)', () => {
    // El controlador lo dibuja en la fila 15 SOBRE el borde superior (set_cursor(15,15)
    // 0x0d4d) cortándolo con el remate en cuña del wrapper — lo pinta FaithfulIntro.
    // paintTitleBand, no renderTitleMenu. Así que la rejilla NO debe contener "Select:"
    // ni flotarlo en el interior negro sobre la 1ª opción.
    const g = renderTitleMenu({
      title: "ULTIMA V",
      subtitle: "Warriors of Destiny",
      options: MENU,
      selected: 0,
      selectPrompt: "Select: ",
      copyright: "Copyright 1988 Lord British",
    });
    expect(gridText(g)).not.toContain("Select:");
    // La 1ª opción sigue siendo la primera fila de texto del bloque de menú.
    const rowOf = (needle: string): number => {
      for (let r = 0; r < g.rows; r++) if (rowText(g, r).includes(needle)) return r;
      return -1;
    };
    expect(rowOf("Journey Onward")).toBeGreaterThanOrEqual(0);
  });

  it("notice 'No active game…' (J sin partida, INTRO 0x0ec9): sustituye las opciones", () => {
    const g = renderTitleMenu({
      title: "ULTIMA V",
      subtitle: "Warriors of Destiny",
      options: MENU,
      selected: 0,
      selectPrompt: "Select: ",
      copyright: "Copyright 1988 Lord British",
      notice: "No active game. Please create a character or transfer one from Ultima IV. ",
    });
    const text = gridText(g);
    expect(text).toContain("No active game.");
    expect(text).toContain("Ultima IV.");
    expect(text).not.toContain("Journey Onward"); // el aviso ocupa el panel de opciones
    expect(g.highlightRow).toBe(-1); // sin selección resaltada mientras dura el aviso
    expect(text).toContain("Copyright 1988 Lord British"); // el pie persiste
  });

  it("(b) cada opción va CENTRADA horizontalmente, no alineada a la izquierda", () => {
    // Una opción CORTA y una LARGA deben tener márgenes izq/der ~iguales cada una
    // (centrado individual), y arrancar en columnas DISTINTAS (no un bloque común).
    const g = renderTitleMenu({
      title: "ULTIMA V",
      subtitle: "Warriors of Destiny",
      options: MENU,
      selected: 0,
      selectPrompt: "Select: ",
      copyright: "Copyright 1988 Lord British",
    });
    const startCol = (label: string): number => {
      for (let r = 0; r < g.rows; r++) {
        if (rowText(g, r).trimStart().startsWith(label)) return rowText(g, r).search(/\S/);
      }
      return -1;
    };
    const cShort = startCol("Acknowledgements"); // 16 chars (par)
    const cLong = startCol("Transfer from Ultima IV"); // 23 chars (impar)
    // Columna EXACTA de print_menu_line (INTRO.OVL 0x0676): la etiqueta arranca en
    // (41-len)>>1 — centrado del bloque " etiqueta " con REDONDEO HACIA ARRIBA. En
    // longitudes PARES coincide con el floor; en IMPARES desplaza 1 col a la derecha
    // (Math.floor((40-23)/2)=8 vs el original 9), que es el "es curioso" del usuario.
    expect(cShort).toBe((GRID_COLS + 1 - "Acknowledgements".length) >> 1); // 12
    expect(cLong).toBe((GRID_COLS + 1 - "Transfer from Ultima IV".length) >> 1); // 9
    expect(cLong).toBe(Math.floor((GRID_COLS - "Transfer from Ultima IV".length) / 2) + 1); // +1 vs floor
    expect(cShort).not.toBe(cLong); // centrado individual, no bloque común
  });

  it("(a) la selección es VÍDEO INVERSO: fondo blanco, texto negro (no azul EGA)", () => {
    expect(DEFAULT_INTRO_COLORS.highlight).toBe("#ffffff");
    expect(DEFAULT_INTRO_COLORS.highlightText).toBe("#000000");
    expect(DEFAULT_INTRO_COLORS.highlight).not.toBe("#0000aa");
  });

  it("(a+) paintIntroGrid pinta el realce BLANCO = texto + 1 espacio a cada lado (len+2), no toda la fila", () => {
    const g = renderTitleMenu({
      title: "ULTIMA V",
      subtitle: "Warriors of Destiny",
      options: MENU,
      selected: 3, // "Ultima V Introduction" (21 chars)
      selectPrompt: "Select: ",
      copyright: "Copyright 1988 Lord British",
    });
    const fills: { style: string; x: number; y: number; w: number; h: number }[] = [];
    let style = "";
    const ctx = {
      set fillStyle(v: string) {
        style = v;
      },
      get fillStyle() {
        return style;
      },
      fillRect(x: number, y: number, w: number, h: number) {
        fills.push({ style, x, y, w, h });
      },
    } as unknown as CanvasRenderingContext2D;
    const font = { drawGlyph() {} } as unknown as FaithfulFont;
    paintIntroGrid(ctx, font, g, DEFAULT_INTRO_COLORS);
    const hl = fills.find((f) => f.style === "#ffffff");
    expect(hl).toBeDefined();
    // print_menu_line dibuja " etiqueta " en vídeo inverso: la barra cubre len+2 celdas
    // (1 espacio guía + 1 final), sobresaliendo 1 celda a cada lado del texto.
    expect(hl!.w).toBe(("Ultima V Introduction".length + 2) * 8);
    expect(hl!.w).toBeLessThan(320); // NO toda la fila (320 px)
    expect(hl!.y).toBe(g.highlightRow * 8);
  });
});

describe("panel de portada (caja azul, item E, witness f061+/f062)", () => {
  it("INTRO_PANEL es un rect válido dentro de la pantalla 320×200, en la mitad inferior", () => {
    expect(INTRO_PANEL.x0).toBeGreaterThanOrEqual(0);
    expect(INTRO_PANEL.x1).toBeLessThan(320);
    expect(INTRO_PANEL.y1).toBeLessThan(200);
    expect(INTRO_PANEL.x1).toBeGreaterThan(INTRO_PANEL.x0);
    expect(INTRO_PANEL.y1).toBeGreaterThan(INTRO_PANEL.y0);
    expect(INTRO_PANEL.y0).toBeGreaterThan(100); // panel inferior (bajo el subtítulo)
  });

  it("paintIntroPanelBorder monta la caja con TILES de esquina REDONDEADA 0x7b..0x7f + rect blanco", () => {
    // draw_menu_border (INTRO.OVL 0x04E0) monta la caja a RAS de pantalla (cols 0..39,
    // filas 15..24) con los tiles de caja 0x7b..0x7f (esquinas REDONDEADAS — escalera EGA
    // 5,3,2,1 px medida en ATTRACT_FULL_ORIGINAL 4×) + rect blanco interior en (7,127)-(312,192).
    const glyphs: { code: number; x: number; y: number; color: string }[] = [];
    const fills: { style: string; x: number; y: number; w: number; h: number }[] = [];
    let style = "";
    const ctx = {
      set fillStyle(v: string) {
        style = v;
      },
      get fillStyle() {
        return style;
      },
      fillRect(x: number, y: number, w: number, h: number) {
        fills.push({ style, x, y, w, h });
      },
    } as unknown as CanvasRenderingContext2D;
    const font = {
      drawGlyph(_c: CanvasRenderingContext2D, code: number, x: number, y: number, _s: number, color: string) {
        glyphs.push({ code, x, y, color });
      },
    } as unknown as FaithfulFont;
    paintIntroPanelBorder(ctx, font);
    expect(INTRO_PANEL.x0).toBe(0); // a ras del borde de pantalla (no insertada)
    // 4 esquinas biseladas en (0,15)/(39,15)/(0,24)/(39,24), en color de marco.
    const at = (code: number, cx: number, cy: number): boolean =>
      glyphs.some((g) => g.code === code && g.x === cx * 8 && g.y === cy * 8 && g.color === INTRO_PANEL_COLOR);
    expect(at(0x7b, 0, 15)).toBe(true); // TL redondeada
    expect(at(0x7c, 39, 15)).toBe(true); // TR
    expect(at(0x7d, 0, 24)).toBe(true); // BL
    expect(at(0x7e, 39, 24)).toBe(true); // BR
    expect(glyphs.filter((g) => g.code === 0x7f).length).toBeGreaterThanOrEqual(38 * 2 + 8 * 2); // aristas
    expect(glyphs.every((g) => g.color === INTRO_PANEL_COLOR)).toBe(true);
    // rectángulo BLANCO interior: 4 líneas de 1 px en (7,127)-(312,192).
    const white = fills.filter((f) => f.style === "#ffffff");
    expect(white).toHaveLength(4);
    expect(white.some((f) => f.x === 7 && f.y === 127 && f.h === 1)).toBe(true); // superior
    expect(white.some((f) => f.x === 7 && f.y === 192 && f.h === 1)).toBe(true); // inferior
    expect(white.some((f) => f.x === 7 && f.w === 1)).toBe(true); // izquierda
    expect(white.some((f) => f.x === 312 && f.w === 1)).toBe(true); // derecha
  });
});

describe("GYPSY_SCENE (escena de la gitana, item F, witness orig_F_*)", () => {
  it("dos braseros (create:1, 120 px) caben en pantalla, izq y der, sin solaparse", () => {
    const w = 120; // create:1 width
    expect(GYPSY_SCENE.brazierLeftX).toBeGreaterThanOrEqual(0);
    expect(GYPSY_SCENE.brazierRightX + w).toBeLessThanOrEqual(320);
    expect(GYPSY_SCENE.brazierLeftX + w).toBeLessThanOrEqual(GYPSY_SCENE.brazierRightX);
  });

  it("el cuenco del brasero (y≈135-153) queda ARRIBA del dilema (al pie)", () => {
    // create:1 mide 148 alto; con top en brazierY el cuenco cae a brazierY+~148.
    const bowlBottom = GYPSY_SCENE.brazierY + 148;
    expect(GYPSY_SCENE.questionTop).toBeGreaterThanOrEqual(bowlBottom - 4);
    expect(GYPSY_SCENE.questionTop).toBeLessThan(200); // al pie, dentro de pantalla
  });

  it("tableau de la gitana (create:0) abajo-izquierda cabe en pantalla", () => {
    // create:0 = 168×96 (gitana + mesa + incienso), escena de narración (ORIG_04).
    expect(GYPSY_SCENE.portraitX + 168).toBeLessThanOrEqual(320);
    expect(GYPSY_SCENE.portraitY + 96).toBeLessThanOrEqual(200);
  });

  it("Codex (create:10) abajo-DERECHA cabe pegado al borde (escena final, ORIG_12)", () => {
    // create:10 = 152×100 (ankh + libro). codexX=168 → 168+152=320 (borde derecho).
    expect(GYPSY_SCENE.codexX + 152).toBeLessThanOrEqual(320);
    expect(GYPSY_SCENE.codexY + 100).toBeLessThanOrEqual(200);
    // Deja hueco a la IZQUIERDA para la columna de texto de cierre.
    expect(GYPSY_SCENE.codexX).toBeGreaterThanOrEqual(120);
  });
});

describe("menuKeyReducer (JCTUAR)", () => {
  it("la tabla de comandos es JCTUAR (intro.md §2, DATA.OVL 0x3270)", () => {
    expect(MENU_COMMANDS).toBe("JCTUAR");
  });

  it("flechas / 2 / 4 avanzan con wrap; 1 / 3 retroceden", () => {
    let s = { selected: 0 };
    ({ state: s } = menuKeyReducer(s, "ArrowDown"));
    expect(s.selected).toBe(1);
    ({ state: s } = menuKeyReducer(s, "2"));
    expect(s.selected).toBe(2);
    ({ state: s } = menuKeyReducer(s, "ArrowUp"));
    expect(s.selected).toBe(1);
    ({ state: s } = menuKeyReducer(s, "1"));
    expect(s.selected).toBe(0);
    // wrap por abajo
    ({ state: s } = menuKeyReducer(s, "ArrowUp"));
    expect(s.selected).toBe(5);
  });

  it("Enter/Space traduce la selección a su letra de comando", () => {
    expect(menuKeyReducer({ selected: 0 }, "Enter").command).toBe("J");
    expect(menuKeyReducer({ selected: 3 }, " ").command).toBe("U");
    expect(menuKeyReducer({ selected: 1 }, "Enter").command).toBe("C");
  });

  it("las hotkeys J/C/T/U/A/R saltan directas (y fijan la selección)", () => {
    const r = menuKeyReducer({ selected: 0 }, "u");
    expect(r.command).toBe("U");
    expect(r.state.selected).toBe(3);
    expect(menuKeyReducer({ selected: 0 }, "c").command).toBe("C");
    expect(menuKeyReducer({ selected: 0 }, "r").command).toBe("R");
  });

  it("una tecla no mapeada no produce comando ni mueve la selección", () => {
    const r = menuKeyReducer({ selected: 2 }, "x");
    expect(r.command).toBeNull();
    expect(r.state.selected).toBe(2);
  });
});

describe("menuDispatch (INTRO.OVL 0x0e47; gate de personaje 0x0ec9)", () => {
  it("J SIN personaje → 'No active game…' y vuelta al menú, NO arranca (0x0ec9→0x0ed0-0x0f22)", () => {
    expect(menuDispatch("J", false)).toBe("noActiveGame");
  });

  it("J CON personaje (save = SAVED.GAM con registro 0) → arranca (jmp 0x1010)", () => {
    expect(menuDispatch("J", true)).toBe("journey");
  });

  it("R = Return to the View → relanza el demo y vuelve al menú; JAMÁS arranca (0x100a: call 0xfb1a + jmp 0xcd0)", () => {
    // Con y sin personaje: el handler de 'R' del original no mira g_party_records
    // ni sale del controller — es además el default del timeout ocioso (0x0dec).
    expect(menuDispatch("R", false)).toBe("view");
    expect(menuDispatch("R", true)).toBe("view");
  });

  it("los ÚNICOS caminos que salen del menú hacia el juego son J-con-personaje y la creación (C)", () => {
    const cmds = ["J", "C", "T", "U", "A", "R"] as const;
    for (const hasParty of [false, true]) {
      const arranca = cmds.filter((c) => menuDispatch(c, hasParty) === "journey");
      expect(arranca).toEqual(hasParty ? ["J"] : []);
    }
    // La creación no es "journey": entra por la gitana y produce el personaje.
    expect(menuDispatch("C", false)).toBe("create");
  });
});

describe("renderTitleCard (attract, sin menú)", () => {
  it("pinta logo + subtítulo + pie, SIN las opciones de menú", () => {
    const grid = renderTitleCard("ULTIMA V", "Warriors of Destiny");
    const text = gridText(grid);
    expect(text).toContain("ULTIMA V");
    expect(text).toContain("Warriors of Destiny");
    expect(text).toContain("Press a key to begin");
    // El cartón del attract NO muestra el menú (aparece al pulsar tecla, E2→E3).
    expect(text).not.toContain("Journey Onward");
    expect(grid.highlightRow).toBe(-1);
  });
});

describe("renderStoryPage", () => {
  const page =
    "From nowhere, smoky wisps of clouds begin to form in the clear, moonlit sky.";
  const grid = renderStoryPage(page, 0, 36, "The Summoning");

  it("pinta el título del capítulo y el indicador de página", () => {
    const text = gridText(grid);
    expect(text).toContain("The Summoning");
    expect(text).toContain("1 of 36");
  });

  it("el texto EXACTO aparece con word-wrap (primeras palabras visibles)", () => {
    const text = gridText(grid);
    expect(text).toContain("From nowhere");
    expect(text).toContain("moonlit sky.");
  });
});

describe("renderQuestion", () => {
  it("muestra la cabecera n/7 y el dilema", () => {
    const grid = renderQuestion(
      "Thou dost see a beggar. A) Give alms; or B) keep thy gold?",
      1,
      7,
    );
    const text = gridText(grid);
    expect(text).toContain("1 of 7");
    expect(text).toContain("beggar");
    expect(text).toContain("A)");
    expect(text).toContain("B)");
  });
});
