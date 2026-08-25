/**
 * #108 — LA MÁQUINA DE CAMINATA COMPLETA (escáner + buffer RLE + atasco +
 * cambio de planta + persistencia), sustituyendo al A* del port.
 *
 * Derivación: re/disasm/NPC.OVL.asm re-leído instrucción a instrucción
 * (npc_scan 0x032C · npc_path_backtrace 0x04AC · raster 0x01D2 · follow 0x0F94 ·
 * atasco/moneda 0x1124-0x120C · npc_change_floor 0x0EA6 · recompute 4/5
 * 0x0DD4-0x0E9C). Acta: re/notes/caminata-108-acta.md.
 *
 * Los esperados de los buffers van EN CRUDO: pares (cuenta, dirección) trazados
 * A MANO sobre el algoritmo del asm (orden de sondas N→W→S→E desde el inicio
 * 0x46, marcas nibble-alto, backtrace con inversión ((d+1)&3)+1), no derivados
 * corriendo el sujeto.
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../src/core/state.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { DoorManager } from "../src/core/world/doors.js";
import {
  NpcManager,
  npcScan,
  npcBacktrace,
  type NpcSlot,
} from "../src/core/npc/manager.js";
import { OriginalRng } from "../src/core/rng-original.js";

const SMALL = 32;
const FLOOR_TILE = 68;
const WATER = 1; // no transitable a pie

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

/** RNG con contador (mide el CONSUMO). */
class CountingRng extends OriginalRng {
  calls = 0;
  override next(lo: number, hi: number): number {
    this.calls++;
    return super.next(lo, hi);
  }
}

/** RNG con guion: devuelve los valores dados, en orden (y cuenta). */
class ScriptRng extends OriginalRng {
  calls = 0;
  constructor(private script: number[]) {
    super(1);
  }
  override next(_lo: number, _hi: number): number {
    this.calls++;
    return this.script.length > 0 ? this.script.shift()! : 0;
  }
}

function makeManager(slots: NpcSlot[], rng: OriginalRng): NpcManager {
  return new NpcManager({ 7: slots }, rng);
}

// ------------------------------------------------- npcScan + npcBacktrace ---

/** Rejilla sintética como la del raster 0x01D2: 33 filas × 32 (fila 32 guarda). */
function grid(): Uint8Array {
  const g = new Uint8Array(33 * SMALL);
  g.fill(0x90, SMALL * SMALL);
  return g;
}

describe("npc_scan 0x032C + npc_path_backtrace 0x04AC (unidad, rejilla sintética)", () => {
  it("línea recta al norte: par único (2, dir 2) — trazado a mano del BFS y la inversión", () => {
    const g = grid();
    g[3 * SMALL + 5] = 5; // destino (5,3)
    g[5 * SMALL + 5] = 0x46; // inicio (5,5) — nibble alto 4 = primera sonda N
    const f = npcScan(g, 5, 5);
    expect(f).toEqual({ x: 5, y: 3 });
    const npc = { pathBuf: new Array<number>(32).fill(0), pathIdx: -1 };
    const bytes = npcBacktrace(npc, f!.y, f!.x, g);
    // Marcha atrás (5,3)→(5,4)→(5,5): 2 pasos de sonda 4 (N); el paso que
    // ATERRIZA en el inicio no se cuenta (0x0512). Inversión: sonda 4 → step 2.
    expect(bytes).toBe(2);
    expect(npc.pathIdx).toBe(0); // 0x04c0 — el backtrace deja 0, no −1
    expect(npc.pathBuf.slice(0, 4)).toEqual([2, 2, 0, 0]);
  });

  it("giro en L: pares (1,4)(1,1) — el orden de sondas N→W→S→E decide el árbol", () => {
    const g = grid();
    g[3 * SMALL + 3] = 5; // destino (3,3)
    g[2 * SMALL + 2] = 0x46; // inicio (2,2)
    const f = npcScan(g, 2, 2);
    // El BFS marca N,W,S,E desde el inicio; (2,3) [S, marca 0x20] sonda E y
    // encuentra (3,3) — trazado a mano en el acta §«casos crudos».
    expect(f).toEqual({ x: 3, y: 3 });
    const npc = { pathBuf: new Array<number>(32).fill(0), pathIdx: -1 };
    const bytes = npcBacktrace(npc, f!.y, f!.x, g);
    expect(bytes).toBe(4);
    // Invertido y convertido: 1 paso dir 4 (S) + 1 paso dir 1 (E).
    expect(npc.pathBuf.slice(0, 6)).toEqual([1, 4, 1, 1, 0, 0]);
  });

  it("EMPATE diagonal: la primera sonda es el nibble de la celda (0x038e) — N gana a E: [1,2,1,1]", () => {
    // Destino (6,4), inicio (5,5): dos rutas de 2 pasos (N→E y E→N). El árbol
    // BFS del binario sondea cada celda EMPEZANDO por su dirección padre (el
    // inicio 0x46 → N): (5,4) se desencola antes que (6,5) y su sonda E pisa el
    // destino ⇒ N primero. Una primera sonda constante (o el orden W,S,E,N)
    // haría ganar a (6,5) vía N ⇒ [1,1,1,2]. Trazado a mano en el acta.
    const g = grid();
    g[4 * SMALL + 6] = 5; // destino (6,4)
    g[5 * SMALL + 5] = 0x46; // inicio (5,5)
    const f = npcScan(g, 5, 5);
    expect(f).toEqual({ x: 6, y: 4 });
    const npc = { pathBuf: new Array<number>(32).fill(0), pathIdx: -1 };
    expect(npcBacktrace(npc, f!.y, f!.x, g)).toBe(4);
    expect(npc.pathBuf.slice(0, 4)).toEqual([1, 2, 1, 1]); // 1 N + 1 E, EN CRUDO
  });

  it("el inicio PISA al destino (0x0313 escribe 0x46 el último): mismo puesto ⇒ escaneo SIN camino", () => {
    const g = grid();
    g[5 * SMALL + 5] = 5; // destino…
    g[5 * SMALL + 5] = 0x46; // …pisado por el inicio (la trampa del puesto propio)
    expect(npcScan(g, 5, 5)).toBeNull();
  });

  it("destino amurallado (obstáculos 0x90): la cola se vacía y devuelve null", () => {
    const g = grid();
    g[3 * SMALL + 10] = 5;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      g[(3 + dy) * SMALL + 10 + dx] = 0x90;
    }
    g[20 * SMALL + 20] = 0x46;
    expect(npcScan(g, 20, 20)).toBeNull();
  });
});

// ------------------------------------------------------- la máquina en vivo ---

describe("caminata en vivo (estado 2): buffer real, cierre AL LLEGAR", () => {
  it("puesto a 3 al sur: escanea (tick 1, sin paso), camina 3 ticks el par (3,4) y cierra con servedSlot", () => {
    const rng = new CountingRng(1);
    const s = slot({ x: [5, 5, 5], y: [5, 8, 5] }); // ranura 1: (5,8), misma planta
    const mgr = makeManager([s], rng);
    const st = gameState(8);
    const w = world();
    const doors = new DoorManager();
    mgr.enterMap(7, st);
    const npc = mgr.npcsAt(7, 0)[0]!;

    st.time.hour = 12;
    mgr.tick(st, w, doors); // escaneo: el tick NO da paso (0x11b6 → 0x10d6)
    expect(npc.state).toBe(2);
    expect([npc.x, npc.y]).toEqual([5, 5]);
    expect(npc.pathIdx).toBe(0);
    expect(npc.pathBuf.slice(0, 2)).toEqual([3, 4]); // 3 pasos al sur, EN CRUDO
    expect(npc.stuck).toBe(0);

    mgr.tick(st, w, doors);
    expect([npc.x, npc.y]).toEqual([5, 6]);
    expect(npc.pathBuf[0]).toBe(2); // 0x103a dec — la cuenta vive en el buffer
    mgr.tick(st, w, doors);
    expect([npc.x, npc.y]).toEqual([5, 7]);
    mgr.tick(st, w, doors);
    // Último paso ATERRIZA en el puesto: can_move devuelve 2 (0x0adc) y el
    // cierre 0x107a-0x1095 escribe servedSlot (uno de los DOS escritores de +0xe).
    expect([npc.x, npc.y]).toEqual([5, 8]);
    expect(npc.state).toBe(1);
    expect(npc.servedSlot).toBe(1);
    expect(npc.pathIdx).toBe(-1);
  });

  it("paso bloqueado por otro NPC: atasco++ y VAGA ese tick (RNG); con atasco > 3 descarta el camino (0x10c6)", () => {
    const rng = new CountingRng(1);
    const a = slot({ slot: 1, x: [5, 5, 5], y: [5, 8, 5] });
    // B clavado en (5,6) — en medio del camino de A; times sin la hora 12 ⇒ su
    // check devuelve 0 y su aiType 0 lo deja quieto.
    const b = slot({ slot: 2, x: [5, 5, 5], y: [6, 6, 6], times: [0, 0, 0, 0] });
    const mgr = makeManager([a, b], rng);
    const st = gameState(8);
    const w = world();
    const doors = new DoorManager();
    mgr.enterMap(7, st);
    const na = mgr.npcsAt(7, 0).find((n) => n.slot === 1)!;

    st.time.hour = 12;
    mgr.tick(st, w, doors); // A escanea. OJO: B a Manhattan<4 NO bloquea el
    // raster de su propia celda… sí: 0x0284 bloquea la celda de B (dist 1 < 4)
    // ⇒ el escáner RODEA a B. El camino no pasa por (5,6).
    expect(na.pathIdx).toBe(0);
    // El primer par NO es el sur directo: la celda (5,6) estaba vetada en la rejilla.
    expect(na.pathBuf[1]).not.toBe(4);
  });

  it("escaneo fallido: SATURA el atasco a 0xC8, vaga (RNG), y enfría CINCO ticks sin RNG antes de reintentar (0x11bf/0x11e8-0x1208)", () => {
    const rng = new CountingRng(1);
    const s = slot({ x: [5, 10, 5], y: [5, 3, 5] });
    const mgr = makeManager([s], rng);
    const st = gameState(8);
    const w = world();
    // Muralla de agua alrededor del puesto (10,3).
    const tiles = w.smallMaps.get(7)!.floors[0]!.tiles;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      tiles[3 + dy]![10 + dx] = WATER;
    }
    const doors = new DoorManager();
    mgr.enterMap(7, st);
    const npc = mgr.npcsAt(7, 0)[0]!;

    st.time.hour = 12;
    rng.calls = 0;
    mgr.tick(st, w, doors); // escaneo falla → stuck=0xC8 + wander (consume RNG)
    expect(npc.state).toBe(2);
    expect(npc.stuck).toBe(0xc8);
    expect(rng.calls).toBeGreaterThanOrEqual(1);

    // Envejecimiento: 0xC9, 0xCA, 0xCB, 0xCC, y al pasar 0xCC → 0. CERO RNG.
    for (const esperado of [0xc9, 0xca, 0xcb, 0xcc, 0]) {
      rng.calls = 0;
      mgr.tick(st, w, doors);
      expect(npc.stuck).toBe(esperado);
      expect(rng.calls).toBe(0); // stuck ≥ 0xC8 NUNCA tira la moneda (0x1141)
    }
    // stuck == 0 → el siguiente tick escanea directo (falla otra vez y satura).
    mgr.tick(st, w, doors);
    expect(npc.stuck).toBe(0xc8);
  });

  it("la MONEDA del reintento (0x114e-0x115b): con 0 < atasco < 0xC8, rand(0,2) — sólo el 1 re-escanea", () => {
    const w = world();
    const doors = new DoorManager();

    // Moneda pierde (0): consume UNA tirada y NO escanea (stuck intacto, 0x11e8 sin cambios).
    {
      const rng = new ScriptRng([0]);
      const mgr = makeManager([slot({ x: [5, 5, 5], y: [5, 8, 5] })], rng);
      const st = gameState(8);
      mgr.enterMap(7, st);
      const npc = mgr.npcsAt(7, 0)[0]!;
      st.time.hour = 12;
      npc.state = 2; // armado a mano para aislar la moneda
      npc.stuck = 5;
      mgr.tick(st, w, doors);
      expect(rng.calls).toBe(1); // SOLO la moneda
      expect(npc.pathIdx).toBe(-1); // sin escaneo
      expect(npc.stuck).toBe(5); // 5 < 0xC8: el envejecimiento no lo toca
    }
    // Moneda gana (1): escanea (buffer cargado, stuck→0, sin paso este tick).
    {
      const rng = new ScriptRng([1]);
      const mgr = makeManager([slot({ x: [5, 5, 5], y: [5, 8, 5] })], rng);
      const st = gameState(8);
      mgr.enterMap(7, st);
      const npc = mgr.npcsAt(7, 0)[0]!;
      st.time.hour = 12;
      npc.state = 2;
      npc.stuck = 5;
      mgr.tick(st, w, doors);
      expect(rng.calls).toBe(1);
      expect(npc.pathIdx).toBe(0);
      expect(npc.pathBuf.slice(0, 2)).toEqual([3, 4]);
      expect(npc.stuck).toBe(0); // 0x11b6 → 0x10d6
    }
  });
});

describe("estados 4/5 (#108): el NPC de otra planta MATERIALIZA en la escala y camina a la vista", () => {
  it("estado 4 (Zn>V): dos escaneos (puesto→0xC8, 0xC8→puesto), aparece en la escala y camina al puesto", () => {
    const rng = new CountingRng(1);
    // Spawn a las 8 en planta 1; la ranura 1 (hora 12) tiene el puesto en (20,20) planta 0.
    const s = slot({ x: [5, 20, 5], y: [5, 20, 5], z: [1, 0, 1] });
    const mgr = makeManager([s], rng);
    const st = gameState(8);
    const w = world([1]);
    w.smallMaps.get(7)!.floors[0]!.tiles[22]![20] = 200; // escala ARRIBA (20,22)
    const doors = new DoorManager();
    mgr.enterMap(7, st);
    const npc = mgr.npcsAt(7, 1)[0]!;
    expect([npc.x, npc.y, npc.z]).toEqual([5, 5, 1]);

    st.time.hour = 12; // partición: Zn=1 > V=0 → estado 4 (0x0a1c)
    mgr.tick(st, w, doors);
    // 0x0dd4-0x0e9c: sel −1 encuentra la 0xC8 desde el puesto; el segundo escaneo
    // deja el buffer escala→puesto; el tile casa (modo 3 ↔ 0xC8) ⇒ MATERIALIZA.
    expect([npc.x, npc.y, npc.z]).toEqual([20, 22, 0]);
    expect(npc.state).toBe(2);
    expect(npc.pathIdx).toBe(0);
    expect(npc.pathBuf.slice(0, 2)).toEqual([2, 2]); // 2 pasos al norte, EN CRUDO

    mgr.tick(st, w, doors);
    expect([npc.x, npc.y]).toEqual([20, 21]);
    mgr.tick(st, w, doors);
    expect([npc.x, npc.y]).toEqual([20, 20]);
    expect(npc.state).toBe(1); // cierre 0x107a (can_move == 2 en el puesto)
    expect(npc.servedSlot).toBe(1);
  });

  it("estados 4/5 con presupuesto GASTADO: nada este tick (0x12bc)", () => {
    const rng = new CountingRng(1);
    // A (slot 1) caminante en planta visible: gasta el escaneo del tick.
    const a = slot({ slot: 1, x: [5, 5, 5], y: [5, 8, 5] });
    // B (slot 2) fuera de planta con puesto visible → estado 4.
    const b = slot({ slot: 2, x: [7, 20, 7], y: [7, 20, 7], z: [1, 0, 1] });
    const mgr = makeManager([a, b], rng);
    const st = gameState(8);
    const w = world([1]);
    w.smallMaps.get(7)!.floors[0]!.tiles[22]![20] = 200;
    const doors = new DoorManager();
    mgr.enterMap(7, st);
    const nb = mgr.npcsAt(7, 1)[0]!;

    st.time.hour = 12;
    mgr.tick(st, w, doors); // A escanea primero (orden de slot) → B se queda
    expect(nb.state).toBe(4);
    expect([nb.x, nb.y, nb.z]).toEqual([7, 7, 1]);
    mgr.tick(st, w, doors); // A ya camina (gratis) → B recalcula ahora
    expect(nb.state).toBe(2);
    expect(nb.z).toBe(0);
  });
});

describe("persistencia (#108): las cinco piezas viajan en GameState.npcWalk", () => {
  it("save a mitad de caminata → restore reanuda EXACTO (buffer, índice, atasco, estado)", () => {
    const rng = new CountingRng(1);
    const s = slot({ x: [5, 5, 5], y: [5, 8, 5] });
    const mgr = makeManager([s], rng);
    const st = gameState(8);
    const w = world();
    const doors = new DoorManager();
    mgr.enterMap(7, st);
    st.time.hour = 12;
    mgr.tick(st, w, doors); // escaneo
    mgr.tick(st, w, doors); // primer paso — (5,6), buffer a medias
    const antes = mgr.npcsAt(7, 0)[0]!;
    expect([antes.x, antes.y]).toEqual([5, 6]);
    expect(st.npcWalk).not.toBeNull();
    const snap = st.npcWalk!.slots.find((x) => x.slot === 1)!;
    expect(snap.state).toBe(2);
    expect(snap.pathIdx).toBe(0);
    expect(snap.pathBuf.slice(0, 2)).toEqual([2, 4]);

    // «Carga de partida»: manager nuevo, restore=true.
    const mgr2 = makeManager([s], new CountingRng(1));
    mgr2.enterMap(7, st, true);
    const despues = mgr2.npcsAt(7, 0)[0]!;
    expect([despues.x, despues.y, despues.z]).toEqual([5, 6, 0]);
    expect(despues.state).toBe(2);
    expect(despues.pathIdx).toBe(0);
    expect(despues.pathBuf.slice(0, 2)).toEqual([2, 4]);
    mgr2.tick(st, w, doors);
    expect([despues.x, despues.y]).toEqual([5, 7]); // continúa donde iba

    // Entrada FRESCA (sin restore): re-inicializa como npc_activate_all 0x00D6.
    const mgr3 = makeManager([s], new CountingRng(1));
    mgr3.enterMap(7, st);
    const fresco = mgr3.npcsAt(7, 0)[0]!;
    expect(fresco.state).toBe(1);
    expect(fresco.pathIdx).toBe(-1);
    expect([fresco.x, fresco.y]).toEqual([5, 8]); // posición de horario de la hora 12…
  });
});
