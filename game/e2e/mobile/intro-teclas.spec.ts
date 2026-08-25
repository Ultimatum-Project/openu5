/**
 * BOTONERA DE TECLAS DE LA INTRO EN MÓVIL (ficha #33) — la ENTREGA, no el artefacto.
 *
 * PETICIÓN DEL USUARIO desde su iPhone: «en movil en intro hay que poner teclado de up
 * down y enter y esc por que es muy dificil hacer tap en los items del menu de intro».
 *
 * LA CIFRA QUE JUSTIFICA EL ENCARGO, medida aquí en vivo y NO cableada: el renglón de
 * una opción del menú es UNA fila de rejilla (8 px lógicos de 200) del canvas de la
 * portada, y a 390 px de ancho `integerScale` da 1 ⇒ el canvas se sirve a 320×200 CSS px
 * y el renglón mide **8 px CSS**, el 18 % del suelo táctil de 44. El test lo RECALCULA
 * del `boundingBox` vivo: si algún día el canvas se sirviera más grande, la cifra baja
 * sola y este test lo dice en su mensaje de fallo en vez de mentir con un 8 fijo.
 *
 * QUÉ AFIRMA, en orden:
 *   1. La botonera existe en el menú y sus teclas cumplen el suelo táctil (≥44 px en
 *      LOS DOS ejes) — que es lo que el renglón de 8 px no puede cumplir.
 *   2. NO se solapa con NINGÚN otro control visible. Guarda de regresión con dientes:
 *      los FAB de idioma/piel son `position:fixed; bottom:14px; z-index:99990` y con el
 *      `bottom:6%` original la fila caía 3 px DENTRO de ellos — en esa franja el tap se
 *      lo llevaba el FAB. Medido, no supuesto.
 *   3. ▲/▼ MUEVEN el resalte (hook DEV `introMenuSelected`; el resalte es vídeo inverso
 *      pintado a canvas y no hay otra forma de observarlo) y hacen wrap 0↔5, calco de
 *      INTRO.OVL 0x0dc4/0x0dd8.
 *   4. ⏎ dispara el comando de la opción VIVA (0x0da1 → 0x0de2, tabla "JCTUAR"): con el
 *      cursor en «Create New Character» entra en la creación, no en otra cosa.
 *   5. Esc saca de The Summoning (21 escenas) de vuelta al menú — hoy la única salida
 *      con el dedo era tocar «Tap to continue» veintiuna veces.
 *   6. En el MENÚ no hay Esc, y no por gusto: el traductor de teclas del menú del
 *      original enumera lo que acepta (INTRO.OVL 0x0e16-0x0e42) y manda todo lo demás a
 *      0x0e27 (`mov byte [bp-0xe],0` = ignorar). 0x1b no está en esa lista.
 *
 * SIN `?touch=1`: el gate `introIsTouch()` debe dispararse por la detección de
 * PRODUCCIÓN `(pointer: coarse)` que da la emulación del proyecto — misma doctrina que
 * `mobile-arranque.spec.ts`.
 */
import { expect, test, type Page } from "@playwright/test";
import { INTRO_PAD_KEYS, introPadKeys, MENU_COMMANDS } from "../../src/skin/fiel/intro.js";
import { SUELO_TACTIL, assertExcepcionesVivas } from "./suelo-tactil";

/**
 * Suelo táctil de la casa (iOS HIG) — LEÍDO del módulo único, no re-escrito. El guarda
 * `tests/suelo-tactil-unico.test.ts` existe justamente para cazar la quinta copia del 44,
 * y cazó ésta: la primera versión de este spec traía su propio literal.
 * Ninguna de las excepciones declaradas cubre a `.intro-pad-key` (son del teclado QWERTY y
 * del numpad, otras clases y otras superficies), así que aquí el suelo se aplica ENTERO.
 */
const MIN_TARGET = SUELO_TACTIL;
/** Alto de la pantalla lógica del original y de una fila de rejilla. */
const SCREEN_H = 200;
const ROW = 8;
/** Índice de «Create New Character» y de «Ultima V Introduction» en "JCTUAR". */
const CREATE_INDEX = MENU_COMMANDS.indexOf("C");
const STORY_INDEX = MENU_COMMANDS.indexOf("U");

async function introPhase(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      (window as unknown as { __u5test?: { introPhase?: () => string } }).__u5test?.introPhase?.() ??
      null,
  );
}

async function menuSelected(page: Page): Promise<number | null> {
  return page.evaluate(
    () =>
      (
        window as unknown as { __u5test?: { introMenuSelected?: () => number } }
      ).__u5test?.introMenuSelected?.() ?? null,
  );
}

/**
 * Carga la portada y avanza hasta el menú por el botón DOM «Tap to continue».
 *
 * 🔴 LA CONDICIÓN SE LEE ANTES DE CLICAR, Y JUNTO CON LA BOTONERA (ficha #192, 13-08).
 * La versión anterior clicaba primero y releía después, así que en cuanto la intro corre
 * rápida —servidor caliente: logo 0,6 s · title 1,6 · attract 2,0 · **menu 2,4**, medido
 * IGUAL en los dos motores— el clic de la vuelta siguiente aterrizaba YA en el menú, que
 * es zona de impacto sobre el canvas, y relanzaba la portada. Síntoma: el bucle salía con
 * `fase === "menu"` y la línea de abajo leía `"logo"` 400 ms después. Se compraba de dos
 * maneras según la carga —60 s de timeout esperando `.intro-pad-key` con el servidor frío,
 * u 811 ms con «Received: logo» con el servidor caliente— y en LOS DOS MOTORES: fue el
 * único de los ocho rojos de la ventana que también enrojecía en Chromium, o sea que
 * nunca fue WebKit-only. El eco al salir del menú lo describía ya el propio fichero para
 * un test hermano (el attract de `SUMMONING_TIMINGS.menuIdleMs`): al dejar "menu" la
 * botonera se DESMONTA, y por eso el predicado de llegada incluye que exista.
 */
async function alMenu(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful");
  await expect
    .poll(() => introPhase(page), { timeout: 40_000, message: "la intro debe montarse" })
    .not.toBeNull();
  for (let i = 0; i < 60; i++) {
    const estado = await page.evaluate(() => ({
      fase:
        (window as unknown as { __u5test?: { introPhase?: () => string } }).__u5test?.introPhase?.() ??
        null,
      pads: document.querySelectorAll(".intro-pad-key").length,
    }));
    // Llegada = menú CON su botonera montada: es lo que todos los cuerpos usan acto seguido.
    if (estado.fase === "menu" && estado.pads > 0) return;
    // Sólo se avanza mientras NO estemos en el menú, y sólo si el botón está de verdad
    // visible: el `force` sobre un botón ya desmontado clicaba el canvas de debajo.
    if (estado.fase !== "menu") {
      const b = page.locator(".intro-touch-advance").first();
      if (await b.isVisible().catch(() => false)) await b.click().catch(() => {});
    }
    await page.waitForTimeout(400);
  }
  const final = await introPhase(page);
  expect(final, "hay que llegar al menú de portada con su botonera").toBe("menu");
  await expect(page.locator(".intro-pad-key").first()).toBeVisible({ timeout: 3_000 });
}

/** Lleva el cursor del menú a `index` a golpe de ▼ (tope: una vuelta entera). */
async function cursorA(page: Page, index: number): Promise<void> {
  for (let i = 0; i <= MENU_COMMANDS.length && (await menuSelected(page)) !== index; i++) {
    await page.locator('.intro-pad-key[data-key="ArrowDown"]').tap();
    await page.waitForTimeout(150);
  }
  expect(await menuSelected(page), `el cursor debe poder llegar a la opción ${index}`).toBe(index);
}

test.describe("intro móvil: botonera de teclas ▲ ▼ ⏎ Esc (ficha #33)", () => {
  test("el renglón del menú NO alcanza el suelo táctil, y la botonera SÍ", async ({ page }) => {
    // Las excepciones al suelo siguen AUTORIZADAS por su fuente de producto (si alguna
    // se quedó sin respaldo, este aserto la nombra antes de que nada la use).
    assertExcepcionesVivas();
    await alMenu(page);

    // 🔴 RELOJ: el menú ocioso RELANZA el attract a los 11 s (`SUMMONING_TIMINGS
    // .menuIdleMs`, bucle del original) y al salir de "menu" la botonera se desmonta.
    // Es comportamiento de producto, no un defecto — pero un `toHaveCount` con el
    // timeout de 5 s por defecto detrás de otras esperas cruzaba ese umbral y daba un
    // rojo que NO nombraba su causa (medido: fase=menu·pads=3 hasta t=13 s, fase=attract
    // ·pads=0 en t=14 s). Este cuerpo se mide TODO junto y con techo corto.
    const teclas = page.locator(".intro-pad-key");
    await expect(teclas).toHaveCount(introPadKeys("menu").length, { timeout: 3_000 });

    // (1) LA CIFRA, recalculada del canvas vivo (no cableada).
    const canvas = await page.locator("canvas").first().boundingBox();
    expect(canvas, "el canvas de la portada existe").not.toBeNull();
    const renglonCss = (canvas!.height / SCREEN_H) * ROW;
    expect(
      renglonCss,
      `el renglón de una opción mide ${renglonCss.toFixed(2)} px CSS — si esto ya llegara ` +
        `a ${MIN_TARGET} px, la botonera habría dejado de hacer falta y este test debe re-adjudicarse`,
    ).toBeLessThan(MIN_TARGET);

    // (2) Y la botonera cumple el suelo en los DOS ejes.
    for (const esperada of introPadKeys("menu")) {
      const b = page.locator(`.intro-pad-key[data-key="${esperada.key}"]`);
      await expect(b, `falta el botón de ${esperada.key}`).toBeVisible();
      const caja = (await b.boundingBox())!;
      expect(caja.width, `«${esperada.label}» ≥${MIN_TARGET} px de ancho`).toBeGreaterThanOrEqual(
        MIN_TARGET,
      );
      expect(caja.height, `«${esperada.label}» ≥${MIN_TARGET} px de alto`).toBeGreaterThanOrEqual(
        MIN_TARGET,
      );
      // Nombre accesible (gate a11y): un glifo suelto no lo es.
      expect(await b.getAttribute("aria-label"), `«${esperada.label}» sin aria-label`).toBeTruthy();
    }
  });

  test("ningún botón de la botonera se solapa con otro control visible (FAB incluidos)", async ({
    page,
  }) => {
    await alMenu(page);
    const solapes = await page.evaluate(() => {
      const caja = (el: Element): DOMRect => el.getBoundingClientRect();
      const visible = (el: Element): boolean => {
        const r = caja(el);
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
      };
      const otros = [...document.querySelectorAll("button, [role='button'], a, input, select")]
        .filter((e) => visible(e) && !e.classList.contains("intro-pad-key"));
      const out: string[] = [];
      for (const k of document.querySelectorAll(".intro-pad-key")) {
        const a = caja(k);
        for (const o of otros) {
          const b = caja(o);
          const dx = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const dy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (dx > 0 && dy > 0) {
            out.push(
              `${(k as HTMLElement).dataset.key} × ${o.className || o.tagName} ` +
                `(${Math.round(dx)}×${Math.round(dy)} px)`,
            );
          }
        }
      }
      return out;
    });
    expect(solapes, "botones de la botonera solapados con otros controles").toEqual([]);
  });

  test("▲ y ▼ mueven el resalte del menú, con wrap (calco de 0x0dc4/0x0dd8)", async ({ page }) => {
    await alMenu(page);
    const n = MENU_COMMANDS.length;
    expect(await menuSelected(page), "el menú arranca en la opción 0").toBe(0);

    await page.locator('.intro-pad-key[data-key="ArrowDown"]').tap();
    await expect.poll(() => menuSelected(page), { message: "▼ baja una opción" }).toBe(1);

    await page.locator('.intro-pad-key[data-key="ArrowUp"]').tap();
    await expect.poll(() => menuSelected(page), { message: "▲ sube una opción" }).toBe(0);

    // Wrap hacia arriba desde la 0 → la última.
    await page.locator('.intro-pad-key[data-key="ArrowUp"]').tap();
    await expect.poll(() => menuSelected(page), { message: "▲ desde la 0 da la vuelta" }).toBe(n - 1);

    // Wrap hacia abajo desde la última → la 0.
    await page.locator('.intro-pad-key[data-key="ArrowDown"]').tap();
    await expect.poll(() => menuSelected(page), { message: "▼ desde la última vuelve a la 0" }).toBe(0);
  });

  test("⏎ dispara la opción RESALTADA (indirección JCTUAR 0x0de2), no otra", async ({ page }) => {
    await alMenu(page);
    await cursorA(page, CREATE_INDEX);
    await page.locator('.intro-pad-key[data-key="Enter"]').tap();
    // 'C' → creación por la gitana: la fase pasa a "name".
    await expect
      .poll(() => introPhase(page), {
        timeout: 10_000,
        message: "⏎ sobre «Create New Character» entra en la creación",
      })
      .toBe("name");
  });

  test("Esc saca de The Summoning y devuelve al menú", async ({ page }) => {
    await alMenu(page);
    await cursorA(page, STORY_INDEX);
    await page.locator('.intro-pad-key[data-key="Enter"]').tap();
    await expect
      .poll(() => introPhase(page), { timeout: 10_000, message: "«Ultima V Introduction» → story" })
      .toBe("story");

    const esc = page.locator('.intro-pad-key[data-key="Escape"]');
    await expect(esc, "en The Summoning debe haber un Esc con el dedo").toBeVisible();
    const caja = (await esc.boundingBox())!;
    expect(caja.width).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(caja.height).toBeGreaterThanOrEqual(MIN_TARGET);

    await esc.tap();
    await expect
      .poll(() => introPhase(page), { timeout: 10_000, message: "Esc vuelve al menú" })
      .toBe("menu");
  });

  test("en el MENÚ no hay Esc — el original lo IGNORA (0x0e27), no es una omisión", async ({
    page,
  }) => {
    await alMenu(page);
    await expect(page.locator('.intro-pad-key[data-key="Escape"]')).toHaveCount(0);
    // Y la tecla FÍSICA tampoco hace nada ahí: es el mismo comportamiento, no un hueco
    // de la botonera. (Si algún día Escape adquiriera efecto en el menú, esto se pone
    // rojo y obliga a re-adjudicar contra el binario antes de añadir el botón.)
    const antes = await menuSelected(page);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    expect(await menuSelected(page), "Escape no mueve el cursor del menú").toBe(antes);
    expect(await introPhase(page), "Escape no saca del menú").toBe("menu");
  });

  test("la tabla de teclas cubre las CUATRO del encargo del usuario", () => {
    expect(INTRO_PAD_KEYS.map((k) => k.key).sort()).toEqual([
      "ArrowDown",
      "ArrowUp",
      "Enter",
      "Escape",
    ]);
  });
});
