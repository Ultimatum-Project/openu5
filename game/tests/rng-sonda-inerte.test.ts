import { afterEach, describe, expect, it } from "vitest";
import { OriginalRng } from "../src/core/rng-original.js";

/**
 * LA SONDA DEL STREAM NO PUEDE PERTURBAR EL STREAM QUE MIDE.
 *
 * `nextRaw16` lleva un contador opt-in (`globalThis.__u5rng`) que existe porque los cinco
 * sellos comparan TEXTO: un movimiento del stream que no llegue a lo impreso los deja
 * intactos, así que «EXIT 0» no acredita «stream quieto». El contador es lo único que mide
 * esa magnitud directamente — y por eso mismo tiene que ser demostrablemente inerte.
 *
 * 🔴 «Coste cero sin la variable» se MIDE, no se afirma. Aquí se mide lo que importa —que
 * la SECUENCIA emitida sea idéntica con y sin sumidero— y se declara lo que NO es cero:
 * sin sumidero queda **una lectura de propiedad por paso**, que es camino, no comportamiento.
 * El testigo de esa distinción es este fichero; la afirmación de comportamiento tiene además
 * evidencia de sistema: las corridas del par emparejado de #31 llevaban la sonda ARMADA y los
 * cinco sellos pagaron los valores SELLADOS SIN ella (220 · −274 · −1024 · 36 · −954).
 */

type Sumidero = { n: number; seed: number };
const G = globalThis as { __u5rng?: Sumidero };

afterEach(() => {
  delete G.__u5rng;
});

/** N pasos crudos desde una semilla dada, como lista. */
function serie(seed: number, pasos: number): number[] {
  const rng = new OriginalRng(seed);
  return Array.from({ length: pasos }, () => rng.nextRaw16());
}

describe("sonda U5_RNG_N — inerte sobre el stream que mide", () => {
  it("la secuencia cruda es IDÉNTICA con y sin sumidero instalado", () => {
    const sin = serie(0x1234, 64);
    G.__u5rng = { n: 0, seed: -1 };
    const con = serie(0x1234, 64);
    expect(con).toEqual(sin);
  });

  it("la secuencia de rand_range es IDÉNTICA con y sin sumidero", () => {
    const tirar = (): number[] => {
      const rng = new OriginalRng(0);
      return Array.from({ length: 64 }, (_, i) => rng.next(0, (i % 31) + 1));
    };
    const sin = tirar();
    G.__u5rng = { n: 0, seed: -1 };
    expect(tirar()).toEqual(sin);
  });

  it("sin sumidero no se escribe NADA: la propiedad sigue sin existir", () => {
    serie(0x1234, 32);
    expect("__u5rng" in G).toBe(false);
  });

  it("con sumidero cuenta UN paso por llamada, sin contar de más", () => {
    G.__u5rng = { n: 0, seed: -1 };
    serie(0x1234, 41);
    expect(G.__u5rng.n).toBe(41);
  });

  it("`next(lo,hi)` gasta exactamente un paso por tirada", () => {
    G.__u5rng = { n: 0, seed: -1 };
    const rng = new OriginalRng(7);
    for (let i = 0; i < 25; i++) rng.next(1, 6);
    expect(G.__u5rng.n).toBe(25);
  });

  it("la semilla del testigo es la MISMA que la del generador — es su función pura", () => {
    G.__u5rng = { n: 0, seed: -1 };
    const rng = new OriginalRng(0xbeef);
    for (let i = 0; i < 17; i++) rng.nextRaw16();
    expect(G.__u5rng.seed).toBe(rng.getSeed());
  });

  it("🔴 el rango inválido NO gasta paso NI lo cuenta (el throw va antes)", () => {
    // Réplica del contrato de `next`: lanzar en vez de colgar es divergencia declarada, y
    // el throw precede a `nextRaw16` para que un llamador que capture no se lleve un paso
    // por delante. Si alguien reordenara eso, el contador lo delataría aquí.
    G.__u5rng = { n: 0, seed: -1 };
    const rng = new OriginalRng(3);
    expect(() => rng.next(1, 0)).toThrow(RangeError);
    expect(G.__u5rng.n).toBe(0);
  });
});
