/**
 * ShaderSkin — la TERCERA piel (task #70): la piel fiel 1988 con UN cambio de
 * pipeline, el mundo pasa por un upscaler de bordes (xBR en la GPU) y el texto/chrome
 * se compone encima nítido. Spec: `docs/skin-remaster/spec-modo-shader.md`.
 *
 * REUTILIZACIÓN TOTAL (cero forks de lógica): esta piel NO reimplementa nada de la
 * fiel. Instancia una `FaithfulSkin` que renderiza a un canvas 320×200 OCULTO (su
 * reloj de animación, sus overlays de combate/moongate/quake, su modal de Ztats por
 * tecla y su audio siguen intactos y montados). Un bucle de presentación propio
 * compone cada frame sobre un canvas VISIBLE a escala entera S:
 *
 *   1. el frame fiel entero → blit ×S NEAREST (chrome + TEXTO byte-idéntico a la fiel:
 *      son los mismos píxeles de la fiel escalados por vecino, igual que su CSS pixelated);
 *   2. la región del VIEWPORT (176×176, world) → upscaler xBR → blit sobre esa zona.
 *
 * Como el texto/chrome vive FUERA del rect del viewport (marco, panel, consola, banda),
 * el filtro NUNCA lo toca (criterio 2 de la spec). El upscaler decide su factor interno
 * y si el blit final es bilineal (xBR 4× → 6×) o nearest (fallback).
 *
 * FRONTERA REPORTADA a la sesión orquestadora: la cinemática de intro (`FaithfulIntro`,
 * ui/faithful-intro.ts) es un subsistema APARTE que corre y termina ANTES de montar
 * ninguna piel; sus láminas NO pasan por este filtro (criterio 5 de la spec queda fuera
 * del alcance de la piel). Las láminas/retratos/gemas que la fiel SÍ pinta en su canvas
 * DENTRO del viewport (p.ej. gema de mazmorra) se filtran solas; la gema de overworld usa
 * un panel DOM aparte y no se filtra.
 */
import {
  VIEW_HALF,
  VIEW_WINDOW,
  type CoreView,
  type EndgameSceneView,
  type IntentSink,
  type Skin,
  type ViewSnapshot,
} from "../api.js";
import { isCampActorId } from "../campScene.js";
import type { HostableSkin, HostedSource } from "../hostable.js";
import { PROJECTILE_DOT_COLOR, PROJECTILE_DOT_PX } from "../world-fx.js";
import {
  FaithfulSkin,
  faithfulCanvasSize,
  mobileCanvasSize,
  prefersMobileFit,
  CONSOLE_RECT,
  type WaterCellSink,
} from "../fiel/skin.js";
import { pointInConsole, wheelLines, dragLines } from "../fiel/logscroll.js";
import { MOONGATE_STAGES } from "../fiel/moongate.js";
import {
  BLUE_FLAME_TILE,
  BODY_ALPHA,
  CONTOUR_ACTOR_TILES,
  MOONGATE_TILE,
  TRANSLUCENT_ACTOR_TILES,
  TRANSLUCENT_BOUNDARY_TILES,
  TRANSLUCENT_FIELD_TILES,
  dominantFloorNeighbor as dominantFloorNeighborIdx,
  isCensusTerrainTile,
} from "./sprite-census.js";
import { bakedWaterTileOrder } from "../../render/waterfn32.js";
import { animatedFrame, type AnimGroup } from "../../render/tileanim.js";
import { isFireTile } from "../../render/firenoise.js";
import { isMasonryPassage } from "../../render/masonry-passage.js";
import { declaredFloorUnder, isInteriorFurniture } from "../../render/interior-furniture.js";
import { tapRipple } from "../../ui/tap-feedback.js";
import { DEFAULT_FRAME_COLORS, SCREEN_H, SCREEN_W, VIEWPORT, invertRect } from "../fiel/frame.js";
import { paletteXorRect } from "../fiel/palette-xor.js";
import { SKY_CELLS, SKY_COL, SKY_ROW, skyMarks } from "../fiel/sky.js";
import { drawVectorChrome } from "./chrome.js";
import {
  drawVectorBulletNotch,
  drawVectorNotch,
  drawVectorScrollArrow,
  drawVectorSkyBand,
} from "./skyband.js";
import { MIX_REAGENT_RECT, READY_PICKER_RECT, readyArrowGlyph } from "../fiel/ready.js";
import { ZTATS_LIST_RECT, ZTATS_LIST_ROWS } from "../fiel/ztats.js";
import type { Upscaler } from "./upscaler.js";
import { createUpscaler } from "./xbr-gl.js";
import {
  actorSlideFrom,
  anchoredLitMask,
  bakeFogVeilMask,
  classifyStep,
  clamp01,
  crossSlideOffsets,
  carriedGlowMask,
  emitterGlowMask,
  freshLitMask,
  exitingActors,
  type ExitingActor,
  litCells,
  occlusionLitMask,
  outgoingGatedMaskV0,
  persistentLitMask,
  slideActor,
  slideReachableDisc,
  snapCrossSlide,
  survivingGlowMask,
  tweenProgress,
} from "./motion.js";
import { HdFont } from "./hdtext.js";
import { ActorTransparency, transparencyMode, type TransparencyMode } from "./actor-transparency.js";
import {
  contourTranspEnabled,
  declaredFloorNeighbor,
  dominantFloorNeighbor,
  isFountainTile,
  isWallMountedFire,
} from "./contour-transp.js";
import {
  endgameActorFloor,
  endgameActorUnderOverlay,
  endgameFloorWindow,
  endgameFullScreen,
  endgameTranspActive,
} from "./endgame-transp.js";
import { paintCombatOverlays } from "../fiel/combat.js";
import type { GlyphRecord, GlyphSink } from "../fiel/font.js";

/** Factor xBRZ objetivo de la spec (16→96 px/tile); lo usa el fallback nearest. */
const SHADER_FACTOR = 6;

/** Code del bullet ► de eco de consola (IBM.CH 0x02; = `CONSOLE_BULLET_CODE` de la fiel).
 *  El pase HD lo redibuja VECTOR: NOTCH alargado (veredicto #5), no bilineal. */
const CONSOLE_BULLET_CODE = 0x02;

/**
 * Cursor de la ola del log (semigráficos 0x05-0x08). Veredicto #6 (V5, APROBADO): el
 * cursor ORIGINAL de la ola VECTORIZADO suave — sus DIAGONALES calcadas a paths
 * anti-aliased blancos (cero pixel), conservando la geometría del bitmap y las 4 fases
 * de animación. (V4 dibujaba líneas HORIZONTALES en marquee: no era lo que quería el
 * usuario.) Es la ÚNICA vía: el antiguo fallback opcional por URL (re-blit bilinear del
 * bitmap fiel) se retiró tras la aprobación del usuario. */

/** Clave del setting 4:3 de la fiel (misma que `skin/fiel/skin.ts`) — para calcar su letterbox. */
const ASPECT_SETTING_KEY = "u5clone:faithful:aspect43";

/**
 * AGUA xBRZ pre-horneada (task water-look): la clase agua se sustituye por el atlas
 * `water-xbrz.png` (olas continuas, escalador xBRZ de Zenju GPLv3 — atribución
 * pendiente en NOTICE de publicación). Toggle default ON (lo que pidió el usuario);
 * localStorage "0" lo apaga (revertible). El terreno sigue con el xBR propio.
 */
const WATER_XBRZ_KEY = "u5clone:shader:water-xbrz";
const WATER_ATLAS_URL = "/assets/water-xbrz.png";
const WATER_CELL_PX = 16 * SHADER_FACTOR; // 96 — celda del atlas (tile ×6)
const WATER_PHASES = 16;

function waterXbrzEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(WATER_XBRZ_KEY) !== "0";
  } catch {
    return true;
  }
}

/**
 * MAQUETA — AGUA DE FUENTE TRANSLÚCIDA (task fountain-mockup). La fuente overworld/pueblo
 * (tile-id 0xd8-0xdb, ciclada por el reloj maestro; NO es clase agua fn32, así que va
 * horneada en el blit fiel) recibe un tratamiento GLASS: un tinte acuático con alpha (deja
 * translucir el vaso de piedra) + brillo/cáustica sutil, en la familia vectorial limpia del
 * shader. Es un PROTOTIPO A/B tras flag `?fountainGlass=1`; default OFF = NO-OP (salida
 * byte-idéntica). Sin flag no se enumera ni se pinta nada. */
function fountainGlassEnabled(): boolean {
  try {
    return new URLSearchParams(globalThis.location?.search ?? "").get("fountainGlass") === "1";
  } catch {
    return false;
  }
}
/**
 * Kill-switch del censo de transparencia (1ª ola). Cableo REAL: default ON (veredicto B
 * aprobado). `?transp=off` lo desactiva ENTERO (actores + terreno) para QA/comparativas.
 */
function transpWireEnabled(): boolean {
  try {
    return new URLSearchParams(globalThis.location?.search ?? "").get("transp") !== "off";
  } catch {
    return true; // sin URL (tests): ON por defecto.
  }
}
/**
 * PIXEL-SNAP del cross-slide (prototipo A/B, `?pixelsnap=1`). ON: cuantiza el offset del blit
 * del mundo a píxel ENTERO de dispositivo (ver `snapCrossSlide`). MEDIDO como no-op práctico:
 * el blit ya es nearest 1:1 con escala entera, así que el offset fraccionario ya equivale a un
 * desplazamiento entero (residuo rígido ≈0% con/sin flag; byte-idéntico). Se deja como
 * kill-switch documentado. Default OFF.
 */
function pixelSnapEnabled(): boolean {
  try {
    return new URLSearchParams(globalThis.location?.search ?? "").get("pixelsnap") === "1";
  } catch {
    return false;
  }
}

/**
 * NIEBLA PRE-MULTIPLICADA (fog-premul, `?fogpremul=off` para revertir). Default ON: la
 * componente de niebla que DESLIZA con el terreno se HORNEA en el bitmap de mundo ANTES del
 * cross-slide (`bakeFogVeilMask`), en vez de pintarla con máscaras por-frame encima del terreno
 * ya deslizado (`paintFogSlide` + gates). Por construcción ningún contenido ocluido puede asomar
 * en la franja entrante/saliente (no existe en los bitmaps → mata la familia rooms-flash/
 * occlusion-edge) y el coste por-frame del tween baja al no componer el overlay deslizante. La
 * capa ANCLADA a pantalla (caída del radio) sigue igual. Settle byte-idéntico. OFF = vía vieja.
 */
function fogPremulEnabled(): boolean {
  try {
    return new URLSearchParams(globalThis.location?.search ?? "").get("fogpremul") !== "off";
  } catch {
    return true;
  }
}

/**
 * MOVIMIENTO SUAVE (eje 3, motion): entre dos turnos el bucle de present interpola el
 * offset del mundo (el Avatar está fijo al centro; el mapa scrollea) por CROSS-SLIDE
 * de dos recortes — el mundo VIEJO (V0, cacheado) y el NUEVO (V1) — que para el
 * movimiento 4-direccional de U5 cubren juntos el barrido exacto (V0 aporta la fila/
 * columna que SALE, V1 la que ENTRA). Sin anillo de core, fiel byte-intacta. Toggle
 * default ON; localStorage "0" lo apaga. Un ÚNICO reloj/duración para todos los tweens
 * de motion (scroll + NPC + blend) para no desincronarse. `MEDIA` = elección del usuario.
 */
const MOTION_KEY = "u5clone:shader:motion";
const TWEEN_MS = 150; // duración MEDIA (elección del usuario)
/** Layout del atlas EGA de tiles (tiles-ega.png 512×256 = 32×16 celdas de 16 px). */
const ATLAS_COLS = 32;
const ATLAS_TILE = 16;
/**
 * Salto de ventana (por eje) por encima del cual un actor NO se interpola sino que SNAP:
 * un paso normal combina el paso del jugador (≤1) + el del propio actor (≤1) → ≤2 por eje;
 * más que eso es spawn/teleport/cambio de escena y va seco (sin deslizamiento fantasma).
 */
const ACTOR_STEP_MAX = 2;
/**
 * ms por tick del reloj de sprites de la fiel (= `ANIM_TICK_MS` de fiel/skin.ts). El
 * shader lo usa como reloj CONTINUO para el CROSS-DISSOLVE (pieza 3): dentro del período
 * de un frame (tick·divisor) funde el frame actual con el siguiente del ciclo de 4, en
 * vez del parpadeo discreto del original. Va bajo el mismo toggle de motion.
 */
const SPRITE_TICK_MS = 55;

function motionScrollEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(MOTION_KEY) !== "0";
  } catch {
    return true;
  }
}

/**
 * Verificación de la GUARDA DE PÍXEL del cache de texto HD (perf/shader-idle): con
 * `localStorage["u5clone:shader:hdcache-verify"]="1"` la piel compara, cada frame, el
 * camino CACHEADO con el pase DIRECTO sobre la misma base y acumula el diff en
 * `window.__hdcacheVerify` (frames, mismatches, maxAbsDelta). Default OFF → coste cero.
 */
const HDCACHE_VERIFY_KEY = "u5clone:shader:hdcache-verify";
function hdCacheVerifyEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(HDCACHE_VERIFY_KEY) === "1";
  } catch {
    return false;
  }
}
/**
 * VEREDICTO «fuente transparente» (idea del usuario, dos lecturas como maqueta). Flag
 * REVERSIBLE `?mockFont=` en la URL, leído una vez:
 *   · `nobg`   — lectura 1: el cuerpo del panel/consola pierde su fondo NEGRO de celda;
 *                los glifos flotan sobre un fondo de panel TEMATIZADO (degradado azul del
 *                chrome). Demuestra «el glifo flota sobre el fondo del panel».
 *   · `alpha`  — lectura 2: los glifos se pintan con alfa translúcido (bordes suaves
 *                semitransparentes) sobre el panel negro actual.
 * Default (vacío) → NO-OP, render byte-idéntico al de hoy.
 */
function mockFontMode(): "nobg" | "alpha" | "" {
  try {
    if (typeof location === "undefined") return "";
    const m = new URLSearchParams(location.search).get("mockFont");
    return m === "nobg" || m === "alpha" ? m : "";
  } catch {
    return "";
  }
}
const ASPECT_SQUARE = 1.0;
const ASPECT_CRT_43 = 1.2;

function aspectStretchEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(ASPECT_SETTING_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Backbuffer del canvas visible a escala entera `s`: la pantalla lógica 320×200 ×s.
 * El estiramiento de aspecto 4:3 lo aplica el CSS (como la fiel), NO el backbuffer.
 */
export function shaderCanvasSize(s: number): { width: number; height: number } {
  return { width: SCREEN_W * s, height: SCREEN_H * s };
}

/**
 * ESCALA ENTERA S del backbuffer. Puro → testeable sin DOM, que es justo lo que hacía
 * falta: la decisión vivía dentro del `resizeHandler` (una clausura de `mount`) y por eso
 * el colapso a ×1 con el host oculto sólo se podía ver en un navegador.
 *
 * `hosted` es la escala que IMPONE un anfitrión (`setHostedScale`). Manda sobre la medida
 * del contenedor por una razón medida, no por gusto: alojada en el host 0×0 del layout
 * partido, `availW` llega como 0, el `|| SCREEN_W` del llamador lo convierte en 320, y
 * `ceil(320/320)` da **1** — o sea backbuffer 320×200 y **cero suavizado** (diagnóstico
 * smooth×portrait §3, probe3). Con anfitrión, quien sabe a qué tamaño se va a pintar es
 * él, no un contenedor que mide cero.
 */
export function shaderScale(
  availW: number,
  availH: number,
  aspectY: number,
  mobile: boolean,
  hosted: number | null,
): number {
  if (hosted != null) return Math.max(1, Math.floor(hosted));
  const size =
    mobile ?
      mobileCanvasSize(availW, availH, aspectY)
    : faithfulCanvasSize(availW, availH, aspectY);
  // Móvil: HACIA ARRIBA (el GPU renderiza a más densidad que el display → nítido al
  // reescalar). Escritorio: escala entera EXACTA, la fidelidad no se mueve un píxel.
  return mobile ?
      Math.max(1, Math.ceil(size.width / SCREEN_W))
    : Math.max(1, Math.round(size.width / SCREEN_W));
}

/**
 * Rectángulo destino (px del backbuffer) donde se blitea el mundo filtrado a escala
 * `s`: exactamente el rect del VIEWPORT (8,8)+176×176 escalado. El texto/chrome que
 * vive FUERA de este rect nunca lo pisa el filtro (criterio 2 de la spec). Puro →
 * testeable sin DOM.
 */
export function shaderWorldRect(s: number): {
  x: number;
  y: number;
  size: number;
} {
  return {
    x: VIEWPORT.x * s,
    y: VIEWPORT.y * s,
    size: VIEWPORT.tiles * VIEWPORT.tile * s,
  };
}

/** Rect en px lógicos (320×200). */
interface LogRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Franjas de contenido DINÁMICO que el chrome vectorial tapa y que hay que
 * recomponer NEAREST desde el canvas fiel (nunca por xBR — son glifos bitmap, se
 * tratan como el texto: nítidos, no filtrados). Ambas van CENTRADAS sobre sus
 * barras/bordes, lejos de las esquinas redondeadas (que quedan intactas):
 *  · CIELO: sol + fases lunares + remates, sobre la barra superior azul
 *    (ventana `[SKY_COL-1 .. SKY_COL+SKY_CELLS]`, fila 0). Geometría de `fiel/sky.ts`.
 *  · VIENTOS: `►Dir Winds◄` centrado en el borde inferior del viewport (fila 23).
 *    Banda central holgada que cubre cualquier etiqueta sin llegar a las esquinas.
 */
const SKY_STRIP: LogRect = {
  x: (SKY_COL - 1) * 8,
  y: SKY_ROW * 8,
  w: (SKY_CELLS + 2) * 8,
  h: 8,
};
const WINDS_STRIP: LogRect = { x: 32, y: 23 * 8, w: 120, h: 8 };
/** Fila lógica de la banda de vientos (fila 23, borde inferior del viewport). La posición
 *  y el texto los dicta la FIEL (col 6 en 'en', centrado en 'es'); el shader realza sus
 *  glifos capturados in-situ, así que ya no fija la columna. */
const WINDS_ROW = 23;

/** ¿Cae la esquina lógica (x,y) de una celda dentro de la franja `r`? */
function inRect(x: number, y: number, r: LogRect): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/**
 * ¿La celda `(col,row)` de la ventana de terreno es un PASO ABIERTO EN MAMPOSTERÍA (#197)?
 * Fuera de rango o sin `terrainWindow` (modos que no la pueblan) → `false`: el actor conserva
 * el recorte de siempre. Ver `render/masonry-passage.ts` para el ruling y el conjunto.
 */
function passageCell(tw: Int16Array | undefined, col: number, row: number): boolean {
  if (!tw) return false;
  if (col < 0 || col >= VIEW_WINDOW || row < 0 || row >= VIEW_WINDOW) return false;
  return isMasonryPassage(tw[row * VIEW_WINDOW + col] ?? -1);
}

/**
 * ¿Pinta el pase de texto HD (1b) este glifo? Excluye el VIEWPORT (mundo por xBR) y las
 * bandas cielo/vientos (recompuestas en el paso 4). Es la fuente ÚNICA de verdad tanto del
 * pintado (`drawHdText`) como de la FIRMA del cache (`hdSignature`): así el cache invalida
 * exactamente cuando cambia lo que la capa dibuja — un cambio en el viewport o en las bandas
 * no fuerza un repintado inútil, y nunca se salta uno necesario.
 */
function isHdLayerGlyph(g: GlyphRecord): boolean {
  const vx0 = VIEWPORT.x;
  const vy0 = VIEWPORT.y;
  const vx1 = VIEWPORT.x + VIEWPORT.tiles * VIEWPORT.tile;
  const vy1 = VIEWPORT.y + VIEWPORT.tiles * VIEWPORT.tile;
  if (g.x >= vx0 && g.x < vx1 && g.y >= vy0 && g.y < vy1) return false;
  if (inRect(g.x, g.y, SKY_STRIP) || inRect(g.x, g.y, WINDS_STRIP)) return false;
  return true;
}

export class ShaderSkin implements HostableSkin {
  readonly id = "shader";
  /** La piel fiel envuelta: renderiza a su canvas 320×200 OCULTO. No se toca su lógica. */
  private readonly faithful = new FaithfulSkin();
  /**
   * ¿Cruce de moongate en curso? Passthrough de la fiel INTERNA (la secuencia
   * scripted vive en ella; esta piel cae a recorte pleno mientras dura). Lo consulta
   * el gate modal de input de main.ts (`moongateTransiting`): el original no lee
   * input durante la secuencia (kernel_moongate_enter 0x48a8, síncrona).
   */
  get transiting(): boolean {
    return this.faithful.transiting;
  }

  // ── SUPERFICIE DE ALOJAMIENTO (`HostableSkin`, LOTE C) ────────────────────────────
  // Los cuatro passthrough de abajo NO son azúcar: son los miembros que el composer del
  // layout partido consume del alojado y que esta piel tenía en su fiel INTERNA sin
  // reexportar (diagnóstico smooth×portrait §2.2 — la tabla de los cinco). Mientras no
  // existieron, «shader + partido» era imposible por construcción.

  /** ¿Scrollback de consola activo? Lo decide la fiel interna, que es quien pinta. */
  get consoleScrollActive(): boolean {
    return this.faithful.consoleScrollActive;
  }

  /** ¿Lista de Ztats abierta? (hit-test del panel en el anfitrión). */
  get panelListOpen(): boolean {
    return this.faithful.panelListOpen;
  }

  /** ¿Panel fundido en una caja por un overlay? Lo decide la fiel interna, que es quien pinta. */
  get panelBoxesFused(): boolean {
    return this.faithful.panelBoxesFused;
  }

  consoleScrollLines(delta: number): void {
    this.faithful.consoleScrollLines(delta);
  }

  panelScrollLines(delta: number): void {
    this.faithful.panelScrollLines(delta);
  }

  /**
   * Generación de la FUENTE tal y como la ve un anfitrión: el contador de presents
   * COMPUESTOS de esta piel, **no** el `sourceFrameGen` de su fiel interna.
   *
   * La diferencia importa y es la razón de que no sea un passthrough: el canvas que el
   * anfitrión lee es el de ESTA piel, y su contenido cambia bastante más a menudo que el
   * de la fiel (tweens del scroll suave, interpolación de actores, overlays de combate,
   * llegada asíncrona de los atlas HD). Delegando en la fiel, el gate de suciedad del
   * envoltorio se saltaría justo los frames del movimiento suave — que es el motivo por
   * el que alguien elige esta piel.
   */
  get sourceFrameGen(): number {
    return this.presentStats.painted;
  }

  /**
   * ¿Fx AV transitorio vivo? (#207). Aquí SÍ es passthrough a la fiel interna, al revés
   * que `sourceFrameGen` justo arriba — y la diferencia entre los dos casos es el motivo
   * de que esta línea lleve comentario. `sourceFrameGen` cuenta REPINTADOS, y esta piel
   * repinta más veces que su fuente (tweens, interpolación, atlas HD), así que delegarlo
   * mentiría. «Hay un efecto transitorio vivo» no es una cuenta: es la MISMA propiedad en
   * las dos capas, porque las capas de fx viven todas en la fiel y esta piel sólo compone
   * lo que aquélla pinta. Delegar es la respuesta correcta, no un atajo.
   */
  get transientFxActive(): boolean {
    return this.faithful.transientFxActive;
  }

  /**
   * Canvas fuente + escala para el anfitrión. Es el canvas VISIBLE de esta piel (el de
   * ×S, ya con xBR/HD compuestos), no el 320×200 de la fiel que envuelve — bajo el host
   * hay dos, y sondear el DOM cogería el equivocado.
   */
  hostedSource(): HostedSource | null {
    return this.canvas ? { canvas: this.canvas, scale: this.scale } : null;
  }

  /** Ver `HostableSkin.setHostedScale` y `shaderScale`: el host oculto mide 0. */
  setHostedScale(scale: number | null): void {
    const next = scale == null ? null : Math.max(1, Math.floor(scale));
    if (next === this.hostedScale) return;
    this.hostedScale = next;
    this.resizeHandler?.();
  }

  /** Escala impuesta por un anfitrión; `null` = esta piel la mide de su contenedor. */
  private hostedScale: number | null = null;
  private host: HTMLDivElement | null = null; // host oculto que aloja la fiel
  private container: HTMLDivElement | null = null; // contenedor visible (flex, letterbox)
  private canvas: HTMLCanvasElement | null = null; // canvas visible a escala entera
  private ctx: CanvasRenderingContext2D | null = null;
  private srcCanvas: HTMLCanvasElement | null = null; // el canvas 320×200 de la fiel
  private crop: HTMLCanvasElement | null = null; // recorte 176×176 del viewport
  private cropCtx: CanvasRenderingContext2D | null = null;
  private chrome: HTMLCanvasElement | null = null; // chrome vectorial precomputado a ×S
  private chromeCtx: CanvasRenderingContext2D | null = null;
  private upscaler: Upscaler | null = null;
  /**
   * Fuente REMASTER HD (task #73): consume `font-ibm-hd.png`. `null` mientras
   * carga o si el asset no está (fallback a texto nearest, sin romper).
   */
  private hdFont: HdFont | null = null;
  /**
   * Fuente RÚNICA HD (`font-runes-hd.png`, veredicto #18): sol 0x2A + fases lunares
   * 0x30-0x37 de la banda celeste. `null` mientras carga o si el asset no está →
   * fallback al dibujo VECTOR de sol/lunas (drawVectorSun/Moon), sin romper.
   */
  private hdRunes: HdFont | null = null;
  /**
   * Captura de glifos de la fiel, doble-buffer: la fiel escribe en `capPending`
   * durante su pintado; `frameStart` promueve el frame COMPLETO anterior a
   * `capCommitted` (lo que lee el pase HD) — así nunca se lee media lista.
   */
  private capPending: GlyphRecord[] = [];
  private capCommitted: GlyphRecord[] = [];
  // ── CACHE de la capa de TEXTO HD (perf/shader-idle) ──────────────────────────
  /**
   * El pase (1b) redibuja ~1 op por glifo capturado (hasta ~300 en consola/panel)
   * CADA frame de present (60 fps), aunque el TEXTO sólo cambia al ritmo de la fiel
   * (~9 fps de tick de terreno, o sólo en eventos). Aquí se HORNEA ese pase en una capa
   * offscreen del tamaño del backbuffer y se recompone SÓLO cuando cambia su contenido
   * (`hdCacheSig`) — el frame idle pasa de N draws a 1 blit 1:1.
   *
   * GUARDA DE PÍXEL: la capa arranca TRANSPARENTE y (1b) sólo dibuja `source-over` en
   * celdas 8px disjuntas fuera del viewport; «over-transparent» es copia exacta y «over»
   * es asociativo, así que blit 1:1 de la capa sobre la base == el pase directo, byte a
   * byte. La firma cubre code/x/y/scale/color de cada glifo + la escala `s`; el reblit
   * NEAREST de semigráficos (<0x20) lee píxeles de la fiel deterministas por (code,color),
   * ya en la firma. Verificación viva en `verifyHdCache` (flag), diff==0.
   */
  private hdLayer: HTMLCanvasElement | null = null;
  private hdLayerCtx: CanvasRenderingContext2D | null = null;
  private hdCacheSig = ""; // firma del contenido HORNEADO en la capa ("" = vacía/invalida)
  private hdSigArrayRef: GlyphRecord[] | null = null; // memo: identidad del array capCommitted
  private hdSigMemo = ""; // firma memoizada para ese array (recalcada sólo si cambia el ref)
  /** Instrumentación (medición del ahorro), publicada en `window.__hdcache` al montar:
   *  frames totales, repintados de la capa (miss), y glifos del último repaint. En idle,
   *  `repaints` deja de crecer (todo son aciertos que sólo componen 1 blit). */
  private readonly hdStats = { frames: 0, repaints: 0, opsLastRepaint: 0, runeOps: 0, runeSkipped: 0, hit: false };
  /** Verificación de guarda de píxel (flag localStorage): compara el camino cacheado con
   *  el directo sobre la MISMA base cada frame. Scratch canvases perezosos. */
  private readonly hdCacheVerify = hdCacheVerifyEnabled();
  /** Maqueta «fuente transparente» (veredicto): '', 'nobg' o 'alpha'. Default '' = NO-OP. */
  private readonly mockFont = mockFontMode();
  private hdVerifyA: CanvasRenderingContext2D | null = null;
  private hdVerifyB: CanvasRenderingContext2D | null = null;
  /** Remates `►◄` de los banners del panel (Ztats/Select) que la fiel enumera para
   * redibujarlos VECTOR redondeados, doble-buffer como los glifos. En px lógicos. */
  private brkPending: { x: number; y: number; mirror: boolean }[] = [];
  private brkCommitted: { x: number; y: number; mirror: boolean }[] = [];
  private readonly glyphSink: GlyphSink = {
    frameStart: () => {
      this.capCommitted = this.capPending;
      this.capPending = [];
      this.brkCommitted = this.brkPending;
      this.brkPending = [];
    },
    record: (rec) => {
      this.capPending.push(rec);
    },
    recordBracket: (x, y, mirror) => {
      this.brkPending.push({ x, y, mirror });
    },
  };
  // ── MAQUETA fuente translúcida (fountain-mockup) ─────────────────────────────
  /** Prototipo A/B tras `?fountainGlass=1`. Default OFF → NO-OP byte-idéntico. */
  private readonly fountainGlass = fountainGlassEnabled();
  /** Prototipo A/B tras `?pixelsnap=1`. Default OFF → offsets sub-píxel de siempre. */
  private readonly pixelSnap = pixelSnapEnabled();
  /** Niebla PRE-MULTIPLICADA (fog-premul). Default ON; `?fogpremul=off` → vía vieja
   *  (paintFogSlide + gates). Ver `fogPremulEnabled` / `bakeFogVeilMask`. */
  private readonly fogPremul = fogPremulEnabled();
  /** Censo de transparencia (veredicto B, alpha .55 del cuerpo) — 1ª ola. Default ON;
   *  `?transp=off` lo apaga entero (kill-switch de QA). */
  private readonly transpWire = transpWireEnabled();
  // ── AGUA xBRZ pre-horneada (water-look) ──────────────────────────────────────
  private waterXbrz = waterXbrzEnabled();
  private waterAtlas: HTMLImageElement | null = null;
  /** tile-id de agua → fila del atlas (= bakedWaterTileOrder, casa con el horneador). */
  private readonly waterRow: ReadonlyMap<number, number> = new Map(
    bakedWaterTileOrder().map((t, i) => [t, i]),
  );
  /** Celdas de agua del viewport, doble-buffer (como los glifos): la fiel llena
   * `pending` durante su pintado; `begin()` promueve el frame COMPLETO a `committed`. */
  private waterPending: { col: number; row: number; tile: number }[] = [];
  private waterCommitted: { col: number; row: number; tile: number }[] = [];
  private waterPendingPhase = 0;
  private waterCommittedPhase = 0;
  private readonly waterSink: WaterCellSink = {
    begin: (offset) => {
      this.waterCommitted = this.waterPending;
      this.waterCommittedPhase = this.waterPendingPhase;
      this.waterPending = [];
      this.waterPendingPhase = ((offset % WATER_PHASES) + WATER_PHASES) % WATER_PHASES;
    },
    cell: (col, row, tile) => {
      this.waterPending.push({ col, row, tile });
    },
  };
  // ── MOVIMIENTO SUAVE (cross-slide, eje 3 motion) ─────────────────────────────
  private motionScroll = motionScrollEnabled();
  /** Capa MUNDO device de este frame (xBR + agua xBRZ), fuente del cross-slide. */
  private worldCanvas: HTMLCanvasElement | null = null;
  private worldCtx: CanvasRenderingContext2D | null = null;
  /** Capa MUNDO del frame ANTERIOR (V0 rodante hasta que se detecta un paso). */
  private prevWorld: HTMLCanvasElement | null = null;
  private prevWorldCtx: CanvasRenderingContext2D | null = null;
  /** V0 CONGELADO del tween en curso (el mundo justo antes del paso). */
  private tweenV0: HTMLCanvasElement | null = null;
  private tweenV0Ctx: CanvasRenderingContext2D | null = null;
  /**
   * NIEBLA DE CIUDAD (town-shadow-anchor): el `visMask` del frame ANTERIOR (V0 rodante)
   * y su CONGELADO al armar el tween. Durante el tween la niebla/LOS deja de anclarse a
   * pantalla y hace CROSS-SLIDE como el terreno (cada campo viaja con SU capa de mundo)
   * → el borde de sombra de los edificios acompaña a los edificios (deja de «saltar» al
   * inicio del paso en ciudad). Overlay `fogCanvas` reutilizable para el compositado
   * (destination-out = revela la unión de luz de los dos campos deslizados).
   */
  private prevVisMask: Uint8Array | null = null;
  private tweenVisMaskV0: Uint8Array | null = null;
  /** Disco de radio de la party (center-anchored) — V0 rodante + congelado, para la
   *  DESCOMPOSICIÓN de la niebla: la caída del radio se ancla a pantalla y sólo la sombra
   *  por oclusión de muros desliza. Ver anchoredLitMask/occlusionLitMask. */
  private prevVisRadius: Uint8Array | null = null;
  private tweenVisRadiusV0: Uint8Array | null = null;
  private fogCanvas: HTMLCanvasElement | null = null;
  private fogCtx: CanvasRenderingContext2D | null = null;
  private worldSize = 0;
  /** PERF PROBE (fog-premul): `now` del frame anterior, para el periodo entre frames que mide
   *  la cadencia del tween. Sólo se lee si `globalThis.__fogperf` es un array (opt-in, cero
   *  coste por defecto). Ver la escritura al inicio de `present`. */
  private lastPresentNow = 0;
  private lastCenter: { x: number; y: number } | null = null;
  private lastLoc = "";
  /** Tween de scroll activo: dirección del paso (dx,dy en tiles) + reloj de pared. */
  private tween: { start: number; durMs: number; dx: number; dy: number } | null = null;
  // ── ACTORES (motion pieza 2: NPC/errante desliza; pieza 3: blend de frame) ──────
  /** Posición de ventana (col,row) de cada actor al INICIO del turno (from del tween). */
  private actorFrom = new Map<string, { col: number; row: number }>();
  /** Posición de ventana de cada actor en el snapshot ACTUAL (to del tween). */
  private actorTo = new Map<string, { col: number; row: number }>();
  /** Posición REALMENTE compuesta el último frame (para re-arrancar sin salto si el
   *  turno interrumpe un tween en vuelo). */
  private actorRendered = new Map<string, { col: number; row: number }>();
  /** Doble-buffer de `actorRendered` (PERF-4): se alterna con él en cada `paintActors`
   *  en vez de alocar un Map nuevo por frame de rAF. */
  private actorRenderedSpare = new Map<string, { col: number; row: number }>();
  /** Snapshot visto por el último `updateMotion` (PERF-4): el snapshot está memoizado
   *  por turno (PERF-1), así que el MISMO objeto ⇒ centro/actores sin cambios. */
  private lastMotionSnap: ViewSnapshot | null = null;
  /** Buffers de instancia para las máscaras de niebla derivadas (PERF-4): 121 bytes
   *  fijos reutilizados en vez de 3-4 `Uint8Array` nuevos por frame de tween nocturno.
   *  Un buffer por call-site (nunca dos vivos con el mismo scratch → sin aliasing). */
  private readonly fogVeilScratch = new Uint8Array(VIEW_WINDOW * VIEW_WINDOW);
  private readonly fogAnchoredScratch = new Uint8Array(VIEW_WINDOW * VIEW_WINDOW);
  private readonly fogOcclV0Scratch = new Uint8Array(VIEW_WINDOW * VIEW_WINDOW);
  private readonly fogOcclV1Scratch = new Uint8Array(VIEW_WINDOW * VIEW_WINDOW);
  private readonly fogOutgoingScratch = new Uint8Array(VIEW_WINDOW * VIEW_WINDOW);
  private readonly fogPersistScratch = new Uint8Array(VIEW_WINDOW * VIEW_WINDOW);
  /** Luz que el paso acaba de revelar, punzada ANCLADA junto al suelo persistente (filo
   *  delantero, 08-08). Ver `freshLitMask` (motion.ts). */
  private readonly fogFreshScratch = new Uint8Array(VIEW_WINDOW * VIEW_WINDOW);
  /** Halo del campo VIEJO que SOBREVIVE al paso, punzado al offset deslizante de V0 (22-08).
   *  Ver `survivingGlowMask` (motion.ts). */
  private readonly fogSurvivingScratch = new Uint8Array(VIEW_WINDOW * VIEW_WINDOW);
  /** Disco de radio DILATADO a la 4-vecindad (fog-rim), uno por campo — la vía vieja se lo
   *  pasa a `occlusionLitMask` en lugar del disco crudo. Ver `slideReachableDisc`. */
  private readonly fogReachV0Scratch = new Uint8Array(VIEW_WINDOW * VIEW_WINDOW);
  private readonly fogReachV1Scratch = new Uint8Array(VIEW_WINDOW * VIEW_WINDOW);
  /** Reloj de pared del tween de actores (COMPARTIDO con el de scroll cuando ambos
   *  ocurren en el mismo turno → el actor queda pegado a su celda de terreno). */
  private actorStart = 0;
  /** Firma del turno (posiciones+centro) para detectar cuándo re-armar el tween. */
  private actorSig = "";
  /** Actores del turno ANTERIOR (id+tile+celda), para calcular los SALIENTES por scroll. */
  private lastActors: readonly { id: string; tile: number; col: number; row: number }[] = [];
  /** Salientes por scroll a deslizar hacia fuera este tween (espejo de los entrantes).
   *  Se recalcula al cambiar la firma del turno; vacío salvo en el paso de scroll. */
  private actorsExiting: readonly ExitingActor[] = [];
  // ── TRANSPARENCIA DE ACTORES (prototipo shader) ──────────────────────────────
  /** Recortes transparentes por tileId (fondo negro exterior → alpha 0 por flood-fill). */
  private readonly actorTransparency = new ActorTransparency();
  /** 🔴 SEGUNDA instancia SOLO para el ENDGAME (#367): `ActorTransparency` cachea el
   *  PRIMER atlas para siempre y por tileId (`ensureAtlas`) — pasarle `atlasEndgame` a
   *  la instancia de arriba (o el atlas normal a ésta) serviría recortes del atlas
   *  EQUIVOCADO en silencio. Jamás mezclar atlas en una instancia. */
  private readonly endgameActorTransparency = new ActorTransparency();
  /** Scratch de la ventana de suelo utilizable del endgame (11×11, ver endgame-transp). */
  private endgameFloorScratch: Int16Array | null = null;
  /** Modo activo: off | avatar | all | soft (localStorage, revertible). Default `all`. */
  private transpMode: TransparencyMode = transparencyMode();
  /** CONTORNO-TRANSPARENCIA del TERRENO (fuente 0xd8–0xdb + braseros/antorchas de fuego):
   *  flood-fill exterior sobre el terreno con suelo sintetizado. Default ON; kill-switch
   *  `?contourTransp=off` = byte-idéntico. */
  private readonly contourTransp = contourTranspEnabled();
  /** Scratch 16×16 para recortar el canvas VIVO de titileo de un brasero (fn32) por la
   *  silueta estática del tile (destination-in con el alpha del recorte del atlas). Lazy. */
  private contourScratch: HTMLCanvasElement | null = null;
  private contourScratchCtx: CanvasRenderingContext2D | null = null;
  private view: CoreView | null = null; // para la banda celeste vectorial (sol/lunas por hora)
  // ── GATE DE SUCIEDAD del present (PERF-2, auditoría rendimiento) ─────────────
  /**
   * El pipeline completo (blit ×S + texto HD + crop + xBR GPU + agua + niebla +
   * actores + chrome + bandas) corría CADA frame de rAF (60 Hz) aunque la fuente
   * sólo muta a ~9-18 Hz (reloj de la fiel) o por evento. Se salta el frame entero
   * cuando NADA pudo cambiar: misma generación del canvas fiel (`sourceFrameGen`),
   * mismo snapshot (identidad, memoizado por PERF-1), sin tween de scroll/actores,
   * sin combate (overlays parpadean a reloj propio), sin quake/transit y sin flags
   * de medición/maqueta. El canvas visible retiene el último frame compuesto →
   * salida IDÉNTICA, solo pintada menos veces. `presentForce` cubre montaje,
   * resize, resume de visibilidad y llegadas asíncronas de assets (hdFont/runas/
   * atlas de agua), que cambian la composición sin tocar fuente ni snapshot.
   */
  private presentForce = true;
  private lastSrcGen = -1;
  private lastSnapRef: ViewSnapshot | null = null;
  /** ¿Se pintó ya el frame de asentamiento (t=1) del tween de actores? */
  private actorSettled = true;
  /** ¿El último frame pintado tenía quake/transit activos? (pinta uno más al cerrar). */
  private lastQuakeActive = false;
  private lastTransitActive = false;
  /** Instrumentación del gate (publicada en `window.__presentPerf` al montar):
   *  frames de rAF vistos vs presents realmente compuestos. */
  private readonly presentStats = { frames: 0, painted: 0 };
  private raf = 0;
  private scale = 1; // escala entera S del canvas visible (de faithfulCanvasSize)
  private quakeBuf: HTMLCanvasElement | null = null; // buffer del re-blit de la sacudida
  private aspectY = ASPECT_SQUARE;
  private resizeHandler: (() => void) | null = null;
  private pointerHandler: ((ev: PointerEvent) => void) | null = null;
  /** Scrollback de consola (log-scroll): listeners propios sobre el canvas VISIBLE
   *  de esta piel, reenviados a la fiel (`faithful.consoleScrollLines`), que es
   *  quien pinta la consola que este present sube a HD. */
  private wheelHandler: ((ev: WheelEvent) => void) | null = null;
  private consoleDrag: {
    id: number;
    lastY: number;
    rest: number;
    zone: "console" | "panel";
  } | null = null;
  private dragDownHandler: ((ev: PointerEvent) => void) | null = null;
  private dragMoveHandler: ((ev: PointerEvent) => void) | null = null;
  private dragEndHandler: ((ev: PointerEvent) => void) | null = null;
  private visHandler: (() => void) | null = null;

  async mount(root: HTMLElement, view: CoreView, intents: IntentSink): Promise<void> {
    this.view = view;
    // 1) Host OCULTO con la piel fiel dentro (renderiza a su canvas 320×200; su reloj y
    //    sus listeners de teclado/audio siguen vivos — el modal de Ztats es window-capture).
    const host = document.createElement("div");
    host.className = "shader-skin-src";
    host.style.cssText =
      "position:absolute;left:0;top:0;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;";
    root.appendChild(host);
    this.host = host;
    await this.faithful.mount(host, view, intents);
    const src = host.querySelector("canvas");
    if (!src) throw new Error("ShaderSkin: la piel fiel no montó su canvas");
    this.srcCanvas = src;

    // Pase de texto HD (task #73): adjunta el sumidero para enumerar las celdas de
    // texto de la fiel y carga el atlas remaster. La carga es async y NO bloquea el
    // montaje: hasta que llegue (o si falta el asset), el texto va nearest (paso 1).
    this.faithful.setGlyphSink(this.glyphSink);
    void HdFont.load().then((f) => {
      this.hdFont = f;
      this.presentForce = true; // el pase HD cambia la composición sin tocar fuente/snapshot
    });
    // Atlas RÚNICO HD (veredicto #18): banda celeste con sol/lunas HD en vez de vector.
    // Sin atlas de extensión (las runas no tienen Latino-1) → segunda URL inexistente = null.
    void HdFont.load("/assets/font-runes-hd.png", "/assets/__no-runes-ext__.png").then((f) => {
      this.hdRunes = f;
      this.presentForce = true;
    });

    // AGUA xBRZ pre-horneada (water-look): engancha el sumidero de celdas de agua y
    // carga el atlas. Async, no bloquea; si falta el asset, el agua queda con el xBR
    // propio (el overlay se salta cuando el atlas no está completo).
    this.faithful.setWaterSink(this.waterSink);
    const wa = new Image();
    wa.onload = () => {
      this.waterAtlas = wa;
      this.presentForce = true; // el overlay de agua entra en la composición al llegar
    };
    wa.src = WATER_ATLAS_URL;

    // 2) Contenedor visible + canvas a escala entera (letterbox calcado de la fiel).
    this.aspectY = aspectStretchEnabled() ? ASPECT_CRT_43 : ASPECT_SQUARE;
    const container = document.createElement("div");
    container.className = "shader-skin";
    container.style.cssText =
      "display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#000;";
    const canvas = document.createElement("canvas");
    canvas.style.imageRendering = "pixelated";
    container.appendChild(canvas);
    root.appendChild(container);
    this.container = container;
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("ShaderSkin: sin contexto 2D");
    this.ctx = ctx;

    // 3) Recorte del viewport + upscaler (xBR WebGL, o nearest si no hay WebGL).
    const crop = document.createElement("canvas");
    crop.width = VIEWPORT.tiles * VIEWPORT.tile; // 176
    crop.height = VIEWPORT.tiles * VIEWPORT.tile;
    this.crop = crop;
    this.cropCtx = crop.getContext("2d", { willReadFrequently: true });
    this.upscaler = createUpscaler(SHADER_FACTOR);

    // Chrome vectorial: canvas propio a ×S, redibujado sólo cuando cambia la escala
    // (es estático). El `resizeHandler` lo (re)pinta con el backbuffer definitivo.
    const chrome = document.createElement("canvas");
    this.chrome = chrome;
    this.chromeCtx = chrome.getContext("2d");

    // 4) Letterbox: escala entera S sobre 320×(200·aspect), backbuffer a 320S×200S.
    this.resizeHandler = () => {
      const availW = container.clientWidth || SCREEN_W;
      const availH = container.clientHeight || SCREEN_H * this.aspectY;
      // Móvil vertical: el CSS del canvas LLENA fraccionalmente; escritorio: escala entera
      // EXACTA. El BACKBUFFER (supersample entero) sigue siendo entero en ambos casos — en
      // móvil se redondea HACIA ARRIBA para que el GPU renderice a mayor densidad que el
      // tamaño de display (nítido al reescalar). Fidelidad de escritorio intacta.
      const mobile = prefersMobileFit();
      const size = mobile
        ? mobileCanvasSize(availW, availH, this.aspectY)
        : faithfulCanvasSize(availW, availH, this.aspectY);
      // ALOJADA (layout partido): la escala la impone el anfitrión — ver `shaderScale`.
      const s = shaderScale(availW, availH, this.aspectY, mobile, this.hostedScale);
      this.scale = s;
      // Guardar por el TAMAÑO REAL del backbuffer, no por `s`: al re-montar la MISMA
      // instancia (F9), `this.scale` persiste pero el canvas es nuevo (default 300×150),
      // así que comparar contra `s` saltaría el redimensionado. Ver QA F9 2026-07-17.
      const bb = shaderCanvasSize(s);
      if (canvas.width !== bb.width || canvas.height !== bb.height) {
        canvas.width = bb.width;
        canvas.height = bb.height;
        // Rehacer el chrome vectorial al nuevo backbuffer (mismo criterio de guarda
        // que el canvas: por TAMAÑO real, no por `s`, robusto al re-montaje F9).
        if (this.chrome && this.chromeCtx) {
          this.chrome.width = bb.width;
          this.chrome.height = bb.height;
          drawVectorChrome(this.chromeCtx, s);
        }
      }
      // ALOJADA: la caja CSS del canvas no la ve nadie (el host es 0×0 y opacity:0) y
      // `size` ahí mide ~0, así que ponerla sólo serviría para confundir a quien inspeccione
      // el DOM. El anfitrión lee el BACKBUFFER, que es lo que acabamos de dimensionar.
      if (this.hostedScale == null) {
        canvas.style.width = `${size.width}px`;
        canvas.style.height = `${size.height}px`;
      }
      this.presentForce = true; // el backbuffer pudo redimensionarse/limpiarse
    };
    this.resizeHandler();
    window.addEventListener("resize", this.resizeHandler);

    // 5) Puntero → tap-tile (mapeo idéntico al de la fiel, sobre el canvas visible).
    this.pointerHandler = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = ((ev.clientX - rect.left) / rect.width) * SCREEN_W;
      const py = ((ev.clientY - rect.top) / rect.height) * SCREEN_H;
      const col = Math.floor((px - VIEWPORT.x) / VIEWPORT.tile);
      const row = Math.floor((py - VIEWPORT.y) / VIEWPORT.tile);
      if (col < 0 || row < 0 || col >= VIEW_WINDOW || row >= VIEW_WINDOW) return;
      tapRipple(ev.clientX, ev.clientY); // móvil: destello de confirmación del tap-a-caminar
      const snap = view.snapshot();
      intents.dispatch({
        type: "tap-tile",
        x: snap.center.x - VIEW_HALF + col,
        y: snap.center.y - VIEW_HALF + row,
      });
    };
    canvas.addEventListener("pointerdown", this.pointerHandler);

    // 5b) SCROLLBACK de consola (carril log-scroll) + SCROLL de listas de Ztats
    // del panel (carril panel-scroll): rueda/arrastre sobre el canvas VISIBLE →
    // reenvío por ZONA a la fiel (que pinta consola y panel y cuyo frameGen
    // dispara este present). Mismo mapeo cliente→320×200 que el tap. La zona del
    // panel sólo se captura con una lista de Ztats abierta (panelListOpen).
    this.wheelHandler = (ev: WheelEvent) => {
      if (pointInConsole(canvas, ev.clientX, ev.clientY, CONSOLE_RECT, SCREEN_W, SCREEN_H)) {
        ev.preventDefault();
        this.faithful.consoleScrollLines(wheelLines(ev.deltaY, ev.deltaMode));
        return;
      }
      if (
        this.faithful.panelListOpen &&
        pointInConsole(canvas, ev.clientX, ev.clientY, ZTATS_LIST_RECT, SCREEN_W, SCREEN_H)
      ) {
        ev.preventDefault();
        this.faithful.panelScrollLines(wheelLines(ev.deltaY, ev.deltaMode));
      }
    };
    canvas.addEventListener("wheel", this.wheelHandler, { passive: false });
    this.dragDownHandler = (ev: PointerEvent) => {
      const zone = pointInConsole(canvas, ev.clientX, ev.clientY, CONSOLE_RECT, SCREEN_W, SCREEN_H)
        ? ("console" as const)
        : this.faithful.panelListOpen &&
            pointInConsole(canvas, ev.clientX, ev.clientY, ZTATS_LIST_RECT, SCREEN_W, SCREEN_H)
          ? ("panel" as const)
          : null;
      if (!zone) return;
      this.consoleDrag = { id: ev.pointerId, lastY: ev.clientY, rest: 0, zone };
      try {
        canvas.setPointerCapture?.(ev.pointerId);
      } catch {
        /* jsdom/tests sin PointerCapture */
      }
    };
    this.dragMoveHandler = (ev: PointerEvent) => {
      const d = this.consoleDrag;
      if (!d || ev.pointerId !== d.id) return;
      const box = canvas.getBoundingClientRect();
      const rowPx = box.height / 25; // 200 px lógicos / 8 = 25 filas de texto
      const dy = ev.clientY - d.lastY + d.rest;
      const lines = dragLines(dy, rowPx);
      d.rest = dy - lines * rowPx;
      d.lastY = ev.clientY;
      if (lines !== 0) {
        if (d.zone === "panel") this.faithful.panelScrollLines(lines);
        else this.faithful.consoleScrollLines(lines);
      }
    };
    this.dragEndHandler = (ev: PointerEvent) => {
      if (this.consoleDrag?.id === ev.pointerId) this.consoleDrag = null;
    };
    canvas.addEventListener("pointermove", this.dragMoveHandler);
    canvas.addEventListener("pointerup", this.dragEndHandler);
    canvas.addEventListener("pointercancel", this.dragEndHandler);
    canvas.addEventListener("pointerdown", this.dragDownHandler);

    // 6) Bucle de presentación propio (pausado con la pestaña oculta, batería).
    this.visHandler = () => {
      if (document.hidden) this.stopPresent();
      else this.startPresent();
    };
    document.addEventListener("visibilitychange", this.visHandler);
    if (!document.hidden) this.startPresent();

    // Publica los contadores del cache de texto HD para medición viva (perf/shader-idle).
    (globalThis as unknown as { __hdcache?: unknown }).__hdcache = this.hdStats;
    // Y los del gate de suciedad del present (PERF-2): frames de rAF vs pintados.
    (globalThis as unknown as { __presentPerf?: unknown }).__presentPerf = this.presentStats;
    this.presentForce = true; // primer frame tras (re)montar: componer siempre (QA F9)
  }

  /** Compone un frame: frame fiel ×S nearest + viewport xBR encima. */
  private present(): void {
    const ctx = this.ctx;
    const src = this.srcCanvas;
    const up = this.upscaler;
    const cropCtx = this.cropCtx;
    if (!ctx || !src || !up || !cropCtx || !this.crop) return;
    const s = this.scale;
    const world = VIEWPORT.tiles * VIEWPORT.tile; // 176
    const bb = shaderCanvasSize(s);
    const wr = shaderWorldRect(s);
    const snap = this.view?.snapshot(); // memoizado por turno (PERF-1) → identidad = señal
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();

    // ── GATE DE SUCIEDAD (PERF-2): saltar el frame entero si nada pudo cambiar ──
    // (ver el comentario de `presentForce`). El quake se evalúa una vez y se reusa
    // en el paso (2f). Los tweens mantienen 60 fps mientras corren (scroll suave
    // intacto) e imprimen su frame de asentamiento (t=1) antes de dormirse.
    this.presentStats.frames++;
    const srcGen = this.faithful.sourceFrameGen;
    const qoff = this.faithful.quakeShiftPx(now);
    const transiting = this.faithful.transiting;
    const actorsTweening = now - this.actorStart < TWEEN_MS;
    const dirty =
      this.presentForce ||
      srcGen !== this.lastSrcGen ||
      snap !== this.lastSnapRef ||
      this.tween !== null ||
      actorsTweening ||
      !this.actorSettled ||
      snap?.mode === "combat" ||
      !!snap?.combatView ||
      qoff > 0 ||
      this.lastQuakeActive ||
      transiting ||
      this.lastTransitActive ||
      this.fountainGlass ||
      this.hdCacheVerify;
    if (!dirty) return;
    this.presentStats.painted++;
    this.presentForce = false;
    this.lastSrcGen = srcGen;
    this.lastSnapRef = snap ?? null;
    this.actorSettled = !actorsTweening;
    this.lastQuakeActive = qoff > 0;
    this.lastTransitActive = transiting;

    // PERF PROBE (fog-premul): registra el PERIODO entre frames y si hay tween activo, para medir
    // la cadencia del tween (frames/paso) sin depender de un vídeo. Opt-in: sólo escribe si algo
    // externo creó `globalThis.__fogperf = []` (consola/harness). Cero coste sin el array.
    // Tras PERF-2 mide el periodo entre frames PINTADOS (durante un tween se pinta cada rAF,
    // así que la cadencia del tween que persigue no cambia).
    const perf = (globalThis as { __fogperf?: { dt: number; tween: boolean }[] }).__fogperf;
    if (perf) {
      perf.push({ dt: this.lastPresentNow ? now - this.lastPresentNow : 0, tween: !!this.tween });
      if (perf.length > 4000) perf.shift();
    }
    this.lastPresentNow = now;
    // Vía TERRENO + ACTORES COMPUESTOS (base de la transparencia de actores). Se activa:
    //  · en WORLD con el toggle de scroll ON (movimiento suave + actores transparentes), o
    //  · en COMBATE siempre (sin scroll — el arena es fija; sólo interesa el compositado
    //    de fighters con fondo transparente). En ambos hace falta la capa de terreno.
    // Si no (world con scroll OFF, mazmorra), se usa la vía clásica: recorte pleno del
    // canvas fiel con los actores YA horneados → salida idéntica, sin componer nada aparte.
    // Durante un CRUCE DE MOONGATE la fiel pinta la secuencia scripted (salida sobre
    // el origen congelado / llegada con la puerta cerrándose sobre el party) SÓLO en
    // su canvas — `paintWorldInto` no la conoce. Si tirásemos de la vía motion
    // reconstruiríamos el mundo del snapshot y nos saltaríamos la animación (el
    // usuario, en shader con scroll, no la veía). Mientras dura el cruce caemos a la
    // vía de recorte PLENO del canvas fiel (paso 2, `drawImage(src, VIEWPORT…)`), que
    // SÍ lleva el transit. El tween ya está en SNAP en el cruce, así que no perdemos
    // interpolación. Ver FaithfulSkin.transiting.
    const useMotion =
      !!snap &&
      !!snap.terrainWindow &&
      !this.faithful.transiting &&
      ((snap.mode === "world" && this.motionScroll) ||
        (snap.mode === "combat" && this.transpMode !== "off"));

    // (1) Frame fiel entero → ×S NEAREST (chrome + texto byte-idéntico a la fiel).
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, SCREEN_W, SCREEN_H, 0, 0, bb.width, bb.height);

    // (1-ter) ENDGAME PANTALLA COMPLETA (fix endgame-pieles 2026-08-22): en las fases
    //      dissolve/storyHouse/storyDream/scroll/terminalFreeze la fiel pinta el FRAME
    //      ENTERO (320×200 sin chrome) y el binario compone cada página sobre un clear
    //      de (0,0)-(319,199) + present total (acta endgame-banda-limpieza-187) — la
    //      pantalla NO tiene UI que recomponer. Los pasos (1b)-(6) de abajo la
    //      recomponían igual (chrome vectorial, texto HD de la consola/roster, bandas):
    //      marco azul + oros + G/fecha fijos sobre la historia y texto solapado
    //      ilegible (defecto con capturas). El frame fiel del paso (1) ES el frame
    //      completo: presentarlo y NADA más. El tween se suelta para que un paso de
    //      mundo residual no mantenga `dirty` cada rAF (updateMotion ya no corre).
    if (snap?.endgameScene && endgameFullScreen(snap.endgameScene)) {
      this.tween = null;
      return;
    }

    // MAQUETA «fuente transparente» lectura 1 (`?mockFont=nobg`): repinta los interiores
    // del panel/consola con un degradado azul del chrome (fondo tematizado) TAPANDO el
    // texto negro de celda del paso (1); el pase (1b) re-blitea los glifos HD ENCIMA →
    // «el glifo flota sobre el fondo del panel», sin caja negra. NO-OP con el flag apagado.
    if (this.mockFont === "nobg") this.paintMockPanelBg(ctx, s);

    // (1b) TEXTO REMASTER HD (task #73): sobre el texto nearest del paso (1), en las
    //      MISMAS celdas que enumeró la fiel, desde el atlas HD. Sólo texto FUERA del
    //      viewport (el mundo lo filtra el paso 2) y fuera de las bandas cielo/vientos
    //      (las recompone el paso 4 nearest). Sin atlas cargado → se salta (nearest).
    if (this.hdCacheVerify) this.verifyHdCache(ctx, s);
    this.blitHdTextCached(ctx, s);

    // (2) VIEWPORT (world) → recorte 176×176 → upscaler → capa MUNDO offscreen (no al
    //     canvas visible directo: el cross-slide del motion compone esa capa después).
    const size = wr.size;
    this.ensureWorldCanvases(size);
    const wctx = this.worldCtx!;
    cropCtx.imageSmoothingEnabled = false;
    cropCtx.clearRect(0, 0, world, world);
    // Fuente del MUNDO: con motion, la fiel pinta la capa de TERRENO SOLO (sin actores
    // ni party) en el recorte; los actores se componen luego (2d). Sin motion (o si la
    // capa no está disponible), recorte PLENO del canvas fiel (actores horneados).
    const terrainOnly =
      useMotion && snap ? this.faithful.paintWorldInto(cropCtx, snap) : false;
    if (!terrainOnly) {
      cropCtx.drawImage(src, VIEWPORT.x, VIEWPORT.y, world, world, 0, 0, world, world);
    }
    const r = up.upscale(this.crop, world, world);
    wctx.imageSmoothingEnabled = r.smooth;
    wctx.clearRect(0, 0, size, size);
    wctx.drawImage(r.source, 0, 0, r.sw, r.sh, 0, 0, size, size);
    wctx.imageSmoothingEnabled = false;

    // (2b) AGUA xBRZ pre-horneada (water-look): sustituye la CLASE AGUA por el atlas
    //      (olas continuas, xBRZ de Zenju GPLv3) ENCIMA del xBR del mundo — el terreno
    //      queda con el xBR propio. Se compone en la MISMA capa mundo (worldCtx).
    //      Extraído a `paintWaterOverlay` (carril fix-agua-quake): el paso DECLINA durante
    //      el cruce de moongate y bajo una inversión heredada del recorte pleno, y en esa
    //      vía viaja con la sacudida — los porqués, con la medición, en el método.
    this.paintWaterOverlay(wctx, size, transiting, terrainOnly, snap, now, qoff * s);

    // (2b-bis) CONTORNO-TRANSPARENCIA DEL TERRENO (default ON, kill-switch `?contourTransp=off`):
    //      la FUENTE (0xd8–0xdb) y los BRASEROS/ANTORCHAS de suelo (fuego fn32) los hornea la
    //      fiel con su fondo negro exterior opaco. Aquí, ANTES del pase de niebla y de los
    //      actores (aviso del censo shader), se sustituye ese contorno por el suelo sintetizado
    //      y se reblitea el emisor recortado EN SU FRAME VIVO (fuente ciclada / llama fn32). Con
    //      el kill-switch = byte-idéntico. Ver `contour-transp.ts` / `paintContourTransp`.
    if (this.contourTransp && terrainOnly && snap?.terrainWindow) {
      this.paintContourTransp(wctx, size, snap.terrainWindow);
    }

    // (2b-ter) MAQUETA fuente translúcida (fountain-mockup, DESCARTADA por veredicto —
    //      se conserva tras flag por si se rescata como efecto aparte): vaso glass con
    //      alpha + cáustica/brillo. `?fountainGlass=1`; OFF → salida byte-idéntica.
    if (this.fountainGlass && snap) {
      this.overlayFountainGlass(wctx, snap.window, size, now);
    }

    // (2b-ter) CENSO DE TRANSPARENCIA — TERRENO (veredicto B, 1ª ola): force fields
    //      a alpha .55 del cuerpo, con el suelo de debajo sintetizado (vecino
    //      dominante) para verlo a través. Sobre la capa mundo (misma coordenada que el
    //      agua/fuente), ANTES de la niebla (aviso del censo: después se multiplicaría y
    //      desaparecería en mazmorra/noche). Sólo con terreno vivo; `?transp=off` lo apaga.
    if (this.transpWire && terrainOnly && snap) {
      this.overlayTranslucentTerrain(wctx, snap, size);
    }

    // (2b-quater) NIEBLA PRE-MULTIPLICADA (fog-premul): hornea la componente de niebla que
    //      DESLIZA con el terreno (oclusión de muros dentro del disco = ¬occlusionLit) DENTRO del
    //      bitmap de mundo, ANTES del cross-slide. Así el slide desliza un V1 YA velado, y como
    //      `prevWorld` (y por tanto `tweenV0`) se copia de este mismo bitmap, V0 hereda su propia
    //      veladura → el cross-slide junta dos imágenes YA correctas y ningún contenido ocluido
    //      asoma en la franja (no existe en los bitmaps). La caída del RADIO queda para la capa
    //      ANCLADA a pantalla (2c-bis). OFF (`?fogpremul=off`) → no se hornea (la vía vieja
    //      censura en el ctx principal). Sólo con terreno vivo + visMask. Ver bakeFogVeilMask.
    // (2c) MOVIMIENTO SUAVE (cross-slide): detecta el paso de 1 tile y compone la capa
    //      mundo deslizando V0 (sale) contra V1 (nuevo). Sin tween → blit directo.
    //      🔴 VA ANTES DEL HORNEADO desde el 08-08: el horneado necesita saber si hay paso ESTE
    //      frame y en qué dirección (ver `leftTheHaloThisStep`), y el tween se arma AQUÍ. El
    //      orden es inocuo para V0: `updateMotion` copia `tweenV0` de `prevWorld`, que es el
    //      bitmap del frame ANTERIOR (ya horneado con su propio campo), no el de éste.
    this.updateMotion(snap, now, size);
    // Parámetros del tween ACTIVO este frame (t + dirección), para que la niebla de
    // ciudad haga el MISMO cross-slide que el terreno. `null` en el frame de cierre
    // (prog.done) y sin tween → la niebla vuelve a su vía anclada-a-pantalla (settle
    // byte-idéntico al de hoy).
    let fogTween: { t: number; dx: number; dy: number } | null = null;
    let tweenNow: { prog: { t: number; done: boolean }; dx: number; dy: number } | null = null;
    if (this.tween) {
      const tw = this.tween;
      const prog = tweenProgress(now, tw.start, tw.durMs);
      if (prog.done) this.tween = null;
      else fogTween = { t: prog.t, dx: tw.dx, dy: tw.dy };
      tweenNow = { prog, dx: tw.dx, dy: tw.dy };
    }

    if (this.fogPremul && terrainOnly && snap?.visMask) {
      // 🔴 CARRY del filo TRASERO (reporte del usuario 08-08): durante el tween, el anillo que el
      // disco acaba de dejar atrás NO se hornea — su negrura le toca a la capa anclada a pantalla,
      // que lo barre conforme la casilla resbala fuera del halo. Sin esto la columna/fila trasera
      // se apagaba ENTERA en el primer fotograma. Ver `leftTheHaloThisStep` (motion.ts).
      // `null` sin tween y en el fotograma de cierre (`fogTween` ya es null ahí) ⇒ horneado de
      // siempre ⇒ asentamiento byte-idéntico.
      const vr0 = this.tweenVisRadiusV0;
      const vm0 = this.tweenVisMaskV0;
      const carry =
        fogTween && vm0 && vr0
          ? { visMask0: vm0, visRadius0: vr0, dx: fogTween.dx, dy: fogTween.dy }
          : null;
      this.bakeFogInto(
        this.worldCtx!,
        bakeFogVeilMask(
          snap.visMask,
          snap.visRadius ?? null,
          VIEW_WINDOW,
          this.fogVeilScratch,
          carry,
        ),
        size,
      );
    }

    if (tweenNow) {
      const prog = tweenNow.prog;
      const tw = tweenNow;
      const cell = size / VIEWPORT.tiles;
      // V0 (la fila/columna que SALE) desplazada -t·paso; el mundo NUEVO desplazado
      // +(1-t)·paso encima (cubre todo menos la franja saliente, que rellena V0).
      const raw = crossSlideOffsets(wr.x, wr.y, prog.t, tw.dx, tw.dy, cell);
      // PIXEL-SNAP (`?pixelsnap=1`): cuantiza el blit del mundo a píxel entero de dispositivo
      // (copia 1:1 sin resampleo → mata el shimmer del suelo). OFF → offsets sub-píxel de
      // siempre. En el settle (t=1) es un NO-OP → byte-idéntico. Ver `snapCrossSlide`.
      const off = this.pixelSnap ? snapCrossSlide(raw) : raw;
      ctx.save();
      ctx.beginPath();
      ctx.rect(wr.x, wr.y, size, size);
      ctx.clip();
      ctx.drawImage(this.tweenV0!, off.v0.x, off.v0.y);
      ctx.drawImage(this.worldCanvas!, off.v1.x, off.v1.y);
      ctx.restore();
    } else {
      ctx.drawImage(this.worldCanvas!, wr.x, wr.y);
    }
    // La capa mundo de ESTE frame es el V0 rodante para el próximo paso; su niebla/LOS
    // (visMask) es el V0 rodante de la niebla — se congela al armar el siguiente tween.
    this.prevWorldCtx!.clearRect(0, 0, size, size);
    this.prevWorldCtx!.drawImage(this.worldCanvas!, 0, 0);
    this.prevVisMask = snap?.visMask ?? null;
    this.prevVisRadius = snap?.visRadius ?? null;

    // (2c-bis) NIEBLA/LOS (scroll-shadows): la capa mundo va SIN censurar (terreno crudo que
    //      scrollea limpio); aquí se ennegrecen las celdas ocultas. La oscuridad tiene DOS
    //      orígenes con anclajes distintos y se DESCOMPONE durante el tween:
    //        · caída del RADIO de la party (halo pegado al Avatar central) → ANCLADA A
    //          PANTALLA (`paintFog` de `anchoredLitMask`) → el disco no hace bulge/snap al pasar;
    //        · sombra por OCLUSIÓN de muros (pegada a los edificios) → DESLIZA con el terreno
    //          (`paintFogSlide` de `occlusionLitMask`, dos campos) → testigo de ciudad (7044b7b7).
    //      En el settle (sin tween) o sin disco de radio, la vía anclada de siempre
    //      (`paintFog(visMask)`), byte-idéntica al render de hoy. Antes de los actores.
    if (terrainOnly && snap?.visMask) {
      const vr = snap.visRadius;
      if (this.fogPremul) {
        // PRE-MULTIPLICADA: la niebla que DESLIZA ya está horneada en el bitmap (2b-quater);
        // aquí sólo la capa ANCLADA A PANTALLA — la caída del RADIO (¬visMask ∩ ¬visRadius),
        // fija al Avatar central → el disco no deriva/bulge con el terreno (night-fog 5334e884).
        // Con disco pleno / sin radio (`vr` ausente) la unión ¬visMask ya está horneada entera
        // (anchoredLit sería todo 1 → paintFog no-op), así que se omite. Unión horneada+anclada
        // = ¬visMask → en el settle byte-idéntico a `paintFog(visMask)` (vía anclada de hoy).
        //
        // HALOS DE EMISOR DESLIZANTES (moongate-luz): durante el tween, los AGUJEROS de la
        // capa anclada que son luz de EMISOR (visMask==1 ∩ ¬visRadius — moongate, antorchas
        // de pared, braseros…) NO se anclan a pantalla (saltaban a tirones de tile mientras
        // el emisor deslizaba): se punzan a la posición DESLIZADA de su campo, z-order dueño
        // (V1 / franja-V0 gateada), base negra = ¬visRadius pura (pegada al Avatar; la luz
        // del disco party/antorcha queda anclada — punzarla deslizada haría derivar el halo,
        // regresión medida en el control). En el settle idéntico a `paintFog(anchoredLitMask)`.
        // Modelo puro: `anchoredFogSlideShowsBlack` (emitterGlowMask).
        if (vr) {
          const vm0 = this.tweenVisMaskV0;
          const vr0 = this.tweenVisRadiusV0;
          if (fogTween && vm0 && vr0) {
            this.paintAnchoredFogSlide(
              ctx,
              emitterGlowMask(vm0, vr0),
              // 🔴 Sólo desliza el halo de emisor que el campo VIEJO también veía; el que el paso
              // acaba de revelar va en `fresh`, anclado. Ver `carriedGlowMask` (motion.ts).
              carriedGlowMask(
                emitterGlowMask(snap.visMask, vr),
                vm0,
                fogTween.dx,
                fogTween.dy,
                VIEW_WINDOW,
              ),
              vr,
              // Gate de la LUZ SALIENTE que sobrevive al paso (4): la visibilidad del campo
              // NUEVO, no su halo de emisor. Ver `survivingGlowMask` (motion.ts).
              snap.visMask,
              // AGUJEROS ANCLADOS (offset 0), dos clases que se punzan juntas:
              //  · SUELO DE LUZ PERSISTENTE (ficha #34): lo iluminado antes Y después del paso no
              //    puede ennegrecerse en medio (`persistentLitMask`);
              //  · 🔴 LUZ NUEVA del paso (08-08): lo que el paso revela aparece en su posición
              //    DEFINITIVA, no un tile por delante (`freshLitMask`). Su unión con el halo
              //    deslizado de `carriedGlowMask` es `visMask1` entero ⇒ reposo intacto.
              this.anchoredHoles(vm0, snap.visMask, fogTween.dx, fogTween.dy),
              wr,
              size,
              fogTween,
            );
          } else {
            // PERF-4 (lote-perf): scratch reutilizado — anchoredLitMask sin alloc por frame.
            this.paintFog(ctx, anchoredLitMask(snap.visMask, vr, this.fogAnchoredScratch), wr, size);
          }
        }
      } else {
        // VÍA VIEJA (`?fogpremul=off`): niebla por máscaras por-frame sobre el terreno deslizado.
        const vr0 = this.tweenVisRadiusV0;
        if (fogTween && this.tweenVisMaskV0 && vr && vr0) {
          this.paintFog(ctx, anchoredLitMask(snap.visMask, vr, this.fogAnchoredScratch), wr, size);
          this.paintFogSlide(
            ctx,
            // FUGA DEL FILO DEL DISCO (fog-rim): `occlusionLit` se construye con el disco
            // ALCANZABLE POR EL DESLIZAMIENTO, no con el crudo. Con el crudo, una casilla oculta
            // y FUERA del disco tiene occlusionLit=1 (delega su negrura en la capa anclada) y la
            // capa deslizante la revela al arrastrarla bajo una celda de pantalla que SÍ está
            // dentro del disco — donde la anclada no pinta. Medido 2,58 celdas de terreno
            // destapado a t=0 en esta misma vía. Ver `slideReachableDisc` (motion.ts).
            occlusionLitMask(
              this.tweenVisMaskV0,
              slideReachableDisc(vr0, VIEW_WINDOW, this.fogReachV0Scratch),
              this.fogOcclV0Scratch,
            ),
            occlusionLitMask(
              snap.visMask,
              slideReachableDisc(vr, VIEW_WINDOW, this.fogReachV1Scratch),
              this.fogOcclV1Scratch,
            ),
            wr,
            size,
            fogTween,
            // Disco de radio (anclado a pantalla) al que se RECORTA la capa deslizante: fuera de
            // él manda sólo la capa anclada. Cierra la fuga del borde entrante (una sala tapiada
            // FUERA del disco, con occlusionLit=1 por ¬visRadius, se revelaba deslizada mientras
            // la capa anclada la ennegrecía en pantalla → franja de terreno ocluido ~2 frames).
            vr,
          );
        } else if (fogTween && this.tweenVisMaskV0) {
          // Defensivo (sin disco de radio en el snapshot): cross-slide del visMask entero.
          this.paintFogSlide(ctx, this.tweenVisMaskV0, snap.visMask, wr, size, fogTween);
        } else {
          this.paintFog(ctx, snap.visMask, wr, size);
        }
      }
    }

    // (2d) ACTORES (motion piezas 2/3): sobre el terreno ya deslizado, cada actor se
    //      compone en su celda de ventana INTERPOLADA (from→to por id, mismo reloj que
    //      el scroll → pegado a su terreno) con su frame animado. Sólo con la capa de
    //      terreno viva; sin motion los actores ya van horneados en el recorte pleno.
    if (terrainOnly && snap) this.paintActors(ctx, snap, now, wr, size);

    // (2d-bis) TRANSPARENCIA DE ACTORES DEL ENDGAME (#367): en las fases de SALA del
    //      cierre el viewport viene por RECORTE PLENO (`terrainWindow` no se puebla —
    //      poblarlo perdería dissolve + tinte fn36 + gate/orb + fuego recoloreado, las
    //      cuatro pérdidas medidas por medición-367) y los actores llegan HORNEADOS con
    //      su cuadrado negro (`bakeEndgameRoom`), la misma clase que #363/#366. Aquí se
    //      re-compone LOCALMENTE cada celda de actor sobre lo ya estampado: suelo
    //      sintetizado (vecino dominante, maquinaria de contour-transp) + sprite
    //      recortado del atlas RECOLOREADO del endgame. En fase `dissolve` `actors`
    //      viaja vacío Y el predicado de fase declina → no-op por partida doble; el
    //      dissolve/gate/orb/tinte siguen viajando en el recorte pleno, intocados.
    if (!terrainOnly && snap?.endgameScene) {
      this.paintEndgameActorTransp(ctx, snap.endgameScene, wr, size);
    }

    // (2e) OVERLAYS DE COMBATE recompuestos: al re-renderizar el viewport de combate por
    //      nuestra cuenta (arena + fighters transparentes), se pierden la caja del activo,
    //      la retícula de aim y los fx efímeros que la fiel hornea en SU canvas. Se
    //      recomponen aquí ENCIMA de los fighters (como en el original), escalando el
    //      pintado 16px viewport-relativo de la fiel al rect del viewport del shader.
    if (terrainOnly && snap?.combatView) {
      const cell = size / VIEWPORT.tiles;
      ctx.save();
      ctx.beginPath();
      ctx.rect(wr.x, wr.y, size, size);
      ctx.clip();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(wr.x, wr.y);
      ctx.scale(cell / VIEWPORT.tile, cell / VIEWPORT.tile);
      ctx.translate(-VIEWPORT.x, -VIEWPORT.y);
      // Fase en ticks de ~55 ms como la fiel: recuadro del activo a ~9 Hz (careo T3,
      // phase&1 dentro) y retícula a ~110 ms (phase>>1 dentro).
      paintCombatOverlays(ctx, snap.combatView, Math.floor(now / 55));
      this.faithful.paintCombatFxInto(ctx, now); // proyectil / impacto / flash vivos
      ctx.restore();
    }

    // (2e-bis) FX DEL MUNDO (#243) — el gemelo de (2e) para FUERA de la arena: las siete
    //      explosiones del ritual del Shadowlord (`CAST 0x16f4`) y el sprite que sigue debajo.
    //      Mismo motivo que (2e) y que (2f): al recomponer el viewport por nuestra cuenta se
    //      pierde lo que la fiel hornea en SU canvas. Sin este paso la piel de FÁBRICA no
    //      pintaba la explosión NUNCA — que es el «no hay ningún efecto explosión» del reporte
    //      del usuario del 16-08, medido en `Shadowlords.MP4` (cero cambio de fotograma en
    //      toda la ventana de la ráfaga). Instancia de la CLASE #253 con el remedio de (2f)
    //      —volver a pintar—, no con el de View Gem —declinar—.
    //      La transformación es la MISMA de (2e) (el pintor de la fiel trabaja en coordenadas
    //      de VIEWPORT 320×200); va sin la ventana de combate porque este canal es de mundo.
    if (terrainOnly && this.faithful.worldFxActive) {
      const cell = size / VIEWPORT.tiles;
      ctx.save();
      ctx.beginPath();
      ctx.rect(wr.x, wr.y, size, size);
      ctx.clip();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(wr.x, wr.y);
      ctx.scale(cell / VIEWPORT.tile, cell / VIEWPORT.tile);
      ctx.translate(-VIEWPORT.x, -VIEWPORT.y);
      // `withProjectile=false` (#313): el cañonazo NO se recompone aquí — su pintor es
      // (2f-quater) `paintCannonball`, que corre en las DOS polaridades de #253; dejarlo
      // también en esta recomposición lo pintaría dos veces en la vía de terreno.
      this.faithful.paintWorldFxInto(ctx, now, false);
      ctx.restore();
    }

    // (2f) TERREMOTO (#29): sacudida VERTICAL de la VENTANA DE JUEGO. La `QuakeShake` vive
    //      en la fiel (la dispara el core `{kind:"quake"}` — clavicémbalo / palabra de poder
    //      / In Vas Por Ylem); la LEEMOS aquí porque el paso (2) recompone el viewport por
    //      nuestra cuenta y PISA el re-blit que la fiel hornea en su canvas oculto → sin esto
    //      la piel shader no temblaba. Re-blit del viewport ya compuesto (mundo+niebla+actores
    //      +overlays) desplazado ABAJO, recortado a la ventana, con el borde superior en negro
    //      — misma dinámica que la fiel: 2 px EGA → 2·s px de dispositivo, 8 pulsos, ~8.5 Hz.
    //      El marco/HUD/chrome (pasos 3-4) van DESPUÉS → quietos. NO-OP fuera del sismo.
    //      🔴 RE-APLICA SÓLO CUANDO EL PASO (2) RECOMPUSO EL VIEWPORT (`terrainOnly`) — el
    //      MISMO discriminante que `paintViewportInversions` (#345), y no una bandera
    //      paralela: la fiel hornea su `paintQuakeShift` en TODA vía de su render (camino
    //      normal Y rama transit, cabo de #359), así que el recorte pleno HEREDA el shift
    //      y repetirlo aquí desplaza 2·qoff. El gate `!transiting` de 5962ad37 sólo cubría
    //      el cruce; la MISMA doble suma vivía en motion OFF / mazmorra / combate transp=off
    //      — MEDIDA en vivo (carril fix-agua-quake, medicion-quake.mjs, correlación contra
    //      el reposo con ruido base 0): shader+motion OFF a dy=16 px (=2·2 px EGA a escala
    //      4, el DOBLE) con los controles a una suma (shader+motion ON dy=8; fiel dy=2
    //      lógicos). `transiting` fuerza `useMotion=false` ⇒ este gate SUBSUME al anterior.
    if (qoff > 0 && terrainOnly) this.paintQuakeShift(ctx, wr, qoff * s); // qoff evaluado en el gate

    // (2f-quater) VUELO DEL CAÑONAZO (#313) sobre el viewport ya compuesto. MISMA razón de
    //      existir que (2f) y (2f-ter): el paso (2) recompone el viewport y PISA lo que la
    //      fiel hornea en su canvas oculto, así que un fx que sólo viviera allí sería
    //      INVISIBLE en la piel DE FÁBRICA (main.ts:596) — la trampa #253 que este cableado
    //      tenía delante desde el encargo. La posición se le PREGUNTA a la fiel
    //      (`worldFxProjectileAt`, pura): la capa y su ciclo de vida son suyos, aquí sólo se
    //      repinta. Va DESPUÉS del terremoto (viaja con la ventana sacudida, igual que en la
    //      fiel) y ANTES de las inversiones (la bala es contenido del mundo: si el XOR entra,
    //      la invierte con todo lo demás, como en 1988).
    this.paintCannonball(ctx, wr, size, now);

    // (2f-septies) APARICIÓN DEL CAMP (fix endgame-pieles, aviso del lead 22-08 — 3ª
    //      instancia MEDIDA de la clase #253 en su polaridad PÉRDIDA, tras #201 y #313):
    //      la figura 0x174 en la hoguera + los despiertos por pulso + los pulsos de
    //      inversión los pinta la fiel SOBRE SU canvas (`paintApparitionInto`, después de
    //      su render normal); en la vía de terreno el paso (2) recompone el viewport y
    //      los PISABA (careo A/B del carril de regrabación: 22 capturas por piel, la fiel
    //      con figura y pulsos, la shader sin nada). Mismo patrón que (2e)/(2e-bis):
    //      transformar el ctx al espacio 320×200 del pintor fiel y REUSAR su pintor (una
    //      copia literal del bloque es la que se desincroniza). Va ANTES de (2f-bis/ter),
    //      como en la fiel (worldFx → aparición → timeFlash).
    //      🔴 GATE `terrainOnly` — LAS DOS POLARIDADES de la clase #253 (memoria
    //      la-clase-253-tiene-dos-polaridades-perdida-y-duplicacion): en recorte pleno
    //      (`!terrainOnly`, motion OFF / transit) el frame fiel YA trae la aparición y
    //      repintarla DUPLICARÍA — dos `difference` blancos se CANCELAN y el pulso
    //      desaparecería, el mismo síntoma que la pérdida.
    if (terrainOnly && this.faithful.apparitionActive && snap) {
      const cell = size / VIEWPORT.tiles;
      ctx.save();
      ctx.beginPath();
      ctx.rect(wr.x, wr.y, size, size);
      ctx.clip();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(wr.x, wr.y);
      ctx.scale(cell / VIEWPORT.tile, cell / VIEWPORT.tile);
      ctx.translate(-VIEWPORT.x, -VIEWPORT.y);
      this.faithful.paintApparitionInto(ctx, snap.campScene);
      ctx.restore();
    }
    // (2f-bis) + (2f-ter) LAS DOS INVERSIONES XOR DEL VIEWPORT (#295) sobre el viewport YA
    //      COMPUESTO: (2f-bis) el rect SUELTO del rito (WELL DONE, estado del snapshot) y
    //      (2f-ter) el PAREADO del pergamino de tiempo (estado de la fiel). Comparten cuerpo
    //      en `paintViewportInversions` —que es lo que las hace SELLABLES fuera de este
    //      método de 500 líneas— y allí van sus dos etiquetas, la derivación y las dos
    //      restricciones medidas.
    //      🔴 INSTANCIA de la CLASE #253 (efecto que la fiel pinta y el shader TAPA al
    //      recomponer el viewport por su cuenta), la misma que destapó View Gem. Cierra LA
    //      INSTANCIA, no la clase — la adjudicación del remedio de clase es aparte. Y ojo al
    //      leerla: aquí el mecanismo NO es el de #253/viewgem. Allí el remedio fue que
    //      `paintWorldInto` DECLINARA; aquí declinar sería el error (una inversión sin mundo
    //      debajo no invierte nada) y lo que faltaba era el paso de re-pintado. Misma clase,
    //      remedio OPUESTO: quien cierre la clase no puede suponer una sola cura.
    //      🔴 ORDEN, con su consecuencia dicha: van ANTES de (2g), así que si el apagón de
    //      cama coincidiera con una inversión, la cortina TAPA la inversión — y es lo
    //      correcto: (2g) «va el último y no es casual» por #296, y el XOR sobre su negro
    //      daría BLANCO. Son excluyentes en el producto (rito en el sobremundo / cama en
    //      pueblo), así que la precedencia no se ejerce; se declara para que el día que se
    //      ejerza nadie la lea como un descuido de numeración.
    this.paintViewportInversions(ctx, wr, size, snap, now, terrainOnly);

    // (2g) APAGÓN DEL SUEÑO EN CAMA (#296): el `fill_rect(8,8,0xb7,0xb7)` de CMDS 0x061a
    //      sobre el rect del viewport ya compuesto. Va AQUÍ —después de mundo/niebla/
    //      actores/overlays/terremoto y ANTES del chrome del paso (3)— porque el original
    //      apaga el INTERIOR de la ventana y deja el marco intacto.
    //      🔴 NO basta con que la fiel lo pinte en su canvas: este paso RECOMPONE el
    //      viewport por su cuenta (igual que el terremoto de (2f), y por eso (2f) existe).
    //      `paintWorldInto` ya declina con la cortina puesta, así que el recorte que llega
    //      aquí viene negro; este relleno es la GUARDA de precedencia — cubre también la
    //      vía motion, donde los actores se componen en (2d) sobre el recorte.
    if (snap?.bedBlackout) {
      ctx.fillStyle = DEFAULT_FRAME_COLORS.background; // kernel set_color(0) = negro EGA
      ctx.fillRect(wr.x, wr.y, size, size);
    }

    // (3) CHROME VECTORIAL encima (marco azul con esquinas exteriores redondeadas +
    //     bordes blancos nítidos): sustituye al chrome NEAREST del paso (1) en su
    //     misma zona; transparente en el interior del viewport (deja ver el xBR) y en
    //     los paneles/texto (deja ver el paso 1). El canvas del chrome ya está a ×S.
    if (this.chrome) ctx.drawImage(this.chrome, 0, 0);

    // (3b) PUENTE del filo IZQUIERDO del panel durante una página de Ztats/Ready. El
    //      chrome vectorial del paso (3) pinta la barra azul separadora viewport|panel a
    //      todo lo alto (x0xbf) y sólo restituye el filo blanco de las DOS sub-cajas del
    //      panel (roster y7..56 / food-gold y63..80), dejando AZUL el divisor y57..62. En
    //      reposo eso es correcto (dos cajas). Pero con una página de Ztats abierta el
    //      panel es UNA sola caja continua (como el original; la fiel ya funde el filo en
    //      su canvas base, pero el blit nearest del paso (1) queda TAPADO aquí por la barra
    //      azul del chrome vectorial). Se restituye ese puente y57..62 en blanco → filo
    //      izquierdo continuo (el derecho x312 ya lo hereda del nearest, el chrome no lo
    //      pinta). Sólo el tramo del divisor SUPERIOR; el inferior y80..87 queda intacto.
    // #283 — la ventana REGISTER de la posada entra en ESTA lista, no en una vía nueva:
    //      es el mismo caso de panel FUNDIDO en una sola caja (`panelOverlayKind` la
    //      clasifica como `full` porque SHOPPES3 0x0530 limpia hasta la fila 9), así que
    //      necesita el mismo puente del filo izquierdo y57..62. Sin esto la piel de
    //      FÁBRICA enseñaría el filo blanco cortado a la altura del segundo huésped.
    const panelOverlay =
      this.faithful.ztatsPageOpen ||
      snap?.readyPicker?.phase === "pick" ||
      snap?.innRegister != null;
    if (panelOverlay) {
      ctx.fillStyle = DEFAULT_FRAME_COLORS.border;
      ctx.fillRect(0xbf * s, 0x39 * s, s, (0x3e - 0x39 + 1) * s); // puente izq y57..62
    }

    // (4) Recomponer el contenido DINÁMICO que el chrome tapó.
    //   · BANDA CELESTE: se redibuja VECTORIAL (sol/lunas/remates) — los glifos rúnicos
    //     no pasan por el sumidero HD, así que aquí se les da el mismo trato vector que
    //     al chrome (no NEAREST). Sólo si el snapshot la trae (overworld de día/noche).
    //   · VIENTOS: fondo+texto NEAREST desde el canvas fiel, luego el texto se REALZA con
    //     el pase HD (los glifos cubiertos por el atlas) y los remates se redibujan
    //     VECTOR redondeados encima. El nearest queda de fallback para los glifos que el
    //     atlas HD aún no trae (p.ej. minúsculas) → nunca hay texto perdido.
    if (snap?.sky) {
      drawVectorSkyBand(
        ctx,
        s,
        skyMarks(snap.clock.hour, snap.sky.felucca, snap.sky.trammel),
        this.hdRunes,
      );
    } else {
      this.reblitStrip(SKY_STRIP);
    }
    this.reblitStrip(WINDS_STRIP);
    this.drawWindsBand(ctx, s);

    // (5) BANNER del panel (`►texto◄`: nombre del PJ en Ready, eje de páginas en Ztats,
    //     "Select:" al elegir jugador). Vive sobre la BARRA SUPERIOR azul (fila 0), que el
    //     chrome del paso (3) REPINTA — tapando la ventana negra + texto que el paso (1)
    //     había bliteado. Se recompone aquí, como cielo/vientos: reblit del tramo entre los
    //     dos remates desde el canvas fiel (ventana negra + texto nearest) + realce HD, y
    //     LUEGO los remates `►◄` VECTOR REDONDEADOS encima (tapan el remate bitmap nearest).
    this.restoreBannerText(ctx, s);
    for (const b of this.brkCommitted) {
      drawVectorNotch(ctx, b.x * s, b.y * s, 8 * s, b.mirror);
    }

    // (6) INDICADOR DE SCROLL del picker de (R)eady, VECTORIAL (carril chevron-scroll). El
    //     `►▲/▼/↕◄` de la banda azul bajo el pergamino lo pinta la FIEL en BITMAP
    //     (`drawReadyPicker` @ bandRow 10) y llega aquí por el blit nearest del paso (1): el
    //     chrome vectorial SALTA la barra interior del panel (no la repinta), así que se veía
    //     pixelado — a diferencia de los remates ►◄ de la banda celeste, que sí son vector. Se
    //     REPINTA en la misma familia: remates con `drawVectorNotch` (idéntico a cielo/vientos)
    //     y flecha central con `drawVectorScrollArrow` (glifo vector suave, como sol/lunas), en
    //     la MISMA posición y sólo con overflow. La piel fiel conserva su bitmap (es lo fiel).
    this.drawReadyScrollIndicator(ctx, s, snap);
    this.drawZtatsScrollIndicator(ctx, s, snap);
  }

  /**
   * Repinta VECTORIAL el indicador de scroll del picker de (R)eady (`►▲/▼/↕◄`) sobre el
   * blit nearest de la banda azul. Deriva posición y glifo de `readyArrowGlyph` + la
   * geometría de `READY_PICKER_RECT`/`MIX_REAGENT_RECT` (mismo cálculo que la fiel en
   * `drawReadyPicker`: banda en la fila `topRow+rows`, centrada en la columna media). Sólo
   * en fase `pick` con overflow (glifo != null).
   */
  private drawReadyScrollIndicator(
    ctx: CanvasRenderingContext2D,
    s: number,
    snap: ViewSnapshot | undefined,
  ): void {
    const view = snap?.readyPicker;
    if (!view || view.phase !== "pick") return;
    const glyph = readyArrowGlyph(view);
    if (glyph == null) return; // sin overflow → no hay indicador que repintar
    const rect = view.variant === "mix" ? MIX_REAGENT_RECT : READY_PICKER_RECT;
    const cols = rect.rightCol - rect.leftCol + 1;
    const rows = rect.botRow - rect.topRow + 1;
    const bandRow = rect.topRow + rows; // banda azul bajo el pergamino (fila 10 en Ready)
    const mid = rect.leftCol + Math.floor(cols / 2);
    this.paintScrollBandVector(ctx, s, glyph, mid, bandRow);
  }

  /**
   * Repinta VECTORIAL el indicador de scroll de las listas de Ztats (Spells/Reagents/
   * Items/Armaments), gemelo del de Ready: el original lo pinta con el MISMO kernel
   * 0x6c0a (banda fija fila 10). Glifo y overflow los da la piel fiel (`ztatsScrollGlyph`);
   * la geometría de `ZTATS_LIST_RECT` fija la col media (31) y la banda una fila bajo el
   * pergamino (topRow+ROWS+2 = 10). El bitmap ya lo aportó `paintFaithful` (blit nearest).
   */
  private drawZtatsScrollIndicator(
    ctx: CanvasRenderingContext2D,
    s: number,
    snap: ViewSnapshot | undefined,
  ): void {
    if (!snap) return;
    const glyph = this.faithful.ztatsScrollGlyph(snap);
    if (glyph == null) return;
    const cols = ZTATS_LIST_RECT.rightCol - ZTATS_LIST_RECT.leftCol + 1;
    const mid = ZTATS_LIST_RECT.leftCol + Math.floor(cols / 2);
    const bandRow = ZTATS_LIST_RECT.topRow + ZTATS_LIST_ROWS + 2;
    this.paintScrollBandVector(ctx, s, glyph, mid, bandRow);
  }

  /**
   * Traza el `►flecha◄` VECTORIAL de una banda de scroll en la col media `mid`, fila
   * `bandRow`. Ennegrece la ventana de 3 celdas (como la fiel) y dibuja los dos remates
   * (`drawVectorNotch`, idéntico a cielo/vientos) + la flecha central (`drawVectorScroll
   * Arrow`). Compartido por Ready y Ztats (misma banda del kernel 0x6c0a).
   */
  private paintScrollBandVector(
    ctx: CanvasRenderingContext2D,
    s: number,
    glyph: number,
    mid: number,
    bandRow: number,
  ): void {
    const cell = 8 * s;
    // Ventana negra de 3 celdas (fiel: fillRect en (mid-1), ancho 3) — los remates y la
    // flecha van sobre negro, igual que el sky band. Tapa el bitmap nearest de debajo.
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = DEFAULT_FRAME_COLORS.background;
    ctx.fillRect((mid - 1) * cell, bandRow * cell, 3 * cell, cell);
    // El dorso del chevron de `drawVectorNotch` cae en X(1) = 1 px lógico DENTRO de la
    // celda, así que un remate colocado en el borde de celda deja una línea negra de 1 px
    // lógico entre la banda azul y su chevron (veredicto del usuario sobre el zoom del
    // Ready). Se corrige desplazando cada remate 1 px lógico HACIA su banda (`nudge = s`,
    // = cell/8): el dorso azul aterriza justo en el borde de la banda (unión limpia a
    // cualquier zoom, sin solape — el fillRect negro interno del notch arranca en el borde,
    // no invade la banda). La flecha central NO se toca.
    const nudge = s; // 1 px lógico en px de dispositivo (cell/8)
    drawVectorNotch(ctx, (mid - 1) * cell - nudge, bandRow * cell, cell, false); // ► pegado a banda izq
    drawVectorScrollArrow(ctx, mid * cell, bandRow * cell, cell, glyph); // flecha central
    drawVectorNotch(ctx, (mid + 1) * cell + nudge, bandRow * cell, cell, true); // ◄ pegado a banda der
  }

  /**
   * Recompone el TEXTO de los banners del panel tras el chrome del paso (3). Los remates
   * `►◄` se enumeran por pares (apertura `mirror=false` + cierre `mirror=true`) en la misma
   * fila; entre ellos la piel fiel pinta una ventana NEGRA con el texto (skin.ts 0x6c70):
   * de `openX+8` a `closeX`. Se reblitea ese tramo del canvas fiel (fondo negro + texto,
   * nearest) y se REALZA con el atlas HD los glifos capturados que caen ahí (los no cubiertos
   * por el atlas quedan en el nearest de debajo → nunca hay texto perdido). Sin este paso el
   * banner salía como barra azul vacía entre dos remates (testigo del usuario 2026-07-18).
   */
  private restoreBannerText(ctx: CanvasRenderingContext2D, s: number): void {
    const src = this.srcCanvas;
    if (!src) return;
    const brk = this.brkCommitted;
    for (let i = 0; i + 1 < brk.length; i++) {
      const open = brk[i]!;
      const close = brk[i + 1]!;
      // Par válido = apertura seguida de cierre en la misma fila, cierre a la derecha.
      if (open.mirror || !close.mirror || open.y !== close.y || close.x <= open.x + 8) continue;
      const y = open.y;
      const x0 = open.x + 8; // primera celda tras el remate de apertura
      const w = close.x - x0; // ancho de la ventana negra + texto (hasta el cierre)
      // Reblit del tramo (ventana negra + texto) desde el canvas fiel, NEAREST ×S.
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(src, x0, y, w, 8, x0 * s, y * s, w * s, 8 * s);
      // Realce HD de los glifos del banner capturados en ese tramo (misma fila, dentro
      // del rango); los que el atlas no traiga dejan ver el nearest de debajo.
      if (this.hdFont) {
        ctx.imageSmoothingEnabled = true;
        for (const g of this.capCommitted) {
          if (g.y === y && g.x >= x0 && g.x < close.x) {
            this.hdFont.drawGlyph(ctx, g.code, g.x * s, g.y * s, 8 * s, g.color);
          }
        }
        ctx.imageSmoothingEnabled = false;
      }
    }
  }

  /**
   * Banda de vientos en la piel shader: sobre el reblit NEAREST (fondo+texto), realza los
   * glifos que la FIEL ya pintó en la fila 23 (capturados por el sumidero) EN SU MISMA
   * POSICIÓN, y redibuja los remates `►◄` VECTOR REDONDEADOS en los bordes de la banda.
   *
   * Antes recomputaba el rótulo con `${dir} Winds` INGLÉS FIJO en la col 6 — correcto sólo
   * en 'en'. En 'es' la fiel TRADUCE la banda (t(): «Viento Norte»/«Calma») y la CENTRA
   * (core/fiel de i18n-narrativa), así que el overlay inglés a col fija caía ENCIMA del
   * texto ES centrado → garble («Co0alMinds», testigo del usuario bajo shader+ES). Al
   * realzar los glifos REALES de la fiel (sea cual sea su texto y su centrado) la banda
   * queda correcta en 'en' (byte-idéntico: misma col 6/7) y en 'es' (sigue el centrado de
   * la fiel) SIN duplicar su fórmula — robusto a cambios del carril i18n.
   */
  private drawWindsBand(ctx: CanvasRenderingContext2D, s: number): void {
    const y = WINDS_ROW * 8; // fila lógica de la banda (px lógicos, como los glifos capturados)
    // SÓLO los glifos DENTRO de la ventana de vientos: la fila 23 también contiene el glifo
    // de ESQUINA inferior-izquierda del marco (rune 0x7d en x=0, FRAME_GLYPHS), que si entra
    // aquí contamina `minX`→0 y planta el remate ► vector en x=-8, dejando el bitmap ► real
    // sin tapar (= el ► IZQUIERDO pixelado que veía el usuario; el ◄ derecho no tiene glifo
    // de esquina gemelo en la fila 23, por eso salía bien). El filtro por x lo excluye.
    const wx0 = WINDS_STRIP.x;
    const wx1 = WINDS_STRIP.x + WINDS_STRIP.w;
    const cell = 8 * s;
    // UNA sola pasada sin `filter` intermedio (PERF-4): realce HD in-situ de los glifos
    // de la fiel (cubiertos por el atlas → HD; los no cubiertos dejan ver el nearest del
    // reblit, fallback por-glifo como la consola) mientras se acumula la extensión real
    // (min/max) para plantar los remates. Mismo orden de pintado que el filter previo.
    let minX = Infinity;
    let maxX = -Infinity;
    if (this.hdFont) ctx.imageSmoothingEnabled = true;
    for (const g of this.capCommitted) {
      if (g.y !== y || g.x < wx0 || g.x >= wx1) continue;
      if (g.x < minX) minX = g.x;
      if (g.x > maxX) maxX = g.x;
      if (this.hdFont) this.hdFont.drawGlyph(ctx, g.code, g.x * s, g.y * s, cell, g.color);
    }
    if (this.hdFont) ctx.imageSmoothingEnabled = false;
    if (minX === Infinity) return; // sin viento (o save pelón) → banda vacía, nada que rematar
    // Remates redondeados en los BORDES de la banda, derivados de la extensión real de los
    // glifos (► una celda a la izquierda del primero, ◄ una a la derecha del último) — casa
    // con los brackets de la fiel (`startPx` / `startPx+8+len·8`) sin recomputar su posición.
    drawVectorNotch(ctx, (minX - 8) * s, y * s, cell, false); // ► apertura
    drawVectorNotch(ctx, (maxX + 8) * s, y * s, cell, true); // ◄ cierre
  }

  /**
   * Crea/redimensiona las capas offscreen del cross-slide (mundo actual, V0 rodante,
   * V0 congelado del tween, overlay de niebla de ciudad), del tamaño del world rect
   * device. Resetea el tween al cambiar de escala (los offsets serían inválidos).
   */
  /**
   * MAQUETA fuente translúcida (fountain-mockup). Recorre la ventana 11×11 buscando celdas
   * de fuente (0xd8-0xdb) y les compone, sobre la capa mundo (`wctx`, ya con el xBR/agua),
   * un vaso de agua glass: (a) tinte acuático radial con alpha < 1 → el vaso de piedra
   * translucе; (b) cáustica anular que crece con el reloj; (c) reflejo especular fijo en el
   * borde superior; (d) brillo diagonal que deriva. Todo clipado a la lámina de agua (elipse
   * centrada, algo alta — el brocal ocupa el pie del tile). Familia vectorial limpia, sin
   * ruido; puro sobre el ctx (no muta estado del snapshot). Sólo se llama tras el flag. */
  private overlayFountainGlass(
    wctx: CanvasRenderingContext2D,
    window: Int16Array,
    size: number,
    now: number,
  ): void {
    const tiles = VIEWPORT.tiles; // 11
    const cell = size / tiles;
    // Fases de animación (ms → 0..1), suaves y desacopladas para que no lata al unísono.
    const ripple = (now % 2600) / 2600; // anillo de cáustica que crece y se desvanece
    const shimmer = (now % 3400) / 3400; // brillo diagonal que deriva de lado a lado
    for (let idx = 0; idx < tiles * tiles; idx++) {
      const tile = window[idx]!;
      if (!isFountainTile(tile)) continue;
      const col = idx % tiles;
      const row = (idx - col) / tiles;
      const x0 = col * cell;
      const y0 = row * cell;
      // Lámina de agua: elipse centrada horizontalmente, subida ~4% (el brocal es el pie).
      const cx = x0 + cell * 0.5;
      const cy = y0 + cell * 0.46;
      const rx = cell * 0.4;
      const ry = cell * 0.34;

      wctx.save();
      wctx.beginPath();
      wctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      wctx.clip();

      // (a) Tinte de profundidad: cian claro translúcido al centro → teal al borde. Alpha
      //     bajo → el agua/piedra horneada asoma por debajo (lectura translúcida).
      wctx.globalCompositeOperation = "source-over";
      const tint = wctx.createRadialGradient(cx, cy - ry * 0.2, rx * 0.1, cx, cy, rx);
      tint.addColorStop(0, "rgba(150,214,240,0.14)");
      tint.addColorStop(0.7, "rgba(58,150,196,0.26)");
      tint.addColorStop(1, "rgba(20,74,116,0.40)");
      wctx.fillStyle = tint;
      wctx.fillRect(x0, y0, cell, cell);

      // (b) Cáustica: dos anillos concéntricos que crecen desde el centro y se apagan al
      //     llegar al borde — la firma clásica del agua, en trazo limpio.
      wctx.globalCompositeOperation = "screen";
      wctx.lineWidth = Math.max(1, cell * 0.03);
      for (const off of [0, 0.5]) {
        const p = (ripple + off) % 1;
        const rr = rx * (0.2 + p * 0.85);
        const a = 0.26 * (1 - p) * (1 - p);
        wctx.beginPath();
        wctx.ellipse(cx, cy, rr, rr * (ry / rx), 0, 0, Math.PI * 2);
        wctx.strokeStyle = `rgba(210,240,255,${a.toFixed(3)})`;
        wctx.stroke();
      }

      // (c) Brillo diagonal que deriva: banda especular suave cruzando la lámina.
      const sx = x0 + cell * (0.15 + shimmer * 0.7);
      const glare = wctx.createLinearGradient(sx - cell * 0.12, y0, sx + cell * 0.12, y0 + cell);
      glare.addColorStop(0, "rgba(255,255,255,0)");
      glare.addColorStop(0.5, "rgba(230,248,255,0.15)");
      glare.addColorStop(1, "rgba(255,255,255,0)");
      wctx.fillStyle = glare;
      wctx.fillRect(x0, y0, cell, cell);

      // (d) Reflejo especular fijo: arco brillante en el labio superior de la lámina.
      const spec = wctx.createRadialGradient(
        cx - rx * 0.28,
        cy - ry * 0.55,
        0,
        cx - rx * 0.28,
        cy - ry * 0.55,
        rx * 0.55,
      );
      spec.addColorStop(0, "rgba(255,255,255,0.32)");
      spec.addColorStop(1, "rgba(255,255,255,0)");
      wctx.fillStyle = spec;
      wctx.fillRect(x0, y0, cell, cell);

      wctx.restore();
    }
    wctx.globalCompositeOperation = "source-over";
  }

  /**
   * CENSO DE TRANSPARENCIA — TERRENO (veredicto B, 1ª + 2ª ola). Recorre la ventana de
   * terreno (`terrainWindow`). 1ª ola: FORCE FIELD (488-491) — la MOONGATE (0xDC) estuvo
   * aquí y NO está (ver abajo). 2ª ola: BOUNDARY del shadowlord (112-127, misma vía que
   * los fields — «bruma») y BLUE FLAME (0xDE, llama viva a .55). Por cada FORCE
   * FIELD (488-491) reemplaza en la capa mundo el tile OPACO ya
   * horneado por: (1) el SUELO de debajo SINTETIZADO —copia de los píxeles ya
   * filtrados (xBR+agua) de la celda vecina de suelo DOMINANTE, calzando el filtro del
   * entorno sin re-renderizar; (2) el cuerpo del tile a alpha `BODY_ALPHA` encima
   * (recorte con el fondo negro exterior ya a alpha 0). Si no hay vecino de suelo
   * utilizable la celda se deja intacta (nunca se pinta negro «a ciegas»). Trabaja en
   * `wctx` ANTES de la niebla y de los actores.
   *
   * 🔴 LA MOONGATE YA NO PASA POR AQUÍ. Esta línea decía «sólo se translucida con la
   * puerta ENTERA (etapa 16)» y siguió diciéndolo después de que el cuerpo del método
   * retirara la moongate por veredicto del usuario (2026-07-22, ver el comentario al
   * final). NO QUEDA rama de etapa 16 que disparar: quien leyera esto montaba la escena
   * nocturna, subía la puerta a 16 y obtenía un par A/B **byte-idéntico** sin entender
   * por qué. Costó DOS intentos de captura, de dos carriles distintos.
   *
   * Un comentario en presente sobre código que se quitó no envejece: miente, y con el
   * aval de estar pegado al código que lo desmiente. Y no vino solo — la retirada tocó
   * UN sitio y la prosa que la describía estaba en SEIS.

   */
  private overlayTranslucentTerrain(
    wctx: CanvasRenderingContext2D,
    snap: ViewSnapshot,
    size: number,
  ): void {
    const atlas = this.faithful.spriteAtlas;
    const world = this.worldCanvas;
    const tw = snap.terrainWindow;
    if (!atlas || !world || !tw) return;
    const N = VIEW_WINDOW;
    const cell = size / VIEWPORT.tiles;

    // Copia el suelo de la celda vecina DOMINANTE (ya renderizada) sobre (col,row), y
    // devuelve true si lo consiguió. `world` es la capa mundo (= contexto de wctx): leemos
    // de un vecino no tocado aún → xBR-exacto. Sin vecino de suelo → false (celda intacta).
    const synthUnderlay = (col: number, row: number): boolean => {
      const srcIdx = dominantFloorNeighborIdx(tw, N, col, row, isCensusTerrainTile);
      if (srcIdx < 0) return false;
      const srcCol = srcIdx % N;
      const srcRow = (srcIdx - srcCol) / N;
      wctx.imageSmoothingEnabled = false;
      wctx.drawImage(
        world,
        srcCol * cell,
        srcRow * cell,
        cell,
        cell,
        col * cell,
        row * cell,
        cell,
        cell,
      );
      return true;
    };

    // Blitea el recorte del tile a alpha .55 sobre (col,row).
    const blitBody = (tile: number, col: number, row: number): void => {
      const cut = this.actorTransparency.bodyAlpha(atlas, tile, BODY_ALPHA);
      if (!cut) return;
      wctx.drawImage(cut, 0, 0, ATLAS_TILE, ATLAS_TILE, col * cell, row * cell, cell, cell);
    };

    // BLUE FLAME (0xDE): emisor animado por RUIDO fn32 (no cicla su id). Se translucida su
    // FRAME VIVO —no el recorte estático del atlas (congelaría la llama)— sobre el suelo ya
    // sintetizado. Igual patrón que `paintContourTransp` (fireCanvasFor + clipLiveFlame) pero
    // con globalAlpha `BODY_ALPHA` en el blit. Sin capa de fuego (tests) cae al recorte estático.
    const phase = this.faithful.animPhase;
    const groups = this.faithful.animGroups;
    const blitLiveFlameAlpha = (tile: number, col: number, row: number): void => {
      const frame = animatedFrame(tile, phase, groups);
      const cut = this.actorTransparency.tile(atlas, frame, false);
      if (!cut) return;
      const flame = isFireTile(frame) ? this.faithful.fireCanvasFor(frame) : null;
      const clipped = flame ? this.clipLiveFlame(flame, cut) : null;
      const src = clipped ?? cut;
      wctx.save();
      wctx.globalAlpha = BODY_ALPHA;
      wctx.imageSmoothingEnabled = false;
      wctx.drawImage(src, 0, 0, ATLAS_TILE, ATLAS_TILE, col * cell, row * cell, cell, cell);
      wctx.restore();
    };

    // TERRENO de la ventana: force fields + boundary del shadowlord → suelo + cuerpo .55;
    // blue flame → suelo + llama viva .55. El agua (river/corner/waterfall) NO se toca: la
    // trata la capa `waterfn32` (ya animada) → no doble-tratar. Ventanas: carril aparte.
    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        const tile = tw[row * N + col] ?? -1;
        if (TRANSLUCENT_FIELD_TILES.has(tile) || TRANSLUCENT_BOUNDARY_TILES.has(tile)) {
          if (!synthUnderlay(col, row)) continue; // aislado: se deja intacto
          blitBody(tile, col, row);
        } else if (tile === BLUE_FLAME_TILE) {
          if (!synthUnderlay(col, row)) continue;
          blitLiveFlameAlpha(tile, col, row);
        }
      }
    }

    // MOONGATE: RETIRADA del censo de translucidez por VEREDICTO DEL USUARIO
    // (2026-07-22, «El moongate no debe tener transparencia dentro» ×2 capturas):
    // la puerta se queda con el pintado OPACO de la capa fiel (que ya restaura el
    // color-0 EGA en el blit parcial). MOONGATE_TILE sigue en isCensusTerrainTile
    // solo como exclusión de suelo-donante para los fields vecinos.
  }

  private ensureWorldCanvases(size: number): void {
    const px = Math.max(1, Math.round(size));
    if (this.worldCanvas && this.worldSize === px) return;
    const mk = (): [HTMLCanvasElement, CanvasRenderingContext2D] => {
      const cv = document.createElement("canvas");
      cv.width = px;
      cv.height = px;
      const cx = cv.getContext("2d");
      if (!cx) throw new Error("ShaderSkin: sin contexto 2D para la capa mundo (motion)");
      return [cv, cx];
    };
    [this.worldCanvas, this.worldCtx] = mk();
    [this.prevWorld, this.prevWorldCtx] = mk();
    [this.tweenV0, this.tweenV0Ctx] = mk();
    [this.fogCanvas, this.fogCtx] = mk();
    this.worldSize = px;
    this.tween = null;
  }

  /**
   * Detecta el cambio de centro entre turnos y arma/limpia el tween de scroll:
   *  · paso de 1 tile (Manhattan==1) en mundo y misma location → TWEEN (congela V0).
   *  · salto multi-tile / cambio de location / no-mundo → SNAP (sin tween) [caveat 1].
   * `prevWorld` (mundo del frame anterior) es el V0 pre-paso en el instante de detectarlo.
   */
  private updateMotion(snap: ViewSnapshot | undefined, now: number, size: number): void {
    if (!snap || snap.mode !== "world") {
      this.tween = null;
      this.actorFrom.clear();
      this.actorTo.clear();
      this.actorRendered.clear();
      this.actorSig = "";
      this.lastActors = [];
      this.actorsExiting = [];
      this.lastCenter = snap ? { x: snap.center.x, y: snap.center.y } : null;
      this.lastLoc = snap?.locationName ?? "";
      this.lastMotionSnap = snap ?? null;
      return;
    }
    // PERF-4: con el snapshot memoizado por turno (PERF-1), el MISMO objeto implica que
    // ni el centro ni los actores pudieron cambiar → no hay nada que re-armar (antes se
    // construían Map+firma de actores en CADA frame de rAF antes de cualquier gate).
    // Un snapshot nuevo con contenido idéntico cae a la vía de siempre (delta 0 / misma
    // firma = no-op), así que esto sólo ahorra trabajo, nunca cambia la decisión.
    if (snap === this.lastMotionSnap) return;
    this.lastMotionSnap = snap;
    const c = snap.center;
    // Delta de centro del paso de scroll de 1 tile ARMADO este turno (kind==="tween"), o
    // `null` si no hubo scroll (hold/snap/motion off). Se pasa a `actorSlideFrom` para que
    // los actores que ENTRAN por el borde deslicen con el terreno en vez de aparecer clavados.
    let scrollStep: { dx: number; dy: number } | null = null;
    if (this.lastCenter) {
      const dx = c.x - this.lastCenter.x;
      const dy = c.y - this.lastCenter.y;
      const sameLoc = snap.locationName === this.lastLoc;
      const kind = classifyStep({
        dx,
        dy,
        sameLoc,
        motionEnabled: this.motionScroll,
        hasPrev: !!this.prevWorld,
      });
      if (kind === "tween") {
        this.tweenV0Ctx!.clearRect(0, 0, size, size);
        this.tweenV0Ctx!.drawImage(this.prevWorld!, 0, 0);
        // Congela la niebla/LOS pre-paso: durante el tween desliza con V0 (ciudad).
        this.tweenVisMaskV0 = this.prevVisMask;
        this.tweenVisRadiusV0 = this.prevVisRadius;
        this.tween = { start: now, durMs: TWEEN_MS, dx, dy };
        scrollStep = { dx, dy };
      } else if (kind === "snap") {
        this.tween = null; // SNAP (teleport, moongate, klimb, entrar/salir de location)
      }
      // "hold" (Manhattan==0, misma location): el tween en curso sigue su reloj.
    }
    this.lastCenter = { x: c.x, y: c.y };
    this.lastLoc = snap.locationName;

    // ACTORES: re-arma el tween de deslizamiento cuando cambia la FIRMA del turno
    // (celdas de actores + centro). `actorStart = now` casa con el reloj del scroll
    // cuando ambos ocurren en el mismo turno (mismo `now`) → el actor queda pegado a su
    // celda de terreno. El `from` es la posición REALMENTE compuesta el último frame
    // (no la del snapshot anterior) para no dar un salto si un turno rápido interrumpe
    // un tween en vuelo. Sin cambio de firma, el tween en curso sigue su reloj.
    // Firma primero, SIN materializar el Map (PERF-4): el Map de celdas sólo hace falta
    // si la firma cambió (re-armado del tween), es decir ~1 vez por turno, no por frame.
    let sig = `${c.x},${c.y}`;
    for (const a of snap.actors ?? []) {
      sig += `|${a.id}:${a.col},${a.row}`;
    }
    if (sig !== this.actorSig) {
      const cur = new Map<string, { col: number; row: number }>();
      for (const a of snap.actors ?? []) {
        cur.set(a.id, { col: a.col, row: a.row });
      }
      const from = new Map<string, { col: number; row: number }>();
      for (const [id, to] of cur) {
        from.set(id, actorSlideFrom(this.actorRendered.get(id), this.actorTo.get(id), to, scrollStep));
      }
      // SALIENTES por scroll: actores del turno anterior que ya no están y cuya celda
      // previa cruza el borde del paso (espejo de los ENTRANTES de actorSlideFrom).
      // Vacío si no hubo scroll → purga natural en cada turno no-scroll y al acabar.
      this.actorsExiting = exitingActors(this.lastActors, new Set(cur.keys()), scrollStep, VIEW_WINDOW);
      this.lastActors = (snap.actors ?? []).map((a) => ({ id: a.id, tile: a.tile, col: a.col, row: a.row }));
      this.actorFrom = from;
      this.actorTo = cur;
      this.actorStart = now;
      this.actorSig = sig;
    }
  }

  /**
   * NIEBLA/LOS FIJA A PANTALLA (scroll-shadows): ennegrece las celdas ocultas
   * (`visMask[i]===0`) en su posición de PANTALLA tile-aligned, recortado al viewport.
   * Como la capa mundo va SIN censurar (terreno crudo que scrollea), esta máscara —
   * anclada al centro (el Avatar), NO al terreno — mantiene la sombra pegada al Avatar
   * durante el cross-slide en vez de barrerla con el mundo. `cell` = 16·S entero, así que
   * los rects casan sin costuras. El disco de luz queda tile-alineado, como el del binario:
   * la derivación está en `core/world/visibility.ts:217` (0x6A9A — cada emisor proyecta su
   * disco de radio 10 con LOS propia sobre TERRENO, 0x5A28 vía 0x4402). Aquí sólo se
   * respeta esa rejilla; el radio y la LOS los decide el core, no esta capa.
   */
  /**
   * NIEBLA PRE-MULTIPLICADA (fog-premul): ENNEGRECE tile-aligned las celdas marcadas por `veil`
   * (1 = ocluir) DENTRO del bitmap de mundo `ctx` (worldCanvas, origen 0,0 — NO wr), antes del
   * cross-slide. `veil` = `bakeFogVeilMask` (oclusión de muros que desliza con el terreno). Como
   * el bitmap se vuelve a componer desde cero cada frame (clearRect+redraw), la veladura es
   * idempotente por frame; `prevWorld`/`tweenV0` la heredan al copiarse de este mismo bitmap.
   */
  private bakeFogInto(ctx: CanvasRenderingContext2D, veil: Uint8Array, size: number): void {
    const cell = size / VIEWPORT.tiles; // 16·S (entero)
    ctx.save();
    ctx.fillStyle = "#000000";
    for (let row = 0; row < VIEW_WINDOW; row++) {
      for (let col = 0; col < VIEW_WINDOW; col++) {
        if (veil[row * VIEW_WINDOW + col] === 1) {
          ctx.fillRect(col * cell, row * cell, cell, cell);
        }
      }
    }
    ctx.restore();
  }

  private paintFog(
    ctx: CanvasRenderingContext2D,
    visMask: Uint8Array,
    wr: { x: number; y: number; size: number },
    size: number,
  ): void {
    const cell = size / VIEWPORT.tiles; // 16·S (entero)
    ctx.save();
    ctx.beginPath();
    ctx.rect(wr.x, wr.y, size, size);
    ctx.clip();
    ctx.fillStyle = "#000000";
    for (let row = 0; row < VIEW_WINDOW; row++) {
      for (let col = 0; col < VIEW_WINDOW; col++) {
        if (visMask[row * VIEW_WINDOW + col] === 0) {
          ctx.fillRect(wr.x + col * cell, wr.y + row * cell, cell, cell);
        }
      }
    }
    ctx.restore();
  }

  /**
   * NIEBLA DE CIUDAD con CROSS-SLIDE (town-shadow-anchor): durante el tween la niebla/LOS
   * NO se ancla a pantalla sino que desliza con el terreno, cada campo con SU capa:
   *   · V1 (`visMask` nuevo) revela sus celdas iluminadas desplazadas +(1-t)·paso (entra
   *     con el mundo nuevo), y V0 (`maskV0`, congelado pre-paso) las suyas a -t·paso (sale
   *     con el mundo viejo). Una celda queda a OSCURAS sólo si NINGÚN campo la ilumina
   *     (unión de luz = intersección de sombra) → el disco de luz, cubierto por la unión de
   *     los dos discos solapados, no laggea; el borde LOS de los edificios desliza CON ellos.
   * Se compone en un overlay propio (negro + `destination-out` sobre las celdas iluminadas)
   * y se blitea recortado al viewport. En el settle (sin tween) se usa `paintFog` (anclado a
   * pantalla), byte-idéntico al de hoy: esta vía sólo corre MIENTRAS desliza.
   */
  private paintFogSlide(
    ctx: CanvasRenderingContext2D,
    maskV0: Uint8Array,
    maskV1: Uint8Array,
    wr: { x: number; y: number; size: number },
    size: number,
    tw: { t: number; dx: number; dy: number },
    discMask?: Uint8Array,
  ): void {
    const fctx = this.fogCtx;
    const fog = this.fogCanvas;
    if (!fctx || !fog) {
      this.paintFog(ctx, maskV1, wr, size); // defensivo: sin overlay, vía anclada
      return;
    }
    const cell = size / VIEWPORT.tiles;
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.globalCompositeOperation = "source-over";
    fctx.clearRect(0, 0, size, size);
    fctx.fillStyle = "#000000";
    fctx.fillRect(0, 0, size, size);
    const v1ox = (1 - tw.t) * tw.dx * cell;
    const v1oy = (1 - tw.t) * tw.dy * cell;
    const v0ox = -tw.t * tw.dx * cell;
    const v0oy = -tw.t * tw.dy * cell;
    const reveal = (mask: Uint8Array, ox: number, oy: number): void => {
      for (const c of litCells(mask, VIEW_WINDOW)) {
        fctx.fillRect(c.col * cell + ox, c.row * cell + oy, cell, cell);
      }
    };
    // Z-ORDER de la niebla (fog-zorder): el terreno dibuja V0 y ENCIMA V1 (mundo nuevo)
    // desplazado; V1 cubre todo el viewport salvo la franja saliente. La niebla lo respeta:
    // el DUEÑO de cada celda de pantalla (V1 donde cubre, si no V0) manda sobre SU propio
    // terreno, y el contrario NO aporta. Antes cada campo aportaba al contrario lo que vio
    // de verdad (`genuine*`=visMask) como suavizado del LOS que colapsa; pero en zona cubierta
    // por V1 el terreno visible es el de V1, así que revelar ahí una celda que V1 OCULTA
    // (tras un muro) destapa una habitación oculta → parpadeo (testigo occlusion-flash:
    // castillo LB). Sin poder distinguir suavizado de oclusión por celda, el mandato «cero
    // frames ocluidos» obliga a quedarse sólo con el dueño. Ver fogSlideRevealsCell (motion.ts).
    fctx.globalCompositeOperation = "destination-out";
    // (1) Campo V0 dueño en la FRANJA SALIENTE (el resto lo re-ennegrece V1). Su oclusión, pero
    //     GATEADA por la del frame NUEVO (outgoing-edge): una celda que V0 veía y V1 ya OCLUYE
    //     no se revela — nace velada al iniciar el tween (LOS instantáneo del original). Cierra
    //     la fuga del borde (testigo rooms-flash-post-b15: sala tapiada del este asomando en la
    //     franja al caminar). 🔴 La celda SIN CONTRAPARTE en la ventana nueva es OTRA COSA y no
    //     se vela: el campo nuevo no opina sobre ella. Ver `outgoingGatedMaskV0` (motion.ts).
    reveal(
      outgoingGatedMaskV0(maskV0, maskV1, tw.dx, tw.dy, VIEW_WINDOW, this.fogOutgoingScratch),
      v0ox,
      v0oy,
    );
    // (2) Región cubierta por V1: re-ennegrecer (borra los huecos de V0 ahí) y revelar la
    //     oclusión de V1. Fuera del rect (franja saliente) queda (1) = V0 dueño.
    fctx.save();
    fctx.beginPath();
    fctx.rect(v1ox, v1oy, size, size);
    fctx.clip();
    fctx.globalCompositeOperation = "source-over";
    fctx.fillStyle = "#000000";
    fctx.fillRect(0, 0, size, size);
    fctx.globalCompositeOperation = "destination-out";
    reveal(maskV1, v1ox, v1oy);
    fctx.restore();
    fctx.globalCompositeOperation = "source-over";
    ctx.save();
    ctx.beginPath();
    // RECORTE AL DISCO (occlusion-edge): con `discMask` (visRadius, anclado a pantalla), la
    // capa deslizante SÓLO se pinta DENTRO del disco de radio; fuera manda la capa anclada
    // (`paintFog`, ya pintada debajo). Sin `discMask` (vía defensiva sin radio) → viewport
    // pleno, como antes. Recorte a la UNIÓN de las celdas del disco ∩ rect del viewport; en
    // el settle el disco es idéntico frame-a-frame y V1 cubre todo → byte-idéntico a hoy.
    if (discMask) {
      const cellW = size / VIEWPORT.tiles;
      for (let row = 0; row < VIEW_WINDOW; row++) {
        for (let col = 0; col < VIEW_WINDOW; col++) {
          if (discMask[row * VIEW_WINDOW + col] === 1) {
            ctx.rect(wr.x + col * cellW, wr.y + row * cellW, cellW, cellW);
          }
        }
      }
    } else {
      ctx.rect(wr.x, wr.y, size, size);
    }
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fog, wr.x, wr.y);
    ctx.restore();
  }

  /**
   * CAPA ANCLADA del tween con HALOS DE EMISOR DESLIZANTES (moongate-luz, vía PREMUL).
   * Sustituye, SOLO durante el tween, al `paintFog(anchoredLitMask(visMask1, vr1))`:
   *   · base NEGRA = ¬vr1 (caída del radio pura, center-anchored — el halo de la party/
   *     antorcha va pegado al Avatar central, ese anclaje a pantalla es el correcto y su
   *     luz interior NO se punza deslizada: hacerlo haría derivar el halo con el terreno,
   *     regresión medida en el control de este carril);
   *   · AGUJEROS = halo de EMISOR de cada campo (`glowV0/glowV1` = emitterGlowMask =
   *     visMask ∩ ¬visRadius: moongate, antorchas de pared, braseros…) punzados con
   *     `destination-out` a la posición DESLIZADA de su campo, con el MISMO z-order dueño
   *     del terreno (V1 encima; franja saliente V0 GATEADA por outgoingGatedMaskV0 → LOS
   *     instantáneo, nunca revela terreno que el dueño de la celda oculta).
   * Así la mancha de luz de la moongate desliza CON la moongate (es geometría de mundo)
   * en vez de saltar a tirones de tile ancla-a-pantalla (defecto testigo del usuario).
   *   · SUELO de LUZ PERSISTENTE (`persist` = visMask0 ∩ visMask1, ficha #34): punzado
   *     ANCLADO y el ÚLTIMO — lo iluminado antes Y después del paso no puede ennegrecerse en
   *     medio. Sin él los dos punzados deslizados dejaban una CORTINA NEGRA de celdas enteras
   *     (la fila/columna del borde + un arco en el filo del disco) durante el tween. 🔴 De esas
   *     dos, la del BORDE ya no depende de este suelo desde el arreglo del gate (07-08): el
   *     borde de salida se apagaba aunque la celda NO fuese persistente — ver
   *     `outgoingGatedMaskV0`. Aquí queda el ARCO, que sí es un caso de persistencia.
   * La OCLUSIÓN dentro del disco no vive aquí: va horneada en los bitmaps (2b-quater).
   * En el settle (t=1: V1 a offset 0 cubre todo): negro ⟺ ¬vr1 ∩ ¬glowV1 = ¬vr1 ∩
   * ¬visMask1 = exactamente `paintFog(anchoredLitMask)` → transición continua y reposo
   * byte-idéntico (esta vía ni corre en reposo). Modelo puro: `anchoredFogSlideShowsBlack`.
   * Reutiliza `fogCanvas` (libre en la vía premul).
   */
  /** Unión de los dos punzados ANCLADOS del tween (luz persistente ∪ luz nueva del paso), sobre
   *  scratch propio para no alocar por frame (PERF-4). Ver `paintAnchoredFogSlide` (3). */
  private anchoredHoles(
    vm0: Uint8Array,
    vm1: Uint8Array,
    dx: number,
    dy: number,
  ): Uint8Array {
    const holes = persistentLitMask(vm0, vm1, this.fogPersistScratch);
    const fresh = freshLitMask(vm0, vm1, dx, dy, VIEW_WINDOW, this.fogFreshScratch);
    for (let i = 0; i < holes.length; i++) if (fresh[i] === 1) holes[i] = 1;
    return holes;
  }

  private paintAnchoredFogSlide(
    ctx: CanvasRenderingContext2D,
    glowV0: Uint8Array,
    glowV1: Uint8Array,
    vr1: Uint8Array,
    /** `visMask` del frame NUEVO: gate de `survivingGlowMask` (4). NO es `glowV1`: la casilla
     *  del anillo sigue VISIBLE tras el paso, sólo que su luz pasa a ser la del disco. */
    visMask1: Uint8Array,
    persist: Uint8Array,
    wr: { x: number; y: number; size: number },
    size: number,
    tw: { t: number; dx: number; dy: number },
  ): void {
    const fctx = this.fogCtx;
    const fog = this.fogCanvas;
    if (!fctx || !fog) {
      // Defensivo: sin overlay, vía anclada (glowV1 ∨ vr1 = visMask1 ∨ vr1 = anchoredLit).
      this.paintFog(ctx, anchoredLitMask(glowV1, vr1), wr, size);
      return;
    }
    const cell = size / VIEWPORT.tiles;
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.globalCompositeOperation = "source-over";
    fctx.clearRect(0, 0, size, size);
    fctx.fillStyle = "#000000";
    // Base ANCLADA: negro en ¬vr1 (fuera del disco de radio), tile-aligned en pantalla.
    const fillAnchoredBase = (): void => {
      for (let row = 0; row < VIEW_WINDOW; row++) {
        for (let col = 0; col < VIEW_WINDOW; col++) {
          if (vr1[row * VIEW_WINDOW + col] === 0) {
            fctx.fillRect(col * cell, row * cell, cell, cell);
          }
        }
      }
    };
    fillAnchoredBase();
    const v1ox = (1 - tw.t) * tw.dx * cell;
    const v1oy = (1 - tw.t) * tw.dy * cell;
    const v0ox = -tw.t * tw.dx * cell;
    const v0oy = -tw.t * tw.dy * cell;
    const reveal = (mask: Uint8Array, ox: number, oy: number): void => {
      for (const c of litCells(mask, VIEW_WINDOW)) {
        fctx.fillRect(c.col * cell + ox, c.row * cell + oy, cell, cell);
      }
    };
    fctx.globalCompositeOperation = "destination-out";
    // (1) Franja saliente (dueño V0): halo de emisor de V0 deslizado −t·paso, GATEADO por
    //     el halo del frame nuevo de la misma casilla de mundo (LOS instantáneo).
    reveal(outgoingGatedMaskV0(glowV0, glowV1, tw.dx, tw.dy, VIEW_WINDOW), v0ox, v0oy);
    // (2) Región cubierta por V1 (encima): restaurar la base anclada (borra los punzados
    //     de V0 ahí — el dueño manda) y punzar el halo de emisor de V1 a +(1−t)·paso.
    fctx.save();
    fctx.beginPath();
    fctx.rect(v1ox, v1oy, size, size);
    fctx.clip();
    fctx.globalCompositeOperation = "source-over";
    fctx.fillStyle = "#000000";
    fillAnchoredBase();
    fctx.globalCompositeOperation = "destination-out";
    reveal(glowV1, v1ox, v1oy);
    fctx.restore();
    // (3) SUELO DE LUZ PERSISTENTE (ficha #34): lo que está iluminado en el frame VIEJO Y en el
    //     NUEVO se punza ANCLADO (offset 0) y el ÚLTIMO, para que ninguna capa lo re-ennegrezca.
    //     Cerraba la CORTINA NEGRA que dejaban los punzados deslizados por DOS vías: (a) la
    //     fila/columna del borde entera —el gate velaba la casilla cuyo índice V1 cae fuera de la
    //     ventana— y (b) el arco del filo del disco (el hueco de emitterGlow viaja con su campo y
    //     tapa celdas que el disco ANCLADO ya no cubre). 🔴 (a) se arregló EN SU ORIGEN el 07-08
    //     (`outgoingGatedMaskV0`), porque el suelo sólo la tapaba cuando la celda seguía
    //     iluminada DESPUÉS del paso — y el borde de salida se apagaba igual cuando no. Aquí
    //     queda (b). Medido en el modelo puro: 14 celdas negras en t=0 y
    //     t=0.25 con la sala entera iluminada → 0. NO revela de más: sólo toca celdas que ya se
    //     veían iluminadas al empezar el paso (visMask0) y que lo seguirán estando al acabarlo
    //     (visMask1); en t=1 el punzado de V1 (offset 0) ya las cubría → asentamiento intacto.
    //     Modelo puro: `persistentLitMask` + `anchoredFogSlideShowsBlack`.
    // (4) 🔴 LUZ SALIENTE QUE SOBREVIVE AL PASO (vídeo del usuario, 22-08: «la pared en negro
    //     durante unos milisegundos»). Va DESPUÉS del refill de (2) —que borra a propósito los
    //     punzados de V0 en la región de V1— y punzada al offset DESLIZANTE de V0, porque es
    //     luz del campo VIEJO y viaja con él. Cierra el ANILLO del disco en la dirección de la
    //     marcha: esas celdas estaban FUERA del disco (luz de emisor, `glowV0=1`) y su índice
    //     NUEVO cae DENTRO (`vr1=1` ⇒ `glowV1=0` por construcción de `emitterGlowMask`), así que
    //     ni (1) —gateado por `glowV1`— ni (2) las punzaban y NACÍAN NEGRAS en t=0, con el
    //     cross-slide todavía a offset cero. Gate = `visMask1` de la MISMA casilla de mundo (no
    //     `glowV1`: la casilla sigue viéndose, sólo que ahora su luz es del disco). No mueve el
    //     asentamiento: en t=1 el gate exige `visMask1[S]==1`, que la vía de reposo ya ilumina.
    //     Modelo puro: `survivingGlowMask` + `anchoredFogSlideShowsBlack`.
    fctx.globalCompositeOperation = "destination-out";
    reveal(
      survivingGlowMask(glowV0, visMask1, tw.dx, tw.dy, VIEW_WINDOW, this.fogSurvivingScratch),
      v0ox,
      v0oy,
    );
    // (3) SUELO DE LUZ PERSISTENTE — el ÚLTIMO punzado, anclado (ver arriba).
    reveal(persist, 0, 0);
    fctx.globalCompositeOperation = "source-over";
    ctx.save();
    ctx.beginPath();
    ctx.rect(wr.x, wr.y, size, size);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fog, wr.x, wr.y);
    ctx.restore();
  }

  /**
   * Compone los ACTORES (party + errantes + NPC + botín) sobre el terreno ya deslizado:
   * cada uno en su celda de ventana INTERPOLADA `actorFrom`→`actorTo` por id (mismo
   * reloj/duración que el scroll, curva LINEAL → pegado a su terreno) y con su frame de
   * sprite animado (pieza 3 añadirá el cross-dissolve entre frames). Recortado al rect
   * del viewport. Guarda la posición compuesta (`actorRendered`) para re-arrancar sin
   * salto si un turno interrumpe el tween. Los saltos grandes (spawn/teleport) van secos.
   *
   * Pieza 3 (blend): cada actor animado FUNDE su frame actual con el siguiente del ciclo
   * de 4 por un reloj de pared continuo (SPRITE_TICK_MS·divisor por frame), en vez del
   * parpadeo discreto — suaviza el idle. Los tiles estáticos se pintan una vez.
   */
  private paintActors(
    ctx: CanvasRenderingContext2D,
    snap: ViewSnapshot,
    now: number,
    wr: { x: number; y: number; size: number },
    size: number,
  ): void {
    const actors = snap.actors;
    const atlas = this.faithful.spriteAtlas;
    if (!actors || actors.length === 0 || !atlas) {
      this.actorRendered.clear();
      return;
    }
    const groups = this.faithful.animGroups;
    const cell = size / VIEWPORT.tiles;
    // PASO DE MAMPOSTERÍA (#197): un actor cuya CELDA es un arco/entrada caminable se blitea
    // OPACO — ver `passageCell`. Se consulta la ventana de TERRENO cruda del snapshot.
    const tw = snap.terrainWindow;
    const t = clamp01((now - this.actorStart) / TWEEN_MS);
    // PERF-4: Map reciclado por doble-buffer (spare↔rendered) en vez de uno nuevo por frame.
    const rendered = this.actorRenderedSpare;
    rendered.clear();
    ctx.save();
    ctx.beginPath();
    ctx.rect(wr.x, wr.y, size, size);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    for (const a of actors) {
      // Las MOONGATES (id `g…`) NO se componen como actor: se animan (subida/bajada)
      // como overlay sobre la capa de terreno (`snap.moongates` en paintWorldInto).
      // Componerlas aquí las pintaría llenas encima, tapando esa animación.
      if (a.id[0] === "g") continue;
      let col = a.col;
      let row = a.row;
      const from = this.actorFrom.get(a.id);
      if (from) {
        // Sólo los pasos contiguos se deslizan; los saltos grandes (spawn/teleport)
        // se pintan secos en su celda nueva.
        const p = slideActor(from, { col: a.col, row: a.row }, t, ACTOR_STEP_MAX);
        col = p.col;
        row = p.row;
      }
      rendered.set(a.id, { col, row });
      // La celda que decide la opacidad es la LÓGICA (a.col/a.row), no la interpolada:
      // `terrainWindow` es la ventana del snapshot NUEVO, así que es con esas coordenadas
      // con las que casa. El binario no tiene tween; el deslizamiento es del port.
      this.paintActorSprite(
        ctx, atlas, groups, a.id, a.tile,
        wr.x + col * cell, wr.y + row * cell, cell, now,
        passageCell(tw, a.col, a.row),
      );
    }
    // SALIENTES por scroll (borde-saliente, espejo de los entrantes de actorSlideFrom):
    // actores que dejaron la ventana ESTE paso y ya no están en `snap.actors`. Se pintan
    // deslizando de su celda previa hacia fuera con el terreno, recortados al viewport
    // (en t=1 quedan fuera del clip = invisibles → byte-idéntico al render actual). Sólo
    // durante el tween de scroll; muerte/teleport no llenan `actorsExiting` (ver motion.ts).
    for (const ex of this.actorsExiting) {
      if (ex.id[0] === "g") continue; // moongates: overlay aparte, nunca como actor
      const p = slideActor(ex.from, ex.to, t, ACTOR_STEP_MAX);
      // SALIENTE: su destino ya está FUERA de la ventana, así que `passageCell` da false por
      // el chequeo de rango — el saliente conserva el recorte de siempre.
      this.paintActorSprite(
        ctx, atlas, groups, ex.id, ex.tile,
        wr.x + p.col * cell, wr.y + p.row * cell, cell, now,
        passageCell(tw, ex.to.col, ex.to.row),
      );
    }
    ctx.restore();
    this.actorRenderedSpare = this.actorRendered; // el viejo pasa a spare (se limpiará al reusar)
    this.actorRendered = rendered;
  }

  /**
   * (2d-bis) TRANSPARENCIA DE ACTORES DEL ENDGAME (#367) — ver el comentario del paso
   * en `present()` y el modelo puro en `endgame-transp.ts`. Por cada actor de la sala:
   *  (1) SUELO SINTETIZADO: copia de los píxeles YA renderizados del vecino de suelo
   *      dominante desde la capa mundo (`worldCanvas`, estampada en el paso (2) y no
   *      tocada después en la vía de recorte pleno) → el parche calza con el filtro;
   *  (2) SPRITE RECORTADO encima (fondo negro exterior → alpha 0, flood-fill), desde la
   *      instancia `endgameActorTransparency` alimentada con el atlas RECOLOREADO
   *      (fn36 ax=4) — nunca la instancia del atlas normal (su caché es por-atlas).
   * El recorte se resuelve ANTES de pintar el suelo: si aún no hay recorte (atlas sin
   * volcar) la celda se queda horneada como hoy — nunca un suelo sin actor encima. Sin
   * vecino de suelo utilizable → celda intacta (jamás pared ni negro a ciegas). El modo
   * `off` del setting de transparencia lo apaga (mismo mando que los actores de mundo);
   * `soft` usa la variante feathered; `avatar` se trata como `all` (los actores del
   * cierre SON el party + LB y no viajan con id — no hay a quién restringir).
   */
  private paintEndgameActorTransp(
    ctx: CanvasRenderingContext2D,
    eg: EndgameSceneView,
    wr: { x: number; y: number; size: number },
    size: number,
  ): void {
    if (this.transpMode === "off") return;
    if (!endgameTranspActive(eg)) return;
    const atlas = this.faithful.spriteAtlasEndgame;
    const world = this.worldCanvas;
    if (!atlas || !world) return;
    const N = VIEW_WINDOW;
    const cell = size / VIEWPORT.tiles;
    const tw = (this.endgameFloorScratch ??= new Int16Array(N * N));
    endgameFloorWindow(eg, N, tw);
    const soft = this.transpMode === "soft";
    ctx.save();
    ctx.beginPath();
    ctx.rect(wr.x, wr.y, size, size);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    for (const a of eg.actors!) {
      if (a.col < 0 || a.row < 0 || a.col >= N || a.row >= N) continue;
      // Actor ENTRANDO al gate (u orb encima): el overlay de la fiel ya lo tapa en el
      // recorte pleno — recomponer aquí destaparía el gate un frame. Celda intacta.
      if (endgameActorUnderOverlay(eg, a.col, a.row)) continue;
      const cut = this.endgameActorTransparency.tile(atlas, a.tile, soft);
      if (!cut) continue;
      const floor = endgameActorFloor(tw, N, a.row, a.col);
      if (!floor) continue;
      const dx = wr.x + a.col * cell;
      const dy = wr.y + a.row * cell;
      ctx.drawImage(world, floor.col * cell, floor.row * cell, cell, cell, dx, dy, cell, cell);
      ctx.drawImage(cut, 0, 0, ATLAS_TILE, ATLAS_TILE, dx, dy, cell, cell);
    }
    ctx.restore();
  }

  /**
   * Selecciona el frame de sprite de UN actor y lo blitea en `(dx,dy)` (device). Extraído
   * del bucle de `paintActors` para reusarlo con los actores SALIENTES por scroll. La
   * elección de frame es idéntica a la del original: NPC animado por el intérprete idle,
   * o ciclo `perTurn`/reloj según el `animGroup`, o tile estático.
   */
  private paintActorSprite(
    ctx: CanvasRenderingContext2D,
    atlas: CanvasImageSource,
    groups: readonly (AnimGroup | null)[],
    id: string,
    tile: number,
    dx: number,
    dy: number,
    cell: number,
    now: number,
    onPassage = false,
  ): void {
    // TRANSPARENCIA: `off`→nunca; `avatar`→sólo la party; `all`/`soft`→todos. El fondo
    // negro del tile se hace transparente (flood-fill exterior) para ver el terreno.
    // #366: los actores de la escena de camp (`camp:<idx>`/bardo) SON la party
    // (durmientes + vigía), así que cuentan como `party` para el modo `avatar`.
    const transp =
      this.transpMode === "all" ||
      this.transpMode === "soft" ||
      (this.transpMode === "avatar" && (id === "party" || isCampActorId(id)));
    const soft = this.transpMode === "soft";
    // NPC del banco alto animado por el intérprete `0x4552` POR-ACTOR (idle continuo,
    // RNG-gated) — la MISMA fuente que la fiel. El party-leader NO entra (queda
    // congelado por el per-turn de abajo, como el original). Ver
    // `re/notes/witness-idle-anim-sequences.md`.
    if (id !== "party") {
      const npcFrame = this.faithful.actorFrame(id, tile);
      if (npcFrame !== tile) {
        this.blitActorTile(ctx, atlas, npcFrame, dx, dy, cell, 1, transp, soft, onPassage);
        return;
      }
    }
    const g = groups[tile];
    if (!g) {
      // Tile estático (party, botín, criatura sin ciclo): un solo blit.
      this.blitActorTile(ctx, atlas, tile, dx, dy, cell, 1, transp, soft, onPassage);
      return;
    }
    // SPRITES DE ACTOR (banco alto, `g.perTurn`): el frame avanza 1 por TURNO del
    // mundo, NO por el reloj de render — calco del original (un actor quieto se
    // congela; ver `render/tileanim.ts` y `re/notes/sprite-anim-cadence.md`). El
    // reloj de sprites libre (`now/period`) que ciclaba a ~110 ms era el «muy
    // acelerado» del testigo del usuario (2026-07-18). Sin cross-dissolve continuo:
    // el avance es discreto por paso, como los frames del original.
    const step = g.perTurn ? this.faithful.personTurn : Math.floor(now / (SPRITE_TICK_MS * (g.divisor || 1)));
    const frame = g.base + ((tile - g.base + step) % g.size);
    this.blitActorTile(ctx, atlas, frame, dx, dy, cell, 1, transp, soft, onPassage);
  }

  /** Blitea un tile del atlas EGA a `(dx,dy)` escalado a `cell`, con opacidad `alpha`
   *  (para el cross-dissolve de la pieza 3). NEAREST (sprite pixel-art nítido).
   *  Si `transp`, dibuja el recorte con el fondo negro exterior transparente (prototipo);
   *  `soft` usa la variante con borde feathered. Si el recorte aún no está listo (atlas
   *  sin volcar) cae al blit opaco del atlas → nunca hay actor perdido. */
  private blitActorTile(
    ctx: CanvasRenderingContext2D,
    atlas: CanvasImageSource,
    tile: number,
    dx: number,
    dy: number,
    cell: number,
    alpha: number,
    transp = false,
    soft = false,
    onPassage = false,
  ): void {
    if (alpha !== 1) ctx.globalAlpha = alpha;
    // CENSO DE TRANSPARENCIA (1ª ola): fantasmas/wisps/shadowlords → CUERPO a alpha .55
    // (veredicto B). Se ve el terreno a través del cuerpo, no sólo por el fondo. Aplica
    // aunque `transpMode` sea otro (es su uso canónico); sólo el kill-switch lo apaga.
    // CADÁVER/SANGRE de la arena (0x11E/0x11F) → CONTORNO (fondo negro exterior a alpha 0,
    // negros internos intactos, sin alpha en el cuerpo): el suelo de la arena asoma
    // alrededor. Igual que el censo, siempre ON salvo el kill-switch (indep. de transpMode).
    // PASO DE MAMPOSTERÍA (#197, ruling del lead 12-08-2026): sobre un arco/entrada
    // caminable NO se recorta NADA — el binario sustituye el tile por el del actor
    // (`ULTIMA.EXE:0x56ac viewport_compose`, un blit por celda), así que detrás del actor no
    // hay terreno que enseñar; recortar dejaba asomar el LADRILLO del arco y deshilachaba al
    // Avatar contra el muro. Extensión a ACTORES del «nunca fondo de pared» de
    // `docs/verdicts/transp-wave2/README.md`. Manda sobre las TRES vías, la translucidez de
    // cuerpo de la 1ª ola incluida: el argumento es de la CELDA (no hay nada detrás), no del
    // actor, así que un fantasma en el arco tampoco tiene qué transparentar. Son DOS tiles en
    // todo el juego (`render/masonry-passage.ts`), no un régimen general.
    const cut = onPassage
      ? null
      : this.transpWire && TRANSLUCENT_ACTOR_TILES.has(tile)
        ? this.actorTransparency.bodyAlpha(atlas, tile, BODY_ALPHA)
        : this.transpWire && CONTOUR_ACTOR_TILES.has(tile)
          ? this.actorTransparency.tile(atlas, tile, false)
          : transp
            ? this.actorTransparency.tile(atlas, tile, soft)
            : null;
    if (cut) {
      ctx.drawImage(cut, 0, 0, ATLAS_TILE, ATLAS_TILE, dx, dy, cell, cell);
    } else {
      const sx = (tile % ATLAS_COLS) * ATLAS_TILE;
      const sy = Math.floor(tile / ATLAS_COLS) * ATLAS_TILE;
      ctx.drawImage(atlas, sx, sy, ATLAS_TILE, ATLAS_TILE, dx, dy, cell, cell);
    }
    if (alpha !== 1) ctx.globalAlpha = 1;
  }

  /**
   * CONTORNO-TRANSPARENCIA DEL TERRENO (default ON, kill-switch `?contourTransp=off`):
   * recorre `terrainWindow` (11×11) y por cada celda de FUENTE (0xd8–0xdb) o de FUEGO DE
   * SUELO (brasero 0xb2, hoguera 0xb3, farola 0xbd, llama azul 0xde…)
   * reemplaza en la capa mundo su contorno negro exterior por el TERRENO de debajo, dejando
   * ver el suelo — con los negros INTERNOS intactos (flood-fill exterior de `ActorTransparency`).
   * Los fuegos con FONDO YA HORNEADO se EXCLUYEN (isWallMountedFire): pared (sconces 0xb0/0xb1,
   * hogar 0xbc, cocina 0xbf) y mobiliario (vela 0xbe, fondo=mesa) — recortarlos pintaría suelo
   * detrás (testigo/veredicto del usuario). El suelo sintetizado excluye paredes
   * (`isFloorUnderlayCandidate` en `dominantFloorNeighbor`).
   *
   * Como estos tiles son TERRENO (la fiel los hornea sin hook por-tile) el suelo de debajo NO
   * está en `terrainWindow` (la celda muestra el emisor, no el suelo). Se SINTETIZA copiando
   * los píxeles YA renderizados (xBR + agua) de la celda vecina de suelo DOMINANTE — así el
   * parche calza exacto con el filtro del terreno alrededor, sin re-renderizar. Sobre ese
   * parche se blitea el recorte 16×16 del emisor con el fondo exterior a alpha 0. Si no hay
   * vecino de suelo utilizable (emisor aislado) se deja la celda intacta (nunca negro a ciegas).
   *
   * ANIMACIÓN (regresión cazada): NO se blitea el tile crudo de `terrainWindow` (frame FIJO
   * → congelaba la animación) sino el FRAME VIVO:
   *  · FUENTE: cicla su id por el reloj maestro (0xd8→0xdb) → se recorta el frame que toca
   *    esta pasada, `animatedFrame(raw, phase, groups)`, del atlas (4 recortes cacheados).
   *  · FUEGO: su id NO cicla; su titileo es RUIDO fn32 sobre un canvas vivo
   *    (`fireCanvasFor`). Se recorta ese canvas por la SILUETA estática del tile (alpha del
   *    recorte del atlas, destination-in) → mantiene el parpadeo de la llama, corta el fondo.
   * Trabaja en `wctx` (la capa mundo) ANTES de la niebla y los actores. NO toca la
   * contribución de luz del emisor (lightLevel/visMask); sólo el pintado.
   */
  private paintContourTransp(
    wctx: CanvasRenderingContext2D,
    size: number,
    tw: Int16Array,
  ): void {
    const atlas = this.faithful.spriteAtlas;
    const world = this.worldCanvas;
    if (!atlas || !world) return;
    const N = VIEW_WINDOW;
    const cell = size / VIEWPORT.tiles;
    const phase = this.faithful.animPhase;
    const groups = this.faithful.animGroups;
    // Suelo dominante: se ignoran TODOS los emisores recortables (fuente + fuego + mobiliario),
    // para que un brasero junto a una fuente no tome a la otra como suelo, y para que dos
    // fuelles contiguos no se tomen por suelo el uno al otro (trampa declarada en la ficha
    // #196). Nota medida: los 23 del mobiliario son todos NO caminables, así que
    // `isFloorUnderlayCandidate` ya los excluía del underlay — este `skip` es cinturón sobre
    // tirantes, y lo que de verdad los protege es el suelo DECLARADO de abajo.
    const isContourTile = (t: number): boolean =>
      isFountainTile(t) || isFireTile(t) || isInteriorFurniture(t);
    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        const raw = tw[row * N + col] ?? -1;
        if (!isContourTile(raw)) continue;
        // Fuegos MONTADOS EN PARED (sconces 0xb0/0xb1, hogar 0xbc): NO se recortan — su
        // gráfico ya incluye la pared; recortar pintaría suelo detrás (testigo del usuario).
        // Se quedan con su celda entera horneada (titileo fn32 lo aporta la fiel).
        if (isWallMountedFire(raw)) continue;
        // Frame VIVO: la fuente cicla su id; el FUELLE y el reloj TAMBIÉN (0xfc↔0xfd y
        // 0xfa↔0xfb, divisor 4 — `render/tileanim.ts` TOGGLE_BASES); el fuego se queda en su id
        // (groups null). Bliteear `raw` congelaría la animación: regresión ya cazada una vez
        // con la fuente (`docs/verdicts/contour-fix/README.md`).
        const frame = animatedFrame(raw, phase, groups);
        // MOBILIARIO: el suelo lo DECLARAN los datos del original (`flatTileSubstitution`), no
        // se infiere del vecino dominante — que en 128 de 923 celdas es una SILLA o una
        // ESCALERA (medido; ver `declaredFloorNeighbor`). Sin ese suelo al lado, celda intacta.
        const declaredFloor = declaredFloorUnder(raw);
        const floor =
          declaredFloor >= 0
            ? declaredFloorNeighbor(tw, N, row, col, declaredFloor)
            : dominantFloorNeighbor(tw, N, row, col, isContourTile);
        if (!floor) continue;
        // (1) Suelo sintetizado = copia de los píxeles YA renderizados de la celda vecina
        //     dominante (xBR-exacto, calza con el terreno de alrededor sin re-renderizar).
        wctx.imageSmoothingEnabled = false;
        wctx.drawImage(
          world,
          floor.col * cell,
          floor.row * cell,
          cell,
          cell,
          col * cell,
          row * cell,
          cell,
          cell,
        );
        // (2) Emisor recortado encima (fondo exterior a alpha 0, silueta opaca).
        const cut = this.actorTransparency.tile(atlas, frame, false);
        if (!cut) continue;
        const flame = isFireTile(frame) ? this.faithful.fireCanvasFor(frame) : null;
        const clipped = flame ? this.clipLiveFlame(flame, cut) : null;
        const src = clipped ?? cut; // sin capa de fuego (tests) → recorte estático del atlas
        wctx.drawImage(src, 0, 0, ATLAS_TILE, ATLAS_TILE, col * cell, row * cell, cell, cell);
      }
    }
  }

  /**
   * Recorta el canvas VIVO de titileo de un fuego (`flame`) por la SILUETA del tile: usa el
   * alpha del recorte estático del atlas (`cut`, fondo exterior a 0) como máscara
   * destination-in. Devuelve el scratch 16×16 con la llama animada y el fondo exterior
   * transparente (RGB de la llama viva, alpha de la silueta), o `null` sin contexto 2D.
   */
  private clipLiveFlame(
    flame: CanvasImageSource,
    cut: CanvasImageSource,
  ): HTMLCanvasElement | null {
    if (!this.contourScratchCtx) {
      const c = document.createElement("canvas");
      c.width = ATLAS_TILE;
      c.height = ATLAS_TILE;
      this.contourScratch = c;
      this.contourScratchCtx = c.getContext("2d");
    }
    const sctx = this.contourScratchCtx;
    if (!sctx || !this.contourScratch) return null;
    sctx.imageSmoothingEnabled = false;
    sctx.globalCompositeOperation = "source-over";
    sctx.clearRect(0, 0, ATLAS_TILE, ATLAS_TILE);
    sctx.drawImage(flame, 0, 0); // llama viva, opaca (incluido el fondo exterior)
    sctx.globalCompositeOperation = "destination-in";
    sctx.drawImage(cut, 0, 0); // conserva sólo donde el recorte tiene alpha (la silueta)
    sctx.globalCompositeOperation = "source-over";
    return this.contourScratch;
  }

  /**
   * LAS DOS INVERSIONES XOR DEL VIEWPORT (#295) en la piel shader — pasos (2f-bis) y
   * (2f-ter) del compose, sobre el viewport YA COMPUESTO y ANTES de la cortina de cama (2g).
   *
   * Son los DOS regímenes del MISMO idiom del binario (`set_color(c)` + `rect(8,8,0xb7,0xb7)`
   * con `stc`, que programa el Graphics Controller en función XOR ⇒ cada píxel pasa a
   * `índice ^ c`), y aquí conviven porque el sujeto es el mismo rectángulo:
   *   · SUELTO — «WELL DONE» del Altar, CAST2 0x0c41: invierte y NADIE des-invierte; lo
   *     restaura el `kernel_flash(10)` de 0x0d1a. Viaja como ESTADO en `snap.ritualInvert`,
   *     sostenido por el conductor `ui/ritual-invert.ts`.
   *   · PAREADO — pergamino de tiempo, CAST2 0x0031 invierte / 0x007a des-invierte. NO viaja
   *     en el snapshot: vive en la `TimeSpellFlash` de la piel fiel (la arranca el cue
   *     `time-spell` del bus de sfx), y por eso se pregunta a la fiel — la misma fuente que
   *     pinta el original, igual que se hace con la sacudida en (2f).
   *
   * 🔴 ESTE PASO EXISTE porque el paso (2) del compose RECOMPONE el viewport por su cuenta y
   * PISA lo que la fiel hornea en su canvas oculto — la misma razón que (2f) terremoto y (2g)
   * apagón. El régimen PAREADO estaba portado desde hacía meses… **pero sólo en la fiel**, así
   * que en la piel de fábrica la inversión del pergamino NO SE VEÍA (cableada el 14-08). Y no
   * era un régimen de esquina: `motionScroll` está ON salvo `localStorage="0"` y
   * `transparencyMode` vale "all", de modo que la vía que recompone se toma en MUNDO-con-scroll
   * y en COMBATE — y combate es justo donde el testigo de `invert-flash.ts` documentó las
   * ventanas brillantes del An Tym.
   *
   * 🔴 DOS restricciones MEDIDAS que no se pueden copiar de (2g) aunque se le parezca:
   *   · `invertViewportInterior` cablea el rect EGA (8,8,176,176) y aquí estamos en píxeles de
   *     DISPOSITIVO ⇒ se llama a `invertRect` con el rect del viewport (`wr`/`size`). Con el
   *     helper de arriba se invertiría un cuadrado de 176 px en la esquina de la pantalla.
   *   · `paintWorldInto` NO declina con estas banderas, y es correcto: la cortina de (2g) es
   *     OPACA y no necesita nada debajo, pero una inversión SIN el mundo compuesto debajo no
   *     invierte nada. La declinación es POR EFECTO.
   *
   * El COLOR no se parametriza en ningún caso (veto medido de #317: `difference` con blanco no
   * es `índice ^ c` sobre la paleta). Si las dos coinciden se aplican las DOS y se cancelan —
   * el XOR es involutivo, exactamente como en 1988.
   *
   * 🔴 ORDEN respecto a (2g), con la consecuencia dicha en vez de insinuada: las dos van
   * ANTES, de modo que **si el apagón de cama coincidiera con una inversión, la cortina la
   * TAPA**. Es lo correcto y no un efecto colateral: (2g) «va el último y no es casual» por
   * #296, y poner el XOR después pintaría BLANCO sobre su negro. En el producto son
   * excluyentes (el rito cuelga del (E)nter en el sobremundo, la cama de un tile de pueblo),
   * así que la precedencia no llega a ejercerse; se declara para que el día que se ejerza
   * nadie la lea como un descuido.
   */
  /**
   * VUELO DEL CAÑONAZO (#313) en la piel shader — paso (2f-quater) del compose.
   *
   * La capa vive en la fiel (`WorldFxLayer`) y se lee con `worldFxProjectileAt`, que es PURA:
   * si este compose la purgara, la fiel se quedaría sin su propio fotograma. Mismo trato que
   * `timeSpellInvertsAt` en (2f-ter), y por la misma razón.
   *
   * 🔴 La geometría NO se copia de la fiel: allí el viewport son 176 px LÓGICOS y aquí
   * `wr`/`size` están en píxeles de DISPOSITIVO. El desplazamiento llega en CELDAS (y
   * fraccionario, que es el punto: la bala vive entre celdas), así que la celda se mide como
   * `size / VIEW_WINDOW` en vez de con la constante `VIEWPORT.tile` — usarla pintaría el punto
   * en una esquina, que es exactamente la trampa que documenta `invertViewportInterior` dos
   * métodos más abajo.
   */
  private paintCannonball(
    ctx: CanvasRenderingContext2D,
    wr: { x: number; y: number },
    size: number,
    now: number,
  ): void {
    const at = this.faithful.worldFxProjectileAt(now);
    if (!at) return;
    const c = (VIEW_WINDOW - 1) / 2; // el grupo va en el centro de la ventana 11×11
    const col = c + at.dx;
    const row = c + at.dy;
    if (col < 0 || row < 0 || col > VIEW_WINDOW - 1 || row > VIEW_WINDOW - 1) return;
    const cell = size / VIEW_WINDOW;
    const dot = Math.max(1, Math.round((PROJECTILE_DOT_PX / VIEWPORT.tile) * cell));
    ctx.fillStyle = PROJECTILE_DOT_COLOR;
    ctx.fillRect(
      wr.x + col * cell + (cell - dot) / 2,
      wr.y + row * cell + (cell - dot) / 2,
      dot,
      dot,
    );
  }

  /**
   * Paso (2b) del compose — AGUA xBRZ pre-horneada (water-look) sobre la capa MUNDO:
   * sustituye cada celda de `waterCommitted` (las que la fiel registró como CLASE AGUA en
   * su último `paintFaithful`) por su fila del atlas, en la fase committed. El terreno
   * conserva su xBR.
   *
   * 🔴 TRES gates, los tres MEDIDOS EN VIVO (carril fix-agua-quake, server 5288; las dos
   * primeras eran las candidatas declaradas por 5962ad37 «derivadas del código, sin medir»):
   *
   *  · DECLINA DURANTE EL CRUCE DE MOONGATE (`transiting`): `waterCommitted` sólo se
   *    repuebla en `paintFaithful` (`waterSink.begin`) y la rama transit de la fiel no pasa
   *    por ahí ⇒ el committed es el del viewport de ORIGEN (party una fila al sur), mientras
   *    el frame congelado centra al party YA SOBRE LA PUERTA (`beginTransit`). Pintar con él
   *    puso una FRANJA DE AGUA FANTASMA corrida una fila sobre el frame congelado y TAPÓ lo
   *    que la fiel hornea en esas celdas de pantalla — capturado con el flash del pergamino
   *    en pleno cruce: viewport entero invertido (blanco) con la franja de olas SIN invertir
   *    encima, fiel intacta de control. No hay orden de pasos que lo salve: durante el cruce
   *    no existe un committed que describa el frame congelado.
   *
   *  · DECLINA BAJO UNA INVERSIÓN HEREDADA en la vía de recorte pleno (`!terrainOnly`): el
   *    fondo ya lleva el XOR horneado por la fiel y la ola encima lo tapa — medido con
   *    motion OFF junto al mar (delta por celda contra la referencia pre-flash: agua 122 ≈
   *    sólo fase de ola, tierra 677 invertida; controles motion ON 606 y fiel 571, agua
   *    invertida). El censo de fuentes es EL MISMO que `paintViewportInversions` (rito del
   *    snapshot + pergamino/curandero/Códice de la fiel, lecturas PURAS — masksAt/invertsAt
   *    no consumen), no una lista paralela que pueda divergir. En la vía TERRENO no declina:
   *    allí la inversión la pinta (2f-ter) DESPUÉS, encima de las olas. Mientras la ventana
   *    del flash está viva el agua vuelve al fn32 horneado del recorte (el CONTENIDO fiel
   *    manda sobre el estilo xBRZ; el flash dura ≤~2,9 s). combatFx sobre arena con agua y
   *    transp=off es la misma clase con otro emisor: declarado al lead, NO medido aquí.
   *
   *  · VIAJA CON LA SACUDIDA en recorte pleno (`+qoffDev`): el fondo heredado va desplazado
   *    `qoff` durante el terremoto (la fiel lo hornea) y unas olas ancladas a su celda
   *    flotarían sobre el temblor. En la vía TERRENO no: allí (2f) desplaza el composite
   *    entero (olas incluidas) DESPUÉS. El desborde inferior lo recorta el propio canvas de
   *    la capa mundo (tamaño exacto `size`).
   */
  private paintWaterOverlay(
    wctx: CanvasRenderingContext2D,
    size: number,
    transiting: boolean,
    terrainOnly: boolean,
    snap: ViewSnapshot | undefined,
    now: number,
    qoffDev: number,
  ): void {
    if (
      !this.waterXbrz ||
      !this.waterAtlas ||
      this.waterAtlas.naturalWidth <= 0 ||
      this.waterCommitted.length === 0
    ) {
      return;
    }
    if (transiting) return;
    if (
      !terrainOnly &&
      (snap?.ritualInvert ||
        this.faithful.timeSpellInvertsAt(now) ||
        this.faithful.healerFlashMaskAt(now) !== 0 ||
        this.faithful.codexWindMaskAt(now) !== 0)
    ) {
      return;
    }
    const cell = size / VIEWPORT.tiles;
    const sx = this.waterCommittedPhase * WATER_CELL_PX;
    const dy = terrainOnly ? 0 : qoffDev;
    wctx.imageSmoothingEnabled = true;
    for (const c of this.waterCommitted) {
      const rowIdx = this.waterRow.get(c.tile);
      if (rowIdx === undefined) continue;
      wctx.drawImage(
        this.waterAtlas,
        sx,
        rowIdx * WATER_CELL_PX,
        WATER_CELL_PX,
        WATER_CELL_PX,
        c.col * cell,
        c.row * cell + dy,
        cell,
        cell,
      );
    }
    wctx.imageSmoothingEnabled = false;
  }

  private paintViewportInversions(
    ctx: CanvasRenderingContext2D,
    wr: { x: number; y: number },
    size: number,
    snap: ViewSnapshot | undefined,
    now: number,
    terrainOnly: boolean,
  ): void {
    // 🔴 EL FONDO PUEDE VENIR YA INVERTIDO — y entonces aplicar aquí es DES-invertir (#345).
    // El paso (2) tiene DOS vías y sólo una deja el viewport sin el efecto:
    //   · `terrainOnly === true`  → el fondo lo pintó `paintWorldInto` desde el snapshot: es
    //     terreno CRUDO, la fiel no ha horneado nada encima ⇒ el XOR lo pone ESTE paso.
    //   · `terrainOnly === false` → el fondo es el RECORTE PLENO del canvas de la fiel, que
    //     ya lleva dentro su `invertViewportInterior` ⇒ aplicar aquí lo CANCELA (el XOR es
    //     involutivo) y el jugador ve colores normales. Es lo que le pasaba al WELL DONE en
    //     la piel de fábrica: la escena del santuario cae a esta vía, la fiel invertía su
    //     búfer y este paso lo deshacía. Medido: una sola aplicación por frame sobre el
    //     canvas VISIBLE, rect correcto (32,32,704,704), y resultado sin invertir.
    // El discriminante es la MISMA variable que eligió la vía — no una bandera paralela que
    // pueda divergir de ella (lección de #253: tres instancias, tres curas distintas).
    if (!terrainOnly) return;
    // (2f-bis) rito: ESTADO del snapshot, sostenido por `ui/ritual-invert.ts`.
    if (snap?.ritualInvert) invertRect(ctx, wr.x, wr.y, size, size);
    // (2f-ter) pergamino: estado de la FIEL, leído sin consumirlo (`invertsAt` es pura — el
    // ciclo de vida del flash es de la fiel, y este compose no debe avanzarlo).
    if (this.faithful.timeSpellInvertsAt(now)) invertRect(ctx, wr.x, wr.y, size, size);
    // (2f-quinquies) DESTELLOS DEL CURANDERO (#299): estado de la FIEL, leído sin
    // consumirlo (`masksAt` pura, mismo trato que el pergamino). NO es `invertRect`: las
    // máscaras 4/11 del binario exigen el XOR de índice EGA de verdad (veto medido de
    // #317) — `paletteXorRect` reindexa contra la LUT; los píxeles no-EGA que fabrique el
    // compose del shader caen al índice más cercano (Clase C declarada en palette-xor.ts).
    // 🔴 A DIFERENCIA del `difference`, este XOR sólo es involutivo EXACTO sobre píxeles
    // ya-EGA (la primera pasada cuantiza): si algún día este paso corriera también en la
    // vía terrainOnly=false (hoy el `return` de arriba lo impide), la doble aplicación no
    // cancelaría limpio — dejaría el rect cuantizado a paleta. No lo heredes sin mirarlo.
    {
      const healerMask = this.faithful.healerFlashMaskAt(now);
      if (healerMask !== 0) paletteXorRect(ctx, wr.x, wr.y, size, size, healerMask);
    }
    // (2f-sexies) BRACKET XOR de la ceremonia del Códice (fix-codice): estado de la FIEL,
    // leído sin consumirlo (`masksAt` pura) — calco del destello del curandero de arriba,
    // con las máscaras acumuladas 4/11/15 de CAST2 0x0db3/0x0dca/0x0de1. La 15 de la
    // tercera ventana TAMBIÉN va por paleta: con `difference` divergirían los índices 6 y
    // 9 (brown-fix, medición de #317).
    {
      const codexMask = this.faithful.codexWindMaskAt(now);
      if (codexMask !== 0) paletteXorRect(ctx, wr.x, wr.y, size, size, codexMask);
    }
  }

  /**
   * TERREMOTO (#29) en la piel shader: re-blit del VIEWPORT ya compuesto en el backbuffer
   * (mundo+niebla+actores+overlays), desplazado ABAJO `qoffDev` px de DISPOSITIVO, recortado
   * a la ventana de juego (`wr`) y con el borde superior expuesto en negro — calco de
   * `FaithfulSkin.paintQuakeShift` pero a resolución de dispositivo (la fiel lo hace a 176px
   * lógicos; aquí el viewport ya está a `wr.size` = 176·s). El marco/HUD/chrome van DESPUÉS
   * (pasos 3-4) → no se mueven. Reutiliza el buffer `quakeBuf`. Ver `quake.ts` para la dinámica.
   */
  private paintQuakeShift(
    ctx: CanvasRenderingContext2D,
    wr: { x: number; y: number; size: number },
    qoffDev: number,
  ): void {
    const w = wr.size;
    const h = wr.size;
    let buf = this.quakeBuf;
    if (!buf) {
      buf = document.createElement("canvas");
      this.quakeBuf = buf;
    }
    if (buf.width !== w || buf.height !== h) {
      buf.width = w;
      buf.height = h;
    }
    const bctx = buf.getContext("2d");
    if (!bctx) return;
    bctx.imageSmoothingEnabled = false;
    bctx.clearRect(0, 0, w, h);
    bctx.drawImage(ctx.canvas, wr.x, wr.y, w, h, 0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(wr.x, wr.y, w, h);
    ctx.clip();
    ctx.fillStyle = "#000";
    ctx.fillRect(wr.x, wr.y, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, wr.x, wr.y + qoffDev);
    ctx.restore();
  }

  /** Reblitea una franja lógica del canvas fiel al backbuffer, NEAREST (×S). */
  private reblitStrip(rect: LogRect): void {
    const ctx = this.ctx;
    const src = this.srcCanvas;
    if (!ctx || !src) return;
    const s = this.scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      src,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      rect.x * s,
      rect.y * s,
      rect.w * s,
      rect.h * s,
    );
  }

  /**
   * Pase de texto HD: recompone las celdas capturadas desde el atlas remaster
   * sobre el texto nearest. Excluye (i) el VIEWPORT (el mundo va por xBR) y (ii)
   * las bandas cielo/vientos (glifos rúnicos/semigráficos que recompone el paso 4).
   * Las celdas del atlas sin poblar (semigráficos, remates) son transparentes →
   * no pintan y dejan el nearest visible: el fallback por-glifo sale gratis.
   * Suavizado bilineal (mismo trato que el mundo xBR 4×→6×).
   *
   * SEMIGRÁFICOS de consola (código <0x20: el bullet ► de eco y el cursor de la ola
   * animada) NO están en el atlas HD redibujado (es un núcleo ASCII). Antes quedaban
   * en NEAREST → pixelados (testigo del usuario: «lo único que sale pixelado»). Se
   * re-blitean SUAVIZADOS desde el canvas fiel — sus PROPIOS píxeles (bullet 2-color,
   * frame de ola actual) escalados bilineal — así siguen la cadencia/animación intactas
   * y dejan de ser blocky, sin tocar el atlas HD ni el reloj del cursor.
   */
  private drawHdText(ctx: CanvasRenderingContext2D, s: number): number {
    const hd = this.hdFont;
    if (!hd) return 0;
    let ops = 0; // instrumentación: nº de glifos que produjeron trabajo de canvas
    const src = this.srcCanvas;
    ctx.imageSmoothingEnabled = true;
    // MAQUETA lectura 2 (`?mockFont=alpha`): glifos con alfa translúcido (bordes suaves
    // semitransparentes). Se aplica a TODO el pase; restaurado al final. NO-OP con '' (alfa 1).
    const mockAlpha = this.mockFont === "alpha" ? 0.55 : 1;
    if (mockAlpha !== 1) ctx.globalAlpha = mockAlpha;
    for (const g of this.capCommitted) {
      if (!isHdLayerGlyph(g)) continue; // fuera del viewport y de las bandas cielo/vientos
      const px = 8 * g.scale;
      if (g.rune) {
        // Glifo RÚNICO de la consola (letrero (L)ook / profecía del Codex): sale del
        // atlas RÚNICO HD (`font-runes-hd.png`, lote-L6 §Integración), NO del de texto
        // IBM — mismo patrón que la banda celeste (`drawVectorSkyBand` + hdRunes). Las
        // celdas NO pobladas del atlas (marcos de caja, dígrafos TH/EA/ST/NG/EE, rombo
        // 0x40) son transparentes → bliterlas es no-op y deja ver el nearest de debajo
        // (fallback por-glifo, como el texto IBM). Sin atlas (`hdRunes` null, asset
        // gitignored ausente) el glifo queda en su blit nearest del paso (1).
        if (this.hdRunes) {
          this.hdRunes.drawGlyph(ctx, g.code, g.x * s, g.y * s, px * s, g.color);
          ops++;
          this.hdStats.runeOps++;
        } else this.hdStats.runeSkipped++;
        continue;
      }
      if (g.code === CONSOLE_BULLET_CODE) {
        // Bullet ► de eco de comando: se redibuja VECTOR con notch ALARGADO (veredicto #5,
        // proporción del glifo bitmap original) — no bilineal. El fondo de la consola es
        // negro, así que la muesca no molesta. Distinto de `drawVectorNotch` (remates ►◄ de
        // banda / banners), que quedan cortos por decisión previa.
        drawVectorBulletNotch(ctx, g.x * s, g.y * s, px * s);
        ops++;
        continue;
      }
      // Cursor de la ola animada — SOLO los códigos 0x05-0x08 (las 4 fases del cursor del
      // log). ⚠ Regresión V4 cazada por el usuario: la guarda era `< 0x20`, que capturaba
      // TAMBIÉN los semigráficos del marco de listas (Ready/Ztats: bordes de caja 0x11/0x1d…)
      // → se pintaban como líneas blancas. El resto de códigos <0x20 (bordes) cae al re-blit
      // fiel de abajo, como en main pre-V4.
      if (g.code >= 0x05 && g.code <= 0x08) {
        // Veredicto #6 (V5): el cursor ORIGINAL de la ola VECTORIZADO suave. El bitmap
        // fuente (font-ibm.png celdas 0x05-0x08) son franjas DIAGONALES paralelas `╱`:
        // un píxel está encendido cuando (x + 2y) mod 8 ∈ {phase, phase+1}, con la fase
        // recorriendo {6,0,2,4} en los 4 frames → las diagonales SCROLLEAN. V5 calca esas
        // mismas diagonales a trazos anti-aliased blancos con tope redondo, conservando la
        // geometría (dirección 2-izq/1-abajo) y las 4 fases.
        const ox = g.x * s;
        const oy = g.y * s;
        const cw = px * s;
        const frame = (g.code - 0x05) & 3; // 0..3, la cadencia del cursor de la fiel
        const phase = (6 + 2 * frame) & 7; // fase de la diagonal, derivada del bitmap
        const u = cw / 8; // un píxel-fuente escalado (la celda fiel es 8×8)
        ctx.save();
        ctx.beginPath();
        ctx.rect(ox, oy, cw, cw);
        ctx.clip();
        ctx.fillStyle = "#000000"; // borra el bitmap pixelado del cursor de la capa nearest
        ctx.fillRect(ox, oy, cw, cw);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = u * 1.5; // grosor del trazo ≈ el peso visual de la banda del bitmap
        ctx.lineCap = "round";
        // Cada diagonal es la recta x + 2y = cc (centro de banda cc = phase+1, y sus
        // repeticiones ±8). Recortamos el segmento que cruza la celda 8×8 y lo trazamos.
        for (let k = -1; k <= 3; k++) {
          const cc = phase + 1 + 8 * k;
          const yLo = Math.max(0, (cc - 8) / 2);
          const yHi = Math.min(8, cc / 2);
          if (yLo >= yHi) continue;
          ctx.beginPath();
          ctx.moveTo(ox + (cc - 2 * yLo) * u, oy + yLo * u);
          ctx.lineTo(ox + (cc - 2 * yHi) * u, oy + yHi * u);
          ctx.stroke();
        }
        ctx.restore();
        ops++;
        continue;
      }
      if (g.code < 0x20) {
        // Semigráficos NO-cursor: bordes de caja de las listas (Ready/Ztats), volutas de
        // esquina, reglas, marcadores de equipo (0x1c/0x1d) y género (0x0b/0x0c). El atlas
        // HD de texto no los cubre → re-blit del bitmap fiel. NEAREST (no bilineal): son
        // LÍNEAS FINAS (marco de 1 px, volutas) y el suavizado bilineal ×S las EMBORRONA
        // (contorno «roto», volutas gruesas, notches/marcadores lavados — testigo del
        // usuario en el chrome de listas bajo shader). El calco del original es EGA nítido;
        // el nearest reproduce ese filo limpio, coherente con el blit base (paso 1, tb
        // nearest) y con las líneas de 1 px del chrome vectorial.
        ctx.imageSmoothingEnabled = false;
        if (src) ctx.drawImage(src, g.x, g.y, px, px, g.x * s, g.y * s, px * s, px * s);
        ctx.imageSmoothingEnabled = true;
        ops++;
        continue;
      }
      hd.drawGlyph(ctx, g.code, g.x * s, g.y * s, px * s, g.color);
      ops++;
    }
    if (mockAlpha !== 1) ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    return ops;
  }

  /**
   * Firma del contenido del pase (1b) para invalidar el cache de la capa HD. Cubre la
   * escala `s` y, por glifo, code/x/y/scale/color (todo lo que determina su pintado; el
   * reblit NEAREST de semigráficos lee píxeles de la fiel deterministas por code+color,
   * ya incluidos). Se MEMOIZA por identidad del array `capCommitted` (la fiel lo REEMPLAZA
   * — nunca lo muta — en cada `frameStart`), así el frame de present que no coincide con un
   * repintado de la fiel la resuelve en O(1). Firmar TODOS los glifos (no sólo los del
   * layer) sólo puede sobre-invalidar, jamás sub-invalidar → seguro para la guarda.
   */
  private hdSignature(s: number): string {
    const cap = this.capCommitted;
    if (cap !== this.hdSigArrayRef) {
      let sig = "";
      for (let i = 0; i < cap.length; i++) {
        const g = cap[i]!;
        if (!isHdLayerGlyph(g)) continue; // sólo lo que la capa dibuja (ver `isHdLayerGlyph`)
        sig += `|${g.code},${g.x},${g.y},${g.scale},${g.color ?? ""}${g.rune ? ",r" : ""}`;
      }
      this.hdSigMemo = sig;
      this.hdSigArrayRef = cap;
    }
    // La disponibilidad del atlas RÚNICO entra en la firma: su carga es async y puede
    // llegar DESPUÉS de hornear la capa — sin este bit, una capa horneada sin runas HD
    // quedaría en cache (firma idéntica) y el realce rúnico no entraría hasta el
    // siguiente cambio de texto. (`hdFont` no lo necesita: sin él la capa ni se usa —
    // `blitHdTextCached` retorna antes.)
    return `${s}#${this.hdRunes ? "R" : ""}#${this.hdSigMemo}`;
  }

  /**
   * Compone el pase de TEXTO HD (1b) desde una capa offscreen HORNEADA, repintándola sólo
   * cuando cambia su firma. En el acierto (texto invariante) el frame idle pasa de ~N draws
   * de glifo a 1 blit 1:1. Sin `hdFont` (atlas no cargado) es un no-op — idéntico al gate
   * `if (this.hdFont)` de antes. El blit final es 1:1 sin escala → copia exacta (guarda de
   * píxel: la capa transparente + `source-over` en celdas disjuntas == pase directo).
   */
  /**
   * MAQUETA `?mockFont=nobg`: pinta los INTERIORES del panel (roster/oro, F/G/fecha) y la
   * consola con un degradado azul-noche del chrome, en px de dispositivo (lógico ×`s`).
   * Tapa el texto negro-sobre-negro de la fiel para que el pase HD posterior deje los
   * glifos flotando sobre el panel tematizado. Geometría de FRAME_SEGMENTS (frame.ts).
   */
  private paintMockPanelBg(ctx: CanvasRenderingContext2D, s: number): void {
    // Interiores (px lógicos): dentro de las sub-cajas del panel y la ventana de consola.
    const rects = [
      { x: 0xc0, y: 0x08, w: 0x137 - 0xc0 + 1, h: 0x37 - 0x08 + 1 }, // roster/oro
      { x: 0xc0, y: 0x40, w: 0x137 - 0xc0 + 1, h: 0x4f - 0x40 + 1 }, // F/G/fecha
      { x: 0xc0, y: 0x58, w: 0x13f - 0xc0 + 1, h: 0xb8 - 0x58 + 1 }, // consola
    ];
    ctx.imageSmoothingEnabled = false;
    for (const r of rects) {
      const g = ctx.createLinearGradient(0, r.y * s, 0, (r.y + r.h) * s);
      g.addColorStop(0, "#050a24");
      g.addColorStop(1, "#0e163e");
      ctx.fillStyle = g;
      ctx.fillRect(r.x * s, r.y * s, r.w * s, r.h * s);
    }
  }

  private blitHdTextCached(ctx: CanvasRenderingContext2D, s: number): void {
    if (!this.hdFont) {
      this.hdStats.hit = false;
      return;
    }
    const cv = this.canvas;
    if (!cv) {
      this.drawHdText(ctx, s);
      return;
    }
    // (Re)crea la capa al tamaño del backbuffer; un cambio de tamaño la invalida.
    if (!this.hdLayer || this.hdLayer.width !== cv.width || this.hdLayer.height !== cv.height) {
      if (!this.hdLayer) {
        this.hdLayer = document.createElement("canvas");
        this.hdLayerCtx = this.hdLayer.getContext("2d");
      }
      this.hdLayer.width = cv.width;
      this.hdLayer.height = cv.height;
      this.hdCacheSig = ""; // fuerza repaint tras el resize
    }
    const lctx = this.hdLayerCtx;
    if (!lctx) {
      // Sin contexto 2D en la capa (no debería en el navegador): camino directo.
      this.hdStats.opsLastRepaint = this.drawHdText(ctx, s);
      return;
    }
    this.hdStats.frames++;
    const sig = this.hdSignature(s);
    if (sig !== this.hdCacheSig) {
      lctx.clearRect(0, 0, this.hdLayer.width, this.hdLayer.height);
      this.hdStats.opsLastRepaint = this.drawHdText(lctx, s);
      this.hdCacheSig = sig;
      this.hdStats.repaints++;
      this.hdStats.hit = false;
    } else {
      this.hdStats.hit = true;
    }
    // Composición 1:1 (sin escala): copia exacta de la capa sobre la base.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.hdLayer, 0, 0);
  }

  /**
   * GUARDA DE PÍXEL viva (flag `hdcache-verify`): compara el camino CACHEADO con el pase
   * DIRECTO sobre la MISMA base (el ctx justo tras el blit nearest, paso 1) y acumula el
   * diff en `window.__hdcacheVerify`. Es inmune al reloj de animación: ambos caminos leen
   * el mismo `capCommitted`/escala del frame. No muta el `ctx` real (trabaja en scratch).
   */
  private verifyHdCache(ctx: CanvasRenderingContext2D, s: number): void {
    if (!this.hdFont || !this.canvas) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (W === 0 || H === 0) return;
    const mkCtx = (): CanvasRenderingContext2D | null => {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      return c.getContext("2d", { willReadFrequently: true });
    };
    if (!this.hdVerifyA || this.hdVerifyA.canvas.width !== W || this.hdVerifyA.canvas.height !== H) {
      this.hdVerifyA = mkCtx();
      this.hdVerifyB = mkCtx();
    }
    const da = this.hdVerifyA;
    const db = this.hdVerifyB;
    if (!da || !db) return;
    const base = ctx.getImageData(0, 0, W, H);
    // Camino DIRECTO en scratch A.
    da.putImageData(base, 0, 0);
    this.drawHdText(da, s);
    const direct = da.getImageData(0, 0, W, H).data;
    // Camino CACHEADO en scratch B (usa la misma capa/firma que producción).
    db.putImageData(base, 0, 0);
    this.blitHdTextCached(db, s);
    const cached = db.getImageData(0, 0, W, H).data;
    let mismatches = 0;
    let maxAbs = 0;
    for (let i = 0; i < direct.length; i++) {
      const d = Math.abs(direct[i]! - cached[i]!);
      if (d !== 0) {
        mismatches++;
        if (d > maxAbs) maxAbs = d;
      }
    }
    const g = globalThis as unknown as {
      __hdcacheVerify?: { frames: number; framesWithDiff: number; mismatches: number; maxAbs: number };
    };
    const acc = (g.__hdcacheVerify ??= { frames: 0, framesWithDiff: 0, mismatches: 0, maxAbs: 0 });
    acc.frames++;
    if (mismatches > 0) {
      acc.framesWithDiff++;
      acc.mismatches += mismatches;
      if (maxAbs > acc.maxAbs) acc.maxAbs = maxAbs;
    }
  }

  private startPresent(): void {
    if (this.raf) return;
    this.presentForce = true; // resume (pestaña visible de nuevo): componer el primer frame
    const loop = (): void => {
      this.present();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private stopPresent(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  unmount(): void {
    this.stopPresent();
    // La escala IMPUESTA muere con el alojamiento: esta misma instancia se re-monta como
    // piel de primera clase al salir del layout partido (el `SkinManager` desmonta antes
    // de montar, así que nunca hay dos a la vez), y allí la escala vuelve a salir de su
    // contenedor. Sin esto se quedaba pegada la del anfitrión.
    this.hostedScale = null;
    if (this.visHandler) document.removeEventListener("visibilitychange", this.visHandler);
    this.visHandler = null;
    if (this.resizeHandler) window.removeEventListener("resize", this.resizeHandler);
    this.resizeHandler = null;
    if (this.canvas && this.pointerHandler) {
      this.canvas.removeEventListener("pointerdown", this.pointerHandler);
    }
    this.pointerHandler = null;
    // Scrollback de consola (log-scroll): listeners de reenvío propios.
    if (this.canvas) {
      if (this.wheelHandler) this.canvas.removeEventListener("wheel", this.wheelHandler);
      if (this.dragDownHandler)
        this.canvas.removeEventListener("pointerdown", this.dragDownHandler);
      if (this.dragMoveHandler)
        this.canvas.removeEventListener("pointermove", this.dragMoveHandler);
      if (this.dragEndHandler) {
        this.canvas.removeEventListener("pointerup", this.dragEndHandler);
        this.canvas.removeEventListener("pointercancel", this.dragEndHandler);
      }
    }
    this.wheelHandler = null;
    this.dragDownHandler = null;
    this.dragMoveHandler = null;
    this.dragEndHandler = null;
    this.consoleDrag = null;
    this.upscaler?.dispose();
    this.upscaler = null;
    this.faithful.setGlyphSink(undefined); // desengancha la captura
    this.faithful.setWaterSink(undefined); // desengancha el sumidero de agua (water-look)
    this.hdFont = null;
    this.hdRunes = null;
    this.hdLayer = null;
    this.hdLayerCtx = null;
    this.hdCacheSig = "";
    this.hdSigArrayRef = null;
    this.hdVerifyA = null;
    this.hdVerifyB = null;
    this.capPending = [];
    this.capCommitted = [];
    this.brkPending = [];
    this.brkCommitted = [];
    this.waterAtlas = null;
    this.waterPending = [];
    this.waterCommitted = [];
    this.quakeBuf = null;
    this.faithful.unmount(); // deshace su reloj, listeners, texturas
    this.container?.remove();
    this.container = null;
    this.host?.remove();
    this.host = null;
    this.canvas = null;
    this.ctx = null;
    this.srcCanvas = null;
    this.crop = null;
    this.cropCtx = null;
    this.chrome = null;
    this.chromeCtx = null;
    this.fogCanvas = null;
    this.fogCtx = null;
    this.prevVisMask = null;
    this.tweenVisMaskV0 = null;
    this.prevVisRadius = null;
    this.tweenVisRadiusV0 = null;
    // SIMETRÍA DE CONTRATO con la fiel (banco present()/mount(); api.ts §Skin:
    // «tras unmount la piel no retiene referencias vivas»): el estado memoizado del
    // gate de present (PERF-2) y del motion apuntaba a snapshots/actores del MUNDO
    // DESMONTADO. Además de la fuga, era estado RANCIO en el re-mount F9: el juego
    // sigue corriendo bajo la otra piel, así que un `lastMotionSnap`/`actorFrom`
    // viejos podían sintetizar un tween espurio en el primer frame del re-montaje
    // (presentForce=true ya cubre el repintado; los tweens parten de cero).
    this.worldCanvas = null;
    this.worldCtx = null;
    this.prevWorld = null;
    this.prevWorldCtx = null;
    this.tweenV0 = null;
    this.tweenV0Ctx = null;
    this.worldSize = 0;
    this.contourScratch = null;
    this.contourScratchCtx = null;
    this.lastSnapRef = null;
    this.lastSrcGen = -1;
    this.lastMotionSnap = null;
    this.lastCenter = null;
    this.lastLoc = "";
    this.tween = null;
    this.actorFrom.clear();
    this.actorTo.clear();
    this.actorRendered.clear();
    this.actorRenderedSpare.clear();
    this.actorSig = "";
    this.actorStart = 0;
    this.lastActors = [];
    this.actorsExiting = [];
    this.view = null;
  }
}
