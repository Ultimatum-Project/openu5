/**
 * Runner de paridad del RNG (Task 1.3): imprime la secuencia CRUDA de
 * semillas de OriginalRng para una semilla inicial dada.
 *
 * Lo invoca re/tools/test_rng_parity.py por subprocess (tsx) para comparar
 * la secuencia del clon contra la que evoluciona en g_rng_seed dentro del
 * ULTIMA.EXE real corriendo en dosbox-x.
 *
 * Uso: tsx rng-run.ts <seed> <count>
 * Salida (stdout, una línea): JSON array de <count> words (los valores
 * sucesivos que el kernel dejaría en g_rng_seed, DS:0x5420).
 */
import { OriginalRng } from "../rng-original.js";

declare const process: {
  argv: string[];
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
  exit(code?: number): never;
};

const seed = Number(process.argv[2]);
const count = Number(process.argv[3]);
if (!Number.isInteger(seed) || !Number.isInteger(count) || count < 0) {
  process.stderr.write("uso: tsx rng-run.ts <seed> <count>\n");
  process.exit(1);
}

const rng = new OriginalRng(seed);
const out: number[] = [];
for (let i = 0; i < count; i++) out.push(rng.nextRaw16());
process.stdout.write(JSON.stringify(out) + "\n");
