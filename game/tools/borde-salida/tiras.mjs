/**
 * TIRAS por fotograma: recorta el borde de SALIDA y el de ENTRADA del viewport en cada
 * fotograma de rAF durante un paso y los monta en dos PNG (fotogramas en columna, tiempo
 * hacia abajo). Un deslizamiento suave se ve como una diagonal continua; un salto, como
 * un escalón.
 *
 * Uso: node tools/borde-salida/tiras.mjs "<params>" <tecla> <destino-sin-extension>
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const PORT = process.env.U5_PORT ?? "5205";
const params = process.argv[2] ?? "skin=shader&nointro&loc=0&x=76&y=40&hour=10";
const key = process.argv[3] ?? "ArrowRight";
const dest = process.argv[4] ?? "/tmp/u5-tiras";
const FRAMES = Number(process.env.FRAMES ?? 20);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.addInitScript(() => localStorage.clear());
await page.goto(`http://localhost:${PORT}/?${params}`);
await page.waitForFunction(() => window.__u5test?.worldReady?.() === true, undefined, { timeout: 30_000 });
await page.waitForSelector(".shader-skin canvas");
await page.waitForTimeout(1500);

const out = await page.evaluate(async (frames) => {
  const canvas = document.querySelector(".shader-skin canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const S = Math.round(canvas.width / 320);
  const wr = { x: 8 * S, y: 8 * S, size: 176 * S };
  const cell = 16 * S;
  const band = 2 * cell; // dos columnas de tiles
  const shots = [];
  const grab = () => ({
    t: performance.now(),
    left: ctx.getImageData(wr.x, wr.y, band, wr.size),
    right: ctx.getImageData(wr.x + wr.size - band, wr.y, band, wr.size),
  });
  const enc = (img) => {
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    c.getContext("2d").putImageData(img, 0, 0);
    return c;
  };
  window.__grab = grab;
  window.__enc = enc;
  window.__shots = shots;
  window.__meta = { S, cell, band, wr, frames };
  return { S, cell, band, size: wr.size };
}, FRAMES);

await page.evaluate(() => {
  const { frames } = window.__meta;
  window.__done = false;
  let n = 0;
  const tick = () => {
    window.__shots.push(window.__grab());
    if (++n < frames) requestAnimationFrame(tick);
    else window.__done = true;
  };
  requestAnimationFrame(tick);
});
await page.keyboard.press(key);
await page.waitForFunction(() => window.__done === true, undefined, { timeout: 10_000 });

const pngs = await page.evaluate(() => {
  const { band } = window.__meta;
  const shots = window.__shots;
  const H = shots[0].left.height;
  const mk = (side) => {
    const c = document.createElement("canvas");
    c.width = (band + 4) * shots.length;
    c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = "#ff00ff";
    g.fillRect(0, 0, c.width, c.height);
    shots.forEach((s, i) => g.putImageData(s[side], i * (band + 4), 0));
    return c.toDataURL("image/png");
  };
  return { left: mk("left"), right: mk("right"), ts: shots.map((s) => Math.round(s.t - shots[0].t)) };
});

writeFileSync(`${dest}-salida.png`, Buffer.from(pngs.left.split(",")[1], "base64"));
writeFileSync(`${dest}-entrada.png`, Buffer.from(pngs.right.split(",")[1], "base64"));
console.log(JSON.stringify({ ...out, ts: pngs.ts, errs, dest }));
await browser.close();
