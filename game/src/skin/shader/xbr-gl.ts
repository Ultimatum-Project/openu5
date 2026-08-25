/**
 * XbrGlUpscaler — filtro xBR de la piel «shader» (task #70) en la GPU (WebGL1).
 *
 * ─── PROCEDENCIA / LICENCIA ────────────────────────────────────────────────────
 * El kernel es un PORT GLSL de `extractor/src/upscale/xbr.ts` (rama skin-hd), que a
 * su vez es xBR level-1 con la regla de detección de bordes de Hyllian (weighted
 * difference en YUV, pesos 48/7/6, mezcla del píxel de esquina hacia el vecino
 * dominante). Es código PROPIO del proyecto (misma licencia que el repo); NO se ha
 * copiado el .glsl GPL de RetroArch. Elegido sobre el xBRZ nativo de la spec por:
 *   · reutiliza la matemática ya validada en el banco (out/xbr) sin cuestión de licencia,
 *   · el kernel 2× es pequeño y verificable; el 6× se obtiene 2×·2× (=4×) + bilineal 4→6,
 *   · un solo programa, corre en tiempo real a 60fps (pulso de 55 ms sin drops).
 * La spec recomendaba el GLSL xBRZ de RetroArch (GPL); esta desviación queda REPORTADA
 * a la sesión orquestadora (el veredicto de licencia lo da el carril de publicación).
 * ───────────────────────────────────────────────────────────────────────────────
 *
 * Pipeline: sube el frame `w×h` a 2× (pase 1, a un FBO) y a 4× (pase 2, al backbuffer
 * del canvas GL). `ShaderSkin` blitea ese 4× a la región del viewport 6× con bilineal
 * (el estiramiento 4→6 lo hace el drawImage suavizado). El texto/chrome NUNCA pasa por
 * aquí — se compone aparte a escala entera.
 */
import { NearestUpscaler, type Upscaler, type UpscaleResult } from "./upscaler.js";

/** Nº de pases xBR encadenados (2 → 2×·2× = 4× interno). */
const PASSES = 2;

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// Port directo de xbr2xPacked/dist/interpolate de xbr.ts. Cada texel de salida es UN
// subpíxel del bloque 2× de su píxel fuente; su cuadrante (sx,sy) elige la rotación k
// (misma tabla que rot(1,1,k) de xbr.ts) y la regla de esquina canónica (BR) se aplica
// con los offsets rotados. Mezcla 0.5 = interpolate(...,1,1).
const FRAG = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_texSize;   // tamaño del origen en texels

float wdiff(vec3 a, vec3 b) {
  vec3 d = a - b;
  float y = d.r * 0.299 + d.g * 0.587 + d.b * 0.114;
  float u = d.r * -0.169 + d.g * -0.331 + d.b * 0.5;
  float v = d.r * 0.5 + d.g * -0.419 + d.b * -0.081;
  return abs(y) * 48.0 + abs(u) * 7.0 + abs(v) * 6.0;
}
bool same(vec3 a, vec3 b) { return wdiff(a, b) < 0.0001; }

vec2 rot(vec2 o, int k) {         // rota (dx,dy) 90° CW k veces (k<=3), coords imagen y↓
  vec2 r = o;
  for (int i = 0; i < 3; i++) { if (i < k) { r = vec2(-r.y, r.x); } }
  return r;
}
vec3 samp(vec2 base, vec2 off) {  // muestrea el texel (base+off) con NEAREST + clamp
  return texture2D(u_tex, (base + off + 0.5) / u_texSize).rgb;
}

void main() {
  vec2 outCoord = v_uv * (u_texSize * 2.0);
  vec2 sp = floor(outCoord * 0.5);              // píxel fuente
  vec2 sub = floor(outCoord - sp * 2.0);        // subpíxel 0/1 en x,y
  int sx = int(sub.x);
  int sy = int(sub.y);
  int k;                                         // rot(1,1,k): (1,1)=0 (0,1)=1 (0,0)=2 (1,0)=3
  if (sx == 1 && sy == 1) k = 0;
  else if (sx == 0 && sy == 1) k = 1;
  else if (sx == 0 && sy == 0) k = 2;
  else k = 3;

  vec3 E  = samp(sp, rot(vec2( 0.0,  0.0), k));
  vec3 F  = samp(sp, rot(vec2( 1.0,  0.0), k));
  vec3 H  = samp(sp, rot(vec2( 0.0,  1.0), k));
  vec3 I  = samp(sp, rot(vec2( 1.0,  1.0), k));
  vec3 C  = samp(sp, rot(vec2( 1.0, -1.0), k));
  vec3 G  = samp(sp, rot(vec2(-1.0,  1.0), k));
  vec3 D  = samp(sp, rot(vec2(-1.0,  0.0), k));
  vec3 B  = samp(sp, rot(vec2( 0.0, -1.0), k));
  vec3 F4 = samp(sp, rot(vec2( 2.0,  0.0), k));
  vec3 I4 = samp(sp, rot(vec2( 2.0,  1.0), k));
  vec3 H5 = samp(sp, rot(vec2( 0.0,  2.0), k));
  vec3 I5 = samp(sp, rot(vec2( 1.0,  2.0), k));

  vec3 outc = E;
  if (!(same(E, H) || same(E, F))) {
    float edr = wdiff(E, C) + wdiff(E, G) + wdiff(I, H5) + wdiff(I, F4) + 4.0 * wdiff(H, F);
    float noEdr = wdiff(H, D) + wdiff(H, I5) + wdiff(F, I4) + wdiff(F, B) + 4.0 * wdiff(E, I);
    if (edr < noEdr) {
      vec3 px = (wdiff(E, F) <= wdiff(E, H)) ? F : H;
      outc = mix(E, px, 0.5);
    }
  }
  gl_FragColor = vec4(outc, 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("xbr-gl: createShader falló");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`xbr-gl: shader no compila: ${log ?? "?"}`);
  }
  return sh;
}

/** Textura 2D vacía `w×h` con filtrado NEAREST + clamp (para muestreo exacto de texels). */
function makeTex(gl: WebGLRenderingContext, w: number, h: number): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error("xbr-gl: createTexture falló");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

class XbrGlUpscaler implements Upscaler {
  readonly id = "webgl-xbr" as const;
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGLRenderingContext;
  private readonly program: WebGLProgram;
  private readonly quad: WebGLBuffer;
  private readonly uTexSize: WebGLUniformLocation;
  /** Textura del frame fuente subido cada frame (w×h). */
  private srcTex: WebGLTexture | null = null;
  private srcW = 0;
  private srcH = 0;
  /** FBO intermedio del pase 1 (2×): textura + framebuffer. */
  private midTex: WebGLTexture | null = null;
  private midFbo: WebGLFramebuffer | null = null;
  private midW = 0;
  private midH = 0;

  private constructor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    if (!program) throw new Error("xbr-gl: createProgram falló");
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`xbr-gl: link falló: ${gl.getProgramInfoLog(program) ?? "?"}`);
    }
    this.program = program;
    const quad = gl.createBuffer();
    if (!quad) throw new Error("xbr-gl: createBuffer falló");
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    // Dos triángulos que cubren el clip-space [-1,1]².
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    this.quad = quad;
    const loc = gl.getUniformLocation(program, "u_texSize");
    if (!loc) throw new Error("xbr-gl: uniform u_texSize ausente");
    this.uTexSize = loc;
    gl.useProgram(program);
    const aPos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(gl.getUniformLocation(program, "u_tex"), 0);
    // FLIP Y de las subidas de canvas: WebGL guarda las texturas bottom-up, pero un
    // canvas 2D es top-down. Sin esto el round-trip (subir el recorte → filtrar →
    // drawImage de vuelta) sale con el MUNDO BOCA ABAJO (el texto no, va por 2D puro).
    // Sólo afecta la ÚNICA subida de píxeles (el recorte del viewport en el pase 1);
    // los pases FBO→FBO no cruzan frontera de canvas y conservan la orientación, así
    // que un solo flip en la fuente corrige toda la cadena. Reporte del usuario 2026-07-17.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  }

  /** Crea el upscaler, o `null` si el navegador no da contexto WebGL. */
  static tryCreate(): XbrGlUpscaler | null {
    const canvas = document.createElement("canvas");
    // preserveDrawingBuffer: el resultado se lee con drawImage en el mismo frame.
    const opts: WebGLContextAttributes = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
    };
    const gl =
      (canvas.getContext("webgl", opts) as WebGLRenderingContext | null) ??
      (canvas.getContext("experimental-webgl", opts) as WebGLRenderingContext | null);
    if (!gl) return null;
    try {
      return new XbrGlUpscaler(canvas, gl);
    } catch (err) {
      console.warn("[shader] xBR WebGL init falló, degradando:", err);
      return null;
    }
  }

  private ensureSrc(w: number, h: number): void {
    if (this.srcTex && this.srcW === w && this.srcH === h) return;
    if (this.srcTex) this.gl.deleteTexture(this.srcTex);
    this.srcTex = makeTex(this.gl, w, h);
    this.srcW = w;
    this.srcH = h;
  }

  private ensureMid(w: number, h: number): void {
    const gl = this.gl;
    if (this.midTex && this.midW === w && this.midH === h) return;
    if (this.midTex) gl.deleteTexture(this.midTex);
    if (this.midFbo) gl.deleteFramebuffer(this.midFbo);
    this.midTex = makeTex(gl, w, h);
    this.midFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.midFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.midTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.midW = w;
    this.midH = h;
  }

  upscale(src: CanvasImageSource, w: number, h: number): UpscaleResult {
    const gl = this.gl;
    const outW = w << PASSES; // 4×
    const outH = h << PASSES;
    if (this.canvas.width !== outW || this.canvas.height !== outH) {
      this.canvas.width = outW;
      this.canvas.height = outH;
    }
    this.ensureSrc(w, h);
    this.ensureMid(w * 2, h * 2);

    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.activeTexture(gl.TEXTURE0);

    // Pase 1: origen (w×h) → FBO (2w×2h).
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    // `src` es siempre un canvas (el recorte del viewport); TexImageSource excluye
    // SVGImageElement que sí admite CanvasImageSource, de ahí el narrow.
    // texSubImage2D, NO texImage2D (PERF-2): el storage w×h ya está especificado por
    // `makeTex` en `ensureSrc` (y re-especificado allí si cambia el tamaño); re-declararlo
    // en cada frame forzaba al driver a reasignar la textura. Mismos píxeles subidos
    // (UNPACK_FLIP_Y_WEBGL aplica igual a ambas vías) → salida idéntica.
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src as TexImageSource);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.midFbo);
    gl.viewport(0, 0, this.midW, this.midH);
    gl.uniform2f(this.uTexSize, w, h);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Pase 2: FBO (2w×2h) → backbuffer (4w×4h).
    gl.bindTexture(gl.TEXTURE_2D, this.midTex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, outW, outH);
    gl.uniform2f(this.uTexSize, this.midW, this.midH);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    return { source: this.canvas, sw: outW, sh: outH, smooth: true };
  }

  dispose(): void {
    const gl = this.gl;
    if (this.srcTex) gl.deleteTexture(this.srcTex);
    if (this.midTex) gl.deleteTexture(this.midTex);
    if (this.midFbo) gl.deleteFramebuffer(this.midFbo);
    gl.deleteBuffer(this.quad);
    gl.deleteProgram(this.program);
    this.srcTex = null;
    this.midTex = null;
    this.midFbo = null;
    const lose = gl.getExtension("WEBGL_lose_context");
    lose?.loseContext();
  }
}

/**
 * Factory: intenta xBR-WebGL; si no hay contexto, degrada a nearest 6× con aviso en
 * consola (spec §«Fallback sin WebGL»). El `factor` sólo lo usa el nearest (el xBR
 * fija su 4× interno + bilineal 4→6 en el blit).
 */
export function createUpscaler(nearestFactor: number): Upscaler {
  const gl = XbrGlUpscaler.tryCreate();
  if (gl) return gl;
  console.warn("[shader] WebGL no disponible: la piel shader degrada a nearest (sin filtro).");
  return new NearestUpscaler(nearestFactor);
}
