/**
 * Ticket #28 — GUARDA de la normalización de los sidecars sellados.
 *
 * El diario y el minimapa QoL están retirados del juego (`markExplored` y los
 * `journal.push` ya no existen; `core/state.ts`: «nada lo escribe ya y queda vacío»),
 * pero `saveNative` seguía haciendo ROUND-TRIP de ambos: los leía del sidecar al cargar
 * y los volvía a escribir al guardar, perpetuando dato que NADIE consume — `state.explored`
 * no lo lee una sola línea de `src/` fuera de ese round-trip.
 *
 * Eso producía RUIDO DE RE-SELLADO. Testigo (2026-07-27): correr ch17 AISLADO reescribía
 * `ch17.sidecar.json` en UN bit del bitmap `"0:255"` — el sello commiteado lo tenía puesto
 * (de cuando `markExplored` vivía) y el run nuevo lo dejaba a cero. Determinista y
 * perfectamente capaz de disfrazarse de regresión.
 *
 * `tools/normalize-sidecars.py` purgó `qol.journal` → `[]` y BORRÓ `qol.explored`. Este
 * test aserta lo que el ticket pide probar y no suponer: que un checkpoint así CARGA.
 * Va sobre los sidecars SELLADOS DE VERDAD (los 67 del repo), no sobre un fixture
 * inventado — un fixture no habría detectado el bit de ch17, que es de donde nace todo.
 */
import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { importNativeSave, type SaveSidecar } from "../src/core/saveNative.js";

const DIRS = ["e2e/grandtour/saves", "e2e/espejo-tour/saves"];

async function sidecars(): Promise<{ name: string; dir: string }[]> {
  const out: { name: string; dir: string }[] = [];
  for (const dir of DIRS) {
    let entries: string[] = [];
    try {
      entries = await readdir(dir);
    } catch {
      continue; // dir ausente en algún worktree: no es fallo del test
    }
    for (const name of entries.filter((n) => n.endsWith(".sidecar.json"))) out.push({ name, dir });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

describe("sidecars sellados — qol normalizado (#28)", () => {
  it("NINGUNO arrastra ya diario ni minimapa legados", async () => {
    const files = await sidecars();
    expect(files.length, "hay sidecars sellados que auditar").toBeGreaterThan(0);
    const sucios: string[] = [];
    for (const { name, dir } of files) {
      const s = JSON.parse(readFileSync(join(dir, name), "utf8")) as SaveSidecar;
      const j = s.qol?.journal?.length ?? 0;
      const e = Object.keys((s.qol as { explored?: object })?.explored ?? {}).length;
      if (j > 0 || e > 0) sucios.push(`${name} (journal=${j}, explored=${e})`);
    }
    expect(sucios, `sidecars con qol legado — re-corre tools/normalize-sidecars.py`).toEqual([]);
  });

  it("un checkpoint normalizado CARGA: importNativeSave no revienta y deja el estado usable", async () => {
    const files = await sidecars();
    let probados = 0;
    for (const { name, dir } of files) {
      const sidecar = JSON.parse(readFileSync(join(dir, name), "utf8")) as SaveSidecar;
      const gam = new Uint8Array(readFileSync(join(dir, name.replace(".sidecar.json", ".gam"))));
      // La carga REAL, la misma que usa el botón de importar del juego.
      const state = importNativeSave(gam, sidecar);
      // No basta con «no lanzó»: el estado tiene que venir poblado.
      expect(state, `${name}: importNativeSave devuelve estado`).toBeTruthy();
      expect(state.characters.length, `${name}: roster poblado`).toBeGreaterThan(0);
      // Y lo que el ticket normaliza, en su forma estable:
      expect(state.journal, `${name}: journal vacío tras la purga`).toEqual([]);
      expect(state.explored, `${name}: explored ausente (no undefined→{} ni resucitado)`).toBeUndefined();
      probados++;
    }
    expect(probados, "se probó al menos un checkpoint real").toBeGreaterThan(0);
  });
});
