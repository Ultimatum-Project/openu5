/**
 * Pozo de deseos — easter egg de Ultima V (LOOKOBJ.OVL 0x0042 `wishing_well`).
 *
 * Al mirar/usar un pozo: "Drop a coin?" → si aceptas y tienes oro, cuesta 1 de
 * oro y pregunta "Thy wish?". Si el deseo CONTIENE uno de los nombres de coche
 * (o "Horse") Y estás en Paws (loc 0x16) o Empath Abbey (loc 0x1F), spawnea un
 * caballo ("Poof!"). En cualquier otro sitio el deseo no tiene efecto, pero la
 * moneda se gasta igual. Sin RNG (0 `call rand_range`). Cita: re/notes/shrines.md §4.
 */
import type { GameState } from "../state.js";
import { TILE_HORSE } from "./transport.js";

/** Localizaciones donde el deseo funciona: Paws (0x16) y Empath Abbey (0x1F). */
const WISH_LOCATIONS: readonly number[] = [0x16, 0x1f];

/**
 * Tile del objeto que spawnea el pozo: un caballo (0x10). El binario empuja
 * `mov ax,0x10` en LOOKOBJ 0x0132 (dos veces: push ax en 0x0135 y 0x0136) y llama
 * al callee en LOOKOBJ 0x014e.
 *
 * ⚠ El callee es ULTIMA.EXE 0x3A74 `set_actor_record`, NO «kernel_spawn_object
 * 0x97e4»: `0x97e4` es el OPERANDO CRUDO del near-call (`call 0xffff97e4` en
 * 0x014e), no un desplazamiento del kernel — familia #188. Derivado y corregido en
 * #211 (re/notes/deriv-211-acta.md §6), que barrió `game.ts` y las dos filas de
 * re/deliberate-divergences.md pero NO este docblock.
 *
 * Coincide con world/transport.ts TILE_HORSE.
 */
export const WISH_SPAWN_TILE = TILE_HORSE; // 0x10

/** Tile del pozo (LOOKOBJ 0x0042). NO transitable → el trigger es (L)ook, no pisar. */
export const WELL_TILE = 0xa1;

/**
 * Palabras-clave del deseo que invocan un caballo (substring-match, LOOKOBJ 0x00a2
 * call 0xcc8e). Cadenas byte-exactas de DATA.OVL (DS ptr → fileoff = DS+0x10):
 *   Corvette 0x7242/0x7252, Ferrari 0x724c/0x725c, Lamborghini 0x7254/0x7264,
 *   Lotus 0x7260/0x7270, Porsche 0x7266/0x7276, Horse 0x726e/0x727e.
 * NOTA: la rutina de match (0xcc8e) cae fuera del rango desensamblado, así que si
 * distingue mayúsculas es una PREGUNTA ABIERTA de oráculo; el clon asume
 * case-sensitive (String.includes) — pendiente de confirmar en runtime.
 */
const WISH_HORSE_WORDS: readonly string[] = [
  "Corvette",
  "Ferrari",
  "Lamborghini",
  "Lotus",
  "Porsche",
  "Horse",
];

export type WishOutcome =
  | { kind: "no-coin" } // g_gold==0: no llega a pedir deseo
  | { kind: "nothing" } // deseo vacío (moneda gastada)
  | { kind: "no-effect" } // sin match, o match fuera de Paws/Empath (moneda gastada)
  | { kind: "horse" }; // match en Paws/Empath: spawnea caballo (moneda gastada)

/**
 * Resuelve un deseo ya confirmado ("Drop a coin?" → sí). Muta el oro.
 *   - Sin oro                          → no-coin (no cobra).
 *   - Con oro: cobra 1; deseo vacío     → nothing.
 *   - Match de caballo en Paws/Empath   → horse.
 *   - Cualquier otro caso               → no-effect (la moneda ya se gastó).
 */
export function wishingWell(state: GameState, wish: string): WishOutcome {
  if (state.gold <= 0) return { kind: "no-coin" };
  state.gold -= 1; // la moneda cuesta 1 de oro (LOOKOBJ 0x0086)
  if (wish.length === 0) return { kind: "nothing" };
  const matched = WISH_HORSE_WORDS.some((w) => wish.includes(w));
  if (!matched) return { kind: "no-effect" };
  if (!WISH_LOCATIONS.includes(state.position.location)) return { kind: "no-effect" };
  return { kind: "horse" };
}
