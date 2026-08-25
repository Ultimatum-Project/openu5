/**
 * Pintado de la vista de ZODÍACO del catalejo nocturno en el viewport de la piel fiel.
 *
 * Geometría EXACTA de `look_sky` (LOOKOBJ.OVL 0x0366) y sus helpers `draw_zodiac_star`
 * (0x01ac) / `draw_zodiac_lines` (0x024c), disasm propio (ver `re/notes/zodiac-derivation.md`).
 * El descriptor (`ZodiacView`) lo produce `core/world/zodiac-view.ts`. Cosmético; la piel
 * shader lo hereda por el mismo viewport (envuelve a la fiel).
 *
 * Colores: la estrella del zodíaco usa `g_13b0` = `colors.border` (enlace EXACTO del ASM);
 * las 80 estrellas de FONDO usan `g_13b2 + 8` (0x03e0-0x03e3), y `g_13b2` es a su vez el
 * live-read que la piel guarda como `colors.frame` ⇒ el enlace se DERIVA (ver `bgStarColor`)
 * en vez de cablear el 9. La LÍNEA (`g_13ae`) sí es un literal: ver `LINE_COLOR`.
 */
import type { ZodiacView } from "../../core/world/zodiac-view.js";
import type { FrameColors } from "./frame.js";
import { DEFAULT_FRAME_COLORS, VIEWPORT } from "./frame.js";
import { EGA_PALETTE } from "./ega.js";

/**
 * Segmentos VLINE del glifo LÍNEA (`draw_zodiac_lines` 0x024c): `[dx, y0, y1]` relativos a
 * `(lineX, y)`. Son 8 VERTICALES, no horizontales: cada llamada es a `0x6a62` = (base near-call
 * 0xa290) = kernel ULTIMA.EXE `0x0cf2` = `draw_vline(x, y0, y1)` — el `mov cx, ax` de 0x0d01
 * (x1=x0) es lo que la define como vertical. El PRIMER push de las tres sale de `[bp-2]` = el
 * arg de COLUMNA (0x0252), y los otros dos de `[bp-4]` = el de FILA: por eso el índice que
 * avanza 5→12 es la X y los pares son el tramo de Y. Inmediatos idénticos a los del binario.
 */
const LINE_SEGMENTS: ReadonlyArray<readonly [number, number, number]> = [
  [5, 10, 12],
  [6, 10, 12],
  [7, 8, 12],
  [8, 8, 12],
  [9, 6, 10],
  [10, 6, 10],
  [11, 5, 8],
  [12, 5, 7],
];

/**
 * TRÍPODE del catalejo. `look_sky` escribe UNA celda del búfer de tiles ANTES de componer:
 * `0x03d8 mov byte ptr [g_vis_buffer+325], 0x59`. El búfer (`0xAB02`, el mismo que limpia el
 * bucle 0x03b6-0x03d3 con `lea di,[si-0x54fe]` ⇒ `-0x54fe = 0xAB02`) lleva 11 filas de STRIDE
 * 0x20 y 11 bytes útiles por fila (`mov cx,5` + `repne stosw` + `stosb`; `cmp si,0x160`=352=11×32)
 * ⇒ 325 = 10·32 + 5 = FILA 10, COLUMNA 5: abajo del todo, en la columna central de las 11.
 * El tile 0x59 es `Telescope` en TileData.json.
 *
 * El resto del búfer queda a 0xFF = `BlackSquare` — que es de dónde sale el «fondo negro» del
 * viewport: no hay ningún fill negro en `look_sky`, hay 120 celdas de tile negro + ésta. El
 * `ctx.fillRect` de abajo hace ese trabajo (equivalente en píxeles), y el trípode se blitea
 * encima ANTES de las estrellas — el orden del binario, donde el compositor `viewport_compose`
 * (ULTIMA.EXE `0x56ac`, llamado en 0x03dd) corre antes del bucle de `plot` de 0x03ea.
 */
export const TELESCOPE_TILE = 0x59;
export const TELESCOPE_ROW = 10;
export const TELESCOPE_COL = 5;

/** Nº de columnas del atlas de tiles (16 px) — misma rejilla que usa `drawTile` en skin.ts. */
const ATLAS_COLS = 32;
const ATLAS_TILE = 16;

/**
 * Color de las 80 estrellas de FONDO = `g_13b2 + 8` (`0x03e0`: `mov ax,[g_unk_13b2]` · `0x03e3`:
 * `add ax, 8`). `g_13b2` es la variable que la piel ya tiene leída como `colors.frame` (EGA 1
 * azul, live-read declarado en `DEFAULT_FRAME_COLORS`), así que el `+8` se APLICA al índice en
 * vez de cablear el resultado: 1 + 8 = 9 = azul claro, que es lo que se ve en la captura del
 * original (antes el port pintaba `#ffffff`, un Clase-C que la derivación ya contradecía).
 * Si `colors.frame` no es un color de la paleta EGA (piel con tema propio), no hay índice que
 * sumar y se cae al 9 del régimen de arranque.
 */
export function bgStarColor(colors: FrameColors): string {
  const frameIdx = EGA_PALETTE.indexOf(colors.frame as (typeof EGA_PALETTE)[number]);
  return EGA_PALETTE[frameIdx >= 0 ? (frameIdx + 8) % 16 : 9]!;
}

/**
 * Color del glifo LÍNEA = `g_13ae` (0x024c lo lee para las 8 vlíneas) = **EGA 4, rojo**.
 * Literal, no derivado: `g_13ae` no tiene live-read en la piel. Lo acredita la CAPTURA del
 * original en esta misma pantalla (`av-referencia/reportes/spyglass-cielo-nocturno-297.jpeg`:
 * los dos conectores salen rojos), que fija el valor EN TIEMPO DE `look_sky`. 🔴 Eso NO cierra
 * la ficha #305, que pregunta por el valor de `g_13ae`/`g_13b0` en tiempo de CURANDERO
 * (SHOPPES.OVL 0x13b0): son el mismo par de variables leído en otro momento del programa.
 */
export const LINE_COLOR = EGA_PALETTE[4];

export function paintZodiac(
  ctx: CanvasRenderingContext2D,
  zv: ZodiacView,
  colors: FrameColors = DEFAULT_FRAME_COLORS,
  atlas: CanvasImageSource | null = null,
): void {
  const vx = VIEWPORT.x;
  const vy = VIEWPORT.y;
  const vw = VIEWPORT.tile * VIEWPORT.tiles; // 176
  // Fondo negro del viewport (look_sky 0x3dd).
  ctx.fillStyle = colors.background;
  ctx.fillRect(vx, vy, vw, vw);

  const BG_STAR = bgStarColor(colors); // g_13b2+8 (0x03e0/0x03e3) = EGA 9, azul claro
  const STAR = colors.border; // g_13b0 — enlace EXACTO del ASM
  const LINE = LINE_COLOR; // g_13ae = EGA 4, rojo (acreditado por la captura del original)

  // Píxel con clip al interior del viewport (las estrellas no deben pisar el marco). El clip
  // REPRODUCE las guardas del binario sin transcribirlas: la ventana es x∈[8,183] y las guardas
  // de 0x01ac/0x024c son exactamente eso (`starX+si ≤ 0xb0` con píxel `starX+si+7` ⇒ ≤183;
  // `starX ≤ 0xad` con píxel `starX+10` ⇒ ≤183; las cinco de la línea, `lineX+k ≤ 0xb7`=183; y
  // la de la izquierda, `lineX > 2`, sólo dispara con col=0 → píxeles x=5,6,7, que el borde
  // izquierdo de la ventana (8) ya recorta). Ninguna guarda cae fuera del clip de ventana.
  const px = (x: number, y: number, color: string): void => {
    if (x < vx || x >= vx + vw || y < vy || y >= vy + vw) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  };

  // TRÍPODE (look_sky 0x03d8, dentro del pase de `viewport_compose` que corre en 0x03dd): va
  // ANTES de las estrellas, así que una estrella de fondo puede caer ENCIMA del telescopio.
  // Sin atlas (tests headless sin DOM) no hay tile que blitear y el resto se pinta igual.
  if (atlas) {
    const sx = (TELESCOPE_TILE % ATLAS_COLS) * ATLAS_TILE;
    const sy = Math.floor(TELESCOPE_TILE / ATLAS_COLS) * ATLAS_TILE;
    const dx = vx + TELESCOPE_COL * VIEWPORT.tile;
    const dy = vy + TELESCOPE_ROW * VIEWPORT.tile;
    ctx.drawImage(atlas, sx, sy, ATLAS_TILE, ATLAS_TILE, dx, dy, ATLAS_TILE, ATLAS_TILE);
  }

  // 80 estrellas de fondo (look_sky 0x3ea).
  for (const s of zv.bgStars) px(s.x, s.y, BG_STAR);

  // 8 signos: glifo estrella + línea conectora (si un Shadowlord está en la ciudad).
  for (const sign of zv.signs) {
    const Y = sign.y;
    // draw_zodiac_star (0x01ac): las tres llamadas a plot empujan PRIMERO la coordenada que sale
    // del arg de COLUMNA (0x01cd, 0x0208, 0x0233) = la X. ⇒ bloque 3×3 (SX+7..9, Y+7..9) con una
    // antena a cada LADO: (SX+6,Y+8) y (SX+10,Y+8).
    const SX = sign.starX;
    px(SX + 6, Y + 8, STAR);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) px(SX + 7 + i, Y + 7 + j, STAR);
    px(SX + 10, Y + 8, STAR);
    // draw_zodiac_lines (0x024c): 8 VLINES en columnas contiguas cuyo tramo de Y sube hacia la
    // derecha ⇒ trazo diagonal ↗ que entra en el signo por abajo-izquierda. Su origen X es
    // `lineX` = col*8, 8 px a la izquierda del de la estrella (el `dec` de 0x4b0).
    if (sign.hasLine) {
      const LX = sign.lineX;
      for (const [dx, y0, y1] of LINE_SEGMENTS) {
        for (let y = y0; y <= y1; y++) px(LX + dx, Y + y, LINE);
      }
    }
  }
}
