/**
 * CHISPAS del campo mágico (DUNGEON.OVL `magic_field_sparkle_drawer` @0x127e).
 *
 * Fija las cuatro tablas byte-exactas de DATA.OVL, las DOS tiradas por chispa y
 * —lo que más importa— EL EJE DE CADA ARGUMENTO: cuenta y caja por PROFUNDIDAD,
 * color por TIPO de campo. El ledger y asm100-censo-acta §46.2/§46.3 los citan
 * al revés; los dos ejes son 0..3, así que un aserto que sólo mirase una
 * profundidad con un tipo pasaría con la lectura invertida. Por eso los dos
 * asertos de eje instancian la diferencia DONDE EXISTE: mismo tipo con
 * profundidades distintas ⇒ MISMO color; misma profundidad con tipos distintos
 * ⇒ colores DISTINTOS.
 */
import { describe, expect, it } from "vitest";
import {
  FIELD_SPARK_COLOR,
  FIELD_SPARK_COUNT,
  FIELD_SPARK_HI,
  FIELD_SPARK_LEN,
  FIELD_SPARK_LO,
  fieldSparkRects,
} from "../src/skin/fiel/dungeon-decor.js";

/** `rand` determinista que además CUENTA las tiradas (para el aserto de consumo). */
function contador(): { rand: (lo: number, hi: number) => number; tiradas: () => number } {
  let n = 0;
  return {
    rand: (lo, hi) => {
      n++;
      // Alterna extremo bajo y alto: barre los dos bordes de la caja.
      return n % 2 === 0 ? hi : lo;
    },
    tiradas: () => n,
  };
}

describe("chispas del campo mágico (0x127e)", () => {
  it("las cuatro tablas son las de DATA.OVL, y son monótonas en la distancia", () => {
    expect([...FIELD_SPARK_COUNT]).toEqual([300, 100, 50, 15]); // DS 0x2e52
    expect([...FIELD_SPARK_LO]).toEqual([16, 56, 80, 92]); // DS 0x2e42
    expect([...FIELD_SPARK_HI]).toEqual([167, 135, 111, 99]); // DS 0x2e4a
    expect([...FIELD_SPARK_LEN]).toEqual([7, 7, 5, 2]); // DS 0x2e5a
    // La monotonía es el discriminante que adjudicó el eje: la caja se ENCOGE y
    // las chispas se RAREAN con la distancia. Indexadas por tipo no tendría sentido.
    for (let d = 1; d < 4; d++) {
      expect(FIELD_SPARK_COUNT[d]!).toBeLessThan(FIELD_SPARK_COUNT[d - 1]!);
      expect(FIELD_SPARK_LO[d]!).toBeGreaterThan(FIELD_SPARK_LO[d - 1]!);
      expect(FIELD_SPARK_HI[d]!).toBeLessThan(FIELD_SPARK_HI[d - 1]!);
      expect(FIELD_SPARK_LEN[d]!).toBeLessThanOrEqual(FIELD_SPARK_LEN[d - 1]!);
    }
  });

  it("el CARDINAL de chispas lo fija la PROFUNDIDAD, no el tipo", () => {
    for (let d = 0; d < 4; d++) {
      // Mismo tipo, profundidad variable: el cardinal cambia con la tabla.
      expect(fieldSparkRects(d, 0, contador().rand)).toHaveLength(FIELD_SPARK_COUNT[d]!);
      // Misma profundidad, tipo variable: el cardinal NO se mueve.
      for (const tipo of [0, 1, 2, 3]) {
        expect(fieldSparkRects(d, tipo, contador().rand)).toHaveLength(FIELD_SPARK_COUNT[d]!);
      }
    }
  });

  it("gasta DOS tiradas por chispa (0x1304 y 0x130f)", () => {
    for (let d = 0; d < 4; d++) {
      const c = contador();
      fieldSparkRects(d, 0, c.rand);
      expect(c.tiradas()).toBe(2 * FIELD_SPARK_COUNT[d]!);
    }
  });

  it("el COLOR lo fija el TIPO de campo, no la profundidad", () => {
    // Mismo tipo a distintas profundidades: MISMO color (mata la lectura invertida).
    for (const tipo of [0, 1, 2, 3]) {
      const colores = [0, 1, 2, 3].map((d) => fieldSparkRects(d, tipo, contador().rand)[0]!.color);
      expect(new Set(colores).size).toBe(1);
      expect(colores[0]).toBe(FIELD_SPARK_COLOR[tipo]!);
    }
    // Misma profundidad con tipos que difieren: colores DISTINTOS. Los cuatro
    // globales valen 2,1,2,1 (+8) ⇒ el par discriminante es tipo 0 contra tipo 1.
    const a = fieldSparkRects(1, 0, contador().rand)[0]!.color;
    const b = fieldSparkRects(1, 1, contador().rand)[0]!.color;
    expect(a).toBe(10);
    expect(b).toBe(9);
    expect(a).not.toBe(b);
  });

  it("cada trazo es un hline INCLUSIVO dentro de la caja de su profundidad", () => {
    for (let d = 0; d < 4; d++) {
      const lo = FIELD_SPARK_LO[d]!;
      const hi = FIELD_SPARK_HI[d]!;
      const len = FIELD_SPARK_LEN[d]!;
      for (const r of fieldSparkRects(d, 0, contador().rand)) {
        expect(r.h).toBe(1);
        expect(r.w).toBe(len + 1); // hline(x, y, x+len) inclusivo
        expect(r.x).toBeGreaterThanOrEqual(lo);
        expect(r.x + len).toBeLessThanOrEqual(hi); // el trazo no se sale por la derecha
        expect(r.y).toBeGreaterThanOrEqual(lo);
        expect(r.y).toBeLessThanOrEqual(hi);
      }
    }
  });

  it("profundidad fuera de 0..3 no dibuja (no hay fila de tabla que leer)", () => {
    expect(fieldSparkRects(4, 0, contador().rand)).toEqual([]);
    expect(fieldSparkRects(-1, 0, contador().rand)).toEqual([]);
  });
});
