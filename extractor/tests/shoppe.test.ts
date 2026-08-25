import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractCompressedWords } from "../src/parsers/tlk.js";
import { parseShoppeDat } from "../src/parsers/shoppe.js";
import { U5_DIR } from "./helpers.js";

const read = (name: string) => new Uint8Array(readFileSync(`${U5_DIR}/${name}`));

describe("parseShoppeDat (SHOPPE.DAT — diálogos de mercader comprimidos)", () => {
  const words = extractCompressedWords(read("DATA.OVL"));
  const strings = parseShoppeDat(read("SHOPPE.DAT"), words);

  it("produce bastante más de 150 cadenas de diálogo", () => {
    expect(strings.length).toBeGreaterThan(150);
  });

  it("cada entrada es una cadena", () => {
    for (const s of strings) expect(typeof s).toBe("string");
  });

  it("descomprime palabras del diccionario en texto legible de mercader", () => {
    // El diálogo del healer (índice 165) saluda al Avatar y usa símbolos de
    // plantilla ($ = nombre del mercader, # = negocio, @ = momento del día).
    expect(strings[165]).toContain("welcome");
    expect(strings[165]).toContain("$");
    expect(strings[165]).toContain("#");

    // El posadero (186) ofrece cama por oro (% = cantidad de oro).
    expect(strings[186]).toContain("feather beds");
    expect(strings[186]).toContain("%");
  });

  it("conserva palabras completas descomprimidas (no bytes crudos sueltos)", () => {
    const joined = strings.join("\n");
    expect(joined).toContain("gold");
    expect(joined).toContain("thee");
    // Ningún byte de control ni char con bit alto debe sobrevivir.
    expect(/[\x80-\xff]/.test(joined)).toBe(false);
    expect(/[\x00-\x08]/.test(joined)).toBe(false);
  });

  it("alguna cadena contiene una frase de venta reconocible", () => {
    const hasSellLine = strings.some((s) => /I can offer ye % gold/.test(s));
    expect(hasSellLine).toBe(true);
  });
});
