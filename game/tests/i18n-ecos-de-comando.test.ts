/**
 * ECOS DE COMANDO COMPUESTOS: se traduce la CONSTANTE y se compone después.
 *
 * 🔴 EL DEFECTO (visto por el usuario jugando en español, 2026-08-04): el eco de (L)ook
 * salía «Look-North» en una partida en castellano.
 *
 * La causa no es una traducción que falte. `CMD_STRINGS.look` vale **"Look"** —el guión
 * NO está en la cadena del binario, lo imprime el despachador con `putchar('-')`, al
 * revés que sus hermanos ("Open-", "Search-"…, que sí lo traen dentro— y el call-site
 * componía `CMD_STRINGS.look + "-"` ANTES de pasar por `pushConsole`, que es el choke
 * de i18n y traduce la cadena ENTERA. `t("Look-")` no encuentra nada y cae al inglés.
 *
 * 🔴 Y EL ARREGLO OBVIO ERA EL EQUIVOCADO. Añadir `"Look-"` a `es.json` deja el eco en
 * español y **la guarda anti-fabricación de `i18n-manifest` lo rechaza con razón**: una
 * key de traducción tiene que ser un string que EXISTA en el original, y "Look-" no
 * existe en ningún sitio — es un artefacto de nuestra composición. Ese rojo es el que
 * mandó a buscar el arreglo bueno: traducir la constante (que sí está en el corpus) y
 * componer después, como ya hacía `yell` (main.ts:1742).
 *
 * Este test vigila la FORMA DEL CALL-SITE, no el diccionario, porque el defecto vive
 * ahí: un `t()` que falta, no una traducción que falta.
 */
import { readFileSync } from "node:fs";
import { huella } from "../src/i18n/huella.js";
import { describe, expect, it } from "vitest";
import { CMD_STRINGS } from "../src/core/world/cmd-strings.js";

/**
 * 🔴 SE QUITAN LOS COMENTARIOS ANTES DE BUSCAR, y no es cosmética.
 *
 * La primera versión de este test buscaba sobre el fuente crudo y **se acusó a sí
 * misma**: el comentario que documenta el arreglo CITA el código viejo
 * (`hud.echo(CMD_STRINGS.look + "-")`) para explicar qué estaba mal, y el patrón casó
 * con la cita. El arreglo salía como defecto.
 *
 * Es el mismo mecanismo que refutó cuatro detectores distintos el 04-08: **un buen
 * arreglo cita lo que deroga, así que cualquier detector que busque el texto viejo
 * casará con la corrección** — y cuanto mejor esté documentada, más se parece al
 * defecto. Aquí se puede resolver porque la distinción CÓDIGO/COMENTARIO es sintáctica
 * y no semántica; donde no lo sea, no hay predicado que valga y hay que leer el bloque.
 */
function sinComentarios(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // bloque
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // línea (sin comerse el "//" de una URL)
}

const MAIN = sinComentarios(readFileSync(new URL("../src/main.ts", import.meta.url), "utf8"));

/**
 * Call-sites que componen un eco: `hud.echo(CMD_STRINGS.<cmd> + "<sufijo>")`.
 * Si la constante NO acaba ya en el sufijo, la concatenación fabrica una cadena que no
 * existe en el binario ⇒ el choke de i18n no la encontrará ⇒ hay que envolver la
 * constante en `t()`.
 */
const COMPOSICIONES = [...MAIN.matchAll(
  /hud\.echo\(\s*(t\()?\s*CMD_STRINGS\.(\w+)\)?\s*\+\s*"([^"]*)"/g,
)].map((m) => ({ traducido: Boolean(m[1]), cmd: m[2]!, sufijo: m[3]! }));

describe("ecos compuestos: traducir la constante, componer después", () => {
  it("hay composiciones que vigilar (el propio predicado no está muerto)", () => {
    // Sin esto, un cambio de forma en los call-sites (otro nombre, otra fachada) dejaría
    // el array vacío y el test daría verde sin mirar nada: el modo de fallo clásico de
    // un guarda que busca por patrón en el fuente.
    expect(COMPOSICIONES.length).toBeGreaterThanOrEqual(2);
  });

  it("toda composición que fabrica una cadena nueva pasa por t()", () => {
    const crudas = COMPOSICIONES.filter((c) => {
      const base = (CMD_STRINGS as Record<string, string>)[c.cmd];
      if (base === undefined) return false;
      // Si la constante YA termina en el sufijo, no se fabrica nada nuevo.
      const fabrica = !base.endsWith(c.sufijo);
      return fabrica && !c.traducido;
    });
    expect(
      crudas.map((c) => `hud.echo(CMD_STRINGS.${c.cmd} + ${JSON.stringify(c.sufijo)})`),
      'Esta composición se traduciría como cadena ENTERA en pushConsole, y esa cadena NO EXISTE en el binario ⇒ eco en inglés jugando en español. Envuelve la constante: hud.echo(t(CMD_STRINGS.x) + "sufijo"). NO añadas la compuesta a es.json: la guarda anti-fabricación la rechaza, y con razón.',
    ).toEqual([]);
  });

  it("el guarda TIENE DIENTES: distingue envuelto de crudo y sufijo propio de fabricado", () => {
    // Control positivo del predicado sobre casos construidos, no sobre el árbol vivo.
    const casos = [
      { txt: 'hud.echo(CMD_STRINGS.look + "-")', esperaCruda: true },
      { txt: 'hud.echo(t(CMD_STRINGS.look) + "-")', esperaCruda: false },
    ];
    for (const { txt, esperaCruda } of casos) {
      const m = /hud\.echo\(\s*(t\()?\s*CMD_STRINGS\.(\w+)\)?\s*\+\s*"([^"]*)"/.exec(txt)!;
      expect(Boolean(m[1]), txt).toBe(!esperaCruda);
    }
    // Y el otro filo: "Search-" YA acaba en "-", así que componerlo no fabrica nada.
    expect(CMD_STRINGS.search.endsWith("-")).toBe(true);
    expect(CMD_STRINGS.look.endsWith("-")).toBe(false); // la asimetría que causó el defecto
  });

  it("el despojado de comentarios NO se come código, y sí se come la cita", () => {
    // Control del filtro que evita que el test se acuse a sí mismo. Sin este caso, un
    // `sinComentarios` demasiado goloso podría vaciar el fuente y dejar el guarda
    // ciego con el aspecto de estar verde.
    const muestra = [
      '// hud.echo(CMD_STRINGS.look + "-")  ← la cita del arreglo',
      'hud.echo(t(CMD_STRINGS.look) + "-");',
    ].join("\n");
    const limpio = sinComentarios(muestra);
    expect(limpio).not.toContain('hud.echo(CMD_STRINGS.look + "-")');
    expect(limpio).toContain("hud.echo(t(CMD_STRINGS.look)");
  });

  it("`Look` sigue traducido y `Look-` sigue SIN existir en es.json", () => {
    // El arreglo NO debe volver por la vía fabricada. Si alguien añade "Look-" a es.json
    // creyendo que arregla algo, este aserto y la guarda anti-fabricación lo paran.
    // #380: las claves son HUELLAS, así que buscar `"Look"` COMO TEXTO en el fichero ya
    // no responde a la pregunta — daría siempre `false` y el primer aserto caería en
    // falso, mientras el segundo pasaría por el motivo equivocado (no hay literal que
    // encontrar para NINGUNA clave). Se pregunta por la clave, que es lo que se quería
    // preguntar desde el principio.
    const es = JSON.parse(
      readFileSync(new URL("../src/i18n/es.json", import.meta.url), "utf8"),
    ) as { strings: Record<string, { t: string }> };
    expect(es.strings[huella("Look")], "«Look» debe seguir teniendo traducción").toBeDefined();
    expect(es.strings[huella("Look-")], "«Look-» es fabricado: no puede existir").toBeUndefined();
  });
});

/**
 * MISMA CLASE DE DEFECTO, otro call-site (visto por el usuario jugando en español,
 * vídeo 24-08): el prompt del interrogatorio de Blackthorn componía
 * `${e.text}${BLACKTHORN_UI.response}` SIN t() — la pregunta llegaba traducida (tf en
 * la emisión) pero la coletilla salía «Your response?» en inglés: el compuesto
 * pregunta+coletilla no es key del corpus y el choke de pushConsole lo deja tal cual.
 */
describe("prompt del interrogatorio de Blackthorn: la coletilla pasa por t()", () => {
  it("el call-site envuelve BLACKTHORN_UI.response en t() (forma, sin comentarios)", () => {
    // El askText del prompt (main.ts, kind blackthorn-interrogation-prompt) debe
    // componer con `t(BLACKTHORN_UI.response)`; la forma cruda es el defecto.
    expect(MAIN).toContain("${t(BLACKTHORN_UI.response)}");
    expect(MAIN).not.toContain("${BLACKTHORN_UI.response}");
  });

  it('la key "\\n\\nYour response?" (DATA.OVL DS 0x6f7a) existe en es.json — en crudo', () => {
    const es = JSON.parse(
      readFileSync(new URL("../src/i18n/es.json", import.meta.url), "utf8"),
    ) as { strings: Record<string, { t: string }> };
    // Esperado EN CRUDO (no derivado del sujeto): la constante BLACKTHORN_UI.response
    // vale "\n\nYour response?" y su traducción es la de sus dos hermanas ya vivas
    // ('\n\nYour response?\n' / '\n\nYour response?\n:').
    expect(es.strings[huella("\n\nYour response?")]?.t).toBe("\n\n¿Vuestra respuesta?");
    // Y el aviso del primer fallo (MISCMSG rec7, BLCKTHRN 0x51c) que el censo del
    // 24-08 encontró sin key:
    expect(es.strings[huella('"Make not the mistake of laughing at me, simple one!"')]?.t).toBe(
      "«¡No cometáis el error de reíros de mí, simplón!»",
    );
  });
});
