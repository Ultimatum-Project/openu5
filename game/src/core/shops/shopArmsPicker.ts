/**
 * Selector de la ventana «Arms» de VENTA del herrero — MODELO PURO de teclas (sin
 * DOM ni estado del juego). Calca el bucle de `list_wares` (SHOPPES.OVL 0x0c80) en
 * su uso por el flujo SELL del herrero: ventana enmarcada en el panel derecho con la
 * lista PAGINADA del equipo poseído (página de 4 filas, rel 1..4 — ver nota de
 * SHOP_ARMS_VISIBLE_ROWS),
 * barra de selección en vídeo inverso que se mueve con ↑/↓, RETURN elige el ítem
 * bajo la barra (venta) y Space/ESC cancelan (vuelta al menú Buy/Sell). El glifo de
 * banda ▼0x19/▲0x18/↕0x12 lo deriva la piel de (scroll, total) — flag @0x0dde-0x0e1d
 * (+2 prev, +1 next), tapas de ULTIMA.EXE (0xffffa99a/aa3e).
 *
 * Reparto (patrón `readyPicker.ts`/`mixReagentPicker.ts`):
 *   · Este módulo: navegación del cursor + acciones (pick/close).
 *   · `ui/shop-console.ts`: qué filas se listan (equipo vendible) y la venta en sí
 *     (`sellEquipment`, core/shops/shops.ts — mecánica byte-fiel intacta).
 *   · `main.ts` (`openArmsPicker`): publica `ReadyPickerView` variante "shop".
 *   · La piel fiel (`skin/fiel/ready.ts`): marco + filas `N-Abbrev` + banda.
 * Derivación completa del lead + testigo clip #31: re/notes/yt-careo-tickets.md
 * §TICKET-004 B (frame `av-referencia/yt/clips/weapon-shop/frames/arms_sell_list.png`).
 */
import { clampScroll } from "../itemPageController.js";

/**
 * Filas de contenido visibles por página = **4** (CORRECCIÓN carril buy-herrero,
 * 2026-07-22; antes 5): en `list_wares` el cursor arranca en la fila REL 1 de la
 * ventana (`set_cursor(1,1)` @0x0d43), cada ítem imprime y baja una fila, y el bucle
 * CORTA cuando la fila llega a 5 (@0x0d9d `cmp ax,5`) ⇒ filas de contenido rel 1..4.
 * El `cmp si,5` @0x0dd6 es el bucle de RELLENO de esas mismas filas (pad DS 0x7c50)
 * — se leyó como "5 filas" por error. Careo por rejilla de 8 px sobre el testigo
 * clip #31 (`arms_sell_list.png`): borde sup fila 1, contenido filas 2-5, borde inf
 * fila 6, banda ↕ fila 7 (blue-bar), caja F/G filas 8-9 — con 5 filas la banda
 * pisaba la caja F/G del original.
 */
export const SHOP_ARMS_VISIBLE_ROWS = 4;

/** Posición del selector: fila bajo la barra + primer ítem visible (scroll). */
export interface ShopArmsModel {
  /** Índice ABSOLUTO en las filas del ítem bajo la barra de selección. */
  cursor: number;
  /** Índice del primer ítem visible (ventana de 4 filas). */
  scroll: number;
}

/** Acción que el reductor devuelve al caller (main.ts la ejecuta). */
export type ShopArmsAction =
  /** La tecla no cambió nada (el modal la traga). */
  | { kind: "none" }
  /** El cursor/scroll se movió → repinta. */
  | { kind: "move"; model: ShopArmsModel }
  /** RETURN sobre `index`: vender el ítem bajo la barra. */
  | { kind: "pick"; index: number }
  /** Space/ESC: cerrar la ventana y volver al menú Buy/Sell. */
  | { kind: "close" };

/** Estado inicial: barra en el primer ítem, sin scroll. */
export function initShopArmsPicker(): ShopArmsModel {
  return { cursor: 0, scroll: 0 };
}

// El clamp de scroll es el compartido de itemPageController (D1: estaba copiado ×3).
// El RESTO del reductor NO se unifica: list_wares es OTRA rutina del binario
// (ventana de 4 filas, teclado más corto, Space=cancel) — matiz del verdict MANT-4.

/**
 * Reductor de teclas de la ventana «Arms» (encargo T-004b): ↑/↓ mueven UNA fila con
 * scroll de página de 4 (sin wrap, clamp en los extremos); RETURN → `pick` del ítem
 * del cursor; Space/ESC → `close` (menú Buy/Sell). Otras teclas: `none` (el modal
 * las traga). Con `rowCount<=0` sólo funciona cancelar (defensivo; el conductor no
 * abre la ventana sin filas).
 */
export function shopArmsKey(
  model: ShopArmsModel,
  key: string,
  rowCount: number,
): ShopArmsAction {
  const moveTo = (raw: number): ShopArmsAction => {
    if (rowCount <= 0) return { kind: "none" };
    const cursor = Math.max(0, Math.min(rowCount - 1, raw));
    if (cursor === model.cursor) return { kind: "none" };
    return {
      kind: "move",
      model: { cursor, scroll: clampScroll(cursor, model.scroll, SHOP_ARMS_VISIBLE_ROWS) },
    };
  };
  switch (key) {
    case "ArrowUp":
    case "Up":
      return moveTo(model.cursor - 1);
    case "ArrowDown":
    case "Down":
      return moveTo(model.cursor + 1);
    case "Enter":
      return rowCount > 0 ? { kind: "pick", index: model.cursor } : { kind: "none" };
    case " ":
    case "Spacebar":
    case "Escape":
      return { kind: "close" };
    default:
      return { kind: "none" };
  }
}
