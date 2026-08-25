/**
 * Redibujo VECTORIAL del chrome para la piel «shader» (tarea #73, EJE 1, opción 1b).
 *
 * La piel fiel pinta el chrome a resolución lógica 320×200 y la piel shader lo
 * escalaba por VECINO (NEAREST). Este módulo lo REDIBUJA a resolución de dispositivo
 * reusando la geometría LITERAL de `frame.ts` (`FRAME_FILLS`/`VIEWPORT` + los rects de
 * caja literales del binario), redondeando esquinas donde el remaster 1b lo pide.
 *
 * ESQUINAS REDONDEADAS (decisión del usuario 2026-07-17, supersede la conservadora):
 *  · Las 3 esquinas EXTERIORES del marco azul (las que el original ya redondea con sus
 *    glifos 0x7b/0x7c/0x7d) → arco de radio `OUTER_CORNER_R` (cierra #74).
 *  · Los bordes blancos INTERIORES (caja del viewport y las 2 sub-cajas del panel) →
 *    esquinas curvas como la maqueta 1b (radios `VIEWPORT_BOX_R`/`PANEL_BOX_R`). Para
 *    que el contenido (mundo xBR en el viewport, negro en el panel) no asome en pico
 *    fuera del arco, se ENMASCARA la cuña de cada esquina (cuadrado − rect redondeado)
 *    con el color del contenido antes de trazar el filo. La «L» inferior del panel
 *    queda recta (no es caja).
 *  · La piel FIEL conserva sus ángulos rectos (esto es solo la shader).
 *  · Los glifos del cielo/vientos y los remates de banda NO se dibujan aquí (contenido
 *    dinámico); la piel los recompone/redibuja aparte (ver `skin.ts`/`skyband.ts`).
 */
import {
  DEFAULT_FRAME_COLORS,
  FRAME_FILLS,
  type FrameColors,
  SCREEN_H,
  SCREEN_W,
  VIEWPORT,
} from "../fiel/frame.js";

/** Radio (px lógicos) de las esquinas EXTERIORES del marco azul (~bisel del glifo 0x7b). */
export const OUTER_CORNER_R = 4;
/** Radio de la caja del viewport (maqueta 1b). */
const VIEWPORT_BOX_R = 3;
/**
 * Radio de las sub-cajas del panel (roster/oro y F/G/fecha). RECTAS (0): testigo del
 * usuario 2026-07-18 — «las cajas de panel deben ser RECTANGULARES como el original».
 * Supersede la maqueta 1b redondeada SOLO para estas cajas de panel; los remates ►◄ de
 * banda y el chevron del bullet '>' siguen redondeados (decisiones previas del usuario).
 */
const PANEL_BOX_R = 0;

/** Fila y (exclusiva) del borde inferior del marco azul: barra izquierda `y1=0xbf`. */
const BLUE_BOTTOM = 0xbf + 1;

/** Las tres esquinas exteriores que el original redondea (glifos 0x7b/0x7c/0x7d). */
type OuterCorner = "tl" | "tr" | "bl";

/**
 * Caja de borde blanco: rect INCLUSIVO en px lógicos (como el binario) + radio + color
 * de la cuña de esquina a enmascarar (el CONTENIDO interior: negro en el viewport bajo
 * el mundo, azul de marco en las sub-cajas del panel).
 */
interface WhiteBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  r: number;
  gap: keyof Pick<FrameColors, "background" | "frame">;
}

/**
 * Cajas blancas del chrome. SOLO el viewport (borde en (7,7)-(184,184)): su cuña de
 * esquina se enmascara con NEGRO (el mundo xBR tiene ahí su esquina cuadrada) y su filo
 * se redondea contra el mundo filtrado (`VIEWPORT_BOX_R`).
 *
 * Las DOS sub-cajas del panel (roster/oro `0x07-0x38` y F/G/fecha `0x3f-0x50`, rects de
 * `paint_screen_frame`) ya NO se dibujan aquí. Motivo (fix ready-shader 2026-07-18): el
 * chrome vectorial es ESTÁTICO (precomputado una vez), así que redibujar esas dos cajas
 * cada frame las pinta ENCIMA de lo que el panel muestre — y cuando el panel es un OVERLAY
 * de pergamino (picker de Ready, listas de Ztats, selector de Mix) las PARTÍA en dos con
 * una banda azul en medio (testigo del usuario). La piel fiel ya pinta el contenido del
 * panel CORRECTO por contexto en la capa nearest del paso (1) — las cajas del roster
 * cuando hay roster, el pergamino ÚNICO cuando hay overlay — y sus filos son líneas de 1px
 * ejes-alineadas que el nearest ×S escala nítidas. Con `PANEL_BOX_R = 0` (esquinas rectas,
 * decisión del usuario) el redibujo vectorial de estas cajas era ADEMÁS pixel-redundante
 * con esa capa nearest: no aportaba nitidez, solo el bug. `PANEL_BOX_R` se conserva
 * documentado por si se reintroduce un tratamiento por-contexto (no estático) en el futuro.
 */
function whiteBoxes(): WhiteBox[] {
  const vx0 = VIEWPORT.x - 1; // 7
  const vy0 = VIEWPORT.y - 1; // 7
  const vx1 = VIEWPORT.x + VIEWPORT.tiles * VIEWPORT.tile; // 184
  const vy1 = vx1; // caja cuadrada
  return [{ x0: vx0, y0: vy0, x1: vx1, y1: vy1, r: VIEWPORT_BOX_R, gap: "background" }];
}

/**
 * Columna izquierda (px lógicos) de las barras INTERIORES del panel: `barra panel
 * superior`/`inferior` de `FRAME_FILLS` arrancan en 0xc0 (dentro del panel), mientras que
 * las barras ESTRUCTURALES del marco que tocan el panel arrancan antes (0xb9 el separador
 * viewport|panel, 0x139 la franja derecha) o en el borde (0x00). Sirve para distinguirlas.
 */
const PANEL_INTERIOR_X0 = 0xc0;

/**
 * ¿Es `rr` una de las dos barras azules INTERIORES del panel (separadores de la
 * disposición estándar roster/F-G)? Se identifican por su columna izquierda 0xc0. El
 * chrome vectorial las OMITE (las repinta la capa nearest en su contexto correcto); ver
 * el bucle de `FRAME_FILLS` en `drawVectorChrome` y `whiteBoxes()`.
 */
function isPanelInteriorFill(rr: { x0: number }): boolean {
  return rr.x0 === PANEL_INTERIOR_X0;
}

/** Traza (sin begin/stroke) un rect redondeado por arcTo en px de dispositivo. */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Redondea una esquina exterior del marco azul: limpia el cuadrado R×R de la esquina y
 * repinta un cuarto de disco azul → filo diagonal curvo, exterior transparente.
 */
function roundBlueCorner(
  ctx: CanvasRenderingContext2D,
  s: number,
  corner: OuterCorner,
  r: number,
  blue: string,
): void {
  let sqx: number;
  let sqy: number;
  let cx: number;
  let cy: number;
  let a0: number;
  let a1: number;
  const HALF = Math.PI / 2;
  if (corner === "tl") {
    sqx = 0;
    sqy = 0;
    cx = r;
    cy = r;
    a0 = Math.PI;
    a1 = Math.PI + HALF;
  } else if (corner === "tr") {
    sqx = SCREEN_W - r;
    sqy = 0;
    cx = SCREEN_W - r;
    cy = r;
    a0 = Math.PI + HALF;
    a1 = 2 * Math.PI;
  } else {
    sqx = 0;
    sqy = BLUE_BOTTOM - r;
    cx = r;
    cy = BLUE_BOTTOM - r;
    a0 = HALF;
    a1 = Math.PI;
  }
  ctx.clearRect(sqx * s, sqy * s, r * s, r * s);
  ctx.beginPath();
  ctx.moveTo(cx * s, cy * s);
  ctx.arc(cx * s, cy * s, r * s, a0, a1);
  ctx.closePath();
  ctx.fillStyle = blue;
  ctx.fill();
}

/** Dibuja una caja blanca con esquinas redondeadas + enmascarado de la cuña de esquina. */
function drawWhiteBox(
  ctx: CanvasRenderingContext2D,
  s: number,
  box: WhiteBox,
  colors: FrameColors,
): void {
  const r = box.r * s;
  // (a) Enmascara las 4 cuñas de esquina (cuadrado − rect redondeado) con el color a
  //     mostrar ahí. VIEWPORT (gap=negro): la cuña es el CONTENIDO interior — se enmascara
  //     el rect del MUNDO (1 px dentro del filo) para tapar el pico cuadrado del mundo
  //     (nearest + xBR). PANEL (gap=azul): la cuña es el EXTERIOR — se enmascara el rect
  //     de la CAJA para tapar el remate blanco cuadrado del blit nearest y dejar azul.
  const inset = box.gap === "background" ? 1 : 0;
  const mx = (box.x0 + inset) * s;
  const my = (box.y0 + inset) * s;
  const mw = (box.x1 - box.x0 - 2 * inset) * s;
  const mh = (box.y1 - box.y0 - 2 * inset) * s;
  ctx.fillStyle = colors[box.gap];
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  roundRectPath(ctx, mx, my, mw, mh, Math.max(0, r - inset * s));
  ctx.fill("evenodd");
  // (b) Filo blanco redondeado (línea de 1 px → centro en +0.5, ancho s).
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = s;
  ctx.beginPath();
  roundRectPath(
    ctx,
    (box.x0 + 0.5) * s,
    (box.y0 + 0.5) * s,
    (box.x1 - box.x0) * s,
    (box.y1 - box.y0) * s,
    r,
  );
  ctx.stroke();
}

/**
 * Pinta el chrome vectorial en `ctx` a escala entera `s` (backbuffer = 320S×200S).
 * Transparente donde no hay chrome para que la base (mundo xBR + texto/paneles) se vea.
 */
export function drawVectorChrome(
  ctx: CanvasRenderingContext2D,
  s: number,
  colors: FrameColors = DEFAULT_FRAME_COLORS,
): void {
  ctx.clearRect(0, 0, SCREEN_W * s, SCREEN_H * s);

  // Barras del marco (rects inclusivos → +1 en ancho/alto), nítidas ×S. SALTA las dos
  // barras azules INTERIORES del panel (`barra panel superior` 0x39-0x3f y `barra panel
  // inferior` 0x50-0x57, ambas x0=0xc0): son separadores de la disposición ESTÁNDAR del
  // panel (caja roster/oro ↕ caja F/G/fecha). Como el chrome es estático, redibujarlas
  // cada frame las pinta ENCIMA de cualquier OVERLAY de pergamino que ocupe el panel
  // (picker de Ready, Ztats, selector de Mix), PARTIÉNDOLO con una banda azul (testigo
  // del usuario 2026-07-18). La capa nearest del paso (1) ya las pinta cuando toca (hay
  // roster) y son rects azules ejes-alineados que el nearest ×S escala nítidos → el
  // redibujo vectorial era redundante ahí y solo causaba el bug. Ver `whiteBoxes()`.
  ctx.fillStyle = colors.frame;
  for (const rr of FRAME_FILLS) {
    if (isPanelInteriorFill(rr)) continue;
    ctx.fillRect(rr.x0 * s, rr.y0 * s, (rr.x1 - rr.x0 + 1) * s, (rr.y1 - rr.y0 + 1) * s);
  }

  // Esquinas exteriores redondeadas (las que el original redondea con sus glifos).
  roundBlueCorner(ctx, s, "tl", OUTER_CORNER_R, colors.frame);
  roundBlueCorner(ctx, s, "tr", OUTER_CORNER_R, colors.frame);
  roundBlueCorner(ctx, s, "bl", OUTER_CORNER_R, colors.frame);

  // «L» inferior del panel (recta, no es caja): vertical (191,191)-(191,87) + horizontal
  // (191,87)-(319,87), líneas de 1 px (FRAME_SEGMENTS 6484/648f).
  ctx.fillStyle = colors.border;
  ctx.fillRect(0xbf * s, 0x57 * s, s, (0xbf - 0x57 + 1) * s); // vertical
  ctx.fillRect(0xbf * s, 0x57 * s, (0x13f - 0xbf + 1) * s, s); // horizontal
  // Filo blanco IZQUIERDO de las DOS sub-cajas del panel (roster/oro + F/G/fecha): el
  // separador azul vectorial (FRAME_FILLS 63d9) rellena x=0xbf a todo lo alto y BORRABA el
  // filo blanco de esas cajas que la capa nearest sí tenía — sólo la «L» inferior lo
  // restituía, dejando el panel de jugadores/KPIs sin su línea vertical izquierda (testigo
  // del usuario, veredicto #19). Restituye el tramo superior: FRAME_SEGMENTS 64c3 + 64f7 de
  // la fiel. Va a x=0xbf (columna derecha del separador), NO pisa el área de contenido del
  // panel (x≥0xc0) → seguro con el pergamino de overlay (Ready/Ztats/Mix).
  ctx.fillRect(0xbf * s, 0x07 * s, s, (0x38 - 0x07 + 1) * s); // sub-caja roster (izquierda)
  ctx.fillRect(0xbf * s, 0x3f * s, s, (0x50 - 0x3f + 1) * s); // sub-caja F/G/fecha (izquierda)

  // Cajas blancas con esquinas REDONDEADAS (viewport + sub-cajas del panel, maqueta 1b).
  for (const box of whiteBoxes()) {
    drawWhiteBox(ctx, s, box, colors);
  }
}
