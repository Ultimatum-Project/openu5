/**
 * FICHA #235 — **una sola implementación de escape de HTML en todo el repo.**
 *
 * Había tres, y divergentes: `ui/savepanel.ts` escapaba `[&<>"']` (con apóstrofe),
 * `debug/teleportPicker.ts` y `web/panel-consentimiento.ts` sólo `[&<>"]`. Tres copias de una
 * primitiva de SEGURIDAD, y la que se había endurecido no era la que se copiaba. La
 * exposición viva medida por la auditoría #230 era BAJA —los innerHTML con dato de usuario
 * van por `textContent` o por la copia completa—, así que esto NO cerraba un XSS vivo: cierra
 * el camino por el que llegaría, el día que alguien interpole el nombre de una partida
 * importada (un `.u5gam` que viaja entre dispositivos, #229) en un atributo con comillas
 * simples usando una de las copias flojas.
 *
 * ── POR QUÉ EL CENSO ES POR CLASE Y NO POR FICHERO ────────────────────────────────────────
 * Un test que comprobara «savepanel/teleportPicker/panel-consentimiento importan la
 * primitiva» quedaría verde para siempre y no vería la CUARTA copia que alguien escriba
 * mañana en un fichero nuevo — que es exactamente cómo nacieron estas tres. El sujeto no es
 * «estos tres ficheros», es «ninguno». Por eso el corpus es la POBLACIÓN (`game/src` +
 * `demo-byo/src`) y el predicado va por la FORMA (familia #178).
 *
 * Las dos maneras en que un censo así se pone verde por vacío, y lo que hace cada una aquí:
 *   · el barrido no encuentra ficheros (glob mal, ruta movida) → aserto de SUELO sobre el
 *     tamaño de la población y sobre la presencia del módulo canónico;
 *   · el predicado no casa con nada nunca → CONTROL POSITIVO sembrado, y además se comprueba
 *     que el predicado SÍ señala al módulo canónico cuando no se le excluye — un control
 *     contra código REAL, no sólo contra una cadena inventada.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { escapeHtml } from "../src/core/escape-html.js";

// 🔴 Anclado a `import.meta.url`, no al cwd: un censo resuelto contra el directorio de
// trabajo mide el árbol de quien lo lance, y desde otro worktree daría un veredicto
// impecable de la rama equivocada.
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const POBLACION = [join(raiz, "game", "src"), join(raiz, "demo-byo", "src")];

/** La ÚNICA copia legítima. Cualquier otro fichero que fabrique entidades es una copia. */
const CANONICO = "game/src/core/escape-html.ts";

function ficherosTs(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...ficherosTs(p));
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

/**
 * ¿Este texto FABRICA entidades HTML a mano? La firma de un escapador re-implementado es la
 * entidad escrita como literal de cadena. Se busca eso y no `function escapeHtml`, porque el
 * nombre es lo primero que cambia al copiar (las tres copias se llamaban `escapeHtml`,
 * `escapeHtml` y `esc`): el nombre no es invariante, la entidad sí.
 */
function fabricaEntidades(texto: string): string[] {
  const ENTIDADES = ["&amp;", "&lt;", "&gt;", "&quot;", "&#39;"];
  return texto
    .split("\n")
    .filter((l) => {
      const codigo = l.trim();
      if (codigo.startsWith("*") || codigo.startsWith("//")) return false; // prosa, no código
      return ENTIDADES.some((e) => codigo.includes(`"${e}"`) || codigo.includes(`'${e}'`));
    })
    .map((l) => l.trim());
}

const CORPUS = POBLACION.flatMap(ficherosTs).map((f) => ({
  ruta: relative(raiz, f).replaceAll("\\", "/"),
  texto: readFileSync(f, "utf8"),
}));

describe("#235 · CENSO DE CLASE: ningún escapador de HTML re-implementado", () => {
  it("SUELO: el corpus se barrió de verdad y el módulo canónico está dentro", () => {
    // Un censo que mide 0 infractores sobre 0 ficheros es indistinguible de uno que mide 0
    // sobre el árbol entero. Este aserto separa las dos lecturas antes de creerse el de abajo.
    expect(CORPUS.length).toBeGreaterThan(100);
    expect(CORPUS.map((f) => f.ruta)).toContain(CANONICO);
  });

  it("no queda ninguna copia local fuera del módulo canónico", () => {
    const copias = CORPUS.filter((f) => f.ruta !== CANONICO).flatMap((f) =>
      fabricaEntidades(f.texto).map((l) => `${f.ruta}: ${l}`),
    );
    expect(copias).toEqual([]);
  });

  it("CONTROL POSITIVO · contra código REAL: sin la exclusión, el canónico sería señalado", () => {
    // Esto es lo que impide que el aserto de arriba pase por un predicado muerto: el mismo
    // predicado, aplicado al módulo que SÍ fabrica entidades, tiene que encontrarlas.
    const canonico = CORPUS.find((f) => f.ruta === CANONICO);
    expect(canonico).toBeDefined();
    expect(fabricaEntidades(canonico!.texto).length).toBeGreaterThan(0);
  });

  it("CONTROL POSITIVO · una copia sembrada (con y sin apóstrofe) se caza igual", () => {
    const copiaFloja = 'return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");';
    const copiaDura = `case "'": return "&#39;";`;
    expect(fabricaEntidades(copiaFloja)).toHaveLength(1);
    expect(fabricaEntidades(copiaDura)).toHaveLength(1);
    // Y no caza prosa: un docblock que MENCIONE una entidad no es una copia.
    expect(fabricaEntidades(' * el `&#39;` del atributo con comillas simples')).toEqual([]);
  });
});

describe("#235 · la primitiva promovida es la ENDURECIDA", () => {
  it("escapa los CINCO, apóstrofe incluido", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("🔴 el apóstrofe es el que separa esto de un agujero en un atributo con comillas simples", () => {
    // El caso REAL: un nombre de partida importada interpolado en title='…'. Con las copias
    // flojas (que no tocaban el apóstrofe) el atributo se cierra y lo que sigue es marcado.
    const nombre = "Avatar' onmouseover='alert(1)";
    const atributo = `<span title='${escapeHtml(nombre)}'>x</span>`;
    expect(atributo).not.toContain("onmouseover='");
    expect(atributo).toBe("<span title='Avatar&#39; onmouseover=&#39;alert(1)'>x</span>");
  });

  it("el & NO se escapa dos veces (la trampa del escape en dos pasadas)", () => {
    // Sustituir `&` en un recorrido y el resto en otro produce `&amp;lt;` si el orden se
    // invierte. Con una sola pasada sobre la clase de caracteres eso no puede pasar.
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("texto sin caracteres especiales sale intacto", () => {
    expect(escapeHtml("Lord British")).toBe("Lord British");
    expect(escapeHtml("")).toBe("");
  });
});
