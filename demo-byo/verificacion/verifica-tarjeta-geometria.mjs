/**
 * GEOMETRÍA de la tarjeta de «Tus partidas» en `/byo`, EN LOS DOS MOTORES.
 *
 * Ficha #241 (reporte del usuario del 13-08, escritorio): la columna del texto se estrechaba
 * a una o dos palabras por línea y los chips se metían DEBAJO de «Continuar»/«Descargar».
 *
 * ── QUÉ MIDE, Y POR QUÉ ESTAS TRES MAGNITUDES ──────────────────────────────────────────
 * 1. `columnaMuerta` — el ancho de la pista `media` del grid MENOS lo que ocupan sus hijos
 *    (anchos + huecos). Es la magnitud que separa a los dos motores, y la que da la causa:
 *    `.guardado__media > *` fija `flex: 0 0 var(--u5-thumb)`, los dos motores PINTAN los
 *    hijos a esa medida, pero al dimensionar la pista `auto` WebKit saca la contribución
 *    max-content del ítem flex del tamaño NATURAL del `<img>`/`<canvas>` de dentro en vez de
 *    acotarla a la basis fija. Sobra columna, y lo que sobra se lo quita al texto.
 * 2. `infoAncho` — con una captura de 960 px la columna `minmax(0, 1fr)` del texto llegó a
 *    medir CERO en WebKit. Cero es el caso límite; el del usuario es el intermedio.
 * 3. `solapesChipAccion` — el SÍNTOMA que el usuario fotografió. Va aparte de (1) y (2)
 *    porque es lo único que él podía ver, y porque las tres pueden romperse por separado.
 *
 * 🔴 EL PAR QUE SE CAREA SON LOS CHIPS Y LA CAJA DE ACCIONES, NO LAS DOS COLUMNAS. Mi primer
 * predicado careaba la caja de `.guardado__info` contra la de `.guardado__acciones` y daba
 * «sin solape» ENCIMA DEL CASO ROTO: con la columna del texto a cero, las dos cajas no se
 * tocan — lo que desborda son los chips, que se salen de una columna de ancho cero. Un
 * predicado sobre el par equivocado da verde sobre el defecto ya fotografiado.
 *
 * ── POR QUÉ LOS DOS MOTORES, Y POR QUÉ EL ANCHO DE LA CAPTURA ES UN EJE ─────────────────
 * Con Chromium solo, este fichero sería verde con el defecto puesto: en Chromium las tres
 * magnitudes son idénticas antes y después del arreglo. Y con una captura de 320 px sola,
 * WebKit sólo desperdicia 35 px —feo pero no roto—; el caso que colapsa la columna del texto
 * necesita una captura ANCHA. Las dos son alcanzables: `esCapturaCanonica`
 * (`game/src/core/png-dims.ts`) acepta cualquier tamaño con proporción 320/200, y la
 * regeneración de miniaturas de /byo monta el juego en un iframe de 960×600
 * (`demo-byo/src/momentos-instala.ts:223`).
 *
 * ── EL MUTANTE, Y POR QUÉ SE APLICA A LA REGLA VIVA ────────────────────────────────────
 * `--mutante=sinWidth` le quita el `width` a la regla `.guardado__media > *` DEL PROPIO
 * DOCUMENTO (CSSOM), no a una copia del CSS escrita aquí: lo que se muta es la hoja que se
 * envía al navegador. Si el selector se renombra, el mutante ABORTA en vez de no aplicarse —
 * un mutante que no se aplica corre el código intacto, sale verde, y se lee como «el mutante
 * murió»: un control sin dientes que encima parece más fuerte que ninguno.
 *
 * ── LO QUE ESTE FICHERO **NO** MIDE ────────────────────────────────────────────────────
 * · No mide el aspecto, sólo rectángulos. Quien mire el estilo es el ojo humano sobre las
 *   capturas que deja en `U5_SHOTS`.
 * · No mide el TELÉFONO: por debajo de 33rem la tarjeta pasa a una columna y las tres
 *   magnitudes dejan de tener sentido (no hay pista `media` que compita con nada). El
 *   régimen de este fichero es ESCRITORIO, y por eso los viewports empiezan en 1280.
 * · 🔴 En WebKit la franja sale con UN medio y en Chromium con DOS: el minimapa no se pinta
 *   bajo WebKit en este arnés. MECANISMO MEDIDO (ficha #242, 17-08): en playwright-webkit
 *   sobre `http://localhost` la **Cache Storage NO SOBREVIVE al reload** (sonda mínima:
 *   `cache.put` → `reload` → `cache.match` = undefined; en Chromium sobrevive) — así que la
 *   extracción sembrada se esfuma en el reload de este arnés, `hasExtraction()` da false y
 *   la tarjeta pierde minimapa y «Continuar». localStorage SÍ persiste, por eso queda la
 *   captura (UN medio). La atribución que vivió aquí hasta el 17-08 —«el fetch de
 *   /momentos/momentos.json muere con access control checks»— quedó REFUTADA por sonda: ese
 *   fetch responde 200 con catálogo entero en webkit local Y en producción (10/10), y la
 *   cola del minimapa ni pasa por él (partidas→minimapa.js→Cache Storage). Es una carencia
 *   DEL ARNÉS (motor de playwright + origen http), no del producto — https://openu5.org es
 *   contexto seguro. Por eso ninguna aserción compara motores entre sí: las tres
 *   magnitudes son INTERNAS a cada caso (columna contra sus propios hijos), así que valen
 *   con uno o con dos. El recuento viaja en `hijosMedia` para que la asimetría se VEA en el
 *   JSON y nadie la descubra como sorpresa.
 *
 * Uso (desde la raíz del worktree, tras `npx vite build demo-byo`):
 *   node demo-byo/verificacion/verifica-tarjeta-geometria.mjs            # JSON a stdout
 *   node demo-byo/verificacion/verifica-tarjeta-geometria.mjs --mutante=sinWidth
 *
 * 🔴 PUERTO EFÍMERO (`listen(0)`), NO UN NÚMERO FIJO — y no es una preferencia: es el arreglo
 * que la ficha #5 ya dio a esta misma clase en `verify-byo-runtime.mjs`, citado en el
 * CLAUDE.md. Con un puerto fijo, este fichero entra en la batería y CHOCA con el carril que
 * tenga ese número (me pasó al estrenarlo: EADDRINUSE en el 5261, de otro carril). Un puerto
 * fijo sólo tiene dos finales —abortar la corrida ajena o abortar la propia—, y ninguno hace
 * falta si nadie reclama un número. `U5_GEOM_PORT=` lo fuerza para depurar a mano; entonces
 * sí aborta si está ocupado, porque pedir uno concreto y que te lo den es la única forma de
 * saber que estás mirando el tuyo. Jamás el 5199 (es del usuario).
 */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

// 🔴 Anclado a ESTE fichero, no al cwd: un `resolve()` sobre un argumento relativo mediría
// el árbol de quien lo lanzó y no el del worktree que lo contiene.
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIST = join(RAIZ, "demo-byo/dist");
/** 0 = puerto EFÍMERO, que es el default. Ver la cabecera: el número fijo es sólo para depurar. */
const PORT_PEDIDO = Number(process.env.U5_GEOM_PORT || 0);
const SHOTS = process.env.U5_SHOTS || join(tmpdir(), `u5-geom-tarjeta-${basename(RAIZ)}`);
const MUTANTE = (process.argv.find((a) => a.startsWith("--mutante=")) || "").split("=")[1] || null;

/** Los CUATRO casos. Escritorio siempre; el ancho de captura es el eje que discrimina. */
const VIEWPORTS = [1280, 1440];
const CAPTURAS = [320, 960];
const MOTORES = ["chromium", "webkit"];

/** El selector cuya regla decide el ancho de la franja. Si cambia, el mutante aborta. */
const SELECTOR_FRANJA = ".guardado__media > *";

mkdirSync(SHOTS, { recursive: true });
if (!existsSync(DIST)) {
  console.error(`No existe ${DIST}. Corre antes:  npx vite build demo-byo`);
  process.exit(1);
}

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".mp4": "video/mp4", ".webm": "video/webm",
};
const server = createServer((req, res) => {
  const ruta = decodeURIComponent((req.url || "/").split("?")[0]);
  const f = join(DIST, ruta === "/" ? "byo.html" : ruta);
  if (!f.startsWith(DIST) || !existsSync(f)) { res.writeHead(404); return res.end("no"); }
  res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" });
  res.end(readFileSync(f));
});
await new Promise((ok, ko) => { server.on("error", ko); server.listen(PORT_PEDIDO, ok); });
/** El puerto REAL, leído del socket. Con `listen(0)` sólo se sabe después de escuchar. */
const PORT = server.address().port;

const playwright = createRequire(resolve(RAIZ, "package.json"))("playwright");

/**
 * SIEMBRA el régimen del reporte dentro de la página: extracción en caché (sin ella no hay
 * minimapa ni «Continuar» — `partidas.ts:327`) + una partida con captura y posición.
 *
 * Nada de aquí sale del juego de EA: el sobremundo es una isla sintética y la miniatura, dos
 * rectángulos de color con la PROPORCIÓN que importa (320/200). Lo que decide la geometría es
 * el TAMAÑO natural del PNG, no lo que se ve dentro.
 */
async function siembra(page, anchoCaptura) {
  return page.evaluate(async (ancho) => {
    const cache = await caches.open("u5-assets-v1"); // nombre de extractor/src/browser.ts
    const json = (o) => new Response(JSON.stringify(o), { headers: { "content-type": "application/json" } });
    await cache.put("/assets/manifest.json", json({}));
    const rej = [];
    for (let y = 0; y < 256; y++) {
      const fila = [];
      for (let x = 0; x < 256; x++) fila.push(Math.hypot(x - 78, y - 41) < 60 ? 4 : 1);
      rej.push(fila);
    }
    await cache.put("/assets/maps/overworld.json", json(rej));
    await cache.put("/assets/data.json", json({ locationsX: [], locationsY: [] }));

    const cv = document.createElement("canvas");
    cv.width = ancho;
    cv.height = Math.round((ancho * 200) / 320);
    const g = cv.getContext("2d");
    g.fillStyle = "#0b1020"; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = "#1e5b2a"; g.fillRect(4, 4, cv.width / 2, cv.height - 8);
    const png = cv.toDataURL("image/png");

    const id = "geom-241";
    // Forma del índice: `SaveMeta[]` (game/src/core/save-keys.ts:73 readSaveIndex).
    localStorage.setItem("u5clone:saves", JSON.stringify([
      { id, name: "Imported save", timestamp: 1755080000000, turns: 255, locationName: "" },
    ]));
    localStorage.setItem("u5clone:save:" + id, JSON.stringify({
      characters: "ABCDEFGHIJKLMNOP".split("").map((n, i) => ({
        name: n, status: "G", partyStatus: i < 3 ? 0 : 0xff,
      })),
      gold: 7849, karma: 0,
      position: { location: 0, floor: 0, x: 78, y: 41 },
      time: { year: 139, month: 5, day: 5, hour: 10, minute: 53 },
      lbArtifacts: {}, shards: {}, specialItems: {},
    }));
    localStorage.setItem("u5clone:shot:" + id, png);
    return { pngBytes: png.length };
  }, anchoCaptura);
}

/** Aplica el mutante a la regla VIVA. Devuelve qué encontró; aborta si no la encuentra. */
async function muta(page, selector) {
  const r = await page.evaluate((sel) => {
    let vistas = 0;
    for (const hoja of document.styleSheets) {
      let reglas;
      try { reglas = hoja.cssRules; } catch { continue; } // hoja de otro origen
      for (const regla of reglas) {
        if (regla.selectorText === sel) {
          vistas++;
          regla.style.removeProperty("width");
        }
      }
    }
    return { vistas };
  }, selector);
  if (r.vistas === 0) {
    console.error(
      `MUTANTE ABORTADO: no hay ninguna regla con selector \`${selector}\` en el documento.\n` +
      "Si la regla se renombró, este mutante habría corrido el CSS intacto y salido verde — " +
      "que se lee como «el mutante murió». Actualiza SELECTOR_FRANJA antes de seguir.",
    );
    process.exit(2);
  }
  return r;
}

/** Los rectángulos y las tres magnitudes, leídos de la tarjeta ya pintada. */
const MIDE = () => {
  const li = document.querySelector("#partidas .guardado--tarjeta");
  if (!li) return { error: "no hay tarjeta de partida en #partidas" };
  const media = li.querySelector(".guardado__media");
  const info = li.querySelector(".guardado__info");
  const acc = li.querySelector(".guardado__acciones") || li.querySelector(".guardado__accion");
  if (!media || !info || !acc) return { error: "falta media/info/acciones en la tarjeta" };

  const R = (e) => {
    const b = e.getBoundingClientRect();
    return { x: +b.x.toFixed(2), y: +b.y.toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2) };
  };
  const solapa = (a, b) => {
    const A = a.getBoundingClientRect(), B = b.getBoundingClientRect();
    const w = Math.min(A.right, B.right) - Math.max(A.left, B.left);
    const h = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
    return w > 0.5 && h > 0.5 ? { w: +w.toFixed(2), h: +h.toFixed(2) } : null;
  };

  const hijos = [...media.children];
  const gap = parseFloat(getComputedStyle(media).columnGap) || 0;
  const ocupado = hijos.reduce((s, c) => s + c.getBoundingClientRect().width, 0)
    + gap * Math.max(0, hijos.length - 1);

  const chips = [...li.querySelectorAll(".guardado__chips > *")];
  const solapes = chips
    .map((c) => ({ texto: c.textContent.trim().slice(0, 24), solape: solapa(c, acc) }))
    .filter((x) => x.solape !== null);

  return {
    viewport: window.innerWidth,
    thumb: getComputedStyle(media).getPropertyValue("--u5-thumb").trim(),
    display: getComputedStyle(li).display,
    columnas: getComputedStyle(li).gridTemplateColumns,
    areas: getComputedStyle(li).gridTemplateAreas,
    tarjeta: R(li),
    mediaRect: R(media),
    infoRect: R(info),
    accionRect: R(acc),
    // Las tres magnitudes del encabezado.
    columnaMuerta: +(media.getBoundingClientRect().width - ocupado).toFixed(2),
    infoAncho: +info.getBoundingClientRect().width.toFixed(2),
    solapesChipAccion: solapes,
    // Controles de NO-VACUIDAD: sin población, cualquier invariante pasa en vacío.
    hijosMedia: hijos.map((c) => ({
      clase: c.className,
      ancho: +c.getBoundingClientRect().width.toFixed(2),
      flexBasis: getComputedStyle(c).flexBasis,
      width: getComputedStyle(c).width,
    })),
    chipsTotal: chips.length,
    // Los rectángulos EN CRUDO para que quien juzgue pueda derivar el desbordamiento sin
    // fiarse de un booleano precocinado aquí: si el aserto y su dato salen del mismo cálculo,
    // no hay careo posible. El pytest los cruza contra `infoRect`.
    chipsRect: chips.map((c) => ({ texto: c.textContent.trim().slice(0, 24), ...R(c) })),
    capturaNatural: (() => {
      const i = li.querySelector("img.guardado__foto");
      return i ? [i.naturalWidth, i.naturalHeight] : null;
    })(),
    desbordaHorizontal: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
};

const obs = { mutante: MUTANTE, puerto: PORT, capturas: SHOTS, casos: {} };

for (const nombre of MOTORES) {
  const browser = await playwright[nombre].launch();
  try {
    for (const captura of CAPTURAS) {
      const ctx = await browser.newContext({ viewport: { width: VIEWPORTS[0], height: 1000 } });
      const page = await ctx.newPage();
      await page.goto(`http://localhost:${PORT}/byo.html`);
      await page.waitForTimeout(1200);
      await siembra(page, captura);
      for (const ancho of VIEWPORTS) {
        await page.setViewportSize({ width: ancho, height: 1000 });
        await page.reload();
        await page.waitForTimeout(2200);
        if (MUTANTE === "sinWidth") await muta(page, SELECTOR_FRANJA);
        // Un reflujo tras tocar la hoja: el rect de antes sería de un layout que ya no existe.
        await page.evaluate(() => document.body.getBoundingClientRect().width);
        const clave = `${nombre}-${captura}-${ancho}`;
        obs.casos[clave] = await page.evaluate(MIDE);
        const sec = page.locator("#partidas");
        await sec.screenshot({ path: join(SHOTS, `${clave}${MUTANTE ? "-" + MUTANTE : ""}.png`) })
          .catch(() => {});
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}

server.close();
process.stdout.write(JSON.stringify(obs, null, 1));
