/**
 * SET ACTIVE PLAYER en COMBATE (teclas 1-6 / 0) — QA usuario, COMBAT:0x063E.
 *
 * Deriva del asm: combat_player_turn (0x063E) skipea el turno de todo PJ cuyo
 * slot de roster != g_active_char cuando g_active_char != 0xFF (0666-067f: call
 * 0xda86; ret). Los dígitos lo fijan: '0' (0x09ec) → 0xFF (ninguno); '1'-'6'
 * (0x09fe) → index=digit-1 vía kernel dab6; inválido → dab6 ret!=0 → el actor
 * pierde el turno (0x0a0e bp-4=1). Al morir el activo, g_active_char=0xFF
 * (0x1574 15c5-1604).
 *
 * Estos tests son DISCRIMINANTES: antes del fix, el ciclo de iniciativa
 * (`findNextActor`) ignoraba `activeCharacter` y TODOS los PJ eran interpelados.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  createNewGame,
  type CharacterState,
  type ExtractedInitialState,
  type GameState,
} from "../src/core/state.js";
import {
  buildEnemyDefs,
  type EnemyDef,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../src/core/combat/enemies.js";
import {
  Combat,
  type CombatMapData,
  type PartyCombatant,
} from "../src/core/combat/combat.js";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

function defs(): EnemyDef[] {
  return buildEnemyDefs(data, additionalFlags);
}
function byName(name: string): EnemyDef {
  const d = defs().find((e) => e.name === name);
  if (!d) throw new Error(`enemigo no encontrado: ${name}`);
  return d;
}
const campFire = (): CombatMapData => combatMaps[0]!;

function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}
function party(state: GameState): PartyCombatant[] {
  return state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));
}

/** Recorre `maxTurns` turnos: pasa los de PJ, procesa los de enemigo; devuelve la
 *  secuencia de charIdx de PJ interpelados. */
function drivePlayerTurns(combat: Combat, maxTurns: number): number[] {
  const seen: number[] = [];
  let guard = 0;
  while (!combat.over && guard++ < maxTurns) {
    const cur = combat.currentUnit;
    if (!cur) break;
    if (cur.kind === "player") {
      seen.push(cur.charIdx!);
      combat.playerPass();
    } else {
      combat.tickEnemyTurns();
    }
  }
  return seen;
}

function makeCombat(state: GameState, enemy: EnemyDef): Combat {
  return new Combat({
    map: campFire(),
    entryDirection: "east",
    party: party(state),
    enemies: [{ def: enemy, count: 1 }],
    seed: 777,
    state,
    defenseValues: data.defenseValues,
  });
}

describe("Combat — skip de iniciativa por miembro activo (COMBAT:0x0666)", () => {
  it("g_active_char=0xFF (por defecto): el ciclo interpela a TODOS los PJ", () => {
    const state = freshState();
    for (const c of state.characters) {
      c.currentHp = 999;
      c.maxHp = 999;
    }
    state.activeCharacter = 0xff;
    const combat = makeCombat(state, byName("Giant Spider"));
    const seen = new Set(drivePlayerTurns(combat, 60));
    // La party inicial trae ≥2 miembros vivos: todos deben aparecer.
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it("g_active_char=1: SÓLO el miembro activo es interpelado (los demás auto-pasan)", () => {
    const state = freshState();
    for (const c of state.characters) {
      c.currentHp = 999;
      c.maxHp = 999;
    }
    const activeParty = party(state);
    expect(activeParty.length).toBeGreaterThanOrEqual(2); // hay a quién skipear
    state.activeCharacter = 1;
    const combat = makeCombat(state, byName("Giant Spider"));
    const seen = drivePlayerTurns(combat, 60);
    expect(seen.length).toBeGreaterThan(0); // el activo SÍ actúa cada ronda
    expect(new Set(seen)).toEqual(new Set([1])); // y NADIE más
  });

  it("defensa anti-bloqueo: activo ausente de la arena ⇒ NO skipea (ciclo normal)", () => {
    const state = freshState();
    for (const c of state.characters) {
      c.currentHp = 999;
      c.maxHp = 999;
    }
    state.activeCharacter = 5; // índice fuera de la party presente
    const combat = makeCombat(state, byName("Giant Spider"));
    const seen = new Set(drivePlayerTurns(combat, 60));
    expect(seen.size).toBeGreaterThanOrEqual(2); // no se queda bloqueado
  });

  it("al morir el miembro activo, g_active_char vuelve a 0xFF (COMBAT:0x1574)", () => {
    const state = freshState();
    // Party de UN solo PJ, activo, con 1 HP: el enemigo (Dragon, a distancia) lo
    // mata y el combate acaba. `party()` filtra por partyStatus; dejamos sólo al 0.
    for (let i = 1; i < state.characters.length; i++) state.characters[i]!.partyStatus = 1;
    state.characters[0]!.currentHp = 1;
    state.characters[0]!.maxHp = 1;
    state.partySize = 1;
    state.activeCharacter = 0;
    const combat = makeCombat(state, byName("Dragon"));
    let guard = 0;
    while (!combat.over && guard++ < 400) {
      const cur = combat.currentUnit;
      if (!cur) break;
      if (cur.kind === "player") combat.playerPass();
      else combat.tickEnemyTurns();
    }
    expect(state.characters[0]!.status).toBe("D"); // murió el activo
    expect(state.activeCharacter).toBe(0xff); // g_active_char limpiado
  });
});

// ------------------------------------------------- Game.combatActivePlayer ---

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  } as CharacterState;
}
function makeState(): GameState {
  return {
    characters: [makeChar({ name: "" }), makeChar({ name: "Iolo" }), makeChar({ name: "Gorn", status: "D" })],
    partySize: 3, activeCharacter: 0xff, food: 100,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 0 },
    turnsSinceStart: 0, position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 8,
  } as GameState;
}
const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const combatResources: CombatResources = {
  combatMaps,
  enemyDefs: defs(),
  attackValues: [],
  attackRangeValues: [],
  defenseValues: data.defenseValues,
};
function makeGame(s: GameState): Game {
  const g = new Game({} as ExtractedInitialState, {
    overworld: [], underworld: [], smallMaps: new Map(),
  } as unknown as WorldData, gameData, s, { combatResources });
  return g;
}

describe("Game.combatActivePlayer — dispatcher de dígitos en combate", () => {
  // Semántica DERIVADA (hotfix #3, re/notes/combate-hotfix-20260722.md): el dígito
  // '1'-'6' va a SJOG.OVL 0x1F7A (thunk 0xffffdab6 → stub 0x7d46); VÁLIDO (ret=1)
  // y '0' ⇒ el actor en curso CEDE el turno (tail COMBAT @0x0b79-0x0b83, salida
  // sin housekeeping); INVÁLIDO (ret=0, "Invalid!\n" DS 0x8f4c) ⇒ [bp-2]=1 →
  // salto @0x0a41→0x06f1 = re-prompt del MISMO actor con banner, SIN turno. La
  // derivación previa («válido = re-prompt, inválido = pierde turno») está
  // FALSIFICADA por el retorno real de SJOG 0x1F7A.
  it("'0' → ninguno (0xFF), eco None!, CEDE el turno (0x09ec → tail 0x0b79)", () => {
    const s = makeState();
    s.activeCharacter = 1;
    const r = makeGame(s).combatActivePlayer(0);
    expect(s.activeCharacter).toBe(0xff);
    expect(r).toEqual({ echo: "None!", yieldTurn: true, reprompt: false });
  });

  it("'2' (miembro vivo) → activeCharacter=1, eco = nombre, CEDE el turno (SJOG ret=1)", () => {
    const s = makeState();
    const r = makeGame(s).combatActivePlayer(2);
    expect(s.activeCharacter).toBe(1);
    expect(r).toEqual({ echo: "Iolo", yieldTurn: true, reprompt: false });
  });

  it("Avatar sin nombrar (índice 0) → eco 'Avatar' (fallback del roster)", () => {
    const s = makeState();
    const r = makeGame(s).combatActivePlayer(1);
    expect(s.activeCharacter).toBe(0);
    expect(r.echo).toBe("Avatar");
    expect(r.yieldTurn).toBe(true);
  });

  it("miembro MUERTO ('D') → Invalid! y RE-PROMPT sin gastar turno (SJOG ret=0 → 0x06f1)", () => {
    const s = makeState(); // Gorn (idx 2) está 'D'
    const before = s.activeCharacter;
    const r = makeGame(s).combatActivePlayer(3);
    expect(s.activeCharacter).toBe(before); // NO cambia el activo
    expect(r).toEqual({ echo: "Invalid!", yieldTurn: false, reprompt: true });
  });

  it("índice fuera de la party (partySize) → Invalid! + re-prompt", () => {
    const s = makeState();
    s.partySize = 2; // el 3 (idx 2) queda fuera
    const r = makeGame(s).combatActivePlayer(3);
    expect(r).toEqual({ echo: "Invalid!", yieldTurn: false, reprompt: true });
  });

  it("'7'-'9' (> 6) → sólo What? (DS 0x6ee6), sin turno ni banner (default 0x0ab7)", () => {
    const s = makeState();
    const r = makeGame(s).combatActivePlayer(7);
    expect(r).toEqual({ echo: null, yieldTurn: false, reprompt: false });
    expect(s.activeCharacter).toBe(0xff); // intacto
  });

  it("con ARENA viva la validez es del SLOT: miembro dormido en la arena → Invalid! (flags&0x2c, SJOG @0x1fbd)", () => {
    const state = freshState();
    for (const c of state.characters) {
      c.currentHp = 999;
      c.maxHp = 999;
    }
    const g = makeGame(state as GameState);
    g.combat = makeCombat(state, byName("Giant Spider"));
    const cb = g.combat.combatants.find(
      (c) => c.kind === "player" && c.charIdx === 1,
    )!;
    cb.sleeping = true;
    const r = g.combatActivePlayer(2);
    expect(r).toEqual({ echo: "Invalid!", yieldTurn: false, reprompt: true });
  });
});
