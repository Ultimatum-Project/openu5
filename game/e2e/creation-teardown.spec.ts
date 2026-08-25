/**
 * Regresión del leak del CreationPanel (bug de Fase 0, ver
 * docs/superpowers/specs/2026-07-11-e2e-fase0-findings.md #1). Tras terminar la
 * creación, el panel debe DESMONTARSE del DOM y retirar sus keydown handlers
 * globales; si no, sus botones A/B y su `.save-title` ("The Summoning") siguen
 * vivos (colisionan con el `.save-panel` real) y F5/Escape quedan comprometidos.
 */
import { test, expect } from "@playwright/test";
import { createCharacter } from "./helpers";

const ALL_A = ["A", "A", "A", "A", "A", "A", "A"] as const;

test("tras crear personaje, el panel de creación se desmonta del DOM", async ({ page }) => {
  await createCharacter(page, "Teardown", "M", [...ALL_A]);
  // Assert que DISCRIMINA el fix: sólo deben quedar los `.save-panel` permanentes
  // (Save + Selector, ocultos). Antes eran 3 (con el ShopPanel DOM); jubilada la piel
  // dev, la tienda va por consola fiel (`startShopConsole`) y su panel DOM se eliminó →
  // 2 permanentes. Con el leak del CreationPanel serían 3 — su root se quedaba
  // `display:none` (no lo captaría `:visible`, por eso contamos el total).
  await expect(page.locator(".save-panel")).toHaveCount(2);
  await expect(page.locator(".save-title", { hasText: "The Summoning" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "A", exact: true })).toHaveCount(0);
});

test("Escape en juego NO re-muestra el título (handlers retirados)", async ({ page }) => {
  await createCharacter(page, "Teardown", "M", [...ALL_A]);
  await page.keyboard.press("Escape");
  // Jubilada la piel dev: no hay título/HUD DOM. Tras la creación fiel la cinemática se
  // desmonta y el mundo queda montado; Escape (abre el drawer SISTEMA) no la resucita.
  await expect(page.locator(".faithful-intro")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __u5test?: { worldReady?: () => boolean } }).__u5test?.worldReady?.() ===
        true,
    ),
  ).toBe(true);
});

test("F5 abre el panel de saves tras la creación (no bloqueado por el leak)", async ({ page }) => {
  await createCharacter(page, "Teardown", "M", [...ALL_A]);
  await page.keyboard.press("F5");
  // Shop y Selector comparten la clase `.save-panel` (siempre en el DOM,
  // ocultos), así que scope a `:visible` = el único panel de saves abierto.
  await expect(page.locator(".save-panel:visible")).toHaveCount(1);
  // Chrome «ventana 1988» (veredicto #23): el marco oculta el `.save-title` nativo
  // y repinta el título en su banda — se aserta presencia en DOM, no visibilidad.
  await expect(page.locator(".save-title", { hasText: "Journeys" })).toBeAttached();
  // SavePanel.show() enfoca su input y su root hace stopPropagation() del
  // keydown; hay que sacar el foco del input para que Escape llegue al handler
  // global del juego (quirk pre-existente de SavePanel, ajeno a la creación).
  await page.locator(".save-panel:visible .save-name").blur();
  await page.keyboard.press("Escape");
  await expect(page.locator(".save-panel:visible")).toHaveCount(0);
});
