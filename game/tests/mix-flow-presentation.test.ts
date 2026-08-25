/**
 * CADENA DE PRESENTACIÓN del comando (M)ix — bug reportado por el usuario el 28-07
 * con captura del ORIGINAL en DOSBox: «cuando se pulsa mix, en orig se muestra este
 * texto, y en port no».
 *
 * La MECÁNICA de Mix ya era fiel (consumo por máscara, receta [bx+0x1cc0], cantidad
 * con re-pregunta). Lo que faltaba era PRESENTACIÓN, que en el binario es parte del
 * mismo `cmd_mix` y por tanto igual de derivable. Estos tests sellan las cuatro
 * piezas que el port no emitía, con la cita del emisor en cada mensaje:
 *
 *   1. eco «Mix Reagents» del dispatcher (DS 0xa1b4) — declarado y nunca emitido.
 *   2. prompt en DOS filas «For what spell?» + «:» (DS 0x8fac).
 *   3. ★ pie de instrucciones «←,→,↑,↓ to move, / RETURN selects. / Type M to mix:»
 *      (glifos CP437 @0x1b1e-0x1b53 + DS 0x8fc6 @0x1b56), AUSENTE por completo.
 *   4. el panel «Reagents:» (DS 0x8f64) y el resto de cadenas, por `MIX_UI`.
 *
 * FAILING-FIRST: verificado que 1/2/3 CAEN contra el port de antes del fix (no
 * existían `MIX_UI`, `MIX_ARROW_GLYPHS` ni `mixPickerFooterLines`, y `doMix` no
 * llamaba a `hud.echo`). Derivación completa en `re/notes/mix-flow-acta.md`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CMD_STRINGS, MIX_ARROW_GLYPHS, MIX_UI } from "../src/core/world/cmd-strings.js";
import { mixPickerFooterLines } from "../src/core/magic/mixReagentPicker.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const mainSrc = readFileSync(join(HERE, "..", "src", "main.ts"), "utf8");

describe("(M)ix — cadena de presentación calcada de cmd_mix (CMDS.OVL 0x1AD8)", () => {
  it("las cadenas de MIX_UI son verbatim de DATA.OVL (fileoff = DS + 0x10)", () => {
    // Volcadas byte a byte de original/u5/ultima5/DATA.OVL; aquí van SIN el \n/\n\n
    // de control (el modelo de consola parte líneas), igual que READY_UI/USE_UI.
    expect(MIX_UI.forWhatSpell, 'DS 0x8fac = "For what spell?\\n:" — 1ª fila').toBe("For what spell?");
    expect(MIX_UI.cursor, "DS 0x8fac — 2ª fila: el ':' es el cursor del getstring").toBe(":");
    expect(MIX_UI.none, 'DS 0x8fbe = "\\nNone!\\n" (ret -1 del getstring, CMDS 0x1b18)').toBe("None!");
    expect(MIX_UI.noReagents, 'DS 0x8f98 = "No reagents owned!\\n" (precheck 0x1af8)').toBe("No reagents owned!");
    expect(MIX_UI.reagents, "DS 0x8f64 — rótulo del panel (CMDS 0x18be @0x1924)").toBe("Reagents:");
    expect(MIX_UI.howMuch, "DS 0x8f72 — prompt de cantidad (CMDS 0x1a70 @0x1a7d)").toBe("How much? ");
    expect(MIX_UI.insufficient, 'DS 0x8f7e = "Insufficient reagents!\\n\\n" (@0x1aa7)').toBe("Insufficient reagents!");
    expect(MIX_UI.nothingToMix, 'DS 0x9004 = "\\nNothing to mix!\\n" (@0x1b78 → 0x1c0a)').toBe("Nothing to mix!");
    expect(MIX_UI.mixing, 'DS 0x8ff0 = "Mixing...\\n" (@0x1b81)').toBe("Mixing...");
    expect(MIX_UI.done, 'DS 0x8ffc = "\\nDone!\\n" (@0x1bd6, receta acertada)').toBe("Done!");
  });

  it("los 4 glifos de flecha son CÓDIGOS CP437, en el orden en que los pone putchar", () => {
    // CMDS.OVL @0x1b25/0x1b33/0x1b41/0x1b4f: putchar(0x1b) ← , putchar(0x1a) → ,
    // putchar(0x18) ↑ , putchar(0x19) ↓ — con putchar(0x2c) ',' entre medias
    // (@0x1b2c/0x1b3a/0x1b48). La piel fiel indexa el atlas de IBM.CH por
    // charCodeAt directo, así que DEBEN ser 0x18-0x1b y no flechas Unicode.
    const codes = [...MIX_ARROW_GLYPHS].map((c) => c.charCodeAt(0));
    expect(codes, "orden exacto ←,→,↑,↓ con comas (CMDS 0x1b25-0x1b4f)").toEqual([
      0x1b, 0x2c, 0x1a, 0x2c, 0x18, 0x2c, 0x19,
    ]);
    // Control positivo del error que este test existe para cazar: una flecha Unicode
    // caería fuera del atlas (U+2190 = celda 8592, inexistente en IBM.CH).
    expect(codes.every((c) => c < 0x80), "ningún glifo fuera del rango del atlas").toBe(true);
  });

  it("el pie de instrucciones son las 3 filas de DS 0x8fc6 tras los glifos", () => {
    // print_string(0x8fc6) = " to move,\nRETURN selects.\nType M to mix:" (@0x1b56).
    const lines = mixPickerFooterLines();
    expect(lines.length, "DS 0x8fc6 lleva 2 \\n ⇒ 3 filas (el \\n inicial de @0x1b1e es el salto de fila, no una fila en blanco)").toBe(3);
    expect(lines[0], "fila 1 = glifos + ' to move,' (@0x1b25-0x1b56)").toBe(MIX_ARROW_GLYPHS + " to move,");
    expect(lines[1], "fila 2 = 'RETURN selects.' (DS 0x8fc6)").toBe("RETURN selects.");
    expect(lines[2], "fila 3 = 'Type M to mix:' (DS 0x8fc6)").toBe("Type M to mix:");
  });

  it("la fila 1 del pie es EXACTAMENTE lo que verá el jugador (calco compuesto)", () => {
    // El compuesto completo que el binario emite entre @0x1b1e y @0x1b5a.
    expect(mixPickerFooterLines().join("\n"), "compuesto de CMDS 0x1b1e-0x1b5a").toBe(
      "\u001b,\u001a,\u0018,\u0019 to move,\nRETURN selects.\nType M to mix:",
    );
  });
});

describe("(M)ix — CABLEADO en main.ts (la lógica sellada no vale si nadie la llama)", () => {
  // Precedente del acervo: el TapGate tenía 9 tests y `bindTap` CERO. Las 3 piezas
  // de arriba son puras; estos asertos sellan que `doMix` las EMITE de verdad.
  const doMix = mainSrc.slice(mainSrc.indexOf("const doMix = ("), mainSrc.indexOf("const doCast = ("));

  it("doMix ecoa CMD_STRINGS.mix (DS 0xa1b4) — el eco que faltaba", () => {
    expect(CMD_STRINGS.mix, "DS 0xa1b4, verbatim en DATA.OVL").toBe("Mix Reagents\n\n");
    expect(doMix, "el dispatcher ecoa 'Mix Reagents' al pulsar M, ANTES de cmd_mix (la captura del usuario lo muestra como '>Mix Reagents')").toContain(
      "hud.echo(CMD_STRINGS.mix)",
    );
  });

  // ⚠ RE-ANCLADO en el merge a main (01-08). Este sello nació pidiendo la forma de la
  // rama —`pickSpellTyped(t(MIX_UI.cursor), cb, question)`, con la pregunta como 3er
  // argumento—. Main implementó entretanto el MISMO arreglo genérico para Cast y Mix
  // (#107): las dos filas las arma SIEMPRE `pickSpellTyped`, así que el 3er argumento
  // dejó de existir. Lo que este sello debe fijar es la INTENCIÓN, no la firma: que la
  // etiqueta salga por `MIX_UI` (cita DS + choke de i18n). Que sean DOS filas lo sella
  // `pickers-unit.test.ts` («Mix usa el MISMO modelo de dos filas (DS 0x8fac)»).
  it("doMix pide el hechizo con la etiqueta de MIX_UI (DS 0x8fac, 1ª fila)", () => {
    expect(doMix, "la etiqueta viaja por MIX_UI: cita DS única + choke de i18n").toContain(
      "pickSpellTyped(t(MIX_UI.forWhatSpell)",
    );
  });

  it("el selector de reagentes emite el pie ANTES de publicar el panel", () => {
    const picker = mainSrc.slice(
      mainSrc.indexOf("const openMixReagentPicker = ("),
      mainSrc.indexOf("const askMixQuantity = ("),
    );
    expect(picker, "CMDS 0x1b1e-0x1b5a corre ANTES del `call 0x18be` de 0x1b5d").toContain(
      "mixPickerFooterLines()",
    );
    expect(
      picker.indexOf("mixPickerFooterLines()") < picker.indexOf("publish();\n      prompts.current"),
      "el pie va a la CONSOLA antes de abrir el panel (orden del binario)",
    ).toBe(true);
  });

  it("doMix no deja cadenas de Mix a pelo: todas pasan por MIX_UI + t()", () => {
    const flow = mainSrc.slice(
      mainSrc.indexOf("const mixReagentView = ("),
      mainSrc.indexOf("const doCast = ("),
    );
    for (const literal of [
      '"Reagents:"',
      '"How much? "',
      '"Nothing to mix!"',
      '"Insufficient reagents!"',
      '"Mixing..."',
      '"Done!"',
      '"No reagents owned!"',
      '"For what spell? "',
    ]) {
      expect(flow, `${literal} debe venir de MIX_UI (choke de i18n + cita única)`).not.toContain(
        `hud.message(${literal})`,
      );
      expect(flow, `${literal} debe venir de MIX_UI (choke de i18n + cita única)`).not.toContain(
        `hud.echo(${literal})`,
      );
    }
  });
});
