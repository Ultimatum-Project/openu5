/**
 * E2E task #48 — Reja (portcullis) y puente levadizo de poblado por HORA del día
 * (TOWN 0x0170 town_time_tile_transform). Deriva: re/disasm/TOWN.OVL.asm 0x0170,
 * cargador 0x0408 (rama nocturna 0x0508), tick 0x15c8 (hora 20/5). Validado contra
 * assets/maps/smallmaps.json.
 *
 * De NOCHE (hora <5 ó >=20): en cada arco 0x87 el tile al SUR pasa de 0x44 BrickFloor
 * a 0x99 Portcullis (intransitable); cada tablón de puente 0x48/0x49 pasa a 0x03
 * WaterCoast (foso, intransitable). De DÍA el mapa es el estático. Se comprueba tanto
 * el tile efectivo (feed de render) como el BLOQUEO DE PASO real caminando.
 *
 * Escenarios reales:
 *  - Lord British's Castle (loc 17): arco (15,10), reja en (15,11); patio (15,12).
 *  - North Britanny (loc 20): puente en la fila y=10 (14/15/16); césped (15,11) al sur.
 */
import { test, expect, type Page } from "@playwright/test";
import { gotoGame, hudLog } from "./helpers";

interface Pos { location: number; floor: number; x: number; y: number }

/** Tile efectivo del mapa activo (render + passability) vía el hook DEV. */
async function tileAt(page: Page, x: number, y: number): Promise<number> {
  return page.evaluate(
    ([tx, ty]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).__u5test.game;
      return g.activeMap.tileAt(tx, ty);
    },
    [x, y] as const,
  );
}

async function pos(page: Page): Promise<Pos> {
  return page.evaluate(() => (window as any).__u5test.state().position);
}

const BRICKFLOOR = 0x44;
const PORTCULLIS = 0x99;
const PLANK_L = 0x48;
const WATER = 0x03;

test.describe("Reja de castillo por hora (Lord British's Castle, loc 17)", () => {
  test("DÍA: la reja (15,11) es suelo abierto y se cruza al caminar", async ({ page }) => {
    await gotoGame(page, { loc: 17, floor: 0, x: 15, y: 12, hour: 10 });
    expect(await tileAt(page, 15, 11)).toBe(BRICKFLOOR);
    // Cruzar la puerta hacia el norte: (15,12) patio → (15,11) reja abierta.
    await page.keyboard.press("ArrowUp");
    expect(await pos(page)).toMatchObject({ x: 15, y: 11 });
  });

  test("NOCHE: la reja (15,11) baja a Portcullis y BLOQUEA el paso", async ({ page }) => {
    await gotoGame(page, { loc: 17, floor: 0, x: 15, y: 12, hour: 22 });
    expect(await tileAt(page, 15, 11)).toBe(PORTCULLIS);
    await page.keyboard.press("ArrowUp");
    // No avanza: la reja bloquea; el party sigue en el patio (15,12).
    expect(await pos(page)).toMatchObject({ x: 15, y: 12 });
    expect((await hudLog(page, 3)).join("\n")).toContain("Blocked!");
  });
});

test.describe("Puente levadizo por hora (North Britanny, loc 20)", () => {
  test("DÍA: el tablón (15,10) es madera y se cruza al caminar", async ({ page }) => {
    await gotoGame(page, { loc: 20, floor: 0, x: 15, y: 11, hour: 10 });
    expect(await tileAt(page, 15, 10)).toBe(PLANK_L);
    await page.keyboard.press("ArrowUp");
    expect(await pos(page)).toMatchObject({ x: 15, y: 10 });
  });

  test("NOCHE: el puente se iza (0x48→0x03 foso) y BLOQUEA el paso", async ({ page }) => {
    await gotoGame(page, { loc: 20, floor: 0, x: 15, y: 11, hour: 22 });
    expect(await tileAt(page, 15, 10)).toBe(WATER);
    await page.keyboard.press("ArrowUp");
    // El foso bloquea; el party no cruza.
    expect(await pos(page)).toMatchObject({ x: 15, y: 11 });
    expect((await hudLog(page, 3)).join("\n")).toContain("Blocked!");
  });
});
