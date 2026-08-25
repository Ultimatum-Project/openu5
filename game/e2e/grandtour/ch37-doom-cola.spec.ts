/**
 *
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **DETECTOR-DE-REGRESIÓN.** Sus baselines están CALIBRADOS TRAS MEDIR: registran el
 * comportamiento del PORT, no una derivación del binario. Un rojo aquí significa
 * **«el port CAMBIÓ»**, no «el port está mal» — se ADJUDICA contra el binario.
 * **JAMÁS se re-baselinea citando al port**: eso es sellar port con port.
 * ──────────────────────────────────────────────────────────────────────────────────
 * FASE 2b — ch37: la COLA DE DOOM entera (10 salas PENDIENTE-entrada del censo
 * docs/guias/doom/CENSO-COMBATMAPS.md; stubs docs/plan-fase2b-stubs.md §DOOM-klimb/§DOOM-foso/
 * §DOOM-bolsillo). Doom (loc 40), combatmap = 112 + roomNo. Cada sala se mide con ENTRADA FRESCA
 * (boot + ch17 + reseed(0) + teleportDungeon a la celda-semilla → mecanismo fiel de entrada), el
 * patrón de lote-2 (ch34): el teleport es costura de POSICIONAMIENTO (#47, cero cambio de core);
 * la ENTRADA a la sala es siempre el mecanismo real (klimb 0x1e79 / pitFall 0x0A4C / paso), que es
 * quien decide el spawn (P0a opposite-of-facing, roomEntry.ts). El fresh-reset por sala gestiona el
 * CHOKE f2→f3 de un solo uso (ningún run re-usa la escalera interior de r3/#99) y las MURADAS que
 * varan (la varada muere con el run; no contamina).
 *
 * ── SEMILLAS (derivadas de dungeons.json[7]; celdas verificadas contra el JSON) ────────────────
 *  KLIMB (stub §DOOM-klimb — klimbar aterriza SOBRE la sala → combate):
 *   r2 (#114) f1(1,1) ← klimb-UP  desde f2(1,1)=Lu   · facing north (ruta f2 (1,3)→(1,2)→(1,1))
 *   r6 (#118) f2(5,5) ← klimb-DOWN desde f1(5,5)=LB  · facing south (ruta f1 (5,4)→(5,5))
 *   r9 (#121) f6(5,3) ← klimb-UP  desde f7(5,3)=Lu   · facing north (giro en sitio; ver §FACING)
 *   r10(#122) f6(1,3) ← klimb-UP  desde f7(1,3)=Lu   · facing north (giro en sitio; ver §FACING)
 *   r13(#125) f6(3,7) ← klimb-UP  desde f7(3,7)=Lu   · facing north (giro en sitio; ver §FACING)
 *  FOSO (stub §DOOM-foso — pisar el PitFall (trap sub&7==1) cae planta+1 misma (x,y) → sala):
 *   r15(#127) f7(5,7) ← FOSO f6(5,7): tp f6(4,7), paso ESTE sobre el foso → cae sobre r15.
 *   r12(#124) f7(1,7) ← FOSO f6(1,7): los 4 vecinos ORTOGONALES de f6(1,7) son muro 0xB, pero el
 *     grid de mazmorra es TOROIDAL (wrap &7, DUNGEON get_facing_cell 0x1d66-0x1d85 / paso 0x057a):
 *     el paso NORTE desde f6(1,0) WRAPEA (y=0→7) sobre el foso (1,7) → cae sobre r12. Es la ÚNICA
 *     marcha física posible sobre ese foso (las otras 3 llegadas son muro) ⇒ facing north ⇒ grupo
 *     south, que en cm124 es DEGENERADO → dispara el guard anti-(0,0) de roomEntry.ts (fallback
 *     determinista → north; comportamiento del binario = Q2 pendiente de oráculo, documentado).
 *     (Vía alterna del stub SIN guard: walk-in f7(2,7) paso oeste → grupo east real — medida en la
 *     pasada exploratoria, VICTORY; corrobora el veredicto de la sala por su otra entrada real.)
 *  BOLSILLO (stub §DOOM-bolsillo — approach sólo alcanzable por klimb desde otro compartimento):
 *   r1 (#113) f3(3,3): tp f4(2,3)=Lu → klimb-UP (aterriza f3(2,3)=Ld, el approach del stub) →
 *     encarar ESTE → paso → combate. (Reproduce la ruta derivada: klimb desde f4.)
 *   r5 (#117) f4(3,3): approach f4(2,3)=Lu → tp allí, paso ESTE → combate.
 *   r11(#123) f7(7,3): pocket {(5,3)=Lu,(6,3),r11} → tp f7(6,3), paso ESTE → combate.
 *
 * ── FACING CANÓNICO (P0a spawn = opposite-of-facing; roomEntry.ts) ─────────────────────────────
 * Los grupos player-starts DEGENERADOS ((0,0)×6) del .CBT son las direcciones NO-enterables de
 * cada sala (roomEntry.ts §GUARD). En entradas por klimb/foso el binario lee g_dng_facing (el
 * jugador puede GIRAR en el sitio antes de klimbar — girar es legal y gratis en mecánica), así
 * que el facing canónico de cada entrada se elige entre los que dan GRUPO REAL (auditado contra
 * playerStarts de cada cm): r2 north→south (único real), r6 south→north (único real), r9
 * north→south, r10 north→south (único real), r13 north→south, r15 cualquiera (sus 4 grupos son
 * idénticos), r1/r5 east→west, r11 east→west. ÚNICA excepción: r12 — su sola marcha física
 * (north por wrap) da grupo degenerado y ejercita el guard-fallback (Q2, ver §FOSO arriba).
 *
 * ── TÁCTICA CETRO (doctrina lote-2/ch34, testigo-4) ────────────────────────────────────────────
 * El loadout Doom CONSERVA el Sceptre (despoja amulet+crown ⇒ endgameReady FALSE ⇒ f7 no dispara
 * el rescate, sonda ch27). Las salas cuyo .CBT contiene murallas ShadowlordBoundary 0x7X se miden
 * con `sceptreClear` (el Cetro las disuelve — combat.ts sceptreDissolveFields): r5 (cm117, 52
 * tiles 0x7X), r10 (cm122, 22), r13 (cm125, 8). El resto no tiene 0x7X (cetro no aplica).
 *
 * VEREDICTO ABIERTO por sala (VICTORY | DEADEND | DEADEND-STUCK — nunca FAIL/THROW); el sello =
 * digest byte-idéntico ×2 bajo reseed(0). Sin .gam (como ch27/ch29/ch34: el sello es el digest).
 */
import { test, expect, type Page } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, conquerRoom, dungeonKlimb, enterRoomThroughAmbush, setAmbushMode } from "./nav";

const PREV_CHAPTER = "ch17"; // umbral de Doom (Underworld, sello VERAMOCOR abierto, 3 SL muertos)
const DOOM = 40;
const MAGIC_BOW = 0x24;
const RING_INVIS = 0x2a;
const ARROWS = 0x1b;

type DFace = "north" | "south" | "east" | "west";
type Action = { do: "klimb-up" | "klimb-down" | "forward"; facing: DFace };
type RoomSpec = {
  label: string; cm: number;
  room: { f: number; x: number; y: number };
  tp: { f: number; x: number; y: number };
  actions: Action[];
  sceptreClear?: boolean;
  note: string;
};

// Orden por roomNo. `tp` = celda-semilla (teleport); `actions` = mecanismo fiel de entrada.
const ROOMS: RoomSpec[] = [
  { label: "r1", cm: 113, room: { f: 3, x: 3, y: 3 }, tp: { f: 4, x: 2, y: 3 },
    actions: [{ do: "klimb-up", facing: "north" }, { do: "forward", facing: "east" }],
    note: "bolsillo f3: klimb-UP f4(2,3)→approach f3(2,3)=Ld, paso este" },
  { label: "r2", cm: 114, room: { f: 1, x: 1, y: 1 }, tp: { f: 2, x: 1, y: 1 },
    actions: [{ do: "klimb-up", facing: "north" }],
    note: "MURADA no-lit: klimb-UP f2(1,1)=Lu aterriza sobre la sala" },
  { label: "r5", cm: 117, room: { f: 4, x: 3, y: 3 }, tp: { f: 4, x: 2, y: 3 },
    actions: [{ do: "forward", facing: "east" }], sceptreClear: true,
    note: "bolsillo f4: approach (2,3)=Lu, paso este; cm117 lleva 52 tiles 0x7X → cetro" },
  { label: "r6", cm: 118, room: { f: 2, x: 5, y: 5 }, tp: { f: 1, x: 5, y: 5 },
    actions: [{ do: "klimb-down", facing: "south" }],
    note: "MURADA no-lit: klimb-DOWN f1(5,5)=LB; facing south (grupo north = único real)" },
  { label: "r9", cm: 121, room: { f: 6, x: 5, y: 3 }, tp: { f: 7, x: 5, y: 3 },
    actions: [{ do: "klimb-up", facing: "north" }],
    note: "klimb-UP f7(5,3)=Lu (pocket del fondo); facing north (grupo south real)" },
  { label: "r10", cm: 122, room: { f: 6, x: 1, y: 3 }, tp: { f: 7, x: 1, y: 3 },
    actions: [{ do: "klimb-up", facing: "north" }], sceptreClear: true,
    note: "MURADA: klimb-UP f7(1,3)=Lu; facing north (grupo south = único real); 22 tiles 0x7X → cetro" },
  { label: "r11", cm: 123, room: { f: 7, x: 7, y: 3 }, tp: { f: 7, x: 6, y: 3 },
    actions: [{ do: "forward", facing: "east" }],
    note: "bolsillo f7 {(5,3),(6,3),r11}: paso este desde (6,3)" },
  { label: "r12", cm: 124, room: { f: 7, x: 1, y: 7 }, tp: { f: 6, x: 1, y: 0 },
    actions: [{ do: "forward", facing: "north" }],
    note: "FOSO f6(1,7) vía WRAP y=0→7: paso norte desde f6(1,0) pisa el PitFall → cae sobre r12 (guard Q2)" },
  { label: "r13", cm: 125, room: { f: 6, x: 3, y: 7 }, tp: { f: 7, x: 3, y: 7 },
    actions: [{ do: "klimb-up", facing: "north" }], sceptreClear: true,
    note: "klimb-UP f7(3,7)=Lu; facing north (grupo south real); 8 tiles 0x7X → cetro; tile-201 interior" },
  { label: "r15", cm: 127, room: { f: 7, x: 5, y: 7 }, tp: { f: 6, x: 4, y: 7 },
    actions: [{ do: "forward", facing: "east" }],
    note: "MURADA fondo: FOSO f6(5,7) PitFall — paso este desde (4,7) cae sobre la sala" },
];

/** Loadout Doom (#47, idéntico a ch34): ranged + invis + luz + CETRO; amulet+crown despojados
 *  ⇒ endgameReady FALSE ⇒ pisar f7 NO dispara el rescate (sonda ch27). Sin Des Por (inerte en Doom). */
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
      // CETRO en la tabla (U)se; amulet+crown fuera → endgameReady FALSE (f7 no rescata).
      st.lbArtifacts = { amulet: false, crown: false, sceptre: true };
    },
    [MAGIC_BOW, RING_INVIS, ARROWS] as const,
  );
}

const setFacing = (page: Page, facing: DFace): Promise<void> =>
  page.evaluate((f) => {
    (window as unknown as { __u5test: { game: { dungeonState: { pos: { facing: string } } } } }).__u5test.game.dungeonState.pos.facing = f;
  }, facing);

const stepForward = (page: Page): Promise<void> =>
  page.evaluate(() => {
    (window as unknown as { __u5test: { game: { dungeonCommand: (c: string) => unknown } } }).__u5test.game.dungeonCommand("forward");
  });

/** Entrada FRESCA a UNA sala: boot + ch17 + reseed(0) + loadout + tp semilla + mecanismo. */
async function conquerFresh(page: Page, r: RoomSpec): Promise<string> {
  await bootWorld(page);
  setAmbushMode("territory"); // OPT-IN: doom-cola sella con detección por territorio + enterRoomThroughAmbush (r6/r9)
  await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (s: number) => void } }).__u5test.reseed(0));
  await seedLoadout(page);
  try {
    // Entrada FRESCA TOLERANTE a emboscada de pasillo (errante 3D): re-teleport a la semilla +
    // acciones (klimb/forward); si el errante ambusca la transición de entrada, se gana y se
    // RE-PISA la sala (el paso-fresco re-dispara dng_enter_room). Presupuesto acotado (r6/r9).
    const doEntry = async () => {
      await page.evaluate(
        ({ id, f, x, y }) => (window as unknown as { __u5debug: { teleportDungeon: (d: number, f: number, x: number, y: number) => void } }).__u5debug.teleportDungeon(id, f, x, y),
        { id: DOOM, f: r.tp.f, x: r.tp.x, y: r.tp.y },
      );
      for (const a of r.actions) {
        await setFacing(page, a.facing);
        if (a.do === "forward") await stepForward(page);
        else await dungeonKlimb(page, a.do === "klimb-up" ? "up" : "down");
      }
    };
    if (!(await enterRoomThroughAmbush(page, doEntry))) {
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
    const v = await conquerRoom(page, { maxRounds: 600, sceptreClear: r.sceptreClear });
    // La sonda del endgame no debe disparar (amulet+crown despojados).
    const won = await page.evaluate(() => (window as unknown as { __u5test: { game: { state: { questFlags: Record<string, boolean> } } } }).__u5test.game.state.questFlags["game-won"] === true);
    return won ? `LEAK:game-won-tras-${v.outcome}` : v.digest;
  } catch (e) {
    return `THROW:${(e as Error).message.slice(0, 48)}`;
  }
}

// Filtro de DEPURACIÓN (`U5_CH37_ONLY=r12,r15`): itera una sala suelta sin pagar la pasada
// entera. SIN la env corre la cola completa (modo sello; el digest de sello es el de las 10).
const ONLY = process.env.U5_CH37_ONLY?.split(",").map((s) => s.trim()).filter(Boolean);
const ACTIVE = ONLY?.length ? ROOMS.filter((r) => ONLY.includes(r.label)) : ROOMS;

async function runPass(page: Page): Promise<{ digest: string; outcomes: Record<string, string> }> {
  const outcomes: Record<string, string> = {};
  for (const r of ACTIVE) outcomes[r.label] = await conquerFresh(page, r);
  const digest = ACTIVE.map((r) => `${r.label}:${outcomes[r.label]}`).join("|");
  return { digest, outcomes };
}

/**
 * ★★ EXPECTATIVAS **POR SALA** — sustituyen a la lista plana `OK` (ruling del lead, 2026-08-01).
 *
 * POR QUÉ CAMBIA. La lista plana `["VICTORY","DEADEND","DEADEND-STUCK"]` dejaba fuera
 * `VICTORY-STUCK`, y ése es **el veredicto FIEL** de una sala que la party gana y de la que no
 * puede salir. El capítulo ataca las DOS únicas salas del juego sin ninguna de las tres puertas
 * —`cm118` y `cm127`, censadas en `game/tests/salas-censo-tres-puertas.test.ts`— así que estaba
 * pidiendo un resultado que el original no puede dar. Lo destapó la pasada-vídeo completa del
 * 2026-08-01: el capítulo NO estaba en ninguna lista de invariancia y llevaba rojo sin que
 * ninguna pasada parcial lo tocara.
 *
 * ★ LA PRECISIÓN QUE EL CENSO **NO** DA, y por la que estas expectativas son por sala:
 * **ser un bolsillo fiel predice el STUCK, no la mitad VICTORY/DEADEND.** Esa mitad la decide el
 * COMBATE. Por eso `cm118` (la party gana y queda encerrada) espera `VICTORY-STUCK`; `cm127`
 * esperaba `DEADEND-STUCK` hasta #179 FASE 3 y hoy espera `VICTORY-STUCK` (victoria-de-entrada
 * fiel con bando enemigo VACÍO — cm127 siembra CERO enemigos; ver el pin de r15 abajo).
 *
 * ⚠ NO se acepta «en blanco» ninguna sala CON salida censada: eso taparía regresiones reales.
 * Cada entrada lleva su cita, y el único bucket con dos valores es el POSICIONAL (`r12`).
 *
 * PROCEDENCIA DE LOS PINES: medidos sobre `ceabb579` en la pasada-vídeo y re-medidos en una
 * corrida SIN vídeo con digest byte-idéntico; y contrastados con un A/B de UNA SOLA VARIABLE
 * (los dos ficheros del fix del Grate en su versión pre-`0x86`). El A/B mueve **exactamente una
 * sala**: `r13`. EXCEPCIÓN POSTERIOR: `r15` fue RE-PINADA tras #179 FASE 3 (`ccac9d2a`, 19-08)
 * — bisect `re/notes/grandtour-salas-bisect.md` §2, frontera `40249239`→`ccac9d2a` con digest
 * byte-idéntico en las otras NUEVE salas y sólo r15 moviéndose. El pin de julio fotografió la
 * conducta INFIEL pre-#179; la cita del pin nuevo es el BINARIO (COMBAT 0x0bb2-0x0bc0).
 *
 * ⚠ GRANULARIDAD DEL A/B (auditoría final, 01-08): «una sola variable» es UN COMMIT, no UN
 * TILE. El brazo revierte los dos ficheros ENTEROS, y con ellos vuelven a la vez el `0x86` y
 * el cableado último-recurso. Por eso el A/B NO puede adjudicar cuál de los dos rescató a
 * `r13`, y la cita de `r13` decía «el Grate» sin poder decirlo: cm125 no tiene ningún 0x86.
 * Lo adjudica el CENSO DE TILES, no el A/B — ver la cita corregida abajo.
 */
const EXPECTED: Record<string, { outcomes: string[]; why: string }> = {
  r1: { outcomes: ["VICTORY"], why: "sala con salida; medida VICTORY en los dos brazos del A/B" },
  r2: { outcomes: ["DEADEND-STUCK"], why: "6 enemigos vivos al agotar rondas; idéntica en los dos brazos" },
  r5: { outcomes: ["DEADEND"], why: "10 enemigos vivos, sale por su borde; idéntica en los dos brazos" },
  r6: {
    outcomes: ["VICTORY-STUCK"],
    why: "BOLSILLO FIEL cm118 — censo de cuatro vías: 0 borde pasable, 0 escalera 0xC8/0xC9, "
      + "0 Grate 0x86, 0 barrera. La party GANA y no hay puerta por la que salir: VICTORY-STUCK "
      + "es el veredicto fiel, no un defecto",
  },
  r9: { outcomes: ["VICTORY"], why: "sala con salida; idéntica en los dos brazos" },
  r10: { outcomes: ["DEADEND-STUCK"], why: "10 enemigos vivos; idéntica en los dos brazos" },
  r11: { outcomes: ["DEADEND"], why: "8 enemigos vivos, sale por su borde; idéntica en los dos brazos" },
  r12: {
    outcomes: ["VICTORY", "VICTORY-STUCK"],
    why: "BOLSILLO POSICIONAL cm124 — SÍ tiene borde pasable (3 celdas), así que el atasco NO es "
      + "estructural: depende de dónde quede la party y NO se censa offline (condición suficiente, "
      + "no necesaria). Único bucket con dos valores, y sólo por eso",
  },
  r13: {
    outcomes: ["VICTORY"],
    why: "cm125 tiene 0xC9 en (3,5) y la RESCATA el CABLEADO ÚLTIMO-RECURSO de #11 "
      + "(`nav.ts lastResortExitStep`) — NO el Grate, pese a lo que decía esta cita hasta la "
      + "auditoría final (01-08). cm125 no tiene NINGÚN 0x86: los 5 mapas con Grate son "
      + "cm32/33/102/114/122 (censo en el propio `lastResortExitStep`), verificado contando "
      + "tiles sobre combatmaps.json. Lo que le faltaba a esta sala no era el tile: era que el "
      + "conductor sólo sabía salir por el BORDE, y al añadir KLIMB como última puerta su 0xC9 "
      + "pasó a ser salida. Es la ÚNICA sala que mueve el A/B: VICTORY-STUCK sin el cableado, "
      + "VICTORY con él. Pinada para que el rescate no se pueda perder en silencio",
  },
  r15: {
    outcomes: ["VICTORY-STUCK"],
    why: "BOLSILLO FIEL cm127 — mismo censo de cuatro vías que cm118 (0/0/0/0). cm127 siembra "
      + "CERO enemigos (sólo el alma decorado 0x3c en (5,1), dato en crudo en "
      + "absorcion-desenlace.test.ts): la conducta FIEL es victoria-de-entrada — el flag de "
      + "victoria nace latcheado con bando enemigo vacío, calco de COMBAT:0x0b94 @0x0bb2-0x0bc0 "
      + "(el print 0x0cf6 exige flag==0), cableado en #179 FASE 3 (ccac9d2a, acta "
      + "re/notes/absorcion-179-acta.md). El clasificador (victory && enemiesAlive===0, sin "
      + "salida 0/0/0/0) mide VICTORY-STUCK. RE-PIN adjudicado por el bisect "
      + "re/notes/grandtour-salas-bisect.md §2: el pin anterior (DEADEND-STUCK, ×3 en julio) "
      + "fotografió la conducta INFIEL pre-#179 (latch sólo en maybeAnnounceVictory, camino del "
      + "turno que aquí nunca corría). El censo predice el STUCK; el binario decide la otra mitad",
  },
};

test.describe.serial("FASE 2b — ch37 cola de Doom (10 salas, entrada fresca por semilla, veredicto ABIERTO)", () => {
  test("las 10 salas de la cola dan su veredicto ESPERADO POR SALA (pin con cita; nunca FAIL/THROW)", async ({ page }) => {
    test.setTimeout(chapterTimeout(1_800_000));

    // ── Guarda de POBLACIÓN, en los DOS SENTIDOS. ANTES de la pasada a propósito: es
    // estática (sólo mira ROOMS/EXPECTED), así que una sala perdida se reporta en
    // segundos en vez de tras media hora de combates, y su mutante se puede validar
    // sin pagar la pasada.
    // (a) EXPECTED ⊇ ACTIVE: una sala que corre sin pin no se cuela.
    for (const r of ACTIVE) {
      expect(Object.keys(EXPECTED), `sala ${r.label} (#${r.cm}) sin expectativa declarada`).toContain(r.label);
    }
    // (b) ROOMS ⊇ EXPECTED, y la CARDINALIDAD. Sin esto la guarda era UNIDIRECCIONAL
    // (auditoría final, 01-08): borrar una sala de ROOMS la sacaba también de ACTIVE, el
    // bucle (a) iteraba una menos y el test pasaba en VERDE sobre las nueve restantes —
    // exactamente el verde vacío que esta guarda existe para impedir.
    // Va contra ROOMS y no contra ACTIVE, y GATEADO con !ONLY: en modo depuración
    // (`U5_CH37_ONLY=r12`) ACTIVE es una sala a propósito y eso no es una regresión.
    if (!ONLY?.length) {
      expect(ROOMS.length, "cardinalidad de la cola de Doom: son 10 salas").toBe(10);
      const etiquetas = ROOMS.map((r) => r.label);
      for (const label of Object.keys(EXPECTED)) {
        expect(
          etiquetas,
          `la sala ${label} tiene expectativa pinada pero YA NO ESTÁ en ROOMS: o se retiró del ` +
            "capítulo (entonces retira también su pin, con acta) o se renombró — y en los dos " +
            "casos el pin dejó de medir nada",
        ).toContain(label);
      }
    }

    const t0 = Date.now();
    const { digest, outcomes } = await runPass(page);
    const secs = Math.round((Date.now() - t0) / 1000);
    const tally = Object.values(outcomes).reduce<Record<string, number>>((a, o) => {
      const k = o.split(":")[0]!;
      a[k] = (a[k] ?? 0) + 1; return a;
    }, {});
    console.log(`[ch37-doom-cola] ${secs}s outcomes=${JSON.stringify(tally)}`);
    console.log(`[ch37-doom-cola] digest=${digest}`);
    for (const r of ACTIVE) {
      const head = (outcomes[r.label] ?? "").split(":")[0]!;
      const exp = EXPECTED[r.label]!;
      expect(
        exp.outcomes,
        `sala ${r.label} (#${r.cm}) — ${exp.why} · MEDIDO: ${outcomes[r.label]}`,
      ).toContain(head);
    }
  });

  test("determinismo ×2: dos pasadas frescas dan el MISMO digest", async ({ page }) => {
    test.setTimeout(chapterTimeout(3_600_000));
    const a = await runPass(page);
    const b = await runPass(page);
    expect(b.digest, "digest de veredictos byte-idéntico bajo reseed(0)").toBe(a.digest);
  });
});
