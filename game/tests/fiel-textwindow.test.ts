/**
 * VENTANA DE TEXTO fiel — calco del printer del kernel (E1-S8a).
 * Fija la semántica derivada en `re/notes/ui-text-layer.md` §3–§5: descriptor en
 * celdas, CR/LF, wrap por `rightCol`, scroll por `botRow`, word-wrap de
 * `print_string`. Sin canvas: es el modelo puro.
 */
import { describe, expect, it } from "vitest";
import { BLANK, TextWindow } from "../src/skin/fiel/textwindow.js";

/** Vuelca una fila de la rejilla como string ASCII (glifos imprimibles). */
function rowText(w: TextWindow, row: number): string {
  let s = "";
  for (let c = 0; c < w.cols; c++) s += String.fromCharCode(w.cells[row * w.cols + c]!);
  return s;
}

function put(w: TextWindow, s: string): void {
  for (const ch of s) w.putChar(ch.charCodeAt(0));
}

describe("TextWindow — descriptor (§3)", () => {
  it("deriva cols/rows/wrapWidth de los bordes inclusivos", () => {
    const w = new TextWindow({ leftCol: 0, topRow: 0, rightCol: 3, botRow: 1 });
    expect(w.cols).toBe(4); // right-left+1
    expect(w.rows).toBe(2);
    expect(w.wrapWidth).toBe(3); // right-left (ancho de word-wrap del kernel)
    expect(w.cells.length).toBe(8);
    expect([...w.cells].every((c) => c === BLANK)).toBe(true);
  });

  it("rechaza dimensiones no positivas", () => {
    expect(() => new TextWindow({ leftCol: 5, topRow: 0, rightCol: 4, botRow: 0 })).toThrow();
  });
});

describe("TextWindow.putChar — cursor + wrap (§4)", () => {
  it("escribe el glifo en el cursor y auto-avanza", () => {
    const w = new TextWindow({ leftCol: 0, topRow: 0, rightCol: 7, botRow: 3 });
    put(w, "AB");
    expect(rowText(w, 0).startsWith("AB")).toBe(true);
    expect(w.curCol).toBe(2);
    expect(w.curRow).toBe(0);
  });

  it("WRAP al rebasar rightCol → siguiente fila, columna 0", () => {
    const w = new TextWindow({ leftCol: 0, topRow: 0, rightCol: 3, botRow: 3 }); // 4 cols
    put(w, "ABCD"); // llena la fila
    expect(rowText(w, 0)).toBe("ABCD");
    expect(w.curRow).toBe(1);
    expect(w.curCol).toBe(0);
    put(w, "E");
    expect(rowText(w, 1).startsWith("E")).toBe(true);
  });

  it("LF (0x0a) = CRLF: baja fila y vuelve a columna 0", () => {
    const w = new TextWindow({ leftCol: 0, topRow: 0, rightCol: 7, botRow: 3 });
    put(w, "AB");
    w.putChar(0x0a);
    expect(w.curRow).toBe(1);
    expect(w.curCol).toBe(0);
  });

  it("CR (0x0d) = sólo retorno de carro: columna 0, misma fila", () => {
    const w = new TextWindow({ leftCol: 0, topRow: 0, rightCol: 7, botRow: 3 });
    put(w, "AB");
    w.putChar(0x0d);
    expect(w.curRow).toBe(0);
    expect(w.curCol).toBe(0);
  });

  it("códigos 0x80–0xFA se enmascaran a code & 0x7F", () => {
    const w = new TextWindow({ leftCol: 0, topRow: 0, rightCol: 7, botRow: 3 });
    w.putChar(0x41 | 0x80); // → 'A'
    expect(w.cells[0]).toBe(0x41);
  });

  it("no auto-avanza si autoAdvance=false (flag 0x538e)", () => {
    const w = new TextWindow({ leftCol: 0, topRow: 0, rightCol: 7, botRow: 3 });
    w.autoAdvance = false;
    put(w, "AB"); // ambos caen en la misma celda
    expect(w.curCol).toBe(0);
    expect(w.cells[0]).toBe(0x42); // la 'B' pisó la 'A'
  });
});

describe("TextWindow — control de atributo (§4)", () => {
  it("0xFF resetea: limpia rejilla y cursor a (0,0)", () => {
    const w = new TextWindow({ leftCol: 0, topRow: 0, rightCol: 3, botRow: 1 });
    put(w, "ABC");
    w.putChar(0xff);
    expect(w.curCol).toBe(0);
    expect(w.curRow).toBe(0);
    expect([...w.cells].every((c) => c === BLANK)).toBe(true);
  });

  it("0xFC/0xFB alternan el flag de centrado; 0xFE reverse; 0xFD invert", () => {
    const w = new TextWindow({ leftCol: 0, topRow: 0, rightCol: 3, botRow: 1 });
    w.putChar(0xfc);
    expect(w.centered).toBe(true);
    w.putChar(0xfb);
    expect(w.centered).toBe(false);
    w.putChar(0xfe);
    expect(w.reverse).toBe(true);
    w.putChar(0xfd);
    expect(w.invert).toBe(true);
  });
});

describe("TextWindow — scroll (§4, botRow)", () => {
  it("al rebasar botRow desplaza la rejilla una línea arriba", () => {
    const w = new TextWindow({ leftCol: 0, topRow: 0, rightCol: 3, botRow: 1 }); // 2 filas
    put(w, "AB");
    w.putChar(0x0a); // → fila 1
    put(w, "CD");
    w.putChar(0x0a); // rebasa → scroll
    expect(rowText(w, 0)).toBe("CD" + BLANK_STR + BLANK_STR); // "AB" salió arriba
    expect(w.curRow).toBe(1); // cursor se queda en la última fila
    put(w, "EF");
    expect(rowText(w, 1).startsWith("EF")).toBe(true);
  });
});

const BLANK_STR = String.fromCharCode(BLANK);

describe("TextWindow.printString — word-wrap (§5)", () => {
  it("ajusta por palabra: no parte una palabra que cabe en una línea", () => {
    const w = new TextWindow({ leftCol: 0, topRow: 0, rightCol: 2, botRow: 3 }); // wrapWidth 2
    w.printString("AB CD");
    expect(rowText(w, 0).startsWith("AB")).toBe(true);
    expect(rowText(w, 1).startsWith("CD")).toBe(true); // "CD" saltó de línea entero
  });

  it("una palabra que cabe justo en el ancho no salta", () => {
    const w = new TextWindow({ leftCol: 0, topRow: 0, rightCol: 3, botRow: 3 }); // wrapWidth 3
    w.printString("ABC");
    expect(rowText(w, 0).startsWith("ABC")).toBe(true);
    expect(w.curRow).toBe(0);
  });

  it("corta duro una palabra más larga que la ventana (desde el inicio de línea)", () => {
    const w = new TextWindow({ leftCol: 0, topRow: 0, rightCol: 2, botRow: 3 }); // 3 cols
    w.printString("ABCDE"); // no hay espacio y curCol==0 → sin LF previo, wrap duro
    expect(rowText(w, 0)).toBe("ABC");
    expect(rowText(w, 1).startsWith("DE")).toBe(true);
  });

  it("una palabra imposible con curCol!=0 arranca en línea nueva (0x1981, review)", () => {
    // Caso del reviewer: cols=4/wrapWidth=3. "AB CDEFGH" → "AB " en fila 0, la
    // palabra imposible "CDEFGH" salta a fila 1 (LF gateado por curCol!=0) y allí
    // hace su wrap duro. NO debe quedar "AB C…" (corte in-situ sin salto).
    const w = new TextWindow({ leftCol: 0, topRow: 0, rightCol: 3, botRow: 5 });
    w.printString("AB CDEFGH");
    expect(rowText(w, 0).startsWith("AB")).toBe(true);
    expect(rowText(w, 0)[3]).toBe(" "); // la 'C' NO se coló en la fila 0
    expect(rowText(w, 1)).toBe("CDEF");
    expect(rowText(w, 2).startsWith("GH")).toBe(true);
  });

  it("respeta saltos de línea explícitos del texto", () => {
    const w = new TextWindow({ leftCol: 0, topRow: 0, rightCol: 7, botRow: 3 });
    w.printString("Hi\nYo");
    expect(rowText(w, 0).startsWith("Hi")).toBe(true);
    expect(rowText(w, 1).startsWith("Yo")).toBe(true);
  });
});
