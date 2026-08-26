/**
 * #179 — LA ABSORCIÓN DEL DESENLACE (SJOG `absorb` 0x1ea4 + centinela 0x4d + fin por
 * tablero vacío). Derivación completa: re/notes/absorcion-179-acta.md.
 *
 * Esperados EN CRUDO (del binario / del fichero, no calculados desde el sujeto):
 *  · cm127 (DUNGEON.CBT offset 0x98A0 = Doom sala 15) siembra UNA unidad: sprite 0x3c
 *    en (5,1) — la única familia-0x3c de los 128 mapas — y CERO enemigos.
 *  · gate (0x1ebb-0x1eda): activo ∧ no caído ∧ fila==2 ∧ (pintado(col,1) & 0xfc)==0x3c.
 *  · efecto: «<nombre> is absorbed!» (DS 0x8f02) + registro barrido (COMBAT 0x1236,
 *    índice negado) + centinela g_unk_58a0=0x4d (0x1edc) — CERO rands.
 *  · el turno enemigo (COMBAT 0x03f4) NO llama al gancho: sólo el turno de miembro
 *    (0x0b8b, en la cola de 0x063e).
 *  · entrada con bando enemigo vacío: victory_flag latcheado SIN mensaje
 *    (COMBAT:0x0b94 @0x0bb2-0x0bc0; el print 0x0cf6 exige flag==0).
 *  · retorno 0 del bucle = AMBOS bandos a cero (0x0cb0-0x0cc7) → dng_enter_room mira
 *    el centinela (0x00cb) ANTES de restaurar nada → overlay 13 (endgame_main).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import {
  buildEnemyDefs,
  type EnemyDef,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../src/core/combat/enemies.js";
import {
  Combat,
  type CombatMapData,
  type CombatEvent,
  type PartyCombatant,
} from "../src/core/combat/combat.js";
import { Game, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import { describeConAssets } from "./assets-opcionales.js";
import { conDsStrings, DS_STRINGS } from "./ds-strings-fixture.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
type DataJson = EnemyDataInput & { defenseValues: number[]; spellAttackRange: number[] };
const data = load<DataJson>("../assets/data.json");
const additional = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const enemyDefs: EnemyDef[] = buildEnemyDefs(data, additional);
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

/** cm127 = posición GLOBAL 127 del array (16 britannia + 112 dungeon; Doom sala 15). */
const CM127 = 127;
/** El alma atrapada del .CBT: sprite crudo 0x3c en (5,1) — esperado EN CRUDO del fichero. */
const SOUL_BYTE = 0x3c;
const SOUL_X = 5;
const SOUL_Y = 1;

function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}
function party(state: GameState): PartyCombatant[] {
  const members = state.characters.filter((c) => c.partyStatus === 0);
  for (const c of members) {
    c.level = 8;
    c.maxHp = 240;
    c.currentHp = 240;
    c.status = "G";
  }
  return members.map((record) => ({
    charIdx: state.characters.indexOf(record),
    record,
    weapons: [{ attack: 40, range: 5 }],
  }));
}
function combatOn(map: CombatMapData, seed = 0, state = freshState()): Combat {
  return new Combat({
    map,
    entryDirection: "south",
    party: party(state),
    enemies: { fixedFromMap: true, defs: enemyDefs },
    seed,
    state,
    defenseValues: data.defenseValues,
    spellAttackRange: data.spellAttackRange,
    enemyDefs,
    roomCombat: true,
  });
}
const celda = (seed = 0, state = freshState()): Combat => combatOn(combatMaps[CM127]!, seed, state);

/** Mapa sintético: copia de cm127 con las unidades que se le pidan. */
function celdaCon(units: { sprite: number; x: number; y: number }[]): CombatMapData {
  return { ...combatMaps[CM127]!, units };
}

const textos = (evs: CombatEvent[]): string[] =>
  evs.filter((e) => e.kind === "message").map((e) => (e as { text: string }).text);

/** Coloca al combatiente del turno ACTUAL en (x,y) y lo mueve al norte. */
function moverDesde(c: Combat, x: number, y: number): CombatEvent[] {
  const cur = c.currentUnit;
  expect(cur, "debe haber un actor de turno").toBeTruthy();
  expect(cur!.kind, "sin enemigos, el turno es SIEMPRE de un miembro").toBe("player");
  cur!.x = x;
  cur!.y = y;
  return c.playerMove("north");
}

describe("cm127 — el dato de la celda de LB sobre el motor vivo", () => {
  it("siembra CERO enemigos y UN alma-decorado en (5,1) — la única familia 0x3c de los 128 mapas", () => {
    const c = celda();
    expect(c.combatants.filter((x) => x.kind === "enemy").length).toBe(0);
    const soul = c.lootTiles().find((l) => l.x === SOUL_X && l.y === SOUL_Y);
    expect(soul?.tile, "alma atrapada = byte crudo 0x3c del .CBT (look2[0x13c])").toBe(SOUL_BYTE);
    // Censo de seguridad del gate (acta §8): ninguna OTRA unidad familia-0x3c y ningún
    // tile de terreno 0x3c-0x3f en TODO el corpus — el gancho corre en todo combate
    // (como en 1988) y sólo puede casar aquí.
    const otras = combatMaps.flatMap((m, i) =>
      (m.units ?? []).filter((u) => (u.sprite & 0xfc) === 0x3c).map(() => i),
    );
    expect(otras).toEqual([CM127]);
    const terrenos = combatMaps.flatMap((m) =>
      m.tiles.flat().filter((t) => t >= 0x3c && t <= 0x3f),
    );
    expect(terrenos).toEqual([]);
  });

  it("victoria LATCHEADA a la entrada, SIN mensaje VICTORY! (0x0bb2-0x0bc0: el print 0x0cf6 exige flag==0)", () => {
    const c = celda();
    expect(c.victory, "flag nace a 1 con el bando enemigo vacío").toBe(true);
    const evs = c.playerPass();
    expect(textos(evs).some((t) => t.includes("VICTORY"))).toBe(false);
  });
});

describe("el gate de absorb (0x1ebb-0x1eda) — los términos de posición, uno a uno", () => {
  it("pisar (5,2) con el alma al norte ABSORBE al que pisa: mensaje + fuera del tablero + centinela", () => {
    const c = celda();
    const cur = c.currentUnit!;
    const evs = moverDesde(c, 5, 3); // → (5,2)
    expect(textos(evs).some((t) => t.includes("is absorbed!"))).toBe(true);
    expect(cur.status).toBe("absorbed");
    expect(c.absorptionSentinel, "g_unk_58a0 = 0x4d (0x1edc)").toBe(true);
    // El registro queda BARRIDO para el recuento: el absorbido no vuelve a tener turno.
    for (let i = 0; i < 20; i++) {
      const u = c.currentUnit;
      if (!u) break;
      expect(u.id).not.toBe(cur.id);
      c.playerPass();
    }
  });

  it("fila 2 SIN alma en la columna (4,2) NO absorbe — el término de columna es real", () => {
    const c = celda();
    const cur = c.currentUnit!;
    const evs = moverDesde(c, 4, 3); // → (4,2): fila 2, columna sin alma
    expect(textos(evs).some((t) => t.includes("is absorbed!"))).toBe(false);
    expect(cur.status).toBe("active");
    expect(c.absorptionSentinel).toBe(false);
  });

  it("columna del alma pero fila ≠ 2 (5,3) NO absorbe — el término de fila es real", () => {
    const c = celda();
    const cur = c.currentUnit!;
    const evs = moverDesde(c, 5, 4); // → (5,3)
    expect(textos(evs).some((t) => t.includes("is absorbed!"))).toBe(false);
    expect(cur.status).toBe("active");
  });

  it("el alma CUBIERTA por un actor apaga el gate — la lectura es de lo PINTADO (vis-window), no del dato", () => {
    // Enemigo inmóvil sembrado ENCIMA del alma (5,1): la vis-window pinta al actor
    // (|0x100, byte = tile del enemigo), el 0x3c deja de estar a la vista.
    // 0x88 = (0x88-0x40)/4 = enemigo 18; lo que importa es que su byte bajo no sea 0x3c.
    const c = combatOn(celdaCon([
      { sprite: SOUL_BYTE, x: SOUL_X, y: SOUL_Y },
      { sprite: 0x88, x: SOUL_X, y: SOUL_Y },
    ]));
    const cur = c.currentUnit;
    if (cur?.kind !== "player") return; // el turno inicial debe ser de un miembro para conducir
    cur.x = 5;
    cur.y = 3;
    const evs = c.playerMove("north");
    expect(textos(evs).some((t) => t.includes("is absorbed!"))).toBe(false);
    expect(c.absorptionSentinel).toBe(false);
  });

  it("el turno ENEMIGO no evalúa el gancho: un enemigo sobre (5,2) con alma al norte NO se absorbe", () => {
    // El call-site es la cola del turno de MIEMBRO (0x0b8b en 0x063e); 0x03f4 no llama.
    const c = combatOn(celdaCon([
      { sprite: SOUL_BYTE, x: SOUL_X, y: SOUL_Y },
      { sprite: 0x88, x: 5, y: 2 }, // enemigo YA en la celda absorbente
    ]));
    // Drena turnos enemigos y pasa turnos de miembro unas rondas.
    for (let i = 0; i < 12; i++) {
      c.tickEnemyTurns();
      if (c.currentUnit?.kind === "player") c.playerPass();
    }
    const enemigo = c.combatants.find((x) => x.kind === "enemy");
    expect(enemigo?.status).not.toBe("absorbed");
    expect(c.absorptionSentinel).toBe(false);
  });
});

describeConAssets([DS_STRINGS], "fin por tablero vacío (0x0cb0-0x0cc7) + desvío del teardown (DUNGEON 0x00cb)", () => {
  conDsStrings();
  it("absorber a TODOS los miembros vacía el tablero y cierra el combate — sin BATTLE IS LOST", () => {
    const c = celda();
    let guard = 0;
    const todos: string[] = [];
    while (!c.over && guard++ < 100) {
      const cur = c.currentUnit;
      if (!cur) break;
      todos.push(...textos(moverDesde(c, 5, 3)));
    }
    expect(c.over, "y==0 ∧ x==0 ⇒ retorno 0 del bucle").toBe(true);
    expect(c.absorptionSentinel).toBe(true);
    expect(c.victory, "el latch de entrada PERSISTE").toBe(true);
    const absorbidos = c.combatants.filter((x) => x.status === "absorbed").length;
    expect(absorbidos).toBe(c.combatants.length);
    expect(todos.filter((t) => t.includes("is absorbed!")).length).toBe(absorbidos);
  });

  it("endCombat con el centinela DESVÍA al endgame: game-won + endgame, sin sync de roster y sin BATTLE IS LOST", () => {
    // Game mínimo (patrón refuge-live): el desvío no necesita mundo real.
    const state = freshState();
    state.specialItems.woodenBox = true;
    const c = celda(0, state);
    // Tras montar el combate (el helper normaliza el roster): lo que se afirma es que
    // el DESVÍO no lo toca — el teardown del binario nunca corre (endgame_main no retorna).
    const hpAntes = state.characters
      .filter((ch) => ch.partyStatus === 0)
      .map((ch) => ch.currentHp);
    let guard = 0;
    while (!c.over && guard++ < 100) {
      if (!c.currentUnit) break;
      moverDesde(c, 5, 3);
    }
    expect(c.absorptionSentinel).toBe(true);

    const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
    const world: WorldData = { overworld, underworld: overworld, smallMaps: new Map() };
    const gameData: GameData = {
      locationsX: Array.from({ length: 32 }, () => 100),
      locationsY: Array.from({ length: 32 }, () => 100),
      locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
    };
    const g = new Game({} as ExtractedInitialState, world, gameData, state);
    g.combat = c;
    const events = g.endCombat();
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain("combat-ended");
    expect(kinds).toContain("game-won");
    expect(kinds).toContain("endgame");
    expect(state.questFlags["game-won"]).toBe(true);
    const won = events.find((e) => e.kind === "game-won") as { ending?: string };
    expect(won.ending, "con la Sandalwood Box ⇒ victoria (fork ENDGAME_main 0x08c2)").toBe("victory");
    // El teardown del binario NO restaura nada (endgame_main no retorna): el roster
    // conserva su HP — los absorbidos están INTACTOS para la cutscene.
    const hpDespues = state.characters
      .filter((ch) => ch.partyStatus === 0)
      .map((ch) => ch.currentHp);
    expect(hpDespues).toEqual(hpAntes);
    const msgs = events
      .filter((e) => e.kind === "message")
      .map((e) => (e as { text: string }).text);
    expect(msgs.some((t) => t.includes("BATTLE IS LOST"))).toBe(false);
  });

  it("SIN caja el mismo desvío da el final varado (stranded) — el fork es la caja, no la vía", () => {
    const state = freshState();
    state.specialItems.woodenBox = false;
    const c = celda(0, state);
    let guard = 0;
    while (!c.over && guard++ < 100) {
      if (!c.currentUnit) break;
      moverDesde(c, 5, 3);
    }
    const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
    const world: WorldData = { overworld, underworld: overworld, smallMaps: new Map() };
    const gameData: GameData = {
      locationsX: Array.from({ length: 32 }, () => 100),
      locationsY: Array.from({ length: 32 }, () => 100),
      locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
    };
    const g = new Game({} as ExtractedInitialState, world, gameData, state);
    g.combat = c;
    const events = g.endCombat();
    const won = events.find((e) => e.kind === "game-won") as { ending?: string };
    expect(won?.ending).toBe("stranded");
  });

  it("checkDoomRescue YA NO dispara por planta: sólo marca in-doom (la regla floor==7 era sintética)", () => {
    // Sin dungeonState no hay marca ni eventos; y NUNCA emite game-won por sí solo.
    const state = freshState();
    const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
    const world: WorldData = { overworld, underworld: overworld, smallMaps: new Map() };
    const gameData: GameData = {
      locationsX: Array.from({ length: 32 }, () => 100),
      locationsY: Array.from({ length: 32 }, () => 100),
      locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
    };
    const g = new Game({} as ExtractedInitialState, world, gameData, state);
    expect(g.checkDoomRescue()).toEqual([]);
    expect(state.questFlags["game-won"]).toBeUndefined();
  });
});

describe("RNG — la absorción no consume tiradas (acta §5)", () => {
  it("el paseo hasta la absorción deja la semilla EXACTAMENTE donde la dejaría el mismo paseo sin alma", () => {
    // Mismo mapa CON y SIN alma; misma secuencia de movimientos que termina en (5,2).
    // La única diferencia de eventos es la absorción — y la semilla debe ser IDÉNTICA:
    // cero rands en gate y efecto (0x1ea4-0x1f25 no llama a rand_range).
    const con = combatOn(celdaCon([{ sprite: SOUL_BYTE, x: SOUL_X, y: SOUL_Y }]));
    const sin = combatOn(celdaCon([]));
    moverDesde(con, 5, 3);
    moverDesde(sin, 5, 3);
    expect(con.rngSeed).toBe(sin.rngSeed);
  });
});
