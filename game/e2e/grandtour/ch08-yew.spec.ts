/**
 * GRAND TOUR — CAPÍTULO 8: Yew (loc 4).
 *
 * El pueblo-cárcel de la Inquisición de Blackthorn y el HUB in-town de la Gran Misión: aquí se
 * obtienen la Word of Power MALUM (dungeon Wrong), la Mantra de Justicia BEH, y el lore de la
 * Resistencia — todo por diálogo REAL, sin depender de la sala secreta (el TLK NO gatea el
 * password `dawn` con quest-flag: Felespar entrega MALUM con puro match de texto). Escala la
 * novedad de ch07 (1 puerta con llave) a su forma dura: la CÁRCEL de 3 CELDAS con puerta con
 * llave (tile 187) en fila (A:(21,6) B:(25,6) C:(29,6)) — 3 operaciones (J)immy component-aware.
 *
 * NPCs (verificados contra TOWNE.TLK, no sólo el corpus — el corpus no documenta greeting-Labels
 * ni trampas):
 *   - Felespar(22) ['n','word','yes','yes','dawn'] → "…Word of Power for the dungeon Wrong is MALUM!"
 *                  (greeting salta a Label 0 con Pause; word→Label2, yes→Label3, yes→Label4, dawn→MALUM).
 *                  Celda A, tras puerta con llave (21,6). TESTIGO DURO: 'MALUM'.
 *   - Chamfort(17) ['mant','jere'] → "The Mantra of Justice is BEH!" (sin gate). TESTIGO: 'BEH'.
 *   - Greymarch(36)['son']  → "…Froed was killed by the wicked guards…". Celda C (29,6). TESTIGO: 'Froed'.
 *   - Jerone(21)   ['pris'] → "I was convicted of heresy!". Celda B (25,6). TESTIGO: 'heresy'.
 *   - Mario(23)    ['puni'] → "…sentenced to slowly die in the stocks…" (cepo abierto). TESTIGO: 'stocks'.
 *   - Aleyn(24)    ['brok'] → "I failed to enforce the Seventh Law of Virtue." (cepo). TESTIGO frase.
 *   - Judge Dryden(19) ['n','n','cour'] → "This is the Court of Inquisition of His Majesty
 *                  Blackthorn!" ⚠ TRAMPA: greeting→Label0 "confess?"; 'y'/herejía → <CallGuards>
 *                  (combate). La spec SÓLO teclea la rama SEGURA (dos defaults + 'cour'). TESTIGO:
 *                  'Court of Inquisition'.
 *   - Jeremy(20)   ['jail'] → "It is going to cost me 500 gold crowns!" ⚠ TRAMPA: 'key' regala 5
 *                  llaves y ACTO SEGUIDO cobra 50 oro → con oro 1 el impago = <KarmaMinusOne>×3
 *                  ("Scoundrel!"). JAMÁS se teclea 'key'/'food'/'y'. TESTIGO: '500 gold crowns'.
 *
 * DECISIONES DEL LEAD respetadas: Jaana(35)/Landon(18) viven en el componente z=255 (sentinel),
 * NO modelado por el mapa (smallmap sólo tiene z=-1 y z=0) ni alcanzable por findNpcAnyFloor
 * (busca z∈[-1..3]) → DIFERIDOS best-effort (no se intentan). Sin JoinParty (roster INTACTO). Con
 * Jeremy NUNCA 'key'. Con Dryden sólo la rama segura.
 *
 * ECONOMÍA / LLAVES: oro 1 y karma 80 heredados de ch07 e INALTERADOS (ningún hecho de Yew exige
 * oro; las trampas de karma se esquivan; tienda `shop-2-arms-of-justice` DIFERIDA — a INT22 el ítem
 * más barato (Club≈6) es inasequible con oro 1). LLAVES: entra con 2; (J)immy exitoso NO gasta llave
 * (game.ts:jimmy — rand(0,29), éxito ⇔ DEX>roll; sólo rompe llave al FALLAR). El activo de MAYOR DEX
 * VIVO tiene DEX 21 (el DEX 22 de char1 está MUERTO → excluido) → p(fallo)=9/30 por tirada. Bajo
 * seed-0 el resultado es DETERMINISTA pero seed-dependiente: verificado en runtime que la CÁRCEL SE
 * HACE PRIMERO (RNG fresco tras reseed) → celda A (Felespar) abre a la 1ª conservando llave; celda B
 * (Jerone) falla UNA tirada y rompe 1 llave → LLAVES 2→1 (celda C abre con la llave restante). El
 * TRIPWIRE R1 del brief NO se sostiene byte-a-byte (2→2 era optimista): 2→1 es el resultado real,
 * explicado causalmente. ⚠ ORDEN LOAD-BEARING: hacer la cárcel DESPUÉS del patio (más rand consumido)
 * desplaza las tiradas a una región donde AMBAS llaves se rompen en la celda A → jimmyDoor lanza y la
 * nav reintenta en vano (thrash de ~7min). Precedente idéntico a ch07 (Goeth PRIMERO con reloj/RNG
 * fresco). Felespar es REQUERIDO (MALUM = centro del cap); Jerone/Greymarch best-effort.
 *
 * CADENA: re-encadenado sobre `ch07.gam` (Jhelom, sellado en main). HORA CANÓNICA 10:00 (diurna,
 * default): los presos son hora-invariantes (celdas/cepos a toda hora) y Chamfort/Jeremy/Dryden
 * están SIEMPRE en z0 (todos sus waypoints z=0; la hora sólo mueve su (x,y)). Sin dependencia de
 * mostrador (shops diferidos).
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importCheckpoint, exportCheckpoint, readCheckpointFiles, DEFAULT_ENTRY_GOLD } from "./fixture";
import { bootWorld, chapterTimeout, enterLocation, faceCommand, readSign, talkToNpcSequence, getPos, climbLadder, getTributePayments, resetTributePayments } from "./nav";
import { npcManifestId } from "./npcIds";
import { Coverage } from "./coverage";
import { PARTY } from "./offsets";
import { tr } from "./tourLang";

const YEW = 4;
const PREV_CHAPTER = "ch07";

test.describe.serial("GT ch08 — Yew (loc 4)", () => {
  test("recorre Yew, aprende MALUM/BEH (cárcel con llaves) y exporta el checkpoint", async ({ page }) => {
    // 10 NPCs (2 multi-paso de trampa) + 3 celdas con llave (partición component-aware) + búsquedas
    // y señales: la nav más pesada de la cadena. Techo wall-clock GENEROSO (salvaguarda anti-cuelgue,
    // no mecanismo de sync — la sync la da el contador de turnos lógico).
    test.setTimeout(chapterTimeout(600_000));
    await bootWorld(page); // arranque independiente de piel + costura teleportOverworld (task #16)

    resetTributePayments(); // el registro de tributos es del CAPÍTULO (el worker es compartido)

    // (1) Entrada por checkpoint REAL de ch07 + HORA CANÓNICA 10:00 (ver cabecera) + seed 0.
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
    expect(keysIn, "premisa de cadena: entra con 2 llaves (margen para las celdas)").toBe(2);

    const cov = new Coverage("ch08");

    // (2) Posicionamiento de arnés + (E)nter REAL.
    const entry = await enterLocation(page, YEW);
    expect(entry).toMatchObject({ location: 4, floor: 0 });
    cov.mark("location-4-yew").mark("floor-4-z0").mark("command-e");

    // (3) LA CÁRCEL PRIMERO — 3 celdas con puerta con llave (187) en fila, RNG FRESCO (ver cabecera:
    // orden load-bearing; hacerlas tras el patio rompe ambas llaves en la celda A → thrash). goToCell
    // (recoverPartition+allowLocked) planifica la ruta cruzando la arista `locked` y (J)immy con el
    // activo de mayor DEX; para RE-CRUZAR de vuelta (topología estática) también hace falta allowLocked
    // (coste 0: jimmyDoor ve la puerta ya abierta y no gasta llave).
    //   Felespar(22) celda A (21,6): password de la Resistencia 'dawn' → WoP MALUM (dungeon Wrong).
    //   Abre a la 1ª bajo seed-0 conservando llave (verificado). REQUERIDO.
    const felespar = await talkToNpcSequence(page, 22, ["n", "word", "yes", "yes", "dawn"], {
      recoverPartition: true,
      allowLocked: true,
    });
    expect(felespar, "Felespar entrega la Word of Power del dungeon Wrong").toContain("MALUM");
    cov.mark(npcManifestId("towne", 22)).mark("word-malum");
    cov.mark("command-j"); // (J)immy ejercido en la puerta de la celda
    const keysAfterFelespar = await readNum("keys");

    //   Jerone(21) celda B (25,6) y Greymarch(36) celda C (29,6): best-effort. Bajo seed-0 la celda B
    //   ROMPE 1 llave (una tirada rand(0,29)≥DEX21) → llaves 2→1; la celda C abre con la restante. Si
    //   el presupuesto se agotara, se OMITEN sin romper el capítulo (determinista ×2 igualmente).
    try {
      const jerone = await talkToNpcSequence(page, 21, ["pris"], { recoverPartition: true, allowLocked: true });
      expect(jerone, "Jerone: convicto de herejía").toContain(tr({ en: "heresy", es: "herejía" }));
      cov.mark(npcManifestId("towne", 21));
    } catch (e) {
      cov.note(`Jerone (celda B) OMITIDO (best-effort): ${String(e).slice(0, 120)}`);
    }
    try {
      const greymarch = await talkToNpcSequence(page, 36, ["son"], { recoverPartition: true, allowLocked: true });
      expect(greymarch, "Greymarch: su hijo Froed").toContain("Froed");
      cov.mark(npcManifestId("towne", 36));
    } catch (e) {
      cov.note(`Greymarch (celda C) OMITIDO (best-effort): ${String(e).slice(0, 120)}`);
    }
    const keysOut = await readNum("keys");
    const gemsOut = await readNum("gems"); // #65: el canal de GEMAS, declarado

    // (4) NPCs de PATIO (comp de entrada, z0 a toda hora), TRAS la cárcel (su RNG ya no importa).
    // Testigos de contenido DUROS. Ninguno necesita recoverPartition (todos en el componente abierto).
    //   Chamfort(17): Mantra de Justicia BEH. 'mant'→Label3 "Who told thee?"→'jere'→"…BEH!".
    const chamfort = await talkToNpcSequence(page, 17, ["mant", "jere"]);
    expect(chamfort, "Chamfort enseña la Mantra de Justicia").toContain(tr({ en: "Mantra of Justice", es: "Mantra de Justicia" }));
    expect(chamfort, "Chamfort: la Mantra es BEH").toContain("BEH");
    cov.mark(npcManifestId("towne", 17));

    //   Mario(23) / Aleyn(24): cepos ABIERTOS (stocks), SIN llave (el NPC ocupa un tile no-walkable;
    //   se le habla desde una casilla adyacente).
    const mario = await talkToNpcSequence(page, 23, ["puni"]);
    // "stocks" viene de la DESCRIPCIÓN "You see a man…from days in the stocks." (compuesto "You
    // see …" que NO es key de es.json → inglés en ambos modos). La RESPUESTA de Mario a 'puni'
    // ("¡Ay, apiadaos de mí!") sí se traduce, pero el testigo es la descripción: inglés literal.
    expect(mario, "Mario: condenado al cepo (descripción sin traducir)").toContain("stocks");
    cov.mark(npcManifestId("towne", 23));
    const aleyn = await talkToNpcSequence(page, 24, ["brok"]);
    expect(aleyn, "Aleyn: 7ª Ley de la Virtud").toContain(tr({ en: "Seventh Law of Virtue", es: "Séptima Ley de la Virtud" }));
    cov.mark(npcManifestId("towne", 24));

    //   Jeremy(20): ⚠ TRAMPA 'key' (regala 5 llaves y cobra 50 oro → −3 karma con oro 1). Se teclea
    //   SÓLO 'jail' (rumor del hermano preso, cero efecto en oro/karma/llaves).
    const jeremy = await talkToNpcSequence(page, 20, ["jail"]);
    expect(jeremy, "Jeremy: el rescate del hermano cuesta 500").toContain(tr({ en: "500 gold crowns", es: "500 coronas de oro" }));
    cov.mark(npcManifestId("towne", 20));

    //   Judge Dryden(19): ⚠ TRAMPA CallGuards. greeting→Label0 "confess?"; 'y'/herejía → combate.
    //   Rama SEGURA: default 'n' (→Label1 "plead for another?"), default 'n' (→"Then what?"),
    //   'cour' → "Court of Inquisition of His Majesty Blackthorn!". JAMÁS 'y' ni nombrar presos.
    const dryden = await talkToNpcSequence(page, 19, ["n", "n", "cour"]);
    expect(dryden, "Dryden: la Corte de la Inquisición de Blackthorn").toContain(tr({ en: "Court of Inquisition", es: "Corte de la Inquisición" }));
    cov.mark(npcManifestId("towne", 19));
    cov.mark("command-t"); // (T)alk ejercido (múltiples NPCs)

    // (5) (S)earch de los objetos ocultos de z0 (data.json searchObjects loc 4, floor 0). Cada
    // (S)earch en try/catch: una casilla tras muro (cementerio junto a la cárcel, esquinas) aborta el
    // walkTo y se OMITE sin fallar (subconjunto DETERMINISTA bajo seed-0; política tour honesto>cantidad).
    let searched = 0;
    for (const [x, y, id] of [
      [29, 11, "search-37-loc4-29-11"],
      [22, 26, "search-38-loc4-22-26"],
      [1, 26, "search-39-loc4-1-26"],
      [13, 2, "search-40-loc4-13-2"],
      [14, 2, "search-41-loc4-14-2"],
      [14, 4, "search-42-loc4-14-4"],
      [16, 3, "search-43-loc4-16-3"],
      [18, 2, "search-44-loc4-18-2"],
      [16, 3, "search-45-loc4-16-3"], // 2º objeto en la misma casilla (16,3)
    ] as const) {
      try {
        await faceCommand(page, "s", x, y);
        cov.mark(id);
        searched++;
      } catch {
        /* casilla inalcanzable en esta cadena: se omite */
      }
    }
    if (searched > 0) cov.mark("command-s");

    // (6) Señales de z0 (14, todas floor 0): cementerio (epitafios), patio y entrada. readSign prueba
    // cada lado ALCANZABLE. try/catch → marca sólo las leídas (subconjunto determinista).
    let signsRead = 0;
    for (const [x, y] of [
      [11, 2], [12, 4], [13, 1], [14, 1], [14, 3], [14, 5], [16, 2], [17, 3], [18, 1], [18, 4], // cementerio
      [17, 17], [17, 21], // patio (POLITICAL PRISONERS / Wanted)
      [14, 28], [16, 28], // entrada (BLACKTHORN'S LAW OF JUSTICE)
    ] as const) {
      try {
        if (await readSign(page, x, y)) {
          cov.mark(`sign-4-${x}-${y}`);
          signsRead++;
        }
      } catch {
        /* lado inalcanzable */
      }
    }
    if (signsRead > 0) cov.mark("command-l");

    // (7) [best-effort] SÓTANO z=-1: baja por la escala de mano ((7,26)/(30,1) → z=-1) y sube de
    // vuelta. Ejerce (K)limb REAL y toca `floor-4-z-1`. La sala secreta z=255 (Landon/Jaana) NO se
    // alcanza (componente sentinel no modelado) → NO se intenta. Wrapped: si algo falla, se omite.
    try {
      const down = await climbLadder(page, "down");
      if (down.floor === -1) {
        cov.mark("floor-4-z-1").mark("command-k");
        await climbLadder(page, "up"); // vuelve a z0 (escala recíproca) para un estado de salida limpio
      }
    } catch {
      /* sótano no alcanzable en esta cadena: se omite */
    }

    // (8) Cobertura declarada (política tour: SIN assert duro ≥N; el invariante es DETERMINISMO ×2).

    // ★ BEAT `guard-tribute-paid` + CONTROL DE NO-CÁRCEL (#52). El aserto del importe exacto
    // y del prompt cerrado lo aplica el arnés en CADA pago (`payGuardIfPrompted`); aquí se
    // aserta lo propio de ch08: que hubo pago y que el capítulo NO pasó por la cárcel. Este
    // capítulo es el que tenía el sello ENVENENADO —escrito con el party encarcelado— así
    // que su control no puede ser «salió verde»: se comprueba el MECANISMO.
    const tributos = getTributePayments();
    expect(tributos.length, "el guardia de Yew exige tributo y el party PAGA (beat guard-tribute-paid)").toBeGreaterThan(0);
    const tributoTotal = tributos.reduce((a, t) => a + t.tribute, 0);
    const goldOut = await readNum("gold");
    expect(goldIn - goldOut, "el oro baja EXACTAMENTE la suma de los tributos: sin sumideros ocultos").toBe(tributoTotal);
    // Control de NO-CÁRCEL, por sus dos firmas propias (auditoria-estatica-sellos.md §3):
    // `guardArrestJail` (TOWN 0x12ae) deja al party en la CELDA (25,4) y fuerza el reloj a
    // las 8. Ninguna de las dos puede darse si el tributo se pagó.
    const posOut = await getPos(page);
    expect({ x: posOut.x, y: posOut.y }, "NO en la celda de Yew (25,4): el arresto no ocurrió").not.toEqual({ x: 25, y: 4 });
    expect(await readNum("time.hour"), "el reloj NO se forzó a las 8 (TOWN 0x132b): no hubo cárcel").not.toBe(8);

    cov.note(
      `Yew (loc 4): location+z0 (+z-1 sótano best-effort), NPCs towne. TESTIGOS de contenido byte-` +
        `exactos: Felespar → WORD OF POWER MALUM (dungeon Wrong, word-malum) TRAS PUERTA CON LLAVE ` +
        `(21,6) resuelta por goToCell allowLocked + (J)immy best-DEX; Chamfort → 'Mantra of Justice ` +
        `is BEH'; Jeremy → '500 gold crowns' (⚠NUNCA 'key' → −50 oro/−3 karma); Dryden → 'Court of ` +
        `Inquisition' (rama SEGURA ['n','n','cour']; ⚠NUNCA 'y'/herejía → CallGuards); Mario → 'stocks'; ` +
        `Aleyn → 'Seventh Law of Virtue'; Jerone → 'heresy' (celda B, best-effort); Greymarch → 'Froed' ` +
        `(celda C, best-effort). HORA CANÓNICA 10:00 (presos hora-invariantes; patio siempre z0). ` +
        `GEMAS ${gemsIn}→${gemsOut} (#65). LLAVES ${keysIn}→${keysOut} (tras Felespar: ${keysAfterFelespar}; jimmy exitoso NO gasta llave, ` +
        `game.ts:jimmy rand(0,29) DEX>roll; TRIPWIRE R1 verificado en runtime). Oro ${goldIn}→${goldOut} ` +
        `(TRIBUTO PAGADO ×${tributos.length}, ${tributoTotal} gp = 10 gp × vivos por demanda: el beat ` +
        `guard-tribute-paid, y a la vez el CONTROL DE NO-CÁRCEL de este capítulo — el oro baja en ` +
        `múltiplos EXACTOS del tributo, que es lo que un arresto no haría). Karma ${karmaIn} INALTERADO. ` +
        `⚠ La tienda shop-2-arms-of-justice sigue DIFERIDA, pero YA NO por pobreza: su razón vieja ` +
        `(«Club≈6 inasequible con oro 1») caducó con el pin entryGold de #52 — hoy es alcanzable y se ` +
        `difiere por DECISIÓN de la spec (no se visita), no por el saldo. ` +
        `DIFERIDOS: sala secreta z=255 (Landon dn18 / Jaana dn35) — componente sentinel no modelado por ` +
        `el smallmap (sólo z-1/z0) ni por findNpcAnyFloor (z∈[-1..3]); reclutar Jaana (JoinParty) fuera ` +
        `de alcance (cambiaría el roster/.gam). Searches z0 y señales best-effort (cementerio junto al ` +
        `muro de la cárcel puede quedar tras muro; subconjunto determinista). Comandos e/t/s/l/j(+k si sótano). ` +
        `DISCREPANCIA vs brief: el manifiesto nombra el sótano 'floor-4-z-1' (z real −1), NO 'floor-4-z1'.`,
    );
    const covPath = cov.write();
    const covered = JSON.parse(readFileSync(covPath, "utf8")) as { coveredIds: string[] };
    expect(covered.coveredIds.length).toBeGreaterThan(0);

    // (9) Checkpoint nativo por el camino real. Yew no cambia karma/oro (llaves: ver nota).
    const { gam } = await exportCheckpoint(page, "ch08");
    expect(gam.length).toBe(4192);
    expect(gam[PARTY.location]).toBe(4);
    expect(gam[PARTY.karma]).toBe(karmaIn); // Yew no toca karma (trampas esquivadas)
  });

  test("el ch08.gam exportado es un save NATIVO que el propio port re-importa a idéntico estado", async ({ page }) => {
    await bootWorld(page, { debug: false }); // re-importa sin costura de arnés (task #16)
    const { gam, sidecar } = readCheckpointFiles("ch08");
    await page.evaluate(
      ([bytes, side]) => {
        const t = (window as unknown as { __u5test: { loadNativeSave: (b: number[], s?: unknown) => void } }).__u5test;
        t.loadNativeSave(bytes as number[], side);
      },
      [Array.from(gam), sidecar] as [number[], unknown],
    );
    expect(await getPos(page)).toMatchObject({ location: 4 });
  });
});
