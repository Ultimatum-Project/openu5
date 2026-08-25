/**
 * Journey E2E — Ztats (z), el único overlay modal de consulta que queda tras
 * retirar los paneles QoL Journal (F6) y Minimap (Tab) — 26-07, veredicto del
 * usuario: el original no tiene diario ni mapa gratis (el mapa es (V)iew con
 * gema, kernel 0x341A, ya cubierto por su vía fiel).
 *
 * Mecanismo real (verificado en main.ts): tecla `z` togglea; la piel fiel pinta
 * la ficha en su overlay de canvas. Mientras Ztats está visible se ignora
 * cualquier otra tecla que no sea `z`.
 *
 * Datos del party: createCharacter aplica el cuestionario al Avatar (registro 0)
 * y conserva el resto de la plantilla INIT, así que el party arranca con el
 * Avatar recién creado + Shamino/Iolo/… (assets/initial-state.json). Con
 * respuestas all-A el Avatar sale STR 20 (mismo cálculo que creation.spec).
 */
import { test, expect } from "@playwright/test";
import { createCharacter, readState } from "./helpers";

const ALL_A = ["A", "A", "A", "A", "A", "A", "A"] as const;

test("Ztats (z): la ficha refleja el party (Avatar del quiz + Shamino de INIT) y el toggle no rompe", async ({
  page,
}) => {
  await createCharacter(page, "Panels", "M", [...ALL_A]);

  // La ficha Ztats la pinta la piel fiel en su overlay de CANVAS (el panel DOM
  // `.ztats-panel` era sólo-dev, jubilado): su CONTENIDO no es observable por DOM ni hook.
  // Se aseveran los DATOS que la ficha reflejaría, vía el estado real:
  //   · el Avatar recién creado (registro 0) con su STR exacta del quiz all-A,
  expect(await readState<string>(page, "characters[0].name")).toBe("Panels");
  expect(await readState<number>(page, "characters[0].strength")).toBe(20);
  //   · y el compañero heredado de la plantilla INIT (segundo registro).
  expect(await readState<string>(page, "characters[1].name")).toBe("Shamino");

  // El overlay Z de la piel (abre con z, cierra con Space, como faithful.spec.ts) y un
  // turno después no rompen el juego.
  await page.keyboard.press("z");
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".faithful-skin canvas")).toBeVisible();
});



