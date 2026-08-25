/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2b (carril f2b-resto) — ch46: las 3 PENDIENTE-entrada de Destard (loc 35,
 * combatmap = 32 + roomNo): r0 (#32, f0 3,1), r1 (#33, f0 7,7), r10 (#42, f6 4,5).
 *
 * roomNos CONFIRMADOS contra ch22 (PEND = {0,1,10}) y dungeons.json (type 0xF, sub&0xF).
 *
 * DERIVACIÓN ESTÁTICA (mirror `re/tools/dungeon_pocket_reach.py --loc 35`, wrap toroidal +
 * Des Por + encadenado de fosos; Destard tiene 0 campos type-8 → inmune a fieldsPassable):
 *   · r0 (f0 3,1, murada 4 lados): semilla = LadderUp f1(3,1) (klimb-up aterriza en la sala).
 *     Ruta: f0(1,1)→corredor sur (3,3)..(3,7)→Des Por→f1(3,7)→WRAP-sur→(3,0)→(3,1) → klimb-up.
 *   · r1 (f0 7,7, murada 4 lados): semilla = LadderUp f1(7,7).
 *     Ruta: Des Por en (1,1)→f1→(0,1)→WRAP-oeste→(7,1)→(7,0)→WRAP-norte→(7,7) → klimb-up.
 *   · r10 (f6 4,5, bolsillo del triaje = ÚNICO candidato-dead-end del censo en Destard, #42,
 *     7 triggers Bat): approach NORTE f6(4,4) SÍ tiene plan fresco desde la cima:
 *     Des Por ×2 (columna 1,1)→f2→wrap→(1,6)→Des Por ×2→f4(1,6)→(3,6)→(3,5)→(3,4)→Des Por→
 *     f5(3,4)→(4,4)→Des Por→f6(4,4). El «sin plan» de ch22 se midió desde (6,3,1)/(6,7,3)
 *     — party ya varada en floor6 tras la secuencia (patrón orden-del-fixpoint, como ch36
 *     r11-Deceit); FRESCO desde la cima el plan existe. El runtime decide aquí.
 *
 * VEREDICTO ABIERTO por sala: VICTORY | DEADEND | DEADEND-STUCK (jamás FAIL/THROW; un
 * «sin plan» sería hallazgo que refuta la estática y se documenta, no verde). r10 con
 * placas (default de conquerRoom) → clasifica ganable-con-placa vs dead-end-fiel.
 * Entrada FRESCA por sala (un DEADEND no contamina al siguiente). Guarda anti-fabricación:
 * VICTORY exige bit de sala-despejada (DNGLOOK 0x0844; Destard idx=1 tras colapso Despise).
 * Determinismo ×2.
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, enterDungeon, conquerRoomAt, type DFacing } from "./nav";

const PREV_CHAPTER = "ch13";
const DESTARD = 35;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;

const ROOMS: Array<{
  label: string;
  roomNo: number;
  roomCell: { floor: number; x: number; y: number };
  spec: { enterByLadder?: "down" | "up"; approachDir?: DFacing };
}> = [
  { label: "r0", roomNo: 0, roomCell: { floor: 0, x: 3, y: 1 }, spec: { enterByLadder: "up" } },
  { label: "r1", roomNo: 1, roomCell: { floor: 0, x: 7, y: 7 }, spec: { enterByLadder: "up" } },
  { label: "r10", roomNo: 10, roomCell: { floor: 6, x: 4, y: 5 }, spec: { approachDir: "south" } },
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
      st.spellQuantities[22] = 99; // Des Por — obligatorio (rutas de r0/r1/r10 lo usan)
      for (let i = 0; i < st.reagentQuantities.length; i++) st.reagentQuantities[i] = 99;
    },
    [MAGIC_BOW, RING_INVIS, ARROWS] as const,
  );
}

/** Bit de sala-despejada (DNGLOOK 0x0844): Destard = loc 35 → idx 35-0x21=2 → colapso Despise → 1. */
async function clearedBit(page: Page, roomNo: number): Promise<boolean> {
  return page.evaluate((rn) => {
    const g = (window as unknown as { __u5test: { game: { state: { dungeonRoomsCleared?: number[] } } } }).__u5test.game;
    const bits = g.state.dungeonRoomsCleared;
    const bit = (1 << 4) + rn;
    return !!bits && (((bits[bit >> 3] ?? 0) >> (bit & 7)) & 1) === 1;
  }, roomNo);
}

/** Una sala, entrada FRESCA (boot+checkpoint+reseed propios). */
async function runRoom(page: Page, room: (typeof ROOMS)[number]): Promise<string> {
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  await enterDungeon(page, DESTARD);
  if (await clearedBit(page, room.roomNo)) return "PRE-CLEARED(!)";
  try {
    const v = await conquerRoomAt(page, { roomCell: room.roomCell, ...room.spec, maxRounds: 600, maxIters: 120 });
    const bit = v.outcome === "VICTORY" ? ` bit=${await clearedBit(page, room.roomNo)}` : "";
    console.log(`[ch46-destard] ${room.label} digest=${v.digest}${bit}`);
    if (v.outcome === "VICTORY" && !(await clearedBit(page, room.roomNo))) return "VICTORY-SIN-BIT(!)";
    return v.outcome;
  } catch (e) {
    return `THROW:${(e as Error).message.slice(0, 60)}`;
  }
}

async function runAll(page: Page): Promise<string> {
  const parts: string[] = [];
  for (const r of ROOMS) parts.push(`${r.label}=${await runRoom(page, r)}`);
  return parts.join("|");
}

test.describe.serial("FASE 2b — ch46 Destard r0/r1/r10 (entradas derivadas, veredicto ABIERTO)", () => {
  test("las 3 se alcanzan por su entrada derivada y RESUELVEN limpio", async ({ page }) => {
    test.setTimeout(chapterTimeout(1_500_000));
    const t0 = Date.now();
    const digest = await runAll(page);
    const secs = Math.round((Date.now() - t0) / 1000);
    console.log(`[ch46-destard] ${secs}s ${digest}`);
    const OK = ["VICTORY", "DEADEND", "DEADEND-STUCK"];
    for (const part of digest.split("|")) {
      const outcome = part.split("=")[1]!;
      expect(OK, `${part}: resuelve limpio (no FAIL/THROW)`).toContain(outcome);
    }
  });

  test("determinismo ×2: dos pasadas frescas dan el MISMO digest", async ({ page }) => {
    test.setTimeout(chapterTimeout(3_000_000));
    const a = await runAll(page);
    const b = await runAll(page);
    expect(b, "digest byte-idéntico bajo reseed(0)").toBe(a);
  });
});
