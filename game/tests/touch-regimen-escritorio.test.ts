// @vitest-environment jsdom
/**
 * #333 — En Chrome de ESCRITORIO salían los controles táctiles y se activaban teclados.
 *
 * REPORTE DEL USUARIO (15-08): en escritorio aparecen todos los controles del deck y se
 * levantan teclados que no ha pedido.
 *
 * ESTE FICHERO CUBRE EL CINTURÓN (a) Y SÓLO ÉSE: `expectInput` sale temprano fuera del
 * régimen táctil. El motor llama a `setExpectedInput` en CADA prompt, viva o no el deck;
 * en escritorio eso alzaba una hoja invisible y —lo que el usuario nota— avisaba al
 * puente del teclado del sistema (`onExpectedSheet`, deck-nativo.ts), que enfoca su input
 * oculto y le roba el foco al teclado físico.
 *
 * 🔴 LO QUE ESTE FICHERO NO DICE: no acredita que el cinturón (a) sea LA causa del
 * reporte. El deck ya se ocultaba con `display:none` desde antes, así que la aparición de
 * los controles pide otra explicación —la que el lead tiene pendiente de discriminar con
 * el usuario— y no se cierra aquí. Lo que sí es cierto bajo cualquiera de las hipótesis
 * es que un deck invisible no debe alzar hojas ni llamar al teclado del sistema.
 *
 * 🔴 Y el régimen se decide UNA VEZ al montar: un 2-en-1 que cambia de modo a mitad de
 * sesión queda con el valor rancio en las dos direcciones. Es defecto CONOCIDO, con ficha
 * propia (#334) y deliberadamente fuera de alcance aquí.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { TouchControls, setExpectedInput, onExpectedSheet } from "../src/ui/touch.js";
import type { Game } from "../src/core/game.js";

/** Fija el puntero primario que verá el detector, y la query string. */
function stubEntorno(puntero: "coarse" | "fine", search: string): void {
  window.matchMedia = ((q: string) => ({
    matches: q.includes(puntero),
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  if (!("ResizeObserver" in window)) {
    (window as unknown as Record<string, unknown>).ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
    globalThis.ResizeObserver = (window as unknown as { ResizeObserver: typeof ResizeObserver })
      .ResizeObserver;
  }
  window.history.replaceState(null, "", search);
}

/**
 * Monta un deck en el régimen pedido y devuelve las hojas que el puente del teclado del
 * sistema recibe durante `fn`. Lista vacía = el puente no fue llamado.
 */
function hojasAvisadas(
  puntero: "coarse" | "fine",
  search: string,
  fn: () => void,
): { hojas: (string | null)[]; display: string; hoja: string | undefined } {
  stubEntorno(puntero, search);
  document.body.innerHTML = "";
  document.documentElement.className = "";
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const game = { combat: null, dungeonState: null } as unknown as Game;
  const deck = new TouchControls(parent, game);
  const hojas: (string | null)[] = [];
  const off = onExpectedSheet((s) => hojas.push(s));
  try {
    fn();
  } finally {
    off();
  }
  return {
    hojas,
    display: (deck as unknown as { root: HTMLElement }).root.style.display,
    // `applyMode` publica la hoja viva en <html>. Es el observable que distingue una
    // guarda COLOCADA BIEN (sale antes de mutar nada) de una tardía que sólo tapa el
    // aviso al puente — el mutante M3 sobrevivía a los asertos que sólo miran `hojas`.
    hoja: document.documentElement.dataset.deckSheet,
  };
}

describe("#333 — el auto-alzado respeta el régimen táctil", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  // CONTROL POSITIVO, y va PRIMERO: sin él, el negativo de abajo pasaría igual con un
  // arnés que no observa nada (que es exactamente cómo nace un verde hueco).
  it("en TÁCTIL el puente del teclado SÍ recibe la hoja", () => {
    const { hojas, display, hoja } = hojasAvisadas("coarse", "/", () => setExpectedInput("string"));
    expect(hojas).toEqual(["az"]);
    expect(display).toBe("flex");
    expect(hoja).toBe("az"); // la hoja SÍ se alza
  });

  it("en ESCRITORIO el puente del teclado NO recibe nada", () => {
    const { hojas, display, hoja } = hojasAvisadas("fine", "/", () => setExpectedInput("string"));
    expect(hojas).toEqual([]);
    expect(display).toBe("none");
    // Y NINGUNA hoja se alzó: la guarda sale ANTES de mutar el modo, no sólo antes del aviso.
    expect(hoja).toBe("move");
  });

  it("en escritorio NINGUNA clase de input llama al puente", () => {
    // El reporte habla de «teclados» en plural y las clases entran por sitios distintos
    // del motor. Se enumeran todas: que el early-return no dependa del `kind`.
    const { hojas } = hojasAvisadas("fine", "/", () => {
      setExpectedInput("digit");
      setExpectedInput("string");
      setExpectedInput("yesno");
      setExpectedInput("dir");
      setExpectedInput(null);
    });
    expect(hojas).toEqual([]);
  });

  it("`?touch=1` sigue siendo la puerta de pruebas en escritorio", () => {
    // Decisión, y la declaro porque el lead me la asignó: `?touch=1` NO es sólo del
    // arnés — es la salida documentada para el caso ambiguo (un portátil táctil que el
    // detector clasifique como escritorio, o alguien que quiera el deck a propósito).
    // Por eso el cinturón lo respeta en vez de exigir `pointer: coarse` a secas.
    const { hojas, display } = hojasAvisadas("fine", "/?touch=1", () =>
      setExpectedInput("string"),
    );
    expect(hojas).toEqual(["az"]);
    expect(display).toBe("flex");
  });
});
