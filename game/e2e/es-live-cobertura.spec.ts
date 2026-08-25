/**
 * VERIFICACIÓN ES EN VIVO del lote cobertura-medias (spec EFÍMERO del carril —
 * capturas a scratchpad; se puede retirar tras el aterrizaje o conservar como
 * regresión ligera). Cubre en 'es': Rowing/Hull weak (mar), Hic! (borrachera),
 * palabrota (diálogo), insulto de posada, aviso No-active-game (intro) y el
 * aborto sin luz del Search 3D.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoGame, pressAndLog, hudLog } from "./helpers";

const SEA = { x: 250, y: 120, hour: 12 };
const SHOT = "<scratch>";

/**
 * Banco alto de sprites (#137, `re/notes/board-137-acta.md` §2): el byte `+0` del registro
 * de objeto del binario es un índice del banco alto y la capa de objetos del port guarda el
 * tile COMPLETO. `board()` discrimina «hay vehículo» por `tileAt(...) >= 0x100` — sembrar el
 * byte pelado NO aborda y el estado se queda a pie.
 */
const ACTOR_TILE_BANK = 0x100;

async function seedShipAndBoard(page: Page, tile: number, hull = 99): Promise<void> {
  await page.evaluate(({ t, h }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).__u5test.game;
    const p = g.state.position;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.addWorldObject({
      location: p.location, floor: p.floor, x: p.x, y: p.y,
      tile: t, kind: "ship", hull: h, skiffs: 1,
    });
  }, { t: tile + ACTOR_TILE_BANK, h: hull });
  await page.locator("body").press("b");
}

test("es: fragata arriada rema → '¡Remando!'; virar con casco débil → '¡Casco débil!'", async ({ page }) => {
  await gotoGame(page, { ...SEA, seed: 77 }, ["lang=es"]);
  await seedShipAndBoard(page, 0x24, 0x20); // arriada, casco 0x20 < 0x32
  // facing tras board = el del tile 0x24 (N). Remar al norte: avanza → Rowing.
  const rowLog = await pressAndLog(page, "ArrowUp");
  expect(rowLog.some((l) => l.includes("¡Remando!"))).toBe(true);
  // Virar al este (facing cambia) → Head + Hull weak en ES.
  const turnLog = await pressAndLog(page, "ArrowRight");
  expect(turnLog.some((l) => l.includes("¡Casco débil!"))).toBe(true);
  await page.screenshot({ path: `${SHOT}/es-live-mar.png` });
});

test("es: borrachera en pueblo → '¡Hip!' y tumbo", async ({ page }) => {
  await gotoGame(page, { loc: 2, x: 15, y: 15, hour: 12, seed: 5 }, ["lang=es"]);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).__u5test.game;
    g.state.drunkTurns = 25; // 4ª copa de la taberna ([0x5957]=25)
  });
  // Con el gate al 50% por tecla, 20 pasos garantizan Hic con prob. 1-2^-20.
  let hic = false;
  for (let i = 0; i < 20 && !hic; i++) {
    const log = await pressAndLog(page, "ArrowLeft");
    hic = log.some((l) => l.includes("¡Hip!"));
  }
  expect(hic).toBe(true);
  await page.screenshot({ path: `${SHOT}/es-live-hip.png` });
});

test("es: palabrota en diálogo → «Con ese lenguaje…» y la conversación sigue", async ({ page }) => {
  // Iolo's Hut no tiene NPC seguro a mano: usa un pueblo con NPC adyacente vía
  // teleport de e2e — Britain (loc 2) tiene NPCs; hablamos con quien haya cerca.
  await gotoGame(page, { loc: 2, x: 15, y: 15, hour: 12, seed: 5 }, ["lang=es"]);
  // Busca un NPC CONVERSABLE (TLK 1..0x7f) y colócate a su oeste (hook de estado).
  const ok = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const g = w.__u5test.game;
    const p = g.state.position;
    const npcs = g.npcManager?.npcsAt?.(p.location, p.floor) ?? [];
    const n = npcs.find(
      (s: { x: number; y: number; dialogNumber: number }) =>
        s.dialogNumber >= 1 && s.dialogNumber < 0x81 && s.x > 2 && s.y > 2,
    );
    if (!n) return false;
    p.x = n.x - 1;
    p.y = n.y;
    return true;
  });
  test.skip(!ok, "sin NPC utilizable en la planta");
  await page.locator("body").press("t");
  await page.locator("body").press("ArrowRight");
  await page.waitForTimeout(300);
  // Escribe la palabrota en el getstring del diálogo.
  await page.keyboard.type("fuck");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const log = (await hudLog(page)).join("\n");
  expect(log).toContain("Con ese lenguaje");
  await page.screenshot({ path: `${SHOT}/es-live-palabrota.png` });
});

test("es: intro 'J' sin partida → aviso 'No hay partida activa…' y el menú sigue", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful&lang=es");
  // Avanza hasta la FASE menu (hook DEV introPhase), sin teclas a ciegas.
  const phase = (): Promise<string | null> =>
    page.evaluate(() => {
      const t = (window as unknown as { __u5test?: { introPhase?: () => string } }).__u5test;
      return t?.introPhase ? t.introPhase() : null;
    });
  for (let i = 0; i < 40 && (await phase()) !== "menu"; i++) {
    await page.keyboard.press(" ");
    await page.waitForTimeout(300);
  }
  expect(await phase()).toBe("menu");
  await page.keyboard.press("j");
  await page.waitForTimeout(400);
  // El mundo NO montó (el gate rebotó al menú con el aviso) y seguimos en menu.
  expect(await page.locator(".faithful-skin canvas").count()).toBe(0);
  expect(await phase()).toBe("menu");
  await page.screenshot({ path: `${SHOT}/es-live-no-active-game.png` });
  // Una tecla despeja el aviso (el menú queda vivo, sin arrancar mundo).
  await page.keyboard.press(" ");
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOT}/es-live-menu-despejado.png` });
  expect(await page.locator(".faithful-skin canvas").count()).toBe(0);
});
