/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **VEREDICTO-DE-FIDELIDAD.** Sus asertos se apoyan en DERIVACIÓN del binario/canon
 * (cita en esta misma cabecera). Un rojo acusa al PORT **o a la derivación**: se
 * investigan los DOS, con la carga de la prueba en quien NO cite el binario.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2b — ch37: Wrong floors 2-7 (r7-r14) + muradas (r5/r6/r15) bajo la SEMÁNTICA FIEL
 * de pasabilidad — REFUTACIÓN del sello-candidato «8×SIN-ENTRADA» de ch32.
 *
 * HALLAZGO (carril f2b-wrong, derivación estática 2026-07-22): el «cima sólo alcanza
 * floors 0-1» de ch23/ch32 era ARTEFACTO DEL PATHER, que trataba los campos type-8 como
 * muro. El binario NO: el clasificador de movimiento (DUNGEON:0x05FF, re/notes/dungeon.md
 * §2) sólo bloquea muros hi∈{0xB,0xC,0xD}; los campos sueño/veneno/fuego (0x80-0x82) SE
 * PISAN (efecto por miembro, on_enter 0x0C76 §5) y las bombas también (detonan y LIMPIAN
 * el tile). Sólo el 0x83 exacto (Electric) rebota (0x0470/0x05d7) — y el Cetro lo disuelve
 * ((U)se en mazmorra = campo ENCARADO, CAST 0x1966 rama residente; útil precisamente en
 * Wrong/Covetous, los únicos con campos). Careo previo: dungeons.json(Wrong) =
 * DUNGEON.DAT[0x600:0x800] byte-exacto 512/512.
 *
 * Flood estático con la semántica fiel: la CIMA alcanza floors 0-7 y las 8 salas r7-r14
 * SIN cetro (vía columna de campos x=5 de floor1 + foso (4,5) encadenado), y con
 * cetro-como-llave (0x83) también los approaches de las muradas r5 (1,1)f3, r6 (5,1)f3 y
 * r15 (bombas x=7 de f7). Este capítulo lo JUEGA con la extensión opt-in del pather
 * (`fields`/`sceptreKey`, nav.ts) — el runtime es la fuente de verdad.
 *
 * VEREDICTO ABIERTO por sala: RESUELTA (VICTORY|DEADEND|DEADEND-STUCK) o SIN-ENTRADA
 * (parking con diagnóstico — NO sello, ruling del lead 2026-07-22). PROHIBIDO: FAIL.
 * Determinismo ×2. NO sella .gam (specs de veredicto, como ch32/ch33).
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, enterDungeon, conquerRoomAt, type DFacing } from "./nav";

const PREV_CHAPTER = "ch13";
const WRONG = 36;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;

// Las 11 salas pendientes de Wrong. approachDir derivado del flood fiel (vecino andable
// alcanzable desde la cima): r5/r6 se aproximan POR el propio campo 0x83 (cetro lo
// disuelve y la party se para encima); r7-r10 por las secretas (y=2) de floor5; r15 por
// la bomba (7,2) de floor7. Orden = lote-fondo primero (sin cetro), muradas al final.
const ROOMS: Array<{ roomNo: number; floor: number; x: number; y: number; approachDir: DFacing }> = [
  { roomNo: 11, floor: 2, x: 1, y: 1, approachDir: "west" },
  { roomNo: 12, floor: 2, x: 5, y: 1, approachDir: "east" },
  { roomNo: 7, floor: 5, x: 0, y: 1, approachDir: "north" },
  { roomNo: 8, floor: 5, x: 2, y: 1, approachDir: "north" },
  { roomNo: 9, floor: 5, x: 4, y: 1, approachDir: "north" },
  { roomNo: 10, floor: 5, x: 6, y: 1, approachDir: "north" },
  { roomNo: 13, floor: 5, x: 3, y: 4, approachDir: "north" },
  { roomNo: 14, floor: 7, x: 3, y: 5, approachDir: "north" },
  { roomNo: 5, floor: 3, x: 0, y: 1, approachDir: "west" },
  { roomNo: 6, floor: 3, x: 6, y: 1, approachDir: "east" },
  { roomNo: 15, floor: 7, x: 7, y: 1, approachDir: "north" },
];

/** Loadout ranged + Cetro (llave de los 0x83) + Des Por; re-sembrable entre salas (los
 * campos pisados afligen S/P y dañan — resetear HP/status es loadout de arnés, no toca
 * veredictos). Cetro: lbArtifacts.sceptre=true SIN amulet/crown (patrón ch27 —
 * endgameReady exige las 3; aquí además es irrelevante fuera de Doom). */
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
      st.lbArtifacts = { amulet: false, crown: false, sceptre: true };
    },
    [MAGIC_BOW, RING_INVIS, ARROWS] as const,
  );
}

/** Entra por la CIMA y, con el pather FIEL (fields+sceptreKey), barre las 11 salas a punto fijo. */
async function runWrongFiel(page: Page): Promise<{ digest: string; outcomes: Record<number, string> }> {
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  await enterDungeon(page, WRONG); // CIMA (floor 0, escalera (1,1))

  const outcomes: Record<number, string> = {};
  const resolved = (o?: string) => !!o && !o.startsWith("THROW") && o !== "SIN-ENTRADA";
  let progress = true;
  while (progress) {
    progress = false;
    for (const r of ROOMS) {
      if (resolved(outcomes[r.roomNo])) continue;
      await seedLoadout(page); // cura S/P/daño de campos entre salas (loadout, no veredicto)
      try {
        const v = await conquerRoomAt(page, {
          roomCell: { floor: r.floor, x: r.x, y: r.y },
          approachDir: r.approachDir,
          maxRounds: 600,
          maxIters: 120,
          fields: true,
          sceptreKey: true,
          // crossRooms: los fosos encadenados de Wrong ATERRIZAN sobre salas en tránsito
          // (pasada-1: r13 THROW «resolvedor atascado» — el manejador sin-placas no cruza);
          // con crossRooms la sala de paso se conquista con placas o se huye (FLEE-CROSS).
          crossRooms: true,
        });
        outcomes[r.roomNo] = v.outcome;
        progress = true;
      } catch (e) {
        const prev = outcomes[r.roomNo];
        outcomes[r.roomNo] = /sin plan/.test((e as Error).message) ? "SIN-ENTRADA" : `THROW:${(e as Error).message.slice(0, 40)}`;
        if (outcomes[r.roomNo] !== prev && !prev) progress = true; // 1ª clasificación también avanza el fixpoint
      }
    }
  }
  const digest = ROOMS.map((r) => `${r.roomNo}:${outcomes[r.roomNo]}`).join("|");
  return { digest, outcomes };
}

// SUPERSEDED 2026-07-23 (matriz harness-fix): este spec stream-carrying (una travesía
// continua de 11 salas con fixpoint re-corredor) es ENDURANCE-LIMITED — jamás cerró
// completo (46-58 min → crash de browser, también pre-fix). Los veredictos de sus salas
// están SELLADOS por el parcial det×3 (r7-r12) + ch37b-wrong-v2 entrada-fresca (r5/r6/
// r13/r14/r15), ver CENSO. Se conserva como documentación de la derivación; NO corre en
// el tour serial. Quitar el skip solo con presupuesto de recursos de CI dedicado.
test.describe.skip("FASE 2b — ch37 Wrong bajo semántica FIEL de campos (refuta el candidato de ch32) [SUPERSEDED por ch37b-v2]", () => {
  test("las 11 salas: RESUELTA jugada o SIN-ENTRADA-parking (nunca FAIL)", async ({ page }) => {
    test.setTimeout(chapterTimeout(1_500_000));
    const t0 = Date.now();
    const { digest, outcomes } = await runWrongFiel(page);
    const secs = Math.round((Date.now() - t0) / 1000);
    const tally = Object.values(outcomes).reduce<Record<string, number>>((a, o) => {
      const k = o.startsWith("THROW") ? "THROW" : o;
      a[k] = (a[k] ?? 0) + 1; return a;
    }, {});
    console.log(`[ch37-wrong-campos] ${secs}s outcomes=${JSON.stringify(tally)}`);
    console.log(`[ch37-wrong-campos] digest=${digest}`);
    const OK = ["VICTORY", "DEADEND", "DEADEND-STUCK", "SIN-ENTRADA"];
    for (const r of ROOMS) expect(OK, `sala ${r.roomNo}: resuelta o SIN-ENTRADA (no FAIL/THROW)`).toContain(outcomes[r.roomNo]);
  });

  test("determinismo ×2: dos pasadas frescas dan el MISMO digest", async ({ page }) => {
    test.setTimeout(chapterTimeout(3_000_000));
    const a = await runWrongFiel(page);
    const b = await runWrongFiel(page);
    expect(b.digest, "digest de outcomes byte-idéntico bajo reseed(0)").toBe(a.digest);
  });
});
