/**
 * TERREMOTO — sacudida VERTICAL del viewport (task #29).
 *
 * Primitiva de PRESENTACIÓN compartida por los dos disparadores que el core emite
 * como `{kind:"quake"}`:
 *   1. Clavicémbalo: al completar la melodía secreta en el Castillo de Lord British
 *      (planta 2) el muro se abre y la pantalla tiembla. Confirmado por asm — TOWN
 *      0x0e9e-0x0ea6 (`xor [0x67b9],0xb` + `call 0xffffaea2`, kernel compartido
 *      @0xaea2, también MAINOUT 0x0a7d) — y por TESTIGO.
 *   2. Palabra de poder que rompe el sello de una mazmorra. Confirmado por asm — el
 *      handler del (Y)ell (CMDS 0x12f9) SÍ llama a la rutina de la sacudida (`call 0x70f2`
 *      → kernel compartido @0x3072, el mismo re-blit del viewport que el clavicémbalo).
 *      Cableado en game.ts:3077-3092 (emite `{kind:"quake"}`+sfx juntos).
 *
 * DINÁMICA DERIVADA DEL TESTIGO (autoridad de dinámica visual — HARPSI_SANDALWOOD_
 * QUAKE.mov, medida por phase-correlation a 120 fps, ventana 26.48-27.35 s):
 *   · SÓLO se mueve la ventana de juego (11×11). El HUD, el marco y el texto NO se
 *     mueven → NO es un desplazamiento de start-address de CRTC (que movería todo),
 *     sino un RE-BLIT del viewport con offset. dx≡0 (eje puramente VERTICAL).
 *   · Amplitud: +8 px de la captura (766 px = 200 líneas EGA → ×0.261) = ~2 px EGA.
 *     Con tile de 16 px EGA-nativo en la piel → 2 px de lienzo. Hacia ABAJO desde el
 *     reposo (el contenido baja; el original re-blitea la ventana 2 líneas más abajo).
 *   · Forma de onda: cuadrada. Offset a tope ~0.042 s, luego reposo ~0.075 s. Periodo
 *     ~0.117 s (~8.5 Hz). 8 pulsos. Duración total ~0.85-0.94 s.
 *
 * Clase C (calibrable, no derivado del asm): la CADENCIA exacta (down/period) y el
 * timbre del rumble (speaker.ts). Lo MEDIDO: eje vertical, 2 px EGA, 8 pulsos, ~8.5 Hz.
 *
 * Calco de `ApparitionFlash`/`CombatFxLayer`: sin estado de juego, reloj de pared.
 */

/** Amplitud de la sacudida en px de lienzo (EGA-nativo, tile=16). Testigo: ~2 px EGA. */
export const QUAKE_AMPLITUDE_PX = 2;
/** Nº de pulsos de la sacudida. Testigo: 8. */
export const QUAKE_PULSES = 8;
/** Tramo del pulso con el viewport desplazado (ms). Testigo: ~42 ms. Clase C. */
export const QUAKE_DOWN_MS = 42;
/** Tramo del pulso en reposo (ms). Testigo: ~75 ms → periodo ~117 ms (~8.5 Hz). Clase C. */
const QUAKE_UP_MS = 75;
/** Periodo de un pulso completo (desplazado + reposo). */
export const QUAKE_PERIOD_MS = QUAKE_DOWN_MS + QUAKE_UP_MS;
/** Duración total de la sacudida (8 pulsos). */
export const QUAKE_DURATION_MS = QUAKE_PULSES * QUAKE_PERIOD_MS;

/**
 * Offset VERTICAL (px de lienzo, hacia abajo) de la sacudida a tiempo `t` ms desde el
 * inicio. Onda cuadrada: `QUAKE_AMPLITUDE_PX` durante el tramo desplazado de cada
 * pulso, 0 en el reposo; 0 fuera de `[0, pulses·QUAKE_PERIOD_MS)`. Función PURA (tests).
 * `pulses` = nº de pulsos de la sacudida (default `QUAKE_PULSES` = una sola invocación
 * de la primitiva; la ceremonia del Codex pasa 3× para las tres ráfagas seguidas).
 */
export function quakeOffsetAt(t: number, pulses: number = QUAKE_PULSES): number {
  if (t < 0 || t >= pulses * QUAKE_PERIOD_MS) return 0;
  const phase = t % QUAKE_PERIOD_MS;
  return phase < QUAKE_DOWN_MS ? QUAKE_AMPLITUDE_PX : 0;
}

/**
 * Animador con estado de la sacudida: `trigger(now)` la arranca; `offset(now)` da el
 * desplazamiento vertical del viewport (o 0 cuando terminó, autodesactivándose).
 */
export class QuakeShake {
  private start = 0;
  private running = false;
  /** Nº de pulsos de la sacudida en curso (fija la duración). Ver `trigger`. */
  private pulses = QUAKE_PULSES;

  /** ¿Sacudida viva? (la piel repinta cada frame mientras lo esté). */
  get active(): boolean {
    return this.running;
  }

  /**
   * Arranca (o reinicia) la sacudida a tiempo `now` (ms de reloj de pared). `pulses`
   * fija su duración: default `QUAKE_PULSES` (una invocación de la primitiva kernel
   * 0x3072); la ceremonia final del Codex dispara la primitiva 3× seguidas (CAST2
   * 0x0dc0/0dd7/0dee) → la piel pide `3·QUAKE_PULSES` para una sacudida sostenida (la
   * separación exacta entre ráfagas es Clase C, ver game.ts `runShrineCeremony`).
   */
  trigger(now: number, pulses: number = QUAKE_PULSES): void {
    this.start = now;
    this.running = true;
    this.pulses = Math.max(1, pulses);
  }

  /** Corta la sacudida (cambio de piel / desmontaje). */
  clear(): void {
    this.running = false;
  }

  /** Offset vertical (px) a tiempo `now`; 0 y autodesactivación al terminar. */
  offset(now: number): number {
    if (!this.running) return 0;
    const t = now - this.start;
    if (t >= this.pulses * QUAKE_PERIOD_MS) {
      this.running = false;
      return 0;
    }
    return quakeOffsetAt(t, this.pulses);
  }
}
