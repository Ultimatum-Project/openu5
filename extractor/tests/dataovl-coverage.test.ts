import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DATAOVL_CHUNKS } from "../src/parsers/dataovl.js";
import { U5_DIR } from "./helpers.js";

const bytes = new Uint8Array(readFileSync(`${U5_DIR}/DATA.OVL`));

/** Runs de ≥`minLen` bytes ASCII imprimibles (0x20..0x7E) en `data`. */
function printableRuns(data: Uint8Array, minLen = 4): [number, number][] {
  const out: [number, number][] = [];
  let start: number | null = null;
  for (let i = 0; i < data.length; i++) {
    const b = data[i]!;
    if (b >= 0x20 && b < 0x7e) {
      if (start === null) start = i;
    } else {
      if (start !== null && i - start >= minLen) out.push([start, i]);
      start = null;
    }
  }
  if (start !== null && data.length - start >= minLen)
    out.push([start, data.length]);
  return out;
}

describe("cobertura de strings de DATA.OVL (Task 2.1)", () => {
  it("los chunks no se solapan y caben en el fichero", () => {
    const sorted = [...DATAOVL_CHUNKS].sort((a, b) => a.offset - b.offset);
    for (const c of sorted) {
      expect(c.length).toBeGreaterThan(0);
      expect(c.offset + c.length).toBeLessThanOrEqual(bytes.length);
    }
    for (let i = 0; i + 1 < sorted.length; i++) {
      const a = sorted[i]!;
      const b = sorted[i + 1]!;
      expect(
        a.offset + a.length,
        `solape: ${a.name} [${a.offset.toString(16)}..${(a.offset + a.length).toString(16)}) ` +
          `con ${b.name} @${b.offset.toString(16)}`,
      ).toBeLessThanOrEqual(b.offset);
    }
  });

  it("todo run de ≥4 bytes imprimibles cae dentro de algún chunk nombrado", () => {
    // marca de cobertura por byte a partir del catálogo
    const covered = new Uint8Array(bytes.length);
    for (const c of DATAOVL_CHUNKS)
      covered.fill(1, c.offset, c.offset + c.length);

    const runs = printableRuns(bytes, 4);
    const uncatalogued: string[] = [];
    for (const [a, b] of runs) {
      let inside = true;
      for (let i = a; i < b; i++)
        if (covered[i] === 0) {
          inside = false;
          break;
        }
      if (!inside) {
        const txt = Buffer.from(bytes.subarray(a, Math.min(b, a + 32)))
          .toString("latin1")
          .replace(/\n/g, "|");
        uncatalogued.push(`0x${a.toString(16)}..0x${b.toString(16)} ${JSON.stringify(txt)}`);
      }
    }
    expect(
      uncatalogued,
      `runs imprimibles en territorio SIN catalogar:\n${uncatalogued.join("\n")}`,
    ).toEqual([]);
  });

  it("hay más de 2000 runs imprimibles (reconoce el pool de strings)", () => {
    expect(printableRuns(bytes, 4).length).toBeGreaterThan(2000);
  });
});
