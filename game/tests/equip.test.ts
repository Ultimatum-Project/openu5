/**
 * Tests del comando READY (equipar) — MODELO EXACTO del binario
 * (ZSTATS.OVL try_equip_or_unequip @0x0c5c). Verifican: slot por tabla de tipos,
 * ENCUMBRANCE (suma de pesos vs Str, no reqStrength por-item), gate de munición,
 * rechazo de Arrows/Quarrels, dos-manos exige ambas manos libres, anillo único,
 * "Ring vanishes!" (1/16), toggle-off, y defensa/armas para el combate.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import {
  equipItem,
  unequipSlot,
  handState,
  totalEquippedWeight,
  characterDefense,
  characterWeapons,
  slotForEquip,
  equipTypeOf,
  EQUIPMENT_NOTHING,
  type EquipData,
} from "../src/core/equip.js";

function readJson<T>(url: string): T {
  const path = fileURLToPath(new URL(url, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, "")) as T;
}

interface DataOvl {
  reqStrengthEquip: number[];
  attackValues: number[];
  defenseValues: number[];
  attackRangeValues: number[];
}

const data = readJson<DataOvl>("../assets/data.json");
const init = readJson<ExtractedInitialState>("../assets/initial-state.json");

const equipData: EquipData = {
  attackValues: data.attackValues,
  defenseValues: data.defenseValues,
};

function freshGame(): GameState {
  return createNewGame(init);
}

// Ids del enum Equipment usados en los tests.
const BOW = 26;
const ARROWS = 27;
const CROSSBOW = 28;
const LONG_SWORD = 30;
const HALBERD = 34; // dos manos, weight 18
const SMALL_SHIELD = 4; // una mano, weight 2

describe("slotForEquip / equipTypeOf (tabla de tipos DS 0x1a7e)", () => {
  it("clasifica cada item por su tipo", () => {
    expect(slotForEquip(0)).toBe("helmet"); // type 0x80
    expect(slotForEquip(3)).toBe("helmet");
    expect(slotForEquip(4)).toBe("shield"); // type 0x20 (una mano, id<16)
    expect(slotForEquip(9)).toBe("armor"); // type 0x40
    expect(slotForEquip(16)).toBe("weapon"); // type 0x20 (una mano, id>=16)
    expect(slotForEquip(41)).toBe("weapon"); // type 0x30 (dos manos)
    expect(slotForEquip(42)).toBe("ring"); // type 0x02
    expect(slotForEquip(45)).toBe("amulet"); // type 0x04
    expect(slotForEquip(47)).toBe("amulet");
    expect(slotForEquip(48)).toBeNull(); // fuera de rango
  });

  it("Arrows(27)/Quarrels(29) son type 0x00 = no equipables", () => {
    expect(equipTypeOf(ARROWS)).toBe(0x00);
    expect(equipTypeOf(29)).toBe(0x00);
    expect(slotForEquip(ARROWS)).toBeNull();
    expect(slotForEquip(29)).toBeNull();
  });
});

describe("inventario inicial real", () => {
  it("Iolo NO puede equipar un arco: no hay ninguno en el inventario", () => {
    const g = freshGame();
    expect(g.equipmentQuantities[BOW]).toBe(0);
    const iolo = g.characters[2]!;
    const weaponBefore = iolo.weapon;
    const r = equipItem(g, 2, BOW, equipData);
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Thou hast none!");
    expect(iolo.weapon).toBe(weaponBefore);
  });
});

describe("dos manos (type 0x30)", () => {
  it("exige AMBAS manos libres: con manos ocupadas rechaza sin mutar", () => {
    const g = freshGame();
    const iolo = g.characters[2]!; // weapon 20 + shield 23 ocupados
    g.equipmentQuantities[HALBERD] = 1;
    const r = equipItem(g, 2, HALBERD, equipData);
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Both hands must be free before thou canst wield that!");
    expect(iolo.weapon).toBe(20);
    expect(iolo.shield).toBe(23);
    expect(g.equipmentQuantities[HALBERD]).toBe(1); // no consumido
  });

  it("con ambas manos libres y fuerza suficiente, se equipa en la mano de arma", () => {
    const g = freshGame();
    const iolo = g.characters[2]!;
    iolo.strength = 25;
    unequipSlot(g, 2, "weapon");
    unequipSlot(g, 2, "shield");
    g.equipmentQuantities[HALBERD] = 1;
    const r = equipItem(g, 2, HALBERD, equipData);
    expect(r.ok).toBe(true);
    expect(iolo.weapon).toBe(HALBERD);
    expect(iolo.shield).toBe(EQUIPMENT_NOTHING);
    expect(g.equipmentQuantities[HALBERD]).toBe(0);
    // El equipado con éxito NO imprime nada (F1.9): el "Readied." era una frase de
    // conveniencia del clon SIN respaldo — el binario calla al equipar (el eco es
    // sólo el "Ready...\n\n" del dispatch, DS 0xa1f0). Mensaje vacío = no se pinta.
    expect(r.message).toBe("");
  });
});

describe("ENCUMBRANCE (suma de pesos vs Str)", () => {
  it("el Avatar (peso equipado 20 > Str 15) no puede añadir ni un escudo ligero", () => {
    const g = freshGame();
    const avatar = g.characters[0]!; // helm1+armor13+weapon30+amulet47 = peso 20, str 15
    expect(totalEquippedWeight(avatar)).toBe(20);
    expect(avatar.strength).toBe(15);
    g.equipmentQuantities[SMALL_SHIELD] = 1;
    const r = equipItem(g, 0, SMALL_SHIELD, equipData);
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Thou art not strong enough!");
    expect(avatar.shield).toBe(EQUIPMENT_NOTHING); // no mutó
  });

  it("un item cabe si la suma acumulada no supera la Fuerza", () => {
    const g = freshGame();
    const mariah = g.characters[3]!; // armor9(0)+weapon16(1)=peso 1, str 12
    expect(totalEquippedWeight(mariah)).toBe(1);
    g.equipmentQuantities[LONG_SWORD] = 1; // weight 9, una mano → va a la mano libre (escudo)
    const r = equipItem(g, 3, LONG_SWORD, equipData);
    expect(r.ok).toBe(true); // 1 + 9 = 10 <= 12
    expect(mariah.shield).toBe(LONG_SWORD);
  });
});

describe("gate de munición", () => {
  it("Bow sin Arrows → 'no ammunition'", () => {
    const g = freshGame();
    g.equipmentQuantities[BOW] = 1;
    g.equipmentQuantities[ARROWS] = 0;
    const r = equipItem(g, 3, BOW, equipData);
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Thou hast no ammunition for that weapon!");
  });

  it("Bow con Arrows>0 se equipa (mano de arma libre)", () => {
    const g = freshGame();
    const mariah = g.characters[3]!;
    mariah.strength = 30;
    unequipSlot(g, 3, "weapon"); // ambas manos libres
    g.equipmentQuantities[BOW] = 1;
    g.equipmentQuantities[ARROWS] = 5;
    const r = equipItem(g, 3, BOW, equipData);
    expect(r.ok).toBe(true);
    expect(mariah.weapon).toBe(BOW);
  });

  it("Crossbow sin Quarrels → 'no ammunition'", () => {
    const g = freshGame();
    g.equipmentQuantities[CROSSBOW] = 1;
    g.equipmentQuantities[29] = 0;
    const r = equipItem(g, 3, CROSSBOW, equipData);
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Thou hast no ammunition for that weapon!");
  });
});

describe("rechazos y toggles", () => {
  it("Ready de Arrows directo se rechaza en silencio", () => {
    const g = freshGame();
    g.equipmentQuantities[ARROWS] = 10;
    const r = equipItem(g, 0, ARROWS, equipData);
    expect(r.ok).toBe(false);
    expect(r.message).toBe("");
  });

  it("un item ya equipado se desequipa (toggle-off) y vuelve al inventario", () => {
    const g = freshGame();
    const avatar = g.characters[0]!;
    expect(avatar.amulet).toBe(47);
    const q0 = g.equipmentQuantities[47] ?? 0;
    const r = equipItem(g, 0, 47, equipData);
    expect(r.ok).toBe(true);
    expect(r.removed).toBe(true);
    expect(avatar.amulet).toBe(EQUIPMENT_NOTHING);
    expect(g.equipmentQuantities[47]).toBe(q0 + 1);
  });

  it("unequipSlot devuelve el item al inventario y vacía el slot", () => {
    const g = freshGame();
    const iolo = g.characters[2]!;
    const shield = iolo.shield;
    const r = unequipSlot(g, 2, "shield");
    expect(r.ok).toBe(true);
    expect(iolo.shield).toBe(EQUIPMENT_NOTHING);
    expect(g.equipmentQuantities[shield]).toBe(1);
  });
});

describe("anillos", () => {
  it("un segundo anillo se rechaza ('Only one magic ring')", () => {
    const g = freshGame();
    const avatar = g.characters[0]!;
    avatar.strength = 99; // fuera de la ecuación de encumbrance
    g.equipmentQuantities[43] = 1;
    g.equipmentQuantities[42] = 1;
    expect(equipItem(g, 0, 43, equipData).ok).toBe(true);
    expect(avatar.ring).toBe(43);
    const r = equipItem(g, 0, 42, equipData);
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Only one magic ring may be worn at a time!");
  });

  it("'Ring vanishes!' cuando rand(0,15)==0 al equipar el item 42", () => {
    const g = freshGame();
    const avatar = g.characters[0]!;
    avatar.strength = 99;
    g.equipmentQuantities[42] = 1;
    const r = equipItem(g, 0, 42, equipData, { randRange: () => 0 });
    expect(r.vanished).toBe(true);
    expect(r.message).toBe("\n\nRing vanishes!\n");
    expect(avatar.ring).toBe(EQUIPMENT_NOTHING); // desapareció
    expect(g.equipmentQuantities[42]).toBe(0); // consumido igualmente
  });

  it("el item 42 se equipa normal cuando rand(0,15)!=0", () => {
    const g = freshGame();
    const avatar = g.characters[0]!;
    avatar.strength = 99;
    g.equipmentQuantities[42] = 1;
    const r = equipItem(g, 0, 42, equipData, { randRange: () => 5 });
    expect(r.ok).toBe(true);
    expect(r.vanished).toBeUndefined();
    expect(avatar.ring).toBe(42);
  });
});

describe("handState", () => {
  it("refleja manos libres/ocupadas y two-handed", () => {
    const g = freshGame();
    const c = g.characters[2]!;
    c.weapon = EQUIPMENT_NOTHING;
    c.shield = EQUIPMENT_NOTHING;
    expect(handState(c)).toBe(2); // ambas libres
    c.weapon = 20; // una mano ocupada (type 0x20)
    expect(handState(c)).toBe(1); // solo la de escudo libre
    c.weapon = HALBERD; // arma de dos manos en la mano de arma
    expect(handState(c)).toBe(0xff); // la de escudo NO cuenta como libre
    c.weapon = EQUIPMENT_NOTHING;
    c.shield = 23;
    expect(handState(c)).toBe(0); // solo la de arma libre
  });
});

describe("bloqueo de armadura en combate de mazmorra", () => {
  it("no deja cambiar armadura (ids 9..15) pre-victoria", () => {
    const g = freshGame();
    g.equipmentQuantities[13] = 1;
    const r = equipItem(g, 0, 13, equipData, { inDungeonCombat: true });
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Thou canst not change armour in heated battle!");
  });
});

describe("characterDefense / characterWeapons", () => {
  it("suma la defensa de todo lo equipado por el Avatar", () => {
    const g = freshGame();
    const avatar = g.characters[0]!;
    expect(characterDefense(avatar, data.defenseValues)).toBe(7);
  });

  it("el Avatar ataca con su espada larga (attack 15, range 1)", () => {
    const g = freshGame();
    const avatar = g.characters[0]!;
    expect(avatar.weapon).toBe(LONG_SWORD);
    const weapons = characterWeapons(avatar, data.attackValues, data.attackRangeValues);
    expect(weapons).toEqual([{ id: LONG_SWORD, attack: 15, range: 1 }]);
  });

  it("sin nada que ataque, usa puños desnudos (id 0xFF, daño base exacto 1)", () => {
    const g = freshGame();
    const avatar = g.characters[0]!;
    avatar.helmet = EQUIPMENT_NOTHING;
    avatar.weapon = EQUIPMENT_NOTHING;
    avatar.shield = EQUIPMENT_NOTHING;
    const weapons = characterWeapons(avatar, data.attackValues, data.attackRangeValues);
    expect(weapons).toEqual([{ id: 0xff, attack: 1, range: 1 }]);
  });
});
