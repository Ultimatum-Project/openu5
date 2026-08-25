/**
 * Creación de personaje por la CINEMÁTICA FIEL (camino CANVAS = producción).
 *
 * Hasta ahora todo el e2e de creación (creation.spec.ts, GT ch01) conduce el
 * FORMULARIO DOM de la piel dev (`?skin=dev`, deterministic y driveable). Ese sigue
 * siendo el arnés de los VALORES del bracket. Pero el camino que corre el usuario por
 * defecto es la cinemática fiel 1988 (`FaithfulIntro`, canvas), con el flujo calcado del
 * DOSBox original (original/av-referencia/gypsy-creation): menú → "Create New Character"
 * → nombre y sexo en el PANEL DEL TÍTULO → escena de narración de la gitana → torneo de
 * 7 preguntas → escena final del Codex → juego.
 * Este spec cubre ese hueco: conduce la creación fiel POR TECLADO en la piel default y
 * asserta que el Avatar resultante casa con el mismo bracket determinista seed-0 que la
 * vía DOM (all-A, M → STR 20 / DEX 18 / INT 22 / MP 22; re/verified/gypsy.md).
 *
 * Determinismo: la intro pinta a canvas sin DOM, así que la fase se lee por el hook
 * DEV read-only `__u5test.introPhase()` (main.ts, sólo DEV). Se avanza el arranque
 * (logos/título/attract) con una tecla INERTE en el menú ("x": no es hotkey J/C/T/U/A/R
 * ni Enter/Space, así que en el menú no dispara nada — intro.ts menuKeyReducer), y se
 * hace poll de la fase para saber cuándo pulsar cada paso.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readState } from "./helpers";

const ALL_A: string[] = ["a", "a", "a", "a", "a", "a", "a"];

/** Fase actual de la cinemática, o null si la intro ya terminó/no montó (hook DEV). */
async function introPhase(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const t = (window as unknown as { __u5test?: { introPhase?: () => string } }).__u5test;
    return t?.introPhase ? t.introPhase() : null;
  });
}

/** Espera a que la fase de la intro sea `target`. */
async function waitPhase(page: Page, target: string): Promise<void> {
  await expect.poll(() => introPhase(page), { timeout: 15_000 }).toBe(target);
}

/**
 * Conduce el arranque (logos → título → attract → menú) y entra en "Create New
 * Character" hasta la fase de NOMBRE de la gitana. Bucle autocorrectivo por fase:
 *   · logo/title/attract (o null, aún sin hook) → "x" (avanza; inerte en el menú).
 *   · menú → "c" (hotkey Create; para el temporizador de idle).
 *   · name → listo.
 * Robusto a: qué láminas/demo estén servidas (cada tramo se salta si su asset falta), a
 * la cadencia del rAF, y a la CARRERA del idle del menú (si el attract se relanza por
 * inactividad menú→attract, la siguiente vuelta re-avanza con "x" y reintenta "c").
 */
async function reachName(page: Page): Promise<void> {
  await expect(page.locator(".faithful-intro canvas").first()).toBeVisible({ timeout: 30_000 });
  for (let i = 0; i < 48; i++) {
    const ph = await introPhase(page);
    if (ph === "name") return;
    await page.keyboard.press(ph === "menu" ? "c" : "x");
    await page.waitForTimeout(100);
  }
  throw new Error(`la intro no llegó a 'name' (fase=${await introPhase(page)})`);
}

/** Corre la creación fiel completa por teclado y espera al mundo montado. */
async function createFaithful(
  page: Page,
  name: string,
  gender: "m" | "f",
  answers: string[],
): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?skin=faithful");
  await reachName(page); // boot → menú → Create → fase de nombre

  await page.keyboard.type(name, { delay: 20 });
  await page.keyboard.press("Enter");

  await waitPhase(page, "sex");
  await page.keyboard.press(gender);

  // Tras el sexo, la escena de NARRACIÓN de la gitana (create:0 + narración[0], ORIG_04):
  // una tecla arranca el torneo.
  await waitPhase(page, "cast");
  await page.keyboard.press("x");

  await waitPhase(page, "quiz");
  for (const a of answers) {
    await page.keyboard.press(a);
    await page.waitForTimeout(40);
  }

  // El 7º A NO entra al juego directo: va la escena FINAL del Codex (narración[1], ORIG_12).
  // Una tecla la cierra, finaliza los stats y arranca el mundo.
  await waitPhase(page, "epilogue");
  await page.keyboard.press("x");

  // Al cerrar la escena final, la intro resuelve → main.ts aplica la creación y monta el
  // mundo. `worldReady` se añade al __u5test durante el boot del mundo (main.ts), en
  // AMBAS pieles: su mera existencia marca el fin del arranque.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const t = (window as unknown as { __u5test?: { worldReady?: () => boolean } }).__u5test;
          return !!(t?.worldReady && t.worldReady());
        }),
      { timeout: 20_000 },
    )
    .toBe(true);
  // La cinemática se desmontó al terminar (no quedó DOM de intro huérfano).
  await expect(page.locator(".faithful-intro")).toHaveCount(0);
}

test("la creación por la CINEMÁTICA FIEL produce el Avatar del bracket seed-0 (all-A, M)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await createFaithful(page, "Avatar", "m", ALL_A);

  // Mismo bracket determinista que la vía DOM (re/verified/gypsy.md; distinto de
  // cualquier plantilla por defecto → si por error hubiéramos disparado "Journey
  // Onward" en vez de "Create", estos valores NO casarían).
  const a = await readState<Record<string, number>>(page, "characters[0]");
  expect(a.strength).toBe(20);
  expect(a.dexterity).toBe(18);
  expect(a.intelligence).toBe(22);
  expect(a.currentMp).toBe(22); // MP = INT (FONT 0x0dce)
  expect(a.currentHp).toBe(60); // intacto de INIT.GAM (la gitana no toca HP)
  expect(a.maxHp).toBe(60);
  expect(a.level).toBe(2);
  expect(await readState<string>(page, "characters[0].name")).toBe("Avatar");
  expect(await readState<number>(page, "characters[0].gender")).toBe(0x0b); // 'M' (FONT 0x0be8)

  // Se creó por el CANVAS fiel, no por el formulario DOM: la pantalla de TÍTULO DOM (que
  // arranca la creación por formulario) sólo existe en la piel dev, y aquí no está. (No
  // se comprueba `input.save-name`: esa clase la comparte el panel de saves, montado
  // siempre en el DOM — ver shell-menu.spec.ts.)
  await expect(page.locator(".title-screen")).toHaveCount(0);

  expect(errors).toEqual([]);
});

test("el sexo femenino se escribe en el registro por la vía canvas (F → 0x0C)", async ({ page }) => {
  await createFaithful(page, "Mystra", "f", ALL_A);
  expect(await readState<number>(page, "characters[0].gender")).toBe(0x0c); // 'F' (FONT 0x0c16)
  expect(await readState<string>(page, "characters[0].name")).toBe("Mystra");
});
