/**
 * #37 — movimiento de actores de overworld: identidad de SLOT (kernel 0x3868 /
 * 0x38E4), iteración por slot DESCENDENTE 31→1 (MAINOUT 0x1AB6) y consumo de RNG
 * del chase 0x17D4 (rand(0,1) eje [+rand(0,3) drift si bloqueado]). Validado además
 * contra el volcado limpio del oráculo en re/tools/test_overworld_ai_parity.py.
 */
import { describe, expect, it } from "vitest";
import { OverworldEnemies, type OverworldEnemy } from "../src/core/world/enemies.js";
import type { GameState } from "../src/core/state.js";
import type { ActiveMap } from "../src/core/world/map.js";
import type { RandFn } from "../src/core/world/survival.js";
import { terrainSpeedClass } from "../src/core/world/movement.js";

function makeState(px = 100, py = 100): GameState {
  return { position: { x: px, y: py, floor: 0 }, wind: 0, overworldEnemies: [] } as unknown as GameState;
}
// mapa 256×256 con TODO pasable (tile 1 = agua pasable) — enemigos `water:true`.
const OPEN: ActiveMap = { width: 256, height: 256, tileAt: () => 1 } as unknown as ActiveMap;

/** rand que devuelve valores de una cola (o `lo` al agotarse) y registra cada llamada. */
function recordingRand(queue: number[] = []): { rand: RandFn; calls: Array<[number, number]> } {
  const calls: Array<[number, number]> = [];
  let i = 0;
  const rand: RandFn = (lo, hi) => {
    calls.push([lo, hi]);
    return i < queue.length ? queue[i++]! : lo;
  };
  return { rand, calls };
}

describe("#37 overworld AI: slot + orden + rand", () => {
  it("backfill/respawn reutiliza el PRIMER hueco ascendente (slot 2 libre tras muerte)", () => {
    const mgr = new OverworldEnemies();
    const st = makeState();
    mgr.bind(st);
    // slots 1 y 3 ocupados, 2 libre (simula que el actor del slot 2 murió); un
    // enemigo LEGACY sin slot representa el que entra a rellenar.
    // posiciones DENTRO de 22 tiles del party (100,100) para no ser limpiadas.
    mgr.enemies.push({ slot: 1, defIndex: 0, tile: 0x94, water: true, x: 90, y: 90 });
    mgr.enemies.push({ slot: 3, defIndex: 0, tile: 0x94, water: true, x: 91, y: 91 });
    const legacy: OverworldEnemy = { defIndex: 0, tile: 0x94, water: true, x: 92, y: 92 }; // sin slot
    mgr.enemies.push(legacy);
    const { rand } = recordingRand();
    mgr.tick(st, OPEN, { picker: () => null, rand, shouldSpawn: false });
    // el backfill (antes del move-loop) le puso el primer hueco ascendente = 2, aunque
    // luego el objeto se mueva (mutación in-place, la referencia conserva el slot).
    expect(legacy.slot).toBe(2); // primer hueco ascendente 1..23 (kernel 0x3868)
  });

  it("spawn tras muerte intermedia toma el hueco liberado, no el final de lista", () => {
    const mgr = new OverworldEnemies();
    const st = makeState();
    mgr.bind(st);
    mgr.enemies.push({ slot: 1, defIndex: 0, tile: 0x94, water: true, x: 95, y: 95 });
    mgr.enemies.push({ slot: 3, defIndex: 0, tile: 0x94, water: true, x: 96, y: 96 });
    // spawn: pickSpawnCoords usa rand(0,31)−16; 30 → offset +14 (|14|>6, aceptado)
    // → spot (114,114), pasable; picker válido.
    const { rand } = recordingRand([30, 30]);
    mgr.tick(st, OPEN, {
      picker: () => ({ defIndex: 0, tile: 0x94, water: true }),
      rand,
      shouldSpawn: true,
      maxEnemies: 8,
    });
    const spawned = mgr.enemies.find((e) => e.slot !== 1 && e.slot !== 3);
    expect(spawned, "spawneó un enemigo").toBeDefined();
    expect(spawned!.slot).toBe(2); // reutiliza el hueco 2, no un slot 4
  });

  it("itera los slots DESCENDENTE 31→1 y consume 1 axis-rand por genérico (sin drift en mapa abierto)", () => {
    const mgr = new OverworldEnemies();
    const st = makeState(100, 100);
    mgr.bind(st);
    // 3 genéricos en slots NO CONTIGUOS, todos NO adyacentes al party y con dx≠0 y dy≠0
    // (para que el eje elegido sea observable). En mapa abierto ninguno se bloquea →
    // exactamente 1 axis-rand(0,1) por enemigo, en orden de slot descendente 20→12→5.
    mgr.enemies.push({ slot: 5, defIndex: 0, tile: 0x94, water: true, x: 90, y: 90 });
    mgr.enemies.push({ slot: 20, defIndex: 0, tile: 0x94, water: true, x: 110, y: 110 });
    mgr.enemies.push({ slot: 12, defIndex: 0, tile: 0x94, water: true, x: 108, y: 92 });
    // rand del axis: 1 (X-first) para el 1º procesado, 0 (Y-first) para los otros 2.
    const { rand, calls } = recordingRand([1, 0, 0]);
    mgr.tick(st, OPEN, { picker: () => null, rand, shouldSpawn: false });
    // 3 llamadas, TODAS axis rand(0,1); ninguna drift rand(0,3) (mapa abierto).
    expect(calls).toEqual([[0, 1], [0, 1], [0, 1]]);
    // El PRIMER procesado (rand=1 → X-first) debe ser el slot MÁS ALTO (20), en (110,110):
    // se movió en X hacia el party (→109). Los otros (rand=0 → Y-first) se movieron en Y.
    const e20 = mgr.enemies.find((e) => e.slot === 20)!;
    expect(e20.x).toBe(109); // movió X (procesado 1º, X-first)
    expect(e20.y).toBe(110); // NO movió Y
    const e12 = mgr.enemies.find((e) => e.slot === 12)!;
    expect(e12.y).toBe(93); // movió Y (Y-first): party al sur (y=100 > 92) → +1
    const e5 = mgr.enemies.find((e) => e.slot === 5)!;
    expect(e5.y).toBe(91); // movió Y (Y-first): party al sur (y=100 > 90) → +1
  });
});

describe("#63 REMOLINO: dispatch por SPRITE (0x1EC), no chase genérico", () => {
  // Un remolino se crea con defIndex 43 (EnemyDef.index REAL de buildEnemyDefs) y
  // tile 0x1EC (su sprite). El bug #63 comparaba defIndex==0xEC (la ID de encuentro,
  // 236) → nunca casaba → el remolino caía al chase genérico. El fix ancla al TILE.
  const whirl = (over: Partial<OverworldEnemy> = {}): OverworldEnemy => ({
    slot: 5, defIndex: 43, tile: 0x1ec, water: true, x: 90, y: 90, ...over,
  });

  it("turno ON (phase→1): consume rand(0,1) MODO + rand(0,1) eje del chase (dos rand, no uno)", () => {
    const mgr = new OverworldEnemies();
    const st = makeState(100, 100);
    mgr.bind(st);
    const w = whirl();
    mgr.enemies.push(w);
    // phase undefined → ^1 = 1 (ON). modo rand(0,1)=1 → chase → eje rand(0,1)=1.
    const { rand, calls } = recordingRand([1, 1]);
    mgr.tick(st, OPEN, { picker: () => null, rand, shouldSpawn: false });
    // DOS rand(0,1): modo + eje del chase. El genérico consumiría UNO solo.
    expect(calls).toEqual([[0, 1], [0, 1]]);
    expect(w.phase).toBe(1); // ON
  });

  it("turno OFF (phase→0): NO mueve y NO consume RNG (phase-bit alterna)", () => {
    const mgr = new OverworldEnemies();
    const st = makeState(100, 100);
    mgr.bind(st);
    const w = whirl({ phase: 1 }); // ya estuvo ON → este turno alterna a OFF
    mgr.enemies.push(w);
    const { rand, calls } = recordingRand([]);
    mgr.tick(st, OPEN, { picker: () => null, rand, shouldSpawn: false });
    expect(calls).toEqual([]); // turno OFF: sin rand (MAINOUT 0x19AD)
    expect(w.phase).toBe(0);
    expect(w.x).toBe(90); // no se movió
    expect(w.y).toBe(90);
  });

  it("turno ON con MODO 0 → deriva rand(0,3), no chase", () => {
    const mgr = new OverworldEnemies();
    const st = makeState(100, 100);
    mgr.bind(st);
    mgr.enemies.push(whirl());
    // ON; modo rand(0,1)=0 → drift rand(0,3).
    const { rand, calls } = recordingRand([0, 2]);
    mgr.tick(st, OPEN, { picker: () => null, rand, shouldSpawn: false });
    expect(calls).toEqual([[0, 1], [0, 3]]); // modo(0,1) + drift(0,3)
  });
});

/**
 * #104 — COMPUERTA DE TERRENO DE LOS ACTORES: **defecto ABIERTO, cedido a un lote de
 * paridad futuro**. Los asertos de este bloque van INVERTIDOS a propósito (patrón del
 * trinquete): afirman que el port TODAVÍA NO modela la compuerta. El día que alguien la
 * implemente, este bloque se pone ROJO — y esa es la señal de retirarlo, no una regresión.
 *
 * QUÉ FALTA (derivado en re/notes/rng-104-acta.md, MAINOUT 0x1578 + tabla de 28 entradas
 * en 0x167a): el ejecutor del movimiento del binario, DESPUÉS de que la pasabilidad haya
 * dicho que sí, tira 1 vez según la clase del tile de DESTINO — clase 1 (tiles 4,6,7,8,
 * 0x1E,0x1F) `rand(0,1)` y sólo mueve si ≠0 (1/2); clase 2 (tiles 9..0x0F) `rand(0,2)` y
 * sólo mueve si ==2 (1/3). Si pierde, el actor NO se mueve y la tirada YA se gastó.
 *
 * POR QUÉ NO SE ARREGLA AQUÍ: el fix AÑADE tiradas al stream vivo ⇒ mueve la paridad RNG
 * de todo el turno del overworld. Va con el lote de paridad, no suelto.
 */
describe("#104 terreno de actores: DEFECTO ABIERTO (asertos invertidos)", () => {
  // mapa entero de Swamp (tile 4) = clase 1 en el binario ⇒ el original tiraría rand(0,1)
  // en CADA paso. `landEnemyPassable` de tile 4 es true, así que el port sí deja entrar.
  const SWAMP: ActiveMap = { width: 256, height: 256, tileAt: () => 4 } as unknown as ActiveMap;

  it("el port NO consume la tirada de terreno de clase 1 (retirar cuando se porte)", () => {
    const mgr = new OverworldEnemies();
    const st = makeState(100, 100);
    mgr.bind(st);
    // genérico a pie, no adyacente, dx≠0 y dy≠0; tile 0x90 (Rat) = clase de movilidad 0.
    mgr.enemies.push({ slot: 7, defIndex: 0, tile: 0x90, water: false, x: 108, y: 92 });
    const { rand, calls } = recordingRand([1]); // eje: X primero
    mgr.tick(st, SWAMP, { picker: () => null, rand, shouldSpawn: false });
    // INVERTIDO: hoy sólo se consume el rand del EJE. El binario consumiría además
    // rand(0,1) de terreno ⇒ [[0,1],[0,1]].
    expect(calls).toEqual([
      [0, 1],
    ]);
    // Y el actor se mueve SIEMPRE, sin compuerta: en el binario fallaría la mitad de las
    // veces sobre Swamp.
    const e = mgr.enemies.find((x) => x.slot === 7)!;
    expect(e.x).toBe(107);
  });

  it("el port NO consume la tirada de terreno de clase 2 (retirar cuando se porte)", () => {
    // tile 9 (Forest3) = clase 2 ⇒ el binario tiraría rand(0,2) y sólo movería si ==2.
    const FOREST3: ActiveMap = { width: 256, height: 256, tileAt: () => 9 } as unknown as ActiveMap;
    const mgr = new OverworldEnemies();
    const st = makeState(100, 100);
    mgr.bind(st);
    mgr.enemies.push({ slot: 7, defIndex: 0, tile: 0x90, water: false, x: 108, y: 92 });
    const { rand, calls } = recordingRand([1]);
    mgr.tick(st, FOREST3, { picker: () => null, rand, shouldSpawn: false });
    // INVERTIDO: falta el rand(0,2) de terreno ⇒ el binario daría [[0,1],[0,2]].
    expect(calls).toEqual([
      [0, 1],
    ]);
    expect(calls.some(([lo, hi]) => lo === 0 && hi === 2)).toBe(false);
  });

  it("clasificador de terreno del port: los DOS consumidores son de la party, ninguno de actores", () => {
    // Control positivo del careo: la partición de tiles del port coincide byte a byte con
    // la del binario (clase 1 = 4,6,7,8,0x1E,0x1F; clase 2 = 9..0x0F; el 5 NO es lento),
    // así que lo que falta no es la TABLA sino su segundo consumidor.
    for (const t of [4, 6, 7, 8, 0x1e, 0x1f]) expect(terrainSpeedClass(t)).toBe(1);
    for (let t = 9; t <= 0x0f; t++) expect(terrainSpeedClass(t)).toBe(2);
    expect(terrainSpeedClass(5)).toBe(0); // carve-out explícito del binario (MAINOUT 0x0401)
  });
});
