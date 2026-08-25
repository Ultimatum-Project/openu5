/**
 * SWITCHER DE IDIOMA (i18n F1) — acceso directo al cambio de idioma. Tercer FAB
 * hermano del ◧ (piel) y el ⚙ (SISTEMA), a su izquierda. Un click en un idioma =
 * cambio inmediato EN CALIENTE (persiste u5.lang), marca el activo, los idiomas
 * semilla se marcan «beta», y cierra al elegir / al clicar fuera. La etiqueta del
 * FAB muestra el código activo (EN/ES).
 *
 * Cubre: JUEGO (lista + hot-swap ligado al motor de consola) e INTRO (FAB presente,
 * ⚙ ausente por #71, elección disponible antes del menú y persistente).
 */
import { test, expect, type Page } from "@playwright/test";

const btn = '[data-testid="u5-lang-switcher"]';
const menu = '[data-testid="u5-lang-switcher-menu"]';
const item = '[data-testid="u5-lang-switcher-item"]';
const es = `${item}[data-lang-code="es"]`;
const en = `${item}[data-lang-code="en"]`;

test.describe.configure({ retries: 2 });

async function reveal(page: Page): Promise<void> {
  await page.mouse.move(300, 300); // actividad de puntero ⇒ el FAB se hace visible
  await expect(page.locator(btn)).toHaveClass(/visible/);
}

test("JUEGO: el FAB lista EN + ES (beta), marca el activo (EN por defecto)", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful&nointro");
  await expect(page.locator(".faithful-skin canvas")).toBeVisible({ timeout: 30_000 });

  await reveal(page);
  await expect(page.locator(btn)).toHaveText("EN"); // etiqueta = idioma activo
  await page.locator(btn).click();
  await expect(page.locator(menu)).toHaveClass(/open/);

  await expect(page.locator(item)).toHaveCount(2);
  await expect(page.locator(en)).toHaveClass(/active/);
  await expect(page.locator(`${es} .beta`)).toHaveText("beta"); // español = semilla
});

test("JUEGO: elegir ES cambia el idioma EN CALIENTE, traduce mensajes NUEVOS, persiste", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful&nointro");
  await expect(page.locator(".faithful-skin canvas")).toBeVisible({ timeout: 30_000 });

  await reveal(page);
  await page.locator(btn).click();
  await page.locator(es).click();

  // Menú cerrado, FAB reetiquetado, preferencia persistida (u5.lang).
  await expect(page.locator(menu)).not.toHaveClass(/open/);
  await expect(page.locator(btn)).toHaveText("ES");
  expect(await page.evaluate(() => localStorage.getItem("u5.lang"))).toBe("es");

  // Ligado al MOTOR: un mensaje NUEVO por el path real de consola sale traducido.
  const lines = await page.evaluate(() => {
    const h = (window as any).__u5test;
    h.pushConsole("Blocked!");
    return h.consoleLines() as string[];
  });
  expect(lines.some((l) => l.includes("¡Bloqueado!"))).toBe(true);
  expect(lines.some((l) => l === "Blocked!")).toBe(false);

  // Reabrir: ES es el marcado; EN no.
  await reveal(page);
  await page.locator(btn).click();
  await expect(page.locator(es)).toHaveClass(/active/);
  await expect(page.locator(en)).not.toHaveClass(/active/);
  expect(errors).toEqual([]);
});

test("JUEGO: clicar fuera cierra el menú del FAB de idioma", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful&nointro");
  await expect(page.locator(".faithful-skin canvas")).toBeVisible({ timeout: 30_000 });

  await reveal(page);
  await page.locator(btn).click();
  await expect(page.locator(menu)).toHaveClass(/open/);
  await page.mouse.click(10, 10);
  await expect(page.locator(menu)).not.toHaveClass(/open/);
});

test("INTRO: el FAB de idioma está disponible antes del menú (⚙ ausente) y persiste", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful"); // cinemática completa, sin nointro
  await expect(page.locator(".faithful-intro canvas").first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(700);

  // El ⚙ SISTEMA NO aparece en la intro (#71); el FAB de idioma SÍ.
  await expect(page.locator('[data-testid="u5-shell-gear"]')).toHaveCount(0);
  await reveal(page);
  await page.locator(btn).click();
  await expect(page.locator(menu)).toHaveClass(/open/);
  await expect(page.locator(item)).toHaveCount(2);

  // Elegir ES en la intro persiste (aplica al siguiente texto; la cinemática no se
  // re-traduce y en F1 es aún inglés — semilla).
  await page.locator(es).click();
  await expect(page.locator(btn)).toHaveText("ES");
  expect(await page.evaluate(() => localStorage.getItem("u5.lang"))).toBe("es");
});
