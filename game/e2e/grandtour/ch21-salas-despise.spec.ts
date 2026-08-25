/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **VEREDICTO-DE-FIDELIDAD.** Sus asertos se apoyan en DERIVACIÓN del binario/canon
 * (cita en esta misma cabecera). Un rojo acusa al PORT **o a la derivación**: se
 * investigan los DOS, con la carga de la prueba en quien NO cite el binario.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2 — ch21-salas-despise: PASADA-1 (cima) de TODAS las salas de DESPISE (loc 34).
 *
 * RESULTADO MEDIDO (no fabricado): **Despise NO TIENE salas de combate**. DUNGEON.CBT del
 * original son 112 salas = 16 salas × 7 mazmorras y el orden de combatmaps SALTA Despise
 * (Deceit=0, Destard=1, Wrong=2, Covetous=3, Shame=4, Hythloth=5, Doom=6).
 *
 * ★ CUÁNTAS PATAS TIENE ESTO, de verdad (barrido prosa-autofiel tanda 2, 07-27). Antes decía
 * «hecho FIEL del binario — triple corroborado», y de las tres sólo UNA es independiente:
 *   1. ✅ REAL — `game/assets/maps/dungeons.json` (extracción de DUNGEON.DAT): los 8 pisos de
 *      Despise tienen 0 celdas Room(0xF) y 0 RoomsBroke(0xA).
 *      Re-contado el 07-27 sobre el asset: CELDAS de sala = Deceit 16 · Despise 0 · Destard 16 ·
 *      Wrong 36 · Covetous 82 · Shame 16 · Hythloth 16 · Doom 16, pero roomNos DISTINTOS
 *      (nibble bajo) = 16 en las siete y 0 en Despise. Wrong y Covetous sólo tienen celdas de
 *      entrada REPETIDAS a las mismas 16 salas; el «16 × 7» del .CBT cuadra.
 *   2. ❌ CIRCULAR — `roomCombatMapIndex`/`dungeonOrderSkippingDespise` es el PORT citándose:
 *      su fórmula viene de Ultima5Redux (docs/formats/combat-dungeons.md), no del binario. Y
 *      `re/notes/dungeon.md` §14.1 avisa de que el colapso DERIVADO (DNGLOOK 0x0844: dungIdx =
 *      loc−0x21, `if (dungIdx≥1) dungIdx--`) es Deceit≡Despise, **distinto** del Despise≡Destard
 *      que usa `roomCombatMapIndex`. El CONTROL de Destard de abajo se apoya en el segundo.
 *   3. ❌ AGUAS ABAJO — `docs/guias/doom/CENSO-COMBATMAPS.md` censa los combatmaps DEL PORT,
 *      derivados de (1); no es fuente independiente.
 * El HECHO (0 salas) se sostiene con la pata 1; lo que no se sostiene es el «triple».
 *
 * Por tanto la "conquista de las salas de Despise" es VACÍA por construcción (conjunto de
 * salas ∅). Este capítulo lo SELLA como TEST DE FIDELIDAD (patrón dead-end de la Fase 2):
 * entra a Despise por la CIMA (`enterDungeon(34)`), barre las 8 plantas VIVAS del motor y
 * asserta 0 salas. Para probar que el barredor NO está roto (el 0 es real, no un lector
 * ciego), un CONTROL entra a Destard (loc 35, que COMPARTE el slot-1 de combatmaps con
 * Despise por el quirk) y encuentra sus 16 salas. Verificación contra el RUNTIME, no contra
 * el campo `index` (encargo del lead). Determinismo ×2: digest de censo byte-idéntico.
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, enterDungeon } from "./nav";

const PREV_CHAPTER = "ch13";
const DESPISE = 34;
const DESTARD = 35; // control: comparte el orden-de-combatmap 1 con Despise, pero SÍ tiene salas
const ROOM = 0xf; // CellType.Room  (celda de sala → combate)
const ROOMS_BROKE = 0xa; // CellType.RoomsBroke (sala ya despejada; tampoco existe en Despise)

/** Barre las 8 plantas VIVAS de la mazmorra cargada y censa sus celdas-sala. */
async function sweepRooms(page: Page): Promise<{ roomCells: number; roomNos: number[]; digest: string }> {
  return page.evaluate(
    ([roomType, brokeType]) => {
      const ds = (window as unknown as {
        __u5test: { game: { dungeonState: { cellAt: (f: number, x: number, y: number) => { type: number; sub: number } } | null } };
      }).__u5test.game.dungeonState;
      if (!ds) throw new Error("sweepRooms: no hay dungeonState (¿fuera de mazmorra?)");
      const cells: string[] = [];
      const nos = new Set<number>();
      for (let f = 0; f < 8; f++) {
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const c = ds.cellAt(f, x, y);
            if (c.type === roomType || c.type === brokeType) {
              nos.add(c.sub & 0xf);
              cells.push(`${f},${x},${y}:${c.sub & 0xf}`);
            }
          }
        }
      }
      return { roomCells: cells.length, roomNos: [...nos].sort((a, b) => a - b), digest: cells.join("|") };
    },
    [ROOM, ROOMS_BROKE] as const,
  );
}

/** Boot fresco + entra a la mazmorra `id` por la cima + barre sus salas. */
async function enterAndSweep(page: Page, id: number): Promise<{ roomCells: number; roomNos: number[]; digest: string }> {
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  const entry = await enterDungeon(page, id);
  expect(entry, `entra a la mazmorra ${id} por la cima (floor 0)`).toMatchObject({ dungeon: id, floor: 0 });
  return sweepRooms(page);
}

test.describe.serial("FASE 2 — ch21 salas de Despise (pasada-1: conjunto de salas ∅ — DUNGEON.DAT, 0 celdas de sala)", () => {
  test("Despise NO tiene salas de combate (DUNGEON.CBT = 16×7, Despise excluida); control Destard = 16", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const t0 = Date.now();

    // PASADA-1 de Despise: barrido de las 8 plantas → 0 salas. El ∅ está DERIVADO de la
    // extracción de DUNGEON.DAT (pata 1 de la cabecera), no de la prosa «fiel».
    const despise = await enterAndSweep(page, DESPISE);
    console.log(`[ch21-despise] Despise roomCells=${despise.roomCells} roomNos=${JSON.stringify(despise.roomNos)}`);
    expect(despise.roomCells, "Despise no tiene ninguna celda de sala (Room/RoomsBroke)").toBe(0);
    expect(despise.roomNos, "Despise: conjunto de salas vacío").toEqual([]);

    // CONTROL: el mismo barredor sobre Destard (comparte el orden-de-combatmap 1) encuentra
    // sus 16 salas → prueba que el 0 de Despise es REAL, no un lector roto (verificación
    // contra el runtime, no contra el campo `index`).
    const destard = await enterAndSweep(page, DESTARD);
    console.log(`[ch21-despise] control Destard roomCells=${destard.roomCells} roomNos=${JSON.stringify(destard.roomNos)}`);
    expect(destard.roomNos, "control: Destard SÍ tiene las 16 salas (barredor sano)").toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);

    const secs = Math.round((Date.now() - t0) / 1000);
    console.log(`[ch21-despise] ${secs}s — pasada-1 Despise: 0/0 salas (conjunto vacío; DUNGEON.DAT: 0 celdas de sala)`);
  });

  test("determinismo ×2: dos barridos frescos de Despise dan el MISMO censo", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const a = await enterAndSweep(page, DESPISE);
    const b = await enterAndSweep(page, DESPISE);
    expect(b.digest, "digest de censo byte-idéntico entre pasadas").toBe(a.digest);
    expect(b.roomCells, "Despise sigue sin salas en la 2ª pasada").toBe(0);
  });
});
