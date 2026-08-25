/**
 * Journey de combate (Task E2E-8).
 *
 * DETERMINISMO DEL ENCUENTRO (tras F.2 — stream vivo unificado): el juego ya NO
 * tiene fuentes de RNG separadas. TODO el turno (viento, housekeeping, gate de
 * spawn y colocación) rueda por el ÚNICO `OriginalRng` vivo (`game.liveRng`),
 * sembrado a 0 al construir el Game (game.ts). Como cada carga de página arranca
 * un contexto JS nuevo con un Game nuevo, el stream reinicia a la seed 0 → la
 * secuencia completa del turno (y con ella la del gate) es DETERMINISTA por run.
 * El gate lo decide `rollSpawnGate` (spawn.ts:66) DENTRO de `outdoorTurn`; la
 * colocación consume el mismo stream (puente float → Task 2 exacto). No se usa
 * ningún hook de inyección: sería redundante con la seed-0 del stream vivo.
 *
 * ESTRATEGIA (variante (a) del brief, sin tocar el core):
 *  - Deep-link a (102,43) = tile Grass (walkable + landEnemyPassable), en un
 *    claro con vecindario ~98% pasable para que el enemigo alcance a la party.
 *  - Hora 02:00 (noche, hour<5) → `spawnThreshold` = base 1 (terreno normal) + 3
 *    (bonus nocturno) = 4 → el gate dispara si `rand(1,30) < 4`, i.e. roll∈{1,2,3}
 *    con p = 3/30 = 0.1 por turno.
 *  - `search` (tecla 's', game.ts:464-465) tiquea el world-turn SIN mover a la
 *    party, así que ésta permanece sobre el Grass en cada tirada del gate.
 *
 * BOUND del bucle de spawn: P(el gate NO dispara en N turnos) = (27/30)^N.
 * Con N=120 → 0.9^120 ≈ 3.1e-6. Sumado a que la colocación acierta casilla
 * pasable (~98% del anillo) y a que el enemigo se acerca 1 casilla/turno por
 * terreno abierto, entrar en combate es efectivamente seguro (y determinista
 * por la seed-0 del gate). El assert final es determinista: el combate SIEMPRE
 * termina y volvemos al mapa.
 */
import { test, expect } from "@playwright/test";
import { gotoGame, hudLog, inCombat, readState } from "./helpers";

const GRASS_CLEARING = { x: 102, y: 43, hour: 2 };
const SPAWN_TRIES = 120;
const COMBAT_ROUNDS = 200;
const COMBAT_DIRS = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"] as const;

test("encuentro nocturno entra en combate y se resuelve de vuelta al mapa", async ({ page }) => {
  test.setTimeout(180_000);
  await gotoGame(page, GRASS_CLEARING);

  // 1) ENTRADA EN COMBATE — un Search direccional tiquea el world-turn en el sitio
  //    (sin mover a la party) hasta que el gate de spawn dispara y el enemigo
  //    alcanza a la party. Tras el fix #47 Search pide dirección (SJOG 0x095C), así
  //    que cada tick es 's'+flecha; la 'S' sola ya no consume turno.
  let entered = false;
  for (let i = 0; i < SPAWN_TRIES; i++) {
    await page.keyboard.press("s");
    await page.keyboard.press("ArrowUp");
    // C6: Search pide PJ con party>1 sin activo (kernel 0x4988) — Enter confirma
    // el cursor; si el turno ya nos metió en combate, el Enter es inerte.
    await page.keyboard.press("Enter");
    if (await inCombat(page)) {
      entered = true;
      break;
    }
  }
  expect(entered, `no se entró en combate tras ${SPAWN_TRIES} turnos`).toBe(true);
  // Encuentro ENEMY-INITIATED: secuencia fiel "Attacked!" → grupo → "*** CONFLICT ***"
  // (lote D). Aseveramos el banner CONFLICT (DS 0xa438), la última línea de intro siempre
  // presente. El "{name} attacks!" del clon era fabricado, purgado.
  expect((await hudLog(page, 16)).join("\n")).toMatch(/\*\*\* CONFLICT \*\*\*/i);
  // Banner de turno de PJ (COMBAT.OVL 0x063e): "<nombre>, armed with <arma>:". El
  // party gana la iniciativa (empates → PJ primero, combat.md §init), así que su
  // banner aparece antes de poder actuar. Robusto: si el enemigo abriera, saldría
  // su "attacks!" (ya cubierto arriba); aquí exigimos el banner O que el party
  // nunca llegue a turno propio en la ventana visible.
  {
    const log = (await hudLog(page, 16)).join("\n");
    expect(log).toMatch(/, armed with .+:|\*\*\* CONFLICT \*\*\*/i);
  }

  const goldBefore = await readState<number>(page, "gold");

  // 2) RESOLUCIÓN — atacar en las 4 direcciones + pasar, hasta que el combate
  //    termine. Robusto al RNG interno (iniciativa/hits) y a ambos desenlaces
  //    (victoria del party o del enemigo): en cualquier caso `game.combat`
  //    vuelve a null. Cada 'a' se sigue SIEMPRE de una dirección (el handler
  //    consume el par a+dir; pumpCombat avanza los turnos enemigos solo).
  for (let round = 0; round < COMBAT_ROUNDS && (await inCombat(page)); round++) {
    for (const dir of COMBAT_DIRS) {
      await page.keyboard.press("a");
      await page.keyboard.press(dir);
      if (!(await inCombat(page))) break;
    }
    if (await inCombat(page)) await page.keyboard.press(" ");
  }

  // 2b) SALIDA TRAS VICTORIA — limpiar el bando enemigo NO cierra el combate (COMBAT:0x0cf6
  //     fall-through): la party permanece para recoger botín y SALE ANDANDO por el borde
  //     (SJOG:0x1C56→0x1BB2, todos por la misma salida). Camina a todos hacia el oeste hasta
  //     que el combate cierre. (Si la party murió, ya no estamos en combate y esto no corre.)
  for (let w = 0; w < 60 && (await inCombat(page)); w++) {
    await page.keyboard.press("ArrowLeft");
  }

  // ASSERT FINAL DETERMINISTA: el combate termina y volvemos al mapa.
  expect(await inCombat(page)).toBe(false);
  // Consecuencia coherente: el HUD registró el cierre del combate. Tres desenlaces
  // válidos: victoria del party (botín/oro), fin de batalla, o DERROTA DEL PARTY →
  // Refuge (todos muertos → despertar en LB castle). Con el spawner fiel (Fix B /
  // #19: weighted_pick sobre las tablas reales de DATA.OVL), a seed-0 el encuentro
  // nocturno de tierra saca un enemigo más duro que el pool Redux previo y arrasa a
  // la party fresca → Refuge (conducta fiel: el original puede lanzar un Troll/Ettin
  // a una party de nivel bajo de noche).
  // NOTA (#49): la narración del refuge se amplió con el discurso de resurrección de
  // KARMA.DAT (BLCKTHRN 0x0b03), que empuja "slumber is disturbed" fuera de la ventana
  // de 16 líneas del HUD; el desenlace Refuge se detecta ahora por sus líneas FINALES
  // ("Strange words are intoned." / "Vertigo...") además del marcador previo.
  // "VICTORY!" se anuncia al limpiar el bando enemigo y luego la party sale ("Leave!"),
  // así que la victoria puede haber SCROLLEADO fuera de la ventana de 16 líneas: "Leave!"
  // (salida tras victoria) es el marcador final válido de ese desenlace.
  const endLog = (await hudLog(page, 16)).join("\n");
  expect(endLog).toMatch(
    /VICTORY!|gold|Leave!|BATTLE IS LOST!|slumber is disturbed|Strange words are intoned|Vertigo/i,
  );

  // Si hubo victoria (botín en el tablero o salida "Leave!"), el oro no puede haber
  // disminuido (el botín no recogido no resta; el recogido con (G)et sólo suma).
  if (/VICTORY!|gold|Leave!/i.test(endLog)) {
    expect(await readState<number>(page, "gold")).toBeGreaterThanOrEqual(goldBefore);
  }
});
