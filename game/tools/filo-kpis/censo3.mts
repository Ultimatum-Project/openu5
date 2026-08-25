/**
 * CENSO 3 — BÚSQUEDA EXHAUSTIVA de cromo aprovechable. Para cada estado, recorre el
 * canvas 320×200 ENTERO de la piel alojada y publica:
 *
 *   · `runs`  — todas las tiras HORIZONTALES de blanco de ≥100 px (dónde y cuánto), que
 *               es lo único de lo que se puede sacar por `drawImage` el filo de 122 px
 *               que le falta a la columna izquierda;
 *   · `exacto`— las filas cuyo tramo x=191..319 es EXACTAMENTE el dibujo del filo
 *               (122 blancos + 7 azules).
 *
 * Es el control que decide si la TERCERA VÍA existe o no: si en el estado peor no hay
 * NI UNA tira de 122 px de blanco, no hay cromo real que copiar y la vía honesta se
 * acaba ahí (fabricar píxeles está prohibido por doctrina).
 *
 *   U5_PORT=5241 npx tsx tools/filo-kpis/censo3.mts > /tmp/censo3.json
 */
import { chromium, type Browser, type Page } from "@playwright/test";

const BASE = `http://localhost:${process.env.U5_PORT ?? "5241"}`;

interface Hallazgo {
  runs: [number, number, number][]; // [y, x0, largo]
  exacto: number[];
  histActivo: boolean;
}

async function escanear(page: Page): Promise<Hallazgo> {
  return page.evaluate(() => {
    const src = document.querySelector<HTMLCanvasElement>(".portrait-skin-src canvas")!;
    const g = src.getContext("2d", { willReadFrequently: true })!;
    const W = 320;
    const H = 200;
    const d = g.getImageData(0, 0, W, H).data;
    // Sin funciones con NOMBRE aquí: `tsx` las envuelve en `__name(...)` (esbuild
    // keepNames) y ese helper no existe dentro de la página. Todo inline.
    const esBlanco = new Uint8Array(W * H);
    const esAzul = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const o = i * 4;
      esBlanco[i] = d[o]! > 200 && d[o + 1]! > 200 && d[o + 2]! > 200 ? 1 : 0;
      esAzul[i] = d[o + 2]! > 100 && d[o]! < 100 ? 1 : 0;
    }
    const runs: [number, number, number][] = [];
    for (let y = 0; y < H; y++) {
      let x = 0;
      while (x < W) {
        if (esBlanco[y * W + x] === 0) {
          x++;
          continue;
        }
        const x0 = x;
        while (x < W && esBlanco[y * W + x] === 1) x++;
        if (x - x0 >= 100) runs.push([y, x0, x - x0]);
      }
    }
    const exacto: number[] = [];
    for (let y = 0; y < H; y++) {
      let ok = true;
      for (let i = 0; i < 122 && ok; i++) ok = esBlanco[y * W + 191 + i] === 1;
      for (let i = 122; i < 129 && ok; i++) ok = esAzul[y * W + 191 + i] === 1;
      if (ok) exacto.push(y);
    }
    // ¿Historial activo? Testigo POSICIONAL, no de píxel: el rótulo ►HISTORY/HISTORIAL◄
    // vive en la fila 10 (y80..87) del área de consola y ennegrece su centro; sin él esa
    // celda es azul de barra. Se mira en x=248 (centro de la consola).
    const o = (84 * W + 248) * 4;
    const histActivo = d[o]! < 30 && d[o + 1]! < 30 && d[o + 2]! < 30;
    return { runs, exacto, histActivo };
  });
}

async function press(page: Page, key: string, ms = 170): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(ms);
}

async function boot(browser: Browser, extra = ""): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.clear());
  await page.goto(
    `${BASE}/?skin=faithful&nointro&loc=0&x=60&y=60&hour=10&seed=7&lang=es` +
      `&reflow=cuadrado-force&deck=bloques${extra}`,
  );
  await page.waitForFunction(
    () =>
      (window as unknown as { __u5test?: { worldReady?: () => boolean } }).__u5test?.worldReady?.() ===
      true,
    undefined,
    { timeout: 25_000 },
  );
  await page.waitForTimeout(900);
  return page;
}

/** Ecos de sobra: el historial sólo se activa si hay MÁS de 12 renglones acumulados. */
async function sembrarEcos(page: Page, vueltas = 8): Promise<void> {
  for (let v = 0; v < vueltas; v++) {
    for (const k of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) await press(page, k, 60);
  }
}

async function rueda(page: Page): Promise<void> {
  const c = await page.evaluate(() => {
    const el = document.querySelector<HTMLCanvasElement>(".portrait-skin canvas");
    const b = el?.getBoundingClientRect();
    return b ? { l: b.left, t: b.top, w: b.width, h: b.height } : null;
  });
  if (!c) throw new Error("sin canvas del portrait");
  await page.mouse.move(c.l + c.w * 0.75, c.t + c.h - 40);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(400);
}

const out: Record<string, Hallazgo> = {};

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });

  {
    const page = await boot(browser);
    await sembrarEcos(page);
    out["mundo"] = await escanear(page);
    await rueda(page);
    out["mundo+hist"] = await escanear(page);
    await page.context().close();
  }

  for (const [nombre, pasos] of [
    ["ztats-ficha", 1],
    ["ztats-prov", 3],
    ["ztats-lista1", 4],
  ] as const) {
    const page = await boot(browser);
    await sembrarEcos(page);
    await press(page, "z");
    await press(page, "1");
    for (let i = 0; i < pasos - 1; i++) await press(page, "ArrowRight");
    out[nombre] = await escanear(page);
    await rueda(page);
    out[`${nombre}+hist`] = await escanear(page);
    await page.context().close();
  }

  {
    const page = await boot(browser);
    await sembrarEcos(page);
    await press(page, "r");
    await press(page, "1");
    out["ready-pick"] = await escanear(page);
    await rueda(page);
    out["ready-pick+hist"] = await escanear(page);
    await page.context().close();
  }

  {
    const page = await boot(browser, "&debug=1");
    await page.evaluate(() => {
      (
        window as unknown as { __u5debug: { enterDungeon: (n: number) => void } }
      ).__u5debug.enterDungeon(0);
    });
    await press(page, "ArrowUp", 500);
    await sembrarEcos(page, 12);
    out["mazmorra"] = await escanear(page);
    await rueda(page);
    out["mazmorra+hist"] = await escanear(page);
    await page.context().close();
  }

  {
    const page = await boot(browser);
    await page.evaluate(() => {
      (
        window as unknown as { __u5test: { game: { overworldEnemies: { enemies: unknown[] } } } }
      ).__u5test.game.overworldEnemies.enemies.push({
        defIndex: 0,
        tile: 0x94,
        water: false,
        x: 61,
        y: 60,
      });
    });
    await press(page, "a");
    await press(page, "ArrowRight", 700);
    await sembrarEcos(page, 10);
    out["combate"] = await escanear(page);
    await rueda(page);
    out["combate+hist"] = await escanear(page);
    await page.context().close();
  }

  await browser.close();
  console.log(JSON.stringify(out));
}
void main();
