/**
 * #273 (cabos, merge d1c34150) — el CICLO COMPLETO del esquife de la fragata, e2e.
 *
 * naval.spec.ts cubre el skiff suelto (remar/virar, X-it→tierra) y el board de la
 * fragata; lo que NADIE miraba desde el navegador era el ciclo que #270/#273 cerraron:
 *   1. X-it de la FRAGATA en mar abierto BOTA el esquife (transportTile +4, facing
 *      preservado: CMDS 0x0FC1) y AMARRA la nave como objeto del mundo con N−1
 *      esquifes (el `dec al` de 0x0FCF va ANTES de emitir el objeto) y el hull VIVO.
 *   2. Re-abordar la fragata amarrada desde el esquife la recupera con su hull y
 *      ESTIBA el esquife (0x0919 `skiffs++`).
 *   3. El esquife APARCADO por X-it se queda en el mundo con su facing (ruta C,
 *      0x0F90-0x0F9A: tile TAL CUAL 0x28-0x2B) y re-abordarlo NO suma el +2 del
 *      caballo (la rama skiff de CMDS 0x08B2 salta el `add al,2` de 0x0873).
 *
 * Esperados EN CRUDO (espacio de BYTE de g_transport_tile; la capa de objetos guarda
 * banco alto = byte + 0x100, #137). Coordenadas verificadas contra
 * assets/maps/overworld.json (convención tiles[y][x]): (250,120) mar abierto (tile 1);
 * (179,128) agua (tile 2) con agua costera (tile 3) en (178,128) y TIERRA pisable a
 * pie (Forest1, tile 6) en (177,128) — la ortogonal que enciende el 0x73E del X-it.
 * ⚠ El «(245,61) con costa (tile 2 tierra)» de naval.spec NO sirve aquí: tile 2 es
 * Water2 (IsWalking_Passable=false en TileData) — por eso su test de X-it es
 * permisivo («skiff! o No land nearby!») y éste no puede serlo.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoGame, readState, consoleText } from "./helpers";

const SEA = { x: 250, y: 120, hour: 12 };
const COAST = { x: 179, y: 128, hour: 12 }; // al oeste: (178,128) agua costera con tierra en (177,128)

/** Banco alto de sprites de la capa de objetos (#137). */
const BANK = 0x100;

/** Siembra un objeto-nave en la celda del party (mismo camino que naval.spec.ts). */
async function seedShip(page: Page, tile: number, hull: number, skiffs: number): Promise<void> {
  await page.evaluate(
    ({ t, h, s }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).__u5test.game;
      const p = g.state.position;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__u5test.addWorldObject({
        location: p.location, floor: p.floor, x: p.x, y: p.y,
        tile: t, kind: "ship", hull: h, skiffs: s,
      });
    },
    { t: tile + BANK, h: hull, s: skiffs },
  );
}

/** Objetos-nave vivos en (x,y) — para asertar el amarre y su hull/skiffs en crudo. */
async function shipsAt(page: Page, x: number, y: number): Promise<{ tile: number; hull?: number; skiffs?: number }[]> {
  return page.evaluate(
    ({ x, y }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = (window as any).__u5test.state();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (s.worldObjects ?? []).filter((o: any) => o.kind === "ship" && o.x === x && o.y === y)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((o: any) => ({ tile: o.tile, hull: o.hull, skiffs: o.skiffs }));
    },
    { x, y },
  );
}

test("#273/#270 · X-it de la fragata en mar abierto BOTA el esquife (+4, facing), AMARRA la nave con N−1 y hull vivo, y re-abordarla ESTIBA", async ({ page }) => {
  await gotoGame(page, { ...SEA, seed: 1234 });
  // Fragata velas arriadas 0x24 con hull DISTINTIVO (42) y 2 esquifes: el 42 permite
  // ver si el amarre conserva el casco vivo (99 lo confundiría con el default HULL_MAX).
  await seedShip(page, 0x24, 42, 2);
  await page.locator("body").press("b");
  await expect.poll(() => readState<string>(page, "transport")).toBe("ship");
  expect(await readState<number>(page, "transportTile")).toBe(0x24);
  expect(await readState<number>(page, "shipHull")).toBe(42);
  expect(await readState<number>(page, "shipSkiffs")).toBe(2);

  // X-it sin tierra ortogonal → rama esquife (0x0FC1): "ship!" y transportTile +4.
  await page.locator("body").press("x");
  await expect.poll(() => consoleText(page)).toContain("ship!");
  expect(await readState<number>(page, "transportTile")).toBe(0x28); // 0x24 + 4, facing preservado
  expect(await readState<string>(page, "transport")).toBe("skiff");
  // La nave quedó AMARRADA en la celda como objeto del mundo (cola 0x0FF4): tile del
  // banco alto con su facing, hull VIVO (42) y N−1 esquifes (el dec de 0x0FCF).
  const parked = await shipsAt(page, SEA.x, SEA.y);
  expect(parked).toEqual([{ tile: 0x24 + BANK, hull: 42, skiffs: 1 }]);

  // Re-abordar la fragata desde el esquife (misma celda): recupera hull 42 y ESTIBA
  // el esquife (0x0919 skiffs++ ⇒ 1 del objeto + 1 estibado = 2).
  await page.locator("body").press("b");
  await expect.poll(() => readState<string>(page, "transport")).toBe("ship");
  expect(await readState<number>(page, "transportTile")).toBe(0x24);
  expect(await readState<number>(page, "shipHull")).toBe(42);
  expect(await readState<number>(page, "shipSkiffs")).toBe(2);
  // El objeto se retiró del mundo al abordarlo (write_object_record a ceros, #137).
  expect(await shipsAt(page, SEA.x, SEA.y)).toEqual([]);
});

test("#273 §7.1 · el esquife APARCADO conserva su facing en el mundo y re-abordarlo NO suma el +2 del caballo", async ({ page }) => {
  await gotoGame(page, { ...COAST, seed: 1234 });
  await seedShip(page, 0x29, 99, 1); // esquife E (0x29); hull/skiffs del objeto: irrelevantes para el skiff
  await page.locator("body").press("b");
  await expect.poll(() => readState<string>(page, "transport")).toBe("skiff");
  expect(await readState<number>(page, "transportTile")).toBe(0x29); // board preserva (sin +2)

  // Rema al oeste: el esquife VIRA Y AVANZA en el mismo pulsado (regla fiel, naval.spec).
  await page.locator("body").press("ArrowLeft");
  await expect.poll(async () => (await readState<{ x: number }>(page, "position")).x).toBe(COAST.x - 1);
  expect(await readState<number>(page, "transportTile")).toBe(0x2b); // facing W

  // X-it con tierra ortogonal (Forest1 en (177,128)): "skiff!" y el esquife se APARCA
  // en la celda con su tile TAL CUAL (ruta C 0x0F90-0x0F9A → banco alto 0x12B, facing W).
  await page.locator("body").press("x");
  await expect.poll(() => consoleText(page)).toContain("skiff!");
  expect(await readState<string>(page, "transport")).toBe("foot");
  const cellTile = await page.evaluate(
    ({ x, y }) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__u5test.game.activeMap.tileAt(x, y),
    { x: COAST.x - 1, y: COAST.y },
  );
  expect(cellTile).toBe(0x2b + BANK);

  // Re-abordar el esquife aparcado: el byte vuelve TAL CUAL (0x2B). El +2 era del
  // caballo (CMDS 0x0873); si alguien lo generaliza, esto da 0x2D y enrojece.
  await page.locator("body").press("b");
  await expect.poll(() => readState<string>(page, "transport")).toBe("skiff");
  expect(await readState<number>(page, "transportTile")).toBe(0x2b);
});
