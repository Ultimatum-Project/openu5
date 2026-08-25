/**
 * Reductor GENÉRICO del bucle interactivo `item_page_controller` (ZSTATS.OVL @0x0f2e)
 * — auditoría de calidad MANT-4/D1: los reductores de READY (mode 'R' 0x52) y (U)se
 * (mode 'U' 0x55) eran copias carácter a carácter del MISMO controller del binario;
 * un fix de fidelidad en scroll/clamp aplicado en uno no se propagaba al otro. Este
 * módulo calca el controller UNA vez, parametrizado por lo único que difiere entre
 * modos: la semántica de ENTER (que decide el CALLER: Ready equipa in situ, Use
 * devuelve el id y cierra — @0x1230) y las filas visibles de la ventana.
 *
 * `shopArmsKey` (shops/shopArmsPicker.ts) NO se unifica aquí: deriva de OTRA rutina
 * del binario (`list_wares` SHOPPES.OVL 0x0c80, ventana de 4 filas y teclado más
 * corto) — sólo comparte el clamp de scroll (matiz del verdict MANT-4).
 */

/** Posición del picker: fila bajo el cursor + primer ítem visible (scroll). */
export interface ItemPageModel {
  cursor: number;
  scroll: number;
}

/**
 * Mantiene el cursor dentro de la ventana visible (scroll mínimo). Compartido por
 * los tres pickers (ready/use por el controller; shop-arms por su list_wares).
 */
export function clampScroll(cursor: number, scroll: number, visibleRows: number): number {
  let s = scroll;
  if (cursor < s) s = cursor;
  if (cursor > s + visibleRows - 1) s = cursor - visibleRows + 1;
  return Math.max(0, s);
}

/** Resultado genérico: el caller re-etiqueta `enter` con su verbo (equip/use). */
export type ItemPageAction =
  /** La tecla no cambió nada (el modal la traga; getkey re-lee). */
  | { kind: "none" }
  /** El cursor/scroll se movió → repinta. */
  | { kind: "move"; model: ItemPageModel }
  /** RETURN (0x0d) / Space (0x20) sobre `index` (la acción del modo, @0x1230). */
  | { kind: "enter"; index: number }
  /** ESC (0x1b) → cierre (@0x1244; el caller imprime "Done"/"None!" según modo). */
  | { kind: "close" };

/**
 * Navegación del controller (@0x0f2e): ↑/↓ mueven UNA fila; PgUp/PgDn una página;
 * Home/End a los bordes. Sin wrap (clamp en los extremos). Con `rowCount<=0` todo
 * cierra (defensivo — los callers no abren el overlay sin filas).
 */
export function itemPageKey(
  model: ItemPageModel,
  key: string,
  rowCount: number,
  visibleRows: number,
): ItemPageAction {
  if (rowCount <= 0) return { kind: "close" };
  const moveTo = (raw: number): ItemPageAction => {
    const cursor = Math.max(0, Math.min(rowCount - 1, raw));
    if (cursor === model.cursor) return { kind: "none" };
    return {
      kind: "move",
      model: { cursor, scroll: clampScroll(cursor, model.scroll, visibleRows) },
    };
  };
  switch (key) {
    case "ArrowUp":
    case "Up":
      return moveTo(model.cursor - 1);
    case "ArrowDown":
    case "Down":
      return moveTo(model.cursor + 1);
    case "PageUp":
      return moveTo(model.cursor - visibleRows);
    case "PageDown":
      return moveTo(model.cursor + visibleRows);
    case "Home":
      return moveTo(0);
    case "End":
      return moveTo(rowCount - 1);
    case "Enter":
    case " ":
    case "Spacebar":
      return { kind: "enter", index: model.cursor };
    case "Escape":
      return { kind: "close" };
    default:
      return { kind: "none" };
  }
}
