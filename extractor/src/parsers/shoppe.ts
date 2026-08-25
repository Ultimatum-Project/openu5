/**
 * Parser de SHOPPE.DAT de Ultima V (MS-DOS): todas las conversaciones de los
 * mercaderes en un único StringList comprimido.
 *
 * Portado de Ultima5Redux:
 *   References/MapUnits/NonPlayerCharacters/ShoppeKeepers/ShoppeKeeperDialogueReference.cs
 *     (BuildConversationTable L175-186, chunk StringList offset 0x00 len 0x2797)
 *   References/Dialogue/CompressedWordReference.cs
 *     (ReplaceRawMerchantStringsWithCompressedWords L133-187)
 *
 * Mecanismo de descompresión (idéntico diccionario y mapa de huecos que los
 * .TLK, pero con codificación de bytes distinta):
 *  - Byte con carácter ASCII imprimible (letra/dígito, puntuación aceptada o
 *    símbolo de plantilla %&$#@*^) → carácter literal.
 *  - Cualquier otro byte (bit alto puesto) → palabra comprimida. El índice en el
 *    diccionario es `(byte − 0x80) + 1`. El **+1** es específico de los diálogos
 *    de mercader (CompressedWordReference.cs L161-163: `IsTalkingWord(tempByte+1)`),
 *    y NO aparece en el parser de .TLK, donde el índice es el byte crudo.
 *  - Los símbolos de plantilla (%&$#@*^) se dejan intactos para que el front-end
 *    los sustituya en tiempo de ejecución (oro, nombre del mercader, etc.).
 *
 * Divergencia consciente: donde Redux lanza `NoTalkingWordException` ante un
 * índice sin palabra, aquí se omite el byte (tolerancia) para no abortar toda la
 * extracción por una cadena malformada.
 */

import { stringList } from "./binary.js";
import { resolveCompressedWord } from "./tlk.js";

/** Longitud del único chunk StringList de SHOPPE.DAT (ver doc §2.2). */
const SHOPPE_STRINGLIST_LEN = 0x2797;
const TALK_OFFSET_ADJUST = 0x80;

/** a-z, A-Z, 0-9 (IsAcceptableLettersOrDigits). */
function isAcceptableLettersOrDigits(c: number): boolean {
  return (
    (c >= 0x61 && c <= 0x7a) || (c >= 0x41 && c <= 0x5a) || (c >= 0x30 && c <= 0x39)
  );
}

/** Puntuación admitida: espacio " ! , ' . - ? \n ; (IsAcceptablePunctuation). */
function isAcceptablePunctuation(c: number): boolean {
  return (
    c === 0x20 || // ' '
    c === 0x22 || // '"'
    c === 0x21 || // '!'
    c === 0x2c || // ','
    c === 0x27 || // '\''
    c === 0x2e || // '.'
    c === 0x2d || // '-'
    c === 0x3f || // '?'
    c === 0x0a || // '\n'
    c === 0x3b //   ';'
  );
}

/** Símbolos de plantilla que se sustituyen en runtime: % & $ # @ * ^. */
function isReplacementCharacter(c: number): boolean {
  return (
    c === 0x25 || // '%' oro
    c === 0x26 || // '&' pieza de equipo
    c === 0x24 || // '$' nombre del mercader
    c === 0x23 || // '#' negocio actual
    c === 0x40 || // '@' comida/bebida o momento del día
    c === 0x2a || // '*' ubicación de algo
    c === 0x5e //   '^' cantidad de algo
  );
}

/** Descomprime una única cadena cruda de mercader. */
function decompressMerchantString(raw: string, compressedWords: string[]): string {
  let out = "";
  let bUseCompressedWord = false;

  for (const chr of raw) {
    const byteWord = chr.charCodeAt(0) & 0xff;
    const usePhraseLookup = !(
      isAcceptablePunctuation(byteWord) ||
      isAcceptableLettersOrDigits(byteWord) ||
      isReplacementCharacter(byteWord)
    );

    if (usePhraseLookup) {
      // Siempre se inserta un espacio antes de una palabra comprimida.
      out += " ";
      const index = byteWord - TALK_OFFSET_ADJUST + 1;
      const word = resolveCompressedWord(index, compressedWords);
      if (word !== null) {
        out += word;
        bUseCompressedWord = true;
      }
      // Índice sin palabra: se omite (Redux lanzaría excepción).
    } else {
      // Al volver a caracteres sueltos tras una palabra, separa con un espacio.
      if (bUseCompressedWord) {
        out += " ";
        bUseCompressedWord = false;
      }
      out += String.fromCharCode(byteWord);
    }
  }

  return out;
}

/**
 * Descomprime SHOPPE.DAT completo a la lista de cadenas de diálogo, indexable
 * por número de diálogo (mismo orden que Redux `_merchantStrings`).
 */
export function parseShoppeDat(
  bytes: Uint8Array,
  compressedWords: string[],
): string[] {
  const raw = stringList(bytes, 0, SHOPPE_STRINGLIST_LEN);
  return raw.map((s) => decompressMerchantString(s, compressedWords));
}
