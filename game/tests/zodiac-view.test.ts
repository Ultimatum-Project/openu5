/**
 * Vista de zodíaco del catalejo (LOOKOBJ look_sky) — geometría derivada del ASM.
 * Bloquea las posiciones de las tablas DATA.OVL, la puerta de la línea por Shadowlord y
 * la ROTACIÓN de la rueda por fecha (look_sky 0x41a-0x48d).
 */
import { describe, expect, it } from "vitest";
import { buildZodiacView, ZODIAC_BG_STARS } from "../src/core/world/zodiac-view.js";
import type { GameState } from "../src/core/state.js";

/** Fecha de arranque (4-5-139) = referencia de la rueda (rotación 0). */
function stateAt(
  year = 139,
  month = 4,
  day = 5,
  locs: number[] | undefined = [],
): GameState {
  return {
    shadowlordLocs: locs,
    time: { year, month, day, hour: 0, minute: 0 },
  } as unknown as GameState;
}

function seqRand(): (lo: number, hi: number) => number {
  return (lo, _hi) => lo; // siempre el mínimo: determinista
}

describe("buildZodiacView — geometría del zodíaco (ASM LOOKOBJ)", () => {
  it("80 estrellas de fondo: la X es el PRIMER rand (rango 0xb6) y la Y el segundo (0xac)", () => {
    const zv = buildZodiacView(stateAt(), (lo, hi) => Math.floor((lo + hi) / 2));
    expect(zv.bgStars).toHaveLength(ZODIAC_BG_STARS);
    for (const s of zv.bgStars) {
      // look_sky 0x3f2-0x40a: push rand(9,0xb6) ; push rand(9,0xac) ; call plot ⇒ x=0xb6, y=0xac
      // (plot 0x0c64 es PASCAL, ret 4: el primer push es AX→[0x52cc]=X).
      expect(s.x).toBeGreaterThanOrEqual(9);
      expect(s.x).toBeLessThanOrEqual(182);
      expect(s.y).toBeGreaterThanOrEqual(9);
      expect(s.y).toBeLessThanOrEqual(172);
    }
  });

  it("en la fecha de ARRANQUE (4-5-139) los signos van en la columna BASE de las tablas", () => {
    const zv = buildZodiacView(stateAt(139, 4, 5), seqRand());
    // La COLUMNA (tabla_3750, la que gira) es la X; la FILA (tabla_3758) es la Y — el primer push
    // de las dos llamadas del call site (0x4a9 y 0x4ca) sale de la columna.
    expect(zv.signs.map((s) => s.starX)).toEqual([152, 24, 72, 128, 96, 56, 40, 24]);
    expect(zv.signs.map((s) => s.y)).toEqual([144, 136, 120, 104, 88, 64, 40, 8]);
    // La línea nace 8 px a la IZQUIERDA de la estrella: el call site le pasa `col`, no `col+1`
    // (0x4b0 `dec word ptr [bp-6]` entre las dos llamadas).
    expect(zv.signs.map((s) => s.lineX)).toEqual([144, 16, 64, 120, 88, 48, 32, 16]);
    expect(zv.signs.every((s) => s.starX - s.lineX === 8)).toBe(true);
  });

  it("línea SÓLO en el signo cuya ciudad (i+1) coincide con un Shadowlord", () => {
    const zv = buildZodiacView(stateAt(139, 4, 5, [1, 0, 0]), seqRand());
    expect(zv.signs.map((s) => s.hasLine)).toEqual([true, false, false, false, false, false, false, false]);
  });

  it("sin Shadowlords (o sin datos) → ningún signo lleva línea", () => {
    expect(buildZodiacView(stateAt(139, 4, 5, []), seqRand()).signs.every((s) => !s.hasLine)).toBe(true);
    expect(buildZodiacView(stateAt(139, 4, 5, undefined), seqRand()).signs.every((s) => !s.hasLine)).toBe(true);
  });
});

describe("buildZodiacView — ROTACIÓN por fecha (rueda del zodíaco, look_sky 0x41a)", () => {
  it("un día después (4-6-139): cada signo baja una posición válida de su anillo", () => {
    const zv = buildZodiacView(stateAt(139, 4, 6), seqRand());
    // Columnas giradas 1 paso: sign0 18→11, sign1 2→20, sign2 8→5, sign3 15→13, sign4 11→9,
    // sign5 6→5, sign6 4→3, sign7 2→1 → starX = (col+1)*8.
    expect(zv.signs.map((s) => s.starX)).toEqual([96, 168, 48, 112, 80, 48, 32, 16]);
    // Las FILAS (y) NO cambian con la fecha: cada signo corre por su PISTA horizontal.
    expect(zv.signs.map((s) => s.y)).toEqual([144, 136, 120, 104, 88, 64, 40, 8]);
  });

  it("cada anillo cicla en su PERIODO: signo0 (3 slots) a los 3 días, signo7 (22) a los 22", () => {
    const base = buildZodiacView(stateAt(139, 4, 5), seqRand()).signs;
    expect(buildZodiacView(stateAt(139, 4, 8), seqRand()).signs[0]!.starX).toBe(base[0]!.starX); // +3 días
    expect(buildZodiacView(stateAt(139, 4, 27), seqRand()).signs[7]!.starX).toBe(base[7]!.starX); // +22 días
  });

  it("fecha ANTERIOR o igual a la referencia → sin rotar (columna base)", () => {
    const base = buildZodiacView(stateAt(139, 4, 5), seqRand()).signs.map((s) => s.starX);
    expect(buildZodiacView(stateAt(139, 4, 1), seqRand()).signs.map((s) => s.starX)).toEqual(base);
    expect(buildZodiacView(stateAt(138, 13, 28), seqRand()).signs.map((s) => s.starX)).toEqual(base);
  });

  it("meses cuentan 28 días: +1 mes = +28 pasos (signo0: 28 % 3 = 1 → como +1 día)", () => {
    const oneDay = buildZodiacView(stateAt(139, 4, 6), seqRand()).signs[0]!.starX;
    expect(buildZodiacView(stateAt(139, 5, 5), seqRand()).signs[0]!.starX).toBe(oneDay); // +28 días
  });
});
