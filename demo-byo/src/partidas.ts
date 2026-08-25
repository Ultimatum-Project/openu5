/**
 * TUS PARTIDAS y REPETICIONES en la pantalla `/byo` (bloque 2d del rediseño).
 *
 * ── QUÉ HACE ESTO Y QUÉ NO ──────────────────────────────────────────────────────────
 * Lee lo que el JUEGO ya guardó en este navegador y lo enseña. No guarda nada, no crea
 * nada y no graba nada: las partidas las escribe `game/src/core/persistence.ts` (al
 * pulsar guardar dentro del juego) y las repeticiones `game/src/replay/store.ts` (al
 * grabar desde el menú del juego). Aquí sólo se listan y se ofrece volver a ellas.
 *
 * ── POR QUÉ SE PUEDEN LEER DESDE AQUÍ ───────────────────────────────────────────────
 * Mismo ORIGEN. El ensamblador (`docs/publicacion/build-demo-publica.sh`) deja esta
 * landing en `/byo.html` y el juego en `/play.html`, los dos en la raíz del sitio: el
 * `localStorage` y el IndexedDB son literalmente los mismos.
 * ⚠️ En DESARROLLO no: `demo-byo` y `game` son dos proyectos de vite en dos puertos, o
 * sea dos orígenes, y entonces estas listas salen vacías con toda razón. No es un fallo
 * de la pantalla; es que ahí NO hay nada que leer.
 *
 * ── LAS DOS SECCIONES SE PINTAN SIEMPRE, TAMBIÉN VACÍAS ─────────────────────────────
 * Enseñarlas sólo cuando hay contenido dejaría la promesa «tus partidas van al mismo
 * sitio» sin nada que la respalde justo para quien todavía no ha jugado — que es quien
 * está leyendo esta página. Vacías ocupan una línea y dicen dónde aparecerán.
 *
 * 🔴 Y NI UN CONTROL MUERTO. En esta pantalla se acaba de retirar un toggle decorativo;
 * no se mete otro. Concretamente: no hay botón de GRABAR (se graba dentro del juego,
 * que es donde están las teclas) y no hay COMPARTIR.
 *
 * ⚠ LA TABLA DE RÉCORDS YA EXISTE, y vive en SU PROPIA sección (`records.ts`, montada en
 * `#records`): endpoints en `demo-byo/functions/api/`, formato en `records-formato.ts`.
 * Esta sección sigue sin botón de subir a propósito —subir es un acto explícito y separado,
 * con su permiso— y por eso el texto de `repeticionesLocal` describe ese invariante en vez
 * de la ausencia de la función. Si la sección de récords no aparece en la página, es que el
 * despliegue no tiene endpoints todavía: `montaRecords` no pinta nada en ese caso.
 */
import {
  clearAllSaves,
  readSaveIndex,
  readSaveShot,
  SAVE_SLOT_PREFIX,
  type SaveMeta,
} from "../../game/src/core/save-keys.js";
// El sitio se guarda como CADENA en el índice, y las partidas anteriores al fix llevan
// dentro el identificador del extractor («Palace_of_Blackthorn»). Se traduce al pintar.
import { legibleLocationName } from "../../game/src/core/location-display.js";
import { esCapturaCanonica } from "../../game/src/core/png-dims.js";
import { clearAllLogs, getThumbs, listLogs, storeAvailable } from "../../game/src/replay/store.js";
import type { ReplayMeta } from "../../game/src/replay/types.js";
import { eventoVivo } from "../../game/src/web/analitica-viva.js";
import { idiomaActual } from "../../game/src/web/arranque.js";
import { EV } from "../../game/src/web/eventos.js";
import { txt } from "./idioma.js";
import { borraAperturas, marcaApertura } from "./insignias.js";
import { abreVisor } from "./visor.js";

/** Inventario de lo que este navegador guarda del jugador. */
export interface Inventario {
  partidas: SaveMeta[];
  repeticiones: ReplayMeta[];
  /**
   * Miniatura de cada repetición, `id → dataURL`. Las que no la tengan NO están en el
   * mapa: son las grabadas antes de que se capturara fotograma, y la lista las pinta
   * con su hueco rotulado.
   *
   * 🔴 CAMPO OBLIGATORIO y no opcional a propósito: con `?` el sitio que se olvidara de
   * rellenarlo no daría error, daría CERO MINIATURAS — que en pantalla se lee igual que
   * «este navegador no tiene ninguna». Un fallo mudo y con pinta de dato, que es
   * exactamente el modo de fallo del que avisa la cabecera de `save-keys.ts`.
   */
  miniaturas: Map<string, string>;
}

/**
 * Lee las dos listas. Nunca lanza: un IndexedDB bloqueado (modo privado) o un índice
 * corrupto dan lista vacía, porque la pantalla tiene que pintarse igual.
 */
export async function leeInventario(): Promise<Inventario> {
  const partidas = readSaveIndex().sort((a, b) => b.timestamp - a.timestamp);
  let repeticiones: ReplayMeta[] = [];
  let miniaturas = new Map<string, string>();
  if (storeAvailable()) {
    try {
      repeticiones = await listLogs();
    } catch {
      repeticiones = [];
    }
    // Fracaso INDEPENDIENTE del de la lista: si las fotos no se pueden leer, las
    // repeticiones se siguen listando (con hueco). Al revés no tiene sentido pedirlas.
    try {
      miniaturas = await getThumbs(repeticiones.map((r) => r.id));
    } catch {
      miniaturas = new Map();
    }
  }
  return { partidas, repeticiones, miniaturas };
}

/**
 * Borra las partidas y las repeticiones. Devuelve cuántas de cada una se fueron —
 * MEDIDAS al borrar, no copiadas del inventario que se pintó antes: entre que se
 * pinta la lista y se pulsa el botón puede haber pasado cualquier cosa en otra pestaña.
 */
export async function borraTodo(): Promise<{ partidas: number; repeticiones: number }> {
  const partidas = clearAllSaves();
  // 🔴 Las aperturas de momentos (`openu5-momentos-aperturas`) van EN EL MISMO BORRADO, y no es
  // simetría estética: `clearAllSaves` barre por los prefijos `u5clone:`, así que esa clave
  // le queda fuera y sobreviviría a un botón cuyo rótulo promete que «este navegador ya no
  // guarda nada». Es poca cosa —ids públicos y milisegundos— pero es del visitante y quedaría
  // detrás de una afirmación falsa. No entra en el recuento: no es una partida.
  borraAperturas();
  let repeticiones = 0;
  if (storeAvailable()) {
    try {
      repeticiones = await clearAllLogs();
    } catch {
      repeticiones = 0;
    }
  }
  return { partidas, repeticiones };
}


/**
 * Lo que la TARJETA enseña de una partida, sacado del propio estado guardado.
 *
 * 🔴 SE DESERIALIZA PEREZOSAMENTE, una por tarjeta y en el momento de pintarla. Un
 * GameState son ~18 KB; parsear los N de golpe al cargar la página convertiría una
 * lista en un trabajo proporcional a cuánto ha jugado el visitante. El índice sigue
 * siendo lo que se lee para listar; esto es lo que se lee para ILUSTRAR.
 *
 * Y no se inventa NADA: todos los campos existen en `GameState` (core/state.ts). Si
 * el estado no trae uno (partida vieja, formato anterior), esa línea no se pinta —
 * nunca un cero inventado, que se leería como un dato.
 */
export interface DetallePartida {
  oro?: number;
  karma?: number;
  grupo?: number;
  fechaJuego?: { year: number; month: number; day: number };
  artefactos: string[];
  /**
   * Los TRES Shadowlords, siempre en su orden canónico —0 Falsehood · 1 Hatred ·
   * 2 Cowardice (`quest/shadowlords.ts:20`, mismo orden que `shadowlordLocs`,
   * `state.ts:270-274`)—. Ver `shadowlords()` para de dónde sale cada uno.
   */
  shadowlords: { puntos: EstadoShadowlord[] };
  /**
   * Posición. `location === 0` = uno de los DOS mapas grandes y `floor` dice cuál (`0xFF` =
   * Underworld, `state.ts:41-42`); `1..32` = un INTERIOR de `smallmaps.json` y entonces
   * `floor` es su PLANTA, con signo (el sótano de Serpent's Hold es −1). Desde #112 los dos
   * se pintan. Las MAZMORRAS (33+) no: viven en otro fichero y en perspectiva, así que esas
   * tarjetas se quedan con su nombre de lugar.
   *
   * 🔴 `floor` NO ES OPCIONAL AQUÍ aunque el resto de campos de este interface lo sean, y
   * ésa es la mitad del arreglo: cuando no viajaba, `anadeMinimapas` no tenía con qué
   * elegir mapa y pintaba el sobremundo SIEMPRE. Un campo que falta no se nota; un mapa
   * equivocado tampoco, y encima parece un dato. Con los interiores el campo carga además
   * con la planta, así que perderlo ahora pintaría la planta baja de cualquier castillo.
   */
  posicion?: { location: number; floor: number; x: number; y: number };
}

/** Orden canónico de los tres: `quest/shadowlords.ts:20`. Es el mismo de `shadowlordLocs`. */
const SHADOWLORDS = ["falsehood", "hatred", "cowardice"] as const;

/** Qué se sabe de UN Shadowlord. `sin-rastro` = esta partida no dice nada de él. */
export type EstadoShadowlord = "destruido" | "ciudad" | "fuera" | "sin-rastro";

/**
 * 🔴 «DESTRUIDO» NO SE LEE DE `shadowlordLocs`: ESE CAMPO NO SE MANTIENE AL DESTRUIR.
 * Lo dice el propio port, en `game.ts:4962-4964`: *«En el clon la fuente autoritativa de
 * "muerto" es questFlags (destroyShadowlord), no `state.shadowlordLocs` (0x58C8), que no se
 * mantiene sincronizado al destruir»*. La rama `0xFF = destruido` que había aquí calcaba la
 * semántica del BINARIO sobre un campo que en el CLON nadie escribe así ⇒ no podía dispararse
 * nunca.
 *
 * Y el efecto no era que faltara un dato: era que salía el CONTRARIO. Sobre el save de final
 * de juego medido el 07-08 —los tres Shadowlords muertos, `questFlags` con
 * `shadowlord-dead:{falsehood,hatred,cowardice}` en `true`— la tarjeta imprimía
 * **«Shadowlords: aún no aparecen»**, porque `shadowlordLocs` estaba AUSENTE. El final del
 * juego presentado como el principio.
 *
 * ── LAS DOS FUENTES SE CRUZAN, Y EN ESTE ORDEN ─────────────────────────────────────────
 *   1. `questFlags['shadowlord-dead:<key>']` — la MUERTE. Autoritativa (es la que el juego
 *      consulta: `shadowlordDead()`, `quest/shadowlords.ts:55`), y gana siempre: un
 *      Shadowlord destruido no está «en una ciudad» aunque su byte viejo lo diga.
 *   2. `shadowlordLocs[i]` — DÓNDE anda el que sigue vivo. `< 0x80` = en una ciudad,
 *      `>= 0x80` = fuera. ⚠ Este medio NO está medido: no llegué a ver una partida con el
 *      campo poblado (estaba ausente en las dos que deserialicé), así que la semántica de
 *      los bytes se hereda de lo que ya había aquí y de `state.ts:270-274`. Se conserva
 *      porque describe algo que la muerte no dice; no se amplía.
 *   3. Ni lo uno ni lo otro ⇒ `sin-rastro`, que es lo único honesto: esta partida no dice
 *      nada de él. NO es «no ha aparecido» (eso sería afirmar sobre la trama desde un campo
 *      que puede estar ausente por veinte razones) y desde luego no es «destruido».
 *
 * El `0xFF` del binario sigue tratándose como destruido si aparece: es el mismo hecho por el
 * otro canal, y aceptarlo no puede dar un falso positivo.
 */
function shadowlords(
  locs: number[] | undefined,
  questFlags: Record<string, unknown> | undefined,
): DetallePartida["shadowlords"] {
  const puntos = SHADOWLORDS.map((key, i): EstadoShadowlord => {
    if (questFlags?.[`shadowlord-dead:${key}`] === true) return "destruido";
    const v = Array.isArray(locs) ? locs[i] : undefined;
    if (typeof v !== "number") return "sin-rastro";
    if (v === 0xff) return "destruido";
    return v < 0x80 ? "ciudad" : "fuera";
  });
  return { puntos };
}

/**
 * 🔴 `characters` NO ES EL GRUPO: ES EL ROSTER COMPLETO, y son **16 registros SIEMPRE**
 * desde el minuto uno de cualquier partida — Avatar, Shamino, Iolo, Mariah, Geoffrey,
 * Jaana, Julia, Dupre, Katrina, Sentri, Gwenno, Johne, Gorn, Maxwell, Toshi, Saduj. Los
 * que aún no se han unido están ahí con `partyStatus: 0xFF` (`state.ts:31`).
 *
 * Esta función existe porque aquí había un `chars.length` y la tarjeta llevaba enseñando
 * **«grupo de 16»** en toda partida guardada, con el grupo real en 3. No daba error y no
 * parecía un error: parecía un dato. (Medido el 07-08 sobre dos saves reales —una partida
 * recién empezada y un checkpoint de final de juego—: `characters.length` = 16 en las dos,
 * `partySize` = 3 en las dos.)
 *
 * ★ EL PREDICADO ES EL DEL PROPIO JUEGO, no uno nuevo: `party.ts:171 partyMembers()` hace
 * exactamente `filter(partyStatus === 0).slice(0, MAX_PARTY)`. Se calca en vez de importarse
 * porque `party.ts` arrastraría el modelo del juego al bundle de la landing (misma razón por
 * la que existe `save-keys.ts`), y por eso el tope va escrito con su cita: MAX_PARTY = 6
 * (`party.ts:9`).
 *
 * ★ Y NO SE USA `partySize` (`state.ts:146`), aunque en las dos partidas medidas coincide.
 * Son dos cosas distintas: `partySize` es un CONTADOR guardado que el juego mantiene a mano
 * (`party.ts:110/141/166`), y esto es el CONJUNTO que la tarjeta describe. Contando el
 * conjunto, un contador rancio o corrupto no puede hacer que la tarjeta afirme un grupo que
 * no está: `/byo` lee el JSON CRUDO, sin pasar por `deserialize()` ni por su
 * `assertValidState`, así que aquí no hay nada que garantice que `partySize` sea sano.
 *
 * ⚠ Un miembro MUERTO (`status: 'D'`) sigue teniendo `partyStatus: 0` y por tanto CUENTA:
 * viaja contigo, aunque sea a hombros. Medido en el save avanzado (Shamino, `'D'`, dentro
 * de los 3). Cuántos han caído es otro dato y va aparte, no restándolo de éste.
 */
function tamanoGrupo(chars: unknown[]): number {
  const MAX_PARTY = 6; // party.ts:9
  let n = 0;
  for (const c of chars) {
    if ((c as { partyStatus?: unknown } | null)?.partyStatus === 0) n++;
  }
  return Math.min(n, MAX_PARTY);
}

/** Lee y deserializa UNA partida para su tarjeta. `null` si no se puede (nunca lanza). */
export function leeDetalle(id: string): DetallePartida | null {
  let crudo: string | null;
  try {
    crudo = localStorage.getItem(SAVE_SLOT_PREFIX + id);
  } catch {
    return null;
  }
  if (!crudo) return null;
  let st: Record<string, unknown>;
  try {
    st = JSON.parse(crudo) as Record<string, unknown>;
  } catch {
    return null;
  }
  const art = st.lbArtifacts as { amulet?: boolean; crown?: boolean; sceptre?: boolean } | undefined;
  const artefactos: string[] = [];
  if (art?.crown) artefactos.push("corona");
  if (art?.sceptre) artefactos.push("cetro");
  if (art?.amulet) artefactos.push("amuleto");
  // Los tres SHARDS y la CAJA DE SÁNDALO viven en OTROS DOS campos del estado (`shards` y
  // `specialItems.woodenBox`, core/state.ts:168-170), no en `lbArtifacts`. Van detrás de
  // las tres insignias porque ése es el orden de la trama, y uno a uno: «3 shards»
  // ocultaría CUÁLES, que es justo lo que alguien mira en una partida a medias.
  const sh = st.shards as { falsehood?: boolean; hatred?: boolean; cowardice?: boolean } | undefined;
  if (sh?.falsehood) artefactos.push("shardFalsedad");
  if (sh?.hatred) artefactos.push("shardOdio");
  if (sh?.cowardice) artefactos.push("shardCobardia");
  if ((st.specialItems as { woodenBox?: boolean } | undefined)?.woodenBox) artefactos.push("caja");
  const t = st.time as { year?: number; month?: number; day?: number } | undefined;
  const chars = st.characters;
  const d: DetallePartida = {
    artefactos,
    shadowlords: shadowlords(
      st.shadowlordLocs as number[] | undefined,
      st.questFlags as Record<string, unknown> | undefined,
    ),
  };
  const pos = st.position as { location?: number; floor?: number; x?: number; y?: number } | undefined;
  if (pos && typeof pos.location === "number" && typeof pos.x === "number" && typeof pos.y === "number") {
    // `floor` ausente ⇒ 0. Aquí un default SÍ es honesto y no inventa nada: el Underworld
    // es el 0xFF y ningún save lo omite estando en él (`position` es de los 34 campos que
    // están en TODA partida, medido). Un save tan viejo que no lo trajera estaría en el
    // sobremundo, que es el 0.
    d.posicion = { location: pos.location, floor: typeof pos.floor === "number" ? pos.floor : 0, x: pos.x, y: pos.y };
  }
  if (typeof st.gold === "number") d.oro = st.gold;
  if (typeof st.karma === "number") d.karma = st.karma;
  if (Array.isArray(chars)) d.grupo = tamanoGrupo(chars);
  if (t && typeof t.year === "number" && typeof t.month === "number" && typeof t.day === "number") {
    d.fechaJuego = { year: t.year, month: t.month, day: t.day };
  }
  return d;
}

/**
 * Añade el MINIMAPA a las tarjetas que no tienen foto. Va aparte y en diferido a
 * propósito: importa un chunk de 458 KB (ver `minimapa.ts`) y no puede bloquear el
 * pintado de la lista.
 *
 * 🔴 YA NO SON SÓLO LOS MAPAS GRANDES — ficha #112. Aquí se filtraba por `location === 0`
 * y el razonamiento escrito era: «dentro de un pueblo las coordenadas son de OTRO mapa;
 * pintarlas sobre Britannia pondría la marca donde no es». La premisa era cierta y la
 * conclusión no: lo que no se podía era pintarlas SOBRE BRITANNIA, no pintarlas. El mapa de
 * ese otro sitio está en la extracción del visitante (`smallmaps.json`) desde el primer día;
 * lo que faltaba era pedirlo. Con el sitio y la planta correctos, la marca cae donde debe.
 * ⇒ Se encola TODA tarjeta con posición, y quien decide si hay mapa es `pintaMinimapa`
 * leyendo el fichero. Las mazmorras siguen sin mapa porque NO ESTÁN ahí (viven en
 * `dungeons.json` y se dibujan en perspectiva, no en planta): ésas se quedan con su nombre.
 *
 * 🔴 Y `location === 0` SON DOS MAPAS, no uno: Britannia y el Underworld, y los separa
 * `floor` (0xFF = Underworld). Esta función pasaba sólo (x, y) y el minimapa pintaba
 * siempre el sobremundo, así que una partida bajo tierra caía en Britannia con las
 * coordenadas de otro mundo — exactamente la ilustración que miente que el párrafo de
 * arriba describe, cometida por el eje que ese párrafo no miraba. Por eso `floor` viaja
 * hasta aquí y hasta `pintaMinimapa`. Con los interiores, `floor` pasa a ser además LA
 * PLANTA (con signo: el sótano de Serpent's Hold es −1), así que viaja por partida doble.
 *
 * 🔴 Y si no hay extracción en caché no hay mapa: la tarjeta se queda como está, SIN
 * hueco ni marco roto. La ausencia no se disimula porque no hay nada que disimular.
 */
async function anadeMinimapas(
  raiz: HTMLElement,
  pendientes: {
    li: HTMLElement;
    media: HTMLElement;
    location: number;
    x: number;
    y: number;
    floor: number;
  }[],
): Promise<void> {
  if (pendientes.length === 0) return;
  let pinta: typeof import("./minimapa.js").pintaMinimapa;
  let coordenada: typeof import("./minimapa.js").coordenadaDelLugar;
  // 🔴 `MARCA_VISOR_TILES` SALE DE ESTA MISMA DESESTRUCTURACIÓN Y NO DE UN `import` ARRIBA,
  // aunque sea un número. Un `import { MARCA_VISOR_TILES } from "./minimapa.js"` estático
  // arrastra el MÓDULO ENTERO al bundle eager —con `tile-colors` → `tiles` →
  // `TileData.json`, los 458 KB que la cabecera de `minimapa.ts` prohíbe— por una constante
  // de 5 bytes. Aquí ya tenemos el módulo en la mano: el número viene gratis.
  let MARCA_TILES: typeof import("./minimapa.js").MARCA_VISOR_TILES;
  try {
    ({
      pintaMinimapa: pinta,
      coordenadaDelLugar: coordenada,
      MARCA_VISOR_TILES: MARCA_TILES,
    } = await import("./minimapa.js"));
  } catch {
    return; // el chunk no cargó: las tarjetas se quedan sin mapa y ya está
  }
  for (const { li, media, location, x, y, floor } of pendientes) {
    if (!raiz.contains(li)) continue; // se repintó mientras cargaba: no toques un nodo muerto
    const cv = await pinta(location, x, y, floor);
    // 🔴 `continue`, NO `return`. Con un solo mapa daba igual —sin caché no había ninguno—,
    // pero ahora son dos ficheros distintos: un visitante puede tener el sobremundo en caché
    // y no el Underworld (extracción parcial, desalojo selectivo). Con `return`, la primera
    // tarjeta del Underworld habría dejado sin mapa a TODAS las de Britannia que vinieran
    // detrás. Cada mapa se pide una sola vez igualmente: `leeMapa` memoiza por ruta,
    // incluido el «no está».
    if (!cv) continue;
    cv.className = "guardado__mapa";
    // 🔴 EL MAPA GRANDE SE REPINTA, NO SE ESCALA POR CSS. Ampliar este canvas de 256 px
    // daría el terreno en bloques (correcto) pero también la MARCA en bloques, y la marca
    // es dibujo nuestro: a pantalla completa saldría un anillo dentado de 30 px. Se vuelve
    // a llamar a `pintaMinimapa` con `escala: 3` (terreno idéntico, ampliado sin suavizar)
    // y una marca EN TILES (proporcionalmente MUCHO más fina que los 14 px de la tarjeta).
    //
    // 🔴 LA MARCA VA EN TILES Y NO EN PÍXELES DE LIENZO, y la diferencia sólo se ve en un
    // interior: pedía `marca: 5` —cinco píxeles de lienzo, derivados para el mapa grande,
    // donde el tile son 3— y en un interior, donde el tile son 24, eso es 1/5 de casilla.
    // Una mota. Con `{ tiles }` la conversión la hace quien sabe cuánto mide un tile
    // (`pintaMinimapa`, que tiene `porTile`), y la marca vale igual en los dos mapas.
    //
    // 🔴 Y ESTO NO PIDE NADA A LA RED, que era la condición del encargo: `pinta` es la
    // función del chunk perezoso YA CARGADO (la tenemos aquí en la mano, no se re-importa)
    // y `leeMapa` memoiza el JSON por ruta — el mapa que se repinta es el mismo array que
    // ya está en memoria. Lo único nuevo es el lienzo.
    // 🔴 VA DENTRO DE LA FRANJA, DETRÁS DE LA CAPTURA — no al principio del `<li>`. Antes
    // se insertaba con `li.insertBefore(cv, li.firstChild)` y podía hacerlo porque el mapa
    // y la foto eran EXCLUYENTES; ahora conviven y el orden importa: primero lo que se vio
    // (la captura), después dónde fue (el mapa).
    // Y la franja puede NO estar en el `<li>` todavía si la tarjeta no tenía foto: se
    // inserta aquí, que es el momento en que por fin lleva algo.
    // ── LA MINIATURA ES UNA; EL POPUP, DOS VISTAS SI ES UN INTERIOR ────────────────────
    // Enmienda del 08-08: «en castillos deberíamos tener igual mapa de Britannia y mapa del
    // castillo». Estar DENTRO de un sitio es estar en dos sitios a la vez —una casilla de una
    // planta, y esa planta en algún punto del mundo— y la tarjeta sólo contaba la primera.
    //
    // 🔴 La TARJETA sigue enseñando UNA, y es la del INTERIOR: es donde está el grupo, o sea
    // el dato que la tarjeta afirma. Britannia dice dónde cae el edificio, que es contexto y
    // no cambia entre dos partidas del mismo castillo — informa menos por miniatura.
    // Ampliar es donde cabe lo demás, así que las DOS viven en el popup.
    media.appendChild(
      conVisor(cv, txt("visorMapa"), async () => {
        const grande = { escala: 3, marca: { tiles: MARCA_TILES } };
        const dentro = await pinta(location, x, y, floor, grande);
        if (!dentro) return null;
        if (location === 0) return dentro; // sobremundo: nada cambia, una sola vista
        const donde = await coordenada(location);
        const mundo = donde ? await pinta(0, donde.x, donde.y, 0, grande) : null;
        // Sin la coordenada (o sin el sobremundo en caché) NO se inventa un par a medias: se
        // abre la vista de dentro sola, que es lo que sí se sabe.
        if (!mundo) return dentro;
        return parDeVistas(dentro, mundo);
      }),
    );
    if (!media.isConnected) li.insertBefore(media, li.firstChild);
  }
}

/**
 * Las DOS vistas de un interior, una al lado de la otra y cada una con su rótulo.
 *
 * Devuelve UN elemento porque eso es lo que el visor sabe alojar (`abreVisor` mete lo que le
 * des en su marco y `habilitaZoom` le aplica la transformación): con el par dentro de un
 * contenedor, el zoom amplía LAS DOS a la vez y el visor no se entera de que hay dos — cero
 * cambios en `visor.ts` y en `zoom.ts`.
 *
 * 🔴 Los rótulos NO son decoración: sin ellos son dos planos sin explicar, y el de Britannia
 * marca una casilla que NO es donde está el grupo (es dónde está el EDIFICIO). Dos marcas
 * rojas iguales con significados distintos y sin decir cuál es cuál serían justo la
 * «ilustración que miente» que esta pantalla se prohíbe.
 */
function parDeVistas(dentro: HTMLElement, mundo: HTMLElement): HTMLElement {
  const cont = el("div", "visor__par");
  for (const [cv, clave] of [
    [dentro, "visorParDentro"],
    [mundo, "visorParMundo"],
  ] as const) {
    const caja = el("figure", "visor__vista");
    cv.className = "visor__mapa";
    caja.appendChild(cv);
    caja.appendChild(el("figcaption", "visor__pie", txt(clave)));
    cont.appendChild(caja);
  }
  return cont;
}

/**
 * Cuelga el ICONO de cada chip de artefacto, recortado del atlas de tiles del usuario.
 *
 * Mismo patrón que `anadeMinimapas` y por las mismas tres razones: el módulo arrastra los
 * 458 KB de la tabla de tiles y entra por `import()`; el atlas vive en Cache Storage, que
 * es asíncrona; y la tarjeta tiene que estar COMPLETA Y LEGIBLE antes — el icono AÑADE al
 * chip, nunca es la condición de que el chip se pinte.
 *
 * 🔴 SIN CACHÉ NO PASA NADA Y ESO NO ES UN FALLO: quien todavía no ha soltado su copia ve
 * los chips de texto de siempre. Y si el atlas no está, se sale al primer `null` en vez de
 * intentarlo siete veces — el motivo es el mismo para todos los chips.
 */
async function anadeIconos(raiz: HTMLElement, chips: HTMLElement[]): Promise<void> {
  if (chips.length === 0) return;
  let pinta: typeof import("./iconos.js").pintaIcono;
  try {
    ({ pintaIcono: pinta } = await import("./iconos.js"));
  } catch {
    return; // el chunk no cargó: los chips se quedan en texto y ya está
  }
  for (const chip of chips) {
    if (!raiz.contains(chip)) continue; // se repintó mientras cargaba (idioma, borrado)
    const clave = chip.dataset.art;
    if (!clave) continue;
    const cv = await pinta(clave);
    if (!cv) return; // sin atlas para uno, sin atlas para todos
    cv.className = "chip__icono";
    chip.insertBefore(cv, chip.firstChild);
  }
}

/**
 * Envuelve una ilustración en un BOTÓN que la abre en el visor a tamaño grande.
 *
 * 🔴 UN `<button>` DE VERDAD, no `role="button"` + `tabindex`. Mismo argumento que el
 * `<dialog>` del visor: el botón nativo trae Enter **y** Espacio, el anillo de foco, el
 * orden de tabulación y el nombre accesible; con el rol pintado a mano tendría que
 * reimplementar el teclado y el fallo sería MÍO y no del navegador. Cuesta un elemento.
 *
 * `grande` construye el contenido del visor y puede tardar (el mapa se repinta a mayor
 * escala): se llama AL PULSAR, no al montar la tarjeta — nadie paga por una ampliación
 * que no ha pedido. Si devuelve `null` no se abre nada: mejor un botón que no responde
 * una vez que un visor vacío.
 */
function conVisor(
  ilustracion: HTMLElement,
  rotulo: string,
  grande: () => Promise<HTMLElement | null>,
): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "guardado__lupa";
  b.setAttribute("aria-label", rotulo);
  b.appendChild(ilustracion);
  let abriendo = false;
  b.addEventListener("click", () => {
    if (abriendo) return; // doble clic mientras se repinta: una sola apertura
    abriendo = true;
    void grande()
      .then((el) => {
        if (el) abreVisor(el, rotulo, b);
      })
      .catch(() => {
        /* sin ampliación: la tarjeta se queda como está */
      })
      .finally(() => {
        abriendo = false;
      });
  });
  return b;
}

/** Pinta la ilustración de la tarjeta: la captura si la hay. */
function ilustracion(id: string): HTMLElement | null {
  const shot = readSaveShot(id);
  if (!shot) return null;   // partida anterior a la captura: la tarjeta va sin foto,
  const img = document.createElement("img"); // sin hueco ni marco vacío
  img.className = "guardado__foto";
  img.src = shot;
  img.alt = "";             // decorativa: todo lo que dice está en el texto de al lado
  img.loading = "lazy";
  // 🔴 SÓLO SE ENVUELVE SI HAY CAPTURA — y el `return null` de arriba es lo que lo
  // garantiza: sin foto no hay botón que pulsar, así que no existe la ruta «abrir un
  // visor vacío». La ausencia se sigue tratando como antes: ni hueco ni marco.
  // La ampliación no repinta nada: es la MISMA dataURL que ya está en memoria, en un
  // `<img>` sin `width` de tarjeta. Cero red, cero decodificación nueva.
  return conVisor(img, txt("visorCaptura"), async () => {
    const g = document.createElement("img");
    g.src = shot;
    g.alt = "";
    return g;
  });
}

/**
 * La miniatura de una REPETICIÓN — o su hueco rotulado.
 *
 * 🔴 NO ES `ilustracion()` CON OTRO ORIGEN, y por eso no se reutiliza:
 *
 * · `ilustracion()` devuelve `null` sin captura y la tarjeta se cierra sin hueco. Aquí
 *   NO: las repeticiones son FILAS de una lista y una sin su primera columna descuadra
 *   las de al lado. El hueco lleva rótulo para que se lea «ésta es de antes» y no «esto
 *   no ha cargado».
 * · `ilustracion()` envuelve la foto en el VISOR (`conVisor`) para ampliarla. Aquí no:
 *   la fila entera ya lleva una acción —ver la repetición— y meter un segundo gesto a
 *   un centímetro, con el mismo aspecto de imagen pulsable y otro desenlace, es la
 *   confusión que `popover-replay.ts` documenta en su cabecera sobre los dos «cerrar».
 *   Quien pulse aquí quiere VER LA PARTIDA, no la foto de la partida.
 */
function miniaturaReplay(shot: string | undefined): HTMLElement {
  if (shot === undefined) {
    const hueco = el("div", "guardado__replayshot guardado__replayshot--vacia", txt("repeticionSinFoto"));
    hueco.dataset.testid = "replay-shot-vacia";
    return hueco;
  }
  const img = document.createElement("img");
  img.className = "guardado__replayshot";
  img.dataset.testid = "replay-shot";
  img.src = shot;
  img.alt = ""; // decorativa: el rótulo y los metadatos de al lado ya lo dicen todo
  img.loading = "lazy";
  return img;
}

/**
 * El botón que PIDE la captura de un momento que se quedó sin ella.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────────────────
 * 🔴 Porque hasta hoy «sin foto» era PARA SIEMPRE. La captura se generaba en un único
 * punto —el clic de «Añadir» (`momentos.ts`)— y su fracaso no dejaba rastro ni segunda
 * puerta: el momento quedaba instalado y la tarjeta se conformaba con el minimapa, que en
 * los momentos de INTERIOR tampoco existe (#112). Resultado: una tarjeta sin nada visual y
 * sin nada que pulsar. Y le pasa por construcción a todo momento sembrado por una versión
 * anterior a la captura: entre el modal (08-08 07:53) y el fotograma (08-08 10:49) hay tres
 * horas de árbol en las que un momento se instalaba sin foto y sin poder tenerla nunca.
 *
 * ── SÓLO DONDE PUEDE FUNCIONAR, que es la regla de esta pantalla ────────────────────────
 * Tres condiciones, y las tres son necesarias, no decorativas:
 *   · `provenance === 'momento'` — lo que la regeneración reconstruye es la pantalla del
 *     ARRANQUE sobre el save. En un momento eso ES su foto (nadie lo ha jugado). Sobre la
 *     partida de un jugador sería también correcto, pero es otra afirmación y no la he
 *     medido: fuera de alcance a propósito.
 *   · sin captura ya — con foto no hay nada que pedir.
 *   · `hayCopia` — la captura sale de ARRANCAR EL JUEGO, y sin la extracción no arranca.
 *     Sin esto sería el control muerto que `partidas.ts` lleva su cabecera entera negando.
 *
 * `alCambiar` repinta la lista al terminar: la foto nueva entra por la MISMA lectura del
 * almacén que la pintaría tras recargar, no por haber recordado que pulsé.
 */
function botonRegenerar(
  id: string,
  alCambiar: () => void,
  yaHabiaFoto: boolean,
): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "guardado__reshot";
  // Dos rótulos porque son dos ofertas distintas: donde NO hay foto se ofrece
  // GENERARLA, y donde hay una mala se ofrece REHACERLA. Con un solo texto, «Generar
  // captura» junto a una captura visible se lee como que el botón hace otra cosa.
  b.textContent = txt(yaHabiaFoto ? "shotRehacer" : "shotGenerar");
  b.addEventListener("click", () => {
    b.disabled = true;
    b.textContent = txt("shotGenerando");
    void (async () => {
      let ok = false;
      try {
        // El chunk pesado entra AQUÍ y no al pintar la lista, igual que `minimapa.ts` y
        // `iconos.ts`: quien no pulsa no paga el modelo del juego.
        const { generaShotDelMomento } = await import("./momentos-instala.js");
        ok = await generaShotDelMomento(id);
      } catch {
        ok = false; // el chunk no cargó: mismo desenlace que un fracaso de la captura
      }
      // 🔴 Sólo se repinta si SALIÓ. Repintar tras un fracaso devolvería el botón a su
      // estado inicial y el visitante no distinguiría «no ha funcionado» de «no ha hecho
      // nada»; con el fracaso dicho en el propio botón, el segundo clic es una decisión.
      if (ok) alCambiar();
      else {
        b.disabled = false;
        b.textContent = txt("shotFallo");
      }
    })();
  });
  return b;
}

/** Los datos de la partida como chips cortos. Máx. los que quepan sin ruido. */
function chips(d: DetallePartida): HTMLElement {
  const cont = el("div", "guardado__chips");
  if (d.fechaJuego) {
    cont.appendChild(el("span", "chip", txt("chipFecha", {
      d: String(d.fechaJuego.day), m: String(d.fechaJuego.month), a: String(d.fechaJuego.year),
    })));
  }
  if (d.oro !== undefined) cont.appendChild(el("span", "chip", txt("chipOro", { n: num(d.oro) })));
  if (d.karma !== undefined) cont.appendChild(el("span", "chip", txt("chipKarma", { n: num(d.karma) })));
  if (d.grupo !== undefined) cont.appendChild(el("span", "chip", txt("chipGrupo", { n: num(d.grupo) })));
  for (const a of d.artefactos) {
    const c = el("span", "chip chip--art", txt("art_" + a));
    // La CLAVE viaja como dato porque el icono se cuelga después (ver `anadeIconos`) y
    // sin ella habría que adivinar el artefacto releyendo un texto ya traducido.
    c.dataset.art = a;
    cont.appendChild(c);
  }
  // Shadowlords: TRES puntos con su leyenda. Los dos extremos se dicen con PALABRAS porque
  // son las dos noticias de una partida —no han aparecido, o los has destruido— y tres
  // circulitos no las cuentan. El del final es el que estaba saliendo mal.
  const puntos = d.shadowlords.puntos;
  if (puntos.every((p) => p === "destruido")) {
    cont.appendChild(el("span", "chip chip--art", txt("slTodosDestruidos")));
  } else if (puntos.every((p) => p === "sin-rastro")) {
    cont.appendChild(el("span", "chip chip--tenue", txt("slSinRastro")));
  } else {
    const sl = el("span", "chip chip--sl");
    sl.appendChild(el("span", "", txt("slRotulo") + " "));
    for (const p of puntos) {
      const pt = el("span", "sl-punto sl-punto--" + p);
      pt.title = txt("sl_" + p);
      pt.textContent = p === "destruido" ? "\u25cb" : "\u25cf";
      sl.appendChild(pt);
    }
    cont.appendChild(sl);
  }
  return cont;
}

/**
 * Fecha corta en el idioma vigente.
 *
 * 🔴 F9 (auditoría UX) — EL ESPACIO ENTRE DÍA Y HORA ES DURO (U+00A0), y ése era el defecto
 * de «la fecha en dos líneas». Esta cadena se inserta en `partidaMeta`
 * («{lugar} · turno {turnos} · {fecha}»), que en una tarjeta estrecha envuelve; con un
 * espacio normal el navegador tenía permiso para partir justo ahí y dejaba «10/8/2026» al
 * final de una línea y «14:32» al principio de la siguiente — un solo dato leído como dos.
 * Se arregla en el DATO y no con un `nowrap` en el contenedor: la fecha es indivisible
 * viva donde viva, y un `nowrap` sobre la meta entera prohibiría también los cortes por el
 * separador « · », que sí son buenos.
 */
function fecha(ms: number): string {
  const d = new Date(ms);
  const loc = idiomaActual() === "es" ? "es-ES" : "en-US";
  return `${d.toLocaleDateString(loc)}\u00a0${d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })}`;
}

function num(n: number): string {
  return n.toLocaleString(idiomaActual() === "es" ? "es-ES" : "en-US");
}

function el(tag: string, cls: string, texto?: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (texto !== undefined) n.textContent = texto;
  return n;
}

/**
 * Una fila: título + metadatos + una acción que es un ENLACE, no un botón.
 *
 * 🔴 Enlace de verdad (`<a href>`) y no un `onclick` con `location.href`: continuar una
 * partida es NAVEGAR, y un enlace se abre en otra pestaña, se copia y sale en el menú
 * contextual. Un botón que navega quita las tres cosas sin dar nada a cambio.
 */
function fila(titulo: string, meta: string, accion: string, href: string): HTMLElement {
  const li = el("li", "guardado");
  const info = el("div", "guardado__info");
  info.appendChild(el("b", "guardado__nombre", titulo));
  info.appendChild(el("small", "guardado__meta", meta));
  const a = document.createElement("a");
  a.className = "guardado__accion";
  a.href = href;
  a.textContent = accion;
  li.append(info, a);
  return li;
}

/**
 * Pinta las dos secciones dentro de `raiz`. Idempotente y sin memoria: se le vuelve a
 * llamar al cambiar de idioma y al borrar, y reconstruye desde el inventario que se le
 * pasa (mismo contrato que `pinta()` del panel de estados).
 *
 * `hayCopia` = si este navegador tiene ya la extracción. Sin ella «continuar» llevaría
 * al juego sin recursos, así que la acción no se ofrece y se dice por qué: la partida
 * NO se ha perdido, sólo falta la copia con la que jugarla.
 *
 * `alCambiar` es qué hacer cuando el almacén cambia por algo que ha pasado DENTRO de una
 * tarjeta — hoy sólo la captura regenerada.
 *
 * 🔴 OBLIGATORIO, no opcional, y eso es una decisión: las DOS rutas que llaman aquí (el
 * refresco y el cambio de idioma) tienen que pintar la MISMA tarjeta. Con un parámetro
 * opcional, la ruta que se lo olvidara pintaría tarjetas sin el botón de regenerar y el
 * control desaparecería al conmutar ES/EN — un defecto que no da error y que sólo se ve
 * pulsando el idioma en el momento justo.
 */
export function pintaPartidas(
  raiz: HTMLElement,
  inv: Inventario,
  hayCopia: boolean,
  alCambiar: () => void,
): void {
  raiz.textContent = "";
  /** Tarjetas sin foto que además están en un MAPA GRANDE (Britannia o Underworld, los dos
   *  candidatas a minimapa — TODAS las que tengan posición, sea el sobremundo o un interior
   *  (#112). `location` elige el mapa y `floor` la planta; quien decide si ese mapa EXISTE es
   *  `pintaMinimapa`, leyendo la extracción. */
  const conMapa: {
    li: HTMLElement;
    media: HTMLElement;
    location: number;
    x: number;
    y: number;
    floor: number;
  }[] = [];

  // ── Partidas guardadas ────────────────────────────────────────────────────────
  // 🔴 EL MODIFICADOR `--partidas` NO ES DECORACIÓN: es el ancla por la que `exporta.ts`
  // coloca el bloque de transferencia JUSTO DETRÁS de esta sección (#229). Emparejar por
  // posición —«el primer `.guardados`»— habría atado el sitio del bloque al orden de
  // pintado, y ahí el fallo no es un error: es el importador apareciendo detrás de otra
  // cosa el día que alguien añada una sección arriba.
  const secP = el("section", "guardados guardados--partidas");
  secP.appendChild(el("h3", "guardados__titulo", txt("partidasTitulo")));
  if (!storeAvailable() && inv.partidas.length === 0) {
    secP.appendChild(el("p", "guardados__vacio", txt("almacenNoDisponible")));
  } else if (inv.partidas.length === 0) {
    secP.appendChild(el("p", "guardados__vacio", txt("partidasVacio")));
  } else {
    const lista = el("ul", "guardados__lista");
    for (const p of inv.partidas) {
      const meta = txt("partidaMeta", {
        lugar: legibleLocationName(p.locationName),
        turnos: num(p.turns),
        fecha: fecha(p.timestamp),
      });
      const li = el("li", "guardado guardado--tarjeta");
      // El ID de la ranura, para que `exporta.ts` sepa QUÉ partida descarga cada botón. Es un
      // atributo y no el orden de la lista a propósito: emparejar por posición no falla con un
      // error, falla descargando la partida de al lado.
      li.dataset.partida = p.id;
      // ── LAS ILUSTRACIONES VAN JUNTAS, EN SU PROPIA FRANJA ────────────────────────
      // 🔴 ANTES ERAN EXCLUYENTES Y ESO ERA EL DEFECTO: el minimapa sólo se encolaba
      // `if (!foto)`, así que en cuanto una partida ganaba captura PERDÍA el mapa. Lo
      // reportó el usuario con una captura de producción: «en el nuevo sale el sshot,
      // pero no el mapa; en los antiguos sale el mapa». Son dos cosas distintas —dónde
      // estabas y qué se veía— y ninguna sustituye a la otra.
      // La franja se crea SIEMPRE pero sólo se inserta si lleva algo dentro: sin foto y
      // sin posición no queda un hueco vacío (`:empty` no bastaría — el contenedor tiene
      // gap y padding propios).
      const media = el("div", "guardado__media");
      const foto = ilustracion(p.id);
      if (foto) media.appendChild(foto);
      // 🔴 EL BOTÓN YA NO ES SÓLO PARA MOMENTOS SIN FOTO (lote 2 de #174). Las dos
      // condiciones que caen y por qué:
      //
      // · `provenance === "momento"` CAE. Estaba puesta con su razón escrita —«sobre la
      //   partida de un jugador sería también correcto, pero es otra afirmación y no la he
      //   medido»— o sea, alcance diferido, no un impedimento. Hoy está medido: el camino
      //   arranca el juego con `?save=<id>`, que restaura CUALQUIER ranura, y `writeSaveShot`
      //   sólo exige que la ranura exista. La partida de un jugador se retrata igual de bien.
      // · «SIN foto» CAE, y ésta es la que arregla el reporte del usuario. Sus autosaves
      //   TIENEN foto: capturas del teléfono entero de antes de #153, verticales. Ofrecer el
      //   botón sólo cuando falta la foto dejaba fuera exactamente el parque que se queja.
      //
      // Lo que queda es `esCapturaCanonica`: se ofrece regenerar cuando lo guardado no es la
      // pantalla de 1988 —ni por ausencia, ni por ser una foto del móvil, ni por ser un jpeg
      // viejo ilegible—. Y cuando hay foto mala, la foto SE SIGUE VIENDO junto al botón: la
      // tarjeta no esconde lo que el visitante ya tenía, le ofrece cambiarlo.
      //
      // `hayCopia` se queda: la captura sale de ARRANCAR EL JUEGO y sin la extracción no
      // arranca — sin ella el botón sería el control muerto que la cabecera de este fichero
      // lleva entera negando.
      if (hayCopia && !esCapturaCanonica(readSaveShot(p.id))) {
        media.appendChild(botonRegenerar(p.id, alCambiar, foto !== null));
      }
      const info = el("div", "guardado__info");
      const nombre = el("b", "guardado__nombre", p.name);
      // INSIGNIA de procedencia. Va PEGADA al nombre y no entre los chips de estado: los
      // chips describen la PARTIDA (oro, karma, grupo) y esto describe de dónde SALIÓ, que
      // es lo primero que alguien necesita para no confundirla con las suyas. Sólo se pinta
      // cuando el índice lo dice (`SaveMeta.provenance`): ausente = partida del jugador, que
      // es lo que son todas las anteriores a los momentos legendarios.
      if (p.provenance === "momento") {
        const ins = el("span", "chip chip--momento", txt("chipMomento"));
        nombre.append(" ", ins);
      }
      info.appendChild(nombre);
      info.appendChild(el("small", "guardado__meta", meta));
      // Deserialización PEREZOSA: una por tarjeta, aquí y no al cargar la página.
      const d = leeDetalle(p.id);
      if (d) info.appendChild(chips(d));
      // El criterio es SÓLO «hay posición»: ni la foto lo condiciona (las dos ilustraciones
      // conviven) ni el tipo de mapa (antes exigía `location === 0`, y eso dejaba sin
      // ilustración a todo interior — hoy el sitio viaja y el pintor decide, #112).
      if (d?.posicion) {
        conMapa.push({
          li,
          media,
          location: d.posicion.location,
          x: d.posicion.x,
          y: d.posicion.y,
          floor: d.posicion.floor,
        });
      }
      if (media.childElementCount > 0) li.appendChild(media);
      li.appendChild(info);
      if (hayCopia) {
        const a = document.createElement("a");
        a.className = "guardado__accion";
        a.href = `/play.html?save=${encodeURIComponent(p.id)}`;
        // 🔴 «Continuar» es falso sobre un momento legendario: no se continúa una partida
        // que no se ha jugado nunca. Es el MISMO enlace y el mismo destino —no hay una
        // segunda vía— y lo único que cambia es el verbo, que es lo que la tarjeta afirma.
        a.textContent = txt(p.provenance === "momento" ? "partidaJugarDesdeAqui" : "partidaContinuar");
        // Último escalón del embudo. `byo_jugar` es «entra al juego»; esto es «entra A
        // UNA PARTIDA». Va el ORIGEN y NUNCA el id ni el nombre: los nombres de personaje
        // los inventa el jugador y son suyos (spec, carril 1 · aviso de privacidad).
        // Sin consentimiento esto no envía nada: `eventoVivo` reenvía al mismo objeto
        // `Analitica` y la puerta está detrás (ver `analitica-viva.ts`).
        a.addEventListener("click", () =>
          eventoVivo(EV.BYO_PARTIDA_JUGADA, {
            origen: p.provenance === "momento" ? "momento" : "propia",
          }),
        );
        // ── EL SELLO DE APERTURA DE UN MOMENTO ────────────────────────────────────────
        // 🔴 Éste es el ÚNICO instante en que la landing sabe que alguien se va a jugar un
        // momento CONCRETO, y por eso la insignia de «jugado» se ancla aquí y no en otro
        // sitio: a partir de la navegación manda el juego, que no distingue de qué ranura
        // arrancó (ver `insignias.ts` §2, con la medida de por qué el criterio evidente no
        // existe). Se apunta en el clic y no al pintar la tarjeta: pintar la lista no es irse
        // a jugar, y marcar en el pintado daría «jugado» a todo el que abre esta página.
        // Va SIN `preventDefault` y sin envolver el enlace: `marcaApertura` es un `setItem`
        // síncrono que termina antes de que el navegador atienda la navegación, y el enlace
        // sigue siendo un enlace de verdad (ctrl-clic, otra pestaña, menú contextual — la
        // misma razón por la que aquí no hay un botón que navegue).
        if (p.provenance === "momento" && p.momentoId) {
          const idMomento = p.momentoId;
          a.addEventListener("click", () => marcaApertura(idMomento));
        }
        li.appendChild(a);
      }
      // Sin copia: la fila se queda, con toda su información, y SIN acción.
      lista.appendChild(li);
    }
    secP.appendChild(lista);
    if (!hayCopia) secP.appendChild(el("p", "guardados__nota", txt("partidasSinCopia")));
  }
  raiz.appendChild(secP);
  // Diferido y sin await: la lista ya está en pantalla; el mapa llega cuando llegue.
  void anadeMinimapas(raiz, conMapa);
  // Y los iconos de artefacto, por el mismo camino y con el mismo contrato. Se buscan
  // DESPUÉS de insertar la sección: antes, los chips no están en `raiz` todavía.
  void anadeIconos(raiz, Array.from(secP.querySelectorAll<HTMLElement>(".chip--art")));

  // ── Repeticiones ──────────────────────────────────────────────────────────────
  const secR = el("section", "guardados");
  secR.appendChild(el("h3", "guardados__titulo", txt("repeticionesTitulo")));
  secR.appendChild(el("p", "guardados__que", txt("repeticionesQue")));
  if (!storeAvailable()) {
    secR.appendChild(el("p", "guardados__vacio", txt("almacenNoDisponible")));
  } else if (inv.repeticiones.length === 0) {
    secR.appendChild(el("p", "guardados__vacio", txt("repeticionesVacio")));
  } else {
    const lista = el("ul", "guardados__lista");
    for (const r of inv.repeticiones) {
      const meta = txt("repeticionMeta", {
        teclas: num(r.count),
        turnos: num(r.lastTurn),
        fecha: fecha(r.createdAt),
      });
      if (hayCopia) {
        const f = fila(r.label, meta, txt("repeticionVer"), `/play.html?replay=${encodeURIComponent(r.id)}`);
        f.insertBefore(miniaturaReplay(inv.miniaturas.get(r.id)), f.firstChild);
        // 🔴 SIGUE SIENDO UN ENLACE CON `href` REAL, y el popover se monta ENCIMA: así
        // ctrl-clic, «abrir en otra pestaña» y el menú contextual siguen funcionando,
        // y si el módulo del popover no cargara, el enlace lleva al juego igualmente.
        // Un `<button>` con `onclick` habría quitado las tres cosas para no ganar nada.
        f.querySelector("a")?.addEventListener("click", (ev) => {
          if (ev.metaKey || ev.ctrlKey || ev.shiftKey || (ev as MouseEvent).button !== 0) return;
          ev.preventDefault();
          void import("./popover-replay.js").then((m) => m.abreReplay(r.id, r.label));
        });
        lista.appendChild(f);
      } else {
        const li = el("li", "guardado");
        const info = el("div", "guardado__info");
        info.appendChild(el("b", "guardado__nombre", r.label));
        info.appendChild(el("small", "guardado__meta", meta));
        // La miniatura va TAMBIÉN sin copia de la extracción: es un dato que YA está en
        // este navegador y no depende de tener el juego con qué reproducir. Sin ella,
        // la rama sin copia sería la única lista que no ilustra, y sin razón.
        li.appendChild(miniaturaReplay(inv.miniaturas.get(r.id)));
        li.appendChild(info);
        lista.appendChild(li);
      }
    }
    secR.appendChild(lista);
    if (!hayCopia) secR.appendChild(el("p", "guardados__nota", txt("partidasSinCopia")));
  }
  // La ausencia de «compartir» se EXPLICA, en la sección donde alguien la buscaría.
  secR.appendChild(el("p", "guardados__nota", txt("repeticionesLocal")));
  raiz.appendChild(secR);

  // ── LLEVARSE UNA PARTIDA A OTRO DISPOSITIVO ───────────────────────────────────────
  // Diferido y sin await, como los minimapas y los iconos, y por la misma razón: el
  // chunk arrastra el MODELO DEL JUEGO entero (ver la cabecera de `exporta.ts`) y no
  // puede retrasar el pintado de la lista. Cuelga el botón «Descargar» de cada tarjeta
  // (las encuentra por el `data-partida` de arriba) y el bloque de importar al final.
  void import("./exporta.js").then((m) => m.montaTransferencia(raiz, inv.partidas));
}
