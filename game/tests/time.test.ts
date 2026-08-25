import { describe, expect, it } from "vitest";
import { advanceMinutes, dayPhase, scheduleIndex } from "../src/core/time.js";

describe("advanceMinutes", () => {
  it("avanza minutos con acarreo de hora/día/mes/año (13 meses de 28 días)", () => {
    const t = { year: 139, month: 4, day: 7, hour: 23, minute: 58 };
    expect(advanceMinutes(t, 3)).toEqual({ year: 139, month: 4, day: 8, hour: 0, minute: 1 });
    expect(advanceMinutes({ ...t, day: 28, month: 13 }, 3)).toEqual({
      year: 140, month: 1, day: 1, hour: 0, minute: 1,
    });
  });
});

describe("dayPhase", () => {
  it("clasifica noche/alba/día/ocaso", () => {
    expect(dayPhase({ year: 0, month: 1, day: 1, hour: 2, minute: 0 })).toBe("night");
    expect(dayPhase({ year: 0, month: 1, day: 1, hour: 5, minute: 30 })).toBe("dawn");
    expect(dayPhase({ year: 0, month: 1, day: 1, hour: 12, minute: 0 })).toBe("day");
    expect(dayPhase({ year: 0, month: 1, day: 1, hour: 20, minute: 15 })).toBe("dusk");
    expect(dayPhase({ year: 0, month: 1, day: 1, hour: 22, minute: 0 })).toBe("night");
  });
});

describe("scheduleIndex (port de NonPlayerCharacterSchedule.cs)", () => {
  it("todo ceros → posición 0 fija", () => {
    expect(scheduleIndex([0, 0, 0, 0], 13)).toBe(0);
  });
  it("coincidencia exacta con times[i] → getIndex(i), con times[3]→1", () => {
    const times = [8, 12, 18, 22];
    expect(scheduleIndex(times, 8)).toBe(0);
    expect(scheduleIndex(times, 12)).toBe(1);
    expect(scheduleIndex(times, 18)).toBe(2);
    expect(scheduleIndex(times, 22)).toBe(1); // índice 3 remapea a posición 1
  });
  it("entre tiempos sigue las reglas del original", () => {
    const times = [8, 12, 18, 22];
    expect(scheduleIndex(times, 10)).toBe(0); // t0<h<t1 → 0
    expect(scheduleIndex(times, 15)).toBe(1); // t1<h<t2 → 1
    expect(scheduleIndex(times, 20)).toBe(2); // t2<h<t3 → 2
    expect(scheduleIndex(times, 23)).toBe(1); // t3<h<t0 (wrap) → 1
    expect(scheduleIndex(times, 3)).toBe(1); // wrap por madrugada → 1
  });
});
