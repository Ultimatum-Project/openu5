/**
 * VENTANA DE TEXTO de la piel fiel — calco del printer del kernel de ULTIMA.EXE
 * (E1-S8a). Modelo PURO (sin canvas): mantiene una rejilla de códigos de glifo y
 * un cursor, y reproduce la semántica derivada en `re/notes/ui-text-layer.md`:
 *
 *  - Descriptor de ventana en CELDAS de carácter (8×8 px): left/top/right/bot
 *    inclusivos; ancho de escritura = right-left (§3).
 *  - `putChar` (kernel `0x16ba`): LF(0x0a)=CRLF, CR(0x0d)=retorno de carro,
 *    auto-avance del cursor con WRAP al pasar `rightCol`, SCROLL al pasar
 *    `botRow`, y códigos de control 0xFB–0xFF de atributo (§4).
 *  - `printString` (kernel `0x1850`): word-wrap por palabra sobre el ancho de
 *    ventana, con corte duro si una palabra no cabe (§5).
 *
 * La rejilla (`cells`) es lo que la capa de blit pinta con la fuente IBM.CH; el
 * modelo no sabe de píxeles ni de color (eso lo pone la piel: §3 attr / S8b).
 *
 * NOTA de fidelidad: los VALORES del descriptor (coords px de la consola, panel,
 * etc.) son chrome de S8b (tabla runtime `0x535e` / píxel-diff). Aquí se calca la
 * ESTRUCTURA y el ALGORITMO; el tamaño de ventana entra por parámetro.
 */

/** Código de glifo en blanco (espacio, 0x20 — glifo a ceros en IBM.CH). */
export const BLANK = 0x20;
const LF = 0x0a;
const CR = 0x0d;
const SPACE = 0x20;

/** Descriptor de ventana en celdas de carácter (bordes INCLUSIVOS). */
export interface WindowRect {
  leftCol: number;
  topRow: number;
  rightCol: number;
  botRow: number;
}

export class TextWindow {
  readonly cols: number; // celdas escribibles a lo ancho (right-left+1)
  readonly rows: number; // celdas a lo alto (bot-top+1)
  /** Ancho de word-wrap del kernel = right-left (`print_string 0x1897`). */
  readonly wrapWidth: number;

  /** Rejilla `rows×cols` de códigos de glifo; row-major. */
  readonly cells: Uint8Array;

  /**
   * Plano paralelo a `cells`: 1 = la celda se escribió en MODO RÚNICO (`runeMode`),
   * es decir con la FUENTE 1 (RUNES.CH) — la profecía del Codex (ceremonia de las 8
   * virtudes, `set_font(1)` del binario). La capa de blit escoge `runes` vs `font`
   * por celda. Se mantiene en lockstep con `cells` en escritura/scroll/reset. Vacío
   * (todo 0) para el uso normal de consola, así que no altera el pintado existente.
   */
  readonly cellRune: Uint8Array;

  /** Si true, `writeGlyph` marca cada celda escrita como rúnica en `cellRune`. */
  runeMode = false;

  /** Cursor como OFFSET desde (leftCol, topRow) — como `curCol/curRow` del asm. */
  curCol = 0;
  curRow = 0;

  // Flags de atributo (§4). El blit de S8a no los usa aún; se calcan para que la
  // semántica de control-codes sea completa y verificable.
  reverse = false;
  centered = false;
  invert = false;

  /** Si false, `putChar` no auto-avanza el cursor (flag `[0x538e]` del kernel). */
  autoAdvance = true;

  constructor(readonly rect: WindowRect) {
    this.cols = rect.rightCol - rect.leftCol + 1;
    this.rows = rect.botRow - rect.topRow + 1;
    this.wrapWidth = rect.rightCol - rect.leftCol;
    if (this.cols < 1 || this.rows < 1) {
      throw new Error("TextWindow: descriptor con dimensiones no positivas");
    }
    this.cells = new Uint8Array(this.rows * this.cols).fill(BLANK);
    this.cellRune = new Uint8Array(this.rows * this.cols);
  }

  /** Limpia la rejilla y lleva el cursor a (0,0) — como el control 0xFF. */
  reset(): void {
    this.cells.fill(BLANK);
    this.cellRune.fill(0);
    this.curCol = 0;
    this.curRow = 0;
  }

  /** Fila `curRow` rebasó `botRow` → desplaza la rejilla una línea arriba. */
  private scrollIfNeeded(): void {
    // abs row = topRow + curRow; scroll cuando abs > botRow (kernel `0x174f`).
    if (this.curRow < this.rows) return;
    // Desplaza cada fila una arriba; la última queda en blanco.
    this.cells.copyWithin(0, this.cols); // filas [1..] → [0..]
    this.cells.fill(BLANK, (this.rows - 1) * this.cols);
    this.cellRune.copyWithin(0, this.cols); // el plano rúnico viaja con la rejilla
    this.cellRune.fill(0, (this.rows - 1) * this.cols);
    this.curRow = this.rows - 1; // el cursor se queda en la última fila
  }

  /**
   * ANCLA ABAJO: desplaza lo escrito hasta que el CURSOR quede en la última fila,
   * dejando el hueco ARRIBA. Es el estado en que un TERMINAL lleva ya un rato
   * corriendo — el cursor sólo abandona la fila `botRow` mientras la ventana se
   * llena por primera vez, y a partir de ahí `scrollIfNeeded` lo devuelve ahí
   * siempre (`0x1745-0x1767`: al rebasar `botRow` el driver desplaza y `dec curRow`).
   *
   * Hace falta porque el port NO mantiene la ventana viva entre frames: la
   * RECONSTRUYE en cada render desde el último tramo del log, así que cada frame
   * arranca con el cursor en (0,0) como si el juego acabara de empezar. Sin esto,
   * un tramo más corto que la ventana se pinta pegado ARRIBA con el hueco debajo —
   * el defecto que reportó el usuario mirando el vídeo. Aplicar el desplazamiento
   * equivale a decir «antes de este tramo hubo `d` scrolls más», que es la verdad
   * del terminal. Los `d` scrolls no se simulan uno a uno porque el resultado es el
   * mismo y esto es O(rejilla).
   *
   * No-op si el cursor ya está en la última fila (el caso normal con la ventana
   * llena) ⇒ el pintado de un log largo no cambia ni un píxel.
   */
  anchorBottom(): void {
    const d = this.rows - 1 - this.curRow;
    if (d <= 0) return;
    const shift = d * this.cols;
    this.cells.copyWithin(shift, 0, this.cells.length - shift);
    this.cells.fill(BLANK, 0, shift);
    this.cellRune.copyWithin(shift, 0, this.cellRune.length - shift);
    this.cellRune.fill(0, 0, shift);
    this.curRow += d;
  }

  /** Retorno de carro (CR, kernel `0x1745`): columna 0 + chequeo de scroll. */
  private carriageReturn(): void {
    this.curCol = 0;
    this.scrollIfNeeded();
  }

  /** Nueva línea (LF, kernel `0x1742`→`0x1745`): baja fila + retorno de carro. */
  private lineFeed(): void {
    this.curRow++;
    this.carriageReturn();
  }

  /**
   * Emite un carácter (kernel `putchar 0x16ba`). `code` 0..0xFF. Códigos
   * 0x80–0xFA se enmascaran a `code & 0x7F`; 0xFB–0xFF son control de atributo.
   */
  putChar(code: number): void {
    code &= 0xff;
    if (code > 0x7f) {
      switch (code) {
        case 0xff: // reset de ventana (clear + home)
          this.reset();
          return;
        case 0xfe: // toggle reverse
          this.reverse = !this.reverse;
          return;
        case 0xfd: // toggle invert
          this.invert = !this.invert;
          return;
        case 0xfc: // centrado ON
          this.centered = true;
          return;
        case 0xfb: // centrado OFF
          this.centered = false;
          return;
        default:
          code &= 0x7f; // 0x80–0xFA → glifo enmascarado
      }
    }
    if (code === LF) {
      this.lineFeed();
      return;
    }
    if (code === CR) {
      this.carriageReturn();
      return;
    }
    // Glifo imprimible: escribe en el cursor actual y avanza (con wrap).
    this.writeGlyph(code);
  }

  /**
   * Escribe un glifo LITERAL `code` (0..255) en el cursor y avanza con wrap/scroll,
   * SIN la decodificación de atributos/LF/CR de `putChar`. Es la ruta de los glifos
   * de EXTENSIÓN Latino-1 (cp 0xA0..0xFF, acentos — i18n F1c): `printString` la usa
   * para que un acento se guarde LITERAL en la rejilla (la fuente lo enruta al atlas
   * de extensión) en vez de mascararse a 7-bit como atributo. `putChar` queda intacto
   * (su calco del kernel y sus tests no cambian).
   */
  putGlyph(code: number): void {
    this.writeGlyph(code & 0xff);
  }

  /**
   * ¿El último glifo escrito LLENÓ la fila y el cursor auto-envolvió? (kernel
   * putchar 0x173d→0x1742: wrap EAGER al escribir la celda `rightCol`).
   * `print_string` (0x19b1-0x19c7) CONSUME el delimitador que sigue a una fila
   * llena — avanza el puntero PASADO el espacio/LF (0x19bc `inc [bp-6]`) y NO
   * emite el LF entre líneas ([bp-2] sólo se arma si la fila quedó corta,
   * 0x19bf-0x19c7) — así una línea de EXACTAMENTE `cols` chars no produce fila en
   * blanco ni espacio inicial huérfano. Quien vaya a emitir ese delimitador
   * (printString con espacio/LF, o el LF inter-entradas de layoutConsole) debe
   * preguntar `consumeWrapPending()` primero. careo-combate T6.
   */
  private wrapPending = false;

  /** Consume (y apaga) el delimitador pendiente de una fila llena. */
  consumeWrapPending(): boolean {
    const w = this.wrapPending;
    this.wrapPending = false;
    return w;
  }

  /** Núcleo común de escritura de glifo (cursor + wrap + scroll). */
  private writeGlyph(code: number): void {
    // Guarda de seguridad: si el cursor ya rebasó (autoAdvance off + input
    // largo), envuelve antes de escribir para no salirse de la rejilla.
    if (this.curCol >= this.cols) this.lineFeed();
    const idx = this.curRow * this.cols + this.curCol;
    this.cells[idx] = code;
    this.cellRune[idx] = this.runeMode ? 1 : 0;
    this.wrapPending = false; // una escritura nueva anula cualquier pendiente
    if (!this.autoAdvance) return;
    this.curCol++;
    // abs col = leftCol+curCol; wrap cuando abs > rightCol ⇔ curCol >= cols
    // (EAGER, kernel 0x173d) — y deja pendiente el delimitador a consumir.
    if (this.curCol >= this.cols) {
      this.lineFeed();
      this.wrapPending = true;
    }
  }

  /**
   * Escribe una fila de celdas PRE-COMPUESTAS verbatim en la fila actual, SIN word-wrap
   * ni decodificación (cada celda trae su código + si es rúnica). La usa el cartel (L)ook,
   * cuya caja es una rejilla de glifos ya centrada (marco RUNES.CH + cuerpo rúnico) que no
   * debe partirse por palabra. Empieza en la col 0 de la fila actual; recorta a `cols`. El
   * cursor NO avanza de fila (el LF entre líneas del printer de consola ya lo hace).
   */
  putRowCells(cells: readonly { code: number; rune: boolean }[]): void {
    const base = this.curRow * this.cols;
    for (let k = 0; k < cells.length && k < this.cols; k++) {
      this.cells[base + k] = cells[k]!.code & 0xff;
      this.cellRune[base + k] = cells[k]!.rune ? 1 : 0;
    }
  }

  /**
   * Imprime una cadena con word-wrap (kernel `print_string 0x1850`). Ajusta por
   * palabra sobre `wrapWidth`; si una palabra sola no cabe, corta duro. Los
   * saltos explícitos (`\n` LF y `\r` CR) del texto se respetan.
   *
   * `wrapWidth` por defecto = `rightCol-leftCol` (el ancho de escritura del kernel,
   * §3). Un caller puede SUBIRLO en +1 (= `cols`) para el ECO de comando: el bullet
   * ► (glifo 0x02 que el port prepende) ocupa la col 0 del gutter pero NO es
   * contenido del `print_string` del kernel (allí es un glifo de prompt SEPARADO,
   * getkey), así que no debe gastar presupuesto de word-wrap. Con ello "►Set Active
   * Plr:" (bullet + 15 chars = 16 celdas, DS 0xa396) CABE en una fila de 16 col en
   * vez de partir "Plr:" (testigo del usuario ORIG_zoom-prompt-1-linea-iolo.png;
   * geometría del testigo = spec Clase-C: bullet en gutter, texto desde col 0).
   */
  printString(text: string, wrapWidth: number = this.wrapWidth): void {
    this.printCore(text, undefined, wrapWidth);
  }

  /**
   * Variante POR-TRAMO de `printString` (#364-c): imprime la concatenación de los
   * tramos con el MISMO word-wrap (la métrica es indiferente a la fuente: IBM.CH y
   * RUNES.CH son ambas monoespaciadas de 8 px), fijando `runeMode` POR CARÁCTER según
   * el tramo al que pertenece — el calco del bucle de TALK 0x4fc-0x55e, que decide la
   * fuente por iteración con el bit 7 del carácter. Los delimitadores CONSUMIDOS por
   * una fila llena (careo-combate T6, `consumeWrapPending`) avanzan el índice sin
   * emitir glifo, así que el plano de flags —indexado por posición en el texto—
   * no se desalinea: cada glifo escrito toma el flag de SU posición.
   */
  printStringSegments(
    segments: readonly { text: string; rune: boolean }[],
    wrapWidth: number = this.wrapWidth,
  ): void {
    let text = "";
    const flags: boolean[] = [];
    for (const seg of segments) {
      text += seg.text;
      for (let k = 0; k < seg.text.length; k++) flags.push(seg.rune);
    }
    this.printCore(text, flags, wrapWidth);
  }

  /**
   * Núcleo común de `printString`/`printStringSegments`. Con `flags` (paralelo a
   * `text`, un booleano por carácter) fija `runeMode` antes de CADA emisión de glifo;
   * sin él, `runeMode` queda como lo dejó el caller (modo por-línea, byte-idéntico al
   * `printString` histórico). La aritmética de wrap (medida de palabra, cota inclusive
   * `remaining+1`, corte duro, consumo de delimitadores) es UNA para ambos.
   */
  private printCore(text: string, flags: readonly boolean[] | undefined, wrapWidth: number): void {
    let i = 0;
    const n = text.length;
    while (i < n) {
      const ch = text.charCodeAt(i);
      if (ch === LF || ch === CR) {
        // Fila llena justo antes: el kernel CONSUME el delimitador (0x19bc avanza
        // el puntero pasado el LF; la fila ya bajó por el wrap eager de putchar) —
        // sin esto una línea de EXACTAMENTE `cols` chars metía fila en blanco.
        if (ch === LF && this.consumeWrapPending()) {
          i++;
          continue;
        }
        this.putChar(ch);
        i++;
        continue;
      }
      if (ch === SPACE) {
        // Espacio tras fila llena: consumido (kernel 0x19bc — el backtrack dejó el
        // puntero EN el espacio y el avance lo salta; la fila siguiente arranca en
        // la col 0 con la palabra, no con un espacio huérfano).
        if (this.consumeWrapPending()) {
          i++;
          continue;
        }
        // El ESPACIO también escribe celda: toma el flag de su posición (un espacio
        // dentro del tramo rúnico marca su celda rúnica, como el bit 7 del binario).
        if (flags) this.runeMode = flags[i] ?? false;
        this.putChar(SPACE); // putChar aplica el wrap duro si toca
        i++;
        continue;
      }
      // Mide la palabra siguiente (hasta espacio/LF/CR/fin).
      let j = i;
      while (j < n) {
        const c = text.charCodeAt(j);
        if (c === SPACE || c === LF || c === CR) break;
        j++;
      }
      const wordLen = j - i;
      // CAPACIDAD REAL de la fila = wrapWidth+1 (careo-combate T6): el bucle de
      // copia del kernel (`print_string 0x18dc: cmp si,di; jg` — cota INCLUSIVE
      // sobre di = remaining) admite `remaining+1` caracteres por línea, con
      // `remaining = (rightCol-leftCol) - curCol` (0x18b4-0x18bf). Por eso
      // "*** CONFLICT ***" y "Iolo, armed with" (16 chars exactos en la consola
      // de 16 col) CABEN — el `wordLen > remaining` anterior (capacidad 15+curCol)
      // los partía (off-by-one falsificado por los frames del original).
      const remaining = wrapWidth - this.curCol;
      // Si la palabra no cabe en lo que queda de línea Y no estamos ya al inicio
      // de línea, salta antes de escribirla. Esto vale tanto para una palabra que
      // sí cabe en una línea entera (word-wrap normal) COMO para una MÁS LARGA que
      // la ventana: el kernel también emite el LF previo antes del corte duro,
      // gateado por `curCol != 0` (`print_string 0x1981: cmp [desc+4],0` = curCol;
      // 0x1987-0x198e emite el 0xa). La palabra imposible arranca en línea nueva y
      // putChar la parte con su wrap duro.
      if (wordLen > remaining + 1 && this.curCol > 0) {
        this.putChar(LF);
      }
      // Los codepoints Latino-1 (0xA0..0xFF, acentos) van por `putGlyph` LITERAL para
      // no mascararse como atributo; el resto (ASCII y >0xFF) por `putChar` como antes
      // (byte-idéntico para inglés, que es ASCII). i18n F1c.
      for (; i < j; i++) {
        const c = text.charCodeAt(i);
        if (flags) this.runeMode = flags[i] ?? false;
        if (c >= 0xa0 && c <= 0xff) this.putGlyph(c);
        else this.putChar(c);
      }
    }
  }

  /** Copia de la rejilla (para la capa de blit; no expone el buffer vivo). */
  snapshotCells(): Uint8Array {
    return this.cells.slice();
  }
}
