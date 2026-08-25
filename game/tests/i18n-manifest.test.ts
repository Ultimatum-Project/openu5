/**
 * i18n F1 — GUARDA ANTI-FABRICACIÓN + contrato del motor de idioma.
 *
 * Espejo del régimen de `string-manifest.test.ts` para la CAPA DE IDIOMA
 * (analisis.md §2.4). Dos familias de aserción:
 *
 *  (A) ANTI-FABRICACIÓN. Cada KEY de un `<lang>.json` DEBE casar con un string
 *      INGLÉS real del corpus canónico (`tools/i18n-corpus.mjs`, mismos orígenes
 *      que `docs/i18n/count.mjs` + approved-strings + barrido del core). Una key
 *      huérfana = traducción de algo que NO existe en el original → ROJO. Además,
 *      cada value lleva procedencia (`t`/`by`/`reviewed`).
 *
 *  (B) MOTOR. `t()` es IDENTIDAD ESTRICTA en 'en' (byte a byte, ni rewrap), hace
 *      lookup+fallback en 'es', re-wrappea el valor traducido, y el selector
 *      (getLang/setLang/onLangChange) cambia en caliente sin tocar el save.
 */
import { describe, it, expect, afterEach } from "vitest";
import { buildCorpus } from "../tools/i18n-corpus.mjs";
import {
  t,
  rewrap,
  hasWrapNewline,
  getLang,
  setLang,
  onLangChange,
  resolveLang,
  AVAILABLE_LANGS,
  BASE_LANG,
} from "../src/i18n/index.js";
import esTable from "../src/i18n/es.json";
import { huella } from "../src/i18n/huella.js";

const { corpus } = buildCorpus();
const esStrings = esTable.strings as Record<string, { t: string; by: string; reviewed: boolean }>;

/**
 * ÍNDICE INVERSO huella → inglés, derivado del corpus (#380). Desde que las claves
 * de `es.json` son huellas, un test que necesite el INGLÉS de una entrada no puede
 * leerlo de la tabla: lo reconstruye desde el corpus, que es justamente lo que hace
 * el juego en runtime y la herramienta `i18n-huella.mjs decode`. Que el índice sea
 * total sobre la tabla lo comprueba la guarda (A) de aquí abajo.
 */
const inglesDe = new Map<string, string>();
for (const s of corpus) inglesDe.set(huella(s), s);

/** Las entradas de la tabla con su inglés recuperado. Población de las guardas (B) y (C). */
const entradas = Object.entries(esStrings).map(([h, v]) => ({ h, v, en: inglesDe.get(h) }));

// El estado de idioma es de módulo: cada test lo restaura a 'en' (default).
afterEach(() => setLang(BASE_LANG, { persist: false }));

describe("i18n (A) — anti-fabricación: toda key traducida existe en el canon inglés", () => {
  it("cada key de es.json casa con un string real del corpus", () => {
    // La key es la HUELLA del inglés (#380), así que el careo es entre huellas: una
    // key sin inglés en el corpus sigue siendo una traducción de algo que no existe
    // en el original. El predicado no se ha debilitado —`huella` es inyectiva sobre
    // el dominio medido—, sólo se compara bajo otro nombre.
    const orphans = Object.keys(esStrings).filter((k) => !inglesDe.has(k));
    if (orphans.length > 0) {
      throw new Error(
        `\n${orphans.length} KEY(S) de es.json SIN respaldo en el corpus inglés ` +
          `(no existen en el original → fabricación):\n` +
          orphans.map((o) => "  " + JSON.stringify(o)).join("\n") +
          `\n\nUna traducción sólo puede tener por key la HUELLA de un string INGLÉS que ` +
          `exista en el canon (approved-strings + assets extraídos). Para ver de qué frase ` +
          `se trata: \`node tools/i18n-huella.mjs decode\`. Ver tools/i18n-corpus.mjs.\n`,
      );
    }
    expect(orphans).toEqual([]);
  });

  it("cada value lleva procedencia (t no vacío, by, reviewed:boolean)", () => {
    const bad = Object.entries(esStrings)
      .filter(([, v]) => typeof v.t !== "string" || v.t.length === 0 || typeof v.by !== "string" || typeof v.reviewed !== "boolean")
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it("#380 · una clave INGLESA EN CLARO sale huérfana — incluida la que parece huella", () => {
    // MUTANTE, no observación: el árbol limpio no ejercita este rojo, así que se planta.
    // Es la mitad del reparto con `i18n-huella.test.ts` que la FORMA no puede cubrir
    // (ver su cabecera): `Spirituality` tiene 12 letras y pasa por huella, y el primer
    // plegado del carril la dejó en claro por eso — perdiendo su traducción en silencio.
    // Aquí se comprueba que el predicado de PROCEDENCIA sí la ve.
    const predicado = (ks: string[]) => ks.filter((k) => !inglesDe.has(k));
    expect(predicado(["Spirituality"]), "clave inglesa de 12 letras").toHaveLength(1);
    expect(predicado(["Incapacitated!"]), "clave inglesa con puntuación").toHaveLength(1);
    // CONTROL POSITIVO: el predicado no señala a todo el mundo — la huella legítima pasa.
    expect(predicado([huella("Incapacitated!")]), "la huella de una cadena del corpus")
      .toEqual([]);
  });

  it("#380 · las huellas no colisionan sobre el corpus entero", () => {
    // La colisión importa sobre el CORPUS, no sólo sobre las claves traducidas: si una
    // cadena sin traducir compartiera huella con una traducida, `t()` devolvería la
    // traducción ajena — contenido equivocado, sin error. Medido en el carril: cero
    // colisiones desde N=5 sobre 5.944 cadenas; N=12 deja 42 bits de margen.
    expect(inglesDe.size).toBe(corpus.size);
  });

  it("el corpus es sustancial (no se degradó el barrido de assets/core)", () => {
    // Sanity: si el corpus colapsa (p.ej. assets no montados), la guarda A daría
    // falsos rojos; este umbral lo delata explícitamente.
    expect(corpus.size).toBeGreaterThan(4000);
  });
});

describe("i18n (B) — motor: identidad en 'en', traducción en 'es'", () => {
  it("'en' es IDENTIDAD ESTRICTA para toda key semilla (byte a byte)", () => {
    setLang("en", { persist: false });
    // 🔴 Se itera sobre el INGLÉS recuperado, no sobre `Object.keys`. Con claves-huella,
    // `t(clave)` sería `t("hLxNGWpsy2Ec")` — identidad trivial sobre una cadena que el
    // juego nunca le pasa a `t()`: el aserto pasaría sin ejercitar NADA. La población
    // que importa sigue siendo el texto inglés del juego.
    for (const { en } of entradas) expect(t(en!)).toBe(en);
  });

  it("'en' no altera un string arbitrario que NO está en la tabla", () => {
    setLang("en", { persist: false });
    for (const s of ["Welcome to Britannia!", "foo\nbar", "", "North", "Ready...\n\n"]) {
      expect(t(s)).toBe(s);
    }
  });

  it("'es' devuelve la traducción re-wrapeada de cada key semilla", () => {
    setLang("es", { persist: false });
    // Igual que arriba: la entrada de `t()` es el INGLÉS, no la huella (ver #380).
    for (const { en, v } of entradas) expect(t(en!)).toBe(rewrap(v.t));
  });

  it("'es' cae al inglés (identidad) para un string sin traducción", () => {
    setLang("es", { persist: false });
    // Strings que NO están en es.json (fallback a inglés): un literal arbitrario y un
    // nombre propio conservado (mazmorra) — ambos degradan a inglés string a string.
    expect(t("this string is not in the table")).toBe("this string is not in the table");
    expect(t("Deceit")).toBe("Deceit"); // nombre de mazmorra conservado (nunca en es.json)
  });
});

describe("i18n (B) — rewrap: colapsa wrap, preserva párrafo y terminadores", () => {
  it("colapsa un \\n interior suelto a espacio", () => {
    expect(rewrap("Thou seest a\nlong sign here")).toBe("Thou seest a long sign here");
  });
  it("preserva \\n\\n (párrafo)", () => {
    expect(rewrap("Line one.\n\nLine two.")).toBe("Line one.\n\nLine two.");
  });
  it("preserva el \\n FINAL (terminador) y el inicial", () => {
    expect(rewrap("Ship sunk!\n")).toBe("Ship sunk!\n");
    expect(rewrap("\nNo effect!\n")).toBe("\nNo effect!\n");
  });
  it("combina: wrap interior colapsa, párrafo y final se conservan", () => {
    expect(rewrap("a\nb\n\nc\nd\n")).toBe("a b\n\nc d\n");
  });
});

describe("i18n (C) — convención wrap/párrafo: ningún valor traducido porta wrap inglés", () => {
  it("hasWrapNewline detecta SÓLO el \\n interior suelto (no final ni \\n\\n)", () => {
    expect(hasWrapNewline("a\nb")).toBe(true); // wrap interior
    expect(hasWrapNewline("Ship sunk!\n")).toBe(false); // terminador final
    expect(hasWrapNewline("uno\n\ndos")).toBe(false); // párrafo
    expect(hasWrapNewline("plano")).toBe(false);
  });

  it("ningún valor de es.json contiene wrap-\\n (sólo \\n final / \\n\\n párrafo)", () => {
    const bad = Object.entries(esStrings)
      .filter(([, v]) => hasWrapNewline(v.t))
      .map(([k]) => k);
    expect(bad, `valores con wrap-\\n inglés portado (usa \\n\\n para párrafo):\n${bad.join("\n")}`).toEqual([]);
  });
});

describe("i18n (B) — selección: persistencia lógica, cambio en caliente, save intacto", () => {
  it("getLang default = 'en' (el suelo del calco)", () => {
    setLang("en", { persist: false });
    expect(getLang()).toBe("en");
  });

  it("setLang cambia el idioma vivo y notifica a los suscriptores", () => {
    setLang("en", { persist: false });
    const seen: string[] = [];
    const off = onLangChange((l) => seen.push(l));
    setLang("es", { persist: false });
    expect(getLang()).toBe("es");
    expect(seen).toEqual(["es"]);
    off();
    setLang("en", { persist: false });
    expect(seen).toEqual(["es"]); // desuscrito: no llega el segundo evento
  });

  it("setLang es no-op si el idioma no cambia (no notifica)", () => {
    setLang("es", { persist: false });
    let calls = 0;
    const off = onLangChange(() => calls++);
    setLang("es", { persist: false });
    expect(calls).toBe(0);
    off();
  });

  it("resolveLang normaliza códigos crudos y cae al inglés ante lo desconocido", () => {
    expect(resolveLang("es")).toBe("es");
    expect(resolveLang("ES")).toBe("es");
    expect(resolveLang("es-ES")).toBe("es");
    expect(resolveLang("de")).toBe("en"); // no soportado → suelo
    expect(resolveLang(null)).toBe("en");
    expect(resolveLang("")).toBe("en");
  });

  it("AVAILABLE_LANGS oferta inglés primero + español marcado semilla", () => {
    expect(AVAILABLE_LANGS[0]).toEqual({ code: "en", name: "English", seed: false });
    const es = AVAILABLE_LANGS.find((l) => l.code === "es");
    expect(es?.seed).toBe(true);
  });
});
