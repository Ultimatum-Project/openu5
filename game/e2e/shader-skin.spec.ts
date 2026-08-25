/**
 * PIEL SHADER — cobertura e2e de render y de los KNOBS no-default (auditoría Q7).
 *
 * Antes de este spec una sola prueba montaba `skin=shader` (viewgem-overworld, y solo
 * para el overlay de la gema): regresiones del pipeline xBR/transparencia/skyband y de
 * las VÍAS LEGACY conservadas tras kill-switch (`?fogpremul=off`, `?transp=off`,
 * `?pixelsnap=1`, `?fountainGlass=1`, `?dungpack=off`) solo se detectaban a ojo.
 *
 * Estrategia: smoke por vía — boot al mundo con la piel/knob, y aserciones de RENDER
 * REAL sin depender de píxeles concretos (que son del carril pixel-diff):
 *   · el canvas de SALIDA del shader (`.shader-skin canvas`, contexto 2D) tiene
 *     contenido no uniforme (>N colores) — un pipeline roto deja negro plano;
 *   · el juego RESPONDE (un paso cambia la posición del estado);
 *   · CERO pageerrors (una vía legacy rota revienta en el frame loop).
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoGame, readState } from "./helpers";

/** Nº de colores distintos (cap 12) del canvas dado (contexto 2D legible). */
async function canvasColors(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const canvas = document.querySelector<HTMLCanvasElement>(sel);
    if (!canvas || canvas.width === 0) return 0;
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set<number>();
    for (let i = 0; i < d.length; i += 4) {
      colors.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
      if (colors.size > 12) break;
    }
    return colors.size;
  }, selector);
}

/** Boot en shader con knobs extra + guardas comunes (render vivo, paso, sin errores). */
async function shaderSmoke(page: Page, extra: string[]): Promise<void> {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  // gotoGame antepone skin=faithful; el skin=shader extra gana (el boot lee el último
  // valor del param via URLSearchParams.get? — no: get() da el PRIMERO). Por eso se
  // navega a mano con la URL shader completa, reusando el patrón de gotoGame.
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?" + ["skin=shader", "nointro", "x=60", "y=60", ...extra].join("&"));
  await page.waitForFunction(
    () =>
      (window as unknown as { __u5test?: { worldReady?: () => boolean } }).__u5test?.worldReady?.() === true,
    undefined,
    { timeout: 20_000 },
  );

  // El canvas de salida del shader pinta contenido real (chrome + mundo).
  await expect(page.locator(".shader-skin canvas").first()).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(() => canvasColors(page, ".shader-skin canvas"), { timeout: 15_000 })
    .toBeGreaterThan(4);

  // El juego responde bajo esta vía: un paso al este cambia la posición.
  const x0 = await readState<number>(page, "position.x");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => readState<number>(page, "position.x")).toBe(x0 + 1);

  expect(pageErrors, `pageerrors bajo [${extra.join(",")}]:\n${pageErrors.join("\n")}`).toEqual([]);
}

test("shader default: mundo renderizado por el pipeline xBR y juego vivo", async ({ page }) => {
  await shaderSmoke(page, []);
});

// Vías NO-DEFAULT conservadas tras kill-switch (legacy pendiente de poda / prototipos
// A/B): cada una debe seguir arrancando y pintando hasta que se pode su código.
for (const knob of ["fogpremul=off", "transp=off", "pixelsnap=1", "fountainGlass=1"]) {
  test(`shader con ?${knob}: la vía alternativa arranca, pinta y responde`, async ({ page }) => {
    await shaderSmoke(page, [knob]);
  });
}

test("fiel con ?dungpack=off: la mazmorra cae al placeholder geométrico sin reventar", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  // Deceit: 1 al sur de la entrada (240,73); FALLAX ya pronunciada (patrón dungeon.spec).
  await gotoGame(page, { x: 240, y: 74, hour: 10 }, ["dungpack=off"]);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.game.state.questFlags["word-spoken:33"] = true;
  });
  await page.keyboard.press("ArrowUp"); // pisa la entrada
  await page.keyboard.press("e"); // (E)nter → mazmorra 3D
  const inDungeon = await page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as any).__u5test.game.dungeonState != null,
  );
  expect(inDungeon).toBe(true);

  // La vista 3D del placeholder pinta (el canvas fiel es 2D legible) y girar no revienta.
  await expect
    .poll(() => canvasColors(page, ".faithful-skin canvas"), { timeout: 10_000 })
    .toBeGreaterThan(2);
  await page.keyboard.press("ArrowLeft"); // gira: repinta la perspectiva placeholder
  await page.keyboard.press("ArrowRight");
  expect(pageErrors, `pageerrors en dungpack=off:\n${pageErrors.join("\n")}`).toEqual([]);
});
