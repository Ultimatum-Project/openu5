/** Tipos del testigo de la variante (`testigo_variante.mjs`). El .mjs es la fuente. */

/** Las cuatro variantes del prompt de apertura del flujo Sell (tabla DS 0x3d2e). */
export const VARIANTES_APERTURA: readonly string[];

/** Minúsculas y fuera todo lo que no sea letra/dígito — para comparar contra OCR. */
export function normaliza(s: string): string;

export type Testigo =
  | { indice: number; texto: string; ambiguas?: undefined }
  /** más de una variante en el mismo segmento: NO se resuelve a la primera */
  | { indice: -1; texto: null; ambiguas: number[] };

/** Qué variante salió en estas líneas del port. `null` = ninguna (la tienda no abrió). */
export function testigoDeVariante(portLines: readonly string[] | undefined): Testigo | null;

/** El transcript de una parte (`ESPEJO_DUMP=1`), o `null` si la corrida no lo volcó. */
export function transcriptDe(dir: string, parte: string): Record<string, string[]> | null;

export type ClaseTestigo =
  | "VERDE-ROBUSTO"
  | "VERDE-POR-SUERTE"
  | "ROTO-DE-VERDAD"
  | "NO-DETERMINISTA"
  | "SIN-TESTIGO"
  | "TESTIGO-AMBIGUO"
  /** no hay variante de referencia medida: el testigo informa, no adjudica */
  | "SIN-REFERENCIA";

export function clasificaConTestigo(args: {
  pagaImporte: boolean;
  variante: Testigo | null;
  esperada: number | null;
}): { clase: ClaseTestigo; porque: string };

/** El prompt del despachador Buy/Sell (DS 0x7f70 + 0x8042), duplicado del port. */
export const DESPACHADOR: string;

/**
 * ¿Se llegó a abrir el flujo Sell? Es el observable que SÍ vive en el brazo roto, donde la
 * variante no existe. `SOLO-TIENDA` = la tienda abrió y la venta NO ⇒ la avería es del FLUJO.
 */
export function aperturaDelFlujo(portLines: readonly string[] | undefined): {
  estado: "VENTA-ABIERTA" | "SOLO-TIENDA" | "SIN-TIENDA";
  porque: string;
};
