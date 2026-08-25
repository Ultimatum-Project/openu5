/**
 * E2E — (V)iew a gem en OVERWORLD con la PIEL FIEL (task #76). Conduce el comando
 * DESDE EL TECLADO y verifica que la vista aérea 32×32 se pinta EN EL VIEWPORT del
 * canvas fiel (gem_view LOOKOBJ 0x10fc), NO en el overlay DOM `.viewgem-panel`.
 *
 * El render fiel es una rejilla EGA por categoría de tile en el viewport (hierba
 * verde, agua azul, caminos, edificios): al abrirla el viewport REPINTA por completo
 * respecto al render de terreno. Cualquier tecla la cierra y el turno se cobra al cerrar.
 */
import { test, expect, type Page } from "@playwright/test";

test.describe.configure({ retries: 2 });

const CANVAS = ".faithful-skin canvas";

/** Snapshot del viewport (8,8)-(184,184) del canvas fiel como array crudo, en window. */
async function stashViewport(page: Page, key: string): Promise<void> {
  await page.evaluate((k) => {
    const c = document.querySelector(".faithful-skin canvas") as HTMLCanvasElement;
    const img = c.getContext("2d")!.getImageData(8, 8, 176, 176).data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any)[k] = Array.from(img);
  }, key);
}

/** Fracción de píxeles que CAMBIARON entre el snapshot `key` y el viewport actual. */
async function changedFraction(page: Page, key: string): Promise<number> {
  return page.evaluate((k) => {
    const c = document.querySelector(".faithful-skin canvas") as HTMLCanvasElement;
    const now = c.getContext("2d")!.getImageData(8, 8, 176, 176).data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const before = (window as any)[k] as number[];
    let diff = 0;
    const total = now.length / 4;
    for (let i = 0; i < now.length; i += 4) {
      if (now[i] !== before[i] || now[i + 1] !== before[i + 1] || now[i + 2] !== before[i + 2]) diff++;
    }
    return diff / total;
  }, key);
}

async function setGems(page: Page, n: number): Promise<void> {
  await page.evaluate((g) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.state().gems = g;
  }, n);
}

const clock = (page: Page): Promise<number> =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (window as any).__u5test.state();
    return s.time.hour * 60 + s.time.minute;
  });

const gems = (page: Page): Promise<number> =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page.evaluate(() => (window as any).__u5test.state().gems);

test("View con gema en overworld: rejilla 32×32 en el canvas fiel (sin overlay DOM), turno al cerrar", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.addInitScript(() => localStorage.clear());
  // Piel fiel + montaje directo en overworld (82,108), fresco. __u5test vive en DEV
  // sea cual sea la piel, así que podemos sembrar gemas y leer estado.
  await page.goto("/?skin=faithful&nointro&loc=0&x=82&y=108");
  await expect(page.locator(CANVAS)).toBeVisible({ timeout: 30_000 });
  await setGems(page, 3);

  // Deja asentar el primer render de terreno y captúralo.
  await page.waitForTimeout(300);
  await stashViewport(page, "__terrain");
  const t0 = await clock(page);

  await page.keyboard.press("v");
  await page.waitForTimeout(300); // un frame del reloj de la piel para repintar

  // La gema se consumió (3 → 2) y NO apareció el overlay DOM de la piel dev.
  expect(await gems(page)).toBe(2);
  await expect(page.locator(".viewgem-panel")).toBeHidden();
  // El turno está DIFERIDO: con la vista abierta el reloj no avanzó.
  expect(await clock(page)).toBe(t0);

  // El viewport REPINTÓ a la rejilla de gema: gran mayoría de píxeles cambió respecto
  // al terreno (no un simple parpadeo). Captura la rejilla para comparar tras cerrar.
  expect(await changedFraction(page, "__terrain")).toBeGreaterThan(0.25);
  await stashViewport(page, "__gem");

  // GEOMETRÍA LITERAL: la rejilla es 128×128 anclada en pantalla (32,32) con MARCO
  // NEGRO — NO llena el viewport. La franja izquierda x∈[9,31] (dentro del viewport,
  // a la izquierda del ancla) es todo negro; la rejilla (x∈[33,158]) tiene contenido.
  const geo = await page.evaluate(() => {
    const c = document.querySelector(".faithful-skin canvas") as HTMLCanvasElement;
    const d = c.getContext("2d")!.getImageData(8, 8, 176, 176).data;
    const at = (x: number, y: number): [number, number, number] => {
      const i = ((y - 8) * 176 + (x - 8)) * 4;
      return [d[i]!, d[i + 1]!, d[i + 2]!];
    };
    const black = (p: [number, number, number]) => p[0] === 0 && p[1] === 0 && p[2] === 0;
    let marginBlack = true;
    for (let x = 9; x < 32; x++) for (let y = 33; y < 158; y++) if (!black(at(x, y))) marginBlack = false;
    let gridContent = false;
    for (let x = 33; x < 158; x++) for (let y = 33; y < 158; y++) if (!black(at(x, y))) gridContent = true;
    return { marginBlack, gridContent };
  });
  expect(geo.marginBlack).toBe(true); // marco negro a la izquierda de (32,·)
  expect(geo.gridContent).toBe(true); // la rejilla pinta dentro de (32,32)-(160,160)

  // Cualquier tecla cierra la vista y AHÍ corre el turno; el viewport vuelve al terreno.
  await page.keyboard.press("x");
  await page.waitForTimeout(300);
  expect(await clock(page)).toBeGreaterThan(t0);
  expect(await changedFraction(page, "__gem")).toBeGreaterThan(0.25);

  expect(errors).toEqual([]);
});

/**
 * Recorte del VIEWPORT en el canvas VISIBLE de la piel shader, en fracciones del
 * lienzo (el shader escala 320×200 a su backbuffer, así que no hay píxeles fijos que
 * valgan): el viewport lógico va de (8,8) a (184,184) sobre 320×200.
 */
async function shaderViewportStash(page: Page, key: string): Promise<void> {
  await page.evaluate((k) => {
    const c = document.querySelector(".shader-skin canvas") as HTMLCanvasElement;
    const x = Math.round((8 / 320) * c.width);
    const y = Math.round((8 / 200) * c.height);
    const w = Math.round((176 / 320) * c.width);
    const h = Math.round((176 / 200) * c.height);
    const d = c.getContext("2d")!.getImageData(x, y, w, h).data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any)[k] = { w, h, px: Array.from(d) };
  }, key);
}

async function shaderViewportChanged(page: Page, key: string): Promise<number> {
  return page.evaluate((k) => {
    const c = document.querySelector(".shader-skin canvas") as HTMLCanvasElement;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const before = (window as any)[k] as { w: number; h: number; px: number[] };
    const x = Math.round((8 / 320) * c.width);
    const y = Math.round((8 / 200) * c.height);
    const now = c.getContext("2d")!.getImageData(x, y, before.w, before.h).data;
    let diff = 0;
    for (let i = 0; i < now.length; i += 4) {
      if (
        now[i] !== before.px[i] ||
        now[i + 1] !== before.px[i + 1] ||
        now[i + 2] !== before.px[i + 2]
      )
        diff++;
    }
    return diff / (now.length / 4);
  }, key);
}

test("View con gema en piel SHADER: la rejilla SE PINTA en el viewport (no sólo «el overlay DOM no sale»)", async ({
  page,
}) => {
  // 🔴 ESTE TEST COMPROBABA LA COSA EQUIVOCADA, y por eso #247 llegó a producción. Su
  // única aserción de render era «`.viewgem-panel` está oculto»: eso mide que la piel
  // DEV no monta su overlay, NO que la shader PINTE la vista. Con el defecto de #247 —
  // `paintWorldInto` devolvía la capa de terreno con el modal abierto y el shader la
  // componía encima de la rejilla— este test pasaba VERDE mientras el jugador veía el
  // mapa normal, la gema se gastaba y el teclado se quedaba tragado por un modal
  // invisible. El control tiene que ir sobre la SALIDA del pintor: el viewport REPINTA.
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=shader&nointro&loc=0&x=82&y=108");
  await expect(page.locator(".shader-skin canvas").first()).toBeVisible({ timeout: 30_000 });
  await setGems(page, 2);
  await page.waitForTimeout(400);
  await shaderViewportStash(page, "__shaderTerrain");

  await page.keyboard.press("v");
  await page.waitForTimeout(400);

  // Gema consumida y el overlay DOM NO aparece (lo pinta el canvas shader).
  expect(await gems(page)).toBe(1);
  await expect(page.locator(".viewgem-panel")).toBeHidden();

  // …Y LA REJILLA ESTÁ AHÍ: el viewport cambió de arriba abajo respecto al terreno. El
  // umbral 0.25 es el mismo que usa la vía fiel arriba (repintado completo, no parpadeo).
  expect(
    await shaderViewportChanged(page, "__shaderTerrain"),
    "el viewport shader debe REPINTAR a la rejilla de gema (#247)",
  ).toBeGreaterThan(0.25);
  await shaderViewportStash(page, "__shaderGem");

  // Cualquier tecla la cierra (canvasGemActive) y el viewport vuelve al terreno.
  await page.keyboard.press("x");
  await page.waitForTimeout(400);
  await expect(page.locator(".viewgem-panel")).toBeHidden();
  expect(await shaderViewportChanged(page, "__shaderGem")).toBeGreaterThan(0.25);
});
