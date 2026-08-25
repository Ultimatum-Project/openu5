/**
 * Recogida de los ítems de trama de Lord British — la mecánica REAL del original: (G)et
 * sobre el tile del objeto (SJOG apply_item_grant 0x1458, dispatch por tile 0xB4-0xB7). Los
 * cuatro flags y los strings salen byte-exactos de DATA.OVL. Ningún ítem usa ya el modelo
 * Search-radio fabricado: shards/amuleto se siembran en el Underworld (F1.10-T2/T3) y
 * corona/cetro son slots-objeto del .NPC hidratados como objetos "plot" de interior
 * (F1.10-T4); ambos comparten `grantPlotItem`.
 */
import type { GameState, PlotItemId } from "../state.js";

/**
 * Strings de recogida de trama — BYTE-EXACTOS de DATA.OVL vía la fórmula CANÓNICA
 * `fileoff = DS_off + 0x10` (`re/notes/dataovl-strings.md §Ámbito`). NO anclar por
 * búsqueda-de-texto: DATA.OVL tiene copias DUPLICADAS de estos strings (p.ej. "Falsehood!"
 * está en 0x47DC Y en el canónico 0x8D28=DS 0x8D18+0x10), y buscar el texto devuelve la
 * primera copia → delta falso. El (G)et de un shard son DOS prints (SJOG rama shard
 * 0x16b6): el prefijo DS 0x8D0A ("The Shard of\n", 0x16c2) y luego el nombre por índice
 * (DS 0x8D18/24/2E, vía 0x15bf); corona/cetro/amuleto un solo print.
 */
const SHARD_MSG_PREFIX = "The Shard of\n"; // DS 0x8D0A (primer print de la rama shard 0x16c2)
const SHARD_MSG_NAME: Record<"shard-falsehood" | "shard-hatred" | "shard-cowardice", string> = {
  "shard-falsehood": "Falsehood!\n", // DS 0x8D18
  "shard-hatred": "Hatred!\n", // DS 0x8D24
  "shard-cowardice": "Cowardice!\n", // DS 0x8D2E
};
const CROWN_MSG = "The Crown of Lord British!\n"; // DS 0x8D3A (rama corona 0x16e6, verificado vs DATA.OVL)
const SCEPTRE_MSG = "The Sceptre of Lord British!\n"; // DS 0x8D56 (rama cetro 0x1706)
const AMULET_MSG = "The Amulet of Lord British!\n"; // DS 0x8D74 (rama amuleto 0x1712)
// Caja de sándalo (LB castle loc 17, tras el pasadizo del clavicémbalo). El (G)et despacha
// por TYPE 14 a apply_item_grant (SJOG 0x1458 → rama 0x14f0), que imprime el string DS
// 0x8C76 y fija g_wooden_box=0xff. String byte-exacto de DATA.OVL fileoff 0x8C86 = "A
// sandalwood box!\n" (con salto de línea, como corona/cetro). Ver re/notes/content-audit.md
// §Apéndice ASM (#51). El path de botín-suelo `lootItemName(14)` omite el \n, pero la caja
// NUNCA es botín de cofre — su único origen es el slot-objeto (SJOG Get 0x18ce → 0x199f).
const SANDALWOOD_MSG = "A sandalwood box!\n"; // DS 0x8C76 (SJOG 0x14f0), verbatim DATA.OVL
// Alfombra mágica (LB castle loc 17, slot 22, planta 2 (15,18) — el ÚNICO Carpet2 de los
// datos). El (G)et despacha por object-tile: NO va en la jump-table de ids 1-8 sino en el
// switch secundario por valor (SJOG 0x1464→0x172e; `cmp ax,0x1b` en 0x1756 → rama 0x149e).
// La rama imprime DS 0x8C5C, hace `inc g_carpets` con clamp 0x64→0x63 (0x14a9-0x14b0) y,
// SOLO si g_location==0x11 (0x14b5), borra el slot vía kernel 0xBB92 [= CS 0x7b12 → TOWN.OVL:0x00b0](0x16) — la constante
// 0x16 = 22 ES el nº de slot del dato, la cita cuadra. Sin flag de tomado en el binario:
// al re-entrar, el bloque estático del .NPC re-siembra el slot (misma mecánica de
// regeneración por-entrada que los cofres del sótano). Ver re/notes/lote-D-witnesses-relevo.md.
const CARPET_MSG = "A magic carpet!\n"; // DS 0x8C5C (SJOG 0x149e), verbatim DATA.OVL fileoff 0x8C6C

/**
 * Tile-de-trama de un slot-objeto del .NPC → PlotItemId. Los slots de la corona (type
 * 0xB5) y del cetro (type 0xB6) del fichero .NPC codifican su ítem en el propio tile,
 * igual que el dispatch por tile del (G)et (SJOG 0x1766/0x176e). Devuelve null para
 * cualquier otro tile. F1.10-T4.
 */
export function plotItemForNpcType(type: number): PlotItemId | null {
  switch (type) {
    case 0xb5:
      return "crown";
    case 0xb6:
      return "sceptre";
    case 14: // ItemSandalwoodBox (LB castle loc 17 slot 31, tras el pasadizo secreto) — #51
      return "wooden-box";
    case 27: // Carpet2 (LB castle loc 17 slot 22) — get_special_item rama 0x149e
      return "carpet";
    default:
      return null;
  }
}

/**
 * Grant REAL del (G)et sobre un ítem de trama de kind "plot". Port de las ramas de
 * apply_item_grant (SJOG 0x1458), despachadas POR EL TILE del objeto:
 *   - shard (tile 0xB4, rama 0x16b6): fija `g_shard_taken[idx]=0xff` (DS 0x57B6+idx) e
 *     imprime DOS strings (prefijo DS 0x8D0A + nombre DS 0x8D18/24/2E). idx = z&3 del slot.
 *   - corona (tile 0xB5, rama 0x16e6): fija `g_crown=0xff` (DS 0x57B4), string DS 0x8D3A.
 *   - cetro  (tile 0xB6, rama 0x1706): fija `g_sceptre=0xff` (DS 0x57B5), string DS 0x8D56.
 *   - amuleto (tile 0xB7, rama 0x1712): fija `g_amulet_lb=0xff` (DS 0x57B3), string DS 0x8D74.
 *
 * En el clon esos flags son `state.shards.*` / `state.lbArtifacts.*` — los MISMOS que
 * gatean la re-siembra (underworld-seed.ts para shards/amuleto; hydrateInteriorObjects para
 * corona/cetro), así que tras el grant el objeto no re-nace al re-derivar la capa. El set
 * del flag es idempotente. Devuelve el mensaje (para el shard, los dos prints concatenados).
 */
export function grantPlotItem(state: GameState, item: PlotItemId): string {
  switch (item) {
    case "amulet":
      state.lbArtifacts.amulet = true;
      return AMULET_MSG;
    case "crown":
      state.lbArtifacts.crown = true;
      return CROWN_MSG;
    case "sceptre":
      state.lbArtifacts.sceptre = true;
      return SCEPTRE_MSG;
    case "wooden-box":
      // g_wooden_box = 0xff (ENDGAME 0x0648 gatea la escena buena del trono con Y ∧ box). #51
      state.specialItems.woodenBox = true;
      return SANDALWOOD_MSG;
    case "carpet":
      // inc g_carpets (0x57B0) con clamp 0x64→0x63 (SJOG 0x14a9-0x14b0) ≡ min(99, +1).
      // El grant NO fija flag alguno — contador puro, re-obtenible por re-entrada (fiel).
      state.magicCarpets = Math.min(0x63, state.magicCarpets + 1);
      return CARPET_MSG;
    case "shard-falsehood":
      state.shards.falsehood = true;
      break;
    case "shard-hatred":
      state.shards.hatred = true;
      break;
    case "shard-cowardice":
      state.shards.cowardice = true;
      break;
  }
  return SHARD_MSG_PREFIX + SHARD_MSG_NAME[item]; // dos prints (prefijo + nombre)
}
