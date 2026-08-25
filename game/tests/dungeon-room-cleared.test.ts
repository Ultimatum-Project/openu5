/**
 * SUPUESTO #13 (main 1b964320) — semántica POSICIONAL del marcado de sala despejada.
 *
 * dng_enter_room (DUNGEON.OVL 0x0000) guarda la posición de la party AL ENTRAR (0x0084) y,
 * tras la VICTORIA (gate 0x00c7 `or ax,ax; jne` = SÓLO victoria, sin `cmp g_party,celda`),
 * marca el bit del roomNo (0x00de) + degrada la celda de ENTRADA (0x00f5 `&0xAF`). El defecto
 * del port era marcar por la posición FINAL de la party (`markCurrentRoomCleared` leía
 * `this.pos` al CERRAR el combate): si la party no terminaba sobre la celda-sala (paso de
 * entrada detenido en la celda de aproximación, o una cadena que la movió), la victoria NO
 * marcaba — medido 2/7 en la cadena de Hythloth.
 *
 * El fix: `markRoomClearedAt(state, f, x, y)` marca por una celda EXPLÍCITA (la de ENTRADA,
 * capturada al disparar el combate en game.ts). Estos tests reproducen el caso medido a nivel
 * de DungeonState: victoria con la party fuera de la celda-sala → sólo el marcado por celda de
 * ENTRADA pone el bit + degrada; el marcado por posición final NO.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  DungeonState,
  CellType,
  dungeonRoomCleared,
  type DungeonCell,
  type DungeonData,
  type DungeonPos,
} from "../src/core/dungeon/dungeon.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { buildEnemyDefs, type EnemyDef, type AdditionalEnemyFlag, type EnemyDataInput } from "../src/core/combat/enemies.js";
import { Combat, type CombatMapData, type CombatEvent, type PartyCombatant } from "../src/core/combat/combat.js";

const HYTHLOTH = 0x27;
const N = 8;
const ROOM_NO = 5;

/** Rejilla 8×8×8 toda Nothing (0x0), con celdas puntuales sobreescritas. */
function makeDungeon(cells: Array<{ f: number; x: number; y: number; type: number; sub: number }>): DungeonData {
  const floors: DungeonCell[][][] = Array.from({ length: N }, () =>
    Array.from({ length: N }, () =>
      Array.from({ length: N }, (): DungeonCell => ({ type: CellType.Nothing, sub: 0 })),
    ),
  );
  for (const c of cells) floors[c.f]![c.y]![c.x] = { type: c.type, sub: c.sub };
  return { location: HYTHLOTH, name: "Hythloth", floors };
}

/** GameState mínimo: dungeonMarkRoomCleared/dungeonRoomCleared sólo tocan dungeonRoomsCleared. */
function emptyState(): GameState {
  return { dungeonRoomsCleared: undefined } as unknown as GameState;
}

function posAt(f: number, x: number, y: number): DungeonPos {
  return { dungeon: HYTHLOTH, floor: f, x, y, facing: "north" };
}

describe("SUPUESTO #13 — marcado de sala por celda de ENTRADA, no posición final", () => {
  // Sala roomNo=5 en (f3, 5,5); celda de aproximación (pasadizo) en (f3, 4,5).
  const roomCell = { f: 3, x: 5, y: 5 };
  const approachCell = { f: 3, x: 4, y: 5 };
  const build = () =>
    makeDungeon([
      { ...roomCell, type: CellType.Room, sub: ROOM_NO },
      { ...approachCell, type: CellType.Nothing, sub: 0 },
    ]);

  it("DEFECTO: victoria con la party en la celda de APROXIMACIÓN → markCurrentRoomCleared NO marca", () => {
    const ds = new DungeonState([build()], posAt(approachCell.f, approachCell.x, approachCell.y));
    const state = emptyState();
    // El port viejo marcaba por this.pos (la celda de aproximación, un pasadizo Nothing):
    ds.markCurrentRoomCleared(state);
    expect(dungeonRoomCleared(state, HYTHLOTH, ROOM_NO)).toBe(false); // sala NO marcada (el bug)
    expect(ds.cellAt(roomCell.f, roomCell.x, roomCell.y).type).toBe(CellType.Room); // celda intacta 0xF
  });

  it("FIX: marcar por la celda de ENTRADA pone el bit + degrada la celda-sala (0xF→0xA)", () => {
    const ds = new DungeonState([build()], posAt(approachCell.f, approachCell.x, approachCell.y));
    const state = emptyState();
    // Aunque la party quedó en la celda de aproximación, se marca la de ENTRADA capturada:
    ds.markRoomClearedAt(state, roomCell.f, roomCell.x, roomCell.y);
    expect(dungeonRoomCleared(state, HYTHLOTH, ROOM_NO)).toBe(true); // bit puesto
    expect(ds.cellAt(roomCell.f, roomCell.x, roomCell.y).type).toBe(CellType.RoomsBroke); // 0xA degradada
  });

  it("no-drift: si la party SÍ termina sobre la celda-sala, markCurrentRoomCleared sigue marcando (sin regresión)", () => {
    const ds = new DungeonState([build()], posAt(roomCell.f, roomCell.x, roomCell.y));
    const state = emptyState();
    ds.markCurrentRoomCleared(state);
    expect(dungeonRoomCleared(state, HYTHLOTH, ROOM_NO)).toBe(true);
    expect(ds.cellAt(roomCell.f, roomCell.x, roomCell.y).type).toBe(CellType.RoomsBroke);
  });

  it("PRÓXIMA CARGA: sala multi-celda — el bit degrada TODAS las celdas del roomNo (applyClearedRooms)", () => {
    // roomNo=5 ocupa DOS celdas: (5,5) [entrada] y (6,5). Ganar por la de entrada marca el bit
    // y degrada sólo (5,5); en la próxima carga applyClearedRooms degrada la otra por el bit.
    const cellA = { f: 3, x: 5, y: 5 };
    const cellB = { f: 3, x: 6, y: 5 };
    const dungeon = makeDungeon([
      { ...cellA, type: CellType.Room, sub: ROOM_NO },
      { ...cellB, type: CellType.Room, sub: ROOM_NO },
    ]);
    const state = emptyState();
    const ds = new DungeonState([dungeon], posAt(approachCell.f, approachCell.x, approachCell.y));
    ds.markRoomClearedAt(state, cellA.f, cellA.x, cellA.y);
    expect(ds.cellAt(cellB.f, cellB.x, cellB.y).type).toBe(CellType.Room); // aún 0xF en esta carga

    // Próxima carga: nuevo DungeonState desde los MISMOS datos + el bit persistente.
    const reload = new DungeonState([dungeon], posAt(0, 0, 0));
    reload.applyClearedRooms(state);
    expect(reload.cellAt(cellB.f, cellB.x, cellB.y).type).toBe(CellType.RoomsBroke); // degradada por el bit
    expect(reload.cellAt(cellA.f, cellA.x, cellA.y).type).toBe(CellType.RoomsBroke);
  });
});

// ── SUPUESTO #13 AMPLIADO (VENTANA-#13): la victoria de sala marca EN EL LATCH, no en endCombat ──
// El defecto REAL medido: `endCombat` (marca al SALIR de la arena) no lo alcanzaban las victorias por
// WALK-IN (2/7 en la cadena de Hythloth; los 2 que marcaban eran ATERRIZAJES). El fix mueve la marca al
// LATCH de victoria (onVictoryLatch, g_cmb_victory 0x58A3), reproduciendo el gate 0x00c7 del binario.
function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const enemyData = loadJson<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const addlFlags = loadJson<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = loadJson<CombatMapData[]>("../assets/maps/combatmaps.json");
function freshGame(): GameState {
  return createNewGame(loadJson<ExtractedInitialState>("../assets/initial-state.json"));
}
function spiderDef(): EnemyDef {
  const d = buildEnemyDefs(enemyData, addlFlags).find((e) => e.name === "Giant Spider");
  if (!d) throw new Error("Giant Spider no encontrado");
  return d;
}
function partyOf(state: GameState): PartyCombatant[] {
  return state.characters.filter((c) => c.partyStatus === 0).map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));
}
function fightToVictory(combat: Combat): void {
  let ticks = 0;
  while (!combat.victory && ticks++ < 300) {
    const cur = combat.currentUnit;
    if (!cur) break;
    let ev: CombatEvent[];
    if (cur.kind === "enemy" || cur.charmed) ev = combat.tickEnemyTurns();
    else {
      const foe = combat.combatants.find((c) => c.kind === "enemy" && c.status === "active");
      const dist = foe ? Math.max(Math.abs(cur.x - foe.x), Math.abs(cur.y - foe.y)) : Infinity;
      ev = foe && dist <= 1 ? combat.playerAttack(foe.x, foe.y) : combat.playerPass();
    }
    void ev;
  }
}
function makeRoomCombat(state: GameState, onVictoryLatch: () => void): Combat {
  return new Combat({
    map: combatMaps[0]!, entryDirection: "east", party: partyOf(state),
    enemies: [{ def: spiderDef(), count: 1 }], seed: 12345, state,
    defenseValues: enemyData.defenseValues, roomCombat: true, onVictoryLatch,
  });
}

describe("SUPUESTO #13 ampliado — victoria de sala (WALK-IN) marca en el LATCH, no al salir", () => {
  const roomCell = { f: 3, x: 5, y: 5 };

  it("WALK-IN: la victoria dispara onVictoryLatch → bit+degrade con la party AÚN en la arena (over=false)", () => {
    const ds = new DungeonState(
      [makeDungeon([{ ...roomCell, type: CellType.Room, sub: ROOM_NO }])],
      posAt(roomCell.f, roomCell.x, roomCell.y), // walk-in: la party acabó SOBRE la celda-sala
    );
    const state = freshGame();
    // Cableado idéntico a startDungeonRoomCombat: marca la celda de ENTRADA (aquí = la celda-sala).
    const combat = makeRoomCombat(state, () => ds.markRoomClearedAt(state, roomCell.f, roomCell.x, roomCell.y));
    expect(dungeonRoomCleared(state, HYTHLOTH, ROOM_NO)).toBe(false); // antes de vencer: sin marcar
    fightToVictory(combat);
    expect(combat.victory).toBe(true);
    expect(combat.over).toBe(false); // CLAVE: marcó EN LA VICTORIA, sin caminar al borde (lo que endCombat perdía)
    expect(dungeonRoomCleared(state, HYTHLOTH, ROOM_NO)).toBe(true); // bit puesto por el latch
    expect(ds.cellAt(roomCell.f, roomCell.x, roomCell.y).type).toBe(CellType.RoomsBroke); // 0xF→0xA
  });

  it("onVictoryLatch se dispara UNA sola vez (latch idempotente aunque el combate siga)", () => {
    let calls = 0;
    const combat = makeRoomCombat(freshGame(), () => { calls++; });
    fightToVictory(combat);
    for (let i = 0; i < 6; i++) { // sigue el turno tras la victoria (recoger botín): el latch no re-dispara
      const cur = combat.currentUnit;
      if (!cur) break;
      if (cur.kind === "player" && !cur.charmed) combat.playerPass();
      else combat.tickEnemyTurns();
    }
    expect(calls).toBe(1);
  });

  it("WALK-IN-THEN-EXIT (el caso medido): mata al último enemigo y SALE por el borde en la misma secuencia → latchea+marca igual", () => {
    // El bug: el latch estaba SOLO en advanceTurn con gate `anyActiveOnSide("party")`; si el golpe
    // mortal dejaba armas en cola (no avanza turno) y la party SALÍA del tablero antes del siguiente
    // advanceTurn, no quedaba party ACTIVA → nunca latcheaba (5/7 walk-in de Hythloth). El fix latchea
    // al kill (chequeo post-acción) con gate «party VIVA». Aquí: mata, luego TODO el party sale (Esc
    // rápido) — la victoria y la marca PERSISTEN porque latcheó al matar, no al salir.
    const ds = new DungeonState(
      [makeDungeon([{ ...roomCell, type: CellType.Room, sub: ROOM_NO }])],
      posAt(roomCell.f, roomCell.x, roomCell.y),
    );
    const state = freshGame();
    let latchCalls = 0;
    const combat = makeRoomCombat(state, () => { latchCalls++; ds.markRoomClearedAt(state, roomCell.f, roomCell.x, roomCell.y); });
    fightToVictory(combat); // el golpe mortal latchea la victoria (maybeLatchVictory en kill)
    expect(combat.victory).toBe(true);
    expect(latchCalls).toBe(1);
    // La party abandona el tablero ANDANDO por el borde, que es la ÚNICA salida de una
    // sala (COMBAT.OVL 0x0ca6-0x0cc7). El ESC rápido aquí NO sirve: en sala el gate 0x1822
    // va ANTES del de victoria y responde "-Not here!" sin retirar a nadie
    // (re/notes/esc-sala-derivacion.md §2). Se comprueba de paso, para que este test siga
    // fijando POR QUÉ hay que caminar:
    expect(combat.playerEscapeQuick()).toEqual([{ kind: "echo", text: "Escape-Not here!" }]);
    expect(combat.over).toBe(false); // el ESC no cerró nada
    let guard = 0;
    while (!combat.over && guard++ < 80) {
      const cur = combat.currentUnit;
      if (cur?.kind === "player" && !cur.charmed) combat.playerEscape("east");
      else combat.tickEnemyTurns();
    }
    expect(combat.over).toBe(true); // ya no hay party activa en tablero…
    expect(combat.victory).toBe(true); // …pero la victoria latcheó ANTES de salir (persiste)
    expect(latchCalls).toBe(1); // no re-dispara al salir
    expect(dungeonRoomCleared(state, HYTHLOTH, ROOM_NO)).toBe(true); // sala MARCADA
  });
});
