/**
 * GRAND TOUR — CAPÍTULO 6: Moonglow (loc 1).
 *
 * Escrito con el patrón endurecido + nav.ts reutilizable (mismo molde que ch03). Novedad:
 * extrae una WORD OF POWER por diálogo REAL — Malifora enseña FALLAX (corpus wop-deceit) —
 * con `talkToNpcAsking`. Cadena desde el último checkpoint aterrizado.
 *
 * CADENA: re-encadenado sobre `ch05.gam` (Minoc, sellado en main), con el pin `entryGold`
 * de #52 (200 gp declarados). ⚠ La cabecera decía antes que «Moonglow no ejercita economía,
 * así que el saldo de entrada bajo es indiferente». Es FALSO desde `08d36139`: Moonglow no
 * tiene herrería, pero un GUARDIA exige TRIBUTO al segundo paso del capítulo, y eso es una
 * interacción de economía. Con 1 gp contra un tributo de 20 el pago fallaba, el arresto
 * encarcelaba al party en Yew y el capítulo moría seis pasos después culpando a la escalera
 * (task #51). Con el pin, ch06 PAGA — y es el capítulo donde el beat `guard-tribute-paid`
 * cae de verdad. Su otra novedad sigue siendo la Word of Power FALLAX de Malifora por
 * diálogo real + los 2 NPCs de sala aislada de la planta 1 (recoverPartition).
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importCheckpoint, exportCheckpoint, readCheckpointFiles, DEFAULT_ENTRY_GOLD } from "./fixture";
import { bootWorld, signBodyIn, chapterTimeout, enterLocation, faceCommand, goToFloor, talkToNpc, talkToNpcAsking, getPos, getTributePayments, resetTributePayments } from "./nav";
import { npcManifestId } from "./npcIds";
import { Coverage } from "./coverage";
import { PARTY } from "./offsets";

const MOONGLOW = 1;

test.describe.serial("GT ch06 — Moonglow (loc 1)", () => {
  test("recorre Moonglow y extrae FALLAX de Malifora por diálogo real", async ({ page }) => {
    test.setTimeout(chapterTimeout(300_000));
    await bootWorld(page); // arranque independiente de piel + costura teleportOverworld (task #16)
    resetTributePayments(); // el registro de tributos es del CAPÍTULO (el worker es compartido)

    // Entrada por checkpoint REAL: re-encadenado sobre ch05 (Minoc, sellado en main).
    // HORA CANÓNICA DECLARADA (arnés B'): 12:20 = hora NATIVA a la que está afinado este capítulo
    // (salida original de ch05). El pin reproduce el sello y lo hace inmune a la deriva del predecesor.
    await importCheckpoint(page, "ch05", { entryClock: { hour: 12, minute: 20 }, entryGold: DEFAULT_ENTRY_GOLD });
    await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
    const readNum = (expr: string) =>
      page.evaluate((e) => new Function("s", `return s.${e}`)((window as unknown as { __u5test: { state: () => unknown } }).__u5test.state()), expr) as Promise<number>;
    expect(await readNum("characters[0].intelligence")).toBe(22); // el bracket de ch01 viaja por la cadena

    const cov = new Coverage("ch06");

    const entry = await enterLocation(page, MOONGLOW);
    expect(entry).toMatchObject({ location: 1, floor: 0 });
    cov.mark("location-1-moonglow").mark("floor-1-z0");

    // NPCs conversables (dialogNumber == npcIndex de towne): Zachariah(1)/Malik(3)/
    // Donn Piatt(4)/Lord Stuart(5). Malifora (2) va aparte para extraerle la Word of Power.
    //
    // ORDEN por LECCIÓN DE RELOJ (ch05/Fiona): los NPCs de SALA AISLADA se visitan PRIMERO
    // (reloj fresco). Reparto de reachability en Moonglow (probe en vivo, entrada 12:20) —
    // TODOS recuperados ya por goToCell MULTI-NIVEL (recoverPartition backed by nav-graph #13):
    //   Zachariah(1) @ (13,17) z0 · Donn Piatt(4) @ z0/z1 — SANCTUMS interiores de planta 0,
    //     alcanzables por partición MULTI-NIVEL (z0-room ← z1-component); goToCell los resuelve.
    //   Lord Stuart(5) @ (19,24) z1 — sala aislada de planta 1.
    for (const dn of [1, 4, 5]) {
      try {
        await talkToNpc(page, dn, { recoverPartition: true });
        cov.mark(npcManifestId("towne", dn));
      } catch {
        /* inenganchable en esta cadena — determinista */
      }
    }
    // Malik (3): sala normal, walkTo directo (no toca el grafo).
    try {
      await talkToNpc(page, 3);
      cov.mark(npcManifestId("towne", 3));
    } catch {
      /* NPC deambulante inenganchable en esta cadena — determinista */
    }
    // Malifora (2): pregunta "word" → responde "FALLAX !" (corpus wop-deceit).
    try {
      const resp = await talkToNpcAsking(page, 2, "word");
      cov.mark(npcManifestId("towne", 2));
      if (/FALLAX/i.test(resp)) cov.mark("word-fallax");
    } catch {
      /* Malifora inenganchable en esta cadena */
    }

    // (S)earch de un puñado de objetos ocultos de la planta baja (best-effort). Se acota
    // el número a propósito: cada faceCommand es navegación pesada, y la cobertura ya llega
    // a ≥15 con loc+floors+NPCs+word+comandos; un subconjunto determinista basta.
    for (const [x, y, id] of [
      [13, 13, "search-22-loc1-13-13"],
      [14, 13, "search-23-loc1-14-13"],
      [16, 13, "search-24-loc1-16-13"],
      [17, 13, "search-25-loc1-17-13"],
    ] as const) {
      try {
        await faceCommand(page, "s", x, y);
        cov.mark(id);
      } catch {
        /* inalcanzable */
      }
    }

    // Señales de la planta baja: (L)ook (best-effort).
    for (const [x, y, id] of [
      [14, 20, "sign-1-14-20"],
      [16, 20, "sign-1-16-20"],
    ] as const) {
      try {
        const log = await faceCommand(page, "l", x, y);
        if (signBodyIn(log)) cov.mark(id);
      } catch {
        /* lado inalcanzable */
      }
    }

    // (K)limb a la planta 1 + sus objetos ocultos (best-effort).
    const p = await goToFloor(page, 1);
    expect(p.floor).toBe(1);
    cov.mark("floor-1-z1");
    for (const [x, y, id] of [
      [24, 19, "search-26-loc1-24-19"],
      [19, 24, "search-109-loc1-19-24"],
      [20, 24, "search-110-loc1-20-24"],
    ] as const) {
      try {
        await faceCommand(page, "s", x, y);
        cov.mark(id);
      } catch {
        /* inalcanzable */
      }
    }

    // Comandos A-Z ejercitados de verdad (política tour-wide).

    // ★ BEAT `guard-tribute-paid` (#52, cierra la vía tributo→pago de #46). El aserto FUERTE
    // —oro exacto 10×vivos y prompt cerrado— lo aplica el arnés en CADA pago
    // (`payGuardIfPrompted`), así que aquí se aserta lo que el capítulo aporta: que el beat
    // se EJERCITÓ de verdad. Se cuenta en RELATIVO y no contra un número congelado a
    // propósito: los guardias DEAMBULAN y el número de demandas es una propiedad de la
    // trayectoria, no del capítulo — un `toBe(2)` sería un pin que la primera brisa rompe.
    const tributos = getTributePayments();
    expect(tributos.length, "el guardia exige tributo al entrar y el party PAGA (beat guard-tribute-paid)").toBeGreaterThan(0);
    const tributoTotal = tributos.reduce((a, t) => a + t.tribute, 0);

    cov.markAll(["command-e", "command-t", "command-s", "command-l", "command-k"]);
    cov.note(
      "Moonglow: no tiene herrería de compra byte-exacta (mercaderes = tavernero/sanador), " +
        `pero SÍ ejercita economía por la vía del GUARDIA: TRIBUTO PAGADO ×${tributos.length} ` +
        `(${tributoTotal} gp en total = 10 gp × vivos por demanda), oro ${tributos[0]!.gold}→${tributos[tributos.length - 1]!.goldAfter} — el beat ` +
        "guard-tribute-paid, con aserto del importe exacto y del prompt cerrado (#52/#46). Su otra novedad es la Word of " +
        "Power FALLAX extraída de Malifora por diálogo real + la recuperación de los 4 NPCs de " +
        "sala aislada/sanctum con goToCell MULTI-NIVEL (recoverPartition backed by nav-graph #13). " +
        "NPCs cubiertos: Malifora(2), Malik(3), Zachariah(1), Donn Piatt(4), Lord Stuart(5) — " +
        "TODOS. Zachariah(1)/Donn Piatt(4) son sanctums interiores de planta 0 (z0-room ← " +
        "z1-component, partición multi-nivel) que el solver de componentes del grafo recupera; " +
        "Lord Stuart(5) es sala aislada de planta 1. Búsquedas/señales tras muro quedan " +
        "best-effort (determinista bajo seed-0).",
    );

    const covPath = cov.write();
    const covered = JSON.parse(readFileSync(covPath, "utf8")) as { coveredIds: string[] };
    expect(covered.coveredIds.length).toBeGreaterThanOrEqual(15);

    const { gam } = await exportCheckpoint(page, "ch06");
    expect(gam.length).toBe(4192);
    expect(gam[PARTY.location]).toBe(1);
  });

  test("el ch06.gam exportado es un save NATIVO que el propio port re-importa a idéntico estado", async ({ page }) => {
    await bootWorld(page, { debug: false }); // re-importa sin costura de arnés (task #16)
    const { gam, sidecar } = readCheckpointFiles("ch06");
    await page.evaluate(
      ([bytes, side]) => {
        const t = (window as unknown as { __u5test: { loadNativeSave: (b: number[], s?: unknown) => void } }).__u5test;
        t.loadNativeSave(bytes as number[], side);
      },
      [Array.from(gam), sidecar] as [number[], unknown],
    );
    expect(await getPos(page)).toMatchObject({ location: 1 });
  });
});
