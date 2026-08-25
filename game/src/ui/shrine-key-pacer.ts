/**
 * ShrineKeyPacer — las ESPERAS DE TECLA del rito de santuario y del Códice (#294).
 *
 * El core marca los once puntos donde `CAST2` llama a `getkey_with_redraw` (`call 0x448c`
 * → kernel `0x266c`) con eventos `{kind:"shrine-key-wait"}`; aquí se PRESENTAN: al toparse
 * con uno, el despachador de eventos APARCA el resto del turno y no lo reanuda hasta que
 * llegue una tecla. Es el mismo trato que ya reciben las escenas paceadas (troll, escena
 * del santuario), con una diferencia que decide el diseño: **no hay temporizador**. Una
 * espera de tecla no tiene constante de reloj de pared, así que este fichero no calibra
 * nada contra el testigo de vídeo ni hereda la unidad de 120 ms de `shrine-scene.ts`.
 *
 * Modal mientras dura: `active` entra en el gate de `refreshAwaiting` (apaga el cursor de
 * consola) y el listener de teclado enruta la PRIMERA tecla aquí — cualquiera vale, como
 * en el binario, donde el filtro Y/N que a veces envuelve a `0x448c` lo pone el LLAMADOR y
 * el rito no lo pone.
 *
 * BAJO AUTOMATIZACIÓN (`instant`) no aparca NADA: `wait()` devuelve `false` y el
 * despachador sigue drenando en el mismo tick. Con eso el orden de eventos —y por tanto
 * e2e, digests y grabaciones— queda IDÉNTICO al previo a #294: la ficha sólo añade pausas
 * para el jugador humano.
 */
import type { GameEvent } from "../core/game.js";

export interface ShrineKeyPacerDeps {
  /** `true` bajo automatización: la espera se salta y el turno drena síncrono. */
  instant: boolean;
  /** Reanuda el turno aparcado (el `applyEvents` de main.ts). */
  applyEvents: (events: GameEvent[]) => void;
  /** Gate del cursor de consola (`active` cuenta como modal abierto). */
  refreshAwaiting: () => void;
}

export class ShrineKeyPacer {
  private parked: GameEvent[] | null = null;

  constructor(private readonly deps: ShrineKeyPacerDeps) {}

  /** ¿Hay un turno aparcado esperando tecla? (modal: traga el input). */
  get active(): boolean {
    return this.parked !== null;
  }

  /**
   * Aparca `rest` (todo lo que el turno tenía DESPUÉS del marcador) hasta que llegue una
   * tecla. Devuelve `true` si ha aparcado — el llamador debe cortar su bucle— y `false`
   * bajo automatización, donde el llamador simplemente sigue.
   */
  wait(rest: GameEvent[]): boolean {
    if (this.deps.instant) return false;
    this.parked = rest;
    this.deps.refreshAwaiting();
    return true;
  }

  /**
   * Tecla recibida: reanuda el turno. El resto puede volver a aparcarse en el acto (el
   * Códice encadena hasta nueve esperas), y por eso `parked` se limpia ANTES de reanudar:
   * si no, la segunda espera escribiría sobre un campo que el retorno iba a borrar y el
   * rito se quedaría mudo a partir de la primera tecla.
   */
  consumeKey(): void {
    const rest = this.parked;
    if (!rest) return;
    this.parked = null;
    this.deps.refreshAwaiting();
    this.deps.applyEvents(rest);
  }

  /** Teardown (cargar partida a mitad de rito): olvida el turno aparcado. */
  cancel(): void {
    this.parked = null;
  }
}
