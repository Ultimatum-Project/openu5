/**
 * VISIBILIDAD DE LOS FAB DEL SHELL SEGÚN EL RÉGIMEN TÁCTIL (#336).
 *
 * POR QUÉ EXISTE. Los tres botones flotantes del shell —⚙ (`gear.ts`), 🌐
 * (`languageSwitcher.ts`) y ◧ (`skinSwitcher.ts`)— compartían la MISMA regla escrita tres
 * veces: «en táctil visible SIEMPRE; con ratón aparece con actividad de puntero y se
 * desvanece tras IDLE_MS». Tres copias con el mismo enunciado son exactamente la
 * divergencia que #334 vino a cerrar, y ya habían divergido en dos puntos MEDIBLES:
 *
 *   · las tres leían `matchMedia("(pointer: coarse)")` A PELO, sin `?touch=1` — o sea, el
 *     override documentado del caso ambiguo (#333) encendía el deck y dejaba estos tres
 *     botones en régimen de ratón, desvaneciéndose en una pantalla sin ratón;
 *   · las tres lo leían UNA VEZ al montar, así que un 2-en-1 que cambiara de modo a mitad
 *     de sesión se quedaba con el valor rancio en las dos direcciones (la clase de #334).
 *
 * Al vivir la regla en un sitio, las dos correcciones se aplican a los tres por
 * construcción, y el que añada un cuarto FAB no puede volver a escribirla mal.
 *
 * QUÉ NO CUBRE: sólo la clase `visible` del botón. La lógica de PINEADO mientras el menú
 * está abierto la aporta cada llamador con `pineado()`, porque «abierto» es estado suyo.
 */

import { esTactilAhora, onCambioRegimenTactil } from "../regimen-tactil.js";

/** Milisegundos de quietud del puntero tras los que el botón se desvanece. */
export const IDLE_MS = 4000;

export interface OpcionesVisibilidad {
  /**
   * ¿Debe seguir visible aunque el puntero lleve `IDLE_MS` quieto? Lo usan 🌐 y ◧ para no
   * desvanecerse con su menú desplegado. El ⚙ no lo pasa (no tiene menú propio).
   */
  pineado?: () => boolean;
}

/**
 * Gobierna la clase `visible` de `btn` según el régimen táctil, RE-EVALUÁNDOLO cuando el
 * puntero primario cambia. Devuelve la baja (desarma todo lo que haya armado).
 *
 * En TÁCTIL: `visible` fija y CERO listeners de puntero — sin teclado, el botón es la
 * única puerta al shell y no puede desaparecer.
 * En RATÓN: `pointermove`/`pointerdown` lo encienden y un temporizador lo apaga.
 *
 * El cambio de régimen desarma el modo anterior antes de armar el nuevo, así que ni se
 * acumulan listeners ni queda un temporizador vivo apagando un botón que ya debe quedarse.
 */
export function visibilidadPorRegimen(
  btn: HTMLElement,
  opts: OpcionesVisibilidad = {},
): () => void {
  let hideTimer: number | null = null;
  let raton = false; // ¿están armados los listeners de puntero?

  const poke = (): void => {
    btn.classList.add("visible");
    if (hideTimer !== null) window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (!opts.pineado?.()) btn.classList.remove("visible");
    }, IDLE_MS);
  };

  const desarmarRaton = (): void => {
    if (!raton) return;
    raton = false;
    window.removeEventListener("pointermove", poke);
    window.removeEventListener("pointerdown", poke);
    if (hideTimer !== null) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  const aplicar = (tactil: boolean): void => {
    if (tactil) {
      desarmarRaton();
      btn.classList.add("visible");
      return;
    }
    if (!raton) {
      raton = true;
      window.addEventListener("pointermove", poke);
      window.addEventListener("pointerdown", poke);
    }
    poke();
  };

  aplicar(esTactilAhora());
  const offRegimen = onCambioRegimenTactil(aplicar);

  return () => {
    offRegimen();
    desarmarRaton();
  };
}
