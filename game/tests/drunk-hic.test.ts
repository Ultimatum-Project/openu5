/**
 * Borrachera de pueblo (str-drunk-hic) — town_read_command TOWN 0x0DF2-0x0E27:
 * con [0x5957]≠0 (contador que arma la 4ª copa de la taberna), POR TECLA y tras
 * el viento (0x0DD0): rand(0,1); si ==1 → dec [0x5957] (0x0E0A) + "Hic!"
 * (DS 0x273C = DATA.OVL 0x274C) + rand(0,3) sobre la tabla 0x2742 = {3,4,2,1}
 * (N,S,E,O): el código devuelto SUSTITUYE al comando → el paso va en la
 * dirección del TUMBO. El cargador de pueblo pone el contador a 0 (TOWN 0x1218).
 */
import { describe, expect, it } from "vitest";
import { Game, type GameData, type GameSystems } from "../src/core/game.js";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { NpcManager } from "../src/core/npc/manager.js";
import { DoorManager } from "../src/core/world/doors.js";
import { OriginalRng } from "../src/core/rng-original.js";
import {
  drunkConfusionRoll,
  townTurn,
  DRUNK_STAGGER_DIRS,
} from "../src/core/world/loops/turn.js";
import { maybeChangeWind } from "../src/core/world/wind.js";
import type { RandFn } from "../src/core/world/survival.js";
import { DIRECTION_DELTA } from "../src/core/world/movement.js";

const TOWN = 2;
const SMALL = 32;
const FLOOR_TILE = 68; // transitable

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20, currentMp: 10, currentHp: 50, maxHp: 60,
    exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar()], partySize: 1, activeCharacter: 0, food: 100, gold: 100,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    prevHour: 12, turnsSinceStart: 0,
    position: { location: TOWN, floor: 0, x: 15, y: 15 },
    transport: "foot", torchTurns: 0, torches: 2, wind: 0, windDriftCtr: 0,
    openDoors: [], npcDead: [], npcMet: [],
  };
  return { ...base, ...over } as GameState;
}

function makeWorld(): WorldData {
  const tiles: number[][] = [];
  for (let y = 0; y < SMALL; y++) {
    const row: number[] = [];
    for (let x = 0; x < SMALL; x++) row.push(FLOOR_TILE);
    tiles.push(row);
  }
  const loc: SmallMapLocation = { id: TOWN, name: "TEST", floors: [{ z: 0, tiles }] };
  return { overworld: [], underworld: [], smallMaps: new Map([[TOWN, loc]]) };
}

const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
function makeGame(st: GameState): Game {
  const systems: GameSystems = { npcManager: new NpcManager({}), doors: new DoorManager() };
  return new Game({} as ExtractedInitialState, makeWorld(), gameData, st, systems);
}

describe("drunkConfusionRoll (motor puro, TOWN 0x0DF2-0x0E27)", () => {
  it("gate rand(0,1)==0 → sin Hic, sin dec, sin 2ª tirada", () => {
    const st = makeState({ drunkTurns: 5 });
    const draws: number[] = [];
    const rand: RandFn = (lo, hi) => { draws.push(hi); return lo; }; // devuelve 0
    const r = drunkConfusionRoll(st, rand);
    expect(r.hic).toBe(false);
    expect(r.staggerDir).toBeUndefined();
    expect(st.drunkTurns).toBe(5); // no dec
    expect(draws).toEqual([1]); // SOLO el gate (0x0E05 je: sin tabla)
  });

  it("gate ==1 → Hic + dec + tumbo por la tabla 0x2742 (N,S,E,O)", () => {
    for (let idx = 0; idx < 4; idx++) {
      const st = makeState({ drunkTurns: 5 });
      const seq = [1, idx];
      const rand: RandFn = () => seq.shift()!;
      const r = drunkConfusionRoll(st, rand);
      expect(r.hic).toBe(true);
      expect(r.staggerDir).toBe(DRUNK_STAGGER_DIRS[idx]);
      expect(st.drunkTurns).toBe(4); // dec [0x5957] (0x0E0A)
    }
    expect(DRUNK_STAGGER_DIRS).toEqual(["north", "south", "east", "west"]); // {3,4,2,1}
  });
});

describe("Game.move borracho en pueblo (rama viva)", () => {
  /**
   * Espejo del stream: reproduce viento → gate → tabla con un OriginalRng gemelo
   * y exige que el paso del juego vivo aterrice donde dicta el TUMBO (no la tecla).
   */
  function expectedStagger(seed: number, st: GameState): { hic: boolean; dx: number; dy: number } {
    const rng = new OriginalRng(seed);
    const rand: RandFn = (lo, hi) => rng.next(lo, hi);
    const ghost = { ...st, wind: st.wind } as GameState;
    maybeChangeWind(ghost, rand); // TOWN 0x0DD0 (viento por tecla, PRIMERO)
    if (rand(0, 1) !== 1) return { hic: false, dx: 0, dy: 0 };
    const dir = DRUNK_STAGGER_DIRS[rand(0, 3)]!;
    return { hic: true, ...DIRECTION_DELTA[dir] };
  }

  it("con el gate disparando: 'Hic!', tumbo (dirección de la tabla) y dec del contador", () => {
    // Busca una semilla cuyo gate dispare y cuyo tumbo NO sea la tecla pulsada (oeste).
    let seed = -1;
    let exp: { hic: boolean; dx: number; dy: number } = { hic: false, dx: 0, dy: 0 };
    for (let s = 1; s < 200; s++) {
      exp = expectedStagger(s, makeState({ drunkTurns: 25 }));
      if (exp.hic && !(exp.dx === -1 && exp.dy === 0)) { seed = s; break; }
    }
    expect(seed).toBeGreaterThan(0);

    const st = makeState({ drunkTurns: 25 });
    const g = makeGame(st);
    g.reseed(seed);
    const events = g.move("west"); // la tecla pide oeste; el tumbo manda
    expect(events.some((e) => e.kind === "message" && e.text === "Hic!")).toBe(true);
    expect(st.position.x).toBe(15 + exp.dx);
    expect(st.position.y).toBe(15 + exp.dy);
    expect(st.drunkTurns).toBe(24); // dec (0x0E0A)
  });

  it("con el gate en 0: paso normal en la dirección pulsada, contador intacto", () => {
    let seed = -1;
    for (let s = 1; s < 200; s++) {
      if (!expectedStagger(s, makeState({ drunkTurns: 25 })).hic) { seed = s; break; }
    }
    expect(seed).toBeGreaterThan(0);

    const st = makeState({ drunkTurns: 25 });
    const g = makeGame(st);
    g.reseed(seed);
    const events = g.move("west");
    expect(events.some((e) => e.kind === "message" && e.text === "Hic!")).toBe(false);
    expect(st.position.x).toBe(14); // el paso pulsado
    expect(st.drunkTurns).toBe(25);
  });

  it("sobrio (contador 0): la rama no consume ni imprime", () => {
    const st = makeState();
    const g = makeGame(st);
    g.reseed(7);
    const events = g.move("west");
    expect(events.some((e) => e.kind === "message" && e.text === "Hic!")).toBe(false);
    expect(st.position.x).toBe(14);
  });
});

describe("Game.commandDrunkIntercept — remap del dispatch para teclas NO-move (0x0E27)", () => {
  /** Espejo del stream del intercepto con timeSpell=T (el viento se salta y aísla
   *  el gate): rand(0,1) → gate; rand(0,3) → tabla 0x2742. */
  function mirror(seed: number): { hic: boolean; dx: number; dy: number } {
    const rng = new OriginalRng(seed);
    if (rng.next(0, 1) !== 1) return { hic: false, dx: 0, dy: 0 };
    const dir = DRUNK_STAGGER_DIRS[rng.next(0, 3)]!;
    return { hic: true, ...DIRECTION_DELTA[dir] };
  }
  const findSeed = (hic: boolean): number => {
    for (let s = 1; s < 200; s++) if (mirror(s).hic === hic) return s;
    return -1;
  };

  it("sobrio → null (no-op, cero coste): el dispatch sigue con la tecla pulsada", () => {
    const st = makeState();
    const g = makeGame(st);
    g.reseed(7);
    expect(g.commandDrunkIntercept()).toBeNull();
    expect(st.position.x).toBe(15); // sin tumbo
  });

  it("borracho con gate==0 → null (el comando sigue) SIN dec del contador", () => {
    const seed = findSeed(false);
    expect(seed).toBeGreaterThan(0);
    const st = makeState({ drunkTurns: 9, timeSpell: "T" });
    const g = makeGame(st);
    g.reseed(seed);
    expect(g.commandDrunkIntercept()).toBeNull();
    expect(st.drunkTurns).toBe(9); // gate 0x0E05 je: sin dec ni tabla
    expect(st.position.x).toBe(15);
  });

  it("borracho con gate==1 → 'Hic!' + el TUMBO sustituye al comando (turno completo)", () => {
    const seed = findSeed(true);
    expect(seed).toBeGreaterThan(0);
    const exp = mirror(seed);
    const st = makeState({ drunkTurns: 9, timeSpell: "T" });
    const g = makeGame(st);
    g.reseed(seed);
    const events = g.commandDrunkIntercept();
    expect(events).not.toBeNull();
    expect(events!.some((e) => e.kind === "message" && e.text === "Hic!")).toBe(true);
    // El paso aterriza donde dicta la tabla (la tecla pulsada nunca corre) y el
    // prólogo NO se re-rueda dentro de move (one-shot drunkStaggerInFlight):
    // exactamente UN dec del contador y UNA posición de tabla.
    expect(st.position.x).toBe(15 + exp.dx);
    expect(st.position.y).toBe(15 + exp.dy);
    expect(st.drunkTurns).toBe(8); // un solo dec (0x0E0A)
  });

  it("tras un intercepto sin Hic, un move posterior re-rueda su propio prólogo", () => {
    // El one-shot no queda armado: el siguiente move con contador vivo sigue
    // entrando por su prólogo (si el gate dispara, tumbo; si no, paso pulsado).
    const seed = findSeed(false);
    const st = makeState({ drunkTurns: 9, timeSpell: "T" });
    const g = makeGame(st);
    g.reseed(seed);
    expect(g.commandDrunkIntercept()).toBeNull();
    const x0 = st.position.x;
    g.move("west");
    // Se movió (tumbo o paso): la posición cambió — el prólogo no dejó el move inerte.
    expect(st.position.x !== x0 || st.position.y !== 15).toBe(true);
  });
});

describe("townTurn 1b (comandos no-move: consumo + Hic sin remap aplicable)", () => {
  it("confused + gate==1 → mensaje 'Hic!' + dec en el esqueleto del turno", () => {
    // rand determinista: viento (no cambia con lo), gate=1, tabla=0, resto lo.
    const st = makeState({ drunkTurns: 3, timeSpell: "T" }); // T: salta el viento (aísla el gate)
    const seq = [1, 2];
    const rand: RandFn = (lo) => (seq.length > 0 ? seq.shift()! : lo);
    const r = townTurn(st, rand, { consumesTurn: false, confused: true });
    expect(r.messages).toContain("Hic!");
    expect(st.drunkTurns).toBe(2);
  });

  it("preRolled: townTurn NO re-consume viento ni confusión", () => {
    const st = makeState({ drunkTurns: 3 });
    let draws = 0;
    const rand: RandFn = (lo) => { draws++; return lo; };
    townTurn(st, rand, { consumesTurn: false, confused: true, preRolled: true });
    expect(draws).toBe(0); // ni viento (1) ni confusión (1b): ya rodados por move()
    expect(st.drunkTurns).toBe(3);
  });
});
