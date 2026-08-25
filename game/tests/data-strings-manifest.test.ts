/**
 * i18n F0a — GUARDA del MANIFIESTO DE PROCEDENCIA del corpus de datos.
 *
 * `tests/fixtures/data-strings-manifest.json` declara, POR SUPERFICIE (fichero/pool
 * fuente), la procedencia (binario + parser + cadena + cita), el cubo (L/M/X), los
 * conteos y un HASH de contenido. Este test lo valida contra los assets REALES:
 *  - cada superficie del corpus está en el manifiesto (sin superficie sin procedencia);
 *  - conteo + hash coinciden (detecta DERIVA del extractor sin depender de binarios EA);
 *  - toda entrada lleva procedencia + cubo reconocido;
 *  - los totales por cubo cuadran.
 *
 * Regenerar tras un cambio LEGÍTIMO del extractor: `node tools/gen-data-strings-manifest.mjs`.
 */
import { describe, it, expect } from "vitest";
import { buildCorpusBySurface, surfaceHash, wordCount } from "../tools/i18n-corpus.mjs";
import manifest from "./fixtures/data-strings-manifest.json";

interface Surface {
  id: string;
  cube: string;
  source: string[];
  parser: string;
  chain: string;
  cite: string;
  strings: number;
  words: number;
  hash: string;
}
const m = manifest as { version: number; totals: Record<string, { surfaces: number; strings: number; words: number }>; surfaces: Surface[] };

// Recomputa las superficies desde los assets (dedup NFC, como el generador).
const live = new Map<string, { cube: string; strings: number; words: number; hash: string }>();
for (const s of buildCorpusBySurface() as { id: string; cube: string; strings: string[] }[]) {
  const uniq = [...new Set(s.strings.map((x) => x.normalize("NFC")))];
  live.set(s.id, { cube: s.cube, strings: uniq.length, words: wordCount(uniq), hash: surfaceHash(s.strings) });
}
const byId = new Map(m.surfaces.map((s) => [s.id, s]));

describe("i18n F0a — manifiesto de procedencia del corpus de datos", () => {
  it("toda superficie del corpus está en el manifiesto (sin origen sin procedencia)", () => {
    const missing = [...live.keys()].filter((id) => !byId.has(id));
    expect(missing, `superficies del corpus sin entrada en el manifiesto:\n${missing.join("\n")}`).toEqual([]);
  });

  it("el manifiesto no tiene superficies fantasma (mirror del corpus)", () => {
    const stale = m.surfaces.map((s) => s.id).filter((id) => !live.has(id));
    expect(stale, `entradas del manifiesto que ya no existen:\n${stale.join("\n")}`).toEqual([]);
  });

  it("conteo + hash de cada superficie coinciden con los assets (sin deriva)", () => {
    const drift: string[] = [];
    for (const s of m.surfaces) {
      const l = live.get(s.id);
      if (!l) continue;
      if (l.strings !== s.strings) drift.push(`${s.id}: strings ${s.strings}≠${l.strings}`);
      if (l.words !== s.words) drift.push(`${s.id}: words ${s.words}≠${l.words}`);
      if (l.hash !== s.hash) drift.push(`${s.id}: HASH deriva (${s.hash} ≠ ${l.hash})`);
      if (l.cube !== s.cube) drift.push(`${s.id}: cube ${s.cube}≠${l.cube}`);
    }
    expect(drift, `DERIVA — regenera con node tools/gen-data-strings-manifest.mjs:\n${drift.join("\n")}`).toEqual([]);
  });

  it("toda entrada lleva procedencia completa y cubo reconocido", () => {
    const bad: string[] = [];
    for (const s of m.surfaces) {
      if (!Array.isArray(s.source) || s.source.length === 0) bad.push(`${s.id}: sin source`);
      if (!s.parser) bad.push(`${s.id}: sin parser`);
      if (!s.chain) bad.push(`${s.id}: sin chain`);
      if (!s.cite) bad.push(`${s.id}: sin cite`);
      if (!["L", "M", "X", "L+M"].includes(s.cube)) bad.push(`${s.id}: cubo inválido ${s.cube}`);
    }
    expect(bad).toEqual([]);
  });

  it("los totales por cubo cuadran con la suma de superficies", () => {
    const totals: Record<string, { surfaces: number; strings: number; words: number }> = {};
    for (const s of m.surfaces) {
      const t = (totals[s.cube] ??= { surfaces: 0, strings: 0, words: 0 });
      t.surfaces++;
      t.strings += s.strings;
      t.words += s.words;
    }
    expect(totals).toEqual(m.totals);
  });
});
