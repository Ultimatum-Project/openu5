// @vitest-environment jsdom
/**
 * #334 — El régimen táctil se RE-EVALÚA: un 2-en-1 que cambia de modo a mitad de sesión
 * ya no se queda con el valor del montaje.
 *
 * QUÉ ERA (censo del carril, `game/src`): el predicado `(pointer: coarse) || ?touch=1`
 * estaba escrito a mano en SIETE sitios, y CINCO no volvían a mirar. Los dos que sí
 * evalúan por llamada —el ajuste de escala de las pieles y la intro— SEGUÍAN el cambio,
 * así que el defecto no era retraso uniforme sino DIVERGENCIA: dos verdades a la vez.
 * Aquí se cierra el del deck; los otros cuatro van en #336 con el censo hecho.
 *
 * 🔴 EL ASERTO QUE MÁS IMPORTA es el último: volver vivo el régimen NO puede deshacer el
 * cinturón (a) de #333. El fix de #333 es un early-return en `expectInput` gobernado por
 * la MISMA bandera que ahora se mueve sola; quien «simplifique» ese early-return al
 * refactorizar rompe #333 sin tocar su fichero ni su test.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { TouchControls, setExpectedInput, onExpectedSheet } from "../src/ui/touch.js";
import { esTactilAhora, onCambioRegimenTactil } from "../src/ui/regimen-tactil.js";
import type { Game } from "../src/core/game.js";

/** MediaQueryList controlable: `emitir()` dispara el `change` como haría el navegador. */
interface MqFalsa {
  poner(coarse: boolean): void;
  oyentes(): number;
}

function stubMatchMedia(inicialCoarse: boolean): MqFalsa {
  let coarse = inicialCoarse;
  const cbs = new Set<() => void>();
  window.matchMedia = ((q: string) => ({
    get matches() {
      return q.includes("coarse") ? coarse : false;
    },
    media: q,
    addEventListener: (_: string, cb: () => void) => cbs.add(cb),
    removeEventListener: (_: string, cb: () => void) => cbs.delete(cb),
    addListener: (cb: () => void) => cbs.add(cb),
    removeListener: (cb: () => void) => cbs.delete(cb),
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
  return {
    poner(v: boolean) {
      coarse = v;
      for (const cb of [...cbs]) cb();
    },
    oyentes: () => cbs.size,
  };
}

function montarDeck(): { root: HTMLElement; deck: TouchControls } {
  document.body.innerHTML = "";
  document.documentElement.className = "";
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const game = { combat: null, dungeonState: null } as unknown as Game;
  const deck = new TouchControls(parent, game);
  return { root: (deck as unknown as { root: HTMLElement }).root, deck };
}

const tieneClase = (): boolean => document.documentElement.classList.contains("u5-touch");

describe("#334 — la primitiva de régimen táctil", () => {
  beforeEach(() => window.history.replaceState(null, "", "/"));

  it("lee el puntero EN VIVO, no una foto del arranque", () => {
    const mq = stubMatchMedia(false);
    expect(esTactilAhora()).toBe(false); // control positivo del arnés: sabe decir «no»
    mq.poner(true);
    expect(esTactilAhora()).toBe(true);
  });

  it("`?touch=1` manda sobre la media query, y el oyente ve el régimen RESUELTO", () => {
    const mq = stubMatchMedia(false);
    window.history.replaceState(null, "", "/?touch=1");
    expect(esTactilAhora()).toBe(true);
    const vistos: boolean[] = [];
    const off = onCambioRegimenTactil((t) => vistos.push(t));
    mq.poner(false); // el puntero dice «fino»…
    off();
    // …y aun así el régimen es TÁCTIL, porque la URL lo fuerza. Si el oyente recibiera
    // `ev.matches` en crudo vería `false` y apagaría el deck de quien puso ?touch=1.
    expect(vistos).toEqual([true]);
  });
});

describe("#334 — el deck sigue el cambio de puntero", () => {
  beforeEach(() => window.history.replaceState(null, "", "/"));

  it("ESCRITORIO → TABLETA: aparece el deck y entra `u5-touch`", () => {
    const mq = stubMatchMedia(false);
    const { root } = montarDeck();
    expect(root.style.display).toBe("none");
    expect(tieneClase()).toBe(false);
    mq.poner(true);
    expect(root.style.display).toBe("flex");
    expect(tieneClase()).toBe(true);
  });

  it("TABLETA → ESCRITORIO: se esconde el deck y SALE `u5-touch`", () => {
    // La dirección inversa es la que se olvida: antes la clase se añadía y no se quitaba
    // nunca, así que el CSS de layout táctil seguía reservando banda sin deck.
    const mq = stubMatchMedia(true);
    const { root } = montarDeck();
    expect(root.style.display).toBe("flex");
    expect(tieneClase()).toBe(true);
    mq.poner(false);
    expect(root.style.display).toBe("none");
    expect(tieneClase()).toBe(false);
  });

  it("`dispose()` da de baja la suscripción (sin oyentes huérfanos tras remontar)", () => {
    const mq = stubMatchMedia(false);
    const { deck } = montarDeck();
    expect(mq.oyentes()).toBeGreaterThan(0);
    deck.dispose();
    expect(mq.oyentes()).toBe(0);
  });
});

describe("#334 — el cinturón (a) de #333 SOBREVIVE al régimen vivo", () => {
  beforeEach(() => window.history.replaceState(null, "", "/"));

  it("tras ir a táctil y VOLVER, el puente del teclado sigue mudo en escritorio", () => {
    const mq = stubMatchMedia(false);
    montarDeck();
    const hojas: (string | null)[] = [];
    const off = onExpectedSheet((s) => hojas.push(s));
    try {
      mq.poner(true); // tableta: el puente SÍ debe recibir — control positivo
      setExpectedInput("string");
      expect(hojas).toEqual(["az"]);
      mq.poner(false); // y de vuelta a portátil: el cinturón (a) manda otra vez
      setExpectedInput("string");
      expect(hojas).toEqual(["az"]); // ni una hoja más
    } finally {
      off();
    }
  });
});
