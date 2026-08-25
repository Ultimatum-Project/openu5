/**
 * RE-FLOW VERTICAL — descriptor de layout (PURO, sin DOM).
 *
 * Idea del usuario: en móvil VERTICAL el 320×200 de 1988 desperdicia pantalla porque
 * manda el ANCHO (viewport 11×11 a la izquierda + columna de panel a la derecha). El
 * re-flow re-COMPONE las MISMAS regiones del canvas fiel en una pila vertical:
 *
 *   ┌──────────────────────────────┐
 *   │ A1 CIELO   (sol · lunas ·►L8◄)│  ← fila 0 DEL MARCO
 *   │ ┌──────────────────────────┐ │
 *   │ │ A2 CAJA — VISOR 11×11    │ │  ← caja de borde (7,7)-(184,184)
 *   │ └──────────────────────────┘ │
 *   │ A3 VIENTOS (►East Winds◄)    │  ← fila 23 DEL MARCO
 *   ├───────────────┬──────────────┤
 *   │ B ROSTER+F/G  │ C CONSOLA/LOG│  ← las dos regiones que hoy van a la DERECHA
 *   └───────────────┴──────────────┘
 *
 * NO SE FABRICA UN PÍXEL: cada pane es un `drawImage` de un rect del canvas de la piel
 * FIEL (la fuente). Este módulo sólo dice DÓNDE va cada rect. Divergencia DECLARADA de
 * presentación (no comparable por pixel-diff), opt-in por bandera — ver
 * `docs/portrait-reflow-estudio.md`.
 *
 * INVARIANTE DE PRIMERA LÍNEA: el re-flow gana PÍXELES POR TILE (escala), **jamás
 * tiles**. `VIEW_WINDOW` = 11 es CONTRATO (`skin/api.ts` §decisión #5, espejado en
 * `core/world/visibility.ts` para el censurado de LOS/luz). Toda la rejilla se deriva de
 * `VIEWPORT`/`VIEW_WINDOW` IMPORTADOS de la fiel, nunca de constantes propias.
 *
 * HONESTIDAD DEL RÉGIMEN (riesgo dominante R1 del estudio): el re-flow invierte la
 * limitación (width-limited → height-limited). Con las barras del navegador puestas
 * PIERDE área en la mayoría de teléfonos. Por eso `portraitLayout` **elige**: si el
 * re-flow no supera al clásico devuelve `kind:"clasico"` y el pintado delega en el
 * letterbox de siempre. «Nunca peor» POR CONSTRUCCIÓN.
 */
import { FRAME_SEGMENTS, SCREEN_H, SCREEN_W, VIEWPORT } from "../fiel/frame.js";
import { VIEW_WINDOW } from "../api.js";

/** Rect en la FUENTE (canvas 320×200 de la piel fiel). */
export interface SrcRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** Rect fuente + su destino en el canvas visible del re-flow (px de backbuffer). */
export interface Pane extends SrcRect {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/** Los 6 panes del re-flow (la costura de la fila 10 va enrutada, ver §3.2 del estudio). */
export interface PortraitPanes {
  /**
   * BLOQUE DE CROMO COMPLETO del mapa (x0..190 × y0..191): las bandas AZULES laterales
   * (x0..6 a la izquierda, x185..190 el separador hacia el panel) + la caja + las filas
   * de HUD. Petición literal del usuario (26-07): «que el mapa esté todo enmarcado como
   * el original». Se pinta PRIMERO; `box`/`sky`/`winds` lo re-pintan alineados encima
   * (mismo contenido, mismas coordenadas: el solape es idéntico, no un doble-pintado
   * visible). `null` en la variante «banda», que recorta el cromo a propósito.
   */
  frame: Pane | null;
  /** Fila 0 del marco: sol + fases lunares · ►L8◄ del nivel de mazmorra. */
  sky: Pane;
  /** Caja de borde (7,7)-(184,184) = el VISOR 11×11 y todo lo que se pinte dentro. */
  box: Pane;
  /** Fila 23 del marco: ►East Winds◄ · ►Dir: East◄. */
  winds: Pane;
  /** Panel derecho filas 0..9: roster + comida/oro/fecha. */
  panel: Pane;
  /** Consola/log: `CONSOLE_RECT` filas 11..23. */
  log: Pane;
  /**
   * Costura de la fila 10 EN LA COLUMNA DEL PANEL (barra azul + ►↕◄ del picker de
   * Ready/Mix + último renglón de la lista de Ztats). `null` con el scrollback activo:
   * entonces esa fila es el banner ►HISTORY◄, que pertenece a la CONSOLA.
   */
  seamPanel: Pane | null;
  /**
   * Costura de la fila 10 EN LA COLUMNA DEL LOG (incluye la scanline y87 = filo blanco
   * superior de la consola; con scrollback activo, el banner ►HISTORY◄).
   */
  seamLog: Pane;
  /**
   * ESTIRAMIENTO de la caja de JUGADORES (directriz del usuario 01-08: «alargando en
   * altura la zona de jugadores y bajando por ende los KPIs»). Es UNA scanline INTERIOR
   * y en blanco de la caja del roster —la octava del último hueco de miembro, `sh:1`—
   * repetida `PANEL_STRETCH_ROWS` filas: el filo izquierdo, el interior negro, el filo
   * derecho y el margen azul son idénticos en toda la altura interior de la caja, así
   * que estirarla en Y es INOBSERVABLE (misma exención de isotropía, y por la misma
   * razón, que `panelFill`). No fabrica un píxel: es un `drawImage` de cromo real.
   * `null` fuera de la rama VERTICAL de la variante cuadrado — y también, desde la ficha
   * #244, **con el panel FUNDIDO por un overlay**: ahí la frontera y55|y56 en la que se
   * inserta no es un filo sino TEXTO de la lista, y las 24 filas pasan a `panelFill`
   * (azul, bajo el panel entero). Ver el bloque del estirado en `layout-cuadrado.ts`.
   */
  panelStretch: Pane | null;
  /**
   * Lo que va DEBAJO del estiramiento: filo inferior de la caja de jugadores + hueco
   * azul + caja de comida/oro/fecha (los KPIs), TRASLADADO `PANEL_STRETCH_ROWS` filas
   * hacia abajo. Mismo contenido y misma escala que antes — sólo cambia el destino.
   */
  panelBottom: Pane | null;
  /**
   * BANDA AZUL PERIMETRAL de la zona de jugadores/log (encargo del usuario 01-08: «que
   * la banda azul recubriese el ui de jugadores y kpis por la izquierda … y prueba si
   * tb por la derecha del log y abajo»). Son tres tiras de CROMO REAL (la banda lateral
   * azul del marco, x0..6) que continúan hacia abajo el marco del bloque de mapa. Su
   * grosor es el del marco (`CHROME_BAND_W · mapScale`) para que la línea azul del mapa
   * y la de la banda sean LA MISMA columna. `bandRight`/`bandBottom` sólo en la variante
   * COMPLETA (`?banda=full`); `bandLeft` es el defecto.
   */
  bandLeft: Pane | null;
  bandRight: Pane | null;
  bandBottom: Pane | null;
  /**
   * RELLENO AZUL bajo la columna de jugadores (spec del usuario 27-07, Pieza B): la
   * columna del panel (80+8=88 px fuente) es más corta que la del log (8+104=112) y el
   * usuario pidió que «lleguen hasta donde llega el log» y que la banda azul de debajo
   * NO desaparezca al activarse el scrollback (antes desaparecía: `seamPanel` se anula
   * porque su fila fuente pasa a ser el banner ►HISTORY◄, que pertenece al log). Este
   * pane cubre el hueco desde el fondo del panel (o de su costura, si está) hasta el
   * fondo del log, con una fuente SIEMPRE-AZUL de la banda lateral del cromo. Sólo en
   * la rama VERTICAL de la variante cuadrado; `null` en las demás.
   *
   * DESDE #244 tuvo un SEGUNDO trabajo con el panel FUNDIDO (las 24 filas del estirado
   * en azul, porque el cromo no puede ir ahí sin partir la lista) — y #380 (24-08) se
   * lo RETIRÓ salvo con historial: sin historial el bloque del modal se estira 14/11
   * (`MODAL_STRETCH_Y`) y llena la columna sin resto; con historial la fila 10 es del
   * banner, el modal visible son 80 filas estiradas y este azul cubre el resto
   * (112 − 80·14/11 = 112/11 filas) hasta el fondo.
   */
  panelFill: Pane | null;
  /**
   * FILO INFERIOR DE LOS KPIs prestado del divisor GEMELO (`SRC_PANEL_SEAM_TWIN`), para
   * la única situación en que la columna izquierda se queda sin él: el HISTORIAL abierto,
   * que convierte la fila fuente 80 en el rótulo ►HISTORY◄ y anula la costura. Se pinta
   * ENCIMA del relleno azul, en las 7 primeras scanlines de su hueco.
   *
   * `null` cuando no hace falta (sin scrollback la costura ya lo trae) **y cuando no se
   * puede**: con el panel FUNDIDO en una sola caja por un overlay (página de Ztats,
   * picker de Ready) el divisor ya no existe en el canvas y copiarlo pintaría negro donde
   * hoy hay azul — que es exactamente por lo que se descartó la vía de la fila 56 el
   * 01-08. Ver `HostableSkin.panelBoxesFused`.
   */
  panelEdge: Pane | null;
  /**
   * FILO DE CIERRE del bloque de costura en la columna de jugadores — «la línea blanca
   * inferior debajo de KPIs» del reporte del usuario del 03-08, que con el historial
   * abierto dejaba de pintarse. Va en la ÚLTIMA scanline del hueco, pegado por abajo a
   * `panelEdge` (que cubre las 7 primeras), y su fuente es una tira uniforme estirada
   * (`SRC_PANEL_EDGE_BOTTOM`) porque con el scrollback no queda en toda la fuente ni una
   * fila blanca de 129 px que copiar recta. Mismas condiciones que `panelEdge`: sólo con
   * el scrollback activo y sólo si el panel NO está fundido por un overlay.
   */
  panelEdgeBottom: Pane | null;
  /**
   * SUSTITUTO del contenido de `seamLog` cuando un OVERLAY funde el panel (#378, 24-08).
   *
   * EL DEFECTO QUE CIERRA. `seamLog` blitea la fila fuente 10 ENTERA en el techo de la
   * columna del log — correcto mientras esa fila sea cromo (barra azul + filo y87) o el
   * banner ►HISTORY◄ (que pertenece al log). Pero con el picker de Use/Ready abierto esa
   * fila es el INDICADOR DE SCROLL del overlay (►↕◄, pintado por el renderer del picker
   * en la fila 10): pertenece a la columna del PANEL (es el borde inferior del modal), y
   * blitearla también en el log pinta un SEGUNDO rombo encima de la cabecera del log —
   * el reporte del usuario del 24-08 (captura use-item-alto-flechas). La fila tiene dos
   * dueños según el modo (misma clase que #224/#246: y80 era del panel o del banner);
   * aquí el dueño es el OVERLAY y el log no debe verla.
   *
   * QUÉ SE PINTA EN SU LUGAR: lo que el log ve encima de sí en el original — margen azul
   * (7 scanlines, cromo uniforme estirado: misma exención que `panelFill`) y el filo
   * superior de la consola (`seamLogEdge`). Sólo con `panelBoxesFused` y SIN scrollback
   * (con el historial el banner es contenido legítimo del log y `seamLog` manda).
   */
  seamLogFill: Pane | null;
  /**
   * Filo blanco superior de la consola (la scanline y87) repuesto bajo `seamLogFill`.
   * Fuente: `SRC_SEAM_EDGE_BOTTOM` (tira uniforme del flanco de y87, ver allí por qué
   * una tira estirada y no la fila entera). `null` siempre que `seamLogFill` lo sea.
   */
  seamLogEdge: Pane | null;
}

export interface PortraitLayout {
  /** `reflow` = re-composición vertical; `clasico` = letterbox del 320×200 (delegación). */
  kind: "reflow" | "clasico";
  /** Tamaño del canvas visible (backbuffer y CSS coinciden: el re-flow no supersamplea). */
  canvasW: number;
  canvasH: number;
  /** Panes del re-flow. Presentes siempre (para el arnés), sólo se pintan si `kind==="reflow"`. */
  panes: PortraitPanes;
  /** Letterbox uniforme del 320×200 entero: modo clásico + bypass de pantalla completa. */
  full: Pane;
  /** Escala del pane de mapa (px de destino por px lógico horizontal). */
  mapScale: number;
  /** Escala COMÚN de la banda roster|log (comparten pitch de glifo: si no, chirría). */
  bandScale: number;
  /** Escala que tendría el layout CLÁSICO en el mismo hueco (el patrón de comparación). */
  classicScale: number;
  /** Área JUGABLE (el visor 11×11 real) en px² de pantalla con esta decisión. */
  playableArea: number;
  /** Área jugable que daría el clásico en el mismo hueco (para el informe/arnés). */
  classicPlayableArea: number;
  /** Estirado vertical aplicado (1,0 píxel cuadrado · 1,2 «época» 4:3). */
  aspectY: number;
  /**
   * ★ LA RAMA DE COMPOSICIÓN QUE SE TOMÓ DE VERDAD: `landscape` = banda AL LADO del mapa ·
   * `portrait` = banda DEBAJO. Se publica porque hasta el 28-07 no había forma de leerla y
   * el arnés dedujo la rama de la FORMA DEL HUECO (`__u5reflow.probe().gap`) — que dejó de
   * decidirla el 26-07, cuando la orientación del DISPOSITIVO pasó a mandar. Un carril
   * (landscape-28) llegó por esa vía a una causa FALSA («en el iPad 4:3 el cuadrado
   * compone en vertical»), y la medición de verdad decía otra cosa. Un descriptor que se
   * deduce puede deducirse mal; éste se declara.
   */
  gap: "portrait" | "landscape";
}

// ── RECTS FUENTE — derivados del marco fiel, NO re-derivados a mano ────────────────
//
// TRAMPA §3.1 del estudio: la región del mapa NO es el interior 176×176. Las bandas de
// HUD (sol/lunas, ►L8◄, ►East Winds◄, ►Dir:◄) viven en las filas 0 y 23 DEL MARCO. Con
// un solo blit de (8,8)-(183,183) desaparecen EN SILENCIO (sin error, sin test rojo).
// De ahí los TRES sub-blits del bloque de mapa.
//
// TRAMPA §3.3: el corte A|B no es limpio en x=192 — los filos IZQUIERDOS de las dos
// sub-cajas del panel y la «L» blanca de la consola se pintan en x=191. Los rects
// B/C/S arrancan en sx=191 (129 px de ancho, no 128).

/** Borde izquierdo de la caja del visor (`FRAME_SEGMENTS` 645c: x=7). */
const BOX_X = VIEWPORT.x - 1; // 7
/** Ancho de la caja del visor con sus dos filos: (7..184) = 178 px. */
export const BOX_W = VIEWPORT.tiles * VIEWPORT.tile + 2; // 178
/** Alto de la caja del visor con sus dos filos: (7..184) = 178 px. */
const BOX_H = BOX_W;
/** Alto de una fila de texto del original (celda 8×8). */
export const ROW = 8;
/** Columna donde arranca el panel derecho INCLUYENDO su filo blanco (§3.3). */
const PANEL_X = 191;
/** Ancho del panel derecho hasta el borde de pantalla: 191..319. */
export const PANEL_W = SCREEN_W - PANEL_X; // 129
/** Filas 0..9 del panel (roster + comida/oro/fecha). */
export const PANEL_H = 10 * ROW; // 80
/** Fila 10: la COSTURA compartida (barra azul + y87 = filo superior de la consola). */
const SEAM_Y = 10 * ROW; // 80
/** Primera scanline de la consola (`CONSOLE_RECT.topRow` = 11). */
const LOG_Y = 11 * ROW; // 88
/**
 * Alto de la consola: filas 11..**23** = 104 px. Las TRECE filas son el descriptor
 * literal del binario (`set_text_window(2, 0x18, 0x0b, 0x27, 0x17)`, INTRO.OVL:0x0d2e —
 * ver `CONSOLE_RECT` en fiel/skin.ts). Eran DOCE hasta la ficha #113 y con doce el
 * portrait recortaba justo la fila donde vive la LÍNEA DE ENTRADA (prompt ► + cursor),
 * que es la última. El lockstep con `CONSOLE_RECT` no depende de que nadie lo olvide:
 * `portrait-layout.test.ts` compara `SRC_LOG.sy+SRC_LOG.sh` contra `(botRow+1)*8` — fue
 * ese aserto el que cazó la divergencia al mover el rect.
 */
export const LOG_H = 13 * ROW; // 104
/**
 * Alto del bloque de mapa en la FUENTE: scanlines y0..y191 = 192 px. Es 192 y no 194
 * porque las bandas COMPARTEN scanline con la caja (y7 con la fila 0, y184 con la fila
 * 23): el mapeo es 1:1 y el solape se resuelve por ORDEN de pintado (caja → cielo →
 * vientos), igual que en el original el `fillRect` de la banda pisa el borde del visor.
 * Los 8 px de `y192..199` son negros y se descartan (no aportan nada en vertical).
 */
export const MAP_BLOCK_H = SCREEN_H - ROW; // 192

/**
 * Ancho del BLOQUE DE CROMO del mapa: x0..190. La columna x=191 pertenece al panel (sus
 * filos izquierdos se pintan ahí, §3.3), así que el cromo del mapa acaba en `PANEL_X`.
 * Incluye las bandas azules laterales: x0..6 (izquierda) y x185..190 (separador).
 */
export const FRAME_W = PANEL_X; // 191
/** Rect fuente del bloque de cromo COMPLETO del mapa (bandas azules incluidas). */
export const SRC_FRAME: SrcRect = { sx: 0, sy: 0, sw: FRAME_W, sh: MAP_BLOCK_H };

/** Rect fuente de la fila 0 del marco (cielo/►L8◄), a lo ancho de la caja del visor. */
export const SRC_SKY: SrcRect = { sx: BOX_X, sy: 0, sw: BOX_W, sh: ROW };
/** Rect fuente de la caja del visor (borde incluido) = el VISOR 11×11. */
export const SRC_BOX: SrcRect = { sx: BOX_X, sy: BOX_X, sw: BOX_W, sh: BOX_H };
/** Rect fuente de la fila 23 del marco (vientos/rumbo de mazmorra). */
export const SRC_WINDS: SrcRect = { sx: BOX_X, sy: BOX_X + BOX_H - 1, sw: BOX_W, sh: ROW };
/** Rect fuente del panel derecho, filas 0..9. */
export const SRC_PANEL: SrcRect = { sx: PANEL_X, sy: 0, sw: PANEL_W, sh: PANEL_H };
/** Rect fuente de la COSTURA (fila 10). */
export const SRC_SEAM: SrcRect = { sx: PANEL_X, sy: SEAM_Y, sw: PANEL_W, sh: ROW };
/** Rect fuente de la consola/log, filas 11..23. */
export const SRC_LOG: SrcRect = { sx: PANEL_X, sy: LOG_Y, sw: PANEL_W, sh: LOG_H };

/**
 * FILOS HORIZONTALES de las dos sub-cajas del panel (la de jugadores y la de
 * comida/oro/fecha), **leídos de `FRAME_SEGMENTS`** en vez de re-escritos a mano: son
 * sus segmentos horizontales, los que van de `PANEL_X` a x=312 (la «L» del panel, que
 * llega hasta el borde de pantalla x=319, queda fuera por eso). Salen `[7, 56, 63, 80]`
 * = techo y suelo de la caja de jugadores, techo y suelo de la de KPIs. Si el marco se
 * moviera, la partición del portrait se mueve con él.
 */
export const PANEL_BOX_EDGES: readonly number[] = [
  ...new Set(
    FRAME_SEGMENTS.filter(
      (s) =>
        s.y0 === s.y1 &&
        Math.min(s.x0, s.x1) === PANEL_X &&
        Math.max(s.x0, s.x1) > PANEL_X &&
        Math.max(s.x0, s.x1) < SCREEN_W - 1,
    ).map((s) => s.y0),
  ),
].sort((a, b) => a - b);

/** Filo INFERIOR de la caja de jugadores (`FRAME_SEGMENTS` 64b8: y=56). */
export const ROSTER_BOX_BOT = PANEL_BOX_EDGES[1]!;

/** Ancho fuente de la BANDA (dos panes de 129 px lado a lado). */
export const BAND_SRC_W = 2 * PANEL_W; // 258
/** Alto fuente de la banda: costura (8) + log (104) = 112 — el más alto de las dos columnas. */
export const BAND_SRC_H = ROW + LOG_H; // 112

/**
 * FILAS QUE CRECE LA CAJA DE JUGADORES (directriz del usuario 01-08). No es un número
 * elegido: es EXACTAMENTE el hueco que la columna del panel tenía de menos respecto de la
 * del log — el que hasta hoy se tapaba con relleno azul (Pieza B del 27-07). Al dárselo a
 * la caja de jugadores, la columna izquierda pasa a llenar la banda con CROMO en vez de
 * con un vacío azul, y los KPIs bajan con ella: `panel(80) + 24 + costura(8) = 112`.
 */
export const PANEL_STRETCH_ROWS = BAND_SRC_H - PANEL_H - ROW; // 24

/**
 * Scanline INTERIOR y en blanco de la caja de jugadores que se repite al estirarla.
 *
 * 🔴 «EN BLANCO» ES UNA PROPIEDAD DEL CONTENIDO, NO DE LA GEOMETRÍA — ficha #223. La
 * caja de jugadores mide 48 scanlines interiores (y8..55) y son EXACTAMENTE seis filas
 * de texto de 8; y55 es la última de la fila 6. Que esté en blanco es cierto mientras
 * ahí haya texto normal (el octavo renglón de un glifo es el hueco entre líneas), y
 * FALSO en cuanto esa fila va en VÍDEO INVERSO: entonces y55 es blanco macizo y las 24
 * réplicas lo convierten en una barra de 32 px = CUATRO renglones con el texto pegado
 * arriba. Medido el 13-08 en WebKit/iPhone (canvas 1170×1696, bandScale 1,456): la
 * inversión del picker de «Use item» con el cursor en la 5ª fila visible daba un bloque
 * blanco continuo de y1416 a y1556 = 140 px = 32 scanlines fuente, contra los 35 px de
 * un renglón. No es exclusivo del picker: la fila 6 del ROSTER en inverso (selección de
 * personaje, impacto, veneno de #213) cae en la misma scanline.
 * ⇒ La constante se queda como el ARRANQUE de la búsqueda; quien elige de verdad es
 * `stretchSourceRow`, que carea contra la fuente viva. Ver ahí.
 */
export const SRC_PANEL_STRETCH: SrcRect = {
  sx: PANEL_X,
  sy: ROSTER_BOX_BOT - 1,
  sw: PANEL_W,
  sh: 1,
};

/** Primera scanline INTERIOR de la caja de jugadores (bajo su filo superior, y7). */
export const ROSTER_BOX_INNER_TOP = PANEL_BOX_EDGES[0]! + 1; // 8

/**
 * ELIGE la scanline que replica el estirado, careándola contra la FUENTE VIVA.
 *
 * Se recorre la caja de jugadores de abajo arriba desde `SRC_PANEL_STRETCH.sy` y se
 * devuelve la PRIMERA cuya fracción de blanco no la delate como barra de vídeo inverso.
 *
 * EL UMBRAL NO ES UN TANTEO: las dos poblaciones están medidas sobre la fuente viva
 * (320×200, columnas x191..319 = 129) el 13-08, y no se tocan ni de lejos —
 *   · scanline en blanco (roster normal)        2 de 129 =  1,6 %  (los dos filos de caja)
 *   · scanline en blanco con el picker abierto  6 de 129 =  4,7 %  (+ filos del pergamino)
 *   · scanline bajo la barra de inverso       118 de 129 = 91,5 %
 * El 0,5 cae en el centro de un hueco de 87 puntos porcentuales. (Y es justo lo que le
 * faltó al `whiteRowInBlock` que se retiró el 03-08 de `skin.ts`: aquel exigía >60 % de
 * una población cuyo MÁXIMO real era 49,4 %, o sea un umbral inalcanzable por
 * construcción. Aquí las dos poblaciones están medidas ANTES de fijar el número.)
 *
 * `whiteFractionOf` devuelve `null` si la fuente no se puede leer; entonces se devuelve
 * el arranque, que es el comportamiento de siempre — fallo por el lado seguro.
 *
 * PURA a propósito (recibe el lector, no el canvas): así se prueba con testigo sintético
 * sin navegador, que es donde vive su guarda (`portrait-estirado.test.ts`).
 */
export function stretchSourceRow(
  whiteFractionOf: (sy: number) => number | null,
  maxWhite = 0.5,
): number {
  const syArranque = SRC_PANEL_STRETCH.sy;
  for (let sy = syArranque; sy >= ROSTER_BOX_INNER_TOP; sy--) {
    const f = whiteFractionOf(sy);
    if (f === null) return syArranque;
    if (f <= maxWhite) return sy;
  }
  return syArranque;
}

/**
 * LOS DOS TROZOS DE GEOMETRÍA QUE EL PORTRAIT AÑADE A LA COSTURA, en rects y puros.
 *
 * Viven aquí —y no en el pintor— para que se puedan asertar sin navegador: son la parte
 * del arreglo de #224/#225 que se puede escribir como cajas.
 */

/**
 * #224 — TRAMOS de la PRIMERA scanline fuente de `seamLog` que hay que tapar con el azul
 * del margen, porque ahí el portrait le entrega a la columna del log un filo que es de la
 * columna del panel (el inferior de la caja de KPIs, fuente y=80).
 *
 * `hueco` es el rango DESTINO que ocupa el banner ►HISTORY◄ (leído de la fuente por el
 * pintor) o `null` si no hay banner.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * RE-ADJUDICACIÓN DEL 13-08 — #246, y es DECISIÓN DEL USUARIO, no una deducción.
 * ══════════════════════════════════════════════════════════════════════════════════════
 * Hasta hoy: con banner se tapaban los FLANCOS y se dejaban intactas sólo las columnas del
 * RÓTULO. Eso dejaba la cinta del banner sin su regla superior, y el remate ◄ —que cuenta
 * con reglas en las filas 0 y 7 de su celda, ver `drawBandBracket` en `fiel/skin.ts`—
 * quedaba con el brazo de ARRIBA muriendo en el aire mientras el de abajo empalmaba con la
 * «L» de la consola. Ése es el reporte #246 («el < de HISTORY no es continuo con las
 * líneas de su cinta; el de Winds sí»), y está MEDIDO: en portrait el brazo superior no
 * tiene regla que continuar, y el MISMO banner en APAISADO empalma por los dos brazos.
 *
 * 🔴 LOS DOS REPORTES DEL USUARIO ESTABAN EN TENSIÓN, y por eso esto no se decide leyendo
 * código: #224 pidió quitar «la línea blanca extra encima del log» (y con el historial
 * abierto «se ve DOBLE»), y #246 pide que el remate empalme. Son LA MISMA scanline: no hay
 * recorte que dé una sin la otra. Escalado al usuario con las dos opciones el 13-08, ELIGIÓ
 * la cinta completa —«como Winds»—: con el historial ABIERTO la fila es del banner y lleva
 * SU regla, y el remate empalma por los dos brazos; SIN historial se sigue tapando entera,
 * que es el corazón de #224 y no se toca. **No lo deduzcas de nuevo ni lo «arregles» dentro
 * de un mes: está elegido con la tensión delante.**
 */
export function tramosFiloAjenoDelLog(
  seamLog: Pane,
  k: number,
  hueco: readonly [number, number] | null,
): { x: number; y: number; w: number; h: number }[] {
  // Con banner: la fila entera es de la cinta y lleva su regla (decisión del usuario 13-08,
  // #246). Sin banner: se tapa entera — el filo de KPIs es AJENO al log (#224).
  if (hueco !== null) return [];
  const h = (seamLog.dh / seamLog.sh) * k;
  const y = seamLog.dy * k;
  const x0 = seamLog.dx * k;
  const x1 = x0 + seamLog.dw * k;
  if (h <= 0 || x1 <= x0) return [];
  // Sin banner es UN tramo: la fila entera. (Los dos tramos de flancos que había aquí eran
  // la rama del banner, muerta desde la re-adjudicación de arriba: con banner no se tapa.)
  return [{ x: x0, y, w: x1 - x0, h }];
}

/**
 * #225 — TRAMO QUE LE FALTA al filo de cierre de la columna del panel para llegar al
 * borde izquierdo de la pantalla.
 *
 * EL DEFECTO (reporte del usuario 13-08, captura …9E3A9B52): «la línea blanca bajo el
 * panel de comida/oro no llega al límite izquierdo». La banda vive desplazada `insetL`
 * —la tira azul perimetral que continúa hacia abajo el flanco del bloque de mapa—, así
 * que su cromo arranca en `bandX` mientras el azul sí llega a 0. Medido el 13-08 en
 * WebKit/iPhone (canvas 1170): el filo de cierre corre x43…1169 y la tira azul x0…42.
 * Es el MISMO defecto que el usuario reportó el 02-08 para el separador del techo de la
 * banda («no llega hasta el límite de la izquierda») y que se arregló extendiéndolo al
 * ancho del lienzo; aquel era una línea PINTADA y ésta es cromo BLITEADO, y por eso se
 * quedó fuera.
 *
 * De qué pane sale el filo depende del scrollback, y por eso se pregunta por los panes y
 * no por el modo: sin historial es la última scanline de la costura (`seamPanel`); con
 * historial la costura se anula y el filo lo pone `panelEdgeBottom` (03-08). Con el panel
 * FUNDIDO por un overlay no hay ninguno de los dos —no hay filo que prolongar— y se
 * devuelve `null`: prolongar la nada dibujaría una línea que no existe.
 */
export function tramoFiloDeCierreAlBorde(
  panes: { seamPanel: Pane | null; panelEdgeBottom: Pane | null },
  k: number,
): { x: number; y: number; w: number; h: number } | null {
  const { seamPanel, panelEdgeBottom } = panes;
  let y: number;
  let h: number;
  let dx: number;
  // `panelEdgeBottom` MANDA cuando existe (#378, 24-08): es por construcción la última
  // scanline de la COLUMNA. Con #380 (mismo día) los dos panes vuelven a NO convivir —
  // fundido sin historial el estirado 14/11 lleva la costura al fondo de la columna y
  // el filo es `null` (el borde del modal ES el cierre, y se prolonga por la rama
  // `seamPanel`); fundido con historial no hay costura y decide el filo. El orden se
  // conserva por si un estado futuro los volviera a juntar.
  if (panelEdgeBottom) {
    h = panelEdgeBottom.dh / panelEdgeBottom.sh;
    y = panelEdgeBottom.dy;
    dx = panelEdgeBottom.dx;
  } else if (seamPanel) {
    h = seamPanel.dh / seamPanel.sh;
    y = seamPanel.dy + (seamPanel.sh - 1) * h;
    dx = seamPanel.dx;
  } else {
    return null;
  }
  const w = dx * k;
  if (w <= 0 || h <= 0) return null;
  return { x: 0, y: y * k, w, h: h * k };
}

/**
 * LA LÍNEA BLANCA DEL TECHO DE LA BANDA — dónde va y cuán gruesa es (#379, 24-08).
 *
 * EL DEFECTO QUE CIERRA («doble línea junto al rótulo HISTORIAL», reporte del 24-08,
 * captura historial-doble-linea). Dos decisiones correctas por separado componían mal:
 *   · el ruling del 03-08 pegó la línea al techo de la banda EN LOS DOS MODOS
 *     (`bandTop = techo − grosor`, o sea POR FUERA);
 *   · #246 (13-08, decisión del usuario) devolvió a la cinta del banner SU regla
 *     superior entera (la scanline y80 deja de taparse con banner).
 * Resultado con el historial abierto: separador (fuera) + regla de la cinta (primera
 * scanline) APILADOS = una línea de grosor doble sobre la columna del log, y sencilla
 * sobre la del panel — el escalón que el usuario ve como «doble línea». MEDIDO en la
 * reproducción del 24-08 (iPhone 15 390×844@3): blanco y1203..1209 (7 px = 3+4,37)
 * sobre el log contra y1203..1205 (3 px) sobre el panel.
 *
 * LA REGLA, que es la del PIE DEL MAPA desde el 27-07: cuando lo primero de la banda es
 * una CINTA CON REGLA (el banner), la línea SE SUPERPONE a esa regla — exactamente lo
 * que hace la línea del pie con la regla inferior de la cinta de Winds (`yBottom =
 * fondo − grosor`, DENTRO de la fila de vientos). Una cinta, una regla, una línea.
 * Sin banner no hay regla debajo (la primera scanline es margen azul en el panel y azul
 * tapado en el log, #224) y la línea sigue POR FUERA, pegada — el ruling del 03-08
 * intacto donde se dictó.
 *
 * El invariante del 01-08 («la línea acaba EN el techo de la banda, nunca dentro») nació
 * de que la línea DECAPITABA los glifos del banner; el hueco del banner (03-08) ya los
 * salta, y la superposición es scanline-exacta con su regla: no pisa contenido. Con
 * banner la línea mide UNA scanline fuente bliteada (`seamLog.dh/sh`), no el redondeo
 * `round(bandScale)`: así coincide con la regla al píxel y no asoma por debajo.
 *
 * PURA a propósito (rects + banderas, sin canvas): su guarda vive en
 * `portrait-separadores.test.ts`. Devuelve `null` cuando no hay hueco de separación
 * (p. ej. composición apaisada), que es cuando la línea nunca se pintó.
 */
export function lineaTechoBanda(
  panes: { panel: Pane; seamLog: Pane; winds: Pane },
  bandScale: number,
  k: number,
  hayBanner: boolean,
): { y: number; h: number } | null {
  const techo = Math.min(panes.panel.dy, panes.seamLog.dy) * k;
  const gap = Math.max(0, techo - (panes.winds.dy + panes.winds.dh) * k);
  if (gap <= 0) return null;
  if (hayBanner) {
    return { y: techo, h: (panes.seamLog.dh / panes.seamLog.sh) * k };
  }
  const h = Math.min(Math.max(1, Math.round(bandScale)) * k, gap);
  return { y: techo - h, h };
}

/** Filo SUPERIOR de la caja de KPIs (`FRAME_SEGMENTS` 64d6: y=63). */
export const KPI_BOX_TOP = PANEL_BOX_EDGES[2]!;

/**
 * BLOQUE GEMELO DE LA COSTURA (carril `filo-kpis`, 02-08) — la fuente del filo inferior
 * de la caja de KPIs cuando el HISTORIAL se lleva la fila que lo lleva de verdad.
 *
 * EL PROBLEMA. En la columna izquierda, el filo inferior de los KPIs es la scanline 80,
 * la PRIMERA de la costura (fila 10). Con el scrollback activo esa fila pasa a ser el
 * rótulo ►HISTORY◄ —que pertenece al log—, `seamPanel` se anula (correctamente) y la
 * columna se queda sin filo: bajo la fecha se pasa directo al azul.
 *
 * LA FUENTE, Y POR QUÉ ÉSTA. El DIVISOR entre las dos sub-cajas del panel —el bloque
 * y56..62: filo inferior del roster + las seis scanlines de barra azul— es **byte a byte
 * el mismo dibujo** que las siete primeras de la costura (y80..86). Medido, no supuesto:
 * censo de la columna x191..319 en mundo · mazmorra · combate · Ztats(selección) →
 * `re/notes/filo-kpis-acta.md` §2. Un solo `drawImage` de cromo REAL y contiguo; no se
 * fabrica un píxel, ni se estira nada (escala idéntica al resto de la banda).
 *
 * POR QUÉ SIETE Y NO OCHO. La octava scanline del divisor (y63, el filo SUPERIOR de los
 * KPIs) llega hasta x=312, y la octava de la costura (y87, la «L» de la consola) hasta
 * x=319. NO son el mismo dibujo, así que ese renglón se deja al relleno azul: preferimos
 * la fila que hoy ya está azul a una línea nueva con una muesca de 7 px.
 * 🔴 ESA PREFERENCIA LA DEROGÓ EL USUARIO el 03-08 («la línea blanca inferior debajo de
 * KPIs desaparece»): la fila que se dejaba azul ES la que él echa en falta. La cubre
 * ahora `SRC_PANEL_EDGE_BOTTOM`, y sin muesca — ver ahí por qué.
 */
export const SRC_PANEL_SEAM_TWIN: SrcRect = {
  sx: PANEL_X,
  sy: ROSTER_BOX_BOT,
  sw: PANEL_W,
  sh: KPI_BOX_TOP - ROSTER_BOX_BOT, // 7 — el divisor SIN su filo de cierre
};

/**
 * FILO DE CIERRE del bloque de costura en la columna de jugadores — la OCTAVA scanline,
 * la que `SRC_PANEL_SEAM_TWIN` deja fuera a propósito.
 *
 * EL REPORTE (usuario, 03-08): «mira estas dos cuando se activa historial, **la línea
 * blanca inferior debajo de KPIs desaparece**». Es la scanline y87 (la «L» de la consola,
 * x191..319), que la columna izquierda pinta al fondo vía `seamPanel`; con el scrollback
 * esa fila es el banner ►HISTORY◄, `seamPanel` se anula, y ahí no queda NADA blanco.
 * Adjudicado midiendo el canvas compuesto: no la tapa nada ni se sale del recorte — deja
 * de pintarse (iPhone 15: 573 px blancos en la última fila del lienzo → 0).
 *
 * POR QUÉ UNA TIRA ESTIRADA Y NO EL FILO DE 122 px. Censo de la FUENTE con el historial
 * ABIERTO (320×200, `tools/linea-banda/`): **CERO** filas del frame entero conservan una
 * tira blanca de 129 px. La única que la tenía es justo la que el banner destruye (y87:
 * 191…320 → 295…320). Lo que SÍ sobrevive son los filos de las sub-cajas del panel —y56 y
 * y63, tira MACIZA 191…313, 122 px—, o sea exactamente la «muesca de 7 px» que el 02-08
 * descartó. Así que copiar un filo entero devuelve la línea CON la muesca, y encima
 * cambiando de ancho al abrir el historial.
 * Se toma en cambio un trozo INTERIOR de ese filo (4 px, lejos de los dos extremos, dentro
 * de un tramo medido MACIZO de 122) y se estira al ancho de la columna: al ser color
 * uniforme el estirado es INOBSERVABLE —misma exención, y por la misma razón, que
 * `panelFill` y `SRC_CHROME_BLUE`— y el resultado es idéntico al que se ve con el
 * historial cerrado, sin muesca y sin cambio de ancho. No inventa una línea que el
 * original no pinte: la repone donde el original SÍ la pinta.
 */
export const SRC_PANEL_EDGE_BOTTOM: SrcRect = {
  // A media distancia entre `PANEL_X`(191) y la «L» del panel (312): el tramo macizo
  // medido va de 191 a 313, así que 251..254 está holgadamente dentro por los dos lados.
  sx: PANEL_X + 60,
  sy: ROSTER_BOX_BOT,
  sw: 4,
  sh: 1,
};

/**
 * TIRA UNIFORME de la ÚLTIMA scanline de la costura (y87, el filo blanco superior de la
 * consola / borde inferior del bloque de fila 10) — la fuente de blanco que SÍ sobrevive
 * con el panel FUNDIDO por un overlay (#378, 24-08), que es justo el estado en que
 * `SRC_PANEL_EDGE_BOTTOM` no vale (su y56 pasa a ser TEXTO de la lista).
 *
 * POR QUÉ ESTE FLANCO. La scanline y87 lleva blanco x191..319 en reposo, y sus únicos
 * agujeros posibles son VENTANAS CENTRADAS: el ►↕◄ del picker (medido el 24-08 en vivo:
 * ventana ≈ x244..268) y el banner ►HISTORY◄/►HISTORIAL◄ (x208..296 con el rótulo
 * español, el más ancho). El tramo x200..203 queda fuera de las dos por construcción
 * (toda ventana se centra en la columna x191..319 y ninguna llega a 100 px de semiancho)
 * y lejos de la esquina x191. Misma exención de estirado-inobservable que
 * `SRC_PANEL_EDGE_BOTTOM`: color uniforme, 4 px lejos de los extremos.
 */
export const SRC_SEAM_EDGE_BOTTOM: SrcRect = {
  sx: PANEL_X + 9,
  sy: SEAM_Y + ROW - 1,
  sw: 4,
  sh: 1,
};

/**
 * Ancho de la BANDA AZUL lateral del marco (x0..6): el visor arranca en x=7, así que la
 * banda mide justo eso. Es el grosor que debe tener la tira perimetral de la zona de
 * jugadores/log para continuar la del mapa sin escalón.
 */
export const CHROME_BAND_W = BOX_X; // 7

/**
 * Trozo SIEMPRE-AZUL de la banda lateral del cromo, fuente de las tiras perimetrales.
 * Mismo criterio que `SRC_PANEL_FILL` (layout-cuadrado): x0..6 es azul macizo en mundo,
 * mazmorra y combate, y las fases de endgame van por el bypass de pantalla completa.
 */
export const SRC_CHROME_BLUE: SrcRect = { sx: 0, sy: 96, sw: CHROME_BAND_W, sh: ROW };

/**
 * Tope de la escala de la banda. `sb = 2` ⇒ pitch de glifo 16 px: legible de sobra en
 * teléfono y, en TABLET, evita que la banda robe 385 px de alto con glifos de 32 px
 * (§5.5 del estudio: sin cap, iPad Pro se queda en ×1,05; con cap, ×1,78).
 */
export const SB_CAP = 2.0;

/** Lado jugable en px lógicos: 11 tiles × 16 px. Derivado, nunca constante propia. */
export const PLAYABLE_SIDE = VIEWPORT.tiles * VIEWPORT.tile; // 176

export function pane(src: SrcRect, dx: number, dy: number, dw: number, dh: number): Pane {
  return { ...src, dx, dy, dw, dh };
}

/**
 * Escala del layout CLÁSICO en un hueco dado — CALCO de `mobileCanvasSize`
 * (`fiel/skin.ts`): fracción que llena preservando el ratio 320×(200·a).
 */
export function classicFitScale(availW: number, availH: number, aspectY: number): number {
  return Math.max(0, Math.min(availW / SCREEN_W, availH / (SCREEN_H * aspectY)));
}

/**
 * Escala del pane de MAPA bajo re-flow. El mapa se lleva todo el ancho; el alto que
 * queda es `availH − bandH`. Recortar a 178 px de ancho (en vez del bloque de 192 del
 * cromo) sube la escala un 8 % ⇒ **+16 % de área** donde manda el ancho: la barra
 * izquierda y la columna separadora en el re-flow no separan nada.
 */
export function reflowMapScale(
  availW: number,
  availH: number,
  aspectY: number,
  bandScale: number,
): number {
  const bandH = BAND_SRC_H * bandScale * aspectY;
  const rest = Math.max(0, availH - bandH);
  return Math.max(0, Math.min(availW / BOX_W, rest / (MAP_BLOCK_H * aspectY)));
}

/**
 * Escala COMÚN de la banda (roster y log comparten pitch de glifo: si no, chirría).
 *
 * REPARTO DEL ALTO — el trade real del re-flow. Cada píxel de banda sale del mapa, así
 * que la banda NO se lleva todo el ancho a ciegas: se le da el tamaño MÁS GRANDE que
 * todavía deja el mapa limitado por el ANCHO (o sea, «mapa a todo el ancho», que es
 * literalmente lo que pidió el usuario), acotado entre dos límites honestos:
 *
 *   TECHO  `min(availW/258, cap)` — llenar el ancho con las dos columnas; el `cap` evita
 *          que en tablet la banda robe 385 px de alto con glifos de 32 px (§5.5).
 *   SUELO  la escala del layout CLÁSICO — **el log nunca sale más pequeño que hoy**. Si
 *          el cap muerde por debajo del suelo (tablet), manda el cap: decisión
 *          deliberada a favor del mapa.
 */
export function reflowBandScale(
  availW: number,
  availH: number,
  aspectY = 1,
  cap = SB_CAP,
): number {
  const W = Math.max(0, availW);
  const H = Math.max(0, availH);
  const a = aspectY > 0 ? aspectY : 1;
  const hi = Math.max(0, Math.min(W / BAND_SRC_W, cap));
  const lo = Math.min(classicFitScale(W, H, a), hi);
  // sb que hace al mapa EXACTAMENTE width-limited: 192·a·(W/178) + 104·sb·a = H.
  const needed = (H / a - MAP_BLOCK_H * (W / BOX_W)) / BAND_SRC_H;
  return Math.max(lo, Math.min(hi, needed));
}

/**
 * ¿Supera el re-flow al clásico en ÁREA JUGABLE en este hueco? Como el área jugable es
 * `(176·s)·(176·s·a)` en ambos layouts, la comparación se reduce a comparar escalas.
 *
 * Umbral cerrado equivalente (verificado en unit): el re-flow gana ⟺
 * `Hav > a·(0,6·W + 104·sb)` mientras el mapa sea height-limited — 0,6 = 192/320 (el
 * bloque de mapa relativo al ancho de pantalla) y 104·sb = el alto de la banda.
 */
export function reflowWins(
  availW: number,
  availH: number,
  aspectY: number,
  cap = SB_CAP,
): boolean {
  const sb = reflowBandScale(availW, availH, aspectY, cap);
  return reflowMapScale(availW, availH, aspectY, sb) > classicFitScale(availW, availH, aspectY);
}

/**
 * Descriptor completo del layout vertical. `availW`/`availH` = hueco REAL disponible
 * (el contenedor ya excluye la botonera: `--u5-touch-reserve` de `ui/touch.ts`).
 *
 * `opts.force`: `"reflow"` fuerza la re-composición aunque pierda área (para medir y
 * capturar), `"clasico"` la desactiva. Sin `force` decide el umbral.
 * `opts.consoleScrollActive`: enruta la costura de la fila 10 (§3.2).
 */
export function portraitLayout(
  availW: number,
  availH: number,
  aspectY = 1,
  opts?: { bandPitchCap?: number; consoleScrollActive?: boolean; force?: "reflow" | "clasico" },
): PortraitLayout {
  const cap = opts?.bandPitchCap ?? SB_CAP;
  const W = Math.max(0, availW);
  const H = Math.max(0, availH);
  const sb = reflowBandScale(W, H, aspectY, cap);
  const sa = reflowMapScale(W, H, aspectY, sb);
  const sc = classicFitScale(W, H, aspectY);
  const kind: "reflow" | "clasico" =
    opts?.force === "reflow" ? "reflow"
    : opts?.force === "clasico" ? "clasico"
    : sa > sc ? "reflow"
    : "clasico";

  // ── Geometría del re-flow ────────────────────────────────────────────────────────
  const mapW = BOX_W * sa;
  const ky = sa * aspectY; // px de destino por scanline lógica
  const skyH = ROW * ky;
  const boxH = BOX_H * ky;
  const mapH = MAP_BLOCK_H * ky;
  const bandW = BAND_SRC_W * sb;
  const bandH = BAND_SRC_H * sb * aspectY;
  const seamH = ROW * sb * aspectY;
  const panelH = PANEL_H * sb * aspectY;
  const logH = LOG_H * sb * aspectY;

  const canvasW = kind === "reflow" ? Math.max(mapW, bandW) : W;
  const canvasH = kind === "reflow" ? mapH + bandH : H;

  const mapX = (canvasW - mapW) / 2;
  const bandX = (canvasW - bandW) / 2;
  const paneW = PANEL_W * sb;
  const logX = bandX + paneW;
  const bandY = mapH;

  // ORDEN DE PINTADO A2 → A1 → A3: las bandas solapan las scanlines y7/y184 y deben
  // GANARLAS, igual que en el original el `fillRect` de la banda pisa el borde del visor.
  const panes: PortraitPanes = {
    frame: null,
    box: pane(SRC_BOX, mapX, SRC_BOX.sy * ky, mapW, boxH),
    sky: pane(SRC_SKY, mapX, 0, mapW, skyH),
    winds: pane(SRC_WINDS, mapX, SRC_WINDS.sy * ky, mapW, skyH),
    panel: pane(SRC_PANEL, bandX, bandY, paneW, panelH),
    // La costura va a la columna del PANEL salvo con el scrollback activo (entonces esa
    // fila es el banner ►HISTORY◄ y pertenece a la consola: §3.2).
    seamPanel: opts?.consoleScrollActive
      ? null
      : pane(SRC_SEAM, bandX, bandY + panelH, paneW, seamH),
    // En la columna del LOG la costura va SIEMPRE: su scanline y87 es el filo blanco
    // superior de la consola (y con scrollback, el banner ►HISTORY◄).
    seamLog: pane(SRC_SEAM, logX, bandY, paneW, seamH),
    log: pane(SRC_LOG, logX, bandY + seamH, paneW, logH),
    panelFill: null, // sólo la variante cuadrado lo usa (spec 27-07)
    panelEdge: null, // ídem: el filo prestado es de la variante cuadrado (02-08)
    panelEdgeBottom: null, // ídem: el filo de cierre es de la variante cuadrado (03-08)
    // ídem: el sustituto de la costura del log con overlay (#378) es de la variante
    // cuadrado — esta variante (banda, legacy) conserva su conducta anterior.
    seamLogFill: null,
    seamLogEdge: null,
    // Las tres piezas del 01-08 (estirado de jugadores + banda azul perimetral) son de la
    // variante CUADRADO, que es la que el usuario tiene delante desde el GO del portrait.
    panelStretch: null,
    panelBottom: null,
    bandLeft: null,
    bandRight: null,
    bandBottom: null,
  };

  // Letterbox uniforme del 320×200 entero (modo clásico y bypass de pantalla completa).
  const fs = classicFitScale(canvasW, canvasH, aspectY);
  const fullW = SCREEN_W * fs;
  const fullH = SCREEN_H * fs * aspectY;
  const full = pane(
    { sx: 0, sy: 0, sw: SCREEN_W, sh: SCREEN_H },
    (canvasW - fullW) / 2,
    (canvasH - fullH) / 2,
    fullW,
    fullH,
  );

  const playable = (s: number): number => PLAYABLE_SIDE * s * (PLAYABLE_SIDE * s * aspectY);

  return {
    kind,
    canvasW,
    canvasH,
    panes,
    full,
    mapScale: sa,
    bandScale: sb,
    classicScale: sc,
    playableArea: playable(kind === "reflow" ? sa : sc),
    classicPlayableArea: playable(sc),
    aspectY,
    // El layout de la variante BANDA compone siempre mapa-arriba/banda-abajo.
    gap: "portrait",
  };
}

/** Guarda viva del invariante: la ventana lógica NO se toca jamás. */
export const REFLOW_VIEW_WINDOW = VIEW_WINDOW;
