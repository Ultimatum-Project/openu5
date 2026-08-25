/**
 * #162 · CADENAS QUE EL CÓDIGO COMPONE — la fuga NO es de palabras inglesas, es del
 * GLIFO DE COMILLA.
 *
 * LA FICHA, REFUTADA EN SU PREMISA. `sinks-209-acta.md` §5.1 apuntó tres frases del
 * intérprete de conversación —«You see», `"My name is`, `"I am called`— como «candidatas a
 * fuga de inglés» porque **no están en `es.json`**. Medido: las tres SÍ están, bajo la clave
 * que el código usa DE VERDAD, que es la COMPUESTA. `PHRASES.MY_NAME_IS` vale
 * `'"My name is'` (sin espacio) y `es.json` no lo tiene; pero el código traduce
 * `PHRASES.MY_NAME_IS + " "`, y `'"My name is '` **sí está**, traducida y revisada. Buscar
 * la constante en vez de la clave viva es el mismo error de puntería que
 * `familia-incompleta-invisible-a-cifras`: la ausencia de una NO es la ausencia de la otra.
 *
 * LO QUE SÍ SE FUGA, medido corriendo el intérprete bajo `es`: el port compone comillas
 * ASCII alrededor de texto YA traducido, y el castellano de este port usa `«»`.
 *
 * ```
 * EN  "I am called Zachariah"      ES  «Me llaman Zachariah"     ← abre « y cierra "
 * EN  "My name is Zachariah"       ES  «Me llamo Zachariah"      ← ídem
 * ```
 *
 * ★ La familia que lo arregla YA EXISTE en el corpus, con cuatro miembros y la
 * discriminación hecha POR LA FORMA del fragmento:
 * `'"'` → `'«'` · `'\n\n"'` → `'\n\n«'` (abren) · `'" '` → `'» '` · `'"\n'` → `'»\n'`
 * (cierran). Este carril le añade los tres miembros que le faltaban.
 *
 * ── ENMIENDA #37/#41 (carril `quotes-family`) ────────────────────────────────────
 * El defecto que §B sellaba EN ROJO queda ARREGLADO, y al arreglarlo se destapó que la
 * familia medida era INCOMPLETA: #162 corrió sólo `["name"]`, cuya apertura viaja en el
 * literal, y concluyó «se fuga el CIERRE». Corridas las CUATRO vías habladas, la
 * respuesta de keyword (`"Estudio las estrellas."`) fugaba los DOS glifos — la apertura
 * la compone `flushLine` con un `'"'` igual de crudo.
 *
 * El arreglo NO es `quotePair()`: TALK 0x4da es `putchar(0xa2 & 0x7f)` — UN carácter —
 * llamado desde 15 sitios independientes, y el cierre es CONDICIONAL (0x0bc5 `je`, 0x1172
 * `jne`: si la sección acaba en op de transferencia, no se cierra). Apertura y cierre son
 * dos emisiones separadas ⇒ dos primitivas separadas, `quoteOpen()`/`quoteClose()`.
 */
import { describe, it, expect } from "vitest";
import { huella } from "../src/i18n/huella.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Conversation, type TalkScript, type DialogueOutput } from "../src/core/dialogue/conversation.js";
import { SHOP_UI } from "../src/core/world/cmd-strings.js";
import { setLang, BASE_LANG, t, quoteOpen, quoteClose } from "../src/i18n/index.js";

const es = JSON.parse(
  readFileSync(fileURLToPath(new URL("../src/i18n/es.json", import.meta.url)), "utf8"),
).strings as Record<string, { t: string }>;

function talk(): TalkScript {
  const all = JSON.parse(
    readFileSync(fileURLToPath(new URL("../assets/talk/towne.json", import.meta.url)), "utf8"),
  ) as TalkScript[];
  return all[0]!;
}

function run(lang: "en" | "es", inputs: string[], knows = false): string[] {
  setLang(lang, { persist: false });
  try {
    const out: DialogueOutput[] = [];
    const c = new Conversation(talk(), {
      avatarName: "Avatar",
      npcKnowsAvatar: knows,
      tr: (s) => t(s),
    });
    c.start().forEach((o) => out.push(o));
    for (const i of inputs) c.input(i).forEach((o) => out.push(o));
    return out.filter((x) => x.kind === "line").map((x) => (x as { text: string }).text);
  } finally {
    setLang(BASE_LANG, { persist: false });
  }
}

describe("#162 (A) — la premisa de la ficha: las tres compuestas NO fugan inglés", () => {
  it("la clave viva es la COMPUESTA, y está en el corpus (la constante pelada no)", () => {
    // El discriminador que la ficha usó (buscar la constante) da AUSENTE en las tres…
    for (const k of ['"My name is', '"I am called', "You see"]) {
      expect(es[huella(k)], `constante pelada ${JSON.stringify(k)}`).toBeUndefined();
    }
    // …y el que importa —la clave que el código pasa a t()— da PRESENTE en las tres.
    for (const k of ['"My name is ', '"I am called ', "You see {}"]) {
      expect(es[huella(k)], `clave viva ${JSON.stringify(k)}`).toBeDefined();
    }
  });

  it("★ y el intérprete lo confirma EN VIVO: bajo `es` el cuerpo sale en castellano", () => {
    const lineas = run("es", ["name"]).join("|");
    expect(lineas).toContain("Me llaman"); // '"I am called ' traducida
    expect(lineas).toContain("Me llamo"); //  '"My name is ' traducida
    expect(lineas, "ni rastro del inglés que la ficha temía").not.toContain("I am called");
    expect(lineas, "ni rastro del inglés que la ficha temía").not.toContain("My name is");
  });
});

/** Las CUATRO vías habladas del intérprete, en un solo barrido (ver cabecera §B). */
function todasLasViasHabladas(lang: "en" | "es"): string[] {
  return [
    ...run(lang, ["job", "xyzzy", "name"], true), // saludo + keyword + no-match + NAME
    ...run(lang, ["name"], false), // autopresentación «I am called »
  ];
}

describe("#162 (B) — el glifo de comilla que compone el código: ARREGLADO por par de locale", () => {
  it("★ bajo `es` NINGUNA línea hablada mezcla los dos alfabetos de comilla", () => {
    const lineas = todasLasViasHabladas("es");
    const descabaladas = lineas.filter((l) => /^«[^]*"$/.test(l) || /^"[^]*»$/.test(l));
    expect(descabaladas, `pares descabalados en ${JSON.stringify(lineas)}`).toEqual([]);
  });

  it("★ y las cuatro vías cierran de verdad: abren « y cierran »", () => {
    // Las cuatro difieren en DÓNDE nace la apertura —el literal de DATA.OVL en NAME /
    // autopresentación / no-match, el putchar 0x4da en saludo y keyword— pero TODAS toman
    // el cierre del putchar. Por eso el par NO es una primitiva atómica: son dos glifos
    // independientes. Derivación en re/notes/quotes-family-41-37-acta.md §3.
    const habladas = todasLasViasHabladas("es").filter((l) => l.startsWith("«"));
    expect(habladas.length, "las 6 líneas habladas del barrido").toBe(6);
    for (const l of habladas) expect(l, `cierre de ${JSON.stringify(l)}`).toMatch(/»$/);
  });

  it("CONTROL: en `en` el calco sigue byte-idéntico — comilla ASCII a los dos lados", () => {
    const habladas = todasLasViasHabladas("en").filter((l) => l.startsWith('"'));
    expect(habladas.length, "las 6 líneas habladas del barrido").toBe(6);
    for (const l of habladas) expect(l, `cierre de ${JSON.stringify(l)}`).toMatch(/"$/);
    expect(habladas).toContain('"My name is Zachariah"');
    expect(habladas).toContain('"I cannot help thee with that."');
  });

  it("★★ el MIEMBRO QUE #162 NO VIO: AskName componía la APERTURA en crudo", () => {
    // #162 midió una sola vía (`["name"]`) y concluyó «se fuga el CIERRE». El handler
    // AskName (TALK 0x0e78) es su ESPEJO: el putchar 0x0e85 pone la APERTURA y el
    // literal DS 0x9468 (`What is thy name?"\n`, verificado en DATA.OVL fileoff 0x9478)
    // trae el CIERRE. Como esa key SÍ está traducida (`¿Cuál es vuestro nombre?»\n`),
    // bajo `es` salía `"¿Cuál es vuestro nombre?»` — ASCII abriendo contra `»`.
    const all = JSON.parse(
      readFileSync(fileURLToPath(new URL("../assets/talk/castle.json", import.meta.url)), "utf8"),
    ) as TalkScript[];
    setLang("es", { persist: false });
    try {
      const out: DialogueOutput[] = [];
      const c = new Conversation(all[2]!, {
        avatarName: "Avatar",
        npcKnowsAvatar: false,
        tr: (s) => t(s),
      });
      c.start().forEach((o) => out.push(o));
      for (const i of ["name", "Avatar", "job"]) c.input(i).forEach((o) => out.push(o));
      const lineas = out
        .filter((x) => x.kind === "line")
        .map((x) => (x as { text: string }).text);
      const pregunta = lineas.find((l) => l.includes("nombre?"));
      expect(pregunta, `no salió la pregunta de AskName: ${JSON.stringify(lineas)}`).toBeDefined();
      expect(pregunta).toBe("«¿Cuál es vuestro nombre?»\n");
      // CONTROL POSITIVO del cierre CONDICIONAL (0x0bc5/0x1172 `je`/`jne`): la sección
      // que AskName interrumpe queda ABIERTA a propósito — el op se llevó el control y
      // el binario no emite el putchar de cierre. Calcar incluye calcar lo que no cierra.
      expect(lineas, "la autopresentación truncada NO debe cerrarse").toContain(
        "«Me llaman Treanna ",
      );
    } finally {
      setLang(BASE_LANG, { persist: false });
    }
  });

  it("las primitivas de locale: el par sale de meta.quotes, NO del corpus de strings", () => {
    // La key inglesa `"` YA está tomada en `strings` por la comilla de APERTURA
    // (traduce a `«`), y una tabla indexada por texto no puede dar dos traducciones a la
    // misma key. El cierre no es la traducción de un string inglés: es una propiedad
    // TIPOGRÁFICA del idioma ⇒ vive en `meta`, fuera del corpus (y fuera del manifest).
    expect(quoteOpen(), "en = suelo del calco").toBe('"');
    expect(quoteClose(), "en = suelo del calco").toBe('"');
    setLang("es", { persist: false });
    try {
      expect(quoteOpen()).toBe("«");
      expect(quoteClose()).toBe("»");
      expect(es[huella('"')], "la key `\"` del corpus sigue siendo la de APERTURA").toBeDefined();
    } finally {
      setLang(BASE_LANG, { persist: false });
    }
  });

  it("los tres fragmentos de PUNTUACIÓN PURA de la consola ya tienen su cierre castellano", () => {
    setLang("es", { persist: false });
    try {
      expect(t(SHOP_UI.shipElseClose), "DS 0x9fd8, cierra").toBe("?» ");
      expect(t(SHOP_UI.buyBrokeOpen), "DS 0x7ba4, abre").toBe("\n«");
      expect(t(SHOP_UI.tavernAffordClose), "DS 0x9cca, cierra").toBe("!»\n\n");
      // CONTROL POSITIVO de la familia que ya existía (y que fija la convención por FORMA).
      expect(t('"'), "miembro previo: abre").toBe("«");
      expect(t('" '), "miembro previo: cierra").toBe("» ");
      // CONTROL NEGATIVO — `guildQtail` NO lleva `»` A PROPÓSITO: el inglés
      // (`"What else, ` + `?\n\n`) tampoco cierra esa comilla. Calcar incluye calcar lo
      // que el original deja abierto.
      expect(t(SHOP_UI.guildQtail)).toBe("?\n\n");
    } finally {
      setLang(BASE_LANG, { persist: false });
    }
  });
});
