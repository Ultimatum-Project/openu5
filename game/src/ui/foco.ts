/**
 * Foco y paneles del shell — política COMPARTIDA (#368 replay-ui, #370 savepanel).
 *
 * ── EL MECANISMO, MEDIDO (sonda #370 sobre el juego real en Chromium) ────────────────
 * Cerrar un panel con el RATÓN deja el foco en el botón pulsado DENTRO del árbol ya
 * oculto: Chromium enfoca el botón en el mousedown y recoloca el foco a `body` de forma
 * ASÍNCRONA (en el siguiente frame de render, no al poner `display:none`). Barrido de
 * retardos medido: a 0 ms el foco sigue retenido y la tecla SE TRAGA; a 16 ms ya está en
 * `body` y la tecla llega. La ventana es de UN frame — exactamente la que el e2e de #368
 * midió como «5 de 6 teclas grabadas».
 *
 * ── EL PATRÓN SON DOS MITADES, y quien cierre un panel necesita las dos ──────────────
 *   1. Al ocultar, SOLTAR el foco si vive dentro del árbol que se oculta (esta función):
 *      la siguiente tecla del usuario nace en `body` y llega al `keydown` de `window`
 *      (main.ts), que es donde el juego consume y el grabador anota.
 *   2. El `stopPropagation` del keydown del panel se gatea por VISIBILIDAD: un árbol
 *      oculto es INERTE al teclado. Sin la guarda, la tecla nacida en el foco retenido
 *      (mitad 1 ausente, u otro widget devolviéndole el foco) muere en el panel oculto.
 *
 * Cada mitad cubre el fallo de la otra; los tests de cada panel las asevera POR SEPARADO.
 */

/**
 * Suelta el foco si vive DENTRO de `root`. Mismo gesto condicional que el teclado nativo
 * del deck (`skin/portrait/deck-nativo.ts`, `if (document.activeElement === input)
 * input.blur()`): sólo se toca el foco si es nuestro — robárselo a otro widget que ya lo
 * tenga sería el defecto simétrico.
 */
export function soltarFoco(root: HTMLElement): void {
  const activo = document.activeElement;
  if (activo instanceof HTMLElement && root.contains(activo)) activo.blur();
}
