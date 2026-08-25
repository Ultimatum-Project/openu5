/**
 * GUARDA DE ARRANQUE MÓVIL — de «cold load» a partida andando SÓLO CON EL DEDO.
 *
 * POR QUÉ EXISTE. Todas las demás specs móviles arrancan con `gotoMobile()`, que mete
 * `?nointro` (`e2e/mobile/deck.ts:263`): entran YA dentro del mundo. O sea que la suite
 * móvil, siendo exhaustiva, nunca ha pisado la portada — ni la intro, ni el menú «Elegid»,
 * ni la creación de personaje. Ese hueco es la razón de que en el carril portrait se
 * pudiera sostener durante horas un diagnóstico FALSO («el menú no es tappable») sin que
 * nada lo contradijera: no había red ni para el hueco real ni para el falso positivo.
 *
 * QUÉ VIGILA, y en este orden:
 *   1. Que la portada llega al menú por el botón DOM «Tap to continue» (el canvas NO
 *      avanza el attract: es no-op a propósito).
 *   2. **Que el menú de portada es TAPPABLE** — el tap cae en el renglón por `menuRowHit`
 *      y dispara su comando. Es la afirmación que hay que poder desmentir.
 *   3. Que la creación de personaje se completa sin teclado FÍSICO: nombre por el `<input>`
 *      DOM (el que abre el teclado del sistema en un móvil real), sexo y quiz por sus
 *      botones táctiles.
 *   4. Que se llega al mundo con el deck montado.
 *
 * SIN `?touch=1` A PROPÓSITO: el gate `introIsTouch()` (`faithful-intro.ts:2152`) debe
 * dispararse por la detección de PRODUCCIÓN `(pointer: coarse)` que da la emulación del
 * proyecto. Si esa detección se rompe, esta spec lo ve — misma doctrina que el resto de la
 * suite móvil declara para el deck.
 *
 * LA GEOMETRÍA DEL MENÚ SE IMPORTA, NO SE COPIA: `menuFirstRow` es la MISMA función que usa
 * el pintor y el hit-test. Si el menú se mueve de fila, esta spec se mueve con él; si se
 * rompe el hit-test, falla. Copiar el 136 a mano habría creado un tercer sitio donde vive
 * la misma constante.
 */
import { expect, test, type Page } from "@playwright/test";
import { menuFirstRow } from "../../src/skin/fiel/intro.js";

/** Alto de la pantalla lógica del original (320×200). */
const SCREEN_H = 200;
/** Fila de rejilla = 8 px lógicos. */
const ROW = 8;
/** Índice de «Create New Character» en el menú (JCTUAR → J=0, C=1). */
const CREATE_INDEX = 1;

/** Fase viva de la intro (hook e2e DEV, `main.ts:510`). */
async function introPhase(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      (
        window as unknown as { __u5test?: { introPhase?: () => string } }
      ).__u5test?.introPhase?.() ?? null,
  );
}

/**
 * Toca el RENGLÓN de una opción del menú sobre el canvas (lo que hace un dedo).
 *
 * La primera fila depende de si el logo gótico está cargado (17 con logo, 9 sin él) y NO
 * hay hook público para saberlo. En vez de inventar un detector —que sería un instrumento
 * mintiendo, justo lo que esta spec existe para evitar— se prueban las DOS geometrías: la
 * de producción primero y el fallback textual después. Falla sólo si NINGUNA acierta, que
 * es exactamente la condición «el menú no responde al dedo».
 */
async function tapMenuRow(page: Page, index: number): Promise<void> {
  const box = await page.locator("canvas").first().boundingBox();
  expect(box, "el canvas de la portada tiene que existir").not.toBeNull();
  for (const logo of [true, false]) {
    const pyLogical = (menuFirstRow(logo) + index) * ROW + ROW / 2;
    await page.mouse.click(box!.x + box!.width / 2, box!.y + (pyLogical / SCREEN_H) * box!.height);
    await page.waitForTimeout(400);
    if ((await introPhase(page)) !== "menu") return; // el tap disparó su comando
  }
}

test.describe("arranque móvil: de la portada al mundo sólo con el dedo", () => {
  test("cold load SIN nointro llega a partida andando", async ({ page }) => {
    test.setTimeout(120_000); // la portada tiene cinemática; el criterio es llegar, no correr

    await page.addInitScript(() => localStorage.clear());
    // (b) LA PIEL SE PIDE, NO SE HEREDA (04-08). Este test mide «de la portada al mundo
    // sólo con el dedo»; la piel le da IGUAL, pero heredaba la de fábrica sin decirlo, así
    // que el cambio de defecto lo habría movido de suelo en silencio. Se pincha explícita
    // —misma disciplina que el `layout` obligatorio de `gotoMobile`— y NINGÚN aserto de
    // este test cambia: lo único que cambia es que ahora declara contra qué corre.
    await page.goto("/?skin=faithful&lang=es");

    // ── 1) La portada llega al menú, y se llega por el BOTÓN DOM ─────────────────
    // DOS TRAMPAS, las dos verificadas en vivo por el lead sobre el build desplegado:
    //  · Durante el attract, tocar el CANVAS es NO-OP A PROPÓSITO (`introTapHandler`
    //    exige `phase==="menu"`; el pointer sólo desbloquea el audio y NO corta el demo).
    //    La vía es el botón DOM «Tap to continue» — una spec que tocara el lienzo se
    //    colgaría mirando la Invocación, que es lo que le pasó a su primera sonda.
    //  · Los logos de arranque AUTO-AVANZAN con reloj propio. Por eso aquí NO se afirma
    //    «el tap hace avanzar»: llegar al menú no prueba nada sobre el tap, y afirmarlo
    //    sería un falso «funciona» — el mismo error que esta spec existe para evitar. La
    //    aserción del tap es la del paso 2, que NO auto-avanza.
    const advance = page.locator(".intro-touch-advance");
    await expect(advance, "la portada debe ofrecer «Tap to continue» en táctil").toBeVisible({
      timeout: 30_000,
    });
    for (let i = 0; i < 40 && (await introPhase(page)) !== "menu"; i++) {
      if (await advance.isVisible()) await advance.click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(400);
    }
    expect(await introPhase(page), "la portada tiene que desembocar en el menú").toBe("menu");

    // ── 2) EL MENÚ ES TAPPABLE ────────────────────────────────────────────────────
    // Esta es LA aserción del carril: un dedo sobre el renglón dispara su comando.
    await tapMenuRow(page, CREATE_INDEX);
    await expect
      .poll(() => introPhase(page), {
        timeout: 10_000,
        message: "tap sobre «Crear nuevo personaje» debe llevar a la gitana (fase name)",
      })
      .toBe("name");

    // ── 3) Creación SIN teclado físico ────────────────────────────────────────────
    // El nombre entra por el `<input>` DOM: es el que abre el teclado del SISTEMA en un
    // móvil real (`intro-name-entry`), y `fill` reproduce lo que escribe ese teclado.
    const nameInput = page.locator(".intro-name-entry input");
    await expect(nameInput, "la gitana necesita su campo de nombre en táctil").toBeVisible({
      timeout: 10_000,
    });
    // ESTADO REAL, no el deseado (dato del lead, medido en el desplegado): el campo nace
    // VISIBLE pero SIN foco. En un iPhone eso significa que el jugador TIENE que tocarlo
    // para levantar el teclado — iOS sólo abre el teclado con un gesto, así que
    // probablemente esté bien así. Se asierta tal cual y luego se toca, que es el gesto
    // del jugador. Si algún día hubiera auto-focus, esta aserción lo cazará y habrá que
    // decidir si es mejora o regresión.
    expect(
      await nameInput.evaluate((el) => document.activeElement === el),
      "hoy el campo NACE SIN FOCO: el jugador debe tocarlo (iOS exige gesto)",
    ).toBe(false);
    await nameInput.click();
    await nameInput.fill("Ana");
    await nameInput.press("Enter");

    await expect.poll(() => introPhase(page), { timeout: 10_000 }).toBe("sex");
    await page.locator(".intro-touch button", { hasText: /^M$/ }).click();

    // CADENA REAL DE LA CREACIÓN, medida en la primera corrida de esta spec:
    // sex → **cast** → quiz → **epilogue** → mundo. Yo había supuesto sex → quiz y la
    // corrida lo desmintió (recibió «cast»). Las dos escenas que faltaban son narrativas
    // FIELES —la gitana anuncia el torneo (witness ORIG_04) y el Codex lo cierra
    // (ORIG_12)— y avanzan con cualquier tecla, así que en táctil las cubre el botón
    // genérico «Tap to continue». Se asiertan una por una: si el día de mañana alguien se
    // salta una escena de la creación, esta spec lo dice.
    await expect.poll(() => introPhase(page), { timeout: 10_000 }).toBe("cast");
    await advance.click();

    await expect.poll(() => introPhase(page), { timeout: 10_000 }).toBe("quiz");
    // El torneo son 7 preguntas A/B: se contesta A hasta que la fase cambie.
    for (let i = 0; i < 30 && (await introPhase(page)) === "quiz"; i++) {
      await page
        .locator(".intro-touch button", { hasText: /A/ })
        .first()
        .click({ timeout: 5_000 })
        .catch(() => undefined);
      await page.waitForTimeout(250);
    }

    await expect.poll(() => introPhase(page), { timeout: 10_000 }).toBe("epilogue");
    await advance.click();

    // ── 4) Mundo andando, con el deck montado ─────────────────────────────────────
    await page.waitForFunction(
      () =>
        (
          window as unknown as { __u5test?: { worldReady?: () => boolean } }
        ).__u5test?.worldReady?.() === true,
      undefined,
      { timeout: 60_000 },
    );
    await expect(page.locator(".touch-controls")).toBeVisible();
    expect(
      await page.locator(".touch-cmd").count(),
      "el deck del mundo debe traer sus comandos",
    ).toBeGreaterThan(0);
  });
});
