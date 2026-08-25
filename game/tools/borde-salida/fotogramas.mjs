/**
 * FOTOGRAMAS del viewport durante un paso, montados en una tira horizontal (a mitad de
 * escala) para verlos de un vistazo. Emite además el índice y el instante de cada uno.
 *
 * Uso: node fotogramas.mjs "<params>" <tecla> <destino.png> [indices separados por coma]
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const PORT = process.env.U5_PORT ?? "5205";
const params = process.argv[2];
const key = process.argv[3] ?? "ArrowRight";
const dest = process.argv[4] ?? "/tmp/u5-fotogramas.png";
const FRAMES = Number(process.env.FRAMES ?? 14);

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

await page.evaluate((frames) => {
  const canvas = document.querySelector(".shader-skin canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const S = Math.round(canvas.width / 320);
  const wr = { x: 8 * S, y: 8 * S, size: 176 * S };
  window.__f = { S, wr, imgs: [], ts: [], done: false };
  let n = 0;
  const tick = () => {
    window.__f.imgs.push(ctx.getImageData(wr.x, wr.y, wr.size, wr.size));
    window.__f.ts.push(performance.now());
    if (++n < frames) requestAnimationFrame(tick);
    else window.__f.done = true;
  };
  requestAnimationFrame(tick);
}, FRAMES);
await page.keyboard.press(key);
await page.waitForFunction(() => window.__f.done === true, undefined, { timeout: 10_000 });
const posAfter = await page.evaluate(() => window.__u5test.state().position);

const png = await page.evaluate(() => {
  const { imgs, wr } = window.__f;
  const half = wr.size / 2;
  const c = document.createElement("canvas");
  c.width = (half + 6) * imgs.length;
  c.height = half;
  const g = c.getContext("2d");
  g.fillStyle = "#ff00ff";
  g.fillRect(0, 0, c.width, c.height);
  g.imageSmoothingEnabled = false;
  const tmp = document.createElement("canvas");
  tmp.width = wr.size;
  tmp.height = wr.size;
  const tg = tmp.getContext("2d");
  imgs.forEach((img, i) => {
    tg.putImageData(img, 0, 0);
    g.drawImage(tmp, 0, 0, wr.size, wr.size, i * (half + 6), 0, half, half);
  });
  return c.toDataURL("image/png");
});
writeFileSync(dest, Buffer.from(png.split(",")[1], "base64"));
const ts = await page.evaluate(() => window.__f.ts.map((t, i, a) => Math.round(t - a[0])));
console.log(JSON.stringify({ posBefore, posAfter, ts, errs, dest }));
await browser.close();
