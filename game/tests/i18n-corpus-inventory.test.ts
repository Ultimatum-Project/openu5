/**
 * AUDITORÍA G8 — INVENTARIO DE MUNDO-CERRADO de assets para el corpus i18n.
 *
 * EL AGUJERO: `i18n-corpus.mjs` enumeraba una lista hardcodeada de ficheros y
 * NADA aseveraba que todo `assets/**.json` estuviera cubierto o excluido — un
 * asset nuevo con texto user-facing nacía INVISIBLE para la guarda
 * anti-fabricación y el manifiesto de procedencia (así quedó fuera endgame.json
 * hasta el carril diff-ocr-masivo; demo-scene.json —con los títulos del
 * attract, «The Summoning»…— seguía fuera hasta este lote).
 *
 * EL CIERRE: `COVERED_ASSET_FILES` + `EXCLUDED_ASSET_FILES` (con razón) en
 * i18n-corpus.mjs y `assetInventoryGaps()` que compara contra el DISCO. Este
 * test exige gaps = 0 y verifica la coherencia de las listas.
 *
 * DEMOSTRACIÓN (caso que ANTES pasaba y AHORA falla): un asset nuevo sin
 * clasificar — simulado con un árbol sintético (assets reales + un
 * `nuevo-texto.json` extra) — dispara `unclassified` ≠ []. Con el código
 * previo no existía guarda alguna: el fichero entraba en silencio.
 */
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readdirSync, copyFileSync, statSync, renameSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  assetInventoryGaps,
  buildCorpusBySurface,
  COVERED_ASSET_FILES,
  EXCLUDED_ASSET_FILES,
} from "../tools/i18n-corpus.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, "..", "assets");

describe("G8 — inventario de mundo-cerrado de assets (corpus i18n)", () => {
  it("todo .json de assets/ está CUBIERTO o EXCLUIDO-con-razón; sin entradas stale", () => {
    const gaps = assetInventoryGaps() as { unclassified: string[]; stale: string[] };
    expect(
      gaps.unclassified,
      "asset(s) .json sin clasificar — añádelo(s) a COVERED_ASSET_FILES (superficie del corpus) " +
        "o a EXCLUDED_ASSET_FILES con razón (tools/i18n-corpus.mjs)",
    ).toEqual([]);
    expect(gaps.stale, "entradas del inventario que ya no existen en disco").toEqual([]);
  });

  it("cubiertos y excluidos son disjuntos y cada exclusión trae razón no vacía", () => {
    const covered = new Set(COVERED_ASSET_FILES as string[]);
    for (const [file, reason] of Object.entries(EXCLUDED_ASSET_FILES as Record<string, string>)) {
      expect(covered.has(file), `${file} está en AMBAS listas`).toBe(false);
      expect(typeof reason === "string" && reason.length > 10, `${file}: razón vacía/insuficiente`).toBe(true);
    }
  });

  it("cada fichero CUBIERTO aporta de verdad una superficie al corpus", () => {
    const surfaceFiles = new Set(
      (buildCorpusBySurface() as { id: string }[]).map((s) => s.id.split("#")[0]!),
    );
    for (const f of COVERED_ASSET_FILES as string[]) {
      expect(surfaceFiles.has(f), `${f} está declarado cubierto pero ninguna superficie lo lee`).toBe(true);
    }
  });

  it("los títulos del attract-demo (demo-scene.json) ya están en el corpus", () => {
    const titles = (buildCorpusBySurface() as { id: string; strings: string[] }[]).find(
      (s) => s.id === "demo-scene.json#titles",
    );
    expect(titles?.strings).toContain("The Summoning");
  });

  it("DEMO sintética: un asset nuevo sin clasificar pone rojo el inventario", () => {
    // Copia superficial del árbol de assets (sólo la estructura .json) + un intruso.
    const tmp = mkdtempSync(join(tmpdir(), "u5-assets-synth-"));
    try {
      const copyJsons = (dir: string, rel: string): void => {
        for (const ent of readdirSync(join(dir, rel || "."))) {
          const src = join(dir, rel, ent);
          const dstRel = rel ? `${rel}/${ent}` : ent;
          if (statSync(src).isDirectory()) {
            mkdirSync(join(tmp, dstRel), { recursive: true });
            copyJsons(dir, dstRel);
          } else if (ent.endsWith(".json")) {
            copyFileSync(src, join(tmp, dstRel));
          }
        }
      };
      copyJsons(ASSETS, "");
      const clean = assetInventoryGaps({ assetsDir: tmp }) as { unclassified: string[] };
      expect(clean.unclassified).toEqual([]); // la copia fiel pasa
      writeFileSync(join(tmp, "nuevo-texto.json"), JSON.stringify({ line: "Fabricated prose!" }));
      const dirty = assetInventoryGaps({ assetsDir: tmp }) as { unclassified: string[] };
      expect(dirty.unclassified).toEqual(["nuevo-texto.json"]); // ← antes: entraba en silencio
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("#235: un subdirectorio SYMLINKEADO no produce stale en falso (worktrees enlazan por entradas)", () => {
    // El rojo-en-falso de worktree: game/assets symlinkeado POR ENTRADAS hacía que el
    // walker (Dirent.isDirectory() NO sigue symlinks) saltara los subdirectorios
    // enlazados y sus .json clasificados salieran como «stale» — 9 en el caso real.
    // Este test reproduce la topología: árbol sintético con UN subdir sustituido por
    // un symlink a su copia externa. El inventario debe dar exactamente lo mismo.
    const tmp = mkdtempSync(join(tmpdir(), "u5-assets-symlink-"));
    const aside = mkdtempSync(join(tmpdir(), "u5-assets-aside-"));
    try {
      const copyJsons = (dir: string, rel: string): void => {
        for (const ent of readdirSync(join(dir, rel || "."))) {
          const src = join(dir, rel, ent);
          const dstRel = rel ? `${rel}/${ent}` : ent;
          if (statSync(src).isDirectory()) {
            mkdirSync(join(tmp, dstRel), { recursive: true });
            copyJsons(dir, dstRel);
          } else if (ent.endsWith(".json")) {
            copyFileSync(src, join(tmp, dstRel));
          }
        }
      };
      copyJsons(ASSETS, "");
      const sub = readdirSync(tmp, { withFileTypes: true }).find((e) => e.isDirectory());
      expect(sub, "el árbol sintético necesita al menos un subdirectorio").toBeDefined();
      renameSync(join(tmp, sub!.name), join(aside, sub!.name));
      symlinkSync(join(aside, sub!.name), join(tmp, sub!.name));
      const gaps = assetInventoryGaps({ assetsDir: tmp }) as { unclassified: string[]; stale: string[] };
      expect(gaps.stale, "los .json del subdir enlazado salían stale EN FALSO").toEqual([]);
      expect(gaps.unclassified).toEqual([]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
      rmSync(aside, { recursive: true, force: true });
    }
  });
});
