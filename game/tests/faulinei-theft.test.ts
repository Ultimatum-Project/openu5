import { describe, expect, it } from "vitest";
import type { GameState } from "../src/core/state.js";
import { applyFaulineiTheft, THEFT_MESSAGE } from "../src/core/world/faulinei-theft.js";
import type { RandFn } from "../src/core/world/survival.js";

/**
 * #196 — la CASCADA del botín de Faulinei (TALK.OVL 0x1180), pieza a pieza.
 *
 * El orden de la cascada está derivado del `.asm`, una fila por sitio:
 *
 *   11b2  ax = g_keys|g_gems|g_torches  / 11c5 je 0x1210   ; los tres a cero ⇒ cascada larga
 *   11c7  rand(0,2) ⇒ 0 llaves · 1 gemas · 2 antorchas
 *   11e2  keys==0  ⇒ je 0x11c7   (RE-TIRA)
 *   11f8  gems==0  ⇒ je 0x11c7   (RE-TIRA)
 *   1204  torch==0 ⇒ je 0x11c7   (RE-TIRA)
 *   1210  si=0x2f⇒0 sobre g_equip_qty  (DS 0x57c0): el índice MÁS ALTO no vacío
 *   1232  si=7⇒0    sobre g_potion_qty (DS 0x5828)
 *   124a  si=7⇒0    sobre g_scroll_qty (DS 0x5820)
 *   1262  g_gold −= rand(1,15), suelo 0
 *
 * Las tres arrays se recorren de ARRIBA ABAJO (`dec si / jns`), no de 0 en adelante: es
 * el detalle que un port ingenuo invierte y que ningún test de «se robó algo» detecta.
 */

/** Estado mínimo con Faulinei COLOCADO (flag físico a 0) — el gate de 0x1187 abierto. */
function stateWith(over: Partial<GameState> = {}): GameState {
  return {
    shadowlordHere: 0,
    keys: 0,
    gems: 0,
    torches: 0,
    gold: 100,
    equipmentQuantities: Array.from({ length: 48 }, () => 0),
    potionQuantities: Array.from({ length: 8 }, () => 0),
    scrollQuantities: Array.from({ length: 8 }, () => 0),
    ...over,
  } as GameState;
}

/** RNG guionizado: devuelve la secuencia dada y falla si se pide una tirada de más. */
function scripted(values: number[]): RandFn {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error(`rand de más (${i + 1} > ${values.length})`);
    return values[i++]!;
  };
}

/** Cuenta cuántas veces se pide una tirada, devolviendo siempre `fixed`. */
function counting(fixed: number): { rand: RandFn; calls: () => number } {
  let n = 0;
  return { rand: () => { n++; return fixed; }, calls: () => n };
}

describe("robo de Faulinei — el GATE (TALK 0x1187)", () => {
  it("★ el gate es `== 0` (la FALSEDAD), no «hay algún Shadowlord»", () => {
    for (const here of [-1, 1, 2]) {
      const s = stateWith({ shadowlordHere: here, keys: 5 });
      const { rand, calls } = counting(0);
      const res = applyFaulineiTheft(s, rand);
      expect(res.loot, `shadowlordHere=${here} no debe robar`).toBeNull();
      expect(res.messages).toEqual([]);
      expect(calls(), "y NO consume stream: el gate va ANTES de toda tirada").toBe(0);
      expect(s.keys).toBe(5);
    }
  });

  it("con la Falsedad colocada roba y emite el mensaje byte-exacto de DS 0x94dc", () => {
    const s = stateWith({ keys: 5 });
    const res = applyFaulineiTheft(s, scripted([0]));
    expect(res.messages).toEqual([THEFT_MESSAGE]);
    expect(THEFT_MESSAGE).toBe("\nSomething was stolen!\n");
  });
});

describe("robo de Faulinei — la rama de llaves/gemas/antorchas (0x11c7)", () => {
  it("rand(0,2) mapea 0⇒llaves · 1⇒gemas · 2⇒antorchas", () => {
    const casos: [number, "keys" | "gems" | "torches"][] = [[0, "keys"], [1, "gems"], [2, "torches"]];
    for (const [roll, kind] of casos) {
      const s = stateWith({ keys: 3, gems: 3, torches: 3 });
      const res = applyFaulineiTheft(s, scripted([roll]));
      expect(res.loot).toEqual({ kind, amount: 1 });
      expect(s[kind], `${kind} baja de 3 a 2`).toBe(2);
    }
  });

  it("★ RE-TIRA cuando la categoría sorteada está VACÍA (0x11e7/0x11fd/0x1209)", () => {
    // Sólo hay antorchas. El binario sortea llaves (0), vuelve; gemas (1), vuelve; y sólo
    // al sacar 2 roba. Tres tiradas para un robo — un port que en vez de re-tirar cayese
    // a la siguiente categoría no vacía consumiría UNA y daría el mismo objeto.
    const s = stateWith({ keys: 0, gems: 0, torches: 4 });
    const res = applyFaulineiTheft(s, scripted([0, 1, 2]));
    expect(res.loot).toEqual({ kind: "torches", amount: 1 });
    expect(s.torches).toBe(3);
  });

  it("★ esta rama NO toca el oro ni el equipo, aunque los haya", () => {
    const eq = Array.from({ length: 48 }, () => 0);
    eq[10] = 2;
    const s = stateWith({ keys: 1, gold: 500, equipmentQuantities: eq });
    applyFaulineiTheft(s, scripted([0]));
    expect(s.keys).toBe(0);
    expect(s.gold).toBe(500);
    expect(s.equipmentQuantities[10]).toBe(2);
  });
});

describe("robo de Faulinei — la cascada larga (0x1210 en adelante)", () => {
  it("★ EQUIPO: se lleva el índice MÁS ALTO no vacío, no el primero", () => {
    const eq = Array.from({ length: 48 }, () => 0);
    eq[3] = 1;
    eq[41] = 1; // el más alto
    const s = stateWith({ equipmentQuantities: eq });
    const { rand, calls } = counting(0);
    const res = applyFaulineiTheft(s, rand);
    expect(res.loot).toEqual({ kind: "equipment", index: 41, amount: 1 });
    expect(s.equipmentQuantities[3], "el bajo NO se toca").toBe(1);
    expect(calls(), "el barrido es lineal: 0 tiradas").toBe(0);
  });

  it("POCIONES sólo cuando no queda equipo, y también por el índice más alto", () => {
    const po = Array.from({ length: 8 }, () => 0);
    po[1] = 1;
    po[6] = 2;
    const s = stateWith({ potionQuantities: po });
    const res = applyFaulineiTheft(s, counting(0).rand);
    expect(res.loot).toEqual({ kind: "potion", index: 6, amount: 1 });
    expect(s.potionQuantities[6]).toBe(1);
    expect(s.potionQuantities[1]).toBe(1);
  });

  it("PERGAMINOS sólo cuando no quedan equipo ni pociones", () => {
    const sc = Array.from({ length: 8 }, () => 0);
    sc[2] = 1;
    const s = stateWith({ scrollQuantities: sc });
    const res = applyFaulineiTheft(s, counting(0).rand);
    expect(res.loot).toEqual({ kind: "scroll", index: 2, amount: 1 });
    expect(s.scrollQuantities[2]).toBe(0);
  });

  it("★ ORO al fondo: rand(1,15) con suelo 0 (CS 0x3f54)", () => {
    const s = stateWith({ gold: 100 });
    const res = applyFaulineiTheft(s, scripted([9]));
    expect(res.loot).toEqual({ kind: "gold", amount: 9 });
    expect(s.gold).toBe(91);
  });

  it("el suelo del oro es 0, no negativo", () => {
    const s = stateWith({ gold: 3 });
    const res = applyFaulineiTheft(s, scripted([15]));
    expect(s.gold).toBe(0);
    expect(res.loot).toEqual({ kind: "gold", amount: 3 });
  });

  it("★ CONTROL de PRIORIDAD: con TODO lleno gana lo primero de la cascada", () => {
    // Precondición poblada a propósito (#187): si alguna capa estuviese vacía el test no
    // discriminaría el ORDEN, sólo que «algo se robó».
    const eq = Array.from({ length: 48 }, () => 1);
    const po = Array.from({ length: 8 }, () => 1);
    const sc = Array.from({ length: 8 }, () => 1);
    const s = stateWith({ keys: 1, gold: 500, equipmentQuantities: eq, potionQuantities: po, scrollQuantities: sc });
    expect(applyFaulineiTheft(s, scripted([0])).loot?.kind, "llaves antes que nada").toBe("keys");
    const s2 = stateWith({ gold: 500, equipmentQuantities: [...eq], potionQuantities: [...po], scrollQuantities: [...sc] });
    expect(applyFaulineiTheft(s2, counting(0).rand).loot?.kind, "sin llaves ⇒ equipo").toBe("equipment");
  });
});
