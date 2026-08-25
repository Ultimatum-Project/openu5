/**
 * Tests del (U)se en COMBATE — la sincronización del Combatant tras beber (efectos
 * REALES de Purple/Black + HP/sueño). El efecto core (applyPotionEffect en location
 * de arena 0x80) se testea en use-potion.test.ts; aquí se verifica el puente al
 * Combatant. Derivado de CAST.OVL 0x14a0 (Purple=rata 0x90) / 0x14dc (Black=invisible
 * flag 0x10). Ver re/notes/combat-use-potions.md.
 */
import { describe, it, expect } from "vitest";
import { CombatRng } from "../src/core/combat/formulas.js";
import {
  applyPotionEffect,
  applyPotionCombatSync,
  type PotionCombatTarget,
} from "../src/core/usePotion.js";
import type { CharacterState } from "../src/core/state.js";

function scriptedRng(values: number[]): CombatRng {
  let i = 0;
  return new CombatRng({
    next: (lo: number, hi: number): number => Math.max(lo, Math.min(hi, values[i++] ?? lo)),
  } as never);
}

function mkChar(status: string, over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "F", status,
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 5, currentHp: 20, maxHp: 40, exp: 100, level: 3,
    monthsAtInn: 0, helmet: 0, armor: 0, weapon: 0, shield: 0, ring: 0, amulet: 0,
    partyStatus: 0, ...over,
  };
}

function mkCombatant(): PotionCombatTarget {
  return { hp: 20, sleeping: false, invisible: false };
}

const ARENA = 0x80; // location de la arena de combate (>0x7f)

describe("Purple (5) en combate — polimorfia a rata (tile 0x90) + 'Poof!'", () => {
  it("applyPotionEffect en arena da 'Poof!' y ok; el sync fija renderTile 0x90", () => {
    const rec = mkChar("G");
    const out = applyPotionEffect(rec, 5, scriptedRng([]), ARENA);
    expect(out).toMatchObject({ message: "Poof!", ok: true, effectiveColor: 5 });
    const cur = mkCombatant();
    applyPotionCombatSync(cur, rec.currentHp, rec.status, out.effectiveColor, out.ok);
    expect(cur.renderTile).toBe(0x90);
    expect(cur.invisible).toBe(false);
  });
});

describe("Black (6) en combate — invisible (flag 0x10) + 'Invisible!'", () => {
  it("applyPotionEffect en arena da 'Invisible!' y ok; el sync fija invisible=true", () => {
    const rec = mkChar("G");
    const out = applyPotionEffect(rec, 6, scriptedRng([]), ARENA);
    expect(out).toMatchObject({ message: "Invisible!", ok: true, effectiveColor: 6 });
    const cur = mkCombatant();
    applyPotionCombatSync(cur, rec.currentHp, rec.status, out.effectiveColor, out.ok);
    expect(cur.invisible).toBe(true);
    // El binario NO deja el tile intacto: `CAST.OVL:0x150b mov al,0x1d` + `0x150d
    // mov [di+1],al` (y la cola compartida con la púrpura `0x1510 mov [bx],al`).
    // Este aserto DECÍA `toBeUndefined()` — codificaba el defecto que el usuario vio.
    expect(cur.renderTile).toBe(0x1d);
  });
});

describe("Pociones de estado en combate — sincronización HP/sueño sobre el bebedor activo", () => {
  it("Yellow(1) cura → el sync refleja el HP del record en el Combatant", () => {
    const rec = mkChar("G", { currentHp: 10, maxHp: 40 });
    const out = applyPotionEffect(rec, 1, scriptedRng([0x3c]), ARENA); // rand30 → +30
    const cur = mkCombatant();
    cur.hp = 10;
    applyPotionCombatSync(cur, rec.currentHp, rec.status, out.effectiveColor, out.ok);
    expect(cur.hp).toBe(rec.currentHp);
    expect(cur.hp).toBeGreaterThan(10);
  });
  it("Orange(4) duerme al bebedor → sync pone sleeping=true", () => {
    const rec = mkChar("G");
    const out = applyPotionEffect(rec, 4, scriptedRng([]), ARENA);
    expect(out.message).toBe("Slept!");
    const cur = mkCombatant();
    applyPotionCombatSync(cur, rec.currentHp, rec.status, out.effectiveColor, out.ok);
    expect(cur.sleeping).toBe(true);
  });
  it("Blue(0) despierta al bebedor dormido → sync pone sleeping=false", () => {
    const rec = mkChar("S");
    const out = applyPotionEffect(rec, 0, scriptedRng([]), ARENA);
    const cur: PotionCombatTarget = { hp: 20, sleeping: true, invisible: false };
    applyPotionCombatSync(cur, rec.currentHp, rec.status, out.effectiveColor, out.ok);
    expect(cur.sleeping).toBe(false);
  });
});

describe("White (7) en combate — sin efecto ('No noticeable effect now!')", () => {
  it("loc de arena (>=0x21) → aviso fiel, sin invisible/polymorph", () => {
    const rec = mkChar("G");
    const out = applyPotionEffect(rec, 7, scriptedRng([]), ARENA);
    expect(out).toMatchObject({ message: "\nNo noticeable effect now!", ok: false });
    const cur = mkCombatant();
    applyPotionCombatSync(cur, rec.currentHp, rec.status, out.effectiveColor, out.ok);
    expect(cur.invisible).toBe(false);
    expect(cur.renderTile).toBeUndefined();
  });
});
