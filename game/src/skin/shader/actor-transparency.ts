/**
 * TRANSPARENCIA DE ACTORES (prototipo shader) — el fondo del tile EGA de un actor
 * (Avatar/NPC/monstruo) es un cuadrado NEGRO opaco que tapa el terreno de su casilla.
 * Aquí construimos, por tileId y cacheado, una versión del sprite 16×16 con ese fondo
 * hecho TRANSPARENTE, de modo que el terreno (ya filtrado por xBR/agua) se vea a través.
 *
 * SÓLO PIEL SHADER: la fiel no usa esto (sigue horneando el actor con su cuadrado). El
 * atlas `tiles-ega.png` no se toca; el recorte transparente vive en un canvas propio.
 *
 * MÁSCARA POR FLOOD-FILL EXTERIOR (no color-key ingenuo): el negro de FONDO se detecta
 * expandiendo desde los píxeles del BORDE del tile por negro conectado. Los negros
 * INTERIORES encerrados (botas, contornos, ojos, y cuerpos íntegramente negros como el
 * mongbat 0x11d o el cofre 0x1fc) NO tocan el borde → quedan OPACOS. Un color-key plano
 * agujerearía esos sprites dejando ver el terreno a través del cuerpo. Comprobado sobre
 * el atlas real: el fondo de TODOS los tiles de actor es negro puro (0,0,0).
 */

const ATLAS_TILE = 16;
const ATLAS_COLS = 32;

/** Modo de transparencia (setting shader, revertible). */
export type TransparencyMode = "off" | "avatar" | "all" | "soft";

const KEY = "u5clone:shader:actor-transparency";

/** Lee el modo desde localStorage. Default `all` (prototipo: se ve al instante). */
export function transparencyMode(): TransparencyMode {
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    if (v === "off" || v === "avatar" || v === "all" || v === "soft") return v;
  } catch {
    /* sin localStorage (tests) */
  }
  return "all";
}

/** ¿Un pixel es fondo negro? (canal RGB ~0; el alpha del atlas es 255 en todo). */
function isBg(d: Uint8ClampedArray, i: number): boolean {
  return d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 0;
}

/**
 * Construye la máscara de FONDO exterior de un tile 16×16 (flood-fill desde el borde
 * por negro conectado). `bg[p]===1` → transparente. `srcData` es el ImageData 16×16
 * del tile (RGBA row-major).
 */
function exteriorBgMask(srcData: Uint8ClampedArray): Uint8Array {
  const N = ATLAS_TILE;
  const bg = new Uint8Array(N * N);
  const stack: number[] = [];
  const push = (p: number): void => {
    if (bg[p]) return;
    if (!isBg(srcData, p * 4)) return;
    bg[p] = 1;
    stack.push(p);
  };
  // Semillas: los cuatro bordes.
  for (let c = 0; c < N; c++) {
    push(c); // fila 0
    push((N - 1) * N + c); // fila N-1
  }
  for (let r = 0; r < N; r++) {
    push(r * N); // col 0
    push(r * N + (N - 1)); // col N-1
  }
  // Expansión 4-conexa.
  while (stack.length) {
    const p = stack.pop()!;
    const r = (p / N) | 0;
    const c = p % N;
    if (r > 0) push(p - N);
    if (r < N - 1) push(p + N);
    if (c > 0) push(p - 1);
    if (c < N + -1) push(p + 1);
  }
  return bg;
}

/**
 * Cache y constructor de recortes transparentes por tileId. Se alimenta una sola vez
 * del atlas (HTMLImageElement) volcándolo a un canvas oculto para leer sus píxeles.
 */
export class ActorTransparency {
  private atlasData: ImageData | null = null;
  private atlasW = 0;
  private readonly cache = new Map<number, HTMLCanvasElement>();
  private readonly softCache = new Map<number, HTMLCanvasElement>();
  /** Recorte con el CUERPO a alpha parcial (veredicto B del censo de transparencia).
   *  Clave = tileId (el factor de alpha es constante por diseño, BODY_ALPHA). */
  private readonly bodyAlphaCache = new Map<number, HTMLCanvasElement>();

  /** ¿Tenemos ya los píxeles del atlas? (se llena en el primer `tile()`). */
  private ensureAtlas(atlas: CanvasImageSource): boolean {
    if (this.atlasData) return true;
    // El atlas es un HTMLImageElement 512×256; lo volcamos una vez para leer píxeles.
    const w =
      (atlas as HTMLImageElement).naturalWidth ||
      (atlas as HTMLCanvasElement).width ||
      0;
    const h =
      (atlas as HTMLImageElement).naturalHeight ||
      (atlas as HTMLCanvasElement).height ||
      0;
    if (!w || !h) return false;
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const cx = cv.getContext("2d", { willReadFrequently: true });
    if (!cx) return false;
    cx.imageSmoothingEnabled = false;
    cx.drawImage(atlas, 0, 0);
    this.atlasData = cx.getImageData(0, 0, w, h);
    this.atlasW = w;
    return true;
  }

  /**
   * Devuelve un canvas 16×16 del tile con el fondo exterior transparente, o `null` si
   * aún no hay atlas. `soft` aplica un feather de 1px (alpha parcial) en el borde de la
   * silueta para suavizar el escalón (variante c). Cacheado por tileId+modo.
   */
  tile(atlas: CanvasImageSource, tileId: number, soft: boolean): HTMLCanvasElement | null {
    const cache = soft ? this.softCache : this.cache;
    const hit = cache.get(tileId);
    if (hit) return hit;
    if (!this.ensureAtlas(atlas)) return null;
    const src = this.atlasData!;
    const N = ATLAS_TILE;
    const tx = (tileId % ATLAS_COLS) * N;
    const ty = ((tileId / ATLAS_COLS) | 0) * N;
    // Extrae el tile a un buffer 16×16 contiguo.
    const tileData = new Uint8ClampedArray(N * N * 4);
    for (let r = 0; r < N; r++) {
      const srcOff = ((ty + r) * this.atlasW + tx) * 4;
      tileData.set(src.data.subarray(srcOff, srcOff + N * 4), r * N * 4);
    }
    const bg = exteriorBgMask(tileData);
    // Aplica alpha: fondo exterior → 0. Silueta → 255.
    for (let p = 0; p < N * N; p++) {
      if (bg[p]) tileData[p * 4 + 3] = 0;
    }
    if (soft) featherEdge(tileData, bg);
    const out = document.createElement("canvas");
    out.width = N;
    out.height = N;
    const octx = out.getContext("2d");
    if (!octx) return null;
    octx.putImageData(new ImageData(tileData, N, N), 0, 0);
    cache.set(tileId, out);
    return out;
  }

  /**
   * Recorte del tile con (a) el fondo exterior NEGRO transparente (flood-fill, como
   * `tile()`) Y (b) el CUERPO restante a alpha parcial `alpha` — el tratamiento «B»
   * aprobado del censo de transparencia (`docs/verdicts/sprites-transparencia`): el
   * terreno de debajo se ve TANTO por el fondo (alpha 0) COMO a través del cuerpo
   * (alpha ·0.55). Precompuesto y cacheado por tileId (blit con globalAlpha=1, sin
   * coste por frame). Devuelve `null` si aún no hay atlas volcado.
   */
  bodyAlpha(atlas: CanvasImageSource, tileId: number, alpha: number): HTMLCanvasElement | null {
    const hit = this.bodyAlphaCache.get(tileId);
    if (hit) return hit;
    const base = this.tile(atlas, tileId, false); // fondo exterior a alpha 0, cuerpo opaco
    if (!base) return null;
    const N = ATLAS_TILE;
    const out = document.createElement("canvas");
    out.width = N;
    out.height = N;
    const octx = out.getContext("2d", { willReadFrequently: true });
    if (!octx) return null;
    octx.drawImage(base, 0, 0);
    const img = octx.getImageData(0, 0, N, N);
    const d = img.data;
    // Multiplica el alpha existente por el factor: el fondo (ya 0) sigue 0; el cuerpo
    // opaco (255) baja a ~140; un feather previo se escala en proporción.
    for (let i = 3; i < d.length; i += 4) d[i] = (d[i]! * alpha) | 0;
    octx.putImageData(img, 0, 0);
    this.bodyAlphaCache.set(tileId, out);
    return out;
  }
}

/**
 * Feather de 1px (variante c): los píxeles de FONDO exterior adyacentes (4-conexo) a la
 * silueta reciben alpha parcial con el color de la silueta vecina, suavizando el escalón
 * duro. Sutil; el sprite sigue nítido. Trabaja sobre `tileData` ya con el fondo a alpha 0.
 */
function featherEdge(tileData: Uint8ClampedArray, bg: Uint8Array): void {
  const N = ATLAS_TILE;
  const src = tileData.slice();
  for (let p = 0; p < N * N; p++) {
    if (!bg[p]) continue; // sólo píxeles de fondo
    const r = (p / N) | 0;
    const c = p % N;
    // ¿Vecino de silueta? Copia su color a alpha 0.5.
    const nb: number[] = [];
    if (r > 0 && !bg[p - N]) nb.push(p - N);
    if (r < N - 1 && !bg[p + N]) nb.push(p + N);
    if (c > 0 && !bg[p - 1]) nb.push(p - 1);
    if (c < N - 1 && !bg[p + 1]) nb.push(p + 1);
    if (nb.length === 0) continue;
    // Media de los vecinos de silueta.
    let rr = 0;
    let gg = 0;
    let bb = 0;
    for (const n of nb) {
      rr += src[n * 4] ?? 0;
      gg += src[n * 4 + 1] ?? 0;
      bb += src[n * 4 + 2] ?? 0;
    }
    const k = nb.length;
    tileData[p * 4] = (rr / k) | 0;
    tileData[p * 4 + 1] = (gg / k) | 0;
    tileData[p * 4 + 2] = (bb / k) | 0;
    tileData[p * 4 + 3] = 110; // ~0.43 alpha
  }
}
