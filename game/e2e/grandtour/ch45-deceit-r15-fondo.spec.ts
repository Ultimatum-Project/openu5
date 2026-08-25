/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2b (carril f2b-resto) — ch45: Deceit r15 (#31, f7 7,7) por la pasada de FONDO.
 *
 * MECANISMO (stub §DECEIT-fondo + esbozo enterFromUnderworld, validado ch28/ch32): la
 * entrada de Underworld de Deceit aterriza EXACTAMENTE en floor7 (7,7) = LA CELDA DE r15.
 * Como en el quirk de entrada de Shame (spawn ≠ pisar, plan-fase2b-stubs.md §QUIRK): el
 * spawn NO dispara el combate; la party sale andando al paso (7,6) — la única vecina
 * no-muro no-sala del bolsillo {r15(7,7), paso(7,6)}, sellado al norte por r13(7,5)=#29 —
 * y RE-ENTRA moviéndose al sur → combate de r15.
 *
 * Si el spawn SÍ disparara el combate (refutando el quirk para el fondo), se resuelve
 * directamente — ambas vías son el mecanismo real, y el veredicto es del binario.
 *
 * VEREDICTO ABIERTO: VICTORY | DEADEND | DEADEND-STUCK (jamás FAIL/THROW). El censo
 * censa cm31 como «winnable-móvil» (5 sellados Dragon/Ettin/Troll, trig-at≠pisable).
 * Guarda anti-fabricación: VICTORY exige el bit de sala-despejada (DNGLOOK 0x0844).
 * Determinismo ×2.
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, enterFromUnderworld, conquerRoomAt, conquerRoom, inDungeonCombat } from "./nav";

const PREV_CHAPTER = "ch13";
const DECEIT = 33;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;
const R15 = { floor: 7, x: 7, y: 7 };

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
      st.spellQuantities[22] = 99; // Des Por (inocuo en floor7; loadout estándar #47)
      for (let i = 0; i < st.reagentQuantities.length; i++) st.reagentQuantities[i] = 99;
    },
    [MAGIC_BOW, RING_INVIS, ARROWS] as const,
  );
}

/** Bit de sala-despejada de Deceit r15 (DNGLOOK 0x0844; Deceit idx=0, roomNo 15). */
async function r15ClearedBit(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const g = (window as unknown as { __u5test: { game: { state: { dungeonRoomsCleared?: number[] } } } }).__u5test.game;
    const bits = g.state.dungeonRoomsCleared;
    const bit = (0 << 4) + 15;
    return !!bits && (((bits[bit >> 3] ?? 0) >> (bit & 7)) & 1) === 1;
  });
}

async function runR15(page: Page): Promise<string> {
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  await enterFromUnderworld(page, DECEIT); // aterriza en (7,7,7) oeste = la celda de r15
  if (await r15ClearedBit(page)) return "PRE-CLEARED(!)"; // el sello debe JUGARSE
  try {
    let v;
    if (await inDungeonCombat(page)) {
      // Rama defensiva: si el spawn disparó el combate (quirk refutado), se resuelve directo.
      v = await conquerRoom(page, { maxRounds: 600 });
    } else {
      // Quirk esperado: spawn sobre la sala sin combate → sale al paso (7,6) y re-entra al sur.
      v = await conquerRoomAt(page, { roomCell: R15, approachDir: "south", maxRounds: 600 });
    }
    const bit = v.outcome === "VICTORY" ? ` bit=${await r15ClearedBit(page)}` : "";
    console.log(`[ch45-deceit-r15] digest=${v.digest}${bit}`);
    if (v.outcome === "VICTORY" && !(await r15ClearedBit(page))) return "VICTORY-SIN-BIT(!)";
    return v.outcome;
  } catch (e) {
    return `THROW:${(e as Error).message.slice(0, 60)}`;
  }
}

test.describe.serial("FASE 2b — ch45 Deceit r15 por el FONDO (spawn-sobre-sala + re-entrada)", () => {
  test("r15 se juega desde el fondo y RESUELVE limpio (no FAIL/THROW)", async ({ page }) => {
    test.setTimeout(chapterTimeout(600_000));
    const t0 = Date.now();
    const outcome = await runR15(page);
    const secs = Math.round((Date.now() - t0) / 1000);
    console.log(`[ch45-deceit-r15] ${secs}s outcome=${outcome}`);
    const OK = ["VICTORY", "DEADEND", "DEADEND-STUCK"];
    expect(OK, `r15 resuelve limpio: ${outcome}`).toContain(outcome);
  });

  test("determinismo ×2: dos pasadas frescas dan el MISMO outcome", async ({ page }) => {
    test.setTimeout(chapterTimeout(1_200_000));
    const a = await runR15(page);
    const b = await runR15(page);
    expect(b, "outcome byte-idéntico bajo reseed(0)").toBe(a);
  });
});
