/**
 * #342 (merge a0c68559) — OCUPACIÓN A PIE: la party deja de ATRAVESAR la casilla de
 * un actor del exterior. Es la otra mitad del bloque MAINOUT 0x0236-0x0283 que #282
 * calcó para la vía naval: `find_object_at_xy` (kernel 0x368E) se consulta ANTES de
 * mirar el terreno — el ACTOR manda sobre el TERRENO.
 *
 * Receta determinista: actor sembrado por `overworldEnemies.enemies` (el mismo camino
 * que attack.spec), en una celda cuyo TERRENO es paso libre (hierba, tile 5 en
 * assets/maps/overworld.json) — así el rojo pre-fix es inequívoco: sin la consulta de
 * ocupación el paso HABRÍA entrado (el terreno lo permite) y la posición se movería.
 */
import { test, expect } from "@playwright/test";
import { gotoGame, readState, consoleText, skinCycleReady } from "./helpers";

interface Pos { x: number; y: number }

test("#342 · un actor del exterior delante bloquea el paso a pie ('Blocked!') aunque el terreno sea paso libre", async ({ page }) => {
  await gotoGame(page, { loc: 0, x: 76, y: 40, hour: 10, seed: 1234 });
  await skinCycleReady(page);
  // Actor en (77,40) — hierba (tile 5): el terreno NO es el que bloquea.
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.game.overworldEnemies.enemies.push({
      defIndex: 0, tile: 0x94, water: false, x: 77, y: 40,
    });
  });

  await page.keyboard.press("ArrowRight");
  await expect.poll(() => consoleText(page)).toContain("Blocked!");
  const pos = await readState<Pos>(page, "position");
  expect(pos).toMatchObject({ x: 76, y: 40 });
});

test("#342 · control: el MISMO paso sin actor entra (la celda es paso libre de verdad)", async ({ page }) => {
  await gotoGame(page, { loc: 0, x: 76, y: 40, hour: 10, seed: 1234 });
  await skinCycleReady(page);

  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await readState<Pos>(page, "position")).x).toBe(77);
  expect((await readState<Pos>(page, "position")).y).toBe(40);
});
