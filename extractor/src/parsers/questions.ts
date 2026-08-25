/**
 * Parser de QUESTION.DAT de Ultima V (el cuestionario de la gitana en la
 * creación de personaje, "The Summoning").
 *
 * Formato (verificado contra el binario; ver re/notes/gypsy.md):
 *   Registros terminados en \0, en secuencia desde offset 0.
 *   - Registro 0: NARR1 (entrada al carro de la gitana; empieza con '{').
 *   - Registro 1: NARR2 ("So be it! … Thy path is chosen!"; empieza con '{').
 *   - Registros 2..29: las 28 preguntas = C(8,2) sobre las 8 virtudes, en orden
 *     combinatorio (i<j). El offset de cada par lo indexa la matriz 8×8 de
 *     DATA.OVL (DS:0x517c); la posición en ESTE fichero sigue la fórmula
 *     k = 28 − (8−i)(7−i)/2 + (j−i)  (1-based) → questions[k−1]. La opción A del
 *     texto = virtud de índice MENOR, B = mayor.
 *
 * Limpieza de texto: el original usa `_` como guion de sílaba (pista de corte de
 * línea) y `{` como marcador de bloque de narración; ambos se retiran para
 * mostrar texto limpio. Los `\n` (saltos de párrafo) se conservan.
 */

export interface QuestionData {
  /** Las 2 narraciones de la gitana (entrada + "Thy path is chosen"). */
  narrations: string[];
  /** Las 28 preguntas, indexadas por k−1 (orden combinatorio i<j). */
  questions: string[];
}

const NARRATION_COUNT = 2;
const QUESTION_COUNT = 28;

// '_' (0x5f) = GUION DISCRECIONAL del justificador proporcional (render_justified_text,
// font.md §Justif L26: "'_' break suave, ancho 0"): marca DÓNDE puede partir una palabra
// con guión al justificar. Se conserva como SOFT HYPHEN U+00AD (invisible salvo en el punto
// de corte, tanto en canvas como en el DOM), NO se elimina — así el motor proporcional puede
// hifenar "Com{shy}passion" → "Com-/passion" como el original (ORIG_12). '{' inicial fuera.
const SOFT_HYPHEN = "­";
function clean(raw: string): string {
  return raw.replace(/_/g, SOFT_HYPHEN).replace(/^\{/, "").trim();
}

export function parseQuestions(bytes: Uint8Array): QuestionData {
  const records: string[] = [];
  let i = 0;
  while (i < bytes.length && records.length < NARRATION_COUNT + QUESTION_COUNT) {
    let end = i;
    while (end < bytes.length && bytes[end] !== 0) end++;
    records.push(new TextDecoder("latin1").decode(bytes.subarray(i, end)));
    i = end + 1;
  }
  if (records.length < NARRATION_COUNT + QUESTION_COUNT) {
    throw new Error(
      `QUESTION.DAT: se esperaban ${NARRATION_COUNT + QUESTION_COUNT} registros, ` +
        `se encontraron ${records.length}`,
    );
  }
  return {
    narrations: records.slice(0, NARRATION_COUNT).map(clean),
    questions: records.slice(NARRATION_COUNT, NARRATION_COUNT + QUESTION_COUNT).map(clean),
  };
}
