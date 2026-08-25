/**
 * ANDAMIAJE arena-entry — test de la ELECCIÓN de grupo de player-starts al entrar a una sala.
 * ~~El MAPPING exacto (OPPOSITE vs SAME) está PENDIENTE DE ORÁCULO~~
 * [HISTÓRICO 2026-07-25: superado por P0a en main 0ab4b008 — mapping = OPPOSITE-of-facing
 * ESTÁTICO, derivado 72/72 (thunk 0x7C3E→DNGLOOK 0x117E) y cableado en game.ts.]
 * Este test fija el MECANISMO de elección + el guard anti-(0,0) con la hipótesis actual.
 * Al confirmar el oráculo, se ajusta OPPOSITE_EDGE (si difiere) y estas aserciones — y
 * recién entonces se cablea en game.ts. [ídem: ya cableado, ver anotación arriba]
 */
import { describe, it, expect } from "vitest";
import { roomEntryDirection, roomEntryDirectionFor, isDegenerateStarts, OPPOSITE_EDGE } from "../src/core/combat/roomEntry";

const G = (n: [number, number][]) => n.map(([x, y]) => ({ x, y }));
const REAL = G([[4, 8], [5, 9], [3, 9]]);
const DEGEN = G([[0, 0], [0, 0], [0, 0]]);

describe("arena-entry: elección del grupo de player-starts de sala (mapping DERIVADO 72/72)", () => {
  it("elige el grupo OPUESTO al facing de marcha (vienes del borde opuesto)", () => {
    expect(roomEntryDirection("north")).toBe("south");
    expect(roomEntryDirection("south")).toBe("north");
    expect(roomEntryDirection("east")).toBe("west");
    expect(roomEntryDirection("west")).toBe("east");
  });

  it("OPPOSITE_EDGE es una involución (opuesto del opuesto = original)", () => {
    for (const f of ["north", "south", "east", "west"] as const) {
      expect(OPPOSITE_EDGE[OPPOSITE_EDGE[f]]).toBe(f);
    }
  });

  it("detecta un grupo DEGENERADO (todo (0,0)) — el guard anti-(0,0)", () => {
    expect(isDegenerateStarts([{ x: 0, y: 0 }, { x: 0, y: 0 }])).toBe(true);
    expect(isDegenerateStarts([{ x: 4, y: 8 }, { x: 0, y: 0 }])).toBe(false);
    expect(isDegenerateStarts([])).toBe(false);
  });

  it("roomEntryDirectionFor: elige OPPOSITE(facing) cuando el grupo es real", () => {
    const ps = { north: REAL, south: REAL, east: REAL, west: REAL };
    expect(roomEntryDirectionFor(ps, "north")).toBe("south");
    expect(roomEntryDirectionFor(ps, "east")).toBe("west");
  });

  it("roomEntryDirectionFor: guard anti-(0,0) cae al primer grupo real si el elegido es degenerado", () => {
    // facing este → primario "west"; si west es degenerado, cae al primer real (south antes que north/east).
    const ps = { north: REAL, south: REAL, east: REAL, west: DEGEN };
    expect(roomEntryDirectionFor(ps, "east")).toBe("south");
  });
});
