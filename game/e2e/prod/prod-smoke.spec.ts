/**
 * SMOKE DE PRODUCCIÓN (auditoría de calidad Q3) — el build real arranca y LLEGA AL
 * MUNDO RENDERIZADO, conducido como un usuario: sin hooks `__u5test`, sin `?nointro`,
 * sin deep-links (todos son DEV-only y NO existen en dist/).
 *
 * Corre contra `vite preview` (playwright.prod.config.ts). Conduce la cinemática fiel
 * A CIEGAS por el ÚNICO camino fiel de entrada sin save: la CREACIÓN de personaje
 * (menú 'c' → gitana). Ni 'j' ni 'r' sirven ya sin partida guardada: "Journey Onward"
 * imprime el aviso fiel "No active game…" (gate INTRO.OVL 0x0ec9) y "Return to the
 * View" relanza el demo del attract y vuelve al menú (INTRO.OVL 0x100a: call 0xfb1a +
 * jmp 0xcd0 — carril intro-gate; antes era una vía QoL que arrancaba partida sin
 * personaje, divergencia). El fin del boot se detecta por DOM REAL de producción: la
 * piel fiel monta `.faithful-skin` con su canvas y la intro (`.faithful-intro`) se
 * desmonta.
 *
 * Cubre la clase de regresión SOLO-PROD que ya mordió (prod-preview-boot): assets de
 * datos que caen al SPA fallback («Unexpected token '<' … not valid JSON»), rutas de
 * dist/ rotas, tree-shaking que se lleva módulos vivos. Cualquiera de ellas revienta
 * el boot → pageerror y/o el mundo no monta → rojo aquí.
 */
import { test, expect } from "@playwright/test";

// (b) LA PIEL SE PIDE, NO SE HEREDA (04-08). Este smoke arrancaba con `/` y heredaba la
// piel de fábrica sin decirlo. Su instrumento —muestreo de PÍXELES por `getContext("2d")`
// sobre el canvas de la fiel— está construido alrededor de esa piel, así que el cambio de
// defecto lo habría roto por el sitio menos informativo posible.
//
// 🔴 Y OJO CON EL LOCATOR: `ShaderSkin` monta una `FaithfulSkin` REAL dentro de un host
// oculto (`.shader-skin-src`, 0×0 + `opacity:0`), y `FaithfulSkin` siempre se pone
// `className="faithful-skin"`. O sea: **`.faithful-skin` EXISTE EN LAS DOS PIELES**, así
// que `toHaveCount()` sobre él NO discrimina — y, medido, **su visibilidad TAMPOCO**:
// para Playwright `opacity:0` y el recorte de un padre 0×0 siguen siendo «visible».
// El único vehículo que discrimina es la PRESENCIA de `.shader-skin`.
// Con el defecto en smooth este spec habría seguido en verde hasta el final… midiendo el
// canvas ESCONDIDO de la fiel interna en vez de la piel que el usuario ve. Peor que un
// rojo: un verde que ya no prueba lo que dice.
// Se pincha `faithful` explícita y NINGÚN aserto cambia.
// El defecto de fábrica en prod lo cubre el smoke de abajo, que no necesita este
// instrumento.
test("prod: la cinemática arranca, la creación de personaje monta el mundo y la piel fiel pinta", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  await page.goto("/?skin=faithful");

  // La cinemática fiel de 1988 monta su canvas (primer render real del build).
  await expect(page.locator(".faithful-intro canvas").first()).toBeVisible({ timeout: 30_000 });

  // PROD DE VERDAD: los hooks DEV no existen (si aparecieran, estaríamos smokeando
  // un build contaminado y el resto del spec no probaría nada).
  expect(await page.evaluate(() => "__u5test" in window)).toBe(false);

  // Conducción a ciegas por la CREACIÓN (único camino fiel sin save; no hay hooks
  // que sondear en prod). La máquina de fases es LINEAL y cada tecla avanza una:
  //
  // 1) 'c' ×14: logo×2 → título → attract (una tecla corta cada uno) → menú, donde
  //    'c' es la hotkey de "Create New Character"; los 'c' sobrantes caen en el
  //    prompt del nombre (se escriben como texto, clamp NAME_MAX=8 → "cccccccc").
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("c");
    await page.waitForTimeout(250);
  }
  // 2) Enter confirma el nombre (no vacío) → sexo; 'm' → narración de la gitana;
  //    Space la pasa → torneo de preguntas.
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  await page.keyboard.press("m");
  await page.waitForTimeout(250);
  await page.keyboard.press(" ");
  await page.waitForTimeout(250);
  // 3) 'a' responde las 7 preguntas del torneo y una tecla más cierra el epílogo
  //    del Codex → finish(create) → el mundo monta. Poll del DOM tras cada tecla
  //    (los sobrantes son ≤1 y caen inocuos en el juego ya montado).
  let mounted = false;
  for (let i = 0; i < 12 && !mounted; i++) {
    await page.keyboard.press("a");
    await page.waitForTimeout(250);
    mounted = (await page.locator(".faithful-skin canvas").count()) > 0;
  }
  expect(mounted, "el mundo no montó tras conducir la creación a ciegas ('c'…'a')").toBe(true);

  // La intro se desmontó y la piel fiel es la vista viva.
  await expect(page.locator(".faithful-intro")).toHaveCount(0);
  const worldCanvas = page.locator(".faithful-skin canvas").first();
  await expect(worldCanvas).toBeVisible();

  // RENDER REAL: el canvas 2D de la fiel tiene contenido no uniforme (chrome EGA +
  // ventana del mundo pintados). Un boot a medias (assets rotos) deja el canvas
  // en negro plano → <2 colores.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const canvas = document.querySelector<HTMLCanvasElement>(".faithful-skin canvas");
          if (!canvas || canvas.width === 0) return 0;
          const ctx = canvas.getContext("2d");
          if (!ctx) return 0;
          const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          const colors = new Set<number>();
          for (let i = 0; i < d.length; i += 4) {
            colors.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
            if (colors.size > 8) break; // con 8 colores distintos ya hay mundo
          }
          return colors.size;
        }),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(4);

  // Boot limpio: cero excepciones sin capturar (la firma del SPA-fallback de assets
  // era «Unexpected token '<' … is not valid JSON» reventando el boot).
  expect(pageErrors, `pageerrors durante el boot prod:\n${pageErrors.join("\n")}`).toEqual([]);
});

// ★ EL DEFECTO DE FÁBRICA, SMOKEADO EN PROD (04-08). El smoke de arriba pincha la piel
// para conservar su instrumento de píxeles, así que sin este test la piel que ve DE
// VERDAD quien abre el sitio —o la app instalada, cuyo `start_url` es `/` pelado— dejaría
// de estar cubierta en producción. Y es justo donde importa: la clase de regresión que
// este fichero persigue es SOLO-PROD (assets, rutas de dist/, tree-shaking).
//
// Es BARATO a propósito: no conduce la creación de personaje: el defecto de piel se
// resuelve en el boot, ANTES de montar ninguna piel, y se observa en la cinemática.
// El overlay `u5-intro-shader-overlay` NO existe en modo fiel (protección estructural:
// la intro fiel es byte-idéntica al DOSBox), así que su presencia es prueba POSITIVA de
// que el boot de producción resolvió a smooth.
test("prod: SIN parámetros el defecto de fábrica es la piel smooth", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  await page.addInitScript(() => localStorage.clear());
  await page.goto("/");

  await expect(page.locator(".faithful-intro canvas").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid="u5-intro-shader-overlay"]')).toHaveCount(1);

  expect(pageErrors, `pageerrors durante el boot prod:\n${pageErrors.join("\n")}`).toEqual([]);
});
