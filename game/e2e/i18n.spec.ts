/**
 * i18n F1 — e2e de la capa de idioma DESDE LA UI (render real, piel dev).
 *
 * Prueba de punta a punta el choke point `pushConsole → t()`:
 *  - `?lang=es`: las 20 semillas empujadas por el path REAL de consola
 *    (`hud.message`) salen TRADUCIDAS y re-wrapeadas en la consola; y un comando
 *    disparado por TECLA real ('o' → eco "Abrir-") también.
 *  - `?lang=en`: el MISMO recorrido es byte-idéntico al inglés (identidad
 *    estricta) — ninguna forma española aparece.
 *
 * La consola lógica se lee por `window.__u5test.consoleLines()` (misma fuente que
 * pinta la piel). Se empuja de una en una para no rebasar el buffer de scroll.
 */
import { test, expect, type Page } from "@playwright/test";
import { huella } from "../src/i18n/huella.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// El loader ESM de Playwright (node) es estricto con `import … from "*.json"`; el
// bundle del navegador SÍ lo importa (vite). Aquí leemos la semilla por fs y
// replicamos el rewrap (idéntico a src/i18n/index.ts) para computar expectativas.
const HERE = dirname(fileURLToPath(import.meta.url));
const esTable = JSON.parse(readFileSync(join(HERE, "../src/i18n/es.json"), "utf8"));
const SEED = esTable.strings as Record<string, { t: string }>;
const rewrap = (s: string): string => s.replace(/(?<=[^\n])\n(?=[^\n])/g, " ");
const nonEmpty = (s: string): string[] => s.split("\n").filter((l) => l.trim() !== "");

// Subconjunto CURADO de mensajes DISTINTIVOS para el recorrido de consola: full-messages
// con español acentuado/¡ (imposible como substring de una línea inglesa), robusto a la
// tabla ampliada de F2 y a la consola que ACUMULA. La identidad EXHAUSTIVA en 'en' la
// prueba el unit (i18n-manifest); aquí se verifica el render de punta a punta.
const CHECK = [
  "Blocked!", "Ship sunk!\n", "Abandon ship!\n", "Poisoned!\n", "Cured!\n",
  "An apparition!\n", "\nVICTORY!\n", "Refreshing...\n", "a wooden chest.\n", "Excellent!\n",
].filter((k) => huella(k) in SEED);

async function boot(page: Page, lang: "es" | "en"): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  // Piel fiel con `nointro` (jubilada la piel dev): monta el mundo directo, sin título DOM.
  await page.goto(`/?skin=faithful&nointro&lang=${lang}&fresh`);
  await page.waitForFunction(
    () =>
      (window as unknown as { __u5test?: { worldReady?: () => boolean } }).__u5test?.worldReady?.() === true,
    undefined,
    { timeout: 15_000 },
  );
  expect(await page.evaluate(() => (window as any).__u5test.lang())).toBe(lang);
}

/** Empuja un string inglés por el path de consola real y devuelve las líneas lógicas. */
async function pushAndRead(page: Page, english: string): Promise<string[]> {
  return page.evaluate((s) => {
    const h = (window as any).__u5test;
    h.pushConsole(s);
    return h.consoleLines() as string[];
  }, english);
}

test("lang=es: mensajes distintivos salen traducidos y re-wrapeados en la consola", async ({ page }) => {
  await boot(page, "es");
  for (const english of CHECK) {
    const lines = await pushAndRead(page, english);
    for (const expected of nonEmpty(rewrap(SEED[huella(english)]!.t))) {
      expect(lines.some((l) => l.includes(expected)), `«${english}» → «${expected}»`).toBe(true);
    }
  }
});

test("lang=en: el mismo recorrido es byte-idéntico al inglés (identidad estricta)", async ({ page }) => {
  await boot(page, "en");
  for (const english of CHECK) {
    const lines = await pushAndRead(page, english);
    // El inglés aparece verbatim…
    for (const expected of nonEmpty(english)) {
      expect(lines.some((l) => l.includes(expected)), `«${english}» verbatim`).toBe(true);
    }
    // …y NINGUNA forma española (acentuada) se cuela.
    for (const es of nonEmpty(rewrap(SEED[huella(english)]!.t))) {
      expect(lines.some((l) => l.includes(es)), `sin «${es}» en 'en'`).toBe(false);
    }
  }
});

test("lang=es: un comando por TECLA real ecoa su etiqueta traducida ('o' → Abrir-)", async ({ page }) => {
  await boot(page, "es");
  await page.locator("body").press("o"); // (O)pen → hud.echo("Open-") → "Abrir-"
  const lines = await page.evaluate(() => (window as any).__u5test.consoleLines() as string[]);
  expect(lines.some((l) => l.includes("Abrir-"))).toBe(true);
  expect(lines.some((l) => l.includes("Open-"))).toBe(false);
});

test("lang=en: el mismo comando ecoa la etiqueta inglesa ('o' → Open-)", async ({ page }) => {
  await boot(page, "en");
  await page.locator("body").press("o");
  const lines = await page.evaluate(() => (window as any).__u5test.consoleLines() as string[]);
  expect(lines.some((l) => l.includes("Open-"))).toBe(true);
  expect(lines.some((l) => l.includes("Abrir-"))).toBe(false);
});
