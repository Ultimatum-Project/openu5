/**
 * Banda celeste VECTORIAL para la piel «shader» (tarea #73 EJE 1, punto 3 del
 * testigo): sol, fases lunares y remates `>`/`<` redibujados a resolución de
 * dispositivo, coherentes con el chrome vectorial (`chrome.ts`).
 *
 * Motivación: los glifos del cielo (sol = runa 0x2A ráfaga de 8 rayos; lunas =
 * runas 0x30-0x37, 8 fases) se pintan con la fuente RÚNICA, que NO pasa por el
 * sumidero de glifos HD (ese sólo instrumenta la IBM.CH). Por eso en la piel shader
 * el sol/lunas seguían llegando NEAREST vía el reblit de la franja — se veían los
 * píxeles (reporte del usuario «no se ha shader los lunas y soles»). Aquí se
 * redibujan como VECTOR PURO (discos/rayos/chevrones), la misma familia visual que
 * las esquinas redondeadas del marco. Colores EGA idénticos a la fiel (sol #FFFF55,
 * lunas blancas, remate blanco+azul de marco sobre negro).
 *
 * DECISIÓN (documentada): vector puro, NO pixel-art HD. Coherente con el chrome (que
 * ya es vector) y sin depender del atlas de runas HD (lote posterior del carril de
 * fuente). Cuando ese atlas exista, podría sustituir estos glifos por el mismo punto
 * de enchufe; hoy el vector da bordes limpios a cualquier escala sin licuar.
 */
import { SKY_CELLS, SKY_COL, SKY_ROW, SUN_GLYPH } from "../fiel/sky.js";
import type { SkyMark } from "../fiel/sky.js";
import { DEFAULT_FRAME_COLORS, type FrameColors } from "../fiel/frame.js";
import type { HdFont } from "./hdtext.js";

/** Color del sol (idx14 #FFFF55, atributo g_unk_13b8 del original). */
const SUN_COLOR = "#FFFF55";
/** Color de las lunas (blanco). CALCA A LA PIEL FIEL (`mark.isSun ? amarillo : blanco`),
 *  que es el PORT: a diferencia del sol de arriba, este blanco NO lleva atributo del
 *  original detrás. Espejo del port, no aserto de fidelidad. */
const MOON_COLOR = "#FFFFFF";
/** Fase base de las runas lunares (0x30 = fase 0). */
const MOON_PHASE_BASE = 0x30;

/** Dibuja un disco relleno. */
function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Sol vectorial: núcleo + ráfaga de 8 rayos (estrella de 16 vértices), calcando la
 * silueta de la runa 0x2A pero con trazo limpio. `x,y` = esquina de la celda (px de
 * dispositivo), `cell` = 8·escala.
 */
export function drawVectorSun(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  color: string = SUN_COLOR,
): void {
  const cx = x + cell / 2;
  const cy = y + cell / 2;
  const outer = cell * 0.48;
  const inner = cell * 0.2;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  // Núcleo sólido para que el sol no se vea hueco a escala grande.
  disc(ctx, cx, cy, cell * 0.24, color);
}

/**
 * Luna vectorial en la fase `phase` (0=nueva … 4=llena … 7=menguante fina). Se
 * rellena SÓLO la porción iluminada (el fondo negro de la banda hace de lado oscuro),
 * con el terminador como semi-elipse — técnica estándar de fase lunar. Menguantes =
 * espejo de crecientes.
 */
export function drawVectorMoon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  phase: number,
  color: string = MOON_COLOR,
): void {
  const p = ((phase % 8) + 8) % 8;
  if (p === 0) return; // luna nueva: nada iluminado (fondo negro).
  const cx = x + cell / 2;
  const cy = y + cell / 2;
  const r = cell * 0.42;
  const waxing = p <= 4;
  const eff = waxing ? p : 8 - p; // menguante 5/6/7 = espejo de creciente 3/2/1
  const cosA = Math.cos((Math.PI * eff) / 4); // eff1→.71  eff2→0  eff3→-.71  eff4→-1
  ctx.save();
  if (!waxing) {
    // Espejo horizontal para las fases menguantes (iluminadas por la izquierda).
    ctx.translate(cx, cy);
    ctx.scale(-1, 1);
    ctx.translate(-cx, -cy);
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false); // limbo derecho (iluminado)
  ctx.ellipse(cx, cy, Math.abs(r * cosA), r, 0, Math.PI / 2, -Math.PI / 2, cosA > 0);
  ctx.fill();
  ctx.restore();
}

/**
 * Radio de redondeo de la PUNTA del chevron (px lógicos de celda). Decisión del
 * usuario: en la piel shader los remates `<`/`>` son REDONDEADOS, no puntiagudos —
 * misma familia visual que las esquinas redondeadas del marco (fase 1). La fiel
 * conserva su remate bitmap con pico agudo.
 */
const NOTCH_TIP_R = 1.6;

/**
 * Remate `>`/`<` de banda vectorial (calco de `drawBandBracket`: chevron blanco +
 * relleno azul de marco sobre muesca negra) con la PUNTA REDONDEADA. `x,y` = esquina
 * de la celda; `mirror` dibuja el `<` de cierre. Primitiva COMPARTIDA: la usan la
 * banda celeste, la de vientos y las titlebars de la intro (mismo remate curvo).
 */
export function drawVectorNotch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  mirror: boolean,
  colors: FrameColors = DEFAULT_FRAME_COLORS,
): void {
  const u = cell / 8; // px de dispositivo por px lógico de la celda
  // Coordenada X local (0..8) con espejo opcional.
  const X = (lx: number): number => x + (mirror ? 8 - lx : lx) * u;
  const Y = (ly: number): number => y + ly * u;
  const tip = NOTCH_TIP_R * u; // radio de la punta en px de dispositivo
  // Muesca negra (7 px, respetando la col del borde del marco), como el original.
  ctx.fillStyle = colors.background;
  ctx.fillRect(mirror ? x : x + u, y, 7 * u, 8 * u);
  // Relleno azul del interior del chevron, con la punta redondeada (arcTo).
  ctx.fillStyle = colors.frame;
  ctx.beginPath();
  ctx.moveTo(X(1), Y(2));
  ctx.arcTo(X(4.9), Y(4), X(1), Y(6), tip);
  ctx.lineTo(X(1), Y(6));
  ctx.closePath();
  ctx.fill();
  // Filo blanco del chevron: trazo con junta/tope redondos y punta curvada (arcTo).
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = Math.max(1, u * 1.1);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(X(1), Y(1));
  ctx.arcTo(X(5.6), Y(4), X(1), Y(7), tip);
  ctx.lineTo(X(1), Y(7));
  ctx.stroke();
}

/**
 * Flecha de scroll (↑/↓/↕) del indicador del picker de (R)eady, VECTORIAL suave — misma
 * FAMILIA VISUAL que el sol/lunas de la banda celeste (relleno limpio anti-aliased, sin
 * píxel escalado). `glyph` = code CP437 que elige `readyArrowGlyph`: 0x18 ↑ (hay arriba),
 * 0x19 ↓ (hay abajo), 0x12 ↕ (ambos). `x,y` = esquina de la celda (px de dispositivo),
 * `cell` = 8·escala.
 *
 * FORMA FIEL AL GLIFO (testigo del usuario 2026-07-20, ORIG_3): el original NO es un
 * triángulo relleno sino la FLECHA CON ASTA de IBM.CH — cabeza (arrowhead) + asta fina.
 * Bitmap medido de `font-ibm.png` (8×8, cols del ancho de la celda):
 *   0x18 ↑: cabeza filas 0-2 (col más ancha 1-6), asta filas 3-6 (cols 3-4)
 *   0x19 ↓: asta filas 0-3 (cols 3-4), cabeza filas 4-6 (col más ancha 1-6), punta fila 6
 *   0x12 ↕: cabeza-arriba 0-2 + asta 3-4 + cabeza-abajo 5-7 (doble punta, silueta continua)
 * Se vectoriza esa silueta (semiancho cabeza HEAD=3 = cols 1..7, semiancho asta SHAFT=1 =
 * cols 3..5) como UN polígono relleno + trazado con juntas redondas → puntas suaves, no
 * cuadradas (misma asa que los remates de banda / el cursor de ola). La piel FIEL conserva
 * su bitmap; esto SÓLO lo repinta la shader sobre el blit nearest de la banda azul del
 * picker (ver `skin.ts`), como la banda celeste hace con sol/lunas.
 */
export function drawVectorScrollArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  glyph: number,
  color: string = MOON_COLOR,
): void {
  const u = cell / 8; // px de dispositivo por px lógico de la celda
  const cx = x + 4 * u; // eje vertical de la flecha (centro de la celda)
  const X = (lx: number): number => x + lx * u; // col lógica → px de dispositivo
  const Y = (ly: number): number => y + ly * u; // fila lógica → px de dispositivo
  const HEAD = 3; // semiancho de la cabeza (bitmap: cols 1..7)
  const SHAFT = 1; // semiancho del asta (bitmap: cols 3..5)
  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1, u * 0.7);
  ctx.beginPath();
  if (glyph === 0x12) {
    // ↕ ambos: doble punta unida por el asta central → una sola silueta continua (evita
    // que se lea como rombo: el asta fina delata que son DOS flechas encaradas).
    ctx.moveTo(cx, Y(0.6)); // punta arriba
    ctx.lineTo(X(4 + HEAD), Y(2.9)); // ala der arriba
    ctx.lineTo(X(4 + SHAFT), Y(2.9)); // asta sup der
    ctx.lineTo(X(4 + SHAFT), Y(5.1)); // asta inf der
    ctx.lineTo(X(4 + HEAD), Y(5.1)); // ala der abajo
    ctx.lineTo(cx, Y(7.4)); // punta abajo
    ctx.lineTo(X(4 - HEAD), Y(5.1)); // ala izq abajo
    ctx.lineTo(X(4 - SHAFT), Y(5.1)); // asta inf izq
    ctx.lineTo(X(4 - SHAFT), Y(2.9)); // asta sup izq
    ctx.lineTo(X(4 - HEAD), Y(2.9)); // ala izq arriba
  } else if (glyph === 0x19) {
    // ↓ abajo: asta arriba, cabeza+punta abajo.
    ctx.moveTo(X(4 - SHAFT), Y(0.7)); // asta sup izq
    ctx.lineTo(X(4 + SHAFT), Y(0.7)); // asta sup der
    ctx.lineTo(X(4 + SHAFT), Y(4.3)); // asta baja der (arranque de cabeza)
    ctx.lineTo(X(4 + HEAD), Y(4.3)); // ala der
    ctx.lineTo(cx, Y(7.3)); // punta
    ctx.lineTo(X(4 - HEAD), Y(4.3)); // ala izq
    ctx.lineTo(X(4 - SHAFT), Y(4.3)); // asta baja izq
  } else {
    // ↑ arriba (0x18 y default): punta+cabeza arriba, asta abajo.
    ctx.moveTo(cx, Y(0.7)); // punta
    ctx.lineTo(X(4 + HEAD), Y(3.0)); // ala der
    ctx.lineTo(X(4 + SHAFT), Y(3.0)); // asta sup der (arranque de asta)
    ctx.lineTo(X(4 + SHAFT), Y(7.3)); // asta baja der
    ctx.lineTo(X(4 - SHAFT), Y(7.3)); // asta baja izq
    ctx.lineTo(X(4 - SHAFT), Y(3.0)); // asta sup izq
    ctx.lineTo(X(4 - HEAD), Y(3.0)); // ala izq
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.imageSmoothingEnabled = prevSmooth;
}

/**
 * Bullet `►` de eco de consola VECTORIAL (veredicto #5: NOTCH, ALARGADO). Mismo trato de
 * notch que `drawVectorNotch` (relleno azul de marco + filo blanco sobre muesca negra,
 * punta redondeada) pero con la PROPORCIÓN del glifo bitmap original (IBM.CH 0x02): un
 * triángulo a TODO lo alto de la celda (~y0.5..7.5, no y1..7) con la punta más adelantada
 * (~x6.6 en vez de x5.6) → «un poco más largo, como el original» (petición del usuario). Se
 * separa de `drawVectorNotch` para NO tocar los remates ►◄ de las bandas cielo/vientos ni
 * los banners del panel (aprobados cortos). El fondo del log es negro → la muesca no molesta.
 */
export function drawVectorBulletNotch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  colors: FrameColors = DEFAULT_FRAME_COLORS,
): void {
  const u = cell / 8;
  const tip = NOTCH_TIP_R * u;
  // Muesca negra (borra el bitmap subyacente de la capa nearest).
  ctx.fillStyle = colors.background;
  ctx.fillRect(x + u, y, 7 * u, 8 * u);
  // Relleno azul del triángulo, a todo lo alto y con la punta adelantada.
  ctx.fillStyle = colors.frame;
  ctx.beginPath();
  ctx.moveTo(x + 1 * u, y + 1 * u);
  ctx.arcTo(x + 6.2 * u, y + 4 * u, x + 1 * u, y + 7 * u, tip);
  ctx.lineTo(x + 1 * u, y + 7 * u);
  ctx.closePath();
  ctx.fill();
  // Filo blanco (más alto y más puntiagudo que el remate de banda).
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = Math.max(1, u * 1.1);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 1 * u, y + 0.5 * u);
  ctx.arcTo(x + 6.6 * u, y + 4 * u, x + 1 * u, y + 7.5 * u, tip);
  ctx.lineTo(x + 1 * u, y + 7.5 * u);
  ctx.stroke();
}

/**
 * Pinta la banda celeste entera a escala `s`: ennegrece la ventana, dibuja sol/lunas
 * (de `marks`, derivados de `skyMarks` en la fiel) y los dos remates. Reemplaza al
 * reblit NEAREST de la franja del cielo en la piel shader. Puro salvo el `ctx`.
 */
export function drawVectorSkyBand(
  ctx: CanvasRenderingContext2D,
  s: number,
  marks: readonly SkyMark[],
  runes: HdFont | null = null,
  colors: FrameColors = DEFAULT_FRAME_COLORS,
): void {
  const cell = 8 * s;
  const y = SKY_ROW * 8 * s;
  // Ventana negra del cielo (SKY_COL..SKY_COL+SKY_CELLS), como la fiel.
  ctx.fillStyle = colors.background;
  ctx.fillRect(SKY_COL * cell, y, SKY_CELLS * cell, cell);
  // Sol / lunas: con el atlas RÚNICO HD (veredicto #18) se BLITEAN los glifos fieles
  // (sol 0x2A, fases lunares 0x30-0x37) tintados como la fiel; sin atlas → fallback al
  // dibujo VECTOR. Posición IDÉNTICA en ambos caminos (misma celda `gx,y`).
  if (runes) ctx.imageSmoothingEnabled = true;
  for (const m of marks) {
    const gx = (SKY_COL + m.cell) * cell;
    if (runes) {
      runes.drawGlyph(ctx, m.code, gx, y, cell, m.isSun ? SUN_COLOR : MOON_COLOR);
    } else if (m.isSun || m.code === SUN_GLYPH) {
      drawVectorSun(ctx, gx, y, cell);
    } else {
      drawVectorMoon(ctx, gx, y, cell, m.code - MOON_PHASE_BASE);
    }
  }
  if (runes) ctx.imageSmoothingEnabled = false;
  // Remates de la ventana (►◄), justo fuera de la banda de sol/lunas — SIEMPRE vector
  // (aprobados; el veredicto #18 sólo migra el sol y las fases lunares).
  drawVectorNotch(ctx, (SKY_COL - 1) * cell, y, cell, false, colors);
  drawVectorNotch(ctx, (SKY_COL + SKY_CELLS) * cell, y, cell, true, colors);
}
