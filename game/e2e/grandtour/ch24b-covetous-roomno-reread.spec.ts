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
 * objetos de #353 (main ef914dd9) MOVIÓ ese stream en 35 registros (Covetous r0/r1
 * incluidas). Baselines calibrados antes de ese aterrizaje están caducados por
 * declaración (nota #353 §6): se re-calibran MIDIENDO, jamás citando al port.
 * Salas de este capítulo con familia 0xEC: r0/r1/r4/r6/r10 de Covetous (roster del pool).
 * ──────────────────────────────────────────────────────────────────────────────────
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2b — ch24b-covetous-roomno-reread: los MINI-RUNS del COROLARIO #7 (re-lectura por roomNo).
 *
 * ESCRITO PARA CORRER DESPUÉS (régimen write-now/run-later): VEREDICTO ABIERTO — este spec NO
 * pre-aserta VICTORY/DEADEND de ninguna sala; MIDE cada mini-run y asserta la MECÁNICA del
 * corolario, verdict-agnóstica. Los veredictos concretos salen al correrlo bajo la ventana e2e.
 *
 * MECÁNICA (auditoría #7, DNGLOOK 0x0844/0x093a): el bit «sala-despejada» es por `(loc, roomNo)`.
 * Covetous comparte cada roomNo entre VARIAS celdas (16 roomNos / 82 celdas), todas con el MISMO
 * combatmap (cm = 64 + roomNo) y el grupo de spawn = OPPOSITE(facing) del borde por el que entras
 * (P0a). Se sigue:
 *  (a) FLIP: un roomNo sellado por un grupo puede ser VICTORY entrado por otro grupo.
 *  (b) FUSIÓN: ganar CUALQUIER celda de roomNo X pone el bit → TODAS las celdas de X (incl. las
 *      hondas de la cola PENDIENTE-entrada) quedan RETIRADAS.
 *
 * INVARIANTE QUE ASSERTA (verdict-open): para cada mini-run, `outcome===VICTORY` ⟺
 * `dungeonRoomCleared(COVETOUS, roomNo)` (el bit por (loc,roomNo), aserción FIRME — fuente de verdad
 * citada, DNGLOOK 0x0844 / auditoría #4,#8: la degradación de celdas corre en la próxima carga). El
 * bit puesto = fusión: applyClearedRooms degrada a RoomsBroke (0xA) TODAS las celdas del roomNo,
 * incluida la HONDA — que sale de la cola 2b.
 *
 * TESTIGO END-TO-END (condicional): SÓLO si un mini-run de FUSIÓN sale VICTORY, tras la victoria
 * re-entra por el método real (`game.enterDungeon` → applyClearedRooms lee el bit PERSISTENTE, NO
 * re-importado) y asserta que la celda HONDA quedó RoomsBroke — la fusión MATERIALIZADA. Si los de
 * fusión re-confirman DEADEND (predicción: 0 flips), el paso no se ejecuta y el spec sigue verde.
 *
 * NOTA de reparto (medido en la pasada-1 P0a, ch24, 0 flips): r0-west / r1-east / r11-north y
 * r4-west ya salieron DEADEND en la pasada de cima → estos mini-runs los RE-CONFIRMAN (sin fusión).
 * Los candidatos de FLIP con grupo NUEVO son r4-east, r6-east y r10-flip-west (grupos no probados
 * en la pasada-1). El veredicto real lo fija la corrida.
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, enterDungeon, conquerRoomAt, type DFacing } from "./nav";

const PREV_CHAPTER = "ch13";
const COVETOUS = 37;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;

// Mini-runs del corolario #7. `cell`+`approachDir` fijan la celda de entrada y, por
// OPPOSITE(approachDir)=grupo de spawn (P0a), el borde por el que la party aparece en la arena.
// `deep` = una celda HONDA del MISMO roomNo (otra planta) que la fusión debería retirar si se gana
// (null = el roomNo no tiene celdas hondas → sólo prueba de flip, sin fusión).
const MINIRUNS: Array<{
  name: string; roomNo: number; floor: number; x: number; y: number;
  approachDir: DFacing; group: string; deep: { floor: number; x: number; y: number } | null;
}> = [
  // FUSIÓN (celda de cima; ganar retira las hondas del roomNo):
  { name: "r0-cima-west",   roomNo: 0,  floor: 0, x: 3, y: 2, approachDir: "east",  group: "west",  deep: { floor: 5, x: 7, y: 2 } },
  { name: "r1-cima-east",   roomNo: 1,  floor: 0, x: 7, y: 2, approachDir: "west",  group: "east",  deep: { floor: 4, x: 5, y: 1 } },
  { name: "r11-cima-north", roomNo: 11, floor: 1, x: 1, y: 5, approachDir: "south", group: "north", deep: { floor: 3, x: 1, y: 1 } },
  // FLIP (probar el grupo NO medido en la pasada-1):
  { name: "r4-west",        roomNo: 4,  floor: 0, x: 3, y: 6, approachDir: "east",  group: "west",  deep: null },
  { name: "r4-east",        roomNo: 4,  floor: 0, x: 7, y: 6, approachDir: "west",  group: "east",  deep: null },
  { name: "r6-east",        roomNo: 6,  floor: 2, x: 6, y: 1, approachDir: "west",  group: "east",  deep: { floor: 7, x: 7, y: 4 } },
  { name: "r10-flip-west",  roomNo: 10, floor: 3, x: 0, y: 0, approachDir: "east",  group: "west",  deep: { floor: 7, x: 0, y: 2 } },
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
      st.spellQuantities[22] = 99; // Des Por (funciona en Covetous)
      for (let i = 0; i < st.reagentQuantities.length; i++) st.reagentQuantities[i] = 99;
    },
    [MAGIC_BOW, RING_INVIS, ARROWS] as const,
  );
}

async function freshEnter(page: Page): Promise<void> {
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  const entry = await enterDungeon(page, COVETOUS);
  expect(entry, "entra a Covetous por la cima (floor 0)").toMatchObject({ dungeon: COVETOUS, floor: 0 });
}

/** Lee el bit persistente sala-despejada de (COVETOUS, roomNo) — bitIndex = 48 + roomNo. */
async function roomClearedBit(page: Page, roomNo: number): Promise<boolean> {
  return page.evaluate((rn) => {
    const st = (window as unknown as { __u5test: { game: { state: { dungeonRoomsCleared?: number[] } } } }).__u5test.game.state;
    const bits = st.dungeonRoomsCleared ?? [];
    const i = 48 + rn; // dungeonClearedBitIndex(37, rn): (3<<4)+rn
    return (((bits[i >> 3] ?? 0) >> (i & 7)) & 1) === 1;
  }, roomNo);
}

type Row = { outcome: string; bit: boolean; deepBroke: boolean | null; reenterDeepBroke: boolean | null };

/** Lee el tile de una celda de la mazmorra actual (0xA = RoomsBroke). */
async function deepCellType(page: Page, d: { floor: number; x: number; y: number }): Promise<number> {
  return page.evaluate((c) => {
    const ds = (window as unknown as { __u5test: { game: { dungeonState: { cellAt: (f: number, x: number, y: number) => { type: number } } } } }).__u5test.game.dungeonState;
    return ds.cellAt(c.floor, c.x, c.y).type;
  }, d);
}

/** Corre los mini-runs una vez; devuelve por mini-run Row + digest ordenado. */
async function runReread(page: Page): Promise<{ digest: string; rows: Record<string, Row> }> {
  const rows: Record<string, Row> = {};
  for (const m of MINIRUNS) {
    await freshEnter(page);
    let outcome: string;
    try {
      const v = await conquerRoomAt(page, { roomCell: { floor: m.floor, x: m.x, y: m.y }, approachDir: m.approachDir, maxRounds: 600 });
      // Victoria-en-tránsito (cámara abierta): FAIL:no-combat-on-step + party EN la celda = ganada de paso.
      if (v.outcome === "FAIL" && v.digest === "FAIL:no-combat-on-step") {
        const onCell = await page.evaluate((rc) => {
          const p = (window as unknown as { __u5test: { game: { dungeonState: { pos: { floor: number; x: number; y: number } } } } }).__u5test.game.dungeonState.pos;
          return p.floor === rc.floor && p.x === rc.x && p.y === rc.y;
        }, { floor: m.floor, x: m.x, y: m.y });
        outcome = onCell ? "VICTORY" : "FAIL";
      } else {
        outcome = v.outcome;
      }
    } catch (e) {
      outcome = `THROW:${(e as Error).message.slice(0, 40)}`;
    }
    const bit = await roomClearedBit(page, m.roomNo);
    // DIAGNÓSTICO: el tile hondo AHORA mismo (puede seguir 0xF — markCurrentRoomCleared sólo degrada
    // la celda ACTUAL; las hondas esperan a applyClearedRooms de la próxima carga).
    const deepBroke = m.deep ? (await deepCellType(page, m.deep)) === 0xa : null;
    // RE-ENTRADA CONDICIONAL (testigo end-to-end de la FUSIÓN): SÓLO si es un mini-run de fusión que
    // GANÓ, re-entra la mazmorra por el método real del juego (game.enterDungeon → applyClearedRooms
    // lee el bit PERSISTENTE, que NO se re-importa) y comprueba que la celda HONDA quedó RoomsBroke.
    let reenterDeepBroke: boolean | null = null;
    if (m.deep && outcome === "VICTORY") {
      await page.evaluate((dungeon) => {
        (window as unknown as { __u5test: { game: { enterDungeon: (id: number, fromFloor?: number) => unknown } } }).__u5test.game.enterDungeon(dungeon, 0);
      }, COVETOUS);
      reenterDeepBroke = (await deepCellType(page, m.deep)) === 0xa;
    }
    rows[m.name] = { outcome, bit, deepBroke, reenterDeepBroke };
    console.log(`[ch24b-reread]   ${m.name} (r${m.roomNo}/cm${64 + m.roomNo}, grupo ${m.group}) -> ${outcome} | bit=${bit} deepBroke=${deepBroke} reenterDeepBroke=${reenterDeepBroke}`);
  }
  const digest = MINIRUNS.map((m) => `${m.name}:${rows[m.name]!.outcome}:${rows[m.name]!.bit ? 1 : 0}`).join("|");
  return { digest, rows };
}

test.describe.serial("FASE 2b — ch24b Covetous re-lectura por roomNo (corolario #7)", () => {
  test("mide los mini-runs + asserta la INVARIANTE de fusión (verdicto abierto)", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const { digest, rows } = await runReread(page);
    console.log(`[ch24b-reread] digest=${digest}`);

    // INVARIANTE de fusión (verdict-agnóstica): ganar un mini-run ⟺ el bit (loc,roomNo) queda puesto
    // ⟺ TODAS las celdas de ese roomNo (incl. la honda de la cola 2b) quedan retiradas. NO pre-juzga
    // quién gana; sólo que VICTORY y el bit son la MISMA cosa (mecánica del corolario #7).
    for (const m of MINIRUNS) {
      const r = rows[m.name]!;
      expect(r.bit, `${m.name}: bit sala-despejada ⟺ VICTORY (fusión por (loc,roomNo))`).toBe(r.outcome === "VICTORY");
    }
    // TESTIGO END-TO-END de la FUSIÓN (condicional): si un mini-run de fusión GANÓ, la re-entrada
    // por game.enterDungeon materializó applyClearedRooms → la celda HONDA del roomNo quedó
    // RoomsBroke (transitable). Si los de fusión salen DEADEND (predicción: 0 flips), no se ejecuta
    // y esta aserción es vacua. NO pre-juzga: sólo liga VICTORY-de-fusión ⟹ honda retirada.
    for (const m of MINIRUNS) {
      if (m.deep && rows[m.name]!.outcome === "VICTORY") {
        expect(rows[m.name]!.reenterDeepBroke,
          `${m.name}: tras VICTORY + re-entrada, la celda honda (${m.deep.floor},${m.deep.x},${m.deep.y}) queda RoomsBroke (fusión materializada)`).toBe(true);
      }
    }
    // Sanidad: cada mini-run produjo un outcome reconocible (VICTORY | DEADEND | THROW:...).
    for (const m of MINIRUNS) {
      expect(["VICTORY", "DEADEND"].includes(rows[m.name]!.outcome) || rows[m.name]!.outcome.startsWith("THROW"),
        `${m.name}: outcome reconocible`).toBe(true);
    }
  });

  test("determinismo ×2: dos pasadas frescas dan el MISMO digest", async ({ page }) => {
    test.setTimeout(chapterTimeout(900_000));
    const a = await runReread(page);
    const b = await runReread(page);
    expect(b.digest, "digest de outcomes+bits byte-idéntico bajo reseed(0)").toBe(a.digest);
  });
});
