import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/** Directorio con los datos originales MS-DOS de Ultima V (no versionados). */
export const U5_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../original/u5/ultima5",
);
