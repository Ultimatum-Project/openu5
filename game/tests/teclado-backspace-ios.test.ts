/**
 * @vitest-environment jsdom
 *
 * BACKSPACE DEL TECLADO iOS EN LOS PROMPTS DE TEXTO — reporte del usuario (24-08,
 * iPhone, portrait fiel): «en Talk, escribir funciona pero pulsar backspace NO borra
 * las letras ya escritas».
 *
 * CAUSA MEDIDA (repro Playwright 390×844 táctil, mantra del santuario — eco `:aho`
 * intacto tras dos ⌫): el puente vaciaba `input.value = ""` tras CADA tecla, y sobre un
 * campo VACÍO iOS no emite `beforeinput` con `deleteContentBackward` — la única vía de
 * borrado que el puente escuchaba. El `keydown` que sí llega (según versión de iOS,
 * `key` útil o `Unidentified`/229 de composición) moría en el `stopPropagation()` de
 * `onInputKeyDown`, que sólo atendía Enter/Escape. La señal jamás llegaba al
 * `emitKey("Backspace")`, así que el getline del port (prompt-manager.ts, virtud/
 * mantra/keywords de Talk/sílabas; faithful-intro.ts, nombre) nunca la veía. El
 * teclado FÍSICO no pasa por el campo (keydown directo en `window`): borraba bien —
 * ése es el control positivo, aquí y en la repro.
 *
 * EL FIX (deck-nativo.ts): el campo se ARMA con un centinela U+200B (`KB_SENTINEL`)
 * en el foco y tras cada tecla — el ⌫ de iOS siempre tiene algo que borrar y
 * `deleteContentBackward` se emite —, más el cinturón del `keydown` "Backspace"
 * identificado (con `preventDefault`, que suprime el `beforeinput` consecuente: sin
 * doble emisión por construcción).
 *
 * EL EMULADOR DE ESTE FICHERO ES HONESTO CON iOS: emite `beforeinput` de borrado SÓLO
 * si el campo tiene contenido — que es exactamente la condición que el bug explotaba.
 * Un keydown sintético "Backspace" a secas NO reproduce el defecto (el iOS real no
 * manda eso solo), y con él el test viejo habría pasado en verde sobre el código roto.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installNativeKeyboard, KB_SENTINEL } from "../src/skin/portrait/deck-nativo.js";

/** Deck mínimo: lo que `installNativeKeyboard` busca por selector para montarse. */
function montaDeck(): void {
  document.body.innerHTML = `
    <div id="app"></div>
    <div class="touch-controls">
      <div class="touch-sheets">
        <div class="touch-sheet touch-sheet-az"></div>
        <div class="touch-sheet touch-sheet-num"></div>
      </div>
      <div class="touch-util"></div>
    </div>`;
}

const campo = (): HTMLInputElement => document.querySelector<HTMLInputElement>(".u5kb-input")!;

/** Teclas que llegan al JUEGO (los keydown re-emitidos en `window`, la vía de touch.ts). */
function capturaTeclas(): { teclas: string[]; dispose: () => void } {
  const teclas: string[] = [];
  const onKey = (ev: KeyboardEvent): void => {
    // Los keydown REALES del campo no llegan: el puente los corta con `stopPropagation`
    // (y ése es parte del contrato — sin duplicados). Aquí sólo aterrizan los
    // sintetizados por `emitKey` y los despachados directamente sobre `window`.
    teclas.push(ev.key);
  };
  window.addEventListener("keydown", onKey);
  return { teclas, dispose: () => window.removeEventListener("keydown", onKey) };
}

/**
 * UN pulso del teclado iOS sobre el campo, contra su estado REAL:
 *   1. `keydown` (identidad variable: "Backspace" en unas versiones, "Unidentified"/229
 *      de composición en otras);
 *   2. si el default no murió Y el campo tiene contenido, `beforeinput
 *      deleteContentBackward` — iOS NO lo emite sobre un campo vacío (la condición
 *      que mataba el puente viejo);
 *   3. si tampoco murió, la mutación del valor + `input`.
 */
function pulsaBackspaceIOS(keydownKey: string): void {
  const el = campo();
  const kd = new KeyboardEvent("keydown", { key: keydownKey, bubbles: true, cancelable: true });
  el.dispatchEvent(kd);
  if (kd.defaultPrevented) return;
  if (el.value.length === 0) return; // iOS: nada que borrar ⇒ ningún beforeinput
  const bi = new InputEvent("beforeinput", {
    inputType: "deleteContentBackward",
    bubbles: true,
    cancelable: true,
  });
  if (el.dispatchEvent(bi)) {
    el.value = el.value.slice(0, -1);
    el.dispatchEvent(new InputEvent("input", { inputType: "deleteContentBackward", bubbles: true }));
  }
}

/** Tecleo iOS de un carácter (keydown no fiable + `beforeinput insertText`). */
function tecleaIOS(ch: string): void {
  const el = campo();
  el.dispatchEvent(new KeyboardEvent("keydown", { key: "Unidentified", bubbles: true, cancelable: true }));
  const bi = new InputEvent("beforeinput", {
    inputType: "insertText",
    data: ch,
    bubbles: true,
    cancelable: true,
  });
  if (el.dispatchEvent(bi)) {
    el.value += ch;
    el.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: ch, bubbles: true }));
  }
}

describe("backspace iOS — la señal móvil llega al getline (24-08)", () => {
  let handle: { dispose?: () => void } | null = null;

  beforeEach(() => {
    montaDeck();
    handle = installNativeKeyboard(document.getElementById("app")) as { dispose?: () => void };
  });
  afterEach(() => {
    handle?.dispose?.();
    document.body.innerHTML = "";
  });

  it("EL DEFECTO, por la vía `Unidentified`/229: teclear y borrar emite char y Backspace", () => {
    const cap = capturaTeclas();
    campo().focus();
    tecleaIOS("a");
    tecleaIOS("h");
    // El pulso ⌫ con keydown de composición: TODO depende de que el campo esté armado.
    pulsaBackspaceIOS("Unidentified");
    cap.dispose();
    expect(cap.teclas).toEqual(["a", "h", "Backspace"]);
  });

  it("y por la vía `keydown` identificado: UNA sola emisión (el cinturón no duplica)", () => {
    const cap = capturaTeclas();
    campo().focus();
    tecleaIOS("a");
    pulsaBackspaceIOS("Backspace");
    cap.dispose();
    // Si el cinturón no hiciera `preventDefault`, el emulador seguiría al `beforeinput`
    // y saldrían DOS "Backspace"; si no existiera, con el campo armado saldría uno por
    // el `beforeinput` — el aserto de igualdad EXACTA cierra los dos lados.
    expect(cap.teclas).toEqual(["a", "Backspace"]);
  });

  it("el campo queda ARMADO (no vacío) al enfocar y tras cada tecla — la premisa de iOS", () => {
    campo().focus();
    expect(campo().value, "armado al abrir").toBe(KB_SENTINEL);
    tecleaIOS("a");
    expect(campo().value, "armado tras teclear").toBe(KB_SENTINEL);
    pulsaBackspaceIOS("Unidentified");
    expect(campo().value, "armado tras borrar").toBe(KB_SENTINEL);
    // MUTANTE del estado viejo (campo vacío): con `""` el emulador honesto no emite
    // `beforeinput` y el ⌫ muere — es literalmente el bug. Se instancia la diferencia:
    campo().value = "";
    const cap = capturaTeclas();
    pulsaBackspaceIOSVacioSinCinturon();
    cap.dispose();
    expect(cap.teclas, "campo vacío + keydown no identificado = la señal se pierde").toEqual([]);

    function pulsaBackspaceIOSVacioSinCinturon(): void {
      // Igual que `pulsaBackspaceIOS("Unidentified")`: keydown de composición sobre el
      // campo vacío. Encapsulado con nombre para que el aserto se lea solo.
      pulsaBackspaceIOS("Unidentified");
    }
  });

  it("el centinela NUNCA se cuela en el juego: sólo salen los chars de `data`", () => {
    const cap = capturaTeclas();
    campo().focus();
    tecleaIOS("v");
    tecleaIOS("a");
    tecleaIOS("s");
    cap.dispose();
    expect(cap.teclas).toEqual(["v", "a", "s"]);
    expect(cap.teclas.join("")).not.toContain(KB_SENTINEL);
  });

  it("CONTROL POSITIVO: el teclado físico (keydown en window, sin foco en el campo) ni se toca", () => {
    // El físico no pasa por el campo: el puente no debe interceptarlo ni duplicarlo.
    const cap = capturaTeclas();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    cap.dispose();
    expect(cap.teclas).toEqual(["Backspace"]);
  });

  it("borrado por palabra (`deleteWordBackward`) = UN Backspace (el campo sólo lleva el centinela)", () => {
    const cap = capturaTeclas();
    campo().focus();
    const bi = new InputEvent("beforeinput", {
      inputType: "deleteWordBackward",
      bubbles: true,
      cancelable: true,
    });
    campo().dispatchEvent(bi);
    cap.dispose();
    expect(cap.teclas).toEqual(["Backspace"]);
    expect(bi.defaultPrevented, "el default muere: el campo conserva su centinela").toBe(true);
  });
});
