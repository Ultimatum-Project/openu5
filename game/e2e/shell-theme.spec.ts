/**
 * TEMATIZADO DEL SHELL POR PIEL (FASE 3). El overlay DOM del shell cambia de aspecto
 * según la piel activa vía `data-shell-skin` en <html> (fiel=panel EGA m1, shader=panel
 * vectorial m5, dev=moderno). Aquí se guarda el CABLEADO: el atributo refleja la piel
 * de arranque y se re-estampa EN CALIENTE al cambiar de piel (el aspecto es CSS, cubierto
 * por la verificación viva). No toca el canvas (identidad fiel intacta).
 */
import { test, expect } from "@playwright/test";

const themeAttr = () =>
  document.documentElement.getAttribute("data-shell-skin");

test("data-shell-skin = 'faithful' por defecto («ventana 1988» C5, 0a3ef6fd) y 'shader' con ?shellVector=1", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful&loc=0&x=76&y=40&hour=10&nointro");
  await page.locator('[data-testid="u5-shell-gear"]').waitFor({ state: "attached", timeout: 20000 });
  // El veredicto C5 («ventana 1988», 0a3ef6fd) hace del chrome EGA + fuente 8×8 el shell
  // DEFAULT bajo AMBAS pieles de juego (shell8x8 ON en main.ts salvo `?shellVector=1`),
  // así que el atributo es "faithful". El look VECTOR B2 (f33212f6) queda como fallback QA.
  await expect.poll(() => page.evaluate(themeAttr)).toBe("faithful");
  // Fallback QA: `?shellVector=1` apaga shell8x8 y devuelve el vector B2.
  await page.goto("/?skin=faithful&loc=0&x=76&y=40&hour=10&nointro&shellVector=1");
  await page.locator('[data-testid="u5-shell-gear"]').waitFor({ state: "attached", timeout: 20000 });
  await expect.poll(() => page.evaluate(themeAttr)).toBe("shader");
});

test("el shell «ventana 1988» es estable en el cambio de piel EN CALIENTE (fiel → shader)", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful&loc=0&x=76&y=40&hour=10&nointro");
  await page.locator('[data-testid="u5-shell-gear"]').waitFor({ state: "attached", timeout: 20000 });
  await expect.poll(() => page.evaluate(themeAttr)).toBe("faithful");
  // F9 cicla la piel de JUEGO (fiel→shader) y la persiste en u5.skin. Con «ventana 1988»
  // general (C5) el shell es EGA/8×8 bajo ambas pieles, así que data-shell-skin NO cambia:
  // lo observable del hot-swap es la piel de JUEGO (u5.skin), no el atributo del shell (que
  // se mantiene "faithful" por diseño).
  await page.keyboard.press("F9");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("u5.skin")), { timeout: 8000 })
    .toBe("shader");
  expect(await page.evaluate(themeAttr)).toBe("faithful");
});

// RETIRADO (2026-07-19): con B2-general aterrizado (f33212f6, flag SHELL_GENERAL_VECTOR) el
// shell es VECTOR también bajo la piel FIEL, así que el drawer ya NO usa la fuente 8×8 bajo
// fiel — esta prueba (glifos de atlas .u5px-* en el drawer fiel) ya no puede pasar. Si el
// usuario decide «drawer con fuente 8×8 bajo fiel» (decisión de PULIDO ABIERTA:
// PENDIENTES-USUARIO #23 / memoria shell-theming-por-piel), se quita el `.skip` y el test
// vuelve con la feature. No se codifica aquí la decisión: sólo se desbloquea el rojo. El
// cuerpo se conserva intacto como referencia para cuando regrese.
test.skip("fiel: el drawer usa la fuente 8×8 real y conserva accesibilidad; shader la revierte", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful&loc=0&x=76&y=40&hour=10&nointro");
  await page.locator('[data-testid="u5-shell-gear"]').waitFor({ state: "attached", timeout: 20000 });
  await page.keyboard.press("Escape");
  const title = page.locator('[data-testid="u5-shell-drawer"] .u5dbg-title');
  await title.waitFor({ timeout: 5000 });
  // Pixelizado: el título tiene glifos de atlas y conserva el texto en aria-label (a11y).
  await expect.poll(() => title.locator(".u5px-g, .u5px-e").count()).toBeGreaterThan(0);
  await expect(title).toHaveAttribute("aria-label", "SYSTEM");
  // Un botón prominente también se pixeliza conservando su texto en aria-label (a11y).
  const saveBtn = page.locator('[data-testid="u5-shell-drawer"] button.u5px[aria-label="Save / Load (F5)"]');
  await expect.poll(() => saveBtn.count()).toBe(1);
  // Al pasar a shader se REVIERTE (sin glifos de atlas; texto real de vuelta).
  await page.keyboard.press("Escape");
  await page.keyboard.press("F9");
  await expect.poll(() => page.evaluate(themeAttr), { timeout: 8000 }).toBe("shader");
  await expect.poll(() => title.locator(".u5px-g, .u5px-e").count()).toBe(0);
  await expect(title).toHaveText("SYSTEM");
});
