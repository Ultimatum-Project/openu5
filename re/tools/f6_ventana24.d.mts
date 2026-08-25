/** Tipos de los predicados pre-registrados de la ventana `f6-24` (`f6_ventana24.mjs`), para que
 *  el gate de tipos de `game/` pueda importarlos desde `tests/f6-ventana24-predicados.test.ts`
 *  sin `any` implícito. El .mjs es la fuente; esto sólo declara su superficie pública.
 *  Mismo patrón que `censo_sombra_mercader.d.mts`. */

/** Un bloque del reporte del espejo, en lo que estos predicados miran de él. */
export interface BloqueEspejo {
  ocrLn: number;
  class: string;
  verdict: string;
}

export interface SegmentoReporte {
  id: string;
  blocks?: BloqueEspejo[];
}

export interface ReporteParte {
  segments: SegmentoReporte[];
  matched: number;
  comparable: number;
  ledger?: { ledgerDeltas?: unknown[] };
}

/** nº de `ocrLn` que cambian de `verdict` o de `class` entre brazos, más los que sólo existen en
 *  uno. Por diferencia de CONJUNTOS: es el cribado de la fase 1, y NO es el `Δ` neto. */
export function churnSegmento(blocksH?: BloqueEspejo[], blocksRev?: BloqueEspejo[]): number;

export function churnParte(
  repH: ReporteParte,
  repRev: ReporteParte,
): { total: number; porSegmento: Array<{ id: string; churn: number; ausenteEnRev?: boolean; ausenteEnH?: boolean }> };

/** Qué le pasa a UN bloque al pasar del brazo viejo (`Rev`) al nuevo (`H`). */
export function clasificaBloque(
  bRev: BloqueEspejo | undefined,
  bH: BloqueEspejo | undefined,
): "perdida-veredicto" | "sale-del-denominador" | "ganancia" | "igual" | "solo-en-un-brazo";

/** Nombre de bicho normalizado para carear el banner del port contra el OCR del corpus. */
export function folddBicho(s: string): string;

/** ¿El combate que corría el port era SUYO o el del LP? Sobre el TRANSCRIPT, no sobre el report. */
export function combateDelPort(
  transcriptSeg: string[] | undefined,
  expectTextos: string[] | undefined,
): { veredicto: "sin-combate" | "combate-propio" | "combate-del-lp" | "combate-sin-bicho"; bicho: string | null };

/** Partes de la ventana con delta de ledger SELLADO → su comprobación no depende del cribado. */
export const PARTES_SELLADAS: Record<string, string>;

export function ledgerSeMueve(repH: ReporteParte, repRev: ReporteParte): { movido: boolean; rev?: string; h?: string };

/** Ops del guion que el arnés NO condujo, con sus tres componentes separados. */
export function opsNoConducidas(seg: {
  todosSkipped?: number;
  salaOpsSkipped?: number;
  typedSkipped?: number;
}): { todos: number; sala: number; typed: number; total: number };

/** Fracción del guion no conducida. `opsTotales` sale del CORPUS, no del report. */
export function fraccionNoConducida(
  seg: { todosSkipped?: number; salaOpsSkipped?: number; typedSkipped?: number },
  opsTotales: number | undefined,
): number | null;

export const BANDAS_NO_CONDUCIDO: number[];

/** Curva ACUMULADA del denominador por fracción no conducida (no un umbral). */
export function curvaDenominador(
  rep: ReporteParte,
  opsPorSegmento: Record<string, number> | undefined,
): {
  filas: Array<{ banda: number; segmentos: number; comparable: number; matched: number }>;
  sinDato: { segmentos: number; comparable: number };
  totalComparable: number;
  totalMatched: number;
};

/** Horas a las que un NPC cambia de tramo de horario (derivadas de `scheduleIndex`). */
export function fronterasHorario(
  times: number[],
  scheduleIndexFn: (times: number[], hour: number) => number,
): number[];

/** Margen en MINUTOS de juego a la frontera más cercana, por el círculo de 24 h. `null` si el
 *  NPC no tiene frontera (horario constante). */
export function margenAFrontera(hour: number, minute: number, fronteras: number[] | null): number | null;
