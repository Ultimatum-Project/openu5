/**
 * Ficha relpaths (hija de #276) — GUARDA DEL CENSO POR-FICHERO del shell (default-DENY).
 *
 * CLASE QUE MATA (3ª instancia de #53, la de #276 a nivel FICHERO): el extractor de
 * strings user-facing barría el shell por una LISTA DE FICHEROS cableada
 * (`SHELL_FILE_RELPATHS`) — 30 de los 39 ficheros de src/ui/ quedaban fuera, incluido
 * `shop-console.ts`, que emitía 6 literales inline por `this.deps.message(…)` invisibles
 * al trinquete anti-fabricación. Un fichero de UI NUEVO con emisiones nacía igual de
 * invisible: ni manifiesto ni rojo.
 *
 * DISEÑO (calcado de tests/display-consts-censo.test.ts). El censo de emisores se
 * DERIVA del código (`censusShellEmitterFiles`: todo .ts de src/ fuera de core/ donde
 * `extractFile` aflora ≥1 string no-técnico — la misma vara que el extractor, no una
 * heurística aparte) y este test exige que CADA emisor esté clasificado:
 *   1. en `SHELL_FILE_RELPATHS` (el extractor lo barre → sus strings van al manifiesto), o
 *   2. en `EXCLUDED_SHELL_FILES` con razón prefijada [interna]/[deuda]/[decision].
 * Un fichero emisor nuevo sin clasificar → ROJO nombrándolo con sus strings (aserto 1).
 *
 * Y la ranciedad en ambos sentidos es aserto, no prosa: un relpath listado que ya no
 * existe en disco (renombre/borrado) → ROJO (aserto 2); una exclusión cuyo fichero ya
 * no es emisor (o no existe) → ROJO para retirarla (aserto 3).
 *
 * ESTRENADO EN ROJO (2026-08-19): sembrado `src/ui/seed-relpaths.ts` con un
 * `hud.message("Thou art seeded!")` sin censar, la guarda vieja
 * (string-manifest.test.ts) quedó VERDE ignorándolo y el aserto 1 ROJO nombrando
 * `ui/seed-relpaths.ts` con su string. Siembra retirada.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  censusShellEmitterFiles,
  SHELL_FILE_RELPATHS,
  EXCLUDED_SHELL_FILES,
} from "../tools/extract-user-strings.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "src");

type Emitter = { rel: string; strings: string[] };
const census = censusShellEmitterFiles(SRC) as Emitter[];
const listed = new Set(SHELL_FILE_RELPATHS as string[]);
const excluded = EXCLUDED_SHELL_FILES as Record<string, string>;

describe("ficha relpaths — censo por-fichero de emisores del shell (default-DENY)", () => {
  it("todo fichero emisor está clasificado: en SHELL_FILE_RELPATHS o excluido con razón", () => {
    const unclassified = census.filter((c) => !listed.has(c.rel) && !(c.rel in excluded));
    if (unclassified.length > 0) {
      throw new Error(
        `\n${unclassified.length} fichero(s) del shell emiten strings user-facing SIN censar ` +
          `(nacerían INVISIBLES al trinquete anti-fabricación):\n` +
          unclassified
            .map((c) => `  ${c.rel}  ej=${JSON.stringify(c.strings[0]).slice(0, 60)} (${c.strings.length} strings)`)
            .join("\n") +
          `\n\nClasifícalo en tools/extract-user-strings.mjs: si emite texto user-facing, ` +
          `añádelo a SHELL_FILE_RELPATHS + entradas con cita en approved-strings.json ` +
          `(node tools/gen-string-manifest.mjs las esqueleta); si sus strings no son texto ` +
          `del juego, entrada razonada en EXCLUDED_SHELL_FILES ([interna]/[decision]).\n`,
      );
    }
    expect(unclassified).toEqual([]);
  });

  it("ningún relpath de SHELL_FILE_RELPATHS está rancio (el fichero existe — caza renombres/borrados)", () => {
    const stale = (SHELL_FILE_RELPATHS as string[]).filter((f) => !existsSync(join(SRC, f)));
    expect(stale, `relpaths listados sin fichero en disco (renombraste/borraste sin tocar la lista): ${stale.join(", ")}`).toEqual([]);
  });

  it("ninguna exclusión está rancia (su fichero sigue siendo emisor — el ledger refleja el código)", () => {
    const emitters = new Set(census.map((c) => c.rel));
    const stale = Object.keys(excluded).filter((f) => !emitters.has(f));
    expect(stale, `exclusiones cuyo fichero ya no aflora strings (retíralas del ledger): ${stale.join(", ")}`).toEqual([]);
  });

  it("las dos listas son disjuntas y toda exclusión lleva categoría razonada", () => {
    const both = (SHELL_FILE_RELPATHS as string[]).filter((f) => f in excluded);
    expect(both).toEqual([]);
    const badReason = Object.entries(excluded)
      .filter(([, r]) => !/^\[(interna|deuda|decision)\] .{10,}/.test(r))
      .map(([f]) => f);
    expect(badReason, `exclusiones sin prefijo [interna]/[deuda]/[decision] o sin razón: ${badReason.join(", ")}`).toEqual([]);
  });

  it("control positivo del censo: la población medida no colapsa (≥10 emisores, ≥7 listados)", () => {
    // Si el predicado estructural se rompe (un refactor del extractor deja el censo en 0),
    // los asertos de arriba pasarían EN VERDE sin medir nada. Cotas de 2026-08-19 (rama
    // de la ficha sobre main 722310d7): 12 emisores = 9 listados + 3 excluidos.
    expect(census.length).toBeGreaterThanOrEqual(10);
    const listedEmitters = census.filter((c) => listed.has(c.rel)).length;
    expect(listedEmitters).toBeGreaterThanOrEqual(7);
  });
});
