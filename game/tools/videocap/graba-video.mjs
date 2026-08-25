/**
 * GRABA EN VÍDEO un evento del CENSO (game/tools/videocap/CENSO.md) — carril videos-eventos.
 *
 * ── QUÉ PRODUCE ──────────────────────────────────────────────────────────────────────
 * Un `<salida>/<evento>-<piel>.webm` (1280×800, lo que graba Playwright por contexto)
 * por cada evento×piel pedidos, MÁS su `<...>.webm.log.jsonl` — el SIDECAR con el
 * transcript de consola + teclas + huella de estado, con tiempo relativo al inicio del
 * metraje (`sidecar.mjs`). El sidecar es lo que audita `gate.mjs`: sin él, «el vídeo no
 * tiene bloqueos» y «el vídeo muestra el evento que promete» son preguntas distintas y
 * sólo la primera se podía contestar mirando píxeles. Los vídeos NO se commitean
 * (decisión usuario 11-08:
 * material EA servible OK, JAMÁS tracked): `<salida>` es OBLIGATORIA por env y el
 * script ABORTA si cae dentro del repo.
 *
 * ── POR QUÉ LIBRERÍA Y NO @playwright/test ───────────────────────────────────────────
 * Cero configs nuevas y cero cambios en las cinco configs existentes: la población de
 * la foto playwright queda EXACTAMENTE igual (esto es una herramienta de autoría, como
 * partida-graba.mjs, no un test). El vídeo va por `recordVideo` del contexto con
 * size = viewport (captura 1:1 sin reescalado — lección de playwright.grandtour.config.ts:43,
 * y trace ni se enciende: 16 GB de traces vs 0,2 GB de webm, medido allí).
 *
 * ── EL GUION ES DATO ─────────────────────────────────────────────────────────────────
 * Los eventos viven en `eventos.mjs` (siembra + teclas + esperas). Las teclas van
 * SIEMPRE por el handler real (`locator("body").press`) — patrón «organic» de fix-375,
 * receta de dungeon-room-escape.spec.ts. Al final se drena `__u5test.fxActive()` antes
 * de cortar (main.ts:6309 — pregunta al SkinManager, vale con la shader activa).
 *
 * ── LIMITACIÓN DECLARADA: SIN AUDIO ──────────────────────────────────────────────────
 * El webm de Playwright no captura audio. Los cues de cada evento se rinden aparte con
 * el renderCue REAL (`npm run re:audiodiff:render` → WAV por cue) y acompañan la entrega.
 *
 * 🔴 Depende de material de EA (`game/assets`, gitignored) ⇒ NO va en la batería.
 * 🔴 Bajo `navigator.webdriver` el combate va a beat 0 (main.ts:1762): los eventos que
 *    quieren ritmo humano llevan `combeat=400` en su query (lo pone el registro, no tú).
 *
 * Uso (desde la raíz del worktree, con un vite propio en un puerto 52xx COMPROBADO con lsof):
 *   npx vite game --config game/vite.config.ts --port 5211 &
 *   U5_PORT=5211 U5_VIDEOS_OUT=/ruta/fuera/del/repo \
 *     node game/tools/videocap/graba-video.mjs <evento>[,<evento>…]|--all [--piel=shader|faithful]
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, existsSync, renameSync, statSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { EVENTOS } from "./eventos.mjs";
import { tecla, pacersVivos, rotulo } from "../../e2e/tempo-video.mjs";
import { armSidecar, readSidecar, escribeSidecar } from "./sidecar.mjs";
import { execFileSync } from "node:child_process";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../../..");
const { chromium } = createRequire(resolve(RAIZ, "package.json"))("playwright");
const BASE = `http://localhost:${process.env.U5_PORT || 5211}`;

const SALIDA = process.env.U5_VIDEOS_OUT;
if (!SALIDA) {
  console.error("U5_VIDEOS_OUT es obligatoria (directorio FUERA del repo para los .webm)");
  process.exit(2);
}
const salidaAbs = resolve(SALIDA);
if ((salidaAbs + sep).startsWith(RAIZ + sep)) {
  console.error(`U5_VIDEOS_OUT cae dentro del repo (${RAIZ}) — los vídeos no se commitean NUNCA`);
  process.exit(2);
}
mkdirSync(salidaAbs, { recursive: true });

const args = process.argv.slice(2);
const pielArg = args.find((a) => a.startsWith("--piel="))?.slice(7);
const sel = args.filter((a) => !a.startsWith("--"));
const ids = args.includes("--all")
  ? Object.keys(EVENTOS)
  : sel.flatMap((s) => s.split(",")).filter(Boolean);
if (!ids.length) {
  console.error("uso: graba-video.mjs <evento>[,…]|--all [--piel=shader|faithful]");
  console.error(`eventos: ${Object.keys(EVENTOS).join(" ")}`);
  process.exit(2);
}
for (const id of ids) {
  if (!EVENTOS[id]) {
    console.error(`evento desconocido: ${id}`);
    process.exit(2);
  }
}

/** SHA del árbol que grabó, para el `meta` del sidecar (el gate lo imprime: un vídeo se
 *  audita sabiendo de qué código salió). Vacío si no hay git — no es motivo de aborto. */
const SHA = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: RAIZ, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
})();

/** Comprueba la IDENTIDAD del server (REGLA 3: que responda no basta — el <title>). */
async function verificaServer() {
  const res = await fetch(`${BASE}/`).catch(() => null);
  if (!res || !res.ok) {
    console.error(`no responde ${BASE} — arranca el vite propio primero`);
    process.exit(2);
  }
  const html = await res.text();
  if (!/<title>[^<]*Ultima/i.test(html)) {
    console.error(`el server de ${BASE} NO es el juego (título ajeno) — puerto pisado`);
    process.exit(2);
  }
}

/** Siembra el estado según el modo declarado por el evento. */
async function siembra(page, ev) {
  const s = ev.siembra;
  if (!s) return; // fresh
  if (s.url) return { url: s.url, sinMundo: s.sinMundo }; // URL cruda (p.ej. intro SIN nointro)
  if (s.momento) {
    // Mismo camino que partida-graba.mjs:60-89 (y que estadoDeMomento): hornear desde la
    // extracción local y sembrar como save; el juego carga LO MISMO que cargaría un visitante.
    await page.goto(`${BASE}/?fresh&nointro`);
    await page.waitForFunction(() => !!window.__u5test?.state?.(), null, { timeout: 120000 });
    await page.evaluate(async (id) => {
      const [compone, defs] = await Promise.all([
        import("/src/momentos/compone.js"),
        import("/src/momentos/defs.js"),
      ]);
      const def = defs.momentoPorId(id);
      if (!def) throw new Error(`momento desconocido: ${id}`);
      const [rInit, rGam] = await Promise.all([
        fetch("/assets/initial-state.json"),
        fetch("/assets/init.gam"),
      ]);
      if (!rInit.ok || !rGam.ok) throw new Error("sin extracción local (game/assets)");
      const estado = compone.importaMomento(
        compone.horneaMomento(def, await rInit.json(), new Uint8Array(await rGam.arrayBuffer())),
      );
      localStorage.setItem("u5clone:save:videocap", JSON.stringify(estado));
      localStorage.setItem(
        "u5clone:saves",
        JSON.stringify([{ id: "videocap", name: "videocap", timestamp: Date.now(), turns: 0, locationName: "" }]),
      );
    }, s.momento);
    return { url: "?nointro&save=videocap" };
  }
  if (s.saveEspejo) {
    // Patrón importCheckpoint (espejo-tour/checkpoint.ts): bytes nativos + sidecar por hook.
    const dir = resolve(RAIZ, "game/e2e/espejo-tour/saves");
    const gam = readFileSync(resolve(dir, `${s.saveEspejo}.gam`));
    const sidecar = JSON.parse(readFileSync(resolve(dir, `${s.saveEspejo}.sidecar.json`), "utf8"));
    return {
      trasCarga: async () => {
        await page.evaluate(
          ([bytes, side]) => window.__u5test.loadNativeSave(new Uint8Array(bytes), side),
          [Array.from(gam), sidecar],
        );
      },
    };
  }
  if (s.deeplink) {
    const q = Object.entries(s.deeplink)
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    return { url: `?nointro&fresh&${q}` };
  }
  throw new Error(`siembra desconocida en ${ev.id}`);
}

async function esperaMundo(page) {
  await page.waitForFunction(() => window.__u5test?.worldReady?.(), null, { timeout: 120000 });
  await page.locator("html[data-shell-skin]").waitFor({ timeout: 30000 });
  // dos rAF: que el primer cuadro esté compuesto (patrón partida-graba.mjs:96)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function grabaUno(browser, id, piel) {
  const ev = { id, ...EVENTOS[id] };
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: salidaAbs, size: { width: 1280, height: 800 } },
  });
  // Bajo `U5_VIDEO_TEMPO=cine`: que el port NO apague sus seis pacers calibrados por
  // detectar automatización (ver ../../e2e/tempo-video.mjs). Va en el CONTEXTO y antes
  // del primer goto. Sin la env no instala nada.
  await pacersVivos(ctx);
  const page = await ctx.newPage();
  // ── SIDECAR: el instante 0 del .webm es la creación de la página (Playwright abre el
  //    fichero aquí). Se toma en NODE porque `addInitScript` se reinicia al navegar —
  //    ver la cabecera de `sidecar.mjs`. `armSidecar` va ANTES del primer `goto`.
  const t0Wall = Date.now();
  await armSidecar(page);
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e.message).slice(0, 200)));

  const extra = Object.entries(ev.query || {})
    .map(([k, v]) => (v === true ? k : `${k}=${v}`))
    .join("&");
  const plan = await siembra(page, ev);
  const url = `${BASE}/${plan?.url || "?nointro&fresh"}&skin=${piel}${extra ? `&${extra}` : ""}`;
  await page.goto(url);
  if (plan?.sinMundo) {
    // La intro no monta el mundo: si la piel no sella el <html>, manda el guion.
    await page
      .locator("html[data-shell-skin]")
      .waitFor({ timeout: 15000 })
      .catch(() => {});
  } else {
    await esperaMundo(page);
  }
  if (plan?.trasCarga) {
    await plan.trasCarga();
    await page.waitForTimeout(500);
  }
  if (ev.preparar) await ev.preparar(page, { base: BASE });
  await page.waitForTimeout(ev.calienteMs ?? 1200);

  for (const paso of ev.guion) {
    if (paso.press) {
      await page.locator("body").press(paso.press);
      // El `tras` EXPLÍCITO del guion no se toca: son pausas de escena escritas a mano
      // para que algo concreto se lea («Who needs my aid?», el Sold! y la re-lista…).
      // Lo que el modo cine mueve es la CADENCIA POR DEFECTO entre teclas.
      await page.waitForTimeout(paso.tras ?? ev.cadenciaMs ?? tecla(220));
    } else if (paso.teclea !== undefined) {
      // Texto de prompt (virtud/mantra/keyword): letra a letra por el handler real + Enter,
      // pero POR ESTADO (auditoría 22-08): se ESPERA a que haya un getstring vivo antes de
      // teclear, se deja de teclear si el prompt se resuelve a mitad (p.ej. un espacio que
      // el getstring trata como terminador) y el Enter solo va si el prompt sigue abierto.
      // Sin esto, las teclas que el prompt no consume DERRAMAN al despachador como comandos
      // (los espacios de "in mani corp" → Mix Reagents; los ceros de "100" → Set Active Plr).
      const getstringVivo = () =>
        page.evaluate(() => {
          const t = window.__u5test?.promptType?.() ?? null;
          return t === "text" || t === "number" || t === "rune";
        });
      const limite = Date.now() + (paso.esperaPromptMs ?? 10000);
      while (!(await getstringVivo()) && Date.now() < limite) await page.waitForTimeout(200);
      if (!(await getstringVivo())) {
        // Teclear a ciegas ES el derrame: mejor saltar el paso y que el defecto se vea
        // como texto ausente en el vídeo (y aquí en el log), no como comandos espurios.
        console.warn(`  (teclea "${paso.teclea}" SALTADO: sin getstring vivo en ${ev.id})`);
      } else {
        let abierto = true;
        for (const ch of paso.teclea) {
          await page.locator("body").press(ch);
          await page.waitForTimeout(90);
          abierto = await getstringVivo();
          if (!abierto) break; // el prompt se resolvió: lo que quede derramaría
        }
        if (abierto) await page.locator("body").press("Enter");
      }
      await page.waitForTimeout(paso.tras ?? ev.cadenciaMs ?? tecla(220));
    } else if (paso.pulsaHasta) {
      // Pulsa `tecla` cada `cada` ms HASTA que el predicado (expresión JS evaluada en la
      // página) sea verdad o se agote `max` — el patrón «espera por estado» de
      // tienda/moongate-piedra elevado a paso de guion (auditoría 22-08: las tandas de
      // N teclas fijas que no leen estado son la causa raíz de las colas de >Pass).
      const max = paso.max ?? 40;
      let cumplido = false;
      for (let i = 0; i < max && !cumplido; i++) {
        cumplido = Boolean(await page.evaluate(paso.pulsaHasta));
        if (cumplido) break;
        await page.locator("body").press(paso.tecla ?? " ");
        await page.waitForTimeout(paso.cada ?? 600);
      }
      if (!cumplido) console.warn(`  (pulsaHasta agotó ${max} pulsaciones sin cumplirse en ${ev.id})`);
      if (paso.tras) await page.waitForTimeout(paso.tras);
    } else if (paso.espera) {
      await page.waitForTimeout(paso.espera);
    } else if (paso.esperaFn) {
      await page.waitForFunction(paso.esperaFn, null, { timeout: paso.timeout ?? 60000 });
    } else if (paso.ejecuta) {
      await paso.ejecuta(page);
    } else {
      throw new Error(`paso desconocido en ${id}: ${JSON.stringify(paso)}`);
    }
  }

  // Drenar FX transitorios antes de cortar (que el bracket/inversión no salga decapitado).
  //
  // 🔴 `drenajeMaxMs` (tanda cine 22-08): el drenaje espera a que `fxActive` baje, y hay
  // escenas donde NO baja aunque no se pinte nada. Medido en `shadowlord-shard-faulinei`:
  // última tecla t=13,59 · fila del doom t=13,62 · fin t=25,76 ⇒ **12,1 s** de espera, y
  // la hoja de contacto a 1 fps de esa ventana no enseña NI UN cambio salvo el parpadeo
  // de las antorchas. No es un FX decapitado: es que el ritual del shard NO TIENE FX
  // portado — `core/quest/ritual.ts:170-183` marca «[+ pulsos + SFX]» y «[+ flash +
  // pausa]» como AV Clase C pendiente. Donde eso pase, el evento acota su propio drenaje.
  // El default NO se mueve: los eventos que sí pintan (bracket XOR del Códice, inversión
  // del santuario) siguen con sus 30 s.
  await page
    .waitForFunction(() => !window.__u5test?.fxActive?.(), null, { timeout: ev.drenajeMaxMs ?? 30000 })
    .catch(() => console.warn(`  (fxActive no drenó en ${ev.drenajeMaxMs ?? 30000} ms — corte con FX vivo)`));
  await page.waitForTimeout(ev.colaMs ?? 1500);

  // El sidecar se LEE con la página aún viva (tras `ctx.close()` no hay contexto que
  // interrogar) y se ESCRIBE después, junto al .webm ya renombrado.
  const datos = await readSidecar(page);
  const video = page.video();
  await ctx.close(); // vuelca el webm
  const tmp = await video.path();
  const destino = resolve(salidaAbs, `${id}-${piel}.webm`);
  renameSync(tmp, destino);
  const nRegs = escribeSidecar(`${destino}.log.jsonl`, {
    t0Wall,
    razonFin: "ctx-close",
    meta: { video: `${id}-${piel}.webm`, evento: id, piel, arnes: "eventos", sha: SHA, viewport: "1280x800" },
    datos,
  });
  const kb = Math.round(statSync(destino).size / 1024);
  const rotulo = errores.length ? `⚠️  errores de página: ${errores.join(" | ")}` : "sin errores de página";
  console.log(
    `GRABADO ${id}-${piel}.webm · ${kb} KB · sidecar ${nRegs} regs ` +
      `(${datos.lines.length} filas, ${datos.keys.length} teclas) · ${rotulo}`,
  );
  return { destino, errores };
}

await verificaServer();
console.log(rotulo());
const browser = await chromium.launch();
let conErrores = 0;
for (const id of ids) {
  const pieles = pielArg ? [pielArg] : EVENTOS[id].pieles;
  for (const piel of pieles) {
    console.log(`— ${id} · ${piel}`);
    try {
      const r = await grabaUno(browser, id, piel);
      if (r.errores.length) conErrores++;
    } catch (e) {
      conErrores++;
      console.error(`FALLO ${id}-${piel}: ${String(e && e.message ? e.message : e).slice(0, 300)}`);
    }
  }
}
await browser.close();
process.exit(conErrores ? 1 : 0);
