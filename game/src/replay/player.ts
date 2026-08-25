/**
 * REPRODUCTOR de registros: pausa, velocidad y salto.
 *
 * Entrega las teclas por EL MISMO CAMINO que el teclado real (un `KeyboardEvent` de
 * ventana, igual que hace la botonera táctil), no por una puerta trasera: si la
 * repetición usara un atajo, dejaría de probar el juego y pasaría a probar el atajo.
 *
 * 🔴 EL RITMO NO ES EL DEL RELOJ DE PARED GRABADO. No se guardan marcas de tiempo, y
 * es deliberado: el reloj gobierna la animación y no es reproducible. Se avanza por
 * TURNOS. Antes de cada tecla se pregunta `ready()`: si el juego está en una escena
 * modal a reloj de pared (acampada, refuge, cruce de moongate) el input se traga, así
 * que la tecla ESPERA en vez de perderse. Sin esa espera, reproducir a 4× perdería
 * teclas y la partida divergiría.
 *
 * DIVERGENCIA: cada evento lleva el `turnsSinceStart` que resultó al grabarlo. Si al
 * reproducir no coincide, la repetición se DETIENE y lo dice. Es preferible con
 * mucho a seguir pintando una partida que ya no es la del jugador.
 */
import type { ReplayAnchor, ReplayEvent, ReplayLog } from "./types.js";
import { decodeEvents } from "./codec.js";

/** Milisegundos entre teclas a velocidad 1×. Es presentación pura. */
export const BASE_INTERVAL_MS = 140;
/** Teclas por tick durante un salto (velocidad "sin límite"). */
const SEEK_BATCH = 250;

export type PlayerState = "idle" | "playing" | "paused" | "seeking" | "ended" | "diverged";

export interface PlayerStatus {
  state: PlayerState;
  /** Teclas ya entregadas. */
  index: number;
  total: number;
  /** Turno de la última tecla entregada. */
  turn: number;
  lastTurn: number;
  speed: number;
  /** Índice de la tecla en la que divergió, si divergió. */
  divergedAt?: number;
  /** Turno esperado vs observado en la divergencia. */
  divergence?: { expected: number; got: number };
}

export interface PlayerDeps {
  /** Deja el juego EXACTAMENTE en el ancla (estado serializado + semilla del RNG). */
  restore(anchor: ReplayAnchor): void;
  /** ¿Puede el juego consumir una tecla AHORA? false ⇒ hay una escena modal viva. */
  ready(): boolean;
  /** Entrega la tecla por el camino del teclado real. */
  deliver(ev: ReplayEvent): void;
  /** `state.turnsSinceStart` vivo, DESPUÉS de la tecla. */
  turn(): number;
  onChange?(s: PlayerStatus): void;
}

export class ReplayPlayer {
  private events: ReplayEvent[] = [];
  private idx = 0;
  private st: PlayerState = "idle";
  private speed = 1;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seekTarget = 0;
  private divergedAt?: number;
  private divergence?: { expected: number; got: number };
  private anchor: ReplayAnchor | null = null;

  constructor(private readonly deps: PlayerDeps) {}

  status(): PlayerStatus {
    const s: PlayerStatus = {
      state: this.st,
      index: this.idx,
      total: this.events.length,
      turn: this.idx > 0 ? this.events[this.idx - 1]!.turn : 0,
      lastTurn: this.events.length ? this.events[this.events.length - 1]!.turn : 0,
      speed: this.speed,
    };
    if (this.divergedAt !== undefined) {
      s.divergedAt = this.divergedAt;
      if (this.divergence) s.divergence = this.divergence;
    }
    return s;
  }

  /** Carga un registro y deja el juego en su ancla, listo para reproducir. */
  load(log: ReplayLog): void {
    this.stopTimer();
    this.events = decodeEvents({ keys: log.keys, turns: log.turns, mods: log.mods });
    this.anchor = log.anchor;
    this.idx = 0;
    this.divergedAt = undefined;
    this.divergence = undefined;
    this.deps.restore(this.anchor);
    this.st = "paused";
    this.emit();
  }

  play(): void {
    if (this.st !== "paused" && this.st !== "ended") return;
    if (this.st === "ended") this.seek(0);
    this.st = "playing";
    this.emit();
    this.schedule();
  }

  pause(): void {
    if (this.st !== "playing" && this.st !== "seeking") return;
    this.stopTimer();
    this.st = "paused";
    this.emit();
  }

  setSpeed(x: number): void {
    this.speed = Math.max(0.25, x);
    this.emit();
  }

  /** Una sola tecla, con el reproductor pausado. */
  step(): void {
    if (this.st !== "paused") return;
    if (!this.deps.ready()) return;
    this.deliverNext();
    this.emit();
  }

  /**
   * Salta a la tecla `target`. Ir hacia ATRÁS exige rebobinar al ancla y re-ejecutar:
   * no hay atajo honesto — el estado en la tecla N es, por definición, el resultado de
   * las N teclas. Hacia ADELANTE se re-ejecuta desde donde esté.
   */
  seek(target: number): void {
    if (!this.anchor) return;
    this.stopTimer();
    const t = Math.max(0, Math.min(target, this.events.length));
    if (t < this.idx || this.divergedAt !== undefined) {
      this.deps.restore(this.anchor);
      this.idx = 0;
      this.divergedAt = undefined;
      this.divergence = undefined;
    }
    this.seekTarget = t;
    if (this.idx >= t) {
      this.st = "paused";
      this.emit();
      return;
    }
    this.st = "seeking";
    this.emit();
    this.schedule();
  }

  /** Salta al TURNO `turn`: la primera tecla cuyo turno lo alcanza. */
  seekToTurn(turn: number): void {
    let i = this.events.findIndex((e) => e.turn >= turn);
    if (i < 0) i = this.events.length;
    this.seek(i);
  }

  dispose(): void {
    this.stopTimer();
    this.st = "idle";
    this.events = [];
    this.anchor = null;
  }

  // ── interno ──────────────────────────────────────────────────────────────────

  private stopTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    this.stopTimer();
    const delay = this.st === "seeking" ? 0 : Math.max(1, BASE_INTERVAL_MS / this.speed);
    this.timer = setTimeout(() => this.tick(), delay);
  }

  private tick(): void {
    this.timer = null;
    if (this.st !== "playing" && this.st !== "seeking") return;
    // El juego está en una escena modal a reloj de pared: la tecla ESPERA. No se
    // pierde y no se adelanta — es lo que separa una repetición de una divergencia.
    if (!this.deps.ready()) {
      this.schedule();
      return;
    }
    const budget = this.st === "seeking" ? SEEK_BATCH : 1;
    for (let n = 0; n < budget; n++) {
      const limit = this.st === "seeking" ? this.seekTarget : this.events.length;
      if (this.idx >= limit) break;
      if (!this.deps.ready()) break;
      if (!this.deliverNext()) break; // divergió
    }
    if (this.st === "seeking" && this.idx >= this.seekTarget) this.st = "paused";
    else if (this.st === "playing" && this.idx >= this.events.length) this.st = "ended";
    this.emit();
    if (this.st === "playing" || this.st === "seeking") this.schedule();
  }

  /** Entrega la siguiente tecla y comprueba el turno. false ⇒ divergió. */
  private deliverNext(): boolean {
    const e = this.events[this.idx];
    if (!e) return false;
    this.deps.deliver(e);
    this.idx += 1;
    const got = this.deps.turn();
    if (got !== e.turn) {
      this.divergedAt = this.idx - 1;
      this.divergence = { expected: e.turn, got };
      this.st = "diverged";
      this.stopTimer();
      return false;
    }
    return true;
  }

  private emit(): void {
    this.deps.onChange?.(this.status());
  }
}
