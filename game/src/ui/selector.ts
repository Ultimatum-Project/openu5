/**
 * Selector genérico de lista (Cast/Ready/Mix…): título + opciones clicables,
 * navegable también con números 1-9 y Escape para cancelar.
 *
 * ECO — CHROME DE SHELL MODERNO (auditoría cast-echo/eco-selector). Las etiquetas
 * propias del widget ("Cancel", "Speak", "(nothing available)") NO salen del binario
 * de EA: el DOS original no tiene botones clicables — se cancela con Escape/Space y
 * los pickers vacíos imprimen strings concretos ("None!"…). Son afordances MODERNAS,
 * así que se traducen por la capa de shell `ts()` (igual que savepanel.ts), NO por
 * `es.json` (la guarda de corpus prohíbe keys sin origen en el binario). Verificado:
 * "Cancel"/"(nothing available)" ausentes de DATA.OVL/*.DAT.
 *
 * Desde #268 este widget ya NO sirve preguntas de texto (ver el hueco de `prompt` más
 * abajo), así que tampoco traduce títulos: los que quedan ("Item: ", "Mix", …) llegan
 * por argumento desde `show()` ya compuestos por su call-site. La nota histórica sobre
 * "SPEAK UNTO ME THE MANTRA" (MISCMSG.DAT 0xac) se conserva porque sigue siendo cierta y
 * sigue confundiendo: es la 4ª pregunta del interrogatorio de Blackthorn, no un rótulo
 * de botón ni el prompt del santuario.
 */
import { ts } from "../i18n/shell.js";

export interface SelectorOption<T> {
  label: string;
  value: T;
  detail?: string;
}

export class SelectorPanel {
  private root: HTMLElement;
  private titleEl: HTMLElement;
  private listEl: HTMLElement;
  private onPick: ((value: unknown) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "save-panel";
    this.root.innerHTML = `
      <div class="save-title"></div>
      <div class="save-list"></div>
      <div class="save-io"><button type="button" class="save-btn">${ts("Cancel")}</button></div>`;
    this.titleEl = this.root.querySelector(".save-title")!;
    this.listEl = this.root.querySelector(".save-list")!;
    this.root.querySelector("button")!.addEventListener("click", () => this.hide());
    this.root.addEventListener("keydown", (ev) => ev.stopPropagation());
    parent.appendChild(this.root);
    this.hide();
  }

  get visible(): boolean {
    return this.root.style.display !== "none";
  }

  hide(): void {
    this.root.style.display = "none";
    this.onPick = null;
  }

  // Aquí vivía `prompt(title, onSubmit)`: un formulario DOM con `<input class="save-name">`
  // y un botón "Speak" que servía las cinco preguntas de texto del juego (virtud y mantra
  // de los dos ritos de santuario, deseo del pozo, interrogatorio de Blackthorn y
  // contraseña del guardia). RETIRADO en #268: el original imprime esas preguntas en la
  // CONSOLA y lee la respuesta con `input_string` ecoándola en línea — no abre ventana
  // ninguna. Las cinco pasan por `askText` (main.ts), que usa el prompt de consola
  // `type:"text"` del PromptManager, el mismo de (Y)ell y de la charla.
  // El botón "Speak" era además la ÚNICA razón de la key de shell `ts("Speak")`.

  show<T>(title: string, options: SelectorOption<T>[], onPick: (value: T) => void): void {
    this.titleEl.textContent = title;
    this.listEl.innerHTML = "";
    this.onPick = onPick as (value: unknown) => void;
    if (options.length === 0) {
      const empty = document.createElement("div");
      empty.className = "save-empty";
      empty.textContent = ts("(nothing available)");
      this.listEl.appendChild(empty);
    }
    for (const opt of options) {
      const div = document.createElement("div");
      div.className = "save-slot";
      const info = document.createElement("div");
      info.className = "save-slot-info";
      const name = document.createElement("div");
      name.className = "save-slot-name";
      name.textContent = opt.label;
      info.appendChild(name);
      if (opt.detail) {
        const meta = document.createElement("div");
        meta.className = "save-slot-meta";
        meta.textContent = opt.detail;
        info.appendChild(meta);
      }
      div.appendChild(info);
      div.style.cursor = "pointer";
      div.addEventListener("click", () => {
        const pick = this.onPick;
        this.hide();
        pick?.(opt.value);
      });
      this.listEl.appendChild(div);
    }
    this.root.style.display = "flex";
  }
}
