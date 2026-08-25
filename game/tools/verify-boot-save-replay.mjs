/**
 * LA OTRA MITAD DEL BLOQUE 2d: que `?save=<id>` y `?replay=<id>` HAGAN algo.
 *
 * La sonda de `/byo` (demo-byo/verificacion) comprueba que la pantalla lista las
 * partidas y que los enlaces llevan el parámetro. Eso deja fuera, por construcción, la
 * mitad que importa: que al llegar aquí el juego cargue ESA partida. Aquella sonda sirve
 * `demo-byo/dist`, donde el juego no existe, así que la comprobación tiene que vivir
 * aquí.
 *
 * 🔴 EL DISCRIMINANTE ES LA PARTIDA **MÁS ANTIGUA**, y no es un detalle: el arranque YA
 * cargaba la más reciente sin ningún parámetro (Journey Onward). Una prueba que pidiera
 * `?save=` de la más reciente pasaría en VERDE con el parámetro completamente ignorado —
 * mediría el comportamiento viejo y lo llamaría nuevo. Se siembran DOS partidas en
 * posiciones distintas, se pide la VIEJA, y se comprueba que sale la vieja.
 *
 * Uso (desde la raíz del worktree):
 *   npx vite game --config game/vite.config.ts --port 5253 &   # o el que esté libre
 *   # ↑ `game` es el ROOT (posicional, no `--root`: vite no acepta esa bandera y aborta;
 *   #   sin él, root = cwd y `/` da 404 porque el index.html vive en game/).
 *   # ↑ Ya NO hace falta exportar U5_VITE_CACHE_DIR: el config aísla la caché solo
 *   #   cuando `node_modules` es un symlink (`game/tools/vite-cache-dir.ts`). Se deja
 *   #   dicho aquí igualmente porque ESTA es la línea que la gente copia, y porque el
 *   #   día que alguien lance vite con OTRO config la protección no viaja con él:
 *   #   U5_VITE_CACHE_DIR=<dir propio> npx vite game --config …
 *   U5_PORT=5253 node game/tools/verify-boot-save-replay.mjs
 *
 * 🔴 Depende de material de EA (game/assets, gitignored) ⇒ NO va en la batería.
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { chromium } = createRequire(resolve(RAIZ, "package.json"))("playwright");
const BASE = `http://localhost:${process.env.U5_PORT || 5253}`;

const fallos = [];
const ok = (cond, etiqueta, visto) => {
  console.log(`${cond ? "  OK  " : "  FALLO"} ${etiqueta}${cond ? "" : `\n         visto: ${JSON.stringify(visto)}`}`);
  if (!cond) fallos.push(etiqueta);
};

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push("pageerror: " + e.message));

/** Espera a que el juego esté montado y con estado vivo. */
async function arranca(query) {
  await page.goto(`${BASE}/${query}`);
  await page.waitForFunction(() => {
    const h = window.__u5test;
    return !!(h && h.state && h.state());
  }, null, { timeout: 120000 });
}

console.log("── ARRANQUE FRESCO (control) ──");
await arranca("?fresh&nointro");
const base = await page.evaluate(() => JSON.stringify(window.__u5test.state()));
const pos0 = JSON.parse(base).position;
console.log(`    posición de partida nueva: ${JSON.stringify(pos0)}`);
ok(errores.length === 0, "el juego arranca sin errores de página", errores);

// Dos partidas EN EL MISMO FORMATO que escribe `persistence.putSave` (serialize =
// JSON.stringify, comprobado en core/state.ts:518). Difieren SÓLO en la posición, que
// es lo que se va a leer de vuelta.
const VIEJA = { id: "save-vieja", x: pos0.x + 3, ts: 1754400000000 };
const NUEVA = { id: "save-nueva", x: pos0.x + 7, ts: 1754500000000 };

await page.evaluate(
  ({ base, VIEJA, NUEVA }) => {
    const mk = (s) => {
      const st = JSON.parse(base);
      st.position.x = s.x;
      localStorage.setItem("u5clone:save:" + s.id, JSON.stringify(st));
      return { id: s.id, name: s.id, timestamp: s.ts, turns: 0, locationName: "Britannia" };
    };
    localStorage.setItem("u5clone:saves", JSON.stringify([mk(VIEJA), mk(NUEVA)]));
  },
  { base, VIEJA, NUEVA },
);

console.log("\n── SIN PARÁMETRO: la MÁS RECIENTE (comportamiento de siempre) ──");
await arranca("?nointro");
const sinParam = await page.evaluate(() => window.__u5test.state().position.x);
ok(sinParam === NUEVA.x, "sin ?save, sigue cargando la más reciente", { sinParam, esperado: NUEVA.x });

console.log("\n── ?save=<id> DE LA MÁS ANTIGUA: el discriminante ──");
await arranca(`?nointro&save=${VIEJA.id}`);
const conParam = await page.evaluate(() => window.__u5test.state().position.x);
ok(conParam === VIEJA.x,
   "?save=<id> carga ESA partida, no la más reciente",
   { conParam, esperadoVieja: VIEJA.x, siHubieraIgnoradoElParametro: NUEVA.x });

console.log("\n── ?save=<id> INEXISTENTE: cae a la más reciente, no rompe ──");
errores.length = 0;
await arranca("?nointro&save=save-que-no-existe");
const inexistente = await page.evaluate(() => window.__u5test.state().position.x);
ok(inexistente === NUEVA.x, "un id borrado cae a la más reciente", { inexistente, esperado: NUEVA.x });
ok(errores.length === 0, "y no deja el juego a medias (sin errores de página)", errores);

console.log("\n── ?replay=<id>: carga el registro y saca la barra de transporte ──");
// Registro mínimo con el ANCLA en una posición propia: si el reproductor lo carga de
// verdad, el estado vivo pasa a ser el del ancla (`player.load` → `deps.restore`).
const ANCLA_X = pos0.x + 11;
await page.evaluate(
  async ({ base, ANCLA_X }) => {
    const st = JSON.parse(base);
    st.position.x = ANCLA_X;
    const log = {
      v: 1, id: "rep-1", label: "sonda", createdAt: Date.now(),
      anchor: { state: JSON.stringify(st), seed: 3 },
      keys: "", turns: "", mods: "", count: 0, lastTurn: 0,
    };
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("u5-replay", 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains("logs")) {
          d.createObjectStore("logs", { keyPath: "id" }).createIndex("createdAt", "createdAt");
        }
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction("logs", "readwrite");
      tx.objectStore("logs").put(log);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  },
  { base, ANCLA_X },
);

errores.length = 0;
await arranca("?nointro&replay=rep-1");
await page.waitForSelector('[data-testid="u5-replay-bar"]', { state: "visible", timeout: 60000 }).catch(() => {});
const barra = await page.locator('[data-testid="u5-replay-bar"]').isVisible();
ok(barra, "?replay=<id> deja VISIBLE la barra de transporte", barra);
const anclado = await page.evaluate(() => window.__u5test.state().position.x);
ok(anclado === ANCLA_X,
   "y el juego queda en el ANCLA del registro (lo cargó de verdad, no sólo pintó la barra)",
   { anclado, esperado: ANCLA_X });
ok(errores.length === 0, "?replay sin errores de página", errores);

// ── `?embed=1`: LO QUE EL POPOVER DE `/byo` MONTA DENTRO DE SU IFRAME ───────────
//
// El popover abre esta página con `?replay=<id>&embed=1`. La sonda de `/byo` sólo puede
// comprobar el `src` del iframe (sirve `demo-byo/dist`, donde el juego no existe): que lo
// que hay DENTRO sea una repetición mirable se mide aquí.
//
// 🔴 ESTE BLOQUE NACE DE UN ROJO MEDIDO, no de una hipótesis. Antes del arreglo, esta
// misma URL se quedaba en `introPhase="attract"` a los 25 s (quince veces el arranque
// medido) — los logos de 1988 —, sin barra de transporte en el DOM y con la posición de
// partida NUEVA en vez de la del ancla. `replayPlayer.load()` vive detrás del
// `await intro.run()`, y suprimir los FAB por CSS no toca esa espera.
//
// 🔴 Y SE PIDE **SIN `?nointro`** A PROPÓSITO: el popover no lo pone. Con `nointro` en la
// URL, los tres asertos de abajo pasarían en verde aunque `embed` no saltara nada — sería
// una sonda que mide el parámetro que ella misma añadió.
console.log("\n── ?embed=1 (el popover de /byo): repetición mirable, sin cinemática ──");
const FAB_SEL = ".u5shell-gear,.u5skinsw,.u5langsw";
errores.length = 0;
await arranca("?replay=rep-1&embed=1");
await page.waitForSelector('[data-testid="u5-replay-bar"]', { state: "visible", timeout: 60000 }).catch(() => {});
const emb = await page.evaluate(() => {
  const bar = document.querySelector('[data-testid="u5-replay-bar"]');
  return {
    x: window.__u5test.state().position.x,
    barraVisible: !!bar && !bar.hasAttribute("hidden"),
    fase: window.__u5test.introPhase ? window.__u5test.introPhase() : "(sin intro montada)",
    suprimidos: document.body.classList.contains("u5shell-fab-suppressed"),
  };
});
console.log(`    ${JSON.stringify(emb)} · ancla esperada x=${ANCLA_X}`);
ok(emb.x === ANCLA_X,
   "embed: la CINEMÁTICA no se interpone — el registro está cargado en su ancla",
   { visto: emb.x, esperado: ANCLA_X });
// 🔴 ÉSTE es el aserto que sostiene el popover entero: si `embed` se llevara por delante
// también la barra de transporte, la repetición se vería y no se podría ni pausar.
ok(emb.barraVisible, "embed: la BARRA DE TRANSPORTE sí está (play/pausa/velocidad son suyos)", emb);
ok(emb.suprimidos, "embed: y los FAB del shell siguen suprimidos", emb);
ok(errores.length === 0, "embed sin errores de página", errores);

// EL CONTROL DEL CONTROL: sin `embed` el clúster de FAB monta sus TRES botones. Sin esto,
// «los FAB están suprimidos» sería una afirmación sobre una clase CSS que podría estar
// puesta sobre un clúster que no existe — verde por vacuidad.
errores.length = 0;
await arranca("?nointro&replay=rep-1");
await page.waitForSelector(FAB_SEL, { timeout: 60000 }).catch(() => {});
const sinEmbed = await page.evaluate((sel) => ({
  fabs: document.querySelectorAll(sel).length,
  suprimidos: document.body.classList.contains("u5shell-fab-suppressed"),
}), FAB_SEL);
ok(sinEmbed.fabs === 3 && !sinEmbed.suprimidos,
   "control: SIN embed el clúster monta sus tres botones y NO está suprimido", sinEmbed);

// ── LA CAPTURA AL GUARDAR NO PUEDE MOVER EL RNG (bloque 2d-bis) ─────────────────
//
// 🔴 EL CONTROL ES LA MITAD DEL ASERTO. Recién arrancado, `g_rng_seed` vale 0: ahí
// «la semilla no se movió» sale VERDE aunque la captura rompiera el juego, porque no
// hay nada que mover. Se juega primero hasta que la semilla sea ≠ 0 y se comprueba
// que lo es ANTES de creerse el resultado.
//
// Y se mide el CAMINO REAL (`saveGame` del panel de partidas, con su miniatura), no
// un `toDataURL` suelto: lo que hay que descartar es que el flujo de guardado entero
// consuma una tirada, no que la lectura del canvas aislada no lo haga.
console.log("\n── LA CAPTURA AL GUARDAR: CERO TIRADAS ──");
errores.length = 0;
await arranca("?fresh&nointro");
for (const k of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]) {
  await page.keyboard.press(k);
  await page.waitForTimeout(200);
}
const previo = await page.evaluate(() => ({
  seed: window.__u5test.game.liveSeed(),
  turn: window.__u5test.state().turnsSinceStart,
}));
console.log(`    tras 6 flechas: seed=${previo.seed} turn=${previo.turn}`);
ok(previo.seed !== 0, "control: la semilla es ≠ 0, así que «no se movió» DISCRIMINA", previo);

const guardado = await page.evaluate(async () => {
  const { saveGame } = await import("/src/core/persistence.ts");
  const { captureScreenshot } = await import("/src/ui/screenshot.ts");
  const s = () => window.__u5test.game.liveSeed();
  const t = () => window.__u5test.state().turnsSinceStart;
  const antes = { seed: s(), turn: t() };
  const shot = captureScreenshot(document);
  const res = saveGame(window.__u5test.state(), "sonda", "Britannia", shot);
  const despues = { seed: s(), turn: t() };
  const guardada = res.ok ? localStorage.getItem("u5clone:shot:" + res.meta.id) : null;
  return { antes, despues, ok: res.ok, shotBytes: shot ? shot.length : 0,
           enDisco: guardada ? guardada.length : 0,
           enIndice: (localStorage.getItem("u5clone:saves") || "").includes("data:image") };
});
console.log(JSON.stringify(guardado));
ok(guardado.ok, "la partida se guarda", guardado);
ok(guardado.antes.seed === guardado.despues.seed,
   "guardar CON captura no mueve la semilla", guardado);
ok(guardado.antes.turn === guardado.despues.turn, "ni el turno", guardado);
ok(guardado.shotBytes > 1000, "la miniatura tiene contenido de verdad", guardado);
ok(guardado.enDisco === guardado.shotBytes, "y queda en su clave propia, entera", guardado);
// 🔴 La recíproca: que NO haya engordado el índice, que es el motivo de la clave aparte.
ok(!guardado.enIndice, "el ÍNDICE sigue sin llevar la foto dentro", guardado);
ok(errores.length === 0, "sin errores de página al guardar", errores);

// ── LA CAPTURA VA A RESOLUCIÓN NATIVA (08-08) ────────────────────────────────
//
// 🔴 SE ASEVERAN LAS DIMENSIONES DEL PÍXEL, NO «hay imagen». «Devuelve un dataURL» lo
// cumplía también la versión vieja (jpeg 200×125) y lo cumpliría una captura NEGRA.
// Lo que este encargo cambió es exactamente el tamaño y el formato, así que es el
// tamaño y el formato lo que hay que medir — decodificando la imagen, no leyendo la
// cadena.
console.log("\n── LA CAPTURA: RESOLUCIÓN NATIVA Y PNG ──");
const captura = await page.evaluate(async () => {
  const { captureScreenshot } = await import("/src/ui/screenshot.ts");
  const url = captureScreenshot(document);
  if (!url) return { url: null };
  const img = new Image();
  img.src = url;
  await img.decode();
  // ¿Es NEGRA? Un búfer rancio daría dimensiones correctas y contenido vacío.
  const off = document.createElement("canvas");
  off.width = img.naturalWidth;
  off.height = img.naturalHeight;
  const g = off.getContext("2d");
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, off.width, off.height).data;
  const colores = new Set();
  for (let i = 0; i < d.length; i += 4 * 97) colores.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
  // Los canvas que hay, para que el veredicto se lea sin adivinar.
  const cvs = [...document.querySelectorAll("canvas")].map((c) => `${c.width}x${c.height}`);
  return { png: url.startsWith("data:image/png"), w: img.naturalWidth, h: img.naturalHeight,
           chars: url.length, colores: colores.size, cvs };
});
console.log("    " + JSON.stringify(captura));
ok(captura.png, "la captura es PNG (sin pérdida: es pixel art)", captura);
ok(captura.w === 320 && captura.h === 200,
   "y mide 320x200 — la resolución NATIVA del juego", captura);
// 🔴 LAS DOS RECÍPROCAS, que son las que dicen que se eligió BIEN el canvas:
ok(!(captura.w === 200 && captura.h === 125),
   "NO es la miniatura vieja de 200x125 (el reescalado con pérdida)", captura);
ok(!(captura.w === 960 && captura.h === 600),
   "y NO es el canvas VISIBLE de 960x600, que es un x3 sin informacion añadida", captura);
// 🔴 Y la que caza el fallo SILENCIOSO: dimensiones correctas con la imagen vacía.
ok(captura.colores > 1, "y tiene CONTENIDO, no es un búfer en negro", captura);

// ── LAS CAPTURAS VIEJAS SIGUEN VALIENDO ──────────────────────────────────────
// Invariante de compatibilidad. No basta con razonar «un <img> come las dos cosas»:
// se siembra una captura del formato ANTIGUO (jpeg) y se lee por la vía real.
const vieja = await page.evaluate(async () => {
  const JPEG_VIEJO =
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
  const { readSaveShot } = await import("/src/core/save-keys.ts");
  localStorage.setItem("u5clone:shot:antigua", JPEG_VIEJO);
  const leida = readSaveShot("antigua");
  const img = new Image();
  img.src = leida;
  await img.decode();
  return { igual: leida === JPEG_VIEJO, jpeg: leida.startsWith("data:image/jpeg"), w: img.naturalWidth };
});
console.log("    " + JSON.stringify(vieja));
ok(vieja.igual && vieja.jpeg,
   "una captura del formato ANTIGUO (jpeg) se lee INTACTA por readSaveShot", vieja);
ok(vieja.w === 1, "y decodifica de verdad: el navegador la pinta igual que antes", vieja);

await browser.close();
console.log(fallos.length ? `\n❌ ${fallos.length} FALLOS: ${fallos.join(" · ")}` : "\n✅ TODO VERDE");
process.exit(fallos.length ? 1 : 0);
