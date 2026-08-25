import { defineConfig } from "@playwright/test";

// WALKTHROUGH-ESPEJO — config dedicada. Puerto PROPIO 5246 (≠5199 usuario, ≠5197 e2e,
// ≠5219 grandtour); U5_E2E_PORT lo sobreescribe (y habilita reuse, como la suite e2e).
// La cadena es SERIAL por construcción (checkpoints encadenados) → 1 worker.
const EXPLICIT_PORT = process.env.U5_E2E_PORT;
const PORT = EXPLICIT_PORT ?? "5246";
const HOST = `http://localhost:${PORT}`;

// Grabación de vídeo OPT-IN (`U5_ESPEJO_VIDEO=1`) — MISMO patrón y misma justificación que
// la pasada-vídeo del Grand Tour (`e2e/grandtour/playwright.grandtour.config.ts`): el size
// IGUALA el viewport (1280×800) para captura 1:1 sin reescalado (pixel-art), la grabación
// es STREAMING a disco vía un ffmpeg hijo por page (memoria acotada; el coste es CPU) y sin
// la env la config queda BYTE-IDÉNTICA a la histórica ⇒ cero efecto sobre los runs de medida.
//
// POR QUÉ IMPORTA AQUÍ: el espejo es una comparación INSTRUMENTADA (diff de log OCR-vs-port)
// que nunca produjo material visible. El vídeo es para que el usuario VEA el replay; la
// CONFORMIDAD sigue midiéndose en las pasadas sin vídeo (un run con vídeo no adjudica nada,
// igual que la pasada-vídeo del tour no sella).
const VIDEO = process.env.U5_ESPEJO_VIDEO
  ? { mode: "on" as const, size: { width: 1280, height: 800 } }
  : undefined;

// Con vídeo activo los artefactos van a un outputDir PROPIO (`e2e/espejo-tour/.artifacts/
// video-run`, gitignored) para que (a) los .webm no se mezclen con traces rancios y (b) una
// pasada de medición posterior no borre los vídeos al limpiar test-results. Sin la env el
// outputDir es EXACTAMENTE el histórico (default de Playwright).
//
// SUBDIR POR INVOCACIÓN — imprescindible con `tools/run-per-part.sh`, que corre cada parte
// como una invocación SEPARADA de playwright (aislamiento de timeout: un fallo no salta el
// resto, a diferencia del describe.serial). Playwright LIMPIA su outputDir al arrancar, así
// que un dir único para todas las partes haría que cada invocación BORRASE los vídeos de las
// anteriores y sólo sobreviviese la última — el mismo sapo que ESPEJO_OUT resuelve para los
// reports. La clave sale de `U5_ESPEJO_PARTS` (la parte que corre esa invocación) y cae a
// `all` cuando se corre la cadena entera de una vez. El concat barre el PADRE en recursivo.
const RUN_KEY = (process.env.U5_ESPEJO_PARTS ?? "all").replace(/[^A-Za-z0-9._-]+/g, "_");
const OUTPUT_DIR = VIDEO ? `./e2e/espejo-tour/.artifacts/video-run/${RUN_KEY}` : undefined;

export default defineConfig({
  testDir: "./e2e/espejo-tour",
  testMatch: /espejo-tour\.spec\.ts/,
  globalSetup: "./e2e/global-setup.ts",
  timeout: 45 * 60_000, // combate lento (item-by-item del cofre-fiel); part02/06 pasan de 32m
  retries: 0,
  workers: 1,
  ...(OUTPUT_DIR ? { outputDir: OUTPUT_DIR } : {}),
  use: {
    baseURL: HOST,
    viewport: { width: 1280, height: 800 },
    video: VIDEO,
    // TRACE APAGADO EN LA PASADA-VÍDEO — misma guarda medida que en la config del Grand Tour:
    // `retain-on-failure` graba el trace de TODOS los tests (captura por acción) y sólo lo tira
    // al pasar. En un solo capítulo largo del tour eso fueron 16 GB de traces frente a 0,2 GB
    // del .webm que sí queremos, y la captura por acción es CPU/IO que empuja a timeout justo a
    // los tests largos — y los del espejo lo son (timeout de 45 min por parte). Sin
    // `U5_ESPEJO_VIDEO` el comportamiento es EXACTAMENTE el histórico.
    trace: VIDEO ? "off" : "retain-on-failure",
    headless: !process.env.PWHEADED,
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: HOST,
    reuseExistingServer: EXPLICIT_PORT !== undefined,
    timeout: 30_000,
  },
});
