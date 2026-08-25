/**
 * RENDERIZA una partida predefinida (`game/partidas/<id>.json`) a un `.webm` (#158).
 *
 * ── QUÉ SUPERFICIE SE CAPTURA, Y POR QUÉ LA COMPUESTA ────────────────────────────────
 * El canvas COMPUESTO (la piel de defecto, suavizada), no el búfer nativo de 320×200.
 * El vídeo es «ver una partida»: tiene que enseñar lo que ve quien abre el juego, que es
 * la piel por defecto — la misma que la galería declara al pie y la misma que ya sale en
 * el popover de repeticiones de `/byo`.
 *
 * 🔴 Y NO SON LA MISMA IMAGEN ESCALADA, aunque el docstring de `ui/screenshot.ts` diga eso
 * del canvas del shader a 960×600: ESE es otro canvas. Medido sobre el mismo instante de
 * la misma partida, el nativo tiene **12 colores** y el compuesto **442** — un ×N nearest
 * no inventa 430 colores. Contar colores es el discriminante barato; mirar una captura de
 * página reducida NO lo es (el suavizado no se ve, y por ahí se coló el error).
 * Coste medido de la decisión: 11.120 B/s frente a 4.373 B/s del nativo escalado.
 *
 * ── DETERMINISMO: QUÉ ESTÁ PROBADO Y QUÉ NO ──────────────────────────────────────────
 * **La PARTIDA es determinista y se comprueba aquí**: `--carear` reproduce dos veces y
 * exige que las huellas de estado (`liveSeed|JSON(state)`, el predicado de
 * `game/e2e/replay-roundtrip.spec.ts`) coincidan una a una.
 *
 * **Los PÍXELES no lo son, y está medido y aceptado** (decisión del lead, 11-08): la fase
 * del reloj de animación de la piel (`skin/fiel/skin.ts:2620-2673`, acumulador de `dt`
 * sobre rAF) es de RENDER, no de estado, así que `restore(anchor)` no la toca y la cadencia
 * de rAF no se puede fijar desde fuera. Magnitud: **0,531 % de píxeles por fotograma de
 * media, máximo 0,97 %**, siempre dentro del visor del mapa (antorchas, agua, el sprite en
 * el recorrido). Dos renders con la antorcha en otra fase son igual de válidos.
 *
 * 🔴 EL AVISO DE INSTRUMENTO QUE ESTO DEJA: un hash de fotograma distinto NO distingue
 * «la partida diverge» de «la antorcha parpadea en otra fase». Midiendo sólo píxeles se
 * firma un veredicto sobre el JUEGO con un instrumento que mide la PRESENTACIÓN. Por eso
 * `--carear` compara LAS DOS COSAS y las informa por separado, con distinto peso: las
 * huellas de ESTADO deciden (si difieren, la herramienta falla) y los hashes de PÍXEL sólo
 * se cuentan (si difieren, se dice cuántos — no es un fallo, es un dato para el rótulo).
 *
 * ── EL RELOJ: POR QUÉ NO ES EL DE CDP ────────────────────────────────────────────────
 * 🔴 `Emulation.setVirtualTimePolicy` está RETIRADO de aquí, y su cuelgue NO tiene mecanismo
 * asignado: yo no sé por qué se colgaba y no lo invento. Lo MEDIDO (sonda de 3 repeticiones
 * del orden exacto del render, 11-08): con la política `advance` sobre una página ya cargada,
 * **2 de 3 corridas no recibieron nunca `virtualTimeBudgetExpired`** en 20 s —con CERO
 * peticiones abiertas, así que la explicación «hay red en vuelo» queda otra vez refutada— y
 * la que sí lo recibió tardó **5.325 ms en devolver un presupuesto de 83 ms**. Un reloj que
 * falla 2 de cada 3 veces y que, cuando funciona, va 64× más lento que el tiempo que simula,
 * no sirve para 721 fotogramas por vídeo. No se arregla lo que no se entiende: se sustituye
 * por un instrumento cuyo mecanismo sí está a la vista.
 *
 * ⇒ EL RELOJ VIVE EN LA PÁGINA. Se sustituyen `requestAnimationFrame` y `performance.now`
 * por una cola y un contador que esta herramienta avanza a mano. Es lícito porque **las dos
 * pieles derivan su animación de rAF y de nada más**: la fiel calcula `dt` con el ARGUMENTO
 * de tiempo del callback (`skin/fiel/skin.ts:2620-2673`, `dt = ts - lastTs`) y el bucle de
 * presentación de la shader es rAF sin timestamp (`skin/shader/skin.ts:2736-2744`). Quien
 * controle la cola de rAF controla el reloj de la animación entera.
 *
 * 🔴 LA MIGRACIÓN DE LOS BUCLES VIVOS ES UN PASO, NO UN DETALLE: al instalar la cola, los
 * bucles ya arrancados siguen colgando del rAF NATIVO. Cada uno se muda solo la primera vez
 * que se re-registra, así que hay que dejar pasar frames de pared y luego COMPROBAR que la
 * cola tiene inquilinos. Sin esa comprobación, un `avanza()` sobre cola vacía no avanza nada
 * y produce 721 fotogramas idénticos: un vídeo congelado que pasa todas las demás guardas.
 *
 * 🔴 Depende de material de EA (`game/assets`, gitignored) ⇒ NO va en la batería.
 *
 * Uso:
 *   npx vite game --config game/vite.config.ts --port 5250 &
 *   U5_PORT=5250 node game/tools/partida-render.mjs <id> [--carear]
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { avanzaPasoDeReplay, SUBFOTOGRAMAS_MIN, TOPE_SUBFOTOGRAMAS } from "./avance-fx.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { chromium } = createRequire(resolve(RAIZ, "package.json"))("playwright");
const BASE = `http://localhost:${process.env.U5_PORT || 5250}`;

const ID = process.argv[2];
const CAREAR = process.argv.includes("--carear");
if (!ID) {
  console.error("uso: node game/tools/partida-render.mjs <id> [--carear]");
  process.exit(2);
}
const partida = JSON.parse(readFileSync(resolve(RAIZ, "game/partidas", `${ID}.json`), "utf8"));

// 🔴 STAGING, **NUNCA** `original/av-referencia/web-openu5/`. Ese directorio no es «donde
// viven los vídeos»: es PUBLICACIÓN DIFERIDA — `build-demo-publica.sh:238` lo rsyncea
// ENTERO al sitio, sin filtro de nombre ni de extensión. Escribir ahí directamente ya
// puso un vídeo con la superficie equivocada a un deploy de distancia (11-08).
// La PROMOCIÓN a /medios/ es un paso aparte y deliberado: se hace tras MIRAR el vídeo.
// Un fichero equivocado en staging es basura; en av-referencia es un despliegue.
// 🔴 Y EL STAGING **TAMPOCO** PUEDE VIVIR EN `game/dist`, que es donde estaba: medido el
// 11-08, la batería se llevó por delante los tres .webm recién renderizados y en silencio.
// `game/vite.config.ts` no fija `outDir` ni `emptyOutDir`, así que rige el default de vite:
// **`vite build` VACÍA `game/dist`** — y la batería construye. El directorio de staging no
// puede ser un subdirectorio de una salida de build: no es que «no convenga», es que otro
// proceso legítimo lo borra entero sin avisar y el fallo se lee como «no renderizaste».
const SALIDA = resolve(RAIZ, ".partidas-staging");
const TMP = resolve(RAIZ, ".partidas-staging/.frames");

const FPS = 12;
const CRF = 32;
const MS = 1000 / FPS;
// 🔴 AQUÍ VIVÍA `SUBFRAMES = 6`, el presupuesto FIJO de subfotogramas por paso de replay, y
// era el defecto de #207: toda animación más larga que 6·MS = 500 ms salía DECAPITADA en el
// vídeo, sin error y sin síntoma. Hoy el mínimo y el tope viven en `avance-fx.mjs` con su
// régimen escrito, y el bucle avanza MIENTRAS haya animación viva. Ver aquel fichero antes
// de tocar cualquiera de los dos números.

/**
 * El ANCLA de la partida, compuesta bajo reloj NORMAL y en su propia pestaña.
 *
 * 🔴 SEPARADA DEL RENDER A PROPÓSITO: componer el momento pide un `import()` dinámico y dos
 * `fetch` de `/assets`, y con eso DENTRO de la fase cronometrada la herramienta se colgaba
 * sin escribir un fotograma ni imprimir una línea. Sacarlo aquí lo arregló.
 * ⚠️ El PORQUÉ está SIN SONDEAR. Lo que se me ocurrió entonces —«los timers congelados no
 * resuelven las promesas de red»— es la MISMA explicación que después medí en el segundo
 * cuelgue y resultó FALSA (había cero peticiones abiertas). No la repito aquí como causa:
 * lo comprobado es que separarlo funciona, y separar la autoría de la fase medida es
 * bueno por sí solo.
 */
async function ancla() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${BASE}/?fresh&nointro`);
  await page.waitForFunction(() => !!(window.__u5test?.state?.()), null, { timeout: 120000 });
  const estado = await page.evaluate(async (momId) => {
    const [compone, defs] = await Promise.all([
      import("/src/momentos/compone.js"),
      import("/src/momentos/defs.js"),
    ]);
    const def = defs.momentoPorId(momId);
    if (!def) throw new Error(`momento desconocido: ${momId}`);
    const [rInit, rGam] = await Promise.all([
      fetch("/assets/initial-state.json"),
      fetch("/assets/init.gam"),
    ]);
    if (!rInit.ok || !rGam.ok) throw new Error("sin extracción local (game/assets)");
    return JSON.stringify(
      compone.importaMomento(
        compone.horneaMomento(def, await rInit.json(), new Uint8Array(await rGam.arrayBuffer())),
      ),
    );
  }, partida.base.id);
  await browser.close();
  return estado;
}

async function corrida(etiqueta, guardarPng, estadoAncla) {
  const dir = `${TMP}/${etiqueta}`;
  if (guardarPng) { rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true }); }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  let dims = "(sin medir)";
  page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 200)));

  // 🔴 EL ARRANQUE VA A RELOJ DE PARED, Y EL DE LA COLA SE INSTALA DESPUÉS.
  // La piel compuesta se MONTA en un bucle rAF, así que necesita frames DURANTE el arranque.
  // Medido por la sonda de abajo en cada corrida: con este orden monta (1280×800 de 6 canvas)
  // y sin él el heurístico caía al búfer nativo de 320×200.
  await page.goto(`${BASE}/?fresh&nointro`);
  await page.waitForFunction(() => !!(window.__u5test?.state?.()), null, { timeout: 120000 });
  await page.waitForFunction(
    () => [...document.querySelectorAll("canvas")].some((c) => c.width > 320 && c.height > 200),
    null,
    { timeout: 60000 },
  ).catch(() => { throw new Error("la piel compuesta no montó ni con reloj de pared"); });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  await page.waitForTimeout(1500);
  // Sonda EN CADA CORRIDA: qué superficie hay ANTES de congelar el reloj. Si esto miente,
  // el vídeo sale mal en silencio — y ya pasó una vez.
  const antes = await page.evaluate(() => {
    const cs = [...document.querySelectorAll("canvas")];
    const m = cs.reduce((a, x) => (x.width * x.height > a.width * a.height ? x : a));
    return `${m.width}×${m.height} de ${cs.length} canvas`;
  });
  console.log(`  [${etiqueta}] superficie mayor ANTES de instalar el reloj: ${antes}`);

  // ── INSTALACIÓN DEL RELOJ DE LA PÁGINA ──────────────────────────────────────────────
  // `requestAnimationFrame` pasa a ser una cola que sólo vacía `avanza()`, y `performance.now`
  // pasa a leer el contador de esa cola (lo usan las cadencias de fx de combate,
  // `skin/fiel/skin.ts:2693-2696`). El contador ARRANCA en el `performance.now()` real para
  // no dar un salto atrás al primer `dt` de los bucles que ya están corriendo.
  await page.evaluate(() => {
    const w = window;
    const cola = new Map();
    let siguiente = 1;
    const perfReal = performance.now.bind(performance);
    w.__reloj = {
      t: perfReal(),
      encolados: () => cola.size,
      avanza(ms) {
        this.t += ms;
        const lote = [...cola.values()];
        cola.clear();
        for (const cb of lote) cb(this.t);
        return lote.length;
      },
    };
    w.requestAnimationFrame = (cb) => { const id = siguiente++; cola.set(id, cb); return id; };
    w.cancelAnimationFrame = (id) => { cola.delete(id); };
    performance.now = () => w.__reloj.t;
  });
  // Los bucles vivos aún cuelgan del rAF nativo; cada uno se muda al re-registrarse. Se les
  // dan frames de PARED y luego se COMPRUEBA que la cola tiene inquilinos: con cola vacía
  // `avanza()` no avanza nada y el vídeo saldría congelado pasando todas las demás guardas.
  await page.waitForTimeout(500);
  const inquilinos = await page.evaluate(() => window.__reloj.encolados());
  if (inquilinos < 2) {
    throw new Error(
      `sólo ${inquilinos} bucle(s) rAF migraron a la cola del reloj (se esperan al menos 2: ` +
      `el de la piel fiel y el de presentación de la shader). Con la cola vacía el vídeo ` +
      `saldría congelado sin que ninguna otra guarda lo notase.`,
    );
  }
  console.log(`  [${etiqueta}] bucles rAF migrados a la cola del reloj: ${inquilinos}`);

  /**
   * Avanza `ms` del reloj de la página y ejecuta los callbacks de rAF pendientes.
   *
   * Se vacía DOS VECES: la primera con el tiempo nuevo (la piel fiel calcula su `dt` y
   * repinta el búfer nativo) y la segunda con el MISMO tiempo (`dt` = 0, no avanza nada)
   * para que el bucle de presentación de la shader componga lo recién pintado. Sin la
   * segunda, el canvas compuesto va un fotograma por detrás del estado.
   */
  const avanza = async (ms) => {
    const n = await page.evaluate((m) => window.__reloj.avanza(m) + window.__reloj.avanza(0), ms);
    if (n === 0) throw new Error("la cola del reloj se vació: ningún bucle rAF sigue vivo");
  };

  // El log se carga con el ancla YA COMPUESTA (ver `ancla()`): cero red aquí dentro.
  await page.evaluate(({ p, estado }) => {
    window.__u5test.replay.load({
      v: 1, id: p.id, label: p.id, createdAt: 0,
      anchor: { state: estado, seed: p.semilla },
      keys: p.keys, turns: p.turns, mods: p.mods, count: p.count, lastTurn: p.lastTurn,
    });
  }, { p: partida, estado: estadoAncla });
  await avanza(MS);

  /**
   * 🔴 LA SUPERFICIE SE COMPRUEBA, NO SE SUPONE — y esto nació de un fallo mío.
   * «El canvas mayor» eligió el búfer NATIVO de 320×200 porque, bajo reloj virtual, la piel
   * compuesta no estaba montada: el heurístico devolvió la superficie EQUIVOCADA sin decir
   * nada, y el vídeo salió con los píxeles duros de 1988 en vez de la piel de defecto que
   * es la decisión escrita. Peor: la línea de resumen imprimía «1280×800» como literal
   * CABLEADO, así que el rótulo afirmaba la superficie correcta sobre un artefacto que era
   * la otra. Lo cazó un `ffprobe`, no el log.
   * ★★ Un rótulo que no se deriva del artefacto puede contradecirlo indefinidamente. Aquí
   * las dimensiones salen del PNG capturado, y si no son las de la piel compuesta la
   * herramienta ABORTA en vez de producir un vídeo callado y equivocado.
   */
  const captura = async (i) => {
    const { url, w, h, n } = await page.evaluate(() => {
      const cs = [...document.querySelectorAll("canvas")];
      const c = cs.reduce((a, x) => (x.width * x.height > a.width * a.height ? x : a));
      return { url: c.toDataURL("image/png"), w: c.width, h: c.height, n: cs.length };
    });
    if (w <= 320 || h <= 200) {
      throw new Error(
        `SUPERFICIE EQUIVOCADA: el canvas mayor es ${w}×${h} de ${n} canvas. Eso es el búfer ` +
        `NATIVO, no la piel compuesta que el vídeo debe enseñar. La piel de defecto no se ha ` +
        `montado en esta corrida; no se produce vídeo con la superficie que no es.`,
      );
    }
    dims = `${w}×${h}`;
    const buf = Buffer.from(url.split(",")[1], "base64");
    if (guardarPng) writeFileSync(`${dir}/f${String(i).padStart(5, "0")}.png`, buf);
    return createHash("sha256").update(buf).digest("hex");
  };

  /**
   * ¿Sigue pintándose algún efecto AV transitorio? (#207).
   *
   * 🔴 La AUSENCIA del hook se comprueba UNA VEZ y ABORTA, en vez de degradar a `false`.
   * Un `?.() ?? false` habría sido lo cómodo y es justo el fallo que hay que impedir:
   * «no hay hook» y «no hay animación» son indistinguibles desde el valor, así que el
   * grabador habría vuelto SIN AVISAR al presupuesto fijo de antes de #207 — el mismo
   * vídeo decapitado, con el arreglo puesto y los tests en verde.
   */
  if ((await page.evaluate(() => typeof window.__u5test?.fxActive)) !== "function") {
    throw new Error(
      "sin `__u5test.fxActive`: el grabador no puede saber cuándo termina una animación y " +
      "cortaría los efectos como antes de #207. El hook es DEV-only (`main.ts`) — ¿estás " +
      "sirviendo un build de producción en vez de `vite game`?",
    );
  }
  /**
   * 🔴 Y NO BASTA CON QUE EL HOOK EXISTA: tiene que RESPONDER. Devuelve `null` cuando no
   * hay piel montada o cuando la ACTIVA no declara la propiedad, y ese caso ABORTA — leerlo
   * como «no hay animación» es exactamente el defecto que costó un sello entero: el hook
   * existía, devolvía un booleano perfectamente formado, y era el de una piel que no
   * pintaba. Un predicado que no puede responder no es un predicado en falso.
   */
  const primera = await page.evaluate(() => window.__u5test.fxActive());
  if (typeof primera !== "boolean") {
    throw new Error(
      `\`__u5test.fxActive()\` devolvió ${JSON.stringify(primera)} en vez de un booleano: ` +
      "no hay piel montada, o la piel ACTIVA no declara \`transientFxActive\`. El grabador " +
      "no puede saber cuándo termina una animación y cortaría los efectos como antes de #207.",
    );
  }
  const hayFxViva = () => page.evaluate(() => window.__u5test.fxActive() === true);

  const huellas = [];
  const pixeles = []; // hashes de FOTOGRAMA — instrumento de PRESENTACIÓN, nunca de partida
  let n = 0;
  pixeles.push(await captura(n++));
  huellas.push(await page.evaluate(() => window.__u5test.replay.fingerprint()));
  const subfotograma = async () => { await avanza(MS); pixeles.push(await captura(n++)); };
  // Cuánto se alargó cada paso POR ENCIMA del mínimo. Se imprime al final: es el testigo de
  // que el arreglo de #207 está haciendo algo. Con el presupuesto fijo esta cifra era 0 por
  // construcción, así que un `alargados: 0` en la escena del Shard dice que algo va mal
  // (predicado que no sube, hook que no ve la piel buena) SIN tener que mirar el vídeo.
  let alargados = 0;
  let maxSub = 0;
  for (let k = 0; k < partida.count; k++) {
    await page.evaluate(() => window.__u5test.replay.step());
    huellas.push(await page.evaluate(() => window.__u5test.replay.fingerprint()));
    const { subfotogramas } = await avanzaPasoDeReplay({ subfotograma, hayFxViva, paso: k });
    if (subfotogramas > SUBFOTOGRAMAS_MIN) alargados++;
    if (subfotogramas > maxSub) maxSub = subfotogramas;
  }
  console.log(
    `  [${etiqueta}] subfotogramas: mínimo ${SUBFOTOGRAMAS_MIN}/paso · ${alargados} de ` +
    `${partida.count} pasos ALARGADOS por animación viva · máximo ${maxSub} (tope ${TOPE_SUBFOTOGRAMAS})`,
  );
  const estado = await page.evaluate(() => window.__u5test.replay.status());
  await browser.close();
  return { dir, n, huellas, pixeles, estado, errs, dims };
}

const estadoAncla = await ancla();
console.log(`ancla compuesta desde ${partida.base.id}: ${estadoAncla.length} B (NO viaja en el .json)`);
const a = await corrida("a", true, estadoAncla);
console.log(`RENDER ${ID}: ${a.n} fotogramas · estado final ${JSON.stringify(a.estado)}`);
// Huella del METRAJE (sha256 de los hashes de fotograma en orden): identifica ESTE metraje.
// 🔴 NO ES UN SELLO DE REPRODUCIBILIDAD, y la tentación de leerlo así es justo el error que
// esta herramienta existe para no cometer. Medido: entre DOS INVOCACIONES del mismo id la
// huella CAMBIA (faulinei dio ae8aa09e… y luego 43c07b40…) aunque dentro de UNA invocación
// las dos corridas de `--carear` salieran 0 de 721 distintas. La causa es la misma que
// sostiene la opción (A): la fase de animación al congelar el reloj depende del reloj de
// PARED del arranque, que no se repite entre procesos. Lo que la huella sirve para es
// DECIR de qué metraje habla un vídeo, no para afirmar que se puede rehacer igual.
// 🔴 Y el sha del .webm no vale ni para eso: el encoder VP9 con `-row-mt 1` es
// byte-indeterminista sobre entrada IDÉNTICA (control medido: mismos PNG, mismo tamaño de
// salida, sha256 distinto) ⇒ un .webm distinto NO prueba metraje distinto.
console.log(`  huella del metraje: ${createHash("sha256").update(a.pixeles.join("")).digest("hex").slice(0, 16)}`);
if (a.errs.length) console.error("⚠️  errores de página:", a.errs.join(" | "));
if (a.estado.state === "diverged") { console.error("❌ el reproductor DIVERGIÓ: la partida no se reproduce"); process.exit(1); }

if (CAREAR) {
  const b = await corrida("b", false, estadoAncla);
  // DOS instrumentos, DOS veredictos, DISTINTO peso — y nunca uno leído como el otro.
  // (1) ESTADO: decide. Si las huellas difieren, la partida no se reproduce y esto falla.
  const iguales = a.huellas.length === b.huellas.length && a.huellas.every((h, i) => h === b.huellas[i]);
  console.log(`CAREO de PARTIDA (huellas de estado): ${a.huellas.length} — ${iguales ? "✅ IDÉNTICAS" : "❌ DIFIEREN"}`);
  // (2) PRESENTACIÓN: informa. Los píxeles NO están garantizados (decisión del lead,
  // opción A: la fase de animación es de render y no de estado), así que una diferencia
  // aquí NO es un fallo — es la cifra que el pie del vídeo necesita para no mentir.
  const nPx = Math.min(a.pixeles.length, b.pixeles.length);
  const distintos = a.pixeles.slice(0, nPx).filter((h, i) => h !== b.pixeles[i]).length;
  console.log(
    `CAREO de PRESENTACIÓN (hashes de fotograma, informativo): ${distintos} de ${nPx} difieren` +
    (a.pixeles.length === b.pixeles.length ? "" : ` ⚠️ cardinales distintos: ${a.pixeles.length} vs ${b.pixeles.length}`),
  );
  if (!iguales) process.exit(1);
}

mkdirSync(SALIDA, { recursive: true });
const webm = resolve(SALIDA, `partida-${ID}.webm`);
execFileSync("ffmpeg", [
  "-y", "-v", "error", "-framerate", String(FPS), "-i", `${a.dir}/f%05d.png`,
  "-c:v", "libvpx-vp9", "-crf", String(CRF), "-b:v", "0", "-an", "-row-mt", "1", webm,
]);
const bytes = statSync(webm).size;
const seg = a.n / FPS;
console.log(`VÍDEO -> ${webm.replace(RAIZ + "/", "")}`);
console.log(`  ${bytes} B · ${seg.toFixed(1)} s · ${Math.round(bytes / seg)} B/s · VP9 crf${CRF} ${a.dims} ${FPS} fps (resolución MEDIDA del PNG, no cableada)`);
rmSync(TMP, { recursive: true, force: true });
