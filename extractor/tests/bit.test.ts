import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decompressLzw } from "../src/parsers/lzw.js";
import { bitToPixels, parseBit } from "../src/parsers/bit.js";
import { U5_DIR } from "./helpers.js";

const read = (name: string) => new Uint8Array(readFileSync(`${U5_DIR}/${name}`));

/**
 * TITLE.BIT (logo ORIGIN SYSTEMS, a tamaños crecientes) + BRITISH.BIT ("Lord
 * British") = máscaras 1bpp de los logos de arranque (video-diff E1). Formato
 * derivado (blit indexado 0x8e84 + fit byte-exacto); ver bit.ts.
 */
describe("parseBit (.BIT máscaras 1bpp)", () => {
  const title = parseBit(decompressLzw(read("TITLE.BIT")));
  const british = parseBit(decompressLzw(read("BRITISH.BIT")));

  it("TITLE.BIT = 10 sub-imágenes; la última es el logo a tamaño completo (280×61)", () => {
    expect(title.length).toBe(10);
    expect(title[6]).toMatchObject({ width: 280, height: 61 });
  });

  it("BRITISH.BIT = 1 máscara (272×62)", () => {
    expect(british.length).toBe(1);
    expect(british[0]).toMatchObject({ width: 272, height: 62 });
  });

  it("la máscara es binaria (0/1) y tiene forma (ni vacía ni llena)", () => {
    const m = title[6]!.mask;
    expect(m.length).toBe(280 * 61);
    let on = 0;
    for (const v of m) {
      expect(v === 0 || v === 1).toBe(true);
      on += v;
    }
    expect(on).toBeGreaterThan(0);
    expect(on).toBeLessThan(m.length);
  });

  it("bitToPixels mapea on→índice EGA, off→0 (negro)", () => {
    const px = bitToPixels(british[0]!, 15);
    expect(px.width).toBe(272);
    expect(px.pixels.length).toBe(272 * 62);
    for (const v of px.pixels) expect(v === 0 || v === 15).toBe(true);
  });
});
