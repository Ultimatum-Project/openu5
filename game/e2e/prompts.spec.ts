/**
 * Prompts Y/N interactivos (Fase 1.3). Cobertura E2E de teclado.
 *
 * Flow 1 — Salida de pueblo (TOWN 0x600, kernel-survival.md §5.1): al pisar el
 * borde de un small map, el original pregunta "Dost thou wish to leave? " (DS
 * 0x2690) con un getkey CRUDO (0xa49c) que acepta SOLO Y/N/ESC — cualquier otra
 * tecla RE-LEE (no cierra el prompt). 'Y' sale al overworld (loc 0) sin coste;
 * 'N'/ESC no salen y el bucle TOWN cobra 1 min (0x15D4).
 *
 * Flow 2 — Peaje de trolls (MAINOUT 0x1B3E): al cruzar un puente (tile 0x6A/0x6B)
 * a pie con el gate rand(0,7)==0, los trolls emboscan y piden un peaje = 99−3·STR
 * del 1er consciente. El prompt es getkey crudo tipo `yesno`: acepta Y/N e IGNORA
 * ESC (⚠ distinto de Flow 1). 'Y' con oro cobra y pasa; 'N' arranca combate.
 * Semilla 113 (deep-link ?seed=) fuerza la emboscada al pisar el puente (53,24)
 * desde (52,24)→este con la party INIT (Avatar STR 15 ⇒ toll 54, gold 150).
 */
import { test, expect } from "@playwright/test";
import { gotoGame, readState, inCombat, consoleText } from "./helpers";

interface Clock {
  hour: number;
  minute: number;
}

test("Flow 1 · 'Y' al prompt de salida sale al overworld (loc 0)", async ({ page }) => {
  await gotoGame(page, { loc: 13, x: 0, y: 15 });

  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => consoleText(page)).toMatch(/Dost thou wish to leave\?/i);
  expect(await readState<number>(page, "position.location")).toBe(13);

  await page.keyboard.press("y");
  expect(await readState<number>(page, "position.location")).toBe(0);
});

test("Flow 1 · 'N' al prompt NO sale y cobra 1 minuto (TOWN 0x15D4)", async ({ page }) => {
  await gotoGame(page, { loc: 13, x: 0, y: 15 });

  const tBefore = await readState<Clock>(page, "time");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => consoleText(page)).toMatch(/Dost thou wish to leave\?/i);
  await page.keyboard.press("n");

  expect(await readState<number>(page, "position.location")).toBe(13);
  const tAfter = await readState<Clock>(page, "time");
  expect(tAfter.minute).toBe(tBefore.minute + 1);
});

test("Flow 1 · ESC al prompt equivale a 'N' (no sale, cobra 1 min)", async ({ page }) => {
  await gotoGame(page, { loc: 13, x: 0, y: 15 });

  const tBefore = await readState<Clock>(page, "time");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => consoleText(page)).toMatch(/Dost thou wish to leave\?/i);
  await page.keyboard.press("Escape");

  expect(await readState<number>(page, "position.location")).toBe(13);
  const tAfter = await readState<Clock>(page, "time");
  expect(tAfter.minute).toBe(tBefore.minute + 1);
});

test("Flow 1 · una tecla no válida RE-LEE: el prompt sigue abierto y 'Y' resuelve", async ({
  page,
}) => {
  await gotoGame(page, { loc: 13, x: 0, y: 15 });

  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => consoleText(page)).toMatch(/Dost thou wish to leave\?/i);

  // Teclas no válidas (getkey loop del binario): NO cierran el prompt ni salen.
  await page.keyboard.press("q");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("5");
  expect(await readState<number>(page, "position.location")).toBe(13); // sigue en el pueblo

  // El prompt sigue vivo: 'Y' ahora sí sale.
  await page.keyboard.press("y");
  expect(await readState<number>(page, "position.location")).toBe(0);
});

test("Flow 2 · cruzar el puente muestra el peaje; ESC lo IGNORA; 'Y' cobra 54 gp", async ({
  page,
}) => {
  await gotoGame(page, { loc: 0, x: 52, y: 24, seed: 113 });

  await page.keyboard.press("ArrowRight"); // este → pisa el puente (53,24)
  await expect.poll(() => consoleText(page)).toMatch(/trolls demand a 54 gp toll/i);
  // PREÁMBULO C5 (MAINOUT 0x1c0e-0x1c63): spieth + `<nombre> sneaks across...` del
  // miembro que tira ANTES del Caught! (carril cadenas-presentacion).
  const pre = await consoleText(page);
  expect(pre).toContain("Thou spieth trolls under the bridge!");
  expect(pre).toMatch(/ sneaks across/);
  const goldBefore = await readState<number>(page, "gold");
  expect(goldBefore).toBe(150);

  // ESC IGNORADO (⚠ distinto de Flow 1): el prompt sigue vivo, sin cobrar ni combate.
  await page.keyboard.press("Escape");
  expect(await readState<number>(page, "gold")).toBe(150);
  expect(await inCombat(page)).toBe(false);

  // 'Y' con oro suficiente: cobra el peaje (150−54=96) y pasa libre.
  await page.keyboard.press("y");
  expect(await readState<number>(page, "gold")).toBe(96);
});

test("Flow 2 · 'N' al peaje arranca el combate SIN 'Attacked!' (C5b)", async ({ page }) => {
  await gotoGame(page, { loc: 0, x: 52, y: 24, seed: 113 });

  await page.keyboard.press("ArrowRight");
  await expect.poll(() => consoleText(page)).toMatch(/trolls demand a 54 gp toll/i);

  await page.keyboard.press("n");
  // C5b (carril cadenas-presentacion): la rama de rechazo (MAINOUT 0x1bbd →
  // 0xb714/0xdf80) entra al combate SIN pre-línea "Attacked!" — ese literal (DS
  // 0x6b12) es del flujo monstruo-alcanza-party (0x12da). Testigo espejo P08 E12b:
  // grupo ("TROLLS") + "*** CONFLICT ***" a secas.
  await expect.poll(() => consoleText(page)).toMatch(/\*\*\* CONFLICT \*\*\*/i);
  expect(await consoleText(page)).not.toContain("Attacked!");
  expect(await inCombat(page)).toBe(true);
  expect(await readState<number>(page, "gold")).toBe(150); // rechazar no cobra
});
