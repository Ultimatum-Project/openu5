/** Tipos del extractor compartido (F1.12). Ver extract-user-strings.mjs. */
export function extractUserStrings(coreDir: string, extraFiles?: string[]): Map<string, string>;
/**
 * Modo "native" (#126): plantillas `${…}` (normalizadas a `{}`) que llegan a un sink
 * user-facing SIN pasar por `t()`/`tf()`. SIN dedupe — el sitio es el producto.
 */
export function extractNativeInterpolations(
  coreDir: string,
  extraFiles?: string[],
): Array<{ text: string; loc: string }>;
export function isTechnical(s: string): boolean;
/** #276 — nombres de las constantes-display cuyo contenido entra al manifiesto. */
export const DISPLAY_CONST_NAMES: string[];
/**
 * #331 (cura) — consts de mensaje PLANO (string/concatenación) importadas por su sink:
 * sus literales afloran en la DECLARACIÓN y entran al manifiesto con cita.
 */
export const STRING_CONST_NAMES: string[];
/** #276 — ledger de exclusiones razonadas del censo ([interna]/[deuda]/[decision]). */
export const EXCLUDED_DISPLAY_CONSTS: Record<string, string>;
/**
 * #276 — censo ESTRUCTURAL de candidatos a constante-display (declaración MAYÚSCULAS con
 * inicializador objeto/array y ≥1 string alfabético) sobre la población del extractor.
 */
export function censusDisplayCandidates(
  coreDir: string,
  extraFiles?: string[],
): Array<{ name: string; loc: string; strings: string[] }>;
/** Ficheros shell con strings user-facing (main.ts + conductores ui/, TRAMO 1). */
export const SHELL_FILE_RELPATHS: string[];
export function shellFiles(srcDir: string): string[];
/** Ficha relpaths — ledger de exclusiones del censo por-FICHERO ([interna]/[deuda]/[decision]). */
export const EXCLUDED_SHELL_FILES: Record<string, string>;
/**
 * Ficha relpaths — censo por-FICHERO de emisores del shell (todo .ts de src/ fuera de
 * core/ donde el extractor aflora ≥1 string no-técnico), derivado del código.
 */
export function censusShellEmitterFiles(srcDir: string): Array<{ rel: string; strings: string[] }>;
/** #331 — ledger de exclusiones del censo de consts importadas en sinks ([interna]/[deuda]/[decision]). */
export const EXCLUDED_IMPORTED_SINK_CONSTS: Record<string, string>;
/**
 * #331 — censo de identificadores IMPORTADOS que llegan a un sink user-facing (los
 * mismos sinks del extractor, en modo "imports"), con los strings de su declaración de
 * origen para la exención mecánica por valor. `resolved=false` = origen ilegible
 * estáticamente (fail-closed).
 */
export function censusImportedSinkConsts(
  coreDir: string,
  extraFiles?: string[],
): Array<{ name: string; froms: string[]; locs: string[]; strings: string[]; resolved: boolean }>;
