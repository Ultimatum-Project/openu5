/**
 * Tests del lector de PERGAMINOS (`core/useScroll.ts`) — mapping scroll→efecto,
 * magnitudes globales, gates de ubicación y ecos EXACTOS de DATA.OVL. Derivado de
 * CAST.OVL 0x11de (jump-table @file 0x1340). Ver re/notes/potions-scrolls.md.
 */
import { describe, it, expect } from "vitest";
import { readScroll, windForDirection, SCROLL_NAMES } from "../src/core/useScroll.js";
import { buildUseRows, type UseRowsState } from "../src/core/usePicker.js";
import type { GameState } from "../src/core/state.js";

/** Estado mínimo con los campos globales que tocan los scrolls. */
function mkState(): Pick<GameState, "lightSpellMins" | "timeSpell" | "timeSpellTurns" | "wind" | "windDriftCtr"> {
  return { lightSpellMins: 0, timeSpell: "", timeSpellTurns: 0, wind: 0, windDriftCtr: 0 };
}

describe("readScroll — efectos globales (sin gate, cualquiera lee)", () => {
  it("Vas Lor(0) fija luz 240 (0xF0, MÁS que el Cast 255) → 'Light!'", () => {
    const s = mkState();
    const r = readScroll(s as GameState, 0, 0);
    expect(s.lightSpellMins).toBe(0xf0);
    expect(r.messages).toEqual(["Light!"]);
    expect(r.followup).toEqual({ kind: "none" });
  });
  it("In Sanct(2) protección 'P' 100 turnos (Cast: 20) → 'Protection!'", () => {
    const s = mkState();
    const r = readScroll(s as GameState, 2, 0);
    expect(s.timeSpell).toBe("P");
    expect(s.timeSpellTurns).toBe(100);
    expect(r.messages).toEqual(["Protection!"]);
  });
  it("In An(3) negate 'N' 20 turnos (Cast: 10) → 'Negate magic!'", () => {
    const s = mkState();
    readScroll(s as GameState, 3, 0);
    expect(s.timeSpell).toBe("N");
    expect(s.timeSpellTurns).toBe(20);
  });
  it("An Tym(7) time-stop 'T' 20 turnos (Cast: 10) → 'Negate time!'", () => {
    const s = mkState();
    const r = readScroll(s as GameState, 7, 0);
    expect(s.timeSpell).toBe("T");
    expect(s.timeSpellTurns).toBe(20);
    expect(r.messages).toEqual(["Negate time!"]);
  });
  it("An Tym(7) en loc 0x1d/0x28 → 'No effect!' sin aplicar time-stop", () => {
    for (const loc of [0x1d, 0x28]) {
      const s = mkState();
      const r = readScroll(s as GameState, 7, loc);
      expect(s.timeSpell).toBe(""); // no aplicó
      expect(r.messages).toEqual(["No effect!"]);
    }
  });
});

describe("readScroll — followups interactivos y gates de ubicación", () => {
  it("Rel Hur(1) → 'Wind change!' + followup windDir", () => {
    const r = readScroll(mkState() as GameState, 1, 0);
    expect(r.messages).toEqual(["Wind change!"]);
    expect(r.followup).toEqual({ kind: "windDir" });
  });
  it("In Quas Wis(4) fuera de combate → 'View!' + followup reveal", () => {
    const r = readScroll(mkState() as GameState, 4, 0);
    expect(r.messages).toEqual(["View!"]);
    expect(r.followup).toEqual({ kind: "reveal" });
  });
  it("In Quas Wis(4) en combate (loc>0x7f) → 'View!' + 'Not here!'", () => {
    const r = readScroll(mkState() as GameState, 4, 0x80);
    expect(r.messages).toEqual(["View!", "Not here!"]);
    expect(r.followup).toEqual({ kind: "none" });
  });
  it("Kal Xen Corp(5) fuera de combate (siempre vía (U)se) → 'Summon Daemon!' + 'Not here!'", () => {
    const r = readScroll(mkState() as GameState, 5, 0);
    expect(r.messages).toEqual(["Summon Daemon!", "Not here!"]);
    expect(r.followup).toEqual({ kind: "none" });
  });
  it("Kal Xen Corp(5) en combate → followup summonDaemon", () => {
    const r = readScroll(mkState() as GameState, 5, 0x80);
    expect(r.followup).toEqual({ kind: "summonDaemon" });
  });
  it("In Mani Corp(6) fuera de combate → 'Resurrection!' + followup resurrect", () => {
    const r = readScroll(mkState() as GameState, 6, 0);
    expect(r.messages).toEqual(["Resurrection!"]);
    expect(r.followup).toEqual({ kind: "resurrect" });
  });
  it("In Mani Corp(6) en combate (loc>=0x80) → 'Resurrection!' + 'Not here!'", () => {
    const r = readScroll(mkState() as GameState, 6, 0x80);
    expect(r.messages).toEqual(["Resurrection!", "Not here!"]);
    expect(r.followup).toEqual({ kind: "none" });
  });
});

describe("windForDirection — dirección → código de viento (wind.ts)", () => {
  it("mapea las 4 direcciones a 1=N/2=S/3=E/4=W", () => {
    expect(windForDirection("north")).toBe(1);
    expect(windForDirection("south")).toBe(2);
    expect(windForDirection("east")).toBe(3);
    expect(windForDirection("west")).toBe(4);
  });
});

describe("buildUseRows — los pergaminos preceden a las pociones", () => {
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
  it("lista scrolls por nombre en orden 0-7, ANTES de pociones y alfombra", () => {
    const rows = buildUseRows(useState({
      scrollQuantities: [1, 0, 0, 0, 0, 0, 0, 2],
      potionQuantities: [0, 3, 0, 0, 0, 0, 0, 0],
      magicCarpets: 1,
    }));
    // Nombres de FILA = name-table 0x1916 con su sigilo de formato: el pergamino se
    // pinta `<0x1c> + VL` (sigla rúnica), no con el nombre largo del hechizo.
    expect(rows.map((r) => r.name)).toEqual(["*VL", "*AT", "!Yellow", "Magic Crpt"]);
    expect(rows[0]!.action).toEqual({ kind: "scroll", index: 0 });
    expect(rows[1]!.action).toEqual({ kind: "scroll", index: 7 });
  });
  it("SCROLL_NAMES = los 8 rótulos del picker (== ztats)", () => {
    expect([...SCROLL_NAMES]).toEqual(["Vas Lor", "Rel Hur", "In Sanct", "In An", "In Quas Wis", "Kal Xen", "In Mani Corp", "An Tym"]);
  });
});
