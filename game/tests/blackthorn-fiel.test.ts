/**
 * T-A + T-B + F2-T4 — el calcado FIEL del sistema de guardias, tras la derivación
 * de `re/notes/tc-result-producer.md` (T-C).
 *
 * Las tres mecánicas que esta suite fija, y su cita:
 *
 *  · **T-A — el reto de password vive en la INTERCEPCIÓN, no sólo en (T)alk.** La
 *    vía de captura ejecuta `guard_demand` (TALK 0x01e2) entera, gate de insignia
 *    incluido (0x02a4 `cmp [g_time_spell],0x1d`). Sin insignia → `jmp 0x216`,
 *    ret 1 SILENCIOSO → captura. CON insignia → imprime el reto (0x02ae) y hace
 *    `getstring` (0x02d2) EN LA INTERCEPCIÓN; acierto → ret 0, ese turno no hay
 *    captura; fallo → ret 1 → 0x12ae.
 *
 *  · **T-B — no hay pase persistente.** En los 0x13b bytes de TALK 0x01e2 las
 *    únicas escrituras de estado global son `g_gold` (0x0225, 0x029d). Ni un flag.
 *    «Pass, friend!» (DS 0x913a → `jmp 0x22b`, `sub ax,ax`) sólo devuelve 0 para
 *    ESA interacción: el turno siguiente, con el guardia todavía pegado, la pasada
 *    de NPCs vuelve a armar `[0x65bf]` y el reto se repite.
 *
 *  · **F2-T4 — la demanda no tiene limitador, y el desempate es por índice MAYOR.**
 *    `[0x65bf]`/`[0x65be]` se limpian en el prólogo de la pasada de NPCs
 *    (NPC.OVL 0x0dc1/0x0dc6) y se re-arman en el fast-path de adyacencia
 *    (0x0746/0x074e) — vida de UN turno. El bucle recorre idx ascendente 1..0x1f y
 *    cada fast-path PISA la global, así que con varios candidatos adyacentes gana
 *    el de índice MAYOR. El fast-path de aiType 4/5 exige además `dlgNum != 0`
 *    (0x0740); el de 6/7 no.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData, type GameEvent } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import type { NpcManager, NpcRuntime } from "../src/core/npc/manager.js";
import { LOC_BLACKTHORN, PALACE_GUARD_TYPE , TIME_SPELL_BADGE} from "../src/core/world/blackthorn.js";

const BT = LOC_BLACKTHORN; // 0x12
const TOWN = 6; // un pueblo cualquiera != 0x12 y != Minoc

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar({ name: "Avatar" })],
    partySize: 1,
    activeCharacter: 0,
    food: 100, gold: 100, keys: 5, gems: 3, torches: 2,
    equipmentQuantities: Array.from({ length: 48 }, () => 0),
    karma: 40,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: BT, floor: 0, x: 5, y: 5 },
    transport: "foot",
    torchTurns: 3,
    prevHour: 8,
    shrineDestroyed: undefined,
  };
  return { ...base, ...over } as GameState;
}

function makeLocation(id: number, name: string): SmallMapLocation {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  return { id, name, floors: [{ z: 0, tiles }, { z: 1, tiles }, { z: 2, tiles }] };
}

function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return {
    overworld,
    underworld: overworld,
    smallMaps: new Map([
      [BT, makeLocation(BT, "Palace of Blackthorn")],
      [TOWN, makeLocation(TOWN, "Town")],
    ]),
  };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 100),
  locationsY: Array.from({ length: 32 }, () => 100),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
  shrines: {
    virtues: ["Honesty", "Compassion", "Valour", "Justice", "Sacrifice", "Honor", "Spirituality", "Humility"],
    mantras: ["Ahm", "Mu", "Ra", "Beh", "Cah", "Summ", "Om", "Lum"],
    shrineX: Array.from({ length: 8 }, () => 0),
    shrineY: Array.from({ length: 8 }, () => 0),
  },
};

interface GuardSpec {
  slot: number;
  dx: number;
  dy?: number;
  ai?: number;
  dialogNumber?: number;
  type?: number;
}

/** Manager mínimo: N NPCs colocados relativos al party, devueltos por slot ASCENDENTE. */
function managerWith(s: GameState, specs: GuardSpec[]): NpcManager {
  const npcs = specs.map(
    (g) =>
      ({
        slot: g.slot,
        type: g.type ?? PALACE_GUARD_TYPE,
        dialogNumber: g.dialogNumber ?? 0xff,
        x: s.position.x + g.dx,
        y: s.position.y + (g.dy ?? 0),
        z: s.position.floor,
        aiTypes: [g.ai ?? 4, g.ai ?? 4, g.ai ?? 4, g.ai ?? 4],
        times: [0, 0, 0, 0],
      }) as unknown as NpcRuntime,
  );
  const sorted = [...npcs].sort((a, b) => a.slot - b.slot);
  return {
    setRng() {}, enterMap() {}, tick() {}, arrestAlarm() {},
    npcsAt: (loc: number, floor: number) =>
      loc === s.position.location && floor === s.position.floor ? sorted : [],
    npcAt: (loc: number, floor: number, x: number, y: number) =>
      loc === s.position.location && floor === s.position.floor
        ? (sorted.find((n) => n.x === x && n.y === y) ?? null)
        : null,
  } as unknown as NpcManager;
}

function makeGame(s: GameState, mgr: NpcManager): Game {
  return new Game({} as ExtractedInitialState, makeWorld(), gameData, s, { npcManager: mgr });
}

const kinds = (evs: GameEvent[]): string[] => evs.map((e) => e.kind);
const has = (evs: GameEvent[], kind: string): boolean => kinds(evs).includes(kind);

// ---------------------------------------------------------------------------
// T-A — el reto de password EN LA INTERCEPCIÓN
// ---------------------------------------------------------------------------
describe("T-A — la intercepción ejecuta guard_demand entero (TALK 0x01e2)", () => {
  it("SIN insignia, guardia adyacente → captura DIRECTA y SILENCIOSA (0x02a4 → jmp 0x216)", () => {
    const s = makeState({ timeSpell: undefined });
    const game = makeGame(s, managerWith(s, [{ slot: 8, dx: 1 }]));
    const evs = game.confirmTownExit(false);
    expect(has(evs, "blackthorn-guard-password-prompt")).toBe(false);
    expect(has(evs, "blackthorn-interrogation-prompt")).toBe(true);
  });

  it("CON insignia, guardia adyacente → RETA el password en vez de capturar (0x02ae/0x02d2)", () => {
    const s = makeState({ timeSpell: TIME_SPELL_BADGE });
    const game = makeGame(s, managerWith(s, [{ slot: 8, dx: 1 }]));
    const evs = game.confirmTownExit(false);
    expect(has(evs, "blackthorn-guard-password-prompt")).toBe(true);
    expect(has(evs, "blackthorn-interrogation-prompt")).toBe(false);
  });

  it("password CORRECTO en la intercepción → ret 0: ese turno NO hay captura", () => {
    const s = makeState({ timeSpell: TIME_SPELL_BADGE });
    const game = makeGame(s, managerWith(s, [{ slot: 8, dx: 1 }]));
    game.confirmTownExit(false);
    const evs = game.submitGuardPassword("IMPE");
    expect(has(evs, "blackthorn-interrogation-prompt")).toBe(false);
    expect(s.keys).toBe(5); // la captura confisca las llaves (0x08f6): no ha corrido
  });

  it("password ERRÓNEO en la intercepción → ret 1: ESCALA a captura (0x12ae)", () => {
    const s = makeState({ timeSpell: TIME_SPELL_BADGE });
    const game = makeGame(s, managerWith(s, [{ slot: 8, dx: 1 }]));
    game.confirmTownExit(false);
    const evs = game.submitGuardPassword("XXXX");
    expect(has(evs, "blackthorn-interrogation-prompt")).toBe(true);
  });

  it("el truncado a 4 chars (0x02dc buf[4]=0) también vale en la intercepción", () => {
    const s = makeState({ timeSpell: TIME_SPELL_BADGE });
    const game = makeGame(s, managerWith(s, [{ slot: 8, dx: 1 }]));
    game.confirmTownExit(false);
    expect(has(game.submitGuardPassword("IMPERIAL"), "blackthorn-interrogation-prompt")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-B — NO hay pase persistente
// ---------------------------------------------------------------------------
describe("T-B — el binario no escribe pase alguno: re-reta cada intercepción", () => {
  it("acertar el password NO concede pase: el turno siguiente RE-RETA", () => {
    const s = makeState({ timeSpell: TIME_SPELL_BADGE });
    const game = makeGame(s, managerWith(s, [{ slot: 8, dx: 1 }]));
    game.confirmTownExit(false);
    game.submitGuardPassword("IMPE"); // ret 0 — sin captura ESTE turno
    const next = game.confirmTownExit(false); // turno siguiente, guardia aún pegado
    expect(has(next, "blackthorn-guard-password-prompt")).toBe(true);
  });

  it("acertar NO escribe ningún flag de pase en el estado", () => {
    const s = makeState({ timeSpell: TIME_SPELL_BADGE });
    const game = makeGame(s, managerWith(s, [{ slot: 8, dx: 1 }]));
    game.confirmTownExit(false);
    game.submitGuardPassword("IMPE");
    expect((s as unknown as Record<string, unknown>).blackthornPassGranted).toBeUndefined();
  });

  it("un `blackthornPassGranted` HEREDADO de un save viejo ya no suprime la captura", () => {
    // Mutación real: bajo el modelo retirado este estado NO capturaba; ahora sí.
    const s = makeState({ timeSpell: undefined });
    (s as unknown as Record<string, unknown>).blackthornPassGranted = true;
    const game = makeGame(s, managerWith(s, [{ slot: 8, dx: 1 }]));
    expect(has(game.confirmTownExit(false), "blackthorn-interrogation-prompt")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// F2-T4 — el mecanismo REAL de la demanda de tributo
// ---------------------------------------------------------------------------
describe("F2-T4 — demanda sin limitador, vida de un turno, desempate por índice MAYOR", () => {
  const townState = (over: Partial<GameState> = {}): GameState =>
    makeState({ position: { location: TOWN, floor: 0, x: 5, y: 5 }, gold: 100, ...over });

  it("guardia adyacente en pueblo → demanda SIN necesidad de encender ningún flag", () => {
    const s = townState();
    const game = makeGame(s, managerWith(s, [{ slot: 8, dx: 1, ai: 4 }]));
    expect(has(game.confirmTownExit(false), "guard-tribute-prompt")).toBe(true);
  });

  it("★ pagar y seguir pegado NO vuelve a demandar: el aiType 4 quedó normalizado a 1", () => {
    // 🔴 ESTE ASERTO ESTABA INVERTIDO, y por segunda vez. Afirmaba «vuelve a demandar al
    // turno siguiente» citando `tc-result-producer.md` §2/§5 («no hay limitador en NINGUNA
    // capa»). Esa acta derivó bien los MARCADORES —`[0x65be]`/`[0x65bf]` se limpian en el
    // prólogo de la pasada (NPC.OVL 0x0dc1/0x0dc6) y no persisten— y de ahí concluyó que la
    // condición del fast-path «se re-evalúa entera, desde cero, en cada pasada».
    //
    // Se re-evalúa, sí. Pero sobre un dato que el turno anterior MUTÓ. El prólogo de
    // `talk_converse_dispatch` (TALK 0x0348-0x0354, ANTES del reparto por dlgNum) hace:
    //     0350: cmp byte ptr [si], cl   ; cl = 4, si = &aiTypes[tramo] (0x5d5e + idx*16)
    //     0354: mov byte ptr [si], 1    ; el 4 pasa a 1 EN LA TABLA VIVA
    // y el 4 es justo lo que arma el fast-path (NPC.OVL 0x0728 `cmp [bp-2],3 / jle`).
    // ⇒ el guardia demanda UNA vez y deja de armar. No es un limitador dedicado —el acta
    // acierta en que no existe ninguno— es que uno de los tres conjuntos de la condición
    // deja de cumplirse porque el propio despacho lo apagó.
    //
    // El acta NO leyó ese prólogo: censo con control positivo sobre `tc-result-producer.md`
    // = CERO menciones de 0x034x/0x035x, con el mismo patrón encontrando otras tres 0x03xx.
    // Quien sí lo leyó es `talk-031e-resolucion.md:24` («si el byte de aiType == 4 → lo
    // normaliza a 1»), que leyó 0x031E ENTERA — dos actas del corpus en contradicción, y
    // la que se cae es la que no abrió la rutina que nombra.
    //
    // ALCANCE: dura lo que dura la visita. La tabla 0x5d5e es estado vivo (la escriben
    // además CMDS 0x116c y TOWN 0x03d8 con 6, SJOG 0x0eb5 con 5) y NADIE vuelve a escribir
    // un 4: sólo la recarga del .NPC al entrar al mapa lo restaura — que es exactamente lo
    // que hace `NpcManager.enterMap` con su `aiTypes: [...s.aiTypes]`. O sea: UNA demanda
    // por guardia y por ENTRADA AL PUEBLO. Derivación entera en `tienda-proximidad-304.md`.
    const s = townState();
    const game = makeGame(s, managerWith(s, [{ slot: 8, dx: 1, ai: 4 }]));
    expect(has(game.confirmTownExit(false), "guard-tribute-prompt")).toBe(true);
    game.resolveGuardTribute(true); // paga: ret 0
    expect(has(game.confirmTownExit(false), "guard-tribute-prompt")).toBe(false);
  });

  it("con DOS guardias adyacentes gana el de índice MAYOR (0x074e pisa la global)", () => {
    const s = townState();
    // slot 8 = tributo (ai 4); slot 12 = hostil (ai 6) → debe ganar el 12 → arresto
    const game = makeGame(s, managerWith(s, [
      { slot: 8, dx: 1, ai: 4 },
      { slot: 12, dx: -1, ai: 6 },
    ]));
    const evs = game.confirmTownExit(false);
    expect(has(evs, "guard-arrest-prompt")).toBe(true);
    expect(has(evs, "guard-tribute-prompt")).toBe(false);
  });

  it("un NPC normal de índice MAYOR ABSORBE el slot y suprime la demanda del guardia", () => {
    const s = townState();
    // slot 20: aiType 4, dlgNum normal (no 0xFF) → arma [0x65bf] y NO demanda.
    const game = makeGame(s, managerWith(s, [
      { slot: 8, dx: 1, ai: 4 },
      { slot: 20, dx: -1, ai: 4, dialogNumber: 3, type: 0x0a },
    ]));
    const evs = game.confirmTownExit(false);
    expect(has(evs, "guard-tribute-prompt")).toBe(false);
    expect(has(evs, "guard-arrest-prompt")).toBe(false);
  });

  it("aiType 4/5 con dlgNum 0 NO arma el fast-path (0x0740 `cmp [bx+0xa],0 / je`)", () => {
    const s = townState();
    const game = makeGame(s, managerWith(s, [{ slot: 8, dx: 1, ai: 4, dialogNumber: 0 }]));
    const evs = game.confirmTownExit(false);
    expect(has(evs, "guard-tribute-prompt")).toBe(false);
  });

  it("manhattan != 1 no arma nada (0x0723 `cmp ax,1 / jne`)", () => {
    const s = townState();
    const game = makeGame(s, managerWith(s, [{ slot: 8, dx: 1, dy: 1, ai: 4 }]));
    expect(has(game.confirmTownExit(false), "guard-tribute-prompt")).toBe(false);
  });

  it("`guardTributeTrigger` ya no se exporta como gate (el limitador no existía)", async () => {
    const mod = (await import("../src/core/world/blackthorn.js")) as Record<string, unknown>;
    expect(mod.guardTributeTrigger).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// §6 APROBADO — la vía (T)alk también arresta al fallar el password
// ---------------------------------------------------------------------------
describe("(T)alk fallado → arresto (result==2, ruling del lead 2026-07-30)", () => {
  it("fallar el password hablando con el guardia ESCALA a la escena de captura", () => {
    const s = makeState({ timeSpell: TIME_SPELL_BADGE });
    const game = makeGame(s, managerWith(s, [{ slot: 8, dx: 1 }]));
    expect(game.tryTalkGuard("east")).not.toBeNull();
    const evs = game.submitGuardPassword("XXXX");
    expect(has(evs, "blackthorn-interrogation-prompt")).toBe(true);
  });

  it("acertar por (T)alk NO escala (ret 0 → el dispatcher deja result en 1)", () => {
    const s = makeState({ timeSpell: TIME_SPELL_BADGE });
    const game = makeGame(s, managerWith(s, [{ slot: 8, dx: 1 }]));
    game.tryTalkGuard("east");
    const evs = game.submitGuardPassword("IMPE");
    expect(has(evs, "blackthorn-interrogation-prompt")).toBe(false);
    expect(kinds(evs)).toContain("message");
  });

  it("la escalada de (T)alk pasa por el gate de 0x12ae: party TODO muerto ⇒ sin captura", () => {
    // TOWN 0x12c0/0x12c5: `party_conscious_state >= 0`. Con todos muertos (-1) la
    // rutina NO captura (esa rama es el refuge, 0x1436), aunque el reto se falle.
    const s = makeState({
      timeSpell: TIME_SPELL_BADGE,
      characters: [makeChar({ name: "Avatar", status: "D", currentHp: 0 })],
      partySize: 1,
    });
    const game = makeGame(s, managerWith(s, [{ slot: 8, dx: 1 }]));
    game.tryTalkGuard("east");
    const evs = game.submitGuardPassword("XXXX");
    expect(has(evs, "blackthorn-interrogation-prompt")).toBe(false);
  });

  it("sin insignia el (T)alk no arma reto, así que no hay nada que fallar ni escalar", () => {
    const s = makeState({ timeSpell: undefined });
    const game = makeGame(s, managerWith(s, [{ slot: 8, dx: 1 }]));
    expect(game.tryTalkGuard("east")).toEqual([]);
    expect(game.submitGuardPassword("XXXX")).toEqual([]);
  });
});
