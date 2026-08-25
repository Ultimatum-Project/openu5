/**
 * Tabla de nombres CORTOS del equipo (DATA.OVL DS 0x1962) — la fuente FIEL del picker
 * de (R)eady, la lista-4 de Ztats y la página de armas de Ztats. El original NUNCA
 * trunca: usa formas abreviadas que caben en las 10 celdas del campo de nombre. El port
 * antes pintaba los nombres LARGOS de InventoryDetails truncados a lo bruto ("Cloth
 * Armo", "Flaming Oi") = infidelidad de fuente; este carril lo corrige.
 *
 * Estos tests fijan (a) el contenido byte-exacto de la tabla y (b) que todo nombre cabe
 * en 10 celdas (invariante que hace innecesario el truncado), y (c) el choke i18n de la
 * piel del picker (t() sobre el nombre display).
 */
import { describe, it, expect, afterEach } from "vitest";
import shortEquip from "../src/core/data/shortEquipNames.json";
import { readyRowCells } from "../src/skin/fiel/ready.js";
import { setLang, BASE_LANG } from "../src/i18n/index.js";

const NAMES = shortEquip.names as string[];

describe("shortEquipNames — tabla fiel DS 0x1962 (byte-exacta)", () => {
  it("son 48 entradas en orden de equipId", () => {
    expect(NAMES).toHaveLength(48);
  });

  it("los nombres clave coinciden con el volcado del binario", () => {
    // Muestras del hallazgo del usuario (port-vs-original): formas CORTAS, sin truncar.
    expect(NAMES[9]).toBe("Cloth"); // no "Cloth Armour"
    expect(NAMES[13]).toBe("Chain"); // no "Chain Mail"
    expect(NAMES[19]).toBe("Flame Oil"); // no "Flaming Oil"
    expect(NAMES[30]).toBe("Long Sword");
    expect(NAMES[47]).toBe("Ankh");
    expect(NAMES[1]).toBe("Chain Coif");
    expect(NAMES[4]).toBe("Sm. Shield"); // no "Small Shield"
    expect(NAMES[35]).toBe("Chaos Swrd"); // no "Sword of Chaos"/"Swordof Chaos"
  });

  it("todo nombre cabe en 10 celdas (invariante: el picker NO trunca)", () => {
    const tooLong = NAMES.filter((n) => n.length > 10);
    expect(tooLong).toEqual([]);
  });
});

describe("readyRowCells — i18n del nombre corto (choke de la piel)", () => {
  afterEach(() => setLang(BASE_LANG, { persist: false }));

  it("'en' = identidad: pinta el nombre corto fiel tal cual", () => {
    const { cells } = readyRowCells({ name: "Flame Oil", qty: 3, equipped: false, glyph: 0x08 }, 13);
    const text = cells.map((c) => String.fromCharCode(c)).join("").trimEnd();
    expect(text).toBe(" 3 Flame Oil"); // sin truncar
  });

  it("'es' con hit: traduce el nombre corto en el sitio (Flame Oil → Aceite Inf)", () => {
    setLang("es", { persist: false });
    const { cells } = readyRowCells({ name: "Flame Oil", qty: 3, equipped: false, glyph: 0x08 }, 13);
    const text = cells.map((c) => String.fromCharCode(c)).join("").trimEnd();
    expect(text).toBe(" 3 Aceite Inf");
  });

  // Override ES corto del picker: 6 ítems cuya ES de key compartida es >10 celdas.
  it("'es': override corto del picker en vez del ES largo compartido (Chain Coif → Cofia Mall)", () => {
    setLang("es", { persist: false });
    const { cells } = readyRowCells({ name: "Chain Coif", qty: 1, equipped: false, glyph: 0x01 }, 13);
    const text = cells.map((c) => String.fromCharCode(c)).join("").trimEnd();
    expect(text).toBe(" 1 Cofia Mall"); // NO "Cofia de M" (truncado del ES de tienda)
  });

  it("'es': Ring Mail (picker-only) → «Anillas»", () => {
    setLang("es", { persist: false });
    const { cells } = readyRowCells({ name: "Ring Mail", qty: 1, equipped: false, glyph: 0x03 }, 13);
    const text = cells.map((c) => String.fromCharCode(c)).join("").trimEnd();
    expect(text).toBe(" 1 Anillas");
  });

  it("'en': el override NO aplica — nombre inglés fiel intacto", () => {
    const { cells } = readyRowCells({ name: "Chain Coif", qty: 1, equipped: false, glyph: 0x01 }, 13);
    const text = cells.map((c) => String.fromCharCode(c)).join("").trimEnd();
    expect(text).toBe(" 1 Chain Coif");
  });
});
