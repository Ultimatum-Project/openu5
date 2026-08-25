/**
 * SONDA DE NAVEGADOR de la puerta de versión de la extracción (#293).
 *
 * Uso:  node demo-byo/verificacion/verifica-extraccion-vieja.mjs [--capturas <dir>]
 *
 * Emite observaciones en JSON por stdout. Quien asevera es `re/tools/test_extraccion_vieja.py`
 * (mismo contrato que el resto de arneses de este directorio: aquí no se asevera nada, para
 * que la sonda no pueda aprobarse a sí misma).
 *
 * ── POR QUÉ HACE FALTA UN NAVEGADOR DE VERDAD ────────────────────────────────────────
 * La guarda de vitest (`game/tests/extraccion-vigente.test.ts`) prueba el predicado con un
 * DOBLE de Cache Storage, porque jsdom no la trae. Eso deja sin comprobar justo la parte
 * que el defecto de #293 vive: que las claves REALES de una caché real —URL absolutas que
 * pone el navegador, no las que escribe el doble— se leen bien, y que `caches.has` sobre
 * una caché que nunca se abrió dice que no en vez de crearla. Aquí se siembra una caché de
 * verdad y se mira el aviso EN LA PÁGINA.
 *
 * ── LA COPIA ES SINTÉTICA ────────────────────────────────────────────────────────────
 * No hay ni un byte de EA: las entradas de la caché son respuestas de una línea con el
 * NOMBRE del asset dentro. Lo que se mide es qué RUTAS hay, no qué contienen — que es
 * exactamente lo que mira la puerta.
 *
 * ── LOS TRES ESCENARIOS, Y POR QUÉ LOS TRES ─────────────────────────────────────────
 *   vieja    → caché con todos los exigidos MENOS shrine-scene.json  ⇒ aviso nombrándolo
 *   completa → caché con todos los exigidos                          ⇒ SIN aviso
 *   servida  → SIN caché (el flujo de staging/dev)                   ⇒ SIN aviso
 * El tercero es el control que separa «tu extracción es vieja» de «aquí no hay extracción»:
 * sin él, un predicado que sólo cuente ausencias acusaría al 100 % del catálogo a quien
 * juega con los assets del servidor.
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..");

const args = process.argv.slice(2);
const capturasDir = args.includes("--capturas") ? args[args.indexOf("--capturas") + 1] : null;
/**
 * `--modulo <ruta>` empaqueta OTRA copia de `game/src/web/extraccion.ts` (los mutantes del
 * pytest). Lo que se muta así es EL MÓDULO DE PRODUCCIÓN, no una reimplementación paralela
 * dentro de la sonda que podría divergir de él sin que nadie se enterase. La copia se hace
 * conservando `game/src/web/` + `extractor/src/` para que su import relativo del catálogo
 * siga resolviendo — y así ningún mutante escribe en el árbol del carril.
 */
const moduloArg = args.includes("--modulo") ? args[args.indexOf("--modulo") + 1] : null;

const obs = { escenarios: {}, errores: [] };

/** Empaqueta el módulo de la puerta (TS + su import del catálogo) a un ESM de una pieza. */
async function empaqueta() {
  const esbuild = await import("esbuild");
  const dir = mkdtempSync(join(tmpdir(), "u5-puerta-"));
  await esbuild.build({
    entryPoints: [moduloArg ?? join(RAIZ, "game", "src", "web", "extraccion.ts")],
    bundle: true,
    format: "esm",
    platform: "browser",
    outfile: join(dir, "extraccion.js"),
    logLevel: "silent",
  });
  writeFileSync(
    join(dir, "prueba.html"),
    `<!doctype html><meta charset="utf-8"><title>puerta #293</title>
<body style="margin:0;background:#101014;color:#ccc;font:14px system-ui">
<div style="padding:24px">Pantalla del juego (marcador de posición de la sonda).</div>
<script type="module">
  import * as puerta from "./extraccion.js";
  window.__puerta = puerta;
</script>`,
  );
  return dir;
}

function levanta(dir) {
  const tipos = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
  const server = createServer((req, res) => {
    const ruta = new URL(req.url, "http://x").pathname;
    const nombre = ruta === "/" ? "/prueba.html" : ruta;
    try {
      const cuerpo = readFileSync(join(dir, nombre.slice(1)));
      const ext = nombre.slice(nombre.lastIndexOf("."));
      res.writeHead(200, { "Content-Type": tipos[ext] ?? "application/octet-stream" });
      res.end(cuerpo);
    } catch {
      // 404 DE VERDAD (el sitio público da un soft-404 con la home, #63; aquí no hace
      // falta imitarlo: la puerta no mira respuestas, mira claves de caché).
      res.writeHead(404).end("no");
    }
  });
  // listen(0) = puerto EFÍMERO: este árbol corre con varias baterías a la vez y un puerto
  // fijo es una colisión esperando (ficha #5).
  return new Promise((res) => server.listen(0, "127.0.0.1", () => res(server)));
}

/**
 * Siembra la caché con `rutas` y devuelve lo que la puerta hace en esa página.
 * Cada escenario va en un CONTEXTO propio: el almacén de cachés es por origen+perfil, y
 * reutilizar el contexto haría que el escenario «sin caché» heredase la del anterior —
 * el control se volvería vacuo sin fallar.
 */
async function corre(navegador, url, { rutas, sembrarCache }) {
  const contexto = await navegador.newContext();
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on("pageerror", (e) => errores.push(String(e)));
  await pagina.goto(url, { waitUntil: "load" });
  if (sembrarCache) {
    await pagina.evaluate(async (lista) => {
      const cache = await caches.open("u5-assets-v1");
      for (const ruta of lista) {
        await cache.put(new Request(`/assets/${ruta}`), new Response(`asset ${ruta}`));
      }
    }, rutas);
  }
  const salida = await pagina.evaluate(async () => {
    const d = await window.__puerta.avisaSiLaExtraccionEsVieja({
      win: window,
      doc: document,
      idioma: "es",
    });
    const caja = document.getElementById(window.__puerta.ID_AVISO);
    const enlace = caja?.querySelector("a");
    return {
      esExtraccionDelVisitante: d.esExtraccionDelVisitante,
      faltan: d.faltan,
      avisoVisible: Boolean(caja),
      textoAviso: caja ? (caja.textContent ?? "") : null,
      enlaceHref: enlace ? enlace.getAttribute("href") : null,
      enlaceTarget: enlace ? enlace.getAttribute("target") : null,
      // Cuántas cachés hay: distingue «no había» de «la creó al preguntar» (open() crea).
      caches: await caches.keys(),
    };
  });
  return { pagina, contexto, salida, errores };
}

const dir = await empaqueta();
const server = await levanta(dir);
const url = `http://127.0.0.1:${server.address().port}/prueba.html`;
const { chromium } = await import(join(RAIZ, "node_modules", "playwright", "index.mjs"));
const navegador = await chromium.launch();

try {
  // La lista de exigidos sale del PROPIO catálogo empaquetado: si mañana entra un asset
  // nuevo, esta sonda lo siembra sola. Una lista a mano aquí sería la foto que #293
  // existe para no volver a tener.
  const contextoTmp = await navegador.newContext();
  const paginaTmp = await contextoTmp.newPage();
  await paginaTmp.goto(url, { waitUntil: "load" });
  const exigidos = await paginaTmp.evaluate(() => window.__puerta.ASSETS_EXIGIDOS);
  await contextoTmp.close();
  obs.exigidos = exigidos.length;

  const casos = {
    vieja: { rutas: exigidos.filter((r) => r !== "shrine-scene.json"), sembrarCache: true },
    completa: { rutas: exigidos, sembrarCache: true },
    servida: { rutas: [], sembrarCache: false },
  };
  for (const [nombre, caso] of Object.entries(casos)) {
    const { pagina, contexto, salida, errores } = await corre(navegador, url, caso);
    obs.escenarios[nombre] = salida;
    obs.errores.push(...errores.map((e) => `${nombre}: ${e}`));
    if (capturasDir && nombre === "vieja") {
      mkdirSync(capturasDir, { recursive: true });
      await pagina.screenshot({ path: join(capturasDir, "aviso-extraccion-vieja.png") });
    }
    await contexto.close();
  }
} finally {
  await navegador.close();
  server.close();
}

console.log(JSON.stringify(obs, null, 2));
