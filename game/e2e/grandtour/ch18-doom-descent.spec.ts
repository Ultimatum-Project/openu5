/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * GRAND TOUR — CAPÍTULO 18: EL DESCENSO JUGABLE DE DOOM (el hueco que ch17 bancó).
 *
 * ch17 abre el sello de Doom (VERAMOCOR), cruza la guarda y cubre el ENDGAME por costura
 * (#179: cadena de ABSORCIÓN en la celda cm127 — antes era checkDoomRescue en floor 7). El HUECO que dejó bancado (§PROBE de ch17) era el DESCENSO
 * EXTREMO-A-EXTREMO de las 8 plantas JUGANDO los combates de sala. Este capítulo lo cierra:
 * entra a Doom por la cima y BAJA las 8 plantas por la RUTA FÍSICA DERIVADA (60 pasos,
 * docs/guias/doom/gen-doom-ruta-v5.py), jugando las salas con el RESOLVEDOR RANGED, hasta el
 * umbral de la 8ª planta — y SE DETIENE justo antes del disparo del endgame (corte limpio:
 * el rescate es de ch17).
 *
 * TOPOLOGÍA DEL DESCENSO (verificada de maps/dungeons.json[loc40] + probes en vivo):
 *  · Des Por es INERTE en Doom (game.ts:5456, fiel) → el descenso es SÓLO físico: escaleras,
 *    fosos, y las ESCALERAS INTERIORES de dos salas. Por eso el planificador usa `noDespor`.
 * ⚠ NUMERACIÓN DE SALAS EN ESTE FICHERO — leer antes de cruzar veredictos con el censo
 *   (anotado 2026-07-25 tras la re-auditoría 0x6a14; ver re/notes/discriminadores-resello.md):
 *   los «#96 / #99 / #103» de abajo son el **campo `index`** de combatmaps.json, NO la posición
 *   del array, que es como los nombra el CENSO (`combatmap N = array pos N`, memoria
 *   combatmap-index-array-position). Equivalencias de ESTE capítulo:
 *
 *       #96  (index) = array 112 = Doom r0   (0 units — anomalía de dato, anotada)
 *       #99  (index) = array 115 = Doom r3   (9 units)
 *       #103 (index) = array 119 = Doom r7   (5 Dragon)
 *
 *   El riesgo NO es teórico: la posición 103 es **Hythloth r7**, que en el censo es la única
 *   VICTORY sin coartada de la re-auditoría del LOS de proyectil. Cruzar «#103» de aquí con
 *   «#103» del censo mezcla dos salas distintas — una limpia y una sospechosa.
 *   ch18 quedó CERRADO COMO LIMPIO en estático: Doom r7 da LOS 5/5 con la tabla del port Y con
 *   la del binario (0x6a14) desde las 4 entradas, y no contiene ningún 0x42 ni 0x46 ⇒ su
 *   victoria a arco es INDEPENDIENTE de la tabla.
 *
 *  · N1 (floor0): la party APARECE en la celda-sala (1,1) SIN combate (enterDungeon la COLOCA
 *    ahí, no PISA sobre ella; spawn ≠ step-onto → la sala #96 no dispara). DERIVACIÓN: MAINOUT
 *    `enter_dungeon` 0x0790 coloca la party (floor 0, (1,1)) SIN llamar a on_enter, y
 *    `dng_on_enter_cell` (DUNGEON 0x0C76) llama a dng_enter_room @0x0d40 al LLEGAR a la celda
 *    (0xF/0xA). Ojo con la formulación: NO es «al moverse» sino «al llegar» — `dng_pit_fall`
 *    (0x0A54) también dispara la sala al aterrizar de un foso sin haber andado.
 *  · N3 (floor2): NO tiene escalera ni foso de bajada — la ÚNICA vía abajo es la ESCALERA
 *    INTERIOR de la SALA #99. Descenso = klimb-escape (resolveRoomDescend): mover un miembro a
 *    la escalera del tablero y (K)limb. endgame gate game.ts:5610 `escaped = !victory && delta`
 *    → se DESCIENDE HUYENDO (imprime Klimb-Down!/Escape!/BATTLE IS LOST!/Leave!, fiel).
 *  · N4/N5 (floors3/4): LABERINTO que la ruta recorre subiendo/bajando por FOSOS (cell-doom-trap)
 *    y escaleras up/down (se visita floor3 tres veces).
 *  · N6 (floor5): la SALA #103 (5 Dragon) GATEA ambas escaleras-abajo (7,0)/(7,6). Es GANABLE
 *    con el resolvedor ranged (Ring of Invisibility = INMUNE a posesión, combat.ts:2384; Magic
 *    Bow out-DPSea antes de que el gating de daemons haga bola bajo seed 0) → se LIMPIA y se
 *    baja por la escalera de piso (7,0). Ninguna sala de Doom necesita bancarse por combate.
 *  · N7 (floor6): escalera doble (7,0). CORTE AQUÍ (sella en N7, no en el fondo). #179: pisar
 *    floor7 ya NO dispara nada — el desenlace exige cm127+absorción y lo juega ch19-endgame.
 *
 * COSTURA DE ARNÉS (CLASE #47, DECLARADA — igual que el kit de endgame de ch17): la party del
 * tour llega a Doom débil (ch17.gam: Avatar L2, Shamino MUERTO, sin arco). Un descenso real de
 * Doom se hace con el LOADOUT del cluebook — se SIEMBRA: 3 miembros vivos L8/240HP/stats30 con
 * Magic Bow (0x24, alcance 15) + Ring of Invisibility (0x2A) + 99 flechas + Glass Swords, y luz
 * (In Lor/antorchas) para el (S)earch de la puerta secreta de N3. Valores fijos → determinismo ×2.
 *
 * SELLO: el .GAM nativo NO representa la posición 3D de mazmorra (saveNative sólo guarda
 * `dungeonRoomsCleared`), así que este capítulo NO exporta un chNN.gam de "dentro de Doom" (ch17
 * ya posee el .gam del umbral). El determinismo ×2 se sella como un DIGEST DETERMINISTA del
 * descenso (secuencia de posiciones por paso + resultados de sala + HP final + salas despejadas);
 * dos descensos frescos deben producir un digest BYTE-IDÉNTICO.
 *
 * ★ EXTRACCIÓN (ch19-endgame): la RUTA, el loadout y el driver del descenso viven ahora en
 * `doom-descent.ts` (módulo compartido, extracción PURA byte-idéntica) para que ch19 pueda
 * reproducir el descenso sin importar este .spec (importarlo registraría estos tests dentro
 * del runner de ch19). Los asserts y la cobertura de ESTE capítulo no se mueven.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, getPos } from "./nav";
import { Coverage } from "./coverage";
import { DOOM, DOOM_PREV_CHAPTER as PREV_CHAPTER, playDescent } from "./doom-descent";

const cov = new Coverage("ch18");

test.describe.serial("GT ch18 — DESCENSO JUGABLE DE DOOM (8 plantas, ruta de 60 pasos)", () => {
  test("baja las 8 plantas por la ruta derivada, juega las salas con el resolvedor ranged y llega a N7 sin disparar el endgame", async ({ page }) => {
    test.setTimeout(chapterTimeout(300_000));
    await bootWorld(page);

    // Premisa de cadena: arranca del umbral de Doom de ch17 (Underworld 128,128, sello abierto).
    await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
    expect(await getPos(page), "arranca en el umbral de Doom (ch17, Underworld)").toMatchObject({ location: 0, floor: 0xff, x: 128, y: 128 });

    const r = await playDescent(page);

    // Llegó a N7 (floor6, 7,0) — el umbral del fondo, a un paso del endgame.
    expect(r.finalPos, "descendió las 8 plantas hasta N7 (floor6, celda 7,0)").toMatchObject({ dungeon: DOOM, floor: 6, x: 7, y: 0 });
    // Jugó las dos salas del descenso con los resolvedores.
    expect(r.room99Descend, "sala #99 (N3): descendida por klimb-escape (escalera interior)").toBe(true);
    expect(r.room103Won, "sala #103 (N6, 5 Dragon): GANADA por el resolvedor ranged").toBe(true);
    // Cruzó fosos (cell-doom-trap) del laberinto N4/N5.
    expect(r.pitfalls, "el laberinto N4/N5 se recorre por FOSOS").toBeGreaterThanOrEqual(2);
    // CORTE POSICIONAL (no por manipular el save): la party ESTÁ sobre la escalera doble de N7
    // (7,0) con el kit de endgame ÍNTEGRO. (#179: pisar floor7 ya NO dispara nada — el desenlace
    // exige la celda cm127 + absorción; ch19-endgame lo JUEGA entero desde este mismo corte.)
    expect(r.finalCellType, "N7 (7,0) es la escalera doble hacia el fondo (dungeon cell type 3)").toBe(3);
    expect(r.endgameReady, "endgameReady INTACTO en el corte (3 SL muertos + 3 regalías): el corte es POSICIONAL, no por tocar el save").toBe(true);
    expect(r.gameWon, "CORTE LIMPIO: el endgame NO se dispara (se para EN N7, no se baja a floor7)").toBe(false);
    expect(r.partyHp.some((hp) => hp > 0), "la party sobrevive el descenso").toBe(true);

    cov.mark("dungeon-doom").mark("cell-doom-room").mark("cell-doom-trap");
    cov.mark("enemy-21-bats").mark("enemy-27-reapers").mark("enemy-39-dragons");
    cov.note(
      `DESCENSO JUGABLE de Doom (loc 40, 8 plantas) — cierra el §PROBE bancado de ch17. Ruta física ` +
        `DERIVADA de 60 pasos (docs/guias/doom/gen-doom-ruta-v5.py). Des Por INERTE en Doom (game.ts:5456) ` +
        `→ descenso SÓLO físico (planDungeonDescent noDespor). N1: spawn en la celda-sala (1,1) SIN combate ` +
        `(spawn ≠ step-onto). N3: única bajada = escalera INTERIOR de la sala #99 → klimb-escape ` +
        `(resolveRoomDescend; gate game.ts:5610 escaped=!victory&&delta → desciende HUYENDO). N4/N5: ` +
        `laberinto por FOSOS (cell-doom-trap) + escaleras up/down. N6: sala #103 (5 Dragon, gatesInDaemon) ` +
        `GANADA con el resolvedor ranged (Ring of Invisibility inmuniza posesión combat.ts:2384; Magic Bow ` +
        `alcance 15 out-DPSea el gating bajo seed 0) — ninguna sala se banca por combate. Corte LIMPIO en N7 ` +
        `(floor6, 7,0): el desenlace es de ch19-endgame (#179, absorcion en cm127; pisar floor7 no dispara nada). COSTURA #47: loadout ` +
        `del descenso sembrado (3×L8/240HP + Magic Bow/Ring/flechas/Glass Swords + luz; ch17.gam trae la party ` +
        `débil con Shamino muerto). El .GAM nativo NO representa la posición 3D de mazmorra (saveNative sólo ` +
        `dungeonRoomsCleared) → sin chNN.gam; el determinismo ×2 se sella como DIGEST del descenso.`,
    );
    const covPath = cov.write();
    const covered = JSON.parse(readFileSync(covPath, "utf8")) as { coveredIds: string[] };
    expect(covered.coveredIds).toEqual([
      "cell-doom-room",
      "cell-doom-trap",
      "dungeon-doom",
      "enemy-21-bats",
      "enemy-27-reapers",
      "enemy-39-dragons",
    ]);
  });

  test("determinismo ×2: dos descensos frescos producen un digest byte-idéntico", async ({ page }) => {
    test.setTimeout(chapterTimeout(300_000));
    await bootWorld(page);
    const a = await playDescent(page);
    const b = await playDescent(page);
    expect(a.finalPos, "descenso A → N7 (floor6, 7,0)").toMatchObject({ floor: 6, x: 7, y: 0 });
    expect(Buffer.compare(Buffer.from(a.digest), Buffer.from(b.digest)), "los dos digests del descenso son byte-idénticos").toBe(0);
  });
});
