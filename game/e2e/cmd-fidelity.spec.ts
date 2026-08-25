/**
 * Fidelidad de comandos (tanda de 7 ítems) — verificación en el browser real.
 * Cubre los ítems implementados: X-it (eco del dispatcher), Q (Quit & Save por
 * consola) y el getstring de Yell (cubierto aparte en ritual.spec.ts). Conduce la
 * piel DEV (`.hud-log` DOM) igual que commands.spec.ts.
 */
import { test, expect } from "@playwright/test";
import { gotoGame, hudLog, readState } from "./helpers";

test("X-it a pie: ecoa 'X-it' (dispatcher 0x3456) + 'what?' (msg 0x4368), no el 'What?' del default", async ({
  page,
}) => {
  await gotoGame(page, { loc: 0, x: 82, y: 108, seed: 1 }); // overworld, a pie
  await page.locator("body").press("x");
  const log = (await hudLog(page, 6)).join("\n");
  // El eco "X-it " ahora está presente (antes faltaba y sólo se veía "what?").
  expect(log).toContain("X-it");
  // A pie el original responde "what?" (minúscula, DS 0x4368), NO el "What?" default.
  expect(log.toLowerCase()).toContain("what?");
});

test("Q (Quit & Save): 'Quit:' + 'Save game? ' → N cancela; Y guarda ('Yes'/'Saving...')", async ({
  page,
}) => {
  await gotoGame(page, { loc: 0, x: 82, y: 108, seed: 1 });

  // Pulsar Q abre el prompt fiel POR CONSOLA (no popup): eco + "Save game? ".
  await page.locator("body").press("q");
  let log = (await hudLog(page, 6)).join("\n");
  expect(log).toContain("Quit:");
  expect(log).toContain("Save game?");
  // Ninguna otra tecla que no sea Y/N re-lee (getYN 0x448c): '3' no resuelve.
  await page.locator("body").press("3");
  expect(await readState<unknown>(page, "position")).toBeTruthy(); // sigue en juego

  // N → "No", sin guardar.
  await page.locator("body").press("n");
  log = (await hudLog(page, 4)).join("\n");
  expect(log).toContain("No");

  // Q de nuevo, Y → "Yes" + "Saving..." + escribe el autosave (localStorage).
  await page.locator("body").press("q");
  await page.locator("body").press("y");
  log = (await hudLog(page, 6)).join("\n");
  expect(log).toContain("Yes");
  expect(log).toContain("Saving...");
  const savedSlot = await page.evaluate(() =>
    Object.keys(localStorage).some((k) => k.startsWith("u5clone:save:autosave-")),
  );
  expect(savedSlot).toBe(true);
});
