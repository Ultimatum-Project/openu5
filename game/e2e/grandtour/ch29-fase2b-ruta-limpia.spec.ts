/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2b — ch29: primer bocado REAL de la cola de entrada. Las 6 salas-duras con **semilla de
 * escalera + RUTA-LIMPIA** (el pather actual llega a la celda-escalera desde la cima) — ver la
 * tabla de reachability en `docs/plan-fase2b-stubs.md`. Cada una se entra por `enterByLadder`
 * (klimbar la escalera aterriza sobre la sala → combate), reusando el mecanismo YA EN MAIN.
 *
 * Las 6 (dungeon · sala · escalera-semilla · dir):
 *   Deceit  r2 (#18, f2 1,1)  ← LadderDown  f1(1,1)  "down"
 *   Shame   r4 (#84, f5 5,2)  ← LadderUp    f6(5,2)  "up"
 *   Shame   r5 (#85, f5 1,0)  ← LadderUp    f6(1,0)  "up"
 *   Shame  r15 (#95, f6 7,6)  ← LadderUpDn  f5(7,6)  "down"
 *   Hythloth r6 (#102,f4 5,0) ← LadderUp    f5(5,0)  "up"
 *   Hythloth r12(#108,f7 1,1) ← LadderUpDn  f6(1,1)  "down"
 *
 * VEREDICTO ABIERTO: NO se pre-aserta VICTORY/DEADEND por sala (el veredicto REAL lo sella la
 * primera corrida bajo spawn fiel P0a). El aserto exige sólo que cada sala RESUELVA limpio
 * (VICTORY | DEADEND | DEADEND-STUCK) — NUNCA FAIL (party derrotada) ni THROW (arnés atascado):
 * eso sería rojo investigable. Determinismo ×2. Loadout ranged + Des Por (descenso a la escalera).
 *
 * ⚠️ ESCRITO SIN CORRER (ventana e2e de otro carril): pendiente de ventana del lead para la 1ª
 * corrida aislada. Al medir, los outcomes se anotan al censo como pasada-de-FONDO/DURA jugada.
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, enterDungeon, conquerRoomAt } from "./nav";

const PREV_CHAPTER = "ch13";
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;

const ROOMS: Array<{ label: string; dungeon: number; floor: number; x: number; y: number; enterByLadder: "down" | "up" }> = [
  { label: "deceit-r2", dungeon: 33, floor: 2, x: 1, y: 1, enterByLadder: "down" },
  { label: "shame-r4", dungeon: 38, floor: 5, x: 5, y: 2, enterByLadder: "up" },
  { label: "shame-r5", dungeon: 38, floor: 5, x: 1, y: 0, enterByLadder: "up" },
  { label: "shame-r15", dungeon: 38, floor: 6, x: 7, y: 6, enterByLadder: "down" },
  { label: "hythloth-r6", dungeon: 39, floor: 4, x: 5, y: 0, enterByLadder: "up" },
  { label: "hythloth-r12", dungeon: 39, floor: 7, x: 1, y: 1, enterByLadder: "down" },
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
      st.spellQuantities[22] = 99; // Des Por (descenso a la celda-escalera)
      for (let i = 0; i < st.reagentQuantities.length; i++) st.reagentQuantities[i] = 99;
    },
    [MAGIC_BOW, RING_INVIS, ARROWS] as const,
  );
}

/** Entra a UNA sala por su escalera-semilla desde una entrada FRESCA (cima → ruta → klimb → sala). */
async function conquerByLadder(page: Page, r: (typeof ROOMS)[number]): Promise<string> {
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  await enterDungeon(page, r.dungeon);
  try {
    const v = await conquerRoomAt(page, { roomCell: { floor: r.floor, x: r.x, y: r.y }, enterByLadder: r.enterByLadder, maxRounds: 600 });
    return v.outcome;
  } catch (e) {
    return `THROW:${(e as Error).message.slice(0, 40)}`;
  }
}

async function runPass(page: Page): Promise<{ digest: string; outcomes: Record<string, string> }> {
  const outcomes: Record<string, string> = {};
  for (const r of ROOMS) outcomes[r.label] = await conquerByLadder(page, r);
  const digest = ROOMS.map((r) => `${r.label}:${outcomes[r.label]}`).join("|");
  return { digest, outcomes };
}

test.describe.serial("FASE 2b — ch29 ruta-limpia (6 salas por enterByLadder, veredicto ABIERTO)", () => {
  test("las 6 salas ruta-limpia RESUELVEN limpio (VICTORY/DEADEND/DEADEND-STUCK, nunca FAIL/THROW)", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const t0 = Date.now();
    const { digest, outcomes } = await runPass(page);
    const secs = Math.round((Date.now() - t0) / 1000);
    const tally = Object.values(outcomes).reduce<Record<string, number>>((a, o) => {
      const k = o.startsWith("THROW") ? "THROW" : o;
      a[k] = (a[k] ?? 0) + 1; return a;
    }, {});
    console.log(`[ch29-ruta-limpia] ${secs}s outcomes=${JSON.stringify(tally)}`);
    console.log(`[ch29-ruta-limpia] digest=${digest}`);
    // Veredicto ABIERTO: cada sala debe RESOLVER (sala conquistada o dead-end fiel), sin bugs.
    const OK = ["VICTORY", "DEADEND", "DEADEND-STUCK"];
    for (const r of ROOMS) expect(OK, `sala ${r.label} resuelve limpio (no FAIL/THROW)`).toContain(outcomes[r.label]);
  });

  test("determinismo ×2: dos pasadas frescas dan el MISMO digest", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const a = await runPass(page);
    const b = await runPass(page);
    expect(b.digest, "digest de outcomes byte-idéntico bajo reseed(0)").toBe(a.digest);
  });
});
