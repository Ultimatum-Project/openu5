/**
 * ENDGAME-SCROLL — el pergamino animado del cierre de Ultima V (task #20, Lote 4).
 *
 * `endgame_datestamp` (ENDGAME.OVL 0x0326) imprime el pergamino de victoria + el informe
 * de playtime paginando el texto con `text_accum_char` (0x023a): un acumulador que
 * VUELCA una línea al llegar a `\n` o al alcanzar **0x27 = 39 columnas**. Este módulo
 * reproduce ese ajuste de línea (word-wrap a 39) y expone un revelado PROGRESIVO del
 * pergamino (línea a línea), determinista, para que la piel lo anime.
 *
 * PURO: no toca el DOM ni el reloj. Recibe las líneas lógicas del pergamino (las que
 * arma `core/quest/endgame.ts::questScroll`) y devuelve la lista de FRAMES de revelado.
 * El texto NO se fija aquí (viene del core); esto es sólo el formateador/animador.
 */

/** Ancho de columna del volcado de `text_accum_char` (ENDGAME 0x023a, flush a >=0x27). */
export const SCROLL_COLS = 39;

/**
 * Ajusta una línea lógica a `cols` columnas por palabras (greedy; corta en el último
 * espacio que quepa). Las líneas vacías se preservan (separadores de párrafo del
 * pergamino). Una palabra más larga que `cols` se emite entera (no se parte a mitad;
 * el original usa guiones discrecionales para eso, ausentes en el pergamino).
 */
export function wrapScrollLine(line: string, cols: number = SCROLL_COLS): string[] {
  if (line.length === 0) return [""];
  const words = line.split(/\s+/).filter((w) => w.length > 0);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur.length === 0) {
      cur = w;
    } else if (cur.length + 1 + w.length <= cols) {
      cur += " " + w;
    } else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur.length > 0) out.push(cur);
  return out.length > 0 ? out : [""];
}

/**
 * Envuelve TODAS las líneas lógicas del pergamino a `cols` columnas (aplica
 * `wrapScrollLine` a cada una, conservando el orden y los separadores en blanco).
 */
export function wrapScroll(lines: readonly string[], cols: number = SCROLL_COLS): string[] {
  const out: string[] = [];
  for (const line of lines) out.push(...wrapScrollLine(line, cols));
  return out;
}

/** Un frame del revelado del pergamino: las líneas visibles hasta ahora. */
export interface ScrollFrame {
  /** Líneas (ya ajustadas a `SCROLL_COLS`) reveladas hasta este frame. */
  visible: string[];
}

/**
 * Construye el revelado PROGRESIVO del pergamino: un frame por cada línea ajustada,
 * revelando una línea más cada vez (el "estampado" del pergamino de cierre). Determinista;
 * la piel lo reproduce a su cadencia. El frame final contiene el pergamino completo.
 */
export function buildScrollReveal(
  lines: readonly string[],
  cols: number = SCROLL_COLS,
): ScrollFrame[] {
  const wrapped = wrapScroll(lines, cols);
  return wrapped.map((_, i) => ({ visible: wrapped.slice(0, i + 1) }));
}
