/**
 * Glifos del ZODÍACO en la piel fiel (`paintZodiac`) — PÍXELES derivados del ASM.
 *
 * Fija la geometría del signo 1 (en la fecha de arranque) contra los cuerpos de
 * `draw_zodiac_star` (LOOKOBJ.OVL 0x01ac) y `draw_zodiac_lines` (0x024c). Se elige el signo 1
 * a propósito: su fila (17) y su columna (2) son DISTINTAS, así que cualquier intercambio de
 * ejes lo mueve — el signo 0 tiene fila = columna = 18 y no discriminaría.
 *
 * Lo que este test defiende es el ORDEN DE EJES, que estuvo TRANSPUESTO en el port: las dos
 * primitivas del kernel toman la X primero — `plot` = LOOKOBJ 0x69d4 → (base near-call 0xa290)
 * → ULTIMA.EXE `0x0c64`, que hace `ret 4` (PASCAL ⇒ `[bp+6]` es el primer push) y manda ese
 * primer arg a AX→`[0x52cc]`; y `[0x52cc]` es la X porque `draw_hline` 0x0c9c escribe ahí su CX
 * y el recortador de hline 0x0ccd compara AX/CX contra 0x13f=319 (mientras el de vline 0x0d2b
 * compara BX/DX contra 0xc7=199 y `draw_vline` 0x0cf2 escribe su DX en `[0x52ce]`=Y).
 */
import { describe, expect, it } from "vitest";
import {
  LINE_COLOR,
  TELESCOPE_COL,
  TELESCOPE_ROW,
  TELESCOPE_TILE,
  bgStarColor,
  paintZodiac,
} from "../src/skin/fiel/zodiac.js";
import type { FrameColors } from "../src/skin/fiel/frame.js";
import { DEFAULT_FRAME_COLORS } from "../src/skin/fiel/frame.js";
import { EGA_PALETTE } from "../src/skin/fiel/ega.js";
import { buildZodiacView } from "../src/core/world/zodiac-view.js";
import type { GameState } from "../src/core/state.js";

/** Color de estrella SENTINELA: el default (`border`) es blanco y se confundiría con el fondo. */
const COLORS: FrameColors = { background: "#000000", frame: "#0000aa", border: "#00ff00" };
const STAR = COLORS.border;
const LINE = LINE_COLOR; // g_13ae = EGA 4 (rojo), el valor que se ve en la captura del original

type Pixel = { x: number; y: number; color: string };
type Blit = { sx: number; sy: number; dx: number; dy: number; w: number; h: number };

/**
 * ctx de mentira: registra cada `fillRect` de 1×1 con su color (el fondo del viewport es 176×176)
 * y cada `drawImage` de 9 argumentos (el blit de tile del trípode).
 */
function spyCtx(): {
  ctx: CanvasRenderingContext2D;
  pixels: Pixel[];
  blits: Blit[];
  ops: string[];
} {
  const pixels: Pixel[] = [];
  const blits: Blit[] = [];
  const ops: string[] = [];
  let fillStyle = "";
  const ctx = {
    fillRect(x: number, y: number, w: number, h: number) {
      ops.push(w === 1 && h === 1 ? "px" : "bg");
      if (w === 1 && h === 1) pixels.push({ x, y, color: fillStyle });
    },
    drawImage(
      _img: unknown,
      sx: number,
      sy: number,
      sw: number,
      sh: number,
      dx: number,
      dy: number,
      _dw: number,
      _dh: number,
    ) {
      ops.push("blit");
      blits.push({ sx, sy, dx, dy, w: sw, h: sh });
    },
    set fillStyle(v: string) {
      fillStyle = v;
    },
    get fillStyle() {
      return fillStyle;
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, pixels, blits, ops };
}

/** Atlas de mentira: `paintZodiac` sólo lo pasa a `drawImage`, no lee nada de él. */
const FAKE_ATLAS = {} as unknown as CanvasImageSource;

/**
 * Pinta en la fecha de ARRANQUE (4-5-139, rotación 0) con los Shadowlords indicados. `rand`
 * devuelve siempre el mínimo ⇒ las 80 estrellas de fondo se apilan en (9,9), lejos de los signos.
 */
function paintFull(
  locs: number[],
  atlas: CanvasImageSource | null = null,
): { pixels: Pixel[]; blits: Blit[]; ops: string[] } {
  const state = {
    shadowlordLocs: locs,
    time: { year: 139, month: 4, day: 5, hour: 0, minute: 0 },
  } as unknown as GameState;
  const { ctx, pixels, blits, ops } = spyCtx();
  paintZodiac(ctx, buildZodiacView(state, (lo) => lo), COLORS, atlas);
  return { pixels, blits, ops };
}

function paint(locs: number[]): Pixel[] {
  return paintFull(locs).pixels;
}

function keys(ps: Array<{ x: number; y: number }>): string[] {
  return ps.map((p) => `${p.x},${p.y}`).sort();
}

describe("paintZodiac — glifo ESTRELLA (draw_zodiac_star 0x01ac)", () => {
  it("signo 1 (fila 17, columna 2): 3×3 en x 31..33 · y 143..145 con una antena a cada LADO", () => {
    // starX = (col+1)*8 = 24 (look_sky 0x4a9 empuja col+1 PRIMERO) ; y = row*8 = 136.
    // 0x01cd plot(starX+6, y+8) · 0x0208 bloque 3×3 (starX+7..9, y+7..9) · 0x0233 plot(starX+10, y+8).
    const expected = [
      { x: 30, y: 144 }, // antena IZQUIERDA
      { x: 31, y: 143 }, { x: 31, y: 144 }, { x: 31, y: 145 },
      { x: 32, y: 143 }, { x: 32, y: 144 }, { x: 32, y: 145 },
      { x: 33, y: 143 }, { x: 33, y: 144 }, { x: 33, y: 145 },
      { x: 34, y: 144 }, // antena DERECHA
    ];
    const star = paint([]).filter((p) => p.color === STAR);
    // Los otros 7 signos viven en otras filas; me quedo con la banda del signo 1.
    const sign1 = star.filter((p) => p.y >= 140 && p.y <= 148 && p.x <= 40);
    expect(keys(sign1)).toEqual(keys(expected));
    expect(star).toHaveLength(11 * 8); // 11 píxeles por signo, los 8 signos siempre dibujados
  });

  it("la estrella ocupa 5 columnas × 3 filas (el discriminante de la transposición)", () => {
    const sign1 = paint([])
      .filter((p) => p.color === STAR && p.y >= 140 && p.y <= 148 && p.x <= 40);
    expect([...new Set(sign1.map((p) => p.x))].sort((a, b) => a - b)).toEqual([30, 31, 32, 33, 34]);
    expect([...new Set(sign1.map((p) => p.y))].sort((a, b) => a - b)).toEqual([143, 144, 145]);
  });
});

describe("paintZodiac — glifo LÍNEA (draw_zodiac_lines 0x024c)", () => {
  /** [dx, y0, y1] tal cual los tres pushes de cada `draw_vline(x, y0, y1)` del cuerpo 0x024c. */
  const SEGMENTS: Array<[number, number, number]> = [
    [5, 10, 12], // 0x0271
    [6, 10, 12], // 0x028f
    [7, 8, 12], // 0x02ad
    [8, 8, 12], // 0x02cc
    [9, 6, 10], // 0x02eb
    [10, 6, 10], // 0x030a
    [11, 5, 8], // 0x0329
    [12, 5, 7], // 0x0348
  ];

  it("signo 1: 8 VLINES en x 21..28, con el tramo de Y subiendo hacia la derecha", () => {
    // lineX = col*8 = 16 (el `dec` de 0x4b0: a la línea le llega `col`, no `col+1`) ; y = 136.
    const expected: Array<{ x: number; y: number }> = [];
    for (const [dx, y0, y1] of SEGMENTS)
      for (let y = y0; y <= y1; y++) expected.push({ x: 16 + dx, y: 136 + y });
    const line = paint([2, 0, 0]).filter((p) => p.color === LINE); // Shadowlord en la ciudad 2 = signo 1
    expect(keys(line)).toEqual(keys(expected));
    expect(line).toHaveLength(33);
    // Cada columna es un tramo CONTIGUO de Y (eso es una vlínea, no una hlínea suelta).
    const first = line.filter((p) => p.x === 21).map((p) => p.y).sort((a, b) => a - b);
    expect(first).toEqual([146, 147, 148]);
  });

  it("la línea acaba 8 px a la IZQUIERDA de donde empieza la estrella (el `dec` de 0x4b0)", () => {
    const line = paint([2, 0, 0]).filter((p) => p.color === LINE);
    expect(Math.min(...line.map((p) => p.x))).toBe(21); // lineX+5, con lineX = 16
    expect(Math.max(...line.map((p) => p.x))).toBe(28); // lineX+12 — la estrella empieza en 30
  });

  it("sólo el signo cuya ciudad (i+1) coincide con un Shadowlord lleva línea", () => {
    expect(paint([]).filter((p) => p.color === LINE)).toHaveLength(0);
    expect(paint([2, 0, 0]).filter((p) => p.color === LINE)).toHaveLength(33);
    expect(paint([2, 3, 0]).filter((p) => p.color === LINE)).toHaveLength(66);
  });
});

describe("paintZodiac — TRÍPODE del catalejo (look_sky 0x03d8)", () => {
  it("blitea el tile 0x59 en la celda 325 del búfer = fila 10, columna 5 del viewport", () => {
    // 325 = 10·0x20 + 5 sobre el búfer 0xAB02 de stride 0x20 (el bucle de limpieza 0x03b6-0x03d3
    // escribe 11 filas de 11 bytes con `add si,0x20` hasta `cmp si,0x160`=352=11×32).
    const { blits } = paintFull([], FAKE_ATLAS);
    expect(blits).toHaveLength(1);
    // Las cuatro coordenadas van en CRUDO a propósito: calcularlas desde `TELESCOPE_TILE`/
    // `TELESCOPE_COL` haría el aserto tautológico (el mutante que cambia la constante lo
    // cambiaría a los dos lados del `expect` y seguiría verde — medido con 0x59→0x58).
    expect(blits[0]).toEqual({
      sx: 400, // tile 0x59 = 89 en atlas de 32 columnas: (89 % 32)·16 = 25·16
      sy: 32, //  floor(89 / 32)·16 = 2·16
      dx: 88, // VIEWPORT.x + col·16 = 8 + 5·16
      dy: 168, // VIEWPORT.y + fila·16 = 8 + 10·16 (la última fila cabe justa: 168+16 = 184)
      w: 16,
      h: 16,
    });
  });

  it("la aritmética de la celda 325 es fila 10 · columna 5, no columna 10 · fila 5", () => {
    // El discriminante: 325 = 10·32+5 sí, pero 5·32+10 = 170 ≠ 325 ⇒ el stride distingue los ejes.
    expect(TELESCOPE_ROW * 32 + TELESCOPE_COL).toBe(325);
    expect(TELESCOPE_COL * 32 + TELESCOPE_ROW).not.toBe(325);
    expect(TELESCOPE_TILE).toBe(0x59);
  });

  it("va DESPUÉS del fondo y ANTES de las estrellas (el orden de 0x03dd vs 0x03ea)", () => {
    const { ops } = paintFull([], FAKE_ATLAS);
    expect(ops[0]).toBe("bg"); // fillRect del viewport = las 120 celdas 0xFF (BlackSquare)
    expect(ops[1]).toBe("blit"); // el trípode, dentro del mismo pase de viewport_compose
    expect(ops[2]).toBe("px"); // la primera de las 80 estrellas de fondo, ya encima
  });

  it("sin atlas no hay blit y el resto de la vista se pinta igual", () => {
    const conAtlas = paintFull([2, 0, 0], FAKE_ATLAS);
    const sinAtlas = paintFull([2, 0, 0], null);
    expect(sinAtlas.blits).toHaveLength(0);
    expect(sinAtlas.pixels).toEqual(conAtlas.pixels);
  });
});

describe("paintZodiac — COLORES del cielo (los tres de look_sky)", () => {
  it("las 80 estrellas de fondo son EGA 9 (azul claro) = g_13b2(EGA 1) + 8", () => {
    expect(bgStarColor(DEFAULT_FRAME_COLORS)).toBe(EGA_PALETTE[9]);
    expect(bgStarColor(COLORS)).toBe(EGA_PALETTE[9]); // COLORS.frame también es el azul EGA 1
    // Y el `+8` se APLICA de verdad sobre el índice, no está cableado al 9: con otro frame
    // el color se mueve con él (es lo que hace `add ax, 8` sobre la variable viva).
    expect(bgStarColor({ ...COLORS, frame: EGA_PALETTE[2] })).toBe(EGA_PALETTE[10]);
    expect(bgStarColor({ ...COLORS, frame: EGA_PALETTE[15] })).toBe(EGA_PALETTE[7]); // (15+8)%16
  });

  it("un frame FUERA de la paleta EGA cae al 9 del régimen de arranque, no a un índice −1", () => {
    expect(bgStarColor({ ...COLORS, frame: "#123456" })).toBe(EGA_PALETTE[9]);
  });

  it("la línea del zodíaco es EGA 4 (rojo) y la estrella sigue siendo `border` (g_13b0)", () => {
    expect(LINE_COLOR).toBe("#aa0000");
    const pixels = paint([2, 0, 0]);
    expect(pixels.filter((p) => p.color === "#aa0000")).toHaveLength(33);
    expect(pixels.filter((p) => p.color === COLORS.border)).toHaveLength(11 * 8);
  });

  it("ninguno de los tres colores es ya el blanco/gris que el port cableaba antes de #297", () => {
    const usados = new Set(paint([2, 0, 0]).map((p) => p.color));
    expect(usados.has("#8a8a8a")).toBe(false); // la línea gris de Clase-C
    expect(usados.has("#ffffff")).toBe(false); // las estrellas de fondo blancas
    expect(usados).toEqual(new Set([EGA_PALETTE[9], COLORS.border, EGA_PALETTE[4]]));
  });
});
