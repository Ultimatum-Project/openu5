/**
 * Cabo de «toponimia» del encargo blackthorn-nombre (24-08): el usuario reportó
 * «North Winds» en INGLÉS bajo lang=es mientras otras bandas salían traducidas
 * («Viento Oeste», «Calma»).
 *
 * La banda tiene UN solo compositor de texto (skin/fiel/skin.ts:1595:
 * `t(`${snap.wind.padEnd(5)} Winds`)` — el shader REALZA los glifos de la fiel y
 * el portrait la BLITEA, censados el 24-08: cero compositores más), así que la
 * clase entera de rótulos componibles es `WIND_NAMES × padEnd(5) + " Winds"`.
 * Este testigo la recorre COMPLETA bajo `es`: si cualquiera de las cinco
 * (North/South con un espacio, Calm/East/West con DOS) faltase de es.json, el
 * compuesto saldría en inglés y esto enrojece nombrándolo. Esperados EN CRUDO
 * de la decisión i18n del lead (forma natural reordenada, commit 9d7d335e).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setLang, t } from "../src/i18n/index.js";
import { WIND_NAMES, WIND_BAND_LABELS } from "../src/core/world/wind.js";

describe("banda de vientos bajo lang=es — la clase entera, por el compositor real", () => {
  beforeAll(() => setLang("es", { persist: false }));
  afterAll(() => setLang("en", { persist: false }));

  // La MISMA fórmula que el único renderer (skin.ts:1595), sobre TODO el dominio.
  const composed = () => WIND_NAMES.map((n) => `${n.padEnd(5)} Winds`);

  it("la fórmula del renderer produce EXACTAMENTE las 5 etiquetas ancladas", () => {
    // Control de deriva: si WIND_NAMES o el padding cambiasen, el compuesto ya no
    // sería la clave de es.json y la banda caería a inglés SIN tocar es.json.
    expect(composed()).toEqual([...WIND_BAND_LABELS]);
  });

  it("las 5 salen TRADUCIDAS (North incluida — la del reporte)", () => {
    const got = composed().map((label) => t(label));
    expect(got).toEqual(["Calma", "Viento Norte", "Viento Sur", "Viento Este", "Viento Oeste"]);
  });
});
