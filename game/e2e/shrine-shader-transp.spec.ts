/**
 * Ficha #363 — TRANSPARENCIA DE SPRITES en la escena del santuario/Codex bajo la piel
 * SHADER (3ª instancia de la clase #351: defecto sólo-shader invisible al e2e porque
 * `gotoGame` cablea `skin=faithful`). Este spec es la primera mirada e2e de la piel de
 * FÁBRICA sobre esta escena: navega con URL CRUDA `?skin=shader` a propósito.
 *
 * Qué fija: tras (E)nter en el Shrine of Honesty (233,66) la escena queda montada con el
 * Avatar arrodillado en (5,6) (bajo webdriver el pacer drena síncrono, #277). En la piel
 * shader el FONDO del sprite debe dejar ver el SUELO de la escena (hierba 0x05 =
 * matas VERDES; antes del fix #363 el sprite llegaba horneado con su cuadrado NEGRO por
 * el recorte pleno y las cuatro esquinas de la celda salían negras). El detector cuenta
 * píxeles VERDES (matas de hierba, g>80 ∧ r<80) en las esquinas de la celda del Avatar
 * — zona que el sprite arrodillado no alcanza — y exige ≥1 en la shader:
 *   · CONTROL POSITIVO: el mismo detector sobre una celda de hierba PURA (9,6) del mismo
 *     frame debe dar ≥1 — acredita que el detector ve el suelo real, no un umbral vacuo.
 *   · CONTROL NEGATIVO (fiel): con `skin=faithful` las esquinas del sprite deben dar CERO
 *     verdes — el original hornea el tile opaco y la fidelidad EGA no se toca (#363 es
 *     un fix SÓLO de la piel shader; si esto enrojece, el fix se fugó a la fiel).
 *
 * Identidad de la piel por TAMAÑO del lienzo (trampa #318: `data-shell-skin` miente):
 * shader = el canvas visible grande (≥1280 de ancho); fiel = 320×200.
 */
import { test, expect, type Page } from "@playwright/test";
import { waitWorldReady } from "./helpers.js";

/** Cuenta píxeles de MATA DE HIERBA (verde dominante) en las 4 esquinas de una celda
 *  del viewport de la piel activa. `cell` en coordenadas de rejilla 11×11. */
async function greenCornerCount(page: Page, col: number, row: number): Promise<number> {
  return page.evaluate(
    ([c, r]) => {
      const cs = [...document.querySelectorAll("canvas")].filter(
        (cv) => document.contains(cv) && cv.getClientRects().length > 0,
      );
      cs.sort((a, b) => b.width * b.height - a.width * a.height);
      const cv = cs[0]!;
      const s = cv.width / 320; // escala de dispositivo respecto al frame EGA 320×200
      const vpX = 8 * s;
      const vpY = 8 * s;
      const cell = (176 * s) / 11; // 16·s px por celda
      const ctx = cv.getContext("2d")!;
      const x0 = Math.round(vpX + c * cell);
      const y0 = Math.round(vpY + r * cell);
      const q = Math.max(2, Math.floor(cell / 4)); // cuadrante de esquina (4 px EGA)
      let green = 0;
      const scan = (sx: number, sy: number): void => {
        const d = ctx.getImageData(sx, sy, q, q).data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 1]! > 80 && d[i]! < 80 && d[i + 2]! < 80) green++;
        }
      };
      const sz = Math.round(cell);
      scan(x0, y0); // NW
      scan(x0 + sz - q, y0); // NE
      scan(x0, y0 + sz - q); // SW
      scan(x0 + sz - q, y0 + sz - q); // SE
      return green;
    },
    [col, row] as const,
  );
}

/** Navega a la casilla del Shrine of Honesty con la piel pedida y monta la escena con E. */
async function mountShrineScene(page: Page, skin: "shader" | "faithful"): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  // URL CRUDA (no gotoGame): la ficha #351 documenta que el helper cablea skin=faithful
  // y hace invisible por construcción todo defecto de la piel de fábrica.
  await page.goto(`/?skin=${skin}&nointro&x=233&y=66`);
  await waitWorldReady(page);
  await page.keyboard.press("e");
  // Bajo webdriver el guion drena síncrono y queda el kneel montado esperando el prompt
  // «Upon what virtue…»; un settle corto deja al rAF presentar el frame compuesto.
  await page.waitForTimeout(900);
}

test("#363 · shader: el fondo del Avatar arrodillado deja ver la hierba de la escena", async ({ page }) => {
  await mountShrineScene(page, "shader");
  // Identidad shader: el lienzo compuesto es el GRANDE (≥1280), no el 320×200 fiel.
  const bigCanvas = await page.evaluate(() => {
    const cs = [...document.querySelectorAll("canvas")].filter(
      (cv) => document.contains(cv) && cv.getClientRects().length > 0,
    );
    return Math.max(...cs.map((c) => c.width));
  });
  expect(bigCanvas).toBeGreaterThanOrEqual(1280);

  // CONTROL POSITIVO: una celda de hierba pura de la MISMA escena y el MISMO frame.
  const grass = await greenCornerCount(page, 9, 6);
  expect(grass).toBeGreaterThan(0);

  // EL ASERTO #363: las esquinas de la celda del Avatar (5,6) enseñan matas de hierba
  // a través del fondo transparente del sprite. Antes del fix: 0 (cuadrado negro).
  const avatar = await greenCornerCount(page, 5, 6);
  expect(avatar).toBeGreaterThan(0);
});

test("#363 · control negativo fiel: el tile del Avatar sigue OPACO (fidelidad EGA intacta)", async ({ page }) => {
  await mountShrineScene(page, "faithful");
  // Identidad fiel: el lienzo visible es el 320×200 (el shader no montó el grande).
  const bigCanvas = await page.evaluate(() => {
    const cs = [...document.querySelectorAll("canvas")].filter(
      (cv) => document.contains(cv) && cv.getClientRects().length > 0,
    );
    return Math.max(...cs.map((c) => c.width));
  });
  expect(bigCanvas).toBeLessThan(1280);

  // Mismo detector, mismo frame: control positivo en hierba pura…
  const grass = await greenCornerCount(page, 9, 6);
  expect(grass).toBeGreaterThan(0);
  // …y CERO verdes en las esquinas del sprite: el original hornea el cuadrado del tile.
  const avatar = await greenCornerCount(page, 5, 6);
  expect(avatar).toBe(0);
});
