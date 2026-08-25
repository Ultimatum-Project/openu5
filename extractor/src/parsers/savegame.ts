/**
 * Parser de INIT.GAM / SAVED.GAM (mismo layout). Ver docs/formats/tlk-npc-dataovl-gam.md §4.
 * INIT.GAM = partida nueva canónica (turnsSinceStart === 0).
 * Todos los offsets son absolutos desde el inicio del fichero. uint16 little-endian.
 */

import {
  u16le,
  fixedString,
  bitmapToBooleans,
  writeU16le,
  writeFixedString,
  booleansToBitmap,
  writeBoolPreserve,
} from "./binary.js";

/** Tamaño íntegro del fichero SAVED.GAM / INIT.GAM (la ventana runtime DS:0x55A6). */
export const SAVED_GAM_SIZE = 0x1060; // 4192 bytes

const CHAR_RECORDS_OFFSET = 0x02;
const CHAR_RECORD_SIZE = 32;
const CHAR_RECORD_COUNT = 16;

const NPC_BITMAP_BYTES = 0x80; // 128 bytes = 1024 bits = 32 locations × 32 npcs
const NPC_LOCATIONS = 32;
const NPC_SLOTS = 32;
const NPC_DEAD_OFFSET = 0x5b4;
const NPC_MET_OFFSET = 0x634;

export interface CharacterRecord {
  name: string;
  /** Byte crudo: 0x0B = masculino, 0x0C = femenino. */
  gender: number;
  /** Carácter ASCII: 'A','B','F','M'. */
  class: string;
  /** Carácter ASCII: 'G'ood,'P'oison,'C'harmed,'S'leep,'D'ead. */
  status: string;
  strength: number;
  dexterity: number;
  intelligence: number;
  currentMp: number;
  currentHp: number;
  maxHp: number;
  exp: number;
  level: number;
  monthsAtInn: number;
  /** 0xFF = nada. */
  helmet: number;
  armor: number;
  weapon: number;
  shield: number;
  ring: number;
  amulet: number;
  /** 0x00 = en party, 0xFF = no unido, otro = nº settlement (en posada). */
  partyStatus: number;
}

export interface Moonstone {
  x: number;
  y: number;
  /** ⇔ `location != 0xFF`: en el mundo (enterrada) vs. en la mochila. */
  buried: boolean;
  /** Z: 0 = Britannia, 0xFF = Underworld. */
  z: number;
  /**
   * Localización donde está enterrada (0 = sobremundo, 1..0x28 pueblo o mazmorra), y
   * `0xFF` = en la mochila. Es el byte 0x29a+i tal cual, que es el `DS 0x5840+i` que
   * escribe `bury_moonstone` CAST.OVL:0x1596-0x1599 con `g_location`. Debe seguir al
   * mismo campo de `game/src/core/state.ts`: los dos serializadores están careados
   * byte a byte y sin él DIVERGEN para una piedra enterrada en un pueblo (#143a).
   */
  location: number;
}

export interface InitialState {
  characters: CharacterRecord[];
  food: number;
  gold: number;
  keys: number;
  gems: number;
  torches: number;
  skullKeys: number;
  grapple: boolean;
  magicCarpets: number;
  specialItems: {
    spyglass: boolean;
    hmsCape: boolean;
    sextant: boolean;
    blackBadge: boolean;
    woodenBox: boolean;
  };
  shards: { falsehood: boolean; hatred: boolean; cowardice: boolean };
  lbArtifacts: { amulet: boolean; crown: boolean; sceptre: boolean };
  /** Cantidad de cada arma/armadura (48 slots, desde 0x21A). */
  equipmentQuantities: number[];
  /** Cantidad de cada hechizo (48, desde 0x24A). */
  spellQuantities: number[];
  /** Scrolls (8, desde 0x27A). */
  scrollQuantities: number[];
  /** Pociones (8, desde 0x282). */
  potionQuantities: number[];
  /** Reagentes (8, desde 0x2AA). */
  reagentQuantities: number[];
  /** 8 moonstones. */
  moonstones: Moonstone[];
  partySize: number;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  karma: number;
  turnsSinceStart: number;
  /** Personaje activo (0-5, 0xFF). */
  activeCharacter: number;
  location: number;
  /** Piso (0xFF = Underworld). */
  floor: number;
  x: number;
  y: number;
  torchTurns: number;
  /**
   * Byte CRUDO de g_shadowlord_here (+0x325, DS:0x58CB): 0xFF = ningún Shadowlord convocado
   * en el ritual (el valor de reposo e init.gam), 0..2 = idx convocado. El extractor NO lo
   * interpreta — lo acarrea para el round-trip byte-exacto, porque desde #238 el codec
   * game-side (`saveNative.ts`) escribe esa celda (0xFF cuando el estado no trae convocado)
   * y el espejo game↔extractor se fija por sha del .GAM canónico. Ausente ⇒ 0xFF.
   */
  shadowlordSummonedByte?: number;
  /** [location-1][npcIndex]: NPC muerto. 32 locations × 32 slots. */
  npcDead: boolean[][];
  /** [location-1][npcIndex]: NPC conocido. 32 locations × 32 slots. */
  npcMet: boolean[][];
}

function parseCharacter(bytes: Uint8Array, base: number): CharacterRecord {
  return {
    name: fixedString(bytes, base + 0x00, 9),
    gender: bytes[base + 0x09]!,
    class: String.fromCharCode(bytes[base + 0x0a]!),
    status: String.fromCharCode(bytes[base + 0x0b]!),
    strength: bytes[base + 0x0c]!,
    dexterity: bytes[base + 0x0d]!,
    intelligence: bytes[base + 0x0e]!,
    currentMp: bytes[base + 0x0f]!,
    currentHp: u16le(bytes, base + 0x10),
    maxHp: u16le(bytes, base + 0x12),
    exp: u16le(bytes, base + 0x14),
    level: bytes[base + 0x16]!,
    monthsAtInn: bytes[base + 0x17]!,
    helmet: bytes[base + 0x19]!,
    armor: bytes[base + 0x1a]!,
    weapon: bytes[base + 0x1b]!,
    shield: bytes[base + 0x1c]!,
    ring: bytes[base + 0x1d]!,
    amulet: bytes[base + 0x1e]!,
    partyStatus: bytes[base + 0x1f]!,
  };
}

function readBytes(bytes: Uint8Array, offset: number, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(bytes[offset + i]!);
  return out;
}

/** Reorganiza un bitmap de 0x80 bytes (MSB-first) en [location-1][npcIndex]. */
function parseNpcBitmap(bytes: Uint8Array, offset: number): boolean[][] {
  const flat = bitmapToBooleans(bytes, offset, NPC_BITMAP_BYTES);
  const out: boolean[][] = [];
  for (let loc = 0; loc < NPC_LOCATIONS; loc++) {
    const row: boolean[] = [];
    for (let npc = 0; npc < NPC_SLOTS; npc++) {
      row.push(flat[loc * NPC_SLOTS + npc]!);
    }
    out.push(row);
  }
  return out;
}

function serializeCharacter(buf: Uint8Array, base: number, c: CharacterRecord): void {
  writeFixedString(buf, base + 0x00, c.name, 9);
  buf[base + 0x09] = c.gender & 0xff;
  buf[base + 0x0a] = c.class.charCodeAt(0) & 0xff;
  buf[base + 0x0b] = c.status.charCodeAt(0) & 0xff;
  buf[base + 0x0c] = c.strength & 0xff;
  buf[base + 0x0d] = c.dexterity & 0xff;
  buf[base + 0x0e] = c.intelligence & 0xff;
  buf[base + 0x0f] = c.currentMp & 0xff;
  writeU16le(buf, base + 0x10, c.currentHp);
  writeU16le(buf, base + 0x12, c.maxHp);
  writeU16le(buf, base + 0x14, c.exp);
  buf[base + 0x16] = c.level & 0xff;
  buf[base + 0x17] = c.monthsAtInn & 0xff;
  // base+0x18 = byte "unknown" (no parseado): se PRESERVA de la plantilla.
  buf[base + 0x19] = c.helmet & 0xff;
  buf[base + 0x1a] = c.armor & 0xff;
  buf[base + 0x1b] = c.weapon & 0xff;
  buf[base + 0x1c] = c.shield & 0xff;
  buf[base + 0x1d] = c.ring & 0xff;
  buf[base + 0x1e] = c.amulet & 0xff;
  buf[base + 0x1f] = c.partyStatus & 0xff;
}

function writeBytes(buf: Uint8Array, offset: number, values: number[]): void {
  for (let i = 0; i < values.length; i++) buf[offset + i] = values[i]! & 0xff;
}

/** Aplana [location-1][npcIndex] → índice flat `loc*32+npc` (inverso de parseNpcBitmap). */
function flattenNpcBitmap(grid: boolean[][]): boolean[] {
  const out: boolean[] = [];
  for (let loc = 0; loc < NPC_LOCATIONS; loc++) {
    for (let npc = 0; npc < NPC_SLOTS; npc++) {
      out.push(grid[loc]?.[npc] ?? false);
    }
  }
  return out;
}

/**
 * INVERSO EXACTO de `parseSaveGame`: produce un SAVED.GAM byte-válido de 4192 bytes
 * PARCHEANDO los campos modelados sobre una `template` (típicamente el propio
 * SAVED.GAM/INIT.GAM base). Los bytes NO modelados (padding, tabla de objetos 0x6B4,
 * character-states 0x9B8, movement lists 0xBB8+, transportTile 0x2D6, etc.) se
 * PRESERVAN de la plantilla — es la técnica "template + patch" del generador av-saves,
 * que evita sintetizar tablas que el parser no lee. `serializeSaveGame(parseSaveGame(x), x)`
 * === x byte a byte (garantía de round-trip; ver savegame.test.ts).
 *
 * ⚠️ El campo `turnsSinceStart` se escribe como u16le en 0x2E5 (ESPEJO del parser). El
 * RE (oracle.py:98) indica que 0x2E5 real es u8 saturante a 0xFF y 0x2E6 es otro
 * contador horario; mirror-write reproduce ambos bytes exactos, pero un porter que
 * quiera fidelidad de semántica debe tratar 0x2E5 como u8 (ver deliberate-divergences).
 */
export function serializeSaveGame(state: InitialState, template: Uint8Array): Uint8Array {
  if (template.length < SAVED_GAM_SIZE) {
    throw new Error(
      `plantilla SAVED.GAM demasiado corta: ${template.length} < ${SAVED_GAM_SIZE}`,
    );
  }
  const buf = template.slice(0, SAVED_GAM_SIZE); // copia; preserva los bytes oscuros

  for (let i = 0; i < CHAR_RECORD_COUNT; i++) {
    serializeCharacter(
      buf,
      CHAR_RECORDS_OFFSET + i * CHAR_RECORD_SIZE,
      state.characters[i]!,
    );
  }

  writeU16le(buf, 0x202, state.food);
  writeU16le(buf, 0x204, state.gold);
  buf[0x206] = state.keys & 0xff;
  buf[0x207] = state.gems & 0xff;
  buf[0x208] = state.torches & 0xff;
  writeBoolPreserve(buf, 0x209, state.grapple);
  buf[0x20a] = state.magicCarpets & 0xff;
  buf[0x20b] = state.skullKeys & 0xff;
  writeBoolPreserve(buf, 0x20d, state.lbArtifacts.amulet);
  writeBoolPreserve(buf, 0x20e, state.lbArtifacts.crown);
  writeBoolPreserve(buf, 0x20f, state.lbArtifacts.sceptre);
  writeBoolPreserve(buf, 0x210, state.shards.falsehood);
  writeBoolPreserve(buf, 0x211, state.shards.hatred);
  writeBoolPreserve(buf, 0x212, state.shards.cowardice);
  writeBoolPreserve(buf, 0x214, state.specialItems.spyglass);
  writeBoolPreserve(buf, 0x215, state.specialItems.hmsCape);
  writeBoolPreserve(buf, 0x216, state.specialItems.sextant);
  writeBoolPreserve(buf, 0x218, state.specialItems.blackBadge);
  writeBoolPreserve(buf, 0x219, state.specialItems.woodenBox);
  writeBytes(buf, 0x21a, state.equipmentQuantities);
  writeBytes(buf, 0x24a, state.spellQuantities);
  writeBytes(buf, 0x27a, state.scrollQuantities);
  writeBytes(buf, 0x282, state.potionQuantities);
  writeBytes(buf, 0x2aa, state.reagentQuantities);

  for (let i = 0; i < 8; i++) {
    const m = state.moonstones[i]!;
    buf[0x28a + i] = m.x & 0xff;
    buf[0x292 + i] = m.y & 0xff;
    // El byte ES la localización: se escribe entera (CAST.OVL:0x1599), con 0xFF de
    // centinela para «en la mochila» (SJOG.OVL:0x1496). Antes había aquí una guarda de
    // preservación que existía sólo porque el modelo no tenía el campo; ahora lo tiene.
    buf[0x29a + i] = m.buried ? m.location & 0xff : 0xff;
    buf[0x2a2 + i] = m.z & 0xff;
  }

  buf[0x2b5] = state.partySize & 0xff;
  writeU16le(buf, 0x2ce, state.year);
  buf[0x2d5] = state.activeCharacter & 0xff;
  buf[0x2d7] = state.month & 0xff;
  buf[0x2d8] = state.day & 0xff;
  buf[0x2d9] = state.hour & 0xff;
  buf[0x2db] = state.minute & 0xff;
  buf[0x2e2] = state.karma & 0xff;
  writeU16le(buf, 0x2e5, state.turnsSinceStart); // ESPEJO del parser (u16); ver ⚠ arriba
  buf[0x2ed] = state.location & 0xff;
  buf[0x2ef] = state.floor & 0xff;
  buf[0x2f0] = state.x & 0xff;
  buf[0x2f1] = state.y & 0xff;
  buf[0x301] = state.torchTurns & 0xff;
  // Espejo de saveNative (#238): la celda se ESCRIBE siempre; sin dato = 0xFF (reposo).
  buf[0x325] = (state.shadowlordSummonedByte ?? 0xff) & 0xff;
  booleansToBitmap(buf, NPC_DEAD_OFFSET, flattenNpcBitmap(state.npcDead), NPC_BITMAP_BYTES);
  booleansToBitmap(buf, NPC_MET_OFFSET, flattenNpcBitmap(state.npcMet), NPC_BITMAP_BYTES);

  return buf;
}

export function parseSaveGame(bytes: Uint8Array): InitialState {
  const characters: CharacterRecord[] = [];
  for (let i = 0; i < CHAR_RECORD_COUNT; i++) {
    characters.push(
      parseCharacter(bytes, CHAR_RECORDS_OFFSET + i * CHAR_RECORD_SIZE),
    );
  }

  const moonstones: Moonstone[] = [];
  for (let i = 0; i < 8; i++) {
    moonstones.push({
      x: bytes[0x28a + i]!,
      y: bytes[0x292 + i]!,
      buried: bytes[0x29a + i]! !== 0xff,
      location: bytes[0x29a + i]!,
      z: bytes[0x2a2 + i]!,
    });
  }

  return {
    characters,
    food: u16le(bytes, 0x202),
    gold: u16le(bytes, 0x204),
    keys: bytes[0x206]!,
    gems: bytes[0x207]!,
    torches: bytes[0x208]!,
    grapple: bytes[0x209]! !== 0,
    magicCarpets: bytes[0x20a]!,
    skullKeys: bytes[0x20b]!,
    lbArtifacts: {
      amulet: bytes[0x20d]! !== 0,
      crown: bytes[0x20e]! !== 0,
      sceptre: bytes[0x20f]! !== 0,
    },
    shards: {
      falsehood: bytes[0x210]! !== 0,
      hatred: bytes[0x211]! !== 0,
      cowardice: bytes[0x212]! !== 0,
    },
    specialItems: {
      spyglass: bytes[0x214]! !== 0,
      hmsCape: bytes[0x215]! !== 0,
      sextant: bytes[0x216]! !== 0,
      blackBadge: bytes[0x218]! !== 0,
      woodenBox: bytes[0x219]! !== 0,
    },
    equipmentQuantities: readBytes(bytes, 0x21a, 48),
    spellQuantities: readBytes(bytes, 0x24a, 48),
    scrollQuantities: readBytes(bytes, 0x27a, 8),
    potionQuantities: readBytes(bytes, 0x282, 8),
    reagentQuantities: readBytes(bytes, 0x2aa, 8),
    moonstones,
    partySize: bytes[0x2b5]!,
    year: u16le(bytes, 0x2ce),
    activeCharacter: bytes[0x2d5]!,
    month: bytes[0x2d7]!,
    day: bytes[0x2d8]!,
    hour: bytes[0x2d9]!,
    minute: bytes[0x2db]!,
    karma: bytes[0x2e2]!,
    // ⚠️ 0x2E5 se lee como u16 aquí por COMPATIBILIDAD (INIT.GAM vale 0 → u8==u16), pero
    // el RE (re/tools/oracle.py:98) demostró que 0x2E5 es `g_turn_count` u8 SATURANTE a
    // 0xFF y 0x2E6 es OTRO contador horario, NO el byte alto. NO lo "arregles" a u8 sin
    // más: el serializer confía en el mirror u16 para el round-trip byte-exacto de saves
    // reales (0x2E5=0xFF + 0x2E6≠0). El codec game-side (game/src/core/saveNative.ts) sí
    // usa u8 fiel. Divergencia documentada en re/deliberate-divergences.md.
    turnsSinceStart: u16le(bytes, 0x2e5),
    location: bytes[0x2ed]!,
    floor: bytes[0x2ef]!,
    x: bytes[0x2f0]!,
    y: bytes[0x2f1]!,
    torchTurns: bytes[0x301]!,
    shadowlordSummonedByte: bytes[0x325]!,
    npcDead: parseNpcBitmap(bytes, NPC_DEAD_OFFSET),
    npcMet: parseNpcBitmap(bytes, NPC_MET_OFFSET),
  };
}
