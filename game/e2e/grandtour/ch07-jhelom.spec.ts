/**
 * GRAND TOUR — CAPÍTULO 7: Jhelom (loc 3).
 *
 * Pueblo-fortaleza de 2 plantas (z0/z1) con las 4 torres de esquina particionadas. Su
 * novedad estructural es la primera SALA GATED POR PUERTA CON LLAVE de la cadena: Goeth,
 * el mago demente que enseña la Word of Power INOPIA (dungeon de Destard), vive en la torre
 * NW, a la que sólo se llega CRUZANDO la puerta con llave (5,25) + una escalera-de-pisar +
 * una escala + otra escalera. La nav component-aware lo resuelve con `talkToNpcSequence`
 * ({recoverPartition, allowLocked}) → goToCell planifica la ruta por el grafo (nav-graph #18:
 * puertas 185/187 = aristas CONDICIONALES) y (J)immy la puerta con el miembro de MAYOR DEX.
 *
 * LOS 4 NPCs SON MULTI-PASO (un solo keyword NO basta — verificado contra TOWNE.TLK):
 *   - Goeth(15)   ['drow','drat']            → "Drow of Rewop thou seeketh; remember AIPONI" (INOPIA).
 *   - Bullwier(13)['yes','myst','ambr']      → rumor de las Mystic weapons (Ambrose · towne of Cove).
 *                                              ⚠ JAMÁS 'pati'/'fool' (→ CallGuards / combate).
 *   - Trian(14)   [<AvatarName>,'word','yes']→ "saying each word backwards" (name-gate AskName).
 *   - Thorne(16)  ['y','mant','brit']        → "The Mantra for Valor is RA!" (greeting-Label).
 * Cada uno lleva un TESTIGO DE CONTENIDO DURO (una respuesta equivocada FALLA el capítulo).
 * Corrección de corpus (scout #9): Lord Michael es de Empath Abbey, NO de Jhelom.
 *
 * ORDEN (lección de reloj ch05/ch06): Goeth PRIMERO, con RELOJ FRESCO — es el más caro en
 * navegación (puerta+3 transiciones) y el probe confirmó que hacerlo tras quemar turnos en
 * búsquedas rompe su enganche. Luego los 3 NPCs de patio (component-aware) y, ya de vuelta
 * en z0-main, las (S)earch + la (L)ook de la señal (la puerta abierta amplía lo alcanzable).
 *
 * ECONOMÍA / LLAVES (byte-exacto, fiel a game.ts:jimmy): (J)immy gasta llave SÓLO al FALLAR
 * (rompe la ganzúa); al ÉXITO la conserva. Con el activo de MAYOR DEX el roll acierta a la
 * primera bajo seed-0 → la puerta de Goeth se abre SIN gastar llave: entra 2 llaves, sale 2.
 * Jhelom no ejercita compra/venta (nada del corpus lo exige) ni altera karma (80 heredado).
 *
 * CADENA: re-encadenado sobre `ch06.gam` (Moonglow, sellado en main). HORA CANÓNICA 13:00 —
 * franja DIURNA elegida porque pone a Bullwier/Trian/Thorne en z0 (patio, mismo componente
 * que la entrada) y a Goeth en su sala z1 (la ruta MÁS CORTA a la torre NW; a las 12:00 Goeth
 * baja a la celda z0 sellada y exige una transición extra). Derivada de npcs.json['3'] con el
 * scheduleIndex REAL (time.ts, port de NPC.OVL:0x12E0).
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importCheckpoint, exportCheckpoint, readCheckpointFiles, DEFAULT_ENTRY_GOLD } from "./fixture";
import { bootWorld, signBodyIn, chapterTimeout, enterLocation, faceCommand, talkToNpcSequence, getPos } from "./nav";
import { npcManifestId } from "./npcIds";
import { Coverage } from "./coverage";
import { PARTY } from "./offsets";
import { tr } from "./tourLang";

const JHELOM = 3;
const PREV_CHAPTER = "ch06";

test.describe.serial("GT ch07 — Jhelom (loc 3)", () => {
  test("recorre Jhelom, aprende INOPIA de Goeth (puerta con llave) y exporta el checkpoint", async ({ page }) => {
    // Jhelom recorre 4 NPCs multi-paso + una ruta con puerta con llave y 3 transiciones de
    // planta (Goeth) + búsquedas: nav pesada con re-ruteo ante deambulantes. 300s de techo
    // (como ch05/ch06) da holgura sobre el peor caso sin cambiar el gameplay determinista.
    test.setTimeout(chapterTimeout(300_000));
    await bootWorld(page); // arranque independiente de piel + costura teleportOverworld (task #16)

    // (1) Entrada por checkpoint REAL de ch06 + HORA CANÓNICA 13:00 (ver cabecera) + seed 0.
    await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 13, minute: 0 }, entryGold: DEFAULT_ENTRY_GOLD });
    await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
    const readNum = (expr: string) =>
      page.evaluate((e) => new Function("s", `return s.${e}`)((window as unknown as { __u5test: { state: () => unknown } }).__u5test.state()), expr) as Promise<number>;
    const readStr = (expr: string) =>
      page.evaluate((e) => new Function("s", `return s.${e}`)((window as unknown as { __u5test: { state: () => unknown } }).__u5test.state()), expr) as Promise<string>;
    expect(await readNum("characters[0].intelligence")).toBe(22); // bracket all-A de ch01 (viaja por la cadena)
    const avatarName = await readStr("characters[0].name");

    const cov = new Coverage("ch07");

    // (2) Posicionamiento de arnés + (E)nter REAL.
    const entry = await enterLocation(page, JHELOM);
    expect(entry).toMatchObject({ location: 3, floor: 0 });
    cov.mark("location-3-jhelom").mark("floor-3-z0").mark("command-e");

    // (3) GOETH (15) PRIMERO — reloj fresco. Word of Power INOPIA (Destard). Su torre NW está
    // TRAS la puerta con llave (5,25): recoverPartition+allowLocked → goToCell planifica
    // locked(5,25)→ladder→stair→stair y (J)immy la puerta con el activo de mayor DEX. Habla
    // LITERALMENTE al revés: ['drow','drat'] → Label 0 → "Drow of Rewop thou seeketh; remember
    // <Rune>AIPONI<Rune>" (AIPONI = INOPIA invertido). Testigos DUROS: 'AIPONI' + 'Drow of Rewop'.
    const keysBefore = await readNum("keys");
    expect(keysBefore).toBe(2); // premisa de la cadena ch06 (2 llaves — margen para la puerta)
    // LEÍDOS EN VIVO, no escritos a mano: la nota de cobertura los interpola. La versión
    // anterior afirmaba «oro 1» en prosa fija y el .gam sellado traía 200 — ver la nota.
    const goldIn = await readNum("gold");
    const karmaIn = await readNum("karma");
    const goeth = await talkToNpcSequence(page, 15, ["drow", "drat"], { recoverPartition: true, allowLocked: true });
    expect(goeth, "Goeth revela la Word of Power invertida").toContain("AIPONI");
    expect(goeth, "Goeth: 'Drow of Rewop thou seeketh'").toContain("Drow of Rewop");
    cov.mark(npcManifestId("towne", 15)).mark("word-inopia");
    // La ruta subió a z1 (torre NW) por escalera y ejerció (J)immy + (K)limb reales.
    const afterGoeth = await getPos(page);
    if (afterGoeth.floor === 1) cov.mark("floor-3-z1");
    cov.markAll(["command-j", "command-k"]); // (J)immy la puerta + (K)limb la escala de la ruta
    // LLAVE: (J)immy exitoso NO gasta llave (game.ts:jimmy — sólo rompe al fallar). Con el
    // activo de mayor DEX el roll acierta a la primera bajo seed-0 → llaves 2→2 (tripwire).
    expect(await readNum("keys"), "(J)immy exitoso conserva la llave — comportamiento del PORT (game.ts:jimmy); SIN derivación del binario, no es aserto de fidelidad").toBe(2);

    // (4) Los 3 NPCs de PATIO (z0 a las 13:00), component-aware. Testigos de contenido DUROS.
    // allowLocked:true en los tres: la party queda en la torre NW (z1) tras Goeth y el GRAFO es
    // topología ESTÁTICA (la arista (5,25) sigue siendo 'locked' aunque el mapOverride ya la
    // abrió) → el planificador necesita permiso para RE-CRUZARLA de vuelta al patio. Coste CERO:
    // jimmyDoor ve la puerta ya abierta (isLockedDoor false) y retorna sin gastar llave.
    // Bullwier (13): rumor Mystic weapons. Secuencia SEGURA ['yes','myst','ambr'] — NUNCA
    // 'pati'/'fool' (dispararían <OP:CallGuards>). 'yes' pasa el business-gate (Label 0).
    const bullwier = await talkToNpcSequence(page, 13, ["yes", "myst", "ambr"], { recoverPartition: true, allowLocked: true });
    expect(bullwier, "Bullwier nombra a Ambrose").toContain("Ambrose");
    expect(bullwier, "Bullwier: sanando en la towne of Cove").toContain(tr({ en: "towne of Cove", es: "pueblo de Cove" }));
    cov.mark(npcManifestId("towne", 13));

    // Trian (14): name-gate (AskName) → el PRIMER input debe ser el nombre del Avatar; luego
    // 'word'→Label 0→'yes' → "…saying each word backwards oft is of some help!" (pista de Goeth).
    const trian = await talkToNpcSequence(page, 14, [avatarName, "word", "yes"], { recoverPartition: true, allowLocked: true });
    expect(trian, "Trian: 'saying each word backwards'").toContain("each word backwards");
    cov.mark(npcManifestId("towne", 14));

    // Thorne (16): greeting-Label consume el 1er input ('y'); 'mant'→Label 1 "Who dost thou
    // serve?"→'brit' → "The Mantra for Valor is <Rune>RA<Rune>!".
    const thorne = await talkToNpcSequence(page, 16, ["y", "mant", "brit"], { recoverPartition: true, allowLocked: true });
    expect(thorne, "Thorne enseña la Mantra de Valor").toContain("Mantra for Valor is");
    expect(thorne, "Thorne: la Mantra es RA").toContain("RA");
    cov.mark(npcManifestId("towne", 16));
    cov.mark("command-t"); // (T)alk ejercitado (4 NPCs)

    // (5) (S)earch de los objetos ocultos de z0 (data.json searchObjects loc 3, floor 0). Tras
    // los NPCs de patio la party está en z0-main; la puerta (5,25) quedó ABIERTA (mapOverride
    // 0xB8 = puerta regular) → walkTo puede cruzar al ala oeste. Cada (S)earch en try/catch:
    // una casilla tras muro/otra puerta con llave (esquinas NE/SE) aborta el walkTo y se OMITE
    // sin fallar (subconjunto DETERMINISTA bajo seed-0; política tour-wide honesto>cantidad).
    let searched = 0;
    for (const [x, y, id] of [
      [21, 16, "search-32-loc3-21-16"],
      [20, 10, "search-33-loc3-20-10"],
      [29, 1, "search-34-loc3-29-1"],
      [30, 23, "search-35-loc3-30-23"],
      [1, 29, "search-36-loc3-1-29"],
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

    // (6) Señal de z0: BLACKTHORN'S LAW OF VALOR en (15,28). (L)ook.
    try {
      const log = await faceCommand(page, "l", 15, 28);
      if (signBodyIn(log)) cov.mark("sign-3-15-28").mark("command-l");
    } catch {
      /* lado inalcanzable */
    }

    // (7) Cobertura declarada (política tour-wide: SIN assert duro ≥15; el invariante es
    // DETERMINISMO ×2, no un número fijo).
    const goldOut = await readNum("gold");
    const karmaOut = await readNum("karma");
    cov.note(
      "Jhelom (loc 3): location+z0/z1, 4 NPCs towne multi-paso (13/14/15/16 = Bullwier/Trian/" +
        "Goeth/Thorne). TESTIGOS de contenido byte-exactos: Goeth → WORD OF POWER INOPIA " +
        "('Drow of Rewop'+'AIPONI', word-inopia) TRAS PUERTA CON LLAVE (5,25) resuelta por " +
        "goToCell allowLocked + (J)immy best-DEX; Bullwier → Ambrose/'towne of Cove' (rumor " +
        "Mystic weapons; NUNCA pati/fool → CallGuards); Trian → 'each word backwards' (name-gate); " +
        "Thorne → 'Mantra for Valor is RA' (greeting-Label). HORA CANÓNICA 13:00 (diurna: patio " +
        "en z0, Goeth en z1 = ruta más corta). LLAVES 2→2 (jimmy exitoso NO gasta llave, fiel a " +
        `game.ts; roll best-DEX acierta a la 1ª bajo seed-0). Oro ${goldIn}→${goldOut} · Karma ` +
        `${karmaIn}→${karmaOut} INALTERADOS (Jhelom no ejercita economía ni afecta karma). ` +
        "⚠ CORREGIDO en la auditoría final (01-08): esta nota decía «Karma 80 y oro 1 " +
        "INALTERADOS» y el .gam sellado trae oro 200 — la cifra «1» caducó con el pin " +
        "entryGold=DEFAULT_ENTRY_GOLD (#52) y la contradicción era SILENCIOSA por partida " +
        "doble: el orden invertido («karma … y oro …») no casaba con ninguno de los patrones " +
        "que parsea el detector de auditoria-estatica-sellos.md, así que ni salía en el " +
        "denominador. Ahora las dos cifras se LEEN EN VIVO e interpolan, en el formato " +
        "`CAMPO a→b` que sí se parsea: no puede volver a divergir del sello. " +
        "Búsquedas z0 best-effort (esquinas NE/SE " +
        "tras otras puertas con llave quedan fuera; subconjunto determinista). Comandos e/t/s/l/j/k. " +
        "Corrección de corpus: Lord Michael es de Empath Abbey, no de Jhelom.",
    );
    const covPath = cov.write();
    const covered = JSON.parse(readFileSync(covPath, "utf8")) as { coveredIds: string[] };
    expect(covered.coveredIds.length).toBeGreaterThan(0);

    // (8) Checkpoint nativo por el camino real. Jhelom no cambia karma/oro/llaves.
    const { gam } = await exportCheckpoint(page, "ch07");
    expect(gam.length).toBe(4192);
    expect(gam[PARTY.location]).toBe(3);
    expect(gam[PARTY.karma]).toBe(80); // heredado de ch06 (75 ch04 + 5 Fenelon), Jhelom no lo toca
  });

  test("el ch07.gam exportado es un save NATIVO que el propio port re-importa a idéntico estado", async ({ page }) => {
    await bootWorld(page, { debug: false }); // re-importa sin costura de arnés (task #16)
    const { gam, sidecar } = readCheckpointFiles("ch07");
    await page.evaluate(
      ([bytes, side]) => {
        const t = (window as unknown as { __u5test: { loadNativeSave: (b: number[], s?: unknown) => void } }).__u5test;
        t.loadNativeSave(bytes as number[], side);
      },
      [Array.from(gam), sidecar] as [number[], unknown],
    );
    expect(await getPos(page)).toMatchObject({ location: 3 });
  });
});
