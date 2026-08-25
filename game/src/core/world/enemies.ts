/**
 * Enemigos errantes del overworld/underworld (map units). El world-turn del
 * binario (MAINOUT 0x1A60) los gobierna:
 * - spawn SÓLO cuando el gate exacto disparó (`shouldSpawn`, rollSpawnGate:
 *   rand(1,30) vs spawn_threshold) — el 1/16 inventado se eliminó (F.2),
 * - colocación por pick_spawn_coords (2×rand(0,31), re-roll por distancia >6 en
 *   ambos ejes, 0x0F4E; pasabilidad decidida después, en spawn_monster),
 * - limpieza de enemigos a >22 tiles (con wrap),
 * - persecución: un paso codicioso hacia el Avatar por turno.
 */
import type { GameState } from "../state.js";
import {
  RECYCLE_SLOT_LO,
  RECYCLE_SLOT_HI,
  composeWorldPool,
  acquireActorSlot,
  type PoolSlotView,
} from "./actorPool.js";
import { tileInfo } from "../tiles.js";
import type { RandFn } from "./survival.js";
import { pickSpawnCoords } from "./loops/spawn.js";
import { gemChunkOrigin } from "./chunk-origin.js";
import type { ActiveMap } from "./map.js";
import {
  HULL_MAX,
  DERELICT_FRIGATE_TILE,
  PIRATE_PRIZE_SKIFFS,
  sinkPlayerShip,
  transportMode,
} from "./transport.js";

/** defIndex de los dos únicos actores con ATAQUE A DISTANCIA en overworld (MAINOUT
 *  0x13A2 `cmp [bp-0xa],0x88`/`0xDC`): byte+0 del slot = `def.tile-0x100`, y
 *  `def.tile = 0x140 + defIndex*4` ⇒ 0x88→def 18 (Sea Serpent), 0xDC→def 39 (Dragon). */
const SEA_SERPENT_DEF_INDEX = 18;
const DRAGON_DEF_INDEX = 39;

export interface OverworldEnemy {
  /**
   * Índice de SLOT en la tabla de 32 actores del binario (DS:0x5C5A / .gam 0x6B4,
   * stride 8). ES el identificador de tabla del DOS, no un contador del port:
   * el spawn lo asigna por PRIMER-HUECO-ASCENDENTE en el pool 1..23 (kernel
   * `alloc_actor_slot` 0x38E4 → escáner 0x3868, re/notes/overworld-ai-rng.md), y
   * el turno itera los slots 31→1 DESCENDENTE (MAINOUT 0x1AB6) — ese orden fija el
   * orden de consumo de RNG del movimiento. Persistir el enemigo en su slot nativo
   * = tarea #57 (este campo ya deja el terreno listo). Opcional sólo por compat con
   * saves/fixtures legacy sin él: el tick hace backfill first-hole-ascending (mismo
   * criterio que el binario), así que en runtime SIEMPRE es el índice de tabla real.
   */
  slot?: number;
  /** Índice en la tabla de 48 enemigos. */
  defIndex: number;
  /** Tile del sprite para el render. */
  tile: number;
  /** ¿Se mueve por agua (serpientes, piratas) en vez de por tierra? */
  water: boolean;
  x: number;
  y: number;
  /**
   * Casco de la nave NPC de vela (pirata) — objeto del mundo tabla 0x5C5A +5
   * (re/notes/transport.md §0/§7C). Sólo lo llevan los objetos-nave; undefined =
   * el enemigo no es una fragata (no aplica el broadside). Lo consume Fire (F).
   */
  hull?: number;
  /** Bit de fase del remolino (0xEC, DS actor +5 = 0x5C5F): alterna cada turno que se
   * procesa; sólo se mueve en el turno ON (MAINOUT 0x19AD). */
  phase?: number;
  /** Contador de cadencia de viento de la nave pirata (DS actor +7 = 0x5C61). */
  windCtr?: number;
}

/**
 * Sprite-tile del REMOLINO: `EnemyDef.index` 43 → `def.tile` 0x1EC (el pick guarda
 * ese tile en `enemy.tile`). El binario despacha el remolino por su SPRITE
 * (`base & 0xFC == 0xEC`, MAINOUT 0x19AD), no por la ID de encuentro ni el índice
 * de tabla. Anclamos al TILE (no a un número mágico): comparar `defIndex` contra
 * 0xEC — la ID de encuentro de encounters.ts, NO el índice de tabla 43 — era el
 * bug #63: nunca casaba y el remolino caía al chase genérico. Ver `isWhirlpool`.
 */
const WHIRLPOOL_TILE = 0x1ec;

/** ¿El actor es un remolino? Igual que el binario: máscara de frame `& 0xFC` sobre
 *  el sprite y compara con el grupo del remolino (0xEC). MAINOUT 0x19AD. */
export function isWhirlpool(enemy: OverworldEnemy): boolean {
  return (enemy.tile & 0xfc) === (WHIRLPOOL_TILE & 0xfc);
}

export interface EnemyPick {
  defIndex: number;
  tile: number;
  water: boolean;
  /** Casco inicial de la nave NPC de vela (pirata), si el pick lo es (obj+5). */
  hull?: number;
}

export interface EnemyTickOptions {
  /** Elige enemigo para un tile de spawn (null = ninguno encaja). */
  picker: (tile: number) => EnemyPick | null;
  /** Stream vivo (rand entero inclusivo), no float: el placement lo consume. */
  rand: RandFn;
  maxEnemies?: number;
  /**
   * Decisión de spawn EXACTA del world-turn 0x1A60 (rollSpawnGate: rand(1,30)
   * vs spawn_threshold por bioma/planta/hora), ya rodada por outdoorTurn. Es la
   * ÚNICA vía de spawn: el gate inventado 1/16 se eliminó (F.2). Sin `shouldSpawn`
   * no hay spawn (el placement sólo rueda cuando el gate dispara).
   */
  shouldSpawn?: boolean;
}

const CLEANUP_DISTANCE = 22;
const MAX_ENEMIES_DEFAULT = 8;

/** Pool de slots que usa el spawn de monstruos errantes (kernel 0x3868 escanea
 * cx=1..0x17). El slot 0 (avatar) y 24..31 (transporte/otros) no los toca el spawn.
 * ÚNICA fuente de la geometría: el módulo del pool unificado (#103). */
const SPAWN_SLOT_LO = RECYCLE_SLOT_LO;
const SPAWN_SLOT_HI = RECYCLE_SLOT_HI;

// ── Persistencia nativa (task #57): mapeo defIndex↔tile↔agua ────────────────────
// El byte +0 del registro de 8 B en la tabla 0x6B4 es `def.tile − 0x100` (place_actor
// kernel 0x3A74; encounters.ts:240; re/notes/native-persist-enemies.md). Estas consts
// espejan `buildEnemyDefs` de combat/enemies.ts (`tile = i===8 ? 300 : 320 + i*4`) —
// LOCALES para no cruzar el boundary world↔combat; ancladas a esa fuente por
// save-native-enemies.test.ts (patrón AMBUSH_TABLE).
const ENEMY_SPRITE_BASE = 320; // N_FIRST_SPRITE
const ENEMY_SPRITE_STRIDE = 4; // N_FRAMES_PER_SPRITE
const ENEMY_DEF_COUNT = 48;

/** Índice del pirata (nave NPC de vela) en la tabla de 48 = PIRATE_SHIP_NUMBER. Único
 * enemigo con casco (+5) y contador de viento (+7) en el registro nativo. */
export const PIRATE_ENEMY_DEF_INDEX = 8;
/** Sprite-tile del pirata (banco alto) = PIRATE_SHIP_SPRITE; su byte +0 = 0x2C. */
const PIRATE_ENEMY_TILE = 300;

/** Rango de slots de la tabla nativa 0x6B4 que ocupa el pool de monstruos (1..23). */
export const OVERWORLD_ENEMY_SLOT_LO = SPAWN_SLOT_LO;
export const OVERWORLD_ENEMY_SLOT_HI = SPAWN_SLOT_HI;

/** Índices de la tabla de 48 con `IsWaterEnemy=true` (AdditionalEnemyFlags.json): pirata
 * (8) + seahorse/squid/seaserpent/shark (16..19) + remolino (43). El .gam NO guarda un
 * bit de agua (el DOS despacha la pasabilidad por clase de tile en move_one); en la carga
 * nativa `water` se re-deriva de aquí. Anclado a la JSON por save-native-enemies.test.ts. */
export const WATER_ENEMY_DEF_INDICES: ReadonlySet<number> = new Set([8, 16, 17, 18, 19, 43]);

/** ¿El enemigo de este defIndex se mueve por agua? (deriva nativa de `water`). */
export function isWaterEnemyDef(defIndex: number): boolean {
  return WATER_ENEMY_DEF_INDICES.has(defIndex);
}

/**
 * #35 — LA NAVE DEL PIRATA SE QUEDA AL VENCERLO. Función PURA: devuelve los campos del
 * objeto-mundo que hay que empujar, o `null` si no procede; el call-site decide y añade el
 * banco al tile (mismo patrón que `rollRingExpiry` / `chestTrap` / el `parkedShipTile`
 * del desembarco).
 *
 * Clon de la rama de VICTORIA de `SJOG.OVL 0x2078-0x20c3`, leída byte a byte: con
 * `g_cmb_victory_flag` puesto (`0x208b`) y tile de nave NPC (`0x2094` `and 0xfc` / `cmp
 * 0x2c`), el binario **no borra el registro** — lo transforma in situ: `0x209c`/`0x209f`
 * restan 8 a los dos tiles, `0x20a3` pone casco **99** y `0x20a7` **dos** esquifes.
 *
 * ⚠ El casco es `HULL_MAX` (99) y **no** `PIRATE_SHIP_HULL` (100): el 100 es el casco del
 * pirata VIVO y `0x20a3` lo pisa incondicionalmente al capturarlo. Ver la corrección del
 * comentario de `PIRATE_SHIP_HULL` en transport.ts — decía que la capturada excedía el tope
 * del jugador, y es falso.
 *
 * Cabo del original que NO replicamos: la rama SIN victoria (`0x20ae`) pone a cero **5 de
 * los 8 bytes**, dejando casco y esquifes RANCIOS en la ranura. El clon no tiene tabla
 * nativa que ensuciar; queda anotado por si alguien lee esos bytes de un save.
 */
export function piratePrizeShip(
  enemy: Pick<OverworldEnemy, "defIndex" | "x" | "y">,
  at: { location: number; floor: number },
): {
  location: number;
  floor: number;
  x: number;
  y: number;
  /** CRUDO, sin banco: el call-site suma `ACTOR_TILE_BANK`. */
  tile: number;
  kind: "ship";
  hull: number;
  skiffs: number;
} | null {
  if (enemy.defIndex !== PIRATE_ENEMY_DEF_INDEX) return null; // 0x2094 `cmp al,0x2c`
  return {
    location: at.location,
    floor: at.floor,
    x: enemy.x,
    y: enemy.y,
    tile: DERELICT_FRIGATE_TILE,
    kind: "ship",
    hull: HULL_MAX, // 0x20a3 `mov byte [bx+5], 0x63`
    skiffs: PIRATE_PRIZE_SKIFFS, // 0x20a7 `mov byte [bx+7], 2`
  };
}

/** Sprite-tile (banco alto 0x100+) del enemigo con este defIndex 0..47. */
export function enemyDefIndexToTile(defIndex: number): number {
  return defIndex === PIRATE_ENEMY_DEF_INDEX
    ? PIRATE_ENEMY_TILE
    : ENEMY_SPRITE_BASE + defIndex * ENEMY_SPRITE_STRIDE;
}

/** Inverso: defIndex 0..47 desde el sprite-tile, o `null` si `tile` no es de un enemigo
 * conocido (NPC/objeto). El byte +0 del slot nativo es `tile − 0x100`. */
export function enemyTileToDefIndex(tile: number): number | null {
  if (tile === PIRATE_ENEMY_TILE) return PIRATE_ENEMY_DEF_INDEX;
  const d = tile - ENEMY_SPRITE_BASE;
  if (d < 0 || d % ENEMY_SPRITE_STRIDE !== 0) return null;
  const i = d / ENEMY_SPRITE_STRIDE;
  return i >= 0 && i < ENEMY_DEF_COUNT ? i : null;
}

function wrapDelta(a: number, b: number, size: number): number {
  let d = a - b;
  if (d > size / 2) d -= size;
  if (d < -size / 2) d += size;
  return d;
}

/**
 * La vista compuesta del pool para el SOBREMUNDO (#103): errantes + objetos del
 * mundo (fragatas/caballos aparcados, botín, cofres) sobre la MISMA tabla de 32
 * ranuras, como en el binario. Asigna y PERSISTE ranura a quien no la traiga
 * (errantes: primer hueco ascendente 1..23; objetos: 31→1 de find_free_actor_slot).
 */
function overworldPoolView(state: GameState, enemies: OverworldEnemy[]): PoolSlotView[] {
  return composeWorldPool({
    location: 0,
    floor: state.position.floor ?? 0,
    enemies,
    objects: state.worldObjects,
  });
}

export class OverworldEnemies {
  /**
   * El GameState es el almacén AUTORITATIVO de la lista (campo `overworldEnemies`,
   * persistido en el save igual que `openDoors` lo es para DoorManager). Este
   * manager no guarda su propia copia: lee/escribe la lista viva del estado vía el
   * getter/setter `enemies`, de modo que save/load la conservan sin código de
   * sincronización por-turno (fix #49: antes era un campo de clase y se evaporaba).
   */
  private state: GameState | null = null;

  /** Mensajes producidos por el ataque a distancia de una serpiente/dragón durante el
   *  tick (hundimiento de la nave). El disparo NO inicia combate (tick devuelve null),
   *  así que sus mensajes se drenan aparte con `takeRangedFireMessages` (los envuelve
   *  `outdoorWorldTurn`). El daño de casco silencioso no produce mensaje (fiel: 0x109E
   *  sólo imprime al hundir). */
  private rangedFireMessages: string[] = [];

  /** Drena (y limpia) los mensajes del disparo de serpiente/dragón de este tick. */
  takeRangedFireMessages(): string[] {
    const out = this.rangedFireMessages;
    this.rangedFireMessages = [];
    return out;
  }

  /**
   * Vincula el GameState como almacén de la lista de enemigos (idempotente).
   * Lo llama el constructor de Game tras fijar `this.state`; el load reusa el
   * mismo objeto GameState (mutado in-place por Object.assign), así que no hace
   * falta re-vincular al cargar. Sin vincular, `enemies` cae a lista vacía.
   */
  bind(state: GameState): void {
    this.state = state;
    state.overworldEnemies ??= [];
  }

  /** Lista viva de enemigos (la del GameState vinculado). */
  get enemies(): OverworldEnemy[] {
    return this.state?.overworldEnemies ?? [];
  }
  set enemies(list: OverworldEnemy[]) {
    if (this.state) this.state.overworldEnemies = list;
  }

  /**
   * Vacía la pool de monstruos errantes del overworld. Espeja el `memset` de la tabla de
   * objetos que el binario hace al ENTRAR a una localización persistente (pueblo/keep/
   * dwelling/mazmorra): `MAINOUT.OVL 0x0857` limpia los 0x100 B de 0x5C5A antes de cargar
   * los NPCs de la localización (witness O1, re/notes/witness-o1-0x6b4.md §3). Así los
   * monstruos overworld NO sobreviven una visita a interior: al volver al overworld la pool
   * arranca vacía y el spawn los RESEED-ea frescos, igual que el original. NO se llama en el
   * camino de combate (arena aparte: el binario preserva la pool a través del combate).
   */
  clear(): void {
    if (this.state) this.state.overworldEnemies = [];
  }

  /** Un tick por turno del jugador en large map. Devuelve el enemigo que inicia combate (si toca al Avatar). */
  tick(
    state: GameState,
    map: ActiveMap,
    opts: EnemyTickOptions,
  ): OverworldEnemy | null {
    // El tick opera sobre la lista del `state` recibido; si aún no hay vínculo
    // (uso aislado en tests), enlaza aquí. Game ya vincula en su constructor con
    // el mismo objeto, así que esto es un no-op en el juego real.
    if (!this.state) this.bind(state);
    this.rangedFireMessages = [];
    const px = state.position.x;
    const py = state.position.y;

    // 1. Limpieza de lejanos
    this.enemies = this.enemies.filter((e) => {
      const dx = Math.abs(wrapDelta(e.x, px, map.width));
      const dy = Math.abs(wrapDelta(e.y, py, map.height));
      return Math.max(dx, dy) <= CLEANUP_DISTANCE;
    });

    // 2. Spawn: SÓLO si el gate exacto del world-turn (opts.shouldSpawn) disparó.
    const maxEnemies = opts.maxEnemies ?? MAX_ENEMIES_DEFAULT;
    if (this.enemies.length < maxEnemies && opts.shouldSpawn) {
      this.trySpawn(state, map, opts);
    }

    // 3a. Backfill de slot para enemigos legacy (saves/fixtures sin él): la vista
    //     compuesta del pool (#103) asigna first-hole ascendente 1..23 (kernel 0x3868)
    //     SALTANDO las ranuras de los objetos del mundo (antes eran invisibles y el
    //     backfill se las pisaba). Tras esto todos tienen slot real → el orden de
    //     iteración es determinista.
    overworldPoolView(state, this.enemies);
    for (const e of this.enemies) {
      if (e.slot === undefined) e.slot = 0; // pool lleno: fuera de tabla (como antes)
    }

    // 3b. Movimiento por CLASE de tile, en orden de SLOT DESCENDENTE 31→1 (MAINOUT
    //     0x1AB6) — ese orden fija el consumo de RNG. Cada actor: acción especial
    //     (melé/ranged) o move_one (0x198C) según clase. Contacto/ataque = combate.
    const bySlotDesc = [...this.enemies].sort((a, b) => (b.slot ?? 0) - (a.slot ?? 0));
    for (const enemy of bySlotDesc) {
      if (!this.enemies.includes(enemy)) continue; // pudo limpiarse
      const attacker = this.moveActor(enemy, map, px, py, opts.rand);
      if (attacker) return attacker;
    }
    return null;
  }

  /**
   * move_one_actor (MAINOUT 0x198C) para UN actor, consumiendo RNG del stream vivo
   * exactamente como el binario. Devuelve el enemigo si inicia combate (melé/contacto),
   * o null. Orden de rand derivado en re/notes/overworld-ai-rng.md (EMPÍRICO para el
   * genérico vía captura 2; ESTÁTICO citado para remolino/pirata).
   */
  private moveActor(
    enemy: OverworldEnemy,
    map: ActiveMap,
    px: number,
    py: number,
    rand: RandFn,
  ): OverworldEnemy | null {
    const dx = wrapDelta(px, enemy.x, map.width);
    const dy = wrapDelta(py, enemy.y, map.height);
    // acción especial 0x131A: melé si ORTOGONAL-adyacente (0x137E: (1,0) o (0,1)),
    // SIN rand, y OMITE el move. (El diagonal-adyacente NO es melé: persigue.)
    if ((Math.abs(dx) === 1 && dy === 0) || (dx === 0 && Math.abs(dy) === 1)) {
      return enemy;
    }
    // Acción especial 0x131A rama a-distancia (MAINOUT 0x13A2): SÓLO Sea Serpent (def 18)
    // y Dragon (def 39). Si NO es melé-adyacente (arriba) y |dx|≤3 && |dy|≤3, tira
    // rand(0,7); ==0 (1/8) → dispara al party (0x13D6) y OMITE el move; !=0 → cae al
    // movimiento normal. Fuera de rango 3 → SIN rand (0x13B3/0x13BC saltan a return 0
    // antes del rand). El rand se consume tras el melé y antes del dispatch de movimiento,
    // igual que 0x131A precede a 0x198C. re/notes/serpent-ranged-derivation.md.
    if (
      (enemy.defIndex === SEA_SERPENT_DEF_INDEX || enemy.defIndex === DRAGON_DEF_INDEX) &&
      Math.abs(dx) <= 3 &&
      Math.abs(dy) <= 3
    ) {
      if (rand(0, 7) === 0) {
        this.fireRangedAtParty(rand);
        return null; // 0x131A devolvió 1 → OMITE el move de este actor
      }
      // rand != 0 (7/8): cae al movimiento normal (no return)
    }
    // Remolino (0x198C rama 0x19AD): phase-bit alterna; turno OFF = no mueve,
    // SIN rand. Turno ON = rand(0,1) modo: 1→chase, 0→deriva. [ESTÁTICO 0x19BE]
    // Se despacha por el SPRITE (isWhirlpool), no por defIndex==0xEC (bug #63).
    if (isWhirlpool(enemy)) {
      enemy.phase = (enemy.phase ?? 0) ^ 1;
      if (enemy.phase === 0) return null;
      const mode = rand(0, 1);
      if (mode === 0) {
        this.drift(enemy, map, rand);
        return null;
      }
      return this.chase(enemy, map, px, py, rand);
    }
    // Pirata 0x2C (0x198C rama 0x1A07): cadencia por VIENTO (sin rand); si le toca,
    // chase. [ESTÁTICO — tabla 0x2BF6; si la paridad chirría aquí → captura 3.]
    if (enemy.hull !== undefined) {
      if (!this.pirateMovesThisTurn(enemy)) return null;
      return this.chase(enemy, map, px, py, rand);
    }
    // Genérico (tierra/mar) → chase 0x17D4 [EMPÍRICO, captura 2].
    return this.chase(enemy, map, px, py, rand);
  }

  /**
   * Disparo a distancia de Sea Serpent/Dragon (pipeline MAINOUT 0x13D6). El DAÑO es
   * 0x109E: SÓLO daña si el party navega en FRAGATA (g_transport_tile 0x20-0x27 =
   * transport "ship"); rand(1,30) al CASCO (g_char_anim_states+5 = `shipHull`), y si el
   * daño IGUALA o supera el casco (0x10BE) la nave se hunde/degrada. A pie/caballo/skiff
   * NO hay daño NI rand (0x10A4-10AD → 0x1160). El hundimiento reusa `sinkPlayerShip`
   * (skiff → carpet[+rand(0,1) del facing] → ahogo), el MISMO que el daño de navegación,
   * y NO toca el casco (el `sub g_hull` sólo corre en la rama de supervivencia; al hundir,
   * damage_ship deja g_hull intacto — transport.md §7E). Es el «Sea Serpent mece el barco».
   *
   * ⚠ CLASE-C (en cola de witness de oráculo, ver re/notes/serpent-ranged-derivation.md
   * §witness): el pipeline llama además a `0x7bea` (`lcall 0x72E:0x2EC`, thunk far
   * reubicado en carga, OPACO al disasm estático) ANTES del daño (0x1420). Se ASUME que
   * NO consume rand del stream de MOVIMIENTO (candidato a render/anim del proyectil, un
   * stream separado ya modelado por `tileprog.ts`). Si el witness lo desmiente, su
   * consumo va AQUÍ, entre el `rand(0,7)` de la compuerta y el `rand(1,30)` del casco. El
   * sonido (0x43AE) y la animación del proyectil no se portan (sin equivalente en el port).
   */
  private fireRangedAtParty(rand: RandFn): void {
    if (!this.state || this.state.transport !== "ship") return; // 0x10A4: sólo fragata
    const dmg = rand(1, 30); // 0x10B0: rand_range(1,30) al casco
    const hull = this.state.shipHull ?? HULL_MAX;
    if (dmg < hull) {
      this.state.shipHull = hull - dmg; // 0x10C8: el casco aguanta
      return;
    }
    // Casco agotado (0x10D6): hunde/degrada. `sinkPlayerShip` tira el rand(0,1) del facing
    // SÓLO si cae a alfombra (en orden de stream). El casco NO se toca al hundir.
    const sink = sinkPlayerShip(
      this.state.transportTile ?? 0x24, // fragata (facing 0) si no hubiera tile explícito
      this.state.shipSkiffs ?? 0,
      this.state.magicCarpets ?? 0,
      rand,
    );
    this.state.magicCarpets = sink.carpets;
    this.state.transportTile = sink.transportTile;
    this.state.transport = transportMode(sink.transportTile);
    for (const m of sink.messages) this.rangedFireMessages.push(m);
  }

  /**
   * chase 0x17D4: rand(0,1) elige ORDEN DE EJE (1→X primero, 0→Y primero — captura 2,
   * push (1,0) en 0x18B5); prueba el paso hacia el party en ese eje, si no el otro; si
   * AMBOS bloqueados → deriva ortogonal 0x16FC (rand(0,3)). Contacto = combate.
   */
  private chase(
    enemy: OverworldEnemy,
    map: ActiveMap,
    px: number,
    py: number,
    rand: RandFn,
  ): OverworldEnemy | null {
    const dx = wrapDelta(px, enemy.x, map.width);
    const dy = wrapDelta(py, enemy.y, map.height);
    const xFirst = rand(0, 1) === 1;   // SIEMPRE consume 1 rand (0x18B5)
    const xStep: [number, number] = [Math.sign(dx), 0];
    const yStep: [number, number] = [0, Math.sign(dy)];
    const order = xFirst ? [xStep, yStep] : [yStep, xStep];
    for (const [sx, sy] of order) {
      if (sx === 0 && sy === 0) continue; // ese eje ya alineado
      const nx = (enemy.x + sx + map.width) % map.width;
      const ny = (enemy.y + sy + map.height) % map.height;
      if (nx === px && ny === py) return enemy; // contacto = combate
      if (this.canEnter(enemy, map, nx, ny)) {
        enemy.x = nx;
        enemy.y = ny;
        return null;
      }
    }
    // ambos pasos hacia el party bloqueados → fallback de deriva (0x16FC)
    this.drift(enemy, map, rand);
    return null;
  }

  /** deriva ortogonal aleatoria 0x16FC: rand(0,3) → N/E/S/O; mueve si pasable, si no
   * se queda (el bucle de reintento del binario es código muerto). */
  private drift(enemy: OverworldEnemy, map: ActiveMap, rand: RandFn): void {
    const dir = rand(0, 3); // 0=N,1=E,2=S,3=O
    const d: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const [sx, sy] = d[dir]!;
    const nx = (enemy.x + sx + map.width) % map.width;
    const ny = (enemy.y + sy + map.height) % map.height;
    if (this.canEnter(enemy, map, nx, ny)) {
      enemy.x = nx;
      enemy.y = ny;
    }
  }

  /** Cadencia por viento de la nave pirata (0x2BF6[facing][wind], contador). ESTÁTICO:
   * sin captura de movimiento del pirata (no se movió en captura 2). Modelo conservador
   * hasta captura 3: en calma (wind 0) no mueve; con viento mueve. TODO #37/captura 3. */
  private pirateMovesThisTurn(enemy: OverworldEnemy): boolean {
    const wind = this.state?.wind ?? 0;
    if (wind === 0) return false;
    enemy.windCtr = ((enemy.windCtr ?? 0) + 1) & 0xff;
    return true;
  }

  removeEnemy(enemy: OverworldEnemy): void {
    this.enemies = this.enemies.filter((e) => e !== enemy);
  }

  private canEnter(enemy: OverworldEnemy, map: ActiveMap, x: number, y: number): boolean {
    if (this.enemies.some((e) => e.x === x && e.y === y)) return false;
    const tile = map.tileAt(x, y);
    if (tile < 0) return false;
    const info = tileInfo(tile);
    return enemy.water ? info.waterEnemyPassable : info.landEnemyPassable;
  }

  private trySpawn(state: GameState, map: ActiveMap, opts: EnemyTickOptions): void {
    const { rand, picker } = opts;
    // ── SONDA de la ficha #31 (medición, NO comportamiento) ────────────────────
    // Registra `k = (party − chunk_origin) & 0xff` por intento de spawn. El binario
    // sortea `x = rand(0,0x1f) + g_chunk_origin_x` y compara contra g_party_x, así que
    // `k` es el ancla real; el port la tiene CLAVADA en 16 (ver `pickSpawnCoords`).
    // Sólo escribe si alguien instaló el sumidero (`armSpawnLog`, opt-in del tour):
    // sin él esto es UNA lectura de propiedad y el camino queda idéntico al de main.
    // ORIGEN REAL de la ventana de chunks (g_chunk_origin_x/y). `gemChunkOrigin`
    // devuelve el MANTENIDO si sigue fresco y lo re-deriva si no — la misma política
    // que el binario, que re-deriva al cargar mapa. Ficha #31.
    const origin = gemChunkOrigin(state.chunkOrigin, state.position.x, state.position.y);
    const sink = (globalThis as { __u5spawnK?: number[] }).__u5spawnK;
    if (sink) {
      sink.push(
        (state.position.x - origin.x) & 0xff,
        (state.position.y - origin.y) & 0xff,
      );
    }
    // Coords por pick_spawn_coords (MAINOUT 0x0F4E): 2×rand(0,31) por intento,
    // compuestas con el ORIGEN y filtradas por distancia ≥7 EN EL TORO (las dos
    // mitades). Sin pasabilidad en el bucle.
    const spot = pickSpawnCoords(
      rand,
      state.position.x,
      state.position.y,
      map.width,
      map.height,
      origin,
    );
    if (!spot) return;
    // La pasabilidad la decide spawn_monster DESPUÉS de elegir coords: lee el tile,
    // elige monstruo por tile (picker); si no cuaja o la casilla no lo admite, no
    // spawnea (equivale al `ret` sin spawn del binario).
    const tile = map.tileAt(spot.x, spot.y);
    if (tile < 0) return;
    const pick = picker(tile);
    if (!pick) return;
    const candidate: OverworldEnemy = {
      defIndex: pick.defIndex,
      tile: pick.tile,
      water: pick.water,
      x: spot.x,
      y: spot.y,
      ...(pick.hull !== undefined ? { hull: pick.hull } : {}),
    };
    if (!this.canEnter(candidate, map, spot.x, spot.y)) return;
    // Ranura por `acquire_actor_slot` (kernel 0x38E4) sobre la vista COMPUESTA del
    // pool (#103): llamada 1 = primer LIBRE ascendente 1..23 — ya sin pisar las
    // ranuras de los objetos del mundo, antes invisibles —; con el pool lleno, la
    // cascada DESALOJA por bandas de tile con preferencia fuera-de-pantalla
    // (ventana 11×11 del escáner 0x3868; la Corona 0xB5 jamás). CERO RNG.
    const view = overworldPoolView(state, this.enemies);
    const slot = acquireActorSlot(view, state.position.x, state.position.y);
    if (slot === 0) return; // ni la décima encontró: sin spawn (ret 0 del binario)
    const victim = view[slot]!.owner;
    if (victim?.kind === "enemy") {
      const i = this.enemies.indexOf(victim.ref as OverworldEnemy);
      if (i >= 0) this.enemies.splice(i, 1);
    } else if (victim?.kind === "object") {
      const objs = state.worldObjects;
      const i = objs ? objs.indexOf(victim.ref as (typeof objs)[number]) : -1;
      if (i >= 0) objs!.splice(i, 1);
    }
    candidate.slot = slot;
    this.enemies.push(candidate);
  }
}
