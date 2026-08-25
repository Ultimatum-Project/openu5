/**
 * CLÚSTER DE FAB DEL SHELL (#11, veredicto usuario 2026-07-19: «lo quiero sacar del UI y
 * lo dejamos en una esquina en overlay del UI»). Los tres FAB (🌐 idioma · ◧ piel · ⚙
 * sistema) viven como overlay DISCRETO en la esquina inferior-derecha del VIEWPORT del
 * navegador — FUERA del chrome del juego. Revierte la «Fusión B» previa, que los fundía en
 * el rótulo del panel derecho de la piel siguiendo el canvas.
 *
 * Cada botón conserva TODO su comportamiento nativo (gear.ts / skinSwitcher.ts /
 * languageSwitcher.ts): posición de esquina fija, desvanecimiento por inactividad (discreto
 * con ratón; SIEMPRE visible en táctil) y tematización por piel (theme.ts keyea las clases
 * `.u5shell-gear/.u5skinsw/.u5langsw` sin importar el padre). Aquí sólo se MONTAN los tres
 * en `parent` y se coordina una cosa extra: quedar BAJO los popups del juego.
 *
 * «Bajo los popups» (veredicto): un ORDEN por z-index puro es imposible sin regresión — el
 * clúster debe quedar SOBRE el telón negro de la intro (z-index 40) para poder cambiar de
 * piel/idioma antes de jugar, pero el deck táctil (z-index 40) debe quedar SOBRE el diálogo;
 * no hay banda que satisfaga las tres a la vez. Solución: mientras haya un popup DOM del
 * juego visible (partidas/tienda/selector/vista-gema — todos alternan
 * `display`), el clúster se SUPRIME (opacity 0 + sin puntero), de modo que jamás tapa un
 * popup abierto. Al cerrarse, reaparece. El drawer SISTEMA no entra aquí: ya va en z-index
 * 99999 (por encima) y lo abre el propio ⚙.
 */

import { mountGearButton, gearTitle } from "./gear.js";
import { mountSkinSwitcher, type SkinSwitcherDeps, type SkinSwitcherHandle } from "./skinSwitcher.js";
import { mountLanguageSwitcher, type LangSwitcherDeps, type LangSwitcherHandle } from "./languageSwitcher.js";

const STYLE_ID = "u5shell-toolbar-style";
const SUPPRESSED = "u5shell-fab-suppressed";

/** Popups DOM del juego que alternan `display` y pueden solapar la esquina de los FAB.
 *  `.save-panel` es una clase COMPARTIDA (partidas + tienda + selector; ver shell-menu.spec).
 *  El diálogo/Ztats/vista-de-gema de las pieles vivas se pintan en el CANVAS, no en el DOM,
 *  así que no solapan (el `.viewgem-panel` DOM era de la piel dev jubilada — auditoría D4).
 *  El drawer SISTEMA se excluye (z-index 99999, ya por encima; lo abre el ⚙).
 *
 *  🔴 F6 (auditoría UX): la lista era SÓLO `.save-panel` y el panel de REPETICIONES —que es
 *  hermano suyo, se abre desde la misma sección del drawer y ocupa la pantalla entera
 *  (`position:fixed; inset:0` con telón)— no estaba. Resultado: los tres FAB se quedaban
 *  encendidos ENCIMA del telón de las repeticiones, que es exactamente lo que esta regla
 *  existe para impedir. No fallaba como error: fallaba como tres botones flotando sobre un
 *  modal, y el `getClientRects()` de abajo los daba por buenos porque nadie preguntaba.
 *
 *  ⚠ El discriminante del panel de repeticiones NO es `display` sino el atributo `hidden`
 *  (replay-ui.ts `panel.hidden = false`). `getClientRects()` cubre las dos —lo que mide es
 *  si el elemento ocupa caja, no CÓMO se oculta—, pero el MutationObserver de abajo sólo
 *  observaba `attributeFilter:["style"]`: sin añadir `hidden` a esa lista la reevaluación no
 *  se dispararía al abrirlo y la regla sería correcta y muda. Van juntos o no van. */
const MODAL_SELECTOR = ".save-panel,.u5-replay-panel";

/* El COLOR/chrome de los FAB por piel lo pone `theme.ts`. Aquí sólo la regla de supresión
   (un popup abierto oculta el clúster), con `!important` para ganar al `.visible` táctil. */
const CSS = `
.${SUPPRESSED} .u5shell-gear,
.${SUPPRESSED} .u5skinsw,
.${SUPPRESSED} .u5langsw{opacity:0 !important;pointer-events:none !important}
.${SUPPRESSED} .u5skinsw-menu,
.${SUPPRESSED} .u5langsw-menu{display:none !important}
`;

export interface ShellToolbarDeps {
  /** Toggle del panel de sistema (lo que hacía el ⚙). */
  gearToggle(): void;
  skinDeps: SkinSwitcherDeps;
  langDeps: LangSwitcherDeps;
}

export interface ShellToolbarHandle {
  /** Conservado por compatibilidad de interfaz; el clúster ya no sigue al canvas. */
  reposition(): void;
  refresh(): void;
  dispose(): void;
}

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/** ¿Hay algún popup DOM del juego visible dentro de `parent`? (display:none ⇒ 0 rects). */
function anyModalOpen(parent: HTMLElement): boolean {
  for (const el of parent.querySelectorAll<HTMLElement>(MODAL_SELECTOR)) {
    if (el.getClientRects().length > 0) return true;
  }
  return false;
}

export function mountShellToolbar(parent: HTMLElement, deps: ShellToolbarDeps): ShellToolbarHandle {
  ensureStyle();

  // Montaje DIRECTO en `parent`: cada botón usa su posición de esquina nativa (izq→dcha por
  // CSS: 🌐 idioma · ◧ piel · ⚙ sistema) y su propio fade por inactividad.
  const langHandle: LangSwitcherHandle = mountLanguageSwitcher(parent, deps.langDeps);
  const skinHandle: SkinSwitcherHandle = mountSkinSwitcher(parent, deps.skinDeps);
  const gearHandle = mountGearButton(parent, deps.gearToggle);

  // Supresión mientras haya un popup abierto: reevaluada al alternar el `display` de
  // cualquier descendiente (los popups lo hacen). Coalescida en un rAF.
  let raf = 0;
  const evaluate = (): void => {
    raf = 0;
    parent.classList.toggle(SUPPRESSED, anyModalOpen(parent));
  };
  const schedule = (): void => {
    if (raf) return;
    raf = requestAnimationFrame(evaluate);
  };
  const ro =
    typeof MutationObserver !== "undefined"
      ? new MutationObserver(schedule)
      : null;
  ro?.observe(parent, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["style", "hidden"], // «hidden» = el panel de repeticiones (ver MODAL_SELECTOR)
  });
  evaluate();

  return {
    reposition: () => {},
    refresh: () => {
      langHandle.refresh();
      skinHandle.refresh();
      gearHandle.btn.title = gearTitle();
      schedule();
    },
    dispose: () => {
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      parent.classList.remove(SUPPRESSED);
      langHandle.dispose();
      skinHandle.dispose();
      gearHandle.dispose(); // retira el botón Y da de baja su suscripción al régimen (#336)
    },
  };
}
