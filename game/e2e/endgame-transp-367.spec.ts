/**
 * #367 (merge af14a4fd) — TRANSPARENCIA de los actores del ENDGAME en la piel de
 * fábrica: el recompose local 2d-bis (segunda instancia de ActorTransparency sobre el
 * atlas RECOLOREADO) quita el cuadrado opaco con que los actores llegan horneados de
 * coreview. La mirada e2e existente (#351, shader-escenas) comprueba que la escena
 * MONTA, PINTA y AVANZA bajo shader; el aserto de PÍXEL de la transparencia compuesta
 * — el patrón de #363 (shrine) y #366 (acampada) — faltaba, y es exactamente la clase
 * de defecto que #367 arregló. El modelo puro tiene vitest (endgame-actor-transp);
 * esto mira el LIENZO.
 *
 * DÓNDE SE MIRA (los esperados no salen del sujeto): Lord British llega a su celda
 * del guión LB_THRONE (5,3) — target de ENDGAME.OVL 0x06f9 — y ahí se queda durante
 * el diálogo; el suelo de la sala es ladrillo 0x44 (0x0607 cmp 0x44) re-teñido de
 * VERDE por la escena. Detector (calco de campProbe/#366):
 *   · corners(5,3): píxeles ENCENDIDOS en las 4 esquinas de la celda de LB — con
 *     transparencia el suelo asoma por el fondo del sprite; el horneado opaco pre-fix
 *     daba 0 (cuadrado negro).
 *   · corners(3,3): CONTROL POSITIVO del detector (celda de puro suelo 0x44 en el
 *     plano REAL del trono —assets/endgame.json scene—, fuera de los
 *     destinos del guión: lineup en (5,5)(4,6)(6,6)(3,7)(5,7)(7,7), gate (5,4),
 *     marcha de LB por la columna 5).
 *   · IDENTIDAD (LB está en (5,3) al medir): el bloque central de (5,3) difiere del
 *     bloque central de (3,3) — sin actor ambos son el mismo ladrillo.
 * Control negativo: la piel FIEL hornea el actor OPACO (fidelidad EGA) — mismo
 * detector, esquinas al fondo del sprite (≤2 px de tinta residual, medido 1, frente
 * a los >32 del shader). Si enrojece, la transparencia se fugó a la fiel (y de paso
 * acredita que el aserto shader no es vacuo).
 *
 * Identidad de piel por TAMAÑO de lienzo (trampa #318): shader ≥1280, fiel 320.
 * Receta de disparo del endgame: la CADENA FIEL de #179 (caída al foso de la planta 6
 * de Doom + absorción total), copiada de endgame.spec/shader-escenas-351.
 */
import { test, expect, type Page } from "@playwright/test";
import { consoleText, gotoGame, skinCycleReady } from "./helpers.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Siembra pre-rescate y dispara el endgame por la cadena fiel de #179. */
async function triggerEndgame(page: Page): Promise<void> {
  await page.evaluate(() => {
    const t = (window as any).__u5test;
    const g = t.game;
    g.state.questFlags["shadowlord-dead:falsehood"] = true;
    g.state.questFlags["shadowlord-dead:hatred"] = true;
    g.state.questFlags["shadowlord-dead:cowardice"] = true;
    g.state.lbArtifacts = { amulet: true, crown: true, sceptre: true };
    g.state.specialItems.woodenBox = true;
    g.enterDungeon(40);
    const ds = g.dungeonState;
    ds.pos.floor = 6;
    ds.pos.x = 4;
    ds.pos.y = 7;
    ds.pos.facing = "east";
    t.applyEvents(g.checkDoomRescue());
  });
  await page.keyboard.press("ArrowUp"); // paso al foso → caída → sala cm127
  await expect
    .poll(() => page.evaluate(() => (window as any).__u5test.game.combat !== null), {
      timeout: 10_000,
    })
    .toBe(true);
  await page.evaluate(() => {
    const t = (window as any).__u5test;
    const g = t.game;
    const c = g.combat;
    let guard = 0;
    while (c && !c.over && guard++ < 60) {
      const cur = c.currentUnit;
      if (!cur || cur.kind !== "player") break;
      cur.x = 5;
      cur.y = 3;
      c.playerMove("north"); // pisa (5,2) bajo el alma → absorbido
    }
    if (!c || !c.absorptionSentinel) throw new Error("la absorción no armó el centinela");
    t.applyEvents(g.endCombat());
  });
}

async function phase(page: Page): Promise<string | null> {
  return page.evaluate(
    () => ((window as any).__u5test.endgamePhase?.() as string | null) ?? null,
  );
}

/** Conduce hasta la fase pedida (los beats de texto van por tecla). */
async function driveToPhase(page: Page, target: string, timeoutMs: number): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if ((await phase(page)) === target) return;
    await page.keyboard.press("Space");
    await page.waitForTimeout(250);
  }
  throw new Error(`la escena no llegó a '${target}' (fase=${await phase(page)})`);
}

/**
 * Sonda de la sala en UN evaluate (mismo frame para identidad y aserto):
 *  - lbCorners: píxeles encendidos (r,g o b > 40) en las 4 esquinas de la celda (5,3).
 *  - floorCorners: ídem en (3,3), suelo puro del plano real — control del detector.
 *  - actorDiff: fracción de píxeles del bloque central de (5,3) que difieren del
 *    bloque central de (3,3) — identidad «hay actor en (5,3)».
 */
async function throneProbe(page: Page): Promise<{ lbCorners: number; floorCorners: number; actorDiff: number }> {
  return page.evaluate(() => {
    const cs = [...document.querySelectorAll("canvas")].filter(
      (cv) => document.contains(cv) && cv.getClientRects().length > 0,
    );
    cs.sort((a, b) => b.width * b.height - a.width * a.height);
    const cv = cs[0]!;
    const ctx = cv.getContext("2d")!;
    const s = cv.width / 320;
    const cell = (176 * s) / 11;
    const rect = (c: number, r: number): [number, number] => [
      Math.round(8 * s + c * cell),
      Math.round(8 * s + r * cell),
    ];
    const lit = (r: number, g: number, b: number): boolean => r > 40 || g > 40 || b > 40;
    const countIn = (x: number, y: number, w: number, h: number): number => {
      const d = ctx.getImageData(x, y, Math.max(1, w), Math.max(1, h)).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (lit(d[i]!, d[i + 1]!, d[i + 2]!)) n++;
      return n;
    };
    const corners = (c: number, r: number): number => {
      const [x0, y0] = rect(c, r);
      // Cuadrante de 2 px EGA (cell/8), no cell/4: la tinta del actor SÍ entra en
      // los cuadrantes de 4 px (medido: 10 px encendidos en fiel) y en los de 2 px
      // queda a lo sumo 1 px — el resto es fondo puro del sprite.
      const q = Math.max(2, Math.floor(cell / 8));
      const sz = Math.round(cell);
      return (
        countIn(x0, y0, q, q) +
        countIn(x0 + sz - q, y0, q, q) +
        countIn(x0, y0 + sz - q, q, q) +
        countIn(x0 + sz - q, y0 + sz - q, q, q)
      );
    };
    const centerBlock = (c: number, r: number): Uint8ClampedArray => {
      const [x0, y0] = rect(c, r);
      const sz = Math.round(cell);
      const q = Math.max(4, Math.floor(cell / 2));
      const off = Math.floor((sz - q) / 2);
      return ctx.getImageData(x0 + off, y0 + off, q, q).data;
    };
    const a = centerBlock(5, 3);
    const b = centerBlock(3, 3);
    let diff = 0;
    const n = Math.min(a.length, b.length) / 4;
    for (let i = 0; i < n * 4; i += 4) {
      const d =
        Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!);
      if (d > 48) diff++;
    }
    return { lbCorners: corners(5, 3), floorCorners: corners(3, 3), actorDiff: diff / n };
  });
}

async function biggestCanvasWidth(page: Page): Promise<number> {
  return page.evaluate(() => {
    const cs = [...document.querySelectorAll("canvas")].filter(
      (cv) => document.contains(cv) && cv.getClientRects().length > 0,
    );
    return cs.length ? Math.max(...cs.map((c) => c.width)) : 0;
  });
}

test("#367 · shader: las esquinas de la celda de Lord British enseñan el suelo de la sala (transparencia compuesta)", async ({ page }) => {
  test.setTimeout(90_000);
  await gotoGame(page, { skin: "shader" }, ["scenebeat=40"]);
  await skinCycleReady(page);
  await triggerEndgame(page);
  await expect.poll(() => phase(page), { timeout: 15_000 }).not.toBeNull();
  await driveToPhase(page, "dialogue", 30_000);
  // LB camina (5,8)→(5,3) en beats de animación (scenebeat=40 los acelera): se espera
  // a la IDENTIDAD (actor en la celda del trono) antes de asertar, en el mismo frame.
  await expect
    .poll(async () => (await throneProbe(page)).actorDiff, { timeout: 15_000, intervals: [200] })
    .toBeGreaterThan(0.1);

  expect(await biggestCanvasWidth(page)).toBeGreaterThanOrEqual(1280);
  const p = await throneProbe(page);
  expect(p.floorCorners).toBeGreaterThan(0); // el detector ve el suelo real
  expect(p.actorDiff).toBeGreaterThan(0.1); // LB sigue en (5,3) al medir
  // EL ASERTO #367: el suelo asoma por las esquinas del sprite. Pre-fix: 0 (cuadrado
  // negro del horneado de coreview).
  // Cota con margen medido: 176 px encendidos post-fix (suelo a través del fondo en
  // los 4 cuadrantes) contra 1 px en el opaco fiel — un orden de magnitud por medio.
  expect(p.lbCorners).toBeGreaterThan(32);
});

test("#367 · control negativo fiel: el actor sigue OPACO en la piel fiel (fidelidad EGA)", async ({ page }) => {
  test.setTimeout(90_000);
  await gotoGame(page, { skin: "faithful" }, ["scenebeat=40"]);
  await skinCycleReady(page);
  await triggerEndgame(page);
  await expect.poll(() => phase(page), { timeout: 15_000 }).not.toBeNull();
  await driveToPhase(page, "dialogue", 30_000);
  await expect
    .poll(async () => (await throneProbe(page)).actorDiff, { timeout: 15_000, intervals: [200] })
    .toBeGreaterThan(0.1);

  expect(await biggestCanvasWidth(page)).toBeLessThan(1280);
  const p = await throneProbe(page);
  expect(p.floorCorners).toBeGreaterThan(0);
  expect(p.actorDiff).toBeGreaterThan(0.1);
  // Mismo detector, mismo frame: el horneado fiel es opaco — las esquinas quedan en
  // el fondo del sprite. Cota ≤2 (medido 1: un único px de tinta del actor alcanza
  // una esquina de 2px), frente a los >32 del aserto shader: si la transparencia se
  // fugara a la fiel, el suelo encendería los cuadrantes enteros y esto enrojece.
  expect(p.lbCorners).toBeLessThanOrEqual(2);
});
