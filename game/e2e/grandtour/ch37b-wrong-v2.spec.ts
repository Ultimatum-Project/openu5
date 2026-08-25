/**
 *
 * ── `0xec`: LA PREMISA VIEJA QUEDA RETIRADA (corrección propagada por el carril
 * cabos-353, 2026-08-16; texto canónico en ch24-salas-covetous, pieza 14 del lote #54) ──
 * Lo que este encabezado decía — «el fix saca la familia `0xEC` del roster y NO está
 * derivado QUÉ coloca el original en su lugar; los 4 bytes que lee son pila sin
 * inicializar y sólo la sonda-oráculo puede decirlo» — **está REFUTADO por derivación**:
 * esos 4 bytes SÍ se inicializan. `DNGLOOK.OVL 0x1273-0x128c` tira `rand(0,7)` CUATRO
 * veces contra la tabla de 8 índices de DS `0x385e` (= `DATA.OVL` fileoff `0x386e`:
 * `14 15 16 22 21 18 1f 18`) y el consumo `0x12ee-0x12f7` lee `pool[tile & 3]` ⇒ los
 * tiles 236-239 sacan enemigos DISTINTOS («Random enemy groups»). El port lo cablea
 * (`rollEcGroupPool`): estas salas ya NO «pierden remolinos» ni quedan vacías —
 * reciben ENEMIGOS REALES que hay que PELEAR. Derivación: re/notes/dnglook-117e-body.md.
 *
 * LO QUE SIGUE SIN DERIVAR (por lo que el spec SIGUE SIENDO DETECTOR): qué especie toca
 * en una corrida dada — depende de por dónde va el stream RNG al entrar, y la siembra de
 * objetos de #353 (main ef914dd9) MOVIÓ ese stream en 35 registros. Baselines calibrados
 * antes de ese aterrizaje están caducados por declaración (nota #353 §6): se re-calibran
 * MIDIENDO, jamás citando al port.
 * Salas de este capítulo con familia 0xEC: r5/r6 de Wrong (roster del pool).
 * ──────────────────────────────────────────────────────────────────────────────────
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2b — ch37b: WRONG v2 — las 5 salas PENDIENTES (r5, r6, r13, r14, r15) con
 * ENTRADA FRESCA POR SALA (patrón ch37-doom-cola / lote-2 ch34).
 *
 * ── POR QUÉ EXISTE ESTE v2 (encargo WRONG-V2-PREP del lead, 2026-07-23) ────────────────
 * El spec v1 (`ch37-wrong-campos.spec.ts`) mide las 11 salas de la cola de Wrong en UN
 * SOLO STREAM desde la cima (fixpoint con el pather fields/sceptreKey): esa endurance
 * revienta el browser antes de completar la pasada. Este v2 es el plan C: cada sala es
 * un TEST INDEPENDIENTE con boot + checkpoint + reseed(0) + loadout + teleport a una
 * celda-semilla + entrada por el MECANISMO FIEL — restartable, coste por sala en
 * minutos. La entrada fresca por sala es MEDICIÓN NUEVA legítima (así se sellaron 7 de
 * las 8 mazmorras); NO reproduce el stream del v1. Ámbito: SOLO las 5 salas aún
 * pendientes de Wrong (r7-r12 quedan en el ámbito del v1/lead).
 *
 * ── FUENTES (acta canónica + planner; NO re-derivado aquí) ─────────────────────────────
 * re/notes/wrong-campos-pasabilidad.md (carril f2b-wrong 2026-07-22):
 *  - Semántica fiel DUNGEON:0x05FF: sólo muros hi∈{0xB,0xC,0xD} bloquean; campos sub<3
 *    (sueño/veneno/fuego 0x80-0x82) SE PISAN; SÓLO el 0x83 exacto (Electric) rebota
 *    (0x0470/0x05d7) y el Cetro lo disuelve ((U)se, CAST 0x1966 rama residente;
 *    dungeon.ts:316 `sub === MagicFieldType.Energy`). Bombas 0x62 se pisan y limpian.
 *  - Cetro-como-llave INSTANCIADA en Wrong: «r5 approach único = el propio campo 0x83
 *    f3(1,1) (r6 ídem (5,1); r15 = bombas f7(7,2..5) tras el 0x83 f7(7,6) del bolsillo
 *    del fondo)» (acta §3). El paquete de navegación fields/sceptreKey vive en
 *    descent-planner.ts + dungeonDescendTo (nav.ts), en main, opt-in (default OFF).
 *  - Flood fiel: la cima alcanza floors 0-7 (200 celdas sin cetro) ⇒ toda celda-semilla
 *    de abajo es legítimamente alcanzable; el teleport es costura de POSICIONAMIENTO
 *    (#47, patrón doom-cola) — la ENTRADA a la sala es siempre el mecanismo real.
 *
 * ── OJO r13/r14 (re-derivación Covetous): sub de cada campo VERIFICADO ─────────────────
 * dungeons.json[3] (Wrong, = DUNGEON.DAT[0x600:0x800] byte-exacto 512/512, acta §1):
 *  - r13 (f5(3,4)=Rd): su único vecino no-muro es (3,5)=LadderDown → entrada = paso
 *    NORTE desde (3,5). CERO campos en la micro-ruta (los 0x82 fire de f5(2,5)/(4,5)
 *    son sub 2 = PISABLES pero ni se cruzan desde la semilla (3,6)). Cetro NO necesario.
 *  - r14 (f7(3,5)=Re): entrada canónica de cima = klimb-DOWN desde f6(3,5)=LadderUpDown
 *    (aterriza SOBRE la sala → combate, patrón klimb de doom-cola). CERO campos en la
 *    ruta (los 0x83 de f6 están en los bordes, fuera). Cetro NO necesario.
 *  - r5/r6/r15 SÍ llevan 0x83 en el approach (sub 3 exacto) → transición sceptre.
 *
 * ── ENTRADAS CANÓNICAS (celda-semilla → mecanismo; facing auditado vs playerStarts) ────
 * Wrong = loc 36, combatmap = 48 + roomNo (posición de array, DUNGEON.CBT[N-16]).
 * P0a: spawn = grupo OPUESTO al facing de entrada (roomEntry.ts). Grupos REALES por cm
 * (auditados en combatmaps.json; los degenerados son (0,0)×6):
 *  r5  cm53: sólo EAST real  → entrada facing WEST  ✓ (paso oeste (1,1)→(0,1))
 *  r6  cm54: sólo WEST real  → entrada facing EAST  ✓ (paso este (5,1)→(6,1))
 *  r13 cm61: 4 reales        → entrada facing NORTH (forzada por geometría) → grupo south
 *  r14 cm62: 4 reales        → klimb-down con facing NORTH (girar en sitio es legal y
 *            gratis; el binario lee g_dng_facing) → grupo south
 *  r15 cm63: WEST y SOUTH reales → entrada facing NORTH (columna de bombas, único
 *            approach del fondo) → grupo south ✓ real
 * Ningún cm de estas 5 salas contiene tiles 0x7X (ShadowlordBoundary) ⇒ sin sceptreClear
 * en combate (a diferencia de doom-cola r5/r10/r13).
 *
 * VEREDICTO ABIERTO por sala (VICTORY | DEADEND | DEADEND-STUCK — nunca FAIL/THROW), con
 * GUARDA ANTI-FAB: una VICTORY sin el bit de sala-despejada (dungeonRoomsCleared,
 * DNGLOOK 0x0844) se reporta FAB:victory-sin-bit = rojo. Determinismo: cada test corre
 * la entrada fresca ×2 bajo reseed(0) y exige digest byte-idéntico. Sin .gam (specs de
 * veredicto, como ch27/ch34/ch37-doom-cola: el sello es el digest).
 *
 * Depuración: `U5_CH37B_ONLY=r13` (o lista `r5,r15`) corre salas sueltas.
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, conquerRoom, inDungeonCombat, dungeonKlimb, dungeonDescendTo, type DFacing } from "./nav";

const PREV_CHAPTER = "ch13";
const WRONG = 36;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;

type Entry =
  | { kind: "descend-step"; approach: { f: number; x: number; y: number }; facing: DFacing; fields?: boolean; sceptreKey?: boolean }
  | { kind: "klimb"; dir: "down" | "up"; facing: DFacing };

type RoomSpec = {
  label: string; cm: number; roomNo: number;
  room: { f: number; x: number; y: number };
  tp: { f: number; x: number; y: number };
  entry: Entry;
  note: string;
};

// Orden por roomNo. `tp` = celda-semilla (teleportDungeon, costura #47); `entry` =
// mecanismo fiel: descend-step navega de la semilla al approach con dungeonDescendTo
// (que ejecuta las transiciones sceptre/bomba REALES: encara + (U)se Cetro del picker +
// pisa) y da el paso final; klimb aterriza sobre la sala (0x1e79).
const ROOMS: RoomSpec[] = [
  { label: "r5", cm: 53, roomNo: 5, room: { f: 3, x: 0, y: 1 }, tp: { f: 3, x: 2, y: 1 },
    entry: { kind: "descend-step", approach: { f: 3, x: 1, y: 1 }, facing: "west", fields: true, sceptreKey: true },
    note: "MURADA: approach = el propio 0x83 f3(1,1) (acta §3) — cetro disuelve, pisa, paso oeste" },
  { label: "r6", cm: 54, roomNo: 6, room: { f: 3, x: 6, y: 1 }, tp: { f: 3, x: 4, y: 1 },
    entry: { kind: "descend-step", approach: { f: 3, x: 5, y: 1 }, facing: "east", fields: true, sceptreKey: true },
    note: "MURADA espejo de r5: approach = 0x83 f3(5,1) — cetro disuelve, pisa, paso este" },
  { label: "r13", cm: 61, roomNo: 13, room: { f: 5, x: 3, y: 4 }, tp: { f: 5, x: 3, y: 6 },
    entry: { kind: "descend-step", approach: { f: 5, x: 3, y: 5 }, facing: "north" },
    note: "único vecino no-muro = (3,5)=LadderDown; paso norte; SIN campos en ruta (cetro NO)" },
  { label: "r14", cm: 62, roomNo: 14, room: { f: 7, x: 3, y: 5 }, tp: { f: 6, x: 3, y: 5 },
    entry: { kind: "klimb", dir: "down", facing: "north" },
    note: "klimb-DOWN f6(3,5)=LadderUpDown aterriza SOBRE la sala (patrón doom); SIN campos (cetro NO)" },
  { label: "r15", cm: 63, roomNo: 15, room: { f: 7, x: 7, y: 1 }, tp: { f: 7, x: 7, y: 7 },
    entry: { kind: "descend-step", approach: { f: 7, x: 7, y: 2 }, facing: "north", fields: true, sceptreKey: true },
    note: "MURADA fondo: semilla = entrada real fromUnderworld f7(7,7); cetro en (7,6) 0x83 + bombas (7,5..2) + paso norte (acta §3)" },
];

/** Loadout Wrong (patrón v1/doom-cola): ranged + invis + luz + CETRO (llave de los 0x83;
 *  lbArtifacts sin amulet/crown — patrón ch27, irrelevante fuera de Doom). Sin Des Por:
 *  todas las micro-rutas semilla→approach son de la MISMA planta (noDespor en el planner). */
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
      st.lightSpellMins = 9999; st.torchTurns = 9999;
      st.lbArtifacts = { amulet: false, crown: false, sceptre: true };
    },
    [MAGIC_BOW, RING_INVIS, ARROWS] as const,
  );
}

const setFacing = (page: Page, facing: DFacing): Promise<void> =>
  page.evaluate((f) => {
    (window as unknown as { __u5test: { game: { dungeonState: { pos: { facing: string } } } } }).__u5test.game.dungeonState.pos.facing = f;
  }, facing);

const stepForward = (page: Page): Promise<void> =>
  page.evaluate(() => {
    (window as unknown as { __u5test: { game: { dungeonCommand: (c: string) => unknown } } }).__u5test.game.dungeonCommand("forward");
  });

/** Bit de sala-despejada (dungeonRoomsCleared, DNGLOOK 0x0844) — misma fórmula que
 *  nav.ts roomClearedInTransit: idx = loc−0x21 (colapsa Deceit/Despise), bit =
 *  (idx<<4)+roomNo, LSB-first. GUARDA ANTI-FAB: VICTORY sin este bit = rojo. */
async function roomBitSet(page: Page, roomNo: number): Promise<boolean> {
  return page.evaluate((rn) => {
    const g = (window as unknown as { __u5test: { game: { dungeonState: any; state: { dungeonRoomsCleared?: number[] } } } }).__u5test.game;
    const ds = g.dungeonState;
    if (!ds) return false;
    let idx = (ds.pos.dungeon as number) - 0x21;
    if (idx >= 1) idx -= 1;
    const bit = (idx << 4) + rn;
    const bits = g.state.dungeonRoomsCleared;
    return !!bits && (((bits[bit >> 3] ?? 0) >> (bit & 7)) & 1) === 1;
  }, roomNo);
}

/** Entrada FRESCA a UNA sala: boot + ch13 + reseed(0) + loadout + tp semilla + mecanismo
 *  fiel + veredicto abierto + guarda anti-fab. Devuelve el digest de la sala. */
async function conquerFresh(page: Page, r: RoomSpec): Promise<string> {
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  await page.evaluate(
    ({ id, f, x, y }) => (window as unknown as { __u5debug: { teleportDungeon: (d: number, f: number, x: number, y: number) => void } }).__u5debug.teleportDungeon(id, f, x, y),
    { id: WRONG, f: r.tp.f, x: r.tp.x, y: r.tp.y },
  );
  try {
    if (r.entry.kind === "descend-step") {
      const e = r.entry;
      // Semilla → approach por el mecanismo real (pasos, bombas pisables, (U)se Cetro
      // sobre 0x83 encarado). Rutas cortas de la MISMA planta ⇒ noDespor + presupuesto corto.
      const at = await dungeonDescendTo(
        page,
        (f, x, y) => f === e.approach.f && x === e.approach.x && y === e.approach.y,
        { noDespor: true, maxIters: 30, fields: e.fields, sceptreKey: e.sceptreKey },
      );
      if (!at) return "FAIL:left-dungeon";
      await setFacing(page, e.facing);
      await stepForward(page);
    } else {
      await setFacing(page, r.entry.facing); // girar en sitio (g_dng_facing) antes de klimbar
      await dungeonKlimb(page, r.entry.dir);
    }
    if (!(await inDungeonCombat(page))) {
      const p = await page.evaluate(() => {
        const ds = (window as unknown as { __u5test: { game: { dungeonState: { pos: { floor: number; x: number; y: number; facing: string } } | null } } }).__u5test.game.dungeonState;
        return ds ? `${ds.pos.floor}(${ds.pos.x},${ds.pos.y})${ds.pos.facing}` : "null";
      });
      return `FAIL:no-combat-on-entry@${p}`;
    }
    // La celda de ENTRADA del combate debe ser LA SALA pedida (guardia anti-desvío).
    const pos = await page.evaluate(() => {
      const ds = (window as unknown as { __u5test: { game: { dungeonState: { pos: { floor: number; x: number; y: number } } } } }).__u5test.game.dungeonState;
      return ds ? { f: ds.pos.floor, x: ds.pos.x, y: ds.pos.y } : null;
    });
    if (!pos || pos.f !== r.room.f || pos.x !== r.room.x || pos.y !== r.room.y) {
      return `FAIL:wrong-room@${pos ? `${pos.f}(${pos.x},${pos.y})` : "null"}`;
    }
    const v = await conquerRoom(page, { maxRounds: 600 });
    if (v.outcome === "VICTORY" && !(await roomBitSet(page, r.roomNo))) return "FAB:victory-sin-bit";
    return v.digest;
  } catch (e) {
    return `THROW:${(e as Error).message.slice(0, 48)}`;
  }
}

// Filtro de DEPURACIÓN (`U5_CH37B_ONLY=r5,r15`): corre salas sueltas. SIN la env corren
// las 5 (cada una es un test independiente y restartable — el sello es por-sala).
const ONLY = process.env.U5_CH37B_ONLY?.split(",").map((s) => s.trim()).filter(Boolean);
const ACTIVE = ONLY?.length ? ROOMS.filter((r) => ONLY.includes(r.label)) : ROOMS;

const OK = ["VICTORY", "DEADEND", "DEADEND-STUCK"];

test.describe("FASE 2b — ch37b Wrong v2 (5 pendientes, entrada fresca por sala, veredicto ABIERTO)", () => {
  for (const r of ACTIVE) {
    test(`${r.label} (cm${r.cm}) resuelve limpio y determinista ×2 — ${r.note}`, async ({ page }) => {
      test.setTimeout(chapterTimeout(1_200_000));
      const t0 = Date.now();
      const a = await conquerFresh(page, r);
      console.log(`[ch37b-wrong-v2] ${r.label} pass1=${a} (${Math.round((Date.now() - t0) / 1000)}s)`);
      expect(OK, `sala ${r.label} (cm${r.cm}) resuelve limpio: ${a}`).toContain(a.split(":")[0]!);
      const b = await conquerFresh(page, r);
      console.log(`[ch37b-wrong-v2] ${r.label} pass2=${b} (${Math.round((Date.now() - t0) / 1000)}s total)`);
      expect(b, `digest de ${r.label} byte-idéntico bajo reseed(0)`).toBe(a);
    });
  }
});
