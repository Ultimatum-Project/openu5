/**
 * `g_time_spell` (DS 0x587a) es UN SOLO BYTE — y el port lo tenía partido en tres.
 *
 * DERIVACIÓN (censo POR BYTES del par `7a 58` sobre los 24 ficheros de código, con el
 * disasm re-sincronizado en cada candidato): **9 escrituras reales y 33 lecturas**, y
 * las lecturas comparan el MISMO byte contra valores mutuamente excluyentes:
 *
 *   0x1d  Black Badge PUESTA   TALK.OVL 0x02a4   (el gate del password del Palacio)
 *   0x0e  Amuleto de LB        MAINOUT.OVL 0x0a31
 *   'T' 0x54 · 'Q' 0x51 · 'N' 0x4e · 'C' 0x43 · 'P' 0x50 · 0x1c   (efectos temporales)
 *   0     ninguno              ULTIMA.EXE 0x29ff
 *
 * Escritores: CAST.OVL 0x1b47 (`= 0x1d`, (U)se Badge) · CAST.OVL 0x0da4 (`= 0x54`) ·
 * CAST.OVL 0x177d / CAST2.OVL 0x08fe / CMDS.OVL 0x001f / SHOPPES3.OVL 0x08e5 /
 * BLCKTHRN.OVL 0x0c25 (`= al`) · ULTIMA.EXE 0x2bc2 y SJOG.OVL 0x2032 (`= 0`, limpian).
 *
 * ⇒ **No hay tres estados: hay UNO.** Escribir un efecto temporal PISA la insignia, y
 * ponerse la insignia PISA el efecto. El port modelaba `wornBadge` + `wornAmulet` +
 * `timeSpell` independientes, lo que permite estados que el binario no puede tener.
 *
 * Inocuo hasta T-A; estructural desde T-A: con la insignia puesta la intercepción RETA
 * el password (TALK 0x02a4), así que un jugador con insignia + Quickness casteado tiene
 * en el binario `g_time_spell = 'Q'` ≠ 0x1d ⇒ CAPTURA SILENCIOSA, y en el port ⇒ reto.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, GameState } from "../src/core/state.js";
import { guardDemand, TIME_SPELL_BADGE } from "../src/core/world/blackthorn.js";
import { useBlackBadge } from "../src/core/endgame/use-tools.js";
import type { UseToolsCtx } from "../src/core/endgame/use-tools.js";
import { serialize, deserialize } from "../src/core/state.js";

function makeChar(): CharacterState {
  return {
    name: "Avatar", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  return {
    version: 1,
    characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 100, keys: 5, gems: 3, torches: 2,
    equipmentQuantities: Array.from({ length: 48 }, () => 0),
    karma: 40,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: 0x12, floor: 0, x: 5, y: 5 },
    transport: "foot", torchTurns: 3, prevHour: 8,
    ...over,
  } as GameState;
}

const ctxOf = (state: GameState): UseToolsCtx => ({ state }) as unknown as UseToolsCtx;

describe("g_time_spell es UN byte: la exclusión mutua (DS 0x587a)", () => {
  it("★ castear un efecto temporal PISA la insignia (CAST 0x177d escribe el MISMO byte)", () => {
    const s = makeState();
    useBlackBadge(ctxOf(s)); // (U)se Badge → 0x1d
    expect(s.timeSpell).toBe(TIME_SPELL_BADGE);
    s.timeSpell = "Q"; // Quickness (cast.ts:234) — el binario escribe 0x51 en 0x587a
    // Con el byte a 'Q' el gate del Palacio (0x02a4 cmp 0x1d) FALLA: ret 1 silencioso.
    expect(guardDemand(s, "IMPE", false).ret).toBe(1);
  });

  it("★ ponerse la insignia PISA el efecto temporal (la otra dirección)", () => {
    const s = makeState({ timeSpell: "Q", timeSpellTurns: 10 });
    useBlackBadge(ctxOf(s));
    expect(s.timeSpell).toBe(TIME_SPELL_BADGE);
    expect(guardDemand(s, "IMPE", false).ret).toBe(0); // ya hay insignia: el password abre
  });

  it("quitarse la insignia deja el byte a «ninguno», no a un efecto anterior", () => {
    const s = makeState();
    useBlackBadge(ctxOf(s)); // puesta
    useBlackBadge(ctxOf(s)); // quitada (toggle 0x1764)
    expect(s.timeSpell).toBeFalsy();
    expect(guardDemand(s, "IMPE", false).ret).toBe(1);
  });

  it("★ la insignia SOBREVIVE a save/load — es un byte de la ventana, no runtime", () => {
    // El defecto que la unificación repara de paso: `wornBadge` era un booleano que
    // saveNative NUNCA escribía, así que salvar con la insignia puesta y recargar la
    // perdía. `g_time_spell` sí viaja en el save.
    const s = makeState();
    useBlackBadge(ctxOf(s));
    const reloaded = deserialize(serialize(s));
    expect(reloaded.timeSpell).toBe(TIME_SPELL_BADGE);
    expect(guardDemand(reloaded, "IMPE", false).ret).toBe(0);
  });

  it("la insignia es PERMANENTE (turnos 0xff): el decay no la puede borrar", () => {
    const s = makeState();
    useBlackBadge(ctxOf(s));
    expect(s.timeSpellTurns).toBe(0xff);
  });
});
