/**
 * Carril saludos-shoppe — helper de core `shoppe-greetings.ts`.
 *
 * Derivación: re/notes/shoppe-greetings-witness.md (emisor SHOPPES 0x01b6 +
 * adenda-3). La tabla de índices se verificó byte a byte contra SHOPPE.DAT
 * (offsets DATA.OVL 0x3b3a); aquí se fija su FORMA (7 tipos × 4, sin Blacksmith)
 * y la mecánica pura del expansor/parte-del-día. Las plantillas REALES son asset
 * de EA (shoppe.json, gitignored) → los tests usan plantillas sintéticas.
 */
import { describe, expect, it } from "vitest";
import {
  SHOPPE_GREETING_INDEX,
  expandShoppeTemplate,
  partOfDayWord,
} from "../src/core/shops/shoppe-greetings.js";

describe("partOfDayWord — umbrales SHOPPES 0x00d8 sobre g_hour", () => {
  it("hour < 12 → morning (DS 0x7826→0x7836)", () => {
    expect(partOfDayWord(0)).toBe("morning");
    expect(partOfDayWord(11)).toBe("morning");
  });
  it("12 ≤ hour < 18 → afternoon (DS 0x782e→0x783e)", () => {
    expect(partOfDayWord(12)).toBe("afternoon");
    expect(partOfDayWord(17)).toBe("afternoon");
  });
  it("hour ≥ 18 → evening (DS 0x7838→0x7848) — no existe 'night'", () => {
    expect(partOfDayWord(18)).toBe("evening");
    expect(partOfDayWord(23)).toBe("evening");
  });
});

describe("expandShoppeTemplate — expansor $/#/@ (SHOPPES 0x005b)", () => {
  it("sustituye $=tendero, #=tienda, @=parte del día", () => {
    expect(
      expandShoppeTemplate('Hail! Welcome to #! I am $. A fine @?"', {
        keeper: "Pendra",
        shop: "Healers Herbs",
        day: "afternoon",
      }),
    ).toBe('Hail! Welcome to Healers Herbs! I am Pendra. A fine afternoon?"');
  });
  it("sustituye TODAS las ocurrencias de cada placeholder", () => {
    expect(expandShoppeTemplate("@ and @, $ of #", { keeper: "K", shop: "S", day: "d" })).toBe(
      "d and d, K of S",
    );
  });
  it("plantillas sin @ quedan intactas (barcos [106]/[108], curandero [166]/[167])", () => {
    expect(expandShoppeTemplate("I am $, of #.", { keeper: "Faye", shop: "The Shield", day: "morning" })).toBe(
      "I am Faye, of The Shield.",
    );
  });
});

describe("SHOPPE_GREETING_INDEX — tabla 2D DS 0x3b2a (DATA.OVL 0x3b3a)", () => {
  it("7 tipos de tabla con 4 variantes cada uno; el Blacksmith NO está (fila 0x0000×4 = vía propia 0x12b2)", () => {
    const types = Object.keys(SHOPPE_GREETING_INDEX).sort();
    expect(types).toEqual(
      ["Barkeeper", "GuildMaster", "Healer", "HorseSeller", "InnKeeper", "MagicSeller", "Shipwright"].sort(),
    );
    for (const idx of Object.values(SHOPPE_GREETING_INDEX)) expect(idx).toHaveLength(4);
  });
  it("los rangos son los verificados contra SHOPPE.DAT (careo por offset→contenido)", () => {
    expect(SHOPPE_GREETING_INDEX.MagicSeller).toEqual([127, 128, 129, 130]);
    expect(SHOPPE_GREETING_INDEX.Barkeeper).toEqual([57, 58, 59, 60]);
    expect(SHOPPE_GREETING_INDEX.HorseSeller).toEqual([92, 93, 94, 95]);
    expect(SHOPPE_GREETING_INDEX.Shipwright).toEqual([105, 106, 107, 108]);
    expect(SHOPPE_GREETING_INDEX.GuildMaster).toEqual([148, 149, 150, 151]);
    expect(SHOPPE_GREETING_INDEX.Healer).toEqual([165, 166, 167, 168]);
    expect(SHOPPE_GREETING_INDEX.InnKeeper).toEqual([174, 175, 176, 177]);
  });
});
