/**
 * PIEL FIEL (E1-S8b) — smoke en navegador real: arranca en la piel fiel
 * (?skin=faithful&nointro: la fiel es el default y `nointro` salta la cinemática),
 * verifica que monta su canvas 320×200, que sobrevive a un
 * turno vivo, y que F9 conmuta a la piel dev y de vuelta EN CALIENTE sin errores
 * de página. Es la verificación VISUAL que S8a difería a S8b (la piel ya monta).
 */
import { test, expect } from "@playwright/test";
import { skinCycleReady } from "./helpers";

// Estos specs encadenan montajes pesados (PixiJS + atlas HD 696KB) que compiten
// por el dev-server bajo la suite en paralelo. Reintentos para absorber la
// contención de entorno — las asserts no cambian (pasa 4/4 en aislado).
test.describe.configure({ retries: 2 });


test("la piel fiel monta su canvas y sobrevive a un turno", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.addInitScript(() => localStorage.clear());
  // `nointro` salta la CINEMÁTICA fiel (ahora el default de arranque) y monta la piel
  // fiel DIRECTAMENTE sobre el mundo (= Journey Onward sin reproducir el intro). Es el
  // camino determinista para este smoke de la piel; no toca las asserts.
  await page.goto("/?skin=faithful&nointro");

  const canvas = page.locator(".faithful-skin canvas");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  // Canvas lógico del original.
  await expect(canvas).toHaveAttribute("width", "320");
  await expect(canvas).toHaveAttribute("height", "200");
  // Sin HUD DOM: la piel fiel pinta todo en el canvas (no usa .hud-log).
  await expect(page.locator(".hud-log")).toHaveCount(0);

  // Un turno vivo (mover) no rompe el pintado seco.
  await page.keyboard.press("ArrowDown");
  await expect(canvas).toBeVisible();
  expect(errors).toEqual([]);
});

test("Ztats (Z) se pinta en el panel de la fiel, sin el panel DOM de la dev (E1-S11)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.addInitScript(() => localStorage.clear());
  // `nointro` salta la CINEMÁTICA fiel (ahora el default de arranque) y monta la piel
  // fiel DIRECTAMENTE sobre el mundo (= Journey Onward sin reproducir el intro). Es el
  // camino determinista para este smoke de la piel; no toca las asserts.
  await page.goto("/?skin=faithful&nointro");
  const canvas = page.locator(".faithful-skin canvas");
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  // Z abre la ficha DENTRO del canvas fiel; el panel DOM (.ztats-panel, de la
  // piel dev) NO debe aparecer. (La semántica de teclas del modal — flechas
  // circular, dígito salta, Space/Esc cierran, mundo congelado — está en los
  // tests unit de ztatsKeyReducer; aquí se verifica el CABLEADO end-to-end.)
  await page.keyboard.press("z");
  await expect(page.locator(".ztats-panel")).toBeHidden();
  await expect(canvas).toBeVisible();

  // Navegar el modal (flecha cicla la ficha, dígito salta) no rompe ni filtra al
  // panel DOM; Space cierra (igual que Esc).
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("2");
  await expect(page.locator(".ztats-panel")).toBeHidden();
  await page.keyboard.press(" ");
  await expect(canvas).toBeVisible();
  expect(errors).toEqual([]);
});

// El ciclo user-facing de F9 es fiel↔shader (dev jubilada del ciclo, task #79). La
// piel «shader» envuelve la fiel: monta su contenedor visible `.shader-skin`. El swap
// encadena montajes pesados; timeout holgado (30s) para no ser flaky.
test("F9 conmuta fiel↔shader en caliente sin errores", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.addInitScript(() => localStorage.clear());
  // `nointro` salta la CINEMÁTICA fiel (ahora el default de arranque) y monta la piel
  // fiel DIRECTAMENTE sobre el mundo (= Journey Onward sin reproducir el intro). Es el
  // camino determinista para este smoke de la piel; no toca las asserts.
  await page.goto("/?skin=faithful&nointro");
  await expect(page.locator(".faithful-skin canvas")).toBeVisible({ timeout: 30_000 });

  // Warm-up de puntero: asegura que el frame tiene foco de teclado antes del keydown.
  await page.mouse.move(640, 400);
  await skinCycleReady(page);

  // F9 → shader: aparece el canvas visible de la piel shader. La dev NO entra en el
  // ciclo (jubilada); su HUD DOM (.hud-clock) no debe aparecer.
  await page.keyboard.press("F9");
  await expect(page.locator(".shader-skin canvas").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".hud-clock")).toHaveCount(0);

  // F9 → fiel de vuelta: la piel shader se desmonta por completo.
  await page.keyboard.press("F9");
  await expect(page.locator(".faithful-skin canvas")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".shader-skin")).toHaveCount(0);
  expect(errors).toEqual([]);
});

// (a) ESTE TEST FIJABA EL DEFECTO VIEJO A PROPÓSITO — era LA declaración de «la fiel es
// el default», y por eso se actualiza en vez de pincharle una piel: su sujeto ES el
// defecto. Desde el 04-08 el defecto es la SMOOTH (encargo del usuario). Lo que NO cambia
// es el aserto de fondo: sin parámetros no aparece el título DOM de la dev.
test("sin parámetros arranca en la piel smooth (default), no en el título DOM dev", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/");
  // El título DOM de la dev (.title-screen) NO debe aparecer; la piel pinta en canvas.
  await expect(page.locator(".title-screen")).toHaveCount(0);
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
});

// F9 PERSISTE la elección user-facing (localStorage u5.skin). El ciclo es fiel↔shader
// (dev jubilada, task #79): desde la fiel, F9 → shader y persiste "shader".
test("F9 persiste la piel elegida en localStorage (u5.skin)", async ({ page }) => {
  // Limpieza UNA sola vez (no addInitScript: eso re-borraría la preferencia justo en
  // la recarga sin parámetros que este test quiere verificar).
  await page.goto("/?skin=faithful&nointro");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/?skin=faithful&nointro");
  await expect(page.locator(".faithful-skin canvas")).toBeVisible({ timeout: 30_000 });
  await page.mouse.move(640, 400); // warm-up de foco
  await skinCycleReady(page);
  await page.keyboard.press("F9"); // → shader
  await expect(page.locator(".shader-skin canvas").first()).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => localStorage.getItem("u5.skin"))).toBe("shader");

  // ★★ TESTIGO INVERTIDO (04-08) — Y NO ES UN TEST ADECUADO AL CAMBIO: ES LA GUARDA DE
  // UNA RAMA QUE HASTA HOY NO EXISTÍA.
  // Esta cola comprueba que la PREFERENCIA PERSISTIDA gana al defecto al recargar sin
  // parámetros. Lo comprobaba persistiendo `shader`… que desde el 04-08 es EL DEFECTO:
  // habría pasado aunque `main.ts` dejara de leer `u5.skin` POR COMPLETO. No se habría
  // puesto roja — habría dejado de medir, en verde y en silencio.
  // Persistiendo la piel CONTRARIA al defecto vuelve a discriminar, y de paso cubre la
  // rama nueva de la precedencia (honrar `"faithful"` persistido), que es justo donde
  // vivía el defecto latente que este encargo despertó.
  await page.keyboard.press("F9"); // → de vuelta a la fiel, CONTRARIA al defecto
  await expect(page.locator(".faithful-skin canvas")).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => localStorage.getItem("u5.skin"))).toBe("faithful");
  await page.goto("/?nointro");
  await expect(page.locator(".faithful-skin canvas")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".shader-skin canvas")).toHaveCount(0);
  await expect(page.locator(".title-screen")).toHaveCount(0);
});

// Task #79 + jubilación fase 2: una preferencia persistida "dev" (de un save viejo,
// cuando la dev era user-facing) YA NO se honra al cargar: cae AL DEFECTO, sin romperse.
// Retirada la piel dev, `?skin=dev` en la URL TAMPOCO la monta ya (main.ts sólo acepta
// faithful|shader) — cae al defecto igual.
//
// (a) LO INTENCIONAL AQUÍ ES «CAE AL DEFECTO SIN ROMPERSE», no «cae a la fiel»: el
// destino se actualiza con el defecto (04-08: smooth) y los asertos de fondo —que es lo
// que este test existe para proteger— se conservan intactos.
test("una preferencia persistida 'dev' cae al DEFECTO al cargar (jubilación)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("u5.skin", "dev"));
  await page.goto("/?nointro");
  // Arranca en la piel por defecto (smooth), NO en el título/HUD DOM de la dev.
  await expect(page.locator(".shader-skin canvas").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".title-screen")).toHaveCount(0);
  await expect(page.locator(".hud-clock")).toHaveCount(0);
});
