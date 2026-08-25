/**
 * D2 y D3 · VERIFICACIÓN MIRANDO — las dos divergencias que el carril
 * `espejo-es-fotogramas` adjudicó con fotogramas (acta
 * `re/notes/espejo-es-momentos-careo.md` §4).
 *
 * La suite unitaria (`tests/espejo-es-momentos.test.ts` N5/N1) fija los BYTES del crudo
 * contra el modelo; esto ejercita la MISMA conducta por la vía real —teclas, piel, ciclo
 * de turnos— y deja una captura, que es lo que pedía la regla de trabajo visual.
 *
 * D2 (espejo ES Ep30 44:10/46:33, «se convierte en piedra y no puedo pasar»):
 *   COMBAT.OVL 0x1574 @0x16fb `cmp byte [bx+3],0x1e` → 0x170c `mov byte [bx],0x4c`
 *   sobre el puntero de `get_tile_ptr` (kernel 0x4402, que en arena resuelve a
 *   0xad14 + y·32 + x) → 0x170f `jmp 0x171f`, saltándose la tirada de botín.
 *
 * D3 (espejo ES Ep26 34:38, «Attacked! / SHADOW LORD / The Sceptre is reclaimed! /
 *   *** CONFLICT ***»): ULTIMA.EXE `enter_combat_vs_actor` 0x6150 @0x61f3-0x6229 —
 *   criatura 0xFC + `g_sceptre != 0` ⇒ imprime DS 0xa406 y pone `g_sceptre = 0`.
 *   Se ejercita EN STONEGATE (loc 0x1d), que es donde el LP lo sufre y donde el .NPC
 *   real tiene a los tres 0xFC residentes en (5,15)/(15,5)/(25,15).
 */
import { test, expect } from "@playwright/test";
import { gotoGame, hudLog, inCombat, readState } from "./helpers";

type Hooks = { __u5test: { game: Record<string, any> } };
const shot = (name: string): string =>
  process.env.U5_SHOT_DIR !== undefined
    ? `${process.env.U5_SHOT_DIR}/${name}.png`
    : `test-results/${name}.png`;

test("D2 · la gárgola muerta deja ROCA 0x4C en el mapa de la arena, y sin botín", async ({
  page,
}) => {
  await gotoGame(page, { x: 60, y: 60 });

  // Gárgola (def 30, sprite 320+30·4 = 440) justo al ESTE de la party.
  await page.evaluate(() => {
    (window as unknown as Hooks).__u5test.game.overworldEnemies.enemies.push({
      defIndex: 30,
      tile: 440,
      water: false,
      x: 61,
      y: 60,
    });
  });
  await page.keyboard.press("a");
  await page.keyboard.press("ArrowRight");
  expect(await inCombat(page)).toBe(true);

  // CONTROL NEGATIVO EN EL TIEMPO: antes de matarla no hay ni una roca en la rejilla.
  // (Sin esto, un mapa que ya llevara 0x4C haría pasar el aserto de después sin fix.)
  const rocas = (): Promise<number> =>
    page.evaluate(
      () =>
        ((window as unknown as Hooks).__u5test.game.combat?.mapTiles ?? [])
          .flat()
          .filter((t: number) => t === 0x4c).length,
    );
  expect(await rocas()).toBe(0);

  // Arnés de la pelea, y sólo eso: la gárgola a 1 de HP (DIVIDE al sobrevivir un golpe —
  // flag 0x1000 de §1.9 — y el test no debe depender de cuántas veces se parta) y la party
  // a prueba de bombas (sin esto la gárgola gana: 20 de daño contra PJs de 30). Lo ÚNICO
  // que se salta es la ARITMÉTICA del daño; la muerte, el `kill` y el `dropLoot` que
  // decide la roca son la vía real, conducida por teclas.
  const arnes = async (): Promise<void> => {
    await page.evaluate(() => {
      for (const c of (window as unknown as Hooks).__u5test.game.combat.combatants) {
        if (c.kind === "enemy") c.hp = 1;
        else {
          c.hp = 999;
          c.maxHp = 999;
        }
      }
    });
  };
  await arnes();

  // Cazar a la gárgola: acercarse con las flechas y rematar con (A)ttack+dirección. El
  // 🔴 que costó una corrida: romper el bucle con /killed!/ a secas casa con «Shamino
  // killed!» — un PJ, no la gárgola — y deja el aserto midiendo un combate aún vivo.
  // El testigo tiene que NOMBRAR al muerto que se busca.
  const pos = (): Promise<{ cx: number; cy: number; fx: number; fy: number } | null> =>
    page.evaluate(() => {
      const c = (window as unknown as Hooks).__u5test.game.combat;
      const cur = c?.currentUnit;
      const foe = c?.combatants.find((u: any) => u.kind === "enemy" && u.status === "active");
      return cur && foe ? { cx: cur.x, cy: cur.y, fx: foe.x, fy: foe.y } : null;
    });
  const muerta = async (): Promise<boolean> =>
    /Gargoyle killed!/i.test((await hudLog(page, 16)).join("\n"));

  for (let round = 0; round < 120 && !(await muerta()); round++) {
    const p = await pos();
    if (!p) break;
    await arnes(); // por si se dividió antes de que alcanzáramos a la original
    const dx = p.fx - p.cx;
    const dy = p.fy - p.cy;
    const kx = dx > 0 ? "ArrowRight" : "ArrowLeft";
    const ky = dy > 0 ? "ArrowDown" : "ArrowUp";
    const [k1, k2] = Math.abs(dx) >= Math.abs(dy) ? [kx, ky] : [ky, kx];
    if (Math.abs(dx) + Math.abs(dy) === 1) {
      await page.keyboard.press("a"); // adyacente en ortogonal → golpe
      await page.keyboard.press(k1);
      continue;
    }
    // Acercarse por el eje mayor y, si la muralla de la arena lo bloquea (la celda no
    // cambió), reintentar por el otro. Sin este reintento el bucle se queda empujando
    // contra el mismo muro las 120 rondas y el test muere por «no la maté», que se lee
    // como un fix roto y es un arnés que no sabe andar.
    await page.keyboard.press(k1);
    const q = await pos();
    if (q && q.cx === p.cx && q.cy === p.cy && dx !== 0 && dy !== 0) {
      await page.keyboard.press(k2);
    }
  }

  expect(await muerta()).toBe(true);
  // 170c: la roca EN EL MAPA. Y hay tantas como gárgolas cayeron (si alguna llegó a
  // dividirse antes de que le bajáramos la HP, cada muerte deja la suya).
  expect(await rocas()).toBeGreaterThanOrEqual(1);
  // 170f: la muerte de la gárgola NO pasa por la tirada de botín — ni cofre ni sangre
  // en la celda petrificada. (El cofre/sangre viven en la capa de objetos, `lootTiles`.)
  const botinSobreRoca = await page.evaluate(() => {
    const c = (window as unknown as Hooks).__u5test.game.combat;
    const roca = new Set<string>();
    c.mapTiles.forEach((fila: number[], y: number) =>
      fila.forEach((t, x) => {
        if (t === 0x4c) roca.add(`${x}:${y}`);
      }),
    );
    return c.lootTiles().filter((l: { x: number; y: number }) => roca.has(`${l.x}:${l.y}`)).length;
  });
  expect(botinSobreRoca).toBe(0);

  // Captura MIRADA. Dos cosas aprendidas a base de mirarla, que valen para quien la repita:
  //  · NO se pulsa Escape para «limpiar» la pantalla: en la arena Escape es HUIR (el
  //    binario no tiene cancelar-puntería ahí) y la corrida con Escape sacó a un PJ del
  //    combate y dejó la piedra fuera de plano.
  //  · Sí hay que ESPERAR: disparada inmediatamente, el fogonazo del impacto se pinta
  //    ENCIMA de la celda recién petrificada y la captura no enseña la piedra — un verde
  //    con la prueba tapada.
  await page.waitForTimeout(1200);
  await page.screenshot({ path: shot("d2-gargola-piedra-arena") });
});

test("D3 · en Stonegate, atacar a un Shadowlord con el Cetro encima lo ARREBATA", async ({
  page,
}) => {
  // Loc 0x1d = Stonegate, y (4,15) deja a la party pegada por el OESTE al residente
  // 0xFC de (5,15) — el dato del .NPC real que censa el test N2 de la suite unitaria.
  await gotoGame(page, { loc: 29, floor: 0, x: 4, y: 15 });

  await page.evaluate(() => {
    (window as unknown as Hooks).__u5test.game.state.lbArtifacts.sceptre = true;
  });
  expect(await readState<boolean>(page, "lbArtifacts.sceptre")).toBe(true);

  await page.keyboard.press("a");
  await page.keyboard.press("ArrowRight"); // ESTE → el 0xFC de (5,15)

  const log = (await hudLog(page, 16)).join("\n");
  // DS 0xa406, y en el ORDEN de los fotogramas: el nombre de grupo (0x6150 @0x619c)
  // ANTES, el banner DS 0xa438 (run_combat_encounter 0x5f86) DESPUÉS.
  expect(log).toContain("The Sceptre is reclaimed!");
  expect(log.indexOf("SHADOW LORD")).toBeLessThan(log.indexOf("The Sceptre is reclaimed!"));
  expect(log.indexOf("The Sceptre is reclaimed!")).toBeLessThan(log.indexOf("*** CONFLICT ***"));
  // 6224 `mov byte [g_sceptre],0` — el Cetro se ha PERDIDO.
  expect(await readState<boolean>(page, "lbArtifacts.sceptre")).toBe(false);
  expect(await inCombat(page)).toBe(true);

  await page.screenshot({ path: shot("d3-cetro-arrebatado") });
});
