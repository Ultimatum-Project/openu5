/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2b LOTE-2 (ítem 2) — ch36: Deceit r11 (#27, f7 7,4) por su ENTRADA-POR-ARRIBA f7(7,3).
 *
 * HISTORIA: ch31 la dejó THROW («sin plan desde (7,0,5)») — pero NO por falta de ruta: el
 * fixpoint de ch31 atacaba r11 la ÚLTIMA, con la party ya VARADA en el bolsillo f7{(1,4),(1,5)}
 * tras conquistar r12/r14 (bolsillo sin salida no-sala: r10(1,3)/r12(0,4)/r14(0,5) lo emparedan
 * y el único escape es a través de r13/r11 SIN conquistar). La vía FONDO está muerta de verdad
 * (exige conquistar r13=#29 primero). La entrada real es POR ARRIBA y FRESCA:
 *
 * DERIVACIÓN ESTÁTICA (mirror `re/tools/dungeon_pocket_reach.py --loc 33 --from 0,1,1 --to 7,7,3`,
 * VÁLIDA incluso con --rooms-blocked = sin conquistar NADA): f0(1,1)→(1,3)→(0,3)→WRAP-oeste→(7,3)
 * →foso f0(7,2) que ENCADENA a f2(7,2)→Des Por ×4 por la columna (7,2) hasta f6→(7,3)→Des Por
 * →f7(7,3) = celda de approach. Desde ahí, paso al SUR → r11. Cero salas de paso.
 *
 * VEREDICTO ABIERTO: r11 debe RESOLVER limpio (VICTORY | DEADEND | DEADEND-STUCK), nunca
 * FAIL/THROW. Si el runtime NO da plan (refutando la estática), el sello sería SIN-ENTRADA-fiel
 * (patrón ch33/r9) — se detectaría aquí como THROW y sería hallazgo a documentar, no verde.
 * Determinismo ×2 (digest).
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, enterDungeon, conquerRoomAt } from "./nav";

const PREV_CHAPTER = "ch13";
const DECEIT = 33;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;
const R11 = { floor: 7, x: 7, y: 4 };

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
      st.spellQuantities[22] = 99; // Des Por (obligatorio: la columna (7,2) se desciende mágicamente)
      for (let i = 0; i < st.reagentQuantities.length; i++) st.reagentQuantities[i] = 99;
    },
    [MAGIC_BOW, RING_INVIS, ARROWS] as const,
  );
}

/** Bit de sala-despejada de Deceit r11 (DNGLOOK 0x0844; idx colapsa Despise). */
async function r11ClearedBit(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const g = (window as unknown as { __u5test: { game: { state: { dungeonRoomsCleared?: number[] } } } }).__u5test.game;
    const bits = g.state.dungeonRoomsCleared;
    const bit = (0 << 4) + 11; // Deceit idx=0, roomNo 11
    return !!bits && (((bits[bit >> 3] ?? 0) >> (bit & 7)) & 1) === 1;
  });
}

async function runR11(page: Page): Promise<string> {
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  await enterDungeon(page, DECEIT);
  if (await r11ClearedBit(page)) return "PRE-CLEARED(!)"; // guarda anti-fabricación: el sello debe JUGARSE
  try {
    // approach "south": la party entra a r11(7,4) moviéndose al sur desde f7(7,3) — la única
    // vecina no-muro no-sala (arriba muro=OOB imposible; oeste r13 sin conquistar; abajo OOB f7).
    const v = await conquerRoomAt(page, { roomCell: R11, approachDir: "south", maxRounds: 600, maxIters: 120 });
    const bit = v.outcome === "VICTORY" ? ` bit=${await r11ClearedBit(page)}` : "";
    console.log(`[ch36-deceit-r11] digest=${v.digest}${bit}`);
    if (v.outcome === "VICTORY" && !(await r11ClearedBit(page))) return "VICTORY-SIN-BIT(!)";
    return v.outcome;
  } catch (e) {
    return `THROW:${(e as Error).message.slice(0, 60)}`;
  }
}

test.describe.serial("FASE 2b lote-2 — ch36 Deceit r11 por la entrada-de-arriba f7(7,3)", () => {
  test("r11 se alcanza FRESCA desde la cima (wrap + foso encadenado + Des Por) y RESUELVE limpio", async ({ page }) => {
    test.setTimeout(chapterTimeout(600_000));
    const t0 = Date.now();
    const outcome = await runR11(page);
    const secs = Math.round((Date.now() - t0) / 1000);
    console.log(`[ch36-deceit-r11] ${secs}s outcome=${outcome}`);
    const OK = ["VICTORY", "DEADEND", "DEADEND-STUCK"];
    expect(OK, `r11 resuelve limpio (no FAIL/THROW): ${outcome}`).toContain(outcome);
  });

  test("determinismo ×2: dos pasadas frescas dan el MISMO outcome", async ({ page }) => {
    test.setTimeout(chapterTimeout(1_200_000));
    const a = await runR11(page);
    const b = await runR11(page);
    expect(b, "outcome byte-idéntico bajo reseed(0)").toBe(a);
  });
});
