/**
 * GUARDA DE CLASE — ficha #219: escribir una propiedad IDL de PISTA DE CONDUCTA sin
 * comprobar que REFLEJA deja una preferencia MUDA en el motor que no lleva la propiedad
 * en su prototipo — la asignación no falla: crea un campo propio (expando) del elemento,
 * `getAttribute` da null y el motor NUNCA ve la preferencia.
 *
 * CASO ÍNDICE (#192, 13-08): `input.autocapitalize = "characters"` en la intro táctil.
 * De las SIETE propiedades escritas sobre ese input, sólo ésa faltaba en el prototipo de
 * WebKit — el teclado del nombre salía en minúsculas EXACTAMENTE en el único motor para
 * el que se escribió la línea. Fix = setAttribute (faithful-intro.ts).
 *
 * CENSO DE CLASE (19-08, este fichero): 6 escrituras IDL a ciegas más en el port
 * (autocomplete ×2, spellcheck ×2, enterKeyHint, inputMode — creation.ts y
 * faithful-intro.ts). La sonda contra los DOS motores del arnés (Playwright, mismo
 * patrón del índice) midió:
 *
 *                    en prototipo (chromium / webkit)
 *   autocapitalize        sí / NO      ← el índice: muda en WebKit
 *   autocorrect           NO / sí      ← la imagen ESPECULAR: muda en Chromium
 *   autocomplete          sí / sí
 *   spellcheck            sí / sí
 *   enterKeyHint          sí / sí
 *   inputMode             sí / sí
 *
 * ⇒ hoy NINGUNA de las 6 es muda, pero el idioma es el mismo que parió el índice: basta
 * que un motor recorte su prototipo (o que la propiedad sea joven, como autocorrect en
 * Chromium) para que la preferencia enmudezca SIN SEÑAL. Dos propiedades de la misma
 * familia, cada una muda en un motor distinto: la clase no es teórica.
 *
 * REMEDIO (decidido con el código delante):
 *   · TODAS las pistas de conducta van por `setAttribute` — el atributo de contenido es
 *     la fuente de verdad que el motor LEE aunque no exponga la propiedad IDL (medido:
 *     WebKit honra el atributo autocapitalize sin tener la propiedad; Chromium ídem con
 *     autocorrect). Migración en este mismo commit.
 *   · Esta guarda (default-DENY, censo AST sobre game/src + demo-byo/src) enrojece
 *     nombrando fichero:línea a toda asignación IDL nueva de la familia.
 *   · DESCARTADO el helper runtime de escritura-verificada: leer la PROPIEDAD de vuelta
 *     EXCULPA al código roto (la asignación expando devuelve lo escrito — memoria del
 *     índice), y verificar por getAttribute tras setAttribute es tautológico. La única
 *     verificación con información es la sonda por motor (arriba, medida) + este censo.
 *
 * Por qué AST y no regex: mismo motivo que #253 — los comentarios de faithful-intro.ts
 * CITAN la escritura rota verbatim (`input.autocapitalize = "characters"`) y un grep la
 * contaría; el árbol sintáctico sólo ve código vivo.
 *
 * LÍMITES DECLARADOS del censo (no cobertura silenciosa):
 *   · Sólo asignaciones `x.prop = v` (EqualsToken). `Object.assign(el, {...})` o
 *     desestructuraciones no se censan — hoy 0 en el port para esta familia.
 *   · La lista DENY es cerrada (abajo, con criterio). `translate` y `contentEditable`
 *     quedan FUERA a propósito: universales desde siempre en ambos motores, y
 *     `translate` colisionaría con `style.translate` (CSS) — un falso positivo por
 *     nombre. Si entra un elemento <video>/<audio> al port, playsInline y familia ya
 *     están en la lista.
 *
 * Lógica PURA (lee los fuentes del repo, sin DOM). Medición base: 2026-08-19, sobre
 * main be5b94b9 el censo dio 6 escrituras a ciegas (estreno en ROJO); tras la
 * migración, 0 — y la población setAttribute de la familia, 13.
 */
import ts from "typescript";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(here, "..", "..");
const DIRS_FUENTE = [join(RAIZ, "game", "src"), join(RAIZ, "demo-byo", "src")];

/**
 * La familia censada: pistas de conducta al motor (teclado, corrección, medios) cuyo
 * respaldo IDL es HETEROGÉNEO entre motores o versiones. En minúsculas: el censo
 * compara case-insensitive, así caza tanto `inputMode` (IDL legítima pero frágil)
 * como `inputmode` (expando puro, mudo en TODOS los motores).
 */
const PISTAS_DE_CONDUCTA = new Set([
  "autocapitalize",
  "autocorrect",
  "autocomplete",
  "spellcheck",
  "enterkeyhint",
  "inputmode",
  "writingsuggestions",
  "virtualkeyboardpolicy",
  "playsinline",
  "disablepictureinpicture",
  "disableremoteplayback",
]);

type Hallazgo = { fichero: string; linea: number; prop: string };

/** Recorre un directorio y devuelve los .ts (no .d.ts) recursivamente. */
function ficherosTs(dir: string): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) out.push(...ficherosTs(ruta));
    else if (nombre.endsWith(".ts") && !nombre.endsWith(".d.ts")) out.push(ruta);
  }
  return out;
}

/** Asignaciones `x.<pista> = v` en un fuente (la escritura a ciegas de la clase). */
function censaEscriturasCiegas(src: string, nombreFichero: string): Hallazgo[] {
  const sf = ts.createSourceFile(nombreFichero, src, ts.ScriptTarget.Latest, true);
  const hallazgos: Hallazgo[] = [];
  const visita = (n: ts.Node): void => {
    if (
      ts.isBinaryExpression(n) &&
      n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(n.left) &&
      PISTAS_DE_CONDUCTA.has(n.left.name.text.toLowerCase())
    ) {
      const { line } = sf.getLineAndCharacterOfPosition(n.left.name.getStart(sf));
      hallazgos.push({ fichero: nombreFichero, linea: line + 1, prop: n.left.name.text });
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return hallazgos;
}

/** Llamadas `setAttribute("<pista>", …)` — la población del idioma CORRECTO. */
function cuentaSetAttributeConducta(src: string, nombreFichero: string): number {
  const sf = ts.createSourceFile(nombreFichero, src, ts.ScriptTarget.Latest, true);
  let n = 0;
  const visita = (x: ts.Node): void => {
    if (
      ts.isCallExpression(x) &&
      ts.isPropertyAccessExpression(x.expression) &&
      x.expression.name.text === "setAttribute" &&
      x.arguments.length >= 1 &&
      ts.isStringLiteral(x.arguments[0]!) &&
      PISTAS_DE_CONDUCTA.has(x.arguments[0]!.text.toLowerCase())
    ) {
      n++;
    }
    ts.forEachChild(x, visita);
  };
  visita(sf);
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────────────

const ficheros = DIRS_FUENTE.flatMap((d) => ficherosTs(d));
const fuentes = ficheros.map((f) => ({
  ruta: relative(RAIZ, f),
  src: readFileSync(f, "utf8"),
}));

describe("ficha #219 §control — el detector VE la escritura a ciegas (siembra)", () => {
  it("caza la asignación IDL sembrada (camelCase y expando lowercase), y no toca a las inocentes", () => {
    const sembrado = [
      'el.autocapitalize = "characters";', // el caso índice, verbatim
      'input.inputmode = "text";', // expando lowercase: mudo en TODOS los motores
      'input.value = "hola";', // inocente: no es de la familia
      'ajuste.spellcheck === false;', // comparación, no asignación
      '// comentario que cita `el.autocorrect = "off"` y NO debe contar', // sólo código vivo
    ].join("\n");
    const hallados = censaEscriturasCiegas(sembrado, "siembra.ts");
    expect(hallados.map((h) => h.prop).sort()).toEqual(["autocapitalize", "inputmode"]);
  });

  it("caza el idioma correcto también (control del contador de población)", () => {
    const n = cuentaSetAttributeConducta(
      'el.setAttribute("autocapitalize", "off"); el.setAttribute("aria-label", "x");',
      "siembra.ts",
    );
    expect(n).toBe(1);
  });
});

describe("ficha #219 §censo — default-DENY: CERO escrituras IDL a ciegas de pistas de conducta", () => {
  it("el escáner ve una población real de fuentes (anti-censo-vacío)", () => {
    // Si esto enrojece, los directorios se movieron y el censo de abajo sería un verde
    // hueco: re-anclar DIRS_FUENTE antes de tocar nada. Hoy: ~600 en game/src + ~30 en
    // demo-byo/src; suelo holgado.
    expect(ficheros.length).toBeGreaterThanOrEqual(100);
  });

  it("toda pista de conducta se escribe por setAttribute, nunca por propiedad IDL", () => {
    const hallazgos = fuentes.flatMap(({ ruta, src }) => censaEscriturasCiegas(src, ruta));
    const rotulo = hallazgos
      .map((h) => `${h.fichero}:${h.linea} — .${h.prop} = …`)
      .join("\n");
    expect(
      hallazgos,
      `Escritura IDL A CIEGAS de una pista de conducta (ficha #219 — muda en el motor ` +
        `que no lleve la propiedad en el prototipo: autocapitalize falta en WebKit, ` +
        `autocorrect en Chromium, medido 19-08). Usa setAttribute:\n${rotulo}`,
    ).toEqual([]);
  });

  it("la población del idioma correcto existe (anti-verde-hueco del propio censo)", () => {
    // Tras la migración de 19-08: 13 llamadas (faithful-intro 6, deck-nativo 5,
    // creation 2). Suelo holgado: si el escáner dejara de ver los ficheros reales,
    // el censo-cero de arriba pasaría en falso y ESTE aserto lo delata.
    const n = fuentes.reduce(
      (acc, { ruta, src }) => acc + cuentaSetAttributeConducta(src, ruta),
      0,
    );
    expect(n).toBeGreaterThanOrEqual(10);
  });
});
