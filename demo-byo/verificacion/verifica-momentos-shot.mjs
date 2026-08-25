/**
 * SONDA DEL FOTOGRAMA de un momento legendario — el circuito ENTERO con el JUEGO DE VERDAD.
 *
 * Uso:  npx vite build demo-byo && npm run build -w game
 *       node demo-byo/verificacion/verifica-momentos-shot.mjs [--capturas <dir>]
 *
 * Observaciones en JSON por stdout; quien asevera es `re/tools/test_byo_momentos.py`.
 *
 * ── POR QUÉ ES UNA SONDA APARTE DE `verifica-momentos-navegador.mjs` ────────────────────
 * Aquélla mide el CIRCUITO de /byo con una copia SINTÉTICA (16 registros de una letra) y por
 * eso corre en cualquier árbol. Ésta no puede: el fotograma sale de ARRANCAR EL JUEGO, y el
 * arranque carga la extracción completa —overworld, underworld, smallmaps, data, npcs, los
 * cuatro `talk/*`, signs, combatmaps, dungeons, look2 y el atlas de tiles
 * (`game/src/main.ts:226-293`)—. Con cuatro ficheros sintéticos no hay boot que valga.
 *
 * ⇒ Sirve `/assets/*` desde `game/assets`, la extracción REAL. No es una dependencia nueva
 * para la batería: `bateria_aterrizaje.sh` ya ABORTA si falta `game/assets`, y
 * `test_companion_ea` reconstruye su atlas desde ahí. Lo que sí es nuevo es que aquí el
 * navegador PINTA esos tiles — por eso las capturas que produce son material de EA y van a
 * un directorio temporal, nunca al árbol.
 *
 * ── LO QUE MIDE, que es lo que el permiso para tocar `main.ts` exigía ───────────────────
 *  1. El modo `?shot=<id>` escribe la miniatura del momento sembrado.
 *  2. Sus dimensiones y su formato (los REPORTA; el pytest asevera la relación de aspecto,
 *     no el tamaño exacto — ver allí por qué).
 *  3. 🔴 La lista de partidas NO gana autosaves. Mi medición de `map-changed` decía que el
 *     arranque no lo emite (`main.ts:1866` cuelga de acciones del jugador); esto la
 *     convierte en aserto, que es la diferencia entre haberlo leído y saberlo.
 *  4. 🔴 INERCIA: en el MISMO arranque SIN `?shot` no emite mensaje NADIE y no escribe una
 *     clave de foto NADIE (`setItem` censado en todos los frames). Es la condición literal
 *     del permiso, y sin este caso «funciona» no distingue entre «el modo está acotado» y
 *     «el modo se dispara siempre». La foto se queda PUESTA a propósito — borrarla armaría
 *     la re-captura legítima de #153 y el aserto mediría otra cosa (ver el caso).
 *  5. REGENERAR A DEMANDA: sobre una ranura de momento SIN foto, la tarjeta ofrece el botón
 *     y el CLIC del botón la produce. Se dispara el control real, no la función.
 *  6. REINTENTO: con el primer `/play.html` reventado a propósito, la foto sale igual — y
 *     tarda más que el presupuesto de UN intento, que es lo que dice que hubo dos.
 *
 * ── PUERTO EFÍMERO ──────────────────────────────────────────────────────────────────────
 * `listen(0)`. Ni el 5199 del usuario ni un 52xx de otro carril.
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join, resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIST_BYO = join(RAIZ, "demo-byo/dist");
const DIST_JUEGO = join(RAIZ, "game/dist");
const ASSETS = join(RAIZ, "game/assets");
const { chromium } = createRequire(join(RAIZ, "package.json"))("playwright");

const iCap = process.argv.indexOf("--capturas");
const CAPTURAS = iCap >= 0 ? process.argv[iCap + 1] : null;
if (CAPTURAS) mkdirSync(CAPTURAS, { recursive: true });

for (const [q, d] of [["demo-byo", DIST_BYO], ["game", DIST_JUEGO]]) {
  if (!existsSync(d)) {
    console.error(`No existe ${d}. Corre antes: npx vite build demo-byo && npm run build -w game`);
    process.exit(1);
  }
  void q;
}
if (!existsSync(ASSETS)) {
  console.error(`No existe ${ASSETS} (gitignored). Sin la extracción el juego no arranca.`);
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".gam": "application/octet-stream",
};

/**
 * El sitio, como lo FUNDE el ensamblador (`build-demo-publica.sh:34,44`): el dist del juego
 * primero y el de /byo encima. Aquí se resuelve por orden de búsqueda en vez de copiar, que
 * para una sonda da el mismo árbol servido sin duplicar 12 MB.
 */
/**
 * TRAMPA DEL REINTENTO: cuántas peticiones de `/play.html` seguidas hay que reventar.
 *
 * 🔴 Es la única forma HONESTA de aseverar que se reintenta. Un aserto sobre «la foto
 * existe» no distingue un intento de dos —los dos acaban con foto—, y contar iframes
 * tampoco, porque el primero se desmonta antes de que exista el segundo. Rompiendo el
 * PRIMER arranque y sólo el primero, la foto sólo puede venir del SEGUNDO: la existencia
 * de la foto pasa a ser el testigo del reintento. Con `INTENTOS_SHOT = 1` no hay foto.
 */
let trampaPlay = 0;

const server = createServer((req, res) => {
  const ruta = new URL(req.url, "http://x").pathname;
  const enviar = (f) => {
    res.writeHead(200, { "content-type": MIME[extname(f)] ?? "application/octet-stream" });
    res.end(readFileSync(f));
  };
  // 🔴 `/assets/` ES UN ESPACIO COMPARTIDO POR DOS COSAS, y confundirlas costó dos
  // diagnósticos falsos («el modo shot no escribe») cuando lo que pasaba es que el juego no
  // arrancaba: ahí viven LOS CHUNKS DE VITE del juego (`game/dist/assets/index-*.js`) Y la
  // extracción del visitante. En el sitio real conviven porque el service worker sólo
  // intercepta lo que tiene en su Cache Storage y el resto cae a la red
  // (`demo-byo/public/sw.js:13-23`); el ensamblador, por su parte, purga de `$DEST/assets`
  // exactamente los ficheros que vinieron de `game/assets`
  // (`build-demo-publica.sh:37-42`). La sonda reproduce esa convivencia con el orden de
  // búsqueda: primero la app, después la extracción.
  if (ruta.startsWith("/assets/")) {
    for (const base of [join(DIST_JUEGO, "assets"), ASSETS]) {
      const f = join(base, ruta.slice("/assets/".length));
      if (f.startsWith(base) && existsSync(f)) return enviar(f);
    }
    res.writeHead(404).end("no");
    return;
  }
  // 🔴 `/play.html` ES `game/dist/index.html` RENOMBRADO. Lo hace el ensamblador con un
  // `mv` (`build-demo-publica.sh:109`) para que la raíz del sitio sea la landing y el juego
  // viva en /play.html. Sin esta línea la sonda daba 404 y el shot no se escribía —
  // exactamente el síntoma de «el modo no funciona», cuando lo que faltaba era el renombre.
  if (ruta === "/play.html") {
    if (trampaPlay > 0) {
      trampaPlay--;
      res.writeHead(500).end("trampa del reintento");
      return;
    }
    return enviar(join(DIST_JUEGO, "index.html"));
  }
  for (const base of [DIST_BYO, DIST_JUEGO]) {
    const f = join(base, ruta === "/" ? "byo.html" : ruta.slice(1));
    if (f.startsWith(base) && existsSync(f)) return enviar(f);
  }
  res.writeHead(404).end("no");
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const obs = { consola: [] };
const navegador = await chromium.launch();
try {
  const ctx = await navegador.newContext({ viewport: { width: 1000, height: 900 } });
  // 🔴 CENSO DE ESCRITURAS de claves de foto, en TODOS los frames (init script = corre en
  // cada documento del contexto, iframes incluidos). Es el testigo del caso de INERCIA de
  // más abajo: el envoltorio llama al original y sube {href, clave} a `window.top`, así que
  // el fallo NOMBRA al escritor y a su URL — que es exactamente lo que adjudicó la ficha
  // #365 (el escritor era el frame `?save=…` SIN `?shot`: la re-captura #153, no el modo).
  await ctx.addInitScript(() => {
    try {
      if (!window.top.__escriturasShot) window.top.__escriturasShot = [];
    } catch {
      /* un frame sin acceso al top no censa — no pasa en esta sonda, mismo origen */
    }
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (clave, valor) {
      if (typeof clave === "string" && clave.startsWith("u5clone:shot:")) {
        try {
          window.top.__escriturasShot.push({
            href: location.pathname + location.search,
            clave,
          });
        } catch {
          /* ídem */
        }
      }
      return original.call(this, clave, valor);
    };
  });
  const p = await ctx.newPage();
  p.on("console", (m) => {
    if (m.type() === "error") obs.consola.push(m.text().slice(0, 300));
  });
  p.on("pageerror", (e) => obs.consola.push(`pageerror: ${String(e).slice(0, 300)}`));
  // 🔴 LOS 404 SE REGISTRAN CON SU URL, no como «Failed to load resource». El mensaje de
  // consola pelado no dice QUÉ faltó, y con él tardé dos diagnósticos en ver que el primero
  // era `/play.html` (el ensamblador lo RENOMBRA desde `index.html`) y el segundo un chunk
  // de vite tapado por la extracción. Un aserto sobre «cero errores de consola» habría
  // tenido que aflojarse a ciegas; con la URL se puede declarar la excepción POR NOMBRE.
  obs.faltantes = [];
  p.on("response", (r) => {
    if (r.status() === 404) obs.faltantes.push(new URL(r.url()).pathname);
  });

  await p.goto(`${BASE}/byo.html`);
  // `hasExtraction()` mira UNA entrada de la Cache Storage (`extractor/src/browser.ts:231`).
  await p.evaluate(async () => {
    const c = await caches.open("u5-assets-v1");
    await c.put("/assets/manifest.json", new Response("{}"));
  });
  await p.reload();
  await p.waitForSelector(".momentos__abrir");

  // ── AÑADIR EL MOMENTO 1, con su fotograma ────────────────────────────────────────────
  await p.click(".momentos__abrir");
  await p.waitForSelector(".momentos-modal .momento");
  await p.click(".momento__anadir");
  // El presupuesto del generador son 20 s; se espera con margen y se mide lo que haya.
  await p.waitForSelector(".momento__estado--hecho", { timeout: 60000 });

  obs.shot = await p.evaluate(async () => {
    const dato = localStorage.getItem("u5clone:shot:momento-01");
    if (!dato) return { existe: false };
    const img = new Image();
    await new Promise((ok, mal) => {
      img.onload = ok;
      img.onerror = mal;
      img.src = dato;
    });
    // 🔴 CUÁNTOS COLORES DISTINTOS tiene. Es EL aserto que separa «hay una imagen» de «hay
    // LA imagen»: la primera versión de todo esto guardaba un rectángulo NEGRO y `existe:
    // true` lo daba por bueno. Un fotograma del juego tiene decenas de colores; uno liso,
    // uno. Se muestrea a 40×25 para no pagar el bitmap entero.
    const o = document.createElement("canvas");
    o.width = 40;
    o.height = 25;
    const cx = o.getContext("2d");
    cx.drawImage(img, 0, 0, 40, 25);
    const px = cx.getImageData(0, 0, 40, 25).data;
    const col = new Set();
    for (let i = 0; i < px.length; i += 4) col.add(`${px[i]},${px[i + 1]},${px[i + 2]}`);
    return {
      existe: true,
      colores: col.size,
      // El MIME viaja para que el pytest pueda REPORTARLO; el formato exacto lo decide
      // `ui/screenshot.ts` (carril del zoom) y aquí no se duplica.
      mime: dato.slice(5, dato.indexOf(";")),
      ancho: img.naturalWidth,
      alto: img.naturalHeight,
      bytes: dato.length,
    };
  });
  // 🔴 EL AUTOSAVE. Arrancar el juego en el iframe NO puede añadir partidas a la lista del
  // visitante: `autosave` cuelga de `map-changed` (`main.ts:1866`) y ese evento lo emiten
  // acciones del jugador, no el boot. Aserto, no lectura.
  obs.indice = await p.evaluate(() => {
    const idx = JSON.parse(localStorage.getItem("u5clone:saves") ?? "[]");
    return { n: idx.length, ids: idx.map((m) => m.id).sort() };
  });
  // Y el iframe NO se queda: un juego corriendo detrás de una página que cree haber
  // terminado gastaría CPU de alguien.
  obs.iframesVivos = await p.locator("iframe").count();
  if (CAPTURAS && obs.shot?.existe) {
    // El fotograma TAL CUAL se guardó, a fichero: mirarlo es el único control que distingue
    // «hay una imagen» de «hay LA imagen». Un `existe: true` sobre un rectángulo negro
    // pasaría cualquier aserto de presencia.
    const dataurl = await p.evaluate(() => localStorage.getItem("u5clone:shot:momento-01"));
    const b64 = dataurl.slice(dataurl.indexOf(",") + 1);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(join(CAPTURAS, "shot-crudo.jpg"), Buffer.from(b64, "base64"));
  }
  if (CAPTURAS) {
    await p.locator("#partidas").scrollIntoViewIfNeeded();
    await p.screenshot({ path: join(CAPTURAS, "shot-tarjeta.png") });
  }

  // ── INERCIA: el mismo arranque SIN `?shot` no TOCA la foto ni emite mensaje ──────────
  // Condición literal del permiso para tocar `main.ts`: la rama entera del modo cuelga de
  // `shotParam` (main.ts:6004-6036) y SIEMPRE desemboca en el postMessage — por eso
  // `mensajes` es un testigo completo del modo, también cuando su captura falla.
  //
  // 🔴 LA VERSIÓN ANTERIOR BORRABA LA FOTO Y MEDÍA SU AUSENCIA — y ese aserto era falso POR
  // DISEÑO desde #153 (10-08; este caso es del 08-08): borrar la clave es exactamente lo
  // que ARMA la re-captura de miniaturas del boot (`debeRecapturar(null, …) === true`,
  // `ui/shot-refresh.ts:59`, llamada con `?save=` en `main.ts:575`), que escribe SIN emitir
  // mensaje. Medido (ficha #365, mini 16-08): UNA escritura, del frame
  // `/play.html?save=…&embed=1&nointro` —sin `?shot`—, ~70 ms tras montar el iframe. El
  // verde que este caso daba en la otra máquina era un ACCIDENTE de carrera (hipótesis:
  // bajo `visibility:hidden` Chromium suspende el rAF y `dosFrames` sólo se resuelve si el
  // boot llega antes de la suspensión — con cachés calientes sí, en frío no).
  //
  // ⇒ La foto SE QUEDA PUESTA (sus dimensiones ya son las del objetivo, así que la
  // re-captura legítima no dispara) y quien asevera es el CENSO de escrituras del init
  // script de arriba: la lista de la ventana tiene que salir VACÍA. Es más fuerte que
  // comparar la clave o su contenido —una re-escritura byte a byte idéntica también
  // cuenta— y el fallo nombra al escritor. El aserto NO se aflojó: se le quitó la mentira.
  //
  // 🔴 Y EL IFRAME VA DENTRO DEL VIEWPORT RECORTADO A 1×1 POR SU JAULA, no en
  // `visibility:hidden`: la técnica MEDIDA de `momentos-instala.ts` (tabla chromium/webkit
  // en su comentario). Con el rAF suspendido el juego se congela ANTES de
  // `refrescarMiniatura` y este caso mediría un silencio trivial; así el boot COMPLETA la
  // comprobación de #153 con la guarda diciendo que no — y el cero es un cero ejercido.
  const inerte = await p.evaluate(
    (base) =>
      new Promise((resolve) => {
        window.__escriturasShot = []; // ventana limpia: aquí sólo cuentan las de ESTE caso
        const fotoAntes = localStorage.getItem("u5clone:shot:momento-01");
        let mensajes = 0;
        const onMsg = (e) => {
          if (e.data && e.data.tipo === "u5:shot") mensajes++;
        };
        window.addEventListener("message", onMsg);
        const f = document.createElement("iframe");
        f.style.cssText = "width:960px;height:600px;border:0;pointer-events:none";
        f.src = `${base}/play.html?save=momento-01&embed=1&nointro`;
        const jaula = document.createElement("div");
        jaula.setAttribute("aria-hidden", "true");
        jaula.style.cssText =
          "position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1";
        jaula.appendChild(f);
        f.addEventListener("load", () => {
          // Margen generoso tras el load: si el modo se disparara igualmente, tendría de
          // sobra para escribir. Un plazo corto haría pasar el aserto por impaciencia.
          setTimeout(() => {
            window.removeEventListener("message", onMsg);
            jaula.remove();
            resolve({
              mensajes,
              escrituras: window.__escriturasShot.slice(),
              fotoIntacta: localStorage.getItem("u5clone:shot:momento-01") === fotoAntes,
            });
          }, 6000);
        });
        document.body.appendChild(jaula);
      }),
    BASE,
  );
  obs.sinShot = inerte;

  // ── REGENERAR A DEMANDA: la tarjeta sin foto la PIDE, y sale ─────────────────────────
  // 🔴 EL CASO QUE CIERRA EL AGUJERO: hasta hoy «sin foto» era definitivo, y le pasa por
  // construcción a todo momento sembrado antes de que existiera la captura. El estado se
  // FABRICA aquí borrando la clave — y se borra AHORA, con ningún juego corriendo, porque
  // el único re-escritor legítimo (#153) vive en el boot del juego y /byo no lo arranca
  // hasta el clic del botón: entre el borrado y el clic nadie puede resucitar la foto.
  // (Cuando el borrado lo hacía el caso de inercia con su iframe VIVO, la re-captura la
  // resucitaba y este caso medía una tarjeta CON foto — los dos rojos de la ficha #365.)
  await p.evaluate(() => localStorage.removeItem("u5clone:shot:momento-01"));
  //
  // ★ Se dispara EL MECANISMO REAL: el clic del botón de la tarjeta, que importa el chunk
  // y arranca el juego en su iframe. No se llama a `generaShotDelMomento` desde la consola
  // —eso mediría la función y no el control—, y por eso este caso también aseveraría en
  // rojo un botón que no estuviera cableado, mal condicionado o que no repintara.
  await p.reload();
  await p.waitForSelector("#partidas .guardado--tarjeta");
  obs.regenerar = {
    // La RECÍPROCA primero: sin foto, la tarjeta ofrece el botón y NO una foto.
    botones: await p.locator(".guardado__reshot").count(),
    fotosAntes: await p.locator(".guardado__foto").count(),
    // 🔴 EL DESENLACE SE INICIALIZA A «NO», no se deja ausente. Medido con el mutante que
    // retira la rama del botón: sin botón no se entra al bloque de abajo, la clave no
    // existía y el pytest moría con un `KeyError` en vez de con su mensaje. Un rojo que no
    // dice qué pasó obliga a leer la sonda para entender el fallo del código.
    fotoDespues: false,
    botonesDespues: 0,
    shot: { existe: false },
  };
  if (obs.regenerar.botones > 0) {
    await p.click(".guardado__reshot");
    // El botón desaparece cuando la lista se repinta CON la foto: esperar por la foto es
    // esperar por el efecto, no por el clic.
    try {
      await p.waitForSelector(".guardado__foto", { timeout: 90000 });
      obs.regenerar.fotoDespues = true;
    } catch {
      obs.regenerar.fotoDespues = false;
    }
    obs.regenerar.botonesDespues = await p.locator(".guardado__reshot").count();
    obs.regenerar.shot = await p.evaluate(async () => {
      const dato = localStorage.getItem("u5clone:shot:momento-01");
      if (!dato) return { existe: false };
      const img = new Image();
      await new Promise((ok, mal) => {
        img.onload = ok;
        img.onerror = mal;
        img.src = dato;
      });
      const o = document.createElement("canvas");
      o.width = 40;
      o.height = 25;
      const cx = o.getContext("2d");
      cx.drawImage(img, 0, 0, 40, 25);
      const px = cx.getImageData(0, 0, 40, 25).data;
      const col = new Set();
      for (let i = 0; i < px.length; i += 4) col.add(`${px[i]},${px[i + 1]},${px[i + 2]}`);
      return { existe: true, colores: col.size, bytes: dato.length };
    });
  }

  // ── REINTENTO: con el PRIMER arranque roto, la foto sale igual ───────────────────────
  // Se instala el momento 2 con la trampa armada para UNA petición de `/play.html`. El
  // primer intento no puede terminar de otra forma que agotando su plazo (el iframe no
  // carga ⇒ nadie emite `u5:shot`), así que la foto, si aparece, es del segundo.
  // El TIEMPO viaja como segundo testigo y es el que distingue «reintentó» de «la trampa
  // no llegó a armarse»: por debajo del presupuesto de un intento, algo no se midió.
  trampaPlay = 1;
  await p.click(".momentos__abrir");
  await p.waitForSelector(".momentos-modal .momento");
  // 🔴 SE CUENTAN LOS «Añadido ✓», NO SE ESPERA POR EL PRIMERO. El momento 1 ya está
  // instalado, así que `.momento__estado--hecho` YA EXISTE al abrir el modal: un
  // `waitForSelector` casa al instante con el sello del momento ANTERIOR y devuelve 28 ms
  // (medido) sin que este caso haya medido nada — y `existe: false` se leería entonces como
  // «no reintentó» cuando lo que pasó es que nadie llegó a intentarlo. El predicado tiene
  // que ser sobre EL MÍO: uno MÁS de los que había.
  const hechosAntes = await p.locator(".momento__estado--hecho").count();
  const t0 = Date.now();
  try {
    await p.locator(".momento__anadir").first().click();
    await p.waitForFunction(
      (n) => document.querySelectorAll(".momento__estado--hecho").length > n,
      hechosAntes,
      { timeout: 120000 },
    );
  } catch {
    /* el veredicto lo da la foto de abajo, no esta espera */
  }
  obs.reintento = {
    ms: Date.now() - t0,
    trampaConsumida: trampaPlay === 0,
    ...(await p.evaluate(async () => {
      const idx = JSON.parse(localStorage.getItem("u5clone:saves") ?? "[]");
      const meta = idx.find((m) => m.momentoId && m.momentoId !== "momento-01");
      if (!meta) return { sembrado: false, existe: false };
      const dato = localStorage.getItem("u5clone:shot:" + meta.id);
      if (!dato) return { sembrado: true, id: meta.id, existe: false };
      const img = new Image();
      await new Promise((ok, mal) => {
        img.onload = ok;
        img.onerror = mal;
        img.src = dato;
      });
      const o = document.createElement("canvas");
      o.width = 40;
      o.height = 25;
      const cx = o.getContext("2d");
      cx.drawImage(img, 0, 0, 40, 25);
      const px = cx.getImageData(0, 0, 40, 25).data;
      const col = new Set();
      for (let i = 0; i < px.length; i += 4) col.add(`${px[i]},${px[i + 1]},${px[i + 2]}`);
      return { sembrado: true, id: meta.id, existe: true, colores: col.size, bytes: dato.length };
    })),
  };
} finally {
  await navegador.close();
  server.close();
}

process.stdout.write(JSON.stringify(obs));
