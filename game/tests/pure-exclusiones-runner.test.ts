/**
 * ★★ GUARDA MECÁNICO del CI público — VERSIÓN 2, y la regla que codifica ES OTRA.
 *
 * LO QUE ESTA GUARDA DECÍA HASTA HOY (derogado, no borrado). El árbol público no lleva
 * `game/assets` (material de EA: `genesis-publico.sh` hace `copy game --exclude assets/`), y
 * `e2e/grandtour/nav-graph.ts` hacía `readFileSync(assets/maps/smallmaps.json)` **en carga de
 * módulo**. Como `espejo-tour/runner.ts:27` importa `../grandtour/nav` → `nav-graph`, cualquier
 * test que importase el runner —importase de él lo que importase— caía ENTERO por ENOENT. La
 * guarda v1 exigía, por eso, que *todo test que importe el runner esté excluido de `test:pure`*.
 *
 * POR QUÉ YA NO ES CIERTO. La lectura es ahora PEREZOSA (`nav-graph.ts`, `smallmaps()`): importar
 * el runner ya no toca `assets/`. Medido en árbol desnudo (worktree detached SIN `game/assets` +
 * `test:pure`): de los 16 ficheros que la vieja regla mantenía fuera, **13 pasan** y sólo 3 siguen
 * cayendo, los 3 por causa PROPIA y ajena a esta cadena (dos leen `assets/data.json` ellos mismos;
 * el tercero es el test DEL grafo). Mantener la regla v1 sería exigir exclusiones que ya no hacen
 * falta.
 *
 * LO QUE ESTA GUARDA DICE AHORA, que es lo que protege esos 13: **ningún módulo del cierre de
 * imports del runner puede leer `assets/` en carga de módulo**. Es la MISMA familia de causas,
 * dicha del lado del defecto en vez del lado del síntoma, y es estrictamente más ancha: caza la
 * reintroducción de un `readFileSync` eager en CUALQUIERA de los 32 módulos del cierre, no sólo
 * en el que hoy conocemos. Si alguien lo reintroduce, los 13 vuelven a caer en silencio; esta
 * guarda se pone roja NOMBRANDO fichero y línea.
 *
 * ALCANCE, dicho para no venderlo de más: cubre la cadena del runner. Los ENOENT por leer un
 * asset DIRECTAMENTE desde el test (`assets/data.json`, `assets/npcs.json`) NO los ve esta
 * guarda. 🔴 Y hasta el 25-08 la frase que aquí ponía —«siguen exigiendo la sonda de 17 s en
 * cada aterrizaje que añada tests»— describía un gesto MANUAL que se dejó de hacer: entre el
 * 02-08 y el 25-08 entraron 49 ficheros por ese hueco y el CI público quedó rojo veinte días.
 * Hoy esa mitad la cubre `re/tools/sonda_pure_publico.sh` (los cuatro jobs del CI público
 * sobre el árbol del génesis, 52 s) y está DENTRO de `bateria_aterrizaje.sh`.
 * [[control-negativo-enumera-lo-que-se-le-ocurrio-al-autor]]
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const GAME = fileURLToPath(new URL("..", import.meta.url));
const RUNNER = join(GAME, "e2e", "espejo-tour", "runner.ts");

/**
 * ⚠ MULTILÍNEA A PROPÓSITO. El detector de la guarda v1 era `^\s*import[^\n]*from "…"` y por eso
 * NO veía la forma `import {\n  …\n} from "…"`: se dejaba fuera a `espejo-routes` y
 * `espejo-ledger`, DOS de los 14 importadores reales del runner. Estaban excluidos por otra vía,
 * así que la v1 daba verde sin ver el 14 % de su población. Aquí el `[\s\S]*?` es el arreglo.
 */
const IMPORT_FROM = /(?:^|\n)\s*(?:import|export)\b[\s\S]*?from\s+["']([^"']+)["']/g;
const IMPORT_DINAMICO = /import\(\s*["']([^"']+)["']/g;

/** Resuelve un especificador RELATIVO a fichero real (el `.js` del import TS → `.ts` en disco). */
function resolveSpec(spec: string, from: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(from), spec).replace(/\.js$/, "");
  for (const cand of [base + ".ts", base + ".tsx", base + ".js", join(base, "index.ts")]) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

/**
 * Cierre transitivo de imports ESTÁTICOS. Los `import()` DINÁMICOS se recogen aparte y NO entran:
 * su cuerpo no corre en carga de módulo, que es justo la propiedad que aquí se mide.
 */
function cierreEstatico(root: string): string[] {
  const visto = new Set<string>();
  const pila = [root];
  while (pila.length) {
    const f = pila.pop()!;
    if (visto.has(f)) continue;
    visto.add(f);
    const src = readFileSync(f, "utf8");
    IMPORT_FROM.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = IMPORT_FROM.exec(src))) {
      const r = resolveSpec(m[1]!, f);
      if (r) pila.push(r);
    }
  }
  return [...visto].sort();
}

/**
 * Fuente sin cadenas ni comentarios: para contar llaves sin que un `{` literal desnivele.
 *
 * 🔴 CONSERVA LOS SALTOS DE LÍNEA, y esto NO es cosmética — es el defecto que un mutante destapó.
 * La primera versión borraba los bloques `/* … *\/` enteros; como los JSDoc de `nav-graph.ts`
 * ocupan 10-15 líneas, la fuente despellejada quedaba DESALINEADA de la original y tanto el
 * número de línea como la profundidad de llaves se contaban sobre la línea equivocada. Resultado:
 * al reintroducir a mano la lectura EAGER en `nav-graph.ts`, la guarda seguía VERDE. El control
 * positivo no lo vio porque era un snippet sintético SIN comentario de bloque delante: no tenía
 * la FORMA del fichero real. [[control-positivo-no-cubre-la-forma]]
 */
function despellejar(src: string): string {
  const enBlanco = (m: string): string => m.replace(/[^\n]/g, " ");
  return src
    .replace(/\/\*[\s\S]*?\*\//g, enBlanco)
    .replace(/\/\/[^\n]*/g, "")
    .replace(/`(?:\\.|[^`\\])*`/g, enBlanco)
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''");
}

/**
 * Lecturas de fichero a NIVEL SUPERIOR (profundidad de llaves 0 = corren al importar). Devuelve
 * las líneas con su texto ORIGINAL (para que el rojo se lea), midiendo la profundidad sobre la
 * versión despellejada.
 */
export function lecturasEnCargaDeModulo(src: string): Array<{ linea: number; texto: string }> {
  const crudas = src.split("\n");
  const limpias = despellejar(src).split("\n");
  const out: Array<{ linea: number; texto: string }> = [];
  let prof = 0;
  for (let i = 0; i < limpias.length; i++) {
    const l = limpias[i]!;
    if (prof === 0 && /\b(?:readFileSync|readdirSync)\s*\(/.test(l) && !/^\s*import\b/.test(l)) {
      out.push({ linea: i + 1, texto: crudas[i]!.trim() });
    }
    for (const ch of l) {
      if (ch === "{") prof++;
      else if (ch === "}") prof--;
    }
  }
  return out;
}

/** ¿La línea de lectura apunta a `assets/` (lo que NO viaja) y no a `src/` (que sí)? */
const APUNTA_A_ASSETS = (texto: string): boolean => /["']assets["']|assets\//.test(texto);

describe("CI público — la cadena de imports del runner NO puede leer assets/ en carga de módulo", () => {
  const cierre = cierreEstatico(RUNNER);

  it("★★ ningún módulo del cierre del runner lee assets/ al importarse (si no, 13 tests salen del CI público)", () => {
    const culpables: string[] = [];
    for (const f of cierre) {
      for (const { linea, texto } of lecturasEnCargaDeModulo(readFileSync(f, "utf8"))) {
        if (APUNTA_A_ASSETS(texto)) culpables.push(`${f.replace(GAME, "")}:${linea}  ${texto}`);
      }
    }
    expect(
      culpables,
      "estas lecturas corren AL IMPORTAR y apuntan a game/assets, que no viaja al árbol público: " +
        "todo test que importe e2e/espejo-tour/runner.ts caerá entero por ENOENT en el CI público. " +
        "Difiere la lectura (memoizada, como `smallmaps()` en nav-graph.ts) o excluye los tests " +
        "afectados de game/vitest.pure.config.ts con su motivo.",
    ).toEqual([]);
  });

  it("CONTROL DE POBLACIÓN: el cierre tiene módulos de verdad (si no, el verde no valdría nada)", () => {
    // Medido el 02-08: 32 módulos. Se pide orden de magnitud para que no roce con cada alta.
    // Sin esto, un `resolveSpec` roto daría un cierre de 1 fichero y verde por construcción.
    expect(cierre.length).toBeGreaterThanOrEqual(20);
    expect(cierre.some((f) => f.endsWith("grandtour/nav-graph.ts"))).toBe(true);
    expect(cierre.some((f) => f.endsWith("grandtour/nav.ts"))).toBe(true);
  });

  it("CONTROL POSITIVO — el detector caza la forma REAL que tenía el defecto, COMENTARIO DE BLOQUE INCLUIDO", () => {
    // Texto con la FORMA de nav-graph.ts antes de este carril: JSDoc MULTILÍNEA (con llaves y
    // rutas dentro, que es lo que despistaba) y DESPUÉS la lectura eager. Si el detector no lo
    // marcase —o lo marcase en la línea equivocada— el verde de arriba no probaría nada: es
    // exactamente el mutante que sobrevivió a la primera versión de esta guarda.
    // [[controles-opuestos-calibrar-detector]] [[control-positivo-no-cubre-la-forma]]
    const ANTES = [
      "/**", // 1
      " * Grand Tour — GRAFO DE COMPONENTES. Módulo PURO.", // 2
      " * NODO = componente conexo { floor, comp } de UNA planta.", // 3
      " * Lee el mapa ESTÁTICO `assets/maps/smallmaps.json`.", // 4
      " */", // 5
      'import { readFileSync } from "node:fs";', // 6
      "const HERE = dirname(fileURLToPath(import.meta.url));", // 7
      "const SMALLMAPS = JSON.parse(", // 8
      '  readFileSync(join(HERE, "..", "..", "assets", "maps", "smallmaps.json"), "utf8"),', // 9
      ") as Array<{ id: number }>;", // 10
    ].join("\n");
    const hits = lecturasEnCargaDeModulo(ANTES);
    expect(hits).toHaveLength(1);
    expect(APUNTA_A_ASSETS(hits[0]!.texto)).toBe(true);
    // El NÚMERO DE LÍNEA es parte del veredicto: si el despellejado come saltos de línea, aquí
    // sale 5 en vez de 9 y el rojo señalaría al comentario.
    expect(hits[0]!.linea).toBe(9);
  });

  it("CONTROL NEGATIVO — la forma PEREZOSA no se marca, y la eager a src/ no es culpable", () => {
    const PEREZOSA = [
      "let cache = null;",
      "function smallmaps() {",
      '  return (cache ??= JSON.parse(readFileSync(join(HERE, "..", "assets", "maps", "smallmaps.json"), "utf8")));',
      "}",
    ].join("\n");
    expect(lecturasEnCargaDeModulo(PEREZOSA)).toEqual([]);
    // Eager pero a `src/core/data/`, que SÍ viaja: se ve como lectura, y NO como culpable.
    const EAGER_SRC = 'const T = JSON.parse(readFileSync(join(HERE, "..", "src", "core", "data", "TileData.json"), "utf8"));';
    expect(lecturasEnCargaDeModulo(EAGER_SRC)).toHaveLength(1);
    expect(APUNTA_A_ASSETS(EAGER_SRC)).toBe(false);
  });

  it("CONTROL DEL DETECTOR DE IMPORTS: resuelve la forma MULTILÍNEA que la guarda v1 no veía", () => {
    // El punto ciego que destapó este carril: `espejo-routes` y `espejo-ledger` importan el runner
    // con el `from` en línea propia; un detector de una sola línea se los deja.
    // [[la-lista-del-encargo-hereda-el-punto-ciego-del-auditor]]
    const MULTI = 'import {\n  diffSegment,\n  loadRoute,\n} from "../e2e/espejo-tour/runner";';
    IMPORT_FROM.lastIndex = 0;
    expect(IMPORT_FROM.exec(MULTI)?.[1]).toBe("../e2e/espejo-tour/runner");
    // y el dinámico se reconoce (justamente para NO meterlo en el cierre estático).
    IMPORT_DINAMICO.lastIndex = 0;
    expect(IMPORT_DINAMICO.exec('const m = await import("./nav-graph");')?.[1]).toBe("./nav-graph");
  });
});

/**
 * ★★ SEGUNDA GUARDA (25-08, carril `censo-puro-drift`): **la lista de exclusiones no puede
 * llevar entradas MUERTAS**, y no es higiene — es un agujero por el que se re-abre el
 * defecto que este fichero vigila.
 *
 * Medido el 25-08: `game/vitest.pure.config.ts` excluía `tests/exploration.test.ts` y
 * `tests/journal.test.ts`, que **no existen en el árbol**. Una línea muerta no molesta a
 * nadie… hasta que la causa de la muerte es un RENOMBRADO: entonces el fichero sigue
 * leyendo dato del juego, la exclusión apunta al nombre viejo, el nombre nuevo entra a
 * `test:pure` sin que nadie decida nada, y el CI público se pone rojo. La lista es
 * default-ALLOW (lo que no está, corre), así que perder una entrada es perder la decisión.
 *
 * ★ Es la mitad BARATA (0,1 s) del par que cierra la deriva. La otra mitad es
 * `re/tools/sonda_pure_publico.sh`, que corre los cuatro jobs del CI público sobre el
 * árbol del génesis (52 s) y caza el caso general: un test NUEVO que lee dato del juego.
 * Esta guarda no lo sustituye — caza antes, y con el nombre del fichero en la primera
 * línea, la clase concreta que un `grep` humano no ve.
 */
describe("CI público — la lista de exclusiones de test:pure no lleva entradas muertas", () => {
  const CONFIG = join(GAME, "vitest.pure.config.ts");
  /** Las entradas `"tests/x.test.ts",` del array `exclude`, una por línea. */
  const excluidos = (
    readFileSync(CONFIG, "utf8").match(/^\s+"(tests\/[\w.-]+\.test\.ts)",$/gm) ?? []
  ).map((l) => l.trim().replace(/^"|",$/g, ""));

  it("control positivo: el detector VE la lista (si diera 0, el aserto de abajo pasaría vacío)", () => {
    // Un predicado de ausencia sin control positivo firma verde cuando su regex deja de casar.
    expect(excluidos.length).toBeGreaterThan(100);
    expect(new Set(excluidos).size, "hay entradas DUPLICADAS en la lista").toBe(excluidos.length);
  });

  it("★★ toda entrada excluida corresponde a un fichero que EXISTE", () => {
    const muertas = excluidos.filter((rel) => !existsSync(join(GAME, rel)));
    expect(
      muertas,
      `entradas muertas en vitest.pure.config.ts: ${muertas.join(", ")}. ` +
        "Si el fichero se BORRÓ, borra su línea. Si se RENOMBRÓ, mueve la exclusión al " +
        "nombre nuevo: el nuevo está corriendo en el CI público ahora mismo.",
    ).toEqual([]);
  });
});
