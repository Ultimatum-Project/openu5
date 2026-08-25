/**
 * FICHA #315 — **el tendero sólo atiende EN SU TRAMO**, y el port abría a cualquier hora.
 *
 * Derivación de primera mano sobre `re/disasm/TALK.OVL.asm` y `re/disasm/NPC.OVL.asm`
 * (acta entera en `re/notes/tienda-gate-horario-315.md`).
 *
 * `talk_converse_dispatch` (TALK 0x031E) reparte por `dlgNum`; la familia de TENDEROS
 * (`0x80..0xFC`) cae en 0x03e4 y **no llega a la tienda sin pasar DOS pruebas**:
 *
 * ```
 * 03e7: test byte [bx+0xe], 1   ; bit 0 del ÍNDICE DE TRAMO guardado en el registro vivo
 * 03eb: je   0x406              ;   → rechazo
 * 03f1: mov al, [g_hour]        ; y ahora el índice RECALCULADO desde el reloj:
 * 03f7: call 0xffffbbb6         ;   NPC.OVL:0x12E0 (= `scheduleIndex` de core/time.ts)
 * 03fa: test al, 1
 * 03fc: je   0x406              ;   → rechazo
 * 03fe: push [bp-2]             ; dlgNum
 * 0401: call 0xe6               ; ← LA TIENDA (despachador de 8 tipos)
 * 0406: …0x9196… ; …0x91c4…     ; rechazo: las dos cadenas de SHOP_CLOSED_MESSAGE
 * ```
 *
 * ★★ **El criterio no es un rango de horas: es la PARIDAD del índice de tramo.** Los
 * `.NPC` guardan 4 tiempos y 3 posiciones, y el tramo de trabajo del tendero es el
 * índice 1 — el único impar de los tres. Por eso el binario no compara horas: mira el
 * bit 0. Quien lo porte como «abierto de X a Y» tendrá que inventarse las cotas y se
 * equivocará justo donde el dato manda (y en el tramo 3, ver abajo).
 *
 * 🔴 **Las dos pruebas del binario COLAPSAN EN UNA en el port, y es una diferencia
 * declarada, no un descuido.** La primera lee el índice ALMACENADO en el registro vivo
 * del NPC (`rt+0xe`), que en el original puede ir por detrás del reloj porque sólo se
 * refresca en la transición horaria (el pestillo de la ficha #84, NO modelado aquí); la
 * segunda lo recalcula. El port no tiene ese pestillo: recomputa el índice en cada
 * consulta, así que «almacenado» y «recalculado» son por construcción el mismo valor y
 * la conjunción se reduce a un solo test de paridad. Si algún día se porta el pestillo
 * de #84, ESTE es uno de los sitios donde las dos pruebas vuelven a separarse.
 *
 * El quirk 3→1 NO se re-implementa aquí: vive en `scheduleIndex` (`core/time.ts`, port
 * byte a byte de NPC.OVL:0x12E0 con `0x131e` citado) y esta función lo hereda. Ese es
 * justamente el motivo de llamar a la pieza compartida en vez de contar horas.
 */
import { scheduleIndex } from "../time.js";

/**
 * Rechazo del tendero fuera de tramo. **Copia VERBATIM de las DOS cadenas que imprime
 * el binario**, DS `0x9196` (0x0406) y DS `0x91c4` (0x040d) — en la extracción del port
 * son `data.json` `stringPools[19].strings[148]` y `[150]` (el pool `textItemsWearUse`).
 * `test_tienda_horario` las carea contra el pool: si la extracción cambia, el careo
 * enrojece en vez de dejar el literal derivar. Mismo idiom que `cmd-strings.ts` (copia
 * verbatim + cita del offset), porque el core no recibe los pools.
 */
export const SHOP_CLOSED_MESSAGE = 'A merchant says:\n"Come see me at\nmy shoppe, ' + "when\nit's open!\"\n";

/** Lo que el gate necesita del NPC: sus cuatro tiempos. */
export interface ShopKeeperSchedule {
  readonly times?: readonly number[];
}

/**
 * ¿Atiende el tendero a esta hora? = bit 0 del índice de tramo (TALK 0x03e7/0x03fa).
 *
 * Vale para las DOS vías —(T)alk y la intercepción por proximidad— porque en el binario
 * las dos convergen en `talk_converse_dispatch`: el gate es UNO, no una copia por vía.
 */
export function shopIsOpen(npc: ShopKeeperSchedule, hour: number): boolean {
  return (scheduleIndex(npc.times ?? [0, 0, 0, 0], hour) & 1) === 1;
}
