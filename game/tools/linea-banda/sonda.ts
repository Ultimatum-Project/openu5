/**
 * SONDA DE LA COSTURA mapa↔banda — el CENSO DE FILAS del hueco, fila a fila.
 *
 * POR QUÉ EXISTE (petición del usuario 03-08): «no está bien la línea superior del borde del
 * área inferior del layout partido. Debería ser una línea blanca como borde de la banda azul
 * y pegada a ésta, y está separada. Luego hay otra línea que no cubre todo el ancho.»
 *
 * Las dos quejas son sobre PÍXELES DEL CANVAS COMPUESTO, no sobre el descriptor: hay más de
 * un filo blanco en esa zona (los separadores que pinta `paintSeparators`, y el cromo propio
 * que entra por los blits de `seamLog`/`panel`), y sólo mirando el canvas se ve CUÁNTOS hay,
 * en qué fila, de qué ancho y cuánto negro los separa. `tools/portrait-pulido/sonda.ts` mide
 * la PRIMERA fila blanca tras el hueco y el hueco negro; aquí hace falta el censo COMPLETO de
 * la ventana, porque la queja es justamente sobre la línea que aquella sonda no nombra.
 *
 * Se mide CON LA BARRA DEL NAVEGADOR (altos recortados): el alto entra en el reparto y una
 * escena sin barra no es la que el usuario mira.
 *
 * USO (dev server PROPIO en un 52xx — jamás el 5199 del usuario):
 *   U5_PORT=5281 OUT=/ruta/censo.json SHOTS=/ruta/dir npx tsx tools/linea-banda/sonda.ts
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PORT = process.env["U5_PORT"] ?? "5281";
const BASE = `http://localhost:${PORT}`;
const OUT = process.env["OUT"] ?? "";
const SHOTS = process.env["SHOTS"] ?? "";

interface Escena {
  id: string;
  label: string;
  w: number;
  h: number;
  dpr: number;
}

/** Teléfonos en PORTRAIT **con la barra del navegador puesta** (el caso de la captura). */
const ESCENAS: Escena[] = [
  { id: "iphone15", label: "393×659 iPhone 15 con barra", w: 393, h: 659, dpr: 3 },
  { id: "pixel7", label: "412×720 Pixel 7 con barra", w: 412, h: 720, dpr: 3 },
  { id: "promax", label: "430×739 Pro Max con barra", w: 430, h: 739, dpr: 3 },
  { id: "se", label: "320×460 iPhone SE con barra", w: 320, h: 460, dpr: 2 },
];

/** Una fila del censo: cuántos píxeles blancos, y entre qué columnas. */
export interface Fila {
  y: number;
  blancos: number;
  xIni: number;
  xFin: number;
  /** Tramos de blanco contiguo [inicio, fin] — para ver si la línea está PARTIDA. */
  tramos: [number, number][];
  negra: boolean;
  azules: number;
}

export interface Medida {
  id: string;
  label: string;
  w: number;
  h: number;
  mapScale: number;
  bandScale: number;
  canvasW: number;
  canvasH: number;
  scroll: boolean;
  /** Ventana censada: de `y0` a `y1` del backbuffer. */
  y0: number;
  y1: number;
  filas: Fila[];
  /**
   * SEGUNDA VENTANA — el PIE de la banda (últimas filas del lienzo), donde vive la línea
   * blanca de debajo de los KPIs. Es la MISMA fila fuente que el filo de la caja de consola
   * del techo (la costura, `SRC_SEAM`), pintada al fondo de la columna de jugadores; y es la
   * que el usuario reporta que DESAPARECE al abrir el historial (03-08).
   */
  filasPie: Fila[];
}

/** Censo de filas de la ventana que rodea la costura, leído del canvas COMPUESTO. */
async function censar(page: Page): Promise<Omit<Medida, "id" | "label" | "w" | "h" | "scroll">> {
  return page.evaluate(() => {
    const cs = (Array.from(document.querySelectorAll("#app canvas")) as HTMLCanvasElement[])
      .filter((el) => !el.closest(".portrait-skin-src"))
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.right > 0 && b.bottom > 0 && b.left < window.innerWidth && b.top < window.innerHeight;
      });
    let c: HTMLCanvasElement | null = null;
    let area = 0;
    for (const el of cs) {
      const b = el.getBoundingClientRect();
      if (b.width * b.height > area) {
        area = b.width * b.height;
        c = el;
      }
    }
    type F = {
      y: number;
      blancos: number;
      xIni: number;
      xFin: number;
      tramos: [number, number][];
      negra: boolean;
      azules: number;
    };
    const vacia = {
      mapScale: 0,
      bandScale: 0,
      canvasW: 0,
      canvasH: 0,
      y0: 0,
      y1: 0,
      filas: [] as F[],
      filasPie: [] as F[],
    };
    if (!c) return vacia;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) return vacia;
    const W = c.width;
    const H = c.height;
    const d = g.getImageData(0, 0, W, H).data;
    const blanco = (x: number, y: number): boolean => {
      const i = (y * W + x) * 4;
      return d[i]! > 150 && d[i + 1]! > 150 && d[i + 2]! > 150;
    };
    const negro = (x: number, y: number): boolean => {
      const i = (y * W + x) * 4;
      return d[i]! < 40 && d[i + 1]! < 40 && d[i + 2]! < 40;
    };
    const azul = (x: number, y: number): boolean => {
      const i = (y * W + x) * 4;
      return d[i + 2]! > 100 && d[i]! < 80 && d[i + 1]! < 80;
    };
    const filaNegra = (y: number): boolean => {
      for (let x = 0; x < W; x++) if (!negro(x, y)) return false;
      return true;
    };
    // La ventana: la primera racha de filas ENTERAMENTE negras de la mitad inferior es el
    // hueco de separación. Se censa desde 24 filas antes hasta 40 después.
    let yGap = -1;
    for (let y = Math.floor(H * 0.35); y < H - 2; y++) {
      if (filaNegra(y) && !filaNegra(y - 1)) {
        let z = y;
        while (z < H && filaNegra(z)) z++;
        if (z < H - 1) {
          yGap = y;
          break;
        }
      }
    }
    const centro = yGap >= 0 ? yGap : Math.floor(H * 0.6);
    const y0 = Math.max(0, centro - 24);
    // +84 y no +44: la ventana tiene que llegar hasta el FONDO del bloque de costura de la
    // columna del log (8 filas fuente ≈ 36 px de dispositivo tras el techo de la banda), que
    // es donde se ve si la fuente sigue teniendo la fila blanca de ancho completo con el
    // historial abierto — la pregunta que adjudica el reporte del pie de los KPIs.
    const y1 = Math.min(H, centro + 84);
    const unaFila = (y: number): F => {
      let n = 0;
      let nb = 0;
      let xIni = -1;
      let xFin = -1;
      const tramos: [number, number][] = [];
      let run = -1;
      for (let x = 0; x < W; x++) {
        if (azul(x, y)) nb++;
        if (blanco(x, y)) {
          n++;
          if (xIni < 0) xIni = x;
          xFin = x;
          if (run < 0) run = x;
        } else if (run >= 0) {
          tramos.push([run, x - 1]);
          run = -1;
        }
      }
      if (run >= 0) tramos.push([run, W - 1]);
      return { y, blancos: n, xIni, xFin, tramos, negra: filaNegra(y), azules: nb };
    };
    const filas: F[] = [];
    for (let y = y0; y < y1; y++) filas.push(unaFila(y));
    // El PIE de la banda: la banda acaba en el fondo del lienzo (`insetB` sólo en la variante
    // `full`), así que las últimas 44 filas cubren de sobra la caja de KPIs y lo que va bajo
    // ella. Es donde vive la «línea blanca inferior debajo de KPIs» del reporte del 03-08.
    const filasPie: F[] = [];
    for (let y = Math.max(y1, H - 44); y < H; y++) filasPie.push(unaFila(y));
    const r = (globalThis as unknown as { __u5reflow?: { probe: () => Record<string, number> } })
      .__u5reflow;
    const p = r ? r.probe() : null;
    return {
      mapScale: p?.["mapScale"] ?? 0,
      bandScale: p?.["bandScale"] ?? 0,
      canvasW: W,
      canvasH: H,
      y0,
      y1,
      filas,
      filasPie,
    };
  });
}

/** Llena la consola y entra en el scrollback por la rueda (mismo recurso que portrait-pulido). */
async function abrirHistorial(page: Page): Promise<void> {
  for (let i = 0; i < 24; i++) {
    await page.keyboard.press(i % 2 === 0 ? "ArrowRight" : "ArrowLeft");
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(400);
  const zona = await page.evaluate(() => {
    const cs = (Array.from(document.querySelectorAll("#app canvas")) as HTMLCanvasElement[])
      .filter((el) => !el.closest(".portrait-skin-src"))
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.right > 0 && b.bottom > 0 && b.left < window.innerWidth && b.top < window.innerHeight;
      });
    let c: HTMLCanvasElement | null = null;
    let area = 0;
    for (const el of cs) {
      const b = el.getBoundingClientRect();
      if (b.width * b.height > area) {
        area = b.width * b.height;
        c = el;
      }
    }
    if (!c) return null;
    const b = c.getBoundingClientRect();
    return { x: b.x + b.width * 0.75, y: b.y + b.height * 0.93 };
  });
  if (!zona) return;
  await page.mouse.move(zona.x, zona.y);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(700);
}

async function unaEscena(browser: Browser, e: Escena): Promise<Medida[]> {
  const ctx = await browser.newContext({
    viewport: { width: e.w, height: e.h },
    deviceScaleFactor: e.dpr,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.clear();
    (globalThis as unknown as { __name?: unknown }).__name ??= <T,>(f: T): T => f;
  });
  await page.goto(
    `${BASE}/?skin=faithful&nointro&reflow=cuadrado&loc=0&x=60&y=60&hour=10&seed=7&lang=es`,
  );
  await page.waitForFunction(
    () =>
      (window as unknown as { __u5test?: { worldReady?: () => boolean } }).__u5test?.worldReady?.() ===
      true,
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForSelector(".touch-controls", { timeout: 5_000 });
  await page.waitForTimeout(1200);

  const out: Medida[] = [];
  const sinScroll = await censar(page);
  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: join(SHOTS, `${e.id}.png`) });
  }
  out.push({ id: e.id, label: e.label, w: e.w, h: e.h, scroll: false, ...sinScroll });

  await abrirHistorial(page);
  const conScroll = await censar(page);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${e.id}-historial.png`) });
  out.push({ id: e.id, label: e.label, w: e.w, h: e.h, scroll: true, ...conScroll });

  await ctx.close();
  return out;
}

function tabla(m: Medida): void {
  const o = process.stdout;
  o.write(
    `\n══ ${m.label} · historial ${m.scroll ? "ON" : "off"} ══ canvas ${m.canvasW}×${m.canvasH}` +
      ` · mapScale ${m.mapScale} · bandScale ${m.bandScale}\n`,
  );
  const pinta = (fs: Fila[]): void => {
    for (const f of fs) {
      if (f.blancos === 0 && f.azules === 0) {
        o.write(`  y${String(f.y).padStart(4)}  ${f.negra ? "NEGRA ENTERA" : "(sin blanco)"}\n`);
        continue;
      }
      const pct = ((f.blancos / m.canvasW) * 100).toFixed(0);
      const tr =
        f.tramos.length <= 3 ?
          f.tramos.map(([a, b]) => `${a}…${b}`).join(" + ")
        : `${f.tramos.length} tramos (${f.tramos[0]![0]}…${f.tramos.at(-1)![1]})`;
      o.write(
        `  y${String(f.y).padStart(4)}  blancos ${String(f.blancos).padStart(4)}/${m.canvasW} (${pct}%)` +
          `  azules ${String(f.azules).padStart(4)}  ${tr}\n`,
      );
    }
  };
  o.write("── COSTURA mapa↔banda ─────────────────────────────────────\n");
  pinta(m.filas);
  o.write("── PIE de la banda (bajo los KPIs) ────────────────────────\n");
  pinta(m.filasPie);
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const out: Medida[] = [];
  for (const e of ESCENAS) {
    for (const m of await unaEscena(browser, e)) {
      out.push(m);
      tabla(m);
    }
  }
  await browser.close();
  if (OUT) {
    writeFileSync(OUT, JSON.stringify({ base: BASE, fecha: new Date().toISOString(), medidas: out }, null, 2));
    process.stdout.write(`\nJSON → ${OUT}\n`);
  }
}

void main();
