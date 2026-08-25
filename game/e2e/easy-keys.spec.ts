/**
 * F1.8-T1 — E2E de las teclas de salida rápida cableadas en main.ts:
 * Space (Pass), I (Ignite torch en overworld), P (Push) y N (New Order).
 * Pulsan las TECLAS REALES sobre el juego montado; verifican el copy derivado
 * (scout-dispatch.md / kernel-survival.md) y la convención de turno.
 *
 * Las coordenadas de overworld (60,60) son las mismas que usa commands.spec.ts
 * para el Klimb exterior (loc por defecto 0 al pasar x/y sin `loc`).
 */
import { test, expect } from "@playwright/test";
import { gotoGame, readState, hudLog, consoleText } from "./helpers";

test("Space pasa el turno: imprime 'Pass' y avanza el reloj sin mover al party", async ({ page }) => {
  await gotoGame(page, { x: 60, y: 60 }); // overworld
  const x0 = await readState<number>(page, "position.x");
  const before = await page.evaluate(() => {
    const s = (window as unknown as { __u5test: { state(): { time: { hour: number; minute: number } } } }).__u5test.state();
    return s.time.hour * 60 + s.time.minute;
  });
  await page.keyboard.press(" ");
  expect((await hudLog(page)).join("\n")).toContain("Pass");
  expect(await readState<number>(page, "position.x")).toBe(x0); // Pass no mueve
  const after = await page.evaluate(() => {
    const s = (window as unknown as { __u5test: { state(): { time: { hour: number; minute: number } } } }).__u5test.state();
    return s.time.hour * 60 + s.time.minute;
  });
  expect(after).toBe(before + 2); // coste base exterior = 2 min
});

test("I enciende antorcha en overworld: gasta una antorcha y fija el temporizador de luz", async ({ page }) => {
  await gotoGame(page, { x: 60, y: 60 }); // overworld (el gap era I fuera de mazmorra)
  await page.evaluate(() => {
    (window as unknown as { __u5test: { game: { state: { torches: number; torchTurns: number } } } }).__u5test.game.state.torches = 2;
    (window as unknown as { __u5test: { game: { state: { torches: number; torchTurns: number } } } }).__u5test.game.state.torchTurns = 0;
  });
  await page.keyboard.press("i");
  // El "Torch ignited!" del port era FABRICADO (purgado por la 8ª caza anti-fab; game.ts:
  // igniteTorch devuelve null en éxito = SILENCIOSO). Se asevera el EFECTO, no el string.
  expect(await readState<number>(page, "torches")).toBe(1); // gasta una antorcha
  // Fuera de mazmorra g_torch_mins = 240 fijo; el turno (2 min) lo baja a 238.
  expect(await readState<number>(page, "torchTurns")).toBe(238);
});

test("P pide dirección ('Push-') y sobre terreno vacío responde 'Won't budge!'", async ({ page }) => {
  await gotoGame(page, { x: 60, y: 60 }); // overworld abierto: nada empujable al lado
  await page.keyboard.press("p");
  expect((await hudLog(page)).join("\n")).toContain("Push-");
  await page.keyboard.press("ArrowRight");
  expect((await hudLog(page)).join("\n")).toContain("Won't budge!");
});

test("N abre el selector de New Order ('Swap — who?')", async ({ page }) => {
  await gotoGame(page, { x: 60, y: 60 });
  await page.keyboard.press("n");
  // El selector de party (New Order) es el picker por CANVAS de la piel fiel (pickMember →
  // startPartyMemberPicker imprime el título por consola; el panel DOM `.save-title` era
  // sólo-dev, jubilado). El prompt "Swap — who?" sale por la consola lógica.
  await expect.poll(() => consoleText(page)).toContain("Swap — who?");
});
