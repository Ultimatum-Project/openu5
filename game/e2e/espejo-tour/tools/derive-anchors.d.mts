/**
 * Declaraciones de tipos para derive-anchors.mjs (paso OFFLINE de Fase C). El tool corre como
 * node plano (sin build); este sidecar da tipos a los unit tests + al import del runner.
 */
import type { Dir4, FaceAnchor, NpcAnchor } from "../anchors";

export const ARROW_TO_DIR: Record<string, Dir4>;

/** Normaliza una frase para casar contra LOOK2 (minúsculas, 0→o, sin puntuación/espacios). */
export function normPhrase(s: unknown): string;

/** Índice inverso frase-normalizada → [tileIds] desde el array LOOK2 (índice = tile id). */
export function buildLook2Index(look2: readonly (string | null | undefined)[]): Map<string, number[]>;

/** Quita eco de comando + marco «Thou dost see» de un texto de (L)ook; devuelve la feature. */
export function extractSees(text: unknown): string;

/** Parsea «Look-DIR ...feature» → {dir,sees}; null si no hay dirección legible o feature. */
export function parseLookExpect(text: unknown): { dir: string; sees: string } | null;

/** Ancla de cara ligada al índice de un op del segmento (dedupe por opIndex). */
export interface DerivedAnchor {
  opIndex: number;
  anchor: FaceAnchor;
}

/** Deriva las anclas de cara de un segmento (fuente única CLI + units). */
export function deriveSegmentAnchors(
  seg: {
    script?: ReadonlyArray<Record<string, unknown>>;
    expect?: ReadonlyArray<{ text?: string; ocrLn?: number | null }>;
  },
  look2Index: Map<string, number[]>,
): DerivedAnchor[];

// ------------------------------------------------------- anclas de NPC (mercader)
/** Nº de location → clave `Location` de ShoppeKeeperMap.json (copia pinchada por unit test
 *  contra `LOCATION_NAMES` de src/core/shops/shops.ts). */
export const LOCATION_NAMES: Record<number, string>;

/** Una tienda del port: índice global + su location, tipo, nombre de negocio y de mercader. */
export interface ShoppeEntry {
  index: number;
  locName: string;
  type: string;
  store: string;
  keeper: string;
}

/** Censo invertible de mercaderes (ShoppeKeeperMap × storeNames × shoppeKeeperNames). */
export function buildShoppeIndex(
  shoppeKeeperMap: Record<string, { Location: string; ShoppeKeeperType: string }>,
  storeNames: readonly string[],
  shoppeKeeperNames: readonly string[],
): ShoppeEntry[];

/** ¿Aparece `needle` en `hay` como palabra(s) completas? (ambos ya normalizados). */
export function hasWholeWords(hay: string, needle: string): boolean;

/** ¿Es este texto de expect un beat de (T)alk? (no exige dirección legible). */
export function isTalkExpect(text: unknown): boolean;

/** Invierte un beat de (T)alk al TIPO de mercader del port; null si no casa o es ambiguo. */
export function matchShoppeType(
  text: unknown,
  shoppeIndex: readonly ShoppeEntry[],
  locName: string | undefined,
): string | null;

/** Ancla de NPC ligada al índice de un op del segmento (dedupe por opIndex). */
export interface DerivedNpcAnchor {
  opIndex: number;
  anchor: NpcAnchor;
}

/** Deriva las anclas de NPC/mercader de un segmento (fuente única CLI + units). */
export function deriveSegmentNpcAnchors(
  seg: {
    enter?: { loc?: number | null; dungeon?: boolean } | null;
    script?: ReadonlyArray<Record<string, unknown>>;
    expect?: ReadonlyArray<{ text?: string; ocrLn?: number | null }>;
  },
  shoppeIndex: readonly ShoppeEntry[],
): DerivedNpcAnchor[];
