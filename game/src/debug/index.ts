/**
 * MENÚ DEBUG — bootstrap. Se importa SIEMPRE pero el panel sólo se monta al
 * abrirlo (código fuera del hot path). Toggle con la tecla ` (Backquote) o F4 y
 * también con `?debug=1` en la URL. Expone `window.__u5debug` (la fachada) para
 * consola y e2e. Dependencia unidireccional: main.ts (raíz de composición) llama
 * a esto pasando el Game vivo y un `notify` (repinta piel + música).
 *
 * NOTA de diseño: el toggle NO usa F8 (ya es el toggle del speaker fiel, main.ts)
 * ni F5/F6/F7/F9/Tab (ocupados). ` es la tecla de consola de depuración
 * convencional; F4 es el alias por si el layout no la tiene cómoda.
 */
import { Game } from "../core/game.js";
import { createDebugApi, type DebugApi } from "./debugApi.js";
import { buildRegistry } from "./registry.js";
import { DebugPanel } from "./panel.js";

export interface DebugMenuHandle {
  api: DebugApi;
  panel: DebugPanel;
  toggle(): void;
  open(): void;
  close(): void;
}

export interface InitDebugMenuOpts {
  game: Game;
  /** Contenedor donde montar el drawer (el mismo `parent` del juego). */
  parent: HTMLElement;
  /** Repinta la piel (notifyDirty) y actualiza la música contextual. */
  notify: () => void;
  /** Abre el panel al arrancar (además de `?debug=1`). */
  autoOpen?: boolean;
}

/** ¿La URL pide abrir el menú debug? (`?debug=1`). */
function debugRequestedByUrl(): boolean {
  try {
    const v = new URLSearchParams(window.location.search).get("debug");
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

export function initDebugMenu(opts: InitDebugMenuOpts): DebugMenuHandle {
  const api = createDebugApi(opts.game, opts.notify);
  const panel = new DebugPanel(
    opts.parent,
    () => buildRegistry(api, opts.game.world),
    () => panel.close(),
  );

  const isToggleKey = (ev: KeyboardEvent): boolean =>
    ev.key === "F4" || ev.key === "`" || ev.code === "Backquote";

  window.addEventListener("keydown", (ev) => {
    if (!isToggleKey(ev)) return;
    // No interferir si el foco está escribiendo en un input ajeno (p.ej. un prompt
    // del juego): sólo togglear cuando NO hay un campo de texto enfocado fuera del panel.
    const active = document.activeElement as HTMLElement | null;
    const typingElsewhere =
      active &&
      (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable) &&
      !active.closest(".u5dbg-drawer");
    if (typingElsewhere) return;
    ev.preventDefault();
    ev.stopPropagation();
    panel.toggle();
  });

  const handle: DebugMenuHandle = {
    api,
    panel,
    toggle: () => panel.toggle(),
    open: () => panel.open(),
    close: () => panel.close(),
  };

  // Fachada + handle accesibles por consola y e2e.
  (window as unknown as Record<string, unknown>).__u5debug = api;
  (window as unknown as Record<string, unknown>).__u5debugMenu = handle;

  if (opts.autoOpen || debugRequestedByUrl()) panel.open();

  return handle;
}
