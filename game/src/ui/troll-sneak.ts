/**
 * TrollSneak — pacer del CRUCE DEL PUENTE con trolls (MAINOUT 0x1c0e-0x1ca6).
 *
 * El original pacea el preámbulo con el kernel 0x3AE6 — que NO es un beep sino
 * RUN-N-FRAMES (bucle n × [tick de frame 0x5910 + delay 0x20fa(1)]; adenda
 * fanfarria-re 2026-07-22, re/notes/fanfarria-endgame-espectral.md §3): PAUSA
 * MUDA con render (el único sonido posible del tick es el ambiente 0x4102, que
 * en el port ya corre por su propio reloj). pause(10) tras el `Thou spieth...`
 * (0x1c19) y pause(5) antes de CADA punto de `$ sneaks across...` (0x1c56-0x1c65).
 * 1 unidad = 1 tick INT 1Ch (0x20FA) ≈ 54.9 ms — CALCO derivado, no calibración:
 * pause(10) ≈ 549 ms, pause(5) ≈ 275 ms (careo testigo aulddragon P02 26:20:
 * preámbulo→nombre ≈ 700 ms, punto a punto ≈ 200-300 ms — cuadra con 55 ms/unidad
 * + prints). El zumbido 70 Hz que el port emitía aquí modelaba el ARTEFACTO del
 * host del testigo, no al binario — RETIRADO (cue `endgame-beep` jubilado).
 * El resto de eventos del turno (troll-toll-prompt `Caught!...` o nada) se
 * DIFIERE hasta agotar los beats — en el original todo esto es síncrono dentro
 * del turno, así que nada legítimo puede colarse en medio. Input tragado
 * mientras corre (getkey no se lee durante la secuencia; el buffer BIOS del
 * original es irrelevante aquí porque la piel re-entrega el turno intacto).
 * BAJO AUTOMATIZACIÓN (navigator.webdriver) la unidad es 0 → todo síncrono,
 * byte-idéntico al flujo previo (e2e/digests sin drift). `?trollbeat=<ms>`
 * fuerza la unidad — el composition root computa TROLL_UNIT_MS y lo inyecta.
 *
 * Extraído de boot() (auditoría MANT-1/ARQ-2). Deps inyectadas (patrón
 * shop-console.ts); ciclo de vida testeable por vitest con fake timers.
 */
import type { Game, TrollSneakScript } from "../core/game.js";

export interface TrollSneakDeps {
  /** ms por unidad de pausa 0x3AE6 (0 = drain síncrono bajo automatización). */
  unitMs: number;
  hud: { message(text: string): void; messageAppend(text: string): void };
  applyEvents: (events: ReturnType<Game["move"]>) => void;
  refreshAwaiting: () => void;
  cancelAutoWalk: () => void;
}

export class TrollSneak {
  private timer: number | null = null;
  private _active = false;

  constructor(private readonly deps: TrollSneakDeps) {}

  /** ¿Secuencia sneaks en curso? (modal: el input se traga mientras corre). */
  get active(): boolean {
    return this._active;
  }

  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this._active = false;
  }

  /**
   * Reproduce el guión sneaks a reloj de pared y al agotar los beats reanuda el
   * RESTO del turno diferido (`rest`: troll-toll-prompt `Caught!...` o nada).
   * Con unidad 0 (automatización) drena todo síncrono.
   */
  run(script: TrollSneakScript, rest: ReturnType<Game["move"]>): void {
    const { unitMs, hud, applyEvents, refreshAwaiting, cancelAutoWalk } = this.deps;
    cancelAutoWalk();
    this.cancel();
    this._active = true;
    refreshAwaiting();
    let i = 0;
    const step = (): void => {
      this.timer = null;
      while (i < script.beats.length) {
        const beat = script.beats[i++]!;
        if (beat.message) hud.message(beat.message);
        if (beat.append) hud.messageAppend(beat.append);
        if (beat.pauseUnits && unitMs > 0) {
          // 0x3AE6(n) = run-n-frames: espera n ticks MUDA y retorna (sin RNG).
          this.timer = window.setTimeout(step, beat.pauseUnits * unitMs);
          return;
        }
      }
      this._active = false;
      applyEvents(rest); // reanuda el turno diferido (Caught!+prompt, o nada)
      refreshAwaiting();
    };
    step();
  }
}
