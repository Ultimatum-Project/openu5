/**
 * ENDGAME E2E (#20 L4 → #34 ventana-frame) — los DOS finales por el pipeline REAL.
 *
 * El trigger natural exige Doom-7 con las 3 regalías + los 3 Shadowlords muertos
 * (inalcanzable jugando en un e2e), así que sembramos el estado por `__u5test.game` y
 * empujamos los eventos por el bridge real (`__u5test.applyEvents`). Determinista.
 *
 * Con #34 el cierre ya NO es el pergamino DOM: el core emite el GUIÓN completo
 * (endgame.json inyectado) y main.ts lo pacea como escena modal de la piel fiel
 * (sala verde + diálogo por tecla + orb/moongate + disolución + historia + pergamino
 * canvas + freeze terminal). El arnés conduce las teclas y hace poll de la fase viva
 * (`__u5test.endgamePhase()`).
 *
 * Verifica:
 *   - VICTORIA (con la caja): el diálogo byte-exacto de ENDMSG.DAT fluye por consola
 *     («Well met,» → «You reply: Yes» → «Our worlds await!»), la secuencia completa
 *     llega al freeze terminal, y el pergamino DOM viejo queda SUPRIMIDO.
 *   - VARADO (sin caja): 2ª pregunta + «pull up a chair» y la sala-prisión terminal.
 *   - NINGÚN final muestra el texto FABRICADO retirado en L4.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoGame, consoleText } from "./helpers.js";

/**
 * Siembra el estado pre-rescate y dispara el desenlace por la CADENA FIEL (#179):
 * la celda de LB (cm127) se alcanza CAYENDO por el foso de la planta 6 ((5,7) tipo
 * 0x61; celda de aproximación (4,7) — la misma del testigo-1), el combate de sala
 * monta por el pipeline real de teclas, cada miembro pisa (5,2) bajo el alma
 * atrapada y es absorbido (SJOG 0x1ea4), y el teardown con el tablero vacío desvía
 * al endgame (`endCombat` → centinela → `fireAbsorptionEndgame`). La costura que
 * queda (declarada, como la siembra de flags): colocar cada miembro en (5,3) en su
 * turno en vez de navegarlo casilla a casilla — el paso absorbente y el teardown
 * son los reales. Derivación: re/notes/absorcion-179-acta.md.
 */
async function triggerEndgame(page: Page, hasBox: boolean): Promise<void> {
  await page.evaluate((box) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (window as any).__u5test;
    const g = t.game;
    // Regalías + Shadowlords (lo que un save legal traería hasta aquí).
    g.state.questFlags["shadowlord-dead:falsehood"] = true;
    g.state.questFlags["shadowlord-dead:hatred"] = true;
    g.state.questFlags["shadowlord-dead:cowardice"] = true;
    g.state.lbArtifacts = { amulet: true, crown: true, sceptre: true };
    g.state.specialItems.woodenBox = box;
    // Entra a Doom (dungeon 40) y colócate en la planta 6, ante el foso de la celda.
    g.enterDungeon(40);
    const ds = g.dungeonState;
    ds.pos.floor = 6;
    ds.pos.x = 4;
    ds.pos.y = 7;
    ds.pos.facing = "east";
    t.applyEvents(g.checkDoomRescue()); // marca in-doom (#179: ya no dispara nada)
  }, hasBox);
  // Paso al foso por el pipeline REAL: caída a (5,7) planta 7 → «Entering room...» →
  // combate de sala cm127 (dng_enter_room por pitFall → onEnterCell).
  await page.keyboard.press("ArrowUp");
  await expect
    .poll(
      () =>
        page.evaluate(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          () => (window as any).__u5test.game.combat !== null,
        ),
      { timeout: 10_000 },
    )
    .toBe(true);
  // Absorción total + teardown real (el pacer llamaría endCombat al ver `over`; se
  // empuja por el mismo bridge para no depender de una tecla más).
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (window as any).__u5test;
    const g = t.game;
    const c = g.combat;
    let guard = 0;
    while (c && !c.over && guard++ < 60) {
      const cur = c.currentUnit;
      if (!cur || cur.kind !== "player") break;
      cur.x = 5;
      cur.y = 3;
      c.playerMove("north"); // pisa (5,2) bajo el alma → «X is absorbed!»
    }
    if (!c || !c.absorptionSentinel) throw new Error("la absorción no armó el centinela");
    t.applyEvents(g.endCombat());
  });
}

/** Fase viva de la escena del endgame (hook DEV), o null. */
async function endgamePhase(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).__u5test.endgamePhase?.() as string | null) ?? null,
  );
}

/**
 * Conduce la escena hasta la fase pedida: pulsa Espacio periódicamente (los beats de
 * TEXTO avanzan por tecla; las fases de animación se la tragan) y hace poll de la fase.
 * Devuelve el log ACUMULADO de consola (el scrollback del PORT retiene sólo 12 líneas,
 * así que se muestrea en cada iteración para no perder las páginas tempranas del
 * diálogo). El «12» es el ring del port (`coreview.ts`), no una medida derivada del
 * binario: la tanda 2 del barrido prosa-autofiel des-selló el «fidelidad intacta: ring
 * de 12» de `log-scroll:81` por circular, y los rects del descriptor de texto están
 * declarados **Clase C** en `re/notes/ui-text-layer.md:198-202`.
 */
async function driveToPhase(page: Page, target: string, timeoutMs: number): Promise<string> {
  const t0 = Date.now();
  let seen = "";
  while (Date.now() - t0 < timeoutMs) {
    seen += "\n" + (await consoleText(page));
    if ((await endgamePhase(page)) === target) return seen;
    await page.keyboard.press("Space");
    await page.waitForTimeout(250);
  }
  throw new Error(`la escena no llegó a '${target}' (fase=${await endgamePhase(page)})`);
}

test.describe("endgame — los dos finales (#34 ventana-frame)", () => {
  test("VICTORIA (con la Sandalwood Box): guión completo hasta el freeze terminal", async ({ page }) => {
    // `?scenebeat=40` (auditoría Q4): las fases de ANIMACIÓN del pacer (re-tinte,
    // orb/moongate, disolución, pergamino) corren a 40 ms/beat en vez de a reloj de
    // pared real (~90 s hasta el freeze) — los beats por TECLA (diálogo/historia) no
    // cambian. Recorta el timeout de 120 s (coste fijo de suite + ventana de flake
    // bajo contención) a 60 s con margen sobrado.
    test.setTimeout(60_000);
    await gotoGame(page, undefined, ["scenebeat=40"]);
    await triggerEndgame(page, true);

    // La escena arranca por el re-tinte verde (2 beats del censo) y abre el diálogo.
    await expect.poll(() => endgamePhase(page), { timeout: 10_000 }).not.toBeNull();
    // Diálogo del trono byte-exacto de ENDMSG.DAT, paceado por tecla.
    const log = await driveToPhase(page, "orbMoongate", 30_000);
    expect(log).toContain("Well met,");
    expect(log).toContain("Didst thou bring my box?");
    expect(log).toContain("You reply: Yes");
    expect(log).toContain("Our worlds await!");
    // Orb + moongate + disolución + historia + pergamino → freeze terminal (GAP 9).
    await driveToPhase(page, "terminalFreeze", 30_000);
    // CONTENIDO del pergamino en canvas (guarda del bug scroll-vacío 2026-07-23: la fase
    // llegaba pero el e2e no aseveraba el TEXTO estampado): las líneas publicadas por el
    // pacer NO están vacías, la primera es el datestamp (ENDGAME 0x0326) y el revelado
    // llegó al final (en terminalFreeze el pergamino queda estampado COMPLETO).
    const scroll = await page.evaluate(
      () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((window as any).__u5test.endgameScroll?.() as { lines: string[]; reveal: number } | null) ?? null,
    );
    expect(scroll, "el pacer publicó scrollLines a la escena").not.toBeNull();
    expect(scroll!.lines.length).toBeGreaterThan(0);
    expect(scroll!.lines[0]).toMatch(/^Be it known/);
    expect(scroll!.reveal).toBe(scroll!.lines.length);
    // El pergamino DOM viejo queda SUPRIMIDO (la fase scroll lo estampa en canvas).
    await expect(page.locator(".endgame-scroll")).toHaveCount(0);
    // game-won marcado.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await page.evaluate(() => (window as any).__u5test.game.state.questFlags["game-won"])).toBe(true);
  });

  test("VARADO (sin la caja): 2ª pregunta + 'pull up a chair' + sala-prisión", async ({ page }) => {
    test.setTimeout(30_000);
    await gotoGame(page, undefined, ["scenebeat=40"]); // Q4: animaciones a 40 ms/beat
    await triggerEndgame(page, false);

    const log = await driveToPhase(page, "terminalPrison", 20_000);
    expect(log).toContain("You reply: No");
    expect(log).toContain("sandalwood box"); // 2ª pregunta con la pista del passage
    expect(log).toContain("pull up a chair");
    // NO se abre pergamino (ni DOM ni fase scroll).
    await expect(page.locator(".endgame-scroll")).toHaveCount(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await page.evaluate(() => (window as any).__u5test.game.state.questFlags["game-won"])).toBe(true);
  });

  test("ningún final muestra el texto fabricado retirado en L4", async ({ page }) => {
    await gotoGame(page);
    await triggerEndgame(page, true);
    // El viejo overlay fabricado ("Thou art the saviour of the realm, Avatar!") NO existe.
    await expect(page.locator("body")).not.toContainText("saviour of the realm");
    await expect(page.locator("body")).not.toContainText("VICTORY");
  });
});
