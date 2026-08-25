/**
 * ATLAS DE EXTENSIÓN LATINO-1 de la fuente de juego (`font-ibm-ext.png`) — #339.
 *
 * ── EL DEFECTO QUE ESTE FICHERO EXISTE PARA CERRAR ───────────────────────────────────
 * El atlas de acentos NO es un asset «HD» ni cosmético: es el que hace legible el
 * ESPAÑOL. Sin él, `glyphCell` de la piel fiel (`game/src/skin/fiel/font.ts:74`) enmascara
 * el codepoint con `code & 0x7f` y la vocal acentuada cae en OTRA LETRA del atlas base:
 *
 *     é (0xE9) → i    ·    í (0xED) → m    ·    ó (0xF3) → s
 *     ú (0xFA) → z    ·    ñ (0xF1) → q    ·    ü (0xFC) → |
 *
 * o sea «montaña» → «montaqa» y «Español» → «Espaqol». Medido sobre el corpus vivo
 * (`game/src/i18n/es.json`): 1.563 de 7.995 cadenas — el 19,5 % — llevan al menos un
 * carácter que cambia de letra. Sólo la `á` y las mayúsculas acentuadas se salvan, porque
 * Latin-1 las alinea en los 7 bits bajos; eso hace el defecto MÁS confuso, no menos, ya
 * que media frase se lee bien.
 *
 * Hasta ahora el atlas sólo lo producía `docs/skin-remaster/shader-evolucion/font_ext.py`,
 * que corre a mano en la máquina del autor y deja el PNG en `game/assets` (gitignored).
 * Quien juega desde /byo nunca lo tuvo: su extracción no lo emitía y la petición cae al
 * soft-404 del sitio, que el `catch` de la piel traga en silencio.
 *
 * ── POR QUÉ ESTO SÍ SE PUEDE PORTAR (y las fuentes HD no) ────────────────────────────
 * Este atlas es **composición pura sobre la fuente del juego**: cada glifo es la LETRA
 * BASE de `IBM.CH` —que el pipeline ya parsea— con un signo de 8×8 encima. No hay
 * refinado (`scale2x` + cleanup morfológico + overrides a mano) como en los atlas HD, así
 * que no arrastra el método congelado del remaster ni pide ningún fichero del original
 * que la extracción no tenga ya. Es la razón por la que #339 se separó de #306.
 *
 * La letra base sale de la fuente DEL JUEGO y no de un CP437 genérico a propósito: así la
 * `á` lleva exactamente la misma `a` que el resto del texto. El CP437 de la ROM sólo se
 * usó como referencia de la FORMA del signo (`font_ext.py:10-14`).
 *
 * ── INDEXADO ─────────────────────────────────────────────────────────────────────────
 * Mitad alta de Latin-1, U+00A0..U+00FF → rejilla 16×6 (96 celdas, 128×48 px). La celda de
 * un codepoint es `((cp-0xA0) % 16, ⌊(cp-0xA0) / 16⌋)`. Lo consumen `extGlyphCell` de la
 * piel fiel y el atlas HD de extensión con el MISMO índice.
 *
 * 🔴 ESTE MÓDULO ES UNA TRANSCRIPCIÓN, NO UN DISEÑO: las tablas de signos y los bitmaps a
 * mano vienen de `font_ext.py` y deben producir el atlas BYTE A BYTE IDÉNTICO al suyo —
 * hay un `font-ibm-ext.png` en producción y en las capturas del usuario. Si tocas una
 * tabla, `extractor/tests/font-ext.test.ts` compara contra el PNG del productor python y
 * se pone rojo. No lo «mejores» sin mover también el productor.
 */
import { glyphPixel, GLYPH_W, GLYPH_H } from "./parsers/font.js";

/** Matriz 8×8 de 0/1 (fila mayor). El 1 es píxel encendido. */
export type Glyph8 = number[][];

/** Primer codepoint del bloque de extensión (mitad alta de Latin-1). */
export const EXT_FIRST_CP = 0xa0;
/** Celdas por fila del atlas de extensión. */
export const EXT_COLS = 16;
/** Filas del atlas de extensión (96 celdas = 16×6). */
export const EXT_ROWS = 6;

function blank(): Glyph8 {
  return Array.from({ length: GLYPH_H }, () => new Array<number>(GLYPH_W).fill(0));
}

/** Pinta filas descritas como texto («#» = encendido) sobre `dst` a partir de `y0`. */
function pasteRows(dst: Glyph8, rows: readonly string[], y0 = 0): void {
  rows.forEach((row, i) => {
    for (let x = 0; x < row.length && x < GLYPH_W; x++) {
      if (row[x] === "#") dst[y0 + i]![x] = 1;
    }
  });
}

/** Baja la letra `n` píxeles, dejando libres las filas de arriba. */
function shiftDown(m: Glyph8, n: number): Glyph8 {
  const out = blank();
  for (let y = 0; y < GLYPH_H; y++) {
    const src = y - n;
    if (src >= 0 && src < GLYPH_H) out[y] = [...m[src]!];
  }
  return out;
}

function rot180(m: Glyph8): Glyph8 {
  return Array.from({ length: GLYPH_H }, (_, y) =>
    Array.from({ length: GLYPH_W }, (_, x) => m[7 - y]![7 - x]!),
  );
}

function flipVertical(m: Glyph8): Glyph8 {
  return Array.from({ length: GLYPH_H }, (_, y) => [...m[7 - y]!]);
}

/**
 * Signos para MINÚSCULA: ocupan las dos filas de arriba (la minúscula ya deja hueco).
 * Transcritos de `font_ext.py:72-79`.
 */
const ACCENT_LOWER: Record<string, readonly string[]> = {
  acute: ["....##..", "...##..."],
  grave: ["..##....", "...##..."],
  circ: ["...##...", ".##..##."],
  tilde: [".###.##.", "##.###.."],
  dia: ["..#..#..", "........"],
  ring: ["...##...", "...##..."],
};

/**
 * Signos para MAYÚSCULA: UNA fila, porque la letra se baja 1 px para hacerle sitio.
 * Transcritos de `font_ext.py:80-87`.
 */
const ACCENT_UPPER: Record<string, string> = {
  acute: ".....##.",
  grave: ".##.....",
  circ: "..#..#..",
  tilde: ".##.##..",
  dia: "..#..#..",
  ring: "...##...",
};

/** La cedilla cuelga BAJO la letra (filas 6-7), no encima. */
const CEDILLA: readonly string[] = ["...##...", "....#..."];

/** codepoint → [letra base del juego, tipo de signo]. `font_ext.py:91-114`. */
const COMPOSE: Record<number, readonly [string, string]> = {
  // minúsculas acentuadas
  0xe1: ["a", "acute"], 0xe9: ["e", "acute"], 0xed: ["i", "acute"],
  0xf3: ["o", "acute"], 0xfa: ["u", "acute"], 0xfd: ["y", "acute"],
  0xe0: ["a", "grave"], 0xe8: ["e", "grave"], 0xec: ["i", "grave"],
  0xf2: ["o", "grave"], 0xf9: ["u", "grave"],
  0xe2: ["a", "circ"], 0xea: ["e", "circ"], 0xee: ["i", "circ"],
  0xf4: ["o", "circ"], 0xfb: ["u", "circ"],
  0xe4: ["a", "dia"], 0xeb: ["e", "dia"], 0xef: ["i", "dia"],
  0xf6: ["o", "dia"], 0xfc: ["u", "dia"], 0xff: ["y", "dia"],
  0xe3: ["a", "tilde"], 0xf5: ["o", "tilde"], 0xf1: ["n", "tilde"],
  0xe7: ["c", "cedilla"], 0xe5: ["a", "ring"],
  // mayúsculas acentuadas
  0xc1: ["A", "acute"], 0xc9: ["E", "acute"], 0xcd: ["I", "acute"],
  0xd3: ["O", "acute"], 0xda: ["U", "acute"], 0xdd: ["Y", "acute"],
  0xc0: ["A", "grave"], 0xc8: ["E", "grave"], 0xcc: ["I", "grave"],
  0xd2: ["O", "grave"], 0xd9: ["U", "grave"],
  0xc2: ["A", "circ"], 0xca: ["E", "circ"], 0xce: ["I", "circ"],
  0xd4: ["O", "circ"], 0xdb: ["U", "circ"],
  0xc4: ["A", "dia"], 0xcb: ["E", "dia"], 0xcf: ["I", "dia"],
  0xd6: ["O", "dia"], 0xdc: ["U", "dia"],
  0xc3: ["A", "tilde"], 0xd5: ["O", "tilde"], 0xd1: ["N", "tilde"],
  0xc7: ["C", "cedilla"], 0xc5: ["A", "ring"],
};

/**
 * Glifos NO componibles con bitmap a mano (estilo de época CP437). Los que valen `null`
 * NO son un hueco: se construyen desde la fuente del juego en `compose8` (¿ ¡ « » º ª ·).
 * Transcritos de `font_ext.py:118-153`.
 */
const SPECIAL_BITMAP: Record<number, readonly string[] | null> = {
  0xa1: null, 0xbf: null, 0xab: null, 0xbb: null, 0xba: null, 0xaa: null, 0xb7: null,
  0xa2: ["...#....", ".#####..", "#.#..#..", "#.#.....", "#.#..#..", ".#####..", "...#....", "........"],
  0xa3: ["..###...", ".#...#..", ".#......", "####....", ".#......", ".#......", "######..", "........"],
  0xa4: [".#...#..", "..###...", ".#...#..", ".#...#..", ".#...#..", "..###...", ".#...#..", "........"],
  0xa5: ["#...#...", ".#.#....", "..#.....", ".###....", "..#.....", ".###....", "..#.....", "........"],
  0xa6: ["...#....", "...#....", "...#....", "........", "...#....", "...#....", "...#....", "........"],
  0xa7: ["..####..", ".#......", ".###....", "#..#....", ".###....", "....#...", ".####...", "........"],
  0xa8: [".#..#...", "........", "........", "........", "........", "........", "........", "........"],
  0xa9: ["..###...", ".#...#..", "#.##..#.", "#.#...#.", "#.##..#.", ".#...#..", "..###...", "........"],
  0xac: ["........", "........", ".#####..", ".....#..", ".....#..", "........", "........", "........"],
  0xae: ["..###...", ".#...#..", "#.##..#.", "#.#.#.#.", "#.##..#.", ".#...#..", "..###...", "........"],
  0xaf: ["#####...", "........", "........", "........", "........", "........", "........", "........"],
  0xb0: [".###....", ".#.#....", ".###....", "........", "........", "........", "........", "........"],
  0xb1: ["...#....", "...#....", ".#####..", "...#....", "...#....", "........", ".#####..", "........"],
  0xb2: [".##.....", "#..#....", "..#.....", ".#......", "####....", "........", "........", "........"],
  0xb3: [".##.....", "...#....", "..#.....", "...#....", ".##.....", "........", "........", "........"],
  0xb4: ["....##..", "...##...", "........", "........", "........", "........", "........", "........"],
  0xb5: ["........", "#...#...", "#...#...", "#...#...", "#..##...", "####.#..", "#.......", "#......."],
  0xb6: [".######.", "###.#...", "###.#...", ".##.#...", "..#.#...", "..#.#...", "..#.#...", "........"],
  0xb8: ["........", "........", "........", "........", "........", "...##...", "....#...", "..##...."],
  0xb9: ["..#.....", ".##.....", "..#.....", "..#.....", ".###....", "........", "........", "........"],
  0xbc: [".#....#.", "##...#..", ".#..#...", "...#....", "..#.#.#.", ".#..###.", "#.....#.", "........"],
  0xbd: [".#....#.", "##...#..", ".#..#...", "...#....", "..#.##..", ".#....#.", "#...###.", "........"],
  0xbe: ["##....#.", ".##..#..", "##..#...", "...#....", "..#.#.#.", ".#..###.", "#.....#.", "........"],
  0xd7: ["........", ".#...#..", "..#.#...", "...#....", "..#.#...", ".#...#..", "........", "........"],
  0xf7: ["........", "...#....", "........", ".#####..", "........", "...#....", "........", "........"],
  0xc6: [".#####..", "##.#....", "##.#....", "####....", "##.#....", "##.#....", "##.###..", "........"],
  0xe6: ["........", "........", ".####.#.", "#..##.#.", ".#####..", "#..#....", ".####.#.", "........"],
  0xdf: [".###....", "#...#...", "#..#....", "#.##....", "#...#...", "#...#...", "#.##....", "........"],
  0xd0: [".####...", ".#..#...", "###.#...", ".#..#...", ".#..#...", ".####...", "........", "........"],
  0xf0: ["#.#.....", ".##.....", "#..#....", ".#..#...", "#...#...", "#...#...", ".###....", "........"],
  0xde: [".#......", ".####...", ".#..#...", ".####...", ".#......", ".#......", ".#......", "........"],
  0xfe: [".#......", ".#......", ".####...", ".#..#...", ".#..#...", ".####...", ".#......", "........"],
};

/** Ø/ø = O/o con barra diagonal por DENTRO de la letra. */
const SLASH_O: Record<number, string> = { 0xd8: "O", 0xf8: "o" };

/** Todos los codepoints que puebla el atlas, en orden. */
export const EXT_CODEPOINTS: readonly number[] = [
  ...new Set([
    ...Object.keys(COMPOSE).map(Number),
    ...Object.keys(SPECIAL_BITMAP).map(Number),
    ...Object.keys(SLASH_O).map(Number),
  ]),
].sort((a, b) => a - b);

/** Celda (col,fila) del atlas para un codepoint del bloque de extensión. */
export function extCell(cp: number): { col: number; row: number } {
  const i = cp - EXT_FIRST_CP;
  return { col: i % EXT_COLS, row: Math.floor(i / EXT_COLS) };
}

/**
 * Compositor de glifos: envuelve los 128 glifos de `IBM.CH` y produce los 8×8 del bloque
 * de extensión. Se construye una vez por extracción.
 */
export class ExtGlyphComposer {
  constructor(private readonly glyphs: readonly Uint8Array[]) {
    if (glyphs.length < 128) {
      throw new Error(`ExtGlyphComposer: se esperaban 128 glifos, llegaron ${glyphs.length}`);
    }
  }

  /** El 8×8 del glifo del JUEGO para un carácter ASCII (mismo `& 0x7F` que el kernel). */
  private base(ch: string): Glyph8 {
    const glyph = this.glyphs[ch.charCodeAt(0) & 0x7f]!;
    return Array.from({ length: GLYPH_H }, (_, y) =>
      Array.from({ length: GLYPH_W }, (_, x) => (glyphPixel(glyph, x, y) ? 1 : 0)),
    );
  }

  /** Pega un chevron (`<`/`>`) recortado a cols 2-5 en `xoff`, para « y ». */
  private pasteChevron(dst: Glyph8, ch: string, xoff: number): void {
    const src = this.base(ch);
    for (let y = 0; y < GLYPH_H; y++) {
      for (let x = 2; x < 6; x++) {
        if (!src[y]![x]) continue;
        const nx = xoff + (x - 2);
        if (nx >= 0 && nx < GLYPH_W) dst[y]![nx] = 1;
      }
    }
  }

  /** Ordinal º/ª: la letra encogida a la mitad superior + subrayado. */
  private ordinal(ch: string): Glyph8 {
    const src = this.base(ch);
    const m = blank();
    // muestrea filas 2,4,6 del glifo a las filas 0-2 (superíndice)
    for (let y = 0; y < 3; y++) {
      const sy = 2 + y * 2;
      for (let x = 1; x < 7; x++) {
        if (src[sy]![x]) m[y]![x - 1] = 1;
      }
    }
    for (let x = 1; x < 6; x++) m[4]![x] = 1; // subrayado del ordinal
    return m;
  }

  /** El 8×8 del glifo de extensión `cp` (base del juego + signo, o especial). */
  compose(cp: number): Glyph8 {
    const special = SPECIAL_BITMAP[cp];
    if (special) {
      const m = blank();
      pasteRows(m, special, 0);
      return m;
    }
    const slashed = SLASH_O[cp];
    if (slashed !== undefined) {
      const m = this.base(slashed);
      for (let i = 1; i < 7; i++) m[i]![7 - i] = 1;
      return m;
    }
    if (cp in SPECIAL_BITMAP) {
      // los que valen null: se construyen desde la fuente del juego
      if (cp === 0xbf) return rot180(this.base("?")); // ¿ = ? girado 180°
      if (cp === 0xa1) return flipVertical(this.base("!")); // ¡ = ! volteado
      if (cp === 0xab) {
        const m = blank();
        this.pasteChevron(m, "<", 0);
        this.pasteChevron(m, "<", 3);
        return m;
      }
      if (cp === 0xbb) {
        const m = blank();
        this.pasteChevron(m, ">", 1);
        this.pasteChevron(m, ">", 4);
        return m;
      }
      if (cp === 0xba) return this.ordinal("o");
      if (cp === 0xaa) return this.ordinal("a");
      if (cp === 0xb7) {
        const m = blank();
        m[3]![3] = m[3]![4] = m[4]![3] = m[4]![4] = 1;
        return m;
      }
    }
    const entry = COMPOSE[cp];
    if (!entry) throw new Error(`ExtGlyphComposer: codepoint ${cp} fuera del bloque`);
    const [baseChar, kind] = entry;
    let m = this.base(baseChar);
    if (kind === "cedilla") {
      pasteRows(m, CEDILLA, 6);
      return m;
    }
    if (baseChar === baseChar.toUpperCase()) {
      m = shiftDown(m, 1); // baja la letra 1px y deja la fila 0 libre
      pasteRows(m, [ACCENT_UPPER[kind]!], 0);
    } else {
      if (baseChar === "i") m[1] = new Array<number>(GLYPH_W).fill(0); // quita el punto de la i
      pasteRows(m, ACCENT_LOWER[kind]!, 0);
    }
    return m;
  }
}

/**
 * Compone el atlas RGBA 128×48 del bloque de extensión: blanco sobre transparente, igual
 * que `fontToAtlasRgba` de la fuente base (la piel lo tiñe).
 */
export function extAtlasRgba(glyphs: readonly Uint8Array[]): {
  rgba: Uint8Array;
  width: number;
  height: number;
} {
  const width = EXT_COLS * GLYPH_W;
  const height = EXT_ROWS * GLYPH_H;
  const rgba = new Uint8Array(width * height * 4);
  const composer = new ExtGlyphComposer(glyphs);

  for (const cp of EXT_CODEPOINTS) {
    const { col, row } = extCell(cp);
    const m = composer.compose(cp);
    for (let y = 0; y < GLYPH_H; y++) {
      for (let x = 0; x < GLYPH_W; x++) {
        if (!m[y]![x]) continue; // transparente
        const o = ((row * GLYPH_H + y) * width + (col * GLYPH_W + x)) * 4;
        rgba[o] = 0xff;
        rgba[o + 1] = 0xff;
        rgba[o + 2] = 0xff;
        rgba[o + 3] = 0xff;
      }
    }
  }
  return { rgba, width, height };
}
