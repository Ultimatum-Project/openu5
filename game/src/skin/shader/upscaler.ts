/**
 * Contrato del UPSCALER de la piel «shader» (task #70) + fallback nearest.
 *
 * La piel shader (spec-modo-shader.md) filtra SÓLO el mundo (viewport 176×176) con
 * un upscaler de bordes; el texto/chrome se compone encima a escala entera. Este
 * módulo define el contrato que consume `ShaderSkin` y el degradado sin WebGL.
 *
 * El upscaler recibe un frame RGBA `w×h` y devuelve un DRAWABLE (canvas) más su
 * tamaño nativo y si debe blitearse con suavizado bilineal. `ShaderSkin` lo pinta
 * en la región del viewport a 6× — el upscaler decide su factor interno (el xBR
 * encadena 2×·2× = 4× y deja el 4→6 al blit bilineal; el nearest ya sale a 6×).
 */

/** Resultado de un pase de upscale: qué dibujar, su tamaño nativo y el modo de blit. */
export interface UpscaleResult {
  /** Superficie a blitear (canvas WebGL 4× para xBR, canvas 2D 6× para nearest). */
  source: CanvasImageSource;
  /** Ancho nativo de `source`. */
  sw: number;
  /** Alto nativo de `source`. */
  sh: number;
  /**
   * ¿Blitear con `imageSmoothingEnabled=true`? El xBR sale a 4× y se estira a 6× con
   * bilineal (suave); el nearest ya sale a 6× y debe blitearse SIN suavizar (bloques).
   */
  smooth: boolean;
}

/** Un upscaler de la región del mundo. Sin estado de juego: sólo píxeles. */
export interface Upscaler {
  /** Identificador del método activo (para diagnóstico / F-report). */
  readonly id: "webgl-xbr" | "nearest";
  /**
   * Sube de resolución un frame `w×h` (RGBA) tomado del viewport. Devuelve el
   * drawable + su tamaño. Reutiliza sus buffers entre llamadas (una por frame).
   */
  upscale(src: CanvasImageSource, w: number, h: number): UpscaleResult;
  /** Libera recursos GPU/DOM. Idempotente. */
  dispose(): void;
}

/**
 * Degradado NEAREST (spec §«Fallback sin WebGL»): sin filtro, el mundo se sube a
 * 6× con vecino-más-cercano — visualmente idéntico a la piel fiel (bloques), pero
 * la piel shader sigue montada y conmutable. Se usa cuando el contexto WebGL falla.
 */
export class NearestUpscaler implements Upscaler {
  readonly id = "nearest" as const;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor(private readonly factor: number) {}

  upscale(src: CanvasImageSource, w: number, h: number): UpscaleResult {
    const ow = w * this.factor;
    const oh = h * this.factor;
    let c = this.canvas;
    if (!c) {
      c = document.createElement("canvas");
      this.canvas = c;
      this.ctx = c.getContext("2d");
    }
    if (c.width !== ow || c.height !== oh) {
      c.width = ow;
      c.height = oh;
    }
    const ctx = this.ctx!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, ow, oh);
    ctx.drawImage(src, 0, 0, w, h, 0, 0, ow, oh);
    return { source: c, sw: ow, sh: oh, smooth: false };
  }

  dispose(): void {
    this.canvas = null;
    this.ctx = null;
  }
}
