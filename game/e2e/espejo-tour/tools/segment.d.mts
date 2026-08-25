/**
 * Declaraciones de tipos para segment.mjs (segmentador de OCR-logs). El tool corre como node
 * plano (sin build); este sidecar da tipos a los unit tests, igual que overlay-merge.d.mts.
 */

/** Evento clasificado de una línea del ocrlog (`ln` = número de línea 1-based). */
export type OcrEvent =
  | { ln: number; t: "typed"; s: string; mantra?: boolean }
  | { ln: number; t: "text"; s: string; echo: boolean }
  | { ln: number; t: "move"; dir: string; veh: string }
  | { ln: number; t: "gap"; n: number };

/** Grupo de racha: lecturas OCR de UNA misma pulsación de getstring. */
export interface RachaGroup {
  members: { ln: number; s: string; mantra?: boolean }[];
  winner: { ln: number; s: string; mantra?: boolean };
  absorbed: boolean;
}

export function fuzz(s: string): string;
export function classify(raw: string): { t: string; s?: string; mantra?: boolean; echo?: boolean };
export function anchorKind(s: string): string | null;
export function typedFold(s: string): string;
export function isPrompt(s: string): boolean;
export function suspicious(s: string): number;
export function betterReading(b: string, a: string): boolean;
export function buildEvents(lines: string[], FROM?: number): OcrEvent[];
export function computeRachaGroups(events: OcrEvent[]): RachaGroup[];
export function dedupeEvents(events: OcrEvent[]): OcrEvent[];
export function segmentEvents(deduped: OcrEvent[], FROM: number, totalLines: number): unknown[];
