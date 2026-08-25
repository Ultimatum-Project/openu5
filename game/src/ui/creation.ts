/**
 * Pantalla de creación de personaje — el cuestionario de la gitana.
 * Cablea el core exacto (core/creation/gypsy.ts) a la UI: nombre → género →
 * 7 preguntas del torneo con los TEXTOS REALES de QUESTION.DAT → stats.
 *
 * Fidelidad (ver re/verified/gypsy.md):
 *  - Nombre: máx 8 caracteres (FONT 0x0bc8 `push 8`). Nombre VACÍO aborta la
 *    creación sin guardar (FONT 0x0bcf → jmp 0xe40, no escribe SAVED.GAM);
 *    aquí = onCancel(), se vuelve al título.
 *  - Género: M→0x0B, F→0x0C (FONT 0x0c0f/0x0c16).
 *  - Preguntas: el par (a,b) del torneo → questionIndexForPair → texto de
 *    QUESTION.DAT. 'A' hace ganar la virtud de índice menor, 'B' la mayor.
 *  - Stats: GypsyTournament.finalize() (MP=INT, STR floor 20).
 */
import { GypsyTournament, questionIndexForPair } from "../core/creation/gypsy.js";
import type { GypsyCreation } from "../core/state.js";
import { ts } from "../i18n/shell.js";

/** Datos de QUESTION.DAT (game/assets/questions.json). */
export interface QuestionData {
  narrations: string[];
  questions: string[];
}

const NAME_MAX = 8; // FONT 0x0bc8: push 8
const GENDER_MALE = 0x0b;
const GENDER_FEMALE = 0x0c;

export class CreationPanel {
  private readonly root: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private tournament: GypsyTournament | null = null;
  private name = "";
  private gender = GENDER_MALE;
  private onComplete: ((c: GypsyCreation) => void) | null = null;
  private onCancel: (() => void) | null = null;
  private keyHandler: ((ev: KeyboardEvent) => void) | null = null;
  // El panel corta la propagación de teclas hacia el input global del juego; se
  // guarda la referencia para poder retirarlo al desmontar (bug Fase 0: sin esto
  // el listener sobrevivía junto al root oculto).
  private readonly rootKeyHandler = (ev: KeyboardEvent): void => ev.stopPropagation();

  constructor(
    private readonly parent: HTMLElement,
    private readonly questions: QuestionData,
  ) {
    this.root = document.createElement("div");
    this.root.className = "save-panel";
    this.root.innerHTML = `<div class="save-title"></div><div class="save-list"></div>`;
    this.titleEl = this.root.querySelector(".save-title")!;
    this.bodyEl = this.root.querySelector(".save-list")!;
    this.mount();
    this.hide();
  }

  get visible(): boolean {
    return this.root.isConnected && this.root.style.display !== "none";
  }

  hide(): void {
    this.root.style.display = "none";
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }
  }

  /** (Re)inserta el panel en el DOM y activa su captura de teclado. */
  private mount(): void {
    if (this.root.isConnected) return;
    this.root.addEventListener("keydown", this.rootKeyHandler);
    this.parent.appendChild(this.root);
  }

  /**
   * Desmonta el panel del DOM y retira TODOS sus keydown handlers: el global de
   * la botonera (`keyHandler`) y el propio del panel (`rootKeyHandler`). Sin
   * esto (bug Fase 0) los botones A/B y el `.save-title` "The Summoning" seguían
   * vivos y colisionaban con el `.save-panel` real, y los handlers globales
   * capturaban Escape/F5 en juego.
   */
  private unmount(): void {
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }
    this.root.removeEventListener("keydown", this.rootKeyHandler);
    this.root.remove();
  }

  /**
   * Arranca la creación. `onComplete` recibe el `GypsyCreation` listo para
   * `createNewGame(init, creation)`; `onCancel` se llama si el jugador aborta
   * (nombre vacío) — sin guardar, como el original.
   */
  start(onComplete: (c: GypsyCreation) => void, onCancel: () => void): void {
    this.mount(); // re-monta si una creación previa se abortó (cancel desmonta)
    this.onComplete = onComplete;
    this.onCancel = onCancel;
    this.name = "";
    this.gender = GENDER_MALE;
    this.tournament = null;
    this.root.style.display = "flex";
    this.stepName();
  }

  private narration(el: HTMLElement, text: string): void {
    const p = document.createElement("div");
    p.style.cssText = "line-height:1.5; margin-bottom:10px; color:#c9b980;";
    p.textContent = text;
    el.appendChild(p);
  }

  private stepName(): void {
    this.titleEl.textContent = "The Summoning";
    this.bodyEl.innerHTML = "";
    if (this.questions.narrations[0]) this.narration(this.bodyEl, this.questions.narrations[0]);
    const prompt = document.createElement("div");
    prompt.style.cssText = "margin-bottom:6px; color:#ffe9a8;";
    prompt.textContent = "By what name shalt thou be known?";
    this.bodyEl.appendChild(prompt);

    const form = document.createElement("form");
    form.className = "save-new";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "save-name";
    input.maxLength = NAME_MAX;
    // Pistas de conducta por setAttribute, NUNCA por propiedad IDL (ficha #219): la
    // asignación IDL es muda en el motor que no lleva la propiedad en el prototipo
    // (autocapitalize falta en WebKit, autocorrect falta en Chromium — medido 19-08).
    // La guarda `idl-conducta-censo-219.test.ts` enrojece si esto vuelve al idioma IDL.
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    const btn = document.createElement("button");
    btn.type = "submit";
    btn.className = "save-btn";
    // CHROME de shell moderno (submit del prompt de nombre): NO es del binario (el DOS
    // envía con Enter). Al ts() como el gemelo de selector.ts. La PROSA adyacente
    // ("By what name shalt thou be known?", QUESTION.DAT/creación) SÍ es fiel → corpus,
    // no se toca aquí (carril intro-i18n).
    btn.textContent = ts("Speak");
    form.append(input, btn);
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const value = input.value.trim().slice(0, NAME_MAX);
      if (value.length === 0) {
        // Nombre vacío = abortar sin guardar (FONT 0x0bcf).
        this.unmount();
        this.onCancel?.();
        return;
      }
      this.name = value;
      this.stepGender();
    });
    this.bodyEl.appendChild(form);
    input.focus();
  }

  private stepGender(): void {
    this.titleEl.textContent = "The Summoning";
    this.bodyEl.innerHTML = "";
    const prompt = document.createElement("div");
    prompt.style.cssText = "margin-bottom:10px; color:#ffe9a8;";
    prompt.textContent = "Art thou male or female?";
    this.bodyEl.appendChild(prompt);
    this.choiceButtons(
      [
        { key: "M", label: "(M)ale", value: GENDER_MALE },
        { key: "F", label: "(F)emale", value: GENDER_FEMALE },
      ],
      (value) => {
        this.gender = value;
        this.stepQuiz();
      },
    );
  }

  private stepQuiz(): void {
    this.tournament = new GypsyTournament({ strength: 15, dexterity: 15, intelligence: 15 });
    this.renderQuestion();
  }

  private renderQuestion(): void {
    const t = this.tournament!;
    const pair = t.next();
    if (!pair) {
      this.finish();
      return;
    }
    const idx = questionIndexForPair(pair.a, pair.b);
    this.titleEl.textContent = `The Summoning (${t.resolved.length + 1}/7)`;
    this.bodyEl.innerHTML = "";
    const q = document.createElement("div");
    q.style.cssText = "line-height:1.5; margin-bottom:12px; color:#e8dcae;";
    q.textContent = this.questions.questions[idx] ?? `(pregunta ${idx})`;
    this.bodyEl.appendChild(q);
    this.choiceButtons(
      [
        { key: "A", label: "A", value: "A" as const },
        { key: "B", label: "B", value: "B" as const },
      ],
      (answer) => {
        t.answer(answer);
        this.renderQuestion();
      },
    );
  }

  private finish(): void {
    const stats = this.tournament!.finalize();
    const creation: GypsyCreation = {
      name: this.name,
      gender: this.gender,
      strength: stats.strength,
      dexterity: stats.dexterity,
      intelligence: stats.intelligence,
      currentMp: stats.currentMp,
    };
    this.unmount();
    this.onComplete?.(creation);
  }

  /** Botonera de opciones con atajos de teclado; devuelve el valor elegido. */
  private choiceButtons<T>(
    opts: { key: string; label: string; value: T }[],
    onPick: (value: T) => void,
  ): void {
    const row = document.createElement("div");
    row.className = "save-io";
    const pick = (value: T): void => {
      if (this.keyHandler) {
        window.removeEventListener("keydown", this.keyHandler);
        this.keyHandler = null;
      }
      onPick(value);
    };
    for (const opt of opts) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "save-btn";
      b.textContent = opt.label;
      b.addEventListener("click", () => pick(opt.value));
      row.appendChild(b);
    }
    this.bodyEl.appendChild(row);
    this.keyHandler = (ev: KeyboardEvent) => {
      const k = ev.key.toUpperCase();
      const opt = opts.find((o) => o.key === k);
      if (opt) {
        ev.preventDefault();
        ev.stopPropagation();
        pick(opt.value);
      }
    };
    window.addEventListener("keydown", this.keyHandler);
  }
}
