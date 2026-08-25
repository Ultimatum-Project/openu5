/**
 * GRAND TOUR — CAPÍTULO 2: Lord British's Castle (loc 17).
 *
 * PRIMER capítulo escrito con el patrón endurecido (F3-T3) y el motor de navegación
 * reutilizable (`nav.ts`). Valida el patrón end-to-end:
 *   1. ENTRADA por checkpoint: importa el `SAVED.GAM` + sidecar REALES de ch01
 *      (`importCheckpoint`) → hereda el roster/karma/trama del Avatar creado por la gitana.
 *   2. POSICIONAMIENTO de arnés (declarado): la costura cero-rand sancionada
 *      (`__u5debug.teleportOverworld`, escritura directa) lleva la party al tile del
 *      castillo en el overworld — es fast-travel de arnés, NO gameplay (modelo (C),
 *      aprobado por el lead). TODO lo demás pasa por mecanismos REALES.
 *   3. JUEGO real y determinista (seed 0): (E)nter auténtico, (T)alk con los NPC,
 *      (S)earch de los dressers, (L)ook de una señal, (K)limb entre plantas — todo por
 *      el motor del binario. Los NPC de interior DEAMBULAN; el nav re-rutea (determinista).
 *   4. CHECKPOINT: exporta `saves/ch02.{gam,sidecar.json}` por el botón real "Export .GAM"
 *      (#27) — byte-determinista, la ENTRADA de ch03 y del espejo por estado.
 *   5. COBERTURA: marca 15 ítems del manifiesto REALES (con la guarda anti-fabricación).
 *
 * La travesía overworld Iolo's Hut → castillo (spawns/encuentros/camping/naval/moongates)
 * NO se cubre aquí: es materia de los CAPÍTULOS DE TRAVESÍA dedicados (ver README §travesía).
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importCheckpoint, exportCheckpoint, readCheckpointFiles } from "./fixture";
import { bootWorld, chapterTimeout, enterLocation, faceCommand, climbLadder, talkToNpc, getPos, readSign, type Pos } from "./nav";
import { npcManifestId } from "./npcIds";
import { Coverage } from "./coverage";
import { PARTY, charFieldOff } from "./offsets";

const CASTLE = 17;

test.describe.serial("GT ch02 — Lord British's Castle (loc 17)", () => {
  test("recorre el castillo por mecanismos reales y exporta el checkpoint", async ({ page }) => {
    test.setTimeout(chapterTimeout(180_000));
    await bootWorld(page); // arranque independiente de piel + costura teleportOverworld (task #16)

    // (1) Entrada por checkpoint REAL de ch01 (+ normaliza el stream a seed 0). HORA CANÓNICA
    //     DECLARADA (arnés B'): 8:35 = la hora NATIVA a la que se afinó este capítulo (salida de
    //     ch01). El reloj alimenta el deambular de los NPC del castillo (dn2 vaga a las 8-10h),
    //     así que fijar su hora nativa reproduce el enganche sellado; el default 10:00 lo rompería.
    await importCheckpoint(page, "ch01", { entryClock: { hour: 8, minute: 35 } });
    await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
    // El roster de ch01 viajó: el Avatar sigue siendo el bracket all-A.
    expect(await page.evaluate(() => (window as unknown as { __u5test: { state: () => any } }).__u5test.state().characters[0].strength)).toBe(20);

    const cov = new Coverage("ch02");

    // (2)+(3) Posicionamiento de arnés + (E)nter REAL.
    const entry = await enterLocation(page, CASTLE);
    expect(entry).toMatchObject({ location: 17, floor: 0, x: 15, y: 30 });
    cov.mark("location-17-lord-britishs-castle").mark("floor-17-z0");

    // NPCs conversables de la planta baja (dialogNumber == npcIndex del castle.json):
    // 1 Alistair the Bard · 2 Stephen · 3 Treanna · 9 Chuckles (el bufón de LB).
    for (const dn of [1, 2, 3, 9]) {
      await talkToNpc(page, dn);
      cov.mark(npcManifestId("castle", dn));
    }

    // Dressers registrables de la planta baja (data.json searchObjects floor 0).
    for (const [x, y, id] of [
      [20, 7, "search-68-loc17-20-7"],
      [21, 7, "search-69-loc17-21-7"],
      [22, 7, "search-70-loc17-22-7"],
      [23, 7, "search-71-loc17-23-7"],
    ] as const) {
      const log = await faceCommand(page, "s", x, y);
      expect(log.join(" "), `search (${x},${y}) debe hallar algo`).toContain("armour");
      cov.mark(id);
    }

    // Señal legible de la planta baja (YE KINGS · STABLE): (L)ook. Va por readSign y no por
    // el tail-4 de faceCommand: desde #198 (decode byte-exacto de SIGNS.DAT) el cuerpo ocupa
    // 9 líneas de consola CON filas de aire y las 4 últimas ya no contienen «YE KINGS»
    // (sonda 2026-08-20: tail-4 = ["", "WATCH THY STEP", "", ""] con el cartel BIEN impreso).
    expect(await readSign(page, 20, 24, "YE KINGS"), "cuerpo real del cartel (20,24)").toBe(true); // (la prosa «sign reads» era fabricada, purgada 2026-07-20)
    cov.mark("sign-17-20-24");

    // (K)limb: planta 1 (dresser + otro NPC de la corte), luego 2 — recorrido vertical
    // real. (La planta 3 y la -1 quedan tras puertas con llave: materia de un capítulo
    // posterior una vez conseguida la llave.)
    let p: Pos = await climbLadder(page, "up");
    expect(p.floor).toBe(1);
    cov.mark("floor-17-z1");
    const w = await faceCommand(page, "s", 21, 13);
    expect(w.join(" ")).toContain("weapon");
    cov.mark("search-72-loc17-21-13");
    // NPC de la planta 1 (dialog 4 = Margaret).
    await talkToNpc(page, 4);
    cov.mark(npcManifestId("castle", 4));

    p = await climbLadder(page, "up");
    expect(p.floor).toBe(2);
    cov.mark("floor-17-z2");

    // (5) Cobertura: ≥15 ítems reales del manifiesto, sin tocar la guarda.
    const covPath = cov.write();
    const covered = JSON.parse(readFileSync(covPath, "utf8")) as { coveredIds: string[] };
    expect(covered.coveredIds.length).toBeGreaterThanOrEqual(15);

    // (4) Checkpoint nativo por el camino real (botón "Export .GAM").
    const { gam } = await exportCheckpoint(page, "ch02");
    expect(gam.length).toBe(4192);
    // El checkpoint REFLEJA el estado tras el recorrido: dentro del castillo (loc 17),
    // y el Avatar conserva el bracket de ch01 (la cadena de estado es byte-real).
    expect(gam[PARTY.location]).toBe(17);
    expect(gam[charFieldOff(0, "strength")]).toBe(20);
  });

  test("el ch02.gam exportado es un save NATIVO que el propio port re-importa a idéntico estado", async ({ page }) => {
    await bootWorld(page, { debug: false }); // re-importa sin costura de arnés (task #16)

    const { gam, sidecar } = readCheckpointFiles("ch02");
    await page.evaluate(
      ([bytes, side]) => {
        const t = (window as unknown as { __u5test: { loadNativeSave: (b: number[], s?: unknown) => void } }).__u5test;
        t.loadNativeSave(bytes as number[], side);
      },
      [Array.from(gam), sidecar] as [number[], unknown],
    );

    expect(await getPos(page)).toMatchObject({ location: 17 });
    expect(await page.evaluate(() => (window as unknown as { __u5test: { state: () => any } }).__u5test.state().characters[0].strength)).toBe(20);
  });
});
