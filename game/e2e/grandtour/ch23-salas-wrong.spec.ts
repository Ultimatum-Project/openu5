/**
 *
 * ── `0xec`: LA PREMISA VIEJA QUEDA RETIRADA (pieza 14 del lote #54, main 13b46ee6) ──
 * Lo que este encabezado decía hasta el 2026-07-28 — «el fix saca la familia `0xEC` del
 * roster y NO está derivado QUÉ coloca el original en su lugar; los 4 bytes que lee son
 * pila sin inicializar y sólo la sonda-oráculo puede decirlo» — **está REFUTADO por
 * derivación, no por medida**: esos 4 bytes SÍ se inicializan. `DNGLOOK.OVL 0x1273-0x128c`
 * tira `rand(0,7)` CUATRO veces contra la tabla de 8 índices de DS `0x385e` (= `DATA.OVL`
 * fileoff `0x386e`, volcada con `xxd`: `14 15 16 22 21 18 1f 18` = Giant Rat · Bat · Giant
 * Spider · Python · Skeleton · Slime · Insect Swarm · Slime) y guarda ese POOL de 4; el
 * consumo `0x12ee-0x12f7` (`and bx,3` sobre el tile) lee `pool[tile & 3]` ⇒ los tiles
 * 236-239 de la MISMA familia sacan enemigos DISTINTOS. Es el «Random enemy groups» del
 * wiki, y el testigo YT de cm64 (237→Giant Rats, 236→Bats) cae de las entradas 0 y 1 de
 * esa tabla sin hipótesis auxiliar.
 * ⇒ Estas salas ya NO se quedan vacías ni «pierden remolinos»: reciben ENEMIGOS REALES que
 * hay que PELEAR. Prohibida la formulación vieja («la sala se queda SIN enemigos», «el
 * original coloca una entidad sin identificar»): dice lo contrario de lo derivado.
 *
 * LO QUE SIGUE SIN DERIVAR, y por lo que este spec SIGUE SIENDO DETECTOR: **qué especie
 * concreta** toca en una corrida dada. El pool sale de 4 tiradas en el montaje de la
 * escena, así que depende de POR DÓNDE va el stream RNG al entrar — y que el stream del
 * port esté alineado byte a byte con el del original en ese punto NO está derivado. El
 * MECANISMO es derivación; el ELENCO de una corrida es medida del PORT. Formulación
 * obligatoria: «el PORT la gana/sella con ESTE roster (especie dependiente del stream)»,
 * nunca «la sala se gana» a secas.
 * ──────────────────────────────────────────────────────────────────────────────────
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2 — ch23-salas-wrong: PASADA-1 (cima) de TODAS las salas de WRONG (loc 36).
 *
 * Wrong tiene 16 salas (dungeons.json type 0xF; roomNo=sub&0xF). TOPOLOGÍA MEDIDA: NO es
 * encadenada — es DISPERSA con un bolsillo de cima acotado. La reachability estática (mirror
 * de planDungeonDescent) prueba que desde la entrada de cima SÓLO se alcanzan floors 0-1
 * (floor1 sin salas), AÚN tratando todas las salas como conquistadas ⇒ la pasada de cima cubre
 * EXACTAMENTE las 5 salas de floor0 {0,1,2,3,4}; el resto (muradas 5,6,15 + floors 2-7) es
 * PENDIENTE-entrada (Fase 2b, fondo/fosos).
 * [HISTÓRICO 2026-07-25: Fase 2b CERRADA — 112/112 selladas (main 76fb75c9, «Wrong 16/16»);
 *  las 11 PENDIENTE-entrada de esta pasada-1 se resolvieron después (ver CENSO-COMBATMAPS.md).]
 *
 * Cada sala del bolsillo se mide desde una ENTRADA FRESCA (conquerRoomAt con loadout ranged +
 * Des Por). El arnés estrena dos refinamientos (ruling A del lead, en nav.ts):
 *  A.1 ESPERA-POR-PROGRESO: resolveArenaCombat no cuenta atasco mientras haya enemigos vivos
 *      MOVIÉNDOSE (un móvil que se acerca acaba en rango → Attack); sólo congelados+inalcanzables
 *      ≥60 rondas = DEADEND real. Convierte winnable-por-móvil en VICTORY sin inflar dead-ends.
 *  A.2 fleeCombat NO ENVENENA: si tras el veredicto NINGÚN borde es alcanzable (bolsillo
 *      emparedado), NADA de fabricar salida en el juego → outcome DEADEND-STUCK (hallazgo de
 *      fidelidad). Al medir sala-a-sala con entrada fresca, un STUCK no contamina la siguiente.
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, enterDungeon, conquerRoomAt, type DFacing } from "./nav";

const PREV_CHAPTER = "ch13";
const WRONG = 36;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;

// Las 16 salas de Wrong (dungeons.json type 0xF), roomNo = sub&0xF. Celda REPRESENTATIVA
// (una sala multi-celda dispara el combate al entrar en cualquiera de sus celdas). approachDir
// = movimiento hacia la sala desde el vecino route-passable; null = murada (a investigar).
// Orden por planta para descender sin cruzar salas.
const ROOMS: Array<{ floor: number; x: number; y: number; roomNo: number; approachDir: DFacing | null }> = [
  { floor: 0, x: 1, y: 3, roomNo: 0, approachDir: "south" },
  { floor: 0, x: 3, y: 2, roomNo: 1, approachDir: "north" },
  { floor: 0, x: 3, y: 4, roomNo: 2, approachDir: "south" },
  { floor: 0, x: 0, y: 5, roomNo: 3, approachDir: "west" },
  { floor: 0, x: 2, y: 5, roomNo: 4, approachDir: "east" },
  { floor: 2, x: 1, y: 1, roomNo: 11, approachDir: "west" },
  { floor: 2, x: 5, y: 1, roomNo: 12, approachDir: "east" },
  { floor: 3, x: 0, y: 1, roomNo: 5, approachDir: null },
  { floor: 3, x: 6, y: 1, roomNo: 6, approachDir: null },
  { floor: 5, x: 0, y: 1, roomNo: 7, approachDir: "north" },
  { floor: 5, x: 2, y: 1, roomNo: 8, approachDir: "north" },
  { floor: 5, x: 4, y: 1, roomNo: 9, approachDir: "north" },
  { floor: 5, x: 6, y: 1, roomNo: 10, approachDir: "north" },
  { floor: 5, x: 3, y: 4, roomNo: 13, approachDir: "north" },
  { floor: 7, x: 3, y: 5, roomNo: 14, approachDir: "south" },
  { floor: 7, x: 7, y: 1, roomNo: 15, approachDir: null },
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
      st.equipmentQuantities[arrows] = 99;
      st.lightSpellMins = 9999;
      // Des Por (spell 22) + reactivos + MP: descenso mágico de plantas medias (ver ch20).
      st.spellQuantities[22] = 99;
      for (let i = 0; i < st.reagentQuantities.length; i++) st.reagentQuantities[i] = 99;
    },
    [MAGIC_BOW, RING_INVIS, ARROWS] as const,
  );
}

// TOPOLOGÍA MEDIDA (pasada de CIMA) + REACHABILITY ESTÁTICA (mirror de planDungeonDescent):
// desde la entrada de cima (floor0, (1,1)) SÓLO son alcanzables floors 0 y 1 — y AÚN tratando
// TODAS las salas como pasables (simulando conquista total), floors 2-7 siguen inalcanzables
// desde la cima. Floor1 no tiene salas. ⇒ la pasada de CIMA cubre EXACTAMENTE las 5 salas de
// floor0 {0,1,2,3,4}; el resto es PENDIENTE-entrada (Fase 2b)
// [HISTÓRICO 2026-07-25: cola 2b resuelta — Wrong 16/16 en main 76fb75c9; este set delimita
//  el alcance de ESTA pasada-1]:
//  · 5,6,15 = muradas (sin approach ortogonal).
//  · 11,12 (f2), 7,8,9,10,13 (f5), 14 (f7) = floors no alcanzables desde cima (fondo/fosos).
// (Runtime lo confirma: intentarlas da "dungeonDescendTo: sin plan desde (0,1,1)".)
const TOP_POCKET = new Set([0, 1, 2, 3, 4]);

/** Mide UNA sala del bolsillo de cima desde una ENTRADA FRESCA (boot+import+reseed+seed+enter).
 *  Cada sala es su propio RUN → un DEADEND-STUCK (bolsillo emparedado, ruling A.2) NO contamina
 *  a la siguiente (sin fabricar salida en el juego: se re-entra fresco). El descenso enruta
 *  ALREDEDOR de las salas sin conquistar (planDungeonDescent) → sin combates incidentales. */
async function measureRoom(
  page: Page,
  r: { floor: number; x: number; y: number; roomNo: number; approachDir: DFacing | null },
  detail: Record<number, string>,
): Promise<string> {
  if (r.approachDir === null) return "SKIP-pend-entrada-murada";
  if (!TOP_POCKET.has(r.roomNo)) return "SKIP-pend-entrada-2b"; // floors 2-7 no alcanzables desde cima
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  const entry = await enterDungeon(page, WRONG);
  expect(entry, "entra a Wrong por la cima (floor 0)").toMatchObject({ dungeon: WRONG, floor: 0 });
  try {
    const v = await conquerRoomAt(page, { roomCell: { floor: r.floor, x: r.x, y: r.y }, approachDir: r.approachDir, maxRounds: 600 });
    // `OUTCOME:eN:dM [roster de entrada]` — la evidencia de la adjudicación (con qué salió, con
    // cuántas bajas). Sólo log; ninguna aserción cuelga de esto.
    detail[r.roomNo] = `${v.digest} [${v.roster ?? "?"}]`;
    return v.outcome;
  } catch (e) {
    return `THROW:${(e as Error).message.slice(0, 40)}`;
  }
}

/** Corre la conquista de Wrong (sala a sala, entradas frescas); devuelve roomNo→outcome. */
async function runWrong(page: Page): Promise<{ digest: string; outcomes: Record<number, string>; detail: Record<number, string> }> {
  const outcomes: Record<number, string> = {};
  const detail: Record<number, string> = {};
  for (const r of ROOMS) outcomes[r.roomNo] = await measureRoom(page, r, detail);
  const digest = ROOMS.map((r) => `${r.roomNo}:${outcomes[r.roomNo]}`).join("|");
  return { digest, outcomes, detail };
}

test.describe.serial("FASE 2 — ch23 salas de Wrong (pasada-1 de cima, arnés progreso+DEADEND-STUCK)", () => {
  test("conquista/censa el bolsillo de cima de Wrong (5 salas de floor0)", async ({ page }) => {
    // TIMEOUT SUBIDO 900_000 → 1_800_000 (ventana-salas, 07-28). RAZÓN DECLARADA: con la pieza 14
    // del lote (familia 0xEC = grupo aleatorio de la tabla DS 0x385e) las salas que antes quedaban
    // VACÍAS reciben roster REAL ⇒ hay que PELEAR donde antes se cruzaba un tablero vacío. Es techo
    // de reloj, CERO cambio de conducta (precedente r15: timeout ancho declarado).
    test.setTimeout(chapterTimeout(1_800_000));
    const t0 = Date.now();
    const { digest, outcomes, detail } = await runWrong(page);
    const secs = Math.round((Date.now() - t0) / 1000);
    console.log(`[ch23-wrong] detail=${JSON.stringify(detail)}`);
    const tally = Object.values(outcomes).reduce<Record<string, number>>((a, o) => {
      const k = o.startsWith("THROW") ? "THROW" : o;
      a[k] = (a[k] ?? 0) + 1; return a;
    }, {});
    console.log(`[ch23-wrong] ${secs}s outcomes=${JSON.stringify(tally)}`);
    console.log(`[ch23-wrong] digest=${digest}`);

    // VEREDICTOS RE-SELLADOS por el SPAWN FIEL (P0a, entryDirection = opposite-of-facing). El arnés
    // progreso-A.1 + DEADEND-STUCK-A.2 los hace estables y NO contaminantes (cada sala es su propio
    // RUN; ×2 determinista aislado). Con el spawn FIEL el bolsillo de cima cambia respecto al
    // hardcode "south" — cada flip es un HALLAZGO DE FIDELIDAD documentado (spawn opposite-of-facing
    // = derivación 72/72), NO un bug del arnés:
    //  · 0 = VICTORY (sin cambio).      · 1 = DEADEND fiel, huye (sin cambio).
    //  · 2 = VICTORY→DEADEND: bajo "south" la party alcanzaba a los enemigos; el spawn FIEL la
    //    coloca en un borde desde el que la sala queda sellada → HUYE (dead-end fiel). Hallazgo.
    //  · 4 = DEADEND→VICTORY: LIBERADA — el spawn fiel alcanza a los enemigos que "south" sellaba.
    //  · 3 (combatmap #51) = DEADEND-STUCK→DEADEND: el CANDIDATO P0a del censo. El spawn fiel lo
    //    DES-ATASCA (la party ya alcanza un borde y HUYE), pero NO lo hace VICTORY → el censo
    //    "winnable por enemigo móvil" queda REFUTADO: #51 es DEAD-END FIEL bajo el spawn correcto,
    //    no una sala ganable. (Revisa el carril Wrong: su hipótesis P0a era parcial.)
    //
    // ── RE-ADJUDICACIÓN 2026-07-28 (carril ventana-salas), tras la pieza 14 del lote ──────
    // EL SELLO VIEJO ERA EL DETECTOR Y DISPARÓ COMO DEBÍA. r1 y r2 estaban selladas a VICTORY
    // por una razón que el lote ha disuelto: se ganaban por AUSENCIA (el cargador tiraba la
    // familia 0xEC y el tablero quedaba vacío). Con la familia colocando enemigos REALES las
    // dos vuelven a DEADEND — medido, no supuesto: `DEADEND:e7:d0` en cm49 y `DEADEND:e14:d0`
    // en cm50, o sea el roster ENTERO en pie y CERO bajas de la party ⇒ no es una pelea
    // perdida, es una sala a la que no se llega. Contabilidad del .CBT (censo estático):
    // cm49 = 7 unidades 0xEC (3×tile236 + 4×tile237) y NINGÚN otro combatiente; cm50 = 14
    // (6×236 + 8×237), idem. Antes esos 7 y 14 no existían; ahora existen y están sellados.
    // NO es veredicto de fidelidad: la ESPECIE que ocupa cada tile la decide el stream RNG
    // (ver encabezado), así que esto es baseline del PORT.
    expect(outcomes[0], "sala 0 (cm48): VICTORY — 4 Orcs del .CBT, sin unidades 0xEC ⇒ el lote no la toca").toBe("VICTORY");
    expect(outcomes[2], "sala 2 (cm50): DEADEND del PORT — las 14 unidades 0xEC (6×t236+8×t237, único elenco del .CBT) quedan en pie con 0 bajas ⇒ sala sellada, no pelea perdida. RE-SELLADA desde VICTORY: la victoria vieja era POR AUSENCIA (familia 0xEC fuera del roster), premisa RETIRADA por DNGLOOK 0x1273-0x128c + 0x12ee-0x12f7 (pool de 4×rand(0,7) sobre DS 0x385e). Baseline medido, NO veredicto de fidelidad").toBe("DEADEND");
    expect(outcomes[1], "sala 1 (cm49): DEADEND del PORT — las 7 unidades 0xEC (3×t236+4×t237, único elenco del .CBT) quedan en pie con 0 bajas ⇒ sala sellada, no pelea perdida. RE-SELLADA desde VICTORY por la misma razón que cm50 (la victoria era por tablero vacío). Baseline medido, NO veredicto de fidelidad").toBe("DEADEND");
    // r4 y r3 CONSERVAN outcome, pero su elenco ha cambiado bajo los pies: el mismo veredicto
    // se sostiene ahora sobre una sala MÁS POBLADA, así que el sello vale por más que antes.
    expect(outcomes[4], "sala 4 (cm52): VICTORY PELEADA con 0 bajas — y ahora sobre 12 enemigos, no 4: al roster fijo (4 Mimic) el lote le suma las 8 unidades 0xEC (5×t236+3×t237) que antes no se colocaban. Se mantiene la liberación por spawn fiel (DEADEND→VICTORY) — spawn P0a = opposite-of-facing, DERIVADO con cita ASM (auditoría 7/7 Result-A)").toBe("VICTORY");
    expect(outcomes[3], "sala 3 #51 (cm51): DEADEND del PORT con 10 en pie y 0 bajas — el elenco pasa de 6 (3 Ghost+3 Skeleton) a 10 con las 4 unidades 0xEC (4×t236), y el veredicto NO se mueve ⇒ el sello NO colgaba de que la sala estuviera despoblada. Se mantiene lo ya adjudicado: el spawn fiel la DES-ATASCA (DEADEND-STUCK→DEADEND) pero no la hace ganable, hipótesis P0a REFUTADA — spawn P0a = opposite-of-facing, DERIVADO con cita ASM (auditoría 7/7 Result-A)").toBe("DEADEND");

    // El resto es PENDIENTE-entrada (Fase 2b): muradas + floors 2-7 no alcanzables desde cima.
    for (const n of [5, 6, 15]) expect(outcomes[n], `sala ${n} murada`).toBe("SKIP-pend-entrada-murada");
    for (const n of [7, 8, 9, 10, 11, 12, 13, 14]) expect(outcomes[n], `sala ${n} profunda`).toBe("SKIP-pend-entrada-2b");
  });

  test("determinismo ×2: dos pasadas de cima frescas dan el MISMO digest", async ({ page }) => {
    // TIMEOUT SUBIDO 900_000 → 3_600_000: son DOS pasadas completas del test de arriba (que ya
    // necesita 1_800_000 con combate real). Techo de reloj, cero cambio de conducta.
    test.setTimeout(chapterTimeout(3_600_000));
    const a = await runWrong(page);
    const b = await runWrong(page);
    expect(b.digest, "digest de outcomes byte-idéntico bajo reseed(0)").toBe(a.digest);
  });
});
