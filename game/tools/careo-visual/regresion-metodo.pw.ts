/**
 * BATERÍA DE REGRESIÓN DEL MÉTODO — mitad de ESCENAS (la que necesita el port vivo).
 *
 * La otra mitad, la de los INSTRUMENTOS, es `test_careolib.py` y corre en la batería de
 * aterrizaje en ~1,6 s sin navegador. Ésta no puede: conduce la piel fiel de verdad, así
 * que se lanza a mano y su veredicto de píxeles lo da `adjudica.py` (un solo instrumento
 * para los dos regímenes: `careolib`).
 *
 * LA PREGUNTA, IGUAL QUE EN LA OTRA MITAD: **¿sigue el método cazando lo que una vez
 * cazó?** No «¿pasa el port?». Un careo que envejece se vuelve ciego en silencio y su
 * informe sigue diciendo «cero divergencias».
 *
 * ESCENAS (canal · régimen declarados; la matriz completa está en `test_careolib.py`):
 *   · `base` / `base2`  — NEGATIVO · ralo. Dos corridas IDÉNTICAS. Su diferencia es el
 *     SUELO de no-determinismo del port, y sin ella las diferencias brutas se leen al
 *     revés (artefacto A4: los 28 tiles de agua que parecían la siembra).
 *   · `cofre`           — visual puro · ralo. Un sprite más en el viewport y CERO líneas
 *     de consola: la clase entera a la que el espejo de texto es ciego por construcción.
 *   · `cofre-muro`      — NEGATIVO · ralo. La siembra que produjo la ficha F4 (REFUTADA).
 *     Ya no se captura: la GUARDA la rechaza, y este test comprueba que la rechaza. Un
 *     careo que la deje pasar volverá a fabricar la misma divergencia inexistente.
 *
 * Las siembras de CADENCIA (`pulso-corto`, `orden-cambiado`, puerta lunar) viven en
 * `captura-densa*.pw.ts` porque necesitan grabación a rAF; `adjudica.py` las adjudica con
 * el mismo instrumento. Ninguna toca el árbol: todas van por `page.route` o por
 * `__u5test`, así que no pueden quedarse puestas.
 *
 * Uso (REGLA 3: puerto propio 52xx CENSADO con `lsof -ti` ANTES):
 *   CAREO_PORT=5247 CAREO_OUT=<dir> npx playwright test -c tools/careo-visual/regresion.config.ts
 *   python3 tools/careo-visual/adjudica.py <dir>
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.CAREO_OUT ?? path.join(HERE, "_out-regresion");

/**
 * ★★ EL MUTANTE, SEMBRADO DENTRO DEL PROPIO ARNÉS (precedente: `test_puerta_pytest.py`).
 * `CAREO_MUTANTE=sin-siembra` corre la escena `cofre` **sin sembrar el cofre** y la rotula
 * igual. La cadena entera —arnés, `careolib`, `adjudica.py`— tiene que decir entonces que
 * NO CAZÓ y salir con 1. Sin este gesto, «todos los controles verdes» es indistinguible de
 * «el adjudicador dice que sí a todo»: un control que nadie ha visto enrojecer no es un
 * control. Se ejecuta a mano, no en cada corrida, porque el rojo es el resultado ESPERADO.
 */
const MUTANTE = process.env.CAREO_MUTANTE ?? "";

/** Iolo's Hut = loc 13; la plantilla INIT deja al Avatar en (15,15). */
const ESCENA = "/?skin=faithful&nointro&seed=1&fresh=1&loc=13&x=15&y=15";

async function faithfulCanvas(page: Page): Promise<Locator> {
  const canvas = page.locator(".faithful-skin canvas");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(canvas).toHaveAttribute("width", "320");
  await expect(canvas).toHaveAttribute("height", "200");
  return canvas;
}

async function dump(canvas: Locator, file: string): Promise<void> {
  const d = await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL("image/png"));
  await fs.writeFile(file, Buffer.from(d.replace(/^data:image\/png;base64,/, ""), "base64"));
}

const consola = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const h = (window as unknown as Record<string, unknown>).__u5test as
      | { consoleLines?: () => string[] }
      | undefined;
    return h?.consoleLines?.() ?? [];
  });

/** Tile base BAJO una casilla del mapa activo, ANTES de sembrar nada encima. */
const tileEn = (page: Page, dx: number, dy: number): Promise<number> =>
  page.evaluate(
    (off: { dx: number; dy: number }) => {
      const w = window as unknown as {
        __u5test: {
          game: {
            activeMap: { tileAt: (x: number, y: number) => number };
            state: { position: { x: number; y: number } };
          };
        };
      };
      const p = w.__u5test.game.state.position;
      return w.__u5test.game.activeMap.tileAt(p.x + off.dx, p.y + off.dy);
    },
    { dx, dy },
  );

async function siembraCofre(page: Page, dx: number, dy: number): Promise<void> {
  await page.evaluate(
    (off: { dx: number; dy: number }) => {
      const w = window as unknown as {
        __u5test: {
          game: { state: { position: { location: number; floor: number; x: number; y: number } } };
          addWorldObject: (o: unknown) => void;
        };
      };
      const p = w.__u5test.game.state.position;
      w.__u5test.addWorldObject({
        location: p.location,
        floor: p.floor,
        x: p.x + off.dx,
        y: p.y + off.dy,
        tile: 0x40,
        kind: "chest",
        contents: 0x63,
        trapped: false,
      });
    },
    { dx, dy },
  );
  await page.waitForTimeout(250);
}

/**
 * 🔴 LA GUARDA QUE HABRÍA EVITADO LA FICHA F4 ENTERA.
 * `ALWAYS_OPAQUE` de `core/world/visibility.ts` (DATA.OVL 0x6A86) es la lista de tiles que
 * cortan la vista. La capa de objetos del port TAPA el tile base, así que sembrar sobre uno
 * de ellos no añade un objeto: BORRA EL MURO, abre un agujero de LOS y de día enciende las
 * 52 casillas negras del exterior de golpe. Eso es lo que se documentó durante un día como
 * «el port pinta hierba donde el original pinta negro» y costó un carril refutar.
 * Se lee del MÓDULO, no de una lista copiada aquí: una copia diverge y nadie lo nota.
 */
async function esOpaco(page: Page, tile: number): Promise<boolean> {
  return page.evaluate(async (t: number) => {
    // 🔴 El especificador va en una CONST, no escrito en el `import()`. Con el literal,
    // `tsconfig.tools.json` intenta resolver `/src/…` como ruta de módulo TS y da
    // TS2307 «Cannot find module» — un rojo de TYPECHECK por una ruta que sólo existe
    // en tiempo de ejecución (es la URL que sirve vite, y este cuerpo corre en el
    // NAVEGADOR, no en Node). Con la const, TS no resuelve el especificador y el import
    // sigue siendo el mismo en vivo: se lee `ALWAYS_OPAQUE` DEL MÓDULO, que es el punto.
    const RUTA = "/src/core/world/visibility.ts";
    const mod = (await import(RUTA)) as { ALWAYS_OPAQUE: Set<number> };
    return mod.ALWAYS_OPAQUE.has(t & 0xff);
  }, tile);
}

interface Fila {
  escena: string;
  canal: string;
  regimen: string;
  png: string;
  consola: string[];
  nota?: string;
}
const filas: Fila[] = [];

/**
 * 🔴 GUION COMÚN, y no es un detalle de conveniencia — es lo que hace medible el canal de
 * consola. MEDIDO al estrenar esta batería: recién arrancada la escena, `consoleLines()`
 * devuelve **0 líneas**, así que un «la consola no se movió» comparado en el arranque
 * habría sido `[] === []`: verde con el canal muerto. El control positivo lo cazó a la
 * primera. La consola sólo dice algo cuando el juego ha hecho algo, así que TODAS las
 * escenas corren el MISMO guion y se comparan entre sí — que es como funcionaba el control
 * original de ch01 (14 compases, consola idéntica en 14/14).
 */
const GUION: readonly string[] = ["ArrowUp"];

async function corre(page: Page): Promise<void> {
  for (const k of GUION) {
    await page.keyboard.press(k);
    await page.waitForTimeout(180);
  }
  await page.waitForTimeout(320); // asentado, igual que `captura-port.pw.ts`
}

async function captura(page: Page, escena: string, canal: string, regimen: string): Promise<void> {
  const canvas = await faithfulCanvas(page);
  const png = `${escena}.png`;
  await dump(canvas, path.join(OUT, png));
  filas.push({ escena, canal, regimen, png, consola: (await consola(page)).slice(-8) });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await fs.mkdir(OUT, { recursive: true });
});

test("base — la corrida de referencia", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(ESCENA);
  await faithfulCanvas(page);
  await page.waitForTimeout(900);
  await corre(page);
  await captura(page, "base", "—", "ralo");
  // CONTROL POSITIVO DEL CANAL DE CONSOLA: sin líneas, el careo de consola de las escenas
  // siguientes sería `[] === []` — verde con el canal muerto.
  const l = filas[filas.length - 1]!.consola;
  expect(l.length, "consoleLines() no devuelve nada: el careo de consola sería vacuo").toBeGreaterThan(0);
});

test("base2 — el SUELO de no-determinismo (artefacto A4)", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(ESCENA);
  await faithfulCanvas(page);
  await page.waitForTimeout(900);
  await corre(page);
  await captura(page, "base2", "—", "ralo");
  // Dos corridas IDÉNTICAS tienen que dar la MISMA consola. Si no, el canal de consola
  // tiene su propio suelo y hay que declararlo antes de usarlo para adjudicar nada.
  const base = filas.find((f) => f.escena === "base")!;
  expect(filas[filas.length - 1]!.consola).toEqual(base.consola);
});

test("cofre — canal VISUAL PURO, régimen ralo: un tile y CERO líneas de consola", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(ESCENA);
  await faithfulCanvas(page);
  await page.waitForTimeout(900);

  // La guarda se ejerce ANTES de sembrar, sobre la casilla de destino real.
  const destino = await tileEn(page, 2, 0);
  expect(await esOpaco(page, destino), `(+2,0) = 0x${destino.toString(16)} debe ser transparente`).toBe(false);

  if (MUTANTE === "sin-siembra") {
    // eslint-disable-next-line no-console
    console.log("MUTANTE sin-siembra: la escena `cofre` va SIN cofre. adjudica.py DEBE salir 1.");
  } else {
    await siembraCofre(page, 2, 0);
  }
  await corre(page);
  await captura(page, "cofre", "visual puro", "ralo");
  // ★★ La mitad que hace que este control valga: la consola NO se mueve respecto a `base`.
  // Si se moviera, lo cazaría el espejo de texto que ya teníamos y no probaría nada del
  // canal visual — que es exactamente por qué `xshift` fue descartado como control.
  const base = filas.find((f) => f.escena === "base")!;
  expect(filas[filas.length - 1]!.consola).toEqual(base.consola);
});

test("cofre-muro — NEGATIVO: la guarda RECHAZA la siembra sobre el muro (ficha F4)", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(ESCENA);
  await faithfulCanvas(page);
  await page.waitForTimeout(900);

  // (−3,−3) desde (15,15) = (12,12): una casilla del PROPIO MURO de la choza.
  const destino = await tileEn(page, -3, -3);
  expect(destino & 0xff).toBe(0x4d); // roca — MEDIDO en vivo, esperado en crudo
  expect(await esOpaco(page, destino)).toBe(true);
  filas.push({
    escena: "cofre-muro",
    canal: "negativo",
    regimen: "ralo",
    png: "",
    consola: [],
    nota: `RECHAZADA por la guarda: destino 0x${(destino & 0xff).toString(16)} ∈ ALWAYS_OPAQUE`,
  });
});

test.afterAll(async () => {
  await fs.writeFile(path.join(OUT, "escenas.json"), JSON.stringify({ filas }, null, 1));
});
