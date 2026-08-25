/**
 * COMPOSICIÓN del picker de mazmorras — guarda DURA celda-a-celda.
 *
 * Testigo (3ª vuelta): «compone trozos del mapa pero no bien, por el tiling». Hipótesis de
 * desplazamiento/traspuesta/wrap en el bucle de render. Este test RASTERIZA el canvas del
 * picker para Doom F1 y F7 y compara CADA una de las 64 celdas contra la CLASE de pintado
 * esperada derivada de `game.dungeons` (== assets/maps/dungeons.json). Lenguaje visual =
 * ESTILO CLUEBOOK (re-baseline pedido usuario 2026-07-21): roca NEGRA, transitable BLANCO
 * (papel), glifos negros sobre papel (escaleras/salas-⊠/puertas), features de color
 * (fuente/secreta azul, trampa roja, cofre dorado, campo púrpura). 64/64 deben casar; un
 * offset/traspuesta/wrap deja celdas descuadradas y el test se pone rojo. Guardia permanente.
 */
import { test, expect, type Page } from "@playwright/test";

async function boot(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful&nointro&loc=0&x=76&y=40&hour=10&debug=1");
  await page.waitForFunction(
    () => (window as unknown as { __u5test?: { worldReady?: () => boolean } }).__u5test?.worldReady?.() === true,
    undefined,
    { timeout: 15_000 },
  );
  await page.locator('[data-testid="u5-teleport-open"]').click();
  await page.locator('[data-testid="u5-teleport-tab-dungeon"]').click();
  await page.locator('[data-testid="u5-teleport-dungeon"]').selectOption("40"); // Doom
  // La composición 8×8 se comprueba en la vista PLANTA COMPLETA (la Gem es el display 22×22).
  await page.locator('[data-testid="u5-teleport-dview-full"]').click();
}

/** Compara el raster del canvas 8×8 con la clase esperada de cada tipo (con B1). Devuelve mismatches. */
async function mismatches(page: Page, floorIdx: number): Promise<string[]> {
  const f = page.locator(`[data-testid="u5-teleport-floor-${floorIdx}"]`);
  if (await f.count()) await f.click();
  await page.waitForTimeout(250);
  return page.evaluate(() => {
    const cv = document.querySelector<HTMLCanvasElement>(".u5tp-inner canvas")!;
    const ctx = cv.getContext("2d")!;
    const cell = cv.width / 8;
    // Clase pintada real de una celda (lenguaje CLUEBOOK): "." roca negra; "_" papel
    // blanco limpio; "G" glifo negro sobre papel (escalera/sala-⊠/puerta); "B" azul
    // (fuente/secreta); "X" trampa roja; "C" cofre dorado; "F" campo púrpura.
    const actual = (cx: number, cy: number): string => {
      let white = 0, black = 0, blue = 0, red = 0, gold = 0, purple = 0;
      for (let sy = 4; sy < cell - 4; sy += 4) {
        for (let sx = 4; sx < cell - 4; sx += 4) {
          const d = ctx.getImageData(cx * cell + sx, cy * cell + sy, 1, 1).data;
          const r = d[0]!, g = d[1]!, b = d[2]!;
          if (r < 40 && g < 40 && b < 40) black++;
          else if (r > 200 && g > 200 && b > 200) white++;
          else if (b > 140 && r > 80 && r < 200 && g < 100) purple++;
          else if (b > 140 && r < 150) blue++;
          else if (r > 150 && g < 110 && b < 110) red++;
          else if (r > 140 && g > 90 && b < 100) gold++;
        }
      }
      if (white === 0) return ".";
      if (blue > 0) return "B";
      if (red > 0) return "X";
      if (purple > 0) return "F";
      if (gold > 0) return "C";
      if (black > 0) return "G";
      return "_";
    };
    const game = (window as unknown as {
      __u5debug: { game: { dungeons: { location: number; floors: { type: number }[][][] }[] } };
    }).__u5debug.game;
    // Lee la MISMA planta que el picker pinta (la pestaña de planta activa).
    const floorIndex = Number(
      (document.querySelector(".u5tp-floor.active") as HTMLElement | null)
        ?.getAttribute("data-testid")
        ?.replace("u5-teleport-floor-", "") ?? "0",
    );
    const F = game.dungeons.find((d) => d.location === 40)!.floors[floorIndex]!;
    const expected = (t: number): string => {
      if (t === 11 || t === 12) return "."; // roca (Wall/SpecialWall) → negra
      if (t === 0 || t === 7 || t === 9) return "_"; // transitable limpio → papel
      if (t === 1 || t === 2 || t === 3 || t === 10 || t === 15 || t === 14) return "G"; // glifo negro
      if (t === 13 || t === 5) return "B"; // secreta / fuente → azul
      if (t === 6) return "X"; // trampa → roja
      if (t === 4) return "C"; // cofre → dorado
      if (t === 8) return "F"; // campo → púrpura
      return "?";
    };
    const out: string[] = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const a = actual(x, y), e = expected(F[y]![x]!.type);
        if (a !== e) out.push(`(${x},${y}) type=0x${F[y]![x]!.type.toString(16)} exp=${e} act=${a}`);
      }
    }
    return out;
  });
}

test("Doom F1: el canvas del picker casa celda-a-celda con dungeons.json (64/64)", async ({ page }) => {
  await boot(page);
  const m = await mismatches(page, 0);
  expect(m, `celdas descuadradas: ${m.join(" | ")}`).toEqual([]);
});

test("Doom F7: el canvas del picker casa celda-a-celda con dungeons.json (64/64)", async ({ page }) => {
  await boot(page);
  const m = await mismatches(page, 6);
  expect(m, `celdas descuadradas: ${m.join(" | ")}`).toEqual([]);
});
