/**
 * Propiedades de los tiles (transitabilidad, nombres, flags).
 * Fuente: TileData.json de Ultima5Redux (MIT) — ver data/ATTRIBUTION.txt.
 */
import tileDataJson from "./data/TileData.json";

export interface TileInfo {
  name: string;
  description: string;
  walkable: boolean;
  boatPassable: boolean;
  skiffPassable: boolean;
  carpetPassable: boolean;
  horsePassable: boolean;
  rangeWeaponPassable: boolean;
  klimable: boolean;
  openable: boolean;
  landEnemyPassable: boolean;
  waterEnemyPassable: boolean;
  speedFactor: number;
  lightEmission: number;
  isPartOfAnimation: boolean;
  animationIndex: number;
  upright: boolean;
  flatTileSubstitutionIndex: number;
  flatTileSubstitutionName: string;
  windowTile: boolean;
  guessTile: boolean;
  dontDraw: boolean;
}

interface RawTileEntry {
  Name: string;
  Description: string;
  IsWalking_Passable: boolean;
  RangeWeapon_Passable: boolean;
  IsBoat_Passable: boolean;
  IsSkiff_Passable: boolean;
  IsCarpet_Passable: boolean;
  IsHorse_Passable: boolean;
  IsKlimable: boolean;
  IsOpenable: boolean;
  IsLandEnemyPassable: boolean;
  IsWaterEnemyPassable: boolean;
  SpeedFactor: number;
  LightEmission?: number;
  IsPartOfAnimation: boolean;
  AnimationIndex: number;
  IsUpright: boolean;
  FlatTileSubstitutionIndex?: number;
  FlatTileSubstitutionName?: string;
  IsWindow?: boolean;
  IsGuessableTile?: boolean;
  DontDraw?: boolean;
}

const raw = tileDataJson as unknown as Record<string, RawTileEntry>;

/**
 * Overrides de PASABILIDAD A PIE citados al BINARIO (fuente canónica ESTÁTICA:
 * `DATA.OVL` fileoff `0x54e4`, 32 bytes; predicado del consumidor kernel `0x2bd4` =
 * máscara `0x80>>(tile&7)` MSB, bit PUESTO = BLOQUEA; ancla: hierba 0x05 clear=pasa,
 * agua 0x01 puesto=bloquea, desierto 0x07 pasa; bin bloquea 182 EXACTOS). Clase-A sobre
 * el `IsWalking_Passable` de TileData.json (Clase-D vendorizado, NO se edita). Sólo los
 * swaps confirmados contra la tabla canónica (`re/notes/passability-29tile-audit.md`): el
 * binario BLOQUEA a pie estos tiles y TileData los marca por error transitables.
 *
 * OJO — el volcado EN VIVO del audit original (lote D) estaba CORRUPTO en la zona 0xa8-0xe7
 * y generó falsos positivos: Fireplace 0xbc SÍ es pisable en el original (byte23 canónico
 * 0xf7, no el 0xff corrupto — en el U5 real se pisa el hogar; el Grand Tour lo calcaba). Los
 * Los ⏳ FLAG restantes y las divergencias DELIBERADAS (BrokenShrine 0x1a walk-to-restore
 * vía checkShrineEntry; moongate 0xdc walk-to-teleport; stairs; BlackSquare 0xff void —
 * el binario lo deja «pasa» pero es un tile de niebla/borde sin semántica de terreno:
 * el port lo bloquea por defensa, divergencia BENDECIDA 2026-07-19, adjudicación del
 * lead en passability-29tile-audit.md) NO entran aquí.
 */
const WALKABLE_OVERRIDE: Readonly<Record<number, boolean>> = {
  // WaterStream11-14: AGUA (skiff/water-enemy); a pie no se anda sobre agua (byte13=0xcf, los 4 bloquean).
  0x6c: false,
  0x6d: false,
  0x6e: false,
  0x6f: false,
  // Oasis: el binario lo bloquea a pie (Slow-progress es el desierto 0x07, no el oasis).
  0x1c: false,
  // ScaryBlackThingDead (campo muerto): el binario lo bloquea a pie.
  0xc3: false,
  // SignShipwright (cartel flavor): el binario lo deja PISABLE (bit CLEAR en 0x54e4,
  // byte31; TileData sobre-bloqueaba). Cierre de pasabilidad-29, adjudicación 2026-07-19.
  0xf9: true,
};

/** Tabla indexada por número de tile (0..528). */
export const TILE_INFO: TileInfo[] = [];
for (const [key, e] of Object.entries(raw)) {
  TILE_INFO[Number(key)] = {
    name: e.Name,
    description: e.Description,
    walkable: WALKABLE_OVERRIDE[Number(key)] ?? e.IsWalking_Passable,
    boatPassable: e.IsBoat_Passable,
    skiffPassable: e.IsSkiff_Passable,
    carpetPassable: e.IsCarpet_Passable,
    horsePassable: e.IsHorse_Passable,
    rangeWeaponPassable: e.RangeWeapon_Passable,
    klimable: e.IsKlimable,
    openable: e.IsOpenable,
    landEnemyPassable: e.IsLandEnemyPassable,
    waterEnemyPassable: e.IsWaterEnemyPassable,
    speedFactor: e.SpeedFactor,
    lightEmission: e.LightEmission ?? 0,
    isPartOfAnimation: e.IsPartOfAnimation,
    animationIndex: e.AnimationIndex,
    upright: e.IsUpright,
    flatTileSubstitutionIndex: e.FlatTileSubstitutionIndex ?? -1,
    flatTileSubstitutionName: e.FlatTileSubstitutionName ?? "",
    windowTile: e.IsWindow ?? false,
    guessTile: e.IsGuessableTile ?? false,
    dontDraw: e.DontDraw ?? false,
  };
}

export function tileInfo(tile: number): TileInfo {
  const info = TILE_INFO[tile];
  if (!info) throw new Error(`Tile desconocido: ${tile}`);
  return info;
}

/** Nombre → índice (para tests y datos legibles). */
export const TILE_BY_NAME: ReadonlyMap<string, number> = new Map(
  TILE_INFO.map((t, i) => [t.name, i] as const).filter(([n]) => n !== ""),
);
