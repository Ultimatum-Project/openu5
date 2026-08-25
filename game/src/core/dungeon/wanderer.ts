/**
 * Monstruo ERRANTE de mazmorra 3D + arena PROCEDURAL del combate de pasillo.
 * Port CALCADO de DUNGEON.OVL (spawn 0x0252, move 0x07E2, emboscada 0x0B7E,
 * attack 0x1D4A) y DNGLOOK.OVL (builder de arena 0x0D3E/0x0C6C/0x0B9E/0x0AEE/
 * 0x097E/0x0A48, setup 0x117E). Derivación completa con citas:
 * `re/notes/dungeon-wanderer.md`. Tablas verificadas contra DATA.OVL (DS+0x10).
 *
 * Este módulo es PURO (tablas + lógica sin estado): DungeonState (dungeon.ts)
 * posee el estado del errante y le inyecta rand/grid; game.ts monta el combate.
 */
import type { CombatMapData, EntryDirection } from "../combat/combat.js";
import type { Facing } from "./dungeon.js";

/** Estado del errante (anim-slots 1-2 del binario, DS 0x5C62/0x5C6A ≡ save 0x6B4+8). */
export interface WandererState {
  /** Banco de sprite MON0-7 (+0/+1). */
  bank: number;
  /** Tipo de monstruo (tabla 0x173C; índice de EnemyDef). 0xFF = INACTIVO (+5). */
  type: number;
  /** Celda actual (+2/+3); 0xFF sin posición. */
  x: number;
  y: number;
  /** Planta en la que vive (+4). */
  floor: number;
  /** Attr de animación (tabla 0x1744, +6). */
  attr: number;
  /** true = OCULTO (+7==0xFF; araña/slime 51% al spawnear) — no se dibuja. */
  hidden: boolean;
  /** Posición PREVIA (slot 2, +2/+3): dirección de la emboscada y revert. */
  prevX: number;
  prevY: number;
}

export const WANDERER_INACTIVE = 0xff;

/** Errante recién desactivado (DNGLOOK 0x109E arg≠0: +0/+1=0, +2/+3=0xFF, +5=0xFF). */
export function inactiveWanderer(): WandererState {
  return { bank: 0, type: WANDERER_INACTIVE, x: 0xff, y: 0xff, floor: 0, attr: 0, hidden: false, prevX: 0xff, prevY: 0xff };
}

/** banco MON → tipo de monstruo (DATA.OVL DS 0x173C): Rata, Murciélago, Araña,
 *  Fantasma, Slime, Gremlin, Gazer, Reaper. */
export const WANDERER_BANK_TYPES: readonly number[] = [0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1c, 0x1b];
/** banco MON → attr de animación (DATA.OVL DS 0x1744). */
export const WANDERER_BANK_ATTRS: readonly number[] = [0x60, 0xa0, 0x00, 0x90, 0x80, 0x60, 0x00, 0x00];

/** Tipos con el roll de OCULTO al spawn (DUNGEON 0x02d6: araña 0x16, slime 0x18). */
const HIDDEN_ROLL_TYPES = new Set([0x16, 0x18]);
/** Tipo que NO se mueve (DUNGEON 0x0810 hardcode 0x1B = Reaper; == DoNotMove del def). */
const IMMOBILE_TYPE = 0x1b;

/** dx/dy por dirección 0=N,1=E,2=S,3=W (DATA.OVL DS 0x24D6/0x24DE). */
const DIR_DX = [0, 1, 0, -1] as const;
const DIR_DY = [-1, 0, 1, 0] as const;

export type RandFn = (lo: number, hi: number) => number;
/** hi-nibble (`cell.type` del port) de la celda (floor,x,y) de la mazmorra. */
export type CellTypeAt = (floor: number, x: number, y: number) => number;

/**
 * Spawn de posición (DUNGEON 0x0252): hasta 8 intentos `off=rand(0,63)` sobre la
 * planta; celda válida si tipo < 0x6 ó == 0x7; rechaza si comparte FILA o COLUMNA
 * con la party (0x02b1-0x02c3: x==px O y==py). Devuelve la celda o null (8 fallos).
 * Muta `w` (posiciones + hidden). El roll de oculto (rand(0,99)>0x30, 51%) sólo
 * lo consumen araña/slime AL ACEPTAR.
 */
export function spawnWandererPos(
  w: WandererState,
  floor: number,
  px: number,
  py: number,
  cellTypeAt: CellTypeAt,
  rand: RandFn,
): boolean {
  for (let attempt = 0; attempt < 8; attempt++) {
    const off = rand(0, 63);
    const x = off % 8;
    const y = off >> 3;
    const t = cellTypeAt(floor, x, y);
    if (!(t < 0x6 || t === 0x7)) continue;
    if (x === px || y === py) continue;
    w.x = x;
    w.y = y;
    w.prevX = x;
    w.prevY = y;
    w.floor = floor;
    if (HIDDEN_ROLL_TYPES.has(w.type) && rand(0, 99) > 0x30) w.hidden = true;
    return true;
  }
  w.x = w.y = w.prevX = w.prevY = 0xff;
  return false;
}

/**
 * Re-arma el errante entero (DUNGEON 0x0134 con flag≠0): `rand(0,7)` → banco →
 * tipo/attr por tablas; spawn de posición; si falla → INACTIVO (+5=0xFF, 0x019b).
 */
export function respawnWanderer(
  floor: number,
  px: number,
  py: number,
  cellTypeAt: CellTypeAt,
  rand: RandFn,
): WandererState {
  const bank = rand(0, 7);
  const w: WandererState = {
    bank,
    type: WANDERER_BANK_TYPES[bank]!,
    x: 0xff,
    y: 0xff,
    floor,
    attr: WANDERER_BANK_ATTRS[bank]!,
    hidden: false,
    prevX: 0xff,
    prevY: 0xff,
  };
  if (!spawnWandererPos(w, floor, px, py, cellTypeAt, rand)) {
    w.type = WANDERER_INACTIVE;
    w.bank = 0;
  }
  return w;
}

/**
 * Turno de movimiento (DUNGEON 0x07E2). Hasta 8 intentos `rand(0,3)` → dir;
 * destino con WRAP (>7→0, <0→7); rechaza trampa (0x6), campo (0x8) y ≥0xA
 * (0x08a0-0x08b0). Si destino == party: gate `rand(0,7)==1` para atacar; si no,
 * intento fallido. Al pisar a la party: REVERT a la posición previa y devuelve
 * true (¡emboscada!). Reaper (0x1B) no se mueve pero SÍ evalúa la emboscada final
 * (sólo posible si ya está pegado… nunca, porque no pisa: fiel al binario, el
 * chequeo 0x0917 corre igualmente). Muta `w`.
 */
export function moveWanderer(
  w: WandererState,
  px: number,
  py: number,
  cellTypeAt: CellTypeAt,
  rand: RandFn,
): boolean {
  if (w.type === WANDERER_INACTIVE) return false;
  if (w.type !== IMMOBILE_TYPE) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const dir = rand(0, 3);
      let nx = w.x + DIR_DX[dir]!;
      let ny = w.y + DIR_DY[dir]!;
      if (nx > 7) nx = 0;
      else if (nx < 0) nx = 7;
      if (ny > 7) ny = 0;
      else if (ny < 0) ny = 7;
      const t = cellTypeAt(w.floor, nx, ny);
      if (t === 0x6 || t === 0x8 || t >= 0xa) continue;
      if (nx === px && ny === py && rand(0, 7) !== 1) continue;
      w.prevX = w.x;
      w.prevY = w.y;
      w.x = nx;
      w.y = ny;
      break;
    }
  }
  if (w.x === px && w.y === py) {
    // Nunca ocupa la celda de la party: revert y ataca (0x092a-0x093b).
    w.x = w.prevX;
    w.y = w.prevY;
    return true;
  }
  return false;
}

/**
 * Dirección de la emboscada (DUNGEON 0x0b90-0x0bd0), desde la posición PREVIA con
 * wrap &7: monstruo al Este de la party → 1 (east); al Oeste → 3; al Sur → 2;
 * si no, 0 (north). Índice = dir del binario (0=N,1=E,2=S,3=W).
 */
export function ambushDirection(w: WandererState, px: number, py: number): number {
  if (((w.prevX - 1) & 7) === px) return 1;
  if (((w.prevX + 1) & 7) === px) return 3;
  if (((w.prevY - 1) & 7) === py) return 2;
  return 0;
}

export const DIR_TO_FACING: readonly Facing[] = ["north", "east", "south", "west"];
/** Palabras de dirección de la emboscada (DATA.OVL 0x2DA6/2DAC/2DB1/2DB7). */
export const DIR_WORDS: readonly string[] = ["north", "east", "south", "west"];

// ─────────────────────────── arena procedural del pasillo ───────────────────────────

/** Tiles del builder (DNGLOOK 0x0D3E/0x0C6C; TileData.json). */
const TILE_BLACK = 0xff; // BlackSquare (esquinas del anillo / lado ciego)
const FEATURE_BY_CELL: Record<number, number> = {
  // tabla DS 0x244A por hi-nibble de la celda de la party (0x0cfa-0x0d0d):
  0x1: 0xc8, // LadderUp
  0x2: 0xc9, // LadderDown
  0x3: 0xc8, // LadderUpDown → muestra la de subir (flag bb16 aparte)
  0x4: 0xdc, // cofre
  0x5: 0xd8, // fuente
};

/** playerStarts del pasillo (DNGLOOK 0x0D8E-0x0E50; tablas DS 0x245E/64/6A/70).
 *  Grupos por borde: east/west/south/north — el binario los escribe en las filas
 *  1-4 del .CBT procedural (grupo1=E, 2=W, 3=S, 4=N). */
const START_XA = [5, 4, 6, 3, 5, 7] as const; // DS 0x2470 (y de E/W; x de S/N)
const START_XB = [6, 7, 7, 8, 8, 8] as const; // DS 0x2464 (x de E; y de S)
const START_XC = [4, 3, 3, 2, 2, 2] as const; // DS 0x246A (x de W; y de N)
const CORRIDOR_STARTS: Record<EntryDirection, { x: number; y: number }[]> = {
  east: START_XB.map((x, i) => ({ x, y: START_XA[i]! })),
  west: START_XC.map((x, i) => ({ x, y: START_XA[i]! })),
  south: START_XA.map((x, i) => ({ x, y: START_XB[i]! })),
  north: START_XA.map((x, i) => ({ x, y: START_XC[i]! })),
};

/** Posiciones de monstruo (16) espejadas POR FACING (DNGLOOK 0x0E53-0x0EE1;
 *  tablas DS 0x2476/0x2486/0x2496/0x24A6): siempre DELANTE de la party. */
const MON_P = [5, 4, 6, 3, 7, 2, 8, 5, 2, 8, 3, 7, 2, 4, 6, 8] as const; // 0x2476
const MON_Q = [8, 8, 8, 7, 7, 6, 6, 9, 8, 8, 9, 9, 10, 10, 10, 10] as const; // 0x2486
const MON_R = [2, 2, 2, 3, 3, 4, 4, 1, 2, 2, 1, 1, 0, 0, 0, 0] as const; // 0x2496
const MON_S = [5, 4, 6, 3, 7, 2, 8, 5, 2, 8, 7, 3, 2, 4, 6, 8] as const; // 0x24A6
function monsterSlots(facing: Facing): { x: number; y: number }[] {
  switch (facing) {
    case "north":
      return MON_P.map((x, i) => ({ x, y: MON_R[i]! }));
    case "east":
      return MON_Q.map((x, i) => ({ x, y: MON_S[i]! }));
    case "south":
      return MON_S.map((x, i) => ({ x, y: MON_Q[i]! }));
    case "west":
      return MON_R.map((x, i) => ({ x, y: MON_P[i]! }));
  }
}

/** Vecino del grid por lado (DNGLOOK 0x0B9E → 0x0AEE/0x097E/0x0A48). */
export type SideKind = "open" | "doorway" | "wall";

export interface CorridorArenaSpec {
  /** Tile de suelo (bb15): 0x05 Grass, ó 0x45 MetalFloor en Deceit/Wrong/Covetous. */
  floorTile: number;
  /** Tile de muro (bb14): 0x4D LargeRockWall, ó 0x4F StoneBrickWall en D/W/C. */
  wallTile: number;
  /** Clase del vecino por lado 0=N,1=E,2=S,3=W (celda de mazmorra adyacente). */
  sides: [SideKind, SideKind, SideKind, SideKind];
  /** hi-nibble de la celda de la party (feature al centro; tapones si 0xE puerta). */
  partyCellType: number;
  facing: Facing;
  /** Tipo de monstruo del errante. */
  monsterType: number;
  /** maxPerMap del EnemyDef (byte 0 del registro DS 0x13C2). */
  maxPerMap: number;
}

/** Deceit(33)/Wrong(36)/Covetous(37) usan piso metálico y ladrillo (DUNGEON 0x0e86-0x0e9f). */
export function corridorTilesFor(dungeonLocation: number): { floorTile: number; wallTile: number } {
  const metal = dungeonLocation === 33 || dungeonLocation === 36 || dungeonLocation === 37;
  return metal ? { floorTile: 0x45, wallTile: 0x4f } : { floorTile: 0x05, wallTile: 0x4d };
}

/**
 * Construye la arena PROCEDURAL 11×11 del combate de pasillo (DNGLOOK 0x0D3E) +
 * la generación de enemigos del setup (0x0EFD-0x0FD3). Consumo de rand CALCADO:
 * 16×rand(0,15) del barajado de slots (Fisher-Yates COMPLETO, fase G) + 1 del
 * conteo que se tira SIEMPRE (fase H) ⇒ **17 por encuentro**. Con tope 8 ó 16 el
 * conteo es fijo pero la tirada se gasta igual — ver el comentario del `roll`.
 * ⚠ Queda FUERA: el `rand_range(0,7)` extra que la fase (H) del original tira si
 * `g_unk_58a1 & 4` (el «modo especial»), que llevaría el total a 18. El port no
 * modela esa bandera; sin ella el camino de 18 no existe aquí. Ficha #20.
 */
export function buildCorridorCombatMap(spec: CorridorArenaSpec, rand: RandFn): CombatMapData {
  const { floorTile, wallTile } = spec;
  // 11×11 de suelo (0x0d4b-0x0d65).
  const tiles: number[][] = Array.from({ length: 11 }, () => new Array<number>(11).fill(floorTile));
  // Muros: filas 1 y 9 + columnas 1 y 9 (0x0c74-0x0cba).
  for (let i = 0; i < 11; i++) {
    tiles[1]![i] = wallTile;
    tiles[9]![i] = wallTile;
    tiles[i]![1] = wallTile;
    tiles[i]![9] = wallTile;
  }
  // Esquinas del anillo exterior = BlackSquare (0x0cbc-0x0cc7).
  tiles[0]![0] = TILE_BLACK;
  tiles[0]![10] = TILE_BLACK;
  tiles[10]![0] = TILE_BLACK;
  tiles[10]![10] = TILE_BLACK;
  // Lados (0x0B9E): pasable → tramo 7 abierto (0x0AEE, celdas 2-8); puerta/sala →
  // tramo 5 (0x0A48, celdas 3-7); muro → cerrado + fila/col exterior en negro (0x097E).
  const carve = (side: number, from: number, to: number): void => {
    for (let i = from; i <= to; i++) {
      if (side === 0) tiles[1]![i] = floorTile;
      else if (side === 1) tiles[i]![9] = floorTile;
      else if (side === 2) tiles[9]![i] = floorTile;
      else tiles[i]![1] = floorTile;
    }
  };
  spec.sides.forEach((kind, side) => {
    if (kind === "open") carve(side, 2, 8);
    else if (kind === "doorway") carve(side, 3, 7);
    else {
      // 0x097E: borde exterior del lado ciego = negro (11 celdas).
      for (let i = 0; i < 11; i++) {
        if (side === 0) tiles[0]![i] = TILE_BLACK;
        else if (side === 1) tiles[i]![10] = TILE_BLACK;
        else if (side === 2) tiles[10]![i] = TILE_BLACK;
        else tiles[i]![0] = TILE_BLACK;
      }
      // Party SOBRE una puerta (0x0a1b-0x0a3c): tapones del marco (sólo lados 0 y 3).
      if (spec.partyCellType === 0xe) {
        if (side === 0) {
          tiles[2]![5] = wallTile;
          tiles[8]![5] = wallTile;
        } else if (side === 3) {
          tiles[5]![8] = wallTile;
          tiles[5]![2] = wallTile;
        }
      }
    }
  });
  // Feature de la celda al CENTRO (5,5) (0x0cca-0x0d0d, tabla 0x244A).
  const feature = FEATURE_BY_CELL[spec.partyCellType];
  if (feature !== undefined) tiles[5]![5] = feature;

  // Enemigos (0x0EFD-0x0FD3): barajado Fisher-parcial de los 16 slots con
  // 16×rand(0,15) (swap i↔rand), tipo del errante, count=rand(1,max) salvo 8/16.
  const slots = monsterSlots(spec.facing);
  const order = Array.from({ length: 16 }, (_, i) => i);
  for (let i = 0; i < 16; i++) {
    const j = rand(0, 15);
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
  }
  const max = spec.maxPerMap;
  // ★ LA TIRADA SE HACE SIEMPRE, aunque el tope la pise. El original tira
  // `rand_range(byte[tipo*8 + 0x13c2], 1)` incondicionalmente; si ese byte vale 8 ó
  // 0x10 el resultado se SOBRESCRIBE con el propio tope — el tamaño del grupo queda
  // fijo, pero la tirada YA SE HA CONSUMIDO. Saltársela (que es lo que hacía este
  // código) ahorra un rand y DESINCRONIZA el stream justo al entrar en combate de
  // mazmorra, de donde cuelga la semilla del combate entero. Ficha #20.
  const roll = rand(1, Math.max(1, max));
  const count = max === 8 || max === 16 ? max : roll;
  // Tile de combate del tipo = 0x40 + tipo·4 (0x0f9e-0x0fa5); fixedFromMap lo
  // hidrata con +0x100 → 320+idx·4 = sprite del EnemyDef.
  const sprite = 0x40 + spec.monsterType * 4;
  const units: { sprite: number; x: number; y: number }[] = [];
  for (let k = 0; k < count && k < 16; k++) {
    const slot = slots[order[k]!]!;
    units.push({ sprite, x: slot.x, y: slot.y });
  }

  return {
    index: -1,
    territory: "dungeon-corridor",
    name: null,
    tiles,
    playerStarts: CORRIDOR_STARTS,
    units,
    triggers: [],
  };
}
