/**
 * Pasabilidad de la ALFOMBRA MÁGICA = clase 2 del mover del binario (kernel 0x2C4C →
 * handler 0x2C80). Deriva completa en re/notes/carpet-b2.md. El port usaba
 * `IsCarpet_Passable` de TileData (Redux), que divergía del binario en 22 tiles; ahora
 * `isPassable(tile,"carpet")` replica el predicado del binario:
 *   pasable ⟺ tile<4 (agua profunda) ∨ (tile&0xF0)==0x60 (WaterStream) ∨ walkable.
 *
 * Fija los 4 casos de OVERWORLD que el port dejaba pasar por error (ahora BLOQUEADOS) y
 * confirma que el agua profunda/corriente SIGUE pasando (verdadero rasgo de la alfombra).
 */
import { describe, expect, it } from "vitest";
import { isPassable } from "../src/core/world/movement.js";

describe("Alfombra mágica — pasabilidad fiel al binario (clase 2, kernel 0x2C80)", () => {
  it("BLOQUEA lo que el binario bloquea y el port dejaba volar (overworld)", () => {
    // SmallMountains 0x0C: montañas, no walkable, no agua → el binario NO deja volar.
    expect(isPassable(0x0c, "carpet")).toBe(false);
    // Oasis 0x1C: el binario lo bloquea a pie (override) → tampoco alfombra.
    expect(isPassable(0x1c, "carpet")).toBe(false);
    // Waterfall 0xD4-0xD7: catarata, ni agua<4 ni 0x60 ni walkable → BLOQUEADA.
    for (const t of [0xd4, 0xd5, 0xd6, 0xd7]) {
      expect(isPassable(t, "carpet"), `waterfall ${t.toString(16)}`).toBe(false);
    }
  });

  it("PASA el agua profunda (0x00-0x03) — rasgo real de la alfombra", () => {
    for (const t of [0x00, 0x01, 0x02, 0x03]) {
      expect(isPassable(t, "carpet"), `deep water ${t.toString(16)}`).toBe(true);
    }
  });

  it("PASA el agua de corriente / WaterStream (0x60-0x6F) — el «agua rápida» del clue book", () => {
    for (let t = 0x60; t <= 0x6f; t++) {
      expect(isPassable(t, "carpet"), `stream ${t.toString(16)}`).toBe(true);
    }
  });

  it("PASA la tierra transitable (pantano, hierba, bosque, desierto)", () => {
    for (const t of [0x04, 0x05, 0x06, 0x07]) {
      expect(isPassable(t, "carpet"), `land ${t.toString(16)}`).toBe(true);
    }
  });

  it("los otros transportes NO cambian (agua a pie bloqueada; fragata en agua)", () => {
    expect(isPassable(0x01, "foot")).toBe(false); // agua no es transitable a pie
    expect(isPassable(0x01, "ship")).toBe(true); // la fragata sí navega agua
    expect(isPassable(0x0c, "foot")).toBe(false); // montañas no a pie
  });
});
