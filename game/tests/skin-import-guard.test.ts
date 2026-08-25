/**
 * GUARD CI — separación CORE ↔ PIEL (E1-S1).
 *
 * QUÉ IMPONE. Las dos reglas duras de las costuras (spec 2026-07-14-ui-estrategia-
 * interview.md §2, "Reglas duras" #1):
 *
 *   Regla A (core independiente): `game/src/core/**` NO importa NADA de
 *     `skin/`, `render/`, `ui/` ni `main`. El core es el motor puro y no sabe
 *     qué piel lo presenta. Cualquier import así → ROJO.
 *
 *   Regla B (frontera piel→core): las PIELES en `game/src/skin/**` sólo hablan
 *     con el core a través del contrato. En runtime NO importan internals del
 *     core; sólo TIPOS (`import type`) están permitidos (Game/GameEvent para las
 *     firmas). La ÚNICA excepción es el adaptador `skin/coreview.ts`, que ES el
 *     puente core→piel y por diseño lee el core en runtime.
 *
 * CÓMO. Análisis de imports por regex robusto sobre el texto fuente (sin
 * ejecutar): captura `import … from "<spec>"`, `export … from "<spec>"` e
 * `import("<spec>")` dinámicos (comillas Y template literal sin sustituciones),
 * distinguiendo `import type` (type-only, permitido) de imports de runtime.
 *
 * ENDURECIDO (auditoría de calidad G7 + ARQ-7) — tres vías de evasión cerradas:
 *   1. TRANSITIVIDAD: la Regla B se comprueba sobre el CIERRE transitivo de los
 *      imports de runtime (piel → ui → core ya no pasa verde: se sigue la cadena
 *      resolviendo cada spec relativo a su fichero real).
 *   2. EXENCIÓN POR PATH COMPLETO: el adaptador se identifica por su ruta
 *      relativa exacta (`skin/coreview.ts`), no por basename — un futuro
 *      `skin/<sub>/coreview.ts` ya NO queda exento en silencio.
 *   3. IMPORTS DINÁMICOS OPACOS: un `import(\`…\`)` con sustituciones `${…}` (o
 *      con argumento no-literal) dentro de una piel es INanalizable estáticamente
 *      → ROJO por construcción (la guarda es conservadora, no adivina).
 *   Además (ARQ-7): si `tsconfig.json` ganara un mapping `paths`, los specs no
 *   relativos podrían apuntar a nuestro árbol evadiendo `pointsTo` → el guard
 *   exige que NO exista `compilerOptions.paths`.
 *
 * Las funciones de análisis están parametrizadas por raíz (`srcRoot`) para poder
 * DEMOSTRAR cada cierre con un árbol sintético (ver skin-import-guard-synthetic).
 *
 * POR QUÉ. El contrato prohíbe que una piel posea/lea estado de juego y que el
 * core dependa de la presentación, pero el compilador no lo impone. Sin esta
 * guarda, un import "de conveniencia" reabriría el acople que el spike cerró
 * (informe spike §1.3, riesgo #2). Es el equivalente a un import-linter.
 */
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import {
  importsOf,
  pointsTo,
  relTo,
  skinRuleBViolations,
  walk,
} from "./helpers/import-guard-lib.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "src");

describe("guard: separación core ↔ piel (E1-S1)", () => {
  const coreFiles = walk(join(SRC, "core"));
  const skinFiles = walk(join(SRC, "skin"));
  const rel = (f: string): string => relTo(SRC, f);

  it("core/ no importa de skin/ · render/ · ui/ · main (Regla A)", () => {
    const violations: string[] = [];
    for (const file of coreFiles) {
      for (const { spec } of importsOf(file).refs) {
        const forbidden = ["skin", "render", "ui"].find((seg) => pointsTo(spec, seg));
        const isMain = /(^|\/)main(\.js)?$/.test(spec) && spec.startsWith(".");
        if (forbidden || isMain) {
          violations.push(`${rel(file)} → "${spec}" (${forbidden ?? "main"})`);
        }
      }
    }
    expect(violations, `Core no debe depender de la presentación:\n${violations.join("\n")}`).toEqual(
      [],
    );
  });

  it("skin/ sólo alcanza el core por tipos — TRANSITIVO, adaptador por path completo (Regla B, G7)", () => {
    const violations = skinRuleBViolations(SRC);
    expect(
      violations.map((v) => v.detail),
      `Las pieles no alcanzan internals del core en runtime, ni directa ni transitivamente ` +
        `(usa el contrato o import type):\n${violations.map((v) => v.detail).join("\n")}`,
    ).toEqual([]);
  });

  it("render/ no importa el MOTOR de juego (core/game·state·world) — sólo tiles/time + contrato (Regla C, E1-S3)", () => {
    // Tras E1-S3 el Renderer lee sólo el CoreView (snapshot.window). Puede usar
    // metadatos LÓGICOS de tile/tiempo (core/tiles, core/time), pero NO el motor:
    // ni la clase Game, ni el GameState, ni el mundo/mapa (core/world/*).
    const renderFiles = walk(join(SRC, "render"));
    const violations: string[] = [];
    for (const file of renderFiles) {
      for (const { spec } of importsOf(file).refs) {
        if (!spec.startsWith(".")) continue;
        const bad =
          /(^|\/)core\/game(\.js)?$/.test(spec) ||
          /(^|\/)core\/state(\.js)?$/.test(spec) ||
          pointsTo(spec, "world");
        if (bad) violations.push(`${rel(file)} → "${spec}"`);
      }
    }
    expect(
      violations,
      `render/ está desacoplado del motor de juego (usa CoreView):\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("hay al menos una piel y el adaptador registrado (sanity del guard)", () => {
    // La piel dev se JUBILÓ (fase 2, veredicto #8) — antes esta sanity nombraba skin/dev.ts;
    // ahora nombra la piel fiel, que es el suelo del render.
    expect(skinFiles.some((f) => rel(f) === "skin/fiel/skin.ts")).toBe(true);
    expect(skinFiles.some((f) => rel(f) === "skin/coreview.ts")).toBe(true);
  });

  it("tsconfig no tiene `paths` (un alias evadiría pointsTo/resolveSpec) (ARQ-7)", () => {
    const tsconfig = JSON.parse(readFileSync(join(HERE, "..", "tsconfig.json"), "utf8")) as {
      compilerOptions?: { paths?: unknown };
    };
    expect(
      tsconfig.compilerOptions?.paths,
      "compilerOptions.paths permitiría specs no-relativos hacia src/ que este guard no analiza; " +
        "si de verdad hace falta un alias, extiende resolveSpec/pointsTo ANTES de añadirlo",
    ).toBeUndefined();
  });
});
