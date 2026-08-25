/**
 * F2-T4 (espejo fase 2) — Tributo de guardia + ARRESTO en pueblo, cableado vivo.
 *
 * Sistema derivado del binario (antes AUSENTE en vivo; el motor puro `guardDemand`
 * ya existía):
 *  - DEMANDA (TALK.OVL 0x01e2, dialogNum 0xFF, gated por g_location; disparo por
 *    npc_engine TOWN 0x1352 con guardia ADYACENTE — fast-path NPC.OVL 0x06E4
 *    manhattan==1, aiType 4/5): «A guard demands a N gp tribute to Blackthorn!»
 *    (DS 0x90cc/0x90e0, N=10·vivos 0x0230-0x0269) o en Minoc (loc 5) la caridad
 *    (DS 0x90a2), ambas con el helper Y/N 0x00ac (DS 0x9052 «Dost thou pay?»).
 *  - ESCALADA (ret 1 del handler: rehusar 0x028b, o aceptar SIN oro 0x0295 — el
 *    GOTCHA del testigo arrest-ep3): TOWN 0x12ae rama pueblo (0x12d8-0x1346):
 *    «Thou art under arrest!» + «Wilt thou come quietly?» (DS 0x27e2/0x27fe).
 *     · 'Y' (0x12fa-0x133a): inconsciencia (DS 0x281b) + despertar (DS 0x2845) en
 *       la CELDA DE YEW: loc 4, (0x19,4), planta 0, g_keys=0, reloj a las 8.
 *     · 'N' (0x133c-0x1346): «Then defend thyself, rogue!» (DS 0x285e) + alarma
 *       TOWN 0x0958 (guardias hostiles permanentes; ~50% civiles en pánico).
 *  - Guardia YA HOSTIL (aiType 6/7, rama npc_engine 0x13a4 tile 0x70): arresto
 *    DIRECTO sin demanda.
 * Testigo: original/av-referencia/yt/clips/arrest-ep3/ (AD Ep03 27:05, OCR 720p).
 * Derivación: re/notes/blackthorn.md §2.1 + TALK.OVL.asm 0x01e2 + TOWN.OVL.asm
 * 0x12ae/0x0958.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  CharacterState,
  ExtractedInitialState,
  GameState,
} from "../src/core/state.js";
import { Game, type GameData, type GameEvent } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { NpcManager, type NpcRuntime, type NpcSlot } from "../src/core/npc/manager.js";
import { LOC_MINOC, LOC_YEW, PALACE_GUARD_TYPE } from "../src/core/world/blackthorn.js";

// T-C (2026-07-30): el gate `guardTributeTrigger` ya no existe — se derivó que NO
// hay limitador en ninguna capa y el disparo por adyacencia está VIVO en producción.
// Esta suite ya no tiene que encender nada.

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test",
    gender: 0x0b,
    class: "A",
    status: "G",
    strength: 20,
    dexterity: 20,
    intelligence: 20,
    currentMp: 10,
    currentHp: 50,
    maxHp: 60,
    exp: 0,
    level: 2,
    monthsAtInn: 0,
    helmet: 0xff,
    armor: 0xff,
    weapon: 0xff,
    shield: 0xff,
    ring: 0xff,
    amulet: 0xff,
    partyStatus: 0,
    ...over,
  };
}

const TOWN = 2; // Britain: pueblo genérico (≠ 0x12 Palacio, ≠ 5 Minoc)

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar({ name: "Avatar" }), makeChar({ name: "Iolo" })],
    partySize: 2,
    activeCharacter: 0,
    food: 100,
    gold: 100,
    keys: 5,
    gems: 3,
    torches: 2,
    karma: 40,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 35 },
    turnsSinceStart: 0,
    position: { location: TOWN, floor: 0, x: 5, y: 5 },
    transport: "foot",
    prevHour: 12,
    npcDead: Array.from({ length: 32 }, () => []),
    npcMet: Array.from({ length: 32 }, () => []),
  };
  return { ...base, ...over } as GameState;
}

function makeLocation(id: number, name: string): SmallMapLocation {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  return { id, name, floors: [{ z: 0, tiles }] };
}

function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => 5),
  );
  return {
    overworld,
    underworld: overworld,
    smallMaps: new Map([
      [TOWN, makeLocation(TOWN, "Britain")],
      [LOC_MINOC, makeLocation(LOC_MINOC, "Minoc")],
      [LOC_YEW, makeLocation(LOC_YEW, "Yew")],
    ]),
  };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 100),
  locationsY: Array.from({ length: 32 }, () => 100),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

/**
 * Manager stub: UN guardia extorsionador (type 0x70, dialog 0xFF, aiType `ai` en
 * los 3 tramos) adyacente al party. `alarmCalls` registra la alarma (TOWN 0x0958).
 */
function guardManager(
  s: GameState,
  ai = 4,
  alarmCalls: number[] = [],
): NpcManager {
  const guard = {
    slot: 8,
    type: PALACE_GUARD_TYPE,
    dialogNumber: 0xff,
    aiTypes: [ai, ai, ai],
    times: [0, 0, 0, 0],
    x: s.position.x + 1, // adyacente al este
    y: s.position.y,
    z: s.position.floor,
  } as unknown as NpcRuntime;
  return {
    setRng() {},
    enterMap() {},
    tick() {},
    arrestAlarm(loc: number) {
      alarmCalls.push(loc);
    },
    npcsAt: (loc: number, floor: number) =>
      loc === s.position.location && floor === guard.z ? [guard] : [],
    npcAt: (loc: number, floor: number, x: number, y: number) =>
      loc === s.position.location && floor === guard.z && x === guard.x && y === guard.y
        ? guard
        : null,
  } as unknown as NpcManager;
}

function makeGame(s: GameState = makeState(), ai = 4, alarmCalls: number[] = []): Game {
  return new Game({} as ExtractedInitialState, makeWorld(), gameData, s, {
    npcManager: guardManager(s, ai, alarmCalls),
  });
}

const kinds = (events: GameEvent[]): string[] => events.map((e) => e.kind);
const messages = (events: GameEvent[]): string[] =>
  events.filter((e) => e.kind === "message").map((e) => e.text ?? "");

describe("F2-T4 — demanda de tributo (TALK 0x01e2 vía npc_engine)", () => {
  it("guardia aiType 4 adyacente en pueblo → guard-tribute-prompt con tributo=10·vivos", () => {
    const game = makeGame();
    const events = game.confirmTownExit(false); // un townTurn con el guardia ADYACENTE
    const prompt = events.find((e) => e.kind === "guard-tribute-prompt");
    expect(prompt).toBeDefined();
    expect(prompt?.toll).toBe(20); // 2 vivos × 10 gp (TALK 0x0230-0x0269)
    expect(prompt?.charity).toBe(false);
  });

  it("en Minoc (loc 5) la demanda es la variante caridad (TALK 0x01f3)", () => {
    const st = makeState({ position: { location: LOC_MINOC, floor: 0, x: 5, y: 5 } });
    const game = makeGame(st);
    const events = game.confirmTownExit(false);
    const prompt = events.find((e) => e.kind === "guard-tribute-prompt");
    expect(prompt?.charity).toBe(true);
    expect(prompt?.toll).toBeUndefined();
    // 'Y' → oro/2 (idiv, 0x021f-0x0225).
    game.resolveGuardTribute(true);
    expect(game.state.gold).toBe(50);
  });

  it("pagar con oro suficiente: cobra y NO arresta (ret 0, sin texto)", () => {
    const game = makeGame();
    game.confirmTownExit(false);
    const events = game.resolveGuardTribute(true);
    expect(game.state.gold).toBe(80); // 100 − 20 (0x029d sub g_gold)
    expect(kinds(events)).not.toContain("guard-arrest-prompt");
    expect(messages(events)).toEqual([]); // el binario sólo llama al jingle 0x6980
  });

  it("GOTCHA del testigo: aceptar SIN oro suficiente → arresto igualmente (ret 1)", () => {
    const game = makeGame(makeState({ gold: 11 })); // G:11 < 20, como el clip
    game.confirmTownExit(false);
    const events = game.resolveGuardTribute(true);
    expect(game.state.gold).toBe(11); // sin cobro (0x0295 jbe → 0x216)
    expect(kinds(events)).toContain("guard-arrest-prompt");
  });

  it("rehusar el pago → arresto (ret 1, TALK 0x028b)", () => {
    const game = makeGame();
    game.confirmTownExit(false);
    const events = game.resolveGuardTribute(false);
    expect(game.state.gold).toBe(100);
    expect(kinds(events)).toContain("guard-arrest-prompt");
  });

  it("guardia YA HOSTIL (aiType 7, tile 0x70): arresto DIRECTO sin demanda (rama 0x13a4)", () => {
    const game = makeGame(makeState(), 7);
    const events = game.confirmTownExit(false);
    expect(kinds(events)).toContain("guard-arrest-prompt");
    expect(kinds(events)).not.toContain("guard-tribute-prompt");
  });

  it("no dispara sin guardia adyacente (fast-path 0x0723 exige manhattan==1)", () => {
    const st = makeState();
    const game = new Game({} as ExtractedInitialState, makeWorld(), gameData, st, {
      npcManager: {
        setRng() {},
        enterMap() {},
        tick() {},
        npcsAt: () => [],
        npcAt: () => null,
      } as unknown as NpcManager,
    });
    const events = game.confirmTownExit(false);
    expect(kinds(events)).not.toContain("guard-tribute-prompt");
  });

  it("★ UNA demanda por entrada al pueblo: el despacho normaliza el aiType 4 → 1", () => {
    // ★ Este aserto ha estado invertido DOS veces, y conviene dejar la historia entera:
    //  (1) Originalmente afirmaba el limitador `npc.tributeDemanded` («1 por entrada de
    //      pueblo»), modelo conservador del ruling 2026-07-22 — sin derivar.
    //  (2) `tc-result-producer.md` lo dio la vuelta a «se REPITE cada turno» derivando el
    //      ciclo de los MARCADORES: `[0x65be]`/`[0x65bf]` se limpian en el prólogo de la
    //      pasada (NPC.OVL 0x0dc1/0x0dc6) y se re-arman en el fast-path — cierto, y de ahí
    //      «la condición se re-evalúa desde cero cada turno».
    //  (3) #304 lee el prólogo de `talk_converse_dispatch`, que ninguna de las dos miró:
    //          0350: cmp byte ptr [si], cl   ; cl = 4, si = &aiTypes[tramo]
    //          0354: mov byte ptr [si], 1
    //      La condición SÍ se re-evalúa desde cero — sobre un dato que el turno anterior
    //      mutó. El aiType 4 es lo que arma el fast-path (0x0728 `jle 3`); apagarlo desarma
    //      el disparador sin necesidad de ningún flag dedicado.
    // ⇒ el resultado OBSERVABLE coincide con (1), pero por un mecanismo derivado y no
    // inventado, y con el alcance exacto: la tabla 0x5d5e sólo recupera el 4 al recargar
    // el .NPC entrando al mapa (`NpcManager.enterMap`). Los 13 guardias de tributo de la
    // extracción son aiType 4 — ninguno 5, que es el que NO se normaliza (`cmp` con 4 es
    // igualdad). Acta: `re/notes/tienda-proximidad-304.md`.
    const game = makeGame(); // guardia adyacente al este
    const first = game.confirmTownExit(false);
    expect(kinds(first)).toContain("guard-tribute-prompt");
    game.resolveGuardTribute(true); // paga
    for (let i = 0; i < 3; i++) {
      expect(kinds(game.confirmTownExit(false))).not.toContain("guard-tribute-prompt");
    }
  });
});

describe("F2-T4 — arresto (TOWN 0x12ae rama pueblo)", () => {
  it("'Y' (come quietly): inconsciencia + despertar en la celda de Yew, llaves confiscadas, reloj a las 8", () => {
    const game = makeGame(makeState({ gold: 11 }));
    game.confirmTownExit(false);
    game.resolveGuardTribute(true); // sin oro → arresto
    const events = game.resolveGuardArrest(true);
    const texts = messages(events);
    expect(texts[0]).toBe("Yes\n\nThe guard strikes thee unconscious!\n"); // DS 0x281b
    expect(texts[1]).toBe("\nThou dost awaken to...\n"); // DS 0x2845
    expect(kinds(events)).toContain("map-changed");
    // Mutación TOWN 0x130e-0x1337:
    expect(game.state.position.location).toBe(LOC_YEW); // g_location=4
    expect(game.state.position.x).toBe(0x19);
    expect(game.state.position.y).toBe(4);
    expect(game.state.position.floor).toBe(0);
    expect(game.state.keys).toBe(0); // llaves CONFISCADAS (0x1332)
    expect(game.state.time.hour).toBe(8); // bucle advance_clock(0x14) hasta las 8
    expect(game.state.gold).toBe(11); // el oro NO se toca en el arresto
  });

  it("'N' (defend thyself): desafío + alarma del pueblo (TOWN 0x0958)", () => {
    const alarmCalls: number[] = [];
    const game = makeGame(makeState(), 4, alarmCalls);
    game.confirmTownExit(false);
    game.resolveGuardTribute(false);
    const events = game.resolveGuardArrest(false);
    expect(messages(events)[0]).toBe('No\n\n"Then defend thyself, rogue!"\n'); // DS 0x285e
    expect(alarmCalls).toEqual([TOWN]); // 0x1343 call 0x958
    // El party NO se mueve ni pierde nada.
    expect(game.state.position.location).toBe(TOWN);
    expect(game.state.keys).toBe(5);
  });

  it("resolver sin prompt armado es no-op idempotente", () => {
    const game = makeGame();
    expect(game.resolveGuardTribute(true)).toEqual([]);
    expect(game.resolveGuardArrest(true)).toEqual([]);
  });
});

describe("F2-T4 — alarma TOWN 0x0958 (NpcManager.arrestAlarm)", () => {
  const slot = (n: number, type: number, over: Partial<NpcSlot> = {}): NpcSlot => ({
    slot: n,
    aiTypes: [1, 1, 1],
    x: [3 + n, 3 + n, 3 + n],
    y: [4, 4, 4],
    z: [0, 0, 0],
    times: [8, 12, 18, 0],
    type,
    dialogNumber: 10 + n,
    ...over,
  });

  function managerWith(slots: NpcSlot[]): NpcManager {
    const m = new NpcManager({ [TOWN]: slots });
    m.enterMap(TOWN, makeState());
    return m;
  }

  it("guardias (tile 0x70): hostilidad permanente aiType 7 + horario borrado (0x085e)", () => {
    const m = managerWith([slot(1, 0x70, { dialogNumber: 0xff })]);
    m.arrestAlarm(TOWN, () => 0xff); // rand no se consume para guardias
    const g = m.npcsAt(TOWN, 0)[0]!;
    expect(g.aiTypes).toEqual([7, 7, 7]); // 0x70 >= 0x2f → 7
    expect(g.times).toEqual([0, 0, 0, 0]); // horario BORRADO (0x0890)
    expect(g.dialogNumber).toBe(0xff); // 0x085e no toca el diálogo
  });

  it("civil persona con rand<0x80: pánico dialog 0xFD + aiTypes [3,3,3] (0x08d4)", () => {
    const m = managerWith([slot(1, 0x50)]);
    m.arrestAlarm(TOWN, () => 0x10); // < 0x80 → entra
    const c = m.npcsAt(TOWN, 0)[0]!;
    expect(c.dialogNumber).toBe(0xfd); // «Don't hurt me!»
    expect(c.aiTypes).toEqual([3, 3, 3]);
  });

  it("civil con rand>=0x80: intacto (0x099c jge skip); no-persona: intacto aunque rand<0x80", () => {
    const m = managerWith([slot(1, 0x50), slot(2, 0x20)]);
    const rolls: number[] = [];
    m.arrestAlarm(TOWN, () => {
      rolls.push(1);
      return rolls.length === 1 ? 0xc0 : 0x10;
    });
    const [c1, c2] = m.npcsAt(TOWN, 0);
    expect(c1!.dialogNumber).toBe(11); // rand 0xc0 >= 0x80 → intacto
    expect(c2!.dialogNumber).toBe(12); // tile 0x20 ∉ [0x40,0x74) → intacto
    expect(rolls.length).toBe(2); // 1 rand por slot no-guardia SIEMPRE (stream)
  });
});
