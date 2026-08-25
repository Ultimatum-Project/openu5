/**
 * Motor de turno de los bucles de contexto exterior/pueblo (Task 3.13).
 *
 * Encapsula el ORDEN EXACTO de consumo de RNG por turno de los dos bucles del
 * binario — el "corazón del stream" — derivado y verificado en
 * task-3.13-derivation-draft.md §1 (pueblo TOWN 0x141E) y §2 (exterior MAINOUT
 * 0x0A84) contra re/disasm/*.OVL.asm. NO mueve monstruos/NPCs (eso vive en
 * game.ts / npc.manager / overworldEnemies); modela el ESQUELETO de RNG del
 * turno para que el arnés de paridad de stream (F.2) lo dirija con una única
 * semilla OriginalRng y verifique la órbita resultante.
 *
 * Cada función devuelve una traza etiquetada de las rands consumidas, en orden,
 * para las aserciones de paridad y los tests.
 */
import type { GameState } from "../../state.js";
import type { Direction } from "../movement.js";
import {
  advanceClock,
  partyRandomDamage,
  turnHousekeeping,
  type RandFn,
  type SkyRefreshCtx,
} from "../survival.js";
import { maybeChangeWind } from "../wind.js";
import { rollSpawnGate, type SpawnRoll } from "./spawn.js";
import {
  underworldHazard,
  bridgeTrollAmbush,
  swampPoison,
  townSwampPoison,
  type TrollAmbushResult,
} from "./hazards.js";

/**
 * Tiles del suelo que mira `post_turn` (TOWN 0x0F02). Los nombres son los de
 * `src/core/data/TileData.json` (datos de Redux), control cruzado de la lectura del asm.
 */
const TRAPDOOR_TILE = 0x8c; // `BrickFloorHole` — 0x0f63 `cmp ax,0x8c`
const SWAMP_TILE = 0x04; // 0x1050 `cmp [bp-8],4`
const FIREPLACE_TILE = 0xbc; // 0x10ac
const LAVA_TILE = 0x8f; // `Lava` — 0x10b3

/** Texto de la trampilla — DS 0x2768, leído del fichero: «A TRAPDOOR!\n». */
export const TRAPDOOR_MESSAGE = "A TRAPDOOR!";

/**
 * Texto del tile que quema. El binario lo emite por DOS punteros DISTINTOS con el
 * MISMO contenido, leídos del fichero (DATA.OVL, fileoff = DS + 0x10):
 *   · pueblo:   DS 0x2780 → b'Burning!\n' (TOWN 0x10bd)
 *   · exterior: DS 0x3a11 → b'Burning!\n' (OUTSUBS 0x05f1, la lava de MAINOUT 0x0C7E)
 * Un solo productor en el port para que las dos vías no puedan derivar por separado.
 */
export const BURNING_MESSAGE = "Burning!";

/**
 * Cota del encadenado de caídas. El binario NO la tiene: su bucle termina solo porque
 * cada caída baja una planta y toda localización con trampillas tiene suelo debajo
 * (medido: Yew z=[-1,0] · Blackthorn z=[-1..3] · Serpent's Hold z=[-1,0,1]; la única con
 * una sola planta es Stonegate, y por eso ES el caso especial). Aquí es una GUARDA
 * anti-cuelgue frente a datos patológicos, no una regla del juego: con datos reales nunca
 * se alcanza, porque `onTrapdoor` devuelve "none" si no hay planta debajo.
 */
const MAX_TRAPDOOR_FALLS = 8;

/**
 * ¿Va la party en ALFOMBRA MÁGICA? — `0x0f6b-0x0f72`: `mov al,[g_transport_tile] /
 * and al,0xfe / cmp al,0x14 / je` ⇒ tiles 0x14 y 0x15. Es el único transporte que
 * sobrevuela la trampilla; a caballo SÍ se cae (y de hecho el binario desmonta:
 * 0x0f86 pone `g_transport_tile = 0` durante la caída y lo restaura en 0x0f90).
 */
function enAlfombra(state: GameState): boolean {
  return ((state.transportTile ?? 0x1c) & 0xfe) === 0x14;
}

/** Una entrada de la traza de RNG del turno (para paridad/tests). */
export interface RngTraceEntry {
  /** Etiqueta del sitio (p.ej. "wind", "spawn", "housekeeping.starve"). */
  site: string;
  /** Rango pedido a rand_range (inclusive). */
  lo: number;
  hi: number;
  /** Valor devuelto. */
  value: number;
}

/**
 * Envuelve un RandFn para registrar cada llamada en `trace`, etiquetada con el
 * `site` activo. El site se fija con `setSite` antes de cada bloque.
 */
function tracingRand(rand: RandFn, trace: RngTraceEntry[]): { rand: RandFn; setSite: (s: string) => void } {
  let site = "?";
  return {
    setSite: (s: string) => {
      site = s;
    },
    rand: (lo: number, hi: number) => {
      const value = rand(lo, hi);
      trace.push({ site, lo, hi, value });
      return value;
    },
  };
}

export interface OutdoorTurnCtx {
  /**
   * ★ #176 — contexto del refresco del LATCH de fases lunares que corre en la cola de
   * `advance_clock` (0x514a-0x5161). Lo produce `Game.skyRefreshCtx`. Sin él el latch
   * no se toca (arneses puros).
   */
  sky?: SkyRefreshCtx;
  /** Tile bajo el jugador (para el umbral de spawn y clasificación). */
  tileUnderParty: number;
  /** El paso quedó BLOQUEADO (MAINOUT 0xC30): sin reloj, sin world-turn. */
  blocked?: boolean;
  /** Minutos del paso (2 base; 4/6 con terreno lento — el caller ya los suma aparte). */
  minutes?: number;
  /** El destino es un puente (tile 0x6A/0x6B) → posible emboscada de trolls. */
  onBridge?: boolean;
  /** El destino es pantano (tile 4) y la party va a pie → veneno. */
  onSwamp?: boolean;
  /**
   * Hook invocado JUSTO DESPUÉS del viento (0x5910) y ANTES del coste base. El
   * caller vivo (game.ts) inyecta aquí los world-turns EXTRA de terreno lento
   * (MAINOUT 0x3E0: `call 0x1A60` × clase, cada uno con su gate rand(1,30) 0x1AA7)
   * para que rueden en su posición exacta del stream: viento → extras → resto.
   * Los arneses puros no lo pasan (undefined → no-op) y la paridad no cambia.
   */
  afterWind?: () => void;
  /**
   * Si true, NO rueda el gate de spawn FINAL (world_turn 0x1A60 @0xD11): el caller
   * lo corre él mismo para envolverlo en el phase-gate de Quickness/montura
   * (0x1A6D) y el placement. Los arneses puros no lo pasan (spawn rueda como antes).
   */
  skipWorldTurn?: boolean;
}

export interface OutdoorTurnResult {
  trace: RngTraceEntry[];
  /** Resultado del gate de spawn del world-turn (null si no corrió world-turn). */
  spawn: SpawnRoll | null;
  /** Emboscada de trolls (null si no había puente). */
  troll: TrollAmbushResult | null;
  /** Índices envenenados por el pantano. */
  poisoned: number[];
  /**
   * ★ #213 — Slots que recibieron el TICK DE VENENO de este turno (`status=='P'` →
   * `kernel_apply_damage(i,1)`, kernel 0x2b36-0x2b40), EN ORDEN DE SLOT. Es el dato
   * que la presentación necesita para calcar la secuencia del original: por cada uno,
   * inversión de su fila del roster + `noise_burst(10,1600,2000)` + des-inversión
   * (0x2a52 @0x2a59/0x2a68/0x2a6e). El daño YA está aplicado; esto es SÓLO el censo
   * para la piel, y no consume RNG (el sonido sortea con el PRNG local `[0x545c]`).
   */
  poisonTicks: number[];
  /** ¿Disparó el hazard del underworld (1/256)? */
  hazard: boolean;
  /**
   * La party acabó el paso SOBRE LAVA (0x8F) → "Burning!" + daño (MAINOUT 0x0C7E).
   * Va en campo propio y no en `messages` porque su mensaje se imprime ANTES que el
   * "EARTHQUAKE!" del hazard: en el asm la lava es 0x0c85 y el hazard 0xcd0.
   */
  burning: boolean;
  /** Mensajes del housekeeping ("Starving!"…). */
  messages: string[];
}

/**
 * Turno del bucle exterior (MAINOUT 0x0A84). ORDEN EXACTO de RNG:
 *   1. VIENTO rand(0,63)                       (tick_and_getkey 0x0B14 → 0x5910)
 *   [dispatch del movimiento — sin RNG salvo cactus, aparte]
 *   2. si BLOCKED → fin (0xC30: sin reloj, sin world-turn)
 *   3. advance_clock(2)                        (0xC39; RNG sólo re-roll SL a medianoche)
 *   4. puente → bridge_troll_ambush            (0xC56)
 *   5. pantano a pie → swamp_poison            (0xC64)
 *   5b. LAVA 0x8F → "Burning!" + rand(1,8)/miembro (0xC7E → OUTSUBS 0x5EE)
 *   6. underworld_hazard rand(0,255)           (0xCD0)
 *   7. turn_housekeeping (hambre/anillo)       (0xCD3)
 *   8. world_turn 0x1A60: SPAWN rand(1,30)     (0xD11 → 0x1AA7)
 *
 * NOTA de fidelidad: el viento va PRIMERO (en la lectura de tecla), ANTES del
 * housekeeping y del spawn. El world-turn no corre con Time-stop ('T').
 */
export function outdoorTurn(state: GameState, rawRand: RandFn, ctx: OutdoorTurnCtx): OutdoorTurnResult {
  const trace: RngTraceEntry[] = [];
  const { rand, setSite } = tracingRand(rawRand, trace);
  const result: OutdoorTurnResult = {
    trace,
    spawn: null,
    troll: null,
    poisoned: [],
    poisonTicks: [],
    hazard: false,
    burning: false,
    messages: [],
  };

  // 1. Viento (getkey 0x5910). Time-stop lo salta (gate [0x5891]).
  if (state.timeSpell !== "T") {
    setSite("wind");
    maybeChangeWind(state, rand);
  }

  // 1b. World-turns EXTRA de terreno lento (0x3E0), tras el viento y antes del
  //     coste base. El caller los corre con su propio gate de spawn (0x1AA7).
  ctx.afterWind?.();

  // 2. Bloqueado: el bucle salta reloj y world-turn (0xC30-0xC36).
  if (ctx.blocked) return result;

  // 3. Coste base del paso (0xC39). advanceClock con el stream vivo: si este
  //    paso cruza medianoche, dispara el re-roll de Shadowlords (kernel 0x4FF5)
  //    ANTES del housekeeping/spawn, como en el binario.
  advanceClock(state, ctx.minutes ?? 2, rand, ctx.sky);

  // 4. Puente → emboscada de trolls (0xC56). El tick de viento interno (0x1C0B,
  // kernel 0x5910 — NO el world_turn 0x1A60) va ENTRE el gate y las tiradas de DEX.
  if (ctx.onBridge) {
    setSite("troll");
    result.troll = bridgeTrollAmbush(state, rand, () => {
      if (state.timeSpell !== "T") {
        setSite("troll.wind");
        maybeChangeWind(state, rand);
        setSite("troll");
      }
    });
  }

  // 5. Pantano a pie → veneno (0xC64, OUTSUBS 0x5FC).
  if (ctx.onSwamp && state.transport === "foot") {
    setSite("swamp");
    result.poisoned = swampPoison(state, rand);
  }

  // 5b. LAVA (0x8F) bajo la party — MAINOUT 0x0C7E `cmp word [bp-0x10],0x8f` /
  //     0x0C83 `jne 0xc8a`. La hermana `0x0C85 call 0xfffff98a` es el STUB CS 0x7b5a,
  //     que dispatch_table.stubs() resuelve a OUTSUBS.OVL:0x05EE — cuatro
  //     instrucciones, tres efectos, en este orden:
  //       05ee call 0xffffb680 → CS 0x5910 viewport_redraw, que en 0x5944 llama a
  //            0x2f62 maybe_change_wind = 1×rand(0,63), gateado por [0x5891] (que
  //            0x591d pone a 0 con g_time_spell=='T') — el MISMO tick que el port ya
  //            corre en el tile de daño de PUEBLO (TOWN 0x10ba, idéntico call).
  //       05f1 mov ax,0x3a11 / 05f5 call print_string → DS 0x3a11 = "Burning!\n"
  //            (DATA.OVL fileoff 0x3a21, leído). UNA vez, no por miembro.
  //       05f8 call 0xffff8818 → CS 0x2aa8 party_random_damage = rand(1,8) por
  //            miembro con i<g_party_size y estado ≠ 'D'.
  //     ★ SIN gate de transporte: a diferencia del pantano (0x0c64 exige
  //     g_transport_tile==0x1c), la lava quema vaya la party como vaya.
  //     Es la MISMA terna del tile de daño de pueblo (TOWN 0x10ac-0x10c4), con otro
  //     puntero de cadena (DS 0x2780) y el mismo texto byte a byte.
  //     El tile sale de `tileUnderParty` (= [bp-0x10], tile_addr(party_x,party_y) en
  //     0x0c4a) y no de un flag del caller: el binario lee el mapa aquí mismo.
  if (ctx.tileUnderParty === LAVA_TILE) {
    if (state.timeSpell !== "T") {
      setSite("burnTick");
      maybeChangeWind(state, rand);
    }
    result.burning = true;
    setSite("burn");
    partyRandomDamage(state, rand);
  }

  // 6. Hazard del underworld (0xCD0): rand(0,255) si floor≠0.
  setSite("hazard");
  result.hazard = underworldHazard(state, rand);

  // 7. Housekeeping (0xCD3): hambre rand(1,8)/miembro + anillo rand(0,7)/portador.
  setSite("housekeeping");
  result.messages = turnHousekeeping(state, rand, (i) => result.poisonTicks.push(i));

  // 8. world_turn 0x1A60: spawn rand(1,30) SIEMPRE (si corre el world-turn).
  //    Con skipWorldTurn el caller lo corre él mismo (phase-gate + placement).
  if (state.timeSpell !== "T" && !ctx.skipWorldTurn) {
    setSite("spawn");
    result.spawn = rollSpawnGate(rand, ctx.tileUnderParty, state.position.floor, state.time.hour);
    // El burst de spawn_monster y el move-loop de monstruos los ejecuta el
    // caller (overworldEnemies) — su RNG va a continuación en el stream.
  }

  return result;
}

/**
 * Tabla de tumbo de la borrachera — DS 0x2742 (DATA.OVL fileoff 0x2752) =
 * {03, 04, 02, 01} en códigos de dirección del getkey (3=N, 4=S, 2=E, 1=O;
 * el wrapper ULTIMA.EXE 0x26a4 mapea ↑/↓/←/→ a 3/4/1/2).
 */
export const DRUNK_STAGGER_DIRS: readonly Direction[] = ["north", "south", "east", "west"];

export interface DrunkRoll {
  /** El gate rand(0,1)==1 disparó: "Hic!" impreso y contador decrementado. */
  hic: boolean;
  /** Dirección del tumbo (tabla 0x2742) — sustituye al comando pulsado. */
  staggerDir?: Direction;
}

/**
 * Rama de borrachera de town_read_command (TOWN 0x0DF2-0x0E27), con [0x5957]≠0:
 *   rand(0,1); si ==1 → dec [0x5957] (0x0E0A) + "Hic!" (DS 0x273C = DATA.OVL
 *   0x274C, 0x0E0E) + rand(0,3) sobre la tabla 0x2742 (0x0E15-0x0E21): el código
 *   devuelto SUSTITUYE al comando leído (el tumbo).
 * NO modelado (divergencia declarada): el `call 0x958` intermedio (0x0E07) — un
 * tick de los 32 objetos de pueblo (0x5F5E) que consume rand(0,255) por objeto
 * activo no-guardia; el port no modela esa tabla viva (misma familia que
 * guard_wander parcial). Ver re/notes/loops.md.
 */
export function drunkConfusionRoll(state: GameState, rand: RandFn): DrunkRoll {
  if (rand(0, 1) !== 1) return { hic: false }; // 0x0E00 gate (50%)
  state.drunkTurns = Math.max(0, (state.drunkTurns ?? 0) - 1); // dec [0x5957] (0x0E0A)
  const staggerDir = DRUNK_STAGGER_DIRS[rand(0, 3)]!; // 0x0E15-0x0E21 tabla 0x2742
  return { hic: true, staggerDir };
}

export interface TownTurnCtx {
  /**
   * ★ #176 — contexto del refresco del LATCH de fases lunares que corre en la cola de
   * `advance_clock` (0x514a-0x5161). Lo produce `Game.skyRefreshCtx`. Sin él el latch
   * no se toca (arneses puros).
   */
  sky?: SkyRefreshCtx;
  /** ¿La tecla consumió turno? (dispatch result != 0). Si no, sólo rueda el viento del getkey. */
  consumesTurn: boolean;
  /** Confusión activa ([0x5957]≠0): town_read_command tira rand(0,1) [+rand(0,3) si remapea]. */
  confused?: boolean;
  /**
   * El caller YA rodó viento + confusión ANTES del desplazamiento (rama de paso
   * BORRACHO de game.move: el remap de la tabla 0x2742 decide la dirección del
   * paso, así que debe tirarse antes de resolverlo — mismo orden del binario:
   * town_read_command 0x0DD0 viento → 0x0DF2 confusión → dispatch). townTurn
   * salta los pasos 1 y 1b para no consumir doble.
   */
  preRolled?: boolean;
  /**
   * El party pisa un tile de daño Fireplace 0xBC / Lava 0x8F: post_turn (TOWN
   * 0x0F02, 10ac-10c4) corre un tick de viento 0x5910 extra, imprime "Burning!"
   * y aplica party_random_damage (rand(1,8)/miembro vivo). Ver
   * re/notes/interactions-piano-fire-audit.md §2.2.
   */
  damageTile?: boolean;
  /** El party pisa pantano (tile 4) a pie: post_turn envenena con rand(0,29)/miembro (NO rand(1,30)). */
  onSwampTile?: boolean;
  /** Segunda llamada a world_turn vía npc_engine ([0x65BF]≠0 o result==2). */
  secondWorldTurn?: boolean;
  /**
   * Hook de `npc_tick_all` (TOWN 0x166E): el movimiento de los NPC de small map
   * (y el consumo de RNG del wander) va JUSTO DESPUÉS del housekeeping/post_turn
   * (y de guard_wander 0x165F, cableado en F.2 — game.ts:2062 → NpcManager.tickGuards)
   * y ANTES del 2º world_turn del
   * npc_engine (0x1683). El caller vivo (game.ts) inyecta aquí el tick del
   * NpcManager para que el wander ruede en su posición exacta del stream. Los
   * arneses puros no lo pasan (undefined → no-op) y la paridad no cambia.
   */
  afterHousekeeping?: () => void;
  /**
   * La tecla del comando fue **ESPACIO (0x20)** = pasar turno. Es la EXCEPCIÓN de la
   * cadena de cadencia de NPC (TOWN 0x162D `cmp [bp-6],0x20 / je 0x1642`): pasando, el
   * filtro de montado no se aplica. `[bp-6]` es la TECLA — se escribe en 0x1495
   * (`push [bp-2] / call 0xdc4 / mov [bp-6],ax`) y sus otras comparaciones en la misma
   * rutina son 0x30 y 0x39 (0x1580/0x1586), o sea '0' y '9'.
   */
  passCommand?: boolean;
  /**
   * Lee el TILE BAJO LA PARTY. Se invoca UNA VEZ POR VUELTA del bucle de peligros
   * (0x0f48-0x10c7), porque una caída por trampilla cambia de planta y el binario re-lee
   * (0x0f53-0x0f60). Si no se pasa, el bucle da una sola vuelta con los flags
   * precalculados `damageTile`/`onSwampTile` — conducta idéntica a la de antes.
   */
  tileUnderParty?: () => number;
  /**
   * Aplica la CAÍDA por trampilla y dice qué pasó: `"fell"` = bajó una planta (0x103c
   * `dec [g_floor]` + recarga 0x1044) y el bucle reengancha; `"tpk"` = rama de Stonegate
   * (0x0fa0-0x1037), que NO reengancha; `"none"` = no había dónde caer (defensivo: con
   * datos reales no ocurre, ver `MAX_TRAPDOOR_FALLS`).
   */
  onTrapdoor?: () => "fell" | "tpk" | "none";
  /**
   * Los DOS toggles de la cadencia de NPC, propiedad del llamador — porque en el binario
   * son LOCALES del bucle principal de pueblo (`[bp-4]` montado y `[bp-0xe]` Quickness),
   * puestos a 0 UNA vez en el prólogo 0x1424-0x1429, antes de la cabeza del bucle 0x142C.
   * Persisten entre turnos DENTRO de la visita al pueblo y se reinician al (re)entrar.
   * Si no se pasan, `townTurn` usa un par nuevo = semántica del PRIMER turno de la visita.
   */
  npcPhases?: TownNpcPhases;
}

/** Los dos toggles de cadencia de NPC de pueblo (TOWN `[bp-4]` y `[bp-0xe]`). */
export interface TownNpcPhases {
  mount: number;
  quickness: number;
}

/**
 * ¿Corre este turno la COLA de NPC del pueblo? — calco de la cadena TOWN 0x161F-0x165D,
 * cuyas tres puertas saltan TODAS al mismo destino 0x1686 («este turno los NPC no actúan»).
 * La cola que gatean son las TRES llamadas del tramo 0x165F-0x1683: `guard_wander` (0xc78),
 * `npc_tick_all` (0xfffff8e2) y el 2º world_turn del `npc_engine` (0x1352).
 *
 * ```
 * 161f cmp [g_transport_tile],0x12 / jb  0x1642   \ MONTADO = rango [0x12,0x16):
 * 1626 cmp [g_transport_tile],0x16 / jae 0x1642   / caballo 0x12/0x13 + ALFOMBRA 0x14/0x15
 * 162d cmp [bp-6],0x20 / je 0x1642                ; ★ tecla ESPACIO = excepción
 * 1633 cmp [bp-4],1 / sbb ax,ax / neg ax          ; toggle (ax = NOT x para x∈{0,1})
 * 163b mov [bp-4],ax / or ax,ax / jne 0x1686      ; ★ montado: uno de cada dos
 * 1642 cmp [g_time_spell],0x54 / je 0x1686        ; ★ 'T' CONGELA (siempre)
 * 1649 cmp [g_time_spell],0x51 …toggle [bp-0xe]…  ; ★ 'Q' MITAD
 * 165d jne 0x1686
 * ```
 *
 * DOS COSAS QUE NO SON OBVIAS Y CAMBIAN EL RESULTADO:
 * · El rango de «montado» es MÁS ANCHO que el `&0xFE==0x12` de caballo puro que usan otras
 *   piezas: aquí entra la ALFOMBRA. No reutilizar aquel predicado.
 * · Los dos toggles usan variables DISTINTAS, así que se COMPONEN (montado + Quickness =
 *   dos filtros encadenados), y el que salta NO avanza el siguiente: si el de montado
 *   salta, el de Quickness no se toca ese turno.
 * Arrancando ambos en 0, el PRIMER turno montado ya salta (toggle 0→1 ⇒ `jne`).
 */
export function townNpcTailRuns(
  state: GameState,
  phases: TownNpcPhases,
  passCommand: boolean,
): boolean {
  const tile = state.transportTile ?? 0x1c;
  if (tile >= 0x12 && tile < 0x16 && !passCommand) {
    phases.mount ^= 1;
    if (phases.mount !== 0) return false;
  }
  if (state.timeSpell === "T") return false;
  if (state.timeSpell === "Q") {
    phases.quickness ^= 1;
    if (phases.quickness !== 0) return false;
  }
  return true;
}

export interface TownTurnResult {
  trace: RngTraceEntry[];
  messages: string[];
  /** Índices envenenados por el pantano de pueblo (rand(0,29)). */
  poisoned: number[];
  /**
   * ★ #213 — Slots que recibieron el TICK DE VENENO de este turno (`status=='P'` →
   * `kernel_apply_damage(i,1)`, kernel 0x2b36-0x2b40), EN ORDEN DE SLOT. Es el dato
   * que la presentación necesita para calcar la secuencia del original: por cada uno,
   * inversión de su fila del roster + `noise_burst(10,1600,2000)` + des-inversión
   * (0x2a52 @0x2a59/0x2a68/0x2a6e). El daño YA está aplicado; esto es SÓLO el censo
   * para la piel, y no consume RNG (el sonido sortea con el PRNG local `[0x545c]`).
   */
  poisonTicks: number[];
}

/**
 * Turno del bucle de pueblo (TOWN 0x141E). ORDEN EXACTO de RNG:
 *   1. town_read_command → world_turn 0x5910: VIENTO rand(0,63) POR TECLA LEÍDA
 *      (incluso teclas que no consumen turno).                     [0x0DD0]
 *   1b. confusión ([0x5957]≠0): rand(0,1); si ==1 remapea → +rand(0,3). [0x0E00/0x0E1C]
 *   [dispatch — arrows/combo/ASCII]
 *   2. si NO consume turno → fin (result==0: sin reloj, sin housekeeping).
 *   3. advance_clock(1)                                            [0x15D4]
 *   4. post_turn 0x0F02:
 *      - despertar: BUCLE sobre el roster, rand(0,15)==0xF por CADA 'S' [0x0F18-0x0F35]
 *      - tile de daño 0xBC/0x8F: tick de viento 0x5910 extra       [0x0F8A/0x10BA]
 *      - pantano (tile 4) a pie: rand(0,29) vs DEX por miembro     [0x108D] — RANGO
 *        DISTINTO del exterior (rand(1,30)); usa townSwampPoison, no swampPoison
 *      - turn_housekeeping (hambre/anillo)                         [0x10D0]
 *   5. guard_wander (RNG propio de TOWN, si hay guardias)          [0x165F]  — cableado F.2
 *   5b. npc_tick_all: wander de NPCs (afterHousekeeping hook)       [0x166E]  — #57
 *   6. 2º world_turn vía npc_engine (condicional): otro VIENTO     [0x1683→0x1376]
 *
 * El viento de PUEBLO es la divergencia que cierra 3.13 (transport.md §4): el
 * clon sólo lo rodaba en overworld. Aquí rueda por tecla. ⚠ La frase «guard_wander
 * queda como esqueleto» de esta nota ERA CIERTA hasta F.2 y quedó rancia al cablearlo:
 * hoy `NpcManager.tickGuards` lo implementa entero (RNG propio incluido) y game.ts:2062
 * lo llama en su posición exacta del stream. El wander
 * (npc_tick_all 0x166E) cae ENTRE housekeeping y el 2º world-turn: consume el
 * stream vivo en el hook `afterHousekeeping`, no al final del turno (#57).
 */
export function townTurn(state: GameState, rawRand: RandFn, ctx: TownTurnCtx): TownTurnResult {
  const trace: RngTraceEntry[] = [];
  const { rand, setSite } = tracingRand(rawRand, trace);
  const messages: string[] = [];
  const poisoned: number[] = [];
  const poisonTicks: number[] = [];

  // 1. Viento por tecla (world_turn #1, 0x0DD0). Time-stop lo salta. preRolled:
  //    el caller (paso borracho de game.move) ya lo consumió antes del paso.
  if (!ctx.preRolled && state.timeSpell !== "T") {
    setSite("wind");
    maybeChangeWind(state, rand);
  }

  // 1b. Confusión en town_read_command: rand(0,1); si ==1 → "Hic!" + dec [0x5957]
  //     + remapea a un paso aleatorio (+rand(0,3) sobre la tabla 0x2742). Para un
  //     paso (move) el caller pre-rueda (preRolled) porque el remap decide la
  //     dirección; los comandos NO-move también pre-ruedan ya vía
  //     Game.commandDrunkIntercept (el intercepto del dispatch, cableado en
  //     main.ts — banco zona-caliente cerrado). Esta rama queda como FALLBACK
  //     para llamadores que consuman turno sin pasar por el dispatch de teclas:
  //     el tumbo consume el MISMO stream pero el comando se ejecuta igual.
  if (ctx.confused && !ctx.preRolled) {
    setSite("confusion");
    const roll = drunkConfusionRoll(state, rand); // 0x0E00 gate; 0x0E1C tabla 0x2742
    if (roll.hic) messages.push("Hic!");
  }

  // 2. Tecla que no consume turno: nada más (result==0).
  if (!ctx.consumesTurn) return { trace, messages, poisoned, poisonTicks };

  // 3. Coste del pueblo (0x15D4). Con el stream vivo: re-roll de Shadowlords si
  //    el turno cruza medianoche (kernel 0x4FF5).
  advanceClock(state, 1, rand, ctx.sky);

  // 4. post_turn 0x0F02.
  // 4a. Despertar: BUCLE sobre TODO el roster (0x0F18 si=0x55b3 … 0x0F35 add
  //     si,0x20; inc di; cmp di,party_size). Por CADA miembro dormido 'S' se tira
  //     rand(0,15)==0xF (1/16) → despierta. (No sólo el miembro 0.)
  for (let i = 0; i < state.partySize && i < 6; i++) {
    if (state.characters[i]?.status === "S") {
      setSite("wake");
      if (rand(0, 15) === 0xf) state.characters[i]!.status = "G";
    }
  }
  // ────────────────────────────────────────────────────────────────────────────────
  // 4b/4c/4d. BUCLE DE PELIGROS DEL SUELO — calco de `post_turn` TOWN 0x0F48-0x10C7.
  //
  // ★ ES UN BUCLE, y eso importa: la cabeza 0x0f48 pone `[bp-2]=0`, la cola 0x10c7 hace
  // `cmp [bp-2],0 / jne → jmp 0xf48`, y el ÚNICO que escribe 1 ahí es la CAÍDA POR
  // TRAMPILLA (0x1047). ⇒ caer sobre otra trampilla te vuelve a hacer caer, EN EL MISMO
  // TURNO, re-leyendo el tile de la planta nueva. El despertar (4a) queda FUERA del bucle
  // (0x0f0a-0x0f45, antes de la cabeza) y por eso no se repite; el housekeeping (0x10d0)
  // va después de la cola y corre UNA vez, se haya caído o no.
  //
  // Orden dentro de cada vuelta, tal cual el binario:
  //   0f63  trampilla 0x8C  →  (alfombra la sobrevuela)  →  caída / TPK
  //   1050  pantano  (tile 4, a pie)
  //   10ac  tile de daño (Fireplace 0xBC / Lava 0x8F)
  // La caída SALTA pantano y daño de esa vuelta (0x104c `jmp 0x10c7`).
  //
  // COMPATIBILIDAD: sin `tileUnderParty` (arneses puros) el bucle da UNA vuelta con los
  // flags precalculados de siempre, así que su conducta no cambia ni un rand.
  const hazardTile = ctx.tileUnderParty;
  for (let vuelta = 0; ; vuelta++) {
    const tile = hazardTile ? hazardTile() : -1;
    const esTrampilla = hazardTile ? tile === TRAPDOOR_TILE : false;
    const esPantano = hazardTile ? tile === SWAMP_TILE : !!ctx.onSwampTile;
    const esDanyo = hazardTile
      ? tile === FIREPLACE_TILE || tile === LAVA_TILE
      : !!ctx.damageTile;

    // 4b-0. TRAMPILLA (0x0f63). La ALFOMBRA MÁGICA la sobrevuela: 0x0f6b-0x0f72
    //       `mov al,[g_transport_tile] / and al,0xfe / cmp al,0x14 / je` ⇒ 0x14/0x15
    //       salen por la misma puerta que «no hay trampilla». Sin RNG en toda la rama.
    if (esTrampilla && !enAlfombra(state) && ctx.onTrapdoor) {
      messages.push(TRAPDOOR_MESSAGE); // 0x0f77, DS 0x2768
      const desenlace = ctx.onTrapdoor();
      // 0x1047 `[bp-2]=1` SÓLO en la caída normal; el TPK de Stonegate cae a 0x10c7 con
      // `[bp-2]` todavía a 0 ⇒ NO reengancha (y menos mal: su mapa acaba de quedar todo
      // lava, que si no dispararía el tile de daño en bucle).
      if (desenlace === "fell" && vuelta < MAX_TRAPDOOR_FALLS) continue;
      break;
    }

    // 4c. Pantano de pueblo (tile 4) a pie: rand(0,29) vs DEX (RANGO DISTINTO del exterior).
    if (esPantano && state.transport === "foot") {
      setSite("swampTown");
      poisoned.push(...townSwampPoison(state, rand));
    }
    // 4b. Tile de daño Fireplace 0xBC / Lava 0x8F (TOWN 0x0F02, 10ac-10c4). ORDEN asm:
    //     tick de viento 0x5910 (10ba) → "Burning!" (10bd, str DS:0x2780) →
    //     party_random_damage rand(1,8)/miembro vivo (10c4, kernel 0x2AA8). El tick de
    //     viento se salta con Time-stop (como el world_turn); el daño se aplica igual.
    if (esDanyo) {
      if (state.timeSpell !== "T") {
        setSite("damageTick");
        maybeChangeWind(state, rand);
      }
      messages.push(BURNING_MESSAGE);
      setSite("burn");
      partyRandomDamage(state, rand);
    }
    break; // 0x10c7 con [bp-2]==0: sale del bucle
  }
  // 4d. Housekeeping (0x10D0).
  setSite("housekeeping");
  messages.push(...turnHousekeeping(state, rand, (i) => poisonTicks.push(i)));

  // ★ 4e. PUERTA DE CADENCIA DE NPC (TOWN 0x161F-0x165D) — gatea TODA la cola de abajo,
  //     que es exactamente el tramo 0x165F-0x1683 del binario. Ver `townNpcTailRuns`.
  //     Antes NO existía: el port corría el wander SIEMPRE y sólo se saltaba el 2º viento
  //     bajo Time-stop ⇒ con 'T' los NPC del pueblo seguían deambulando (y montado se
  //     movían cada turno en vez de uno de cada dos).
  const npcTail = townNpcTailRuns(
    state,
    ctx.npcPhases ?? { mount: 0, quickness: 0 },
    ctx.passCommand ?? false,
  );

  if (npcTail) {
    // 5. guard_wander (0x165F) — cableado con la tabla de objetos del pueblo → F.2.

    // 5b. npc_tick_all (0x166E): wander de NPCs. ORDEN exacto: cae AQUÍ, tras
    //     housekeeping (y guard_wander) y ANTES del 2º world_turn del npc_engine
    //     (0x1683). El wander consume el stream vivo desde este punto (#57).
    //     ⚠️ GATE aproximada: el binario salta npc_tick_all con result>=2
    //     (0x1662 jge 0x1671) pero igual dispara el 2º world_turn; consumesTurn
    //     (result!=0) no distingue 1 vs >=2 → mismo residuo getkey-level del 2º
    //     world-turn heurístico (F.2). Ver deliberate-divergences.md §2.
    ctx.afterHousekeeping?.();

    // 6. 2º world_turn (npc_engine 0x1683→0x1376): otro viento cuando [0x65BF]≠0 o
    //    result==2. El gate de Time-stop que había aquí es ahora REDUNDANTE (la puerta
    //    0x1642 ya no deja llegar con 'T'); se conserva por claridad del call-site.
    if (ctx.secondWorldTurn && state.timeSpell !== "T") {
      setSite("wind2");
      maybeChangeWind(state, rand);
    }
  }

  return { trace, messages, poisoned, poisonTicks };
}
