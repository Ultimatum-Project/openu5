/**
 * Disponibilidad del atlas `/companion` — SONDA DE RUNTIME, no flag de build.
 *
 * Por qué no un flag: el MISMO `game/dist` alimenta dos destinos con contenido
 * distinto. El staging privado lleva `dist/companion` (lo copia el plugin
 * `companionAtlas` de vite.config.ts); la demo pública BYO lo excluye por rsync
 * (`docs/publicacion/build-demo-publica.sh`: sus mapas son RENDERIZADOS de datos
 * de EA). Un define de vite no puede distinguirlos — comparten build. Y el repo
 * público del génesis (`docs/publicacion/genesis-publico.sh`) ni siquiera lleva
 * el fuente `docs/manual/companion`, así que allí un build limpio tampoco lo
 * emite. La única fuente de verdad común a los tres casos es si `/companion/`
 * RESPONDE. Sin sonda, el menú SISTEMA ofrecía el enlace siempre y en el público
 * abría una pestaña 404 (auditoría de cierre 2026-07-27, hallazgo MEDIA).
 *
 * Por qué `data.json` y no `/companion/`: los dev-servers de vite (dev y preview)
 * hacen html-fallback — una ruta inexistente que ACEPTA text/html devuelve el
 * index del juego con 200, o sea un falso positivo. El fallback sólo actúa sobre
 * peticiones con `Accept: text/html`, así que sondear un fichero NO-html pidiendo
 * JSON lo esquiva por construcción y deja el 404 real a la vista.
 */

/** Ruta del atlas (la misma que abre el menú SISTEMA). */
export const COMPANION_URL = "/companion/";
/** Testigo no-html del atlas: existe si y sólo si el directorio entero viajó. */
const COMPANION_PROBE_URL = `${COMPANION_URL}data.json`;

let available = false;

/**
 * Lanza la sonda. La llama main.ts UNA vez al arrancar; el resultado queda
 * cacheado en el módulo y lo lee `companionAvailable()`. Nunca lanza: cualquier
 * fallo (red, host sin el atlas, fetch ausente) deja el atlas por AUSENTE, que es
 * el lado seguro (mejor no ofrecer el enlace que ofrecer un 404).
 */
export async function probeCompanion(fetchImpl?: typeof fetch): Promise<boolean> {
  try {
    const doFetch = fetchImpl ?? globalThis.fetch?.bind(globalThis);
    if (!doFetch) return (available = false);
    const res = await doFetch(COMPANION_PROBE_URL, {
      method: "HEAD",
      headers: { Accept: "application/json" },
    });
    available = res.ok;
  } catch {
    available = false;
  }
  return available;
}

/**
 * ¿Ofrecer el enlace al atlas? Falso mientras la sonda no haya respondido: el
 * drawer SISTEMA se construye perezosamente (main.ts pasa una FACTORÍA a
 * DebugPanel), así que para cuando el usuario abre el menú la sonda ya resolvió.
 */
export function companionAvailable(): boolean {
  return available;
}
