/**
 * ANALÍTICA (PostHog) BAJO CONSENTIMIENTO — el único punto del sitio que puede
 * hablar con un tercero.
 *
 * 🔴 EL INVARIANTE QUE DEFIENDE ESTE FICHERO:
 *   **Rechazar (o no haber decidido) ⇒ CERO peticiones a PostHog.**
 * No «peticiones sin cookie», no «eventos anónimos»: cero. La forma de conseguirlo
 * es estructural, no una opción del SDK: mientras no haya permiso, el `<script>`
 * del SDK NO SE INSERTA. Sin script no hay `posthog`, y sin `posthog` no hay a
 * quién pedirle que no envíe nada.
 *
 * Por eso el módulo está partido en dos:
 *   - `creaAnalitica()` — decide. PURO respecto a la red: sólo llama a `cargaSdk`.
 *   - `cargaSdkPostHog()` — el ÚNICO código que toca el DOM/la red (`sdk-posthog.ts`).
 * La guarda de `tests/analitica-cero-peticiones.test.ts` cuenta las llamadas a
 * `cargaSdk` Y, con el cargador REAL en jsdom, los `<script>` insertados, los
 * `fetch`, los `XMLHttpRequest` y los `sendBeacon`.
 *
 * La clave de proyecto es pública por diseño (viaja en el JS del sitio), pero tanto
 * ella como el host se leen desde el entorno. Sin destino completo no hay nada que
 * consentir ni cargar.
 */
import { permiteAnalitica, type Consentimiento } from "./consentimiento.js";
import { permiteGrabacionSesion, type Superficie } from "./superficies.js";

/** Configuración del destino. Sin clave u host, la analítica queda desactivada. */
export interface ConfigAnalitica {
  /** Token de proyecto de PostHog. Vacío ⇒ nada se carga y nada se envía. */
  readonly clave: string;
  /** `api_host`. Estamos en la UE ⇒ nube europea por defecto. */
  readonly host: string;
}

/** Lo que recibe el cargador del SDK. Todo lo que decide el permiso ya viene resuelto. */
export interface OpcionesSdk {
  readonly clave: string;
  readonly host: string;
  readonly superficie: Superficie;
  /** Ya resuelto por `permiteGrabacionSesion`: el cargador no vuelve a decidirlo. */
  readonly grabacionSesion: boolean;
}

/** Handle mínimo del SDK ya cargado. Sólo lo que este módulo necesita. */
export interface SdkCargado {
  captura(nombre: string, props?: Record<string, unknown>): void;
  /** Revocación en caliente: deja de capturar y olvida los identificadores. */
  apaga(): void;
}

export interface DepsAnalitica {
  readonly config: ConfigAnalitica;
  readonly superficie: Superficie;
  /** Lee el consentimiento VIVO en cada consulta (puede cambiar sin recargar). */
  consentimiento(): Consentimiento | null;
  /** ÚNICO camino a la red. Se inyecta para poder probar que NO se llama. */
  cargaSdk(opciones: OpcionesSdk): SdkCargado;
  /**
   * IDIOMA del sitio, para etiquetar cada evento. Se pide como FUNCIÓN y se llama en
   * cada envío, no se copia al construir: el botón ES/EN cambia el idioma a media
   * sesión sin recargar, y un valor congelado al arrancar atribuiría al idioma de
   * llegada todo lo que el visitante hizo DESPUÉS de cambiarlo — que en /byo es casi
   * todo, porque el botón está arriba y la extracción viene después.
   *
   * Ausente ⇒ los eventos van sin `idioma` (no se inventa uno por defecto: «en» falso
   * es peor que ausente, porque se puede sumar).
   */
  idioma?(): string;
  /** Aviso de diagnóstico. Por defecto `console.warn`. */
  avisa?(mensaje: string, error: unknown): void;
}

export type ResultadoArranque =
  /** El SDK está cargado (o ya lo estaba) y los eventos salen. */
  | "arrancada"
  /** No hay clave de proyecto: la analítica no existe en este despliegue. */
  | "sin-clave"
  /** No hay permiso (o se revocó): no se ha cargado nada. */
  | "sin-consentimiento"
  /** El cargador lanzó. Se queda apagada; no se reintenta en bucle. */
  | "error";

export interface Analitica {
  /**
   * Re-evalúa clave + consentimiento y arranca o apaga en consecuencia.
   * Idempotente: llamarla mil veces carga el SDK como mucho una.
   */
  sincroniza(): ResultadoArranque;
  /** Envía un evento. Se DESCARTA en silencio si la analítica no está arrancada. */
  evento(nombre: string, props?: Record<string, unknown>): void;
  /** ¿Está el SDK cargado ahora mismo? (para tests y para el panel). */
  activa(): boolean;
}

export function creaAnalitica(deps: DepsAnalitica): Analitica {
  let sdk: SdkCargado | null = null;
  let fallida = false;
  const avisa = deps.avisa ?? ((m: string, e: unknown) => console.warn(m, e));

  function sincroniza(): ResultadoArranque {
    // 1. Sin clave no hay destino. Se comprueba ANTES que el permiso: en un
    //    despliegue sin analítica, aceptar no debe cargar nada.
    if (!deps.config.clave || !deps.config.host) return "sin-clave";

    // 2. El permiso, leído VIVO. `null` (sin decidir) y `false` (rechazado) son el
    //    mismo caso aquí: no se carga nada.
    if (!permiteAnalitica(deps.consentimiento())) {
      // Revocación con el SDK ya cargado: no se puede des-insertar el script, pero
      // sí callarlo y borrar sus identificadores.
      if (sdk) {
        try {
          sdk.apaga();
        } catch (e) {
          avisa("[analitica] fallo al apagar tras revocar", e);
        }
        sdk = null;
      }
      return "sin-consentimiento";
    }

    if (sdk) return "arrancada";
    if (fallida) return "error"; // un fallo de carga no se reintenta en cada evento

    try {
      sdk = deps.cargaSdk({
        clave: deps.config.clave,
        host: deps.config.host,
        superficie: deps.superficie,
        grabacionSesion: permiteGrabacionSesion(deps.superficie),
      });
      return "arrancada";
    } catch (e) {
      fallida = true;
      avisa("[analitica] el SDK no cargó; queda apagada", e);
      return "error";
    }
  }

  /**
   * El idioma vigente como propiedad suelta, o nada.
   *
   * Su fallo NO se lleva por delante el evento: perder un escalón del embudo por no
   * poder leer una ETIQUETA sería un intercambio absurdo, y el `getItem` de esto lanza
   * de verdad en Safari privado. Un evento sin `idioma` sigue contando en el embudo;
   * uno que no se envía, no.
   */
  function idiomaAhora(): { idioma?: string } {
    if (!deps.idioma) return {};
    try {
      const lang = deps.idioma();
      return lang ? { idioma: lang } : {};
    } catch (e) {
      avisa("[analitica] idioma no resuelto; el evento sale sin él", e);
      return {};
    }
  }

  return {
    sincroniza,
    activa: () => sdk !== null,
    evento(nombre, props) {
      // `sincroniza()` aquí NO es redundante: si el permiso se revocó en otra
      // pestaña, este es el punto donde nos enteramos antes de enviar.
      if (sincroniza() !== "arrancada" || !sdk) return;
      try {
        // `props` va LA ÚLTIMA: un evento que traiga su propio `idioma` o `superficie`
        // manda sobre el automático, y así estas dos no son una jaula.
        sdk.captura(nombre, { superficie: deps.superficie, ...idiomaAhora(), ...props });
      } catch (e) {
        avisa("[analitica] evento descartado", e);
      }
    },
  };
}
