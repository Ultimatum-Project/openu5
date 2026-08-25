/**
 * CENSO DE SCANLINES DEL PANEL — instrumento del carril `filo-kpis` (decisión 3 del
 * usuario, 02-08). Pregunta que contesta: ¿existe alguna scanline FUENTE que sea el
 * MISMO DIBUJO que el filo inferior de la caja de KPIs (la fila 80) y que además esté
 * SANA en todos los estados del juego?
 *
 * Vuelca, para cada estado, las filas 0..103 de la columna del panel (x=191..319) del
 * canvas 320×200 de la piel ALOJADA (la fuente que el compositor del portrait recorta),
 * clasificadas por color, y las compara byte a byte contra la fila 80 del estado MUNDO
 * (el patrón canónico del filo).
 *
 *   U5_PORT=5241 npx tsx tools/filo-kpis/censo.mts > /tmp/censo.json
 *
 * REGLAS DEL CARRIL: dev server PROPIO en 52xx (jamás el 5199 del usuario).
 */
import { chromium, type Browser, type Page } from "@playwright/test";

const BASE = `http://localhost:${process.env.U5_PORT ?? "5241"}`;
const PANEL_X = 191;
const PANEL_W = 129;
const ROWS = 104;

/** Firma de una fila: un carácter por píxel (# blanco · . negro · B azul · ? otro). */
async function panelRows(page: Page): Promise<string[]> {
  return page.evaluate(
    ([px, pw, rows]) => {
      const src = document.querySelector<HTMLCanvasElement>(".portrait-skin-src canvas");
      if (!src) return [];
      const g = src.getContext("2d", { willReadFrequently: true })!;
      const d = g.getImageData(px, 0, pw, rows).data;
      const out: string[] = [];
      for (let y = 0; y < rows; y++) {
        let s = "";
        for (let x = 0; x < pw; x++) {
          const o = (y * pw + x) * 4;
          const r = d[o]!;
          const gg = d[o + 1]!;
          const b = d[o + 2]!;
          s +=
            r > 200 && gg > 200 && b > 200 ? "#"
            : r < 30 && gg < 30 && b < 30 ? "."
            : b > 100 && r < 100 ? "B"
            : "?";
        }
        out.push(s);
      }
      return out;
    },
    [PANEL_X, PANEL_W, ROWS] as const,
  );
}

async function press(page: Page, key: string, ms = 170): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(ms);
}

async function boot(browser: Browser, extra = ""): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.clear());
  await page.goto(
    `${BASE}/?skin=faithful&nointro&loc=0&x=60&y=60&hour=10&seed=7&lang=es` +
      `&reflow=cuadrado-force&deck=bloques${extra}`,
  );
  await page.waitForFunction(
    () =>
      (window as unknown as { __u5test?: { worldReady?: () => boolean } }).__u5test?.worldReady?.() ===
      true,
    undefined,
    { timeout: 25_000 },
  );
  await page.waitForTimeout(900);
  return page;
}

/** Abre el historial (rueda hacia arriba sobre la consola). */
async function abrirHistorial(page: Page): Promise<void> {
  // Ecos suficientes para que el scrollback tenga qué mostrar.
  for (const k of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
    for (let i = 0; i < 4; i++) await press(page, k, 70);
  }
  const c = await page.evaluate(() => {
    const el = document.querySelector<HTMLCanvasElement>(".portrait-skin canvas");
    const b = el?.getBoundingClientRect();
    return b ? { l: b.left, t: b.top, w: b.width, h: b.height } : null;
  });
  if (!c) throw new Error("sin canvas del portrait");
  await page.mouse.move(c.l + c.w * 0.75, c.t + c.h - 40);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(500);
}

const out: Record<string, string[]> = {};

async function capturar(nombre: string, page: Page): Promise<void> {
  out[nombre] = await panelRows(page);
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });

  // ── MUNDO (patrón canónico) + historial ──────────────────────────────────────────
  {
    const page = await boot(browser);
    await capturar("mundo", page);
    await abrirHistorial(page);
    await capturar("mundo+historial", page);
    await page.context().close();
  }

  // ── ZTATS: ciclo COMPLETO del eje (no una lista de páginas adivinada) ────────────
  {
    const page = await boot(browser);
    await press(page, "z"); // fase SELECT (roster con banner ►Select:◄)
    await capturar("ztats-select", page);
    await press(page, "1"); // ficha del miembro 1
    for (let i = 0; i < 18; i++) {
      await capturar(`ztats-pag${String(i).padStart(2, "0")}`, page);
      await press(page, "ArrowRight");
    }
    await page.context().close();
  }

  // ── ZTATS + historial (el estado que mató a la vía B, con el scrollback encima) ──
  {
    const page = await boot(browser);
    await abrirHistorial(page);
    await press(page, "z");
    await press(page, "1");
    await capturar("ztats-ficha+historial", page);
    for (let i = 0; i < 13; i++) await press(page, "ArrowRight");
    await capturar("ztats-lista+historial", page);
    await page.context().close();
  }

  // ── READY (picker de pergamino: pinta la banda de flechas EN LA FILA 10) ─────────
  {
    const page = await boot(browser);
    await press(page, "r");
    await capturar("ready-select", page);
    await press(page, "1");
    await capturar("ready-pick", page);
    await page.context().close();
  }

  // ── MAZMORRA ─────────────────────────────────────────────────────────────────────
  {
    const page = await boot(browser, "&debug=1");
    await page.evaluate(() => {
      (window as unknown as { __u5debug: { enterDungeon: (n: number) => void } }).__u5debug.enterDungeon(
        0,
      );
    });
    await press(page, "ArrowUp", 400);
    await capturar("mazmorra", page);
    await abrirHistorial(page);
    await capturar("mazmorra+historial", page);
    await page.context().close();
  }

  // ── COMBATE (enemigo errante adyacente + tecla A) ────────────────────────────────
  {
    const page = await boot(browser);
    await page.evaluate(() => {
      (
        window as unknown as {
          __u5test: { game: { overworldEnemies: { enemies: unknown[] } } };
        }
      ).__u5test.game.overworldEnemies.enemies.push({
        defIndex: 0,
        tile: 0x94,
        water: false,
        x: 61,
        y: 60,
      });
    });
    await press(page, "a");
    await press(page, "ArrowRight", 600);
    await capturar("combate", page);
    await abrirHistorial(page);
    await capturar("combate+historial", page);
    await page.context().close();
  }

  await browser.close();
  console.log(JSON.stringify(out));
}
void main();
