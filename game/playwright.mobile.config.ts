import { defineConfig, type ViewportSize } from "@playwright/test";

/**
 * Suite E2E MÓVIL (carril mobile-e2e) — verificación FUNCIONAL exhaustiva de la
 * versión phone: deck táctil (ui/touch.ts), tap-para-ir (ui/autowalk.ts vía intent
 * tap-tile), intro táctil (faithful-intro.ts), layout portrait/landscape y pieles.
 *
 * EMULACIÓN REAL de dispositivo: `isMobile` + `hasTouch` + DPR del hardware. Con
 * `hasTouch` Chromium reporta `(pointer: coarse)` → el deck se muestra por su
 * DETECCIÓN DE PRODUCCIÓN (touch.ts:291), sin `?touch=1`: si la detección se
 * rompe, la suite lo ve. Los taps de Playwright generan `pointerdown` reales —
 * el mismo evento que escuchan todos los botones del deck.
 *
 * Puerto PROPIO (5196): distinto del dev del usuario (5199), del e2e general
 * (5197) y del grandtour (5219). `U5_E2E_PORT` lo sobreescribe (y habilita el
 * reuse), mismo contrato que playwright.config.ts.
 *
 * Dos clases de dispositivo (iPhone-ish 390×844 @3x y Android-ish 412×915 @2.625).
 * La ROTACIÓN se ejercita EN CALIENTE dentro de las specs (setViewportSize), no como
 * proyectos aparte.
 *
 * 🔴 AQUÍ DECÍA «el arnés entero es Chromium, y WebKit no soporta la emulación táctil
 * de CDP», Y ESA FRASE CERRÓ UN HUECO EN FALSO DURANTE MESES. Es literalmente cierta
 * y la conclusión que se sacaba de ella es FALSA: CDP es el protocolo de Chromium, así
 * que WebKit no lo usa — pero Playwright conduce WebKit por su protocolo propio, y ahí
 * la emulación táctil funciona entera. Medido el 2026-08-11 con Playwright 1.61.1 y
 * WebKit 26.5, misma sonda contra los dos motores, `<meta viewport>` incluido:
 *
 *              (pointer:coarse)   devicePixelRatio   page.tap()          maxTouchPoints
 *   WebKit          true             3 (el pedido)    pointerdown+touchstart+click   0
 *   Chromium        true             3 (el pedido)    pointerdown+touchstart+click   1
 *
 * ⇒ La detección de PRODUCCIÓN del deck —`(pointer: coarse)`, diez sitios del port—
 * se dispara igual en los dos, y los taps entregan los mismos eventos. La ÚNICA
 * diferencia medida es `maxTouchPoints` (0 en WebKit, 1 en Chromium, 5 en un iPhone
 * real), y el port **no lo lee en ningún sitio**: `grep -rn maxTouchPoints src/` = 0.
 * Por eso el proyecto `iphone-webkit` de abajo puede existir.
 *
 * ★★ El mecanismo nombrado en la frase vieja no existía (CDP), y de su inexistencia se
 * dedujo una propiedad que tampoco existía. Cuando una nota justifica una AUSENCIA de
 * cobertura, el mecanismo que cita se comprueba antes de heredar la ausencia.
 */

const EXPLICIT_PORT = process.env.U5_E2E_PORT;
const PORT = EXPLICIT_PORT ?? "5196";
const HOST = `http://localhost:${PORT}`;

const IPHONE: ViewportSize = { width: 390, height: 844 };
const ANDROID: ViewportSize = { width: 412, height: 915 };
/**
 * APAISADO DE FÁBRICA (auditoría UI/UX móvil 2026-07-25, ítem de los gates). El gate de
 * geometría corría SÓLO en vertical y rotaba desde dentro, así que el apaisado se medía
 * siempre con el viewport ÍNTEGRO (844×390) — que en un iPhone real no existe: Safari se
 * queda la barra compacta y deja ~340 px, y el SE rotado con barra, 320. Ese apaisado
 * CORTO es el que reventaba (fila Space/⏎/Esc cortada bajo un root `overflow-y:hidden`).
 * Dos proyectos lo declaran como dispositivo, para que TODO el gate de normas se mida
 * ahí y no sólo el par de tests que se fijan su propio viewport.
 */
const IPHONE_LANDSCAPE: ViewportSize = { width: 844, height: 340 };
const SE_LANDSCAPE: ViewportSize = { width: 568, height: 320 };

const SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

/**
 * Los proyectos apaisados corren SÓLO el gate de NORMAS (geometría/objetivos/recortes),
 * no la suite funcional entera: los flujos largos (intro completa, combate por taps) ya
 * están cubiertos en los dos dispositivos verticales y multiplicarlos ×2 pagaría media
 * hora de arnés por cero información nueva.
 */
const NORM_SPECS = /mobile-geometry\.spec\.ts/;

export default defineConfig({
  testDir: "./e2e/mobile",
  globalSetup: "./e2e/global-setup.ts",
  // Flujos táctiles largos (intro completa por taps, combate entero): margen sobre
  // los 30s de la suite de escritorio. Los tests pesados suben su propio timeout.
  timeout: 60_000,
  retries: 0,
  workers: 1, // los specs comparten localStorage/dev-server; serial simplifica
  use: {
    baseURL: HOST,
    trace: "retain-on-failure",
    // Evidencia para el reporte de tickets (fase B): screenshot de todo fallo.
    screenshot: "only-on-failure",
    headless: !process.env.PWHEADED,
  },
  projects: [
    {
      name: "iphone",
      use: {
        viewport: IPHONE,
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: SAFARI_UA,
      },
    },
    {
      /**
       * ★ LA SEGUNDA PASADA: los mismos INVARIANTES contra el LAYOUT PARTIDO — que es el
       * que ve por defecto, desde el 02-08, cualquiera que entre desde un móvil.
       *
       * El canal es el NOMBRE del proyecto (sufijo `-partido`, ver `deck.ts:layoutAmbiente`):
       * Playwright no deja fijar env por proyecto, así que sin esto haría falta invocar la
       * suite dos veces y el CI cubriría un solo layout.
       *
       * Corren SÓLO los 42 tests que declaran `"invariante"` — suelo de 44 px, contención,
       * no-solape, sin scroll horizontal, nombre accesible, estado de juego. Los 9 que fijan
       * una COMPOSICIÓN concreta se saltan solos (`soloEnLayout`): duplicarlos no daría
       * cobertura, daría un rojo por medir otra cosa.
       */
      name: "iphone-partido",
      use: {
        viewport: IPHONE,
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: SAFARI_UA,
      },
    },
    {
      /**
       * ★ EL SEGUNDO MOTOR — el que cierra el punto ciego del Safari real (#177, hueco 4
       * de /verificacion). Mismo dispositivo, mismas specs, mismo UA que el proyecto
       * `iphone`: la ÚNICA variable es el motor. Así un rojo que salga aquí y no allí es
       * atribuible a WebKit y a nada más, que es lo que hace útil la comparación.
       *
       * 🔴 QUÉ CUBRE Y QUÉ NO, para que nadie lea de más en su verde. El WebKit que
       * conduce Playwright es una construcción de WebKit, no Safari: comparte el motor de
       * render y de JS con Safari, no su interfaz ni sus políticas. Lo que este proyecto
       * ve son los defectos de MOTOR (CSS que Blink perdona y WebKit no, APIs ausentes,
       * diferencias de layout). Lo que NO ve, y sigue sin red:
       *   · la barra de Safari en iOS que come alto y cambia con el scroll (los proyectos
       *     apaisados de arriba la aproximan con viewport, no la reproducen),
       *   · las políticas de gesto de usuario de iOS para audio y pantalla completa,
       *   · `maxTouchPoints` (0 aquí, 5 en un iPhone de verdad) — hoy sin lectores.
       * Eso es hueco declarado en la tarjeta, no cobertura silenciosa.
       */
      name: "iphone-webkit",
      use: {
        browserName: "webkit",
        viewport: IPHONE,
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: SAFARI_UA,
      },
    },
    {
      name: "android",
      use: {
        viewport: ANDROID,
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      },
    },
    {
      // iPhone 15 apaisado con la barra compacta de Safari (el apaisado REAL).
      name: "iphone-landscape-safari",
      testMatch: NORM_SPECS,
      use: {
        viewport: IPHONE_LANDSCAPE,
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: SAFARI_UA,
      },
    },
    {
      // iPhone SE rotado: el presupuesto vertical más apretado que se sirve (320 px).
      name: "se-landscape",
      testMatch: NORM_SPECS,
      use: {
        viewport: SE_LANDSCAPE,
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: SAFARI_UA,
      },
    },
  ],
  webServer: {
    // cacheDir PROPIO (lección vite-cachedir-worktree): en un worktree, node_modules
    // es un symlink al checkout principal → el .vite default sería la MISMA caché que
    // usa el dev-server del usuario (5199). U5_VITE_CACHE_DIR (vite.config.ts:101)
    // la aparta a un dir local del worktree.
    command: `U5_VITE_CACHE_DIR=.vite-mobile-e2e npx vite --port ${PORT} --strictPort`,
    url: HOST,
    reuseExistingServer: EXPLICIT_PORT !== undefined,
    timeout: 30_000,
  },
});
