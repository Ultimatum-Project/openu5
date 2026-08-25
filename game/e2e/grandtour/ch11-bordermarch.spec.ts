/**
 * GRAND TOUR — CAPÍTULO 11: Bordermarch (loc 26). EL SEGUNDO KEEP.
 *
 * Sigue la familia `keep` estrenada en ch10 (Lycaeum), con CERO puertas con cerrojo (llaves 1→1
 * garantizado, sin arriesgar la tirada de DEX — la ventaja de constraint frente a Empath Abbey/
 * Serpent's Hold, que tienen NPCs tras cerrojos). Contenido de misión de ENDGAME in-keep: la lore de
 * las JOYAS DE LA CORONA de Lord British (Corona/Cetro/Amuleto = el regalia para enfrentar a
 * Blackthorn) + dos compañeros clásicos reclutables (Dupre, Sentri — talk-only) + lore de Shadowlords.
 *
 * NPCs (verificados contra KEEP.TLK REAL, description INCLUIDA — lección de ch10):
 *   - Sir Simon(2)  ['scep'] → "…it can disperse all magical barriers, even in the ethereal plane…
 *        held by the Shadowlords themselves, in their earthly fortress!" (Cetro). TESTIGO: 'magical barriers'.
 *   - Lady Tessa(3) ['amul'] → "I have seen the Amulet which Lord British once bore. It lies forgotten
 *        in the Underworld…" (Amuleto). TESTIGO: 'Amulet which Lord British once bore'.
 *   - Dupre(30)  compañero, TALK-ONLY. ⚠ Su description CAE en un Label de saludo "That is thee, yes?"
 *        cuyo default BUCLEA → hay que responder 'y' (la lección de ch10 generalizada: un Label de
 *        saludo consume el 1er token igual que AskName). 'y' → "I hardly recognize thee…". ⚠ JAMÁS
 *        'join' (JoinParty) ni 'duck' (easter egg → <Gold><Change>). TESTIGO: 'hardly recognize thee'.
 *   - Sentri(31) compañero, TALK-ONLY. ⚠ description CAE en Label de saludo "Have we not met before?"
 *        (default AVANZA) → anteponer un token de gate; luego 'evil' → "Spectres of Evil!". ⚠ JAMÁS
 *        'join'. TESTIGO: 'Spectres of Evil'.
 *
 * DECISIONES DEL LEAD respetadas: Dupre/Sentri TALK-ONLY (criterio Katrina/Jaana/Mariah, roster/.gam
 * intactos) con sus gates de saludo modelados; Sir Simon ['scep'] y Lady Tessa ['amul'] con testigos
 * duros del regalia; encadena ch10.gam + entryClock 10:00 + reseed(0). Sin (J)immy (0 cerrojos).
 *
 * ECONOMÍA / LLAVES: oro 1 y karma 80 heredados de ch10 e INALTERADOS (ningún hecho de Bordermarch
 * exige oro; el PATO de Dupre — única fuga Gold/Change — se esquiva; CERO karma/guards). Healer
 * (dn129, shop-26-healers-herbs) DIFERIDO. LLAVES 1→1: el smallmap 26 tiene 0 tiles-cerrojo (185/187)
 * → NO se teclea (J)immy → cero gasto de llave, sin depender de la tirada de DEX.
 *
 * KEEP de 2 plantas (z0/z1); NPCs por HORA. A las 10:00: z0 Tessa; z1 Sir Simon, Dupre, Sentri. La
 * única search está en z0 (11,4). talkToNpcSequence(recoverPartition:true) alcanza los NPCs de z1
 * (component-aware, patrón ch10).
 *
 * CADENA: re-encadenado sobre `ch10.gam` (Lycaeum, sellado en main 149d3bc/2f688b6). HORA CANÓNICA 10:00.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importCheckpoint, exportCheckpoint, readCheckpointFiles, DEFAULT_ENTRY_GOLD } from "./fixture";
import { bootWorld, chapterTimeout, enterLocation, faceCommand, talkToNpcSequence, getPos, goToFloor } from "./nav";
import { npcManifestId } from "./npcIds";
import { Coverage } from "./coverage";
import { PARTY } from "./offsets";
import { tr } from "./tourLang";

const BORDERMARCH = 26;
const PREV_CHAPTER = "ch10";

test.describe.serial("GT ch11 — Bordermarch (loc 26)", () => {
  test("recorre el 2º KEEP, aprende la lore del regalia de Lord British y exporta el checkpoint", async ({ page }) => {
    test.setTimeout(chapterTimeout(600_000));
    await bootWorld(page); // arranque independiente de piel + costura teleportOverworld (task #16)

    // (1) Entrada por checkpoint REAL de ch10 + HORA CANÓNICA 10:00 + seed 0.
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

    const cov = new Coverage("ch11");

    // (2) Posicionamiento de arnés + (E)nter REAL (teleportOverworld a la isla SE; SIN barco).
    const entry = await enterLocation(page, BORDERMARCH);
    expect(entry).toMatchObject({ location: 26, floor: 0 });
    cov.mark("location-26-bordermarch").mark("floor-26-z0").mark("command-e");

    // (3) z0 — Lady Tessa(3): lore del Amuleto. 'amul' es keyword TOP-LEVEL (salta a Label 1; su
    // Label 0 "support Blackthorn?" NO se toca). REQUERIDO (regalia). recoverPartition por robustez.
    const tessa = await talkToNpcSequence(page, 3, ["amul"], { recoverPartition: true });
    expect(tessa, "Tessa: el Amuleto que portó Lord British").toContain(tr({ en: "Amulet which Lord British once bore", es: "Amuleto que Lord British portó" }));
    cov.mark(npcManifestId("keep", 3));

    // (4) z1 — Sir Simon(2): lore de la Corona/Cetro. 'scep' → "magical barriers … held by the
    // Shadowlords … earthly fortress". REQUERIDO (regalia). Component-aware.
    const simon = await talkToNpcSequence(page, 2, ["scep"], { recoverPartition: true });
    expect(simon, "Sir Simon: el Cetro disipa barreras mágicas").toContain(tr({ en: "magical barriers", es: "barrera mágica" }));
    cov.mark(npcManifestId("keep", 2));
    cov.mark("command-t"); // (T)alk ejercido

    // (5) Compañeros TALK-ONLY (best-effort: gates de saludo + testigos débiles; un fallo NO rompe el
    // capítulo — el contenido de misión es el regalia de §3/§4). ⚠ NUNCA 'join'/'duck'.
    //   Dupre(30): su description cae en Label 0 "That is thee, yes?" (default BUCLEA) → responder 'y'.
    try {
      const dupre = await talkToNpcSequence(page, 30, ["y"], { recoverPartition: true });
      expect(dupre, "Dupre reconoce al Avatar (talk-only)").toContain(tr({ en: "hardly recognize thee", es: "Apenas os reconozco" }));
      cov.mark(npcManifestId("keep", 30));
    } catch (e) {
      cov.note(`Dupre (dn30) OMITIDO (best-effort, gate de saludo): ${String(e).slice(0, 100)}`);
    }
    //   Sentri(31): su saludo ENCADENA dos Labels que avanzan solos con el default (L0 "Have we not
    //   met before?" → L1 "…the Avatar of legend, art thou not?"), cada uno consumiendo un token;
    //   el 3er token llega al keyword top-level. Secuencia SEGURA ['evil','evil','evil'] (NUNCA 'y'
    //   → evitaría L2/L3/JoinParty): los 2 primeros limpian los Labels de saludo, el 3º → testigo.
    //   (Verificado en runtime; refina el modelo del brief de 2 tokens a 3.)
    try {
      const sentri = await talkToNpcSequence(page, 31, ["evil", "evil", "evil"], { recoverPartition: true });
      expect(sentri, "Sentri: los Shadowlords son espectros del Mal (talk-only)").toContain(tr({ en: "Spectres of Evil", es: "Espectros del Mal" }));
      cov.mark(npcManifestId("keep", 31));
    } catch (e) {
      cov.note(`Sentri (dn31) OMITIDO (best-effort, gate de saludo): ${String(e).slice(0, 100)}`);
    }

    // (6) BARRIDO floor-fija: la única search de Bordermarch (z0, 11,4). Normaliza planta ANTES.
    let searched = 0;
    await goToFloor(page, 0);
    try {
      await faceCommand(page, "s", 11, 4);
      cov.mark("search-97-loc26-11-4");
      searched++;
    } catch {
      /* casilla inalcanzable en esta cadena: se omite */
    }
    if (searched > 0) cov.mark("command-s");

    // Marca floor-26-z1 + command-k si en algún momento se subió a z1 (los NPCs altos lo fuerzan).
    // Se comprueba por si el barrido dejó la party en z0: normaliza a z1 una vez para sellar el id.
    try {
      const z1 = await goToFloor(page, 1);
      if (z1.floor === 1) cov.mark("floor-26-z1").mark("command-k");
      await goToFloor(page, 0); // vuelve a z0 para un estado de salida limpio
    } catch {
      /* z1 no alcanzable: se difiere */
    }

    const keysOut = await readNum("keys");
    const gemsOut = await readNum("gems"); // #65: el canal de GEMAS, declarado
    const goldOut = await readNum("gold");
    const karmaOut = await readNum("karma");

    // (7) Cobertura declarada (política tour: SIN assert duro ≥N; el invariante es DETERMINISMO ×2).
    cov.note(
      `Bordermarch (loc 26) — 2º KEEP del tour: location + z0/z1 (nav component-aware), 4 NPCs keep. ` +
        `TESTIGOS byte-exactos del REGALIA de endgame: Sir Simon → 'magical barriers' (Cetro, "held by ` +
        `the Shadowlords in their earthly fortress"); Tessa → 'Amulet which Lord British once bore' ` +
        `(Underworld). Compañeros TALK-ONLY (decisión del lead, sin JoinParty → roster/.gam intactos): ` +
        `Dupre → 'hardly recognize thee' (gate de saludo L0 'y'); Sentri → 'Spectres of Evil' (gate L0 + ` +
        `'evil'). HORA CANÓNICA 10:00 (z0 Tessa; z1 Simon/Dupre/Sentri). GEMAS ${gemsIn}→${gemsOut} (#65). LLAVES ${keysIn}→${keysOut} ` +
        `(CERO (J)immy: smallmap 26 sin tiles-cerrojo → sin arriesgar la tirada de DEX). Oro ` +
        `${goldIn}→${goldOut} y karma ${karmaIn}→${karmaOut} INALTERADOS (healer shop-26-healers-herbs ` +
        `DIFERIDO; PATO de Dupre esquivado). Search ${searched}/1 (z0, best-effort). 0 señales en loc 26. ` +
        `Comandos e/t/s/k. LECCIÓN ch10 aplicada: escaneo de DESCRIPTION por gates que consumen tokens ` +
        `(Dupre/Sentri caen en Label de saludo; Sir Simon/Tessa limpios).`,
    );
    const covPath = cov.write();
    const covered = JSON.parse(readFileSync(covPath, "utf8")) as { coveredIds: string[] };
    expect(covered.coveredIds.length).toBeGreaterThan(0);

    // (8) Checkpoint nativo por el camino real. Bordermarch no cambia oro/karma/llaves.
    const { gam } = await exportCheckpoint(page, "ch11");
    expect(gam.length).toBe(4192);
    expect(gam[PARTY.location]).toBe(26);
    expect(gam[PARTY.karma]).toBe(karmaIn); // Bordermarch no toca karma (PATO/join esquivados)
    expect(keysOut, "llaves INVARIANTES en el capítulo: cero (J)immy (aserto RELATIVO — no depende del valor de entrada, que el re-baseline de cadena de #28 llevó a 0)").toBe(keysIn);
  });

  test("el ch11.gam exportado es un save NATIVO que el propio port re-importa a idéntico estado", async ({ page }) => {
    await bootWorld(page, { debug: false }); // re-importa sin costura de arnés (task #16)
    const { gam, sidecar } = readCheckpointFiles("ch11");
    await page.evaluate(
      ([bytes, side]) => {
        const t = (window as unknown as { __u5test: { loadNativeSave: (b: number[], s?: unknown) => void } }).__u5test;
        t.loadNativeSave(bytes as number[], side);
      },
      [Array.from(gam), sidecar] as [number[], unknown],
    );
    expect(await getPos(page)).toMatchObject({ location: 26 });
  });
});
