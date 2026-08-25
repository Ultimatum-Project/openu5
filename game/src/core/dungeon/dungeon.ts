/**
 * Núcleo de mazmorras 3D de Ultima V. Puro, sin DOM.
 *
 * Reglas EXACTAS re-derivadas de DUNGEON.OVL / DNGLOOK.OVL (Task 3.4). Redux no
 * implementa la mecánica de mazmorra; esta es la primera fuente exacta del
 * binario. Citas asm en `re/notes/dungeon.md`; efectos aún no verificados en
 * runtime contra DOSBox van anotados `FIDELITY:` (asm-derivado, paridad
 * pendiente). Las tiradas usan el RNG EXACTO del kernel (`OriginalRng`,
 * rand(lo,hi) inclusive) para que el stream case con el binario.
 *
 * Modelo de datos (DS:0x595A, 8 plantas de 8×8; cada celda es un byte partido en
 * nibble alto = tipo y nibble bajo = subtipo): `floors[floor][y][x]`.
 */
import type { CharacterState, GameState } from "../state.js";
import { partyMembers } from "../party.js";
import { OriginalRng } from "../rng-original.js";
import { isDark } from "./light.js";
import { LAST_DUNGEON_LOCATION } from "../quest/words.js";
import { chestTrap, dungeonChestLoot, applyLootGrant, lootItemName } from "../world/commands.js";
import type { SfxId } from "../sfx.js";
import {
  type WandererState,
  type SideKind,
  inactiveWanderer,
  respawnWanderer,
  moveWanderer,
  ambushDirection,
  DIR_TO_FACING,
  DIR_WORDS,
  WANDERER_INACTIVE,
  buildCorridorCombatMap,
  corridorTilesFor,
} from "./wanderer.js";
import type { CombatMapData } from "../combat/combat.js";
import { tf } from "../../i18n/index.js";

export type Facing = "north" | "east" | "south" | "west";

/** dungeon = location 33-40 (Deceit..Doom). */
export interface DungeonPos {
  dungeon: number;
  floor: number;
  x: number;
  y: number;
  facing: Facing;
}

export interface DungeonCell {
  type: number;
  sub: number;
}

/** Una mazmorra completa tal y como viene en assets/maps/dungeons.json. */
export interface DungeonData {
  location: number;
  name: string;
  floors: DungeonCell[][][]; // [floor][y][x]
}

export type DungeonEventKind =
  | "message"
  | "damage"
  | "combat-room"
  | "exit-overworld"
  | "exit-underworld"
  | "moved"
  | "turned"
  | "floor-changed"
  // Combate de PASILLO contra el errante 3D (emboscada 0x0B7E / attack 0x1D4A):
  // game.ts lo monta con la arena procedural (ds.buildCorridorArena).
  | "combat-corridor"
  // Cue de sonido lógico (task #3 / carril audio-costuras): viaja con los eventos
  // del comando y `game.ts` lo traduce a `sfxEvent` del contrato. Presentación
  // pura: no consume RNG ni muta estado.
  | "sfx"
  // ★ #328 — guión de presentación de `kernel_apply_damage` 0x2a52 (flash de fila
  // del roster XOR 0x2a28 + blip NB(10,1600,2000), POR slot dañado, en orden).
  // `slots` = índices de fila; el traductor lo vuelca al bus "poison-tick" (#213).
  | "damage-script";

/**
 * Opciones del (S)earch 3D — cadena F2-T7 (search_dungeon SJOG 0x0646):
 * `target` = respuesta del prompt `Dir-` (0x0672: Ahead/Here/Right/Left);
 * `searcherIdx` = miembro elegido por el selector 0x8a08 (kernel 0x4988), cuyo
 * DEX alimenta el threshold de trampas (0x06b7). Ambos opcionales: sin opts la
 * búsqueda es ahead con el PJ activo (los atajos sin prompt del selector).
 */
export interface DungeonSearchOpts {
  target?: "ahead" | "here" | "left" | "right";
  searcherIdx?: number;
}

export interface DungeonEvent {
  kind: DungeonEventKind;
  text?: string;
  amount?: number;
  roomCombatMapIndex?: number;
  charIdx?: number;
  /** ID del cue (sólo kind "sfx"). */
  sfx?: SfxId;
  /** Causa del combate de pasillo (sólo kind "combat-corridor"): la emboscada
   *  aplica los códigos post-combate 1-6 (0x0FDA); el attack sólo 5/6 (0x1DB8). */
  corridorCause?: "ambush" | "attack";
  /** Slots del roster dañados por 0x2a52, en orden (sólo kind "damage-script"). */
  slots?: number[];
}

/** Registro serializable de una celda mutada (p.ej. cofre → cofre abierto). */
export interface CellOverride {
  floor: number;
  x: number;
  y: number;
  type: number;
  sub: number;
}

// ── Tipos por nibble ALTO (DNGLOOK dict, re/notes/dungeon.md §0.2) ──────────
export const CellType = {
  Nothing: 0x0,
  LadderUp: 0x1,
  LadderDown: 0x2,
  LadderUpDown: 0x3,
  Chest: 0x4,
  Fountain: 0x5,
  Trap: 0x6, // 0x60 hoyo simple, 0x61/0x69 caída, 0x62/0x6A bomba
  OpenChest: 0x7,
  MagicField: 0x8, // low nibble = tipo de campo; bit 0x8 = variante iluminada
  Marker: 0x9,
  RoomsBroke: 0xa, // sala despejada (no aparece en los datos extraídos)
  Wall: 0xb,
  SpecialWall: 0xc, // muro pesado/secundario; bloquea
  SecretDoor: 0xd, // muro que oculta paso secreto; revelado por Search (Task 3.9)
  NormalDoor: 0xe,
  Room: 0xf, // puerta pesada / entrada de sala → combate
} as const;

/**
 * Efecto de la fuente = nibble BAJO del tile (DNGLOOK:0x0000 rama 0x50).
 * El objetivo es el PJ SELECCIONADO/activo (kernel 0x4988), no toda la party.
 */
export const FountainType = { CurePoison: 0, Heal: 1, Poison: 2, BadTaste: 3 } as const;

/**
 * Trampa = nibble BAJO & 0x7 del tile de tipo 0x6 (on_enter DUNGEON:0x0C76).
 * 0 = hoyo simple (decorativo), 1 = caída encadenada, 2 = bomba.
 */
export const TrapType = { Pit: 0, PitFall: 1, Bomb: 2 } as const;

/**
 * Campo mágico = nibble BAJO & 0x7 del tile de tipo 0x8. Orden REAL del binario
 * (coincide con los muros de CAST: In Zu/Nox/Flam/Sanct Grav).
 */
export const MagicFieldType = { Sleep: 0, Poison: 1, Fire: 2, Energy: 3 } as const;

/** Bit 0x8 del subtipo: variante "iluminada"/visitada del tile. */
export const LIT_BIT = 0x8;
// (LADDER_TRAP_BIT retirado — auditoría D5: era un @deprecated de una mecánica que el
// binario NO tiene, con valor 0x8 que COLISIONABA con LIT_BIT; cablearlo por error
// habría sido un defecto silencioso. Cero consumidores.)

/**
 * Descripciones del (L)ook 3D por nibble ALTO de tile (DNGLOOK 0x0102-0x01e1,
 * strings DATA.OVL DS 0x7618-0x76f0, fileoff = DS+0x10). Los casos especiales
 * (campos 0x8_, muro especial 0xC_, remap 0x61) van aparte en `lookAhead`.
 * Nota: la puerta secreta (0xD_) se describe como "a wall.\n" (DS 0x76d6) — no
 * se delata; RoomsBroke/puerta/sala (0xA_/0xE_/0xF_) = "a heavy door.\n".
 */
const LOOK_DESC: Record<number, string> = {
  [CellType.Nothing]: "a passage.\n", // DS 0x7618
  [CellType.LadderUp]: "an up ladder.\n", // DS 0x7624
  [CellType.LadderDown]: "a down ladder.\n", // DS 0x7634
  [CellType.LadderUpDown]: "a ladder.\n", // DS 0x7644
  [CellType.Chest]: "a wooden chest.\n", // DS 0x7650
  [CellType.Fountain]: "a fountain.\n", // DS 0x7662
  [CellType.Trap]: "a pit.\n", // DS 0x7670
  [CellType.OpenChest]: "an open chest.\n", // DS 0x7678
  [CellType.Marker]: "nothing of note.\n", // DS 0x769a
  [CellType.RoomsBroke]: "a heavy door.\n", // DS 0x76ac
  [CellType.Wall]: "a wall.\n", // DS 0x76bc
  [CellType.SecretDoor]: "a wall.\n", // DS 0x76d6
  [CellType.NormalDoor]: "a heavy door.\n", // DS 0x76e0
  [CellType.Room]: "a heavy door.\n", // DS 0x76f0
};

/**
 * Descripciones del (L)ook 3D para los CAMPOS por tile exacto (DNGLOOK
 * 0x0084-0x00b5; strings DS 0x754c/0x755c/0x7572/0x7584). Variante iluminada
 * (bit 0x8) → "An energy field.\n" (DS 0x7598, rama default 0x009b).
 */
const FIELD_DESC: Record<number, string> = {
  0x80: "A sleep field.\n", // DS 0x754c
  0x81: "A poison gas field.\n", // DS 0x755c
  0x82: "A wall of fire.\n", // DS 0x7572
  0x83: "An electric field.\n", // DS 0x7584
};

const WALL = Object.freeze<DungeonCell>({ type: CellType.Wall, sub: 0 });

const DELTA: Record<Facing, readonly [number, number]> = {
  north: [0, -1],
  east: [1, 0],
  south: [0, 1],
  west: [-1, 0],
};
const RIGHT: Record<Facing, Facing> = {
  north: "east",
  east: "south",
  south: "west",
  west: "north",
};
const LEFT: Record<Facing, Facing> = {
  north: "west",
  west: "south",
  south: "east",
  east: "north",
};

const N = 8; // plantas y lado del grid

function key(floor: number, x: number, y: number): string {
  return `${floor}:${x}:${y}`;
}

/**
 * LECTURA CANÓNICA de una celda de mazmorra de los datos: `floors[floor][y][x]`, con fuera
 * de rango = Wall. FUENTE ÚNICA compartida — la usan `DungeonState.cellAt` (y por tanto
 * `buildGemView`) y el selector de mapa de debug (teleportPicker): si ambos leen por ESTE
 * código, no pueden divergir en la indexación (mandato del testigo: «mira cómo lo hace el
 * view gem»). NO aplica overrides de runtime (cofres abiertos) — eso lo añade cellAt.
 */
export function dungeonCellAt(d: DungeonData, floor: number, x: number, y: number): DungeonCell {
  if (floor < 0 || floor >= N || x < 0 || x >= N || y < 0 || y >= N) return WALL;
  return d.floors[floor]?.[y]?.[x] ?? WALL;
}

export class DungeonState {
  pos: DungeonPos;
  /** "f:x:y" de puertas secretas ya reveladas por Search. */
  readonly revealed = new Set<string>();
  /** Monstruo ERRANTE 3D (anim-slots 1-2 del binario; re/notes/dungeon-wanderer.md).
   *  Transiente como el resto de la sesión 3D (el .GAM nativo no representa la
   *  posición de mazmorra; el binario lo re-arma en cada entrada igualmente). */
  wanderer: WandererState = inactiveWanderer();
  /** Toggle del gate Quickness (DUNGEON 0x0F25 `di ^= 1`): bajo Rel Tym el mundo
   *  avanza turnos ALTERNOS. Transiente. */
  private quicknessToggle = 0;

  private readonly byLocation = new Map<number, DungeonData>();
  /** Celdas mutadas en runtime; fuente de verdad para serializar. */
  private readonly overrides = new Map<string, DungeonCell>();
  private readonly rng: OriginalRng;

  /**
   * Clona los datos de mazmorra para aislar mutaciones (abrir cofres, disparar
   * trampas) del JSON compartido. `rng` inyectable para paridad: por defecto una
   * semilla estable, el arnés de paridad pasa la del snapshot del binario.
   */
  constructor(dungeons: DungeonData[], pos: DungeonPos, rng?: OriginalRng) {
    for (const d of dungeons) {
      this.byLocation.set(d.location, structuredClone(d));
    }
    this.pos = { ...pos };
    this.rng = rng ?? new OriginalRng(1);
  }

  private current(): DungeonData | undefined {
    return this.byLocation.get(this.pos.dungeon);
  }

  /** Celda en (floor,x,y) de la mazmorra actual. Fuera de rango = Wall. */
  cellAt(floor: number, x: number, y: number): DungeonCell {
    const ov = this.overrides.get(key(floor, x, y));
    if (ov) return ov;
    const d = this.current();
    if (!d) return WALL;
    return dungeonCellAt(d, floor, x, y);
  }

  /** Celda a `steps` en la dirección de vista, en la planta actual. */
  cellAhead(steps: number): DungeonCell {
    const [dx, dy] = DELTA[this.pos.facing];
    return this.cellAt(this.pos.floor, this.pos.x + dx * steps, this.pos.y + dy * steps);
  }

  /**
   * Bloqueo de movimiento (DUNGEON:0x0502 / 0x1C0C): sólo muros bloquean el
   * paso — nibble alto ∈ {0xB,0xC,0xD}. Todo lo demás (incluidos hoyos, campos,
   * puertas pesadas, salas) es transitable; el campo de energía (0x83) bloquea
   * aparte, gestionado en `step`. Las puertas secretas (0xC) sólo pasan si
   * fueron reveladas por Search.
   */
  isPassable(cell: DungeonCell, floor: number, x: number, y: number): boolean {
    switch (cell.type) {
      case CellType.Wall:
      case CellType.SpecialWall:
        return false;
      case CellType.SecretDoor:
        return this.revealed.has(key(floor, x, y));
      default:
        return true;
    }
  }

  forward(state: GameState): DungeonEvent[] {
    // ECO DE MOVIMIENTO (DUNGEON move() 0x0502, rama dir==3 @0x0542): imprime
    // "Advance\n" (DS 0x2cc0, DATA.OVL fileoff 0x2cd0) ANTES de resolver el paso
    // (el "Blocked!"/"Ouch!" posterior cae en la línea siguiente, como el binario).
    const [dx, dy] = DELTA[this.pos.facing];
    return [{ kind: "message", text: "Advance\n" }, ...this.step(state, dx, dy)];
  }

  back(state: GameState): DungeonEvent[] {
    // Rama dir==4 @0x064a: "Back up\n" (DS 0x2ce6) antes del paso hacia atrás.
    const [dx, dy] = DELTA[this.pos.facing];
    return [{ kind: "message", text: "Back up\n" }, ...this.step(state, -dx, -dy)];
  }

  /**
   * (U)se Cetro de Lord British en mazmorra — disuelve el campo mágico de la celda
   * que el grupo ENCARA. CAST 0x1966: el barrido 3×3 del overworld (0x1997-0x19f9)
   * SALTA las mazmorras (gate `g_location ∈ 0x21..0x28`, 0x199e), así que en mazmorra
   * el contador de barreras queda en 0 y SIEMPRE cae la rama residente 0x1a04
   * (`call 0xffffc126`): devuelve 1 → el llamante imprime "Field dissolved!" (0x496f);
   * 0 → "No effect!" (0x4981). La geometría exacta de esa rutina vive por encima del
   * techo del disasm (0xffffc126 = kernel residente sin resolver estáticamente); la
   * lectura conservable — la celda ENCARADA, la «barrera de luz violeta» que corta el
   * paso (energy field 0x83, `Electric field!`) — es la única defendible sin testigo
   * vivo y casa con el mensaje SINGULAR "Field dissolved!". Restaura a suelo (Nothing),
   * conservando sólo el bit iluminado. Devuelve true si disolvió un campo.
   */
  dissolveFacingField(): boolean {
    const [dx, dy] = DELTA[this.pos.facing];
    const nx = (this.pos.x + dx + N) % N;
    const ny = (this.pos.y + dy + N) % N;
    const cell = this.cellAt(this.pos.floor, nx, ny);
    if (cell.type !== CellType.MagicField) return false;
    this.setCell(this.pos.floor, nx, ny, { type: CellType.Nothing, sub: cell.sub & LIT_BIT });
    return true;
  }

  /**
   * In Flam / In Nox / In Zu / In Sanct Grav en MAZMORRA — `CAST.OVL cast_field_wall`
   * 0x004c, rama `g_location < 0x80` (`0054 cmp byte [g_location],0x80` / `jb 0x5e`).
   * Hasta ahora el clon **sólo** tenía la creación de campo por la vía de SOBREMUNDO,
   * que el binario NO tiene y que su propia máscara hace inalcanzable: `DS:0x1C90` vale
   * `0x03` (mazmorra+combate) para los cuatro (índices 14/15/16/20), leído del volcado
   * estático Y de la RAM viva — `re/notes/field-grav-gate-testigo-20260808.md`. Con ella
   * el clon sabía MIRAR un campo, PISARLO y DISOLVERLO (`dissolveFacingField`) y no podía
   * crearlo.
   *
   * Las tres piezas, calcadas:
   *  1. CELDA = la de enfrente. El binario indexa las tablas de delta por la orientación
   *     (`0071 g_dng_facing`, `*2` → `word[si+0x24d6]` / `word[si+0x24de]`), suma la
   *     posición del grupo y **enmascara los dos ejes** (`0086` y `0096` `and ax,7`).
   *     Aquí es el mismo idioma que `dissolveFacingField` y `step`: `DELTA[facing]` +
   *     wrap toroidal `% N` (con N=8 y delta ±1, `(v+d+8)%8` ≡ `(v+d)&7`).
   *  2. GUARDA `00b8 test byte [bp-8],0xf7` / `jne` → sólo escribe si el byte del tile
   *     es 0x00 o 0x08, o sea **suelo vacío** (y su variante iluminada). Sobre cualquier
   *     otra cosa devuelve 0 (`00be`) ⇒ el tail 0x11a6 imprime "Failed!" (DS 0x4660).
   *  3. ESCRITURA `00c6 al = tile & 8` / `00ce or al,[bx+0x4596]` / `00e6` → **conserva
   *     el bit 3** y le pone la clase. Es la NORMA del overlay al reescribir terreno de
   *     mazmorra, la misma que ya calca `openDungeonChest` (`134a-1351`, `sub & LIT_BIT`);
   *     la excepción es `an_ylem_dissolve_tile`, que escribe plano.
   *
   * En ÉXITO el binario devuelve 0xFFFF (`0103`), que **no es ni 1 ni 0** ⇒ la cola común
   * no imprime nada: sembrar un muro es SILENCIOSO. Sólo el fallo habla.
   * Cero RNG en toda la rama 0x004c-0x00ea.
   *
   * `fieldTile` es el byte de `DS:0x4596` (0x80..0x83); su nibble bajo es el tipo, que
   * coincide con `MagicFieldType` (Sleep 0 · Poison 1 · Fire 2 · Energy 3).
   */
  applyFieldWall(fieldTile: number): DungeonEvent[] {
    const [dx, dy] = DELTA[this.pos.facing];
    const nx = (this.pos.x + dx + N) % N;
    const ny = (this.pos.y + dy + N) % N;
    const cell = this.cellAt(this.pos.floor, nx, ny);
    // `tile & 0xf7`: nibble alto libre Y bits 0-2 del bajo a cero. Sólo el 0x8 pasa.
    if (cell.type !== CellType.Nothing || (cell.sub & 0x7) !== 0) {
      return [{ kind: "message", text: "Failed!" }]; // res=0 → tail 0x11a6, DS 0x4660
    }
    this.setCell(this.pos.floor, nx, ny, {
      type: CellType.MagicField,
      sub: (fieldTile & 0x0f) | (cell.sub & LIT_BIT),
    });
    return []; // res=0xFFFF ⇒ ni "Success!" ni "Failed!": silencio
  }

  /**
   * An Grav en MAZMORRA — `CAST2.OVL:0x07bc`, rama `g_location < 0x80` (gate `07c4
   * cmp byte [g_location],0x80 / jb`). Ficha #319; acta `re/notes/hechizos-inertes-319.md`
   * §4, cuerpo re-careado entero (0x07bc-0x08e6) sobre este árbol. El DUAL de
   * `applyFieldWall`: aquélla siembra el campo, ésta lo destruye.
   *
   * Las tres piezas, calcadas:
   *  1. PRIMERO la celda BAJO el grupo (`07f2-0820`: dirección `(g_floor<<6) +
   *     (g_party_y<<3) + g_party_x + 0x595a`; `081c and al,0xf0 / cmp al,0x80 /
   *     je 0x840` — CUALQUIER campo, las cuatro clases y sus variantes iluminadas).
   *  2. Si no hay campo bajo los pies, la celda DE ENFRENTE (`0822-083d`): los deltas
   *     salen de las tablas por orientación `word[facing*2+0x24d6]` (dx) y
   *     `word[facing*2+0x24de]` (dy) — leídas en crudo de DATA.OVL: dx=(0,1,0,-1),
   *     dy=(-1,0,1,0) = exactamente `DELTA` — **con envolvimiento `and ax,7` en los
   *     DOS ejes** (`0827`/`0831`): la celda de enfrente da la vuelta al toro 8×8,
   *     nunca sale de la planta. Mismo idioma que `applyFieldWall`/`step`
   *     (`(v+d+8)%8 ≡ (v+d)&7`).
   *  3. ÉXITO (`084b and byte [bx],8`): la máscara CONSERVA el bit 3 (iluminado) y
   *     borra todo lo demás — la celda queda en suelo (0x00/0x08), NO en cero plano.
   *     Emite `Field destroyed!\n` (DS 0x954c, crudo `Field destroyed!\n\0`, contigua
   *     a la `", ` de In Wis) y devuelve 0xFFFF ⇒ la cola común 0x11a6 NO añade nada.
   *     FALLO (`085e`): res=0 ⇒ la cola imprime "Failed!" (DS 0x4660) — lo emite aquí
   *     el evento, como en `applyFieldWall`.
   *
   * CERO llamadas a rand_range en la rama (< 0x80) entera. La rama de COMBATE
   * (`0x0866`: cursor de apuntado + barrido de las 32 ranuras del pool buscando
   * `tile & 0xfc == 0xe8` y BORRADO del acierto con seis ceros vía write_object_slot
   * — CAST2 0x0886-0x08c1) queda SIN cablear: tras la unificación del pool (#103,
   * `actorPool.ts`) el bloqueo ya no es la partición sino que la ARENA del clon no
   * modela los campos 0xE8-0xEB en absoluto (`fieldWall` es no-op en combate, así que
   * no hay nada que disipar) ni comparte la tabla de actores. Derivación y qué falta
   * exactamente: re/notes/pool-103-unificacion-acta.md §5.
   */
  anGravDispel(): DungeonEvent[] {
    // 1. Bajo el grupo (0x07f2-0x0820).
    let cx = this.pos.x;
    let cy = this.pos.y;
    let cell = this.cellAt(this.pos.floor, cx, cy);
    if (cell.type !== CellType.MagicField) {
      // 2. La de enfrente, con el `and 7` de 0x0827/0x0831 (0x0822-0x083d).
      const [dx, dy] = DELTA[this.pos.facing];
      cx = (this.pos.x + dx + N) % N;
      cy = (this.pos.y + dy + N) % N;
      cell = this.cellAt(this.pos.floor, cx, cy);
    }
    // Re-test común de 0x0840 (para la celda bajo los pies es el MISMO test repetido).
    if (cell.type !== CellType.MagicField) {
      return [{ kind: "message", text: "Failed!" }]; // res=0 → cola 0x11a6, DS 0x4660
    }
    // `and byte [bx], 8` (0x084b): suelo conservando SOLO el bit iluminado.
    this.setCell(this.pos.floor, cx, cy, { type: CellType.Nothing, sub: cell.sub & LIT_BIT });
    return [{ kind: "message", text: "Field destroyed!" }]; // DS 0x954c; res=0xFFFF ⇒ cola muda
  }

  /**
   * An Sanct en MAZMORRA — `CAST.OVL:0x02d2`, rama `0x20 < g_location < 0x80`
   * (gates `02da cmp [g_location],0x20 / ja` + `02e4 cmp,0x80 / jb` → cuerpo
   * 0x02ee-0x0395). Ficha #286; derivación en `re/notes/an-sanct-286-derivacion.md`.
   * MISMA geometría que `anGravDispel` (#319 §4), sobre COFRES en vez de campos:
   *
   *  1. El jingle (`02ee push 2 → call 0xffffc186` = stub 0x8106 → CAST2:0x0000,
   *     resuelto con dispatch_table — el MISMO stub del acta #319) suena a la
   *     ENTRADA de la rama, antes de saber si hay cofre; aquí lo cubre el
   *     `cast-spell` genérico del (C)ast (aprox. vigente para todos los jingles).
   *  2. PRIMERO la celda BAJO el grupo (`030c-033a`: dirección `(g_floor<<6) +
   *     (g_party_y<<3) + g_party_x + 0x595a`; `0336 and al,0xf0 / cmp al,0x40`
   *     — nibble alto 0x4 = cofre CERRADO, cualquier subtipo).
   *  3. Si no, la DE ENFRENTE (`033c-0356`): deltas por facing de las tablas
   *     DS 0x24d6 (dx) / 0x24de (dy) — las MISMAS de An Grav, = `DELTA` — con
   *     envolvimiento `and 7`/`and cx,7` en LOS DOS ejes (0341/034b): el toro 8×8.
   *  4. Re-test común (`0361-0365`); sin cofre → res=0 (`0390`) ⇒ la cola 0x11a6
   *     imprime "Failed!" (DS 0x4660) — lo emite aquí el evento, como las gemelas.
   *  5. Cofre con TRAMPA (`0367 test byte [bp-0xe],1`, bit 0 del subtipo): imprime
   *     ANTES `Disarmed!\n` (0371 → print_string 0x1850; DS 0x45a1, leída en crudo
   *     `44 69 73 61 72 6d 65 64 21 0a 00`) — la trampa NO se dispara, sólo se
   *     anuncia su desarme. Los subtipos SIN bit 0 no imprimen nada extra.
   *  6. Apertura (`0374-037f`): `tile = (tile & 8) | 0x70` — cofre ABIERTO (0x70,
   *     el mismo que luego vacía el (G)et de `getHere`) conservando SOLO el bit
   *     iluminado; borra trampa Y cerradura de golpe (sin tirada, a diferencia
   *     del jimmy). Imprime `Chest opened!\n` (DS 0x45ac, en crudo) y res=0xFFFF
   *     (`0388`) ⇒ la cola 0x11a6 NO añade "Success!".
   *
   * CERO llamadas a rand_range en la rama entera (llamadas censadas: jingle
   * CAST2:0x0000 · print_string 0x1850 ×2 — nada más entre 0x02ee y 0x0395).
   * La rama nota que NO toca `g_unk_24e6` (el `or ,2` es de la rama de PUERTA,
   * 0x03ca): sin turno extra, como sus gemelas fieldWall/anGravDispel.
   */
  anSanctOpenChest(): DungeonEvent[] {
    // 1. Bajo el grupo (0x030c-0x033a).
    let cx = this.pos.x;
    let cy = this.pos.y;
    let cell = this.cellAt(this.pos.floor, cx, cy);
    if (cell.type !== CellType.Chest) {
      // 2. La de enfrente, con el `and 7` de 0x0341/0x034b (0x033c-0x0356).
      const [dx, dy] = DELTA[this.pos.facing];
      cx = (this.pos.x + dx + N) % N;
      cy = (this.pos.y + dy + N) % N;
      cell = this.cellAt(this.pos.floor, cx, cy);
    }
    // Re-test común de 0x0361-0x0365 (para la celda propia es el MISMO test repetido).
    if (cell.type !== CellType.Chest) {
      return [{ kind: "message", text: "Failed!" }]; // res=0 → cola 0x11a6, DS 0x4660
    }
    const events: DungeonEvent[] = [];
    // 0x0367-0x0371: bit 0 del subtipo = trampa ⇒ "Disarmed!" ANTES de abrir.
    if (cell.sub & 1) events.push({ kind: "message", text: "Disarmed!" }); // DS 0x45a1
    // 0x0374-0x037f: `(tile & 8) | 0x70` — abierto, conservando SOLO el lit.
    this.setCell(this.pos.floor, cx, cy, { type: CellType.OpenChest, sub: cell.sub & LIT_BIT });
    events.push({ kind: "message", text: "Chest opened!" }); // DS 0x45ac; res=0xFFFF ⇒ cola muda
    return events;
  }

  private step(state: GameState, dx: number, dy: number): DungeonEvent[] {
    // WRAP toroidal por eje (DUNGEON:0x057a `or ax,ax; jge; mov [bp-6],7` →
    // x=−1 pasa a 7; 0x0583 `cmp,7; jle; mov [bp-6],0` → x=8 pasa a 0). NO clamp.
    const nx = (this.pos.x + dx + N) % N;
    const ny = (this.pos.y + dy + N) % N;
    const target = this.cellAt(this.pos.floor, nx, ny);

    // Campo de energía: SÓLO el tile EXACTO 0x83 (0x05d7), sin variante iluminada.
    // DUNGEON:0x0470. Rebote + daño a cada miembro; NO se atraviesa.
    if (target.type === CellType.MagicField && target.sub === MagicFieldType.Energy) {
      const ev: DungeonEvent[] = [
        { kind: "message", text: "Ouch!" },
        { kind: "message", text: "Electric field!" },
        // El ZAP del rebote (DUNGEON 0x0470: NB(1,500,20000) @0x4b9, tras los dos
        // prints y el doble invert-flash); el daño de party (far 0x2aa8 @0x04f7)
        // blipea después por miembro dentro de partyRandomDamage.
        { kind: "sfx", sfx: "dungeon-zap" },
      ];
      ev.push(...this.partyRandomDamage(state));
      return ev;
    }

    if (!this.isPassable(target, this.pos.floor, nx, ny)) {
      return [{ kind: "message", text: "Blocked!" }];
    }

    // ERRANTE en el destino (dng_move 0x067c-0x0691): "Blocked!\n" (DS 0x2D23) y
    // no anda — hay que (A)tacarlo o rodearlo. Mismo string que el muro.
    if (this.wandererAt(nx, ny)) {
      return [{ kind: "message", text: "Blocked!" }];
    }

    this.pos.x = nx;
    this.pos.y = ny;
    const events: DungeonEvent[] = [{ kind: "moved" }];
    events.push(...this.onEnterCell(state, target, this.pos.floor, nx, ny));
    return events;
  }

  /**
   * GATE «Not in doorway!» de los giros L/R (DUNGEON move() 0x0502): con la party
   * SOBRE una puerta normal (tile&0xf0 == 0xE0), dir==2 (derecha, @0x0628 `cmp
   * al,0xe0; jne`) imprime DS 0x2cc9 y dir==1 (izquierda, @0x065a) imprime DS
   * 0x2cef — ambas copias = "Not in doorway!\n" — y NO gira (salta el
   * `inc/add facing`). El giro 180° (rama default @0x0533) NO tiene este gate.
   *
   * Nota de datos: en DUNGEON.DAT sólo hay 7 celdas 0xE en las 8 mazmorras y
   * TODAS son pasos rectos (ningún par de vecinos transitables no-colineal), así
   * que ninguna ruta necesita doblar sobre una puerta — el gate no puede atascar
   * la navegación (verificado por barrido de assets/maps/dungeons.json).
   */
  private inDoorway(): boolean {
    return this.cellAt(this.pos.floor, this.pos.x, this.pos.y).type === CellType.NormalDoor;
  }

  turnLeft(): DungeonEvent[] {
    if (this.inDoorway()) return [{ kind: "message", text: "Not in doorway!\n" }]; // DS 0x2cef
    this.pos.facing = LEFT[this.pos.facing];
    // Eco "Turn left\n" (DS 0x2d00, rama dir==1 @0x066e).
    return [{ kind: "message", text: "Turn left\n" }, { kind: "turned" }];
  }

  turnRight(): DungeonEvent[] {
    if (this.inDoorway()) return [{ kind: "message", text: "Not in doorway!\n" }]; // DS 0x2cc9
    this.pos.facing = RIGHT[this.pos.facing];
    // Eco "Turn right\n" (DS 0x2cda, rama dir==2 @0x0636).
    return [{ kind: "message", text: "Turn right\n" }, { kind: "turned" }];
  }

  turnAround(): DungeonEvent[] {
    // ENTER/PERIOD del original: giro 180° (DUNGEON:0x0533 `add facing,2 & 3`),
    // con eco "Turn around.\n" (DS 0x2d0b) y SIN gate de puerta.
    this.pos.facing = LEFT[LEFT[this.pos.facing]];
    return [{ kind: "message", text: "Turn around.\n" }, { kind: "turned" }];
  }

  /**
   * Space = Pass en el pasillo (kernel_cmd_dispatch 0x31F4 con g_location≠0 →
   * imprime "Pass\n" DS 0xa134 y devuelve 1 = turno consumido; la rama "Sheets in
   * irons!" es sólo navegando). El turno lo cobra `dungeonCommand`.
   */
  pass(): DungeonEvent[] {
    // SIN eco propio: el "Pass\n" lo imprime el DESPACHADOR (0x31F4 → 0x3210 → 0x33ea),
    // que es COMÚN a overworld y mazmorra — el binario imprime antes de saltar al
    // handler. Lo emite el call-site de main.ts (`hud.echo(CMD_STRINGS.pass)`) como
    // ECO de comando (con bullet ►), no como mensaje llano.
    return [];
  }

  /**
   * (A)ttack de mazmorra — DUNGEON.OVL 0x1D4A (kernel 0x3216 rama loc≥0x21 →
   * stub 0x7CAA). Imprime "Attack\n" (DS 0x6caa) y ataca la celda ENCARADA
   * (dx/dy[facing] con wrap &7, 0x1d66-0x1d85): si coincide con la posición del
   * MONSTRUO ERRANTE 3D (slot1 +2/+3) arranca su combate de pasillo (0x1db5,
   * 0x5F86 modo 2); si no, rama 0x1e00: "What?\n" (DS 0x6cb2). Devuelve 0 = SIN
   * turno ([bp-2]=0 @0x1d51) en AMBAS ramas (el combate es su propio tiempo).
   * Los códigos post-combate del attack son SÓLO 5/6 (±planta, 0x1db8-0x1dfe);
   * el respawn posterior lo aplica game.endCombat (fa3e(1)+0x134(1) @0x1dd5).
   */
  attack(): DungeonEvent[] {
    const [dx, dy] = DELTA[this.pos.facing];
    const tx = (this.pos.x + dx) & 7;
    const ty = (this.pos.y + dy) & 7;
    if (this.wandererAt(tx, ty)) {
      return [
        { kind: "message", text: "Attack\n" },
        { kind: "combat-corridor", corridorCause: "attack" },
      ];
    }
    return [
      { kind: "message", text: "Attack\n" },
      { kind: "message", text: "What?\n" },
    ];
  }

  /**
   * (G)et en el pasillo — SJOG 0x18CE rama mazmorra (0x18e4 → get_dungeon 0x179E).
   * El kernel (0x3274) SALTA el eco "Get-" cuando loc≥0x21; el overlay imprime
   * "Get\n" (DS 0x8da4 @0x17a6) y mira la celda DE LA PARTY (grid 0x595a):
   *   · cofre cerrado (0x40, @0x17df) → "Must open first!\n" (DS 0x8daa)
   *   · cofre abierto (0x70, @0x17ef) → VACÍA el cofre (`tile &= 8` @0x181a — la
   *     celda deja de ser cofre, solo conserva lit), imprime la cabecera
   *     "contents\nof chest\nYou find:\n" (DS 0x8dbc @0x181f) y recorre las 7 filas
   *     de `dungeonChestLoot(floor)` (0x182b-0x18b4), ACREDITANDO cada pieza
   *     directamente al inventario con apply_item_grant 0x1458 (arg slot=0x20
   *     @0x18a7 ⇒ salta el borrado de objeto 0x177a; el 0x178e marca turno) y
   *     nombrándola (`lootItemName`). NO hay derrame como objetos-suelo (cero
   *     loot_place 0x0F88 en 0x179E) — el "suelo" es el propio tile 0x70 entre
   *     el (O)pen y este (G)et. Contadores simples (oro/llaves/gemas/antorchas/
   *     comida) EXACTOS; poción/scroll nombrados sin mutar (⚠ O-loot, como el
   *     cofre del mundo). RESUELTO residual-3: antes el port fusionaba O+G en
   *     `openChest` y esta rama caía a "Not here!".
   *   · resto → "Not here!\n" (DS 0x8dda @0x18c0)
   * Kernel devuelve 1 = turno. Cita: re/disasm/SJOG.OVL.asm 0x179E;
   * .superpowers/sdd/task-3.9-trap-loot-tables.md §2; DATA.OVL 0x8da4/0x8daa/
   * 0x8dbc/0x8dda.
   */
  getHere(state: GameState): DungeonEvent[] {
    const { floor, x, y } = this.pos;
    const cell = this.cellAt(floor, x, y);
    const events: DungeonEvent[] = [{ kind: "message", text: "Get\n" }];
    if (cell.type === CellType.Chest) {
      events.push({ kind: "message", text: "Must open first!\n" });
    } else if (cell.type === CellType.OpenChest) {
      // `tile &= 8` ANTES de la cabecera (0x181a < 0x181f): la celda queda pasillo.
      this.setCell(floor, x, y, { type: CellType.Nothing, sub: cell.sub & LIT_BIT });
      events.push({ kind: "message", text: "contents\nof chest\nYou find:\n" }); // DS 0x8dbc
      const rand = (lo: number, hi: number): number => this.rng.next(lo, hi);
      for (const grant of dungeonChestLoot(floor, rand)) {
        applyLootGrant(state, grant); // 0x1458 (⚠ O-loot: poción/scroll se nombran sin mutar)
        events.push({ kind: "message", text: lootItemName(grant.id, grant.qty) });
      }
    } else {
      events.push({ kind: "message", text: "Not here!\n" });
    }
    return events;
  }

  /**
   * (J)immy en el pasillo — SJOG 0x0D4A rama mazmorra (0x0d60 → jimmy_dungeon
   * 0x0C3E): DESTRABA (desarma) la trampa de un cofre de la celda de la party.
   *   · El binario abre el picker "Player:" (0x0c4d call 0x8a08); el port usa el
   *     miembro ACTIVO — mismo banco que el picker de Search (search-dungeon-restos).
   *   · cofre SIN trampa (tile&0xf7==0x40, @0x0cb0): sin llaves → "No keys!\n"
   *     (DS 0x8a7c); con llaves → "Key broke!\n" (DS 0x8a86) y −1 llave.
   *   · cofre CON trampa (tile&0xf0==0x40, @0x0cd5): sin llaves → "No keys!\n"
   *     (DS 0x8a92); con llaves → rand(1,0x1e) vs umbral (floor·2 − DEX + 0x1e)>>1
   *     (roster +0xD = DEX, @0x0c9c-0x0ca8): roll > umbral → "Chest unlocked\n"
   *     (DS 0x8a9c) y el tile queda 0x40|lit (trampa desarmada, SIN gastar llave);
   *     roll ≤ umbral → "Key broke!\n" (DS 0x8aac) y −1 llave.
   *   · cofre abierto (0x70) → "Already open!\n" (DS 0x8ab8); resto → "What?\n"
   *     (DS 0x8ac8). Kernel devuelve 1 = turno.
   */
  jimmyHere(state: GameState): DungeonEvent[] {
    const cell = this.cellAt(this.pos.floor, this.pos.x, this.pos.y);
    const events: DungeonEvent[] = [];
    if (cell.type === CellType.Chest && (cell.sub & 0x7) === 0) {
      if (state.keys <= 0) events.push({ kind: "message", text: "No keys!\n" });
      else {
        events.push({ kind: "message", text: "Key broke!\n" });
        state.keys -= 1;
      }
    } else if (cell.type === CellType.Chest) {
      if (state.keys <= 0) {
        events.push({ kind: "message", text: "No keys!\n" });
      } else {
        const ch = this.activeChar(state);
        const dex = ch?.dexterity ?? 0;
        // Umbral 16-bit del binario: shr (unsigned) tras la resta (0x0ca6).
        const threshold = (((this.pos.floor * 2 - dex + 0x1e) & 0xffff) >>> 1);
        const roll = this.rng.next(1, 0x1e); // 0x0cee call rand(1,30)
        if (roll > threshold) {
          events.push({ kind: "message", text: "Chest unlocked\n" });
          // 0x0d1a-0x0d21: tile = (tile&8) + 0x40 → cofre sin trampa, conserva lit.
          this.setCell(this.pos.floor, this.pos.x, this.pos.y, {
            type: CellType.Chest,
            sub: cell.sub & LIT_BIT,
          });
        } else {
          events.push({ kind: "message", text: "Key broke!\n" });
          state.keys -= 1;
        }
      }
    } else if (cell.type === CellType.OpenChest) {
      events.push({ kind: "message", text: "Already open!\n" });
    } else {
      events.push({ kind: "message", text: "What?\n" });
    }
    return events;
  }

  /**
   * Coordenadas (con wrap &7) de la celda OBJETIVO del prompt «Dir-» (kernel de
   * dirección de mazmorra; SJOG 0x0672 / DNGLOOK 0x0028 `call 0xdcae` con
   * g_dng_facing): Ahead = facing tal cual · Here = celda propia · Right =
   * (f+1)&3 · Left = (f+3)&3. Default "ahead" (todos los llamadores previos).
   * El wrap toroidal &7 es el del buffer 0x595A (mismo que search/paso).
   */
  aheadCoords(target: NonNullable<DungeonSearchOpts["target"]> = "ahead"): { x: number; y: number } {
    if (target === "here") return { x: this.pos.x, y: this.pos.y };
    const f =
      target === "right" ? RIGHT[this.pos.facing]
      : target === "left" ? LEFT[this.pos.facing]
      : this.pos.facing;
    const [dx, dy] = DELTA[f];
    return { x: (this.pos.x + dx + N) % N, y: (this.pos.y + dy + N) % N };
  }

  /** ¿La celda MIRADA (target del Dir-, default encarada) es una fuente? (prompt de
   *  bebida del Look, DNGLOOK 0x012f — encadena la bebida de la fuente MIRADA). */
  fountainAhead(target: NonNullable<DungeonSearchOpts["target"]> = "ahead"): boolean {
    const { x, y } = this.aheadCoords(target);
    return this.cellAt(this.pos.floor, x, y).type === CellType.Fountain;
  }

  /**
   * (L)ook — DNGLOOK.OVL 0x0000 (kernel 0x3310 rama 0x20<loc<0x29 → stub 0x7F32;
   * el kernel ya ecoó "Look" DS 0xa1a8 + "...\n" DS 0xa1ae).
   *
   * CADENA Player:/Dir- (F3, mismo patrón F2-T7 del Search — testigo P16
   * «>Look... / Player: Min / Dir-Ahead / You see:»):
   *   1. SELECCIÓN DE MIEMBRO — DNGLOOK @0x0007 `call 0xffffa6f8` = el selector
   *      kernel `resolve_display_char` (el 0x4988 del Search, otro rebase);
   *      ret -1 → ABORTA (@0x0010, sin turno). Cableado en la UI (main.ts) con
   *      `pickCommandChar`, como el Search; el core no usa el índice (el Look no
   *      lee stats — el selector solo ecoa el nombre).
   *   2. GATE DE LUZ (@0x0013, ANTES del Dir-): a oscuras imprime darkness y NO
   *      pregunta dirección.
   *   3. PROMPT «Dir-» — @0x0028 `push g_dng_facing; call 0xffffdcae` (el mismo
   *      kernel de dirección del Search 0x0672): Ahead/Here/Right/Left o aborto;
   *      el resultado (g_cmb_scratch_x/y) es la celda DESCRITA. Llega aquí como
   *      `target` (default "ahead" para los llamadores directos/QoL).
   *
   * Describe la celda OBJETIVO (@0x0038 lee scratch; wrap &7 vía aheadCoords):
   *   · A OSCURAS (sin antorcha NI luz, gate 0x0013 = el de la vista 3D) →
   *     "You see:\ndarkness.\n" (DS 0x752e) y nada más.
   *   · cabecera "You see:\n" (DS 0x7542) + descripción por familia de tile:
   *     - tile EXACTO 0x61 (caída encadenada oculta) se remapea a 0x00 (@0x0070)
   *       → "a passage.\n" (el hoyo trampa NO se ve).
   *     - campos (0x8_): 0x80 "A sleep field.\n" / 0x81 "A poison gas field.\n" /
   *       0x82 "A wall of fire.\n" / 0x83 "An electric field.\n" / variantes
   *       iluminadas → "An energy field.\n" (DS 0x754c/0x755c/0x7572/0x7584/0x7598).
   *     - muro especial (0xC_): por variante de pared del dungeon (g_dng_wall_variant,
   *       fijada por location @0x0e7b: Deceit/Wrong/Covetous=3, Shame/Hythloth=2,
   *       resto=1): 1 → "a dripping stalactite.\n" (0x75aa); 2 → "a caved in
   *       passage.\n" (0x75c2); 3 → rand(1,0xff)==0xff ? "an unfortunate software
   *       pirate.\n" (0x75d8) : "a less fortunate adventurer.\n" (0x75fa).
   *     - resto por nibble alto (tabla 0x7618-0x76f0), ver `LOOK_DESC`.
   *   · fuente encarada (0x5_, @0x012f): el CALLER (UI) abre el prompt
   *     "Will you drink?" (DS 0x7700) vía `fountainAhead` + `drinkFountain(at)`.
   * Kernel devuelve 1 = turno (jmp 0x31ee).
   */
  lookAhead(state: GameState, target: NonNullable<DungeonSearchOpts["target"]> = "ahead"): DungeonEvent[] {
    if (isDark(state)) {
      return [{ kind: "message", text: "You see:\ndarkness.\n" }]; // DS 0x752e
    }
    const { x, y } = this.aheadCoords(target);
    const cell = this.cellAt(this.pos.floor, x, y);
    const raw = ((cell.type << 4) | cell.sub) & 0xff;
    const events: DungeonEvent[] = [{ kind: "message", text: "You see:\n" }]; // DS 0x7542
    if (raw === 0x61) {
      events.push({ kind: "message", text: "a passage.\n" }); // remap @0x0070
      return events;
    }
    if (cell.type === CellType.MagicField) {
      events.push({ kind: "message", text: FIELD_DESC[raw] ?? "An energy field.\n" }); // DS 0x7598
      return events;
    }
    if (cell.type === CellType.SpecialWall) {
      const variant = wallVariant(this.pos.dungeon); // g_dng_wall_variant (0x0e7b-0x0ec4)
      if (variant === 1) events.push({ kind: "message", text: "a dripping stalactite.\n" });
      else if (variant === 2) events.push({ kind: "message", text: "a caved in passage.\n" });
      else if (this.rng.next(1, 0xff) === 0xff)
        events.push({ kind: "message", text: "an unfortunate software pirate.\n" });
      else events.push({ kind: "message", text: "a less fortunate adventurer.\n" });
      return events;
    }
    events.push({ kind: "message", text: LOOK_DESC[cell.type] ?? "nothing of note.\n" });
    return events;
  }


  /**
   * Klimb up/down (DUNGEON:0x1E10 → 0x1C6A). Escaleras: 0x1/0x3 suben,
   * 0x2/0x3 y hoyos (0x6) bajan. En planta 0 + up → SALIR a Britannia; en la
   * planta más profunda con escalera abajo + down → SALIR al Underworld.
   * (El binario NO tiene "trampa de escalera": subir/bajar no daña.)
   *
   * GARFIO (0x1e6e): sin escalera, la party SUBE por el techo si la celda está
   * ILUMINADA (bit 0x08 del tile, `1e52: raw & 8`) Y lleva el Grapple. El bit lit
   * ya vive en `cell.sub` (estático en los datos + preservado al limpiar campos,
   * `&LIT_BIT`), así que no hay flag "visitada" aparte. Sin garfio, esa misma celda
   * iluminada da "Klimb-\nWith What?" (0x6cd6); una celda no-iluminada sin escalera
   * da "Klimb-what?" (0x6cea). Deriv.: `re/notes/klimb-grapple.md §4.1`.
   *
   * PROMPT U/D (1e9c): con escalera ARRIBA Y ABAJO simultáneas el original pide
   * "Klimb-U/D-" (0x6cba) y lee U/↑ (sube), D/↓ (baja) o Space→"Pass" (0x6cc6, sin
   * moverse). La UI (main.ts) detecta el caso con `klimbNeedsChoice` y re-despacha con
   * `dir` = "up"/"down"/"pass"; sin `dir`, el default (sin prompt) sube.
   */
  private klimbCaps(state: GameState): { canUp: boolean; canDown: boolean; lit: boolean } {
    const cell = this.cellAt(this.pos.floor, this.pos.x, this.pos.y);
    const lit = (cell.sub & LIT_BIT) !== 0; // 1e52: raw tile & 8 (variante iluminada)
    const ladderUp = cell.type === CellType.LadderUp || cell.type === CellType.LadderUpDown;
    // Las DOS condiciones de 1988, tal cual:
    const canUp = ladderUp || (lit && !!state.grapple); // 1e5e-1e74: escalera O (lit && garfio)
    const canDown =
      cell.type === CellType.LadderDown ||
      cell.type === CellType.LadderUpDown ||
      cell.type === CellType.Trap; // 1e79-1e8b: escalera-abajo O ambas O hoyo (0x6)
    // ⚠ MEJORA sobre 1988 (ver el docblock de abajo) — y SÓLO cuando el binario no ofrece
    // NADA: si 1988 daba alguna salida, ésta es la que rige y la pareja ni se consulta.
    // Esa guarda no es cosmética: sin ella, en Covetous p5 (0,0) y Doom p6 (1,3) —salas ≥8,
    // que el garfio ya abre HACIA ARRIBA— la pareja añadía un ABAJO que 1988 no tiene, y
    // con las dos direcciones vivas el mando pasa a pedir el prompt "Klimb-U/D-" en una
    // celda donde el original no preguntaba. Así (A) sólo puede convertir un callejón en
    // salida; jamás alterar un desenlace que el binario ya daba.
    if (canUp || canDown) return { lit, canUp, canDown };
    const pareja = this.parejaDeEscaleraBajoSala();
    return { lit, canUp: pareja.up, canDown: pareja.down };
  }

  /**
   * ⚠ DIVERGENCIA DELIBERADA — MEJORA SOBRE 1988, NO calco. Es lo ÚNICO de `klimbCaps`
   * que el binario no hace, y está aquí separado para que se vea de un vistazo.
   *
   * EL DEFECTO QUE REPARA (ficha #347, derivación en `re/notes/salas-selladas-mazmorra.md`):
   * **catorce** celdas de sala del juego tienen los cuatro vecinos a muro y ninguna puerta
   * secreta, y el original te DEVUELVE a esa celda al terminar el combate — `dng_enter_room`
   * guarda g_party_x/y al entrar (DUNGEON.OVL 0x0084/0x008c) y los RESTAURA al salir por las
   * dos ramas (0x00fa-0x0103). Sobre el tile despejado (`0xFn & 0xAF = 0xAn`, 0x00f5) el
   * Klimb de 1988 no acepta nada: arriba exige `hi ∈ {0x10,0x30}` o el bit 0x08 con garfio
   * (0x1e5e-0x1e72), abajo `hi ∈ {0x20,0x30,0x60}` (0x1e79-0x1e89). Y en Doom el binario
   * veta además Uus Por y Des Por (`cmp byte ptr [g_location],0x28`, CAST.OVL 0x0fd2/0x0ffc).
   * Sin esta condición la party se queda encerrada PARA SIEMPRE. Lo reportó un jugador.
   *
   * LA REGLA, y por qué no es un valor inventado: en las catorce, la celda de sala ocupa el
   * sitio del RELLANO de una escalera cuya PAREJA sigue en la planta contigua. Esa relación
   * ya está en los datos del juego; lo único que se restituye es la salida por donde entraste.
   * Sólo se consulta sobre sala YA DESPEJADA (tipo `0xA`): una sala sin pelear no se klimba.
   * Y sólo cuando 1988 no ofrece NINGUNA salida (guarda en `klimbCaps`, razonada allí).
   *
   * ★ EL GARFIO DE 1988 SALVA CUATRO DE LAS CATORCE, Y NO POR DISEÑO. El gate de arriba lee
   * el bit `0x08` del tile CRUDO (`1e52: mov al,[bx+si+0x595a]; and ax,8`) sin mirar el
   * nibble alto — y en una celda de sala ese bit ES el bit 3 del NÚMERO DE SALA. Así que las
   * cinco selladas con sala ≥8 se leen «iluminadas» y con el Grapple el original sube por el
   * techo. Es conflación DEL BINARIO y el port la calca. De esas cinco escapan cuatro
   * (Covetous p5 (0,0) · Shame p6 (7,6) · Hythloth p7 (1,1) · Doom p6 (1,3)); la quinta es
   * la de abajo. ⇒ en 1988 hay **diez** encerronas duras, no catorce, y las otras cuatro
   * dependen de llevar un objeto opcional.
   *
   * ★ COBERTURA 13 DE 14, Y LA QUE FALTA DEBE FALTAR. La única que esta regla no des-sella
   * es **Doom planta 7 (5,7)** — se llega por FOSO (el tile de arriba es `0x6_`, no escalera)
   * y no hay planta 8. Y esa celda es la sala 15 de Doom = `combatmaps` 127 = **la sala del
   * DESENLACE**. Que de ahí no se salga andando es el final del juego, no una trampa: la
   * única sala que (A) no des-sella es la del final del juego, y debe quedarse sellada.
   * Y no se pierde nada al no des-sellarla, porque su sala también es ≥8 (la 15) y el garfio
   * de 1988 SÍ la klimba — sólo que el viaje es de ida y vuelta: se sube al `0x6_` de encima,
   * que es foso de CAÍDA, y `on_enter` (0x0C76, llamado desde el bucle en 0x0f84 tras cada
   * turno) te devuelve a la misma celda. El landing de Klimb no lo impide porque
   * `dng_landing_ok` (0x1C0C) sólo comprueba el destino con `mode≠0`, y Klimb pasa `mode=0`
   * (`1c3c: cmp word ptr [bp+4],0; je 0x1c5f` → devuelve 1 sin mirar el tile). Medido: planta
   * 7 → 7 con garfio.
   *
   * 🔴 NO LA «ARMONICES» DE VUELTA AL BINARIO. Quien la borre por parecer infiel re-compra
   * las 13 encerronas. Guarda: `game/tests/salas-selladas-mazmorra.test.ts` (mutantes
   * «siempre» → abre la sala del desenlace · «nunca» → recompra el cepo).
   */
  private parejaDeEscaleraBajoSala(): { up: boolean; down: boolean } {
    const cell = this.cellAt(this.pos.floor, this.pos.x, this.pos.y);
    if (cell.type !== CellType.RoomsBroke) return { up: false, down: false };
    const { floor, x, y } = this.pos;
    const arriba = floor > 0 ? this.cellAt(floor - 1, x, y).type : null;
    const abajo = floor < N - 1 ? this.cellAt(floor + 1, x, y).type : null;
    return {
      // Escalera-abajo (o ambas) encima ⇒ este suelo ERA su rellano: se sube por ahí.
      up: arriba === CellType.LadderDown || arriba === CellType.LadderUpDown,
      // Escalera-arriba (o ambas) debajo ⇒ este techo ERA su rellano: se baja por ahí.
      down: abajo === CellType.LadderUp || abajo === CellType.LadderUpDown,
    };
  }

  /** ¿(K)limb necesita el prompt "Klimb-U/D-" (0x6cba)? = escalera arriba Y abajo. */
  klimbNeedsChoice(state: GameState): boolean {
    const { canUp, canDown } = this.klimbCaps(state);
    return canUp && canDown;
  }

  klimb(state: GameState, dir?: "up" | "down" | "pass"): DungeonEvent[] {
    const { canUp, canDown, lit } = this.klimbCaps(state);
    // "Pass" (Space en el prompt U/D, 1ed8→0x6cc6): no se mueve. El turno de mazmorra
    // lo cobra `dungeonCommand` (el asm retorna 1 en este brazo, como U/D).
    if (dir === "pass") return [{ kind: "message", text: "Pass" }];
    let goUp: boolean;
    if (canUp && canDown) goUp = dir !== "down"; // U/↑ → sube; D/↓ → baja (1e9c-1ee6)
    else if (canUp) goUp = true;
    else if (canDown) goUp = false;
    // Ni sube ni baja (1f04): la celda iluminada (techo escalable) SIN garfio pide el
    // garfio ("Klimb-\nWith What?"); si ni siquiera hay techo escalable, "Klimb-what?".
    else return [{ kind: "message", text: lit ? "Klimb-\nWith What?" : "Klimb-what?" }];

    const events: DungeonEvent[] = [];
    // change_level (DUNGEON 0x1C6A) IMPRIME SIEMPRE la dirección en 0x1C83 ANTES de
    // cambiar de planta y ANTES del gate de salida (0x1C87): "Up!\n" (DS 0x6c74) al
    // subir, "Down!\n" (DS 0x6c6c) al bajar — incluso cuando el klimb SALE de la
    // mazmorra (rama boundary 0x1CA1). El eco "Klimb-" lo antepone la UI
    // (CMD_STRINGS.klimb, DS 0xa1a0). Task #62.
    if (goUp) events.push({ kind: "message", text: "Up!\n" });
    else events.push({ kind: "message", text: "Down!\n" });
    if (goUp) {
      if (this.pos.floor <= 0) {
        events.push({ kind: "exit-overworld" });
        return events;
      }
      this.pos.floor -= 1;
    } else {
      if (this.pos.floor >= N - 1) {
        events.push({ kind: "exit-underworld" });
        return events;
      }
      this.pos.floor += 1;
    }

    events.push({ kind: "floor-changed" });
    // dng_change_level re-arma el ERRANTE en la planta nueva (0x1CDB call 0x134).
    this.respawnWanderer();
    const dest = this.cellAt(this.pos.floor, this.pos.x, this.pos.y);
    events.push(...this.onEnterCell(state, dest, this.pos.floor, this.pos.x, this.pos.y));
    return events;
  }

  /**
   * Uus Por (sube, dir −1) / Des Por (baja, dir +1) — el hechizo de mazmorra que
   * cambia de planta. Ambos entran a `change_level(dir, mode=1)` (DUNGEON:0x1C6A)
   * desde CAST:0x0FD2 (Uus) / 0x0FFC (Des), resueltos vía el stub CS 0x7c92 →
   * DUNGEON 0x1C6A (thunk `call 0xffffbd12`, tabla overlay-load-layout.md). Deriva
   * verificada instrucción a instrucción en `re/disasm/{CAST,DUNGEON}.OVL.asm`:
   *
   * 1. GATE DE DOOM (CAST 0x0FD2/0x0FFC: `cmp g_location,0x28; jmp 0xee5`): en la
   *    mazmorra Doom (location 0x28 = 40 = LAST_DUNGEON_LOCATION) el hechizo FALLA
   *    EN SILENCIO — 0xee5 es la cola de fallo silencioso (result 0, sin mensaje;
   *    maná y hechizo YA los gastó el dispatcher). No cambia de planta.
   * 2. `change_level` imprime SIEMPRE la palabra de dirección primero (0x1C83):
   *    dir>0 → "Down!" (DS 0x6c6c), dir≤0 → "Up!" (DS 0x6c74).
   * 3. BORDE (0x1C87/0x1C94 → 0x1CA1 ret=1): Up en planta 0 ó Down en planta 7 →
   *    `change_level` devuelve 1 y el handler llama exit_dungeon (stub CS 0x7c9e →
   *    DUNGEON 0x1D08): Up desde la cima → Britannia, Down desde el fondo →
   *    Underworld. Igual que Klimb en el tope.
   * 4. LANDING (dng_landing_ok 0x1C0C con mode=1, 0x1CB3): la celda de la MISMA
   *    (x,y) en la planta destino debe ser pasadizo VACÍO (nibble alto == 0); si
   *    no, "Failed!" (DS 0x6c7a, 0x1CE4) y NO cambia. (Con mode=1 el `or ax,ax;jne`
   *    de 0x1C42 bloquea ante CUALQUIER nibble-alto ≠ 0 — barrido #39, dungeon.md
   *    §4.2. Klimb usa mode=0 y por eso nunca falla el aterrizaje.)
   * 5. Éxito: `g_floor += dir`, se redibuja y el bucle corre el despertar de
   *    dormidos del turno (aquí vía onEnterCell sobre el destino, siempre vacío).
   */
  magicChangeLevel(state: GameState, dir: -1 | 1): DungeonEvent[] {
    // 1. Doom: fallo silencioso, sin mensaje ni cambio (maná/hechizo ya gastados).
    if (this.pos.dungeon === LAST_DUNGEON_LOCATION) return [];
    // 2. Palabra de dirección SIEMPRE primero (0x1C83): "Down!"/"Up!" (literales
    //    separados para que el extractor de strings del manifiesto los cace).
    const events: DungeonEvent[] = [];
    if (dir > 0) events.push({ kind: "message", text: "Down!" });
    else events.push({ kind: "message", text: "Up!" });
    // 3. Borde → SALIR (change_level ret 1 → exit_dungeon 0x1D08).
    if (dir < 0 && this.pos.floor <= 0) {
      events.push({ kind: "exit-overworld" });
      return events;
    }
    if (dir > 0 && this.pos.floor >= N - 1) {
      events.push({ kind: "exit-underworld" });
      return events;
    }
    // 4. Landing (mode=1): pasadizo vacío (nibble alto 0) o "Failed!".
    const nf = this.pos.floor + dir;
    const dest = this.cellAt(nf, this.pos.x, this.pos.y);
    if (dest.type !== CellType.Nothing) {
      events.push({ kind: "message", text: "Failed!" });
      // DUNGEON 0x1ce4: print «Failed!» (DS 0x6c7a) + glide(800→2000,1,50) @0x1cfb.
      events.push({ kind: "sfx", sfx: "dungeon-fail" });
      return events;
    }
    // 5. Cambia de planta (posición x,y conservada) + housekeeping del turno.
    this.pos.floor = nf;
    events.push({ kind: "floor-changed" });
    // Misma cola que el klimb: change_level re-arma el ERRANTE (0x1CDB).
    this.respawnWanderer();
    events.push(...this.onEnterCell(state, dest, nf, this.pos.x, this.pos.y));
    return events;
  }

  /**
   * Search en mazmorra (`search_dungeon`, SJOG:0x0646). DIRECCIONAL en la dirección
   * de vista (`g_dng_facing`, 0x0672): inspecciona la celda de DELANTE (no los 4
   * vecinos), imprime `You find:` (0x06d4) y describe el tile según su nibble alto
   * (dispatch 0x06db). Strings byte-exactos de DATA.OVL. video-N f030.
   *
   * E1: direccional-ahead + `You find:` + mensajes `Nothing hidden…` + revelado de
   * puerta secreta (0xD → 0x08c2). E4-2: detección de trampa de COFRE (0x40, 0x0710)
   * y BOMBA (0x62, 0x07c6) con `rand(1,30)`[+`rand(1,8)`] contra el threshold, y las
   * revelaciones del foso 0x61→0x60 y el desarme de la bomba 0x62→hoyo. PENDIENTE
   * (E4-3): el crumble del muro especial 0xC (0x0856, `It crumbles away.`, muta el mapa).
   *
   * CADENA F2-T7 (espejo fase 2; CABLEADA — antes bancada) — la cadena de
   * presentación del testigo P16 «>Search... / Player: Min / Dir-Ahead / You find:»:
   *  1. SELECCIÓN DE MIEMBRO — search_dungeon arranca con `call 0xffff8a08` (0x064e)
   *     = kernel **0x4988** (rebase SJOG +0xbf80), el selector `resolve_display_char`:
   *     en combate → actor actual; con Set-Active (g_active_char≠0xff) → ese miembro
   *     SIN prompt; con ≤1 consciente → ese SIN prompt; si no → print `Player: `
   *     (DS 0xa3c4) + select de roster (0x2e8e) + eco del NOMBRE (0x4a39). ret -1 →
   *     ABORTA la búsqueda (0x0654). Cableado en main.ts vía `pickCommandChar` (el
   *     MISMO helper del (S)earch 2D); el índice elegido llega en `opts.searcherIdx`
   *     y las tiradas de trampa leen su stat (0x06b7 `[idx·32+0x55b5]`, record+0xd).
   *  2. PROMPT DE DIRECCIÓN — `push g_dng_facing; call 0x6c` (0x0672): print `Dir-`
   *     (DS 0x84e6) + getkey en bucle {1,2,3,4,Space} (códigos de FLECHA del kernel):
   *     3→`Ahead` (facing tal cual), 4→`Here` (celda propia), 2→`Right` ((f+1)&3),
   *     1→`Left` ((f+3)&3), Space→`Pass` y aborta (DS 0x84f2/0x84fa/0x8500/0x8508/
   *     0x84ec). Cableado en main.ts (`pendingDungeonSearch`); la celda objetivo
   *     llega en `opts.target` — la búsqueda ya NO es sólo ahead.
   *  3. El mismo patrón abre el (L)ook de mazmorra (DNGLOOK; P16 «>Look... /
   *     Player: Min / Dir-Ahead / You see:») — el Look SIGUE BANCADO (lookAhead
   *     conserva la vía directa; cablearlo es el mismo patrón sobre otra rutina).
   *  Orden del binario respetado por el caller: member-select (0x064e) → gate de
   *  luz (0x065a) → prompt Dir- (0x0672) → You find. El eco «Search...» (DS 0xa204)
   *  y el «Klimb-» single-vía ya estaban cableados (F2-T7 parcial).
   */
  search(state: GameState, opts?: DungeonSearchOpts): DungeonEvent[] {
    // Gate de luz (E4-1, search_dungeon 0x065a): sin antorcha NI hechizo Light la
    // búsqueda ABORTA (no busca). g_torch_mins==0 && g_light_spell_mins==0.
    // String RESUELTO (auditoría de cobertura, ítem search-dungeon-restos): SJOG
    // 0x0668 push DS 0x86de = DATA.OVL fileoff 0x86ee (delta +0x10 estándar) =
    // '\nYou find:\ndarkness.\n' — el PENDIENTE-TESTIGO queda cerrado con cita
    // binaria (el port omitía el 'You find:').
    if ((state.torchTurns ?? 0) <= 0 && (state.lightSpellMins ?? 0) <= 0) {
      return [{ kind: "message", text: "\nYou find:\ndarkness.\n" }];
    }
    // Celda OBJETIVO por el prompt Dir- (0x0672→g_cmb_scratch): Ahead=facing tal
    // cual · Here=celda propia · Right=(f+1)&3 · Left=(f+3)&3 (aquí, las tablas
    // RIGHT/LEFT que ya calcan esa aritmética). Default ahead (llamadores previos
    // y el atajo sin prompt).
    const f = this.pos.facing;
    const targetFacing: Facing =
      opts?.target === "right" ? RIGHT[f] : opts?.target === "left" ? LEFT[f] : f;
    const [dx, dy] = opts?.target === "here" ? [0, 0] : DELTA[targetFacing];
    // WRAP toroidal del ahead (SJOG:0x0698 `and di,7` / 0x06a3 `and ax,7`: la celda
    // inspeccionada se enmascara &7 ANTES del fetch al buffer de mapa 0x595A — el mismo
    // toroide del paso, DUNGEON:0x057a). Sin wrap, buscar desde un borde daba WALL
    // (fuera de rango → cellAt=WALL) y una secreta al otro lado del toroide (p.ej.
    // Hythloth f0 (0,5)→(7,5), la entrada del par r1/r2) era IRREVELABLE: defecto real
    // del port descubierto por el pather del Grand Tour (lote-2 ítem-1).
    const ax = (this.pos.x + dx + N) % N;
    const ay = (this.pos.y + dy + N) % N;
    const cell = this.cellAt(this.pos.floor, ax, ay);
    const events: DungeonEvent[] = [{ kind: "message", text: "You find:" }];
    // 0xD → revela el paso secreto de la celda de delante (0x08c2 muta el tile).
    if (cell.type === CellType.SecretDoor && !this.revealed.has(key(this.pos.floor, ax, ay))) {
      this.revealed.add(key(this.pos.floor, ax, ay));
      events.push({ kind: "message", text: "A hidden door!" });
      return events;
    }
    // Threshold de detección de trampa (0x06b7): `(floor*2 − DEX_buscador + 0x1e)>>1`,
    // DEX del PJ elegido por el selector 0x8a08 (`opts.searcherIdx`, cadena F2-T7)
    // o, sin selección, del ACTIVO. Sin rand. Sólo cofre (0x40) y bomba (0x62). E4-2.
    const searcher =
      opts?.searcherIdx !== undefined
        ? state.characters[opts.searcherIdx]
        : this.activeChar(state);
    const dexS = searcher?.dexterity ?? 15;
    // Resta 16-bit + `shr` SIN SIGNO (SJOG 0x06cf `d1e8`), umbral WORD (0x06d1).
    // Con DEX editada > floor·2+30 el original wrapea a umbral enorme → el
    // rand(1,30) NUNCA lo supera → clasifica trampa SIEMPRE; un `>>` con signo
    // daría "No trap" siempre (auditoría byte-wrap, re/notes/audit-byte-wrap.md).
    const threshold = ((this.pos.floor * 2 - dexS + 0x1e) & 0xffff) >>> 1;
    // Cofre (0x40, 0x0710): rand(1,30); si > thr → "No trap"; si no, rand(1,8)
    // clasifica la trampa (<4 simple, [4,7) genérica, ≥7 compleja). Sólo reporta.
    if (cell.type === CellType.Chest) {
      const roll1 = this.rng.next(1, 30);
      if (roll1 > threshold) {
        events.push({ kind: "message", text: "No trap" });
      } else {
        // rand(1,8): <4 simple (0x0747), [4,7) genérica (0x075a), ≥7 compleja (0x0754).
        const roll2 = this.rng.next(1, 8);
        if (roll2 < 4) events.push({ kind: "message", text: "A simple trap" });
        else if (roll2 < 7) events.push({ kind: "message", text: "A trap" });
        else events.push({ kind: "message", text: "A complex trap" });
      }
      return events;
    }
    // Muro especial 0xC (0x0856): mensaje por `g_dng_wall_variant`. E4-3. La variante
    // NO es un global fijado por Look ni lleva rand: se deriva DETERMINISTA de la
    // MAZMORRA (g_location−0x20, set 0x0e7b-0x0ec4): idx∈{1,4,5}→3, {6,7}→2, else→1.
    // variant 1 → estalactita, 2 → pasaje derrumbado (mensajes §8), 3 → CRUMBLE
    // (muta el muro a 0xB0|(cell&8), 0x0898). Sin rand.
    if (cell.type === CellType.SpecialWall) {
      const variant = wallVariant(this.pos.dungeon);
      if (variant === 1) {
        events.push({ kind: "message", text: "Nothing on the stalactite." });
      } else if (variant === 2) {
        events.push({ kind: "message", text: "Nothing in the caved in passage." });
      } else {
        // ★ SON DOS PRINTS SEGUIDOS, no uno: 0x0868 imprime DS 0x88c8 y 0x086f imprime
        // DS 0x88ea. El port emitía sólo el segundo (familia «mitad del par», #133).
        events.push({ kind: "message", text: "Nothing hidden on the skeleton." }); // DS 0x88c8
        events.push({ kind: "message", text: "It crumbles away." }); // DS 0x88ea
        // Se derrumba a muro normal 0xB0 (conserva el bit iluminado). 0x0898.
        this.setCell(this.pos.floor, ax, ay, { type: CellType.Wall, sub: cell.sub & LIT_BIT });
      }
      return events;
    }
    // Foso (tipo 0x6, 0x0766): por subtipo. 0x60 hoyo → DS 0x8786 ENTERA (sin rand);
    // 0x61 caída → "A pit!" + revela a hoyo simple (sub→0, sin rand); 0x62 bomba →
    // rand(1,30) vs thr → "A bomb trap!" + DESARMA, o "Nothing of note.".
    if (cell.type === CellType.Trap) {
      const t = cell.sub & 0x7;
      if (t === TrapType.Bomb) {
        const roll = this.rng.next(1, 30);
        if (roll > threshold) {
          events.push({ kind: "message", text: "A bomb trap!" });
          // Desarma: `and tile,8` → Nothing (conserva el bit iluminado). 0x07fa.
          this.setCell(this.pos.floor, ax, ay, { type: CellType.Nothing, sub: cell.sub & LIT_BIT });
        } else {
          events.push({ kind: "message", text: "Nothing of note." });
        }
      } else if (t === TrapType.PitFall) {
        events.push({ kind: "message", text: "A pit!" });
        // Revela la caída a hoyo simple (`(tile&8)+0x60` → sub 0). 0x07b0.
        this.setCell(this.pos.floor, ax, ay, { type: CellType.Trap, sub: cell.sub & LIT_BIT });
      } else {
        // ★ Estaba TRUNCADA: el port emitía sólo «in the pit.», que es la COLA de la
        // cadena tras su `\n` interior. El binario (0x077c `mov ax,0x8786` + salto a la
        // cola de impresión) manda la cadena ENTERA, DS 0x8786 = 'Nothing hidden\nin the
        // pit.\n'. El `\n` interior es del texto; el final lo pone el impresor. #133
        events.push({ kind: "message", text: "Nothing hidden\nin the pit." }); // DS 0x8786
      }
      return events;
    }
    // Mensaje `Nothing hidden on the <objeto>.` por nibble alto (dispatch 0x06db),
    // byte-exacto de DATA.OVL. Campos mágicos por subtipo (0x080e); orden de campos
    // = re/notes/dungeon.md §0.2 (0=sueño,1=veneno,2=fuego,3=energía). Cofre
    // (0x4/0x7), foso (0x6) y muro especial 0xC caen al genérico — su rama con
    // rand/mutación (`It crumbles away.`) es de E4 (search_dungeon completo).
    switch (cell.type) {
      case CellType.LadderUp: // 0x1
      case CellType.LadderDown: // 0x2
      case CellType.LadderUpDown: // 0x3 (0x08f6 → 0x070a)
        events.push({ kind: "message", text: "Nothing hidden on the ladder." });
        break;
      case CellType.Fountain: // 0x5 (0x0760)
        events.push({ kind: "message", text: "Nothing hidden on the fountain." });
        break;
      case CellType.MagicField: // 0x8 (0x080e, por subtipo)
        switch (cell.sub & 0x7) {
          case MagicFieldType.Sleep:
            events.push({ kind: "message", text: "A sleep field." });
            break;
          case MagicFieldType.Poison:
            events.push({ kind: "message", text: "A poison gas field." });
            break;
          case MagicFieldType.Fire:
            events.push({ kind: "message", text: "A wall of fire." });
            break;
          case MagicFieldType.Energy:
            events.push({ kind: "message", text: "An electric field." });
            break;
          default:
            events.push({ kind: "message", text: "An energy field." });
        }
        break;
      case CellType.RoomsBroke: // 0xA
      case CellType.NormalDoor: // 0xE
      case CellType.Room: // 0xF (0x08f0)
        events.push({ kind: "message", text: "Nothing hidden on the door." });
        break;
      case CellType.Wall: // 0xB (0x0850)
        events.push({ kind: "message", text: "Nothing hidden on the wall." });
        break;
      default: // 0x0 pasillo, 0x7 cofre abierto, 0x9 marcador, 0xD ya revelada
        events.push({ kind: "message", text: "Nothing of note." });
    }
    return events;
  }

  // ── Comandos sobre la celda actual ────────────────────────────────────────

  /**
   * Drink sobre una fuente (DNGLOOK:0x0000 rama 0x50). Efecto por nibble bajo
   * sobre el PJ SELECCIONADO/activo:
   *   0x50 cura veneno · 0x51 curación TOTAL (hp=maxHp) · 0x52 envenena ·
   *   0x53 (resto) "Bad taste": daño rand(0,7).
   */
  /**
   * ¿La celda actual es una fuente? La UI lo consulta ANTES de despachar el drink
   * para decidir si abre el prompt "Will you drink?" (DNGLOOK 0x0134 `and 0xf0; cmp
   * 0x50`: el prompt sólo aparece sobre una fuente). Fuera de fuente el port mantiene
   * el atajo QoL directo (drinkFountain → "No fountain here.").
   */
  fountainHere(): boolean {
    return this.cellAt(this.pos.floor, this.pos.x, this.pos.y).type === CellType.Fountain;
  }

  drinkFountain(state: GameState, at?: { x: number; y: number }): DungeonEvent[] {
    // `at` (opcional): la fuente ENCARADA — la vía fiel del (L)ook (DNGLOOK 0x01f0
    // bebe la fuente que se MIRA). Sin `at`, el atajo QoL 'd' bebe la celda propia.
    const target = at ?? { x: this.pos.x, y: this.pos.y };
    const cell = this.cellAt(this.pos.floor, target.x, target.y);
    if (cell.type !== CellType.Fountain) return [{ kind: "message", text: "No fountain here." }];
    const ch = this.activeChar(state);
    const idx = ch ? this.indexOf(state, ch) : -1;
    // Switch EXACTO por tile completo (0x50/0x51/0x52/else→daño): un 0x59 (heal
    // con bit iluminado) NO cura, cae en "Bad taste". El veneno escribe 'P'
    // INCONDICIONAL (0x025e). Como el tipo es siempre 0x5, basta el low-nibble.
    switch (cell.sub) {
      case FountainType.CurePoison:
        if (ch) ch.status = "G";
        return [{ kind: "message", text: "Cured!" }];
      case FountainType.Heal:
        if (ch) ch.currentHp = ch.maxHp;
        return [{ kind: "message", text: "Healed!" }, { kind: "damage", amount: 0, charIdx: idx }];
      case FountainType.Poison:
        if (ch) ch.status = "P";
        return [{ kind: "message", text: "Poisoned!" }];
      default: {
        const dmg = this.rng.next(0, 7);
        // "Bad taste." es la ÚNICA rama que pasa por el kernel de daño (DNGLOOK
        // 0x026d push [bp-0xc] slot · 0x027b call → kernel 0x2a52), y 0x2a52 es
        // daño Y presentación: flash de fila del roster (XOR 0x2a28 @0x2a59/0x2a6e)
        // + blip NB(10,1600,2000) (0x223c @0x2a68). El guión entero viaja por el
        // bus "damage-script" (#328), que ya pacea flash+cue por slot — un sfx
        // pelado perdería el flash. Cure/Heal/Poison mutan stats con escrituras
        // directas, sin 0x2a52: mudas y sin flash, fiel.
        const events: DungeonEvent[] = [
          { kind: "message", text: "Bad taste." },
          this.applyDamage(state, ch, dmg),
        ];
        if (idx >= 0) events.push({ kind: "damage-script", slots: [idx] });
        return events;
      }
    }
  }

  /**
   * (O)pen sobre un cofre del PASILLO de mazmorra — SJOG open_dungeon 0x12D4
   * (delegado de (O)pen 0x1374 cuando `0x21 ≤ g_location ≤ 0x28`, @0x1388).
   *
   * RESUELTO residual-3 (chest-residuales): el binario NO acredita ni derrama botín
   * al abrir — el (O)pen solo DESARMA/ABRE: la celda pasa 0x4X → 0x70|(lit) y el
   * botín queda "dentro" del cofre-abierto en el suelo hasta un (G)et posterior
   * (get_dungeon 0x179E, ver `getHere`). El colapso O+G que hacía el port queda
   * retirado; el orden de rand O→G (trampa, luego botín) no cambia.
   *
   * (O)pen 0x12D4 (asm 0x12da-0x1373): lee el tile de la celda DEL PROPIO party en la
   * grid 0x595a; nibble alto 0x40 = cofre cerrado. Selecciona miembro (aquí: el activo,
   * fallback 0 — ⚠ O2, como el cofre del mundo). Si `tile & 7` (bit de trampa, 0x131a)
   * dispara la trampa kernel 0x7050 (= `chestTrap`) sobre el que abre — SIN imprimir
   * "Trapped!" (0x131a→0x1323 llama 0x7050 directo, sin el push 0x8b7e del 0x112C):
   * g_location de mazmorra (0x21-0x28) ≤ 0x7f ⇒ TABLA COMPLETA de tipos (ACID/POISON/
   * BOMB/GAS, DS 0x559e); la restricción a ACID/POISON de 0x2fe6 sólo aplica en
   * COMBATE (loc ≥ 0x80). Después el tile pasa a `(tile&8)+0x70` (0x134a-0x1351 —
   * cofre abierto, conserva lit) y se imprime "Chest opened" (DS 0x8b96 @0x1355).
   *
   * Cita: re/disasm/SJOG.OVL.asm 0x12D4; ULTIMA.EXE.asm 0x2fd0 (rama loc>0x7f =
   * combate); .superpowers/sdd/task-3.9-trap-loot-tables.md §1; DATA.OVL
   * 0x8b96/0x8ba6.
   */
  openChest(state: GameState): DungeonEvent[] {
    const { floor, x, y } = this.pos;
    const cell = this.cellAt(floor, x, y);
    // 0x12D4 despacha con TRES salidas, no dos: 0x8b96 (cofre) · 0x8ba6 "Already Open!"
    // (tile nibble 0x70) · **0x8bb6 "What?"** para ni-una-ni-otra (`mov ax,0x8bb6` en
    // SJOG 0x1368; bytes de DATA.OVL verificados idénticos en las 3 copias, y la
    // convención fileoff=DS+0x10 se auto-valida porque 0x8ba6 da exactamente
    // "Already Open!"). El "No chest here." que el port imprimía aquí era una
    // FABRICACIÓN: esa cadena no existe en ningún binario del original.
    // SAPO REAL cazado por el espejo-2 (2026-07-25): el OCR del LP traía «Open-What?»
    // (eco `Open-` + respuesta `What?`) donde el port respondía la cadena inventada —
    // el testigo tenía razón. Ver game/e2e/espejo-tour/README.md §(O)pen.
    if (cell.type === CellType.OpenChest) return [{ kind: "message", text: "Already Open!" }];
    if (cell.type !== CellType.Chest) return [{ kind: "message", text: "What?\n" }];

    const rand = (lo: number, hi: number): number => this.rng.next(lo, hi);
    const events: DungeonEvent[] = [];
    const opener = state.activeCharacter === 0xff ? 0 : state.activeCharacter;
    const members = state.characters;

    // (O)pen 0x12D4: trampa si el bit 0x7 del tile está puesto (0x131a `test 7`).
    if ((cell.sub & 0x7) !== 0) {
      const trap = chestTrap(this.pos.dungeon, opener, members, rand, state.partySize); // 0x1323 call 0x7050
      // El despachador de trampa kernel 0x2fd0 ABRE con NB(40,3000,500) @0x2fe3
      // (antes del rand de tipo); después, cada golpe 0x2a52 blipea (ACID=1,
      // BOMB=por vivo; POISON/GAS mudos). Carril audio-costuras.
      events.push({ kind: "sfx", sfx: "dungeon-trap" });
      events.push({ kind: "message", text: trap.message }); // "ACID!"/… (0x2fd0 imprime el nombre)
      // ★ #328 — cada golpe es kernel 0x2a52 ENTERO: flash de fila del roster (XOR
      // 0x2a28 @0x2a59/0x2a6e) + blip NB(10,1600,2000), por slot y en orden. Antes
      // el port sólo emitía los cues y el flash de fila no se enseñaba.
      if (trap.damageSlots.length > 0)
        events.push({ kind: "damage-script", slots: trap.damageSlots });
    }
    // Tile 0x40→0x70|(lit) (0x134a-0x1351) + "Chest opened" (DS 0x8b96 @0x1355). El
    // botín NO se toca aquí: lo entrega el (G)et posterior (get_dungeon 0x179E).
    this.setCell(floor, x, y, { type: CellType.OpenChest, sub: cell.sub & LIT_BIT });
    events.push({ kind: "message", text: "Chest opened" }); // DS 0x8b96 (0x1355)
    return events;
  }

  // ── Serialización de mutaciones ──────────────────────────────────────────

  serializeOverrides(): CellOverride[] {
    const out: CellOverride[] = [];
    for (const [k, cell] of this.overrides) {
      const [f, x, y] = k.split(":").map(Number) as [number, number, number];
      out.push({ floor: f, x, y, type: cell.type, sub: cell.sub });
    }
    return out;
  }

  restoreOverrides(list: CellOverride[]): void {
    for (const o of list) {
      this.setCell(o.floor, o.x, o.y, { type: o.type, sub: o.sub });
    }
  }

  // ── Salas despejadas (bitmap persistente g_dng_room_cleared, DNGLOOK 0x093a/0x0844) ──

  /**
   * Al CARGAR la mazmorra (equivalente de DNGLOOK 0x093a, llamado tras cargar el mapa
   * fresco de DUNGEON.DAT): recorre las plantas y degrada cada Room (0xF) cuyo bit de
   * sala-despejada esté puesto a RoomsBroke (0xA), como el binario hace `tile &= 0xAF`.
   * Así una sala ya limpiada en una visita anterior no re-dispara combate al re-entrar.
   */
  applyClearedRooms(state: GameState): void {
    const d = this.current();
    if (!d) return;
    for (let f = 0; f < d.floors.length; f++) {
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const c = d.floors[f]?.[y]?.[x];
          if (!c || c.type !== CellType.Room) continue;
          if (dungeonRoomCleared(state, this.pos.dungeon, c.sub & 0xf)) {
            this.setCell(f, x, y, { type: CellType.RoomsBroke, sub: c.sub & 0xf });
          }
        }
      }
    }
  }

  /**
   * Tras GANAR el combate de una sala (DUNGEON 0x0000: 0x00de marca el bit, 0x00f5 hace
   * `g_dng_map[f][y][x] &= 0xAF` → 0xFn→0xAn EN VIVO): marca el bit persistente y degrada
   * la celda actual a RoomsBroke. Idempotente si ya estaba despejada.
   */
  markCurrentRoomCleared(state: GameState): void {
    this.markRoomClearedAt(state, this.pos.floor, this.pos.x, this.pos.y);
  }

  /**
   * Marca despejada la sala de una CELDA EXPLÍCITA — la de ENTRADA al combate (capturada al
   * DISPARARLO, ver game.ts `startDungeonRoomCombat`), NO la posición final de la party.
   *
   * Auditoría #13 (main 1b964320): dng_enter_room (DUNGEON.OVL 0x0000) guarda la posición de
   * la party AL ENTRAR en 0x0084 (`bp-4=x; bp-6=y`) y, tras la VICTORIA (gate 0x00c7 `or ax,ax;
   * jne` = SÓLO victoria, SIN `cmp g_party,celda`), marca el bit del roomNo (0x00de) + degrada
   * la celda de ENTRADA (0x00f5 `&0xAF`). El defecto del port era leer `this.pos` al CERRAR el
   * combate: si la party no termina sobre la celda-sala (paso de entrada que quedó en la celda
   * de aproximación, o una cadena que la movió) la victoria NO marcaba (medido 2/7 en la cadena
   * de Hythloth). Capturar la celda de entrada replica el 0x0084 del binario y es robusto ante
   * cualquier drift de posición entre el inicio y el fin del combate.
   */
  markRoomClearedAt(state: GameState, floor: number, x: number, y: number): void {
    const cell = this.cellAt(floor, x, y);
    if (cell.type !== CellType.Room && cell.type !== CellType.RoomsBroke) return;
    dungeonMarkRoomCleared(state, this.pos.dungeon, cell.sub & 0xf);
    if (cell.type === CellType.Room) {
      this.setCell(floor, x, y, { type: CellType.RoomsBroke, sub: cell.sub & 0xf });
    }
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  /**
   * on_enter (DUNGEON:0x0C76), tras cada paso o aterrizaje. Orden EXACTO:
   *   1. despertar dormidos (rand(0,63) < 4 por PJ dormido → 'G');
   *   2. clasificar el tile bajo la party y aplicar su efecto.
   */
  private onEnterCell(
    state: GameState,
    cell: DungeonCell,
    floor: number,
    x: number,
    y: number,
  ): DungeonEvent[] {
    const events: DungeonEvent[] = [];
    this.wakeSleepers(state);
    // Turno del ERRANTE (on_enter 0x0C76 @0x0cd9-0x0ceb: tras el despertar y ANTES
    // de clasificar la celda): mover + posible emboscada. Gate `di` (An Tym/Quickness).
    events.push(...this.wandererStep(state));

    // Sala (0xA?/0xF?) → combate de sala, SALVO que ya esté despejada. En el binario
    // (DUNGEON on_enter 0x0d17-0x0d40 y el clasificador de movimiento 0x05ff) tanto 0xF
    // como 0xA re-entran a dng_enter_room (0x0000); la NO-repetición del combate la
    // decide COMBAT 0xB94 (una sala despejada no coloca monstruos). Para este core
    // modal, ambas lecturas convergen: una sala despejada NO lanza combate. "Despejada"
    // = tile ya degradado a RoomsBroke (0xA, por 0x00f5 `&0xAF`) O bit puesto en el
    // bitmap persistente de salas (DNGLOOK 0x0844/0x093a; ver `dungeonRoomCleared`).
    if (cell.type === CellType.Room || cell.type === CellType.RoomsBroke) {
      const cleared =
        cell.type === CellType.RoomsBroke ||
        dungeonRoomCleared(state, this.pos.dungeon, cell.sub & 0xf);
      if (cleared) {
        // Sala ya despejada: el binario ENTRA igual e imprime "Entering room..."
        // (DATA.OVL 0x2c68, DUNGEON 0x0000:0x0008, incondicional al entrar), pero
        // COMBAT 0xB94 no coloca monstruos → sin combate. Reproducimos el eco (sin modal):
        // el silencio sería la infidelidad. El texto "Entering room..." lo emite también
        // game.ts al arrancar el combate normal (misma cadena aprobada).
        events.push({ kind: "message", text: "Entering room..." });
      } else {
        events.push({
          kind: "combat-room",
          roomCombatMapIndex: roomCombatMapIndex(this.pos.dungeon, cell.sub & 0xf),
        });
      }
      return events;
    }

    switch (cell.type) {
      case CellType.MagicField: {
        const field = cell.sub & 0x7;
        if (field === MagicFieldType.Sleep) {
          // String EXACTA del binario (DUNGEON 0x0950 push DS 0x2d53 → DATA.OVL fileoff
          // 0x2d63 'Sleep spell!\n'; el "Sleep field!" anterior era FABRICADO).
          events.push({ kind: "message", text: "Sleep spell!" });
          events.push(...this.contestDex(state, "S"));
          // Consumido → pasa a suelo (conserva sólo el bit iluminado).
          this.setCell(floor, x, y, { type: CellType.Nothing, sub: cell.sub & LIT_BIT });
        } else if (field === MagicFieldType.Poison) {
          // String EXACTA del binario (DUNGEON 0x09ee push DS 0x2d61 → DATA.OVL fileoff
          // 0x2d71 'Poison!\n'; el "Poison field!" anterior era FABRICADO).
          events.push({ kind: "message", text: "Poison!" });
          events.push(...this.contestDex(state, "P")); // el veneno NO limpia el tile
        } else if (field === MagicFieldType.Fire) {
          events.push({ kind: "message", text: "Fire!!" });
          events.push(...this.partyRandomDamage(state));
        }
        // Energy (3) se gestiona en step (bloquea), no se pisa.
        return events;
      }
      case CellType.Trap: {
        const trap = cell.sub & 0x7;
        if (trap === TrapType.PitFall) {
          events.push(...this.pitFall(state, floor, x, y, cell));
        } else if (trap === TrapType.Bomb) {
          events.push({ kind: "message", text: "Bomb Trap!" });
          events.push({ kind: "message", text: "KABOOM!!" });
          events.push(...this.partyRandomDamage(state));
          this.setCell(floor, x, y, { type: CellType.Nothing, sub: cell.sub & LIT_BIT });
        } else {
          events.push({ kind: "message", text: "A pit." }); // 0x60 hoyo simple
        }
        return events;
      }
      case CellType.Fountain:
        events.push({ kind: "message", text: "A fountain." });
        return events;
      case CellType.Chest:
        events.push({ kind: "message", text: "A chest!" });
        return events;
      default:
        return events;
    }
  }

  /**
   * Trampa de foso (DUNGEON:0x0A4C). Cae un nivel por foso, rand(1,8) de daño a
   * cada miembro vivo por caída, y ENCADENA mientras aterrice en otro foso
   * (0x61/0x69). Si atraviesa el fondo (floor→8) sale de la mazmorra al
   * Underworld. Marca el foso de origen como hoyo simple (& 0xF8).
   */
  private pitFall(
    state: GameState,
    floor: number,
    x: number,
    y: number,
    cell: DungeonCell,
  ): DungeonEvent[] {
    const events: DungeonEvent[] = [];
    let curType = cell.type;
    let curSub = cell.sub;
    let f = floor;
    while (curType === CellType.Trap && (curSub & 0x7) === TrapType.PitFall && f < N) {
      events.push({ kind: "message", text: "Pit Trap!" });
      events.push({ kind: "message", text: "Falling..." });
      // Limpia el subtipo del foso que dejamos atrás (0x61 → 0x60).
      this.setCell(f, x, y, { type: CellType.Trap, sub: curSub & 0xf8 });
      f += 1;
      this.pos.floor = f;
      if (f >= N) {
        // Cae fuera de la mazmorra por el fondo → Underworld.
        events.push(...this.partyRandomDamage(state));
        events.push({ kind: "exit-underworld" });
        return events;
      }
      events.push({ kind: "floor-changed" });
      events.push({ kind: "message", text: "      ...splat!" });
      events.push(...this.partyRandomDamage(state));
      const dest = this.cellAt(f, x, y);
      curType = dest.type;
      curSub = dest.sub;
    }
    // Al parar: si la celda de destino es una sala SIN despejar, entra a combate
    // (mismo gate de sala-despejada que `onEnterCell`).
    if (curType === CellType.Room || curType === CellType.RoomsBroke) {
      const cleared =
        curType === CellType.RoomsBroke ||
        dungeonRoomCleared(state, this.pos.dungeon, curSub & 0xf);
      if (cleared) {
        events.push({ kind: "message", text: "Entering room..." }); // sala despejada, sin combate
      } else {
        events.push({
          kind: "combat-room",
          roomCombatMapIndex: roomCombatMapIndex(this.pos.dungeon, curSub & 0xf),
        });
      }
    }
    // dng_pit_fall re-arma el ERRANTE en la planta de aterrizaje (0x0B73 call 0x134).
    this.respawnWanderer();
    return events;
  }

  /**
   * Contest de DEX (campos de sueño/veneno, DUNGEON:0x0948/0x09E6): por cada
   * miembro vivo, si `rand(1,30) ≥ DEX` recibe el estado (NO daño). 1 tirada por
   * miembro; el orden importa para el stream de rand. Cada miembro que CAE suena
   * (carril audio-costuras): el binario parpadea su marcador (far 0x2a28 @0x98f)
   * y emite NB(1,50,3500) (@0x99e sueño / @0xa30 veneno) — cue `field-afflict`,
   * un blip por afligido; los que resisten y los muertos son mudos.
   */
  private contestDex(state: GameState, status: "S" | "P"): DungeonEvent[] {
    // La tirada la consume CADA miembro (rand(1,30) al TOPE del bucle,
    // 0x0970/0x0a09); el check 'D' (0x0986/0x0a1c) sólo salta la ESCRITURA del
    // status, no la tirada → un muerto consume igual del stream.
    const events: DungeonEvent[] = [];
    for (const c of partyMembers(state)) {
      const roll = this.rng.next(1, 30);
      if (c.status !== "D" && roll >= c.dexterity) {
        c.status = status;
        events.push({ kind: "sfx", sfx: "field-afflict" }); // DUNGEON @0x99e/@0xa30
      }
    }
    return events;
  }

  /** rand(1,8) de daño a cada miembro vivo (kernel 0x2AA8). Devuelve un evento
   *  de daño por miembro, en orden de party (para el stream de rand). Cada
   *  miembro dañado suena: 0x2aa8 llama por-miembro a 0x2a52 (`combat-damage` =
   *  blink 0x2a28 + NB(10,1600,2000) @0x2a68) — un blip por vivo, fiel a los
   *  callers de DUNGEON (eléctrico 0x04f7 / foso 0x0aea / bomba-fuego 0x0dc3). */
  private partyRandomDamage(state: GameState): DungeonEvent[] {
    const events: DungeonEvent[] = [];
    for (const c of partyMembers(state)) {
      if (c.status === "D") continue;
      const dmg = this.rng.next(1, 8);
      events.push(this.applyDamage(state, c, dmg));
      events.push({ kind: "sfx", sfx: "combat-damage" }); // kernel 0x2a52 @0x2a68
    }
    return events;
  }

  /** Despierta dormidos: rand(0,63) < 4 (1/16) por PJ con status 'S' → 'G'. */
  private wakeSleepers(state: GameState): void {
    for (const c of partyMembers(state)) {
      if (c.status === "S" && this.rng.next(0, 63) < 4) c.status = "G";
    }
  }

  // ── Monstruo ERRANTE 3D (re/notes/dungeon-wanderer.md) ────────────────────

  /** ¿Errante activo en la planta actual sobre (x,y)? (bloqueo/attack/render). */
  wandererAt(x: number, y: number): boolean {
    const w = this.wanderer;
    return w.type !== WANDERER_INACTIVE && w.floor === this.pos.floor && w.x === x && w.y === y;
  }

  /** Re-arma el errante (fa3e(1)+0x0134(1)): entrada, cambio de planta, foso,
   *  post-combate de pasillo. Consumo de rand calcado (banco → intentos de spawn). */
  respawnWanderer(): void {
    this.wanderer = respawnWanderer(
      this.pos.floor,
      this.pos.x,
      this.pos.y,
      (f, x, y) => this.cellAt(f, x, y).type,
      (lo, hi) => this.rng.next(lo, hi),
    );
  }

  /**
   * Gate `di` del bucle (DUNGEON 0x0F1E-0x0F34): 1 normal, 0 bajo An Tym ('T'),
   * alterna bajo Quickness ('Q'). El toggle es por TURNO consumido.
   */
  private worldAdvances(state: GameState): boolean {
    if (state.timeSpell === "T") return false;
    if (state.timeSpell === "Q") {
      this.quicknessToggle ^= 1;
      return this.quicknessToggle === 1;
    }
    return true;
  }

  /**
   * Turno del errante (on_enter 0x0cd9-0x0ceb): con el mundo avanzando, mueve
   * (0x07E2) y si pisó a la party → EMBOSCADA (0x0B7E): mensaje «Attacked
   * [from the <dir>]!», GIRO de la party hacia el atacante y evento
   * `combat-corridor` (game.ts monta la arena procedural y corre el combate).
   */
  private wandererStep(state: GameState): DungeonEvent[] {
    if (!this.worldAdvances(state)) return [];
    const w = this.wanderer;
    if (w.type === WANDERER_INACTIVE || w.floor !== this.pos.floor) return [];
    const attacked = moveWanderer(
      w,
      this.pos.x,
      this.pos.y,
      (f, x, y) => this.cellAt(f, x, y).type,
      (lo, hi) => this.rng.next(lo, hi),
    );
    if (!attacked) return [];
    const dir = ambushDirection(w, this.pos.x, this.pos.y);
    const events: DungeonEvent[] = [];
    // "Attacked" (0x2D92) [+ " from the " (0x2D9B) + palabra + giro (0x0c1c)] + "!\n" (0x2DBC).
    // i18n COMPUESTO → tf() en el call-site (plantilla en el manifest; la palabra
    // de dirección pasa por t() dentro de tf — doctrina i18n-fixed-vs-composite).
    const facingDir = DIR_TO_FACING[dir]!;
    if (facingDir !== this.pos.facing) {
      events.push({ kind: "message", text: tf("Attacked from the {}!", DIR_WORDS[dir]!) });
      this.pos.facing = facingDir;
      events.push({ kind: "turned" });
    } else {
      events.push({ kind: "message", text: "Attacked!" });
    }
    events.push({ kind: "combat-corridor", corridorCause: "ambush" });
    return events;
  }

  /**
   * Turno de mazmorra SIN movimiento (comandos que consumen turno sin pisar celda:
   * pass/search/open/look/…): el binario corre on_enter ENTERO tras cualquier
   * acción con turno (bucle 0x0F84). Aquí se corre el despertar + el errante; la
   * RE-clasificación de la celda pisada sigue excluida (divergencia documentada,
   * dungeon.md §9-pendiente — fuera del alcance del errante).
   */
  turnTick(state: GameState): DungeonEvent[] {
    this.wakeSleepers(state);
    return this.wandererStep(state);
  }

  /**
   * Arena PROCEDURAL del combate de pasillo (DNGLOOK 0x0D3E + setup 0x117E).
   * `maxPerMap` = byte 0 del registro DS 0x13C2 del tipo (= EnemyDef.maxPerMap).
   */
  buildCorridorArena(maxPerMap: number): CombatMapData {
    const cell = this.cellAt(this.pos.floor, this.pos.x, this.pos.y);
    const sides: SideKind[] = [];
    const DX = [0, 1, 0, -1];
    const DY = [-1, 0, 1, 0];
    for (let d = 0; d < 4; d++) {
      const nx = (this.pos.x + DX[d]! + N) % N;
      const ny = (this.pos.y + DY[d]! + N) % N;
      const t = this.cellAt(this.pos.floor, nx, ny).type;
      // 0x0B9E: pasable (<0xA) → tramo abierto; muro 0xB/0xC/0xD → cerrado+negro;
      // resto (0xA RoomsBroke, 0xE puerta, 0xF sala) → apertura de 5 (0x0A48).
      if (t < 0xa) sides.push("open");
      else if (t === 0xb || t === 0xc || t === 0xd) sides.push("wall");
      else sides.push("doorway");
    }
    return buildCorridorCombatMap(
      {
        ...corridorTilesFor(this.pos.dungeon),
        sides: sides as [SideKind, SideKind, SideKind, SideKind],
        partyCellType: cell.type,
        facing: this.pos.facing,
        monsterType: this.wanderer.type,
        maxPerMap,
      },
      (lo, hi) => this.rng.next(lo, hi),
    );
  }

  private setCell(floor: number, x: number, y: number, cell: DungeonCell): void {
    this.overrides.set(key(floor, x, y), cell);
    const d = this.current();
    const row = d?.floors[floor]?.[y];
    if (row && x >= 0 && x < row.length) row[x] = cell;
  }

  private activeChar(state: GameState): CharacterState | undefined {
    return state.characters[state.activeCharacter] ?? partyMembers(state)[0];
  }

  private indexOf(state: GameState, ch: CharacterState): number {
    return state.characters.indexOf(ch);
  }

  private applyDamage(
    state: GameState,
    ch: CharacterState | undefined,
    amount: number,
  ): DungeonEvent {
    if (!ch) return { kind: "damage", amount };
    const idx = this.indexOf(state, ch);
    ch.currentHp = Math.max(0, ch.currentHp - amount);
    if (ch.currentHp <= 0) {
      ch.status = "D";
      // Kernel 0x2a52 @0x2a91-0x2a9b: si el muerto era g_active_char →
      // g_active_char = 0xff (deselección). En combate el clear equivalente vive
      // en Combat.kill (COMBAT:0x1574, combat.ts) — esta es la vía FUERA de
      // combate (hazards/fosos/fuentes de pasillo que comparten este helper).
      if (state.activeCharacter === idx) state.activeCharacter = 0xff;
    }
    return { kind: "damage", amount, charIdx: idx };
  }
}

/**
 * POSICIÓN de array del mapa de combate de una Room en `combatmaps.json`. La ARITMÉTICA
 * de offset es la del binario (DUNGEON.OVL 0x003a / DNGLOOK 0x0844:
 * offset = dungIdx*0x1600 + room*0x160 en DUNGEON.CBT), pero el dungIdx de aquí NO es el
 * de esas rutinas: el binario colapsa Deceit≡Despise (sub 0x21 · cmp/jl/dec); este
 * `dungeonOrderSkippingDespise` es la variante de Ultima5Redux (Despise≡Destard). Ambas
 * coinciden en las 7 mazmorras CON salas y divergen SOLO en Despise — inerte hoy porque
 * Despise tiene 0 celdas de sala (verificado por datos; ver re/notes/dungeon.md §14.1).
 *
 * Las 112 salas de DUNGEON.CBT son 16 salas × 7 mazmorras (Despise no tiene), y el array
 * de `combatmaps.json` es britannia (16) seguido de dungeon (112) ⇒ el `16 +` sitúa la
 * sala en 16..127. ⚠ El campo `index` de cada entrada es POR TERRITORIO (0..15 y 0..111),
 * NO global: leerlo como global hace creer que faltan las 16 salas de Doom, que es de
 * donde salió la ficha #181 — REFUTADA. Doom ocupa 112..127 y la 127 es el mapa del
 * desenlace. Guarda: `game/tests/salas-selladas-mazmorra.test.ts`; derivación y cardinales
 * careados contra BRIT.CBT/DUNGEON.CBT en `re/notes/salas-selladas-mazmorra.md` §1.
 */
export function roomCombatMapIndex(dungeon: number, roomNumber: number): number {
  return 16 + dungeonOrderSkippingDespise(dungeon) * 16 + roomNumber;
}

/**
 * Variante del muro especial 0xC (`g_dng_wall_variant`, DUNGEON:0x0e7b-0x0ec4).
 * DETERMINISTA por MAZMORRA (idx = location − 0x20): {1,4,5}→3, {6,7}→2, else→1.
 * 1 = estalactita, 2 = pasaje derrumbado, 3 = se derrumba (Search: crumble). No es
 * un global fijado por Look ni consume rand — se re-deriva del número de mazmorra.
 */
export function wallVariant(dungeon: number): number {
  const idx = dungeon - 0x20;
  if (idx === 1 || idx === 4 || idx === 5) return 3;
  if (idx === 6 || idx === 7) return 2;
  return 1;
}

/** location 33..40 → orden 0..6 saltando Despise (34). */
export function dungeonOrderSkippingDespise(dungeon: number): number {
  let order = dungeon - 33; // Deceit = 0
  if (dungeon > 34) order -= 1; // saltar Despise
  return order;
}

// ── Bitmap PERSISTENTE de salas despejadas (g_dng_room_cleared @ DS:0x58E0) ──────
//
// El original recuerda qué SALAS de mazmorra ya despejaste para no re-pelearlas al
// re-entrar. NO es "celda visitada" per-celda: es un bit por (mazmorra, nº de sala).
// Vive en la ventana SAVED.GAM (offset 0x33A; ver `saveNative.ts`). Escritor DNGLOOK
// 0x0844, test 0x08d4, apply-on-entry 0x093a; ver `re/notes/dungeon.md §7` y
// `re/notes/dnglook-raster-spec.md §1`.

/** 14 bytes = 7 mazmorras × 16 salas = 112 bits (dungIdx 0..6, room 0..15). */
export const DUNGEON_ROOMS_CLEARED_BYTES = 14;

/**
 * Índice de bit en el bitmap (DNGLOOK 0x0844 0x088c-0x08c9 / 0x08d4): la mazmorra se
 * reduce a `dungIdx = g_location − 0x21` con `if (dungIdx ≥ 1) dungIdx--`, y el bit es
 * `(dungIdx << 4) + roomNumber` (LSB-first en el byte). ⚠ Esa fórmula COLAPSA Deceit
 * (0x21) y Despise (0x22) al MISMO dungIdx 0 — quirk del binario, replicado para calco
 * byte (distinto del colapso de `dungeonOrderSkippingDespise`, que es Despise≡Destard).
 */
export function dungeonClearedBitIndex(location: number, roomNumber: number): number {
  let idx = location - 0x21;
  if (idx >= 1) idx -= 1;
  return (idx << 4) + (roomNumber & 0xf);
}

/** ¿La sala `roomNumber` de la mazmorra `location` está marcada despejada? */
export function dungeonRoomCleared(state: GameState, location: number, roomNumber: number): boolean {
  const bits = state.dungeonRoomsCleared;
  if (!bits) return false;
  const i = dungeonClearedBitIndex(location, roomNumber);
  return (((bits[i >> 3] ?? 0) >> (i & 7)) & 1) === 1;
}

/**
 * SALAS EXENTAS de marcarse como despejadas — tabla ESTÁTICA del binario.
 *
 * `DATA.OVL 0x384a` (= `DS:0x383a`) = `50 5b 41 46 4b 4c`, con su cuenta `06` CONTIGUA en
 * `0x3850` (= `DS:0x3840`). No la escribe nadie: es dato inicializado de DGROUP (censado por
 * hex+encoding Y por símbolo+offset decimal sobre los 157 globales; 0 escrituras en toda la
 * ventana 0x3820-0x3860). Derivación completa en `re/notes/dungeon.md §14.1.2`.
 *
 * Clave = `((g_location & 0xF) << 4) + roomNumber` — ⚠ usa `& 0xF`, así que **NO colapsa**
 * Deceit≡Despise (a diferencia de `dungeonClearedBitIndex`): dentro de la misma rutina del
 * binario conviven los dos indexados, y ésta es la que no colapsa.
 */
const ROOM_CLEAR_EXEMPT = new Set([
  0x41, // Wrong (loc 36) sala 1  → cm49
  0x46, // Wrong          sala 6  → cm54
  0x4b, // Wrong          sala 11 → cm59
  0x4c, // Wrong          sala 12 → cm60
  0x50, // Covetous (37)  sala 0  → cm64
  0x5b, // Covetous       sala 11 → cm75
]);

/**
 * Marca la sala como despejada en el bitmap persistente (DNGLOOK 0x0844).
 *
 * GUARDA A LA CABEZA (0x0850-0x0887, calcada): si la clave está en `ROOM_CLEAR_EXEMPT`, la
 * rutina sale por el epílogo **sin ejecutar el `or [bx+0x58e0],al`** — el bit NO se pone.
 *
 * No significa «sala invencible»: el llamador (`dng_enter_room` DUNGEON 0x00de) sólo llega
 * aquí DESPUÉS de que COMBAT 0xB94 devuelva 0, o sea con la sala YA peleada. Significa
 * «no lo apuntes». Y el reparto es fino, por eso la guarda va AQUÍ y no en el llamador:
 * `markRoomClearedAt` sigue degradando la celda a `RoomsBroke` sin condición (= el
 * `&0xAF` de 0x00f5, que en el binario tampoco está guardado), así que **dentro de la
 * visita la sala se consume**; lo que se salta es el registro PERSISTENTE. Como
 * `applyClearedRooms` (= 0x093a) sólo degrada las celdas cuyo bit está puesto, al recargar
 * el mapa fresco estas 6 vuelven a estar armadas:
 *
 * ⇒ son las **únicas 6 salas re-jugables por diseño** de las 112 del juego.
 */
export function dungeonMarkRoomCleared(state: GameState, location: number, roomNumber: number): void {
  if (ROOM_CLEAR_EXEMPT.has(((location & 0xf) << 4) + (roomNumber & 0xf))) return;
  const bits = (state.dungeonRoomsCleared ??= new Array(DUNGEON_ROOMS_CLEARED_BYTES).fill(0));
  const i = dungeonClearedBitIndex(location, roomNumber);
  bits[i >> 3] = (bits[i >> 3] ?? 0) | (1 << (i & 7));
}
