/**
 * Motor de combate táctico de Ultima V (Fase 5). Módulo autocontenido, núcleo
 * puro (sin DOM). Ver `combat-dungeons.md §1`.
 */
export {
  buildEnemyDefs,
  decodeAbilities,
  PIRATE_SHIP_NUMBER,
  type EnemyDef,
  type EnemyAbilities,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "./enemies.js";
export { Rng } from "./rng.js";
export * from "./formulas.js";
export {
  Combat,
  combatCastAbsorbed,
  combatCastEffect,
  COMBAT_ABSORBED_MESSAGE,
  LOC_PALACE_OF_BLACKTHORN,
  GRID,
  type Combatant,
  type CombatEvent,
  type CombatEventKind,
  type CombatMapData,
  type CombatOpts,
  type PartyCombatant,
  type EnemySpec,
  type EntryDirection,
  type Dir8,
  type CombatantStatus,
} from "./combat.js";
export {
  shouldSpawnEnemy,
  pickSpawnEnemy,
  rollEncounterGroup,
  ENCOUNTER_FRIEND_TYPE,
  tileToMonsterId,
  weightedPick,
  SPAWN_TABLES,
  type SpawnTable,
  type SpawnTables,
  combatMapForTile,
  canGoOnTile,
  CombatMapIndex,
  arenaForActorAttack,
} from "./encounters.js";
