/**
 * VENTANA «GUEST REGISTER» DE LA POSADA (#283) — calco de `SHOPPES3.OVL:0x052a-0x06c7`,
 * el residuo §7.1 de `re/notes/inn-145-acta.md` («el binario pinta una ventana carácter
 * a carácter y la consola usa su lista de opciones»).
 *
 * Modelo PURO (rejilla de glifos, sin canvas), como `ztats.ts`. La conducta del cursor
 * vive aparte en `core/shops/innRegisterPicker.ts`.
 *
 * ── §1 · La secuencia del binario, instrucción a instrucción ────────────────────────
 *
 * ```
 * 0526  push 1 / call 0x39b4        ; select_text_window(1) = el PANEL derecho
 * 052d  call 0x6d1c                 ; = ULTIMA.EXE 0x4efc: BORRA la banda divisoria y56..63
 * 0530  call 0x3a42(1,0x18,1,0x26,9); set_text_window(1, left=24, top=1, right=38, bot=9)
 * 0547  push 0xff / call 0x34da     ; putchar(0xFF) = LIMPIA ese rectángulo (emisor 0x17bb)
 * 054e  call 0x3a42(1,0x18,1,0x27,9); RE-define el MISMO descriptor con right=39
 * 0565  putchar(0x10)               ; ┌
 * 056c  13× putchar(0x11)           ; ─ (horizontal SUPERIOR)
 * 057e  putchar(0x13)               ; ┐
 * 0588  si=1..7: gotoxy(0,si)+0x17 · gotoxy(0x0e,si)+0x17   ; │ … │
 * 05ae  putchar(0x0a)               ; CRLF → fila 8, col 0
 * 05b5  putchar(0x14) · 13× 0x15 · putchar(0x16)            ; └ ─ ┘
 * 05d5  gotoxy(1,1) / print DS 0x4fc0 `    GUEST`
 * 05e4  gotoxy(1,2) / print DS 0x4fca `  REGISTER:\n\n`
 * 05fb  bucle de nombres (§3)
 * ```
 *
 * ⇒ caja de **15 columnas × 9 filas**: cols 24..38 (x192..311), filas 1..9 (y8..79).
 * Glifos idénticos a los del pergamino de Ztats (`drawListFrame`, `draw_list_frame`
 * 0x045e), que se reutiliza aquí: son DOS implementaciones distintas en el binario
 * —una inline en SHOPPES3, otra en ZSTATS— con la MISMA salida, y las dos miden 15×9
 * con 7 filas de contenido.
 *
 * ── §2 · ★ Por qué el descriptor se re-define UNA COLUMNA MÁS ANCHO ────────────────
 *
 * El `set_text_window` de `0x054e` sólo cambia `right` 38→39 y no se escribe nunca en
 * la columna 39. No es adorno: es para DESACTIVAR el auto-wrap del emisor. `putChar`
 * (kernel 0x16ba) hace `inc [si+4]; al = [si+4]+[si+0]; cmp al,[si+2]; jle no-wrap`
 * (0x1735-0x1740). Con `right=38`, tras escribir la col 14 el cursor queda en 15 y
 * `15+24 = 39 > 38` ⇒ wrap a la fila siguiente. En la fila 8 (el borde INFERIOR) ese
 * wrap llevaría el cursor a la fila 9, y `9+1 = 10 > bot(9)` dispara el SCROLL de
 * `0x1754` — la caja recién dibujada se desplazaría una fila y perdería su tapa. Con
 * `right=39`, `39 ≤ 39` y no hay wrap.
 *
 * Por eso el LIMPIADO (`putchar(0xFF)`) se hace con el descriptor ESTRECHO (right=38):
 * borra exactamente las 15 columnas de la caja, ni una más. Es el mismo rectángulo que
 * `ZTATS_CLEAR_PX` de `skin.ts` ya tenía medido para Ztats/Ready.
 *
 * Como esta rejilla escribe por COORDENADA (no por cursor con wrap), el descriptor que
 * se modela es el estrecho: 15×9. La columna 39 no lleva tinta en ninguno de los dos.
 *
 * ── §3 · El contenido, y de dónde sale cada fila ───────────────────────────────────
 *
 * Cabeceras por `gotoxy` explícito: `    GUEST` en (col 1, fila 1) y `  REGISTER:` en
 * (col 1, fila 2). El `\n\n` que remata la segunda cadena deja el cursor en la fila 4
 * (fila 3 en blanco), y ahí arranca el bucle de nombres:
 *
 * ```
 * 05fb  si = 0x55e7 · di = 0x55c8 · [bp-0x38] = 15      ; 15 registros de 0x20 B
 * 0606  al = [g_location] / cmp [si],al / jne siguiente ; +0x1f = posada donde se aloja
 * 060d  push 4 / call 0x3b0e (text_get_row) / gotoxy(4, fila_actual)
 * 0618  push di / call 0x3670                           ; print_string(NOMBRE)
 * 061c  putchar(0x0a)                                   ; CRLF
 * 0623  si += 0x20 · di += 0x20 · dec [bp-0x38] / jne
 * ```
 *
 * ⇒ los nombres van en la **columna 4** (abs. 28) desde la **fila 4** (abs. 5).
 *
 * ── §4 · ★ La ranura 0 (ficha #50) — CONSISTENTE dentro de la ventana ──────────────
 *
 * El bucle arranca en `0x55e7` con cuenta 15: `0x55e7` es el byte de posada del
 * registro **1**, no del 0 (los registros miden 0x20 B y el del 0 está en `0x55c7`,
 * con su nombre en `0x55a8` — el que la gitana rellena, `gypsy.md:158`). Los dos
 * buscadores del cursor recorren la MISMA población: `0x0494` decrementa y para en 0
 * (`dec dx / je 0x4ac`), `0x04b6` incrementa hasta 0x10 exclusive. O sea que dentro de
 * la ventana el Avatar está fuera de la lista Y fuera de la navegación: son coherentes.
 *
 * Quien NO coincide es el CONTADOR de huéspedes `SHOPPES3:0x0000`, que barre desde
 * `0x55c7` con `cx = 0x10` — 16 registros, ranura 0 INCLUIDA. Si el registro 0 tuviera
 * el byte de posada igual a la localización actual, el contador diría uno más que los
 * nombres pintados. NO se modela: la ranura 0 es el Avatar y su byte vale 0 («en el
 * grupo») mientras se juega; se deja DECLARADO aquí porque es exactamente la asimetría
 * que la ficha #50 mandó vigilar, y porque el propio binario ya la neutraliza — con un
 * solo huésped el atajo `0x070c` llama a `0x04b6(0)`, que también salta la ranura 0, y
 * si devuelve el centinela 0 la convergencia `0x0715` sale sin cobrar.
 *
 * ── §5 · Cuántos nombres CABEN, y qué pasa con el sexto ────────────────────────────
 *
 * Entre la fila 4 y la última fila de barras (la 7) hay **4 huecos**. El original no
 * acota el bucle (15 iteraciones desde `05fb: bee755 mov si, 0x55e7`): el 5º nombre se
 * pinta ENCIMA del borde inferior (fila 8) y ~~el 6º~~ **el CRLF que sigue al QUINTO**
 * dispara el scroll de la ventana.
 *
 * 🔴 La corrección de esa última frase es del carril `ready-picker-fidelidad`; la vieja
 * decía «el 6º» y erraba por uno, lo que hacía leer 5 como el techo sin daño cuando es
 * **4**. Quien dispara es `061c: b80a00 / 0620: call 0x34da` = `putchar('\n')` tras el
 * 5º nombre: `1742: inc byte [si+5]` deja la fila en 9 y `1749: mov al,[si+5] / 174c:
 * add al,[si+1] / 174f: cmp al,[si+3] / 1752: jle 0x1767` compara 9+top(1)=10 contra
 * bot(9) ⇒ NO salta ⇒ `1754: call 0x1f77` = SCROLL. (El valor 4 de
 * `INN_REGISTER_VISIBLE_NAMES` ya era el correcto; la razón escrita al lado, no.)
 *
 * Aquí se pintan los 4 que caben y `overflow` declara el resto, pero la ventana SE
 * DESPLAZA con el cursor (ver `layoutInnRegister`) para no perder nunca la barra. Es un
 * caso degenerado del original (hay que dejar 5+ personajes en LA MISMA posada), no una
 * regla que calcar al píxel.
 *
 * ── §6 · La barra de selección ─────────────────────────────────────────────────────
 *
 * `0x064d` empuja `(0xc6, di, 0x131, di+7)` a `0x29a6` (= ULTIMA.EXE 0x0b86, el
 * rectángulo XOR del driver: `stc` + fn 0x3f, frente al `clc` del relleno opaco
 * 0x0aa6). `di` arranca en `0x28` = 40 px = fila 5 — la fila del PRIMER nombre, lo que
 * confirma la aritmética de §3 por un camino independiente — y se mueve ±8 con cada
 * salto de huésped (`0x069b sub di,8` / `0x06c3 add di,8`).
 *
 * El span x 198..305 no está alineado a celda: entra 2 px en el borde izquierdo
 * (col 24 = x192..199) y 2 px en el derecho (col 38 = x304..311). Se conserva tal cual.
 * Sobre un área de DOS colores (glifo blanco sobre fondo negro) el XOR con blanco es
 * exactamente el vídeo inverso, así que la piel lo pinta como «relleno blanco + los
 * glifos que solapan, en negro, recortados a la barra» — equivalencia argumentada, no
 * una aproximación de conveniencia.
 */
import { TextWindow, type WindowRect } from "./textwindow.js";
import { drawListFrame } from "./ztats.js";

/**
 * Descriptor de la ventana (§2: el ESTRECHO, `set_text_window(1,0x18,1,0x26,9)` de
 * `0x0530`, que es el que fija el rectángulo con tinta y el que se limpia).
 */
export const INN_REGISTER_RECT: WindowRect = {
  leftCol: 24,
  topRow: 1,
  rightCol: 38,
  botRow: 9,
};

/** Filas de barras verticales entre las dos tapas (`si = 1..7` de `0x0588`). */
export const INN_REGISTER_CONTENT_ROWS = 7;

/** Cabeceras VERBATIM de DATA.OVL — DS 0x4fc0 y DS 0x4fca sin su `\n\n` final. */
const HEADER_GUEST = "    GUEST"; // DS 0x4fc0, impreso en (1,1) por 0x05dd
const HEADER_REGISTER = "  REGISTER:"; // DS 0x4fca, impreso en (1,2) por 0x05ef

/** Columna de los nombres dentro de la ventana (`gotoxy(4, fila)` de 0x0610). */
export const INN_REGISTER_NAME_COL = 4;
/**
 * Primera fila de nombre, RELATIVA a la ventana: `  REGISTER:\n\n` se imprime en la
 * fila 2 y sus dos CRLF dejan el cursor en la 4 (la 3 queda en blanco).
 */
export const INN_REGISTER_FIRST_NAME_ROW = 4;
/** Nombres que caben sin pisar el borde inferior (§5): filas 4,5,6,7. */
export const INN_REGISTER_VISIBLE_NAMES =
  INN_REGISTER_CONTENT_ROWS + 1 - INN_REGISTER_FIRST_NAME_ROW;

/**
 * Barra XOR de selección en PÍXELES (§6): `push 0xc6 / push di / push 0x131 /
 * lea ax,[di+7]` en `0x064d`. `x1`/`y1` son INCLUSIVOS, como los del driver.
 */
export const INN_REGISTER_BAR_X0 = 0xc6; // 198
export const INN_REGISTER_BAR_X1 = 0x131; // 305
export const INN_REGISTER_BAR_HEIGHT = 8; // di..di+7

/**
 * `y` de la barra para el k-ésimo huésped visible. Con k=0 sale `0x28` = 40, el valor
 * literal con el que `0x0643 mov di,0x28` inicializa el rectángulo.
 */
export function innRegisterBarY(visibleIndex: number): number {
  return (INN_REGISTER_RECT.topRow + INN_REGISTER_FIRST_NAME_ROW + visibleIndex) * 8;
}

/** Lo que la piel necesita saber para pintar la ventana. */
export interface InnRegisterView {
  /** Nombres de los huéspedes alojados aquí, en orden de roster (ranura 0 excluida). */
  guests: readonly string[];
  /** Huésped resaltado por la barra XOR (índice dentro de `guests`). */
  cursor: number;
}

export interface InnRegisterLayout {
  cells: Uint8Array;
  cols: number;
  rows: number;
  rect: WindowRect;
  /** Fila visible (0-based) sobre la que va la barra, o `null` si el cursor no cabe. */
  barIndex: number | null;
  /** Huéspedes que no caben en la ventana (§5). */
  overflow: number;
}

/**
 * Compone la rejilla de la ventana: marco + las dos cabeceras + los nombres que caben.
 */
export function layoutInnRegister(view: InnRegisterView): InnRegisterLayout {
  const win = new TextWindow(INN_REGISTER_RECT);
  drawListFrame(win, INN_REGISTER_CONTENT_ROWS);

  const put = (row: number, col: number, text: string): void => {
    for (let i = 0; i < text.length; i++) {
      const c = col + i;
      if (c < 0 || c >= win.cols || row < 0 || row >= win.rows) continue;
      win.cells[row * win.cols + c] = text.charCodeAt(i);
    }
  };
  // Las dos van a la col 1 (`gotoxy(1,1)` / `gotoxy(1,2)`); el sangrado de cada rótulo
  // viaja DENTRO de la cadena de DATA.OVL, no en la coordenada.
  put(1, 1, HEADER_GUEST);
  put(2, 1, HEADER_REGISTER);

  // 🔴 Con más huéspedes que huecos, esta ventana era FIJA en los 4 primeros y el
  // `barIndex` se iba a `null` en cuanto el cursor pasaba del 4º: la barra DESAPARECÍA
  // (`drawInnRegister` hace `if (barIndex == null) return`) y el jugador confirmaba a
  // un huésped que no veía marcado. El original nunca pierde la barra —`06c3: 83c708
  // add di, 8` la sigue bajando— y su ventana SÍ se desplaza: el `putchar(0x0a)` que
  // sigue al 5º nombre (`061c: b80a00` → `0620: call 0x34da`) deja la fila en 9, y
  // `1749: mov al,[si+5] / 174c: add al,[si+1] / 174f: cmp al,[si+3] / 1752: jle` da
  // 9+1=10 > bot=9 ⇒ `1754: call 0x1f77` = SCROLL. Así que se desplaza la ventana de 4
  // para que el cursor esté SIEMPRE dentro: es lo que hace el binario (degradar
  // desplazando) y elimina la selección invisible. Los nombres que quedan fuera los
  // sigue declarando `overflow`.
  const capacity = INN_REGISTER_VISIBLE_NAMES;
  const cursor = Math.max(0, Math.min(view.cursor, view.guests.length - 1));
  const start = Math.max(0, Math.min(cursor - capacity + 1, view.guests.length - capacity));
  const visible = Math.min(view.guests.length - start, capacity);
  for (let k = 0; k < visible; k++) {
    put(
      INN_REGISTER_FIRST_NAME_ROW + k,
      INN_REGISTER_NAME_COL,
      view.guests[start + k] ?? "",
    );
  }
  const barIndex = view.cursor >= 0 && view.cursor < view.guests.length ? cursor - start : null;
  return {
    cells: win.cells,
    cols: win.cols,
    rows: win.rows,
    rect: INN_REGISTER_RECT,
    barIndex,
    overflow: Math.max(0, view.guests.length - capacity),
  };
}
