/**
 * Journey E2E — movimiento, colisiones y reloj.
 *
 * Reglas EXACTAS del original (core/world/movement.ts, derivadas en
 * re/notes/kernel-survival.md §5, paridad DOSBox en re/parity/kernel/):
 *   - Exterior (MAINOUT.OVL): un paso normal cuesta 2 minutos; "Blocked!" NO
 *     consume tiempo ni turno (0xC30-0xC36).
 *   - Pueblo (TOWN.OVL): toda acción aceptada cuesta 1 minuto, INCLUIDO el
 *     movimiento bloqueado ("Blocked!", bucle 0x15D4). Salir por el borde no
 *     consume minuto.
 *
 * Coordenadas elegidas LEYENDO los mapas reales (game/assets/maps/), no
 * adivinadas:
 *   - Overworld (76,40): tile 5 Grass, vecino este (77,40) también Grass. En
 *     terreno normal de DÍA el gate de spawn (spawn_threshold=1, rand(1,30)≥1)
 *     NUNCA dispara encuentro (core/world/loops/spawn.ts §14-16) → paso libre
 *     determinista, sin combate flaky.
 *   - Iolo's Hut loc13 (15,15): la casilla del Avatar es 145 ChairBackLeft
 *     (walkable); el vecino ESTE (16,15) es 148 TableLeft (no walkable) → el
 *     paso a la derecha da "Blocked!" contra la mesa. Es EXACTAMENTE el caso
 *     observado en vivo en la Fase 0 (8:35→8:36 contra la mesa).
 *
 * Rutas de estado REALES (GameState, game/src/core/state.ts): la posición es
 * `position = { location, floor, x, y }` y el reloj `time = { hour, minute, ... }`.
 */
import { test, expect } from "@playwright/test";
import { gotoGame, readState, hudLog, consoleText } from "./helpers";

interface Pos {
  x: number;
  y: number;
}
interface Clock {
  hour: number;
  minute: number;
}

test("un paso libre en el overworld avanza posición y reloj (+2 min)", async ({ page }) => {
  // (76,40) Grass con Grass al este; hora 10 (día) → sin encuentro posible.
  await gotoGame(page, { loc: 0, x: 76, y: 40, hour: 10 });

  const before = await readState<Pos>(page, "position");
  const tBefore = await readState<Clock>(page, "time");

  await page.keyboard.press("ArrowRight");

  const after = await readState<Pos>(page, "position");
  const tAfter = await readState<Clock>(page, "time");

  // El paso se aplicó: x+1, y intacto.
  expect(after.x).toBe(before.x + 1);
  expect(after.y).toBe(before.y);
  // Exterior en terreno normal: +2 minutos (MINUTES_PER_ACTION_OUTDOORS).
  expect(tAfter.hour).toBe(tBefore.hour);
  expect(tAfter.minute).toBe(tBefore.minute + 2);

  // (El valor del reloj queda aseverado arriba por estado. El formato "H:MM AM/PM" lo
  // pintaba el HUD DOM sólo-dev, jubilado en la fase 2; la piel fiel lo dibuja al canvas
  // — su fidelidad visual es del eje píxel-diff, no de este spec de mecánica.)
});

test("Blocked! contra la mesa NO mueve pero cobra 1 minuto (regla exacta de TOWN)", async ({
  page,
}) => {
  // Estado canónico de INIT: Iolo's Hut (15,15) 8:35, mesa (148) al este.
  await gotoGame(page);

  const before = await readState<Pos>(page, "position");
  const tBefore = await readState<Clock>(page, "time");

  await page.keyboard.press("ArrowRight");

  const log = await hudLog(page);
  expect(log.join("\n")).toContain("Blocked!");

  // La posición NO cambia (chocó contra TableLeft en 16,15).
  const after = await readState<Pos>(page, "position");
  expect(after.x).toBe(before.x);
  expect(after.y).toBe(before.y);

  // Pero el binario cobra el minuto igualmente en pueblo (8:35 → 8:36).
  const tAfter = await readState<Clock>(page, "time");
  expect(tAfter.hour).toBe(tBefore.hour);
  expect(tAfter.minute).toBe(tBefore.minute + 1);
  // (Reloj = 8:36 ya aseverado por estado; el HUD DOM que lo formateaba era sólo-dev.)
});

test("salir del pueblo por el borde oeste PREGUNTA y, con 'Y', transiciona al overworld", async ({
  page,
}) => {
  // Iolo's Hut, pegado al borde oeste: un paso al oeste toca el borde del small
  // map. Regla EXACTA del original (kernel-survival.md §5.1, TOWN:0x600): NO sale
  // de inmediato — pregunta "Dost thou wish to leave?" (DS 0x2690). 'Y' sale al
  // overworld (loc 0). Ya NO hay auto-salida ni "Leaving..." (F1.3 Flow 1).
  await gotoGame(page, { loc: 13, x: 0, y: 15 });

  await page.keyboard.press("ArrowLeft");

  // El prompt aparece y aún NO ha salido.
  await expect.poll(() => consoleText(page)).toMatch(/Dost thou wish to leave\?/i);
  expect(await readState<number>(page, "position.location")).toBe(13);

  await page.keyboard.press("y");

  // Location vuelve a 0 (Britannia/overworld).
  expect(await readState<number>(page, "position.location")).toBe(0);
});

// Regla EXACTA del original (kernel-survival.md §5.1, TOWN:0x600, verificado
// contra DOSBox): al pisar el borde con un paso transitable, el binario pregunta
// "Dost thou wish to leave?" (DS 0x2690) — 'Y' sale al overworld SIN cobrar
// minuto; 'N'/ESC NO salen y cobran 1 minuto (TOWN:0x15D4). Portado en F1.3
// (Flow 1): pendingPrompt yesno-esc + game.confirmTownExit.
test("el borde pregunta 'Dost thou wish to leave?' — Y sale sin minuto, N cobra 1, ESC=N", async ({
  page,
}) => {
  await gotoGame(page, { loc: 13, x: 0, y: 15 });

  // (1) 'N' al prompt: NO sale y cobra 1 minuto (TOWN:0x15D4).
  const tBefore = await readState<Clock>(page, "time");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => consoleText(page)).toMatch(/Dost thou wish to leave\?/i);
  await page.keyboard.press("n");
  expect(await readState<number>(page, "position.location")).toBe(13); // sigue en el pueblo
  const tAfterNo = await readState<Clock>(page, "time");
  expect(tAfterNo.minute).toBe(tBefore.minute + 1);

  // (2) ESC al prompt = N: tampoco sale y cobra 1 minuto más.
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => consoleText(page)).toMatch(/Dost thou wish to leave\?/i);
  await page.keyboard.press("Escape");
  expect(await readState<number>(page, "position.location")).toBe(13);
  const tAfterEsc = await readState<Clock>(page, "time");
  expect(tAfterEsc.minute).toBe(tAfterNo.minute + 1);

  // (3) 'Y' al prompt: sale al overworld SIN cobrar minuto.
  await page.keyboard.press("ArrowLeft");
  const tBeforeYes = await readState<Clock>(page, "time");
  await page.keyboard.press("y");
  expect(await readState<number>(page, "position.location")).toBe(0);
  const tAfterYes = await readState<Clock>(page, "time");
  expect(tAfterYes.minute).toBe(tBeforeYes.minute); // salir no cuesta minuto
});
