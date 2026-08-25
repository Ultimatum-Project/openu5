/**
 * Fuente PROPORCIONAL REMASTER HD para la piel «shader» de la intro (task #73 EJE 2,
 * gótica de intro, L7 — cableado). Envuelve el atlas `font-proport-hd.png` (TIRA de 32 px
 * de alto = 4× de PROPORT.PCS, blanco/alfa) + su manifiesto `font-proport-hd.json`
 * (`{height:32, glyphs:[{code,x,width}]}`, x/width ×4 del 8px) que produce
 * `docs/skin-remaster/shader-evolucion/font_proport.py`.
 *
 * Es el gemelo de `HdFont` (hdtext.ts) para la fuente proporcional: el pase de texto de
 * la intro shader recibe las MISMAS celdas que enumeró la fiel (código + posición +
 * ancho de tinta, vía el sumidero de `FaithfulProportFont`) y las blitea a resolución de
 * dispositivo desde el atlas HD, suavizado bilineal (como el texto IBM HD y el mundo xBR).
 *
 * AUSENCIA CON GRACIA: el atlas es un asset gitignored (obra derivada, como `tiles-hd.png`
 * / `font-ibm-hd.png`). Si falta o no decodifica, `load` devuelve `null` y la intro shader
 * cae a la gótica filtrada por el xBR genérico (comportamiento previo), sin hueco visual.
 * Un código sin celda en el manifiesto es un no-op (deja ver el nearest/xBR de debajo).
 */

interface ProportHdManifest {
  height: number;
  glyphs: { code: number; x: number; width: number }[];
}

/** Decodifica un atlas HD por URL, o `null` si falta/no decodifica (no lanza). */
async function loadImage(url: string): Promise<CanvasImageSource | null> {
  try {
    if (typeof Image === "undefined") return null;
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!(img.naturalWidth > 0 && img.naturalHeight > 0)) return null;
    return img;
  } catch {
    return null;
  }
}

export class HdProportFont {
  private readonly byCode: ReadonlyMap<number, { x: number; width: number }>;

  private constructor(
    private readonly atlas: CanvasImageSource,
    private readonly atlasHeight: number,
    glyphs: readonly { code: number; x: number; width: number }[],
  ) {
    this.byCode = new Map(glyphs.map((g) => [g.code, { x: g.x, width: g.width }]));
  }

  /** Construye desde un atlas + manifiesto ya decodificados (seam de `load` y de los tests). */
  static fromManifest(atlas: CanvasImageSource, manifest: ProportHdManifest): HdProportFont {
    return new HdProportFont(atlas, manifest.height, manifest.glyphs);
  }

  /** Buffer offscreen reutilizable para tintar (sólo si se pide color). */
  private tintBuf?: OffscreenCanvas;

  /**
   * Carga el atlas HD proporcional (PNG + manifiesto) desde URLs. Devuelve `null` si el
   * atlas o el manifiesto no están o no decodifican (fallback al xBR genérico, sin romper).
   * No lanza.
   */
  static async load(
    pngUrl = "/assets/font-proport-hd.png",
    jsonUrl = "/assets/font-proport-hd.json",
  ): Promise<HdProportFont | null> {
    try {
      const img = await loadImage(pngUrl);
      if (!img) return null;
      if (typeof fetch === "undefined") return null;
      const res = await fetch(jsonUrl);
      if (!res.ok) return null;
      const manifest = (await res.json()) as ProportHdManifest;
      if (!manifest?.glyphs?.length) return null;
      return HdProportFont.fromManifest(img, manifest);
    } catch {
      return null;
    }
  }

  /**
   * Blitea el glifo `code` desde el atlas HD en el rect de dispositivo (`dx`,`dy`,`dw`×`dh`).
   * `dw` = ancho de tinta lógico × escala; `dh` = 8 × escala (el alto lógico del glifo). Si
   * el código no está en el manifiesto, no pinta nada (deja el xBR/nearest de debajo).
   * `color` (opcional) tinta como la fiel (source-in sobre el alfa). El llamador activa
   * `imageSmoothingEnabled` para el suavizado bilineal.
   */
  drawGlyph(
    ctx: CanvasRenderingContext2D,
    code: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    color?: string,
  ): void {
    const cell = this.byCode.get(code);
    if (!cell || cell.width <= 0) return;
    const { x: sx, width: sw } = cell;
    const sh = this.atlasHeight;
    if (color && typeof OffscreenCanvas !== "undefined") {
      const buf = (this.tintBuf ??= new OffscreenCanvas(1, 1));
      if (buf.width !== sw || buf.height !== sh) {
        buf.width = sw;
        buf.height = sh;
      }
      const b = buf.getContext("2d")!;
      b.clearRect(0, 0, sw, sh);
      b.drawImage(this.atlas, sx, 0, sw, sh, 0, 0, sw, sh);
      b.globalCompositeOperation = "source-in";
      b.fillStyle = color;
      b.fillRect(0, 0, sw, sh);
      b.globalCompositeOperation = "source-over";
      ctx.drawImage(buf, 0, 0, sw, sh, dx, dy, dw, dh);
      return;
    }
    ctx.drawImage(this.atlas, sx, 0, sw, sh, dx, dy, dw, dh);
  }
}
