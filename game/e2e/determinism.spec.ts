import { test, expect } from "@playwright/test";
import { gotoGame, readState } from "./helpers";

/**
 * Barrido de determinismo del stream vivo (Fase 1.1, F.2 — deliberate-divergences
 * §2). El juego consume UN único `OriginalRng` vivo (`game.liveRng`) para todo el
 * turno: viento → reloj → hazards → housekeeping → gate de spawn → placement, más
 * combate/mazmorra sobre el mismo stream. `?seed=` (main.ts) / `__u5test.reseed`
 * lo siembran. La prueba de fidelidad: dos partidas con la MISMA seed y las
 * MISMAS acciones reproducen la MISMA secuencia de estado; seeds distintas
 * divergen (el stream es la única fuente).
 *
 * Se captura la secuencia COMPLETA (snapshot tras cada acción), no sólo el estado
 * final: cualquier desincronización del stream se detecta en el primer paso donde
 * ocurre, no sólo si sobrevive hasta el final.
 */

/** Snapshot del estado observable por la UI (posición/hora/oro/HP del party). */
async function snapshot(page: import("@playwright/test").Page): Promise<string> {
  const pos = await readState(page, "position");
  const hour = await readState(page, "time.hour");
  const minute = await readState(page, "time.minute");
  const gold = await readState<number>(page, "gold");
  const hp = await readState(page, "characters[0].currentHp");
  return JSON.stringify({ pos, hour, minute, gold, hp });
}

/**
 * Arranca con `seed` en (x,y,hour) y ejecuta `actions`, devolviendo la SECUENCIA
 * de snapshots (uno por acción). Mezcla movimiento (flechas) y `search` (que tiquea
 * el world-turn SIN mover a la party) para ejercitar el gate de spawn y el
 * housekeeping por el stream vivo. El token `"search"` pulsa 's'+flecha: tras el
 * fix #47 Search es DIRECCIONAL (SJOG 0x095C pide dirección), así que ya no tiquea
 * turno "en seco" — necesita una dirección, que se resuelve aquí con ArrowUp.
 */
async function playSequence(
  page: import("@playwright/test").Page,
  seed: number,
  actions: string[],
  start: { x: number; y: number; hour: number },
): Promise<string[]> {
  await gotoGame(page, { ...start, seed });
  const seq: string[] = [];
  for (const key of actions) {
    if (key === "search") {
      // Search direccional = 1 turno de mundo en el sitio (no mueve a la party).
      // C6: con party>1 sin activo, Search pide PJ (kernel 0x4988 «Player: ») —
      // Enter confirma el cursor (miembro 0); con party de 1 el Enter es inerte.
      await page.keyboard.press("s");
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("Enter");
    } else {
      await page.keyboard.press(key);
    }
    seq.push(await snapshot(page));
  }
  return seq;
}

// Ronda de 4 pasos + búsquedas intercaladas; repetida N veces recorre terreno
// variado (posible lento) y consume muchos turnos del stream.
const ROUND = ["search", "ArrowUp", "search", "ArrowRight", "search", "ArrowDown", "search", "ArrowLeft"];
const ACTIONS = Array.from({ length: 6 }, () => ROUND).flat();

test("dos partidas con la misma seed reproducen la misma secuencia de estado", async ({ page }) => {
  test.setTimeout(120_000);
  const start = { x: 102, y: 43, hour: 2 }; // exterior, noche (gate de spawn alto)
  const a = await playSequence(page, 4242, ACTIONS, start);
  const b = await playSequence(page, 4242, ACTIONS, start);
  expect(a).toEqual(b);
});

test("cruzar medianoche es determinista por seed (re-roll de Shadowlords en el stream)", async ({ page }) => {
  test.setTimeout(120_000);
  // hour 23 + ~60+ turnos de 2 min → cruza las 00:00; el re-roll de Shadowlords
  // (advanceClock 0x4FF5) rueda por el mismo stream vivo → sigue siendo reproducible.
  const start = { x: 102, y: 43, hour: 23 };
  const a = await playSequence(page, 909, ACTIONS, start);
  const b = await playSequence(page, 909, ACTIONS, start);
  expect(a).toEqual(b);
});

test("seeds distintas divergen en algún punto de la secuencia", async ({ page }) => {
  test.setTimeout(120_000);
  const start = { x: 102, y: 43, hour: 2 };
  const a = await playSequence(page, 1, ACTIONS, start);
  const b = await playSequence(page, 987654, ACTIONS, start);
  // El stream gobierna gate de spawn, placement y housekeeping: dos semillas muy
  // separadas producen historias distintas en algún paso de la secuencia.
  expect(a).not.toEqual(b);
});
