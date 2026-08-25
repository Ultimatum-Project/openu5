/**
 * Wander de guardias de pueblo (TOWN.OVL `guard_wander` 0x0C78, Task 3.13).
 *
 * Port bit a bit verificado contra re/disasm/TOWN.OVL.asm. Es el ÚNICO RNG
 * propio de TOWN vivo por turno (aparte del kernel): por cada objeto-guardia
 * (tile & 0xFE == 0x10) en la planta del jugador consume:
 *   rand(0,1)              ; ¿actúa? (actúa si ==0, ~50%)          [0x0CBD]
 *   [4 checks de vecinos tile 0xA2/0x43 — SIN RNG]                 [0x0C4A]
 *   rand(0,1)              ; eje (0=Y, 1=X)                         [0x0D19]
 *   rand(0,1)              ; signo (sign = 2·r − 1 = ±1)           [0x0D27/Y]
 * ⇒ 1 rand si no actúa o si un vecino bloquea; 3 rands si actúa y se mueve.
 *
 * El clon no rastrea objetos-guardia en small maps todavía; este módulo es el
 * motor puro (probado) que consumiría el bucle de pueblo. El cableado en vivo
 * queda para F.2 (requiere la tabla de objetos del pueblo).
 *
 * Matices del asm cerrados en F.2 (re-derivados de TOWN.OVL 0x0C78):
 *  (1) FACING: el binario sólo fija el tile de facing (0x10/0x11) en la rama X
 *      (0x0D36/0x0D3E); la rama Y (0x0D46-0x0D53) salta a 0x0D55 SIN tocar el
 *      tile → mantiene el facing previo. Aquí lo replicamos: la rama Y no re-facea.
 *  (2) DESTINO: además de los 4 checks de vecinos de la posición ACTUAL (0x0C4A
 *      ×4, ANTES de las rands de eje/signo), el original valida el DESTINO tras
 *      calcular x,y con las rands — bounds (0x0D55), tile transitable (0x0D6D/
 *      call 0xAA7C) y casilla libre de objeto (0x0D86/call 0xB532); si falla,
 *      NO se mueve pero ya consumió las 3 rands. Se expone vía `destBlocked`.
 */
import type { RandFn } from "../survival.js";

export interface GuardState {
  x: number;
  y: number;
  /** Tile del objeto (0x10 mira a un lado, 0x11 al otro; base+signo). */
  tile: number;
}

export interface GuardStepResult {
  moved: boolean;
  x: number;
  y: number;
  tile: number;
  /** rands consumidos (1 o 3). */
  rands: number;
}

/**
 * Un paso de un guardia. `neighborBlocks(x,y)` devuelve true si alguno de los 4
 * vecinos de (x,y) es tile 0xA2/0x43 (tile_is_a2_or_43 0x0C4A) — se comprueba
 * sobre la posición ACTUAL, antes de las rands de eje/signo; si bloquea, el
 * guardia no se mueve (pero ya gastó la rand de "¿actúa?").
 *
 * `destBlocked(x,y)` (opcional) valida el DESTINO tras calcular x,y con las rands
 * (bounds/tile transitable/casilla libre — 0x0D55-0x0D8B): si devuelve true el
 * guardia no se mueve, pero ya consumió las 3 rands. Omitirlo replica el
 * comportamiento previo (destino siempre válido).
 */
export function guardWanderStep(
  rand: RandFn,
  guard: GuardState,
  neighborBlocks: (x: number, y: number) => boolean,
  destBlocked?: (x: number, y: number) => boolean,
): GuardStepResult {
  // 0x0CBD: ¿actúa? Actúa si rand(0,1)==0 (je 0xcc7). !=0 → no actúa.
  if (rand(0, 1) !== 0) {
    return { moved: false, x: guard.x, y: guard.y, tile: guard.tile, rands: 1 };
  }
  // 0x0C4A ×4 (vecinos de la posición ACTUAL): si algún vecino es 0xA2/0x43,
  // aborta sin más RNG.
  if (neighborBlocks(guard.x, guard.y)) {
    return { moved: false, x: guard.x, y: guard.y, tile: guard.tile, rands: 1 };
  }
  // 0x0D19: eje. 0 → Y, 1 → X.
  const axis = rand(0, 1);
  // 0x0D27 (X) / 0x0D4D (Y): signo = 2·r − 1.
  const sign = 2 * rand(0, 1) - 1;
  let { x, y, tile } = guard;
  if (axis === 1) {
    x += sign;
    // Sólo la rama X re-facea (0x0D36/0x0D3E: 0x10 si signo>0, 0x11 si <0).
    tile = sign > 0 ? 0x10 : 0x11;
  } else {
    // Rama Y (0x0D46-0x0D53): mueve SIN re-facing — conserva el tile previo.
    y += sign;
  }
  // 0x0D55-0x0D8B: validación del DESTINO tras las 3 rands. Si el destino no es
  // válido, el guardia se queda (posición y tile originales), pero ya gastó 3.
  if (destBlocked?.(x, y)) {
    return { moved: false, x: guard.x, y: guard.y, tile: guard.tile, rands: 3 };
  }
  return { moved: true, x, y, tile, rands: 3 };
}

/**
 * Bucle de guardias del turno de pueblo: procesa cada guardia en la planta del
 * jugador en orden de la tabla de objetos (0x5C5A ascendente). Muta las
 * posiciones y devuelve el total de rands consumidos.
 */
export function guardWander(
  rand: RandFn,
  guards: GuardState[],
  neighborBlocks: (x: number, y: number) => boolean,
  destBlocked?: (x: number, y: number) => boolean,
): number {
  let total = 0;
  for (const guard of guards) {
    const step = guardWanderStep(rand, guard, neighborBlocks, destBlocked);
    guard.x = step.x;
    guard.y = step.y;
    guard.tile = step.tile;
    total += step.rands;
  }
  return total;
}
