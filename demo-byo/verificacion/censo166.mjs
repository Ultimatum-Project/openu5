/**
 * CENSO DE LA FICHA #166 — ¿qué tapa el panel de consentimiento en la PRIMERA VISITA?
 *
 * Uso:  node censo166.mjs <dir-del-sitio> <dir-de-salida>
 *
 * Mide, para CADA página que carga el panel × {390×844, 1280×800}, con almacenamiento
 * VIRGEN (primera visita de verdad: contexto nuevo, sin `openu5-consentimiento`):
 *   · el rectángulo del panel y qué fracción del viewport ocupa
 *   · qué elementos de CONTENIDO quedan detrás de él CON LA PÁGINA ARRIBA DEL TODO
 *   · captura PNG de cada combinación
 *
 * 🔴 DOS CAUTELAS DE INSTRUMENTO, las dos aprendidas en este repo:
 *  (1) El panel sólo se monta si hay ALGO QUE CONSENTIR (clave de analítica no vacía). Un
 *      sitio construido sin clave da CERO tapados y el censo saldría vacío diciendo que no
 *      hay problema. Por eso el sitio se construye con clave de mentira ANTES de medir, y
 *      aquí se ABORTA si el panel no aparece en alguna página.
 *  (2) «Tapado» se mide con la página EN SCROLL 0 — que es lo que ve quien llega. La ficha
 *      #124 ya garantizó que todo es ALCANZABLE desplazando; esta ficha pregunta otra cosa:
 *      qué se ve al llegar. Son dos preguntas distintas sobre el mismo panel.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// 🔴 LAS RUTAS RELATIVAS SE ANCLAN AL ÁRBOL DEL ARNÉS, NO AL `cwd`. Con `resolve()` pelado
// una ruta relativa se resuelve contra el directorio DESDE EL QUE SE LANZÓ: el 11-08 este
// censo escribió sus PNG en la RAÍZ DEL CHECKOUT PRINCIPAL del usuario porque se invocó con
// `cwd` allí. No es un fallo cosmético — un `<dir-del-sitio>` relativo habría medido el
// sitio construido de OTRO árbol, y el resultado (un censo con pinta perfecta) no lleva
// encima ninguna marca de contra qué midió. Por eso además del anclaje, la procedencia
// MEDIDA viaja en el JSON (`_procedencia`): el lector sabe qué árbol se fotografió sin
// tener que creerse la línea de órdenes de quien lo corrió.
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SITIO = resolve(RAIZ, process.argv[2]);
const SALIDA = resolve(RAIZ, process.argv[3]);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json",
  ".woff2": "font/woff2", ".webp": "image/webp", ".jpg": "image/jpeg", ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8" };

const PAGINAS = [
  "index.html", "verificacion.html",
  "mejoras/index.html", "mejoras/1-imagen.html", "mejoras/2-layouts.html", "mejoras/3-experiencia.html",
  "en/improvements/index.html", "en/improvements/1-imagen.html",
  "en/improvements/2-layouts.html", "en/improvements/3-experiencia.html",
];
const VIEWPORTS = [
  { nombre: "movil-390x844", width: 390, height: 844 },
  { nombre: "escritorio-1280x800", width: 1280, height: 800 },
];

const servidor = createServer(async (req, res) => {
  let ruta = decodeURIComponent(req.url.split("?")[0]);
  if (ruta.endsWith("/")) ruta += "index.html";
  const f = join(SITIO, ruta);
  if (!existsSync(f)) { res.writeHead(404); res.end("no"); return; }
  try {
    const cuerpo = await readFile(f);
    res.writeHead(200, { "content-type": MIME[extname(f)] ?? "application/octet-stream" });
    res.end(cuerpo);
  } catch { res.writeHead(500); res.end("err"); }
});
await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
const PUERTO = servidor.address().port;

await mkdir(SALIDA, { recursive: true });
const navegador = await chromium.launch();
const filas = [];

for (const vp of VIEWPORTS) {
  for (const pag of PAGINAS) {
    // Contexto NUEVO por medición = primera visita real (localStorage vacío).
    const ctx = await navegador.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PUERTO}/${pag}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);

    const obs = await page.evaluate(() => {
      const panel = document.getElementById("openu5-consentimiento");
      const r = panel ? panel.getBoundingClientRect() : null;
      const vh = window.innerHeight, vw = window.innerWidth;
      // Candidatos de CONTENIDO: lo que un visitante viene a ver o a pulsar.
      const sel = "main h1, main h2, main p, main a, main button, .hero, header nav a," +
                  " a.cta, .u5-btn, .hero__cta, main li";
      const nodos = [...document.querySelectorAll(sel)];
      const dentro = (x) => x.top < vh && x.bottom > 0 && x.left < vw && x.right > 0 &&
                            x.width > 0 && x.height > 0;
      const solapa = (a, b) => Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) *
                               Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const visibles = [], tapados = [];
      for (const n of nodos) {
        const x = n.getBoundingClientRect();
        if (!dentro(x)) continue;
        const areaVisible = (Math.min(x.bottom, vh) - Math.max(x.top, 0)) *
                            (Math.min(x.right, vw) - Math.max(x.left, 0));
        if (areaVisible <= 0) continue;
        const et = `${n.tagName.toLowerCase()}${n.className ? "." + String(n.className).split(/\s+/)[0] : ""}` +
                   `: ${(n.textContent || "").trim().slice(0, 48)}`;
        visibles.push(et);
        if (r) {
          const cubierto = solapa(x, r) / areaVisible;
          if (cubierto > 0.5) tapados.push({ et, cubierto: +cubierto.toFixed(2) });
        }
      }
      return {
        panelPresente: !!panel,
        panelRect: r ? { top: +r.top.toFixed(0), height: +r.height.toFixed(0) } : null,
        fraccionViewport: r ? +(r.height / vh).toFixed(3) : 0,
        alturaViewport: vh,
        // Alto TOTAL del documento y cuánto de él queda por encima del panel al llegar.
        visiblesArriba: visibles.length,
        tapados,
        h1: (document.querySelector("main h1, h1")?.textContent || "").trim().slice(0, 60),
      };
    });

    const png = join(SALIDA, `${vp.nombre}__${pag.replace(/[/.]/g, "_")}.png`);
    await page.screenshot({ path: png });
    filas.push({ pagina: pag, viewport: vp.nombre, ...obs, captura: png });
    await ctx.close();
  }
}
await navegador.close();
servidor.close();

// CONTROL DE NO-VACUIDAD: si el panel no se montó en ninguna página, el censo no mide nada.
const conPanel = filas.filter((f) => f.panelPresente).length;
if (conPanel === 0) {
  console.error("ABORTA: el panel no apareció en NINGUNA de las " + filas.length +
    " mediciones. Casi seguro que el sitio se construyó SIN clave de analítica: un censo a " +
    "cero aquí significa «no veo», no «no hay».");
  process.exit(2);
}
// LA PROCEDENCIA VIAJA CON EL DATO. `sitio` es la ruta ABSOLUTA que se fotografió y `sha` el
// commit del árbol que la produjo: sin esto, dos censos del mismo formato son indistinguibles
// aunque midan ramas distintas, y el lector no tiene con qué desmentir al que se los entrega.
const { execFileSync } = await import("node:child_process");
const sha = (() => {
  try {
    return execFileSync("git", ["-C", RAIZ, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch { return "(sin git)"; }
})();
// El censo mantiene su forma de ARRAY (los ficheros ya publicados en docs/verdicts la
// tienen, y cambiarla obligaría a re-emitir el «antes», que es un dato bueno de un árbol que
// ya no existe). La procedencia va en un fichero HERMANO — y lleva el sha1 DEL CONTENIDO del
// censo, no sólo la hora: un lateral que sólo comparta el instante prueba simultaneidad, no
// correspondencia, y aquí lo que hay que poder comprobar es que esta procedencia es de ESE
// censo y no del de al lado.
const texto = JSON.stringify(filas, null, 2);
const { createHash } = await import("node:crypto");
const procedencia = {
  sitio: SITIO, arbol: RAIZ, sha, puerto: PUERTO,
  cuando: new Date().toISOString(),
  mediciones: filas.length,
  sha1DelCenso: createHash("sha1").update(texto).digest("hex"),
};
await writeFile(join(SALIDA, "censo166.json"), texto);
await writeFile(join(SALIDA, "censo166-procedencia.json"), JSON.stringify(procedencia, null, 2));
console.log(JSON.stringify({ conPanel, ...procedencia }, null, 2));
