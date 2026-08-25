/**
 * EL RECORRIDO DEL WALKTHROUGH — las 21 paradas de un paseo completo por Ultima V.
 *
 * Pedido del usuario (14-08): «probar todo el juego siguiendo el walkthrough y pasando por los
 * momentos, shrines, y otros que no tenemos — un paquete de save games numerados para importar
 * en la pantalla de juego e ir pasando por cada uno; equipo en cada save CONSISTENTE con el
 * punto del juego».
 *
 * ── QUÉ ES ESTE FICHERO Y QUÉ NO ────────────────────────────────────────────────────────
 * Es la SECUENCIA y el estado de las paradas NUEVAS. No es un segundo modelo de save: el tipo
 * del parche es el `ParcheMomento` de los momentos legendarios y el compositor es el suyo
 * (`momentos/compone.ts`). Las diez paradas que YA son un momento legendario se REFERENCIAN
 * por id y su parche se lee de `momentos/defs.ts` — no se copia. Copiarlo habría creado un
 * segundo sitio donde equivocarse sobre estados que costaron tres tandas acertar (las dos
 * cárceles del 6 y del 7, la coordenada discriminada de Doom, el signo de la planta del
 * Underworld).
 *
 * ── 🔴 NI UNA COORDENADA DE LA EXTRACCIÓN SE TECLEA AQUÍ ─────────────────────────────────
 * Los santuarios (`shrineX/shrineY`), las bocas de mazmorra (`locationsX/locationsY`), las
 * palabras de poder y los mantras son DATOS DE EA: viven en `game/assets/data.json`, que es la
 * extracción de la copia del visitante y está gitignored entero (CLAUDE.md REGLA 4). Por eso
 * este fichero no exporta una tabla: exporta `construyeRecorrido(datos)`, y quien lo llama le
 * pasa esos vectores leídos en tiempo de ejecución. La alternativa —copiar los ocho pares de
 * coordenadas «que son sólo números»— es exactamente lo que la regla prohíbe, y encima crearía
 * la clase de errata que #118 pagó (el idx 34 que era Destard y no Doom).
 *
 * ── DOS PREMISAS DEL ENCARGO QUE LA MEDICIÓN CORRIGE, Y NO SE FINGEN ─────────────────────
 * 1. «los 3 SHARDS (con su mazmorra a la puerta)» — los shards NO están en las mazmorras. El
 *    port los siembra en el UNDERWORLD, en (192,80), (130,65) y (176,184) con planta 0xFF
 *    (`quest/underworld-seed.ts`, port de OUTSUBS 0x0566, tabla `data.json.shardSpawns`). Las
 *    mazmorras son el CAMINO —sólo cuatro bajan al Underworld desde su planta 7— pero el shard
 *    no está dentro de ninguna. Y medido con el `isPassable` del port: las tres celdas viven en
 *    bolsas de 9, 30 y 171 celdas AISLADAS (la de 130,65 sigue en 30 incluso en alfombra), o
 *    sea que un save plantado encima sería la tercera cárcel de esta galería. ⇒ el tramo de los
 *    shards lo cubren las tres paradas del RITUAL, que llevan el shard EN LA BOLSA. La bolsa
 *    aislada es la misma propiedad que la ficha #120 midió para la boca de Doom.
 * 2. «Resistance/palabras clave» — NO EXISTE en el port. El único `password` modelado es el
 *    desafío del guardia de Blackthorn al portador de la insignia
 *    (`world/guard-encounters.ts`), que es otra cosa y de otro acto. El lead ya retiró esa
 *    misma afirmación del catálogo de momentos al adjudicar el momento 2 (ver su comentario en
 *    `momentos/defs.ts`). No se inventa una parada para una mecánica que no está.
 *
 * ── LA OCTAVA VIRTUD NO TIENE SANTUARIO, TIENE CODEX ────────────────────────────────────
 * El encargo pide «los 8 SHRINES (uno por save)» y son OCHO PARADAS, pero no ocho santuarios:
 * `shrineX[6]`/`shrineY[6]` valen (0,0), que es el CENTINELA de Espiritualidad
 * (`world/shrines.ts` lo nombra: «coord centinela 0,0 → Codex/Underworld»). La octava parada
 * es el Codex, y su celda no sale de una tabla de santuarios sino del TILE: el (E)nter despacha
 * `CODEX_TILE = 0x11` (`game.ts:5959` → `runShrineCeremony({kind:"codex"})`), y ese tile
 * aparece UNA sola vez en el sobremundo. Se localiza barriendo el mapa, no se escribe.
 */
import type { GameTime } from "../core/time.js";
import type { Mochila, ParcheMomento, TextoBilingue } from "../momentos/defs.js";
import { aplicaParche } from "../momentos/compone.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../core/state.js";
import { SHADOWLORDS, shadowlordDeadFlag } from "../core/quest/shadowlord-keys.js";
import { wordSpokenFlag } from "../core/quest/words.js";
import { UNDERWORLD_PLOT_FLOOR } from "../core/quest/underworld-seed.js";

/**
 * ★ EL PARCHE DE UNA PARADA ES EL DE UN MOMENTO **MÁS DOS CAMPOS**, y se extiende aquí en vez
 * de tocar `momentos/defs.ts`.
 *
 * Los dos que faltan son los BITMAPS DE SANTUARIO, y sin ellos el peregrinaje de las ocho
 * paradas no se puede expresar: `shrineQuestBitmap` es el que acumula las quests ya activadas y
 * `shrineVisitedBitmap` el del Codex, que es quien DECIDE el modo de la visita
 * (`world/shrines.ts` `shrineMode`). Los diez momentos legendarios no los necesitaban —ninguno
 * ocurre en un santuario— así que su `ParcheMomento` no los lleva.
 *
 * ⚠ SE EXTIENDE, NO SE MODIFICA EL DE ALLÍ: ensanchar `ParcheMomento` metería un campo que sus
 * diez defs no usan y tocaría un fichero de otra tanda. Y los dos campos NO son un invento de
 * este paquete: tienen celda propia en la ventana del `SAVED.GAM` y viajan de ida y vuelta por
 * el códec nativo (`saveNative.ts` los escribe en `SHRINE_QUEST_OFFSET`/`SHRINE_VISITED_OFFSET`
 * y los relee), que es la condición para que un save pueda afirmarlos.
 */
export interface ParcheParada extends ParcheMomento {
  /** `g_shrine_quest_bitmap` — bit v = la quest del santuario v está activa. */
  shrineQuestBitmap?: number;
  /** `g_shrine_visited_bitmap` — bit v = el Codex ya enseñó la lección de la virtud v. */
  shrineVisitedBitmap?: number;
}

/**
 * El `GameState` de una parada NUEVA sobre la partida nueva del visitante.
 *
 * Reutiliza `aplicaParche` de los momentos (exportada allí para su arnés de mutantes) y sólo
 * añade encima los dos campos que aquél no conoce. Así el camino de las paradas nuevas es el
 * MISMO que el de los diez momentos salvo por dos asignaciones — que es lo que hace que las 21
 * paradas se puedan hornear y verificar con un único juego de asertos.
 */
export function componeParada(parche: ParcheParada, init: ExtractedInitialState): GameState {
  const state = createNewGame(init);
  aplicaParche(state, parche);
  if (parche.shrineQuestBitmap !== undefined) state.shrineQuestBitmap = parche.shrineQuestBitmap;
  if (parche.shrineVisitedBitmap !== undefined) state.shrineVisitedBitmap = parche.shrineVisitedBitmap;
  return state;
}

/** Localización del castillo de Lord British. La fija `momentos/defs.ts` (momento 7, loc 17). */
const CASTILLO_LB = 17;

/** Las ocho ranuras de pergaminos / pociones / reactivos, todas al mismo valor. */
function ocho(n: number): number[] {
  return [n, n, n, n, n, n, n, n];
}

/**
 * ★ LA CURVA DE EQUIPO, Y ES LA PROPIEDAD QUE HACE «CONSISTENTE» COMPROBABLE.
 *
 * El encargo pide equipo «consistente con el punto del juego», y eso no es una impresión: en un
 * paquete que se recorre en orden, la forma observable de la consistencia es que **ninguna
 * reserva BAJE al avanzar**. Un save 12 con menos comida que el 11 se lee como un despiste, y
 * es la clase de defecto que ningún aserto de posición ve.
 *
 * ⚠ Las CIFRAS son Clase C (autoría), igual que las de `mochilaDeActo` en `momentos/defs.ts`:
 * el juego no tiene un listón de «cuánto lleva un grupo en el acto III». Lo que NO es Clase C
 * es la MONOTONÍA, y por eso el test la asevera sobre el paquete entero, incluidas las diez
 * paradas cuyas mochilas son de los momentos y aquí no se tocan.
 *
 * ⇒ estas tres mochilas están elegidas para INTERPOLAR entre las de los momentos que las
 * rodean, no por gusto. Los topes de referencia (de `mochilaDeActo`, que las paradas-momento
 * usan): acto I food 120 / gold 300 · acto II 200/600 · acto III 300/1000 · acto IV 400/1500.
 */

/**
 * Parada 02 — dentro del castillo, aún en el primer día largo. Es la mochila del acto I EXACTA
 * (las mismas cifras que el momento 2), porque el tramo 01→03 es un solo acto y meter un
 * escalón intermedio sería inventar una progresión donde el juego no la tiene.
 */
const MOCHILA_CASTILLO: Mochila = { food: 120, gold: 300, keys: 4, gems: 1, torches: 6, skullKeys: 0 };

/**
 * Paradas 04-11 — EL PEREGRINAJE DE LOS OCHO SANTUARIOS. Una sola mochila para las ocho: es
 * una MESETA a propósito, porque lo que cambia entre esas paradas es el sitio y el mapa de
 * quests, no lo que se lleva encima.
 *
 * 🔴 LAS TRES ALFOMBRAS NO SON UN REGALO: SON LA ÚNICA SALIDA DE TRES DE LAS OCHO CELDAS.
 * Medido con el `isPassable` del port sobre `maps/overworld.json` (4 vecinos, a pie), la
 * componente conexa desde la casilla de cada santuario:
 *   Honestidad 364 · **Compasión 1** · Valor 9 · Justicia 15566 · Sacrificio 15566 ·
 *   Honor 15566 · Codex 39 · Humildad 246.
 * El de COMPASIÓN es una isla de UNA CELDA: a pie no hay un solo movimiento legal desde ahí.
 * Es literalmente la avería del momento 7 (dos celdas y cero puertas) en el sobremundo, y la
 * habría comprado el paquete entero si nadie mide.
 *
 * La salida existe y está EJECUTADA en el test, no supuesta: `useMagicCarpet`
 * (`endgame/use-tools.ts:188`, CAST 0x188b) exige ir A PIE y estar fuera de mazmorra
 * (`location < 0x21`) — las dos se cumplen en el sobremundo—, imprime «Boarded!» y pone el
 * transporte en alfombra. Y con alfombra la componente de las ocho pasa a ser el mundo entero
 * (medido: 30000+, el tope de la sonda). Por eso el transporte de estas paradas es `foot` y no
 * `carpet`: a pie es como el (E)nter del santuario funciona, y la alfombra va en la MOCHILA
 * para usarse después.
 *
 * ⚠ TRES y no una, por el mismo argumento que las tres skull keys del momento 6: el (U)se
 * DECREMENTA el contador al embarcar (`use-tools.ts:208`, `dec g_carpets` 0x18a1), así que una
 * sola alfombra es un margen de cero errores en un peregrinaje de ocho escalas.
 */
const MOCHILA_PEREGRINAJE: Mochila = {
  food: 200, gold: 450, keys: 5, gems: 2, torches: 8, skullKeys: 1, magicCarpets: 3,
  scrollQuantities: ocho(1), potionQuantities: ocho(1), reagentQuantities: ocho(6),
};

/**
 * Parada 12 — a las puertas de una mazmorra sellada, con la palabra por decir.
 *
 * 🔴 ESTA MOCHILA NACIÓ MAL Y LA REFUTÓ LA TABLA QUE ESTE PAQUETE GENERA. La primera versión
 * llevaba 800 de oro y 250 de comida «interpolando entre el acto II y el acto III», y eso da
 * una CAÍDA en la parada siguiente: los tres rituales son acto II (600 de oro, 200 de comida),
 * y esta parada va ANTES que ellos —hay que abrir una mazmorra para bajar al Underworld, y los
 * shards están abajo—, no después. El error fue razonar sobre el número de parada en vez de
 * sobre el acto de sus vecinas. Se vio al mirar la tabla impresa, no al escribir el comentario.
 *
 * ⇒ el techo de esta parada es el acto II, no el III. Queda entre el peregrinaje (450/200) y el
 * ritual (600/200), y por eso sube el oro y las antorchas y deja la comida en el mismo sitio.
 */
const MOCHILA_PALABRA: Mochila = {
  food: 200, gold: 500, keys: 5, gems: 2, torches: 9, skullKeys: 1,
  scrollQuantities: ocho(1), potionQuantities: ocho(1), reagentQuantities: ocho(7),
};

/**
 * Parada 19 — el Amuleto, en el Underworld. Es la mochila del acto IV EXACTA (las mismas cifras
 * que los momentos 8/9/10 que la rodean): la parada vive ENTRE dos de ellos, así que cualquier
 * cifra intermedia rompería la meseta del acto sin comprar nada.
 */
const MOCHILA_ACTO_IV: Mochila = {
  food: 400, gold: 1500, keys: 10, gems: 8, torches: 20, skullKeys: 4,
  scrollQuantities: ocho(3), potionQuantities: ocho(4), reagentQuantities: ocho(20),
};

/** Los seis del grupo completo, por índice de roster (el momento 2 declara que ya no crece). */
const SEIS = [0, 1, 2, 3, 4, 5];
/** Los tres del arranque: Avatar, Shamino, Iolo (el orden del momento 1). */
const TRES = [0, 1, 2];

/** A pie. `0x1C` = `g_transport_tile` de a pie (`state.ts:618`), como en todos los momentos. */
const A_PIE = { transport: "foot" as const, transportTile: 0x1c };

/** Nada de la trama todavía: se ESCRIBE para distinguir «aún no» de «no me he ocupado». */
const TRAMA_VIRGEN = {
  shards: { falsehood: false, hatred: false, cowardice: false },
  lbArtifacts: { amulet: false, crown: false, sceptre: false },
  specialItems: { blackBadge: false, woodenBox: false },
};

/** Los tres Shadowlords muertos — la fuente de verdad que leen `canReachDoom`/`endgameReady`. */
const TRES_MUERTOS = Object.fromEntries(SHADOWLORDS.map((k) => [shadowlordDeadFlag(k), true]));

/** Los datos de la EXTRACCIÓN que el recorrido necesita. Se pasan; no se copian. */
export interface DatosRecorrido {
  /** `data.json.shrineX` / `shrineY` — DATA.OVL 0x1F7E/0x1F86. Índice = virtud 0..7. */
  shrineX: readonly number[];
  shrineY: readonly number[];
  /** `data.json.virtues` / `mantras` — para el texto del README, no para el estado. */
  virtues: readonly string[];
  mantras: readonly string[];
  /** `data.json.locationsX` / `locationsY` — índice = location − 1 (`locationAt` devuelve i+1). */
  locationsX: readonly number[];
  locationsY: readonly number[];
  /** `data.json.wordsOfPower` — índice = location − 33 (`quest/words.ts`). */
  wordsOfPower: readonly string[];
  /**
   * Celda del Codex: la ÚNICA con `CODEX_TILE = 0x11` en el sobremundo. La resuelve el llamante
   * barriendo `maps/overworld.json`; aquí se recibe medida, para que este fichero no lleve una
   * coordenada de la extracción escrita a mano (ver la cabecera).
   */
  codex: { x: number; y: number };
}

/** Una parada del recorrido. */
export interface Parada {
  /** 1..21. El nombre de fichero lo compone el horneador como `NN-<slug>.u5gam`. */
  n: number;
  slug: string;
  titulo: TextoBilingue;
  lugar: TextoBilingue;
  /** Qué hacer al cargar este save. Español, imperativo, una o dos frases. */
  queProbar: string;
  /** Qué DEBERÍA pasar si el port está bien. Es la mitad falsable del README. */
  queDeberiaPasar: string;
  /**
   * Id del momento legendario que ESTA parada reutiliza, o `undefined` si es nueva. Cuando está
   * presente, el parche NO vive aquí: lo lee el horneador de `momentoPorId(momento).estado`.
   */
  momento?: string;
  /** El parche, sólo para las paradas NUEVAS. Excluyente con `momento`. */
  estado?: ParcheParada;
}

/** Reloj de una parada nueva. Clase C entera: el juego no fecha estas escenas. */
function reloj(year: number, month: number, day: number, hour: number, minute: number): GameTime {
  return { year, month, day, hour, minute };
}

/**
 * Las 21 paradas, en orden de juego.
 *
 * ⚠ EL ORDEN ES AUTORÍA sobre una columna vertebral que sí es del juego: los cuatro actos y la
 * cadena Corona → Caja → Underworld → Doom la fija la propia trama (y los momentos 6-10 ya la
 * ordenan). Lo elegido es DÓNDE encajan el peregrinaje de santuarios y la palabra de poder, que
 * en una partida real se pueden hacer en cualquier momento del tramo medio.
 *
 * 🔴 SIN DESENLACE, por orden explícita del usuario y regla ya escrita (#222, «todos SALVO el
 * final»): la última parada es la boca del Doom con todo en la mano. Lo que pasa al bajar las
 * ocho plantas no está en el paquete.
 */
export function construyeRecorrido(datos: DatosRecorrido): Parada[] {
  const paradas: Parada[] = [];

  // ══ ACTO I — el regreso ═══════════════════════════════════════════════════════════════
  paradas.push({
    n: 1, slug: "iolos-hut", momento: "momento-01",
    titulo: { es: "El regreso a Britannia", en: "The return to Britannia" },
    lugar: { es: "Iolo's Hut", en: "Iolo's Hut" },
    queProbar: "Habla con Iolo y con Shamino, sal de la cabaña y anda por el bosque.",
    queDeberiaPasar:
      "Arranca el día 5 del mes 4 del año 139 a las 8:35, grupo de tres, karma y mochila los de una partida nueva.",
  });

  paradas.push({
    n: 2, slug: "castillo-british",
    titulo: { es: "El castillo sin su rey", en: "The castle without its king" },
    lugar: { es: "Lord British's Castle", en: "Lord British's Castle" },
    queProbar:
      "Recorre el patio, habla con la gente del castillo y busca el clavicémbalo de la planta alta.",
    queDeberiaPasar:
      "El trono está vacío: Lord British sigue preso y Blackthorn gobierna. Las conversaciones responden por palabra clave.",
    estado: {
      /**
       * ⚠ CLASE C — LA CASILLA. «Dentro del castillo» no es una casilla concreta. Se elige
       * (16,30), y lo DERIVADO es que esté en la componente GRANDE: medido con `isPassable`
       * sobre `maps/smallmaps.json` loc 17 planta 0, la planta se parte en componentes de
       * 199 / 100 / 64 / 64 / 30 celdas, y (16,30) está en la de 199 — que además llega al
       * borde sur del mapa (y=31), o sea que desde ahí se puede SALIR del castillo. Elegido es
       * que sea el patio y no una sala interior; derivado es que no sea una cárcel.
       */
      position: { location: CASTILLO_LB, floor: 0, x: 16, y: 30 },
      // Clase C: el reloj. Media tarde del mismo mes del arranque.
      time: reloj(139, 4, 21, 15, 40),
      // Tres, como el momento 1: el grupo no se ha completado todavía (eso es la parada 3).
      party: TRES,
      ...A_PIE,
      ...TRAMA_VIRGEN,
      questFlags: {},
      mochila: MOCHILA_CASTILLO,
    },
  });

  paradas.push({
    n: 3, slug: "compania-completa", momento: "momento-02",
    titulo: { es: "La compañía al completo", en: "The full company" },
    lugar: { es: "A las puertas de Britain", en: "At the gates of Britain" },
    queProbar: "Mira la ficha del grupo (Ztats) y entra en Britain.",
    queDeberiaPasar:
      "Seis viajando juntos — el tope real del grupo (MAX_PARTY). A partir de aquí lo que cambia es lo que llevan encima.",
  });

  // ══ EL PEREGRINAJE DE LAS OCHO VIRTUDES ═══════════════════════════════════════════════
  //
  // ★ EL ORDEN DE LAS OCHO ES EL DE LA TABLA DEL BINARIO (índice de virtud 0..7), no uno
  // geográfico: así el número de parada y el índice de virtud coinciden y el README no necesita
  // una segunda tabla de correspondencia. La octava (Espiritualidad) es el Codex — ver cabecera.
  //
  // ★ LA QUEST QUEDA ACTIVABLE EN TODAS, y eso es DERIVADO: `shrineMode`
  // (`world/shrines.ts`) ramifica PRIMERO por el bit del Codex (`shrineVisitedBitmap`) y sólo
  // después por la quest. Con `shrineVisitedBitmap = 0` en las ocho paradas, el modo es
  // «show-mantra» en todas — el que MUESTRA el mantra y FIJA la quest. O sea: el (E)nter de
  // cada santuario hace lo que la tarjeta promete, en las ocho, sin depender del orden.
  //
  // ★ Y EL `shrineQuestBitmap` ACUMULA: la parada del santuario i llega con las quests de los
  // i anteriores ya fijadas. No es adorno — es lo que hace que las ocho paradas sean estados
  // DISTINTOS y no la misma foto ocho veces, y se deriva del propio bit (1 << v).
  /**
   * ⚠ EN GENITIVO YA CONTRAÍDO, y no es una preferencia de estilo: la primera versión guardaba
   * el nombre con su artículo («el Valor») y componía «El santuario de ${nombre}», que en las
   * tres virtudes masculinas imprime «de el Valor», «de el Sacrificio» y «de el Honor» en el
   * README que lee el usuario. Contraer en el sitio donde se compone habría hecho falta en los
   * dos textos (título y lugar); guardar la forma final lo arregla una sola vez.
   */
  const VIRTUD_GENITIVO_ES: readonly string[] = [
    "de la Honestidad", "de la Compasión", "del Valor", "de la Justicia",
    "del Sacrificio", "del Honor", "de la Espiritualidad", "de la Humildad",
  ];
  /**
   * 🔴 EL CODEX VA EL ÚLTIMO, Y ESTE ORDEN CORRIGE AL PRIMERO QUE ESCRIBÍ. Recorrer los
   * índices de virtud 0..7 tal cual deja la Espiritualidad (índice 6) en la SÉPTIMA parada y
   * la Humildad en la octava — o sea el Codex en medio del peregrinaje. Y eso contradice a la
   * propia mecánica: el flujo del original es santuario (fija la quest) → peregrinaje al Codex
   * (fija el bit de lección) → volver al santuario (completa la quest), que `world/shrines.ts`
   * documenta en `shrineMode`. Con el Codex en medio, el paquete enseñaría la ceremonia que
   * DESBLOQUEA antes de haber activado lo que desbloquea.
   * ⇒ los siete santuarios de la tabla en su orden, y la Espiritualidad —que no tiene
   * santuario, tiene Codex— cerrando. Lo derivado es cuál es el Codex (el centinela (0,0));
   * lo elegido es que vaya al final.
   */
  const ORDEN_PEREGRINAJE = [0, 1, 2, 3, 4, 5, 7, 6];
  for (let paso = 0; paso < ORDEN_PEREGRINAJE.length; paso++) {
    const v = ORDEN_PEREGRINAJE[paso]!;
    const esCodex = datos.shrineX[v] === 0 && datos.shrineY[v] === 0;
    const x = esCodex ? datos.codex.x : datos.shrineX[v]!;
    const y = esCodex ? datos.codex.y : datos.shrineY[v]!;
    const virtud = datos.virtues[v] ?? `virtud ${v}`;
    const mantra = datos.mantras[v] ?? "";
    // Las quests de los santuarios ANTERIORES, ya fijadas. Bit v de g_shrine_quest_bitmap.
    // ⚠ Acumula sobre el ORDEN DEL RECORRIDO, no sobre el índice de virtud: son dos secuencias
    // distintas desde que el Codex pasó al final, y usar `v` marcaría como visitados santuarios
    // a los que esta parada todavía no ha llegado.
    let quests = 0;
    for (let i = 0; i < paso; i++) quests |= 1 << ORDEN_PEREGRINAJE[i]!;

    paradas.push({
      n: 4 + paso,
      slug: esCodex ? "codex-espiritualidad" : `santuario-${slugVirtud(v)}`,
      titulo: esCodex
        ? { es: "El Codex de la Sabiduría Última", en: "The Codex of Ultimate Wisdom" }
        : { es: `El santuario ${VIRTUD_GENITIVO_ES[v]}`, en: `The Shrine of ${virtud}` },
      lugar: esCodex
        ? { es: "Ante el Codex", en: "Before the Codex" }
        : { es: `Santuario ${VIRTUD_GENITIVO_ES[v]}`, en: `Shrine of ${virtud}` },
      queProbar: esCodex
        ? "Pulsa (E)nter estando encima. Es la parada de la octava virtud: Espiritualidad no tiene santuario en el mapa."
        : `Pulsa (E)nter para entrar al santuario y medita. El mantra es «${mantra}».`,
      queDeberiaPasar: esCodex
        ? "La ceremonia del Codex, que es la que ENSEÑA las lecciones — el bit que luego permite completar la quest de cada santuario."
        : `El santuario se presenta en pantalla con su nombre en inglés («${virtud}», que es como lo imprime el juego) y su mantra, y ACTIVA su quest. Con las lecciones del Codex ya aprendidas, en cambio, completaría la quest y subiría atributo y karma.`,
      estado: {
        position: { location: 0, floor: 0, x, y },
        // Clase C: el reloj. Un peregrinaje de varias semanas, una parada cada pocos días.
        time: reloj(139, 8 + Math.floor(paso / 4), 3 + paso * 3, 9 + paso, 20),
        party: SEIS,
        ...A_PIE,
        ...TRAMA_VIRGEN,
        shrineQuestBitmap: quests,
        // El bit del Codex a CERO en las ocho: es lo que mantiene el modo «show-mantra».
        shrineVisitedBitmap: 0,
        questFlags: {},
        mochila: MOCHILA_PEREGRINAJE,
      },
    });
  }

  // ══ ACTO II — la palabra y los tres rituales ══════════════════════════════════════════
  //
  // ★ LA MAZMORRA ES DESPISE, Y SE ELIGE POR MEDICIÓN. La (Y)ell de una palabra de poder abre
  // el sello sólo si la party está EN UNA DE LAS CUATRO CELDAS VECINAS de la boca
  // (`quest/words.ts`: el handler escanea los 4 vecinos, no usa getdir) ⇒ la parada tiene que
  // estar AL LADO, no encima. De las ocho bocas, la de Despise (loc 34) tiene UNA sola vecina
  // pisable a pie —(91,68), tile 0x0B— y esa vecina está en la componente de 15566 celdas, o
  // sea el continente: la party puede llegar e irse andando. Las de Deceit (37 celdas),
  // Covetous (2), Shame (15) e Hythloth (42) viven en bolsas pequeñas, y la de Doom no es
  // pisable en el sobremundo (vive en el Underworld — el discriminante de #118).
  // ⚠ Lo ELEGIDO es Despise entre las tres de continente (las otras: Destard y Wrong);
  // lo DERIVADO es que su única vecina sea pisable y esté en el continente.
  {
    const DESPISE = 34;
    const bx = datos.locationsX[DESPISE - 1]!;
    const by = datos.locationsY[DESPISE - 1]!;
    const palabra = datos.wordsOfPower[DESPISE - 33]!;
    paradas.push({
      n: 12, slug: "palabra-de-poder",
      titulo: { es: "La palabra que abre el sello", en: "The word that breaks the seal" },
      lugar: { es: "A la puerta de Despise", en: "At the mouth of Despise" },
      queProbar:
        `La boca de la mazmorra está justo al NORTE y su sello está puesto. Pulsa (Y)ell y grita «${palabra}».`,
      queDeberiaPasar:
        `Sale «A word of power is uttered» y el sello se abre. Si gritas la palabra de OTRA mazmorra, sale además «No effect!»: la palabra es válida pero no hay entrada que le corresponda al lado. Con el sello puesto, la boca se pinta como derrumbe y no se puede entrar.`,
      estado: {
        // La ÚNICA vecina pisable de la boca, medida (ver el bloque de arriba).
        position: { location: 0, floor: 0, x: bx, y: by + 1 },
        // Clase C: el reloj.
        time: reloj(139, 11, 14, 8, 0),
        party: SEIS,
        ...A_PIE,
        // Acto II en su arranque: los shards siguen abajo y no hay nada de la trama en la bolsa.
        ...TRAMA_VIRGEN,
        /**
         * ★ DOS PALABRAS YA DICHAS Y LA TERCERA NO — y las dos que se dan son las otras DOS
         * bocas de continente (Destard 35 y Wrong 36), no dos cualesquiera: así el estado
         * cuenta una ruta que se puede haber recorrido a pie. La de Despise se deja SIN decir
         * porque es la que esta parada existe para probar.
         */
        questFlags: {
          [wordSpokenFlag(35)]: true,
          [wordSpokenFlag(36)]: true,
        },
        mochila: MOCHILA_PALABRA,
      },
    });
  }

  paradas.push({
    n: 13, slug: "ante-faulinei", momento: "momento-03",
    titulo: { es: "Ante Faulinei", en: "Facing Faulinei" },
    lugar: { es: "Lycaeum", en: "The Lycaeum" },
    queProbar: "Pulsa (U)se y elige el fragmento de la Falsedad.",
    queDeberiaPasar:
      "El ritual dispara y Faulinei es destruido: estás en la casilla exacta de la Llama de la Verdad, con el Shadowlord convocado justo al norte y su fragmento en la mano. Sin consumo de azar.",
  });

  paradas.push({
    n: 14, slug: "ante-astaroth", momento: "momento-04",
    titulo: { es: "Ante Astaroth", en: "Facing Astaroth" },
    lugar: { es: "Empath Abbey", en: "Empath Abbey" },
    queProbar: "Pulsa (U)se y elige el fragmento del Odio.",
    queDeberiaPasar: "Igual que el anterior, sobre la Llama del Amor en la abadía.",
  });

  paradas.push({
    n: 15, slug: "ante-nosfentor", momento: "momento-05",
    titulo: { es: "Ante Nosfentor", en: "Facing Nosfentor" },
    lugar: { es: "Serpent's Hold", en: "Serpent's Hold" },
    queProbar: "Pulsa (U)se y elige el fragmento de la Cobardía.",
    queDeberiaPasar:
      "El tercero cae sobre la Llama del Coraje. Con los tres muertos se abre el camino al Underworld y a Doom.",
  });

  // ══ ACTO III — el usurpador ═══════════════════════════════════════════════════════════
  paradas.push({
    n: 16, slug: "camara-blackthorn", momento: "momento-06",
    titulo: { es: "La cámara de Blackthorn", en: "Blackthorn's chamber" },
    lugar: { es: "Palace of Blackthorn", en: "Palace of Blackthorn" },
    queProbar:
      "Anda un paso al sur y usa la Skull Key contra la puerta; luego (O)pen y cruza. La Corona está al norte.",
    queDeberiaPasar:
      "La puerta de (15,16) es un cerrojo MÁGICO: (O)pen da «Locked!» y (J)immy rompe la llave SIEMPRE. Sólo la Skull Key la desmagifica — y el (U)se gasta la llave aunque falles, por eso el save trae tres.",
  });

  paradas.push({
    n: 17, slug: "corona-y-caja", momento: "momento-07",
    titulo: { es: "La Corona y la Caja de Sándalo", en: "The Crown and the Sandalwood Box" },
    lugar: { es: "Lord British's Castle", en: "Lord British's Castle" },
    queProbar:
      "Baja tres pasos al sur hasta la silla del clavicémbalo y toca la melodía; el pasadizo se abre hacia la Caja.",
    queDeberiaPasar:
      "La Corona ya es tuya. El pasadizo del clavicémbalo es estado de SESIÓN y no viaja en el save: al cargar, el muro está puesto otra vez y hay que tocar la melodía de nuevo.",
  });

  // ══ ACTO IV — bajo tierra ═════════════════════════════════════════════════════════════
  paradas.push({
    n: 18, slug: "boca-underworld", momento: "momento-08",
    titulo: { es: "La boca del Underworld", en: "The mouth of the Underworld" },
    lugar: { es: "Underworld, bajo Shame", en: "Underworld, beneath Shame" },
    queProbar: "Anda con la antorcha encendida y usa una gema para ver el mapa desde arriba.",
    queDeberiaPasar:
      "Bajo tierra no amanece: la luz no depende de la hora y sin antorcha el radio es el mínimo. Una gema, una vista.",
  });

  {
    /**
     * ★ EL AMULETO ESTÁ EN UNA CELDA QUE EL PORT CALCULA, y su sitio no es Clase C: el
     * sembrador del Underworld lo pone en (105,225) con tile 0xB7 y planta 0xFF
     * (`quest/underworld-seed.ts` `AMULET_SPAWN`, inmediatos de OUTSUBS 0x0589-0x0598), y sólo
     * lo siembra si NO ha sido tomado — que es exactamente el estado de esta parada.
     *
     * ⚠ CLASE C — LA CASILLA DEL GRUPO, y se elige la de al lado y no la de encima: el (G)et es
     * DIRECCIONAL, así que la party se planta al SUR y coge hacia el norte. De las cuatro
     * vecinas medidas —(105,224) 0x31, (106,225) 0x30, (105,226) 0x05, (104,225) 0x30— las
     * cuatro son pisables a pie; se toma (105,226). Lo DERIVADO es que la bolsa donde cae es de
     * 1641 celdas (medido con `isPassable` sobre `maps/underworld.json`), o sea que no es una
     * cárcel: se puede andar.
     *
     * ⚠ Y NO SE AFIRMA QUE SE LLEGUE AQUÍ ANDANDO DESDE LA PARADA 18: no se puede. La boca de
     * Shame abre a una bolsa de 2358 celdas y ésta es otra de 1641 — dos componentes distintas,
     * medidas. Es la misma propiedad que el momento 8 ya declara y que la ficha #120 tiene
     * abierta para la boca de Doom. Por eso esta parada es un save aparte y no «anda un rato
     * desde la 18».
     */
    const AX = 105;
    const AY = 225;
    paradas.push({
      n: 19, slug: "amuleto-lord-british",
      titulo: { es: "El Amuleto de Lord British", en: "The Amulet of Lord British" },
      lugar: { es: "Underworld, ante el Amuleto", en: "Underworld, before the Amulet" },
      queProbar: "El Amuleto está justo al NORTE. Pulsa (G)et y apunta al norte.",
      queDeberiaPasar:
        "Sale «The Amulet of Lord British!» y la tercera regalía entra en la bolsa. Con la Corona y el Cetro ya dentro, eso completa lo que el rescate pide.",
      estado: {
        position: { location: 0, floor: UNDERWORLD_PLOT_FLOOR, x: AX, y: AY + 1 },
        // Clase C, e INERTE bajo tierra: la luz no mira el reloj cuando la planta es del
        // Underworld (el momento 8 lo declara con su cita).
        time: reloj(140, 3, 5, 12, 0),
        party: SEIS,
        ...A_PIE,
        // Una antorcha encendida: 0x64 = 100 min, la de descolgar un aplique de pared (la
        // misma constante y por la misma ruta que los momentos 8/9/10).
        torchTurns: 0x64,
        // Los tres shards se GASTARON en sus rituales.
        shards: { falsehood: false, hatred: false, cowardice: false },
        // Corona y Cetro sí; el Amuleto NO — es lo que esta parada existe para recoger, y el
        // gate del sembrador exige que no esté tomado para que aparezca en el mapa.
        lbArtifacts: { amulet: false, crown: true, sceptre: true },
        specialItems: { blackBadge: true, woodenBox: true },
        questFlags: {
          ...TRES_MUERTOS,
          // El sello de Shame abierto: es por donde se bajó (mismo argumento que el momento 8).
          [wordSpokenFlag(38)]: true,
        },
        mochila: MOCHILA_ACTO_IV,
      },
    });
  }

  paradas.push({
    n: 20, slug: "puertas-doom", momento: "momento-09",
    titulo: { es: "Las puertas del Doom", en: "The gates of Doom" },
    lugar: { es: "Ante la Mazmorra del Doom", en: "Before the Dungeon of Doom" },
    queProbar: "La boca está un paso al este. Anda hasta ella y prueba a entrar.",
    queDeberiaPasar:
      "Se puede bajar pero todavía no cerrar: falta el Amuleto. Con algún Shadowlord vivo, el (E)nter de Doom se interrumpe con «Attacked at entrance!» — aquí los tres están muertos, así que deja pasar.",
  });

  paradas.push({
    n: 21, slug: "boca-doom", momento: "momento-10",
    titulo: { es: "El rescate de Lord British", en: "The rescue of Lord British" },
    lugar: { es: "La boca del Doom", en: "The mouth of Doom" },
    queProbar:
      "Estás encima de la boca con las tres regalías y la Caja. Baja si quieres — el paquete se acaba aquí.",
    queDeberiaPasar:
      "Todo lo que el rescate pide está en la mano. Lo que queda es el descenso, y el desenlace NO va en este paquete a propósito.",
  });

  return paradas;
}

/** Slug ASCII de la virtud `v`, para el nombre de fichero. No sale de la extracción. */
function slugVirtud(v: number): string {
  return ["honestidad", "compasion", "valor", "justicia", "sacrificio", "honor", "espiritualidad", "humildad"][v]!;
}
