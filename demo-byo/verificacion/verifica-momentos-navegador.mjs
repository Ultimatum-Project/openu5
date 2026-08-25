/**
 * SONDA DE NAVEGADOR de los momentos legendarios: el circuito ENTERO en un Chromium real.
 *
 * Uso:  npx vite build demo-byo
 *       node demo-byo/verificacion/verifica-momentos-navegador.mjs [--capturas <dir>]
 *
 * Produce observaciones en JSON por stdout. Quien asevera es `re/tools/test_byo_momentos.py`
 * (mismo contrato que el resto de arneses: aquí no se asevera nada, para que no pueda
 * aprobarse a sí mismo).
 *
 * ── POR QUÉ NO BASTA EL ARNÉS DE NODE ───────────────────────────────────────────────────
 * Aquél mide los BYTES. Esto mide lo que el visitante VE y TOCA: que el modal abra con las
 * diez tarjetas, que nueve digan «próximamente» y una tenga botón, que pulsarlo siembre la
 * partida, que la tarjeta salga con su insignia en la lista de detrás, y que «Añadido ✓»
 * siga ahí DESPUÉS DE RECARGAR. Esa última es la que exige un navegador de verdad: el estado
 * se lee del almacén en cada pintado, y sólo una recarga distingue eso de un booleano de
 * sesión que también se vería bien en la primera foto.
 *
 * ── LA COPIA ES SINTÉTICA, Y ESO ES LO QUE LA METE EN LA BATERÍA ────────────────────────
 * `copia-sintetica.mjs`: 16 registros con nombres de una letra y una plantilla de 4192 ceros.
 * Sin material de EA, la sonda corre en cualquier worktree — a diferencia de
 * `verifica-estados.mjs`, que depende de `original/u5` y por eso está fuera de la batería.
 * 🔴 Lo que esta sonda NO mide son los DATOS del momento (loc 13, 8:35, grupo de 3): ésos
 * salen de la copia de verdad y los mide el pytest contra `game/assets`. Ver el reparto de
 * alcance en la cabecera de `copia-sintetica.mjs`.
 *
 * ── PUERTO EFÍMERO ──────────────────────────────────────────────────────────────────────
 * `listen(0)`: el sistema elige. Ni el 5199 del usuario ni un 52xx que otro carril pueda
 * estar usando — misma decisión que `verify-byo-runtime.mjs` tras la ficha #5.
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
  // La copia SINTÉTICA del visitante, en el sitio donde la instalación la busca.
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

const obs = { consola: [] };
const navegador = await chromium.launch();
try {
  const ctx = await navegador.newContext({ viewport: { width: 900, height: 1100 } });
  const p = await ctx.newPage();
  // 🔴 LOS ERRORES DE CONSOLA SE REGISTRAN Y VIAJAN. Sin esto, un fallo del chunk de
  // instalación dejaría el botón en «Añadiendo…» y la sonda diría «no se sembró» sin decir
  // POR QUÉ — el mismo diagnóstico para un bug y para un import roto.
  p.on("console", (m) => {
    if (m.type() === "error") obs.consola.push(m.text().slice(0, 300));
  });
  p.on("pageerror", (e) => obs.consola.push(`pageerror: ${String(e).slice(0, 300)}`));
  // Los 404 con su URL. Aquí se ESPERA exactamente uno: esta sonda no sirve el juego (ver
  // cabecera), así que el generador del fotograma pide `/play.html` y no lo encuentra. Ese
  // fallo es justamente el caso que interesa medir — ver `shotFallido` abajo.
  obs.faltantes = [];
  p.on("response", (r) => {
    if (r.status() === 404) obs.faltantes.push(new URL(r.url()).pathname);
  });

  await p.goto(`${BASE}/byo.html`);
  // La extracción «existe»: `hasExtraction()` mira una entrada concreta de la Cache Storage
  // de este origen (`extractor/src/browser.ts:231`). Se siembra esa entrada y punto — el
  // resto de assets los sirve el servidor de arriba, así que no hace falta service worker.
  await p.evaluate(async () => {
    const c = await caches.open("u5-assets-v1");
    await c.put("/assets/manifest.json", new Response("{}"));
  });
  await p.reload();
  await p.waitForSelector(".momentos__abrir");

  // ── 1 · el modal abre con las diez tarjetas ──────────────────────────────────────────
  await p.click(".momentos__abrir");
  await p.waitForSelector(".momentos-modal .momento");
  obs.tarjetas = await p.locator(".momentos-modal .momento").count();
  obs.conBoton = await p.locator(".momento__anadir").count();
  obs.proximamente = await p.locator(".momento__estado").count();
  obs.primerTitulo = (await p.locator(".momento__titulo").first().textContent())?.trim();
  if (CAPTURAS) await p.screenshot({ path: join(CAPTURAS, "01-modal.png") });

  // ── 2 · añadir el momento 1 ──────────────────────────────────────────────────────────
  await p.click(".momento__anadir");
  // 🔴 EL PLAZO ES 90 s Y ANTES ERAN 30, y el motivo importa porque el que lo vea corto
  // pensará en un flake: esta sonda NO sirve `/play.html`, así que la captura recorre SIEMPRE
  // el camino de fallo, y desde que `generaShotDelMomento` reintenta ese camino cuesta DOS
  // presupuestos (2 × 20 s = 40 s) en vez de uno. Con 30 s la espera vencía antes que el
  // propio generador y la sonda moría en este punto — medido al introducir el reintento.
  // ⇒ El plazo de una sonda que mide un camino de fallo se deriva del presupuesto del código,
  // no se hereda de cuando el código tenía otro.
  //
  // NOMINAL MEDIDO de esta espera (#190, 13-08-2026, tres corridas de la sonda suelta con la
  // carga de la máquina anotada): 40 065 / 40 036 / 40 096 ms con load 7,4 / 10,3 / 8,8.
  // Contra el plazo de 90 000 ⇒ holgura 49,9 s = 124 % sobre el nominal, NO el 3 % que
  // circuló: aquel 3 % comparaba el WALL DEL FICHERO (87-97 s) con el plazo de ESTE selector,
  // dos magnitudes que no se tocan.
  // ★ Y el nominal no se mueve con la carga porque NO ES TRABAJO, SON DOS TEMPORIZADORES:
  // `INTENTOS_SHOT` (2) × `PRESUPUESTO_SHOT_MS` (20 000) de `momentos-instala.ts` = 40 000
  // exactos, y lo medido los excede en 36-96 ms. Un presupuesto vence a la misma velocidad
  // con la máquina vacía que con seis baterías encima ⇒ la contención NO puede estirar este
  // término. Quien vea aquí un rojo por plazo vencido, que NO lo adjudique a carga sin
  // explicar de dónde salen los 50 s que faltan.
  await p.waitForSelector(".momento__estado--hecho", { timeout: 90000 });
  obs.trasAnadir = (await p.locator(".momento__estado--hecho").textContent())?.trim();
  // 🔴 EL FOTOGRAMA FALLA AQUÍ Y EL MOMENTO SE AÑADE IGUAL. No es un defecto de la sonda: es
  // LA PROPIEDAD que se quiere. La foto es un adorno y su generación puede fracasar por
  // veinte razones en el navegador de alguien (sin juego servido, plazo agotado, memoria);
  // lo que no puede es llevarse por delante la partida. Esta sonda mide justo ese régimen
  // porque no sirve `/play.html`, así que la degradación ocurre de verdad y no simulada.
  obs.shotTrasAnadir = await p.evaluate(() =>
    localStorage.getItem("u5clone:shot:momento-01") !== null);
  obs.botonesTrasAnadir = await p.locator(".momento__anadir").count();
  obs.avisoTrasAnadir = (await p.locator(".momentos-modal .guardados__nota").textContent())?.trim();
  if (CAPTURAS) await p.screenshot({ path: join(CAPTURAS, "02-anadido.png") });

  // ── 3 · la partida está en la lista de detrás, CON insignia y CON acción ─────────────
  await p.keyboard.press("Escape");
  await p.waitForSelector("#partidas .guardado--tarjeta");
  obs.partidas = await p.locator("#partidas .guardado--tarjeta").count();
  obs.insignias = await p.locator("#partidas .chip--momento").count();
  obs.nombrePartida = (
    await p.locator("#partidas .guardado__nombre").first().textContent()
  )?.trim();
  // «Jugar desde aquí» es el enlace normal de continuar, apuntando al id del momento.
  obs.hrefJugar = await p.locator("#partidas .guardado__accion").first().getAttribute("href");
  if (CAPTURAS) {
    await p.locator("#partidas").scrollIntoViewIfNeeded();
    await p.screenshot({ path: join(CAPTURAS, "03-lista.png") });
  }

  // ── 4 · «Añadido ✓» SOBREVIVE A LA RECARGA ───────────────────────────────────────────
  // El aserto que separa «se lee del almacén» de «me acuerdo de que lo pulsé».
  await p.reload();
  await p.waitForSelector(".momentos__abrir");
  await p.click(".momentos__abrir");
  await p.waitForSelector(".momentos-modal .momento");
  obs.trasRecargar = (await p.locator(".momento__estado--hecho").count()) === 1
    ? (await p.locator(".momento__estado--hecho").textContent())?.trim()
    : null;
  obs.botonesTrasRecargar = await p.locator(".momento__anadir").count();
  obs.insigniasTrasRecargar = await p.locator("#partidas .chip--momento").count();
  if (CAPTURAS) await p.screenshot({ path: join(CAPTURAS, "04-tras-recargar.png") });

  // ── 4-bis · LA TARJETA DE UN INTERIOR TIENE MAPA (ficha #112) ────────────────────────
  // 🔴 EL ESLABÓN QUE NINGÚN OTRO ASERTO CUBRE, y lo sé porque lo probé: el mutante que
  // devuelve el filtro `location === 0` a `pintaPartidas` SOBREVIVE a los 28 asertos de
  // `test_byo_tarjeta.py`. Aquéllos miden el PINTOR (que ya sabe pintar interiores); éste mide
  // que la TARJETA se lo pida. Sin él, el pintor nuevo sería código que nadie llama.
  //
  // 🔴 Y HAY QUE SEMBRAR `smallmaps.json` EN LA CACHE STORAGE, no basta con servirlo: `leeMapa`
  // pide a la CACHÉ por su nombre y nunca a la red (ver su comentario). Una sonda que sólo lo
  // sirviera por HTTP vería «no hay mapa» — un negativo FALSO idéntico al defecto que se
  // arregla. El momento 01 es Iolo's Hut, `location` 13: un INTERIOR.
  await p.evaluate(async (mapa) => {
    const c = await caches.open("u5-assets-v1");
    await c.put("/assets/maps/smallmaps.json", new Response(JSON.stringify(mapa)));
  }, JSON.parse(readFileSync(join(RAIZ, "game/assets/maps/smallmaps.json"), "utf8")));
  await p.reload();
  await p.waitForSelector("#partidas .guardado--tarjeta");
  // El mapa entra en diferido (chunk perezoso de 458 KB + lectura de caché): se espera por él.
  obs.mapaInterior = await p
    .waitForSelector("#partidas .guardado__mapa", { timeout: 20000 })
    .then(async (el) => {
      const caja = await el.boundingBox();
      return { hay: true, ancho: Math.round(caja.width), alto: Math.round(caja.height) };
    })
    .catch(() => ({ hay: false }));
  if (CAPTURAS) {
    await p.locator("#partidas").scrollIntoViewIfNeeded();
    await p.screenshot({ path: join(CAPTURAS, "04b-interior-con-mapa.png") });
  }

  // ── 5 · RECÍPROCA: borrada la partida, el botón VUELVE ───────────────────────────────
  // Sin esto, un «Añadido ✓» cableado a un booleano persistido pasaría los cuatro asertos de
  // arriba. Se borra la ranura y el índice a mano (es lo que hace el juego al borrar) y se
  // vuelve a abrir: si el estado se lee del almacén, la tarjeta tiene botón otra vez.
  await p.keyboard.press("Escape");
  await p.evaluate(() => {
    localStorage.removeItem("u5clone:save:momento-01");
    localStorage.setItem("u5clone:saves", "[]");
  });
  await p.click(".momentos__abrir");
  await p.waitForSelector(".momentos-modal .momento");
  obs.botonesTrasBorrar = await p.locator(".momento__anadir").count();
  obs.hechosTrasBorrar = await p.locator(".momento__estado--hecho").count();

  // ── 6 · BORRAR DATOS LOCALES: el navegador vuelve a ser el de un visitante nuevo ──────
  // Va LA ÚLTIMA porque es destructiva: arrasa el estado que miden los cinco casos de
  // arriba. Se siembra un estado REPRESENTATIVO —una clave de cada familia del censo
  // (`demo-byo/src/limpieza.ts`), dos cachés y lo que el service worker haya registrado— y
  // se pulsa el botón de verdad, con su confirmación.
  //
  // 🔴 Y SE SIEMBRA TAMBIÉN LO AJENO, que es la mitad que de verdad discrimina: una clave y
  // una caché que NO son de este sitio tienen que SEGUIR AHÍ después. Sin ellas, sustituir
  // el barrido por prefijos por un `localStorage.clear()` + borrar todas las cachés pasaría
  // este caso con nota — y sería otra cosa: un botón que se lleva por delante lo que guarde
  // cualquier otra página de este origen. El alcance declarado sólo está comprobado si algo
  // queda fuera de él.
  await p.keyboard.press("Escape");
  await p.evaluate(async () => {
    const siembra = {
      "u5clone:saves": "[]",
      "u5clone:save:momento-01": "{}",
      "u5clone:shot:momento-01": "data:,x",
      "u5clone:autosavePtr": "3",
      "u5.skin": "fiel",
      "u5.musicVolume": "0.5",
      "u5dbg-teleport-last": "{}",
      "openu5-lang": "es",
      // Decisión VÁLIDA (todo rechazado) para que el panel de consentimiento no
      // aparezca e intercepte los clics de la sonda. Un `{}` pelado lo lee
      // `leerConsentimiento` como null (sin decidir) ⇒ el panel se muestra; bajo
      // CARGA (varias corridas de la máquina a la vez) la sonda clica antes de que
      // el panel deje de interceptar y falla con «subtree intercepts pointer
      // events». No es determinista (con la máquina libre pasa igual), pero sembrar
      // un valor inválido es incorrecto de suyo. Sigue empezando por `openu5-` ⇒ el
      // clean data la borra igual.
      "openu5-consentimiento":
        '{"version":1,"analitica":false,"partida":false,"fecha":"2026-01-01T00:00:00.000Z"}',
      // AJENA: ni empieza por ninguno de los cuatro prefijos ni la escribe este sitio.
      "otrositio:preferencia": "no me toques",
    };
    for (const [k, v] of Object.entries(siembra)) localStorage.setItem(k, v);
    await (await caches.open("u5-assets-v1")).put("/assets/manifest.json", new Response("{}"));
    await (await caches.open("u5-otra-version-v9")).put("/x", new Response("y"));
    await (await caches.open("cache-ajena")).put("/x", new Response("y"));
  });
  await p.reload();
  await p.waitForSelector("#tus-datos button");
  obs.limpieza = {
    swAntes: await p.evaluate(async () =>
      (await navigator.serviceWorker.getRegistrations()).length),
    clavesAntes: await p.evaluate(() => Object.keys(localStorage).sort()),
    cachesAntes: await p.evaluate(async () => (await caches.keys()).sort()),
  };
  // Paso 1: el botón PREGUNTA (dos botones = confirmar y cancelar) y enumera lo que se va.
  await p.click("#tus-datos button");
  await p.waitForFunction(() => document.querySelectorAll("#tus-datos button").length === 2);
  obs.limpieza.confirmacion = (await p.locator("#tus-datos span").first().textContent())?.trim();
  // Paso 2: confirmar. El resumen aparece en el `<small>` que `pintaTusDatos` deja detrás.
  await p.locator("#tus-datos button").first().click();
  await p.waitForSelector("#tus-datos small");
  obs.limpieza.resumen = (await p.locator("#tus-datos small").textContent())?.trim();
  // 🔴 LOS OTROS DOS REPINTADOS QUE EL BORRADO DESPIERTA. El resumen no es el único texto que
  // se vuelve a pintar: `borraDeVerdad` llama a `ve({k:'vacio'})` y a `refrescaPartidas()`, y
  // los dos resuelven idioma DESPUÉS de que `openu5-lang` ya no exista. Aserverar sólo sobre
  // el resumen daba verde con media pantalla en el otro idioma — lo enseñó la CAPTURA, no la
  // sonda. Se llevan los tres rótulos y el pytest exige que hablen la misma lengua.
  obs.limpieza.tituloEstado = (await p.locator("#estado .est__titulo").textContent())?.trim();
  obs.limpieza.tituloPartidas = (
    await p.locator("#partidas .guardados__titulo").first().textContent()
  )?.trim();
  obs.limpieza.clavesDespues = await p.evaluate(() => Object.keys(localStorage).sort());
  obs.limpieza.cachesDespues = await p.evaluate(async () => (await caches.keys()).sort());
  obs.limpieza.swDespues = await p.evaluate(async () =>
    (await navigator.serviceWorker.getRegistrations()).length);
  if (CAPTURAS) await p.screenshot({ path: join(CAPTURAS, "05-borrado.png") });
} finally {
  await navegador.close();
  server.close();
}

process.stdout.write(JSON.stringify(obs));
