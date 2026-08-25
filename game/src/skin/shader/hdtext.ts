/**
 * Fuente REMASTER HD para la piel «shader» (task #73 EJE 2, cableado). Envuelve
 * el atlas `font-ibm-hd.png` (512×256, rejilla 16×8 a 32 px/celda = 4× del atlas
 * 8×8, blanco/alfa) que produce `docs/skin-remaster/shader-evolucion/font_core.py`.
 * Es el consumidor del pase de texto que la piel shader compone sobre el blit
 * nearest del frame fiel (paso 1b): recibe las MISMAS celdas que enumeró la fiel
 * (código + posición + tinte, vía el sumidero de `FaithfulFont`) y las blitea a
 * resolución de dispositivo desde el atlas HD.
 *
 * AUSENCIA CON GRACIA: el atlas es un asset gitignored (obra derivada, como
 * `tiles-hd.png`). Si no está (extractor/pipeline sin correr), `load` devuelve
 * `null` y la piel shader cae al texto nearest actual, sin hueco visual (patrón
 * placeholder-sin-pack). Las celdas NO pobladas del atlas (semigráficos 0x01–0x1f,
 * remates 0x7b–0x7f, runas) son transparentes: bliterlas es un no-op y deja ver el
 * nearest de debajo — el fallback por-glifo sale gratis.
 */
import { isExtGlyph, extGlyphCell } from "../fiel/font.js";

const SRC_CELL = 32; // px por celda en el atlas HD (4× de 8)
const ATLAS_COLS = 16;

/** Decodifica un atlas HD por URL, o `null` si falta/no decodifica (no lanza). */
async function loadAtlas(url: string): Promise<CanvasImageSource | null> {
  try {
    if (typeof Image === "undefined") return null;
    const img = new Image();
    img.src = url;
    await img.decode();
    // Un 404 puede decodificar a 0×0 en algunos navegadores: trátalo como ausente.
    if (!(img.naturalWidth > 0 && img.naturalHeight > 0)) return null;
    return img;
  } catch {
    return null;
  }
}

export class HdFont {
  /**
   * `atlas` = font-ibm-hd.png (núcleo HD). `extAtlas` (opcional) = font-ibm-hd-ext.png
   * (acentos Latino-1 HD): sin él, un cp≥0xA0 cae al atlas base (nearest de debajo).
   */
  private constructor(
    private readonly atlas: CanvasImageSource,
    private readonly extAtlas: CanvasImageSource | null,
  ) {}

  /** Buffer offscreen reutilizable para tintar (sólo si se pide color). */
  private tintBuf?: OffscreenCanvas;

  /**
   * Carga el atlas HD (y el de extensión, no fatal) desde URLs. Devuelve `null` si el
   * atlas base no está o no decodifica (fallback a nearest, sin romper). No lanza.
   */
  static async load(
    url = "/assets/font-ibm-hd.png",
    extUrl = "/assets/font-ibm-hd-ext.png",
  ): Promise<HdFont | null> {
    const base = await loadAtlas(url);
    if (!base) return null;
    const ext = await loadAtlas(extUrl); // acentos HD; null → caen al nearest
    return new HdFont(base, ext);
  }

  /**
   * Blitea el glifo `code` desde el atlas HD en el rect de dispositivo
   * (`dx`,`dy`,`size`×`size`). `color` (opcional) tinta como la fiel (source-in
   * sobre el alfa del glifo). Si la celda del atlas está vacía, no pinta nada
   * (deja el nearest de debajo). Suavizado bilineal (mismo trato que el mundo
   * xBR 4×→6×): la piel activa `imageSmoothingEnabled` antes de llamar.
   */
  drawGlyph(
    ctx: CanvasRenderingContext2D,
    code: number,
    dx: number,
    dy: number,
    size: number,
    color?: string,
  ): void {
    // Enrutado Latino-1 (i18n F1c): un cp≥0xA0 poblado sale del atlas de EXTENSIÓN HD;
    // sin él, o cp no poblado → atlas base (nearest de debajo). Mismo criterio POR
    // CODEPOINT que la fiel — el inglés (ASCII) nunca entra aquí.
    const useExt = this.extAtlas !== null && isExtGlyph(code);
    const src = useExt ? this.extAtlas! : this.atlas;
    const { sx, sy } = useExt
      ? extGlyphCell(code, SRC_CELL)
      : (() => {
          const c = code & 0x7f;
          return { sx: (c % ATLAS_COLS) * SRC_CELL, sy: Math.floor(c / ATLAS_COLS) * SRC_CELL };
        })();
    if (color && typeof OffscreenCanvas !== "undefined") {
      const buf = (this.tintBuf ??= new OffscreenCanvas(SRC_CELL, SRC_CELL));
      const b = buf.getContext("2d")!;
      b.clearRect(0, 0, SRC_CELL, SRC_CELL);
      b.drawImage(src, sx, sy, SRC_CELL, SRC_CELL, 0, 0, SRC_CELL, SRC_CELL);
      b.globalCompositeOperation = "source-in";
      b.fillStyle = color;
      b.fillRect(0, 0, SRC_CELL, SRC_CELL);
      b.globalCompositeOperation = "source-over";
      ctx.drawImage(buf, 0, 0, SRC_CELL, SRC_CELL, dx, dy, size, size);
      return;
    }
    ctx.drawImage(src, sx, sy, SRC_CELL, SRC_CELL, dx, dy, size, size);
  }
}
