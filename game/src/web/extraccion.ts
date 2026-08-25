/**
 * PUERTA DE VERSIÓN DE LA EXTRACCIÓN (#293) — el arranque carea lo que hay en la caché
 * del visitante contra lo que este build espera, y si falta algo lo DICE.
 *
 * ── EL DEFECTO ────────────────────────────────────────────────────────────────────────
 * Los assets del juego no viajan en el sitio: los genera la extracción de /byo en el
 * navegador de quien juega. Cuando el extractor aprende a emitir un asset nuevo, toda
 * extracción anterior se queda sin él, y hasta hoy eso no se notaba: la petición caía a
 * la red, openu5.org devolvía su soft-404 (#63: HTTP 200 con la home) y el `.catch()`
 * best-effort del boot degradaba en silencio. El usuario entró en un santuario el 14-08
 * y no había escena; nada en la pantalla decía por qué, y ni recargar ni actualizar el
 * service worker lo arreglaban — sólo re-extraer.
 *
 * ── EL PREDICADO, Y POR QUÉ NO SE PREGUNTA POR EL MANIFIESTO ─────────────────────────
 * Se leen las CLAVES DE LA CACHÉ, que es lo que el service worker va a servir de verdad.
 * El `manifest.json` que escribe el extractor sería más cómodo, pero es una DECLARACIÓN:
 * dice lo que se escribió aquel día, no lo que hay hoy. Si la caché perdiera una entrada
 * el manifiesto seguiría prometiéndola y el aviso no saltaría — justo el silencio que
 * esta ficha existe para quitar.
 *
 * ── LA DISCRIMINACIÓN DE (c): EXTRACCIÓN DEL VISITANTE vs ASSETS SERVIDOS ────────────
 * No se mira el dominio ni una bandera de build: se mira si EXISTE la caché de /byo. Es
 * el mismo mecanismo que decide de dónde salen los bytes (el SW sólo responde desde ella),
 * así que no puede desalinearse del hecho que quiere describir. Sin caché ⇒ los assets
 * los sirve el servidor (staging, dev, `npm run extract` local) ⇒ ni se mira la lista: un
 * hueco ahí es un despliegue roto, no una extracción vieja, y acusar al visitante de algo
 * que no puede arreglar es peor que callar.
 *
 * 🔴 `caches.open()` CREA la caché; `caches.has()` no. Aquí sólo se pregunta (misma
 * trampa ya medida en `hasExtraction`, extractor/src/browser.ts): abrirla convertiría a
 * todo el que juega con assets servidos en dueño de una `u5-assets-v1` vacía, y a partir
 * de la siguiente carga el juego creería que sus assets son de una extracción — y le
 * enseñaría el aviso a quien no tiene extracción ninguna.
 */
import {
  ASSETS_EXIGIDOS,
  ASSETS_PREFIX,
  ASSET_POR_RUTA,
  BYO_CACHE,
} from "../../../extractor/src/assets-catalog.js";

export { ASSETS_EXIGIDOS, BYO_CACHE };

/** Idioma del aviso. Mismo par que el panel de consentimiento (`web/panel-consentimiento.ts`). */
export type IdiomaAviso = "es" | "en";

export interface DiagnosticoExtraccion {
  /** `false` = los assets los sirve el servidor: no hay nada que carear (ver (c) arriba). */
  readonly esExtraccionDelVisitante: boolean;
  /** Rutas EXIGIDAS que la extracción no tiene, en el orden del catálogo. */
  readonly faltan: readonly string[];
}

/** Lo mínimo de `CacheStorage` que hace falta: se inyecta para poder probarlo. */
export interface AlmacenDeCaches {
  has(nombre: string): Promise<boolean>;
  open(nombre: string): Promise<{ keys(): Promise<readonly { url: string }[]> }>;
}

/**
 * Careo PURO: qué exigidos no están entre los presentes. Separado del acceso a la caché
 * porque es la mitad que se puede probar sin navegador — y la que decide el veredicto.
 */
export function assetsQueFaltan(
  presentes: Iterable<string>,
  exigidos: readonly string[] = ASSETS_EXIGIDOS,
): string[] {
  const hay = new Set(presentes);
  return exigidos.filter((ruta) => !hay.has(ruta));
}

/**
 * Rutas (relativas al prefijo) que hay HOY en la caché de la extracción.
 *
 * Las claves son URL absolutas del origen; se compara por `pathname` para que un
 * `?v=` o el host no rompan el careo.
 */
export function rutasDeClaves(claves: readonly { url: string }[], base: string): string[] {
  const out: string[] = [];
  for (const clave of claves) {
    let ruta: string;
    try {
      ruta = new URL(clave.url, base).pathname;
    } catch {
      continue;
    }
    if (ruta.startsWith(ASSETS_PREFIX)) out.push(ruta.slice(ASSETS_PREFIX.length));
  }
  return out;
}

/** Mira la caché del visitante y dice si su extracción se quedó corta. Nunca lanza. */
export async function diagnosticaExtraccion(
  caches: AlmacenDeCaches | undefined,
  base: string,
): Promise<DiagnosticoExtraccion> {
  const vacio = { esExtraccionDelVisitante: false, faltan: [] as string[] };
  if (!caches) return vacio;
  try {
    if (!(await caches.has(BYO_CACHE))) return vacio;
    const cache = await caches.open(BYO_CACHE);
    const presentes = rutasDeClaves(await cache.keys(), base);
    return { esExtraccionDelVisitante: true, faltan: assetsQueFaltan(presentes) };
  } catch {
    // Cache Storage puede estar prohibido (modo privado, contexto no seguro). Sin datos
    // no hay veredicto: se calla. Ver la ficha de proceso «no medido sólo si NO HAY DATOS»
    // — aquí ES el caso: la pregunta no se pudo hacer.
    return vacio;
  }
}

interface TextosAviso {
  readonly titulo: string;
  readonly cuerpo: string;
  readonly accion: string;
  readonly faltan: (n: number) => string;
  readonly cerrar: string;
}

const TEXTOS: Record<IdiomaAviso, TextosAviso> = {
  es: {
    titulo: "Tu extracción es de una versión anterior",
    cuerpo:
      "El juego ha aprendido cosas nuevas desde que cargaste tus ficheros, y tu copia de los " +
      "datos no las tiene. Vuelve a cargar tus ficheros del juego para verlas.",
    accion: "Volver a cargar mis ficheros",
    faltan: (n) => (n === 1 ? "Falta 1 dato:" : `Faltan ${n} datos:`),
    cerrar: "Cerrar el aviso",
  },
  en: {
    titulo: "Your extraction is from an older version",
    cuerpo:
      "The game has learnt new things since you loaded your files, and your copy of the data " +
      "doesn't have them. Load your game files again to see them.",
    accion: "Load my files again",
    faltan: (n) => (n === 1 ? "1 missing file:" : `${n} missing files:`),
    cerrar: "Dismiss",
  },
};

export interface OpcionesAviso {
  readonly doc: Document;
  /** Dónde colgarlo. Por defecto `doc.body`. */
  readonly anfitrion?: HTMLElement;
  readonly idioma: IdiomaAviso;
  /** A dónde lleva la acción. La landing de la extracción. */
  readonly urlByo?: string;
}

/** Id del aviso: único, para que dos llamadas no apilen dos bandas. */
export const ID_AVISO = "u5-extraccion-vieja";

/**
 * Pinta el aviso nombrando lo que falta. Devuelve el elemento (o `null` si no faltaba
 * nada: el caso normal, y por eso el aviso NO se construye «y luego se oculta»).
 *
 * 🔴 `target="_top"`: en /byo el juego vive dentro de un iframe. Sin esto, el enlace
 * cargaría la landing DENTRO del marco del juego — el visitante vería la página de
 * extracción incrustada en su propia partida.
 */
export function montaAvisoExtraccion(
  faltan: readonly string[],
  opciones: OpcionesAviso,
): HTMLElement | null {
  if (faltan.length === 0) return null;
  const { doc, idioma } = opciones;
  const t = TEXTOS[idioma];
  const anfitrion = opciones.anfitrion ?? doc.body;
  doc.getElementById(ID_AVISO)?.remove();

  const caja = doc.createElement("div");
  caja.id = ID_AVISO;
  caja.setAttribute("role", "alert");
  caja.style.cssText = [
    "position:fixed",
    "left:0",
    "right:0",
    "bottom:0",
    "z-index:2147483000",
    "background:#3a1414",
    "color:#f3e6d8",
    "border-top:2px solid #c8862a",
    "padding:12px 16px",
    "font:14px/1.45 system-ui,sans-serif",
    "display:flex",
    "flex-wrap:wrap",
    "gap:8px 16px",
    "align-items:center",
    "justify-content:center",
    "text-align:center",
  ].join(";");

  const texto = doc.createElement("div");
  const titulo = doc.createElement("strong");
  titulo.textContent = t.titulo;
  const cuerpo = doc.createElement("div");
  cuerpo.textContent = t.cuerpo;
  const lista = doc.createElement("div");
  lista.style.cssText = "opacity:.75;font-size:12px;margin-top:4px";
  // Se NOMBRA lo que falta, con el fichero del original del que sale: sin eso el aviso es
  // una corazonada («algo va mal») y quien nos escriba no podrá decirnos qué le pasó.
  lista.textContent = `${t.faltan(faltan.length)} ${faltan
    .map((ruta) => {
      const ficha = ASSET_POR_RUTA.get(ruta);
      return ficha ? `${ruta} (${ficha.de})` : ruta;
    })
    .join(" · ")}`;
  texto.append(titulo, cuerpo, lista);

  const accion = doc.createElement("a");
  accion.href = opciones.urlByo ?? "/byo";
  accion.target = "_top";
  accion.textContent = t.accion;
  accion.style.cssText = [
    "background:#c8862a",
    "color:#20120a",
    "font-weight:700",
    "text-decoration:none",
    "padding:8px 14px",
    "border-radius:4px",
    "white-space:nowrap",
  ].join(";");

  const cerrar = doc.createElement("button");
  cerrar.type = "button";
  cerrar.textContent = "✕";
  cerrar.setAttribute("aria-label", t.cerrar);
  // Anclado a la esquina y NO en el flujo: con el `flex-wrap` de la caja, un tercer hijo
  // se caía a una segunda línea él solo en cuanto el cuerpo del texto ocupaba el ancho
  // (visto en la captura de la sonda). El aviso es lo único que se lee: la ✕ no compite.
  cerrar.style.cssText =
    "position:absolute;top:4px;right:6px;background:none;border:0;color:inherit;" +
    "font-size:16px;line-height:1;cursor:pointer;padding:4px 8px";
  cerrar.addEventListener("click", () => caja.remove());

  caja.append(texto, accion, cerrar);
  anfitrion.appendChild(caja);
  return caja;
}

/**
 * Lo que llama el arranque: mira, y si falta algo avisa. No bloquea el boot — el juego
 * arranca igual y degrada como sepa; lo que cambia es que ahora lo DICE.
 */
export async function avisaSiLaExtraccionEsVieja(opciones: {
  readonly win: Window;
  readonly doc: Document;
  readonly idioma: IdiomaAviso;
  readonly anfitrion?: HTMLElement;
}): Promise<DiagnosticoExtraccion> {
  const almacen = (opciones.win as unknown as { caches?: AlmacenDeCaches }).caches;
  const diagnostico = await diagnosticaExtraccion(almacen, opciones.win.location.href);
  if (diagnostico.faltan.length > 0) {
    montaAvisoExtraccion(diagnostico.faltan, {
      doc: opciones.doc,
      idioma: opciones.idioma,
      ...(opciones.anfitrion ? { anfitrion: opciones.anfitrion } : {}),
    });
  }
  return diagnostico;
}
