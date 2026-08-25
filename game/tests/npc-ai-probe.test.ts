/**
 * Testigo de la SONDA de alcanzabilidad (`core/npc/ai-probe.ts`).
 *
 * La sonda existe para separar dos cosas que un sello intacto no distingue: que el camino
 * de un aiType se ejecutara y fuera inocuo, o que no se ejecutara nunca. Si la propia sonda
 * pudiera dar cero por estar mal cableada, reproduciría exactamente el fallo que viene a
 * medir — un cero que se lee como «no se alcanzó» cuando significa «no se contó».
 * Por eso el caso ARMADO se asevera con cifra exacta, no con `> 0`.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as sonda from "../src/core/npc/ai-probe.js";
import { NpcManager, type NpcRuntime } from "../src/core/npc/manager.js";
import { DoorManager } from "../src/core/world/doors.js";
import type { GameState } from "../src/core/state.js";
import type { WorldData } from "../src/core/world/map.js";

const LOC = 4;

function grassSmall(): WorldData {
  const floor = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  const ow = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return {
    overworld: ow,
    underworld: ow,
    smallMaps: new Map([[LOC, { id: LOC, name: "T", floors: [{ z: 0, tiles: floor }] }]]),
  } as unknown as WorldData;
}

function mkState(px: number, py: number): GameState {
  return {
    position: { location: LOC, floor: 0, x: px, y: py },
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    characters: [],
    partySize: 1,
  } as unknown as GameState;
}

function mkNpc(aiType: number, nx: number, ny: number): NpcRuntime {
  return {
    slot: 1,
    location: LOC,
    type: 1,
    dialogNumber: 0,
    aiTypes: [aiType, aiType, aiType],
    schedX: [nx, nx, nx],
    schedY: [ny, ny, ny],
    schedZ: [0, 0, 0],
    times: [0, 0, 0, 0],
    x: nx,
    y: ny,
    z: 0,
    // #84: el pestillo horario vive en el runtime — el fixture lo trae CERRADO
    // (estado 1, ranura 0 servida) para que el tick caiga en la IA, que es lo
    // que estos tests miden. times=[0,0,0,0] + hora 12 ⇒ check_schedule devuelve
    // 0 (ninguna ranura arranca a las 12) y la IA corre como antes de #84.
    state: 1,
    servedSlot: 0,
    pathBuf: new Array(32).fill(0),
    pathIdx: -1,
    stuck: 0,
  } as NpcRuntime;
}

function tick(aiType: number, npcXY: [number, number], partyXY: [number, number]): void {
  const mgr = new NpcManager({});
  const npc = mkNpc(aiType, npcXY[0], npcXY[1]);
  (mgr as unknown as { npcs: Map<number, NpcRuntime[]> }).npcs = new Map([[LOC, [npc]]]);
  mgr.tick(mkState(partyXY[0], partyXY[1]), grassSmall(), new DoorManager());
}

const FLAG = "__U5_AI_PROBE";
const g = globalThis as Record<string, unknown>;

beforeEach(() => {
  delete g[FLAG];
  sonda.reinicia();
});
afterEach(() => {
  delete g[FLAG];
  sonda.reinicia();
});

describe("sonda de alcanzabilidad de aiType", () => {
  it("APAGADA por defecto: no cuenta nada aunque el camino se ejecute", () => {
    expect(sonda.activa()).toBe(false);
    tick(4, [12, 10], [10, 10]); // party a 2 ⇒ el camino divergente SÍ se ejecuta
    const v = sonda.volcado();
    expect(v.alcanzado[4], "apagada no debe contar").toBe(0);
    expect(v.divergente[4], "apagada no debe contar").toBe(0);
  });

  it("ARMADA: cuenta alcance Y divergencia con la puerta abierta", () => {
    g[FLAG] = true;
    tick(4, [12, 10], [10, 10]); // Manhattan 2 < 4 ⇒ puerta abierta
    const v = sonda.volcado();
    expect(v.alcanzado[4]).toBe(1);
    expect(v.divergente[4], "la puerta abierta ES la divergencia").toBe(1);
  });

  it("🔴 ARMADA y puerta CERRADA: alcanzado 1, divergente 0 — la distinción que da sentido a la sonda", () => {
    g[FLAG] = true;
    tick(4, [16, 10], [10, 10]); // Manhattan 6 ⇒ wander, huir y perseguir son indistinguibles
    const v = sonda.volcado();
    expect(v.alcanzado[4], "el NPC recibió su turno").toBe(1);
    expect(v.divergente[4], "pero el sello NO habría sido evidencia").toBe(0);
  });

  it("los aiType SIN puerta (5 y 7) divergen en cuanto actúan", () => {
    g[FLAG] = true;
    tick(7, [20, 20], [10, 10]); // lejísimos: da igual, 0x0D91 no tiene puerta
    const v = sonda.volcado();
    expect(v.alcanzado[7]).toBe(1);
    expect(v.divergente[7]).toBe(1);
  });

  it("no contamina otros aiType", () => {
    g[FLAG] = true;
    tick(4, [12, 10], [10, 10]);
    const v = sonda.volcado();
    for (const t of [0, 1, 2, 3, 5, 6, 7]) {
      expect(v.alcanzado[t], `aiType ${t} no debe moverse`).toBe(0);
      expect(v.divergente[t], `aiType ${t} no debe moverse`).toBe(0);
    }
  });
});
