/**
 * #276 — GUARDA DEL CENSO DE CONSTANTES-DISPLAY (default-DENY).
 *
 * CLASE QUE MATA (2ª instancia de #53): `extract-user-strings.mjs` reconocía los objetos
 * de corpus por una LISTA DE NOMBRES escrita a mano (`DISPLAY_CONSTS`) — todo objeto de
 * corpus NUEVO nacía INVISIBLE al trinquete anti-fabricación: sus strings ni entraban al
 * manifiesto ni enrojecían nada (les pasó a SHRINE_UI/WELL_UI/BLACKTHORN_UI en #268).
 *
 * DISEÑO. El censo de candidatos ahora se DERIVA del código (`censusDisplayCandidates`:
 * declaración MAYÚSCULAS con inicializador objeto/array y ≥1 string alfabético, misma
 * población que el extractor) y este test exige que CADA candidato esté clasificado:
 *   1. en `DISPLAY_CONST_NAMES` (sus strings entran al manifiesto), o
 *   2. EXENTO MECÁNICAMENTE: todos sus strings ya afloran por otra vía de
 *      `extractUserStrings` (sink text:/push/return/t()/tf() que resuelve `ARR[i]`
 *      local). La exención no caduca mal: si esa otra vía desaparece, la exención
 *      desaparece con ella y este test enrojece. (Es por VALOR: un duplicado exacto de
 *      strings ya extraídos queda exento; si luego diverge, enrojece.), o
 *   3. en `EXCLUDED_DISPLAY_CONSTS` con razón prefijada [interna]/[deuda]/[decision].
 * Un objeto nuevo sin clasificar → ROJO nombrándolo con fichero:línea (aserto 1).
 *
 * Y el AVISO histórico del extractor («renombrar una tabla listada rompe la extracción
 * en silencio», ficha consumidor-por-nombre 2026-08-06) pasa de prosa a aserto: un
 * nombre listado o excluido que ya no exista en el código → ROJO (asertos 2 y 3).
 *
 * ESTRENADO EN ROJO (2026-08-18): sembrado `SEED_276_UI` en core/game.ts, la guarda
 * vieja (string-manifest.test.ts) quedó VERDE ignorándolo y este aserto 1 ROJO
 * nombrándolo con su loc. Siembra retirada.
 */
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  censusDisplayCandidates,
  DISPLAY_CONST_NAMES,
  EXCLUDED_DISPLAY_CONSTS,
  extractUserStrings,
  shellFiles,
} from "../tools/extract-user-strings.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE = join(HERE, "..", "src", "core");
const SHELL = shellFiles(join(HERE, "..", "src")) as string[];

type Candidate = { name: string; loc: string; strings: string[] };
const census = censusDisplayCandidates(CORE, SHELL) as Candidate[];
const listed = new Set(DISPLAY_CONST_NAMES as string[]);
const excluded = EXCLUDED_DISPLAY_CONSTS as Record<string, string>;

describe("#276 censo estructural de constantes-display — default-DENY", () => {
  it("todo candidato está clasificado: listado, exento por otra vía, o excluido con razón", () => {
    const live = extractUserStrings(CORE, SHELL) as Map<string, string>;
    const unclassified = census.filter(
      (c) =>
        !listed.has(c.name) &&
        !(c.name in excluded) &&
        !c.strings.every((s) => live.has(s)),
    );
    if (unclassified.length > 0) {
      throw new Error(
        `\n${unclassified.length} constante(s)-display SIN clasificar (nacerían INVISIBLES al ` +
          `trinquete anti-fabricación):\n` +
          unclassified
            .map((c) => `  ${c.name}  ${c.loc}  ej=${JSON.stringify(c.strings[0]).slice(0, 60)}`)
            .join("\n") +
          `\n\nClasifícala en tools/extract-user-strings.mjs: si sus strings son user-facing, ` +
          `añádela a DISPLAY_CONST_NAMES + entradas con cita en approved-strings.json; si no, ` +
          `entrada razonada en EXCLUDED_DISPLAY_CONSTS ([interna]/[decision] — NO apuntes ` +
          `[deuda] nueva: un objeto nuevo user-facing se cura, no se apunta).\n`,
      );
    }
    expect(unclassified).toEqual([]);
  });

  it("ningún nombre de DISPLAY_CONST_NAMES está rancio (existe en el censo — caza renombres/borrados)", () => {
    const names = new Set(census.map((c) => c.name));
    const stale = (DISPLAY_CONST_NAMES as string[]).filter((n) => !names.has(n));
    expect(stale, `nombres listados sin declaración viva (renombraste/borraste la tabla sin tocar la lista): ${stale.join(", ")}`).toEqual([]);
  });

  it("ningún nombre de EXCLUDED_DISPLAY_CONSTS está rancio (el ledger refleja el código)", () => {
    const names = new Set(census.map((c) => c.name));
    const stale = Object.keys(excluded).filter((n) => !names.has(n));
    expect(stale, `exclusiones sin declaración viva (retíralas del ledger): ${stale.join(", ")}`).toEqual([]);
  });

  it("las dos listas son disjuntas y toda exclusión lleva categoría razonada", () => {
    const both = (DISPLAY_CONST_NAMES as string[]).filter((n) => n in excluded);
    expect(both).toEqual([]);
    const badReason = Object.entries(excluded)
      .filter(([, r]) => !/^\[(interna|deuda|decision)\] .{10,}/.test(r))
      .map(([n]) => n);
    expect(badReason, `exclusiones sin prefijo [interna]/[deuda]/[decision] o sin razón: ${badReason.join(", ")}`).toEqual([]);
  });

  it("control positivo del censo: la población medida no colapsa (≥100 candidatos, ≥45 listados)", () => {
    // Si el predicado estructural se rompe (p.ej. un refactor del AST deja el censo en 0),
    // los asertos de arriba pasarían EN VERDE sin medir nada. Cotas de 2026-08-18 (main
    // c95e8296): 107 candidatos, 49 declaraciones de nombres listados.
    // 🔴 RE-DERIVADA el 25-08 (FICHA β): 49 → **45**. No es aflojar la cota para que pase:
    // las CUATRO que faltan —ORDAINED_PAGES, REFUGE_KARMA_MESSAGES, CAMP_KARMA_MESSAGES y
    // BLCKTHRN_MISCMSG— dejaron de ser tablas de literales porque su texto salió del código
    // al asset `ds-strings.json`, y por eso salieron también del allowlist de
    // `extract-user-strings.mjs`. La cota baja EN EL MISMO COMMIT que su causa, que es la
    // única forma de que siga siendo una medida y no un número heredado.
    expect(census.length).toBeGreaterThanOrEqual(100);
    const listedDecls = census.filter((c) => listed.has(c.name)).length;
    expect(listedDecls).toBeGreaterThanOrEqual(45);
  });
});
