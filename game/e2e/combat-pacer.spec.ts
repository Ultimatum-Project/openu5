/**
 * PACER DE LA TANDA ENEMIGA (careo-combate T11) — cobertura de la clase «solo-live»
 * (auditoría de calidad Q2 lote-tests + G3 lote-guardas, spec UNIFICADO en la
 * reconciliación del triple fix del pacer): bajo Playwright `navigator.webdriver`
 * pone ENEMY_BEAT_MS=0 y TODO el bloque del pacer (setTimeout de beats, cola de
 * teclas, gate del cursor, combatPacer=null al cerrar) era código muerto para la
 * suite — la regresión del pacer fugado (task #53) aterrizó en verde por
 * construcción, y el propio paceo T11 era código muerto TAMBIÉN en vivo (la piel
 * asumía que `tickEnemyTurns` procesaba UNA acción, pero drena la tanda entera).
 *
 * API canónica tras la reconciliación: el pump de main.ts pacea con
 * `Combat.tickEnemyTurnStep()` (hotfix; beat ANTES de cada acción, auto-arranque
 * en combat-started) y la sonda DEV única es `__u5test.combatPacer()` — subsume
 * las sondas combatPacerActive/combatQueueLength del spec de G3, cuyas
 * aserciones (armado→encolado→drenaje→cierre limpio + mundo respondiendo tras el
 * combate) viven aquí. `?combeat=<ms>` va como PARÁMETRO del helper: el ciclo
 * completo corre a 400 ms (la cadencia fiel del careo T11) y el valor 250 del
 * spec de G3 conserva su test de armado/drenaje (el knob no está cableado a un
 * único valor).
 *
 * QUÉ VERIFICA (test 1, ciclo completo ?combeat=400):
 *   1. el knob rige (beatMs=400, manda sobre el default webdriver→0);
 *   2. AUTO-ARRANQUE (hotfix): con iniciativa enemiga la tanda de apertura corre
 *      SOLA (paceada) y llega al reposo (prompt del PJ) sin pulsar nada;
 *   3. el gate del cursor (F-G): awaitingInput=false mientras la tanda corre;
 *   4. las teclas pulsadas durante la tanda se ENCOLAN (buffer BIOS) y se
 *      DRENAN EN ORDEN al terminar (la 'a' drenada arma el Aim — eco en consola);
 *   5. al cerrar el combate el pacer queda desarmado (active=false, cola vacía)
 *      y el MUNDO SIGUE RESPONDIENDO al input (G3: sin cursor tragado ni timer
 *      huérfano moviendo un combate muerto).
 * Test 2 (?combeat=250, el valor del spec de G3): armado y drenaje a otro beat.
 * Test 3: contrato del default — SIN `?combeat`, bajo webdriver el beat es 0 y
 * la tanda se resuelve síncrona (cola siempre vacía), el flujo byte-idéntico que
 * asumen el resto de specs y el grand-tour.
 *
 * ENTRADA DETERMINISTA (patrón attack.spec — robusto ante cambios fieles del
 * stream de spawn: NADA de andar N turnos esperando encuentro): se siembra un
 * enemigo errante adyacente y se ataca con (A) + dirección. El def elegido es
 * SKELETONS (index 33, maxPerMap=8): rollEncounterGroup fuerza count EXACTO = 8
 * (encounters.ts — los maxPerMap ∈ {1,8,16} no ruedan rand), así la tanda
 * enemiga tiene SIEMPRE 8 acciones → el pacer se arma con certeza, sin RNG.
 * El party de combate son los partyMembers REALES del INIT (3 PJ — mutar
 * state.partySize NO recorta el roster de combate, startCombat usa
 * partyMembers()): los 3 se blindan (HP 255) para que 8 esqueletos no abran la
 * escena refuge a mitad del test, y los turnos de PJ se PASAN uno a uno hasta
 * abrir la fase enemiga (con 3 PJ un solo Space no la abre).
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoGame, inCombat, consoleText } from "./helpers";

type PacerProbe = { active: boolean; queued: number; beatMs: number; awaiting: boolean };

/** Sonda DEV única del pacer (`__u5test.combatPacer()`), read-only. */
async function pacer(page: Page): Promise<PacerProbe> {
  return page.evaluate(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).__u5test.combatPacer as () => PacerProbe)(),
  );
}

/** ¿El turno es de un PJ controlable? (charmed cuenta como IA, como en el pump). */
async function playerTurn(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cur = (window as any).__u5test.game.combat?.currentUnit;
    return !!cur && cur.kind === "player" && !cur.charmed;
  });
}

/** Party blindado (los 3 partyMembers del INIT) + esqueletos (grupo exacto de 8)
 *  sembrados al ESTE; entra por (A)ttack. */
async function enterSkeletonCombat(page: Page): Promise<void> {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (window as any).__u5test;
    // Blindaje de TODO el party de combate (HP 255): 8 esqueletos no pueden
    // wipear → jamás se abre la escena refuge durante el ciclo del pacer.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t.game.state.characters.forEach((c: any) => {
      if (c && c.name) {
        c.currentHp = 255;
        c.maxHp = 255;
      }
    });
    // SKELETONS def 33: tile = 320 + 33×4 (N_FIRST_SPRITE + i×N_FRAMES_PER_SPRITE).
    t.game.overworldEnemies.enemies.push({ defIndex: 33, tile: 452, water: false, x: 61, y: 60 });
  });
  await page.keyboard.press("a");
  await page.keyboard.press("ArrowRight"); // ESTE → enemigo → combate
  expect(await inCombat(page)).toBe(true);
}

/** Espera el REPOSO del prompt de PJ (tanda drenada: pacer nulo y cola vacía). */
async function waitIdlePrompt(page: Page, timeout = 15_000): Promise<void> {
  await expect
    .poll(async () => {
      const p = await pacer(page);
      return !p.active && p.queued === 0 && p.awaiting;
    }, { timeout, intervals: [150] })
    .toBe(true);
}

/**
 * PASA los turnos de PJ (Space) uno a uno hasta que la fase enemiga abra y el
 * pacer se ARME. Solo pulsa con el pacer desarmado y el turno en un PJ (jamás
 * encola por accidente: la cola queda limpia para el assert de encolado).
 */
async function passUntilPacerArmed(page: Page): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const p = await pacer(page);
    if (p.active) return;
    if (await playerTurn(page)) await page.keyboard.press(" ");
    await page.waitForTimeout(60);
  }
  expect((await pacer(page)).active, "el pacer no se armó tras pasar el turno de todos los PJ").toBe(true);
}

test("?combeat=400: ciclo completo — auto-arranque, beat armado, cursor apagado, cola encolada y drenada EN ORDEN, cierre limpio y mundo vivo", async ({ page }) => {
  test.setTimeout(150_000);
  await gotoGame(page, { x: 60, y: 60 }, ["combeat=400"]);

  // (1) El knob manda sobre el default webdriver→0.
  expect((await pacer(page)).beatMs).toBe(400);

  await enterSkeletonCombat(page);

  // (2) AUTO-ARRANQUE del hotfix: si la iniciativa es enemiga, la tanda de
  // apertura corre SOLA (paceada, sin pulsar nada) y se llega al reposo del
  // prompt del PJ (8 acciones × 400 ms ≈ 3.2 s < timeout).
  await waitIdlePrompt(page);

  // (3) Pasar los turnos de PJ abre la fase enemiga: el pacer se ARMA (el beat
  // corre ANTES de cada acción — cadencia del main-loop 0x0B94, incluida la 1ª).
  await passUntilPacerArmed(page);

  // (4) Gate del cursor (F-G): sin prompt mientras la tanda corre.
  expect((await pacer(page)).awaiting).toBe(false);

  // (5) Teclas DURANTE la tanda: se ENCOLAN (buffer BIOS), no se procesan aún.
  // La 'a' de combate arma el cursor de AIM (eco "Attack-Aim!"); ese eco NO puede
  // aparecer mientras la tecla siga en cola — su presencia posterior = drenaje real.
  expect(await consoleText(page)).not.toMatch(/Aim/i);
  await page.keyboard.press("a");
  await page.keyboard.press("ArrowRight");
  const queuedProbe = await pacer(page);
  expect(queuedProbe.active).toBe(true); // la tanda sigue en vuelo (8 beats ≈ 3.2 s)
  expect(queuedProbe.queued).toBe(2);
  expect(await consoleText(page)).not.toMatch(/Aim/i); // aún encolada, no procesada

  // (6) DRENAJE EN ORDEN: al agotar la tanda la cola se procesa — la 'a' drenada
  // arma el cursor de Aim (eco "Attack-Aim!" en consola) y la flecha mueve la cruz.
  await expect
    .poll(async () => {
      const p = await pacer(page);
      return p.queued === 0 && !p.active;
    }, { timeout: 20_000, intervals: [250] })
    .toBe(true);
  // La tecla drenada SÍ se procesó: el eco del comando quedó en consola…
  expect(await consoleText(page)).toMatch(/Aim/i);
  // …y el prompt del PJ volvió (cursor vivo, gate F-G re-derivado).
  expect((await pacer(page)).awaiting).toBe(true);

  // (7) CIERRE: ESC cancela el aim pendiente y el party huye por el borde SUR
  // (SJOG 0x1C56; la formación south entra por las filas 7-8, el borde está a
  // 2-3 pasos). Cada acción rueda una tanda paceada; las teclas de más se
  // encolan y drenan solas — se insiste hasta que el combate cierra. Al cerrar:
  // pacer desarmado y cola vacía (Q2: el timer no puede quedar fugado moviendo
  // un combate ya muerto).
  await page.keyboard.press("Escape"); // cancela el cursor de Aim
  // Rumbo sur con jiggle lateral ocasional (robusto a un árbol del Glade en la columna).
  const FLEE = ["ArrowDown", "ArrowDown", "ArrowLeft", "ArrowDown", "ArrowDown", "ArrowRight"];
  for (let i = 0; i < 60 && (await inCombat(page)); i++) {
    await page.keyboard.press(FLEE[i % FLEE.length]!);
    await page.waitForTimeout(500);
  }
  expect(await inCombat(page)).toBe(false);
  const closed = await pacer(page);
  expect(closed.active).toBe(false);
  expect(closed.queued).toBe(0);

  // (8) MUNDO VIVO tras el cierre (G3): el input del overworld se procesa — un
  // paso produce eco/mensaje en consola (movido o "Blocked!", ambos valen: lo
  // guardado es que el gate del cursor no se tragó el teclado).
  const consoleBefore = await consoleText(page);
  await page.keyboard.press("ArrowDown");
  await expect
    .poll(async () => (await consoleText(page)) !== consoleBefore, { timeout: 3_000 })
    .toBe(true);
});

test("?combeat=250 (el beat del spec G3): el knob no está cableado a un valor — armado y drenaje a 250 ms", async ({ page }) => {
  test.setTimeout(90_000);
  await gotoGame(page, { x: 60, y: 60 }, ["combeat=250"]);

  expect((await pacer(page)).beatMs).toBe(250);

  await enterSkeletonCombat(page);
  await waitIdlePrompt(page); // la tanda de apertura (si la hubo) drena sola
  await passUntilPacerArmed(page); // fase enemiga → pacer ARMADO a 250 ms
  await waitIdlePrompt(page); // …y DRENA de vuelta al prompt (pacer nulo, cola 0)
});

test("default bajo webdriver (sin ?combeat): beat 0, tanda síncrona, cola siempre vacía", async ({ page }) => {
  test.setTimeout(60_000);
  await gotoGame(page, { x: 60, y: 60 });

  expect((await pacer(page)).beatMs).toBe(0);

  await enterSkeletonCombat(page);

  // Con beat 0 TODO es síncrono dentro del keydown: se pasa el turno de cada PJ
  // y la tanda ENTERA de 8 esqueletos se resuelve en el mismo tick — el pacer
  // jamás se arma y la cola jamás retiene teclas (el contrato byte-idéntico que
  // asumen los digests del grand-tour).
  for (let i = 0; i < 8 && (await playerTurn(page)); i++) {
    await page.keyboard.press(" ");
    const p = await pacer(page);
    expect(p.active).toBe(false);
    expect(p.queued).toBe(0);
  }
  // El prompt del PJ está de vuelta (la tanda enemiga ya corrió, síncrona).
  const after = await pacer(page);
  expect(after.active).toBe(false);
  expect(after.queued).toBe(0);
  expect(after.awaiting).toBe(true);
});
