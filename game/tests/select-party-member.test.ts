/**
 * Picker reusable `select_party_member` (kernel 0x2d7a) — cursor + teclas. PURO.
 * El marcador visual es la FLECHA → (no inverso, combat-exclusive). Ver
 * src/core/selectPartyMember.ts + re/notes/kernel-sweep-3.md §8.1.
 */
import { describe, expect, it } from "vitest";
import {
  selectPartyMemberStart,
  selectPartyMemberKey,
  type SelectPartyMemberState,
} from "../src/core/selectPartyMember.js";

const st = (cursor: number): SelectPartyMemberState => ({ cursor });

describe("selectPartyMember — arranque", () => {
  it("cursor inicial por defecto = 0", () => {
    expect(selectPartyMemberStart()).toEqual({ cursor: 0 });
  });
  it("cursor inicial explícito", () => {
    expect(selectPartyMemberStart(2)).toEqual({ cursor: 2 });
  });
});

describe("selectPartyMember — navegación con flechas (wrap)", () => {
  it("Dcha/Abajo → next (envuelve)", () => {
    expect(selectPartyMemberKey(st(0), "ArrowRight", 3)).toEqual({ kind: "move", cursor: 1 });
    expect(selectPartyMemberKey(st(2), "ArrowDown", 3)).toEqual({ kind: "move", cursor: 0 }); // wrap
  });
  it("Izq/Arriba → prev (envuelve)", () => {
    expect(selectPartyMemberKey(st(1), "ArrowLeft", 3)).toEqual({ kind: "move", cursor: 0 });
    expect(selectPartyMemberKey(st(0), "ArrowUp", 3)).toEqual({ kind: "move", cursor: 2 }); // wrap
  });
});

describe("selectPartyMember — selección directa por número (acotada a party)", () => {
  it("'2' con party 3 → selecciona idx 1", () => {
    expect(selectPartyMemberKey(st(0), "2", 3)).toEqual({ kind: "select", index: 1 });
  });
  it("número > partySize → IGNORA (no 'None posted!' aquí; el binario re-lee)", () => {
    expect(selectPartyMemberKey(st(0), "7", 3)).toEqual({ kind: "ignore" });
    expect(selectPartyMemberKey(st(0), "4", 3)).toEqual({ kind: "ignore" });
  });
  it("'1' → idx 0 (borde inferior)", () => {
    expect(selectPartyMemberKey(st(2), "1", 3)).toEqual({ kind: "select", index: 0 });
  });
});

describe("selectPartyMember — confirmar / cancelar", () => {
  it("Enter/Space → confirma el cursor actual (0x2e58 / 0x2e62)", () => {
    expect(selectPartyMemberKey(st(2), "Enter", 3)).toEqual({ kind: "select", index: 2 });
    expect(selectPartyMemberKey(st(1), " ", 3)).toEqual({ kind: "select", index: 1 });
  });
  it("* '0' NO confirma: por el thunk arg=0 el binario la IGNORA (#280)", () => {
    // Este módulo lo consumen campPrompt y ui/pickers, y ambos entran por
    // select_party_member_default (CS 0x2e8e: sub ax,ax / push ax / call 0x2d7a) =>
    // primer argumento CERO => el 0x2e3e `cmp word ptr [bp+4],0 / je 0x2e19` manda la
    // tecla al bucle sin efecto. Con el argumento habilitado NO confirmaría tampoco:
    // devolvería [bp-2] = 0xfffe = -2, un tercer código, no el cursor.
    expect(selectPartyMemberKey(st(0), "0", 3)).toEqual({ kind: "ignore" });
    expect(selectPartyMemberKey(st(2), "0", 3)).toEqual({ kind: "ignore" });
  });
  it("ESC → cancela", () => {
    expect(selectPartyMemberKey(st(1), "Escape", 3)).toEqual({ kind: "close" });
  });
  it("tecla no reconocida → ignora (getkey re-lee)", () => {
    expect(selectPartyMemberKey(st(1), "x", 3)).toEqual({ kind: "ignore" });
  });
  it("partySize 0 → ignora todo (sin party)", () => {
    expect(selectPartyMemberKey(st(0), "Enter", 0)).toEqual({ kind: "ignore" });
  });
});
