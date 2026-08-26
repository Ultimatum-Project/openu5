/**
 * CAREO de la tabla de formas COMPUESTAS del corpus i18n contra lo que el port EMITE.
 *
 * ── EL DEFECTO QUE ESTE FICHERO EXISTE PARA CERRAR ───────────────────────────────────
 * Al cerrar la FICHA β el texto del segmento de datos salió del código a
 * `game/assets/ds-strings.json`, pero el motor no imprime el record pelado: lo ENVUELVE
 * (el original imprime la comilla y el `\n\n` con putchar/DS aparte del record). La clave
 * de `es.json` es la huella de lo que recibe `t()`, o sea de la forma COMPUESTA, así que
 * `game/tools/i18n-corpus.mjs` tiene que emitirlas — y para emitirlas replica las
 * decoraciones del port. **Son dos implementaciones de la misma regla**, que es
 * exactamente lo que en este repo no se deja suelto: el día que el port cambie una
 * decoración, el corpus se quedaría rancio y 19 traducciones se volverían huérfanas… o
 * peor, dejarían de estarlo por el motivo equivocado.
 *
 * Aquí no se re-implementa la composición por tercera vez: se EJERCITAN las escenas
 * reales y se comprueba que cada string que emiten está en el corpus. El sujeto es la
 * salida del port; el esperado, la tabla. Si divergen, este fichero lo dice por su nombre.
 */
import { expect, it } from "vitest";
import { describeConAssets } from "./assets-opcionales.js";
import { conDsStrings, dsStringsDeAsset, DS_STRINGS } from "./ds-strings-fixture.js";
import { buildCorpus } from "../tools/i18n-corpus.mjs";

describeConAssets([DS_STRINGS], "FICHA β — las formas compuestas del corpus son las del port", () => {
  conDsStrings();

  /**
   * Las decoraciones que el port aplica, INSTANCIADAS sobre el asset real. No es la tabla
   * del corpus copiada: es la lista de los sitios del port que componen, con el fichero y
   * la línea donde vive cada uno, para que el careo se pueda leer contra el código.
   */
  function compuestasDelPort(): { sitio: string; texto: string }[] {
    const ds = dsStringsDeAsset();
    const K = ds["KARMA.DAT"];
    const M = ds["MISCMSG.DAT"];
    const E = ds["ENDMSG.DAT"];
    const out: { sitio: string; texto: string }[] = [];
    // game.ts::refugeKarmaSpeech + camp.ts::campKarmaMessage → `"` + record + `"`.
    K.forEach((r, i) => out.push({ sitio: `game.ts/camp.ts KARMA rec${i}`, texto: `"${r}"` }));
    // shrine-ceremonies.ts::codexPage → `"` + record + `"\n\n`.
    M.slice(20, 28).forEach((r, i) =>
      out.push({ sitio: `shrine-ceremonies.ts codexPage(${i})`, texto: `"${r}"\n\n` }),
    );
    // blackthorn-capture.ts::interrogationQuestionTemplate → record + `{}?"`.
    M.slice(0, 3).forEach((r, i) =>
      out.push({ sitio: `blackthorn-capture.ts pregunta ronda ${i}`, texto: `${r}{}?"` }),
    );
    // blackthorn-capture.ts, amenaza del reloj de arena → record + `{} die!" \n\n`.
    out.push({ sitio: "blackthorn-capture.ts amenaza rec8", texto: `${M[8]}{} die!" \n\n` });
    // quest/lordbritish.ts → ENDMSG rec9 SIN su `\n` final.
    out.push({ sitio: "lordbritish.ts Códice rec9", texto: E[9]!.replace(/\n+$/, "") });
    return out;
  }

  it("cada forma compuesta que el port imprime existe en el corpus i18n", () => {
    const corpus = new Set(buildCorpus().corpus);
    const fuera = compuestasDelPort().filter(({ texto }) => !corpus.has(texto));
    expect(
      fuera.map((f) => `${f.sitio}: ${JSON.stringify(f.texto.slice(0, 60))}`),
      "formas que el port emite y el corpus NO tiene: una traducción suya saldría " +
        "HUÉRFANA en i18n-manifest. Actualiza la tabla de `game/tools/i18n-corpus.mjs`.",
    ).toEqual([]);
  });

  it("CONTROL POSITIVO: una decoración inventada NO está en el corpus", () => {
    // Sin esto, un corpus que lo contuviera TODO (o un `corpus` vacío mal leído que
    // hiciera pasar el filtro) daría verde arriba sin haber comprobado nada.
    const corpus = new Set(buildCorpus().corpus);
    const inventada = `«${dsStringsDeAsset()["KARMA.DAT"][0]}»`;
    expect(corpus.has(inventada)).toBe(false);
  });

  it("el careo mira una población NO vacía (y cubre los cinco sitios que componen)", () => {
    const sitios = compuestasDelPort();
    // 6 KARMA + 8 Codex + 3 preguntas + 1 amenaza + 1 Códice = 19, que son exactamente
    // las 19 claves de es.json que se quedaron huérfanas al retirar las del manifiesto.
    expect(sitios.length).toBe(19);
  });
});
