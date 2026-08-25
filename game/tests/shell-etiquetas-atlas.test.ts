/**
 * #248 — NINGUNA ETIQUETA DEL DRAWER LLEVA UN CARÁCTER QUE EL ATLAS NO PUEDE PINTAR.
 *
 * EL DEFECTO, medido y no supuesto (13-08, WebKit iPhone 390×844@3, drawer SISTEMA
 * abierto con F10). La fila «⇄ Swap pad side» se veía sangrada/centrada respecto a sus
 * hermanas. Las tres sospechas de layout eran FALSAS — la caja era idéntica:
 *
 *   fila                       caja x   primera columna con TINTA
 *   Save / Load (F5)              52            60
 *   Replays                       52            60
 *   Skin: 1988 (fiel)             52            60
 *   Skin: Shader (xBR)            52            58
 *   ⇄ Swap pad side               52            92   ← 32 px de más
 *   Fullscreen                    52            60
 *
 * …con `text-align:left` y `padding-left:6px` IGUALES en las seis. Los 32 px eran el
 * `⇄` (U+21C4): en la piel fiel el texto se pixeliza contra el atlas IBM.CH, que sólo
 * cubre 0x00-0x7F, así que el carácter NO SE PINTA PERO SÍ OCUPA. Un hueco que se lee
 * como sangría.
 *
 * ★★ POR QUÉ ESTA GUARDA MIRA EL TEXTO Y NO LA GEOMETRÍA. El rect de la fila enferma era
 * idéntico al de las sanas: cualquier aserto de `getBoundingClientRect` habría pasado en
 * VERDE con el defecto delante. Lo que discrimina es el CARÁCTER, así que se vigila el
 * carácter — en la fuente, que es donde se puede vigilar barato y sin navegador.
 *
 * 🔴 Y es una guarda de CLASE, no del caso: el `⇄` ya no está, pero lo que impide que
 * VUELVA (en esta fila o en cualquier otra que alguien decore mañana con un ☰, un ⚙ o
 * una flecha bonita) es que el predicado barra TODAS las etiquetas. Censado el 13-08:
 * era la única fila con adorno no-ASCII al principio, y sus hermanas nunca tuvieron.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SECCIONES = fileURLToPath(new URL("../src/ui/shell/sections.ts", import.meta.url));

/** Fuente de `sections.ts`: las etiquetas del drawer se construyen aquí. */
const src = readFileSync(SECCIONES, "utf8");

/**
 * Extrae los `label:` de la fuente. Se leen de la FUENTE y no del DOM a propósito: la
 * guarda tiene que correr en la puerta pura (sin navegador) para que sea barata, y el
 * dato que discrimina —el carácter— está entero en el literal.
 */
function etiquetas(): { linea: number; texto: string }[] {
  const out: { linea: number; texto: string }[] = [];
  src.split("\n").forEach((l, i) => {
    const m = l.match(/^\s*label:\s*(.+?),?\s*$/);
    if (m) out.push({ linea: i + 1, texto: m[1]! });
  });
  return out;
}

describe("#248 — etiquetas del drawer contra el atlas IBM.CH (0x00-0x7F)", () => {
  it("ninguna etiqueta abre con un glifo decorativo fuera del atlas", () => {
    const malas: string[] = [];
    for (const { linea, texto } of etiquetas()) {
      // Sólo interesa lo que va FUERA de `ts("…")`: un adorno pegado al literal de
      // plantilla. Los textos traducibles viven dentro de ts() y son otra población
      // (los acentos del castellano son un asunto distinto, y no de esta ficha).
      const plantilla = texto.match(/^`([^$]*)\$\{/);
      if (!plantilla) continue;
      const prefijo = plantilla[1]!;
      const fuera = [...prefijo].filter((c) => c.charCodeAt(0) > 0x7f);
      if (fuera.length > 0) {
        malas.push(
          `sections.ts:${linea} abre con ${fuera
            .map((c) => `U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`)
            .join(" ")} — el atlas no lo pinta pero le reserva ancho (#248)`,
        );
      }
    }
    expect(malas, malas.join("\n")).toEqual([]);
  });

  it("la fila del lado del pad sigue existiendo y su etiqueta es sólo el texto", () => {
    // Control ANTI-VACUO: si alguien borrase la fila entera, el aserto de arriba pasaría
    // en verde por población vacía. Esto ancla que la fila SIGUE ahí y sin adorno.
    expect(src).toContain('label: ts("Swap pad side")');
    expect(src).not.toContain("⇄ ${ts(");
  });

  it("el predicado CAZA el defecto que existió (mutante)", () => {
    // Se re-corre el mismo predicado contra la línea EXACTA que había antes del fix.
    // Sin esto, un `etiquetas()` que dejara de extraer nada pasaría en verde para siempre.
    const viejo = 'label: `⇄ ${ts("Swap pad side")}`,';
    const m = viejo.match(/^\s*label:\s*(.+?),?\s*$/);
    expect(m, "el extractor ya no reconoce la forma `label:` — la guarda estaría muerta").not.toBeNull();
    const plantilla = m![1]!.match(/^`([^$]*)\$\{/);
    expect(plantilla, "el extractor ya no reconoce la plantilla con prefijo").not.toBeNull();
    const fuera = [...plantilla![1]!].filter((c) => c.charCodeAt(0) > 0x7f);
    expect(fuera.map((c) => c.charCodeAt(0))).toEqual([0x21c4]);
  });
});
