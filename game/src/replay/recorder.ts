/**
 * GRABADOR de teclas.
 *
 * 🔴 EL PUNTO DE CAPTURA ES EL DEL CONSUMO, NO EL DEL DOM. Capturar en el `keydown`
 * de ventana se lleva pulsaciones que el juego IGNORA — y esas ignoradas son
 * precisamente las que rompen la repetición, porque el motivo por el que se ignoran
 * es a RELOJ DE PARED: mientras la party duerme en una acampada, mientras corre la
 * escena de refuge, mientras se cruza una moongate, el input se traga. Reproducido a
 * 4× de velocidad, ese mismo tramo YA HA TERMINADO cuando llega la tecla, así que la
 * tecla se ejecuta y la partida diverge. Por eso el protocolo tiene tres tiempos:
 *
 *   note(ev)   — al ENTRAR en el reductor de teclas: la tecla queda "en vuelo".
 *   drop()     — en cada `return` del reductor que significa "el juego la ignoró".
 *   commit(t)  — al SALIR del reductor: si sigue en vuelo, se graba con el turno
 *                resultante. Si se soltó, no se graba nada.
 *
 * El sentido del fallo está elegido: olvidar un `drop()` graba una tecla de más
 * (que la repetición vuelve a ignorar por la misma razón, casi siempre inocuo);
 * olvidar un punto de captura PERDERÍA una tecla, y eso diverge SIEMPRE.
 *
 * El grabador no sabe nada de IndexedDB ni del DOM: es lógica pura y se prueba como tal.
 */
import { encodeEvents, utf8Bytes } from "./codec.js";
import type { ReplayAnchor, ReplayEvent, ReplayLog } from "./types.js";

/** Lo mínimo que el grabador necesita de un `KeyboardEvent` (así se prueba sin DOM). */
export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  code?: string;
}

export class KeyRecorder {
  private events: ReplayEvent[] = [];
  private inFlight: Omit<ReplayEvent, "turn"> | null = null;
  private anchor: ReplayAnchor | null = null;
  private startedAt = 0;

  /** ¿Hay una grabación abierta? */
  get recording(): boolean {
    return this.anchor !== null;
  }
  /** Teclas grabadas hasta ahora. */
  get length(): number {
    return this.events.length;
  }

  /**
   * Abre una grabación anclada a `anchor` (estado serializado + semilla viva del RNG).
   * Descarta cualquier grabación anterior sin cerrar.
   */
  start(anchor: ReplayAnchor): void {
    this.anchor = anchor;
    this.events = [];
    this.inFlight = null;
    this.startedAt = Date.now(); // METADATO de la lista; jamás entra en la repetición
  }

  /** La tecla entra al reductor: queda en vuelo hasta el `commit`/`drop`. */
  note(ev: KeyLike): void {
    if (!this.anchor) return;
    const e: Omit<ReplayEvent, "turn"> = { key: ev.key };
    if (ev.ctrlKey) e.ctrl = true;
    if (ev.metaKey) e.meta = true;
    if (ev.altKey) e.alt = true;
    if (ev.code?.startsWith("Numpad")) e.numpad = true;
    this.inFlight = e;
  }

  /** El juego IGNORÓ la tecla en vuelo: no se graba. */
  drop(): void {
    this.inFlight = null;
  }

  /** Cierra la tecla en vuelo con el turno del juego DESPUÉS de procesarla. */
  commit(turn: number): void {
    if (!this.anchor || !this.inFlight) return;
    this.events.push({ ...this.inFlight, turn });
    this.inFlight = null;
  }

  /** Vista de sólo lectura de lo grabado (para tests y para la barra de progreso). */
  peek(): readonly ReplayEvent[] {
    return this.events;
  }

  /** Cierra la grabación y devuelve el registro. `null` si no había ninguna abierta. */
  stop(label: string): ReplayLog | null {
    if (!this.anchor) return null;
    const streams = encodeEvents(this.events);
    const log: ReplayLog = {
      v: 1,
      id: `replay-${this.startedAt.toString(36)}-${this.events.length.toString(36)}`,
      label,
      createdAt: this.startedAt,
      anchor: this.anchor,
      keys: streams.keys,
      turns: streams.turns,
      mods: streams.mods,
      count: this.events.length,
      lastTurn: this.events.length ? this.events[this.events.length - 1]!.turn : 0,
    };
    this.anchor = null;
    this.events = [];
    this.inFlight = null;
    return log;
  }

  /** Aborta sin producir registro. */
  cancel(): void {
    this.anchor = null;
    this.events = [];
    this.inFlight = null;
  }
}

/**
 * Tamaño MEDIDO de un registro, desglosado. El ancla es un coste ÚNICO (es la
 * partida de partida, ~18 KB de JSON); el objetivo de «~10 KB por hora» es sobre el
 * stream de teclas, que es lo que crece con el tiempo jugado.
 */
export function measureLog(log: ReplayLog): {
  keysBytes: number;
  anchorBytes: number;
  totalBytes: number;
  bytesPerKey: number;
} {
  const keysBytes = utf8Bytes(log.keys) + utf8Bytes(log.turns) + utf8Bytes(log.mods);
  const anchorBytes = utf8Bytes(log.anchor.state) + 8;
  const totalBytes = utf8Bytes(JSON.stringify(log));
  return {
    keysBytes,
    anchorBytes,
    totalBytes,
    bytesPerKey: log.count ? keysBytes / log.count : 0,
  };
}
