/**
 * RÉGIMEN TÁCTIL — la única fuente de verdad sobre «¿esta sesión es táctil AHORA?».
 *
 * POR QUÉ EXISTE (#334). El predicado `(pointer: coarse) || ?touch=1` estaba escrito a
 * mano en SIETE sitios de `game/src`, y CINCO de ellos lo evaluaban una sola vez y no
 * volvían a mirar. El puntero PRIMARIO sí cambia en caliente en un 2-en-1 (plegar a
 * tableta, enchufar un ratón), así que el port no llegaba tarde de forma uniforme: los
 * dos sitios que sí evalúan por llamada —el ajuste de escala de las pieles y la intro—
 * SEGUÍAN el cambio mientras los cinco restantes no. El defecto no era retraso, era
 * DIVERGENCIA: dos verdades simultáneas sobre lo mismo.
 *
 * El repo ya había nombrado el riesgo sin poder evitarlo: `skin/portrait/deck-dom.ts`
 * reusa el predicado ajeno «en vez de duplicar la detección (matchMedia) y arriesgar dos
 * verdades distintas». Este módulo es ese sitio único.
 *
 * ALCANCE DE HOY: lo consume el deck (`ui/touch.ts`). Los otros cuatro rancios —⚙
 * (`shell/gear.ts`), 🌐 (`shell/languageSwitcher.ts`), ◧ (`shell/skinSwitcher.ts`) y el
 * `pantallaTactil` cacheado de `main.ts`— migran en #336, con el censo ya hecho. Por eso
 * la suscripción admite VARIOS oyentes desde el primer día: que el segundo consumidor no
 * tenga que rehacer el módulo.
 *
 * 🔴 `?touch=1` MANDA SOBRE LA MEDIA QUERY, y no es sólo del arnés de pruebas: es la
 * salida documentada del caso ambiguo (#333) — un portátil táctil que el detector
 * clasifique como escritorio, o alguien que quiera el deck a propósito. Por eso el
 * parámetro no se consulta «además» sino ANTES, y un cambio de puntero no puede
 * apagar un régimen que la URL dejó encendido.
 */

/** Query única. Se nombra una vez para que no puedan divergir el lector y el oyente. */
const CONSULTA = "(pointer: coarse)";

/** `true` si la URL fuerza el régimen táctil. Puerta del caso ambiguo (#333). */
function forzadoPorUrl(): boolean {
  try {
    return new URLSearchParams(window.location.search).has("touch");
  } catch {
    return false;
  }
}

/**
 * ¿Régimen táctil AHORA? Se lee cada vez; no cachea. Sin `matchMedia` (tests en node,
 * navegadores muy viejos) degrada a «lo que diga la URL», que en su ausencia es `false`
 * = escritorio — el mismo default seguro que ya usaban `esPantallaTactil` y
 * `prefersMobileFit`.
 */
export function esTactilAhora(): boolean {
  if (forzadoPorUrl()) return true;
  try {
    return window.matchMedia(CONSULTA).matches;
  } catch {
    return false;
  }
}

/** Oyente del cambio de régimen. Recibe el régimen YA RESUELTO, no el estado crudo. */
export type OyenteRegimen = (tactil: boolean) => void;

/**
 * Suscribe al cambio de puntero primario. Devuelve la baja.
 *
 * El oyente recibe `esTactilAhora()`, no `ev.matches`: con `?touch=1` puesto el régimen
 * es `true` pase lo que pase con la media query, y quien escuche debe ver esa verdad y
 * no la cruda. (Ésta es justo la diferencia que un `mq.addEventListener` pelado en cada
 * consumidor volvería a perder — el motivo de que la suscripción viva aquí.)
 *
 * `addEventListener` sobre MediaQueryList es Safari 14+; por debajo sólo existe el
 * `addListener` deprecado, y el deck se sirve en teléfonos viejos. Mismo par de caminos
 * que ya usa la escucha de orientación en `ui/touch.ts`.
 */
export function onCambioRegimenTactil(cb: OyenteRegimen): () => void {
  let mq: MediaQueryList;
  try {
    mq = window.matchMedia(CONSULTA);
  } catch {
    return () => {}; // sin matchMedia no hay cambios que oír; la baja es un no-op.
  }
  const alCambiar = (): void => cb(esTactilAhora());
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }
  const viejo = mq as unknown as {
    addListener?: (cb: () => void) => void;
    removeListener?: (cb: () => void) => void;
  };
  viejo.addListener?.(alCambiar);
  return () => viejo.removeListener?.(alCambiar);
}
