/**
 * Tests del bebedor de POCIONES (`core/usePotion.ts`) — tabla color→efecto, la
 * aleatoriedad (1/16 fiasco a dormir + 1/16 otro color) y los gates de ubicación.
 * Derivado de CAST.OVL 0x135a (jump-table @file 0x1520). Ver re/notes/potions-scrolls.md.
 */
import { describe, it, expect } from "vitest";
import { CombatRng } from "../src/core/combat/formulas.js";
import { rerollPotionColor, applyPotionEffect, POTION_COLORS } from "../src/core/usePotion.js";
import { buildUseRows, type UseRowsState } from "../src/core/usePicker.js";
import type { CharacterState } from "../src/core/state.js";

/** RNG escriptado: `next(lo,hi)` devuelve en orden los valores dados (clamp a [lo,hi]). */
function scriptedRng(values: number[]): CombatRng {
  let i = 0;
  const stub = {
    next: (lo: number, hi: number): number => {
      const v = values[i++] ?? lo;
      return Math.max(lo, Math.min(hi, v));
    },
  };
  return new CombatRng(stub as never);
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

describe("rerollPotionColor — aleatoriedad del bebedor (CAST 0x13a8-0x13cd)", () => {
  it("rand(0,15)==0 → fuerza color 4 (Orange=dormir, el 'fiasco')", () => {
    expect(rerollPotionColor(1, scriptedRng([0]))).toBe(4);
  });
  it("rand(0,15)==1 → efecto de OTRO color rand(0,7)", () => {
    expect(rerollPotionColor(1, scriptedRng([1, 6]))).toBe(6);
  });
  it("rand(0,15) 2..15 → conserva el color original", () => {
    for (const r of [2, 7, 15]) expect(rerollPotionColor(3, scriptedRng([r]))).toBe(3);
  });
});

describe("applyPotionEffect — tabla de efectos por color (fuera de combate, loc 0)", () => {
  const rng = () => scriptedRng([15]); // reroll no usada aquí (se pasa color efectivo directo)

  it("Blue(0) despierta 'S'→'G', SIN línea de efecto", () => {
    const c = mkChar("S");
    const out = applyPotionEffect(c, 0, rng(), 0);
    expect(c.status).toBe("G");
    expect(out).toMatchObject({ message: "", ok: true });
  });
  it("Blue(0) sobre PJ despierto no hace nada (requiere 'S')", () => {
    const c = mkChar("G");
    expect(applyPotionEffect(c, 0, rng(), 0)).toMatchObject({ message: "", ok: false });
    expect(c.status).toBe("G");
  });
  it("Yellow(1) cura parcial → 'Healed!' cuando cura >0", () => {
    const c = mkChar("G", { currentHp: 10, maxHp: 40 });
    const out = applyPotionEffect(c, 1, scriptedRng([0x3c]), 0); // rand30: max(1, 0x3c>>1=30)
    expect(c.currentHp).toBeGreaterThan(10);
    expect(out.message).toBe("Healed!");
  });
  it("Yellow(1) sobre muerto no cura → sin eco", () => {
    const c = mkChar("D", { currentHp: 0 });
    expect(applyPotionEffect(c, 1, scriptedRng([0x3c]), 0)).toMatchObject({ message: "", ok: false });
  });
  it("Red(2) cura veneno 'P'→'G' → 'Poison cured!'", () => {
    const c = mkChar("P");
    expect(applyPotionEffect(c, 2, rng(), 0)).toMatchObject({ message: "Poison cured!", ok: true });
    expect(c.status).toBe("G");
  });
  it("Green(3) ENVENENA 'G'→'P' → 'POISONED!'", () => {
    const c = mkChar("G");
    expect(applyPotionEffect(c, 3, rng(), 0)).toMatchObject({ message: "POISONED!", ok: true });
    expect(c.status).toBe("P");
  });
  it("Green(3) sobre PJ ya envenenado no hace nada (requiere 'G')", () => {
    const c = mkChar("P");
    expect(applyPotionEffect(c, 3, rng(), 0)).toMatchObject({ message: "", ok: false });
  });
  it("Orange(4) DUERME 'G'→'S' → 'Slept!'", () => {
    const c = mkChar("G");
    expect(applyPotionEffect(c, 4, rng(), 0)).toMatchObject({ message: "Slept!", ok: true });
    expect(c.status).toBe("S");
  });
});

describe("applyPotionEffect — gates de ubicación (Purple/Black/White)", () => {
  it("Purple(5) fuera de combate → 'No noticeable effect now!'", () => {
    expect(applyPotionEffect(mkChar("G"), 5, scriptedRng([]), 0)).toMatchObject({
      message: "\nNo noticeable effect now!", ok: false,
    });
  });
  it("Purple(5) en combate (loc>=0x80) → 'Poof!'", () => {
    expect(applyPotionEffect(mkChar("G"), 5, scriptedRng([]), 0x80)).toMatchObject({ message: "Poof!", ok: true });
  });
  it("Black(6) fuera de combate → 'No noticeable effect now!'", () => {
    expect(applyPotionEffect(mkChar("G"), 6, scriptedRng([]), 0)).toMatchObject({
      message: "\nNo noticeable effect now!", ok: false,
    });
  });
  it("Black(6) en combate → 'Invisible!'", () => {
    expect(applyPotionEffect(mkChar("G"), 6, scriptedRng([]), 0x80)).toMatchObject({ message: "Invisible!", ok: true });
  });
  it("White(7) en overworld/pueblo (loc<0x21) → reveal cosmético, sin línea", () => {
    expect(applyPotionEffect(mkChar("G"), 7, scriptedRng([]), 0)).toMatchObject({ message: "", ok: true });
    expect(applyPotionEffect(mkChar("G"), 7, scriptedRng([]), 0x10)).toMatchObject({ message: "", ok: true });
  });
  it("White(7) en mazmorra (0x21<=loc<=0x7f) → 'No noticeable effect now!'", () => {
    expect(applyPotionEffect(mkChar("G"), 7, scriptedRng([]), 0x21)).toMatchObject({
      message: "\nNo noticeable effect now!", ok: false,
    });
  });
});

describe("buildUseRows — las pociones se listan por color antes que la alfombra", () => {
  function useState(over: Partial<UseRowsState> = {}): UseRowsState {
    return {
      scrollQuantities: [0, 0, 0, 0, 0, 0, 0, 0],
      potionQuantities: [0, 0, 0, 0, 0, 0, 0, 0],
      magicCarpets: 0, skullKeys: 0,
      shards: { falsehood: false, hatred: false, cowardice: false },
      lbArtifacts: { amulet: false, crown: false, sceptre: false },
      specialItems: { spyglass: false, hmsCape: false, sextant: false, pocketWatch: false, blackBadge: false, woodenBox: false },
      ...over,
    };
  }
  it("lista sólo los colores con cuenta≥1, por su nombre, en orden 0-7", () => {
    const rows = buildUseRows(useState({ potionQuantities: [2, 0, 0, 1, 0, 0, 0, 3] }));
    // El nombre de FILA lleva el sigilo `!` de la name-table 0x1916 (print_list_row
    // @0x0664 lo cambia por la decoración DS 0x9782 + el color DS 0x19C2).
    expect(rows.map((r) => r.name)).toEqual(["!Blue", "!Green", "!White"]);
    expect(rows.map((r) => r.qty)).toEqual([2, 1, 3]);
    expect(rows[0]!.action).toEqual({ kind: "potion", color: 0 });
    expect(rows[2]!.action).toEqual({ kind: "potion", color: 7 });
  });
  it("las pociones preceden a la alfombra (orden de la tabla extendida)", () => {
    const rows = buildUseRows(useState({ potionQuantities: [0, 1, 0, 0, 0, 0, 0, 0], magicCarpets: 1 }));
    expect(rows.map((r) => r.name)).toEqual(["!Yellow", "Magic Crpt"]);
  });
  it("POTION_COLORS = los 8 nombres del name-table DS 0x067c", () => {
    expect([...POTION_COLORS]).toEqual(["Blue", "Yellow", "Red", "Green", "Orange", "Purple", "Black", "White"]);
  });
});
