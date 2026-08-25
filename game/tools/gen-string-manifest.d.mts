/** Tipos del regenerador del manifiesto (F1.12/G9). Ver gen-string-manifest.mjs. */
export function reconcileManifest(
  prev: Record<string, string>,
  live: Map<string, string> | Set<string>,
): { next: Record<string, string>; added: string[]; removed: string[] };
