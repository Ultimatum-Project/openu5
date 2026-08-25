/**
 * ARNÉS de los MOMENTOS LEGENDARIOS.
 *
 * Uso:  node --import tsx demo-byo/verificacion/verifica-momentos.mjs <dir-con-los-.gam>
 *       [--mutante <nombre>]
 *
 * Produce observaciones en JSON por stdout. Quien asevera es `re/tools/test_byo_momentos.py`.
 *
 * ── LO QUE SE MIDE ES EL SAVE HORNEADO, NO EL DEF ───────────────────────────────────────
 * 🔴 Exigencia del spec (§Verificación) y no una formalidad. `<dir>` lo llena
 * `demo-byo/momentos/hornea.mjs --gam`, y aquí se leen esos ficheros DE DISCO y se
 * deserializan con `importNativeSave`. Aseverar sobre el def diría que el def dice lo que
 * dice; lo que hay que saber es que los 4192 bytes que acaban en el navegador de alguien
 * llevan dentro el sitio, la planta, el grupo y la hora que la tarjeta promete. Entre una
 * cosa y la otra están `exportNativeSave` (~90 escrituras a byte) y `importNativeSave`, y
 * cualquiera de las dos podría perder un campo sin que el def se enterase.
 *
 * ── EL ARNÉS NO ASEVERA ─────────────────────────────────────────────────────────────────
 * Para que no pueda aprobarse a sí mismo (mismo contrato que `verifica-tarjeta.mjs`). Si
 * revienta, no hay JSON y el pytest se pone rojo por ausencia de datos.
 *
 * ── LOS MUTANTES ────────────────────────────────────────────────────────────────────────
 * `--mutante <nombre>` estropea el DEF antes de hornear y vuelca las mismas observaciones.
 * El pytest corre EL MISMO conjunto de asertos sobre las dos salidas y exige verde en la
 * real y ROJO en cada mutante. Sin eso, «el test pasa» sólo diría que hoy pasa: no que
 * pueda fallar. Los mutantes viven aquí, junto al arnés, porque tocan el def en memoria y
 * no el árbol — nada que revertir, nada que se quede puesto.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { MOMENTOS, momentoPorId } from "../../game/src/momentos/defs.js";
import {
  importNativeSave,
  CHAR_RECORDS_OFFSET,
  CHAR_RECORD_SIZE,
  CHAR_RECORD_COUNT,
} from "../../game/src/core/saveNative.js";
import { readSaveIndex, SAVE_SLOT_PREFIX } from "../../game/src/core/save-keys.js";
import { siembraMomento } from "../src/momentos-instala.js";
import { isPassable } from "../../game/src/core/world/movement.js";
import { tileInfo } from "../../game/src/core/tiles.js";
import { DOOR_TILES } from "../../game/src/core/world/doors.js";
import { HARPSICHORD_PASSAGE, HARPSICHORD_TILE } from "../../game/src/core/world/harpsichord.js";

const dir = process.argv[2];
if (!dir) {
  console.error("uso: verifica-momentos.mjs <dir-con-los-.gam> [--mutante <nombre>]");
  process.exit(2);
}
const iMut = process.argv.indexOf("--mutante");
const mutante = iMut >= 0 ? process.argv[iMut + 1] : null;

const RAIZ = new URL("../..", import.meta.url).pathname;

/** `Storage` mínimo en memoria — lo mismo que hace `verifica-tarjeta.mjs`. */
function montaAlmacen() {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
  return m;
}
/**
 * 🔴 El Map SE GUARDA, y no es comodidad: la primera versión contaba las ranuras con
 * `Object.keys(globalThis.localStorage)`, que sobre este doble devuelve los NOMBRES DE LOS
 * MÉTODOS (`getItem`, `setItem`…) y por tanto CERO ranuras — una cifra falsa por el otro
 * lado, la que habría dicho «no se escribió nada» con la partida escrita. Se cuenta sobre el
 * almacenamiento de verdad.
 */
const ALMACEN = montaAlmacen();

// ── LOS MUTANTES ────────────────────────────────────────────────────────────────────────
//
// Cada uno rompe UNA afirmación, y son de clases distintas: campos escalares del parche (la
// planta, el reloj), la composición del grupo, un flag de trama, y —los de la Llama— cada una
// de las precondiciones que el ritual exige. Con sólo el primero, un aserto que mirase la
// planta y nada más pasaría por bueno un def sin party.
//
// Cada mutante declara A QUÉ MOMENTO apunta: los asertos del momento 1 y los de la Llama son
// conjuntos distintos, y un mutante sólo tiene que enrojecer el suyo. La sección que no es su
// objetivo sigue leyendo los bytes BUENOS de disco.
//
// Hay dos GÉNEROS, y la diferencia importa:
//   · `def`    — estropea el def ANTES de componer. Es lo que haría un dato mal escrito.
//   · `estado` — estropea el estado YA COMPUESTO, antes de hornear. Es lo que haría un bug de
//     `compone.ts`, que ningún mutante de def puede imitar: la casilla del Shadowlord no está
//     en el def (el def sólo dice `shadowlordConvocado: idx`), la calcula `colocaShadowlord`.
const MUTANTES = {
  // ── el momento 1 ──────────────────────────────────────────────────────────────────────
  /** El del encargo: planta equivocada. La casa de Iolo es un mapa pequeño de planta 0. */
  planta: { id: "momento-01", def: (d) => void (d.estado.position = { ...d.estado.position, floor: 3 }) },
  /** Grupo de dos: el Avatar y Shamino, sin Iolo. */
  grupo: { id: "momento-01", def: (d) => void (d.estado.party = [0, 1]) },
  /** Arranca con el Shard de la Falsedad en la bolsa: el acto II en el acto I. */
  shard: { id: "momento-01", def: (d) => void (d.estado.shards = { ...d.estado.shards, falsehood: true }) },
  /** El reloj a medianoche en vez de a las 8:35 de la mañana. */
  hora: { id: "momento-01", def: (d) => void (d.estado.time = { ...d.estado.time, hour: 0, minute: 0 }) },

  // ── los tres de la LLAMA (sobre el 03; los tres comparten `llama()`) ──────────────────
  /**
   * 🔴 EL QUE BORRA LA LLAMADA, no el dato: sin `shadowlordConvocado` el parche no invoca
   * `colocaShadowlord`, así que no hay ni objeto ni `shadowlordSummoned`. Un arnés que sólo
   * mutara valores dejaría vivo el caso «se me olvidó convocar» — y ése deja el momento con
   * todo lo demás correcto y el ritual mudo.
   */
  sinConvocar: { id: "momento-03", def: (d) => void delete d.estado.shadowlordConvocado },
  /** El shard de OTRO en la bolsa: llevas el del Odio a la Llama de la Verdad. */
  shardAjeno: {
    id: "momento-03",
    def: (d) => void (d.estado.shards = { falsehood: false, hatred: true, cowardice: false }),
  },
  /** La planta de la sala de la Llama, equivocada (el Lycaeum tiene la suya en la 2). */
  plantaLlama: { id: "momento-03", def: (d) => void (d.estado.position = { ...d.estado.position, floor: 0 }) },
  /**
   * 🔴 LA TRAMPA DOCUMENTADA, y por eso es mutante de ESTADO: coloca al Shadowlord en (x, y−2)
   * —donde lo pone el (Y)ell, `ritual.ts:105` `spawnDy: 2`— en vez de en (x, y−1), que es la
   * casilla que el ritual LEE (`endgame/use-tools.ts:72`). Es el error que se comete al
   * componer por analogía con la convocatoria, y su síntoma es que TODO parece correcto: el
   * objeto existe, el byte está puesto, la posición es la de la Llama… y el momento queda a
   * DOS Use de destruirlo en vez de a uno. Sólo lo caza un aserto sobre si el ritual DISPARA.
   */
  casillaY2: {
    id: "momento-03",
    estado: (s) => {
      for (const o of s.worldObjects ?? []) if (o.kind === "shadowlord") o.y -= 1;
    },
  },

  // ── el ACTO IV (8, 9 y 10) ────────────────────────────────────────────────────────────
  //
  // Los cuatro rompen las cuatro afirmaciones que estas tarjetas hacen y que NINGÚN mutante
  // anterior toca: la capa (sobremundo vs Underworld), la luz, el gate de la emboscada y el
  // predicado del final. Ninguno cambia la posición x/y, a propósito: un aserto que sólo
  // mirase coordenadas los dejaría pasar a los cuatro.
  /**
   * 🔴 EL QUE CAMBIA DE CAPA SIN MOVERSE. `floor: 0` con la MISMA (128,128) deja al momento 10
   * de pie sobre agua abierta del sobremundo (0x01 Water1) en vez de sobre la boca del Doom
   * (0x16 en el Underworld). Es EXACTAMENTE el error que #118 no sabía descartar, y su
   * síntoma es nulo si el aserto sólo mira x/y: la coordenada sigue siendo la de Doom.
   */
  capaDelDoom: { id: "momento-10", def: (d) => void (d.estado.position = { ...d.estado.position, floor: 0 }) },
  /** Sin antorcha encendida: el Underworld a luz 2 y la tarjeta del 8 prometiendo luz. */
  sinAntorcha: { id: "momento-08", def: (d) => void (d.estado.torchTurns = 0) },
  /**
   * 🔴 UN SHADOWLORD VIVO EN LA PUERTA DEL DOOM. Borra el flag del primero, y con eso
   * `doomEntranceAmbush` (`game.ts:6347-6352`) intercepta el (E)nter: el jugador que cargue
   * el momento 9 no desciende, pelea. Todo lo demás del estado queda impecable — posición,
   * grupo, Caja, sello — y por eso hace falta un aserto sobre `canReachDoom` y no sobre la
   * pinta del parche.
   */
  // ⚠ La clave va escrita a mano porque `MUTANTES` es un const de módulo y no puede
  // `await import` a `shadowlordDeadFlag`. No es un segundo sitio donde equivocarse en
  // silencio: si el formato del flag cambiara, este mutante dejaría de matar y el arnés se
  // pondría ROJO por el lado del control negativo. El modo de fallo es el bueno.
  shadowlordVivo: {
    id: "momento-09",
    def: (d) => void delete d.estado.questFlags["shadowlord-dead:falsehood"],
  },
  /**
   * 🔴 EL 10 SIN EL AMULETO: la tarjeta dice «todo lo que el rescate pide está en tus manos»
   * y `endgameReady` pasaría a false — el jugador bajaría los ocho niveles para que Lord
   * British le dijera que su gesta no está completa. Es el mutante que hace que la recíproca
   * del Amuleto tenga dos lados: sin él, `conElAmuleto` nunca discriminaría nada.
   */
  finalSinAmuleto: {
    id: "momento-10",
    def: (d) => void (d.estado.lbArtifacts = { ...d.estado.lbArtifacts, amulet: false }),
  },

  // ── LA MOCHILA (reporte de jugabilidad del usuario, 08-08) ────────────────────────────
  //
  // Los tres rompen el defecto REAL que se acaba de arreglar, cada uno en su forma. Ninguno
  // toca posición, grupo ni trama: si los asertos de la mochila no existieran, los tres
  // pasarían enteros por los tests anteriores — que es exactamente lo que pasaba hasta hoy.
  /**
   * 🔴 EL QUE VUELVE A SELLAR LA HABITACIÓN. Deja el momento 6 con 0 skull keys, o sea el
   * estado EXACTO que el usuario encontró jugando: cinco personajes en 14 casillas cuya única
   * salida es un 0x97, sin la única llave que lo abre. El estado sigue impecable en todo lo
   * demás — posición delante del trono, insignia, Corona sin reclamar.
   */
  sinSkullKey: {
    id: "momento-06",
    def: (d) => void (d.estado.mochila = { ...d.estado.mochila, skullKeys: 0 }),
  },
  /**
   * 🔴 EL QUE APAGA EL MAPA. Underworld con 0 gemas: la party ve un radio de luz de 10 y
   * nada más. No es lo mismo que `sinAntorcha` —ése quita la LUZ, éste la ORIENTACIÓN— y hace
   * falta aparte porque un aserto sobre `torchTurns` lo dejaría pasar.
   */
  sinGemas: {
    id: "momento-08",
    def: (d) => void (d.estado.mochila = { ...d.estado.mochila, gems: 0 }),
  },
  /**
   * 🔴 EL QUE DEVUELVE AL 7 A SU CELDA DE CASTIGO: (17,12), el cuartito de dos casillas y seis
   * muros del que no sale nadie (ver la nota del def). Es mutante de POSICIÓN y no de mochila
   * a propósito — la segunda cárcel no se arreglaba con inventario, y su control negativo
   * tiene que romper lo que de verdad la arregló.
   */
  caladoDelSiete: {
    id: "momento-07",
    def: (d) => void (d.estado.position = { ...d.estado.position, x: 17, y: 12 }),
  },
};

/** Los tres momentos que ocurren en una sala de la Llama, en orden de shard. */
const IDS_LLAMA = ["momento-03", "momento-04", "momento-05"];

const mut = mutante ? MUTANTES[mutante] : null;
if (mutante && !mut) {
  console.error(`mutante desconocido: ${mutante} (hay: ${Object.keys(MUTANTES).join(", ")})`);
  process.exit(2);
}

/** Lee `<dir>/<id>.gam` + su sidecar y los deserializa por la ruta de importación nativa. */
function leeHorneado(id) {
  const gam = new Uint8Array(readFileSync(join(dir, `${id}.gam`)));
  const sidecar = JSON.parse(readFileSync(join(dir, `${id}.sidecar.json`), "utf8"));
  return { gam, state: importNativeSave(gam, sidecar) };
}

/** La copia del visitante: el mismo material del que se hornearon los `.gam` de `<dir>`. */
function baseDelVisitante() {
  const assets = join(RAIZ, "game", "assets");
  return {
    init: JSON.parse(readFileSync(join(assets, "initial-state.json"), "utf8")),
    plantilla: new Uint8Array(readFileSync(join(assets, "init.gam"))),
  };
}

/**
 * Los bytes de un momento por la MISMA ruta que el navegador, con el mutante aplicado.
 *
 * `<dir>` tiene los buenos y no se tocan: un mutante hornea los suyos aquí, en memoria. El
 * mutante de ESTADO obliga a partir `horneaMomento` en sus dos mitades —componer y exportar—
 * porque tiene que entrar entre las dos; el resultado recorre igualmente el códec entero.
 */
async function horneaMutado(id) {
  const { componeMomento, importaMomento } = await import("../../game/src/momentos/compone.js");
  const { exportNativeSave } = await import("../../game/src/core/saveNative.js");
  const def = structuredClone(momentoPorId(id));
  if (mut?.def) mut.def(def);
  const { init, plantilla } = baseDelVisitante();
  const state = componeMomento(def, init);
  if (mut?.estado) mut.estado(state);
  const h = exportNativeSave(state, plantilla);
  return { gam: h.gam, state: importaMomento(h) };
}

/** Los bytes de `id`: los horneados en disco, salvo que el mutante apunte a ESTE momento. */
async function bytesDe(id) {
  return mut?.id === id ? horneaMutado(id) : leeHorneado(id);
}

/** Lo que la partida sembrada dice de sí misma, sin una sola cadena del juego. */
function observa(state, gam) {
  return {
    bytes: gam.length,
    location: state.position.location,
    floor: state.position.floor,
    x: state.position.x,
    y: state.position.y,
    // El grupo se cuenta por el MISMO predicado que usa el juego (`party.ts:171`) y que la
    // tarjeta de `/byo`: `partyStatus === 0`. No por `partySize`, que es un contador aparte.
    grupo: state.characters.filter((c) => c.partyStatus === 0).length,
    partySize: state.partySize,
    // RECÍPROCA de la cuenta: los miembros ocupan los PRIMEROS registros, que es lo que el
    // juego da por hecho (`joinParty`, `party.ts:160-167`). Un parche que marcara el byte sin
    // reordenar daría el mismo `grupo` y este índice saldría distinto.
    ultimoDelGrupo: state.characters.findLastIndex((c) => c.partyStatus === 0),
    hora: state.time.hour,
    minuto: state.time.minute,
    dia: state.time.day,
    mes: state.time.month,
    anio: state.time.year,
    turnos: state.turnsSinceStart,
    torchTurns: state.torchTurns,
    transport: state.transport,
    transportTile: state.transportTile,
    shards: state.shards,
    lbArtifacts: state.lbArtifacts,
    blackBadge: state.specialItems.blackBadge,
    woodenBox: state.specialItems.woodenBox,
    questFlags: Object.keys(state.questFlags).length,
    /**
     * ★ LAS RESERVAS, leídas del estado que salió del CÓDEC. Van aquí y no en una sección
     * aparte a propósito: así las observa TODO momento que ya tuviera asertos, y el pytest
     * puede exigir la mochila del acto en la misma tabla en la que ya exige el sitio. Que se
     * lean de vuelta importa — son diez campos nuevos que cruzan `exportNativeSave` e
     * `importNativeSave`, y un campo que el códec no supiera llevar aparecería como 0 aquí.
     */
    mochila: {
      food: state.food,
      gold: state.gold,
      keys: state.keys,
      gems: state.gems,
      torches: state.torches,
      skullKeys: state.skullKeys,
      scrollQuantities: [...state.scrollQuantities],
      potionQuantities: [...state.potionQuantities],
      reagentQuantities: [...state.reagentQuantities],
    },
  };
}

const obs = { mutante };

// ── 1 · el momento 1, leído de sus bytes horneados ──────────────────────────────────────
{
  const { gam, state } = await bytesDe("momento-01");
  obs.m01 = observa(state, gam);
}

// ── 1-bis · LAS AGUJAS del aserto EA-limpio POR DATOS ───────────────────────────────────
//
// 🔴 El aserto de que el sitio no publica el roster tiene que ser sobre DATOS, no sobre la
// FORMA del catálogo (concreción del lead, 08-08). Aquí se PRODUCEN las agujas; quien busca
// y juzga es el pytest, que tiene acceso a todo el árbol publicado.
//
// Las agujas son los 16 REGISTROS DE 32 B tal y como los escribe nuestro propio códec,
// rebanados del `.gam` horneado con las constantes que EXPORTA `saveNative.ts` — no
// reescritas aquí. Y son registros enteros y no cifras sueltas a propósito: `strength: 20`
// en decimal casa con cualquier cosa dentro de un bundle minificado, así que un aserto sobre
// el número daría un rojo perpetuo y acabaría aflojado hasta no medir nada. 32 bytes con
// nombre, clase, estado y ocho stats no casan por accidente.
{
  const { gam } = mutante ? { gam: null } : leeHorneado("momento-01");
  if (gam) {
    const rec = [];
    for (let i = 0; i < CHAR_RECORD_COUNT; i++) {
      const o = CHAR_RECORDS_OFFSET + i * CHAR_RECORD_SIZE;
      rec.push(Buffer.from(gam.subarray(o, o + CHAR_RECORD_SIZE)).toString("hex"));
    }
    obs.roster = {
      registrosHex: rec,
      tamRegistro: CHAR_RECORD_SIZE,
      // Los NOMBRES van por separado y como TEXTO: son el otro eje del aserto, con su
      // excepción declarada (dos de ellos SÍ salen en la prosa del catálogo). Se leen del
      // estado inicial del visitante, que es de donde salen los del `.gam`.
      nombres: JSON.parse(
        readFileSync(join(RAIZ, "game", "assets", "initial-state.json"), "utf8"),
      ).characters.map((c) => c.name).filter((n) => typeof n === "string" && n.length >= 3),
      // ★ Y LA TABLA EN CLARO. El registro de 32 B sólo caza un `.gam` crudo; la fuga MÁS
      // probable es la otra: alguien vuelca el `GameState` compuesto como JSON en el
      // catálogo o en un módulo, y ahí el roster viaja como TEXTO. Por eso viaja también
      // cada fila como (nombre, stats), y el pytest busca el nombre con SUS cifras cerca.
      filas: JSON.parse(
        readFileSync(join(RAIZ, "game", "assets", "initial-state.json"), "utf8"),
      ).characters
        .filter((c) => typeof c.name === "string" && c.name.length >= 3)
        .map((c) => ({
          nombre: c.name,
          stats: [c.strength, c.dexterity, c.intelligence, c.maxHp],
        })),
    };
  }
}

// ── 1-bis-2 · LOS DE CAMPOS (2, 6 y 7), leídos de sus bytes ─────────────────────────────
//
// Mismo predicado `observa()` que el momento 1: lo que estos AFIRMAN es posición, grupo,
// reloj y —lo que los separa entre sí— el estado de trama (los artefactos de Lord British
// en el 6/7) o el CARDINAL del grupo (los seis del 2). Sin esto, tres momentos que SÍ
// siembran una partida no tendrían ningún aserto encima.
{
  obs.artefactos = [];
  for (const id of ["momento-02", "momento-06", "momento-07"]) {
    const { gam, state } = await bytesDe(id);
    obs.artefactos.push({ id, ...observa(state, gam) });
  }
}

// ── 1-quater · LOS TRES DE LA LLAMA: «a un Use de destruirlo», COMPROBADO ───────────────
//
// 🔴 EL ASERTO QUE CIERRA ESTOS TRES MOMENTOS, y no es «están bien colocados»: es que el
// ritual DISPARE. La tarjeta promete un estado a UN (U)se de destruir al Shadowlord, y esa
// promesa tiene cinco precondiciones (`quest/ritual.ts:186-214`) de las que el parche pone
// cuatro. Comprobarlas una a una sería comprobar mi lista, no la del juego: si mañana el
// ritual exige una sexta, la lista de aquí seguiría verde. Se ejecuta el ritual y se mira si
// el Shadowlord queda muerto.
//
// ★ Y SE LLAMA A `useShard`, LA FUNCIÓN DE VERDAD (`endgame/use-tools.ts:61`), no a una
// reproducción de lo que hace. Reproducirla aquí crearía un segundo sitio donde equivocarse
// —y el que se equivocaría igual, porque lo escribiría la misma cabeza— y dejaría pasar
// justamente el error que importa: que la casilla que el parche escribe no sea la que el
// ritual lee. Al llamar a la real, el (x, y−1) lo pone el port y no el arnés.
//
// El `ctx` es el ESTRECHO que la rama del shard usa: `useShard` sólo toca `state` (y los dos
// helpers de `worldObjects`, que también son de `state`). Los otros campos son cepos: si un
// día esa rama empieza a tocar el mapa o el transporte, revienta aquí en vez de mentir.
{
  const { useShard } = await import("../../game/src/core/endgame/use-tools.js");
  const { SHADOWLORDS, shadowlordDeadFlag } = await import(
    "../../game/src/core/quest/shadowlords.js"
  );
  const { SHADOWLORD_TILE } = await import("../../game/src/core/quest/ritual.js");

  /** ¿Hay un Shadowlord (tile 0xFC) en esta celda del mapa actual? */
  const slEn = (state, x, y) =>
    (state.worldObjects ?? []).some(
      (o) =>
        o.tile === SHADOWLORD_TILE &&
        o.location === state.position.location &&
        o.floor === state.position.floor &&
        o.x === x &&
        o.y === y,
    );

  obs.llama = [];
  for (const id of IDS_LLAMA) {
    const { gam, state } = await bytesDe(id);
    const p = state.position;
    // Lo que el momento dice que llevas. Tiene que ser UNO: con dos, el (U)se de abajo
    // elegiría por nosotros y el aserto mediría la elección del arnés.
    const enLaBolsa = SHADOWLORDS.filter((k) => state.shards[k]);

    // El ritual se declara SIN RNG (`ritual.ts:21-23`). No se asevera aquí —este fichero no
    // asevera— pero se CUENTA, para que el pytest pueda exigir cero: si algún día esa rama
    // empieza a tirar el dado, mueve el stream de todo el que cargue el momento.
    let tiradas = 0;
    const ctx = {
      state,
      dungeonState: null,
      rand: () => {
        tiradas++;
        return 0;
      },
      mapTileWithOverrides: () => {
        throw new Error("el ritual del shard no lee el mapa");
      },
      setMapOverride: () => {
        throw new Error("el ritual del shard no escribe el mapa");
      },
      setVolatileTerrain: () => {
        throw new Error("el ritual del shard no escribe terreno");
      },
      syncTransportFromTile: () => {
        throw new Error("el ritual del shard no toca el transporte");
      },
    };

    const antes = {
      bytes: gam.length,
      location: p.location,
      floor: p.floor,
      x: p.x,
      y: p.y,
      // La casilla que LEE el ritual y la que USA el (Y)ell, por separado: son la pareja que
      // distingue «bien colocado» de «colocado donde el summon, que es donde no se mira».
      shadowlordEnY1: slEn(state, p.x, p.y - 1),
      shadowlordEnY2: slEn(state, p.x, p.y - 2),
      convocado: state.shadowlordSummoned ?? null,
      shardsEnLaBolsa: enLaBolsa,
      grupo: state.characters.filter((c) => c.partyStatus === 0).length,
      hora: state.time.hour,
      minuto: state.time.minute,
      transport: state.transport,
      // La luz y las reservas, ANTES del (U)se. Esta sección arma su propio registro en vez
      // de llamar a `observa()`, así que los campos nuevos hay que traerlos aquí a mano — si
      // no, tres momentos se quedarían fuera del aserto de mochila sin que nadie lo viera.
      torchTurns: state.torchTurns,
      mochila: {
        food: state.food,
        gold: state.gold,
        keys: state.keys,
        gems: state.gems,
        torches: state.torches,
        skullKeys: state.skullKeys,
        scrollQuantities: [...state.scrollQuantities],
        potionQuantities: [...state.potionQuantities],
        reagentQuantities: [...state.reagentQuantities],
      },
    };

    // EL (U)SE. Uno solo, el del shard que lleva en la bolsa.
    let lineas = null;
    let revento = null;
    if (enLaBolsa.length === 1) {
      try {
        lineas = useShard(ctx, enLaBolsa[0]).map((e) =>
          e.kind === "message" ? e.text : `<${e.kind}>`,
        );
      } catch (e) {
        revento = String(e?.message ?? e);
      }
    }

    obs.llama.push({
      id,
      ...antes,
      // ── DESPUÉS del único (U)se ───────────────────────────────────────────────────────
      // El muerto se lee por el MISMO flag que el juego (`shadowlordDeadFlag`), no por un
      // booleano que devolviera la llamada: es el estado lo que tiene que quedar cambiado.
      destruido:
        enLaBolsa.length === 1 &&
        state.questFlags[shadowlordDeadFlag(enLaBolsa[0])] === true,
      shardConsumido: enLaBolsa.length === 1 && state.shards[enLaBolsa[0]] === false,
      doomBits: state.shadowlordDoomBits ?? 0,
      convocadoTrasElUse: state.shadowlordSummoned ?? null,
      shadowlordSigueEnElMapa: (state.worldObjects ?? []).some((o) => o.kind === "shadowlord"),
      tiradasDeRng: tiradas,
      lineas,
      revento,
    });
  }
}

// ── 1-quinquies · EL ACTO IV (8, 9 y 10): UNDERWORLD, LA BOCA DEL DOOM Y EL FINAL ───────
//
// 🔴 LO QUE ESTAS TRES TARJETAS PROMETEN NO SE COMPRUEBA CON UNA LISTA DE CAMPOS, y por dos
// razones distintas:
//
//  1. LA COORDENADA NO PUEDE SER UN LITERAL SUELTO. `defs.ts` escribe (128,128) y (58,102)
//     porque no puede importarlas —`data.json` es la extracción del visitante, no un módulo—,
//     así que aquí se leen las tablas `locationsX/locationsY` DE VERDAD y viajan al pytest
//     para que las empareje. Sin eso, la cifra del def sería una segunda fuente capaz de
//     derivar en silencio.
//  2. LO QUE SEPARA AL 9 DEL 10 ES UN PREDICADO DEL PORT, no un booleano. `endgameReady`
//     (`quest/lordbritish.ts:184-187`) es lo que decide si el rescate puede obrarse; se
//     LLAMA a la función real sobre los dos estados y además se mide la RELACIÓN: darle el
//     Amuleto al 9 tiene que volverlo `true`. Enumerar «amuleto+corona+cetro+3 muertos» sería
//     copiar aquí la lista del port, y seguiría verde el día que el port pidiera una cuarta
//     cosa.
//
// Y se mide la GEOMETRÍA de la bolsa del Doom (vecinas pasables, tile en cada uno de los DOS
// mapas grandes) porque es lo que resolvió #118 y lo que sostiene la ambientación de las dos
// tarjetas: «un paso al este» y «la roca negra cierra todo lo demás» son afirmaciones sobre
// el mapa, y aquí se comprueban contra el mapa.
{
  const { endgameReady } = await import("../../game/src/core/quest/lordbritish.js");
  const { canReachDoom } = await import("../../game/src/core/quest/shadowlords.js");
  const { SHADOWLORDS, shadowlordDeadFlag } = await import(
    "../../game/src/core/quest/shadowlord-keys.js"
  );
  const { wordSpokenFlag, LAST_DUNGEON_LOCATION } = await import(
    "../../game/src/core/quest/words.js"
  );
  const { isPassable } = await import("../../game/src/core/world/movement.js");

  const mapas = join(RAIZ, "game", "assets", "maps");
  const uw = JSON.parse(readFileSync(join(mapas, "underworld.json"), "utf8"));
  const ow = JSON.parse(readFileSync(join(mapas, "overworld.json"), "utf8"));
  const data = JSON.parse(readFileSync(join(RAIZ, "game", "assets", "data.json"), "utf8"));
  // `map.ts:70` — `tiles[wrapCoord(y)][wrapCoord(x)]`. La convención se copia de ahí y no se
  // adivina: leerla transpuesta daría un censo entero y falso.
  const tileUw = (x, y) => uw[y][x];
  const tileOw = (x, y) => ow[y][x];
  // `locationAt` devuelve `i + 1` (`world/movement.ts:396`) ⇒ la loc N vive en el índice N−1.
  const coordDe = (loc) => ({ x: data.locationsX[loc - 1], y: data.locationsY[loc - 1] });

  obs.actoIV = { momentos: [] };
  for (const id of ["momento-08", "momento-09", "momento-10"]) {
    const { gam, state } = await bytesDe(id);
    const p = state.position;
    obs.actoIV.momentos.push({
      id,
      ...observa(state, gam),
      // El tile que la party PISA, en los dos mapas grandes. El del Underworld es el que
      // manda (floor 0xFF); el del sobremundo viaja para que el discriminante de #118 se lea
      // en la misma fila que la coordenada.
      tileUnderworld: tileUw(p.x, p.y),
      tileOverworld: tileOw(p.x, p.y),
      pisableUnderworld: isPassable(tileUw(p.x, p.y), "foot"),
      pisableOverworld: isPassable(tileOw(p.x, p.y), "foot"),
      /**
       * ★ EL PISABLE QUE MIDE LO QUE EL MOMENTO AFIRMA: el mapa que le corresponde a SU
       * planta, no el Underworld siempre. Los dos de arriba son el par del discriminante y
       * no se mueven con la planta —leen las dos capas en la misma coordenada—, así que un
       * momento con `floor 0` en (128,128) los deja intactos y sólo éste se pone false: la
       * party de pie sobre agua abierta del sobremundo. Es la mitad semántica del mutante
       * `capaDelDoom`; sin este campo, el rojo sería sólo aritmético (`floor != 0xFF`).
       */
      pisableEnSuCapa: isPassable(
        (p.floor & 0xff) >= 0x80 ? tileUw(p.x, p.y) : tileOw(p.x, p.y),
        "foot",
      ),
      // Los flags de trama, por las MISMAS funciones que los escriben y los leen.
      shadowlordsMuertos: SHADOWLORDS.map((k) => state.questFlags[shadowlordDeadFlag(k)] === true),
      puedeLlegarAlDoom: canReachDoom(state),
      selloDoomAbierto: state.questFlags[wordSpokenFlag(LAST_DUNGEON_LOCATION)] === true,
      selloShameAbierto: state.questFlags[wordSpokenFlag(38)] === true,
      // EL PREDICADO DEL PORT, llamado. No una lista copiada aquí.
      endgameReady: endgameReady(state),
      // ★ LA RECÍPROCA, y fija una RELACIÓN y no valores: sobre una COPIA del estado, dar el
      // Amuleto (y sólo el Amuleto) tiene que volver `endgameReady` true. En el 9 es un
      // cambio de false→true; en el 10, que ya lo tiene, es un no-op true→true. La pareja
      // dice que el Amuleto es EXACTAMENTE lo que le falta al 9 — no que el 9 tenga un
      // booleano a false.
      conElAmuleto: endgameReady({
        ...structuredClone(state),
        lbArtifacts: { ...state.lbArtifacts, amulet: true },
      }),
    });
  }

  // ── LA COORDENADA, CONTRA LAS TABLAS ───────────────────────────────────────────────────
  obs.actoIV.tablas = {
    doom: coordDe(LAST_DUNGEON_LOCATION), // loc 40
    shame: coordDe(38),
    ultimaMazmorra: LAST_DUNGEON_LOCATION,
  };

  // ── LA BOCA DEL DOOM: EL DISCRIMINANTE DE #118 Y LA BOLSA DE TRES CELDAS ───────────────
  {
    const { x, y } = coordDe(LAST_DUNGEON_LOCATION);
    const vecinas = [
      [0, -1], [1, 0], [0, 1], [-1, 0],
      [1, -1], [1, 1], [-1, 1], [-1, -1],
    ].map(([dx, dy]) => ({
      dx,
      dy,
      tile: tileUw((x + dx) & 0xff, (y + dy) & 0xff),
      pisable: isPassable(tileUw((x + dx) & 0xff, (y + dy) & 0xff), "foot"),
    }));
    // Componente conexa a pie (4 vecinos, toro de 256): la bolsa medida. Se calcula aquí y
    // no se escribe como cifra en el pytest, que es quien la asevera.
    const visto = new Set();
    const pila = [[x, y]];
    visto.add(y * 256 + x);
    while (pila.length) {
      const [cx, cy] = pila.pop();
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = (cx + dx) & 0xff;
        const ny = (cy + dy) & 0xff;
        const k = ny * 256 + nx;
        if (visto.has(k) || !isPassable(tileUw(nx, ny), "foot")) continue;
        visto.add(k);
        pila.push([nx, ny]);
      }
    }
    obs.actoIV.boca = {
      x,
      y,
      tileUnderworld: tileUw(x, y),
      tileOverworld: tileOw(x, y),
      pisableUnderworld: isPassable(tileUw(x, y), "foot"),
      pisableOverworld: isPassable(tileOw(x, y), "foot"),
      vecinas,
      vecinasPisables: vecinas.filter((v) => v.pisable).map((v) => [v.dx, v.dy]),
      componenteAPie: visto.size,
    };
  }
}

// ── 1-sexies · ¿SE PUEDE SALIR DE AHÍ? LA ESCAPABILIDAD DE LOS MOMENTOS DE INTERIOR ─────
//
// 🔴 LA SECCIÓN QUE NACE DEL REPORTE DEL USUARIO («en Blackthorn estamos en habitación
// sellada sin skull key»), y la que habría cazado los DOS defectos que resultaron existir.
//
// ★ ES UNA PROPIEDAD SOBRE TODOS, NO UNA COMPROBACIÓN DEL 6. Escribir «el momento 6 lleva
// skull keys» habría arreglado el caso que el usuario encontró y dejado vivo el del 7, que
// nadie había mirado y era peor (dos celdas y CERO puertas). Lo que se mide aquí es la
// propiedad: desde la casilla en la que el save deja al grupo, ¿existe alguna salida que
// ESTA MOCHILA pueda operar? Un momento nuevo mal colocado se pone rojo solo.
//
// El grafo es el del port —`isPassable(tile, "foot")` sobre `maps/smallmaps.json`, 4
// vecinos— y la clasificación de cada salida sale del port, no de una lista de tiles
// escrita aquí:
//   · `DOOR_TILES.regular/regularView` (0xB8/0xBA) → (O)pen, sin nada en la mochila.
//   · `DOOR_TILES.locked/lockedView`   (0xB9/0xBB) → (J)immy, y `jimmyLock` exige `keys>0`.
//   · `DOOR_TILES.magicLock/…View`     (0x97/0x98) → SÓLO skull key (`useSkullKey`); el
//     (J)immy sobre éstos SIEMPRE rompe la llave (`commands.ts:183-186`) ⇒ no cuenta.
//   · escalera DENTRO de la bolsa (`tileInfo(t).klimable`) → (K)limb, sin nada.
//   · `HARPSICHORD_PASSAGE` en la frontera Y el clavicémbalo DENTRO → la melodía. Las dos
//     condiciones juntas: el pasadizo sin el instrumento al alcance no es una salida, que es
//     justo lo que le pasaba al momento 7 desde dentro del cuartito.
{
  const smallMaps = JSON.parse(
    readFileSync(join(RAIZ, "game", "assets", "maps", "smallmaps.json"), "utf8"),
  );
  const ABIERTAS = [DOOR_TILES.regular, DOOR_TILES.regularView];
  const DE_LLAVE = [DOOR_TILES.locked, DOOR_TILES.lockedView];
  const MAGICAS = [DOOR_TILES.magicLock, DOOR_TILES.magicLockView];

  obs.escapables = [];
  for (const def of MOMENTOS) {
    const { gam, state } = await bytesDe(def.id);
    void gam;
    const p = state.position;
    const mapa = smallMaps.find((m) => m.id === p.location);
    if (!mapa) continue; // sobremundo / Underworld: no es una habitación
    const planta = mapa.floors.find((f) => f.z === p.floor);
    if (!planta) continue;
    const T = planta.tiles;

    // Flood-fill a pie desde la casilla del grupo; la frontera se anota con su tile.
    const dentro = new Set();
    const frontera = new Map();
    const cola = [[p.x, p.y]];
    while (cola.length) {
      const [x, y] = cola.pop();
      if (x < 0 || y < 0 || x > 31 || y > 31) continue;
      const k = `${x},${y}`;
      if (dentro.has(k)) continue;
      const t = T[y][x];
      if (!isPassable(t, "foot")) {
        frontera.set(k, t);
        continue;
      }
      dentro.add(k);
      cola.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    const salidas = [];
    for (const [k, t] of frontera) {
      const [x, y] = k.split(",").map(Number);
      if (ABIERTAS.includes(t)) salidas.push({ x, y, tile: t, via: "open", pide: null });
      else if (DE_LLAVE.includes(t)) salidas.push({ x, y, tile: t, via: "jimmy", pide: "keys" });
      else if (MAGICAS.includes(t)) salidas.push({ x, y, tile: t, via: "skullKey", pide: "skullKeys" });
      else if (
        p.location === HARPSICHORD_PASSAGE.location &&
        p.floor === HARPSICHORD_PASSAGE.floor &&
        x === HARPSICHORD_PASSAGE.x &&
        y === HARPSICHORD_PASSAGE.y &&
        [...dentro].some((c) => {
          const [cx, cy] = c.split(",").map(Number);
          // El clavicémbalo NO es pisable: se toca desde la silla, y lo que hay que tener al
          // alcance es una casilla de la bolsa con el instrumento INMEDIATAMENTE al sur
          // (`harpsichord.ts`: «el tile inmediatamente al SUR == 0x8D»).
          return cy + 1 <= 31 && T[cy + 1][cx] === HARPSICHORD_TILE;
        })
      ) {
        salidas.push({ x, y, tile: t, via: "melodia", pide: null });
      }
    }
    // Escaleras DENTRO de la bolsa: se suben sin gastar nada.
    for (const k of dentro) {
      const [x, y] = k.split(",").map(Number);
      const t = T[y][x];
      if (tileInfo(t).klimable) salidas.push({ x, y, tile: t, via: "klimb", pide: null });
    }

    // ★ EL PREDICADO: al menos UNA salida operable CON ESTA MOCHILA. Una puerta mágica sólo
    // cuenta si el save trae skull keys; una de cerrojo, si trae llaves.
    const operables = salidas.filter(
      (s) => s.pide === null || (state[s.pide] ?? 0) > 0,
    );
    obs.escapables.push({
      id: def.id,
      location: p.location,
      floor: p.floor,
      x: p.x,
      y: p.y,
      celdas: dentro.size,
      salidas,
      operables: operables.length,
      // Para que el pytest pueda decir POR QUÉ falla sin recalcular nada.
      keys: state.keys,
      skullKeys: state.skullKeys,
    });
  }
}

// ── 1-ter · EL CATÁLOGO NO PUEDE CONTRADECIR AL PORT ────────────────────────────────────
//
// 🔴 NACE DE UN ERROR MÍO PUBLICADO. Los momentos 4 y 5 salieron a producción con los
// Shadowlords INTERCAMBIADOS: «Ante Nosfentor · el Shadowlord del Odio» y «Ante Astaroth ·
// el de la Cobardía». El port dice lo contrario —Hatred→Astaroth, Cowardice→Nosfentor
// (`quest/shadowlords.ts:23-27`)— y encima su cabecera AVISA de que «la versión previa tenía
// Astaroth/Nosfentor INTERCAMBIADOS (Redux-ismo); corregido contra el asm»
// (`shadowlords.ts:8-9`). O sea: escribí esas líneas de memoria en vez de leer el fichero, y
// reproduje exactamente el error que el port ya había corregido.
//
// El arreglo del texto no arregla la CAUSA: nada impedía que la siguiente línea de prosa se
// inventara igual. Esto sí. Se empareja lo que el catálogo AFIRMA (nombre propio en el
// título ↔ virtud en la ambientación) contra la tabla del port, en los DOS idiomas.
//
// ⚠ ALCANCE, para que nadie lea de más: esto ata la ÚNICA afirmación del catálogo que es
// mecánicamente comprobable. «El trono del usurpador» o «la cabaña de Iolo» no se pueden
// verificar así, y para ésas el control sigue siendo leer el código y citarlo.
{
  // La tabla del PORT, importada — no una copia. Ver el porqué en `shadowlords.ts:23-33`.
  const { SHADOWLORD_INFO } = await import("../../game/src/core/quest/shadowlords.js");
  const SHADOWLORD_NOMBRES = Object.fromEntries(
    Object.entries(SHADOWLORD_INFO).map(([k, v]) => [k, v.name]),
  );
  const cat = JSON.parse(
    readFileSync(join(RAIZ, "demo-byo", "public", "momentos", "momentos.json"), "utf8"),
  );
  // Palabra de la virtud en los dos idiomas, por clave canónica de `shadowlords.ts:18`.
  const VIRTUD = {
    falsehood: ["Falsedad", "Falsehood"],
    hatred: ["Odio", "Hatred"],
    cowardice: ["Cobardía", "Cowardice"],
  };
  const parejas = [];
  for (const m of cat) {
    const titulo = `${m.titulo.es} ${m.titulo.en}`;
    const ambiente = `${m.ambiente.es} ${m.ambiente.en}`;
    // ¿Qué Shadowlord NOMBRA el título, según la tabla del PORT (no una lista de aquí)?
    const nombrado = Object.entries(SHADOWLORD_NOMBRES)
      .filter(([, nombre]) => titulo.includes(nombre))
      .map(([clave]) => clave);
    // ¿Qué virtud nombra la ambientación?
    const virtudes = Object.entries(VIRTUD)
      .filter(([, palabras]) => palabras.some((p) => ambiente.includes(p)))
      .map(([clave]) => clave);
    if (nombrado.length === 0 && virtudes.length === 0) continue;
    parejas.push({ id: m.id, nombrado, virtudes });
  }
  obs.shadowlordsCatalogo = { parejas, tablaDelPort: SHADOWLORD_NOMBRES };
}

// ── 2 · el catálogo publicado NO lleva estado ───────────────────────────────────────────
//
// 🔴 ESTE ES EL ASERTO DE EA-LIMPIO, y mira el fichero que SE PUBLICA. El parche de un
// momento se compone en el navegador contra la copia del visitante; lo que el sitio sirve es
// sólo el catálogo. Si algún día alguien mete el estado ahí «para no tener que componer»,
// estaría publicando el roster de 16 registros extraído de INIT.GAM.
{
  const cat = JSON.parse(
    readFileSync(join(RAIZ, "demo-byo", "public", "momentos", "momentos.json"), "utf8"),
  );
  obs.catalogo = {
    n: cat.length,
    claves: [...new Set(cat.flatMap((m) => Object.keys(m)))].sort(),
    disponibles: cat.filter((m) => m.disponible).map((m) => m.id),
    // Longitud del fichero entero: un catálogo con estado dentro pesaría decenas de KB.
    bytes: JSON.stringify(cat).length,
    // Los diez ids del catálogo tienen que ser los diez del módulo: si el JSON commiteado se
    // quedara corto, el modal enseñaría menos tarjetas y nadie lo notaría.
    idsIgualQueElModulo:
      cat.map((m) => m.id).join(",") === MOMENTOS.map((m) => m.id).join(","),
  };
}

// ── 3 · IDEMPOTENCIA y procedencia, por la ruta real de instalación ─────────────────────
{
  const def = momentoPorId("momento-01");
  const assets = join(RAIZ, "game", "assets");
  const base = {
    init: JSON.parse(readFileSync(join(assets, "initial-state.json"), "utf8")),
    plantilla: new Uint8Array(readFileSync(join(assets, "init.gam"))),
  };
  const id1 = siembraMomento(def, base, "es");
  const trasUna = readSaveIndex();
  const id2 = siembraMomento(def, base, "es"); // el mismo, otra vez
  const trasDos = readSaveIndex();
  obs.instalacion = {
    id1,
    id2,
    // Añadir dos veces ⇒ UNA entrada. Es la decisión #4 del spec, y es un upsert por id.
    entradasTrasUna: trasUna.length,
    entradasTrasDos: trasDos.length,
    // Y una sola RANURA de estado, no sólo una fila de índice: un índice deduplicado sobre
    // dos ranuras dejaría basura invisible en el almacenamiento del visitante.
    ranuras: [...ALMACEN.keys()].filter((k) => k.startsWith(SAVE_SLOT_PREFIX)).length,
    provenance: trasDos[0]?.provenance ?? null,
    momentoId: trasDos[0]?.momentoId ?? null,
    // La cabecera lleva el título del momento, no «Untitled».
    name: trasDos[0]?.name ?? null,
    locationName: trasDos[0]?.locationName ?? null,
    // Y el estado guardado en la ranura es el del momento: se relee del almacén, no del
    // objeto que se acaba de escribir. Un `setItem` que no escribiera daría `null` aquí.
    floorEnLaRanura:
      JSON.parse(globalThis.localStorage.getItem(SAVE_SLOT_PREFIX + id2) ?? "null")?.position
        ?.floor ?? null,
  };
}

// ── 4 · un momento SIN parche no se puede sembrar ───────────────────────────────────────
//
// RECÍPROCA del catálogo: `disponible` sale de que exista el parche, así que un momento sin
// estado tiene que ser IMPOSIBLE de componer, no simplemente estar sin botón. Si componer uno
// devolviera una partida nueva en vez de lanzar, un camino equivocado sembraría un save con
// el TÍTULO de un momento y el estado del primer minuto del juego.
//
// 🔴 Y DESDE EL ACTO IV EL SUJETO ES SINTÉTICO, PORQUE YA NO QUEDA NINGUNO REAL. Con los diez
// parcheados, `MOMENTOS.filter((m) => !m.estado)` es la lista VACÍA — y la versión anterior de
// este bloque hacía `componeMomento(momentoPorId(sinEstado[0]), …)` con `sinEstado[0]`
// `undefined`: habría seguido dando `componerLanza: true` por un `TypeError` de leer `.estado`
// de `undefined`, o sea VERDE por el motivo equivocado y sin medir nada. Se fabrica el testigo
// (un def real al que se le quita el parche) para que la propiedad siga teniendo qué probar.
// ★ Que la población de una recíproca se vacíe no la jubila: le cambia el sujeto.
{
  const { componeMomento } = await import("../../game/src/momentos/compone.js");
  const sinEstado = MOMENTOS.filter((m) => !m.estado).map((m) => m.id);
  const testigo = structuredClone(momentoPorId("momento-01"));
  delete testigo.estado;
  let lanza = null;
  try {
    componeMomento(testigo, { characters: [] });
    lanza = false;
  } catch {
    lanza = true;
  }
  // CONTROL POSITIVO del testigo: el MISMO def CON su parche tiene que componer sin lanzar.
  // Sin esto, «lanza» podría venir del `{ characters: [] }` degenerado y no de la ausencia de
  // parche — y el aserto estaría midiendo un estado inicial vacío, no la guarda.
  let elCompletoCompone = null;
  try {
    componeMomento(
      momentoPorId("momento-01"),
      JSON.parse(readFileSync(join(RAIZ, "game", "assets", "initial-state.json"), "utf8")),
    );
    elCompletoCompone = true;
  } catch {
    elCompletoCompone = false;
  }
  obs.proximamente = {
    ids: sinEstado,
    testigoSintetico: testigo.id,
    componerLanza: lanza,
    elCompletoCompone,
  };
}

process.stdout.write(JSON.stringify(obs));
