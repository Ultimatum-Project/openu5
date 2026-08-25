/**
 * Eco de CONSOLA del comando (Z)stats — cadena FIEL de cmd_zstats (ZSTATS.OVL,
 * derivada instrucción a instrucción; ver re/notes/zstats.md + la sonda del lote):
 *
 *   1. abrir (dispatcher, ULTIMA.EXE 0x3472)          → "Z-stats..."   (DS 0xa28c)
 *   2. select_player prompt (ZSTATS 0x002e)           → "Player: "     (DS 0x96b4)
 *   3a. elegir miembro                                → "Player: <nombre>" + "Status: " (DS 0x97a2)
 *   3b. cancelar el picker (ESC, select_player 0x0061)→ "Player: None!" (DS 0x96be; salta Status/Done)
 *   4. cerrar la ficha (Space/ESC, teardown 0x0be2)   → "Done"          (DS 0x97ce)
 *
 * El clon PINTABA la ficha pero OMITÍA el "Done" de cierre y el "None!" de cancelación;
 * este lote los restituye. Como `pushConsole` parte por `\n` (sin append de línea), la
 * línea "Player: <outcome>" se emite ATÓMICA al resolver el select (mismo compromiso que
 * ya usaba el éxito): el render final del log coincide con el binario.
 *
 * Corre en la PIEL FIEL (el eco vive en su keyHandler; la dev togglea un panel DOM sin
 * consola). `lang=en` → identidad byte-exacta. La consola lógica se lee por
 * `__u5test.consoleLines()` (misma fuente que pinta la fiel, viva en cualquier piel).
 */
import { test, expect, type Page } from "@playwright/test";
import { skinCycleReady } from "./helpers";

const CANVAS = ".faithful-skin canvas";

async function bootFaithful(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful&nointro&lang=en&loc=0&x=82&y=108");
  await expect(page.locator(CANVAS)).toBeVisible({ timeout: 30_000 });
  // El canvas NO basta: aparece DURANTE el swap de arranque, y la 'z' enviada en esa
  // ventana se pierde (el eco "Z-stats..." lo emite la PIEL, skin.ts:2241). Era el flake
  // que alternaba cuál de los dos tests caía entre corridas. Ver skinCycleReady().
  await skinCycleReady(page);
}
async function console_(page: Page): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return page.evaluate(() => (window as any).__u5test.consoleLines() as string[]);
}
async function logHas(page: Page, text: string): Promise<boolean> {
  return (await console_(page)).some((l) => l.includes(text));
}
async function partySize(page: Page): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return page.evaluate(() => (window as any).__u5test.state().partySize as number);
}

test("(Z) abre con 'Z-stats...', elige jugador ('Player:'/'Status:') y cierra con 'Done'", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await bootFaithful(page);
  expect(await partySize(page)).toBeGreaterThan(0);

  // (1) Abrir: eco del dispatcher.
  await page.locator("body").press("z");
  expect(await logHas(page, "Z-stats..."), "eco del comando (DS 0xa28c)").toBe(true);

  // (2)+(3a) Confirmar el candidato (Enter) → línea "Player: <nombre>" + "Status: ".
  await page.locator("body").press("Enter");
  expect(await logHas(page, "Player:"), "prompt de jugador resuelto (DS 0x96b4)").toBe(true);
  expect(await logHas(page, "Status:"), "línea Status del cmd_zstats (DS 0x97a2)").toBe(true);

  // (4) Cerrar la ficha con Space → "Done" (el teardown lo imprime SIEMPRE, 0x0be2).
  expect(await logHas(page, "Done"), "aún no cerrada → sin Done").toBe(false);
  await page.locator("body").press(" ");
  expect(await logHas(page, "Done"), "cierre imprime Done (DS 0x97ce)").toBe(true);

  expect(errors).toEqual([]);
});

test("(Z) cancelado con ESC en la selección → 'Player: None!' (sin Status ni Done)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await bootFaithful(page);

  await page.locator("body").press("z");
  expect(await logHas(page, "Z-stats...")).toBe(true);
  // ESC en modo SELECT = cancelar el picker: select_player retorna -1 → "None!" (0x96be)
  // tras el "Player: "; cmd_zstats salta Status y Done.
  await page.locator("body").press("Escape");
  expect(await logHas(page, "Player: None!"), "cancelación imprime Player: None!").toBe(true);
  expect(await logHas(page, "Status:"), "cancelación SALTA Status").toBe(false);
  expect(await logHas(page, "Done"), "cancelación SALTA Done").toBe(false);

  expect(errors).toEqual([]);
});
