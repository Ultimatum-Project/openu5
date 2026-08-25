/**
 * Grand Tour — MODO DE IDIOMA (task tour-ES).
 *
 * El tour corre anclado a `lang=en` (el SUELO del calco: todos los sellos byte-idénticos
 * salen del binario 1988 en inglés). `U5_TOUR_LANG=es` lo conmuta a español para PROBAR la
 * TESIS de la capa i18n: **es SÓLO presentación** — jugar en español debe producir los
 * MISMOS SAVES BYTE-IDÉNTICOS que los sellos ingleses (analisis.md §6). El idioma sólo
 * transforma la SALIDA de consola (choke `coreview.pushConsole` → `t()`); NO muta estado
 * de juego, NO se persiste (override efímero de URL `?lang=es`), y NO toca la mecánica de
 * entrada (keywords/sílabas/mantras se teclean IGUAL — ver §"KEYWORDS" abajo).
 *
 * Este módulo es la ÚNICA lectura de `U5_TOUR_LANG` del lado de las specs (bootWorld lee la
 * env por su cuenta para construir la URL). Da:
 *   · `TOUR_LANG`  — el idioma efectivo del run ("en" default | "es").
 *   · `isEs()`     — azúcar para gates de spec.
 *   · `tr({en,es})`— elige el substring ESPERADO de un assert de texto según el idioma. En
 *                    `es`, si falta la variante `es` cae a `en` (degradación honesta: si el
 *                    string aún no está traducido, `t()` devolvió inglés → el assert inglés
 *                    sigue valiendo). Úsalo SÓLO en los spot-checks de texto que APORTAN
 *                    (2-3 por capítulo); el grueso de los asserts va por ESTADO (bytes del
 *                    .GAM, oro, posición), que es idéntico en ambos idiomas por construcción.
 *
 * KEYWORDS (§3.1 analisis.md). El matcher de conversación es FIEL al binario DOS: casa la
 * entrada tecleada como SUBCADENA de las keywords del `.TLK`, que son INGLESAS (ULTIMA.EXE
 * 0x6f1e stristr). El alias bilingüe §3.1 YA está implementado: `conversation.ts` acepta
 * `aliasFor` (inyectado en `es` desde `src/i18n/keyword-alias-es`), así que el jugador puede
 * teclear la palabra ESPAÑOLA. `kw({en,es})` (abajo) elige el token a teclear: la keyword
 * inglesa en `en`, el alias español (explícito o auto-derivado de la MISMA tabla canon) en
 * `es`. INVARIANTE: la keyword inglesa SIEMPRE casa (byte-identidad intacta); teclear "trab"
 * o "job" produce el mismo efecto → el mismo .GAM sellado. Las palabras de poder y mantras
 * (AHM, MALUM, BEH…) se teclean tal cual en AMBOS modos SIEMPRE (son mecánica, sin alias).
 */
import { aliasesForKeywordEs } from "../../src/i18n/keyword-alias-es.js";

/** Idioma efectivo del run del tour. `es` sólo si `U5_TOUR_LANG=es` (case-insensitive). */
export const TOUR_LANG: "en" | "es" = process.env.U5_TOUR_LANG?.toLowerCase() === "es" ? "es" : "en";

/** ¿El run corre en español? Azúcar para gates de spec. */
export const isEs = (): boolean => TOUR_LANG === "es";

/**
 * Elige el valor ESPERADO de un assert según el idioma del run. En `es`, si no se da la
 * variante `es`, cae a `en` (el string aún no traducido devuelve inglés por fallback de `t()`).
 */
export function tr(variants: { en: string; es?: string }): string {
  return TOUR_LANG === "es" ? variants.es ?? variants.en : variants.en;
}

/**
 * TOKEN a TECLEAR de una keyword de diálogo según el idioma (§3.1, alias bilingüe YA
 * implementado). En `en`: la keyword inglesa (siempre válida). En `es`: el alias español
 * — explícito si el spec lo da, o AUTO-derivado del PREFIJO de la tabla canon
 * (`keyword-alias-es`, misma fuente que alimenta el matcher del juego → un solo origen). Si
 * una keyword no tiene alias (mecánica: mantras/WoP/nombres), cae a la inglesa (que también
 * casa en es). La INVARIANTE de byte-identidad se conserva: teclear "trab" o "job" produce el
 * MISMO efecto de juego → el mismo .GAM sellado.
 */
export function kw(variants: { en: string; es?: string }): string {
  if (TOUR_LANG !== "es") return variants.en;
  if (variants.es) return variants.es;
  return aliasesForKeywordEs(variants.en)[0] ?? variants.en;
}
