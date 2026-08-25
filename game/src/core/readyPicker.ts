/**
 * Picker de ítems del comando READY — MODELO PURO (sin DOM, sin estado del juego).
 *
 * Calca el bucle interactivo `item_page_controller` (ZSTATS.OVL @0x0f2e, modo 'R')
 * que abre `cmd_ready` (@0x1296): un OVERLAY DE PERGAMINO sobre el panel derecho con
 * los ítems equipables POSEÍDOS por el personaje, una barra de selección que se mueve
 * con las flechas, y RETURN/Space que equipa/desequipa EN EL SITIO. NO es el scroller
 * de consola que el clon tenía (esa UI era inventada). Ver re/notes/zstats.md §Ready y
 * re/disasm/ZSTATS.OVL.asm.
 *
 * Reparto de responsabilidades (fidelidad de presentación, task #78):
 *   · Este módulo: qué ítems se listan, su formato de fila, y la navegación del cursor.
 *   · `core/equip.ts` (`equipItem`, ya derivado en Task 3.12): la MECÁNICA de equipar
 *     (encumbrance, ammo-gate, dos manos, ring 1/16). Aquí NO se re-deriva.
 *   · `main.ts`: aplica la acción `equip` sobre `game` y re-construye las filas.
 *   · La piel fiel (`skin/fiel/ready.ts`): pinta el marco + filas + cursor + flechas.
 */
import { itemPageKey } from "./itemPageController.js";

/**
 * Nº de ítems del array de cantidades de armamento (g_equip_qty, `cmd_ready` empuja
 * 0x30 como tamaño de tabla en @0x12ad). El picker recorre los índices 0..47.
 */
const READY_ITEM_COUNT = 0x30;

/**
 * Filas de contenido visibles a la vez = **7** (`draw_list_frame(8)` en @0x12ee pinta
 * las barras en las filas 1..7; el bucle de relleno corta al llegar a la fila 8, y
 * PgUp/PgDn fija literalmente 7). Igual que las sub-páginas de Ztats (`ZTATS_LIST_ROWS`).
 */
export const READY_VISIBLE_ROWS = 7;

/**
 * Glifo de CLASE por ítem (DATA.OVL DS 0x1ae8, 48 bytes, volcado verbatim). El picker
 * lo usa como SEPARADOR de la fila —la celda entre la cuenta y el nombre— sólo cuando
 * el ítem está equipado (`item_page_controller` @0x1064: si `is_item_equipped`, empuja
 * `byte[item+0x1ae8]` como 4º argumento de `print_list_row`; si no, un 0x20). Los
 * cascos (0-3) comparten 0x01, los escudos (4-8) 0x02, las armaduras (9-15) 0x03; las
 * armas llevan glifo propio.
 *
 * 🔴 Esta línea decía «Son códigos CP437 (todos <0x20 → el original los imprime con
 * REALCE, @0x0615)» y las DOS mitades eran falsas, con la misma raíz: el rótulo
 * `set_highlight` que #149 refutó y que aquí sobrevivió porque este fichero no se tocó.
 *   · @0x0615 no es un realce: es `cmp [bp+4],0x20 / jae` + `set_font(1)` … `set_font(0)`
 *     (el thunk 0x3abe = kernel 0x1c9e, que conmuta el BANCO DE FUENTE `[0x5398]`).
 *   · y por tanto NO son códigos CP437: indexan **RUNES.CH**, cuya banda de control
 *     0x00-0x1f lleva dingbats, no el arte de caja de IBM.CH. El testigo del corpus lo
 *     enseñaba desde antes: la fila `--♥Chain` del picker, con Chain = id 0x0d y
 *     `READY_GLYPH_TABLE[0x0d] = 0x03` — ♥ es `RUNES.CH[0x03]`; `IBM.CH[0x03]` es un
 *     triángulo. La piel ya lo pintaba bien; era la EXPLICACIÓN la que estaba mal, y
 *     con ella no había forma de saber de qué banco sale el glifo.
 * Ver `re/notes/ready-picker-panel.md` §3 y `re/notes/use-picker-panel.md` §5.
 */
// prettier-ignore
export const READY_GLYPH_TABLE: readonly number[] = [
  0x01, 0x01, 0x01, 0x01, 0x02, 0x02, 0x02, 0x02, 0x02, 0x03, 0x03, 0x03,
  0x03, 0x03, 0x03, 0x03, 0x04, 0x05, 0x06, 0x07, 0x04, 0x08, 0x09, 0x0b,
  0x0c, 0x1e, 0x0f, 0x17, 0x10, 0x17, 0x0b, 0x11, 0x12, 0x13, 0x14, 0x15,
  0x16, 0x15, 0x17, 0x15, 0x15, 0x15, 0x18, 0x18, 0x18, 0x19, 0x1a, 0x1b,
];

/** Una fila del picker (un ítem poseído o equipado). */
export interface ReadyPickerRow {
  /** Índice del ítem en el array de armamento (0..47). */
  equipId: number;
  /** Nombre visible (name-table 0x1962; la cadena exacta es Clase C — ver notas). */
  name: string;
  /**
   * Cantidad en el PACK (`g_equip_qty[id]`). 0 → se pinta "--" (0x9778). Un ítem
   * equipado del que ya no queda ninguno en el pack cae aquí (el caso del testigo:
   * "--♥Chain"); si queda alguno suelto, muestra la cuenta.
   */
  qty: number;
  /** ¿Equipado en alguno de los 6 slots del PJ? Añade el glifo de clase realzado. */
  equipped: boolean;
  /** Glifo de clase (`READY_GLYPH_TABLE[id]`); sólo se pinta si `equipped`. */
  glyph: number;
}

/** Dependencias del constructor de filas (main.ts las cablea al estado del juego). */
export interface ReadyRowDeps {
  /** `g_equip_qty[id]` — unidades sueltas en el pack. */
  qtyOf(equipId: number): number;
  /** ¿El PJ lleva `id` puesto? (`is_item_equipped` @0x0518). */
  isEquipped(equipId: number): boolean;
  /** Nombre visible del ítem. */
  nameOf(equipId: number): string;
}

/**
 * Filas del picker para el personaje elegido: los índices 0..47 que están POSEÍDOS
 * (qty>0) O EQUIPADOS por el PJ, en orden de id ascendente. Calca `find_next_owned`
 * (@0x05a4) con el argumento charIdx (≠0xff), que incluye los equipados de cuenta 0.
 * Lista vacía → `cmd_ready` imprime "Thou art empty-handed!" (el caller lo detecta).
 */
export function buildReadyRows(deps: ReadyRowDeps): ReadyPickerRow[] {
  const rows: ReadyPickerRow[] = [];
  for (let id = 0; id < READY_ITEM_COUNT; id++) {
    const qty = deps.qtyOf(id);
    const equipped = deps.isEquipped(id);
    if (qty <= 0 && !equipped) continue;
    rows.push({
      equipId: id,
      name: deps.nameOf(id),
      qty: Math.max(0, qty),
      equipped,
      glyph: READY_GLYPH_TABLE[id] ?? 0,
    });
  }
  return rows;
}

/** Posición del picker: fila bajo el cursor + primer ítem visible (scroll). */
export interface ReadyPickerModel {
  /** Índice ABSOLUTO en `rows` del ítem bajo la barra de selección. */
  cursor: number;
  /** Índice del primer ítem visible (ventana de 7 filas). */
  scroll: number;
}

/** Acción que el reductor devuelve al caller (main.ts la ejecuta). */
export type ReadyPickerAction =
  /** La tecla no cambió nada (el modal la traga; getkey re-lee). */
  | { kind: "none" }
  /** El cursor/scroll se movió → repinta. */
  | { kind: "move"; model: ReadyPickerModel }
  /** RETURN/Space sobre `index`: equipar/desequipar in situ (el picker sigue abierto). */
  | { kind: "equip"; index: number }
  /** ESC: cerrar el picker (imprime "Done"). */
  | { kind: "close" };

/** Estado inicial: cursor en el primer ítem, sin scroll. */
export function initReadyPicker(): ReadyPickerModel {
  return { cursor: 0, scroll: 0 };
}

/**
 * Reductor de teclas del picker (`item_page_controller` @0x0f2e, modo 'R'):
 *   · ↑/↓ mueven el cursor UNA fila (get_extended_key 3/4, @0x1091/0x10a3); PgUp/PgDn
 *     lo mueven 7 (0xd5/0xd6, @0x10c0/0x1130 con paso 7); Home/End saltan a los bordes
 *     (0xd3/0xd4, @0x11c0/0x11dc). Sin wrap: se detiene en los extremos (clamp).
 *   · RETURN (0x0d) o Space (0x20) → `equip` sobre el ítem del cursor (@0x121c → 0xc5c);
 *     el picker NO se cierra (la mecánica redibuja la fila con "--"+glifo).
 *   · ESC (0x1b) → `close` (@0x1238 imprime "Done", devuelve -1).
 * Con `rowCount<=0` (defensivo) todo cierra.
 *
 * La navegación vive en el reductor GENÉRICO del controller (`itemPageController.ts`,
 * MANT-4/D1): aquí sólo se re-etiqueta `enter` con el verbo del modo 'R' (equip).
 */
export function readyPickerKey(
  model: ReadyPickerModel,
  key: string,
  rowCount: number,
): ReadyPickerAction {
  const r = itemPageKey(model, key, rowCount, READY_VISIBLE_ROWS);
  return r.kind === "enter" ? { kind: "equip", index: r.index } : r;
}

// (El indicador de flechas de scroll vive en la piel: `readyArrowGlyph` de
// skin/fiel/ready.ts, que calca item_page_controller @0x0806/0x0810/0x0816 con
// glifos CP437 y visible-rows por variante. La copia `readyScrollArrows` que
// vivía aquí era ZOMBI — sólo la importaban sus tests y ya había divergido de la
// versión viva — retirada en la auditoría de calidad D6.)
