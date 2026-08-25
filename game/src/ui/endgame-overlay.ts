/**
 * ENDGAME-OVERLAY — el pergamino de cierre en pantalla (task #20, Lote 4).
 *
 * Presenta el pergamino de victoria (`endgame_datestamp` ENDGAME.OVL 0x0326) como un
 * overlay que REVELA el texto línea a línea, usando el animador puro
 * `skin/fiel/endgame-scroll.ts` (word-wrap a 39 cols, revelado progresivo). El texto
 * (las líneas del pergamino) lo provee el core (`quest/endgame.ts::questScroll`); aquí
 * sólo se pinta y se anima.
 *
 * SÓLO la rama de VICTORIA muestra este pergamino. El final "varado" (sin la Sandalwood
 * Box) no lo abre — su texto ("pull up a chair…") ya se emitió al log del HUD (#20 L3).
 */
import { buildScrollReveal } from "../skin/fiel/endgame-scroll.js";

/** Cadencia por defecto del estampado del pergamino (ms por línea revelada). */
export const SCROLL_LINE_MS = 350;

/** Handle para descartar/limpiar el overlay del pergamino. */
export interface EndgameScrollHandle {
  /** Cierra el overlay y detiene la animación. */
  dismiss(): void;
  /** Revela el pergamino entero de inmediato (salta la animación). */
  finish(): void;
}

/**
 * Monta el overlay del pergamino de victoria dentro de `parent` y anima su revelado.
 * Se descarta con un click o cualquier tecla (como el "any key" del original). Devuelve
 * un handle para control programático (tests/e2e).
 *
 * `lineMs=0` revela todo de golpe (sin timers) — útil para e2e deterministas.
 */
export function showEndgameScroll(
  parent: HTMLElement,
  lines: readonly string[],
  lineMs: number = SCROLL_LINE_MS,
): EndgameScrollHandle {
  const frames = buildScrollReveal(lines);
  const full = frames.length > 0 ? frames[frames.length - 1]!.visible : [];

  const overlay = document.createElement("div");
  overlay.className = "save-panel endgame-scroll";
  overlay.setAttribute("data-endgame", "victory");
  overlay.style.zIndex = "60";
  // Sin título autoral: el pergamino muestra SÓLO su propio texto (como el final del
  // original), cuyo cierre es la propia línea "THE QUEST OF THE AVATAR IS FOREVER".
  overlay.innerHTML = '<pre class="endgame-scroll-text" style="white-space:pre-wrap"></pre>';
  const pre = overlay.querySelector(".endgame-scroll-text") as HTMLElement;
  parent.appendChild(overlay);

  let timer: ReturnType<typeof setInterval> | null = null;
  let i = 0;
  const paint = (visible: readonly string[]): void => {
    pre.textContent = visible.join("\n");
  };

  const finish = (): void => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    paint(full);
  };

  const dismiss = (): void => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    overlay.remove();
    window.removeEventListener("keydown", onKey, true);
  };

  const onKey = (ev: KeyboardEvent): void => {
    // El pergamino es MODAL: traga la tecla (no debe filtrarse al juego debajo).
    ev.preventDefault();
    ev.stopPropagation();
    // Primera tecla: completa el pergamino; segunda: cierra (como el "any key").
    if (timer !== null) finish();
    else dismiss();
  };

  overlay.addEventListener("click", () => {
    if (timer !== null) finish();
    else dismiss();
  });
  window.addEventListener("keydown", onKey, true);

  if (lineMs <= 0 || frames.length === 0) {
    finish();
  } else {
    paint(frames[0]!.visible);
    i = 1;
    timer = setInterval(() => {
      if (i >= frames.length) {
        finish();
        return;
      }
      paint(frames[i]!.visible);
      i += 1;
    }, lineMs);
  }

  return { dismiss, finish };
}
