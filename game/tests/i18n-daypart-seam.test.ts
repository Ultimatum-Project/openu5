/**
 * Carril i18n-restos — GUARDA de la costura «este la mañana».
 *
 * Las plantillas de saludo de tienda componen `@` con la palabra de parte-del-día
 * (t('morning'|'afternoon'|'evening')). El bug original: plantillas con «este @» +
 * values con artículo («la mañana») → «este la mañana». CRITERIO CANON del carril:
 * los 3 values son sustantivo FEMENINO pelado (mañana/tarde/velada) y toda plantilla
 * concuerda en femenino («esta @», «buena @», «una buena @»…). Este test compone
 * TODAS las combinaciones plantilla-con-@ × parte-del-día del es.json vivo y rechaza
 * cualquier resto de costura (artículo duplicado o concordancia masculina).
 */
import { describe, expect, it } from "vitest";
import { huella } from "../src/i18n/huella.js";
import esTable from "../src/i18n/es.json" with { type: "json" };

interface Entry {
  t: string;
}
const STRINGS = (esTable as { strings: Record<string, Entry> }).strings;

const DAY_KEYS = ["morning", "afternoon", "evening"] as const;

describe("costura parte-del-día (@) en las plantillas de tienda", () => {
  it("los 3 values de parte-del-día son sustantivo femenino PELADO (sin artículo)", () => {
    for (const k of DAY_KEYS) {
      const v = STRINGS[huella(k)]!.t;
      expect(v, `value de '${k}'`).not.toMatch(/^(el|la|los|las)\s/);
      expect(["mañana", "tarde", "velada"]).toContain(v);
    }
  });

  it("NINGUNA combinación plantilla×parte-del-día deja artículo duplicado ni concordancia masculina", () => {
    const days = DAY_KEYS.map((k) => STRINGS[huella(k)]!.t);
    // 🔴 EL FILTRO VA POR EL VALOR, NO POR LA CLAVE — y el cardinal es lo que
    // conserva el mordisco. Antes de #380 la clave ERA el inglés y se filtraba por
    // `k.includes("@")`; ahora la clave es una huella opaca y ese filtro daría CERO
    // plantillas, es decir, un bucle vacío: verde sin mirar nada. Recuperar el inglés
    // aquí exigiría el corpus (`game/assets`) y este fichero corre en la batería PURA,
    // que no lo tiene.
    // Filtrar por el VALOR parece debilitar la guarda —la entrada a la que un
    // traductor le comiera el @ se saldría de la población en vez de suspender—, pero
    // NO se pierde: la cota de cardinal de la línea siguiente es justo ese detector.
    // Si alguien pierde un @, la población baja de 18 y el test cae ahí. Por eso la
    // cota deja de ser una nota de sanidad y pasa a ser el aserto principal.
    const templates = Object.entries(STRINGS)
      .filter(([, v]) => v.t.includes("@"))
      .map(([k, v]) => ({ key: k, es: v.t }));
    expect(
      templates.length,
      "plantillas con @ en el VALOR; si baja, alguien perdió un @ al traducir (ver comentario)",
    ).toBeGreaterThanOrEqual(18); // censo del carril (saludos + herrero)
    for (const { key, es } of templates) {
      expect(es, `la plantilla ES de la huella «${key}» perdió el @`).toContain("@");
      for (const day of days) {
        const composed = es.replaceAll("@", day);
        // costura de artículo: «este la mañana», «esta la tarde»…
        expect(composed, `«${composed.slice(0, 60)}…»`).not.toMatch(
          /\b(este|esta|buen|buena|un|una)\s+(el|la)\s/i,
        );
        // concordancia: determinante/adjetivo MASCULINO pegado al sustantivo femenino.
        expect(composed, `«${composed.slice(0, 60)}…»`).not.toMatch(
          /\b(este|buen|un|placentero)\s+(mañana|tarde|velada)\b/i,
        );
      }
    }
  });
});
