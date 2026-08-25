/**
 * REPETICIÓN AL MANTENER PULSADO, con RETARDO INICIAL (auditoría UI/UX móvil
 * 2026-07-25, TANDA C — ítem «la cruceta da DOS pasos con una pulsación»).
 *
 * El defecto medido: la cruceta disparaba el paso en `pointerdown` y montaba acto
 * seguido un `setInterval(220 ms)` SIN retardo inicial, así que una pulsación normal
 * de pulgar (~250 ms de contacto) mandaba DOS `keydown` — dos casillas. En un juego
 * por TURNOS con encuentros aleatorios eso no es un detalle de tacto: es medio
 * combate de más por cada pulsación larga, y el jugador no tiene forma de deshacerlo.
 *
 * El contrato es el de cualquier auto-repeat del sistema (teclado del SO, mandos):
 *   1. el primer disparo es INMEDIATO (el tacto no se retrasa nunca),
 *   2. la repetición NO arranca hasta `startMs` de contacto sostenido — la ventana
 *      donde vive una pulsación normal,
 *   3. a partir de ahí repite cada `repeatMs`.
 *
 * Módulo aparte (y sin DOM) porque es la única forma de PROBARLO: la suite de
 * unidades corre en node sin jsdom, y con temporizadores falsos aquí se asevera la
 * cadencia exacta. `TouchControls` sólo lo cablea a `pointerdown`/`pointerup`.
 */

/** Contacto sostenido antes de que arranque la repetición (ms). El auto-repeat de
 *  teclado de iOS/Android ronda los 400-500 ms; 400 deja fuera cualquier pulsación
 *  deliberada de un paso y sigue sintiéndose vivo al mantener. */
export const HOLD_START_MS = 400;

/** Cadencia de la repetición una vez arrancada (ms). Es la que ya tenía el deck
 *  (220 ms): el defecto era el retardo ausente, no la velocidad. */
export const HOLD_REPEAT_MS = 220;

/**
 * Un solo gesto de mantener-pulsado. `press()` dispara y arma el retardo; `release()`
 * limpia LOS DOS temporizadores (el del retardo y el de la repetición) — soltar
 * durante la ventana de retardo tiene que dejar el gesto en UN disparo exacto, y
 * limpiar sólo el interval (el bug de origen) dejaba el `setTimeout` vivo: el dedo
 * ya no estaba y el personaje seguía andando.
 */
export class HoldRepeat {
  private startHandle: ReturnType<typeof setTimeout> | null = null;
  private repeatHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly fire: () => void,
    private readonly startMs: number = HOLD_START_MS,
    private readonly repeatMs: number = HOLD_REPEAT_MS,
  ) {}

  /** Inicio del contacto: UN disparo inmediato + retardo antes de repetir. */
  press(): void {
    this.release(); // idempotente: un pointerdown nuevo re-arma desde cero
    this.fire();
    this.startHandle = setTimeout(() => {
      this.startHandle = null;
      this.repeatHandle = setInterval(() => this.fire(), this.repeatMs);
    }, this.startMs);
  }

  /** Fin del contacto (pointerup/leave/cancel) o teardown: mata AMBOS handles. */
  release(): void {
    if (this.startHandle !== null) {
      clearTimeout(this.startHandle);
      this.startHandle = null;
    }
    if (this.repeatHandle !== null) {
      clearInterval(this.repeatHandle);
      this.repeatHandle = null;
    }
  }

  /** ¿Hay algún temporizador armado? (diagnóstico y asserts de teardown). */
  get armed(): boolean {
    return this.startHandle !== null || this.repeatHandle !== null;
  }

  /** ¿Ya está en fase de REPETICIÓN (pasado el retardo inicial)? */
  get repeating(): boolean {
    return this.repeatHandle !== null;
  }
}
