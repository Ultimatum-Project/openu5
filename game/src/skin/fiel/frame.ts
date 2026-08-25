/**
 * CHROME EGA de la pantalla de juego (E1-S8b) — calco de `paint_screen_frame`
 * del kernel (`0x637e`, `re/notes/ui-text-layer.md §8`). Coordenadas LITERALES
 * del binario (320×200 px), cada op con su offset. Primitivas del original
 * (arg order verificado):
 *   fill_rect(x0,y0,x1,y1)  kernel 0x0aa6  (x0=[bp+0xa]..y1=[bp+4])
 *   line(x0,y0,x1,y1)       kernel 0x0b10  (mismo orden)
 *   point(x,y)             kernel 0x0f90  (continúa la polilínea desde el último
 *                                          extremo: bordes = cajas de segmentos)
 *   glyph(code)@cursor      kernel 0x16ba  (cursor set_cursor(col,row) 0x1bf2)
 *
 * Los COLORES (`g_unk_13b2` marco, `g_unk_13b0` borde) son globals de runtime
 * (sin init estático) → índices EGA exactos = Clase C, a confirmar por
 * píxel-diff (catálogo AV). Aquí se parametrizan con defaults EGA razonables; la
 * GEOMETRÍA es derivada y literal.
 */
import { FaithfulFont } from "./font.js";

/** Rectángulo relleno en px (bordes inclusivos, como el binario). */
export interface FillRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** Segmento de línea en px. */
export interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** Glifo de esquina del marco, en celdas de carácter (8 px). */
export interface FrameGlyph {
  col: number;
  row: number;
  code: number;
}

/** Pantalla lógica del original. */
export const SCREEN_W = 320;
export const SCREEN_H = 200;

/**
 * Barras/paneles del marco (color `g_unk_13b2`). Offsets de `paint_screen_frame`.
 * fill_rect(x0,y0,x1,y1), bordes inclusivos.
 */
export const FRAME_FILLS: readonly FillRect[] = [
  { x0: 0x00, y0: 0x00, x1: 0x13f, y1: 0x06 }, // 63ac · barra superior
  { x0: 0x00, y0: 0xb9, x1: 0xbf, y1: 0xbf }, // 63bb · barra inferior (izq. del sep.)
  { x0: 0x00, y0: 0x00, x1: 0x06, y1: 0xbf }, // 63ca · barra izquierda
  { x0: 0xb9, y0: 0x00, x1: 0xbf, y1: 0xbf }, // 63d9 · separador viewport|panel
  { x0: 0x139, y0: 0x00, x1: 0x13f, y1: 0x57 }, // 63eb · franja derecha
  { x0: 0xc0, y0: 0x50, x1: 0x138, y1: 0x57 }, // 63fe · barra panel (inferior)
  { x0: 0xc0, y0: 0x39, x1: 0x138, y1: 0x3f }, // 6411 · barra panel (superior)
];

/** Glifos de esquina (runas de marco) en celdas de carácter. Call-site del glyph (0x16ba). */
export const FRAME_GLYPHS: readonly FrameGlyph[] = [
  { col: 0x00, row: 0x00, code: 0x7b }, // 6426 · esquina sup-izq
  { col: 0x27, row: 0x00, code: 0x7c }, // 6437 · esquina sup-der (col 39)
  { col: 0x00, row: 0x17, code: 0x7d }, // 6448 · esquina inf-izq (fila 23)
];

/**
 * Bordes (color `g_unk_13b0`) como los emite el binario: `line` abre la
 * polilínea y `point` la continúa. Aquí, aplanados a segmentos explícitos, cada
 * uno con el offset de su `call`.
 */
export const FRAME_SEGMENTS: readonly Segment[] = [
  // Caja del viewport 11×11: (7,7)-(184,184). Call-sites line/point.
  { x0: 0x07, y0: 0x07, x1: 0x07, y1: 0xb8 }, // 645c line · izquierda
  { x0: 0x07, y0: 0xb8, x1: 0xb8, y1: 0xb8 }, // 6464 point · inferior
  { x0: 0xb8, y0: 0xb8, x1: 0xb8, y1: 0x07 }, // 646f point · derecha
  { x0: 0xb8, y0: 0x07, x1: 0x07, y1: 0x07 }, // 6477 point · superior
  // L del panel: izquierda (x=191, y191..87) + tramo y=87 hasta x=319.
  { x0: 0xbf, y0: 0xbf, x1: 0xbf, y1: 0x57 }, // 6484 line
  { x0: 0xbf, y0: 0x57, x1: 0x13f, y1: 0x57 }, // 648f point
  // Sub-caja superior del panel: (191,7)-(312,56).
  { x0: 0xbf, y0: 0x07, x1: 0x138, y1: 0x07 }, // 64a2 line · superior
  { x0: 0x138, y0: 0x07, x1: 0x138, y1: 0x38 }, // 64ad point · derecha
  { x0: 0x138, y0: 0x38, x1: 0xbf, y1: 0x38 }, // 64b8 point · inferior
  { x0: 0xbf, y0: 0x38, x1: 0xbf, y1: 0x07 }, // 64c3 point · izquierda
  // Sub-caja media del panel: (191,63)-(312,80).
  { x0: 0xbf, y0: 0x3f, x1: 0x138, y1: 0x3f }, // 64d6 line · superior
  { x0: 0x138, y0: 0x3f, x1: 0x138, y1: 0x50 }, // 64e1 point · derecha
  { x0: 0x138, y0: 0x50, x1: 0xbf, y1: 0x50 }, // 64ec point · inferior
  { x0: 0xbf, y0: 0x50, x1: 0xbf, y1: 0x3f }, // 64f7 point · izquierda
];

/**
 * Geometría del viewport 11×11 derivada de la caja del borde (7,7)-(184,184):
 * interior en (8,8), tiles de 16 px → 176×176 = 11×16. Es la ventana de juego
 * (regla dura #5). El separador está en x=185..191 (`0xb9..0xbf`).
 */
export const VIEWPORT = { x: 8, y: 8, tile: 16, tiles: 11 } as const;

/**
 * El RECTÁNGULO INTERIOR de la ventana de juego, DERIVADO de `VIEWPORT` — la geometría
 * que el binario escribe como `rect(8, 8, 0xb7, 0xb7)` y que comparten todos los efectos
 * que cubren «la ventana entera y nada más»: la inversión XOR del rito/hechizos/curandero
 * (#295) y el apagón del sueño (#296).
 *
 * 🔴 LAS DOS LECTURAS VAN JUNTAS A PROPÓSITO, porque difieren en 1 y ese 1 es el error
 * clásico al copiar la constante del ASM a canvas:
 *   · el binario da ESQUINAS INCLUSIVAS  → (x1,y1) = (0xb7, 0xb7) = 183, y el ancho real
 *     es `x2 - x1 + 1` = 176;
 *   · `fillRect` quiere ORIGEN + TAMAÑO  → (x, y, w, h) = (8, 8, 176, 176).
 * Quien lea `0xb7` y lo pase como `w` pinta 183 px (7 de más, comiéndose el separador de
 * x=185..191). Quien derive `w` y lo compare con `0xb7` creerá que no cuadra. Aquí están
 * las dos, con la aritmética a la vista, y `x2`/`y2` se CALCULAN — no se escriben a mano.
 *
 * 176 = 11 tiles × 16 px, que es la comprobación independiente de que el rect del binario
 * y la rejilla del port hablan de lo mismo.
 */
export const VIEWPORT_INTERIOR = {
  x: VIEWPORT.x,
  y: VIEWPORT.y,
  w: VIEWPORT.tiles * VIEWPORT.tile,
  h: VIEWPORT.tiles * VIEWPORT.tile,
  /** Esquina inferior-derecha INCLUSIVA, como la escribe el binario (0xb7 = 183). */
  x2: VIEWPORT.x + VIEWPORT.tiles * VIEWPORT.tile - 1,
  y2: VIEWPORT.y + VIEWPORT.tiles * VIEWPORT.tile - 1,
} as const;

/**
 * INVERSIÓN del interior de la ventana — la primitiva compartida de #295.
 *
 * En el binario es `set_color(c)` + `rect(8,8,0xb7,0xb7)` con `stc`: el carry hace que
 * `EGA.DRV fn21 @0x1180` programe el registro 3 del Graphics Controller con `0x18`
 * (bits 4-3 = 11 = XOR), así que el rect aplica `pixel ^= c` sobre el ÍNDICE EGA de 4
 * bits, y al salir restaura el modo replace.
 *
 * 🔴 `globalCompositeOperation = "difference"` con BLANCO **no es la misma operación**:
 * es `255 − canal` sobre RGB, no `índice ^ c` sobre la paleta.
 *
 * ~~Coinciden exactamente cuando `c = 15`~~ — SOBREDICHO, y corregido con la medición de
 * #317 (censo exhaustivo de los 16 índices EGA, 14-08): con máscara 15 divergen los índices
 * **6 y 9**, los dos por el brown-fix `EGA[6] = #AA5500` (el remapeo del amarillo oscuro a
 * marrón rompe la coincidencia complemento↔XOR; con máscara 4 divergen seis índices y con
 * la 11, cinco). Lo que SÍ sostiene el careo del usuario es su otra mitad: la captura del
 * WELL DONE da `c XOR 15` en 13 de las 14 entradas pobladas — es decir, la aproximación es
 * buena **porque el índice 6 casi no aparece en el viewport del rito**, no porque las dos
 * operaciones sean la misma. Aproximación de Clase C, DECLARADA y usada a propósito.
 *
 * Por eso este helper NO toma un color: expresa el único régimen careado. Los sitios del
 * binario que pasan OTRA variable de color (el bracket del Códice y el curandero alternan
 * `g_unk_13ae`/`g_unk_13b0`) NO se pueden expresar así y ~~tienen DOBLE cerradura — el valor
 * de arranque (#305, oráculo) **y** el modelo de render (#317)~~ — las DOS cerraduras se
 * abrieron con #299 (2026-08-19): #305 se derivó en ESTÁTICO (único escritor de los dos
 * globales en el corpus: INTRO.OVL 0x09f4/0x09fa, rama EGA — 13ae=4, 13b0=0xF) y el modelo
 * de render existe en `palette-xor.ts` (`paletteXorRect`: reindexa contra la LUT EGA y
 * aplica `índice ^ máscara` de verdad — el destello del curandero lo estrena, y el bracket
 * del Códice quedó CABLEADO con él el 19-08, carril fix-codice: `CodexWindFlash` en
 * invert-flash.ts, máscaras acumuladas 4/11/15 de CAST2 0x0db3/0x0dca/0x0de1). El veto
 * sigue para ESTE helper: quien cablee un sitio de color variable usa el XOR de paleta,
 * **no ensancha este helper con un parámetro de color** — confirmado por medición.
 *
 * Sólo el interior: chrome y paneles laterales quedan intactos, como en el original
 * (testigo doom-n6 f045, y la captura de #295 con los paneles normales).
 */
export function invertViewportInterior(ctx: CanvasRenderingContext2D): void {
  invertRect(ctx, VIEWPORT_INTERIOR.x, VIEWPORT_INTERIOR.y, VIEWPORT_INTERIOR.w, VIEWPORT_INTERIOR.h);
}

/**
 * La MISMA inversión, sobre un rect ARBITRARIO — para quien compone el viewport en otro
 * espacio de coordenadas.
 *
 * 🔴 Existe porque `invertViewportInterior` cablea el rect EGA (8,8,176,176) y la piel
 * shader compone el viewport en píxeles de DISPOSITIVO (`wr.x`/`wr.y`/`size`): llamar allí
 * al helper de arriba invertiría un cuadrado de 176 px en la esquina superior izquierda de
 * la pantalla, no la ventana de juego. La firma ENTREGA el rect; lo que no se parametriza
 * —y no se va a parametrizar— es el COLOR (ver el veto del docblock de arriba).
 */
export function invertRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "difference";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/**
 * RELLENO OPACO del interior de la ventana — el `set_color(c)` + `fill_rect(8,8,0xb7,0xb7)`
 * del apagón de cama (#296, CMDS.OVL 0x0614-0x0624). Mismo rectángulo que la inversión de
 * arriba, y por eso vive aquí: las dos pieles lo pintaban a mano con las constantes de
 * `VIEWPORT` desarmadas, que es la copia que se desincroniza al mover el rect.
 */
export function fillViewportInterior(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(VIEWPORT_INTERIOR.x, VIEWPORT_INTERIOR.y, VIEWPORT_INTERIOR.w, VIEWPORT_INTERIOR.h);
  ctx.restore();
}

export interface FrameColors {
  /** Fondo (clear a negro, kernel set_color(0)). */
  background: string;
  /** Marco/barras (`g_unk_13b2`). Clase C: confirmar índice por píxel-diff. */
  frame: string;
  /** Bordes de caja (`g_unk_13b0`). Clase C. */
  border: string;
}

/**
 * Defaults EGA. El BORDE de caja (`g_unk_13b0`) es BLANCO (EGA 15) y el color de
 * barra (`g_unk_13b2`) AZUL (EGA 1) por LECTURA EN VIVO del DS del original tras
 * Journey Onward (`re/notes/lote-D-witnesses.md §5`, dump `0F 00 01 00 …` validado
 * contra la paleta @0x52de): `0x13b0`=15 blanco, `0x13b2`=1 azul. Cierra el runtime
 * Clase-C de `drivers-drv.md §2.4`.
 *
 * NOTA — el FAIL `border_rule` del pixel-diff de dungeon-composer (idx15 vs "idx7
 * del vídeo", `re/notes/dungeon3d-audit.md §9`) es un FALSO POSITIVO: el blanco de
 * los `.mov` sale atenuado y azulado (~[238,244,246]) por emulación NTSC/composite +
 * compresión; un comparador que lo ajusta al EGA más cercano cae en idx7 gris. La
 * captura limpia del emulador (`chrome-refs/original-marco.png`) tiene el marco a
 * `#ffffff` EXACTO (0 px gris). No tocar: idx15 es fiel.
 */
export const DEFAULT_FRAME_COLORS: FrameColors = {
  background: "#000000",
  frame: "#0000aa", // EGA 1 (azul) — 0x13b2 live-read
  border: "#ffffff", // EGA 15 (blanco) — 0x13b0 live-read (lote-D-witnesses §5)
};

/**
 * Pinta el chrome completo en el contexto (px lógicos 320×200). Reproduce el
 * orden del binario: clear → barras → glifos de esquina → bordes de caja.
 */
export function applyFrame(
  ctx: CanvasRenderingContext2D,
  font: FaithfulFont,
  colors: FrameColors = DEFAULT_FRAME_COLORS,
): void {
  // clear 320×200 a negro (fill_rect(0,0,0x13f,0xc7), color 0).
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // Barras del marco (rects inclusivos → +1 en ancho/alto).
  ctx.fillStyle = colors.frame;
  for (const r of FRAME_FILLS) {
    ctx.fillRect(r.x0, r.y0, r.x1 - r.x0 + 1, r.y1 - r.y0 + 1);
  }

  // Glifos de esquina (runas de marco IBM.CH 0x7b/0x7c/0x7d): REDONDEAN la esquina
  // EXTERIOR del marco azul con su bisel diagonal (escalera EGA), como `paint_screen_frame`
  // (0x637e) que los emite con `put_glyph` (0x16ba) DESPUÉS de las barras. put_glyph es
  // OPACO (copia la celda 8×8 entera: tinta azul + fondo NEGRO), así que el corte del
  // bisel PISA la barra azul y deja negro → esquina redondeada. El port los blitea
  // transparentes (drawGlyph sólo pinta la tinta), por eso el corte quedaba azul-sobre-
  // azul = esquina CUADRADA (#74). Fix: limpiar la celda a negro antes → corte opaco.
  for (const g of FRAME_GLYPHS) {
    ctx.fillStyle = colors.background;
    ctx.fillRect(g.col * 8, g.row * 8, 8, 8);
    font.drawGlyph(ctx, g.code, g.col * 8, g.row * 8, 1, colors.frame);
  }

  // Bordes de caja (líneas de 1 px). Segmentos horizontales/verticales del
  // binario: se pintan como rects de 1 px de grosor (bordes inclusivos).
  ctx.fillStyle = colors.border;
  for (const s of FRAME_SEGMENTS) {
    const x = Math.min(s.x0, s.x1);
    const y = Math.min(s.y0, s.y1);
    const w = Math.abs(s.x1 - s.x0) + 1;
    const h = Math.abs(s.y1 - s.y0) + 1;
    ctx.fillRect(x, y, w, h);
  }
}
