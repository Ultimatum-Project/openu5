/**
 * MOMENTOS LEGENDARIOS — de un `def` a los bytes de un save.
 *
 * ÚNICO camino, y lo recorren los TRES consumidores: el horneado de build
 * (`demo-byo/momentos/hornea.mjs`), la instalación en el navegador
 * (`demo-byo/src/momentos.ts`) y el arnés de verificación
 * (`demo-byo/verificacion/verifica-momentos.mjs`). Si divergieran, el test estaría
 * midiendo un camino que nadie recorre.
 *
 * ── LA BASE ES LA COPIA DEL VISITANTE, NO UN FICHERO NUESTRO ────────────────────────────
 * 🔴 `componeMomento` no construye un estado de la nada: parte de `createNewGame(init)` con
 * el `ExtractedInitialState` que salió de LA COPIA DEL VISITANTE (su `INIT.GAM`, extraído en
 * su navegador). El parche del momento sólo escribe encima lo que el momento AFIRMA.
 *
 * La razón es de licencia y está medida: un `GameState` completo lleva dentro el roster de
 * 16 registros con nombres, stats y equipo, más los inventarios de arranque — todo extraído
 * de `INIT.GAM` de EA. `game/assets/` es gitignored entero justamente por eso, y
 * `demo-byo/verificacion/verifica-tarjeta.mjs` ya declara en su cabecera que ese material
 * «no viaja en ficheros tracked (CLAUDE.md REGLA 4)». Así que lo que se publica es el
 * PARCHE —dato nuestro— y la composición ocurre contra la copia de quien juega.
 *
 * ── Y AUN ASÍ SE HORNEAN BYTES ──────────────────────────────────────────────────────────
 * `horneaMomento` produce el `SAVED.GAM` de 4192 B por `exportNativeSave`, igual que el
 * botón «Export .GAM» del juego. Lo que cambia es DÓNDE acaban esos bytes: en el navegador
 * del visitante (instalación) o en un directorio temporal (verificación), nunca en un
 * fichero tracked ni en el sitio.
 */
import { createNewGame, type ExtractedInitialState, type GameState } from "../core/state.js";
import { exportNativeSave, importNativeSave, type SaveSidecar } from "../core/saveNative.js";
import { MAX_PARTY } from "../core/party.js";
import { SHADOWLORD_TILE } from "../core/quest/ritual.js";
import type { Mochila, MomentoDef, ParcheMomento } from "./defs.js";

/**
 * Tope de un contador de BYTE del save. No es una cota inventada: es el `add_capped`
 * del binario (0x7f70 con cap 0x63, citado en `game.ts:5145` para las antorchas) y el
 * mismo `ITEM_COUNT_CAP` que aplica `world/search.ts:103` a llaves y skull keys.
 */
const TOPE_BYTE = 0x63;
/** `food` y `gold` son u16 en la ventana del save (`saveNative.ts:310-311`). */
const TOPE_U16 = 0xffff;
/** Las tres tablas de consumibles tienen OCHO ranuras (`saveNative.ts:332-334`). */
const RANURAS = 8;

/**
 * Escribe las reservas que el momento AFIRMA y deja el resto heredado.
 *
 * 🔴 SE VALIDA EN VEZ DE RECORTAR EN SILENCIO, por la misma razón que `colocaGrupo` con el
 * tope de party: un def con 300 gemas es un ERROR DEL DEF, y truncarlo a 99 lo convertiría en
 * un momento que promete una cosa y siembra otra sin que nadie se entere. Y la cota importa:
 * `exportNativeSave` escribe estos campos con `& 0xff` (`saveNative.ts:550-555`), así que un
 * 300 llegaría al `.GAM` como 44 — un número plausible, que es lo peor que puede pasar.
 */
function aplicaMochila(state: GameState, m: Mochila): void {
  const escalar = (nombre: string, v: number, tope: number): number => {
    if (!Number.isInteger(v) || v < 0 || v > tope) {
      throw new Error(`parche de momento: mochila.${nombre} = ${v} fuera de 0..${tope}`);
    }
    return v;
  };
  const tabla = (nombre: string, xs: number[]): number[] => {
    if (xs.length !== RANURAS) {
      throw new Error(`parche de momento: mochila.${nombre} tiene ${xs.length} ranuras, son ${RANURAS}`);
    }
    return xs.map((v, i) => escalar(`${nombre}[${i}]`, v, TOPE_BYTE));
  };
  if (m.food !== undefined) state.food = escalar("food", m.food, TOPE_U16);
  if (m.gold !== undefined) state.gold = escalar("gold", m.gold, TOPE_U16);
  if (m.keys !== undefined) state.keys = escalar("keys", m.keys, TOPE_BYTE);
  if (m.gems !== undefined) state.gems = escalar("gems", m.gems, TOPE_BYTE);
  if (m.torches !== undefined) state.torches = escalar("torches", m.torches, TOPE_BYTE);
  if (m.skullKeys !== undefined) state.skullKeys = escalar("skullKeys", m.skullKeys, TOPE_BYTE);
  if (m.magicCarpets !== undefined) {
    state.magicCarpets = escalar("magicCarpets", m.magicCarpets, TOPE_BYTE);
  }
  if (m.scrollQuantities) state.scrollQuantities = tabla("scrollQuantities", m.scrollQuantities);
  if (m.potionQuantities) state.potionQuantities = tabla("potionQuantities", m.potionQuantities);
  if (m.reagentQuantities) state.reagentQuantities = tabla("reagentQuantities", m.reagentQuantities);
}

/** `partyStatus` del byte original: 0 = viaja contigo, 0xFF = no unido (`state.ts:31`). */
const EN_EL_GRUPO = 0x00;
const NO_UNIDO = 0xff;

/**
 * Coloca en el grupo EXACTAMENTE a los índices de roster pedidos, en ese orden.
 *
 * 🔴 NO BASTA CON PONER `partyStatus = 0`: el juego da por hecho que los miembros ocupan los
 * PRIMEROS `partySize` registros — `joinParty` (`party.ts:160-167`) mueve el registro con un
 * `splice` a la posición `partySize` justamente para mantenerlo, y `partyConsciousState`
 * recorre `0 .. partySize−1`. Un parche que marcase el índice 7 sin moverlo dejaría un grupo
 * de 3 con un miembro fuera del rango que el juego recorre: presente en la ficha y ausente
 * de media docena de bucles. Por eso aquí se REORDENA.
 *
 * El tope es el del juego (`MAX_PARTY`, `party.ts:9`) y se comprueba en vez de recortarse en
 * silencio: un def con siete miembros es un error del def, no algo que redondear.
 */
function colocaGrupo(state: GameState, indices: readonly number[]): void {
  if (indices.length === 0) throw new Error("parche de momento: `party` vacío");
  if (indices.length > MAX_PARTY) {
    throw new Error(`parche de momento: ${indices.length} miembros, el tope es ${MAX_PARTY}`);
  }
  if (new Set(indices).size !== indices.length) {
    throw new Error(`parche de momento: índices de party repetidos (${indices.join(",")})`);
  }
  const elegidos = indices.map((i) => {
    const c = state.characters[i];
    if (!c) throw new Error(`parche de momento: no hay registro de roster ${i}`);
    return c;
  });
  const resto = state.characters.filter((c) => !elegidos.includes(c));
  for (const c of elegidos) c.partyStatus = EN_EL_GRUPO;
  // El resto sale del grupo. Se pisa el byte a 0xFF y no se respeta el de la partida nueva:
  // un momento declara SU grupo entero, no un añadido al que ya hubiera.
  for (const c of resto) c.partyStatus = NO_UNIDO;
  state.characters = [...elegidos, ...resto];
  state.partySize = elegidos.length;
}

/** Aplica el parche sobre un estado ya construido. Exportada para el arnés de mutantes. */
export function aplicaParche(state: GameState, parche: ParcheMomento): void {
  state.position = { ...parche.position };
  if (parche.time) state.time = { ...parche.time };
  if (parche.party) colocaGrupo(state, parche.party);
  if (parche.transport !== undefined) state.transport = parche.transport;
  if (parche.transportTile !== undefined) state.transportTile = parche.transportTile;
  if (parche.karma !== undefined) state.karma = parche.karma;
  if (parche.turnsSinceStart !== undefined) state.turnsSinceStart = parche.turnsSinceStart;
  if (parche.torchTurns !== undefined) state.torchTurns = parche.torchTurns;
  if (parche.mochila) aplicaMochila(state, parche.mochila);
  if (parche.shards) state.shards = { ...parche.shards };
  if (parche.lbArtifacts) state.lbArtifacts = { ...parche.lbArtifacts };
  // `specialItems` es PARCIAL a propósito (ver su declaración): un momento afirma el
  // catalejo o la insignia negra sin tener que pronunciarse sobre los otros cinco.
  if (parche.specialItems) state.specialItems = { ...state.specialItems, ...parche.specialItems };
  if (parche.questFlags) state.questFlags = { ...parche.questFlags };
  if (parche.shadowlordConvocado !== undefined) colocaShadowlord(state, parche.shadowlordConvocado);
}

/**
 * Pone al Shadowlord `idx` convocado y en la casilla que el RITUAL lee.
 *
 * Las dos mitades van juntas a propósito: `shadowlordSummoned` sin el objeto, o el objeto sin
 * el byte, dan un estado que pasa cuatro de las cinco condiciones y no dispara — y el
 * momento diría «a un Use» siendo mentira. Un solo campo del parche escribe las dos.
 */
function colocaShadowlord(state: GameState, idx: number): void {
  if (idx < 0 || idx > 2) throw new Error(`parche de momento: shadowlord ${idx} fuera de 0..2`);
  const p = state.position;
  state.shadowlordSummoned = idx;
  state.worldObjects = [
    ...(state.worldObjects ?? []),
    {
      location: p.location,
      floor: p.floor,
      x: p.x,
      // 🔴 y−1: la casilla que LEE el ritual (`endgame/use-tools.ts:72`), no la y−2 donde
      // el (Y)ell coloca (`ritual.ts:105`). Ver la nota del campo en `defs.ts`.
      y: p.y - 1,
      tile: SHADOWLORD_TILE,
      kind: "shadowlord",
    },
  ];
}

/**
 * El `GameState` de un momento sobre la partida nueva del visitante.
 *
 * `init` = SU `initial-state.json` (extraído de SU `INIT.GAM`). Un momento sin parche
 * («próximamente») no se puede componer y lanza: es un error del llamante, no un caso a
 * degradar en silencio.
 */
export function componeMomento(def: MomentoDef, init: ExtractedInitialState): GameState {
  if (!def.estado) throw new Error(`el momento ${def.id} todavía no tiene estado (próximamente)`);
  const state = createNewGame(init);
  aplicaParche(state, def.estado);
  return state;
}

/** Los bytes de un momento: `SAVED.GAM` de 4192 B + su sidecar. */
export interface MomentoHorneado {
  gam: Uint8Array;
  sidecar: SaveSidecar;
}

/**
 * Hornea el momento: `def` + la partida nueva del visitante → los bytes nativos.
 *
 * `plantilla` = los 4192 B cuyos bytes oscuros preserva `exportNativeSave` (el `init.gam`
 * del visitante). Es el MISMO contrato que el «Export .GAM» del juego
 * (`persistence.ts:201 downloadNativeSave`), no una vía nueva.
 */
export function horneaMomento(
  def: MomentoDef,
  init: ExtractedInitialState,
  plantilla: Uint8Array,
): MomentoHorneado {
  return exportNativeSave(componeMomento(def, init), plantilla);
}

/**
 * Los bytes de vuelta a `GameState`, por la ruta de importación nativa que ya existía.
 *
 * 🔴 EL ROUND-TRIP NO ES CEREMONIA. La instalación podría meter en el almacén el estado que
 * `componeMomento` devuelve y ahorrarse el viaje — y entonces el momento sembrado sería un
 * objeto que NUNCA ha pasado por el códec, mientras que toda partida del jugador sí. Pasando
 * por `exportNativeSave` → `importNativeSave` se siembra exactamente lo que el juego habría
 * cargado de un `SAVED.GAM` + sidecar, con los defaults de `deserialize` y los estampados de
 * la lista B aplicados donde toca (`state.ts:771-789`). Un campo que el códec no supiera
 * llevar aparece aquí, no en la partida de alguien.
 */
export function importaMomento(h: MomentoHorneado): GameState {
  return importNativeSave(h.gam, h.sidecar);
}
