/**
 * NOMBRE DE PANTALLA de una localización — el que lee una persona, no el identificador
 * con el que la extracción la nombra.
 *
 * ── EL DEFECTO QUE LO TRAE ────────────────────────────────────────────────────────────────
 * Reportado por el usuario sobre la lista de guardados: «Palace_of_Blackthorn · turn 4 · …».
 * El productor era `skin/coreview.ts locationName()`, que devolvía
 * `world.smallMaps.get(loc).name` — y ese `name` viene de `extractor/src/data/locations.ts`,
 * donde es un IDENTIFICADOR DE MÁQUINA: sirve para casar la location con su fichero .DAT y
 * su orden de plantas, y por eso lleva guiones bajos. Nunca fue un nombre de pantalla.
 * No afectaba sólo a Blackthorn: **catorce de las treinta y dos** localizaciones tienen
 * guion bajo en su identificador (`Skara_Brae`, `New_Magincia`, `Serpents_Hold`…).
 *
 * ── DE DÓNDE SALE EL NOMBRE BUENO ─────────────────────────────────────────────────────────
 * Del juego de 1988, no de aquí. `DATA.OVL` fileoff 0x0a4d (= DS 0x1e3a en ejecución) lleva
 * el pool `locationNames`, que es el que el propio original imprime al entrar en un sitio
 * (emisor OUTSUBS 0x3cb). `game/src/core/game.ts locationNameBanner()` ya lo usaba para el
 * banner, con el mapeo de índice del array EMPAQUETADO —el extractor omite las entradas
 * nulas— que se reutiliza aquí tal cual: **ids 1-13 → idx id-1, ids ≥19 → idx id-6**.
 *
 * ── LOS CINCO QUE EL ORIGINAL NO NOMBRA ───────────────────────────────────────────────────
 * 🔴 Y AQUÍ ESTÁ LA IRONÍA DEL REPORTE: la location que el usuario vio mal es una de las
 * CINCO que el original deja sin nombre. Las entradas 13-17 de la tabla DS 0x1e3a valen
 * 0x0000 y el emisor las SALTA (`cmp si,0xd` / `cmp si,0x11` en OUTSUBS 0x3c1-0x3c9) — son
 * las locations 14-18: las tres cabañas (Sutek, SinVraal, Grendel) y los DOS castillos
 * (Lord British y Blackthorn). En 1988 entrar en el palacio de Blackthorn no imprime su
 * nombre en ningún sitio. Comprobado por dos vías: la tabla, y un barrido de las cadenas
 * extraídas (`game/assets/*.json`) que no devuelve ni «Blackthorn» ni «Sutek» ni «Grendel»
 * como topónimo — sólo «Blackthorn» como NOMBRE DE PERSONAJE en `monsterNamesMixed` y en la
 * prosa del final.
 * ⇒ para esos cinco el port TIENE que poner un nombre suyo, y eso se declara aquí en vez de
 * disimularlo. Dos de ellos NO se inventan: se copian literalmente de los nombres que este
 * mismo proyecto YA PUBLICA en la galería de momentos
 * (`demo-byo/public/momentos/momentos.json`, momento-06 y momento-07) — llamar al mismo sitio
 * de dos maneras en dos pantallas del mismo sitio web sería un defecto nuevo. Los otros tres
 * (las cabañas, que ningún momento visita) salen del identificador del extractor con los
 * guiones bajos sustituidos por espacios, que es una transformación mecánica y nada más:
 * «Suteks Hut», sin apóstrofo, porque el apóstrofo sería un juicio y no una derivación.
 *
 * ── POR QUÉ CAPITALIZACIÓN DE TÍTULO Y NO LAS MAYÚSCULAS DEL ORIGINAL ─────────────────────
 * El pool está en MAYÚSCULAS («SKARA BRAE») porque así se imprime en la pantalla de 1988, y
 * el banner del juego lo sigue emitiendo tal cual: eso NO se toca. Pero la tarjeta de un
 * guardado no es una pantalla de 1988 —lleva al lado «turn 4 · 8/8/2026 05:29 PM»—, y ahí el
 * registro que corresponde es el mismo que ya usan las tarjetas de momentos.
 * El control de que la transformación es la correcta no es una opinión: title-case del pool
 * reproduce EXACTAMENTE, carácter a carácter, los cuatro nombres que `momentos.json` publica
 * para locations con entrada en la tabla (Iolo's Hut · The Lycaeum · Empath Abbey ·
 * Serpent's Hold) y los OCHO nombres de mazmorra de `extractor/src/parsers/dungeon.ts`
 * (Deceit … Doom). Dos fuentes independientes, doce coincidencias, cero divergencias.
 *
 * 🔴 TRAMPA DEL TITLE-CASE, y es la que mata a la implementación obvia: `\b` o «pon en alta
 * la letra que sigue a un no-alfabético» convierte «IOLO'S HUT» en «Iolo'S Hut». El apóstrofo
 * NO abre palabra. Aquí sólo abre palabra el principio de la cadena y el ESPACIO — y hay
 * tres nombres en el pool que lo instancian (IOLO'S HUT, BUCCANEER'S DEN, SERPENT'S HOLD),
 * así que el testigo no es degenerado.
 */

/** Location del sobremundo: no tiene mapa pequeño ni entrada en el pool. */
export const OVERWORLD_LOCATION = 0;

/**
 * Las CINCO locations sin nombre en `DATA.OVL` (entradas 13-17 de DS 0x1e3a = 0x0000).
 * Es el conjunto que el emisor del original SALTA, y por tanto el que este fichero tiene
 * que rellenar por su cuenta. Se declara como constante y no como rango suelto para que el
 * test pueda aseverar que sigue siendo EXACTAMENTE éste: si un día el extractor dejara de
 * empaquetar, el conjunto cambiaría y el mapeo de índices de abajo mentiría en silencio.
 */
export const LOCATIONS_SIN_NOMBRE_EN_EL_ORIGINAL: readonly number[] = [14, 15, 16, 17, 18];

/**
 * Identificador de máquina (el `name` de `extractor/src/data/locations.ts`) por location.
 *
 * Está COPIADO, y la copia es deliberada: `game/src` no puede importar de `extractor/`, y la
 * alternativa —adivinar el identificador desde el nombre de pantalla— no tiene inversa
 * («The Lycaeum» no da `Lycaeum`). Lo que impide que la copia derive es el test, que la carea
 * entrada por entrada contra el fichero del extractor.
 */
export const LOCATION_SLUGS: Readonly<Record<number, string>> = {
  1: "Moonglow",
  2: "Britain",
  3: "Jhelom",
  4: "Yew",
  5: "Minoc",
  6: "Trinsic",
  7: "Skara_Brae",
  8: "New_Magincia",
  9: "Fogsbane",
  10: "Stormcrow",
  11: "Greyhaven",
  12: "Waveguide",
  13: "Iolos_Hut",
  14: "Suteks_Hut",
  15: "SinVraals_Hut",
  16: "Grendels_Hut",
  17: "Lord_Britishs_Castle",
  18: "Palace_of_Blackthorn",
  19: "West_Britanny",
  20: "North_Britanny",
  21: "East_Britanny",
  22: "Paws",
  23: "Cove",
  24: "Buccaneers_Den",
  25: "Ararat",
  26: "Bordermarch",
  27: "Farthing",
  28: "Windemere",
  29: "Stonegate",
  30: "Lycaeum",
  31: "Empath_Abbey",
  32: "Serpents_Hold",
};

/**
 * Nombre de pantalla por location, YA DERIVADO.
 *
 * Existe porque hay consumidores que NO tienen `data.locationNames` a mano: la lista de
 * guardados de `/byo` sólo ve la cadena que el índice guardó, sin extracción cargada. Es una
 * FOTO de la derivación, y una foto caduca: el test la re-deriva del pool y del
 * `momentos.json` en cada corrida y se pone rojo al primer carácter de diferencia. Quien
 * quiera cambiar un nombre tiene que cambiar la fuente, no esta tabla.
 */
export const LOCATION_DISPLAY_NAMES: Readonly<Record<number, string>> = {
  1: "Moonglow",
  2: "Britain",
  3: "Jhelom",
  4: "Yew",
  5: "Minoc",
  6: "Trinsic",
  7: "Skara Brae",
  8: "New Magincia",
  9: "Fogsbane",
  10: "Stormcrow",
  11: "Greyhaven",
  12: "Waveguide",
  13: "Iolo's Hut",
  // ── los cinco que el original no nombra ──
  14: "Suteks Hut", // de-slug del identificador; el original no lo nombra
  15: "SinVraals Hut", // idem
  16: "Grendels Hut", // idem
  17: "Lord British's Castle", // momentos.json momento-07 lugar.en
  18: "Palace of Blackthorn", // momentos.json momento-06 lugar.en
  // ─────────────────────────────────────────
  19: "West Britanny",
  20: "North Britanny",
  21: "East Britanny",
  22: "Paws",
  23: "Cove",
  24: "Buccaneer's Den",
  25: "Ararat",
  26: "Bordermarch",
  27: "Farthing",
  28: "Windemere",
  29: "Stonegate",
  30: "The Lycaeum",
  31: "Empath Abbey",
  32: "Serpent's Hold",
};

/**
 * Índice en el pool EMPAQUETADO de `data.locationNames` para una location, o `-1` si el
 * original no la nombra.
 *
 * El mapeo es el mismo que `game.ts locationNameBanner()` y por la misma razón: el extractor
 * omite las cinco entradas nulas, así que a partir de la location 19 el índice va SEIS por
 * detrás y no uno. Un `id-1` llano devuelve el nombre de OTRO sitio — silenciosamente.
 */
export function poolIndexForLocation(id: number): number {
  if (id <= 0 || id > 32) return -1;
  if (LOCATIONS_SIN_NOMBRE_EN_EL_ORIGINAL.includes(id)) return -1;
  return id <= 13 ? id - 1 : id - 6;
}

/**
 * MAYÚSCULAS del pool → capitalización de título, preservando el apóstrofo dentro de la
 * palabra. Sólo el principio de la cadena y el espacio abren palabra: ver la trampa en la
 * cabecera («IOLO'S HUT» → «Iolo's Hut», nunca «Iolo'S Hut»).
 */
export function titleCaseLocation(caps: string): string {
  return caps
    .toLowerCase()
    .replace(/(^| )([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/**
 * Nombre de pantalla de una location.
 *
 * `locationNames` es el pool VIVO de la extracción del visitante cuando lo hay: /byo es
 * «trae tu copia», y si su DATA.OVL nombra un sitio de otra manera manda la suya, no nuestra
 * foto. Sin pool (o para las cinco sin nombre) cae en `LOCATION_DISPLAY_NAMES`. Location
 * desconocida ⇒ cadena vacía: quien llame decide qué poner, que aquí inventarse un «?» sería
 * meterle un carácter en la tarjeta a alguien.
 */
export function locationDisplayName(id: number, locationNames?: readonly string[]): string {
  const idx = poolIndexForLocation(id);
  const crudo = idx >= 0 ? locationNames?.[idx] : undefined;
  if (crudo) return titleCaseLocation(crudo);
  return LOCATION_DISPLAY_NAMES[id] ?? "";
}

/** Índice inverso slug→nombre, construido UNA vez. Claves en minúscula: ver `legible…`. */
const PorSlug: ReadonlyMap<string, string> = new Map(
  Object.entries(LOCATION_SLUGS).map(([id, slug]) => [
    slug.toLowerCase(),
    LOCATION_DISPLAY_NAMES[Number(id)] ?? "",
  ]),
);

/**
 * Traduce a nombre de pantalla una cadena YA GUARDADA en el índice de partidas.
 *
 * 🔴 EXISTE PORQUE LOS GUARDADOS VIEJOS NO SE MIGRAN, y eso es una decisión, no una pereza:
 * `SaveMeta.locationName` es una CADENA (no hay id de location en el índice — ver
 * `core/save-keys.ts`), viaja dentro del sobre `.u5gam` exportado y es lo que la partida dice
 * de sí misma. Reescribir el índice de alguien para que sus partidas de ayer se lean mejor
 * hoy es tocar su dato para arreglar nuestro render. El remapeo va AL PINTAR: cuesta una
 * búsqueda en un Map de 32 entradas por tarjeta y arregla por igual las partidas viejas y las
 * nuevas, sin que nadie tenga que volver a guardar.
 *
 * Lo que no reconoce lo devuelve INTACTO: por ahí pasan «Britannia», «Underworld», los
 * nombres de mazmorra con su planta («Deceit · L2 · N»), los nombres ya legibles que siembra
 * la galería de momentos y el «lugar desconocido» de una importación. Ninguno se toca.
 *
 * 🔴 LA PUERTA ES EL GUION BAJO, y no «búscalo siempre en el índice»: eso último es más
 * ancho de lo que parece y ROMPE EL ESPAÑOL. Dieciocho de los treinta y dos identificadores
 * no llevan guion bajo, y uno de ellos —`Lycaeum`— es también, letra por letra, el nombre
 * que `momentos.json` publica en ES para el momento 03. Con búsqueda incondicional, la
 * tarjeta en español de ese momento pasaría a decir «The Lycaeum»: un remapeo correcto para
 * una cadena que no era un identificador. El precio de la puerta es que un guardado viejo
 * dentro del Lycaeum siga diciendo «Lycaeum» en vez de «The Lycaeum» — que ya es legible, que
 * es lo que este fichero arregla, y que en ES es además el nombre bueno.
 */
export function legibleLocationName(guardado: string): string {
  if (!guardado.includes("_")) return guardado;
  return PorSlug.get(guardado.toLowerCase()) ?? guardado.replace(/_/g, " ");
}

/**
 * EL NOMBRE DE SITIO QUE PRODUCEN LOS DOS CALCOS — sobremundo, pool, y el último recurso.
 *
 * 🔴 NACE DE UN RESPALDO DUPLICADO, no de una necesidad de abstraer. `mapName` (`main.ts`) y
 * `CoreViewImpl.locationName` (`skin/coreview.ts`) terminaban los dos en la MISMA línea
 * —`locationDisplayName(...) || smallMaps.get(...)?.name ?? "?"`— y ese `||` es exactamente
 * el camino por el que «Palace_of_Blackthorn» llegaba a la lista de guardados. El comentario
 * de `main.ts` ya avisaba de que eran dos calcos y de que «un censo por el nombre de la
 * función se deja uno»; lo que quedaba fuera del aviso es que la parte COMPARTIDA seguía
 * escrita dos veces, así que arreglar uno dejaba el otro capaz de reintroducir el defecto.
 * Ahora el respaldo existe UNA vez y tiene un nombre al que un test puede apuntar.
 *
 * ⚠ EL ÚLTIMO RECURSO YA NO DEVUELVE EL IDENTIFICADOR CRUDO. Antes, una location fuera de las
 * 32 conocidas caía en `smallMaps.get(id).name`, que es el identificador de máquina del
 * extractor, y de ahí a `SaveMeta.locationName` —que se PERSISTE, viaja al sobre `.u5gam` y
 * se usa para el nombre del fichero descargado—. No se añade una capa de saneado nueva: se
 * reusa `legibleLocationName`, que es la función que este mismo fichero ya tiene para
 * convertir un identificador en algo leíble, aplicada ahora ANTES de escribir en vez de sólo
 * al pintar. Que el dato malo no se guarde es más barato que remapearlo en cada lector.
 *
 * `smallMapName` se pasa como función y no como cadena para no obligar al llamador a resolver
 * el mapa pequeño en el caso normal, que es el 100 % de las partidas sanas.
 */
export function mapDisplayName(
  id: number,
  floor: number,
  locationNames: readonly string[] | undefined,
  smallMapName: () => string | undefined,
): string {
  if (id === OVERWORLD_LOCATION) return floor === 0xff ? "Underworld" : "Britannia";
  const nombre = locationDisplayName(id, locationNames);
  if (nombre) return nombre;
  const crudo = smallMapName();
  return crudo ? legibleLocationName(crudo) : "?";
}
