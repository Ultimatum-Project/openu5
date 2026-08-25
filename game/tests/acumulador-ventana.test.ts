/**
 * #26 — GUARDA del acumulador de validación-ventana (`docs/qa/acumulador-ventana.md`).
 *
 * POR QUÉ EXISTE. Durante semanas ~20 actas entregaron su pendiente escribiendo «entra en
 * la lista de re-sello de #222». Esa lista NUNCA se materializó, y cuando #222 se cerró
 * las citas quedaron apuntando a una tarjeta muerta: cada acta creía haber entregado, y no
 * había receptor. Un fichero de registro sin guarda habría repetido el defecto más
 * despacio — envejeciendo en silencio en vez de no existir.
 *
 * QUÉ COMPRUEBA, en las dos direcciones (las dos hacen falta):
 *   · un fichero con marca viva que NO esté registrado  ⇒ ROJO (el registro se quedó corto);
 *   · una entrada registrada que ya NO tenga marca      ⇒ ROJO (entrada muerta que infla
 *     la cifra; mismo criterio que `seed_gate` con las declaraciones caducadas).
 *
 * SE SIGUE POR FICHERO, NO POR LÍNEA. Los números de línea caducan al primer retoque de
 * prosa; la tabla se vuelve mentira sin que nadie la toque.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const REGISTRO = join(RAIZ, "docs/qa/acumulador-ventana.md");

/** Las marcas con que una nota o un spec declara «esto espera ventana e2e». */
const MARCAS = [
  "entra en la lista de re-sello",
  "entra en lo que la ventana",
  "mueve digests",
  "mueve el stream",
  "ESCRITO SIN CORRER",
  "pendiente de ventana",
  "cuando haya ventana",
  "PENDIENTE-VALIDACIÓN-VENTANA",
];

/**
 * ★ POLARIDAD. La marca hay que leerla CON SIGNO: `nav.ts:1649` dice «así un fix de un
 * capítulo **NO** mueve el stream RNG de otros» — es la afirmación CONTRARIA, y un
 * detector que sólo busque la frase lo acusa de estar esperando ventana cuando dice
 * justo que no. Lo cazó esta guarda en su primera corrida.
 */
const NEGACION = /\bno\s+(?:lo\s+)?(?:mueve|mueven|entra|entran)\b/i;

/** Dónde se busca. El propio registro y su guarda quedan fuera (se citan a sí mismos). */
const AMBITOS = ["re/notes", "docs/auditorias", "game/e2e"];
const EXCLUIDOS = ["docs/qa/acumulador-ventana.md", "game/tests/acumulador-ventana.test.ts"];

function ficheros(dir: string, acc: string[] = []): string[] {
  let entradas: string[];
  try {
    entradas = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const e of entradas) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) ficheros(p, acc);
    else if (/\.(md|ts)$/.test(e)) acc.push(p);
  }
  return acc;
}

/** ¿La línea lleva una marca VIVA (marca presente y no negada)? */
export function lineaMarcada(linea: string): boolean {
  return MARCAS.some((m) => linea.includes(m)) && !NEGACION.test(linea);
}

/**
 * ★ TERCER EJE: EL SUJETO. Presencia y POLARIDAD no bastan.
 *
 * 🔴 CASO REAL (06-08-2026, `re/notes/pirata-35-acta.md`): la línea decía «…y
 * `world/loops/spawn.ts` — un fix que **mueve el stream** por diseño». Marca presente,
 * afirmativa y VERDADERA — pero su SUJETO es un fichero de OTRO carril, citado como
 * contexto. El acta que la contiene no esperaba ventana ninguna: la suya ya se había
 * corrido en verde.
 *
 * Por qué aparece justo en los documentos BUENOS: citar el trabajo ajeno es lo que hace
 * honesta un acta — cuanto mejor explicas por qué una medida no valía, más ficheros
 * nombras que no son tuyos, y más marcas heredas. El detector castigaba la prosa que más
 * contexto da.
 *
 * ⚠️ ESTO NO CAMBIA LA PERTENENCIA, a propósito: el fichero SIGUE teniendo que estar
 * registrado (default-deny intacto). Lo que habilita es DECLARAR la excepción por escrito
 * — y el aserto de abajo comprueba que quien la declara no la esté usando para silenciar
 * algo que sí espera.
 */
export function sujetoAjeno(linea: string, rutaPropia: string): boolean {
  if (!lineaMarcada(linea)) return false;
  const propio = rutaPropia.split("/").pop() ?? rutaPropia;
  for (const m of linea.matchAll(/`([\w.-]+\/[\w./-]+\.(?:ts|tsx|mjs|js|md|json))`/g)) {
    const citado = m[1]!;
    if (!citado.endsWith(propio) && !rutaPropia.endsWith(citado)) return true;
  }
  return false;
}

/**
 * Ficheros con alguna marca viva, en ruta relativa a la raíz del repo.
 *
 * MEMOIZADO a propósito: el barrido lee cientos de ficheros y repetirlo por test hacía
 * saltar el timeout de 5 s de vitest bajo la carga de la suite completa (sola tardaba
 * 2,5 s). Una pasada, compartida por los cuatro asertos.
 */
let cacheMarcados: string[] | null = null;
function marcados(): string[] {
  if (cacheMarcados) return cacheMarcados;
  const out = new Set<string>();
  for (const ambito of AMBITOS) {
    for (const f of ficheros(join(RAIZ, ambito))) {
      const rel = relative(RAIZ, f);
      if (EXCLUIDOS.includes(rel)) continue;
      if (readFileSync(f, "utf8").split("\n").some(lineaMarcada)) out.add(rel);
    }
  }
  cacheMarcados = [...out].sort();
  return cacheMarcados;
}

/** Rutas citadas en el registro (en `backticks`), tal cual las escribe la prosa. */
function registradas(): string[] {
  const md = readFileSync(REGISTRO, "utf8");
  // SÓLO la zona entre centinelas. La prosa de fuera puede citar rutas para explicarse
  // (p. ej. el ejemplo de falso positivo) sin darlas de alta por accidente.
  const zona = /ACUMULADOR:INICIO([\s\S]*?)ACUMULADOR:FIN/.exec(md);
  if (!zona) throw new Error("el acumulador ha perdido sus centinelas ACUMULADOR:INICIO/FIN");
  const out = new Set<string>();
  for (const m of zona[1]!.matchAll(/`((?:re\/notes|docs|game)\/[^`]+?\.(?:md|ts))`/g)) {
    if (!EXCLUIDOS.includes(m[1]!)) out.add(m[1]!);
  }
  return [...out].sort();
}

describe("#26 — acumulador de validación-ventana", () => {
  it("CONTROL DE POBLACIÓN: el barrido ve ficheros y el registro tiene entradas", () => {
    // Sin esto, vaciar cualquiera de los dos lados daría verde por vacío — la familia
    // «vaciar la entrada es vaciar todos sus productores».
    expect(marcados().length, "el barrido tiene que encontrar marcas").toBeGreaterThan(10);
    expect(registradas().length, "el registro tiene que tener entradas").toBeGreaterThan(10);
  });

  it("CONTROL: las marcas discriminan (un texto sin marca no entra)", () => {
    expect(lineaMarcada("Esta acta no espera nada: se midió, se adjudicó y se cerró.")).toBe(false);
    expect(lineaMarcada("⚠ El arreglo mueve digests de combate ⇒ re-sello.")).toBe(true);
  });

  it("CONTROL DE POLARIDAD: la marca NEGADA no cuenta", () => {
    // Caso real cazado por esta guarda en su primera corrida (`grandtour/nav.ts`): dice lo
    // CONTRARIO de lo que el detector ingenuo entendía.
    expect(lineaMarcada("Así un fix de un capítulo NO mueve el stream RNG de otros.")).toBe(false);
    expect(lineaMarcada("El ERRANTE mueve el stream RNG en cada paso.")).toBe(true);
  });

  it("todo fichero con marca viva está REGISTRADO en el acumulador", () => {
    const faltan = marcados().filter((f) => !registradas().includes(f));
    expect(faltan, `añádelos a ${relative(RAIZ, REGISTRO)} con una línea que diga qué esperan`).toEqual([]);
  });

  it("CONTROL DE SUJETO: la marca cuyo sujeto es OTRO fichero se distingue", () => {
    // El caso real, literal, del acta del pirata.
    const linea = "AD** (`ad11`, `ad20`) y **`world/loops/spawn.ts`** — un fix que mueve el stream por diseño.";
    expect(sujetoAjeno(linea, "re/notes/pirata-35-acta.md")).toBe(true);
    // CONTROL DE DIENTES 1: la misma frase, si el sujeto ES el fichero que la contiene,
    // NO es ajena — si no, el eje nuevo taparía marcas legítimas, que es peor que no tenerlo.
    expect(sujetoAjeno(linea, "game/src/core/world/loops/spawn.ts")).toBe(false);
    // CONTROL DE DIENTES 2: sin cita de fichero no hay sujeto ajeno que valga.
    expect(sujetoAjeno("Este spec ESCRITO SIN CORRER espera ventana.", "game/e2e/x.spec.ts")).toBe(false);
    // CONTROL DE DIENTES 3: sin marca viva, el eje ni se plantea.
    expect(sujetoAjeno("Ver `world/loops/spawn.ts` para el detalle.", "re/notes/x.md")).toBe(false);
  });

  it("una exención por SUJETO AJENO no puede silenciar algo que SÍ espera", () => {
    /**
     * 🔴 EL RIESGO DEL EJE NUEVO, y por eso este aserto existe: en cuanto se puede escribir
     * «NO espera ventana» en el registro, esa frase sirve para callar una marca legítima.
     * Aquí se comprueba lo contrario de lo cómodo: **toda entrada que se declare exenta
     * tiene que tener TODAS sus marcas vivas con sujeto ajeno.** Si una sola es propia, la
     * exención es falsa y esto se pone rojo nombrando el fichero.
     */
    const md = readFileSync(REGISTRO, "utf8");
    const zona = /ACUMULADOR:INICIO([\s\S]*?)ACUMULADOR:FIN/.exec(md)![1]!;
    const abusos: string[] = [];
    for (const bloque of zona.split(/\n(?=- )/)) {
      if (!/NO espera ventana/i.test(bloque)) continue;
      const ruta = /`((?:re\/notes|docs|game)\/[^`]+?\.(?:md|ts))`/.exec(bloque)?.[1];
      if (!ruta) continue;
      let propias = 0;
      for (const linea of readFileSync(join(RAIZ, ruta), "utf8").split("\n")) {
        if (lineaMarcada(linea) && !sujetoAjeno(linea, ruta)) propias++;
      }
      if (propias > 0) abusos.push(`${ruta} (${propias} marca(s) con sujeto PROPIO)`);
    }
    expect(abusos, "se declaran exentas pero tienen marcas propias — la exención es falsa").toEqual([]);
  });

  it("toda entrada del acumulador sigue teniendo marca (sin entradas muertas)", () => {
    const muertas = registradas().filter((f) => !marcados().includes(f));
    expect(muertas, "ya no esperan ventana: retíralas del acumulador con su nota").toEqual([]);
  });
});
