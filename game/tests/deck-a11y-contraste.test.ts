/**
 * ACCESIBILIDAD DEL CROMO TÁCTIL — norma MEDIBLE sin navegador (auditoría UI/UX móvil
 * 2026-07-25, TANDA C, ítem de accesibilidad del deck).
 *
 * El borde es lo ÚNICO que delimita cada objetivo táctil del deck, así que es
 * «componente de interfaz» a efectos de WCAG 2.2 SC 1.4.11 (contraste no textual):
 * mínimo 3:1 contra el color adyacente. Los valores del deck estaban por debajo:
 *   · `.touch-btn`   #6b5a2a sobre rgba(44,35,19,.82) → 2,48:1
 *   · `.touch-mode`  #4a3d20 sobre rgba(28,22,12,.82) → 1,79:1  (el peor, y en la barra
 *                     que gobierna el modo del deck)
 *   · `.touch-yn-no` #7a4a3a sobre rgba(44,35,19,.82) → 2,28:1
 *
 * Aquí se CALCULA el ratio a partir de las declaraciones reales de `index.html` (misma
 * fórmula que WCAG: luminancia relativa sRGB), así que el test no es un candado de
 * texto: si alguien vuelve a oscurecer un borde, sale el número.
 *
 * Lógica PURA (lee el fichero, sin DOM). El resto del ítem (aria-label, tablist,
 * foco visible) es DOM vivo y vive en `e2e/mobile/mobile-a11y.spec.ts`.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(here, "..", "index.html"), "utf8");
/** CSS sin comentarios (el primer `*​/` cierra, como el parser real). */
const CSS = HTML.slice(HTML.indexOf("<style>"), HTML.indexOf("</style>")).replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** Bloque de declaraciones de la regla con ESE selector exacto (el último, que es el que
 *  gana en la cascada con igual especificidad). */
function block(sel: string): string {
  const found: string[] = [];
  for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1]!.trim() === sel) found.push(m[2]!);
  }
  expect(found.length, `index.html declara una regla para ${sel}`).toBeGreaterThan(0);
  return found[found.length - 1]!;
}

/** Valor de una propiedad dentro de un bloque (última declaración = la que gana). */
function prop(blockCss: string, name: string): string {
  const all = [...blockCss.matchAll(new RegExp(`(?:^|;)\\s*${name}\\s*:([^;]+)`, "g"))];
  expect(all.length, `la regla declara ${name}`).toBeGreaterThan(0);
  return all[all.length - 1]![1]!.trim();
}

type RGBA = [number, number, number, number];

function parseColor(raw: string): RGBA {
  const hex = /#([0-9a-f]{6})/i.exec(raw);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 1];
  }
  const rgba = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i.exec(raw);
  expect(rgba, `color parseable en ${JSON.stringify(raw)}`).not.toBeNull();
  return [
    Number(rgba![1]),
    Number(rgba![2]),
    Number(rgba![3]),
    rgba![4] === undefined ? 1 : Number(rgba![4]),
  ];
}

/** Composición sobre el NEGRO del juego (el deck flota sobre el canvas/letterbox). */
function overBlack([r, g, b, a]: RGBA): [number, number, number] {
  return [r * a, g * a, b * a];
}

/** Luminancia relativa WCAG. */
function lum([r, g, b]: [number, number, number]): number {
  const ch = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function ratio(a: [number, number, number], b: [number, number, number]): number {
  const [x, y] = [lum(a), lum(b)];
  const [hi, lo] = x > y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
}

/** Norma WCAG 1.4.11 para componentes de interfaz. */
const MIN_UI_CONTRAST = 3;

/** Colores de referencia leídos del CSS vivo. */
const btnBlock = block(".touch-btn");
const btnFill = overBlack(parseColor(prop(btnBlock, "background")));
const btnBorder = overBlack(parseColor(prop(btnBlock, "border")));
const modeBlock = block(".touch-mode");
const modeFill = overBlack(parseColor(prop(modeBlock, "background")));
const modeBorder = overBlack(parseColor(prop(modeBlock, "border-color")));
const BLACK: [number, number, number] = [0, 0, 0];

describe("contraste del borde de los objetivos táctiles (WCAG 1.4.11, ≥3:1)", () => {
  it("el borde general del deck se distingue de su relleno Y del negro del canvas", () => {
    expect(ratio(btnBorder, btnFill)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
    expect(ratio(btnBorder, BLACK)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
  });

  it("la barra de modo también (era el borde MÁS flojo: 1,79:1)", () => {
    expect(ratio(modeBorder, modeFill)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
    expect(ratio(modeBorder, BLACK)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
  });

  /**
   * El ESTADO también entra en 1.4.11 («visual information required to identify user
   * interface components AND STATES»): qué modo está activo se comunica por el relleno,
   * así que ese relleno tiene que separarse ≥3:1 del de los inactivos. Lo que NO se
   * exige es que el borde del activo contraste con su propio relleno: el borde delimita
   * el botón contra el FONDO del deck, y ahí es donde se mide.
   */
  it("el estado «modo activo» se distingue del inactivo (≥3:1) y su borde delimita", () => {
    const on = block(".touch-mode-on");
    const onFill = overBlack(parseColor(prop(on, "background")));
    const onBorder = overBlack(parseColor(prop(on, "border-color")));
    expect(ratio(onFill, modeFill), "relleno activo vs inactivo").toBeGreaterThanOrEqual(
      MIN_UI_CONTRAST,
    );
    expect(ratio(onBorder, BLACK), "borde del activo vs el fondo").toBeGreaterThanOrEqual(
      MIN_UI_CONTRAST,
    );
    expect(lum(onFill), "el relleno del activo es más CLARO que el del inactivo").toBeGreaterThan(
      lum(modeFill),
    );
    // Y el rótulo del activo sigue siendo TEXTO legible sobre su relleno nuevo.
    const fg = overBlack(parseColor(prop(on, "color")));
    expect(ratio(fg, onFill), "rótulo del activo ≥4,5:1").toBeGreaterThanOrEqual(4.5);
  });

  it("la codificación por color de Sí/No cumple la norma (el rojo daba 2,28:1)", () => {
    for (const sel of [".touch-yn-yes", ".touch-yn-no"]) {
      const c = overBlack(parseColor(prop(block(sel), "border-color")));
      expect(ratio(c, btnFill), `${sel}: borde vs relleno`).toBeGreaterThanOrEqual(
        MIN_UI_CONTRAST,
      );
    }
    // …y el par sigue siendo distinguible entre sí (no se han igualado al aclararlos).
    const yes = overBlack(parseColor(prop(block(".touch-yn-yes"), "border-color")));
    const no = overBlack(parseColor(prop(block(".touch-yn-no"), "border-color")));
    expect(yes, "verde ≠ rojo").not.toEqual(no);
  });

  it("el rótulo sobre el botón mantiene contraste de TEXTO (≥4,5:1, SC 1.4.3)", () => {
    const fg = overBlack(parseColor(prop(btnBlock, "color")));
    expect(ratio(fg, btnFill)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("foco visible del deck (SC 2.4.7)", () => {
  it("`.touch-btn:focus-visible` declara un outline propio con separación", () => {
    const b = block(".touch-btn:focus-visible");
    expect(prop(b, "outline"), "outline de al menos 2 px").toMatch(/\b[2-9]px|\b\d\dpx/);
    expect(prop(b, "outline-offset"), "separado del borde para que se vea").toMatch(/\dpx/);
  });

  it("es `:focus-visible`, no `:focus` (un tap no debe dejar el anillo pegado)", () => {
    expect(CSS).not.toMatch(/\.touch-btn:focus\s*\{/);
  });
});

describe("nombres accesibles del deck (declaración; el DOM vivo va en e2e)", () => {
  const TOUCH = readFileSync(join(here, "..", "src", "ui", "touch.ts"), "utf8");

  it("la cruceta se nombra por RUMBO y está traducida al español", async () => {
    const { DPAD_ARIA } = await import("../src/ui/touch.js");
    expect(Object.keys(DPAD_ARIA).sort()).toEqual([
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
    ]);
    const { setLang } = await import("../src/i18n/index.js");
    const { ts } = await import("../src/i18n/shell.js");
    setLang("es", { persist: false });
    try {
      expect(ts(DPAD_ARIA.ArrowUp!)).toBe("Mover al norte");
      expect(ts(DPAD_ARIA.ArrowRight!)).toBe("Mover al este");
    } finally {
      setLang("en", { persist: false });
    }
  });

  it("la barra de modo publica tablist/tab/aria-selected", () => {
    expect(TOUCH).toMatch(/setAttribute\("role", "tablist"\)/);
    expect(TOUCH).toMatch(/setAttribute\("role", "tab"\)/);
    expect(TOUCH, "el activo se publica en applyMode").toMatch(/aria-selected/);
  });

  it("los rótulos y nombres accesibles son RE-TRADUCIBLES (base inglesa en data-ts-*)", () => {
    // El defecto de i18n del deck: rótulos resueltos con ts() y base perdida.
    expect(TOUCH).toMatch(/dataset\.tsLabel/);
    expect(TOUCH).toMatch(/dataset\.tsAria/);
    expect(TOUCH, "y se re-aplican al cambiar de idioma").toMatch(/onLangChange\(\(\) =>/);
  });
});
