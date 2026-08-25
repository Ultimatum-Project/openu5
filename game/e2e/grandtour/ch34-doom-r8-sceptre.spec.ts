/**
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **CAPACIDAD-DE-ARNÉS** (la tercera clase, `re/notes/censo-clases-specs-salas.md`).
 * NO juzga la fidelidad del port Y TAMPOCO fija baseline de la sala. Un rojo aquí dice
 * **«el arnés se rompió»**: o la sala dejó de ser ENTRABLE (`FAIL:no-combat-on-step`,
 * o `conquerRoom` devolviendo FAIL), o la corrida dejó de ser REPRODUCIBLE bajo
 * `reseed(0)`. Ni «el port cambió» ni «el port es infiel».
 *
 * POR QUÉ NO ES VEREDICTO-DE-FIDELIDAD (que es lo que su cabecera vieja sugería): un
 * veredicto exige DERIVACIÓN del binario DETRÁS DEL ASERTO. Los dos asertos de este
 * fichero son `expect(["VICTORY","DEADEND","DEADEND-STUCK"]).toContain(outcome)` y
 * `expect(b).toBe(a)`. Ninguno cita binario ni canon: el primero solo exige que la
 * corrida resuelva limpio, el segundo que resuelva igual dos veces. La cita que sí
 * lleva la cabecera (TESTIGO-4 → `combat.ts:438`, el Cetro disuelve 0x7X) respalda el
 * MECANISMO que la corrida usa, no lo que se aserta sobre la sala.
 *
 * POR QUÉ TAMPOCO ES DETECTOR-DE-REGRESIÓN: un detector fija el outcome MEDIDO y se
 * pone rojo si cambia. Aquí el outcome no está fijado — la lista OK admite VICTORY y
 * DEADEND a la vez, así que **un flip VICTORY↔DEADEND de r8 pasaría VERDE**. Es
 * deliberado (nació con «VEREDICTO ABIERTO», para LEER el resultado por consola), pero
 * significa que este spec no vigila el veredicto de #120.
 *
 * DÓNDE VIVE EL VEREDICTO DE r8, entonces: se midió y se CERRÓ en la VENTANA-#13 —
 * `docs/guias/doom/CENSO-COMBATMAPS.md:188`, «#120 (r8) = DEAD-END FIEL (RE-CONFIRMADO
 * CON CETRO, ch34 ×2)»: el Cetro disuelve 18→9 murallas 0x7X y la party mata 4/8
 * Daemons, pero los otros 4 están en bolsillos-esquina sellados por muros NORMALES
 * (0x8+) que el Cetro NO disuelve. El SELLO como tal lo lleva ch27-salas-doom.
 * ✅ FLECO RESUELTO (RULING DEL LEAD, 27-07): el título del describe decía «veredicto
 * ABIERTO» cuando la ventana ya lo había cerrado. Re-titulado — ahora dice que el
 * veredicto está CERRADO, dónde vive y que este spec es CAPACIDAD-DE-ARNÉS. Cero
 * cambios en asertos.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2b lote-2 — ch34: RE-MEDICIÓN de Doom r8 (#120, f5 3,3) con TÁCTICA CETRO-BARRIDO.
 *
 * ch27 selló cm120 como DEAD-END FIEL bajo spawn P0a: la party queda BOXEADA en la cámara superior
 * por un anillo de murallas ShadowlordBoundary (0x70-0x7f) y NUNCA alcanza a los enemigos (sondeo de
 * ventana: 3 PJ en (4-6,1-2); 8 enemigos FUERA de la caja). El censo lo tenía «winnable-móvil», pero
 * los enemigos también están sellados → nadie llega a rango → dead-end.
 *
 * TESTIGO-4 (vídeo del usuario, cita en combat.ts:438): el (U)se Cetro DISUELVE esas murallas 0x7X a
 * Grass (barrido 3×3 del combatiente activo, sceptreDissolveFields). Esta corrida re-mide la sala CON
 * el Cetro sembrado + `sceptreClear`: rompe la caja → alcanza a los Daemons. VEREDICTO ABIERTO — si
 * flipa a VICTORY = sala LIBERADA (hallazgo); si sigue DEADEND = se re-sella con la cita. Determinismo
 * ×2. (Entrada idéntica a ch27: paso SUR sobre r8 → spawn opposite-of-facing = norte.)
 *
 * [HISTÓRICO: el párrafo de arriba describe el ENCARGO de la ventana, cuando el veredicto
 * estaba abierto. Se conserva porque explica para qué se construyó la corrida. El veredicto
 * se CERRÓ en la VENTANA-#13 — siguió DEADEND, se re-selló con la cita: ver el bloque de
 * CLASE arriba y CENSO-COMBATMAPS.md:188.]
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, conquerRoom, inDungeonCombat } from "./nav";

const PREV_CHAPTER = "ch17";
const DOOM = 40;
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
      st.spellQuantities[22] = 99;
      for (let i = 0; i < st.reagentQuantities.length; i++) st.reagentQuantities[i] = 99;
      // CETRO obligatorio en la tabla (U)se; despoja amulet+crown → endgameReady FALSE (f7 no rescata).
      st.lbArtifacts = { amulet: false, crown: false, sceptre: true };
    },
    [MAGIC_BOW, RING_INVIS, ARROWS] as const,
  );
}

async function runDoomR8Sceptre(page: Page): Promise<string> {
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  // teleportDungeon entra a Doom por dentro; approach norte de r8 (f5 3,2), mirar SUR.
  await page.evaluate((id) => (window as unknown as { __u5debug: { teleportDungeon: (d: number, f: number, x: number, y: number) => void } }).__u5debug.teleportDungeon(id, 5, 3, 2), DOOM);
  await page.evaluate(() => { (window as unknown as { __u5test: { game: { dungeonState: { pos: { facing: string } } } } }).__u5test.game.dungeonState.pos.facing = "south"; });
  await page.evaluate(() => (window as unknown as { __u5test: { game: { dungeonCommand: (c: string) => unknown } } }).__u5test.game.dungeonCommand("forward"));
  if (!(await inDungeonCombat(page))) return "FAIL:no-combat-on-step";
  const v = await conquerRoom(page, { sceptreClear: true, maxRounds: 600 });
  return v.outcome;
}

test.describe.serial(
  "FASE 2b lote-2 — ch34 Doom r8 (#120) con Cetro-barrido — CAPACIDAD-DE-ARNÉS " +
    "(veredicto CERRADO en VENTANA-#13: DEAD-END FIEL, CENSO-COMBATMAPS.md:188; sello en ch27)",
  () => {
  test("r8 con el Cetro: VICTORY (liberada) o DEADEND (re-sellada) — nunca FAIL", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const outcome = await runDoomR8Sceptre(page);
    console.log(`[ch34-doom-r8] outcome=${outcome}`);
    const OK = ["VICTORY", "DEADEND", "DEADEND-STUCK"];
    expect(OK, `r8 resuelve limpio (no FAIL): ${outcome}`).toContain(outcome);
  });

  test("determinismo ×2: dos pasadas dan el MISMO veredicto", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const a = await runDoomR8Sceptre(page);
    const b = await runDoomR8Sceptre(page);
    expect(b, "veredicto byte-idéntico bajo reseed(0)").toBe(a);
  });
});
