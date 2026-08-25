/**
 * Filtro «shader» para la CINEMÁTICA de intro (task #70b) — capa ADITIVA.
 *
 * La intro (`faithful-intro.ts`) corre ANTES de montar ninguna piel y pinta su
 * pantalla 320×200 a un canvas propio (NEAREST por CSS `pixelated`). Cuando la piel
 * elegida es «shader», el usuario quiere que las LÁMINAS de la intro pasen por el
 * mismo upscaler de bordes (xBR 6×, #70a: el xBR propio del viewport, NO xBRZ GPL).
 *
 * Diseño ADITIVO, para no tocar el render de la intro (CLAVADO al DOSBox, #64): la
 * intro sigue pintando su canvas TAL CUAL; encima se superpone un canvas overlay
 * (`pointer-events:none`) que, por fase, dibuja la versión xBR de las regiones de
 * ARTE y deja TRANSPARENTE el resto (el texto de la intro asoma NEAREST por debajo).
 * Si `shaderFilter` está apagado (piel fiel/1988), NADA de esto corre → la intro es
 * byte-idéntica.
 *
 * CRITERIO (igual que en juego): el filtro toca el ARTE (logos, título, mundo del
 * attract), NUNCA el TEXTO. El texto queda NEAREST porque el overlay o no lo cubre
 * (regiones de sólo-arte) o le abre un HUECO transparente (banda de rótulo del demo).
 */
import { SCREEN_H, SCREEN_W } from "../skin/fiel/frame.js";
import { INTRO_PANEL } from "../skin/fiel/intro.js";
import type { GlyphRecord, GlyphSink } from "../skin/fiel/font.js";
import type { ProportGlyphRecord, ProportGlyphSink } from "../skin/fiel/proport.js";
import { HdFont } from "../skin/shader/hdtext.js";
import { HdProportFont } from "../skin/shader/hdproport.js";
import { drawVectorNotch } from "../skin/shader/skyband.js";
import { createUpscaler } from "../skin/shader/xbr-gl.js";
import type { Upscaler } from "../skin/shader/upscaler.js";

/** Factor xBR objetivo (16→96 px/tile), el mismo que la piel shader en juego. */
const INTRO_SHADER_FACTOR = 6;

/**
 * GÓTICA HD de la intro (task #73 EJE 2, L7). La fuente PROPORCIONAL de «The Summoning»/
 * gitana se realza con glifos HD a medida (`font-proport-hd.png`) en vez del xBR genérico —
 * misma relación IBM-HD vs xBR ya validada para el texto IBM de la intro. Default ON;
 * `localStorage "u5clone:shader:intro-proport-hd" = "0"` lo apaga (reversible, como pidió
 * el usuario) → la gótica vuelve al xBR suave. La intro FIEL nunca lo toca: el overlay
 * sólo existe en modo shader.
 */
const INTRO_PROPORT_HD_KEY = "u5clone:shader:intro-proport-hd";
function introProportHdEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(INTRO_PROPORT_HD_KEY) !== "0";
  } catch {
    return true;
  }
}

/** Rect en px lógicos (320×200). */
export interface IntroRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Región de ARTE a filtrar por fase (o `null` = no filtrar) + HUECOS de texto a
 * dejar NEAREST dentro de esa región.
 *  · logo/title: pantalla entera (arte puro, sin texto).
 *  · attract: pantalla entera (logo+subtítulo arriba, mundo del demo en el panel),
 *    con hueco en la banda de rótulo `>Escena<` del pie del panel.
 *  · menu/credits: sólo la franja superior de ARTE (logo «Ultima V» + subtítulo de
 *    fuego); el panel inferior (opciones/copyright/créditos) queda NEAREST.
 *  · name/sex/quiz/story (gitana): `"art"` — se filtran SOLO los rects de ARTE que la
 *    intro registra (`recordArt` desde `blitPic`): retrato de la gitana, símbolos de
 *    virtud, cartas de The Summoning. El TEXTO queda fuera de esos rects (el layout de
 *    la intro lo mantiene alrededor/debajo del arte — `drawWrappedAround` excluye el
 *    cartón), así que asoma NEAREST por el overlay transparente; los prompts IBM los
 *    realza el pase HD encima. Decisión del usuario 2026-07-17 (arte filtrado, texto nítido).
 */
export interface IntroFilterPlan {
  /** `"art"` = filtrar los rects de arte registrados (gitana). */
  region: "full" | "art" | IntroRect | null;
  holes: IntroRect[];
}

/** Franja superior de sólo-arte: por encima del panel inferior (INTRO_PANEL.y0). */
const TOP_ART: IntroRect = { x: 0, y: 0, w: SCREEN_W, h: INTRO_PANEL.y0 };

/**
 * Hueco de la banda de rótulo del demo (`>Escena<`): fila 24 (y=192), centrada.
 * `paintTitleBand(title, (INTRO_PANEL.y1 - 7) >> 3)` la pinta en y=(199-7)&~7=192.
 * Se abre un hueco central holgado que cubre cualquier rótulo sin tocar el arte.
 */
const DEMO_TITLE_BAND: IntroRect = { x: 64, y: 190, w: SCREEN_W - 128, h: 10 };

/** Plan de filtro por fase. Puro (sin DOM) → testeable. */
export function introFilterPlan(phase: string): IntroFilterPlan {
  switch (phase) {
    case "logo":
    case "title":
      return { region: "full", holes: [] };
    case "attract":
      return { region: "full", holes: [DEMO_TITLE_BAND] };
    case "menu":
    case "credits":
      return { region: TOP_ART, holes: [] };
    case "name":
    case "sex":
    case "quiz":
    case "story":
      return { region: "art", holes: [] };
    default:
      return { region: null, holes: [] };
  }
}

/**
 * Overlay xBR de la intro. Se superpone al canvas de la intro y filtra por fase.
 * Reutiliza el upscaler xBR de la piel shader (WebGL, o nearest si no hay WebGL).
 */
export class IntroShaderOverlay {
  private readonly overlay: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly crop: HTMLCanvasElement;
  private readonly cropCtx: CanvasRenderingContext2D | null;
  private readonly upscaler: Upscaler;
  private scale = 1;
  private raf = 0;
  /** Fuente remaster HD (task #73, punto 5): realza el texto IBM de la intro. `null`
   * mientras carga o si el asset no está (fallback al texto nearest de la intro). */
  private hdFont: HdFont | null = null;
  /**
   * Glifos IBM que la intro pintó en el frame en curso (sol lista, sin doble buffer:
   * `render()` es SÍNCRONO, así que el overlay lee entre renders una lista COMPLETA).
   * `frameStart` (lo llama `render()` de la intro vía beginFrame) la vacía al empezar.
   */
  private cap: GlyphRecord[] = [];
  /**
   * Remates `►◄` de las titlebars de la intro (Select:/Copyright/rótulo del demo) que
   * `paintTitleBand` registra vía `recordBracket`. Se redibujan VECTOR REDONDEADOS
   * (misma primitiva que cielo/vientos). En px LÓGICOS (la esquina de la celda del
   * remate puede caer a 4 px, no múltiplo de 8 → se guarda el píxel, no la columna).
   */
  private brackets: { px: number; py: number; mirror: boolean }[] = [];
  /** Rects de ARTE de la gitana que la intro registra (`recordArt` desde `blitPic`)
   * para filtrarlos por xBR en las fases `name/sex/quiz/story`. En px lógicos. */
  private art: IntroRect[] = [];
  /** Sumidero que la intro adjunta a SU FaithfulFont cuando el overlay existe. */
  readonly glyphSink: GlyphSink = {
    frameStart: () => {
      this.cap = [];
      this.brackets = [];
      this.art = [];
    },
    record: (rec) => {
      this.cap.push(rec);
    },
  };

  /**
   * Fuente PROPORCIONAL HD (L7): realza la gótica de la intro (`font-proport-hd.png`). `null`
   * mientras carga, si el asset falta, o si el toggle está apagado (fallback al xBR genérico).
   */
  private hdProport: HdProportFont | null = null;
  private readonly proportHdOn = introProportHdEnabled();
  /** Glifos proporcionales que la intro pintó en el frame en curso (sin doble buffer:
   * `render()` es SÍNCRONO). `frameStart` la vacía al empezar el frame. */
  private proportCap: ProportGlyphRecord[] = [];
  /** Sumidero que la intro adjunta a SU FaithfulProportFont cuando el overlay existe. */
  readonly proportGlyphSink: ProportGlyphSink = {
    frameStart: () => {
      this.proportCap = [];
    },
    record: (rec) => {
      this.proportCap.push(rec);
    },
  };

  /** La intro registra aquí cada lámina de arte (blitPic) para el filtro de la gitana. */
  recordArt(x: number, y: number, w: number, h: number): void {
    this.art.push({ x, y, w, h });
  }

  /** La intro registra aquí cada remate de titlebar (px lógicos + orientación). */
  recordBracket(px: number, py: number, mirror: boolean): void {
    this.brackets.push({ px, py, mirror });
  }

  /**
   * Descarta glifos capturados cuya celda solapa el rect lógico `(x,y,w,h)`. La intro
   * lo llama cuando ABRE UN HUECO NEGRO (p.ej. la banda de una titlebar borra lo que
   * la rejilla pintó debajo): en NEAREST ese texto queda tapado, pero el sumidero lo
   * había registrado → sin esta evicción el pase HD repintaría el «fantasma» borrado
   * (bug de copyright duplicado).
   */
  evictRect(x: number, y: number, w: number, h: number): void {
    this.cap = this.cap.filter(
      (g) =>
        !(g.x < x + w && g.x + 8 * g.scale > x && g.y < y + h && g.y + 8 * g.scale > y),
    );
  }

  constructor(
    container: HTMLElement,
    private readonly source: HTMLCanvasElement,
    private readonly phaseOf: () => string,
  ) {
    const overlay = document.createElement("canvas");
    // Centrado EXACTO sobre el canvas de la intro (flex-centrado): absolute + inset:0
    // + margin:auto centra un elemento con ancho/alto explícitos. `pointer-events:none`
    // para no robar clics; `pixelated` para que el blit final no reintroduzca blur.
    overlay.style.cssText =
      "position:absolute;inset:0;margin:auto;image-rendering:pixelated;pointer-events:none;";
    overlay.setAttribute("data-testid", "u5-intro-shader-overlay");
    container.appendChild(overlay);
    this.overlay = overlay;
    this.ctx = overlay.getContext("2d");
    const crop = document.createElement("canvas");
    this.crop = crop;
    this.cropCtx = crop.getContext("2d", { willReadFrequently: true });
    this.upscaler = createUpscaler(INTRO_SHADER_FACTOR);
    // Atlas HD (mismo que la piel de juego). Best-effort: sin él, texto nearest.
    void HdFont.load().then((f) => {
      this.hdFont = f;
    });
    // Atlas proporcional HD (gótica de intro, L7). Best-effort y bajo toggle: sin él, o
    // apagado, la gótica queda en el xBR genérico.
    if (this.proportHdOn) {
      void HdProportFont.load().then((f) => {
        this.hdProport = f;
      });
    }
  }

  /** Ajusta el backbuffer (320S×200S) y el tamaño CSS al del canvas de la intro. */
  resize(s: number): void {
    this.scale = Math.max(1, Math.round(s));
    const bbW = SCREEN_W * this.scale;
    const bbH = SCREEN_H * this.scale;
    if (this.overlay.width !== bbW || this.overlay.height !== bbH) {
      this.overlay.width = bbW;
      this.overlay.height = bbH;
    }
    this.overlay.style.width = `${SCREEN_W * s}px`;
    this.overlay.style.height = `${SCREEN_H * s}px`;
  }

  start(): void {
    if (this.raf) return;
    const loop = (): void => {
      this.present();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private present(): void {
    const ctx = this.ctx;
    const cropCtx = this.cropCtx;
    if (!ctx || !cropCtx) return;
    const s = this.scale;
    ctx.clearRect(0, 0, SCREEN_W * s, SCREEN_H * s);
    const plan = introFilterPlan(this.phaseOf());

    if (plan.region === "art") {
      // Gitana: filtra SOLO los rects de arte registrados (retrato/símbolos/cartas);
      // el texto queda fuera de ellos → asoma nearest por el overlay transparente.
      for (const rect of this.art) this.filterRect(ctx, cropCtx, s, rect);
    } else if (plan.region) {
      const rect: IntroRect =
        plan.region === "full" ? { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H } : plan.region;
      this.filterRect(ctx, cropCtx, s, rect);
      // Huecos de texto dentro del arte: se limpian → el texto NEAREST de la intro
      // asoma (fallback para los glifos que el atlas HD aún no trae).
      for (const h of plan.holes) {
        ctx.clearRect(h.x * s, h.y * s, h.w * s, h.h * s);
      }
    }

    // Pase de TEXTO HD (punto 5): realza las MISMAS celdas IBM que pintó la intro
    // (sumidero) desde el atlas HD. Corre SIEMPRE (también en fases sin filtro, como
    // la gitana). Glifos no cubiertos por el atlas → transparentes → asoma el nearest
    // de la intro (en huecos/regiones sin filtrar).
    this.drawHdText(ctx, s);

    // Pase de GÓTICA HD (L7): realza el texto PROPORCIONAL (The Summoning/gitana) desde el
    // atlas proporcional HD, igual que el IBM. Bajo toggle (default ON); sin atlas queda el
    // xBR genérico de debajo (que ya filtraba la gótica en las fases de arte).
    this.drawHdProport(ctx, s);

    // Remates `►◄` de las titlebars de la intro → VECTOR REDONDEADOS (misma primitiva
    // que cielo/vientos), tapando el remate bitmap nearest de la intro debajo.
    for (const b of this.brackets) {
      drawVectorNotch(ctx, b.px * s, b.py * s, 8 * s, b.mirror);
    }
  }

  /** Recorta `rect` del canvas de la intro, lo pasa por xBR y lo blitea al overlay a ×S. */
  private filterRect(
    ctx: CanvasRenderingContext2D,
    cropCtx: CanvasRenderingContext2D,
    s: number,
    rect: IntroRect,
  ): void {
    if (rect.w <= 0 || rect.h <= 0) return;
    if (this.crop.width !== rect.w || this.crop.height !== rect.h) {
      this.crop.width = rect.w;
      this.crop.height = rect.h;
    }
    cropCtx.imageSmoothingEnabled = false;
    cropCtx.clearRect(0, 0, rect.w, rect.h);
    cropCtx.drawImage(this.source, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    const r = this.upscaler.upscale(this.crop, rect.w, rect.h);
    ctx.imageSmoothingEnabled = r.smooth;
    ctx.drawImage(r.source, 0, 0, r.sw, r.sh, rect.x * s, rect.y * s, rect.w * s, rect.h * s);
    ctx.imageSmoothingEnabled = false;
  }

  /** Blitea las celdas IBM capturadas desde el atlas HD (bilineal), sobre el overlay. */
  private drawHdText(ctx: CanvasRenderingContext2D, s: number): void {
    const hd = this.hdFont;
    if (!hd) return;
    ctx.imageSmoothingEnabled = true;
    for (const g of this.cap) {
      hd.drawGlyph(ctx, g.code, g.x * s, g.y * s, 8 * g.scale * s, g.color);
    }
    ctx.imageSmoothingEnabled = false;
  }

  /**
   * Blitea los glifos PROPORCIONALES capturados desde el atlas proporcional HD (bilineal).
   * Cada glifo ocupa `width`×8 lógicos en (x,y) → rect de dispositivo (x·s, y·s, width·s, 8·s).
   * Los códigos que el atlas no trae dejan ver el xBR/nearest de debajo (fallback por-glifo).
   */
  private drawHdProport(ctx: CanvasRenderingContext2D, s: number): void {
    const hd = this.hdProport;
    if (!hd) return;
    ctx.imageSmoothingEnabled = true;
    for (const g of this.proportCap) {
      hd.drawGlyph(ctx, g.code, g.x * s, g.y * s, g.width * s, 8 * s);
    }
    ctx.imageSmoothingEnabled = false;
  }

  dispose(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.upscaler.dispose();
    this.overlay.remove();
  }
}
