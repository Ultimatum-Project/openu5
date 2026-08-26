/**
 * Config Playwright de la BATERÍA DE REGRESIÓN DEL MÉTODO (mitad de escenas).
 * 🔴 PUERTO propio en 52xx, obligatorio, SIN default al 5199 del usuario (REGLA 3): desde
 * un worktree el 5199 fotografía `main`, no tu rama, y no falla ni avisa.
 *
 * `workers: 1` y `mode: "serial"` en el spec: las escenas se comparan ENTRE SÍ (base vs
 * base2 vs siembra), así que tienen que salir del MISMO servidor y del mismo árbol.
 */
import { defineConfig } from "@playwright/test";

const PORT = process.env.CAREO_PORT ?? "5247";
const ORIGIN = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: ".",
  testMatch: "regresion-metodo.pw.ts",
  timeout: 120_000,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: { baseURL: ORIGIN, viewport: { width: 1280, height: 800 }, headless: !process.env.PWHEADED },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: ORIGIN,
    reuseExistingServer: false,
    timeout: 60_000,
    cwd: process.cwd(),
  },
});
