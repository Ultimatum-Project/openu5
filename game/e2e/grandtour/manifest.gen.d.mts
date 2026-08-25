/** Tipos del generador del manifiesto del Grand Tour (F3-T1). Ver manifest.gen.mjs. */
export interface ManifestItem {
  id: string;
  category: string;
  name: string;
  source: string;
  reachableBy: string | null;
}
export function buildManifest(): ManifestItem[];
export const EXPECTED_COUNTS: Record<string, number>;
