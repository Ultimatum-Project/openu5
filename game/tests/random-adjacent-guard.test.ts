import { describe, it, expect } from "vitest";
import { CombatRng, randomAdjacentCell } from "../src/core/combat/formulas.js";
import { OriginalRng } from "../src/core/rng-original.js";

/**
 * GUARDA de `randomAdjacentCell` — bomba latente destapada auditando la regresión candidata
 * de ad17 (`re/notes/auditoria-regresion-ad17-lote.md` §2).
 *
 * `randomAdjacentCell` es un `for(;;)` FIEL (COMSUBS:0x07D4) que reintenta hasta caer en el
 * tablero. Termina siempre… mientras el centro pueda producir alguna celda válida. Con los
 * desplazamientos ±1, el 3×3 de (x,y) intersecta `[0,10]²` sólo si `x,y ∈ [−1, 11]`. Un centro
 * más lejos **colgaría el renderer** en vez de lanzar — el peor modo de fallo: sin traza y sin
 * test rojo, sólo una pestaña muerta (que playwright reporta como «context destroyed»).
 *
 * Hoy el dato no lo dispara (0 unidades del `.CBT` fuera del 11×11), así que estos tests
 * protegen el FUTURO, no arreglan un fallo vivo.
 */
const rng = (): CombatRng => new CombatRng(new OriginalRng(0));

describe("randomAdjacentCell: la guarda LANZA en vez de colgar", () => {
  it("centro claramente fuera de tablero ⇒ Error explícito (no cuelgue)", () => {
    for (const [x, y] of [
      [-2, 5],
      [12, 5],
      [5, -2],
      [5, 12],
      [99, 99],
      [-50, 0],
    ] as const) {
      expect(() => randomAdjacentCell(x, y, rng()), `(${x},${y})`).toThrow(/fuera de rango/);
    }
  });

  it("coordenadas no enteras ⇒ Error (el ±1 nunca daría un entero válido)", () => {
    expect(() => randomAdjacentCell(5.5, 5, rng())).toThrow(/fuera de rango/);
    expect(() => randomAdjacentCell(NaN, 5, rng())).toThrow(/fuera de rango/);
  });
});

describe("y NO cambia nada para centros válidos (fidelidad intacta)", () => {
  it("el borde justo permitido (±1 fuera del tablero) SIGUE funcionando", () => {
    // x=-1 e y=11 son válidos: su 3×3 toca el tablero. El binario los admite.
    for (const [x, y] of [
      [-1, 0],
      [11, 10],
      [0, -1],
      [10, 11],
      [-1, -1],
      [11, 11],
    ] as const) {
      const c = randomAdjacentCell(x, y, rng());
      expect(c.x, `(${x},${y}) → x en tablero`).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(10);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(10);
    }
  });

  it("las 4 esquinas y el centro devuelven celdas del vecindario ±1", () => {
    for (const [x, y] of [
      [0, 0],
      [10, 0],
      [0, 10],
      [10, 10],
      [5, 5],
    ] as const) {
      const c = randomAdjacentCell(x, y, rng());
      expect(Math.abs(c.x - x), `(${x},${y}) dx`).toBeLessThanOrEqual(1);
      expect(Math.abs(c.y - y), `(${x},${y}) dy`).toBeLessThanOrEqual(1);
    }
  });

  it("★ CONSUMO DE RNG BYTE-IDÉNTICO: la guarda no gasta ni un `rand`", () => {
    // Dos ejecuciones desde la misma semilla deben dar la MISMA celda y dejar el stream en
    // el mismo punto. Si la guarda consumiera RNG, la 2ª tirada divergiría.
    const a = new CombatRng(new OriginalRng(0));
    const b = new CombatRng(new OriginalRng(0));
    for (let i = 0; i < 20; i++) {
      expect(randomAdjacentCell(5, 5, a)).toEqual(randomAdjacentCell(5, 5, b));
    }
    // y el stream sigue alineado tras 20 llamadas
    expect(a.randRange(1, 100)).toBe(b.randRange(1, 100));
  });
});
