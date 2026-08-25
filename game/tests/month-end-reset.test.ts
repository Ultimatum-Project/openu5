import { describe, expect, it } from "vitest";
import type { GameState } from "../src/core/state.js";
import { advanceClock } from "../src/core/world/survival.js";

/**
 * CERO DE FIN DE MES — `kernel_advance_clock` ULTIMA.EXE 0x505c-0x506f (#54 pieza 9).
 *
 * En el mismo bloque que pone el día a 1 (`cmp [g_day],0x1c / jbe`), el binario hace
 * `sub al,al` y escribe 0 en CINCO bytes: 0x585a · 0x5859 · 0x5858 · 0x57b2 · 0x5959.
 * El clon los OMITÍA, así que el sello del árbol de skull keys de Minoc se arrastraba
 * para siempre y el árbol no volvía a dar llaves nunca más tras el primer hallazgo.
 */
function stateAt(day: number, over: Partial<GameState> = {}): GameState {
  return {
    characters: [],
    time: { year: 139, month: 4, day, hour: 23, minute: 59 },
    turnsSinceStart: 0,
    torchTurns: 0,
    ...over,
  } as unknown as GameState;
}

describe("cero de fin de mes (ULTIMA.EXE 0x505c-0x506f)", () => {
  it("★ el rollover de MES borra el sello del árbol de skull keys", () => {
    const s = stateAt(28, { skullTreeFoundDay: 17 });
    advanceClock(s, 1); // 23:59 → 00:00 del día 29 ⇒ día 29 > 28 ⇒ mes nuevo
    expect(s.time.day, "el día vuelve a 1 (0x506a)").toBe(1);
    expect(s.time.month, "y el mes avanza").toBe(5);
    expect(s.skullTreeFoundDay, "0x5067: el sello se borra").toBe(0);
  });

  it("un rollover de DÍA que NO cambia de mes deja el sello intacto", () => {
    // Control positivo: el borrado cuelga del `cmp [g_day],0x1c`, no de la medianoche.
    // Sin este caso, «poner el sello a 0 en cada medianoche» pasaría igual de verde.
    const s = stateAt(17, { skullTreeFoundDay: 17 });
    advanceClock(s, 1);
    expect(s.time.day).toBe(18);
    expect(s.time.month).toBe(4);
    expect(s.skullTreeFoundDay, "sigue sellado: no hubo cambio de mes").toBe(17);
  });

  it("tras el borrado, el árbol vuelve a estar disponible el mismo día 1", () => {
    // El gate de la lectora es `time.day !== skullTreeFoundDay` (SJOG 0x0574-0x0580).
    // Con el sello a 0 y el día a 1, vuelve a dar — que es el efecto JUGABLE del fix.
    const s = stateAt(28, { skullTreeFoundDay: 1 }); // sellado un «día 1» anterior
    advanceClock(s, 1);
    expect(s.time.day).toBe(1);
    expect(s.time.day !== s.skullTreeFoundDay, "disponible otra vez").toBe(true);
  });
});
