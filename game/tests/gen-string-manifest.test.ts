/**
 * AUDITORÍA G9 — el regenerador del manifiesto ya no barre entradas en silencio.
 *
 * DOS AGUJEROS del gen-string-manifest previo:
 *   1. El filtro `isTechnical` se aplicaba a TODO el live (también a keys YA
 *      presentes en el manifiesto): las 4 keys técnicas de comilla (citadas
 *      DS 0x7854) se retiraban en una regeneración... y NI aparecían en el
 *      conteo de huérfanas (live.has(k)===true), doble silencio.
 *   2. Las huérfanas retiradas sólo se contaban, no se listaban: el operador no
 *      podía auditar qué barrió el regenerador.
 *
 * DEMOSTRACIÓN (caso que ANTES pasaba y AHORA falla): con la lógica previa
 * (filtrar isTechnical sin mirar prev), el test «preserva las keys técnicas ya
 * citadas» FALLA — la key `"` de prev desaparece de next sin figurar en removed.
 */
import { describe, it, expect } from "vitest";
import { reconcileManifest } from "../tools/gen-string-manifest.mjs";
import { isTechnical } from "../tools/extract-user-strings.mjs";

const TECH_KEY = '"'; // comilla de apertura de tienda (DS 0x7854) — sin letras: isTechnical
const CITE = "[D] DS 0x7854 — comilla de apertura (SHOPPES)";

describe("G9 — reconcileManifest (regenerador del manifiesto)", () => {
  it("sanity: la key de comilla ES técnica para el filtro", () => {
    expect(isTechnical(TECH_KEY)).toBe(true);
  });

  it("preserva las keys técnicas YA citadas en prev (antes se barrían en doble silencio)", () => {
    const prev = { [TECH_KEY]: CITE, "Hello!": "[D] DS 0x0000" };
    const live = new Set([TECH_KEY, "Hello!"]);
    const { next, added, removed } = reconcileManifest(prev, live);
    expect(next[TECH_KEY]).toBe(CITE); // ← con la lógica previa: undefined
    expect(next["Hello!"]).toBe("[D] DS 0x0000");
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });

  it("las keys técnicas NUEVAS (no citadas) siguen filtradas", () => {
    const { next, added } = reconcileManifest({}, new Set([TECH_KEY, "Hi!"]));
    expect(next[TECH_KEY]).toBeUndefined();
    expect(added).toEqual(["Hi!"]);
  });

  it("las huérfanas se retiran Y se devuelven listadas (auditable)", () => {
    // Ruling t#57: se marcan INLINE porque la detección del censo es POR LÍNEA — un
    // marcador en la línea de encima no lo ve (mismo hueco que las cabeceras de tabla).
    const prev = { "Gone!": "[D] DS 0x1111", "Stays!": "[D] DS 0x2222" }; // valores de PEGA, no offsets
    const { next, removed } = reconcileManifest(prev, new Set(["Stays!"]));
    expect(next["Gone!"]).toBeUndefined();
    expect(removed).toEqual(["Gone!"]);
  });

  it("lo nuevo entra con cita TODO (que la guarda rechaza hasta clasificar)", () => {
    const { next, added } = reconcileManifest({}, new Set(["Fresh string!"]));
    expect(added).toEqual(["Fresh string!"]);
    expect(next["Fresh string!"]).toMatch(/^\[\?\] TODO/);
  });

  it("acepta el Map del extractor además de Set", () => {
    const live = new Map([["Mapped!", "core/x.ts:1"]]);
    const { next } = reconcileManifest({}, live);
    expect(next["Mapped!"]).toMatch(/^\[\?\] TODO/);
  });
});
