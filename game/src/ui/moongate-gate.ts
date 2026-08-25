/**
 * MoongateTransitGate — gate modal del cruce de moongate.
 *
 * En el binario kernel_moongate_enter (0x48a8) es SÍNCRONA — disolución del
 * jugador (0x1068) + cierre 16→0 (0x4912-0x492b, delay(2) por etapa) — y NO lee
 * input mientras corre. Nuestra piel la pacea a reloj de pared, así que el input
 * debe tragarse mientras dure (modal como la acampada); sin esto, moverse
 * durante el cruce ARRASTRABA la puerta de llegada con el jugador (el overlay de
 * cierre va centrado sobre el party) — testigo del usuario 2026-07-22.
 *
 * El probe real se ata al registrar las pieles (`bind`): sólo la piel MONTADA
 * puede estar en transit (unmount limpia el estado). Hasta entonces el gate
 * responde `false` (mismo default que el `let` original de boot()).
 */
export class MoongateTransitGate {
  private probe: () => boolean = () => false;

  /** Ata el probe real (se llama al registrar las pieles, fin del boot). */
  bind(probe: () => boolean): void {
    this.probe = probe;
  }

  /** ¿Hay un cruce de moongate en curso en la piel montada? */
  get transiting(): boolean {
    return this.probe();
  }
}
