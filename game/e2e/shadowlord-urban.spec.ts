/**
 * F1.10-T6 — Journey de Shadowlords urbanos (presencia en pueblos).
 *
 * Reachability en el browser real: al ENTRAR (overworld → pueblo) a una ciudad de
 * la virtud con un Shadowlord presente (shadowlordLocs[i] == location), el bucle de
 * pueblo (TOWN 0x11f0 tail → applyUrbanShadowlord) anuncia "An air of <cualidad>
 * doth surround thee..." y coloca el sprite físico tile 0xFC. Entrar sin SL → nada.
 *
 * Britain = loc 2 (ciudad de la virtud); su entrada de overworld es (81,106)
 * (data.json:locationsX[1]/locationsY[1]). El vecino Norte (81,105) es hierba, así
 * que la party entra moviéndose al Sur.
 */
import { test, expect } from "@playwright/test";
import { gotoGame, readState, hudLog } from "./helpers";

/** Fija shadowlordLocs sobre la referencia viva del estado. */
async function setShadowlordLocs(page: import("@playwright/test").Page, locs: number[]): Promise<void> {
  await page.evaluate((l) => {
    (window as any).__u5test.state().shadowlordLocs = l;
  }, locs);
}

test("entrar a Britain con la Falsedad presente anuncia 'An air of falsehood' + sprite 0xFC", async ({ page }) => {
  await gotoGame(page, { loc: 0, x: 81, y: 105, seed: 4242 });
  await setShadowlordLocs(page, [2, 99, 99]); // Faulinei (idx 0) en Britain (loc 2)
  await page.keyboard.press("ArrowDown"); // (81,105) → (81,106): PISA la casilla de Britain
  await page.keyboard.press("e"); // (E)nter sobre la ciudad → carga Britain (el original no auto-entra)

  await expect.poll(() => readState<number>(page, "position.location")).toBe(2);
  const log = (await hudLog(page, 8)).join(" \n ");
  expect(log).toContain("air of");
  expect(log.toLowerCase()).toContain("falsehood");
  expect(log).toContain("doth surround thee");

  // Sprite físico del Shadowlord (tile 0xFC = 252) como worldObject de la loc 2.
  const hasSprite = await page.evaluate(() =>
    ((window as any).__u5test.state().worldObjects ?? []).some(
      (o: any) => o.kind === "shadowlord" && o.location === 2 && o.tile === 0xfc,
    ),
  );
  expect(hasSprite).toBe(true);
});

test("entrar a Britain SIN Shadowlord no anuncia nada ni coloca sprite", async ({ page }) => {
  await gotoGame(page, { loc: 0, x: 81, y: 105, seed: 4242 });
  await setShadowlordLocs(page, [7, 8, 6]); // los tres en otras ciudades
  await page.keyboard.press("ArrowDown"); // pisa la casilla de Britain
  await page.keyboard.press("e"); // (E)nter sobre la ciudad → carga Britain

  await expect.poll(() => readState<number>(page, "position.location")).toBe(2);
  const log = (await hudLog(page, 8)).join(" \n ");
  expect(log).not.toContain("doth surround thee");

  const hasSprite = await page.evaluate(() =>
    ((window as any).__u5test.state().worldObjects ?? []).some((o: any) => o.kind === "shadowlord"),
  );
  expect(hasSprite).toBe(false);
});
