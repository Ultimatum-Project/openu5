/**
 * DOS REPORTES DEL USUARIO SOBRE EL DECK EN MÓVIL (02-08), carril `deck-modos`.
 *
 * ① «cuando se selecciona teclado numérico, en botones aparece seleccionado tanto teclado
 *    ABC como numérico».
 * ② «cuando se activa el teclado ABC, por ejemplo con un Cast, cuando aparece el teclado no
 *    se desplaza el UI y no se ve el log; cuando se teclea la primera letra sí».
 *
 * POR QUÉ AQUÍ Y NO EN `tests/`. Los dos defectos son de PÍXEL VIVO y ninguno se puede
 * adjudicar sin navegador:
 *   · ① es una COLISIÓN DE COLOR entre dos clases que se aplican desde módulos distintos
 *     (`touch-mode-on` de `ui/touch.ts` y `u5kb-wanted` de `deck-nativo.ts`). Un test de
 *     texto de CSS ve las dos reglas por separado y no ve que resuelven al mismo azul; y
 *     el criterio nuevo pregunta si la hoja SE VE, que en jsdom (todo rect a 0) daría
 *     siempre «no» — el test pasaría con la polaridad invertida.
 *   · ② depende del VISUAL VIEWPORT, que jsdom no tiene.
 *
 * EL TECLADO DE iOS SE FALSIFICA, y se declara: Chromium no tiene teclado software, así
 * que se sobrescriben `height`/`offsetTop` de `window.visualViewport` y se emite su
 * `resize`. Eso reproduce EXACTAMENTE la condición que el código tiene que compensar —
 * viewport de LAYOUT intacto, viewport VISUAL encogido — que es la que iOS crea y la que
 * dejaba al log debajo del teclado.
 */
import { test, expect, type Page } from "@playwright/test";
import { gotoMobile } from "./deck";

/** Alto del teclado que se finge (iPhone 13, teclado alfabético ≈ 300 px CSS). */
const TECLADO = 300;

/** Fondo computado de un botón del deck localizado por su clase. */
async function fondo(page: Page, sel: string): Promise<string> {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return "AUSENTE";
    const b = el.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) return "INVISIBLE";
    return getComputedStyle(el).backgroundColor;
  }, sel);
}

/** Rect del canvas de juego (su borde INFERIOR es el de la banda de log en el partido). */
async function canvasRect(page: Page): Promise<{ top: number; bottom: number }> {
  return page.evaluate(() => {
    let best: DOMRect | null = null;
    for (const c of document.querySelectorAll("#app canvas")) {
      const b = c.getBoundingClientRect();
      if (!best || b.width * b.height > best.width * best.height) best = b;
    }
    if (!best) throw new Error("sin canvas de juego");
    return { top: best.top, bottom: best.bottom };
  });
}

/**
 * Finge el teclado del sistema: encoge SÓLO el visual viewport y avisa. Re-llamable con
 * otro alto (el teclado de iOS CAMBIA de tamaño en vivo — barra de autocorrección,
 * emoji, dictado), que es el caso que destapa si el lift se mide sobre sí mismo.
 */
async function abrirTecladoDelSistema(page: Page, alto = TECLADO): Promise<void> {
  await page.evaluate((h) => {
    const vv = window.visualViewport! as VisualViewport & { __altoReal?: number };
    vv.__altoReal ??= vv.height; // el alto SIN teclado, capturado una sola vez
    const real = vv.__altoReal;
    Object.defineProperty(vv, "height", { get: () => real - h, configurable: true });
    Object.defineProperty(vv, "offsetTop", { get: () => 0, configurable: true });
    vv.dispatchEvent(new Event("resize"));
  }, alto);
}

// ── ① El activo se pinta DOS VECES ────────────────────────────────────────────────
test("① con el NUMPAD alzado y VISIBLE, la pista del teclado del sistema NO se enciende", async ({
  page,
}) => {
  await gotoMobile(page, "partido");

  // Reposo: ni el activador ni el ABC realzados.
  const NEGRO = "rgb(0, 0, 0)";
  expect(await fondo(page, ".touch-util .touch-sheetbtn-num")).toBe(NEGRO);
  expect(await fondo(page, ".u5kb-btn")).toBe(NEGRO);

  await page.locator(".touch-util .touch-sheetbtn-num").tap();
  await expect(page.locator(".touch-sheet-num")).toHaveClass(/touch-sheet-on/);

  // La hoja de números SE VE en este layout: el dedo tiene las teclas 1-9 delante.
  const numVisible = await page.evaluate(
    () => document.querySelector(".touch-sheet-num")!.getBoundingClientRect().height > 0,
  );
  expect(numVisible, "premisa del criterio: en el layout partido el numpad SÍ se alza").toBe(true);

  // El ACTIVO (activador «123 Numbers») está encendido…
  const activo = await fondo(page, ".touch-util .touch-sheetbtn-num");
  expect(activo).not.toBe(NEGRO);
  // …y el ABC NO. Éste es el reporte: antes salían LOS DOS con el mismo azul.
  expect(
    await fondo(page, ".u5kb-btn"),
    "el ABC no debe realzarse cuando el numpad está a la vista",
  ).toBe(NEGRO);
  expect(await page.locator(".u5kb-btn").getAttribute("class")).not.toContain("u5kb-wanted");
});

test("① el realce del ACTIVO y el de la PISTA son EL MISMO color: por eso el criterio tiene que separarlos", async ({
  page,
}) => {
  await gotoMobile(page, "partido");
  // Se fuerzan los dos estados a la vez desde el DOM (no por flujo: aquí se mide el
  // COLOR, no la lógica) para dejar registrado que un canal no puede distinguirse del
  // otro por el píxel — que es lo que hacía indistinguible «pista» de «activo».
  const [a, b] = await page.evaluate(() => {
    const act = document.querySelector(".touch-sheetbtn-num") as HTMLElement;
    const kb = document.querySelector(".u5kb-btn") as HTMLElement;
    act.classList.add("touch-mode-on");
    kb.classList.add("u5kb-wanted");
    const r = [getComputedStyle(act).backgroundColor, getComputedStyle(kb).backgroundColor];
    act.classList.remove("touch-mode-on");
    kb.classList.remove("u5kb-wanted");
    return r;
  });
  expect(a).toBe(b);
  expect(a).not.toBe("rgb(0, 0, 0)");
});

test("① con la hoja A–Z alzada (que en este layout NO se ve), la pista SÍ se enciende", async ({
  page,
}) => {
  await gotoMobile(page, "partido");
  // Cast → picker de PJ (dígitos) → nombre del conjuro (texto): el flujo que nombra el
  // usuario. El picker se contesta por tecla, como haría el numpad.
  await page.locator(".touch-commands .touch-cmd", { hasText: "Cast" }).first().tap();
  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true })),
  );
  await expect(page.locator(".touch-sheet-az")).toHaveClass(/touch-sheet-on/);
  const azVisible = await page.evaluate(
    () => document.querySelector(".touch-sheet-az")!.getBoundingClientRect().height > 0,
  );
  expect(azVisible, "premisa: la hoja A–Z está OCULTA en el layout partido").toBe(false);
  expect(await page.locator(".u5kb-btn").getAttribute("class")).toContain("u5kb-wanted");
});

// ── ② El UI no se desplaza hasta la primera tecla ─────────────────────────────────
test("② al alzarse la hoja A–Z el UI SUBE ya —sin teclear— y la banda de log queda sobre el teclado", async ({
  page,
}) => {
  await gotoMobile(page, "partido");
  const antes = await canvasRect(page);

  await page.locator(".touch-commands .touch-cmd", { hasText: "Cast" }).first().tap();
  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true })),
  );
  await expect(page.locator(".touch-sheet-az")).toHaveClass(/touch-sheet-on/);
  // El puente ha enfocado su campo: es el instante en que iOS despliega el teclado.
  expect(await page.evaluate(() => document.activeElement?.className)).toContain("u5kb-input");

  const bordeTeclado = await page.evaluate(() => window.innerHeight - 300);
  expect(
    antes.bottom,
    "premisa del reporte: SIN compensar, la banda de log cae DEBAJO del teclado",
  ).toBeGreaterThan(bordeTeclado);

  await abrirTecladoDelSistema(page);
  const conTeclado = await canvasRect(page);

  // SIN TECLEAR NI UNA LETRA el UI ya se ha desplazado hacia arriba…
  expect(conTeclado.top, "el UI tiene que haber subido").toBeLessThan(antes.top);
  // …lo justo para que el borde inferior del canvas (= el de la banda de log) se vea.
  expect(conTeclado.bottom).toBeLessThanOrEqual(bordeTeclado);
});

test("② si el teclado CRECE, el lift se re-mide LIMPIO y no sobre sí mismo", async ({ page }) => {
  // ⚠ Este caso existe porque un MUTANTE lo pidió: quitar el «medir sin el lift previo»
  // sobrevivía a todo lo demás. Y sobrevivía por una razón boba — los otros casos alzan
  // UNA sola vez, y la realimentación sólo se ve en el SEGUNDO cálculo. El teclado de iOS
  // cambia de alto en vivo (barra de autocorrección, emoji, dictado), así que el segundo
  // cálculo no es hipotético: es el caso normal.
  await gotoMobile(page, "partido");
  await page.locator(".touch-commands .touch-cmd", { hasText: "Cast" }).first().tap();
  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true })),
  );
  await expect(page.locator(".touch-sheet-az")).toHaveClass(/touch-sheet-on/);

  await abrirTecladoDelSistema(page, 300);
  await abrirTecladoDelSistema(page, 380); // el teclado crece: segundo cálculo

  const borde = await page.evaluate(() => window.innerHeight - 380);
  expect(
    (await canvasRect(page)).bottom,
    "medido sobre el lift anterior, la corrección se queda corta y el log vuelve a taparse",
  ).toBeLessThanOrEqual(borde);
});

test("② SIN teclado desplegado no se eleva nada, aunque el prompt esté vivo", async ({ page }) => {
  // ⚠ QUÉ PRUEBA ESTO Y QUÉ NO, dicho con precisión: pincha el OBSERVABLE («con el prompt
  // vivo y sin teclado, el UI no se mueve»), NO una guarda. Hoy lo entrega la propia
  // aritmética — en vertical el deck reserva su banda, el canvas no llega al borde y
  // `keyboardClearance` da 0. Hubo aquí una guarda de «franja real» y se retiró porque su
  // mutante no moría (ver la nota en `deck-nativo.ts`); el observable se queda vigilado
  // igual, que es lo que le importa al usuario.
  await gotoMobile(page, "partido");
  const antes = await canvasRect(page);
  await page.locator(".touch-commands .touch-cmd", { hasText: "Cast" }).first().tap();
  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true })),
  );
  await expect(page.locator(".touch-sheet-az")).toHaveClass(/touch-sheet-on/);
  expect(await page.evaluate(() => document.activeElement?.className)).toContain("u5kb-input");
  // El campo está enfocado pero el visual viewport NO ha encogido: cero franja, cero lift.
  expect((await canvasRect(page)).top).toBe(antes.top);
});

test("② en APAISADO no se eleva: allí el log va en un raíl a toda la altura y subir recorta", async ({
  page,
}) => {
  // El defecto de ② es de VERTICAL (banda de log DEBAJO del mapa). En apaisado el canvas
  // reparte en COLUMNAS: medido, el lift se comía 158 px de canvas sin rescatar nada.
  await gotoMobile(page, "partido");
  await page.setViewportSize({ width: 844, height: 340 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.orient))
    .toBe("landscape");
  await page.waitForTimeout(400);
  const antes = await canvasRect(page);

  await page.locator(".touch-commands .touch-cmd", { hasText: "Cast" }).first().tap();
  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true })),
  );
  await expect(page.locator(".touch-sheet-az")).toHaveClass(/touch-sheet-on/);
  await abrirTecladoDelSistema(page, 150); // el teclado en apaisado es mucho más bajo

  expect(
    (await canvasRect(page)).top,
    "en apaisado el canvas no se toca: no hay banda de log que rescatar",
  ).toBe(antes.top);
});

test("② al cerrarse el teclado el UI vuelve a su sitio (el lift no se queda pegado)", async ({
  page,
}) => {
  await gotoMobile(page, "partido");
  const antes = await canvasRect(page);

  await page.locator(".touch-commands .touch-cmd", { hasText: "Cast" }).first().tap();
  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true })),
  );
  await expect(page.locator(".touch-sheet-az")).toHaveClass(/touch-sheet-on/);
  await abrirTecladoDelSistema(page);
  expect((await canvasRect(page)).top).toBeLessThan(antes.top);

  await page.evaluate(() => (document.querySelector(".u5kb-input") as HTMLElement).blur());
  const despues = await canvasRect(page);
  expect(despues.top).toBe(antes.top);
});
