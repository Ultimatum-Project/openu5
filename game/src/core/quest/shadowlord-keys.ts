/**
 * LAS TRES CLAVES DE LOS SHADOWLORDS — dato puro, sin una sola dependencia.
 *
 * ── POR QUÉ ESTO ES UN FICHERO Y NO DOS LÍNEAS EN `shadowlords.ts` ──────────────────────
 * 🔴 NACE DE UNA FUGA MEDIDA, no de un gusto por los ficheros pequeños. `momentos/defs.ts`
 * necesitaba `SHADOWLORDS` para saber qué shard lleva cada momento de la Llama, y lo importó
 * de `shadowlords.js` — que es donde estaba. Pero `shadowlords.ts` importa `tf` de
 * `../../i18n/index.js` para sus mensajes, así que esa línea metió **el catálogo de
 * traducción ENTERO** en el bundle de `/byo`: de 4 871 B a 482 052 B (medido el 08-08, build
 * de `demo-byo` antes y después), con los diálogos de los NPC de EA dentro — texto del juego
 * original publicándose en el sitio, que es justo lo que CLAUDE.md REGLA 4 prohíbe.
 *
 * Lo cazó `test_byo_momentos.py::test_los_nombres_del_roster_en_el_sitio_son_solo_los_dos_de_la_prosa`,
 * que vio aparecer a Geoffrey, Katrina, Mariah y Sentri en el dist. No los vio como tabla de
 * roster —no lo eran— sino como nombres dentro de las líneas de diálogo traducidas.
 *
 * ★ LA LECCIÓN, y por eso el fichero: **importar una constante importa su MÓDULO, y con él
 * todo lo que ese módulo arrastra.** El coste de una importación no se lee en lo que
 * importas; se lee en el grafo del que cuelga. Un bundler no puede sacudir un módulo cuyo
 * efecto es cargar un diccionario. La separación no es estética: es lo que permite que un
 * consumidor que sólo quiere tres cadenas no se lleve medio megabyte.
 *
 * Aquí vive el dato que NO necesita nada; en `shadowlords.ts` viven las reglas que sí
 * (mensajes, i18n, `GameState`). `shadowlords.ts` lo re-exporta, así que sus importadores de
 * siempre no se enteran de este fichero.
 */

/** Los tres, por su clave canónica. */
export type ShadowlordKey = "falsehood" | "hatred" | "cowardice";

/**
 * ÍNDICE CANÓNICO (idx): 0 = Falsehood, 1 = Hatred, 2 = Cowardice.
 *
 * El orden NO es decorativo y no se reordena: es el que indexan las cuatro tablas de la
 * Llama (`FLAME_X/Y/LOCATION/FLOOR`) y `DOOM_BIT` en `ritual.ts`, y lo fijan los tres
 * `switch(idx)` de CAST.OVL (0x15c5 nombre-shard / 0x1682 nombre-llama / 0x1728
 * nombre-Shadowlord). El emparejamiento shard ↔ Shadowlord ↔ Llama es POSICIONAL por este
 * índice: no hay tabla de indirección.
 */
export const SHADOWLORDS: readonly ShadowlordKey[] = [
  "falsehood",
  "hatred",
  "cowardice",
] as const;

/**
 * Clave del `questFlags` que marca a un Shadowlord DESTRUIDO — la fuente de verdad que leen
 * `shadowlordDead`/`canReachDoom`/`endgameReady` y el gate de la emboscada de Doom.
 *
 * 🔴 VIVE AQUÍ Y NO EN `shadowlords.ts` POR LA MISMA FUGA QUE `SHADOWLORDS` (ver arriba):
 * los momentos del acto IV afirman «los tres han caído», y para escribir esos tres flags
 * `momentos/defs.ts` necesitaba esta función. Importarla de `shadowlords.js` habría vuelto a
 * meter el catálogo de traducción entero en el bundle de `/byo` — la misma línea, el mismo
 * medio megabyte. La alternativa era copiar el formato del flag en `defs.ts`, que es peor:
 * un segundo sitio donde escribir `shadowlord-dead:` y donde equivocarse en silencio (el
 * `questFlags` es un `Record<string, boolean>` — una clave mal escrita no da error de tipos,
 * da un momento con los tres Shadowlords VIVOS y la tarjeta prometiendo que están muertos).
 * `shadowlords.ts` la re-exporta, así que sus importadores de siempre no se enteran.
 */
export function shadowlordDeadFlag(which: ShadowlordKey): string {
  return `shadowlord-dead:${which}`;
}
