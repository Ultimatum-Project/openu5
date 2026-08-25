import { defineConfig } from "@playwright/test";

// Puerto del dev-server de la suite E2E. Default 5197 — un puerto PROPIO de e2e,
// DISTINTO del dev-server del usuario (5199) y del grandtour (5219). Así una corrida
// e2e (desde un worktree o donde sea) arranca SU PROPIO server y NUNCA pega al server
// vivo del usuario: la trampa era `reuseExistingServer:true` + default 5199, que hacía
// que cualquier `npm run e2e` reutilizara el 5199 del usuario y testeara el código
// EQUIVOCADO. `U5_E2E_PORT` lo sobreescribe (y habilita el reuse, ver abajo).
const EXPLICIT_PORT = process.env.U5_E2E_PORT;
const PORT = EXPLICIT_PORT ?? "5197";
const HOST = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // SUITES CON CONFIG PROPIA — se excluyen de la suite dev. Todas comparten la misma
  // razón: correrlas AQUÍ las hace fallar (o pasar) por razones equivocadas, porque el
  // arnés que las hace significar algo vive en SU config, no en ésta.
  //
  // · e2e/prod/       → playwright.prod.config.ts, contra `vite preview`. Contra el
  //   dev-server pasaría por razones equivocadas (hooks DEV presentes).
  // · e2e/grandtour/ch*  → e2e/grandtour/playwright.grandtour.config.ts (puerto 5219). Son
  //   116 tests de CAPÍTULOS encadenados que EXPORTAN los checkpoints `.gam` SELLADOS de
  //   saves/ (ficheros TRACKED): correrlos desde aquí es reescribir el resello 46/46
  //   fuera de su ventana. Además dominan el reloj de la suite dev sin aportarle nada.
  //   ★ El patrón excluye `ch*.spec.ts`, NO el directorio entero. Cuando era
  //   `**/grandtour/**` (d9e5e7b3, 07-25) se llevó por delante a los DOS specs de esa
  //   carpeta que NO son capítulos — `shops-console` y `talk-console` — y los dejó sin
  //   runner NINGUNO: la config del tour solo casa `/ch\d+[a-z]?-/`, así que ni ella los
  //   recogía. Quedaron escritos y muertos (auditoría de cierre 27-07, §completeness-critic).
  //   No fue exclusión deliberada: la razón declarada de d9e5e7b3/8b4251e0 habla solo de
  //   capítulos, checkpoints y reloj, y esos dos no encadenan nada (bootWorld + enterLocation
  //   frescos, sin importCheckpoint ni exportCheckpoint). Viven en grandtour/ por los HELPERS
  //   de `nav.ts`, no por el runner. Tampoco se les renombra a `chNN-`: eso los metería en la
  //   cascada de re-sellado serial del tour, donde NO pintan nada.
  // · e2e/espejo-tour/ → playwright.espejo.config.ts (puerto 5246). Es un arnés de
  //   CONFORMIDAD (replay contra los let's-play), no un test de regresión: su umbral por
  //   defecto es 0.5 y la conformidad MEDIDA y documentada del corpus va de 4.7% a 25.6%
  //   (README §RELEVO-3b / §RESULTADO 3b-3c) — se corre con `U5_ESPEJO_SOFT=1`, que
  //   reporta sin asertar. Sin esa palanca falla SIEMPRE, por instrumento. También
  //   exporta checkpoints propios a saves/.
  // · e2e/mobile/     → playwright.mobile.config.ts. Sus proyectos declaran EMULACIÓN DE
  //   DISPOSITIVO (`isMobile: true`, `hasTouch: true`, viewports de iPhone/Android), y con
  //   `hasTouch` Chromium reporta `(pointer: coarse)` — que es lo que hace que el deck
  //   táctil se monte. Bajo ESTA config (1280×800, pointer:fine) el deck NO se monta, y
  //   hace bien: 56 de sus tests fallaban con «el deck táctil debe montarse en móvil»,
  //   comprobando una condición que el arnés de escritorio no puede cumplir.
  //
  // Por qué esto no se había visto: los tres directorios entraron cuando la suite dev
  // llevaba desde el 2026-07-22 sin poder ni listarse (el JSON sin `with { type: "json" }`
  // de core/world/commands.ts, arreglado en ad05dc0b) — espejo-tour nació el MISMO 07-22
  // (12af756f), así que nunca llegó a ejecutarse bajo esta config.
  //
  // ⚠ PENDIENTE-VALIDACIÓN-VENTANA (carril sellos, 27-07): shops-console y talk-console
  // vuelven a la suite dev SIN haber podido correrlos (HOLD de flota = cero playwright).
  // Su último verde documentado es del 2026-07-17, el día que nacieron (a36b11e4 y
  // b78cd604 los citan en sus gates). Si en la primera ventana salen rojos, el rojo es
  // DIEZ DÍAS DE DERIVA acumulada sin vigilancia, no una regresión fresca: se adjudica
  // contra el binario como cualquier otro, y NO se silencia volviendo a excluirlos.
  testIgnore: [
    "**/prod/**",
    "**/grandtour/ch*.spec.ts",
    "**/espejo-tour/**",
    "**/mobile/**",
  ],
  globalSetup: "./e2e/global-setup.ts",
  timeout: 30_000,
  // ★ #168 — POLÍTICA DE ESPERA, declarada. Hasta aquí NO EXISTÍA: censo de la suite = **169
  // `expect.poll`, de los que 119 corrían con el default IMPLÍCITO de Playwright (5 s)** y sólo
  // 50 declaraban ventana propia, ad hoc y sin criterio común. El `timeout: 30_000` de arriba
  // es el presupuesto del TEST, no el de la aserción: son cosas distintas y nadie había fijado
  // la segunda.
  //
  // POR QUÉ SUBE (#136, medido): con la máquina saturada —6 quemadores de CPU— un poll que
  // espera a que un paso aterrice (`position.x`) no llega en 5 s y el test cae con el valor
  // viejo. No es la mecánica: es la ventana calibrada para máquina ociosa. Subir el suelo
  // arregla los 119 de una vez, sin tocar un solo call-site; los 50 explícitos MANDAN sobre
  // éste (el valor por aserción gana), así que las calibraciones deliberadas se respetan.
  //
  // ★ POR QUÉ 15 s Y NO MÁS — es una COTA DERIVADA, no gusto: debe quedar HOLGADAMENTE por
  // debajo del `timeout` del test (30 s). Si la ventana de aserción se acerca al presupuesto
  // del test, una aserción que falla de verdad deja de reportarse como aserción y se convierte
  // en un timeout de test — se pierde el mensaje («Expected X, Received Y») y con él el
  // diagnóstico. 15 s = 3× el default, la mitad del presupuesto del test.
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1, // los specs comparten localStorage/dev-server; serial simplifica
  use: {
    baseURL: HOST,
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    // Headless por defecto. Para VER los browsers: PWHEADED=1 npx playwright test
    headless: !process.env.PWHEADED,
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: HOST,
    // Reutiliza un server YA vivo sólo si el usuario fijó `U5_E2E_PORT` explícito
    // (opta por reusar el suyo, p.ej. U5_E2E_PORT=5199 para atacar su dev). Por
    // defecto (5197) arranca uno propio con --strictPort y NO reutiliza nada — evita
    // el falso-verde de testear contra otro server. (Igual que el grandtour, 5219.)
    reuseExistingServer: EXPLICIT_PORT !== undefined,
    timeout: 30_000,
  },
});
