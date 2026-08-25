/**
 * ANCHO Y ALTO DE UN dataURL PNG, leyendo su IHDR. Módulo HOJA a propósito.
 *
 * ── POR QUÉ VIVE SOLO EN SU FICHERO ────────────────────────────────────────────────────
 * Lo necesitan DOS consumidores en lados opuestos del reparto: `ui/shot-refresh.ts` (el
 * juego, para decidir si rehace una miniatura al cargar) y `demo-byo/src/partidas.ts` (la
 * landing, para decidir si la tarjeta ofrece «Regenerar»). Si /byo lo importara de
 * `shot-refresh`, se traería su grafo entero —`core/save-keys` y `ui/screenshot`— a un
 * bundle cuyo trabajo es leer una carpeta y pintar una lista.
 * 🔴 Y eso NO es una cautela teórica: en este mismo repo UN import de una constante se
 * llevó 477 KB de i18n con diálogo de EA dentro al bundle publicado. La regla que salió de
 * allí es medir el bundle al importar; la que sale de aquí es no ponerse en el caso.
 *
 * La alternativa —copiar el parser en /byo— sería una segunda fuente de verdad del formato
 * PNG que puede divergir en silencio y cuya divergencia no da error: da una decisión de
 * miniatura distinta en cada lado.
 */

const PREFIJO_PNG = "data:image/png;base64,";
/** 33 B de cabecera PNG (8 firma + 4 longitud + 4 «IHDR» + 4 ancho + 4 alto) = 44 de base64. */
const CABECERA_B64 = 44;

/**
 * Ancho y alto de un dataURL PNG leyendo su IHDR, o `null` si no es un PNG legible.
 *
 * Se parsea la cabecera en vez de decodificar la imagen con un `<Image>` a propósito: esto es
 * SÍNCRONO y no depende del navegador, así que los predicados que lo consumen se pueden
 * probar en un test sin canvas. El `null` cubre las capturas jpeg ANTIGUAS y cualquier cosa
 * ilegible, y los dos llamadores lo tratan como «ésta no es la pantalla canónica» — que es lo
 * correcto para las dos.
 */
export function medirPng(dataUrl: string): { width: number; height: number } | null {
  if (!dataUrl.startsWith(PREFIJO_PNG)) return null;
  const b64 = dataUrl.slice(PREFIJO_PNG.length, PREFIJO_PNG.length + CABECERA_B64);
  if (b64.length < CABECERA_B64) return null;
  let bytes: string;
  try {
    bytes = atob(b64);
  } catch {
    return null;
  }
  if (bytes.length < 33) return null;
  // Firma \x89PNG y trozo IHDR: sin las dos, los cuatro bytes de «ancho» son otra cosa.
  if (bytes.charCodeAt(0) !== 0x89 || bytes.slice(1, 4) !== "PNG") return null;
  if (bytes.slice(12, 16) !== "IHDR") return null;
  const u32 = (o: number): number =>
    ((bytes.charCodeAt(o) << 24) |
      (bytes.charCodeAt(o + 1) << 16) |
      (bytes.charCodeAt(o + 2) << 8) |
      bytes.charCodeAt(o + 3)) >>>
    0;
  return { width: u32(16), height: u32(20) };
}

/**
 * ¿Esta miniatura es LA PANTALLA CANÓNICA de 1988, o una foto del teléfono?
 *
 * ── QUÉ DECIDE, Y QUÉ **NO** ───────────────────────────────────────────────────────────
 * Decide si a la tarjeta le merece la pena OFRECER regenerar. NO decide re-capturar sola:
 * esa la sigue tomando `shot-refresh.debeRecapturar`, y su criterio es otro A PROPÓSITO
 * (mira si la piel DECLARA su búfer, porque una re-captura automática desde una piel sin
 * declaración pisaría una miniatura buena con el teléfono entero — el criterio ingenuo por
 * dimensiones está INVERTIDO en ese caso). Aquí el criterio por proporción sí vale, y por
 * una razón que allí no se da: lo que dispara la regeneración es un CLIC, y la captura se
 * produce en un iframe que el propio /byo monta a 960×600, donde la piel fiel siempre
 * declara. El resultado no puede ser peor que lo que había.
 *
 * ★★ La misma magnitud con dos criterios distintos no es una incoherencia: es que las dos
 * preguntas son distintas. «¿Puedo mejorarla YO ahora mismo sin preguntar?» y «¿le digo al
 * visitante que puede pedir una mejor?» no se contestan con el mismo predicado.
 *
 * Se compara la PROPORCIÓN y no el tamaño exacto para no cablear aquí la geometría de la
 * pantalla (vive en `skin/fiel/frame.ts`): una piel que algún día renderice nativo a 640×400
 * sigue siendo canónica. Tolerancia de 0,02 para el redondeo de la cabecera.
 */
export const PROPORCION_CANONICA = 320 / 200;

export function esCapturaCanonica(dataUrl: string | null): boolean {
  if (!dataUrl) return false;
  const d = medirPng(dataUrl);
  if (!d || !d.width || !d.height) return false; // jpeg viejo o ilegible: no es canónica
  return Math.abs(d.width / d.height - PROPORCION_CANONICA) < 0.02;
}
