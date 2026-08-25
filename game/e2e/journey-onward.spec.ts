/**
 * Task #28 — "Journey Onward" recarga la partida grabada (equivalente de SAVED.GAM).
 * Reporte del usuario: grabar con (Q) y recargar la página arrancaba SIEMPRE en el
 * inicio; el save no se restauraba. FIX: al elegir Journey Onward (o auto en
 * ?nointro) el boot carga el save MÁS RECIENTE (autosave rotatorio de Q o slot
 * manual). `?fresh` fuerza partida nueva (guard de determinismo).
 *
 * Jubilada la piel dev (título DOM), se conduce la FIEL con `?nointro`: ese arranque
 * AUTO-restaura el save más reciente (main.ts) = exactamente lo que hacía "Journey
 * Onward". NO se usan los helpers que limpian localStorage en cada navegación
 * (necesitamos que el save sobreviva al reload); el contexto de Playwright ya arranca
 * fresco por test.
 */
import { test, expect, type Page } from "@playwright/test";

/**
 * Arranca la FIEL con `nointro` (equivalente de "Journey Onward": monta el mundo directo
 * y auto-restaura el save más reciente, salvo `fresh`). Espera a `worldReady()`.
 */
async function journeyOnward(page: Page, query = "skin=faithful&nointro"): Promise<void> {
  await page.goto(`/?${query}`);
  await page.waitForFunction(
    () =>
      (window as unknown as { __u5test?: { worldReady?: () => boolean } }).__u5test?.worldReady?.() === true,
    undefined,
    { timeout: 15_000 },
  );
}

/** Graba la partida por el flujo fiel de (Q): "Save game?" → (Y). */
async function quitSave(page: Page): Promise<void> {
  await page.locator("body").press("q");
  await page.locator("body").press("y");
}

test("Q graba y, tras recargar, Journey Onward restaura la partida", async ({ page }) => {
  await journeyOnward(page); // partida nueva (sin save aún)

  // Muta el estado vivo a algo distintivo y grábalo con (Q).
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (window as any).__u5test.state();
    s.gold = 4242;
    s.turnsSinceStart = 77;
    s.position = { location: 0, floor: 0, x: 84, y: 108 };
  });
  await quitSave(page);

  // Se escribió un autosave en localStorage (equivalente de SAVED.GAM).
  const savedCount = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith("u5clone:save:")).length,
  );
  expect(savedCount).toBeGreaterThan(0);

  // RECARGA la página (mismo contexto → localStorage persiste). Bajo la fiel con
  // `nointro` el reload = "Journey Onward": auto-restaura el save más reciente.
  await page.reload();
  await page.waitForFunction(
    () =>
      (window as unknown as { __u5test?: { worldReady?: () => boolean } }).__u5test?.worldReady?.() === true,
    undefined,
    { timeout: 15_000 },
  );

  // La partida quedó restaurada: oro/turnos/posición del save, no los del arranque.
  expect(await page.evaluate(() => (window as any).__u5test.state().gold)).toBe(4242);
  expect(await page.evaluate(() => (window as any).__u5test.state().turnsSinceStart)).toBe(77);
  expect(await page.evaluate(() => (window as any).__u5test.state().position.x)).toBe(84);
  expect(await page.evaluate(() => (window as any).__u5test.state().position.y)).toBe(108);
});

test("?fresh ignora el save y arranca partida nueva (guard de determinismo)", async ({ page }) => {
  await journeyOnward(page);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.state().gold = 4242;
  });
  await quitSave(page);

  const goldFresh = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__u5test.state().gold;
  });
  expect(goldFresh).toBe(4242);

  // Recarga CON ?fresh: NO restaura → oro del arranque, no 4242.
  await journeyOnward(page, "skin=faithful&nointro&fresh=1");
  const goldAfter = await page.evaluate(() => (window as any).__u5test.state().gold);
  expect(goldAfter).not.toBe(4242);
});
