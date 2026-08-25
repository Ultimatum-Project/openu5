/**
 * Pack de perspectiva de mazmorra (DNG1/2/3.16 → task #31). Fija el contenedor
 * (28 ranuras, altura 164, anchos por índice), el pixelado 4bpp, y que las tres
 * variantes de textura difieren (oliva vs gris). El PÍXEL exacto de cada rodaja y
 * su mapeo id→celda son Clase C (spec §9, pixel-diff #26); aquí se ancla el pack.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decompressLzw } from "../src/parsers/lzw.js";
import { EGA_PALETTE } from "../src/parsers/tiles.js";
import {
  DNG_VIEW_COUNT,
  DNG_VIEW_HEIGHT,
  dngViewsToAtlas,
  parseDngView,
  parseItemsView,
} from "../src/parsers/dngtiles.js";
import { U5_DIR } from "./helpers.js";

const dec = (name: string) =>
  decompressLzw(new Uint8Array(readFileSync(`${U5_DIR}/${name}`)));

/** Anchos observados por índice (null = ranura vacía: índices 8 y 24). */
const WIDTHS: (number | null)[] = [
  24, 32, 16, 8, 24, 32, 16, 8, null, 56, 24, 8, 80, 56, 24, 8,
  24, 32, 16, 8, 24, 32, 16, 8, null, 56, 24, 8,
];

describe("parseDngView (contenedor de perspectiva)", () => {
  it("los tres DNG*.16 descomprimen a 54666 B y comparten cabecera", () => {
    const d1 = dec("DNG1.16");
    const d2 = dec("DNG2.16");
    const d3 = dec("DNG3.16");
    expect(d1.length).toBe(54666);
    expect(d2.length).toBe(54666);
    expect(d3.length).toBe(54666);
    // La tabla de offsets (primeros 114 B) es idéntica: misma geometría de ranuras.
    expect(Array.from(d2.subarray(0, 114))).toEqual(Array.from(d1.subarray(0, 114)));
    expect(Array.from(d3.subarray(0, 114))).toEqual(Array.from(d1.subarray(0, 114)));
  });

  it("devuelve 28 ranuras, 2 nulas (8 y 24), todas de altura 164", () => {
    const imgs = parseDngView(dec("DNG1.16"));
    expect(imgs.length).toBe(DNG_VIEW_COUNT);
    expect(imgs[8]).toBeNull();
    expect(imgs[24]).toBeNull();
    imgs.forEach((im, i) => {
      expect(im ? im.width : null).toBe(WIDTHS[i]);
      if (im) {
        expect(im.height).toBe(DNG_VIEW_HEIGHT);
        expect(im.rgba.length).toBe(im.width * im.height * 4);
      }
    });
  });

  it("todos los píxeles son colores EGA con alpha 255", () => {
    const paletteSet = new Set(EGA_PALETTE.map(([r, g, b]) => `${r},${g},${b}`));
    for (const im of parseDngView(dec("DNG1.16"))) {
      if (!im) continue;
      for (let i = 0; i < im.rgba.length; i += 4) {
        expect(im.rgba[i + 3]).toBe(255);
        expect(paletteSet.has(`${im.rgba[i]},${im.rgba[i + 1]},${im.rgba[i + 2]}`)).toBe(true);
      }
    }
  });

  it("píxeles fijados de DNG1[0] (24×164): muro oliva a media altura, negro al centro", () => {
    const im = parseDngView(dec("DNG1.16"))[0]!;
    const at = (row: number, col: number): [number, number, number] => {
      const o = (row * im.width + col) * 4;
      return [im.rgba[o]!, im.rgba[o + 1]!, im.rgba[o + 2]!];
    };
    expect(at(0, 0)).toEqual([0, 0, 0]); // techo/vacío en la esquina superior
    expect(at(82, 0)).toEqual(EGA_PALETTE[6]); // oliva #AAAA00 en el muro izquierdo
    expect(at(82, 12)).toEqual([0, 0, 0]); // hueco negro (pasillo) al centro
  });

  it("las variantes difieren en textura: DNG1[9] oliva (6) vs DNG3[9] gris (7)", () => {
    const a = parseDngView(dec("DNG1.16"))[9]!;
    const b = parseDngView(dec("DNG3.16"))[9]!;
    // Primer píxel divergente (idx 168 en índices de color): 6 vs 7.
    expect([a.rgba[168 * 4], a.rgba[168 * 4 + 1], a.rgba[168 * 4 + 2]]).toEqual(EGA_PALETTE[6]);
    expect([b.rgba[168 * 4], b.rgba[168 * 4 + 1], b.rgba[168 * 4 + 2]]).toEqual(EGA_PALETTE[7]);
  });
});

describe("dngViewsToAtlas", () => {
  it("empaqueta 3 variantes en filas de 164 px con rects coherentes", () => {
    const variants = ["DNG1.16", "DNG2.16", "DNG3.16"].map((f) => ({
      name: f,
      images: parseDngView(dec(f)),
    }));
    const atlas = dngViewsToAtlas(variants);
    expect(atlas.height).toBe(3 * DNG_VIEW_HEIGHT);
    expect(atlas.rgba.length).toBe(atlas.width * atlas.height * 4);
    expect(atlas.meta.variants.length).toBe(3);
    expect(atlas.meta.count).toBe(DNG_VIEW_COUNT);
    // Rects: nulos en 8 y 24; el resto dentro del atlas, altura 164.
    const rects = atlas.meta.variants[0]!.rects;
    expect(rects[8]).toBeNull();
    expect(rects[24]).toBeNull();
    const r0 = rects[0]!;
    expect(r0).toMatchObject({ x: 0, y: 0, w: 24, h: 164 });
    for (const r of rects) {
      if (!r) continue;
      expect(r.x + r.w).toBeLessThanOrEqual(atlas.width);
      expect(r.y + r.h).toBeLessThanOrEqual(atlas.height);
    }
    // Segunda variante en la fila y=164.
    expect(atlas.meta.variants[1]!.rects[0]!.y).toBe(164);
  });
});

describe("parseItemsView (banco de features ITEMS.16, 20 pares img+máscara)", () => {
  it("parsea los 20 PARES (offImagen, offMáscara) — 5 grupos × 4 profundidades", () => {
    const items = parseItemsView(dec("ITEMS.16"));
    expect(items.length).toBe(20);
    const dims = items.map((im) => (im ? `${im.width}x${im.height}` : null));
    // escalera 0-3 y fuente 4-7 (alto, suelo→techo)
    expect(dims.slice(0, 4)).toEqual(["40x80", "24x56", "16x24", "8x8"]);
    expect(dims.slice(4, 8)).toEqual(["40x80", "24x56", "16x24", "8x8"]);
    // trampa 8-11 y cofre cerrado 12-15 (bajos, sobre el suelo)
    expect(dims.slice(8, 12)).toEqual(["40x24", "24x32", "16x16", "8x8"]);
    expect(dims.slice(12, 16)).toEqual(["40x24", "24x32", "16x16", "8x8"]);
    // cofre ABIERTO 16-19 (la prof. 3 del contenedor es 16x16, no 8x8)
    expect(dims.slice(16)).toEqual(["40x24", "24x32", "16x16", "16x16"]);
  });

  it("transparencia por MÁSCARA AND, no por color-0: el interior negro del cofre es OPACO", () => {
    const items = parseItemsView(dec("ITEMS.16"));
    const chest = items[16]!; // cofre abierto, prof. cercana (40x24)
    const alphaAt = (x: number, y: number) => chest.rgba[(y * chest.width + x) * 4 + 3];
    const rgbAt = (x: number, y: number): [number, number, number] => {
      const o = (y * chest.width + x) * 4;
      return [chest.rgba[o]!, chest.rgba[o + 1]!, chest.rgba[o + 2]!];
    };
    // (0,0): fuera del cofre → bit de máscara 1 → transparente.
    expect(alphaAt(0, 0)).toBe(0);
    // (17,2): color 0 (negro) pero bit de máscara 0 → OPACO (el hueco del cofre).
    expect(rgbAt(17, 2)).toEqual([0, 0, 0]);
    expect(alphaAt(17, 2)).toBe(255);
  });

  it("la máscara CUBRE el arte: todo píxel de color ≠0 es opaco (bit-order MSB-first correcto)", () => {
    for (const im of parseItemsView(dec("ITEMS.16"))) {
      if (!im) continue;
      for (let i = 0; i < im.rgba.length; i += 4) {
        const colored = im.rgba[i]! | im.rgba[i + 1]! | im.rgba[i + 2]!;
        if (colored) expect(im.rgba[i + 3]).toBe(255);
      }
    }
  });

  it("cada imagen tiene zona transparente y zona opaca (sprite overlay real)", () => {
    for (const im of parseItemsView(dec("ITEMS.16"))) {
      if (!im) continue;
      let anyTransparent = false;
      let anyOpaque = false;
      for (let i = 3; i < im.rgba.length; i += 4) {
        if (im.rgba[i] === 0) anyTransparent = true;
        else if (im.rgba[i] === 255) anyOpaque = true;
      }
      expect(anyTransparent).toBe(true);
      expect(anyOpaque).toBe(true);
    }
  });
});
