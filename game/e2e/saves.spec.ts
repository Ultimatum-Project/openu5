/**
 * Journey E2E — guardado/carga (F5), autosave rotatorio y export a fichero.
 *
 * Modelo de persistencia (core/persistence.ts): índice ligero en
 * `u5clone:saves` + un slot completo por partida en `u5clone:save:<id>`. El
 * autoguardado usa ids fijos `autosave-1|2|3` (round-robin) → claves reales
 * `u5clone:save:autosave-N` más el puntero `u5clone:autosavePtr`. El export
 * descarga `serialize(state)` (un `JSON.stringify` plano del GameState) como
 * `u5clone-save-<base36ts>.json`.
 *
 * Coordenadas deterministas (mismas que movement.spec.ts, leídas de los mapas):
 *   - Overworld loc 0 (76,40) hora 10: Grass con Grass al este/oeste; de día el
 *     gate de spawn (rand(1,30) ≥ 1) NUNCA dispara encuentro → pasos libres sin
 *     combate flaky. Sirve para guardar una posición y volver a ella.
 *   - Iolo's Hut loc 13 (0,15): un paso al oeste toca el borde y abre el prompt
 *     de salida (F1.3 Flow 1); 'Y' confirma y dispara `map-changed` → autosave
 *     (game.ts confirmTownExit → exitToOverworld, "Yes"/"Exit to Britannia!").
 *
 * Aislamiento de localStorage: `gotoGame` ya hace `localStorage.clear()` en un
 * addInitScript antes de navegar (helpers.ts:21), y Playwright da un contexto de
 * navegador limpio por test. No hace falta limpieza extra; se es consistente con
 * el resto de specs.
 *
 * QUIRK conocido (savepanel.ts:64): el root del SavePanel hace
 * `stopPropagation()` en keydown, así que Escape NO llega al handler global
 * (main.ts:652) mientras el foco está dentro del panel. Para cerrarlo con Escape
 * hay que hacer blur del elemento activo primero. El fix de UI no es parte de
 * esta task; el test lo sortea con `blurActive()` y lo documenta.
 *
 * F5: el listener global (main.ts:695) llama `ev.preventDefault()`, así que en
 * usuarios reales F5 abre el panel sin recargar la página. No requiere cambios.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { gotoGame, readState, consoleText } from "./helpers";

interface Pos {
  location: number;
  floor: number;
  x: number;
  y: number;
}

interface SaveMeta {
  id: string;
  name: string;
}

/**
 * El SavePanel comparte la clase `.save-panel` con Shop/Selector/Creation, así
 * que hay 4 en el DOM. Se desambigua por su título estático "Journeys" (los
 * otros paneles lo tienen dinámico) para evitar el strict-mode de Playwright.
 */
function savePanelOf(page: Page) {
  return page.locator(".save-panel", {
    has: page.locator(".save-title", { hasText: "Journeys" }),
  });
}

/** Suelta el foco del input del panel para que Escape llegue al handler global. */
async function blurActive(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

test("F5 abre el panel y guardar escribe índice + slot en localStorage", async ({ page }) => {
  await gotoGame(page, { loc: 0, x: 76, y: 40, hour: 10 });
  await page.keyboard.press("ArrowRight"); // 77,40 (Grass, paso libre)

  await page.keyboard.press("F5");
  const panel = savePanelOf(page);
  await expect(panel).toBeVisible();

  await panel.locator("input.save-name").fill("slot-e2e");
  await panel.locator(".save-btn-save").click();

  // El slot aparece en la lista renderizada (confirma la escritura síncrona).
  await expect(panel.locator(".save-slot", { hasText: "slot-e2e" })).toBeVisible();

  // Índice `u5clone:saves` con la entrada nombrada...
  const index = await page.evaluate<SaveMeta[]>(() =>
    JSON.parse(localStorage.getItem("u5clone:saves") ?? "[]"),
  );
  const entry = index.find((m) => m.name === "slot-e2e");
  expect(entry).toBeTruthy();

  // ...y el slot completo `u5clone:save:<id>` deserializable a la posición 77,40.
  const raw = await page.evaluate((k) => localStorage.getItem(k), `u5clone:save:${entry!.id}`);
  expect(raw).not.toBeNull();
  const saved = JSON.parse(raw!) as { position: Pos };
  expect(saved.position.x).toBe(77);
  expect(saved.position.y).toBe(40);
  expect(saved.position.location).toBe(0);
});

test("cargar un slot restaura la posición exacta", async ({ page }) => {
  await gotoGame(page, { loc: 0, x: 76, y: 40, hour: 10 });
  await page.keyboard.press("ArrowRight"); // guardamos en 77,40

  await page.keyboard.press("F5");
  const panel = savePanelOf(page);
  await expect(panel).toBeVisible();
  await panel.locator("input.save-name").fill("slot-e2e");
  await panel.locator(".save-btn-save").click();
  await expect(panel.locator(".save-slot", { hasText: "slot-e2e" })).toBeVisible();

  // Cerrar el panel: blur (por el stopPropagation del panel) + Escape.
  await blurActive(page);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  // Nos alejamos: 77,40 → 76,40 (también Grass, paso libre de día).
  await page.keyboard.press("ArrowLeft");
  expect((await readState<Pos>(page, "position")).x).toBe(76);

  // Cargar el slot devuelve la posición guardada, exacta.
  await page.keyboard.press("F5");
  await expect(panel).toBeVisible();
  await panel.locator(".save-slot", { hasText: "slot-e2e" }).locator(".save-btn-load").click();
  await expect(panel).toBeHidden(); // doLoad() cierra el panel

  const pos = await readState<Pos>(page, "position");
  expect(pos.x).toBe(77);
  expect(pos.y).toBe(40);
  expect(pos.location).toBe(0);
});

test("un enemigo del overworld sobrevive a guardar y cargar (#49)", async ({ page }) => {
  // Antes del fix, overworldEnemies era un campo de clase (no GameState): guardar
  // con un enemigo persiguiéndote y cargar lo EVAPORABA. Inyectamos el enemigo por
  // el hook (el spawn real depende del gate RNG por seed/bioma/hora → frágil en E2E)
  // y probamos el camino real de persistencia: serialize → localStorage → load.
  await gotoGame(page, { loc: 0, x: 76, y: 40, hour: 10 });

  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).__u5test.game;
    g.overworldEnemies.enemies.push({ defIndex: 4, tile: 0x94, water: false, x: 78, y: 40, hull: 100 });
  });
  expect(await readState<unknown[]>(page, "overworldEnemies")).toHaveLength(1);

  await page.keyboard.press("F5");
  const panel = savePanelOf(page);
  await expect(panel).toBeVisible();
  await panel.locator("input.save-name").fill("con-enemigo");
  await panel.locator(".save-btn-save").click();
  await expect(panel.locator(".save-slot", { hasText: "con-enemigo" })).toBeVisible();

  // Vacía la lista viva para que la carga tenga algo real que restaurar (no un no-op).
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.game.state.overworldEnemies.length = 0;
  });
  expect(await readState<unknown[]>(page, "overworldEnemies")).toHaveLength(0);

  // Cargar restaura el enemigo EXACTO (posición + casco de la nave NPC).
  await panel.locator(".save-slot", { hasText: "con-enemigo" }).locator(".save-btn-load").click();
  await expect(panel).toBeHidden();

  const enemies = await readState<Array<{ defIndex: number; x: number; y: number; hull?: number }>>(
    page,
    "overworldEnemies",
  );
  expect(enemies).toHaveLength(1);
  expect(enemies[0]).toMatchObject({ defIndex: 4, x: 78, y: 40, hull: 100 });
});

test("autosave rota al cambiar de mapa (map-changed)", async ({ page }) => {
  await gotoGame(page, { loc: 13, x: 0, y: 15 });

  // Salir del pueblo por el borde oeste: desde F1.3 (Flow 1) la salida es
  // INTERACTIVA — ArrowLeft abre "Dost thou wish to leave?" y 'Y' confirma la
  // salida, que dispara map-changed → autosave (kernel-survival.md §5.1).
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("y");
  await expect.poll(() => readState<number>(page, "position.location")).toBe(0);

  // Clave real del autosave: `u5clone:save:autosave-N` (SLOT_PREFIX + id fijo).
  const autosaveKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith("u5clone:save:autosave")),
  );
  expect(autosaveKeys.length).toBeGreaterThan(0);

  // El puntero round-robin se escribió.
  const ptr = await page.evaluate(() => localStorage.getItem("u5clone:autosavePtr"));
  expect(ptr).not.toBeNull();

  // El autosave capturó ya el overworld (location 0), no el pueblo.
  const raw = await page.evaluate((k) => localStorage.getItem(k), autosaveKeys[0]!);
  const auto = JSON.parse(raw!) as { position: Pos };
  expect(auto.position.location).toBe(0);
});

/**
 * Simula un localStorage lleno interceptando SOLO las escrituras de slot
 * (`u5clone:save:*`, los blobs grandes) para lanzar QuotaExceededError. El índice
 * (`u5clone:saves`) y el puntero de autosave siguen escribiéndose, igual que en un
 * navegador real cuya cuota se agota con los saves grandes. Debe registrarse
 * ANTES de `gotoGame` (que añade su propio `localStorage.clear()`).
 */
async function stubStorageFull(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string): void {
      if (String(key).startsWith("u5clone:save:")) {
        throw new DOMException("localStorage is full", "QuotaExceededError");
      }
      return real.call(this, key, value);
    };
  });
}

test("save manual con storage lleno muestra aviso accionable, sin pageerror (soak #35)", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await stubStorageFull(page);
  await gotoGame(page, { loc: 0, x: 76, y: 40, hour: 10 });

  await page.keyboard.press("F5");
  const panel = savePanelOf(page);
  await expect(panel).toBeVisible();
  await panel.locator("input.save-name").fill("no-cabe");
  await panel.locator(".save-btn-save").click();

  // El HUD comunica el fallo con un mensaje accionable (borrar/exportar).
  await expect.poll(() => consoleText(page)).toMatch(/storage full/i);
  // Y nada de excepciones sin capturar (el síntoma 1 del hallazgo).
  expect(pageErrors).toEqual([]);
});

test("autosave fallido por quota no rompe el juego ni lanza pageerror (soak #35)", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await stubStorageFull(page);
  // gotoGame espera a `.hud-clock`: si el autosave del arranque rompiera el boot
  // (el "boot zombie"), este waitFor haría timeout. Que complete ya prueba la
  // resiliencia del arranque.
  await gotoGame(page, { loc: 13, x: 0, y: 15 });

  // Salir del pueblo dispara map-changed → autosave, que ahora falla en silencio.
  // Desde F1.3 (Flow 1) la salida es interactiva: ArrowLeft abre el prompt, 'Y'
  // confirma y ejecuta la salida (kernel-survival.md §5.1).
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("y");
  await expect.poll(() => readState<number>(page, "position.location")).toBe(0);

  // El juego sigue vivo (teclas responden) y no hubo excepción sin capturar.
  expect(pageErrors).toEqual([]);
});

test("Export descarga un JSON restaurable con la posición correcta", async ({ page }) => {
  await gotoGame(page); // INIT: Iolo's Hut loc 13 (15,15)

  await page.keyboard.press("F5");
  const panel = savePanelOf(page);
  await expect(panel).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await panel.locator(".save-btn-export").click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^u5clone-save-.*\.json$/);

  // El contenido parsea y refleja la posición actual (15,15 en loc 13).
  const path = await download.path();
  const content = JSON.parse(readFileSync(path, "utf8")) as { position: Pos };
  expect(content.position.location).toBe(13);
  expect(content.position.x).toBe(15);
  expect(content.position.y).toBe(15);
});

test("#370 · el panel SUELTA el foco al cerrar: la PRIMERA tecla tras el clic en Close llega al juego", async ({ page }) => {
  await gotoGame(page, { loc: 0, x: 76, y: 40, hour: 10 });

  await page.keyboard.press("F5");
  const panel = savePanelOf(page);
  await expect(panel).toBeVisible();
  // show() enfoca `.save-name`: el foco está DENTRO del panel, como en el uso real.
  await expect(panel.locator("input.save-name")).toBeFocused();

  // Cierre con RATÓN + tecla EN EL MISMO TICK (la clase #368: el clic deja el foco en
  // el botón del árbol que se acaba de ocultar, y Chromium sólo lo recoloca a body UN
  // FRAME después — savepanel.ts). La tecla se despacha síncrona sobre ese foco
  // retenido, que es la ventana exacta que la mitad 2 del fix (la guarda `visible`
  // del keydown del root) deja pasar y el pre-fix se tragaba con su stopPropagation.
  // (Una tecla real de Playwright llega >1 frame tarde y no ejerce la ventana.)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll<HTMLButtonElement>(".save-btn-close")].find(
      (b) => b.offsetParent !== null,
    )!;
    btn.click(); // hide(): display:none — el foco aún vive en el botón oculto
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
  });
  await expect(panel).toBeHidden();
  // EL ASERTO #370: esa primera tecla llegó al juego y movió al party.
  await expect.poll(async () => (await readState<Pos>(page, "position")).x).toBe(77);

  // Y Escape con el foco en el input CIERRA el panel (el handler del root resuelve
  // donde nace el evento — la rama global era inalcanzable): sin blurActive previo.
  await page.keyboard.press("F5");
  await expect(panel).toBeVisible();
  await expect(panel.locator("input.save-name")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});
