import { test, expect } from "@playwright/test";
import { gotoGame, readState } from "./helpers";

test("__u5test expone el estado real y el hook reseed", async ({ page }) => {
  await gotoGame(page);
  // Ruta REAL: el oro es `state.gold` (no existe `inventory` en GameState).
  const gold = await readState<number>(page, "gold");
  expect(gold).toBe(150); // estado inicial canónico de INIT.GAM
  const ok = await page.evaluate(() => {
    // F.2: setEncounterRng se sustituyó por reseed (siembra el stream vivo).
    const t = (window as unknown as Record<string, any>).__u5test;
    t.reseed(4242);
    return typeof t.game === "object" && typeof t.reseed === "function";
  });
  expect(ok).toBe(true);
});

test("deep-link ?x&y&hour fija posición y hora", async ({ page }) => {
  await gotoGame(page, { x: 60, y: 60, hour: 12 });
  // `state.position` es { location, floor, x, y }: comprobamos x/y directamente.
  const x = await readState<number>(page, "position.x");
  const y = await readState<number>(page, "position.y");
  expect({ x, y }).toEqual({ x: 60, y: 60 });
  // La hora la fija el deep-link; se aseveran por estado (el HUD DOM que la formateaba
  // era sólo-dev, jubilado; la piel fiel dibuja el reloj al canvas).
  expect(await readState<number>(page, "time.hour")).toBe(12);
});
