/**
 * Movimiento del jugador por turnos con las reglas EXACTAS del original
 * (Task 3.1; derivación en re/notes/kernel-survival.md §5, paridad DOSBox
 * en re/parity/kernel/):
 *
 *  - Pueblo (TOWN.OVL): toda acción aceptada cuesta 1 minuto, INCLUIDO el
 *    movimiento bloqueado ("Blocked!"). Salir por el borde no cuesta.
 *  - Exterior (MAINOUT.OVL): un paso cuesta 2 minutos; terreno lento
 *    (tiles 4,6,7,8,30,31) +2 min y 1 turno extra del mundo con
 *    "Slow progress!"; muy lento (9..15) +4 min y 2 turnos extra con
 *    "Very slow!" (MAINOUT 0x448/0x468: call 0x1A60 × clase, vía
 *    MoveResult.extraWorldTurns). Un movimiento BLOQUEADO no consume tiempo ni
 *    turno (el bucle MAINOUT 0xC30 salta el reloj si el handler
 *    devuelve 0).
 *  - Wrap 256×256 del overworld en ambos ejes: en el original las
 *    coordenadas son bytes y wrappean de forma natural (MAINOUT 0x354:
 *    `add byte ptr [g_party_x], al`).
 */
import type { GameState, TransportMode } from "../state.js";
import { tileInfo } from "../tiles.js";
import { stepChunkOrigin } from "./chunk-origin.js";
import { MISC_ECHO_STRINGS } from "./cmd-strings.js";
import { wrapCoord, type ActiveMap } from "./map.js";
import { TILE_CACTUS, isBoardableActorTile } from "./transport.js";
import {
  advanceClock,
  turnHousekeeping,
  minutesPerAction,
  type SkyRefreshCtx,
  defaultRand,
  MINUTES_PER_ACTION_TOWN,
  MINUTES_PER_ACTION_OUTDOORS,
  type RandFn,
} from "./survival.js";

export type Direction = "north" | "south" | "east" | "west";

export const DIRECTION_DELTA: Record<Direction, { dx: number; dy: number }> = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 },
};

export interface MoveResult {
  moved: boolean;
  /** Mensaje estilo original ("Blocked!", "Slow progress!") o null. */
  message: string | null;
  /** El jugador salió por el borde de un small map (volver al overworld). */
  exitedMap: boolean;
  /** Mensajes del housekeeping de fin de turno ("Starving!"…). */
  sideMessages?: string[];
  /**
   * Turnos EXTRA del mundo (monstruos) por terreno lento: 1 (clase 1) o
   * 2 (clase 2). El original los corre dentro del handler (MAINOUT
   * 0x448/0x468-0x477: 1-2 × `call 0x1A60`) ANTES del advance_clock
   * extra; el caller (Game.move) debe invocar el turno del mundo estas
   * veces adicionales.
   */
  extraWorldTurns?: number;
}

/**
 * Tile de relleno "fuera de límites" del viewport de un pueblo: lo que el
 * binario lee como TILE DE DESTINO cuando el jugador pisa el borde del mapa
 * 32×32 (TOWN 0x600: 0x678 lee el vecino del viewport centrado en el party;
 * al salirse del play area el viewport muestra el relleno). Para TODO pueblo
 * normal es Grass (5). Las 3 excepciones documentadas por Ultima5Redux
 * (SmallMap.GetOutOfBoundsSprite) son Sin Vraal's Hut=Desert (7),
 * Sutek's/Grendel's Hut=Swamp (4) y Stonegate=Hills (11) — TODAS transitables a
 * pie, por lo que la elección del relleno no cambia el comportamiento de una
 * salida a pie (que es el único transporte posible dentro de un pueblo). Se usa
 * Grass como valor único: es la interpretación conservadora (nunca atrapa al
 * jugador) y coincide con el caso común. La identidad exacta del relleno por
 * location es una divergencia deliberada Clase C (behaviorally idéntica).
 * Cita: TOWN.OVL 0x788/0x792/0x83a; Ultima5Redux SmallMap.GetOutOfBoundsSprite.
 */
/**
 * 🔴 NO LO SUSTITUYAS POR `map.edgeFillTile`. Parece el arreglo obvio —«el relleno es la
 * celda (31,31), no una constante»— y **METE una divergencia** (ficha #42, medido en
 * `re/notes/asm100-censo-acta.md` §81.4):
 *
 * El relleno real toma **seis** valores, no uno: Swamp(4), Grass(5), Desert1(7), Forest3(9),
 * Hills1(11) y **BlackSquare(255)**. Los cinco primeros son transitables a pie; el 255 **no
 * lo es en el clon** — es la divergencia bendecida el 2026-07-19 (el binario lo PISA: bit
 * CLEAR en el byte 31 de la tabla de `DATA.OVL` en fileoff `0x54e4`; el port lo bloquea por
 * defensa). Y el 255 es el relleno de **tres sótanos reales** (z=−1 de Yew, Palacio de
 * Blackthorn y Serpent's Hold; 600/280/699 celdas de 1024, o sea dato, no ruido).
 *
 * ⇒ con `map.edgeFillTile` esos tres sótanos dan `isPassable(255) = false` y sale
 * **«Blocked!» donde el binario deja salir**. Con la constante 5 el clon abre el prompt de
 * salida en las 64 plantas, igual que el binario.
 *
 * **La constante acierta porque CANCELA la otra divergencia declarada, no porque el relleno
 * sea uniforme.** Son dos divergencias que sólo son inofensivas JUNTAS: tocar una sin la
 * otra rompe. Si algún día se porta el 255 como transitable, ENTONCES —y sólo entonces—
 * este relleno puede pasar a leerse del mapa.
 */
const TOWN_EDGE_FILLER_TILE = 5; // Grass

export function isPassable(tile: number, transport: TransportMode): boolean {
  if (tile < 0) return false;
  const info = tileInfo(tile);
  switch (transport) {
    case "foot":
      return info.walkable;
    case "horse":
      return info.horsePassable;
    case "carpet":
      // Alfombra mágica = CLASE 2 del mover del binario (kernel 0x2C4C → handler 0x2C80,
      // class-table DATA.OVL 0x5504 idx 0x14>>2=5 → clase 2). Pasa si: tile<4 (agua
      // profunda 0x00-0x03, predicado es_agua 0x2C2E), o (tile&0xF0)==0x60 (WaterStream/
      // agua de corriente 0x60-0x6F), o tierra transitable (bitmap canónico DATA.OVL
      // 0x54E4 vía `info.walkable`). NO usamos el `carpetPassable` de TileData (Redux):
      // divergía del binario en 22 tiles — dejaba VOLAR la alfombra sobre montañas (0x0C),
      // oasis (0x1C) y cataratas (0xD4-0xD7), que el binario BLOQUEA, y bloqueaba de más en
      // ~18 tiles de interior/mazmorra que la alfombra (transporte solo de mapa grande)
      // nunca pisa (sillas 0x90-0x93, escaleras 0xC4-0xC7, escalas 0xC8-0xC9, lava 0x8F,
      // etc. — cubiertos por este predicado sin test dedicado). Deriva: re/notes/carpet-b2.md.
      // Residual ACEPTADO: BrokenShrine 0x1A — el bitmap crudo del binario lo bloquea, pero
      // el port lo mantiene walkable A PROPÓSITO (divergencia DELIBERADA «walk-to-restore»:
      // el jugador pisa el santuario destruido para restaurarlo, checkShrineEntry; ver
      // los-passability-audit.test.ts + shrine-trigger.test.ts). Al usar `info.walkable` la
      // alfombra hereda esa decisión (pasa por 0x1A) — correcto y coherente con el foot; NO
      // es un gap a corregir.
      return tile < 4 || (tile & 0xf0) === 0x60 || info.walkable;
    case "skiff":
      return info.skiffPassable;
    case "ship":
      return info.boatPassable;
  }
}

/** Tiles lentos del overworld (clase 1, MAINOUT 0x3E0): +2 min, "Slow progress!". */
const SLOW_TILES = new Set([4, 6, 7, 8, 0x1e, 0x1f]);
/** Tiles muy lentos (clase 2): 9..15 → +4 min, "Very slow!". */
const VERY_SLOW_MIN = 9;
const VERY_SLOW_MAX = 0x0f;

/** Clase de lentitud del terreno exterior (0 normal / 1 lento / 2 muy lento). */
export function terrainSpeedClass(tile: number): 0 | 1 | 2 {
  if (SLOW_TILES.has(tile)) return 1;
  if (tile >= VERY_SLOW_MIN && tile <= VERY_SLOW_MAX) return 2;
  return 0;
}

/**
 * Consume un turno: advance_clock(minutos) + housekeeping de fin de turno
 * (comidas/hambre/veneno/regeneración). Es el equivalente del par
 * kernel_advance_clock + kernel_turn_housekeeping que ejecutan los bucles
 * de contexto del original por cada acción aceptada. Devuelve los
 * mensajes producidos ("Starving!"…).
 *
 * `rand` se forwardea a `advanceClock`: en el binario advance_clock (0x4F7C)
 * SIEMPRE re-sortea los Shadowlords al cruzar medianoche (0x4FF5) con el mismo
 * g_rng_seed. Con `shadowlordLocs` sin setear el re-roll no consume rands
 * (relocateShadowlordsAtMidnight retorna en seco), por lo que los callers puros
 * y los arneses de paridad (run.ts, que no fijan shadowlordLocs) no cambian de
 * stream; sólo el juego vivo (que sí los fija) obtiene el re-roll exacto en los
 * bucles que pasan por advanceTurn (mazmorra, ignite). Cita: survival.ts
 * relocateShadowlordsAtMidnight, re/notes/dungeon.md L11-13 (rand = kernel 0x2092
 * compartido).
 */
export function advanceTurn(
  state: GameState,
  minutes: number = minutesPerAction(state.position.location),
  rand: RandFn = defaultRand,
  sky?: SkyRefreshCtx,
): string[] {
  advanceClock(state, minutes, rand, sky);
  return turnHousekeeping(state, rand);
}

/**
 * Intenta mover al jugador sobre el mapa activo dado (con overrides de
 * puertas ya aplicados por el caller). Coste de tiempo y semántica de
 * bloqueo EXACTOS del original (ver cabecera).
 */
export function tryMove(
  state: GameState,
  map: ActiveMap,
  dir: Direction,
  rand: RandFn = defaultRand,
): MoveResult {
  const { dx, dy } = DIRECTION_DELTA[dir];
  let nx = state.position.x + dx;
  let ny = state.position.y + dy;

  if (map.wraps) {
    nx = wrapCoord(nx);
    ny = wrapCoord(ny);
  } else if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) {
    // Salir por el borde de un pueblo. El binario valida la transitabilidad del
    // TILE DE DESTINO ANTES de abrir el prompt (TOWN 0x788 kernel_tile_passable
    // → si NO transitable salta a 0x83a "Blocked!\n" DS 0x26d6 SIN prompt; sólo
    // si es transitable llega a 0x792 y abre "Dost thou wish to leave?"). Al
    // pisar fuera del 32×32, ese destino es el relleno del viewport
    // (TOWN_EDGE_FILLER_TILE). Si NO transitable → "Blocked!" (el bucle TOWN
    // cobra 1 min, 0x15D4). Si transitable → salida sin coste (TOWN 0x600
    // retorna 0 al salir; el bucle solo cobra advance_clock(1) si el handler
    // devolvió DISTINTO de 0 — jne en TOWN 0x15B6).
    if (!isPassable(TOWN_EDGE_FILLER_TILE, state.transport)) {
      const sideMessages = advanceTurn(state, MINUTES_PER_ACTION_TOWN, rand);
      return { moved: false, message: "Blocked!", exitedMap: false, sideMessages };
    }
    return { moved: false, message: null, exitedMap: true };
  }

  const target = map.tileAt(nx, ny);
  if (!isPassable(target, state.transport)) {
    if (!map.wraps) {
      // Pueblo: "Blocked!" consume 1 minuto (bucle TOWN 0x15D4).
      const sideMessages = advanceTurn(state, MINUTES_PER_ACTION_TOWN, rand);
      return { moved: false, message: "Blocked!", exitedMap: false, sideMessages };
    }
    // Exterior: "Blocked!" NO consume tiempo ni turno (MAINOUT 0xC30-0xC36).
    return { moved: false, message: "Blocked!", exitedMap: false };
  }

  state.position.x = nx;
  state.position.y = ny;

  if (map.wraps) {
    // Histéresis del origen de la ventana de chunks (MAINOUT scrollChunkOrigin 0x0354):
    // se mantiene POR PASO en el overworld para que la (V)iew-a-gem reproduzca el ±16 del
    // original tras deambular (chunk_origin es RENDER-ONLY, fuera de la ventana 0x1060 del
    // save → sin impacto en sellos ni sidecar). Ver chunk-origin.ts.
    state.chunkOrigin = stepChunkOrigin(state.chunkOrigin, nx, ny, dx, dy);
    // Coste exterior: terreno lento primero (MAINOUT 0x461: advance_clock(2|4)
    // como llamada SEPARADA dentro del handler) y luego el coste base del
    // bucle (0xC39: advance_clock(2)). Cada llamada re-snapshotea g_prev_hour,
    // así que NO se pueden fusionar: un cruce de hora dentro del tramo de
    // terreno lento es invisible para el housekeeping, igual que en el
    // original.
    const speed = terrainSpeedClass(target);
    if (speed > 0) advanceClock(state, speed * 2);
    const message =
      speed === 1 ? MISC_ECHO_STRINGS.slowProgress : speed === 2 ? MISC_ECHO_STRINGS.verySlow : null;
    const sideMessages = advanceTurn(state, MINUTES_PER_ACTION_OUTDOORS, rand);
    return {
      moved: true,
      message,
      exitedMap: false,
      sideMessages,
      // El terreno lento además corre 1-2 turnos EXTRA del mundo
      // (MAINOUT 0x448/0x468-0x477: call 0x1A60 × clase).
      ...(speed > 0 ? { extraWorldTurns: speed } : {}),
    };
  }
  const sideMessages = advanceTurn(state, MINUTES_PER_ACTION_TOWN, rand);
  return { moved: true, message: null, exitedMap: false, sideMessages };
}

/**
 * Geometría de un paso SIN consumir turno (ni reloj ni housekeeping). El caller
 * (Game.move) ejecuta el turno del bucle por separado vía outdoorTurn/townTurn,
 * para que el VIENTO ruede ANTES del housekeeping (orden exacto de turn.ts). Es
 * la descomposición de tryMove que exige la unificación del stream vivo (F.2):
 * tryMove bundlea reloj+housekeeping y no se puede intercalar el viento.
 */
export interface StepGeometry {
  moved: boolean;
  /** Paso impasable (sin exitedMap). */
  blocked: boolean;
  /** Salió por el borde de un small map. */
  exitedMap: boolean;
  /** "Blocked!" / "Slow progress!" / "Very slow!" / null. */
  message: string | null;
  /** Coste base del bucle (1 town / 2 outdoor); 0 si blocked-outdoor o exit. */
  minutes: number;
  /** Terreno lento (para el advanceClock extra y extraWorldTurns). */
  speedClass: 0 | 1 | 2;
  /** Destino tile 0x6A/0x6B (outdoor, a pie). */
  onBridge: boolean;
  /** Destino tile 4 (outdoor, a pie). */
  onSwamp: boolean;
  /**
   * El paso BLOQUEADO lo fue contra un CACTUS (tile 0x2f) **en una capa cuyo binario
   * TIENE el test**. Orden exacto en la cola de bloqueo del EXTERIOR, MAINOUT 0x0312 -
   * MAINOUT 0x0347: en MAINOUT 0x0322 imprime «Blocked!» SIEMPRE, y sólo DESPUÉS, en
   * MAINOUT 0x0329, `cmp [bp-6],0x2f` bifurca a «OUCH!» + daño al party (MAINOUT
   * 0x032f) o al beep de choque (MAINOUT 0x033c) — excluyentes. Sólo puede ser true
   * con `blocked` (el cactus es intransitable). #157.
   *
   * ★ FALSO EN PUEBLO, y no por falta de dato: la cola GEMELA de pueblo es `town_move`
   * TOWN.OVL 0x0600 y su bloqueo es TOWN 0x083a-0x084c, tres instrucciones enteras —
   * `print DS 0x26d6 "Blocked!\n"` + `call 0xffffa0f0` beep(0xa5,0xc8) + la cola común
   * `call 0xffff9946`. **No hay `cmp …,0x2f` en ninguna parte de la rutina**, ni la
   * salida silenciosa 0xEC de MAINOUT 0x0317. O sea: en pueblo el cactus da «Blocked!»
   * + BEEP como cualquier pared, y el OUCH! no existe. Al compartir `resolveStep` entre
   * las dos capas, poner este flag por geometría pura hacía que el port disparase
   * «OUCH!» + `partyRandomDamage` (una tirada `rand(1,8)` por miembro vivo) donde el
   * binario sólo pita — divergencia por EXCESO, no hueco. La capa es parte de la
   * conducta (#227), así que el flag se apaga aquí, en el productor. #224.
   *
   * ALCANCE MEDIDO (no es teórico): el tile 0x2f sale 16 veces en los 32 small maps y
   * las 16 en SinVraal's Hut (id 15 = posición 14 de `smallmaps.json`), y las 16 tienen
   * vecino ortogonal pisable ALCANZABLE por BFS desde la entrada estándar (15,30) ⇒ la
   * divergencia era disparable en las 16. Ver `re/notes/colas-224-acta.md` §3.
   *
   * ★ La rutina es MAINOUT 0x01FE, y en el ledger se llama `ship_try_move`; el
   * nombre `move_try` que este docblock usaba lo acuñó `cactus-ouch-acta.md` y NO
   * existe en `re/ledger/frontier.json` ⇒ eran DOS nombres vivos para la misma
   * rutina, que es la enfermedad que #178 está curando. Ninguno de los dos describe
   * su dominio: es una etiqueta de ALCANCE heredada (transport.md §7E).
   */
  onCactus: boolean;
}

/**
 * §OCUPACIÓN A PIE — MAINOUT 0x0236-0x0283, la OTRA MITAD del bloque que #282 calcó
 * para la vía naval. `ship_try_move` (MAINOUT 0x01FE) es el resolvedor de destino de
 * TODO paso al aire libre, no sólo de los navales: su único llamador es `outdoor_move`
 * 0x0490, cuyas cuatro ramas de dirección convergen en 0x050e (push de las dos
 * coordenadas) antes del `call 0x1fe`, y ninguna puerta previa excluye el ir a pie —
 * lo delatan además las dos ramas que sólo tienen sentido A PIE: el régimen de abordaje
 * `t < 0x20` (0x0245-0x0251 → 0x0253) y el discriminante de la cola de bloqueo
 * 0x0312 `cmp [g_transport_tile],0x20 / jb 0x322`, que manda al «Blocked!» normal.
 *
 * El binario lee el ACTOR del destino ANTES que el terreno (0x0236 `find_object_at_xy`,
 * kernel 0x368E: barre los slots 1..31 de la tabla de 8 B DS:0x5C62-0x5D5A y devuelve
 * el byte+0 = TILE del actor, 0 si no hay) y, si no es abordable, fuerza `[bp-2]=0`
 * (0x0240). Con `[bp-2]=0` el test de passability del TERRENO **ni se llama**
 * (0x029b `cmp [bp-2],0 / je 0x2b4` salta por delante del `call 0xffffaa7c` de 0x02a8):
 * el ACTOR MANDA SOBRE EL TERRENO. Por eso la consulta va DELANTE del atajo de
 * `isPassable`, igual que en `resolveNavalStep`.
 *
 * Un actor ABORDABLE **no** salta el test de terreno: 0x0283 devuelve `[bp-2]=1` y el
 * flujo cae igualmente en el `call` de passability. O sea avanza sólo si se cumplen LAS
 * DOS (actor abordable-o-ausente Y terreno pisable) — mismo `passable && !blockedByActor`
 * que la vía naval.
 *
 * A PIE NO HAY SALIDA MUDA: el gate del remolino (0x0319-0x0320) vive DETRÁS del umbral
 * de vehículo de 0x0312, así que empujar contra un remolino a pie da «Blocked!» + beep
 * como cualquier pared. Aquí no se añade ninguna rama silenciosa a propósito.
 *
 * ★ ALCANCE — SÓLO EXTERIOR (`map.wraps`). La cola gemela de PUEBLO es `town_move`
 * TOWN.OVL 0x0600, otra rutina: su bloqueo (TOWN 0x083a-0x084c) es print DS 0x26d6 +
 * beep, y la ocupación en pueblo ya la resuelve `npcAtTarget` por otra vía. El gate vive
 * en el PRODUCTOR y no en el llamador — la lección de #224 con `onCactus`.
 *
 * ★ POBLACIÓN — `actorTile` lo resuelve el llamador contra `overworldEnemies`, la MISMA
 * lista que usa `resolveNavalStep`. El binario tiene UNA tabla donde el port tiene DOS
 * (#103: `overworldEnemies` + `state.worldObjects`), así que los objetos aparcados
 * (fragata/caballo/alfombra amarrados) quedan FUERA de esta consulta mientras #103 siga
 * abierta — misma cobertura, ni más ni menos, que el calco naval de #282.
 */
export function resolveStep(
  state: GameState,
  map: ActiveMap,
  dir: Direction,
  actorTile: number = 0,
): StepGeometry {
  const { dx, dy } = DIRECTION_DELTA[dir];
  let nx = state.position.x + dx;
  let ny = state.position.y + dy;
  const base = {
    moved: false,
    blocked: false,
    exitedMap: false,
    message: null as string | null,
    minutes: 0,
    speedClass: 0 as 0 | 1 | 2,
    onBridge: false,
    onSwamp: false,
    onCactus: false,
  };

  if (map.wraps) {
    nx = wrapCoord(nx);
    ny = wrapCoord(ny);
  } else if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) {
    // Salir por el borde de un pueblo: el binario valida la transitabilidad del
    // TILE DE DESTINO (el relleno del viewport, TOWN_EDGE_FILLER_TILE) ANTES de
    // abrir el prompt (TOWN 0x788 → 0x792/0x83a). NO transitable → "Blocked!"
    // (bucle TOWN cobra 1 min, 0x15D4). Transitable → salida sin coste (0x600
    // retorna 0). Ver TOWN_EDGE_FILLER_TILE para el detalle del relleno.
    if (!isPassable(TOWN_EDGE_FILLER_TILE, state.transport)) {
      return { ...base, blocked: true, message: "Blocked!", minutes: MINUTES_PER_ACTION_TOWN };
    }
    return { ...base, exitedMap: true };
  }

  const target = map.tileAt(nx, ny);
  // §OCUPACIÓN (docblock arriba) — el ACTOR se resuelve ANTES que el terreno y su
  // veredicto MANDA: MAINOUT 0x0240 pone `[bp-2]=0` y 0x029f salta por delante del test
  // de passability de 0x02a8. `actorTile === 0` es el centinela «no hay actor» del propio
  // binario (0x023c `or ax,ax / je 0x288`). El modo del jugador es `g_transport_tile`, y
  // a pie el binario lo tiene a 0 (damage_ship 0x1120 lo escribe así al ahogarse): 0 <
  // 0x20 entra en la rama de abordaje de pie/montura/alfombra, que es la que toca.
  const blockedByActor =
    map.wraps && actorTile !== 0 && !isBoardableActorTile(actorTile, state.transportTile ?? 0);
  if (blockedByActor || !isPassable(target, state.transport)) {
    // ¿El obstáculo es un CACTUS? La rama 0x0329 del binario cuelga del TILE DESTINO,
    // no del transporte: tras el «Blocked!» comprueba `cmp [bp-6],0x2f` y, si casa,
    // imprime «OUCH!» y pincha al party en vez de emitir el beep de choque (#157).
    const onCactus = target === TILE_CACTUS;
    if (!map.wraps) {
      // Pueblo: "Blocked!" SÍ consume 1 min (TOWN 0x15D4) → minutes=1. Y `onCactus`
      // queda en FALSE aunque el destino SEA un cactus: la cola de pueblo es
      // `town_move` TOWN 0x083a-0x084c y no tiene el `cmp …,0x2f` de MAINOUT 0x0329 —
      // imprime "Blocked!" (DS 0x26d6) y beepea, sin OUCH! ni daño. #224.
      return {
        ...base,
        blocked: true,
        message: "Blocked!",
        minutes: MINUTES_PER_ACTION_TOWN,
        onCactus: false,
      };
    }
    // Exterior: "Blocked!" NO consume tiempo ni world-turn (MAINOUT 0xC30-0xC36).
    return { ...base, blocked: true, message: "Blocked!", onCactus };
  }

  state.position.x = nx;
  state.position.y = ny;

  if (map.wraps) {
    const speedClass = terrainSpeedClass(target);
    const message =
      speedClass === 1
        ? MISC_ECHO_STRINGS.slowProgress
        : speedClass === 2
          ? MISC_ECHO_STRINGS.verySlow
          : null;
    return {
      ...base,
      moved: true,
      message,
      minutes: MINUTES_PER_ACTION_OUTDOORS,
      speedClass,
      onBridge: (target === 0x6a || target === 0x6b) && state.transport === "foot",
      onSwamp: target === 4 && state.transport === "foot",
    };
  }
  return { ...base, moved: true, minutes: MINUTES_PER_ACTION_TOWN };
}

/** ¿Puede el jugador entrar en una location desde el overworld? */
export function locationAt(
  locationsX: readonly number[],
  locationsY: readonly number[],
  x: number,
  y: number,
): number | null {
  for (let i = 0; i < locationsX.length; i++) {
    if (locationsX[i] === x && locationsY[i] === y) return i + 1; // Location id 1-based
  }
  return null;
}

export type { ActiveMap };
