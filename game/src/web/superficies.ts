/**
 * LAS CUATRO SUPERFICIES DEL SITIO y qué se permite en cada una.
 *
 * Separado de `analitica.ts` a propósito: la regla «en /play NUNCA se graba» es una
 * decisión de PROCEDENCIA DE MATERIAL, no una opción de configuración de analítica,
 * y quiero que viva en un fichero que se lea entero de una vez.
 *
 * 🔴 `doc` LLEVABA DESDE EL 07-08 EN EL CÓDIGO Y NO EN EL TIPO (ficha #125).
 * `demo-byo/src/documentacion.ts` monta el panel con `superficie: "doc"` desde que
 * existe, así que en TIEMPO DE EJECUCIÓN la cuarta superficie ya circulaba; lo que
 * faltaba era la unión, y `tsc -p demo-byo` estaba rojo por eso. Añadirla al tipo NO
 * cambia ninguna conducta —el valor ya llegaba— y sí cierra el hueco por el que el
 * compilador dejó de vigilar esa llamada.
 */

export type Superficie = "portada" | "byo" | "play" | "doc";

/**
 * ¿Se puede grabar la sesión (replay DOM de PostHog) en esta superficie?
 *
 * 🔴 LISTA BLANCA, no lista negra. Una superficie nueva que nadie clasifique sale
 * `false` — que es el lado seguro. Con una lista negra (`s !== "play"`), añadir
 * `/atlas` o `/replay` la habría metido a grabar sin que nadie lo decidiera.
 *
 * - `portada` y `byo`: DOM propio (texto y controles escritos por el proyecto).
 * - `play`: TAMBIÉN — **directriz del usuario (2026-08-05)**: «grabación de todas las
 *   sesiones y máximo tracking posible», canvas incluido. Deroga la exclusión
 *   anterior, que existía porque grabar el canvas sube al proyecto píxeles del juego
 *   renderizados desde la copia DEL PROPIO JUGADOR (modelo BYO); el destino es el
 *   PostHog PRIVADO del proyecto, no material publicado, y la puerta de
 *   consentimiento sigue delante de todo. La versión histórica de esta lista (solo
 *   portada+byo) queda en el historial de git de este fichero.
 * - `doc`: **NO. DECISIÓN DEL LEAD (2026-08-09, ficha #125), no un descuido.** Las
 *   páginas de `/mejoras/**`, `/diferencias`, `/en/differences` y `/privacidad` son
 *   DOCUMENTACIÓN, no juego: no hay sesión que reproducir, sólo texto que se lee. La
 *   directriz de «grabar todas las sesiones» del 05-08 se dio sobre las superficies
 *   del PRODUCTO y no alcanza a las de lectura.
 *   🔴 Y esto hay que ESCRIBIRLO porque en el código `doc` es INDISTINGUIBLE de una
 *   superficie que nadie clasificó: las dos caen a `false` por el mismo camino (no
 *   estar en la lista). La diferencia —que aquí se decidió— vive en este párrafo y en
 *   el aserto de `analitica-cero-peticiones.test.ts` que la fija; sin ellos, el
 *   próximo que lea la lista no sabe si `doc` está fuera a propósito o de milagro.
 */
export function permiteGrabacionSesion(superficie: Superficie): boolean {
  return superficie === "portada" || superficie === "byo" || superficie === "play";
}

/** Nombre legible de la superficie, para etiquetar los eventos. */
export function etiquetaSuperficie(superficie: Superficie): string {
  return superficie;
}
