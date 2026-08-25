/**
 * EL HANDLE DE ANALÍTICA YA INSTALADO, alcanzable desde módulos que no lo reciben.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────────
 * Los escalones del embudo BYO no ocurren todos en la raíz de composición. «Se añadió
 * un momento» ocurre dentro de `momentos.ts`, «se abrió una partida» dentro de
 * `partidas.ts`: módulos de UI que hoy no reciben —ni tienen por qué recibir— un
 * objeto de analítica. Las dos salidas eran enhebrar un parámetro nuevo por tres capas
 * de ficheros que están en obras, o esto. Esto cuesta dos líneas por emisor.
 *
 * ── 🔴 LO QUE ESTE MÓDULO NO ES ─────────────────────────────────────────────────
 * **No es un segundo camino a la red, y esa es la única propiedad que importa aquí.**
 * No crea ninguna analítica, no lee configuración, no conoce la clave ni el host: sólo
 * guarda la referencia al MISMO objeto `Analitica` que `instalaConsentimiento` ya
 * construyó, y le reenvía la llamada. El permiso se vuelve a comprobar dentro de
 * `evento()` como en cualquier otro emisor — sin consentimiento, esto descarta igual.
 * Un módulo que importe `eventoVivo` no puede saltarse la puerta ni por descuido,
 * porque no hay nada que saltarse: la puerta está detrás.
 *
 * El invariante lo mide `analitica-cero-peticiones.test.ts` sobre ESTA ruta también,
 * y no por simetría decorativa: un camino de emisión sin su propia prueba de cero
 * peticiones es exactamente por donde se escapa el primer byte.
 *
 * ── ANTES DE REGISTRAR: NO-OP, NO ERROR ─────────────────────────────────────────
 * Una página que no instale consentimiento (las de documentación, por ejemplo) puede
 * importar un módulo que emita, y no debe reventar por eso — ni enviar nada. Emitir
 * sin registro se descarta en silencio, que es el mismo lado seguro que todo el resto
 * del carril: ante la duda, no sale nada.
 */
import type { Analitica } from "./analitica.js";

let viva: Analitica | null = null;

/**
 * Guarda el handle instalado. La llama `instalaConsentimiento`, una vez por página.
 *
 * Si ya había uno, se SUSTITUYE: en producción no pasa (una instalación por página),
 * y en los tests el reemplazo es justo lo que evita que un caso herede el doble del
 * anterior. Lo que no se hace es acumularlos — dos handles vivos duplicarían cada
 * evento y el embudo saldría al doble sin que nada se pusiera rojo.
 */
export function registraAnaliticaViva(a: Analitica | null): void {
  viva = a;
}

/**
 * Emite por el handle instalado, si lo hay. Misma firma que `Analitica.evento`.
 *
 * El nombre se pide como `string` y no como `NombreEvento` a propósito: `main.ts` del
 * juego ya reenvía nombres por `onAnalyticsEvent(event: string)`. Quien impide que
 * entre un literal fuera del catálogo no es el tipo — es la guarda de
 * `privacidad-build.mjs`, que escanea las llamadas y pone el build rojo.
 */
export function eventoVivo(nombre: string, props?: Record<string, unknown>): void {
  viva?.evento(nombre, props);
}

/** ¿Hay handle registrado? Para tests y para diagnóstico; no decide nada. */
export function hayAnaliticaViva(): boolean {
  return viva !== null;
}
