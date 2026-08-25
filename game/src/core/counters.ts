/**
 * Sumas SATURANTES del kernel del original (Ultima V DOS 1988). El binario resuelve
 * todo incremento de contador de recursos con DOS helpers genéricos que saturan en un
 * tope fijo (NO wrapean a 0):
 *
 *  - `add_byte_capped` (kernel 0x9C60 [= CS 0x3ef0 → ULTIMA.EXE:0x3ef0]): cap 99 (0x63). Contadores u8: keys/gems/torches
 *    y las cantidades de equipo/reactivo (equip_qty). Cita: re/notes/shops.md:68-69
 *    ("grant `g_equip_qty[...] += 1` cap 99 (add_byte_capped 0x9C60)").
 *  - `add_word_capped` (kernel 0x9C84 [= CS 0x3f14 → ULTIMA.EXE:0x3f14]): cap 9999 (0x270F). Palabras u16: gold, food y exp.
 *    Citas: re/notes/shops.md:69 (venta gold cap 9999, 0x0F3D→0x9C84), :146 (comida cap
 *    9999), re/notes/combat.md:178 (exp cap 9999).
 *
 * Espejo directo del asm: saturación, no aritmética de byte con wrap. El ÚNICO wrap
 * observable de este dominio es el underflow de munición (dec sobre 0 → 255), que va por
 * su propia ruta bug-for-bug en combat.ts (#18), no por estos helpers.
 */

/** Tope de `add_byte_capped` (0x9C60): 99 = 0x63. */
export const CAP_BYTE = 99;
/** Tope de `add_word_capped` (0x9C84): 9999 = 0x270F. */
export const CAP_WORD = 9999;

/** Suma saturante u8 del original (add_byte_capped 0x9C60, cap 99 por defecto). */
export function addByteCapped(value: number, add: number, cap: number = CAP_BYTE): number {
  return Math.min(cap, value + add);
}

/** Suma saturante u16 del original (add_word_capped 0x9C84, cap 9999 por defecto). */
export function addWordCapped(value: number, add: number, cap: number = CAP_WORD): number {
  return Math.min(cap, value + add);
}
