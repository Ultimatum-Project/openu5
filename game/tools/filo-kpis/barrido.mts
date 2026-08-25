/**
 * BARRIDO DE ESTADOS del carril `filo-kpis` — el banco de medida del encargo.
 *
 * Para cada estado (mundo · mazmorra · combate · Ztats en sus 4 familias de página ·
 * Ready) × (historial off/on) recorre el COMPUESTO del portrait y publica, medido en
 * píxeles de dispositivo:
 *
 *   · `lineas` — las filas de banda que llevan una LÍNEA blanca (racha larga, no tinta de
 *                glifo). La 96 es el filo inferior de KPIs y la 103 el fondo de la columna;
 *                el resto de la lista es el control de que NADA NUEVO se ha roto — el
 *                riesgo exacto que mató a la vía B.
 *   · `rachas` — por fila, la racha blanca más larga [inicio, largo], para poder auditar.
 *   · `hist`   — testigo DOBLE de que el historial está de verdad abierto.
 *   · `dung`   — testigo de que la mazmorra está de verdad montada.
 *
 * Se corre contra los DOS servidores (PRE = la base de la rama, POST = la rama) y guarda
 * capturas de la banda por estado. Reglas del carril: puertos 52xx propios.
 *
 *   U5_PRE=5242 U5_POST=5241 OUT=<dir> npx tsx tools/filo-kpis/barrido.mts
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.env.OUT ?? "/tmp/filo-kpis-barrido";
const MAP_BLOCK_H = 192;
const SEP_GAP_PX = 2;
/** Filas de banda que interesan: el filo inferior de KPIs y el fondo de la columna. */
const FILA_FILO = 96;
const FILA_FONDO = 103;
void FILA_FILO;
void FILA_FONDO;

/**
 * Los campos del probe de `__u5reflow` que este banco CONSUME, tipados a número: el
 * `Record<string, number>` de antes, bajo `noUncheckedIndexedAccess` (gate #267), degradaba
 * cada acceso a `number | undefined`. Los tipos se borran — el runtime y el `!` de siempre
 * no cambian.
 */
interface ProbeReflow {
  canvasW: number;
  canvasH: number;
  mapScale: number;
  bandScale: number;
}

interface Medida {
  /** ¿Historial DE VERDAD abierto? Dos testigos en la fuente, no uno. */
  hist: boolean;
  /** ¿Mazmorra DE VERDAD? (el `enterDungeon(0)` de la primera versión no entraba). */
  dung: boolean;
  /** Por fila de banda: la RACHA BLANCA más larga [inicio, largo] en px de dispositivo. */
  rachas: Record<number, [number, number]>;
  /** Filas de banda con una racha ≥ `MIN_LINEA`: las que llevan LÍNEA, no tinta suelta. */
  lineas: number[];
  bandScale: number;
}

/**
 * Racha mínima para llamar LÍNEA a algo, en px de dispositivo: el filo mide 122 px de
 * fuente; con `bandScale`≈1,47 y dpr 3 son ~537. Se pide la mitad para no depender de la
 * escala exacta y seguir descartando glifos (un carácter son ~4 px de fuente).
 */
const MIN_LINEA_SRC = 60;

async function medir(page: Page): Promise<Medida> {
  return page.evaluate(
    ([mapH, sep, dprFallback, minSrc]) => {
      const probe = (
        window as unknown as { __u5reflow?: { probe: () => ProbeReflow | null } }
      ).__u5reflow!.probe()!;
      const vis = document.querySelector<HTMLCanvasElement>(".portrait-skin canvas")!;
      const g = vis.getContext("2d", { willReadFrequently: true })!;
      const dpr = Math.round(vis.width / probe.canvasW) || dprFallback;
      const sb = probe.bandScale;
      const bandY = (mapH * probe.mapScale + sep * probe.mapScale) * dpr;
      const minLinea = minSrc * sb * dpr;
      // Se mide la LÍNEA, no un píxel, y a lo ANCHO DE TODO EL CANVAS: la racha blanca
      // más larga de la fila. Muestrear una columna daba falsos negativos donde la banda
      // ►↕◄ del picker ennegrece el centro, y obligaba a re-derivar aquí la geometría de
      // la columna — dos formas de que el instrumento mienta.
      const rachas: Record<number, [number, number]> = {};
      const lineas: number[] = [];
      for (let f = 0; f < 104; f++) {
        const yMid = Math.round(bandY + (f + 0.5) * sb * dpr);
        if (yMid >= vis.height) break;
        const fila = g.getImageData(0, yMid, vis.width, 1).data;
        let mejorIni = -1;
        let mejorLen = 0;
        let ini = -1;
        for (let i = 0; i <= vis.width; i++) {
          const o = i * 4;
          const blanco =
            i < vis.width && fila[o]! > 200 && fila[o + 1]! > 200 && fila[o + 2]! > 200;
          if (blanco) {
            if (ini < 0) ini = i;
          } else if (ini >= 0) {
            if (i - ini > mejorLen) {
              mejorLen = i - ini;
              mejorIni = ini;
            }
            ini = -1;
          }
        }
        rachas[f] = [mejorIni, mejorLen];
        if (mejorLen >= minLinea) lineas.push(f);
      }
      // ¿HISTORIAL abierto? DOS testigos en la FUENTE sobre la fila 10 del área de
      // consola: el rótulo la ennegrece en su centro (x240) y deja la barra AZUL fuera
      // (x304). Un solo píxel no valía: en el picker de Ready la banda ►↕◄ ennegrece
      // x248..271 y daba positivos en falso.
      const src = document.querySelector<HTMLCanvasElement>(".portrait-skin-src canvas")!;
      const sg = src.getContext("2d", { willReadFrequently: true })!;
      const e = Math.max(1, Math.round(src.width / 320));
      const dentro = sg.getImageData(240 * e, 84 * e, 1, 1).data;
      const fuera = sg.getImageData(304 * e, 84 * e, 1, 1).data;
      const t = window as unknown as { __u5test?: { game?: { dungeonState?: unknown } } };
      return {
        hist:
          dentro[0]! < 30 &&
          dentro[1]! < 30 &&
          dentro[2]! < 30 &&
          fuera[2]! > 100 &&
          fuera[0]! < 100,
        dung: t.__u5test?.game?.dungeonState != null,
        rachas,
        lineas,
        bandScale: sb,
      };
    },
    [MAP_BLOCK_H, SEP_GAP_PX, 3, MIN_LINEA_SRC] as const,
  );
}

/** Recorta la BANDA (la zona de jugadores/log) del compuesto, para el ojo del usuario. */
async function fotoBanda(page: Page, ruta: string): Promise<void> {
  const rect = await page.evaluate(
    ([mapH, sep]) => {
      const probe = (
        window as unknown as { __u5reflow?: { probe: () => ProbeReflow | null } }
      ).__u5reflow!.probe()!;
      const el = document.querySelector<HTMLCanvasElement>(".portrait-skin canvas")!;
      const b = el.getBoundingClientRect();
      const bandY = mapH * probe.mapScale + sep * probe.mapScale;
      return { x: b.left, y: b.top + bandY, width: b.width, height: probe.canvasH - bandY };
    },
    [MAP_BLOCK_H, SEP_GAP_PX] as const,
  );
  await page.screenshot({ path: ruta, clip: rect });
}

async function press(page: Page, key: string, ms = 170): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(ms);
}

async function boot(browser: Browser, port: string, extra = ""): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.clear());
  await page.goto(
    `http://localhost:${port}/?skin=faithful&nointro&loc=0&x=60&y=60&hour=10&seed=7&lang=es` +
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

/** Ecos de sobra: el historial sólo se abre con MÁS de 12 renglones acumulados. */
async function sembrarEcos(page: Page, vueltas = 8): Promise<void> {
  for (let v = 0; v < vueltas; v++) {
    for (const k of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) await press(page, k, 60);
  }
}

/** Rueda sobre la CONSOLA. Sin teclas: cualquier tecla sale del historial (fiel/skin 2234). */
async function rueda(page: Page): Promise<void> {
  const c = await page.evaluate(() => {
    const el = document.querySelector<HTMLCanvasElement>(".portrait-skin canvas")!;
    const b = el.getBoundingClientRect();
    return { l: b.left, t: b.top, w: b.width, h: b.height };
  });
  await page.mouse.move(c.l + c.w * 0.75, c.t + c.h - 40);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(400);
}

/** Los estados del barrido: nombre + cómo se llega (sólo teclas/hooks, nunca píxeles). */
const ESTADOS: {
  id: string;
  extra?: string;
  /** `dentro` = los ecos se siembran DESPUÉS de llegar: entrar en la mazmorra reinicia la
   *  consola, así que los renglones sembrados fuera no cuentan y el historial no abre. */
  ecos?: "antes" | "dentro";
  llegar: (p: Page) => Promise<void>;
}[] = [
  { id: "mundo", llegar: async () => {} },
  {
    id: "mazmorra",
    // SIN `?debug=1`: el drawer se auto-abre y SE COME LA RUEDA, así que el historial no
    // se abría nunca en este estado (la primera tanda del carril lo dio por medido, y no
    // lo estaba). `__u5debug` se monta igual sin la bandera; sólo cambia el auto-abrir.
    ecos: "dentro",
    llegar: async (p) => {
      await p.evaluate(() => {
        (
          window as unknown as { __u5debug: { enterDungeon: (n: number) => void } }
        ).__u5debug.enterDungeon(33); // Deceit — los ids son LOCATIONS (33..40), no 0
      });
      await press(p, "ArrowUp", 500);
      await sembrarEcos(p, 14);
    },
  },
  {
    id: "combate",
    llegar: async (p) => {
      await p.evaluate(() => {
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
      await press(p, "a");
      await press(p, "ArrowRight", 700);
    },
  },
  { id: "ztats-select", llegar: async (p) => void (await press(p, "z")) },
  {
    id: "ztats-ficha",
    llegar: async (p) => {
      await press(p, "z");
      await press(p, "1");
    },
  },
  {
    id: "ztats-armas",
    llegar: async (p) => {
      await press(p, "z");
      await press(p, "1");
      await press(p, "ArrowRight");
    },
  },
  {
    id: "ztats-provisiones",
    llegar: async (p) => {
      await press(p, "z");
      await press(p, "1");
      for (let i = 0; i < 2; i++) await press(p, "ArrowRight");
    },
  },
  {
    id: "ztats-lista",
    llegar: async (p) => {
      await press(p, "z");
      await press(p, "1");
      for (let i = 0; i < 3; i++) await press(p, "ArrowRight");
    },
  },
  // Con un jugador ACTIVO puesto, (R)eady salta la fase de selección y abre el pergamino
  // directamente: los dos casos de abajo son el MISMO estado, y así se declara.
  { id: "ready-picker", llegar: async (p) => void (await press(p, "r")) },
];

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const tabla: Record<string, Record<string, Medida>> = {};

  for (const [lado, port] of [
    ["PRE", process.env.U5_PRE ?? "5242"],
    ["POST", process.env.U5_POST ?? "5241"],
  ] as const) {
    for (const est of ESTADOS) {
      for (const hist of [false, true]) {
        const clave = `${est.id}${hist ? "+hist" : ""}`;
        if (process.env.SOLO && !clave.startsWith(process.env.SOLO)) continue;
        const page = await boot(browser, port, est.extra ?? "");
        if ((est.ecos ?? "antes") === "antes") await sembrarEcos(page, 8);
        await est.llegar(page);
        if (hist) await rueda(page);
        (tabla[clave] ??= {})[lado] = await medir(page);
        await fotoBanda(page, join(OUT, `${lado}-${clave}.png`));
        await page.context().close();
      }
    }
  }

  await browser.close();
  writeFileSync(join(OUT, "medidas.json"), JSON.stringify(tabla, null, 2));
  console.log(JSON.stringify(tabla));
}
void main();
