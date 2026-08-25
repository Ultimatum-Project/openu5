/**
 * REMATE ►◄ DE BANDA — la pieza que comparten el motor del juego (piel fiel) y el
 * chrome del shell (`ui/shell/originalFrame.ts`). Vive en su PROPIO módulo, sin un solo
 * import, por dos razones que no son de estilo:
 *
 *   1. **Compartir, no imitar.** Hasta el 14-08 `originalFrame.ts` llevaba una COPIA
 *      literal de los dos bitmaps («copia literal citada», decía su comentario) y su
 *      propio pintor. Dos copias de una geometría es una que se corrige y otra que no:
 *      la del shell se desalineó y salió por el reporte #263 («el menú SYSTEM debería
 *      ser igual que el de los winds del UI»). Con el pintor compartido, quien mueva un
 *      píxel del remate lo mueve en los dos sitios o en ninguno.
 *   2. **Módulo sin grafo.** El shell NO puede importar de `fiel/skin.ts` para llevarse
 *      dos arrays: ese fichero arrastra el motor de la piel entera al bundle (la lección
 *      de los 477 KB colados por un import). Aquí no hay nada que arrastrar.
 *
 * DERIVACIÓN (ULTIMA.EXE `draw_box_edge_left 0x4c2a` / `draw_box_edge_right 0x4cce`):
 * pinta el GLIFO IBM.CH **0x02** (►, punta en la col 5) / **0x01** (◄) en el azul del
 * marco (`g_unk_13b2`) y le traza ENCIMA el filo de ataque con dos líneas blancas
 * (`g_unk_13b0`) hasta `(x+5, y+3/4)`. O sea el remate es el triángulo 0x02 —más CORTO
 * que el bullet de eco de consola—, no el ► lleno. Verificado al píxel contra la captura
 * nativa `_pixeldiff/samestate/orig/town_day.png` (celda del ►: `B·/BWW/BBBWW/BBBBBW…`).
 *
 * `BAND_BRACKET_BLUE` = relleno del glifo 0x02 MENOS el filo blanco y MENOS la col BASE
 * (col 0 del ►): la base es el propio borde azul del marco, ya pintado, así que no se
 * repinta — y por eso las filas 0/7 quedan intactas. `BAND_BRACKET_WHITE` = el filo de
 * ataque (las dos líneas del asm). Unión de ambos ∪ col-base = glifo 0x02. Cada byte =
 * 1 fila, bit 7 = col 0.
 */

export const BAND_BRACKET_BLUE: readonly number[] = [0x00, 0x00, 0x60, 0x78, 0x78, 0x60, 0x00, 0x00];
export const BAND_BRACKET_WHITE: readonly number[] = [0x00, 0x60, 0x18, 0x04, 0x04, 0x18, 0x60, 0x00];

/** Azul EGA idx1 del marco (`frame.ts` DEFAULT_FRAME_COLORS) y su filo blanco. */
export const BAND_BRACKET_FILL = "#0000aa";
export const BAND_BRACKET_EDGE = "#ffffff";

/**
 * Pinta el remate ►◄ de una banda en la celda (x,y) de 8×8: primero ENNEGRECE el hueco
 * del notch (las 7 columnas del lado interior, hacia el texto — dejando la col BASE con
 * el borde del marco), luego traza el filo blanco + el relleno azul del glifo 0x02.
 * `mirror` = ◄ (glifo 0x01): espeja horizontalmente y ennegrece a la IZQUIERDA (la base
 * queda a la derecha, pegada al borde). Reproduce `draw_box_edge`.
 *
 * ★ EL NOTCH NEGRO ES LA MITAD QUE HACE QUE EL REMATE EMPALME, y por eso el pintor no se
 * puede «simplificar» a los dos bitmaps. Medido sobre la cinta ►Calm Winds◄ del juego
 * (búfer nativo 320×200, fila 23 = y 184..191): la regla blanca del marco corre por la
 * fila 0 de la banda hasta la col BASE del ► INCLUIDA (x=48), el notch la borra en las 7
 * columnas interiores, y el brazo del filo arranca en (49,185) — diagonalmente pegado al
 * final de la regla. Un remate que se pinte SIN ennegrecer el notch tiene que inventarse
 * sus propias reglas de una celda de ancho, y entonces el chevron flota en mitad de la
 * banda: ése era exactamente el defecto del shell en #263.
 */
export function drawBandBracket(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  mirror = false,
): void {
  ctx.fillStyle = "#000000";
  ctx.fillRect(x + (mirror ? 0 : 1), y, 7, 8);
  const paint = (rows: readonly number[], color: string): void => {
    ctx.fillStyle = color;
    for (let r = 0; r < 8; r++) {
      const bits = rows[r]!;
      for (let c = 0; c < 8; c++) {
        if ((bits >> (7 - c)) & 1) ctx.fillRect(x + (mirror ? 7 - c : c), y + r, 1, 1);
      }
    }
  };
  paint(BAND_BRACKET_WHITE, BAND_BRACKET_EDGE); // filo de ataque (líneas del asm)
  paint(BAND_BRACKET_BLUE, BAND_BRACKET_FILL); // relleno azul del glifo 0x02
}
