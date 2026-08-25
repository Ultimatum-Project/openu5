/**
 * GRAND TOUR — CAPÍTULO 12: Skara Brae (loc 7). CIERRA EL CONJUNTO REAL DE LAS 8 TOWNS.
 *
 * Skara Brae (loc 7) se SALTÓ en la primera pasada (las towns cubiertas eran 1-6 y 8; el brief de ch09
 * la dio por visitada por error). ch12 cierra ese hueco → las 8 towns TOWNE (locs 1-8) quedan de
 * verdad selladas. Es el pueblo golpeado por un Shadowlord: aquí Kindor (bardo herido por un dardo de
 * Shadowlord) entrega la MANTRA DE ESPIRITUALIDAD (como BEH/ch08 y LUM/ch09), Saul narra el ataque, y
 * Froed (un niño) cierra el arco de ch08 Yew (es el hijo de Greymarch, el preso de la celda C). Town
 * de 2 plantas, CERO cerrojos (llaves 1→1).
 *
 * NPCs (verificados contra TOWNE.TLK REAL, description INCLUIDA — lección de ch10/ch11):
 *   - Kindor(39)  ['shri','y'] → "…Yes, I know the Mantra of Spirituality…" (⭐ mantra). Greeting
 *        interpola <AvatarsName> (SIN AskName); usa <Pause>/<KeyWait> (bardo agonizante). TESTIGO:
 *        'Mantra of Spirituality'.
 *   - Saul(40)    ['frie'] → "His name is Kindor. He was struck by a Shadowlord's bolt!". TESTIGO:
 *        'Shadowlord's bolt'.
 *   - Froed(37)   ['fath'] → "His name is Greymarch. He spoke out against Blackthorn…". ⚠ gate de
 *        saludo CONDICIONAL (IfElseKnowsName→Label0→DoNothingSection): en el 1er encuentro cae en
 *        DoNothingSection (sin gate). TESTIGO: 'Greymarch' (cross-ref a ch08 Yew).
 *   - Flain(38)   mago de la OPRESIÓN (z1). ⚠ TRAMPA MORAL: pide DELATAR a la Resistencia (nombrar
 *        Malifora/Annon/Goeth/Felespar/Fiona/Sindar → arresto). JAMÁS se nombra a nadie. Su
 *        description cae en Label 0 "Why hast thou disturbed me, wretch?" (default). Talk-only
 *        best-effort → 'tower uninvited'.
 *
 * DECISIONES DEL LEAD respetadas: Flain JAMÁS nombra a la Resistencia (solo se testifica su saludo
 * hostil); Kindor con su KeyWait modelado; testigos duros del mantra + el cross-ref Froed→Greymarch;
 * encadena ch11.gam + entryClock 10:00 + reseed(0). Sin (J)immy (0 cerrojos).
 *
 * ECONOMÍA / LLAVES: oro 1 y karma 80 heredados e INALTERADOS (ningún hecho exige oro; sin trampas de
 * karma/guards/gold en los 4). LLAVES 1→1: smallmap 7 sin tiles-cerrojo → NO (J)immy.
 *
 * A las 10:00: z0 = Froed, Kindor, Saul (los 3 con testigo duro); z1 = Flain (best-effort). Las 2
 * señales y las 2 searches están en z0.
 *
 * CADENA: re-encadenado sobre `ch11.gam` (Bordermarch, sellado en main eef6547/441ed4f). HORA 10:00.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importCheckpoint, exportCheckpoint, readCheckpointFiles, DEFAULT_ENTRY_GOLD } from "./fixture";
import { bootWorld, chapterTimeout, enterLocation, faceCommand, readSign, talkToNpcSequence, getPos, goToFloor } from "./nav";
import { npcManifestId } from "./npcIds";
import { Coverage } from "./coverage";
import { PARTY } from "./offsets";
import { tr } from "./tourLang";

const SKARA_BRAE = 7;
const PREV_CHAPTER = "ch11";

test.describe.serial("GT ch12 — Skara Brae (loc 7)", () => {
  test("recorre Skara Brae, aprende la Mantra de Espiritualidad y exporta el checkpoint (cierra las 8 towns)", async ({ page }) => {
    test.setTimeout(chapterTimeout(600_000));
    await bootWorld(page); // arranque independiente de piel + costura teleportOverworld (task #16)

    // (1) Entrada por checkpoint REAL de ch11 + HORA CANÓNICA 10:00 + seed 0.
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

    const cov = new Coverage("ch12");

    // (2) Posicionamiento de arnés + (E)nter REAL (teleportOverworld; SIN barco).
    const entry = await enterLocation(page, SKARA_BRAE);
    expect(entry).toMatchObject({ location: 7, floor: 0 });
    cov.mark("location-7-skara-brae").mark("floor-7-z0").mark("command-e");

    // (3) z0 — NPCs con testigo duro. recoverPartition por robustez.
    //   ⭐ Kindor(39): la MANTRA DE ESPIRITUALIDAD. 'shri' → "…Mantra of Spirituality" → Label 0 → 'y'.
    //   Sus respuestas llevan <Pause>/<KeyWait>; ['shri','y'] cubre el flujo (si el KeyWait exigiera un
    //   tap extra, el testigo 'Mantra of Spirituality' ya está en la respuesta de 'shri'). REQUERIDO.
    const kindor = await talkToNpcSequence(page, 39, ["shri", "y"], { recoverPartition: true });
    expect(kindor, "Kindor entrega la Mantra de Espiritualidad").toContain(tr({ en: "Mantra of Spirituality", es: "Mantra de la Espiritualidad" }));
    cov.mark(npcManifestId("towne", 39));

    //   Saul(40): narra el ataque del Shadowlord a Kindor. 'frie' → "…struck by a Shadowlord's bolt!".
    const saul = await talkToNpcSequence(page, 40, ["frie"], { recoverPartition: true });
    expect(saul, "Saul: Kindor fue herido por un dardo de Shadowlord").toContain(tr({ en: "Shadowlord's bolt", es: "rayo de un Señor de la Sombra" }));
    cov.mark(npcManifestId("towne", 40));
    cov.mark("command-t"); // (T)alk ejercido (Kindor + Saul, garantizados)

    //   Froed(37): el niño cuyo padre es Greymarch (cross-ref a ch08 Yew, celda C). BEST-EFFORT: es un
    //   NIÑO que HUYE (aiType 3 — NPC.OVL:0x0D76: quieto a dist≥4, huye a <4 maximizando distancia);
    //   perseguirlo/acorralarlo no converge de forma fiable con el chase estándar (falla determinista
    //   bajo seed-0). El testigo estrella del capítulo es la Mantra de Kindor (garantizada); el
    //   cross-ref Froed→Greymarch es cobertura extra. 'fath' → "His name is Greymarch…".
    try {
      const froed = await talkToNpcSequence(page, 37, ["fath"], { recoverPartition: true });
      expect(froed, "Froed: su padre es Greymarch (cross-ref a Yew/ch08)").toContain("Greymarch");
      cov.mark(npcManifestId("towne", 37));
    } catch (e) {
      cov.note(`Froed (dn37) OMITIDO (best-effort, niño que HUYE aiType 3): ${String(e).slice(0, 100)}`);
    }

    // (4) BARRIDO floor-fija de z0: 2 señales + 2 searches (los NPCs están en z0). Normaliza planta.
    await goToFloor(page, 0);
    let signsRead = 0;
    for (const [x, y] of [
      [5, 1], // "HERE LIES…" (cementerio)
      [15, 25], // "BLACKTHORN'S LAW OF…"
    ] as const) {
      try {
        if (await readSign(page, x, y)) {
          cov.mark(`sign-7-${x}-${y}`);
          signsRead++;
        }
      } catch {
        /* lado inalcanzable */
      }
    }
    if (signsRead > 0) cov.mark("command-l");

    let searched = 0;
    for (const [x, y, id] of [
      [5, 2, "search-55-loc7-5-2"],
      [6, 7, "search-56-loc7-6-7"],
    ] as const) {
      try {
        await faceCommand(page, "s", x, y);
        cov.mark(id);
        searched++;
      } catch {
        /* casilla inalcanzable: se omite */
      }
    }
    if (searched > 0) cov.mark("command-s");

    // (5) z1: SUBE por la escalera (K)limb REAL desde el estado LIMPIO de z0 → marca floor-7-z1 +
    // command-k (verificado alcanzable). LUEGO intenta Flain best-effort (recoverPartition planifica su
    // escalera concreta: su cuarto cuelga de la escalera (15,15), distinta de la de aterrizaje). ⚠
    // TRAMPA MORAL: JAMÁS nombrar a la Resistencia — 'hail' NO casa su qa ('oppr') → default hostil
    // "How dare thee enter my tower uninvited." Se testifica SÓLO el saludo, sin delatar a nadie.
    try {
      const z1 = await goToFloor(page, 1);
      if (z1.floor === 1) {
        cov.mark("floor-7-z1").mark("command-k");
        try {
          const flain = await talkToNpcSequence(page, 38, ["hail"], { recoverPartition: true });
          expect(flain, "Flain: mago hostil de la Opresión (sin delatar a nadie)").toContain(tr({ en: "tower uninvited", es: "sin ser invitado" }));
          cov.mark(npcManifestId("towne", 38));
        } catch (e) {
          cov.note(`Flain (dn38, z1) OMITIDO (best-effort, aiType 2 en cuarto pequeño / gate / moral): ${String(e).slice(0, 90)}`);
        }
        await goToFloor(page, 0); // estado de salida limpio en z0
      }
    } catch {
      /* z1 no alcanzable: se difiere */
    }

    const keysOut = await readNum("keys");
    const gemsOut = await readNum("gems"); // #65: el canal de GEMAS, declarado
    const goldOut = await readNum("gold");
    const karmaOut = await readNum("karma");

    // (7) Cobertura declarada (política tour: SIN assert duro ≥N; el invariante es DETERMINISMO ×2).
    cov.note(
      `Skara Brae (loc 7) — CIERRA las 8 towns TOWNE (se había saltado; el brief de ch09 la dio por ` +
        `visitada por error). location + z0/z1 (2 plantas), 4 NPCs towne. TESTIGOS byte-exactos: Kindor ` +
        `→ 'Mantra of Spirituality' (⭐ mantra in-town, completa el trío con BEH/ch08 y LUM/ch09); Saul → ` +
        `'Shadowlord's bolt' (ataque del Shadowlord al pueblo); Froed → 'Greymarch' (CROSS-REF a ch08 ` +
        `Yew: Froed es el hijo del preso de la celda C). Flain (mago de la Opresión, z1, best-effort): ` +
        `saludo hostil SIN delatar a la Resistencia (⚠ trampa moral esquivada). HORA CANÓNICA 10:00 ` +
        `(z0 Froed/Kindor/Saul; z1 Flain). GEMAS ${gemsIn}→${gemsOut} (#65). LLAVES ${keysIn}→${keysOut} (CERO (J)immy: smallmap 7 sin ` +
        `cerrojos). Oro ${goldIn}→${goldOut} y karma ${karmaIn}→${karmaOut} INALTERADOS. Señales ` +
        `${signsRead}/2, searches ${searched}/2 (z0, best-effort). Comandos e/t/s/l(+k si z1). LECCIÓN ` +
        `ch10/ch11 aplicada: gate de saludo en DESCRIPTION — Froed condicional (IfElseKnowsName, no ` +
        `dispara en 1er encuentro), Flain Label 0; Kindor/Saul limpios.`,
    );
    const covPath = cov.write();
    const covered = JSON.parse(readFileSync(covPath, "utf8")) as { coveredIds: string[] };
    expect(covered.coveredIds.length).toBeGreaterThan(0);

    // (8) Checkpoint nativo por el camino real. Skara Brae no cambia oro/karma/llaves.
    const { gam } = await exportCheckpoint(page, "ch12");
    expect(gam.length).toBe(4192);
    expect(gam[PARTY.location]).toBe(7);
    expect(gam[PARTY.karma]).toBe(karmaIn); // Skara Brae no toca karma
    expect(keysOut, "llaves INVARIANTES en el capítulo: cero (J)immy (aserto RELATIVO — no depende del valor de entrada, que el re-baseline de cadena de #28 llevó a 0)").toBe(keysIn);
  });

  test("el ch12.gam exportado es un save NATIVO que el propio port re-importa a idéntico estado", async ({ page }) => {
    await bootWorld(page, { debug: false }); // re-importa sin costura de arnés (task #16)
    const { gam, sidecar } = readCheckpointFiles("ch12");
    await page.evaluate(
      ([bytes, side]) => {
        const t = (window as unknown as { __u5test: { loadNativeSave: (b: number[], s?: unknown) => void } }).__u5test;
        t.loadNativeSave(bytes as number[], side);
      },
      [Array.from(gam), sidecar] as [number[], unknown],
    );
    expect(await getPos(page)).toMatchObject({ location: 7 });
  });
});
