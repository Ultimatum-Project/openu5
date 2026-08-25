/**
 * CONSOLA fiel (E1-S8a) — primer uso de la capa de texto. Pinta el flujo de
 * consola del CoreView (`snapshot.console`, líneas ya formadas por el core) en
 * una ventana de texto que calca el printer del kernel: word-wrap por el ancho
 * de ventana y scroll de las últimas líneas (`re/notes/ui-text-layer.md §4–§5`).
 *
 * Es un COMPONENTE de la piel fiel, no la piel entera (S8b monta el chrome). No
 * lee el core: recibe las líneas ya como datos (respeta el guard de imports —
 * fiel/ sólo habla con el contrato / datos, nunca con el motor).
 */
import { BLANK, TextWindow, type WindowRect } from "./textwindow.js";
import { FaithfulFont, GLYPH_PX } from "./font.js";
import type { ConsoleLine, ConsoleSegment } from "../api.js";

/**
 * Glifo del BULLET ► de eco de comando (IBM.CH code 0x02; ver la nota histórica en
 * skin.ts §drawBullet). Vive AQUÍ (capa de layout puro) porque el mapeo
 * `ConsoleLine → ConsoleRow` le antepone el carácter para que wrap/scroll cuenten
 * su celda; skin.ts lo importa para el despacho por-code del blit.
 */
export const CONSOLE_BULLET_CODE = 0x02;
export const CONSOLE_BULLET = String.fromCharCode(CONSOLE_BULLET_CODE);

export interface ConsoleOptions {
  /** Descriptor de la ventana de consola en celdas (px reales = S8b). */
  rect: WindowRect;
  /** Escala entera de píxel lógico → pantalla (la piel fiel usa 320×200 base). */
  scale?: number;
}

/**
 * Reduce las líneas a la rejilla de la ventana aplicando el printer derivado:
 * cada línea del stream se imprime con word-wrap y baja UNA fila (un LF), y el
 * scroll deja visibles las últimas filas. Devuelve la ventana ya poblada (útil
 * para tests sin canvas). PURO.
 *
 * DISCIPLINA DE \n (ui-text-layer §4–§5). `putChar(LF)` = CRLF: baja UNA fila
 * (kernel `0x1742`). Cada string [D] del original lleva su propio `\n` FINAL
 * ("North\n", "Very slow!\n", "Blocked!\n" — DATA.OVL DS 0x29db/0x29cf/0x26d6,
 * todas 1 solo LF final, sin bullet ni LF inicial), así que el eco de un turno y
 * su resultado quedan en filas CONTIGUAS ("pegados"). Por eso aquí va UN solo LF
 * entre líneas, no dos: una entrada del array = una fila. Una fila EN BLANCO es
 * una entrada `""` explícita del array (viene del `\n\n` de un string [D], p.ej.
 * "Zzzzzz...\n\n", o del separador de turno que inyecta `withTurnSeparators`).
 * No hay LF final (forzaría scroll de más y movería el cursor de la ola).
 *
 * (Sustituye la regla sintética de qa6 "un blanco entre TODA entrada", que era
 * demasiado burda: metía una fila vacía hasta entre el eco y su propio
 * resultado. Reporte QA #69.)
 */
export function layoutConsole(
  rect: WindowRect,
  lines: readonly string[],
  runeFlags?: readonly boolean[],
  signCells?: readonly (readonly { code: number; rune: boolean }[] | undefined)[],
  segments?: readonly (readonly ConsoleSegment[] | undefined)[],
): TextWindow {
  const win = new TextWindow(rect);
  for (let i = 0; i < lines.length; i++) {
    // Un LF = una fila abajo (cada \n del stream) — SALVO si la entrada anterior
    // LLENÓ su fila exacta: el wrap eager de putchar ya bajó el cursor y el kernel
    // CONSUME el \n final de esa cadena (print_string 0x19b1-0x19c7, careo-combate
    // T6) — sin esto "*** CONFLICT ***" (16 chars) metía una fila en blanco extra.
    if (i > 0 && !win.consumeWrapPending()) win.putChar(0x0a);
    // Fila de un CARTEL (L)ook: celdas ya compuestas y centradas (marco RUNES.CH + cuerpo
    // rúnico) → se escriben verbatim, sin word-wrap (una fila de la caja no se parte por
    // palabra). El `text` de esta línea es sólo el cuerpo latín del log (no se pinta).
    const sc = signCells?.[i];
    if (sc) {
      win.putRowCells(sc);
      continue;
    }
    // Modo RÚNICO por línea (profecía del Codex): las celdas de esta línea se marcan en
    // `win.cellRune` para que la capa de blit las pinte con la fuente RUNES.CH. Sin
    // `runeFlags` (uso normal) el modo queda apagado → pintado idéntico al anterior.
    win.runeMode = runeFlags?.[i] ?? false;
    // Ancho de wrap ÚNICO = wrapWidth (rightCol-leftCol): la CAPACIDAD real por
    // fila es wrapWidth+1 = cols (kernel 0x18dc, cota inclusive — careo T6), que
    // subsume el antiguo "+1 del eco" ("►Set Active Plr:" = 16 celdas cabe); los
    // mensajes ganan la celda 16 que el off-by-one les negaba ("*** CONFLICT ***").
    //
    // Fila MIXTA (#364-c, `segments`): la fuente cambia a mitad de fila (ALAKAZAM,
    // «A scroll: <runa>!», habla rúnica de TALK) → flags por carácter. La métrica de
    // wrap no cambia (ambas fuentes monoespaciadas de 8 px); INVARIANTE del modelo:
    // la concatenación de los tramos === `lines[i]` (mismo texto, otro plano de flags).
    const segs = segments?.[i];
    if (segs) win.printStringSegments(segs);
    else win.printString(lines[i]!);
  }
  win.runeMode = false;
  // ANCLA ABAJO (ficha #113, reporte del usuario sobre el frame 16/16 del vídeo
  // split-screen). La ventana de texto del binario es PERSISTENTE: una vez llena,
  // el cursor no vuelve a subir de `botRow` — cada línea nueva EMPUJA lo anterior
  // hacia arriba y la línea de entrada queda pegada al borde inferior. El port
  // reconstruye la rejilla en cada frame desde el último tramo del log, así que sin
  // este gesto un tramo corto se pinta pegado ARRIBA con el hueco DEBAJO. Medido en
  // el frame 0 de la secuencia: el original enseña «►Pass» y el prompt en las dos
  // últimas filas con diez filas en blanco encima; el port los ponía en las dos
  // PRIMERAS. Con la ventana ya llena (el caso corriente tras unos turnos) esto no
  // mueve ni un píxel — es un no-op si el cursor ya está en la última fila.
  win.anchorBottom();
  return win;
}

/**
 * Mapea las `ConsoleLine` del snapshot (core) a filas de layout `ConsoleRow`:
 * SÓLO un eco NO vacío abre grupo y lleva bullet ► antepuesto; una línea vacía de
 * kind "echo" (resto de un split por "\n") es sólo un blanco, y la fila de CURSOR
 * de un getstring (`cont`: el ":" del Yell/Talk) tampoco lleva bullet — el ► marca
 * el eco del comando, no el getstring. PURO. (Extraído del render de la piel fiel
 * —byte-idéntico— para que el modo scrollback aplique el MISMO mapeo al historial.)
 */
export function consoleLinesToRows(lines: readonly ConsoleLine[]): ConsoleRow[] {
  return lines.map((l) => {
    const isEcho = l.kind === "echo" && l.text !== "" && !l.cont;
    // Fila MIXTA (#364-c): el bullet ► del eco se ANTEPONE como TRAMO latino propio —
    // con offsets desplazaría los spans; con segments el resto de tramos no se mueve.
    const segments =
      l.segments && isEcho ? [{ text: CONSOLE_BULLET, rune: false }, ...l.segments] : l.segments;
    return {
      text: isEcho ? CONSOLE_BULLET + l.text : l.text,
      groupStart: isEcho,
      rune: l.rune,
      segments,
      signCells: l.signCells, // fila de un cartel (L)ook: celdas pre-compuestas
    };
  });
}

/**
 * VENTANA DESLIZANTE del scrollback (carril log-scroll): recorta las últimas
 * `offset` filas ricas del final del stream, de modo que `layoutConsole` (que
 * enseña las últimas filas de lo que imprime) muestre la ventana que TERMINA
 * `offset` líneas antes del presente. `offset` se acota a [0, maxScrollOffset]
 * para no pasarse del tope del historial. PURO.
 */
export function scrollbackSlice<T>(rich: readonly T[], offset: number, rows: number): T[] {
  const off = Math.max(0, Math.min(Math.floor(offset), maxScrollOffset(rich.length, rows)));
  return rich.slice(0, rich.length - off);
}

/**
 * Tope del offset de scrollback: no tiene sentido retroceder más allá de dejar
 * `rows` líneas visibles (la ventana quedaría medio vacía). 0 si el historial
 * cabe entero en la ventana. PURO.
 */
export function maxScrollOffset(totalLines: number, rows: number): number {
  return Math.max(0, totalLines - rows);
}

/** Una fila lógica de consola + si ABRE un grupo de turno (eco ► / prompt). */
export interface ConsoleRow {
  text: string;
  groupStart: boolean;
  /** La fila se imprime con la fuente RÚNICA (profecía del Codex). Default false. */
  rune?: boolean;
  /** Fila MIXTA (#364-c): tramos {text,rune} cuya concatenación === `text` (bullet incluido). */
  segments?: readonly ConsoleSegment[];
  /** Fila de un CARTEL (L)ook: celdas pre-compuestas a blitear verbatim (ver layoutConsole). */
  signCells?: readonly { code: number; rune: boolean }[];
}

/**
 * Inyecta el SEPARADOR DE TURNO (una fila en blanco) ANTES de cada fila que abre
 * grupo (el eco ► de un comando, o la línea de prompt vivo), reproduciendo el LF
 * que el wrapper de getkey imprime ANTES de leer cada comando: MAINOUT `0x5cd`
 * (`mov ax,0xa; call putchar`, gateado por `[0x5956]`). Ese LF, cayendo tras el
 * `\n` final del último resultado del turno anterior, es el DOBLE LF que abre la
 * fila vacía entre grupos — mientras el eco y su resultado, con un solo `\n`
 * cada uno, quedan pegados. Resultado (captura del usuario): "Very slow!" /
 * blanco / "►West" / "Very slow!" / blanco / "►West"…
 *
 * No añade blanco al TOPE del log (no hay turno previo que separar) ni si la fila
 * previa ya está vacía (el `\n\n` de un string [D] ya abrió la fila). PURO.
 */
export function withTurnSeparators(rows: readonly ConsoleRow[]): string[] {
  return withTurnSeparatorsRich(rows).map((r) => r.text);
}

/**
 * Como `withTurnSeparators` pero conservando el flag RÚNICO de cada fila (para el
 * pintado por-fuente de la consola). Los separadores de turno inyectados son prosa
 * en blanco (rune:false). La piel fiel usa esta variante; los tests del separador
 * siguen contra `withTurnSeparators` (string[]).
 */
export function withTurnSeparatorsRich(rows: readonly ConsoleRow[]): {
  text: string;
  rune: boolean;
  segments?: readonly ConsoleSegment[];
  signCells?: readonly { code: number; rune: boolean }[];
}[] {
  const out: {
    text: string;
    rune: boolean;
    segments?: readonly ConsoleSegment[];
    signCells?: readonly { code: number; rune: boolean }[];
  }[] = [];
  for (const row of rows) {
    if (row.groupStart && out.length > 0 && out[out.length - 1]!.text !== "") {
      out.push({ text: "", rune: false }); // separador de turno = el LF del getkey (MAINOUT 0x5cd)
    }
    out.push({
      text: row.text,
      rune: row.rune ?? false,
      segments: row.segments,
      signCells: row.signCells,
    });
  }
  return out;
}

export class FaithfulConsole {
  private readonly scale: number;
  constructor(
    private readonly font: FaithfulFont,
    private readonly opts: ConsoleOptions,
  ) {
    this.scale = opts.scale ?? 1;
  }

  /**
   * Pinta las líneas de consola en el contexto. El origen en píxeles sale del
   * descriptor (`leftCol/topRow × 8 px`), escalado — cuando S8b fije las coords
   * reales de la ventana, la consola cae en su sitio sin tocar esto.
   */
  render(ctx: CanvasRenderingContext2D, lines: readonly string[]): void {
    const { rect } = this.opts;
    const win = layoutConsole(rect, lines);
    const cell = GLYPH_PX * this.scale;
    const originX = rect.leftCol * cell;
    const originY = rect.topRow * cell;
    for (let row = 0; row < win.rows; row++) {
      for (let col = 0; col < win.cols; col++) {
        const code = win.cells[row * win.cols + col]!;
        if (code === BLANK) continue; // celda vacía → nada que blitear
        this.font.drawGlyph(ctx, code, originX + col * cell, originY + row * cell, this.scale);
      }
    }
  }
}
