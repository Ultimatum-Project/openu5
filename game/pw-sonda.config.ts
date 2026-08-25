/**
 * Config del INSTRUMENTO de careo de la PUERTA #D1 (`src/core/npc/carga-fiel.ts`).
 * Sujeto: `e2e/espejo-tour/tools/sonda-puerta-d1.spec.ts`.
 *
 * 🔴 La sonda vive bajo `e2e/espejo-tour/` A PROPÓSITO: `playwright.config.ts` tiene
 * `testDir: ./e2e` y sólo ignora `**‍/espejo-tour/**`, así que en cualquier otro sitio se
 * colaría en la población de la suite e2e general — un spec suelto mueve el denominador de
 * quien no lo escribió. Ahí queda fuera de las cuatro configs del repo y sólo lo alcanza ésta.
 *
 * `reuseExistingServer` va a TRUE para poder apuntar a un vite YA arrancado con la env de la
 * puerta horneada (que es como se carean los brazos): la puerta se fija al ARRANCAR el vite,
 * no al lanzar playwright.
 *
 *   U5_E2E_PORT=5281 U5_ESPERADO=abierta U5_SONDA_SAVES=<dir> U5_SONDA_PART=part07 \
 *     npx playwright test -c pw-sonda.config.ts --reporter=line
 */
import { defineConfig } from "@playwright/test";
const PORT = Number(process.env.U5_E2E_PORT ?? 5271);
export default defineConfig({
  testDir: "./e2e/espejo-tour/tools",
  testMatch: /sonda-puerta-d1\.spec\.ts/,
  timeout: 120_000,
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
