/**
 * ROBO DE FAULINEI al cerrar CADA conversación — TALK.OVL 0x1180 (#196).
 *
 * En la ciudad ocupada por Faulinei (la Falsedad, índice 0) toda charla termina con
 * «Something was stolen!» y **una** pieza del inventario menos. Derivación entera con
 * citas en `re/notes/shadowlord-urbano-acta.md §2`.
 *
 * ```
 * 1187  cmp byte [g_shadowlord_here_idx, DS 0x5958], 0 / 118c je 0x1191 / 118e jmp 0x1278
 * 1191  ax = 0x94dc / 1195 call print          ; "\nSomething was stolen!\n"
 * 11a8  call CS 0x43ae (0x32,1,0x7d0,0x320)    ; sfx — AV/Clase C
 * 11ab  call CS 0x2056 / 11af call CS 0x207e   ; srand(reloj) — techo de paridad
 * 11b2  ax = g_keys|g_gems|g_torches / 11c5 je 0x1210
 * 11c7    push 0 / push 2 / 11ce call CS 0x2092        ; rand(0,2)
 * 11d1    0 ⇒ llaves · 1 ⇒ gemas · 2 ⇒ antorchas
 * 11e2/11f8/1204: si la categoría sorteada está VACÍA ⇒ vuelve a 0x11c7 (RE-TIRA)
 * 11f1    call CS 0x3f36 (ptr, 1)              ; −1, con suelo 0
 * 1210  si=0x2f⇒0: g_equip_qty  (DS 0x57c0, 48) ; roba del índice MÁS ALTO no vacío
 * 1232  si=7⇒0:    g_potion_qty (DS 0x5828, 8)
 * 124a  si=7⇒0:    g_scroll_qty (DS 0x5820, 8)
 * 1262  g_gold (DS 0x57aa) −= rand(1,15), suelo 0   [CS 0x3f54]
 * 1275  call CS 0x2900                         ; repintado del panel — sólo la rama de ORO
 * ```
 *
 * **Se dispara al SALIR de toda conversación, incondicionalmente**: el intérprete
 * `run_scripted_conversation` 0x127E llama a 0x1180 en su 0x1305, y allí convergen los
 * tres caminos del cuerpo (0x12f9 `jne`, 0x1300 `jne` y la caída de 0x1302). No hay
 * «charla que no robe».
 *
 * ⚠ **El `srand(rng_time_hash())` de 0x11AB NO se reproduce**: el port conserva su
 * stream (precedente D6), así que el sorteo del botín sale del stream vivo del port y en
 * el original sale del reloj de pared. Registro único de techos de paridad:
 * `re/notes/rng.md §Techos de paridad`, fila TALK 0x11AB.
 *
 * ⚠ **El repintado de panel de 0x1275 (CS 0x2900) cuelga SÓLO de la rama del oro** — los
 * otros cinco caminos saltan a 0x1278 y se lo saltan. Es presentación (esa rutina redibuja
 * los 6 miembros y las cifras de comida/oro), Clase C, no se modela; queda anotado porque
 * la asimetría es real y no un descuido de lectura.
 */
import type { GameState } from "../state.js";
import type { RandFn } from "./survival.js";
import { shadowlordHereIndex } from "./blackthorn.js";

/** DS 0x94dc — el mensaje, byte-exacto. Traducido por el choke `t()` de la consola. */
export const THEFT_MESSAGE = "\nSomething was stolen!\n";

/** Qué se llevó Faulinei. `index` sólo para las tres arrays; `amount` = piezas/oro. */
export interface TheftLoot {
  kind: "keys" | "gems" | "torches" | "equipment" | "potion" | "scroll" | "gold";
  index?: number;
  amount: number;
}

export interface TheftResult {
  messages: string[];
  /** `null` si el gate no se abrió (no es Faulinei el colocado aquí). */
  loot: TheftLoot | null;
}

/** `byte_sub_saturating` CS 0x3f36: resta con suelo 0 sobre un byte. */
function subSaturating(value: number, amount: number): number {
  return value <= amount ? 0 : value - amount;
}

/** Último índice NO vacío de una array de cantidades — el binario baja `si` con `dec/jns`. */
function highestNonEmpty(qty: readonly number[], from: number): number {
  for (let si = from; si >= 0; si--) if ((qty[si] ?? 0) !== 0) return si;
  return -1;
}

/**
 * Ejecuta el robo si procede. MUTA el estado (como `postPurchaseGoldDrain`) y devuelve
 * lo robado, para que los tests puedan afirmar sobre la CASCADA y no sólo sobre el saldo.
 *
 * @param rand stream vivo del port. Consumo: **0** tiradas si el gate no se abre; en la
 *   rama de llaves/gemas/antorchas, 1 `rand(0,2)` por intento (el binario RE-TIRA cuando
 *   sortea una categoría vacía, 0x11e7/0x11fd/0x1209); en la rama de oro, 1 `rand(1,15)`;
 *   en equipo/pociones/pergaminos, **ninguna** (el barrido es lineal, sin azar).
 */
export function applyFaulineiTheft(state: GameState, rand: RandFn): TheftResult {
  // 0x1187: el gate pregunta por un VALOR — «¿es el de la FALSEDAD?» — sobre el flag
  // FÍSICO de la colocación (#52 propuesta A), no sobre la tabla lógica. Con el sentinel
  // (ningún SL colocado) o con Astaroth/Nosfentor, el `jne` se cumple igual: nada pasa.
  if (shadowlordHereIndex(state) !== 0) return { messages: [], loot: null };

  const messages = [THEFT_MESSAGE];

  // 0x11b2-0x11c5: `ax = keys|gems|torches`; con los TRES a cero salta a la cascada larga.
  if ((state.keys | state.gems | state.torches) !== 0) {
    // 0x11c7: rejection sampling. Termina con probabilidad 1 porque acabamos de
    // comprobar que al menos una de las tres categorías no está vacía; el binario tampoco
    // acota los intentos (0x11e7/0x11fd/0x1209 saltan HACIA ATRÁS, a 0x11c7).
    for (;;) {
      const r = rand(0, 2); // 0x11c9 push 0 (min) / 0x11cb push 2 (max)
      if (r === 0 && state.keys !== 0) {
        state.keys = subSaturating(state.keys, 1); // 0x11e9-0x11f1, DS 0x57ac
        return { messages, loot: { kind: "keys", amount: 1 } };
      }
      if (r === 1 && state.gems !== 0) {
        state.gems = subSaturating(state.gems, 1); // 0x11ff, DS 0x57ad
        return { messages, loot: { kind: "gems", amount: 1 } };
      }
      if (r === 2 && state.torches !== 0) {
        state.torches = subSaturating(state.torches, 1); // 0x120b, DS 0x57ae
        return { messages, loot: { kind: "torches", amount: 1 } };
      }
    }
  }

  // 0x1210: equipo, del índice MÁS ALTO al 0 (`si = 0x2f` y `dec si / jns`).
  const eq = highestNonEmpty(state.equipmentQuantities, 0x2f);
  if (eq >= 0) {
    state.equipmentQuantities[eq] = subSaturating(state.equipmentQuantities[eq] ?? 0, 1);
    return { messages, loot: { kind: "equipment", index: eq, amount: 1 } };
  }
  // 0x1232: pociones (DS 0x5828, 8 slots).
  const po = highestNonEmpty(state.potionQuantities, 7);
  if (po >= 0) {
    state.potionQuantities[po] = subSaturating(state.potionQuantities[po] ?? 0, 1);
    return { messages, loot: { kind: "potion", index: po, amount: 1 } };
  }
  // 0x124a: pergaminos (DS 0x5820, 8 slots).
  const sc = highestNonEmpty(state.scrollQuantities, 7);
  if (sc >= 0) {
    state.scrollQuantities[sc] = subSaturating(state.scrollQuantities[sc] ?? 0, 1);
    return { messages, loot: { kind: "scroll", index: sc, amount: 1 } };
  }
  // 0x1262: fondo de la cascada — oro. `push 1` (min) / `push 0xf` (max) ⇒ rand(1,15),
  // y `sub_word_clamped_floor0` CS 0x3f54 sobre DS 0x57aa.
  const roll = rand(1, 15);
  const before = state.gold;
  state.gold = state.gold <= roll ? 0 : state.gold - roll;
  return { messages, loot: { kind: "gold", amount: before - state.gold } };
}
