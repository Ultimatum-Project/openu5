/**
 * Ficha #351 — ESCENAS bajo la piel de FÁBRICA (shader). El e2e era CIEGO a esta piel:
 * `gotoGame` cableaba `skin=faithful` y toda la clase de defectos solo-shader fue
 * invisible por construcción. Las CINCO instancias medidas de la clase (#345 XOR del
 * WELL DONE · #243 · #363 shrine · #366 acampada · #367 endgame) vivieron todas en
 * vías de ESCENA del compositor shader — las que la suite no montaba nunca con
 * `?skin=shader`. Este spec les pone la primera mirada e2e:
 *
 *   · ACAMPADA (#366): los durmientes componen con TRANSPARENCIA sobre la arena
 *     CampFire (detector de píxel con control positivo + control negativo fiel,
 *     patrón de shrine-shader-transp.spec.ts/#363).
 *   · MAZMORRA 3D: el viewport pinta la perspectiva (no queda negro) y girar no
 *     revienta.
 *   · COMBATE: la arena pinta y el modo responde.
 *   · ENDGAME (#367): la escena monta bajo shader, avanza de fase y el viewport pinta.
 *
 * (El SHRINE ya tiene guarda propia en shrine-shader-transp.spec.ts; el overworld y
 * los knobs legacy, en shader-skin.spec.ts.)
 *
 * Los asertos de PÍXEL miran DENTRO del viewport (8..184 EGA), no el canvas entero:
 * el chrome EGA (marco/pergamino) pinta de sobra aunque el viewport esté negro, y un
 * conteo de colores del canvas completo pasaría con la escena rota — que es
 * exactamente la clase que este spec debe enrojecer.
 *
 * Identidad de piel por TAMAÑO de lienzo (trampa #318: `data-shell-skin` miente):
 * shader = canvas visible grande (≥1280); fiel = 320×200. La geometría se normaliza
 * con s = width/320, así los detectores sirven en las dos pieles.
 */
import { test, expect, type Page } from "@playwright/test";
import { consoleText, gotoGame, inCombat, skinCycleReady } from "./helpers.js";

/* ────────────────────────────── sondas de píxel ────────────────────────────── */

/**
 * Sonda de la escena de ACAMPADA en UN evaluate (mismo frame para identidad y aserto):
 *   · rocksFrac — FRACCIÓN de píxeles GRISES (r≈g≈b, tono medio) en las celdas
 *     (5,2)+(6,2), que en la arena CampFire son rocas del molinete (combatmaps.json
 *     idx 0; el tile 77 es gris en el 31,6% de sus píxeles, medido del atlas EGA). Es
 *     la IDENTIDAD de la escena: en el overworld de (76,40) esas celdas son tile 8
 *     (matorral, CERO píxeles grises en el atlas) — sin esta guarda, muestrear antes/
 *     después del sueño daría un verde falso sobre la hierba del mapa (el testigo
 *     elegido debe instanciar la diferencia). El umbral 0.04 es fracción (no conteo)
 *     para valer igual en fiel (s=1) y shader (s=4), y queda un orden de magnitud por
 *     encima de lo que el blending xBR puede fabricar en los bordes.
 *   · grass — matas VERDES (g>80 ∧ r<80 ∧ b<80) en las esquinas de la celda (1,1),
 *     hierba pura de la arena: CONTROL POSITIVO del detector (ve el suelo real).
 *   · sleeper — el ASERTO #366: matas verdes en las esquinas de la celda del PRIMER
 *     durmiente (playerStarts["south"][0] de la arena = (6,6), la misma tabla que usa
 *     `campSceneView()`; aquí sólo elige DÓNDE mirar, el esperado no sale de ahí).
 *     Con transparencia, el suelo asoma por el fondo del sprite tumbado; antes del
 *     fix #366 el recorte pleno horneaba el cuadrado NEGRO → 0 verdes.
 */
async function campProbe(page: Page): Promise<{ rocksFrac: number; grass: number; sleeper: number }> {
  return page.evaluate(() => {
    const cs = [...document.querySelectorAll("canvas")].filter(
      (cv) => document.contains(cv) && cv.getClientRects().length > 0,
    );
    cs.sort((a, b) => b.width * b.height - a.width * a.height);
    const cv = cs[0]!;
    const s = cv.width / 320; // escala respecto al frame EGA 320×200
    const cell = (176 * s) / 11;
    const ctx = cv.getContext("2d")!;
    const cellRect = (c: number, r: number): [number, number] => [
      Math.round(8 * s + c * cell),
      Math.round(8 * s + r * cell),
    ];
    const countIn = (
      x: number,
      y: number,
      w: number,
      h: number,
      pred: (r: number, g: number, b: number) => boolean,
    ): number => {
      const d = ctx.getImageData(x, y, Math.max(1, w), Math.max(1, h)).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (pred(d[i]!, d[i + 1]!, d[i + 2]!)) n++;
      }
      return n;
    };
    const isGreen = (r: number, g: number, b: number): boolean => g > 80 && r < 80 && b < 80;
    const isGray = (r: number, g: number, b: number): boolean =>
      Math.abs(r - g) < 24 && Math.abs(g - b) < 24 && r > 60 && r < 210;
    const corners = (c: number, r: number, pred: (r: number, g: number, b: number) => boolean): number => {
      const [x0, y0] = cellRect(c, r);
      const q = Math.max(2, Math.floor(cell / 4)); // cuadrante de esquina (4 px EGA)
      const sz = Math.round(cell);
      return (
        countIn(x0, y0, q, q, pred) +
        countIn(x0 + sz - q, y0, q, q, pred) +
        countIn(x0, y0 + sz - q, q, q, pred) +
        countIn(x0 + sz - q, y0 + sz - q, q, q, pred)
      );
    };
    const wholeCell = (c: number, r: number, pred: (r: number, g: number, b: number) => boolean): number => {
      const [x0, y0] = cellRect(c, r);
      const sz = Math.round(cell);
      return countIn(x0, y0, sz, sz, pred);
    };
    const sz = Math.round(cell);
    return {
      rocksFrac: (wholeCell(5, 2, isGray) + wholeCell(6, 2, isGray)) / (2 * sz * sz),
      grass: corners(1, 1, isGreen),
      sleeper: corners(6, 6, isGreen),
    };
  });
}

/** Nº de colores distintos (cap 16) DENTRO del viewport EGA (8..184) de la piel activa. */
async function viewportColors(page: Page): Promise<number> {
  return page.evaluate(() => {
    const cs = [...document.querySelectorAll("canvas")].filter(
      (cv) => document.contains(cv) && cv.getClientRects().length > 0,
    );
    cs.sort((a, b) => b.width * b.height - a.width * a.height);
    const cv = cs[0]!;
    if (!cv || cv.width === 0) return 0;
    const ctx = cv.getContext("2d");
    if (!ctx) return 0;
    const s = cv.width / 320;
    const d = ctx.getImageData(
      Math.round(8 * s),
      Math.round(8 * s),
      Math.round(176 * s),
      Math.round(176 * s),
    ).data;
    const colors = new Set<number>();
    for (let i = 0; i < d.length; i += 4) {
      colors.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
      if (colors.size > 16) break;
    }
    return colors.size;
  });
}

/** El lienzo visible más grande, para afirmar la identidad de la piel (shader ≥1280). */
async function biggestCanvasWidth(page: Page): Promise<number> {
  return page.evaluate(() => {
    const cs = [...document.querySelectorAll("canvas")].filter(
      (cv) => document.contains(cv) && cv.getClientRects().length > 0,
    );
    return cs.length ? Math.max(...cs.map((c) => c.width)) : 0;
  });
}

/* ─────────────────────────────── ACAMPADA (#366) ─────────────────────────────── */

/** Acampa a la intemperie: (76,40) es acampable (replay-acampada.spec.ts) y seed=1234
 *  duerme la noche COMPLETA sin emboscada (misma semilla que ese spec). h → horas →
 *  sin vigía. La escena dura hours×360 ms; las sondas entran de sobra en 8×360≈2,9 s. */
async function holeUp(page: Page, skin: "faithful" | "shader"): Promise<void> {
  await gotoGame(page, { loc: 0, x: 76, y: 40, seed: 1234, skin });
  // Una tecla enviada durante el swap de arranque se pierde en silencio (doc de
  // skinCycleReady): el ciclo de pieles debe estar listo ANTES de la primera tecla.
  await skinCycleReady(page);
  await page.locator("body").press("h");
  await expect.poll(() => consoleText(page)).toContain("For how many hours?");
  await page.locator("body").press("8");
  await expect.poll(() => consoleText(page)).toContain("Wilt thou set a watch?");
  await page.locator("body").press("n"); // sin vigía → todos duermen; arranca la escena
}

test("#366 · shader: los durmientes de la acampada dejan ver la hierba de la arena", async ({ page }) => {
  await holeUp(page, "shader");
  expect(await biggestCanvasWidth(page)).toBeGreaterThanOrEqual(1280);

  // Identidad de escena (rocas del molinete) + control positivo (hierba pura), en el
  // MISMO frame que el aserto. El poll cubre el montaje del primer frame compuesto.
  await expect
    .poll(async () => {
      const p = await campProbe(page);
      return p.rocksFrac > 0.04 && p.grass > 0;
    }, { timeout: 2_500, intervals: [120] })
    .toBe(true);

  // EL ASERTO #366: las esquinas de la celda del primer durmiente enseñan matas de
  // hierba a través del fondo transparente del sprite. Antes del fix: 0 (cuadrado negro).
  const p = await campProbe(page);
  expect(p.rocksFrac).toBeGreaterThan(0.04); // la escena sigue viva al medir
  expect(p.sleeper).toBeGreaterThan(0);
});

test("#366 · control negativo fiel: el tile del durmiente sigue OPACO (fidelidad EGA)", async ({ page }) => {
  await holeUp(page, "faithful");
  expect(await biggestCanvasWidth(page)).toBeLessThan(1280);

  await expect
    .poll(async () => {
      const p = await campProbe(page);
      return p.rocksFrac > 0.04 && p.grass > 0;
    }, { timeout: 2_500, intervals: [120] })
    .toBe(true);

  // Mismo detector, mismo frame: la fiel hornea el tile del durmiente OPACO — cero
  // matas en sus esquinas (verificado contra el atlas: la tinta del tile 286 no entra
  // en ningún cuadrante de esquina, y su fondo es negro). Si esto enrojece, la
  // transparencia se fugó a la piel fiel (y de paso acredita que el aserto shader de
  // arriba no es vacuo).
  const p = await campProbe(page);
  expect(p.rocksFrac).toBeGreaterThan(0.04);
  expect(p.sleeper).toBe(0);
});

/* ─────────────────────────────── MAZMORRA 3D ─────────────────────────────── */

test("shader · mazmorra 3D: el viewport pinta la perspectiva y girar no revienta", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  // Deceit: 1 al sur de la entrada (240,73), FALLAX pronunciada (patrón dungeon.spec /
  // shader-skin.spec, que sólo lo montaba bajo FIEL con ?dungpack=off).
  await gotoGame(page, { x: 240, y: 74, hour: 10, skin: "shader" });
  await skinCycleReady(page); // sin esto, la primera tecla puede perderse en el swap
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.game.state.questFlags["word-spoken:33"] = true;
  });
  await page.keyboard.press("ArrowUp"); // pisa la entrada
  await page.keyboard.press("e"); // (E)nter → mazmorra 3D
  await expect
    .poll(() =>
      page.evaluate(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => (window as any).__u5test.game.dungeonState != null,
      ),
    )
    .toBe(true);

  expect(await biggestCanvasWidth(page)).toBeGreaterThanOrEqual(1280);
  // La perspectiva 3D pinta DENTRO del viewport (paredes/suelo, no negro plano)…
  await expect.poll(() => viewportColors(page), { timeout: 10_000 }).toBeGreaterThan(2);
  // …y girar repinta sin reventar el frame loop.
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  expect(pageErrors, `pageerrors en mazmorra shader:\n${pageErrors.join("\n")}`).toEqual([]);
});

/* ──────────────────────────────── COMBATE ──────────────────────────────── */

test("shader · combate: la arena pinta dentro del viewport y el modo responde", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  await gotoGame(page, { x: 60, y: 60, skin: "shader" });
  await skinCycleReady(page); // sin esto, la primera tecla puede perderse en el swap
  // Siembra un enemigo al ESTE y ataca (receta determinista de attack.spec.ts).
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.game.overworldEnemies.enemies.push({
      defIndex: 0,
      tile: 0x94,
      water: false,
      x: 61,
      y: 60,
    });
  });
  await page.keyboard.press("a");
  await expect.poll(() => consoleText(page)).toContain("Attack-");
  await page.keyboard.press("ArrowRight"); // ESTE → hay enemigo → combate
  await expect.poll(() => inCombat(page)).toBe(true);

  expect(await biggestCanvasWidth(page)).toBeGreaterThanOrEqual(1280);
  // La arena de combate pinta dentro del viewport (terreno + actores).
  await expect.poll(() => viewportColors(page), { timeout: 10_000 }).toBeGreaterThan(4);
  expect(pageErrors, `pageerrors en combate shader:\n${pageErrors.join("\n")}`).toEqual([]);
});

/* ─────────────────────────────── ENDGAME (#367) ─────────────────────────────── */

test("#367 · shader: el endgame monta, avanza de fase y el viewport pinta", async ({ page }) => {
  test.setTimeout(60_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  await gotoGame(page, { skin: "shader" });
  // Siembra pre-rescate y dispara por la CADENA FIEL (#179, receta de endgame.spec.ts,
  // que sólo corre bajo FIEL): caída por el foso de la planta 6 a la celda cm127 +
  // absorción total + teardown con centinela. re/notes/absorcion-179-acta.md.
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    t.applyEvents(g.checkDoomRescue()); // marca in-doom (#179: ya no dispara nada)
  });
  await page.keyboard.press("ArrowUp"); // paso al foso → caída → sala cm127
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
      c.playerMove("north"); // pisa (5,2) bajo el alma → absorbido
    }
    if (!c || !c.absorptionSentinel) throw new Error("la absorción no armó el centinela");
    t.applyEvents(g.endCombat());
  });

  // La escena modal del endgame está VIVA bajo la piel de fábrica…
  const phase = (): Promise<string | null> =>
    page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => ((window as any).__u5test.endgamePhase?.() as string | null) ?? null,
    );
  await expect.poll(phase, { timeout: 15_000 }).not.toBeNull();
  const p0 = await phase();

  expect(await biggestCanvasWidth(page)).toBeGreaterThanOrEqual(1280);
  // …pinta la sala dentro del viewport…
  await expect.poll(() => viewportColors(page), { timeout: 10_000 }).toBeGreaterThan(4);

  // …y AVANZA: los beats de texto van por tecla (los de animación se la tragan).
  // Espera de CAMBIO en POSITIVO (lint #261): `.not.toBe(p0)` sí esperaba (falsa en t=0),
  // pero el lint discrimina por matcher; el predicado «fase ≠ p0» dice lo mismo sin `.not`.
  await expect
    .poll(
      async () => {
        await page.keyboard.press("Space");
        return (await phase()) !== p0;
      },
      { timeout: 20_000, intervals: [400] },
    )
    .toBe(true);

  expect(pageErrors, `pageerrors en endgame shader:\n${pageErrors.join("\n")}`).toEqual([]);
});
