/**
 * E2E del ataque a distancia por TECLADO (fix #44 — el gap del soak).
 *
 * El motor ya modelaba alcance/línea-de-tiro y la UI de CLICK ya apuntaba a
 * cualquier celda; lo que faltaba era el teclado: `A` + flecha sólo golpeaba la
 * casilla adyacente, así que un arco era inútil a 2+ casillas y un enemigo que
 * el party no podía alcanzar a pie (p.ej. el acuático del Bay) quedaba inmatable.
 *
 * Esta prueba entra en combate en la misma Grass clearing determinista que
 * `combat.spec.ts` (→ mapa de combate Glade, 11×11 totalmente abierto), pero con
 * ENTRADA DETERMINISTA (re-baseline reconciliación; patrón combat-pacer.spec):
 * el patrón previo «anda N turnos hasta que el gate de spawn dispare» dependía
 * del stream RNG con seed fijo y cada fix fiel del spawn (count T4, sneaks del
 * peaje) lo desplazaba y rompía el spec — ahora se SIEMBRA un grupo errante
 * adyacente (SKELETONS def 33) y se entra por (A)ttack + dirección, sin RNG.
 * Después MONTA por hook el escenario del soak (arco al PJ, enemigo a 2 casillas
 * en un carril despejado, resto del party apartado, turno del tirador forzado) y
 * dispara con el TECLADO real `a` + `ArrowRight`. El enemigo a distancia cae:
 * antes del fix el disparo iba a la casilla adyacente vacía ("Nothing!") y el
 * enemigo sobrevivía.
 */
import { test, expect } from "@playwright/test";
import { gotoGame, inCombat } from "./helpers";

const GRASS_CLEARING = { x: 102, y: 43, hour: 2 };

test("Attack apunta a distancia (auto-target) y Enter dispara el arco, matando al enemigo (cierra el soak inmatable)", async ({ page }) => {
  test.setTimeout(180_000);
  await gotoGame(page, GRASS_CLEARING);

  // 1) ENTRADA EN COMBATE — determinista: esqueletos sembrados al ESTE + (A)ttack
  //    (bajo webdriver el beat es 0: la tanda de apertura, si la hay, se resuelve
  //    síncrona dentro del keydown y el staging encuentra el prompt del PJ).
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (window as any).__u5test;
    // Blindaje del party: la tanda de apertura de 8 esqueletos no puede tumbar
    // a nadie antes del staging (el tirador es players[0] activo).
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

  // 2) MONTAJE DEL SOAK — arco al tirador, enemigo a 2 casillas al Este en un
  //    carril despejado (Glade es todo abierto), resto del party a las esquinas,
  //    y currentActor = tirador para que el próximo input sea suyo.
  const staged = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (window as any).__u5test.game.combat;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const players = c.combatants.filter((u: any) => u.kind === "player" && u.status === "active");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enemy = c.combatants.find((u: any) => u.kind === "enemy" && u.status === "active");
    if (!enemy || players.length === 0) return { ok: false };
    // careo-combate T4: el encuentro ya spawnea un GRUPO (count por maxPerMap,
    // kernel 0x6bc2) — este soak es de UN tirador vs UN objetivo: se retira al
    // resto del bando enemigo para que el auto-target del Aim caiga en el staged.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.combatants.forEach((u: any) => {
      if (u.kind === "enemy" && u !== enemy) u.status = "fled";
    });
    const shooter = players[0];
    shooter.weapons = [{ id: 0x1a, attack: 99, range: 3 }]; // arco (0x1A), alcance 3
    shooter.attackRange = 3;
    shooter.speed = 99; // DEX alta → hitThreshold negativo → acierto garantizado
    shooter.x = 5;
    shooter.y = 5;
    enemy.x = 7; // 2 casillas al Este, carril (5,5)-(6,5)-(7,5) despejado
    enemy.y = 5;
    enemy.hp = 1;
    enemy.maxHp = 1;
    enemy.sleeping = false;
    const corners = [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    players.slice(1).forEach((p: any, i: number) => {
      p.x = corners[i]!.x;
      p.y = corners[i]!.y;
    });
    c.currentActor = shooter; // el próximo input es del tirador
    // Munición conocida (fix #51): el disparo debe bajarla en 1.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.game.state.equipmentQuantities[0x1b] = 10; // Arrows
    return { ok: true, curIsShooter: c.currentUnit === shooter };
  });
  expect(staged.ok).toBe(true);
  expect(staged.curIsShooter).toBe(true);

  // 3) DISPARO POR TECLADO — modelo de apuntado FIEL (hotfix #4, COMSUBS 0x0504):
  //    `a` (Attack) abre el cursor de Aim sobre el ÚLTIMO OBJETIVO recordado del
  //    actor o, sin memoria (caso aquí), sobre el PROPIO actor (@0x0562 — el
  //    auto-target al «más cercano» previo era fabricado); las flechas MUEVEN la
  //    cruz (acotada a alcance, no disparan) y Enter/`a` CONFIRMA el disparo sobre
  //    la celda del cursor (main.ts handleCombatKey). Tirador en (5,5), enemigo en
  //    (7,5): cursor arranca en (5,5) → 2×ArrowRight → Enter.
  const aim = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__u5test.game.combat.aimGeometry();
  });
  expect(aim, "el arco debe poder APUNTAR (alcance ≥ distancia)").not.toBeNull();
  expect(aim.initial, "sin objetivo recordado el cursor arranca sobre el actor").toEqual({ x: 5, y: 5 });
  await page.keyboard.press("a"); // abre el cursor de Aim (sobre el actor)
  await page.keyboard.press("ArrowRight"); // (6,5)
  await page.keyboard.press("ArrowRight"); // (7,5) = el enemigo
  await page.keyboard.press("Enter"); // confirma → dispara a distancia

  // 4) El enemigo a distancia cae por el disparo (o el combate termina en victoria).
  const result = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).__u5test.game;
    const arrows = g.state.equipmentQuantities[0x1b];
    const enemyDead = !g.combat
      ? true // combate cerrado = victoria (único enemigo)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : g.combat.combatants.every((u: any) => u.kind !== "enemy" || u.status !== "active");
    return { enemyDead, arrows };
  });
  expect(result.enemyDead, "el enemigo a 2 casillas debería haber caído por el arco").toBe(true);
  // El disparo consumió exactamente 1 flecha (fix #51, COMSUBS:0x097C).
  expect(result.arrows, "el arco debería haber gastado 1 flecha").toBe(9);
});
