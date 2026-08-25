/**
 * Fuente IBM.CH en runtime + consola fiel (E1-S8a). Sin navegador: la fuente se
 * construye con un atlas ficticio y el blit se verifica contra un contexto
 * espía (registra cada `drawImage` con sus coords). Los píxeles del atlas ya se
 * validan en el extractor (`extractor/tests/font.test.ts`); aquí se fija el
 * MAPEO código→celda y la posición de blit.
 */
import { describe, expect, it } from "vitest";
import { FaithfulFont, GLYPH_PX, glyphCell, type GlyphSource } from "../src/skin/fiel/font.js";
import {
  FaithfulConsole,
  layoutConsole,
  withTurnSeparators,
  withTurnSeparatorsRich,
  type ConsoleRow,
} from "../src/skin/fiel/console.js";

interface DrawCall {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/** Contexto 2D espía: sólo registra los drawImage de 9 argumentos. */
function spyCtx(): { ctx: CanvasRenderingContext2D; calls: DrawCall[] } {
  const calls: DrawCall[] = [];
  const ctx = {
    drawImage(
      _img: unknown,
      sx: number,
      sy: number,
      sw: number,
      sh: number,
      dx: number,
      dy: number,
      dw: number,
      dh: number,
    ) {
      calls.push({ sx, sy, sw, sh, dx, dy, dw, dh });
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const ATLAS = {} as GlyphSource;

describe("glyphCell — mapeo código→celda del atlas (16 cols, 8px)", () => {
  it("'A' (0x41) cae en la celda (col 1, fila 4) → (8,32)", () => {
    expect(glyphCell(0x41)).toEqual({ sx: 8, sy: 32 });
  });
  it("espacio (0x20) → (0,16); glifo 0 → (0,0)", () => {
    expect(glyphCell(0x20)).toEqual({ sx: 0, sy: 16 });
    expect(glyphCell(0x00)).toEqual({ sx: 0, sy: 0 });
  });
  it("enmascara el alto bit (0xC1 → 0x41)", () => {
    expect(glyphCell(0xc1)).toEqual(glyphCell(0x41));
  });
});

describe("FaithfulFont.drawGlyph", () => {
  it("blitea la celda del atlas al destino, escalado", () => {
    const font = new FaithfulFont(ATLAS);
    const { ctx, calls } = spyCtx();
    font.drawGlyph(ctx, 0x41, 100, 50, 2);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      sx: 8,
      sy: 32,
      sw: GLYPH_PX,
      sh: GLYPH_PX,
      dx: 100,
      dy: 50,
      dw: 16, // 8 × scale 2
      dh: 16,
    });
  });
});

/**
 * Texto de la fila `r` contando DESDE ABAJO (0 = la última fila de la ventana), sin
 * relleno a la derecha. `layoutConsole` ancla el contenido al fondo (`anchorBottom`,
 * ficha #113): lo que es estable entre casos es la distancia al BORDE INFERIOR, no al
 * superior — indexar desde arriba obliga a recalcular a mano en cada aserto cuántas
 * filas quedaron en blanco encima, que es justo la cuenta que se equivoca.
 */
function rowUp(win: { cells: Uint8Array; cols: number; rows: number }, r: number): string {
  const base = (win.rows - 1 - r) * win.cols;
  return String.fromCharCode(...win.cells.slice(base, base + win.cols)).replace(/ +$/, "");
}

describe("layoutConsole — printer derivado sobre las líneas del core (§4–§5)", () => {
  it("cada entrada baja UNA fila (un LF); entradas contiguas quedan PEGADAS (#69)", () => {
    // Cada string [D] baja una fila (LF=CRLF); el eco y su resultado del mismo
    // turno son filas contiguas ("West\n"+"Very slow!\n"): "Hi" justo encima de "Yo".
    const win = layoutConsole({ leftCol: 0, topRow: 0, rightCol: 19, botRow: 5 }, ["Hi", "Yo"]);
    expect(rowUp(win, 1)).toBe("Hi");
    expect(rowUp(win, 0)).toBe("Yo");
  });

  it("una entrada vacía es una fila EN BLANCO (el \\n\\n de un string o el separador de turno)", () => {
    // "Hi" / "" (BLANK) / "Yo" — como "Zzzzzz...\n\n" o el blanco de turno.
    const win = layoutConsole({ leftCol: 0, topRow: 0, rightCol: 19, botRow: 5 }, ["Hi", "", "Yo"]);
    expect(rowUp(win, 2)).toBe("Hi");
    expect(rowUp(win, 1)).toBe("");
    expect(rowUp(win, 0)).toBe("Yo");
  });

  it("ANCLA ABAJO (#113): con menos texto que filas el hueco queda ARRIBA, no debajo", () => {
    // El testigo instancia la diferencia DONDE EXISTE: ventana de 6 filas con SÓLO 2
    // entradas. Con el relleno de arriba abajo el texto salía en r0/r1 y el cursor en
    // la fila 1; anclado, sale en las DOS ÚLTIMAS y el cursor acaba en `rows-1` (donde
    // la piel pinta la ola). Es el frame 0 del vídeo split-screen: el original enseña
    // «►Pass» + prompt abajo del todo con la mitad superior en blanco.
    const win = layoutConsole({ leftCol: 0, topRow: 0, rightCol: 19, botRow: 5 }, ["Hi", "Yo"]);
    expect(win.rows).toBe(6);
    expect(win.curRow).toBe(win.rows - 1); // el cursor vive en la última fila
    for (let r = 0; r < win.rows - 2; r++) {
      expect(win.cells.slice(r * win.cols, (r + 1) * win.cols).every((c) => c === 0x20)).toBe(true);
    }
  });

  it("ANCLA ABAJO: con la ventana YA LLENA no mueve nada (no-op, mismo pintado que antes)", () => {
    // Control con dientes del aserto anterior: si `anchorBottom` desplazara SIEMPRE,
    // este caso también cambiaría y el fix sería una regresión encubierta para el caso
    // corriente (log largo). 6 entradas en 6 filas: el cursor ya está en la última.
    const rect = { leftCol: 0, topRow: 0, rightCol: 19, botRow: 5 };
    const win = layoutConsole(rect, ["a", "b", "c", "d", "e", "f"]);
    expect(rowUp(win, 5)).toBe("a");
    expect(rowUp(win, 0)).toBe("f");
    expect(win.curRow).toBe(win.rows - 1);
  });

  it("scroll: con más líneas que filas sólo quedan las últimas entradas", () => {
    const rect = { leftCol: 0, topRow: 0, rightCol: 9, botRow: 1 }; // 2 filas
    const win = layoutConsole(rect, ["one", "two", "three"]);
    // "one" salió por arriba; quedan "two" (fila 0) y "three" (fila 1).
    expect(String.fromCharCode(...win.cells.slice(0, win.cols).filter((c) => c !== 0x20))).toBe(
      "two",
    );
    expect(String.fromCharCode(...win.cells.slice(win.cols, win.cols + 5))).toBe("three");
  });

  it("word-wrap por la CAPACIDAD del kernel (wrapWidth+1 = cols; careo-combate T6)", () => {
    // rightCol 4 → cols=5 físicas, wrapWidth=4 (right-left, print_string 0x1897)
    // pero la CAPACIDAD por fila es wrapWidth+1 = 5: el bucle de copia admite
    // remaining+1 chars (0x18dc `cmp si,di; jg`, cota INCLUSIVE). "ab cd ef":
    // "ab cd" (5 chars EXACTOS) llena la fila 0; el espacio que sigue a la fila
    // llena se CONSUME (0x19bc) y "ef" arranca en la fila 1 col 0 — sin fila en
    // blanco ni espacio huérfano. (El reparto previo "ab"/"cd"/"ef" era el
    // off-by-one falsificado por los frames del original: "*** CONFLICT ***".)
    const rect = { leftCol: 0, topRow: 0, rightCol: 4, botRow: 5 };
    const win = layoutConsole(rect, ["ab cd ef"]);
    expect(rowUp(win, 1)).toBe("ab cd");
    expect(rowUp(win, 0)).toBe("ef");
  });

  it("línea de EXACTAMENTE cols chars: llena la fila sin partirse y SIN fila en blanco tras ella (T6)", () => {
    // El caso testigo: "*** CONFLICT ***" (16 chars) en la consola de 16 col cabe
    // en UNA fila; la entrada siguiente cae en la fila inmediata (el \n final de la
    // cadena llena se consume — kernel 0x19b1-0x19c7 + wrap eager de putchar 0x173d).
    const rect = { leftCol: 0, topRow: 0, rightCol: 15, botRow: 5 };
    const win = layoutConsole(rect, ["*** CONFLICT ***", "next"]);
    expect(rowUp(win, 1)).toBe("*** CONFLICT ***");
    expect(rowUp(win, 0)).toBe("next");
  });
});

describe("layoutConsole — plano RÚNICO por línea (profecía del Codex, set_font(1))", () => {
  it("las celdas de una línea rúnica se marcan en cellRune; las normales no", () => {
    // 2 líneas: "AB" normal (fila 0), "CD" rúnica (fila 1). Sólo la fila 1 va a cellRune.
    const rect = { leftCol: 0, topRow: 0, rightCol: 9, botRow: 3 };
    const win = layoutConsole(rect, ["AB", "CD"], [false, true]);
    // El plano rúnico VIAJA con la rejilla al anclar abajo (#113): "AB" en la penúltima
    // fila, "CD" en la última. Si `anchorBottom` desplazara `cells` y no `cellRune`, la
    // marca se quedaría atrás y la profecía se pintaría con la fuente equivocada.
    const pen = (win.rows - 2) * win.cols;
    const ult = (win.rows - 1) * win.cols;
    expect(win.cellRune[pen + 0]).toBe(0); // 'A'
    expect(win.cellRune[pen + 1]).toBe(0); // 'B'
    expect(win.cellRune[ult + 0]).toBe(1); // 'C' rúnica
    expect(win.cellRune[ult + 1]).toBe(1); // 'D' rúnica
  });

  it("sin runeFlags el plano rúnico queda a cero (pintado idéntico al previo)", () => {
    const rect = { leftCol: 0, topRow: 0, rightCol: 9, botRow: 3 };
    const win = layoutConsole(rect, ["Hi", "Yo"]);
    expect(win.cellRune.every((c) => c === 0)).toBe(true);
  });

  it("el plano rúnico viaja con el scroll (copyWithin sincronizado con cells)", () => {
    // 2 filas: "one"(normal) sale por arriba; "two"(runa) baja a fila 0 y sigue rúnica.
    const rect = { leftCol: 0, topRow: 0, rightCol: 9, botRow: 1 };
    const win = layoutConsole(rect, ["one", "two", "three"], [false, true, false]);
    // "two" quedó en fila 0 tras el scroll y conserva su marca rúnica.
    expect(win.cellRune[0]).toBe(1);
    expect(win.cellRune[win.cols]).toBe(0); // "three" normal en fila 1
  });
});

describe("withTurnSeparators — blanco de turno (LF del getkey, MAINOUT 0x5cd, #69)", () => {
  const gs = (text: string): ConsoleRow => ({ text, groupStart: true });
  const msg = (text: string): ConsoleRow => ({ text, groupStart: false });

  it("eco + resultado PEGADOS; blanco ANTES del siguiente eco", () => {
    // Turno: ►West / Very slow!  ·  Turno: ►West / Very slow!
    expect(
      withTurnSeparators([gs("►West"), msg("Very slow!"), gs("►West"), msg("Very slow!")]),
    ).toEqual(["►West", "Very slow!", "", "►West", "Very slow!"]);
  });

  it("no añade blanco al TOPE del log", () => {
    expect(withTurnSeparators([gs("►West")])).toEqual(["►West"]);
  });

  it("ecos consecutivos (movimiento sin resultado) llevan blanco entre sí", () => {
    expect(withTurnSeparators([gs("►North"), gs("►North")])).toEqual(["►North", "", "►North"]);
  });

  it("no duplica el blanco si el string previo ya abrió fila vacía (\\n\\n)", () => {
    // "Zzzzzz...\n\n" → ["Zzzzzz...","",""]; el eco siguiente NO añade otro blanco.
    expect(withTurnSeparators([msg("Zzzzzz..."), msg(""), msg(""), gs("►Pass")])).toEqual([
      "Zzzzzz...",
      "",
      "",
      "►Pass",
    ]);
  });

  it("la variante Rich conserva el flag rúnico por fila (separador de turno = prosa)", () => {
    const rune = (text: string): ConsoleRow => ({ text, groupStart: true, rune: true });
    // ►Look (eco) / BEYOND… (profecía rúnica): el blanco de turno inyectado NO es rúnico.
    expect(withTurnSeparatorsRich([gs("►Look"), rune("BEYOND@SHAMES")])).toEqual([
      { text: "►Look", rune: false },
      { text: "", rune: false }, // separador de turno: prosa
      { text: "BEYOND@SHAMES", rune: true },
    ]);
  });
});

describe("FaithfulConsole.render — blit posicional", () => {
  it("blitea sólo celdas no vacías en la posición del descriptor", () => {
    const font = new FaithfulFont(ATLAS);
    const console = new FaithfulConsole(font, {
      rect: { leftCol: 2, topRow: 1, rightCol: 11, botRow: 3 },
      scale: 1,
    });
    const { ctx, calls } = spyCtx();
    console.render(ctx, ["AB"]);
    // Dos glifos ('A','B'). La columna sale del descriptor (leftCol·8 = 16) y la FILA
    // del ancla de abajo (#113): la ventana es 1..3 (tres filas) y una sola línea cae
    // en la ÚLTIMA, o sea y = 3·8 = 24 — no en topRow·8 = 8.
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ dx: 16, dy: 24, sx: 8, sy: 32 }); // 'A'
    expect(calls[1]).toMatchObject({ dx: 24, dy: 24 }); // 'B' una celda a la derecha
  });

  it("no blitea nada para una consola vacía", () => {
    const font = new FaithfulFont(ATLAS);
    const console = new FaithfulConsole(font, {
      rect: { leftCol: 0, topRow: 0, rightCol: 9, botRow: 2 },
    });
    const { ctx, calls } = spyCtx();
    console.render(ctx, []);
    expect(calls).toHaveLength(0);
  });
});
