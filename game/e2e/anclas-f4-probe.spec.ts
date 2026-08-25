/**
 * EXPERIMENTO de la ventana `anclas-f4` — ¿por qué `shopOpen()` sale falso en el resync de
 * ancla-NPC del espejo, y por qué a veces no?
 *
 * NO es un test de regresión del port: es el instrumento con el que se adjudica la ficha F-4
 * (`ANCHOR-MISS` ≠ 0 en AD y variable entre corridas). Se corre a mano:
 *
 *   U5_E2E_PORT=5253 npx playwright test e2e/anclas-f4-probe.spec.ts --reporter=line
 *
 * LA HIPÓTESIS QUE MIDE. `resyncToNpcAnchor` (`runner.ts:2057`) lee los NPC vivos
 * (`liveNpcs`, :2063) y DESPUÉS teleporta la party a la celda adyacente (`teleportSmall`,
 * :2092). Pero ese teleport pasa por `__u5debug.teleportSmallMap`, que llama a
 * `npcManager.enterMap` (`debugApi.ts:337`), y `enterMap` reconstruye CADA NPC en su celda de
 * HORARIO (`manager.ts:186-199`: `x: s.x[idx], y: s.y[idx]`) — DESCARTA la posición a la que
 * el NPC hubiera derivado por wander. Si el NPC estaba fuera de su puesto cuando se le leyó,
 * la party aterriza adyacente a una celda que el propio teleport acaba de dejar VACÍA, el
 * Talk cae al aire y `shopOpen()` es falso.
 *
 * Los tres tests son, en orden: el HECHO (el teleport resetea), el NEGATIVO (party adyacente
 * a la celda derivada → no engancha) y el POSITIVO (party adyacente al PUESTO → engancha).
 * Sin el positivo, el negativo no probaría nada: un «no engancha» puede venir de que la
 * sonda no sepa abrir tiendas.
 */
import { test, expect } from "@playwright/test";
import { gotoGame } from "./helpers";

/** Minoc = location 5. Healer = dialogNumber 0x87 (135). Su horario (assets/npcs.json,
 *  slot 2): times [21,5,11,13] · x [7,6,25] · y [25,26,8] · ai [FIJO, WANDER, WANDER].
 *  A las 9:00 el índice de horario es 1 ⇒ puesto (6,26) y AI de wander. */
const MINOC = 5;
const HEALER_DLG = 135;
const PUESTO = { x: 6, y: 26 };

type NpcPos = { x: number; y: number; dialogNumber: number };

const npcs = (page: import("@playwright/test").Page, loc = MINOC, floor = 0): Promise<NpcPos[]> =>
  page.evaluate(
    ({ l, f }) =>
      ((window as unknown as { __u5test: { game: { npcManager?: { npcsAt: (l: number, f: number) => Array<{ x: number; y: number; dialogNumber: number }> } } } }).__u5test.game.npcManager?.npcsAt(l, f) ?? []).map((n) => ({ x: n.x, y: n.y, dialogNumber: n.dialogNumber })),
    { l: loc, f: floor },
  );

const healer = (list: NpcPos[]): NpcPos | undefined => list.find((n) => n.dialogNumber === HEALER_DLG);

const teleport = (page: import("@playwright/test").Page, x: number, y: number): Promise<void> =>
  page.evaluate(
    ({ x, y }) => (window as unknown as { __u5debug: { teleportSmallMap: (l: number, f: number, x: number, y: number) => void } }).__u5debug.teleportSmallMap(5, 0, x, y),
    { x, y },
  );

const shopOpen = (page: import("@playwright/test").Page): Promise<boolean> =>
  page.evaluate(() => Boolean((window as unknown as { __u5test?: { shopOpen?: () => boolean } }).__u5test?.shopOpen?.()));

/** MISMA secuencia de teclas que el resync del espejo (`runner.ts:2107-2127`): Escape ×2 de
 *  limpieza, (T)alk, flecha de dirección, settle de 400 ms. */
async function talkHacia(page: import("@playwright/test").Page, flecha: string): Promise<void> {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  await page.keyboard.press("t");
  await page.waitForTimeout(120);
  await page.keyboard.press(flecha);
  await page.waitForTimeout(400);
}

/** Camina hasta que el healer se salga de su puesto (wander), o se rinde. Devuelve su celda. */
async function esperarDeriva(page: import("@playwright/test").Page, maxPasos = 40): Promise<NpcPos> {
  let h = healer(await npcs(page))!;
  for (let i = 0; i < maxPasos && h.x === PUESTO.x && h.y === PUESTO.y; i++) {
    await page.keyboard.press(i % 2 === 0 ? "ArrowLeft" : "ArrowRight");
    await page.waitForTimeout(90);
    h = healer(await npcs(page))!;
  }
  return h;
}

test.describe("anclas-f4 — de dónde sale el shopOpen=false del resync de ancla-NPC", () => {
  test("EL HECHO: teleportSmallMap devuelve al NPC derivado a su celda de HORARIO", async ({ page }) => {
    await gotoGame(page, { loc: MINOC, floor: 0, x: 10, y: 26, hour: 9 });
    expect(healer(await npcs(page)), "el healer de Minoc tiene que existir").toBeTruthy();

    const derivado = await esperarDeriva(page);
    test.skip(derivado.x === PUESTO.x && derivado.y === PUESTO.y, "el healer no llegó a derivar en 40 pasos");

    await teleport(page, 20, 20); // teleport a cualquier celda: lo que importa es el enterMap
    await page.waitForTimeout(150);
    const tras = healer(await npcs(page))!;
    expect({ x: tras.x, y: tras.y }, "tras el teleport el NPC está en su PUESTO, no donde derivó").toEqual(PUESTO);
    expect({ x: derivado.x, y: derivado.y }, "y la celda derivada NO era el puesto").not.toEqual(PUESTO);
  });

  test("NEGATIVO: party adyacente a la celda DERIVADA (lo que hace el resync) → NO engancha", async ({ page }) => {
    await gotoGame(page, { loc: MINOC, floor: 0, x: 10, y: 26, hour: 9 });
    const derivado = await esperarDeriva(page);
    test.skip(derivado.x === PUESTO.x && derivado.y === PUESTO.y, "el healer no llegó a derivar en 40 pasos");

    // exactamente lo que hace resyncToNpcAnchor: celda adyacente a la posición LEÍDA
    await teleport(page, derivado.x, derivado.y - 1);
    await page.waitForTimeout(150);
    await talkHacia(page, "ArrowDown");
    expect(await shopOpen(page), "el Talk cae en la celda que el teleport dejó vacía").toBe(false);
  });

  test("POSITIVO: party adyacente al PUESTO → engancha (la tienda SÍ se abre por esta vía)", async ({ page }) => {
    await gotoGame(page, { loc: MINOC, floor: 0, x: 10, y: 26, hour: 9 });
    await teleport(page, PUESTO.x, PUESTO.y - 1);
    await page.waitForTimeout(150);
    await talkHacia(page, "ArrowDown");
    expect(await shopOpen(page), "misma secuencia de teclas, celda correcta").toBe(true);
  });
});
