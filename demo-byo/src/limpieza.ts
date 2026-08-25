/**
 * BORRADO TOTAL de lo que este sitio guarda en el navegador del visitante.
 *
 * ── QUÉ AÑADE ESTO A LO QUE YA HABÍA ────────────────────────────────────────────────
 * `/byo` ya tenía un botón «Borrar», y borraba TRES cosas: la Cache Storage de la
 * extracción (`clearExtraction`), las partidas (`clearAllSaves`) y las repeticiones
 * (`clearAllLogs`). Con eso el rótulo que imprimía —«este navegador ya no guarda nada de
 * tu copia»— era cierto de LA COPIA y falso del navegador: seguían ahí el idioma, el
 * consentimiento, la piel, el volumen, el lado del pad, la última coordenada del
 * teletransporte del menú debug… y el SERVICE WORKER registrado. Quien pulsaba «borrar»
 * y recargaba no volvía a ser un visitante nuevo: volvía a ser el mismo con la carpeta
 * quitada.
 *
 * ── LA LISTA SALE DEL CENSO DEL CÓDIGO, NO DE LA MEMORIA ────────────────────────────
 * 🔴 Y NO ES UNA PROMESA, ES UNA PUERTA: `re/tools/test_byo_limpieza.py` recorre
 * `game/src`, `demo-byo/src` y `extractor/src`, resuelve TODO literal que llegue a un
 * `.setItem(` (incluidos los que viajan por constante importada y renombrada, que son la
 * mayoría) y se pone ROJO nombrando la clave que estos prefijos no cubran. Una clave
 * nueva en cualquier subsistema enrojece ahí, no aquí — que es la única forma de que esta
 * lista no envejezca en silencio. Un barrido que se queda corto no da error: deja restos
 * y sigue imprimiendo «borrado», que es la peor forma de fallar para esto.
 *
 * 🔴 Y NO ES `localStorage.clear()`, aunque hoy daría el mismo conjunto. `clear()` es un
 * predicado sobre el ORIGEN, no sobre «lo que escribe este sitio»: el día que la raíz
 * del dominio aloje cualquier otra cosa con estado —y la raíz del dominio es la portada,
 * que ya crece— este botón se lo llevaría por delante sin que nadie lo hubiera decidido.
 * Por prefijos, el alcance está escrito y es auditable.
 *
 * ── LOS CUATRO ALMACENES ────────────────────────────────────────────────────────────
 * `localStorage` (aquí), `Cache Storage` (aquí), `IndexedDB` (en `replay/store.ts`, que
 * VACÍA el almacén en vez de borrar la base — ver allí por qué `deleteDatabase` se cuelga)
 * y el registro del `service worker` (aquí).
 */

/**
 * Los CUATRO prefijos con los que este sitio nombra sus claves de `localStorage`.
 *
 * Censo del 08-08 y de dónde sale cada uno:
 *   · `u5clone:` — partidas y su maquinaria (`core/save-keys.ts:22,24,35,37`:
 *     `u5clone:saves`, `u5clone:save:<id>`, `u5clone:shot:<id>`, `u5clone:autosavePtr`)
 *     y los ajustes de piel con dos puntos (`skin/fiel/skin.ts:166` aspect43,
 *     `skin/shader/skin.ts:128,207,240` y `shader/actor-transparency.ts:24`,
 *     `ui/intro-shader.ts:41`).
 *   · `u5.` — preferencias del shell: `u5.skin` (`main.ts:155`), `u5.lang`
 *     (`i18n/index.ts:81`), `u5.padSide` (`ui/touch.ts:257`), `u5.music` y
 *     `u5.musicVolume` (`ui/music.ts:34,57`), `u5.reflow` (`skin/portrait/skin.ts:71`),
 *     `u5.speaker` (`skin/fiel/speaker.ts:705`), `u5.cursoresLado` y `u5.layoutPartido`
 *     (`skin/portrait/deck-nativo.ts:108,116`).
 *   · `u5dbg-` — el menú debug del juego (`debug/teleportPicker.ts:40`).
 *   · `openu5-` — lo que guarda el SITIO. Compartido por las tres superficies: `openu5-lang`
 *     (`web/arranque.ts:31`, la misma que escribe el conmutador de la portada) y
 *     `openu5-consentimiento` (`web/consentimiento.ts:35`). Y de la página BYO,
 *     `openu5-momentos-aperturas` (`insignias.ts:71`: qué momentos legendarios se abrieron
 *     y cuándo).
 *
 * 🔴 El consentimiento SE VA con lo demás, y es una decisión, no un descuido: «dejar este
 * navegador como estaba antes de conocerme» incluye no recordar qué contestó el visitante
 * al panel de permisos. La consecuencia visible —el panel vuelve a preguntar— es correcta
 * y se anuncia en la confirmación.
 */
export const PREFIJOS_LOCALSTORAGE = ["u5clone:", "u5.", "u5dbg-", "openu5-"] as const;

/**
 * Y el de las cachés. Hoy sólo existe `u5-assets-v1` (`extractor/src/browser.ts:22`,
 * mismo nombre en `demo-byo/public/sw.js:7`), pero el barrido va POR PREFIJO para que una
 * `v2` futura —que es justo la forma que tendría una migración de formato— no se quede
 * ocupando disco de alguien que pidió que no quedara nada.
 */
export const PREFIJO_CACHES = "u5-";

/** Lo que se fue, MEDIDO al borrar. Lo que se pinta detrás sale de aquí, no de una lista previa. */
export interface ResumenLimpieza {
  /** Claves de `localStorage` retiradas, por su nombre. */
  claves: string[];
  /** Nombres de Cache Storage borrados. */
  caches: string[];
  /** Registros de service worker dados de baja. */
  serviceWorkers: number;
}

/** ¿La cubre alguno de los prefijos del censo? */
export function cubierta(clave: string): boolean {
  return PREFIJOS_LOCALSTORAGE.some((p) => clave.startsWith(p));
}

/**
 * Borra las claves de `localStorage` que este sitio escribe. Devuelve las retiradas.
 *
 * 🔴 Las claves se SACAN A UNA LISTA ANTES de borrar ninguna. `Object.keys` sobre
 * `Storage` da una foto, pero recorrer por índice (`localStorage.key(i)`) borrando dentro
 * del bucle re-indexa la colección y se salta una de cada dos — el clásico que deja
 * exactamente la mitad de los restos y sigue diciendo «borrado».
 */
export function borraClaves(storage: Storage = localStorage): string[] {
  let todas: string[];
  try {
    todas = Object.keys(storage);
  } catch {
    return []; // almacenamiento bloqueado (modo privado): no hay nada que barrer
  }
  const fuera = todas.filter(cubierta);
  for (const k of fuera) {
    try {
      storage.removeItem(k);
    } catch {
      /* una clave que no se deja borrar no puede tumbar el resto del barrido */
    }
  }
  return fuera;
}

/** Borra las Cache Storage de este sitio. Devuelve los nombres que se fueron. */
export async function borraCaches(): Promise<string[]> {
  if (typeof caches === "undefined") return [];
  let nombres: string[];
  try {
    nombres = await caches.keys();
  } catch {
    return [];
  }
  const fuera = nombres.filter((n) => n.startsWith(PREFIJO_CACHES));
  for (const n of fuera) {
    try {
      await caches.delete(n);
    } catch {
      /* idem */
    }
  }
  return fuera;
}

/**
 * Da de baja los service workers de este origen. Devuelve cuántos.
 *
 * Sin él, el SW sigue vivo tras el borrado y sigue interceptando `/assets/*` — inofensivo
 * con la caché ya vacía (cae a la red y da 404), pero es código nuestro corriendo en el
 * navegador de quien acaba de pedir que no quede nada. Se va.
 */
export async function desregistraServiceWorkers(): Promise<number> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return 0;
  let regs: readonly ServiceWorkerRegistration[];
  try {
    regs = await navigator.serviceWorker.getRegistrations();
  } catch {
    return 0;
  }
  let n = 0;
  for (const r of regs) {
    try {
      if (await r.unregister()) n++;
    } catch {
      /* idem */
    }
  }
  return n;
}

/**
 * El barrido completo. NUNCA lanza: cada almacén falla por su cuenta y lo que sí se pudo
 * borrar se borra igual — un botón destructivo que aborta a la mitad deja al visitante sin
 * saber en qué estado quedó, que es peor que un resumen incompleto pero honesto.
 */
export async function borraDatosLocales(): Promise<ResumenLimpieza> {
  const claves = borraClaves();
  const cachesFuera = await borraCaches();
  const serviceWorkers = await desregistraServiceWorkers();
  return { claves, caches: cachesFuera, serviceWorkers };
}
