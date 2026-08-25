/**
 * MAQUETA #23 — VARIANTE C: viste un popup del shell con los COMPONENTES DE BORDE del
 * UI original de 1988, para que parezca UNA VENTANA MÁS DEL JUEGO. Afinado C3 del usuario
 * (referencia: la banda de título `>Elegid:<` del picker de Ready):
 *
 *   1. El marco AZUL EGA lleva DOBLE FILO BLANCO — una línea blanca por FUERA y otra por
 *      DENTRO envolviendo la banda azul (frame.ts DEFAULT_FRAME_COLORS: frame #0000aa,
 *      border #ffffff = «regla interior blanca», píxel-diff). El azul recubre los 4 lados.
 *   2. Esquinas REDONDEADAS (el original ya redondea el marco azul con sus glifos de bisel
 *      0x7b/0x7c/0x7d; shader/chrome.ts OUTER_CORNER_R). Aquí: border-radius del marco.
 *   3. El título va en una BANDA NEGRA incrustada en el borde superior, con las muescas
 *      `>` `<` del juego = el REMATE de banda del Ready/Ztats (fiel skin.ts drawBandBracket
 *      / draw_box_edge 0x4c2a/0x4cce): glifo IBM.CH 0x02 ►/0x01 ◄ pero pintado como CHEVRON
 *      AZUL DE MARCO con FILO BLANCO sobre muesca negra (pixel-exact `BAND_BRACKET_BLUE/
 *      WHITE`), NO el triángulo blanco pelón del atlas. Mismo `>Elegid:<`.
 *   4. Cuerpo interior con el marco de PERGAMINO de rizos del picker (ztats.ts §4:
 *      0x10/0x13/0x14/0x16 esquinas, 0x11/0x15/0x17 aristas), 8×8, reverse-video, EGA.
 *
 * DOM puro: glifos de texto vía atlas `/assets/font-ibm.png` (como pixelfont.ts); los
 * remates ►◄ se pintan pixel-exact en un <canvas> 8×8 con `drawBandBracket`, el MISMO
 * pintor que usa el motor del juego (ver `skin/fiel/bandBracket.ts` y el docblock de
 * `bracketCanvas`). Overlay DETRÁS del contenido (primer hijo, z-index negativo); re-teje
 * con ResizeObserver.
 */
import { drawBandBracket } from "../../skin/fiel/bandBracket.js";

const CELL = 16; // 8px lógico × 2 (misma escala que pixelfont.ts)
const BORDER = 12; // grosor del marco azul perimetral (lados / abajo). Afinado C5: −3 (menos gordo)
// #279 — EL BORDE SUPERIOR DEL PANEL **ES** LA CINTA: exactamente una celda de alto, ni un
// píxel de chrome por encima ni por debajo. Valía 22 (una celda «centrada» con filo azul
// arriba y abajo), y esos dos filos son los que compraban los dos defectos del reporte —
// ver el docblock de `bandRule`, que lleva la medición.
const BAND_H = CELL; // alto del borde superior: LA CINTA, y nada más
const RADIUS = 8; // radio de esquina del marco azul (bisel del original). C5: −1 (marco más ceñido)

// Glifos del marco de pergamino (ztats.ts §4 — draw_list_frame 0x045e).
const BOX = {
  TL: 0x10, HTOP: 0x11, TR: 0x13, V: 0x17, BL: 0x14, HBOT: 0x15, BR: 0x16,
} as const;

const EGA_BLUE = "#0000aa";
const EGA_WHITE = "#ffffff";

// FILA DE LA CINTA: PEGADA AL BORDE DE ARRIBA (#279 — era `(BAND_H − CELL) / 2`, que la
// centraba en una banda más alta y dejaba filo azul a los dos lados). Sus reglas ocupan la
// fila lógica 0 y la 7 (2 px cada una = 1 px lógico × 2) y son, literalmente, los DOS FILOS
// DEL MARCO: la 0 es el borde exterior del panel y la 7 el interior. Ver `bandRule`.
const BAND_ROW_TOP = 0;
const RULE_PX = 2;

const STYLE_ID = "u5origframe-style";

/** Coloca el `background-position` de un glifo `code` (<0x80) en el atlas base. */
function placeGlyph(el: HTMLElement, code: number): void {
  const c = code & 0x7f;
  el.style.backgroundPosition = `-${(c % 16) * CELL}px -${Math.floor(c / 16) * CELL}px`;
}

/** Crea una celda-glifo (<i> aria-hidden) del atlas IBM.CH. */
function glyph(code: number): HTMLElement {
  const g = document.createElement("i");
  g.className = "u5of-g";
  g.setAttribute("aria-hidden", "true");
  placeGlyph(g, code);
  return g;
}

/**
 * Remate ►(0x02)/◄ pixel-exact en un canvas 8×8, pintado por el MISMO `drawBandBracket`
 * que usa el motor del juego para las bandas de cielo, vientos, mazmorra y ►HISTORY◄.
 * `mirror` = ◄. Escalado ×2 por CSS (`image-rendering: pixelated`).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * #263 (14-08) — SE COMPARTE EL PINTOR, Y ESO **RETIRA** LA SOLUCIÓN DE #245.
 * ══════════════════════════════════════════════════════════════════════════════════════
 * Aquí vivían una COPIA literal de los dos bitmaps, un pintor propio, un desplazamiento
 * `dx` de ±2 px («afinado C5») y —#245— dos reglas blancas de UNA CELDA de ancho en las
 * filas 0 y 7 del remate. Con eso el chevron quedaba flotando en mitad del azul: las dos
 * reglas empezaban y acababan dentro de su propia celda, sin nada a los lados que
 * continuar. Ése es el reporte del usuario («los corchetes no empalman con las líneas
 * horizontales de la banda») y su directriz: **«debería ser igual que hacemos el de los
 * winds del UI»**.
 *
 * QUÉ HACE WINDS, MEDIDO sobre el búfer nativo 320×200 (fila 23 = y 184..191, ►Calm
 * Winds◄ con el deep-link `?skin=faithful&loc=0&x=76&y=40&hour=10`):
 *   · y=184 (fila 0 de la banda): la regla blanca del MARCO corre x=7..48 — o sea entra en
 *     la celda del ► hasta su col BASE incluida — y vuelve a salir en x=151, la col base
 *     del ◄, hasta el borde derecho. Es una regla del ANCHO DEL MARCO, no del remate.
 *   · el NOTCH del remate (7 cols del lado interior) la ennegrece en su tramo, igual que la
 *     ventana negra del rótulo la ennegrece en el suyo.
 *   · el brazo del filo arranca en (49,185) / (150,185): diagonalmente PEGADO al final de
 *     la regla. De ahí la continuidad — no de que el remate traiga regla propia.
 *
 * ⇒ El reparto correcto es: **la regla es del MARCO y va de lado a lado; el remate aporta
 * el pico y el notch**. Por eso este canvas ya no pinta reglas (`bandRule` las pone
 * full-width) y por eso el `dx` de C5 desaparece: existía para pegar el filo blanco a una
 * muesca negra que el remate no ennegrecía; con `drawBandBracket` la muesca la abre el
 * propio remate y el filo queda pegado por construcción, sin desplazar nada.
 *
 * 🔴 LA MEDICIÓN QUE #245 CITÓ PARA DESCARTAR LA CINTA COMPLETA NO SE REFUTA: SE ESQUIVA.
 * Decía —y es cierto— que pasar la regla POR ENCIMA del rótulo lo decapita, porque las
 * letras usan la fila lógica 0 del pozo. Aquí la regla no cruza el rótulo: el pozo negro
 * la tapa en sus columnas, exactamente como la ventana negra de Winds tapa la del marco.
 * La cinta es completa DE LADO A LADO DE LA BANDA y sigue sin tocar una sola letra.
 */
function bracketCanvas(mirror: boolean): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = 8;
  cv.height = 8;
  cv.className = "u5of-brk";
  cv.setAttribute("aria-hidden", "true");
  const g = cv.getContext("2d");
  if (g) drawBandBracket(g, 0, 0, mirror);
  return cv;
}

/**
 * Una de las dos REGLAS de la cinta: línea blanca de lado a lado de la banda, en la fila
 * lógica 0 (`bottom=false`) o 7 (`bottom=true`) de la fila de glifos. Van DETRÁS del
 * contenido de la banda (orden en el DOM), así que el pozo negro del rótulo y el notch de
 * cada remate las interrumpen en sus columnas — que es lo que hace el marco del juego.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * #279 (14-08) — LAS DOS REGLAS **SON** LOS DOS FILOS DEL PANEL. NO HAY UN TERCERO.
 * ══════════════════════════════════════════════════════════════════════════════════════
 * El reporte del usuario traía dos defectos que aquí se ven como uno: por ARRIBA una doble
 * línea (el filo blanco del contenedor asomando sobre la cinta) y por ABAJO la banda azul
 * cortada en la esquina por otra horizontal. Medido con la sonda sobre el panel abierto,
 * el perfil vertical de los 22 px de cabecera tenía CUATRO blancos donde caben DOS:
 *
 *     y −2..0   BLANCO  filo exterior (box-shadow del host)   ┐ separados por 3 px de azul
 *     y  3..5   BLANCO  regla 0 de la cinta                   ┘ = la «doble línea» de arriba
 *     y 17..19  BLANCO  regla 7 de la cinta                   ┐ separados por 1 px de azul
 *     y 20..22  BLANCO  filo interior (box-shadow del cuerpo) ┘ = el «corte» de abajo, y
 *                       redondeado ⇒ en la esquina cruza la regla, que va a todo el ancho
 *
 * QUÉ HACE EL JUEGO, medido sobre el búfer nativo 320×200. Una cinta ocupa UNA fila de
 * glifo y su regla es la línea del marco que ya estaba ahí — nunca una línea de más:
 *   · ►Calm Winds◄ (fila 23 = y 184..191): la regla cae en la fila 0 de la banda porque
 *     y=184 es el borde INFERIOR de la caja del visor (`frame.ts` FRAME_SEGMENTS, el
 *     `point` de 6464: (7,184)→(184,184)). Debajo, hasta el canto de pantalla, azul liso:
 *     la banda NO trae una segunda regla.
 *   · ►HISTORY◄ (fila `CONSOLE_RECT.topRow − 1` = 10, y 80..87): el caso ESPEJO. Ahí el
 *     contenido está DEBAJO, así que la línea del marco es la de y=87 (el `point` de 648f)
 *     y le toca la fila 7 de la banda.
 * ⇒ la regla va SIEMPRE del lado por el que la banda toca al contenido, y es la del MARCO.
 *
 * El panel del shell es un caso con contenido A LOS DOS LADOS —fuera la página, dentro el
 * cuerpo negro—, así que le tocan las dos: la fila 0 es el filo EXTERIOR del panel y la 7
 * el INTERIOR. Por eso el arreglo no añade nada: RETIRA los dos duplicados. El filo blanco
 * del `box-shadow` del host se va (lo sustituye `.u5of-edge`, que no lleva borde superior
 * porque ese borde es esta regla), y la cinta se pega arriba (`BAND_ROW_TOP = 0`,
 * `BAND_H = CELL`) para que la regla 7 caiga EXACTAMENTE sobre el filo del cuerpo negro en
 * vez de 1 px por encima. Encima de la cinta no queda nada, y el marco de rizos nace
 * limpio debajo de una sola línea.
 *
 * 🔴 LA ESQUINA ERA LO QUE HACÍA VISIBLE EL DEFECTO DE ABAJO, y conviene decirlo porque el
 * síntoma no se parece a su causa: el filo del cuerpo es un `box-shadow` REDONDEADO que
 * empieza en `x = BORDER − 2`, mientras que la regla va de lado a lado. Con 1 px de azul
 * entre ambos, en las dos esquinas superiores la curva del cuerpo cruzaba la recta de la
 * cinta — que es exactamente «la banda azul se corta con otra línea horizontal en la
 * esquina» del reporte. Hoy coinciden al píxel y el cuerpo lleva las esquinas de ARRIBA
 * sin radio, para que el empalme sea recto contra recto.
 */
function bandRule(bottom: boolean): HTMLElement {
  const el = document.createElement("div");
  el.className = "u5of-rule";
  el.setAttribute("aria-hidden", "true");
  el.style.top = `${BAND_ROW_TOP + (bottom ? CELL - RULE_PX : 0)}px`;
  return el;
}

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

const CSS = `
/* HOST (popup variante C): AZUL EGA de fondo = marco perimetral; DOBLE FILO BLANCO (línea
   blanca fuera vía box-shadow + línea blanca dentro alrededor del cuerpo negro); esquinas
   REDONDEADAS. Conserva el telón. Oculta el chrome nativo (lo sustituye la banda). */
/* 🔴 F4 (auditoría UX) — EL CONTENIDO SE SALÍA DEL MARCO, y era ARITMÉTICA, no estilo.
   El relleno lateral valía BORDER + CELL = 28 px, que es exactamente donde EMPIEZA el
   filo interior de la columna de rizos… si la columna estuviese pegada al borde derecho.
   No lo estaba: buildFrame teselaba de IZQUIERDA a derecha con cols = floor(bw/CELL), así
   que el resto (bw módulo CELL) quedaba de hueco muerto A LA DERECHA y la última columna
   de rizos caía HACIA DENTRO esa misma cantidad. Con el panel a 420 px el resto son 12 px:
   el botón «Guardar» y el «Importar» de la esquina se comían el rizo. Se arregla en las
   DOS puntas — ahí abajo la tesela se ancla también a la derecha/abajo (y el resto se
   esconde en mitad de un tramo de línea, donde repetir un glifo idéntico no se ve) — y
   aquí sumando los 4 px de aire que los lados no tenían y el borde superior sí.
   (Y sin acentos graves AQUÍ DENTRO: esto vive en un template literal — uno suelto cierra
   la cadena y el fichero deja de compilar. Me pilló escribiendo este mismo bloque.) */
/* #279 — EL FILO BLANCO EXTERIOR YA NO ES UN ANILLO DEL HOST. Era un box-shadow de 2 px
   alrededor de los CUATRO lados, y el de arriba caia POR ENCIMA de la cinta: doble linea.
   Ahora el host solo pinta azul y el telon, y el filo lo pone .u5of-edge por tres lados —
   el cuarto, el de arriba, es la regla 0 de la propia cinta (ver bandRule). Las esquinas
   de ARRIBA pierden el radio a proposito: el borde superior es una recta, como en el
   marco del juego, y una recta no puede curvarse en la esquina sin dejar de empalmar con
   los filos laterales. */
.u5of-host{ border:0 !important; border-radius:0 0 ${RADIUS}px ${RADIUS}px !important;
  background:${EGA_BLUE} !important;
  box-shadow:0 0 0 100vmax rgba(0,0,0,.55) !important;
  padding:${BAND_H + CELL + 4}px ${BORDER + CELL + 4}px ${BORDER + CELL + 4}px !important; }
/* EL TÍTULO PROPIO DEL HUÉSPED SE RETIRA: lo sustituye la BANDA del marco, y dejar los dos
   lo pone DOS VECES (medido el 11-08 al montar el marco en la tarjeta de repeticiones —
   la banda decía «>Repeticiones<» y el h2 de la tarjeta repetía «Repeticiones» justo
   debajo). La lista es por huésped porque cada uno rotula con su propia clase. */
.u5of-host .save-title,
.u5of-host .u5-replay-h2,
.u5of-host .u5dbg-search{ display:none !important; }
/* 🔴 LA CABECERA DEL DRAWER SE DESVISTE — Y EL REQUISITO QUE SOBREVIVE ES «UNA SALIDA
   ROTULADA», NO «UN ✕ EN LA ESQUINA». Esta regla decía .u5of-host .u5dbg-head{display:none}
   y escondía la cabecera ENTERA: título, badge y **el botón de cerrar**. Con el marco puesto
   (que es el default, shellFrameC) el drawer se quedaba SIN NINGÚN CONTROL VISIBLE DE CIERRE.
   Se toleraba mientras el ☰ abría un popover con su «✗ Cerrar» rotulado; al jubilar ese
   popover (ficha #154) la única salida rotulada del shell desaparecía con él, y en un
   teléfono no hay Escape físico: quedaban el toque-fuera y volver a pulsar el ☰, dos
   convenciones que un lector de pantalla no anuncia. Lo cazó la suite móvil —
   mobile-geometry.spec.ts:475 con «element is not visible» sobre un nodo que SÍ existe —
   y de paso refutó la razón que yo mismo escribí al retirar el describe del touch-shellclose
   («el drawer ya tiene su ✕ rotulado»): lo tenía en el DOM y no en la pantalla.
   #263 (14-08): el usuario mandó QUITAR el botón de la esquina, y se ha quitado —
   closeButton:false en main.ts. El requisito de arriba NO se ha quitado con él: la salida
   rotulada es hoy la fila «Close menu» del propio drawer (sección shell-close de
   sections.ts), que hereda el mismo data-testid. Estas reglas se conservan porque la
   cabecera sigue existiendo (título y badge, ocultos) y porque el drawer QA de debug —que
   sí lleva su esc— comparte el motor.
   (Y sin acentos graves AQUÍ DENTRO: esto vive en un template literal y uno suelto cierra
   la cadena. Es el tercer aviso del mismo fichero y me pilló igual, escribiendo esto.) */
.u5of-host .u5dbg-head{ position:absolute !important; top:0; right:${BORDER}px; left:auto;
  height:${BAND_H}px; padding:0 !important; margin:0 !important; gap:0 !important;
  background:transparent !important; border:0 !important; z-index:2; }
.u5of-host .u5dbg-title,
.u5of-host .u5dbg-badge{ display:none !important; }
.u5of-host .u5dbg-close{ background:${EGA_BLUE} !important; color:${EGA_WHITE} !important;
  border:1px solid ${EGA_WHITE} !important; border-radius:0 !important;
  min-width:32px; min-height:${CELL + 4}px; line-height:1; padding:0 6px !important; }
.u5of-host .u5dbg-close:hover{ background:${EGA_WHITE} !important; color:${EGA_BLUE} !important; }
/* Overlay DETRÁS del contenido (z-index negativo): cuerpo negro + marco de pergamino + banda. */
/* 🔴 #162 — isolation:isolate NO ES DECORACIÓN: SIN ÉL EL MARCO ES INVISIBLE EN CUALQUIER
   HUÉSPED QUE NO SEA YA UN CONTEXTO DE APILADO. El overlay se pinta con z-index:-1, y un
   hijo negativo cae DETRÁS DEL FONDO DE SU PADRE cuando el padre NO abre contexto de
   apilado; sólo cuando el padre SÍ lo abre queda por delante del fondo y por detrás del
   contenido, que es lo que este marco quiere. Y el propio .u5of-host pinta un fondo OPACO
   (el azul EGA de unas líneas más arriba), así que «detrás del fondo» significa
   literalmente no verse.
   MEDIDO el 11-08 sobre los huéspedes, con captura de cada uno:
     · drawer SISTEMA          position:fixed z-index:99999 ⇒ contexto ⇒ marco VISIBLE
     · tarjeta de repeticiones position:relative z-index:auto ⇒ NO ⇒ azul liso, sin cuerpo
       negro ni rizos, AUNQUE la caja del cuerpo esté calculada al píxel.
   Ésa es la respuesta a la pregunta que el repliegue de F3 dejó abierta («no se ha
   localizado por qué esa tarjeta y no .save-panel»): no es la tarjeta, es que a ese huésped
   le faltaba el contexto. Se arregla AQUÍ y no en el CSS de cada panel porque el requisito
   lo impone el MARCO — un huésped nuevo no tiene por qué saberlo.
   ⚠ Y no vale diagnosticarlo con elementFromPoint: el overlay lleva pointer-events:none,
   así que NUNCA es el nodo devuelto, tenga el orden de pintado que tenga. Lo que discrimina
   es MIRAR LA CAPTURA — las cifras de la caja daban BIEN con el marco sin pintar.
   (Sin acentos graves aquí dentro: esto vive en un template literal, como avisa el bloque
   de F4 más arriba. Me pilló a mí también, con un 500 de vite.) */
.u5of-host{isolation:isolate;}
.u5of{position:absolute;inset:0;pointer-events:none;z-index:-1;}
/* #279 — FILO EXTERIOR del panel por TRES lados. Va DENTRO de la caja (inset:0) y no como
   sombra de fuera: asi ningun huesped con recorte propio puede comerselo, y el ancho del
   panel no cambia al montarlo. Sin borde superior: ese lado es la regla 0 de la cinta, que
   arranca en y=0 y por tanto REMATA los dos filos laterales sin dejar muesca en la esquina. */
.u5of-edge{position:absolute;inset:0;border:${RULE_PX}px solid ${EGA_WHITE};border-top:0;
  border-radius:0 0 ${RADIUS}px ${RADIUS}px;}
/* Cuerpo negro con FILO BLANCO INTERIOR (box-shadow). Esquinas de ARRIBA sin radio (#279):
   ese filo COINCIDE al pixel con la regla 7 de la cinta, y dos rectas empalman; con radio,
   la curva del cuerpo cruzaba la recta de la cinta y se veia como un corte en la esquina. */
.u5of-body{position:absolute;background:#000;
  border-radius:0 0 ${Math.max(2, RADIUS - 5)}px ${Math.max(2, RADIUS - 5)}px;
  box-shadow:0 0 0 ${RULE_PX}px ${EGA_WHITE};}
.u5of-g{position:absolute;width:${CELL}px;height:${CELL}px;
  background-image:url(/assets/font-ibm.png);background-size:${16 * CELL}px ${8 * CELL}px;
  background-repeat:no-repeat;image-rendering:pixelated;}
/* Banda del título (calco de «Calm Winds» / «>Elegid:<» del juego): los remates ►◄ van sobre
   la BARRA AZUL de cabecera (contenedor TRANSPARENTE → asoma el azul del host y el relleno
   azul del glifo se funde con la barra), flanqueando un POZO NEGRO sólo del ANCHO DEL TÍTULO.
   #279: la banda es UNA CELDA pegada al canto superior (top = BAND_ROW_TOP = 0) y esa celda
   ES el borde superior del marco — como la fila 23 del visor en Winds. El «filo azul fino
   arriba/abajo» del afinado C5 se retira: era el hueco por el que se colaban las dos lineas
   duplicadas del reporte. */
.u5of-band{position:absolute;top:${BAND_ROW_TOP}px;left:50%;transform:translateX(-50%);
  height:${CELL}px;padding:0;
  display:flex;align-items:center;gap:0;}
.u5of-band .u5of-g{position:static;}
.u5of-brk{width:${CELL}px;height:${CELL}px;image-rendering:pixelated;display:block;}
/* #263 — LAS DOS REGLAS DE LA CINTA, DE LADO A LADO DE LA BANDA (calco de Winds: la regla
   es del MARCO y el remate solo aporta pico y muesca; la medicion de la banda nativa esta
   en el docblock de bracketCanvas). Van ANTES que la banda en el DOM: el pozo negro del
   rotulo y el notch negro de cada remate las interrumpen en sus columnas, como hace la
   ventana negra del juego, asi que la regla NO cruza ninguna letra. */
.u5of-rule{position:absolute;left:0;right:0;height:${RULE_PX}px;background:${EGA_WHITE};}
/* Pozo NEGRO: sólo el título (el juego carva la barra azul justo bajo el texto). */
.u5of-title{display:flex;align-items:center;height:${CELL}px;background:#000;}
.u5of-title .u5of-g{position:static;}
`;

export interface OriginalFrameHandle {
  refresh(): void;
  dispose(): void;
}

/** Monta el marco original (variante C3) sobre `panel`. `titleText` se resuelve en cada
 *  refresh (i18n). El popup debe alojar un overlay `position:absolute` (lo son). */
export function mountOriginalFrame(
  panel: HTMLElement,
  titleText: () => string,
): OriginalFrameHandle {
  ensureStyle();
  panel.classList.add("u5of-host");

  const overlay = document.createElement("div");
  overlay.className = "u5of";
  overlay.setAttribute("data-testid", "u5-original-frame");

  const edge = document.createElement("div"); // filo blanco EXTERIOR (lados y fondo; arriba = la cinta)
  edge.className = "u5of-edge";
  const body = document.createElement("div"); // cuerpo negro incrustado (filo blanco interior)
  body.className = "u5of-body";
  const frame = document.createElement("div"); // rizos de pergamino
  frame.style.position = "absolute";
  frame.style.inset = "0";
  const band = document.createElement("div"); // banda negra del título con ►◄
  band.className = "u5of-band";

  // Las reglas van ANTES que la banda: la banda (pozo negro + notch de los remates) las
  // tapa en sus columnas y las deja corriendo por los dos flancos. Ver `bandRule`.
  // Y el filo exterior va ANTES que las reglas: la regla 0 lo remata por arriba (#279).
  overlay.append(edge, body, frame, bandRule(false), bandRule(true), band);
  panel.insertBefore(overlay, panel.firstChild);

  const setTitle = (): void => {
    band.replaceChildren();
    band.appendChild(bracketCanvas(false)); // ►
    const t = document.createElement("span");
    t.className = "u5of-title";
    for (const ch of titleText()) t.appendChild(glyph(ch.charCodeAt(0)));
    band.appendChild(t);
    band.appendChild(bracketCanvas(true)); // ◄
  };

  const buildFrame = (): void => {
    frame.replaceChildren();
    const w = panel.clientWidth;
    const h = panel.clientHeight;
    if (w < (BORDER + CELL) * 2 || h < BAND_H + BORDER + CELL * 2) return;
    const bx = BORDER;
    const by = BAND_H;
    const bw = w - BORDER * 2;
    const bh = h - BAND_H - BORDER;
    Object.assign(body.style, {
      left: `${bx}px`, top: `${by}px`, width: `${bw}px`, height: `${bh}px`,
    });
    // 🔴 TESELADO ANCLADO A LAS CUATRO ESQUINAS, en PÍXELES y no en índice de celda (F4).
    // Antes se recorría `cx = 0..cols-1` con `cols = floor(bw/CELL)` y la última columna
    // caía en `bx + (cols-1)*CELL` — o sea `bw mod CELL` píxeles ADENTRO del borde. Ese
    // resto (12 px con el panel a 420) es el hueco por el que el contenido se salía del
    // marco: el relleno del host lo calculaba como si el rizo estuviese pegado al borde.
    // Ahora las esquinas se colocan en `x1 = bw - CELL` / `y1 = bh - CELL` (flush), y el
    // resto se absorbe DENTRO de los tramos rectos: el último glifo de cada tramo se pega
    // a su esquina y se solapa con el penúltimo. Solapar es gratis y no se ve — HTOP/HBOT/V
    // son líneas repetidas idénticas; en las ESQUINAS no valdría (cada una es un glifo
    // distinto), y por eso son ellas las que se anclan y no los tramos.
    const put = (code: number, x: number, y: number): void => {
      const g = glyph(code);
      g.style.left = `${bx + x}px`;
      g.style.top = `${by + y}px`;
      frame.appendChild(g);
    };
    const x1 = bw - CELL;
    const y1 = bh - CELL;
    put(BOX.TL, 0, 0);
    put(BOX.TR, x1, 0);
    put(BOX.BL, 0, y1);
    put(BOX.BR, x1, y1);
    for (let x = CELL; x < x1; x += CELL) {
      const xc = Math.min(x, x1 - CELL); // el último tramo se pega a la esquina (solapa)
      put(BOX.HTOP, xc, 0);
      put(BOX.HBOT, xc, y1);
    }
    for (let y = CELL; y < y1; y += CELL) {
      const yc = Math.min(y, y1 - CELL);
      put(BOX.V, 0, yc);
      put(BOX.V, x1, yc);
    }
  };

  const rebuild = (): void => {
    setTitle();
    buildFrame();
  };

  const ro =
    typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => buildFrame()) : null;
  ro?.observe(panel);
  rebuild();

  return {
    refresh: rebuild,
    dispose: () => {
      ro?.disconnect();
      overlay.remove();
      panel.classList.remove("u5of-host");
    },
  };
}
