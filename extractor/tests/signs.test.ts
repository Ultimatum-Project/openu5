import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSigns, scrubSignText } from "../src/parsers/signs.js";
import { U5_DIR } from "./helpers.js";

const signsDat = new Uint8Array(readFileSync(`${U5_DIR}/SIGNS.DAT`));
const dataOvl = new Uint8Array(readFileSync(`${U5_DIR}/DATA.OVL`));
const signs = parseSigns(signsDat, dataOvl);

describe("parseSigns (SIGNS.DAT de Ultima V)", () => {
  it("extrae varios carteles", () => {
    expect(signs.length).toBeGreaterThan(0);
    // Muchas ciudades + carteles del overworld: decenas de entradas.
    expect(signs.length).toBeGreaterThan(30);
  });

  it("cada cartel tiene coordenadas y location válidas", () => {
    for (const s of signs) {
      expect(typeof s.location).toBe("number");
      expect(typeof s.floor).toBe("number");
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(typeof s.text).toBe("string");
      // bytes CRUDOS horneados presentes (calco byte-exacto de la piel fiel)
      expect(Array.isArray(s.raw)).toBe(true);
      expect(s.raw.every((b) => Number.isInteger(b) && b >= 0 && b <= 0xff)).toBe(true);
    }
  });

  it("el primer cartel trae sus bytes horneados con marco (esquinas 0x38/0x39)", () => {
    const raw = signs[0]!.raw;
    expect(raw[0]).toBe(0x38); // esquina superior-izquierda
    expect(raw).toContain(0x39); // esquina superior-derecha
    expect(raw).toContain(0x40); // rombo inter-palabra (`@`)
  });

  it("el primer cartel del overworld indica direcciones legibles", () => {
    // Cartel en (95,148) del overworld: NORTH BRITAIN / EAST PAWS / SOUTH TRINSIC.
    const first = signs[0]!;
    expect(first.location).toBe(0);
    expect(first.text).toContain("BRITAIN");
    expect(first.text).toContain("TRINSIC");
  });

  it("algún cartel contiene texto claramente legible", () => {
    const hasBeware = signs.some((s) => s.text.includes("BEWARE"));
    expect(hasBeware).toBe(true);
  });

  it("incluye el cartel extra de Serpent's Hold (DATA.OVL)", () => {
    const sh = signs[signs.length - 1]!;
    expect(sh.location).toBe(32); // Serpent's Hold
    expect(sh.x).toBe(15);
    expect(sh.y).toBe(19);
    expect(sh.text.length).toBeGreaterThan(0);
  });
});

describe("scrubSignText", () => {
  it("mantiene mayúsculas y espacios, descarta el dibujo del marco", () => {
    // '8','l','9' son caracteres de dibujo del marco (dígitos + minúsculas) → fuera.
    expect(scrubSignText("8lll9 HELLO")).toBe(" HELLO");
  });

  it("expande el dígrafo @ a espacio y [ a TH", () => {
    expect(scrubSignText("NOR[@BRITAIN")).toBe("NORTH BRITAIN");
  });

  it("convierte bytes con bit alto a su ASCII (byte − 0x80)", () => {
    // 0xC2 0xCC 0xC1 0xC3 0xCB → B L A C K
    const raw = String.fromCharCode(0xc2, 0xcc, 0xc1, 0xc3, 0xcb);
    expect(scrubSignText(raw)).toBe("BLACK");
  });
});
