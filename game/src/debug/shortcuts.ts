/**
 * ATAJOS del menú debug — LÓGICA PURA (sin mutar el Game ni tocar el DOM). Las tres
 * acciones de un click ("Maximizar todo", "Mejor equipo", "Party al máximo") se
 * componen de estos helpers; la fachada (debugApi.ts) los aplica al estado vivo y
 * notifica. Aquí NO hay `rand` — todo es determinista (contrato cero-rand).
 *
 * REGLA DE FIDELIDAD (mandato del pedido): ningún tope está inventado. Cada uno se
 * deriva del TIPO DE CAMPO del SAVED.GAM (core/saveNative.ts) y del cap que el juego
 * aplica a ese campo, o de una fórmula ya derivada del binario. Las fuentes se citan
 * en cada constante/función.
 */
import type { CharacterState, GameState } from "../core/state.js";
import { levelForExp, HP_PER_LEVEL } from "../core/quest/lordbritish.js";
import {
  EQUIPMENT_NOTHING,
  TYPE_TABLE,
  equipTypeOf,
  slotForEquip,
  EQUIP_TYPE_TWO_HAND,
  type EquipSlot,
} from "../core/equip.js";
import { CAP_WORD } from "../core/counters.js";

/**
 * Topes de "maximizar", cada uno con su fuente:
 *  - `word` (gold/food/exp): campos u16 del .GAM (0x202/0x204 globales, +0x14 record)
 *    pero el juego los SATURA a 9999 = CAP_WORD (counters.ts `add_word_capped`, kernel
 *    0x9C84; exp idéntico, XP_CAP en combat.ts). Ese 9999 es el tope real, no el u16.
 *  - `counter` (keys/gems/torches/skullKeys/magicCarpets): campos u8 del .GAM
 *    (0x206..0x20b). El juego trata las cantidades de ítem como valor de 2 dígitos con
 *    tope 99 (equipItem `q < 99`, ztats a 2 dígitos) = CAP_BYTE. u8 admite 255 pero el
 *    tope de MODELO es 99.
 *  - `karma` (u8, 0x2e2): en U5 es un valor 0..99 (ztats lo muestra a 2 dígitos).
 *  - `attr` (STR/DEX/INT, u8 record +0x0c..+0x0e): atributo "válido" de U5 = 2 dígitos,
 *    tope 99 (mismo criterio que el panel de Party).
 *  - `itemQty` (celda de los arrays de inventario, u8 c/u): mismo tope de ítem 99.
 */
export const MAX = {
  word: CAP_WORD, // 9999
  counter: 99,
  karma: 99,
  // 30, no 99: el scheduler de turnos y los umbrales del binario operan «CONST−stat»
  // en byte/sin-signo — stats >0x23 (35) wrapean (DEX 99 = party inmóvil e intocable;
  // re/notes/audit-byte-wrap.md). 30 = tope legítimo del juego, rápido de verdad.
  attr: 30,
  itemQty: 99,
} as const;

/**
 * MP tope por CLASE — MISMA regla que la recuperación de MP al acampar (world/commands.ts
 * `campHoleUp`, CMDS 0x0483-0x04e2): Avatar/Mage → MP = INT; Bard → INT/2 (floor); resto
 * (Fighter/Druid/Tinker/Paladin/Ranger/Shepherd) → sin MP. Con INT maximizado a 99 da
 * A/M = 99, B = 49, otros = 0. El campo es u8 (record +0x0f), así que 99 cabe holgado.
 */
export function maxMpForClass(cls: string, intelligence: number): number {
  if (cls === "A" || cls === "M") return intelligence;
  if (cls === "B") return intelligence >> 1;
  return 0;
}

/**
 * Maximiza UN personaje in situ (cero-rand):
 *  - status = 'G' (record +0x0b, sano: cura veneno/dormido/muerte).
 *  - STR/DEX/INT = 99 (atributo válido de 2 dígitos).
 *  - exp = 9999 (CAP_WORD) → level = levelForExp(9999) = 8 (MAX_LEVEL); el nivel se
 *    DERIVA de la fórmula del binario (OUTSUBS 0x0658), no se cablea el 8.
 *  - maxHp = 30·nivel = 240 (HP_PER_LEVEL, misma fórmula que la aparición 0x0717); es
 *    el maxHP máximo del modelo (siempre 30·nivel). currentHp = maxHp (HP al tope).
 *  - currentMp = tope por clase (ver maxMpForClass).
 */
function maximizeCharacter(c: CharacterState): void {
  c.status = "G";
  c.strength = MAX.attr;
  c.dexterity = MAX.attr;
  c.intelligence = MAX.attr;
  c.exp = MAX.word;
  c.level = levelForExp(c.exp); // = MAX_LEVEL (8) por la fórmula, sin hardcode
  c.maxHp = HP_PER_LEVEL * c.level; // = 240; maxHP del modelo siempre = 30·nivel
  c.currentHp = c.maxHp;
  c.currentMp = maxMpForClass(c.class, c.intelligence);
}

export interface EquipTables {
  attackValues?: number[];
  defenseValues?: number[];
}

/** El mejor ítem por slot (id de Armament) o 0xFF si no hay candidato/tabla. */
export interface BestGear {
  helmet: number;
  armor: number;
  weapon: number;
  shield: number;
  ring: number;
  amulet: number;
}

const EMPTY_GEAR: BestGear = {
  helmet: EQUIPMENT_NOTHING,
  armor: EQUIPMENT_NOTHING,
  weapon: EQUIPMENT_NOTHING,
  shield: EQUIPMENT_NOTHING,
  ring: EQUIPMENT_NOTHING,
  amulet: EQUIPMENT_NOTHING,
};

/** Slot → métrica: arma se ordena por ATAQUE, todo lo demás por DEFENSA. */
function metricFor(slot: EquipSlot, tables: EquipTables): number[] | undefined {
  return slot === "weapon" ? tables.attackValues : tables.defenseValues;
}

/**
 * Mejor equipamiento por slot derivado SOLO de los datos: mayor `attackValues` para el
 * arma, mayor `defenseValues` para casco/armadura/escudo/anillo/amuleto. Recorre los 48
 * ids de `TYPE_TABLE` y clasifica cada uno por `slotForEquip` (weapon = 1/2-mano id≥16,
 * shield = 1-mano id 4..8). Desempate: id MÁS ALTO (los ítems tardíos del enum son los
 * raros/mejores). Sin tabla de la métrica de un slot → ese slot queda 0xFF.
 *
 * U5 NO tiene restricción de equipo por CLASE: la puerta de READY es encumbrance (peso vs
 * fuerza) + reglas de manos (ZSTATS `try_equip_or_unequip` 0x0c5c), no la clase. Por eso
 * el "mejor por slot" es el MISMO para toda clase. La única restricción estructural es la
 * de DOS MANOS: si el mejor arma es de dos manos (type 0x30) ocupa ambas manos → el escudo
 * se deja vacío (no se puede llevar los dos).
 */
export function bestGearFromData(tables: EquipTables): BestGear {
  if (!tables.attackValues && !tables.defenseValues) return { ...EMPTY_GEAR };
  const best: BestGear = { ...EMPTY_GEAR };
  const bestVal: Record<EquipSlot, number> = {
    helmet: -1,
    armor: -1,
    weapon: -1,
    shield: -1,
    ring: -1,
    amulet: -1,
  };
  for (let id = 0; id < TYPE_TABLE.length; id++) {
    const slot = slotForEquip(id);
    if (!slot) continue; // munición / no equipable
    const metric = metricFor(slot, tables);
    if (!metric) continue; // sin datos para ese slot
    const v = metric[id] ?? 0;
    // >= para que, a igualdad, gane el id más alto (desempate documentado).
    if (v >= bestVal[slot]) {
      bestVal[slot] = v;
      best[slot] = id;
    }
  }
  // Regla de 2 manos: el mejor arma de dos manos excluye el escudo.
  if (best.weapon !== EQUIPMENT_NOTHING && equipTypeOf(best.weapon) === EQUIP_TYPE_TWO_HAND) {
    best.shield = EQUIPMENT_NOTHING;
  }
  return best;
}

/** Los 6 slots de equipo del record, en orden de byte (+0x19..+0x1e). */
const GEAR_SLOTS: readonly EquipSlot[] = [
  "helmet",
  "armor",
  "weapon",
  "shield",
  "ring",
  "amulet",
];

/**
 * Nº de miembros del party a activar al "llenar": los records REALES (nombre no vacío)
 * contiguos desde el índice 0, tope 6. El party activo del juego son los primeros
 * `partySize` records (todo el core hace `characters.slice(0, partySize)`), así que
 * "llenar" = subir partySize para incluir esos records reales — NO inventa personajes.
 * Mínimo 1 (siempre el Avatar). Si el roster tiene < 6 reales contiguos, se topa ahí.
 */
export function fillablePartySize(chars: CharacterState[]): number {
  let n = 0;
  for (let i = 0; i < chars.length && i < 6; i++) {
    if ((chars[i]?.name ?? "").length === 0) break;
    n++;
  }
  return Math.max(1, n);
}

/** Pone todas las celdas de un array de inventario a `MAX.itemQty` (99). */
function fillInventoryArray(arr: number[] | undefined): void {
  if (!Array.isArray(arr)) return;
  for (let i = 0; i < arr.length; i++) arr[i] = MAX.itemQty;
}

/**
 * Pone a `true` TODAS las banderas booleanas de un objeto de posesión (specialItems,
 * lbArtifacts, shards). Itera las CLAVES REALES del objeto (no una lista a mano), así un
 * ítem especial nuevo que se añada al modelo queda cubierto por construcción — la fuente
 * de verdad es el estado, no una lista. `maximize-completeness.test.ts` lo asevera.
 */
function grantAllFlags(obj: Record<string, boolean> | undefined): void {
  if (!obj) return;
  for (const key of Object.keys(obj)) obj[key] = true;
}

/**
 * Otorga TODOS los ítems especiales / de quest que el ESTADO modela como posesión
 * booleana (mandato de "maximizar todo" = tener TODO el equipo):
 *  - `specialItems` (spyglass, HMS Cape plans, sextant, pocket watch, black badge,
 *    Sandalwood/wooden box): 6 flags del .GAM (0x212..0x218).
 *  - `lbArtifacts` (Amulet, Crown, Sceptre): la regalía de Lord British (0x209..0x20b).
 *  - `shards` (Falsehood, Hatred, Cowardice): las 3 esquirlas del Codex. Son POSESIÓN
 *    (bytes 0x20d..0x20f), NO progreso de historia: tenerlas no mata a ningún Shadowlord
 *    (eso exige (U)sar la esquirla en la llama). Se otorgan por PARIDAD con la regalía —
 *    misma categoría de objeto de endgame que se pediría al "tener todo el equipo". Nada
 *    aquí toca un questFlag acoplado (word-spoken / shadowlord-dead): maximizar es EQUIPO.
 *  - `grapple`: el garfio (flag 0x20c). El resto de "especiales" que la lista del pedido
 *    nombra son CONTADORES (skull keys, magic carpets, gems) ya cubiertos por los topes.
 * Cero-rand: sólo escribe flags planos. Itera las claves reales (grantAllFlags), así es
 * completo por construcción.
 */
export function grantSpecialItems(state: GameState): void {
  state.grapple = true;
  grantAllFlags(state.specialItems as unknown as Record<string, boolean>);
  grantAllFlags(state.lbArtifacts as unknown as Record<string, boolean>);
  grantAllFlags(state.shards as unknown as Record<string, boolean>);
}

/**
 * Maximiza TODO el estado maximizable (cero-rand), sin notificar: cada miembro activo del
 * party (primeros `partySize` records), recursos globales e inventario completo. La
 * fachada lo envuelve con un solo `notify`.
 */
export function maximizeState(state: GameState): void {
  const n = Math.min(state.partySize, state.characters.length);
  for (let i = 0; i < n; i++) {
    const c = state.characters[i];
    if (c) maximizeCharacter(c);
  }
  state.gold = MAX.word;
  state.food = MAX.word;
  state.keys = MAX.counter;
  state.gems = MAX.counter;
  state.torches = MAX.counter;
  state.skullKeys = MAX.counter;
  state.magicCarpets = MAX.counter; // u8 sin cap de juego distinto → tope de ítem 99
  state.karma = MAX.karma;
  grantSpecialItems(state); // grapple + specialItems + lbArtifacts + shards (todo posesión)
  fillInventoryArray(state.equipmentQuantities);
  fillInventoryArray(state.spellQuantities);
  fillInventoryArray(state.scrollQuantities);
  fillInventoryArray(state.potionQuantities);
  fillInventoryArray(state.reagentQuantities);
}

/**
 * Equipa a cada miembro activo del party con el mejor equipamiento derivado de `tables`,
 * sin notificar. Escribe los 6 slots del record directamente (cero-rand — NO usa
 * `equipItem`, cuya rama de anillo consume rand) y garantiza stock ≥ 1 del ítem equipado
 * en `equipmentQuantities` (el modelo exige poseerlo para (R)eady-lo de nuevo).
 */
export function bestGearState(state: GameState, tables: EquipTables): void {
  const gear = bestGearFromData(tables);
  const n = Math.min(state.partySize, state.characters.length);
  for (let i = 0; i < n; i++) {
    const c = state.characters[i];
    if (!c) continue;
    for (const slot of GEAR_SLOTS) {
      const id = gear[slot];
      c[slot] = id & 0xff;
      if (id !== EQUIPMENT_NOTHING) {
        const q = state.equipmentQuantities[id] ?? 0;
        if (q < 1) state.equipmentQuantities[id] = 1;
      }
    }
  }
}

/**
 * Llena el party a miembros reales (fillablePartySize) marcándolos en-party
 * (partyStatus = 0), luego maximiza y equipa a todos. Sin notificar.
 */
export function fillAndMaxState(state: GameState, tables: EquipTables): void {
  const n = fillablePartySize(state.characters);
  state.partySize = n;
  for (let i = 0; i < n; i++) {
    const c = state.characters[i];
    if (c) c.partyStatus = 0; // 0x00 = en party (record +0x1f)
  }
  maximizeState(state);
  bestGearState(state, tables);
}
