/**
 * CONTROL DE LOS DEFECTOS DE FÁBRICA — se arranca SIN PARÁMETROS y se observa qué sale.
 *
 * POR QUÉ EXISTE ESTE FICHERO. Todo el resto del arnés PINCHA lo que quiere medir:
 * `gotoMobile` fija `skin=…` y la bandera de layout, `gotoGame` fija `skin=faithful`, y el
 * lint `e2e-layout-declarado` obliga a declarar el layout. Eso es correcto para las specs
 * que miden OTRA cosa — pero dejaba al proyecto SIN UN SOLO TESTIGO de lo que ve quien
 * entra por primera vez, que es exactamente el caso que el usuario reporta desde su
 * iPhone y el que sirve la app instalada (`start_url: "/"`, sin parámetros).
 * Un defecto que nadie observa sin parámetros es un defecto que nadie ha comprobado.
 *
 * ⚠ ESTE FICHERO NO DECLARA LAYOUT, Y ES LA ÚNICA EXCEPCIÓN LEGÍTIMA: aquí el layout es
 * LO MEDIDO, no una precondición. No dispara el lint (no llama a `gotoMobile` ni escribe
 * `reflow=`), pero queda dicho por si alguien lo lee como la enfermedad que ese lint
 * persigue: heredar el defecto ES el experimento.
 *
 * 🔴 TRAMPA DE LOCATOR — y la segunda mitad la descubrió ESTE MISMO FICHERO al ponerse
 * rojo, que es para lo que existe. `ShaderSkin.mount()` monta una `FaithfulSkin` REAL
 * dentro de un host oculto (`.shader-skin-src`: 0×0, `overflow:hidden`, `opacity:0`), y
 * `FaithfulSkin` siempre se pone `className="faithful-skin"` (`fiel/skin.ts:2098`).
 *
 *   1. `.faithful-skin` EXISTE EN LAS DOS PIELES ⇒ contarlo no discrimina.
 *   2. ⚠ Y **su VISIBILIDAD TAMPOCO**: la primera versión de §1b afirmaba
 *      `.faithful-skin canvas` NO visible bajo la smooth y salió ROJA en los tres
 *      proyectos. Para Playwright «visible» = caja no vacía + sin `visibility:hidden`;
 *      **`opacity:0` y el recorte de un padre 0×0 NO cuentan**, así que ese canvas
 *      interno de 320×200 se reporta VISIBLE. Medido, no supuesto.
 *
 * ⇒ El único vehículo que discrimina de verdad es la PRESENCIA de `.shader-skin`, que
 * sólo existe cuando la smooth está montada (lo confirma §3a en el sentido contrario:
 * con la fiel montada, `.shader-skin` da count 0). Todo aserto de piel va por ahí.
 */
import { test, expect, type Page } from "@playwright/test";

const overlayIntro = '[data-testid="u5-intro-shader-overlay"]';

/** localStorage limpio = primera visita (y también la app instalada: partición propia). */
async function primeraVisita(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
}

async function mundoMontado(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __u5test?: { worldReady?: () => boolean } }).__u5test?.worldReady?.() ===
      true,
    undefined,
    { timeout: 20_000 },
  );
}

test.describe("defectos de fábrica: qué ve quien entra SIN parámetros", () => {
  // ── §1 · PIEL: la SMOOTH es el defecto ─────────────────────────────────────────
  test("§1a SIN parámetros la CINEMÁTICA ya arranca en smooth (overlay xBR presente)", async ({
    page,
  }) => {
    // El overlay NO existe en modo fiel (protección estructural: la intro fiel es
    // byte-idéntica al DOSBox), así que su presencia es prueba POSITIVA de que el boot
    // resolvió a smooth — y se observa ANTES de montar ninguna piel, que es donde la
    // decisión se toma.
    await primeraVisita(page);
    await page.goto("/");
    await expect(page.locator(".faithful-intro canvas").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(overlayIntro)).toHaveCount(1);
  });

  test("§1b SIN parámetros de piel el MUNDO monta la smooth", async ({ page }) => {
    // `nointro` NO es parámetro de piel ni de layout: sólo salta la cinemática, así que
    // la decisión observada sigue siendo la de fábrica.
    await primeraVisita(page);
    await page.goto("/?nointro");
    // `.shader-skin` SÓLO existe con la smooth montada: es el vehículo que discrimina.
    // (No se afirma nada sobre `.faithful-skin`: existe en las dos pieles y, como se
    // midió al ponerse rojo este test, TAMBIÉN se reporta visible bajo la smooth.)
    await expect(page.locator(".shader-skin canvas").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".shader-skin")).toHaveCount(1);
  });

  // ── §2 · LAYOUT: el PARTIDO es el defecto en táctil ────────────────────────────
  test("§2 SIN parámetros y en táctil, el layout es el PARTIDO", async ({ page }) => {
    await primeraVisita(page);
    await page.goto("/?nointro");
    await mundoMontado(page);
    // Los DOS marcadores: `deck-ancho.ts` scopea TODAS sus reglas bajo esta pareja, así
    // que si falta uno el layout no está aplicado aunque el DOM lo parezca.
    await expect(page.locator('html[data-deck-ancho="bloques"]')).toHaveCount(1);
    await expect(page.locator('html[data-orient="portrait"]')).toHaveCount(1);
  });

  // ── §3 · LA PRECEDENCIA NO SE APAGA AL MOVER EL DEFECTO ────────────────────────
  test("§3a una preferencia de piel EN CONTRA (faithful) gana al defecto smooth", async ({
    page,
  }) => {
    // ★★ EL TESTIGO CRÍTICO, y la razón por la que este bloque existe. Con smooth de
    // fábrica, CUALQUIER test que compruebe la precedencia persistiendo `shader` pasa
    // aunque `main.ts` deje de leer `u5.skin` por completo: no se pone rojo, deja de
    // medir. Éste persiste la piel CONTRARIA al defecto, así que es el único que puede
    // ponerse rojo si la precedencia se rompe — y cubre la rama que este encargo
    // ESTRENÓ (honrar un `"faithful"` persistido), donde vivía el defecto latente.
    await page.addInitScript(() => localStorage.setItem("u5.skin", "faithful"));
    await page.goto("/?nointro");
    await expect(page.locator(".faithful-skin canvas").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".shader-skin canvas")).toHaveCount(0);
  });

  test("§3b una preferencia de layout EN CONTRA (clásico) gana al defecto partido", async ({
    page,
  }) => {
    // El simétrico para el layout: el ▤ tiene que seguir siendo un interruptor de verdad
    // en un móvil, donde el defecto dice lo contrario de lo que el jugador eligió.
    await page.addInitScript(() => localStorage.setItem("u5.layoutPartido", "0"));
    await page.goto("/?nointro");
    await mundoMontado(page);
    await expect(page.locator('html[data-deck-ancho="bloques"]')).toHaveCount(0);
  });
});
