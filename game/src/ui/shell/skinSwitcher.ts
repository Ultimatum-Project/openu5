/**
 * SWITCHER DE PIEL — acceso directo al cambio de piel (task #79). Botón redondo
 * hermano del ⚙ (misma esquina/estética), a su izquierda. Al pulsarlo despliega
 * DIRECTAMENTE la lista de pieles user-facing: un click en una = cambio inmediato
 * (sin navegar sub-menús). Marca la activa. Cierra al elegir, al clicar fuera o
 * con Escape.
 *
 * DOM fijo fuera del canvas (cero impacto en el render fiel). Reutiliza la lógica
 * de cambio/persistencia del shell (deps.selectSkin) — NO duplica el estado del
 * skin activo (fuente única: SkinManager, vía deps). La piel dev NO aparece aquí
 * (SkinManager.userFacingSkins la excluye).
 */

import { ts } from "../../i18n/shell.js";
import { visibilidadPorRegimen } from "./visibilidad-regimen.js";

const STYLE_ID = "u5skinsw-style";

/** Deps mínimas: la lista user-facing, la piel activa y el cambio directo. */
export interface SkinSwitcherDeps {
  /** Pieles ofrecidas (id + etiqueta), en orden de ciclo. Sin dev. */
  choices(): { id: string; label: string }[];
  /** Id de la piel activa (para marcarla). */
  currentId(): string | null;
  /** Cambia a la piel `id` en caliente (mismo camino que F9: persiste + audio). */
  selectSkin(id: string): void;
}

const CSS = `
.u5skinsw{position:fixed;right:62px;bottom:14px;z-index:99990;width:40px;height:40px;
  border-radius:50%;border:1px solid #2f3542;background:#14161bcc;color:#c8ccd4;
  font:18px/38px ui-monospace,SFMono-Regular,Menlo,monospace;text-align:center;cursor:pointer;
  user-select:none;opacity:0;transition:opacity .25s ease;pointer-events:none}
.u5skinsw.visible{opacity:.85;pointer-events:auto}
.u5skinsw.visible:hover{opacity:1}
.u5skinsw.open{opacity:1;pointer-events:auto;border-color:#5b6472;background:#1b1e25}
.u5skinsw-menu{position:fixed;right:14px;bottom:62px;z-index:99991;min-width:172px;
  background:#14161bf2;border:1px solid #2f3542;border-radius:10px;padding:6px;
  box-shadow:0 8px 24px #000a;display:none;
  font:13px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;color:#c8ccd4}
.u5skinsw-menu.open{display:block}
.u5skinsw-title{font-size:11px;color:#7c8494;text-transform:uppercase;letter-spacing:.06em;
  padding:3px 8px 5px}
.u5skinsw-item{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;
  padding:7px 8px;border:0;border-radius:6px;background:transparent;color:#c8ccd4;
  font:inherit;text-align:left;cursor:pointer}
.u5skinsw-item:hover{background:#252a33}
.u5skinsw-item .mark{width:12px;flex:0 0 12px;color:#8bd17c;text-align:center}
.u5skinsw-item.active{color:#fff}
.u5skinsw-item.active .label{font-weight:600}
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export interface SkinSwitcherHandle {
  /** Repinta la lista (marca la activa). Idempotente. */
  refresh(): void;
  /** Desmonta el botón + menú y retira sus listeners globales. Idempotente. */
  dispose(): void;
}

export function mountSkinSwitcher(
  parent: HTMLElement,
  deps: SkinSwitcherDeps,
): SkinSwitcherHandle {
  ensureStyle();

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "u5skinsw";
  btn.setAttribute("data-testid", "u5-skin-switcher");
  btn.title = ts("Change skin");
  btn.textContent = "◧";

  const menu = document.createElement("div");
  menu.className = "u5skinsw-menu";
  menu.setAttribute("data-testid", "u5-skin-switcher-menu");

  parent.appendChild(btn);
  parent.appendChild(menu);

  let open = false;

  const render = (): void => {
    const activeId = deps.currentId();
    menu.replaceChildren();
    const title = document.createElement("div");
    title.className = "u5skinsw-title";
    title.textContent = ts("Skin");
    menu.appendChild(title);
    for (const { id, label } of deps.choices()) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "u5skinsw-item" + (id === activeId ? " active" : "");
      item.setAttribute("data-testid", "u5-skin-switcher-item");
      item.setAttribute("data-skin-id", id);
      const mark = document.createElement("span");
      mark.className = "mark";
      mark.textContent = id === activeId ? "✓" : "";
      const text = document.createElement("span");
      text.className = "label";
      text.textContent = label;
      item.appendChild(mark);
      item.appendChild(text);
      item.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (id !== activeId) deps.selectSkin(id);
        closeMenu();
      });
      menu.appendChild(item);
    }
  };

  const openMenu = (): void => {
    render();
    open = true;
    menu.classList.add("open");
    btn.classList.add("open", "visible");
  };
  const closeMenu = (): void => {
    open = false;
    menu.classList.remove("open");
    btn.classList.remove("open");
  };
  const toggleMenu = (): void => {
    if (open) closeMenu();
    else openMenu();
  };

  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    toggleMenu();
  });

  // Click fuera / Escape → cierra. Listeners globales guardados para dispose().
  const onDocPointerDown = (ev: PointerEvent): void => {
    if (!open) return;
    const t = ev.target as Node;
    if (t !== btn && !btn.contains(t) && t !== menu && !menu.contains(t)) closeMenu();
  };
  const onDocKeyDown = (ev: KeyboardEvent): void => {
    if (open && ev.key === "Escape") {
      ev.preventDefault();
      ev.stopPropagation();
      closeMenu();
    }
  };
  document.addEventListener("pointerdown", onDocPointerDown);
  document.addEventListener("keydown", onDocKeyDown);

  // Visibilidad: mismo patrón que el ⚙ (gear.ts) — SIEMPRE visible en táctil; con ratón
  // aparece con actividad de puntero y se desvanece tras IDLE_MS, y mientras el menú está
  // abierto queda pineado. Desde #336 la regla vive en `visibilidad-regimen.ts` (una sola
  // copia para los tres FAB) y se RE-EVALÚA al cambiar el puntero primario; antes se leía
  // `(pointer: coarse)` aquí, una vez y sin `?touch=1`.
  const offVisibilidad = visibilidadPorRegimen(btn, { pineado: () => open });

  let disposed = false;
  return {
    refresh: () => {
      btn.title = ts("Change skin"); // idioma pudo cambiar
      if (open) render();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      offVisibilidad();
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onDocKeyDown);
      menu.remove();
      btn.remove();
    },
  };
}
