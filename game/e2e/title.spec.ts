/**
 * ARRANQUE DESDE LA PLANTILLA INIT ("Journey Onward"). Este spec cubría la pantalla de
 * TÍTULO DOM de la piel dev (`.title-screen` + botones "Journey Onward"/"Create New
 * Character"); jubilada la piel dev (fase 2), ese título DOM ya no existe — la fiel pinta
 * el título en la cinemática canvas (cubierta por `faithful.spec.ts` y la creación por
 * `creation-faithful.spec.ts`). Lo que queda aquí, adaptado a la fiel, es el OBSERVABLE
 * de "Journey Onward desde INIT": el mundo arranca en la plantilla canónica (Iolo's Hut,
 * 8:35), sin depender de píxeles.
 *
 * 🔴 AQUÍ HUBO UN ASERTO DE CONSOLA Y SE RETIRÓ CON LA FICHA #116, no por adelgazar el
 * test: esperaba `"Welcome to Britannia!"`, la bienvenida que el clon imprimía al montar
 * el mundo y que el original NO tiene (derivación en `game/src/main.ts`, donde estaba el
 * emisor). Un aserto sobre una línea que no debe existir es una guarda que sujeta la
 * divergencia. Lo que aquel aserto probaba de verdad —que el pipeline core→piel entrega a
 * la consola al arrancar— lo prueba `easy-keys.spec.ts` («Space imprime Pass») sobre el
 * MISMO `gotoGame`, y con una cadena que el original sí emite (DS 0xa134). Aquí se queda
 * el observable de INIT.GAM, que nunca dependió del log: posición y reloj.
 */
import { test, expect } from "@playwright/test";
import { gotoGame, readState } from "./helpers";

interface Pos {
  location: number;
  floor: number;
  x: number;
  y: number;
}

test("el arranque fiel no monta el título DOM de la dev (jubilada)", async ({ page }) => {
  await gotoGame(page);
  // La pantalla de título DOM y sus botones eran sólo-dev: no existen.
  await expect(page.locator(".title-screen")).toHaveCount(0);
  await expect(page.locator(".title-new")).toHaveCount(0);
  await expect(page.locator(".title-create")).toHaveCount(0);
  // La fiel pinta en canvas.
  await expect(page.locator(".faithful-skin canvas")).toBeVisible();
});

test("Journey Onward arranca la partida desde INIT (plantilla canónica)", async ({ page }) => {
  await gotoGame(page); // `nointro` = Journey Onward: monta el mundo desde la plantilla INIT
  // Estado canónico de INIT.GAM: Iolo's Hut (loc 13) a las 8:35.
  const pos = await readState<Pos>(page, "position");
  expect(pos).toMatchObject({ location: 13, x: 15, y: 15 });
  expect(await readState<number>(page, "time.hour")).toBe(8);
  expect(await readState<number>(page, "time.minute")).toBe(35);
});
