/**
 * SWITCHER DE PIEL (task #79) — acceso directo al cambio de piel. Botón hermano del
 * ⚙: al pulsarlo despliega DIRECTAMENTE la lista de pieles user-facing (sin navegar
 * sub-menús); un click en una piel = cambio inmediato, marca la activa, persiste, y
 * cierra al elegir / al clicar fuera. La piel dev NO aparece (jubilada).
 *
 * Arranca en la piel fiel (default) con `nointro` (mundo determinista, sin cinemática).
 */
import { test, expect } from "@playwright/test";

const btn = '[data-testid="u5-skin-switcher"]';
const menu = '[data-testid="u5-skin-switcher-menu"]';
const item = '[data-testid="u5-skin-switcher-item"]';

test.describe.configure({ retries: 2 });

async function reveal(page: import("@playwright/test").Page): Promise<void> {
  await page.mouse.move(300, 300); // actividad de puntero ⇒ el FAB se hace visible
  await expect(page.locator(btn)).toHaveClass(/visible/);
}

test("el switcher lista SÓLO pieles user-facing (sin dev) y marca la activa", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful&nointro");
  await expect(page.locator(".faithful-skin canvas")).toBeVisible({ timeout: 30_000 });

  await reveal(page);
  await page.locator(btn).click();
  await expect(page.locator(menu)).toHaveClass(/open/);

  // Dos pieles ofrecidas: 1988 (fiel) y Shader (xBR). La dev NO aparece.
  const items = page.locator(item);
  await expect(items).toHaveCount(2);
  await expect(page.locator(`${item}[data-skin-id="dev"]`)).toHaveCount(0);
  // La activa (faithful) está marcada.
  await expect(page.locator(`${item}[data-skin-id="faithful"]`)).toHaveClass(/active/);
});

test("un click en una piel la cambia EN CALIENTE, persiste y cierra el menú", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful&nointro");
  await expect(page.locator(".faithful-skin canvas")).toBeVisible({ timeout: 30_000 });

  await reveal(page);
  await page.locator(btn).click();
  await expect(page.locator(menu)).toHaveClass(/open/);

  // Un click en "shader" → cambio inmediato (mismo estado vivo) + menú cerrado.
  await page.locator(`${item}[data-skin-id="shader"]`).click();
  await expect(page.locator(".shader-skin canvas").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(menu)).not.toHaveClass(/open/);
  // Persistió (misma fuente que F9).
  expect(await page.evaluate(() => localStorage.getItem("u5.skin"))).toBe("shader");

  // Reabrir: ahora shader es la marcada.
  await reveal(page);
  await page.locator(btn).click();
  await expect(page.locator(`${item}[data-skin-id="shader"]`)).toHaveClass(/active/);
  await expect(page.locator(`${item}[data-skin-id="faithful"]`)).not.toHaveClass(/active/);
  expect(errors).toEqual([]);
});

test("clicar fuera cierra el menú del switcher", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful&nointro");
  await expect(page.locator(".faithful-skin canvas")).toBeVisible({ timeout: 30_000 });

  await reveal(page);
  await page.locator(btn).click();
  await expect(page.locator(menu)).toHaveClass(/open/);

  await page.mouse.click(10, 10); // fuera del botón y del menú
  await expect(page.locator(menu)).not.toHaveClass(/open/);
});
