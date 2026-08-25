/**
 * Vista de gema de OVERWORLD/PUEBLO fiel (task #76): rejilla 32×32 EGA por
 * CATEGORÍA de tile (gem_view LOOKOBJ 0x10fc). Verifica la tabla de categorías
 * (byte[tile+0x1d1a]), la GEOMETRÍA literal (celdas 4×4 px ancladas en (32,32) con
 * marco negro, NO escaladas a llenar) y los patrones EGA por categoría — incluida
 * la línea continua del camino (aristas 0x3812).
 */
import { describe, expect, it } from "vitest";
import { paintGemMapOverworld, GEM_CATEGORY } from "../src/skin/fiel/gemmap-overworld.js";
import type { GemView } from "../src/skin/api.js";

interface Rect {
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Spy de contexto que registra (color, rect) por cada fillRect. */
function spy() {
  const fills: Rect[] = [];
  let fillStyle = "";
  const ctx = {
    set fillStyle(v: string) {
      fillStyle = v;
    },
    get fillStyle() {
      return fillStyle;
    },
    strokeStyle: "",
    lineWidth: 1,
    fillRect(x: number, y: number, w: number, h: number) {
      fills.push({ color: fillStyle, x, y, w, h });
    },
    strokeRect() {},
  } as unknown as CanvasRenderingContext2D;
  return { ctx, fills };
}

function gem(tiles: number[][], marker = { x: 0, y: 0 }): GemView {
  return { environment: "overworld", width: 32, height: 32, tiles, marker };
}

/** Rejilla 32×32 con un tile uniforme, salvo overrides [x,y,tile]. */
function grid(base: number, over: Array<[number, number, number]> = []): number[][] {
  const g = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => base));
  for (const [x, y, t] of over) g[y]![x] = t;
  return g;
}

/** ¿Hay un fillRect de `color` que cubra el píxel (x,y)? */
function pixel(fills: Rect[], x: number, y: number, color: string): boolean {
  return fills.some(
    (f) => f.color === color && x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h,
  );
}

describe("GEM_CATEGORY (tabla byte[tile+0x1d1a] extraída de DATA.OVL)", () => {
  it("tiene 256 entradas, todas 0..16", () => {
    expect(GEM_CATEGORY).toHaveLength(256);
    expect(Math.max(...GEM_CATEGORY)).toBe(16);
    expect(Math.min(...GEM_CATEGORY)).toBe(0);
  });

  it("mapea familias de tile conocidas a su categoría (spot-check anti-transcripción)", () => {
    expect(GEM_CATEGORY[0x00]).toBe(0); // void/explosión
    expect(GEM_CATEGORY[0x01]).toBe(12); // agua profunda
    expect(GEM_CATEGORY[0x05]).toBe(1); // hierba
    expect(GEM_CATEGORY[0x07]).toBe(3); // desierto
    expect(GEM_CATEGORY[0x20]).toBe(16); // camino
    expect(GEM_CATEGORY[0x60]).toBe(10); // ríos/costa
    expect(GEM_CATEGORY[0xd8]).toBe(15); // fuentes
  });
});

describe("paintGemMapOverworld — geometría literal (celdas 4×4 @ (32,32), marco negro)", () => {
  it("ancla la rejilla 128×128 en (32,32); nada se pinta en el marco negro", () => {
    const { ctx, fills } = spy();
    paintGemMapOverworld(ctx, gem(grid(0x07)), 0); // desierto (cat 3, relleno rojo)
    // Fondo negro = todo el viewport (8,8)-(184,184).
    expect(fills[0]).toMatchObject({ color: "#000000", x: 8, y: 8, w: 176, h: 176 });
    // La celda (0,0) del mapa está en pantalla (32,32), 4×4 px (no 5.5, no en (8,8)).
    const red = fills.filter((f) => f.color === "#aa0000");
    expect(red.every((f) => f.x >= 32 && f.y >= 32 && f.x < 160 && f.y < 160)).toBe(true);
    expect(red.some((f) => f.x === 32 && f.y === 32 && f.w === 4 && f.h === 4)).toBe(true);
    // Celda (31,31) → esquina inferior derecha en (156,156): 32+31*4.
    expect(red.some((f) => f.x === 156 && f.y === 156)).toBe(true);
    // Marco negro: ningún rojo por debajo de 32 ni desde 160.
    expect(red.some((f) => f.x < 32 || f.x >= 160)).toBe(false);
  });
});

describe("paintGemMapOverworld — patrones por categoría", () => {
  it("desierto (cat 3) rellena la celda de rojo; agua profunda (cat 12) un punto azul claro", () => {
    const { ctx, fills } = spy();
    paintGemMapOverworld(ctx, gem(grid(0x07, [[5, 5, 0x01]])), 0);
    const colors = new Set(fills.map((f) => f.color));
    expect(colors.has("#aa0000")).toBe(true); // rojo (cat 3, 13ae=4)
    // Agua en (5,5): base (32+20,32+20)=(52,52), punto central en (+2,+2)=(54,54).
    expect(pixel(fills, 54, 54, "#5555ff")).toBe(true);
  });

  it("CAMINO vertical (0x20) traza una línea roja CONTINUA por aristas (0x3812), no bloques", () => {
    const { ctx, fills } = spy();
    // Dos tiles de camino vertical apilados: (10,10) y (10,11).
    paintGemMapOverworld(ctx, gem(grid(0x05, [[10, 10, 0x20], [10, 11, 0x20]])), 0);
    // Celda (10,10) base = (32+40, 32+40) = (72,72). El camino vertical pinta rojo en
    // las columnas centrales 1-2 (x=73,74) TODA la altura y=72..75 (centro + aristas
    // arriba y=72 y abajo y=75), y la celda de abajo continúa en y=76.. → sin hueco.
    for (let y = 72; y <= 79; y++) {
      expect(pixel(fills, 73, y, "#aa0000")).toBe(true); // columna central roja continua
    }
  });

  it("CAMINO horizontal (0x21) traza la línea roja en las filas centrales", () => {
    const { ctx, fills } = spy();
    paintGemMapOverworld(ctx, gem(grid(0x05, [[10, 10, 0x21], [11, 10, 0x21]])), 0);
    // Filas centrales y=73,74 rojas de x=72..79 (dos celdas contiguas, sin hueco).
    for (let x = 72; x <= 79; x++) {
      expect(pixel(fills, x, 73, "#aa0000")).toBe(true);
    }
  });

  it("categoría 0 (void) no dibuja celdas (solo fondo negro); phase impar oculta el marcador", () => {
    const { ctx, fills } = spy();
    paintGemMapOverworld(ctx, gem(grid(0x00)), 4); // phase&4 → marcador oculto
    expect(fills.filter((f) => f.color !== "#000000")).toHaveLength(0);
  });
});

describe("drawCoast (cat 10, ríos 0x6x) — POLARIDAD del nibble (LOOKOBJ 0xd1b, DATA.OVL 0x3832)", () => {
  // Derivación #101 (heredados-b, cuerpo entero + control de tabla): el binario hace
  // `test`+`jne` sobre dx=8>>q — el bit PUESTO va al AGUA (azul) y el bit CLARO pinta
  // la RIBERA (verde). Control anti-cancelación hecho: los 16 bytes de DATA.OVL 0x3832
  // y COAST_NIBBLE son byte a byte idénticos, así que la tabla NO está complementada.
  it("tile 0x6E (nibble 0x08): cuadrante 0 AGUA, cuadrantes 1-3 RIBERA — bit puesto = azul", () => {
    const { ctx, fills } = spy();
    paintGemMapOverworld(ctx, gem(grid(0x05, [[5, 5, 0x6e]])));
    // celda (5,5) → base (52,52); QUAD_DOTS: q0 (53,52) · q1 (55,53) · q2 (53,54) · q3 (55,55)
    expect(pixel(fills, 53, 52, "#5555ff")).toBe(true); // q0: bit 8 PUESTO → agua
    expect(pixel(fills, 55, 53, "#55ff55")).toBe(true); // q1: claro → ribera
    expect(pixel(fills, 53, 54, "#55ff55")).toBe(true); // q2: claro → ribera
    expect(pixel(fills, 55, 55, "#55ff55")).toBe(true); // q3: claro → ribera
  });

  it("tile 0x67 (nibble 0x07): cuadrante 0 RIBERA, cuadrantes 1-3 AGUA — el mixto inverso", () => {
    // Nota del censo: ningún tile de CAT 10 tiene nibble 0x00 (0x6A/0x6B lo tienen pero
    // son cat 3) — por eso los «14 tiles de río» de la derivación, no 16.
    const { ctx, fills } = spy();
    paintGemMapOverworld(ctx, gem(grid(0x05, [[5, 5, 0x67]])));
    expect(pixel(fills, 53, 52, "#55ff55")).toBe(true); // q0: bit 8 claro → ribera
    expect(pixel(fills, 55, 53, "#5555ff")).toBe(true); // q1: bit 4 puesto → agua
    expect(pixel(fills, 53, 54, "#5555ff")).toBe(true); // q2: bit 2 puesto → agua
    expect(pixel(fills, 55, 55, "#5555ff")).toBe(true); // q3: bit 1 puesto → agua
  });
});

describe("paintGemMapOverworld — marcador parpadeante (XOR de la celda, 0x1196/0x68f6)", () => {
  it("fase encendida: INVIERTE la celda del jugador (void→blanco); fase apagada: terreno", () => {
    // Jugador sobre una celda void (0x00) en un mar de desierto: XOR de negro con 15 =
    // blanco puro → recuadro blanco 4×4 en (32+12,32+16)=(44,48).
    const marker = { x: 3, y: 4 };
    const on = spy();
    paintGemMapOverworld(on.ctx, gem(grid(0x07, [[3, 4, 0x00]]), marker), 0);
    expect(pixel(on.fills, 44, 48, "#ffffff")).toBe(true);
    expect(pixel(on.fills, 47, 51, "#ffffff")).toBe(true); // relleno 4×4 completo
    // Fase apagada (phase&4): sin marcador; la celda void queda negra (sin blanco alguno,
    // el desierto es rojo).
    const off = spy();
    paintGemMapOverworld(off.ctx, gem(grid(0x07, [[3, 4, 0x00]]), marker), 4);
    expect(off.fills.some((f) => f.color === "#ffffff")).toBe(false);
  });

  it("invierte el PATRÓN del tile bajo el jugador (hierba: puntos verdes → magenta 15^10=5)", () => {
    // Jugador sobre hierba (0x05, cat 1 = 4 puntos verde claro). Encendido → fondo blanco
    // + puntos invertidos a magenta (#aa00aa). Celda en (44,48); un punto en (+1,0)=(45,48).
    const on = spy();
    paintGemMapOverworld(on.ctx, gem(grid(0x07, [[3, 4, 0x05]]), { x: 3, y: 4 }), 0);
    expect(pixel(on.fills, 45, 48, "#aa00aa")).toBe(true); // punto verde (10) → magenta (5)
    expect(pixel(on.fills, 44, 48, "#ffffff")).toBe(true); // fondo de la celda, blanco
  });
});
