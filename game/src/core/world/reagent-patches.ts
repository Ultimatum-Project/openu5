/**
 * PARCELAS DE REACTIVO SILVESTRE — `search_daily_reagent_patch` SJOG.OVL 0x045a-0x0510.
 *
 * Tres casillas fijas del mapa de Britannia entregan reactivo al buscarlas, una vez por
 * día y sólo a medianoche. Dan mandrake root y nightshade: los DOS reactivos que ninguna
 * tienda vende (control positivo independiente de que las tablas están bien leídas —
 * la mecánica silvestre conocida de Ultima V cae sola de los datos).
 *
 * CUERPO (`ret 4` ⇒ 2 args = X, Y; devuelve 1 si cosecha, 0 si no):
 * ```
 * 0462  si = 0                                    ; bucle de 3 parcelas
 * 0464  [bp-8] = 0x3e72                           ; cursor de la tabla de NOMBRES
 * 046c  cmp [si+0x3e66], [bp+6]  / jne siguiente  ; tabla X
 * 0477  cmp [si+0x3e6a], [bp+4]  / jne siguiente  ; tabla Y
 * 0480  cmp [g_hour], ah (ah==0) / jne siguiente  ; ★ SÓLO a MEDIANOCHE
 * 0486  cmp [si+0x5858], [g_day] / je  siguiente  ; ★ ¿ya cosechada HOY?
 * 048f  mov [si+0x5858], [g_day]                  ; sella el día ANTES de tirar
 * 0493  bx = [si+0x3e6e]                          ; slot de reactivo
 * 049a  push 2 / push 0xf / call rand_range       ; ★ rand(2,15) — cantidad
 * 04aa  add [bx+0x5850], al                       ; suma al inventario
 * 04ae  cmp [bx+0x5850],0x63 / mov …,0x63         ; tope 99
 * 04ba  cmp di,0xa / jge                          ; ancho de campo del impresor (1 ó 2)
 * 04d1  call 0x5abe(di, ancho, 0x20)              ; el NÚMERO
 * 04d4  print DS 0x86be                           ; « sprigs of\n»
 * 04db  print [bp-8]                              ; el NOMBRE de la parcela
 * 04e3  print DS 0x86ca                           ; «\n»
 * 04f6  [bp-8] += 2 / inc si / cmp si,3 / jge     ; siguiente parcela
 * ```
 *
 * ★ `cmp di,0xa` NO es singular/plural (así lo leía la derivación heredada, y es el
 *   punto exacto que sostiene la pieza). Es el ANCHO DE CAMPO de `print_int_padded`
 *   (0x5abe → kernel 0x1A3E; SJOG es banda 3, sesgo −0x4080), que cuenta dígitos contra
 *   la tabla de potencias de diez DS 0x5404 = {10,100,1000,10000} y rellena con el 3er
 *   arg 0x20 = espacio. Ancho == nº de dígitos ⇒ relleno 0 ⇒ el número sale desnudo en
 *   los dos casos. Hay UNA sola forma del mensaje, y « sprigs of» siempre encaja porque
 *   rand(2,15) no puede dar 1.
 *
 * LLAMADOR — SJOG 0x0b91, dentro de la cadena de buscadores del (S)earch, que es de
 * PRIMERO-QUE-ACIERTE: `0x0b81 call 0x3a8` (moonstone) → `0x0b91 call 0x45a` (esta) →
 * `0x0ba1 call 0x514` (tabla fija de 113 entradas, la del árbol de Minoc y la que
 * imprime «nothing of note.» en 0x636). Tras cada una, `or ax,ax / jne 0xba4` corta.
 * Los args son [bp-8] y [bp-0xa], calculados en 0x0988-0x099d como `g_party_x +
 * g_cmb_scratch_x` / `g_party_y + g_cmb_scratch_y` = la casilla APUNTADA (el (S)earch
 * es direccional, re/verified/cmds.md §54) — la misma que usa la rama de moonstone.
 *
 * NO hay gate de localización ni de planta en 0x045a (a diferencia de la tabla fija,
 * que compara 0x3f5c contra g_location y 0x3fce contra g_floor): las tres parcelas se
 * gatean SOLAS por coordenada, porque 182/97/44 y 54/165/137 caen fuera del 32×32 de
 * cualquier mapa pequeño.
 *
 * Sellos: DS 0x5858-0x585A, un byte por parcela, borrados a 0 en el rollover de MES
 * (ULTIMA.EXE 0x505e/0x5061/0x5064) — ver `advanceClock` en survival.ts.
 */
import type { GameState } from "../state.js";
import type { RandFn } from "./survival.js";

export interface ReagentPatch {
  /** DS 0x3e66 (byte). */
  readonly x: number;
  /** DS 0x3e6a (byte). */
  readonly y: number;
  /** DS 0x3e6e (byte) = índice en `GameState.reagentQuantities` (orden de magic/spells.ts:79). */
  readonly reagent: number;
  /** DS 0x3e72 (word) → puntero a la cadena; VERBATIM de DATA.OVL. */
  readonly name: string;
}

/**
 * Las tres parcelas, volcadas de DATA.OVL (fileoff = DS + 0x10). La 4ª entrada de cada
 * tabla es 0 y el bucle no la alcanza (`0x04fb cmp si,3 / jge`).
 *
 * ★ La tabla de nombres es por PARCELA, no por reactivo: por eso «mandrake root!» está
 * DOS veces en el fichero (DS 0x8692 y DS 0x86a2), una por cada parcela de mandrake.
 */
export const REAGENT_PATCHES: readonly ReagentPatch[] = [
  { x: 182, y: 54, reagent: 7, name: "mandrake root!" }, // DS 0x8692
  { x: 97, y: 165, reagent: 7, name: "mandrake root!" }, // DS 0x86a2
  { x: 44, y: 137, reagent: 6, name: "nightshade!" }, //    DS 0x86b2
];

/** Tope de reactivo por slot (0x04ae `cmp [bx+0x5850],0x63`). */
export const REAGENT_PATCH_CAP = 0x63;

export interface ReagentHarvest {
  /** Índice de parcela 0..2 (el `si` del bucle). */
  readonly patch: number;
  /** Slot de reactivo cosechado. */
  readonly reagent: number;
  /** Lo TIRADO por rand(2,15) — el número que imprime el binario, antes del tope. */
  readonly qty: number;
  /** Nombre a imprimir tras « sprigs of\n». */
  readonly name: string;
}

/** Índice de la parcela en (x,y), o -1 (0x046c/0x0477, las dos tablas a la vez). */
export function reagentPatchIndexAt(x: number, y: number): number {
  return REAGENT_PATCHES.findIndex((p) => p.x === x && p.y === y);
}

/**
 * Corre `search_daily_reagent_patch` sobre la casilla (x,y). Devuelve la cosecha (y
 * muta el estado) o `null` si algún gate corta — que es el `ax=0` con el que el
 * llamador sigue a la tabla fija.
 *
 * ⚠ RNG: consume EXACTAMENTE UNA tirada `rand(2,15)`, y sólo cuando cosecha. Los tres
 * gates (coordenada, medianoche, sello del día) van ANTES de 0x049a, así que el stream
 * vivo no se toca en ningún camino de fallo.
 */
export function harvestReagentPatch(
  state: GameState, x: number, y: number, rand: RandFn,
): ReagentHarvest | null {
  const patch = reagentPatchIndexAt(x, y);
  if (patch < 0) return null;
  const def = REAGENT_PATCHES[patch]!;

  if (state.time.hour !== 0) return null; // 0x0480: ah == 0 ⇒ medianoche
  const seals = state.reagentPatchFoundDay ?? [0, 0, 0];
  if (seals[patch] === state.time.day) return null; // 0x0486-0x048d

  // 0x048f: el sello se escribe ANTES de la tirada. Se conserva el orden porque fija
  // la posición del rand en el stream.
  const next = [seals[0] ?? 0, seals[1] ?? 0, seals[2] ?? 0];
  next[patch] = state.time.day;
  state.reagentPatchFoundDay = next;

  const qty = rand(2, 15); // 0x049a
  state.reagentQuantities[def.reagent] = Math.min(
    REAGENT_PATCH_CAP,
    (state.reagentQuantities[def.reagent] ?? 0) + qty,
  ); // 0x04aa + 0x04ae

  return { patch, reagent: def.reagent, qty, name: def.name };
}
