/**
 * Config Playwright STANDALONE de la captura del port (arnés píxel-diff, task #26).
 *
 * Aislada de la suite e2e normal: `npm run e2e` usa game/playwright.config.ts
 * (testDir ./e2e) y NO ve este spec. Se corre a mano:
 *
 *     npx playwright test -c tools/pixeldiff/capture.config.ts
 *
 * Las PNG salen a PIXELDIFF_OUT (por defecto bajo original/, gitignored).
 *
 * 🔴 PUERTO: por defecto 5199 con `reuseExistingServer`, que es lo que había — pero
 * ESE puerto es el del dev-server del USUARIO, y sirve el CHECKOUT PRINCIPAL. Correr
 * esta captura desde un worktree con el default reutiliza ese servidor y fotografía
 * `main`, no tu rama: las capturas salen, el arnés da veredictos, y lo medido es el
 * árbol de otro. No falla, no avisa, y el resultado se lee como propio. Desde un
 * worktree hay que dar `PIXELDIFF_PORT` en el rango 52xx (REGLA 3 del CLAUDE.md), que
 * levanta un vite propio sobre TU árbol:
 *
 *     PIXELDIFF_PORT=5241 npx playwright test -c tools/pixeldiff/capture.config.ts
 */
import { defineConfig } from "@playwright/test";

const PORT = process.env.PIXELDIFF_PORT ?? "5199";
const ORIGIN = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: ".",
  // .pw.ts (no *.spec.ts) para que el glob de vitest NO lo recoja (rompería la
  // suite unit compartida: vitest no entiende el test.describe de Playwright).
  testMatch: "capture-port.pw.ts",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: ORIGIN,
    viewport: { width: 1280, height: 800 },
    headless: !process.env.PWHEADED,
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: ORIGIN,
    // Con puerto propio NO se reutiliza: reutilizar en el 52xx de otro carril sería la
    // misma avería que reutilizar el 5199 del usuario, un árbol más cerca.
    reuseExistingServer: PORT === "5199",
    timeout: 30_000,
    cwd: process.cwd(),
  },
});
