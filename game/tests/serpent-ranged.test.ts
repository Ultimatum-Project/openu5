/**
 * Sea Serpent / Dragon — ataque a distancia en overworld (MAINOUT 0x131A rama ranged +
 * daño 0x109E). Deriva completa en re/notes/serpent-ranged-derivation.md.
 *
 * Compuerta (100% del ASM): tipos def 18 (Sea Serpent, tile 0x88) / 39 (Dragon, 0xDC);
 * si NO melé-adyacente y |dx|≤3 && |dy|≤3 → rand(0,7); ==0 (1/8) dispara y OMITE el move.
 * Daño: SÓLO si el party navega en fragata (transport "ship") → rand(1,30) al casco;
 * hunde si dmg≥hull. El 0x7bea del pipeline es CLASE-C (no consume rand de movimiento,
 * en cola de witness).
 */
import { describe, expect, it } from "vitest";
import { OverworldEnemies, type OverworldEnemy } from "../src/core/world/enemies.js";
import type { GameState } from "../src/core/state.js";
import type { ActiveMap } from "../src/core/world/map.js";
import type { RandFn } from "../src/core/world/survival.js";

const SEA_SERPENT = 18;

function makeState(over: Partial<GameState> = {}): GameState {
  return {
    position: { x: 100, y: 100, floor: 0 },
    wind: 0,
    overworldEnemies: [],
    transport: "ship",
    transportTile: 0x24,
    shipHull: 99,
    shipSkiffs: 0,
    magicCarpets: 0,
    ...over,
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

/** Coloca UN Sea Serpent a (dx,dy) del party y corre un tick con el rand dado. */
function tickWithSerpent(state: GameState, dxdy: [number, number], rand: RandFn): OverworldEnemy {
  const mgr = new OverworldEnemies();
  mgr.bind(state);
  const serpent: OverworldEnemy = {
    slot: 5,
    defIndex: SEA_SERPENT,
    tile: 0x188,
    water: true,
    x: state.position.x + dxdy[0],
    y: state.position.y + dxdy[1],
  };
  mgr.enemies.push(serpent);
  mgr.tick(state, OPEN, { picker: () => null, rand, shouldSpawn: false });
  return serpent;
}

describe("Sea Serpent/Dragon ranged en overworld (MAINOUT 0x131A + 0x109E)", () => {
  it("en rango (dist 2), rand(0,7)==0 → DISPARA, OMITE el move y daña el casco rand(1,30)", () => {
    const state = makeState({ shipHull: 99 });
    const { rand, calls } = recordingRand([0, 10]); // fire (0) + hull dmg 10
    const s = tickWithSerpent(state, [2, 0], rand);
    expect(calls).toEqual([[0, 7], [1, 30]]); // compuerta + daño de casco, en ese orden
    expect(state.shipHull).toBe(89); // 99 − 10
    expect(s.x).toBe(102); // NO se movió (omitió el move)
    expect(s.y).toBe(100);
  });

  it("en rango, rand(0,7)!=0 → NO dispara: se mueve (chase axis-rand) y no daña el casco", () => {
    const state = makeState({ shipHull: 99 });
    const { rand, calls } = recordingRand([3, 1]); // no-fire (3) + axis rand del chase
    const s = tickWithSerpent(state, [2, 0], rand);
    expect(calls[0]).toEqual([0, 7]); // consumió la compuerta
    expect(calls[1]).toEqual([0, 1]); // …y luego el axis-rand del movimiento
    expect(state.shipHull).toBe(99); // casco intacto
    expect(s.x !== 102 || s.y !== 100).toBe(true); // se movió
  });

  it("FUERA de rango 3 (dist 5): NO consume rand(0,7); cae al movimiento normal", () => {
    const state = makeState();
    const { rand, calls } = recordingRand([1]); // sólo el axis-rand del chase
    tickWithSerpent(state, [5, 0], rand);
    expect(calls[0]).toEqual([0, 1]); // el PRIMER rand es el del chase, NO (0,7)
    expect(calls.some((c) => c[0] === 0 && c[1] === 7)).toBe(false);
  });

  it("a PIE (transport foot): dispara pero 0x109E no daña ni tira rand(1,30)", () => {
    const state = makeState({ transport: "foot", shipHull: 99 });
    const { rand, calls } = recordingRand([0]); // fire; NO debe tirar el rand del casco
    const s = tickWithSerpent(state, [2, 0], rand);
    expect(calls).toEqual([[0, 7]]); // sólo la compuerta (sin rand(1,30))
    expect(state.shipHull).toBe(99);
    expect(s.x).toBe(102); // omitió el move igualmente (0x131A devolvió 1)
  });

  it("casco agotado → HUNDE la fragata (sinkPlayerShip): con skiff pasa a skiff + mensajes", () => {
    const state = makeState({ shipHull: 5, shipSkiffs: 1 });
    const { rand } = recordingRand([0, 20]); // fire + dmg 20 ≥ hull 5 → hunde
    const mgr = new OverworldEnemies();
    mgr.bind(state);
    mgr.enemies.push({ slot: 5, defIndex: SEA_SERPENT, tile: 0x188, water: true, x: 102, y: 100 });
    mgr.tick(state, OPEN, { picker: () => null, rand, shouldSpawn: false });
    expect(state.transport).toBe("skiff"); // degradó a skiff (había uno a bordo)
    expect(state.shipHull).toBe(5); // el casco NO se toca al hundir (transport.md §7E)
    expect(mgr.takeRangedFireMessages()).toContain("Ship sunk!");
  });

  it("casco agotado sin skiff pero con alfombra: pasa a carpet y tira rand(0,1) del facing", () => {
    const state = makeState({ shipHull: 3, shipSkiffs: 0, magicCarpets: 1 });
    const { rand, calls } = recordingRand([0, 25, 1]); // fire + dmg 25 + facing E
    const mgr = new OverworldEnemies();
    mgr.bind(state);
    mgr.enemies.push({ slot: 5, defIndex: SEA_SERPENT, tile: 0x188, water: true, x: 102, y: 100 });
    mgr.tick(state, OPEN, { picker: () => null, rand, shouldSpawn: false });
    expect(calls).toEqual([[0, 7], [1, 30], [0, 1]]); // compuerta + casco + facing de alfombra
    expect(state.transport).toBe("carpet");
    expect(state.magicCarpets).toBe(0); // consumió la alfombra
  });
});
