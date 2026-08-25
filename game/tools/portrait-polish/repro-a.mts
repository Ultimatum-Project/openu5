/**
 * SONDA DEL BUG A — «al activar el historial en portrait sale una línea arriba del
 * historial». Captura la banda con y sin historial, y extrae ADEMÁS la fila 10 del
 * canvas FUENTE (el 320×200 de la piel alojada) para poder carear pixel a pixel: si el
 * banner está limpio en la FUENTE y cortado en el COMPUESTO, el defecto es del
 * compositor del portrait, no del pintor de la fiel.
 *
 *   U5_PORT=5231 OUT=<dir> npx tsx tools/portrait-polish/repro-a.mts
 *
 * REGLAS DEL CARRIL: dev server PROPIO en 52xx (jamás el 5199 del usuario).
 */
import { chromium, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = `http://localhost:${process.env.U5_PORT ?? "5231"}`;
const OUT = process.env.OUT ?? "/tmp/portrait-polish-a";

/** Fila 10 del panel en la FUENTE (la costura: barra azul o banner ►HISTORY◄). */
async function seamRowPng(page: Page): Promise<string> {
  return page.evaluate(() => {
    const src = document.querySelector<HTMLCanvasElement>(".portrait-skin-src canvas");
    if (!src) return "";
    const c = document.createElement("canvas");
    c.width = 129;
    c.height = 8;
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 191, 80, 129, 8, 0, 0, 129, 8);
    return c.toDataURL("image/png").split(",")[1]!;
  });
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
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
  await page.waitForTimeout(800);
  for (const k of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press(k);
      await page.waitForTimeout(90);
    }
  }
  await page.waitForTimeout(400);

  const geo = await page.evaluate(() => {
    const p = (
      window as unknown as { __u5reflow?: { probe: () => Record<string, unknown> | null } }
    ).__u5reflow?.probe();
    const c = document.querySelector<HTMLCanvasElement>(".portrait-skin canvas");
    const b = c?.getBoundingClientRect();
    return { probe: p, canvas: b ? { l: b.left, t: b.top, w: b.width, h: b.height } : null };
  });
  writeFileSync(join(OUT, "probe.json"), JSON.stringify(geo, null, 2));

  await page.screenshot({ path: join(OUT, "A-antes.png") });
  writeFileSync(
    join(OUT, "A-antes-fuente-fila10.png"),
    Buffer.from(await seamRowPng(page), "base64"),
  );

  const c = geo.canvas!;
  await page.mouse.move(c.l + c.w * 0.75, c.t + c.h - 40);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, "B-historial.png") });
  writeFileSync(
    join(OUT, "B-historial-fuente-fila10.png"),
    Buffer.from(await seamRowPng(page), "base64"),
  );
  await browser.close();
  console.log(`capturas en ${OUT}`);
}
void main();
