/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * ch47 — RE-ADJUDICACIÓN JUGADA de cm18/cm20/cm121 con los 26 CAMPOS DE ENERGÍA vivos
 * (pendiente declarado por el tren #118, `re/notes/cargador-ticket-amplio-0xb4-0xe8-0x70.md`
 * §6: «los veredictos vivos de salas de cm18/cm20/cm121 no mueven stream por la siembra,
 * pero el TABLERO efectivo cambia (celdas bloqueadas/venenosas): re-adjudicar jugando»).
 *
 * Los tres sellos previos del censo (docs/guias/doom/CENSO-COMBATMAPS.md, REGISTRO POR
 * SALA) se midieron sobre un tablero SIN campos:
 *   · cm018 Deceit·r2  [SELLADA:VICTORY] — ch29 ruta-limpia, enterByLadder "down" f1(1,1)
 *   · cm020 Deceit·r4  [SELLADA:VICTORY] — ch20 pasada-1, approach east f5(0,1)
 *   · cm121 Doom·r9    [SELLADA:VICTORY] — ch37 cola, klimb-UP f7(5,3) facing north
 * Cada sala se RE-ENTRA aquí por SU MISMO mecanismo de entrada (misma receta de loadout y
 * checkpoint que su capítulo de sello) y se re-mide el veredicto ×2 (determinismo bajo
 * reseed(0)), ahora con el tablero efectivo real:
 *   · cm18: 12×0xEB apilados 4+4+4 en (4,5)/(5,5)/(6,5) — el ÚNICO istmo entre los dos
 *     lóbulos del rombo queda BLOQUEADO (COMBAT:0x0000 @00a4). Los proyectiles NO se
 *     bloquean (COMSUBS:0x12DE raycastea TILES, y el campo es objeto de 0x5C5A, no tile).
 *   · cm20: 4+4×0xE8 (veneno) sobre las DOS puertas (7,3)/(7,7) de los cuartos de cofres.
 *   · cm121: 6×0xE8 apilados sobre el paso (3,5) del corredor oeste.
 *
 * PROBES JUGADAS (entrada fresca aparte, para no contaminar el stream del veredicto):
 *   · 0xEB bloquea al PJ por teclado («Blocked!») y a la IA (ningún enemigo pisa el istmo).
 *   · An Grav por TECLADO (c → 'a','g' → cursor de Aim de CAST2:0x306) pela la pila CAPA A
 *     CAPA: 4 casts en cm18 (4→0 en (5,5)) / 6 en cm121 (6→0 en (3,5)); el cast N+1 sobre
 *     la celda vacía → "Failed!". Primer testigo e2e del cursor de An Grav en combate.
 *   · Pisar 0xE8 con un PJ → «… poisoned!» + status 'P' al cerrar la activación (0x1b1e).
 *   · Los monstruos PROPIOS de las salas (sprites crudos 208/240 ≥ 0x80) cierran turno
 *     SOBRE el campo sin recibir nada — gate del KIND 0x1c46 (unit-gate:
 *     tests/campos-energia-arena.test.ts §f; aquí se observa en la sala real).
 *
 * Sin .gam: el sello es el digest (como ch29/ch37). Capturas a test-results (gitignored).
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import {
  bootWorld,
  chapterTimeout,
  conquerRoom,
  dungeonDescendTo,
  dungeonKlimb,
  enterDungeon,
  enterRoomThroughAmbush,
  inDungeonCombat,
  setAmbushMode,
} from "./nav";

const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;
const DECEIT = 33;
const DOOM = 40;
const AN_GRAV = 18; // índice de hechizo (cast.ts case 18 → dispelField)

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Loadout común (receta ch29/ch37) + An Grav mezclado para las probes de disipación.
 *  `invis:false` (sólo probes): party SIN Ring of Invisibility — con la party invisible
 *  la IA enemiga no encuentra objetivo y TODO el bando cae a hp=1 y huye (moral rota,
 *  COMBAT:0x0D30 0e3b), lo que taparía la lectura de HP de las probes de inmunidad.
 *  Los VEREDICTOS conservan el ring (la receta EXACTA de sus sellos ch20/ch29/ch37). */
async function seedLoadout(page: Page, opts: { invis?: boolean } = {}): Promise<void> {
  await page.evaluate(
    ([bow, ring, arrows, anGrav]) => {
      const st = (window as any).__u5test.game.state;
      for (let i = 0; i < st.partySize; i++) {
        const c = st.characters[i];
        if (!c) continue;
        c.level = 8; c.maxHp = 240; c.currentHp = 240; c.strength = 30; c.dexterity = 30; c.intelligence = 30;
        c.status = "G"; c.weapon = bow; c.ring = ring; c.currentMp = 99;
      }
      st.equipmentQuantities[arrows] = 99;
      st.lightSpellMins = 9999; st.torchTurns = 9999;
      st.spellQuantities[22] = 99; // Des Por (descensos de Deceit)
      st.spellQuantities[anGrav] = 99; // An Grav (probes)
      for (let i = 0; i < st.reagentQuantities.length; i++) st.reagentQuantities[i] = 99;
    },
    [MAGIC_BOW, opts.invis === false ? 0xff : RING_INVIS, ARROWS, AN_GRAV] as const,
  );
}

/** Ranuras de campo vivas (lootTiles con familia 0xe8) del combate actual. */
async function fields(page: Page): Promise<Array<{ x: number; y: number; tile: number }>> {
  return page.evaluate(() => {
    const c = (window as any).__u5test.game.combat;
    if (!c) return [];
    return c
      .lootTiles()
      .filter((l: { tile: number }) => (l.tile & 0xfc) === 0xe8)
      .map((l: { x: number; y: number; tile: number }) => ({ x: l.x, y: l.y, tile: l.tile }));
  });
}
const at = (fs: Array<{ x: number; y: number }>, x: number, y: number) =>
  fs.filter((f) => f.x === x && f.y === y).length;

/** Espera a que el turno sea de un PJ (la app avanza los turnos enemigos con su pacer). */
async function waitPlayerTurn(page: Page): Promise<{ x: number; y: number }> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const c = (window as any).__u5test.game.combat;
          return c?.currentUnit?.kind === "player";
        }),
      { timeout: 60_000 },
    )
    .toBe(true);
  return page.evaluate(() => {
    const u = (window as any).__u5test.game.combat.currentUnit;
    return { x: u.x, y: u.y };
  });
}

async function consoleTail(page: Page, n: number): Promise<string[]> {
  const lines: string[] = await page.evaluate(() => (window as any).__u5test.consoleLines());
  return lines.slice(-n);
}

/** An Grav por TECLADO: c → 'a','g' (getstring rúnico) → cursor de Aim (arranca en la
 *  celda del lanzador, CAST2:0x306) → flechas hasta (tx,ty) → Enter confirma. Devuelve el
 *  eco del tail del Cast ("Success!" res=1 / "Failed!" res=0, CAST 0x11a6) cazado con
 *  poll inmediato — la consola es un ring de 12 líneas y los golpes enemigos la scrollean. */
async function castAnGravAt(page: Page, tx: number, ty: number): Promise<string> {
  const actor = await waitPlayerTurn(page);
  await page.keyboard.press("c");
  await page.waitForTimeout(150);
  await page.keyboard.press("a");
  await page.keyboard.press("g");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  const dx = tx - actor.x;
  const dy = ty - actor.y;
  for (let i = 0; i < Math.abs(dx); i++) await page.keyboard.press(dx > 0 ? "ArrowRight" : "ArrowLeft");
  for (let i = 0; i < Math.abs(dy); i++) await page.keyboard.press(dy > 0 ? "ArrowDown" : "ArrowUp");
  await page.keyboard.press("Enter");
  for (let i = 0; i < 100; i++) {
    const tail = (await consoleTail(page, 6)).join("\n");
    if (tail.includes("Success!")) return "Success!";
    if (tail.includes("Failed!")) return "Failed!";
    await page.waitForTimeout(50);
  }
  return "";
}

/** Entrada fresca a cm18 (receta ch29): ch13 + reseed(0) + Deceit → f1(1,1) → klimb-down.
 *  `probe:true` entra en modo TERRITORY (enterRoomThroughAmbush): en legacy el
 *  resolveCorridorAmbush post-klimb trata la SALA como emboscada y la resuelve él —
 *  válido para re-medir el sello (es el mecanismo exacto de ch29), inútil para sondar
 *  el combate abierto. */
async function enterCm18(page: Page, opts: { invis?: boolean; probe?: boolean } = {}): Promise<boolean> {
  await bootWorld(page);
  if (opts.probe) setAmbushMode("territory");
  await importCheckpoint(page, "ch13", { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as any).__u5test.reseed(0));
  await seedLoadout(page, opts);
  await enterDungeon(page, DECEIT);
  const doEntry = async () => {
    const p = await dungeonDescendTo(page, (f, x, y) => f === 1 && x === 1 && y === 1, {});
    if (!p) return;
    await dungeonKlimb(page, "down"); // aterriza f2(1,1) = la sala → combate
  };
  if (opts.probe) return enterRoomThroughAmbush(page, doEntry);
  await doEntry();
  return inDungeonCombat(page);
}

/** Entrada fresca a cm20 (receta ch20): ch13 + reseed(0) + Deceit → f5(0,1) → paso ESTE. */
async function enterCm20(page: Page, opts: { invis?: boolean } = {}): Promise<boolean> {
  await bootWorld(page);
  await importCheckpoint(page, "ch13", { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as any).__u5test.reseed(0));
  await seedLoadout(page, opts);
  await enterDungeon(page, DECEIT);
  const p = await dungeonDescendTo(page, (f, x, y) => f === 5 && x === 0 && y === 1, {});
  if (!p) return false;
  await page.evaluate(() => {
    (window as any).__u5test.game.dungeonState.pos.facing = "east";
  });
  await page.keyboard.press("ArrowUp"); // paso REAL por teclado (la piel conmuta a la arena)
  await page.waitForTimeout(200);
  return inDungeonCombat(page);
}

/** Entrada fresca a cm121 (receta ch37 r9): ch17 + reseed(0) + tp Doom f7(5,3) →
 *  facing north → klimb-UP (modo territory, tolerante a emboscada del errante). */
async function enterCm121(page: Page, opts: { invis?: boolean } = {}): Promise<boolean> {
  await bootWorld(page);
  setAmbushMode("territory");
  await importCheckpoint(page, "ch17", { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as any).__u5test.reseed(0));
  await seedLoadout(page, opts);
  const doEntry = async () => {
    await page.evaluate(
      ({ id }) => (window as any).__u5debug.teleportDungeon(id, 7, 5, 3),
      { id: DOOM },
    );
    await page.evaluate(() => {
      (window as any).__u5test.game.dungeonState.pos.facing = "north";
    });
    await dungeonKlimb(page, "up");
  };
  return enterRoomThroughAmbush(page, doEntry);
}

test.describe.serial("ch47 — re-adjudicación jugada de cm18/cm20/cm121 con campos (#118)", () => {
  // ── cm18 (Deceit r2) ─────────────────────────────────────────────────────────────
  test("cm18 · veredicto ×2 con el istmo 0xEB bloqueado: el resolvedor la GANA con su capacidad An Grav (política DEADEND-STUCK)", async ({ page }, testInfo) => {
    test.setTimeout(chapterTimeout(1_200_000));
    const digests: string[] = [];
    for (let pass = 0; pass < 2; pass++) {
      expect(await enterCm18(page), `entrada fresca a cm18 (pasada ${pass + 1})`).toBe(true);
      // Tablero efectivo NUEVO, en crudo del volcado: 12×0xEB apilados 4+4+4.
      const fs = await fields(page);
      expect(fs.length).toBe(12);
      expect([at(fs, 4, 5), at(fs, 5, 5), at(fs, 6, 5)]).toEqual([4, 4, 4]);
      expect(fs.every((f) => f.tile === 0xeb)).toBe(true);
      if (pass === 0) { await page.waitForTimeout(600); await page.screenshot({ path: testInfo.outputPath("cm18-entrada.png") }); } // settle: el lienzo tarda un beat en pintar la arena
      const v = await conquerRoom(page, { maxRounds: 600 });
      digests.push(v.digest);
      if (pass === 0) await page.screenshot({ path: testInfo.outputPath("cm18-final.png") });
      console.log(`[ch47] cm18 pasada ${pass + 1}: ${v.digest} roster=${v.roster}`);
    }
    expect(digests[1]).toBe(digests[0]); // determinismo ×2 bajo reseed(0)
    // ★ MEDIDO 2026-08-24 (este carril, 1ª corrida con campos — ADJUDICACIÓN DEL FLIP):
    // el sello pre-campos decía VICTORY (ch29); con el istmo 0xEB el veredicto del
    // RESOLVEDOR bajo la MISMA receta (ring invis) ~~es DEADEND-STUCK:e1:d0~~ —
    //   · la party invisible rompe la moral enemiga (no-target, COMBAT:0x0D30 0e3b:
    //     hp=1 + huida) y un enemigo huido (sprite crudo 216) queda en el lóbulo opuesto, INALCANZABLE
    //     a pie (0xEB bloquea el único istmo, COMBAT:0x0000 @00a4);
    //   · el desatasco del arnés sólo SALE ANDANDO por un borde, y los bordes de cm18
    //     son muro: sus salidas reales son las ESCALERAS 0xC8/0xC9 (salidas-11-acta).
    // ~~El defecto es el REPERTORIO del resolvedor (sin An Grav) — familia ficha #12.~~
    // FICHA CERRADA (carril combate-cabos, mismo día): `conquerRoom` lleva la capacidad
    // An Grav con política DEADEND-STUCK (nav.ts `anGravUnseal` — sólo cuando el
    // veredicto ya sería DEADEND-STUCK y hay 0xEB en el tablero; nunca primera opción,
    // los sellos que se ganan sin casts no tocan esa rama). Con ella el resolvedor pela
    // el istmo (la receta del sello lleva An Grav ×99 en el loadout) y CIERRA la sala:
    // RE-MEDIDO ×2 = VICTORY:e0:d0 (d0: la party invis no recibe golpes; el d3 de la
    // probe jugada de abajo es por entrar SIN ring). Este pin registra el comportamiento
    // MEDIDO del port, no un veredicto de fidelidad.
    expect(digests[0]).toBe("VICTORY:e0:d0");
  });

  test("cm18 · probes: «Blocked!» sobre 0xEB · An Grav por teclado pela (5,5) capa a capa 4→0 · 5º cast «Failed!»", async ({ page }, testInfo) => {
    test.setTimeout(chapterTimeout(900_000));
    expect(await enterCm18(page, { invis: false, probe: true })).toBe(true);
    // (a) El PJ NO pisa el campo: poke a (4,6), tecla norte → "Blocked!" y no se mueve.
    await waitPlayerTurn(page);
    await page.evaluate(() => {
      const u = (window as any).__u5test.game.combat.currentUnit;
      u.x = 4; u.y = 6;
    });
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(150);
    expect((await consoleTail(page, 3)).join("\n")).toContain("Blocked!");
    const pos = await page.evaluate(() => {
      const c = (window as any).__u5test.game.combat;
      const u = c.combatants.find((k: any) => k.kind === "player" && k.x === 4 && k.y === 6);
      return u ? { x: u.x, y: u.y } : null;
    });
    expect(pos).toEqual({ x: 4, y: 6 }); // el intento no movió al PJ
    // (b) La IA tampoco cruza: con las pilas intactas, ningún enemigo pisa el istmo
    // (4..6,5) ni cambia de lóbulo (fieldBlocksCell entra en cellFree para TODA clase
    // de mover — el barrido de 0x0000 es previo al despacho por clase). Se observa
    // JUGANDO: 6 activaciones de party pasando turno, muestreando posiciones enemigas.
    const sides0: Record<number, boolean> = await page.evaluate(() => {
      const c = (window as any).__u5test.game.combat;
      const out: Record<number, boolean> = {};
      for (const k of c.combatants) if (k.kind === "enemy" && k.status === "active") out[k.id] = k.y < 5;
      return out;
    });
    for (let i = 0; i < 6; i++) {
      await waitPlayerTurn(page);
      await page.keyboard.press(" ");
      for (let j = 0; j < 4; j++) {
        const bad = await page.evaluate(() => {
          const c = (window as any).__u5test.game.combat;
          return c.combatants.filter((k: any) => k.kind === "enemy" && k.status === "active" && k.y === 5 && k.x >= 4 && k.x <= 6).length;
        });
        expect(bad, "ningún enemigo sobre el istmo 0xEB").toBe(0);
        await page.waitForTimeout(120);
      }
    }
    const sides1: Record<number, boolean> = await page.evaluate(() => {
      const c = (window as any).__u5test.game.combat;
      const out: Record<number, boolean> = {};
      for (const k of c.combatants) if (k.kind === "enemy" && k.status === "active") out[k.id] = k.y < 5;
      return out;
    });
    for (const id of Object.keys(sides1)) {
      expect(sides1[Number(id)], `el enemigo ${id} no cambió de lóbulo con el istmo cerrado`).toBe(sides0[Number(id)]);
    }
    // (c) An Grav capa a capa sobre la pila central (5,5): 4 casts, 4→3→2→1→0.
    for (let n = 4; n >= 1; n--) {
      expect(at(await fields(page), 5, 5)).toBe(n);
      expect(await castAnGravAt(page, 5, 5)).toBe("Success!");
      await expect.poll(async () => at(await fields(page), 5, 5), { timeout: 30_000 }).toBe(n - 1);
    }
    // Las OTRAS pilas siguen enteras: el barrido casa (x,y), no vacía la arena.
    const fs = await fields(page);
    expect([at(fs, 4, 5), at(fs, 5, 5), at(fs, 6, 5)]).toEqual([4, 0, 4]);
    await page.screenshot({ path: testInfo.outputPath("cm18-tras-4-casts.png") });
    // (d) 5º cast sobre la celda ya vacía → "Failed!" (res=0 al tail 0x11a6).
    expect(await castAnGravAt(page, 5, 5)).toBe("Failed!");
    // (e) El istmo abierto se PISA: el original disiparía y cruzaría — aquí basta cerrar
    // la sala (el resolvedor ya puede cruzar por (5,5) si lo necesita).
    const v = await conquerRoom(page, { maxRounds: 600 });
    console.log(`[ch47] cm18 tras An Grav: ${v.digest}`);
    expect(v.outcome).toBe("VICTORY"); // MEDIDO: VICTORY:e0:d3 — la sala NO es softlock
  });

  // ── cm20 (Deceit r4) ─────────────────────────────────────────────────────────────
  test("cm20 · veredicto ×2 con las puertas envenenadas (7,3)/(7,7): VICTORY se SOSTIENE", async ({ page }, testInfo) => {
    test.setTimeout(chapterTimeout(1_200_000));
    const digests: string[] = [];
    for (let pass = 0; pass < 2; pass++) {
      expect(await enterCm20(page), `entrada fresca a cm20 (pasada ${pass + 1})`).toBe(true);
      const fs = await fields(page);
      expect(fs.length).toBe(8);
      expect([at(fs, 7, 3), at(fs, 7, 7)]).toEqual([4, 4]);
      expect(fs.every((f) => f.tile === 0xe8)).toBe(true);
      if (pass === 0) { await page.waitForTimeout(600); await page.screenshot({ path: testInfo.outputPath("cm20-entrada.png") }); } // settle: el lienzo tarda un beat en pintar la arena
      const v = await conquerRoom(page, { maxRounds: 600 });
      digests.push(v.digest);
      if (pass === 0) await page.screenshot({ path: testInfo.outputPath("cm20-final.png") });
      console.log(`[ch47] cm20 pasada ${pass + 1}: ${v.digest} roster=${v.roster}`);
    }
    expect(digests[1]).toBe(digests[0]);
    // MEDIDO 2026-08-24: los 4 enemigos viven en el corredor central — no hay que cruzar
    // ninguna puerta envenenada para ganar. VICTORY se sostiene. (Pin EXACTO: un
    // `toContain("VICTORY")` dejaría pasar VICTORY-STUCK.)
    expect(digests[0]).toBe("VICTORY:e0:d0");
  });

  test("cm20 · probes: pisar 0xE8 envenena al PJ ('P') · el monstruo de sala (sprite crudo 208 ≥ 0x80) cierra turno encima SIN veneno", async ({ page }, testInfo) => {
    test.setTimeout(chapterTimeout(900_000));
    expect(await enterCm20(page, { invis: false })).toBe(true);
    // (a) PJ pisa la puerta envenenada (7,3): el campo es TRANSPARENTE (no "Blocked!")
    // y al cerrar la activación 0x1b1e lo envenena — «… poisoned!» + roster 'P'.
    await waitPlayerTurn(page);
    const victim = await page.evaluate(() => {
      const u = (window as any).__u5test.game.combat.currentUnit;
      u.x = 7; u.y = 2;
      return u.charIdx;
    });
    await page.keyboard.press("ArrowDown"); // pisa (7,3)
    await page.waitForTimeout(200);
    const tail = (await consoleTail(page, 4)).join("\n");
    expect(tail).not.toContain("Blocked!");
    expect(tail).toContain("poisoned!");
    const status = await page.evaluate(
      (idx) => (window as any).__u5test.game.state.characters[idx].status,
      victim,
    );
    expect(status).toBe("P");
    await page.screenshot({ path: testInfo.outputPath("cm20-pj-envenenado.png") });
    // (b) INMUNIDAD del monstruo propio (roster real: sprites 208/176, índices 36/28): un
    // sprite crudo 208 (≥ 0x80, gate 0x1c46) se encaja DORMIDO sobre la OTRA pila (7,7)
    // — dormido no se mueve (wake 1/17,
    // COMBAT 0x0446) pero SÍ cierra su activación encima, que es cuando corre 0x1b1e.
    const probe = await page.evaluate(() => {
      const c = (window as any).__u5test.game.combat;
      const e = c.combatants.find(
        (k: any) => k.kind === "enemy" && k.status !== "dead" && (0x40 + 4 * k.enemyDef.index) === 208,
      );
      if (!e) return null;
      e.x = 7; e.y = 7; e.sleeping = true;
      return { id: e.id, hp: e.hp };
    });
    expect(probe, "queda un monstruo vivo de sprite crudo 208 para la probe").not.toBeNull();
    // Deja correr ~6 activaciones (pasando los turnos de PJ) con el enemigo clavado encima.
    for (let i = 0; i < 6; i++) {
      await waitPlayerTurn(page);
      await page.evaluate(({ id }) => {
        const c = (window as any).__u5test.game.combat;
        const e = c.combatants.find((k: any) => k.id === id);
        if (e && e.status !== "dead") { e.x = 7; e.y = 7; e.sleeping = true; } // re-clava
      }, { id: probe!.id });
      await page.keyboard.press(" "); // pass del PJ → la app cierra el ciclo de turnos
      await page.waitForTimeout(300);
    }
    const after = await page.evaluate(
      ({ id }) => {
        const c = (window as any).__u5test.game.combat;
        const e = c.combatants.find((k: any) => k.id === id);
        return e ? { hp: e.hp, status: e.status, x: e.x, y: e.y } : null;
      },
      { id: probe!.id },
    );
    // EXPOSICIÓN REAL: sigue sobre la pila. Sin auto-daño de veneno: si perdiera HP sería
    // por el veneno de campo (nadie más le pega: la party sólo pasó turnos). Gate 0x1c46.
    expect(after).not.toBeNull();
    expect([after!.x, after!.y]).toEqual([7, 7]);
    expect(after!.hp).toBe(probe!.hp);
  });

  // ── cm121 (Doom r9) ──────────────────────────────────────────────────────────────
  test("cm121 · veredicto ×2 con la pila de 6×0xE8 en (3,5): VICTORY se SOSTIENE", async ({ page }, testInfo) => {
    test.setTimeout(chapterTimeout(1_200_000));
    const digests: string[] = [];
    for (let pass = 0; pass < 2; pass++) {
      expect(await enterCm121(page), `entrada fresca a cm121 (pasada ${pass + 1})`).toBe(true);
      const fs = await fields(page);
      expect(fs.length).toBe(6);
      expect(at(fs, 3, 5)).toBe(6);
      expect(fs.every((f) => f.tile === 0xe8)).toBe(true);
      if (pass === 0) { await page.waitForTimeout(600); await page.screenshot({ path: testInfo.outputPath("cm121-entrada.png") }); } // settle: el lienzo tarda un beat en pintar la arena
      const v = await conquerRoom(page, { maxRounds: 600 });
      digests.push(v.digest);
      if (pass === 0) await page.screenshot({ path: testInfo.outputPath("cm121-final.png") });
      console.log(`[ch47] cm121 pasada ${pass + 1}: ${v.digest} roster=${v.roster}`);
    }
    expect(digests[1]).toBe(digests[0]);
    // MEDIDO 2026-08-24: el grupo south spawnea al sureste; los 10 enemigos viven en el
    // cuerpo central — la pila de (3,5) no corta la ruta. VICTORY se sostiene. Delta
    // colateral FIEL: la huida post-victoria sale por el oeste cruzando (3,5) y los
    // PJs quedan 'P' (0x1b1e; Mongbat/Reaper no llevan flags de veneno 0x0002/0x0400).
    expect(digests[0]).toBe("VICTORY:e0:d0");
  });

  test("cm121 · probes: An Grav pela la pila de SEIS capa a capa (6→0, 7º 'Failed!') · sprite 240 inmune encima", async ({ page }, testInfo) => {
    test.setTimeout(chapterTimeout(900_000));
    expect(await enterCm121(page, { invis: false })).toBe(true);
    // (a) INMUNIDAD en la sala real: un sprite crudo 240 (≥ 0x80) DORMIDO sobre (3,5)
    // (dormido no se mueve — wake 1/17 — pero cierra su activación encima: 0x1b1e).
    const probe = await page.evaluate(() => {
      const c = (window as any).__u5test.game.combat;
      const e = c.combatants.find(
        (k: any) => k.kind === "enemy" && k.status !== "dead" && (0x40 + 4 * k.enemyDef.index) === 240,
      );
      if (!e) return null;
      const orig = { x: e.x, y: e.y };
      e.x = 3; e.y = 5; e.sleeping = true;
      return { id: e.id, hp: e.hp, orig };
    });
    expect(probe, "queda un monstruo vivo de sprite crudo 240").not.toBeNull();
    for (let i = 0; i < 4; i++) {
      await waitPlayerTurn(page);
      await page.evaluate(({ id }) => {
        const c = (window as any).__u5test.game.combat;
        const e = c.combatants.find((k: any) => k.id === id);
        if (e && e.status !== "dead") { e.x = 3; e.y = 5; e.sleeping = true; }
      }, { id: probe!.id });
      await page.keyboard.press(" ");
      await page.waitForTimeout(300);
    }
    const after = await page.evaluate(
      ({ id }) => {
        const c = (window as any).__u5test.game.combat;
        const e = c.combatants.find((k: any) => k.id === id);
        return e ? { hp: e.hp, x: e.x, y: e.y } : null;
      },
      { id: probe!.id },
    );
    expect(after).not.toBeNull();
    expect([after!.x, after!.y]).toEqual([3, 5]); // exposición real: cerró turnos encima
    expect(after!.hp).toBe(probe!.hp);
    // Lo devuelve a su celda original para que no estorbe la disipación (la probe ya midió).
    await page.evaluate(({ id, orig }) => {
      const c = (window as any).__u5test.game.combat;
      const e = c.combatants.find((k: any) => k.id === id);
      if (e && e.status !== "dead") { e.x = orig.x; e.y = orig.y; }
    }, { id: probe!.id, orig: probe!.orig });
    // (b) An Grav por teclado: SEIS capas = seis casts (la pila más honda del juego).
    for (let n = 6; n >= 1; n--) {
      await expect.poll(async () => at(await fields(page), 3, 5), { timeout: 30_000 }).toBe(n);
      expect(await castAnGravAt(page, 3, 5)).toBe("Success!");
      await expect.poll(async () => at(await fields(page), 3, 5), { timeout: 30_000 }).toBe(n - 1);
    }
    await page.screenshot({ path: testInfo.outputPath("cm121-pila-disuelta.png") });
    // (c) 7º cast sobre la celda vacía → "Failed!".
    expect(await castAnGravAt(page, 3, 5)).toBe("Failed!");
  });
});
