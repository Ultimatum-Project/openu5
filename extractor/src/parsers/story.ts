/**
 * Parser de STORY.DAT — el guion de "The Summoning" que la cinemática de
 * introducción de Ultima V pagina en pantalla (secuenciador `play_introduction`
 * de INTRO.OVL 0x14e; opción "Ultima V Introduction" del menú de portada). El
 * texto de cada escena se indexa por offset de byte en STORY.DAT (tabla de escena
 * `0x3016` de DATA.OVL; ver `re/notes/intro-scene-tables.md`).
 *
 * FORMATO (DERIVADO Y CITADO — `re/notes/intro-scene-tables.md`): texto EN CLARO,
 * un REGISTRO por escena, delimitados por el byte **NUL (0x00)** (= 21 registros).
 * Dentro de cada registro:
 *   - '{' (0x7B) = **CONTROL DE SANGRÍA** (+0xF px de indent en
 *     `render_justified_text`), NO un separador de página. Marca el arranque de un
 *     párrafo indentado; aquí se traduce a un salto de párrafo (la sangría exacta
 *     en px es presentación proporcional = Clase C).
 *   - '_' (0x5F) = GUION DISCRECIONAL del justificador proporcional (marca dónde
 *     PODRÍA partirse la palabra). Se ELIMINA: unimos las sílabas y damos la
 *     palabra entera (el guion visible sólo aparece si la palabra parte ahí, Clase C).
 *
 * ⚠ CORRECCIÓN (scout de escenas): la versión previa troceaba por '{' → 36
 * "páginas" — INFIEL. El separador real es NUL → 21 registros (↔ 21 escenas de
 * `play_introduction`).
 *
 * Salida: array de REGISTROS (uno por escena, en orden de fichero). El TEXTO es
 * EXACTO del binario (no transcrito). El mapeo escena→registro exacto (vía la
 * tabla 0x3016) lo hace el compositor de escenas de la piel; aquí el orden de
 * fichero coincide con el orden de escena para las escenas que leen STORY.DAT.
 */

const RECORD_SEP = 0x00; // NUL: separador REAL de registro (uno por escena)
const INDENT_MARK = 0x7b; // '{': control de sangría (arranque de párrafo)
const SOFT_HYPHEN = 0x5f; // '_': guion discrecional del justificador

/**
 * Limpia el crudo de un registro: elimina guiones discrecionales, traduce '{' a
 * salto de párrafo y colapsa el resto de espacios/saltos. Devuelve el texto del
 * registro con sus párrafos separados por '\n'.
 */
function cleanRecord(raw: number[]): string {
  const paragraphs: string[] = [];
  let s = "";
  const flush = (): void => {
    const t = s.replace(/[\s]+/g, " ").trim();
    if (t.length > 0) paragraphs.push(t);
    s = "";
  };
  for (const c of raw) {
    if (c === SOFT_HYPHEN) continue; // une sílabas
    if (c === INDENT_MARK) {
      flush(); // '{' = nuevo párrafo indentado
      continue;
    }
    if (c === 0x0a || c === 0x0d || c === 0x09) {
      s += " ";
      continue;
    }
    if (c >= 0x20 && c < 0x7f) s += String.fromCharCode(c);
  }
  flush();
  return paragraphs.join("\n");
}

/**
 * Trocea STORY.DAT en sus registros de texto (uno por escena), delimitados por
 * NUL. Los registros vacíos tras la limpieza se omiten.
 */
export function parseStory(bytes: Uint8Array): string[] {
  const records: string[] = [];
  let cur: number[] = [];
  const push = (): void => {
    const text = cleanRecord(cur);
    if (text.length > 0) records.push(text);
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
  push(); // cola sin NUL final
  return records;
}
