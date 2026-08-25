/** Tipos del corpus canónico i18n (F1). Ver i18n-corpus.mjs. */
export function buildCorpus(opts?: {
  assetsDir?: string;
  coreDir?: string;
  approvedPath?: string;
}): { corpus: Set<string>; sources: Record<string, number> };

/** Superficie del corpus de datos: id + cubo + strings (F0a). */
export function buildCorpusBySurface(opts?: {
  assetsDir?: string;
}): { id: string; cube: string; strings: string[] }[];

/** Hash de contenido normalizado de una superficie ("sha256:<hex>"). */
export function surfaceHash(strings: string[]): string;

/** Palabras (tokens separados por espacio) de un array de strings. */
export function wordCount(strings: string[]): number;

/** G8 — inventario de mundo-cerrado de assets (.json cubiertos por el corpus). */
export const COVERED_ASSET_FILES: string[];

/** G8 — assets .json excluidos del corpus, con razón explícita. */
export const EXCLUDED_ASSET_FILES: Record<string, string>;

/** G8 — huecos del inventario contra el disco (ambos deben ser []). */
export function assetInventoryGaps(opts?: {
  assetsDir?: string;
}): { unclassified: string[]; stale: string[] };
