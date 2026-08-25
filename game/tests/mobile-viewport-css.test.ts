/**
 * NORMAS DE VIEWPORT / SAFE-AREA del cromo móvil (auditoría UI/UX móvil 2026-07-25,
 * TANDA B) — candado de DECLARACIÓN sobre `game/index.html`.
 *
 * ¿Por qué un test de TEXTO y no de geometría? Porque estas tres normas NO son
 * observables desde el arnés:
 *   · `dvh` — en Chromium con viewport fijo (playwright) `100dvh === 100vh === innerHeight`:
 *     un e2e pasaría igual ANTES del fix. El defecto sólo se manifiesta en un Safari real
 *     con la barra del navegador desplegándose, que el arnés no puede emular.
 *   · `env(safe-area-inset-*)` — la emulación de dispositivo NO publica insets (siempre 0),
 *     así que el padding del notch no se puede medir; sólo se puede exigir que ESTÉ.
 *   · el META viewport — se lee del HTML, no del layout.
 * Lo que sí es medible (oclusión de paneles, objetivos ≥44) vive en `e2e/mobile/`.
 *
 * Lógica PURA (lee ficheros, sin DOM). Mismo patrón que `deck-glyph-census.test.ts`.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const read = (...rel: string[]): string => readFileSync(join(here, "..", ...rel), "utf8");
const HTML = read("index.html");
const TOUCH_TS = read("src", "ui", "touch.ts");
/** Las SECCIONES del drawer SISTEMA: desde la ficha #154 alojan la fila del ⇄ (y el
 *  idioma), que antes vivían en el popover ☰ de `touch.ts`. */
const SECTIONS_TS = read("src", "ui", "shell", "sections.ts");

/** El `<style>` de index.html, y el mismo sin comentarios (primer `*​/` cierra, como el
 *  parser CSS real). */
function styleBlock(): { css: string; stripped: string } {
  const at = HTML.indexOf("<style>");
  const end = HTML.indexOf("</style>");
  expect(at, "index.html tiene un bloque <style>").toBeGreaterThan(0);
  const css = HTML.slice(at + "<style>".length, end);
  return { css, stripped: css.replace(/\/\*[\s\S]*?\*\//g, "") };
}

/** Contenido del `content=` del meta viewport. */
function metaViewport(): string {
  const m = /<meta\s+name="viewport"\s+content="([^"]*)"/.exec(HTML);
  expect(m, "index.html declara el meta viewport").not.toBeNull();
  return m![1]!;
}

describe("integridad del <style> (candado del desastre 6f05b279)", () => {
  // Escribir «asterisco + barra» DENTRO de un comentario CSS lo cierra ahí: el resto de la
  // frase pasa a ser SELECTOR y se lleva por delante la regla siguiente, en silencio. Así
  // murió `.touch-controls` (el layout móvil ENTERO) en 6f05b279, y así estaba muerta
  // `.save-title` hasta este candado: el comentario de los bloques de la piel dev jubilada
  // separaba `.dialogue-*`, `.ztats-*` y `.hud-*` con esa secuencia.
  it("ningún comentario se cierra antes de tiempo (cero `*/` huérfanos)", () => {
    const { stripped } = styleBlock();
    const at = stripped.indexOf("*/");
    expect(
      at < 0 ? "" : stripped.slice(Math.max(0, at - 80), at + 40),
      "un comentario CSS se cerró antes de lo que su autor cree (todo lo que sigue hasta " +
        "el siguiente `{` se convierte en selector y MATA esa regla)",
    ).toBe("");
  });

  it("las llaves del bloque cuadran y toda declaración tiene su `:`", () => {
    const { stripped } = styleBlock();
    expect(
      (stripped.match(/\{/g) ?? []).length,
      "llaves abiertas = cerradas",
    ).toBe((stripped.match(/\}/g) ?? []).length);
    const weird: string[] = [];
    for (const m of stripped.matchAll(/\{([^{}]*)\}/g)) {
      for (const decl of m[1]!.split(";")) {
        const d = decl.trim();
        if (d && !d.includes(":")) weird.push(d.slice(0, 60));
      }
    }
    expect(weird, "declaraciones sin `propiedad: valor` (síntoma de prosa colada)").toEqual([]);
  });
});

describe("paneles DOM heredados en táctil (ítems de oclusión y de objetivos)", () => {
  // Lo MEDIBLE de estos dos ítems (encaje en el viewport, quién ocluye a quién, ≥44 px)
  // vive en e2e/mobile/mobile-panels.spec.ts; aquí sólo el candado de declaración, que es
  // lo que se puede correr sin la ventana de playwright.
  const PANELS = [".save-panel"];

  it("los tres paneles suben por encima del deck (z-index 60 > 40) en táctil", () => {
    const at = HTML.indexOf("html.u5-touch .save-panel");
    expect(at, "bloque táctil de los paneles presente").toBeGreaterThan(0);
    for (const sel of PANELS) {
      expect(HTML.slice(at), `${sel} entra en el bloque táctil`).toMatch(
        new RegExp(`html\\.u5-touch \\${sel}`),
      );
    }
    const block = HTML.slice(at, HTML.indexOf("}", at));
    expect(block, "z-index 60").toMatch(/z-index:\s*60/);
    // …y el bloque va DESPUÉS de las reglas por piel (misma especificidad: manda el orden).
    expect(at, "después de [data-shell-skin]").toBeGreaterThan(
      HTML.indexOf('[data-shell-skin="faithful"] .save-panel'),
    );
    // El deck sigue en 40 (si subiera, el 60 dejaría de bastar).
    const deckAt = HTML.indexOf(".touch-controls {");
    expect(HTML.slice(deckAt, HTML.indexOf("}", deckAt))).toMatch(/z-index:\s*40/);
  });

  it("el panel se acota al viewport y se centra en la REGIÓN LIBRE (no bajo el deck)", () => {
    const at = HTML.indexOf("html.u5-touch .save-panel");
    const block = HTML.slice(at, HTML.indexOf("}", at));
    expect(block, "ancho acotado (420 fijos se salían en un teléfono de 390)").toMatch(
      /max-width:\s*min\(420px,\s*calc\(100vw - 24px\)\)/,
    );
    expect(block, "alto acotado al hueco sobre el deck").toMatch(
      /max-height:\s*calc\(100% - var\(--u5-touch-reserve, 0px\) - 16px\)/,
    );
    expect(block, "centrado en el hueco, no en la pantalla").toMatch(
      /top:\s*calc\(50% - var\(--u5-touch-reserve, 0px\) \/ 2\)/,
    );
    // Apaisado: el hueco se desplaza en X según el lado del pad.
    expect(HTML).toMatch(/\[data-pad-side="left"\] \.save-panel/);
    expect(HTML).toMatch(/\[data-pad-side="right"\] \.save-panel/);
  });

  it("botones e inputs de los paneles declaran el suelo de 44 (y 16 px de fuente en los inputs)", () => {
    const btn = HTML.indexOf("html.u5-touch .save-btn");
    expect(btn, "regla táctil de .save-btn").toBeGreaterThan(0);
    expect(HTML.slice(btn, HTML.indexOf("}", btn))).toMatch(/min-height:\s*44px/);
    const input = HTML.indexOf("html.u5-touch .save-name");
    expect(input, "regla táctil de los inputs").toBeGreaterThan(0);
    const iblock = HTML.slice(input, HTML.indexOf("}", input));
    expect(iblock).toMatch(/min-height:\s*44px/);
    // 16 px = suelo por debajo del cual iOS hace zoom automático al enfocar.
    expect(iblock).toMatch(/font-size:\s*16px/);
  });
});

describe("safe-area del notch / barra de estado (ítem del inset superior)", () => {
  // El defecto: con viewport-fit=cover + status-bar black-translucent, la PWA instalada
  // pintaba el canvas BAJO la barra de estado. El inset va en #app (la caja que mide la
  // piel), no en el deck (que ya se insetaba por los otros tres lados).
  it("#app aplica el inset SUPERIOR en las dos orientaciones", () => {
    const rules = HTML.match(/html\.u5-touch(?:\[[^\]]*\])? #app\s*\{[^}]*\}/g) ?? [];
    expect(rules.length, "reglas de #app en táctil").toBeGreaterThanOrEqual(3);
    const withTop = rules.filter((r) => /padding-top:\s*env\(safe-area-inset-top\)/.test(r));
    // Una en el bloque portrait y otra en el landscape (las de data-pad-side ponen los
    // laterales, no el top).
    expect(withTop.length, "portrait y landscape declaran el inset superior").toBeGreaterThanOrEqual(
      2,
    );
  });

  // LA FRANJA LATERAL PASA POR DOS VARIABLES (arreglo del bug 1, 01-08). El valor sigue
  // saliendo de `env()` — pero a través de `--u5-safe-l`/`--u5-safe-r`, para que el arnés
  // pueda inyectar una franja y medir la geometría REAL (Chromium da `env()` = 0 siempre).
  // El candado se parte en dos: (a) las variables se DEFINEN desde `env()` —si alguien las
  // pone a un literal, el inset deja de existir en el teléfono— y (b) quien las consume
  // sigue siendo el lado correcto.
  it("las variables de franja se definen desde env(), no desde un literal", () => {
    const at = HTML.indexOf(":root {");
    expect(at, "index.html declara el bloque :root de las variables de franja").toBeGreaterThan(0);
    const block = HTML.slice(at, HTML.indexOf("}", at));
    expect(block, "--u5-safe-l sale de env(safe-area-inset-left)").toMatch(
      /--u5-safe-l:\s*env\(safe-area-inset-left(?:,\s*0px)?\)/,
    );
    expect(block, "--u5-safe-r sale de env(safe-area-inset-right)").toMatch(
      /--u5-safe-r:\s*env\(safe-area-inset-right(?:,\s*0px)?\)/,
    );
  });

  it("en apaisado el lado LIBRE (el que no lleva el deck) lleva su inset lateral", () => {
    expect(HTML).toMatch(/\[data-pad-side="left"\] #app\s*\{[^}]*padding-right:\s*var\(--u5-safe-r\)/);
    expect(HTML).toMatch(/\[data-pad-side="right"\] #app\s*\{[^}]*padding-left:\s*var\(--u5-safe-l\)/);
  });

  // BUG 1 (informe móvil 01-08): la franja se SUMA al ancho del deck y se gasta SÓLO por
  // el borde exterior. Antes entraba como relleno interior por los DOS lados, y con
  // `box-sizing:border-box` eso no ensancha la columna: la vacía (medido: la celda de
  // comando caía de 84 a 25 px con franja de 59). La geometría se mide en
  // `e2e/mobile/mobile-geometry.spec.ts`; aquí el candado de DECLARACIÓN, que es lo que
  // impide que alguien devuelva el `calc(8px + …)` a los dos lados sin enterarse.
  it("el deck apaisado SUMA la franja a su ancho y la gasta sólo por fuera", () => {
    for (const [side, v] of [
      ["left", "l"],
      ["right", "r"],
    ] as [string, string][]) {
      const at = HTML.indexOf(`html[data-orient="landscape"][data-pad-side="${side}"] .touch-controls`);
      expect(at, `regla del deck apaisado con el pad a la ${side}`).toBeGreaterThan(0);
      const block = HTML.slice(at, HTML.indexOf("}", at));
      expect(block, `el ancho del deck SUMA la franja (${side})`).toMatch(
        new RegExp(`width:\\s*calc\\(var\\(--u5-deck-w[^)]*\\)[^;]*\\+\\s*var\\(--u5-safe-${v}\\)\\)`),
      );
      expect(block, `la franja se gasta por el borde exterior (${side})`).toMatch(
        new RegExp(`padding-${side}:\\s*calc\\(8px \\+ var\\(--u5-safe-${v}\\)\\)`),
      );
    }
    // …y el borde INTERIOR conserva sus 8 px pelados (es el que no tiene muesca).
    const at = HTML.indexOf('html[data-orient="landscape"] .touch-controls {');
    const base = HTML.slice(at, HTML.indexOf("}", at));
    expect(base, "el bloque base ya no mete la franja por dentro").not.toMatch(
      /padding-(left|right):\s*calc\(8px \+ env\(/,
    );
    expect(base, "el relleno lateral base son 8 px pelados").toMatch(/padding-left:\s*8px/);
  });

  it("el deck sigue insetándose por sus tres lados (no se ha perdido nada)", () => {
    const at = HTML.indexOf(".touch-controls {");
    const block = HTML.slice(at, HTML.indexOf("}", at));
    for (const side of ["right", "bottom", "left"]) {
      expect(block, `.touch-controls conserva el inset ${side}`).toMatch(
        new RegExp(`env\\(safe-area-inset-${side}\\)`),
      );
    }
  });
});

/**
 * ESPEJO DEL PAD (ítem del ⇄, TANDA C — RE-BASELINEADO 27-07). El botón ⇄ de la fila
 * útil (`.touch-padtoggle`) se RETIRÓ. ⚠ Y EL DESTINO HA CAMBIADO DOS VECES (ficha #154):
 * primero fue un ítem del popover ☰ (dentro de `touch.ts`) y hoy es una FILA DEL DRAWER
 * SISTEMA — el popover se jubiló entero y el ☰ abre el drawer de un toque. Así que el
 * mecanismo vive REPARTIDO: el RÓTULO y la fila en `ui/shell/sections.ts`, y el MOTOR
 * (`togglePadSide` + persistencia + `dataset.padSide`) en `touch.ts`, unidos por la API de
 * módulo `swapPadSide()`. El candado sigue los dos trozos por separado a propósito: si un
 * día se separan de verdad, que enrojezca el que se quedó huérfano. La geometría del espejo
 * se mide en
 * `e2e/mobile/mobile-geometry.spec.ts`; aquí el candado de DECLARACIÓN.
 *
 * ⚠ LECCIÓN DEL SELLO ANTERIOR (re/notes/sello-css-texto-no-dom.md): este describe
 * estuvo VERDE EN FALSO — asertaba que el TEXTO del CSS declaraba reglas para
 * `.touch-padtoggle` mientras touch.ts ya no montaba ese botón en ningún sitio: media
 * el eslabón equivocado (la hoja de estilos) y era ciego al que importa (el DOM que la
 * consume). El candado nuevo cierra ese hueco asertando la RETIRADA en las DOS puntas:
 * ni reglas en el CSS ni creación en el código que construye el DOM.
 */
describe("cambio de lado del pad: ítem del menú ☰ y espejo del interior", () => {
  it("el botón ⇄ retirado NO deja restos: ni reglas CSS ni creación en touch.ts", () => {
    // `stripped` (sin comentarios): el comentario que DOCUMENTA la retirada puede
    // nombrar la clase; una REGLA que la seleccione, no.
    const { stripped } = styleBlock();
    expect(stripped, "index.html sin reglas del botón retirado").not.toMatch(/\.touch-padtoggle/);
    expect(TOUCH_TS, "touch.ts no crea el botón").not.toMatch(/touch-padtoggle/);
  });

  it("la función vive en el drawer SISTEMA (fila + motor) y persiste el lado", () => {
    // El RÓTULO, donde hoy se ofrece: la sección «Vídeo» del drawer (antes: `touch.ts`).
    expect(SECTIONS_TS, "fila «Swap pad side» en el drawer").toMatch(/Swap pad side/);
    // …con su gate de disponibilidad, que es lo que impide ofrecerla sin deck táctil.
    expect(SECTIONS_TS, "…gateada por padSideDisponible").toMatch(/padSideDisponible/);
    // El MOTOR sigue en el deck y se alcanza por la API de módulo (no por el popover).
    expect(TOUCH_TS, "el deck expone el toggle").toMatch(/togglePadSide\(\): void/);
    expect(TOUCH_TS, "…que invoca setPadSide").toMatch(/setPadSide\(this\.padSide === "left"/);
    expect(TOUCH_TS, "y la API de módulo que consume el drawer").toMatch(/export function swapPadSide/);
    // …y la persistencia + publicación en <html> que consume el CSS del espejo.
    expect(TOUCH_TS).toMatch(/localStorage\.setItem\(PAD_SIDE_KEY/);
    expect(TOUCH_TS).toMatch(/dataset\.padSide/);
  });

  it("el espejo va por data-pad-side (las dos orientaciones) y cubre fila principal y útil", () => {
    const { stripped } = styleBlock();
    const m = /html\.u5-touch\[data-pad-side="right"\][\s\S]{0,200}?row-reverse/.exec(stripped);
    expect(m, "hay un espejo keyado por lado del pad").not.toBeNull();
    expect(m![0], "espeja la fila principal (cruceta ↔ comandos)").toMatch(/\.touch-main/);
    expect(m![0], "y la fila utilitaria").toMatch(/\.touch-util/);
    expect(m![0], "sin atarse a una orientación concreta").not.toMatch(/data-orient/);
  });
});

describe("zoom del usuario permitido (ítem del pinch-zoom)", () => {
  it("el meta viewport NO bloquea el zoom (ni maximum-scale ni user-scalable=no)", () => {
    const content = metaViewport();
    expect(content, "maximum-scale capaba el zoom a ×1").not.toMatch(/maximum-scale/);
    expect(content, "user-scalable=no prohibía el pinch").not.toMatch(/user-scalable/);
    // …y lo que sí debe seguir declarado.
    expect(content).toMatch(/width=device-width/);
    expect(content).toMatch(/initial-scale=1/);
    expect(content, "viewport-fit=cover es la base de la safe-area").toMatch(
      /viewport-fit=cover/,
    );
  });

  it("el canvas autoriza el PINCH en táctil (con `none` el meta liberado no serviría)", () => {
    // Sólo `pinch-zoom` (nunca `auto`/`pan-*`): un dedo debe seguir sin ser gesto del
    // navegador — el tap-a-caminar y el arrastre de scrollback viven ahí.
    expect(HTML).toMatch(/html\.u5-touch canvas\s*\{[^}]*touch-action:\s*pinch-zoom/);
    // La regla base del canvas (escritorio) se queda intacta en `none`.
    expect(HTML).toMatch(/\n\s*canvas\s*\{[^}]*touch-action:\s*none/);
  });

  it("el doble-tap-zoom y el retardo de 300 ms siguen neutralizados por manipulation", () => {
    // Es la razón por la que se puede soltar el zoom sin recuperar los dos vicios que
    // motivaron el user-scalable=no.
    const at = HTML.indexOf("html, body {");
    const block = HTML.slice(at, HTML.indexOf("}", at));
    expect(block).toMatch(/touch-action:\s*manipulation/);
  });
});

describe("alto del viewport en móvil: dvh con fallback (ítem dvh)", () => {
  // El defecto: `height:100%` resuelve contra el viewport GRANDE en Safari iOS
  // no-standalone → el deck nace bajo la barra del navegador y `overflow:hidden`
  // impide alcanzarlo.
  it("html/body y #app declaran 100dvh DESPUÉS del 100% (cascada = fallback)", () => {
    for (const rule of ["html, body", "#app"]) {
      const at = HTML.indexOf(rule + " {");
      expect(at, `regla «${rule}» presente`).toBeGreaterThan(0);
      const block = HTML.slice(at, HTML.indexOf("}", at));
      // exec sobre la DECLARACIÓN (`height: …`), no indexOf del literal: los comentarios
      // del propio bloque nombran las dos unidades y falsearían el orden.
      const pct = /height:\s*100%/.exec(block);
      const dvh = /height:\s*100dvh/.exec(block);
      expect(pct, `«${rule}»: fallback 100%`).not.toBeNull();
      expect(dvh, `«${rule}»: alto dinámico 100dvh`).not.toBeNull();
      expect(
        pct!.index < dvh!.index,
        `«${rule}»: el dvh va DESPUÉS del % (si no, gana el %)`,
      ).toBe(true);
    }
  });

  it("la rejilla de comandos se acota en dvh (46dvh tras el 46vh)", () => {
    const at = HTML.indexOf(".touch-commands {");
    expect(at, "regla .touch-commands presente").toBeGreaterThan(0);
    const block = HTML.slice(at, HTML.indexOf("}", at));
    const vh = /max-height:\s*46vh/.exec(block);
    const dvh = /max-height:\s*46dvh/.exec(block);
    expect(vh, "fallback 46vh").not.toBeNull();
    expect(dvh, "alto dinámico 46dvh").not.toBeNull();
    expect(vh!.index < dvh!.index, "el dvh va DESPUÉS del vh").toBe(true);
  });

  it("el deck se re-mide con el visualViewport (la barra de iOS no dispara resize de window)", () => {
    // La reserva del deck se publica en PÍXELES MEDIDOS (no en unidades de viewport):
    // sin este listener el CSS dvh se re-resolvía pero la reserva no.
    expect(TOUCH_TS).toMatch(/window\.visualViewport/);
    expect(TOUCH_TS).toMatch(/visualViewportEvents/);
    for (const evt of ["resize", "scroll"]) {
      expect(
        new RegExp(`\\["${evt}"|"${evt}",\\s*"|,\\s*"${evt}"`).test(TOUCH_TS),
        `se escucha «${evt}» del visualViewport`,
      ).toBe(true);
    }
  });
});

/**
 * SINCRONIZACIÓN POR EVENTOS, no por polling (auditoría móvil 2026-07-25, TANDA C —
 * ítem del polling perpetuo). Lo MEDIBLE (cuántas lecturas de layout en reposo) vive en
 * `e2e/mobile/mobile-ux.spec.ts`; aquí el candado de declaración, que es lo que se puede
 * correr sin la ventana de playwright — y lo que evita que el próximo carril vuelva a
 * meter trabajo en el tick «porque es más fácil».
 */
describe("el deck se sincroniza por EVENTOS (ítem del polling perpetuo)", () => {
  it("ResizeObserver sobre el propio deck, coalescido en un rAF", () => {
    expect(TOUCH_TS).toMatch(/new ResizeObserver\(/);
    expect(TOUCH_TS, "observa su propia caja").toMatch(/this\.ro\.observe\(this\.root\)/);
    expect(TOUCH_TS, "sin bucle de notificaciones: el trabajo va a un rAF").toMatch(
      /requestAnimationFrame/,
    );
    expect(TOUCH_TS, "y se desconecta en el teardown").toMatch(/this\.ro\?\.disconnect\(\)/);
  });

  it("la orientación llega por matchMedia('change'), no por sondeo", () => {
    expect(TOUCH_TS).toMatch(/matchMedia\("\(orientation: landscape\)"\)/);
    expect(TOUCH_TS).toMatch(/addEventListener\("change", this\.onViewportChange\)/);
    // Safari <14 sólo tiene el addListener deprecado (y el deck se sirve ahí también).
    expect(TOUCH_TS).toMatch(/addListener/);
  });

  it("el tick que queda es de SEGURIDAD: 1 s y sin lecturas de layout", async () => {
    const { CONTEXT_TICK_MS } = await import("../src/ui/touch.js");
    expect(CONTEXT_TICK_MS).toBeGreaterThanOrEqual(1000);
    // El cuerpo del interval sólo llama a refresh() (comparar dos referencias); las
    // llamadas caras quedan tras el guard `if (!hasRo)`.
    const body = /setInterval\(\(\) => \{([\s\S]*?)\}, CONTEXT_TICK_MS\)/.exec(TOUCH_TS);
    expect(body, "el tick usa la constante documentada").not.toBeNull();
    const beforeGuard = body![1]!.split("if (!hasRo)")[0]!;
    expect(beforeGuard, "sin syncReserve en el camino normal").not.toMatch(/syncReserve/);
    expect(beforeGuard, "sin updateOrientation en el camino normal").not.toMatch(
      /updateOrientation/,
    );
  });

  it("el CONTEXTO lo dispara main.ts en cada tecla e intent (refreshTouchDeck)", () => {
    const MAIN = read("src", "main.ts");
    expect(MAIN).toMatch(/refreshTouchDeck/);
    expect(
      (MAIN.match(/refreshTouchDeck\(\)/g) ?? []).length,
      "al menos: keydown + intent de tap + fin de combate",
    ).toBeGreaterThanOrEqual(3);
    expect(TOUCH_TS, "y la API de módulo existe").toMatch(/export function refreshTouchDeck/);
  });
});
