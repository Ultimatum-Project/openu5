/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2 — ch22-salas-destard: PASADA 1 (cima) de TODAS las salas de DESTARD (loc 35).
 * Aplica el CAPÍTULO-FUNCIÓN del template ch20 (Deceit) a la 3ª mazmorra.
 *
 * Destard es la mazmorra de orden 1 (saltando Despise, que no tiene salas en DUNGEON.CBT):
 * `roomCombatMapIndex(35, roomNo) = 16 + 1*16 + roomNo = 32 + roomNo` (combatmaps 32..47).
 * Verificado contra el runtime (roomCombatMapIndex, dungeon.ts:926), NO contra el campo `index`.
 *
 * Entra por la CIMA (enterDungeon(35) → floor 0), siembra el loadout ranged + Des Por (spell 22,
 * descenso mágico de plantas medias — sin él el pather se atasca en silencio, lección de ch20), y
 * conquista las salas EN ORDEN con `conquerRoomAt`. Cada sala → {VICTORY|DEADEND|FAIL}. VICTORY y
 * DEADEND = pasada-1; DEADEND-fiel se documenta con cita; FAIL/THROW es rojo investigable (o sala
 * DURA → cola Fase 2b). Determinismo ×2 (digest de outcomes byte-idéntico bajo reseed(0)).
 *
 * RESULTADO MEDIDO (pasada de cima, seed-0, ×2): 10 VICTORY + 3 DEADEND-fiel = 13 salas
 * conquistadas/selladas; 3 PENDIENTE-entrada (Fase 2b) — ver PEND abajo y el censo.
 * [HISTÓRICO 2026-07-25: Fase 2b CERRADA — 112/112 selladas (main 76fb75c9); las 3
 *  PENDIENTE-entrada de esta pasada-1 se resolvieron después (ver CENSO-COMBATMAPS.md).]
 *
 * DOS SORPRESAS DE NAVEGACIÓN MEDIDAS (lo que el lead pidió medir):
 *  1. VICTORIA EN TRÁNSITO (r3, cámara abierta floor3): el pather CRUZA la celda de la sala para
 *     alcanzar la de aproximación → dispara y GANA el combate de paso; el `step` explícito ya no
 *     halla combate (FAIL:no-combat-on-step) pero la party queda EN la celda (sala despejada 0xA).
 *     Es VICTORIA real → se reclasifica (ver `runDestard`).
 *  2. BOLSILLOS AISLADOS POR ESCALERA/FOSO (floor6): r10 (combatmap 42) vive en un bolsillo cuyo
 *     único acceso NO lo alcanza el pather de descenso desde la cima (planDungeonDescent = "sin
 *     plan" desde múltiples posiciones, Dijkstra completo con klimbup/down/despor) → Fase 2b.
 *
 * CRUCE CON EL CENSO (docs/guias/doom/CENSO-COMBATMAPS.md):
 *  - Único candidato-dead-end de los 13 que cae en Destard = #42 = r10. La pasada CONFIRMA el
 *    triaje: inalcanzable en cima (bolsillo) → PENDIENTE-entrada (no se fabrica veredicto).
 *  - r5/r7/r8 = combatmaps 37/39/40, censados "entrada-SUR-N/A" (reach 0, todos sellados, 0
 *    triggers). Jugados con la entrada P0a → DEADEND-fiel (enemigos sellados inalcanzables, 0
 *    bajas). Refina esas 3 filas del censo de "entrada-SUR-N/A" a "DEADEND-fiel jugado".
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, enterDungeon, conquerRoomAt, type DFacing } from "./nav";
import { Coverage } from "./coverage";

const PREV_CHAPTER = "ch13";
const DESTARD = 35;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;

// Las 16 salas de Destard (dungeons.json type 0xF), roomNo = sub&0xF, combatmap = 32+roomNo.
// approachDir DERIVADO del vecino-pasaje (dungeons.json): la celda contigua a la sala que NO es
// muro (nibble alto ∉ {0xB,0xC,0xD}) NI otra sala (0xF); null = murada por los 4 lados (entrada
// por foso/escalera — Fase 2b). Orden por planta (r9 al final de floor6: su nook-escalera boxea
// la party). La lógica reproduce EXACTAMENTE los approachDir de ch20 (validado celda a celda).
const ROOMS: Array<{ floor: number; x: number; y: number; roomNo: number; approachDir: DFacing | null }> = [
  { floor: 0, x: 3, y: 1, roomNo: 0, approachDir: null },    // murada (N/E=0xC, S/W=0xB)
  { floor: 0, x: 7, y: 7, roomNo: 1, approachDir: null },    // murada
  { floor: 3, x: 1, y: 4, roomNo: 2, approachDir: "north" }, // cámara abierta (4 pasillos)
  { floor: 3, x: 5, y: 4, roomNo: 3, approachDir: "north" }, // cámara abierta → VICTORIA EN TRÁNSITO
  { floor: 5, x: 7, y: 0, roomNo: 4, approachDir: "north" },
  { floor: 5, x: 5, y: 2, roomNo: 5, approachDir: "west" },
  { floor: 6, x: 1, y: 0, roomNo: 6, approachDir: "north" },
  { floor: 6, x: 6, y: 2, roomNo: 7, approachDir: "west" },
  { floor: 6, x: 7, y: 3, roomNo: 8, approachDir: "south" },
  { floor: 6, x: 4, y: 5, roomNo: 10, approachDir: "north" }, // combatmap 42 — bolsillo aislado (Fase 2b)
  { floor: 6, x: 0, y: 6, roomNo: 11, approachDir: "east" },   // vecino = LadderUp (0x1)
  { floor: 6, x: 3, y: 1, roomNo: 9, approachDir: "north" },   // nook-escalera (3,2)=LadderUp → LAST
  { floor: 7, x: 7, y: 4, roomNo: 12, approachDir: "south" },  // N=sala r15; entra por pasillo S
  { floor: 7, x: 0, y: 5, roomNo: 13, approachDir: "south" },  // E=sala r15(wrap); entra por S
  { floor: 7, x: 6, y: 5, roomNo: 14, approachDir: "south" },  // W=sala r15; entra por S
  { floor: 7, x: 7, y: 5, roomNo: 15, approachDir: "north" },  // S/E/W = salas; único pasillo N
];

// PENDIENTE-entrada (Fase 2b — mini-carriles de entrada): NO alcanzables en la pasada de cima.
// [HISTÓRICO 2026-07-25: superado — Fase 2b cerrada, 112/112 selladas (main 76fb75c9); veredictos
//  firmes de r0/r1/r10 en el censo. El PEND de abajo sigue siendo el alcance de ESTA pasada-1.]
//  · r0,r1: salas MURADAS por los 4 lados en floor0 (ni cima ni pasillo) → foso/bottom-up.
//  · r10 (combatmap 42, candidato-dead-end del censo): bolsillo de floor6 aislado por escalera/
//    foso; el pather de descenso NO le encuentra plan desde la cima (MEDIDO: "sin plan" desde
//    (6,3,1) y (6,7,3), Dijkstra completo). Su veredicto ganable-vs-dead-end espera Fase 2b + P0b.
const PEND = new Set([0, 1, 10]);

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
      // Des Por (spell 22) mezclado + reactivos + MP: el DESCENSO por plantas medias se hace
      // MÁGICAMENTE (el pather usa Des Por donde no hay ruta física); sin el hechizo mezclado el
      // cast falla en silencio y el arnés se atasca (lección del template ch20).
      st.spellQuantities[22] = 99;
      for (let i = 0; i < st.reagentQuantities.length; i++) st.reagentQuantities[i] = 99;
    },
    [MAGIC_BOW, RING_INVIS, ARROWS] as const,
  );
}

/** Corre la conquista de Destard una vez; devuelve el mapa roomNo→outcome (digest ordenado). */
async function runDestard(page: Page): Promise<{ digest: string; outcomes: Record<number, string> }> {
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  const entry = await enterDungeon(page, DESTARD);
  expect(entry, "entra a Destard por la cima (floor 0)").toMatchObject({ dungeon: DESTARD, floor: 0 });

  const outcomes: Record<number, string> = {};
  for (const r of ROOMS) {
    if (r.approachDir === null || PEND.has(r.roomNo)) { outcomes[r.roomNo] = "SKIP-pend-entrada"; continue; }
    let outcome: string;
    let digest = "";
    try {
      const v = await conquerRoomAt(page, { roomCell: { floor: r.floor, x: r.x, y: r.y }, approachDir: r.approachDir, maxRounds: 600 });
      outcome = v.outcome; digest = v.digest;
    } catch (e) {
      // El digest cortaba a 40 caracteres y se comía la causa: un
      // «TypeError: Cannot read properties of null (reading 'cellAt')» llegaba como
      // «Cannot read pr», que no identifica NADA (2026-07-25: costó rescatar el trace de
      // otra rama para leerlo entero). 200 caracteres caben de sobra en el digest y dejan
      // legible tanto el TypeError como el FUERA-DE-MAZMORRA de nav.ts.
      outcome = `THROW:${(e as Error).message.slice(0, 200)}`;
    }
    // VICTORIA EN TRÁNSITO: FAIL:no-combat-on-step + party EN la celda de la sala = el pather ganó
    // el combate de paso al cruzarla (cámara abierta); es VICTORIA real, no FAIL. Se reclasifica.
    if (outcome === "FAIL" && digest === "FAIL:no-combat-on-step") {
      // `dungeonState` es NULL si la party ya no está en la mazmorra (salida o party-wipe):
      // sin el guard, esto reventaba con un TypeError opaco en vez de decir el hecho. Se
      // distingue `false` (está dentro, pero no en la celda) de `null` (está FUERA).
      const onRoomCell = await page.evaluate((rc) => {
        const ds = (window as unknown as { __u5test: { game: { dungeonState: { pos: { floor: number; x: number; y: number } } | null } } }).__u5test.game.dungeonState;
        if (!ds) return null;
        const p = ds.pos;
        return p.floor === rc.floor && p.x === rc.x && p.y === rc.y;
      }, { floor: r.floor, x: r.x, y: r.y });
      if (onRoomCell === null) outcome = "FUERA-DE-MAZMORRA:la party salió de la mazmorra (no es FAIL de sala)";
      else if (onRoomCell) outcome = "VICTORY";
    }
    outcomes[r.roomNo] = outcome;
  }
  const digest = ROOMS.map((r) => `${r.roomNo}:${outcomes[r.roomNo]}`).join("|");
  return { digest, outcomes };
}

const cov = new Coverage("ch22-salas-destard");

test.describe.serial("FASE 2 — ch22 salas de Destard (pasada de cima)", () => {
  test("conquista/censa las salas de Destard alcanzables desde la cima (pasada 1)", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const t0 = Date.now();
    const { digest, outcomes } = await runDestard(page);
    const secs = Math.round((Date.now() - t0) / 1000);
    const tally = Object.values(outcomes).reduce<Record<string, number>>((a, o) => ((a[o] = (a[o] ?? 0) + 1), a), {});
    console.log(`[ch22-destard] ${secs}s outcomes=${JSON.stringify(tally)}`);
    console.log(`[ch22-destard] digest=${digest}`);

    // Las salas ATACADAS (no-PEND) deben RESOLVER: VICTORY o DEADEND; ni FAIL ni THROW. Un
    // FAIL/THROW aquí = bug del arnés o del port (rojo investigable, jamás bancado).
    // DETECTOR, no veredicto: «DEADEND» es lo que MIDE el port, sin derivación POR SALA de que
    // el original tampoco las gane (mismo des-sellado que la tanda 1 aplicó a ch25/ch26 y que
    // este bucle se había saltado — barrido prosa-autofiel tanda 2, 07-27).
    const attempted = ROOMS.filter((r) => outcomes[r.roomNo] !== "SKIP-pend-entrada");
    const bad = attempted.filter((r) => !["VICTORY", "DEADEND"].includes(outcomes[r.roomNo]!));
    expect(bad.map((r) => `${r.roomNo}:${outcomes[r.roomNo]}`), "salas atacadas: todas RESUELVEN (VICTORY o DEADEND del PORT; baseline medido, no veredicto de fidelidad)").toEqual([]);
    expect(attempted.length, "13 salas atacadas en la pasada de cima").toBe(13);

    // Composición EXACTA del veredicto jugado (calibrado al resultado real, no fabricado):
    const victories = attempted.filter((r) => outcomes[r.roomNo] === "VICTORY").map((r) => r.roomNo).sort((a, b) => a - b);
    const deadends = attempted.filter((r) => outcomes[r.roomNo] === "DEADEND").map((r) => r.roomNo).sort((a, b) => a - b);
    // RE-SELLO por SPAWN FIEL (P0a, opposite-of-facing): las 13 salas atacadas son VICTORY. r5/r7/r8
    // (combatmaps 37/39/40) estaban selladas DEADEND-fiel bajo el hardcode "south" — el spawn INFIEL
    // colocaba la party en un borde del que NO alcanzaba a los enemigos. Con el spawn FIEL (grupo =
    // opposite del facing de aproximación) la party aparece en el borde correcto y los GANA →
    // LIBERADAS DEADEND→VICTORY (hallazgo de fidelidad, ×2 determinista aislado; NO victoria bancada).
    expect(victories, "13 VICTORY (r5/r7/r8 LIBERADAS por el spawn fiel P0a) — spawn P0a = opposite-of-facing, DERIVADO con cita ASM (auditoría 7/7 Result-A)").toEqual([2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15]);
    expect(deadends, "0 DEADEND: el spawn fiel des-sella el bolsillo de cima de Destard — spawn P0a = opposite-of-facing, DERIVADO con cita ASM (auditoría 7/7 Result-A)").toEqual([]);

    // COBERTURA (manifest.json real; no existen ids room-<n> → patrón ch16b/ch18: ids reales +
    // note con el censo por-sala). dungeon-destard (mazmorra jugada) + cell-destard-room (salas 0xF).
    cov.mark("dungeon-destard").mark("cell-destard-room");
    cov.note(
      `PASADA 1 (cima) de las 16 salas de Destard (loc 35, combatmap=32+roomNo). Arnés conquerRoomAt ` +
        `(deep-link + Des Por + placas + flee-tras-DEADEND), seed-0, ×2 determinista. RESULTADO: 10 VICTORY ` +
        `[2,3,4,6,9,11,12,13,14,15] + 3 DEADEND-fiel [5,7,8] = 13 conquistadas/selladas; 3 PENDIENTE-entrada ` +
        `[0,1,10] (Fase 2b). r3 (combatmap 35, cámara abierta floor3) = VICTORIA EN TRÁNSITO (el pather cruza ` +
        `la celda y gana el combate de paso; step explícito no halla combate pero la sala queda despejada 0xA). ` +
        `DEADEND-fiel r5/r7/r8 = combatmaps 37/39/40: censados "entrada-SUR-N/A" (reach 0, TODOS los enemigos ` +
        `sellados, 0 triggers) → jugados con entrada P0a como sellados INGANABLES (enemigos inalcanzables, 0 ` +
        `bajas, party se retira; patrón dead-end #29). REFINA el censo: esas 3 filas pasan de "entrada-SUR-N/A" ` +
        `a "DEADEND-fiel jugado". PENDIENTE-entrada: r0/r1 (combatmaps 32/33) MURADAS por 4 lados en floor0 → ` +
        `foso/bottom-up; r10 (combatmap 42, ÚNICO candidato-dead-end del censo en Destard) = bolsillo de floor6 ` +
        `aislado por escalera/foso, el pather de descenso NO le halla plan desde la cima (MEDIDO: "sin plan" ` +
        `desde (6,3,1) y (6,7,3), Dijkstra completo con klimbup/down/despor) → su veredicto espera Fase 2b + P0b. ` +
        `Coverage sin ids room-<n> (no existen en manifest.json): marca dungeon-destard + cell-destard-room.`,
    );
    cov.write();
  });

  test("determinismo ×2: dos pasadas de cima frescas dan el MISMO digest", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const a = await runDestard(page);
    const b = await runDestard(page);
    expect(b.digest, "digest de outcomes byte-idéntico bajo reseed(0)").toBe(a.digest);
  });
});
