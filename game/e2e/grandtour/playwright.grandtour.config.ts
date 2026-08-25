/**
 * Config Playwright DEDICADA del Grand Tour (F3).
 *
 * Aislada de la suite E2E principal (`game/playwright.config.ts`, puerto 5199) para
 * poder correr en PARALELO con otras sesiones sin colisionar el dev-server: puerto
 * PROPIO 5219 con `--strictPort` y `reuseExistingServer: false` (arranca su propio
 * vite; nunca reutiliza el de otro worktree, que serviría OTRO código). Sólo recoge
 * los capítulos del tour (`chNN-*.spec.ts`), `workers:1` y encadenados por saves
 * nativos → serial y determinista (spec §2). El barrido completo va FUERA de
 * `verify:all` (nightly/bajo demanda, spec §4); `tour:ch01` corre sólo este capítulo.
 */
import { defineConfig } from "@playwright/test";

// Puerto propio 5219 por defecto; `U5_TOUR_PORT` lo sobreescribe para que CARRILES
// PARALELOS (varios capítulos a la vez) no colisionen en el mismo `--strictPort`.
const PORT = process.env.U5_TOUR_PORT ?? "5219";

// Workers configurable. DEFAULT 1 → RE-SELLADO EN CASCADA serial (comportamiento
// idéntico al histórico): cada capítulo reescribe su `saves/<ch>` en orden, y el
// siguiente lee el sello FRESCO. Con >1 workers el tour corre en PARALELO a nivel de
// FICHERO (cada worker toma capítulos enteros): cada capítulo importa el sello COMMITEADO
// (inmutable) de su predecesor desde disco, sin necesitar que el predecesor CORRA antes
// — la serialización era config, no dependencia real. En ese modo `exportCheckpoint`
// pasa a VERIFY (aserta byte-identidad contra el sello, NO reescribe): ver fixture.ts.
// Por eso el reseal en cascada SÓLO es seguro serial → fórzalo con U5_TOUR_WORKERS=1.
// `fullyParallel:false` mantiene el orden de los tests DENTRO de cada fichero (todos los
// capítulos usan test.describe.serial; el paralelismo es entre ficheros, no dentro).
const WORKERS = Number(process.env.U5_TOUR_WORKERS ?? "1");

// Grabación de vídeo OPT-IN (`U5_TOUR_VIDEO=1`) para revisión humana del tour. El size
// del vídeo IGUALA el viewport (1280×800) → captura 1:1 sin reescalado (el juego es
// pixel-art; cualquier tamaño distinto emborronaría). Sin la env, `video` queda
// `undefined` y la config es IDÉNTICA a la histórica: cero efecto en los gates.
//
// COSTE (verificado en playwright-core 1.61 coreBundle): la grabación es STREAMING A
// DISCO — los frames del screencast CDP se pipean a un ffmpeg hijo (`vp8 -crf 8
// -deadline realtime -speed 8 -b:v 1M -threads 1`) que escribe el .webm incremental.
// Memoria ACOTADA (no es el patrón buffer-de-58min del OOM); el coste real es CPU
// (un ffmpeg por page) y puede alterar TIMING, jamás el digest por sí mismo.
// La pasada-vídeo es SIEMPRE una TERCERA pasada adicional: el sello manda y se corre
// SIN vídeo ×2; el run con vídeo no re-sella (ver tools/tour-video-concat.sh, que
// documenta el comando exacto y el pre-vuelo de riesgo con un capítulo corto).
const VIDEO = process.env.U5_TOUR_VIDEO
  ? { mode: "on" as const, size: { width: 1280, height: 800 } }
  : undefined;

// ─── REQUISITO ABIERTO DEL USUARIO (2026-07-26): EL PERGAMINO FINAL, COMPLETO ────
// «Para futuras grabaciones, falta del final: todo el tema del pergamino final que
//  muestra el texto final después del moongate rojo.»
//
// HOY NO SE CAPTURA, y no es un defecto del port. El texto del pergamino de cierre va
// PACEADO A RELOJ DE PARED, y Playwright deja de grabar cuando el test cierra ⇒ hay una
// CARRERA entre el pacer y el fin del test. El clip de ch17 termina con el marco del
// pergamino dibujado y VACÍO. Dato que lo demuestra: en la pasada del 07-25, CONTENDIDA,
// el test tardaba más y la grabación SÍ alcanzaba a capturar el texto; en frío (07-26) ya
// no llega. O sea: la contención estaba ENMASCARANDO la carrera.
//
// PARCHE ACTUAL (no es la solución): `BROCHE_TRIM_S` en tools/tour-video-presentacion.sh
// recorta esa cola muerta para que el corte de presentación no cierre con un pergamino en
// blanco. Cuando la captura sea completa hay que RECALIBRARLO al final del texto real.
//
// SOLUCIÓN DE FONDO: el ticket #18 (pacers a reloj de pared). Cuando el pacer del endgame
// gane su knob paso-a-paso bajo webdriver, el test podrá CONDUCIR el pergamino hasta el
// final de forma determinista y la grabación lo capturará entero, sin depender de esperas
// de reloj. Este requisito le da a #18 un CRITERIO DE ACEPTACIÓN de producto:
//     «la pasada de vídeo captura el texto final completo tras el moongate rojo».
//
// PROVISIONAL, si hace falta una pasada ANTES de que #18 aterrice: un wait explícito en el
// test SÓLO bajo vídeo — esperar la señal de fin del scroll, o en el peor caso un margen
// generoso condicionado a `U5_TOUR_VIDEO`. Coste: metraje de cola en el corte de archivo,
// que el trim de presentación luego ajusta al último frame con contenido REAL (que entonces
// sería ya el texto completo, no el rescate). Nunca meter esa espera fuera del modo vídeo:
// penalizaría a los gates y a los capítulos que corren pegados a su chapterTimeout.

// Con vídeo activo los artefactos van a un outputDir PROPIO (`.artifacts/video-run`,
// gitignored via `.artifacts/`): (a) los .webm no se mezclan con traces/artefactos
// rancios de pasadas de sello — tour-video-concat.sh puede barrer el dir entero sin
// filtrar; (b) una pasada de sello posterior no borra los vídeos del usuario al
// limpiar test-results. Sin la env el outputDir es EXACTAMENTE el histórico.
const OUTPUT_DIR = VIDEO ? "./.artifacts/video-run" : "./.artifacts/test-results";

export default defineConfig({
  testDir: ".",
  // `ch\d+[a-z]?-` acepta un SUFIJO DE LETRA opcional tras el número (ch16b-, ch14c-…):
  // el patrón histórico `/ch\d+-/` exigía el guion PEGADO al dígito y DEJABA FUERA del
  // barrido a `ch16b-deceit-dead-end.spec.ts` (la «b» se interpone antes del guion) — un
  // capítulo del tour que llevaba sin correr en el sweep completo desde que aterrizó. La
  // letra va ENTRE el número y el guion; los nombres con letra DESPUÉS del guion (p.ej.
  // ch14-deceitb) ya casaban y siguen casando.
  testMatch: /ch\d+[a-z]?-.*\.spec\.ts$/,
  globalSetup: "../global-setup.ts",
  timeout: 60_000,
  retries: 0,
  workers: WORKERS,
  fullyParallel: false,
  outputDir: OUTPUT_DIR,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
    video: VIDEO,
    // TRACE APAGADO EN LA PASADA-VÍDEO — no es higiene, es una guarda medida.
    // `retain-on-failure` GRABA el trace de TODOS los tests y sólo lo descarta al pasar, y el
    // trace lleva captura por acción. Medido en vuelo sobre la pasada-vídeo completa, en UN
    // solo test de los largos (ch30, determinismo ×2 sobre un capítulo de 10,5 min):
    //     16 GB de traces + 1,6 GB de zip   vs   0,2 GB del .webm que sí queremos
    // Dos daños, no uno: (a) DISCO — picos de decenas de GB que compiten con el propio vídeo;
    // (b) TIEMPO — la captura por acción es CPU/IO que se suma justo en los capítulos que ya
    // van pegados a su `chapterTimeout`, y esta pasada perdió ch24 (28,6 min) y ch25 (17,0 min)
    // por timeout. El trace no aporta NADA al entregable de vídeo: si un capítulo falla, lo que
    // se reporta es el hueco y se regraba el capítulo.
    // Sin `U5_TOUR_VIDEO` el comportamiento es EXACTAMENTE el histórico (retain-on-failure).
    trace: VIDEO ? "off" : "retain-on-failure",
    headless: !process.env.PWHEADED,
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
