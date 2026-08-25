/**
 * TOLERANCIA DEL TAP DE ATAQUE (auditoría UI/UX móvil 2026-07-25, TANDA C).
 *
 * Defecto medido: en combate, tocar al enemigo manda `playerAttack(celda)` con la celda
 * EXACTA bajo el dedo, y en un teléfono en vertical la casilla mide 19,5 px CSS — menos
 * de la mitad del objetivo táctil mínimo (44). Diez píxeles de error (la mitad de la
 * yema) caen en la casilla vecina, el original responde «Nothing!» y el TURNO SE QUEMA:
 * el enemigo contraataca gratis. No hay forma de deshacerlo.
 *
 * Esto se arregla SÓLO EN LA PRESENTACIÓN: el core no se toca. Lo que se ajusta es a qué
 * celda apunta el intent ANTES de entrar al comando — exactamente el mismo tipo de
 * corrección de puntería que hace cualquier port táctil, y el equivalente táctil del
 * cursor de Aim del original (que arranca sobre el último objetivo, no sobre el dedo).
 *
 * REGLA DELIBERADAMENTE CONSERVADORA (nunca adivina):
 *   · la celda tocada TIENE enemigo            → esa (sin tocar nada);
 *   · no tiene, y hay EXACTAMENTE UNO a distancia Chebyshev ≤1 → ése;
 *   · no tiene, y hay 0 o ≥2 candidatos        → la celda tocada, tal cual.
 * Con dos vecinos posibles el port NO elige por el jugador (elegiría mal la mitad de las
 * veces y en un juego por turnos eso es peor que el fallo honesto); con cero, el
 * «Nothing!»/«Out of range» del binario se conserva íntegro — incluido el tap deliberado
 * a suelo vacío, que en el original también gasta el golpe.
 */

/** Lo mínimo que necesita saber esta capa de un objetivo: dónde está. */
export interface SnapTarget {
  x: number;
  y: number;
}

/** Distancia de rey (la del alcance melé del original: 8 vecinos). */
function chebyshev(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/**
 * Celda a la que debe apuntar el ataque táctil. `targets` = enemigos ATACABLES ya
 * filtrados por el llamante (vivos y visibles: quién es atacable lo decide el core, no
 * esta capa).
 *
 * Devuelve siempre una celda — nunca `null` — para que el camino del comando sea el
 * mismo con y sin ajuste (el core sigue teniendo la última palabra sobre alcance,
 * línea de tiro y aciertos).
 */
export function snapAttackCell(
  tap: SnapTarget,
  targets: readonly SnapTarget[],
  radius = 1,
): SnapTarget {
  if (targets.some((t) => t.x === tap.x && t.y === tap.y)) return { x: tap.x, y: tap.y };
  const near = targets.filter((t) => chebyshev(t.x, t.y, tap.x, tap.y) <= radius);
  if (near.length !== 1) return { x: tap.x, y: tap.y };
  return { x: near[0]!.x, y: near[0]!.y };
}
