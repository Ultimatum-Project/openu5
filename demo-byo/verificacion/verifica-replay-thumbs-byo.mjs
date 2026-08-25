/**
 * MINIATURAS DE REPETICIÓN en la SEGUNDA superficie: la lista «Repeticiones» de `/byo`.
 *
 * La sonda hermana (`game/tools/verify-replay-thumbs.mjs`) cubre la lista del JUEGO (F10),
 * que es donde se GRABA. Ésta cubre donde se MIRA desde fuera, que es otra pantalla, con
 * otro CSS y otro helper de fila — y por tanto otro sitio donde el caso degradado puede
 * salir mal.
 *
 * 🔴 SE SIEMBRA A MANO Y NO SE JUEGA: en `/byo` no hay juego con el que grabar. Se
 * escriben dos repeticiones en IndexedDB (una CON miniatura y otra SIN) y se pinta la
 * lista, que es exactamente el inventario que tiene delante quien ya jugó.
 *
 * 🔴 Y SE SIEMBRA LA EXTRACCIÓN, que no es un adorno del montaje: sin ella `hayCopia` es
 * falso y la sección cae a su rama SIN ACCIÓN — otra rama, otro `<li>`. La que ve un
 * visitante normal es la de CON copia, y es la que hay que mirar. Se falsifica poniendo
 * el `manifest.json` en la Cache Storage, que es literalmente lo que `hasExtraction()`
 * comprueba (`extractor/src/browser.ts:241`).
 *
 * 🔴 Depende del BUILD de la landing (`npx vite build demo-byo`) ⇒ NO va en la batería.
 *
 * Uso (desde la raíz del worktree):
 *   npx vite build demo-byo
 *   PORT=5244 node demo-byo/verificacion/verifica-replay-thumbs-byo.mjs
 */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIST = join(RAIZ, "demo-byo/dist");
/**
 * 🔴 LAS CAPTURAS SALEN DEL REPO, y no es manía: un fotograma del juego son PÍXELES
 * RENDERIZADOS de EA y `docs/` es un árbol TRACKED (comprobado: `docs/verdicts/` no
 * está en .gitignore, así que un `git add -A` se las llevaría). El destino va al
 * temporal del sistema y lleva el NOMBRE DEL WORKTREE dentro: dos carriles corriendo
 * esta sonda a la vez escribirían en la misma carpeta y el segundo pisaría la evidencia
 * del primero. Se cambia con `U5_SHOTS=<dir>` cuando se quiera mirar en otro sitio.
 */
const SHOTS = process.env.U5_SHOTS || join(tmpdir(), `u5-verdicts-replay-thumbs-${basename(RAIZ)}`);
const PORT = Number(process.env.PORT || 5244);
mkdirSync(SHOTS, { recursive: true });
if (!existsSync(DIST)) {
  console.error(`No existe ${DIST}. Corre antes:  npx vite build demo-byo`);
  process.exit(1);
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = createServer((req, res) => {
  const ruta = decodeURIComponent((req.url || "/").split("?")[0]);
  const f = join(DIST, ruta === "/" ? "byo.html" : ruta);
  if (!f.startsWith(DIST) || !existsSync(f)) { res.writeHead(404); return res.end("no"); }
  res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" });
  res.end(readFileSync(f));
});
// Puerto PROPIO y explícito (REGLA 3): si está ocupado, ABORTA — no se le roba a nadie.
await new Promise((ok, ko) => { server.on("error", ko); server.listen(PORT, ok); });

const { chromium } = createRequire(resolve(RAIZ, "package.json"))("playwright");
const fallos = [];
const ok = (cond, etiqueta, visto) => {
  console.log(`${cond ? "  OK  " : "  FALLO"} ${etiqueta}${cond ? "" : `\n         visto: ${JSON.stringify(visto)}`}`);
  if (!cond) fallos.push(etiqueta);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(e.message));

/**
 * Una miniatura SINTÉTICA — 320x200 con dos bandas de color, dibujada en el propio
 * navegador. NO es un fotograma del juego: esta sonda vive en el repo y un fotograma de
 * EA no puede acabar en un fichero tracked ni en un artefacto que se comparta. Para lo
 * que se comprueba aquí —que la fila pinta la imagen y la caja mide lo que debe— un
 * dibujo sintético de la MISMA geometría vale igual, y no arrastra material ajeno.
 */
const MINI = `data:image/png;base64,${"x"}`; // se reemplaza abajo, dibujada en la página

await page.goto(`http://localhost:${PORT}/byo.html`);
await page.waitForTimeout(1500);

const sembrado = await page.evaluate(async () => {
  // 1. La EXTRACCIÓN (Cache Storage) — sin esto la lista cae a la rama sin acción.
  // Nombres COPIADOS de `extractor/src/browser.ts` (BYO_CACHE / ASSETS_PREFIX), no
  // inventados: con otros, `hasExtraction()` diría que no hay copia y la sonda mediría
  // la rama degradada creyendo medir la buena.
  const cache = await caches.open("u5-assets-v1");
  await cache.put("/assets/manifest.json", new Response("{}", { headers: { "content-type": "application/json" } }));

  // 2. Miniatura sintética 320x200, dibujada aquí (ver la cabecera: nada de EA).
  const cv = document.createElement("canvas");
  cv.width = 320; cv.height = 200;
  const g = cv.getContext("2d");
  g.fillStyle = "#123"; g.fillRect(0, 0, 320, 200);
  g.fillStyle = "#c84"; g.fillRect(0, 0, 200, 200);
  g.fillStyle = "#eee"; g.font = "20px monospace"; g.fillText("MINIATURA", 210, 100);
  const png = cv.toDataURL("image/png");

  // 2-bis. EL TESTIGO LEGADO (ficha #174), 1170x1696 — el teléfono ENTERO, que es lo que
  // guardaba el productor antes de #153 desde un móvil partido. Va aquí y no en un test
  // aparte porque para REPETICIONES no existe re-captura (`ui/shot-refresh.ts` sólo toca
  // `core/save-keys`, y sus dos llamadores están en `game/src/main.ts`): esa miniatura no
  // converge sola, así que la lista real de alguien la sigue teniendo hoy y la tarjeta
  // tiene que saber enseñarla. Sin este testigo el fichero medía SÓLO el caso 320x200, y
  // ahí `cover` y `contain` dan el MISMO rectángulo — o sea que no distinguía el defecto
  // del arreglo (`el-testigo-elegido-hace-pasar-al-aserto-con-el-codigo-roto`).
  const cvL = document.createElement("canvas");
  cvL.width = 1170; cvL.height = 1696;
  const gL = cvL.getContext("2d");
  gL.fillStyle = "#123"; gL.fillRect(0, 0, 1170, 1696);
  // Franjas en el BORDE SUPERIOR e INFERIOR: son justo las que `cover` tira, así que su
  // presencia en la caja es el testigo de que no se recortó.
  gL.fillStyle = "#c84"; gL.fillRect(0, 0, 1170, 160);
  gL.fillStyle = "#4c8"; gL.fillRect(0, 1536, 1170, 160);
  const pngLegado = cvL.toDataURL("image/png");

  // 3. Dos repeticiones: la primera CON foto, la segunda SIN.
  const log = (id, label, createdAt) => ({
    v: 1, id, label, createdAt,
    anchor: { state: JSON.stringify({ turnsSinceStart: 0 }), seed: 1 },
    keys: "aaaa", turns: "bbbb", mods: "", count: 4, lastTurn: 4,
  });
  await new Promise((res, rej) => {
    const r = indexedDB.open("u5-replay", 2);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("logs")) db.createObjectStore("logs", { keyPath: "id" }).createIndex("createdAt", "createdAt");
      if (!db.objectStoreNames.contains("thumbs")) db.createObjectStore("thumbs", { keyPath: "id" });
    };
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction(["logs", "thumbs"], "readwrite");
      tx.objectStore("logs").put(log("con-foto", "Camino a Britain", 1754900000000));
      tx.objectStore("logs").put(log("sin-foto", "Partida de antes (sin foto)", 1754800000000));
      tx.objectStore("logs").put(log("legado", "Grabada en el movil de antes", 1754700000000));
      tx.objectStore("thumbs").put({ id: "con-foto", png });
      tx.objectStore("thumbs").put({ id: "legado", png: pngLegado });
      tx.oncomplete = () => { db.close(); res(); };
      tx.onerror = () => { db.close(); rej(tx.error); };
    };
    r.onerror = () => rej(r.error);
  });
  return { pngBytes: png.length };
});
console.log(`     sembrado: miniatura sintética de ${(sembrado.pngBytes / 1024).toFixed(1)} KB de dataURL`);

await page.reload();
await page.waitForTimeout(2500);
await page.locator("#partidas .guardados").last().scrollIntoViewIfNeeded().catch(() => {});
await page.waitForTimeout(800);

console.log("\n══ /byo · la lista de Repeticiones ══");
const conFoto = await page.locator('[data-testid="replay-shot"]').count();
const sinFoto = await page.locator('[data-testid="replay-shot-vacia"]').count();
ok(conFoto === 2, "dos filas llevan IMAGEN (la nativa y la LEGADA de #174)", conFoto);
ok(sinFoto === 1, "la otra lleva el HUECO ROTULADO", sinFoto);
const rotulo = await page.locator('[data-testid="replay-shot-vacia"]').first().textContent().catch(() => null);
ok(!!rotulo && rotulo.trim().length > 0, "el hueco lleva rótulo", rotulo);
// CONTROL de no-vacuidad: la fila con foto tiene que tener DELANTE una imagen de verdad,
// no un <img> roto. Se mide el tamaño natural que el navegador decodificó.
const decodifica = await page.evaluate(() => {
  const img = document.querySelector('[data-testid="replay-shot"]');
  return img ? { nw: img.naturalWidth, nh: img.naturalHeight, completa: img.complete } : null;
});
ok(decodifica && decodifica.completa && decodifica.nw === 320 && decodifica.nh === 200,
  "la imagen DECODIFICA de verdad (320x200) — no es un <img> roto", decodifica);
const cajas = await page.evaluate(() => {
  const a = document.querySelector('[data-testid="replay-shot"]')?.getBoundingClientRect();
  const b = document.querySelector('[data-testid="replay-shot-vacia"]')?.getBoundingClientRect();
  return a && b ? { foto: [Math.round(a.width), Math.round(a.height)], hueco: [Math.round(b.width), Math.round(b.height)] } : null;
});
ok(cajas && cajas.foto[0] === cajas.hueco[0] && cajas.foto[1] === cajas.hueco[1],
  "foto y hueco MIDEN LO MISMO (la lista mixta no se descuadra)", cajas);
// ── #174 · LA MINIATURA LEGADA SE VE ENTERA, NO RECORTADA ────────────────────────────────
// 🔴 EL CASO QUE FALTABA. Este fichero medía sólo el 320x200, y para una imagen con la MISMA
// proporción que la caja `cover` y `contain` dan el idéntico rectángulo: el testigo elegido
// hacía pasar el aserto con el defecto puesto. El testigo legado (1170x1696) es el único que
// instancia la diferencia.
// Se mide la GEOMETRÍA, que es lo que decide qué píxeles sobreviven: con `contain` la imagen
// se escala por el lado que primero topa y el alto pintado cabe entero en la caja; con
// `cover` el alto pintado la DESBORDA y lo que sobra se tira. El número que lo dice es
// `alto_pintado <= alto_caja` — verdadero con contain, falso con cover (1696*112/1170 = 162
// px de alto pintado para una caja de 70).
const legada = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('[data-testid="replay-shot"]')];
  const img = imgs.find((i) => i.naturalHeight > i.naturalWidth);
  if (!img) return null;
  const r = img.getBoundingClientRect();
  const escalaContain = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
  const escalaCover = Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight);
  const e = getComputedStyle(img).objectFit === "contain" ? escalaContain : escalaCover;
  return {
    natural: [img.naturalWidth, img.naturalHeight],
    caja: [Math.round(r.width), Math.round(r.height)],
    pintado: [Math.round(img.naturalWidth * e), Math.round(img.naturalHeight * e)],
    fit: getComputedStyle(img).objectFit,
  };
});
ok(legada !== null, "la miniatura LEGADA (más alta que ancha) está en la lista", legada);
ok(
  legada !== null &&
    legada.pintado[0] <= legada.caja[0] + 1 &&
    legada.pintado[1] <= legada.caja[1] + 1,
  "la miniatura LEGADA cabe ENTERA en su caja — no se recorta (ficha #174)",
  legada,
);
// La acción de la fila sigue siendo un ENLACE de verdad: la miniatura no se la ha comido.
const href = await page.locator('#partidas a.guardado__accion[href*="replay="]').first().getAttribute("href").catch(() => null);
ok(!!href && href.includes("replay="), "la fila conserva su enlace «ver repetición»", href);
ok(errores.length === 0, "sin errores de página", errores);

const sec = page.locator("#partidas");
await sec.screenshot({ path: `${SHOTS}/byo-escritorio.png` });
console.log(`     captura: ${SHOTS}/byo-escritorio.png`);

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(900);
await sec.screenshot({ path: `${SHOTS}/byo-movil.png` });
const desborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
ok(desborda === false, "en móvil la página NO desborda en horizontal", desborda);
console.log(`     captura: ${SHOTS}/byo-movil.png`);

await browser.close();
server.close();
console.log(`\n${fallos.length === 0 ? "TODO OK" : `${fallos.length} FALLOS:\n - ` + fallos.join("\n - ")}`);
process.exit(fallos.length === 0 ? 0 : 1);
