/**
 * #84 — EL PESTILLO HORARIO DE NPCs (`npc_check_schedule` NPC.OVL:0x0938) y el
 * presupuesto de UN escaneo por tick (`npc_tick_all` 0x0dbc/0x116c/0x12c2).
 *
 * Derivación: re/notes/npc-maquina-caminata-acta.md §3 (re-verificada sobre el
 * árbol de hoy, cuerpo 0x0938-0x0a47 y bucle 0x1264-0x12d8) + el acta del campo
 * `+0` (re/notes/npc-rt-campo0-maquina.md §3, la partición de seis casos).
 *
 * Todos los esperados van EN CRUDO (los valores del asm escritos como literales,
 * no derivados del sujeto): la tabla 8/2/6/7/4/5 es la de 0x09de/0x09f6/0x0a04/
 * 0x0a0c/0x0a1c/0x0a24, y los retornos son `[bp-8]+1` (0x0a3c) o el 0 de 0x09c4.
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../src/core/state.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { DoorManager } from "../src/core/world/doors.js";
import {
  NpcManager,
  npcCheckSchedule,
  type NpcSlot,
} from "../src/core/npc/manager.js";
import { OriginalRng } from "../src/core/rng-original.js";

const SMALL = 32;
const FLOOR_TILE = 68;

function world(extraFloors: number[] = []): WorldData {
  const mk = () =>
    Array.from({ length: SMALL }, () => Array<number>(SMALL).fill(FLOOR_TILE));
  const floors = [{ z: 0, tiles: mk() }, ...extraFloors.map((z) => ({ z, tiles: mk() }))];
  const loc: SmallMapLocation = { id: 7, name: "TEST", floors };
  return { overworld: [], underworld: [], smallMaps: new Map([[7, loc]]) };
}

function gameState(hour: number, px = 0, py = 0, floor = 0): GameState {
  return {
    version: 1,
    position: { location: 7, floor, x: px, y: py },
    time: { year: 139, month: 1, day: 1, hour, minute: 0 },
    turnsSinceStart: 0,
    npcDead: [],
  } as unknown as GameState;
}

function slot(over: Partial<NpcSlot>): NpcSlot {
  return {
    slot: 1,
    aiTypes: [0, 0, 0],
    x: [5, 20, 5],
    y: [5, 20, 5],
    z: [0, 0, 0],
    times: [8, 12, 18, 22],
    type: 112,
    dialogNumber: 0,
    ...over,
  };
}

/** RNG con contador: mide el CONSUMO, no el valor (0 tiradas = hora inerte). */
class CountingRng extends OriginalRng {
  calls = 0;
  override next(lo: number, hi: number): number {
    this.calls++;
    return super.next(lo, hi);
  }
}

// --------------------------------------------------- npcCheckSchedule (0x0938) ---

function rtNpc(over: Partial<Parameters<typeof npcCheckSchedule>[0]>) {
  return {
    times: [8, 12, 18, 22] as [number, number, number, number],
    schedX: [5, 20, 5] as [number, number, number],
    schedY: [5, 20, 5] as [number, number, number],
    schedZ: [0, 0, 0] as [number, number, number],
    x: 9,
    y: 9,
    z: 0,
    servedSlot: 0,
    state: 1,
    ...over,
  };
}

describe("npc_check_schedule 0x0938 — el pestillo", () => {
  it("hora SIN ranura que arranque → devuelve 0 y no toca el estado (0x09c4)", () => {
    const n = rtNpc({ state: 1 });
    // 10 ∉ {8,12,18,22}: di queda en -1 durante todo el bucle 0x0961-0x0974.
    expect(npcCheckSchedule(n, 10, 0)).toBe(0);
    expect(n.state).toBe(1);
  });

  it("hora casada + ranura YA SERVIDA → estado 1 y retorno di+1 = 2 (0x0987/0x0a3c)", () => {
    // hour 12 → di = 1 (schedule_index, npc.md §0.3). servedSlot ya es 1.
    const n = rtNpc({ servedSlot: 1, state: 1, x: 9, y: 9 });
    expect(npcCheckSchedule(n, 12, 0)).toBe(2); // [bp-8]=1 → inc → 2
    expect(n.state).toBe(1); // inerte aunque esté DESPLAZADO: la ranura no cambió
  });

  it("hora casada + posición YA en el puesto → estado 1 y retorno 1; servedSlot NO se escribe (0x09b5-0x09ba)", () => {
    // hour 12 → di=1, puesto (20,20,0). El NPC ya está allí, servedSlot=0 (cambió).
    const n = rtNpc({ servedSlot: 0, x: 20, y: 20, z: 0 });
    expect(npcCheckSchedule(n, 12, 0)).toBe(1); // [bp-8]=0 → inc → 1
    expect(n.state).toBe(1);
    // Los DOS únicos escritores de +0xe son 0x0ee6/0x1089 (cierres de caminata):
    // check_schedule NO lo toca ⇒ la hora inerte re-clasifica cada tick.
    expect(n.servedSlot).toBe(0);
  });

  it("partición de SEIS casos por plantas — valores crudos 8/2/6/7/4/5", () => {
    // Tabla de re/notes/npc-rt-campo0-maquina.md §3, direcciones 0x09de..0x0a24.
    // hour 12 → di=1; puesto de la ranura 1 = (20,20,schedZ[1]); posición viva
    // desplazada (9,9) para no disparar el careo de posición.
    const casos: Array<{ zn: number; zd: number; v: number; esperado: number }> = [
      { zn: 1, zd: 2, v: 0, esperado: 8 }, // Zn≠V ∧ Zd≠V (0x09de)
      { zn: 0, zd: 0, v: 0, esperado: 2 }, // Zn=V ∧ Zd=V (0x09f6)
      { zn: 0, zd: 1, v: 0, esperado: 6 }, // Zn=V ∧ Zd>V (0x0a04)
      { zn: 0, zd: -1, v: 0, esperado: 7 }, // Zn=V ∧ Zd<V (0x0a0c; sótano 0xFF=−1 CON SIGNO)
      { zn: 1, zd: 0, v: 0, esperado: 4 }, // Zn>V (0x0a1c)
      { zn: -1, zd: 0, v: 0, esperado: 5 }, // Zn<V (0x0a24)
    ];
    for (const c of casos) {
      const n = rtNpc({
        servedSlot: 0,
        z: c.zn,
        schedZ: [0, c.zd === -1 ? 0xff : c.zd, 0] as [number, number, number],
      });
      const r = npcCheckSchedule(n, 12, c.v);
      expect(n.state, `Zn=${c.zn} Zd=${c.zd} V=${c.v}`).toBe(c.esperado);
      expect(r).toBe(2); // [bp-8]=di=1 → inc → 2 (posición no casa)
    }
  });
});

// ------------------------------------------------- la máquina en NpcManager ---

function makeManager(
  slots: NpcSlot[],
  rng: OriginalRng,
): NpcManager {
  return new NpcManager({ 7: slots }, rng);
}

describe("npc_tick_all — pestillo + presupuesto en el manager", () => {
  it("NPC DESPLAZADO fuera de hora de arranque: NO vuelve al puesto (la divergencia raíz, cerrada)", () => {
    const rng = new CountingRng(1);
    const mgr = makeManager([slot({})], rng);
    const st = gameState(10); // 10 ∉ times
    const w = world();
    const doors = new DoorManager();
    mgr.enterMap(7, st);
    const npc = mgr.npcsAt(7, 0)[0]!;
    // Desplazamiento manual (como tras una persecución): lejos del puesto (5,5).
    npc.x = 9;
    npc.y = 9;
    for (let t = 0; t < 10; t++) mgr.tick(st, w, doors);
    // aiType 0 = FIXED: la IA no lo mueve, y el pestillo NO se arma fuera de la
    // hora de arranque ⇒ se queda EXACTAMENTE donde estaba (el clon viejo lo
    // devolvía por distancia al tick siguiente).
    expect([npc.x, npc.y]).toEqual([9, 9]);
    expect(npc.state).toBe(1);
  });

  it("transición horaria: escaneo SIN paso el primer tick, un paso por tick después, cierre AL LLEGAR", () => {
    const rng = new CountingRng(1);
    const mgr = makeManager([slot({})], rng);
    const st = gameState(8);
    const w = world();
    const doors = new DoorManager();
    mgr.enterMap(7, st); // hora 8 → ranura 0 → (5,5), servedSlot=0
    const npc = mgr.npcsAt(7, 0)[0]!;
    expect([npc.x, npc.y]).toEqual([5, 5]);

    st.time.hour = 12; // arranca la ranura 1 → puesto (20,20)
    mgr.tick(st, w, doors);
    // Tick del ESCANEO (0x116c → npc_scan): arma estado 2 y rellena el buffer,
    // pero NO da paso (0x11b6 → 0x10d6 → siguiente NPC).
    expect([npc.x, npc.y]).toEqual([5, 5]);
    expect(npc.state).toBe(2);
    mgr.tick(st, w, doors);
    // Primer paso, del buffer (npc_follow_path 0x0f94): Manhattan 30 → un paso.
    expect(Math.abs(npc.x - 5) + Math.abs(npc.y - 5)).toBe(1);
    // 30 pasos en total; ya dimos 1. El buffer real trae 16 tramos RLE — este
    // camino tiene 2 tramos rectos, cabe entero.
    for (let t = 0; t < 29; t++) mgr.tick(st, w, doors);
    expect([npc.x, npc.y]).toEqual([20, 20]);
    // Cierre del pestillo AL LLEGAR (0x1086-0x1095): servedSlot=1, estado 1.
    expect(npc.state).toBe(1);
    expect(npc.servedSlot).toBe(1);
    // Y en TODO el trayecto, CERO tiradas (el A*-escáner no consume RNG).
    expect(rng.calls).toBe(0);
  });

  it("HORA INERTE: el wanderer en su puesto NO consume RNG durante la hora de arranque", () => {
    const rng = new CountingRng(1);
    const mgr = makeManager(
      [slot({ aiTypes: [1, 1, 1], x: [5, 5, 5], y: [5, 5, 5] })],
      rng,
    );
    const st = gameState(12); // 12 ∈ times y el puesto no cambia (5,5)
    const w = world();
    const doors = new DoorManager();
    mgr.enterMap(7, st);
    for (let t = 0; t < 8; t++) mgr.tick(st, w, doors);
    // check_schedule devuelve ≠0 y deja estado 1 → 0x112d/0x1133: NADA. Ni
    // wander ni tiradas (§3.4 del acta): 0 EN CRUDO.
    expect(rng.calls).toBe(0);

    st.time.hour = 13; // 13 ∉ times → check devuelve 0 → IA (wander) SÍ tira
    mgr.tick(st, w, doors);
    // npc_wander 0x0c50: 1 tirada (skip) o 2 (skip+dir) — SIEMPRE ≥ 1.
    expect(rng.calls).toBeGreaterThanOrEqual(1);
  });

  it("presupuesto de UN escaneo por tick: con dos caminantes, el segundo escanea un tick después", () => {
    const rng = new CountingRng(1);
    const a = slot({ slot: 1 });
    const b = slot({ slot: 2, x: [7, 25, 7], y: [7, 25, 7] });
    const mgr = makeManager([a, b], rng);
    const st = gameState(8);
    const w = world();
    const doors = new DoorManager();
    mgr.enterMap(7, st);
    const [na, nb] = [mgr.npcsAt(7, 0)[0]!, mgr.npcsAt(7, 0)[1]!];

    st.time.hour = 12;
    mgr.tick(st, w, doors);
    // Tick 1: el slot 1 gasta el escaneo (0x116c); el slot 2 cae en la guarda
    // 0x1124 con presupuesto GASTADO → 0x120e → IA de la ranura SERVIDA
    // (aiType 0 = quieto). Ninguno se ha movido; sólo A tiene buffer.
    expect([na.x, na.y]).toEqual([5, 5]);
    expect([nb.x, nb.y]).toEqual([7, 7]);
    expect(na.state).toBe(2);
    expect(nb.state).toBe(2);
    expect(na.pathIdx).toBeGreaterThan(-1); // buffer cargado
    expect(nb.pathIdx).toBe(-1);

    mgr.tick(st, w, doors);
    // Tick 2: A da su primer paso (buffer gratis); B escanea (nuevo presupuesto).
    expect(Math.abs(na.x - 5) + Math.abs(na.y - 5)).toBe(1);
    expect([nb.x, nb.y]).toEqual([7, 7]);
    expect(nb.pathIdx).toBeGreaterThan(-1);

    mgr.tick(st, w, doors);
    // Tick 3: los dos siguen su buffer a la vez (el presupuesto sólo racionaba
    // el ESCANEO, no la caminata).
    expect(Math.abs(na.x - 5) + Math.abs(na.y - 5)).toBe(2);
    expect(Math.abs(nb.x - 7) + Math.abs(nb.y - 7)).toBe(1);
  });

  it("el quirk 0x120e: un estado-1 en hora inerte SÍ ejecuta su IA si otro NPC ya gastó el escaneo", () => {
    const rng = new CountingRng(1);
    // Slot 1: caminante (puesto cambia a las 12). Slot 2: wanderer EN su puesto.
    const a = slot({ slot: 1 });
    const b = slot({ slot: 2, aiTypes: [1, 1, 1], x: [7, 7, 7], y: [7, 7, 7] });
    const mgr = makeManager([a, b], rng);
    const st = gameState(8);
    const w = world();
    const doors = new DoorManager();
    mgr.enterMap(7, st);

    st.time.hour = 12;
    mgr.tick(st, w, doors);
    // El slot 1 gastó el escaneo ⇒ el slot 2 (estado 1, hora inerte) cae por
    // 0x1124→0x120e y ejecuta npc_ai_step(servedSlot) = wander ⇒ SÍ tira.
    expect(rng.calls).toBeGreaterThanOrEqual(1);
  });

  it("cambio de planta (estados 6/7, #108): camina a la escala 0xC8, y AL PISARLA teletransporta al puesto y cierra", () => {
    const rng = new CountingRng(1);
    const s = slot({ z: [0, 1, 0], x: [5, 20, 5], y: [5, 20, 5] });
    const mgr = makeManager([s], rng);
    const st = gameState(8);
    const w = world([1]);
    // Escala ARRIBA (0xC8 = 200) a dos pasos al sur del NPC (5,7).
    w.smallMaps.get(7)!.floors[0]!.tiles[7]![5] = 200;
    const doors = new DoorManager();
    mgr.enterMap(7, st);
    const npc = mgr.npcsAt(7, 0)[0]!;

    st.time.hour = 10; // fuera de hora: nada
    mgr.tick(st, w, doors);
    expect([npc.x, npc.y, npc.z]).toEqual([5, 5, 0]);

    st.time.hour = 12; // ranura 1: puesto (20,20) en planta 1 → estado 6 (Zd>V)
    // Tick 1: 0x0ea6 — no está sobre la escala → DOS escaneos (0x0f42/0x0f6b) +
    // backtrace ⇒ buffer (2 pasos al sur) y estado 3 (0x0f8c). SIN paso este tick.
    mgr.tick(st, w, doors);
    expect(npc.state).toBe(3);
    expect([npc.x, npc.y, npc.z]).toEqual([5, 5, 0]);
    expect(npc.pathIdx).toBe(0);
    expect(npc.pathBuf.slice(0, 2)).toEqual([2, 4]); // par RLE: 2 pasos, dir 4 (sur)

    // Ticks 2-3: npc_follow_path 0x0f94 — un paso del buffer por tick.
    mgr.tick(st, w, doors);
    expect([npc.x, npc.y]).toEqual([5, 6]);
    mgr.tick(st, w, doors);
    expect([npc.x, npc.y]).toEqual([5, 7]);
    expect(npc.pathIdx).toBe(-1); // buffer agotado (0x105d-0x1074); la escala NO es el puesto ⇒ sin cierre

    // Tick 4: estado 3 sin camino → re-deriva 6 (Zd>V, 0x110f) y ABORTA la pasada (0x1116).
    mgr.tick(st, w, doors);
    expect(npc.state).toBe(6);
    expect([npc.x, npc.y, npc.z]).toEqual([5, 7, 0]);

    // Tick 5: 0x0a4a — está sobre la 0xC8 que toca → far 0xd89a al puesto + cierre 0x0ee6.
    mgr.tick(st, w, doors);
    expect([npc.x, npc.y, npc.z]).toEqual([20, 20, 1]);
    expect(npc.state).toBe(1);
    expect(npc.servedSlot).toBe(1);
  });
});
