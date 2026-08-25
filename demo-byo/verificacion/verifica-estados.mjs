/**
 * VERIFICACIÓN EN NAVEGADOR REAL de los cinco estados de carga de /byo.
 *
 * 🔴 POR QUÉ NO ES UN GREP SOBRE EL HTML: la pantalla monta el panel POR JS. Medir el
 * HTML servido daría ausencias falsas, y medir el BUNDLE (que es el predicado válido
 * para «¿existe este literal?») sólo dice que el texto está compilado, no que llegue a
 * pintarse. Aquí se lee `#estado` de un Chromium de verdad.
 *
 * 🔴 Y SE MIDE LA SECUENCIA, NO LA FOTO FINAL. El estado «leyendo» estuvo escrito y
 * MUERTO: se ponía y se sustituía dentro del mismo turno de tareas, así que el navegador
 * no llegaba a dibujarlo nunca. Un aserto sobre el estado final lo daba por bueno; lo
 * cazó el `MutationObserver` de `ESPIA`, que registra todo texto que pasa por el panel.
 * ★★ Un estado transitorio se verifica con un REGISTRO, no con una lectura.
 *
 * Uso: ver la cabecera de `servidor-fixtures.mjs` (hay que levantarlo antes).
 * Depende de material de EA (gitignored) ⇒ NO va en la batería de aterrizaje.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { chromium } = createRequire(resolve(RAIZ, "package.json"))("playwright");

/**
 * Los cardinales SE DERIVAN de `REQUIRED_FILES`, no se escriben aquí.
 *
 * 🔴 ESTABAN A MANO («28 files», «25 of 28», «17 de los 28») y eso convertía la sonda en
 * un sitio más donde la cifra se queda rancia. Cuando la tabla creció de 28 a 31, una
 * sonda con el número escrito se habría puesto roja **acusando a la pantalla** de un
 * defecto que estaba en la sonda — o, peor, alguien la habría «arreglado» bajando el
 * número de la pantalla para que cuadrase. Un instrumento que fija la cifra que mide
 * deja de medirla.
 */
function requiredFiles() {
  const txt = readFileSync(resolve(RAIZ, "extractor/src/pipeline.ts"), "utf8");
  const m = txt.match(/export const REQUIRED_FILES[^{]*\{([\s\S]*?)\n\};/);
  if (!m) throw new Error("no se encontró REQUIRED_FILES: el parser de esta sonda está roto");
  const filas = [...m[1].matchAll(/^\s*"([^"]+)":\s*(\d+|null),/gm)].map((x) => ({
    nombre: x[1],
    tam: x[2] === "null" ? null : Number(x[2]),
  }));
  if (filas.length < 20) throw new Error(`sólo se leyeron ${filas.length} ficheros: parser roto`);
  return filas;
}
const FILAS = requiredFiles();
const TOTAL = FILAS.length;
const MEDIBLES = FILAS.filter((f) => f.tam !== null).length;
/** Los que el fixture `/fx/faltan` quita, y los que el `/fx/tamano` estropea. */
const AUSENTES = ["BRIT.DAT", "DUNGEON.DAT", "CASTLE.TLK"];
console.log(`(derivado de REQUIRED_FILES: ${TOTAL} exigidos · ${MEDIBLES} con tamaño comprobable)`);

const BASE = `http://localhost:${process.env.PORT || 5247}`;
const fallos = [];
const ok = (cond, etiqueta, visto) => {
  console.log(`${cond ? "  OK  " : "  FALLO"} ${etiqueta}${cond ? "" : `\n         visto: ${JSON.stringify(visto)}`}`);
  if (!cond) fallos.push(etiqueta);
};

// ── EL CORTE PEREZOSO DE `fflate`, COMPROBADO EN EL ARTEFACTO ────────────────────────
//
// 🔴 EL PREDICADO POR NOMBRE DA EL VEREDICTO CONTRARIO, y está medido: grepear
// `unzipSync|fflate` en el bundle EAGER casa — pero lo que casa es **la expresión del
// import dinámico**, no el cuerpo de la librería. Y las huellas por identificador
// (`fleb`, `flrb`, los nombres internos de fflate) dan «no» aunque la librería esté,
// porque **el minificador está diseñado para destruir los nombres**. Un predicado por
// identificador sobre un artefacto minificado no es frágil: es sistemáticamente falso.
//
// ⇒ Se buscan DATOS que la minificación no puede tocar: la tabla de bits extra de DEFLATE
// (valores literales) y tres cadenas de error de inflate. Tienen que estar en el chunk
// perezoso y NO estar en el eager.
//
// Esto se comprueba aquí y no a mano porque es justo lo que hay que RE-MEDIR cada vez que
// se toque el árbol de dependencias: hasta el 07-08 `fflate` estaba en el árbol por
// accidente (transitiva de posthog) y después está porque se declara. Es el mismo 0.4.9 y
// se espera cero diferencias — pero **esperar cero y medir cero no son lo mismo**.
{
  console.log("\n── CORTE PEREZOSO DE fflate (artefacto de build) ──");
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const dir = resolve(RAIZ, "demo-byo/dist/byo-static");
  const js = readdirSync(dir).filter((f) => f.endsWith(".js"));
  const eager = js.find((f) => f.startsWith("byo-"));
  const TABLA_DEFLATE = "0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0";
  const ERRORES = ["unexpected EOF", "invalid distance", "invalid length"];
  const huella = (t) => t.includes(TABLA_DEFLATE) && ERRORES.every((e) => t.includes(e));

  const textos = Object.fromEntries(js.map((f) => [f, readFileSync(resolve(dir, f), "utf8")]));
  const perezosos = js.filter((f) => f !== eager && huella(textos[f]));
  ok(perezosos.length === 1, "fflate vive en UN chunk aparte (huella por DATOS)", { js, perezosos });
  ok(!huella(textos[eager]), "y NO está en el bundle eager: el corte sigue en pie", eager);
  if (perezosos.length === 1) {
    const n = statSync(resolve(dir, perezosos[0])).size;
    console.log(`    perezoso: ${perezosos[0]} · ${n} B · eager: ${statSync(resolve(dir, eager)).size} B`);
  }
}

// Registra TODO texto que pase por #estado (para cazar el estado transitorio 02).
const ESPIA = `
  window.__estados = [];
  const arranca = () => {
    const n = document.getElementById("estado");
    if (!n) return setTimeout(arranca, 5);
    const anota = () => { const t = n.innerText.trim(); if (t && window.__estados.at(-1) !== t) window.__estados.push(t); };
    new MutationObserver(anota).observe(n, { childList: true, subtree: true, characterData: true });
    anota();
  };
  arranca();
`;

const browser = await chromium.launch();

async function pagina(lang) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(ESPIA);
  await ctx.addInitScript(`try { localStorage.setItem("openu5-lang", ${JSON.stringify(lang)}); } catch (e) {}`);
  const page = await ctx.newPage();
  const errores = [];
  page.on("console", (m) => m.type() === "error" && errores.push(m.text()));
  page.on("pageerror", (e) => errores.push("pageerror: " + e.message));
  return { ctx, page, errores };
}

const panel = (page) => page.locator("#estado").innerText();

// ── DOS SONDAS DE PRESENTACIÓN, Y POR QUÉ EXISTEN ────────────────────────────────────
//
// 🔴 EL DÍA QUE HICIERON FALTA. Al rediseñar la tarjeta de partida sustituí un RANGO de
// CSS delimitado por dos anclas de texto, y entre esas anclas vivían —sin que yo las
// mirara— las 11 reglas del visor Y LAS 6 DEL `.replay-modal`, que ni siquiera son de
// este carril: llegaron por main desde otro. Las borré las 17 de una vez.
// Los dos modales siguieron abriendo, cerrando, poniéndose `:modal`, atrapando el foco,
// respondiendo a Escape y matando su iframe. **Las 167 sondas de este fichero siguieron
// verdes.** El defecto sólo apareció en una CAPTURA DE PANTALLA: sin `display:flex` la
// barra dejó de repartir, y el «Cerrar» se montó encima del título.
//
// ★★ UNA SUITE DE COMPORTAMIENTO ES CIEGA A LA PRESENTACIÓN. No es un descuido de la
//    suite: es su alcance. Si la presentación puede romperse sola —y aquí puede, porque
//    el CSS de tres carriles convive en un `<style>` de un solo fichero— hay que medir
//    algo de ella, y lo más barato con dientes es la GEOMETRÍA.
//
// Son dos y NO se solapan: `cromo` sabe qué debe pasar y sólo protege lo que alguien
// pensó en proteger. `huerfanas` no sabe nada de nada: cruza las clases que el bundle
// pone de verdad en el DOM contra los selectores que existen, y por eso es la que habría
// cazado la pérdida del `.replay-modal` sin que nadie hubiera escrito jamás una línea
// sobre el popover de repetición.
//
// 🔴 Y LA PROPIEDAD QUE MIDE `cromo` NO ES LA PRIMERA QUE ESCRIBÍ. Empecé con «el cerrar
// va DESPUÉS del título» (`cerrar.x > titulo.d`) y el mutante lo puso rojo… por CERO
// píxeles: sin flex los dos caen en flujo en línea y el botón empieza EXACTAMENTE donde
// acaba el título (medido: 439 y 439). Con un título una letra más corto, ese aserto
// habría pasado VERDE sobre el mismo layout roto — habría sido verde por el testigo, no
// por el código. La propiedad que el diseño afirma de verdad es el `space-between`: el
// cerrar va PEGADO AL BORDE DERECHO de la barra, y eso no depende de cuánto mida el
// título. Se quedan las dos: la segunda es la que tiene dientes, la primera es barata.

/** Geometría de la barra de un modal: dónde acaba el título y dónde empieza el cerrar. */
const cromo = (page, sel) =>
  page.evaluate((s) => {
    const d = document.querySelector(s);
    if (!d) return null;
    const barra = d.querySelector('[class$="__barra"]');
    if (!barra) return { barra: null };
    const cerrarEl = barra.querySelector('[class$="__cerrar"]');
    // El título es el otro hijo de la barra. El visor le pone clase; el popover de
    // repetición usa un `<strong>` pelado — se localiza por posición, no por nombre.
    const tituloEl = [...barra.children].find((n) => n !== cerrarEl);
    const caja = (e) => (e ? { x: Math.round(e.getBoundingClientRect().x),
                               d: Math.round(e.getBoundingClientRect().right) } : null);
    return { display: getComputedStyle(barra).display,
             barra: caja(barra), titulo: caja(tituloEl), cerrar: caja(cerrarEl) };
  }, sel);

/**
 * Clases que el DOM lleva puestas y para las que NO existe ni una regla. Se limita a
 * NUESTRAS familias: una clase puede existir legítimamente sin estilo (gancho de JS o de
 * sonda), así que el censo no puede ser universal sin volverse ruido.
 */
const huerfanas = (page) =>
  page.evaluate(() => {
    const conRegla = new Set();
    const recorre = (lista) => {
      for (const r of lista) {
        if (r.selectorText)
          for (const m of r.selectorText.matchAll(/\.([A-Za-z0-9_-]+)/g)) conRegla.add(m[1]);
        if (r.cssRules) recorre(r.cssRules); // @media, @supports, :is()… anidadas
      }
    };
    for (const hoja of document.styleSheets) {
      try { recorre(hoja.cssRules); } catch { /* hoja de otro origen: no es nuestra */ }
    }
    const FAMILIAS = /^(visor|replay-modal|guardado)(__|--|$)/;
    const vistas = new Set();
    for (const el of document.querySelectorAll("*")) for (const c of el.classList) vistas.add(c);
    return [...vistas].filter((c) => FAMILIAS.test(c) && !conRegla.has(c)).sort();
  });

// ── 01 · VACIO ────────────────────────────────────────────────────────────────
console.log("\n── ESTADO 01 · VACIO ──");
{
  const { ctx, page, errores } = await pagina("en");
  await page.goto(`${BASE}/byo`);
  await page.waitForSelector("#estado .est");
  const t = await panel(page);
  console.log(t.replace(/^/gm, "    | "));
  ok(t.includes("Nothing dropped yet"), "01 rotula el estado vacio", t);
  ok(t.includes(`${TOTAL} files`), `01 dice los ${TOTAL} exigidos (derivados de REQUIRED_FILES)`, t);
  ok(!/\b27 files\b/.test(t), "01 NO dice 27 (la cifra inventada de la propuesta)", t);
  ok(!t.includes("AVATAR.EXE"), "01 no menciona AVATAR.EXE (no se valida)", t);
  ok(errores.length === 0, "01 sin errores de consola", errores);
  await ctx.close();
}

// ── 03 · INCOMPLETO ───────────────────────────────────────────────────────────
console.log("\n── ESTADO 03 · INCOMPLETO ──");
{
  const { ctx, page, errores } = await pagina("en");
  await page.goto(`${BASE}/byo?fetchsrc=/fx/faltan`);
  await page.waitForSelector("#estado .est--falta", { timeout: 180000 });
  const t = await panel(page);
  console.log(t.replace(/^/gm, "    | "));
  const okFaltan = TOTAL - AUSENTES.length;
  ok(t.toLowerCase().includes(`${okFaltan} of ${TOTAL} files`), `03 censo ${okFaltan} de ${TOTAL}`, t);
  ok(t.includes(`${AUSENTES.length} files are missing`), "03 dice cuantos faltan", t);
  for (const n of AUSENTES) ok(t.includes(n), `03 nombra ${n}`, t);
  ok(t.includes("go up one"), "03 da el siguiente paso (subir una carpeta)", t);
  const botones = await page.locator("#estado button").allInnerTexts();
  ok(botones.includes("Pick another folder"), "03 ofrece elegir otra carpeta", botones);
  const href = await page.locator("#estado a").getAttribute("href");
  ok(href === "/en/play", "03 enlaza la lista completa al espejo ingles", href);
  ok(errores.length === 0, "03 sin errores de consola", errores);
  await ctx.close();
}

// ── 04 · OTRA EDICION ─────────────────────────────────────────────────────────
console.log("\n── ESTADO 04 · OTRA EDICION ──");
{
  const { ctx, page, errores } = await pagina("es");
  await page.goto(`${BASE}/byo?fetchsrc=/fx/tamano`);
  await page.waitForSelector("#estado .est--parcial", { timeout: 180000 });
  await page.waitForFunction(() => document.getElementById("estado").innerText.includes("DUNGEON.CBT"), null, { timeout: 180000 });
  const t = await panel(page);
  console.log(t.replace(/^/gm, "    | "));
  ok(t.toLowerCase().includes(`${TOTAL - 1} de ${TOTAL} ficheros`), `04 censo ${TOTAL - 1} de ${TOTAL}`, t);
  ok(t.includes("DUNGEON.CBT mide 39.168 B, esperábamos 39.424"),
     "04 pinta la EVIDENCIA con las dos cifras", t);
  ok(t.includes("Puede funcionar en parte"), "04 no da veredicto: dice lo que puede pasar", t);
  ok(t.includes(`${MEDIBLES} de los ${TOTAL}`), "04 declara el ALCANCE parcial de la comprobacion", t);
  ok(!/no compatible|incompatible|no reconocida/i.test(t), "04 no afirma incompatibilidad", t);
  const botones = await page.locator("#estado button").allInnerTexts();
  ok(botones.includes("Intentarlo igualmente"), "04 deja intentarlo", botones);
  ok(errores.length === 0, "04 sin errores de consola", errores);

  // El cambio de idioma REPINTA el panel (y no lo destruye).
  await page.click("#idioma");
  await page.waitForFunction(() => document.getElementById("estado").innerText.includes("we expected"), null, { timeout: 60000 });
  const t2 = await panel(page);
  ok(t2.includes("DUNGEON.CBT is 39,168 B, we expected 39,424"),
     "04 el panel sigue al idioma, con separador de miles ingles", t2);
  ok((await page.locator("#estado button").count()) === 2,
     "04 los botones SOBREVIVEN al cambio de idioma", await page.locator("#estado button").allInnerTexts());
  await ctx.close();
}

// ── 02 + 05 · LEYENDO y LISTO ─────────────────────────────────────────────────
console.log("\n── ESTADOS 02 (leyendo/extrayendo) y 05 (listo) ──");
{
  const { ctx, page, errores } = await pagina("en");
  await page.goto(`${BASE}/byo?fetchsrc=/fx/completo`);
  await page.waitForSelector("#estado .est--listo", { timeout: 180000 });
  const t = await panel(page);
  console.log(t.replace(/^/gm, "    | "));
  const secuencia = await page.evaluate(() => window.__estados);
  console.log("    secuencia de estados vistos:");
  for (const s of secuencia) console.log(`      · ${s.split("\n")[0]}`);
  ok(secuencia.some((s) => s.startsWith("Reading your folder…")), "02 muestra LEYENDO", secuencia);
  ok(secuencia.some((s) => s.startsWith("Generating the assets in your browser…")),
     "02 muestra EXTRAYENDO", secuencia);
  ok(/Extraction complete: [\d,]+ assets/.test(t), "05 rotula el exito con el numero de recursos", t);
  ok(t.includes("won't have to do this again"), "05 dice que no hay que repetirlo", t);
  ok(!/offline/i.test(t), "05 NO promete «funciona sin conexion» (ficha #65, refutada)", t);
  const jugar = await page.locator("#play").isVisible();
  ok(jugar, "05 el boton de jugar aparece", jugar);
  ok(errores.length === 0, "05 sin errores de consola", errores);
  await ctx.close();
}

// ── 04 → «Intentarlo igualmente» ──────────────────────────────────────────────
console.log("\n── 04 · el boton «Intentarlo igualmente» hace algo ──");
{
  const { ctx, page } = await pagina("en");
  await page.goto(`${BASE}/byo?fetchsrc=/fx/tamano`);
  await page.waitForFunction(() => document.getElementById("estado").innerText.includes("DUNGEON.CBT"), null, { timeout: 180000 });
  await page.getByRole("button", { name: "Try it anyway" }).click();
  await page.waitForFunction(
    () => !document.getElementById("estado").innerText.includes("DUNGEON.CBT is"),
    null, { timeout: 180000 },
  );
  const t = await panel(page);
  console.log(t.replace(/^/gm, "    | "));
  ok(!t.includes("DUNGEON.CBT is"), "04 el boton lanza la extraccion de verdad", t);
  await ctx.close();
}

// ── LA VÍA DEL ZIP ────────────────────────────────────────────────────────────
// 🔴 SE PRUEBA CON UN ZIP DE VERDAD Y POR EL `<input>` DE VERDAD. Comprobar que el
// chunk perezoso existe sólo dice que el bundler lo separó; que `collectZip` compila
// sólo dice que los tipos cuadran. Lo único que dice que la vía SIRVE es meter un zip
// por el mismo control que usaría alguien desde un teléfono y ver salir los estados.
console.log("\n── VÍA DEL ZIP ──");
{
  const { zipSync } = createRequire(resolve(RAIZ, "package.json"))("fflate");
  const { readdirSync, readFileSync, statSync, writeFileSync, mkdtempSync } =
    await import("node:fs");
  const { tmpdir } = await import("node:os");
  const U5 = resolve(RAIZ, "original/u5/ultima5");
  const entradas = {};
  for (const n of readdirSync(U5)) {
    const p = resolve(U5, n);
    const st = statSync(p);
    // Con la carpeta DENTRO del zip, que es como comprime cualquiera: así se prueba
    // además que `collectZip` se queda con el NOMBRE y tira la ruta.
    if (st.isFile() && st.size <= 8 * 1024 * 1024) entradas[`ultima5/${n}`] = readFileSync(p);
  }
  const dir = mkdtempSync(resolve(tmpdir(), "u5-zip-"));
  const ruta = resolve(dir, "ultima5.zip");
  writeFileSync(ruta, zipSync(entradas, { level: 6 }));
  console.log(`    zip de prueba: ${statSync(ruta).size} B · ${Object.keys(entradas).length} entradas, con carpeta dentro`);

  const { ctx, page, errores } = await pagina("en");
  await page.goto(`${BASE}/byo`);
  await page.waitForSelector("#estado .est");
  const via = await page.locator("#via-zip").innerText();
  ok(/phone/i.test(via), "la vía del zip se OFRECE, y dice por qué (móvil)", via);

  // Por el input real, que es lo único que un teléfono puede usar.
  await page.setInputFiles("#picker-zip", ruta);
  await page.waitForSelector("#estado .est--listo", { timeout: 180000 });
  const t = await panel(page);
  console.log(t.replace(/^/gm, "    | "));
  const secuencia = await page.evaluate(() => window.__estados);
  ok(secuencia.some((s) => s.startsWith("Reading your folder…")), "zip: pasa por LEYENDO", secuencia);
  ok(/Extraction complete: [\d,]+ assets/.test(t), "zip: termina en LISTO con sus recursos", t);
  ok(await page.locator("#play").isVisible(), "zip: aparece el botón de jugar", true);
  ok(errores.length === 0, "zip sin errores de consola", errores);
  await ctx.close();
}

// Un zip ROTO tiene que dar SU fallo, no «te faltan 31 ficheros».
console.log("\n── VÍA DEL ZIP · archivo corrupto ──");
{
  const { writeFileSync, mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(resolve(tmpdir(), "u5-zipmal-"));
  const ruta = resolve(dir, "roto.zip");
  writeFileSync(ruta, Buffer.from("PK esto no es un zip de verdad"));

  const { ctx, page } = await pagina("en");
  await page.goto(`${BASE}/byo`);
  await page.waitForSelector("#estado .est");
  await page.setInputFiles("#picker-zip", ruta);
  await page.waitForSelector("#estado .est--falta", { timeout: 30000 });
  const t = await panel(page);
  console.log(t.replace(/^/gm, "    | "));
  ok(/couldn't open that \.zip/i.test(t), "zip roto: da SU fallo, no una lista de ausencias", t);
  ok(!/files are missing/i.test(t), "zip roto: NO manda a buscar ficheros que no faltan", t);
  await ctx.close();
}

// ── BLOQUE 2a · procedencia, «tus datos» y la palabra «demo» ──────────────────
console.log("\n── BLOQUE 2a ──");
{
  const { ctx, page, errores } = await pagina("en");
  await page.goto(`${BASE}/byo`);
  await page.waitForSelector("#estado .est");
  const texto = await page.locator("main").innerText();

  // J4 (ALTO de la auditoría): la palabra «demo» decía que esto es una muestra
  // recortada, cuando es el juego entero con TU copia.
  ok(!/\bdemo\b/i.test(texto), "2a · la palabra «demo» ya no está en la página", texto.match(/.{0,40}demo.{0,40}/i));
  ok(/engine, not the game/i.test(texto), "2a · el hero dice motor-no-juego", texto.slice(0, 200));

  // Las cuatro tarjetas de procedencia, y que la bifurcación EXISTE: `innoextract`
  // sólo dentro de la del instalador, no soltado a todo el mundo en el primer párrafo.
  const tarjetas = await page.locator(".tarjetas li").allInnerTexts();
  ok(tarjetas.length === 4, "2a · cuatro tarjetas de procedencia", tarjetas.length);
  const conInno = tarjetas.filter((t) => /innoextract/i.test(t));
  ok(conInno.length === 1 && /GOG installer/i.test(conInno[0]),
     "2a · innoextract SÓLO en la tarjeta del instalador", conInno);
  ok(/does not bundle, host or redistribute/i.test(texto), "2a · el «no incluido» está", true);

  // Cifras prohibidas por CIFRAS-WEB §5 que la maqueta traía.
  for (const veneno of ["2.4 MB", "27 files", "AVATAR.EXE", "TILES.EGA", "7.9 KB"])
    ok(!texto.includes(veneno), `2a · NO reaparece «${veneno}»`, texto.includes(veneno));

  ok(/Read here, kept here, erasable here/i.test(texto), "2a · el bloque «tus datos» está", true);
  ok(errores.length === 0, "2a sin errores de consola", errores);
  await ctx.close();
}

// 🔴 «Lo puedes borrar aquí» se comprueba BORRANDO. Que el botón exista es forma; que
// la caché quede vacía es función.
console.log("\n── BLOQUE 2a · el botón de borrar BORRA ──");
{
  const { ctx, page } = await pagina("en");
  await page.goto(`${BASE}/byo?fetchsrc=/fx/completo`);
  await page.waitForSelector("#estado .est--listo", { timeout: 180000 });
  const antes = await page.evaluate(async () => (await caches.open("u5-assets-v1")).keys().then((k) => k.length));
  ok(antes > 0, "hay extracción guardada antes de borrar", antes);

  await page.getByRole("button", { name: /Erase my files/i }).click();
  await page.waitForFunction(() => /Erased/i.test(document.getElementById("tus-datos").innerText), null, { timeout: 30000 });
  const despues = await page.evaluate(async () => (await caches.open("u5-assets-v1")).keys().then((k) => k.length));
  ok(despues === 0, "la CACHÉ queda vacía de verdad (no sólo el rótulo)", { antes, despues });
  ok(!(await page.locator("#play").isVisible()), "y el botón de jugar desaparece", true);
  const est = await panel(page);
  ok(/Nothing dropped yet/i.test(est), "y la pantalla vuelve al estado 01", est);
  await ctx.close();
}

// ── 2c · LA PÁGINA A ANCHO DE TELÉFONO ────────────────────────────────────────
// 🔴 SE MIDE EN UN VIEWPORT DE TELÉFONO, no se supone por el CSS. Aquí salió el defecto
// que ningún aserto funcional podía ver: el botón del `.zip` medía 156×20 px. Veinte
// píxeles de alto es una diana inclicable con el dedo — y es EL control del móvil, el
// único camino que un teléfono tiene para entregar su copia. La vía existía, compilaba y
// pasaba en verde... y en el dispositivo para el que se hizo costaba pulsarla.
// ★★ «Funciona» y «se puede usar donde tiene que usarse» son dos propiedades distintas.
console.log("\n── 2c · ANCHO DE TELÉFONO ──");
{
  const { devices } = createRequire(resolve(RAIZ, "package.json"))("playwright");
  for (const nombre of ["iPhone SE", "iPhone 13"]) {
    const ctx = await browser.newContext({ ...devices[nombre] });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/byo`);
    await page.waitForSelector("#estado .est");
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const b = document.querySelector("#via-zip button")?.getBoundingClientRect();
      return {
        desborda: de.scrollWidth > de.clientWidth,
        ancho: de.clientWidth,
        alturaZip: b ? Math.round(b.height) : 0,
      };
    });
    ok(!m.desborda, `2c · ${nombre}: la página NO hace scroll lateral`, m);
    ok(m.alturaZip >= 44, `2c · ${nombre}: el botón del .zip es pulsable con el dedo (≥44 px)`, m);
    await ctx.close();
  }
}

// ── LA RECÍPROCA DEL PUENTE §NAV-BYO ──────────────────────────────────────────
//
// Lo que YA está garantizado por guarda dura del ensamblador es «la barra ESTÁ»: si
// falta, el build no llega a desplegarse. Lo que NO estaba garantizado por nada es la
// RECÍPROCA — que el botón de idioma que inyecta el bundle quede ESCONDIDO. Si el puente
// cambia y deja de taparlo, aparecen DOS mandos para un mismo ajuste, uno de ellos de
// 29 px. Es el defecto de los toggles y el de la diana pequeña, a la vez.
//
// 🔴 EL PUENTE SE EXTRAE DEL ENSAMBLADOR, NO SE REESCRIBE AQUÍ. Una copia del código que
// se quiere verificar sólo se verifica a sí misma — y esta tarde ya hubo que retirar una
// copia a mano de `REQUIRED_FILES` por lo mismo. Si alguien toca el puente y deja de
// esconder el botón, este aserto se pone rojo porque está midiendo SU código.
//
// ⚠️ ALCANCE DECLARADO: la sonda sirve `demo-byo/dist`, donde la barra NO está (la inyecta
// el ensamblador en el sitio). Así que aquí NO se comprueba «en producción está
// escondido» — se comprueba «este puente, sobre esta página, lo esconde». La otra mitad
// —que el puente se inyecta siempre— es la guarda del ensamblador, que ya existe.
console.log("\n── RECÍPROCA §NAV-BYO: el puente esconde el botón del bundle ──");
{
  const { readFileSync } = await import("node:fs");
  const sh = readFileSync(resolve(RAIZ, "docs/publicacion/build-demo-publica.sh"), "utf8");
  const m = sh.match(/cat <<'PUENTEBYO'\n([\s\S]*?)\nPUENTEBYO\n/);
  if (!m) throw new Error("no se pudo extraer el puente §NAV-BYO del ensamblador: ¿cambió el heredoc?");
  const puente = m[1];

  const { ctx, page } = await pagina("en");
  await page.goto(`${BASE}/byo`);
  await page.waitForSelector("#idioma"); // lo crea el bundle al hidratar
  ok(await page.locator("#idioma").isVisible(), "control: sin puente, el botón del bundle SE VE", true);
  await page.evaluate(puente);
  await page.waitForFunction(() => {
    const b = document.getElementById("idioma");
    return b && b.hidden;
  }, null, { timeout: 10000 }).catch(() => {});
  ok(!(await page.locator("#idioma").isVisible()),
     "con el puente, el botón del bundle queda ESCONDIDO (no hay dos mandos de idioma)", true);
  await ctx.close();
}

// ── BLOQUE 2d · PARTIDAS GUARDADAS Y REPETICIONES ─────────────────────────────
//
// 🔴 LAS CLAVES DE ALMACENAMIENTO SE DERIVAN DE SU MÓDULO, no se escriben aquí. Es la
// misma regla que ya rige `REQUIRED_FILES` en esta sonda, y por la misma razón: si la
// sonda sembrara «u5clone:saves» a mano y alguien renombrara la clave, la sonda seguiría
// verde sembrando en un sitio que ya nadie lee — mediría su propia copia. Derivándola,
// la siembra entra por LA MISMA puerta por la que el juego escribe.
//
// ⚠️ ALCANCE DECLARADO: aquí se comprueba que la pantalla LEE Y PINTA lo que el juego
// dejó en este origen, y que los enlaces apuntan a donde tienen que apuntar. NO se
// comprueba que `/play.html?save=<id>` cargue esa partida: esta sonda sirve
// `demo-byo/dist`, donde el juego no existe. Esa mitad es del arranque del juego.
function clavesDeAlmacen() {
  const sk = readFileSync(resolve(RAIZ, "game/src/core/save-keys.ts"), "utf8");
  const st = readFileSync(resolve(RAIZ, "game/src/replay/store.ts"), "utf8");
  const saca = (txt, nombre, fichero) => {
    const m = txt.match(new RegExp(`${nombre}\\s*=\\s*"([^"]+)"`));
    if (!m) throw new Error(`no se pudo derivar ${nombre} de ${fichero}: el parser está roto`);
    return m[1];
  };
  return {
    indice: saca(sk, "SAVES_INDEX_KEY", "save-keys.ts"),
    prefijo: saca(sk, "SAVE_SLOT_PREFIX", "save-keys.ts"),
    db: saca(st, "DB_NAME", "store.ts"),
    almacen: saca(st, "STORE", "store.ts"),
  };
}
const CLAVES = clavesDeAlmacen();
console.log(
  `\n(derivado de save-keys.ts / store.ts: índice «${CLAVES.indice}» · prefijo «${CLAVES.prefijo}»` +
    ` · IndexedDB «${CLAVES.db}»/«${CLAVES.almacen}»)`,
);

/**
 * Dos partidas y una repetición, con la MISMA forma que escribe el juego.
 *
 * 🔴 EL TURNO DE LA PRIMERA TIENE CINCO CIFRAS A PROPÓSITO, y costó un rojo averiguarlo:
 * con 1240 la sonda esperaba «1.240» en español y la pantalla pintaba «1240» — y la
 * pantalla tenía razón, porque `es-ES` NO pone separador de millares hasta la QUINTA
 * cifra. O sea que un número de cuatro cifras es el peor testigo posible para comprobar
 * el formato español: es justo el caso en el que los dos idiomas coinciden, así que el
 * aserto habría pasado igual con el formateo ROTO. Con cinco cifras los dos ponen
 * separador y ponen UNO DISTINTO (12,400 · 12.400), que es lo que se quiere medir.
 */
const PARTIDAS = [
  { id: "save-abc", name: "Antes del pozo", timestamp: 1754500000000, turns: 12400, locationName: "Britannia" },
  { id: "autosave-1", name: "Autosave 1", timestamp: 1754400000000, turns: 980, locationName: "Yew" },
];
const REPETICIONES = [
  {
    v: 1, id: "rep-xyz", label: "Britannia · turno 120", createdAt: 1754450000000,
    anchor: { state: "{}", seed: 7 }, keys: "abc", turns: "abc", mods: "", count: 342, lastTurn: 120,
  },
];

/**
 * Siembra el almacén del origen y recarga. Se siembra DESPUÉS de una primera carga
 * (hace falta un documento del origen para tocar su localStorage/IndexedDB) y se
 * recarga para que la página lea lo sembrado en su arranque normal, igual que haría
 * quien vuelve al sitio con partidas de ayer.
 */
async function siembra(page, { partidas = [], repeticiones = [], copia = false }) {
  await page.evaluate(
    async ({ partidas, repeticiones, copia, CLAVES }) => {
      localStorage.setItem(CLAVES.indice, JSON.stringify(partidas));
      for (const p of partidas) localStorage.setItem(CLAVES.prefijo + p.id, "{}");
      if (repeticiones.length) {
        const db = await new Promise((res, rej) => {
          const r = indexedDB.open(CLAVES.db, 1);
          r.onupgradeneeded = () => {
            const d = r.result;
            if (!d.objectStoreNames.contains(CLAVES.almacen)) {
              d.createObjectStore(CLAVES.almacen, { keyPath: "id" }).createIndex("createdAt", "createdAt");
            }
          };
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
        await new Promise((res, rej) => {
          const tx = db.transaction(CLAVES.almacen, "readwrite");
          for (const l of repeticiones) tx.objectStore(CLAVES.almacen).put(l);
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        });
        db.close();
      }
      // El ancla de `hasExtraction()` es el manifest en la caché. Se siembra en vez de
      // extraer de verdad (tres minutos) porque aquí NO se está probando la extracción:
      // se está probando la rama «hay copia / no hay copia» de la lista de partidas.
      if (copia) {
        const c = await caches.open("u5-assets-v1");
        await c.put(new Request("/assets/manifest.json"), new Response("{}"));
      }
    },
    { partidas, repeticiones, copia, CLAVES },
  );
  await page.reload();
  await page.waitForSelector("#partidas .guardados");
}

const lee = (page) => page.locator("#partidas").innerText();

console.log("\n── 2d · SIN PARTIDAS NI REPETICIONES ──");
{
  const { ctx, page, errores } = await pagina("en");
  await page.goto(`${BASE}/byo`);
  await page.waitForSelector("#partidas .guardados");
  const t = await lee(page);
  console.log(t.replace(/^/gm, "    | "));
  ok(/No saved games in this browser yet/i.test(t), "2d · sin partidas lo DICE", t);
  ok(/haven't recorded any replays/i.test(t), "2d · sin repeticiones lo DICE", t);
  // 🔴 El defecto que esta pantalla acaba de cerrar era un mando decorativo. La sección
  // vacía tiene que ser TEXTO y nada más: ni un botón que no lleve a ningún sitio.
  ok((await page.locator("#partidas button").count()) === 0,
     "2d · vacío = CERO botones (ni un control muerto)",
     await page.locator("#partidas button").allInnerTexts());
  ok((await page.locator("#partidas a").count()) === 0,
     "2d · vacío = CERO enlaces", await page.locator("#partidas a").allInnerTexts());
  // Y no se promete lo que no existe: ni subir, ni tabla, ni compartir.
  ok(/no leaderboard/i.test(t), "2d · dice que no hay tabla de récords ni forma de subir", t);
  ok(errores.length === 0, "2d vacío sin errores de consola", errores);
  await ctx.close();
}

console.log("\n── 2d · CON PARTIDAS, REPETICIONES Y COPIA ──");
{
  const { ctx, page, errores } = await pagina("en");
  await page.goto(`${BASE}/byo`);
  await siembra(page, { partidas: PARTIDAS, repeticiones: REPETICIONES, copia: true });
  const t = await lee(page);
  console.log(t.replace(/^/gm, "    | "));

  // Las DOS partidas, con los CUATRO campos que `SaveMeta` guarda. Nada inventado.
  for (const p of PARTIDAS) {
    ok(t.includes(p.name), `2d · lista «${p.name}»`, t);
    ok(t.includes(p.locationName), `2d · con su lugar (${p.locationName})`, t);
  }
  ok(/turn 12,400/.test(t), "2d · el turno, con separador de miles inglés", t);
  ok(t.includes("Britannia · turno 120"), "2d · lista la repetición por su rótulo", t);
  ok(/342 keys · 120 turns/.test(t), "2d · con teclas y turnos de la grabación", t);

  // La más reciente PRIMERO: quien vuelve quiere la última.
  const nombres = await page.locator("#partidas .guardado__nombre").allInnerTexts();
  ok(nombres[0] === "Antes del pozo", "2d · orden: la más reciente primero", nombres);

  // 🔴 EL DESTINO, que es lo que hace que «continuar» signifique ESTA partida y no
  // «la última». Sin el parámetro, cinco filas llevarían todas al mismo sitio.
  const hrefs = await page.locator("#partidas a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  ok(hrefs.includes("/play.html?save=save-abc"), "2d · «continuar» lleva a ESA partida", hrefs);
  ok(hrefs.includes("/play.html?save=autosave-1"), "2d · y cada fila a la suya", hrefs);
  ok(hrefs.includes("/play.html?replay=rep-xyz"), "2d · «ver repetición» lleva a ESA grabación", hrefs);
  ok(errores.length === 0, "2d con datos sin errores de consola", errores);

  // El idioma: repinta Y NO DESTRUYE los enlaces (la trampa del aplicador de innerHTML,
  // que es justo por lo que este bloque vive fuera de los nodos bilingües).
  await page.click("#idioma");
  await page.waitForFunction(() => /Continuar/.test(document.getElementById("partidas").innerText), null, { timeout: 30000 });
  const t2 = await lee(page);
  // Los DOS separadores, que son distintos: es la prueba de que el formato sigue al
  // idioma y no de que exista un separador cualquiera.
  ok(/turno 12\.400/.test(t2), "2d · en español, con separador de miles español (12.400 ≠ 12,400)", t2);
  const hrefs2 = await page.locator("#partidas a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  ok(hrefs2.length === hrefs.length && hrefs2.includes("/play.html?save=save-abc"),
     "2d · los enlaces SOBREVIVEN al cambio de idioma", hrefs2);
  await ctx.close();
}

console.log("\n── 2d · CON PARTIDAS Y SIN COPIA DEL JUEGO ──");
{
  const { ctx, page } = await pagina("en");
  await page.goto(`${BASE}/byo`);
  await siembra(page, { partidas: PARTIDAS, repeticiones: REPETICIONES, copia: false });
  const t = await lee(page);
  console.log(t.replace(/^/gm, "    | "));
  // 🔴 La partida SIGUE LISTADA: no se ha perdido, y decir lo contrario asustaría a
  // quien acaba de vaciar la caché del navegador. Lo que falta es con qué jugarla.
  ok(t.includes("Antes del pozo"), "2d · sin copia, las partidas SIGUEN a la vista", t);
  ok(/Continuing needs your copy/i.test(t), "2d · y se dice por qué no se puede continuar", t);
  ok((await page.locator("#partidas a").count()) === 0,
     "2d · sin copia NO hay «continuar» (un enlace a un juego sin recursos es un control muerto)",
     await page.locator("#partidas a").allInnerTexts());
  await ctx.close();
}

// 🔴 «SE BORRA AQUÍ» AHORA ABARCA MÁS COSAS, y se comprueba MIDIENDO LOS ALMACENES, no
// leyendo el rótulo. El aserto de la caché ya existía; partidas y repeticiones son datos
// del jugador en el mismo origen, así que si sobrevivieran, «este navegador ya no guarda
// nada de tu copia» sería falso justo en la frase que lo afirma.
console.log("\n── 2d · EL BORRADO ALCANZA PARTIDAS Y REPETICIONES ──");
{
  const { ctx, page } = await pagina("en");
  await page.goto(`${BASE}/byo`);
  await siembra(page, { partidas: PARTIDAS, repeticiones: REPETICIONES, copia: true });

  const censo = async () =>
    page.evaluate(
      async (C) => {
        const idx = JSON.parse(localStorage.getItem(C.indice) || "[]");
        const ranuras = Object.keys(localStorage).filter((k) => k.startsWith(C.prefijo)).length;
        const db = await new Promise((res) => {
          const r = indexedDB.open(C.db, 1);
          r.onsuccess = () => res(r.result);
          r.onerror = () => res(null);
        });
        let logs = 0;
        if (db) {
          logs = await new Promise((res) => {
            const q = db.transaction(C.almacen, "readonly").objectStore(C.almacen).count();
            q.onsuccess = () => res(q.result);
            q.onerror = () => res(-1);
          });
          db.close();
        }
        const cache = (await (await caches.open("u5-assets-v1")).keys()).length;
        return { indice: idx.length, ranuras, logs, cache };
      },
      CLAVES,
    );

  const antes = await censo();
  ok(antes.indice === 2 && antes.ranuras === 2 && antes.logs === 1 && antes.cache > 0,
     "control: hay 2 partidas, 1 repetición y caché ANTES de borrar", antes);

  // Con algo irrecuperable delante, el botón PREGUNTA y enumera qué se va.
  await page.getByRole("button", { name: /Erase my files/i }).click();
  await page.waitForSelector("#tus-datos button:has-text('Yes, erase everything')", { timeout: 30000 });
  const aviso = await page.locator("#tus-datos").innerText();
  console.log(aviso.replace(/^/gm, "    | "));
  ok(/2 saved games/.test(aviso), "2d · la confirmación CUENTA las partidas", aviso);
  ok(/1 recording/.test(aviso), "2d · y las repeticiones", aviso);

  // Cancelar CANCELA: el mayor riesgo de este botón es borrar sin querer.
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.waitForFunction(() => /Nothing was erased/i.test(document.getElementById("tus-datos").innerText), null, { timeout: 30000 });
  const trasCancelar = await censo();
  ok(trasCancelar.indice === 2 && trasCancelar.logs === 1 && trasCancelar.cache > 0,
     "2d · CANCELAR no borra nada (los tres almacenes intactos)", trasCancelar);

  // Y confirmar borra los TRES.
  await page.getByRole("button", { name: /Erase my files/i }).click();
  await page.getByRole("button", { name: /Yes, erase everything/i }).click();
  await page.waitForFunction(() => /Erased/i.test(document.getElementById("tus-datos").innerText), null, { timeout: 30000 });
  const despues = await censo();
  ok(despues.indice === 0, "2d · el ÍNDICE de partidas queda vacío", despues);
  ok(despues.ranuras === 0, "2d · y las RANURAS con los estados también", despues);
  ok(despues.logs === 0, "2d · el almacén de repeticiones queda vacío", despues);
  ok(despues.cache === 0, "2d · y la caché de recursos, como ya hacía", despues);

  const t = await lee(page);
  ok(/No saved games in this browser yet/i.test(t), "2d · la lista vuelve a su estado vacío", t);
  await ctx.close();
}

// El suelo de 44 px del resto de la pantalla vale también para «continuar», que es lo
// que más se va a pulsar con el dedo de todo el bloque.
console.log("\n── 2d · ANCHO DE TELÉFONO ──");
{
  const { devices } = createRequire(resolve(RAIZ, "package.json"))("playwright");
  for (const nombre of ["iPhone SE"]) {
    const ctx = await browser.newContext({ ...devices[nombre] });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/byo`);
    await page.waitForSelector("#partidas .guardados");
    await siembra(page, { partidas: PARTIDAS, repeticiones: REPETICIONES, copia: true });
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const b = document.querySelector("#partidas .guardado__accion")?.getBoundingClientRect();
      return { desborda: de.scrollWidth > de.clientWidth, alto: b ? Math.round(b.height) : 0 };
    });
    ok(m.alto >= 44, `2d · ${nombre}: «continuar» es pulsable con el dedo (≥44 px)`, m);
    ok(!m.desborda, `2d · ${nombre}: con la lista puesta, la página NO hace scroll lateral`, m);
    await ctx.close();
  }
}


// ── 2d-bis · LA TARJETA RICA ─────────────────────────────────────────────────
//
// El estado se siembra con los MISMOS campos que `GameState` guarda de verdad; la
// clave del slot y la de la foto se derivan igual que el resto (ver `clavesDeAlmacen`).
console.log("\n── 2d-bis · TARJETA RICA ──");
{
  const SHOT = readFileSync(resolve(RAIZ, "demo-byo/dist/byo.html"), "utf8").slice(0, 0) ||
    // Un jpeg diminuto de verdad (1×1) — vale para comprobar que la foto SE PINTA.
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
  // 🔴 ESTE FIXTURE QUEDÓ RANCIO EN c9925bac Y HACÍA FALLAR A CÓDIGO SANO.
  // Aquel commit arregló tres embustes de la tarjeta cambiando los LECTORES; este testigo
  // siguió sembrando la forma VIEJA, así que los dos rojos que arrastraba la suite no
  // acusaban a la pantalla: acusaban al testigo. Es la ficha del testigo-que-no-instancia
  // (`el-testigo-elegido-hace-pasar-al-aserto-con-el-codigo-roto`) **invertida**: allí un
  // dato degenerado deja pasar código roto; aquí un dato caduco tumba código correcto.
  // Los dos son el mismo defecto —el testigo no representa a la población real— y el
  // segundo es MENOS peligroso sólo porque grita.
  //
  // 🔴 Y EL CUARTO PERSONAJE NO ES RELLENO: es lo que le devuelve los dientes al aserto.
  // El lector cuenta `partyStatus === 0` (el bug que c9925bac mató era contar el ELENCO
  // de reclutables, 16). Con tres personajes y nada más, «party of 3» pasaría también con
  // `characters.length` — o sea, con el bug reintroducido. Con un cuarto en 0xFF el
  // cardinal correcto (3) y el incorrecto (4) SE SEPARAN, que es la única forma de que el
  // aserto hable del predicado y no del tamaño del array.
  const ESTADO = {
    version: 1, gold: 1234, karma: 55, turnsSinceStart: 12400,
    time: { year: 139, month: 3, day: 12, hour: 9, minute: 0 },
    characters: [{ partyStatus: 0 }, { partyStatus: 0 }, { partyStatus: 0 }, { partyStatus: 0xff }],
    lbArtifacts: { amulet: true, crown: true, sceptre: false },
    shadowlordLocs: [0x10, 0x90, 0xff],
  };
  // TERCERA partida: la que separa las DOS fuentes de «destruido». Sus tres bytes de
  // `shadowlordLocs` dicen «vivo y en una ciudad», y `questFlags` dice que Falsehood está
  // muerto. La regla del port (partidas.ts) es que la MUERTE gana: un Shadowlord destruido
  // no está «en una ciudad» aunque su byte viejo lo diga. Sin este caso, todo lo que la
  // suite comprobaba de «destruido» venía del centinela 0xFF — es decir, del camino que
  // c9925bac declaró NO autoritativo.
  const ESTADO_MUERTO = {
    version: 1, gold: 7, karma: 50,
    characters: [{ partyStatus: 0 }],
    shadowlordLocs: [0x10, 0x10, 0x10],
    questFlags: { "shadowlord-dead:falsehood": true },
  };
  const { ctx, page, errores } = await pagina("en");
  await page.goto(`${BASE}/byo`);
  await page.evaluate(
    ({ C, ESTADO, ESTADO_MUERTO, SHOT }) => {
      const metas = [
        { id: "rica", name: "Con todo", timestamp: 1754500000000, turns: 12400, locationName: "Britannia" },
        { id: "muerto", name: "Con un shadowlord muerto", timestamp: 1754450000000, turns: 900, locationName: "Britannia" },
        { id: "pobre", name: "Recién empezada", timestamp: 1754400000000, turns: 3, locationName: "Iolo's Hut" },
      ];
      localStorage.setItem(C.indice, JSON.stringify(metas));
      localStorage.setItem(C.prefijo + "rica", JSON.stringify(ESTADO));
      localStorage.setItem(C.prefijo + "muerto", JSON.stringify(ESTADO_MUERTO));
      // La tercera SIN shadowlordLocs y SIN foto: es el caso «vieja/recién empezada».
      localStorage.setItem(C.prefijo + "pobre", JSON.stringify({ version: 1, gold: 0, characters: [{}] }));
      localStorage.setItem("u5clone:shot:rica", SHOT);
    },
    { C: CLAVES, ESTADO, ESTADO_MUERTO, SHOT },
  );
  await page.reload();
  await page.waitForSelector("#partidas .guardado--tarjeta");
  const t = await lee(page);
  console.log(t.replace(/^/gm, "    | "));

  ok(/1,234 gold/.test(t), "2d-bis · el ORO sale del estado guardado", t);
  ok(/karma 55/.test(t), "2d-bis · y el karma", t);
  ok(/party of 3/.test(t), "2d-bis · y el tamaño del grupo (3 en el grupo de CUATRO personajes)", t);
  // La recíproca explícita del cuarto: si alguien volviera a contar el array, saldría 4.
  ok(!/party of 4/.test(t), "2d-bis · y NO cuenta al que está fuera del grupo (partyStatus 0xFF)", t);
  ok(/game date 12\/3\/139/.test(t), "2d-bis · la fecha DEL JUEGO, no la real", t);
  ok(/Crown/.test(t) && /Amulet/.test(t), "2d-bis · los artefactos que SÍ tiene", t);
  ok(!/Sceptre/.test(t), "2d-bis · y NO el que no tiene", t);

  // 🔴 EL ASERTO QUE MÁS IMPORTA: «sin rastro» ≠ «destruidos». La tercera partida no tiene
  // `shadowlordLocs` ni `questFlags`, y pintarle tres puntos afirmaría el final del juego.
  // 🔴 EL TEXTO ESPERADO TAMBIÉN ESTABA RANCIO, y por una causa DISTINTA de la del grupo:
  // c9925bac no cambió aquí el lector sino EL MENSAJE — `slSinPoblar` «not yet abroad» pasó
  // a `slSinRastro` «no trace in this save», porque «aún no aparecen» afirmaba sobre la
  // trama desde un campo que puede faltar por veinte razones. La pantalla llevaba razón y
  // la sonda seguía exigiendo la frase vieja. Dos rojos, dos causas: uno de FIXTURE
  // (la forma del estado) y otro de EXPECTATIVA (la cadena). Se arreglan por separado
  // porque un solo relato los habría tapado.
  ok(/no trace in this save/.test(t), "2d-bis · sin poblar se DICE, no se pinta como destruidos", t);

  // Los recuentos van POR TARJETA: con tres partidas en la lista, un `count()` global
  // sumaría las dos pobladas y dejaría de decir de quién habla.
  const tarjeta = (nombre) =>
    page.locator("#partidas li").filter({ has: page.locator(`.guardado__nombre:text-is("${nombre}")`) });
  const puntos = await tarjeta("Con todo").locator(".sl-punto").count();
  ok(puntos === 3, "2d-bis · la partida poblada pinta TRES puntos", puntos);
  const destruidos = await tarjeta("Con todo").locator(".sl-punto--destruido").count();
  ok(destruidos === 1, "2d-bis · uno de ellos destruido (0xFF), los otros dos no", destruidos);
  ok(await tarjeta("Recién empezada").locator(".sl-punto").count() === 0,
     "2d-bis · y la que no dice nada NO pinta puntos", true);

  // 🔴 LA SEGUNDA FUENTE DE «DESTRUIDO», que es la AUTORITATIVA y que hasta hoy no se
  // probaba: `questFlags['shadowlord-dead:*']`. Este estado tiene los tres bytes de
  // `shadowlordLocs` diciendo «vivo, en una ciudad» y la bandera diciendo que Falsehood
  // está muerto. Si la bandera no ganase, saldrían tres «ciudad» y CERO destruidos —
  // exactamente el embuste que c9925bac vino a matar, servido por el otro camino.
  const mDestruidos = await tarjeta("Con un shadowlord muerto").locator(".sl-punto--destruido").count();
  ok(mDestruidos === 1, "2d-bis · `shadowlord-dead` GANA a un byte de posición que dice «vivo»", mDestruidos);
  const mCiudad = await tarjeta("Con un shadowlord muerto").locator(".sl-punto--ciudad").count();
  ok(mCiudad === 2, "2d-bis · y los otros dos siguen leyéndose de shadowlordLocs (ciudad)", mCiudad);

  // La foto: se pinta la que hay, y la que NO tiene no deja hueco.
  const fotos = await page.locator("#partidas .guardado__foto").count();
  ok(fotos === 1, "2d-bis · una foto, la de la partida que la tiene", fotos);
  const src = await page.locator("#partidas .guardado__foto").getAttribute("src");
  ok((src || "").startsWith("data:image/jpeg"), "2d-bis · y es la captura guardada", (src || "").slice(0, 24));
  ok(await page.locator("#partidas .guardado__foto").isVisible(), "2d-bis · visible de verdad", true);
  ok(errores.length === 0, "2d-bis sin errores de consola", errores);

  // Y que el borrado se las lleva TAMBIÉN a ellas (la foto es dato del jugador).
  await page.getByRole("button", { name: /Erase my files/i }).click();
  await page.getByRole("button", { name: /Yes, erase everything/i }).click();
  await page.waitForFunction(() => /Erased/i.test(document.getElementById("tus-datos").innerText), null, { timeout: 30000 });
  const quedan = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith("u5clone:shot:")).length);
  ok(quedan === 0, "2d-bis · el borrado se lleva las CAPTURAS (no sólo los slots)", quedan);
  await ctx.close();
}

// 🔴 EL PESO DE LA PÁGINA, que es lo que decidió la forma del minimapa: `TileData.json`
// son 458 KB y NO puede entrar en el bundle eager de una landing de 91 KB.
console.log("\n── 2d-bis · EL BUNDLE EAGER NO SE COME LA TABLA DE TILES ──");
{
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const dir = resolve(RAIZ, "demo-byo/dist/byo-static");
  const eager = readdirSync(dir).find((f) => f.startsWith("byo-"));
  const bytes = statSync(resolve(dir, eager)).size;
  console.log(`    eager: ${eager} · ${bytes} B`);
  ok(bytes < 200 * 1024, "2d-bis · el bundle eager sigue por debajo de 200 KB", bytes);
  // Huella por DATOS de TileData.json (nombres de tile que sólo están en esa tabla).
  const t = readFileSync(resolve(dir, eager), "utf8");
  ok(!t.includes("flatTileSubstitutionIndex"),
     "2d-bis · y NO arrastra TileData.json (458 KB) al camino de carga", eager);

  // 🔴 LA RECÍPROCA, que es la que dice que el minimapa EXISTE en vez de haberse
  // caído del build: la tabla tiene que estar EN ALGÚN SITIO, y ese sitio es un
  // chunk aparte. Sin este aserto, borrar el minimapa entero dejaría el anterior
  // en verde — mediría una ausencia y la llamaría arquitectura.
  const conTabla = readdirSync(dir).filter(
    (f) => f.endsWith(".js") && readFileSync(resolve(dir, f), "utf8").includes("flatTileSubstitutionIndex"),
  );
  ok(conTabla.length === 1, "2d-bis · la tabla vive en UN chunk perezoso, no en ninguno ni en dos", conTabla);
  if (conTabla.length === 1) {
    console.log(`    perezoso del minimapa: ${conTabla[0]} · ${statSync(resolve(dir, conTabla[0])).size} B`);
    ok(conTabla[0] !== eager, "2d-bis · y ese chunk NO es el eager", { eager, conTabla });
  }
}

// El minimapa SIN extracción en caché: ni mapa roto ni hueco. (El bloque de arriba
// deja el navegador sin caché; aquí se siembra una partida de sobremundo SIN foto.)
console.log("\n── 2d-bis · MINIMAPA SIN CACHÉ: no se pinta nada roto ──");
{
  const { ctx, page, errores } = await pagina("en");
  await page.goto(`${BASE}/byo`);
  await page.evaluate((C) => {
    localStorage.setItem(C.indice, JSON.stringify([
      { id: "sobremundo", name: "En Britannia", timestamp: 1754500000000, turns: 10, locationName: "Britannia" },
    ]));
    localStorage.setItem(C.prefijo + "sobremundo",
      JSON.stringify({ version: 1, position: { location: 0, x: 60, y: 90 }, gold: 5 }));
  }, CLAVES);
  await page.reload();
  await page.waitForSelector("#partidas .guardado--tarjeta");
  await page.waitForTimeout(1500); // margen para que el chunk perezoso llegue si fuera a llegar
  const mapas = await page.locator("#partidas .guardado__mapa").count();
  ok(mapas === 0, "2d-bis · sin caché NO aparece minimapa (ni roto ni vacío)", mapas);
  const t = await lee(page);
  ok(t.includes("En Britannia"), "2d-bis · y la tarjeta sigue ahí con su nombre", t);
  ok(errores.length === 0, "2d-bis · sin errores de consola por el mapa ausente", errores);
  await ctx.close();
}

// 🔴 LA RECÍPROCA DEL ANTERIOR. «Sin caché no hay mapa» pasaría en VERDE con el
// minimapa completamente roto — es una ausencia, y una ausencia no demuestra la
// capacidad. Aquí se siembra el mapa del usuario en SU caché y se exige que el canvas
// aparezca, con su tamaño real.
console.log("\n── 2d-bis · MINIMAPA CON CACHÉ: se pinta de verdad ──");
{
  const { ctx, page, errores } = await pagina("en");
  await page.goto(`${BASE}/byo`);
  await page.evaluate(async (C) => {
    localStorage.setItem(C.indice, JSON.stringify([
      { id: "sobremundo", name: "En Britannia", timestamp: 1754500000000, turns: 10, locationName: "Britannia" },
      { id: "enpueblo", name: "Dentro de Yew", timestamp: 1754400000000, turns: 20, locationName: "Yew" },
    ]));
    localStorage.setItem(C.prefijo + "sobremundo",
      JSON.stringify({ version: 1, position: { location: 0, x: 60, y: 90 }, gold: 5 }));
    // Ésta está DENTRO de un pueblo: sus coordenadas son de otro mapa y NO deben
    // pintarse sobre Britannia.
    localStorage.setItem(C.prefijo + "enpueblo",
      JSON.stringify({ version: 1, position: { location: 4, x: 15, y: 15 }, gold: 5 }));
    const mapa = Array.from({ length: 256 }, () => new Array(256).fill(4));
    const cache = await caches.open("u5-assets-v1");
    await cache.put(new Request("/assets/maps/overworld.json"),
      new Response(JSON.stringify(mapa), { headers: { "Content-Type": "application/json" } }));
  }, CLAVES);
  await page.reload();
  await page.waitForSelector("#partidas .guardado--tarjeta");
  await page.waitForSelector("#partidas .guardado__mapa", { timeout: 30000 }).catch(() => {});
  const mapas = await page.locator("#partidas .guardado__mapa").count();
  ok(mapas === 1, "2d-bis · CON caché aparece el minimapa — y sólo UNO", mapas);
  const dim = await page.evaluate(() => {
    const c = document.querySelector("#partidas .guardado__mapa");
    return c ? { w: c.width, h: c.height, visible: c.getBoundingClientRect().width > 0 } : null;
  });
  ok(dim && dim.w === 256 && dim.h === 256, "2d-bis · a resolución nativa 256x256", dim);
  ok(dim && dim.visible, "2d-bis · y visible en pantalla", dim);
  // 🔴 La de dentro del pueblo NO lo lleva: sus coordenadas son de OTRO mapa, y una
  // marca en el sitio equivocado es peor que ninguna marca.
  const conMapa = await page.evaluate(() =>
    [...document.querySelectorAll("#partidas .guardado--tarjeta")]
      .map((li) => [li.querySelector(".guardado__nombre")?.textContent, !!li.querySelector(".guardado__mapa")]));
  ok(JSON.stringify(conMapa) === JSON.stringify([["En Britannia", true], ["Dentro de Yew", false]]),
     "2d-bis · el mapa va SÓLO a la del sobremundo, no a la del pueblo", conMapa);

  // 🔴 LA MARCA SE MIDE EN PÍXELES DE PANTALLA, no en píxeles de lienzo — y ésa es toda
  // la ficha. El lienzo es 256 y se muestra a ~102: una marca dimensionada contra el
  // lienzo sale dividida por 2,5 sin que nadie lo note, porque en el canvas se ve
  // perfecta. La versión anterior (5 px de lienzo) daba 1,99 px de pantalla, por debajo
  // del suelo de 3 px del diseño.
  //
  // 🔴 SE MIDE LA EXTENSIÓN (primer y último píxel encendido), NO CUÁNTOS HAY. La marca
  // es un ANILLO HUECO, así que la fila que pasa por su centro sólo cruza los DOS trazos
  // laterales: contar píxeles encendidos daba 6 donde la marca ocupa 14, y este mismo
  // aserto se puso ROJO con la marca ya arreglada. Lo que hace visible una forma es
  // cuánto ABARCA, no cuánta tinta lleva — y para una forma hueca las dos cifras son
  // distintas. Sobre un mapa sembrado de tile 4 (que no es ni rojo ni blanco).
  const anchoMarca = await page.evaluate(() => {
    const cv = document.querySelector("#partidas .guardado__mapa");
    const escala = cv.getBoundingClientRect().width / cv.width; // lienzo → pantalla
    const g = cv.getContext("2d");
    // Fila horizontal por el centro de la marca (la partida se sembró en 60,90).
    const d = g.getImageData(0, 90, cv.width, 1).data;
    let min = -1, max = -1;
    for (let i = 0; i < cv.width; i++) {
      const r = d[i * 4], v = d[i * 4 + 1], b = d[i * 4 + 2];
      const marcado = (r > 180 && v < 120 && b < 120) || (r > 200 && v > 200 && b > 200);
      if (!marcado) continue;
      if (min < 0) min = i;
      max = i;
    }
    const extension = min < 0 ? 0 : max - min + 1;
    return {
      enLienzo: extension,
      escala: Math.round(escala * 1000) / 1000,
      enPantalla: Math.round(extension * escala * 100) / 100,
    };
  });
  console.log(`    marca: ${JSON.stringify(anchoMarca)}`);
  ok(anchoMarca.enPantalla >= 3,
     "2d-bis · y la marca se VE a tamaño de tarjeta: ≥3 px DE PANTALLA (no de lienzo)", anchoMarca);
  ok(errores.length === 0, "2d-bis · minimapa sin errores de consola", errores);
  await ctx.close();
}

// ── 2d-quater · EL POPUP DE UN INTERIOR ENSEÑA LAS DOS VISTAS, Y LAS DOS SE VEN ──────
//
// 🔴 ESTA SONDA EXISTE PORQUE UNA CAPTURA PARÓ UN DESPLIEGUE. El popup de un interior
// enseña dos mapas —dónde está el grupo y dónde cae el edificio— y el visitante veía UNO:
// el segundo caía fuera del alto del diálogo. El DOM estaba perfecto (dos `.visor__vista`,
// dos rótulos, dos lienzos de 768), así que todo lo que este fichero medía seguía verde.
// Lo que fallaba era la GEOMETRÍA, que es lo que aquí se mide.
//
// 🔴 Y LA CAUSA NO ERA LA QUE PARECÍA, lo que explica la forma del aserto de abajo. El
// diagnóstico dijo «dos lienzos de 768 con `flex-wrap: wrap` envuelven»; medido en el
// navegador, `getComputedStyle(.visor__par).display` era **`block`**: `visor.ts` le añade
// `visor__imagen` a todo lo que enmarca, esa clase trae `display: block`, las dos reglas
// tienen la misma especificidad y ganaba la última del fichero. El par NUNCA fue flex y el
// `wrap` nunca llegó a actuar. Retirar el `wrap` —el arreglo «obvio»— no habría movido un
// píxel.
// ★★ Por eso se miden LAS DOS COSAS: el `display` computado (la CAUSA, que muere si alguien
//    vuelve a añadir una regla genérica encima) y las cajas dentro del diálogo (el EFECTO,
//    que enrojece con cualquier otra causa futura que aún no conocemos). Una sola de las dos
//    dejaría medio defecto sin vigilar.
console.log("\n── 2d-quater · POPUP DE INTERIOR: LAS DOS VISTAS CABEN ──");
{
  const { ctx, page, errores } = await pagina("en");
  await page.goto(`${BASE}/byo`);
  // Los TRES ficheros que el par necesita, SINTÉTICOS y en la Cache Storage — que es de
  // donde `minimapa.ts` los lee (nunca de la red: servirlos por HTTP da «no hay mapa», un
  // negativo FALSO que se lee igual que el defecto).
  await page.evaluate(async (C) => {
    localStorage.setItem(C.indice, JSON.stringify([
      { id: "dentro", name: "Dentro de Yew", timestamp: 1754500000000, turns: 10, locationName: "Yew" },
    ]));
    // Yew es la location 4, y el save está en su planta 0.
    localStorage.setItem(C.prefijo + "dentro",
      JSON.stringify({ version: 1, position: { location: 4, x: 15, y: 15, floor: 0 }, gold: 5 }));
    const cache = await caches.open("u5-assets-v1");
    const pon = (r, v) => cache.put(new Request(r), new Response(JSON.stringify(v),
      { headers: { "Content-Type": "application/json" } }));
    await pon("/assets/maps/overworld.json", Array.from({ length: 256 }, () => new Array(256).fill(4)));
    await pon("/assets/maps/smallmaps.json", [
      { id: 4, name: "Yew", floors: [{ z: 0, tiles: Array.from({ length: 32 }, () => new Array(32).fill(4)) }] },
    ]);
    // `coordenadaDelLugar` indexa 0-based (loc 4 → idx 3): sin esto NO hay segunda vista y
    // la sonda mediría el caso de una sola, en verde y sin enterarse.
    await pon("/assets/data.json", { locationsX: [1, 2, 3, 60], locationsY: [1, 2, 3, 90] });
  }, CLAVES);
  await page.reload();
  await page.waitForSelector("#partidas .guardado__mapa", { timeout: 30000 });
  await page.click("#partidas .guardado__lupa");
  await page.waitForSelector("dialog.visor[open]", { timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll("dialog.visor canvas").length === 2,
    null, { timeout: 30000 }).catch(() => {});

  const geo = await page.evaluate(() => {
    const dlg = document.querySelector("dialog.visor");
    const par = document.querySelector(".visor__par");
    if (!dlg || !par) return null;
    const d = dlg.getBoundingClientRect();
    const caja = (e) => { const r = e.getBoundingClientRect(); return {
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      // DENTRO del diálogo por los CUATRO lados, con 1 px de holgura por el redondeo.
      dentro: r.top >= d.top - 1 && r.bottom <= d.bottom + 1 && r.left >= d.left - 1 && r.right <= d.right + 1,
    }; };
    return {
      display: getComputedStyle(par).display,
      dialogo: { w: Math.round(d.width), h: Math.round(d.height) },
      vistas: [...document.querySelectorAll(".visor__vista")].map(caja),
      // Y que sean DOS COLUMNAS y no dos filas: las `y` coinciden, las `x` no.
      rotulos: [...document.querySelectorAll(".visor__pie")].map((n) => n.textContent),
      // 🔴 TINTA BLANCA DE LA MARCA, CONTADA EN CADA LIENZO. Es la única sonda de este
      // fichero que mira PÍXELES, y está aquí porque la geometría de arriba estaba TODA en
      // verde con la marca de Britannia reducida a un punto: dos vistas, bien colocadas,
      // enteras, rotuladas — y uno de los dos mapas sin nada que mirar. El trazo exterior
      // del anillo es `#fff` puro y ningún color de terreno lo es (`defaultTileColor` no
      // emite blanco), así que contarlo mide LA MARCA y no el mapa.
      // ★★ La suite midió durante todo el defecto lo que el DOM decía; esto mide lo que se
      //    ve. Un anillo sub-píxel se antialiasa hasta desaparecer sin mover una sola caja.
      marca: [...document.querySelectorAll("dialog.visor canvas")].map((c) => {
        const d = c.getContext("2d")?.getImageData(0, 0, c.width, c.height)?.data;
        if (!d) return null;
        let blancos = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240 && d[i + 3] > 240) blancos++;
        }
        return { lienzo: c.width, blancos };
      }),
    };
  });
  console.log(`    ${JSON.stringify(geo)}`);
  ok(geo && geo.vistas.length === 2, "2d-quater · el popup de un interior trae DOS vistas", geo);
  ok(geo && geo.display === "flex",
     "2d-quater · el par ES un contenedor flex (la causa: `visor__imagen` le ponía `display:block`)", geo?.display);
  ok(geo && geo.vistas.every((v) => v.dentro),
     "2d-quater · las DOS vistas caben ENTERAS dentro del diálogo (ninguna recortada)", geo?.vistas);
  ok(geo && geo.vistas.length === 2 && geo.vistas[0].y === geo.vistas[1].y && geo.vistas[0].x !== geo.vistas[1].x,
     "2d-quater · y van UNA AL LADO DE LA OTRA, no apiladas", geo?.vistas);
  ok(geo && geo.rotulos.length === 2 && geo.rotulos.every((t) => t && t.trim().length > 3),
     "2d-quater · cada vista lleva su rótulo (dos marcas rojas sin explicar mentirían)", geo?.rotulos);
  // El anillo del suelo (extensión 42 px de lienzo, trazo blanco de 9) deja ~890 px de tinta
  // blanca una vez el trazo rojo pisa su centro. Se exige 200 —muy por debajo de lo que se
  // mide, muy por encima de lo que dejaba el defecto (0 y 1)— para que el aserto siga siendo
  // sobre «¿hay marca?» y no se rompa al retocar el grosor del dibujo.
  const TINTA_MINIMA = 200;
  ok(geo && geo.marca.length === 2 && geo.marca.every((m) => m && m.blancos >= TINTA_MINIMA),
     `2d-quater · las DOS marcas están PINTADAS (≥${TINTA_MINIMA} px de trazo blanco cada una)`,
     geo?.marca);
  ok(errores.length === 0, "2d-quater · popup de interior sin errores de consola", errores);
  await ctx.close();
}

// ── 2d-ter · ICONOS DE ARTEFACTO (A3) ────────────────────────────────────────
//
// Misma pareja negativo/recíproca que el minimapa, y por la misma razón: «sin caché no
// hay icono» pasaría en VERDE con el recorte completamente roto.
//
// ⚠️ EL ATLAS SE SIEMBRA SINTÉTICO Y ES A PROPÓSITO: con un color ÚNICO por casilla
// (rojo = columna, verde = fila) se puede leer un píxel del icono y saber DE QUÉ CASILLA
// se recortó. Con los gráficos reales eso sólo se podría mirar a ojo, y «hay un canvas»
// no distingue un recorte desplazado de uno correcto — que es exactamente el fallo que
// un número de tile escrito a mano produciría.
console.log("\n── 2d-ter · ICONOS DE ARTEFACTO ──");
{
  // 🔴 EL ÍNDICE ESPERADO SE DERIVA DE `InventoryDetails.json` (OBJETO→SPRITE), que es de
  // donde el juego saca el gráfico — NO del nombre de tile que `iconos.ts` haya elegido.
  // Antes se derivaba del nombre, y por eso esta sonda no pudo ver que la caja apuntaba al
  // tile equivocado: comparaba la elección consigo misma. Ahora las dos fuentes son
  // INDEPENDIENTES, que es lo único que convierte una comparación en una medición.
  const tabla = JSON.parse(readFileSync(resolve(RAIZ, "game/src/core/data/TileData.json"), "utf8"));
  const inv = JSON.parse(readFileSync(resolve(RAIZ, "game/src/core/data/InventoryDetails.json"), "utf8"));
  const SPRITE = {};
  (function anda(o) {
    if (Array.isArray(o)) return o.forEach(anda);
    if (o && typeof o === "object") {
      // Hay `ItemSprite` NO numéricos (p. ej. "SulfurAsh.2d"): se ignoran.
      if (o.ItemName && /^\d+$/.test(String(o.ItemSprite ?? ""))) SPRITE[o.ItemName] = Number(o.ItemSprite);
      Object.values(o).forEach(anda);
    }
  })(inv);
  const IDX = { Crown: SPRITE.Crown, Shard: SPRITE.Falsehood, Box: SPRITE.WoodenBox };
  console.log(`    (derivado de InventoryDetails OBJETO→SPRITE: Crown=${IDX.Crown} · Shard=${IDX.Shard} · WoodenBox=${IDX.Box})`);
  ok(IDX.Crown !== undefined && IDX.Shard !== undefined && IDX.Box !== undefined,
     "2d-ter · control: los tres objetos tienen sprite en InventoryDetails (si no, lo de abajo no mide nada)", IDX);

  // 🔴 EL CRUCE DE DOS FUENTES, y es el control que a esta sonda LE FALTABA. Los asertos
  // de píxel de más abajo comprueban que el RECORTE cae en el índice que sale del nombre
  // que `iconos.ts` eligió — o sea, verifican la ejecución de la elección, no la elección.
  // Son CIEGOS a mapear un artefacto al tile de otra cosa, y eso pasó: la caja apuntaba a
  // `"Box"` (tile 175) cuando el objeto es el 270 `ItemSandalwoodBox`. Lo cazó otro carril
  // leyendo el save, no esta sonda.
  //
  // El arreglo del INSTRUMENTO: cotejar el mapa de `iconos.ts` contra la tabla que asocia
  // OBJETO→SPRITE (`InventoryDetails.json`), que es de donde el juego saca el gráfico.
  // Cuesta cero bytes de bundle porque vive aquí, en Node.
  // ⚠️ El mapa se PARSEA del fuente, no se copia: copiado, este aserto compararía la
  // sonda consigo misma.
  {
    const src = readFileSync(resolve(RAIZ, "demo-byo/src/iconos.ts"), "utf8");
    const m = src.match(/const TILE_DE: Record<string, string> = \{([\s\S]*?)\n\};/);
    if (!m) throw new Error("no se pudo parsear TILE_DE de iconos.ts: el parser está roto");
    const mapa = Object.fromEntries([...m[1].matchAll(/(\w+):\s*"([^"]+)"/g)].map((x) => [x[1], x[2]]));
    // clave del chip → nombre del OBJETO en InventoryDetails (no su rótulo de menú).
    const OBJETO = {
      corona: "Crown", cetro: "Sceptre", amuleto: "Amulet", shardFalsedad: "Falsehood",
      shardOdio: "Hatred", shardCobardia: "Cowardice", caja: "WoodenBox",
      // La BOLSA de la ficha rica. Se añaden AQUÍ y no sólo en `iconos.ts` porque este mapa
      // es el que decide QUÉ se cruza: una fila nueva en `TILE_DE` sin su fila aquí entra
      // en el bundle SIN cotejar y el aserto de abajo sigue verde — cubriría 7 de 14 y
      // diría «cero discrepancias». Por eso el control de cobertura de más abajo cuenta
      // contra `TILE_DE` y no contra esta lista.
      oro: "Gold", comida: "Food", llaves: "Keys", gemas: "Gems",
      antorchas: "Torches", calaveras: "SkullKeys", alfombras: "Carpet",
    };
    const sprite = SPRITE; // ya extraído arriba de InventoryDetails
    const idxDeNombre = {};
    for (const [k, v] of Object.entries(tabla)) if (idxDeNombre[v.Name] === undefined) idxDeNombre[v.Name] = Number(k);

    const filas = Object.entries(OBJETO).map(([clave, obj]) => ({
      clave, obj, mio: idxDeNombre[mapa[clave]], suyo: sprite[obj], tile: mapa[clave],
    }));
    for (const f of filas) console.log(`    ${f.clave.padEnd(14)} ${String(f.mio).padStart(3)} «${f.tile}»  vs  InventoryDetails ${f.obj} → ${f.suyo}`);
    const cubiertas = filas.filter((f) => f.suyo !== undefined);
    // El control del control: si InventoryDetails no cubriera ninguna, «cero discrepancias»
    // sería verde por vacuidad.
    ok(cubiertas.length === filas.length,
       "2d-ter · control: InventoryDetails cubre TODAS las filas cruzadas (si no, el cruce no mide)",
       { cubiertas: cubiertas.length, de: filas.length });

    // 🔴 LA RECÍPROCA, Y ES LA QUE FALTABA. Lo de arriba comprueba que cada fila de `OBJETO`
    // se puede cruzar; NO comprueba que `OBJETO` cubra a `TILE_DE`. Sin esto, añadir un
    // icono a `iconos.ts` y olvidarse de esta sonda lo mete en el bundle SIN cotejar, y el
    // aserto de discrepancias sigue diciendo «cero» — cero sobre las que mira. Un icono
    // apuntado al tile de otra cosa es exactamente el defecto que costó la caja, y la
    // guarda que lo cazó no puede depender de que el siguiente se acuerde de ampliarla.
    // Se comprueba la IGUALDAD de conjuntos: sobra en `OBJETO` también es un desajuste.
    const enMapa = Object.keys(mapa).sort();
    const enObjeto = Object.keys(OBJETO).sort();
    const sinCruzar = enMapa.filter((k) => !(k in OBJETO));
    const sobran = enObjeto.filter((k) => !(k in mapa));
    ok(sinCruzar.length === 0 && sobran.length === 0,
       "2d-ter · control RECÍPROCO: todo icono de TILE_DE entra en el cruce (y nada de más)",
       { sinCruzar, sobran, iconos: enMapa.length, cruzados: enObjeto.length });
    const discrepan = cubiertas.filter((f) => f.mio !== f.suyo);
    ok(discrepan.length === 0,
       "2d-ter · el mapa de iconos concuerda con InventoryDetails (OBJETO→SPRITE), no con el rótulo del menú",
       discrepan);
  }

  // El estado trae la corona (`lbArtifacts`), UN shard (`shards`) y la caja
  // (`specialItems.woodenBox`) — los TRES campos distintos de los que salen los chips.
  const ESTADO = {
    version: 1, gold: 7, characters: [{}],
    lbArtifacts: { crown: true, sceptre: false, amulet: false },
    shards: { falsehood: true, hatred: false, cowardice: false },
    specialItems: { woodenBox: true },
    position: { location: 0, x: 60, y: 90 },
  };

  const { ctx, page, errores } = await pagina("en");
  await page.goto(`${BASE}/byo`);

  // ── (a) SIN ATLAS EN CACHÉ: los chips de TEXTO, y ni un icono ni un hueco ──────
  await page.evaluate(({ C, ESTADO }) => {
    localStorage.setItem(C.indice, JSON.stringify([
      { id: "arte", name: "Con artefactos", timestamp: 1754500000000, turns: 10, locationName: "Britannia" },
    ]));
    localStorage.setItem(C.prefijo + "arte", JSON.stringify(ESTADO));
  }, { C: CLAVES, ESTADO });
  await page.reload();
  await page.waitForSelector("#partidas .guardado--tarjeta");
  await page.waitForTimeout(1500); // margen para el chunk perezoso, si fuera a llegar
  const sinAtlas = await page.locator("#partidas .chip__icono").count();
  const chipsTexto = await page.locator("#partidas .chip--art").allInnerTexts();
  ok(sinAtlas === 0, "2d-ter · sin el atlas en caché NO hay iconos (ni rotos ni vacíos)", sinAtlas);
  // 🔴 Y los TRES chips están: corona (lbArtifacts) + shard (shards) + caja
  // (specialItems). Si saliera 1, es que los dos campos nuevos no se están leyendo.
  ok(chipsTexto.length === 3 && /Crown/.test(chipsTexto.join("|")) &&
     /Shard of Falsehood/.test(chipsTexto.join("|")) && /Sandalwood box/.test(chipsTexto.join("|")),
     "2d-ter · y los chips de TEXTO salen de los TRES campos del estado", chipsTexto);

  // ── (b) CON el atlas del usuario en su caché ───────────────────────────────────
  const esperado = await page.evaluate(async (IDX) => {
    const COLS = 32, PX = 16, ROWS = 16;
    const cv = document.createElement("canvas");
    cv.width = COLS * PX; cv.height = ROWS * PX;
    const g = cv.getContext("2d");
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        g.fillStyle = `rgb(${c * 8}, ${r * 16}, 200)`;
        g.fillRect(c * PX, r * PX, PX, PX);
      }
    }
    const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
    const cache = await caches.open("u5-assets-v1");
    await cache.put(new Request("/assets/tiles-ega.png"),
      new Response(blob, { headers: { "Content-Type": "image/png" } }));
    const color = (i) => ({ r: (i % COLS) * 8, g: Math.floor(i / COLS) * 16 });
    return { corona: color(IDX.Crown), shard: color(IDX.Shard), caja: color(IDX.Box) };
  }, IDX);
  await page.reload();
  await page.waitForSelector("#partidas .chip__icono", { timeout: 30000 }).catch(() => {});
  const iconos = await page.locator("#partidas .chip__icono").count();
  ok(iconos === 3, "2d-ter · CON el atlas, los tres artefactos llevan su icono", iconos);

  // 🔴 EL ASERTO QUE DECIDE: el píxel del icono contra el color que el atlas puso EN ESA
  // CASILLA. Un recorte desplazado sale de otra casilla y da otro color; un `hay un
  // canvas` los daría por buenos a los dos.
  const leidos = await page.evaluate(() => {
    const de = (clave) => {
      const c = document.querySelector(`#partidas .chip--art[data-art=${clave}] .chip__icono`);
      if (!c) return null;
      const d = c.getContext("2d").getImageData(8, 8, 1, 1).data;
      return { r: d[0], g: d[1] };
    };
    return { corona: de("corona"), shard: de("shardFalsedad"), caja: de("caja") };
  });
  console.log(`    leído ${JSON.stringify(leidos)}\n    esperado ${JSON.stringify(esperado)}`);
  for (const k of ["corona", "shard", "caja"]) {
    ok(leidos[k] && leidos[k].r === esperado[k].r && leidos[k].g === esperado[k].g,
       `2d-ter · el recorte de «${k}» cae en SU tile, no en otro (color del atlas)`,
       { leido: leidos[k], esperado: esperado[k] });
  }
  ok(errores.length === 0, "2d-ter · iconos sin errores de consola", errores);
  await ctx.close();
}

// ── 2e · EL VISOR: la ilustración de la tarjeta, en grande ───────────────────
//
// Se prueban las DOS fuentes (minimapa y captura) por las DOS vías (ratón y teclado),
// el cierre, y el caso que NO debe abrir nada. El control va primero.
console.log("\n── 2e · VISOR DE LA ILUSTRACIÓN ──");
{
  const { ctx, page, errores } = await pagina("en");
  /**
   * Espera a que el visor esté abierto y devuelve `true`/`false`. NO lanza.
   *
   * 🔴 ESTO LO PIDIÓ UN MUTANTE. Con el `waitForSelector` pelado, el mutante «sin
   * listener de clic» sí se detectaba —la suite no pasaba— pero moría con un
   * `TimeoutError` sin capturar: **una traza de pila en vez de un rojo con nombre**, y
   * la corrida se cortaba ahí, así que ni siquiera se veía si algo más se había roto.
   * Un mutante que mata la corrida en vez de teñir un aserto discrimina igual y
   * diagnostica MUCHO peor. Convertido en booleano, el fallo dice qué esperaba.
   */
  const abrio = async () =>
    await page
      .waitForSelector("dialog.visor[open]", { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
  await page.goto(`${BASE}/byo`);
  // Dos partidas: una de sobremundo SIN foto (⇒ minimapa) y otra CON foto (⇒ captura).
  // Y una TERCERA dentro de un pueblo y sin foto: ni mapa ni captura ⇒ NADA clicable.
  // 🔴 LA CAPTURA DEL TESTIGO MIDE 320×200, QUE ES LO QUE GUARDA EL JUEGO — y esa cifra
  // es la mitad de esta sonda, no un detalle del atrezo.
  // El resto del fichero usa un JPEG de 1×1 (basta cuando lo que se comprueba es que la
  // imagen ESTÁ y de dónde sale). Aquí NO basta, y costó caro: la columna de la franja es
  // `auto` en el grid, o sea que su ancho SALE DEL CONTENIDO. Con la miniatura de 1×1 la
  // franja medía 268 px de 640 (42 %) y el invariante de composición pasaba VERDE; con una
  // captura de verdad medía 489 (76 %), la columna del texto se quedaba en CERO y el nombre
  // salía a palabra por línea con «Continue» montado sobre un chip. El aserto estaba bien
  // escrito y era VACUO: su testigo no instanciaba la diferencia que decía medir.
  // ★★ Un dato de prueba degenerado no es «suficiente para lo que mira este aserto»:
  //    convierte al aserto en decoración. Se instancia la diferencia DONDE EXISTE.
  const SHOT = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 320; c.height = 200;               // el tamaño real de una captura del juego
    const g = c.getContext("2d");
    g.fillStyle = "#264"; g.fillRect(0, 0, 320, 200);
    g.fillStyle = "#dc9"; g.fillRect(40, 30, 240, 140);
    return c.toDataURL("image/jpeg", 0.6);
  });
  await page.evaluate(async ({ C, SHOT }) => {
    localStorage.setItem(C.indice, JSON.stringify([
      { id: "mapa", name: "En Britannia", timestamp: 1754500000000, turns: 10, locationName: "Britannia" },
      { id: "foto", name: "Con captura", timestamp: 1754400000000, turns: 20, locationName: "Britannia" },
      { id: "pelada", name: "Dentro de Yew", timestamp: 1754300000000, turns: 30, locationName: "Yew" },
    ]));
    localStorage.setItem(C.prefijo + "mapa",
      JSON.stringify({ version: 1, position: { location: 0, floor: 0, x: 60, y: 90 }, gold: 5 }));
    localStorage.setItem(C.prefijo + "foto",
      JSON.stringify({ version: 1, position: { location: 0, floor: 0, x: 10, y: 10 }, gold: 5 }));
    localStorage.setItem(C.prefijo + "pelada",
      JSON.stringify({ version: 1, position: { location: 4, floor: 0, x: 15, y: 15 }, gold: 5 }));
    localStorage.setItem("u5clone:shot:foto", SHOT);
    const mapa = Array.from({ length: 256 }, () => new Array(256).fill(4));
    const cache = await caches.open("u5-assets-v1");
    await cache.put(new Request("/assets/maps/overworld.json"),
      new Response(JSON.stringify(mapa), { headers: { "Content-Type": "application/json" } }));
  }, { C: CLAVES, SHOT });
  await page.reload();
  await page.waitForSelector("#partidas .guardado__mapa", { timeout: 30000 });

  // 🔴 EL CONTROL, Y VA PRIMERO: sin visor abierto NO hay ningún `<dialog>` en el DOM.
  // Sin esto, «el visor se abre» pasaría verde con un dialog montado siempre y abierto
  // desde el principio — que es justamente uno de los mutantes de abajo.
  const dialogsAlInicio = await page.locator("dialog").count();
  ok(dialogsAlInicio === 0, "2e · control: sin abrir nada, CERO dialog en el DOM", dialogsAlInicio);

  // ── 🔴 EL CASO QUE HOY FALLA EN PRODUCCIÓN: CAPTURA **Y** MAPA A LA VEZ ────────
  // El usuario grabó una partida nueva, ganó la foto y PERDIÓ el mapa, porque el
  // minimapa sólo se encolaba `if (!foto)`. Este aserto es el que instancia la
  // diferencia DONDE EXISTE: una partida con LAS DOS cosas. Sin él, «las dos
  // miniaturas» sería una afirmación que ninguna tarjeta del testigo llega a ejercer.
  await page.evaluate(({ C, SHOT }) => {
    const metas = JSON.parse(localStorage.getItem(C.indice));
    metas.push({ id: "ambas", name: "Foto y mapa", timestamp: 1754200000000, turns: 40, locationName: "Britannia" });
    localStorage.setItem(C.indice, JSON.stringify(metas));
    localStorage.setItem(C.prefijo + "ambas",
      JSON.stringify({ version: 1, position: { location: 0, floor: 0, x: 200, y: 40 }, gold: 5 }));
    localStorage.setItem("u5clone:shot:ambas", SHOT);
  }, { C: CLAVES, SHOT });
  await page.reload();
  await page.waitForSelector("#partidas .guardado__mapa", { timeout: 30000 });
  await page.waitForTimeout(800); // el mapa llega en diferido; sin margen se cuenta de menos

  const porTarjeta = await page.evaluate(() =>
    [...document.querySelectorAll("#partidas .guardado--tarjeta")].map((li) => ({
      n: li.querySelector(".guardado__nombre")?.textContent,
      foto: li.querySelectorAll(".guardado__foto").length,
      mapa: li.querySelectorAll(".guardado__mapa").length,
      franja: li.querySelectorAll(".guardado__media").length,
    })));
  console.log(`    por tarjeta: ${JSON.stringify(porTarjeta)}`);
  const ambas = porTarjeta.find((t) => t.n === "Foto y mapa");
  ok(ambas && ambas.foto === 1 && ambas.mapa === 1,
     "2e · una partida CON captura Y CON posición pinta LAS DOS miniaturas", ambas);

  // 🔴 LA COMPOSICIÓN, QUE ES LO QUE MIS SONDAS NO MIRABAN. Con las dos miniaturas puestas,
  // TODOS los asertos de arriba salían verdes —contaban miniaturas y medían dianas, las dos
  // cosas correctas— mientras la tarjeta estaba ROTA en escritorio: la franja se comía el
  // ancho y el nombre salía a PALABRA POR LÍNEA con los chips en columna. Lo vi en una
  // captura, no en la suite.
  // El invariante que lo habría cazado: la franja no puede pasar de la MITAD de la tarjeta,
  // porque lo que queda es lo que lee el texto. Es una proporción, no un píxel: sobrevive a
  // que se cambie el tamaño de la miniatura, que es justo lo que se va a tocar.
  const reparto = await page.evaluate(() => {
    const li = [...document.querySelectorAll("#partidas .guardado--tarjeta")]
      .find((n) => n.querySelectorAll(".guardado__foto").length === 1 &&
                   n.querySelectorAll(".guardado__mapa").length === 1);
    if (!li) return null;
    const c = li.getBoundingClientRect().width;
    const m = li.querySelector(".guardado__media").getBoundingClientRect().width;
    const i = li.querySelector(".guardado__info").getBoundingClientRect().width;
    return { tarjeta: Math.round(c), franja: Math.round(m), info: Math.round(i),
             pctFranja: Math.round((m / c) * 100) };
  });
  console.log(`    reparto de la tarjeta: ${JSON.stringify(reparto)}`);
  ok(reparto && reparto.pctFranja <= 50,
     "2e · las miniaturas ocupan como mucho la MITAD de la tarjeta (el texto necesita el resto)",
     reparto);
  ok(reparto && reparto.info >= 240,
     "2e · y al texto le quedan ≥240 px: el nombre no cae a palabra por línea", reparto);
  // 🔴 LAS TRES RECÍPROCAS, porque «pinta las dos» a secas se cumpliría pintando dos
  // SIEMPRE — incluido un mapa vacío en la que no tiene posición.
  const soloFoto = porTarjeta.find((t) => t.n === "Con captura");
  ok(soloFoto && soloFoto.foto === 1 && soloFoto.mapa === 1,
     "2e · recíproca: la de sólo-captura SÍ gana mapa ahora (tiene posición de sobremundo)", soloFoto);
  const soloMapa = porTarjeta.find((t) => t.n === "En Britannia");
  ok(soloMapa && soloMapa.foto === 0 && soloMapa.mapa === 1,
     "2e · recíproca: sin captura, mapa solo — y NINGUNA foto vacía", soloMapa);
  const pelada = porTarjeta.find((t) => t.n === "Dentro de Yew");
  ok(pelada && pelada.foto === 0 && pelada.mapa === 0 && pelada.franja === 0,
     "2e · recíproca: sin captura y sin posición, ni miniaturas NI franja vacía", pelada);

  // Censo de lo clicable: ahora hay más lupas, y la de pueblo-sin-foto sigue sin ninguna.
  const lupas = await page.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll("#partidas .guardado--tarjeta")].map((li) => [
      li.querySelector(".guardado__nombre")?.textContent,
      li.querySelectorAll("button.guardado__lupa").length,
    ])));
  console.log(`    lupas por tarjeta: ${JSON.stringify(lupas)}`);
  // Una lupa POR MINIATURA: la de «foto y mapa» tiene DOS clicables independientes.
  ok(lupas["Foto y mapa"] === 2, "2e · con las dos miniaturas hay DOS clicables, no uno", lupas);
  ok(lupas["Dentro de Yew"] === 0, "2e · y NINGUNA en la que no tiene ilustración", lupas);
  // 🔴 Y que sean BOTONES de verdad, no un div con role: es lo que da Enter y Espacio.
  const etiquetas = await page.evaluate(() =>
    [...document.querySelectorAll("#partidas button.guardado__lupa")]
      .map((b) => [b.tagName, b.getAttribute("aria-label")]));
  ok(etiquetas.every(([t]) => t === "BUTTON"), "2e · son <button> nativos", etiquetas);
  ok(etiquetas.some(([, a]) => /map/i.test(a || "")) && etiquetas.some(([, a]) => /screenshot/i.test(a || "")),
     "2e · y su nombre accesible dice QUÉ abre cada una (no «ampliar» dos veces)", etiquetas);

  // ── (a) RATÓN sobre el MINIMAPA ────────────────────────────────────────────────
  await page.locator("#partidas .guardado__mapa").first().locator("xpath=..").click();
  ok(await abrio(), "2e · el CLIC en el minimapa abre el visor", "no apareció dialog.visor[open]");
  const abierto = await page.evaluate(() => {
    const d = document.querySelector("dialog.visor");
    if (!d) return { open: false };
    const img = d.querySelector(".visor__imagen");
    const chico = document.querySelector("#partidas .guardado__mapa");
    return {
      open: d.open, rotulo: d.getAttribute("aria-label"),
      tag: img?.tagName, lado: img ? img.width : 0, ladoTarjeta: chico ? chico.width : 0,
      cerrarDentro: d.querySelectorAll("button").length,
      foco: document.activeElement?.className,
    };
  });
  console.log(`    ${JSON.stringify(abierto)}`);
  ok(/map/i.test(abierto.rotulo || ""), "2e · con el rótulo del mapa", abierto.rotulo);
  // 🔴 El mapa del visor se REPINTA a escala 3, no se estira el de la tarjeta: 256·3=768.
  // Si saliera 256, estaría escalando el canvas chico por CSS y la marca saldría dentada.
  ok(abierto.lado === 768 && abierto.ladoTarjeta === 256,
     "2e · el mapa grande se REPINTA a escala 3 (768 px de lienzo), la tarjeta sigue a 256",
     abierto);
  // Lección del replay: UN solo cerrar. El único botón del diálogo es el del cromo.
  ok(abierto.cerrarDentro === 1, "2e · un ÚNICO «cerrar» (el del cromo), sin otro dentro", abierto);
  ok(/visor__cerrar/.test(abierto.foco || ""), "2e · el foco entra en el diálogo", abierto.foco);

  // Escape cierra Y DESMONTA (se cuentan NODOS: `open=false` dejaría el dialog en el DOM,
  // que es exactamente el rojo que costó descubrir en el popover de repetición).
  await page.keyboard.press("Escape");
  await page.waitForSelector("dialog.visor", { state: "detached", timeout: 10000 }).catch(() => {});
  const tras = await page.evaluate(() => ({
    dialogs: document.querySelectorAll("dialog").length,
    foco: document.activeElement?.className,
  }));
  ok(tras.dialogs === 0, "2e · Escape cierra Y saca el dialog del DOM", tras);
  ok(/guardado__lupa/.test(tras.foco || ""), "2e · y el foco vuelve a la lupa que lo abrió", tras.foco);

  // ── (b) TECLADO sobre la CAPTURA ───────────────────────────────────────────────
  // 🔴 Se abre con ENTER sobre el botón enfocado, no con `click()`: es la vía que un
  // `role="button"` a mano habría dejado muerta, y es la que hay que medir.
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("#partidas button.guardado__lupa")]
      .find((x) => x.querySelector(".guardado__foto"));
    b.focus();
  });
  await page.keyboard.press("Enter");
  ok(await abrio(), "2e · ENTER sobre la lupa enfocada abre el visor (la vía del teclado)",
     "no apareció dialog.visor[open]");
  const porTeclado = await page.evaluate(() => {
    const d = document.querySelector("dialog.visor");
    if (!d) return {};
    const img = d.querySelector(".visor__imagen");
    return { rotulo: d.getAttribute("aria-label"), tag: img?.tagName, src: (img?.getAttribute("src") || "").slice(0, 22) };
  });
  console.log(`    ${JSON.stringify(porTeclado)}`);
  ok(/screenshot/i.test(porTeclado.rotulo || ""), "2e · ENTER abre el visor de la CAPTURA", porTeclado);
  ok(porTeclado.tag === "IMG" && porTeclado.src.startsWith("data:image/jpeg"),
     "2e · y lo que enseña es la captura guardada, no otra cosa", porTeclado);
  await page.keyboard.press("Escape");
  await page.waitForSelector("dialog.visor", { state: "detached", timeout: 10000 }).catch(() => {});

  // ── (c) NO PIDE NADA A LA RED, que era la condición del encargo ────────────────
  // Se registra el tráfico DURANTE la apertura: el chunk perezoso y el JSON del mapa ya
  // están cargados, y el visor sólo repinta con lo que hay en memoria.
  const durante = [];
  const anota = (r) => durante.push(r.url());
  page.on("request", anota);
  await page.locator("#partidas .guardado__mapa").first().locator("xpath=..").click();
  ok(await abrio(), "2e · (control del siguiente) el visor vuelve a abrir para medir la red", true);
  page.off("request", anota);
  console.log(`    peticiones al abrir: ${JSON.stringify(durante)}`);
  ok(durante.length === 0, "2e · abrir el visor NO pide NADA a la red", durante);
  await page.keyboard.press("Escape");

  // ── (d) EL CROMO DEL VISOR, MEDIDO ─────────────────────────────────────────────
  // Ver la nota larga de `cromo`/`huerfanas` arriba: esto es exactamente lo que las
  // otras nueve sondas del visor NO miran, y lo único que se rompió de verdad.
  await page.locator("#partidas .guardado__mapa").first().locator("xpath=..").click();
  ok(await abrio(), "2e · (control del cromo) el visor está abierto para medirlo", true);
  const cv = await cromo(page, "dialog.visor");
  console.log("    cromo del visor: " + JSON.stringify(cv));
  ok(cv?.display === "flex", "2e · la barra del visor REPARTE (display:flex, no el «block» de fábrica)", cv);
  ok(cv?.cerrar?.x > cv?.titulo?.d,
     "2e · y el «Cerrar» empieza DESPUÉS de donde acaba el título (no se le monta encima)", cv);
  ok(cv?.barra?.d - cv?.cerrar?.d <= 24,
     "2e · y está PEGADO al borde derecho de la barra (el space-between, que no depende del largo del título)", cv);
  const hv = await huerfanas(page);
  ok(hv.length === 0, "2e · con el visor abierto, ninguna clase nuestra se quedó sin regla CSS", hv);
  await page.keyboard.press("Escape");

  // ── (e) EL ZOOM ────────────────────────────────────────────────────────────────
  // 🔴 SE LEE LA MATRIZ COMPUTADA, no el `style` en línea ni «existe un handler». Lo que
  // el visitante ve es la TRANSFORMACIÓN APLICADA; un `transform` escrito en el atributo
  // pero anulado por una regla CSS daría verde en el atributo y una imagen quieta.
  const escalaDe = () =>
    page.evaluate(() => {
      const img = document.querySelector("dialog.visor .visor__imagen");
      const m = new DOMMatrixReadOnly(getComputedStyle(img).transform);
      return { a: +m.a.toFixed(3), e: Math.round(m.e), f: Math.round(m.f),
               touch: getComputedStyle(img.parentElement).touchAction };
    });

  await page.locator("#partidas .guardado__mapa").first().locator("xpath=..").click();
  ok(await abrio(), "2e · (control del zoom) el visor abierto para medir la matriz", true);
  const z0 = await escalaDe();
  console.log("    zoom inicial: " + JSON.stringify(z0));
  ok(z0.a === 1 && z0.e === 0 && z0.f === 0, "2e · el visor abre SIN zoom (matriz identidad)", z0);
  // 🔴 El gesto de pellizco NO debe hacer zoom del navegador entero: eso lo decide
  // `touch-action`, y por eso se mide en el elemento y no se da por escrito en el CSS.
  ok(z0.touch === "none", "2e · el marco declara touch-action:none (el pellizco es NUESTRO)", z0);

  const caja = await page.locator("dialog.visor .visor__imagen").boundingBox();
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(80);
  const z1 = await escalaDe();
  console.log("    tras la rueda: " + JSON.stringify(z1));
  ok(z1.a > 1, "2e · la RUEDA amplía de verdad (la matriz computada crece)", z1);

  // Arrastre: sólo tiene efecto AMPLIADO, y por eso se prueba aquí y no antes.
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.down();
  await page.mouse.move(caja.x + caja.width / 2 - 60, caja.y + caja.height / 2, { steps: 6 });
  await page.mouse.up();
  const z2 = await escalaDe();
  console.log("    tras arrastrar: " + JSON.stringify(z2));
  ok(z2.e !== z1.e, "2e · y ARRASTRAR desplaza la imagen cuando está ampliada", { z1, z2 });

  // ★★ LA RECÍPROCA DEL ARRASTRE: a escala 1 NO debe moverse. Sin esto, un arrastre que
  // desplazara siempre pasaría el aserto de arriba y rompería la vista sin ampliar.
  await page.mouse.dblclick(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.waitForTimeout(80);
  const z3 = await escalaDe();
  ok(z3.a === 1, "2e · el DOBLE CLIC devuelve a 1 (es la salida de «me he perdido»)", z3);
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.down();
  await page.mouse.move(caja.x + caja.width / 2 - 80, caja.y + caja.height / 2, { steps: 6 });
  await page.mouse.up();
  const z4 = await escalaDe();
  ok(z4.e === 0 && z4.f === 0, "2e · y SIN zoom el arrastre no mueve nada", z4);

  // 🔴 QUE EL ZOOM NO SE HAYA COMIDO EL CIERRE. Se prueba CON zoom puesto, que es el
  // estado en el que un `preventDefault` de más habría roto el Escape.
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(60);
  ok((await escalaDe()).a > 1, "2e · (control) hay zoom puesto antes de probar Escape", true);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok(!(await abrio()), "2e · Escape sigue cerrando CON el zoom puesto", true);

  // Y al reabrir se empieza de cero: el estado murió con el nodo.
  await page.locator("#partidas .guardado__mapa").first().locator("xpath=..").click();
  ok(await abrio(), "2e · (control) el visor reabre", true);
  const z5 = await escalaDe();
  ok(z5.a === 1 && z5.e === 0, "2e · y REABRIR empieza sin zoom (el estado murió con el diálogo)", z5);
  await page.keyboard.press("Escape");

  // ── (f) EL PELLIZCO ────────────────────────────────────────────────────────────
  // ⚠️ ALCANCE DECLARADO: esto emite PointerEvents de `pointerType:"touch"` a mano. Mide
  // MI máquina de estados (dos punteros ⇒ la escala sigue a la distancia), NO que el
  // navegador enrute el gesto en un teléfono real — eso depende de `touch-action`, que
  // se asevera por separado arriba. Las dos mitades juntas son el gesto; ninguna sola
  // basta, y decirlo importa más que el verde.
  await page.locator("#partidas .guardado__mapa").first().locator("xpath=..").click();
  ok(await abrio(), "2e · (control del pellizco) el visor abierto", true);
  const pinza = await page.evaluate(() => {
    const marco = document.querySelector("dialog.visor .visor__marco");
    const img = document.querySelector("dialog.visor .visor__imagen");
    const r = marco.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const ev = (tipo, id, x, y) =>
      marco.dispatchEvent(new PointerEvent(tipo, {
        pointerId: id, pointerType: "touch", clientX: x, clientY: y, bubbles: true,
      }));
    const lee = () => +new DOMMatrixReadOnly(getComputedStyle(img).transform).a.toFixed(3);
    marco.setPointerCapture = () => {};
    ev("pointerdown", 1, cx - 40, cy); ev("pointerdown", 2, cx + 40, cy);
    const antes = lee();
    ev("pointermove", 1, cx - 120, cy); ev("pointermove", 2, cx + 120, cy);
    const abierto = lee();
    ev("pointermove", 1, cx - 40, cy); ev("pointermove", 2, cx + 40, cy);
    const cerrado = lee();
    ev("pointerup", 1, cx - 40, cy); ev("pointerup", 2, cx + 40, cy);
    return { antes, abierto, cerrado };
  });
  console.log("    pellizco: " + JSON.stringify(pinza));
  ok(pinza.abierto > pinza.antes, "2e · ABRIR el pellizco amplía", pinza);
  // 🔴 La recíproca: si sólo se probara abrir, un handler que amplíe con CUALQUIER
  // movimiento de dos dedos pasaría. Cerrar el pellizco tiene que REDUCIR.
  ok(pinza.cerrado < pinza.abierto, "2e · y CERRARLO reduce (sigue a la distancia, no al gesto)", pinza);
  await page.keyboard.press("Escape");

  ok(errores.length === 0, "2e · visor sin errores de consola", errores);
  await ctx.close();
}

// ── 2e · LA TARJETA REDISEÑADA EN UN TELÉFONO ────────────────────────────────
//
// 🔴 SE MIDE, NO SE DECLARA. El CSS no pone un suelo de 44 px a la lupa a propósito —la
// diana ES la miniatura, y en el papel son 132 px—, así que la afirmación «se puede
// pulsar con el dedo» descansa entera en el TAMAÑO RENDERIZADO. Es la lección del botón
// del zip: compilaba, se probaba verde, y en el dispositivo para el que se hizo medía
// 20 px de alto. Aquí se abre un iPhone SE de verdad y se leen los rectángulos.
console.log("\n── 2e · LA TARJETA EN UN TELÉFONO ──");
{
  const { devices } = createRequire(resolve(RAIZ, "package.json"))("playwright");
  const ctx = await browser.newContext({ ...devices["iPhone SE"] });
  const page = await ctx.newPage();
  const SHOT =
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
  await page.goto(`${BASE}/byo`);
  await page.evaluate(async ({ C, SHOT }) => {
    localStorage.setItem(C.indice, JSON.stringify([
      { id: "ambas", name: "Foto y mapa", timestamp: 1754500000000, turns: 10, locationName: "Britannia" },
    ]));
    localStorage.setItem(C.prefijo + "ambas",
      JSON.stringify({ version: 1, position: { location: 0, floor: 0, x: 60, y: 90 }, gold: 5 }));
    localStorage.setItem("u5clone:shot:ambas", SHOT);
    const mapa = Array.from({ length: 256 }, () => new Array(256).fill(4));
    const cache = await caches.open("u5-assets-v1");
    await cache.put(new Request("/assets/maps/overworld.json"),
      new Response(JSON.stringify(mapa), { headers: { "Content-Type": "application/json" } }));
    // 🔴 El manifest hace `hayCopia` verdadero y con él aparece «continuar». Sin
    // sembrarlo, el aserto de sus 44 px medía un elemento que NO EXISTE y salía `null`:
    // un rojo que acusaba al CSS de algo que era culpa del testigo.
    await cache.put(new Request("/assets/manifest.json"), new Response("{}"));
  }, { C: CLAVES, SHOT });
  await page.reload();
  await page.waitForSelector("#partidas .guardado__mapa", { timeout: 30000 });
  await page.waitForTimeout(600);
  const m = await page.evaluate(() => {
    const de = (sel) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null;
    };
    return {
      lupas: [...document.querySelectorAll("#partidas button.guardado__lupa")].map((b) => {
        const r = b.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      }),
      accion: de("#partidas .guardado__accion"),
      desborda: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  console.log(`    iPhone SE: ${JSON.stringify(m)}`);
  ok(m.lupas.length === 2, "2e · en el teléfono siguen estando las DOS miniaturas", m.lupas);
  ok(m.lupas.every((r) => Math.min(r.w, r.h) >= 44),
     "2e · y cada una es pulsable con el dedo: lado MENOR ≥44 px MEDIDOS", m.lupas);
  ok(m.accion !== null && m.accion.h >= 44,
     "2e · «continuar» conserva su suelo de 44 px con el layout nuevo", m.accion);
  // 🔴 Con dos miniaturas al 100 % de ancho en una columna de 320 px, el desbordamiento
  // lateral es EL riesgo del rediseño. Se mide, no se confía en el `minmax(0, 1fr)`.
  ok(!m.desborda, "2e · y la tarjeta NO provoca scroll lateral en 320 px", m.desborda);
  await ctx.close();
}

// ── 2d-bis · EL POPOVER DE REPETICIÓN ────────────────────────────────────────
//
// ⚠️ ALCANCE: esta sonda sirve `demo-byo/dist`, donde `/play.html` NO existe, así que
// el iframe apuntará a un 404. Eso NO invalida lo que aquí se mide —el modal, sus
// semánticas y la MUERTE del iframe al cerrar—, pero sí significa que «el juego se ve
// dentro» no está comprobado aquí. Lo declaro en vez de dejarlo implícito.
console.log("\n── 2d-bis · POPOVER DE REPETICIÓN ──");
{
  const { ctx, page, errores } = await pagina("en");
  await page.goto(`${BASE}/byo`);
  await page.evaluate(async ({ C, REPETICIONES }) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open(C.db, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains(C.almacen)) {
          d.createObjectStore(C.almacen, { keyPath: "id" }).createIndex("createdAt", "createdAt");
        }
      };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction(C.almacen, "readwrite");
      for (const l of REPETICIONES) tx.objectStore(C.almacen).put(l);
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
    db.close();
    const cache = await caches.open("u5-assets-v1");
    await cache.put(new Request("/assets/manifest.json"), new Response("{}"));
  }, { C: CLAVES, REPETICIONES });
  await page.reload();
  await page.waitForSelector("#partidas .guardados");

  // El enlace CONSERVA su href real (ctrl-clic y «abrir en pestaña» siguen vivos).
  const href = await page.locator("#partidas a").last().getAttribute("href");
  ok(href === "/play.html?replay=rep-xyz", "2d-bis · «ver repetición» sigue siendo un enlace de verdad", href);

  // 🔴 EL ESTADO «CARGANDO» ES TRANSITORIO y aquí dura CERO: `/play.html` no existe en
  // `demo-byo/dist`, así que el iframe dispara `load` con el 404 al instante y el aviso
  // se retira antes de que ninguna lectura llegue. Mi primer aserto lo leía a posteriori
  // y salía rojo acusando a la pantalla de un defecto que estaba en la sonda.
  // Se registra con un MutationObserver — el mismo remedio que el estado 02 de la zona
  // de carga. ★★ Un estado transitorio se verifica con un REGISTRO, no con una lectura.
  await page.evaluate(() => {
    window.__vioCargando = false;
    new MutationObserver(() => {
      if (document.querySelector(".replay-modal__cargando")) window.__vioCargando = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole("link", { name: /Watch replay/i }).click();
  await page.waitForSelector("dialog.replay-modal", { timeout: 30000 });
  const abierto = await page.evaluate(() => {
    const d = document.querySelector("dialog.replay-modal");
    return { open: d.open, modal: d.matches(":modal"), aria: d.getAttribute("aria-label"),
             cargando: !!d.querySelector(".replay-modal__cargando"),
             src: d.querySelector("iframe")?.getAttribute("src") };
  });
  console.log("    " + JSON.stringify(abierto));
  ok(abierto.open && abierto.modal, "2d-bis · es un dialog MODAL de verdad (foco atrapado por el navegador)", abierto);
  ok(abierto.aria === "Britannia · turno 120", "2d-bis · con nombre accesible", abierto);
  ok(await page.evaluate(() => window.__vioCargando),
     "2d-bis · abre con estado «cargando» (registrado, no leído: aquí dura 0 ms)", abierto);
  ok((abierto.src || "").includes("embed=1") && (abierto.src || "").includes("replay=rep-xyz"),
     "2d-bis · el iframe pide ESA repetición en modo embed", abierto.src);

  // ── EL CROMO DEL POPOVER ───────────────────────────────────────────────────────
  // 🔴 ESTAS DOS SONDAS NO SON DE ESTE CARRIL Y ESTÁN AQUÍ POR ESO. El popover es de
  // otro carril y llegó por main; yo le borré sus 6 reglas de CSS desde un carril que
  // no lo tocaba, editando un rango de `byo.html` que resultó contenerlas. Nada de lo
  // que este bloque medía —modal, aria, cargando, src, Escape, muerte del iframe— se
  // movió un milímetro. ★★ Un carril puede romper la PRESENTACIÓN de otro sin tocar su
  // código, porque el CSS de los tres vive en un único `<style>` compartido: la sonda
  // que protege un componente tiene que vivir con el componente, no con quien lo hizo.
  const cr = await cromo(page, "dialog.replay-modal");
  console.log("    cromo del popover: " + JSON.stringify(cr));
  ok(cr?.display === "flex", "2d-bis · la barra del popover REPARTE (display:flex)", cr);
  ok(cr?.cerrar?.x > cr?.titulo?.d,
     "2d-bis · y el «Cerrar» empieza DESPUÉS del título (no se le monta encima)", cr);
  ok(cr?.barra?.d - cr?.cerrar?.d <= 24,
     "2d-bis · y está PEGADO al borde derecho de la barra (el space-between)", cr);
  const hr = await huerfanas(page);
  ok(hr.length === 0, "2d-bis · con el popover abierto, ninguna clase nuestra se quedó sin regla CSS", hr);

  // 🔴 Escape cierra Y MATA el iframe — no basta con que el modal desaparezca.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const tras = await page.evaluate(() => ({
    dialogs: document.querySelectorAll("dialog.replay-modal").length,
    iframes: document.querySelectorAll("iframe").length,
  }));
  ok(tras.dialogs === 0, "2d-bis · Escape cierra el popover", tras);
  ok(tras.iframes === 0, "2d-bis · y MATA el iframe (no queda un juego corriendo detrás)", tras);
  // ⚠️ El 404 de `/play.html` es DEL ENTORNO de esta sonda, no del popover: aquí se
  // sirve `demo-byo/dist`, donde el juego no está. Se excluye ESE recurso por su
  // nombre y se exige cero errores del resto — excluir la clase entera dejaría la
  // comprobación sin dientes.
  const ajenos = errores.filter((e) => !/404/.test(e));
  ok(ajenos.length === 0, "2d-bis · popover sin errores de consola (salvo el 404 de /play.html, ausente aquí)", errores);
  await ctx.close();
}

await browser.close();
console.log(fallos.length ? `\n❌ ${fallos.length} FALLOS: ${fallos.join(" · ")}` : "\n✅ TODO VERDE");
process.exit(fallos.length ? 1 : 0);
