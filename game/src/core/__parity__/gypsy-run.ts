/**
 * Runner de paridad de la CREACIÓN DE PERSONAJE (la gitana, Task 3.11):
 * reproduce el core del clon (creation/gypsy.ts) para cruzarlo contra el modelo
 * asm-derivado en Python (re/tools/gypsy_parity.py). Mismo patrón que
 * shrines-run.ts / transport-run.ts.
 *
 * La mecánica consume RNG (OriginalRng, semilla del escenario; por defecto 0,
 * la del arranque del original). El bracket de rondas 2-3 depende de las
 * respuestas, así que la paridad es de VALOR determinista dado (seed, answers).
 *
 * Escenario JSON como único argumento CLI:
 *   { "base": {"strength":15,"dexterity":15,"intelligence":15},
 *     "answers": ["A","B",...7...], "seed": 0 }
 *   → { "strength":..,"dexterity":..,"intelligence":..,"currentMp":..,
 *       "matchups":[{"a":..,"b":..,"answer":"A","winner":..}, ...] }
 *
 * Salida: una línea JSON a stdout. Errores por stderr, exit 1.
 */
import { readFileSync } from "node:fs";
import { runGypsyQuiz, type GypsyBase } from "../creation/gypsy.js";

declare const process: {
  argv: string[];
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
  exit(code?: number): never;
};

interface Scenario {
  base?: GypsyBase;
  answers: ("A" | "B")[];
  seed?: number;
}

function main(): void {
  const path = process.argv[2];
  if (!path) {
    process.stderr.write("uso: gypsy-run.ts <scenario.json>\n");
    process.exit(1);
  }
  const scenario = JSON.parse(readFileSync(path, "utf-8")) as Scenario;
  const base: GypsyBase = scenario.base ?? { strength: 15, dexterity: 15, intelligence: 15 };
  const seed = scenario.seed ?? 0;
  const result = runGypsyQuiz(base, scenario.answers, seed);
  process.stdout.write(JSON.stringify(result) + "\n");
}

main();
