/**
 * LAYOUT de las 21 escenas de "The Summoning" (item G de fidelidad de intro).
 *
 * Derivado del brief `re/notes/summoning-scene-layout.md` (intro-reviewer, de las
 * tablas DATA.OVL marginL 0x2f98 / marginR 0x2fc2 / bandas 0x3040-56 / penY 0x3082
 * cruzadas con los frames `orig_E_*`). El MODELO REAL: el texto NO es un
 * rectángulo — se justifica en la banda `text` FLUYENDO ALREDEDOR del rectángulo
 * del cartón (`carton`). El port metía el texto en un rect sin evitar el cartón, y
 * su fallback DEGENERADO tiraba el texto de las escenas 8–12 a y≈136 ENCIMA de la
 * ilustración (bug duro, hallazgo B): la región real es full-width por ARRIBA.
 *
 * Las coords son la pantalla lógica EGA 320×200, bordes inclusivos como rects
 * `[x0,y0]..[x1,y1]`. La exclusión del cartón se aplica por línea (ver
 * `FaithfulProportFont.drawWrappedAround`): en las líneas cuyo Y intersecta el
 * cartón el texto ocupa sólo los segmentos a izquierda/derecha de él (de ahí el
 * "wrap" de las escenas 4/6/17/19, cuya banda de texto es full-width y el cartón
 * queda en medio). La geometría fina fila-a-fila = Clase C (píxel-diff #26).
 */

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface SummoningSceneLayout {
  /** Banda de texto (se justifica aquí, fluyendo alrededor de `carton`). */
  text: Rect;
  /** Rectángulo del cartón/ilustración a EVITAR (exclusión por línea). */
  carton: Rect;
  /** Texto FIJO de la escena (sólo la 6, "puerta azul" DATA.OVL type 3). */
  fixedText?: string;
}

/**
 * Tabla por escena 0..20. La banda de texto es la PANTALLA COMPLETA
 * `[2,2]..[318,198]`; el `carton` (arte) hace la posición vía la EXCLUSIÓN por línea
 * (drawWrappedAround) — el texto fluye por todo el hueco que deja la ilustración.
 *
 * CORRECCIÓN DE FIDELIDAD (carril intro-i18n, 2026-07-18): las bandas `text` previas
 * eran CAJAS PEQUEÑAS junto al arte y TRUNCABAN el texto de escena (16/21 desbordaban
 * ya en inglés). Derivado que el original NO pagina ni trunca por diseño — pinta el
 * registro STORY.DAT entero fluyendo por la pantalla alrededor del arte, con el ÚNICO
 * límite el clip a penY≥0xc0 (=192) del renderer:
 *   · ASM: `play_introduction` (INTRO.OVL 0x14e) lee el registro entero (0x0321
 *     `call 0xa3ae`), lo pinta de UNA vez (0x032b `call 0xfb26`) y espera UNA tecla por
 *     escena (0x0334-033c); no hay bucle de trozos.
 *   · ASM: `render_justified_text` (FONT.OVL 0x0000) NO tiene keypress/clear interno —
 *     sólo el clip `cmp [g_unk_5158],0xc0` (0x01c9/0x021f). No pagina.
 *   · EMPÍRICO: `orig_E_intro_shadowlords.png` (escena 10) = texto full-width arriba
 *     sobre el arte; `orig_E_intro_iolo_story.png` (escena 16) = 126 palabras COMPLETAS
 *     fluyendo full-width arriba → columna a la derecha del arte → full-width abajo.
 * El `drawWrappedAround` (flow-around) ya reproduce esto; sólo la región estaba mal.
 * Con pantalla-completa + el arte como exclusión, las 21 escenas caben (medidor
 * `game/tools/measure-summoning.mjs`) y el layout casa con los frames DOS. Los `carton`
 * (rects del arte, pixel-diff #26) se conservan.
 *
 * DOS RECTIFICACIONES A LA PANTALLA-COMPLETA (carril fix/intro-regions-es, 2026-07-19),
 * tras un testigo del usuario: bajo texto ES (más largo que el EN) el flujo desbordaba
 * ARTE que la exclusión no cubría. La región completa `y0=2` era correcta salvo dos
 * clases de escena, verificadas contra los frames DOS `orig_E_summoning_titlecard.png`
 * y `orig_E_intro_iolo_story.png`:
 *
 *   (1) ESCENAS-TÍTULO TYPE 1 (0/7/14): el original NO escribe NADA sobre el cartón
 *       gótico blackletter ("The Summoning/…") que ocupa la franja SUPERIOR-derecha —
 *       el texto arranca ENTERO por DEBAJO de él. El `y0=2` metía 2-3 líneas encima del
 *       título (colisión reportada). Fix: `text.y0` = PIE del cartón de título (bbox de
 *       `TITLE_FRAMES` × dims de `intro-pics.json`, cada subimg TEXT.16 = 32 px de alto):
 *       sc0 sub1 @(168,58)+32=90 · sc7 sub2 @(200,54)+32=86 · sc14 subs @(·,0)+32=32.
 *       El texto sigue fluyendo a columna derecha y full-width al pie (sin truncar).
 *
 *   (2) RETRATOS DE DOS CELDAS TYPE 4/5/6 (15-20, charla de Iolo): el `carton` cubría
 *       SÓLO la 1ª celda; la 2ª (`renderStoryScene`: subimg 2·type−5 a +`SECOND_CEL_DY`
 *       =55 px) quedaba SIN excluir y el texto ES la CRUZABA (colisión reportada). Como
 *       ambas celdas comparten rango-x (todas 141 px al mismo origen), basta EXTENDER
 *       `carton.y1` al pie de la 2ª celda (dims story6:2-7 de `intro-pics.json`). El
 *       texto fluye alrededor del retrato ENTERO — full-width arriba, columna al lado,
 *       full-width abajo — como en `orig_E_intro_iolo_story.png`.
 *
 * Ambas rectificaciones NO tocan el corpus ES ni el renderer; sólo las regiones/rects.
 * El medidor confirma 0/21 desbordes en EN y ES con el modelo nuevo.
 */
const FULL_SCREEN: Rect = { x0: 2, y0: 2, x1: 318, y1: 198 };
/** Región de escena-título: full-width pero arrancando bajo el cartón gótico (fix 1). */
const belowTitle = (y0: number): Rect => ({ x0: 2, y0, x1: 318, y1: 198 });
export const SUMMONING_LAYOUT: readonly SummoningSceneLayout[] = [
  { text: belowTitle(90), carton: { x0: 0, y0: 0, x1: 176, y1: 192 } }, // 0 título "The Summoning"
  { text: FULL_SCREEN, carton: { x0: 0, y0: 74, x1: 168, y1: 200 } }, // 1
  { text: FULL_SCREEN, carton: { x0: 136, y0: 0, x1: 320, y1: 131 } }, // 2
  { text: FULL_SCREEN, carton: { x0: 0, y0: 38, x1: 200, y1: 159 } }, // 3
  { text: FULL_SCREEN, carton: { x0: 152, y0: 76, x1: 320, y1: 200 } }, // 4 WRAP moongate
  { text: FULL_SCREEN, carton: { x0: 0, y0: 0, x1: 168, y1: 124 } }, // 5
  {
    text: FULL_SCREEN,
    carton: { x0: 72, y0: 38, x1: 240, y1: 162 }, // 6 WRAP puerta azul (texto fijo)
    fixedText:
      "Instantly, a shimmering blue door springs up! With heart beating rapidly, you step into it.",
  },
  { text: belowTitle(86), carton: { x0: 0, y0: 0, x1: 183, y1: 167 } }, // 7 título TEXT.16
  { text: FULL_SCREEN, carton: { x0: 0, y0: 90, x1: 320, y1: 200 } }, // 8
  { text: FULL_SCREEN, carton: { x0: 0, y0: 90, x1: 320, y1: 200 } }, // 9
  { text: FULL_SCREEN, carton: { x0: 0, y0: 90, x1: 320, y1: 200 } }, // 10 shadowlords
  { text: FULL_SCREEN, carton: { x0: 0, y0: 90, x1: 320, y1: 200 } }, // 11
  { text: FULL_SCREEN, carton: { x0: 0, y0: 90, x1: 320, y1: 200 } }, // 12
  { text: FULL_SCREEN, carton: { x0: 176, y0: 0, x1: 320, y1: 112 } }, // 13
  { text: belowTitle(32), carton: { x0: 0, y0: 0, x1: 176, y1: 113 } }, // 14 título TEXT.16
  { text: FULL_SCREEN, carton: { x0: 176, y0: 0, x1: 317, y1: 94 } }, // 15 +2ª celda (55→94)
  { text: FULL_SCREEN, carton: { x0: 0, y0: 46, x1: 141, y1: 140 } }, // 16 Iolo +2ª celda (101→140)
  { text: FULL_SCREEN, carton: { x0: 176, y0: 78, x1: 317, y1: 171 } }, // 17 WRAP +2ª celda (133→171)
  { text: FULL_SCREEN, carton: { x0: 0, y0: 0, x1: 141, y1: 94 } }, // 18 +2ª celda (55→94)
  { text: FULL_SCREEN, carton: { x0: 176, y0: 55, x1: 317, y1: 148 } }, // 19 WRAP +2ª celda (110→148)
  { text: FULL_SCREEN, carton: { x0: 0, y0: 87, x1: 141, y1: 181 } }, // 20 +2ª celda (142→181)
];

/** Layout de la escena `index` (0..20), o `undefined` fuera de rango. */
export function summoningLayout(index: number): SummoningSceneLayout | undefined {
  return SUMMONING_LAYOUT[index];
}

/** Un segmento horizontal disponible para texto en una línea. */
export interface Seg {
  x0: number;
  x1: number;
}

/**
 * Segmentos horizontales DISPONIBLES para la línea de texto que arranca en `yTop`
 * (alto `lineHeight`), dentro de `region`, EXCLUYENDO `carton`. Es el núcleo del
 * "fluir alrededor del cartón": si la banda vertical de la línea no toca el cartón
 * → un único segmento a todo el ancho de la región; si lo toca → los trozos a
 * izquierda/derecha del cartón (recortados a la región), descartando los más
 * estrechos que `minSeg`. Si el cartón tapa la banda entera → lista vacía. Puro.
 */
export function lineSegments(
  region: Rect,
  carton: Rect | null | undefined,
  yTop: number,
  lineHeight: number,
  minSeg: number,
): Seg[] {
  const hits = carton && yTop < carton.y1 && yTop + lineHeight > carton.y0;
  if (!hits) return [{ x0: region.x0, x1: region.x1 }];
  const segs: Seg[] = [];
  const leftX1 = Math.min(region.x1, carton!.x0);
  if (leftX1 - region.x0 >= minSeg) segs.push({ x0: region.x0, x1: leftX1 });
  const rightX0 = Math.max(region.x0, carton!.x1);
  if (region.x1 - rightX0 >= minSeg) segs.push({ x0: rightX0, x1: region.x1 });
  return segs;
}
