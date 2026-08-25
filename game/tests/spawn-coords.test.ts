/**
 * `pick_spawn_coords` (MAINOUT `spawn_monster` 0x0F4E): 2×rand(0,31) por intento,
 * COMPUESTAS CON `g_chunk_origin` en 8 bits (envuelven en 256), con re-roll sólo por
 * DISTANCIA a la party y SIN check de pasabilidad en el bucle.
 *
 * ★ LA CONDICIÓN ES UNA, ESCRITA EN DOS MITADES (ficha #31): `d<=6` (0x0F84/0x0F9A) es
 * la cercanía directa y `d>=0xFA` (0x0FAA/0x0FC0) es ESA MISMA cercanía por el otro
 * lado del envolvimiento. Juntas dicen «distancia >= 7 en el toro de 8 bits».
 *
 * ⚠ ESTE FICHERO ESTABA ESCRITO CONTRA UNA APROXIMACIÓN QUE YA NO EXISTE. El port anclaba
 * el offset en `rand(0,31)−16` («party ≈ chunk_origin+16») y cada caso codificaba ese −16
 * (`dx = 23−16 = 7`). La aproximación afirmaba además que con ella la guarda de wrap
 * «NUNCA se alcanza» — y en consecuencia NO HABÍA NI UN CASO que la ejercitara: el test
 * no podía cazar la mitad que faltaba porque estaba escrito en el mismo sistema de
 * coordenadas que el defecto. Medido después con la sonda `U5_SPAWN_K`: **42 de 46
 * muestras del corpus tienen k≠16**. Los casos de k=16 se conservan (ahora con el origen
 * EXPLÍCITO en vez de implícito) y se añaden los que la aproximación hacía inalcanzables.
 *
 * asm: re/disasm/MAINOUT.OVL.asm:1547-1596 · re/notes/loops.md §1.2.
 */
import { describe, expect, it } from "vitest";
import { pickSpawnCoords } from "../src/core/world/loops/spawn.js";

/** Un RandFn que devuelve valores de una cola y cuenta las llamadas. */
function scriptedRand(values: number[]): {
  rand: (lo: number, hi: number) => number;
  calls: () => number;
} {
  let i = 0;
  let calls = 0;
  return {
    rand: () => {
      calls++;
      return values[i++ % values.length]!;
    },
    calls: () => calls,
  };
}

/** Origen que sitúa al grupo a `k` casillas del rincón de la ventana (k = party − origin). */
const originForK = (px: number, py: number, k: number) => ({
  x: (px - k) & 0xff,
  y: (py - k) & 0xff,
});

describe("pickSpawnCoords (MAINOUT 0x0F4E) — grupo CENTRADO (k=16)", () => {
  const o = originForK(100, 100, 16);

  it("acepta al primer intento cuando AMBOS ejes están a >6 de la party", () => {
    const { rand, calls } = scriptedRand([23, 24]); // → (107,108)
    expect(pickSpawnCoords(rand, 100, 100, 256, 256, o)).toEqual({ x: 107, y: 108 });
    expect(calls()).toBe(2); // exactamente 2 rands/intento
  });

  it("re-rollea (otras 2 rands) si un eje queda a ≤6 (dx)", () => {
    // El binario tira x e y ANTES de comprobar (0x0F4E/0x0F61): el rechazo gasta las dos.
    const { rand, calls } = scriptedRand([16, 24, 23, 24]);
    expect(pickSpawnCoords(rand, 100, 100, 256, 256, o)).toEqual({ x: 107, y: 108 });
    expect(calls()).toBe(4);
  });

  it("re-rollea si el OTRO eje queda a ≤6 (dy) — exige >6 en ambos", () => {
    const { rand, calls } = scriptedRand([23, 16, 23, 23]);
    expect(pickSpawnCoords(rand, 100, 100, 256, 256, o)).toEqual({ x: 107, y: 107 });
    expect(calls()).toBe(4);
  });

  it("NO comprueba pasabilidad: la decide el caller DESPUÉS", () => {
    const { rand } = scriptedRand([0, 0]);
    expect(pickSpawnCoords(rand, 100, 100, 256, 256, o)).toEqual({ x: 84, y: 84 });
  });

  it("devuelve null tras agotar la guarda (todas a ≤6)", () => {
    const { rand, calls } = scriptedRand([16, 16]);
    expect(pickSpawnCoords(rand, 100, 100, 256, 256, o, 5)).toBeNull();
    expect(calls()).toBe(10); // 5 intentos × 2 rands
  });
});

describe("pickSpawnCoords — la MITAD DEL ENVOLVIMIENTO (>=0xFA), inalcanzable con el ancla vieja", () => {
  it("RECHAZA lo que cae a ≤6 POR EL OTRO LADO del wrap", () => {
    // Grupo en x=2, origen 0. rand=0 ⇒ x=0, que está a DOS casillas por el toro:
    // (0−2)&0xff = 254 = 0xFE, o sea >=0xFA. La mitad directa NO lo caza (254 no es <=6);
    // sólo la del envolvimiento lo rechaza. Con el ancla vieja este caso no existía.
    const { rand, calls } = scriptedRand([0, 0, 20, 20]);
    expect(pickSpawnCoords(rand, 2, 2, 256, 256, { x: 0, y: 0 })).toEqual({ x: 20, y: 20 });
    expect(calls()).toBe(4); // el 1er intento se rechazó Y gastó sus 2 tiradas
  });

  it("CONTROL — acepta lo que está a >=7 por los DOS lados", () => {
    // rand=10 ⇒ x=10, dx=(10−2)&0xff=8: ni <=6 ni >=0xFA ⇒ vale al primer intento.
    const { rand, calls } = scriptedRand([10, 10]);
    expect(pickSpawnCoords(rand, 2, 2, 256, 256, { x: 0, y: 0 })).toEqual({ x: 10, y: 10 });
    expect(calls()).toBe(2);
  });
});

describe("pickSpawnCoords — el ANCLA es el chunk_origin REAL, no un 16 clavado", () => {
  it("con el MISMO rand, distinto origen ⇒ distinta CELDA", () => {
    const a = pickSpawnCoords(scriptedRand([23, 24]).rand, 100, 100, 256, 256, originForK(100, 100, 16));
    const b = pickSpawnCoords(scriptedRand([23, 24]).rand, 100, 100, 256, 256, originForK(100, 100, 8));
    expect(a).toEqual({ x: 107, y: 108 });
    expect(b).toEqual({ x: 115, y: 116 }); // el origen manda: 8 casillas más allá
    expect(a).not.toEqual(b);
  });

  it("con el MISMO rand, distinto origen ⇒ distinto VEREDICTO y distinto CONSUMO", () => {
    // rand=23: con k=16 el offset es +7 (ACEPTA al primero); con k=23 es 0 (RECHAZA).
    const k16 = scriptedRand([23, 23, 9, 9]);
    expect(pickSpawnCoords(k16.rand, 100, 100, 256, 256, originForK(100, 100, 16))).toEqual({
      x: 107,
      y: 107,
    });
    expect(k16.calls()).toBe(2);

    const k23 = scriptedRand([23, 23, 9, 9]);
    expect(pickSpawnCoords(k23.rand, 100, 100, 256, 256, originForK(100, 100, 23))).toEqual({
      x: 86,
      y: 86,
    });
    // ★ MISMA semilla, DOS tiradas MÁS: aquí se ve el stream divergiendo por el ancla.
    expect(k23.calls()).toBe(4);
  });
});
