/**
 * BANCO DEL CARRIL portrait-polish (encargos A, B y C del usuario, 01-08).
 *
 * Fotografía el MISMO estado en dos servidores —uno sirviendo `main` (PRE) y otro la rama
 * (POST)— para que el careo sea de píxeles y no de memoria, y produce además las dos
 * variantes de la BANDA AZUL (`izq` y `full`) en las DOS pieles, que es lo que el usuario
 * tiene que elegir con el ojo.
 *
 *   U5_PRE=5232 U5_POST=5231 OUT=<dir> npx tsx tools/portrait-polish/capturar.mts
 *
 * Cada captura lleva SU MEDIDA al lado (metricas.json): alturas de las tres cajas
 * —jugadores, KPIs y log— en px CSS, leídas de la geometría VIVA, no del descriptor.
 *
 * REGLAS DEL CARRIL: servidores PROPIOS en 52xx (jamás el 5199 del usuario).
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PRE = `http://localhost:${process.env.U5_PRE ?? "5232"}`;
const POST = `http://localhost:${process.env.U5_POST ?? "5231"}`;
const OUT = process.env.OUT ?? "/tmp/portrait-polish";
const VIEWPORT = { width: 393, height: 852 };

/**
 * Medición CRUDA de la banda: los tramos BLANCOS (= filos de caja) de una columna de
 * píxeles en cada mitad, en filas de la BANDA (0..103, unidades de la fuente 320×200).
 *
 * Se vuelca crudo A PROPÓSITO. Una primera versión intentaba etiquetar los tramos
 * («jugadores», «KPIs») por su ÍNDICE en la lista, y la etiqueta bailaba entre variantes
 * porque el número de tramos cambia con la banda azul y con el separador: daba cifras que
 * parecían medidas y eran ruido. El instrumento se queda con lo que sabe leer sin
 * interpretar; el reparto en cajas lo hace el acta, que puede citar la fila fuente.
 */
interface Cajas {
  /** Tramos blancos [inicio, fin] en FILAS DE BANDA de la columna izquierda. */
  filosIzq: Array<[number, number]>;
  /** Ídem en la columna del log. */
  filosLog: Array<[number, number]>;
  canvasW: number;
  canvasH: number;
  bandScale: number;
  mapScale: number;
}

async function medir(page: Page): Promise<Cajas | null> {
  return page.evaluate(() => {
    const cv = document.querySelector<HTMLCanvasElement>(".portrait-skin canvas");
    const probe = (
      window as unknown as { __u5reflow?: { probe: () => Record<string, unknown> | null } }
    ).__u5reflow?.probe();
    if (!cv || !probe) return null;
    const g = cv.getContext("2d");
    if (!g) return null;
    const W = cv.width;
    const H = cv.height;
    // Techo de la banda en px de BACKBUFFER (la sonda da px CSS; el canvas puede ir a dpr).
    const k = H / (probe.canvasH as number);
    const sb = probe.bandScale as number;
    // Techo de la banda DERIVADO DEL MAPA (bloque 192 + hueco 2, en escala de mapa), no
    // restándolo del fondo del lienzo: con la banda azul de abajo puesta, el lienzo crece
    // y el «fondo menos 104·sb» desplazaba todas las filas ~10 unidades sin avisar.
    const bandaY = (192 + 2) * (probe.mapScale as number) * k;
    // Una columna de píxeles en cada mitad, lo bastante adentro para no caer ni en la
    // banda azul perimetral ni en el filo de la caja.
    const salida: Array<Array<[number, number]>> = [];
    for (const x of [Math.round(W * 0.25), Math.round(W * 0.8)]) {
      const y0 = Math.round(bandaY);
      const d = g.getImageData(x, y0, 1, H - y0).data;
      const tramos: Array<[number, number]> = [];
      let a = -1;
      for (let i = 0; i <= H - y0; i++) {
        const o = i * 4;
        const blanco = i < H - y0 && d[o]! > 200 && d[o + 1]! > 200 && d[o + 2]! > 200;
        if (blanco && a < 0) a = i;
        if (!blanco && a >= 0) {
          // A filas de BANDA (fuente), redondeadas a 2 decimales.
          tramos.push([
            Math.round(((y0 + a - bandaY) / (sb * k)) * 100) / 100,
            Math.round(((y0 + i - bandaY) / (sb * k)) * 100) / 100,
          ]);
          a = -1;
        }
      }
      salida.push(tramos);
    }
    return {
      filosIzq: salida[0]!,
      filosLog: salida[1]!,
      canvasW: probe.canvasW as number,
      canvasH: probe.canvasH as number,
      bandScale: sb,
      mapScale: probe.mapScale as number,
    };
  });
}

async function press(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(110);
}

/** Deja el log con tráfico (para que el historial tenga qué enseñar). */
async function ruido(page: Page): Promise<void> {
  for (const k of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
    for (let i = 0; i < 3; i++) await press(page, k);
  }
}

interface Toma {
  id: string;
  base: string;
  skin: "faithful" | "shader";
  query: string;
  historial: boolean;
  nota: string;
}

const TOMAS: Toma[] = [
  // A y B — careo PRE (main) / POST (rama), piel fiel, con y sin historial.
  { id: "A1-PRE-historial", base: PRE, skin: "faithful", query: "", historial: true,
    nota: "BUG A · main: la línea del techo de la banda pisa el banner ►HISTORIAL◄" },
  { id: "A2-POST-historial", base: POST, skin: "faithful", query: "&banda=off", historial: true,
    nota: "BUG A · rama: la línea vive en el hueco; el banner sale entero" },
  { id: "B1-PRE-mundo", base: PRE, skin: "faithful", query: "", historial: false,
    nota: "B · main: bajo los KPIs quedan 16 filas de relleno AZUL hasta el fondo del log" },
  { id: "B2-POST-mundo", base: POST, skin: "faithful", query: "&banda=off", historial: false,
    nota: "B · rama (sin banda): la caja de jugadores se come esas 16 filas y los KPIs bajan" },
  // C — las dos variantes de banda azul, en las dos pieles.
  { id: "C1-izquierda-fiel", base: POST, skin: "faithful", query: "&banda=izq", historial: false,
    nota: "C · IZQUIERDA (defecto): la banda azul del mapa baja por el flanco de jugadores/KPIs" },
  { id: "C2-completa-fiel", base: POST, skin: "faithful", query: "&banda=full", historial: false,
    nota: "C · COMPLETA: además por la derecha del log y por abajo" },
  { id: "C3-izquierda-shader", base: POST, skin: "shader", query: "&banda=izq", historial: false,
    nota: "C · IZQUIERDA con la piel SHADER alojada" },
  { id: "C4-completa-shader", base: POST, skin: "shader", query: "&banda=full", historial: false,
    nota: "C · COMPLETA con la piel SHADER alojada" },
  // Control del careo: la rama con la banda apagada y sin historial ya está arriba (B2);
  // aquí, la rama con banda IZQUIERDA y el historial puesto (el caso que juntó A y C).
  { id: "C5-izquierda-historial", base: POST, skin: "faithful", query: "&banda=izq", historial: true,
    nota: "C+A · banda izquierda con el historial abierto" },
];

async function tomar(browser: Browser, t: Toma): Promise<Record<string, unknown>> {
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.clear());
  await page.goto(
    `${t.base}/?skin=${t.skin}&nointro&loc=0&x=60&y=60&hour=10&seed=7&lang=es` +
      `&reflow=cuadrado-force&deck=bloques${t.query}`,
  );
  await page.waitForFunction(
    () =>
      (
        window as unknown as { __u5test?: { worldReady?: () => boolean } }
      ).__u5test?.worldReady?.() === true,
    undefined,
    { timeout: 25_000 },
  );
  await page.waitForTimeout(900);
  await ruido(page);
  if (t.historial) {
    const box = await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>(".portrait-skin canvas")!;
      const b = c.getBoundingClientRect();
      return { l: b.left, t: b.top, w: b.width, h: b.height };
    });
    await page.mouse.move(box.l + box.w * 0.75, box.t + box.h - 40);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(300);
  const cajas = await medir(page);
  await page.screenshot({ path: join(OUT, `${t.id}.png`) });
  // Recorte de la BANDA (lo que hay que mirar): del techo de la banda al fondo.
  const rec = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>(".portrait-skin canvas")!;
    const b = c.getBoundingClientRect();
    const p = (
      window as unknown as { __u5reflow?: { probe: () => Record<string, unknown> | null } }
    ).__u5reflow!.probe()!;
    const bandaH = 104 * (p.bandScale as number) + 12;
    return { x: b.left, y: b.top + b.height - bandaH, width: b.width, height: bandaH };
  });
  await page.screenshot({ path: join(OUT, `${t.id}__banda.png`), clip: rec });
  await ctx.close();
  process.stdout.write(`· ${t.id}: ${JSON.stringify(cajas)}\n`);
  return { ...t, cajas };
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const metricas: Array<Record<string, unknown>> = [];
  try {
    for (const t of TOMAS) metricas.push(await tomar(browser, t));
  } finally {
    await browser.close();
  }
  writeFileSync(join(OUT, "metricas.json"), JSON.stringify(metricas, null, 2));
  console.log(`\n${metricas.length} tomas en ${OUT}`);
}
void main();
