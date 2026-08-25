/**
 * SONDA DE NAVEGADOR del ENLACE COMPARTIDO y de la INSIGNIA «jugado», en Chromium real.
 *
 * Uso:  npx vite build demo-byo
 *       node demo-byo/verificacion/verifica-comparte-navegador.mjs [--capturas <dir>]
 *
 * Produce observaciones en JSON por stdout. Quien asevera es `re/tools/test_byo_comparte.py`.
 *
 * ── POR QUÉ NO BASTA EL ARNÉS DE NODE ───────────────────────────────────────────────────
 * Aquél mide la DECISIÓN (`decideLlegada`) y el PREDICADO (`insignias`), que son funciones
 * puras. Lo que no puede medir es el ENGANCHE: que llegar a la URL abra el modal de verdad,
 * que la tarjeta destacada sea la del enlace y no la primera, que sin extracción NO se abra un
 * modal y sí aparezca el aviso, y que el botón de copiar ponga en el portapapeles el enlace
 * que dice. Un `decideLlegada` impecable cableado al id equivocado pasaría el arnés entero.
 *
 * ── LA COPIA ES SINTÉTICA, Y ESO ES LO QUE LA METE EN LA BATERÍA ────────────────────────
 * `copia-sintetica.mjs`, igual que `verifica-momentos-navegador.mjs`: 16 registros con nombres
 * de una letra y una plantilla de 4192 ceros. Cero material de EA, así que corre en cualquier
 * worktree. Esta sonda NO siembra ningún momento (no hace falta para medir el enlace), así que
 * tampoco pide `/play.html` ni genera fotogramas.
 *
 * ── PUERTO EFÍMERO ──────────────────────────────────────────────────────────────────────
 * `listen(0)`: lo elige el sistema. Ni el 5199 del usuario ni un 52xx de otro carril.
 */
import { createServer } from "node:http";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { extname, join, resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { initSintetico, plantillaSintetica } from "./copia-sintetica.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIST = join(RAIZ, "demo-byo/dist");
const { chromium } = createRequire(join(RAIZ, "package.json"))("playwright");

const iCap = process.argv.indexOf("--capturas");
const CAPTURAS = iCap >= 0 ? process.argv[iCap + 1] : null;
if (CAPTURAS) mkdirSync(CAPTURAS, { recursive: true });

if (!existsSync(DIST)) {
  console.error(`No existe ${DIST}. Corre antes:  npx vite build demo-byo`);
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

const INIT = JSON.stringify(initSintetico());
const GAM = Buffer.from(plantillaSintetica());

const server = createServer((req, res) => {
  const ruta = new URL(req.url, "http://x").pathname;
  if (ruta === "/assets/initial-state.json") {
    res.writeHead(200, { "content-type": MIME[".json"] });
    return res.end(INIT);
  }
  if (ruta === "/assets/init.gam") {
    res.writeHead(200, { "content-type": "application/octet-stream" });
    return res.end(GAM);
  }
  const f = join(DIST, ruta === "/" ? "byo.html" : ruta.slice(1));
  if (!f.startsWith(DIST) || !existsSync(f)) {
    res.writeHead(404).end("no");
    return;
  }
  res.writeHead(200, { "content-type": MIME[extname(f)] ?? "application/octet-stream" });
  res.end(readFileSync(f));
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const obs = { consola: [], base: BASE };
const navegador = await chromium.launch();
try {
  const ctx = await navegador.newContext({ viewport: { width: 900, height: 1100 } });
  // Para poder LEER lo que el botón copió. `127.0.0.1` es contexto seguro, así que
  // `navigator.clipboard` existe; el permiso de lectura hay que concederlo igual.
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  const p = await ctx.newPage();
  p.on("console", (m) => {
    if (m.type() === "error") obs.consola.push(m.text().slice(0, 300));
  });
  p.on("pageerror", (e) => obs.consola.push(`pageerror: ${String(e).slice(0, 300)}`));

  // Decisión de consentimiento VÁLIDA (todo rechazado), sembrada ANTES de cada
  // navegación: desde el merge de analitica-embudo /byo pinta el panel de
  // consentimiento, y sin decisión el panel intercepta los clics de la sonda
  // («subtree intercepts pointer events» — 8 sondas rojas en la composición del
  // 09-08, verdes en el árbol de la rama porque allí el panel no existía).
  // Mismo valor y misma razón que verifica-momentos-navegador.mjs: un `{}`
  // pelado se lee como null (sin decidir) y el panel aparece igual. Va como
  // initScript y no como setItem suelto porque la sonda navega varias veces y
  // el caso de «Borrar datos locales» se lleva la clave (empieza por `openu5-`,
  // como debe): la siguiente navegación la vuelve a sembrar.
  await p.addInitScript(() => {
    localStorage.setItem(
      "openu5-consentimiento",
      '{"version":1,"analitica":false,"partida":false,"fecha":"2026-01-01T00:00:00.000Z"}',
    );
  });

  /** Siembra la marca de «hay extracción» que mira `hasExtraction()` (browser.ts:231). */
  const ponCopia = () =>
    p.evaluate(async () => {
      const c = await caches.open("u5-assets-v1");
      await c.put("/assets/manifest.json", new Response("{}"));
    });
  const quitaCopia = () => p.evaluate(() => caches.delete("u5-assets-v1"));
  /** ¿Hay un `<dialog>` de la galería abierto AHORA? */
  const modalAbierto = () => p.locator("dialog.momentos-modal[open]").count();
  /** El aviso del enlace, o `null` si no hay. */
  const aviso = async () =>
    (await p.locator(".momentos__enlace").count()) === 1
      ? (await p.locator(".momentos__enlace").textContent())?.trim()
      : null;

  // ══ 1 · SIN EXTRACCIÓN: no se abre modal, y se DICE por qué ═══════════════════════════
  // 🔴 El orden importa: este caso va PRIMERO porque es el estado natural de un navegador
  // recién llegado. Hacerlo después de sembrar la copia obligaría a borrarla, y un borrado a
  // medias daría el caso contrario sin avisar.
  await p.goto(`${BASE}/byo.html?momento=momento-03`);
  await p.waitForSelector(".momentos__abrir");
  await p.waitForFunction(() => document.querySelector(".momentos__enlace") !== null, null, {
    timeout: 15000,
  });
  obs.sinCopia = { modal: await modalAbierto(), aviso: await aviso() };
  if (CAPTURAS) await p.screenshot({ path: join(CAPTURAS, "01-sin-copia.png") });

  // ══ 2 · CON EXTRACCIÓN: el modal abre SOLO, en la tarjeta del enlace ══════════════════
  await ponCopia();
  await p.goto(`${BASE}/byo.html?momento=momento-03`);
  await p.waitForSelector("dialog.momentos-modal[open] .momento--destacado", { timeout: 15000 });
  obs.conCopia = {
    modal: await modalAbierto(),
    // Destacada UNA y sólo una, y es la TERCERA de la lista (el enlace pedía la 03).
    destacadas: await p.locator(".momento--destacado").count(),
    indiceDestacada: await p.evaluate(() => {
      const todas = [...document.querySelectorAll(".momentos-modal .momento")];
      return todas.findIndex((n) => n.classList.contains("momento--destacado"));
    }),
    tituloDestacado: (
      await p.locator(".momento--destacado .momento__titulo").textContent()
    )?.trim(),
    // 🔴 EL FOCO ESTÁ EN EL BOTÓN DE ESA TARJETA, no en el de cerrar ni en la primera. Es la
    // mitad accesible del enlace: quien llega por él y navega con teclado tiene la acción
    // bajo el dedo. Y es lo que distingue «destacar» de «destacar y dejarte buscándola».
    focoEsAnadirDestacado: await p.evaluate(
      () => document.activeElement?.closest(".momento")?.classList.contains("momento--destacado") === true
        && document.activeElement?.classList.contains("momento__anadir") === true,
    ),
    // Y NO se ha sembrado nada: el enlace ofrece, no instala.
    sembrados: await p.evaluate(() => localStorage.getItem("u5clone:saves")),
    aviso: await aviso(),
  };
  if (CAPTURAS) await p.screenshot({ path: join(CAPTURAS, "02-destacada.png") });

  // ══ 3 · ID DESCONOCIDO: aviso, sin modal ══════════════════════════════════════════════
  await p.goto(`${BASE}/byo.html?momento=momento-99`);
  await p.waitForSelector(".momentos__abrir");
  await p.waitForFunction(() => document.querySelector(".momentos__enlace") !== null, null, {
    timeout: 15000,
  });
  obs.desconocido = { modal: await modalAbierto(), aviso: await aviso() };

  // ══ 4 · SIN PARÁMETRO: la página se comporta como siempre ═════════════════════════════
  // El control negativo del aviso: sin él, un `.momentos__enlace` que saliera SIEMPRE pasaría
  // los tres casos de arriba y esta pantalla llevaría un cartel permanente.
  await p.goto(`${BASE}/byo.html`);
  await p.waitForSelector(".momentos__abrir");
  await p.waitForTimeout(500); // margen para que el catálogo llegue y el aviso saldría si fuera a salir
  obs.sinParametro = { modal: await modalAbierto(), aviso: await aviso() };

  // ══ 5 · «COPIAR ENLACE» pone en el portapapeles el enlace que dice ════════════════════
  await p.click(".momentos__abrir");
  await p.waitForSelector(".momentos-modal .momento");
  obs.botonesCopiar = await p.locator(".momento__copiar").count();
  await p.locator(".momento .momento__copiar").nth(4).click(); // la QUINTA tarjeta
  obs.copiado = {
    portapapeles: await p.evaluate(() => navigator.clipboard.readText()),
    rotulo: (await p.locator(".momento .momento__copiar").nth(4).textContent())?.trim(),
    // Los demás botones NO cambian de rótulo: la confirmación es de la tarjeta que se pulsó.
    rotuloVecino: (await p.locator(".momento .momento__copiar").nth(3).textContent())?.trim(),
  };
  if (CAPTURAS) await p.screenshot({ path: join(CAPTURAS, "03-copiado.png") });

  // ══ 6 · LA INSIGNIA «JUGADO» EN LA TARJETA ════════════════════════════════════════════
  // Se planta el estado que el predicado exige —una apertura y una partida posterior— y se
  // mira la galería. Es la mitad que el arnés de node no ve: que la marca llegue al DOM.
  await p.keyboard.press("Escape");
  obs.insigniasAntes = await p.locator(".momento__insignia").count();
  await p.evaluate(() => {
    localStorage.setItem("openu5-momentos-aperturas", JSON.stringify({ "momento-02": 1000 }));
    localStorage.setItem(
      "u5clone:saves",
      JSON.stringify([
        { id: "save-x", name: "P", timestamp: 2000, turns: 3, locationName: "L" },
      ]),
    );
  });
  await p.reload();
  await p.waitForSelector(".momentos__abrir");
  await p.click(".momentos__abrir");
  await p.waitForSelector(".momentos-modal .momento");
  obs.jugado = {
    insignias: await p.locator(".momento__insignia").count(),
    texto: (await p.locator(".momento__insignia").first().textContent())?.trim(),
    // En la SEGUNDA tarjeta, que es la del momento abierto — no en la primera ni en todas.
    indice: await p.evaluate(() => {
      const todas = [...document.querySelectorAll(".momentos-modal .momento")];
      return todas.findIndex((n) => n.querySelector(".momento__insignia"));
    }),
  };
  if (CAPTURAS) await p.screenshot({ path: join(CAPTURAS, "04-jugado.png") });

  // ══ 7 · Y EL BORRADO SE LLEVA LAS APERTURAS ═══════════════════════════════════════════
  // La promesa del botón «borrar» es que no queda nada. `clearAllSaves` barre `u5clone:`; la
  // clave de las aperturas es `u5:` y quedaría fuera si nadie la borrara a propósito.
  await p.keyboard.press("Escape");
  await p.click("#tus-datos button");
  // Hay partidas ⇒ sale la confirmación. Se pulsa el primer botón, que es el de confirmar.
  await p.waitForSelector("#tus-datos button");
  await p.locator("#tus-datos button").first().click();
  await p.waitForFunction(
    () => localStorage.getItem("u5clone:saves") === null,
    null,
    { timeout: 15000 },
  );
  obs.trasBorrarTodo = {
    aperturas: await p.evaluate(() => localStorage.getItem("openu5-momentos-aperturas")),
    saves: await p.evaluate(() => localStorage.getItem("u5clone:saves")),
  };
} finally {
  await navegador.close();
  server.close();
}

process.stdout.write(JSON.stringify(obs, null, 2));
