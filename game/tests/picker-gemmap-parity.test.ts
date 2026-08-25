/**
 * PARIDAD del selector de mapa de debug con la GEMA fiel.
 *
 * La pestaña Mazmorras del picker (teleportPicker.ts) NO importa skin/fiel en runtime (el
 * módulo debug no cruza a la capa skin), así que REPLICA la tabla de color del gem con
 * cita. Este test es la GUARDA de que no divergen: la tabla del picker (`DUNGEON_FILL`)
 * debe coincidir BYTE A BYTE con la fuente de verdad `DUNGEON_GEM_FILL` de gemmap.ts. Si
 * alguien cambia el color de un tipo de celda en el gem sin actualizar el picker (o al
 * revés), este test se pone rojo.
 */
import { describe, expect, it } from "vitest";
import { DUNGEON_GEM_FILL } from "../src/skin/fiel/gemmap.js";
import { DUNGEON_FILL, DUNGEON_GLYPH_KIND } from "../src/debug/teleportPicker.js";

describe("Picker de mazmorras ↔ gema fiel — paridad de color", () => {
  it("DUNGEON_FILL del picker == DUNGEON_GEM_FILL del gem (misma clave→color por tipo)", () => {
    // Mismas claves (los 16 nibbles altos que el gem clasifica).
    expect(Object.keys(DUNGEON_FILL).sort()).toEqual(Object.keys(DUNGEON_GEM_FILL).sort());
    // Mismo valor por tipo (incl. null = no pintado / negro).
    for (const key of Object.keys(DUNGEON_GEM_FILL)) {
      const t = Number(key);
      expect(DUNGEON_FILL[t], `color divergente para el tipo 0x${t.toString(16)}`).toBe(DUNGEON_GEM_FILL[t]);
    }
  });

  it("el muro es BLANCO MACIZO y el pasillo NO se pinta (negro) — el error que reportó el usuario", () => {
    expect(DUNGEON_GEM_FILL[0xb]).toBe(0xf); // muro = índice EGA 0xf = blanco
    expect(DUNGEON_FILL[0xb]).toBe(0xf);
    expect(DUNGEON_GEM_FILL[0x0]).toBeNull(); // pasillo = negro
    expect(DUNGEON_FILL[0x0]).toBeNull();
  });

  it("paridad de GLIFO: el picker dibuja una forma EXACTAMENTE para los tipos que el gem pinta", () => {
    // Presencia: hay glifo (kind != null) sii el gem pinta la celda (fill != null).
    for (const key of Object.keys(DUNGEON_GEM_FILL)) {
      const t = Number(key);
      const gemPaints = DUNGEON_GEM_FILL[t] != null;
      const pickerHasGlyph = DUNGEON_GLYPH_KIND[t] != null;
      expect(pickerHasGlyph, `glifo/pintado desalineado para 0x${t.toString(16)}`).toBe(gemPaints);
    }
  });

  it("paridad de GLIFO: la forma por tipo es la del gem (escalera H, sala caja, trampa aspa…)", () => {
    // Formas esperadas, citadas de gemmap.ts (RUNES por tipo): escaleras 0x1/2/3 = «H»,
    // sala 0xA/0xF = caja hueca (0x73), cofre 0x4 relleno (0x70), puerta 0xE barra (0x77),
    // secreta 0xD recuadro (0x76), fuente 0x5 rombo (vector), trampa 0x6 aspa, campo 0x8 franjas,
    // muro 0xB/0xC bloque.
    expect(DUNGEON_GLYPH_KIND[0x1]).toBe("ladderH");
    expect(DUNGEON_GLYPH_KIND[0x2]).toBe("ladderH");
    expect(DUNGEON_GLYPH_KIND[0x3]).toBe("ladderH");
    expect(DUNGEON_GLYPH_KIND[0xa]).toBe("roomBox");
    expect(DUNGEON_GLYPH_KIND[0xf]).toBe("roomBox");
    expect(DUNGEON_GLYPH_KIND[0xb]).toBe("wallBlock");
    expect(DUNGEON_GLYPH_KIND[0x6]).toBe("trapCross");
    expect(DUNGEON_GLYPH_KIND[0xd]).toBe("secretInset");
  });
});
