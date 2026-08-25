/**
 * CAREO VISUAL — captura del PORT compas a compas (metodo estrenado en ch01).
 *
 * Conduce la piel FIEL por la lista de compases derivada del video de referencia
 * (`compases-lf01.json`) y vuelca, tras cada compas, el canvas LOGICO 320x200 SIN
 * escalar — la misma resolucion nativa a la que se reduce el fotograma del video,
 * para que el par sea comparable pixel a pixel sin reescalar ninguno de los dos.
 *
 * Reutiliza el patron ya sancionado de `tools/pixeldiff/capture-port.pw.ts`
 * (`.faithful-skin canvas` + `toDataURL`), que es el unico sitio del repo que
 * fotografia el bufer nativo: `querySelector("canvas")` devuelve un ornamento 8x8
 * (src/ui/screenshot.ts).
 *
 * CONTROL POSITIVO (obligatorio, encargo). DOS siembras, y la diferencia entre ellas
 * es justo lo que hay que medir:
 *   · CAREO_SIEMBRA=cofre — siembra un COFRE (tile 0x40, kind "chest") DOS casillas al este
 *     del avatar con `__u5test.addWorldObject`, el mismo gesto de `e2e/objects.spec.ts`
 *     sobre esta misma location 13. Es divergencia VISUAL PURA: aparece un sprite en el
 *     viewport y NO se escribe ni una linea de consola. Si la hoja no la caza, la hoja
 *     NO VE — que es exactamente lo que este careo existe para descartar. MEDIDO: 1 celda
 *     de viewport (~220 px) mas los 5 apliques 0xb0/0xb1/0xbf, que son tiles ANIMADOS.
 *   · 🔴 CAREO_SIEMBRA=cofre-muro — el MISMO cofre en (-3,-3), que era el DEFECTO hasta el
 *     25-08 y NO es una divergencia visual pura: (-3,-3) desde el arranque (15,15) cae en
 *     (12,12), que es una casilla del PROPIO MURO de la choza. La capa de objetos TAPA el
 *     tile base (`Game.activeMap.tileAt`), asi que sembrar ahi BORRA EL MURO — abre un
 *     agujero por el que sale el flood de LOS y, de dia (luz 0x32, que cubre toda la tabla
 *     radial), enciende las 52 casillas negras del exterior de golpe. De ahi salio la ficha
 *     F4 («el port pinta hierba donde el original pinta negro»), REFUTADA el 25-08: el port
 *     sin sembrar pinta el MISMO anillo negro que el original. La mecanica queda fijada en
 *     `game/tests/careo-f4-cofre-sobre-muro.test.ts`. Se conserva por eso, con su nombre.
 *   · CAREO_SIEMBRA=xshift — arranca una casilla a la derecha. NO sirve como control del
 *     canal visual: MEDIDO, tambien cambia el texto (aparecen «Blocked!» que el original
 *     no tiene), asi que la caza el espejo de consola que ya teniamos y no prueba nada
 *     nuevo. Se conserva como contraste declarado.
 *
 * Uso (desde game/, REGLA 3: puerto propio 52xx, NUNCA el 5199 del usuario):
 *   CAREO_PORT=5243 npx playwright test -c tools/careo-visual/captura.config.ts
 *   CAREO_PORT=5243 CAREO_SIEMBRA=xshift CAREO_OUT=<dir> npx playwright test -c …
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { promises as fs } from "node:fs";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.CAREO_OUT ?? path.join(HERE, "_out");
const SIEMBRA = process.env.CAREO_SIEMBRA ?? "";

interface Paso {
  id: string;
  keys: string[];
  eco?: string;
  nota?: string;
  video_t?: number;
}
const GUION = JSON.parse(
  readFileSync(path.join(HERE, "compases-lf01.json"), "utf-8"),
) as { pasos: Paso[] };

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

async function consola(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const h = (window as unknown as Record<string, unknown>).__u5test as
      | { consoleLines?: () => string[] }
      | undefined;
    return h?.consoleLines?.() ?? [];
  });
}

test("careo visual ch01 — captura del port por compases", async ({ page }) => {
  await fs.mkdir(OUT, { recursive: true });
  await page.addInitScript(() => localStorage.clear());

  // La siembra del control positivo desplaza UNA CASILLA el arranque (deep-link DEV).
  // Iolo's Hut = loc 13; la plantilla INIT deja al avatar en (15,15) de ese mapa.
  const extra = SIEMBRA === "xshift" ? "&loc=13&x=16&y=15" : "";
  await page.goto(`/?skin=faithful&nointro&seed=1&fresh=1${extra}`);
  const canvas = await faithfulCanvas(page);
  await page.waitForTimeout(700);

  if (SIEMBRA.startsWith("cofre")) {
    // El tipo va en una const con tupla EXPLÍCITA: escrito en la llamada, `[2, 0]` se infiere
    // como `number[]` y el overload de `page.evaluate` no casa con el parámetro tipado.
    // 🔴 El DEFECTO es (+2,0), no (-3,-3): (-3,-3) cae sobre el MURO de la choza y la capa
    // de objetos lo BORRA (ver cabecera, `cofre-muro`). `cofre-dentro` se conserva como
    // alias del defecto para no romper los encargos que ya lo nombran.
    const DESPLAZAMIENTO: [number, number] =
      SIEMBRA === "cofre-muro" ? [-3, -3] : [2, 0];
    // Divergencia VISUAL PURA: un sprite mas en el viewport, cero lineas de consola.
    await page.evaluate((arg: { off: [number, number] }) => {
      const { off } = arg;
      const w = window as unknown as {
        __u5test: {
          game: { state: { position: { location: number; floor: number; x: number; y: number } } };
          addWorldObject: (o: unknown) => void;
        };
      };
      const p = w.__u5test.game.state.position;
      // Tupla, no `number[]`: con `noUncheckedIndexedAccess` un array desestructurado da
      // `number | undefined` y `p.x + dx` no typechequea. El tipo dice la verdad —siempre se
      // pasa un par— en vez de taparlo con `?? 0`, que fabricaría un desplazamiento silencioso.
      const [dx, dy] = off;
      w.__u5test.addWorldObject({
        location: p.location, floor: p.floor, x: p.x + dx, y: p.y + dy,
        tile: 0x40, kind: "chest", contents: 0x63, trapped: false,
      });
    }, { off: DESPLAZAMIENTO });
    await page.waitForTimeout(250);
  }

  const filas: Array<Record<string, unknown>> = [];
  for (const paso of GUION.pasos) {
    for (const k of paso.keys) {
      await page.keyboard.press(k);
      await page.waitForTimeout(180);
    }
    await page.waitForTimeout(320); // asentado
    const png = path.join(OUT, `${paso.id}.png`);
    await dump(canvas, png);
    const lineas = await consola(page);
    filas.push({
      id: paso.id,
      keys: paso.keys,
      eco_esperado: paso.eco ?? null,
      video_t: paso.video_t ?? null,
      png: path.basename(png),
      consola: lineas.slice(-8),
    });
    // eslint-disable-next-line no-console
    console.log(`  ${paso.id}  keys=[${paso.keys.join(",")}]  ultima="${lineas.at(-1) ?? ""}"`);
  }

  await fs.writeFile(
    path.join(OUT, "port.json"),
    JSON.stringify({ siembra: SIEMBRA || null, filas }, null, 1),
  );
  expect(filas.length).toBe(GUION.pasos.length);
});
