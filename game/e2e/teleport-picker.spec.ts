/**
 * SELECTOR DE MAPA del teletransporte de debug (e2e). Arranca la piel fiel con
 * `?debug=1` (auto-abre el drawer), abre el modal point-and-click y verifica:
 *   (1) el botón «Abrir selector de mapa…» monta el modal;
 *   (2) el input numérico (x,y) + Ir teletransporta a la celda EXACTA (overworld);
 *   (3) un CLICK en el mapa mueve la party a una celda dentro de rango;
 *   (4) la pestaña Ciudades y castillos teletransporta a (loc,floor,x,y);
 *   (5) las mazmorras (si hay datos) entran y reubican la party en la celda;
 *   (6) ESC cierra el modal SIN llegar al juego (la party NO se mueve por el ESC);
 *   (7) el último destino se recuerda y «Ir de nuevo» reaplica.
 */
import { test, expect, type Page } from "@playwright/test";
import { readState } from "./helpers";

interface Pos {
  location: number;
  floor: number;
  x: number;
  y: number;
}

async function bootWithDebug(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful&nointro&loc=0&x=76&y=40&hour=10&debug=1");
  await page.waitForFunction(
    () =>
      (window as unknown as { __u5test?: { worldReady?: () => boolean } }).__u5test?.worldReady?.() === true,
    undefined,
    { timeout: 15_000 },
  );
}

/** Abre el modal desde el botón del drawer. */
async function openPicker(page: Page): Promise<void> {
  await page.locator('[data-testid="u5-teleport-open"]').click();
  await expect(page.locator('[data-testid="u5-teleport-picker"]')).toBeVisible();
}

test("el botón del drawer abre el selector de mapa", async ({ page }) => {
  await bootWithDebug(page);
  await openPicker(page);
  await expect(page.locator('[data-testid="u5-teleport-tab-overworld"]')).toHaveClass(/active/);
});

test("input numérico (x,y) + Ir teletransporta a la celda exacta (overworld)", async ({ page }) => {
  await bootWithDebug(page);
  await openPicker(page);
  await page.locator('[data-testid="u5-teleport-x"]').fill("42");
  await page.locator('[data-testid="u5-teleport-y"]').fill("84");
  await page.locator('[data-testid="u5-teleport-go"]').click();
  const pos = await readState<Pos>(page, "position");
  expect({ location: pos.location, floor: pos.floor, x: pos.x, y: pos.y }).toEqual({
    location: 0,
    floor: 0,
    x: 42,
    y: 84,
  });
});

test("un click en el mapa mueve la party a una celda en rango", async ({ page }) => {
  await bootWithDebug(page);
  await openPicker(page);
  const frame = page.locator(".u5tp-frame");
  const box = (await frame.boundingBox())!;
  // Click en el cuadrante inferior-derecho (~0.7 → x,y≈179) → LEJOS del inicio (76,40),
  // así se confirma que el click MOVIÓ la party. El pick va con debounce (220ms, para
  // distinguir doble-click=zoom), así que se sondea hasta ver el cambio.
  await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.7);
  await expect
    .poll(async () => (await readState<Pos>(page, "position")).x, { timeout: 3000 })
    .toBeGreaterThan(150);
  const pos = await readState<Pos>(page, "position");
  expect(pos.location).toBe(0);
  expect(pos.x).toBeLessThan(256);
  expect(pos.y).toBeGreaterThan(150);
  expect(pos.y).toBeLessThan(256);
});

test("pestaña Ciudades y castillos teletransporta a (loc,floor,x,y)", async ({ page }) => {
  await bootWithDebug(page);
  await openPicker(page);
  await page.locator('[data-testid="u5-teleport-tab-town"]').click();
  const sel = page.locator('[data-testid="u5-teleport-location"]');
  const loc = Number(await sel.inputValue());
  await page.locator('[data-testid="u5-teleport-x"]').fill("10");
  await page.locator('[data-testid="u5-teleport-y"]').fill("12");
  await page.locator('[data-testid="u5-teleport-go"]').click();
  const pos = await readState<Pos>(page, "position");
  expect(pos.location).toBe(loc);
  expect({ x: pos.x, y: pos.y }).toEqual({ x: 10, y: 12 });
});

test("mazmorras (si hay datos) entran y reubican la party en la celda", async ({ page }) => {
  await bootWithDebug(page);
  const hasDungeons = await page.evaluate(() => {
    const g = (window as unknown as { __u5debug?: { game?: { dungeons?: unknown[] } } }).__u5debug?.game;
    return (g?.dungeons?.length ?? 0) > 0;
  });
  test.skip(!hasDungeons, "sin datos de mazmorra cargados en este arranque");
  await openPicker(page);
  await page.locator('[data-testid="u5-teleport-tab-dungeon"]').click();
  const dungeon = Number(await page.locator('[data-testid="u5-teleport-dungeon"]').inputValue());
  await page.locator('[data-testid="u5-teleport-floor-2"]').click();
  await page.locator('[data-testid="u5-teleport-x"]').fill("4");
  await page.locator('[data-testid="u5-teleport-y"]').fill("5");
  await page.locator('[data-testid="u5-teleport-go"]').click();
  const dpos = await page.evaluate(() => {
    const ds = (window as unknown as { __u5debug?: { game?: { dungeonState?: { pos?: unknown } } } })
      .__u5debug?.game?.dungeonState;
    return ds?.pos as { dungeon: number; floor: number; x: number; y: number } | undefined;
  });
  expect(dpos).toMatchObject({ dungeon, floor: 2, x: 4, y: 5 });
});

test("vista PLANTA COMPLETA es el default (pedido usuario: teleport enseña la planta entera), el toggle a Gem funciona, y el input numérico teleporta a la celda de planta", async ({ page }) => {
  await bootWithDebug(page);
  const hasDungeons = await page.evaluate(
    () => ((window as unknown as { __u5debug?: { game?: { dungeons?: unknown[] } } }).__u5debug?.game?.dungeons?.length ?? 0) > 0,
  );
  test.skip(!hasDungeons, "sin datos de mazmorra");
  await openPicker(page);
  await page.locator('[data-testid="u5-teleport-tab-dungeon"]').click();
  // PLANTA COMPLETA por DEFAULT (el teleport debe enseñar toda la planta, no el flood del gem).
  await expect(page.locator('[data-testid="u5-teleport-dview-full"]')).toHaveClass(/active/);
  // El input numérico es coord de PLANTA (0..7) aun en vista gem: teleporta exacto.
  await page.locator('[data-testid="u5-teleport-x"]').fill("3");
  await page.locator('[data-testid="u5-teleport-y"]').fill("4");
  await page.locator('[data-testid="u5-teleport-go"]').click();
  const dpos = await page.evaluate(() => {
    const ds = (window as unknown as { __u5debug?: { game?: { dungeonState?: { pos?: unknown } } } }).__u5debug?.game?.dungeonState;
    return ds?.pos as { floor: number; x: number; y: number } | undefined;
  });
  expect(dpos).toMatchObject({ floor: 0, x: 3, y: 4 });
  // Toggle a Gem (la vista fiel sigue disponible).
  await page.locator('[data-testid="u5-teleport-dview-gem"]').click();
  await expect(page.locator('[data-testid="u5-teleport-dview-gem"]')).toHaveClass(/active/);
});

// COMBAT-VIEW-BUG (testigo del usuario): tras teleportar a una celda de sala de mazmorra
// y pisarla, el combate de sala ARRANCA pero la piel seguía pintando el PASILLO 3D (viewport
// negro) en vez de la ARENA. La causa era coreview: `dungeon` seguía no-nulo con combate
// activo (game.combat y game.dungeonState coexisten en una sala) y la piel prioriza el 3D.
// Aquí se reproduce el CAMINO EXACTO: teleport a un pasillo adyacente a la sala + un paso
// hacia ella (el MISMO dungeonCommand("forward") que anda el jugador) → la vista debe ser
// la arena (mode combat, dungeon apagado, combatView vivo), no el corredor.
test("teleport a sala de mazmorra + paso: la vista es la ARENA, no el pasillo 3D", async ({ page }) => {
  await bootWithDebug(page);
  const ready = await page.evaluate(() => {
    const g = (window as unknown as { __u5debug?: { game?: { dungeons?: unknown[]; combatResources?: { combatMaps?: unknown[] } } } }).__u5debug?.game;
    return (g?.dungeons?.length ?? 0) > 0 && (g?.combatResources?.combatMaps?.length ?? 0) > 0;
  });
  test.skip(!ready, "sin datos de mazmorra/combate cargados en este arranque");
  // Doom (dungeonId 40) floor 7: celda de sala (5,7); pasillo al oeste (4,7) mirando al este.
  await page.evaluate(() => {
    const w = window as unknown as { __u5debug: { teleportDungeon(d: number, f: number, x: number, y: number): void }; __u5test: { game: { dungeonState: { pos: { facing: string } } } } };
    w.__u5debug.teleportDungeon(40, 7, 4, 7);
    w.__u5test.game.dungeonState.pos.facing = "east";
  });
  const before = await page.evaluate(() => (window as unknown as { __u5test: { viewMode(): { mode: string; hasDungeon: boolean; hasCombat: boolean } } }).__u5test.viewMode());
  expect(before).toMatchObject({ mode: "dungeon", hasDungeon: true, hasCombat: false });

  // Un paso hacia la sala dispara el combate de sala. ★ SE ANDA POR EL CAMINO DEL JUGADOR
  // (tecla → handleDungeonKey → `applyEvents` → `view.notifyTurn`), NO llamando al core a
  // pelo. Motivo, medido: `view.snapshot()` está MEMOIZADO (PERF-1, `coreview.ts:1074`
  // `snapCache`) y sólo lo invalidan `notifyTurn`/`emitDirty`/`emitConsole`. El jugador
  // pasa por `main.ts:938` (`applyEvents(game.dungeonCommand(cmd))`), que notifica; una
  // llamada directa a `__u5test.game.dungeonCommand("forward")` NO notifica, así que la
  // sonda `viewMode()` devolvía el snapshot ANTERIOR — el del pasillo — y el test acusaba
  // al port de un bug de vista que era del propio arnés. `ArrowUp` = forward
  // (main.ts handleDungeonKey). Ver re/notes/teleport-picker-146-adjudicacion.md.
  await page.locator("body").press("ArrowUp");
  const started = await page.evaluate(
    () => (window as unknown as { __u5test: { game: { combat: unknown } } }).__u5test.game.combat != null,
  );
  expect(started, "el paso hacia la sala arrancó el combate de sala").toBe(true);

  // AMBOS estados vivos (sala): combat + dungeonState. Pero la VISTA es la arena.
  const inCombat = await page.evaluate(() => {
    const g = (window as unknown as { __u5test: { game: { combat: unknown; dungeonState: unknown }; viewMode(): { mode: string; hasDungeon: boolean; hasCombat: boolean } } }).__u5test;
    return { combat: g.game.combat != null, dungeonState: g.game.dungeonState != null, view: g.viewMode() };
  });
  expect(inCombat.combat).toBe(true);
  expect(inCombat.dungeonState).toBe(true); // el 3D NO se anula (se reanuda al salir por el borde)
  expect(inCombat.view).toMatchObject({ mode: "combat", hasDungeon: false, hasCombat: true });
});

test("ESC cierra el modal sin llegar al juego (la party no se mueve)", async ({ page }) => {
  await bootWithDebug(page);
  await openPicker(page);
  const before = await readState<Pos>(page, "position");
  await page.locator('[data-testid="u5-teleport-picker"]').focus();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="u5-teleport-picker"]')).toHaveCount(0);
  const after = await readState<Pos>(page, "position");
  expect(after).toEqual(before); // ESC no disparó ningún comando del juego
});

test("recuerda el último destino y «Ir de nuevo» lo reaplica", async ({ page }) => {
  await bootWithDebug(page);
  await openPicker(page);
  await page.locator('[data-testid="u5-teleport-x"]').fill("30");
  await page.locator('[data-testid="u5-teleport-y"]').fill("31");
  await page.locator('[data-testid="u5-teleport-go"]').click();
  await expect(page.locator('[data-testid="u5-teleport-again"]')).toBeVisible();
  // Mueve la party FUERA del selector (no toca el «último destino» recordado); «Ir de
  // nuevo» debe reaplicar (30,31), no la posición actual.
  await page.evaluate(() => {
    (window as unknown as { __u5debug: { teleportOverworld(x: number, y: number): void } }).__u5debug.teleportOverworld(0, 0);
  });
  await page.locator('[data-testid="u5-teleport-again"]').click();
  const pos = await readState<Pos>(page, "position");
  expect({ x: pos.x, y: pos.y }).toEqual({ x: 30, y: 31 });
});
