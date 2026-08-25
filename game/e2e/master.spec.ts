/**
 * Journey MAESTRO — smoke integral de la ruta crítica EN BROWSER: creación por
 * el cuestionario de la gitana → jugar un tramo real (un comando + un paso) →
 * abrir un panel → guardar → alejarse → cargar → posición exacta restaurada.
 *
 * Es el test que ata el ciclo completo crear→jugar→persistir→restaurar con los
 * helpers reales (nada de flujo duplicado). Combate/tienda/mazmorra/magia ya
 * tienen sus propios specs; aquí NO se re-cubren.
 *
 * Geometría determinista (Iolo's Hut, loc 13, arranque INIT en 15,15; tiles
 * leídos de assets/maps/smallmaps.json idx 12):
 *   - El Avatar está en 145 (ChairBackLeft, walkable). Vecinos N/S/W = tile 68
 *     (suelo, walkable); E (16,15) = 148 TableLeft (bloquea).
 *   - Un small map (pueblo) NO tira encuentros aleatorios, así que el paso es
 *     libre y no hay combate flaky.
 *
 * SavePanel: comparte `.save-panel` con otros 3 paneles; se desambigua por el
 * título estático "Journeys" (igual que saves.spec). Su root hace
 * stopPropagation en keydown (savepanel.ts:64), así que para cerrar con Escape
 * hay que soltar el foco primero (blurActive) — mismo quirk documentado allí.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createCharacter, readState, hudLog } from "./helpers";

const ALL_A = ["A", "A", "A", "A", "A", "A", "A"] as const;

interface Pos {
  location: number;
  floor: number;
  x: number;
  y: number;
}

function savePanelOf(page: Page) {
  return page.locator(".save-panel", {
    has: page.locator(".save-title", { hasText: "Journeys" }),
  });
}

async function blurActive(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

test("ruta crítica: gitana → comando + paso → Ztats → save → alejarse → load restaura posición", async ({
  page,
}) => {
  test.setTimeout(120_000);

  // 1. Creación por el cuestionario (stats exactos ya cubiertos en creation.spec;
  //    aquí sólo un smoke de que el Avatar se creó con la STR all-A esperada).
  await createCharacter(page, "Hero", "M", [...ALL_A]);
  expect(await readState<number>(page, "characters[0].strength")).toBe(20);

  const start = await readState<Pos>(page, "position");
  expect(start).toMatchObject({ location: 13, x: 15, y: 15 });

  // 2a. Un comando real de mundo: LOOK al este describe la mesa ("Thou dost see").
  await page.keyboard.press("l");
  await page.keyboard.press("ArrowRight");
  expect((await hudLog(page)).join("\n")).toContain("Thou dost see");

  // 2b. Un paso real: al sur (15,16) es suelo → la posición avanza de verdad.
  await page.keyboard.press("ArrowDown");
  const walked = await readState<Pos>(page, "position");
  expect(walked).toMatchObject({ location: 13, x: 15, y: 16 });

  // 3. Ztats (Z): la ficha la pinta la piel fiel en su overlay de CANVAS (el panel DOM
  //    `.ztats-panel` era sólo-dev, jubilado en la fase 2) → sin DOM ni hook que aseverar.
  //    Se ejercita el toggle Z/Escape; que el flujo sigue vivo lo confirman los pasos 4-6
  //    (save→alejarse→load), que fallarían si Z hubiera roto el juego.
  await page.keyboard.press("z");
  await page.keyboard.press("Escape");

  // 4. Guardar la partida en (15,16) vía el panel F5.
  await page.keyboard.press("F5");
  const panel = savePanelOf(page);
  await expect(panel).toBeVisible();
  await panel.locator("input.save-name").fill("master");
  await panel.locator(".save-btn-save").click();
  await expect(panel.locator(".save-slot", { hasText: "master" })).toBeVisible();

  // El slot completo quedó escrito en localStorage (persistencia real).
  const savedInStorage = await page.evaluate(() =>
    Object.keys(localStorage).some((k) => k.startsWith("u5clone:save:")),
  );
  expect(savedInStorage).toBe(true);

  // Cerrar el panel (blur por el stopPropagation + Escape).
  await blurActive(page);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  // 5. Alejarse: volver al norte (15,15) para que la posición ya NO sea la guardada.
  await page.keyboard.press("ArrowUp");
  expect((await readState<Pos>(page, "position")).y).toBe(15);

  // 6. Cargar el slot devuelve la posición guardada, EXACTA (cierre del ciclo).
  await page.keyboard.press("F5");
  await expect(panel).toBeVisible();
  await panel.locator(".save-slot", { hasText: "master" }).locator(".save-btn-load").click();
  await expect(panel).toBeHidden(); // doLoad() cierra el panel

  const restored = await readState<Pos>(page, "position");
  expect(restored).toMatchObject({ location: 13, x: 15, y: 16 });
});
