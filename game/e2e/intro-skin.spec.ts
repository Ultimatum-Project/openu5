/**
 * CAMBIO DE PIEL DURANTE LA INTRO (task #79 ampliado). La cinemática fiel corre ANTES
 * de montar ninguna piel; aun así el usuario puede cambiar fiel↔shader EN VIVO:
 *   · F9 la cicla (el handler de teclado de la intro lo intercepta antes del menú).
 *   · el switcher directo (mismo botón que en juego) la elige con un click.
 * El overlay xBR de la intro (`u5-intro-shader-overlay`) se crea/destruye en vivo; en
 * modo fiel NO existe (protección estructural: intro byte-idéntica al DOSBox). El menú
 * SISTEMA (⚙) NO se muestra en la intro — eso es deliberado (#71) y se mantiene.
 *
 * Arranca con la CINEMÁTICA COMPLETA (?skin=faithful, sin nointro).
 */
import { test, expect } from "@playwright/test";

const overlay = '[data-testid="u5-intro-shader-overlay"]';
const swBtn = '[data-testid="u5-skin-switcher"]';
const swMenu = '[data-testid="u5-skin-switcher-menu"]';
const swItem = '[data-testid="u5-skin-switcher-item"]';

test.describe.configure({ retries: 2 });

// El keyHandler de la intro se engancha al final de run() (tras cargar assets). Esperar
// al canvas visible + un settle corto asegura que F9 ya se procesa.
async function introReady(page: import("@playwright/test").Page): Promise<void> {
  await expect(page.locator(".faithful-intro canvas").first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(700);
}

test("F9 durante la intro cicla fiel↔shader (overlay xBR aparece/desaparece)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful");
  await introReady(page);

  // Arranca FIEL: el overlay xBR NO existe (byte-idéntica).
  await expect(page.locator(overlay)).toHaveCount(0);

  // F9 → shader: aparece el overlay + persiste.
  await page.keyboard.press("F9");
  await expect(page.locator(overlay)).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem("u5.skin"))).toBe("shader");

  // F9 → fiel: el overlay se destruye + persiste.
  await page.keyboard.press("F9");
  await expect(page.locator(overlay)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("u5.skin"))).toBe("faithful");

  expect(errors).toEqual([]);
});

test("el switcher directo funciona sobre la intro (⚙ NO aparece)", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful");
  await introReady(page);

  // El botón del switcher está; el ⚙ del menú SISTEMA NO (exclusión deliberada #71).
  await expect(page.locator('[data-testid="u5-shell-gear"]')).toHaveCount(0);

  await page.mouse.move(300, 300); // revela el FAB
  await expect(page.locator(swBtn)).toHaveClass(/visible/);
  await page.locator(swBtn).click();
  await expect(page.locator(swMenu)).toHaveClass(/open/);
  // Dos pieles, sin dev; la activa (faithful) marcada.
  await expect(page.locator(swItem)).toHaveCount(2);
  await expect(page.locator(`${swItem}[data-skin-id="faithful"]`)).toHaveClass(/active/);

  // Un click en shader → overlay aparece, menú cerrado, persiste.
  await page.locator(`${swItem}[data-skin-id="shader"]`).click();
  await expect(page.locator(overlay)).toHaveCount(1);
  await expect(page.locator(swMenu)).not.toHaveClass(/open/);
  expect(await page.evaluate(() => localStorage.getItem("u5.skin"))).toBe("shader");
});

// ★★ TESTIGO INVERTIDO (04-08). Este test comprueba que la piel ELEGIDA en la intro es la
// que se monta en el juego — y lo comprobaba persistiendo `shader`, que desde el 04-08 es
// EL DEFECTO. Con smooth de fábrica habría pasado aunque la preferencia dejara de leerse
// entera: no se habría puesto rojo, habría dejado de medir. Persistiendo la piel CONTRARIA
// al defecto vuelve a discriminar, y cubre la rama nueva de la precedencia (honrar un
// `"faithful"` persistido) donde vivía el defecto latente que este encargo despertó.
// No se ha cambiado lo que el test AFIRMA: sigue siendo «la elegida en la intro se monta».
test("la piel elegida en la intro se MONTA en el juego (nointro tras persistir faithful)", async ({
  page,
}) => {
  // Simula "elegí la fiel en la intro" persistiendo la preferencia, y arranca el mundo:
  // el juego debe montar la piel fiel (NO la smooth, que es la de fábrica).
  await page.addInitScript(() => localStorage.setItem("u5.skin", "faithful"));
  await page.goto("/?nointro");
  await expect(page.locator(".faithful-skin canvas").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".shader-skin canvas")).toHaveCount(0);
});
