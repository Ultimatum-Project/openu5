/**
 * MOMENTOS LEGENDARIOS — las diez partidas prefabricadas y sus datos.
 *
 * Spec: `docs/superpowers/specs/2026-08-08-momentos-legendarios-design.md`.
 *
 * ── QUÉ ES UN «DEF» ─────────────────────────────────────────────────────────────────────
 * Dos cosas en un mismo objeto, y a propósito:
 *   · el CATÁLOGO — acto, título y línea de ambientación en los dos idiomas, miniatura.
 *     Es lo que pinta el modal de `/byo`.
 *   · el PARCHE de estado — los campos de `GameState` que este momento GARANTIZA.
 * Van juntos porque el spec pide que el modal no lleve textos que puedan divergir de los
 * saves: con una sola fuente no hay dos copias que puedan separarse. El catálogo horneado
 * (`demo-byo/public/momentos/momentos.json`) sale de AQUÍ por generación, y
 * `re/tools/test_byo_momentos.py` exige que sea su PUNTO FIJO — si alguien edita el JSON a
 * mano, se pone rojo.
 *
 * ── EL PARCHE SE ESCRIBE, NO SE HEREDA ──────────────────────────────────────────────────
 * 🔴 Todo campo que un momento AFIRME va en su parche aunque coincida con el de una partida
 * nueva. Es lo que separa «este momento pasa en la planta 0» de «no me he ocupado de la
 * planta». El momento 1 es el caso extremo —ocurre justo donde arranca el juego, así que
 * casi todo su parche repite el valor base— y si se hubiera dejado heredar, su test estaría
 * comprobando la partida nueva y NO el def: pasaría verde con el def borrado. Escribiéndolo,
 * el mutante «planta equivocada» enrojece (probado: ver `test_byo_momentos.py`).
 *
 * ── DE DÓNDE SALEN LOS DATOS ────────────────────────────────────────────────────────────
 * Del código del port y del propio arranque del juego; nunca inventados. Cada campo lleva su
 * cita. Lo que NO se puede derivar con confianza se deja fuera del parche y se HEREDA de la
 * partida nueva del visitante — que es exactamente lo que hay que hacer con el roster: los
 * nombres, stats y equipo de los compañeros son dato de EA y no viajan en ficheros tracked
 * (CLAUDE.md REGLA 4; misma razón que declara `demo-byo/verificacion/verifica-tarjeta.mjs`
 * en su cabecera). Por eso el parche dice QUIÉN va en el grupo por su ÍNDICE de roster, y
 * nunca sus cifras.
 */
import type { GameTime } from "../core/time.js";
import type { GameState, Position, TransportMode } from "../core/state.js";
import {
  FLAME_X,
  FLAME_Y,
  FLAME_LOCATION,
  FLAME_FLOOR,
} from "../core/quest/ritual.js";
// 🔴 DE `shadowlord-keys.js` Y NO DE `shadowlords.js`, aunque el segundo también las exporte:
// aquél no importa nada y éste importa `tf`, que arrastra el catálogo de traducción ENTERO al
// bundle de `/byo` (4 871 B → 482 052 B, medido). Ver la cabecera de `shadowlord-keys.ts`.
import { SHADOWLORDS, shadowlordDeadFlag } from "../core/quest/shadowlord-keys.js";
// `words.ts` NO IMPORTA NADA (comprobado: cero líneas `import` en el fichero), así que estas
// dos entran sin arrastrar grafo. Es la misma cautela que la nota de arriba.
import { LAST_DUNGEON_LOCATION, wordSpokenFlag } from "../core/quest/words.js";
import { UNDERWORLD_PLOT_FLOOR } from "../core/quest/underworld-seed.js";
// `harpsichord.ts` TAMPOCO IMPORTA NADA (cero líneas `import`, comprobado igual que con
// `words.ts`): entra sin arrastrar grafo al bundle de `/byo`. De aquí sale la celda del
// pasadizo del momento 7 — ver su nota.
import { HARPSICHORD_PASSAGE } from "../core/world/harpsichord.js";

/** Los cuatro actos en los que el spec agrupa los momentos. */
export type Acto = 1 | 2 | 3 | 4;

/** Texto de catálogo en los dos idiomas del sitio. */
export interface TextoBilingue {
  es: string;
  en: string;
}

/**
 * ★ LAS RESERVAS DE LA MOCHILA que un momento AFIRMA — el grupo de campos que faltaba.
 *
 * 🔴 EL DEFECTO QUE ORIGINA ESTE TIPO (reporte del usuario, jugando de verdad): hasta hoy
 * NINGÚN parche escribía una sola reserva, así que los diez momentos HEREDABAN las del
 * arranque de una partida nueva — y ésas son las de `INIT.GAM`: **0 gemas y 0 skull keys**.
 * Con eso, el momento 6 nace en una habitación cuya única salida es un cerrojo MÁGICO que
 * sólo abre la skull key, y los tres del acto IV bajan al Underworld sin la gema que enseña
 * el mapa. El estado era coherente y la partida, injugable: la clase de defecto que ningún
 * aserto sobre posición podía ver.
 *
 * ── EL CONJUNTO DE CAMPOS SALE DEL CÓDEC, NO DE UNA LISTA DE DESEOS ─────────────────────
 * Cada campo de aquí tiene su celda en la ventana de `SAVED.GAM` y viaja de ida y vuelta:
 * `food` 0x202 (u16) · `gold` 0x204 (u16) · `keys` 0x206 · `gems` 0x207 · `torches` 0x208 ·
 * `magicCarpets` 0x20A · `skullKeys` 0x20B · `scrollQuantities` 0x27A..0x281 ·
 * `potionQuantities` 0x282..0x289 · `reagentQuantities` 0x2AA..0x2B1 (`saveNative.ts:310-334`
 * de lectura y `:548-572` de escritura). Lo que el save NO modela no se finge: se declara
 * como límite en la nota de cada momento.
 *
 * ── LAS CANTIDADES SON CLASE C, Y SE ELIGEN PARA QUE SE NOTE ────────────────────────────
 * ⚠ El juego no tiene un listón de «cuánto lleva encima un grupo en el acto III»: no hay
 * nada que derivar y toda cifra de aquí es AUTORÍA. Se declara momento a momento con su
 * razón. Y las tres tablas de ocho van UNIFORMES a propósito —`[3,3,3,3,3,3,3,3]` y no un
 * reparto con pinta de inventario real—: un vector constante **no se puede confundir con
 * dato extraído de EA**, que es justo lo que no puede viajar en un fichero tracked
 * (CLAUDE.md REGLA 4). El reparto bonito habría sido indistinguible de una copia.
 */
export interface Mochila {
  /** Raciones. 3 comidas/día (horas 6/12/18) × miembros vivos (`survival.ts:439-447`). */
  food?: number;
  gold?: number;
  /** Llaves normales: (J)immy sobre 0xB9/0xBB. NO abren el cerrojo mágico — ver `skullKeys`. */
  keys?: number;
  /** Gemas: el (V)iew consume UNA por vista (`game.ts:2521`, `dec [g_gems]` 0x3428). */
  gems?: number;
  /** Reserva de antorchas de la mochila (la que gasta el (I)gnite), no la encendida. */
  torches?: number;
  /**
   * Skull keys: lo ÚNICO que desmagifica un cerrojo 0x97/0x98 (`game.ts:3170 useSkullKey`,
   * CAST.OVL 0x18c4). El (J)immy sobre uno de ésos **siempre** rompe la llave y nunca abre
   * (`commands.ts:183-186`, rama `magic`) ⇒ sin skull key, una puerta mágica es un muro.
   */
  skullKeys?: number;
  magicCarpets?: number;
  /** Los OCHO pergaminos, en el orden de `SCROLL_NAMES` (`useScroll.ts:22`). */
  scrollQuantities?: number[];
  /** Las OCHO pociones, en el orden de `POTION_COLORS` (`usePotion.ts:19`). */
  potionQuantities?: number[];
  /** Los OCHO reactivos, en el orden de la name-table DS 0x19D2 (`coreview.ts:177`). */
  reagentQuantities?: number[];
}

/**
 * Los campos de `GameState` que un momento AFIRMA. Todo lo ausente se hereda de la partida
 * nueva del visitante (`createNewGame` sobre SU `initial-state.json`).
 *
 * Es un subconjunto del TIPO, no un JSON suelto: un rename en `state.ts` rompe el build de
 * este fichero en vez de romper el navegador (decisión #3 del spec, «nada de JSON a mano»).
 */
export interface ParcheMomento {
  /** Dónde está el grupo. Obligatorio: es lo primero que define un momento. */
  position: Position;
  /** Reloj y calendario del juego. */
  time?: GameTime;
  /**
   * Quiénes viajan, por ÍNDICE del roster de 16 (`state.ts:31` — `partyStatus` 0 = en el
   * grupo, 0xFF = no unido). Índices, no nombres ni cifras: ver la cabecera.
   * El índice 0 es el Avatar y va siempre.
   */
  party?: number[];
  transport?: TransportMode;
  /** `g_transport_tile` (0x1C = a pie, `state.ts:618`). */
  transportTile?: number;
  karma?: number;
  turnsSinceStart?: number;
  /** Minutos de antorcha encendida (`state.ts:179`). Distinto de `mochila.torches`. */
  torchTurns?: number;
  /** Reservas de la mochila. Ver el bloque de `Mochila`: lo ausente se hereda. */
  mochila?: Mochila;
  shards?: GameState["shards"];
  lbArtifacts?: GameState["lbArtifacts"];
  /** Sólo los que un momento necesite afirmar; el resto se hereda. */
  specialItems?: Partial<GameState["specialItems"]>;
  /** Flags de trama que este momento da por cumplidos (`state.ts:306`). */
  questFlags?: Record<string, boolean>;
  /**
   * Shadowlord CONVOCADO y presente, por su índice canónico (0 falsehood · 1 hatred ·
   * 2 cowardice, `quest/shadowlords.ts:20`).
   *
   * Pone las DOS precondiciones que el ritual exige y que ningún otro campo del parche podía
   * expresar (`quest/ritual.ts:208-209`):
   *   · `shadowlordSummoned = idx` — el byte `g_shadowlord_here` (CAST 0x16ce), y
   *   · un `worldObjects` `kind:"shadowlord"` con `tile` 0xFC **en (x, y−1)**.
   *
   * 🔴 (x, y−1) Y NO (x, y−2), y la diferencia está medida: el (Y)ell COLOCA en (x, y−2)
   * (`ritual.ts:105`, `spawnDy: 2`, CMDS 0x10d4) pero el ritual LEE (x, y−1)
   * (`endgame/use-tools.ts:72`, «el binario lee el tile en (x, y-1)»). Quien componga por
   * analogía con el summon pone el objeto donde el ritual no mira, y el momento queda a DOS
   * Use de destruirlo en vez de a uno — con todo lo demás correcto y sin ningún error
   * visible. El aserto que lo caza es que el ritual DISPARE, no que el objeto exista.
   *
   * ⚠ Los dos campos viajan en el SIDECAR, no en la ventana de SAVED.GAM: `worldObjects` y
   * `shadowlordSummoned` no tienen celda. Se escriben en `saveNative.ts:635` y `:646` y se
   * releen en `:704` y `:715` — CUATRO líneas sueltas, no dos rangos. (La cita decía
   * «645-647,714-716», dos rangos contiguos que entre los dos sólo cubrían
   * `shadowlordSummoned`: el lector que fuese a comprobar `worldObjects` habría mirado donde
   * no está y no habría encontrado nada que lo desmintiera.)
   */
  shadowlordConvocado?: number;
}

export interface MomentoDef {
  /** Id ESTABLE: es también el id del save sembrado ⇒ re-añadir hace upsert, no duplica. */
  id: string;
  acto: Acto;
  titulo: TextoBilingue;
  /** Una línea de ambientación; ni resumen de la trama ni instrucciones. */
  ambiente: TextoBilingue;
  /** Nombre del lugar para la cabecera de la tarjeta del save (`SaveMeta.locationName`). */
  lugar: TextoBilingue;
  /**
   * Referencia de miniatura. `"minimapa"` = la tarjeta cae al minimapa que ya pinta
   * `partidas.ts`; una clave de artefacto = el icono recortado del atlas del visitante.
   * NO es una imagen nuestra: ninguna miniatura de EA viaja en el sitio.
   */
  miniatura: string;
  /**
   * Ausente ⇒ la tarjeta sale como «próximamente» y sin botón. Los nueve momentos que
   * todavía no tienen estado derivado están así A PROPÓSITO: el spec pide las diez tarjetas
   * en la fase 1, y una tarjeta con botón que no siembra nada sería un control muerto.
   */
  estado?: ParcheMomento;
}

/**
 * ★ LOCALIZACIÓN 13 = la casa de Iolo. Derivado del port, no de un walkthrough:
 * `game/src/core/npc/manager.ts:434` la nombra literalmente («el ÚNICO `aiType 1`
 * (Iolo's Hut loc 13)»). ⚠ La cita decía `:412` y el fichero se movió: el HECHO seguía
 * siendo cierto y el NÚMERO ya no. Confirmación independiente del id, ésta sin número de
 * línea que se pueda mover: `extractor/src/data/locations.ts` lo lista como 13.
 */
const IOLOS_HUT = 13;

/** Las ocho ranuras de pergaminos / pociones / reactivos, todas al mismo valor. */
function ocho(n: number): number[] {
  return [n, n, n, n, n, n, n, n];
}

/**
 * ★ LA MOCHILA POR ACTO — «intuir material a esas alturas de juego», hecho explícito.
 *
 * ⚠ TODO lo de esta función es CLASE C. Lo único derivado son las UNIDADES en las que se
 * razona, y son cuatro, cada una con su cita:
 *   · comida  — 3 comidas al día (horas 6/12/18) y cada una cuesta UNA ración POR MIEMBRO
 *     vivo (`survival.ts:439-447`) ⇒ un grupo de SEIS gasta **18 raciones/día**. Las cifras
 *     de abajo se leen en días: 120 ≈ 6 días de seis bocas; 400 ≈ 22.
 *   · antorchas — una (I)gnite fuera de mazmorra da 240 min (`TORCH_MINUTES = 0xF0`,
 *     `survival.ts:117`) y en el Underworld un paso cuesta 2 min ⇒ **120 pasos por
 *     antorcha**. Dentro de una mazmorra da `112 + rand(0,15)` min a 1 min/paso ⇒ **112..127
 *     pasos** (`igniteTorch`, `survival.ts:489-493`; `MINUTES_PER_ACTION_DUNGEON = 1`).
 *   · gemas — **una gema, una vista** (`game.ts:2521`). No hay reutilización.
 *   · skull keys — el (U)se GASTA la llave siempre, incluso si se cancela la dirección o no
 *     hay puerta enfrente (`game.ts:3172`, `dec` incondicional de CAST 0x18c4) ⇒ llevar UNA
 *     sola es un margen de CERO errores, y por eso donde hace falta van tres o cuatro.
 *
 * Lo ELEGIDO es el nivel: que el acto I vaya justo y el IV sobrado. Lo que NO se elige es
 * dejar a un momento por debajo de lo que su propia tarjeta promete — eso ya no es
 * ambientación, es el defecto que el usuario reportó.
 *
 * ⚠ LÍMITES DECLARADOS (deseables que el save NO modela, y por eso no se fingen):
 *   · el EQUIPO de cada personaje (arma, armadura, casco, escudo, anillo, amuleto) vive en
 *     su registro de 32 B del roster, que es material de EA y NO viaja (cabecera del
 *     fichero). `equipmentQuantities` (la tabla de 48 del pack, 0x21A) sí tiene celda, pero
 *     sus índices son el enum `Equipment` de la extracción del visitante: escribir ahí
 *     cifras nuestras sería autoría sobre una tabla ajena, así que se HEREDA entera.
 *   · los HECHIZOS (`spellQuantities`, 48 ranuras) — misma razón, se heredan.
 *   · no hay campo de «raciones de reactivo ya mezclado»: en U5 se mezcla en el momento.
 */
function mochilaDeActo(acto: Acto): Mochila {
  switch (acto) {
    // Acto I — modesto. Aún no se ha bajado a ninguna parte y todo está a mano.
    case 1:
      return { food: 120, gold: 300, keys: 4, gems: 1, torches: 6, skullKeys: 0 };
    // Acto II — ya se viaja. Una skull key porque a estas alturas ya aparecen cerrojos
    // mágicos, y magia de campaña en las tres tablas.
    case 2:
      return {
        food: 200, gold: 600, keys: 6, gems: 3, torches: 10, skullKeys: 1,
        scrollQuantities: ocho(1), potionQuantities: ocho(2), reagentQuantities: ocho(8),
      };
    // Acto III — dentro de sitios cerrados con llave (Palacio y castillo). TRES skull keys:
    // una para la puerta, y dos de margen porque el (U)se se come la llave aunque falles.
    case 3:
      return {
        food: 300, gold: 1000, keys: 8, gems: 5, torches: 12, skullKeys: 3,
        scrollQuantities: ocho(2), potionQuantities: ocho(3), reagentQuantities: ocho(12),
      };
    // Acto IV — bajo tierra y sin vuelta fácil. 20 antorchas ≈ 2 400 pasos de Underworld
    // (20 × 120) y 8 gemas = 8 vistas del mapa, que es lo que hace navegable un sitio sin
    // amanecer. «Un poco de todo», que es lo que la galería promete en su último acto.
    case 4:
      return {
        food: 400, gold: 1500, keys: 10, gems: 8, torches: 20, skullKeys: 4,
        scrollQuantities: ocho(3), potionQuantities: ocho(4), reagentQuantities: ocho(20),
      };
  }
}

/**
 * ★ EL ESTADO DE «A UN USE DE DESTRUIRLO», derivado entero — momentos 3, 4 y 5.
 *
 * 🔴 Y LA PREMISA QUE CORRIGE: el ritual NO ocurre en la ciudad. La ciudad es la fase de
 * MERODEO; la destrucción pasa en la SALA DE LA LLAMA de la virtud opuesta, y ésa es la única
 * posición donde `castShardIntoFlame` puede disparar. El catálogo decía «ronda la ciudad …
 * estás a un Use de destruirlo» — dos momentos distintos cosidos en una frase, describiendo
 * un estado que el juego no puede producir. (El spec arrastra el mismo cruce en su tabla.)
 *
 * Las cinco condiciones del ritual (`quest/ritual.ts:186-214`) y de dónde sale cada una:
 *   1. el shard en la bolsa           → `shards[clave] = true`
 *   2. posición EXACTA de la Llama    → `FLAME_LOCATION/X/Y/FLOOR`, importadas del port
 *   3. objeto Shadowlord en (x, y−1)  ┐ las dos las pone `shadowlordConvocado`
 *   4. `shadowlordSummoned === idx`   ┘ (ver su nota: y−1, no y−2)
 *   5. cero RNG                       → declarado en `ritual.ts:21-23`
 *
 * ★ LAS COORDENADAS NO SE ESCRIBEN AQUÍ: se IMPORTAN de `ritual.ts`, que las tiene de
 * DATA.OVL (DS 0x4882…, Grado A). Copiarlas sería un segundo sitio donde equivocarse, y el
 * primero ya demostró hoy que ese sitio se usa. Si el port corrige una, el momento la sigue.
 *
 * ⚠ CLASE C declarada, y ES LA ÚNICA de estos tres: la HORA. El momento pide noche y ninguna
 * hora es derivable —el ritual no mira el reloj (no está entre las cinco condiciones)—, así
 * que 23:00 es AUTORÍA DE ESCENARIO, no un hecho del juego. Se elige por la ambientación de
 * la escena, se declara aquí, y ningún aserto la trata como derivada.
 */
function llama(idx: 0 | 1 | 2): ParcheMomento {
  const clave = SHADOWLORDS[idx]!;
  return {
    position: {
      location: FLAME_LOCATION[idx]!,
      floor: FLAME_FLOOR[idx]!,
      x: FLAME_X[idx]!,
      y: FLAME_Y[idx]!,
    },
    // Clase C: la hora. Ver el ⚠ de arriba.
    time: { year: 139, month: 6, day: 12, hour: 23, minute: 0 },
    // Grupo de cinco: el momento pide un party de mitad de partida, y cinco es lo que cabe
    // sin llegar al tope de seis. También Clase C (escenario), y por eso NO se afirma nada
    // de sus cifras: van por ÍNDICE y sus stats salen de la copia del visitante.
    party: [0, 1, 2, 3, 4],
    transport: "foot",
    transportTile: 0x1c,
    // Sólo SU shard: los otros dos ya se gastaron o aún no están. `useShard` consume el
    // shard al destruir (`use-tools.ts:87`), así que «tener los tres» sería un estado de
    // alguien que no ha usado ninguno — otro momento distinto.
    shards: {
      falsehood: clave === "falsehood",
      hatred: clave === "hatred",
      cowardice: clave === "cowardice",
    },
    shadowlordConvocado: idx,
    /**
     * ★ LA LUZ, Y NO ES ADORNO: LA ESCENA ES DE NOCHE POR DECISIÓN NUESTRA. La hora 23:00 de
     * arriba mete a los tres momentos en la ventana nocturna de `lightLevel` (noche =
     * 20:00-04:59, `survival.ts:501-503`), así que la Clase C de la hora ARRASTRA una
     * consecuencia mecánica que hasta hoy nadie había pagado: sin antorcha, el jugador
     * aparece en un interior a oscuras. `0xF0` = 240 minutos es lo que escribe una (I)gnite
     * fuera de mazmorra (`TORCH_MINUTES`, `survival.ts:117`, usado en `igniteTorch:492`).
     *
     * ⚠ Y ES OTRA CONSTANTE QUE LA DEL ACTO IV (0x64), a propósito y no por descuido: son
     * DOS acciones distintas del port. 0xF0 = antorcha PROPIA encendida con (I)gnite; 0x64 =
     * antorcha COGIDA de un aplique de pared, que es una asignación aparte
     * (`game.ts:5197`, `mov byte [g_torch_mins],0x64` @SJOG 0x1a05, la rama del "Borrowed!").
     */
    torchTurns: 0xf0,
    mochila: mochilaDeActo(2),
  };
}

/**
 * ★ DÓNDE Y CUÁNDO EMPIEZA EL JUEGO. Los cinco números del reloj y los tres de la posición
 * son los del arranque de una partida de Ultima V y se leen del propio estado inicial del
 * visitante (`ExtractedInitialState`, `state.ts:379`): **día 5 del mes 4** del año 139, 8:35
 * de la mañana, en la casa de Iolo, casilla 15,15 de su mapa.
 *
 * ⚠ Esta línea decía «4 de Trammel» y CONTRADECÍA al código de veinte líneas más abajo, que
 * escribe `day: 5`. El dato bueno es el del código (medido: `initial-state.json` da
 * `day = 5, month = 4`); lo que estaba mal era la prosa, que además nombraba el mes como si
 * el 4 fuera el día. Los meses del calendario de Britannia no se nombran aquí porque el
 * parche no los usa: usa números.
 *
 * 🔴 Se ESCRIBEN aquí aunque el estado base ya los traiga — ver «el parche se escribe, no se
 * hereda» en la cabecera. Y NO se escribe el roster: quién es el Avatar, cuánto pega Iolo y
 * qué lleva encima sale de la copia del visitante.
 */
const MOMENTO_01: MomentoDef = {
  id: "momento-01",
  acto: 1,
  titulo: {
    es: "El regreso a Britannia",
    en: "The return to Britannia",
  },
  ambiente: {
    es: "Acabas de cruzar la puerta lunar y despiertas en la cabaña de Iolo. Shamino y él te esperan; fuera, Britannia lleva años bajo la Ley de Blackthorn.",
    en: "You have just come through the moongate and wake in Iolo's hut. He and Shamino are waiting; outside, Britannia has lived for years under Blackthorn's Law.",
  },
  lugar: { es: "Iolo's Hut", en: "Iolo's Hut" },
  miniatura: "minimapa",
  estado: {
    position: { location: IOLOS_HUT, floor: 0, x: 15, y: 15 },
    time: { year: 139, month: 4, day: 5, hour: 8, minute: 35 },
    // Avatar (0) + Shamino (1) + Iolo (2): los tres primeros registros del roster, que es el
    // orden con el que `partidas.ts:173` documenta la tabla de 16.
    party: [0, 1, 2],
    transport: "foot",
    transportTile: 0x1c, // a pie (`state.ts:618`)
    turnsSinceStart: 0,
    torchTurns: 0, // ninguna antorcha encendida
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    // Sin la insignia negra de Blackthorn y sin la caja de sándalo: los dos objetos que
    // marcan tramo avanzado de la trama y que la tarjeta del save enseña como chip.
    specialItems: { blackBadge: false, woodenBox: false },
    questFlags: {},
  },
  // ⚠ `karma` NO se afirma: se hereda. El spec pide «karma neutro» y el valor de arranque de
  // una partida lo pone el propio estado inicial del visitante; escribir aquí una cifra sería
  // copiar un dato de EA para decir «lo que ya había».
  //
  // ⚠ Y LA MOCHILA TAMPOCO, Y ES EL ÚNICO DE LOS DIEZ QUE NO LA ESCRIBE. La razón es la misma
  // y aquí es más fuerte: este momento ocurre EN EL ARRANQUE, así que «lo que lleva encima el
  // grupo» es literalmente el contenido de `INIT.GAM`. Escribirlo sería teclear cifras de EA
  // en un fichero tracked para reproducir lo que la herencia ya da (CLAUDE.md REGLA 4). Los
  // otros nueve sí la escriben porque en ellos la herencia NO es lo correcto: heredar deja al
  // acto IV con las 0 gemas y las 0 skull keys del primer día de partida.
};

/**
 * Los nueve restantes. Nacieron SIN estado —el spec pedía las diez tarjetas desde la fase 1,
 * y las que aún no sembraban nada decían «próximamente» en vez de ofrecer un botón muerto—
 * y con el acto IV (momentos 8, 9 y 10) los diez tienen ya su parche.
 *
 * ⚠ El array conserva el nombre por el que lo llaman el arnés y el test. Lo que YA NO hay es
 * ningún momento sin parche: la recíproca que exigía que componer uno de ésos LANZARA sigue
 * viva, pero sobre un testigo SINTÉTICO (ver `verifica-momentos.mjs` §4) — derivarla de
 * `MOMENTOS` la habría dejado sin sujeto y verde para siempre.
 */
const PROXIMAMENTE: MomentoDef[] = [
  {
    id: "momento-02",
    acto: 1,
    // 🔴 SE LLAMABA «La Resistencia reunida» Y SU AMBIENTACIÓN AFIRMABA QUE «la red de la
    // Resistencia ya tiene todas sus contraseñas». Eso NO existe en el port: el único
    // `password` modelado es el desafío del guardia de Blackthorn al portador de la insignia
    // (`world/guard-encounters.ts:74,110-154`; el juicio en `world/blackthorn.ts:615-658`),
    // que es otra cosa y de otro acto. Era sabor de walkthrough sin respaldo — venía del
    // spec, y el lead lo retiró al adjudicar. La cuarta frase de esta galería que afirmaba
    // algo que el juego no sostiene; de ahí la regla: la ambientación sólo afirma lo que el
    // estado o el port sostienen.
    titulo: { es: "La compañía al completo", en: "The full company" },
    ambiente: {
      es: "Seis viajando juntos: Iolo, Shamino y los que se han ido sumando por el camino. El grupo ya no crece más — a partir de aquí, lo que cambie será lo que lleven encima.",
      en: "Six travelling together: Iolo, Shamino and those who joined along the way. The company cannot grow further — from here on, what changes is what they carry.",
    },
    lugar: { es: "A las puertas de Britain", en: "At the gates of Britain" },
    miniatura: "minimapa",
    estado: {
      /**
       * ★ EL HECHO QUE DEFINE ESTE MOMENTO ES UN CARDINAL DEL PORT: SEIS. `MAX_PARTY = 6`
       * (`core/party.ts:9`) es el tope real del grupo, y lo hace cumplir el propio compositor
       * (`compone.ts` lanza si el parche pide más). «Al completo» no es una impresión: es ese
       * número. Y es lo que separa este momento del 1, que viaja con TRES.
       *
       * ⚠ CLASE C — LA POSICIÓN. Un grupo completo no ocurre en una casilla concreta: el
       * sexto se une donde a cada partida le toque. Se ancla a lo único derivable que hay
       * cerca —la entrada de Britain en el sobremundo, (81,106), leída de las tablas
       * `locationsX/locationsY` (DS 0x1eaa/0x1ed2, las que consulta `locationAt` en
       * `game.ts:881`)— y se planta el grupo en la casilla INMEDIATAMENTE al norte, (81,105),
       * comprobada pasable a pie con `isPassable` sobre `maps/overworld.json`.
       * Derivado: la coordenada de la puerta y que (81,105) se pueda pisar. Elegido: que sea
       * ésa y no cualquier otra del camino — a las puertas de la ciudad más grande, que es
       * donde una compañía terminaría de juntarse.
       * ⚠ Y NO se afirma que sea un cruce de caminos: no he comprobado que el tile sea
       * calzada, así que la tarjeta no lo dice.
       *
       * ⚠ CLASE C — EL ORO Y LA MOCHILA. «Razonable de mitad de acto I» no es derivable de
       * nada: el juego no tiene un listón.
       *
       * 🔴 ESTE BLOQUE DECÍA «la Clase C aquí se resuelve NO ESCRIBIENDO» y esa decisión está
       * REVISADA (reporte de jugabilidad del usuario, 08-08). El argumento de entonces —«el
       * momento no promete comprar nada, así que no hay afirmación que sostener»— seguía
       * siendo válido para el ORO y sólo para el oro: lo que no vio es que no escribir NO deja
       * el campo neutro, lo deja en el valor del PRIMER DÍA DE PARTIDA. Y un grupo de SEIS con
       * las raciones de un grupo de tres pasa hambre a los tres días y medio (63 raciones ÷ 18
       * al día; ver `mochilaDeActo`). La ausencia de afirmación no era ausencia de efecto.
       * Ahora lleva la mochila del acto I, que es modesta a propósito: Britain está a un paso
       * y lo que este momento promete sigue siendo QUIÉNES son seis, no cuánto llevan.
       *
       * ⚠ El EQUIPO de cada uno sigue SIN escribirse, y ésa no cambia: los inventarios de los
       * seis salen de la copia del visitante, que es material de EA y no viaja (cabecera de
       * este fichero, CLAUDE.md REGLA 4).
       */
      position: { location: 0, floor: 0, x: 81, y: 105 },
      // Clase C: el reloj. Media mañana de un día del acto I, después del arranque (día 5
      // del mes 4) y con margen para que los seis se hayan encontrado.
      time: { year: 139, month: 7, day: 19, hour: 10, minute: 15 },
      // LOS SEIS, por índice de roster: el Avatar y los cinco primeros compañeros.
      party: [0, 1, 2, 3, 4, 5],
      transport: "foot",
      transportTile: 0x1c,
      // Acto I: nada de la trama todavía. Se ESCRIBE (no se hereda) porque es lo que
      // distingue «aún no» de «no me he ocupado» — ver la cabecera del fichero.
      shards: { falsehood: false, hatred: false, cowardice: false },
      lbArtifacts: { amulet: false, crown: false, sceptre: false },
      specialItems: { blackBadge: false, woodenBox: false },
      mochila: mochilaDeActo(1),
    },
  },
  {
    id: "momento-03",
    acto: 2,
    titulo: { es: "Ante Faulinei", en: "Facing Faulinei" },
    // ⚠ LA VIRTUD SE NOMBRA A PROPÓSITO («Falsedad»/«Falsehood»). La primera redacción de
    // esta línea hablaba sólo de la Llama de la Verdad, y con eso la guarda del catálogo
    // —que empareja el nombre del título contra la virtud de la ambientación usando
    // `SHADOWLORD_INFO`— se quedó SIN NADA QUE COMPARAR: detectaba el nombre y ninguna
    // virtud, y se puso roja en las tres tarjetas. Una guarda que no puede leer su dato no
    // es una guarda laxa: es una guarda ciega. El dominio va en la frase.
    ambiente: {
      es: "El Shadowlord de la Falsedad está frente a ti, convocado sobre la Llama de la Verdad. Llevas su fragmento en la mano.",
      en: "The Shadowlord of Falsehood stands before thee, summoned over the Flame of Truth. Thou dost hold his shard in thy hand.",
    },
    lugar: { es: "Lycaeum", en: "The Lycaeum" },
    miniatura: "shardFalsedad",
    estado: llama(0),
  },
  {
    id: "momento-04",
    acto: 2,
    // 🔴 ERA «Ante Nosfentor», Y ESTUVO PUBLICADO. El emparejamiento correcto es
    // Hatred→ASTAROTH (`quest/shadowlords.ts:24`), y ese fichero AVISA en su cabecera de que
    // «la versión previa tenía Astaroth/Nosfentor INTERCAMBIADOS (Redux-ismo); corregido
    // contra el asm» (`shadowlords.ts:8-9`). Escribí estas dos líneas de memoria en vez de
    // derivarlas del port, y reprodují exactamente el error que el port ya había corregido.
    titulo: { es: "Ante Astaroth", en: "Facing Astaroth" },
    ambiente: {
      es: "El Shadowlord del Odio, convocado sobre la Llama del Amor en la abadía. Su fragmento pesa en tu mano y no queda más que usarlo.",
      en: "The Shadowlord of Hatred, summoned over the Flame of Love in the abbey. His shard is heavy in thy hand and nothing remains but to use it.",
    },
    lugar: { es: "Empath Abbey", en: "Empath Abbey" },
    miniatura: "shardOdio",
    estado: llama(1),
  },
  {
    id: "momento-05",
    acto: 2,
    // La otra mitad del swap: Cowardice→NOSFENTOR (`quest/shadowlords.ts:25`).
    titulo: { es: "Ante Nosfentor", en: "Facing Nosfentor" },
    ambiente: {
      es: "El Shadowlord de la Cobardía, el último de los tres, sobre la Llama del Coraje. Con este fragmento se cierra el trío y se abre el camino al Underworld.",
      en: "The Shadowlord of Cowardice, last of the three, over the Flame of Courage. This shard closes the set — and opens the way to the Underworld.",
    },
    lugar: { es: "Serpent's Hold", en: "Serpent's Hold" },
    miniatura: "shardCobardia",
    estado: llama(2),
  },
  {
    id: "momento-06",
    acto: 3,
    titulo: { es: "La cámara de Blackthorn", en: "Blackthorn's chamber" },
    // 🔴 DECÍA «las ocho preguntas de su Ley» y NO tiene respaldo: el port modela el
    // interrogatorio como CUATRO rondas sobre el mantra de UN santuario
    // (`world/blackthorn.ts:396 roundsAsked: 4`, escena en `blackthorn-capture.ts:209-240`).
    // Otra frase que escribí de memoria en vez de leer el código. Ahora dice lo que el
    // momento ES —el trono y el interrogatorio— sin poner un cardinal que el juego desmiente.
    ambiente: {
      es: "Al otro lado de la puerta está el trono del usurpador, y su interrogatorio sobre el mantra de un santuario.",
      en: "Beyond this door sit the usurper's throne and his interrogation about a shrine's mantra.",
    },
    lugar: { es: "Palace of Blackthorn", en: "Palace of Blackthorn" },
    miniatura: "minimapa",
    estado: {
      // ── DERIVADO ────────────────────────────────────────────────────────────────────
      // La sala del trono es la PLANTA 3 del Palacio (loc 18), y su ancla dura es el slot 1
      // del `.NPC`: la Corona, `type` 0xB5, en (15,13) planta 3 (`game/assets/npcs.json`,
      // leído con `objectPlacements`; el tile 0xB5→"crown" lo fija `quest/items.ts:52`).
      // La cámara es el bloque de tile 69 x=13..17, y=12..15, con dos adornos que BLOQUEAN
      // en (13,14) y (17,14) — medido con `isPassable` sobre `maps/smallmaps.json`.
      //
      // ⚠ CLASE C — LA CASILLA DEL GRUPO. El juego no marca «dónde se planta uno para el
      // interrogatorio»: eso no es un dato, es una escena. Se elige (15,14) porque es la
      // única casilla pasable INMEDIATAMENTE al sur de la Corona, o sea justo delante del
      // trono y mirándolo. Derivado es que sea PASABLE y que esté pegada al ancla; elegido
      // es que sea ésta y no (15,12) o (15,15), que también lo cumplirían.
      position: { location: 18, floor: 3, x: 15, y: 14 },
      // Clase C: la hora. El interrogatorio no mira el reloj.
      time: { year: 140, month: 2, day: 8, hour: 11, minute: 0 },
      // Clase C (escenario), como en los momentos de la Llama: cinco, por índice.
      party: [0, 1, 2, 3, 4],
      transport: "foot",
      transportTile: 0x1c,
      // La Corona SIGUE EN SU SITIO: este momento es ANTES de reclamarla — el trono está al
      // otro lado de la puerta, no en la mano. Es lo que separa el 6 del 7.
      lbArtifacts: { amulet: false, crown: false, sceptre: false },
      // ★ La insignia negra SÍ, y esto no es adorno: es lo que explica que el grupo esté
      // dentro del Palacio y no en un calabozo. El guardia de Blackthorn desafía por la
      // contraseña «bearer of the Badge» (`world/guard-encounters.ts:74`) y el juicio de
      // `world/blackthorn.ts:655` bifurca por `timeSpell !== TIME_SPELL_BADGE`. Sin la
      // insignia, este momento sería un estado que el jugador no puede haber alcanzado.
      specialItems: { blackBadge: true, woodenBox: false },
      /**
       * 🔴🔴 EL DEFECTO QUE REPORTÓ EL USUARIO: «en Blackthorn estamos en habitación sellada
       * sin skull key». CONFIRMADO, y la habitación estaba sellada de verdad.
       *
       * ── LA MEDICIÓN (flood-fill 4-vecinos con el `isPassable` del port sobre
       * `maps/smallmaps.json`, loc 18 planta 3, desde (15,14)) ─────────────────────────────
       * La componente conexa a pie es de **14 celdas**, todas `0x45 MetalFloor`, y su frontera
       * entera son **11 muros `0x4F StoneBrickWall`**, **2 braseros `0xB2 Brazier`** y
       * **UNA sola puerta: (15,16), tile `0x97`**. `0x97` es `DOOR_TILES.magicLock` —
       * el cerrojo MÁGICO (`world/doors.ts:31`).
       *
       * ── POR QUÉ ESO ES UNA CÁRCEL Y NO UNA PUERTA CERRADA ───────────────────────────────
       * Las dos vías que un jugador probaría NO abren un 0x97, y las dos están en el port:
       *   · (O)pen → «Locked!», sin abrir y sin gastar nada (`doors.ts:94-97`, SJOG 0x1374).
       *   · (J)immy → rama `magic` de `jimmyLock`: **SIEMPRE** «Key broke!», sin tirada de
       *     dado y sin éxito posible (`world/commands.ts:183-186`). Con 99 llaves normales
       *     el resultado es el mismo 99 veces.
       * La ÚNICA vía es `(U)se → Skull Key` (`game.ts:3170 useSkullKey`, CAST.OVL 0x18c4),
       * que desmagifica 0x97→0xB8 y deja la puerta abrible con (O)pen. Y el picker de (U)se
       * sólo OFRECE la Skull Key con `skullKeys > 0` (`usePicker.ts:168`) ⇒ con las **0 skull
       * keys** que heredaba de `INIT.GAM`, la entrada ni siquiera aparecía en el menú.
       * Resultado: grupo de cinco encerrado en 14 casillas sin ningún movimiento legal hacia
       * fuera. El estado era impecable en todo lo demás — ésa es la clase de defecto.
       *
       * ── POR QUÉ TRES Y NO UNA ───────────────────────────────────────────────────────────
       * Porque el (U)se **gasta la llave antes de mirar nada**: el `dec g_skull_keys` de
       * 0x18c4 va ANTES del getdir y del check de tile (`game.ts:3172`), así que cancelar la
       * dirección o apuntar a la pared equivocada consume una llave igual. Con UNA, el primer
       * despiste vuelve a sellar la habitación para siempre. Tres = dos errores de margen.
       * ⚠ El TRES es Clase C (viene de `mochilaDeActo(3)`); lo DERIVADO es que hagan falta
       * ≥1 y que el gasto sea incondicional.
       */
      mochila: mochilaDeActo(3),
    },
  },
  {
    id: "momento-07",
    acto: 3,
    titulo: { es: "La Corona y la Caja de Sándalo", en: "The Crown and the Sandalwood Box" },
    // 🔴 DECÍA «has llegado al escondite» y NO EXISTE tal sitio: grep de `escondite|hideout`
    // en `game/src` y `demo-byo/src` da CERO. Los tres objetos están cada uno en su
    // localización, y ninguna es un escondite — la Corona en la sala del trono del Palacio de
    // Blackthorn (loc 18) y la Caja de Sándalo tras el pasadizo del clavicémbalo en el
    // castillo de Lord British (loc 17), los dos hidratados por `game.ts:4875-4925` desde los
    // slots-objeto del .NPC (`quest/items.ts:29-35,52-65`). Tercera frase de memoria.
    // ⚠ LA PROSA SIGUE AL ESTADO, no al revés. Decía «La Corona espera en la sala del trono»
    // y este momento la trae YA reclamada (ver el porqué en el estado): la frase habría
    // contradicho a los bytes que la propia tarjeta siembra. Ahora cuenta la secuencia.
    ambiente: {
      es: "La Corona del usurpador ya es tuya. Queda la Caja de Sándalo, al otro lado del pasadizo del clavicémbalo, y con ella el camino a Doom.",
      en: "The usurper's Crown is already yours. The Sandalwood Box remains, beyond the harpsichord passage — and with it the road to Doom.",
    },
    lugar: { es: "Lord British's Castle", en: "Lord British's Castle" },
    miniatura: "corona",
    estado: {
      /**
       * ⚠⚠ LA CLASE C MÁS DISCUTIBLE DE LOS DIEZ, Y POR ESO SE ARGUMENTA ENTERA AQUÍ.
       *
       * La tarjeta nombra DOS objetos en DOS localizaciones —la Corona en la sala del trono
       * del Palacio de Blackthorn (loc 18) y la Caja de Sándalo tras el pasadizo del
       * clavicémbalo en el castillo de Lord British (loc 17)— y un save tiene UNA posición.
       * Hay que elegir, la elección se ve, y un jugador puede no estar de acuerdo.
       *
       * SE ELIGE LA CAJA (loc 17), y el momento se coloca CON LA CORONA YA RECLAMADA. Las
       * dos razones:
       *   1. El momento 6 ya ocurre en la sala del trono de Blackthorn, en la casilla de
       *      DELANTE de esa misma Corona. Poner aquí la Corona otra vez gastaría dos de las
       *      diez tarjetas en la misma habitación, y la galería dejaría de cubrir sitios.
       *   2. Ordenarlos (Corona hecha → Caja pendiente) convierte al 6 y al 7 en dos pasos
       *      de una secuencia en vez de en dos fotos alternativas del mismo instante. Y deja
       *      el estado apuntando a lo que viene: la Caja es lo que el momento 9 pide llevar
       *      («Dentro de Doom, con la Caja de Sándalo»).
       * LO QUE NO ES CLASE C: que la Caja esté en loc 17 planta 2 en (18,12) — eso es el
       * slot 31 del `.NPC`, `type` 14 = ItemSandalwoodBox (`quest/items.ts:59`, y la cabecera
       * de su string cita «LB castle loc 17 slot 31, tras el pasadizo secreto»).
       *
       * 🔴🔴 Y LA CASILLA DEL GRUPO SE MUEVE DE (17,12) A (17,14) — SEGUNDA CÁRCEL, PEOR QUE
       * LA DEL 6, encontrada con la misma medición que confirmó aquélla.
       *
       * Lo que este bloque decía —«un cuartito de dos casillas cerrado por muro 79 al norte,
       * al sur y a ambos lados… aquí la geometría eligió por nosotros»— era EXACTO y estaba
       * DESCRIBIENDO UNA CELDA DE CASTIGO sin darse cuenta. El flood-fill lo pone en cifras:
       * desde (17,12) la componente conexa a pie es de **DOS celdas** —(17,12) y (18,12)— y
       * su frontera son **SEIS `0x4F StoneBrickWall` y nada más**. Ni una puerta, ni una
       * escalera, ni un tile con cerrojo: **no hay objeto que abrir**. En el 6 al menos había
       * una cerradura y le faltaba la llave; aquí no hay ni cerradura. Ninguna cantidad de
       * skull keys, llaves o magia saca de ahí a nadie.
       *
       * ★ Y LA SALIDA DE VERDAD NO CABE EN UN SAVE. El pasadizo se abre tocando los 13
       * dígitos de la melodía en el clavicémbalo, y el port lo modela como un flag de SESIÓN
       * —`harpsichordPassageOpen`, consultado en `game.ts:896-903`— que NO viaja en el
       * `SAVED.GAM`: al cargar la partida el muro vuelve a estar puesto. Así que el estado
       * «dentro del cuartito» **no es reproducible por carga**, sólo por haber tocado la
       * melodía en esa sesión. Un save que empiece ahí es un save roto por construcción.
       *
       * ⇒ El grupo se planta al OTRO LADO del pasadizo, en (17,14) — que es exactamente lo
       * que su propia ambientación ya decía («Queda la Caja de Sándalo, AL OTRO LADO del
       * pasadizo del clavicémbalo»). La prosa llevaba razón y el estado la contradecía; se
       * corrige el estado, no la frase.
       *
       * Lo DERIVADO de (17,14), todo medido sobre `maps/smallmaps.json` loc 17 planta 2:
       *   · es la celda inmediatamente al SUR de `HARPSICHORD_PASSAGE` (17,13), la que el
       *     `xor [0x67b9],0xb` de TOWN 0x0E9E convierte de muro 0x4F en suelo 0x44 — y esa
       *     celda se IMPORTA de `world/harpsichord.ts`, no se copia aquí;
       *   · su componente conexa son **31 celdas**, y dentro están las dos cosas que hacen
       *     jugable el momento: el **clavicémbalo `0x8D` en (17,18)** con su **silla `0x92`
       *     en (17,17)** (o sea, el jugador puede tocar la melodía) y una **`0xC8 LadderUp`
       *     en (15,15)** (o sea, puede irse aunque no la resuelva);
       *   · y hay una segunda salida con cerrojo mágico `0x97` en (15,19) — otra razón para
       *     que este momento lleve skull keys.
       * ⚠ Lo ELEGIDO es (17,14) entre las 31: es la que mira al pasadizo. Lo DERIVADO es que
       * la bolsa contenga el instrumento y una escalera, que es lo que la hace escapable.
       */
      position: { location: 17, floor: 2, x: HARPSICHORD_PASSAGE.x, y: HARPSICHORD_PASSAGE.y + 1 },
      // Clase C: la hora.
      time: { year: 140, month: 2, day: 21, hour: 14, minute: 30 },
      party: [0, 1, 2, 3, 4],
      transport: "foot",
      transportTile: 0x1c,
      // La Corona YA es tuya (ver razón 2). El (G)et de la corona fija `g_crown`
      // (`quest/items.ts` rama 0x16e6 → `state.lbArtifacts.crown`), y ese mismo flag es el
      // que impide que `hydrateInteriorObjects` la vuelva a sembrar en Blackthorn.
      lbArtifacts: { amulet: false, crown: true, sceptre: false },
      // Y la Caja NO: es lo que este momento deja al otro lado del pasadizo.
      // ⚠ Antes esta línea decía «a un (G)et de distancia» y con la casilla nueva ya no es
      // cierto: ahora median la melodía y tres pasos. La frase sigue al estado.
      specialItems: { blackBadge: true, woodenBox: false },
      // Acto III: y aquí las skull keys tienen DOS destinatarios — la puerta mágica 0x97 de
      // (15,19), que es la otra salida de esta bolsa de 31 celdas, y el margen del (U)se que
      // gasta llave aunque falles (ver la nota del momento 6).
      mochila: mochilaDeActo(3),
    },
  },
  {
    id: "momento-08",
    acto: 4,
    titulo: { es: "La boca del Underworld", en: "The mouth of the Underworld" },
    // ⚠ DECÍA «El grupo lleva antorchas» y el parche no escribe NINGUNA cuenta de antorchas:
    // `torches` (la reserva de la mochila, `state.ts:152`) se HEREDA de la copia del visitante
    // igual que el oro del momento 2. Lo que el estado sí afirma es UNA antorcha ENCENDIDA
    // (`torchTurns`), que es otra cosa. La prosa sigue al estado.
    ambiente: {
      es: "Has salido por el fondo de Shame y el mapa cambia entero: bajo tierra no amanece nunca. Una antorcha encendida es toda la luz que hay.",
      en: "Thou hast come out at the bottom of Shame, and the whole map changes: below ground the sun never rises. One lit torch is all the light there is.",
    },
    lugar: { es: "Underworld, bajo Shame", en: "Underworld, beneath Shame" },
    miniatura: "minimapa",
    estado: {
      /**
       * ★ «LA BOCA» ES UNA CELDA QUE CALCULA EL PROPIO PORT, no una elección de escenario.
       * Bajar por la escalera de la planta más honda de una mazmorra emerge al Underworld:
       * `game.ts:6805` (`nf >= 8` → `exitDungeonTo(events, true)`) y el depósito en
       * `dungeon/dungeon-cmds.ts:441-466`, que pone `location 0`, `floor 0xFF` y **la misma
       * coordenada de superficie de esa mazmorra** (tablas `locationsX/Y`, DUNGEON
       * 0x1d10-0x1d1b, EN CRUDO). O sea: la boca de una mazmorra en el Underworld ES su
       * coordenada del sobremundo con la planta cambiada.
       *
       * ★ Y EL CONJUNTO DE BOCAS ESTÁ MEDIDO, no supuesto: de las OCHO mazmorras, sólo
       * CUATRO tienen escalera de bajada en la planta 7 —Despise(34), Wrong(36),
       * Covetous(37) y Shame(38), las cuatro en la celda (7,7) del laberinto; censo sobre
       * `maps/dungeons.json` contando `CellType.LadderDown`(0x2) y `LadderUpDown`(0x3),
       * `dungeon/dungeon.ts:113-116`—. Deceit, Destard, Hythloth y Doom no bajan más.
       *
       * ⚠ CLASE C — CUÁL DE LAS CUATRO. Lo que se elige es el CRITERIO, y con el criterio
       * puesto la ganadora la da la medición: la boca que abre a la mayor bolsa transitable
       * a pie del Underworld, porque lo que la tarjeta promete es «otro mapa entero».
       * Componentes conexas medidas con `isPassable` sobre `maps/underworld.json` (4 vecinos,
       * a pie): Shame 2358 celdas · Wrong y Covetous 1596 (comparten bolsa) · Despise 296.
       * Gana Shame (38) → (58,102), tile 0x17 MineEntrance, pasable.
       */
      position: { location: 0, floor: UNDERWORLD_PLOT_FLOOR, x: 58, y: 102 },
      /**
       * ⚠ CLASE C — EL RELOJ, y aquí es MÁS inerte que en los otros momentos: bajo tierra la
       * luz NO depende de la hora. `lightLevel` (`world/survival.ts:534-546`) devuelve 2 —el
       * mínimo— en cuanto `floor & 0xff > 0x7f`, sin mirar el reloj. Se pone una hora que
       * encaja en la secuencia (después del 140/2/21 del momento 7) y no afirma nada más.
       */
      time: { year: 140, month: 3, day: 2, hour: 9, minute: 0 },
      /**
       * ⚠ CLASE C — SEIS, y la razón es la SECUENCIA, no un cardinal derivado: el momento 2
       * ya declara el grupo al completo (MAX_PARTY = 6, `core/party.ts:9`) y un acto IV con
       * cinco pediría una explicación —una baja, una marcha— que el estado no lleva dentro.
       * Los momentos 6 y 7 eligieron cinco para SU escena; cada momento decide la suya, y en
       * ninguno de los dos casos el número está derivado de nada.
       */
      party: [0, 1, 2, 3, 4, 5],
      transport: "foot",
      transportTile: 0x1c,
      /**
       * ★ LA ANTORCHA NO ES ADORNO Y SU VALOR NO ES INVENTADO. Bajo tierra `lightLevel` da 2;
       * con `torchTurns > 0` sube a 0x0a (`survival.ts:544`). Y 0x64 = 100 minutos es lo que
       * el port escribe en `g_torch_mins` — pero ⚠ POR LA RUTA QUE ESTA NOTA NOMBRABA MAL:
       * decía «al encender una», y `game.ts:5197` NO es el (I)gnite. Es la rama del (G)et
       * sobre un APLIQUE DE PARED (tiles 0xB0/0xB1, SJOG 0x18CE → 0x1a05
       * `mov byte [g_torch_mins],0x64`, la del eco "Borrowed!"). El (I)gnite de una antorcha
       * propia escribe 0xF0 = 240 min fuera de mazmorra (`igniteTorch`, `survival.ts:492`).
       * Las dos cifras son del port y son de ACCIONES DISTINTAS; el 0x64 se queda —«acabo de
       * descolgar la antorcha del muro al salir» encaja con la escena— pero ahora nombra su
       * ruta de verdad. (Los momentos de la Llama usan 0xF0 justamente por ser la otra.)
       */
      torchTurns: 0x64,
      // Acto IV: los tres shards se GASTARON en sus rituales (`useShard` los consume,
      // `endgame/use-tools.ts:87`), así que ninguno queda en la bolsa.
      shards: { falsehood: false, hatred: false, cowardice: false },
      // La Corona (momento 7) y el Cetro ya son tuyos; el Amuleto no —vive aquí abajo, en
      // (105,225) del Underworld (`quest/underworld-seed.ts:44`, inmediatos de OUTSUBS
      // 0x0589-0x0598)—. ⚠ Y NO se afirma que se pueda llegar hasta él andando desde aquí:
      // no se puede (medido; ver la nota de alcance del momento 9), y por eso la tarjeta
      // no lo menciona.
      lbArtifacts: { amulet: false, crown: true, sceptre: true },
      specialItems: { blackBadge: true, woodenBox: true },
      /**
       * ★ LOS CUATRO FLAGS SE ESCRIBEN Y CADA UNO TIENE SU RAZÓN MECÁNICA:
       *  · los tres Shadowlords muertos — es el acto IV, y el flag es LA fuente de verdad que
       *    leen `canReachDoom`/`endgameReady` (`quest/shadowlords.ts:113-116`,
       *    `quest/lordbritish.ts:184-187`). La clave la construye `shadowlordDeadFlag`, no
       *    una cadena escrita aquí.
       *  · el sello de Shame ABIERTO — porque para haber salido por su fondo hubo que
       *    ENTRAR, y una entrada sellada se presenta como derrumbe impasable 0xDF
       *    (`game.ts:871-889`). Con el flag a false la party estaría de pie sobre un
       *    derrumbe: un estado que el juego no puede producir.
       */
      questFlags: {
        ...Object.fromEntries(SHADOWLORDS.map((k) => [shadowlordDeadFlag(k), true])),
        [wordSpokenFlag(38)]: true, // Shame — INFAMA (`quest/words.ts:5-8`)
      },
      /**
       * ★ LA MOCHILA DEL ACTO IV — lo que hace NAVEGABLE un sitio sin amanecer, y lo que a
       * estos tres momentos les faltaba entero. Las dos cifras que mandan aquí:
       *   · 20 ANTORCHAS ≈ 2 400 pasos de Underworld (240 min por (I)gnite ÷ 2 min por paso
       *     = 120 pasos cada una). Con las 4 heredadas de `INIT.GAM` eran 480.
       *   · 8 GEMAS = 8 vistas aéreas, a una gema por (V)iew. Heredando eran **CERO**, y sin
       *     gema el Underworld se recorre a ciegas con un radio de luz de 10.
       * La antorcha ENCENDIDA de arriba (`torchTurns`) es la primera; éstas son la reserva.
       */
      mochila: mochilaDeActo(4),
    },
  },
  {
    id: "momento-09",
    acto: 4,
    // 🔴 SE LLAMABA «La Mazmorra del Doom» y su ambientación decía «Dentro de Doom» — un
    // estado que este port NO PUEDE GUARDAR: la mazmorra vive en `game.dungeonState`, que es
    // estado de PROCESO y no viaja en el save (`main.ts:4817` lo pone a null; `game.ts:4079-
    // 4099` explica que `state.position` se queda en el tile de superficie). La 4ª enmienda
    // del spec (25ef771e) reformuló la fila; esto es su def.
    // ⚠ Y la razón NO es el formato de 1988: la ventana del .GAM SÍ codifica mazmorra
    // (g_location 0x21..0x28). Es una limitación DEL PORT, y la tarjeta se sostiene por la
    // secuencia: Corona → Caja → camino al Doom, y el descenso lo da el jugador.
    titulo: { es: "Las puertas del Doom", en: "The gates of Doom" },
    ambiente: {
      es: "La boca del Doom se abre un paso al este y la roca negra cierra todo lo demás. Llevas la Caja de Sándalo; falta el Amuleto. Se puede bajar — todavía no cerrar.",
      en: "The mouth of Doom opens one step east, and black rock closes everything else. Thou bearest the Sandalwood Box; the Amulet is still wanting. Thou mayst descend — not yet finish.",
    },
    lugar: { es: "Ante la Mazmorra del Doom", en: "Before the Dungeon of Doom" },
    miniatura: "caja",
    estado: {
      /**
       * ★★ #118 RESUELTA POR MEDICIÓN — LA ENTRADA DE DOOM SÍ ESTÁ DISCRIMINADA.
       *
       * La ficha decía que la coordenada no se podía separar entre sobremundo y Underworld
       * «porque el tile es 22 en LOS DOS mapas». Eso es cierto de OTRA fila: el censo miró el
       * idx 34 de `locationsX/Y`, que es **Destard** (loc 35, (72,168)). Doom es la loc 40 →
       * idx 39 (`locationAt` devuelve `i + 1`, `world/movement.ts:396`), y ahí los dos mapas
       * NO coinciden:
       *   · `maps/overworld.json`[128][128]  = 0x01 Water1  — impasable a pie
       *   · `maps/underworld.json`[128][128] = 0x16 CaveEntrance — pasable
       * El port ya lo dice con su cita de DATA.OVL: «la 8ª entrada (idx7 = Doom/VERAMOCOR)
       * vive EN el Underworld en (128,128) [DATA.OVL 0x1eba/0x1ee2]» (`game.ts:4383-4384`), y
       * lo repite el gate del sello (`game.ts:877`). Medición y cita coinciden.
       * ★ La cifra (128,128) es una COPIA COMPROBADA, no una segunda fuente: el test la
       * empareja contra `locationsX[39]`/`locationsY[39]` de `data.json`, así que no puede
       * derivar. (Aquí no se puede importar: `data.json` es la extracción del visitante.)
       *
       * ★★ Y LA GEOMETRÍA VUELVE A ELEGIR, esta vez casi del todo. De las OCHO vecinas de la
       * boca, sólo DOS son pasables a pie: (127,128) 0x1e y (129,128) 0x1f; las otras seis
       * son 0xFF BlackSquare. La bolsa entera —(127,128), la boca, (129,128)— es una
       * componente conexa de TRES celdas, cerrada por roca por los cuatro costados.
       * ⚠ CLASE C, y es un cara o cruz: entre las dos que la roca deja se toma la del OESTE.
       * No hay nada que lo derive; se declara para que nadie lo lea como derivado.
       *
       * ⚠ NOTA DE ALCANCE, medida y SIN adjudicar (va al lead como ficha): esa bolsa de tres
       * celdas está AISLADA — ninguna de las cuatro bocas de mazmorra ni la celda del Amuleto
       * llegan hasta ella a pie, ni en alfombra (componente 3) ni en barco (componente 1).
       * Comprobado también el contrafactual de la divergencia del 255 (#42, `world/
       * movement.ts:84-97`): con BlackSquare pisable la bolsa crece a 259 celdas y SIGUE sin
       * tocar ninguna boca ⇒ esa divergencia NO es el mecanismo. Cómo llega la party a Doom
       * en el original está sin medir. Lo que este momento afirma es sólo lo que se ve desde
       * dentro de la bolsa: que la boca está a un paso y que lo demás es roca.
       */
      position: { location: 0, floor: UNDERWORLD_PLOT_FLOOR, x: 127, y: 128 },
      time: { year: 140, month: 3, day: 9, hour: 16, minute: 0 }, // Clase C, inerte bajo tierra
      party: [0, 1, 2, 3, 4, 5],
      transport: "foot",
      transportTile: 0x1c,
      torchTurns: 0x64,
      shards: { falsehood: false, hatred: false, cowardice: false },
      // ★ SIN EL AMULETO A PROPÓSITO: es lo que separa este momento del 10. Con él,
      // `endgameReady` (`quest/lordbritish.ts:184-187`) pasaría a true y las dos tarjetas
      // dirían lo mismo con distinta casilla.
      lbArtifacts: { amulet: false, crown: true, sceptre: true },
      specialItems: { blackBadge: true, woodenBox: true },
      questFlags: {
        /**
         * ★ LOS TRES MUERTOS NO SON SABOR: SON LA CONDICIÓN DE QUE LA TARJETA NO MIENTA.
         * `doomEntranceAmbush` (`game.ts:6347-6352`, MAINOUT 0x7d8-0x812) intercepta el (E)nter
         * de Doom —y sólo el de Doom— si queda ALGÚN Shadowlord vivo: imprime «Attacked at
         * entrance!» y monta combate SIN cargar la mazmorra. Con uno vivo, «el descenso lo hace
         * el jugador» sería falso: lo que haría el jugador es pelear.
         */
        ...Object.fromEntries(SHADOWLORDS.map((k) => [shadowlordDeadFlag(k), true])),
        /**
         * ★ EL SELLO, ABIERTO — y la razón es la bolsa de tres celdas, no el gusto. Con el
         * sello puesto, el compose repinta la boca como derrumbe 0xDF impasable
         * (`game.ts:871-889`), y entonces las únicas dos celdas que quedan son (127,128) y
         * (129,128), incomunicadas entre sí: la party quedaría encerrada en una casilla, sin
         * ningún movimiento legal. Abrirlo es lo que hace cierta la promesa de la tarjeta.
         * ⚠ Lo ELEGIDO es abrirlo; lo DERIVADO es que el sello gobierna la pasabilidad.
         */
        [wordSpokenFlag(LAST_DUNGEON_LOCATION)]: true, // Doom — VERAMOCOR
      },
      // Misma mochila de acto IV que el 8 y el 10 (ver la nota allí): la bolsa de tres
      // celdas no se recorre, pero lo que hay detrás de la boca sí.
      mochila: mochilaDeActo(4),
    },
  },
  {
    id: "momento-10",
    acto: 4,
    titulo: { es: "El rescate de Lord British", en: "The rescue of Lord British" },
    // 🔴 EL ENCARGO PEDÍA «la celda de LB en el Underworld» Y ESA CELDA NO EXISTE. El rescate
    // no ocurre en el Underworld: la celda de LB es la sala cm127 de la MAZMORRA Doom
    // (planta 8, celda (5,7), alcanzada cayendo por el foso de la planta 7 —#179: el
    // desenlace lo dispara la ABSORCIÓN en esa sala, `fireAbsorptionEndgame`, no la planta). Es el MISMO bloqueo de #118 que reformuló el momento 9, aplicado al 10: la celda
    // de Lord British es estado de proceso y no cabe en un save. Así que este momento es el
    // paso ANTERIOR — y por eso se coloca ENCIMA de la boca y no al lado, que es lo único que
    // lo separa físicamente del 9.
    ambiente: {
      es: "Estás sobre la boca del Doom con el Amuleto, la Corona, el Cetro y la Caja. Todo lo que el rescate pide está en tus manos; lo que queda es bajar hasta el fondo.",
      en: "Thou standest upon the mouth of Doom with Amulet, Crown, Sceptre and Box. All the rescue asks is in thy hands; what remains is the descent to the deep.",
    },
    lugar: { es: "La boca del Doom", en: "The mouth of Doom" },
    miniatura: "corona",
    estado: {
      /**
       * ★ LA CELDA ES LA BOCA MISMA, y no es una licencia: es la casilla que la ENTRADA exige
       * pisar —MAINOUT 0x07a8/0x07ae, citado en `dungeon-cmds.ts:456-462`— y la misma en la
       * que el port DEPOSITA a quien sale de Doom al Underworld. Estar encima es literalmente
       * «a un (E)nter». Misma coordenada que el 9 (comprobada contra `locationsX/Y[39]`), otra
       * celda: el 9 mira la boca, el 10 está en ella.
       */
      position: { location: 0, floor: UNDERWORLD_PLOT_FLOOR, x: 128, y: 128 },
      time: { year: 140, month: 3, day: 9, hour: 17, minute: 0 }, // Clase C, inerte bajo tierra
      party: [0, 1, 2, 3, 4, 5],
      transport: "foot",
      transportTile: 0x1c,
      torchTurns: 0x64,
      shards: { falsehood: false, hatred: false, cowardice: false },
      // ★ LAS TRES REGALÍAS. Con los tres Shadowlords muertos, esto es exactamente
      // `endgameReady === true` (`quest/lordbritish.ts:184-187`): no es una lista bonita, es
      // el predicado del port. El test lo comprueba LLAMÁNDOLO, no enumerándolo.
      lbArtifacts: { amulet: true, crown: true, sceptre: true },
      // ★ Y LA CAJA, que es la que BIFURCA el final: con ella la rama de victoria (LB saca el
      // Orb y abre el camino a casa); sin ella, el final «varado» sin pergamino
      // (`rescueLordBritish`, `quest/lordbritish.ts:226-238`, ENDGAME_main 0x08c2). La tarjeta
      // promete cerrar la historia, así que el estado lleva la rama que la cierra.
      specialItems: { blackBadge: true, woodenBox: true },
      questFlags: {
        ...Object.fromEntries(SHADOWLORDS.map((k) => [shadowlordDeadFlag(k), true])),
        [wordSpokenFlag(LAST_DUNGEON_LOCATION)]: true, // Doom — VERAMOCOR
      },
      // Misma mochila de acto IV: este momento promete que sólo queda bajar, y bajar ocho
      // plantas de Doom se paga en antorchas y gemas como cualquier otro descenso.
      mochila: mochilaDeActo(4),
    },
  },
];

/** Los diez, en el orden en que el modal los enseña (acto y luego trama). */
export const MOMENTOS: readonly MomentoDef[] = [MOMENTO_01, ...PROXIMAMENTE];

/** El def de un id, o `undefined`. */
export function momentoPorId(id: string): MomentoDef | undefined {
  return MOMENTOS.find((m) => m.id === id);
}

/** Los que HOY siembran una partida (los que tienen parche de estado). */
export function momentosDisponibles(): readonly MomentoDef[] {
  return MOMENTOS.filter((m) => m.estado !== undefined);
}
