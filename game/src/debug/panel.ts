/**
 * PANEL debug — drawer lateral derecho en DOM puro. Se auto-construye del
 * REGISTRO (registry.ts): acordeón de secciones + buscador de campos. NO tapa el
 * juego (el canvas sigue jugable) y NO captura las teclas del juego salvo cuando
 * un input suyo tiene el foco (stopPropagation sólo para eventos originados en el
 * panel). El refresco es POR-CAMPO (re-lee get() y actualiza el control sin
 * reconstruir el DOM), así el mapa de teletransporte y el foco se preservan.
 */
import type { DebugField, DebugSection, SelectField } from "./types.js";

const STYLE_ID = "u5dbg-style";

const CSS = `
.u5dbg-drawer{position:fixed;top:0;right:0;height:100vh;width:360px;max-width:92vw;
  z-index:99999;background:#14161b;color:#c8ccd4;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;
  border-left:1px solid #2a2f3a;box-shadow:-6px 0 24px rgba(0,0,0,.5);display:flex;flex-direction:column;
  transform:translateX(100%);transition:transform .18s ease}
.u5dbg-drawer.open{transform:translateX(0)}
.u5dbg-head{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #2a2f3a;background:#1b1e26}
.u5dbg-title{font-weight:700;letter-spacing:.04em;color:#e6e9ef;flex:1}
.u5dbg-badge{font-size:10px;color:#8b93a3;background:#232734;border:1px solid #2f3542;border-radius:4px;padding:1px 5px}
.u5dbg-close{cursor:pointer;background:#232734;border:1px solid #2f3542;color:#c8ccd4;border-radius:4px;padding:2px 8px}
.u5dbg-close:hover{background:#2c3140}
.u5dbg-search{margin:8px 10px}
.u5dbg-search input{width:100%;box-sizing:border-box;background:#0f1116;border:1px solid #2a2f3a;color:#e6e9ef;
  border-radius:5px;padding:6px 8px;font:inherit}
.u5dbg-body{overflow-y:auto;flex:1;padding:0 10px 24px}
.u5dbg-section{border:1px solid #242833;border-radius:6px;margin:8px 0;overflow:hidden}
.u5dbg-sec-head{cursor:pointer;user-select:none;padding:7px 9px;background:#1b1e26;display:flex;align-items:center;gap:6px;font-weight:600;color:#dfe3ea}
.u5dbg-sec-head:hover{background:#20242e}
.u5dbg-sec-arrow{color:#7f8798;transition:transform .12s}
.u5dbg-section.collapsed .u5dbg-sec-arrow{transform:rotate(-90deg)}
.u5dbg-section.collapsed .u5dbg-sec-body{display:none}
.u5dbg-sec-body{padding:6px 9px}
.u5dbg-field{display:flex;align-items:center;gap:8px;margin:5px 0}
.u5dbg-field label{flex:1;min-width:0;color:#aeb4c0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.u5dbg-field input[type=number],.u5dbg-field input[type=text],.u5dbg-field select{
  width:140px;background:#0f1116;border:1px solid #2a2f3a;color:#e6e9ef;border-radius:4px;padding:4px 6px;font:inherit}
.u5dbg-field input[disabled]{opacity:.6;width:170px}
.u5dbg-field input[type=checkbox]{width:16px;height:16px}
.u5dbg-field.button{justify-content:flex-start}
.u5dbg-field button{background:#2d5cff22;border:1px solid #3358d4;color:#c9d6ff;border-radius:5px;padding:5px 12px;cursor:pointer;font:inherit}
.u5dbg-field button:hover{background:#2d5cff44}
.u5dbg-field button.danger{background:#ff3b3b1a;border-color:#c0392b;color:#ffd0c8}
.u5dbg-field button.danger:hover{background:#ff3b3b33}
.u5dbg-danger-badge{display:inline-block;font-size:9px;font-weight:700;letter-spacing:.05em;background:#c0392b;color:#fff;border-radius:3px;padding:0 4px;vertical-align:middle}
.u5dbg-hint{font-size:10px;color:#727a8a;margin:-2px 0 4px}
.u5dbg-telemap{margin:4px 0 8px}
.u5dbg-telemap-toolbar{display:flex;align-items:center;gap:8px;margin-bottom:5px}
.u5dbg-telemap-toolbar select{flex:1;background:#0f1116;border:1px solid #2a2f3a;color:#e6e9ef;border-radius:4px;padding:3px 6px;font:inherit}
.u5dbg-telemap-coord{color:#8b93a3;min-width:64px;text-align:right}
.u5dbg-telemap-frame{position:relative;width:100%;aspect-ratio:1/1;border:1px solid #2a2f3a;background:#000;cursor:crosshair}
.u5dbg-telemap-canvas{width:100%;height:100%;image-rendering:pixelated;display:block}
.u5dbg-telemap-marker{position:absolute;width:7px;height:7px;margin:-4px 0 0 -4px;border:2px solid #ff4d4d;border-radius:50%;
  box-shadow:0 0 0 1px #000;pointer-events:none;animation:u5dbgblink 1s steps(2) infinite}
@keyframes u5dbgblink{50%{opacity:.25}}
`;

interface FieldCtl {
  row: HTMLElement;
  label: string;
  sync(): void;
}

/** Un texto de chrome fijo o resuelto en cada (re)pintado — para i18n en caliente. */
type ChromeText = string | (() => string);
function resolveChrome(v: ChromeText | undefined, fallback: string): string {
  return typeof v === "function" ? v() : (v ?? fallback);
}

/** Identidad del drawer (el shell reutiliza este motor con otro título/testid). */
export interface DebugPanelOpts {
  /** Título de cabecera (default "DEBUG"). Función ⇒ se re-resuelve al invalidar (idioma). */
  title?: ChromeText;
  /** Texto del badge (default "QA"). Función ⇒ se re-resuelve al invalidar (idioma). */
  badge?: ChromeText;
  /** Placeholder del buscador (default "Filtrar campos…"). Función ⇒ i18n en caliente. */
  searchPlaceholder?: ChromeText;
  /** data-testid del drawer (default "u5-debug-drawer"); el botón de cierre usa `<testId>-close`. */
  testId?: string;
  /**
   * ¿Lleva el drawer el botón `esc` de la ESQUINA? Default `true` (el drawer QA de debug
   * lo conserva). El menú SISTEMA lo pasa a `false` — directriz del usuario 14-08 (#263):
   * «el botón esc de la esquina, quitarlo».
   *
   * 🔴 QUIEN LO APAGUE TIENE QUE PONER OTRA SALIDA ROTULADA, y no es una recomendación:
   * en un teléfono no hay Escape físico, y sin este botón las únicas vías eran tocar fuera
   * y volver a pulsar el ☰ — dos convenciones que un lector de pantalla no anuncia. Ésa es
   * la razón por la que el ✕ se conservó cuando el marco original desvistió la cabecera
   * (ver `ui/shell/originalFrame.ts`), y sigue en pie. El shell la cumple con la fila
   * «Close menu» de `buildShellSections`, que hereda el mismo `data-testid` y por eso los
   * cuatro e2e que localizaban el ✕ siguen midiendo lo mismo: la salida rotulada del
   * drawer, esté donde esté.
   */
  closeButton?: boolean;
  /** Hook opcional tras (re)construir las secciones — p.ej. pixelizar el texto (fiel). */
  afterBuild?: () => void;
}

export class DebugPanel {
  private root: HTMLElement;
  private body: HTMLElement;
  private searchInput: HTMLInputElement;
  private ctls: FieldCtl[] = [];
  private customRefreshers: (() => void)[] = [];
  private sections: DebugSection[] = [];
  private built = false;

  constructor(
    private parent: HTMLElement,
    private buildSections: () => DebugSection[],
    private onClose: () => void,
    private opts: DebugPanelOpts = {},
  ) {
    injectStyle();
    this.root = document.createElement("div");
    this.root.className = "u5dbg-drawer";
    const testId = opts.testId ?? "u5-debug-drawer";
    this.root.setAttribute("data-testid", testId);
    const cornerClose = opts.closeButton !== false;
    this.root.innerHTML = `
      <div class="u5dbg-head">
        <span class="u5dbg-title"></span>
        <span class="u5dbg-badge"></span>
        ${cornerClose ? '<button type="button" class="u5dbg-close">esc</button>' : ""}
      </div>
      <div class="u5dbg-search"><input type="search" data-testid="u5-debug-search"></div>
      <div class="u5dbg-body"></div>`;
    this.root
      .querySelector(".u5dbg-close")
      ?.setAttribute(
        "data-testid",
        opts.testId ? `${testId}-close` : "u5-debug-close",
      );
    this.body = this.root.querySelector(".u5dbg-body")!;
    this.searchInput = this.root.querySelector("input")!;
    this.applyChrome();
    // No dejar que el teclado usado en el panel llegue al manejador de comandos del
    // juego (window). Escape se deja pasar para poder cerrar aunque haya foco dentro.
    this.root.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        this.onClose();
        return;
      }
      ev.stopPropagation();
    });
    this.root.querySelector(".u5dbg-close")?.addEventListener("click", () => this.onClose());
    this.searchInput.addEventListener("input", () => this.applyFilter());
    this.parent.appendChild(this.root);
  }

  get isOpen(): boolean {
    return this.root.classList.contains("open");
  }

  /** (Re)aplica título/badge/placeholder desde las opciones (resuelve las funciones). */
  private applyChrome(): void {
    this.root.querySelector(".u5dbg-title")!.textContent = resolveChrome(this.opts.title, "DEBUG");
    this.root.querySelector(".u5dbg-badge")!.textContent = resolveChrome(this.opts.badge, "QA");
    this.searchInput.placeholder = resolveChrome(this.opts.searchPlaceholder, "Filtrar campos…");
  }

  /**
   * Descarta el DOM construido (secciones + controles) y re-aplica el chrome, para
   * que el próximo `open()` lo reconstruya. Uso: el idioma cambió (los labels se
   * generan en `buildSections()`, que corre una sola vez por `built`). Idempotente.
   */
  invalidate(): void {
    this.applyChrome();
    if (!this.built) return;
    this.body.replaceChildren();
    this.ctls = [];
    this.customRefreshers = [];
    this.built = false;
  }

  open(): void {
    if (!this.built) this.build();
    this.refresh();
    this.root.classList.add("open");
  }

  close(): void {
    this.root.classList.remove("open");
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** Re-lee todos los campos y actualiza los controles (sin reconstruir el DOM). */
  refresh(): void {
    for (const c of this.ctls) c.sync();
    for (const r of this.customRefreshers) r();
  }

  /** Raíz DOM del drawer (para hooks externos, p.ej. la fuente pixelada del shell fiel). */
  get rootEl(): HTMLElement {
    return this.root;
  }

  private build(): void {
    this.sections = this.buildSections();
    for (const section of this.sections) this.body.appendChild(this.buildSection(section));
    this.built = true;
    this.opts.afterBuild?.();
  }

  private buildSection(section: DebugSection): HTMLElement {
    const el = document.createElement("div");
    el.className = "u5dbg-section";
    el.dataset.section = section.id;
    const head = document.createElement("div");
    head.className = "u5dbg-sec-head";
    head.innerHTML = `<span class="u5dbg-sec-arrow">▾</span><span>${section.title}</span>`;
    const bodyEl = document.createElement("div");
    bodyEl.className = "u5dbg-sec-body";
    head.addEventListener("click", () => el.classList.toggle("collapsed"));
    el.append(head, bodyEl);

    if (section.custom) {
      const custom = section.custom({ refresh: () => this.refresh() });
      bodyEl.appendChild(custom);
      const hook = (custom as HTMLElement & { __refreshMarker?: () => void }).__refreshMarker;
      if (hook) this.customRefreshers.push(hook);
    }
    for (const field of section.fields ?? []) {
      const ctl = this.buildField(field);
      bodyEl.appendChild(ctl.row);
      this.ctls.push(ctl);
    }
    return el;
  }

  private buildField(field: DebugField): FieldCtl {
    const row = document.createElement("div");
    row.className = "u5dbg-field";
    const setDisabled = (el: HTMLInputElement | HTMLSelectElement | HTMLButtonElement): void => {
      if (field.disabled?.()) el.setAttribute("disabled", "");
    };

    if (field.widget === "button") {
      row.classList.add("button");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = field.label;
      if (field.testId) btn.setAttribute("data-testid", field.testId);
      if (field.hint) btn.title = field.hint;
      if (field.danger) {
        btn.classList.add("danger");
        const badge = document.createElement("span");
        badge.className = "u5dbg-danger-badge";
        badge.textContent = "RNG";
        if (field.hint) badge.title = field.hint;
        btn.appendChild(document.createTextNode(" "));
        btn.appendChild(badge);
      }
      btn.addEventListener("click", () => {
        field.run();
        this.refresh();
      });
      row.appendChild(btn);
      return { row, label: field.label, sync: () => setDisabled(btn) };
    }

    const label = document.createElement("label");
    label.textContent = field.label;
    row.appendChild(label);

    if (field.widget === "checkbox") {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.addEventListener("change", () => {
        field.set(input.checked);
        this.refresh();
      });
      row.appendChild(input);
      return {
        row,
        label: field.label,
        sync: () => {
          input.checked = field.get();
          setDisabled(input);
        },
      };
    }

    if (field.widget === "select") {
      const sel = document.createElement("select");
      sel.addEventListener("change", () => {
        const opt = (field as SelectField).options.find((o) => String(o.value) === sel.value);
        field.set(opt ? opt.value : sel.value);
        this.refresh();
      });
      row.appendChild(sel);
      return {
        row,
        label: field.label,
        sync: () => {
          rebuildOptions(sel, field as SelectField);
          sel.value = String(field.get());
          setDisabled(sel);
        },
      };
    }

    // number | text
    const input = document.createElement("input");
    input.type = field.widget === "number" ? "number" : "text";
    if (field.widget === "number") {
      if (field.min !== undefined) input.min = String(field.min);
      if (field.max !== undefined) input.max = String(field.max);
      if (field.step !== undefined) input.step = String(field.step);
    }
    const commit = (): void => {
      if (field.widget === "number") field.set(clampNum(input, field.min, field.max));
      else field.set(input.value);
      this.refresh();
    };
    input.addEventListener("change", commit);
    row.appendChild(input);
    return {
      row,
      label: field.label,
      sync: () => {
        if (document.activeElement !== input) input.value = String(field.get());
        setDisabled(input);
      },
    };
  }

  private applyFilter(): void {
    const q = this.searchInput.value.trim().toLowerCase();
    for (const c of this.ctls) {
      const match = !q || c.label.toLowerCase().includes(q);
      c.row.style.display = match ? "" : "none";
    }
    // Colapsa/expande secciones según haya coincidencias; con búsqueda vacía deja
    // el estado del acordeón como estuviera.
    for (const secEl of Array.from(this.body.querySelectorAll<HTMLElement>(".u5dbg-section"))) {
      if (!q) continue;
      const anyVisible = Array.from(secEl.querySelectorAll<HTMLElement>(".u5dbg-field")).some(
        (f) => f.style.display !== "none",
      );
      secEl.classList.toggle("collapsed", !anyVisible);
    }
  }
}

function rebuildOptions(sel: HTMLSelectElement, field: SelectField): void {
  const opts = field.options;
  // Sólo reconstruye si cambió el conjunto (evita parpadeo/foco).
  const sig = opts.map((o) => `${o.value}:${o.label}`).join("|");
  if (sel.dataset.sig === sig) return;
  sel.dataset.sig = sig;
  sel.innerHTML = "";
  for (const o of opts) {
    const opt = document.createElement("option");
    opt.value = String(o.value);
    opt.textContent = o.label;
    if (o.disabled) opt.disabled = true;
    sel.appendChild(opt);
  }
}

function clampNum(input: HTMLInputElement, min?: number, max?: number): number {
  let v = Number(input.value);
  if (!Number.isFinite(v)) v = 0;
  if (min !== undefined) v = Math.max(min, v);
  if (max !== undefined) v = Math.min(max, v);
  return Math.round(v);
}

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
