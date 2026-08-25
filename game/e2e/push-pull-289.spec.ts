/**
 * #289 (merge 9ee3e94c, residuo real de la adjudicación) — (P)ush/PULL del mundo FIEL:
 * "Pushed!\n" (CMDS 0x1548, DS 0x4547) / "Pulled!\n" (0x15B0, DS 0x4550), la
 * REORIENTACIÓN de la clase 0x90 (sillas) vía dir_vector_to_facing (0x1504; slide
 * flip=0, pull flip=1 = idx^2) y la cadena de fallo del gate 1 ("Won't budge!\n" CON
 * '!', DS 0x4559). Nada de esto tenía mirada e2e (grep Pushed!/Pulled! en game/e2e:
 * cero antes de este fichero).
 *
 * Tablero REAL, no sembrado: BRITAIN (location 2 = smallmaps id 2, clave '1' del
 * JSON — ⚠ la clave del array va una por debajo del id) planta 0, fila 8 (tiles
 * verificados en assets/maps/smallmaps.json, convención tiles[y][x]):
 * (7,8)=0x44 suelo · (8,8)=0x92 silla · (9,8)=0x44 suelo · (10,8)=0x4f pared.
 * El party arranca en (7,8).
 *
 * Derivación de los esperados (commands.ts pushOrientedTile, calco de 0x1504):
 *   idx: E=1, S=2, W=3 (N=0); pull ⇒ idx^2. Silla = clase 0x90 + idx.
 *   · PUSH al E de la silla (8,8): dest (9,8)=0x44=fill ⇒ "Pushed!": desliza como
 *     0x90+1=0x91, la fuente queda 0x44 y el party ocupa la vacante (8,8).
 *   · PULL al E de la silla ya en (9,8): dest (10,8)=0x4f≠fill y el party pisa
 *     0x44 ⇒ "Pulled!": la silla llega a la celda del party como 0x90+(1^2)=0x93,
 *     la fuente queda 0x44 y el party avanza a (9,8) — el pull también mueve.
 *   · Gate 1: empujar la pared (0x4f no es pushable) ⇒ "Won't budge!" CON '!' y el
 *     party NO se mueve. (La cadena gemela SIN '!' —gate 4, DS 0x4567— exige party
 *     sobre no-fill con pushable delante: no alcanzable en esta fila; queda para el
 *     vitest del comando.)
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoGame, readState, consoleText, skinCycleReady } from "./helpers";

interface Pos { x: number; y: number }

async function tileAt(page: Page, x: number, y: number): Promise<number> {
  return page.evaluate(
    ({ x, y }) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__u5test.game.activeMap.tileAt(x, y),
    { x, y },
  );
}

/** Nº de apariciones de `needle` en la consola lógica (ring de 12 líneas). */
async function consoleCount(page: Page, needle: string): Promise<number> {
  const txt = await consoleText(page);
  return txt.split(needle).length - 1;
}

test("#289 · Pushed!/Pulled! con reorientación 0x90+idx en crudo, y el gate 1 'Won't budge!' no mueve", async ({ page }) => {
  await gotoGame(page, { loc: 2, floor: 0, x: 7, y: 8, hour: 10, seed: 1234 });
  await skinCycleReady(page);
  // El tablero es el REAL del mapa — se carea antes de tocarlo (control del arnés).
  expect(await tileAt(page, 8, 8)).toBe(0x92);
  expect(await tileAt(page, 9, 8)).toBe(0x44);
  expect(await tileAt(page, 10, 8)).toBe(0x4f);

  // PUSH: p + Este sobre la silla de (8,8) — dest (9,8)=0x44=fill ⇒ rama 0x1548.
  // Desliza reorientada flip=0: 0x90+1=0x91 en (9,8); el party ocupa la vacante.
  await page.keyboard.press("p");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => consoleCount(page, "Pushed!")).toBe(1);
  expect(await tileAt(page, 9, 8)).toBe(0x91);
  expect(await tileAt(page, 8, 8)).toBe(0x44);
  expect(await readState<Pos>(page, "position")).toMatchObject({ x: 8, y: 8 });

  // PULL: p + Este otra vez — la silla (9,8)=0x91 tiene la pared (10,8)=0x4f detrás
  // (no-fill) y el party pisa 0x44 ⇒ rama 0x15B0. Reorientación E con flip=1:
  // 0x90+(1^2)=0x93 en la celda del party; el party pasa a la celda liberada (9,8).
  await page.keyboard.press("p");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => consoleCount(page, "Pulled!")).toBe(1);
  expect(await tileAt(page, 8, 8)).toBe(0x93);
  expect(await tileAt(page, 9, 8)).toBe(0x44);
  expect(await readState<Pos>(page, "position")).toMatchObject({ x: 9, y: 8 });

  // GATE 1: empujar la pared (10,8)=0x4f — "Won't budge!" CON '!' (DS 0x4559) y el
  // party se queda donde está (el fallo no cobra ni mueve).
  await page.keyboard.press("p");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => consoleCount(page, "Won't budge!")).toBe(1);
  expect(await readState<Pos>(page, "position")).toMatchObject({ x: 9, y: 8 });
});
