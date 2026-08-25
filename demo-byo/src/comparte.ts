/**
 * COMPARTIR UN MOMENTO POR URL — `…/byo?momento=momento-07`.
 *
 * ── QUÉ VIAJA EN EL ENLACE: UN IDENTIFICADOR, Y NADA MÁS ────────────────────────────────
 * 🔴 Ésta es la razón por la que la función existe tal como está y no de otra forma. Un
 * momento legendario NO es un fichero que se pueda mandar: se COMPONE en el navegador de
 * quien lo recibe, contra SU extracción (`momentos-instala.ts` §DE DÓNDE SALE LA BASE) —
 * el parche es dato nuestro y los personajes salen de la copia del visitante. Así que lo
 * que se comparte es la cadena `momento-07`, catorce bytes que ya están publicados en
 * `/momentos/momentos.json`. El enlace no puede llevar material de EA porque no lleva
 * material, punto; la propiedad es de CONSTRUCCIÓN y no de una comprobación que haya que
 * acordarse de hacer.
 *
 * ── EL ENLACE SE CONSTRUYE FILTRANDO, NO AÑADIENDO ──────────────────────────────────────
 * 🔴 `enlaceDeMomento` NO hace `location.href + "&momento=…"`. Descarta TODO lo demás de la
 * query y el fragmento, y el motivo es concreto: `/byo` admite `?fetchsrc=/ruta`, el modo de
 * prueba que baja los originales por HTTP desde un servidor local (`main.ts` §Modo de TEST).
 * Un «copiar enlace» que arrastrase la query entera repartiría enlaces con una ruta del disco
 * de quien copió — inútil para quien lo recibe y una fuga de su árbol de ficheros. Lo mismo
 * valdría para cualquier parámetro futuro: la lista blanca es de UNO.
 *
 * ── POR QUÉ LA DECISIÓN DE LLEGADA ES UNA FUNCIÓN PURA ──────────────────────────────────
 * `decideLlegada` no toca el DOM, no lee el almacén y no abre nada: recibe el id, el catálogo
 * y si hay copia, y devuelve QUÉ hay que hacer. Es lo que permite que el arnés
 * (`demo-byo/verificacion/verifica-comparte.mjs`) ejecute los cinco casos —incluidos los tres
 * que degradan— bajo node, sin navegador. Quien decide y quien pinta son dos cosas.
 */

/** El único parámetro que este módulo pone y lee. */
export const PARAM_MOMENTO = "momento";

/**
 * Forma de un id del catálogo (`momento-01`…`momento-10`).
 *
 * 🔴 SE VALIDA LA FORMA ANTES DE MIRAR EL CATÁLOGO, y no es paranoia de plantilla: el id
 * llega de una URL que ha escrito cualquiera, y aguas abajo se usa para pedir un `MomentoDef`
 * y para pintar texto en la pantalla. Filtrarlo aquí deja UNA puerta en vez de N sitios donde
 * acordarse. Y no sustituye a la comprobación contra el catálogo: una cadena BIEN FORMADA
 * puede nombrar un momento que no existe (`momento-99`), y ése es un caso distinto que se
 * dice con otras palabras.
 */
const FORMA_ID = /^momento-\d{2}$/;

/** El id que trae la URL, o `null` si no trae ninguno (o trae algo que no lo parece). */
export function momentoDeLaUrl(busqueda: string): string | null {
  let id: string | null;
  try {
    id = new URLSearchParams(busqueda).get(PARAM_MOMENTO);
  } catch {
    return null;
  }
  if (id === null) return null;
  return FORMA_ID.test(id) ? id : null;
}

/**
 * El enlace que se copia: la MISMA página, con `?momento=<id>` y nada más.
 *
 * `desde` es la URL actual (`location.href`). Se conservan origen y ruta —el enlace tiene que
 * seguir apuntando a este sitio, y en desarrollo a este puerto— y se tira la query y el
 * fragmento (ver la cabecera).
 */
export function enlaceDeMomento(id: string, desde: string): string {
  const u = new URL(desde);
  u.search = "";
  u.hash = "";
  u.searchParams.set(PARAM_MOMENTO, id);
  return u.toString();
}

/** Lo mínimo del catálogo que hace falta para decidir. */
export interface EntradaMinima {
  id: string;
  disponible: boolean;
}

/**
 * Qué hacer cuando alguien llega con un enlace de momento.
 *
 * `nada`         — no venía por un enlace de momento; la página se comporta como siempre.
 * `desconocido`  — el enlace nombra un id que este sitio no publica (enlace viejo, o roto).
 * `proximamente` — está en el catálogo pero todavía no se puede sembrar.
 * `sinCopia`     — se podría, pero este navegador no tiene la extracción.
 * `abre`         — todo en orden: se abre la galería en esa tarjeta.
 */
export type Llegada =
  | { k: "nada" }
  | { k: "desconocido"; id: string }
  | { k: "proximamente"; id: string }
  | { k: "sinCopia"; id: string }
  | { k: "abre"; id: string };

/**
 * La decisión, y **el orden de las comprobaciones es parte de ella**.
 *
 * 🔴 `desconocido` se comprueba ANTES que `sinCopia`. Con el orden inverso, quien recibiese un
 * enlace roto y encima no tuviera la extracción leería «hace falta tu copia», soltaría los 31
 * ficheros —que es el trabajo más caro de todo el sitio, decenas de segundos— y AL FINAL se
 * encontraría con que el enlace nunca iba a funcionar. Cada mensaje tiene que mandar al sitio
 * donde de verdad está el problema, y el del enlace roto no se arregla extrayendo nada.
 *
 * Por la misma razón `proximamente` va antes que `sinCopia`: un momento que aún no existe no
 * se destraba con la copia.
 *
 * 🔴 Y un catálogo VACÍO (la petición falló, `momentos.ts:leeCatalogo`) NO da `desconocido`:
 * daría «este momento no existe» sobre uno que sí existe, que es peor que no decir nada —
 * afirma sobre el enlace algo que en realidad no se sabe. Sin catálogo no hay veredicto y se
 * devuelve `nada`; la galería ya dice por su cuenta que no pudo cargar la lista.
 */
export function decideLlegada(
  id: string | null,
  catalogo: readonly EntradaMinima[],
  hayCopia: boolean,
): Llegada {
  if (id === null) return { k: "nada" };
  if (catalogo.length === 0) return { k: "nada" };
  const entrada = catalogo.find((m) => m.id === id);
  if (!entrada) return { k: "desconocido", id };
  if (!entrada.disponible) return { k: "proximamente", id };
  if (!hayCopia) return { k: "sinCopia", id };
  return { k: "abre", id };
}
