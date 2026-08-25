/**
 * SWITCHER DE IDIOMA — acceso directo al cambio de idioma (i18n F1, decisión del
 * usuario 2026-07-17). Botón redondo HERMANO del ◧ (piel) y el ⚙ (SISTEMA), a su
 * izquierda (esquina inferior derecha, tercer FAB). Al pulsarlo despliega
 * DIRECTAMENTE la lista de idiomas: un click = cambio inmediato en caliente (sin
 * sub-menús). Marca el activo; los idiomas semilla/incompletos se marcan «beta».
 *
 * Molde idéntico a `skinSwitcher.ts` (mismo shell, misma estética, `dispose()`).
 * DOM fijo fuera del canvas (cero impacto en el render fiel). La FUENTE ÚNICA del
 * idioma activo es el módulo `i18n` (getLang/setLang), consumido vía `deps` — este
 * componente NO guarda estado propio de idioma. La etiqueta del FAB muestra el
 * CÓDIGO activo (p.ej. «ES») y se dobla como indicador de estado.
 *
 * A diferencia del ⚙ (sólo en juego, exclusión #71), este FAB se monta TAMBIÉN en
 * la intro: el idioma afecta al menú/gitana, lo primero que se lee. En la intro el
 * cambio persiste y aplica al SIGUIENTE texto pintado (la cinemática no se
 * re-traduce retroactivamente; y en F1 su texto es aún inglés — semilla).
 */

import { ts } from "../../i18n/shell.js";
import { visibilidadPorRegimen } from "./visibilidad-regimen.js";

const STYLE_ID = "u5langsw-style";

/** Deps mínimas: la lista de idiomas, el activo y el cambio directo (todo desde i18n). */
export interface LangSwitcherDeps {
  /** Idiomas ofrecidos (código + etiqueta + si es semilla/incompleto). */
  choices(): { code: string; label: string; seed: boolean }[];
  /** Código del idioma activo (para marcarlo y etiquetar el FAB). */
  currentCode(): string;
  /** Cambia al idioma `code` en caliente (persiste; mismo camino que la API i18n). */
  selectLang(code: string): void;
}

const CSS = `
.u5langsw{position:fixed;right:110px;bottom:14px;z-index:99990;width:40px;height:40px;
  border-radius:50%;border:1px solid #2f3542;background:#14161bcc;color:#c8ccd4;
  font:600 14px/38px ui-monospace,SFMono-Regular,Menlo,monospace;text-align:center;cursor:pointer;
  letter-spacing:.02em;user-select:none;opacity:0;transition:opacity .25s ease;pointer-events:none}
.u5langsw.visible{opacity:.85;pointer-events:auto}
.u5langsw.visible:hover{opacity:1}
.u5langsw.open{opacity:1;pointer-events:auto;border-color:#5b6472;background:#1b1e25}
.u5langsw-menu{position:fixed;right:14px;bottom:62px;z-index:99991;min-width:184px;
  background:#14161bf2;border:1px solid #2f3542;border-radius:10px;padding:6px;
  box-shadow:0 8px 24px #000a;display:none;
  font:13px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;color:#c8ccd4}
.u5langsw-menu.open{display:block}
.u5langsw-title{font-size:11px;color:#7c8494;text-transform:uppercase;letter-spacing:.06em;
  padding:3px 8px 5px}
.u5langsw-item{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;
  padding:7px 8px;border:0;border-radius:6px;background:transparent;color:#c8ccd4;
  font:inherit;text-align:left;cursor:pointer}
.u5langsw-item:hover{background:#252a33}
.u5langsw-item .mark{width:12px;flex:0 0 12px;color:#8bd17c;text-align:center}
.u5langsw-item .label{flex:1 1 auto}
.u5langsw-item.active{color:#fff}
.u5langsw-item.active .label{font-weight:600}
.u5langsw-item .beta{font-size:10px;color:#c8a24a;border:1px solid #6a5a2e;border-radius:4px;
  padding:0 4px;text-transform:uppercase;letter-spacing:.05em}
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export interface LangSwitcherHandle {
  /** Repinta la etiqueta del FAB + la lista (marca el activo). Idempotente. */
  refresh(): void;
  /** Desmonta el botón + menú y retira sus listeners globales. Idempotente. */
  dispose(): void;
}

export function mountLanguageSwitcher(
  parent: HTMLElement,
  deps: LangSwitcherDeps,
): LangSwitcherHandle {
  ensureStyle();

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "u5langsw";
  btn.setAttribute("data-testid", "u5-lang-switcher");
  btn.title = "Idioma / Language";

  const menu = document.createElement("div");
  menu.className = "u5langsw-menu";
  menu.setAttribute("data-testid", "u5-lang-switcher-menu");

  parent.appendChild(btn);
  parent.appendChild(menu);

  let open = false;

  /** Etiqueta del FAB = código del idioma activo en mayúsculas (p.ej. «ES»). */
  const paintButton = (): void => {
    btn.textContent = deps.currentCode().toUpperCase();
  };

  const render = (): void => {
    const activeCode = deps.currentCode();
    menu.replaceChildren();
    const title = document.createElement("div");
    title.className = "u5langsw-title";
    title.textContent = ts("Language");
    menu.appendChild(title);
    for (const { code, label, seed } of deps.choices()) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "u5langsw-item" + (code === activeCode ? " active" : "");
      item.setAttribute("data-testid", "u5-lang-switcher-item");
      item.setAttribute("data-lang-code", code);
      const mark = document.createElement("span");
      mark.className = "mark";
      mark.textContent = code === activeCode ? "✓" : "";
      const text = document.createElement("span");
      text.className = "label";
      text.textContent = label;
      item.appendChild(mark);
      item.appendChild(text);
      if (seed) {
        const beta = document.createElement("span");
        beta.className = "beta";
        beta.textContent = "beta";
        item.appendChild(beta);
      }
      item.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (code !== activeCode) {
          deps.selectLang(code);
          paintButton();
        }
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
    const target = ev.target as Node;
    if (target !== btn && !btn.contains(target) && target !== menu && !menu.contains(target)) {
      closeMenu();
    }
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

  // Visibilidad: mismo patrón que ◧/⚙ — SIEMPRE visible en táctil; con ratón aparece con
  // actividad de puntero y se desvanece tras IDLE_MS, salvo con el menú abierto. Desde
  // #336 la regla vive en `visibilidad-regimen.ts` (una sola copia para los tres FAB) y se
  // RE-EVALÚA al cambiar el puntero primario; antes se leía `(pointer: coarse)` aquí, una
  // vez y sin `?touch=1`.
  const offVisibilidad = visibilidadPorRegimen(btn, { pineado: () => open });

  paintButton();

  let disposed = false;
  return {
    refresh: () => {
      paintButton();
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
