/**
 * aiType 6 — el binario PERSIGUE, el clon HUÍA (#52).
 *
 * `NPC.OVL:0x0d30` (tabla de salto, base del overlay 0xA290) manda el aiType 6 al
 * handler `0x0D76`, el MISMO del 3. Pero el handler compartido sólo aporta el gate de
 * distancia (`0x0d8c cmp ax,4 / jge` = actuar si Manhattan al party < 4); dentro de
 * `0x06e4`, `0x0824 cmp [bp-2],3 / jne 0x884` reserva la rama de HUIDA para el 3 y manda
 * al 6 a `0x0884`, cuyo criterio (`0x088a cmp [bx],ax / 0x088c jge skip`) adopta la
 * puntuación MENOR = ACERCARSE.
 *
 * El clon trataba el 6 como `AI_RUN_AWAY_2` y llamaba a `fleeStep`: los NPC que lo
 * llevan —ratas, murciélagos, un espectro y un guardia armado— HUÍAN del Avatar.
 * Derivación y las tres vías en re/notes/npc-aitype6-persigue.md.
 */
import { describe, it, expect } from "vitest";
import { NpcManager, type NpcRuntime } from "../src/core/npc/manager.js";
import { DoorManager } from "../src/core/world/doors.js";
import type { GameState } from "../src/core/state.js";
import type { WorldData } from "../src/core/world/map.js";

/** Mapa pequeño 32×32 todo hierba (tile 5, transitable a pie). */
function grassSmall(location: number): WorldData {
  const floor = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return {
    overworld,
    underworld: overworld,
    smallMaps: new Map([
      [location, { id: location, name: "T", floors: [{ z: 0, tiles: floor }] }],
    ]),
  } as unknown as WorldData;
}

const LOC = 4;

function mkState(px: number, py: number): GameState {
  return {
    position: { location: LOC, floor: 0, x: px, y: py },
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    characters: [],
    partySize: 1,
  } as unknown as GameState;
}

/** Un NPC en (nx,ny) con el aiType dado en las tres ranuras de horario. */
function mkNpc(aiType: number, nx: number, ny: number): NpcRuntime {
  return {
    slot: 1,
    location: LOC,
    type: 144, // rata gigante — uno de los tipos que llevan aiType 6 en los datos
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

/** Corre un tick y devuelve la posición resultante del NPC. */
function tickOnce(aiType: number, npcXY: [number, number], partyXY: [number, number]) {
  const world = grassSmall(LOC);
  const state = mkState(partyXY[0], partyXY[1]);
  const mgr = new NpcManager({});
  const npc = mkNpc(aiType, npcXY[0], npcXY[1]);
  (mgr as unknown as { npcs: Map<number, NpcRuntime[]> }).npcs = new Map([[LOC, [npc]]]);
  mgr.tick(state, world, new DoorManager());
  return { x: npc.x, y: npc.y };
}

const dist = (a: { x: number; y: number }, b: [number, number]): number =>
  Math.abs(a.x - b[0]) + Math.abs(a.y - b[1]);

describe("aiType 6 PERSIGUE (NPC.OVL:0x0884), no huye", () => {
  it("con el party a Manhattan 2, el NPC se ACERCA", () => {
    const party: [number, number] = [10, 10];
    const antes: [number, number] = [12, 10]; // dist 2 (< 4 ⇒ el gate deja actuar)
    const pos = tickOnce(6, antes, party);
    // ← ESTE es el aserto que cae con el clon viejo: huía, así que la distancia SUBÍA.
    expect(dist(pos, party)).toBe(1);
    expect(pos).toEqual({ x: 11, y: 10 });
  });

  it("CONTRASTE — el aiType 3 con el mismo escenario se ALEJA (la huida de verdad)", () => {
    const party: [number, number] = [10, 10];
    const pos = tickOnce(3, [12, 10], party);
    expect(dist(pos, party)).toBe(3);
  });

  it("el gate de distancia es el MISMO para los dos: a Manhattan 4 ninguno se mueve", () => {
    const party: [number, number] = [10, 10];
    expect(tickOnce(6, [14, 10], party)).toEqual({ x: 14, y: 10 });
    expect(tickOnce(3, [14, 10], party)).toEqual({ x: 14, y: 10 });
  });

  it("CONTROL de stream: la persecución NO consume RNG", () => {
    // Las tres tiradas de 0x06e4 están tras gates de aiType 3/5/7 (0x0824, 0x0892,
    // 0x0898) y la rama 0x0884 no tiene moneda. Si el fix tirara, este contador subiría.
    const world = grassSmall(LOC);
    const state = mkState(10, 10);
    const mgr = new NpcManager({});
    let tiradas = 0;
    const rng = (mgr as unknown as { rng: { next: (a: number, b: number) => number } }).rng;
    const orig = rng.next.bind(rng);
    rng.next = (a: number, b: number): number => {
      tiradas++;
      return orig(a, b);
    };
    const npc = mkNpc(6, 12, 10);
    (mgr as unknown as { npcs: Map<number, NpcRuntime[]> }).npcs = new Map([[LOC, [npc]]]);
    mgr.tick(state, world, new DoorManager());
    expect(tiradas).toBe(0);
    expect(npc.x).toBe(11); // y sí se movió: el cero no es por no haber corrido
  });
});
