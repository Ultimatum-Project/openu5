/**
 * WHIRLPOOL F-0 — MAINOUT 0x1248 (`monster_hits_special_tile`): cuando un remolino
 * (0xEC) alcanza a la party NAVEGANDO, la SUCCIONA al Underworld (0x22,0x12) con la
 * nave preservada e imprime "\nWHIRLPOOL!\n" (DS 0x6b04) — NO es combate. El port tenía
 * `whirlpoolRelocate` DERIVADO pero nunca lo llamaba (game.ts hacía startCombat
 * incondicional); esta prueba fija las piezas derivadas. El camino completo (tick →
 * remolino adyacente → reubicación en vez de combate) lo ejercita el capítulo
 * ch16-naval e2e.
 */
import { describe, it, expect } from "vitest";
import {
  whirlpoolRelocate,
  WHIRLPOOL_MESSAGE,
  WHIRLPOOL_UNDERWORLD,
} from "../src/core/world/loops/hazards.js";
import { isWhirlpool } from "../src/core/world/enemies.js";
import type { GameState } from "../src/core/state.js";
import type { OverworldEnemy } from "../src/core/world/enemies.js";

describe("whirlpool relocate (MAINOUT 0x1248)", () => {
  it("reubica al Underworld en (0x22,0x12) preservando el transporte (la nave viaja)", () => {
    const state = {
      position: { location: 0, floor: 0, x: 100, y: 100 },
      transport: "ship",
    } as unknown as GameState;
    whirlpoolRelocate(state);
    expect(state.position.floor).toBe(0xff);
    expect(state.position.x).toBe(0x22); // 34
    expect(state.position.y).toBe(0x12); // 18
    expect(state.position.location).toBe(0); // sigue en el mundo, no en localización
    expect(state.transport).toBe("ship"); // preservado (0x1289/0x12ac)
    expect(WHIRLPOOL_UNDERWORLD).toEqual({ floor: 0xff, x: 0x22, y: 0x12 });
  });

  it("el mensaje es byte-exacto de DS 0x6b04", () => {
    expect(WHIRLPOOL_MESSAGE).toBe("\nWHIRLPOOL!\n");
  });

  it("isWhirlpool detecta el grupo de sprite del remolino (& 0xFC == 0xEC)", () => {
    const mk = (tile: number): OverworldEnemy => ({ tile } as unknown as OverworldEnemy);
    expect(isWhirlpool(mk(0x1ec))).toBe(true); // sprite del remolino
    expect(isWhirlpool(mk(0x1ee))).toBe(true); // mismo grupo (& 0xFC)
    expect(isWhirlpool(mk(0x194))).toBe(false); // otro actor de agua
    expect(isWhirlpool(mk(0x82))).toBe(false); // fragata
  });
});
