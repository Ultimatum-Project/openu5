/**
 * Journey E2E — hechizos de MAZMORRA (task #47): In Lor (luz de la vista 3D a
 * profundidad 4) y Uus Por / Des Por (ascenso/descenso mágico de planta).
 *
 * Ejercita el CABLEADO REAL de la UI (main.ts handleDungeonKey tecla (C) →
 * doDungeonCast → game.dungeonMagicChangeLevel / dungeonSpellTurn), que las
 * pruebas unitarias no cubren. Entrada por el recipe de dungeon.spec (Deceit vía
 * deep-link + palabra ya pronunciada). Deriva del núcleo: re/notes/dungeon.md §3/§4.
 *
 * NOTA de setup: al entrar a la mazmorra el port deja `position.location` en 0 (la
 * mazmorra vive en game.dungeonState); la ventana temporal del Cast usa
 * dungeonState.pos.dungeon (33..40) — este spec fija que Uus/Des Por NO dan
 * "Not here!" dentro de la mazmorra.
 */
import { test, expect, type Page } from "@playwright/test";
import { gotoGame, hudLog, readState } from "./helpers";

const DECEIT = { loc: 0, x: 240, y: 74, hour: 10 }; // 1 al sur de la entrada (240,73)

async function dpos(
  page: Page,
): Promise<{ dungeon: number; floor: number; x: number; y: number; facing: string } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ds = (window as any).__u5test.game.dungeonState;
    return ds ? { ...ds.pos } : null;
  });
}

async function lightDepth(page: Page): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return page.evaluate(() => (window as any).__u5test.game.dungeonLightDepth);
}

async function pickMemberNum(page: Page, n: number): Promise<void> {
  await page.locator("body").press(String(n));
}

async function typeSpell(page: Page, initials: string): Promise<void> {
  for (const ch of initials) await page.locator("body").press(ch);
  await page.locator("body").press("Enter");
}

/** Entra a Deceit y siembra caster con maná/nivel + los 3 hechizos mezclados. */
async function enterDeceit(page: Page): Promise<void> {
  await gotoGame(page, DECEIT);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.game.state.questFlags["word-spoken:33"] = true;
  });
  await page.keyboard.press("ArrowUp"); // pisa (240,73), la entrada
  await page.keyboard.press("e"); // (E)nter → enterDungeon(33)
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).__u5test.game;
    const c = g.state.characters[0];
    c.currentMp = 40;
    c.level = 8; // ≥ círculo de Uus/Des Por (4)
    g.state.spellQuantities[0] = 9; // In Lor
    g.state.spellQuantities[21] = 9; // Uus Por
    g.state.spellQuantities[22] = 9; // Des Por
  });
}

test("In Lor ilumina la vista 3D a profundidad 4 (sin antorcha)", async ({ page }) => {
  test.setTimeout(60_000);
  await enterDeceit(page);
  expect(await dpos(page)).toMatchObject({ dungeon: 33, floor: 0 });
  expect(await lightDepth(page)).toBe(0); // a oscuras: sin antorcha ni hechizo

  await page.keyboard.press("c");
  await pickMemberNum(page, 1);
  await typeSpell(page, "il"); // "IN LOR"

  // In Lor fija lightSpellMins=100 (CAST2:0x08ea); el turno del propio Cast lo
  // descuenta ~2 min (como cualquier comando de mazmorra), así que queda ~98.
  const mins = await readState<number>(page, "lightSpellMins");
  expect(mins).toBeGreaterThanOrEqual(96);
  expect(mins).toBeLessThanOrEqual(100);
  expect(await lightDepth(page)).toBe(4); // hechizo → 4 celdas (antes 0 a oscuras)
  // In Lor global → éxito SILENCIOSO (CAST 0x11a6): sin "A light surrounds thee" (flavor
  // fabricado, purgado). El efecto (lightDepth=4, lightSpellMins arriba) prueba el cast;
  // el eco rúnico "IN LOR" es la única traza en el log.
  const inLorLog = (await hudLog(page, 8)).join("\n");
  expect(inLorLog).toMatch(/IN LOR/);
  expect(inLorLog).not.toMatch(/surrounds/i);
  // (La captura de depuración e2e/__screens__/ se retiró — auditoría de calidad,
  // adjudicación del stray del mega-merge: nadie la leía, se re-escribía en cada
  // run y era un frame del juego TRACKED, contra el régimen de material extraído.)
});

test("Des Por baja de planta y Uus Por sube ('Down!' / 'Up!')", async ({ page }) => {
  test.setTimeout(60_000);
  await enterDeceit(page);
  // (1,7): floor 0 y floor 1 son pasadizo vacío en Deceit → aterrizaje válido.
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.game.dungeonState.pos = { dungeon: 33, floor: 0, x: 1, y: 7, facing: "south" };
  });

  await page.keyboard.press("c");
  await pickMemberNum(page, 1);
  await typeSpell(page, "dp"); // "DES POR"
  expect((await hudLog(page, 8)).join("\n")).toMatch(/Down!/);
  expect(await dpos(page)).toMatchObject({ floor: 1, x: 1, y: 7 });

  await page.keyboard.press("c");
  await pickMemberNum(page, 1);
  await typeSpell(page, "up"); // "UUS POR"
  expect((await hudLog(page, 8)).join("\n")).toMatch(/Up!/);
  expect(await dpos(page)).toMatchObject({ floor: 0, x: 1, y: 7 });
});

test("Des Por sobre celda ocupada → 'Failed!' y no cambia de planta", async ({ page }) => {
  test.setTimeout(60_000);
  await enterDeceit(page);
  // (1,1): floor 1 (1,1) es escalera-abajo (nibble alto ≠ 0) → aterrizaje bloqueado.
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.game.dungeonState.pos = { dungeon: 33, floor: 0, x: 1, y: 1, facing: "south" };
  });
  await page.keyboard.press("c");
  await pickMemberNum(page, 1);
  await typeSpell(page, "dp");
  const log = (await hudLog(page, 8)).join("\n");
  expect(log).toMatch(/Down!/);
  expect(log).toMatch(/Failed!/);
  expect(await dpos(page)).toMatchObject({ floor: 0 }); // sin cambio
});

test("Uus Por en Doom (location 40) falla en SILENCIO", async ({ page }) => {
  test.setTimeout(60_000);
  await enterDeceit(page);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.game.dungeonState.pos = { dungeon: 40, floor: 3, x: 1, y: 1, facing: "south" };
  });
  await page.keyboard.press("c");
  await pickMemberNum(page, 1);
  await typeSpell(page, "up");
  expect(await dpos(page)).toMatchObject({ floor: 3 }); // sin cambio
  const log = (await hudLog(page, 8)).join("\n");
  expect(log).not.toMatch(/Up!|Down!|Failed!/); // silencioso (solo el eco "Uus Por!")
});
