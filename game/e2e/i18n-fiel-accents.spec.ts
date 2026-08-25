/**
 * i18n F1c — CIERRE DEL CÍRCULO: acentos en la piel FIEL (y shader) con lang=es.
 *
 * Con la traducción semilla activa bajo la piel FIEL, un mensaje con acentos
 * (¡/ñ/ó…) llega a la consola y se PINTA desde el atlas de extensión Latino-1
 * (enrutado por codepoint en fiel/font.ts). Aquí se asserta que la traducción
 * llega a la consola lógica bajo fiel/shader; el pintado de los glifos se valida
 * por unit (tests/i18n-font-ext.test.ts) + QA visual (screenshot del reporte).
 *
 * Identidad: con lang=en el render fiel es byte-idéntico (ASCII nunca entra al
 * enrutado ext) — lo cubren faithful.spec + pixeldiff, sin tocar aserciones.
 */
import { test, expect, type Page } from "@playwright/test";

async function bootFiel(page: Page, lang: "es" | "en", skin: "faithful" | "shader"): Promise<void> {
  await page.addInitScript((l) => {
    localStorage.clear();
    localStorage.setItem("u5.lang", l as string);
  }, lang);
  await page.goto(`/?skin=${skin}&nointro`);
  await expect(page.locator(`.${skin}-skin canvas`).first()).toBeVisible({ timeout: 30_000 });
}

async function pushAndRead(page: Page, english: string): Promise<string[]> {
  return page.evaluate((s) => {
    const h = (window as any).__u5test;
    h.pushConsole(s);
    return h.consoleLines() as string[];
  }, english);
}

test("FIEL + lang=es: un mensaje con acentos llega a la consola traducido", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await bootFiel(page, "es", "faithful");
  const lines = await pushAndRead(page, "Blocked!");
  expect(lines.some((l) => l.includes("¡Bloqueado!"))).toBe(true);
  expect(errors).toEqual([]); // el enrutado de acentos no rompe el render fiel
});

test("SHADER + lang=es: acentos también en la consola (pase HD)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await bootFiel(page, "es", "shader");
  const lines = await pushAndRead(page, "A moonstone!\n");
  expect(lines.some((l) => l.includes("¡Una piedra lunar!"))).toBe(true);
  expect(errors).toEqual([]);
});

test("FIEL + lang=en: la consola sigue en inglés (identidad)", async ({ page }) => {
  await bootFiel(page, "en", "faithful");
  const lines = await pushAndRead(page, "Blocked!");
  expect(lines.some((l) => l === "Blocked!")).toBe(true);
  expect(lines.some((l) => l.includes("Cerrado"))).toBe(false);
});
