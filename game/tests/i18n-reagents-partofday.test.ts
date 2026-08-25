/**
 * ★ #213 — GUARDA de la supuesta «fuga de inglés» de los reactivos y las partes del día.
 *
 * La tarjeta #213 afirmaba que las 12 cadenas de las 3 propiedades-sink (los 8 nombres de
 * reactivo de `REAGENT_NAMES`, las 3 de `partOfDayWord` y «Arms») están ausentes de es.json
 * y que por eso `t()` devuelve la clave tal cual y el juego las emite EN INGLÉS con el
 * idioma en español.
 *
 * MEDIDO: la premisa es FALSA. Las 12 son claves de `es.json` con traducción `reviewed`, y
 * lo son desde 80661dc9 (17-07) y 677c02de (19-07), diez días ANTES de que naciera la
 * tarjeta (5dd5abf8, 29-07). Lo que #209 midió de verdad es la ausencia en el MANIFIESTO
 * —su punto ciego de sink, que es otro registro y otro problema—, no en el corpus.
 *
 * Este test convierte esa medición en guarda: si alguien retira una de las 12 del corpus,
 * la fuga de inglés que la tarjeta describía se haría real y aquí saltaría.
 */
import { afterAll, describe, expect, it } from "vitest";
import { getLang, setLang, t, tf } from "../src/i18n/index";
import es from "../src/i18n/es.json";
import { huella } from "../src/i18n/huella.js";

const REAGENTES = [
  "Sulfur Ash", "Ginseng", "Garlic", "Spider Silk",
  "Blood Moss", "Black Pearl", "Nightshade", "Mandrake",
] as const;

const PARTES_DEL_DIA = ["morning", "afternoon", "evening"] as const;

const previo = getLang();
afterAll(() => setLang(previo, { persist: false }));

describe("#213 — las 12 cadenas NO se fugan en inglés", () => {
  // ⚠ EL CRITERIO NO PUEDE SER «t() devuelve algo distinto de la clave». Lo probé así y mi
  // propio test lo tumbó: `t("Ginseng")` ES «Ginseng», porque la traducción legítima
  // coincide con el original. La identidad de t() NO discrimina presencia en el corpus —
  // hay que preguntárselo al corpus.
  const tabla = (es as { strings: Record<string, { t: string }> }).strings;
  /**
   * Entrada de la tabla POR SU INGLÉS. Desde #380 `es.json` está indexada por la
   * HUELLA del inglés, no por el inglés: preguntar `tabla["Ginseng"]` daría
   * `undefined` y este test leería «fuga de inglés» donde no la hay.
   */
  const corpus = (en: string) => tabla[huella(en)];

  it("los 8 reactivos están en el corpus es", () => {
    for (const nombre of REAGENTES) {
      expect(corpus(nombre), `«${nombre}» sin entrada en es.json ⇒ fuga de inglés`).toBeDefined();
    }
    // Anclas de valor: si el corpus cambiara de traducción se ve aquí, no en silencio.
    setLang("es", { persist: false });
    expect(t("Nightshade")).toBe("Belladona");
    expect(t("Sulfur Ash")).toBe("Ceniza de Azufre");
  });

  it("las 3 partes del día están en el corpus es", () => {
    for (const parte of PARTES_DEL_DIA) {
      expect(corpus(parte), `«${parte}» sin entrada en es.json ⇒ fuga de inglés`).toBeDefined();
    }
    setLang("es", { persist: false });
    expect(t("morning")).toBe("mañana");
    expect(t("evening")).toBe("velada");
  });

  it("«Arms» (título del panel del herrero) traduce en español", () => {
    expect(corpus("Arms")).toBeDefined();
    setLang("es", { persist: false });
    expect(t("Arms")).toBe("Armas");
  });

  /**
   * ★ #160 — la FAMILIA de cantidades del (S)earch, completa. Aquí sí había fuga: las seis
   * hermanas (llave/gema/antorcha × singular/plural) estaban en el corpus y el par de la
   * «odd key» —la rama del bit 0x80 de #133, `commands.ts:546`, DS 0x8CAA— NO. Un hueco de
   * UN miembro dentro de una familia presente es justo lo que ningún recuento global ve.
   */
  const FAMILIA_CANTIDADES = [
    "{} key!", "{} keys!",
    "{} odd key!", "{} odd keys!",
    "{} gem!", "{} gems!",
    "{} torch!", "{} torches!",
  ] as const;

  it("#160 — la familia de cantidades del (S)earch no tiene huecos", () => {
    const ausentes = FAMILIA_CANTIDADES.filter((k) => !corpus(k));
    expect(ausentes, `miembros sin entrada en es.json: ${ausentes.join(" · ")}`).toEqual([]);
  });

  /**
   * ★ TERCERA instancia del mismo defecto, hallada barriendo los literales que llegan a
   * `t()`/`tf()`: de los cuatro verbos de transporte sólo «Head {}» estaba en el corpus.
   * Como `tf()` SÍ traduce sus argumentos (`index.ts:209`), montar a caballo imprimía
   * «Ride Norte» —mitad inglés, mitad español— mientras la fragata decía «Rumbo Norte».
   * Emisores: `game.ts:1804` (Head) y `game.ts:1822-1824` (Ride/Fly/Row).
   */
  const VERBOS_TRANSPORTE = ["Head {}", "Ride {}", "Fly {}", "Row {}"] as const;

  it("los 4 verbos de transporte están en el corpus es", () => {
    const ausentes = VERBOS_TRANSPORTE.filter((k) => !corpus(k));
    expect(ausentes, `verbos sin entrada en es.json: ${ausentes.join(" · ")}`).toEqual([]);
    setLang("es", { persist: false });
    // La frase COMPUESTA es lo que ve el jugador: plantilla + rumbo, las dos traducidas.
    expect(tf("Ride {}", "North")).toBe("Cabalga Norte");
    expect(tf("Head {}", "North")).toBe("Rumbo Norte");
  });

  it("CONTROL NEGATIVO: en inglés t() es la identidad para las mismas 12", () => {
    // Sin este control, las anclas de arriba pasarían con un t() que ignorase el idioma.
    setLang("en", { persist: false });
    for (const clave of [...REAGENTES, ...PARTES_DEL_DIA, "Arms"]) {
      expect(t(clave)).toBe(clave);
    }
  });
});
