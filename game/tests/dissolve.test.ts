/**
 * Calco del recorrido de la tabla de orden del dissolve EGA (fn37, EGA.DRV pass_down 0x1d13
 * / pass_up 0x1d54): acumula filas y en cada 0xFF cierra un lote; 6 lotes por dissolve.
 */
import { describe, it, expect } from "vitest";
import {
  DISSOLVE_BATCH_MARKER,
  DISSOLVE_STEPS,
  dissolvePass,
  dissolveRevealBatches,
} from "../src/core/transition/dissolve.js";
import {
  DISSOLVE_BANDS,
  DISSOLVE_ROW_FIRST,
  DISSOLVE_ROW_LAST,
} from "../src/core/transition/dissolveTable.js";

describe("constantes del dissolve", () => {
  it("marcador de lote 0xFF y 6 lotes por dissolve (cs:[0x1b23]=6)", () => {
    expect(DISSOLVE_BATCH_MARKER).toBe(0xff);
    expect(DISSOLVE_STEPS).toBe(6);
  });
});

describe("dissolvePass — recorrido de la tabla de orden", () => {
  // Tabla sintética: filas 0,1,2 | 3,4 | 5 (3 lotes), con 0xFF de fin-de-lote.
  const order = [0, 1, 2, 0xff, 3, 4, 0xff, 5, 0xff];

  it("down: recorre de fin a inicio (índice count−1 → 0), cierra lote en cada 0xFF", () => {
    // Empieza en el último (idx 8 = 0xff) → cierra lote vacío; luego 5 → lote [5]; 0xff cierra;
    // 4,3 → [4,3]; 0xff cierra; 2,1,0 acumulan (sin 0xff final en ese extremo).
    expect(dissolvePass(order, "down")).toEqual([[], [5], [4, 3]]);
  });

  it("up: recorre de idx 1 hacia arriba (0x1d54=1, inc), acumulando en orden directo", () => {
    // idx1=1,idx2=2 → [1,2]; 0xff cierra; 3,4 → [3,4]; 0xff cierra; 5 → [5]; 0xff cierra.
    expect(dissolvePass(order, "up")).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("respeta maxSteps (para tras N lotes)", () => {
    expect(dissolvePass(order, "up", 1)).toEqual([[1, 2]]);
  });

  it("sólo los lotes CERRADOS por 0xFF se emiten; lo acumulado sin 0xFF final NO (calco: sólo 0xFF llama transition_step)", () => {
    expect(dissolvePass([10, 20, 0xff], "up")).toEqual([[20]]); // up desde idx1: 20, luego 0xff cierra
    // down: idx2=0xff cierra lote vacío; luego 20,10 se acumulan pero SIN 0xff → no se revelan.
    expect(dissolvePass([10, 20, 0xff], "down")).toEqual([[]]);
  });
});

describe("DISSOLVE_BANDS — tabla de EGA.DRV addr 0x1e8c (byte-exacta)", () => {
  it("son 7 bandas anidadas y expansivas (startRow 75→46, count 3→61)", () => {
    expect(DISSOLVE_BANDS).toHaveLength(7); // primer byte de la tabla = nº de niveles
    expect(DISSOLVE_BANDS.map((b) => b.startRow)).toEqual([75, 72, 71, 66, 60, 53, 46]);
    expect(DISSOLVE_BANDS.map((b) => b.count)).toEqual([3, 7, 11, 20, 32, 45, 61]);
  });

  it("srcOffset acumula los counts (0,3,10,21,41,73,118)", () => {
    let acc = 0;
    for (const band of DISSOLVE_BANDS) {
      expect(band.srcOffset).toBe(acc);
      acc += band.count;
    }
  });

  it("6 de 7 bandas son permutación completa 0..count-1; L5 trae el QUIRK del binario (idx 19 dos veces, 29 ausente)", () => {
    for (let i = 0; i < DISSOLVE_BANDS.length; i++) {
      const band = DISSOLVE_BANDS[i]!;
      const idx = band.order.filter((b) => b !== DISSOLVE_BATCH_MARKER).sort((a, b) => a - b);
      if (i === 5) {
        // Dato REAL de EGA.DRV (no un typo): la banda 5 repite el índice 19 y omite el 29.
        // Inofensivo: la copia de scanline es idempotente y la scanline 53+29=82 la cubre la
        // banda 6 (46..106), que solapa. Se fija aquí para PROBAR que el volcado es byte-exacto.
        expect(idx.filter((v) => v === 19)).toHaveLength(2);
        expect(idx).not.toContain(29);
      } else {
        expect(idx).toEqual([...Array(band.count).keys()]);
      }
    }
  });

  it("la UNIÓN de las 7 bandas (solapadas) cubre TODA fila 46..106 sin huecos", () => {
    const covered = new Set<number>();
    for (const b of DISSOLVE_BANDS) {
      for (const v of b.order) if (v !== DISSOLVE_BATCH_MARKER) covered.add(b.startRow + v);
    }
    for (let row = DISSOLVE_ROW_FIRST; row <= DISSOLVE_ROW_LAST; row++) {
      expect(covered.has(row)).toBe(true); // incl. la 82 que L5 se salta, cubierta por L6
    }
  });
});

describe("dissolveRevealBatches — secuencia de scanlines del melt", () => {
  const batches = dissolveRevealBatches(DISSOLVE_BANDS);

  it("no emite lotes vacíos (los 0xFF de puro delay se descartan)", () => {
    expect(batches.every((b) => b.length > 0)).toBe(true);
  });

  it("toda scanline revelada cae en el rango de su banda (46..107)", () => {
    for (const b of batches) {
      for (const row of b) {
        expect(row).toBeGreaterThanOrEqual(DISSOLVE_ROW_FIRST);
        expect(row).toBeLessThanOrEqual(DISSOLVE_ROW_LAST);
      }
    }
  });

  it("emite Σcounts = 179 revelados (una operación de copia por índice de tabla; L5 repite uno)", () => {
    const revealed = batches.flat();
    expect(revealed).toHaveLength(DISSOLVE_BANDS.reduce((s, b) => s + b.count, 0));
    expect(revealed).toHaveLength(179);
  });

  it("primer lote real sale de la banda 0 (startRow 75): idx {2,0} → scanlines [77,75]", () => {
    // L0 order down (idx length−1↓): tras el 0xff inicial acumula idx 0x02,0x00 y el
    // siguiente 0xff cierra el lote → [75+2, 75+0]. Ver dissolve-derivation.md.
    expect(batches[0]).toEqual([77, 75]);
  });
});
