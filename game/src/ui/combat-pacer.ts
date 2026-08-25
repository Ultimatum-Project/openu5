/**
 * CombatPacer — pacer de la tanda enemiga + cola de teclas del combate.
 *
 * PACER de la tanda enemiga (careo-combate T11): el original resuelve cada acción
 * enemiga a ~0.4 s (serie n6 t=30-42 s: log-changes cada 380-430 ms); el port
 * resolvía TODA la tanda en un while sin pausa. El paceo vive AQUÍ (presentación),
 * no en el core: cada beat procesa UN tickEnemyTurnStep y agenda el siguiente.
 * Mientras hay beat en vuelo el input de combate se ENCOLA (como el buffer BIOS
 * del original — jamás se pierde una tecla) y se drena al terminar la tanda.
 *
 * BAJO AUTOMATIZACIÓN (navigator.webdriver: playwright/e2e/grand-tour) el beat es 0
 * → la tanda se resuelve SÍNCRONA como siempre (byte-idéntico al flujo previo: los
 * drivers pulsan sondeando estado y un beat real re-ordenaría sus teclas → drift de
 * digests). Es un knob de PRESENTACIÓN (no toca core/RNG). `?combeat=<ms>` fuerza
 * el valor — el composition root computa ENEMY_BEAT_MS y lo inyecta aquí.
 *
 * Extraído de boot() (auditoría MANT-1/ARQ-2/Q2: el bloque entero era un closure
 * inimportable — la clase exacta de la regresión combatPacer aterrizaba en verde).
 * Deps inyectadas (patrón shop-console.ts); el ciclo de vida es ahora testeable
 * por vitest con fake timers (tests/combat-pacer-unit.test.ts).
 */
import type { Game } from "../core/game.js";

/** Evento mínimo que fluye del motor al combatOut (estructural). */
export interface PacerEvent {
  kind: string;
}

/** Vista mínima del motor de combate que consume el pacer (estructural). */
export interface PacerCombat {
  over: boolean;
  currentUnit?: { kind: string; charmed?: boolean } | null;
  tickEnemyTurnStep(): readonly PacerEvent[];
  tickEnemyTurns(): readonly PacerEvent[];
}

export interface CombatPacerDeps {
  /** Beat de la tanda (ENEMY_BEAT_MS): 0 = drain síncrono (webdriver). */
  beatMs: number;
  /** Motor de combate vivo (o null si el combate cerró). */
  combat: () => PacerCombat | null;
  /** Salida de eventos de combate (combatOut del composition root). */
  combatOut: (events: readonly PacerEvent[]) => void;
  /** `applyEvents(game.endCombat())` — cierre del combate al agotarse. */
  endCombat: () => void;
  hudRefresh: () => void;
  refreshAwaiting: () => void;
  /** Re-entrega de una tecla drenada al handler de combate. */
  handleKey: (key: string) => void;
}

export class CombatPacer {
  private pacer: ReturnType<typeof setTimeout> | null = null;
  private queue: string[] = [];
  private pumpGuard = 0;
  /**
   * PAUSA BLOQUEANTE de un cue (#212). Separada de `pacer` a propósito: `step()` re-arma
   * `pacer` en cada beat y clobbearía el temporizador de la pausa, dejándolo huérfano.
   */
  private blocking: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly deps: CombatPacerDeps) {}

  /**
   * ¿Hay un beat de la tanda enemiga O una pausa bloqueante en vuelo? Gobierna a la vez el
   * encolado de teclas (`main.ts`) y el apagado del cursor/prompt (`refreshAwaiting`): en el
   * original, durante la fanfarria de victoria el bucle NO está en su `getkey`.
   */
  get pacing(): boolean {
    return this.pacer !== null || this.blocking !== null;
  }

  /**
   * PAUSA BLOQUEANTE POR CUE (#212 — «hay una PAUSA mientras suena», reporte del usuario).
   *
   * DERIVACIÓN (`COMBAT.OVL` `combat_main_loop`, base 0xA290; cuerpo leído):
   *   0x0cf6  print DS 0x6f00 "\nVICTORY!\n"   0x0cfd  g_cmb_victory_flag = 1
   *   0x0d02  call → ULTIMA.EXE:0x4368 `sfx_victory_fanfare`
   *   0x0d05  call → ULTIMA.EXE:0x1b16
   *
   * 🔴 LA PAUSA NO ES UNA ESPERA APARTE, Y ESO IMPORTA: en 0x0cf6-0x0d05 NO hay ningún
   * `call 0x3ae6` (el «run-n-frames» que sí usan el peaje y el ritual del shard). Lo que
   * para el juego es la fanfarria MISMA — `tone_sweep` bit-banguea el gate del altavoz en
   * un bucle software y no vuelve hasta acabar (#206: «el audio ES el reloj»). Por eso la
   * duración NO se cablea: se PIDE al catálogo (`cueDurationMs`), y si la calibración del
   * altavoz cambia, la pausa cambia con ella. Un número aquí sería una segunda verdad.
   *
   * 🔴 Y LA COLA SE TIRA, NO SE DRENA — es el discriminante de esta pausa. `0x1b16` escribe
   * `0x40:0x1A` y `0x40:0x1C` (cabeza y cola del búfer de teclado de la BIOS) al MISMO valor
   * 0x1E: es un VACIADO. Lo que teclees mientras suena la fanfarria el original lo TIRA. Es
   * la conducta opuesta a la del beat de la tanda enemiga, cuya cabecera dice «jamás se
   * pierde una tecla» — y es cierto ahí, porque ahí el binario no vacía nada. Dos esperas
   * del mismo fichero con reglas opuestas, cada una con su cita.
   *
   * ACOTAMIENTO: sólo la piden los cues de `BLOCKING_CUES` (`speaker.ts`), y el composition
   * root pasa la duración ya resuelta. Con `beatMs === 0` (automatización: playwright/e2e/
   * grand-tour) NO hay pausa, por la MISMA razón que no hay beat — los drivers pulsan
   * sondeando estado y una espera real re-ordenaría sus teclas → drift de digests.
   */
  /**
   * `flushKeys` (#328): el vaciado del búfer es EXCLUSIVO de la pausa de la fanfarria
   * (su 0x1b16, arriba). Las pausas por `run-n-frames` 0x3AE6 (p. ej. los 4 fotogramas
   * del arrastre del Corpser, COMSUBS 0x03F2-0x03F6) NO tocan el búfer BIOS: 0x3AE6 es
   * [0x5910 + delay_ticks(1)] × n, sin una sola escritura a 0x40:0x1A/0x1C — lo tecleado
   * durante la pausa se conserva y se drena al reanudar, como en el original.
   */
  armBlockingPause(ms: number, flushKeys = true): void {
    if (this.deps.beatMs <= 0 || ms <= 0) return; // automatización: flujo síncrono intacto
    if (this.blocking !== null) return; // idempotente (el latch de victoria ya es único)
    this.blocking = setTimeout(() => {
      this.blocking = null;
      if (flushKeys) this.queue = []; // 0x1b16: vaciado del búfer de teclado — NO se re-entregan
      this.deps.hudRefresh();
      this.deps.refreshAwaiting();
      this.step(); // reanuda la tanda que la pausa dejó en suspenso
    }, ms);
    this.deps.refreshAwaiting(); // cursor/prompt apagados durante la pausa
  }

  /** Teclas encoladas esperando el drenaje (sonda e2e Q2/G3). */
  get queued(): number {
    return this.queue.length;
  }

  get beatMs(): number {
    return this.deps.beatMs;
  }

  /**
   * Tanda enemiga paceada en vuelo (T11): la tecla se ENCOLA (buffer BIOS del
   * original) y se drena al terminar la tanda — no se procesa ni se pierde.
   */
  enqueue(key: string): void {
    this.queue.push(key);
  }

  /** Arranca (o continúa) el pump de la tanda enemiga tras una acción del PJ. */
  pump(): void {
    if (this.pacer !== null) return; // tanda ya en vuelo: la cadena sigue sola
    this.pumpGuard = 0;
    this.step();
  }

  /**
   * Procesa turnos enemigos y el fin de combate tras cada acción del jugador,
   * PACEADOS a ~0.4 s por acción (careo-combate T11, serie n6). Cada beat corre UN
   * `tickEnemyTurnStep` (la IA conduce a los enemigos Y a los PJ POSEÍDOS — Sword
   * of Chaos / charmed, combat.ts:1865) y agenda el siguiente; al agotarse la tanda
   * se cierra el combate si toca y se DRENA la cola de teclas encoladas durante
   * el paceo. El core no lleva sleeps: el ritmo es 100% presentación.
   */
  private step(): void {
    // Pausa bloqueante en vuelo (#212): el bucle del original está DENTRO de `tone_sweep`
    // y no avanza. Sale por aquí sin agendar nada — la reanudación la hace la propia pausa.
    if (this.blocking !== null) return;
    const deps = this.deps;
    const combat = deps.combat();
    const aiTurn = (): boolean =>
      !!(
        deps.combat() &&
        combat &&
        !combat.over &&
        (combat.currentUnit?.kind === "enemy" || combat.currentUnit?.charmed)
      );
    if (deps.beatMs > 0) {
      // PACEO REAL (hotfix combate #1): `tickEnemyTurns` drena la tanda ENTERA
      // en una llamada (combat.ts, guard 512) — el while paceado previo asumía
      // una-acción-por-llamada y por eso el beat jamás se armaba (la tanda salía
      // en ráfaga síncrona, invisible). Ahora cada beat corre UN
      // `tickEnemyTurnStep` (una acción de IA) y agenda el siguiente; el beat
      // corre también ANTES de la primera acción (la cadencia del main-loop
      // original 0x0B94 espacia cada turno, incluida la apertura: el enemigo no
      // se mueve en el mismo frame en que aparece la arena — el «salto» del
      // reporte #2).
      if (aiTurn() && this.pumpGuard++ < 128) {
        this.pacer = setTimeout(() => {
          this.pacer = null;
          const cb = deps.combat();
          if (cb && !cb.over) {
            deps.combatOut(cb.tickEnemyTurnStep());
            deps.hudRefresh();
          }
          this.step();
        }, deps.beatMs);
        deps.refreshAwaiting(); // cursor/prompt apagados durante la tanda
        return;
      }
    } else {
      // Beat 0 (automatización webdriver): drain síncrono, byte-idéntico al
      // flujo previo (los drivers pulsan sondeando estado).
      while (aiTurn() && this.pumpGuard++ < 128) {
        deps.combatOut(combat!.tickEnemyTurns());
        deps.hudRefresh();
      }
    }
    if (deps.combat() && combat && combat.over) {
      deps.endCombat();
    }
    deps.hudRefresh();
    deps.refreshAwaiting();
    // Drena las teclas encoladas durante la tanda (el getkey del original las
    // recoge del buffer BIOS al volver al await — mismo orden, ninguna perdida).
    while (this.queue.length > 0 && this.pacer === null) {
      const key = this.queue.shift()!;
      if (!deps.combat()) {
        this.queue = [];
        break;
      }
      deps.handleKey(key);
    }
  }
}

/** Alias de tipo para el composition root (firma de Game.combat). */
export type GameCombat = NonNullable<Game["combat"]>;
