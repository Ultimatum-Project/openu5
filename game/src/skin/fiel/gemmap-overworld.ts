/**
 * Vista de GEMA de OVERWORLD/PUEBLO para la PIEL FIEL (task #76).
 *
 * (V)iew-a-gem fuera de mazmorra: `gem_view` (LOOKOBJ.OVL 0x10fc) pinta el CHUNK
 * cargado como una rejilla 32×32 de celdas de 4×4 px, cada celda un patrón EGA
 * elegido por la CATEGORÍA del tile (draw_gem_map_tile 0xf7e). Reemplaza el overlay
 * DOM (viewgem.ts) cuando la piel fiel/​shader está activa. Distinta de la mazmorra
 * (8×8 icónica, gemmap.ts).
 *
 * ── GEOMETRÍA LITERAL (calcada byte-a-byte; validada contra el testigo del original
 *    original/av-referencia/viewgem/ORIG_gem-marco-negro-4x4.png a escala entera) ──
 *  - Fondo NEGRO del viewport de juego: setcolor 0 (0x1122) + fill (8,8)-(0xb7,0xb7)
 *    (0x1128).
 *  - Rejilla 32×32 anclada en pantalla (32,32) con celdas de 4×4 px (0xa9c:
 *    px = col*4 + 0x20, py = row*4 + 0x20) → ocupa (32,32)-(159,159) = 128×128 px, con
 *    MARCO NEGRO de 24 px dentro del viewport 176×176. NO se escala para llenar.
 *  - Marcador de POSICIÓN = party − chunk_origin (0x1104-0x110f). PARPADEA (0x118a-0x11b6):
 *    hace XOR de un recuadro 4×4 de color 13b0=15 (blanco) sobre su celda (0x1196
 *    setcolor 13b0 + 0x68f6 raster-op XOR; 0x6992 conmuta el modo — 1 para la rejilla,
 *    0=XOR para el marcador), RE-dibujándolo cada ~4 sondeos de tecla → parpadea SIN
 *    borrado explícito (el XOR se deshace solo). Fase encendida = celda INVERTIDA
 *    (15^color: fondo negro→blanco, testigo ACTIVO); apagada = terreno (testigo INACTIVO).
 *    La CADENCIA exacta es timing de runtime (Clase-C); se aproxima con `phase`.
 *
 * ── CATEGORÍA (draw_gem_map_tile 0xf7e) ──
 *  - category = byte[tile + 0x1d1a] (0xf88): tabla GEM_CATEGORY (DATA.OVL 0x1d2a).
 *  - switch → patrón EGA por categoría. cats 0-7 por jump-table en 0x109e (resuelta
 *    con near_call_base(LOOKOBJ)=0xa290: cs:[bx+0xb32e]=offset de ventana → file 0x109e).
 *  - Paleta EGA runtime (INTRO.OVL 0x09ee, rama 52c8 ∉ {0,3} = EGA/Tandy; los estáticos
 *    de DATA.OVL son placeholders sobreescritos): 13ae=4 rojo, 13b0=15 blanco,
 *    13b2=1 azul (+8=9 azul claro), 13b4=2 verde (+8=10 verde claro), 13b8=14 amarillo.
 *  - CAMINO (cat 16, tiles 0x20-0x26, handler 0xe7a): NO es un bloque — dibuja aristas
 *    de CONEXIÓN según byte[tile+0x3812] (bits 8=arriba/4=der/2=abajo/1=izq) → línea
 *    roja fina CONTINUA. Tabla ROAD_EDGE abajo (0x20→0x0a vertical, 0x21→0x05 horizontal,
 *    0x26→0x0f cruce…).
 *  - COSTA/RÍO (cat 10, handler 0xcf4): 4 puntos; en tiles de río (0x6x) el color por
 *    cuadrante (verde ribera / azul agua) sale de byte[(tile&0xf)+0x3822]; el resto, azul.
 */
import type { GemView } from "../api.js";
import { VIEWPORT } from "./frame.js";

/**
 * Tabla de categoría: byte[tile + 0x1d1a] (LOOKOBJ 0xf88). 256 B de DATA.OVL fileoff
 * 0x1d2a (DS:0x1d1a), 17 categorías. Estática genuina (sin escrituras en el disasm).
 */
// prettier-ignore
export const GEM_CATEGORY: readonly number[] = [
   0, 12, 11, 10, 13,  1,  9,  3,  9,  2,  2,  8,  7,  6,  8,  8,
   5,  5,  5,  5,  5,  5,  5,  5,  5,  5,  5,  5,  3,  4,  3,  3,
  16, 16, 16, 16, 16, 16, 16,  7,  7,  5,  5,  5,  9,  2,  5,  5,
   1,  1,  1,  1,  1,  1,  1,  1,  4,  7,  7,  7,  7,  7,  7,  7,
   3,  5,  5,  5,  3,  6,  7,  4,  3,  3,  6,  6,  5,  7,  7,  7,
   7,  7,  7,  7,  7,  7,  7,  7,  5,  5,  4,  5,  4,  4,  5,  5,
  10, 10, 10, 10, 10, 10, 10, 10, 10, 10,  3,  3, 10, 10, 10, 10,
   3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,
   5,  5,  5,  5,  5,  5,  6,  3,  5,  5,  5,  5,  3,  5,  5,  3,
   5,  5,  5,  5,  4,  4,  4,  6,  6,  6,  4,  4,  4,  5,  5,  5,
   5,  5,  5,  5,  5,  5,  5,  5,  5,  5,  3,  4,  4,  5,  5,  5,
   5,  5,  5,  5,  5,  5,  5,  5,  6,  6,  6,  6,  3,  5,  4,  5,
   0,  0,  0,  0,  6,  6,  6,  6,  5,  5,  5,  5,  0,  0,  0,  0,
   7,  7,  7,  7, 11, 11, 11, 11, 15, 15, 15, 15, 15,  3,  5,  5,
  14, 14, 14, 14, 10, 10, 10, 10,  5,  5,  5,  5,  6,  6,  6,  6,
   6,  6,  6,  6,  6,  6,  6,  6,  6,  6,  5,  5,  5,  5,  7,  0,
];

/**
 * Aristas de conexión del CAMINO (cat 16), por tile 0x20-0x26: byte[tile+0x3812]
 * (LOOKOBJ 0xea9; DATA.OVL). Bits 8=arriba 4=derecha 2=abajo 1=izquierda.
 * (Sólo estos 7 tiles son categoría 16; el resto de la tabla 0x3812 no se consulta.)
 */
const ROAD_EDGE: Record<number, number> = {
  0x20: 0x0a, // arriba+abajo (vertical)
  0x21: 0x05, // izq+der (horizontal)
  0x22: 0x0c, // arriba+der
  0x23: 0x06, // der+abajo
  0x24: 0x03, // abajo+izq
  0x25: 0x09, // arriba+izq
  0x26: 0x0f, // cruce
};

/** Muesca negra que redondea el codo interior de los tiles de camino en esquina (0xf28+). */
const ROAD_CORNER_NOTCH: Record<number, [number, number]> = {
  0x22: [1, 2],
  0x23: [1, 1],
  0x24: [2, 1],
  0x25: [2, 2],
};

/**
 * Nibble→bits de AGUA del RÍO (cat 10, tiles 0x6x): byte[(tile&0xf)+0x3822]
 * (LOOKOBJ 0xd1b; DATA.OVL 0x3832). Bit 8/4/2/1 = cuadrante 0/1/2/3 es AGUA (azul);
 * el bit CLARO pinta la ribera (verde). Polaridad corregida en #101 (test+jne del
 * binario: bit puesto → rama del azul; control anti-cancelación: tabla byte-idéntica).
 */
// prettier-ignore
const COAST_NIBBLE: readonly number[] = [
  0x05, 0x06, 0x04, 0x01, 0x03, 0x06, 0x05, 0x07,
  0x07, 0x0e, 0x00, 0x00, 0x01, 0x02, 0x08, 0x04,
];

// Paleta EGA por defecto: fuente única compartida (ega.ts, auditoría D2).
import { EGA_PALETTE as EGA } from "./ega.js";

// Colores runtime EGA de gem_view (INTRO.OVL 0x09ee, rama 52c8 ∉ {0,3}).
const RED = 4; //     g_unk_13ae
const WHITE = 15; //  g_unk_13b0 (también el marcador)
const LTBLUE = 9; //  g_unk_13b2 + 8 (agua)
const LTGREEN = 10; // g_unk_13b4 + 8 (vegetación)
const YELLOW = 14; //  g_unk_13b8 (colinas)

const GRID = 32; // chunk 32×32 (gem_view 0x1132-0x1162)
const CELL = 4; // px por celda (0xa9c: col*4)
const MARGIN = 24; // (176 − 32*4) / 2 → marco negro; ancla la rejilla en (32,32)

/** Los 4 puntos dispersos (cats 1/10): posición (sx,sy) en la celda 4×4. */
const QUAD_DOTS: [number, number][] = [
  [1, 0],
  [3, 1],
  [1, 2],
  [3, 3],
];

/**
 * Pinta la vista de gema 32×32 de overworld/pueblo en el viewport (176×176) con la
 * paleta y los patrones EGA del binario, a escala 1:1 (celda 4×4 px) con marco negro.
 * `phase` hace parpadear el marcador del jugador como el original (0x118a-0x11b6).
 */
export function paintGemMapOverworld(ctx: CanvasRenderingContext2D, gv: GemView, phase = 0): void {
  const size = VIEWPORT.tile * VIEWPORT.tiles; // 176
  ctx.fillStyle = EGA[0]!;
  ctx.fillRect(VIEWPORT.x, VIEWPORT.y, size, size);

  const ox = VIEWPORT.x + MARGIN; // 32
  const oy = VIEWPORT.y + MARGIN; // 32

  for (let row = 0; row < GRID; row++) {
    const line = gv.tiles[row];
    if (!line) continue;
    for (let col = 0; col < GRID; col++) {
      const tile = line[col];
      if (tile === undefined) continue;
      const api = cellApi(ctx, ox + col * CELL, oy + row * CELL, (c) => c);
      drawCell(tile & 0xff, api.px, api.hline, api.vline, api.fill);
    }
  }

  // Marcador de posición: XOR de la celda del jugador con 15 (0x1196/0x68f6) →
  // fase encendida = celda invertida (fondo negro→blanco + patrón 15^color); apagada =
  // terreno intacto. Parpadeo aproximado con `phase` (cadencia real Clase-C). Si `phase`
  // no avanza (dev/tests), queda encendido.
  if ((phase & 4) === 0) {
    const bx = ox + gv.marker.x * CELL;
    const by = oy + gv.marker.y * CELL;
    ctx.fillStyle = EGA[WHITE]!; // XOR de fondo negro con 15 = blanco (base de la celda)
    ctx.fillRect(bx, by, CELL, CELL);
    const inv = cellApi(ctx, bx, by, (c) => 15 ^ c); // patrón del tile, invertido
    const mtile = (gv.tiles[gv.marker.y]?.[gv.marker.x] ?? 0) & 0xff;
    drawCell(mtile, inv.px, inv.hline, inv.vline, inv.fill);
  }
}

/** API de dibujo de una celda 4×4 en (bx,by), con `xform` aplicado al índice de color. */
function cellApi(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  xform: (c: number) => number,
): { px: Plot; hline: Line; vline: Line; fill: Fill } {
  return {
    px: (sx, sy, c) => {
      ctx.fillStyle = EGA[xform(c)]!;
      ctx.fillRect(bx + sx, by + sy, 1, 1);
    },
    hline: (y, x0, x1, c) => {
      ctx.fillStyle = EGA[xform(c)]!;
      ctx.fillRect(bx + x0, by + y, x1 - x0 + 1, 1);
    },
    vline: (x, y0, y1, c) => {
      ctx.fillStyle = EGA[xform(c)]!;
      ctx.fillRect(bx + x, by + y0, 1, y1 - y0 + 1);
    },
    fill: (c) => {
      ctx.fillStyle = EGA[xform(c)]!;
      ctx.fillRect(bx, by, CELL, CELL);
    },
  };
}

type Plot = (sx: number, sy: number, color: number) => void;
type Line = (a: number, b: number, c: number, color: number) => void;
type Fill = (color: number) => void;

/** Dibuja el patrón 4×4 de un tile según su categoría (draw_gem_map_tile 0xf7e). */
function drawCell(tile: number, px: Plot, hline: Line, vline: Line, fill: Fill): void {
  const cat = GEM_CATEGORY[tile] ?? 0;
  switch (cat) {
    case 0: // 0x10f4 default: void → negro (nada).
      return;
    case 1: // 0xabe: 4 puntos verde claro (hierba).
      for (const [sx, sy] of QUAD_DOTS) px(sx, sy, LTGREEN);
      return;
    case 2: // 0xb04: relleno verde claro.
      return fill(LTGREEN);
    case 3: // 0xfc6: relleno rojo.
      return fill(RED);
    case 4: // 0xb60: líneas horizontales arriba y abajo (blanco).
      hline(0, 0, 3, WHITE);
      hline(3, 0, 3, WHITE);
      return;
    case 5: // 0xb98: dos trazos centrales (blanco).
      hline(1, 1, 2, WHITE);
      hline(2, 1, 2, WHITE);
      return;
    case 6: // 0xbd0: marco hueco (blanco).
      hline(0, 0, 3, WHITE);
      hline(3, 0, 3, WHITE);
      vline(0, 1, 2, WHITE);
      vline(3, 1, 2, WHITE);
      return;
    case 7: // 0xffc: relleno blanco.
      return fill(WHITE);
    case 8: // 0xc36: dos bloques 2×2 en diagonal (amarillo, colinas).
      hline(0, 0, 1, YELLOW);
      hline(1, 0, 1, YELLOW);
      hline(2, 2, 3, YELLOW);
      hline(3, 2, 3, YELLOW);
      return;
    case 9: // 0xc9c: líneas filas 0 y 2 + 2 puntos (verde claro, bosque).
      hline(0, 0, 3, LTGREEN);
      hline(2, 0, 3, LTGREEN);
      px(2, 1, LTGREEN);
      px(0, 3, LTGREEN);
      return;
    case 10: // 0xcf4: 4 puntos de costa/río (color por cuadrante).
      return drawCoast(tile, px);
    case 11: // 0xdda: 2 puntos diagonales (azul claro, agua/cascada).
      px(0, 0, LTBLUE);
      px(2, 2, LTBLUE);
      return;
    case 12: // 0x101e: 1 punto central (azul claro, agua profunda).
      px(2, 2, LTBLUE);
      return;
    case 13: // 0xe16: 2 puntos verdes + 2 azules (pantano).
      px(1, 0, LTGREEN);
      px(3, 1, LTGREEN);
      px(0, 2, LTBLUE);
      px(2, 3, LTBLUE);
      return;
    case 14: // 0x1056: dos líneas verticales (blanco, carteles).
      vline(1, 0, 3, WHITE);
      vline(2, 0, 3, WHITE);
      return;
    case 15: // 0x108c: relleno azul claro (fuentes).
      return fill(LTBLUE);
    case 16: // 0xe7a: camino/poblado.
      return drawRoad(tile, px, hline, vline);
    default:
      return;
  }
}

/** cat 10 (0xcf4): 4 puntos; ribera verde / agua azul por cuadrante en ríos (0x6x). */
function drawCoast(tile: number, px: Plot): void {
  const isRiver = (tile & 0xf0) === 0x60;
  const bits = isRiver ? COAST_NIBBLE[tile & 0xf]! : 0;
  QUAD_DOTS.forEach(([sx, sy], q) => {
    // El binario prueba dx = 8,4,2,1 para los cuadrantes 0..3 (bucle 0xd3e): el bit
    // PUESTO cae en la rama del AGUA (test+jne, #101) — la ribera es el bit CLARO.
    const isBank = isRiver && (bits & (0x08 >> q)) === 0;
    px(sx, sy, isBank ? LTGREEN : LTBLUE);
  });
}

/**
 * cat 16 (0xe7a): hierba base (4 puntos verdes) + centro rojo 2×2 + aristas de conexión
 * rojas según ROAD_EDGE[tile] → línea continua; muesca negra en las esquinas.
 */
function drawRoad(tile: number, px: Plot, hline: Line, vline: Line): void {
  for (const [sx, sy] of QUAD_DOTS) px(sx, sy, LTGREEN); // 0xabe (hierba de fondo)
  // Centro rojo 2×2 (0x6816 fill x+1,y+1 .. x+2,y+2).
  hline(1, 1, 2, RED);
  hline(2, 1, 2, RED);
  const edge = ROAD_EDGE[tile] ?? 0;
  if (edge & 0x08) hline(0, 1, 2, RED); // arriba
  if (edge & 0x04) vline(3, 1, 2, RED); // derecha
  if (edge & 0x02) hline(3, 1, 2, RED); // abajo
  if (edge & 0x01) vline(0, 1, 2, RED); // izquierda
  const notch = ROAD_CORNER_NOTCH[tile];
  if (notch) px(notch[0], notch[1], 0); // negro (0xf28: setcolor 0)
}
