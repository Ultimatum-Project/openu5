import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseIntroScenes } from "../src/parsers/intro-scenes.js";
import { U5_DIR } from "./helpers.js";

const read = (name: string) => new Uint8Array(readFileSync(`${U5_DIR}/${name}`));

/**
 * Tablas de escena de "The Summoning" (play_introduction). Valores derivados+
 * citados en re/notes/intro-scene-tables.md; verificados contra los bytes de
 * DATA.OVL + STORY.DAT.
 */
describe("parseIntroScenes (tablas de escena de The Summoning)", () => {
  const scenes = parseIntroScenes(read("DATA.OVL"), read("STORY.DAT"));

  it("21 escenas", () => {
    expect(scenes.length).toBe(21);
  });

  it("las tablas casan con los valores derivados (subimg/tipo/fichero)", () => {
    expect(scenes.map((s) => s.subimg)).toEqual([0, 1, 0, 1, 2, 2, 2, 0, 1, 0, 1, 0, 1, 0, 1, 2, 6, 4, 2, 6, 4]);
    expect(scenes.map((s) => s.type)).toEqual([1, 2, 0, 0, 0, 0, 3, 1, 0, 0, 0, 0, 0, 0, 1, 4, 5, 6, 5, 6, 4]);
    expect(scenes.map((s) => s.storyFile)).toEqual([0, 0, 1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5]);
  });

  it("blit (flags, Y=0x30da, X=0x30c4, subimg): X e Y caben en pantalla (176×192)", () => {
    // §4: roles X/Y CITADOS del driver EGA.DRV 0x12b4 (Y indexa scanlines +height,
    // X se divide entre 8). En la tabla principal X≤176, Y≤200 (las X grandes 248
    // son de los marcos TEXT.16, §3, no de 0x30c4).
    expect(scenes.map((s) => s.x)).toEqual([0, 0, 136, 0, 152, 0, 72, 0, 0, 0, 0, 0, 0, 176, 0, 176, 0, 176, 0, 176, 0]);
    expect(scenes.every((s) => s.y <= 200 && s.x <= 200)).toBe(true);
  });

  it("la escena 0 abre con las nubes; la 6 (puerta azul) usa los strings de DATA.OVL", () => {
    expect(scenes[0]!.text).toContain("smoky wisps of clouds");
    expect(scenes[6]!.type).toBe(3);
    expect(scenes[6]!.text).toContain("shimmering blue door");
    expect(scenes[6]!.text).toContain("step into it");
  });

  it("los beats ricos son de este bucle: Shamino (13), Iolo (15), Blackthorn (19)", () => {
    expect(scenes[13]!.text).toContain("Shamino lies");
    expect(scenes[15]!.text).toContain("Iolo");
    expect(scenes[19]!.text).toContain("Blackthorn");
  });
});
