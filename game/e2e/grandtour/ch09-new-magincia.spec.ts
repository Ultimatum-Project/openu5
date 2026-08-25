/**
 * GRAND TOUR — CAPÍTULO 9: New Magincia (loc 8).
 *
 * La última town no visitada de la serie TOWNE (locs 1-8) y el pueblo MÁS BENIGNO del tramo: cero
 * puertas con cerrojo (llaves 1→1 garantizado), cero CallGuards/Gold/Change, una sola trampa de
 * karma LOCAL y evitable (Wartow). Contenido de Gran Misión IN-TOWN y autosuficiente: la Mantra de
 * Humildad LUM (Wartow) tecleada dentro del pueblo, la compañera Katrina (talk-only, roster
 * intacto) y la telaraña de lore Blackthorn/Shadowlords/Humildad. NO enseña Word of Power alguna
 * (IGNAVUS la da Hassad, PRESO en el Palacio de Blackthorn — fuera de town; Kaiko sólo lo PREPARA).
 *
 * NPCs (verificados contra TOWNE.TLK REAL, no sólo el corpus):
 *   - Wartow(48)  ['humi','brit','n','y'] → "…<Rune>LUM<Rune> is the chant which thou dost seek!"
 *                 (humi→Label0 "Who dost thou serve?"; brit→Label1 "Dost thou hate…Blackthorn?";
 *                 n=respuesta HUMILDE→"Thou art wiser than I thought!"→Label5→y→LUM). ⚠ TRAMPA:
 *                 'y' en Label1/2/3/4 (rama orgullosa) → <KarmaMinusOne>×2. La spec teclea SÓLO la
 *                 rama segura. TESTIGO DURO: 'LUM'.
 *   - Katrina(47) ['wait','virt'] talk-only → "The battle of Virtue!" (lore Virtud, pastora U4).
 *                 DECISIÓN DEL LEAD: talk-only (NO 'join'→<JoinParty>, que mutaría el roster/.gam).
 *                 TESTIGO: 'battle of Virtue'.
 *   - Shirita(42) ['magi'] → "…Magincia was destroyed for its sins of pride and arrogance."
 *                 TESTIGO: 'pride and arrogance'.
 *   - Yasuda(43)  ['shad'] → "The Shadowlords are Blackthorn's enforcers…". TESTIGO: 'Shadowlords'.
 *   - Tetsuo(44)  ['virt'] → "…forced upon thee, they lose that virtue." TESTIGO: 'lose that virtue'.
 *   - Fumiko(45)  ['virt'] → "None are more hopelessly enslaved than those who falsely believe they
 *                 are free!". TESTIGO: 'hopelessly enslaved' (el 'Devoid of freedom…' del brief es
 *                 el keyword 'free'/'choi', NO 'virt' — el runtime manda).
 *   - Kaiko(46)   ['king'] → "Blackthorn, the usurper!" (cross-Hassad/endgame). TESTIGO: 'usurper'.
 *   - Tomoka(41)  ['comm'] → "Each of us profits from the labours of the group!" (campos comunales).
 *                 TESTIGO: 'labours of the group'.
 *
 * DESVIACIONES vs BRIEF (el runtime manda; verificadas en los datos REALES):
 *   - R2 NO se sostiene: los greetings de Yasuda/Tetsuo/Fumiko NO llevan <AskName>/<IfElseKnowsName>,
 *     sólo interpolan <AvatarsName> (el nombre ya se conoce tras 8 capítulos). → secuencias de
 *     keyword PLANO, sin anteponer el nombre del Avatar. (greeting ops = ['AvatarsName'] a secas.)
 *   - Testigo de Tomoka corregido: el brief proponía ['blac']→'harvest', pero en el TLK real
 *     'blac' responde "…he does little to keep his promise." (SIN 'harvest'); 'harvest' vive en otro
 *     keyword. Se usa ['comm']→'labours of the group' (single-token robusto, tema de campos comunales).
 *
 * DECISIONES DEL LEAD respetadas: Katrina TALK-ONLY (['wait','virt'], sin JoinParty → roster/.gam
 * intactos). Wartow SÓLO la rama segura (['humi','brit','n','y'], JAMÁS la orgullosa). Sin (J)immy
 * en todo el capítulo (0 puertas con cerrojo → llaves 1→1). ORO 1→1, KARMA 80→80.
 *
 * ECONOMÍA / LLAVES: oro 1 y karma 80 heredados de ch08 e INALTERADOS (ningún hecho de New Magincia
 * exige oro; la única trampa de karma se esquiva). Tiendas DIFERIDAS (Barkeeper dn130 z0 /
 * GuildMaster dn134 z1: con oro 1 e INT 22 todo es inasequible — task #51). LLAVES 1→1: el smallmap
 * 8 no tiene NINGUNA puerta con cerrojo (z0: 7×184 + 2×186; z1: 2×184 — todas regulares/transitables)
 * → CERO (J)immy → cero gasto de llave. Ventaja de constraint DECISIVA frente a los keeps.
 *
 * z1 (Guild/mercado negro) DEFERIDA — SELLO ESTRUCTURAL confirmado en runtime (brief R4): las 2
 * searches viven en z1 (21,18)/(25,21), pero la ÚNICA escalera (tile 200 en (30,16) z0) está DENTRO
 * de la taberna, tras la BARRA (mesas/sillas/barriles no-walkable). walkTo sólo alcanza (24,19) y no
 * rodea la barra hasta (30,16) → NO hay (K)limb fiel a z1. floor-8-z1 + las 2 searches quedan fuera
 * (concuerda con task #51: el Guild no tiene superficie jugable). El núcleo z0 no depende de z1.
 *
 * CADENA: re-encadenado sobre `ch08.gam` (Yew, sellado en main). HORA CANÓNICA 10:00 (diurna,
 * default): los 8 NPCs son z-invariantes (z=[0,0,0] en sus 3 waypoints), la hora sólo mueve su (x,y)
 * dentro de z0 → operación floor-fija trivial, sin componentes particionados. Sin dependencia de
 * mostrador (shops diferidos). Es el caso "floor-fija" más simple del tour.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importCheckpoint, exportCheckpoint, readCheckpointFiles, DEFAULT_ENTRY_GOLD } from "./fixture";
import { bootWorld, chapterTimeout, enterLocation, readSign, talkToNpcSequence, getPos } from "./nav";
import { npcManifestId } from "./npcIds";
import { Coverage } from "./coverage";
import { PARTY } from "./offsets";

const NEW_MAGINCIA = 8;
const PREV_CHAPTER = "ch08";

test.describe.serial("GT ch09 — New Magincia (loc 8)", () => {
  test("recorre New Magincia, aprende la Mantra de Humildad LUM y exporta el checkpoint", async ({ page }) => {
    // 8 NPCs (Wartow multi-paso con trampa de karma esquivada) + 10 señales + 2 searches en z1 vía
    // (K)limb. Sin cárcel ni (J)immy: la nav más LIGERA del tramo. Techo wall-clock generoso
    // (salvaguarda anti-cuelgue, no mecanismo de sync — la sync la da el contador de turnos lógico).
    test.setTimeout(chapterTimeout(600_000));
    await bootWorld(page); // arranque independiente de piel + costura teleportOverworld (task #16)

    // (1) Entrada por checkpoint REAL de ch08 + HORA CANÓNICA 10:00 (ver cabecera) + seed 0.
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
    // NO afecta al contenido de este capítulo: New Magincia es la town SIN puertas con
    // cerrojo (cabecera de este fichero) — el pin es telemetría de cadena, no prerrequisito.
    expect(keysIn, "premisa de cadena: entra con 1 llave — con el pin entryGold (#52) el tributo de Yew se PAGA, así que no hay arresto y no hay CONFISCACIÓN de llaves. El «lo rompió el (J)immy» quedó REFUTADO por medición en re/notes/auditoria-estatica-sellos.md §3. New Magincia no tiene puertas con cerrojo: el pin es telemetría, no prerrequisito").toBe(1);

    const cov = new Coverage("ch09");

    // (2) Posicionamiento de arnés + (E)nter REAL.
    const entry = await enterLocation(page, NEW_MAGINCIA);
    expect(entry).toMatchObject({ location: 8, floor: 0 });
    cov.mark("location-8-new-magincia").mark("floor-8-z0").mark("command-e");

    // (3) NPCs de z0 (todos hora-invariantes: z=[0,0,0]). Testigos de contenido DUROS. Ninguno
    // necesita recoverPartition (mapa abierto, sin particiones). El ORDEN no afecta a las llaves (no
    // hay (J)immy); sólo debe ser DETERMINISTA (lo es bajo seed-0).
    //
    //   Yasuda(43) PRIMERO — ORDEN LOAD-BEARING: a las 10:00 su waypoint es idx1=(9,28), aiType 1
    //   (DEAMBULA) DENTRO de un corral 3×3 de trigo (tile 45, walkable) cercado por vallas (202/203)
    //   con una ÚNICA entrada de 1 casilla en (9,25). Perseguir a un deambulante por una entrada
    //   estrecha es el caso duro: se hace PRIMERO, con drift de wander MÍNIMO (cero turnos previos
    //   acumulados) — precedente ch07/ch08 (NPC difícil primero, RNG fresco). Greeting interpola
    //   <AvatarsName> (NO AskName) → basta el keyword.
    const yasuda = await talkToNpcSequence(page, 43, ["shad"]);
    expect(yasuda, "Yasuda: los Shadowlords son los ejecutores de Blackthorn").toContain("Shadowlords");
    cov.mark(npcManifestId("towne", 43));

    //   Tomoka(41): campos comunales. (Testigo corregido vs brief: ['comm'], no ['blac'].)
    const tomoka = await talkToNpcSequence(page, 41, ["comm"]);
    expect(tomoka, "Tomoka: los campos comunales").toContain("labours of the group");
    cov.mark(npcManifestId("towne", 41));

    //   Fumiko(45): libertad/virtud. Greeting interpola <AvatarsName> (NO AskName) → keyword plano.
    const fumiko = await talkToNpcSequence(page, 45, ["virt"]);
    expect(fumiko, "Fumiko: los que se creen libres son los más esclavizados").toContain("hopelessly enslaved");
    cov.mark(npcManifestId("towne", 45));

    //   Tetsuo(44): virtud forzada ≠ virtud (Label 0 "servant of Blackthorn?" NO se toca; 'virt'
    //   salta directo a la respuesta de virtud). Greeting sólo interpola el nombre.
    const tetsuo = await talkToNpcSequence(page, 44, ["virt"]);
    expect(tetsuo, "Tetsuo: la virtud forzada pierde su valor").toContain("lose that virtue");
    cov.mark(npcManifestId("towne", 44));

    //   Kaiko(46): 'king'→"Blackthorn, the usurper!" (cross-Hassad → gancho al endgame IGNAVUS).
    const kaiko = await talkToNpcSequence(page, 46, ["king"]);
    expect(kaiko, "Kaiko: Blackthorn el usurpador").toContain("usurper");
    cov.mark(npcManifestId("towne", 46));

    //   Shirita(42): backstory de la Humildad (Magincia destruida por su orgullo).
    const shirita = await talkToNpcSequence(page, 42, ["magi"]);
    expect(shirita, "Shirita: Magincia cayó por su orgullo").toContain("pride and arrogance");
    cov.mark(npcManifestId("towne", 42));

    //   Katrina(47): ⚠ COMPAÑERA reclutable. DECISIÓN DEL LEAD: TALK-ONLY (['wait','virt']) — JAMÁS
    //   'join'→<JoinParty> (mutaría el roster/.gam y toda la cadena aguas abajo).
    const katrina = await talkToNpcSequence(page, 47, ["wait", "virt"]);
    expect(katrina, "Katrina: la batalla de la Virtud (talk-only, roster intacto)").toContain("battle of Virtue");
    cov.mark(npcManifestId("towne", 47));

    //   Wartow(48): ⭐ Mantra de Humildad LUM. Rama SEGURA ['humi','brit','n','y'] ('n' a "¿odias a
    //   Blackthorn?" = respuesta HUMILDE → salta a la mantra SIN tocar karma). ⚠ JAMÁS 'y' en las
    //   Labels 1/2/3/4 (rama orgullosa → <KarmaMinusOne>×2).
    const wartow = await talkToNpcSequence(page, 48, ["humi", "brit", "n", "y"]);
    expect(wartow, "Wartow entrega la Mantra de Humildad").toContain("LUM");
    cov.mark(npcManifestId("towne", 48));
    cov.mark("command-t"); // (T)alk ejercido (8 NPCs)

    // (4) Señales de z0 (10, todas floor 0): epitafios del cementerio (norte), Ley de la Humildad de
    // Blackthorn (centro) y placa de refundación (entrada). readSign prueba cada lado ALCANZABLE;
    // try/catch → marca sólo las leídas (subconjunto DETERMINISTA bajo seed-0).
    let signsRead = 0;
    for (const [x, y] of [
      [18, 1], [20, 1], [22, 1], [24, 1], [26, 1], [28, 1], // 6 lápidas (fila norte del cementerio)
      [19, 7],                                                 // "Here lie the former citizens of Magincia"
      [20, 17], [20, 20],                                      // BLACKTHORN'S LAW OF HUMILITY (×2)
      [15, 27],                                                // "New Magincia — Refounded 3/12/136"
    ] as const) {
      try {
        if (await readSign(page, x, y)) {
          cov.mark(`sign-8-${x}-${y}`);
          signsRead++;
        }
      } catch {
        /* lado inalcanzable en esta cadena: se omite */
      }
    }
    if (signsRead > 0) cov.mark("command-l");

    // (5) z1 (Guild/mercado negro) — DEFERIDO por SELLO ESTRUCTURAL del mapa (finding en runtime,
    // brief R4 confirmado). La ÚNICA escalera a z1 es el tile 200 en (30,16) z0, PERO está DENTRO de
    // la taberna, tras la BARRA (mobiliario no-walkable: mesas/sillas/barriles/chimenea). El BFS de
    // walkTo sólo alcanza (24,19) — el lado oeste de la sala — y no puede rodear la barra hasta
    // (30,16): `walkTo(30,16): no llegó (party en 24,19)`. Por tanto NO hay (K)limb fiel a z1 y las
    // 2 searches de z1 (21,18)/(25,21) + `floor-8-z1` quedan DEFERIDAS (concuerda con task #51: el
    // Guild/mercado negro no tiene superficie jugable). El núcleo z0 (8 NPCs + 10 señales + LUM) NO
    // depende de z1. (Verificado con probe aislado; no se intenta el climb para no thrashear el sello.)

    const keysOut = await readNum("keys");
    const gemsOut = await readNum("gems"); // #65: el canal de GEMAS, declarado
    const goldOut = await readNum("gold");
    const karmaOut = await readNum("karma");

    // (6) Cobertura declarada (política tour: SIN assert duro ≥N; el invariante es DETERMINISMO ×2).
    cov.note(
      `New Magincia (loc 8): location+z0, 8 NPCs towne (z1 DEFERIDA — ver abajo). ` +
        `TESTIGOS de contenido byte-exactos: Wartow → MANTRA DE HUMILIDAD 'LUM' (rama SEGURA ` +
        `['humi','brit','n','y']; ⚠NUNCA 'y' en Labels 1-4 → KarmaMinusOne×2); Katrina → 'battle of ` +
        `Virtue' (TALK-ONLY por decisión del lead, sin JoinParty → roster/.gam intactos); Shirita → ` +
        `'pride and arrogance'; Yasuda → 'Shadowlords'; Tetsuo → 'lose that virtue'; Fumiko → 'freedom'; ` +
        `Kaiko → 'usurper' (cross-Hassad/endgame); Tomoka → 'labours of the group'. HORA CANÓNICA 10:00 ` +
        `(8 NPCs z-invariantes: z=[0,0,0]; mapa abierto sin particiones → floor-fija trivial). ` +
        `GEMAS ${gemsIn}→${gemsOut} (#65). LLAVES ${keysIn}→${keysOut} (CERO (J)immy: smallmap 8 sin puertas con cerrojo — 7×184+2×186 z0, ` +
        `2×184 z1, todas regulares). Oro ${goldIn}→${goldOut} y karma ${karmaIn}→${karmaOut} INALTERADOS ` +
        `(⚠ las tiendas Barkeeper dn130/GuildMaster dn134 siguen DIFERIDAS, pero YA NO por pobreza: ` +
        `su razón vieja («inasequibles con oro 1», task #51) caducó con el pin entryGold de #52 y se ` +
        `contradecía con el «Oro ${goldIn}→${goldOut}» de cuatro palabras antes — hoy son alcanzables ` +
        `y se difieren por DECISIÓN de la spec (no se visitan), no por el saldo. Misma corrección que ` +
        `ya hizo ch08; la auditoría final (01-08) la extendió a los hermanos que se la dejaron). ` +
        `DESVIACIONES vs brief (runtime manda): (a) R2 no aplica — greetings de Yasuda/Tetsuo/Fumiko sólo ` +
        `interpolan <AvatarsName>, SIN <AskName> → keyword plano sin anteponer nombre; (b) testigo de ` +
        `Tomoka corregido a ['comm']→'labours of the group' (el ['blac'] del brief responde 'keep his ` +
        `promise', SIN 'harvest'). Señales ${signsRead}/10 (subconjunto determinista). z1 (Guild/mercado ` +
        `negro) DEFERIDA por SELLO ESTRUCTURAL: la única escalera a z1 (tile 200 en (30,16) z0) está ` +
        `tras la barra de la taberna (mobiliario no-walkable); walkTo sólo alcanza (24,19) → sin (K)limb ` +
        `fiel → floor-8-z1 + 2 searches z1 diferidas (concuerda con task #51). Comandos e/t/l. Cierra la ` +
        `serie de las 8 towns principales (locs 1-8) del Grand Tour.`,
    );
    const covPath = cov.write();
    const covered = JSON.parse(readFileSync(covPath, "utf8")) as { coveredIds: string[] };
    expect(covered.coveredIds.length).toBeGreaterThan(0);

    // (7) Checkpoint nativo por el camino real. New Magincia no cambia oro/karma/llaves.
    const { gam } = await exportCheckpoint(page, "ch09");
    expect(gam.length).toBe(4192);
    expect(gam[PARTY.location]).toBe(8);
    expect(gam[PARTY.karma]).toBe(karmaIn); // New Magincia no toca karma (trampa de Wartow esquivada)
    expect(keysOut, "llaves INVARIANTES en el capítulo: cero (J)immy (aserto RELATIVO — no depende del valor de entrada, que el re-baseline de cadena de #28 llevó a 0)").toBe(keysIn);
  });

  test("el ch09.gam exportado es un save NATIVO que el propio port re-importa a idéntico estado", async ({ page }) => {
    await bootWorld(page, { debug: false }); // re-importa sin costura de arnés (task #16)
    const { gam, sidecar } = readCheckpointFiles("ch09");
    await page.evaluate(
      ([bytes, side]) => {
        const t = (window as unknown as { __u5test: { loadNativeSave: (b: number[], s?: unknown) => void } }).__u5test;
        t.loadNativeSave(bytes as number[], side);
      },
      [Array.from(gam), sidecar] as [number[], unknown],
    );
    expect(await getPos(page)).toMatchObject({ location: 8 });
  });
});
