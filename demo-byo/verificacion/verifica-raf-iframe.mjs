/**
 * ¿DÓNDE PUEDE VIVIR EL IFRAME DE LA CAPTURA PARA QUE **LOS DOS MOTORES** LO PINTEN?
 *
 * Uso:  node demo-byo/verificacion/verifica-raf-iframe.mjs
 * Sale 0 si la receta que usa `momentos-instala.ts` cuenta fotogramas en chromium Y en
 * webkit; 1 si algún motor la suspende. Tarda ~15 s y no depende de ningún build.
 *
 * ── DE DÓNDE SALE (ficha #173, reporte del usuario desde su iPhone) ─────────────────────
 * La tarjeta de un momento legendario enseñaba «No salió — probar otra vez». La captura se
 * genera arrancando el juego en un iframe y el juego, antes de fotografiar, espera DOS
 * `requestAnimationFrame` (`game/src/main.ts`). Si el motor no ejecuta rAF en ese iframe, la
 * espera NO se resuelve jamás: ni captura, ni `postMessage`, vence el plazo de 20 s, se
 * reintenta, y el botón acaba diciendo que no salió. Sin error de consola y sin imagen
 * negra — por eso parece que el botón no hace nada.
 *
 * ── LO QUE MIDE, Y POR QUÉ LOS DOS MOTORES ─────────────────────────────────────────────
 * ★★ LA CURA DE UN MOTOR ES EL VENENO DEL OTRO. `visibility:hidden` se descartó porque
 * CHROMIUM suspende ahí el rAF; el remedio elegido fue sacar el iframe del viewport... y
 * eso es exactamente lo que suspende WEBKIT, que es el motor de TODO navegador en iOS.
 * Medido (fotogramas en 6 s):
 *
 *   | dónde está el iframe       | chromium | webkit |
 *   |----------------------------|---------:|-------:|
 *   | visible (CONTROL)          |      721 |    175 |
 *   | fuera de pantalla          |      721 |  **0** |
 *   | visibility:hidden          |      720 |    175 |
 *   | opacity:0 en viewport      |      720 |    175 |
 *   | detrás de una tapa opaca   |      720 |    175 |
 *   | jaula 1×1 (LA QUE SE USA)  |      721 |    174 |
 *
 * 🔴 EL IFRAME VISIBLE ES EL CONTROL Y NO SOBRA: sin él, un cero se leería como «el motor
 * suspende» cuando podría ser «la sonda no cuenta». Si el control da 0, no hay veredicto.
 *
 * 🔴 Y LOS NÚMEROS NO SE COMPARAN ENTRE MOTORES: webkit headless corre a ~30 Hz y chromium
 * a ~120. Lo que se asevera es CERO contra NO-CERO dentro de cada motor, nunca la cifra.
 */
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// La raíz se resuelve desde ESTE fichero, no de una variable de entorno: la sonda tiene que
// correr con un `node <ruta>` pelado desde cualquier directorio.
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { webkit, chromium } = createRequire(join(RAIZ, "package.json"))("playwright");

const HIJO = `<!doctype html><meta charset=utf-8><body><script>
let n = 0;
const tic = () => { n++; requestAnimationFrame(tic); };
requestAnimationFrame(tic);
setInterval(() => parent.postMessage({ quien: location.search.slice(1), frames: n }, "*"), 250);
</script>`;

/**
 * CANDIDATOS a «montado y pintando, pero invisible para quien mira», uno por iframe.
 * El juego necesita su caja de 960x600 (decide layout por tamaño), así que ninguno puede
 * encogerla: se esconde el CONTENEDOR, no el iframe.
 */
const PADRE = `<!doctype html><meta charset=utf-8><body style="margin:0">
<iframe id=vis src="/hijo?visible" style="width:200px;height:120px;border:0"></iframe>

<!-- 1. LO DE HOY: fuera del viewport por posición -->
<iframe src="/hijo?fuera" style="position:fixed;left:-10000px;top:0;width:960px;height:600px;border:0"></iframe>

<!-- 2. visibility:hidden (lo que se descartó por Chromium) -->
<iframe src="/hijo?oculto" style="position:fixed;left:0;top:0;width:960px;height:600px;border:0;visibility:hidden"></iframe>

<!-- 3. DENTRO del viewport, transparente -->
<iframe src="/hijo?opacidad" style="position:fixed;left:0;top:0;width:960px;height:600px;border:0;opacity:0;pointer-events:none"></iframe>

<!-- 4. DENTRO del viewport, DETRÁS de una tapa opaca -->
<div style="position:fixed;left:0;top:0;width:100vw;height:100vh;background:#000;z-index:5"></div>
<iframe src="/hijo?detras" style="position:fixed;left:0;top:0;width:960px;height:600px;border:0;z-index:1"></iframe>

<!-- 5. DENTRO del viewport, RECORTADO a 1x1 por el contenedor (el iframe sigue 960x600) -->
<div style="position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;z-index:0">
  <iframe src="/hijo?recortado" style="width:960px;height:600px;border:0"></iframe>
</div>

<!-- 6. DENTRO del viewport pero con opacity casi nula (por si opacity:0 se optimiza) -->
<iframe src="/hijo?casinula" style="position:fixed;left:0;top:0;width:960px;height:600px;border:0;opacity:0.005;pointer-events:none;z-index:2"></iframe>
<!-- 7. LA RECETA EXACTA QUE SE IMPLEMENTA: jaula 1x1 overflow:hidden + opacity:0 + z-index:-1 -->
<div style="position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1">
  <iframe src="/hijo?jaula" style="width:960px;height:600px;border:0;pointer-events:none"></iframe>
</div>
<script>
window.__f = {};
addEventListener("message", (e) => { if (e.data && e.data.quien) window.__f[e.data.quien] = e.data.frames; });
</script>`;

const server = createServer((req, res) => {
  const r = new URL(req.url, "http://x").pathname;
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(r === "/hijo" ? HIJO : PADRE);
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const BASE = `http://127.0.0.1:${server.address().port}`;

const salida = [];
for (const [nombre, motor] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const b = await motor.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const p = await ctx.newPage();
    await p.goto(BASE);
    await p.waitForTimeout(6000); // ~360 fotogramas a 60 Hz si el motor no suspende
    const f = await p.evaluate(() => window.__f);
    salida.push({ motor: nombre, frames: f });
    process.stderr.write(`${nombre}: ${JSON.stringify(f)}\n`);
    await ctx.close();
  } finally {
    await b.close();
  }
}
server.close();

// ── VEREDICTO ──────────────────────────────────────────────────────────────────────────
// `jaula` es la receta que implementa `momentos-instala.ts`. Se exige que cuente fotogramas
// en los dos motores, y que el CONTROL visible también los cuente (si no, la sonda miente).
const fallos = [];
for (const { motor, frames } of salida) {
  if (!frames.visible) fallos.push(`${motor}: el CONTROL visible da 0 — la sonda no mide`);
  else if (!frames.jaula) fallos.push(`${motor}: la jaula de la captura NO recibe rAF`);
}
process.stdout.write(JSON.stringify(salida, null, 2) + "\n");
if (fallos.length) {
  console.error("FALLOS:\n - " + fallos.join("\n - "));
  process.exit(1);
}
console.error("TODO OK — la jaula recibe rAF en chromium y en webkit");
