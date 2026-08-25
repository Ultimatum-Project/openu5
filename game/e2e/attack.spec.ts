/**
 * F1.8-T3 — E2E de la tecla (A)ttack en el mapa (dispatcher kernel 0x3216 →
 * overworld MAINOUT 0x06ec). Pulsa la TECLA REAL: 'a' imprime "Attack-" (copy
 * verbatim del overlay, DS 0x29fe) y pide dirección; la flecha resuelve contra
 * la celda party+dir. Con un enemigo errante adyacente arranca el combate
 * (startCombat, fork del stream vivo); sin objetivo → "Nothing to attack!".
 */
import { test, expect } from "@playwright/test";
import { gotoGame, hudLog, inCombat } from "./helpers";

test("A sin objetivo: prompt 'Attack-' y luego 'Nothing to attack!'", async ({ page }) => {
  await gotoGame(page, { x: 60, y: 60 }); // overworld abierto: nada que atacar al lado
  await page.keyboard.press("a");
  expect((await hudLog(page)).join("\n")).toContain("Attack-");
  await page.keyboard.press("ArrowRight");
  expect((await hudLog(page)).join("\n")).toContain("Nothing to attack!");
});

test("A contra un enemigo errante adyacente: inicia combate", async ({ page }) => {
  await gotoGame(page, { x: 60, y: 60 });
  // Siembra un enemigo (goblin, def 0) justo al ESTE de la party (61,60).
  await page.evaluate(() => {
    (
      window as unknown as {
        __u5test: { game: { overworldEnemies: { enemies: unknown[] } } };
      }
    ).__u5test.game.overworldEnemies.enemies.push({
      defIndex: 0,
      tile: 0x94,
      water: false,
      x: 61,
      y: 60,
    });
  });
  await page.keyboard.press("a");
  expect((await hudLog(page)).join("\n")).toContain("Attack-");
  await page.keyboard.press("ArrowRight"); // ESTE → hay enemigo → combate
  // PLAYER-INITIATED (lote D vía A): el combate arranca SIN pre-línea — el eco "Attack-<dir>"
  // (ya aseverado arriba) es la única línea; U5 NO imprime "Attacked!" ni "{name} attacks!"
  // (fabricado, purgado) cuando el jugador inicia. `inCombat` confirma el modo.
  expect(await inCombat(page)).toBe(true);
  expect((await hudLog(page)).join("\n")).not.toContain("Attacked!");
});

test("A en skiff sobre agua: 'Attack-' + 'On foot!' SIN pedir dirección (gate MAINOUT 0x70d)", async ({ page }) => {
  await gotoGame(page, { x: 250, y: 120 }); // mar abierto (tile de agua bajo la party)
  // Fuerza el transporte a skiff (0x28): el gate rechaza atacar sobre agua en skiff.
  await page.evaluate(() => {
    (window as unknown as { __u5test: { game: { state: { transportTile: number } } } }).__u5test.game.state.transportTile = 0x28;
  });
  await page.keyboard.press("a");
  const log = (await hudLog(page)).join("\n");
  expect(log).toContain("Attack-");
  expect(log).toContain("On foot!"); // rechazo sin getdir
});
