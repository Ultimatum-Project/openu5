/**
 * BOTÓN ⚙ del menú SISTEMA — la única afordancia VISIBLE del shell (Escape/F10
 * no se descubren solos). DOM fijo fuera del canvas (cero impacto en el render
 * fiel). Se desvanece tras unos segundos sin actividad de puntero para no
 * ensuciar la contemplación de la piel 1988; en régimen TÁCTIL queda SIEMPRE visible:
 * sin teclado, es la única puerta al shell.
 *
 * El régimen lo decide `ui/regimen-tactil.ts` a través de `visibilidad-regimen.ts`, y se
 * RE-EVALÚA (#334/#336): antes se leía `(pointer: coarse)` aquí mismo, una sola vez y sin
 * atender a `?touch=1`.
 */

import { ts } from "../../i18n/shell.js";
import { visibilidadPorRegimen } from "./visibilidad-regimen.js";

const STYLE_ID = "u5shell-gear-style";

/** Tooltip del ⚙ en el idioma activo. Exportado para re-aplicarlo al cambiar de idioma.
 *  Sólo F10: ESC ya no ABRE el menú (es tecla del juego; sólo cierra lo abierto). */
export function gearTitle(): string {
  return ts("System menu (F10)");
}

const CSS = `
.u5shell-gear{position:fixed;right:14px;bottom:14px;z-index:99990;width:40px;height:40px;
  border-radius:50%;border:1px solid #2f3542;background:#14161bcc;color:#c8ccd4;
  font:20px/38px ui-monospace,SFMono-Regular,Menlo,monospace;text-align:center;cursor:pointer;
  user-select:none;opacity:0;transition:opacity .25s ease;pointer-events:none}
.u5shell-gear.visible{opacity:.85;pointer-events:auto}
.u5shell-gear.visible:hover{opacity:1}
`;

/** El ⚙ y la baja de su suscripción al régimen táctil (#336). */
export interface GearHandle {
  btn: HTMLElement;
  dispose(): void;
}

export function mountGearButton(parent: HTMLElement, onToggle: () => void): GearHandle {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "u5shell-gear";
  btn.setAttribute("data-testid", "u5-shell-gear");
  btn.title = gearTitle();
  btn.textContent = "⚙";
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    onToggle();
  });
  parent.appendChild(btn);

  // Táctil: visible SIEMPRE. Ratón: aparece con actividad de puntero y se desvanece.
  // La regla —y su RE-EVALUACIÓN al cambiar el puntero primario— vive en un solo sitio
  // desde #336; aquí sólo se declara que el ⚙ no tiene menú propio que pinear.
  const offVisibilidad = visibilidadPorRegimen(btn);
  return {
    btn,
    dispose: () => {
      offVisibilidad();
      btn.remove();
    },
  };
}
