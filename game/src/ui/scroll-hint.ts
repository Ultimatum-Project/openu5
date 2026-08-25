/**
 * Indicador SUTIL de scroll para la zona de comandos del deck táctil (ticket
 * mobile-e2e UX-2, ruling 2026-07-24): cuando hay más contenido por encima/por
 * debajo del viewport del contenedor, se enciende un chevron con degradado en el
 * borde correspondiente. Sin él, los ~14 comandos bajo el pliegue eran invisibles
 * («no parece que haya más»).
 *
 * `scrollHintState` es PURO (unit-testeable); `attachScrollHint` cablea el DOM:
 * dos overlays `pointer-events:none` (jamás roban un tap) dentro de un WRAPPER
 * posicionado (.touch-cmdwrap), actualizados en `scroll` + `refresh()` explícito
 * (el deck reconstruye la rejilla al cambiar de contexto world/dungeon/combat).
 */

export interface ScrollHintState {
  /** Hay contenido por ENCIMA (se puede scrollear hacia arriba). */
  up: boolean;
  /** Hay contenido por DEBAJO (se puede scrollear hacia abajo). */
  down: boolean;
}

/** Épsilon de redondeo: scrollTop/alturas llegan con fracciones de px en DPR≠1. */
const EPSILON_PX = 2;

/** Estado del indicador dado el scroll del contenedor. Puro. */
export function scrollHintState(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  epsilon: number = EPSILON_PX,
): ScrollHintState {
  const overflow = scrollHeight - clientHeight;
  if (overflow <= epsilon) return { up: false, down: false };
  return {
    up: scrollTop > epsilon,
    down: scrollTop < overflow - epsilon,
  };
}

export interface ScrollHintHandle {
  /** Re-evalúa (tras rebuild de contenido, resize o cambio de hoja). */
  refresh(): void;
  dispose(): void;
}

/**
 * Monta los chevrons de hint sobre `wrap` (ancestro POSICIONADO del scroller) y los
 * sincroniza con el scroll de `scroller`. El CSS (.touch-scrollhint*) vive en
 * index.html junto al resto del deck.
 */
export function attachScrollHint(wrap: HTMLElement, scroller: HTMLElement): ScrollHintHandle {
  const mk = (cls: string, glyph: string): HTMLElement => {
    const el = document.createElement("div");
    el.className = `touch-scrollhint ${cls}`;
    el.textContent = glyph;
    wrap.appendChild(el);
    return el;
  };
  const up = mk("touch-scrollhint-up", "▲");
  const down = mk("touch-scrollhint-down", "▼");

  const refresh = (): void => {
    const st = scrollHintState(scroller.scrollTop, scroller.clientHeight, scroller.scrollHeight);
    up.classList.toggle("on", st.up);
    down.classList.toggle("on", st.down);
  };
  scroller.addEventListener("scroll", refresh, { passive: true });
  refresh();

  return {
    refresh,
    dispose: () => {
      scroller.removeEventListener("scroll", refresh);
      up.remove();
      down.remove();
    },
  };
}
