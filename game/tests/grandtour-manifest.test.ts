/**
 * F3-T1 — GUARDA CI ANTI-DERIVA del manifiesto de cobertura del Grand Tour.
 *
 * QUÉ. Regenera el manifiesto en memoria (`buildManifest()` sobre los assets
 * extraídos) y exige que sea IDÉNTICO al `manifest.json` commiteado. Un cambio de
 * asset —o de la lógica del generador— que mueva la cobertura sin regenerar el
 * fichero → ROJO. Además asserta el conteo por categoría contra la spec §1.1.
 *
 * POR QUÉ. `manifest.json` va commiteado porque el capítulo 19 del tour lo importa
 * como ORÁCULO de cierre (`covered === manifest`). Commiteado + derivado exige un
 * candado: esta guarda es el equivalente para el manifiesto de lo que
 * `string-manifest.test.ts` es para los strings aprobados.
 *
 * CÓMO ACTUALIZAR. `node game/e2e/grandtour/manifest.gen.mjs` regenera; revisa el
 * diff (¿la cobertura cambió a propósito?) y commitea manifest.json con el cambio.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildManifest, EXPECTED_COUNTS } from "../e2e/grandtour/manifest.gen.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = join(HERE, "..", "e2e", "grandtour", "manifest.json");

interface ManifestItem {
  id: string;
  category: string;
  name: string;
  source: string;
  reachableBy: string | null;
}

const committed = JSON.parse(readFileSync(MANIFEST, "utf8")) as ManifestItem[];
const live = buildManifest() as ManifestItem[];

describe("F3-T1 guarda anti-deriva — manifiesto de cobertura del Grand Tour", () => {
  it("el manifest.json commiteado es idéntico al regenerado de los assets", () => {
    // Falla con un diff legible: regenera con `node .../manifest.gen.mjs`.
    expect(live).toEqual(committed);
  });

  it("cada ítem tiene id/category/name/source y reachableBy declarado", () => {
    for (const it of committed) {
      expect(it.id, "id no vacío").toBeTruthy();
      expect(it.category, `category en ${it.id}`).toBeTruthy();
      expect(it.name, `name no vacío en ${it.id}`).toBeTruthy();
      expect(it.source, `source en ${it.id}`).toBeTruthy();
      expect(it, `reachableBy en ${it.id}`).toHaveProperty("reachableBy");
    }
  });

  it("los ids son únicos y estables", () => {
    const ids = committed.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("el conteo por categoría coincide con la spec §1.1", () => {
    const byCat: Record<string, number> = {};
    for (const it of committed) byCat[it.category] = (byCat[it.category] ?? 0) + 1;
    expect(byCat).toEqual(EXPECTED_COUNTS);
  });
});
