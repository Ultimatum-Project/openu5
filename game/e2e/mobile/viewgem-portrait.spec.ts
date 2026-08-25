/**
 * (V)iew Gem en PORTRAIT TÁCTIL con la piel POR DEFECTO — ficha #247.
 *
 * RÉGIMEN DEL REPORTE (captura `viewgem-sin-mapa`, 13-08): iPhone portrait, sala de la
 * Llama de la Verdad del Lycaeum (planta 2, 15,9 — el momento de Faulinei), gemas en la
 * bolsa. El log imprimía «View a gem!» y no aparecía ninguna vista.
 *
 * ★★ LA PIEL SE DEJA AL DEFECTO A PROPÓSITO, Y ES LA MITAD DEL VALOR DE ESTA SONDA. La
 * primera pasada forzó `?skin=faithful` y NO reprodujo nada: la vista salía perfecta. El
 * defecto vivía en la piel SHADER, que es la que arranca de fábrica (`main.ts`:
 * `initialSkin` cae a "shader" sin preferencia ni parámetro). Un arnés que fija la piel
 * mide la piel que el arnés eligió, no la que ve el jugador.
 *
 * Los DOS discriminantes del triaje, medidos por separado porque son fichas distintas:
 *   (a) ¿el comando LLEGA al motor?  → gema consumida + eco + `inputSinks().gemView`
 *   (b) ¿llega y NO PINTA?           → el viewport del canvas REPINTA (salida del pintor)
 * En #247 (a) salió verde y (b) rojo: el mando llegaba, el modal se abría y se tragaba el
 * teclado, la gema se gastaba — y el jugador seguía viendo la habitación.
 */
import { test, expect, type Page } from "@playwright/test";

/** Lycaeum planta 2, casilla de la Llama (FLAME_* de core/quest/ritual.ts, idx 0). */
const URL_FAULINEI = "/?nointro&loc=30&floor=2&x=15&y=9";

interface Foto {
  gems: number;
  ecos: number;
  vistaAbierta: boolean;
}

async function foto(page: Page): Promise<Foto> {
  return page.evaluate(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const t = (window as any).__u5test;
    return {
      gems: t.state().gems as number,
      ecos: (t.consoleLines() as string[]).filter((l) => l.includes("View a gem!")).length,
      vistaAbierta: t.inputSinks().gemView === true,
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });
}

/**
 * Rectángulo del VIEWPORT (lógico 8,8–184,184 sobre 320×200) dentro del canvas VISIBLE,
 * en píxeles de su backbuffer. El canvas se RESUELVE, no se cablea: el envoltorio
 * portrait aloja fiel o shader según la preferencia y cada una monta el suyo con su
 * clase; se toma el mayor que dé contexto 2d.
 */
function rectViewport(): { c: HTMLCanvasElement; x: number; y: number; w: number; h: number } {
  let mejor: HTMLCanvasElement | null = null;
  for (const el of Array.from(document.querySelectorAll("canvas"))) {
    // Sólo canvas VISIBLES: la piel shader mantiene el de la fiel (320×200) montado y
    // OCULTO como fuente, y medir ahí daría el veredicto invertido — ese búfer SÍ lleva
    // la rejilla pintada; lo que #247 rompía era la composición visible de encima.
    if (el.offsetParent === null) continue;
    if (!el.width || !el.height) continue;
    try {
      if (!el.getContext("2d")) continue;
    } catch {
      continue;
    }
    if (!mejor || el.width * el.height > mejor.width * mejor.height) mejor = el;
  }
  const c = mejor!;
  return {
    c,
    x: Math.round((8 / 320) * c.width),
    y: Math.round((8 / 200) * c.height),
    w: Math.round((176 / 320) * c.width),
    h: Math.round((176 / 200) * c.height),
  };
}

async function stashViewport(page: Page, key: string): Promise<void> {
  await page.evaluate(
    ([k, src]) => {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
      const rect = new Function(`${src}; return rectViewport();`)() as ReturnType<
        typeof rectViewport
      >;
      const d = rect.c.getContext("2d")!.getImageData(rect.x, rect.y, rect.w, rect.h).data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any)[k] = { w: rect.w, h: rect.h, px: Array.from(d) };
    },
    [key, rectViewport.toString()] as const,
  );
}

/** Fracción de píxeles del viewport que cambiaron respecto al stash `key`. */
async function cambiado(page: Page, key: string): Promise<number> {
  return page.evaluate(
    ([k, src]) => {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
      const rect = new Function(`${src}; return rectViewport();`)() as ReturnType<
        typeof rectViewport
      >;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const before = (window as any)[k] as { w: number; h: number; px: number[] };
      const now = rect.c
        .getContext("2d")!
        .getImageData(rect.x, rect.y, before.w, before.h).data;
      let diff = 0;
      for (let i = 0; i < now.length; i += 4) {
        if (
          now[i] !== before.px[i] ||
          now[i + 1] !== before.px[i + 1] ||
          now[i + 2] !== before.px[i + 2]
        )
          diff++;
      }
      return diff / (now.length / 4);
    },
    [key, rectViewport.toString()] as const,
  );
}

async function abre(page: Page, gemas: number): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(URL_FAULINEI);
  // La señal de «montado» es el DECK, no un canvas: el primer `canvas` del documento es
  // el búfer OCULTO de la fiel dentro de la shader, y esperar por su visibilidad agota el
  // timeout con el juego perfectamente arrancado.
  await expect(page.locator('.touch-cmd[data-ts-label="View gem"]')).toBeVisible({
    timeout: 30_000,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.evaluate((g) => ((window as any).__u5test.state().gems = g), gemas);
  await page.waitForTimeout(600);
}

test("#247 — el botón «View gem» del deck PINTA la vista en interior portrait (piel de fábrica)", async ({
  page,
}) => {
  await abre(page, 3);
  const boton = page.locator('.touch-cmd[data-ts-label="View gem"]');
  await expect(boton).toBeVisible({ timeout: 15_000 });
  await stashViewport(page, "__terreno");

  await boton.tap();
  await page.waitForTimeout(600);

  // (a) EL MANDO LLEGA: gema consumida, eco del despachador y modal vivo.
  const d = await foto(page);
  expect(d.gems, "la gema se consume (dec [g_gems], 0x3428)").toBe(2);
  expect(d.ecos, "un eco por apertura (DS 0xa258)").toBe(1);
  expect(d.vistaAbierta, "el modal queda abierto hasta la siguiente tecla").toBe(true);

  // (b) Y PINTA. Éste es el aserto que faltaba: hasta #247 el modal se abría, la gema se
  // gastaba y el viewport seguía enseñando la habitación, porque la piel shader componía
  // su capa de TERRENO encima de la rejilla (`paintWorldInto` sin guarda de modal).
  expect(
    await cambiado(page, "__terreno"),
    "el viewport debe REPINTAR a la rejilla de gema, no seguir con el terreno (#247)",
  ).toBeGreaterThan(0.25);
});

test("#247-bis — en táctil el MISMO botón cierra la vista: la paridad de taps es CONDUCTA, no defecto", async ({
  page,
}) => {
  // Medido el 14-08 y anotado aquí para que no se re-reporte como bug: la vista se cierra
  // con CUALQUIER tecla (`gem_view` sondea con lectura destructiva, 0x11b6) y los botones
  // del deck SON teclas. Así que tap impar = abrir (con eco y con gema), tap par = cerrar
  // (sin eco y sin gema). Eso es lo que explica los DOS «View a gem!» de la captura del
  // usuario CON la vista cerrada en la foto: cuatro toques sobre una vista que no se veía.
  await abre(page, 5);
  const boton = page.locator('.touch-cmd[data-ts-label="View gem"]');
  await expect(boton).toBeVisible({ timeout: 15_000 });

  const serie: Foto[] = [];
  for (let i = 0; i < 4; i++) {
    await boton.tap();
    await page.waitForTimeout(400);
    serie.push(await foto(page));
  }
  expect(serie.map((f) => f.vistaAbierta)).toEqual([true, false, true, false]);
  expect(serie.map((f) => f.ecos)).toEqual([1, 1, 2, 2]);
  expect(serie.map((f) => f.gems)).toEqual([4, 4, 3, 3]);
});

test("CAPTURA de careo #247 (no asevera: deja la foto del después junto a la del reporte)", async ({
  page,
}) => {
  await abre(page, 3);
  await page.screenshot({ path: "test-results/247-antes-del-tap.png" });
  await page.locator('.touch-cmd[data-ts-label="View gem"]').tap();
  await page.waitForTimeout(700);
  await page.screenshot({ path: "test-results/247-despues-del-tap.png" });
});
