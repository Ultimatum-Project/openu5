/**
 * Encuentros del overworld: cuándo aparece un enemigo, cuál según terreno y era,
 * y qué mapa de combate .CBT usa el tile atacado.
 *
 * El spawner es el FIEL del binario (Fix B / task #19): `tile_to_monster`
 * (MAINOUT 0x0E4E) + `weighted_pick rand(0,255)` (0x0E04) sobre las 4 tablas
 * FIJAS de DATA.OVL — ver `pickSpawnEnemy`. NO se porta `GetEraWeightByTurn` /
 * `OddsAndLogic.BeginningOfEras`: el original DOS 1988 no progresa de era (el
 * selector del spawner no lee ningún contador de turnos — oracle-eras.md grado
 * A; eras retiradas en Fix A / task #16). `canGoOnTile` (port de
 * `EnemyReference.CanGoOnTile`) queda como utilidad; el spawner ya NO la usa (las
 * tablas codifican el terreno). El `CombatMapIndex` por tile se lee DIRECTAMENTE del campo
 * `CombatMapIndex` de `TileData.json` (fidelidad total: es la misma tabla que
 * `TileReference.CombatMapIndex` del original), no de una tabla adivinada.
 */
import tileDataJson from "../data/TileData.json";
import { tileInfo } from "../tiles.js";
import type { RandFn } from "../world/survival.js";
import type { Rng } from "./rng.js";
import type { EnemyDef } from "./enemies.js";

/** Enum BritanniaCombatMaps (SingleCombatMapReference.cs:15). */
export enum CombatMapIndex {
  None = -2,
  BoatCalc = -1,
  CampFire = 0,
  Swamp = 1,
  Glade = 2,
  Treed = 3,
  Desert = 4,
  CleanTree = 5,
  Mountains = 6,
  BigBridge = 7,
  Brick = 8,
  Basement = 9,
  Psychedelic = 10,
  BoatOcean = 11,
  BoatNorth = 12,
  BoatSouth = 13,
  BoatBoat = 14,
  Bay = 15,
}

const NAME_TO_INDEX: Record<string, CombatMapIndex> = {
  None: CombatMapIndex.None,
  BoatCalc: CombatMapIndex.BoatCalc,
  CampFire: CombatMapIndex.CampFire,
  Swamp: CombatMapIndex.Swamp,
  Glade: CombatMapIndex.Glade,
  Treed: CombatMapIndex.Treed,
  Desert: CombatMapIndex.Desert,
  CleanTree: CombatMapIndex.CleanTree,
  Mountains: CombatMapIndex.Mountains,
  BigBridge: CombatMapIndex.BigBridge,
  Brick: CombatMapIndex.Brick,
  Basement: CombatMapIndex.Basement,
  Psychedelic: CombatMapIndex.Psychedelic,
  BoatOcean: CombatMapIndex.BoatOcean,
  BoatNorth: CombatMapIndex.BoatNorth,
  BoatSouth: CombatMapIndex.BoatSouth,
  BoatBoat: CombatMapIndex.BoatBoat,
  Bay: CombatMapIndex.Bay,
};

/** Tabla tile → CombatMapIndex, extraída de TileData.json al cargar el módulo. */
const TILE_COMBAT_MAP: CombatMapIndex[] = [];
{
  const raw = tileDataJson as unknown as Record<
    string,
    { CombatMapIndex?: string }
  >;
  for (const [key, e] of Object.entries(raw)) {
    const idx = e.CombatMapIndex ? NAME_TO_INDEX[e.CombatMapIndex] : undefined;
    TILE_COMBAT_MAP[Number(key)] = idx ?? CombatMapIndex.None;
  }
}

/** §1.14: probabilidad plana de generar un enemigo nuevo = 1/16. */
export function shouldSpawnEnemy(rng: Rng): boolean {
  return rng.oneIn(16);
}

/** CombatMapIndex del mapa de combate .CBT según el terreno del tile atacado. */
export function combatMapForTile(tile: number): CombatMapIndex {
  return TILE_COMBAT_MAP[tile] ?? CombatMapIndex.None;
}

/** ¿Puede el enemigo aparecer/combatir en este tile? (port de CanGoOnTile). */
export function canGoOnTile(def: EnemyDef, tile: number): boolean {
  const cmi = combatMapForTile(tile);
  const info = tileInfo(tile);
  switch (cmi) {
    case CombatMapIndex.None:
    case CombatMapIndex.CampFire:
    case CombatMapIndex.BigBridge:
    case CombatMapIndex.Brick:
    case CombatMapIndex.Basement:
    case CombatMapIndex.Psychedelic:
      return false;
    case CombatMapIndex.BoatOcean:
    case CombatMapIndex.BoatNorth:
    case CombatMapIndex.BoatSouth:
    case CombatMapIndex.BoatBoat:
    case CombatMapIndex.Bay:
    case CombatMapIndex.BoatCalc:
      return def.isWater && info.waterEnemyPassable;
    case CombatMapIndex.Desert:
      return def.isSand;
    case CombatMapIndex.Swamp:
    case CombatMapIndex.Glade:
    case CombatMapIndex.Treed:
    case CombatMapIndex.CleanTree:
    case CombatMapIndex.Mountains:
      return !def.isWater && !def.isSand && info.landEnemyPassable;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Spawner fiel (Fix B, task #19): weighted_pick 0x0E04 + tile_to_monster 0x0E4E.
// El binario NO progresa de era (Fix A / task #16): elige el monstruo por
// terreno × g_floor × 4 tablas de peso FIJAS de DATA.OVL. Aquí se porta ese
// mecanismo EXACTO, sustituyendo el residuo de VALORES `eraWeights[0]` del clon.
// oracle-eras.md grado A; el mapeo id→enemigo se cierra por def.tile.
// ---------------------------------------------------------------------------

/** Un par (ids, weights) de tabla de spawn. Espejo de `SpawnTable` del extractor. */
export interface SpawnTable {
  ids: number[];
  weights: number[];
}
export interface SpawnTables {
  waterSurface: SpawnTable;
  waterUnderworld: SpawnTable;
  landSurface: SpawnTable;
  landUnderworld: SpawnTable;
}

/**
 * Las 4 tablas FIJAS de spawn, volcadas byte-a-byte de DATA.OVL (DS 0x2BC0..0x2BF6;
 * fileoff = DS+0x10). Fuente única = DATA.OVL; `extractor` las emite en data.json y
 * un test (combat.test.ts) BLOQUEA que este literal == data.json.spawnTables (no
 * pueden derivar). Cada `weights` suma 256; `ids[i]` = tile de sprite − 0x100.
 * Punteros: waterSurface 0eb4 (pesos 0x2BF0/ids 0x2BD4), waterUnderworld 0ec6
 * (0x2BF6/0x2BDA), landSurface 0f28 (0x2BDC/0x2BC0), landUnderworld 0f38 (0x2BE8/0x2BCC).
 */
export const SPAWN_TABLES: SpawnTables = {
  waterSurface: { ids: [0x8c, 0x84, 0x88, 0x80, 0x2c], weights: [72, 72, 40, 38, 34] },
  waterUnderworld: { ids: [0x84, 0x88], weights: [128, 128] },
  landSurface: {
    ids: [0xc0, 0xc8, 0x90, 0x98, 0xbc, 0xc4, 0xd0, 0xe4, 0xcc, 0xd4, 0xdc, 0xd8],
    weights: [60, 50, 40, 30, 20, 15, 15, 10, 10, 3, 2, 1],
  },
  landUnderworld: { ids: [0x94, 0x90, 0x98, 0xf0, 0xf4, 0xd8, 0xdc], weights: [64, 56, 56, 32, 32, 8, 8] },
};

/** id de sprite de una ruta FIJA (no ponderada) de tile_to_monster. */
const ID_WHIRLPOOL = 0xec; // tile 1 (agua), rand(0,7)==7  → 0x1EC Whirlpool
const ID_SAND_TRAP = 0xe0; // tile 7 (desierto), rand(0,3)==0 → 0x1E0 Sand Trap
const ID_ROT_WORM = 0xf8; // tile 4 (pantano) en floor 0xFF → 0x1F8 Rot Worm

/**
 * `weighted_pick` — MAINOUT 0x0E04. `roll = rand(0,255)`; recorre la tabla de
 * pesos restando `weights[i]` de `roll` mientras `weights[i] <= roll`, y devuelve
 * el índice `i` donde `weights[i] > roll`. Como cada tabla suma 256 y roll ≤ 255,
 * el índice devuelto SIEMPRE es válido (nunca alcanza el terminador 0). Consume
 * EXACTAMENTE 1 rand(0,255) del stream vivo.
 */
export function weightedPick(weights: number[], rand: RandFn): number {
  let roll = rand(0, 0xff); // 0e0e: mov ax,0xff; call rand_range
  let i = 0;
  while (i < weights.length && weights[i]! <= roll) {
    roll -= weights[i]!; // 0e30: sub dx,ax
    i++; // 0e32: inc cx
  }
  return i;
}

/**
 * `tile_to_monster` — MAINOUT 0x0E4E. Devuelve el id de monstruo (tile de sprite
 * − 0x100) para el `tile` de terreno bajo las coords de spawn, o 0 (sin monstruo).
 * `floor` = g_floor (0xFF = underworld en el clon). Consume rands en el ORDEN del
 * asm; ver el mapa de draws por rama abajo. `rand` = stream vivo (inclusivo).
 *
 * Clasificación de terreno (0e54-0e80):
 *   Rama AGUA (gate 0e82): tile<4 ∨ 0x60..0x6f ∨ 0xd4..0xd7 ∨ 0xe4..0xe7.
 *   Rama TIERRA (0ed6): el resto.
 *
 * Orden de draws (contrato de rands que cambia el stream vivo, task #19):
 *   AGUA: rand(0,64) [gate <16, si no → 0]; luego, si superficie y tile==1,
 *         rand(0,7) [==7 → Whirlpool]; luego weighted_pick rand(0,255) sobre la
 *         tabla water(Surface|Underworld).  → 1-3 draws.
 *   TIERRA: tile==7 → rand(0,3) [==0 → Sand Trap, si no → 0] (SIN pick);
 *           tile==4 ∧ floor==0xFF → Rot Worm (0 draws);
 *           tile∈{0xc,0xd} ó (tile≥0x10 ∧ (tile&0xFC)≠0x30) → 0 (0 draws);
 *           resto → weighted_pick rand(0,255) sobre land(Surface|Underworld). → 0-1 draws.
 */
export function tileToMonsterId(
  tile: number,
  floor: number,
  rand: RandFn,
  tables: SpawnTables = SPAWN_TABLES,
): number {
  const t = tile & 0xff; // spawn_monster carga el tile como byte (sub ah,ah)
  // #171 — auditado y SE QUEDA LITERAL: mismo argumento que `spawnThreshold`. El único
  // caller de producción es `encounters.ts:252`, alimentado por el picker de
  // `Game.outdoorWorldTurn`, que sólo corre con location 0 ⇒ floor ∈ {0, 0xFF} y jamás −1.
  const underworld = floor >= 0x80; // 0e91/0f21: cmp g_floor,0x80; jae
  const waterTerrain =
    t < 4 || (t >= 0x60 && t <= 0x6f) || (t >= 0xd4 && t <= 0xd7) || (t >= 0xe4 && t <= 0xe7);

  if (waterTerrain) {
    // Gate 0e82: rand(0,64); si >=16 → sin monstruo (16/65).
    if (rand(0, 0x40) >= 0x10) return 0;
    if (underworld) {
      const tab = tables.waterUnderworld;
      return tab.ids[weightedPick(tab.weights, rand)] ?? 0;
    }
    if (t === 1) {
      // 0e9e: rand(0,7); ==7 → Whirlpool (id 0xec). Si no, cae al pick.
      if (rand(0, 7) === 7) return ID_WHIRLPOOL;
    }
    const tab = tables.waterSurface;
    return tab.ids[weightedPick(tab.weights, rand)] ?? 0;
  }

  // Rama TIERRA (0ed6).
  if (t === 7) {
    // 0edc: rand(0,3); ==0 → Sand Trap. Si no, sin monstruo (NO hay pick).
    return rand(0, 3) === 0 ? ID_SAND_TRAP : 0;
  }
  if (t === 4 && floor === 0xff) return ID_ROT_WORM; // 0ef6
  if (t === 0xc || t === 0xd) return 0; // 0f02/0f08
  if (t >= 0x10 && (t & 0xfc) !== 0x30) return 0; // 0f12-0f1f
  const tab = underworld ? tables.landUnderworld : tables.landSurface;
  return tab.ids[weightedPick(tab.weights, rand)] ?? 0;
}

/**
 * Elige el `EnemyDef` que spawnea en `tile`/`floor`, o null (sin monstruo). Porta
 * spawn_monster 0x0FC4 @0xfe8 (tile_to_monster) + el mapeo id→actor: el id es el
 * tile de sprite − 0x100, así que el enemigo es aquel cuyo `def.tile === id+0x100`
 * (incluye la nave pirata: id 0x2c → tile 0x12c=300). Sustituye a `pickEnemyForTile`
 * (residuo de eras). NO usa `canGoOnTile` ni `eraWeights`: las tablas ya codifican
 * qué monstruo va en qué terreno (Fix B / task #19).
 */
export function pickSpawnEnemy(
  defs: EnemyDef[],
  tile: number,
  floor: number,
  rand: RandFn,
  tables: SpawnTables = SPAWN_TABLES,
): EnemyDef | null {
  const id = tileToMonsterId(tile, floor, rand, tables);
  if (id === 0) return null;
  const spriteTile = id + 0x100;
  return defs.find((d) => d.tile === spriteTile) ?? null;
}

/**
 * Tabla de COMPAÑERO de grupo — DATA.OVL DS 0x16d4 (fileoff 0x16e4), 48 bytes,
 * 1 por tipo de enemigo (stride 1: kernel 0x6d36 `mov bx,[bp+4]; mov al,[bx+0x16d4]`
 * SIN shl). En un encuentro de campo, parte de los spawns adicionales puede salir de
 * esta tabla en vez del tipo base (orcos liderados por un troll, daemon por dragón,
 * esqueletos por un liche/wizard…). VERBATIM del binario (careo-combate T4).
 */
export const ENCOUNTER_FRIEND_TYPE: readonly number[] = [
  33, 1, 1, 3, 4, 4, 4, 4, 4, 4, 10, 4, 12, 13, 14, 15,
  17, 16, 17, 19, 33, 21, 20, 33, 24, 26, 35, 21, 21, 24, 30, 24,
  41, 0, 22, 36, 35, 23, 39, 39, 40, 20, 42, 43, 44, 45, 20, 38,
];

/** Índice del tipo GUARD (excepción del gate de pueblo: `cmp [bp+4],0xc` @0x6c6b). */
const GUARD_TYPE_INDEX = 12;

/**
 * Composición del GRUPO de un encuentro — kernel `combat_spawn_encounter` 0x6bc2
 * (ULTIMA.EXE; llamado con (flags=1, tipo) desde 0x6028 al iniciar combate contra
 * un actor del mapa; la etiqueta «render_animated_tile» de kernel-sweep-2 §6 es un
 * MISNOMBRE — la rutina imprime "*** CONFLICT ***" DS 0xa438, coloca al party via
 * 0x6936 y spawnea el bando enemigo via 0x6506). Derivación careo-combate T4:
 *
 *  1. COUNT (0x6c5d-0x6ccf):
 *     · en PUEBLO (g_unk_5894 ∈ [1,0x20]) y tipo != GUARD (0xc) → 1.
 *     · si no, base = ENEMY_STATS[tipo]+6 (= `maxPerMap`, DS 0x13bc+tipo*8+6; el
 *       asm lo lee como [tipo<<3 + 0x13c2]).
 *     · base ∈ {1, 8, 0x10} → EXACTO (8 guardias, 16 slimes/bats/mongbats).
 *     · si no → count = rand(1, base) (0x2092); y si [0x5959]!=0 (byte de SAVED.GAM
 *       offset 0x3B3; INIT.GAM lo trae a 1 — se modela SIEMPRE activo; su único
 *       write estático es el cero de fin de mes 0x506f, omitido en survival.ts
 *       como el resto de ceros mensuales) → count = rand(1, count) (re-tirada a la
 *       baja). Clamp > 0x19 → 0x1a (defensivo, inalcanzable con maxPerMap ≤ 16).
 *  2. COMPAÑEROS (0x6d11-0x6d76): el spawn 0 es SIEMPRE del tipo base; los spawns
 *     i = 1..count-1 con i < count/4+1 tiran rand0(8) (0x3aae) y con ==0 usan el
 *     tipo de ENCOUNTER_FRIEND_TYPE[tipo] (troll con orcos, dragón con daemons…).
 *
 * Devuelve la lista de ÍNDICES de tipo en orden de spawn. `rand` consume del
 * stream vivo en el MISMO orden que el binario (tiradas de count y luego las de
 * compañero, intercaladas de facto en orden de spawn — 0x6506 no consume RNG).
 */
export function rollEncounterGroup(
  typeIndex: number,
  maxPerMap: number,
  inTown: boolean,
  rand: RandFn,
): number[] {
  let count: number;
  if (inTown && typeIndex !== GUARD_TYPE_INDEX) {
    count = 1;
  } else if (maxPerMap === 1 || maxPerMap === 8 || maxPerMap === 0x10) {
    count = maxPerMap;
  } else {
    count = rand(1, Math.max(1, maxPerMap));
    count = rand(1, count); // [0x5959]!=0 (INIT.GAM byte 0x3B3=1): re-tirada
    if (count > 0x19) count = 0x1a;
  }
  const types: number[] = [typeIndex];
  const friendWindow = Math.floor(count / 4) + 1; // [bp-0x2c] = count/4+1 (0x6cf7-0x6d09)
  for (let i = 1; i < count; i++) {
    let t = typeIndex;
    if (i < friendWindow && rand(0, 8) === 0) {
      t = ENCOUNTER_FRIEND_TYPE[typeIndex] ?? typeIndex;
    }
    types.push(t);
  }
  return types;
}

/**
 * ARENA del combate contra un ACTOR del mapa — el switch de `enter_combat_vs_actor`
 * (ULTIMA.EXE 0x6150 @0x61f3-0x6338), derivado ENTERO en re/notes/kernel-turno-acta.md
 * §2b (tabla inline 0x62d8 resuelta contra la imagen). Es la regla que el binario usa
 * para TODO combate iniciado contra un registro de 0x5C5A — incluido el ataque de un
 * NPC hostil de pueblo (npc_engine TOWN 0x13dc → 0x09BC → 0x6150).
 *
 * @param t             terreno bajo el ACTOR (get_tile_ptr sobre +2/+3 del registro,
 *                      0x61b1) — NO bajo la party.
 * @param c             tile de la criatura: byte +0 del registro `& 0xfc` (0x6157-0x6167).
 * @param transportTile g_transport_tile (0x1c = a pie).
 * @param location      g_location (0 = sobremundo).
 *
 * Flag de agua (0x61d0-0x61f1 + refuerzo 0x622c): t < 4, o t ∈ 0x60..0x6f salvo
 * 0x6a/0x6b (los puentes), o criatura marina (c & 0xf0 == 0x80: SEA HORSES / SQUIDS /
 * SEA SERPENTS / SHARKS).
 */
export function arenaForActorAttack(
  t: number,
  c: number,
  transportTile: number,
  location: number,
): CombatMapIndex {
  const creature = c & 0xfc;
  if (creature === 0xfc) return CombatMapIndex.Psychedelic; // Shadow Lord → 0xa
  const onShip = (transportTile & 0xf8) === 0x20; // fragata
  const water =
    t < 4 || (t >= 0x60 && t <= 0x6f && t !== 0x6a && t !== 0x6b) || (c & 0xf0) === 0x80;
  if (onShip && creature === 0x2c) return CombatMapIndex.BoatBoat; // 0xe
  if (onShip && water) return CombatMapIndex.BoatOcean; // 0xb
  if (onShip) return CombatMapIndex.BoatSouth; // 0xd
  if (creature === 0x2c) return CombatMapIndex.BoatNorth; // 0xc (nave pirata sin barco)
  if (water) return CombatMapIndex.Bay; // 0xf
  if (t >= 4 && t <= 7) return t - 3; // 1..4 (Swamp/Glade/Treed/Desert)
  if (t === 8) return CombatMapIndex.Treed; // 3
  if (t >= 9 && t <= 0xa) return CombatMapIndex.CleanTree; // 5
  if (t >= 0xb && t <= 0xf) return CombatMapIndex.Mountains; // 6
  if (t >= 0x1e && t <= 0x1f) return CombatMapIndex.Desert; // 4
  if (t === 0x1d || t === 0x48 || t === 0x49 || t === 0x6a || t === 0x6b) {
    return CombatMapIndex.BigBridge; // 7
  }
  if (t === 0x44) return CombatMapIndex.Brick; // 8 — el suelo de ladrillo de interiores
  // resto: Glade en el sobremundo, Brick bajo techo (el default que ve la azotea del
  // Palacio — sus tiles 0x27/0x28 no casan con ninguna fila y g_location != 0).
  return location === 0 ? CombatMapIndex.Glade : CombatMapIndex.Brick;
}
