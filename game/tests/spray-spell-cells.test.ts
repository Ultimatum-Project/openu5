/**
 * COBERTURA del abanico de hechizos de línea (CAST.OVL 0x1f60→0x1c36→0x1bb0) —
 * re-derivación 2026-07-22 (carril fiel/line-spell-mech,
 * `re/notes/fx-lineaoe-negate-derivation.md` §3). SUPERA el esqueleto
 * «traceSpellLine + radialHit» (bolt con gate de probabilidad): la cobertura
 * real es el conjunto DETERMINISTA de celdas registradas por los 21 rayos
 * (registro en filas de y impar, corte LOS 0x6a14, dedupe 0xab02, cap 63).
 */
import { describe, expect, it } from "vitest";
import {
  SPELL_LOS_OPAQUE,
  SPELL_LOS_TRANSPARENT,
  SPRAY_SLOPE_CURVE,
  blocksSpellLine,
} from "../src/core/magic/areaSpellTables.js";
import { spraySpellCells, type SprayCell } from "../src/core/magic/areaSpell.js";

// bitmap 0x6a14 verbatim (relevo del oráculo) para la comprobación independiente.
const hex = (s: string): number[] => s.trim().split(/\s+/).map((h) => parseInt(h, 16));
const bmSet = (b: number[]): Set<number> => {
  const s = new Set<number>();
  for (let t = 0; t < 256; t++) if ((b[t >> 3]! & (0x80 >> (t & 7))) !== 0) s.add(t);
  return s;
};

describe("tablas VERBATIM del binario (polaridad 0x6a14 corregida por disasm)", () => {
  it("bit SET = TRANSPARENTE (210), bit CLEAR = OPACO (46); kernel 0x3f6e devuelve 1 si bit set", () => {
    const setBits = bmSet(hex(
      "ff f3 c3 8f ff ff ff c0 dd f8 03 df ff ff 00 00 ff ff ff ff ff ff ff 3f ff ff ff fe ff ff ff ff",
    ));
    // los 210 bits SET son los TRANSPARENTES; los 46 restantes (clear) son los OPACOS.
    expect(new Set(SPELL_LOS_TRANSPARENT)).toEqual(setBits);
    expect(SPELL_LOS_TRANSPARENT.size).toBe(210);
    expect(SPELL_LOS_OPAQUE.size).toBe(46);
    // disjuntos y completos.
    for (let t = 0; t < 256; t++) {
      expect(SPELL_LOS_TRANSPARENT.has(t)).toBe(!SPELL_LOS_OPAQUE.has(t));
    }
    // sanidad: hierba 0x05 transparente (field-witness sembró sobre hierba); montaña 0x0c opaca.
    expect(SPELL_LOS_TRANSPARENT.has(0x05)).toBe(true);
    expect(SPELL_LOS_OPAQUE.has(0x0c)).toBe(true);
  });
  it("SPRAY_SLOPE_CURVE == 21 words de DATA.OVL 0x1d00 (pico 2000 = rayo recto central)", () => {
    expect(SPRAY_SLOPE_CURVE).toEqual([
      10, 12, 14, 16, 20, 25, 35, 50, 80, 190, 2000, 190, 80, 50, 35, 25, 20, 16, 14, 12, 10,
    ]);
    expect(SPRAY_SLOPE_CURVE).toHaveLength(21);
    expect(SPRAY_SLOPE_CURVE[10]).toBe(2000); // centro: pendiente perpendicular 10/2000 ≈ recto
  });
});

const NO_WALLS = (): boolean => false;
const has = (cells: SprayCell[], x: number, y: number): boolean =>
  cells.some((c) => c.x === x && c.y === y);

describe("spraySpellCells — cobertura determinista del abanico (0x1c36)", () => {
  it("este desde (2,2), campo abierto: cubre el pasillo (3..9,2) y el cono; nunca la celda del caster", () => {
    const cells = spraySpellCells({ x: 2, y: 2 }, { x: 1, y: 0 }, NO_WALLS);
    for (let x = 3; x <= 9; x++) expect(has(cells, x, 2)).toBe(true); // pasillo central
    expect(has(cells, 5, 1)).toBe(true); // el cono se abre (NO es un bolt de 1 celda de ancho)
    expect(has(cells, 5, 3)).toBe(true); // …simétrico al otro lado
    expect(has(cells, 2, 2)).toBe(false); // la celda del caster nunca se registra
    // dedupe (mapa 0xab02): sin repetidos.
    const keys = cells.map((c) => c.y * 32 + c.x);
    expect(new Set(keys).size).toBe(keys.length);
    // bounds del tablero (1e05-1e1f) y cap 63 (1dff).
    for (const c of cells) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThan(11);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThan(11);
    }
    expect(cells.length).toBeLessThanOrEqual(63);
  });

  it("determinista: dos llamadas idénticas ⇒ misma lista (cero RNG)", () => {
    const a = spraySpellCells({ x: 2, y: 2 }, { x: 1, y: 0 }, NO_WALLS);
    const b = spraySpellCells({ x: 2, y: 2 }, { x: 1, y: 0 }, NO_WALLS);
    expect(a).toEqual(b);
  });

  it("corte LOS: muro en (4,2) — la celda opaca NO se registra y (5,2) queda protegida", () => {
    const cells = spraySpellCells(
      { x: 2, y: 2 },
      { x: 1, y: 0 },
      (cx, cy) => cx === 4 && cy === 2,
    );
    expect(has(cells, 4, 2)).toBe(false); // 1dfb je 0x1e68: el muro no entra
    expect(has(cells, 5, 2)).toBe(false); // todos los rayos de la fila 2 cortan en el muro
    expect(has(cells, 3, 2)).toBe(true); // antes del muro sí
  });

  it("GOTEO fiel (0x1bb0 1c03 `test y,1`): el muro PEGADO al caster no protege la celda siguiente", () => {
    // Casteo horizontal: el pasillo central corre por la fila de píxel y par (cy*16+8),
    // así que los rayos casi-rectos cruzan la columna adyacente SIN consultar la LOS
    // (solo filas impares la consultan) y registran las celdas de detrás — binario, no bug.
    const cells = spraySpellCells(
      { x: 2, y: 2 },
      { x: 1, y: 0 },
      (cx, cy) => cx === 3 && cy === 2,
    );
    expect(has(cells, 3, 2)).toBe(false); // el muro mismo nunca entra
    expect(has(cells, 4, 2)).toBe(true); // los rayos 9/11 se cuelan por la fila par
  });

  it("las 4 direcciones nacen del borde correcto (0x1c6a-0x1cec) y cubren la celda frontal", () => {
    expect(has(spraySpellCells({ x: 5, y: 5 }, { x: 0, y: -1 }, NO_WALLS), 5, 4)).toBe(true); // N
    expect(has(spraySpellCells({ x: 5, y: 5 }, { x: 0, y: 1 }, NO_WALLS), 5, 6)).toBe(true); // S
    expect(has(spraySpellCells({ x: 5, y: 5 }, { x: -1, y: 0 }, NO_WALLS), 4, 5)).toBe(true); // O
    expect(has(spraySpellCells({ x: 5, y: 5 }, { x: 1, y: 0 }, NO_WALLS), 6, 5)).toBe(true); // E
    for (const d of [
      { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 },
    ]) {
      const cells = spraySpellCells({ x: 5, y: 5 }, d, NO_WALLS);
      expect(has(cells, 5, 5)).toBe(false); // caster fuera en las 4 direcciones
      expect(cells.length).toBeLessThanOrEqual(63); // cap 63 (1dff)
    }
  });

  it("blocksSpellLine sigue siendo el predicado 0x6a14 (0x0c opaco, 0x05 transparente)", () => {
    expect(blocksSpellLine(0x0c)).toBe(true);
    expect(blocksSpellLine(0x05)).toBe(false);
  });
});
