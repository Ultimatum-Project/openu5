/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **VEREDICTO-DE-FIDELIDAD.** Sus asertos se apoyan en DERIVACIÓN del binario/canon
 * (cita en esta misma cabecera). Un rojo acusa al PORT **o a la derivación**: se
 * investigan los DOS, con la carga de la prueba en quien NO cite el binario.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2b lote-2 — ch33: CONFIRMACIÓN RUNTIME del SELLO GEOMÉTRICO de Deceit r9 (#25, f6 7,5).
 *
 * Derivación estática (lote-1, `re/tools/dungeon_pocket_reach.py --loc 33`): r9 vive en un bolsillo de
 * 3 celdas de f6 {foso(5,5), secreta(6,5), sala(7,5)}. La ÚNICA celda de entrada es el foso f6(5,5),
 * que ENCADENA a f7(5,5)=cofre — NO detenible. No hay escalera/klimb/foso NO-encadenante que aterrice
 * en el bolsillo → ningún mecanismo lo abre. Esta corrida CONFIRMA en runtime: desde la CIMA y desde el
 * FONDO (Underworld), el pather NO encuentra plan a r9 → SIN-ENTRADA-fiel (sello por inaccesibilidad,
 * patrón #29). El runtime es la fuente de verdad; la estática sólo orientó.
 *
 * VEREDICTO ABIERTO: r9 debe dar SIN-ENTRADA por AMBAS entradas (nunca VICTORY — eso REFUTARÍA el
 * sello y sería hallazgo). Determinismo ×2.
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, enterDungeon, enterFromUnderworld, conquerRoomAt } from "./nav";

const PREV_CHAPTER = "ch13";
const DECEIT = 33;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;
const R9 = { floor: 6, x: 7, y: 5 }; // única celda del bolsillo adyacente a algo = (6,5) secreta al oeste

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

/** Intenta alcanzar r9 desde una entrada dada; SIN-ENTRADA si el pather no da plan. */
async function tryR9(page: Page, entry: "cima" | "fondo"): Promise<string> {
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  if (entry === "cima") await enterDungeon(page, DECEIT);
  else await enterFromUnderworld(page, DECEIT);
  try {
    // approachDir "east": la party entraría a r9(7,5) moviéndose al este desde la secreta (6,5) —
    // la única vecina no-muro. El pather intenta llegar a (6,5); su bolsillo es inaccesible.
    const v = await conquerRoomAt(page, { roomCell: R9, approachDir: "east", maxRounds: 600 });
    return v.outcome;
  } catch (e) {
    return /sin plan/.test((e as Error).message) ? "SIN-ENTRADA" : `THROW:${(e as Error).message.slice(0, 40)}`;
  }
}

test.describe.serial("FASE 2b lote-2 — ch33 sello de Deceit r9 (SIN-ENTRADA por cima Y fondo)", () => {
  test("r9 es SIN-ENTRADA-fiel: ni la cima ni el fondo la alcanzan (nunca VICTORY)", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const cima = await tryR9(page, "cima");
    const fondo = await tryR9(page, "fondo");
    console.log(`[ch33-r9-seal] cima=${cima} fondo=${fondo}`);
    expect(cima, "r9 desde la CIMA = SIN-ENTRADA (sello geométrico)").toBe("SIN-ENTRADA");
    expect(fondo, "r9 desde el FONDO = SIN-ENTRADA (sello geométrico)").toBe("SIN-ENTRADA");
  });

  test("determinismo ×2: el sello se repite byte-idéntico", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const a = `${await tryR9(page, "cima")}|${await tryR9(page, "fondo")}`;
    const b = `${await tryR9(page, "cima")}|${await tryR9(page, "fondo")}`;
    expect(b, "digest del sello byte-idéntico bajo reseed(0)").toBe(a);
  });
});
