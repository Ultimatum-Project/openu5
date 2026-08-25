/**
 * XOR DE ÍNDICE EGA DE VERDAD — el modelo de render que #317 declaró necesario y que el
 * destello del curandero (#299) estrena.
 *
 * En 1988 el idiom `set_color(c)` + `rect(8,8,0xb7,0xb7)` con `stc` (EGA.DRV fn21, registro
 * 3 del GC en función XOR) hace `índice ^= c` sobre el índice EGA de 4 bits de cada píxel.
 * `invertRect` (frame.ts) lo aproxima con `difference` blanco, y esa aproximación SOLO vale
 * para c=15 (y aun ahí divergen los índices 6 y 9 por el brown-fix `EGA[6]=#AA5500` —
 * medición de #317 en el docblock de `invertViewportInterior`). Los sitios que XORean con
 * OTRO color — el curandero alterna `g_unk_13ae`=4 y `g_unk_13b0`=15 (#305, derivado en
 * estático: único escritor INTRO.OVL 0x09f4/0x09fa, rama EGA) — necesitan la operación real:
 * reindexar el píxel contra la LUT EGA y aplicar `índice ^ máscara`.
 *
 * CÓMO: `getImageData` del rect, cada píxel RGB → índice EGA (coincidencia EXACTA contra
 * `EGA_PALETTE`; si el píxel no es un color EGA — compositing propio del port: niebla con
 * alpha, escalado con suavizado en la piel shader — cae al índice MÁS CERCANO por distancia
 * euclídea, determinista y declarado Clase C: el binario jamás tuvo píxeles no-EGA), XOR de
 * la máscara, y de vuelta el RGB de la paleta. El alpha no se toca.
 *
 * RENDIMIENTO: memoización RGB→RGB por máscara (los frames del juego llevan pocas decenas
 * de colores distintos); el bucle es O(píxeles) con un lookup por píxel. En la fiel el rect
 * son 176×176 px lógicos; en la shader, el viewport a píxeles de dispositivo.
 */
import { EGA_PALETTE } from "./ega.js";
import { VIEWPORT_INTERIOR } from "./frame.js";

/** La paleta como bytes [r,g,b] por índice (parseada una vez de la FUENTE ÚNICA). */
const PALETTE_RGB: [number, number, number][] = EGA_PALETTE.map((hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]);

/**
 * Índice EGA de un RGB: exacto si el color está en la paleta, MÁS CERCANO si no
 * (distancia euclídea al cuadrado; empates los gana el índice menor, determinista).
 */
export function egaIndexOfRgb(r: number, g: number, b: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < 16; i++) {
    const p = PALETTE_RGB[i]!;
    const dr = r - p[0];
    const dg = g - p[1];
    const db = b - p[2];
    const d = dr * dr + dg * dg + db * db;
    if (d === 0) return i;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Caché RGB-empaquetado → RGB-empaquetado, UNA por máscara (16 posibles). Se comparte
 * entre pieles y frames: el coste real por píxel es un `Map.get`.
 */
const XOR_CACHE: (Map<number, number> | undefined)[] = [];

function xorMapFor(mask: number): Map<number, number> {
  const m = mask & 0xf;
  let cache = XOR_CACHE[m];
  if (!cache) {
    cache = new Map();
    XOR_CACHE[m] = cache;
  }
  return cache;
}

/**
 * `índice ^ máscara` sobre cada píxel del rect — el `set_color(c)` + rect-XOR de fn21.
 * Máscara 0 = no-op (la piel llama sólo con máscara viva; se corta aquí por si acaso).
 */
export function paletteXorRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  mask: number,
): void {
  const m = mask & 0xf;
  if (m === 0) return;
  const img = ctx.getImageData(x, y, w, h);
  const data = img.data;
  const cache = xorMapFor(m);
  for (let i = 0; i < data.length; i += 4) {
    const packed = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
    let out = cache.get(packed);
    if (out === undefined) {
      const idx = egaIndexOfRgb(data[i]!, data[i + 1]!, data[i + 2]!);
      const p = PALETTE_RGB[idx ^ m]!;
      out = (p[0] << 16) | (p[1] << 8) | p[2];
      cache.set(packed, out);
    }
    data[i] = (out >> 16) & 0xff;
    data[i + 1] = (out >> 8) & 0xff;
    data[i + 2] = out & 0xff;
  }
  ctx.putImageData(img, x, y);
}

/**
 * El MISMO rect interior del viewport que `invertViewportInterior`/`fillViewportInterior`
 * (frame.ts): el (8,8)-(0xb7,0xb7) del binario. Para la piel fiel, que compone en píxeles
 * EGA lógicos; la shader pasa su rect de DISPOSITIVO a `paletteXorRect` (misma trampa de
 * coordenadas que documenta `invertRect`).
 */
export function paletteXorViewportInterior(ctx: CanvasRenderingContext2D, mask: number): void {
  paletteXorRect(
    ctx,
    VIEWPORT_INTERIOR.x,
    VIEWPORT_INTERIOR.y,
    VIEWPORT_INTERIOR.w,
    VIEWPORT_INTERIOR.h,
    mask,
  );
}
