/**
 * Declaraciones de tipos para mkoverlay-ad.mjs (generador de overlays del corpus AD/LP2). El tool
 * corre como node plano (sin build); este sidecar da tipos a los unit tests, igual que
 * derive-dungeon-ops.d.mts.
 */

/** Subconjunto del segmento de ruta que la máquina de estado de interior mira. */
export interface SegLike {
  seam?: string | null;
  ctx?: string;
  enter?: { loc?: number | null; banner?: string };
}

/** Estado de la máquina entre segmentos: dentro/fuera de interior + el motivo que se anotará. */
export interface InteriorState {
  inInterior: boolean;
  why: string;
}

/**
 * Un paso de la máquina de estado de interior (función PURA).
 *
 * Gemela de la de mkoverlay-lp1.mjs con UNA diferencia declarada: aquí no existe la regla #89
 * («Underworld» en superficie ABRE interior), porque el estado de este generador CRUZA episodios.
 *
 * `texts` es el recorte de señales del segmento (los 8 primeros bloques de `expect` unidos).
 * `falseEnter` sale a true en el falso-enter de Shadowlord, que NO toca el estado.
 */
export function stepInterior(
  seg: SegLike,
  texts: string,
  state: InteriorState,
): InteriorState & { falseEnter: boolean };
