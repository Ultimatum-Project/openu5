/**
 * LINT: toda spec móvil DECLARA contra qué layout corre — y no hay puerta de atrás.
 *
 * POR QUÉ EXISTE. El 02-08 el layout partido pasó a ser el DEFECTO DE FÁBRICA en táctil.
 * El arnés móvil limpia el localStorage y corre bajo `pointer:coarse`, así que desde ese
 * día arranca en un layout distinto del que sus ~52 llamadas suponen. El primer parche
 * pinchó `reflow=0` DENTRO de `gotoMobile`: dejó la suite verde y **midiendo un layout que
 * ya no es el que ve el usuario**, en silencio. Es la familia de «la ausencia se lee
 * verde»: los tests no fallan, es que **cubren otra cosa**, y su verde tranquiliza igual.
 *
 * El compilador ya obliga a declarar el layout (`gotoMobile(page, layout, …)`, sin
 * defecto). Este lint cierra lo que el compilador NO puede ver: que alguien vuelva a
 * meter la bandera por `extraQuery` y anule la declaración sin que nadie se entere
 * (`URLSearchParams.get` se queda con el PRIMER valor, así que un `reflow=` colado ahí
 * NO gana... y por eso es peor: no rompería nada, sólo mentiría sobre lo que se declara).
 *
 * Corre en la suite de vitest (no en Playwright) porque es ANÁLISIS ESTÁTICO del fuente:
 * cuesta milisegundos y no necesita navegador.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(__dirname, "..", "e2e", "mobile");
const SPECS = readdirSync(DIR).filter((f) => f.endsWith(".spec.ts"));

/** Líneas de código (sin comentarios de línea ni de bloque de una línea). */
function lineasDeCodigo(src: string): { n: number; linea: string }[] {
  return src
    .split("\n")
    .map((linea, i) => ({ n: i + 1, linea }))
    .filter(({ linea }) => !/^\s*(\/\/|\*|\/\*)/.test(linea));
}

const LAYOUTS = ["clasico", "partido", "invariante"] as const;

/**
 * Identificadores declarados como layout por un BUCLE PARAMETRIZADO `as const`:
 *
 *   for (const [layout, vp, papel] of [["partido", …], ["clasico", …]] as const) {
 *     … gotoMobile(page, layout, …) …
 *
 * La forma la estrenó #183 (a9ed1a14) y es declaración de pleno derecho — los literales
 * están unas líneas encima de la llamada y la spec corre TODOS los layouts de la lista:
 * declara MÁS que una línea con literal, no menos. Se absuelve SOLO esta forma exacta
 * (default-deny): array literal de tuplas cuyo PRIMER elemento es un layout válido en
 * TODAS las tuplas, cerrado con `as const` (el tipo estrecho es lo que le da al
 * compilador la unión exhaustiva). Devuelve id → layouts de su lista (para el censo).
 */
function layoutsDeBucle(src: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const re =
    /for\s*\(\s*const\s*\[\s*([A-Za-z_$][\w$]*)[^\]]*\]\s*of\s*\[([\s\S]*?)\]\s*as\s+const\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const primeras = [...m[2]!.matchAll(/\[\s*"([^"]*)"/g)].map((x) => x[1]!);
    if (primeras.length > 0 && primeras.every((l) => (LAYOUTS as readonly string[]).includes(l))) {
      out.set(m[1]!, primeras);
    }
  }
  return out;
}

describe("arnés móvil: el layout se DECLARA, no se hereda", () => {
  it("hay specs móviles que auditar (control: la lista no está vacía)", () => {
    // Sin esto, borrar el directorio dejaría este fichero VERDE afirmando nada.
    // [[guarda-de-existencia-bendice-el-vacio]]
    expect(SPECS.length, "specs móviles encontradas").toBeGreaterThan(4);
  });

  // ── CALIBRACIÓN del absolvedor de bucles: verlo ABSOLVER la forma real de #183 y
  //    ACUSAR sus vecinas degradadas, antes de soltarlo sobre el corpus.
  it("CONTROL: el bucle `as const` de #183 declara; sin `as const` o con intruso, NO", () => {
    const real = `for (const [layout, vp] of [["partido", { w: 1 }], ["clasico", { w: 2 }]] as const) {`;
    expect(layoutsDeBucle(real).get("layout")).toEqual(["partido", "clasico"]);
    // sin `as const` el compilador pierde la unión estrecha → no es la forma declarada
    const sinConst = `for (const [layout, vp] of [["partido", 1], ["clasico", 2]]) {`;
    expect(layoutsDeBucle(sinConst).size).toBe(0);
    // una tupla con primer elemento que NO es layout contamina la lista entera
    const intruso = `for (const [layout] of [["partido"], ["landscape"]] as const) {`;
    expect(layoutsDeBucle(intruso).size).toBe(0);
    // un identificador cualquiera no ligado a un bucle así jamás absuelve
    expect(layoutsDeBucle(`const layout = pick();`).size).toBe(0);
  });

  it("★ TODA llamada a gotoMobile declara su layout: literal en la línea o bucle `as const`", () => {
    const sinDeclarar: string[] = [];
    for (const f of SPECS) {
      const lineas = lineasDeCodigo(readFileSync(join(DIR, f), "utf8"));
      // los bucles se buscan sobre el MISMO texto sin comentarios que se audita, para
      // que un bucle citado en un comentario no pueda absolver a nadie
      const bucles = layoutsDeBucle(lineas.map((l) => l.linea).join("\n"));
      for (const { n, linea } of lineas) {
        if (!linea.includes("gotoMobile(")) continue;
        if (/gotoMobile\(\s*\w+\s*,\s*"(clasico|partido|invariante)"/.test(linea)) continue;
        const id = /gotoMobile\(\s*\w+\s*,\s*([A-Za-z_$][\w$]*)\s*[,)]/.exec(linea);
        if (id && bucles.has(id[1]!)) continue; // #183: declarado por bucle parametrizado
        sinDeclarar.push(`${f}:${n}  ${linea.trim().slice(0, 90)}`);
      }
    }
    expect(
      sinDeclarar,
      "\nLlamada a gotoMobile sin declarar layout. El 2º argumento es OBLIGATORIO y sólo\n" +
        'admite "clasico", "partido" o "invariante" — un literal en la propia línea, o el\n' +
        "identificador de un bucle `for (const [id, …] of [[…]] as const)` de esos literales.\n",
    ).toEqual([]);
  });

  it("★ NADIE cuela `reflow=` por extraQuery (sería una declaración fantasma)", () => {
    const puertaTrasera: string[] = [];
    for (const f of SPECS) {
      for (const { n, linea } of lineasDeCodigo(readFileSync(join(DIR, f), "utf8"))) {
        if (/["'`]reflow=/.test(linea)) puertaTrasera.push(`${f}:${n}  ${linea.trim().slice(0, 90)}`);
      }
    }
    expect(
      puertaTrasera,
      "\n`reflow=` en una spec: el layout va por el parámetro `layout` de gotoMobile, no\n" +
        "por la query. Dos fuentes para la misma decisión es como empezó este lío.\n",
    ).toEqual([]);
  });

  it("la traducción layout→bandera vive en UN solo sitio (deck.ts)", () => {
    const deck = readFileSync(join(DIR, "deck.ts"), "utf8");
    expect(deck).toContain("clasico: \"reflow=0\"");
    expect(deck).toContain("partido: \"reflow=cuadrado\"");
  });

  it("CENSO VIVO: cuántas specs corren hoy contra cada layout", () => {
    // No es un aserto de valor: es el número que la ventana de decisión necesita, y que
    // se pone al día solo. Si mañana se voltean specs al partido, esta cifra lo dice.
    const cuenta = { clasico: 0, partido: 0, invariante: 0 };
    for (const f of SPECS) {
      const lineas = lineasDeCodigo(readFileSync(join(DIR, f), "utf8"));
      const bucles = layoutsDeBucle(lineas.map((l) => l.linea).join("\n"));
      for (const { linea } of lineas) {
        const m = /gotoMobile\(\s*\w+\s*,\s*"(clasico|partido|invariante)"/.exec(linea);
        if (m) {
          cuenta[m[1] as "clasico" | "partido" | "invariante"]++;
          continue;
        }
        // una llamada parametrizada por bucle CORRE una vez por layout de su lista:
        // el censo cuenta lo que corre, no lo que está escrito en una sola línea
        const id = linea.includes("gotoMobile(")
          ? /gotoMobile\(\s*\w+\s*,\s*([A-Za-z_$][\w$]*)\s*[,)]/.exec(linea)
          : null;
        if (id && bucles.has(id[1]!)) {
          for (const l of bucles.get(id[1]!)!) cuenta[l as "clasico" | "partido" | "invariante"]++;
        }
      }
    }
    expect(
      cuenta.clasico + cuenta.partido + cuenta.invariante,
      "toda llamada cae en un layout declarado",
    ).toBeGreaterThan(50);
    // Se afirma el TOTAL, no el reparto: el reparto es justo lo que la ventana moverá.
  });
});
