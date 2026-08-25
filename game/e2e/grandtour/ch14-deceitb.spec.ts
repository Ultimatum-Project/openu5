/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * GRAND TOUR — CAPÍTULO 14b: Deceit (loc 33) — MAZMORRA, Entrega 2 (descenso + combate).
 *
 * La Entrega 1 (ch14-deceit.spec.ts) cubrió lo BARATO de la bolsa de entrada (trampa +
 * fuente) evitando combate y salió a Britannia. Esta Entrega 2 aborda las dos celdas
 * PROFUNDAS que la E1 difirió:
 *   · cell-deceit-chest — el cofre de FLOOR 7 (5,5).
 *   · cell-deceit-room  — el combate de SALA (resolvedor guionizado seed-0).
 *
 * HALLAZGO TOPOLÓGICO (derivado de dungeons.json[loc33], no del brief): Deceit es un
 * LABERINTO DE BOLSAS conectadas SÓLO verticalmente. Verificado por BFS:
 *   · el cofre (7,5,5) es INALCANZABLE por escaleras/Des Por solos — TODA ruta exige
 *     ≥1 trampa de FOSO (pitfall, caes de planta) + varios Des Por; y el cofre queda en
 *     una celda amurallada por los 4 lados (sólo se entra CAYENDO en ella);
 *   · desde las plantas profundas NO hay vuelta ARRIBA a Britannia (los fosos sólo
 *     bajan). El ÚNICO borde de salida es hacia el UNDERWORLD (Des Por en floor 7).
 *   · la sala del brief (floor-1 (5,3)) está amurallada (inalcanzable); las salas
 *     navegables viven en floor 5+, cada una en su bolsa.
 * Por eso este capítulo SALE al Underworld (no a Britannia): es la forma "travesía" con
 * el sello en el punto de emergencia del Underworld (location 0, floor 0xFF). Es la
 * consecuencia FIEL de saquear el fondo de una mazmorra de U5.
 *
 * ARNÉS (nav.ts, Entrega 2): `dungeonDescendTo` (planifica el descenso con las
 * transiciones reales — paso toroidal, foso, Klimb, Des Por — re-observando tras cada
 * salto porque los fosos ENCADENAN), `dungeonResolveRoomCombat` (resolvedor guionizado:
 * (A)ttack-Aim al enemigo en alcance, si no BFS de arena hacia melé o (Space) pasa;
 * determinista seed-0), `dungeonOpenChest`, `dungeonCastLevelChange`.
 *
 * ECONOMÍA: oro/karma/llaves/INT heredados de ch14 (E1). La mazmorra no usa oro ni
 * llaves; el cofre AÑADE su botín (tirada rng.next(1,90), Task 3.9 aproximada) → el ORO
 * SUBE por el botín (delta esperado del capítulo, documentado). karma/llaves/INT intactos.
 * DELTA esperado (estado real, no ruido): currentHp (daño de foso rand(1,8)/miembro/caída),
 * currentMp/spellQuantities (In Lor + Des Por). Se SIEMBRA el caster (maná/nivel/quantities)
 * y se cura la party al entrar (currentHp=maxHp) como costura de arnés, igual que #47/E1.
 *
 * CADENA: encadenado sobre ch14.gam (E1), entryClock 10:00, reseed(0). El sello ch14b.gam
 * es estado de Underworld tras emerger.
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importCheckpoint, exportCheckpoint, readCheckpointFiles, DEFAULT_ENTRY_GOLD } from "./fixture";
import {
  bootWorld,
  chapterTimeout,
  enterDungeon,
  dungeonPos,
  dungeonCastInLor,
  dungeonDescendTo,
  dungeonOpenChest,
  dungeonCastLevelChange,
  inDungeonCombat,
  resolveArenaCombat,
  getPos,
} from "./nav";
import { Coverage } from "./coverage";
import { PARTY } from "./offsets";

const DECEIT = 33;
const PREV_CHAPTER = "ch14";

/** Lee un campo del estado vivo (misma costura que E1). */
const readNum = (page: Page, expr: string) =>
  page.evaluate(
    (e) => new Function("s", `return s.${e}`)((window as unknown as { __u5test: { state: () => unknown } }).__u5test.state()),
    expr,
  ) as Promise<number>;

/**
 * COSTURA DE ARNÉS declarada, CLASE #47 (misma que reseed/teleportOverworld y el sembrado
 * de maná/nivel/quantities del fixture dungeon-spells de #47). Siembra explícitamente:
 *   · maná/nivel/quantities del caster → habilita In Lor (círculo 1) + Des Por (círculo 4);
 *   · currentHp = maxHp (CURA DE ENTRADA) → la party sobrevive el daño de los fosos
 *     (rand(1,8)/miembro/caída, ~3 caídas). NO infla maxHp: es una cura al valor real, no
 *     un tanque artificial. El HP pleno NO es load-bearing para la VICTORIA de la sala (el
 *     resolvedor gana floor2(1,1) con las armas reales); es un colchón declarado para que
 *     una caída no deje a un miembro en 'D' y rompa la cadena. El estado sembrado viaja al
 *     sello y se DOCUMENTA como delta del capítulo (currentMp/currentHp/spellQuantities).
 * Valores fijos → determinismo ×2 intacto.
 */
async function seedDelve(page: Page): Promise<void> {
  await page.evaluate(() => {
    const g = (window as unknown as { __u5test: { game: { state: { partySize: number; characters: Array<{ currentMp: number; level: number; currentHp: number; maxHp: number; status: string }>; spellQuantities: number[] } } } }).__u5test.game;
    for (let i = 0; i < g.state.partySize; i++) {
      const c = g.state.characters[i];
      if (!c) continue;
      c.currentMp = 99;
      c.level = 8; // ≥ círculo de Des Por (4)
      // La cura de entrada NO revive a los MUERTOS: `currentHp=maxHp` a un miembro 'D' lo
      // dejaba D+hp-lleno → Combat lo marca active por hp>0 y peleaba como FANTASMA (fantasma-
      // Shamino, infidelidad que contaminaba ch14b.gam→ch15.gam). Un muerto conserva hp0 — FIEL por
    // kernel 0x2A52 `kernel_apply_damage` (HP≤0 → HP=0 y status 'D' 0x44; re/notes/kernel-survival.md:109-113);
      // sólo curamos a los VIVOS (los que sufren daño de foso). Ver blocked-by-wall/... y §L4.
      if (c.status !== "D") c.currentHp = c.maxHp;
    }
    g.state.spellQuantities[0] = 20; // In Lor
    g.state.spellQuantities[22] = 20; // Des Por
  });
}

const cov = new Coverage("ch14b");

test.describe.serial("GT ch14b — Deceit (loc 33) — MAZMORRA Entrega 2 (descenso + combate)", () => {
  test("desciende por fosos+Des Por al cofre de floor 7, lo abre y EMERGE al Underworld (sella)", async ({ page }) => {
    test.setTimeout(chapterTimeout(600_000));
    await bootWorld(page);

    // (1) Entrada por el checkpoint REAL de ch14 (E1) + hora canónica 10:00 + seed 0.
    await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 }, entryGold: DEFAULT_ENTRY_GOLD });
    await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
    expect(await readNum(page, "characters[0].intelligence")).toBe(22); // bracket all-A de ch01
    const goldIn = await readNum(page, "gold");
    const karmaIn = await readNum(page, "karma");
    const keysIn = await readNum(page, "keys");
    const gemsIn = await readNum(page, "gems"); // #65: el canal de GEMAS, declarado
    expect(karmaIn, "premisa de cadena: karma 80").toBe(80);
    // RE-BASELINE 2026-07-31 (ventana del ORO, #52): 0 → 1, en los SIETE capítulos que
    // llevan este mismo pin — y el valor VUELVE porque la CAUSA que lo bajó no era la que
    // se dijo. El `keys 1→0` del sello de ch08 NO lo rompió el (J)immy de Yew: fue la
    // CONFISCACIÓN del arresto (`guardArrestJail`, `g_keys=0`, TOWN 0x1332). Ese sello se
    // había escrito con el party ENCARCELADO, porque la cadena entraba a Yew con 1 gp
    // contra un tributo de 20 y no podía pagar. La refutación está medida en
    // `re/notes/auditoria-estatica-sellos.md` §3: la nota VIVA de ch08 declara «LLAVES
    // 2→1», invariante desde el 07-24 —o sea, la fase del (J)immy SIEMPRE terminó con 1
    // llave— mientras el .gam pasó a traer 0; lo que cambió ocurre DESPUÉS de la última
    // lectura viva, y de los cinco escritores de `state.keys` sólo el arresto escribe ahí.
    // Con el pin `entryGold` el tributo se PAGA, no hay arresto, no hay confiscación, y la
    // llave vuelve. `karma` sigue siendo el invariante y sigue en 80 en los siete.
    expect(keysIn, "premisa de cadena: entra con 1 llave — con el pin entryGold (#52) el tributo de Yew se PAGA, así que no hay arresto y no hay CONFISCACIÓN de llaves. El «lo rompió el (J)immy» quedó REFUTADO por medición en re/notes/auditoria-estatica-sellos.md §3").toBe(1);

    await seedDelve(page);

    // (2) Entrada 3D REAL a Deceit + luz (In Lor). Sin luz el descenso navega a ciegas.
    const entry = await enterDungeon(page, DECEIT);
    expect(entry).toMatchObject({ dungeon: 33, floor: 0 });
    cov.mark("dungeon-deceit").mark("command-e");
    const inLor = (await dungeonCastInLor(page)).join("\n");
    // In Lor global → éxito SILENCIOSO (CAST 0x11a6): sin "A light surrounds thee" (flavor
    // fabricado, purgado). El eco rúnico "IN LOR" del nombre tecleado es la traza.
    expect(inLor, "eco rúnico IN LOR").toMatch(/IN LOR/);
    expect(inLor, "sin flavor fabricado").not.toMatch(/surrounds/i);
    cov.mark("spell-0-in-lor").mark("command-c");

    // (3) DESCENSO al cofre (7,5,5): el planificador cae por FOSOS y Des Por (Klimb en
    //     escaleras), re-observando tras cada salto (los fosos encadenan varias plantas).
    const atChest = await dungeonDescendTo(page, (f, x, y) => f === 7 && x === 5 && y === 5);
    expect(atChest, "descendió hasta el cofre de floor 7").toMatchObject({ dungeon: 33, floor: 7, x: 5, y: 5 });
    cov.mark("spell-22-des-por").mark("command-k");

    // (4) cell-deceit-chest: flujo FIEL O→G (residual-3, main a1f1f65c) — el (O)pen
    //     (0x12D4) abre ("Chest opened", tile→0x70) y el (G)et (0x179E) acredita el
    //     botín con la cabecera "contents of chest You find:". dungeonOpenChest ya
    //     encadena o→g; mismo orden de rand que el viejo open colapsado.
    //     ~~⚠ RE-SELLO PENDIENTE (orquestado por el lead)~~ [HISTÓRICO 2026-07-25:
    //     superado por el resello 46/46 en main 266808bc]: el (G)et añade un turno de
    //     mazmorra → los .gam de ch14b y la cadena aguas abajo (→ch18) cambian digest.
    const goldBeforeChest = await readNum(page, "gold");
    const chestLog = (await dungeonOpenChest(page)).join("\n");
    expect(chestLog, "el (O)pen abre el cofre (DS 0x8b96)").toMatch(/Chest opened/i);
    expect(chestLog, "el (G)et acredita botín de oro").toMatch(/\d+ gold!/i);
    const goldAfterChest = await readNum(page, "gold");
    expect(goldAfterChest, "el botín SUBE el oro (delta esperado del capítulo)").toBeGreaterThan(goldBeforeChest);
    cov.mark("cell-deceit-chest").mark("command-o");

    // (5) SALIDA por el borde REAL del fondo: Des Por en floor 7 → emerge al Underworld
    //     (no hay vuelta a Britannia desde el fondo — hallazgo topológico).
    const exitLog = (await dungeonCastLevelChange(page, "dp")).join("\n");
    expect(exitLog, "el Des Por del fondo emerge al Underworld").toMatch(/Underworld/i);
    expect(await dungeonPos(page), "fuera de la mazmorra tras emerger").toBeNull();
    const world = await getPos(page);
    expect(world.location, "de vuelta al mapa (overworld)").toBe(0);
    expect(world.floor, "emergió al UNDERWORLD (floor 0xFF)").toBe(0xff);

    const goldOut = await readNum(page, "gold");
    const karmaOut = await readNum(page, "karma");
    const keysOut = await readNum(page, "keys");
    const gemsOut = await readNum(page, "gems"); // #65: el canal de GEMAS, declarado
    // #65 — la declaración va AQUÍ y no en el `cov.note` grande: ése vive en OTRO test
    // (el de sala) y gemsIn/gemsOut no están en su scope. `cov` es de módulo y la nota
    // se acumula, así que el canal queda declarado igual y sin estado compartido.
    cov.note(
      `GEMAS ${gemsIn}→${gemsOut} — el cofre de floor 7 es donde NACEN las gemas de la cadena, y ` +
        `la nota del capítulo declaraba llaves y oro del botín pero NO las gemas (#65).`,
    );

    // (6) Checkpoint nativo desde el Underworld (camino real "Export .GAM").
    const { gam } = await exportCheckpoint(page, "ch14b");
    expect(gam.length).toBe(4192);
    expect(gam[PARTY.location], "sello en el mapa (overworld)").toBe(0);
    expect(gam[PARTY.floor], "sello en el UNDERWORLD").toBe(0xff);
    expect(gam[PARTY.karma], "karma intacto").toBe(karmaIn);
    // Re-baseline 2026-07-19: el cofre de pasillo usa la ruta de botín REAL (SJOG
    // (G)et 0x179E → dungeonChestLoot(floor), tablas DS 0x41bc/0x41c4/0x41cc) que en
    // esta cadena sembrada otorga +2 llaves — la vieja aserción 1→1 databa de la
    // aproximación solo-oro. Con el O→G fiel (residual-3) el botín llega vía el (G)et
    // explícito; el ORDEN de rand no cambia (trampa al abrir, botín al coger) → las
    // +2 llaves se mantienen, pero el turno extra del (G)et mueve el reloj del sello.
    expect(keysOut, "llaves +2: el botín real del cofre de floor 7 (2→4 en el árbol combinado)").toBe(keysIn + 2);
    expect(goldOut, "el oro sólo cambia por el botín del cofre").toBeGreaterThan(goldIn);
    expect(karmaOut).toBe(karmaIn);
  });

  test("resolvedor de combate de sala: entra a una sala REAL de Deceit y la GANA (cell-deceit-room)", async ({ page }) => {
    test.setTimeout(chapterTimeout(600_000));
    // Prueba de CAPACIDAD (no sella): entra a la Room-1 REAL de Deceit (floor-1 (5,7), combat
    // map 17 = 7× Gremlin) y el resolvedor CANÓNICO fase-2 (resolveArenaCombat) la GANA por
    // ASEDIO RANGED. La party spawnea en el bolsillo SUR, sellada de la cámara por muros + la
    // reja Portcullis(153) en (5,7) — que ES rangeWeaponPassable; con arco (range 7) abate a
    // los Gremlins (melé, range 1) a través de la reja SIN que puedan tocarla → cero bajas.
    // Delve independiente desde el mismo checkpoint ch14 (reseed 0) → no toca el sello del cofre.
    //
    // FIDELIDAD (fase 2, L4): la Room-2 (floor-2 (1,1), 4 Daemon) que esta prueba usaba antes
    // es INFRANQUEABLE fielmente (los daemons POSEEN a la party — over-by-bando cierra por
    // BANDO con la party derrotada), y su vieja victoria se apoyaba en el FANTASMA-SHAMINO
    // (seedDelve revivía al muerto → 3er combatiente). Ambas infidelidades RESUELTAS: seedDelve
    // ya salta los 'D', y la sala pasa a la Room-1 (Gremlins, sin posesión), ganada por los 2
    // fighters REALES (Avatar+Iolo) con arco. Ver re/notes/blocked-by-wall-fabricated.md y
    // deliberate-divergences (fantasma-Shamino → RESUELTO).
    await bootWorld(page);
    await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 }, entryGold: DEFAULT_ENTRY_GOLD });
    await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
    await seedDelve(page);
    // Siembra de ARCO en los VIVOS (costura de arnés, clase #47 declarada): equipa Bow (0x1a,
    // range 7) + flechas para el asedio ranged. Sólo en esta prueba de capacidad (NO en el
    // sello :97, que no seedea armas → ch14b.gam no cambia por esto).
    await page.evaluate(() => {
      const st = (window as unknown as { __u5test: { game: { state: { partySize: number; characters: Array<{ weapon: number; status: string }>; equipmentQuantities: number[] } } } }).__u5test.game.state;
      for (let i = 0; i < st.partySize; i++) {
        const c = st.characters[i];
        if (c && c.status !== "D") c.weapon = 0x1a; // Bow a los vivos
      }
      st.equipmentQuantities[0x1b] = 200; // flechas
    });

    // Arranca el combate de la Room-1 REAL (combat map 17 = 7× Gremlin, party al SUR = bolsillo
    // enjaulado, RNG del stream vivo) — misma sala/enemigos/RNG que la del binario. La Room-1
    // (floor-1 (5,7)) NO es navegable desde la entrada (su bolsillo está sellado de las
    // escaleras/Des Por; planDungeonDescent no halla ruta), así que se arranca DIRECTO —
    // prueba de CAPACIDAD, no de navegación; la travesía AUTÉNTICA la sella :97 (Underworld).
    const started = await page.evaluate(() => {
      const g = (window as unknown as { __u5test: { game: { startDungeonRoomCombat: (i: number) => void; combat: unknown; combatResources: { combatMaps: Array<{ index: number }> } } } }).__u5test.game;
      g.startDungeonRoomCombat(17);
      const c = g.combat as { combatants: Array<{ kind: string; status: string; enemyDef?: { name?: string } }> } | null;
      return {
        inCombat: c !== null,
        nGremlins: c ? c.combatants.filter((u) => u.kind === "enemy" && u.enemyDef?.name === "Gremlin").length : 0,
        // Fighters VIVOS: el Shamino 'D' (heredado de ch14) entra como combatiente muerto
        // (status 'dead', isActive false) — el resolvedor lo ignora. Sólo 2 pelean de verdad.
        nLiveFighters: c ? c.combatants.filter((u) => u.kind === "player" && u.status !== "dead").length : 0,
      };
    });
    expect(started.inCombat, "arrancó el combate de la Room-1").toBe(true);
    expect(started.nGremlins, "7 Gremlins de la Room-1 (map 17)").toBe(7);
    expect(started.nLiveFighters, "2 fighters VIVOS (Avatar+Iolo; Shamino 'D' NO revive)").toBe(2);

    // El resolvedor CANÓNICO fase-2 (resolveArenaCombat, ranged por la reja) la GANA.
    const won = await resolveArenaCombat(page, { maxRounds: 400 });
    expect(won, "el resolvedor cerró el combate (no atasco)").toBe(true);
    expect(await inDungeonCombat(page), "el combate de sala quedó RESUELTO").toBe(false);
    // «VICTORY!» se ROBUSTECE leyendo la captura del momento de la victoria
    // (`__arenaVictoryLog`, que resolveArenaCombat banca justo al limpiar el bando):
    // el scrollback de consola es un ring de 12 líneas y los ecos de la salida a pie
    // («South·», «Leave!» por miembro) lo DESPLAZAN — leerlo post-salida quedaba al
    // borde y dependía del nº de ecos (flip verde/rojo entre pasadas, adjudicado en el
    // carril tour-telemetry con control ×2: mismo main, mismo rojo sin telemetría).
    const log = await page.evaluate(
      () =>
        (window as unknown as { __arenaVictoryLog?: string }).__arenaVictoryLog ??
        (window as unknown as { __u5test: { consoleLines: () => string[] } }).__u5test.consoleLines().slice(-30).join("\n"),
    );
    expect(log, "el resolvedor GANÓ la sala (VICTORY)").toMatch(/VICTORY!/i);
    // Cero bajas del bando party (los 2 fighters reales, enjaulados/intocables).
    const partyDeaths = await page.evaluate(() => {
      const st = (window as unknown as { __u5test: { game: { state: { partySize: number; characters: Array<{ status: string }> } } } }).__u5test.game.state;
      // Shamino (índice 1) ya venía 'D' de ch14; contamos bajas NUEVAS entre los que entraron vivos.
      return st.characters.slice(0, st.partySize).filter((c, i) => c.status === "D" && i !== 1).length;
    });
    expect(partyDeaths, "cero bajas nuevas (asedio ranged, party intocable)").toBe(0);
    cov.mark("cell-deceit-room").mark("command-a");

    cov.note(
      `Deceit (loc 33) — MAZMORRA Entrega 2 (descenso + combate). HALLAZGO topológico ` +
        `(dungeons.json[loc33]): Deceit es un laberinto de bolsas conectadas SÓLO en vertical; ` +
        `el cofre (floor 7, 5,5) es INALCANZABLE por escaleras/Des Por solos (BFS: sin ruta) — toda ` +
        `vía exige ≥1 FOSO (pitfall) + varios Des Por, y el cofre está amurallado (se entra CAYENDO). ` +
        `Desde el fondo NO hay vuelta a Britannia: el único borde de salida es el UNDERWORLD (Des Por ` +
        `en floor 7). Por eso el capítulo SELLA en el Underworld (location 0, floor 0xFF) — forma ` +
        `"travesía" fiel al saqueo del fondo de una mazmorra U5. Arnés E2: dungeonDescendTo (planifica ` +
        `foso/Des Por/Klimb re-observando cascadas), resolveArenaCombat (canónico fase-2, side-aware: ` +
        `Attack-Aim al rival del bando contrario en alcance, si no BFS de arena o Space pasa). COFRE: ` +
        `(O)pen → botín rng.next(1,90) → oro SUBE (delta del capítulo). SALA (fase 2, L4): Room-1 REAL ` +
        `(floor-1 (5,7), 7× Gremlin) ganada por ASEDIO RANGED — la party enjaulada en el bolsillo sur ` +
        `dispara por la reja Portcullis(153, rangeWeaponPassable) con arco sembrado (0x1a, range 7); los ` +
        `Gremlins (melé) no cruzan → cero bajas, con los 2 fighters REALES (sin fantasma-Shamino). ` +
        `karma/llaves/INT intactos; oro sólo cambia por el botín. Delta esperado: currentHp (daño de ` +
        `foso), currentMp/spellQuantities (In Lor + Des Por). Comandos e/c/k/o/a. Sembrado caster + cura ` +
        `de entrada de VIVOS + arco (costura de arnés, cf #47/E1). HORA 10:00, encadenado sobre ch14.gam.`,
    );
    const covPath = cov.write();
    const covered = JSON.parse(readFileSync(covPath, "utf8")) as { coveredIds: string[] };
    expect(covered.coveredIds).toContain("cell-deceit-chest");
    expect(covered.coveredIds).toContain("cell-deceit-room");
  });

  test("el ch14b.gam exportado es un save NATIVO que el port re-importa a idéntico estado (Underworld)", async ({ page }) => {
    await bootWorld(page, { debug: false });
    const { gam, sidecar } = readCheckpointFiles("ch14b");
    await page.evaluate(
      ([bytes, side]) => {
        const t = (window as unknown as { __u5test: { loadNativeSave: (b: number[], s?: unknown) => void } }).__u5test;
        t.loadNativeSave(bytes as number[], side);
      },
      [Array.from(gam), sidecar] as [number[], unknown],
    );
    expect(await getPos(page)).toMatchObject({ location: 0, floor: 0xff }); // Underworld
    expect(await dungeonPos(page), "el save de emergencia NO está en mazmorra").toBeNull();
  });
});
