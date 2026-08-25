import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStory } from "../src/parsers/story.js";
import { U5_DIR } from "./helpers.js";

const read = (name: string) => new Uint8Array(readFileSync(`${U5_DIR}/${name}`));

/**
 * STORY.DAT = guion de "The Summoning". Verificado contra los bytes originales de
 * MS-DOS Ultima V; separador REAL = NUL (20 registros de texto ↔ 21 escenas: la
 * escena 6 "puerta azul" lee DATA.OVL, no STORY.DAT), '{' = sangría (scout de
 * escenas, re/notes/intro-scene-tables.md).
 */
describe("parseStory (STORY.DAT)", () => {
  const records = parseStory(read("STORY.DAT"));

  it("trocea el guion por NUL en 20 registros de texto, NO por '{'", () => {
    expect(records.length).toBe(20);
  });

  it("el primer registro abre la cinemática (nubes tapan la luna)", () => {
    expect(records[0]).toContain("smoky wisps of clouds");
    expect(records[0]).toContain("moon");
  });

  it("elimina guiones discrecionales '_' y traduce la sangría '{' (sin '{' residual)", () => {
    for (const r of records) {
      expect(r).not.toContain("_");
      expect(r).not.toContain("{");
    }
  });

  it("incluye los beats derivados: Codex, Ankh, Shadowlords, Lord British", () => {
    const all = records.join("\n");
    expect(all).toContain("Codex");
    expect(all).toContain("Ankh");
    expect(all).toContain("Shadowlord");
    expect(all).toContain("Lord British");
  });
});
