/**
 * GRAND TOUR — CAPÍTULO 3: Britain (loc 2).
 *
 * Segundo capítulo con el motor de navegación (nav.ts) y el PRIMERO que ejercita la
 * ECONOMÍA byte-exacta: una COMPRA real en la tienda cobra el precio derivado de la
 * INTELIGENCIA del Avatar (SHOPPES.OVL: compra = base + ⌊base·(100−3·INT)/100⌋) — el oro
 * baja EXACTAMENTE ese importe. Valida el patrón sobre un pueblo grande.
 *
 * Cadena: importa el checkpoint REAL de ch02 (Avatar en LB Castle, INT 22, 150 oro) →
 * posicionamiento de arnés → (E)nter REAL de Britain → recorrido por mecanismos reales
 * ((T)alk con 7 vecinos · compra de un Bow en la herrería · (S)earch · (L)ook · (K)limb a
 * la planta 1). Marca ≥15 ítems REALES del manifiesto. Exporta ch03.{gam,sidecar}.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importCheckpoint, exportCheckpoint, readCheckpointFiles } from "./fixture";
import { bootWorld, signBodyIn, chapterTimeout, enterLocation, faceCommand, goToFloor, talkToNpc, buyFromShop, getPos, type Pos } from "./nav";
import { npcManifestId } from "./npcIds";
import { Coverage } from "./coverage";
import { PARTY } from "./offsets";

const BRITAIN = 2;
const BLACKSMITH = 0x81; // Iolo's Bows (Gwenneth)
const BOW_BASE = 75;
// compra byte-exacta (core/shops/shops.ts) para la INT del Avatar de ch01 (all-A → 22).
const buyPrice = (base: number, int: number): number => base + Math.trunc((base * (100 - 3 * int)) / 100);

test.describe.serial("GT ch03 — Britain (loc 2)", () => {
  test("recorre Britain, compra byte-exacta en la herrería, y exporta el checkpoint", async ({ page }) => {
    test.setTimeout(chapterTimeout(180_000));
    await bootWorld(page); // arranque independiente de piel + costura teleportOverworld (task #16)

    // (1) Entrada por checkpoint REAL de ch02. HORA CANÓNICA DECLARADA (arnés B'): 16:24 = la hora
    //     NATIVA a la que está afinado este capítulo (compra-primero antes de que el herrero suba a
    //     z1 a las 17:00; ventana de Annon en comp0 16-18; Gwenno pasa a z1 comp6 ≥18:00). El reloj
    //     alimenta schedules y deambular, así que fijar la hora nativa reproduce el sello (cb6638a).
    await importCheckpoint(page, "ch02", { entryClock: { hour: 16, minute: 24 } });
    await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
    const readNum = (expr: string) =>
      page.evaluate((e) => new Function("s", `return s.${e}`)((window as unknown as { __u5test: { state: () => unknown } }).__u5test.state()), expr) as Promise<number>;
    const int = await readNum("characters[0].intelligence");
    expect(int).toBe(22); // el bracket all-A de ch01 viajó por la cadena

    const cov = new Coverage("ch03");

    // (2) Posicionamiento de arnés + (E)nter REAL.
    const entry = await enterLocation(page, BRITAIN);
    expect(entry).toMatchObject({ location: 2, floor: 0, x: 15, y: 30 });
    cov.mark("location-2-britain").mark("floor-2-z0");

    // (3) ECONOMÍA byte-exacta PRIMERO (LECCIÓN DE RELOJ): el herrero (dn 129) sube a z1 a las
    // 17:00 (schedule times[0]); con el ch02 re-encadenado la entrada cae a las 16:24, así que
    // se COMPRA ANTES de que los diálogos avancen el reloj y el herrero abandone la planta baja.
    // El oro de entrada (150) viene de la cadena, NO de los diálogos → se puede comprar primero.
    // Comprar un Bow en la herrería cobra buyPrice(75, 22)=100.
    const goldBefore = await readNum("gold");
    expect(goldBefore).toBe(150);
    const expectedBuy = buyPrice(BOW_BASE, int);
    expect(expectedBuy).toBe(100); // literal de la derivación (regresión del cálculo)
    await buyFromShop(page, BLACKSMITH, `Bow — ${expectedBuy} gp`);
    const goldAfter = await readNum("gold");
    expect(goldBefore - goldAfter).toBe(expectedBuy); // el oro baja EXACTAMENTE el precio
    expect(goldAfter).toBe(50);
    cov.mark("shop-0-iolo-s-bows");

    // (3b) Annon(12) TEMPRANO (EL RELOJ ES PRESUPUESTO DE CADENA): de 16 a 18 vaga por comp0 de
    // z1 — sala SIN puerta, alcanzable desde z0 por escala/escalera. Cazarla AQUÍ (~16:40, justo
    // tras la compra) por recoverPartition (goToCell a su celda VIVA en comp0) la engancha SIN
    // llave y SIN el trek a la sala cerrada comp1 que costaba ~6.7h de reloj (hostil a la cadena:
    // empujaba la entrada de ch04 a la madrugada). A las 19:00 se mudaría a comp1 (tras puerta con
    // llave), así que el orden TEMPRANO es la ventana. try/catch → B pura (se difiere) si no engancha.
    try {
      await talkToNpc(page, 12, { recoverPartition: true });
      cov.mark(npcManifestId("towne", 12));
    } catch {
      /* Annon inenganchable en comp0 esta cadena — determinista; se difiere honesto */
    }

    // (4) (T)alk con los vecinos de PLANTA BAJA (RUTA POR HORARIOS — lección de reloj): a la
    // entrada re-encadenada (16:24) sólo estos 5 están en z0 en su franja y son enganchables
    // ahí (Greyson·Justin·Eb·Terrance·Telila; dialogNumber == npcIndex towne). Gwenno(11) pasa a
    // z1 (comp6, sin llave) a las 18:00 → se recupera en (7); Annon(12) ya cazada en (3b).
    for (const dn of [6, 7, 8, 9, 10]) {
      try {
        await talkToNpc(page, dn);
        cov.mark(npcManifestId("towne", dn));
      } catch {
        /* NPC deambulante inenganchable en esta cadena — determinista; se cubre en otra pasada */
      }
    }

    // (5) (S)earch de objetos ocultos de la planta baja. Algunas casillas quedan tras
    // muro/puerta con llave (inalcanzables sin la llave) → se marcan SÓLO las que se
    // alcanzan de verdad (determinista bajo seed-0: el mismo subconjunto en cada corrida).
    for (const [x, y, id] of [
      [2, 1, "search-29-loc2-2-1"],
      [6, 26, "search-30-loc2-6-26"],
    ] as const) {
      try {
        await faceCommand(page, "s", x, y);
        cov.mark(id);
      } catch {
        /* casilla inalcanzable en esta cadena — se recupera en un capítulo con la llave */
      }
    }

    // (6) Señales de la planta baja: (L)ook. Marca las que se leen (plaqueta en muro
    // legible sólo por el lado abierto y alcanzable).
    for (const [x, y, id] of [
      [11, 0, "sign-2-11-0"],
      [16, 27, "sign-2-16-27"],
      [14, 27, "sign-2-14-27"],
    ] as const) {
      try {
        const log = await faceCommand(page, "l", x, y);
        if (signBodyIn(log)) cov.mark(id);
      } catch {
        /* lado inalcanzable */
      }
    }

    // (7) PLANTA 1 (z1) — PARTICIONADA en salas aisladas, cada una servida por SU escalera. La
    // subida garantizada (nearest ladder) marca floor-2-z1; la recuperación de los vecinos y el
    // objeto oculto de las salas aisladas usa el motor COMPONENT-AWARE (goToCell/recoverPartition,
    // nav-graph #13), que targetea la posición VIVA del NPC (robusto al reloj corrido).
    const p: Pos = await goToFloor(page, 1);
    expect(p.floor).toBe(1);
    cov.mark("floor-2-z1");

    // (7a) Gwenno(11): desde 18:00 está ESTÁTICA en (5,21,z1) — sala servida por la escala (1,26),
    // SIN llave. recoverPartition la alcanza cruzando al componente correcto.
    try {
      await talkToNpc(page, 11, { recoverPartition: true });
      cov.mark(npcManifestId("towne", 11));
    } catch {
      /* inalcanzable en esta cadena — determinista */
    }

    // (7b) search-31 (Box en 24,6, comp1) se DIFIERE HONESTO: su celda está tras LockedDoor (25,3)
    // + el trek de recuperación costaba ~6.7h de reloj — HOSTIL A LA CADENA (empuja a ch04 a la
    // madrugada → NPCs dormidos en salas particionadas en TODOS los capítulos siguientes). El
    // reloj es presupuesto de cadena: no vale 1 id gastar 6.7h + 1 llave (ch07/Goeth la necesita).
    // Recuperable si algún día un capítulo PERNOCTA en Britain con llave a mano.

    // (7c) COMANDOS A-Z REALMENTE ejecutados en el recorrido (jump-table 0x3178): el
    // capítulo pulsa de verdad (E)nter, (T)alk, (S)earch, (L)ook, (K)limb — cada uno es
    // un ítem `command-*` del manifiesto que se EJERCITA jugando, no fabricado. (Política
    // tour-wide del pattern-owner; el cierre de ch19 los une, marcarlos por capítulo es
    // legítimo porque cada uno los ejecuta de veras.)
    cov.markAll(["command-e", "command-t", "command-s", "command-l", "command-k"]);

    // (8) Cobertura: ≥15 ítems reales, sin tocar la guarda. RUTA POR HORARIOS + PRESUPUESTO DE
    // RELOJ (entrada 16:24 re-encadenada): compra al herrero PRIMERO, Annon(12) TEMPRANO por
    // comp0 (sin llave, ventana 16-18), vecinos z0 (6-10) en su franja, Gwenno(11) por comp6 al
    // final (sin llave). Todo bajo seed-0 → subconjunto determinista. SALE con 2 llaves (sin
    // jimmy) y en hora vespertina → la cadena ch04-06 re-encadena cerca de su hora sellada.
    cov.note(
      "Britain: buy-first (reloj 16:24), Annon(12) temprano en comp0 (z1 sin puerta, recoverPartition), " +
        "z0 towne (6-10) en su franja, Gwenno(11) en comp6 (sin llave, recoverPartition), " +
        "search(2,1)/(6,26) y señales (16,27)/(14,27) en z0. search-31 (Box 24,6, comp1 tras " +
        "LockedDoor 25,3) DIFERIDO: el trek costaba ~6.7h de reloj + 1 llave — hostil a la cadena " +
        "(entrada nocturna aguas abajo); el reloj es presupuesto de cadena (oro/karma/llaves/RELOJ).",
    );
    const covPath = cov.write();
    const covered = JSON.parse(readFileSync(covPath, "utf8")) as { coveredIds: string[] };
    expect(covered.coveredIds.length).toBeGreaterThanOrEqual(15);

    // (9) Checkpoint nativo por el camino real. Refleja Britain + el oro gastado.
    const { gam } = await exportCheckpoint(page, "ch03");
    expect(gam.length).toBe(4192);
    expect(gam[PARTY.location]).toBe(2);
  });

  test("el ch03.gam exportado es un save NATIVO que el propio port re-importa a idéntico estado", async ({ page }) => {
    await bootWorld(page, { debug: false }); // re-importa sin costura de arnés (task #16)

    const { gam, sidecar } = readCheckpointFiles("ch03");
    await page.evaluate(
      ([bytes, side]) => {
        const t = (window as unknown as { __u5test: { loadNativeSave: (b: number[], s?: unknown) => void } }).__u5test;
        t.loadNativeSave(bytes as number[], side);
      },
      [Array.from(gam), sidecar] as [number[], unknown],
    );
    expect(await getPos(page)).toMatchObject({ location: 2 });
    expect(await page.evaluate(() => (window as unknown as { __u5test: { state: () => { gold: number } } }).__u5test.state().gold)).toBe(50);
  });
});
