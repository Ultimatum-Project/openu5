/**
 * Atlas de extensión Latino-1 (#339) — el que hace legible el ESPAÑOL.
 *
 * 🔴 EL ASERTO QUE IMPORTA NO ES «el atlas se genera»: es que el glifo de `é` SEA
 * DISTINTO del de `i`. Sin el atlas, la piel fiel enmascara con `code & 0x7f` y `é`
 * (0xE9) cae en 0x69 = `i`; un test que sólo comprobara dimensiones pasaría con el
 * defecto intacto. Los casos van sobre los SEIS pares que de verdad se confunden en
 * español, medidos sobre el corpus vivo (19,5 % de las cadenas de `es.json`).
 *
 * El careo contra `font-ibm-ext.png` de `docs/skin-remaster/shader-evolucion/font_ext.py`
 * es la garantía de que el port TS no inventa: mismo atlas byte a byte. Depende de
 * `game/assets`, que es gitignored y symlinkeado, así que se SALTA con motivo visible
 * cuando no está (clase #307: su rojo no sería propiedad del commit).
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { parseFont, GLYPH_W, GLYPH_H } from "../src/parsers/font.js";
import {
  EXT_CODEPOINTS,
  EXT_COLS,
  EXT_ROWS,
  ExtGlyphComposer,
  extAtlasRgba,
  extCell,
} from "../src/font-ext.js";
import { U5_DIR } from "./helpers.js";

const glyphs = () => parseFont(new Uint8Array(readFileSync(`${U5_DIR}/IBM.CH`)));

/** Atlas de referencia del productor python (gitignored: puede no estar). */
const REF_PNG = new URL("../../game/assets/font-ibm-ext.png", import.meta.url).pathname;

/** Los pares que el `& 0x7f` confunde EN ESPAÑOL: [acentuada, letra a la que caería]. */
const PARES_ES: readonly [number, string, string][] = [
  [0xe9, "é", "i"],
  [0xed, "í", "m"],
  [0xf3, "ó", "s"],
  [0xfa, "ú", "z"],
  [0xf1, "ñ", "q"],
  [0xfc, "ü", "|"],
];

/** El 8×8 del glifo ASCII base, para carear contra el compuesto. */
function base8(gs: readonly Uint8Array[], ch: string): number[][] {
  const g = gs[ch.charCodeAt(0) & 0x7f]!;
  return Array.from({ length: GLYPH_H }, (_, y) =>
    Array.from({ length: GLYPH_W }, (_, x) => ((g[y]! & (0x80 >> x)) !== 0 ? 1 : 0)),
  );
}

describe("font-ext — el atlas que arregla el español (#339)", () => {
  it("🔴 cada acentuada del español DIFIERE del glifo al que caería con & 0x7f", () => {
    const gs = glyphs();
    const composer = new ExtGlyphComposer(gs);
    for (const [cp, acentuada, cae] of PARES_ES) {
      const compuesto = composer.compose(cp);
      const equivocado = base8(gs, cae);
      expect(
        JSON.stringify(compuesto),
        `${acentuada} (U+${cp.toString(16).toUpperCase()}) sale idéntica a '${cae}': el atlas NO arregla el defecto`,
      ).not.toBe(JSON.stringify(equivocado));
    }
  });

  it("la acentuada CONSERVA la letra base del juego (no es un glifo inventado)", () => {
    const gs = glyphs();
    const composer = new ExtGlyphComposer(gs);
    // «é» debe llevar la MISMA «e» del juego debajo del signo: las filas 2..7 de la
    // minúscula no las toca el acento (que vive en las filas 0-1).
    const e = base8(gs, "e");
    const eAcute = composer.compose(0xe9);
    for (let y = 2; y < GLYPH_H; y++) {
      expect(eAcute[y], `fila ${y} de «é» no coincide con la «e» del juego`).toEqual(e[y]);
    }
  });

  it("🔴 …y LLEVA EL SIGNO ENCIMA: no basta con no ser la letra equivocada", () => {
    // Este aserto nació de un MUTANTE que sobrevivió: si `compose` devuelve la letra
    // BASE sin pastear el acento, los siete asertos de arriba pasan (una «e» pelada no
    // es una «i», y sus filas 2-7 son las de la «e»). El defecto se vería en pantalla
    // como texto sin tildes — mejor que «montaqa», pero infiel y con «ñ» = «n». Lo
    // único que lo caza es exigir píxeles EN LA BANDA DEL SIGNO. Familia #335.
    const gs = glyphs();
    const composer = new ExtGlyphComposer(gs);
    for (const [cp, ch] of PARES_ES.map((p) => [p[0], p[1]] as const)) {
      const compuesto = composer.compose(cp);
      const bandaDelSigno = compuesto[0]!.concat(compuesto[1]!);
      expect(
        bandaDelSigno.some((p) => p === 1),
        `«${ch}» sale SIN signo: las filas 0-1 están vacías (¿se perdió el pasteRows?)`,
      ).toBe(true);
    }
    // y el compuesto difiere de su PROPIA letra base (el acento añade píxeles)
    const e = base8(gs, "e");
    expect(JSON.stringify(composer.compose(0xe9))).not.toBe(JSON.stringify(e));
  });

  it("la MAYÚSCULA acentuada baja la letra 1px y el signo ocupa la fila 0", () => {
    const gs = glyphs();
    const composer = new ExtGlyphComposer(gs);
    const a = base8(gs, "A");
    const aAcute = composer.compose(0xc1);
    for (let y = 1; y < GLYPH_H; y++) {
      expect(aAcute[y], `fila ${y} de «Á» no es la «A» bajada 1px`).toEqual(a[y - 1]);
    }
    expect(aAcute[0]!.some((p) => p === 1), "la fila 0 de «Á» no lleva signo").toBe(true);
  });

  it("«¿» y «¡» se derivan girando los del juego, no de un bitmap inventado", () => {
    const gs = glyphs();
    const composer = new ExtGlyphComposer(gs);
    const query = base8(gs, "?");
    const inverted = composer.compose(0xbf);
    for (let y = 0; y < GLYPH_H; y++) {
      for (let x = 0; x < GLYPH_W; x++) {
        expect(inverted[y]![x]).toBe(query[7 - y]![7 - x]); // 180°
      }
    }
    const bang = base8(gs, "!");
    const invBang = composer.compose(0xa1);
    for (let y = 0; y < GLYPH_H; y++) expect(invBang[y]).toEqual(bang[7 - y]); // vertical
  });

  it("el atlas mide 128×48 (rejilla 16×6) y puebla 94 codepoints", () => {
    const { rgba, width, height } = extAtlasRgba(glyphs());
    expect(width).toBe(EXT_COLS * GLYPH_W);
    expect(height).toBe(EXT_ROWS * GLYPH_H);
    expect(rgba.length).toBe(width * height * 4);
    expect(EXT_CODEPOINTS.length).toBe(94);
    // el bloque cubre U+00A0..U+00FF y NADA fuera
    for (const cp of EXT_CODEPOINTS) {
      expect(cp).toBeGreaterThanOrEqual(0xa0);
      expect(cp).toBeLessThanOrEqual(0xff);
    }
  });

  it("la celda se calcula como ((cp-0xA0)%16, ⌊(cp-0xA0)/16⌋) — el índice que usa la piel", () => {
    expect(extCell(0xa0)).toEqual({ col: 0, row: 0 });
    expect(extCell(0xe9)).toEqual({ col: 9, row: 4 }); // é
    expect(extCell(0xf1)).toEqual({ col: 1, row: 5 }); // ñ
    expect(extCell(0xff)).toEqual({ col: 15, row: 5 });
  });

  it("los codepoints poblados tienen píxeles y los NO poblados quedan transparentes", () => {
    const { rgba, width } = extAtlasRgba(glyphs());
    const encendidos = (cp: number): number => {
      const { col, row } = extCell(cp);
      let n = 0;
      for (let y = 0; y < GLYPH_H; y++) {
        for (let x = 0; x < GLYPH_W; x++) {
          const o = ((row * GLYPH_H + y) * width + (col * GLYPH_W + x)) * 4;
          if (rgba[o + 3]! > 0) n++;
        }
      }
      return n;
    };
    for (const [cp, ch] of PARES_ES.map((p) => [p[0], p[1]] as const)) {
      expect(encendidos(cp), `«${ch}» sale vacía en el atlas`).toBeGreaterThan(0);
    }
    // 0xA0 es NBSP y 0xAD es soft-hyphen: NO se pueblan (no son glifos imprimibles)
    expect(EXT_CODEPOINTS).not.toContain(0xa0);
    expect(EXT_CODEPOINTS).not.toContain(0xad);
    expect(encendidos(0xa0), "el NBSP no debe pintar nada").toBe(0);
  });
});

describe("font-ext — careo contra el productor histórico (font_ext.py)", () => {
  const hayRef = existsSync(REF_PNG);
  it.skipIf(!hayRef)(
    "el atlas del pipeline es IDÉNTICO al que genera font_ext.py (0 píxeles distintos)",
    () => {
      const mio = extAtlasRgba(glyphs());
      const ref = PNG.sync.read(readFileSync(REF_PNG));
      expect(ref.width).toBe(mio.width);
      expect(ref.height).toBe(mio.height);
      let distintos = 0;
      const celdas: number[] = [];
      for (let y = 0; y < ref.height; y++) {
        for (let x = 0; x < ref.width; x++) {
          const o = (y * ref.width + x) * 4;
          const a = mio.rgba[o + 3]! > 127 ? 1 : 0;
          const b = ref.data[o + 3]! > 127 ? 1 : 0;
          if (a !== b) {
            distintos++;
            const cp = 0xa0 + Math.floor(y / GLYPH_H) * EXT_COLS + Math.floor(x / GLYPH_W);
            if (!celdas.includes(cp)) celdas.push(cp);
          }
        }
      }
      expect(
        distintos,
        `difieren ${distintos} px en ${celdas.length} celda(s): ` +
          celdas.map((c) => `U+${c.toString(16).toUpperCase()}`).join(", "),
      ).toBe(0);
    },
  );
  if (!hayRef) {
    it("careo OMITIDO: game/assets/font-ibm-ext.png no está (gitignored, symlink ausente)", () => {
      expect(hayRef).toBe(false); // motivo visible en el nombre, no un skip mudo
    });
  }
});
