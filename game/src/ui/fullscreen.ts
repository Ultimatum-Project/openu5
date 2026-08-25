/**
 * Fullscreen API con detección de soporte y degradación HONESTA (encargo móvil
 * 2026-07-24): en apaisado el chrome del navegador come pantalla; un botón en el
 * deck pide pantalla completa.
 *
 * Soporte real por plataforma:
 *   · Chrome/Android, Edge, Firefox, Safari macOS → estándar `requestFullscreen`.
 *   · Safari iPad (13+) → estándar; versiones viejas → prefijo `webkitRequestFullscreen`.
 *   · Safari iPhone → NO hay fullscreen de elemento (solo <video>): `supported=false`
 *     y el botón NO SE MONTA (fallback: el meta viewport ya minimiza el chrome y el
 *     modo standalone de «Añadir a inicio» lo elimina del todo — no fingimos un botón
 *     que no puede funcionar).
 *
 * La preferencia NO se persiste: la API exige gesto de usuario por sesión.
 *
 * `resolveFullscreenHooks` es PURO sobre un doc inyectable (unit-testeable con
 * fakes); `detectFullscreenApi` lo cablea al documento real.
 */

/** Ganchos crudos resueltos (estándar o prefijo webkit), o null si no hay soporte. */
export interface FullscreenHooks {
  request: (el: Element) => Promise<void> | void;
  exit: () => Promise<void> | void;
  element: () => Element | null;
  /** Eventos de cambio a escuchar (estándar y/o prefijado). */
  changeEvents: string[];
}

/** Forma laxa del Document/Element para sondear miembros estándar y webkit. */
type AnyRecord = Record<string, unknown>;

/**
 * Resuelve la variante de la API disponible en `doc`. Puro: no toca globals — el
 * candidato a raíz de fullscreen es `doc.documentElement`.
 */
export function resolveFullscreenHooks(doc: unknown): FullscreenHooks | null {
  const d = doc as AnyRecord | null;
  const root = (d?.documentElement ?? null) as AnyRecord | null;
  if (!d || !root) return null;

  if (typeof root.requestFullscreen === "function" && typeof d.exitFullscreen === "function") {
    return {
      request: (el) => (el as unknown as { requestFullscreen(): Promise<void> }).requestFullscreen(),
      exit: () => (d as unknown as { exitFullscreen(): Promise<void> }).exitFullscreen(),
      element: () => (d.fullscreenElement ?? null) as Element | null,
      changeEvents: ["fullscreenchange"],
    };
  }
  if (
    typeof root.webkitRequestFullscreen === "function" &&
    typeof d.webkitExitFullscreen === "function"
  ) {
    return {
      request: (el) => (el as unknown as { webkitRequestFullscreen(): void }).webkitRequestFullscreen(),
      exit: () => (d as unknown as { webkitExitFullscreen(): void }).webkitExitFullscreen(),
      element: () => (d.webkitFullscreenElement ?? null) as Element | null,
      changeEvents: ["webkitfullscreenchange"],
    };
  }
  return null;
}

export interface FullscreenApi {
  supported: boolean;
  isActive(): boolean;
  /** Alterna fullscreen sobre `documentElement`. Los rechazos (p.ej. sin gesto) se tragan. */
  toggle(): Promise<void>;
  /** Suscribe a cambios; devuelve la desuscripción. */
  onChange(cb: () => void): () => void;
}

/** API cableada al documento real (o inyectado en tests). */
export function detectFullscreenApi(doc: Document = document): FullscreenApi {
  const hooks = resolveFullscreenHooks(doc);
  if (!hooks) {
    return {
      supported: false,
      isActive: () => false,
      toggle: async () => {},
      onChange: () => () => {},
    };
  }
  return {
    supported: true,
    isActive: () => hooks.element() != null,
    toggle: async () => {
      try {
        if (hooks.element()) await hooks.exit();
        else await hooks.request(doc.documentElement);
      } catch {
        /* rechazo del UA (sin gesto / iframe sin allowfullscreen): silencioso — el
           botón simplemente no cambia de estado. */
      }
    },
    onChange: (cb) => {
      for (const evt of hooks.changeEvents) doc.addEventListener(evt, cb);
      return () => {
        for (const evt of hooks.changeEvents) doc.removeEventListener(evt, cb);
      };
    },
  };
}
