/**
 * E3c — Huida por ESCALERA de una sala de mazmorra (video-N f065/f075/f078).
 *
 * Cadena REAL end-to-end: entrar en una sala (combate top-down) → tecla `k` sobre
 * un tile de escalera → "Klimb-Up!" + "Escape!" → el party vacío cierra el combate
 * con "BATTLE IS LOST!" → vuelta al first-person UN PISO ARRIBA.
 *
 * Se conduce por el hook `window.__u5test` (game + debug), como dungeon.spec: se
 * entra a Deceit, se inyecta una Room delante y se pisa (flujo real de combate de
 * sala), luego se plantan una escalera↑ (0xC8) bajo el PJ activo y se marca al
 * resto como ya-huido para que un solo `k` cierre el combate. La tecla `k` recorre
 * el handler REAL de combate (main.ts), que es lo que los tests unitarios no cubren.
 */
import { test, expect } from "@playwright/test";
import { gotoGame, hudLog, inCombat } from "./helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

test("Klimb sobre escalera en sala → Escape! → first-person un piso arriba", async ({ page }) => {
  test.setTimeout(60_000);
  await gotoGame(page);

  // 1) Entrar en Deceit (game.enterDungeon = carga directa) y colocar una Room
  //    delante (sur) en la planta 3. El router de teclas deriva el modo de
  //    game.dungeonState/game.combat en cada tecla, así que la entrada directa basta.
  await page.evaluate(() => {
    const t = (window as any).__u5test;
    t.game.enterDungeon(33);
    const ds = t.game.dungeonState;
    ds.pos.floor = 3;
    ds.pos.x = 3;
    ds.pos.y = 3;
    ds.pos.facing = "south";
    // Room (nibble alto 0xF) en la celda de delante (sur → y+1).
    ds.setCell(3, 3, 4, { type: 0xf, sub: 0 });
  });

  // 2) Forward (ArrowUp = avanzar en la dirección de vista) pisa la Room al sur →
  //    "Entering room..." + combate de sala (top-down).
  await page.keyboard.press("ArrowUp");
  expect(await inCombat(page)).toBe(true);

  // 3) Plantar escalera↑ (0xC8) bajo el PJ activo y dejar al resto ya-huido, para
  //    que un solo Klimb cierre el combate. Avanza turnos de enemigo si hiciera falta.
  await page.evaluate(() => {
    const c = (window as any).__u5test.game.combat;
    let guard = 0;
    while (!c.over && c.currentUnit && c.currentUnit.kind === "enemy" && guard++ < 64) {
      c.tickEnemyTurns();
    }
    const cur = c.currentUnit;
    c.mapTiles[cur.y][cur.x] = 0xc8; // escalera arriba bajo el PJ activo
    for (const u of c.combatants) if (u.kind === "player" && u !== cur) u.status = "fled";
  });

  const floorBefore = await page.evaluate(
    () => (window as any).__u5test.game.dungeonState.pos.floor,
  );

  // 4) Tecla `k` de combate → playerKlimbEscape → Escape! → BATTLE IS LOST! → salir.
  await page.keyboard.press("k");

  // 5) Ya no en combate, de vuelta al first-person UN PISO ARRIBA.
  expect(await inCombat(page)).toBe(false);
  const floorAfter = await page.evaluate(() => {
    const ds = (window as any).__u5test.game.dungeonState;
    return ds ? ds.pos.floor : null;
  });
  expect(floorAfter).toBe(floorBefore - 1);

  const log = (await hudLog(page, 16)).join("\n");
  expect(log).toMatch(/Klimb-Up!/);
  expect(log).toMatch(/Escape!/);
  expect(log).toMatch(/BATTLE IS LOST!/);
});
