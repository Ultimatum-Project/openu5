import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseQuestions } from "../src/parsers/questions.js";
import { U5_DIR } from "./helpers.js";

const read = (name: string) => new Uint8Array(readFileSync(`${U5_DIR}/${name}`));

/** Texto visible: sin los guiones discrecionales (U+00AD) que marca el justificador. */
const visible = (s: string): string => s.replace(/­/g, "");
const SOFT_HYPHEN = "­";

/**
 * QUESTION.DAT = cuestionario de la gitana (creación de personaje). Verificado
 * contra los bytes originales de MS-DOS Ultima V; ver re/notes/gypsy.md.
 */
describe("parseQuestions (QUESTION.DAT)", () => {
  const data = parseQuestions(read("QUESTION.DAT"));

  it("2 narraciones + 28 preguntas", () => {
    expect(data.narrations).toHaveLength(2);
    expect(data.questions).toHaveLength(28);
  });

  it("la primera narración es la entrada al carro de la gitana", () => {
    expect(visible(data.narrations[0]!)).toContain("gypsy");
    expect(data.narrations[0]!.startsWith("{")).toBe(false); // marcador retirado
  });

  it("conserva los guiones discrecionales como SOFT HYPHEN (U+00AD), no como '_'", () => {
    // El '_' (0x5f) del justificador se preserva como U+00AD para que el motor pueda
    // hifenar; NUNCA queda como '_' literal (ni se pierde el punto de corte).
    expect(data.narrations[1]).toContain(SOFT_HYPHEN);
    expect(data.narrations[1]).not.toContain("_");
    // Y sigue siendo el texto correcto una vez retirados los guiones invisibles.
    expect(visible(data.narrations[1]!)).toContain("an Avatar in your own right");
  });

  it("cada pregunta ofrece opción A) y B) y no conserva '_' literal", () => {
    for (const q of data.questions) {
      expect(visible(q)).toContain("A)");
      expect(visible(q)).toContain("B)");
      expect(q).not.toContain("_");
    }
  });

  it("Q1 (Honesty vs Compassion) menciona al mendigo", () => {
    expect(visible(data.questions[0]!)).toContain("beggar");
  });
});
