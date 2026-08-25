/**
 * MINIMAPA de Britannia para la tarjeta de una partida — CHUNK PEREZOSO.
 *
 * 🔴 ESTE FICHERO NO SE PUEDE IMPORTAR ESTÁTICAMENTE DESDE `main.ts`. Arrastra
 * `core/tile-colors` → `core/tiles` → `core/data/TileData.json`, que son **458 037 B
 * medidos**, contra un bundle eager de /byo de ~91 KB. La página existe para cargar
 * rápido ANTES de que nadie suelte un fichero; multiplicarla por seis para ilustrar
 * una lista que la mayoría de visitantes verá vacía sería el peor intercambio posible.
 * Se entra por `import("./minimapa.js")` y sólo cuando hay una partida que pintar.
 * La sonda lo vigila: la huella de `TileData.json` NO puede estar en el chunk eager.
 *
 * 🔴 Y LOS TILES SON DEL USUARIO, no nuestros. El mapa sale de
 * `/assets/maps/overworld.json`, que el extractor generó desde SU `BRIT.DAT` y dejó en
 * SU Cache Storage. Aquí no viaja ni un byte del juego: viaja la PALETA (nuestra) y el
 * código que la aplica. Sin caché no hay mapa — y eso se dice, no se disimula.
 */
import { defaultTileColor } from "../../game/src/core/tile-colors.js";

/** Los dos mapas grandes son 256×256 (`LARGE_MAP_SIZE`, `core/world/map.ts:23`). */
const LADO_GRANDE = 256;
/** Los mapas pequeños —pueblos, castillos, cabañas— son 32×32 (`SMALL_MAP_SIZE`, íd. :24). */
const LADO_PEQUENO = 32;

/**
 * 🔴 EL LIENZO BASE SON 256 px SIEMPRE, mida lo que mida el mapa. Es la pieza que hace que
 * añadir los interiores no toque nada más: un mapa grande sale a 1 px/tile y uno pequeño a
 * 8 px/tile, y los DOS entregan un lienzo de 256×256. Con eso el CSS de `.guardado__mapa`
 * (`aspect-ratio: 1` + ancho fijo), el visor y —lo que más importa— la aritmética de LA MARCA
 * siguen valiendo sin una sola rama nueva: la marca se dimensiona contra el tamaño al que se
 * VE (ver su bloque abajo), y lo que se ve es el mismo lienzo en los dos casos.
 *
 * ⚠️ Un interior a 8 px/tile NO tiene más información que a 1: son 32×32 datos y punto. Lo
 * que gana es que la marca de una casilla se dibuja a resolución fina en vez de ser un píxel.
 */
const LIENZO_BASE = 256;

const RUTA_OVERWORLD = "/assets/maps/overworld.json";
const RUTA_UNDERWORLD = "/assets/maps/underworld.json";
/** Los 32 mapas pequeños viajan en UN fichero, indexados por `id` (= `location`). */
const RUTA_SMALLMAPS = "/assets/maps/smallmaps.json";

/**
 * CUÁNTO MIDE LA MARCA, y en QUÉ UNIDAD. Las dos formas son legítimas y NO son
 * intercambiables, por eso la unidad viaja en el dato y no en un comentario:
 *
 * · `{ px }` — extensión en PÍXELES DE LIENZO. Es el régimen de la TARJETA, cuyo lienzo
 *   se muestra siempre al mismo tamaño (256 px de lienzo a ~102 de pantalla) mida lo que
 *   mida el mapa: lo que la marca tiene que superar allí es un suelo de PANTALLA, y eso
 *   no depende del tile. En el sobremundo esos 14 px son 14 tiles y en un interior 1,75;
 *   ninguna cifra en tiles sirve para los dos.
 * · `{ tiles }` — extensión en TILES. Es el régimen del VISOR, donde el lienzo se ve
 *   grande y lo que la marca tiene que hacer es señalar UNA CASILLA.
 *
 * 🔴 EL VISOR PEDÍA `{ px: 5 }` Y ESO ERA UN ERROR DE UNIDAD, el mismo que `escala` ya
 * tuvo al lado (ver {@link pintaMinimapa}). El 5 estaba derivado para el mapa grande a
 * escala 3, donde el tile son 3 px: 1,67 tiles, una marca correcta. En un interior el
 * tile son 24 px, así que los mismos 5 px son **1/5 de casilla** — una mota en medio de
 * una sala, medida en la captura del popup que paró el despliegue. La cifra no era falsa:
 * era de otro régimen.
 *
 * 🔴 PERO CAMBIAR DE UNIDAD, A SECAS, MUEVE LA MOTA DE VISTA — NO LA QUITA. El popup enseña
 * los DOS mapas A LA VEZ, y `{ tiles: 1,75 }` en Britannia son `1,75 × 3 = 5,25` px de
 * lienzo: los trazos salen a `1,1` y `0,56` px, y el lienzo aún se muestra reducido (768 →
 * 557 px, factor 0,725). Medido en la captura de después: **la vista de dentro daba un
 * anillo de 30×31 px de pantalla y la de Britannia UN (1) píxel rojo y CERO blancos**. Es
 * la misma mota del encargo, en la otra mitad del mismo diálogo.
 * ★★ Son DOS restricciones, no una, y en Britannia se CONTRADICEN: «rodear una casilla»
 *    (que allí mide 3 px) y «verse». Por eso la extensión de `{ tiles }` es el MÁXIMO de la
 *    casilla y el SUELO de abajo, y no la casilla a secas. Cuál manda depende del mapa —
 *    en un interior la casilla, en Britannia el suelo—, que es justo lo que ningún número
 *    único podía cubrir.
 */
export type Marca = { px: number } | { tiles: number };

/**
 * SUELO DE EXTENSIÓN de la marca, en píxeles del lienzo de la TARJETA (256 px).
 *
 * Es el mismo 14 que la tarjeta pide por defecto, y está derivado allí contra el tamaño AL
 * QUE SE VE (bloque de LA MARCA en {@link pintaMinimapa}). Vive aquí con nombre propio
 * porque ahora lo usan los dos regímenes: la tarjeta como su medida, el visor como su
 * mínimo.
 *
 * En un lienzo de `escala` mayor el suelo se escala con él (`14 · escala`), que es lo que
 * mantiene constante la FRACCIÓN del mapa mostrado que la marca ocupa: 14/256 = 5,47 % del
 * lado, la vea el visitante en la tarjeta o en el visor.
 */
const SUELO_MARCA_PX = 14;

/**
 * La marca del VISOR, en tiles. **Se deriva de la FORMA del anillo, no se elige.**
 *
 * El anillo abarca `14k` (lado 11 + trazo 3, ver el bloque de LA MARCA) y su HUECO —el
 * claro de dentro, por donde se ve lo que señala— mide `8k`. Pedir que ese hueco sea
 * exactamente UNA CASILLA fija la extensión en `14/8 = 1,75` tiles: el anillo rodea la
 * casilla sin taparla, en cualquier mapa y a cualquier escala.
 *
 * ⚠️ Es lo que se PIDE, no siempre lo que se pinta: cuando la casilla es tan pequeña que el
 * anillo no se vería (Britannia, tile de 3 px), manda {@link SUELO_MARCA_PX} y el anillo
 * abarca varias casillas. Rodear una casilla invisible no señala nada.
 */
export const MARCA_VISOR_TILES = 14 / 8;

/**
 * QUÉ FICHERO de la extracción contiene el mapa de este sitio.
 *
 * 🔴 `location === 0` NO SIGNIFICA «BRITANNIA»: significa «EL MAPA GRANDE», y son DOS.
 * Quien dice cuál es `floor` — `0xFF` = Underworld (`state.ts:41-42`, literal: *«location 0
 * = Britannia/Underworld (floor 0xFF = Underworld)»*).
 *
 * Esta función existe porque aquí había una sola ruta, la del sobremundo, y `leeDetalle`
 * ni siquiera copiaba `floor`: una partida guardada bajo tierra ponía su marca sobre
 * Britannia, en unas coordenadas que allí no son las suyas. Es la «ilustración que MIENTE»
 * que esta misma página se prohíbe unas líneas más abajo, sólo que por el otro eje del mapa.
 * (Medido el 07-08 sobre un save real de final de juego: `{location: 0, floor: 255, x: 129,
 * y: 128}`, y lo que llegaba al minimapa era `{location: 0, x: 129, y: 128}` — el `floor` se
 * perdía en `leeDetalle`, no aquí.)
 *
 * 🔴 YA NO DEVUELVE `null` PARA UN INTERIOR, y ése es el cambio de la ficha #112. Devolvía
 * `null` para todo `location !== 0` y la tarjeta de un interior se quedaba sin ilustración —
 * seis de los diez momentos legendarios, y toda partida guardada dentro de un sitio. Los
 * mapas pequeños SÍ están en la extracción del visitante desde siempre; lo que faltaba era
 * pedirlos.
 *
 * ★ Y el «no hay mapa» NO se decide aquí por un rango de ids: se decide LEYENDO el fichero
 * (`leeRejilla` devuelve `null` si ese `id` o esa planta no están). Un `location <= 32`
 * escrito aquí sería una copia del contenido de `smallmaps.json` que envejecería sola; una
 * mazmorra (loc 33+) da `null` porque NO ESTÁ en el fichero, que es la razón verdadera.
 */
export function rutaDelMapa(location: number, floor: number): string {
  if (location !== 0) return RUTA_SMALLMAPS;
  return floor === 0xff ? RUTA_UNDERWORLD : RUTA_OVERWORLD;
}

/**
 * Memoria de mapas ya leídos, POR RUTA.
 *
 * 🔴 ERA UNA SOLA RANURA (`let cacheMapa`), y con dos mapas eso deja de ser una caché para
 * ser un ERROR SILENCIOSO: la primera tarjeta que se pintara fijaría el mapa de TODAS las
 * demás, así que una partida de Britannia seguida de una del Underworld habría pintado la
 * segunda sobre el mapa de la primera — el mismo defecto que este commit cierra, reaparecido
 * por la puerta de al lado y sólo cuando hay dos tarjetas. Un `Map` por ruta lo hace
 * imposible por construcción, no por cuidado.
 *
 * Valor `null` = se intentó y no está (sin extracción, o caché desalojada); ausente = sin
 * intentar. Los dos casos se distinguen para no re-pedir lo que ya se sabe que no está.
 */
const cacheMapas = new Map<string, number[][] | null>();

/** Una entrada de `smallmaps.json`, tal cual la escribe el extractor (`core/world/map.ts:11`). */
interface SitioPequeno {
  id: number;
  name: string;
  floors: { z: number; tiles: number[][] }[];
}

/**
 * El fichero de mapas pequeños, PARSEADO una vez. Son 179 KB de JSON y las seis tarjetas de
 * interior de una galería completa lo comparten; volver a parsearlo por tarjeta sería trabajo
 * proporcional a cuántos interiores tenga el visitante.
 *
 * `null` = se intentó y no está. Ausente = sin intentar (misma distinción que `cacheMapas`).
 */
let cacheSitios: SitioPequeno[] | null | undefined;

/** Lo que hace falta de `data.json`: las dos listas que sitúan cada location en el sobremundo. */
interface DatosDelMundo {
  locationsX?: number[];
  locationsY?: number[];
}
let cacheDatos: DatosDelMundo | null | undefined;

/**
 * Trae un JSON de la extracción del usuario. `null` si no está.
 *
 * 🔴 SE PIDE A LA CACHÉ POR SU NOMBRE, NO A LA RED, y esto es una PRECONDICIÓN que muerde a
 * quien escriba una sonda: en producción el service worker serviría igual, pero /byo puede
 * ejecutarse antes de que el SW controle la página. Una sonda que sirva `smallmaps.json` por
 * HTTP y no lo siembre en la Cache Storage verá «no hay mapa» — un negativo FALSO que se lee
 * exactamente igual que el defecto que se está arreglando.
 */
async function traeJson(ruta: string): Promise<unknown> {
  try {
    const cache = await caches.open("u5-assets-v1");
    const res = await cache.match(new Request(ruta));
    return res ? await res.json() : null;
  } catch {
    // Caché no disponible (modo privado) o JSON corrupto: sin mapa, y quien llama
    // pinta el respaldo de texto. No es una ruta de medición: es una ilustración.
    return null;
  }
}

/**
 * La REJILLA de tiles de este sitio, sea grande o pequeño. `null` si no se puede pintar.
 *
 * Los dos «no se puede» son distintos y los dos acaban igual (la tarjeta se queda con el
 * nombre del lugar), así que no se separan: sin extracción en caché, y sitio que NO ESTÁ en
 * `smallmaps.json` — que es el caso de las MAZMORRAS (`location` 33+, que viven en
 * `dungeons.json` y se pintan en perspectiva, no en planta: otro carril).
 *
 * 🔴 LA PLANTA SE BUSCA POR IGUALDAD DE `z`, NO POR ÍNDICE, y es el mismo predicado que usa
 * el juego (`getActiveMap`, `core/world/map.ts:76`: `loc.floors.find((f) => f.z === floor)`).
 * Importa porque **las plantas van con signo y no empiezan en 0**: Yew y Serpent's Hold tienen
 * `[-1, 0, 1]` y el Castillo de Lord British `[-1, 0, 1, 2, 3]`. Indexar por posición pintaría
 * el SÓTANO como si fuera la planta baja — y el momento 05 (Nosfentor) está justo en la
 * planta −1 de Serpent's Hold, así que sería un mapa equivocado con pinta de mapa correcto.
 * (Ese signo es el que #115 arregló en el códec; aquí se CONSUME.)
 */
async function leeRejilla(location: number, floor: number): Promise<number[][] | null> {
  const clave = `${location}:${floor}`;
  const previo = cacheMapas.get(clave);
  if (previo !== undefined) return previo;
  let rejilla: number[][] | null = null;
  if (location === 0) {
    const datos = await traeJson(rutaDelMapa(location, floor));
    if (Array.isArray(datos) && datos.length === LADO_GRANDE) rejilla = datos as number[][];
  } else {
    if (cacheSitios === undefined) {
      const datos = await traeJson(RUTA_SMALLMAPS);
      cacheSitios = Array.isArray(datos) ? (datos as SitioPequeno[]) : null;
    }
    const sitio = cacheSitios?.find((s) => s.id === location);
    const planta = sitio?.floors.find((f) => f.z === floor);
    if (planta && Array.isArray(planta.tiles) && planta.tiles.length === LADO_PEQUENO) {
      rejilla = planta.tiles;
    }
  }
  cacheMapas.set(clave, rejilla);
  return rejilla;
}

/**
 * Pinta el mapa de este sitio con la posición marcada, o `null` si no hay mapa.
 *
 * `location` = 0 los dos mapas GRANDES (`floor` decide cuál, ver {@link rutaDelMapa});
 * 1..32 los INTERIORES de `smallmaps.json`, con su planta. Cualquier otra cosa —una
 * mazmorra— da `null`, y la tarjeta se queda con el nombre del lugar, que ya lleva.
 *
 * `escala` = MULTIPLICADOR sobre el lienzo base de 256 px, NO píxeles por tile.
 * 🔴 El cambio de unidad es de la ficha #112 y es lo que deja el resto del sistema quieto:
 * con «px por tile» un interior a escala 1 habría dado un lienzo de 32 px —una miniatura
 * ilegible de 32 px donde la del sobremundo mide 256— y habría obligado a que cada llamante
 * supiera de qué tamaño es el mapa que está pidiendo. Como multiplicador, `escala: 1` da 256
 * en los dos casos y `escala: 3` da 768 en los dos: la tarjeta y el visor no se enteran.
 *
 * `marca` = extensión de la marca (primer a último píxel encendido) CON SU UNIDAD, que es
 * un `{ px }` o un `{ tiles }` — ver {@link Marca}, donde está el porqué de que sean dos y
 * no una. El default `{ px: 14 }` es el de la tarjeta y está derivado de su tamaño en
 * pantalla (bloque de LA MARCA, abajo); el visor pide `{ tiles: MARCA_VISOR_TILES }`,
 * porque allí lo que la marca señala es una casilla concreta.
 *
 * ⚠️ SUBIR `escala` NO AÑADE INFORMACIÓN: el dato es 256×256 (o 32×32) y punto. Lo que gana
 * es que la MARCA (dibujo nuestro, no del mapa) se traza a resolución fina en vez de heredar
 * el pixelado del terreno. El terreno se amplía a bloques a propósito —
 * `imageSmoothingEnabled = false` — porque suavizarlo inventaría costas que no existen.
 */
export async function pintaMinimapa(
  location: number,
  x: number,
  y: number,
  floor: number,
  // El default es la TARJETA, y su cifra es la misma que el suelo del visor: no son dos
  // catorces que coinciden, es una sola derivación (ver {@link SUELO_MARCA_PX}).
  { escala = 1, marca = { px: SUELO_MARCA_PX } }: { escala?: number; marca?: Marca } = {},
): Promise<HTMLCanvasElement | null> {
  const mapa = await leeRejilla(location, floor);
  if (!mapa) return null;
  const lado = location === 0 ? LADO_GRANDE : LADO_PEQUENO;
  // Píxeles de LIENZO por tile. El lienzo base son 256 px siempre (ver `LIENZO_BASE`), así
  // que un mapa grande sale a 1 y uno pequeño a 8.
  const porTile = (LIENZO_BASE / lado) * escala;
  const cv = document.createElement("canvas");
  cv.width = lado * porTile;
  cv.height = lado * porTile;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  // El volcado es de 1 px por tile (es el dato); se amplía después.
  const img = ctx.createImageData(lado, lado);
  for (let fy = 0; fy < lado; fy++) {
    const fila = mapa[fy];
    if (!fila) continue;
    for (let fx = 0; fx < lado; fx++) {
      const tile = fila[fx];
      if (tile === undefined) continue;
      const c = defaultTileColor(tile);
      const off = (fy * lado + fx) * 4;
      img.data[off] = (c >> 16) & 0xff;
      img.data[off + 1] = (c >> 8) & 0xff;
      img.data[off + 2] = c & 0xff;
      img.data[off + 3] = 255;
    }
  }
  // 🔴 LA CONDICIÓN ES `porTile === 1`, NO `escala === 1`. Con la unidad vieja las dos eran
  // lo mismo; con el multiplicador dejan de serlo, y confundirlas manda al interior por el
  // camino del volcado directo: pintaría sus 32×32 píxeles en la esquina de un lienzo de 256
  // y dejaría el resto TRANSPARENTE — un mapa diminuto arriba a la izquierda.
  if (porTile === 1) {
    ctx.putImageData(img, 0, 0);
  } else {
    // `putImageData` IGNORA cualquier transformación y escribe píxel a píxel, así que no
    // sirve para ampliar: hay que pasar por un lienzo intermedio y `drawImage`.
    const buf = document.createElement("canvas");
    buf.width = lado;
    buf.height = lado;
    buf.getContext("2d")?.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false; // bloques, no manchas: ver el docstring
    ctx.drawImage(buf, 0, 0, cv.width, cv.height);
  }
  // ── LA MARCA ────────────────────────────────────────────────────────────────────
  //
  // 🔴 SE DIMENSIONA CONTRA EL TAMAÑO AL QUE SE VE, no contra el lienzo — y el lienzo se
  // encoge MUCHO: 256 px de canvas se muestran a 102 px en escritorio y a 74 en un
  // iPhone SE (factor 0,398 y 0,289, medidos). La versión anterior abarcaba **7 px de
  // lienzo** (relleno de 5 + su contorno), o sea **2,79 px de pantalla** en escritorio y
  // ~2,02 en el SE: por debajo del suelo de 3 px que pide el diseño de la tarjeta. La
  // marca estaba, pero era una mota que hay que buscar.
  //
  // Ésta abarca **14 px de lienzo** = **5,58 px de pantalla** medidos en escritorio y
  // ~4,05 en el SE. Sobre el suelo en los dos.
  //
  // Y va HUECA (dos trazos, sin relleno): un bloque macizo de ese tamaño tapa catorce
  // tiles y esconde justo lo que señala. Blanco fuera + rojo dentro se ve sobre agua,
  // bosque y montaña, que es lo que hay debajo.
  //
  // ⚠️ LOS NÚMEROS SON DE EXTENSIÓN (primer a último píxel encendido), no de cuánta tinta
  // hay: en una forma hueca las dos cifras difieren — la fila central de este anillo sólo
  // cruza los dos trazos laterales, 6 px. La sonda mide extensión por esa razón, y se
  // comprobó con un mutante que con la marca vieja se pone ROJA.
  //
  // ⚠️ Y no es «más grande porque sí»: si algún día la tarjeta muestra el mapa MÁS
  // pequeño, el número se vuelve a derivar del ancho mostrado. La cuenta está aquí para
  // rehacerla en vez de adivinarla.
  // 🔴 LA COTA ES EL LADO DE **ESTE** MAPA, no 256. Con la cota fija, una posición de interior
  // —que va de 0 a 31— pasaría igual, pero al revés no: 256 sobre un mapa de 32 aceptaría
  // coordenadas de fuera del mapa y pintaría la marca en el vacío del lienzo. La cota dice
  // «esta casilla existe en este mapa», y eso depende del mapa.
  if (x >= 0 && x < lado && y >= 0 && y < lado) {
    // 🔴 LA UNIDAD SE RESUELVE AQUÍ Y NO ANTES, porque `{ tiles }` sólo se puede convertir
    // donde se sabe cuánto mide un tile — y eso es `porTile`, que depende del mapa (1 px en
    // el sobremundo de la tarjeta, 24 en un interior del visor). Ése es exactamente el
    // trabajo que el `{ px: 5 }` del visor le pedía al llamante y que el llamante no podía
    // hacer: `porTile` no sale de esta función.
    //
    // 🔴 Y EL `Math.max` NO ES UNA CAUTELA: es la SEGUNDA restricción, la que hace que esto
    // valga para las dos vistas que el popup enseña JUNTAS. `{ tiles }` sola deja la marca de
    // Britannia en 5,25 px de lienzo —trazos de medio píxel, un punto rojo suelto medido en
    // la captura— porque allí la casilla que hay que rodear mide 3 px. El suelo se escala con
    // el lienzo (`SUELO_MARCA_PX · escala`) porque es un mínimo de lo que SE VE, no del dato.
    //
    // Cuál de las dos manda lo decide el mapa:
    //   · interior (tile 24, escala 3) → max(1,75·24, 14·3) = max(42, 42) = 42 · EMPATE
    //   · Britannia (tile  3, escala 3) → max(1,75· 3, 14·3) = max(5,25, 42) = 42 · SUELO
    // El empate del interior no es casualidad ni ajuste: `MARCA_VISOR_TILES` es 14/8 y el mapa
    // pequeño mide 256/8 = 32 — el mismo 8 en las dos. Por eso el suelo NO deshace el arreglo
    // del interior: allí no cambia ni un píxel, a ninguna escala (`escala` se va en los dos
    // lados del máximo).
    //
    // 🔴 DE AHÍ SE SIGUE ALGO QUE HAY QUE DECIR EN VOZ ALTA, porque el código no lo aparenta:
    // **con los dos únicos tamaños de mapa que la app tiene (256 y 32), la cláusula de tiles
    // no manda NUNCA** — empata en interior y pierde en Britannia. Un mutante que borre esa
    // mitad del máximo y deje sólo el suelo SOBREVIVE a la batería, y no por un hueco del
    // test: es que no hay entrada alcanzable que los distinga. Se queda por lo que guarda —
    // la clase «tile grande», que es la del defecto que paró el despliegue — y empieza a
    // mandar en cuanto exista un mapa de **lado < 32** (con lado 16 pediría 84 px, el doble
    // que el suelo). Lo que SÍ es observable hoy es el suelo: bórralo y Britannia vuelve a
    // 5,25 px, que es el defecto medido.
    //
    // El régimen `{ px }` NO lleva suelo: es la tarjeta, y su cifra YA es el suelo — pasarla
    // por el máximo sería preguntarle a un número si es mayor que sí mismo.
    const marcaPx =
      "px" in marca ? marca.px : Math.max(marca.tiles * porTile, SUELO_MARCA_PX * escala);
    // Las tres cifras del diseño (trazo 3, trazo 1,5, lado 11 → extensión 14) se escalan
    // JUNTAS por `k`, para que la marca conserve su forma a cualquier tamaño. Con el
    // default `{ px: 14 }` es `k = 1`: misma FORMA y misma EXTENSIÓN que la tarjeta de
    // siempre — 14 px de lienzo, que es lo que su aserto mide.
    const k = marcaPx / 14;
    // 🔴 PERO NO ES EL MISMO DIBUJO AL PÍXEL, y lo digo porque estuve a punto de escribir
    // que sí: el centro pasa de `x` a `x + 0.5`. El tile ocupa [x, x+1) en píxeles de
    // lienzo, así que su centro ES `x + 0.5` y lo de antes estaba medio píxel arriba-a-la-
    // izquierda. A escala 1 ese medio píxel no se ve (y por eso nadie lo notó); a escala 3
    // son 1,5 px y la marca queda visiblemente descolocada respecto de la casilla que
    // señala. Se corrige aquí porque es la MISMA cuenta para los dos tamaños, y la tarjeta
    // se lleva de propina un centrado correcto.
    // 🔴 EL CENTRO SE CONVIERTE CON `porTile`, NO CON `escala`. Con la unidad vieja eran el
    // mismo número; ahora no, y usar `escala` pondría la marca de un interior en
    // (x+0.5, y+0.5) píxeles de un lienzo de 256 — o sea, apiñada en la esquina superior
    // izquierda para las 1024 casillas. El tile ocupa `porTile` píxeles de lienzo y su centro
    // está a la mitad.
    const cxp = (x + 0.5) * porTile;
    const cyp = (y + 0.5) * porTile;
    // `ladoMarca`, no `lado`: `lado` es el del MAPA y está en el ámbito de fuera. Se llamaba
    // igual y funcionaba por sombreado; con dos tamaños de mapa en juego, dos cosas distintas
    // con el mismo nombre en funciones anidadas es exactamente donde se cuela el error.
    const ladoMarca = 11 * k;
    ctx.lineWidth = 3 * k;
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(cxp - ladoMarca / 2, cyp - ladoMarca / 2, ladoMarca, ladoMarca);
    ctx.lineWidth = 1.5 * k;
    ctx.strokeStyle = "#ff3b30";
    ctx.strokeRect(cxp - ladoMarca / 2, cyp - ladoMarca / 2, ladoMarca, ladoMarca);
  }
  return cv;
}

/**
 * DÓNDE CAE ESTE LUGAR EN BRITANNIA. `null` si no lo sabemos.
 *
 * 🔴 SE DERIVA DE LA EXTRACCIÓN DEL VISITANTE, no de una tabla escrita aquí: `data.json` trae
 * `locationsX`/`locationsY`, que son EXACTAMENTE las dos que consulta el juego para decidir en
 * qué casilla del sobremundo se entra a cada sitio (`locationAt`, `core/world/movement.ts:389`:
 * recorre las dos listas y devuelve `i + 1`). De ahí el `location - 1`: el id es 1-based y el
 * array 0-based, y ésa es la misma convención que #118 usó para discriminar la boca de Doom
 * (loc 40 → idx 39).
 *
 * ★ Que salga de los datos y no de una constante es lo que hace que valga para los 40 sitios
 * sin que nadie los teclee, y que siga valiendo si la extracción cambia. Una tabla a mano aquí
 * sería una copia de un dato del visitante que envejecería sola.
 */
export async function coordenadaDelLugar(location: number): Promise<{ x: number; y: number } | null> {
  // El mapa grande no «está» en ningún sitio: ES el sitio.
  // ⚠️ HOY ESTA LÍNEA ES REDUNDANTE y lo digo para que nadie la lea como load-bearing:
  // `location - 1` con 0 da índice −1, y en JS eso ya devuelve `undefined` ⇒ `null`. Lo
  // comprobé con un mutante que la retira y SOBREVIVE a los 30 asertos. Se queda igualmente
  // porque expresa una DECISIÓN («el 0 no tiene lugar») en vez de heredarla de cómo indexa el
  // lenguaje: el día que alguien cambie el 1-based, el comportamiento correcto sigue escrito.
  if (location === 0) return null;
  if (cacheDatos === undefined) {
    const d = await traeJson("/assets/data.json");
    cacheDatos = d && typeof d === "object" ? (d as DatosDelMundo) : null;
  }
  const xs = cacheDatos?.locationsX;
  const ys = cacheDatos?.locationsY;
  const x = xs?.[location - 1];
  const y = ys?.[location - 1];
  return typeof x === "number" && typeof y === "number" ? { x, y } : null;
}
