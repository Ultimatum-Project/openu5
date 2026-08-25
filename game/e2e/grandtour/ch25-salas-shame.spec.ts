/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2 — ch25-salas-shame: PASADA-1 (cima) de TODAS las salas de SHAME (loc 38).
 *
 * Shame tiene 16 salas (dungeons.json type 0xF, combatmap = 80 + roomNo). SORPRESA de
 * topología: a diferencia de Wrong, sus NUEVE salas de floor7 SÍ son alcanzables desde la cima
 * (Des Por baja hasta el fondo) → la mazmorra MÁS COMPLETA de la ola en pasada-1: sólo las 3
 * muradas (r4,r5,r15) quedan PENDIENTE-entrada.
 * [HISTÓRICO 2026-07-25: Fase 2b CERRADA — 112/112 selladas (main 76fb75c9); las 3 muradas
 *  tienen veredicto firme en el censo. Este spec queda como pasada-1 histórica.]
 *
 * Cada sala se mide desde ENTRADA FRESCA (conquerRoomAt, loadout ranged + Des Por). Arnés
 * ruling-A (en main): A.1 espera-por-progreso (winnable-por-móvil → VICTORY sin inflar
 * dead-ends) + A.2 fleeCombat/DEADEND-STUCK. Además estrena la VICTORIA EN TRÁNSITO: el pather
 * puede ATERRIZAR sobre una sala durante el descenso (foso/Des Por) y ganarla de camino → el
 * paso explícito no dispara combate pero el bit de sala-despejada está puesto → VICTORY
 * (`roomClearedInTransit`), no el falso `FAIL:no-combat-on-step` (r9 #89 y r12 #92 lo eran;
 * probe: ganan en descenso, party 240hp — generaliza la victoria-en-tránsito de Destard r3).
 *
 * RESULTADO (seed-0, ×2 determinista, spawn FIEL P0a): **10 VICTORY, 3 DEADEND, 3 murada**.
 * 0 FAIL, 0 DEADEND-STUCK. La VICTORIA-EN-TRÁNSITO (roomClearedInTransit, bit DNGLOOK 0x0844)
 * sigue vigente en el arnés para descensos que aterrizan sobre una sala.
 *
 * HISTORIAL DE LA CIFRA, con la atribución de cada salto (ninguno es «el port cambió» a secas):
 *  · pre-P0a 6V/7D → 8V/5D (main 0ab4b008, 21-07): r8 y r11 LIBERADAS por el spawn fiel
 *    opposite-of-facing; el hardcode "south" las sellaba. Ola: Destard 3, Wrong 1, Shame 2.
 *  · 8V/5D → 10V/3D (ventana e2e 29-07): r7 por 7dd45fbe (clase de movimiento) y r14 por
 *    13b46ee6 (familia 0xEC = grupo aleatorio). Los dos PINNEADOS por bisección — el detalle
 *    y el porqué, en el bloque de veredictos de abajo y en re/notes/resello-e2e-acta.md §4.
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, enterDungeon, conquerRoomAt, type DFacing } from "./nav";

const PREV_CHAPTER = "ch13";
const SHAME = 38;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;

// Las 16 salas de Shame (dungeons.json type 0xF), roomNo = sub&0xF, combatmap = 80 + roomNo
// (orden saltando Despise = 4). approachDir del vecino-pasaje ortogonal; null = murada.
const ROOMS: Array<{ floor: number; x: number; y: number; roomNo: number; approachDir: DFacing | null }> = [
  { floor: 0, x: 1, y: 1, roomNo: 0, approachDir: "north" },
  { floor: 2, x: 4, y: 4, roomNo: 1, approachDir: "east" },
  { floor: 3, x: 5, y: 6, roomNo: 2, approachDir: "south" },
  { floor: 5, x: 2, y: 5, roomNo: 3, approachDir: "south" },
  { floor: 5, x: 5, y: 2, roomNo: 4, approachDir: null },
  { floor: 5, x: 1, y: 0, roomNo: 5, approachDir: null },
  { floor: 6, x: 7, y: 6, roomNo: 15, approachDir: null },
  { floor: 7, x: 4, y: 4, roomNo: 6, approachDir: "south" },
  { floor: 7, x: 4, y: 1, roomNo: 7, approachDir: "north" },
  { floor: 7, x: 4, y: 7, roomNo: 8, approachDir: "south" },
  { floor: 7, x: 1, y: 2, roomNo: 9, approachDir: "south" },
  { floor: 7, x: 7, y: 2, roomNo: 10, approachDir: "south" },
  { floor: 7, x: 1, y: 4, roomNo: 11, approachDir: "west" },
  { floor: 7, x: 7, y: 4, roomNo: 12, approachDir: "east" },
  { floor: 7, x: 1, y: 6, roomNo: 13, approachDir: "north" },
  { floor: 7, x: 7, y: 6, roomNo: 14, approachDir: "north" },
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
      st.spellQuantities[22] = 99; // Des Por (descenso mágico)
      for (let i = 0; i < st.reagentQuantities.length; i++) st.reagentQuantities[i] = 99;
    },
    [MAGIC_BOW, RING_INVIS, ARROWS] as const,
  );
}

/** Mide UNA sala desde ENTRADA FRESCA (un DEADEND-STUCK no contamina a la siguiente). */
async function measureRoom(page: Page, r: { floor: number; x: number; y: number; roomNo: number; approachDir: DFacing | null }): Promise<string> {
  if (r.approachDir === null) return "SKIP-pend-entrada-murada";
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  const entry = await enterDungeon(page, SHAME);
  expect(entry, "entra a Shame por la cima (floor 0)").toMatchObject({ dungeon: SHAME, floor: 0 });
  try {
    const v = await conquerRoomAt(page, { roomCell: { floor: r.floor, x: r.x, y: r.y }, approachDir: r.approachDir, maxRounds: 600 });
    return v.outcome;
  } catch (e) {
    return `THROW:${(e as Error).message.slice(0, 40)}`;
  }
}

async function runShame(page: Page): Promise<{ digest: string; outcomes: Record<number, string> }> {
  const outcomes: Record<number, string> = {};
  for (const r of ROOMS) outcomes[r.roomNo] = await measureRoom(page, r);
  const digest = ROOMS.map((r) => `${r.roomNo}:${outcomes[r.roomNo]}`).join("|");
  return { digest, outcomes };
}

test.describe.serial("FASE 2 — ch25 salas de Shame (pasada-1 de cima)", () => {
  test("conquista/censa las 16 salas de Shame (13 alcanzables + 3 muradas)", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const t0 = Date.now();
    const { digest, outcomes } = await runShame(page);
    const secs = Math.round((Date.now() - t0) / 1000);
    const tally = Object.values(outcomes).reduce<Record<string, number>>((a, o) => {
      const k = o.startsWith("THROW") ? "THROW" : o;
      a[k] = (a[k] ?? 0) + 1; return a;
    }, {});
    console.log(`[ch25-shame] ${secs}s outcomes=${JSON.stringify(tally)}`);
    console.log(`[ch25-shame] digest=${digest}`);

    // VEREDICTOS CALIBRADOS (seed-0, spawn FIEL P0a = opposite-of-facing, main 0ab4b008).
    // VICTORY = ganada; DEADEND = sala sellada fiel (la party HUYE por un borde). NINGUNA
    // alcanzable lanza (THROW), muere (FAIL) ni queda emparedada (DEADEND-STUCK).
    // FLIPS por el spawn FIEL vs pre-P0a (6V/7D): r8 (#88) y r11 (#91) DEADEND → VICTORY
    // (LIBERADAS — el spawn correcto coloca la party donde alcanza a los enemigos que el
    // hardcode "south" sellaba; mismo patrón que Destard liberó 3 y Wrong 1).
    // ★ RE-SELLO CON ATRIBUCIÓN POR BISECT (ventana e2e 2026-07-29). r7 y r14 pasan de
    // DEADEND a VICTORY. NO se re-baselinea «porque el port cambió» —eso es sellar port con
    // port—: cada flip está PINNEADO a un commit ÚNICO por bisección sobre `game/src`
    // (16 corridas de esta misma medida), y cada commit trae su derivación del binario:
    //
    //  · r7  ← 7dd45fbe (#48 / #54 pieza 1): la CLASE DE MOVIMIENTO sustituye a los tres
    //    booleanos heredados de Redux. 47fa61f0 da DEADEND, 7dd45fbe da VICTORY, y no hay
    //    nada entre medias. Cambia CÓMO se mueve el enemigo ⇒ cambia si la party lo alcanza.
    //  · r14 ← 13b46ee6 (#54 pieza 14): la familia 0xEC es un GRUPO ALEATORIO (DNGLOOK
    //    0x12e5-0x12fc). eefb8de3 da DEADEND, 13b46ee6 da VICTORY. Antes, esos sprites
    //    entraban como plantilla «Whirpool» de stats TODO A CERO: imposibles de matar y con
    //    `enemiesAlive===0` inalcanzable ⇒ era un DEADEND POR CONTABILIDAD, no una sala
    //    sellada. Al resolver la familia a enemigos REALES, la sala se JUEGA y se gana.
    //    Esto CONTESTA la predicción que 20e98f42 dejó abierta por escrito («quitar
    //    remolinos NO convierte los DEADEND en VICTORY … se re-adjudican CORRIENDO cuando
    //    aterrice»): para Shame r14, corriendo, SÍ convierte.
    //
    // El baseline anterior (8V/5D, main 0ab4b008) llevaba desde el 21-07 sin correr por el
    // mutex de e2e: su rojo era DERIVA ACUMULADA de 116 commits, no la jornada de fixes.
    for (const n of [0, 1, 7, 8, 9, 10, 11, 12, 13, 14]) expect(outcomes[n], `sala ${n} VICTORY`).toBe("VICTORY");
    for (const n of [2, 3, 6])
      // DETECTOR (no «fiel»): sin derivación POR SALA de que sean inganables en el original.
      expect(outcomes[n], `sala ${n}: DEADEND del PORT (baseline medido, no veredicto de fidelidad)`).toBe("DEADEND");
    for (const n of [4, 5, 15]) expect(outcomes[n], `sala ${n} murada`).toBe("SKIP-pend-entrada-murada");
    expect(tally, "10 VICTORY + 3 DEADEND + 3 murada, 0 FAIL/STUCK/THROW").toEqual({ VICTORY: 10, DEADEND: 3, "SKIP-pend-entrada-murada": 3 });
  });

  test("determinismo ×2: dos pasadas de cima frescas dan el MISMO digest", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const a = await runShame(page);
    const b = await runShame(page);
    expect(b.digest, "digest de outcomes byte-idéntico bajo reseed(0)").toBe(a.digest);
  });
});
