// @vitest-environment jsdom
/**
 * #336 — LOS TRES FAB DEL SHELL SIGUEN EL RÉGIMEN TÁCTIL, Y LO RE-EVALÚAN.
 *
 * QUÉ CUBRE. `visibilidad-regimen.ts`, la regla única que gobierna la clase `visible` del
 * ⚙ (`gear.ts`), el 🌐 (`languageSwitcher.ts`) y el ◧ (`skinSwitcher.ts`). Antes de #336
 * cada uno la escribía a mano leyendo `(pointer: coarse)` UNA VEZ al montar, con dos
 * defectos MEDIBLES que estos asertos fijan:
 *
 *   · `?touch=1` no contaba (era el override documentado del caso ambiguo de #333, y
 *     encendía el deck dejando estos tres botones en régimen de ratón: desvaneciéndose
 *     en una pantalla sin ratón con la que recuperarlos);
 *   · el régimen NO se re-evaluaba (la clase de #334): un 2-en-1 que se pliega a tableta
 *     a mitad de sesión conservaba el valor rancio EN LAS DOS DIRECCIONES.
 *
 * 🔴 EL OBSERVABLE ES ESTADO, NO LLAMADAS (clase #335). Cada aserto mira
 * `btn.classList.contains("visible")` DESPUÉS de avanzar el reloj — que es exactamente lo
 * que el usuario ve. Un espía sobre `addEventListener` habría pasado con el botón
 * desapareciendo igual: lo que falla no es a quién se suscribe, es si el botón está ahí.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { visibilidadPorRegimen, IDLE_MS } from "../src/ui/shell/visibilidad-regimen.js";

/** Puntero primario CONMUTABLE: `poner()` dispara el `change` como haría el navegador. */
interface Puntero {
  poner(coarse: boolean): void;
}

function stubEntorno(inicialCoarse: boolean, search = "/"): Puntero {
  let coarse = inicialCoarse;
  const oyentes = new Set<() => void>();
  window.matchMedia = ((q: string) => ({
    get matches() {
      return q.includes("coarse") ? coarse : false;
    },
    media: q,
    addEventListener: (_: string, cb: () => void) => void oyentes.add(cb),
    removeEventListener: (_: string, cb: () => void) => void oyentes.delete(cb),
    addListener: (cb: () => void) => void oyentes.add(cb),
    removeListener: (cb: () => void) => void oyentes.delete(cb),
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  window.history.replaceState(null, "", search);
  return {
    poner(v: boolean): void {
      coarse = v;
      for (const cb of [...oyentes]) cb();
    },
  };
}

/** Un botón suelto en el documento, como el que monta cada FAB. */
function nuevoBoton(): HTMLElement {
  const btn = document.createElement("button");
  document.body.appendChild(btn);
  return btn;
}

/** ¿Está el botón visible AHORA? El único observable que le importa al jugador. */
const seVe = (btn: HTMLElement): boolean => btn.classList.contains("visible");

describe("#336 — visibilidad de los FAB del shell por régimen táctil", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    window.history.replaceState(null, "", "/");
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("TÁCTIL: visible, y NO se desvanece por mucho que pase el tiempo", () => {
    stubEntorno(true);
    const btn = nuevoBoton();
    visibilidadPorRegimen(btn);
    expect(seVe(btn)).toBe(true);
    vi.advanceTimersByTime(IDLE_MS * 3);
    expect(seVe(btn), "sin teclado el ⚙ es la única puerta al shell: no puede irse").toBe(true);
  });

  it("ESCRITORIO: aparece al montar y SE DESVANECE tras IDLE_MS quieto", () => {
    stubEntorno(false);
    const btn = nuevoBoton();
    visibilidadPorRegimen(btn);
    expect(seVe(btn)).toBe(true);
    vi.advanceTimersByTime(IDLE_MS + 1);
    expect(seVe(btn)).toBe(false);
  });

  it("ESCRITORIO: el movimiento del puntero lo devuelve", () => {
    stubEntorno(false);
    const btn = nuevoBoton();
    visibilidadPorRegimen(btn);
    vi.advanceTimersByTime(IDLE_MS + 1);
    expect(seVe(btn)).toBe(false);
    window.dispatchEvent(new Event("pointermove"));
    expect(seVe(btn)).toBe(true);
  });

  // ★ EL RASGO DE #334 QUE ESTA MIGRACIÓN AÑADE. Con el código anterior el botón seguía
  // en régimen de ratón tras plegar el portátil y se desvanecía en una pantalla táctil.
  it("2-EN-1 escritorio → TÁCTIL a mitad de sesión: deja de desvanecerse", () => {
    const puntero = stubEntorno(false);
    const btn = nuevoBoton();
    visibilidadPorRegimen(btn);
    vi.advanceTimersByTime(IDLE_MS + 1);
    expect(seVe(btn), "control: en escritorio SÍ se había ido").toBe(false);

    puntero.poner(true); // el usuario pliega el 2-en-1 a tableta
    expect(seVe(btn)).toBe(true);
    vi.advanceTimersByTime(IDLE_MS * 3);
    expect(seVe(btn), "ya en táctil: el temporizador del régimen viejo no puede apagarlo").toBe(
      true,
    );
  });

  // 🔴 ESTE CASO LO AÑADIÓ UN MUTANTE QUE SOBREVIVIÓ. El de arriba deja pasar
  // IDLE_MS ANTES de conmutar, así que cuando llega el cambio ya no hay temporizador
  // pendiente: retirar el `clearTimeout` de la ruta táctil no lo enrojecía. La
  // diferencia vive donde el jugador la encuentra —plegar el 2-en-1 a los dos
  // segundos de mover el ratón— y ahí el temporizador del régimen VIEJO sigue armado
  // y apaga el botón cuatro segundos después, en una pantalla ya sin ratón.
  it("2-EN-1 → TÁCTIL con el temporizador AÚN PENDIENTE: no lo apaga por detrás", () => {
    const puntero = stubEntorno(false);
    const btn = nuevoBoton();
    visibilidadPorRegimen(btn);
    vi.advanceTimersByTime(IDLE_MS / 2); // a medio camino: el temporizador sigue vivo
    expect(seVe(btn)).toBe(true);

    puntero.poner(true);
    vi.advanceTimersByTime(IDLE_MS * 3);
    expect(seVe(btn), "el temporizador del régimen viejo tenía que morir con él").toBe(true);
  });

  it("2-EN-1 TÁCTIL → escritorio a mitad de sesión: vuelve a desvanecerse", () => {
    const puntero = stubEntorno(true);
    const btn = nuevoBoton();
    visibilidadPorRegimen(btn);
    vi.advanceTimersByTime(IDLE_MS * 3);
    expect(seVe(btn), "control: en táctil seguía puesto").toBe(true);

    puntero.poner(false); // enchufa un ratón
    expect(seVe(btn), "el cambio lo enciende, no lo apaga de golpe").toBe(true);
    vi.advanceTimersByTime(IDLE_MS + 1);
    expect(seVe(btn)).toBe(false);
  });

  it("`?touch=1` en ESCRITORIO cuenta como táctil (el hueco que tenían los tres)", () => {
    stubEntorno(false, "/?touch=1");
    const btn = nuevoBoton();
    visibilidadPorRegimen(btn);
    vi.advanceTimersByTime(IDLE_MS * 3);
    expect(seVe(btn)).toBe(true);
  });

  it("PINEADO: con el menú abierto no se desvanece aunque el puntero se pare", () => {
    stubEntorno(false);
    const btn = nuevoBoton();
    let abierto = true;
    visibilidadPorRegimen(btn, { pineado: () => abierto });
    vi.advanceTimersByTime(IDLE_MS + 1);
    expect(seVe(btn)).toBe(true);

    abierto = false;
    window.dispatchEvent(new Event("pointermove")); // re-arma el temporizador
    vi.advanceTimersByTime(IDLE_MS + 1);
    expect(seVe(btn)).toBe(false);
  });

  it("la BAJA desarma: tras ella el puntero ya no toca el botón", () => {
    stubEntorno(false);
    const btn = nuevoBoton();
    const off = visibilidadPorRegimen(btn);
    vi.advanceTimersByTime(IDLE_MS + 1);
    expect(seVe(btn)).toBe(false);
    off();
    window.dispatchEvent(new Event("pointermove"));
    expect(seVe(btn), "un listener superviviente lo habría re-encendido").toBe(false);
  });
});
