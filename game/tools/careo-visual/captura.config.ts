/**
 * Config Playwright STANDALONE del careo visual. Aislada de `npm run e2e`.
 * 🔴 PUERTO: obligatorio propio en 52xx (REGLA 3). El default de otros arneses es el
 * 5199 del USUARIO, que sirve el checkout PRINCIPAL: desde un worktree eso fotografia
 * `main` y no tu rama, sin fallar ni avisar. Aqui NO hay default a 5199.
 */
import { defineConfig } from "@playwright/test";

const PORT = process.env.CAREO_PORT ?? "5243";
const ORIGIN = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: ".",
  testMatch: "captura-port.pw.ts",
  timeout: 180_000,
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
