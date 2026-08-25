/**
 * Roster fiel del panel (F-H) — layout derivado de draw_roster_row 0x27ab
 * (#69 item 4): nombre-9 · flecha `→` (0x1A) col FIJA 9 del ACTIVO · HP-4-dcha ·
 * estado. Verificado contra ztats-refs/01-select-player.png (Elwood activo con →).
 */
import { describe, expect, it } from "vitest";
import { ROSTER_ARROW, rosterGrid, type RosterMember } from "../src/skin/fiel/roster.js";

const PARTY: RosterMember[] = [
  { name: "Elwood", hp: 44, status: "G" },
  { name: "Iolo", hp: 30, status: "G" },
  { name: "Gorn", hp: 43, status: "G" },
];
const COLS = 15; // panel real = ROSTER_RECT 24..38 (15 celdas)
const ARROW_COL = 9;

function row(cells: Uint8Array, r: number): number[] {
  return [...cells.slice(r * COLS, r * COLS + COLS)];
}

describe("rosterGrid (F-H) — layout fijo 0x27ab", () => {
  it("nombre izq · flecha col 9 · HP 4-dcha · estado col 14", () => {
    const g = rosterGrid(PARTY, 0, COLS, 6);
    const r0 = row(g, 0);
    expect(String.fromCharCode(...r0.slice(0, 6))).toBe("Elwood");
    expect(r0[ARROW_COL]).toBe(ROSTER_ARROW); // flecha en la col FIJA 9
    expect(String.fromCharCode(...r0.slice(10, 14))).toBe("  44"); // HP 4-dcha
    expect(String.fromCharCode(r0[14]!)).toBe("G"); // estado col 14
  });

  it("la flecha marca SÓLO al ACTIVO (activeIdx), siempre en col 9", () => {
    const g = rosterGrid(PARTY, 1, COLS, 6); // activo = Iolo (idx 1)
    expect(row(g, 0)[ARROW_COL]).toBe(0x20); // Elwood sin flecha
    expect(row(g, 1)[ARROW_COL]).toBe(ROSTER_ARROW); // Iolo con flecha
    expect(row(g, 2)[ARROW_COL]).toBe(0x20); // Gorn sin flecha
  });

  it("columna de la flecha NO varía con los dígitos del HP (fija en 9)", () => {
    const g4 = rosterGrid([{ name: "A", hp: 1234, status: "G" }], 0, COLS, 6);
    const g1 = rosterGrid([{ name: "A", hp: 5, status: "G" }], 0, COLS, 6);
    expect(row(g4, 0).indexOf(ROSTER_ARROW)).toBe(ARROW_COL);
    expect(row(g1, 0).indexOf(ROSTER_ARROW)).toBe(ARROW_COL);
  });

  it("activeIdx=0xFF (ninguno) → sin flecha en ninguna fila", () => {
    const g = rosterGrid(PARTY, 0xff, COLS, 6);
    for (let r = 0; r < 3; r++) expect(row(g, r).includes(ROSTER_ARROW)).toBe(false);
  });

  it("miembro activo muerto ('D') o dormido ('S') → SIN flecha (0x27da)", () => {
    const dead: RosterMember[] = [{ name: "Gorn", hp: 0, status: "D" }];
    expect(row(rosterGrid(dead, 0, COLS, 6), 0).includes(ROSTER_ARROW)).toBe(false);
    const asleep: RosterMember[] = [{ name: "Gorn", hp: 5, status: "S" }];
    expect(row(rosterGrid(asleep, 0, COLS, 6), 0).includes(ROSTER_ARROW)).toBe(false);
  });

  it("nombre largo se trunca a 9 para no pisar la flecha", () => {
    const g = rosterGrid([{ name: "Verylongname", hp: 9, status: "P" }], -1, COLS, 6);
    const r0 = row(g, 0);
    expect(String.fromCharCode(...r0.slice(0, 9))).toBe("Verylongn"); // 9 chars
    expect(String.fromCharCode(...r0.slice(10, 14))).toBe("   9"); // HP 4-dcha
    expect(String.fromCharCode(r0[14]!)).toBe("P");
  });
});
