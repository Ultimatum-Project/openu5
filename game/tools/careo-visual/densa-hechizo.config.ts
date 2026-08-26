/**
 * Config Playwright del careo DENSO de la ceremonia de conjuro. Gemela de
 * `densa.config.ts` y `densa-moongate.config.ts`, y por la misma razón:
 * 🔴 PUERTO propio en 52xx, obligatorio, SIN default al 5199 del usuario.
 *
 * `reuseExistingServer` SÍ: la captura se corre varias veces seguidas (una por
 * ceremonia y por siembra) contra el MISMO servidor ya censado con `lsof -ti :PUERTO`
 * y cuya IDENTIDAD se verificó por el `<title>` de la respuesta.
 */
import { defineConfig } from "@playwright/test";

const PORT = process.env.CAREO_PORT ?? "5261";
const ORIGIN = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: ".",
  testMatch: "captura-densa-hechizo.pw.ts",
  timeout: 300_000,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: { baseURL: ORIGIN, viewport: { width: 1280, height: 800 }, headless: !process.env.PWHEADED },
});
