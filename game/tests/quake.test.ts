/**
 * Terremoto (task #29) — dinámica de la sacudida del viewport y su disparo desde el
 * core (clavicémbalo + palabra de poder). La dinámica está DERIVADA DEL TESTIGO
 * (HARPSI_SANDALWOOD_QUAKE.mov): eje vertical, ~2 px EGA, 8 pulsos, ~8.5 Hz, ~0.9 s.
 * Ver re/notes/quake-harpsichord.md.
 */
import { describe, expect, it } from "vitest";
import {
  QuakeShake,
  quakeOffsetAt,
  QUAKE_AMPLITUDE_PX,
  QUAKE_PULSES,
  QUAKE_PERIOD_MS,
  QUAKE_DOWN_MS,
  QUAKE_DURATION_MS,
} from "../src/skin/fiel/quake.js";

describe("quake — onda de la sacudida (quakeOffsetAt)", () => {
  it("desplaza el viewport ABAJO (amplitud >0) al inicio de cada pulso", () => {
    for (let p = 0; p < QUAKE_PULSES; p++) {
      const t = p * QUAKE_PERIOD_MS + 1; // dentro del tramo desplazado
      expect(quakeOffsetAt(t)).toBe(QUAKE_AMPLITUDE_PX);
    }
  });

  it("vuelve a reposo (0) en el tramo alto de cada pulso", () => {
    for (let p = 0; p < QUAKE_PULSES; p++) {
      const t = p * QUAKE_PERIOD_MS + QUAKE_DOWN_MS + 1; // pasado el tramo desplazado
      expect(quakeOffsetAt(t)).toBe(0);
    }
  });

  it("hace exactamente QUAKE_PULSES transiciones a amplitud y luego se apaga", () => {
    // Muestreo fino: cuenta flancos de subida 0→amplitud.
    let edges = 0;
    let prev = 0;
    for (let t = 0; t < QUAKE_DURATION_MS + 200; t++) {
      const o = quakeOffsetAt(t);
      if (prev === 0 && o === QUAKE_AMPLITUDE_PX) edges++;
      prev = o;
    }
    expect(edges).toBe(QUAKE_PULSES);
  });

  it("es 0 antes de empezar y una vez terminada", () => {
    expect(quakeOffsetAt(-1)).toBe(0);
    expect(quakeOffsetAt(QUAKE_DURATION_MS)).toBe(0);
    expect(quakeOffsetAt(QUAKE_DURATION_MS + 500)).toBe(0);
  });
});

describe("quake — QuakeShake (animador con reloj de pared)", () => {
  it("inactivo hasta trigger; luego activo y con offset", () => {
    const q = new QuakeShake();
    expect(q.active).toBe(false);
    expect(q.offset(1000)).toBe(0);
    q.trigger(1000);
    expect(q.active).toBe(true);
    expect(q.offset(1001)).toBe(QUAKE_AMPLITUDE_PX); // 1 ms dentro del primer pulso
  });

  it("se autodesactiva al pasar la duración total", () => {
    const q = new QuakeShake();
    q.trigger(5000);
    expect(q.offset(5000 + QUAKE_DURATION_MS - 1)).toBeGreaterThanOrEqual(0);
    expect(q.offset(5000 + QUAKE_DURATION_MS)).toBe(0);
    expect(q.active).toBe(false);
  });

  it("trigger con t0 FUTURO queda ARMADA: 0 antes de arrancar, sacude al llegarle el turno (fix-quakeshake)", () => {
    // Es la pata de la serialización del WELL DONE (#355): `applyTurnFx` dispara
    // `trigger(now + quakeStartMs)` con quakeStartMs = 5.347,5 (los barridos de
    // 0x0c44-0x0c85), y la sacudida debe esperar SIN autodesactivarse ni asomar antes.
    const q = new QuakeShake();
    q.trigger(10000 + 5347.5); // t0 futuro visto desde now=10000
    expect(q.offset(10000), "antes de su t0: quieta").toBe(0);
    expect(q.active, "…pero ARMADA (no se autodesactiva con t<0)").toBe(true);
    expect(q.offset(10000 + 5347.5 + 1), "1 ms dentro de su hueco: sacude").toBe(QUAKE_AMPLITUDE_PX);
  });

  it("clear() corta la sacudida", () => {
    const q = new QuakeShake();
    q.trigger(0);
    q.clear();
    expect(q.active).toBe(false);
    expect(q.offset(1)).toBe(0);
  });

  it("pulses>QUAKE_PULSES alarga la sacudida (3 ráfagas del Codex = 3×)", () => {
    // La ceremonia final del Codex dispara la primitiva 0x3072 tres veces seguidas
    // (CAST2 0x0dc0/0dd7/0dee): la piel pide 3·QUAKE_PULSES → sacudida sostenida.
    const q = new QuakeShake();
    q.trigger(0, 3 * QUAKE_PULSES);
    // Sigue viva pasada la duración de UNA sola invocación...
    expect(q.offset(QUAKE_DURATION_MS + 1)).toBeGreaterThanOrEqual(0);
    expect(q.active).toBe(true);
    // ...y se apaga al triple de la duración.
    expect(q.offset(3 * QUAKE_DURATION_MS)).toBe(0);
    expect(q.active).toBe(false);
  });

  it("quakeOffsetAt cuenta 3×QUAKE_PULSES flancos con pulses=3×", () => {
    let edges = 0;
    let prev = 0;
    const pulses = 3 * QUAKE_PULSES;
    for (let t = 0; t < pulses * QUAKE_PERIOD_MS + 200; t++) {
      const o = quakeOffsetAt(t, pulses);
      if (prev === 0 && o === QUAKE_AMPLITUDE_PX) edges++;
      prev = o;
    }
    expect(edges).toBe(pulses);
  });
});
