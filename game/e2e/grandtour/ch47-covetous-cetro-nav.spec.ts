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
 * r5 (cm69): su bando enemigo ENTERO sale del pool (15 unidades 0xEC) — la línea vieja
 * «queda con CERO enemigos» describía el fix de EXCLUSIÓN, que ya no es el del árbol.
 * ──────────────────────────────────────────────────────────────────────────────────
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2b (carril f2b-resto) — ch47: las 4 PENDIENTE-entrada de Covetous (loc 37,
 * combatmap = 64 + roomNo): r5 (#69), r12 (#76), r13 (#77), r14 (#78).
 *
 * PAQUETE DE ARNÉS fields/sceptreKey/crossRooms EN RAMA (descent-planner.ts, este carril
 * como dueño reasignado; derivación canónica de pasabilidad = acta f2b-wrong
 * re/notes/wrong-campos-pasabilidad.md: DUNGEON:0x05FF pisa campos sub≠3 y bombas, SOLO
 * 0x83 rebota 0x0470/0x05d7 y el Cetro lo disuelve CAST 0x1966).
 *
 * DERIVACIÓN ESTÁTICA (mirror dungeon_pocket_reach, re-derivada con la semántica FIEL —
 * los subs reales de Covetous: 13× sub-3 Energy + 12× sub-1 veneno pisable):
 *   · r12 (f5 3,4, única celda): ruta FRESCA con SOLO `fields` — el «campo» de la ruta es
 *     f4(4,6) sub-1 (veneno, SE PISA): cima→f1 wrap→klimbdown ×3 columna (6,6)→(4,6)→
 *     Des Por→f5(3,6)→(2,6)→(2,4)→step-room ESTE a (3,4). Ni cetro ni cruces.
 *   · r13 (f5 4,4): misma ruta al campo pisable f4(4,6), Des Por ×2 a f6(4,4) y KLIMB-UP
 *     (semilla LadderUp f6(4,4)) aterriza en la sala. Ni cetro ni cruces.
 *   · r14 (f5 0,0): el CETRO es la ÚNICA llave (fiel-SIN-cetro = SIN-RUTA): …klimbdown ×4
 *     columna (6,6)→Des Por f6→(6,7)→wrap-norte (6,0)→campo f6(7,0) **sub-3 Energy
 *     [CETRO]**→wrap-este (0,0) y KLIMB-UP (semilla LadderUp f6(0,0)). 1ª validación de
 *     cetro-como-llave-de-NAVEGACIÓN (hipótesis ch24/arena-fields INSTANCIADA).
 *   · r5 (f7 1,3 y 7,3): SIN ruta fresca incluso con cetro. Entrada real = cetro + CRUCE
 *     de salas DEADEND-que-huye (flee-cross, game.ts:5689/dng_enter_room 0x0084): …→r3
 *     f5(6,7) [CRUCE]→Des Por ×2→f7(7,7)→(7,6)→(0,6)→campo (0,5) sub-3 [CETRO]→r10 (0,4)
 *     [CRUCE]→r3 (0,3) [CRUCE]→paso ESTE a r5 (1,3). r10/r3 = DEADEND-que-huye jugados
 *     ch24 (cruzables). Con deadends=muro r5 es inalcanzable: el cruce es su única entrada.
 *
 * VEREDICTO ABIERTO por sala: VICTORY | DEADEND | DEADEND-STUCK (jamás FAIL/THROW).
 * Entrada FRESCA por sala (patrón ch24 de Covetous). Guarda anti-fabricación: VICTORY
 * exige bit (DNGLOOK 0x0844; Covetous = loc 37 → idx 37-0x21=4 → colapso Despise → 3).
 * Determinismo ×2. Loadout #47 + CETRO (lbArtifacts.sceptre) para la llave de navegación.
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, enterDungeon, conquerRoomAt, type DFacing } from "./nav";

const PREV_CHAPTER = "ch13";
const COVETOUS = 37;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;

// Paquete opt-in (descent-planner.ts): fields = pasabilidad fiel; sceptreKey = 0x83
// disoluble. crossRooms va por-sala (solo r5 lo necesita — mantener el pather mínimo).
const PACK = { fields: true, sceptreKey: true } as const;

const ROOMS: Array<{
  label: string;
  roomNo: number;
  roomCell: { floor: number; x: number; y: number };
  spec: { enterByLadder?: "down" | "up"; approachDir?: DFacing; crossRooms?: boolean };
}> = [
  { label: "r12", roomNo: 12, roomCell: { floor: 5, x: 3, y: 4 }, spec: { approachDir: "east" } },
  { label: "r13", roomNo: 13, roomCell: { floor: 5, x: 4, y: 4 }, spec: { enterByLadder: "up" } },
  { label: "r14", roomNo: 14, roomCell: { floor: 5, x: 0, y: 0 }, spec: { enterByLadder: "up" } },
  // r5: dos celdas (1,3)/(7,3) del mismo roomNo; se ataca la (1,3) por el cruce derivado.
  { label: "r5", roomNo: 5, roomCell: { floor: 7, x: 1, y: 3 }, spec: { approachDir: "east", crossRooms: true } },
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
      st.spellQuantities[22] = 99; // Des Por
      for (let i = 0; i < st.reagentQuantities.length; i++) st.reagentQuantities[i] = 99;
      // CETRO: la llave de navegación (dissolveFacingField, CAST 0x1966). Sólo el artefacto;
      // amulet/crown NO (endgameReady fuera de juego aquí — Covetous no dispara rescate).
      st.lbArtifacts = { ...st.lbArtifacts, sceptre: true };
    },
    [MAGIC_BOW, RING_INVIS, ARROWS] as const,
  );
}

/** Bit de sala-despejada (DNGLOOK 0x0844): Covetous loc 37 → idx 4 → colapso Despise → 3. */
async function clearedBit(page: Page, roomNo: number): Promise<boolean> {
  return page.evaluate((rn) => {
    const g = (window as unknown as { __u5test: { game: { state: { dungeonRoomsCleared?: number[] } } } }).__u5test.game;
    const bits = g.state.dungeonRoomsCleared;
    const bit = (3 << 4) + rn;
    return !!bits && (((bits[bit >> 3] ?? 0) >> (bit & 7)) & 1) === 1;
  }, roomNo);
}

async function runRoom(page: Page, room: (typeof ROOMS)[number]): Promise<string> {
  await bootWorld(page);
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  await enterDungeon(page, COVETOUS);
  if (await clearedBit(page, room.roomNo)) return "PRE-CLEARED(!)";
  try {
    const v = await conquerRoomAt(page, { roomCell: room.roomCell, ...room.spec, ...PACK, maxRounds: 600, maxIters: 160 });
    const bit = v.outcome === "VICTORY" ? ` bit=${await clearedBit(page, room.roomNo)}` : "";
    console.log(`[ch47-covetous] ${room.label} digest=${v.digest}${bit}`);
    if (v.outcome === "VICTORY" && !(await clearedBit(page, room.roomNo))) return "VICTORY-SIN-BIT(!)";
    return v.outcome;
  } catch (e) {
    return `THROW:${(e as Error).message.slice(0, 60)}`;
  }
}

async function runAll(page: Page): Promise<string> {
  const parts: string[] = [];
  for (const r of ROOMS) parts.push(`${r.label}=${await runRoom(page, r)}`);
  return parts.join("|");
}

test.describe.serial("FASE 2b — ch47 Covetous r5/r12/r13/r14 (cetro-nav + flee-cross, veredicto ABIERTO)", () => {
  test("las 4 se alcanzan con la llave-cetro (r5 además con cruce) y RESUELVEN limpio", async ({ page }) => {
    test.setTimeout(chapterTimeout(2_400_000));
    const t0 = Date.now();
    const digest = await runAll(page);
    const secs = Math.round((Date.now() - t0) / 1000);
    console.log(`[ch47-covetous] ${secs}s ${digest}`);
    const OK = ["VICTORY", "DEADEND", "DEADEND-STUCK"];
    for (const part of digest.split("|")) {
      const outcome = part.split("=")[1]!;
      expect(OK, `${part}: resuelve limpio (no FAIL/THROW)`).toContain(outcome);
    }
  });

  test("determinismo ×2: dos pasadas frescas dan el MISMO digest", async ({ page }) => {
    test.setTimeout(chapterTimeout(4_800_000));
    const a = await runAll(page);
    const b = await runAll(page);
    expect(b, "digest byte-idéntico bajo reseed(0)").toBe(a);
  });
});
