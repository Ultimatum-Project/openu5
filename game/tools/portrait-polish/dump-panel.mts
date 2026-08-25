/**
 * CENSO de la columna del PANEL en la FUENTE (320×200 de la piel alojada): vuelca las
 * filas 0..103 de x=191..319 en ASCII para localizar los FILOS de las dos sub-cajas
 * (jugadores y comida/oro/fecha) sin adivinarlos — y en los ESTADOS que re-dibujan esa
 * columna (Ztats de ficha y Ztats de LISTA, que ocupa las filas de celda 1..10 y por
 * tanto invade la costura).
 *
 *   U5_PORT=5231 npx tsx tools/portrait-polish/dump-panel.mts [estado]
 *   estados: mundo (defecto) · ztats · lista · combate
 */
import { chromium, type Page } from "@playwright/test";

const BASE = `http://localhost:${process.env.U5_PORT ?? "5231"}`;
const ESTADO = process.argv[2] ?? "mundo";

async function press(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(160);
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.clear());
  await page.goto(
    `${BASE}/?skin=faithful&nointro&loc=0&x=60&y=60&hour=10&seed=7&lang=es&reflow=cuadrado-force&deck=bloques`,
  );
  await page.waitForFunction(
    () =>
      (
        window as unknown as { __u5test?: { worldReady?: () => boolean } }
      ).__u5test?.worldReady?.() === true,
    undefined,
    { timeout: 25_000 },
  );
  await page.waitForTimeout(900);
  if (ESTADO === "ztats") {
    await press(page, "z");
    await press(page, "1");
  } else if (ESTADO === "lista") {
    await press(page, "z");
    // Páginas de LISTA (0xd..0x10): se llega paginando con las flechas desde la ficha.
    await press(page, "1");
    for (let i = 0; i < 13; i++) await press(page, "ArrowRight");
  }
  const rows = await page.evaluate(() => {
    const src = document.querySelector<HTMLCanvasElement>(".portrait-skin-src canvas")!;
    const g = src.getContext("2d")!;
    const d = g.getImageData(191, 0, 129, 104).data;
    const out: string[] = [];
    for (let y = 0; y < 104; y++) {
      let s = "";
      for (let x = 0; x < 129; x++) {
        const o = (y * 129 + x) * 4;
        const r = d[o]!;
        const gg = d[o + 1]!;
        const b = d[o + 2]!;
        s +=
          r > 200 && gg > 200 && b > 200 ? "#"
          : r < 30 && gg < 30 && b < 30 ? "."
          : b > 100 && r < 100 ? "B"
          : "?";
      }
      out.push(`${String(y).padStart(3)} ${s}`);
    }
    return out;
  });
  console.log(`--- estado: ${ESTADO} ---`);
  console.log(rows.join("\n"));
  await browser.close();
}
void main();
