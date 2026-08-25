/**
 * MINIATURAS DE REPETICIÓN — la mitad que sólo se puede comprobar con el juego dentro.
 *
 * El gemelo de esta sonda es `game/tests/replay-thumb-ea-limpio.test.ts`, que corre en la
 * batería y guarda las invariantes de FORMA (que la foto no entre en el `ReplayLog`, que
 * no pueda viajar en un récord). Lo que aquí se mide es la CONDUCTA, que necesita un
 * IndexedDB de verdad y un canvas con el juego pintado:
 *
 *   1. Al parar una grabación se guarda una miniatura, y es una imagen CON CONTENIDO
 *      (no un rectángulo negro, que es como falla una captura mal hecha sin dar error).
 *   2. Una repetición SIN miniatura —toda la que se grabó antes de esta entrega— sale con
 *      su hueco rotulado y NO con una imagen rota.
 *   3. `ReplayMeta.bytes` NO se mueve al guardar la foto: la cifra que la lista enseña
 *      como coste del registro sigue siendo la del registro.
 *   4. Borrar una repetición se lleva su miniatura, y el borrado total no deja ninguna.
 *
 * Y deja capturas MIRADAS de la lista en escritorio y en móvil, con las dos clases de
 * fila (con foto y sin) presentes a la vez — que es el caso que hay que ver, porque el
 * defecto de una lista mixta es que las columnas se descuadren.
 *
 * 🔴 FUERA DE LA BATERÍA, con la razón: necesita chromium y `game/assets` (material de
 * EA, gitignored). Mismo criterio y mismo sitio que `verify-boot-save-replay.mjs`.
 *
 * Uso (desde la raíz del worktree):
 *   npx vite game --config game/vite.config.ts --port 5243 --strictPort &
 *   U5_PORT=5243 node game/tools/verify-replay-thumbs.mjs
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { chromium } = createRequire(resolve(RAIZ, "package.json"))("playwright");
const BASE = `http://localhost:${process.env.U5_PORT || 5243}`;
/**
 * 🔴 LAS CAPTURAS SALEN DEL REPO, y no es manía: un fotograma del juego son PÍXELES
 * RENDERIZADOS de EA y `docs/` es un árbol TRACKED (comprobado: `docs/verdicts/` no
 * está en .gitignore, así que un `git add -A` se las llevaría). El destino va al
 * temporal del sistema y lleva el NOMBRE DEL WORKTREE dentro: dos carriles corriendo
 * esta sonda a la vez escribirían en la misma carpeta y el segundo pisaría la evidencia
 * del primero. Se cambia con `U5_SHOTS=<dir>` cuando se quiera mirar en otro sitio.
 */
const SHOTS = process.env.U5_SHOTS || join(tmpdir(), `u5-verdicts-replay-thumbs-${basename(RAIZ)}`);
mkdirSync(SHOTS, { recursive: true });

const fallos = [];
const ok = (cond, etiqueta, visto) => {
  console.log(`${cond ? "  OK  " : "  FALLO"} ${etiqueta}${cond ? "" : `\n         visto: ${JSON.stringify(visto)}`}`);
  if (!cond) fallos.push(etiqueta);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push("pageerror: " + e.message));

async function arranca(q) {
  await page.goto(`${BASE}/${q}`);
  await page.waitForFunction(() => !!(window.__u5test && window.__u5test.state && window.__u5test.state()),
    null, { timeout: 120000 });
  await page.waitForTimeout(800);
}

/**
 * Abre el panel de repeticiones por el camino DEL USUARIO: F10 → drawer SISTEMA →
 * «Replays».
 *
 * 🔴 EL ITEM SE BUSCA DENTRO DEL DRAWER, no por texto suelto en la página. Un
 * `getByText(/Replays/)` casa ANTES con el `<h2>Replays</h2>` del propio panel —que
 * está en el DOM aunque esté oculto— y la sonda se queda esperando a que un título se
 * deje pulsar. Pasó en la primera versión: 15 s de timeout señalando al elemento
 * equivocado.
 *
 * 🔴 EL ESTADO DEL CAJÓN SE LEE DE SU CLASE `open`, y ningún otro predicado sirve. Dos
 * intentos fallidos, cada uno con su falso positivo:
 *   · `drawer.isVisible()` — el contenedor está SIEMPRE en el DOM y da `true` con el
 *     cajón cerrado (lo que se despliega es su contenido, por `transform`). Con esa
 *     guarda el F10 no se pulsa NUNCA (medido: `drawer=1/true · item=0`, tres intentos).
 *   · «¿existe el botón Replays?» — tras la primera apertura el botón SE QUEDA en el DOM
 *     y playwright lo da por visible aunque el cajón esté cerrado; el clic se va 30 s
 *     reintentando contra el CANVAS, que es quien recibe el puntero
 *     («<canvas> from <div class="shader-skin"> subtree intercepts pointer events»).
 * ★★ «Está en el DOM» y «se puede pulsar» son cosas distintas, y entre las dos hay una
 *    clase que lo dice.
 */
async function abrePanelReplays() {
  const panel = page.locator('[data-testid="u5-replay-panel"]');
  if (await panel.isVisible()) return;
  const abierto = page.locator('[data-testid="u5-shell-drawer"].open');
  // El item se busca por `aria-label` EXACTO y no por rol+nombre: el drawer pinta los
  // rótulos con la fuente de píxeles (`class="u5px"`, glifos en <span>), y el nombre
  // accesible que compone playwright a partir de esos hijos no casa con un `^Replays$`.
  // El atributo sí — y es el que el propio shell escribe.
  const item = page.locator('button[aria-label="Replays"], button[aria-label="Repeticiones"]');
  for (let intento = 0; intento < 4; intento++) {
    if (process.env.U5_DEBUG) {
      console.log(`     [abre] intento ${intento} · cajón abierto=${await abierto.count()} · panel=${await panel.isVisible()}`);
    }
    if (!(await abierto.count())) {
      await page.keyboard.press("F10");
      await page.waitForTimeout(900);
    }
    if (await abierto.count()) {
      await item.first().click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(800);
      if (await panel.isVisible()) return;
    }
    // Se deja el cajón CERRADO antes de reintentar: si no, el siguiente F10 lo cerraría
    // y el intento se gastaría en volver al punto de partida.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }
  await panel.waitFor({ state: "visible", timeout: 15000 });
}

/** Lee el almacén `thumbs` de la base `u5-replay` sin pasar por el módulo que se prueba. */
const leeThumbs = () => page.evaluate(() => new Promise((res, rej) => {
  const r = indexedDB.open("u5-replay");
  r.onerror = () => rej(r.error);
  r.onsuccess = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains("thumbs")) { db.close(); return res([]); }
    const q = db.transaction("thumbs", "readonly").objectStore("thumbs").getAll();
    q.onsuccess = () => { const v = q.result.map((f) => ({ id: f.id, bytes: f.png.length, png: f.png })); db.close(); res(v); };
    q.onerror = () => { db.close(); rej(q.error); };
  };
}));

const leeLogs = () => page.evaluate(() => new Promise((res, rej) => {
  const r = indexedDB.open("u5-replay");
  r.onerror = () => rej(r.error);
  r.onsuccess = () => {
    const db = r.result;
    const q = db.transaction("logs", "readonly").objectStore("logs").getAll();
    q.onsuccess = () => { const v = q.result.map((l) => ({ id: l.id, label: l.label, claves: Object.keys(l) })); db.close(); res(v); };
    q.onerror = () => { db.close(); rej(q.error); };
  };
}));

console.log("\n══ 1 · GRABAR y PARAR deja miniatura ══");
await arranca("?fresh&nointro");
ok(errores.length === 0, "el juego arranca sin errores de página", errores);

// Se graba por el MISMO camino que el usuario: el panel F10 y su botón. Un `startRec()`
// por el hook de test saltaría justo la ruta que se está verificando (la del botón que
// captura al parar), y daría verde sobre código no ejecutado.
await abrePanelReplays();
ok(await page.locator('[data-testid="u5-replay-panel"]').isVisible(), "el panel de repeticiones se abre");

await page.locator('[data-act="rec"]').click();
await page.waitForTimeout(300);
ok(await page.locator('[data-act="rec"]').getAttribute("data-recording") === "1", "la grabación está abierta");

// Se juega DE VERDAD con el panel cerrado: el panel se traga el teclado (stopPropagation).
await page.locator('[data-act="close"]').click();
await page.waitForTimeout(300);
for (let i = 0; i < 16; i++) {
  await page.keyboard.press(i % 2 ? "ArrowRight" : "ArrowDown");
  await page.waitForTimeout(80);
}
const turnoAlParar = await page.evaluate(() => window.__u5test.state().turnsSinceStart);
const semillaAntes = await page.evaluate(() => window.__u5test.game.liveSeed());

// Parar: el mismo botón. Se reabre el panel y se pulsa.
await abrePanelReplays();
await page.locator('[data-act="rec"]').click();
await page.waitForTimeout(1500);

const semillaDespues = await page.evaluate(() => window.__u5test.game.liveSeed());
ok(semillaAntes === semillaDespues,
  `CONTROL · capturar la miniatura NO movió el RNG (semilla ${semillaAntes}, y NO es 0 ⇒ el control no es vacuo)`,
  { semillaAntes, semillaDespues });
ok(semillaAntes !== 0, "CONTROL DEL CONTROL · la semilla no es 0 (si lo fuera, «no se movió» sería cierto igualmente)", semillaAntes);

const thumbs1 = await leeThumbs();
ok(thumbs1.length === 1, "se guardó UNA miniatura al parar", thumbs1.map((t) => t.id));
const t0 = thumbs1[0];
ok(!!t0 && t0.png.startsWith("data:image/png;base64,"), "la miniatura es un PNG", t0 && t0.png.slice(0, 40));
console.log(`     peso de la miniatura: ${t0 ? (t0.bytes / 1024).toFixed(1) : "?"} KB de dataURL`);

// NO-VACUIDAD de la captura: que exista un dataURL no dice que tenga dibujo. Una captura
// del canvas equivocado (o de un búfer en blanco) sale NEGRA, pesa poco y no da error.
const contenido = await page.evaluate(async (png) => {
  const img = new Image();
  await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = png; });
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  c.getContext("2d").drawImage(img, 0, 0);
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  const colores = new Set();
  for (let i = 0; i < d.length; i += 4) colores.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
  return { w: img.width, h: img.height, colores: colores.size };
}, t0.png);
ok(contenido.w === 320 && contenido.h === 200, "la miniatura es el búfer NATIVO 320x200", contenido);
ok(contenido.colores > 8, `la miniatura TIENE DIBUJO (${contenido.colores} colores, no un rectángulo liso)`, contenido);
// El fotograma se vuelca A TAMAÑO NATURAL para poder MIRARLO. En la captura de la lista
// va a 96x60 y ahí no se distingue una pantalla del juego de un borrón: el aserto de
// «tiene dibujo» dice que no es liso, no que sea LA PANTALLA.
writeFileSync(`${SHOTS}/miniatura-320x200.png`, Buffer.from(t0.png.split(",")[1], "base64"));
console.log(`     fotograma a tamaño natural: ${SHOTS}/miniatura-320x200.png`);

console.log("\n══ 2 · `bytes` del registro NO incluye la miniatura ══");
const logs = await leeLogs();
ok(logs.length === 1, "hay un registro", logs.map((l) => l.id));
const sinFoto = logs[0].claves.filter((k) => /thumb|png|shot|imagen|captur/i.test(k));
ok(sinFoto.length === 0, "el ReplayLog guardado NO tiene ningún campo de imagen", logs[0].claves);
const bytesLista = await page.evaluate(async () => {
  const m = await window.__u5thumbTest.listLogs();
  return m.map((x) => x.bytes);
}).catch(() => null);
if (bytesLista) {
  ok(bytesLista[0] < 60 * 1024, `el tamaño que enseña la lista (${(bytesLista[0] / 1024).toFixed(1)} KB) es el del registro, no registro+foto`, bytesLista);
} else {
  console.log("     (sin hook de listLogs en la página: el aserto de bytes se cubre por el campo, arriba)");
}

console.log("\n══ 3 · la fila SIN miniatura degrada con hueco rotulado ══");
// Se siembra una repetición VIEJA: el mismo registro que ya existe, con otro id y SIN
// pasar por `thumbs`. Es exactamente lo que hay en el navegador de quien ya grabó antes.
await page.evaluate(() => new Promise((res, rej) => {
  const r = indexedDB.open("u5-replay");
  r.onsuccess = () => {
    const db = r.result;
    const st = db.transaction("logs", "readwrite").objectStore("logs");
    const g = st.getAll();
    g.onsuccess = () => {
      const viejo = { ...g.result[0], id: "replay-antiguo-sin-foto", label: "Partida de antes (sin foto)", createdAt: 1 };
      const p = db.transaction("logs", "readwrite").objectStore("logs").put(viejo);
      p.onsuccess = () => { db.close(); res(); };
      p.onerror = () => { db.close(); rej(p.error); };
    };
  };
  r.onerror = () => rej(r.error);
}));

// Se REABRE el panel para que repinte la lista con las dos filas.
await page.locator('[data-act="close"]').click().catch(() => {});
await page.waitForTimeout(300);
await abrePanelReplays();
await page.waitForTimeout(900);

const conFoto = await page.locator('[data-testid="u5-replay-shot"]').count();
const sinFotoN = await page.locator('[data-testid="u5-replay-shot-vacia"]').count();
ok(conFoto === 1, "una fila lleva IMAGEN", conFoto);
ok(sinFotoN === 1, "la otra lleva el HUECO ROTULADO (no una imagen rota)", sinFotoN);
const rotulo = await page.locator('[data-testid="u5-replay-shot-vacia"]').first().textContent();
ok(!!rotulo && rotulo.trim().length > 0, "el hueco lleva rótulo y no está vacío", rotulo);
// Las dos variantes ocupan lo mismo: si no, la lista mixta sale descuadrada.
const cajas = await page.evaluate(() => {
  const a = document.querySelector('[data-testid="u5-replay-shot"]').getBoundingClientRect();
  const b = document.querySelector('[data-testid="u5-replay-shot-vacia"]').getBoundingClientRect();
  return { foto: [Math.round(a.width), Math.round(a.height)], hueco: [Math.round(b.width), Math.round(b.height)] };
});
ok(cajas.foto[0] === cajas.hueco[0] && cajas.foto[1] === cajas.hueco[1],
  "foto y hueco MIDEN LO MISMO (la lista mixta no se descuadra)", cajas);
ok(errores.length === 0, "sin errores de página en todo el recorrido", errores);

await page.screenshot({ path: `${SHOTS}/f10-escritorio.png` });
console.log(`     captura: ${SHOTS}/f10-escritorio.png`);

console.log("\n══ 4 · móvil (iPhone vertical) ══");
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(700);
await page.screenshot({ path: `${SHOTS}/f10-movil.png` });
const desborda = await page.evaluate(() => {
  const card = document.querySelector(".u5-replay-card");
  return card ? card.scrollWidth > card.clientWidth + 1 : null;
});
ok(desborda === false, "en móvil la tarjeta NO desborda en horizontal", desborda);
console.log(`     captura: ${SHOTS}/f10-movil.png`);
await page.setViewportSize({ width: 1280, height: 860 });
await page.waitForTimeout(400);

console.log("\n══ 5 · borrar se lleva la miniatura ══");
const idConFoto = t0.id;
await page.locator(`.u5-replay-row[data-id="${idConFoto}"] [data-act="delete"]`).click();
await page.waitForTimeout(1200);
const thumbs2 = await leeThumbs();
ok(!thumbs2.some((t) => t.id === idConFoto), "al borrar la repetición se fue su miniatura", thumbs2.map((t) => t.id));

console.log("\n══ 6 · el borrado TOTAL no deja ninguna ══");
// Se siembra otra foto para que el barrido tenga algo que barrer: con cero miniaturas
// «no queda ninguna» sería cierto sin que el barrido existiera.
await page.evaluate((png) => new Promise((res) => {
  const r = indexedDB.open("u5-replay");
  r.onsuccess = () => {
    const db = r.result;
    const p = db.transaction("thumbs", "readwrite").objectStore("thumbs").put({ id: "replay-antiguo-sin-foto", png });
    p.onsuccess = () => { db.close(); res(); };
  };
}), t0.png);
const antesDelBarrido = await leeThumbs();
ok(antesDelBarrido.length === 1, "CONTROL · hay una miniatura ANTES del borrado total (el barrido no se absuelve por vacío)", antesDelBarrido.length);
const borradas = await page.evaluate(() => window.__u5thumbTest ? window.__u5thumbTest.clearAllLogs() : null).catch(() => null);
if (borradas === null) {
  // Sin hook: se llama al mismo camino que usa /byo, importando el módulo servido por vite.
  await page.evaluate(async () => {
    const m = await import("/src/replay/store.ts");
    await m.clearAllLogs();
  });
}
const thumbs3 = await leeThumbs();
ok(thumbs3.length === 0, "tras el borrado total no queda NINGUNA miniatura", thumbs3.map((t) => t.id));

await browser.close();
console.log(`\n${fallos.length === 0 ? "TODO OK" : `${fallos.length} FALLOS:\n - ` + fallos.join("\n - ")}`);
process.exit(fallos.length === 0 ? 0 : 1);
