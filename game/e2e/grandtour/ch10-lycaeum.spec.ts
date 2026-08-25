/**
 * GRAND TOUR — CAPÍTULO 10: Lycaeum (loc 30). EL PRIMER KEEP.
 *
 * Con las 8 towns selladas (locs 1-8 = `towne`), ch10 estrena la familia TLK `keep` (locs 25-32,
 * `masterForLocation`) — jamás ejercitada (ch01=dwelling, ch02=castle, ch03-09=towne). Lycaeum es la
 * KEEP OF TRUTH / Flame of Truth (corpus sl-identities): aquí se aprende, por diálogo REAL y dentro
 * del keep, el NOMBRE VERDADERO del Shadowlord de la Falsedad = FAULINEI — un ítem de misión de
 * ENDGAME (análogo a una Word of Power). Reutiliza al 100% la infra probada: talkToNpcSequence +
 * goToFloor/climbLadder + nav COMPONENT-AWARE (recoverPartition, patrón ch05/06), sin (J)immy.
 *
 * NPCs (verificados contra KEEP.TLK REAL, no sólo el corpus):
 *   - Shalineth(12) ['merc','y'] → "…<Rune>FAULINEI<Rune> is the chant…the Name of this dread lord…"
 *        ('merc'→Label0 "swear not to use it foolishly?"; 'y'→FAULINEI). ⚠ 'n' → "Thou fool."
 *        <EndConversation> (SIN karma). Rama SEGURA = ['merc','y']. TESTIGO DURO: 'FAULINEI'.
 *   - Janell(11)   ['arti'] → remite a las hermanas gemelas de la ciudad oculta de Cove para
 *        preguntarles por el Shard. TESTIGO: 'Shard of Falsehood'. [literal EA no incluido]
 *   - Mariah(27)   ['shad'] talk-only → "I met one in Moonglow…but did escape with my life!".
 *        DECISIÓN DEL LEAD: TALK-ONLY (criterio Katrina/Jaana) — JAMÁS 'join' (JoinParty → roster/.gam).
 *        TESTIGO: 'escape with my life'.
 *   - Rollo(13)    ['writ'] → "I compiled the reference work known as 'The Book of Lore.'". TESTIGO: 'Book of Lore'.
 *   - Hayden(14)   ['stud'] → "…I study here with my companion, Lord R'hien." (greeting interpola
 *        <AvatarsName> SIN AskName → keyword plano). TESTIGO: "Lord R'hien".
 *   - R'hien(15)   ['ways'] → "In these days, Truth is in great peril!". TESTIGO: 'Truth is in great
 *        peril'. (⚠ NO teclear 'stev' — easter egg meta.)
 *   - Sir Sean(26) ['evil'] → "The Shadowlords!". TESTIGO: 'Shadowlords'.
 *
 * DECISIONES DEL LEAD respetadas: Mariah TALK-ONLY (['shad'], roster/.gam intactos); Shalineth por la
 * secuencia SEGURA (['merc','y'], testigo FAULINEI); hora canónica 10:00 con barrido planta-a-planta
 * z0→z1→z2; encadena ch09.gam + reseed(0). Sin (J)immy en todo el capítulo.
 *
 * ECONOMÍA / LLAVES: oro 1 y karma 80 heredados de ch09 e INALTERADOS (ningún hecho de Lycaeum exige
 * oro; el único brazo penalizador — Shalineth 'n' — se esquiva; SIN CallGuards/Gold/Change/KarmaX).
 * Tiendas DIFERIDAS (Pub dn130 / Healer dn133 / GuildMaster "The Den" dn135, task #51). LLAVES 1→1:
 * el smallmap 30 tiene UN solo cerrojo (185 en (24,21) z0) que gatea sólo un cuarto lateral SIN
 * contenido requerido (flood-fill del scout: entrada alcanza 831 casillas + todos los NPC de z0 sin
 * cruzarlo; las 5 searches viven en z1/z2) → NO se teclea (J)immy → cero gasto de llave.
 *
 * KEEP MULTI-PLANTA (z0/z1/z2): los 7 NPCs cambian de planta por HORA (scheduleIndex, port
 * byte-exacto). A las 10:00 el reparto derivado es: z0 Hayden(14); z1 Mariah(27, SIEMPRE z1); z2 las
 * 5 restantes (Janell 11, Shalineth 12, Rollo 13, R'hien 15, Sir Sean 26). talkToNpcSequence con
 * recoverPartition:true los alcanza cruzando componentes/plantas (goToCell). El barrido de searches/
 * señales normaliza la planta ANTES (goToFloor, README: floor-fija).
 *
 * CADENA: re-encadenado sobre `ch09.gam` (New Magincia, sellado en main d30917d). HORA CANÓNICA 10:00.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importCheckpoint, exportCheckpoint, readCheckpointFiles, DEFAULT_ENTRY_GOLD } from "./fixture";
import { bootWorld, chapterTimeout, enterLocation, faceCommand, readSign, talkToNpcSequence, getPos, goToFloor } from "./nav";
import { npcManifestId } from "./npcIds";
import { Coverage } from "./coverage";
import { PARTY } from "./offsets";
import { tr } from "./tourLang";

const LYCAEUM = 30;
const PREV_CHAPTER = "ch09";

test.describe.serial("GT ch10 — Lycaeum (loc 30)", () => {
  test("recorre el primer KEEP, aprende el nombre del Shadowlord FAULINEI y exporta el checkpoint", async ({ page }) => {
    // 7 NPCs en 3 plantas (nav component-aware) + 5 searches (z1/z2) + 2 señales + (K)limb, sin cárcel
    // ni (J)immy. Techo wall-clock generoso (salvaguarda anti-cuelgue; la sync la da el contador lógico).
    test.setTimeout(chapterTimeout(600_000));
    await bootWorld(page); // arranque independiente de piel + costura teleportOverworld (task #16)

    // (1) Entrada por checkpoint REAL de ch09 + HORA CANÓNICA 10:00 (ver cabecera) + seed 0.
    await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 }, entryGold: DEFAULT_ENTRY_GOLD });
    await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
    const readNum = (expr: string) =>
      page.evaluate((e) => new Function("s", `return s.${e}`)((window as unknown as { __u5test: { state: () => unknown } }).__u5test.state()), expr) as Promise<number>;
    const readStr = (expr: string) =>
      page.evaluate((e) => new Function("s", `return s.${e}`)((window as unknown as { __u5test: { state: () => unknown } }).__u5test.state()), expr) as Promise<string>;
    expect(await readNum("characters[0].intelligence")).toBe(22); // bracket all-A de ch01 (viaja por la cadena)
    const avatarName = await readStr("characters[0].name");
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

    const cov = new Coverage("ch10");

    // (2) Posicionamiento de arnés + (E)nter REAL (teleportOverworld a Verity Isle; SIN barco).
    const entry = await enterLocation(page, LYCAEUM);
    expect(entry).toMatchObject({ location: 30, floor: 0 });
    cov.mark("location-30-lycaeum").mark("floor-30-z0").mark("command-e");

    // (3) NPCs — nav COMPONENT-AWARE (recoverPartition:true) los alcanza en su planta viva (z0/z1/z2)
    // a las 10:00. Sin allowLocked (NO se cruza el único cerrojo). Testigos de contenido DUROS.
    //   ⭐ Shalineth(12): NOMBRE del Shadowlord de la Falsedad = FAULINEI. ⚠ HALLAZGO EN RUNTIME
    //   (el brief lo perdió: su scan de trampas no miró la DESCRIPTION): Shalineth trae un <AskName>
    //   dentro de su description de 16 nodos (IfElseKnowsName→Label1→AskName) → CONSUME el 1er token.
    //   Patrón Fenelon/ch05: anteponer el NOMBRE del Avatar. Rama SEGURA ['merc','y'] ('n' →
    //   "Thou fool."+EndConversation, SIN karma). El nombre es robusto: si Shalineth ya conociera al
    //   Avatar (IfElseKnowsName), AskName es no-op y el token del nombre cae en un IF_SAY_SO inocuo.
    //   REQUERIDO (centro del capítulo).
    const shalineth = await talkToNpcSequence(page, 12, [avatarName, "merc", "y"], { recoverPartition: true });
    expect(shalineth, "Shalineth revela el nombre del Shadowlord de la Falsedad").toContain("FAULINEI");
    cov.mark(npcManifestId("keep", 12));

    //   Janell(11): apunta al Shard of Falsehood (gancho a Cove). REQUERIDO.
    const janell = await talkToNpcSequence(page, 11, ["arti"], { recoverPartition: true });
    expect(janell, "Janell: el Shard of Falsehood en Cove").toContain(tr({ en: "Shard of Falsehood", es: "Fragmento de la Falsedad" }));
    cov.mark(npcManifestId("keep", 11));

    //   Mariah(27): ⚠ COMPAÑERA reclutable. TALK-ONLY (['shad']) por decisión del lead — JAMÁS 'join'
    //   (JoinParty mutaría el roster/.gam). REQUERIDO (siempre z1). TESTIGO: 'escape with my life'.
    const mariah = await talkToNpcSequence(page, 27, ["shad"], { recoverPartition: true });
    expect(mariah, "Mariah: escapó de un Shadowlord (talk-only, roster intacto)").toContain(tr({ en: "escape with my life", es: "escapé con vida" }));
    cov.mark(npcManifestId("keep", 27));

    //   Lore de la Verdad (best-effort: un componente sellado a la hora real no rompe el capítulo;
    //   subconjunto DETERMINISTA bajo seed-0). Rollo/Hayden/R'hien/Sir Sean.
    for (const [dn, seq, witness, label] of [
      [13, ["writ"], tr({ en: "Book of Lore", es: "Libro del Saber" }), "Rollo: el Book of Lore"],
      [14, ["stud"], "Lord R'hien", "Hayden: su compañero Lord R'hien"], // nombre propio: inglés en ambos
      [15, ["ways"], tr({ en: "Truth is in great peril", es: "la Verdad corre gran peligro" }), "R'hien: la Verdad en peligro"],
      [26, ["evil"], tr({ en: "Shadowlords", es: "Señores de la Sombra" }), "Sir Sean: los Shadowlords"],
    ] as const) {
      try {
        const out = await talkToNpcSequence(page, dn, [...seq], { recoverPartition: true });
        expect(out, label).toContain(witness);
        cov.mark(npcManifestId("keep", dn));
      } catch (e) {
        cov.note(`NPC keep dn${dn} OMITIDO (best-effort, partición): ${String(e).slice(0, 100)}`);
      }
    }
    cov.mark("command-t"); // (T)alk ejercido (múltiples NPCs)

    // (4) BARRIDO floor-fija de señales + searches (README: normaliza la planta ANTES de cada op).
    // z0: señal Pub/Healer.
    let signsRead = 0;
    await goToFloor(page, 0);
    try {
      if (await readSign(page, 15, 11)) {
        cov.mark("sign-30-15-11");
        signsRead++;
      }
    } catch {
      /* lado inalcanzable */
    }

    // z1: 2 searches (Mariah vive aquí). Marca floor + (K)limb al subir.
    let searched = 0;
    try {
      const z1 = await goToFloor(page, 1);
      if (z1.floor === 1) {
        cov.mark("floor-30-z1").mark("command-k");
        for (const [x, y, id] of [
          [22, 19, "search-104-loc30-22-19"],
          [22, 17, "search-105-loc30-22-17"],
        ] as const) {
          try {
            await faceCommand(page, "s", x, y);
            cov.mark(id);
            searched++;
          } catch {
            /* casilla inalcanzable en esta cadena: se omite */
          }
        }
      }
    } catch {
      /* z1 no alcanzable: se difiere */
    }

    // z2: 3 searches + señal LIBRARY (biblioteca; cluster de NPCs de z2).
    try {
      const z2 = await goToFloor(page, 2);
      if (z2.floor === 2) {
        cov.mark("floor-30-z2").mark("command-k");
        for (const [x, y, id] of [
          [23, 9, "search-101-loc30-23-9"],
          [23, 7, "search-102-loc30-23-7"],
          [20, 7, "search-103-loc30-20-7"],
        ] as const) {
          try {
            await faceCommand(page, "s", x, y);
            cov.mark(id);
            searched++;
          } catch {
            /* casilla inalcanzable: se omite */
          }
        }
        try {
          if (await readSign(page, 10, 12)) {
            cov.mark("sign-30-10-12");
            signsRead++;
          }
        } catch {
          /* señal inalcanzable */
        }
      }
    } catch {
      /* z2 no alcanzable: se difiere */
    }
    if (signsRead > 0) cov.mark("command-l");
    if (searched > 0) cov.mark("command-s");

    const keysOut = await readNum("keys");
    const gemsOut = await readNum("gems"); // #65: el canal de GEMAS, declarado
    const goldOut = await readNum("gold");
    const karmaOut = await readNum("karma");

    // (5) Cobertura declarada (política tour: SIN assert duro ≥N; el invariante es DETERMINISMO ×2).
    cov.note(
      `Lycaeum (loc 30) — PRIMER KEEP del tour: location + z0/z1/z2 (3 plantas, nav component-aware), ` +
        `7 NPCs keep. TESTIGOS byte-exactos: Shalineth → NOMBRE del Shadowlord de la Falsedad 'FAULINEI' ` +
        `(rama SEGURA ['merc','y']; ⚠'n'→"Thou fool."+EndConv, SIN karma); Janell → 'Shard of Falsehood' ` +
        `(gancho a Cove); Mariah → 'escape with my life' (TALK-ONLY por decisión del lead, sin JoinParty ` +
        `→ roster/.gam intactos); Rollo → 'Book of Lore'; Hayden → 'Lord R'hien' (greeting <AvatarsName> ` +
        `SIN AskName); R'hien → 'Truth is in great peril'; Sir Sean → 'Shadowlords'. HORA CANÓNICA 10:00 ` +
        `(reparto por planta vía scheduleIndex: z0 Hayden, z1 Mariah, z2 los 5). GEMAS ${gemsIn}→${gemsOut} (#65). LLAVES ${keysIn}→${keysOut} ` +
        `(CERO (J)immy: único cerrojo (24,21) z0 gatea un cuarto lateral vacío — flood-fill del scout; ` +
        `searches en z1/z2). Oro ${goldIn}→${goldOut} y karma ${karmaIn}→${karmaOut} INALTERADOS (tiendas ` +
        `DIFERIDAS Pub/Healer/GuildMaster, pero YA NO por pobreza: su razón vieja («inasequibles con ` +
        `oro 1», task #51) caducó con el pin entryGold de #52 y se contradecía con el ` +
        `«Oro ${goldIn}→${goldOut}» de cuatro palabras antes — hoy son alcanzables y se difieren por ` +
        `DECISIÓN de la spec (no se visitan), no por el saldo. Misma corrección que ya hizo ch08; la ` +
        `auditoría final (01-08) la extendió a los hermanos que se la dejaron). Señales ${signsRead}/2, ` +
        `searches ${searched}/5 (best-effort, subconjunto determinista). Comandos e/t/s/l/k. Estrena la ` +
        `familia keep con nav component-aware (patrón ch05/06). NPCs de lore best-effort (partición R1).`,
    );
    const covPath = cov.write();
    const covered = JSON.parse(readFileSync(covPath, "utf8")) as { coveredIds: string[] };
    expect(covered.coveredIds.length).toBeGreaterThan(0);

    // (6) Checkpoint nativo por el camino real. Lycaeum no cambia oro/karma/llaves.
    const { gam } = await exportCheckpoint(page, "ch10");
    expect(gam.length).toBe(4192);
    expect(gam[PARTY.location]).toBe(30);
    expect(gam[PARTY.karma]).toBe(karmaIn); // Lycaeum no toca karma (brazo de Shalineth esquivado)
    expect(keysOut, "llaves INVARIANTES en el capítulo: cero (J)immy (aserto RELATIVO — no depende del valor de entrada, que el re-baseline de cadena de #28 llevó a 0)").toBe(keysIn);
  });

  test("el ch10.gam exportado es un save NATIVO que el propio port re-importa a idéntico estado", async ({ page }) => {
    await bootWorld(page, { debug: false }); // re-importa sin costura de arnés (task #16)
    const { gam, sidecar } = readCheckpointFiles("ch10");
    await page.evaluate(
      ([bytes, side]) => {
        const t = (window as unknown as { __u5test: { loadNativeSave: (b: number[], s?: unknown) => void } }).__u5test;
        t.loadNativeSave(bytes as number[], side);
      },
      [Array.from(gam), sidecar] as [number[], unknown],
    );
    expect(await getPos(page)).toMatchObject({ location: 30 });
  });
});
