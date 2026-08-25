/** Utilidades binarias compartidas por los parsers (todo little-endian). */

export function u16le(data: Uint8Array, offset: number): number {
  return (data[offset] ?? 0) | ((data[offset + 1] ?? 0) << 8);
}

export function u32le(data: Uint8Array, offset: number): number {
  return (
    ((data[offset] ?? 0) |
      ((data[offset + 1] ?? 0) << 8) |
      ((data[offset + 2] ?? 0) << 16) |
      ((data[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

/** Lee una región como lista de strings terminadas en \0 (ASCII). */
export function stringList(
  data: Uint8Array,
  offset: number,
  length: number,
): string[] {
  const out: string[] = [];
  let current = "";
  for (let i = offset; i < offset + length && i < data.length; i++) {
    const b = data[i]!;
    if (b === 0) {
      out.push(current);
      current = "";
    } else {
      current += String.fromCharCode(b);
    }
  }
  if (current.length > 0) out.push(current);
  return out;
}

/** Lee un string ASCII terminado en \0 con longitud máxima fija. */
export function fixedString(
  data: Uint8Array,
  offset: number,
  maxLength: number,
): string {
  let out = "";
  for (let i = 0; i < maxLength; i++) {
    const b = data[offset + i]!;
    if (b === 0) break;
    out += String.fromCharCode(b);
  }
  return out;
}

/** Bitmap MSB-first: bit i del byte b = (b >> (7 - i)) & 1. */
export function bitmapToBooleans(
  data: Uint8Array,
  offset: number,
  byteLength: number,
): boolean[] {
  const out: boolean[] = [];
  for (let i = 0; i < byteLength; i++) {
    const b = data[offset + i]!;
    for (let bit = 7; bit >= 0; bit--) out.push(((b >> bit) & 1) === 1);
  }
  return out;
}

// ── Escritores (inversos de los lectores de arriba, para el serializer de save) ──

/** Escribe un uint16 little-endian. Inverso exacto de u16le. */
export function writeU16le(data: Uint8Array, offset: number, value: number): void {
  data[offset] = value & 0xff;
  data[offset + 1] = (value >> 8) & 0xff;
}

/**
 * Escribe un string ASCII en un campo de longitud fija `maxLength`. Inverso de
 * fixedString: escribe los caracteres, un terminador `\0` si cabe, y DEJA INTACTOS
 * los bytes posteriores del buffer (preserva la plantilla) → round-trip byte-exacto
 * cuando el nombre no cambia. Los caracteres sobrantes del string se truncan a
 * `maxLength`.
 */
export function writeFixedString(
  data: Uint8Array,
  offset: number,
  value: string,
  maxLength: number,
): void {
  const n = Math.min(value.length, maxLength);
  for (let i = 0; i < n; i++) data[offset + i] = value.charCodeAt(i) & 0xff;
  if (n < maxLength) data[offset + n] = 0; // terminador; el resto queda como estaba
}

/**
 * Empaqueta un bloque de `byteLength` bytes desde `bools` (MSB-first). Inverso exacto
 * de bitmapToBooleans: `bools[i*8+k]` ocupa el bit `7-k` del byte `i`.
 */
export function booleansToBitmap(
  data: Uint8Array,
  offset: number,
  bools: boolean[],
  byteLength: number,
): void {
  for (let i = 0; i < byteLength; i++) {
    let b = 0;
    for (let k = 0; k < 8; k++) {
      if (bools[i * 8 + k]) b |= 1 << (7 - k);
    }
    data[offset + i] = b;
  }
}

/**
 * Escribe un flag booleano preservando el byte de la plantilla si ya es
 * semánticamente correcto (`(data[offset] !== 0) === value`). Así un byte "truthy"
 * no-canónico del original (p.ej. 0x05) se conserva en el round-trip byte-exacto.
 * `trueByte`/`falseByte` sólo se usan cuando el byte hay que CAMBIARLO.
 */
export function writeBoolPreserve(
  data: Uint8Array,
  offset: number,
  value: boolean,
  trueByte = 1,
  falseByte = 0,
): void {
  if ((data[offset]! !== 0) !== value) data[offset] = value ? trueByte : falseByte;
}
