/**
 * CENSO 2 — el mismo instrumento que `censo.mts` pero (a) alcanzando de verdad las
 * combinaciones ESTADO × HISTORIAL (cualquier tecla saca del historial: `fiel/skin.ts`
 * 2234, así que el orden obligado es ABRIR EL ESTADO CON TECLAS y DESPUÉS la rueda), y
 * (b) añadiendo la tira VERTICAL del COMPUESTO (columna izquierda, píxeles de
 * dispositivo) para ver qué filas de destino llevan tinta blanca — que es lo que el
 * usuario ve, y lo que la fuente sola no dice.
 *
 *   U5_PORT=5241 npx tsx tools/filo-kpis/censo2.mts > /tmp/censo2.json
 */
import { chromium, type Browser, type Page } from "@playwright/test";

const BASE = `http://localhost:${process.env.U5_PORT ?? "5241"}`;

interface Captura {
  /** Filas 0..103 de la columna del panel en la FUENTE, clasificadas por color. */
  fuente: string[];
  /** Tira vertical del COMPUESTO en la columna IZQUIERDA (una letra por scanline de dispositivo). */
  tira: string;
  /** Geometría viva del layout. */
  probe: Record<string, number | string> | null;
}

async function muestra(page: Page): Promise<Captura> {
  // OJO: nada de funciones con NOMBRE dentro del evaluate — `tsx` las envuelve en
  // `__name(...)` (keepNames de esbuild) y ese helper no existe en la página.
  return page.evaluate(() => {
    const CLASIF = "#.B?";
    const src = document.querySelector<HTMLCanvasElement>(".portrait-skin-src canvas");
    const fuente: string[] = [];
    if (src) {
      const g = src.getContext("2d", { willReadFrequently: true })!;
      const d = g.getImageData(191, 0, 129, 104).data;
      for (let y = 0; y < 104; y++) {
        let s = "";
        for (let x = 0; x < 129; x++) {
          const o = (y * 129 + x) * 4;
          const r = d[o]!;
          const g2 = d[o + 1]!;
          const b = d[o + 2]!;
          s += CLASIF[
            r > 200 && g2 > 200 && b > 200 ? 0
            : r < 30 && g2 < 30 && b < 30 ? 1
            : b > 100 && r < 100 ? 2
            : 3
          ];
        }
        fuente.push(s);
      }
    }

    const vis = document.querySelector<HTMLCanvasElement>(".portrait-skin canvas");
    let tira = "";
    const probe =
      (
        window as unknown as { __u5reflow?: { probe: () => Record<string, number | string> | null } }
      ).__u5reflow?.probe() ?? null;
    if (vis) {
      const g = vis.getContext("2d", { willReadFrequently: true })!;
      // Columna a 1/4 del ancho: cae dentro de la columna IZQUIERDA (roster+KPIs).
      const x = Math.round(vis.width * 0.25);
      const d = g.getImageData(x, 0, 1, vis.height).data;
      for (let y = 0; y < vis.height; y++) {
        const o = y * 4;
        const r = d[o]!;
        const g2 = d[o + 1]!;
        const b = d[o + 2]!;
        tira += CLASIF[
          r > 200 && g2 > 200 && b > 200 ? 0
          : r < 30 && g2 < 30 && b < 30 ? 1
          : b > 100 && r < 100 ? 2
          : 3
        ];
      }
    }
    return { fuente, tira, probe };
  });
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

/** Ecos suficientes para que el historial tenga contenido (ANTES de abrir el estado). */
async function sembrarEcos(page: Page): Promise<void> {
  for (const k of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
    for (let i = 0; i < 4; i++) await press(page, k, 70);
  }
}

/** Rueda hacia arriba sobre la CONSOLA. NO pulsa teclas: cualquier tecla sale del historial. */
async function rueda(page: Page): Promise<void> {
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

const out: Record<string, Captura> = {};

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });

  // MUNDO · MUNDO+HISTORIAL
  {
    const page = await boot(browser);
    await sembrarEcos(page);
    out["mundo"] = await muestra(page);
    await rueda(page);
    out["mundo+hist"] = await muestra(page);
    await page.context().close();
  }

  // ZTATS ficha / lista, cada una SIN y CON historial (ecos primero, rueda al final)
  for (const [nombre, pasos] of [
    ["ztats-select", 0],
    ["ztats-ficha", 1],
    ["ztats-armas", 2],
    ["ztats-prov", 3],
    ["ztats-lista1", 4],
    ["ztats-lista4", 7],
  ] as const) {
    const page = await boot(browser);
    await sembrarEcos(page);
    if (nombre !== "ztats-select") {
      await press(page, "z");
      await press(page, "1");
      for (let i = 0; i < pasos - 1; i++) await press(page, "ArrowRight");
    } else {
      await press(page, "z");
    }
    out[nombre] = await muestra(page);
    await rueda(page);
    out[`${nombre}+hist`] = await muestra(page);
    await page.context().close();
  }

  // READY (banda de flechas en la fila 10)
  {
    const page = await boot(browser);
    await sembrarEcos(page);
    await press(page, "r");
    out["ready-select"] = await muestra(page);
    await press(page, "1");
    out["ready-pick"] = await muestra(page);
    await rueda(page);
    out["ready-pick+hist"] = await muestra(page);
    await page.context().close();
  }

  // MAZMORRA
  {
    const page = await boot(browser, "&debug=1");
    await page.evaluate(() => {
      (
        window as unknown as { __u5debug: { enterDungeon: (n: number) => void } }
      ).__u5debug.enterDungeon(0);
    });
    await press(page, "ArrowUp", 500);
    await sembrarEcos(page);
    out["mazmorra"] = await muestra(page);
    await rueda(page);
    out["mazmorra+hist"] = await muestra(page);
    await page.context().close();
  }

  // COMBATE
  {
    const page = await boot(browser);
    await page.evaluate(() => {
      (
        window as unknown as { __u5test: { game: { overworldEnemies: { enemies: unknown[] } } } }
      ).__u5test.game.overworldEnemies.enemies.push({
        defIndex: 0,
        tile: 0x94,
        water: false,
        x: 61,
        y: 60,
      });
    });
    await press(page, "a");
    await press(page, "ArrowRight", 700);
    out["combate"] = await muestra(page);
    await rueda(page);
    out["combate+hist"] = await muestra(page);
    await page.context().close();
  }

  await browser.close();
  console.log(JSON.stringify(out));
}
void main();
