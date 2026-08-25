import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decompressLzw } from "../src/parsers/lzw.js";
import {
  EGA_PALETTE,
  parseTiles,
  tilesToAtlasRgba,
} from "../src/parsers/tiles.js";
import { xbr4x } from "../src/upscale/xbr.js";
import { U5_DIR } from "./helpers.js";

const tilesData = () => decompressLzw(new Uint8Array(readFileSync(`${U5_DIR}/TILES.16`)));

describe("parseTiles (4bpp chunky, nibble alto = píxel izquierdo)", () => {
  it("devuelve 512 tiles de 1024 bytes RGBA cada uno", () => {
    const tiles = parseTiles(tilesData());
    expect(tiles.length).toBe(512);
    for (const t of tiles) expect(t.length).toBe(1024);
  });

  it("el tile 0 no es uniforme (varios colores distintos)", () => {
    const tile0 = parseTiles(tilesData())[0]!;
    const colors = new Set<string>();
    for (let i = 0; i < tile0.length; i += 4) {
      colors.add(`${tile0[i]},${tile0[i + 1]},${tile0[i + 2]}`);
    }
    expect(colors.size).toBeGreaterThan(1);
  });

  it("todos los píxeles usan colores de la paleta EGA con alpha 255", () => {
    const paletteSet = new Set(EGA_PALETTE.map(([r, g, b]) => `${r},${g},${b}`));
    const tiles = parseTiles(tilesData());
    for (const tile of tiles) {
      for (let i = 0; i < tile.length; i += 4) {
        expect(tile[i + 3]).toBe(255);
        expect(paletteSet.has(`${tile[i]},${tile[i + 1]},${tile[i + 2]}`)).toBe(
          true,
        );
      }
    }
  });

  it("índice 6 es marrón #AA5500, no oliva #AAAA00 (EGA con brown-fix)", () => {
    // Witness runtime: los frames reales de DOSBox-X pintan idx6 marrón #AA5500
    // (re/notes/palette-idx6-verdict.md; par-iolohut-original.png 16160 px marrón,
    // 0 oliva). SUPERSEDE la hipótesis oliva de #25 (tabla @0x52ee leída pero su
    // escritura al ATC nunca witnessada). Si alguien revierte a oliva, cae.
    expect(EGA_PALETTE[6]).toEqual([0xaa, 0x55, 0x00]);
  });

  it("compone un atlas coherente (32 cols → 512×256)", () => {
    const tiles = parseTiles(tilesData());
    const atlas = tilesToAtlasRgba(tiles, 32);
    expect(atlas.width).toBe(512);
    expect(atlas.height).toBe(256);
    expect(atlas.rgba.length).toBe(512 * 256 * 4);
  });
});

describe("xbr4x", () => {
  it("escala un tile 16×16 a 64×64", () => {
    const tile0 = parseTiles(tilesData())[0]!;
    const up = xbr4x(tile0, 16, 16);
    expect(up.width).toBe(64);
    expect(up.height).toBe(64);
    expect(up.rgba.length).toBe(64 * 64 * 4);
  });

  it("rechaza buffers con dimensiones incoherentes", () => {
    expect(() => xbr4x(new Uint8Array(10), 16, 16)).toThrow();
  });
});
