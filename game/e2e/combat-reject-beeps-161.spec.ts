/**
 * #161 · El CAMINO de los dos beeps del rechazo «Quit-Not here» en la arena —
 * handleCombatKey → view.emitSfx → coreview → speaker (WebAudio).
 *
 * LA LECCIÓN DE #371 QUE ESTE FICHERO APLICA: el test de EMISIÓN y el de CATÁLOGO
 * pueden estar verdes con el juego MUDO — el hueco vive entre los dos. Aquí el canal
 * es `view.emitSfx` DIRECTO (el mismo de las pisadas/golpes de combate: caminos que
 * no producen un turno atómico, docblock de `CoreViewImpl.emitSfx`), sin cortes de
 * `applyEvents` por medio — pero el camino vivo se ejercita igual, con el censo
 * WebAudio de #371 (mismo discriminante tono/ruido y mismo control positivo).
 *
 * CÓMO MIDE (censo heredado de shrine-sfx-camino-371.spec.ts): cada
 * `createOscillator` cuenta como TONO salvo que antes del siguiente oscilador
 * aparezca un WaveShaper (⇒ era RUIDO: pisadas, golpes). Los dos beeps del funnel
 * (SJOG 0x1f26 → 0x1f52/0x1f5d → kernel 0x22c0) son TONOS: 220 Hz y 150 Hz.
 *
 * CONTROL POSITIVO en la misma corrida (#371): un paso a pie ANTES de entrar en
 * combate = `move-step` = ≥2 osciladores de RUIDO. Si eso da 0, el instrumento o el
 * grafo de audio están rotos y ningún otro aserto significa nada.
 *
 * NO-DOBLE con igualdades exactas: un rechazo = 2 tonos, dos rechazos = 4. Si el
 * cue se enrutara dos veces (p. ej. emitSfx + notifyTurn) saldrían 4/8 y cae.
 *
 * NEGATIVO: la Q rechazada NO cierra el combate ni consume turno — seguimos en la
 * arena tras el mensaje (ret 1 del funnel = re-prompt del mismo actor).
 *
 * ENTRADA EN COMBATE: el patrón de combat-pacer.spec.ts (party blindado + esqueletos
 * sembrados adyacentes por `__u5test`, entrada por (A)ttack), desde el claro de
 * hierba de combat.spec.ts (102,43) para que el paso del control positivo no pueda
 * rebotar (vecindario pasable ⇒ nada de `move-blocked`, que es TONO y ensuciaría el
 * censo).
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoGame, inCombat, consoleText } from "./helpers";

type U5Win = Window & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __u5test: any;
  __sfx161: { tone: number; noise: number };
};

/** Censo WebAudio de #371 (ver shrine-sfx-camino-371.spec.ts para el porqué del
 *  reclasificado por-último-oscilador; el gain se crea ANTES del if de ruido). */
function censusInit(): void {
  const w = window as unknown as U5Win;
  w.__sfx161 = { tone: 0, noise: 0 };
  const AC = window.AudioContext;
  const origOsc = AC.prototype.createOscillator;
  let lastOscWasTone = false;
  AC.prototype.createOscillator = function (...a: []) {
    w.__sfx161.tone++;
    lastOscWasTone = true;
    return origOsc.apply(this, a);
  };
  const origShaper = AC.prototype.createWaveShaper;
  AC.prototype.createWaveShaper = function (...a: []) {
    if (lastOscWasTone) {
      w.__sfx161.tone--;
      w.__sfx161.noise++;
      lastOscWasTone = false;
    }
    return origShaper.apply(this, a);
  };
}

async function census(page: Page): Promise<{ tone: number; noise: number }> {
  return page.evaluate(() => (window as unknown as U5Win).__sfx161);
}

const GRASS_CLEARING = { x: 102, y: 43 };

test("#161 · Q en la arena: «Quit-Not here» + los DOS beeps llegan al speaker (y sin turno)", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(censusInit);
  // `combeat=1`: bajo webdriver el beat del pacer es 0 y el AUTO-ARRANQUE de la
  // tanda enemiga de apertura NO corre solo (medido en esta ficha: el encuentro
  // enemy-initiated se queda en cur=enemy/awaiting hasta la primera tecla, que se
  // consume en drenar la tanda en vez de llegar al despachador). Con beat>0 la
  // apertura corre SOLA (el mecanismo que combat-pacer.spec.ts verifica a 400 ms)
  // y a 1 ms cuesta milisegundos.
  await gotoGame(page, GRASS_CLEARING, ["combeat=1"]);

  // CONTROL POSITIVO del instrumento: un paso a pie (grass clearing, vecindario
  // pasable) = move-step = 2 ráfagas de RUIDO por el MISMO canal emitSfx.
  const c0 = await census(page);
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await census(page)).noise - c0.noise).toBeGreaterThanOrEqual(2);

  // ENTRADA EN COMBATE (patrón combat-pacer): party blindado + esqueletos al ESTE
  // de la posición ACTUAL del party, entrada por (A)ttack.
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (window as unknown as U5Win).__u5test;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t.game.state.characters.forEach((c: any) => {
      if (c && c.name) {
        c.currentHp = 255;
        c.maxHp = 255;
      }
    });
    const p = t.game.state.position;
    // SKELETONS def 33: tile = 320 + 33×4.
    t.game.overworldEnemies.enemies.push({ defIndex: 33, tile: 452, water: false, x: p.x + 1, y: p.y });
  });
  await page.keyboard.press("a");
  await page.keyboard.press("ArrowRight");
  expect(await inCombat(page)).toBe(true);
  // REPOSO del prompt de PJ, por la sonda del pacer (patrón waitIdlePrompt de
  // combat-pacer.spec.ts): el banner de consola puede tardar más que el estado y
  // lo que la Q necesita es que el bucle esté ESPERANDO comando de un PJ.
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const t = (window as unknown as U5Win).__u5test;
          const p = t.combatPacer() as { active: boolean; queued: number; awaiting: boolean };
          const cur = t.game.combat?.currentUnit;
          return !p.active && p.queued === 0 && p.awaiting && cur?.kind === "player" && !cur.charmed;
        }),
      { intervals: [150] },
    )
    .toBe(true);

  // EL CAMINO: Q rechazada → mensaje del funnel + EXACTAMENTE 2 tonos (los beeps
  // 220 Hz y 150 Hz). Ni 0 (el hueco de #161: mensaje sin sonido) ni 4 (doble
  // enrutado). Los turnos enemigos entre medias solo pueden sumar RUIDO (golpes),
  // nunca tonos, así que la igualdad exacta es estable.
  const t0 = (await census(page)).tone;
  await page.keyboard.press("q");
  await expect.poll(() => consoleText(page)).toMatch(/Quit-Not here/);
  await expect.poll(async () => (await census(page)).tone - t0).toBe(2);

  // NEGATIVO: el rechazo no guarda, no cierra la arena y no consume turno — el
  // combate sigue vivo y el MISMO actor re-promptea (ret 1 del funnel).
  expect(await inCombat(page)).toBe(true);

  // REPETIBLE y NO-DOBLE: segundo rechazo = otros 2 tonos exactos (total 4).
  await page.keyboard.press("q");
  await expect.poll(async () => (await census(page)).tone - t0).toBe(4);
  expect(await inCombat(page)).toBe(true);
});
