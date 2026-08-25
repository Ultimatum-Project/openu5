/**
 * GRAND TOUR — CAPÍTULO 17: DOOM + ENDGAME (el broche del tour).
 *
 * El capítulo FINAL: la party abre el sello de la Isla de Doom con la Palabra de Poder
 * VERAMOCOR, cruza la GUARDA del Shadowlord, entra a la 8ª mazmorra y — con las 3 regalías
 * (amuleto/corona/cetro) + los 3 Shadowlords muertos + la Sandalwood Box — rescata a Lord
 * British en el fondo (floor 8). Encadenado sobre ch16 (Underworld, entró por el remolino).
 *
 * TOPOLOGÍA (verificada del código + datos):
 *  · Doom es la LOCALIZACIÓN 40 (LAST_DUNGEON_LOCATION, quest/words.ts:15) y vive EN el
 *    Underworld en (128,128) [DATA.OVL 0x1eba/0x1ee2, game.ts:3056]. Es una ISLA DE 3 TILES
 *    en el mar negro: (127,128)=LeftDesert2, (128,128)=CaveEntrance, (129,128)=RightDesert2,
 *    ceñida por BlackSquare(0xFF) impasable (maps/underworld.json).
 *  · SELLO = DERRUMBE 0xDF (BlockEntrance, game.ts:314). Mientras `questFlags["word-spoken:40"]`
 *    esté en falso, `activeMap.tileAt(128,128)` COMPONE 0xDF (game.ts:702-712) → impasable.
 *  · (Y)ell VERAMOCOR ADYACENTE a la isla (yellWord, game.ts:3044; yellWordOfPower words.ts:71)
 *    → "A word of power is uttered" (WORD_UTTERED words.ts:33) + terremoto (game.ts:3089-3092)
 *    + abre el sello (questFlags["word-spoken:40"]=true, game.ts:3097) → el 0xDF vuelve a
 *    CaveEntrance (0x16) pisable.
 *  · GUARDA DE DOOM (doomEntranceAmbush, game.ts:5151, MAINOUT 0x7d8-0x812): (E)nter sobre
 *    Doom a PIE con ALGÚN Shadowlord vivo → "Attacked at entrance!" (DS 0x2a2f) + combate
 *    contra def 47 "SHADOW LORD" en la arena Psychedelic, y NO desciende (la emboscada es la
 *    guarda). Con los 3 muertos → descenso directo.
 *  · Doom entra SIEMPRE por la CIMA (floor 0), incluso desde el Underworld (excepción del
 *    loader, game.ts:5274-5278). Su floor 0 NO tiene escalera-up (type 0x1/0x3), así que la
 *    entrada CAE en el default (1,1) = celda de SALA (type 0xF) (maps/dungeons.json[loc40]).
 *  · Des Por FALLA EN SILENCIO en Doom (game.ts:5422): el descenso mágico no sirve; sólo
 *    escaleras/fosos físicos. Por eso el descenso completo es un PROBE bancado (ver §PROBE).
 *  · ENDGAME (#179, re/notes/absorcion-179-acta.md): la celda de LB es la sala cm127
 *    (planta 8, celda (5,7), alcanzada CAYENDO por el foso (5,7)/0x61 de la planta 7);
 *    cada miembro que pisa (5,2) bajo el alma atrapada es ABSORBIDO (Combat.maybeAbsorb,
 *    SJOG 0x1ea4) y con el tablero vacío endCombat desvía al guión
 *    (fireAbsorptionEndgame → rescueLordBritish viaAbsorption). BIFURCA por la Sandalwood Box
 *    (state.specialItems.woodenBox): CON caja → victoria (pergamino questScroll endgame.ts:101,
 *    "...Our worlds await!", "THE QUEST OF THE AVATAR IS FOREVER") ; SIN caja → varado
 *    ("Well then, pull up a chair."). Ambas fijan questFlags["game-won"]=true.
 *
 * COSTURAS DE ARNÉS (CLASE #47, DECLARADAS — precedente seedDelve/#47; la party del tour no
 * llega a Doom con toda la regalía por juego lineal):
 *   1. POSICIÓN a pie en la isla de Doom (127,128) del Underworld — la party de ch16 viaja en
 *      barco; un playthrough real DESEMBARCA para entrar. Costura cero-rand (teleportOverworld,
 *      la misma sancionada de enterLocation/enterDungeon) + transport=foot.
 *   2. KIT de endgame: 3 Shadowlords muertos (questFlags["shadowlord-dead:*"], fuente de verdad
 *      del gate — game.ts:5155/lordbritish.ts:139, NO shadowlordLocs), 3 regalías (lbArtifacts),
 *      Sandalwood Box (specialItems.woodenBox), skull keys. Sembrado por hooks QA, valores fijos
 *      → determinismo ×2 intacto. El sello del capítulo captura este estado "a las puertas de
 *      Doom con la regalía completa".
 *
 * SELLO: en el UMBRAL de Doom, EN EL UNDERWORLD (location 0, floor 0xFF, 128,128), con el sello
 * ABIERTO por VERAMOCOR. El endgame es TERMINAL (game-won) → va en tests aparte SIN sello (patrón
 * declarado por el brief: "si el juego termina, sella ANTES del prompt final").
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importCheckpoint, exportCheckpoint, readCheckpointFiles, DEFAULT_ENTRY_GOLD } from "./fixture";
import { bootWorld, chapterTimeout, getPos, dungeonPos, enterDungeon, type Pos } from "./nav";
import { tecla } from "../tempo-video.mjs";
import { Coverage } from "./coverage";
import { PARTY } from "./offsets";

const PREV_CHAPTER = "ch16";
const DOOM = 40;
const DECEIT = 33; // = FIRST_DUNGEON_LOCATION; mazmorra NO-Doom del control positivo del banner
const ISLAND = { x: 127, y: 128 } as const; // LeftDesert2, adyacente al oeste de la entrada
const DOOR = { x: 128, y: 128 } as const; // CaveEntrance de Doom (sellada = 0xDF)
const BLOCK_ENTRANCE = 0xdf;
const CAVE_ENTRANCE = 0x16;
const VERAMOCOR = "VERAMOCOR";

/** Copia local de la tecla del tour (ver nav.ts): cadencia 0 en test, humana en cine. */
const press = async (page: Page, key: string): Promise<void> => {
  await page.locator("body").press(key);
  const ms = tecla(0);
  if (ms > 0) await page.waitForTimeout(ms);
};
const consoleTail = (page: Page, n: number): Promise<string[]> =>
  page.evaluate((k) => (window as unknown as { __u5test: { consoleLines: () => string[] } }).__u5test.consoleLines().slice(-k), n);
const tileAt = (page: Page, x: number, y: number): Promise<number> =>
  page.evaluate(([px, py]) => (window as unknown as { __u5test: { game: { activeMap: { tileAt: (x: number, y: number) => number } } } }).__u5test.game.activeMap.tileAt(px, py), [x, y] as const);
const readFlag = (page: Page, flag: string): Promise<boolean> =>
  page.evaluate((f) => (window as unknown as { __u5test: { game: { state: { questFlags: Record<string, boolean> } } } }).__u5test.game.state.questFlags[f] === true, flag);

const cov = new Coverage("ch17");

/** Costura 1: posiciona a pie en la isla de Doom (Underworld) + on-foot. Cero-rand. */
async function seedAtDoomIsland(page: Page, at: { x: number; y: number } = ISLAND): Promise<void> {
  await page.evaluate((p) => {
    const w = window as unknown as {
      __u5debug: { teleportOverworld: (x: number, y: number, under?: boolean) => void };
      __u5test: { game: { state: { transport: string; transportTile: number } } };
    };
    w.__u5debug.teleportOverworld(p.x, p.y, true); // Underworld (floor 0xFF), cero-rand
    w.__u5test.game.state.transport = "foot";
    w.__u5test.game.state.transportTile = 0x1c; // a pie (gate de la emboscada, game.ts:5153)
  }, at);
}

/** Costura 2: KIT del endgame (regalía + 3 SL muertos + caja + skull keys). Valores fijos. */
async function seedEndgameKit(page: Page, opts: { box: boolean; allShadowlordsDead?: boolean } = { box: true }): Promise<void> {
  const allDead = opts.allShadowlordsDead ?? true;
  await page.evaluate(
    ([box, dead]) => {
      const g = (window as unknown as { __u5test: { game: { state: Record<string, unknown> } } }).__u5test.game;
      const st = g.state as {
        questFlags: Record<string, boolean>;
        lbArtifacts: { amulet: boolean; crown: boolean; sceptre: boolean };
        specialItems: { woodenBox: boolean };
        skullKeys: number;
      };
      // 3 Shadowlords: fuente de verdad = questFlags["shadowlord-dead:*"] (game.ts:5155).
      st.questFlags["shadowlord-dead:falsehood"] = dead as boolean;
      st.questFlags["shadowlord-dead:hatred"] = dead as boolean;
      st.questFlags["shadowlord-dead:cowardice"] = dead as boolean;
      st.lbArtifacts = { amulet: true, crown: true, sceptre: true }; // 3 regalías
      st.specialItems.woodenBox = box as boolean; // Sandalwood Box (bifurca el endgame)
      st.skullKeys = 3;
    },
    [opts.box, allDead] as const,
  );
}

/** (Y)ell una palabra por el getstring REAL de consola (main.ts:984-1004): "y" → teclea → Enter. */
async function yellWord(page: Page, word: string): Promise<string[]> {
  await press(page, "y");
  // Espera al prompt del getstring del Yell ("Yell what?", main.ts:988) antes de teclear.
  await page
    .waitForFunction(
      () => /what\?/i.test((window as unknown as { __u5test: { consoleLines: () => string[] } }).__u5test.consoleLines().slice(-3).join(" ")),
      undefined,
      { timeout: 10_000, polling: 16 },
    )
    .catch(() => {});
  await page.keyboard.type(word);
  await page.keyboard.press("Enter");
  return consoleTail(page, 8);
}

/**
 * Secuencia canónica del SELLO (fuente única del .gam y del ×2): import ch16 + kit + posición
 * en la isla + reseed(0), asevera el DERRUMBE, grita VERAMOCOR, pisa la entrada abierta, exporta.
 */
async function playAndSeal(page: Page): Promise<{
  gam: Uint8Array;
  sealedTile: number;
  enterWhat: string;
  blockedPos: Pos;
  yellLog: string;
  sealOpened: boolean;
  openTile: number;
  finalPos: Pos;
  karma: number;
}> {
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 }, entryGold: DEFAULT_ENTRY_GOLD });
  await seedAtDoomIsland(page);
  await seedEndgameKit(page, { box: true });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));

  const karma = await page.evaluate(() => (window as unknown as { __u5test: { state: () => { karma: number } } }).__u5test.state().karma);

  // (1) DERRUMBE: sellado, (128,128) COMPONE 0xDF (BlockEntrance) — impasable.
  const sealedTile = await tileAt(page, DOOR.x, DOOR.y);

  // (E)nter desde la isla (LeftDesert2, no enterable) → "Enter What?" (game.ts:4649).
  await press(page, "e");
  const enterWhat = (await consoleTail(page, 3)).join("\n");

  // El paso hacia la entrada sellada (0xDF) está BLOQUEADO.
  await press(page, "ArrowRight");
  const blockedPos = await getPos(page);

  // (2) YELL VERAMOCOR (adyacente) → uttered + quake + abre el sello.
  const yellLog = (await yellWord(page, VERAMOCOR)).join("\n");
  const sealOpened = await readFlag(page, `word-spoken:${DOOM}`);
  const openTile = await tileAt(page, DOOR.x, DOOR.y);

  // (3) Pisa la entrada ya abierta (CaveEntrance pisable): party a (128,128).
  await press(page, "ArrowRight");
  const finalPos = await getPos(page);

  const { gam } = await exportCheckpoint(page, "ch17");
  return { gam, sealedTile, enterWhat, blockedPos, yellLog, sealOpened, openTile, finalPos, karma };
}

test.describe.serial("GT ch17 — DOOM + endgame (el broche del tour)", () => {
  test("VERAMOCOR abre el sello de Doom (derrumbe→cueva), la party pisa el umbral y SELLA", async ({ page }) => {
    test.setTimeout(chapterTimeout(180_000));
    await bootWorld(page);

    // Premisa de cadena: arranca del Underworld de ch16 (entró por el remolino), karma 80.
    await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 }, entryGold: DEFAULT_ENTRY_GOLD });
    const entry = await getPos(page);
    expect(entry, "arranca en el Underworld (ch16)").toMatchObject({ location: 0, floor: 0xff });
    expect(
      await page.evaluate(() => (window as unknown as { __u5test: { state: () => { karma: number } } }).__u5test.state().karma),
      "premisa de cadena: karma 80",
    ).toBe(80);

    const r = await playAndSeal(page);

    // (1) DERRUMBE sellado.
    expect(r.sealedTile, "la entrada de Doom sellada COMPONE el derrumbe 0xDF (BlockEntrance)").toBe(BLOCK_ENTRANCE);
    expect(r.enterWhat, "(E)nter desde la isla (no sobre cueva) → 'Enter What?'").toMatch(/Enter What\?/i);
    expect(r.blockedPos, "el paso hacia el derrumbe 0xDF está bloqueado (sigue en la isla)").toMatchObject({ x: ISLAND.x, y: ISLAND.y });

    // (2) YELL VERAMOCOR abre el sello.
    expect(r.yellLog, "VERAMOCOR → 'A word of power is uttered'").toMatch(/word of power is uttered/i);
    expect(r.sealOpened, "questFlags['word-spoken:40'] = true (sello abierto)").toBe(true);
    expect(r.openTile, "tras VERAMOCOR la entrada vuelve a CaveEntrance (0x16) pisable").toBe(CAVE_ENTRANCE);
    cov.mark("command-y").mark("endgame-veramocor");

    // (3) Sello byte-exacto en el umbral de Doom (128,128), en el Underworld.
    expect(r.finalPos, "la party pisó la entrada abierta (128,128)").toMatchObject({ location: 0, floor: 0xff, x: DOOR.x, y: DOOR.y });
    expect(r.gam.length).toBe(4192);
    expect(r.gam[PARTY.location], "sello en el mapa (overworld id 0)").toBe(0);
    expect(r.gam[PARTY.floor], "sello en el UNDERWORLD (0xFF)").toBe(0xff);
    expect(r.gam[PARTY.x], "x del sello (umbral de Doom)").toBe(DOOR.x);
    expect(r.gam[PARTY.y], "y del sello (umbral de Doom)").toBe(DOOR.y);
    expect(r.gam[PARTY.karma], "karma 80 intacto").toBe(80);
  });

  test("GUARDA de Doom: con los 3 Shadowlords MUERTOS, (E)nter desciende directo (sin emboscada)", async ({ page }) => {
    test.setTimeout(chapterTimeout(120_000));
    await bootWorld(page);
    await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 }, entryGold: DEFAULT_ENTRY_GOLD });
    await seedEndgameKit(page, { box: true, allShadowlordsDead: true });
    // Posiciona SOBRE la entrada abierta (sello ya abierto) para (E)nter directo.
    await seedAtDoomIsland(page, DOOR);
    await page.evaluate((doom) => {
      const g = (window as unknown as { __u5test: { game: { state: { questFlags: Record<string, boolean> } } }; }).__u5test.game;
      g.state.questFlags[`word-spoken:${doom}`] = true; // sello abierto
    }, DOOM);
    await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));

    await press(page, "e"); // (E)nter REAL sobre Doom

    const ds = await dungeonPos(page);
    const combat = await page.evaluate(() => (window as unknown as { __u5test: { game: { combat: unknown } } }).__u5test.game.combat !== null);
    const log = (await consoleTail(page, 8)).join("\n");

    expect(log, "sin emboscada (los 3 Shadowlords muertos)").not.toMatch(/Attacked at entrance/i);
    expect(combat, "no arranca combate de emboscada").toBe(false);
    expect(ds, "desciende a Doom (mazmorra 40) por la CIMA (floor 0)").toMatchObject({ dungeon: DOOM, floor: 0 });
    // ★ RE-BASELINE 2026-07-31 (task #28) — antes se exigía /DOOM/ en el log. Era la conducta
    // VIEJA: `9eb71836` («fix(#182 · D9): DOOM no imprime banner de nombre») la corrigió y este
    // spec se quedó rancio (el fix tocó game.ts + doom-ambush.test.ts, pero no pudo tocar su
    // e2e hermano por el mutex del tour). Derivación: MAINOUT `07d8: cmp word ptr [bp-2],0x27`
    // + `07dc: jne 0x816` ⇒ al banner (0x816) SÓLO se llega si la localización NO es Doom; con
    // Doom el flujo se va a la rama 0x7de-0x812, que no imprime nombre jamás. El port lo calca
    // con la guarda `id === LAST_DUNGEON_LOCATION` de `locationNameBanner` (game.ts:5796).
    expect(log, "Doom NO anuncia su nombre (MAINOUT 0x07dc `jne 0x816`, fix 9eb71836)").not.toMatch(/DOOM/);
    cov.mark("dungeon-doom").mark("command-e");
  });

  // CONTROL POSITIVO de la aserción de AUSENCIA de arriba. Un `not.toMatch(/DOOM/)` no prueba
  // nada por sí solo: pasaría igual si `consoleTail` estuviera ciego, si el banner hubiera
  // dejado de emitirse para TODAS las mazmorras, o si el (E)nter no llegara al loader. Este
  // caso vecino ejerce el MISMO instrumento y el MISMO camino de entrada sobre una mazmorra
  // NO-Doom: si el banner deja de verse aquí, el rojo es del emisor, no de la guarda de Doom.
  test("CONTROL de la ausencia: otra mazmorra (Deceit) SÍ anuncia su nombre por el MISMO camino", async ({ page }) => {
    test.setTimeout(chapterTimeout(120_000));
    await bootWorld(page);
    await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 }, entryGold: DEFAULT_ENTRY_GOLD });
    await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));

    await enterDungeon(page, DECEIT); // teletransporta a su entrada overworld + (E)nter REAL

    const log = (await consoleTail(page, 8)).join("\n");
    expect(log, "el banner de nombre SÍ se emite para una mazmorra que no es Doom").toMatch(/DECEIT/);
  });

  test("GUARDA de Doom: con un Shadowlord VIVO, (E)nter → 'Attacked at entrance!' + combate, y NO desciende", async ({ page }) => {
    test.setTimeout(chapterTimeout(120_000));
    await bootWorld(page);
    await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 }, entryGold: DEFAULT_ENTRY_GOLD });
    // Kit COMPLETO salvo que UN Shadowlord sigue vivo (allShadowlordsDead=false).
    await seedEndgameKit(page, { box: true, allShadowlordsDead: false });
    await seedAtDoomIsland(page, DOOR);
    await page.evaluate((doom) => {
      const g = (window as unknown as { __u5test: { game: { state: { questFlags: Record<string, boolean> } } }; }).__u5test.game;
      g.state.questFlags[`word-spoken:${doom}`] = true;
    }, DOOM);
    await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));

    await press(page, "e"); // (E)nter con Shadowlord vivo → emboscada

    const ds = await dungeonPos(page);
    const combat = await page.evaluate(() => (window as unknown as { __u5test: { game: { combat: unknown } } }).__u5test.game.combat !== null);
    const log = (await consoleTail(page, 8)).join("\n");

    expect(log, "emboscada del Shadowlord al entrar (DS 0x2a2f)").toMatch(/Attacked at entrance/i);
    expect(combat, "la emboscada ARRANCA combate").toBe(true);
    expect(ds, "la emboscada es la GUARDA: NO desciende a la mazmorra").toBeNull();
  });

  test("ENDGAME — VICTORIA (con la Sandalwood Box): rescate de Lord British + pergamino de cierre", async ({ page }) => {
    test.setTimeout(chapterTimeout(120_000));
    await bootWorld(page);
    await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 }, entryGold: DEFAULT_ENTRY_GOLD });
    await seedEndgameKit(page, { box: true, allShadowlordsDead: true });

    // Desciende a Doom y colócate ante el FOSO de la celda (planta 6, (4,7) mirando al
    // este) — costura de arnés declarada (el descenso completo por las 8 plantas es un
    // PROBE, ver último test). #179: el desenlace ya NO se dispara por planta — la vía
    // fiel es CAER por el foso (5,7)/0x61 a la celda cm127, ser absorbido miembro a
    // miembro bajo el alma atrapada (SJOG 0x1ea4) y que el teardown del tablero vacío
    // desvíe al endgame (endCombat → centinela → fireAbsorptionEndgame). El paso al
    // foso y el combate van por el pipeline REAL; la costura restante (declarada) es
    // colocar a cada miembro en (5,3) en su turno. re/notes/absorcion-179-acta.md.
    await page.evaluate(() => {
      const t = (window as unknown as { __u5test: { game: any; applyEvents: (e: unknown[]) => void } }).__u5test;
      const g = t.game;
      g.enterDungeon(40);
      const ds = g.dungeonState;
      ds.pos.floor = 6;
      ds.pos.x = 4;
      ds.pos.y = 7;
      ds.pos.facing = "east";
      t.applyEvents(g.checkDoomRescue()); // marca in-doom (#179: ya no dispara nada)
    });
    await page.keyboard.press("ArrowUp"); // paso al foso → caída → «Entering room...»
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as unknown as { __u5test: { game: any } }).__u5test.game.combat !== null,
          ),
        { timeout: 10_000 },
      )
      .toBe(true);
    const res = await page.evaluate(() => {
      const t = (window as unknown as { __u5test: { game: any; applyEvents: (e: unknown[]) => void } }).__u5test;
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
      const events = g.endCombat();
      t.applyEvents(events);
      return {
        messages: events.filter((e: any) => e.kind === "message").map((e: any) => e.text).join("\n"),
        endings: events.filter((e: any) => e.kind === "game-won").map((e: any) => e.ending),
        gameWon: g.state.questFlags["game-won"] === true,
      };
    });

    // El rescate emite la narración fiel (lordbritish.ts:177-187 + endgame.ts).
    expect(res.messages, "rompe el sello final de Doom con la regalía").toMatch(/shatter the final seal of Doom/i);
    expect(res.messages, "Lord British se alza y retoma el trono").toMatch(/takes again the throne of Britannia/i);
    expect(res.messages, "rama de la CAJA: extrae la esfera roja — 'Our worlds await!'").toMatch(/Our worlds await!/i);
    expect(res.messages, "pergamino de cierre: THE QUEST OF THE AVATAR IS FOREVER").toMatch(/THE QUEST OF THE AVATAR IS FOREVER/);
    expect(res.messages, "informe de tiempo del pergamino (endgame_datestamp)").toMatch(/thy Quest compleat in/i);
    expect(res.endings, "desenlace = victoria").toEqual(["victory"]);
    expect(res.gameWon, "questFlags['game-won'] = true").toBe(true);

    // Presentación: el pergamino de VICTORIA se abre por el pipeline real (#20 L4).
    // RE-BASELINE 2026-07-23 (doble motivo, ver endgame.spec.ts:55-95): desde los hitos
    // del testigo #20 (ventana-frame H2, 07-22) (1) el guión pacea por TECLA (getkey
    // 0x83dc: diálogo Yes/No + storyHouse/storyDream) ANTES del pergamino — la espera
    // pasiva de 15 s del sello anterior se quedaba mirando la 1ª página de historia; y
    // (2) el pergamino DOM viejo (.endgame-scroll[data-endgame='victory']) quedó
    // SUPRIMIDO: la fase `scroll` lo estampa EN CANVAS (ENDSC.16). Se conduce con
    // Espacio periódico y se asevera por fase del pacer, como el spec canónico.
    {
      const t0 = Date.now();
      let phase: string | null = null;
      while (Date.now() - t0 < 90_000) {
        phase = await page.evaluate(
          () => ((window as unknown as { __u5test: { endgamePhase?: () => string | null } }).__u5test.endgamePhase?.() as string | null) ?? null,
        );
        if (phase === "scroll" || phase === "terminalFreeze") break;
        await page.keyboard.press("Space");
        await page.waitForTimeout(250);
      }
      expect(phase, "la escena llega a la fase `scroll` (pergamino en canvas) conducida por tecla").toMatch(/^(scroll|terminalFreeze)$/);
    }
    // CONTENIDO del pergamino en canvas (guarda del bug scroll-vacío 2026-07-23: este
    // spec aseveraba fase + DOM-suprimido pero NO el texto estampado): las líneas que el
    // pacer publicó a la escena NO están vacías, la primera es el datestamp («Be it
    // known…», ENDGAME 0x0326) y el revelado ARRANCA (>0 tras el primer beat de línea).
    const readScroll = (): Promise<{ lines: string[]; reveal: number } | null> =>
      page.evaluate(
        () =>
          ((window as unknown as { __u5test: { endgameScroll?: () => { lines: string[]; reveal: number } | null } })
            .__u5test.endgameScroll?.() ?? null),
      );
    const scroll = await readScroll();
    expect(scroll, "el pacer publicó scrollLines a la escena").not.toBeNull();
    expect(scroll!.lines.length, "pergamino con líneas").toBeGreaterThan(0);
    expect(scroll!.lines[0], "primera línea = datestamp").toMatch(/^Be it known/);
    await expect
      .poll(async () => (await readScroll())?.reveal ?? 0, { timeout: 15_000 })
      .toBeGreaterThan(0);

    // ── PASADA-VÍDEO: esperar al pergamino COMPLETO (ticket #26) ──────────────────
    // Petición del usuario (2026-07-26): «falta del final todo el tema del pergamino
    // final que muestra el texto final después del moongate rojo».
    //
    // POR QUÉ HACE FALTA: el texto del pergamino va PACEADO A RELOJ DE PARED
    // (`EG_SCROLL_LINE_MS` = 350 ms por línea) y Playwright DEJA DE GRABAR cuando el
    // test cierra. Las aserciones de arriba se dan por satisfechas con `reveal > 0`
    // —basta la PRIMERA línea— así que el clip acababa con el pergamino a medio
    // estampar; en la pasada del 07-25, CONTENIDA, el test tardaba lo suficiente y sí
    // salía, y en frío ya no. Es una CARRERA, no un defecto del port: un jugador real
    // lo ve entero.
    //
    // POR QUÉ AQUÍ Y NO `?scenebeat`: el knob ACORTA las escenas modales (=0 las hace
    // instantáneas), así que capturaría el texto pero MATANDO la cadencia de máquina de
    // escribir, que es justo lo que se quiere ver. Esperar preserva la cadencia real.
    //
    // MARGEN DECLARADO: tras completarse el revelado se aguanta `EG_SCROLL_TAIL_MS`
    // (2 500 ms) — no es un número al azar: es EXACTAMENTE la cola que el propio pacer
    // mantiene antes de pasar de fase, así que el vídeo sostiene el pergamino lo mismo
    // que lo sostiene el juego.
    //
    // SÓLO BAJO `U5_TOUR_VIDEO`: sin la env este bloque no se ejecuta, así que la pasada
    // normal (sellos, presupuestos de capítulo, digests) queda EXACTAMENTE como estaba.
    if (process.env.U5_TOUR_VIDEO) {
      const SCROLL_READ_BEAT_MS = 2_500; // = EG_SCROLL_TAIL_MS (ui/endgame-pacer.ts)
      await expect
        .poll(
          async () => {
            const s = await readScroll();
            return s ? s.reveal >= s.lines.length : false;
          },
          {
            timeout: 60_000,
            message: "pasada-vídeo: el pergamino no llegó a estamparse ENTERO (reveal < lines)",
          },
        )
        .toBe(true);
      await page.waitForTimeout(SCROLL_READ_BEAT_MS);
    }
    // El pergamino DOM viejo queda SUPRIMIDO (endgame.spec.ts:94) — el texto del
    // pergamino ya se aseveró arriba sobre los eventos (THE QUEST OF THE AVATAR…).
    await expect(page.locator(".endgame-scroll")).toHaveCount(0);
    cov.mark("endgame-doom-floor8").mark("endgame-rescue-lb");

    cov.note(
      `DOOM + ENDGAME (loc 40, Underworld 128,128 — isla de 3 tiles). VERAMOCOR abre el sello ` +
        `(derrumbe 0xDF→CaveEntrance 0x16, questFlags['word-spoken:40']; yellWord game.ts:3044 + quake). ` +
        `GUARDA doomEntranceAmbush (game.ts:5151, MAINOUT 0x7d8-0x812): SL vivo → 'Attacked at entrance!' ` +
        `+ combate Psychedelic, NO desciende; 3 SL muertos → descenso directo por la CIMA (floor 0, entry ` +
        `default (1,1)=SALA, Doom no tiene escalera-up). ENDGAME (#179): caída por el foso de la planta 6 ` +
        `((4,7)→(5,7)/0x61) a la celda cm127 + absorción total (Combat.maybeAbsorb, SJOG 0x1ea4) → ` +
        `endCombat desvía (fireAbsorptionEndgame) y rescueLordBritish(viaAbsorption) BIFURCA por specialItems.woodenBox: CON caja → victoria ` +
        `('Our worlds await!' + pergamino questScroll 'THE QUEST OF THE AVATAR IS FOREVER' + informe de ` +
        `tiempo); SIN caja → varado ('pull up a chair'). Ambas → game-won. ` +
        `COSTURAS #47: posición a pie en la isla (party de ch16 en barco, desembarca) + kit de endgame ` +
        `(3 SL muertos via questFlags['shadowlord-dead:*'] — fuente de verdad, NO shadowlordLocs; 3 regalías; ` +
        `Sandalwood Box; skull keys). SELLA en el UMBRAL de Doom (128,128 Underworld, sello abierto); el ` +
        `endgame es TERMINAL → tests aparte sin sello. HUECOS BANCADOS (§PROBE): (a) descenso completo por ` +
        `las 8 plantas (Des Por falla en silencio en Doom game.ts:5422; sólo escaleras/fosos físicos; salas ` +
        `0xF/0xA + trampas 0x6) — no cableado extremo-a-extremo. RESUELTO (fiel/sceptre-wire, CAST 0x1966): ` +
        `(U)se Cetro cableado por MECANISMO — barrido 3×3 overworld (mudo) + dissolveFacingField en mazmorra ` +
        `('Field dissolved!'); campos SÓLO en Wrong/Covetous, Doom NO tiene barreras (nib8=0 loc 0x28) → su ` +
        `'No effect!' es FIEL, no hueco. HORA 10:00, encadenado sobre ch16.gam.`,
    );
    const covPath = cov.write();
    const covered = JSON.parse(readFileSync(covPath, "utf8")) as { coveredIds: string[] };
    expect(covered.coveredIds).toEqual([
      "command-e",
      "command-y",
      "dungeon-doom",
      "endgame-doom-floor8",
      "endgame-rescue-lb",
      "endgame-veramocor",
    ]);
  });

  test("ENDGAME — VARADO (sin la caja): rescate sin pergamino, 'pull up a chair'", async ({ page }) => {
    test.setTimeout(chapterTimeout(120_000));
    await bootWorld(page);
    await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 }, entryGold: DEFAULT_ENTRY_GOLD });
    await seedEndgameKit(page, { box: false, allShadowlordsDead: true }); // SIN Sandalwood Box

    // #179 — misma cadena FIEL que el test de VICTORIA (caída al foso + absorción total);
    // el fork caja/sin-caja es del guión (ENDGAME_main 0x08c2), no de la vía.
    await page.evaluate(() => {
      const t = (window as unknown as { __u5test: { game: any; applyEvents: (e: unknown[]) => void } }).__u5test;
      const g = t.game;
      g.enterDungeon(40);
      const ds = g.dungeonState;
      ds.pos.floor = 6;
      ds.pos.x = 4;
      ds.pos.y = 7;
      ds.pos.facing = "east";
      t.applyEvents(g.checkDoomRescue()); // marca in-doom (#179: ya no dispara nada)
    });
    await page.keyboard.press("ArrowUp"); // paso al foso → caída → «Entering room...»
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as unknown as { __u5test: { game: any } }).__u5test.game.combat !== null,
          ),
        { timeout: 10_000 },
      )
      .toBe(true);
    const res = await page.evaluate(() => {
      const t = (window as unknown as { __u5test: { game: any; applyEvents: (e: unknown[]) => void } }).__u5test;
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
      const events = g.endCombat();
      t.applyEvents(events);
      return {
        messages: events.filter((e: any) => e.kind === "message").map((e: any) => e.text).join("\n"),
        endings: events.filter((e: any) => e.kind === "game-won").map((e: any) => e.ending),
        gameWon: g.state.questFlags["game-won"] === true,
      };
    });

    expect(res.messages, "rescata a LB igual (regalía completa)").toMatch(/takes again the throne of Britannia/i);
    expect(res.messages, "rama SIN caja: 'pull up a chair'").toMatch(/pull up a chair/i);
    expect(res.messages, "sin caja NO se abre el pergamino de cierre").not.toMatch(/THE QUEST OF THE AVATAR IS FOREVER/);
    expect(res.endings, "desenlace = varado").toEqual(["stranded"]);
    expect(res.gameWon, "el finale se disparó (game-won) igual").toBe(true);

    // Presentación: SIN pergamino de victoria (endgame.spec.ts #20 L4).
    await expect(page.locator(".endgame-scroll[data-endgame='victory']")).toHaveCount(0);
  });

  test("el ch17.gam es un save NATIVO que el port re-importa a idéntico estado (umbral de Doom, Underworld)", async ({ page }) => {
    await bootWorld(page, { debug: false });
    const { gam, sidecar } = readCheckpointFiles("ch17");
    await page.evaluate(
      ([bytes, side]) => {
        const t = (window as unknown as { __u5test: { loadNativeSave: (b: number[], s?: unknown) => void } }).__u5test;
        t.loadNativeSave(bytes as number[], side);
      },
      [Array.from(gam), sidecar] as [number[], unknown],
    );
    expect(await getPos(page), "re-importa al umbral de Doom (128,128) del Underworld").toMatchObject({ location: 0, floor: 0xff, x: DOOR.x, y: DOOR.y });
    expect(await dungeonPos(page), "el sello NO está dentro de la mazmorra (es el umbral)").toBeNull();
  });

  test("determinismo ×2: dos sellos frescos byte-idénticos", async ({ page }) => {
    test.setTimeout(chapterTimeout(180_000));
    await bootWorld(page);
    const a = await playAndSeal(page);
    const b = await playAndSeal(page);
    expect(a.gam.length).toBe(4192);
    expect(Buffer.compare(Buffer.from(a.gam), Buffer.from(b.gam)), "los dos .gam son byte-idénticos").toBe(0);
  });

  test("PROBE del descenso (bancado): entra a Doom y documenta hasta dónde llega el descenso real", async ({ page }) => {
    test.setTimeout(chapterTimeout(300_000));
    await bootWorld(page);
    await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 }, entryGold: DEFAULT_ENTRY_GOLD });
    await seedEndgameKit(page, { box: true, allShadowlordsDead: true });
    await seedAtDoomIsland(page, DOOR);
    await page.evaluate((doom) => {
      const g = (window as unknown as { __u5test: { game: { state: { questFlags: Record<string, boolean> } } }; }).__u5test.game;
      g.state.questFlags[`word-spoken:${doom}`] = true;
    }, DOOM);
    await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));

    await press(page, "e");
    const entered = await dungeonPos(page);
    expect(entered, "PROBE: entró a Doom por la cima").toMatchObject({ dungeon: DOOM, floor: 0 });

    // El entry (1,1) de Doom es una SALA (type 0xF). Da un paso para disparar el combate de sala
    // real y documenta si el resolvedor lo resuelve (sin sembrar armas: es un probe honesto).
    const floor0Cell = await page.evaluate(() =>
      (window as unknown as { __u5test: { game: { dungeonState: { cellAt: (f: number, x: number, y: number) => { type: number } } } } }).__u5test.game.dungeonState.cellAt(0, 1, 1).type,
    );
    // Diagnóstico bancado: reporta el tipo de celda de entrada (0xF esperado) para el ledger.
    expect([0xa, 0xf], "PROBE: la celda de entrada de Doom es una SALA (0xF, o 0xA si ya despejada)").toContain(floor0Cell);

    // NOTA para el lead: el descenso extremo-a-extremo por las 8 plantas NO está cableado de
    // forma determinista (Des Por falla en silencio en Doom; el planificador de arnés no tiene
    // ruta física validada Doom-específica; las salas pueden traer Daemons con posesión). Este
    // probe deja constancia del estado alcanzado (Doom floor 0) sin fabricar atajos: el endgame
    // real se cubre por la cadena de absorción en los tests de VICTORIA/VARADO (#179).
  });
});
