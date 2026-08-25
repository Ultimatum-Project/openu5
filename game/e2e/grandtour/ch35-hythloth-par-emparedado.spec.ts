/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2b LOTE-2 (ítem 1) — ch35: el PAR EMPAREDADO r1/r2 de Hythloth (f0 5,5 / 6,5), los 2
 * últimos nav-pending del compartimento superior (ch30 los dejó SKIP-nav-pending).
 *
 * DERIVACIÓN ESTÁTICA (mirror `re/tools/dungeon_pocket_reach.py --loc 39 --from 0,1,1 --to 0,7,5`):
 * la ÚNICA entrada del par es la puerta SECRETA f0(7,5), y su approach desde la cima exige DOS
 * WRAPS TOROIDALES same-floor (f1 (3,0)→(3,7) norte; f0 (0,5)→(7,5) oeste) además de cruzar DOS
 * salas como RoomsBroke: r7 (f4 1,4, la roca de paso de ch30) y r0 (f0 5,1, la sala-escalera).
 * El wrap es GEOMETRÍA REAL del original (DUNGEON:0x057a/0x0583 — wrap por eje, NO clamp) y tanto
 * `planDungeonDescent` como el core ya lo modelan; lo que faltaba era la SECUENCIA de prerrequisitos
 * (r7+r0 conquistadas ANTES de rutar el wrap — sin r0 RoomsBroke el planner no tiene plan, y el
 * fixpoint de ch30 atacaba r1/r2 con la party en bolsillos post-conquista).
 *
 * SECUENCIA (reset-cima antes de cada sala, patrón ch30):
 *   r7 (f4 1,4, approach south)  — abre el paso de la columna x1 en f4.
 *   r0 (f0 5,1, enterByLadder up) — abre la boca del compartimento en f0.
 *   r2 (f0 6,5, approach west)   — entrada por la SECRETA (7,5) tras el wrap oeste de f0.
 *   r1 (f0 5,5, approach west)   — a través de r2 CONQUISTADA (0xA); si r2 NO se conquista
 *                                  (DEADEND), r1 queda SIN-ENTRADA-encadenada (hallazgo, no fallo).
 *
 * VEREDICTO ABIERTO: no se pre-aserta VICTORY/DEADEND; se exige que r2 RESUELVA limpio
 * (VICTORY | DEADEND | DEADEND-STUCK, nunca FAIL/THROW) y que r1 resuelva limpio SI r2 fue
 * VICTORY (si no, su `THROW:sin plan` ES el sello encadenado). Determinismo ×2 (digest).
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, enterDungeon, conquerRoomAt } from "./nav";

const PREV_CHAPTER = "ch13";
const HYTHLOTH = 39;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;

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
      st.spellQuantities[22] = 99; // Des Por
      for (let i = 0; i < st.reagentQuantities.length; i++) st.reagentQuantities[i] = 99;
    },
    [MAGIC_BOW, RING_INVIS, ARROWS] as const,
  );
}

/** Teleport a la entrada canónica de cima f0(1,1) (ch30: el bitmap de salas SOBREVIVE). */
async function resetCima(page: Page): Promise<void> {
  await page.evaluate((id) => (window as unknown as { __u5debug: { teleportDungeon: (d: number, f: number, x: number, y: number) => void } }).__u5debug.teleportDungeon(id, 0, 1, 1), HYTHLOTH);
}

type Entry = { approachDir: "north" | "east" | "south" | "west" } | { enterByLadder: "up" | "down" };
const SEQ: Array<{ roomNo: number; floor: number; x: number; y: number; entry: Entry }> = [
  { roomNo: 7, floor: 4, x: 1, y: 4, entry: { approachDir: "south" } }, // roca de paso (ch30 FASE A)
  { roomNo: 0, floor: 0, x: 5, y: 1, entry: { enterByLadder: "up" } }, // boca del compartimento
  { roomNo: 2, floor: 0, x: 6, y: 5, entry: { approachDir: "west" } }, // por la SECRETA (7,5), wrap oeste
  { roomNo: 1, floor: 0, x: 5, y: 5, entry: { approachDir: "west" } }, // a través de r2 (0xA)
];

async function runPar(page: Page): Promise<{ digest: string; outcomes: Record<number, string> }> {
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  await enterDungeon(page, HYTHLOTH);

  const outcomes: Record<number, string> = {};
  for (const r of SEQ) {
    try {
      await resetCima(page); // arranque fresco desde la entrada (las rutas parten de la cima)
      // ambushMode "territory": este par emparedado sella con la máquina nueva (detección de
      // emboscada por territorio + enterRoomThroughAmbush + clearBlockingWanderer). OPT-IN
      // explícito — el resto de capítulos corre en legacy (stream pass-1).
      const base = { roomCell: { floor: r.floor, x: r.x, y: r.y }, maxRounds: 600, maxIters: 250, ambushMode: "territory" as const };
      const spec = "enterByLadder" in r.entry
        ? { ...base, enterByLadder: r.entry.enterByLadder }
        : { ...base, approachDir: r.entry.approachDir };
      const v = await conquerRoomAt(page, spec);
      outcomes[r.roomNo] = v.outcome;
    } catch (e) {
      outcomes[r.roomNo] = `THROW:${(e as Error).message.slice(0, 60)}`;
    }
  }
  const digest = SEQ.map((r) => `${r.roomNo}:${outcomes[r.roomNo]}`).join("|");
  return { digest, outcomes };
}

test.describe.serial("FASE 2b lote-2 — ch35 par emparedado r1/r2 de Hythloth (secreta + wrap toroidal)", () => {
  test("r2 y r1 se abren por la secreta f0(7,5) tras r7+r0 y RESUELVEN limpio", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const t0 = Date.now();
    const { digest, outcomes } = await runPar(page);
    const secs = Math.round((Date.now() - t0) / 1000);
    console.log(`[ch35-hyth-par] ${secs}s digest=${digest}`);
    const OK = ["VICTORY", "DEADEND", "DEADEND-STUCK"];
    // Prerrequisitos: r7 y r0 resuelven limpio (ambos VICTORY históricos, ch26/ch30).
    for (const n of [7, 0]) expect(OK, `prerrequisito sala ${n} resuelve limpio`).toContain(outcomes[n]);
    // r2: el objetivo con entrada propia (secreta+wrap) — debe RESOLVER limpio, nunca THROW.
    expect(OK, `r2 resuelve limpio (no FAIL/THROW): ${outcomes[2]}`).toContain(outcomes[2]);
    // r1: SOLO entra a través de r2 conquistada. Si r2 = VICTORY debe resolver limpio;
    // si r2 NO se conquistó, el `sin plan` de r1 es el sello encadenado (documentado).
    if (outcomes[2] === "VICTORY") {
      expect(OK, `r1 resuelve limpio a través de r2 (0xA): ${outcomes[1]}`).toContain(outcomes[1]);
    } else {
      expect(outcomes[1], "r1 SIN-ENTRADA-encadenada (r2 no conquistada)").toMatch(/^THROW:dungeonDescendTo: sin plan/);
    }
  });

  test("determinismo ×2: dos pasadas frescas dan el MISMO digest", async ({ page }) => {
    test.setTimeout(chapterTimeout(1_500_000));
    const a = await runPar(page);
    const b = await runPar(page);
    expect(b.digest, "digest de outcomes byte-idéntico bajo reseed(0)").toBe(a.digest);
  });
});
