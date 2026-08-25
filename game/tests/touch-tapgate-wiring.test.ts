// @vitest-environment jsdom
/**
 * SELLO UNITARIO del CABLEADO tap-vs-drag del deck táctil (`ui/touch.ts`,
 * `TouchControls.refresh`) — ticket mobile-e2e UX-2.
 *
 * QUÉ HUECO CIERRA. `TapGate` (ui/tap-or-drag.ts) es lógica PURA y ya se prueba sin
 * DOM. Lo que NO estaba sellado por unidad es el CABLEADO: que los botones de comando
 * disparen en `pointerup` y sólo si el gate dice que fue tap, en vez de disparar en
 * `pointerdown` como hacían antes de UX-2. Ese cableado sólo lo cubría la suite MÓVIL
 * (config aparte, EXCLUIDA de la suite dev), así que una regresión en `refresh()` no
 * la veía nadie hasta la ventana e2e. Aquí se sella con jsdom.
 *
 * ⚠ ENTORNO POR FICHERO, no global: la directiva `@vitest-environment jsdom` de arriba
 * aplica sólo a este fichero. El resto de la suite sigue en `node`, que es más rápido y
 * es lo que quieren los ~4.000 tests que no tocan DOM.
 *
 * DEFECTO QUE MIDE, y que se ha visto SUSPENDER (mutación comprobada al escribirlo):
 * re-cablear el comando a `pointerdown` —el defecto histórico— pone en rojo los tres
 * tests de abajo que no son el del tap. Un sello que sólo comprobara «el tap dispara»
 * seguiría verde con el defecto puesto: sería degenerado.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { TouchControls } from "../src/ui/touch.js";
import type { Game } from "../src/core/game.js";
import { TAP_SLOP_PX } from "../src/ui/tap-or-drag.js";

/** `game` mínimo: `refresh()` sólo lee estos dos para elegir la rejilla de comandos. */
const fakeGame = { combat: null, dungeonState: null } as unknown as Game;

/** Evento de puntero con coordenadas. jsdom no trae `PointerEvent`, y da igual: el
 *  cableado escucha por NOMBRE de evento y lee `clientX/clientY`, que `MouseEvent`
 *  sí tiene. Lo que se ejercita es el mismo listener. */
function pointer(el: Element, type: string, x = 0, y = 0): void {
  el.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
}

/** Teclas que el deck emite en `window` durante `fn` (press() → KeyboardEvent). */
function keysDuring(fn: () => void): string[] {
  const seen: string[] = [];
  const onKey = (e: Event): void => void seen.push((e as KeyboardEvent).key);
  window.addEventListener("keydown", onKey);
  try {
    fn();
  } finally {
    window.removeEventListener("keydown", onKey);
  }
  return seen;
}

/**
 * Huecos de jsdom que el constructor toca y que NO son el objeto de este sello. Se
 * rellenan con lo mínimo para que `new TouchControls` llegue a `refresh()`:
 *  - `matchMedia` (touch.ts:547, gate «(pointer: coarse)») — jsdom no lo implementa.
 *  - `ResizeObserver` (lo usa el hint de scroll de la zona de comandos).
 * Se declaran aquí y no en un setup global a propósito: que se vea qué hace falta.
 */
function stubBrowserGaps(): void {
  if (!window.matchMedia) {
    window.matchMedia = ((q: string) =>
      ({
        matches: q.includes("coarse"),
        media: q,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        onchange: null,
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia;
  }
  if (!("ResizeObserver" in window)) {
    (window as unknown as Record<string, unknown>).ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
    globalThis.ResizeObserver = (window as unknown as {
      ResizeObserver: typeof ResizeObserver;
    }).ResizeObserver;
  }
}

describe("cableado tap-vs-drag del deck (TouchControls.refresh)", () => {
  let btn: HTMLElement;

  beforeEach(() => {
    stubBrowserGaps();
    document.body.innerHTML = "";
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const deck = new TouchControls(parent, fakeGame);
    deck.refresh();
    const first = parent.querySelector<HTMLElement>(".touch-cmd");
    expect(first, "refresh() no generó ningún botón de comando").not.toBeNull();
    btn = first!;
  });

  it("TAP (down→up sin mover) DISPARA el comando", () => {
    const keys = keysDuring(() => {
      pointer(btn, "pointerdown", 100, 100);
      pointer(btn, "pointerup", 100, 100);
    });
    expect(keys).toHaveLength(1);
  });

  it("★ pointerdown A SOLAS no dispara nada (el defecto pre-UX-2 era disparar aquí)", () => {
    const keys = keysDuring(() => pointer(btn, "pointerdown", 100, 100));
    expect(keys).toEqual([]);
  });

  it("★ ARRASTRE por encima del slop NO dispara (el dedo se fue a scrollear)", () => {
    const keys = keysDuring(() => {
      pointer(btn, "pointerdown", 100, 100);
      pointer(btn, "pointermove", 100, 100 + TAP_SLOP_PX + 1);
      pointer(btn, "pointerup", 100, 100 + TAP_SLOP_PX + 1);
    });
    expect(keys).toEqual([]);
  });

  it("★ pointercancel (el navegador se queda el gesto para el pan nativo) ANULA el tap", () => {
    const keys = keysDuring(() => {
      pointer(btn, "pointerdown", 100, 100);
      pointer(btn, "pointercancel", 100, 100);
      pointer(btn, "pointerup", 100, 100);
    });
    expect(keys).toEqual([]);
  });

  it("el temblor DENTRO del slop sigue siendo tap (no se pasa de estricto)", () => {
    const keys = keysDuring(() => {
      pointer(btn, "pointerdown", 100, 100);
      pointer(btn, "pointermove", 100 + TAP_SLOP_PX, 100);
      pointer(btn, "pointerup", 100 + TAP_SLOP_PX, 100);
    });
    expect(keys).toHaveLength(1);
  });
});

/**
 * ★ TICKET #9 — EL HUECO QUE LA DECLARACIÓN DE ATERRIZAJE DEJÓ ABIERTO, cerrado aquí.
 *
 * `docs/portrait-landing-declaracion.md` §3.2 lo dice con todas las letras: «`TapGate`
 * está sellado a conciencia — 9 tests de lógica pura. **Que cada botón esté ATADO a él,
 * no.** Ni un solo test menciona `bindTap`», y la generalización al-soltar de las cinco
 * zonas nuevas quedaba «medida a mano, sin trinquete».
 *
 * POR QUÉ LA SUITE E2E NO LO CERRABA, y sigue sin cerrarlo: `tap()`/`click()` de
 * Playwright generan un `pointerdown`+`pointerup` LIMPIO, sin arrastre. Un botón que
 * volviera a disparar en `pointerdown` —el defecto histórico— PASARÍA esos tests igual.
 * El único filo que discrimina es el ARRASTRE, y eso es lo que se ejercita aquí.
 *
 * La declaración recomendaba escribirlo en e2e. Se hace en unidad a propósito: es el
 * mismo filo, corre en milisegundos, y no depende de la ventana e2e (que en este
 * aterrizaje está lejos de verde por causas ajenas — ver `re/notes/portrait-go-acta.md`).
 *
 * UNA ZONA POR FAMILIA, que es lo que pedía el ticket: tecla de hoja (QWERTY), botón de
 * fila útil, activador de hoja, segmento de barra de modo. Los comandos ya los cubre el
 * describe de arriba.
 *
 * ⚠ ALCANCE MEDIDO, no supuesto. Con el defecto puesto (`bindTap` disparando en
 * `pointerdown`) mueren TRES de las cuatro zonas — la del SEGMENTO DE BARRA DE MODO
 * SOBREVIVE, y conviene saber por qué antes de leerla como protegida: su efecto es
 * IDEMPOTENTE (`setDeckMode("az")` en el `pointerdown` y otra vez en el `pointerup` deja
 * la misma hoja alzada), así que el estado final no distingue las dos vías. Queda en la
 * lista porque el control positivo sí prueba que está VIVA y atada a algo; pero el
 * trinquete contra el defecto histórico lo dan las otras tres. Un sello que no declara
 * cuál de sus casos no muerde es un sello que se sobreestima.
 */
describe("#9 · el cableado al-soltar alcanza a las CINCO zonas, no sólo a los comandos", () => {
  /**
   * Zonas por selector. Cada una debe existir tras `refresh()` o el sello no vale.
   *
   * ⚠ LOS SELECTORES SON ESPECÍFICOS A PROPÓSITO, y el control positivo es lo que obligó
   * a afinarlos: «el primero de la clase» cogía el ☰ en las DOS familias de abajo (lleva
   * `touch-util-btn` desde que se mudó a la fila útil, y `touch-mode` de su origen en la
   * barra), y el ☰ no emite tecla ni cambia de hoja — abre un menú. Con él como sujeto,
   * el arrastre «no disparaba» porque el botón no hace nada observable, no porque esté
   * bien cableado: un VERDE SIN DIENTES. Cada zona apunta ahora a un botón cuyo efecto se
   * puede ver.
   */
  const ZONAS: ReadonlyArray<{ nombre: string; sel: string }> = [
    { nombre: "tecla de hoja QWERTY", sel: ".touch-kb" },
    { nombre: "botón de fila útil (⏎ Enter)", sel: '.touch-util-btn[data-util-key="Enter"]' },
    { nombre: "activador de hoja (123 Números)", sel: ".touch-sheetbtn-num" },
    {
      nombre: "segmento de barra de modo (A–Z)",
      sel: ".touch-modebar .touch-mode:not(.touch-shellbtn):not(.touch-mode-on)",
    },
  ];

  let deckParent: HTMLElement;

  beforeEach(() => {
    stubBrowserGaps();
    document.body.innerHTML = "";
    deckParent = document.createElement("div");
    document.body.appendChild(deckParent);
    new TouchControls(deckParent, fakeGame).refresh();
  });

  for (const { nombre, sel } of ZONAS) {
    it(`★ ${nombre}: el TAP dispara y el ARRASTRE no`, () => {
      const el = deckParent.querySelector<HTMLElement>(sel);
      expect(el, `no hay ningún «${sel}» tras refresh(): el sello mediría el vacío`)
        .not.toBeNull();

      // (1) El tap limpio SÍ hace algo. Sin esto, un botón inerte pasaría (2) por
      //     estar roto, no por estar bien cableado — el control positivo del filo.
      const tap = efectosDuring(() => {
        pointer(el!, "pointerdown", 100, 100);
        pointer(el!, "pointerup", 100, 100);
      });
      expect(tap, `${nombre}: el tap limpio no produjo NINGÚN efecto`).toBeGreaterThan(0);

      // (2) El defecto histórico: disparar en `pointerdown`. Si el botón sigue atado a
      //     `pointerdown`, este arrastre —el dedo se fue a scrollear— dispara igual.
      const arrastre = efectosDuring(() => {
        pointer(el!, "pointerdown", 100, 100);
        pointer(el!, "pointermove", 100, 100 + TAP_SLOP_PX + 20);
        pointer(el!, "pointerup", 100, 100 + TAP_SLOP_PX + 20);
      });
      expect(arrastre, `${nombre}: el ARRASTRE disparó — ¿vuelve a ir en pointerdown?`)
        .toBe(0);
    });
  }

  /**
   * Cuenta EFECTOS del gesto, no sólo teclas: los segmentos de la barra de modo y los
   * activadores de hoja NO sintetizan `keydown` (llaman a `setDeckMode`), así que un
   * contador de teclas los daría por inertes y el sello sería degenerado para ellos.
   * Se cuenta cualquiera de las dos señales observables: tecla emitida o hoja cambiada.
   */
  function efectosDuring(fn: () => void): number {
    const antes = document.querySelector(".touch-sheet-on")?.className ?? "";
    const teclas = keysDuring(fn);
    const despues = document.querySelector(".touch-sheet-on")?.className ?? "";
    return teclas.length + (antes === despues ? 0 : 1);
  }
});
