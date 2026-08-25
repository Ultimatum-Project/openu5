/**
 * Upscaler xBR 4x para tiles RGBA de 32 bits.
 *
 * Implementación: el kernel base es un xBR 2x con la regla de detección de bordes
 * de Hyllian (comparación de "weighted difference" en espacio YUV entre las dos
 * diagonales de cada esquina) aplicada a las 4 esquinas de cada píxel mediante
 * rotación de 90°. El 4x se obtiene encadenando dos pasadas 2x (2x·2x = 4x), una
 * técnica estándar y de uso común para xBR.
 *
 * Es una variante xBR level-1 (una sola regla de borde por esquina, mezcla del
 * píxel de la esquina hacia el vecino dominante) — no el kernel level-2/3 de
 * Hyllian, más agresivo. Elegida por fidelidad reproducible: da suavizado
 * direccional de bordes correcto sin el riesgo de artefactos de un port
 * incompleto del kernel completo. Bordes con clamp.
 */

const RED = 0x000000ff;
const GREEN = 0x0000ff00;
const BLUE = 0x00ff0000;
const ALPHA = 0xff000000;

/** Mezcla ponderada de dos píxeles empaquetados (RGBA en 32 bits, LE). */
function interpolate(p1: number, p2: number, q1: number, q2: number): number {
  const total = q1 + q2;
  const r = ((p1 & RED) * q1 + (p2 & RED) * q2) / total;
  const g = (((p1 & GREEN) >> 8) * q1 + ((p2 & GREEN) >> 8) * q2) / total;
  const b = (((p1 & BLUE) >> 16) * q1 + ((p2 & BLUE) >> 16) * q2) / total;
  const a = (((p1 & ALPHA) >>> 24) * q1 + ((p2 & ALPHA) >>> 24) * q2) / total;
  return (
    ((a & 0xff) << 24) |
    ((b & 0xff) << 16) |
    ((g & 0xff) << 8) |
    (r & 0xff)
  ) >>> 0;
}

/** Distancia perceptual entre dos píxeles empaquetados (pesos YUV de Hyllian). */
function dist(p1: number, p2: number): number {
  const r1 = p1 & 0xff;
  const g1 = (p1 >> 8) & 0xff;
  const b1 = (p1 >> 16) & 0xff;
  const r2 = p2 & 0xff;
  const g2 = (p2 >> 8) & 0xff;
  const b2 = (p2 >> 16) & 0xff;

  const y1 = r1 * 0.299 + g1 * 0.587 + b1 * 0.114;
  const u1 = r1 * -0.169 + g1 * -0.331 + b1 * 0.5;
  const v1 = r1 * 0.5 + g1 * -0.419 + b1 * -0.081;
  const y2 = r2 * 0.299 + g2 * 0.587 + b2 * 0.114;
  const u2 = r2 * -0.169 + g2 * -0.331 + b2 * 0.5;
  const v2 = r2 * 0.5 + g2 * -0.419 + b2 * -0.081;

  return (
    Math.abs(y1 - y2) * 48 + Math.abs(u1 - u2) * 7 + Math.abs(v1 - v2) * 6
  );
}

/**
 * Offsets (dx,dy) de los vecinos que usa la regla de esquina en su orientación
 * canónica (esquina inferior-derecha). Índices: E,F,H,I,C,G,D,B,F4,I4,H5,I5.
 */
const OFFS: [number, number][] = [
  [0, 0], // E
  [1, 0], // F
  [0, 1], // H
  [1, 1], // I
  [1, -1], // C
  [-1, 1], // G
  [-1, 0], // D
  [0, -1], // B
  [2, 0], // F4
  [2, 1], // I4
  [0, 2], // H5
  [1, 2], // I5
];

/** Rota un offset (dx,dy) 90° en sentido horario, k veces (coords imagen, y↓). */
function rot(dx: number, dy: number, k: number): [number, number] {
  let x = dx;
  let y = dy;
  for (let i = 0; i < k; i++) {
    const nx = -y;
    const ny = x;
    x = nx;
    y = ny;
  }
  return [x, y];
}

/** Empaqueta un RGBA lineal en Int32Array. */
function pack(rgba: Uint8Array): Int32Array {
  const out = new Int32Array(rgba.length / 4);
  for (let i = 0; i < out.length; i++) {
    const o = i * 4;
    out[i] =
      ((rgba[o]! & 0xff) |
        ((rgba[o + 1]! & 0xff) << 8) |
        ((rgba[o + 2]! & 0xff) << 16) |
        ((rgba[o + 3]! & 0xff) << 24)) >>>
      0;
  }
  return out;
}

function unpack(packed: Int32Array): Uint8Array {
  const out = new Uint8Array(packed.length * 4);
  for (let i = 0; i < packed.length; i++) {
    const p = packed[i]! >>> 0;
    const o = i * 4;
    out[o] = p & 0xff;
    out[o + 1] = (p >> 8) & 0xff;
    out[o + 2] = (p >> 16) & 0xff;
    out[o + 3] = (p >>> 24) & 0xff;
  }
  return out;
}

/** Una pasada xBR 2x sobre píxeles empaquetados. */
function xbr2xPacked(
  src: Int32Array,
  w: number,
  h: number,
): { data: Int32Array; width: number; height: number } {
  const ow = w * 2;
  const oh = h * 2;
  const dst = new Int32Array(ow * oh);

  const at = (x: number, y: number): number => {
    const cx = x < 0 ? 0 : x >= w ? w - 1 : x; // clamp
    const cy = y < 0 ? 0 : y >= h ? h - 1 : y;
    return src[cy * w + cx]! >>> 0;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const e = at(x, y);
      // 4 subpíxeles del bloque 2x, inicializados a E.
      const sub = [e, e, e, e]; // [ (0,0),(1,0),(0,1),(1,1) ] -> índice sy*2+sx

      for (let k = 0; k < 4; k++) {
        // Muestrea los vecinos con los offsets rotados k·90°.
        const n = OFFS.map(([dx, dy]) => {
          const [rx, ry] = rot(dx, dy, k);
          return at(x + rx, y + ry);
        });
        const E = n[0]!;
        const F = n[1]!;
        const H = n[2]!;
        const I = n[3]!;
        const C = n[4]!;
        const G = n[5]!;
        const D = n[6]!;
        const B = n[7]!;
        const F4 = n[8]!;
        const I4 = n[9]!;
        const H5 = n[10]!;
        const I5 = n[11]!;

        if (E === H || E === F) continue; // sin borde en esta esquina

        const edr =
          dist(E, C) + dist(E, G) + dist(I, H5) + dist(I, F4) + 4 * dist(H, F);
        const noEdr =
          dist(H, D) + dist(H, I5) + dist(F, I4) + dist(F, B) + 4 * dist(E, I);

        if (edr < noEdr) {
          const px = dist(E, F) <= dist(E, H) ? F : H;
          // Esquina de salida (1,1) rotada k·90° dentro del bloque 2x centrado.
          const [csx, csy] = rot(1, 1, k); // ∈ {-1,1}²
          const sx = csx > 0 ? 1 : 0;
          const sy = csy > 0 ? 1 : 0;
          const idx = sy * 2 + sx;
          sub[idx] = interpolate(sub[idx]!, px, 1, 1);
        }
      }

      const ox = x * 2;
      const oy = y * 2;
      dst[oy * ow + ox] = sub[0]!;
      dst[oy * ow + ox + 1] = sub[1]!;
      dst[(oy + 1) * ow + ox] = sub[2]!;
      dst[(oy + 1) * ow + ox + 1] = sub[3]!;
    }
  }

  return { data: dst, width: ow, height: oh };
}

/**
 * Escala un buffer RGBA 4x mediante xBR (dos pasadas 2x encadenadas).
 * `rgba` debe tener w·h·4 bytes. Devuelve un buffer de 4w·4h·4 bytes.
 */
export function xbr4x(
  rgba: Uint8Array,
  w: number,
  h: number,
): { rgba: Uint8Array; width: number; height: number } {
  if (rgba.length !== w * h * 4) {
    throw new Error(
      `xbr4x: buffer de ${rgba.length} bytes no coincide con ${w}×${h}×4`,
    );
  }
  const pass1 = xbr2xPacked(pack(rgba), w, h);
  const pass2 = xbr2xPacked(pass1.data, pass1.width, pass1.height);
  return {
    rgba: unpack(pass2.data),
    width: pass2.width,
    height: pass2.height,
  };
}
