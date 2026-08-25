/**
 * DÓNDE VIVEN LAS SEMILLAS DE LA CADENA — resolución PURA, en módulo propio.
 *
 * Vive aparte de `checkpoint.ts` por una razón mecánica: `checkpoint.ts` importa
 * `@playwright/test`, así que no se puede cargar desde vitest. Sacar aquí las cuatro líneas
 * que deciden el directorio deja la decisión con guarda ejecutable (`tests/espejo-saves-dir.test.ts`).
 *
 * POR QUÉ HAY UNA PALANCA (carril `espejo-cadena-limpia`, 22-08). Medir una CADENA exige
 * EXPORTAR —la parte N+1 arranca del checkpoint que exportó la N— y el gesto que protege las
 * semillas compartidas, `U5_ESPEJO_NO_EXPORT=1`, apaga justamente eso. Las dos salidas que
 * había eran incompatibles: exportar y pisar las 98 semillas compartidas (el accidente del
 * 20-08, §2 de `re/notes/espejo-cadena-party-muerta.md`, que no salió en ningún diff porque
 * el directorio está fuera del índice desde #228), o no exportar y no poder encadenar.
 * Con `U5_ESPEJO_SAVES_DIR` la cadena se genera entera en un directorio propio y las
 * compartidas no se abren siquiera para escritura: `saves-PROCEDENCIA.tsv` sigue casando.
 *
 * 🔴 Redirige LECTURA Y ESCRITURA a la vez, y es deliberado. Un directorio que leyera del
 * canónico y escribiera en el propio produciría una cadena MIXTA —la parte N+1 leería la
 * semilla vieja si la N no llegó a exportar— que es exactamente la costura invisible que el
 * manifiesto existe para impedir. Con las dos redirigidas, una parte que no exporta hace
 * FALLAR a la siguiente por checkpoint ausente: un rojo que se ve.
 */
import { resolve } from "node:path";

/**
 * @param valor       contenido de `U5_ESPEJO_SAVES_DIR` (o `undefined` si no está puesta)
 * @param porDefecto  el directorio canónico (`e2e/espejo-tour/saves`)
 *
 * 🔴 El `trim()` NO es cosmética. `U5_ESPEJO_SAVES_DIR=` —que es como queda la variable al
 * "desactivarla" en un script, y lo que deja `export VAR=""`— es una cadena VACÍA, no
 * `undefined`: con un `valor !== undefined` el tour resolvería `resolve("")` = el CWD del
 * proceso y escribiría los checkpoints en `game/`, silenciosamente y fuera de todo manifiesto.
 * Vacía o en blanco ⇒ canónico.
 */
export function resuelveSavesDir(valor: string | undefined, porDefecto: string): string {
  const v = valor?.trim();
  return v ? resolve(v) : porDefecto;
}
