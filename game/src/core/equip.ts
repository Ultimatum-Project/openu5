/**
 * Comando READY (equipar/desequipar) de Ultima V — núcleo puro (sin DOM).
 *
 * REGLAS EXACTAS re-derivadas de ZSTATS.OVL `try_equip_or_unequip` @0x0c5c
 * (re/notes/zstats.md, re/verified/zstats.md). Sustituye la aproximación
 * previa basada en `reqStrength` por-item (que NO se referencia en el binario).
 *
 * Modelo real (record de personaje +0x19..+0x1e = 6 slots de equipo):
 *   helmet(+0x19) armor(+0x1a) weapon/manoA(+0x1b) shield/manoB(+0x1c)
 *   ring(+0x1d) amulet(+0x1e)
 *
 * El slot se decide por la TABLA DE TIPOS (DATA.OVL DS 0x1a7e, un byte/item):
 *   0x80→helmet · 0x40→armor · 0x02→ring · 0x04→amulet
 *   0x20→arma/escudo de UNA mano (a cualquier mano libre vía hand_state)
 *   0x30→arma de DOS manos (exige ambas manos libres, ocupa la manoA)
 *   0x00→NO equipable (munición: Arrows/Quarrels)
 *
 * FUERZA = ENCUMBRANCE (0x0d36): suma el PESO (tabla DS 0x1aae) de los 6 slots
 * ya puestos + el peso del item nuevo; si total > Str(record+0x0c) → rechaza
 * ("Thou art not strong enough!"). NO es un reqStrength por-item.
 *
 * Convención: muta `GameState` in situ; ante fallo NO muta.
 */
import type { CharacterState, GameState } from "./state.js";

/** Byte centinela Equipment.Nothing. */
export const EQUIPMENT_NOTHING = 0xff;

export type EquipSlot = "helmet" | "shield" | "armor" | "weapon" | "ring" | "amulet";

/**
 * Tabla de PESOS por item (DATA.OVL DS 0x1aae, 48 bytes). Encumbrance = suma de
 * los pesos de los 6 slots equipados vs la Fuerza del personaje.
 */
// prettier-ignore
const WEIGHT_TABLE: readonly number[] = [
  0x00, 0x01, 0x02, 0x03, 0x02, 0x03, 0x04, 0x00, 0x00, 0x00, 0x02, 0x04,
  0x06, 0x0a, 0x0c, 0x00, 0x01, 0x02, 0x03, 0x02, 0x03, 0x04, 0x06, 0x05,
  0x07, 0x08, 0x08, 0x00, 0x06, 0x00, 0x09, 0x10, 0x0f, 0x0d, 0x12, 0x00,
  0x00, 0x08, 0x00, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
];

/**
 * Tabla de TIPOS por item (DATA.OVL DS 0x1a7e, 48 bytes). Decide el slot y las
 * reglas de una/dos manos.
 */
// prettier-ignore
export const TYPE_TABLE: readonly number[] = [
  0x80, 0x80, 0x80, 0x80, 0x20, 0x20, 0x20, 0x20, 0x20, 0x40, 0x40, 0x40,
  0x40, 0x40, 0x40, 0x40, 0x20, 0x30, 0x20, 0x30, 0x20, 0x20, 0x20, 0x20,
  0x20, 0x20, 0x30, 0x00, 0x30, 0x00, 0x20, 0x30, 0x30, 0x30, 0x30, 0x30,
  0x30, 0x20, 0x20, 0x20, 0x20, 0x30, 0x02, 0x02, 0x02, 0x04, 0x04, 0x04,
];

const EQUIP_TYPE_HELMET = 0x80;
const EQUIP_TYPE_ARMOR = 0x40;
const EQUIP_TYPE_ONE_HAND = 0x20;
export const EQUIP_TYPE_TWO_HAND = 0x30;
const EQUIP_TYPE_RING = 0x02;
const EQUIP_TYPE_AMULET = 0x04;

// Ids nombrados (enum Equipment de DATA.OVL).
const BOW = 0x1a;        // 26
const ARROWS = 0x1b;     // 27 — munición, no equipable
const CROSSBOW = 0x1c;   // 28
const QUARRELS = 0x1d;   // 29 — munición, no equipable
const MAGIC_BOW = 0x24;  // 36
export const RING_INVIS = 0x2a; // 42 (Ring of Invisibility)

/** Datos de referencia (de data.json) para el motor de combate. */
export interface EquipData {
  attackValues: number[];
  defenseValues: number[];
  /** @deprecated el binario no usa reqStrength por-item; se ignora. */
  reqStrength?: number[];
}

/** Opciones de contexto de `equipItem`. */
export interface EquipOpts {
  /** rand(lo,hi) inclusivo del original; para el efecto "Ring vanishes!" (1/16). */
  randRange?: (lo: number, hi: number) => number;
  /** En combate de mazmorra pre-victoria: bloquea cambiar armadura (ids 9..15). */
  inDungeonCombat?: boolean;
}

/** Tipo de equipo de un item, o 0 si no es equipable (fuera de rango o munición). */
export function equipTypeOf(equipId: number): number {
  if (equipId < 0 || equipId >= TYPE_TABLE.length) return 0;
  return TYPE_TABLE[equipId] ?? 0;
}

/**
 * Slot "natural" de un item (para UI). Los items de una mano se muestran en
 * "weapon" (ids ≥16) o "shield" (ids 4..8); el reparto REAL entre manos lo hace
 * `handState` al equipar. Devuelve null si el item no es equipable.
 */
export function slotForEquip(equipId: number): EquipSlot | null {
  switch (equipTypeOf(equipId)) {
    case EQUIP_TYPE_HELMET:
      return "helmet";
    case EQUIP_TYPE_ARMOR:
      return "armor";
    case EQUIP_TYPE_RING:
      return "ring";
    case EQUIP_TYPE_AMULET:
      return "amulet";
    case EQUIP_TYPE_ONE_HAND:
    case EQUIP_TYPE_TWO_HAND:
      return equipId >= 16 ? "weapon" : "shield";
    default:
      return null; // type 0x00: munición / fuera de rango
  }
}

function getSlot(char: CharacterState, slot: EquipSlot): number {
  return char[slot];
}

function setSlot(char: CharacterState, slot: EquipSlot, value: number): void {
  char[slot] = value;
}

/**
 * Estado de las manos (ZSTATS `hand_state` @0x0c0a). Manos = weapon(+0x1b) y
 * shield(+0x1c). Devuelve:
 *   2 = ambas libres · 0 = solo la mano de arma libre ·
 *   1 = solo la mano de escudo libre (y el arma actual NO es de dos manos) ·
 *   0xff = ninguna disponible.
 */
export function handState(char: CharacterState): number {
  const weaponFree = getSlot(char, "weapon") === EQUIPMENT_NOTHING;
  const shieldFree = getSlot(char, "shield") === EQUIPMENT_NOTHING;
  if (weaponFree && shieldFree) return 2;
  if (weaponFree) return 0;
  if (shieldFree && equipTypeOf(getSlot(char, "weapon")) !== EQUIP_TYPE_TWO_HAND) return 1;
  return 0xff;
}

/** Slots que pueden empuñar un arma (casco pincho + dos manos) — COMSUBS:0x0D96. */
const ATTACK_SLOTS: EquipSlot[] = ["helmet", "weapon", "shield"];

/**
 * Arma de proyectil → ítem de munición que consume al DISPARAR (COMSUBS:0x097C,
 * 099c/09b2): bow 0x1a y magic bow 0x24 → Arrows 0x1b; crossbow 0x1c → Quarrels
 * 0x1d. Devuelve null si el arma no gasta munición dedicada.
 */
export function ammoItemFor(weaponId: number): number | null {
  if (weaponId === BOW || weaponId === MAGIC_BOW) return ARROWS;
  if (weaponId === CROSSBOW) return QUARRELS;
  return null;
}

/**
 * Armas de ARROJAR que gastan 1 unidad DE SÍ MISMAS al lanzarse a distancia > 1
 * (COMSUBS:0x097C rama 0x9b8, ids {0x10 Dagger, 0x15 Spear, 0x16 Throwing Axe}).
 * Sling 0x11 NO gasta munición y Flaming Oil 0x13 se consume en otro sitio del
 * disparo (0x0ACE) — ambos quedan fuera de este predicado a propósito.
 */
const THROWN_WEAPONS: ReadonlySet<number> = new Set([0x10, 0x15, 0x16]);
export function isThrownWeapon(weaponId: number): boolean {
  return THROWN_WEAPONS.has(weaponId);
}

/**
 * Desequipa el arma `weaponId` del slot de ataque que la tenga (helmet/weapon/shield) y la
 * PIERDE: última arma de arrojar, COMSUBS:0x097C rama 0x09ce, que llama a 0x6e60 y RETorna
 * sin ningún `add` de vuelta. Devuelve el slot afectado, o null si el arma no estaba equipada.
 *
 * ⚠ TENÍA una rama `returnToInventory` que sumaba **1 al pack con tope 99**; la usaba la
 * munición agotada (09a2-09ab) y era DOBLEMENTE infiel: allí el binario suma **N** (los
 * miembros desarmados por el barrido de SJOG 0x1b34) y su `add byte` **no lleva tope**.
 * El `+1`/tope 99 sí es fiel, pero en OTRA rutina — el toggle-off del (R)eady, ZSTATS
 * 0x0ccd (`cmp byte[bx+0x57c0],0x63 / jae / inc`), que se calca aparte en `readyItem`.
 * La rama murió con la ficha #36 para que nadie vuelva a heredar el tope desde aquí:
 * un helper compartido entre dos rutinas del binario con reglas distintas es el vehículo
 * exacto de esa clase de divergencia. La devolución al pack vive ahora en el call-site,
 * como en el binario.
 */
export function unequipWeaponById(
  state: GameState,
  charIdx: number,
  weaponId: number,
): EquipSlot | null {
  const char = state.characters[charIdx];
  if (!char) return null;
  for (const slot of ATTACK_SLOTS) {
    if (getSlot(char, slot) !== weaponId) continue;
    setSlot(char, slot, EQUIPMENT_NOTHING);
    return slot;
  }
  return null;
}

/** Anillo de Protección (43). EXENTO de la expiración por `cmp ... 0x2c` explícito. */
export const RING_PROTECTION = 0x2b; // 43
/** Anillo de Regeneración (44). Junto al 42, los DOS que expiran. */
export const RING_REGEN = 0x2c; // 44

/**
 * Los 6 slots en el ORDEN del registro de personaje (+0x19..+0x1e), que es el que barre
 * `unequip_item` ULTIMA.EXE 0x6E60. El orden importa: el binario para en el PRIMERO que
 * case, así que replicarlo es lo que hace equivalente el barrido.
 */
const RECORD_SLOT_ORDER: EquipSlot[] = ["helmet", "armor", "weapon", "shield", "ring", "amulet"];

/**
 * `unequip_item(itemId, partyIdx)` — ULTIMA.EXE **0x6E60**. Barre los 6 slots del personaje
 * en el orden del registro y al PRIMERO que valga `itemId` le escribe 0xFF
 * (`6e80: mov byte [si],0xff` = Equipment.Nothing).
 *
 * ★ NO devuelve nada al inventario: el objeto se DESTRUYE. Por eso no reusa
 * `unequipWeaponById` (que sí tiene esa rama) ni `unequipSlot` (que siempre devuelve).
 * Devuelve el slot afectado, o null si el item no estaba equipado.
 */
export function unequipItemById(
  state: GameState,
  charIdx: number,
  itemId: number,
): EquipSlot | null {
  const char = state.characters[charIdx];
  if (!char) return null;
  for (const slot of RECORD_SLOT_ORDER) {
    if (getSlot(char, slot) !== itemId) continue;
    setSlot(char, slot, EQUIPMENT_NOTHING); // 0x6e80 — sin retorno al inventario
    return slot;
  }
  return null;
}

/** Un anillo que se desvanece este evento. */
export interface RingExpiry {
  charIdx: number;
  ringId: number;
}

/**
 * EXPIRACIÓN DE ANILLOS — `party_anim_build` ULTIMA.EXE **0x6936**, bloque 0x69F0-0x6A4B.
 * Derivación completa en `re/notes/ring-expiry-derivation.md` (tarea #67).
 *
 * Por cada miembro del party:
 *   69f0 `cmp [bx+0x55c5],0x2a` / 6a02 `cmp [bx+0x55c5],0x2c` → sólo los anillos **42 y
 *        44**. El **43 (Protección) está EXENTO** por omisión explícita: hay dos `cmp` y
 *        ninguno es 0x2b. No es un olvido nuestro, es el binario.
 *   6a0d `cmp [bp-0xe],0` / `je` → **sin anillo NO TIRA**. El gate está ANTES del rand.
 *   6a13 `push 0` / 6a16 `push 0xf` / 6a1a `call rand_range` → **rand(0,15)**, 16 salidas.
 *   6a20 `cmp ax,0xb` → dispara con **=== 11**. ⚠ NO es `=== 0`: ése es el hermano de
 *        EQUIPAR (0x995e, otro mensaje y otra vía), y confundirlos es la trampa de la zona.
 *   6a25 print DS 0xa422 «A ring has vanished!\n» · 6a3c tono · 6a48 `unequip_item`.
 *
 * ★ RNG **CONDICIONADO**: el `rand` sólo se consume si ese miembro lleva 42/44. Un party
 * sin esos anillos es 0-RNG aquí — el stream no se mueve. Es consecuencia del orden del
 * binario (gate antes del call), no una optimización nuestra.
 *
 * El MUERTO ('D') se salta (0x69e1); el **dormido ('S') SÍ entra** — el binario sólo
 * compara contra 0x44.
 *
 * NO muta: devuelve la lista y el call-site decide. Así la tirada es OPT-IN por call-site
 * (ver los dos que la usan) y nunca cuelga de un tick global — la fragilidad de las
 * cadenas continuas ya está fichada.
 */
export function rollRingExpiry(
  state: GameState,
  randRange: (lo: number, hi: number) => number,
): RingExpiry[] {
  const out: RingExpiry[] = [];
  const n = Math.min(state.partySize ?? state.characters.length, state.characters.length);
  for (let charIdx = 0; charIdx < n; charIdx++) {
    const char = state.characters[charIdx];
    if (!char) continue;
    if (char.status === "D") continue; // 0x69e1: salta al muerto; el dormido 'S' NO
    const ring = getSlot(char, "ring");
    if (ring !== RING_INVIS && ring !== RING_REGEN) continue; // gate ANTES del rand
    if (randRange(0, 15) !== 11) continue; // 0x6a20 `cmp ax,0xb`
    out.push({ charIdx, ringId: ring });
  }
  return out;
}

/** Devuelve al inventario lo que hubiera en `slot` y lo deja vacío. */
export function unequipSlot(
  state: GameState,
  charIdx: number,
  slot: EquipSlot,
): { ok: boolean; message: string } {
  const char = state.characters[charIdx];
  if (!char) return { ok: false, message: "No such character." };
  const current = getSlot(char, slot);
  if (current === EQUIPMENT_NOTHING) return { ok: false, message: "Nothing equipped." };
  state.equipmentQuantities[current] = (state.equipmentQuantities[current] ?? 0) + 1;
  setSlot(char, slot, EQUIPMENT_NOTHING);
  // El binario NO imprime nada al des-equipar: la rama toggle-off de Ready
  // (ZSTATS try_equip_or_unequip @0x0cbf) hace unequip + g_equip_qty++ y `return 0`
  // silencioso, igual que el equip con éxito (hermano de "Readied." retirado en F1.9).
  // "Removed." era fabricación de conveniencia (F1.12 fixer, punto 1).
  return { ok: true, message: "" };
}

export interface EquipResult {
  ok: boolean;
  message: string;
  /** El item recién equipado se desvaneció (ring 1/16, ids 42/44). */
  vanished?: boolean;
  /** El item se desequipó (toggle-off) en lugar de equiparse. */
  removed?: boolean;
}

/**
 * READY exacto (ZSTATS `try_equip_or_unequip` @0x0c5c). Si el item ya está
 * puesto, lo quita (toggle-off). Si no, valida munición + encumbrance + slot y
 * lo equipa.
 */
export function equipItem(
  state: GameState,
  charIdx: number,
  equipId: number,
  _data?: EquipData,
  opts: EquipOpts = {},
): EquipResult {
  const char = state.characters[charIdx];
  if (!char) return { ok: false, message: "No such character." };

  // Arrows/Quarrels: munición, rechazo silencioso (0x0c82, return 0).
  if (equipId === ARROWS || equipId === QUARRELS) {
    return { ok: false, message: "" };
  }

  // Bloqueo de armadura en combate de mazmorra pre-victoria (0x0c94).
  if (equipId >= 9 && equipId <= 15 && opts.inDungeonCombat) {
    return { ok: false, message: "Thou canst not change armour in heated battle!" };
  }

  // ¿Ya equipado? → toggle-off (0x0cbf).
  if (isItemEquipped(char, equipId)) {
    for (const slot of ALL_SLOTS) {
      if (getSlot(char, slot) === equipId) {
        setSlot(char, slot, EQUIPMENT_NOTHING);
        break;
      }
    }
    const q = state.equipmentQuantities[equipId] ?? 0;
    if (q < 99) state.equipmentQuantities[equipId] = q + 1;
    return { ok: true, message: "", removed: true };
  }

  // Debe estar en el inventario (implícito: el picker solo ofrece qty>0).
  if ((state.equipmentQuantities[equipId] ?? 0) <= 0) {
    return { ok: false, message: "Thou hast none!" };
  }

  // Gate de munición (0x0d0c): Bow/MagicBow → Arrows>0; Crossbow → Quarrels>0.
  if ((equipId === BOW || equipId === MAGIC_BOW) && (state.equipmentQuantities[ARROWS] ?? 0) === 0) {
    return { ok: false, message: "Thou hast no ammunition for that weapon!" };
  }
  if (equipId === CROSSBOW && (state.equipmentQuantities[QUARRELS] ?? 0) === 0) {
    return { ok: false, message: "Thou hast no ammunition for that weapon!" };
  }

  // Encumbrance (0x0d36): Σ pesos de los 6 slots + nuevo vs Str.
  const strongEnough = totalEquippedWeight(char) + (WEIGHT_TABLE[equipId] ?? 0) <= char.strength;

  // Resolución de slot por tipo (0x0d91) — los errores de slot ocupado tienen
  // precedencia sobre el de fuerza.
  const type = equipTypeOf(equipId);
  let targetSlot: EquipSlot;
  switch (type) {
    case EQUIP_TYPE_RING:
      if (getSlot(char, "ring") !== EQUIPMENT_NOTHING) {
        return { ok: false, message: "Only one magic ring may be worn at a time!" };
      }
      targetSlot = "ring";
      break;
    case EQUIP_TYPE_AMULET:
      if (getSlot(char, "amulet") !== EQUIPMENT_NOTHING) {
        return { ok: false, message: "Thou must remove thine other amulet!" };
      }
      targetSlot = "amulet";
      break;
    case EQUIP_TYPE_HELMET:
      if (getSlot(char, "helmet") !== EQUIPMENT_NOTHING) {
        return { ok: false, message: "Remove first thy present helm!" };
      }
      targetSlot = "helmet";
      break;
    case EQUIP_TYPE_ARMOR:
      if (getSlot(char, "armor") !== EQUIPMENT_NOTHING) {
        return { ok: false, message: "Thou must first remove thine other armour!" };
      }
      targetSlot = "armor";
      break;
    case EQUIP_TYPE_ONE_HAND: {
      let hs = handState(char);
      if (hs === 0xff) {
        return { ok: false, message: "Thou must free one of thy hands first!" };
      }
      if (hs === 2) hs = 0;
      targetSlot = hs === 1 ? "shield" : "weapon";
      break;
    }
    case EQUIP_TYPE_TWO_HAND:
      if (handState(char) !== 2) {
        return { ok: false, message: "Both hands must be free before thou canst wield that!" };
      }
      targetSlot = "weapon";
      break;
    default:
      return { ok: false, message: "" }; // no equipable
  }

  // Comprobación de fuerza (0x0de9), tras resolver el slot.
  if (!strongEnough) {
    return { ok: false, message: "Thou art not strong enough!" };
  }

  // Equipar: colocar y restar del inventario.
  setSlot(char, targetSlot, equipId);
  state.equipmentQuantities[equipId] = (state.equipmentQuantities[equipId] ?? 0) - 1;

  // "Ring vanishes!" — ids 42/44, 1/16 (0x0e01).
  if (equipId === 0x2a || equipId === 0x2c) {
    const roll = opts.randRange ? opts.randRange(0, 15) : 1; // sin RNG: nunca desvanece
    if (roll === 0) {
      setSlot(char, "ring", EQUIPMENT_NOTHING);
      return { ok: true, message: "\n\nRing vanishes!\n", vanished: true };
    }
  }

  // Éxito SIN mensaje (F1.9): el binario no imprime nada al equipar con éxito. El
  // "Readied." previo era una frase de conveniencia del clon SIN respaldo (scout-claseD);
  // el único eco derivado del comando es el prompt "Ready...\n\n" del dispatch (DS 0xa1f0).
  return { ok: true, message: "" };
}

const ALL_SLOTS: readonly EquipSlot[] = ["helmet", "armor", "weapon", "shield", "ring", "amulet"];

/** ¿Lleva el personaje `equipId` en alguno de sus 6 slots? (ZSTATS 0x0518). */
export function isItemEquipped(char: CharacterState, equipId: number): boolean {
  return ALL_SLOTS.some((slot) => getSlot(char, slot) === equipId);
}

/** Peso total de los 6 slots equipados (ignora Nothing=0xff). */
export function totalEquippedWeight(char: CharacterState): number {
  let total = 0;
  for (const slot of ALL_SLOTS) {
    const id = getSlot(char, slot);
    if (id !== EQUIPMENT_NOTHING) total += WEIGHT_TABLE[id] ?? 0;
  }
  return total;
}

/** Suma la defensa de todo lo equipado por el personaje. */
export function characterDefense(char: CharacterState, defenseValues: number[]): number {
  let total = 0;
  for (const slot of ALL_SLOTS) {
    const id = getSlot(char, slot);
    if (id !== EQUIPMENT_NOTHING) total += defenseValues[id] ?? 0;
  }
  return total;
}

/**
 * Armas del personaje para el motor de combate: casco / mano izquierda / mano
 * derecha con valor de ataque > 0 (el TRIPLE golpe de COMSUBS:0x0D96, ver
 * re/notes/combat.md §7). Si ninguna ataca, manos desnudas (id 0xFF): su daño
 * base exacto es 1 (COMBAT:0x12B0 12ea/1330). `range` 0 = cuerpo a cuerpo → 1.
 */
export function characterWeapons(
  char: CharacterState,
  attackValues: number[],
  attackRangeValues: number[],
): { id: number; attack: number; range: number }[] {
  const weapons: { id: number; attack: number; range: number }[] = [];
  for (const slot of ["helmet", "weapon", "shield"] as EquipSlot[]) {
    const id = getSlot(char, slot);
    if (id === EQUIPMENT_NOTHING) continue;
    const attack = attackValues[id] ?? 0;
    if (attack > 0) {
      const rawRange = attackRangeValues[id] ?? 0;
      weapons.push({ id, attack, range: rawRange === 0 ? 1 : rawRange });
    }
  }
  if (weapons.length === 0) return [{ id: 0xff, attack: 1, range: 1 }];
  return weapons;
}
