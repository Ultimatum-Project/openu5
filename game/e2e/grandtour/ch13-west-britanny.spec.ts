/**
 * GRAND TOUR — CAPÍTULO 13: West Britanny (loc 19). El "yield king" restante antes del pivote a mazmorra.
 *
 * West Britanny (loc 19) es la location NO visitada de MAYOR cobertura: aldea de granjeros pegada al
 * castillo de Lord British (por eso los Shadowlords no la tocan). UNA sola planta (z0), CERO gates/
 * fleers/trampas — el checklist de 3 lecciones (ch10 AskName / ch11 cadena de Labels / ch12 aiType
 * hostil) sale LIMPIO. El valor es la DENSIDAD: 11 señales de cementerio + 6 searches + 3 NPCs.
 *
 * NPCs (verificados contra CASTLE.TLK REAL, description incluida — lección ch10/ch11; los 3 con
 * greeting benigno, sin AskName en la description → gate=none):
 *   - Camile(18)      ['shad'] → "Blackthorn sends the Shadowlords unto many townes, but we lie too
 *        close to Lord British's castle…". TESTIGO: 'Shadowlords' (lore de Shadowlords).
 *   - Phillip(19)     ['chri'] → "He works the fields with me." TESTIGO: 'works the fields'
 *        (granjero-artista; Christopher es su "mate").
 *   - Christopher(20) ['writ'] → "I'm currently working on an epic called 'Times of Lore!'". TESTIGO:
 *        'Times of Lore' (easter egg de Origin). ⚠ El buy-gate ("Wilt thou buy it?" Label 0) cuelga de
 *        'soon'/'publ', NO de 'writ' — y AUN ASÍ no lleva <Gold> (verificado). ['writ'] corta antes:
 *        cero riesgo económico.
 *
 * A las 10:00 los 3 deambulan (aiType 1) en GRANJA ABIERTA (sin pen ni celda) → approachAndTalk los
 * persigue como en cualquier town (bajo riesgo, a diferencia del corral de Yasuda/ch09 o el niño que
 * huye de Froed/ch12). Si uno derivara a una esquina inalcanzable: best-effort con nota (R1 del brief).
 *
 * SEÑALES (11) — cementerio de epitafios: reja de lápidas fila y1 (1/3/5/7/9,1) + fila y6 (1/3/5/7/9,6)
 * + la señal (13,6). readSign try/catch por lado inalcanzable, marca subconjunto determinista.
 *
 * SEARCHES (6 ids en 4 celdas; 2 celdas con OBJETO DOBLE): searchAt (world/search.ts) consume el PRIMER
 * objeto findable de la casilla y coloca su tile; una 2ª búsqueda de la MISMA casilla halla el siguiente.
 * Un hallazgo imprime el NOMBRE del objeto (lootOpenLine); vacío imprime "Nothing of note.". Así las
 * celdas dobles (3,2)=[#30,#10] y (5,7)=[#30,#4] se ejercitan con 2 (S)earch y se marca 1 id por hallazgo
 * REAL (subconjunto determinista, R2 del brief); (7,7) y (7,2) son simples.
 *
 * ECONOMÍA / LLAVES: oro 200 (pin `entryGold` de #52 — declarado, no ganado jugando), karma 80,
 * 1 llave, INT 22 heredados e INALTERADOS. La llave heredada es 1 y no 0: el sello de ch08 volvió a
 * traer su llave cuando el pin hizo que el tributo se PAGARA, porque el `keys 1→0` de antes era la
 * CONFISCACIÓN del arresto y no el (J)immy (refutado en `re/notes/auditoria-estatica-sellos.md` §3).
 * West Britanny no exige oro ni llaves (todo diálogo/señal/search gratis). UN cerrojo (185 en (6,27) z0) que gatea un cuarto
 * sur SIN contenido requerido (flood-fill: 768 casillas + 9/9 NPC + 11/11 señales + 4/4 celdas de search
 * alcanzables SIN cruzarlo) → NO se teclea (J)immy → LLAVES 1→1.
 *
 * CADENA: re-encadenado sobre `ch12.gam` (Skara Brae, sellado en main c95d571). HORA CANÓNICA 10:00.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importCheckpoint, exportCheckpoint, readCheckpointFiles, DEFAULT_ENTRY_GOLD } from "./fixture";
import { bootWorld, chapterTimeout, enterLocation, faceCommand, readSign, talkToNpcSequence, getPos, goToFloor } from "./nav";
import { npcManifestId } from "./npcIds";
import { Coverage } from "./coverage";
import { PARTY } from "./offsets";

const WEST_BRITANNY = 19;
const PREV_CHAPTER = "ch12";

test.describe.serial("GT ch13 — West Britanny (loc 19)", () => {
  test("recorre West Britanny (yield king: 3 NPCs + 11 señales + 6 searches) y exporta el checkpoint", async ({ page }) => {
    test.setTimeout(chapterTimeout(600_000));
    await bootWorld(page); // arranque independiente de piel + costura teleportOverworld (task #16)

    // (1) Entrada por checkpoint REAL de ch12 + HORA CANÓNICA 10:00 + seed 0.
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

    const cov = new Coverage("ch13");

    // (2) Posicionamiento de arnés + (E)nter REAL (teleportOverworld; SIN barco: tierra firme junto al
    //     castillo de Lord British).
    const entry = await enterLocation(page, WEST_BRITANNY);
    expect(entry).toMatchObject({ location: 19, floor: 0 });
    cov.mark("location-19-west-britanny").mark("floor-19-z0").mark("command-e");

    // (3) z0 — 3 NPCs granjeros con testigo duro. Deambulan (aiType 1) en granja abierta; recoverPartition
    //     por robustez. Los 3 tienen greeting benigno (Camile Label 0 saludo; Phillip/Christopher sin gate).
    let talked = 0;
    for (const [dn, seq, witness, label] of [
      [18, ["shad"], "Shadowlords", "Camile: lore de Shadowlords"],
      [19, ["chri"], "works the fields", "Phillip: granjero-artista, Christopher es su mate"],
      [20, ["writ"], "Times of Lore", "Christopher: 'Times of Lore' (easter egg de Origin) — SIN 'y' al buy-gate"],
    ] as const) {
      try {
        const out = await talkToNpcSequence(page, dn, [...seq], { recoverPartition: true });
        expect(out, label).toContain(witness);
        cov.mark(npcManifestId("castle", dn));
        talked++;
      } catch (e) {
        cov.note(`NPC dn${dn} OMITIDO (best-effort, wander aiType 1 en granja abierta): ${String(e).slice(0, 90)}`);
      }
    }
    if (talked > 0) cov.mark("command-t");

    // (4) SEÑALES (11) — cementerio. Normaliza planta z0 (los talks pudieron arrastrar). readSign try/catch
    //     por lado inalcanzable; marca subconjunto determinista.
    await goToFloor(page, 0);
    let signsRead = 0;
    for (const [x, y] of [
      [1, 1], [3, 1], [5, 1], [7, 1], [9, 1], // fila y1 (reja de lápidas)
      [1, 6], [3, 6], [5, 6], [7, 6], [9, 6], // fila y6
      [13, 6],                                 // señal suelta
    ] as const) {
      try {
        if (await readSign(page, x, y)) {
          cov.mark(`sign-19-${x}-${y}`);
          signsRead++;
        }
      } catch {
        /* lado inalcanzable */
      }
    }
    if (signsRead > 0) cov.mark("command-l");

    // (5) SEARCHES (6 ids en 4 celdas). Celdas dobles → 2 (S)earch; marca 1 id por hallazgo REAL (el
    //     console imprime el NOMBRE del objeto; "Nothing of note." = vacío). Subconjunto determinista.
    const NOTHING = /nothing of note/i;
    const searchCell = async (x: number, y: number, ids: readonly string[]): Promise<number> => {
      let found = 0;
      for (const id of ids) {
        try {
          const tail = (await faceCommand(page, "s", x, y)).join(" ");
          if (NOTHING.test(tail)) break; // celda agotada: no hay más objeto findable
          cov.mark(id);
          found++;
        } catch {
          break; // casilla inalcanzable: se omite el resto
        }
      }
      return found;
    };
    let searched = 0;
    searched += await searchCell(3, 2, ["search-81-loc19-3-2", "search-86-loc19-3-2"]); // doble #30,#10
    searched += await searchCell(5, 7, ["search-82-loc19-5-7", "search-85-loc19-5-7"]); // doble #30,#4
    searched += await searchCell(7, 7, ["search-83-loc19-7-7"]);                        // simple
    searched += await searchCell(7, 2, ["search-84-loc19-7-2"]);                        // simple
    if (searched > 0) cov.mark("command-s");

    const keysOut = await readNum("keys");
    const gemsOut = await readNum("gems"); // #65: el canal de GEMAS, declarado
    const goldOut = await readNum("gold");
    const karmaOut = await readNum("karma");

    // (6) Cobertura declarada (política tour: SIN assert duro ≥N; el invariante es DETERMINISMO ×2).
    cov.note(
      `West Britanny (loc 19) — el "yield king" restante: aldea de granjeros junto al castillo de Lord ` +
        `British (los Shadowlords no la tocan). ` +
        `GEMAS ${gemsIn}→${gemsOut} · LLAVES ${keysIn}→${keysOut} (#65: declaración viva de ambos canales). ` +
        `1 planta (z0), CERO gates/fleers/trampas (checklist de 3 ` +
        `lecciones LIMPIO). TESTIGOS byte-exactos: Camile → 'Shadowlords' (lore); Phillip → 'works the ` +
        `fields' (granjero-artista); Christopher → 'Times of Lore' (easter egg de Origin; ['writ'] corta ` +
        `ANTES del buy-gate, sin coste). NPCs hablados ${talked}/3 (wander aiType 1, granja abierta, ` +
        `best-effort si alguno deriva). Señales ${signsRead}/11 (cementerio), searches ${searched}/6 (2 ` +
        `celdas dobles ejercitadas con 2 (S)earch, 1 id/hallazgo real). HORA CANÓNICA 10:00. LLAVES ` +
        `${keysIn}→${keysOut} (CERO (J)immy: 1 cerrojo en (6,27) que gatea cuarto SIN contenido — ` +
        `flood-fill confirma todo alcanzable sin cruzarlo). Oro ${goldIn}→${goldOut} y karma ` +
        `${karmaIn}→${karmaOut} INALTERADOS. Comandos e/t/s/l. Tienda (dn130) DIFERIDA. Tras ch13: PIVOTE ` +
        `A MAZMORRA.`,
    );
    const covPath = cov.write();
    const covered = JSON.parse(readFileSync(covPath, "utf8")) as { coveredIds: string[] };
    expect(covered.coveredIds.length).toBeGreaterThan(0);

    // (7) Checkpoint nativo por el camino real. West Britanny no cambia oro/karma/llaves.
    const { gam } = await exportCheckpoint(page, "ch13");
    expect(gam.length).toBe(4192);
    expect(gam[PARTY.location]).toBe(19);
    expect(gam[PARTY.karma]).toBe(karmaIn); // West Britanny no toca karma
    expect(keysOut, "llaves INVARIANTES en el capítulo: cero (J)immy (aserto RELATIVO — no depende del valor de entrada, que el re-baseline de cadena de #28 llevó a 0)").toBe(keysIn);
  });

  test("el ch13.gam exportado es un save NATIVO que el propio port re-importa a idéntico estado", async ({ page }) => {
    await bootWorld(page, { debug: false }); // re-importa sin costura de arnés (task #16)
    const { gam, sidecar } = readCheckpointFiles("ch13");
    await page.evaluate(
      ([bytes, side]) => {
        const t = (window as unknown as { __u5test: { loadNativeSave: (b: number[], s?: unknown) => void } }).__u5test;
        t.loadNativeSave(bytes as number[], side);
      },
      [Array.from(gam), sidecar] as [number[], unknown],
    );
    expect(await getPos(page)).toMatchObject({ location: 19 });
  });
});
