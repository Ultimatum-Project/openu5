/**
 * EL ÚNICO CÓDIGO DEL SITIO QUE TOCA A UN TERCERO.
 *
 * Inserta el `<script>` del SDK de PostHog y lo inicializa. Se llama SÓLO desde
 * `analitica.ts`, y sólo cuando ya hay clave y consentimiento: llamar a esto es,
 * literalmente, la primera petición. Todo lo que decide si se llega hasta aquí vive
 * fuera; este fichero no vuelve a evaluar permisos (salvo el aserto de grabación,
 * que es un cinturón, no la decisión).
 *
 * Se carga por `<script src=…/static/array.js>` en vez de por dependencia npm a
 * propósito: así «no hay consentimiento ⇒ no hay script ⇒ no hay petición» es una
 * propiedad que se ve mirando el DOM, y no una promesa sobre el comportamiento
 * interno de una librería empaquetada en nuestro bundle.
 */
import type { OpcionesSdk, SdkCargado } from "./analitica.js";

/** Superficie mínima del SDK que usamos. El resto de su API no nos interesa. */
interface PostHogMinimo {
  init(clave: string, config: Record<string, unknown>): void;
  capture(nombre: string, props?: Record<string, unknown>): void;
  opt_out_capturing?(): void;
  stopSessionRecording?(): void;
  reset?(borrarIdDispositivo?: boolean): void;
}

interface VentanaConPostHog extends Window {
  posthog?: PostHogMinimo;
}

/** Marca el `<script>` insertado: permite comprobarlo desde fuera y no duplicarlo. */
export const ATRIBUTO_SCRIPT = "data-openu5-analitica";

/**
 * Inserta el SDK y devuelve el handle. Los eventos emitidos antes de que el script
 * termine de cargar se ENCOLAN aquí y se sueltan al llegar; los que ocurran si el
 * script nunca carga (bloqueador, red caída) se descartan al cabo, sin reintentos.
 */
export function cargaSdkPostHog(
  opciones: OpcionesSdk,
  doc: Document = document,
  win: VentanaConPostHog = window as VentanaConPostHog,
): SdkCargado {
  let listo: PostHogMinimo | null = null;
  let apagado = false;
  const cola: [string, Record<string, unknown> | undefined][] = [];

  const script = doc.createElement("script");
  script.src = `${opciones.host}/static/array.js`;
  script.async = true;
  script.setAttribute(ATRIBUTO_SCRIPT, opciones.superficie);
  script.addEventListener("load", () => {
    const ph = win.posthog;
    if (!ph || apagado) return;
    ph.init(opciones.clave, {
      api_host: opciones.host,
      // GRABACIÓN DE SESIÓN: la decide `permiteGrabacionSesion` (superficies.ts) y
      // aquí sólo se obedece. `disable_session_recording: true` evita que el SDK
      // pida siquiera `recorder.js`, así que en `doc` el grabador ni se descarga.
      // (Esta línea decía «en /play»: cierto hasta el 05-08, falso desde que la
      // directriz del usuario metió /play en la lista blanca — hoy `doc` es la única
      // superficie que llega aquí con la grabación apagada.)
      disable_session_recording: !opciones.grabacionSesion,
      // Sin perfiles de persona: la analítica del sitio es ANÓNIMA (es lo que dice
      // el aviso). Los récords y repeticiones son otro carril y otro almacén.
      person_profiles: "never",
      // El consentimiento ya lo gestionamos nosotros; que el SDK no monte su propio
      // opt-in encima (duplicaría el diálogo y desincronizaría el estado).
      opt_out_capturing_by_default: false,
      // Sin cookie de terceros: todo en el propio dominio y en localStorage.
      persistence: "localStorage",
      // Error Tracking global: captura sólo excepciones y promesas no controladas.
      // Los errores de consola no son parte del alcance para evitar ruido de terceros.
      capture_exceptions: {
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
        capture_console_errors: false,
      },
      // SIN enmascarado y CON canvas — directriz del usuario (2026-08-05): «grabación
      // de todas las sesiones y máximo tracking posible». El texto del panel de
      // consentimiento declara exactamente esto (texto y config viajan en el mismo
      // commit, regla del spec). El enmascarado agresivo anterior queda en el
      // historial de git por si se revierte la directriz.
      session_recording: {
        maskAllInputs: false,
        recordCanvas: true,
        canvasFps: 4,
        canvasQuality: "0.6",
      },
    });
    listo = ph;
    for (const [nombre, props] of cola.splice(0)) ph.capture(nombre, props);
  });
  script.addEventListener("error", () => {
    cola.length = 0; // bloqueador de anuncios o red caída: se descarta, sin ruido
  });
  (doc.head ?? doc.documentElement).appendChild(script);

  return {
    captura(nombre, props) {
      if (apagado) return;
      if (listo) listo.capture(nombre, props);
      else if (cola.length < 50) cola.push([nombre, props]); // tope: nunca crece sin fin
    },
    apaga() {
      apagado = true;
      cola.length = 0;
      const ph = listo;
      listo = null;
      if (!ph) return;
      ph.stopSessionRecording?.();
      ph.opt_out_capturing?.();
      ph.reset?.(true); // borra también el id de dispositivo
    },
  };
}
