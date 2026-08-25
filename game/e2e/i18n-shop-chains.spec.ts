/**
 * i18n ES de las CADENAS DE PRESENTACIÓN de tienda (carril cadenas-presentacion):
 * cadena del reactivo (C2/diff-1) y de la sanadora (C3) bajo lang=es — las piezas
 * nuevas (pitch/`Is this thy need?`/thanks; nature-of-need/cotización/epílogo)
 * salen traducidas por el choke t() + los t() por pieza de los compuestos, sin
 * fugas inglesas. Ancla la lección trampa-del-entrecomillado (las comillas se
 * componen TRAS traducir).
 */
import { test, expect, type Page } from "@playwright/test";

const press = (page: Page, key: string): Promise<void> => page.locator("body").press(key);
const consoleText = (page: Page): Promise<string> =>
  page.evaluate(() =>
    ((window as unknown as { __u5test: { consoleLines?: () => string[] } }).__u5test.consoleLines?.() ?? []).join("\n"),
  );
const shopSnap = (page: Page): Promise<{ type: string; phase: string; options: { key: string }[] } | null> =>
  page.evaluate(
    () =>
      (window as unknown as { __u5test: { shopConsole?: () => never } }).__u5test.shopConsole?.() ?? null,
  );
const shopOpen = (page: Page): Promise<boolean> =>
  page.evaluate(() => (window as unknown as { __u5test: { shopOpen?: () => boolean } }).__u5test.shopOpen?.() ?? false);

async function goto(page: Page, params: string): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(`/?skin=faithful&nointro&lang=es&${params}`);
  await page.waitForFunction(
    () => (window as unknown as { __u5test?: { worldReady?: () => boolean } }).__u5test?.worldReady?.() === true,
  );
}

test("ES · cadena del reactivo: pitch + «¿Es esto lo que precisáis?» + thanks traducidos", async ({ page }) => {
  // hour=10: gate horario de #315 — el MagicSeller de Jhelom (times [19,9,17,18],
  // npcs.json loc 7 slot 1) atiende con scheduleIndex impar, de 9 a 16; a la hora
  // INIT (8:35) el índice es 0 y rechaza con «Come see me...».
  await goto(page, "loc=7&floor=0&x=8&y=6&hour=10");
  const npc = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).__u5test.game;
    const seller = g.npcManager.npcsAt(7, 0).find((n: { dialogNumber: number }) => n.dialogNumber === 0x85);
    return seller ? { x: seller.x, y: seller.y } : null;
  });
  expect(npc).not.toBeNull();
  await page.evaluate((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (window as any).__u5test.state();
    s.position.x = p!.x + 1;
    s.position.y = p!.y;
    s.gold = 500;
  }, npc);
  await press(page, "t");
  await press(page, "ArrowLeft");
  await expect.poll(() => shopOpen(page)).toBe(true);
  await press(page, "y");
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("reagent-list");
  const firstKey = (await shopSnap(page))!.options[0]!.key;
  await press(page, firstKey);
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("reagent-deal");
  const pitch = await consoleText(page);
  expect(pitch).toContain("¿Es esto lo que precisáis?»");
  expect(pitch).not.toContain("Is this thy need");
  await press(page, "y");
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("reagent-list");
  const bought = await consoleText(page);
  expect(bought).toContain("¡Os lo agradezco!");
  expect(bought).toContain("¿Algo más?");
  expect(bought).not.toContain("I thank thee");
  expect(bought).not.toContain("Anything else");
});

test("ES · cadena de la sanadora: nature-of-need + cotización + epílogo traducidos", async ({ page }) => {
  await goto(page, "loc=23&floor=0&x=15&y=15");
  const npc = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).__u5test.game;
    const healer = g.npcManager.npcsAt(23, 0).find((n: { dialogNumber: number }) => n.dialogNumber === 0x87);
    return healer ? { x: healer.x, y: healer.y } : null;
  });
  expect(npc).not.toBeNull();
  await page.evaluate((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (window as any).__u5test.state();
    s.position.x = p!.x + 1;
    s.position.y = p!.y;
    s.gold = 500;
    s.characters[0].currentHp = Math.max(1, s.characters[0].maxHp - 5);
  }, npc);
  await press(page, "t");
  await press(page, "ArrowLeft");
  await expect.poll(() => shopOpen(page)).toBe(true);
  expect((await shopSnap(page))?.phase).toBe("greet-yn");
  await press(page, "y");
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("healer-need");
  const nature = await consoleText(page);
  expect(nature).toContain("¿Cuál es la naturaleza de vuestra necesidad?»");
  expect(nature).not.toContain("What is the nature");
  await press(page, "h");
  const partySize = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__u5test.state().partySize as number;
  });
  if (partySize > 1) {
    await expect.poll(() => consoleText(page)).toContain("¿Quién precisa mi ayuda?»");
    await press(page, "Enter");
  }
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("healer-pay");
  const quote = await consoleText(page);
  expect(quote).toContain("Puedo sanaros");
  expect(quote).toMatch(/por \d+ de oro\./);
  expect(quote).toContain("¿Pagaréis?»");
  expect(quote).not.toContain("Wilt thou");
  await press(page, "y");
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("healer-again");
  const tail = await consoleText(page);
  expect(tail).toContain("¿Hay alguna otra forma en que pueda ayudaros?»");
  expect(tail).not.toContain("Is there any other way");
});
