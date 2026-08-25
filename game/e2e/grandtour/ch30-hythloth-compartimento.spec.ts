/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2b — ch30: el COMPARTIMENTO SUPERIOR AISLADO de Hythloth (r0-r5, floors 0/2/3). La pasada-1
 * (ch26) NO lo alcanzaba por walk-in (murado); este carril lo abre por el método **continuo+reset-cima**:
 *
 *   FASE A — conquistar la CADENA alcanzable (rooms 7,8,9,10,11,13,14,15, floors 4-7) como en ch26.
 *            Con el FIX #13 (main 06cdd2cb: `markRoomClearedAt` marca por la celda de ENTRADA en TODA
 *            victoria) la cadena ahora MARCA COMPLETA — en particular r7 (f4 1,4), la ROCA de paso.
 *   RESET-CIMA — teleport a la ENTRADA CANÓNICA de la cima f0(1,1) (`__u5debug.teleportDungeon`, que
 *            estando YA dentro sólo reubica `pos` y NO re-carga → el bitmap de salas-despejadas
 *            SOBREVIVE; se ASERTA byte-idéntico antes/después). Necesario porque tras la cadena la
 *            party queda en el FONDO y las puertas del compartimento están ARRIBA (f1/f3): el pather
 *            de descenso no asciende hasta ellas desde el fondo.
 *   FASE B+C — desde la cima, las puertas de escalera del compartimento pasan a ser ALCANZABLES porque
 *            el ÚNICO camino a ellas cruza r7 (f4 1,4), ahora RoomsBroke=pasable (derivado con
 *            `re/tools/dungeon_pocket_reach.py --loc 39 --from 0,1,1 --to 1,5,1`: baja columna x1 a
 *            f4, cruza r7, sube por x1/x7 a f1, navega a la puerta). r0 = `enterByLadder:"up"`
 *            (f1(5,1)↑→r0/f0(5,1)); r3 = `enterByLadder:"up"` (f3(7,6)↑→r3/f2(7,6)); el CONTINUO
 *            destraba r1/r2/r4/r5 (approach-de-cadena). Un bucle fixpoint; las THROW se reintentan.
 *
 * VEREDICTO ABIERTO: no se pre-aserta VICTORY/DEADEND por sala; el aserto exige que el COMPARTIMENTO
 * (r0-r5) RESUELVA limpio (VICTORY | DEADEND | DEADEND-STUCK), nunca FAIL/THROW. Determinismo ×2.
 *
 * REACTIVADO (VENTANA-#13) tras el fix del LATCH: `Combat.maybeLatchVictory` latchea la victoria al
 * LIMPIAR el bando enemigo (tras cada `kill`, chequeo post-acción del binario 0x0cf6), con el gate de
 * party relajado a «VIVA» (no «activa en tablero»). Antes las 5 walk-in de la cadena mataban a TODOS
 * (enemiesAlive=0) pero NO latcheaban (el golpe mortal dejaba armas en cola → no avanzaba el turno, y
 * la party salía por el borde antes de que `advanceTurn` re-evaluara) → 2/7 marcadas. Ahora latchean
 * al kill → `onVictoryLatch` marca → cadena 7/7 → r7 (roca de paso f4 1,4) RoomsBroke → el reset-cima
 * alcanza las 2 puertas del compartimento. (Forense: eran KILLS reales, NO contaminación.)
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, enterDungeon, conquerRoomAt, type DFacing } from "./nav";

const PREV_CHAPTER = "ch13";
const HYTHLOTH = 39;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;

type Entry = { approachDir: DFacing } | { enterByLadder: "up" | "down" };
type Room = { roomNo: number; floor: number; x: number; y: number; entry: Entry };

// CADENA alcanzable de cima (floors 4-7) — mismos approach que ch26.
const CHAIN: Room[] = [
  { roomNo: 7, floor: 4, x: 1, y: 4, entry: { approachDir: "south" } },
  { roomNo: 8, floor: 5, x: 4, y: 5, entry: { approachDir: "north" } },
  { roomNo: 9, floor: 6, x: 4, y: 3, entry: { approachDir: "west" } },
  { roomNo: 10, floor: 6, x: 6, y: 3, entry: { approachDir: "east" } },
  { roomNo: 11, floor: 6, x: 5, y: 6, entry: { approachDir: "south" } },
  { roomNo: 13, floor: 7, x: 6, y: 5, entry: { approachDir: "east" } },
  { roomNo: 14, floor: 7, x: 4, y: 7, entry: { approachDir: "west" } },
  { roomNo: 15, floor: 7, x: 7, y: 7, entry: { approachDir: "west" } },
];
// COMPARTIMENTO superior (r0-r5): r0/r3 por PUERTA de escalera; r1/r2/r4/r5 approach-de-cadena.
const COMPARTMENT: Room[] = [
  { roomNo: 0, floor: 0, x: 5, y: 1, entry: { enterByLadder: "up" } }, // f1(5,1)↑
  { roomNo: 3, floor: 2, x: 7, y: 6, entry: { enterByLadder: "up" } }, // f3(7,6)↑
  { roomNo: 4, floor: 2, x: 3, y: 5, entry: { approachDir: "south" } },
  { roomNo: 5, floor: 3, x: 5, y: 4, entry: { approachDir: "south" } },
];
// r1/r2 = PAR EMPAREDADO — RESUELTO EN LOTE-2 (ch35-hythloth-par-emparedado): r2 VICTORY +
// r1 DEADEND-fiel ×2. La causa raíz del «presupuesto agotado» histórico NO era el pather
// (planDungeonDescent y el core YA wrapean): era `DungeonState.search` SIN wrap toroidal en la
// celda ahead → la SECRETA f0(7,5) al otro lado del borde ((0,5)+oeste) era IRREVELABLE y el
// paso quedaba Blocked! en bucle. Fix de core con cita (SJOG:0x0698/0x06a3 `and 7`). Aquí se
// mantienen como SKIP para no duplicar la conquista (ch35 es su capítulo).
const NAV_PENDING = [1, 2];
// r6/r12 son muradas de FONDO (otra vía, no este carril).

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
      st.spellQuantities[22] = 99; // Des Por
      for (let i = 0; i < st.reagentQuantities.length; i++) st.reagentQuantities[i] = 99;
    },
    [MAGIC_BOW, RING_INVIS, ARROWS] as const,
  );
}

/**
 * RE-READY POR SALA (re-diseño post-#36; bisect re/notes/grandtour-salas-bisect.md §3).
 * #36 hizo fiel el desequipado por munición agotada: pool común EXACTAMENTE a 0 ⇒ barrido del
 * PARTY ENTERO por id de arma (SJOG 0x1b34 sobre `unequip_item` 0x6e60; acta
 * re/notes/municion-36-acta.md). La premisa «Magic Bow en toda la party + pool común 99 para
 * la cadena+compartimento ENTEROS» era frágil: el primer agotamiento desarmaba a todos y las
 * salas tardías colapsaban (r5 THROW «presupuesto agotado» — clase #167). Reponer+re-equipar
 * ANTES de cada sala es costura de arnés clase #47 (cero core, cero RNG — la cadena de
 * munición no consume RNG, acta #36 §6). 255 = techo del byte (add de reposición byte pelado
 * mod 256, COMSUBS 0x09ab). HP/anillos/posición no se tocan.
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

/** Copia del bitmap de salas-despejadas (`dungeonRoomsCleared`). */
async function readClearedBits(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const st = (window as unknown as { __u5test: { game: { state: { dungeonRoomsCleared?: number[] } } } }).__u5test.game.state;
    return Array.from(st.dungeonRoomsCleared ?? []);
  });
}

/** Teleport a la entrada canónica de cima f0(1,1). El bitmap de salas-despejadas SOBREVIVE. */
async function resetCima(page: Page): Promise<void> {
  await page.evaluate((id) => (window as unknown as { __u5debug: { teleportDungeon: (d: number, f: number, x: number, y: number) => void } }).__u5debug.teleportDungeon(id, 0, 1, 1), HYTHLOTH);
}

/** Corre un conjunto de salas en bucle fixpoint (entrada mixta), acumulando outcomes. Con
 *  `resetCima`, teletransporta a la entrada de cima ANTES de cada sala (arranque fresco desde
 *  donde las puertas son alcanzables — evita que la party quede en un bolsillo tras conquistar). */
async function runRooms(page: Page, rooms: Room[], outcomes: Record<number, string>, opts: { resetCima?: boolean; maxIters?: number } = {}): Promise<void> {
  const resolved = (o?: string) => !!o && !o.startsWith("THROW");
  let progress = true;
  while (progress) {
    progress = false;
    for (const r of rooms) {
      if (resolved(outcomes[r.roomNo])) continue;
      try {
        if (opts.resetCima) await resetCima(page);
        await rearmParty(page); // re-diseño post-#36: el pool nunca llega al cruce exacto-0
        const base = { roomCell: { floor: r.floor, x: r.x, y: r.y }, maxRounds: 600, maxIters: opts.maxIters };
        const spec = "enterByLadder" in r.entry
          ? { ...base, enterByLadder: r.entry.enterByLadder }
          : { ...base, approachDir: r.entry.approachDir };
        const v = await conquerRoomAt(page, spec);
        outcomes[r.roomNo] = v.outcome;
        progress = true; // conquistar/sellar abre paso a otra
      } catch (e) {
        outcomes[r.roomNo] = `THROW:${(e as Error).message.slice(0, 40)}`;
      }
    }
  }
}

async function runResetCima(page: Page): Promise<{ digest: string; outcomes: Record<number, string>; bitmapSurvived: boolean }> {
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  await enterDungeon(page, HYTHLOTH);

  const outcomes: Record<number, string> = {};
  // FASE A — cadena alcanzable (con #13 marca completa).
  await runRooms(page, CHAIN, outcomes);
  const bitsBefore = await readClearedBits(page);

  // RESET-CIMA — teleport SÓLO a la entrada canónica de cima f0(1,1); el bitmap debe SOBREVIVIR.
  await page.evaluate((id) => (window as unknown as { __u5debug: { teleportDungeon: (d: number, f: number, x: number, y: number) => void } }).__u5debug.teleportDungeon(id, 0, 1, 1), HYTHLOTH);
  const bitsAfter = await readClearedBits(page);
  const bitmapSurvived = JSON.stringify(bitsBefore) === JSON.stringify(bitsAfter);

  // FASE B+C — compartimento (puertas + continuo): reset-cima ANTES de cada sala (arranque fresco
  // desde la entrada, donde las puertas son alcanzables con la cadena marcada) + presupuesto de
  // pather ampliado (la ruta cima→puerta cruza f0→f4→f1, larga).
  await runRooms(page, COMPARTMENT, outcomes, { resetCima: true, maxIters: 250 });

  for (const n of NAV_PENDING) outcomes[n] = "SKIP-nav-pending";
  const order = [0, 1, 2, 3, 4, 5, ...CHAIN.map((r) => r.roomNo)];
  const digest = order.map((n) => `${n}:${outcomes[n]}`).join("|");
  return { digest, outcomes, bitmapSurvived };
}

test.describe.serial("FASE 2b — ch30 compartimento superior de Hythloth (continuo+reset-cima)", () => {
  test("abre el compartimento r0-r5 por reset-cima + puertas de escalera (veredicto ABIERTO)", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const t0 = Date.now();
    const { digest, outcomes, bitmapSurvived } = await runResetCima(page);
    const secs = Math.round((Date.now() - t0) / 1000);
    const tally = Object.values(outcomes).reduce<Record<string, number>>((a, o) => {
      const k = o.startsWith("THROW") ? "THROW" : o;
      a[k] = (a[k] ?? 0) + 1; return a;
    }, {});
    console.log(`[ch30-hyth-comp] ${secs}s outcomes=${JSON.stringify(tally)}`);
    console.log(`[ch30-hyth-comp] digest=${digest}`);
    // CONDICIÓN #3 del ruling (A): el bitmap de salas-despejadas SOBREVIVE al teleportDungeon.
    expect(bitmapSurvived, "el bitmap de salas-despejadas sobrevive al reset-cima (teleportDungeon no resetea estado)").toBe(true);
    // Veredicto ABIERTO: el COMPARTIMENTO (r0-r5) debe RESOLVER limpio; una THROW = hallazgo.
    const OK = ["VICTORY", "DEADEND", "DEADEND-STUCK"];
    // El compartimento ALCANZABLE (r0/r3 por puerta de escalera + r4/r5 por continuo) resuelve limpio.
    // r1/r2 = par emparedado nav-pending (lote-2, wrap toroidal del pather) — documentado, no aserto.
    for (const n of [0, 3, 4, 5]) expect(OK, `compartimento sala ${n} resuelve limpio`).toContain(outcomes[n]);
  });

  test("determinismo ×2: dos pasadas frescas dan el MISMO digest", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const a = await runResetCima(page);
    const b = await runResetCima(page);
    expect(b.digest, "digest de outcomes byte-idéntico bajo reseed(0)").toBe(a.digest);
  });
});
