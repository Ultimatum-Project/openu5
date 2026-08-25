/**
 * Grand Tour — POLÍTICA de arranque independiente de piel (task #16), PURA y testeable.
 *
 * Extraída de `bootWorld` (nav.ts) para poder unit-testear la derivación piel→URL→click
 * SIN acoplarse a Playwright. `nav.ts` la envuelve con el driver real (goto/click/espera
 * de la señal lógica `__u5test.worldReady`). El entorno (`U5_TOUR_SKIN`) se INYECTA como
 * argumento — este módulo NO lee `process` (así type-checkea bajo el tsconfig raíz, que
 * no incluye los tipos de Node), y el test lo controla de forma explícita.
 */
export type TourSkin = "dev" | "faithful";

/** Idioma de arranque del tour. `en` = el SUELO del calco (sin override de URL). */
export type TourLang = "en" | "es";

export interface BootPlan {
  /** Piel efectiva tras aplicar opts → env → default (`dev`). */
  skin: TourSkin;
  /** Idioma efectivo tras aplicar opts → env → default (`en`). */
  lang: TourLang;
  /** URL de arranque: `?skin=…[&debug=1][&nointro][&lang=es]`. */
  url: string;
  /** ¿Hay que clicar el título DOM (`.title-new`)? Sólo la piel dev lo tiene. */
  clickTitle: boolean;
}

/**
 * Normaliza un código de idioma crudo (env/opts) a un `TourLang`. Sólo `es` conmuta;
 * cualquier otra cosa (undefined, "", "en", basura) cae a `en` — el suelo del calco,
 * cuyo comportamiento es byte-idéntico al histórico (NO añade `?lang` a la URL).
 */
function resolveTourLang(raw: string | undefined): TourLang {
  return raw?.toLowerCase() === "es" ? "es" : "en";
}

/**
 * Deriva el plan de arranque de las opciones + el valor de `U5_TOUR_SKIN`/`U5_TOUR_LANG`.
 *   · piel: `opts.skin` › `envSkin === "dev"` › `"faithful"` (default POST-fase 2). Tras
 *     probar la pureza de render a escala (ch02-ch07 byte-idénticos dev↔faithful, task
 *     #16), la 1988 es el default — el usuario quiere VER el tour así. `U5_TOUR_SKIN=dev`
 *     conmuta TODAS las specs de vuelta a la piel dev sin tocar ni una línea.
 *   · `debug` (default: sólo piel dev): añade `?debug=1`, que ÚNICAMENTE abre el panel
 *     DEBUG/QA visual al arrancar. La costura de arnés (`window.__u5debug`, con
 *     `teleportOverworld`) se expone SIEMPRE (debug/index.ts monta la fachada
 *     incondicionalmente) — el tour NO necesita el panel abierto, y bajo la piel 1988
 *     el drawer taparía el juego que el usuario está viendo (petición 2026-07-16).
 *   · faithful: añade `&nointro` para saltar la cinemática y montar el mundo directo;
 *     y NO clica título (la fiel no tiene título DOM). dev: clica `.title-new`.
 *   · idioma: `opts.lang` › `envLang === "es"` › `"en"` (default). `en` NO toca la URL
 *     (byte-idéntico al histórico); `es` añade `&lang=es` AL FINAL — el override EFÍMERO
 *     de URL que main.ts aplica con `setLang(..,{persist:false})` (capa i18n SÓLO de
 *     presentación: no muta estado de juego, ver analisis.md §6). La TESIS del modo es:
 *     jugar en español produce SAVES byte-idénticos a los sellos ingleses.
 */
export function bootPlan(
  opts?: { skin?: TourSkin; debug?: boolean; lang?: TourLang },
  envSkin?: string,
  envLang?: string,
): BootPlan {
  const skin: TourSkin = opts?.skin ?? (envSkin === "dev" ? "dev" : "faithful");
  const debug = opts?.debug ?? skin === "dev";
  const lang: TourLang = opts?.lang ?? resolveTourLang(envLang);
  const params = [`skin=${skin}`];
  if (debug) params.push("debug=1");
  if (skin === "faithful") params.push("nointro");
  // `lang=es` AL FINAL para que la URL de `en` (default) quede idéntica a la histórica.
  if (lang !== "en") params.push(`lang=${lang}`);
  return { skin, lang, url: `/?${params.join("&")}`, clickTitle: skin === "dev" };
}
