/**
 * Picker de ítems del comando (U)se — MODELO PURO (sin DOM, sin estado del juego).
 *
 * Calca el bucle interactivo `item_page_controller` (ZSTATS.OVL @0x0f2e) en **modo 'U'
 * (0x55)**, que abre `cmd_use_item` (CAST.OVL @0x1792). Es EL MISMO overlay de pergamino
 * que Ready (mode 'R' 0x52), con tres diferencias derivadas del binario:
 *   1. Tabla EXTENDIDA (`build_extended_item_table` @0x099a → 0xB9EE, 38 entradas) en
 *      vez de la de equipo (0x57C0, 48): scrolls(0-7), potions(8-0xf), carpet(0x10),
 *      skull key(0x11), amulet(0x12), crown(0x13), sceptre(0x14), moonstones(0x15-0x1c),
 *      shards(0x1d-0x1f), spyglass(0x20), plans/HMS Cape(0x21), sextant(0x22), watch(0x23),
 *      badge(0x24), box(0x25). Orden = orden de la tabla.
 *   2. ENTER (@0x1230, mode≠'R') CIERRA el picker y DEVUELVE el id elegido al llamador
 *      (CAST lo despacha por su jump-table @0x185d); NO equipa in situ como Ready.
 *   3. ESC (@0x1244) imprime "None!\n" (DS 0x9976) en vez de "Done" (0x9970).
 *
 * Reparto de responsabilidades (fidelidad de presentación, gemelo de `core/readyPicker.ts`):
 *   · Este módulo: qué ítems se listan (los POSEÍDOS), su orden y la navegación del cursor.
 *   · `game.useXxx()` (Task #52 / #22): la MECÁNICA de cada verbo (ya derivada). Aquí no.
 *   · `main.ts`: despacha la acción `use` sobre `game` y cierra el overlay.
 *   · La piel fiel reusa el renderer de Ready (`skin/fiel/ready.ts`) vía `setReadyPicker`.
 *
 * Ver re/notes/use-merchants.md §Use y re/disasm/{CAST,ZSTATS}.OVL.asm.
 */
import { itemPageKey } from "./itemPageController.js";

/** Filas de contenido visibles a la vez = 7 (`draw_list_frame(8)`; igual que Ready). */
export const USE_VISIBLE_ROWS = 7;

/**
 * Nombres de fila del picker de (U)se — **VOLCADO byte a byte de la name-table
 * DS 0x1916** (DATA.OVL `fileoff = DS + 0x10`; 38 word-ptrs, uno por entrada de
 * la tabla extendida 0xB9EE). Los imprime `print_list_row` @0x05e2 por su rama
 * «otro» (0x06ac, `print_string(name)` tal cual), así que la fila del original ES
 * esta cadena: no hay composición ni abreviatura nuestra que valga.
 *
 * 🔴 CORRECCIÓN (carril usepicker-fidelidad, careo side-by-side contra DOSBox,
 * divergencia D2): esta tabla llevaba nombres LARGOS inventados para el (U)se DOM
 * previo (`Carpet`/`Skull Key`/`Watch`/`Badge`/`Box`/`Plans`/`Shard of …`) que NO
 * son los del binario. El original pinta `Magic Crpt`/`Skull Keys`/`Pocket Watch`/
 * `Black Badge`/`Wooden Box`/`HMS Cape Plan`/`Shard/Falsehd`… — las abreviaturas
 * están DICTADAS por el ancho del pergamino (13 celdas de contenido, ver el
 * relleno a la celda 14 en `print_list_row` @0x06b9): el más largo de los ocultos
 * mide 13 justas (`Shard/Cowrdce`, `HMS Cape Plan`) y el más largo de los
 * contables mide 10 (`Magic Crpt`, `Skull Keys`), que con la cuenta de 2 díg. y el
 * separador vuelven a dar 13. Los nombres largos NO caben: se truncaban.
 *
 * Es la MISMA tabla que ya volcó el visor de Ztats (`coreview.buildQuestList`,
 * lista 0xf) — el picker de (U)se y esa lista comparten name-table 0x1916, tabla
 * de cuentas 0xB9EE y rutina de fila `print_list_row`; sólo cambia el separador
 * (ver `USE_ROW_SEP`).
 *
 * ALLOWLISTADA en `tools/extract-user-strings.mjs` (DISPLAY_CONSTS): el sink
 * `name:` de las filas NO lo ve el barrido normal (mismo blind-spot que cazó
 * LOOT_OPEN_NAMES en soak b15, y que dejó los 3 Shards EN INGLÉS bajo ES —
 * auditoría de calidad G2). Cada valor queda así bajo la guarda anti-fabricación
 * (approved-strings) y es key traducible del choke t() de la piel.
 */
const USE_ITEM_NAMES = {
  carpet: "Magic Crpt",
  skullKey: "Skull Keys",
  amulet: "Amulet",
  crown: "Crown",
  sceptre: "Sceptre",
  shardFalsehood: "Shard/Falsehd",
  shardHatred: "Shard/Hatred",
  shardCowardice: "Shard/Cowrdce",
  spyglass: "Spyglass",
  hmsCape: "HMS Cape Plan",
  sextant: "Sextant",
  pocketWatch: "Pocket Watch",
  blackBadge: "Black Badge",
  woodenBox: "Wooden Box",
} as const;

/**
 * Nombres de fila de los PERGAMINOS (ids 0x00-0x07 de la tabla extendida), name-table
 * 0x1916 verbatim: el primer byte `*` (0x2a) es un **sigilo de FORMATO** que
 * `print_list_row` @0x0638 consume para pintar la decoración DS 0x977c (glifo 0x1c +
 * `" + "`) antes del código rúnico. NO son prosa: son las siglas del hechizo del
 * pergamino (`VL` = Vas Lor…), neutras de idioma. Se emiten CON el sigilo, como ya
 * hace el adaptador de la lista 0xf de Ztats, para que la maquinaria de decoración
 * de `listRowCells` (skin/fiel/ztats.ts §5.3) sea UNA sola.
 */
export const USE_SCROLL_ROW_NAMES = [
  "*VL", "*RH", "*IS", "*IA", "*IQW", "*KXC", "*IMC", "*AT",
] as const;

/**
 * Nombres de fila de las POCIONES (ids 0x08-0x0f), name-table 0x1916: la entrada del
 * binario es el sigilo `!` (0x21) A SECAS, y `print_list_row` @0x0664 pinta la
 * decoración DS 0x9782 (glifo 0x1d + `" + "`) y luego la cadena-LADO
 * `[fila*2 + 0x19B2]`, que para las filas 8-15 aterriza en los COLORES DS 0x19C2
 * (`Blue`…`White`, volcados). Aquí el color viaja ya pegado tras el sigilo (misma
 * convención que `coreview.POTION_SIGIL_NAMES`) para no duplicar la tabla-lado.
 */
export const USE_POTION_ROW_NAMES = [
  "!Blue", "!Yellow", "!Red", "!Green", "!Orange", "!Purple", "!Black", "!White",
] as const;

/**
 * Nombre de fila de una GEMA LUNAR por fase (ids 0x15-0x1c): entrada `(N` de la
 * name-table 0x1916 (`(0`…`(7`), cuyo sigilo `(` (0x28) hace que
 * `print_list_row` @0x068e pinte DS 0x9788 (`"Moonstone "`) y luego UN solo glifo,
 * el `name[1]` = el dígito de la fase.
 */
export function useMoonstoneRowName(phase: number): string {
  return `(${phase}`;
}

/**
 * Separador cantidad↔nombre del PICKER (`print_list_row` arg `[bp+4]`).
 *
 * ★ Es **0x20 (ESPACIO)**, no el `'-'` del visor de Ztats: `item_page_controller`
 * @0x0f9a lo empuja literal (`mov ax,0x20 / push ax`) en la rama del modo 'U', y
 * @0x0f7c hace lo mismo (vía `[bp-0xa]`) en la de Ready; el `0x2d` es de
 * `render_item_list` @0x0765, que es OTRO llamador de la misma rutina de fila.
 * Confundirlos pinta `1-Magic Crpt` donde el original pinta ` 1 Magic Crpt`.
 */
export const USE_ROW_SEP = 0x20;

/**
 * Centinela de `qty`: la entrada de la tabla extendida vale **0xff** ⇒
 * `print_list_row` @0x05f5 SALTA LA COLUMNA DE CANTIDAD ENTERA (número Y separador,
 * `je 0x62e`) y el nombre arranca en la primera celda de contenido. No es «cantidad
 * 1 implícita» ni un `--`: son CERO celdas.
 */
export const USE_QTY_HIDDEN = 0xff;

/**
 * Acción del port al USAR un ítem (ENTER). Cada rama corresponde a un `game.useXxx()`
 * derivado en Task #52 (herramientas de endgame) / #22 (skull key) / shards (clon).
 *
 * ALCANCE: la tabla extendida del binario incluye scrolls (0-7), potions (8-0xf),
 * carpet (0x10), skull key (0x11), regalia LB (0x12-0x14), moonstones (0x15-0x1c),
 * shards (0x1d-0x1f) y las herramientas de endgame (0x20-0x25). TODAS están portadas:
 * leer pergamino @0x11de (`readScroll`), beber poción @0x135a (`applyPotionEffect`),
 * enterrar gema lunar @0x153c (`game.useMoonstone`) y el resto de verbos `game.useXxx()`.
 */
export type UseAction =
  | { kind: "skullKey" }
  | { kind: "scroll"; index: number }
  | { kind: "potion"; color: number }
  | { kind: "moonstone"; phase: number }
  | { kind: "shard"; which: "falsehood" | "hatred" | "cowardice" }
  | {
      kind: "tool";
      tool:
        | "carpet"
        | "amulet"
        | "crown"
        | "sceptre"
        | "spyglass"
        | "hmsCape"
        | "sextant"
        | "pocketWatch"
        | "blackBadge"
        | "woodenBox";
    };

/** Una fila del picker (un ítem usable POSEÍDO). */
export interface UsePickerRow {
  /**
   * Nombre de fila = entrada VERBATIM de la name-table 0x1916, **sigilo de formato
   * incluido** (`*`/`!`/`(` para pergamino/poción/gema lunar). La piel lo decodifica
   * con la misma maquinaria que la lista 0xf de Ztats.
   */
  name: string;
  /**
   * Byte de la tabla extendida 0xB9EE para esta entrada, tal cual lo lee
   * `print_list_row` @0x05f0. Dos regímenes, y la diferencia es VISIBLE:
   *   · `1..0xfe` → columna de cantidad a 2 díg. justificada a la derecha con pad
   *     ESPACIO (`print_number(qty,2,0x20)` @0x0600) + el separador.
   *   · `USE_QTY_HIDDEN` (0xff) → **sin columna**: ni número ni separador (@0x05f5).
   * `0` no ocurre en este picker: `find_next_owned` @0x05a4 con modo 0xff (el que
   * empuja `cmd_use_item` @0x17ae) sólo lista las entradas con byte ≠ 0, así que el
   * relleno `--` (DS 0x9778) es INALCANZABLE aquí — es del picker de (R)eady, que
   * pasa un índice de PJ como modo y sí lista el equipado con cuenta 0.
   *
   * 🔴 Quién vale 0xff no se elige por «parece un flag»: es el byte que GRABA el
   * binario. Censo de TODOS los escritores del disasm (una sola instrucción cada
   * uno, ninguna otra menciona la variable):
   *   amulet SJOG 0x1712 · crown SJOG 0x16e6 · sceptre SJOG 0x1706 (y ULTIMA.EXE
   *   0x6224 lo LIMPIA a 0) · shards SJOG 0x16bd · moonstones SJOG 0x1496 ·
   *   spyglass TALK 0x06f8 · sextant TALK 0x06f0 · black badge TALK 0x0700 ·
   *   wooden box SJOG 0x14f7 · HMS cape SJOG 0x15d4 — **los diez escriben 0xff**.
   * Y `build_extended_item_table` @0x099a copia el byte CRUDO salvo dos casos que
   * además NORMALIZA a flag: moonstones (@0x09b4, `[0x5840+i]==0xff ? 0xff : 0`) y
   * HMS cape (@0x0a0a, `≠0 ? 0xff : 0`). Contables de verdad sólo: pergaminos
   * (0x5820), pociones (0x5828), alfombras (`inc`/`dec` en CMDS 0x0910 / CAST
   * 0x18a1) y llaves de calavera (`dec` CAST 0x18c4).
   */
  qty: number;
  /** Acción del port al pulsar ENTER sobre esta fila. */
  action: UseAction;
}

/**
 * Estado del juego que el picker necesita para enumerar los usables poseídos. Subconjunto
 * estructural de `GameState` (mismos campos que leía el handler DOM previo, main.ts).
 */
export interface UseRowsState {
  /** 8 pergaminos (0-7 = Vas Lor…An Tym). Primeros en la tabla extendida (0x08 antes). */
  scrollQuantities: number[];
  /** 8 pociones por color (0-7 = Blue…White). Se listan tras los scrolls, antes de la alfombra. */
  potionQuantities: number[];
  magicCarpets: number;
  skullKeys: number;
  /**
   * 8 moonstones por fase lunar (0-7). Se listan tras la regalia (sceptre) y ANTES de
   * los shards, en el orden de la tabla extendida (ids 0x15-0x1c). Sólo las LLEVADAS
   * (`buried===false`) aparecen: el binario marca la entrada con flag 0xff sólo si la
   * stone está en la mochila (build_extended_item_table 0x099a; 0x5840==0xff = llevada).
   */
  moonstones?: { buried: boolean }[];
  shards: { falsehood: boolean; hatred: boolean; cowardice: boolean };
  lbArtifacts: { amulet: boolean; crown: boolean; sceptre: boolean };
  specialItems: {
    spyglass: boolean;
    hmsCape: boolean;
    sextant: boolean;
    pocketWatch: boolean;
    blackBadge: boolean;
    woodenBox: boolean;
  };
}

/**
 * Filas del picker: los ítems usables POSEÍDOS, en el ORDEN de la tabla extendida
 * (0xB9EE): scrolls → potions → carpet → skull key → amulet → crown → sceptre →
 * moonstones → shards → spyglass → plans → sextant → watch → badge → box. El picker
 * sólo lista lo que tiene count≥1 / flag activo
 * (`find_next_owned`/`find_prev_owned` @0x05a4/0x056c saltan las entradas vacías) — por
 * eso p.ej. la Skull Key sólo aparece con `skullKeys≥1` (blindaje de underflow, #22).
 * Lista vacía → el llamador imprime "No usable items!" (DS 0x489f) sin abrir el picker.
 *
 * Los nombres son los de la name-table 0x1916 VERBATIM, con su sigilo de formato
 * (`*`/`!`/`(`) delante cuando la entrada lo lleva — la piel lo decodifica.
 */
export function buildUseRows(st: UseRowsState): UsePickerRow[] {
  const rows: UsePickerRow[] = [];
  // Scrolls = ids 0x00-0x07 en la tabla extendida (los PRIMEROS). Lector CAST.OVL 0x11de.
  // La FILA lleva la sigla rúnica con su sigilo `*` (0x1916), no el nombre largo del
  // hechizo: el original pinta `<0x1c> + IS`, no `In Sanct`.
  for (let index = 0; index < 8; index++) {
    const qty = st.scrollQuantities[index] ?? 0;
    if (qty > 0) {
      rows.push({ name: USE_SCROLL_ROW_NAMES[index]!, qty, action: { kind: "scroll", index } });
    }
  }
  // Potions = ids 0x08-0x0f en la tabla extendida (ANTES de carpet 0x10). Cada color con
  // count≥1 se lista por su color (cadena-lado DS 0x19C2) tras el sigilo `!`.
  // Efecto: bebedor CAST.OVL 0x135a.
  for (let color = 0; color < 8; color++) {
    const qty = st.potionQuantities[color] ?? 0;
    if (qty > 0) {
      rows.push({ name: USE_POTION_ROW_NAMES[color]!, qty, action: { kind: "potion", color } });
    }
  }
  // Carpet = id 0x10 en la tabla extendida (ANTES de skull key 0x11). Count (byte).
  if (st.magicCarpets > 0) {
    rows.push({ name: USE_ITEM_NAMES.carpet, qty: st.magicCarpets, action: { kind: "tool", tool: "carpet" } });
  }
  if (st.skullKeys > 0) {
    rows.push({ name: USE_ITEM_NAMES.skullKey, qty: st.skullKeys, action: { kind: "skullKey" } });
  }
  // A partir de aquí TODO va con `USE_QTY_HIDDEN`: los diez escritores del disasm
  // graban 0xff (censo en el docblock de `UsePickerRow.qty`) ⇒ el original NO pinta
  // columna de cantidad en ninguna de estas filas.
  const H = USE_QTY_HIDDEN;
  if (st.lbArtifacts.amulet) rows.push({ name: USE_ITEM_NAMES.amulet, qty: H, action: { kind: "tool", tool: "amulet" } });
  if (st.lbArtifacts.crown) rows.push({ name: USE_ITEM_NAMES.crown, qty: H, action: { kind: "tool", tool: "crown" } });
  if (st.lbArtifacts.sceptre) rows.push({ name: USE_ITEM_NAMES.sceptre, qty: H, action: { kind: "tool", tool: "sceptre" } });
  // Moonstones = ids 0x15-0x1c (ANTES de los shards 0x1d). Una fila por fase LLEVADA
  // (buried===false), con el nombre `(N` de la name-table → "Moonstone " + dígito.
  (st.moonstones ?? []).forEach((m, phase) => {
    if (!m.buried) rows.push({ name: useMoonstoneRowName(phase), qty: H, action: { kind: "moonstone", phase } });
  });
  if (st.shards.falsehood) rows.push({ name: USE_ITEM_NAMES.shardFalsehood, qty: H, action: { kind: "shard", which: "falsehood" } });
  if (st.shards.hatred) rows.push({ name: USE_ITEM_NAMES.shardHatred, qty: H, action: { kind: "shard", which: "hatred" } });
  if (st.shards.cowardice) rows.push({ name: USE_ITEM_NAMES.shardCowardice, qty: H, action: { kind: "shard", which: "cowardice" } });
  if (st.specialItems.spyglass) rows.push({ name: USE_ITEM_NAMES.spyglass, qty: H, action: { kind: "tool", tool: "spyglass" } });
  if (st.specialItems.hmsCape) rows.push({ name: USE_ITEM_NAMES.hmsCape, qty: H, action: { kind: "tool", tool: "hmsCape" } });
  if (st.specialItems.sextant) rows.push({ name: USE_ITEM_NAMES.sextant, qty: H, action: { kind: "tool", tool: "sextant" } });
  if (st.specialItems.pocketWatch) rows.push({ name: USE_ITEM_NAMES.pocketWatch, qty: H, action: { kind: "tool", tool: "pocketWatch" } });
  if (st.specialItems.blackBadge) rows.push({ name: USE_ITEM_NAMES.blackBadge, qty: H, action: { kind: "tool", tool: "blackBadge" } });
  if (st.specialItems.woodenBox) rows.push({ name: USE_ITEM_NAMES.woodenBox, qty: H, action: { kind: "tool", tool: "woodenBox" } });
  return rows;
}

/** Posición del picker: fila bajo el cursor + primer ítem visible (scroll). */
export interface UsePickerModel {
  cursor: number;
  scroll: number;
}

/** Acción que el reductor devuelve al caller (main.ts la ejecuta). */
export type UsePickerAction =
  /** La tecla no cambió nada (el modal la traga; getkey re-lee). */
  | { kind: "none" }
  /** El cursor/scroll se movió → repinta. */
  | { kind: "move"; model: UsePickerModel }
  /** RETURN/Space sobre `index`: USAR el ítem y CERRAR el picker (@0x1230, mode 'U'). */
  | { kind: "use"; index: number }
  /** ESC: cerrar el picker imprimiendo "None!" (@0x1244). */
  | { kind: "close" };

/** Estado inicial: cursor en el primer ítem, sin scroll. */
export function initUsePicker(): UsePickerModel {
  return { cursor: 0, scroll: 0 };
}

/**
 * Reductor de teclas del picker (`item_page_controller` @0x0f2e, mode 'U'):
 *   · ↑/↓ mueven el cursor UNA fila; PgUp/PgDn 7; Home/End a los bordes. Sin wrap (clamp).
 *     (Mismas teclas que Ready — el controller es el mismo, sólo cambia la tabla y ENTER.)
 *   · RETURN (0x0d) o Space (0x20) → `use` sobre el ítem del cursor y CIERRE (@0x1230: en
 *     mode≠'R' marca fin y devuelve el id; NO equipa in situ).
 *   · ESC (0x1b) → `close` (@0x1244: imprime "None!", devuelve -1).
 * Con `rowCount<=0` (defensivo) todo cierra.
 *
 * La navegación vive en el reductor GENÉRICO del controller (`itemPageController.ts`,
 * MANT-4/D1 — antes era copia carácter a carácter de readyPickerKey): aquí sólo se
 * re-etiqueta `enter` con el verbo del mode 'U' (use, que además cierra en el caller).
 */
export function usePickerKey(
  model: UsePickerModel,
  key: string,
  rowCount: number,
): UsePickerAction {
  const r = itemPageKey(model, key, rowCount, USE_VISIBLE_ROWS);
  return r.kind === "enter" ? { kind: "use", index: r.index } : r;
}
