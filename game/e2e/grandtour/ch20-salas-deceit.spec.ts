/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2 — ch20-salas-deceit: CAPÍTULO PLANTILLA de conquista de TODAS las salas de una
 * mazmorra (Deceit, loc 33). Prueba de que el patrón «lista de salas + conquerRoomAt» escala.
 *
 * Entra por la CIMA (enterDungeon(33) → floor 0), siembra el loadout ranged (Magic Bow +
 * Ring invis, mejor caso #47), y conquista las 16 salas EN ORDEN DE PLANTA con `conquerRoomAt`
 * (que desciende con el pather + pisa placas). Cada sala → veredicto {VICTORY|DEADEND|FAIL} +
 * covered `room-deceit-<roomNo>`. DEADEND se documenta con cita; FAIL es rojo investigable.
 *
 * NOTA: este primer montaje MIDE hasta dónde llega la navegación genérica (descenso vs
 * salto intra-planta, salas de entrada por foso/escalera) — las "sorpresas de navegación"
 * que el lead pidió medir. El aserto final se calibra al resultado real (no se fabrica).
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, enterDungeon, conquerRoomAt, type DFacing } from "./nav";

const PREV_CHAPTER = "ch13";
const DECEIT = 33;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;

// Las 16 salas de Deceit (dungeons.json type 0xF), roomNo = sub&0xF, combatmap = 16+roomNo.
// approachDir DERIVADO del vecino-pasaje (dungeons.json); null = sin approach ortogonal limpio
// (entrada por foso/escalera — a investigar). Orden por planta para descender sin cruzar salas.
const ROOMS: Array<{ floor: number; x: number; y: number; roomNo: number; approachDir: DFacing | null }> = [
  { floor: 1, x: 5, y: 3, roomNo: 0, approachDir: null },
  { floor: 1, x: 5, y: 7, roomNo: 1, approachDir: "north" },
  { floor: 2, x: 1, y: 1, roomNo: 2, approachDir: null },
  { floor: 4, x: 5, y: 7, roomNo: 3, approachDir: "north" },
  { floor: 5, x: 1, y: 1, roomNo: 4, approachDir: "east" },
  { floor: 5, x: 1, y: 5, roomNo: 5, approachDir: "north" },
  { floor: 5, x: 7, y: 3, roomNo: 6, approachDir: "south" },
  { floor: 5, x: 7, y: 7, roomNo: 7, approachDir: "west" },
  { floor: 6, x: 4, y: 3, roomNo: 8, approachDir: "south" },
  { floor: 6, x: 7, y: 5, roomNo: 9, approachDir: null },
  { floor: 7, x: 1, y: 3, roomNo: 10, approachDir: "north" },
  { floor: 7, x: 7, y: 4, roomNo: 11, approachDir: "south" },
  { floor: 7, x: 0, y: 4, roomNo: 12, approachDir: "west" },
  { floor: 7, x: 7, y: 5, roomNo: 13, approachDir: "north" },
  { floor: 7, x: 0, y: 5, roomNo: 14, approachDir: "west" },
  { floor: 7, x: 7, y: 7, roomNo: 15, approachDir: "south" },
];

async function seedLoadout(page: Page): Promise<void> {
  await page.evaluate(
    ([bow, ring, arrows]) => {
      const st = (window as unknown as { __u5test: { game: { state: any } } }).__u5test.game.state;
      for (let i = 0; i < st.partySize; i++) {
        const c = st.characters[i];
        if (!c) continue;
        c.level = 8; c.maxHp = 240; c.currentHp = 240; c.strength = 30; c.dexterity = 30; c.intelligence = 30;
        c.status = "G"; c.weapon = bow; c.ring = ring; c.currentMp = 99;
      }
      st.equipmentQuantities[arrows] = 255;
      st.lightSpellMins = 9999;
      // Des Por (spell 22) mezclado + reactivos + MP: el DESCENSO por plantas medias de
      // Deceit NO tiene ruta física (ch14/ch18 sí; Deceit no) → el pather usa Des Por
      // (descenso mágico), y sin el hechizo mezclado el cast falla en silencio y el arnés
      // se atasca. Causa TRAZADA en el 1er montaje. Un jugador desciende Deceit con Des Por.
      st.spellQuantities[22] = 99;
      for (let i = 0; i < st.reagentQuantities.length; i++) st.reagentQuantities[i] = 99;
    },
    [MAGIC_BOW, RING_INVIS, ARROWS] as const,
  );
}

/**
 * RE-READY POR SALA (re-diseño post-#36; bisect re/notes/grandtour-salas-bisect.md §3).
 * La ficha #36 hizo FIEL el desequipado por munición agotada: cuando el pool común llega
 * EXACTAMENTE a 0, el barrido es del PARTY ENTERO por id de arma (SJOG 0x1b34: bucle
 * `si < g_party_size` sobre `unequip_item` ULTIMA.EXE 0x6e60, acta re/notes/municion-36-acta.md).
 * La PREMISA de siembra de este spec (Magic Bow 0x24 en toda la party + pool común de 99
 * flechas para la cadena ENTERA) era frágil ante esa conducta: el primer agotamiento desarmaba
 * a los 6 y las salas TARDÍAS de la cadena caían a DEADEND/THROW con la party a manos desnudas
 * (medido: 10/12/14). El re-diseño repone y re-equipa ANTES de cada sala — costura de ARNÉS de
 * la misma clase #47 que seedLoadout (estado test-only, cero cambio de core, cero RNG: la
 * cadena de munición no consume RNG, acta #36 §6) — de modo que el cruce pool-exacto-0 no se
 * alcanza y el spec sigue ejercitando lo mismo: conquista ranged sala a sala. 255 = techo del
 * byte (el add de reposición del binario es byte pelado mod 256, COMSUBS 0x09ab). HP/anillos/
 * posición NO se tocan: la dinámica inter-sala del descenso se conserva.
 */
async function rearmParty(page: Page): Promise<void> {
  await page.evaluate(
    ([bow, arrows]) => {
      const st = (window as unknown as { __u5test: { game: { state: any } } }).__u5test.game.state;
      for (let i = 0; i < st.partySize; i++) {
        const c = st.characters[i];
        if (c) c.weapon = bow;
      }
      st.equipmentQuantities[arrows] = 255;
    },
    [MAGIC_BOW, ARROWS] as const,
  );
}

/** Corre la conquista de Deceit una vez; devuelve el mapa roomNo→outcome (digest ordenado). */
async function runDeceit(page: Page): Promise<{ digest: string; outcomes: Record<number, string> }> {
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  const entry = await enterDungeon(page, DECEIT);
  expect(entry, "entra a Deceit por la cima (floor 0)").toMatchObject({ dungeon: DECEIT, floor: 0 });

  // TOPOLOGÍA MEDIDA (ch20, pasada de CIMA): las plantas de Deceit se dividen en BOLSILLOS
  // que un solo descenso NO conecta (conquistar una sala VARA a la party en su bolsillo).
  // - 1,3: approach (5,0) inalcanzable desde la cima.
  // - 11,13,15: bolsillo (7,x) de floor7, separado del bolsillo (1,3)/(0,x) que sí cae en
  //   la pasada de cima (10,12,14). 13,15 además sólo se entran por el FONDO (Underworld).
  // ⇒ un capítulo por-mazmorra necesita VARIAS PASADAS/ENTRADAS (cima + fondo + por-bolsillo).
  // Esta es la PASADA 1 (cima): conquista/censa el bolsillo alcanzable. El resto es la COLA
  // FORMAL `PENDIENTE-entrada` (Fase 2b) — cada sala su mini-carril de entrada; ver el censo
  // (docs/guias/doom/CENSO-COMBATMAPS.md) y docs/plan-tour-salas.md §Fase 2b. El 100% sigue trackeado.
  // [HISTÓRICO 2026-07-25: Fase 2b CERRADA — 112/112 selladas (main 76fb75c9); la cola
  //  PENDIENTE-entrada de arriba se resolvió en capítulos posteriores (ver CENSO-COMBATMAPS.md,
  //  registro por sala). Este spec queda como pasada-1 histórica; sus SKIP siguen siendo fieles
  //  a lo que esta pasada mide.]
  const PASS2 = new Set([1, 3, 11, 13, 15]); // PENDIENTE-entrada: fondo (13,15) + bolsillo (11) + muradas (1,3)
  const outcomes: Record<number, string> = {};
  for (const r of ROOMS) {
    if (r.approachDir === null) { outcomes[r.roomNo] = "SKIP-pend-entrada-foso"; continue; } // 0,2,9 escalera/foso
    if (PASS2.has(r.roomNo)) { outcomes[r.roomNo] = "SKIP-pend-entrada-2b"; continue; }
    try {
      await rearmParty(page); // re-diseño post-#36: el pool nunca llega al cruce exacto-0
      const v = await conquerRoomAt(page, { roomCell: { floor: r.floor, x: r.x, y: r.y }, approachDir: r.approachDir, maxRounds: 600 });
      outcomes[r.roomNo] = v.outcome;
    } catch (e) {
      outcomes[r.roomNo] = `THROW:${(e as Error).message.slice(0, 40)}`;
    }
  }
  const digest = ROOMS.map((r) => `${r.roomNo}:${outcomes[r.roomNo]}`).join("|");
  return { digest, outcomes };
}

test.describe.serial("FASE 2 — ch20 salas de Deceit (plantilla)", () => {
  test("conquista/censa las 16 salas de Deceit por planta (MIDE la navegación genérica)", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const t0 = Date.now();
    const { digest, outcomes } = await runDeceit(page);
    const secs = Math.round((Date.now() - t0) / 1000);
    // Reporta el resultado real (no fabrica): cuántas VICTORY/DEADEND/otros + duración.
    const tally = Object.values(outcomes).reduce<Record<string, number>>((a, o) => ((a[o] = (a[o] ?? 0) + 1), a), {});
    console.log(`[ch20-deceit] ${secs}s outcomes=${JSON.stringify(tally)}`);
    console.log(`[ch20-deceit] digest=${digest}`);
    // Diagnóstico de EJECUCIÓN: las salas alcanzables desde la cima NO deben lanzar
    // (THROW) ni FAIL — si conquistan (VICTORY/DEADEND/DEADEND-STUCK) el patrón
    // lista+conquerRoomAt funciona para la topología alcanzable. Las bottom-only y foso
    // quedan para 2ª pasada.
    // RE-SELLO (arnés progreso+DEADEND-STUCK, ruling A del lead): la sala 14 (combatmap 30)
    // pasó de DEADEND a **DEADEND-STUCK** — SIEMPRE fue un bolsillo emparedado sin huida, pero
    // el fleeCombat antiguo (void) la etiquetaba DEADEND y su estado atascado quedaba oculto
    // (es la ÚLTIMA sala atacada; la 15 es SKIP → no contaminaba). El arnés nuevo lo hace
    // EXPLÍCITO. DEADEND-STUCK es outcome VÁLIDO de pasada-1 (sala sellada irresoluble+sin
    // huida) — mismo hallazgo de fidelidad que Wrong #51; no fabrica salida ni banca victoria.
    // ⚠ PROSA CADUCADA, CORREGIDA EN LA VENTANA #164 (2026-07-29): el párrafo de arriba es
    // HISTÓRICO. La sala 14 **hoy mide VICTORY**, y lo mide desde al menos `ffe5ba19` (24-07),
    // que es el SUELO del instrumento de bisección (por debajo, el arnés llama a
    // `ds.wandererAt` y el core viejo no la tiene). O sea: el paso DEADEND-STUCK → VICTORY es
    // ANTERIOR a la ventana medible y queda SIN ATRIBUIR — no se le puede colgar a ningún
    // commit con este método. Nadie lea el párrafo histórico como el estado actual: el estado
    // actual es el PIN de abajo. Que esto sobreviviera es la razón de ser de la tarjeta #164.
    const attempted = ROOMS.filter((r) => !outcomes[r.roomNo]!.startsWith("SKIP"));
    const bad = attempted.filter((r) => !["VICTORY", "DEADEND", "DEADEND-STUCK"].includes(outcomes[r.roomNo]!));
    expect(bad.map((r) => `${r.roomNo}:${outcomes[r.roomNo]}`), "PASADA 1 (cima): salas del bolsillo alcanzable conquistadas/selladas").toEqual([]);
    // La pasada de cima debe cubrir el bolsillo alcanzable (8 salas: 4,5,6,7,8,10,12,14).
    expect(attempted.length, "8 salas en la pasada de cima").toBe(8);

    // ★ PIN POR SALA (tarjeta #164, ventana 2026-07-29). ANTES este bloque sólo comprobaba
    // (a) que cada sala cayera DENTRO del conjunto aceptado {VICTORY,DEADEND,DEADEND-STUCK}
    // y (b) el RECUENTO — así que un flip VICTORY↔DEADEND pasaba EN VERDE. El test de
    // determinismo tampoco protegía: compara la pasada B con la A **de la misma corrida**,
    // o sea prueba determinismo, NO estabilidad contra un sello. Resultado: este capítulo
    // llevaba sin poder detectar una deriva de veredicto desde que existe.
    // BASELINE MEDIDO (no veredicto de fidelidad) y ESTABLE en los tres puntos del
    // instrumento: ffe5ba19 (suelo, 24-07), 13b46ee6 y HEAD dan el MISMO digest.
    // ★ PROCEDENCIA POST-#36 (bisect re/notes/grandtour-salas-bisect.md §3, 22-08): estos
    // MISMOS pines se rompieron en `0b7d020a` (#36, barrido fiel del party al agotar el pool
    // — 10/12/14 caían a DEADEND con la party desarmada). El RE-DISEÑO del loadout
    // (rearmParty por sala, arriba) evita el cruce exacto-0 y RESTAURA el baseline medido:
    // los pines NO se adaptaron — se re-midieron y salieron IDÉNTICOS a los de julio.
    const byOutcome = (o: string) => ROOMS.map((r) => r.roomNo).filter((n) => outcomes[n] === o).sort((a, b) => a - b);
    expect(byOutcome("VICTORY"), "VICTORY: baseline MEDIDO (julio ×3; re-medido post-#36 con rearmParty, 22-08), no veredicto de fidelidad").toEqual([4, 7, 10, 12, 14]);
    expect(byOutcome("DEADEND"), "DEADEND del PORT: baseline MEDIDO (ídem), no veredicto de fidelidad").toEqual([5, 6, 8]);
  });

  test("determinismo ×2: dos pasadas de cima frescas dan el MISMO digest", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const a = await runDeceit(page);
    const b = await runDeceit(page);
    expect(b.digest, "digest de outcomes byte-idéntico bajo reseed(0)").toBe(a.digest);
  });
});
