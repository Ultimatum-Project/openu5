/**
 * #373 · El CAMINO del quake VISUAL del rito — core → applyEvents → coreview → piel (QuakeShake).
 *
 * EL HUECO QUE PINEA (hermano exacto de #371, canal VISUAL): la QuakeShake la deriva la
 * piel de los events de `onTurn` (fiel/skin.ts `planVisualPhase`), y `onTurn` sólo lo
 * dispara el `view.notifyTurn(events)` del FINAL de `applyEvents` — que las CINCO ramas
 * terminales (refuge, troll-sneak, shrine-scene, shrine-key-wait, endgame) saltan con
 * `return`. #371 reparó el canal de AUDIO con `flushSfxPrefix`; los `{kind:"quake"}` de la
 * ceremonia del Códice (CAST2 0x0dc0/0x0dd7/0x0dee) viajan troceados entre las esperas de
 * tecla (#294) y morían igual: rumble sonando (post-#371) y pantalla QUIETA. El fix es
 * `flushEventPrefix` (la generalización de flushSfxPrefix a los kinds de presentación del
 * prefijo consumido: sfx + quake/cell-explosion/cell-projectile vía `emitTurnFx`).
 *
 * CÓMO MIDE: `__u5test.fxActive()` = `SkinManager.transientFxActive` — el MISMO getter que
 * gobierna el repintado del bucle rAF de la piel (incluye `quake.active`); no se replica
 * ningún predicado. Durante la ceremonia del Códice no hay ningún otro fx transitorio
 * vivo (sin explosiones, sin transit, sin apparition), así que en esa ventana
 * `fxActive() === true` ⇔ la sacudida está viva. El control positivo de la MISMA corrida
 * es un `{kind:"quake"}` empujado por `__u5test.applyEvents` en batch COMPLETO (sin
 * corte), que enruta por el `notifyTurn` de siempre — el camino que nunca estuvo roto.
 *
 * `?scenebeat=1` (como en #371): las esperas de tecla APARCAN de verdad (no drenan
 * síncrono) y la escena corre a 1 ms — los mismos cortes y re-aplicaciones que ve un
 * jugador, en milisegundos. La QuakeShake NO está escalada por scenebeat (reloj de pared
 * de la piel): 8 pulsos × 117 ms ≈ 0,94 s por ráfaga, 3 ráfagas del lote ≈ 2,8 s.
 *
 * SIN DOBLES / PREFIJO EXACTO (asertos, no prosa): el test del corta-y-reaplica comprueba
 * (a) que el quake del prefijo sacude UNA vez y NO re-sacude cuando la tecla re-aplica el
 * resto (si el flush y el notifyTurn enrutaran el mismo prefijo, habría segunda sacudida
 * tras la tecla), y (b) que un quake DEL RESTO no se anticipa al corte (si el flush
 * publicara el array entero en vez del prefijo, sacudiría ANTES de la tecla) y llega UNA
 * vez al completar el tramo re-aplicado.
 */
import { test, expect } from "@playwright/test";
import { gotoGame, consoleText, skinCycleReady } from "./helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type U5Win = Window & { __u5test: any };

/** ¿Hay un fx transitorio (sacudida incluida) pintándose AHORA en la piel activa? */
async function fxActive(page: import("@playwright/test").Page): Promise<boolean | null> {
  return page.evaluate(() => (window as unknown as U5Win).__u5test.fxActive());
}

test("#373 · ceremonia del Códice: las tres ráfagas del «viento» sacuden la pantalla (y el control por camino normal)", async ({ page }) => {
  test.setTimeout(60_000);
  // Party directamente SOBRE la celda del Codex (233,233 — la única 0x11 del sobremundo;
  // el guardián de (233,235) es on-step y el deep-link no lo pisa). La ceremonia de las
  // 8 virtudes exige: última virtud pendiente en el quest-bitmap y las otras 7 visitadas
  // — la lección de hoy escribe el 8º bit y el gate 0x0da2 (bitmap==0xFF) abre el viento.
  await gotoGame(page, { x: 233, y: 233, seed: 1 }, ["scenebeat=1"]);
  // La piel debe estar MONTADA (suscrita al view) antes de empujar eventos: `worldReady`
  // se cumple con el SkinManager aun ocupado (carrera documentada en skinCycleReady) y un
  // quake publicado en esa ventana no tiene listener que lo derive a la QuakeShake.
  await skinCycleReady(page);
  await page.evaluate(() => {
    const s = (window as unknown as U5Win).__u5test.state();
    s.shrineQuestBitmap = 0x80; // Humildad pendiente
    s.shrineVisitedBitmap = 0x7f; // las otras siete aprendidas
  });
  // CONTROL POSITIVO en la misma corrida, ANTES de la ceremonia: un quake en batch
  // COMPLETO entra por notifyTurn (el camino sano). Si esto no enciende fxActive, el
  // instrumento está roto y el aserto del camino no significa nada.
  expect(await fxActive(page)).toBe(false);
  await page.evaluate(() => (window as unknown as U5Win).__u5test.applyEvents([{ kind: "quake" }]));
  await expect.poll(() => fxActive(page)).toBe(true);
  await expect.poll(() => fxActive(page), { timeout: 5_000 }).toBe(false); // se apaga sola (~0,94 s)

  // (E)nter sobre el Codex → mensaje + escena de entrada (#277, drena a 1 ms) → la
  // primera espera de tecla (0x0d2b) aparca el resto.
  await page.keyboard.press("e");
  await expect.poll(() => consoleText(page)).toMatch(/Codex of Ultimate Wisdom lies before thee/);
  // PRIMERA espera (0x0d2b): no tiene observable propio (no imprime nada al armarse) y la
  // escena de entrada corre a reloj de pared — una tecla única RACEA con el pacer (medido
  // en la sonda pre-fix: el espacio se lo tragaba la escena modal). Bucle autocorrectivo
  // estilo `reachName`: presiona y sondea hasta que el tramo re-aplicado imprime su texto.
  // Las esperas SIGUIENTES se arman SÍNCRONAS dentro del keydown (consumeKey →
  // applyEvents(rest)), así que a partir de aquí basta una tecla por tramo.
  await expect
    .poll(
      async () => {
        await page.keyboard.press(" ");
        return consoleText(page);
      },
      { timeout: 15_000 },
    )
    .toMatch(/The book is open to the page thou dost seek!/);
  await page.keyboard.press(" ");
  await expect.poll(() => consoleText(page)).toMatch(/Upon the hallowed page thou dost read:/);
  await page.keyboard.press(" ");
  await expect.poll(() => consoleText(page)).toMatch(/Pride is a vice/);
  // La CUARTA tecla (espera 0x0d9f) libera el tramo de la ceremonia: [quake,sfx]×3 +
  // «A STRANGE WIND…» + espera 0x0df8 (corte). El flush del prefijo consumido publica
  // los TRES quake → sacudida sostenida de 24 pulsos (~2,8 s), como el lote completo.
  await page.keyboard.press(" ");
  await expect.poll(() => consoleText(page)).toMatch(/A STRANGE WIND CAUSES THE PAGE TO TURN!/);
  // EL ASERTO DEL CAMINO (#373): la sacudida está VIVA tras el corte. Pre-fix: false
  // para siempre (el quake moría detrás del return de shrine-key-wait).
  await expect.poll(() => fxActive(page)).toBe(true);
  // Y se apaga sola al agotar las 3×8 ráfagas — no queda armada para siempre.
  await expect.poll(() => fxActive(page), { timeout: 8_000 }).toBe(false);
});

test("#373 · corta-y-reaplica: el quake del prefijo sacude al cortar y NO re-sacude al re-aplicar el resto", async ({ page }) => {
  await gotoGame(page, { x: 232, y: 66, seed: 1 }, ["scenebeat=1"]);
  // La piel debe estar MONTADA (suscrita al view) antes de empujar eventos: `worldReady`
  // se cumple con el SkinManager aun ocupado (carrera documentada en skinCycleReady) y un
  // quake publicado en esa ventana no tiene listener que lo derive a la QuakeShake.
  await skinCycleReady(page);
  // Turno REAL-shaped por el pipeline vivo (mismo hook que #371 test 4): con scenebeat=1
  // la espera aparca de verdad. Prefijo = [quake]; resto = [message].
  await page.evaluate(() => {
    (window as unknown as U5Win).__u5test.applyEvents([
      { kind: "quake" },
      { kind: "shrine-key-wait" },
      { kind: "message", text: "TESTIGO-373-RESTO\n" },
    ]);
  });
  // El corte flushea el prefijo: la sacudida arranca YA (sin esperar la tecla).
  await expect.poll(() => fxActive(page)).toBe(true);
  // …y se agota (8 pulsos ≈ 0,94 s) ANTES de tocar la tecla.
  await expect.poll(() => fxActive(page), { timeout: 5_000 }).toBe(false);
  // La tecla re-aplica el resto ([message] completa el bucle y pasa por notifyTurn). Si
  // el prefijo viajara TAMBIÉN en el resto (doble enrutado), aquí habría SEGUNDA sacudida.
  await page.keyboard.press(" ");
  await expect.poll(() => consoleText(page)).toMatch(/TESTIGO-373-RESTO/); // control: el resto SÍ se re-aplicó
  await page.waitForTimeout(300); // ventana generosa frente al arranque inmediato del trigger
  expect(await fxActive(page)).toBe(false); // sin dobles
});

test("#373 · prefijo EXACTO: el quake del RESTO no se anticipa al corte y llega UNA vez al re-aplicar", async ({ page }) => {
  await gotoGame(page, { x: 232, y: 66, seed: 1 }, ["scenebeat=1"]);
  // La piel debe estar MONTADA (suscrita al view) antes de empujar eventos: `worldReady`
  // se cumple con el SkinManager aun ocupado (carrera documentada en skinCycleReady) y un
  // quake publicado en esa ventana no tiene listener que lo derive a la QuakeShake.
  await skinCycleReady(page);
  // Prefijo sin quake; el quake viaja DETRÁS de la espera. Si el flush publicara el
  // array ENTERO (en vez del prefijo consumido), sacudiría ANTES de la tecla — este
  // aserto es el que mata a ese mutante.
  await page.evaluate(() => {
    (window as unknown as U5Win).__u5test.applyEvents([
      { kind: "message", text: "TESTIGO-373-PREFIJO\n" },
      { kind: "shrine-key-wait" },
      { kind: "quake" },
    ]);
  });
  await expect.poll(() => consoleText(page)).toMatch(/TESTIGO-373-PREFIJO/); // el corte ya ocurrió
  await page.waitForTimeout(300);
  expect(await fxActive(page)).toBe(false); // nada se anticipó
  // La tecla re-aplica el resto, que COMPLETA el bucle: el quake entra por notifyTurn.
  await page.keyboard.press(" ");
  await expect.poll(() => fxActive(page)).toBe(true);
  await expect.poll(() => fxActive(page), { timeout: 5_000 }).toBe(false);
});
