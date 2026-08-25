/**
 * GRAND TOUR — CAPÍTULO 14: Deceit (loc 33) — EL PIVOTE A MAZMORRA (Entrega 1).
 *
 * Primer capítulo de MAZMORRA del tour: la vista 3D con FACING. La MECÁNICA ya existe y está
 * endurecida en el core (src/core/dungeon/dungeon.ts + game.dungeonCommand + game.dungeonState,
 * probada en vivo en el fixture #47 dungeon-spells.spec.ts); este capítulo construye el ARNÉS del
 * tour (nav 3D en nav.ts: enterDungeon/walkDungeonTo/dungeonKlimb/dungeonCastInLor) y lo ejercita.
 *
 * ALCANCE = ENTREGA 1 (greenlight del lead: §2.A+B+D del brief-ch14-dungeon.md). El pather EVITA las
 * salas Room (combate) y las trampas/campos (hazard) → CERO infra de combate. Cubre lo BARATO y
 * seguro de Deceit; DIFIERE cell-deceit-room (combate) y cell-deceit-chest (floor 7, tras salas de
 * combate) a la Entrega 2 (que aún NO tiene greenlight).
 * [HISTÓRICO 2026-07-25: superado — la Entrega 2 EXISTE como ch14-deceitb.spec.ts (ch14b), que
 * cubre y asserta cell-deceit-chest (flujo O→G, main dad3f701) y cell-deceit-room (resolvedor de
 * sala, main d43d7769). La nota cov.note de este spec (línea ~151) repite el "DIFERIDO" pero es
 * string ejecutable de un capítulo sellado: se deja intacta a propósito.]
 *
 * RUTA (verificada contra dungeons.json[loc33], seed 0):
 *   1. enterDungeon(33): teleporta a la entrada overworld (240,73), abre el sello (word-spoken:33,
 *      costura de arnés como #47) y (E)nter → floor 0, escalera de subida (1,1), facing sur.
 *   2. In Lor (C→1→"il"): luz de la vista 3D (lightDepth 0→4). Sin ella el (S)earch aborta a oscuras.
 *   3. cell-deceit-trap: walkDungeonTo(1,2) y (S)earch al sur → el hoyo SIMPLE (1,3) (sub 0x00, NO
 *      pitfall) responde "in the pit." SIN pisar la trampa (cero daño, cero cascada de plantas).
 *   4. Descenso a floor 1: walkDungeonTo(1,6) — el pather revela la PUERTA SECRETA (1,0) con (S)earch y
 *      usa el WRAP TOROIDAL ((1,0)↔(1,7)) para rodear los pitfalls; dungeonKlimb("down") → floor 1 (1,6).
 *   5. cell-deceit-fountain: walkDungeonTo(1,5) y (D)rink la fuente (1,5) (sub 0x01 = Heal) → "Healed!".
 *   6. Salida: vuelve a (1,6), klimb "up" → floor 0 (1,6); walkDungeonTo(1,1); klimb "up" en la escalera
 *      de subida de floor 0 → exit-overworld ("Exit to Britannia!"). Exporta desde el overworld.
 *
 * ECONOMÍA / INVARIANTES: oro/karma/llaves/INT heredados de ch13 e INALTERADOS (la mazmorra no usa
 * oro ni llaves; NO se abre cofre → sin oro). DELTA ESPERADO del capítulo (estado real, no ruido):
 * currentMp/spellQuantities (cast de In Lor), currentHp (fuente Heal fija hp=maxHp), comida/turnos.
 * El maná/nivel/quantities del caster se SIEMBRAN como costura de arnés (igual que #47), documentado.
 *
 * CHECKPOINT: dungeonState NO se serializa en el .GAM → el capítulo SALE al overworld antes de exportar
 * (forma "travesía"): el sello es el punto de emergencia (240,73, location 0 — la MISMA celda de la
 * entrada: DUNGEON 0x1d10-0x1d1b deposita EN CRUDO, sin término por capa; britannia-y1-acta). CADENA: re-encadenado
 * sobre ch13.gam (West Britanny), entryClock 10:00, reseed(0).
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importCheckpoint, exportCheckpoint, readCheckpointFiles, DEFAULT_ENTRY_GOLD } from "./fixture";
import {
  bootWorld,
  chapterTimeout,
  enterDungeon,
  dungeonPos,
  dungeonCastInLor,
  walkDungeonTo,
  dungeonSearchAhead,
  dungeonDrink,
  dungeonKlimb,
  getPos,
} from "./nav";
import { Coverage } from "./coverage";
import { PARTY } from "./offsets";

const DECEIT = 33;
const PREV_CHAPTER = "ch13";

test.describe.serial("GT ch14 — Deceit (loc 33) — pivote a mazmorra (Entrega 1)", () => {
  test("entra a Deceit, alumbra con In Lor, cubre trampa + fuente evitando combate, y exporta el checkpoint", async ({ page }) => {
    test.setTimeout(chapterTimeout(600_000));
    await bootWorld(page); // arranque independiente de piel + costura teleportOverworld (task #16)

    // (1) Entrada por checkpoint REAL de ch13 + HORA CANÓNICA 10:00 + seed 0.
    await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 }, entryGold: DEFAULT_ENTRY_GOLD });
    await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
    const readNum = (expr: string) =>
      page.evaluate((e) => new Function("s", `return s.${e}`)((window as unknown as { __u5test: { state: () => unknown } }).__u5test.state()), expr) as Promise<number>;
    expect(await readNum("characters[0].intelligence")).toBe(22); // bracket all-A de ch01 (viaja por la cadena)
    const goldIn = await readNum("gold");
    const karmaIn = await readNum("karma");
    const keysIn = await readNum("keys");
    const gemsIn = await readNum("gems"); // #65: el canal de GEMAS, declarado
    expect(karmaIn, "premisa de cadena: karma 80 (invariante)").toBe(80);
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

    const cov = new Coverage("ch14");

    // Costura de arnés (cf #47): siembra maná/nivel/quantities del caster para In Lor. Estado test-only
    // declarado, misma clase que reseed/teleportOverworld; se documenta como delta del capítulo.
    await page.evaluate(() => {
      const g = (window as unknown as { __u5test: { game: { state: { characters: Array<{ currentMp: number; level: number }>; spellQuantities: number[] } } } }).__u5test.game;
      g.state.characters[0]!.currentMp = 40;
      g.state.characters[0]!.level = 8;
      g.state.spellQuantities[0] = 9; // In Lor
    });

    // (2) Entrada 3D REAL: teleporta a la entrada, abre el sello, (E)nter → enterDungeon(33).
    const entry = await enterDungeon(page, DECEIT);
    expect(entry).toMatchObject({ dungeon: 33, floor: 0 });
    cov.mark("dungeon-deceit").mark("command-e");

    // (3) In Lor: luz de la vista 3D. Sin ella el (S)earch de mazmorra aborta a oscuras (search.ts 0x065a).
    const lightBefore = await page.evaluate(() => (window as unknown as { __u5test: { game: { dungeonLightDepth: number } } }).__u5test.game.dungeonLightDepth);
    expect(lightBefore, "a oscuras al entrar (sin antorcha)").toBe(0);
    const inLor = (await dungeonCastInLor(page)).join("\n");
    // In Lor global → éxito SILENCIOSO (CAST 0x11a6): sin "A light surrounds thee" (flavor
    // fabricado, purgado). El efecto (lightDepth 0→4, abajo) prueba el cast; el eco rúnico
    // "IN LOR" del nombre tecleado es la traza.
    expect(inLor, "eco rúnico IN LOR").toMatch(/IN LOR/);
    expect(inLor, "sin flavor fabricado").not.toMatch(/surrounds/i);
    const lightAfter = await page.evaluate(() => (window as unknown as { __u5test: { game: { dungeonLightDepth: number } } }).__u5test.game.dungeonLightDepth);
    expect(lightAfter, "In Lor → profundidad 4").toBe(4);
    cov.mark("spell-0-in-lor").mark("command-c");

    // (4) cell-deceit-trap: encara el hoyo SIMPLE (1,3) desde (1,2) y (S)earch — sin pisarlo (cero
    //     daño/cascada). El pather deja a la party mirando al sur (último paso hacia (1,2)).
    await walkDungeonTo(page, 1, 2);
    const trap = (await dungeonSearchAhead(page)).join("\n");
    // Mensaje de mazmorra "in the pit." (dungeon.ts:477) — NO está en es.json (la key
    // traducida es 'A pit!\n'/'a pit.\n', otra cadena) → `t()` cae a inglés en ambos modos.
    // Assert inglés válido en es; NO es spot-check de traducción (ver tourLang.ts).
    expect(trap, "el hoyo simple (1,3) responde al (S)earch direccional").toMatch(/pit/i);
    cov.mark("cell-deceit-trap").mark("command-s");

    // (5) Descenso a floor 1: el pather revela la puerta secreta (1,0) y rodea los pitfalls por el wrap
    //     toroidal hasta la escalera de bajada (1,6); klimb "down".
    await walkDungeonTo(page, 1, 6);
    const f1 = await dungeonKlimb(page, "down");
    expect(f1, "klimb-down a la planta 1").toMatchObject({ dungeon: 33, floor: 1 });

    // (6) cell-deceit-fountain: la fuente (1,5) es Heal (sub 0x01) → "Healed!" (inocuo).
    await walkDungeonTo(page, 1, 5);
    const drink = (await dungeonDrink(page)).join("\n");
    // Mensaje de fuente "Healed!" SIN `\n` (dungeon.ts:559) — es.json sólo traduce 'Healed!\n'
    // (con salto), así que `t("Healed!")` no casa y cae a inglés en ambos modos. Assert inglés
    // válido en es; NO es spot-check de traducción.
    expect(drink, "la fuente Heal cura").toMatch(/Healed!/i);
    cov.mark("cell-deceit-fountain").mark("command-d");

    // (7) SALIDA por el camino real: sube a floor 0 y klimb-up en la escalera de subida (1,1) → overworld.
    await walkDungeonTo(page, 1, 6);
    const back0 = await dungeonKlimb(page, "up");
    expect(back0, "klimb-up de vuelta a la planta 0").toMatchObject({ dungeon: 33, floor: 0 });
    await walkDungeonTo(page, 1, 1);
    const exited = await dungeonKlimb(page, "up"); // planta 0 arriba → exit-overworld
    expect(exited, "el klimb de la cima SALE al overworld (dungeonState=null)").toBeNull();
    cov.mark("command-k");
    const overworld = await getPos(page);
    expect(overworld.location, "de vuelta en Britannia tras salir de la mazmorra").toBe(0);

    const keysOut = await readNum("keys");
    const gemsOut = await readNum("gems"); // #65: el canal de GEMAS, declarado
    const goldOut = await readNum("gold");
    const karmaOut = await readNum("karma");

    // (8) Cobertura declarada (política tour: SIN assert duro ≥N; el invariante es DETERMINISMO ×2).
    cov.note(
      `Deceit (loc 33) — PIVOTE A MAZMORRA, Entrega 1 (greenlight §2.A+B+D). Primer capítulo 3D del ` +
        `tour: arnés de nav con facing (enterDungeon/walkDungeonTo/dungeonKlimb/dungeonCastInLor en ` +
        `nav.ts) sobre la mecánica ya endurecida del core (#47). El pather EVITA Room/Trap/campo → CERO ` +
        `combate. TESTIGOS: In Lor éxito silencioso, luz por EFECTO (lightDepth 0→4); hoyo simple (1,3) 'in the ` +
        `pit.' por (S)earch direccional SIN pisarlo; fuente (1,5) Heal 'Healed!'. Ruta seed-0: revela la ` +
        `puerta secreta (1,0) + wrap toroidal para rodear los pitfalls; klimb down/up entre floors 0-1; ` +
        `SALE por la escalera (1,1) al overworld (forma "travesía": dungeonState no serializa → sello ` +
        `desde Britannia, 240,73 — la celda de la entrada, DUNGEON 0x1d10 en crudo). DIFERIDO a Entrega 2 (sin greenlight): cell-deceit-room (combate) y ` +
        `cell-deceit-chest (floor 7, tras salas de combate). GEMAS ${gemsIn}→${gemsOut} (#65). LLAVES ${keysIn}→${keysOut}, oro ` +
        `${goldIn}→${goldOut}, karma ${karmaIn}→${karmaOut} INALTERADOS (mazmorra sin oro/llaves; NO se ` +
        `abre cofre). Delta esperado: currentMp/spellQuantities (In Lor), currentHp (fuente Heal). ` +
        `Comandos e/c/s/d/k. HORA CANÓNICA 10:00, encadenado sobre ch13.gam.`,
    );
    const covPath = cov.write();
    const covered = JSON.parse(readFileSync(covPath, "utf8")) as { coveredIds: string[] };
    expect(covered.coveredIds.length).toBeGreaterThan(0);

    // (9) Checkpoint nativo por el camino real (desde el overworld tras salir). Deceit no toca
    //     oro/karma/llaves.
    const { gam } = await exportCheckpoint(page, "ch14");
    expect(gam.length).toBe(4192);
    expect(gam[PARTY.location]).toBe(0); // emergió al overworld
    expect(gam[PARTY.karma]).toBe(karmaIn);
    expect(keysOut, "llaves 0→0 tras el re-baseline de cadena: la mazmorra no gasta llaves (aserto RELATIVO, invariante al valor de entrada)").toBe(keysIn);
    expect(goldOut, "oro 1→1: no se abre cofre en la Entrega 1").toBe(goldIn);
  });

  test("el ch14.gam exportado es un save NATIVO que el propio port re-importa a idéntico estado", async ({ page }) => {
    await bootWorld(page, { debug: false }); // re-importa sin costura de arnés (task #16)
    const { gam, sidecar } = readCheckpointFiles("ch14");
    await page.evaluate(
      ([bytes, side]) => {
        const t = (window as unknown as { __u5test: { loadNativeSave: (b: number[], s?: unknown) => void } }).__u5test;
        t.loadNativeSave(bytes as number[], side);
      },
      [Array.from(gam), sidecar] as [number[], unknown],
    );
    expect(await getPos(page)).toMatchObject({ location: 0 });
    expect(await dungeonPos(page), "el save de emergencia NO está en mazmorra").toBeNull();
  });
});
