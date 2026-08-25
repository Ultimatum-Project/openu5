/**
 * Fuente PROPORCIONAL PROPORT.PCS en runtime para las cinemáticas de la intro
 * (E1-S13c, unidad 2a-ii). El texto de "The Summoning" y la gitana NO usa la
 * IBM.CH monoespaciada sino la fuente proporcional que `play_introduction`
 * renderiza vía el thunk far `0xfb26` → `render_justified_text` (FONT.OVL).
 *
 * Envuelve el atlas `proport-font.png` (tira horizontal de 8 px de alto,
 * blanco/transparente) + el manifiesto `proport-font.json`
 * (`{height, glyphs:[{code,x,width}]}`) que produce el extractor
 * (`extractor/src/parsers/proport.ts`, derivado de `intro-blit-formats.md §3.3`).
 *
 * El renderer del original justifica con márgenes/pen por escena (globals
 * 5146/514c=izq/der, 5150/5152=banda, 5156/5158=pen); el codec marca `'{'` como
 * sangría (+0xF) y `'_'` como guión discrecional. El extractor de escenas
 * (`intro-scenes.ts`) YA colapsa `'_'` y convierte `'{'` en salto de párrafo, así
 * que aquí recibimos párrafos limpios y aplicamos word-wrap proporcional dentro de
 * la banda [xLeft..xRight] px. La justificación por reparto exacta = Clase C
 * (píxel-diff #26); aquí se alinea a la izquierda respetando los márgenes.
 */

import { lineSegments } from "./summoning-layout.js";

export interface ProportGlyphRect {
  code: number;
  x: number;
  width: number;
}

interface ProportManifest {
  height: number;
  glyphs: ProportGlyphRect[];
}

/** Un glifo proporcional blitado: código + posición lógica (px) + ancho de TINTA (px). */
export interface ProportGlyphRecord {
  code: number;
  x: number;
  y: number;
  width: number;
}

/**
 * Sumidero de captura de glifos proporcionales (task #73 EJE 2, gótica de intro HD, L7):
 * la piel «shader» de la intro adjunta uno para ENUMERAR las mismas celdas proporcionales
 * que pinta la fiel y recomponerlas desde el atlas HD (`font-proport-hd.png`) — MISMO patrón
 * que `GlyphSink` de `fiel/font.ts` para la IBM.CH. Es OPCIONAL y OUTPUT-NEUTRAL: sin
 * sumidero, la fuente pinta exactamente igual (la intro fiel queda byte-idéntica).
 */
export interface ProportGlyphSink {
  frameStart(): void;
  record(rec: ProportGlyphRecord): void;
}

/** Interlínea del texto proporcional: alto del glifo (8) + 1 px de separación. */
const LINE_GAP = 1;
/**
 * Separación INTER-LETRA (px) que el renderer del original añade tras cada glifo. Los
 * anchos de PROPORT.PCS (`[DS 0x50ca]`) son de TINTA (sin hueco); el `render_justified_text`
 * (FONT.OVL 0x0000, emit 0x01d1) avanza penX un píxel MÁS por glifo — el hueco de tracking.
 * Sin él las letras salen PEGADAS y cada línea empaqueta ~1 palabra de más (testigo del
 * usuario 2026-07-18 + derivación del punto de corte contra ORIG_04: manifest+1/glifo es lo
 * único que reproduce el corte "…nearby | woods" del original). No aplica al espacio (0x20),
 * que lleva su propio ancho base.
 */
const INTER_LETTER = 1;
/**
 * Ancho BASE del espacio entre palabras (`[0x5154]`, font.md §Justif L25). El glifo 0x20
 * de PROPORT.PCS tiene width=0 (intro-blit-formats.md §3.3): el separador de palabra lo
 * aporta el renderer (render_justified_text), no el glifo. Valor = 4 px DERIVADO del punto
 * de corte: sólo `espacio=4` + banda 308-317 reproduce los saltos de línea de ORIG_04
 * (con espacio 3 la banda sale <308, con 5 >317; ninguna casa la banda medida ~314). La
 * justificación reparte el remanente ENCIMA de este base (justifiedGaps).
 */
const SPACE_W = 4;
/**
 * GUION DISCRECIONAL (soft hyphen, U+00AD). El extractor conserva el '_' (0x5f) del
 * justificador del original como U+00AD (font.md §Justif L26: "'_' break suave, ancho 0").
 * Es INVISIBLE (ancho 0, no está en el atlas) salvo cuando una línea PARTE en él: ahí se
 * pinta un '-'. Así el motor hifena "Com{U+00AD}passion" → "Com-/passion" como ORIG_12,
 * sin dejar guiones espurios donde no se parte.
 */
const SOFT_HYPHEN = "­";
const HYPHEN_CODE = 0x2d; // '-'

export class FaithfulProportFont {
  private readonly byCode = new Map<number, ProportGlyphRect>();

  /** Sumidero de captura opcional (piel shader de intro). Sin él, `drawGlyph` no cambia. */
  private sink?: ProportGlyphSink;

  private constructor(
    private readonly atlas: CanvasImageSource,
    readonly height: number,
    glyphs: readonly ProportGlyphRect[],
  ) {
    for (const g of glyphs) this.byCode.set(g.code, g);
  }

  /** Adjunta/retira el sumidero de captura de glifos (OUTPUT-NEUTRAL). */
  setGlyphSink(sink: ProportGlyphSink | undefined): void {
    this.sink = sink;
  }

  /** Marca el inicio de un frame de pintado para el sumidero (no-op sin él). */
  beginFrame(): void {
    this.sink?.frameStart();
  }

  /** Construye desde un atlas + manifiesto ya decodificados (seam de `load` y de los tests). */
  static fromManifest(
    atlas: CanvasImageSource,
    height: number,
    glyphs: readonly ProportGlyphRect[],
  ): FaithfulProportFont {
    return new FaithfulProportFont(atlas, height, glyphs);
  }

  /** Carga atlas + manifiesto (navegador). Lanza si faltan. */
  static async load(
    pngUrl = "/assets/proport-font.png",
    jsonUrl = "/assets/proport-font.json",
  ): Promise<FaithfulProportFont> {
    const img = new Image();
    img.src = pngUrl;
    const [manifest] = await Promise.all([
      fetch(jsonUrl).then((r) => r.json() as Promise<ProportManifest>),
      img.decode(),
    ]);
    return FaithfulProportFont.fromManifest(img, manifest.height, manifest.glyphs);
  }

  /** Interlínea (alto de glifo + separación). */
  get lineHeight(): number {
    return this.height + LINE_GAP;
  }

  /** Ancho de avance de un carácter: ancho de tinta + tracking inter-letra. El espacio
   * usa el hueco base (glifo w=0); los glifos ausentes no avanzan. */
  private advance(code: number): number {
    if (code === 0x20) return SPACE_W;
    const w = this.byCode.get(code)?.width ?? 0;
    return w > 0 ? w + INTER_LETTER : 0;
  }

  /** Ancho de avance total de una palabra/cadena en px (proporcional). */
  measure(text: string): number {
    let w = 0;
    for (let i = 0; i < text.length; i++) w += this.advance(text.charCodeAt(i));
    return w;
  }

  /**
   * HIFENACIÓN: si `word` tiene guiones discrecionales (U+00AD) y no cabe entera en
   * `availW`, devuelve el corte MÁS LARGO que quepa — `head` = prefijo hasta un guión + '-'
   * (para la línea actual), `tail` = resto (conserva sus guiones para volver a partir). Sin
   * guiones o si ningún prefijo cabe, devuelve null (la palabra envuelve entera). Calco de
   * render_justified_text: parte SÓLO en los puntos marcados por el original.
   */
  private hyphenate(word: string, availW: number): { head: string; tail: string } | null {
    const parts = word.split(SOFT_HYPHEN);
    if (parts.length < 2) return null;
    const hyphenW = this.advance(HYPHEN_CODE);
    let acc = "";
    let best: { head: string; tail: string } | null = null;
    for (let k = 0; k < parts.length - 1; k++) {
      acc += parts[k];
      if (this.measure(acc) + hyphenW <= availW) {
        best = { head: `${acc}-`, tail: parts.slice(k + 1).join(SOFT_HYPHEN) };
      } else break; // prefijos mayores tampoco caben
    }
    return best;
  }

  /** Blitea un glifo por su código en (dx,dy); no-op si el glifo no existe. */
  private drawGlyph(ctx: CanvasRenderingContext2D, code: number, dx: number, dy: number): void {
    const g = this.byCode.get(code);
    if (!g || g.width === 0) return;
    // Captura opcional (piel shader de intro): enumera la celda ANTES de blitear, para que
    // el pase HD la recomponga desde el atlas proporcional HD. No altera el pintado.
    this.sink?.record({ code, x: dx, y: dy, width: g.width });
    ctx.drawImage(this.atlas, g.x, 0, g.width, this.height, dx, dy, g.width, this.height);
  }

  /** Blitea una cadena a la izquierda desde (x,y); devuelve el x final. */
  drawLine(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): number {
    let cx = x;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      this.drawGlyph(ctx, code, cx, y);
      cx += this.advance(code);
    }
    return cx;
  }

  /**
   * JUSTIFICACIÓN (render_justified_text, FONT.OVL 0x0136-0x0167, font.md §Justif):
   * reparte el remanente `ancho_banda − ancho_natural` de una línea entre sus N huecos
   * (espacios), front-loaded (los `rem % N` primeros reciben +1 px). Devuelve el ancho de
   * cada hueco. Sin huecos (1 palabra) o sin remanente positivo → espacio base. El binario
   * justifica TODA línea salvo la última del párrafo (verificado contra ORIG_04/05/12: los
   * márgenes derechos casan al píxel en full-width Y en las columnas junto a la lámina).
   */
  private justifiedGaps(words: string[], segW: number, spaceW: number): number[] {
    const n = words.length - 1;
    if (n <= 0) return [];
    const natural = words.reduce((s, w) => s + this.measure(w), 0) + n * spaceW;
    const rem = segW - natural;
    if (rem <= 0) return new Array<number>(n).fill(spaceW);
    const per = Math.floor(rem / n);
    const extra = rem % n;
    return Array.from({ length: n }, (_, i) => spaceW + per + (i < extra ? 1 : 0));
  }

  /**
   * Dibuja las palabras de una línea desde `x0`, con `gaps[i]` px entre la palabra i y la
   * i+1 (`gaps=null` → espacio base uniforme = línea NO justificada, la última del párrafo).
   */
  private drawWords(
    ctx: CanvasRenderingContext2D,
    words: string[],
    x0: number,
    y: number,
    gaps: number[] | null,
    spaceW: number,
  ): void {
    let cx = x0;
    for (let i = 0; i < words.length; i++) {
      cx = this.drawLine(ctx, words[i]!, cx, y);
      if (i < words.length - 1) cx += gaps ? gaps[i]! : spaceW;
    }
  }

  /**
   * Word-wrap proporcional de `text` (párrafos separados por '\n') dentro de la
   * banda horizontal [xLeft..xRight] px, empezando en `yTop`. Corta cada línea al
   * superar `xRight-xLeft` de ancho de avance; para en `yBot` (inclusive). El
   * ancho del espacio sale de la propia fuente (glifo 0x20). JUSTIFICA cada línea
   * partida por ancho a la banda (front-loaded); la última de cada párrafo va ragged.
   */
  drawWrapped(
    ctx: CanvasRenderingContext2D,
    text: string,
    xLeft: number,
    yTop: number,
    xRight: number,
    yBot: number,
  ): void {
    const maxW = Math.max(1, xRight - xLeft);
    const spaceW = this.advance(0x20) || 4;
    let y = yTop;
    for (const para of text.split("\n")) {
      let placed: string[] = [];
      let lineW = 0;
      const flush = (justify: boolean): void => {
        if (y > yBot || placed.length === 0) return;
        this.drawWords(ctx, placed, xLeft, y, justify ? this.justifiedGaps(placed, maxW, spaceW) : null, spaceW);
        y += this.lineHeight;
        placed = [];
        lineW = 0;
      };
      for (const word of para.split(/\s+/)) {
        if (word.length === 0) continue;
        const w = this.measure(word);
        if (placed.length > 0 && lineW + spaceW + w > maxW) {
          flush(true); // partida por ancho → JUSTIFICADA
          placed = [word];
          lineW = w;
        } else if (placed.length === 0) {
          placed = [word];
          lineW = w;
        } else {
          placed.push(word);
          lineW += spaceW + w;
        }
      }
      flush(false); // última línea del párrafo → ragged
    }
  }

  /**
   * Word-wrap proporcional FLUYENDO ALREDEDOR de un rectángulo de EXCLUSIÓN — el
   * modelo REAL de "The Summoning" (item G, `summoning-layout.ts`): el texto se
   * justifica en la banda `region` y, en las líneas cuyo Y intersecta `exclude`
   * (el cartón), ocupa sólo los segmentos a izquierda/derecha de él (los segmentos
   * se recortan a la banda). Así emergen los 3 regímenes del original: full-width
   * por arriba/abajo del cartón y columnas a los lados. Sin `exclude`, es un
   * word-wrap de rectángulo normal. Los párrafos van separados por '\n'.
   */
  /**
   * Flujo JUSTIFICADO por BANDAS (pantallas de historia del ENDGAME, GAP 6): el texto
   * fluye SECUENCIALMENTE por la lista de rects `bands` (banda A → banda B), con la
   * MISMA hifenación/justificación/sangría que `drawWrappedAround`. Calco del render
   * del cierre: la rutina de historia (ENDGAME.OVL 0x0000, cuerpo 0x0117-0x015a) carga
   * POR PÁGINA los dos rects de texto en los globals 0x5146-0x5158 (desde las tablas
   * DATA.OVL DS 0x3da6-0x3dca) y el kernel de texto justificado (`call 0xffffda56`)
   * fluye la página dentro de esas DOS bandas (banda A = franja junto/encima del arte,
   * banda B = resto de la pantalla).
   */
  drawWrappedBands(
    ctx: CanvasRenderingContext2D,
    text: string,
    bands: ReadonlyArray<{ x0: number; y0: number; x1: number; y1: number }>,
    opts?: { paragraphIndent?: number },
  ): void {
    const lh = this.lineHeight;
    const spaceW = this.advance(0x20) || 4;
    const INDENT_DEFAULT = 0xf; // 15 px — font.md §Justif L26 (mismo que drawWrappedAround)
    const indentPx = opts?.paragraphIndent ?? INDENT_DEFAULT;
    const words: string[] = [];
    for (const para of text.split("\n")) {
      for (const w of para.split(/\s+/)) if (w.length > 0) words.push(w);
      words.push("\n");
    }
    let wi = 0;
    let indentNext = indentPx > 0;
    for (const band of bands) {
      let y = band.y0;
      while (wi < words.length && y + lh <= band.y1 + 1) {
        if (words[wi] === "\n") {
          wi++;
          if (indentPx > 0) indentNext = true;
          else y += lh;
          continue;
        }
        const x0 = indentNext ? band.x0 + indentPx : band.x0;
        const segW = band.x1 - x0;
        const placed: string[] = [];
        let lineW = 0;
        while (wi < words.length && words[wi] !== "\n") {
          const w = this.measure(words[wi]!);
          const add = placed.length === 0 ? w : spaceW + w;
          if (placed.length > 0 && lineW + add > segW) {
            const hy = this.hyphenate(words[wi]!, segW - lineW - spaceW);
            if (hy) {
              placed.push(hy.head);
              words[wi] = hy.tail;
            }
            break;
          }
          if (placed.length === 0 && w > segW) {
            const hy = this.hyphenate(words[wi]!, segW);
            if (hy) {
              placed.push(hy.head);
              words[wi] = hy.tail;
            } else {
              placed.push(words[wi]!);
              wi++;
            }
            break;
          }
          placed.push(words[wi]!);
          lineW += add;
          wi++;
        }
        if (placed.length === 0) break; // sin progreso posible en esta banda
        const justify = wi < words.length && words[wi] !== "\n";
        this.drawWords(ctx, placed, x0, y, justify ? this.justifiedGaps(placed, segW, spaceW) : null, spaceW);
        indentNext = false;
        y += lh;
      }
      if (wi >= words.length) break;
    }
  }

  drawWrappedAround(
    ctx: CanvasRenderingContext2D,
    text: string,
    region: { x0: number; y0: number; x1: number; y1: number },
    exclude?: { x0: number; y0: number; x1: number; y1: number } | null,
    opts?: { paragraphIndent?: number },
  ): void {
    const lh = this.lineHeight;
    const spaceW = this.advance(0x20) || 4;
    const MIN_SEG = spaceW * 3; // segmento demasiado estrecho para texto → se ignora
    // SANGRÍA de párrafo (calco): el control '{' de PROPORT/render_justified_text añade
    // +0xF px a la 1ª línea del párrafo (font.md §Justif L26: "'{' (0x7b) = +0xF de
    // sangría"). El extractor de escenas ya convierte '{' en salto de párrafo, así que
    // aquí CADA párrafo (incluido el primero) sangra su 1ª línea 0xF px — verificado
    // contra ORIG_04 (creación, ~14-15 px) y confirmado por el testigo del usuario para
    // creación Y The Summoning. `paragraphIndent:0` desactiva la sangría (deja línea en
    // blanco entre párrafos) para llamadores que lo necesiten.
    const INDENT_DEFAULT = 0xf; // 15 px — font.md §Justif L26
    const indentPx = opts?.paragraphIndent ?? INDENT_DEFAULT;
    // Cola de palabras con '\n' como marca de fin de párrafo (salto forzado).
    const words: string[] = [];
    for (const para of text.split("\n")) {
      for (const w of para.split(/\s+/)) if (w.length > 0) words.push(w);
      words.push("\n");
    }
    let wi = 0;
    let y = region.y0;
    // La 1ª línea del PRIMER párrafo también sangra (witness ORIG_04/12: la línea de
    // apertura arranca indentada, no a ras del margen).
    let indentNext = indentPx > 0;
    while (wi < words.length && y + lh <= region.y1 + 1) {
      if (words[wi] === "\n") {
        wi++;
        if (indentPx > 0) indentNext = true; // sin línea en blanco; sangra la siguiente
        else y += lh; // el salto de párrafo consume una línea (default)
        continue;
      }
      const segs = lineSegments(region, exclude, y, lh, MIN_SEG);
      if (segs.length === 0) {
        y += lh; // banda tapada del todo por el cartón: baja sin colocar
        continue;
      }
      let placedAny = false;
      for (let si = 0; si < segs.length; si++) {
        const seg = segs[si]!;
        const x0 = si === 0 && indentNext ? seg.x0 + indentPx : seg.x0;
        const segW = seg.x1 - x0;
        const placed: string[] = [];
        let lineW = 0;
        while (wi < words.length && words[wi] !== "\n") {
          const w = this.measure(words[wi]!);
          const add = placed.length === 0 ? w : spaceW + w;
          if (placed.length > 0 && lineW + add > segW) {
            // No cabe entera → intenta HIFENAR un prefijo en esta línea; el resto (tail)
            // se re-procesa en la siguiente. Sin punto de corte que quepa, envuelve entera.
            const hy = this.hyphenate(words[wi]!, segW - lineW - spaceW);
            if (hy) {
              placed.push(hy.head);
              words[wi] = hy.tail;
            }
            break;
          }
          if (placed.length === 0 && w > segW) {
            // 1ª palabra más ancha que el segmento: hifénala si hay corte; si no, colócala
            // igual (evita cuelgue).
            const hy = this.hyphenate(words[wi]!, segW);
            if (hy) {
              placed.push(hy.head);
              words[wi] = hy.tail;
            } else {
              placed.push(words[wi]!);
              wi++;
            }
            break;
          }
          placed.push(words[wi]!);
          lineW += add;
          wi++;
        }
        if (placed.length > 0) {
          // JUSTIFICA el segmento salvo que sea la ÚLTIMA línea colocada del párrafo (lo
          // siguiente es '\n' o el fin del texto) — calco de render_justified_text
          // (font.md §Justif), verificado al píxel contra ORIG_04 (full-width y columna).
          const justify = wi < words.length && words[wi] !== "\n";
          this.drawWords(ctx, placed, x0, y, justify ? this.justifiedGaps(placed, segW, spaceW) : null, spaceW);
          placedAny = true;
        }
      }
      if (!placedAny) break; // nada cupo → no hay progreso posible
      indentNext = false; // la sangría sólo aplica a la 1ª línea del párrafo
      y += lh;
    }
  }
}
