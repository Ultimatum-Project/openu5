/**
 * PERFIL DE NEGRURA por celda de pantalla y fotograma.
 *
 * «Las tiles que se van ocultando no lo hacen suave» es una afirmación sobre cómo APARECE
 * el negro, no sobre cómo se desliza el terreno (eso ya se midió: desliza). Este instrumento
 * mide, por fotograma de rAF y por celda 11×11 del viewport, la FRACCIÓN de píxeles casi
 * negros. Un ocultamiento suave hace crecer esa fracción de forma continua a lo largo del
 * tween; un «pop» la lleva de ~0 a ~1 en UN fotograma.
 *
 * Salida JSON: { meta, ts, grid[frame][row][col] = fracción de negro }.
 */
import { chromium } from "playwright";

const PORT = process.env.U5_PORT ?? "5205";
const params = process.argv[2];
const key = process.argv[3] ?? "ArrowRight";
const FRAMES = Number(process.env.FRAMES ?? 14);
const THRESH = Number(process.env.THRESH ?? 24); // suma RGB por debajo = «negro»

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.addInitScript(() => localStorage.clear());
await page.goto(`http://localhost:${PORT}/?${params}`);
await page.waitForFunction(() => window.__u5test?.worldReady?.() === true, undefined, { timeout: 30_000 });
await page.waitForSelector(".shader-skin canvas");
await page.waitForTimeout(1500);
const posBefore = await page.evaluate(() => window.__u5test.state().position);

await page.evaluate(
  ({ frames, thresh }) => {
    const canvas = document.querySelector(".shader-skin canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const S = Math.round(canvas.width / 320);
    const wr = { x: 8 * S, y: 8 * S, size: 176 * S };
    const cell = 16 * S;
    const W = 11;
    window.__n = { S, cell, grid: [], ts: [], done: false };
    const measure = () => {
      const d = ctx.getImageData(wr.x, wr.y, wr.size, wr.size).data;
      const g = [];
      for (let r = 0; r < W; r++) {
        const row = [];
        for (let c = 0; c < W; c++) {
          let black = 0;
          for (let y = r * cell; y < (r + 1) * cell; y++) {
            const base = y * wr.size * 4;
            for (let x = c * cell; x < (c + 1) * cell; x++) {
              const i = base + x * 4;
              if (d[i] + d[i + 1] + d[i + 2] <= thresh) black++;
            }
          }
          row.push(black / (cell * cell));
        }
        g.push(row);
      }
      return g;
    };
    window.__measure = measure;
    let n = 0;
    const tick = () => {
      window.__n.grid.push(measure());
      window.__n.ts.push(performance.now());
      if (++n < frames) requestAnimationFrame(tick);
      else window.__n.done = true;
    };
    requestAnimationFrame(tick);
  },
  { frames: FRAMES, thresh: THRESH },
);
const pre = await page.evaluate(() => window.__measure()); // REPOSO previo (t=0 de verdad)
await page.keyboard.press(key);
await page.waitForFunction(() => window.__n.done === true, undefined, { timeout: 15_000 });
await page.waitForTimeout(500);
const settled = await page.evaluate(() => window.__measure());
const posAfter = await page.evaluate(() => window.__u5test.state().position);
const out = await page.evaluate(() => ({ grid: window.__n.grid, ts: window.__n.ts, cell: window.__n.cell }));
console.log(
  JSON.stringify({
    params,
    key,
    posBefore,
    posAfter,
    errs,
    cell: out.cell,
    ts: out.ts.map((t, i, a) => Math.round(t - a[0])),
    pre,
    grid: out.grid,
    settled,
  }),
);
await browser.close();
