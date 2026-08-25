/**
 * #331 — GUARDA DEL CENSO DE CONSTS IMPORTADAS EN SINKS (default-DENY).
 *
 * CLASE QUE MATA (#331, de vinos-325; 4ª instancia de #53): la cadena user-facing que
 * llega a un sink por CONSTANTE IMPORTADA era invisible a las TRES guardas del
 * trinquete anti-fabricación, cada una por su propio diseño:
 *   - string-manifest.test.ts: el `resolve()` del extractor sólo sigue consts LOCALES
 *     (limitación declarada en su cabecera) — el sink aflora nada.
 *   - display-consts-censo.test.ts (#276): censa DECLARACIONES con inicializador
 *     objeto/array — una const string plana, o el USO remoto, no son candidatos.
 *   - shell-files-censo.test.ts: censa EMISORES — el módulo que sólo exporta la const
 *     no tiene sink, y el fichero con el sink no aflora el valor.
 * MEDIDO 2026-08-20 (adjudicación de cabos-baratos 19-08 re-verificada sobre este
 * árbol): const exportada en fichero nuevo + `events.push({text: SEED})` en otro
 * fichero de core → 14/14 verdes en las tres guardas; la MISMA cadena como const
 * local → string-manifest ROJA nombrándola (control positivo del instrumento).
 *
 * DISEÑO (calcado de #276). El censo se DERIVA del código (`censusImportedSinkConsts`:
 * los MISMOS sinks del extractor en modo "imports" — no una heurística aparte — sobre
 * la MISMA población core+shell; identificador no resoluble localmente y presente en
 * un ImportDeclaration del fichero) y este test exige que CADA fila esté clasificada:
 *   1. nombre en `DISPLAY_CONST_NAMES` (su declaración entra al manifiesto; el censo
 *      #276 vela por que siga viva), o
 *   2. nombre en `EXCLUDED_DISPLAY_CONSTS` (ya razonado en el ledger de #276), o
 *   3. EXENTA MECÁNICAMENTE por VALOR: la declaración de origen se resolvió
 *      estáticamente (`resolved`) y TODOS sus strings no-técnicos ya afloran por otra
 *      vía de `extractUserStrings` — incluye el caso «sin literal alfabético» (consts
 *      de números/glifos: nada fabricable en esa declaración). Si la otra vía
 *      desaparece, la exención desaparece con ella, o
 *   4. entrada RAZONADA en `EXCLUDED_IMPORTED_SINK_CONSTS` ([interna]/[deuda]/[decision]).
 * Una const importada nueva sin clasificar → ROJO nombrándola con sitio y origen.
 *
 * Y la ranciedad es aserto en AMBOS sentidos (trinquete): una entrada del ledger cuyo
 * nombre ya no llega a ningún sink → ROJO para retirarla; una [deuda] que SANÓ (sus
 * strings pasaron a aflorar por otra vía) → ROJO para retirarla — la lista sólo encoge.
 *
 * ESTRENADO EN ROJO (2026-08-20): sembrado `core/world/seed-331-strings.ts`
 * (`SEED_331_MSG`) + sink importador en `core/world/seed-331-sink.ts`; las tres
 * guardas viejas VERDES ignorándolo (el control) y el aserto 1 de ésta ROJO nombrando
 * `SEED_331_MSG` con su sitio y su valor. Siembra retirada.
 */
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  censusImportedSinkConsts,
  EXCLUDED_IMPORTED_SINK_CONSTS,
  DISPLAY_CONST_NAMES,
  EXCLUDED_DISPLAY_CONSTS,
  extractUserStrings,
  shellFiles,
} from "../tools/extract-user-strings.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE = join(HERE, "..", "src", "core");
const SHELL = shellFiles(join(HERE, "..", "src")) as string[];

type Row = { name: string; froms: string[]; locs: string[]; strings: string[]; resolved: boolean };
const census = censusImportedSinkConsts(CORE, SHELL) as Row[];
const listed = new Set(DISPLAY_CONST_NAMES as string[]);
const excl276 = EXCLUDED_DISPLAY_CONSTS as Record<string, string>;
const excluded = EXCLUDED_IMPORTED_SINK_CONSTS as Record<string, string>;

const live = extractUserStrings(CORE, SHELL) as Map<string, string>;
const mechanic = (c: Row) => c.resolved && c.strings.every((s) => live.has(s));

describe("#331 censo de consts importadas en sinks — default-DENY", () => {
  it("toda const importada que llega a un sink está clasificada", () => {
    const unclassified = census.filter(
      (c) => !listed.has(c.name) && !(c.name in excl276) && !(c.name in excluded) && !mechanic(c),
    );
    if (unclassified.length > 0) {
      throw new Error(
        `\n${unclassified.length} const(s) importada(s) llegan a un sink user-facing SIN clasificar ` +
          `(la cadena que transportan es INVISIBLE al trinquete anti-fabricación — la clase #331):\n` +
          unclassified
            .map(
              (c) =>
                `  ${c.name}  ${c.locs[0]}  from=${c.froms[0]}  ej=${JSON.stringify(c.strings[0] ?? "(sin literal legible)").slice(0, 60)}`,
            )
            .join("\n") +
          `\n\nClasifícala en tools/extract-user-strings.mjs: si su contenido es user-facing, ` +
          `CÚRALA (que el valor aflore por una vía extraída y entre al manifiesto con cita) — ` +
          `NO apuntes [deuda] nueva; si no es texto del juego, entrada razonada en ` +
          `EXCLUDED_IMPORTED_SINK_CONSTS ([interna]/[decision]).\n`,
      );
    }
    expect(unclassified).toEqual([]);
  });

  it("ninguna entrada del ledger está rancia: su nombre sigue en el censo Y sigue necesitándola", () => {
    const byName = new Map(census.map((c) => [c.name, c]));
    const gone = Object.keys(excluded).filter((n) => !byName.has(n));
    expect(gone, `entradas cuyo nombre ya no llega a ningún sink (retíralas): ${gone.join(", ")}`).toEqual([]);
    // Trinquete: una [deuda] que SANÓ (ya aflora por otra vía) se retira, no se acumula.
    const healed = Object.keys(excluded).filter((n) => {
      const c = byName.get(n);
      return c !== undefined && (listed.has(n) || mechanic(c));
    });
    expect(healed, `entradas que ya no hacen falta (sanaron por otra vía — retíralas): ${healed.join(", ")}`).toEqual([]);
  });

  it("el ledger es disjunto de las clasificaciones de #276 y toda entrada lleva categoría razonada", () => {
    const doubly = Object.keys(excluded).filter((n) => listed.has(n) || n in excl276);
    expect(doubly, `nombres clasificados DOS veces (aquí y en #276): ${doubly.join(", ")}`).toEqual([]);
    const badReason = Object.entries(excluded)
      .filter(([, r]) => !/^\[(interna|deuda|decision)\] .{10,}/.test(r))
      .map(([n]) => n);
    expect(badReason, `entradas sin prefijo [interna]/[deuda]/[decision] o sin razón: ${badReason.join(", ")}`).toEqual([]);
  });

  it("control positivo del censo: la población medida no colapsa (≥35 filas, ≥15 listadas, ≥12 mecánicas)", () => {
    // Si el predicado estructural se rompe (el modo "imports" deja de aflorar, la
    // resolución de módulos deja de leer, o el mapa de imports queda vacío), los
    // asertos de arriba pasarían EN VERDE sin medir nada. Cifras de 2026-08-20 sobre
    // main 45dcc800 + esta guarda: 41 filas = 18 listadas + 1 en ledger #276 +
    // 16 mecánicas + 6 [deuda] de este ledger. Tras la cura de las 6 (carril
    // fix-deudas, mismo día): 41 filas = 18 listadas + 1 en ledger #276 + 22
    // mecánicas (las 6 curadas afloran por STRING_CONST_NAMES) + 0 deudas.
    expect(census.length).toBeGreaterThanOrEqual(35);
    const listedRows = census.filter((c) => listed.has(c.name)).length;
    expect(listedRows).toBeGreaterThanOrEqual(15);
    // El suelo de MECÁNICAS vigila además la resolución de módulos: si
    // `moduleConstStrings`/`resolveImportPath` se rompen, `resolved` cae a false en
    // bloque y esta cifra colapsa antes de que una deuda pase inadvertida.
    const mechRows = census.filter((c) => !listed.has(c.name) && !(c.name in excl276) && mechanic(c)).length;
    expect(mechRows).toBeGreaterThanOrEqual(12);
  });
});
