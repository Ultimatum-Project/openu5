/**
 * TapGate — discriminador TAP vs DRAG para botones dentro de una zona scrolleable
 * (ticket mobile-e2e UX-2, ruling 2026-07-24).
 *
 * Problema: los botones del deck disparaban su comando en `pointerdown`. En cuanto la
 * zona de comandos se hace scrolleable por toque (touch-action: pan-y), CUALQUIER
 * intento de arrastre nace sobre un botón y dispararía el comando bajo el dedo.
 *
 * Contrato: el conductor registra `begin` en pointerdown, `move` en cada pointermove
 * y decide en pointerup con `end()` — que devuelve true SOLO si el puntero no se
 * desplazó más de `slop` px (Chebyshev: max(|dx|,|dy|)) desde el begin. `cancel()`
 * cubre `pointercancel`: cuando el navegador SE QUEDA el gesto para el pan nativo
 * (touch-action), emite pointercancel — el gate lo traduce a "no era tap".
 *
 * Lógica PURA (sin DOM) para unit-test; el cableado vive en ui/touch.ts.
 */

/** Umbral de arrastre en px (slop): por debajo, el gesto sigue siendo un tap.
 *  10px ≈ el touch-slop de Android/iOS a 1x — el temblor natural del dedo no
 *  cancela el tap, un arrastre deliberado sí. */
export const TAP_SLOP_PX = 10;

export class TapGate {
  private startX = 0;
  private startY = 0;
  private active = false;
  private dragged = false;

  constructor(private readonly slop: number = TAP_SLOP_PX) {}

  /** pointerdown: arranca un candidato a tap en (x,y). */
  begin(x: number, y: number): void {
    this.active = true;
    this.dragged = false;
    this.startX = x;
    this.startY = y;
  }

  /** pointermove: acumula desplazamiento; pasado el slop el gesto deja de ser tap. */
  move(x: number, y: number): void {
    if (!this.active || this.dragged) return;
    if (Math.max(Math.abs(x - this.startX), Math.abs(y - this.startY)) > this.slop) {
      this.dragged = true;
    }
  }

  /** pointerup: cierra el gesto. true ⇔ fue un TAP (activo y sin arrastre). */
  end(): boolean {
    const wasTap = this.active && !this.dragged;
    this.active = false;
    return wasTap;
  }

  /** pointercancel (el navegador tomó el gesto para el scroll nativo): no era tap. */
  cancel(): void {
    this.active = false;
  }
}
