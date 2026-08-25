/**
 * CallGuards (op 0x8B) — el EFECTO, no solo el outcome (carril blackthorn-callguards,
 * reporte del usuario 25-08: respondió NO a la Opresión, Blackthorn amenazó… «y no
 * pasó nada»).
 *
 * DERIVACIÓN (verificada en crudo):
 *  - TALK.OVL 0x0ff8 `call 0xffffbb56` [= CS 0x7ad6 → TOWN.OVL 0x0958
 *    `town_alarm_all_npcs`, banda near_call_base 0xbf80] y 0x0ffb `jmp 0xf5e`:
 *    la charla SIGUE — el cierre lo pone el EndConversation del guion.
 *  - TOWN 0x0958 (§9.bis npc.md, leída entera): guardias {0xfc,0xd8,0x70} →
 *    0x085e aiType 6/7 HOSTIL + horario borrado; cada NPC normal presente →
 *    1 rand(0,255) SIEMPRE y con r<0x80 → 0x08d4 aiType 3 + dialog 0xFD.
 *  - SIN print (los 99 bytes no llaman a imprimir): el silencio del port era fiel;
 *    lo mudo era el EFECTO — `case "callGuards"` devolvía `{[], false}` pelado.
 *    `arrestAlarm` ya estaba portada y cableada desde el (A)ttack de pueblo
 *    (TOWN 0x0b05) y desde la rama 'N' del arresto (TOWN 0x1343); ESTA es la
 *    tercera vía CABLEADA EN EL PORT (el censo completo de llamantes, near y far,
 *    en el docstring de `Game.talkCallGuards`). La amenaza del trono era prosa hueca.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import type { NpcManager } from "../src/core/npc/manager.js";
import { applyDialogueEffect } from "../src/core/dialogue/effects.js";

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Avatar",
    gender: 0x0b,
    class: "A",
    status: "G",
    strength: 15,
    dexterity: 15,
    intelligence: 15,
    currentMp: 0,
    currentHp: 30,
    maxHp: 30,
    exp: 0,
    level: 1,
    monthsAtInn: 0,
    helmet: 0xff,
    armor: 0xff,
    weapon: 0xff,
    shield: 0xff,
    ring: 0xff,
    amulet: 0xff,
    partyStatus: 0,
    ...over,
  } as CharacterState;
}

function makeState(): GameState {
  return {
    version: 1,
    gold: 100,
    keys: 0,
    karma: 50,
    food: 100,
    partySize: 1,
    characters: [makeChar()],
    position: { location: 0x12, floor: 0, x: 15, y: 15 }, // el Palacio (loc 18)
    transport: "foot",
    time: { year: 139, month: 1, day: 1, hour: 12, minute: 0 },
    equipmentQuantities: [],
  } as unknown as GameState;
}

describe("el efecto callGuards SEÑALA la alarma (núcleo puro)", () => {
  it("sigue silencioso y sin cerrar (fiel), y ahora lleva alarm:true", () => {
    const s = makeState();
    const r = applyDialogueEffect(s, { kind: "callGuards" }, "");
    expect(r.messages).toEqual([]); // cero prints en TOWN 0x0958 — el silencio era fiel
    expect(r.ended).toBe(false); // 0x0ffb jmp 0xf5e: la charla sigue
    expect(r.alarm).toBe(true); // la mitad que faltaba: el op HACE algo
  });

  it("los demás efectos NO llevan alarm (la señal es de callGuards, no de la clase)", () => {
    const s = makeState();
    expect(applyDialogueEffect(s, { kind: "karma", delta: 1 }, "").alarm).toBeUndefined();
    expect(applyDialogueEffect(s, { kind: "end" }, "").alarm).toBeUndefined();
    expect(applyDialogueEffect(s, { kind: "gold", amount: 5 }, "").alarm).toBeUndefined();
  });
});

describe("Game.talkCallGuards — el TERCER llamante de TOWN 0x0958", () => {
  it("dispara arrestAlarm sobre la localización VIVA de la party", () => {
    const s = makeState();
    const alarmCalls: number[] = [];
    const manager = {
      setRng() {},
      enterMap() {},
      tick() {},
      arrestAlarm(loc: number) {
        alarmCalls.push(loc);
      },
      npcsAt: () => [],
      npcAt: () => null,
    } as unknown as NpcManager;
    const world = {
      overworld: [[5]],
      underworld: [[5]],
      smallMaps: new Map(),
    } as unknown as WorldData;
    const gameData = {
      locationsX: Array.from({ length: 32 }, () => 100),
      locationsY: Array.from({ length: 32 }, () => 100),
      locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
    } as GameData;
    const game = new Game({} as ExtractedInitialState, world, gameData, s, {
      npcManager: manager,
    });
    game.talkCallGuards();
    expect(alarmCalls).toEqual([0x12]); // la alarma suena EN el Palacio, una vez
    // Y en otra localización, suena allí (la posición se lee VIVA, no cacheada).
    s.position.location = 5;
    game.talkCallGuards();
    expect(alarmCalls).toEqual([0x12, 5]);
  });
});
