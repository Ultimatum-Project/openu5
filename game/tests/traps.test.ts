/**
 * Tests de la detección de trampas (SJOG search_trap_check @0x02ea): umbral y
 * tabla de mensajes exactos.
 */
import { describe, it, expect } from "vitest";
import { trapThreshold, trapCheck } from "../src/core/world/traps.js";

describe("trapThreshold", () => {
  it("no atrapado: (30 − stat) >> 1", () => {
    expect(trapThreshold(0x00, 20)).toBe((30 - 20) >> 1); // 5
    expect(trapThreshold(0x10, 10)).toBe((30 - 10) >> 1); // 10 (0x10 sin bit 0x80)
  });
  it("atrapado: ((diff&0x7f) − stat + 30) >> 1", () => {
    expect(trapThreshold(0x80 | 0x14, 20)).toBe((0x14 - 20 + 30) >> 1); // 12
  });
});

describe("trapCheck — tabla de mensajes (0x0351–0x039d)", () => {
  it("success && !atrapado → 'no trap!' (correcto)", () => {
    const r = trapCheck({ difficulty: 0x00, perceptionStat: 30, roll: 30 });
    expect(r.trapped).toBe(false);
    expect(r.success).toBe(true);
    expect(r.message).toBe("no trap!\n");
  });

  it("!success && atrapado → 'no trap!' (falla en detectar)", () => {
    const r = trapCheck({ difficulty: 0x80 | 0x30, perceptionStat: 0, roll: 1 });
    expect(r.trapped).toBe(true);
    expect(r.success).toBe(false);
    expect(r.message).toBe("no trap!\n");
  });

  it("success && atrapado && diff<0x0a → 'a simple trap!'", () => {
    // atrapado diff=5, stat alto, roll alto → success
    const r = trapCheck({ difficulty: 0x80 | 0x05, perceptionStat: 30, roll: 30 });
    expect(r.success).toBe(true);
    expect(r.trapped).toBe(true);
    expect(r.message).toBe("a simple trap!\n");
  });

  it("success && atrapado && diff>0x14 → 'a complex trap!'", () => {
    const r = trapCheck({ difficulty: 0x80 | 0x20, perceptionStat: 30, roll: 30 });
    expect(r.success).toBe(true);
    expect(r.message).toBe("a complex trap!\n");
  });

  it("success && atrapado && 0x0a<=diff<=0x14 → 'a trap!'", () => {
    const r = trapCheck({ difficulty: 0x80 | 0x10, perceptionStat: 30, roll: 30 });
    expect(r.success).toBe(true);
    expect(r.message).toBe("a trap!\n");
  });

  it("!success && !atrapado → SIEMPRE 'a trap!' (falso positivo, sin gradación)", () => {
    // no atrapado (diff=5), stat 0 → threshold=(30-0)>>1=15; roll 1 < 15 → !success
    expect(trapCheck({ difficulty: 0x05, perceptionStat: 0, roll: 1 }).message).toBe("a trap!\n");
    // diff alto, mismo resultado (no hay simple/complex en esta rama)
    expect(trapCheck({ difficulty: 0x18, perceptionStat: 0, roll: 1 }).message).toBe("a trap!\n");
  });
});
