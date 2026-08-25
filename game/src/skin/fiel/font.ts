/**
 * Fuente IBM.CH en runtime para la piel fiel (E1-S8a). Envuelve el atlas
 * `font-ibm.png` (128×64, rejilla 16×8, blanco/transparente) que produce el
 * extractor (`extractor/src/parsers/font.ts`) y blitea un glifo a un canvas 2D.
 *
 * El mapeo código→celda es idéntico al del atlas y al índice del kernel
 * (`code << 3`, `re/notes/ui-text-layer.md §1`): 8×8 px por celda, 16 por fila.
 * El color/atributo (reverse, fg) es chrome de S8b; aquí el glifo va tal cual
 * (blanco), tintable por composición cuando S8b lo pida.
 */
export const GLYPH_PX = 8;
export const ATLAS_COLS = 16;

/**
 * ATLAS DE EXTENSIÓN LATINO-1 (i18n F1c, spec docs/skin-remaster/lote-L5-fuente-ext.md).
 * La mitad alta de ISO-8859-1 `U+00A0..00FF` en una rejilla 16×6 (mismo layout en el
 * 8×8 fiel `font-ibm-ext.png` y el HD `font-ibm-hd-ext.png`, sólo cambia el px/celda).
 * Enrutado POR CODEPOINT: un cp≥0xA0 JAMÁS aparece en texto inglés (ASCII), así que la
 * identidad byte-exacta de la fiel en inglés queda intacta POR CONSTRUCCIÓN (esta rama
 * nunca se toma). Poblado = U+00A1..FF EXCEPTO 0xAD (SHY); 0xA0 (NBSP) no tiene glifo.
 */
const EXT_BASE = 0xa0;
const EXT_COLS = 16;

/** ¿`code` es un glifo de extensión poblado (Latino-1 imprimible, no NBSP/SHY)? */
export function isExtGlyph(code: number): boolean {
  return code >= 0xa1 && code <= 0xff && code !== 0xad;
}

/** Celda del atlas de extensión para `code` (px), dado el tamaño de celda. */
export function extGlyphCell(code: number, cellPx: number): { sx: number; sy: number } {
  const i = code - EXT_BASE;
  return { sx: (i % EXT_COLS) * cellPx, sy: Math.floor(i / EXT_COLS) * cellPx };
}

/** Fuente de imagen dibujable (Image/ImageBitmap/Canvas) — sin acoplar al DOM. */
export type GlyphSource = CanvasImageSource;

/** Un glifo blitado por la fuente: código + posición lógica + escala + tinte. */
export interface GlyphRecord {
  code: number;
  x: number;
  y: number;
  scale: number;
  color?: string;
  /**
   * true → el glifo salió de RUNES.CH (letrero (L)ook / profecía rúnica de la
   * consola): el pase HD de la piel shader lo enruta al atlas RÚNICO
   * (`font-runes-hd.png`, lote-L6), no al de texto IBM. Ausente/false = IBM.CH.
   */
  rune?: boolean;
}

/**
 * Sumidero de captura de glifos (task #73 EJE 2, cableado de la fuente remaster):
 * la piel «shader» adjunta uno para ENUMERAR las mismas celdas que pinta la fiel y
 * recomponerlas desde el atlas HD. Es OPCIONAL y OUTPUT-NEUTRAL: sin sumidero, la
 * fuente pinta exactamente igual (la fiel 1988 queda byte-idéntica). `frameStart`
 * marca el inicio de un frame de pintado (lo llama `paintFaithful`).
 */
export interface GlyphSink {
  frameStart(): void;
  record(rec: GlyphRecord): void;
  /**
   * Registra un remate de banda `►◄` (bitmap `draw_box_edge`, NO un glifo) para que la
   * piel shader lo redibuje VECTOR redondeado. `x,y` en px lógicos, `mirror` = `◄`.
   * OPCIONAL: la piel fiel no lo usa; sólo la shader lo implementa.
   */
  recordBracket?(x: number, y: number, mirror: boolean): void;
}

/** Coordenada de la celda del glifo `code` dentro del atlas (px). */
export function glyphCell(code: number): { sx: number; sy: number } {
  const c = code & 0x7f; // 128 glifos; alto-bit ya enmascarado por el modelo
  return { sx: (c % ATLAS_COLS) * GLYPH_PX, sy: Math.floor(c / ATLAS_COLS) * GLYPH_PX };
}

export class FaithfulFont {
  /**
   * `atlas` = font-ibm.png (128 glifos ASCII/época). `extAtlas` (opcional) =
   * font-ibm-ext.png (Latino-1 U+00A0..FF, acentos): sin él, un cp≥0xA0 cae al atlas
   * base (comportamiento actual), como pidió el diseño de ausencia-con-gracia.
   */
  constructor(
    readonly atlas: GlyphSource,
    private extAtlas?: GlyphSource,
  ) {}

  /** Buffer offscreen reutilizable para tintar un glifo (sólo si se pide color). */
  private tintBuf?: OffscreenCanvas;

  /** Sumidero de captura opcional (piel shader). Sin él, `drawGlyph` no cambia. */
  private sink?: GlyphSink;

  /** Adjunta/retira el sumidero de captura de glifos (OUTPUT-NEUTRAL). */
  setGlyphSink(sink: GlyphSink | undefined): void {
    this.sink = sink;
  }

  /** Marca el inicio de un frame de pintado para el sumidero (no-op sin él). */
  beginFrame(): void {
    this.sink?.frameStart();
  }

  /**
   * Registra un remate de banda `►◄` en el sumidero (no-op sin él, y sin `recordBracket`
   * en el sumidero). OUTPUT-NEUTRAL: no dibuja nada — la fiel pinta su remate bitmap
   * igual; sólo enumera su posición para que la shader lo redibuje vector.
   */
  recordBracket(x: number, y: number, mirror: boolean): void {
    this.sink?.recordBracket?.(x, y, mirror);
  }

  /**
   * Registra un glifo en el sumidero SIN dibujarlo (no-op sin sumidero). OUTPUT-NEUTRAL:
   * lo usa la fiel para enumerar celdas que pinta por una vía PROPIA (no `drawGlyph`) —
   * p.ej. el bullet ► de consola (`drawBullet`, composición 2-color) — de modo que el
   * pase de la piel shader las trate como el resto del texto (aquí, re-blit suavizado).
   * `rune` marca los glifos de RUNES.CH (celdas rúnicas de la consola: letreros (L)ook
   * y profecía) para que el pase HD los sirva del atlas rúnico (lote-L6).
   */
  record(code: number, x: number, y: number, scale = 1, color?: string, rune?: boolean): void {
    this.sink?.record({ code, x, y, scale, color, rune });
  }

  /**
   * Carga el atlas de fuente desde una URL (navegador). `extUrl` (opcional) carga
   * ADEMÁS el atlas de extensión Latino-1 para los acentos (i18n F1c); su carga es
   * NO fatal: si falta el asset (gitignored) o no decodifica, la fuente funciona sin
   * él (los acentos caen al atlas base). Las fuentes que no son de texto (p.ej. runas)
   * no pasan `extUrl`.
   */
  static async load(url = "/assets/font-ibm.png", extUrl?: string): Promise<FaithfulFont> {
    const img = new Image();
    img.src = url;
    await img.decode();
    let ext: GlyphSource | undefined;
    if (extUrl) {
      try {
        const e = new Image();
        e.src = extUrl;
        await e.decode();
        if (e.naturalWidth > 0 && e.naturalHeight > 0) ext = e;
      } catch {
        /* atlas de extensión ausente: acentos caen al atlas base (sin romper) */
      }
    }
    return new FaithfulFont(img, ext);
  }

  /**
   * Blitea el glifo `code` en (dx,dy) del contexto, escalado por `scale`
   * (píxeles enteros; `imageSmoothingEnabled=false` lo pone la piel). El glifo
   * en blanco (0x20) o vacío no dibuja nada visible pero se blitea igual (es
   * transparente) — el llamador puede saltárselo por eficiencia.
   *
   * `color` (opcional) TINTA el glifo con ese color CSS (p.ej. el sol amarillo de
   * la banda celeste): el atlas es blanco/transparente, así que la tinta se hace
   * en un buffer offscreen con `source-in` (conserva la silueta del glifo). Sin
   * `color`, el glifo va tal cual (blanco) — ruta idéntica a antes.
   */
  drawGlyph(
    ctx: CanvasRenderingContext2D,
    code: number,
    dx: number,
    dy: number,
    scale = 1,
    color?: string,
  ): void {
    // Captura opcional (piel shader): registra la celda ANTES de blitear, con el
    // CODEPOINT real (incl. ≥0xA0), para que el pase HD enrute igual. No altera el pintado.
    this.sink?.record({ code, x: dx, y: dy, scale, color });
    // Enrutado Latino-1 (i18n F1c): un cp≥0xA0 poblado sale del atlas de EXTENSIÓN.
    // Sin atlas ext, o cp no poblado → cae al atlas base (comportamiento actual, así
    // el inglés —ASCII— es byte-idéntico: nunca entra aquí).
    const useExt = this.extAtlas !== undefined && isExtGlyph(code);
    const src = useExt ? this.extAtlas! : this.atlas;
    const { sx, sy } = useExt ? extGlyphCell(code, GLYPH_PX) : glyphCell(code);
    // El tintado usa OffscreenCanvas (presente en el navegador/Playwright). En
    // entornos sin él (jsdom de los tests unitarios) se cae al blit normal en
    // blanco: los tests no verifican color, sólo que el glifo se blitea.
    if (color && typeof OffscreenCanvas !== "undefined") {
      const buf = (this.tintBuf ??= new OffscreenCanvas(GLYPH_PX, GLYPH_PX));
      const b = buf.getContext("2d")!;
      b.clearRect(0, 0, GLYPH_PX, GLYPH_PX);
      b.drawImage(src, sx, sy, GLYPH_PX, GLYPH_PX, 0, 0, GLYPH_PX, GLYPH_PX);
      b.globalCompositeOperation = "source-in"; // tinta sólo los píxeles del glifo
      b.fillStyle = color;
      b.fillRect(0, 0, GLYPH_PX, GLYPH_PX);
      b.globalCompositeOperation = "source-over";
      ctx.drawImage(buf, 0, 0, GLYPH_PX, GLYPH_PX, dx, dy, GLYPH_PX * scale, GLYPH_PX * scale);
      return;
    }
    ctx.drawImage(
      src,
      sx,
      sy,
      GLYPH_PX,
      GLYPH_PX,
      dx,
      dy,
      GLYPH_PX * scale,
      GLYPH_PX * scale,
    );
  }
}
