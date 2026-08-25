import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLargeMap } from "../src/parsers/largemap.js";
import { U5_DIR } from "./helpers.js";

const read = (name: string) => new Uint8Array(readFileSync(`${U5_DIR}/${name}`));

/** Índice de chunks del overworld: DATA.OVL[0x3886..0x3985] (256 bytes). */
const OVERWORLD_OVERLAY_OFFSET = 0x3886;

describe("parseLargeMap (overworld 256×256)", () => {
  it("UNDER.DAT es denso: 65536 bytes y parsea sin overlay", () => {
    const under = read("UNDER.DAT");
    expect(under.length).toBe(65536);

    const map = parseLargeMap(under, null);
    expect(map.length).toBe(256);
    expect(map.every((row) => row.length === 256)).toBe(true);
  });

  it("BRIT.DAT disperso: consume EXACTAMENTE el fichero entero con el overlay", () => {
    const brit = read("BRIT.DAT");
    const ovl = read("DATA.OVL");
    const overlay = ovl.subarray(
      OVERWORLD_OVERLAY_OFFSET,
      OVERWORLD_OVERLAY_OFFSET + 256,
    );
    expect(overlay.length).toBe(256);

    // 205 chunks presentes × 256 bytes = 52480 = BRIT.DAT entero.
    const waterChunks = overlay.filter((b) => b === 0xff).length;
    expect(waterChunks).toBe(51);
    const bytesConsumed = (256 - waterChunks) * 256;
    expect(bytesConsumed).toBe(brit.length);

    const map = parseLargeMap(brit, overlay);
    expect(map.length).toBe(256);
    expect(map.every((row) => row.length === 256)).toBe(true);
  });

  it("chunk (0,0) es todo agua (tile 1) y el mapa tiene >50 tiles distintos", () => {
    const brit = read("BRIT.DAT");
    const ovl = read("DATA.OVL");
    const overlay = ovl.subarray(
      OVERWORLD_OVERLAY_OFFSET,
      OVERWORLD_OVERLAY_OFFSET + 256,
    );

    // El overlay marca el chunk 0 como agua (0xFF).
    expect(overlay[0]).toBe(0xff);

    const map = parseLargeMap(brit, overlay);

    // Chunk (0,0) = filas 0..15, columnas 0..15, todo tile 0x01 (agua).
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        expect(map[y]![x]).toBe(0x01);
      }
    }

    const distinct = new Set<number>();
    for (const row of map) for (const t of row) distinct.add(t);
    expect(distinct.size).toBeGreaterThan(50);
  });
});
