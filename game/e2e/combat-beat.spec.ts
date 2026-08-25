/**
 * TANDA ENEMIGA VIVA con beat real (?combeat=400) — hotfix combate 2026-07-22.
 *
 * EL HUECO QUE CUBRE: bajo webdriver el beat es 0 (drain síncrono) y toda la
 * suite e2e validaba SOLO ese camino — la regresión del paceo T11 («los enemigos
 * no actúan»: la piel asumía que `tickEnemyTurns` procesaba UNA acción, pero
 * drena la tanda entera, así que el beat jamás se armaba y además el arranque con
 * iniciativa enemiga quedaba CONGELADO hasta la primera tecla) pasó invisible.
 * Este spec fuerza `?combeat=400` (la condición del juego en vivo) y verifica el
 * contrato del pacer:
 *
 *  1. tras la última acción de PJ de la ronda, la tanda enemiga corre SOLA (sin
 *     más teclas) — se OBSERVA `currentUnit.kind === "enemy"` mientras está en
 *     vuelo (imposible con el drain síncrono pre-fix, que resolvía la tanda
 *     dentro del keypress);
 *  2. la tanda está PACEADA: los enemigos no se mueven todos en el mismo frame
 *     (≥2 estados intermedios distintos de posiciones durante la ventana);
 *  3. al agotarse la tanda vuelve el turno de un PJ y algún enemigo se ha movido.
 *
 * ENTRADA DETERMINISTA (re-baseline reconciliación; patrón combat-pacer.spec):
 * el patrón previo «anda N turnos hasta que el gate de spawn dispare» dependía
 * del stream RNG con seed fijo y CADA fix fiel del spawn (count T4, sneaks del
 * peaje) lo desplazaba y rompía el spec. Ahora se SIEMBRA un grupo errante
 * adyacente y se entra por (A)ttack + dirección: SKELETONS (def 33, maxPerMap=8)
 * fuerza count EXACTO = 8 (rollEncounterGroup no rueda rand con maxPerMap ∈
 * {1,8,16}) → tanda multi-acción garantizada para el criterio de paceo, sin RNG.
 * El party (3 partyMembers del INIT) se blinda (HP 255) para que la observación
 * larga no arriesgue el party-wipe (escena refuge) a mitad del spec.
 */
import { test, expect } from "@playwright/test";
import { gotoGame, inCombat } from "./helpers";

const GRASS_CLEARING = { x: 102, y: 43, hour: 2 };

type EnemySnap = Array<{ id: number; x: number; y: number }>;

test("con ?combeat=400 la tanda enemiga corre sola y paceada tras el turno del party", async ({ page }) => {
  test.setTimeout(180_000);
  await gotoGame(page, GRASS_CLEARING, ["combeat=400"]);

  // 1) ENTRADA DETERMINISTA: esqueletos sembrados al ESTE + (A)ttack.
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (window as any).__u5test;
    // Blindaje del party (la tanda de 8 se observa muchas rondas: sin refuge).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t.game.state.characters.forEach((c: any) => {
      if (c && c.name) {
        c.currentHp = 255;
        c.maxHp = 255;
      }
    });
    // SKELETONS def 33: tile = 320 + 33×4 (N_FIRST_SPRITE + i×N_FRAMES_PER_SPRITE).
    t.game.overworldEnemies.enemies.push({ defIndex: 33, tile: 452, water: false, x: 103, y: 43 });
  });
  await page.keyboard.press("a");
  await page.keyboard.press("ArrowRight"); // ESTE → enemigos → combate
  expect(await inCombat(page), "el (A)ttack sobre el grupo sembrado no abrió combate").toBe(true);

  const snapshot = () =>
    page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = (window as any).__u5test?.game?.combat;
      if (!c) return null;
      return {
        curKind: c.currentUnit ? (c.currentUnit.charmed ? "enemy" : c.currentUnit.kind) : null,
        enemies: c.combatants
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((u: any) => u.kind === "enemy" && u.status === "active")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((u: any) => ({ id: u.id, x: u.x, y: u.y })) as EnemySnap,
      };
    });

  const enemiesBefore = (await snapshot())!.enemies;
  expect(enemiesBefore.length).toBeGreaterThan(0);

  // 2) Pasa los turnos del party de la ronda. Con el pacer armado las teclas se
  //    ENCOLAN (buffer BIOS) — se pulsa Space solo cuando el turno es de un PJ.
  //    En cuanto el turno aterrice en un enemigo, la tanda debe correr SOLA.
  //    (Con iniciativa enemiga la tanda de APERTURA ya corre sola — auto-arranque
  //    del hotfix — y la observación empieza ahí mismo.)
  let sawEnemyTurn = false;
  const interSnaps: string[] = [];
  for (let i = 0; i < 120 && (await inCombat(page)); i++) {
    const s = (await snapshot())!;
    if (s.curKind === "player") {
      if (sawEnemyTurn) break; // la tanda ya corrió y volvió a un PJ: listo
      await page.keyboard.press(" "); // Pass
      await page.waitForTimeout(120);
      continue;
    }
    // Turno de IA visible = pacer en vuelo (pre-fix esto era inobservable).
    sawEnemyTurn = true;
    interSnaps.push(JSON.stringify(s.enemies));
    await page.waitForTimeout(150); // muestrea la tanda sin pulsar nada
  }

  expect(
    sawEnemyTurn,
    "nunca se observó un turno de IA en vuelo: la tanda no corre o va en ráfaga síncrona (regresión T11)",
  ).toBe(true);

  // 3) PACEO: durante la ventana de tanda hubo ≥2 estados de posiciones distintos
  //    (los enemigos NO se movieron todos en un mismo frame). Con ~0.4 s/acción y
  //    muestreo a 150 ms, la tanda de 8 acciones siempre produce ≥2 estados.
  const distinct = new Set(interSnaps);
  expect(
    distinct.size,
    `la tanda se resolvió en ráfaga (1 solo estado muestreado en ${interSnaps.length} muestras)`,
  ).toBeGreaterThanOrEqual(2);

  // 4) La tanda terminó en el turno de un PJ y algún enemigo se movió solo.
  if (await inCombat(page)) {
    const after = (await snapshot())!;
    expect(after.curKind).toBe("player");
    const moved = after.enemies.some((e) => {
      const b = enemiesBefore.find((x) => x.id === e.id);
      return b && (b.x !== e.x || b.y !== e.y);
    });
    expect(moved, "ningún enemigo se movió durante la tanda autónoma").toBe(true);
  }
});
