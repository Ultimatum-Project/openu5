/**
 * HUELLA — identificador opaco y estable de una cadena INGLESA del juego (#380).
 *
 * ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────────
 * La capa de idioma es una tabla `inglés → traducción` (ver `index.ts`). Eso hacía
 * que las CLAVES de `es.json` fuesen el texto del juego de EA EN CLARO: 3.998
 * claves / 26.532 palabras, diálogo TLK incluido, en un fichero TRACKED que viaja
 * al repo público Y va empotrado en el bundle que sirve openu5.org. Misma clase de
 * riesgo que #228/#376 (material EA en el árbol) con otro vehículo — es el
 * pendiente #380.
 *
 * La huella rompe ese vehículo SIN tocar el modelo: la clave pasa a ser
 * `sha256(inglés)` truncado, y el inglés se recupera EN RUNTIME de donde siempre
 * estuvo — los ficheros del juego DEL PROPIO USUARIO (`game/assets/`, extraídos de
 * su copia, gitignored y fuera del índice). El port hashea la cadena que ya tiene
 * en la mano y busca la traducción. Cero texto de EA almacenado en nuestro código.
 *
 * ── QUÉ SE HASHEA: LA CADENA CRUDA, SIN NORMALIZAR ─────────────────────────────
 * 🔴 Derivado, no supuesto (medido el 25-08 leyendo los TRES únicos lookups del
 * repo): `t()` (index.ts:182), `tf()` (que delega en `t()`) y `ts()` (shell.ts:395)
 * indexan por IGUALDAD EXACTA sobre la cadena cruda — `TABLES[lang]?.strings[str]`.
 * NO hay case-folding, ni trim, ni matching por prefijo/parcial en el camino de
 * búsqueda. Las dos normalizaciones que sí existen en la capa caen FUERA de él:
 *   · `rewrap()` se aplica al VALOR (la traducción) DESPUÉS de encontrarlo;
 *   · `${…}` → `{}` lo aplica el EXTRACTOR (`extract-user-strings.mjs`) al PRODUCIR
 *     la clave, así que la clave almacenada ya viene en su forma final.
 * ⇒ hashear la cadena tal cual preserva la semántica del lookup BIT A BIT: dos
 * cadenas casan bajo huella si y sólo si casaban antes. No hay traducción que
 * pueda romperse por normalización porque no había normalización que respetar.
 *
 * ── N = 12 CARACTERES base64url (72 bits), MEDIDO ──────────────────────────────
 * Colisiones contadas sobre el DOMINIO DE ENTRADA real (5.944 cadenas únicas =
 * todo string con letra de `game/assets/**.json` + el corpus de la guarda
 * anti-fabricación + las claves de `es.json`): CERO desde N=5; sólo N=4 colisiona
 * (1 par). Se toma N=12, siete caracteres —42 bits— por encima del primer N
 * limpio: el número esperado de colisiones se mantiene por debajo de 1e-14 aunque
 * el corpus decuplique. El coste es 12 B por clave (48 KB) frente a los 143 KB que
 * ocupaban las claves inglesas.
 *
 * La colisión importa sobre el DOMINIO ENTERO, no sólo sobre las claves
 * traducidas: si una cadena SIN traducir colisionase con una traducida, `t()`
 * devolvería la traducción ajena — un fallo silencioso de contenido. Por eso el
 * censo de colisiones barre los assets completos y no la tabla.
 *
 * ── DOS IMPLEMENTACIONES, UNA GUARDA ───────────────────────────────────────────
 * El navegador necesita el hash SÍNCRONO (`t()` lo es, y `crypto.subtle` es
 * asíncrono), así que aquí va un SHA-256 portable. Las herramientas de node usan
 * `node:crypto` (biblioteca auditada) con el mismo truncado. Que las dos coincidan
 * NO se supone: `tests/i18n-huella.test.ts` las carea sobre el dominio completo.
 */

/** Longitud de la huella en caracteres base64url. Ver cabecera (N=12, 72 bits). */
export const HUELLA_LEN = 12;

/** Alfabeto base64url. Sin relleno `=`: la huella se trunca, nunca se decodifica. */
const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Constantes de ronda de SHA-256 (FIPS 180-4 §4.2.2): raíces cúbicas de los 64 primeros primos. */
// prettier-ignore
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Estado inicial (FIPS 180-4 §5.3.3): raíces cuadradas de los 8 primeros primos. */
// prettier-ignore
const H0 = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

/** SHA-256 de un bloque de bytes. Devuelve los 32 bytes del digest. */
function sha256(bytes: Uint8Array): Uint8Array {
  const len = bytes.length;
  // Relleno FIPS 180-4 §5.1.1: 0x80, ceros, y la longitud EN BITS como u64 big-endian.
  const padded = new Uint8Array(((len + 9 + 63) & ~63) >>> 0);
  padded.set(bytes);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  // len·8 no cabe en 32 bits para len ≥ 2^29; la mitad alta es floor(len / 2^29).
  view.setUint32(padded.length - 8, Math.floor(len / 0x20000000), false);
  view.setUint32(padded.length - 4, (len << 3) >>> 0, false);

  const h = H0.slice();
  const w = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15]!;
      const b = w[i - 2]!;
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i]! + w[i]!) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e;
      e = (d + t1) >>> 0;
      d = c; c = b; b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0]! + a) >>> 0; h[1] = (h[1]! + b) >>> 0; h[2] = (h[2]! + c) >>> 0; h[3] = (h[3]! + d) >>> 0;
    h[4] = (h[4]! + e) >>> 0; h[5] = (h[5]! + f) >>> 0; h[6] = (h[6]! + g) >>> 0; h[7] = (h[7]! + hh) >>> 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, h[i]!, false);
  return out;
}

/** Los primeros `n` caracteres base64url de `bytes` (sin relleno). */
function b64urlHead(bytes: Uint8Array, n: number): string {
  let out = "";
  for (let i = 0; out.length < n; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const trio = (b0 << 16) | (b1 << 8) | b2;
    out += B64URL[(trio >>> 18) & 63]! + B64URL[(trio >>> 12) & 63]! + B64URL[(trio >>> 6) & 63]! + B64URL[trio & 63]!;
  }
  return out.slice(0, n);
}

/**
 * Memo. `t()` se llama por CADA string que pasa por la consola; sin caché el hash
 * se recalcularía en bucles de pintado. La caché guarda inglés → huella; las
 * cadenas inglesas ya están en memoria (vienen de los assets del usuario), así que
 * no añade exposición: no se PERSISTE nada.
 */
const memo = new Map<string, string>();

/** Tope de la caché. El dominio real son ~6.000 cadenas; el corte es una red de seguridad. */
const MEMO_MAX = 20000;

/**
 * HUELLA de una cadena inglesa: `sha256(utf8(str))` truncado a `HUELLA_LEN`
 * caracteres base64url. Determinista, sin estado observable, idéntica en node y en
 * el navegador (careado por `tests/i18n-huella.test.ts`).
 */
export function huella(str: string): string {
  const hit = memo.get(str);
  if (hit !== undefined) return hit;
  const h = b64urlHead(sha256(new TextEncoder().encode(str)), HUELLA_LEN);
  if (memo.size >= MEMO_MAX) memo.clear();
  memo.set(str, h);
  return h;
}

/**
 * ¿`k` tiene FORMA de huella? Predicado de la guarda default-DENY que impide que
 * vuelva a colarse una clave en texto claro en `<lang>.json`.
 */
export function esHuella(k: string): boolean {
  return k.length === HUELLA_LEN && /^[A-Za-z0-9_-]+$/.test(k);
}
