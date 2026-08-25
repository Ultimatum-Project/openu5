/**
 * Ajuste de un elemento al VISUAL VIEWPORT con el teclado en pantalla (fix del
 * input del nombre en iPhone real, carril mobile-ux 2026-07-24).
 *
 * iOS Safari NO redimensiona el layout viewport al abrir el teclado: lo tapa por
 * abajo y sólo `window.visualViewport` cuenta la verdad. Con `body{overflow:hidden}`
 * (nuestro shell) Safari tampoco puede auto-scrollear el input enfocado a la vista
 * — hay que subirlo a mano. `keyboardClearance` calcula ese desplazamiento; el
 * conductor lo aplica como translateY en cada resize/scroll del visualViewport.
 *
 * Puro (sin DOM) para unit-test.
 */

/**
 * Desplazamiento vertical (px, ≤0) para que un elemento en `elemTop..elemTop+elemHeight`
 * (coords de layout) quepa por encima del borde inferior del visual viewport
 * (`vvTop + vvHeight`), con `margin` de aire. 0 = ya cabe (no se toca).
 */
export function keyboardClearance(
  elemTop: number,
  elemHeight: number,
  vvTop: number,
  vvHeight: number,
  margin = 8,
): number {
  const overlap = elemTop + elemHeight + margin - (vvTop + vvHeight);
  return overlap > 0 ? -overlap : 0;
}
