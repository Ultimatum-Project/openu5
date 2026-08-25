/**
 * ¿HAY ALGO QUE CONSENTIR? — la pregunta que el panel no se hacía.
 *
 * 🔴 EL DEFECTO QUE ORIGINA ESTE FICHERO (medido el 2026-08-04, con el sitio ya
 * publicado): el panel se abría en TODAS las superficies pidiendo permiso para dos
 * cosas, y **ninguna de las dos podía ocurrir**:
 *
 *   · `analitica` — `VITE_POSTHOG_KEY` iba VACÍA en los dos despliegues, así que el SDK
 *     no se cargaba y no salía ni una petición.
 *     🔴 ESO DEJÓ DE SER CIERTO EL 2026-08-05 y esta línea lo siguió afirmando cuatro
 *     días (ficha #129). Desde entonces el checkout PRINCIPAL tiene `demo-byo/.env` y
 *     `game/.env` con la clave: no están trackeados —así que NO viajan a los worktrees—
 *     y vite los hornea en cada build. El mismo comando produce una página CON analítica
 *     en el checkout principal y SIN ella en un worktree, y ninguna de las dos lo dice.
 *     ⚠️ Y NO SE BORRA LA FRASE, SE CUENTA: el 09-08 me llevó a firmar «#124 es un
 *     defecto LATENTE, en producción el panel no se abre solo» — falso, llevaba cuatro
 *     días tapando la zona de soltar. Medí un build limpio en MI worktree, di el
 *     resultado por el de producción, y esta línea me confirmó lo que quería creer. Un
 *     comentario que ya indujo un veredicto falso no se corrige en silencio: el próximo
 *     que mida sin `.env` va a llegar a mi misma conclusión, y tiene derecho a saber que
 *     el camino ya estaba pisado.
 *     ⇒ REGLA: la disponibilidad de la analítica NO se lee de aquí ni de ningún
 *     comentario. Se lee del entorno EFECTIVO del build que se está juzgando.
 *     ▸ **2026-08-09 — «iba VACÍA en los DOS despliegues» era media verdad, medido.**
 *       Censando todos los JS que sirve cada página en openu5.org: `/play` SÍ llevaba la
 *       clave (`assets/index-D986g1yA.js`) y `/byo` NO (ninguno de sus dos bundles). No
 *       eran dos poblaciones «worktree vs principal»: eran dos BUILDS distintos dentro del
 *       mismo despliegue —`npm run build` leía `game/.env`, `vite build demo-byo` necesitaba
 *       `demo-byo/.env`— y la página con más visitas llevaba quién sabe cuánto sin enviar
 *       nada. Nadie lo notó porque el modo sin clave es un no-op por diseño.
 *     ▸ **2026-08-09 — cerrado (#129).** El token de proyecto vive ahora en
 *       `analitica-credenciales.ts` con su razón escrita; los `.env` sólo mandan en DEV,
 *       con la precedencia declarada allí. Hay UNA población: sin ficheros de entorno, el
 *       build de cualquier checkout sale con las credenciales de producción, y el
 *       ensamblador enrojece si un bundle publicable saliera sin ellas. ⇒ desde este
 *       commit, `analitica` está DISPONIBLE de verdad en los dos despliegues, y el permiso
 *       que el panel pide por ella ya tiene efecto.
 *   · `partida` — **NADIE LEE ESE PERMISO.** El carril de repeticiones guarda en
 *     IndexedDB local; la subida (Cloudflare KV+D1) está diseñada y NO cableada. Se
 *     verificó por grep sobre `game/src`: cero consumidores de `consentimiento.partida`
 *     fuera del propio panel y del módulo que lo guarda.
 *
 * Así que el aviso decía «si no activas ninguno, este sitio no envía nada a nadie» —
 * cierto— y **callaba que activando los dos tampoco envía nada**. No es un problema de
 * privacidad (no se filtra nada; ése era el compromiso y se cumple): es que **pedimos
 * una decisión que no tiene efecto**, y una casilla que no hace nada erosiona la
 * credibilidad de las que sí lo harán el día que se cableen.
 *
 * REGLA: se pregunta por lo que PUEDE pasar, no por lo que algún día pasará.
 *
 * Y la disponibilidad se declara AQUÍ, en un solo sitio y con su porqué, en vez de
 * repartirse por condicionales dentro del panel: cuando el carril de la subida aterrice,
 * lo que tiene que cambiar es UNA constante — y `test_web_disponibilidad` se pone rojo
 * nombrándola si aparece un consumidor mientras sigue en `false`.
 */
import type { Superficie } from "./superficies.js";

/**
 * ¿Está CABLEADA la subida de partidas (el permiso `partida`)?
 *
 * 🔴 `false` a propósito, y no es pesimismo: es el estado medido del árbol. Ponlo a
 * `true` EN EL MISMO COMMIT que cablee el consumidor —el que lee `partida` antes de
 * subir— y no antes. Ponerlo a `true` mientras nadie lo lee devuelve exactamente el
 * defecto que este fichero corrige: una casilla que promete algo que no ocurre.
 */
export const SUBIDA_DE_PARTIDA_CABLEADA = false;

/** Qué permisos pueden hacer algo AQUÍ Y AHORA. */
export interface Disponibilidad {
  /** La analítica puede enviar: hay clave Y la superficie la admite. */
  readonly analitica: boolean;
  /** La subida de partida puede enviar: hay consumidor cableado. */
  readonly partida: boolean;
}

export interface EntradaDisponibilidad {
  /** `VITE_POSTHOG_KEY` ya recortada. Vacía ⇒ no se carga SDK ⇒ no hay envíos. */
  readonly clave: string;
  readonly superficie: Superficie;
  /** Inyectable para el test; por defecto, el estado real del árbol. */
  readonly subidaCableada?: boolean;
}

/**
 * La analítica requiere clave. NO se restringe además por superficie: en `play` la
 * GRABACIÓN de sesión está prohibida (`permiteGrabacionSesion`, lista blanca), pero
 * los eventos sin DOM sí son legítimos ahí, así que con clave hay algo que consentir
 * también en el juego. Separar las dos cosas es justo lo que evita que «en play no se
 * graba» se degrade a «en play no se pregunta» y viceversa.
 */
export function disponibilidadDe(e: EntradaDisponibilidad): Disponibilidad {
  return {
    analitica: e.clave.trim().length > 0,
    partida: e.subidaCableada ?? SUBIDA_DE_PARTIDA_CABLEADA,
  };
}

/** ¿Merece la pena preguntar? Falso ⇒ el panel NO se abre solo. */
export function hayAlgoQueConsentir(d: Disponibilidad): boolean {
  return d.analitica || d.partida;
}

/**
 * ¿Se puede abrir el panel SOLO, tapando la página, al arrancar?
 *
 * 🔴 En `play` NUNCA, aunque haya algo que consentir. El juego es un `<canvas>` a
 * pantalla completa: medido el 2026-08-04 en 1280×800, el panel ocupaba **la mitad
 * inferior** del lienzo, y en un teléfono es peor. Quien abre `/play` viene a jugar,
 * y el permiso que le afecta ahí (subir su partida) sólo importa **cuando intenta
 * subirla** — momento en el que preguntar es informativo en vez de intrusivo.
 *
 * En `portada` y `byo` sí: son páginas de lectura, el aviso no tapa una tarea en curso,
 * y es donde la analítica de embudo tiene sentido.
 */
export function puedeAbrirseSolo(superficie: Superficie, d: Disponibilidad): boolean {
  if (superficie === "play") return false;
  return hayAlgoQueConsentir(d);
}
