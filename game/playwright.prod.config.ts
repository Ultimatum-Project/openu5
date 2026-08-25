import { defineConfig } from "@playwright/test";

// Config del SMOKE DE PRODUCCIÓN (auditoría de calidad Q3): corre e2e/prod/ contra
// `vite preview` sirviendo dist/ — el BUILD REAL, sin dev-server, sin hooks
// `__u5test`, sin deep-links `?x&y` ni `?nointro` (todos gated a import.meta.env.DEV).
// Complementa a tools/preview-smoke.mjs (que solo hace fetch de rutas): aquí un
// NAVEGADOR arranca el juego de verdad y llega al mundo renderizado — la clase de
// regresión solo-prod (tree-shaking, assets fuera de dist/, rutas) que ya mordió
// (prod-preview-boot) y que era invisible a los ~50 specs de dev.
//
// Uso: `npm run e2e:prod` (hace `npm run build` primero — dist/ debe existir).
// Puerto PROPIO 5218 (no 5197 e2e dev, no 5199 usuario, no 5219 tour);
// `U5_PROD_PORT` lo sobreescribe.
const PORT = process.env.U5_PROD_PORT ?? "5218";
const HOST = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e/prod",
  timeout: 120_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: HOST,
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    headless: !process.env.PWHEADED,
  },
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: HOST,
    reuseExistingServer: false, // siempre SU preview propio: jamás otro server
    timeout: 30_000,
  },
});
