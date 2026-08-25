/**
 * BOLA DE CRISTAL — el caso 0x29 de `cmd_look` (tarjeta #144).
 *
 * DÓNDE VIVE EN EL BINARIO. No es un comando propio: es la PRIMERA rama de
 * `cmd_look` (LOOKOBJ.OVL 0x099c), y corta ANTES de que el resto del handler
 * exista. El orden literal del asm:
 *
 *   LOOKOBJ 0x09e4  cmp word ptr [bp - 2], 0x29   ; tile compositado == bola
 *   LOOKOBJ 0x09e8  jne 0xa40                      ; ← todo lo demás (el "\nThou dost
 *                                                  ;   see\n" de DS 0x751c y el
 *                                                  ;   look_dispatch) vive EN LA RAMA
 *                                                  ;   CONTRARIA
 * Consecuencia derivada, no estilística: mirar una bola de cristal **NO imprime
 * «Thou dost see …»** ni la frase de LOOK2.DAT del tile (que es «a crytal sphere»,
 * con la errata del original). Sólo sale la visión.
 *
 * EL FLUJO ENTERO (LOOKOBJ 0x09ea-0xa3e), con las cuatro llamadas ya resueltas a
 * su offset de kernel por `routine_census.resolve_near_call` (base near-call de
 * LOOKOBJ = 0xa290):
 *
 *   0x09ea  call 0xffffa6f8  → ULTIMA.EXE CS:0x4988  resolve_command_char()
 *   0x09f0  inc ax ; jne     → si devolvió -1 (0xFFFF) SALTA AL EPÍLOGO: sin tirada,
 *                              sin mensaje, sin daño. El «None!\n» (DS 0xa3da) ya lo
 *                              imprimió el propio 0x4988 en 0x4a65.
 *   0x09f6  push 1 ; push 0x1e ; call 0x7e02
 *                            → ULTIMA.EXE CS:0x2092  rand_range(min=1, max=30)
 *                              ★ ÚNICA tirada del camino de objetos de (L)ook.
 *   0x0a01  bx = idx << 5 ; cl = byte ptr [bx + 0x55b6]
 *                            → registro de PJ (stride 0x20) + 0x0E = INTELIGENCIA.
 *                              La base del roster es DS 0x55a8 (visible en el propio
 *                              0x4988 @0x4a36 `add ax, 0x55a8` para el nombre), y
 *                              0x55b6 − 0x55a8 = 0x0E; el offset 0x0E del registro es
 *                              `intelligence` (saveNative.ts:186/210, mismo layout).
 *   0x0a0e  cmp cx, ax ; ja 0xa2a
 *                            → GANA la bola si INT > tirada (comparación SIN signo).
 *
 *   rama GANA  (0x0a2a): print DS 0x750a "Strange vision!\n"
 *                        push g_party_x ; push g_party_y ; call 0x10fc = gem_view
 *                        ⇒ la MISMA vista aérea 32×32 del comando (V), pero **SIN
 *                          consumir gema** (el `dec [g_gems]` está en el case V del
 *                          despachador @0x3428, no aquí).
 *   rama PIERDE (0x0a12): print DS 0x74fa "Death vision!\n"
 *                        push idx ; push 1 ; call 0x87c2 → CS:0x2A52 apply_damage(idx,1)
 *                        call 0x8670 → CS:0x2900 redraw del panel de party
 *
 * Cadenas verificadas byte a byte en DATA.OVL (fileoff = DS + 0x10):
 *   DS 0x74fa → b'Death vision!\n'     ·   DS 0x750a → b'Strange vision!\n'
 *
 * apply_damage (CS:0x2A52) es la misma primitiva que ya usa el daño del sol: resta al
 * HP en `[idx*0x20 + 0x55b8]` (= registro+0x10) y, si cae a ≤0, lo fija a 0, escribe
 * status 'D' (0x44) y deselecciona al activo. O sea: **la visión de muerte puede
 * MATAR** a un PJ que esté a 1 HP. Sin RNG en el daño: la constante es 1 (`mov ax,1`
 * en 0x0a1c).
 */

/** Tile de la bola de cristal — `cmp word ptr [bp-2], 0x29` (LOOKOBJ 0x09e4). */
export const CRYSTAL_BALL_TILE = 0x29;

/** Cota inferior de la tirada del contest (`mov ax,1` @0x09f6, primer push = MIN). */
export const CRYSTAL_BALL_ROLL_MIN = 1;
/** Cota superior de la tirada (`mov ax,0x1e` @0x09fa = 30). */
export const CRYSTAL_BALL_ROLL_MAX = 30;
/** Daño de la visión de muerte — literal `mov ax,1` @0x0a1c (apply_damage(idx,1)). */
export const CRYSTAL_BALL_DEATH_DAMAGE = 1;

/**
 * Resuelve el contest INT vs tirada. Función PURA: recibe la tirada ya hecha para
 * que el orden de consumo del stream lo fije el llamador (la tirada va DESPUÉS del
 * gate de -1 del selector, nunca antes).
 *
 * `ja` es comparación sin signo sobre `cx` (INT, byte 0..255) y `ax` (tirada 1..30):
 * el empate PIERDE (INT == tirada → no salta → rama de muerte).
 */
export function crystalBallWins(intelligence: number, roll: number): boolean {
  return (intelligence & 0xff) > roll;
}
