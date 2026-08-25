/**
 * "THE SUMMONING" — el cuarto top-down del attract (task #19). Helpers PUROS del
 * cuarto (base de muros/suelo, mobiliario, revelado por cortina, ciclo del demo).
 * Deriva/witness: `re/notes/intro-splash-anim-audit.md §2.4` + `video-P` f061–f093.
 */
import { describe, expect, it } from "vitest";
import {
  curtainHalfWidth,
  ROOM_COLS,
  ROOM_MOONGATE_COL,
  ROOM_MOONGATE_ROW,
  ROOM_OVERLAYS,
  ROOM_ROWS,
  roomBaseTile,
  summoningStep,
  SUMMONING_TIMINGS,
  WALL_TILE,
  FLOOR_TILE,
} from "../src/skin/fiel/summoning-room.js";

describe("roomBaseTile (estructura muros/suelo del cuarto)", () => {
  it("el perímetro es MURO y el interior SUELO", () => {
    // esquinas y bordes = muro
    expect(roomBaseTile(0, 0)).toBe(WALL_TILE);
    expect(roomBaseTile(ROOM_COLS - 1, ROOM_ROWS - 1)).toBe(WALL_TILE);
    expect(roomBaseTile(5, 0)).toBe(WALL_TILE); // fila superior
    expect(roomBaseTile(0, 2)).toBe(WALL_TILE); // columna izq
    expect(roomBaseTile(ROOM_COLS - 1, 2)).toBe(WALL_TILE); // columna der
    // interior = suelo
    expect(roomBaseTile(5, 2)).toBe(FLOOR_TILE);
    expect(roomBaseTile(ROOM_MOONGATE_COL, ROOM_MOONGATE_ROW)).toBe(FLOOR_TILE);
  });
});

describe("ROOM_OVERLAYS (mobiliario calcado de f070)", () => {
  it("cada pieza cae DENTRO de la rejilla del cuarto", () => {
    for (const o of ROOM_OVERLAYS) {
      expect(o.col).toBeGreaterThanOrEqual(0);
      expect(o.col).toBeLessThan(ROOM_COLS);
      expect(o.row).toBeGreaterThanOrEqual(0);
      expect(o.row).toBeLessThan(ROOM_ROWS);
      expect(o.tile).toBeGreaterThan(0);
    }
  });
  it("ninguna pieza tapa la casilla del moongate (queda libre para su animación)", () => {
    for (const o of ROOM_OVERLAYS) {
      expect(o.col === ROOM_MOONGATE_COL && o.row === ROOM_MOONGATE_ROW).toBe(false);
    }
  });
});

describe("curtainHalfWidth (apertura de la cortina desde el moongate)", () => {
  it("t=0 sólo asoma la semilla central; t=1 cubre media pantalla", () => {
    expect(curtainHalfWidth(0, 300, 8)).toBe(8);
    expect(curtainHalfWidth(1, 300, 8)).toBe(150);
  });
  it("es monótona creciente y clampa fuera de [0,1]", () => {
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const w = curtainHalfWidth(t, 300);
      expect(w).toBeGreaterThanOrEqual(prev);
      prev = w;
    }
    expect(curtainHalfWidth(-1, 300, 8)).toBe(8);
    expect(curtainHalfWidth(2, 300, 8)).toBe(150);
  });
});

describe("summoningStep (ciclo del demo: reveal → hold → menú)", () => {
  it("en reveal, t crece con el tiempo y no ha concluido", () => {
    const s = summoningStep("reveal", SUMMONING_TIMINGS.revealMs / 2);
    expect(s.stage).toBe("reveal");
    expect(s.t).toBeCloseTo(0.5, 5);
    expect(s.done).toBe(false);
  });
  it("al completar el reveal pasa a hold (t=1)", () => {
    const s = summoningStep("reveal", SUMMONING_TIMINGS.revealMs);
    expect(s.stage).toBe("hold");
    expect(s.t).toBe(1);
    expect(s.done).toBe(false);
  });
  it("el hold concluye (→ menú) sólo tras holdMs", () => {
    expect(summoningStep("hold", SUMMONING_TIMINGS.holdMs - 1).done).toBe(false);
    expect(summoningStep("hold", SUMMONING_TIMINGS.holdMs).done).toBe(true);
  });
});
