/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2 — ch26-salas-hythloth: PASADA-1 (cima) de TODAS las salas de HYTHLOTH (loc 39).
 *
 * TOPOLOGÍA: Hythloth es ENCADENADA (medido). Reachability estática (mirror planDungeonDescent):
 * salas alcanzables desde la cima SIN conquistar = [7,9,10,11,13,14,15]; CON todas pasables
 * (conquista) = [0,1,2,3,4,5,7,8,9,10,11,13,14,15] — conquistar ABRE paso a 7 salas más. Por eso
 * el modelo per-sala-fresh UNDERCUENTA; aquí se usa el modelo CONTINUO (conquista-al-contacto en
 * cadena, un solo descenso, RoomsBroke abre la siguiente). Arnés en main: A.1 espera-por-progreso,
 * A.2 DEADEND-STUCK, + VICTORIA EN TRÁNSITO (bit de sala-despejada → VICTORY, no falso FAIL).
 *
 * Hythloth tiene 16 salas (type 0xF, combatmap = 96 + roomNo — las que las fichas viejas creían
 * de Doom). Repartidas por floors 0,2,3,4,5,6,7. approachDir del vecino-pasaje (incl. sala vecina
 * conquistada, para la cadena); null = SIN APROXIMACIÓN ORTOGONAL (r6,r12) — NO significa
 * inalcanzable: se entran KLIMBANDO una escalera que aterriza en su celda (`enterByLadder`,
 * 0x1e79). `ch29-fase2b-ruta-limpia` las ataca así por las MISMAS celdas (r6 = f4(5,0) up,
 * r12 = f7(1,1) down) y GANA LAS DOS. Una etiqueta de SKIP no es un veredicto: sólo dice que
 * ESTE capítulo no la atacó por esta vía.
 * Con Hythloth medida, las 7 mazmorras-con-salas tendrán su pasada-1. Asertos calibrados tras medir.
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, enterDungeon, conquerRoomAt, type DFacing } from "./nav";

const PREV_CHAPTER = "ch13";
const HYTHLOTH = 39;
const MAGIC_BOW = 0x24;
/**
 * ★ ARMA DE RESPALDO CUERPO A CUERPO (fixture, 2026-07-29 — decisión del lead sobre #166).
 *
 * CAUSA, medida en `re/notes/throw-166-acta.md`: este capítulo sembraba 99 flechas UNA vez
 * para la cadena continua ENTERA. Cuando la familia 0xEC pasó a dar enemigos REALES
 * (`13b46ee6`) el número de combates de verdad subió, el pozo se secó a mitad de mazmorra y
 * `consumeAmmo` **desequipó el arco en silencio** —comportamiento FIEL, COMSUBS
 * 0x09a2-0x09ab— dejando a Avatar y Shamino peleando «bare hands». Sin arco, el camino
 * `aimAt` del resolvedor no dispara: 400 rondas, cero bajas, y THROW en vez de veredicto.
 *
 * POR QUÉ ESTA OPCIÓN y no las otras dos que proponía el acta: reponer flechas POR SALA
 * inyectaría recursos a mitad de cadena y destruiría justo lo que el modelo continuo existe
 * para medir (el desgaste); agrandar el pozo es arbitrario —no hay cifra derivable de
 * «flechas suficientes»— y el próximo commit que suba el censo de enemigos lo vuelve a secar
 * en silencio. El respaldo melé se siembra UNA VEZ al arranque (respeta el modelo continuo),
 * degrada con gracia igual que el juego real (arco mientras haya flechas, espada después) y
 * es robusto a futuros cambios del censo.
 *
 * ★ NO ES UNA INVENCIÓN DEL ARNÉS: es la configuración que **Iolo ya traía** en el
 * checkpoint, y fue el control positivo que resolvió el diagnóstico — en la telemetría Iolo
 * es el ÚNICO que nunca aparece desarmado, y el único con espada en la segunda mano
 * («Iolo, armed with Magic Bow, Short Sword»). Slot: el segundo (`shield`), que el banner
 * `armed with` lista tras el arma (main.ts:1204, COMBAT 0x0701-0x07af).
 */
const SHORT_SWORD = 0x17;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;

// Las 16 salas de Hythloth (type 0xF), roomNo = sub&0xF, combatmap = 96 + roomNo.
const ROOMS: Array<{ floor: number; x: number; y: number; roomNo: number; approachDir: DFacing | null }> = [
  { floor: 0, x: 5, y: 1, roomNo: 0, approachDir: "south" },
  { floor: 0, x: 5, y: 5, roomNo: 1, approachDir: "west" }, // approach por sala vecina conquistada (cadena)
  { floor: 0, x: 6, y: 5, roomNo: 2, approachDir: "east" },
  { floor: 2, x: 7, y: 6, roomNo: 3, approachDir: "north" },
  { floor: 2, x: 3, y: 5, roomNo: 4, approachDir: "south" },
  { floor: 3, x: 5, y: 4, roomNo: 5, approachDir: "south" },
  { floor: 4, x: 5, y: 0, roomNo: 6, approachDir: null },
  { floor: 4, x: 1, y: 4, roomNo: 7, approachDir: "south" },
  { floor: 5, x: 4, y: 5, roomNo: 8, approachDir: "north" },
  { floor: 6, x: 4, y: 3, roomNo: 9, approachDir: "west" },
  { floor: 6, x: 6, y: 3, roomNo: 10, approachDir: "east" },
  { floor: 6, x: 5, y: 6, roomNo: 11, approachDir: "south" },
  { floor: 7, x: 1, y: 1, roomNo: 12, approachDir: null },
  { floor: 7, x: 6, y: 5, roomNo: 13, approachDir: "east" },
  { floor: 7, x: 4, y: 7, roomNo: 14, approachDir: "west" },
  { floor: 7, x: 7, y: 7, roomNo: 15, approachDir: "west" },
];

async function seedLoadout(page: Page): Promise<void> {
  await page.evaluate(
    ([bow, ring, arrows, sword]) => {
      const st = (window as unknown as { __u5test: { game: { state: any } } }).__u5test.game.state;
      for (let i = 0; i < st.partySize; i++) {
        const c = st.characters[i];
        if (!c) continue;
        c.level = 8; c.maxHp = 240; c.currentHp = 240; c.strength = 30; c.dexterity = 30; c.intelligence = 30;
        c.status = "G"; c.weapon = bow; c.ring = ring; c.currentMp = 99;
        // Respaldo melé en la segunda mano — ver la cabecera de SHORT_SWORD: al agotarse las
        // flechas el arco se desequipa (FIEL), y sin esto la party sigue la cadena a puñetazos.
        c.shield = sword;
      }
      st.equipmentQuantities[arrows] = 99;
      st.lightSpellMins = 9999;
      st.spellQuantities[22] = 99; // Des Por
      for (let i = 0; i < st.reagentQuantities.length; i++) st.reagentQuantities[i] = 99;
    },
    [MAGIC_BOW, RING_INVIS, ARROWS, SHORT_SWORD] as const,
  );
}

/**
 * Modelo CONTINUO (mazmorra ENCADENADA): entra UNA vez y conquista en cadena SIN re-importar
 * — la party navega de sala en sala en un solo descenso; cada sala conquistada queda RoomsBroke
 * (pasable, fix 0xA) y ABRE el paso a la siguiente. Barre las salas no-conquistadas: la que su
 * approach YA es alcanzable desde la posición actual se conquista (VICTORY/DEADEND/…); la que
 * aún no (THROW:sin-plan) se reintenta en el siguiente pase. Punto fijo: cuando un pase entero
 * no gana nada nuevo, lo que quede THROW es DURA/PENDIENTE (bolsillo que la cadena no destraba).
 * [HISTÓRICO 2026-07-25: la cola «DURA/PENDIENTE» está CERRADA — Fase 2b terminada, 112/112
 *  selladas (main 76fb75c9); un THROW residual hoy sería regresión, no pendiente. El mecanismo
 *  de punto fijo descrito sigue siendo el algoritmo vivo del spec.]
 */
/** Bit de sala-despejada (DNGLOOK 0x0844), idx dinámico con colapso Despise (Hythloth loc
 *  39 → idx 6 → colapso → 5 → bit=(5<<4)+roomNo). GUARDA ANTI-FAB: VICTORY sin este bit = rojo. */
async function roomBitSet(page: Page, roomNo: number): Promise<boolean> {
  return page.evaluate((rn) => {
    const g = (window as unknown as { __u5test: { game: { dungeonState: any; state: { dungeonRoomsCleared?: number[] } } } }).__u5test.game;
    const ds = g.dungeonState;
    if (!ds) return false;
    let idx = (ds.pos.dungeon as number) - 0x21;
    if (idx >= 1) idx -= 1;
    const bit = (idx << 4) + rn;
    const bits = g.state.dungeonRoomsCleared;
    return !!bits && (((bits[bit >> 3] ?? 0) >> (bit & 7)) & 1) === 1;
  }, roomNo);
}

async function runHythloth(page: Page): Promise<{ digest: string; outcomes: Record<number, string> }> {
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  const entry = await enterDungeon(page, HYTHLOTH);
  expect(entry, "entra a Hythloth por la cima (floor 0)").toMatchObject({ dungeon: HYTHLOTH, floor: 0 });

  const outcomes: Record<number, string> = {};
  for (const r of ROOMS) if (r.approachDir === null) outcomes[r.roomNo] = "SKIP-pend-entrada-murada";
  const resolved = (o?: string) => !!o && !o.startsWith("THROW"); // conquistada/sellada (no reintentar)
  let progress = true;
  while (progress) {
    progress = false;
    for (const r of ROOMS) {
      if (r.approachDir === null || resolved(outcomes[r.roomNo])) continue;
      try {
        const v = await conquerRoomAt(page, { roomCell: { floor: r.floor, x: r.x, y: r.y }, approachDir: r.approachDir, maxRounds: 600 });
        // GUARDA ANTI-FAB: VICTORY debe traer el bit de sala-despejada; sin él = fabricada (rojo).
        outcomes[r.roomNo] = v.outcome === "VICTORY" && !(await roomBitSet(page, r.roomNo)) ? "VICTORY-SIN-BIT(!)" : v.outcome;
        progress = true; // conquistar/sellar puede abrir paso a otra sala → re-barrer
      } catch (e) {
        outcomes[r.roomNo] = `THROW:${(e as Error).message.slice(0, 40)}`; // inalcanzable ESTE pase; reintenta
      }
    }
  }
  const digest = ROOMS.map((r) => `${r.roomNo}:${outcomes[r.roomNo]}`).join("|");
  return { digest, outcomes };
}

test.describe.serial("FASE 2 — ch26 salas de Hythloth (pasada-1 de cima, modelo CONTINUO)", () => {
  test("conquista en cadena las salas alcanzables desde la cima (8) + censa el resto", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const t0 = Date.now();
    const { digest, outcomes } = await runHythloth(page);
    const secs = Math.round((Date.now() - t0) / 1000);
    const tally = Object.values(outcomes).reduce<Record<string, number>>((a, o) => {
      const k = o.startsWith("THROW") ? "THROW" : o;
      a[k] = (a[k] ?? 0) + 1; return a;
    }, {});
    console.log(`[ch26-hythloth] ${secs}s outcomes=${JSON.stringify(tally)}`);
    console.log(`[ch26-hythloth] digest=${digest}`);

    // VEREDICTOS (seed-0, modelo continuo, spawn FIEL P0a) — RE-BASELINE HONESTO al core
    // POST-monster-3d (relevo regr-r13, 2026-07-25). La pasada-1 de este censo (10V/4D con
    // r13=VICTORY) selló en un core SIN el errante 3D; el errante aterrizó DESPUÉS (por eso
    // existe esta ventana de resello: «los digests de mazmorra se moverán»). La cadena de HOY
    // pelea combates de errante en ruta que la pasada-1 nunca vio + `clearBlockingWanderer` es
    // LOAD-BEARING (sin el (A)taque el resolvedor de arena se atasca, r1-5 THROW) → el stream
    // de pasada-1 es IRRECUPERABLE POR CONSTRUCCIÓN. Bajo el stream nuevo r13 pierde su primer
    // intento Y las re-entradas frescas (regla LOST-retry ×1) RE-PIERDEN DETERMINISTA
    // (DEADEND:e9:d1 ×2) → r13 es DEADEND-DE-CADENA (desgaste continuo + errante), no dead-end
    // estructural. CAREO / AUTORIDAD DE GANABILIDAD: el REGISTRO POR-SALA mantiene r13=VICTORY
    // (la sala SE GANA con party fresca; el registro por-sala ES la constancia — no se re-prueba
    // aquí). Este spec de CADENA mide el modelo continuo, donde r13 cae por desgaste. Regla
    // LOST-retry incluida en el baseline (disparó en r13 y en un censo-DEADEND LOST-type; NINGUNO
    // movió su outcome → gate empírico sano). Determinista ×2; toda VICTORY trae el bit de
    // sala-despejada (guarda anti-fab roomBitSet). Censo Hythloth: 9V/5D, 14 alcanzables en cadena.
    for (const n of [0, 2, 3, 7, 8, 9, 10, 14, 15]) expect(outcomes[n], `sala ${n} VICTORY`).toBe("VICTORY");
    // r13 = DEADEND-DE-CADENA (ganable en fresco por registro por-sala; pierde por desgaste en la cadena).
    for (const n of [1, 4, 5, 11, 13])
      // DETECTOR (no «fiel»): sin derivación por sala. OJO r13 — el comentario de ARRIBA dice que
      // es GANABLE en fresco y sólo cae por desgaste de la cadena, así que llamarla «fiel» se
      // contradecía a dos líneas de distancia (barrido prosa-autofiel 07-27).
      expect(outcomes[n], `sala ${n}: DEADEND del PORT (baseline medido; r13 = de-cadena, NO inganable)`).toBe("DEADEND");
    // Muradas de fondo (sin approach aun con conquista).
    for (const n of [6, 12]) expect(outcomes[n], `sala ${n} murada`).toBe("SKIP-pend-entrada-murada");
    expect(tally.VICTORY, "9 VICTORY (r13 cae a DEADEND-de-cadena en el core post-monster-3d)").toBe(9);
    expect(tally.DEADEND, "5 DEADEND (1/4/5/11 estructurales + r13 de-cadena)").toBe(5);
    expect((tally.VICTORY ?? 0) + (tally.DEADEND ?? 0), "14 alcanzables jugadas en cadena").toBe(14);
  });

  test("determinismo ×2: dos pasadas de cima frescas dan el MISMO digest", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const a = await runHythloth(page);
    const b = await runHythloth(page);
    expect(b.digest, "digest de outcomes byte-idéntico bajo reseed(0)").toBe(a.digest);
  });
});
