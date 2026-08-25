/**
 * Declaraciones de tipos para mkoverlay-lp1.mjs (generador de overlays del corpus LP1). El tool
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
 * `texts` es el recorte de señales del segmento (los 8 primeros bloques de `expect` unidos), no
 * el segmento entero: es lo que el generador sondea.
 *
 * `falseEnter` sale a true en el falso-enter de Shadowlord —un aviso de overworld leído como
 * banner de location—, que NO toca el estado: el llamador se encarga del patch.
 */
export function stepInterior(
  seg: SegLike,
  texts: string,
  state: InteriorState,
): InteriorState & { falseEnter: boolean };
