import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium, type FullConfig } from "@playwright/test";
import { bootPlan } from "./grandtour/bootPlan";

/**
 * Setup global de AMBAS suites (e2e principal y Grand Tour).
 *
 * 1. PROBE de assets: falla temprano si faltan los datos extraídos del juego.
 *
 * 2. WARM-UP del optimizador de Vite (task tour-parallel). El dev-server que arranca la
 *    suite es un PROCESO FRESCO: su optimizador de deps hace un SCAN/optimize la PRIMERA
 *    vez que una página pide módulos, y hasta que ese scan asienta el `browserHash` puede
 *    responder a peticiones concurrentes con hashes distintos → Vite fuerza un `full-reload`
 *    del cliente. En SERIAL (1 worker) casi nunca se ve; en PARALELO (N workers × page.goto
 *    simultáneos, U5_TOUR_WORKERS>1) la estampida de primeras cargas dispara ese reload A
 *    MITAD de capítulo → "Execution context was destroyed, most likely because of a
 *    navigation" y el hook `window.__u5test` se pierde → "Cannot read properties of undefined
 *    (reading 'state')". La caché en disco (node_modules/.vite) NO lo evita: la carrera es
 *    POR-PROCESO, no por-disco. Como el bundle NO tiene imports dinámicos (todo se importa
 *    estático), UNA sola carga completa hace que el optimizador descubra TODO y asiente; tras
 *    ella, las N cargas de los workers reusan deps estables → sin reload. Esperamos a
 *    `networkidle` (absorbe cualquier reload que ocurra DURANTE el propio warm-up).
 *
 *    RUTA POR IDIOMA (task tour-ES). El warm-up debe calentar la MISMA URL que los workers
 *    cargan, no un `/` genérico: la ruta del tour es `?skin=…&nointro[&lang=es]` (bootPlan), y
 *    su rama de RENDER en español ejercita el choke i18n (`t()` sobre la tabla `es.json` +
 *    re-wrap) que la carga del INTRO en inglés (`/` a secas) NO toca. Si esa rama es queda
 *    FRÍA, la primera carga es de cada worker vuelve a disparar la re-optimización → la MISMA
 *    estampida, resucitada por los módulos del idioma. Por eso, cuando `U5_TOUR_LANG=es`,
 *    calentamos AMBAS rutas del tour (en Y es), replicando la URL EXACTA de `bootPlan` para no
 *    dejar ningún módulo de ninguna rama sin descubrir. En modo en (default) el comportamiento
 *    es el histórico: una sola carga del baseURL.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const probe = join(here, "..", "assets", "initial-state.json");
  if (!existsSync(probe)) {
    throw new Error(`Faltan los assets del juego (${probe}). Ejecuta: npm run extract`);
  }

  guardaDeProcedencia(here);

  // baseURL RESUELTO de la suite que corre (5197 e2e / 5219 tour / lo que fije el env).
  // El webServer de Playwright arranca ANTES que globalSetup, así que ya es alcanzable.
  const baseURL = config.projects[0]?.use?.baseURL;
  if (!baseURL) return;

  // URLs a calentar (secuencial, cada una hasta `networkidle`). Siempre el baseURL bare (suite
  // e2e principal + comportamiento histórico). En modo es, además las dos rutas del tour con la
  // URL EXACTA de bootPlan: la en (mundo montado sin traducción) y la es (rama de render i18n).
  const warmUrls = [baseURL];
  if (process.env.U5_TOUR_LANG?.toLowerCase() === "es") {
    const skinEnv = process.env.U5_TOUR_SKIN;
    for (const lang of ["en", "es"] as const) {
      warmUrls.push(new URL(bootPlan(undefined, skinEnv, lang).url, baseURL).href);
    }
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const url of warmUrls) {
      await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    }
  } finally {
    await browser.close();
  }
}

/**
 * 🔴 GUARDA DE PROCEDENCIA DEL PUERTO — que la suite no mida el árbol de OTRO carril.
 *
 * EL CASO REAL (02-08, carril `defaults-movil`). Las tres configs traen
 * `reuseExistingServer: EXPLICIT_PORT !== undefined`: **pasar `U5_E2E_PORT` ACTIVA el
 * reuse**. O sea que la propia acción de aislarte —fijar tu puerto para no pisar a nadie—
 * es la que te expone. Si otro carril ya escucha ahí, Playwright NO arranca tu vite: reusa
 * el suyo y toda tu suite mide SU worktree. Pasó: se corrieron rama y baseline en 5241 y
 * 5242 y las dos midieron `portrait-pulido`. **Cero errores en pantalla y cifras
 * plausibles** — el peor modo de fallo que hay.
 *
 * Lo que lo destapó fue que el cacheDir `game/.vite-mobile-e2e` NO existía en el worktree
 * (lo crea el vite que sirve, `vite.config.ts:127`): un testigo POSITIVO de procedencia.
 * Esta guarda hace lo mismo pero ANTES y sola: si el puerto está ocupado, mira el `cwd`
 * del proceso que escucha y ABORTA si no cuelga de ESTE árbol.
 *
 * Falla RUIDOSAMENTE (lanza), no con un aviso: un aviso en un log de 3 000 líneas es lo
 * mismo que no avisar. Si `lsof` no está (CI no-mac), no puede verificar y lo DICE — pero
 * no bloquea, porque ahí el escenario multi-carril no existe.
 */
function guardaDeProcedencia(here: string): void {
  const puerto = process.env.U5_E2E_PORT;
  if (!puerto) return; // sin puerto explícito no hay reuse: Playwright arranca el suyo.
  const raiz = resolve(here, "..", ".."); // …/<worktree>/  (here = <worktree>/game/e2e)

  let pids = "";
  try {
    pids = execFileSync("lsof", ["-ti", `tcp:${puerto}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (err) {
    // lsof devuelve exit 1 cuando NO hay nada escuchando: ése es el caso BUENO.
    const code = (err as { status?: number }).status;
    if (code === 1) return;
    console.warn(
      `[guarda-de-procedencia] no pude comprobar el puerto ${puerto} (¿sin lsof?). ` +
        `Verifica A MANO que ${raiz}/game/.vite-mobile-e2e se crea en ESTA corrida.`,
    );
    return;
  }
  if (!pids) return;

  for (const pid of pids.split("\n").filter(Boolean)) {
    let cwd = "";
    try {
      const out = execFileSync("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      cwd = out.split("\n").find((l) => l.startsWith("n"))?.slice(1) ?? "";
    } catch {
      continue; // proceso ajeno que no podemos inspeccionar: no adjudicamos.
    }
    if (cwd && !resolve(cwd).startsWith(raiz)) {
      throw new Error(
        `\n🔴 PUERTO ${puerto} OCUPADO POR OTRO ÁRBOL — la suite mediría código ajeno.\n` +
          `   escucha el pid ${pid}, con cwd:\n     ${cwd}\n` +
          `   y esta suite es de:\n     ${raiz}\n\n` +
          `   Con U5_E2E_PORT puesto, \`reuseExistingServer\` está ACTIVO: Playwright habría\n` +
          `   reusado ese servidor y las cifras habrían salido plausibles y FALSAS.\n` +
          `   Arregla con un puerto tuyo (U5_E2E_PORT=<libre>). NO mates el proceso ajeno.\n`,
      );
    }
  }
}
