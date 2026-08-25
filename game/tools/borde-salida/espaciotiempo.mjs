/**
 * DIAGRAMA ESPACIO-TIEMPO del viewport durante un paso: una scanline por fotograma de rAF,
 * apiladas hacia abajo (cada una repetida N px de alto). Un deslizamiento suave dibuja
 * DIAGONALES continuas; un salto, un ESCALÓN; algo anclado, una VERTICAL.
 *
 * Uso: node tools/borde-salida/espaciotiempo.mjs "<params>" <tecla> <destino.png> [fila-en-celdas]
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const PORT = process.env.U5_PORT ?? "5205";
const params = process.argv[2] ?? "skin=shader&nointro&loc=0&x=76&y=40&hour=10";
const key = process.argv[3] ?? "ArrowRight";
const dest = process.argv[4] ?? "/tmp/u5-espaciotiempo.png";
const ROWCELL = Number(process.argv[5] ?? 2.5); // fila del viewport en unidades de celda
const FRAMES = Number(process.env.FRAMES ?? 20);
const VERT = process.env.VERT === "1"; // paso vertical → scanline VERTICAL (columna)

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
  ({ frames, rowcell, vert }) => {
    const canvas = document.querySelector(".shader-skin canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const S = Math.round(canvas.width / 320);
    const wr = { x: 8 * S, y: 8 * S, size: 176 * S };
    const cell = 16 * S;
    const off = Math.floor(rowcell * cell);
    window.__st = { S, cell, wr, lines: [], ts: [], done: false };
    const grab = () =>
      vert
        ? ctx.getImageData(wr.x + off, wr.y, 1, wr.size)
        : ctx.getImageData(wr.x, wr.y + off, wr.size, 1);
    let n = 0;
    const tick = () => {
      window.__st.lines.push(grab());
      window.__st.ts.push(performance.now());
      if (++n < frames) requestAnimationFrame(tick);
      else window.__st.done = true;
    };
    requestAnimationFrame(tick);
  },
  { frames: FRAMES, rowcell: ROWCELL, vert: VERT },
);
await page.keyboard.press(key);
await page.waitForFunction(() => window.__st.done === true, undefined, { timeout: 10_000 });
const posAfter = await page.evaluate(() => window.__u5test.state().position);

const png = await page.evaluate((vert) => {
  const { lines, cell, wr } = window.__st;
  const L = wr.size;
  const ROWH = 10;
  const c = document.createElement("canvas");
  c.width = L;
  c.height = lines.length * ROWH;
  const g = c.getContext("2d");
  const tmp = document.createElement("canvas");
  if (vert) {
    tmp.width = 1;
    tmp.height = L;
  } else {
    tmp.width = L;
    tmp.height = 1;
  }
  const tg = tmp.getContext("2d");
  lines.forEach((img, i) => {
    tg.putImageData(img, 0, 0);
    g.save();
    if (vert) {
      // gira la columna a fila
      g.translate(0, i * ROWH);
      g.scale(1, ROWH);
      g.rotate(0);
      g.drawImage(tmp, 0, 0, 1, L, 0, 0, L, 1); // no rota: reescala (columna→fila no lineal)
    } else {
      g.drawImage(tmp, 0, 0, L, 1, 0, i * ROWH, L, ROWH);
    }
    g.restore();
  });
  // rejilla de celdas cada `cell` px (línea magenta de 1 px)
  g.fillStyle = "rgba(255,0,255,0.6)";
  for (let x = 0; x <= L; x += cell) g.fillRect(x, 0, 1, c.height);
  // Zooms ×4 de los 3 primeros y los 3 últimos cellos (bordes de salida/entrada).
  const zoom = (x0, w) => {
    const z = document.createElement("canvas");
    z.width = w * 4;
    z.height = c.height * 2;
    const zg = z.getContext("2d");
    zg.imageSmoothingEnabled = false;
    zg.drawImage(c, x0, 0, w, c.height, 0, 0, z.width, z.height);
    return z.toDataURL("image/png");
  };
  return {
    full: c.toDataURL("image/png"),
    izq: zoom(0, cell * 3),
    der: zoom(L - cell * 3, cell * 3),
  };
}, VERT);

writeFileSync(dest, Buffer.from(png.full.split(",")[1], "base64"));
writeFileSync(dest.replace(/\.png$/, "-izq.png"), Buffer.from(png.izq.split(",")[1], "base64"));
writeFileSync(dest.replace(/\.png$/, "-der.png"), Buffer.from(png.der.split(",")[1], "base64"));
const ts = await page.evaluate(() => window.__st.ts.map((t, i, a) => Math.round(t - a[0])));
console.log(JSON.stringify({ posBefore, posAfter, ts, errs, dest }));
await browser.close();
