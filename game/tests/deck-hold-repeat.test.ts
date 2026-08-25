/**
 * CRUCETA DEL DECK MÓVIL: una pulsación = UN paso (auditoría UI/UX móvil 2026-07-25,
 * TANDA C — ítem del doble paso).
 *
 * El defecto: `pointerdown` disparaba el paso y montaba `setInterval(220 ms)` sin
 * retardo inicial → una pulsación de pulgar normal (~250 ms) movía DOS casillas. Aquí
 * se asevera la cadencia del auto-repeat con temporizadores FALSOS: es la única forma
 * de probarlo (la suite corre en node, sin DOM), y es exactamente la norma que se
 * incumplía.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HoldRepeat, HOLD_START_MS, HOLD_REPEAT_MS } from "../src/ui/hold-repeat.js";

describe("HoldRepeat (auto-repeat de la cruceta táctil)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("el primer disparo es INMEDIATO (el tacto no se retrasa)", () => {
    let n = 0;
    const h = new HoldRepeat(() => n++);
    h.press();
    expect(n).toBe(1);
  });

  it("EL DEFECTO: una pulsación de pulgar normal (250 ms) da UN solo paso", () => {
    let n = 0;
    const h = new HoldRepeat(() => n++);
    h.press();
    vi.advanceTimersByTime(250); // contacto típico de un tap deliberado
    h.release();
    vi.advanceTimersByTime(5_000); // …y nada más se cuela después de soltar
    expect(n, "con el interval sin retardo esto valía 2 (dos casillas)").toBe(1);
  });

  it("soltar justo ANTES del retardo no deja el setTimeout vivo (limpia AMBOS handles)", () => {
    let n = 0;
    const h = new HoldRepeat(() => n++);
    h.press();
    vi.advanceTimersByTime(HOLD_START_MS - 1);
    h.release();
    expect(h.armed, "sin temporizadores armados tras soltar").toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(n).toBe(1);
  });

  it("mantener SÍ repite: el 2º paso llega en startMs+repeatMs, no antes", () => {
    let n = 0;
    const h = new HoldRepeat(() => n++);
    h.press();
    vi.advanceTimersByTime(HOLD_START_MS);
    expect(n, "cumplido el retardo, el interval queda ARMADO (aún no dispara)").toBe(1);
    expect(h.repeating).toBe(true);
    vi.advanceTimersByTime(HOLD_REPEAT_MS);
    expect(n).toBe(2);
    vi.advanceTimersByTime(HOLD_REPEAT_MS * 3);
    expect(n, "cadencia sostenida de 220 ms").toBe(5);
    h.release();
    vi.advanceTimersByTime(10_000);
    expect(n, "soltar corta la repetición en seco").toBe(5);
  });

  it("un press() nuevo re-arma desde cero (cambio de dirección sin soltar el anterior)", () => {
    let n = 0;
    const h = new HoldRepeat(() => n++);
    h.press();
    vi.advanceTimersByTime(HOLD_START_MS + HOLD_REPEAT_MS * 2); // en repetición: 3
    expect(n).toBe(3);
    h.press(); // dispara 1 y vuelve a la fase de retardo
    expect(n).toBe(4);
    expect(h.repeating, "el press re-arma el RETARDO, no sigue repitiendo").toBe(false);
    vi.advanceTimersByTime(HOLD_START_MS - 1);
    expect(n, "la ventana de retardo se respeta también al re-armar").toBe(4);
  });

  it("release() es idempotente (pointerup + pointerleave del mismo gesto)", () => {
    let n = 0;
    const h = new HoldRepeat(() => n++);
    h.press();
    h.release();
    h.release();
    vi.advanceTimersByTime(10_000);
    expect(n).toBe(1);
  });

  it("los umbrales son los de la norma (retardo 400, cadencia 220)", () => {
    expect(HOLD_START_MS).toBe(400);
    expect(HOLD_REPEAT_MS).toBe(220);
  });
});
