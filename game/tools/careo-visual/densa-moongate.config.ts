/**
 * Config Playwright del careo DENSO (régimen 2). Gemela de `captura.config.ts` y por la
 * misma razón: 🔴 PUERTO propio en 52xx, obligatorio, SIN default al 5199 del usuario
 * (desde un worktree el 5199 fotografía `main`, no tu rama, y no falla ni avisa).
 *
 * Diferencia con la del régimen ordinario: `reuseExistingServer` SÍ, porque la captura
 * densa se corre varias veces seguidas (base, siembra A, siembra B) contra el MISMO
 * servidor ya censado a mano con `lsof -ti :PUERTO`.
 */
import { defineConfig } from "@playwright/test";

const PORT = process.env.CAREO_PORT ?? "5251";
const ORIGIN = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: ".",
  testMatch: "captura-densa-moongate.pw.ts",
  timeout: 300_000,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: { baseURL: ORIGIN, viewport: { width: 1280, height: 800 }, headless: !process.env.PWHEADED },
});
