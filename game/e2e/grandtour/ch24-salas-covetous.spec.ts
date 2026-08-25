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
 * wiki, y el testigo YT de cm64 —una sala DE ESTE CAPÍTULO, r0— cae del mecanismo sin
 * hipótesis auxiliar: vio 237→Giant Rats y 236→Bats, las entradas 0 y 1 de esa tabla.
 * ⇒ Estas salas ya NO se quedan vacías ni «pierden remolinos»: reciben ENEMIGOS REALES que
 * hay que PELEAR. Prohibida la formulación vieja («la sala se queda SIN enemigos», «el
 * original coloca una entidad sin identificar»): dice lo contrario de lo derivado.
 *
 * LO QUE SIGUE SIN DERIVAR, y por lo que este spec SIGUE SIENDO DETECTOR: **qué especie
 * concreta** toca en una corrida dada. El pool sale de 4 tiradas en el montaje de la
 * escena, así que depende de POR DÓNDE va el stream RNG al entrar — y que el stream del
 * port esté alineado byte a byte con el del original en ese punto NO está derivado. El
 * MECANISMO es derivación; el ELENCO de una corrida es medida del PORT.
 * ──────────────────────────────────────────────────────────────────────────────────
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2 — ch24-salas-covetous: PASADA 1 (cima) de TODAS las salas de COVETOUS (loc 37).
 * TERCERA topología del plan (§Fase 2b): DENSA-SELLADA — variante del modelo ch20 con
 * ENTRADA FRESCA POR SALA (bootWorld por sala), no la secuencia de ch20.
 *
 * Covetous = orden 3 (saltando Despise) → combatmap = 16 + 3*16 + roomNo = 64 + roomNo (64..79).
 * PARTICULARIDAD: 82 CELDAS de sala para sólo 16 roomNos (las salas se REPITEN por planta); el
 * bitmap de despejado es por (mazmorra, roomNo) → basta conquistar CADA roomNo UNA vez (en su
 * celda más alcanzable).
 *
 * POR QUÉ ENTRADA FRESCA POR SALA (la 3ª topología): Covetous es densa y MUY sellada. Una sala
 * sellada de la que la party NO puede huir (fleeCombat se atasca — misma raíz que el frente Wrong
 * destapó) deja a la party VARADA en la celda → la siguiente conquerRoomAt da "sin plan" en
 * CASCADA (5 THROW así en la 1ª medición). Con re-entrada fresca por sala el veredicto INTRÍNSECO
 * del combatmap (VICTORY/DEADEND) se mide sin arrastre. Es lo correcto para MEDIR hoy; cuando el
 * fix espera-por-progreso + flee-limpio de ese frente aterrice, se podrá relajar a la secuencia.
 *
 * SIN CETRO (ruling del lead): ninguna sala de Covetous necesita el Cetro para su veredicto de
 * pasada-1. cm66 (r2) es DEAD-END del PORT (enemigos varados en el void tras roca opaca 0x4d;
 * ojo con QUIÉNES son — ver la TERCERA RETIRADA más abajo).
 * ★ NO es «DEAD-END FIEL patrón-#29» (barrido prosa-autofiel t2, 07-27): (a) el eslabón que
 * convierte la geometría en inganabilidad es la MOVILIDAD, y `CanPassThroughWalls` sale de
 * `AdditionalEnemyFlags.json` (copia de Ultima5Redux), NO del binario — la tabla de flags
 * derivada (`re/notes/combat.md:445-461`, DS 0x153C) no tiene ningún bit «atraviesa muros»;
 * (b) «patrón #29» nombra un sello RETIRADO POR FABRICADO
 * (`re/notes/ch16b-dead-end-fabricado.md`). Lo derivado aquí es la GEOMETRÍA (roca opaca 0x4d,
 * tabla de opacos), no el veredicto.
 * ★★ ACTUALIZACIÓN (barrido de movilidad, 07-27 — `re/notes/redux-flags-movilidad-barrido.md`):
 * la razón que ESTE encabezado daba también ha quedado retirada, en los dos sentidos.
 *  · `CanPassThroughWalls` es CAMPO MUERTO en el port: se asigna en `enemies.ts` y NO LO LEE
 *    NADIE ⇒ ningún enemigo cruza muros, valga true o false. Decir «los Slimes no cruzan muros»
 *    no distingue a los Slimes de nada: es la regla universal del port.
 *  · Y el bitmap de clase de movimiento YA NO ESTÁ SIN DERIVAR (esa línea se ha retirado de
 *    arriba): `kernel_tile_passable` 0x2C4C toma la clase de `[0x54F4 + mover>>2]` (tabla
 *    DATA.OVL fileoff 0x5504, 64 B) y despacha por jump-table inline 0x2D60 a 11 handlers, de
 *    los cuales la CLASE 4 sí atraviesa muros. Lo que sigue SIN derivar es a QUÉ ENEMIGOS se
 *    les aplica (mapeo enemigo→mover) ⇒ probe #30.
 * ★★★ TERCERA RETIRADA (ventana-salas, 07-28) — Y ESTA VEZ CAE EL SUJETO, NO SÓLO LA RAZÓN.
 * «Los Slimes de cm66» no son un elenco: los ÚNICOS combatientes FIJOS del `.CBT` de cm66 son
 * 2 Ghost. Los Slimes que se ven al jugarla son 2 unidades del tile 238 = `pool[2]`, o sea una
 * TIRADA del grupo aleatorio 0xEC — otra corrida puede no traer ni uno. Toda frase de la forma
 * «cm66 es dead-end porque los Slimes …» es, además de razón sin suelo, sujeto equivocado.
 * ⇒ El OUTCOME (DEADEND medido, 8 de 12 en pie con 0 bajas) queda EN PIE como baseline del port;
 * la RAZÓN por movilidad, retirada hasta que #30 la resuelva. Los 2 objetos-campo 0x70 de cm66 el
 * port los DESCARTA en carga (combat.ts:599) → inertes. El cetro-llave de NAVEGACIÓN (13
 * celdas Energy del laberinto) es hipótesis marcada de Fase 2b, no de este capítulo.
 * [HISTÓRICO 2026-07-25: Fase 2b CERRADA — 112/112 selladas (main 76fb75c9); la hipótesis
 *  cetro-nav se jugó en ch47-covetous-cetro-nav y las 4 PENDIENTE-entrada de abajo tienen
 *  veredicto firme en el censo. Este spec queda como pasada-1 histórica.]
 *
 * SPAWN FIEL P0a (re-medido tras aterrizar P0a = entryDirection opposite-of-facing): **0 FLIPS**.
 * Los mismos 3 VICTORY + 9 DEADEND que bajo el hardcode "south". Covetous es la ÚNICA mazmorra de
 * la ola sin liberaciones (Destard +3, Wrong +1, Shame +2, Hythloth +3): sus sellos son
 * ESTRUCTURALES (roca opaca / void), absolutos para cualquier borde de spawn — el spawn no abre
 * nada. cm66 sigue DEADEND bajo spawn P0a (medida del PORT; el «fiel» de este sello está
 * des-sellado arriba).
 *
 * ★ Y OJO CON LEER ESE «0 FLIPS» HOY (ventana-salas, 07-28): 3 VICTORY + 9 DEADEND vuelve a ser
 * el reparto tras la pieza 14, pero NO por continuidad. Entre medias el reparto fue [4,6,7,8,9] /
 * [0,1,2,3,10,11,15] (el fix que vaciaba las salas de 0xEC), y ahora r4 y r6 regresan a DEADEND
 * con el tablero POBLADO. Es la misma etiqueta sobre salas distintas: r8 se gana ahora sobre 14
 * enemigos y no sobre 5, y r1 sella dejando 6 en pie y no 1. Contar sólo VICTORY/DEADEND borra
 * justo lo que el lote cambió.
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, enterDungeon, conquerRoomAt, type DFacing } from "./nav";
import { Coverage } from "./coverage";

const PREV_CHAPTER = "ch13";
const COVETOUS = 37;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;

// 1 celda representativa por roomNo (combatmap = 64 + roomNo). approachDir del vecino-pasaje
// (no muro 0xB/0xC/0xD, no sala 0xF); null = celda rodeada de salas/muros (room-locked/murada).
const ROOMS: Array<{ floor: number; x: number; y: number; roomNo: number; approachDir: DFacing | null }> = [
  { floor: 0, x: 3, y: 2, roomNo: 0, approachDir: "east" },
  { floor: 0, x: 7, y: 2, roomNo: 1, approachDir: "west" },
  { floor: 2, x: 1, y: 3, roomNo: 2, approachDir: "north" }, // cm66 = DEAD-END del PORT (Slimes varados; ver cabecera)
  { floor: 2, x: 1, y: 1, roomNo: 3, approachDir: "south" },
  { floor: 0, x: 3, y: 6, roomNo: 4, approachDir: "east" },
  { floor: 2, x: 6, y: 1, roomNo: 6, approachDir: "south" }, // candidato-dead-end (combatmap 70)
  { floor: 2, x: 6, y: 3, roomNo: 7, approachDir: "north" },
  { floor: 2, x: 4, y: 3, roomNo: 8, approachDir: "north" },
  { floor: 2, x: 4, y: 1, roomNo: 9, approachDir: "south" },
  { floor: 3, x: 1, y: 3, roomNo: 10, approachDir: "north" }, // candidato-dead-end (combatmap 74)
  { floor: 1, x: 1, y: 5, roomNo: 11, approachDir: "south" },
  { floor: 3, x: 3, y: 6, roomNo: 15, approachDir: "west" },  // vecino = LadderUp (0x1)
  // PENDIENTE-entrada (Fase 2b): no alcanzables en la pasada de cima.
  // [HISTÓRICO 2026-07-25: cola 2b resuelta — 112/112 en main 76fb75c9; sigue siendo el alcance de esta pasada-1.]
  { floor: 5, x: 3, y: 4, roomNo: 12, approachDir: null },    // cm76: única celda f5(3,4) inalcanzable (¿Energy en ruta? PEND-cetro-nav)
  { floor: 7, x: 1, y: 3, roomNo: 5, approachDir: null },     // cm69: celdas room-locked (f7, 4 vecinos sala)
  { floor: 5, x: 4, y: 4, roomNo: 13, approachDir: null },    // cm77: celda room-locked (f5, 4 vecinos sala)
  { floor: 5, x: 0, y: 0, roomNo: 14, approachDir: null },    // cm78: celda murada (f5, 4 muros)
];

// Pre-skip: sin approachDir ortogonal limpio (room-locked/murada) O celda inalcanzable en cima.
const PEND = new Set([5, 12, 13, 14]);

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
      st.spellQuantities[22] = 99; // Des Por (funciona en Covetous, no es Doom) — descenso mágico
      for (let i = 0; i < st.reagentQuantities.length; i++) st.reagentQuantities[i] = 99;
    },
    [MAGIC_BOW, RING_INVIS, ARROWS] as const,
  );
}

/** Entra FRESCO a Covetous por la cima (RECARGA página + import + reseed + loadout + enter).
 *  bootWorld por-sala = pizarra limpia: una sala sellada no-fleeable deja el combate ABIERTO e
 *  importCheckpoint solo no lo desmonta → enterDungeon no aterrizaría (medido). */
async function freshEnter(page: Page): Promise<void> {
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  const entry = await enterDungeon(page, COVETOUS);
  expect(entry, "entra a Covetous por la cima (floor 0)").toMatchObject({ dungeon: COVETOUS, floor: 0 });
}

/** Conquista/censa Covetous una vez (entrada fresca por sala); devuelve roomNo→outcome + digest. */
async function runCovetous(page: Page): Promise<{ digest: string; outcomes: Record<number, string>; detail: Record<number, string> }> {
  const outcomes: Record<number, string> = {};
  const detail: Record<number, string> = {}; // roomNo → `OUTCOME:eN:dM` (evidencia: vivos/bajas), sólo log
  for (const r of ROOMS) {
    if (r.approachDir === null || PEND.has(r.roomNo)) { outcomes[r.roomNo] = "SKIP-pend-entrada"; continue; }
    await freshEnter(page);
    let outcome: string;
    let digest = "";
    let roster = "?";
    try {
      const v = await conquerRoomAt(page, { roomCell: { floor: r.floor, x: r.x, y: r.y }, approachDir: r.approachDir, maxRounds: 600 });
      outcome = v.outcome; digest = v.digest; roster = v.roster ?? "?";
    } catch (e) {
      outcome = `THROW:${(e as Error).message.slice(0, 45)}`;
    }
    // VICTORIA EN TRÁNSITO: FAIL:no-combat-on-step + party EN la celda = el pather ganó el combate
    // de paso al cruzarla (cámara abierta). Es VICTORIA real, no FAIL. Se reclasifica.
    if (outcome === "FAIL" && digest === "FAIL:no-combat-on-step") {
      const onRoomCell = await page.evaluate((rc) => {
        const p = (window as unknown as { __u5test: { game: { dungeonState: { pos: { floor: number; x: number; y: number } } } } }).__u5test.game.dungeonState.pos;
        return p.floor === rc.floor && p.x === rc.x && p.y === rc.y;
      }, { floor: r.floor, x: r.x, y: r.y });
      if (onRoomCell) outcome = "VICTORY";
    }
    outcomes[r.roomNo] = outcome;
    detail[r.roomNo] = `${digest || outcome} [${roster}]`;
  }
  const digest = ROOMS.map((r) => `${r.roomNo}:${outcomes[r.roomNo]}`).join("|");
  return { digest, outcomes, detail };
}

const cov = new Coverage("ch24-salas-covetous");

test.describe.serial("FASE 2 — ch24 salas de Covetous (pasada de cima, densa-sellada)", () => {
  test("conquista/censa las salas de Covetous alcanzables desde la cima (pasada 1)", async ({ page }) => {
    // TIMEOUT SUBIDO 1_200_000 → 2_700_000 (ventana-salas, 07-28). RAZÓN DECLARADA: con la pieza 14
    // del lote (familia 0xEC = grupo aleatorio de la tabla DS 0x385e) las 8 salas que perdían
    // «remolinos» reciben roster REAL ⇒ 12 salas que hay que PELEAR, no cruzar. La corrida de
    // ventana del lead se cortó por techo de reloj (no por conducta). Cero cambio de conducta.
    test.setTimeout(chapterTimeout(2_700_000));
    const t0 = Date.now();
    const { digest, outcomes, detail } = await runCovetous(page);
    const secs = Math.round((Date.now() - t0) / 1000);
    const tally = Object.values(outcomes).reduce<Record<string, number>>((a, o) => ((a[o] = (a[o] ?? 0) + 1), a), {});
    console.log(`[ch24-covetous] ${secs}s outcomes=${JSON.stringify(tally)}`);
    console.log(`[ch24-covetous] detail=${JSON.stringify(detail)}`);
    console.log(`[ch24-covetous] digest=${digest}`);

    // Las salas ATACADAS (no-PEND) deben RESOLVER: VICTORY o DEADEND. DETECTOR, no veredicto —
    // «DEADEND» es lo que MIDE el port, sin derivación por sala (barrido prosa-autofiel t2, 07-27).
    const attempted = ROOMS.filter((r) => outcomes[r.roomNo] !== "SKIP-pend-entrada");
    const bad = attempted.filter((r) => !["VICTORY", "DEADEND"].includes(outcomes[r.roomNo]!));
    expect(bad.map((r) => `${r.roomNo}:${outcomes[r.roomNo]}`), "salas atacadas: todas RESUELVEN (VICTORY o DEADEND del PORT; baseline medido, no veredicto de fidelidad)").toEqual([]);
    expect(attempted.length, "12 salas atacadas en la pasada de cima").toBe(12);

    const victories = attempted.filter((r) => outcomes[r.roomNo] === "VICTORY").map((r) => r.roomNo).sort((a, b) => a - b);
    const deadends = attempted.filter((r) => outcomes[r.roomNo] === "DEADEND").map((r) => r.roomNo).sort((a, b) => a - b);
    // ── RE-ADJUDICACIÓN 2026-07-28 (carril ventana-salas), tras la pieza 14 del lote ──────
    // EL SELLO VIEJO ERA EL DETECTOR Y DISPARÓ COMO DEBÍA. r4 y r6 estaban selladas a VICTORY
    // por razones que el lote ha disuelto: r4 se ganaba por AUSENCIA (tablero vacío) y r6
    // porque sus 9 unidades 0xEC no se colocaban y sólo quedaban 4 Giant Rat. Con la familia
    // colocando enemigos REALES las dos vuelven a DEADEND — medido, con 0 bajas de party en
    // ambas ⇒ no son peleas perdidas, son enemigos a los que no se llega.
    //
    // ★ EL CONJUNTO DE OUTCOMES COINCIDE CON EL BASELINE PRE-FIX ([7,8,9] / [0,1,2,3,4,6,10,
    // 11,15]) PERO LAS SALAS NO SON LAS MISMAS. La coincidencia es de etiqueta, no de sala:
    // donde antes se sellaba con 1 Ghost en pie, ahora se sella con 4-14, y donde antes no
    // había pelea ahora se matan 7 de 13. La cuenta de MUERTOS lo dice (`e` = vivos al cerrar):
    //   r0 e4/11 · r1 e6/13 · r2 e8/12 · r3 e9/13 · r4 e14/14 · r6 e9/13 · r10 e11/13 ·
    //   r11 e1/6 · r15 e7/7   — todas con d0 (cero bajas de la party).
    // Leer «sin cambio» aquí sería exactamente el error que el ruling detector previene.
    expect(victories, "3 VICTORY PELEADAS: r7 (cm71, 16 Ghost) · r8 (cm72, 14 enemigos — 1 Gazer + 4 Headless FIJOS + 9 unidades 0xEC que ahora SÍ se colocan; antes se ganaba sobre 5) · r9 (cm73, 6 Daemon). Las tres con 0 bajas. RE-SELLADA desde [4,6,7,8,9]: r4 y r6 CAEN a DEADEND al dejar de estar despobladas (premisa RETIRADA por DNGLOOK 0x1273-0x128c + 0x12ee-0x12f7). Baseline medido, NO veredicto de fidelidad").toEqual([7, 8, 9]);
    // 9 DEADEND del PORT: enemigos sellados/inalcanzables, 0 bajas en las nueve. Incluye los DOS
    // candidatos-dead-end del censo en Covetous (#70=r6, #74=r10), ambos DEADEND — y r6 lo es
    // AHORA por una razón distinta a la del triaje viejo (ya no es «quedan 4 Rat y se matan»).
    expect(deadends, "9 DEADEND del PORT — OJO a las dos notas que había que re-examinar: (a) #65=r1 SIGUE DEADEND, pero su vieja formulación ('sin remolinos es ganable', refutada) ha quedado SIN OBJETO: la sala nunca pierde sus unidades 0xEC, y el port mata 7 de sus 13 y deja 6 inalcanzables; (b) r4 (cm68) y r6 (cm70) ENTRAN aquí desde VICTORY. r11/r15 sin unidades 0xEC ⇒ intactas. Baseline medido, NO veredicto de fidelidad").toEqual([0, 1, 2, 3, 4, 6, 10, 11, 15]);

    cov.mark("dungeon-covetous").mark("cell-covetous-room");
    cov.note(
      `PASADA 1 (cima) de Covetous (loc 37, combatmap=64+roomNo). 82 celdas de sala / 16 roomNos ` +
        `(salas repetidas; bitmap despejado por roomNo → 1 conquista por roomNo). Modelo DENSA-SELLADA: ` +
        `entrada FRESCA por sala (bootWorld/sala) — la secuencia ch20 CASCADEA en "sin plan" cuando una ` +
        `sala sellada no-fleeable vara a la party. spawn FIEL P0a (0 FLIPS vs pre-P0a — sellos ` +
        `estructurales roca/void, absolutos al borde de spawn), seed-0, ×2 determinista, SIN Cetro. RESULTADO ` +
        `(RE-ADJUDICADO 2026-07-28 tras la pieza 14 del lote #54): 3 VICTORY ` +
        `[7,8,9] + 9 DEADEND del PORT [0,1,2,3,4,6,10,11,15] = 12 censadas; 4 PENDIENTE-entrada [5,12,13,14]. ` +
        `★ EL 0xEC YA NO ES UN HUECO: DNGLOOK 0x1273-0x128c tira 4×rand(0,7) contra DS 0x385e (DATA.OVL fileoff ` +
        `0x386e = 14 15 16 22 21 18 1f 18 = Giant Rat/Bat/Giant Spider/Python/Skeleton/Slime/Insect Swarm/Slime) ` +
        `y 0x12ee-0x12f7 lee pool[tile&3] ⇒ los tiles 236-239 colocan ENEMIGOS REALES, distintos entre sí. ` +
        `Se RETIRA de esta nota la premisa vieja ("la sala se queda sin enemigos / el original coloca una entidad ` +
        `sin identificar"). El conjunto de outcomes coincide con el baseline pre-fix pero LAS SALAS NO SON LAS ` +
        `MISMAS: vivos-al-cerrar r0 4/11, r1 6/13, r2 8/12, r3 9/13, r4 14/14, r6 9/13, r10 11/13, r11 1/6, ` +
        `r15 7/7, todas con 0 bajas de party. r4 (cm68) y r6 (cm70) BAJAN de VICTORY a DEADEND al dejar de estar ` +
        `despobladas. ★ LO QUE SIGUE SIN DERIVAR: la ESPECIE de cada corrida (el pool depende de por dónde va el ` +
        `stream RNG al montar la escena, alineación no derivada) — control positivo de que esto no es teórico: el ` +
        `testigo YT de cm64 vio 237→Giant Rat y 236→Bat, y esta corrida da 237→Giant Spider y 236→Skeleton en la ` +
        `MISMA sala. Por eso el capítulo sigue siendo DETECTOR. ` +
        `Los DOS candidatos-dead-end del censo en Covetous (#70=r6, #74=r10) CONFIRMAN DEADEND. cm66 (r2) = ` +
        `DEADEND del PORT (baseline medido), 8 de 12 en pie. ★ SU RAZÓN QUEDA RETIRADA POR SEGUNDA VEZ Y AHORA ` +
        `TAMBIÉN EN EL SUJETO: decía "Slimes (id-24) varados en el void tras roca opaca 0x4d", pero los únicos ` +
        `combatientes FIJOS del .CBT de cm66 son 2 Ghost — los Slimes de esta corrida son 2 unidades del tile 238, ` +
        `o sea pool[2], una TIRADA: la próxima corrida puede no tener ni un Slime. La primera retirada (07-27) ya ` +
        `había tumbado la pata de movilidad: se apoyaba en CanPassThroughWalls=false, ` +
        `flag de Redux INOPERANTE — el port no lo lee (campo muerto) y ningún enemigo cruza muros; el mecanismo ` +
        `real del binario es la clase de movimiento 0x2C4C (re/notes/redux-flags-movilidad-barrido.md), y a quién ` +
        `aplica la clase 4 queda pendiente del probe #30. Los 2 objetos-campo 0x70 de ` +
        `cm66 el port los DESCARTA en carga (combat.ts:599) → inertes. PENDIENTE-` +
        `entrada: r5/r13/r14 celdas room-locked/murada (cm69/77/78); r12 (cm76) celda f5(3,4) inalcanzable en ` +
        `cima (hipótesis PEND-cetro-nav: 13 celdas Energy del laberinto podrían gatear la ruta — Fase 2b). ` +
        `Coverage sin ids room-<n> (no existen en manifest): dungeon-covetous + cell-covetous-room.`,
    );
    cov.write();
  });

  test("determinismo ×2: dos pasadas de cima frescas dan el MISMO digest", async ({ page }) => {
    // TIMEOUT SUBIDO 1_200_000 → 5_400_000: son DOS pasadas completas del test de arriba (que ya
    // necesita 2_700_000 con combate real). Techo de reloj, cero cambio de conducta.
    test.setTimeout(chapterTimeout(5_400_000));
    const a = await runCovetous(page);
    const b = await runCovetous(page);
    expect(b.digest, "digest de outcomes byte-idéntico bajo reseed(0)").toBe(a.digest);
  });
});
