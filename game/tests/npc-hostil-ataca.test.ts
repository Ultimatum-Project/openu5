/**
 * El ATAQUE del NPC HOSTIL de pueblo — la rama 'a' COMPLETA de npc_engine
 * (TOWN 0x1352: 0x1380-0x13b1 + tail 0x13dc-0x1414), el hueco de las GÁRGOLAS del
 * Palacio (reporte del usuario + testigo vídeo jugando-es ep.16 @8:25).
 *
 * Cadena derivada (re/notes/gargolas-hostiles-palacio.md):
 *  - fast-path NPC.OVL 0x06e4: manhattan==1 ∧ aiType>=6 → marcador 0x61 'a'
 *    (0x07be) + [0x65bf]=idx (0x074e).
 *  - npc_engine 0x1379 rama 'a':
 *      0x138a dlg==0xFE → 0x1392: TOWN 0x10da town_possessed_npc_attack
 *        («"Begone,\nvermin!"» DS 0x278a + 0x8d4: dlg 0xFD + aiTypes [3,3,3]).
 *      0x13a4 tile==0x70 → 0x12ae (arresto; en loc 0x12 la captura).
 *      0x13ac else → [bp-2]=1 → tail 0x13dc:
 *        actor >= 0x40 (0x13f4) → «\nAttacked!\n» (DS 0x2881, 0x13fb) +
 *          town_attack_engine_commit 0x09BC = dead-bit + COMBATE
 *          (enter_combat_vs_actor 0x6150) + ranura FUERA — incondicional.
 *        actor < 0x40 → 0x140e npc_clear_slot (0xb0) a secas.
 *  - 0x12ae 'N' («Then defend thyself, rogue!») devuelve 1 (0x1346) → el MISMO
 *    tail ataca con el guardia ([0x65bf] intacto): combate contra GUARD (def 12,
 *    count=8 exacto — la excepción de pueblo de combat_spawn_encounter 0x6c6b).
 *
 * Esperados EN CRUDO (no derivados del sujeto):
 *  - def de la gárgola: (0xB8 − 0x40) / 4 = 30; monsterNamesUpper[30] = "GARGOYLE".
 *  - centrado ancho-16: (16 − 8) / 2 = 4 espacios.
 *  - arena del interior: tile de suelo 0x44 → 8 Brick (fila `t == 0x44` de §2b);
 *    la azotea (t=0x27) cae al default de pueblo → 8 Brick.
 *  - flags de la gárgola: DATA.OVL enemyFlags[30] = [144, 0] → 0x9000 =
 *    bludgeons + divideOnHit (la multiplicación del vídeo es de combate, ya portada).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type CombatResources, type GameData, type GameEvent } from "../src/core/game.js";
import {
  buildEnemyDefs,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../src/core/combat/enemies.js";
import { arenaForActorAttack, CombatMapIndex } from "../src/core/combat/encounters.js";
import type { CombatMapData } from "../src/core/combat/combat.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { NpcManager, type NpcRuntime } from "../src/core/npc/manager.js";
import { LOC_BLACKTHORN, PALACE_GUARD_TYPE } from "../src/core/world/blackthorn.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

const combatResources: CombatResources = {
  combatMaps,
  enemyDefs: buildEnemyDefs(data, additionalFlags),
  attackValues: [],
  attackRangeValues: [],
  defenseValues: data.defenseValues,
};

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  };
}

const TOWN = 2; // pueblo genérico (≠ 0x12 Palacio)

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar({ name: "Avatar" }), makeChar({ name: "Iolo" })],
    partySize: 2, activeCharacter: 0, food: 100, gold: 100, karma: 40,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 35 },
    turnsSinceStart: 0,
    position: { location: TOWN, floor: 0, x: 5, y: 5 },
    transport: "foot", prevHour: 12,
    npcDead: Array.from({ length: 32 }, () => []),
    npcMet: Array.from({ length: 32 }, () => []),
  };
  return { ...base, ...over } as GameState;
}

/**
 * Small map 32×32 de suelo de ladrillo 0x44 (la fila `t == 0x44 → Brick` de §2b),
 * con una CAMA 0xab (LeftBed) en (4,5) — al OESTE de la party (5,5) — para la rama
 * de indefenso del (A)ttack (TOWN 0x0b26 `cmp ax,0xab`).
 */
function makeLocation(id: number, name: string): SmallMapLocation {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 0x44));
  tiles[5]![4] = 0xab; // tiles[y][x]
  return { id, name, floors: [{ z: 0, tiles }, { z: 3, tiles }] };
}

function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return {
    overworld,
    underworld: overworld,
    smallMaps: new Map([
      [TOWN, makeLocation(TOWN, "Britain")],
      [LOC_BLACKTHORN, makeLocation(LOC_BLACKTHORN, "Palace")],
    ]),
  };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 100),
  locationsY: Array.from({ length: 32 }, () => 100),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

interface Harness {
  game: Game;
  npc: NpcRuntime;
  cleared: Array<[number, number]>;
  alarms: number[];
}

/** Manager stub: UN NPC (adyacente al este) + registro de clearSlot/arrestAlarm. */
function makeHarness(
  npcOver: Partial<NpcRuntime>,
  stateOver: Partial<GameState> = {},
): Harness {
  const s = makeState(stateOver);
  const cleared: Array<[number, number]> = [];
  const alarms: number[] = [];
  const npc = {
    slot: 17,
    type: 0xb8, // gárgola (tile atlas 440 = 0xB8 + 0x100)
    dialogNumber: 0,
    aiTypes: [6, 6, 6],
    times: [0, 0, 0, 0],
    x: s.position.x + 1, // adyacente al este (manhattan == 1, 0x0723)
    y: s.position.y,
    z: s.position.floor,
    ...npcOver,
  } as unknown as NpcRuntime;
  const list = [npc];
  const manager = {
    setRng() {},
    enterMap() {},
    tick() {},
    arrestAlarm(loc: number) {
      alarms.push(loc);
    },
    clearSlot(loc: number, slot: number) {
      cleared.push([loc, slot]);
      const i = list.findIndex((n) => n.slot === slot);
      if (i >= 0) list.splice(i, 1);
    },
    npcsAt: (loc: number, floor: number) =>
      loc === s.position.location ? list.filter((n) => n.z === floor) : [],
    // Búsqueda real (la vía player-initiated y el (T)alk la usan): mismo predicado
    // que NpcManager.npcAt (floor + celda exacta).
    npcAt: (loc: number, floor: number, x: number, y: number) =>
      loc === s.position.location
        ? (list.find((n) => n.z === floor && n.x === x && n.y === y) ?? null)
        : null,
  } as unknown as NpcManager;
  const game = new Game({} as ExtractedInitialState, makeWorld(), gameData, s, {
    npcManager: manager,
    combatResources,
  });
  game.reseed(4242);
  return { game, npc, cleared, alarms };
}

const msgs = (ev: GameEvent[]): string[] =>
  ev.filter((e) => e.kind === "message").map((e) => e.text ?? "");

describe("rama 'a' de npc_engine — el hostil NO-guardia ATACA (tail 0x13dc)", () => {
  it("gárgola (ai 6, tile 0xB8) adyacente: «\\nAttacked!\\n» + GARGOYLE + CONFLICT + combate", () => {
    const h = makeHarness({});
    const ev = h.game.confirmTownExit(false); // un townTurn con la gárgola adyacente
    const m = msgs(ev);
    // Secuencia fiel: pre-línea DS 0x2881 ENTERA (con \n de cabecera, 0x13fb) →
    // grupo centrado (monsterNamesUpper[30] = "GARGOYLE", (16−8)/2 = 4 espacios) →
    // banner DS 0xa438. Esperado EN CRUDO.
    const i = m.indexOf("\nAttacked!\n");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(m[i + 1]).toBe("    GARGOYLE\n");
    expect(m[i + 2]).toBe("*** CONFLICT ***\n");
    expect(ev.some((e) => e.kind === "combat-started")).toBe(true);
    expect(h.game.combat).not.toBeNull();
    // Commit 0x09BC: la ranura FUERA (dead-bit + clear), incondicional.
    expect(h.cleared).toEqual([[TOWN, 17]]);
    // Regla de grupo en pueblo (combat_spawn_encounter 0x6c5d): count = 1 — la
    // multiplicación del vídeo es divideOnHit DENTRO del combate, no el spawn.
    const enemies = h.game.combat!.combatants.filter((c) => (c as { enemyDef?: unknown }).enemyDef);
    expect(enemies.length).toBe(1);
  });

  it("la misma cadena corre EN EL PALACIO (loc 18): el corte de Blackthorn era el softlock", () => {
    const h = makeHarness(
      { z: 3 },
      { position: { location: LOC_BLACKTHORN, floor: 3, x: 15, y: 19 } },
    );
    h.npc.x = 16; // adyacente
    h.npc.y = 19;
    const ev = h.game.confirmTownExit(false);
    expect(msgs(ev)).toContain("\nAttacked!\n");
    expect(h.cleared).toEqual([[LOC_BLACKTHORN, 17]]);
    expect(h.game.combat).not.toBeNull();
  });

  it("daemon del Palacio (ai 0): NO arma el marcador — bloquea sin atacar (0x0728 jle)", () => {
    const h = makeHarness({ type: 0xd8, aiTypes: [0, 0, 0] });
    const ev = h.game.confirmTownExit(false);
    expect(msgs(ev).join(" ")).not.toContain("Attacked!");
    expect(h.cleared).toEqual([]);
    expect(h.game.combat).toBeNull();
  });

  it("Sin'Vraal (daemon 0xd8, ai 1, dlg 11): tampoco — el tile de monstruo NO decide, decide el aiType", () => {
    const h = makeHarness({ type: 0xd8, aiTypes: [1, 1, 1], dialogNumber: 11 });
    const ev = h.game.confirmTownExit(false);
    expect(msgs(ev).join(" ")).not.toContain("Attacked!");
    expect(h.game.combat).toBeNull();
  });

  it("poseído de Astaroth (dlg 0xFE, ai 7, persona): «Begone, vermin!» + degradado a 0xFD/[3,3,3], SIN combate (0x1392 → 0x10da)", () => {
    const h = makeHarness({ type: 0x50, dialogNumber: 0xfe, aiTypes: [7, 7, 7] });
    const ev = h.game.confirmTownExit(false);
    expect(msgs(ev)).toContain('"Begone,\nvermin!"\n'); // DS 0x278a
    expect(h.npc.dialogNumber).toBe(0xfd); // 0x8d4: 0x092f
    expect(h.npc.aiTypes).toEqual([3, 3, 3]); // 0x093d-0x094b
    expect(h.game.combat).toBeNull();
    expect(h.cleared).toEqual([]);
  });

  it("actor-objeto (< 0x40) hostil: ranura fuera SIN mensaje ni combate (0x140e call 0xb0)", () => {
    // Inalcanzable con datos de fábrica (censo npcs.json) — se calca por forma.
    const h = makeHarness({ type: 0x10, aiTypes: [7, 7, 7] });
    const ev = h.game.confirmTownExit(false);
    expect(msgs(ev).join(" ")).not.toContain("Attacked!");
    expect(h.cleared).toEqual([[TOWN, 17]]);
    expect(h.game.combat).toBeNull();
  });
});

describe("rehusar el arresto → el guardia ATACA (0x12ae ret 1 → tail 0x13dc)", () => {
  it("'N': rogue + alarma + «\\nAttacked!\\n» + combate contra 8 GUARDS + ranura fuera", () => {
    const h = makeHarness({ type: PALACE_GUARD_TYPE, dialogNumber: 0xff, aiTypes: [7, 7, 7] });
    const ev1 = h.game.confirmTownExit(false); // hostil 0x70 → arresto directo (0x13a4)
    expect(ev1.some((e) => e.kind === "guard-arrest-prompt")).toBe(true);
    const ev2 = h.game.resolveGuardArrest(false); // 'N' (0x133c-0x1346)
    const m = msgs(ev2);
    // Orden del binario: rogue (0x1340) → alarma 0x958 (0x1343) → ret 1 → Attacked!
    expect(m[0]).toContain("defend thyself, rogue");
    expect(h.alarms).toEqual([TOWN]);
    expect(m).toContain("\nAttacked!\n");
    // GUARD = def (0x70−0x40)/4 = 12; grupo EXACTO de 8 (maxPerMap 8, la excepción
    // de pueblo `cmp [bp+4],0xc` de 0x6c6b). Esperado en crudo.
    expect(m).toContain("     GUARDS\n"); // monsterNamesUpper[12]="GUARDS": (16−6)/2=5
    const enemies = h.game.combat!.combatants.filter((c) => (c as { enemyDef?: unknown }).enemyDef);
    expect(enemies.length).toBe(8);
    expect(h.cleared).toEqual([[TOWN, 17]]);
  });

  it("'Y' (quietly): celda de Yew, SIN ataque (0x12ae devuelve 0 por esa vía)", () => {
    const h = makeHarness({ type: PALACE_GUARD_TYPE, dialogNumber: 0xff, aiTypes: [7, 7, 7] });
    h.game.confirmTownExit(false);
    const ev = h.game.resolveGuardArrest(true);
    expect(msgs(ev).join(" ")).not.toContain("Attacked!");
    expect(h.game.combat).toBeNull();
    expect(h.cleared).toEqual([]);
  });
});

describe("arenaForActorAttack — el switch §2b de enter_combat_vs_actor (0x61f3-0x6338)", () => {
  const FOOT = 0x1c;
  it("filas del switch, esperados en crudo", () => {
    expect(arenaForActorAttack(0x44, 0xb8, FOOT, 18)).toBe(CombatMapIndex.Brick); // t==0x44 → 8
    expect(arenaForActorAttack(0x27, 0xb8, FOOT, 18)).toBe(CombatMapIndex.Brick); // resto en pueblo → 8
    expect(arenaForActorAttack(0x27, 0xb8, FOOT, 0)).toBe(CombatMapIndex.Glade); // resto fuera → 2
    expect(arenaForActorAttack(5, 0x90, FOOT, 0)).toBe(CombatMapIndex.Glade); // t 4..7 → t−3
    expect(arenaForActorAttack(8, 0x90, FOOT, 0)).toBe(CombatMapIndex.Treed); // t==8 → 3
    expect(arenaForActorAttack(0x1e, 0x90, FOOT, 0)).toBe(CombatMapIndex.Desert); // 0x1e..0x1f → 4
    expect(arenaForActorAttack(0x6a, 0x90, FOOT, 0)).toBe(CombatMapIndex.BigBridge); // puente → 7
    expect(arenaForActorAttack(2, 0x90, FOOT, 0)).toBe(CombatMapIndex.Bay); // agua a pie → 0xf
    expect(arenaForActorAttack(0x44, 0xfc, FOOT, 18)).toBe(CombatMapIndex.Psychedelic); // SL → 0xa
    expect(arenaForActorAttack(2, 0x2c, 0x20, 0)).toBe(CombatMapIndex.BoatBoat); // barco vs pirata → 0xe
    expect(arenaForActorAttack(2, 0x90, 0x20, 0)).toBe(CombatMapIndex.BoatOcean); // barco + agua → 0xb
    expect(arenaForActorAttack(5, 0x90, 0x20, 0)).toBe(CombatMapIndex.BoatSouth); // barco resto → 0xd
    expect(arenaForActorAttack(5, 0x2c, FOOT, 0)).toBe(CombatMapIndex.BoatNorth); // pirata sin barco → 0xc
    expect(arenaForActorAttack(5, 0x84, FOOT, 0)).toBe(CombatMapIndex.Bay); // criatura marina ⇒ agua
  });
});

describe("los flags de la gárgola — el esperado en crudo de la multiplicación", () => {
  it("enemyFlags[30] = [144,0] → 0x9000: bludgeons + divideOnHit", () => {
    // DATA.OVL en crudo (data.json es el volcado): la máscara se combina big-endian.
    expect(data.enemyFlags[30]).toEqual([144, 0]);
    const def = combatResources.enemyDefs[30]!;
    expect(def.groupName).toBe("GARGOYLE");
    expect(def.abilities.divideOnHit).toBe(true);
    expect(def.abilities.bludgeons).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// (A)ttack del JUGADOR en pueblo — TOWN 0x09e6 COMPLETO (carril gargolas-
// residuales; cierre del residual 1 de gargolas-hostiles-palacio.md §7, acta §8).
// Esperados EN CRUDO:
//  - karma −5 CLAMPADO (K 0xbd66 = CS 0x3f36: `cmp [stat],5; jbe → 0`): 40→35,
//    5→0, 4→0; el indefenso lo aplica DOS veces (0x0aef + 0x0b53): 40→30.
//  - alarma (TOWN 0x958): personas (tile<0x80, 0x0afa) y daemons (fam 0xd8,
//    0x0b01); el resto de monstruos NI karma NI alarma (0x0afc..0x0b03 jne 0xb08).
//  - atacable (0x0ab6-0x0ad1): tile≥0x40 ∧ ∉[0xe8,0xf0) ∧ fam≠0xb4.
//  - SIN pre-línea «\nAttacked!\n»: DS 0x2881 se imprime en npc_engine 0x13fb, no
//    en 0x09e6 (0x0b37 llama a 0x9bc directo) — discriminante frente a la vía NPC.
//  - dead-bit (TOWN 0x52, gate 0x0073-0x0082): persona sí, guardia 0x70 nunca,
//    monstruo (fam≥0x80≠0xb4) nunca.
//  - indefenso por TILE DE MAPA {0x84,0x85,0x9f,0xab} (0x0b17-0x0b29): Murdered!
//    (DS 0x2718) sin combate; Blackthorn 0x78 → Missed! (DS 0x270f).
// ═════════════════════════════════════════════════════════════════════════════
describe("(A)ttack del jugador en pueblo — TOWN 0x09e6", () => {
  it("gárgola: combate GARGOYLE SIN pre-línea 0x2881, sin karma, sin alarma, SIN dead-bit", () => {
    const h = makeHarness({});
    const ev = h.game.attack("east");
    const m = msgs(ev);
    expect(m).not.toContain("\nAttacked!\n"); // 0x0b37: commit directo, sin 0x2881
    expect(m).toContain("    GARGOYLE\n"); // catálogo (0xB8−0x40)/4 = 30
    expect(m).toContain("*** CONFLICT ***\n");
    expect(h.game.combat).not.toBeNull();
    expect(h.cleared).toEqual([[TOWN, 17]]);
    expect(h.game.state.karma).toBe(40); // 0xb8 ≥ 0x80 y fam ≠ 0xd8: sin karma
    expect(h.alarms).toEqual([]); // ni alarma
    // TOWN 0x52 gate: fam 0xb8 ≥ 0x80 ≠ 0xb4 → SIN bit ⇒ revive al recargar .NPC
    expect(h.game.state.npcDead[TOWN - 1]?.[17]).toBeUndefined();
  });

  it("aldeano 0x50 (VILLAGER): karma 40→35 + alarma + combate def 4 + dead-bit PERSISTENTE", () => {
    const h = makeHarness({ type: 0x50, dialogNumber: 3, aiTypes: [1, 1, 1] });
    const ev = h.game.attack("east");
    const m = msgs(ev);
    expect(h.game.state.karma).toBe(35); // K 0xbd66(0x5888, 5): 40−5
    expect(h.alarms).toEqual([TOWN]); // 0x0afa jmp 0xb05
    expect(m).toContain("    VILLAGER\n"); // (0x50−0x40)/4 = 4, centrado (16−8)/2
    expect(h.game.combat).not.toBeNull();
    expect(h.cleared).toEqual([[TOWN, 17]]);
    // Gate 0x52: fam 0x50 < 0x80 ≠ 0x70 → bit puesto = state.npcDead = SAVED.GAM
    // 0x5B4 (ya nativo; enterMap lo filtra) — la mitad PERSONA del residual 3.
    expect(h.game.state.npcDead[TOWN - 1]?.[17]).toBe(true);
  });

  it("clamp del karma (CS 0x3f36 jbe): 5→0 y 4→0", () => {
    const h1 = makeHarness({ type: 0x50 }, { karma: 5 });
    h1.game.attack("east");
    expect(h1.game.state.karma).toBe(0);
    const h2 = makeHarness({ type: 0x50 }, { karma: 4 });
    h2.game.attack("east");
    expect(h2.game.state.karma).toBe(0);
  });

  it("guardia 0x70: karma −5 + alarma + combate 8 GUARDS, y SIN dead-bit (gate 0x0073 je)", () => {
    const h = makeHarness({ type: 0x70, dialogNumber: 0xff, aiTypes: [0, 0, 0] });
    const ev = h.game.attack("east");
    const m = msgs(ev);
    expect(h.game.state.karma).toBe(35); // 0x70 < 0x80: persona a efectos de karma
    expect(h.alarms).toEqual([TOWN]);
    expect(m).toContain("     GUARDS\n"); // def 12; grupo de 8 (0x6c6b)
    const enemies = h.game.combat!.combatants.filter((c) => (c as { enemyDef?: unknown }).enemyDef);
    expect(enemies.length).toBe(8);
    expect(h.game.state.npcDead[TOWN - 1]?.[17]).toBeUndefined(); // guardia: NUNCA bit
  });

  it("daemon 0xd8: SIN karma, CON alarma (0x0b01 je 0xb05), combate DAEMONS", () => {
    const h = makeHarness({ type: 0xd8, aiTypes: [0, 0, 0] });
    const ev = h.game.attack("east");
    expect(h.game.state.karma).toBe(40);
    expect(h.alarms).toEqual([TOWN]);
    expect(msgs(ev)).toContain("    DAEMONS\n"); // (0xD8−0x40)/4 = 38, (16−7)/2=4 → hmm ver abajo
    expect(h.game.combat).not.toBeNull();
    expect(h.game.state.npcDead[TOWN - 1]?.[17]).toBeUndefined();
  });

  it("«Nothing to attack!»: celda vacía · actor-objeto 0x10 · no-actor 0xe8 · cañón 0xb4", () => {
    for (const over of [null, { type: 0x10 }, { type: 0xe8 }, { type: 0xb4 }] as const) {
      const h = makeHarness(over ?? {});
      const dir = over === null ? "north" : "east"; // al norte no hay nadie
      const ev = h.game.attack(dir as "north" | "east");
      expect(msgs(ev)).toContain("Nothing to attack!\n"); // DS 0x26fb
      expect(h.game.combat).toBeNull();
      expect(h.cleared).toEqual([]);
      expect(h.game.state.karma).toBe(40);
      expect(h.alarms).toEqual([]);
    }
  });

  it("indefenso: aldeano sobre cama 0xab → «Murdered!\\n» + karma DOBLE 40→30 + dead-bit, SIN combate", () => {
    const h = makeHarness({ type: 0x50, x: 4, y: 5 }); // sobre la cama (4,5)
    const ev = h.game.attack("west");
    const m = msgs(ev);
    expect(m).toContain("Murdered!\n"); // DS 0x2718
    expect(m).not.toContain("Nothing to attack!\n");
    expect(h.game.state.karma).toBe(30); // 0x0aef −5 y 0x0b53 −5
    expect(h.alarms).toEqual([TOWN]); // sólo la del paso persona (0x0afa)
    expect(h.game.combat).toBeNull(); // 0x0b73 call 0xb0: clear a secas
    expect(h.cleared).toEqual([[TOWN, 17]]);
    expect(h.game.state.npcDead[TOWN - 1]?.[17]).toBe(true); // 0x0b6d call 0x52
  });

  it("Blackthorn 0x78 sobre cama → «Missed!\\n» (DS 0x270f): inmatable, pero karma/alarma YA corridos", () => {
    const h = makeHarness({ type: 0x78, x: 4, y: 5 });
    const ev = h.game.attack("west");
    const m = msgs(ev);
    expect(m).toContain("Missed!\n");
    expect(m).not.toContain("Murdered!\n");
    expect(h.game.state.karma).toBe(35); // SOLO el primer −5 (0x78 < 0x80)
    expect(h.alarms).toEqual([TOWN]);
    expect(h.game.combat).toBeNull();
    expect(h.cleared).toEqual([]); // ni dead-bit ni clear (0x0b49 jmp 0xae1→exit)
    expect(h.game.state.npcDead[TOWN - 1]?.[17]).toBeUndefined();
  });

  it("gárgola sobre cama: el indefenso NO mira el actor — «Murdered!» también para monstruos, sin bit", () => {
    // El gate 0x0b17 lee el TILE DE MAPA; el actor sólo decide Blackthorn-vs-resto
    // (0x0b40). Un monstruo sobre cama muere sin combate — y el gate de 0x52 le
    // niega el bit: no persiste. Calco por forma (fábrica: ningún monstruo duerme).
    const h = makeHarness({ type: 0xb8, x: 4, y: 5 });
    const ev = h.game.attack("west");
    expect(msgs(ev)).toContain("Murdered!\n");
    expect(h.game.combat).toBeNull();
    expect(h.cleared).toEqual([[TOWN, 17]]);
    // El 2º karma −5 (0x0b53) es INCONDICIONAL en la rama Murdered — también a un
    // monstruo; lo que se salta el monstruo es el 1º (0x0ae8 jge) y la alarma.
    expect(h.game.state.karma).toBe(35);
    expect(h.alarms).toEqual([]);
    expect(h.game.state.npcDead[TOWN - 1]?.[17]).toBeUndefined();
  });
});

describe("(T)alk al poseído — TALK 0x03a6/0x03cc (residual 2, acta §8)", () => {
  it("0xFD: '\"Don't hurt me!…\"\\n' byte-exacto (comillas + \\n del putchar 0x573a)", () => {
    const h = makeHarness({ type: 0x50, dialogNumber: 0xfd, aiTypes: [3, 3, 3] });
    const ev = h.game.tryTalkPossessed("east");
    expect(ev).not.toBeNull();
    expect((ev![0] as { text?: string }).text).toBe('"Don\'t hurt me!\nPlease go away!"\n');
  });

  it("0xFE: DS 0x278a entero Y el NPC NO se degrada — TALK 0x03d3 llama SIN push", () => {
    // Derivado del crudo (acta §8): 0x10da consume [bp+4] = el si salvado del
    // prólogo de 0x031e (argumento sin inicializar), NO el slot del hablado. El
    // observable sobre el NPC hablado: sigue 0xFE/[7,7,7] (volverá a atacar).
    const h = makeHarness({ type: 0x50, dialogNumber: 0xfe, aiTypes: [7, 7, 7] });
    const ev = h.game.tryTalkPossessed("east");
    expect(ev).not.toBeNull();
    expect((ev![0] as { text?: string }).text).toBe('"Begone,\nvermin!"\n');
    expect(h.npc.dialogNumber).toBe(0xfe); // NO degradado por esta vía
    expect(h.npc.aiTypes).toEqual([7, 7, 7]);
    // CONTROL POSITIVO — la degradación SÍ corre por la vía de intercepción
    // (npc_engine 0x1399 `push idx`): mismo NPC, un turno con él adyacente.
    const ev2 = h.game.confirmTownExit(false);
    expect(msgs(ev2)).toContain('"Begone,\nvermin!"\n');
    expect(h.npc.dialogNumber).toBe(0xfd);
    expect(h.npc.aiTypes).toEqual([3, 3, 3]);
  });
});
