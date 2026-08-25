/**
 * #103 — el spawn del sobremundo ve el POOL ENTERO, no su partición.
 *
 * El binario elige ranura con `acquire_actor_slot` (ULTIMA.EXE:0x38E4): cascada de
 * DIEZ llamadas al escáner 0x3868 (slots 1..23, `cmp cx,0x18`), primera = ranura
 * LIBRE (tile 0), y las siguientes DESALOJAN por bandas de tile con preferencia
 * fuera-de-pantalla (ventana 11×11, `0x389b-0x38b7`). El port partía el pool en
 * tres (#103) y `trySpawn` construía `occupied` SOLO con `this.enemies`
 * (re/notes/reciclado-ranuras-y-boca-de-doom.md §5): una fragata aparcada en el
 * slot 1 era invisible y el spawn se lo pisaba; y con el pool lleno el port
 * abortaba donde el binario desaloja.
 */
import { describe, expect, it } from "vitest";
import { OverworldEnemies, type OverworldEnemy } from "../src/core/world/enemies.js";
import type { GameState, WorldObject } from "../src/core/state.js";
import type { ActiveMap } from "../src/core/world/map.js";
import type { RandFn } from "../src/core/world/survival.js";

function makeState(px = 100, py = 100): GameState {
  return {
    position: { x: px, y: py, floor: 0, location: 0 },
    wind: 0,
    overworldEnemies: [],
    worldObjects: [],
  } as unknown as GameState;
}
const OPEN: ActiveMap = { width: 256, height: 256, tileAt: () => 1 } as unknown as ActiveMap;

function recordingRand(queue: number[] = []): { rand: RandFn; calls: Array<[number, number]> } {
  const calls: Array<[number, number]> = [];
  let i = 0;
  const rand: RandFn = (lo, hi) => {
    calls.push([lo, hi]);
    return i < queue.length ? queue[i++]! : lo;
  };
  return { rand, calls };
}
/** Fragata aparcada (byte +0 = 0x24: banda 0x12-0x2f, sólo la llamada 10 la desaloja). */
function shipAt(slot: number, x = 20, y = 130): WorldObject {
  return { location: 0, floor: 0, x, y, tile: 0x124, kind: "ship", hull: 99, slot };
}
/** Errante con slot (byte +0 = 0x94: banda 0x80-0xff, llamadas 3 y 7). */
function enemyAt(slot: number, x: number, y: number): OverworldEnemy {
  return { slot, defIndex: 0, tile: 0x94, water: true, x, y };
}
const SPAWN_QUEUE = [30, 30]; // pickSpawnCoords: offset +14 → spot (114,114), aceptado

describe("#103 ocupación compuesta: el spawn no pisa la ranura de un objeto", () => {
  it("con la fragata en el slot 1, el spawn aterriza en el 2 (llamada 1: primer LIBRE)", () => {
    const mgr = new OverworldEnemies();
    const st = makeState();
    mgr.bind(st);
    st.worldObjects!.push(shipAt(1));
    const { rand } = recordingRand(SPAWN_QUEUE);
    mgr.tick(st, OPEN, {
      picker: () => ({ defIndex: 0, tile: 0x94, water: true }),
      rand,
      shouldSpawn: true,
    });
    expect(mgr.enemies.length).toBe(1);
    expect(mgr.enemies[0]!.slot).toBe(2); // NO el 1: la ranura del objeto está ocupada
  });

  it("el backfill de slots legacy también salta la ranura del objeto", () => {
    const mgr = new OverworldEnemies();
    const st = makeState();
    mgr.bind(st);
    st.worldObjects!.push(shipAt(1));
    const legacy: OverworldEnemy = { defIndex: 0, tile: 0x94, water: true, x: 92, y: 92 };
    mgr.enemies.push(legacy);
    const { rand } = recordingRand();
    mgr.tick(st, OPEN, { picker: () => null, rand, shouldSpawn: false });
    expect(legacy.slot).toBe(2); // no el 1 (fragata)
  });
});

describe("#103 desalojo por cascada (0x38E4) con el pool lleno", () => {
  /**
   * Pool 1..23 lleno: fragata en el 1 (banda de la llamada 10) + errantes en 2..23.
   * El del slot 2 está EN PANTALLA (adyacente al party) y los demás FUERA de la
   * ventana 11×11 (distancia 10 ≤ cleanup 22): la llamada 3 (monstruos, fuera de
   * pantalla) devuelve el PRIMER ascendente fuera = slot 3. El binario desaloja y
   * spawnea; el port viejo abortaba (o pisaba el slot de la fragata).
   */
  function fullPool() {
    const mgr = new OverworldEnemies();
    const st = makeState();
    mgr.bind(st);
    st.worldObjects!.push(shipAt(1));
    mgr.enemies.push(enemyAt(2, 101, 100)); // EN pantalla: |dx|=1
    for (let s = 3; s <= 23; s++) mgr.enemies.push(enemyAt(s, 110, 100)); // fuera: |dx|=10
    return { mgr, st };
  }

  it("desaloja el primer monstruo FUERA de pantalla (slot 3), respeta el 2 (en pantalla) y el 1 (objeto)", () => {
    const { mgr, st } = fullPool();
    const { rand } = recordingRand(SPAWN_QUEUE);
    mgr.tick(st, OPEN, {
      picker: () => ({ defIndex: 5, tile: 0x94, water: true }), // defIndex 5 = el nacido
      rand,
      shouldSpawn: true,
      maxEnemies: 30,
    });
    const slots = mgr.enemies.map((e) => e.slot).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(mgr.enemies.length).toBe(22); // 22 antes − 1 desalojado + 1 spawneado
    expect(slots).toContain(2); // el de pantalla sobrevive (ventana 11×11)
    expect(slots).toContain(3); // la ranura desalojada la ocupa el spawn
    // El nuevo (defIndex 5, nacido en (114,114) y movido ≤1 casilla por el propio
    // tick 3b) vive en la ranura del desalojado; el viejo defIndex 0 del slot 3 no está.
    const spawned = mgr.enemies.find((e) => e.defIndex === 5);
    expect(spawned?.slot).toBe(3);
    expect(mgr.enemies.filter((e) => e.slot === 3).length).toBe(1);
    expect(st.worldObjects!.length).toBe(1); // la fragata NO se desaloja (banda 10)
  });

  it("con maxEnemies del port (cap por defecto 8) el gate previo evita llegar aquí — control de no-regresión", () => {
    const { mgr, st } = fullPool();
    const { rand, calls } = recordingRand(SPAWN_QUEUE);
    mgr.tick(st, OPEN, {
      picker: () => ({ defIndex: 0, tile: 0x94, water: true }),
      rand,
      shouldSpawn: true, // 22 enemigos ≥ maxEnemies 8 ⇒ trySpawn ni corre
    });
    expect(mgr.enemies.length).toBe(22);
    // sin spawn no se consumen las 2 tiradas de pick_spawn_coords
    expect(calls.filter(([lo, hi]) => lo === 0 && hi === 31).length).toBe(0);
  });
});
