/**
 * APARICIÓN del campamento (OUTSUBS camp_results, kernel 0x7F56, gate 25 %). Una FIGURA
 * se materializa — el sprite "Apparation" (tile 0x174, grupo de 4 frames cyan brillante,
 * 0x174-0x177) — QUIETA en el CENTRO (la celda del fuego, 5,5), y cura a la party: N
 * pulsos (uno por miembro vivo) de inversión de paleta EGA + su campanilla, CON LA FIGURA
 * INMÓVIL. NO se pasea de miembro en miembro (eso era mi error — corregido por el testigo
 * a 60 fps: figura fija en (5,5), medido por alineación a las rocas de la arena, 18/20).
 *
 * Presentación PURA (patrón #71): no toca el core. El discurso de karma y las campanillas
 * por miembro ya viajan como eventos (`campWake`). La inversión = composite `difference`
 * de blanco sobre el viewport (255−c por canal = volteo EGA); la figura se blitea sobre la
 * escena ANTES de invertir (se invierte con ella, como el testigo).
 *
 * Clase C (calibrable): duración de cada pulso (`INVERT_MS`/`GAP_MS`, testigo ≈2.75 s +
 * ≈0.5 s). Lo DERIVADO: la figura 0x174 FIJA en (5,5), y N pulsos = miembros vivos.
 */

/** Tile de la figura de la aparición — "Apparation1" (0x174), grupo de 4 frames cyan. */
export const APPARITION_FIGURE_TILE = 0x174;
/** Nº de frames del grupo de animación de la figura (0x174-0x177). */
export const APPARITION_FIGURE_FRAMES = 4;
/** Celda FIJA de la figura — el centro/hoguera (5,5). Medido a 60 fps (rel-fuego (0,0)). */
export const APPARITION_FIGURE_CELL = { col: 5, row: 5 } as const;
/**
 * Duración de cada pulso de inversión (ms). **Clase C, y ahora se sabe POR QUÉ**
 * (#166/G1, `re/notes/cadencia-delay-pit.md`): el pulso es el hueco entre el
 * `rect_XOR(8,8,0xb7,0xb7)` (OUTSUBS 0x08aa) y el primer render posterior
 * (`run_n_frames(1)` @0x08d5), y lo único que hay en medio es
 * `tone_sweep(1,0x9c4,0xea60,1,0x157c)` @0x08c1 — **`pcspeaker_tone_sweep` 0x2192,
 * un busy-wait cuyo retardo INTERIOR está calibrado a la CPU (`g_snd_delay_calib`,
 * medido al arrancar contra INT 1Ch @0x11b4) pero cuyo cuerpo EXTERIOR no lo está**.
 * ⇒ el pulso dura lo que dura el HOST y **no tiene una cifra en ms derivable**.
 *
 * Por eso los tres testigos no concuerdan y no hay que reconciliarlos: son tres
 * capturas de DOSBox distintas — 2200 aquí, ≈2,75 s en el testigo con el que se
 * calibró, y **4567 ms medidos en el corpus Lord Fenton** (7 muestras, ep02 y ep12,
 * ±33 ms; durante el pulso el viewport está congelado del todo, que es la firma del
 * barrido). El asm no arbitra entre las tres. Recalibrable sin tocar la mecánica.
 *
 * Lo que el asm SÍ fija y el port ya deriva: **N pulsos = miembros vivos** (bucle
 * 0x07fb) y la figura 0x174 fija en (5,5).
 */
export const APPARITION_INVERT_MS = 2200;
/** Hueco entre pulsos (ms). Clase C por el mismo motivo (la campanilla `a2=0x1388`
 *  @0x0896 es el mismo `tone_sweep`); testigo ≈0.5 s, LF mide 867 ms. */
export const APPARITION_GAP_MS = 450;
/**
 * COLA DE DISCURSO tras el último pulso (ms): la figura sigue materializada, con TODO
 * el party ya de pie, mientras el discurso de karma + "…vanishes…" están en consola —
 * en el original la escena aguanta hasta la tecla del getkey 0x0961 y el dissolve
 * 0x097e la cierra. Duración Clase C (el original espera tecla; el port pacea).
 */
export const APPARITION_SPEECH_HOLD_MS = 4000;

/** Estado de un frame de la aparición: dónde va la figura (siempre el centro) + si invierte. */
export interface ApparitionFrameState {
  /** Celda de la figura — SIEMPRE el centro (5,5); no se mueve. */
  figureCell: { col: number; row: number };
  /** ¿Invertir la paleta del viewport este frame? (ventana de inversión del pulso). */
  invert: boolean;
  /**
   * Índice del pulso en curso (0-based; en la cola de discurso = último pulso). El
   * bucle por-miembro del original (OUTSUBS 0x07fb) DESPIERTA al miembro vivo i-ésimo
   * al arrancar su pulso (tile de pie ANTES de campanilla+flash, 0x0868<0x0896): la
   * piel pinta de pie a los miembros vivos 0..pulse de la escena de camp.
   */
  pulse: number;
}

/** Duración total de la aparición para `pulses` pulsos + cola de discurso (main.ts
 *  desmonta la escena al fin; el "vanishes" del original = dissolve 0x097e). */
export function apparitionDurationMs(pulses: number): number {
  const n = Math.max(0, pulses);
  return n * (APPARITION_INVERT_MS + APPARITION_GAP_MS) + (n > 0 ? APPARITION_SPEECH_HOLD_MS : 0);
}

/**
 * Animador con estado de la aparición: `trigger(now, pulses)` con el nº de miembros vivos;
 * `frame(now)` da el estado (figura fija en el centro + si invierte), o `null` al terminar
 * (y se autodesactiva). La piel blitea la figura en `figureCell` y aplica la inversión.
 * Calco de `CombatFxLayer`; sin core.
 */
export class ApparitionFlash {
  private start = 0;
  private pulses = 0;

  /** ¿Aparición viva? (la piel repinta cada frame mientras lo esté). */
  get active(): boolean {
    return this.pulses > 0;
  }

  /** Arranca la aparición: `pulses` (= miembros vivos) inversiones con la figura quieta. */
  trigger(now: number, pulses: number): void {
    if (pulses <= 0) return;
    this.start = now;
    this.pulses = pulses;
  }

  /** Corta la aparición (cambio de piel / cancelación). */
  clear(): void {
    this.pulses = 0;
  }

  /**
   * Estado del frame a tiempo `now`, o `null` si ya terminó (y se autodesactiva). La figura
   * SIEMPRE está en el centro; en `[i·period, i·period + INVERT_MS)` de cada pulso invierte.
   * Tras el último pulso aguanta `APPARITION_SPEECH_HOLD_MS` sin invertir (discurso).
   */
  frame(now: number): ApparitionFrameState | null {
    if (this.pulses <= 0) return null;
    const period = APPARITION_INVERT_MS + APPARITION_GAP_MS;
    const t = now - this.start;
    if (t < 0 || t >= apparitionDurationMs(this.pulses)) {
      this.pulses = 0;
      return null;
    }
    const inHold = t >= this.pulses * period; // cola de discurso: todos despiertos, sin invertir
    return {
      figureCell: { col: APPARITION_FIGURE_CELL.col, row: APPARITION_FIGURE_CELL.row },
      invert: !inHold && t % period < APPARITION_INVERT_MS,
      pulse: inHold ? this.pulses - 1 : Math.floor(t / period),
    };
  }
}

/** Fase del pulso `idx` a tiempo `t` (para tests): invert / gap / speech / done. */
export function apparitionPhaseAt(
  t: number,
  pulses: number,
): "invert" | "gap" | "speech" | "done" {
  const period = APPARITION_INVERT_MS + APPARITION_GAP_MS;
  if (t < 0 || t >= apparitionDurationMs(pulses)) return "done";
  if (t >= pulses * period) return "speech"; // cola de discurso (karma + vanishes)
  return t % period < APPARITION_INVERT_MS ? "invert" : "gap";
}
