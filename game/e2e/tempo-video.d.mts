/** Tipos del reloj del arnés de grabación. Ver tempo-video.mjs (y re/notes/tempo-cinematico.md). */
export const MODO: string;
export const CINE: boolean;
export const TECLA_MS: number;
export const LECTURA_MS: number;
export const PACERS: boolean;
export function tecla(base: number): number;
export function lectura(base: number): number;
/** `destino` es un Page o un BrowserContext de Playwright. El retorno de `addInitScript`
 *  se deja en `unknown` a propósito: Playwright devuelve `Promise<Disposable>` y este
 *  módulo sólo necesita poder esperarlo. */
export function pacersVivos(destino: {
  addInitScript: (fn: () => void) => Promise<unknown>;
}): Promise<void>;
export function rotulo(): string;
