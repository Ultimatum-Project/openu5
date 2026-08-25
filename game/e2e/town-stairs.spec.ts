/**
 * PORT F1.11 E2E — Escaleras de pueblo AUTOMÁTICAS en el castillo de Lord British.
 *
 * Bug reportado en partida manual: el jugador SUBÍA por una escalera con la tecla
 * K (comportamiento inventado del clon) y quedaba ATRAPADO en el tejado (Roof2
 * intransitable), sin forma de bajar. El original NO usa K para las escaleras de
 * pueblo: la transición de planta es AUTOMÁTICA al CAMINAR sobre la escalera
 * (TOWN 0x0810 → 0x052E, re/notes/town-klimb.md).
 *
 * Coordenadas REALES leídas de game/assets/maps/smallmaps.json (location 17,
 * "Lord_Britishs_Castle"), verificadas con la passability de core:
 *   - z0 (15,8) tile 196 StairsNorth. Único vecino transitable: (15,9) BrickFloor
 *     al SUR (norte/este/oeste = StoneBrickWall 79). Entrar caminando al NORTE
 *     (orient 0 == dir 0) → SUBE a z1.
 *   - z1 (15,8) tile 196 StairsNorth. Único vecino transitable: (15,7) BrickFloor
 *     al NORTE (sur = muro). Entrar caminando al SUR (orient 0 == dir^2) → BAJA a z0.
 * La geometría de muros impide la aproximación "sin salida" que llevaría al tejado.
 */
import { test, expect } from "@playwright/test";
import { gotoGame, readState, hudLog, consoleText } from "./helpers";

interface Pos {
  location: number;
  floor: number;
  x: number;
  y: number;
}
interface Clock {
  hour: number;
  minute: number;
}

test("castillo LB: SUBIR y BAJAR por la escalera (15,8) sólo caminando — nunca atrapado", async ({ page }) => {
  // Arranca al SUR de la escalera z0 (15,8): en (15,9) BrickFloor.
  await gotoGame(page, { loc: 17, floor: 0, x: 15, y: 9, hour: 10 });

  // 1) Caminar al NORTE pisa (15,8) StairsNorth → SUBE a z1 (misma casilla).
  await page.keyboard.press("ArrowUp");
  let pos = await readState<Pos>(page, "position");
  expect(pos.floor).toBe(1);
  expect(pos.x).toBe(15);
  expect(pos.y).toBe(8);
  expect((await hudLog(page, 3)).join("\n")).toContain("Up!");

  // 2) En z1, salir de la escalera hacia el NORTE (15,7), casilla libre.
  await page.keyboard.press("ArrowUp");
  pos = await readState<Pos>(page, "position");
  expect(pos).toMatchObject({ floor: 1, x: 15, y: 7 });

  // 3) Caminar al SUR vuelve a pisar (15,8) StairsNorth → BAJA a z0.
  await page.keyboard.press("ArrowDown");
  pos = await readState<Pos>(page, "position");
  expect(pos.floor).toBe(0);
  expect(pos.x).toBe(15);
  expect(pos.y).toBe(8);
  expect((await hudLog(page, 3)).join("\n")).toContain("Down!");

  // Nunca se alcanzó el tejado (z2): la ida y vuelta se hizo entre z0 y z1.
  expect(pos.floor).not.toBe(2);
});

test("castillo LB: (K)limb sobre la escalera NO sube — pide dirección y responde 'Klimb-What?'", async ({ page }) => {
  // Sobre la escalera z0 (15,8): K no la trata como caso de Klimb (sólo escalas).
  await gotoGame(page, { loc: 17, floor: 0, x: 15, y: 8, hour: 10 });

  const floorBefore = (await readState<Pos>(page, "position")).floor;
  await page.keyboard.press("k");
  // El original pide dirección (getdir 0xB41C) para intentar encaramarse.
  await expect.poll(() => consoleText(page)).toContain("Klimb-");

  // Dirección hacia un muro (este, (16,8) StoneBrickWall) → "Klimb-What?".
  await page.keyboard.press("ArrowRight");
  const pos = await readState<Pos>(page, "position");
  expect(pos.floor).toBe(floorBefore); // NO cambió de planta (regresión del roof-trap)
  expect((await hudLog(page, 3)).join("\n")).toContain("Klimb-What?");
});

test("(K)limb: cancelar el prompt de dirección COBRA 1 turno (asimetría fix #50, TOWN 0x0C3E)", async ({ page }) => {
  // BrickFloor z0 (15,9) del castillo LB: bajo el party no hay escala → K pide dirección.
  await gotoGame(page, { loc: 17, floor: 0, x: 15, y: 9, hour: 10 });
  await page.keyboard.press("k");
  await expect.poll(() => consoleText(page)).toContain("Klimb-");

  // Cancelar con una tecla NO-flecha (política del clon: cualquier no-dirección
  // cancela; Escape lo intercepta antes el handler de paneles). El binario cobra
  // 1 turno al cancelar el getdir del Klimb (town_klimb 0x0C3E: [bp-2]=1).
  // NB: se cancela con Space, no con un dígito — los dígitos '0'-'9' los captura ahora
  // "Set Active Player" (#69, main.ts) ANTES del getdir, así que ya no cancelan.
  const tBefore = await readState<Clock>(page, "time");
  await page.keyboard.press("Space");
  const tAfter = await readState<Clock>(page, "time");
  expect(tAfter.minute).toBe(tBefore.minute + 1); // turno de pueblo = 1 min
});
