import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decompressLzw } from "../src/parsers/lzw.js";
import { packPic16Atlas, parsePic16 } from "../src/parsers/pic16.js";
import { EGA_PALETTE } from "../src/parsers/tiles.js";
import { U5_DIR } from "./helpers.js";

const read = (name: string) => new Uint8Array(readFileSync(`${U5_DIR}/${name}`));

/**
 * CREATE.16 / STORY*.16 = archivos LZW de sub-imágenes 4bpp (retrato de la
 * gitana, pebeteros de virtud, escenas de The Summoning). Formato derivado byte a
 * byte (tamaño de bloque = w·h/2 + 4); ver pic16.ts.
 */
describe("parsePic16 (.16 láminas de intro)", () => {
  const create = parsePic16(decompressLzw(read("CREATE.16")));
  const story1 = parsePic16(decompressLzw(read("STORY1.16")));

  it("CREATE.16 = 11 sub-imágenes; STORY1.16 = 3", () => {
    expect(create.length).toBe(11);
    expect(story1.length).toBe(3);
  });

  it("el retrato de la gitana (CREATE.16 img0) es 168×96", () => {
    expect(create[0]!.width).toBe(168);
    expect(create[0]!.height).toBe(96);
    expect(create[0]!.pixels.length).toBe(168 * 96);
  });

  it("la escena del cartón de The Summoning (STORY1.16 img0) es 176×192", () => {
    expect(story1[0]!.width).toBe(176);
    expect(story1[0]!.height).toBe(192);
  });

  it("los píxeles son índices EGA válidos (0..15)", () => {
    for (const px of create[0]!.pixels) expect(px).toBeGreaterThanOrEqual(0), expect(px).toBeLessThanOrEqual(15);
  });

  it("el atlas empaqueta las láminas y su manifiesto casa con las dimensiones", () => {
    const atlas = packPic16Atlas(
      [
        { name: "gypsy", image: create[0]! },
        { name: "scene", image: story1[0]! },
      ],
      EGA_PALETTE,
    );
    expect(atlas.width).toBe(176); // máx ancho
    expect(atlas.height).toBe(96 + 192);
    expect(atlas.entries[0]).toMatchObject({ name: "gypsy", x: 0, y: 0, width: 168, height: 96 });
    expect(atlas.entries[1]).toMatchObject({ name: "scene", y: 96, width: 176, height: 192 });
    expect(atlas.rgba.length).toBe(176 * 288 * 4);
  });
});
