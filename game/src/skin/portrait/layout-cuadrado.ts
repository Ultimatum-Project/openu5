/**
 * VARIANTE «CUADRADO» del re-flow — descriptor de layout (PURO, sin DOM).
 *
 * PETICIÓN LITERAL DEL USUARIO (2026-07-25): «Quiero ver prototipo de Re-flow + botonera a
 * ancho completo real. En general quiero que siempre el view del mapa sea cuadrado como en
 * original.» Esta variante monta las dos cosas a la vez y las mide contra el canónico:
 *
 *   1. VISOR CUADRADO SIEMPRE — el 11×11 sale en pantalla como un CUADRADO GEOMÉTRICO en
 *      cualquier tamaño y en las DOS orientaciones, «tan grande como quepa». Se consigue
 *      con escala ISÓTROPA (sx == sy) en el bloque de mapa: la caja fuente ya es 178×178,
 *      así que basta con NO estirar. Ver `INVARIANTE DEL CUADRADO` más abajo.
 *   2. BOTONERA A ANCHO COMPLETO — no vive aquí (es CSS del deck: `deck-ancho.ts`), pero es
 *      la mitad que hace que el número salga: el re-flow es HEIGHT-limited y cada píxel de
 *      botonera sale del mapa (hallazgo medido del carril, commit eee6eb96).
 *   3. APAISADO DE VERDAD — el re-flow original apila SIEMPRE en vertical, así que en
 *      apaisado el umbral honesto cae a `clasico` y no hay variante que enseñar. Aquí el
 *      apaisado tiene su propia rama: mapa cuadrado a la izquierda llenando el ALTO, banda
 *      roster+log en UNA columna a la derecha.
 *
 * INVARIANTE DEL CUADRADO. `aspectY` se IGNORA a propósito: el estirado 1:1,2 de época es
 * un rasgo de la piel fiel en escritorio (píxel de CRT no cuadrado), y es justo lo que el
 * usuario dice que NO quiere en el mapa. En esta variante el píxel es cuadrado en TODOS los
 * panes — mapa y banda —, para no mezclar dos retículas en la misma pantalla. La guarda
 * viva está en `tests/portrait-cuadrado.test.ts` (ratio dh/sh ÷ dw/sw == 1 en los 6 panes,
 * en las dos orientaciones y en los 7 dispositivos del censo).
 *
 * NO FABRICA UN PÍXEL: igual que la variante «banda», cada pane es un `drawImage` de un
 * rect del canvas de la piel FIEL. Cero líneas en `skin/fiel/`.
 */
import { SCREEN_H, SCREEN_W } from "../fiel/frame.js";
import {
  BAND_SRC_H,
  BAND_SRC_W,
  BOX_W,
  CHROME_BAND_W,
  FRAME_W,
  LOG_H,
  MAP_BLOCK_H,
  PANEL_H,
  PANEL_STRETCH_ROWS,
  PANEL_W,
  PLAYABLE_SIDE,
  ROSTER_BOX_BOT,
  ROW,
  SB_CAP,
  SRC_BOX,
  SRC_CHROME_BLUE,
  SRC_FRAME,
  SRC_LOG,
  SRC_PANEL,
  SRC_PANEL_EDGE_BOTTOM,
  SRC_PANEL_SEAM_TWIN,
  SRC_PANEL_STRETCH,
  SRC_SEAM,
  SRC_SEAM_EDGE_BOTTOM,
  SRC_SKY,
  SRC_WINDS,
  classicFitScale,
  pane,
  type Pane,
  type PortraitLayout,
  type PortraitPanes,
  type SrcRect,
} from "./layout.js";

/** Alto fuente de la banda APILADA (apaisado): panel 80 + costura 8 + log 104 = 192. */
export const BAND_STACK_H = PANEL_H + ROW + LOG_H; // 192

/**
 * ESTIRADO VERTICAL del BLOQUE DEL MODAL con el panel fundido — #380 (24-08).
 *
 * EL REPORTE (usuario, iPhone portrait dividido, captura use-item-alto-2): tras #378 el
 * modal de «Use item» cierra pegado a su contenido, y debajo queda una banda azul
 * grande sin usar mientras la lista scrollea con 7 filas — «el listado no ocupa todo el
 * alto, y supongo que en más funciones (Ready)».
 *
 * LA GEOMETRÍA. El modal de 1988 mide 88 scanlines (filas 0..10: panel 80 + su borde ↕
 * en la costura) y no se le fabrica NI UN píxel de contenido. La columna, en cambio,
 * mide `BAND_SRC_H` = 112 (se la fija la columna del log, al lado): 24 filas de hueco
 * que #378 dejó en azul neutro. La vía fiel de aprovecharlas es ESCALAR el bloque
 * ENTERO — mismo mecanismo que el mapa de esta piel (`drawImage` con factor FRACCIONAL:
 * `sa = W/FRAME_W`, `sb = W'/258`; nada de múltiplos enteros) — y el factor no se
 * elige, SE DERIVA: 112/88 = 14/11 ≈ 1,273, el único que deja la columna cuadrando
 * exacta (88 · 14/11 = 112, sin resto que rellenar).
 *
 * POR QUÉ SÓLO EN VERTICAL, y por qué el eje Y SOLO (exención DECLARADA de la
 * isotropía, la clase de `panelFill`/`panelStretch` pero con motivo propio):
 *   · el hueco de 24 filas EXISTE sólo aquí — en apaisado la columna es única y la
 *     fila 10 va en su sitio del original; en el clásico el modal vive en su columna
 *     de 200 con la consola debajo, como en 1988;
 *   · la única dimensión con hueco es el ALTO. Escalar isótropo (×14/11 también en X)
 *     haría la columna del modal 164 px fuente de ancho: o pisa la columna del log o
 *     obliga a re-escalar el log a la baja (~12 %) y a re-fluir la banda entera (y el
 *     deck con ella) en CADA apertura — contra el suelo «el log nunca sale más pequeño»
 *     y moviendo los botones bajo el dedo del jugador;
 *   · el estirado vertical de texto tiene precedente en la propia piel fiel: el modo
 *     «época» estira 320×200 a 1:1,2 (píxel de CRT). Esto es 1:1,273 sobre el bloque
 *     del modal, con el MISMO mecanismo (un `drawImage`).
 * Aplica a la CLASE fundida entera (censo del tren #123: picker de Use/Ready/Mix,
 * páginas de Ztats, posada — todo lo que pone `panelKind === "full"`).
 *
 * Con el HISTORIAL abierto a la vez, la fila 10 es del banner (la costura se anula) y
 * el modal visible son 80 filas: se conserva el MISMO factor —el bloque no cambia de
 * tamaño al abrir/cerrar el historial— y el resto (112 − 80·14/11 ≈ 10,2 filas) queda
 * en azul, rematado por el filo de cierre, como hasta hoy.
 */
export const MODAL_STRETCH_Y = BAND_SRC_H / (PANEL_H + ROW); // 112/88 = 14/11

/**
 * Rect fuente SIEMPRE-AZUL para el relleno bajo los jugadores (Pieza B, 27-07): un trozo
 * de la BANDA LATERAL IZQUIERDA del cromo (x0..6 es azul macizo en mundo, mazmorra y
 * combate; las fases de endgame van por el bypass de pantalla completa y no pintan
 * panes). Se toma x1..4 — lejos de los glifos de esquina (filas 0/23) y del filo blanco
 * de la caja (x7) — a media altura. NO fabrica píxel: es un `drawImage` de cromo real;
 * al ser color uniforme, estirarlo al ancho de la columna es INOBSERVABLE (por eso este
 * pane queda fuera de la guarda de isotropía, con la exención declarada en el test).
 */
export const SRC_PANEL_FILL: SrcRect = { sx: 1, sy: 96, sw: 4, sh: 8 };

/**
 * SEPARACIÓN entre el bloque de mapa y la banda de jugadores/log, en PÍXELES DE JUEGO
 * (petición del usuario 26-07: «separadas unos píxeles»). Va en unidades del original y no
 * en px CSS a propósito: escalado con el mapa, el hueco se ve igual de grueso en un SE que
 * en un Pro Max, y no queda una rendija fina entre píxeles gordos.
 *
 * DE 2 A 6 (02-08, petición del usuario: «en portrait separaría un poco más el ui de arriba
 * del bloque de jugadores y logs»). Los 2 originales eran «el grosor del filo de una caja
 * del marco», y por eso el hueco «pertenecía» al chrome — pero MEDIDO en el canvas compuesto
 * de un iPhone 15 ese hueco daba 4,1 px CSS de los que las DOS líneas separadoras se comían
 * 3, dejando 1,1 px CSS de negro: a la vista, las dos líneas y la banda son un solo bloque
 * pegado al mapa. Con 6 px de juego el hueco pasa a 12,3 px CSS y quedan ~9 de negro entre
 * las líneas, que es lo que separa de verdad los dos bloques.
 * SIGUE SIENDO UNA UNIDAD DEL ORIGINAL y no un número CSS: 6 < 8 = la altura de una fila de
 * texto, o sea que el hueco no llega a valer un renglón. Lo que cuesta es alto de canvas
 * (4 px de juego · mapScale ≈ 8 px CSS en un teléfono), que sale del presupuesto del deck
 * —no del visor 11×11, cuya escala en vertical es W/FRAME_W y no depende del alto.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 6 → 5 (03-08, petición del usuario: «la separación entre ambas vertical redúcela también
 * un pelín»). Y el número NO es el suelo geométrico, a propósito.
 * ══════════════════════════════════════════════════════════════════════════════════════
 * MEDIDO el 03-08 sobre el censo, con la condición que el hueco tiene que cumplir —cabe la
 * línea `B` MÁS 1 px de negro por lado, `hueco > grosor + 2`—:
 *
 *   dispositivo    mapScale  grosor  hueco@6  margen   SEP_GAP mínimo viable
 *   iPhone SE        1,963      2      23,6    19,6           1,02
 *   iPhone 15        2,058      3      37,0    32,0           0,81
 *   Pixel 7          2,157      6      38,8    30,8           1,24   ← el que ata
 *   Pro Max          2,251      6      40,5    32,5           1,18
 *   iPad mini        3,895      4      46,7    40,7           0,77
 *   iPad Pro         5,361      4      64,3    58,3           0,56
 *
 * ⇒ **EL SUELO ES 2, y a 1 el Pixel 7 pierde el hueco.** No es una estimación: lo localiza
 * `portrait-separadores.test.ts` sobre el parámetro, NOMBRANDO la geometría que rompe. (Y el
 * modelo con el que se localiza —hueco = `SEP_GAP_PX · mapScale · dpr`— se valida antes
 * contra el layout real, para no estar probando aritmética en vez del reparto.)
 *
 * ⚠ Ese suelo NO se podía medir hasta hoy: la comprobación geométrica vivía DETRÁS de un
 * `expect(SEP_GAP_PX).toBe(...)` en el mismo `it`, así que bajar el valor para tantear hacía
 * fallar el pin PRIMERO y la comprobación no llegaba a correr. Se separaron.
 *
 * ⇒ Cabría bajarlo hasta 2. No se hace, y la razón es la que manda:
 * 🔴 **LA RESTRICCIÓN QUE ATA NO ES LA GEOMETRÍA, ES SU PROPIA PETICIÓN ANTERIOR.** El 6
 * salió de que él pidió el 02-08 *«en portrait separaría un poco más el ui de arriba del
 * bloque de jugadores y logs»* — subiéndolo DE 2. Bajarlo al suelo geométrico sería volver
 * exactamente al estado que él nos pidió arreglar hace un día, con la excusa de que «cabe».
 * «Un pelín» se implementa como un pelín: **6 → 5**, que libera `mapScale·dpr` ≈ 6 px de
 * dispositivo para el deck en un iPhone 15 y conserva el hueco que él pidió.
 *
 * ⚠ Y ESTO NO ARREGLA LOS BOTONES CORTADOS — va desacoplado a propósito. Aquello era un
 * RESTO del scroller (`alto % paso`), y bajar el gap sólo cambia el resto a otro valor: haría
 * falta un delta distinto por dispositivo. Lo arregla `deck-ancho.ts:instalaTiraDeMediaFila`.
 * Si algún día alguien vuelve aquí buscando alto para el deck: **este número no es la palanca
 * de los botones**, y bajarlo más deshace una petición explícita del usuario.
 */
export const SEP_GAP_PX = 5;

/**
 * BANDA AZUL PERIMETRAL de la zona de jugadores/log — encargo del usuario del 01-08:
 * «que la banda azul recubriese el ui de jugadores y kpis por la izquierda, y prueba si
 * tb por la derecha del log y abajo, para que quede bien».
 *
 *   `izq`  — sólo la tira IZQUIERDA (la DIRECTRIZ, y el defecto).
 *   `full` — izquierda + derecha del log + abajo (la variante que se le enseña para elegir).
 *   `off`  — como antes del 01-08 (para carear y para el control negativo de los tests).
 *
 * El grosor es `CHROME_BAND_W · mapScale`, o sea EL MISMO que la banda lateral del bloque
 * de mapa: las dos son la misma columna de píxeles y la línea azul baja sin escalón. El
 * precio se paga en la BANDA, no en el mapa: `mapScale` en vertical es `W/FRAME_W` y no
 * depende de esto, así que el visor 11×11 no pierde ni un píxel — lo que encoge es el
 * pitch de glifo del roster/log, y cuánto está medido en el acta del carril.
 */
export type BandaMode = "off" | "izq" | "full";

/** Mitad superior del panel: margen azul + caja de JUGADORES hasta su última fila interior. */
const SRC_PANEL_TOP: SrcRect = { ...SRC_PANEL, sh: ROSTER_BOX_BOT };
/** Mitad inferior: filo de la caja de jugadores + hueco + caja de KPIs (sin su filo). */
const SRC_PANEL_BOT: SrcRect = {
  ...SRC_PANEL,
  sy: ROSTER_BOX_BOT,
  sh: PANEL_H - ROSTER_BOX_BOT,
};

/** ¿Este hueco es apaisado? FALLBACK por forma del hueco — pero desde el 26-07 la
 *  ORIENTACIÓN DEL DISPOSITIVO manda cuando se conoce (`opts.orient`): la captura real
 *  demostró que en un móvil VERTICAL con la botonera reservada el hueco queda APAISADO
 *  (360×320 tras 420 px de deck) y este criterio elegía la rama lateral — justo lo
 *  contrario de la spec del usuario («arriba el mapa ocupando siempre todo el ancho en
 *  portrait … lo de abajo se puede hacer scroll»). El hueco solo decide sin dato mejor. */
export function isLandscapeGap(availW: number, availH: number): boolean {
  return availW > availH;
}

/**
 * Escala de la banda en VERTICAL — REFINAMIENTO DEL USUARIO (26-07): «las dos piezas
 * debajo ocupando siempre todo el ancho … y que tengan el alto original». O sea:
 * proporción ORIGINAL (isótropa) con el ancho mandando — la banda NO absorbe el alto
 * sobrante ni se comprime para que quepa la botonera: si abajo no cabe, ABAJO SE
 * SCROLLEA («lo de abajo se puede hacer scroll como ahora»). Único techo: el cap de
 * pitch (en teléfono, W<516, no muerde; en tablet evita glifos de cartel).
 */


export function squareBandScalePortrait(availW: number, _availH: number, cap = SB_CAP): number {
  return Math.max(0, Math.min(Math.max(0, availW) / BAND_SRC_W, cap));
}

/**
 * Escala de la banda en APAISADO. La columna es ÚNICA (129 px de fuente) y va a la derecha:
 * el reparto ya no es de ALTO sino de ANCHO. Se le da lo que sobra tras dejar al mapa
 * llenando el alto, con el mismo SUELO honesto (nunca por debajo del pitch clásico) y el
 * mismo TECHO de pitch (`SB_CAP`), más un techo nuevo: la columna no puede ser más alta
 * que el hueco (184·sb ≤ H) o el log se saldría de pantalla.
 */
export function squareBandScaleLandscape(availW: number, availH: number, cap = SB_CAP): number {
  const W = Math.max(0, availW);
  const H = Math.max(0, availH);
  const hi = Math.max(0, Math.min(H / BAND_STACK_H, W / PANEL_W, cap));
  const lo = Math.min(classicFitScale(W, H, 1), hi);
  // Ancho que sobra si el mapa ENMARCADO llena el ALTO (el mapa es lo primero: es el
  // «view», y desde el 26-07 va con su cromo completo — FRAME_W, no BOX_W).
  const spare = (W - FRAME_W * (H / MAP_BLOCK_H)) / PANEL_W;
  return Math.max(lo, Math.min(hi, spare));
}

/**
 * Descriptor de la variante CUADRADO. Devuelve el MISMO `PortraitLayout` que la variante
 * «banda» (mismo hit-test, mismo pintor, mismo arnés): lo único que cambia es DÓNDE cae
 * cada rect y la promesa de isotropía.
 *
 * `opts.force`: `"reflow"` re-compone aunque pierda área (para medir y capturar),
 * `"clasico"` delega en el letterbox. Sin `force` decide el área jugable, igual que la
 * variante «banda»: **nunca peor** por construcción.
 */
export function squareLayout(
  availW: number,
  availH: number,
  opts?: {
    bandPitchCap?: number;
    consoleScrollActive?: boolean;
    force?: "reflow" | "clasico";
    /** Orientación del DISPOSITIVO. Cuando se conoce, MANDA sobre la forma del hueco. */
    orient?: "portrait" | "landscape";
    /** Banda azul perimetral de la zona de jugadores/log (01-08). Defecto: `izq`. */
    banda?: BandaMode;
    /**
     * ¿El panel está FUNDIDO en una sola caja por un overlay (página de Ztats, picker de
     * Ready)? Lo publica la piel alojada (`HostableSkin.panelBoxesFused`), que es quien
     * pinta. Si lo está, el divisor gemelo del que se toma prestado el filo inferior de
     * los KPIs ya no existe en el canvas y NO se presta nada (02-08).
     */
    panelBoxesFused?: boolean;
  },
): PortraitLayout {
  const cap = opts?.bandPitchCap ?? SB_CAP;
  const W = Math.max(0, availW);
  const H = Math.max(0, availH);
  const landscape = opts?.orient ? opts.orient === "landscape" : isLandscapeGap(W, H);
  // VERTICAL (refinamiento 26-07): el bloque de cromo ENTERO llena el ancho — el mapa va
  // «todo enmarcado como el original», bandas azules incluidas, y el ALTO no acota: si el
  // conjunto no cabe, la página scrollea (la botonera ya vive así). En APAISADO el alto
  // sí manda (no hay scroll lateral que valga) y el marco llena el alto, y ahí el mapa SÍ
  // depende de la banda (comparten el ancho) — por eso el orden de cálculo se bifurca.
  const banda: BandaMode = landscape ? "off" : (opts?.banda ?? "izq");
  const saLibre = Math.max(0, W / FRAME_W);
  const sbLandscape = landscape ? squareBandScaleLandscape(W, H, cap) : 0;
  const saLandscape =
    landscape ? Math.max(0, Math.min((W - PANEL_W * sbLandscape) / FRAME_W, H / MAP_BLOCK_H)) : 0;

  // ★★ `kind` SE DECIDE CON LA ESCALA **LIBRE**, ANTES DEL TOPE. La elección reflow/clásico es
  // `sa > sc`: si el tope entrara en este cálculo, en una pantalla apretada bajaría `sa` por
  // debajo de `sc` y **volcaría el layout entero al clásico** sin que nadie lo pidiera. MEDIDO
  // sin esta guarda: `--u5-reflow-content` desaparecía en 7 de 10 celdas verticales. El tope
  // acota la GEOMETRÍA del reflow; no elige layout.
  const sc = classicFitScale(W, H, 1);
  const kind: "reflow" | "clasico" =
    opts?.force === "reflow" ? "reflow"
    : opts?.force === "clasico" ? "clasico"
    : (landscape ? saLandscape : saLibre) > sc ? "reflow"
    : "clasico";

  // ★★ «EL MAPA NO NEGOCIA» — RESTITUIDA (ruling del 03-08 tarde). Aquí vivió, doce horas,
  // un TOPE que acotaba el mapa para garantizarle 208 px a la botonera. Se retira, y el
  // motivo hay que leerlo entero antes de reponerlo:
  //
  //   · EL COSTE SE MIDIÓ EN UN EJE Y SE PAGA EN DOS. La tabla que lo aprobó hablaba de
  //     «2,8-14 % de mapa» entendido como ALTURA. Pero la escala del mapa es UNIFORME
  //     (`saLibre = W / FRAME_W`, sale del ANCHO): en cuanto el tope la baja, el mapa DEJA
  //     DE LLENAR EL ANCHO y aparecen franjas negras laterales mientras la banda de abajo
  //     sigue de borde a borde. Eso es lo que el usuario fotografió el 03-08, y es el eje
  //     que la aprobación no nombró.
  //   · Y EN HARDWARE REAL MUERDE DONDE EL EMULADOR DECÍA QUE NO: su iPhone es 390×844
  //     emulado —una celda donde la tabla daba coste CERO— y mordió. La altura útil real
  //     (barra de Safari + `safe-area`) es menor que la emulada, así que la tabla estaba
  //     medida en el sitio equivocado.
  //   · Y SU PREFERENCIA ES LA CONTRARIA, dicha mirándolo: «los teclados numéricos se ven
  //     bien» y nunca se ha quejado del tamaño de las teclas; se queja DEL MAPA.
  //
  // ⇒ El mapa vuelve a llevarse el ancho entero. El suelo táctil del numpad deja de estar
  // garantizado y vuelve a ser una EXCEPCIÓN DECLARADA (registro de desamparadas), no un
  // silencio. Si algún día se repone un tope, que su coste se mida en LOS DOS EJES y sobre
  // métricas REALES de dispositivo, no emuladas.
  const saPortrait = saLibre;

  // Grosor de la tira azul = el de la banda lateral del marco, para que sean LA MISMA
  // columna. La tira le quita ancho a la BANDA (roster/log), nunca al mapa.
  const inset = banda === "off" ? 0 : CHROME_BAND_W * saPortrait;
  const insetL = banda === "off" ? 0 : inset;
  const insetR = banda === "full" ? inset : 0;
  const insetB = banda === "full" ? inset : 0;
  const sb =
    landscape ? sbLandscape
    : squareBandScalePortrait(Math.max(0, W - insetL - insetR), H, cap);
  const sa = landscape ? saLandscape : saPortrait;

  const panes =
    landscape ?
      landscapePanes(sa, sb, opts?.consoleScrollActive === true)
    : portraitPanes(sa, sb, opts?.consoleScrollActive === true, {
        insetL,
        insetR,
        insetB,
        panelBoxesFused: opts?.panelBoxesFused === true,
      });
  const canvas =
    landscape ?
      {
        w: FRAME_W * sa + PANEL_W * sb,
        h: Math.max(MAP_BLOCK_H * sa, BAND_STACK_H * sb),
      }
    : {
        w: Math.max(FRAME_W * sa, BAND_SRC_W * sb + insetL + insetR),
        h: MAP_BLOCK_H * sa + SEP_GAP_PX * sa + BAND_SRC_H * sb + insetB,
      };
  const canvasW = kind === "reflow" ? canvas.w : W;
  const canvasH = kind === "reflow" ? canvas.h : H;

  // Letterbox uniforme del 320×200 (modo clásico y bypass de pantalla completa). Aquí sí
  // manda `aspectY=1`: la variante cuadrado no estira NUNCA, tampoco al delegar.
  const fs = classicFitScale(canvasW, canvasH, 1);
  const fullW = SCREEN_W * fs;
  const fullH = SCREEN_H * fs;
  const full = pane(
    { sx: 0, sy: 0, sw: SCREEN_W, sh: SCREEN_H },
    (canvasW - fullW) / 2,
    (canvasH - fullH) / 2,
    fullW,
    fullH,
  );

  const playable = (s: number): number => (PLAYABLE_SIDE * s) ** 2;

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
    aspectY: 1,
    gap: landscape ? "landscape" : "portrait",
  };
}

/**
 * VERTICAL: mapa cuadrado arriba (centrado si la banda es más ancha) · banda de dos
 * columnas debajo. Mismo orden de pintado que la variante «banda» (caja → cielo → vientos:
 * las bandas de HUD comparten scanline con la caja y deben GANARLA).
 */
function portraitPanes(
  sa: number,
  sb: number,
  scrollActive: boolean,
  banda: {
    insetL: number;
    insetR: number;
    insetB: number;
    panelBoxesFused?: boolean;
  } = { insetL: 0, insetR: 0, insetB: 0 },
): PortraitPanes {
  const frameW = FRAME_W * sa;
  const bandW = BAND_SRC_W * sb;
  const canvasW = Math.max(frameW, bandW + banda.insetL + banda.insetR);
  const frameX = (canvasW - frameW) / 2;
  // La banda vive en el hueco que dejan las tiras azules; dentro de él va centrada.
  const bandX = banda.insetL + (canvasW - banda.insetL - banda.insetR - bandW) / 2;
  const paneW = PANEL_W * sb;
  // La banda arranca TRAS el hueco de separación (en px de juego, escalados con el mapa).
  const bandY = MAP_BLOCK_H * sa + SEP_GAP_PX * sa;
  const bandH = BAND_SRC_H * sb;
  // ── El ESTIRADO de la caja de jugadores (directriz 01-08) ────────────────────────────
  // La columna izquierda pasa de «panel(80) + costura(8) + 16 de relleno azul» a
  // «panel partido en dos con 16 filas de caja INTERIOR entre medias + costura(8)»: los
  // mismos 104, pero llenos de cromo. Los KPIs bajan enteros, sin estirarse.
  //
  // 🔴 …SALVO CON EL PANEL FUNDIDO POR UN OVERLAY — ficha #244. El punto de inserción
  // (la frontera fuente y55|y56) es el filo inferior de la caja de jugadores, y ahí
  // partir es INOBSERVABLE porque la caja mide seis filas de texto EXACTAS (y8..55) y
  // debajo sólo hay cromo. Con un overlay abierto (`panelBoxesFused`: picker de Use/
  // Ready/Mix, páginas de Ztats) esa frontera ya no es un filo: es TEXTO. Medido el
  // 13-08 en WebKit/iPhone con el picker de «Use item» y los 8 pergaminos (canvas
  // 1170×1696, bandScale 1,456 ⇒ 34,95 px de dispositivo por renglón): las filas
  // visibles 1-5 caen en y1277/1312/1347/1382/1417 (paso 35) y la 6ª en y1556 —
  // 139 px = CUATRO pasos, o sea TRES renglones de hueco negro entre «In Quas Wi» y
  // «Kal Xen», con cualquier selección. Son exactamente las 24 réplicas: el renderer
  // del picker pone sus 7 filas de contenido en y16..71 (fila 5 = y48..55, fila 6 =
  // y56..63), así que el corte cae JUSTO entre la 5ª y la 6ª.
  //
  // POR QUÉ EL REMEDIO ES RELLENO AZUL Y NO MOVER EL CORTE MÁS ABAJO. No hay ninguna
  // scanline interior segura común a la clase FUNDIDA: el picker de Ready/Use llena
  // y16..71 (borde inferior en la fila 9), el de Mix llena y16..**79** enteras
  // (`MIX_VISIBLE_ROWS` = 8, sin ventana) y las páginas de Ztats llenan lo que haga
  // falta. Cualquier corte interior parte el texto de alguna de las tres. Y lo que el
  // estirado existe para dar —cromo en vez de vacío azul en la caja de JUGADORES
  // (directriz 01-08)— no existe aquí: con el overlay abierto no hay caja de jugadores
  // que alargar, hay una ventana modal cuya altura es la de 1988. #244 dejó las 24
  // filas en relleno azul bajo el panel; ~~«las 24 filas vuelven a ser relleno azul»~~
  // — desde #380 ese azul YA NO EXISTE sin historial: el bloque del modal se estira
  // 14/11 (`MODAL_STRETCH_Y`, la vía que respeta la regla de #244 — un corte NUNCA,
  // un escalado del bloque ENTERO no parte nada) y llena la columna EXACTA. **La
  // columna sigue cuadrando**: 88·(14/11) = 112 = `BAND_SRC_H` sin fundir 80+24+8.
  const panelFundido = banda.panelBoxesFused === true;
  // ── ESCALA VERTICAL de la columna del MODAL — #380 (24-08, ver `MODAL_STRETCH_Y`) ──
  // Fundido: el bloque de 1988 (filas 0..10, 88 scanlines) se estira 14/11 y llena las
  // 112 de la columna EXACTO — el azul muerto del reporte use-item-alto-2 desaparece
  // por construcción. Sin fundir, ×1: la geometría del 01-08 intacta byte a byte.
  const sbY = sb * (panelFundido ? MODAL_STRETCH_Y : 1);
  const stretchH = PANEL_STRETCH_ROWS * sb;
  const bottomH = (PANEL_H - ROSTER_BOX_BOT) * sbY;
  // Fundido: panel ENTERO contiguo (y0..79, a escala `sbY`). Normal: las 24 filas del
  // estirado entre la caja de jugadores y su filo inferior, que es la geometría del 01-08.
  const bottomY = bandY + ROSTER_BOX_BOT * sbY + (panelFundido ? 0 : stretchH);
  const stretchY = panelFundido ? bottomY + bottomH : bandY + ROSTER_BOX_BOT * sb;
  // ── DÓNDE VA LA COSTURA (fila 10) EN LA COLUMNA DEL PANEL — #378 + #380 (24-08) ───
  // Con el panel FUNDIDO la fila 10 es el BORDE INFERIOR del modal (con el picker de
  // Use/Ready lleva además su indicador ►↕◄): pertenece al modal y va PEGADA a él —
  // que es el orden del original, filas 0..10 contiguas (#378). Y desde #380 el bloque
  // entero va estirado a la columna: la costura cae en la fila fuente 80 · 14/11, o sea
  // su última scanline (y87) ES la última de la columna — 88·(14/11) = 112, sin resto.
  // El «¿por filas o por alto disponible?» de #378 queda así: el CONTENIDO sigue siendo
  // las 88 filas de 1988 (ni un píxel fabricado) y el ALTO se aprovecha escalando el
  // bloque, que es como esta piel escala el mapa. Sin fundir, la costura sigue al fondo
  // (80+24+8 = 112, geometría 01-08).
  const seamY = bandY + PANEL_H * sbY + (panelFundido ? 0 : PANEL_STRETCH_ROWS * sb);
  // El cromo COMPLETO primero; caja y bandas de HUD se re-pintan ALINEADAS encima (sus
  // rects fuente viven dentro del bloque, así que dest = frameX + sx·sa, sy·sa — mismo
  // contenido en las mismas coordenadas). El orden caja→cielo→vientos se conserva.
  return {
    frame: pane(SRC_FRAME, frameX, 0, frameW, MAP_BLOCK_H * sa),
    box: pane(SRC_BOX, frameX + SRC_BOX.sx * sa, SRC_BOX.sy * sa, BOX_W * sa, SRC_BOX.sh * sa),
    sky: pane(SRC_SKY, frameX + SRC_SKY.sx * sa, 0, BOX_W * sa, ROW * sa),
    winds: pane(
      SRC_WINDS,
      frameX + SRC_WINDS.sx * sa,
      SRC_WINDS.sy * sa,
      BOX_W * sa,
      ROW * sa,
    ),
    panel: pane(SRC_PANEL_TOP, bandX, bandY, paneW, ROSTER_BOX_BOT * sbY),
    // Con el panel FUNDIDO no hay estirado de cromo (#244, arriba): las 24 filas las pone
    // `panelFill` en azul, bajo el panel entero. `null` EXACTO, no un pane de alto 0.
    panelStretch:
      panelFundido ? null : pane(SRC_PANEL_STRETCH, bandX, stretchY, paneW, stretchH),
    panelBottom: pane(SRC_PANEL_BOT, bandX, bottomY, paneW, bottomH),
    seamPanel: scrollActive ? null : pane(SRC_SEAM, bandX, seamY, paneW, ROW * sbY),
    seamLog: pane(SRC_SEAM, bandX + paneW, bandY, paneW, ROW * sb),
    // SUSTITUTO de la costura del log con el panel FUNDIDO (#378): la fila fuente 10 es
    // del OVERLAY (borde ↕ del modal) y el log no debe verla — el pintor tapa `seamLog`
    // con margen azul + el filo superior de la consola. Con el historial abierto el
    // banner sí es del log y no se tapa nada. Ver el campo en `PortraitPanes`.
    seamLogFill:
      panelFundido && !scrollActive ?
        pane({ ...SRC_PANEL_FILL, sh: ROW - 1 }, bandX + paneW, bandY, paneW, (ROW - 1) * sb)
      : null,
    seamLogEdge:
      panelFundido && !scrollActive ?
        pane(SRC_SEAM_EDGE_BOTTOM, bandX + paneW, bandY + (ROW - 1) * sb, paneW, sb)
      : null,
    log: pane(SRC_LOG, bandX + paneW, bandY + ROW * sb, paneW, LOG_H * sb),
    // PIEZA B (spec del usuario 27-07), REFORMULADA por su directriz del 01-08: la columna
    // de jugadores sigue llegando al fondo del log, pero ahora con CAJA (el estirado de
    // arriba) en vez de con relleno azul. Al relleno sólo le queda un trabajo: cubrir la
    // costura cuando el scrollback la anula (su fila fuente pasa a ser el banner
    // ►HISTORY◄, que pertenece al log), para que la banda azul de debajo de los jugadores
    // no desaparezca al abrir el historial — que es lo que Pieza B vino a arreglar.
    // Sin scrollback no queda NADA que rellenar (la costura llega al fondo por
    // construcción: 56+24+24+8 = 112 = `BAND_SRC_H`), así que el relleno es `null` — y lo
    // es EXACTAMENTE, no un pane de alto ~0: `hostedSrcScale` toma el mínimo de los
    // factores de todos los panes, y un pane degenerado le hacía devolver ×1 (o sea, la
    // shader alojada dejando de suavizar) sin que nada se pusiera rojo por otro sitio.
    // 🔴 CAMBIO #380 (24-08) sobre los destinos FUNDIDOS de #244/#378: el bloque del
    // modal va ESTIRADO a la columna entera (ver `MODAL_STRETCH_Y`), así que sin
    // historial NO QUEDA hueco que rellenar — el azul de 24 filas del reporte
    // use-item-alto-2 desaparece y el relleno es `null` EXACTO (no un pane de alto 0:
    // `hostedSrcScale` toma el mínimo de todos los panes y uno degenerado lo colapsa).
    // Con el HISTORIAL abierto la fila 10 es del banner, la costura se anula y el modal
    // visible son 80 filas al mismo factor (80·14/11 ≈ 101,8): el relleno cubre el
    // resto hasta el fondo — la expresión es la MISMA para fundido y sin fundir (sin
    // fundir: 112−104 = 8 = la fila de la costura anulada, la conducta de siempre).
    panelFill:
      scrollActive ?
        pane(SRC_PANEL_FILL, bandX, seamY, paneW, bandY + BAND_SRC_H * sb - seamY)
      : null,
    // FILO INFERIOR DE LOS KPIs PRESTADO (02-08, decisión 3 del usuario). Con el
    // historial abierto la fila 80 es el rótulo ►HISTORY◄ y la columna izquierda se queda
    // sin filo bajo la fecha; se le da el bloque GEMELO del divisor (y56..62), que es el
    // MISMO dibujo medido byte a byte. Sólo si el divisor sigue existiendo: con el panel
    // fundido por un overlay se queda a null y manda el azul de `panelFill`, porque ahí
    // no hay cromo que copiar (el censo del carril no encontró NINGUNA tira blanca de
    // 122 px en todo el canvas en ese estado).
    panelEdge:
      scrollActive && banda.panelBoxesFused !== true ?
        pane(SRC_PANEL_SEAM_TWIN, bandX, seamY, paneW, SRC_PANEL_SEAM_TWIN.sh * sb)
      : null,
    // FILO DE CIERRE, la OCTAVA scanline del hueco (03-08, reporte del usuario: «la línea
    // blanca inferior debajo de KPIs desaparece» al abrir el historial). `panelEdge` cubre
    // 7 y ésta la que falta: juntas devuelven el bloque de costura ENTERO. Va en
    // `(ROW-1)·sb` porque el destino lo define la COSTURA (su última scanline), no el
    // gemelo — que hoy mide 7 y cae justo ahí, y hay un test que ata esa contigüidad para
    // que un cambio en `PANEL_BOX_EDGES` no abra un hueco en silencio.
    // Mismas dos condiciones que `panelEdge`, y por lo mismo: sin scrollback la costura ya
    // trae la fila, y con el panel FUNDIDO por un overlay no hay filo que rebanar.
    // 🔴 #378→#380 (24-08): con el panel FUNDIDO y SIN historial el filo de cierre
    // vuelve a `null` — el estirado de #380 lleva la última scanline de la costura
    // (y87, con la ventana del ►↕◄ si el picker la lleva) EXACTAMENTE al fondo de la
    // columna: la scanline blanca final que #378 reponía la trae ahora el propio borde
    // del modal, como en 1988 (repintarla maciza encima taparía la ventana del ►↕◄).
    // Con historial + fundido la costura se anula y el cierre SÍ hace falta: sale del
    // flanco de y87 (`SRC_SEAM_EDGE_BOTTOM`), que sobrevive en toda la clase fundida —
    // no de `SRC_PANEL_EDGE_BOTTOM`, cuyo y56 es TEXTO con el overlay.
    panelEdgeBottom:
      scrollActive ?
        (panelFundido ?
          pane(SRC_SEAM_EDGE_BOTTOM, bandX, bandY + (BAND_SRC_H - 1) * sb, paneW, sb)
        : pane(SRC_PANEL_EDGE_BOTTOM, bandX, seamY + (ROW - 1) * sb, paneW, sb))
      : null,
    // TIRAS AZULES PERIMETRALES (encargo 01-08). La izquierda continúa hacia abajo la banda
    // lateral del bloque de mapa; la derecha y la de abajo cierran el marco en la variante
    // COMPLETA. Cromo real estirado (color uniforme ⇒ inobservable), como `panelFill`.
    bandLeft:
      banda.insetL > 0 ? pane(SRC_CHROME_BLUE, 0, bandY, banda.insetL, bandH) : null,
    bandRight:
      banda.insetR > 0 ?
        pane(SRC_CHROME_BLUE, canvasW - banda.insetR, bandY, banda.insetR, bandH)
      : null,
    bandBottom:
      banda.insetB > 0 ?
        pane(SRC_CHROME_BLUE, 0, bandY + bandH, canvasW, banda.insetB)
      : null,
  };
}

/**
 * APAISADO: mapa cuadrado a la izquierda llenando el ALTO · banda en UNA columna a la
 * derecha (roster arriba, costura, log abajo) — que es exactamente el orden del original,
 * sólo que a otra escala.
 *
 * La costura (fila 10) va UNA sola vez: en vertical se duplica porque las dos columnas de
 * la banda van lado a lado y esa fila sirve a las dos; apiladas, duplicarla sería pintar
 * dos veces el mismo renglón. Con el scrollback activo esa fila es el banner ►HISTORY◄ y
 * pertenece a la consola; sin él, es la barra azul del picker. En los dos casos ocupa el
 * MISMO hueco de la pila, así que `seamPanel` se queda a `null` y manda `seamLog`.
 */
function landscapePanes(sa: number, sb: number, _scrollActive: boolean): PortraitPanes {
  const frameW = FRAME_W * sa;
  const mapH = MAP_BLOCK_H * sa;
  const colW = PANEL_W * sb;
  const colH = BAND_STACK_H * sb;
  const canvasH = Math.max(mapH, colH);
  const mapY = (canvasH - mapH) / 2;
  const colX = frameW;
  const colY = (canvasH - colH) / 2;
  return {
    frame: pane(SRC_FRAME, 0, mapY, frameW, mapH),
    box: pane(SRC_BOX, SRC_BOX.sx * sa, mapY + SRC_BOX.sy * sa, BOX_W * sa, SRC_BOX.sh * sa),
    sky: pane(SRC_SKY, SRC_SKY.sx * sa, mapY, BOX_W * sa, ROW * sa),
    winds: pane(SRC_WINDS, SRC_WINDS.sx * sa, mapY + SRC_WINDS.sy * sa, BOX_W * sa, ROW * sa),
    panel: pane(SRC_PANEL, colX, colY, colW, PANEL_H * sb),
    seamPanel: null,
    seamLog: pane(SRC_SEAM, colX, colY + PANEL_H * sb, colW, ROW * sb),
    // Columna ÚNICA apilada: la fila 10 va UNA vez y en su sitio del original — con un
    // overlay abierto ES el borde ↕ del modal, sin duplicado que tapar (#378).
    seamLogFill: null,
    seamLogEdge: null,
    log: pane(SRC_LOG, colX, colY + (PANEL_H + ROW) * sb, colW, LOG_H * sb),
    panelFill: null, // columna única apilada: no hay hueco que rellenar
    panelEdge: null, // ídem: la costura va UNA vez y la trae `seamLog`
    panelEdgeBottom: null, // ídem
    // Ni estirado ni banda perimetral: las dos piezas del 01-08 arreglan un defecto de la
    // rama VERTICAL (columna corta al lado del log, y borde izquierdo a hueso). Apilada,
    // la columna del panel ya es contigua al log y el marco del mapa la flanquea.
    panelStretch: null,
    panelBottom: null,
    bandLeft: null,
    bandRight: null,
    bandBottom: null,
  };
}

/**
 * Lado del VISOR 11×11 en px de pantalla para un layout dado — el número que decide, y la
 * prueba viva del invariante: en la variante cuadrado `ladoX === ladoY`.
 */
export function viewportSides(L: PortraitLayout): { w: number; h: number } {
  const p: Pane = L.kind === "reflow" ? L.panes.box : L.full;
  return { w: (PLAYABLE_SIDE / p.sw) * p.dw, h: (PLAYABLE_SIDE / p.sh) * p.dh };
}
