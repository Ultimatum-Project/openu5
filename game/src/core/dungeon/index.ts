/**
 * Núcleo de mazmorras 3D de Ultima V (Fase 6). Módulo autocontenido, núcleo puro
 * (sin DOM). Ver `docs/formats/combat-dungeons.md §2`.
 */
export {
  DungeonState,
  roomCombatMapIndex,
  wallVariant,
  dungeonOrderSkippingDespise,
  dungeonClearedBitIndex,
  dungeonRoomCleared,
  dungeonMarkRoomCleared,
  DUNGEON_ROOMS_CLEARED_BYTES,
  CellType,
  FountainType,
  TrapType,
  MagicFieldType,
  LIT_BIT,
  type Facing,
  type DungeonPos,
  type DungeonCell,
  type DungeonData,
  type DungeonEvent,
  type DungeonEventKind,
  type CellOverride,
} from "./dungeon.js";
export { visibleDepth, isDark } from "./light.js";
