/**
 * GRAND TOUR — CAPÍTULO 5: Minoc (loc 5).
 *
 * Pueblo de artesanos/mineros de dos plantas (z0/z1). Ejercita el patrón data-only sobre
 * un town con NPCs de HORARIO que deambulan ENTRE PLANTAS (Tactus/Fiona y los 3 mercaderes
 * suben a z1 en parte de su agenda) — por eso usa el (T)alk FLOOR-AWARE de nav.ts
 * (findNpcAnyFloor + goToFloor). Repite la ECONOMÍA byte-exacta de ch03: una COMPRA real en
 * la herrería (Darkwatch Armoury, dialog 0x81) cobra el precio derivado de la INTELIGENCIA
 * del Avatar (SHOPPES.OVL: base + ⌊base·(100−3·INT)/100⌋); el oro baja EXACTAMENTE eso.
 *
 * Minoc es corpus-relevante: Fiona (dialog 26) enseña AVIDUS (la Word of Power del dungeon de
 * Covetous) — aquí se APRENDE por el mecanismo real (talkToNpcSequence) y se marca word-avidus.
 *
 * TESTIGOS DE CORPUS (helpers talkToNpcAsking / talkToNpcSequence; facts npc-minoc-* de
 * corpus.json). Además de la cobertura de enganche se aseveran contenidos/efectos byte-exactos
 * DUROS (un valor equivocado FALLA el capítulo):
 *   - CONTENIDO (talkToNpcAsking): Tactus (25) 'job'→"Darkwatch Armoury"; Rew (27) 'moth'→"Her
 *     name is Fiona…"; Lady Sahra (29) 'sick'→"…have returned!".
 *   - WORD OF POWER (talkToNpcSequence, PRIMERO con reloj fresco + recoverPartition): Fiona (26)
 *     ['n','grea','anno',NOMBRE,'word'] → "…Covetous is AVIDUS!" → marca word-avidus.
 *   - KARMA (talkToNpcSequence): Fenelon (28) ['wond',NOMBRE] → KarmaPlusOne×5 → DELTA +5
 *     byte-exacto; ripple sancionado karma 75→80 en el checkpoint.
 * DIFERIDO (declarado, no perdido — ver cov.note): la PISTA PAGADA de Delwyn (Shenstone). Su
 * TLK la puerta tras name-gate: cuesta 2 visitas / 6 oro reales (no los 3 que se asumían), lo
 * que exige vaciar el stock de Flaming Oil y sube el coste de reloj — decisión económica del
 * lead. Delwyn se cubre aquí por ENGANCHE (npc-towne-30-delwyn), sin pagar.
 *
 * Cadena (SECUENCIA REAL ch03→ch04→ch05): importa el checkpoint del capítulo anterior →
 * posicionamiento de arnés → (E)nter REAL de Minoc → recorrido por mecanismos reales
 * ((T)alk con 6 vecinos · compra byte-exacta en la herrería · (S)earch en z0 y z1 · (L)ook
 * de las señales · (K)limb a z1) + los COMANDOS A-Z ejercitados (e/t/s/l/k). Marca TODO lo
 * real del manifiesto (documentado con cov.note; política tour-wide: sin assert duro ≥15, lo
 * exigido es DETERMINISMO ×3). Exporta ch05.{gam,sidecar}.
 *
 * RE-ENCADENADO: arranca del checkpoint REAL de ch04 (Trinsic, aterrizado en main);
 * `PREV_CHAPTER = "ch04"`. ECONOMÍA VÍA A (sancionada): ch04 deja 50 oro y el Short Sword cuesta
 * 53 (INT 22) → déficit 3, cubierto GANANDO el oro DENTRO del capítulo (venta real de 1 Flaming
 * Oil, +4) ANTES de comprar. Las aserciones leen el saldo VIVO y comprueban el DELTA byte-exacto;
 * saldo de salida documentado = 1 oro. Karma de salida = 80 (75 + bondad a Fenelon).
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importCheckpoint, exportCheckpoint, readCheckpointFiles } from "./fixture";
import { bootWorld, signBodyIn, chapterTimeout, enterLocation, faceCommand, goToFloor, talkToNpc, talkToNpcAsking, talkToNpcSequence, buyFromShop, sellFromShop, getPos, type Pos } from "./nav";
import { npcManifestId } from "./npcIds";
import { Coverage } from "./coverage";
import { PARTY } from "./offsets";
import { tr } from "./tourLang";

const MINOC = 5;
const BLACKSMITH = 0x81; // Darkwatch Armoury (shop-3-darkwatch-armoury)

// El checkpoint de ENTRADA. RE-ENCADENADO al ch04 REAL (Trinsic, aterrizado en main).
const PREV_CHAPTER = "ch04";

// Herrería de Minoc (blacksmithStock townIndex 3 = weaponsSoldByMerchants[3]). El Short
// Sword es equipId 23, base 40 (data.json:equipmentBasePrices[23]); a INT 22 (bracket all-A
// de ch01, que viaja por la cadena) el precio de compra es 53. Se recalcula del INT VIVO.
const SHORT_SWORD_BASE = 40;
const buyPrice = (base: number, int: number): number => base + Math.trunc((base * (100 - 3 * int)) / 100);

test.describe.serial("GT ch05 — Minoc (loc 5)", () => {
  test("recorre Minoc (2 plantas), compra byte-exacta en la herrería, y exporta el checkpoint", async ({ page }) => {
    // Minoc recorre 6 NPCs de horario + 2 plantas: el BFS de nav re-rutea ante NPCs
    // DEAMBULANTES, así que el tiempo de recorrido es MUY variable (≈50s a ≈175s según la
    // carga de la máquina y la posición errante). El techo de 180s dejaba margen nulo en las
    // corridas lentas (timeout-flake: "1 failed / 1 did not run"). 300s da holgura ×1.7 sobre
    // el peor caso observado sin cambiar nada del gameplay (la salida sigue byte-idéntica).
    test.setTimeout(chapterTimeout(300_000));
    await bootWorld(page); // arranque independiente de piel + costura teleportOverworld (task #16)

    // (1) Entrada por checkpoint REAL del capítulo anterior (+ normaliza el stream a seed 0).
    // HORA CANÓNICA DECLARADA (arnés B'): 22:54 = hora NATIVA a la que está afinado este capítulo
    // (salida original de ch04). ch05 fue sellado de NOCHE y su lógica (herrería de Minoc, Fiona,
    // deambulantes) está tuneada a esa hora; el pin la reproduce y la ANULA la deriva del predecesor.
    await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 22, minute: 54 } });
    await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
    const readNum = (expr: string) =>
      page.evaluate((e) => new Function("s", `return s.${e}`)((window as unknown as { __u5test: { state: () => unknown } }).__u5test.state()), expr) as Promise<number>;
    const int = await readNum("characters[0].intelligence");
    expect(int).toBe(22); // el bracket all-A de ch01 viajó por la cadena

    const cov = new Coverage("ch05");

    // (2) Posicionamiento de arnés + (E)nter REAL.
    const entry = await enterLocation(page, MINOC);
    expect(entry).toMatchObject({ location: 5, floor: 0 });
    cov.mark("location-5-minoc").mark("floor-5-z0").mark("command-e"); // (E)nter ejercitado
    let talked = 0;

    // (3) WORD OF POWER — Fiona (26) enseña AVIDUS (dungeon de Covetous). Se hace PRIMERO, con
    // el RELOJ FRESCO recién entrado: Fiona deambula a z1 (planta particionada) y el chase
    // component-aware (recoverPartition) la alcanza barato al inicio (~15s), pero a un reloj ya
    // avanzado por otros diálogos su vagabundeo la vuelve carísima de perseguir. Su TLK entra
    // por la oferta de comida (Label 1: "in dire need of food?") → hay que DECLINAR ('n') para
    // volver al prompt de keywords, y de ahí la cadena 'grea'(Great Council) → 'anno'(la manda
    // Annon) → NOMBRE (AskName) → 'word' → "…Covetous is AVIDUS!". Enganche blando; contenido DURO.
    let fionaResp: string | null = null;
    try {
      fionaResp = await talkToNpcSequence(page, 26, ["n", "grea", "anno", "Avatar", "word"], { recoverPartition: true });
    } catch {
      fionaResp = null; /* Fiona inenganchable en esta cadena: se omite (declarado) */
    }
    if (fionaResp !== null) {
      expect(fionaResp, "Fiona debe enseñar la Word of Power").toContain("AVIDUS");
      expect(fionaResp, "Fiona: dungeon de Covetous").toContain("Covetous");
      cov.mark(npcManifestId("towne", 26)).mark("word-avidus");
      talked++;
    }

    // (3a) TESTIGOS DE CONTENIDO byte-exacto (z0, talkToNpcAsking, keyword→respuesta). Cada
    // enganche va en try/catch: un NPC deambulante puede quedar inenganchable en ESTA cadena
    // (determinista bajo seed-0); se marca sólo el que engancha. Si engancha, el aserto de
    // CONTENIDO es DURO (una respuesta equivocada FALLA el capítulo — testigo falsable).
    const witness: Record<number, { keyword: string; contains: string }> = {
      25: { keyword: "job", contains: "Darkwatch Armoury" }, //  Tactus: job = armourer de Darkwatch
      27: { keyword: "moth", contains: tr({ en: "Her name is Fiona", es: "Se llama Fiona" }) }, // Rew: cadena Annon→Rew→Fiona
      29: { keyword: "sick", contains: tr({ en: "have returned", es: "han vuelto" }) }, //     Lady Sahra: 'The plagues… have returned!'
    };
    for (const dn of [25, 27, 29]) {
      let resp: string | null = null;
      try {
        resp = await talkToNpcAsking(page, dn, witness[dn]!.keyword);
      } catch {
        continue; /* inenganchable en esta cadena: se omite sin marcar */
      }
      expect(resp, `testigo npc ${dn} keyword '${witness[dn]!.keyword}'`).toContain(witness[dn]!.contains);
      cov.mark(npcManifestId("towne", dn));
      talked++;
    }

    // (3b) Delwyn (30): cobertura de ENGANCHE (sin pagar). 'job' cae en su Label de mendicidad
    // y se cierra con "bye" — NO se paga oro. La pista de Shenstone (Gold gate) queda diferida
    // (ver cov.note: su coste real son 2 visitas / 6 oro, no encaja con el saldo del capítulo).
    try {
      await talkToNpc(page, 30);
      cov.mark(npcManifestId("towne", 30));
      talked++;
    } catch {
      /* inenganchable: se omite */
    }

    // (3c) TESTIGO DE KARMA (el más falsable): Fenelon (28) da +5 karma al mostrarle bondad. Su
    // TLK es multi-paso (Label 0 → AskName → Label 1 = KarmaPlusOne×5): keyword 'wond' + NOMBRE
    // del Avatar. Enganche blando; asertos DUROS (contenido 'kindness' + DELTA de karma == +5).
    // Ripple DOCUMENTADO y sancionado: karma 75→80 en el checkpoint.
    let karmaBefore = 0;
    let fenelonResp: string | null = null;
    try {
      karmaBefore = await readNum("karma");
      fenelonResp = await talkToNpcSequence(page, 28, ["wond", "Avatar"]);
    } catch {
      fenelonResp = null;
    }
    if (fenelonResp !== null) {
      expect(fenelonResp, "Fenelon debe reconocer bondad (AskName)").toContain("kindness");
      const karmaAfter = await readNum("karma");
      expect(karmaAfter - karmaBefore, "Fenelon Label 1 = KarmaPlusOne×5").toBe(5);
      cov.mark(npcManifestId("towne", 28));
      talked++;
    }

    if (talked > 0) cov.mark("command-t"); // (T)alk ejercitado

    // (4) ECONOMÍA byte-exacta con VÍA A (ganar el oro DENTRO del capítulo, sancionada por el
    // lead). ch04 (Trinsic) deja 50 oro; el Short Sword cuesta buyPrice(40,INT)=53 (>50) →
    // déficit de 3. Se cubre con una VENTA REAL y determinista ANTES de comprar: vender 1
    // Flaming Oil (equipId 19, base 5, se poseen 3 en el checkpoint de ch04) rinde
    // equipmentSellPrice(5,22)=⌊3·22·5/100⌋+1=4. La herrería de Minoc COMPRA cualquier equipo
    // con base>0 (shop.ts); Flaming Oil es PRESCINDIBLE (consumible, quedan 2; no lo exige
    // ningún capítulo posterior — el corpus sólo lo lista como STOCK de Jhelom, no como
    // retención de party). Saldo de la cadena: 50 → (venta +4) 54 → (compra −53) 1.
    const expectedBuy = buyPrice(SHORT_SWORD_BASE, int);
    expect(expectedBuy).toBe(53); // literal de la derivación (regresión del cálculo a INT 22)
    const SELL_PRICE = 4; // equipmentSellPrice(5, 22) = ⌊3·22·5/100⌋+1 = 4 (re/verified/shops.md)
    const goldStart = await readNum("gold");
    expect(goldStart).toBe(50); // premisa de la cadena SELLADA ch04 (Trinsic) — tripwire

    // VENTA real: sube el oro EXACTAMENTE el precio de venta (ingreso byte-exacto).
    await sellFromShop(page, BLACKSMITH, "Flaming Oil");
    const goldAfterSell = await readNum("gold");
    expect(goldAfterSell - goldStart).toBe(SELL_PRICE); // +4 por la venta
    cov.mark("shop-3-darkwatch-armoury");

    // COMPRA real: baja el oro EXACTAMENTE el precio de compra derivado del INT vivo.
    await buyFromShop(page, BLACKSMITH, `Short Sword — ${expectedBuy} gp`);
    const goldExit = await readNum("gold");
    expect(goldAfterSell - goldExit).toBe(expectedBuy); // −53 por la compra
    // SALDO DE SALIDA DE ch05 (DOCUMENTADO para que ch06+ hereden cifra conocida): 1 oro.
    expect(goldExit).toBe(1);

    // (5) (S)earch de los objetos ocultos de la planta baja (data.json searchObjects, loc 5,
    // floor 0). Cada (S)earch va en try/catch: una casilla tras muro/inalcanzable hace que
    // walkTo aborte (rápido con la nav de ch03) y lance; se omite sin fallar el capítulo.
    let searched = 0;
    for (const [x, y, id] of [
      [2, 2, "search-14-loc5-2-2"],
      [27, 8, "search-48-loc5-27-8"],
    ] as const) {
      try {
        await faceCommand(page, "s", x, y);
        cov.mark(id);
        searched++;
      } catch {
        /* casilla inalcanzable: se omite */
      }
    }

    // (6) Señales de la planta baja: (L)ook. Marca las que se leen (determinista seed-0).
    // (20,14) "MISSION OF …" · (14,28)/(16,28) "BLACKTHORN'S". try/catch por si la plaquita
    // no es alcanzable desde ningún lado abierto.
    let looked = 0;
    for (const [x, y, id] of [
      [20, 14, "sign-5-20-14"],
      [14, 28, "sign-5-14-28"],
      [16, 28, "sign-5-16-28"],
    ] as const) {
      try {
        const log = await faceCommand(page, "l", x, y);
        looked++;
        if (signBodyIn(log)) cov.mark(id);
      } catch {
        /* señal inalcanzable desde ningún lado abierto: se omite */
      }
    }
    if (looked > 0) cov.mark("command-l"); // (L)ook ejercitado

    // (7) (K)limb a la planta 1 + sus objetos ocultos (data.json searchObjects, loc 5, z1).
    // z1 está PARTICIONADA: la escalera por defecto y el reloj (avanzado por los diálogos
    // multi-paso) determinan en qué componente se aterriza. reachTarget (8,21) fuerza la
    // transición COMPONENT-AWARE al cluster de búsquedas alcanzable (51/52/53), robusto al
    // coste de reloj de los testigos — recupera las 3 que el trade-off de Fenelon desplazaba.
    const p: Pos = await goToFloor(page, 1, { x: 8, y: 21 });
    expect(p.floor).toBe(1);
    cov.mark("floor-5-z1").mark("command-k"); // (K)limb ejercitado
    for (const [x, y, id] of [
      [13, 11, "search-49-loc5-13-11"],
      [12, 11, "search-50-loc5-12-11"],
      [8, 21, "search-51-loc5-8-21"],
      [8, 23, "search-52-loc5-8-23"],
      [7, 23, "search-53-loc5-7-23"],
    ] as const) {
      try {
        await faceCommand(page, "s", x, y);
        cov.mark(id);
        searched++;
      } catch {
        /* casilla inalcanzable: se omite */
      }
    }
    if (searched > 0) cov.mark("command-s"); // (S)earch ejercitado (z0 y/o z1)

    // (8) Cobertura: marca TODO lo real y documenta el conteo con cov.note (política
    // tour-wide: SIN assert duro ≥15; lo que se exige es DETERMINISMO ×3).
    cov.note(
      "Minoc (loc 5): location+z0/z1, 6 NPCs towne (25/26/27/28/29/30 = Tactus/Fiona/Rew/Fenelon/" +
        "Lady Sahra/Delwyn). TESTIGOS byte-exactos: contenido (Tactus 'job'→Darkwatch Armoury, " +
        "Rew 'moth'→Fiona, Lady Sahra 'sick'→'have returned'); WORD OF POWER (Fiona → AVIDUS/" +
        "Covetous, word-avidus, con recoverPartition a reloj fresco); KARMA (Fenelon +5, delta " +
        "byte-exacto, ripple karma 75→80). Señales, search z0 + z1 (cluster 51/52/53 vía goToFloor " +
        "component-aware reachTarget, robusto al coste de reloj). ECONOMÍA VÍA A: venta real de 1 " +
        "Flaming Oil (+4) + compra byte-exacta del Short Sword (−53); saldo de salida DOCUMENTADO " +
        "= 1 oro. Comandos e/t/s/l/k. DIFERIDO (declarado): la PISTA PAGADA de Delwyn (Shenstone) — " +
        "su TLK la puerta tras name-gate → cuesta 2 visitas / 6 oro (no 3), exige vaciar Flaming " +
        "Oil y sube el coste de reloj; decisión económica del lead. Delwyn se cubre por enganche.",
    );
    const covPath = cov.write();
    const covered = JSON.parse(readFileSync(covPath, "utf8")) as { coveredIds: string[] };
    expect(covered.coveredIds.length).toBeGreaterThan(0);

    // (9) Checkpoint nativo por el camino real. Refleja Minoc, el oro gastado y el +5 karma.
    const { gam } = await exportCheckpoint(page, "ch05");
    expect(gam.length).toBe(4192);
    expect(gam[PARTY.location]).toBe(5);
    expect(gam[PARTY.karma]).toBe(80); // 75 (ch04) + 5 (bondad a Fenelon) — ripple documentado
  });

  test("el ch05.gam exportado es un save NATIVO que el propio port re-importa a idéntico estado", async ({ page }) => {
    await bootWorld(page, { debug: false }); // re-importa sin costura de arnés (task #16)

    const { gam, sidecar } = readCheckpointFiles("ch05");
    await page.evaluate(
      ([bytes, side]) => {
        const t = (window as unknown as { __u5test: { loadNativeSave: (b: number[], s?: unknown) => void } }).__u5test;
        t.loadNativeSave(bytes as number[], side);
      },
      [Array.from(gam), sidecar] as [number[], unknown],
    );
    expect(await getPos(page)).toMatchObject({ location: 5 });
  });
});
