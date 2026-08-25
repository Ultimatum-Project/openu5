/**
 * Feedback visual del tap-para-caminar (móvil): un destello efímero en el PUNTO tocado
 * para confirmar que el gesto se registró y adónde va el avatar. Es un overlay DOM sobre
 * el canvas — NO dibuja en el canvas, así que no toca la pureza de render de la piel fiel
 * (los golden frames dev↔fiel siguen byte-idénticos) y funciona igual en cualquier piel.
 *
 * Gated a táctil (clase `u5-touch` que pone `ui/touch.ts`): en escritorio el click no deja
 * rastro (comportamiento intacto). El destello se auto-limpia al terminar la animación.
 *
 * `force` (carril intro-touch): salta el gate de clase para los taps de la INTRO —
 * el deck (que es quien pone `u5-touch`) aún no está montado durante la cinemática,
 * pero el caller YA verificó entorno táctil (`introIsTouch()`); sin esto los taps
 * del menú de portada no tendrían confirmación visual.
 */
export function tapRipple(clientX: number, clientY: number, force = false): void {
  if (!force && !document.documentElement.classList.contains("u5-touch")) return;
  const dot = document.createElement("div");
  dot.className = "u5-tap-ripple";
  dot.style.left = `${clientX}px`;
  dot.style.top = `${clientY}px`;
  document.body.appendChild(dot);
  // Se retira al acabar la animación (o por tope de seguridad si el evento no llega).
  const kill = (): void => dot.remove();
  dot.addEventListener("animationend", kill);
  window.setTimeout(kill, 600);
}
