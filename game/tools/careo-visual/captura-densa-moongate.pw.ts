/**
 * CAREO VISUAL — RÉGIMEN 2: captura DENSA del CRUCE DE PUERTA LUNAR.
 *
 * Segunda ceremonia del régimen 2, y de NATURALEZA distinta a la aparición: aquí no
 * hay efecto de paleta ninguno — lo que se anima es la GEOMETRÍA de un sprite (el
 * rectángulo de la puerta MENGUA sobre el jugador). El bucle del original es
 * descendente: `kernel_moongate_enter` 0x48a8 → 0x4912-0x492b, blit parcial
 * `0x1112(anim,5,5)` + delay + `dec [0x5887]`, etapas 15→1. La piel lo calca con
 * `MOONGATE_TRANSIT_STAGE_MS` (`skin/fiel/moongate.ts`) — que desde #166/G1 ya NO es
 * Clase C: el `delay(2)` @0x4924 son 2 ticks de INT 1Ch = 109.85 ms, y el cierre
 * entero 30 ticks = 1647.8 ms (ver `re/notes/cadencia-delay-pit.md`).
 *
 * Se conduce con la MISMA siembra que `e2e/moongate-fisica-352.spec.ts` (piedra 0
 * enterrada en (77,40), fases latcheadas, hora 22 = noche) para pisar la puerta con
 * una sola tecla y grabar el cruce entero a rAF.
 *
 * Uso: CAREO_PORT=5251 CAREO_OUT=<dir> npx playwright test -c tools/careo-visual/densa-moongate.config.ts
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.CAREO_OUT ?? path.join(HERE, "_out-moongate");
const REC_MS = Number(process.env.CAREO_REC_MS ?? 8000);

declare global {
  interface Window {
    __careoMg?: { frames: { t: number; png: string }[]; stop: () => void };
  }
}

async function faithfulCanvas(page: Page): Promise<Locator> {
  const canvas = page.locator(".faithful-skin canvas");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(canvas).toHaveAttribute("width", "320");
  return canvas;
}

async function dump(canvas: Locator, file: string): Promise<void> {
  const d = await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL("image/png"));
  await fs.writeFile(file, Buffer.from(d.replace(/^data:image\/png;base64,/, ""), "base64"));
}

test("careo denso — cruce de puerta lunar", async ({ page }) => {
  await fs.mkdir(OUT, { recursive: true });
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful&nointro&loc=0&x=76&y=40&hour=22&seed=1234");
  const canvas = await faithfulCanvas(page);
  await page.waitForTimeout(1200);

  // Siembra del tablero lunar — calco de e2e/moongate-fisica-352.spec.ts
  await page.evaluate(() => {
    const s = (window as unknown as { __u5test: { state: () => Record<string, unknown> } })
      .__u5test.state() as Record<string, unknown> & {
        moonstones: Array<Record<string, unknown>>;
      };
    s.feluccaPhase = 0x30;
    s.trammelPhase = 0x33;
    s.moonstones[0] = { x: 77, y: 40, z: 0, location: 0, buried: true };
    s.moonstones[3] = { x: 15, y: 15, z: 0, location: 2, buried: true };
  });
  await page.waitForTimeout(600);
  await dump(canvas, path.join(OUT, "ralo-antes.png"));

  await page.evaluate(() => {
    const el = document.querySelector(".faithful-skin canvas") as HTMLCanvasElement;
    const st: { frames: { t: number; png: string }[]; stop: () => void } = {
      frames: [],
      stop: () => {},
    };
    let vivo = true;
    const t0 = performance.now();
    st.stop = () => {
      vivo = false;
    };
    const tick = (): void => {
      if (!vivo) return;
      st.frames.push({ t: performance.now() - t0, png: el.toDataURL("image/png") });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__careoMg = st;
  });

  await page.keyboard.press("ArrowRight"); // pisa la puerta
  await page.waitForTimeout(REC_MS);
  await page.evaluate(() => window.__careoMg?.stop());
  await page.waitForTimeout(200);

  const frames = await page.evaluate(() => window.__careoMg?.frames ?? []);
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
  const pos = await page.evaluate(
    () =>
      (window as unknown as { __u5test: { state: () => { position: unknown } } })
        .__u5test.state().position,
  );
  await fs.writeFile(
    path.join(OUT, "meta.json"),
    JSON.stringify({ escena: "moongate", rec_ms: REC_MS, n: idx.length, frames: idx, pos }, null, 1),
  );
  expect(idx.length).toBeGreaterThan(50);
});
