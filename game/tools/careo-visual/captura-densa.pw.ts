/**
 * CAREO VISUAL — RÉGIMEN 2: captura DENSA (fotograma a fotograma) de una CEREMONIA.
 *
 * El régimen ordinario (`captura-port.pw.ts`) toma UN par por compás: sirve donde entre
 * turnos la pantalla es una imagen quieta (§2.1 de METODO-MEDIDO). NO sirve donde el
 * contenido ES la animación: una ceremonia con tren de pulsos se ve idéntica antes y
 * después, y un par antes/después no la mide. Aquí se vuelca el canvas LÓGICO 320×200
 * en CADA rAF, con su marca de tiempo, para reconstruir el tren.
 *
 * Ceremonia cubierta: APARICIÓN DEL CAMPAMENTO (OUTSUBS camp_results; piel
 * `skin/fiel/apparition.ts`, gate 25 % en `core/world/camp.ts` campWake). Se conduce
 * ORGÁNICAMENTE: (H)ole up & camp en terreno acampable, y se BUSCA la semilla en la que
 * el gate cruza — no se fuerza el cue, para que lo capturado sea el camino real.
 *
 * CONTROL POSITIVO **PROPIO DEL RÉGIMEN 2** (obligatorio; el del régimen ordinario —un
 * cofre en el mapa— NO vale aquí: lo caza también un par antes/después). Se siembra una
 * divergencia que SÓLO un careo denso puede ver, interceptando el módulo que vite sirve
 * (`page.route`) — así la siembra no toca el árbol y no puede quedarse puesta:
 *   · CAREO_SIEMBRA=pulso-corto  — `APPARITION_INVERT_MS` 2200 → 1200. Cambia la
 *     DURACIÓN de cada pulso. Antes y después de la ceremonia la pantalla es la misma.
 *   · CAREO_SIEMBRA=orden-cambiado — invierte el ORDEN de las dos fases del pulso
 *     (primero el hueco, luego la inversión). Misma duración total, mismos extremos.
 *
 * Uso (REGLA 3: puerto propio 52xx censado con `lsof -ti` ANTES):
 *   CAREO_PORT=5251 CAREO_OUT=<dir> npx playwright test -c tools/careo-visual/densa.config.ts
 *   CAREO_PORT=5251 CAREO_SIEMBRA=pulso-corto CAREO_OUT=<dir> npx playwright test -c …
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.CAREO_OUT ?? path.join(HERE, "_out-densa");
const SIEMBRA = process.env.CAREO_SIEMBRA ?? "";
/** Semillas a probar hasta que el gate del 25 % cruce (la aparición es aleatoria). */
const SEEDS = (process.env.CAREO_SEEDS ?? "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16")
  .split(",")
  .map((s) => Number(s.trim()));
/** ms de grabación densa desde que arranca el sueño. */
const REC_MS = Number(process.env.CAREO_REC_MS ?? 26_000);

interface Cap {
  t: number;
  png: string;
}

declare global {
  interface Window {
    __careo?: {
      frames: Cap[];
      stop: () => void;
      t0: number;
    };
  }
}

async function faithfulCanvas(page: Page): Promise<Locator> {
  const canvas = page.locator(".faithful-skin canvas");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(canvas).toHaveAttribute("width", "320");
  await expect(canvas).toHaveAttribute("height", "200");
  return canvas;
}

async function dump(canvas: Locator, file: string): Promise<void> {
  const dataUrl = await canvas.evaluate((el) =>
    (el as HTMLCanvasElement).toDataURL("image/png"),
  );
  await fs.writeFile(
    file,
    Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"),
  );
}

const consola = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const h = (window as unknown as Record<string, unknown>).__u5test as
      | { consoleLines?: () => string[] }
      | undefined;
    return h?.consoleLines?.() ?? [];
  });

/** Siembra: reescribe el módulo que sirve vite. No toca el árbol. */
async function sembrar(page: Page): Promise<void> {
  if (!SIEMBRA) return;
  await page.route("**/src/skin/fiel/apparition.ts", async (route) => {
    const res = await route.fetch();
    let body = await res.text();
    if (SIEMBRA === "pulso-corto") {
      const antes = body;
      body = body.replace(
        "export const APPARITION_INVERT_MS = 2200;",
        "export const APPARITION_INVERT_MS = 1200;",
      );
      if (body === antes) throw new Error("SIEMBRA pulso-corto NO aplicada: el texto no casó");
    } else if (SIEMBRA === "orden-cambiado") {
      const antes = body;
      // El pulso es [invertir INVERT_MS | hueco GAP_MS]; se cambia a [hueco | invertir].
      body = body.replace(
        "invert: !inHold && t % period < APPARITION_INVERT_MS,",
        "invert: !inHold && t % period >= APPARITION_GAP_MS,",
      );
      if (body === antes) throw new Error("SIEMBRA orden-cambiado NO aplicada: el texto no casó");
    } else {
      throw new Error(`SIEMBRA desconocida: ${SIEMBRA}`);
    }
    await route.fulfill({ response: res, body });
  });
}

test("careo denso — aparición del campamento", async ({ page }) => {
  await fs.mkdir(OUT, { recursive: true });
  await page.addInitScript(() => localStorage.clear());
  await sembrar(page);

  let usada = -1;
  let lineas: string[] = [];
  let canvas!: Locator;

  for (const seed of SEEDS) {
    await page.goto(`/?skin=faithful&nointro&loc=0&x=76&y=40&seed=${seed}`);
    canvas = await faithfulCanvas(page);
    await page.waitForTimeout(700);
    await page.locator("body").press("h"); // Hole up & camp!
    await page.waitForTimeout(150);
    await page.locator("body").press("1"); // una hora (el gate es POR acampada)
    await page.waitForTimeout(150);
    await page.locator("body").press("n"); // sin vigía → arranca el sueño
    await page.waitForTimeout(2500);
    lineas = await consola(page);
    if (lineas.some((l) => l.includes("An apparition"))) {
      usada = seed;
      break;
    }
  }
  // eslint-disable-next-line no-console
  console.log(`semilla con aparición: ${usada}`);
  expect(usada, "ninguna semilla cruzó el gate del 25 %").toBeGreaterThan(0);

  // ── RALO: el fotograma ANTES de la ceremonia (ya con "An apparition!" impreso pero
  // antes de que la escena termine no sirve) — se toma el de ARRANQUE del sueño y el de
  // ASENTAMIENTO final. Es exactamente el par que un careo por compás tendría.
  // Se re-corre la ceremonia entera desde cero para grabarla densa.
  await page.goto(`/?skin=faithful&nointro&loc=0&x=76&y=40&seed=${usada}`);
  canvas = await faithfulCanvas(page);
  await page.waitForTimeout(700);
  await dump(canvas, path.join(OUT, "ralo-antes.png"));

  await page.locator("body").press("h");
  await page.waitForTimeout(150);
  await page.locator("body").press("1");
  await page.waitForTimeout(150);

  // grabador denso EN LA PÁGINA: un volcado por rAF con marca de tiempo
  await page.evaluate(() => {
    const el = document.querySelector(".faithful-skin canvas") as HTMLCanvasElement;
    const st: { frames: { t: number; png: string }[]; stop: () => void; t0: number } = {
      frames: [],
      t0: performance.now(),
      stop: () => {},
    };
    let vivo = true;
    st.stop = () => {
      vivo = false;
    };
    const tick = (): void => {
      if (!vivo) return;
      st.frames.push({ t: performance.now() - st.t0, png: el.toDataURL("image/png") });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__careo = st;
  });

  await page.locator("body").press("n"); // arranca el sueño → aparición
  await page.waitForTimeout(REC_MS);
  await page.evaluate(() => window.__careo?.stop());
  await page.waitForTimeout(200);

  const frames = await page.evaluate(() => window.__careo?.frames ?? []);
  // eslint-disable-next-line no-console
  console.log(`fotogramas densos: ${frames.length} en ${REC_MS} ms`);

  const dir = path.join(OUT, "densa");
  await fs.mkdir(dir, { recursive: true });
  const idx: Array<{ i: number; t: number; f: string }> = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    const name = `d${String(i).padStart(4, "0")}.png`;
    await fs.writeFile(
      path.join(dir, name),
      Buffer.from(f.png.replace(/^data:image\/png;base64,/, ""), "base64"),
    );
    idx.push({ i, t: Math.round(f.t * 1000) / 1000, f: name });
  }

  await dump(canvas, path.join(OUT, "ralo-despues.png"));
  const finales = await consola(page);
  await fs.writeFile(
    path.join(OUT, "meta.json"),
    JSON.stringify(
      { siembra: SIEMBRA || null, semilla: usada, rec_ms: REC_MS, n: idx.length, frames: idx,
        consola: finales.slice(-14) },
      null,
      1,
    ),
  );
  expect(idx.length).toBeGreaterThan(100);
});
