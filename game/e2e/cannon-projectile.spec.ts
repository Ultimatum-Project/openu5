/**
 * #313 — TEST DEL CAMINO del cañonazo: evento → pintor por el CANAL VIVO.
 *
 * El hueco que este spec cierra (y que el test unitario no puede): `cannon-projectile.test.ts`
 * prueba el EMISOR (§1), la CAPA (§2) y el pintor SHADER (§3) por separado — y el defecto
 * reportado en #313 vivía exactamente en el eslabón que los une: el evento `cell-projectile`
 * viajando por `applyEvents → notifyTurn → onTurn` de la piel hasta el `fillRect` del punto.
 * Aquí el disparo entra por la TECLA (F) y el aserto se lee del PÍXEL (espía de `fillRect`
 * instalada por `addInitScript`, antes de cargar el juego — sin ventana de muestreo).
 *
 * ESCENARIO ESTABLE (acta del carril canon-298: dos reglas + corolarios):
 *  · Calentar ANTES de sembrar, y con una tecla que NO mueve al grupo (Space = Pass):
 *    `ArrowUp` desmontaba la siembra —el cañón dejaba de ser adyacente— y `fireCannon()`
 *    sin cañón no falla: emite `["message"]` y el cero se leía como «no se pinta».
 *  · CONTROL DEL EMISOR EN LA MISMA CORRIDA (parche de instancia; main.ts hace lookup del
 *    método al llamar, así que entra): un cero sin este control no es adjudicable — no
 *    distingue «no se pinta» de «no se disparó».
 *  · ESPECIFICIDAD del detector: `fiel/combat.ts:450` pinta el MISMO 4×4 blanco. Aquí el
 *    discriminante es triple: no hay combate en el escenario, la fila es CONSTANTE y la x
 *    AVANZA hacia el este (la geometría sembrada) — el vecino no puede producir eso.
 *
 * Geometría (derivada, CMDS.OVL): a pie el vuelo sale de la celda del CAÑÓN (0x0BAD/0x0BB9)
 * — sembrado 0xb5 al este (tile&3=1 → dispara E) vuela {1,0}→{5,0}; la andanada sale del
 * BARCO (push 5/push 5) y sin objetivo llega al final del rayo: {0,0}→{3,0}.
 */
import { test, expect, type Page } from "@playwright/test";
import { skinCycleReady, waitWorldReady } from "./helpers";

type Dot = { x: number; y: number; w: number };

/** Boot con piel ELEGIDA. No usa `gotoGame` porque ése antepone `skin=faithful` y
 *  `URLSearchParams.get` devuelve el PRIMER valor (mismo motivo que `shader-skin.spec.ts`):
 *  se navega a mano reusando su patrón (localStorage limpio + worldReady). */
async function bootJuego(page: Page, skin: "faithful" | "shader", coords: string): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?" + [`skin=${skin}`, "nointro", coords, "hour=10", "seed=777"].join("&"));
  await waitWorldReady(page);
}

/** Espía de píxel: registra los fillRect CUADRADOS blancos (el glifo del proyectil en las
 *  dos pieles: 4×4 lógico en la fiel; `max(1, round(4/16·celda))` en device-px en la shader).
 *  Se instala ANTES de cargar el juego. */
async function armarEspiaDePixel(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __dots: Dot[] }).__dots = [];
    const orig = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
      if (w === h && w >= 1 && w <= 24 && String(this.fillStyle).toLowerCase() === "#ffffff") {
        (window as unknown as { __dots: Dot[] }).__dots.push({ x, y, w });
      }
      return orig.call(this, x, y, w, h);
    };
  });
}

/** Calienta (Space: Pass, no mueve al grupo) — la piel ya montó (`skinCycleReady`) y este
 *  turno de mundo garantiza el ciclo entero suscrito ANTES de sembrar. */
async function calentar(page: Page): Promise<void> {
  await skinCycleReady(page);
  await page.keyboard.press(" ");
}

/** Parche de INSTANCIA del emisor: control positivo en la MISMA corrida. */
async function armarControlDelEmisor(page: Page, metodo: "fireCannon" | "fire"): Promise<void> {
  await page.evaluate((name) => {
    const w = window as unknown as { __u5test: { game: Record<string, (...a: unknown[]) => { kind: string }[] > }; __fireOut: string[] | null };
    w.__fireOut = null;
    const g = w.__u5test.game;
    // `noUncheckedIndexedAccess`: el índice por variable sobre el Record tipa como
    // posiblemente-undefined. El guard conserva el desenlace en runtime (sin él, el
    // `.bind` sobre undefined ya lanzaba TypeError y el test fallaba igual): solo lo
    // hace tipable y con mensaje legible. NO cambia ningún aserto.
    const metodo = g[name];
    if (metodo === undefined) throw new Error(`__u5test.game.${name} no existe: el control del emisor no puede armarse`);
    const orig = metodo.bind(g);
    g[name] = (...a: unknown[]) => {
      const ev = orig(...a);
      w.__fireOut = ev.map((e) => e.kind);
      return ev;
    };
  }, metodo);
}

const emisorEmitio = (page: Page) =>
  page.evaluate(() => (window as unknown as { __fireOut: string[] | null }).__fireOut);

const dotsNuevos = (page: Page, desde: number) =>
  page.evaluate((n) => (window as unknown as { __dots: Dot[] }).__dots.slice(n), desde);

/** El aserto del CAMINO: puntos del ancho esperado, fila CONSTANTE, x que AVANZA al este. */
function afirmaVuelo(dots: Dot[], anchoMin: number, anchoMax: number): void {
  const balas = dots.filter((d) => d.w >= anchoMin && d.w <= anchoMax);
  expect(balas.length).toBeGreaterThan(2); // varios fotogramas del vuelo, no un blit suelto
  const filas = new Set(balas.map((d) => Math.round(d.y)));
  expect(filas.size).toBe(1); // vuelo horizontal: una sola fila
  const xs = balas.map((d) => d.x);
  expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(8); // y la x recorre camino
}

async function canonAPie(page: Page, skin: "faithful" | "shader"): Promise<Dot[]> {
  await armarEspiaDePixel(page);
  await bootJuego(page, skin, "loc=1&x=15&y=15");
  await calentar(page);
  await page.evaluate(() => {
    const g = (window as unknown as { __u5test: { game: { state: { position: { x: number; y: number } }; setVolatileTerrain: (x: number, y: number, t: number) => void } } }).__u5test.game;
    const p = g.state.position;
    g.setVolatileTerrain(p.x + 1, p.y, 0xb5); // cañón al este, DESPUÉS de calentar
  });
  await armarControlDelEmisor(page, "fireCannon");
  const antes = await page.evaluate(() => (window as unknown as { __dots: Dot[] }).__dots.length);
  await page.keyboard.press("f");
  await expect.poll(() => emisorEmitio(page)).toContain("cell-projectile"); // el disparo OCURRIÓ
  await page.waitForTimeout(500); // vuelo = 4 celdas × 55 ms + margen
  return dotsNuevos(page, antes);
}

async function andanada(page: Page, skin: "faithful" | "shader"): Promise<Dot[]> {
  await armarEspiaDePixel(page);
  await bootJuego(page, skin, "loc=0&x=250&y=120");
  await calentar(page);
  await page.evaluate(() => {
    const w = window as unknown as { __u5test: { game: { state: { position: { location: number; floor: number; x: number; y: number } } }; addWorldObject: (o: unknown) => void } };
    const p = w.__u5test.game.state.position;
    w.__u5test.addWorldObject({
      location: p.location, floor: p.floor, x: p.x, y: p.y,
      tile: 0x24 + 0x100, kind: "ship", hull: 99, skiffs: 1, // fragata quilla N/S → dispara E/O
    });
  });
  await page.keyboard.press("b"); // (B)oard
  await expect.poll(() => page.evaluate(() => (window as unknown as { __u5test: { game: { state: { transportTile?: number } } } }).__u5test.game.state.transportTile)).toBe(0x24);
  await armarControlDelEmisor(page, "fire");
  const antes = await page.evaluate(() => (window as unknown as { __dots: Dot[] }).__dots.length);
  await page.keyboard.press("f"); // Fire- → getdir
  await page.keyboard.press("ArrowRight"); // perpendicular a la quilla
  await expect.poll(() => emisorEmitio(page)).toContain("cell-projectile");
  await page.waitForTimeout(450); // vuelo = 3 celdas × 55 ms + margen
  return dotsNuevos(page, antes);
}

test("cañón a pie · piel FIEL: la tecla F pinta el punto 4×4 que recorre el vuelo", async ({ page }) => {
  const dots = await canonAPie(page, "faithful");
  afirmaVuelo(dots, 4, 4); // el glifo lógico de la fiel es EXACTAMENTE 4×4
});

test("cañón a pie · piel SHADER: el punto se recompone en device-px sobre el viewport", async ({ page }) => {
  const dots = await canonAPie(page, "shader");
  // El pintor shader escala el glifo: > 4 px de lado con este viewport (1280×800). Los 4×4
  // del canvas fiel oculto también existen; el aserto exige la superficie SHADER.
  afirmaVuelo(dots, 5, 24);
});

test("andanada · piel FIEL: el vuelo sale del barco al final del rayo y se pinta", async ({ page }) => {
  const dots = await andanada(page, "faithful");
  afirmaVuelo(dots, 4, 4);
});

test("andanada · piel SHADER: el vuelo se recompone en device-px sobre el viewport", async ({ page }) => {
  const dots = await andanada(page, "shader");
  afirmaVuelo(dots, 5, 24);
});
