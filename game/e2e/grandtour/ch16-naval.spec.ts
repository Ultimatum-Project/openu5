/**
 * GRAND TOUR — CAPÍTULO 16: NAVAL — entrada al Underworld por REMOLINO.
 *
 * Rama NAVAL desde un checkpoint de SUPERFICIE (ch13, West Britanny): la cadena NO es
 * lineal — este capítulo importa ch13 igual que otros importan a su predecesor. Sustituye
 * al ch16-ascenso ARCHIVADO (dead-end fiel: la party de ch15 no puede resucitar al 3er
 * combatiente ni ganar salas ranged 2v5 — ver brief-ch16-ascenso.md).
 *
 * VÍA fiel de U5: el REMOLINO (whirlpool) SUCCIONA la nave al Underworld (MAINOUT 0x1248,
 * F-0 ya en main: game.ts outdoorWorldTurn → whirlpoolRelocate en vez de startCombat).
 *
 * COSTURAS DE ARNÉS (CLASE #47 declaradas, precedente seedDelve; la party del tour tiene
 * 1 oro y no compra fragata fielmente — se ANOTA como seam, no fabricación silenciosa):
 *   1. Fragata + posición en mar abierto (la party rica compraría la fragata en un
 *      shipwright y navegaría a aguas abiertas; el tour lo siembra por su estado pobre).
 *   2. El REMOLINO adyacente. §4 del brief: se PROBÓ la vía natural (navegar bajo seed-0)
 *      — 0 remolinos (y 0 enemigos) en 400 turnos de navegación → NO practicable; se cae
 *      al seam declarado (regla del lead: cap → seam, brevedad manda). El seam siembra el
 *      actor remolino adyacente; el paso dispara el F-0 real (reubicación, no combate).
 *
 * SELLA en (34,18) DENTRO del Underworld, EN BARCO. Deja la cadena posicionada para el
 * arco futuro «Expedición de los Shards» (multi-modal, prereqs garfio+reactivos+ranged;
 * brief-ch16-naval.md §8): los shards NO son llegables por nave desde (34,18) (pozo
 * cerrado 432 tiles; shards landlocked) → 2-3 capítulos futuros.
 */
import { test, expect, type Page } from "@playwright/test";
import { bootWorld, getPos } from "./nav";
import { importCheckpoint, exportCheckpoint, readCheckpointFiles, DEFAULT_ENTRY_GOLD } from "./fixture";
import { Coverage } from "./coverage";
import { PARTY } from "./offsets";

const PREV_CHAPTER = "ch13";
const OCEAN = { x: 91, y: 113 }; // agua profunda (tile 1) frente a West Britanny (BFS overworld.json)
const FRIGATE_TILE = 0x24; // fragata velas ARRIBA (deriva con viento; al pulsar no rema
// hacia el remolino, así el contacto de succión es determinista — probado en el probe §4)
const LANDING = { x: 0x22, y: 0x12 }; // (34,18) — destino del remolino (MAINOUT 0x12b2)
const press = (page: Page, key: string): Promise<void> => page.locator("body").press(key);
const consoleTail = (page: Page, n: number): Promise<string[]> =>
  page.evaluate((k) => (window as unknown as { __u5test: { consoleLines: () => string[] } }).__u5test.consoleLines().slice(-k), n);

const cov = new Coverage("ch16");

/** Siembra fragata en mar abierto + remolino adyacente (CLASE #47), da un paso, sella. */
async function playAndSeal(page: Page): Promise<{ gam: Uint8Array; pos: Awaited<ReturnType<typeof getPos>>; msg: string; combat: boolean }> {
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 }, entryGold: DEFAULT_ENTRY_GOLD });
  await page.evaluate(
    ([o, tile]) => {
      const t = window as unknown as { __u5test: { game: { state: Record<string, unknown>; overworldEnemies: { enemies: unknown[] } }; reseed: (s: number) => void } };
      t.__u5test.reseed(0);
      const st = t.__u5test.game.state as { position: { location: number; floor: number; x: number; y: number }; transport: string; transportTile: number };
      // Costura 1: fragata en mar abierto.
      st.position = { location: 0, floor: 0, x: (o as { x: number }).x, y: (o as { y: number }).y };
      st.transport = "ship";
      st.transportTile = tile as number;
      // Costura 2 (§4 seam): remolino adyacente al ESTE.
      t.__u5test.game.overworldEnemies.enemies.push({ slot: 1, defIndex: 43, tile: 0x1ec, water: true, x: (o as { x: number }).x + 1, y: (o as { y: number }).y, phase: 1 });
    },
    [OCEAN, FRIGATE_TILE] as const,
  );
  // Consumir turnos junto al remolino sembrado: en cada world_turn, el remolino
  // ADYACENTE dispara el F-0 (succión). Velas arriba → no remamos lejos; el contacto
  // ocurre en el primer turno (probado). Tope defensivo por si el viento nos aparta.
  for (let t = 0; t < 6; t++) {
    await press(page, "ArrowRight");
    const floor = await page.evaluate(() => (window as unknown as { __u5test: { state: () => { position: { floor: number } } } }).__u5test.state().position.floor);
    if (floor === 0xff) break;
  }
  const msg = (await consoleTail(page, 4)).join("\n");
  const combat = await page.evaluate(() => !!(window as unknown as { __u5test: { game: { combat: unknown } } }).__u5test.game.combat);
  const pos = await getPos(page);
  const { gam } = await exportCheckpoint(page, "ch16");
  return { gam, pos, msg, combat };
}

test.describe.serial("GT ch16 — NAVAL (entrada al Underworld por remolino)", () => {
  test("navega, el REMOLINO succiona la nave al Underworld (34,18) y SELLA en barco", async ({ page }) => {
    await bootWorld(page);
    await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 }, entryGold: DEFAULT_ENTRY_GOLD });
    const entry = await getPos(page);
    expect(entry, "arranca en West Britanny (ch13)").toMatchObject({ location: 19 });
    const karmaIn = await page.evaluate(() => (window as unknown as { __u5test: { state: () => { karma: number } } }).__u5test.state().karma);
    expect(karmaIn, "premisa de cadena: karma 80").toBe(80);

    const r = await playAndSeal(page);

    // (1) F-0 del remolino: reubicación al Underworld (34,18), NO combate.
    expect(r.pos, "reubicado al Underworld en (34,18)").toMatchObject({ location: 0, floor: 0xff, x: LANDING.x, y: LANDING.y });
    expect(r.combat, "el remolino NO inicia combate (succiona)").toBe(false);
    expect(r.msg, "imprime WHIRLPOOL!").toMatch(/WHIRLPOOL!/i);
    // nave preservada (viaja con la party).
    const transport = await page.evaluate(() => (window as unknown as { __u5test: { state: () => { transport: string } } }).__u5test.state().transport);
    expect(transport, "la nave viaja al Underworld (transporte preservado)").toBe("ship");
    expect(await page.evaluate(() => (window as unknown as { __u5test: { game: { activeMap: { kind: string } } } }).__u5test.game.activeMap.kind), "mapa activo = underworld").toBe("underworld");
    cov.mark("map-underworld");

    // (2) Sello byte-exacto en (34,18) del Underworld.
    expect(r.gam.length).toBe(4192);
    expect(r.gam[PARTY.location], "sello en el mapa (overworld id 0)").toBe(0);
    expect(r.gam[PARTY.floor], "sello en el UNDERWORLD (0xFF)").toBe(0xff);
    expect(r.gam[PARTY.x], "x del sello").toBe(LANDING.x);
    expect(r.gam[PARTY.y], "y del sello").toBe(LANDING.y);
    expect(r.gam[PARTY.karma], "karma 80 intacto").toBe(80);

    cov.note(
      `NAVAL: entrada al Underworld por REMOLINO (MAINOUT 0x1248, F-0 whirlpoolRelocate en main). ` +
        `Rama naval desde ch13 (West Britanny, superficie) — sustituye al ch16-ascenso archivado ` +
        `(dead-end fiel). Costuras CLASE #47 declaradas: fragata+posición en mar abierto (party pobre ` +
        `de 1 oro, no compra fielmente) + remolino adyacente (§4: vía natural PROBADA = 0 remolinos en ` +
        `400 turnos → seam, regla cap→seam del lead). El paso dispara el F-0: "WHIRLPOOL!" + reubicación ` +
        `a (34,18) con la nave preservada, SIN combate. SELLA en el Underworld en barco. Arco de shards ` +
        `(no llegables por nave desde (34,18): pozo 432 tiles, shards landlocked) → backlog multi-modal ` +
        `(brief §8). HORA 10:00, encadenado sobre ch13.gam.`,
    );
    cov.write();
  });

  test("el ch16.gam es un save NATIVO que el port re-importa a idéntico estado (Underworld, en barco)", async ({ page }) => {
    await bootWorld(page);
    const { gam, sidecar } = readCheckpointFiles("ch16");
    await page.evaluate(
      ([bytes, side]) => {
        const t = (window as unknown as { __u5test: { loadNativeSave: (b: number[], s?: unknown) => void } }).__u5test;
        t.loadNativeSave(bytes as number[], side);
      },
      [Array.from(gam), sidecar] as [number[], unknown],
    );
    expect(await getPos(page), "re-importa al Underworld (34,18)").toMatchObject({ location: 0, floor: 0xff, x: LANDING.x, y: LANDING.y });
    expect(await page.evaluate(() => (window as unknown as { __u5test: { state: () => { transport: string } } }).__u5test.state().transport), "en barco en el Underworld").toBe("ship");
  });

  test("determinismo ×2: dos sellos frescos byte-idénticos", async ({ page }) => {
    await bootWorld(page);
    const a = await playAndSeal(page);
    const b = await playAndSeal(page);
    expect(Buffer.compare(Buffer.from(a.gam), Buffer.from(b.gam)), "los dos .gam son byte-idénticos").toBe(0);
  });
});
