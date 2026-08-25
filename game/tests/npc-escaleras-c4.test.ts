/**
 * Escaleras 0xC4-0xC7 en la caminata NPC — el cabo §7 de caminata-108-acta,
 * ADJUDICADO: el binario NO tiene tabla ni regla de destino de escalera para el
 * escáner. Las tres verdades del asm, cada una con su aserto:
 *
 *  1. El raster 0x01D2 marca destino 5 SOLO con igualdad EXACTA al marcador
 *     0xC8/0xC9 (0x01e0/0x01ea fijan el marcador; 0x024d `cmp [bx+0x6608], al`
 *     lo carea): las escaleras 0xC4-0xC7 NUNCA son destino del escáner. Censo
 *     de llamadores COMPLETO (0x01c9 · 0x0e2c · 0x0f6b · 0x1194): sel −1/−2
 *     (escalas) o sel ≥ 0 (destino explícito = el puesto). No hay tercer modo.
 *  2. La LLEGADA (careo 0x0a4a) sí acepta escaleras, en AMBOS sentidos, con la
 *     máscara 0xF4: destino < planta → 0xC9 o `&0xf4==0xC4` (0x0a8c-0x0a99);
 *     si no → 0xC8 o `&0xf4==0xC4` (0x0ac2-0x0aca). 0xF4 (no 0xFC): también
 *     casan 0xCC-0xCF — quirk del binario, portado verbatim.
 *  3. El diseño CIERRA por los DATOS, no por código: toda location con algún
 *     NPC de horario cruza-plantas lleva escala 0xC8 en cada planta con destino
 *     encima y 0xC9 en cada planta con destino debajo (censo abajo). La única
 *     localización con hueco (Ararat, z=1 sin 0xC9) tiene CERO NPCs cruzando.
 *
 * Derivación: re/disasm/NPC.OVL.asm re-leído instrucción a instrucción.
 * Acta: re/notes/escaleras-c4-adjudicacion-acta.md.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { GameState } from "../src/core/state.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { DoorManager } from "../src/core/world/doors.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { OriginalRng } from "../src/core/rng-original.js";

const SMALL = 32;
const FLOOR_TILE = 68;
const STAIR_TILE = 196; // 0xC4 — escalera
const LADDER_UP = 200; // 0xC8
const LADDER_DOWN = 201; // 0xC9

function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}

/** z crudo de los .NPC: 255 = planta −1 (misma normalización que el manager). */
function normZ(z: number): number {
  return z > 127 ? z - 256 : z;
}

function world(extraFloors: number[] = []): WorldData {
  const mk = () =>
    Array.from({ length: SMALL }, () => Array<number>(SMALL).fill(FLOOR_TILE));
  const floors = [{ z: 0, tiles: mk() }, ...extraFloors.map((z) => ({ z, tiles: mk() }))];
  const loc: SmallMapLocation = { id: 7, name: "TEST", floors };
  return { overworld: [], underworld: [], smallMaps: new Map([[7, loc]]) };
}

function gameState(hour: number, px = 0, py = 0, floor = 0, location = 7): GameState {
  return {
    version: 1,
    position: { location, floor, x: px, y: py },
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

// ------------------------------------------------ 0x0a4a: llegada por escalera ---

describe("careo de llegada 0x0a4a: la escalera 0xC4-0xC7 SÍ cierra el cambio de planta", () => {
  it("estado 6 (subir) PISANDO escalera 196: teleport al puesto en UN tick, sin escaneo ni RNG (0x0ac6-0x0aca + 0x0ebf-0x0ef7)", () => {
    const rng = new CountingRng(1);
    // Spawn hora 8 en (5,5) z=0 — y el mapa lleva ESCALERA bajo sus pies.
    const s = slot({ x: [5, 20, 5], y: [5, 20, 5], z: [0, 1, 0] });
    const w = world([1]);
    w.smallMaps.get(7)!.floors[0]!.tiles[5]![5] = STAIR_TILE;
    const mgr = new NpcManager({ 7: [s] }, rng);
    const st = gameState(8, 25, 25, 0);
    mgr.enterMap(7, st);
    const npc = mgr.npcsAt(7, 0)[0]!;
    expect([npc.x, npc.y, npc.z]).toEqual([5, 5, 0]);

    st.time.hour = 12; // puesto (20,20) z=1 > V=0 → 0x938 asigna 6 (0x0a04)
    mgr.tick(st, w, new DoorManager());
    // 0x0ea6→0x0eb8 call 0xa4a: schedZ(1) ≥ g_floor(0) → rama 0x0ac2: tile 196
    // no es 0xC8, pero 196 & 0xF4 == 0xC4 (0x0ac6-0x0aca) → LLEGADA: far 0xd89a
    // al puesto + cierre 0x0ee6 (servedSlot, pathIdx −1, estado 1).
    expect([npc.x, npc.y, npc.z]).toEqual([20, 20, 1]);
    expect(npc.state).toBe(1);
    expect(npc.servedSlot).toBe(1);
    expect(npc.pathIdx).toBe(-1);
    expect(rng.calls).toBe(0); // sin escaneo, sin wander: la vía 0x0ebf no tira RNG
  });

  it("estado 7 (bajar) PISANDO escalera 196: la MISMA máscara vale hacia abajo (0x0a8c-0x0a99)", () => {
    const rng = new CountingRng(1);
    const s = slot({ x: [5, 20, 5], y: [5, 20, 5], z: [1, 0, 1] });
    const w = world([1]);
    w.smallMaps.get(7)!.floors[1]!.tiles[5]![5] = STAIR_TILE;
    const mgr = new NpcManager({ 7: [s] }, rng);
    const st = gameState(8, 25, 25, 1); // jugador (y planta visible) en z=1
    mgr.enterMap(7, st);
    const npc = mgr.npcsAt(7, 1)[0]!;

    st.time.hour = 12; // puesto (20,20) z=0 < V=1 → estado 7 (0x0a0c)
    mgr.tick(st, w, new DoorManager());
    // schedZ(0) < g_floor(1) → rama 0x0a8c: tile 196 no es 0xC9, pero
    // 196 & 0xF4 == 0xC4 (0x0a92-0x0a99) → llegada.
    expect([npc.x, npc.y, npc.z]).toEqual([20, 20, 0]);
    expect(npc.state).toBe(1);
  });

  it("la máscara es 0xF4, NO 0xFC: el byte 0xCC (204) también cierra — quirk del binario, verbatim (0x0a95/0x0ac6 `and al, 0xf4`)", () => {
    // 204 & 0xF4 == 0xC4 (cierra) · 204 & 0xFC == 0xCC ≠ 0xC4 (no cerraría).
    // Este aserto instancia la diferencia entre las dos máscaras DONDE EXISTE:
    // quien «corrija» 0xF4 → 0xFC (la máscara de 0x0e84) lo pone rojo.
    const rng = new CountingRng(1);
    const s = slot({ x: [5, 20, 5], y: [5, 20, 5], z: [0, 1, 0] });
    const w = world([1]);
    w.smallMaps.get(7)!.floors[0]!.tiles[5]![5] = 204;
    const mgr = new NpcManager({ 7: [s] }, rng);
    const st = gameState(8, 25, 25, 0);
    mgr.enterMap(7, st);
    const npc = mgr.npcsAt(7, 0)[0]!;

    st.time.hour = 12;
    mgr.tick(st, w, new DoorManager());
    expect([npc.x, npc.y, npc.z]).toEqual([20, 20, 1]);
    expect(npc.state).toBe(1);
  });
});

// ------------------------------- 0x024d: la escalera NUNCA es destino del escáner ---

describe("raster 0x01D2: el escáner ignora 0xC4-0xC7 como destino (cmp EXACTO 0x024d)", () => {
  it("planta con SOLO escaleras (sin 0xC8): el escaneo de estado 6 no encuentra destino — sin camino, sin paso, sin RNG (0x0f48→0x0f71→0x1264)", () => {
    const rng = new CountingRng(1);
    const s = slot({ x: [5, 20, 5], y: [5, 20, 5], z: [0, 1, 0] });
    const w = world([1]);
    w.smallMaps.get(7)!.floors[0]!.tiles[3]![5] = STAIR_TILE; // escalera a 2 — inútil para el escáner
    const mgr = new NpcManager({ 7: [s] }, rng);
    const st = gameState(8, 25, 25, 0);
    mgr.enterMap(7, st);
    const npc = mgr.npcsAt(7, 0)[0]!;

    st.time.hour = 12; // estado 6; no pisa escalera → careo 0x0a4a falla → escaneo
    mgr.tick(st, w, new DoorManager());
    mgr.tick(st, w, new DoorManager());
    // Ninguna celda lleva el marcador 5 (196 ≠ 0xC8 en el cmp exacto 0x024d):
    // cola vacía → null → ni estado 3 ni paso. La vía 6/7 fallida NO vaga
    // (a diferencia del atasco de estado 2/3): cero tiradas.
    expect([npc.x, npc.y, npc.z]).toEqual([5, 5, 0]);
    expect(npc.state).toBe(6);
    expect(npc.pathIdx).toBe(-1);
    expect(rng.calls).toBe(0);
  });

  it("escalera ADYACENTE vs escala a 10: el camino va a la 0xC8 lejana — buffer EN CRUDO [10,4] — y cruza al pisarla", () => {
    const rng = new CountingRng(1);
    const s = slot({ x: [5, 20, 5], y: [5, 20, 5], z: [0, 1, 0] });
    const w = world([1]);
    w.smallMaps.get(7)!.floors[0]!.tiles[5]![6] = STAIR_TILE; // (6,5): a UN paso
    w.smallMaps.get(7)!.floors[0]!.tiles[15]![5] = LADDER_UP; // (5,15): a DIEZ
    const mgr = new NpcManager({ 7: [s] }, rng);
    const st = gameState(8, 25, 25, 0);
    mgr.enterMap(7, st);
    const npc = mgr.npcsAt(7, 0)[0]!;

    st.time.hour = 12;
    mgr.tick(st, w, new DoorManager()); // careo no · escaneo sel −1 · backtrace · estado 3
    // Si la escalera fuera destino, el buffer sería [1,3] (un paso E). Es la
    // escala: 10 pasos S = par (10, dir 4), trazado a mano (recta sin empates).
    expect(npc.state).toBe(3);
    expect(npc.pathBuf.slice(0, 2)).toEqual([10, 4]);
    expect([npc.x, npc.y]).toEqual([5, 5]); // el tick del escaneo no da paso

    // Camina el buffer (10 ticks), agota SOBRE la escala (0x0adc estado 3 la
    // deja pisar), re-deriva 6 y el careo 0x0a4a cierra: tile 0xC8 == 0xC8.
    for (let i = 0; i < 14 && npc.z !== 1; i++) mgr.tick(st, w, new DoorManager());
    expect([npc.x, npc.y, npc.z]).toEqual([20, 20, 1]);
    expect(npc.state).toBe(1);
    expect(npc.servedSlot).toBe(1);
  });
});

// ----------------------------------------- castillo REAL: la refutación ejecutable ---

describe("castillo real (datos de fábrica): los NPC SÍ cruzan plantas — vía escala, como el binario", () => {
  it("LB castle, slot 5 (z 0→1 a las 11): camina hasta una 0xC8 de la planta 0 y aparece en su puesto (19,15,1)", () => {
    const smallmaps = loadJson<SmallMapLocation[]>("../assets/maps/smallmaps.json");
    const npcs = loadJson<Record<string, NpcSlot[]>>("../assets/npcs.json");
    const lb = smallmaps.find((l) => l.id === 17)!;
    const s5 = npcs["17"]!.find((n) => n.slot === 5)!;
    // Dato crudo de fábrica: x [17,15,19] · y [7,5,15] · z [1,0,1] · times [21,7,11,13].
    expect([s5.x, s5.y, s5.z, s5.times]).toEqual([
      [17, 15, 19],
      [7, 5, 15],
      [1, 0, 1],
      [21, 7, 11, 13],
    ]);
    const w: WorldData = { overworld: [], underworld: [], smallMaps: new Map([[17, lb]]) };
    const rng = new CountingRng(1);
    const mgr = new NpcManager({ 17: [s5] }, rng);
    const st = gameState(7, 25, 25, 0, 17); // hora 7: puesto (15,5) z=0 — la planta del jugador
    const doors = new DoorManager();
    mgr.enterMap(17, st);
    const npc = mgr.npcsAt(17, 0)[0]!;
    expect([npc.x, npc.y, npc.z]).toEqual([15, 5, 0]);

    st.time.hour = 11; // puesto (19,15) z=1 → estado 6: buscar 0xC8 en z=0
    // z=0 de fábrica lleva 4 escalas arriba —(3,3),(27,3),(3,27),(27,27)— y sus
    // 2 escaleras (12,7)/(15,8) NO cuentan para el escáner. El viaje entero
    // (6 → 3 → caminar → pisar la escala → careo 0x0a4a → far 0xd89a) es de
    // longitud dependiente del trazado del castillo: se acota, no se fija.
    let ticks = 0;
    while (npc.z !== 1 && ticks < 300) {
      mgr.tick(st, w, doors);
      ticks++;
    }
    expect([npc.x, npc.y, npc.z]).toEqual([19, 15, 1]);
    expect(npc.state).toBe(1);
    expect(npc.servedSlot).toBe(2);
  });
});

// ------------------------------------------------- la guarda de DATOS (censo) ---

describe("censo de fábrica: toda planta con destino cruzado tiene su escala — el diseño del binario cierra por los DATOS", () => {
  const smallmaps = loadJson<SmallMapLocation[]>("../assets/maps/smallmaps.json");
  const npcs = loadJson<Record<string, NpcSlot[]>>("../assets/npcs.json");
  const byLoc = new Map(smallmaps.map((l) => [l.id, l]));

  /** NPCs con horario que cruza plantas, por location (mismo filtro que el manager). */
  function crossFloorSlots(): Map<number, NpcSlot[]> {
    const out = new Map<number, NpcSlot[]>();
    for (const [locId, list] of Object.entries(npcs)) {
      const cross = list.filter((n) => {
        if (n.type === 0 && n.dialogNumber === 0) return false;
        return new Set(n.z.map(normZ)).size > 1;
      });
      if (cross.length) out.set(Number(locId), cross);
    }
    return out;
  }

  function laddersAt(loc: SmallMapLocation, z: number, tile: number): number {
    const f = loc.floors.find((x) => x.z === z);
    if (!f) return -1; // planta inexistente: el aserto de abajo lo caza
    let n = 0;
    for (const row of f.tiles) for (const t of row) if (t === tile) n++;
    return n;
  }

  it("población EN CRUDO: 17 locations, 100 NPCs cruzan plantas (censo 2026-08-20 sobre npcs.json de fábrica)", () => {
    const cross = crossFloorSlots();
    const counts = Object.fromEntries(
      [...cross.entries()].map(([k, v]) => [k, v.length]),
    );
    expect(counts).toEqual({
      1: 5, 2: 14, 3: 10, 4: 1, 5: 6, 6: 8, 7: 3, 9: 1, 10: 2, 11: 2, 12: 2,
      17: 10, 18: 15, 26: 3, 30: 10, 31: 4, 32: 4,
    });
    expect([...cross.values()].reduce((a, v) => a + v.length, 0)).toBe(100);
  });

  it("por cada NPC cruzado y cada planta suya: 0xC8 si tiene destino ENCIMA, 0xC9 si lo tiene DEBAJO — cero violaciones", () => {
    // Es la condición exacta que necesita la máquina: el estado 6 (y la
    // materialización 4) buscan 0xC8 en la planta visible; el 7 (y la 5), 0xC9.
    const violations: string[] = [];
    for (const [locId, list] of crossFloorSlots()) {
      const loc = byLoc.get(locId);
      if (!loc) {
        violations.push(`loc ${locId}: sin mapa`);
        continue;
      }
      for (const n of list) {
        const zs = [...new Set(n.z.map(normZ))];
        const hi = Math.max(...zs);
        const lo = Math.min(...zs);
        for (const z of zs) {
          if (z < hi && laddersAt(loc, z, LADDER_UP) < 1) {
            violations.push(`loc ${locId} slot ${n.slot}: z=${z} sin 0xC8 con destino encima`);
          }
          if (z > lo && laddersAt(loc, z, LADDER_DOWN) < 1) {
            violations.push(`loc ${locId} slot ${n.slot}: z=${z} sin 0xC9 con destino debajo`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("control positivo del predicado: Ararat (25) TIENE el hueco (z=1 sin 0xC9) — y CERO NPCs cruzando, por eso el diseño cierra", () => {
    // Si Ararat entrara en la población, el aserto anterior enrojecería: el
    // predicado no es tautológico, puede fallar sobre datos reales.
    const ararat = byLoc.get(25)!;
    expect(laddersAt(ararat, 1, LADDER_DOWN)).toBe(0);
    expect(laddersAt(ararat, 0, LADDER_UP)).toBe(1);
    expect(crossFloorSlots().has(25)).toBe(false);
  });
});
