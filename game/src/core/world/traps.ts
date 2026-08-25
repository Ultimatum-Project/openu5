/**
 * Detección de trampas al examinar un cofre (SJOG `search_trap_check` @0x02ea).
 *
 * Función PURA re-derivada del asm (re/notes/sjog.md §trap). El caller (open/
 * jimmy, Task 3.9/3.13) provee la dificultad del item y el stat de percepción del
 * miembro, y una tirada rand(1,30). Devuelve el mensaje EXACTO de percepción.
 *
 * Umbral (0x030d–0x0330):
 *   - no atrapado (bit 0x80 = 0): threshold = (30 − stat) >> 1
 *   - atrapado:                    threshold = ((diff&0x7f) − stat + 30) >> 1
 * Éxito = `roll >= threshold` (roll = rand(1,30), 0x033d).
 *
 * El stat es la **Inteligencia** del miembro: record+0x0e (0x55b6). Prueba
 * definitiva en ZSTATS draw_stat_page — imprime 'Int=' (DS 0x96e8) desde
 * [bx+0x0e] y 'Dex=' (DS 0x96f4) desde [bx+0x0d].
 *
 * ⚠ NO UNIFICAR con el chequeo de trampa de MAZMORRA (`dungeon.ts`, cofre 0x40).
 * Parecen el mismo código y son DOS RUTINAS DISTINTAS del binario (careo t#58):
 *
 *            | mundo — SJOG 0x02ea (este fichero) | mazmorra — SJOG 0x0646 (dungeon.ts)
 *   stat     | **INT**, [bx+0x55b6] = record+0x0e | **DEX**, [bx+0x55b5] = record+0x0d (0x06be)
 *   umbral   | 30−stat / (mag−stat+30)            | floor*2 − stat + 30 (0x06c5-0x06cc)
 *   clasif.  | por MAGNITUD del byte de dificultad| por `rand(1,8)` (<4 / [4,7) / ≥7)
 *   mensajes | «no trap!» / «a simple trap!» …    | «No trap» / «A simple trap» … (sin `!` ni `\n`)
 *
 * Las dos comparten el `shr` SIN SIGNO de 16 bits para el wrap con stats editadas,
 * y ahí acaba el parecido. Fundirlas rompería las dos a la vez.
 */

/** Byte de dificultad del item; bit 0x80 = atrapado, bits 0..6 = magnitud. */
export interface TrapCheckInput {
  /** Byte de dificultad (0x5c5f del actor); 0x80 = atrapado. */
  difficulty: number;
  /** Inteligencia del miembro (record+0x0e). */
  perceptionStat: number;
  /** Tirada del original: rand(1,30), ambos inclusive. */
  roll: number;
}

export interface TrapCheckResult {
  /** ¿Percibió correctamente el estado de la trampa? */
  success: boolean;
  /** ¿El cofre estaba realmente atrapado? */
  trapped: boolean;
  /** Mensaje EXACTO mostrado, con '\n' final (strings 0x864a/0x8654/0x8664/0x8676). */
  message: string;
}

/** Umbral de percepción (0x030d–0x0330). Ambas ramas convergen en un `shr ax,1`
 *  SIN SIGNO de 16 bits (0x0330 `d1e8`) sobre un ax que puede quedar negativo
 *  (rama no-atrapada: `sub ax,0x1e; neg ax` = 30−stat en word, 0x0311-0x0314).
 *  Con INT editada > 30 (no atrapado) o > diff+30 (atrapado) el original wrapea
 *  a umbral ≈ 0x7Fxx → la percepción FALLA SIEMPRE; un `>>` con signo daría
 *  umbral negativo → éxito siempre (auditoría byte-wrap, re/notes/audit-byte-wrap.md). */
export function trapThreshold(difficulty: number, perceptionStat: number): number {
  const trapped = (difficulty & 0x80) !== 0;
  if (!trapped) {
    return ((30 - perceptionStat) & 0xffff) >>> 1;
  }
  return (((difficulty & 0x7f) - perceptionStat + 30) & 0xffff) >>> 1;
}

/**
 * Chequeo de percepción de trampa. Reproduce la tabla de mensajes de 0x0351–0x039d:
 *   - success != trapped → "no trap!\n" (0x864a)
 *   - success && trapped (0x036e/0x0388): diff<0x0a "a simple trap!\n"; diff>0x14
 *     "a complex trap!\n"; en medio "a trap!\n"
 *   - !success && !trapped (0x0388 je 0x39a): SIEMPRE "a trap!\n"
 */
export function trapCheck({ difficulty, perceptionStat, roll }: TrapCheckInput): TrapCheckResult {
  const trapped = (difficulty & 0x80) !== 0;
  const diff = difficulty & 0x7f;
  const success = roll >= trapThreshold(difficulty, perceptionStat);

  let message: string;
  if (success !== trapped) {
    // (success && !trapped) || (!success && trapped) → percibe "sin trampa".
    message = "no trap!\n";
  } else if (success) {
    // success && trapped: identifica la trampa; magnitud → simple/normal/compleja.
    message = diff < 0x0a ? "a simple trap!\n" : diff > 0x14 ? "a complex trap!\n" : "a trap!\n";
  } else {
    // !success && !trapped: falso positivo, siempre "a trap!".
    message = "a trap!\n";
  }
  return { success, trapped, message };
}
