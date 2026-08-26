/**
 * Parser de los MENSAJES DE TEXTO que el original carga en el búfer DS 0xB21E — los
 * dos ficheros que quedaban SIN extraer (FICHA β de `re/notes/acta-380-i18n-en-claro.md`).
 *
 * ── POR QUÉ EXISTE: LA ÚNICA PROSA DE EA QUE VIAJABA EN EL CÓDIGO ────────────────────
 * `re/notes/acta-630-prosa-publicada.md` midió que el árbol público servía **653
 * palabras** de prosa de EA y que **638 de ellas** salían de cadenas del segmento de
 * datos transcritas A MANO como literales en `game/src/**` y en el manifiesto de
 * fidelidad. No era negligencia: eran IRRECUPERABLES. `acta-380` §4 lo midió — de los
 * 18 literales de la clase B, los que estaban en `game/assets` eran **CERO**, porque
 * KARMA.DAT y MISCMSG.DAT **no estaban en `REQUIRED_FILES` y no los parseaba nadie**.
 * Plegarlos a huella habría sido un borrado, no una huella. Este parser es el
 * prerrequisito que faltaba: extraídos, el port los lee del juego DEL PROPIO USUARIO
 * y dejan de estar en el índice.
 *
 * ⚠ `0xB21E` es un BÚFER DE CARGA, no un pool de cadenas de DATA.OVL. Los overlays
 * hacen `load_chunk(<fichero>, seek, len → 0xb21e)` y luego indexan por tabla. Por eso
 * estas cadenas NO están en `data.json` (que sale de DATA.OVL) ni en los TLK: sólo
 * existen dentro de estos ficheros `.DAT`. Ver `re/notes/dataovl-strings.md` (mapa del
 * DGROUP: 0xA540..0xBD50 es BSS/ceros en el fichero) y `re/notes/blackthorn.md`.
 *
 * ── FORMATO ──────────────────────────────────────────────────────────────────────────
 * Los tres ficheros son registros NUL-delimitados, igual que ENDMSG.DAT (cuyo parser
 * —`endgame-msg.ts::parseEndgameDialogue`— es el precedente literal de éste, y por eso
 * la limpieza es la misma: se conserva el `\n`, que es formato de línea significativo
 * del diálogo, y NO llevan `{` / `_` como STORY.DAT/END.DAT).
 *
 * Los índices de registro que emite este parser son los MISMOS que citan las entradas
 * `[D]` del manifiesto de fidelidad (`KARMA.DAT rec2`, `MISCMSG.DAT rec11 (DS 0xb54a)`…),
 * y ése es el contrato que `ds-strings.test.ts` fija con testigos EN CRUDO.
 */

const RECORD_SEP = 0x00; // NUL: separador de registro

/** Los ficheros de mensajes que se cargan al búfer DS 0xB21E y que este parser extrae. */
export const DS_STRING_FILES = ["KARMA.DAT", "MISCMSG.DAT", "ENDMSG.DAT"] as const;
export type DsStringFile = (typeof DS_STRING_FILES)[number];

/** Registros NUL-delimitados por fichero, EN ORDEN DE FICHERO (extracción fiel). */
export type DsStrings = Record<DsStringFile, string[]>;

/**
 * Trocea un fichero de mensajes en sus registros NUL-delimitados, en orden de fichero
 * y conservando el `\n`. Descarta la cola vacía tras el NUL final.
 *
 * 🔴 Se decodifica como **latin1 y no utf-8**: son bytes de una codepage DOS y un
 * `TextDecoder("utf-8")` sustituiría cualquier byte ≥0x80 por U+FFFD en silencio —
 * un cambio de CONTENIDO que ningún aserto de longitud vería. Mismo criterio que
 * `parseEndgameDialogue`.
 */
export function parseDsStringFile(bytes: Uint8Array): string[] {
  const records: string[] = [];
  let cur: number[] = [];
  const push = (): void => {
    const raw = new TextDecoder("latin1").decode(new Uint8Array(cur));
    if (raw.length > 0) records.push(raw);
    cur = [];
  };
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i]!;
    if (c === RECORD_SEP) {
      push();
      continue;
    }
    cur.push(c);
  }
  push(); // cola sin NUL final (si la hubiera)
  return records;
}

/**
 * Extrae los tres ficheros. `read` es el lector del pipeline (los tres son
 * OBLIGATORIOS: van en `REQUIRED_FILES`, así que una copia sin ellos se para en la
 * validación de entrada con la lista accionable de /byo, no aquí).
 */
export function parseDsStrings(read: (name: string) => Uint8Array): DsStrings {
  const out = {} as DsStrings;
  for (const name of DS_STRING_FILES) out[name] = parseDsStringFile(read(name));
  return out;
}
