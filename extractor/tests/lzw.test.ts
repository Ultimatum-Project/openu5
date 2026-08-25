import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decompressLzw } from "../src/parsers/lzw.js";
import { U5_DIR } from "./helpers.js";

const read = (name: string) => new Uint8Array(readFileSync(`${U5_DIR}/${name}`));

describe("decompressLzw (u6decode 9-12 bit variable, LSB-first)", () => {
  it("descomprime TILES.16 a exactamente 512 tiles × 128 bytes", () => {
    const out = decompressLzw(read("TILES.16"));
    expect(out.length).toBe(65536);
  });

  it("descomprime TILES.4 a 32768 bytes", () => {
    expect(decompressLzw(read("TILES.4")).length).toBe(32768);
  });

  it("descomprime las pantallas .16 a su longitud declarada", () => {
    expect(decompressLzw(read("ULTIMA.16")).length).toBe(38170);
    expect(decompressLzw(read("STARTSC.16")).length).toBe(21946);
    expect(decompressLzw(read("CREATE.16")).length).toBe(37502);
    expect(decompressLzw(read("MON1.16")).length).toBe(2614);
  });

  it("produce contenido no uniforme (datos reales, no ceros)", () => {
    const out = decompressLzw(read("TILES.16"));
    const distinct = new Set(out.subarray(0, 4096));
    expect(distinct.size).toBeGreaterThan(4);
  });

  it("rechaza ficheros truncados", () => {
    expect(() => decompressLzw(new Uint8Array([1, 0]))).toThrow();
  });
});
