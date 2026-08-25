/**
 * Parser de SIGNS.DAT de Ultima V (textos de carteles, lápidas y cruces).
 *
 * Formato derivado de reference/Ultima5Redux/Ultima5Redux/Maps/Signs.cs y Sign.cs:
 *
 *   0x00 .. TOTAL_SIGNS*2-1 : tabla de offsets uint16 (0x21=33 signs → 66 bytes).
 *                             Redux la ignora y recorre los registros en secuencia.
 *   registros (desde offset 66), cada uno:
 *     +0 byte location   (SingleMapReference.Location: 0=Britannia/Underworld,
 *                         1=Moonglow, 2=Britain … 32=Serpent's Hold)
 *     +1 byte floor      (0xFF = Underworld)
 *     +2 byte x
 *     +3 byte y
 *     +4 .. \0           texto crudo del cartel (null-terminated, ≤0xFF bytes)
 *   Fin de fichero = cuatro bytes 0 seguidos (location=floor=x=y=0).
 *
 * Detalle de fidelidad (Signs.cs:40-47): en las ciudades-virtud hay a menudo dos
 * "warning signs" adyacentes; solo uno lleva el texto. Cuando un registro tiene
 * texto vacío (solo espacios/"\n") se toma prestado el texto del SIGUIENTE
 * registro, pero el puntero avanza solo por el registro vacío (así el siguiente
 * registro se vuelve a leer con sus propias coordenadas y su texto). Resultado:
 * dos carteles contiguos con el mismo texto.
 *
 * Además Redux añade a mano un cartel extra que no está en SIGNS.DAT: el "Sign of
 * Eight Laws" de Serpent's Hold, cuyos bytes viven en DATA.OVL:0x743A (0x66).
 *
 * El texto se limpia con `scrubSignText` (port de Sign.ScrubSignText): descarta
 * los caracteres de dibujo del marco, expande dígrafos comprimidos y convierte
 * los bytes con bit alto a su ASCII (byte − 0x80).
 */

export interface SignEntry {
  /** location id (SingleMapReference.Location); 0 = Britannia/Underworld. */
  location: number;
  /** planta; 0xFF = Underworld. */
  floor: number;
  x: number;
  y: number;
  /** texto legible ya limpiado. */
  text: string;
  /**
   * Bytes CRUDOS del cartel tal cual viven en SIGNS.DAT (sin la cabecera de 4 bytes,
   * hasta el \0): el cartel YA ENMARCADO con sus glifos de borde (esquinas 8/9/:/;,
   * aristas l/m/n, verticales g), el cuerpo en RUNAS con `@`=0x40 (rombo inter-palabra)
   * y los dígrafos [^_]\ (= códigos RUNES.CH 0x5b/0x5e/0x5f/0x5d/0x5c), más los saltos de
   * línea 0x0d y 0x8a (0x0a|0x80). La piel fiel los pinta VERBATIM con RUNES.CH (calco
   * byte-exacto, incluidos los sub-marcos hechos a mano de BEWARE!/SERPENTS/PASS) — la
   * única forma de reproducir el ancho horneado por cartel y el aire manual. Ver
   * skin/fiel/sign-box.ts `bakedSignRows` (port de decode_sign_text LOOKOBJ 0x06F8).
   */
  raw: number[];
}

const TOTAL_SIGNS = 0x21;
/** Location de Serpent's Hold para el cartel extra de DATA.OVL. */
const SERPENTS_HOLD = 32;

/** Dígrafos comprimidos usados en los textos de carteles (Sign.cs:120-128). */
const DIGRAPHS: Record<string, string> = {
  "@": " ",
  "[": "TH",
  "^": "EA",
  _: "ST",
  "]": "NG",
  "\\": "EE",
};

/**
 * Limpia el texto crudo de un cartel a texto legible (port de ScrubSignText):
 * - A-Z y espacio se mantienen.
 * - dígrafos comprimidos (@ [ ^ _ ] \) se expanden.
 * - dos 'g' seguidas (barras verticales del marco) → salto de línea.
 * - byte con bit alto (>127) → su ASCII (byte − 0x80).
 * - el resto (minúsculas de dibujo del marco, dígitos de esquinas) se descarta.
 */
export function scrubSignText(raw: string): string {
  let out = "";
  let prev = "";
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if ((ch >= "A" && ch <= "Z") || ch === " ") {
      out += ch;
    } else if (ch in DIGRAPHS) {
      out += DIGRAPHS[ch];
    } else if (ch === "g" && prev === "g") {
      out += "\n";
    } else if (code > 127) {
      out += String.fromCharCode(code - 128);
    }
    // resto: descartado
    prev = ch;
  }
  return out;
}

/** Lee un string terminado en \0 desde `offset` (máx `maxLen` bytes crudos). */
function readNullTerm(bytes: Uint8Array, offset: number, maxLen = 0xff): string {
  let s = "";
  for (let i = 0; i < maxLen && offset + i < bytes.length; i++) {
    const b = bytes[offset + i]!;
    if (b === 0) break;
    s += String.fromCharCode(b);
  }
  return s;
}

/**
 * Parsea SIGNS.DAT (+ el cartel extra de DATA.OVL) a una lista de carteles con
 * texto ya legible.
 */
export function parseSigns(
  signsDat: Uint8Array,
  dataOvl: Uint8Array,
): SignEntry[] {
  const signs: SignEntry[] = [];
  let idx = TOTAL_SIGNS * 2; // saltar la tabla de offsets

  // Recorrer hasta encontrar cuatro bytes 0 seguidos (fin de fichero).
  while (idx + 4 <= signsDat.length) {
    const location = signsDat[idx]!;
    const floor = signsDat[idx + 1]!;
    const x = signsDat[idx + 2]!;
    const y = signsDat[idx + 3]!;
    if (location === 0 && floor === 0 && x === 0 && y === 0) break;

    const rawText = readNullTerm(signsDat, idx + 4);
    const rawLen = rawText.length;

    // Cartel de texto vacío: toma prestado el texto del siguiente registro.
    let text = rawText;
    if (text.trim() === "") {
      const nextTextOffset = idx + 4 + (rawLen + 1) + 4;
      text = readNullTerm(signsDat, nextTextOffset);
    }

    signs.push({
      location,
      floor,
      x,
      y,
      text: scrubSignText(text),
      raw: [...text].map((c) => c.charCodeAt(0)), // bytes horneados (marco + cuerpo runa)
    });

    // Avanzar por ESTE registro: 4 bytes de cabecera + texto + \0.
    idx += rawLen + 1 + 4;
  }

  // Cartel extra no presente en SIGNS.DAT: "Sign of Eight Laws" de Serpent's Hold
  // (DATA.OVL:0x743A, 0x66 bytes). Coords fijas (Signs.cs:63-64).
  const shRaw = readNullTerm(dataOvl, 0x743a, 0x66);
  signs.push({
    location: SERPENTS_HOLD,
    floor: 0,
    x: 15,
    y: 19,
    text: scrubSignText(shRaw),
    raw: [...shRaw].map((c) => c.charCodeAt(0)),
  });

  return signs;
}
