/**
 * Unidades de la capa móvil UX (encargo 2026-07-24, ruling de UX-2 + fullscreen):
 *   · TapGate (ui/tap-or-drag.ts) — discriminador tap vs drag de la zona de comandos.
 *   · scrollHintState (ui/scroll-hint.ts) — chevrons "hay más" del scroll interno.
 *   · resolveFullscreenHooks (ui/fullscreen.ts) — gate de soporte (estándar/webkit/
 *     ninguno) que decide si el botón ⛶ se monta.
 * Lógica PURA: sin DOM ni navegador.
 */
import { describe, it, expect } from "vitest";
import { TapGate, TAP_SLOP_PX } from "../src/ui/tap-or-drag.js";
import { scrollHintState } from "../src/ui/scroll-hint.js";
import { resolveFullscreenHooks } from "../src/ui/fullscreen.js";

describe("TapGate (tap vs drag, slop Chebyshev)", () => {
  it("tap limpio: begin → end = true", () => {
    const g = new TapGate();
    g.begin(100, 200);
    expect(g.end()).toBe(true);
  });

  it("temblor del dedo DENTRO del slop sigue siendo tap", () => {
    const g = new TapGate();
    g.begin(100, 200);
    g.move(100 + TAP_SLOP_PX, 200); // exactamente el slop: aún tap (umbral es >)
    g.move(100, 200 - TAP_SLOP_PX);
    expect(g.end()).toBe(true);
  });

  it("arrastre vertical más allá del slop deja de ser tap (scroll, no comando)", () => {
    const g = new TapGate();
    g.begin(100, 200);
    g.move(100, 200 + TAP_SLOP_PX + 1);
    expect(g.end()).toBe(false);
  });

  it("una vez arrastrado, volver al origen NO lo re-convierte en tap", () => {
    const g = new TapGate();
    g.begin(100, 200);
    g.move(100, 260);
    g.move(100, 200); // vuelta al punto de partida
    expect(g.end()).toBe(false);
  });

  it("pointercancel (el navegador tomó el pan nativo) anula el tap", () => {
    const g = new TapGate();
    g.begin(100, 200);
    g.cancel();
    expect(g.end()).toBe(false);
  });

  it("end() sin begin() no dispara (pointerup huérfano)", () => {
    const g = new TapGate();
    expect(g.end()).toBe(false);
  });

  it("el gate es reutilizable: tras un drag, el siguiente gesto limpio vuelve a ser tap", () => {
    const g = new TapGate();
    g.begin(0, 0);
    g.move(0, 50);
    expect(g.end()).toBe(false);
    g.begin(10, 10);
    expect(g.end()).toBe(true);
  });

  it("el slop es configurable", () => {
    const g = new TapGate(2);
    g.begin(0, 0);
    g.move(3, 0);
    expect(g.end()).toBe(false);
  });
});

describe("scrollHintState (chevrons del scroll interno)", () => {
  it("sin overflow: ambos apagados", () => {
    expect(scrollHintState(0, 300, 300)).toEqual({ up: false, down: false });
    // Fracciones de px de DPR≠1 dentro del épsilon: sigue sin overflow.
    expect(scrollHintState(0, 300, 301.4)).toEqual({ up: false, down: false });
  });

  it("en el TOPE con overflow: solo down (hay más abajo)", () => {
    expect(scrollHintState(0, 300, 600)).toEqual({ up: false, down: true });
  });

  it("a MEDIAS: ambos encendidos", () => {
    expect(scrollHintState(150, 300, 600)).toEqual({ up: true, down: true });
  });

  it("al FONDO: solo up", () => {
    expect(scrollHintState(300, 300, 600)).toEqual({ up: true, down: false });
    // scrollTop fraccionario a ~1px del fondo (iOS momentum): cuenta como fondo.
    expect(scrollHintState(299.2, 300, 600)).toEqual({ up: true, down: false });
  });
});

describe("resolveFullscreenHooks (gate del botón ⛶)", () => {
  it("API estándar → hooks estándar con evento fullscreenchange", () => {
    const doc = {
      documentElement: { requestFullscreen: () => Promise.resolve() },
      exitFullscreen: () => Promise.resolve(),
      fullscreenElement: null,
    };
    const hooks = resolveFullscreenHooks(doc);
    expect(hooks).not.toBeNull();
    expect(hooks!.changeEvents).toEqual(["fullscreenchange"]);
    expect(hooks!.element()).toBeNull();
  });

  it("solo prefijo webkit (Safari iPad viejo) → hooks webkit", () => {
    const el = {};
    const doc = {
      documentElement: { webkitRequestFullscreen: () => {} },
      webkitExitFullscreen: () => {},
      webkitFullscreenElement: el,
    };
    const hooks = resolveFullscreenHooks(doc);
    expect(hooks).not.toBeNull();
    expect(hooks!.changeEvents).toEqual(["webkitfullscreenchange"]);
    expect(hooks!.element()).toBe(el);
  });

  it("sin API (Safari iPhone) → null: el botón NO se monta (degradación honesta)", () => {
    expect(resolveFullscreenHooks({ documentElement: {} })).toBeNull();
    expect(resolveFullscreenHooks(null)).toBeNull();
    expect(resolveFullscreenHooks({})).toBeNull();
  });

  it("estándar gana al prefijo si coexisten (Safari moderno)", () => {
    const doc = {
      documentElement: {
        requestFullscreen: () => Promise.resolve(),
        webkitRequestFullscreen: () => {},
      },
      exitFullscreen: () => Promise.resolve(),
      webkitExitFullscreen: () => {},
      fullscreenElement: null,
    };
    expect(resolveFullscreenHooks(doc)!.changeEvents).toEqual(["fullscreenchange"]);
  });
});

// ── keyboardClearance (ui/viewport-fit.ts) — fix del input del nombre en iPhone ──
import { keyboardClearance } from "../src/ui/viewport-fit.js";

describe("keyboardClearance (input visible con el teclado iOS abierto)", () => {
  it("sin teclado (vv = layout completo): no se toca", () => {
    expect(keyboardClearance(400, 50, 0, 844)).toBe(0);
  });

  it("teclado abierto tapando el elemento: lo sube justo por encima (+margen)", () => {
    // vv encoge a 500 de alto; elem en 480..530 → sobra 530+8-500 = 38 → -38.
    expect(keyboardClearance(480, 50, 0, 500)).toBe(-38);
  });

  it("elemento ya por encima del teclado: 0", () => {
    expect(keyboardClearance(100, 50, 0, 500)).toBe(0);
  });

  it("visualViewport con offsetTop (Safari scrollea el vv): cuenta desde vvTop", () => {
    // vv 500 de alto desplazado 100 → borde inferior 600; elem 560..610 → -18.
    expect(keyboardClearance(560, 50, 100, 500)).toBe(-18);
  });

  it("margen configurable", () => {
    expect(keyboardClearance(490, 10, 0, 500, 0)).toBe(0); // borde exacto sin margen
    expect(keyboardClearance(490, 10, 0, 500, 4)).toBe(-4);
  });
});
