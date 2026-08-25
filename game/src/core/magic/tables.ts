/**
 * Tablas y constantes EXACTAS del subsistema de magia, re-derivadas del
 * binario (CAST.OVL + CAST2.OVL; evidencia en re/notes/magic.md, cada dato
 * cita su offset). Todo lo que aquí aparece es table-driven en el original;
 * ningún valor es una aproximación de diseño.
 */

/**
 * Ventana temporal por hechizo — tabla DS:0x1C90 (48 bytes, 1 por índice de
 * SpellWords). 4 bits de "dónde se puede lanzar":
 *   0x08 exterior (g_location==0) · 0x04 pueblo (1..0x20) ·
 *   0x02 mazmorra (0x21..0x7F) · 0x01 combate (>=0x80).
 * El dispatcher (CAST:0x0e1a-0e8e) exige el bit correspondiente al contexto.
 * Sólo 48 entradas (índices 0..47); Nox (índice 48) no tiene fila → el acceso
 * `TIME_PERMITTED_BITS[48]` da undefined → &need = 0 → "Not here!". Irrelevante
 * en la práctica: Nox no es mezclable (MAX_TRACKED_SPELL_INDEX=47), así que
 * nunca llega al gate con cantidad > 0.
 */
export const TIME_PERMITTED_BITS: readonly number[] = [
  0x0e, 0x01, 0x0f, 0x0f, 0x0f, 0x05, 0x0f, 0x01, 0x08, 0x08, 0x01, 0x0f,
  0x0e, 0x01, 0x03, 0x03, 0x03, 0x09, 0x03, 0x0f, 0x03, 0x02, 0x02, 0x01,
  0x01, 0x05, 0x05, 0x0f, 0x01, 0x0f, 0x01, 0x01, 0x0f, 0x0c, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x0e, 0x01, 0x01, 0x0e, 0x01, 0x01, 0x01, 0x0e, 0x0f,
];

/** Bits de contexto (dispatch CAST:0x0e1a). */
const TIME_BIT_OUTDOOR = 0x08;
const TIME_BIT_TOWN = 0x04;
const TIME_BIT_DUNGEON = 0x02;
const TIME_BIT_COMBAT = 0x01;

/**
 * Bit de ventana temporal EXIGIDO por el contexto — CAST:0x0e1a-0e6f:
 * loc==0 → exterior; 1..0x20 → pueblo; 0x21..0x7F → mazmorra; >=0x80 → combate.
 * En el clon el "estar en combate" se lleva aparte del `location` del mundo,
 * así que `inCombat` fuerza el bit de combate (el binario pone g_location>=0x80
 * al entrar en el mapa de combate).
 */
export function requiredTimeBit(location: number, inCombat: boolean): number {
  if (inCombat || location >= 0x80) return TIME_BIT_COMBAT;
  if (location === 0) return TIME_BIT_OUTDOOR;
  if (location <= 0x20) return TIME_BIT_TOWN;
  return TIME_BIT_DUNGEON; // 0x21..0x7F
}

/**
 * IDs de "arma-hechizo" de los ataques directos — CAST:0x0032(weapon).
 * El daño sale de attackValues[weaponId] pasando por el motor de combate.
 */
export const SPELL_WEAPON_GRAV_POR = 0x30; // rand(1,16)
export const SPELL_WEAPON_VAS_FLAM = 0x31; // rand(1,30)
export const SPELL_WEAPON_XEN_CORP = 0x32; // 99 = muerte instantánea

/**
 * Muros de campo — CAST:0x004c(arg 0..3). arg: 0=In Flam Grav, 1=In Nox Grav,
 * 2=In Zu Grav, 3=In Sanct Grav.
 *
 * `cast_field_wall` tiene EXACTAMENTE DOS ramas (`0054 cmp byte [g_location],0x80`/`jb`):
 *  · `< 0x80` → **MAZMORRA**: escribe el tile de campo en la celda de enfrente de la
 *    rejilla 8×8 (`Dungeon.applyFieldWall`), conservando el bit 3.
 *  · `>= 0x80` → **COMBATE**: `g_cmb_weapon = FIELD_WALL_COMBAT_WEAPON[arg]` y llama al
 *    motor (`0100 call 0xffffc14a`). ⚠️ SIN CABLEAR: ese callee NO es el de
 *    `cmb_set_weapon_then_attack` (CAST 0x0032 → COMSUBS 0x0C52), así que no se puede
 *    dar por equivalente a `{kind:"combatAttack"}` sin leerlo. `FIELD_WALL_COMBAT_WEAPON`
 *    no tiene consumidores todavía, y eso es deliberado.
 * 🔴 **NO hay rama de sobremundo**, y la máscara `TIME_PERMITTED_BITS` de los cuatro vale
 * `0x03` (mazmorra+combate) ⇒ en exterior y pueblo ni se lanzan («Not here!»). La ruta de
 * sobremundo que tuvo el clon (sello de 5 celdas en `mapOverrides`) está RETIRADA: era
 * inalcanzable y no tenía original. Medido por dos canales del binario más un cast vivo:
 * `re/notes/field-grav-gate-testigo-20260808.md`.
 */
export const FIELD_WALL_TILE = [0x82, 0x81, 0x80, 0x83] as const; // DS:0x4596 (fuego/veneno/sueño/energía)
export const FIELD_WALL_COMBAT_WEAPON = [0x35, 0x33, 0x34, 0x36] as const; // DS:0x4592

/**
 * Estados temporales globales — CAST2:0x08f8(status, dur, circle) y An Tym
 * inline (CAST:0x0d4c). Un ÚNICO global (g_time_spell + g_time_spell_turns);
 * el nuevo pisa al anterior. Duración en TURNOS.
 */
export const TIME_STATUS = {
  protection: { status: "P", turns: 20 }, // In Sanct
  quickness: { status: "Q", turns: 30 }, // Rel Tym
  confusion: { status: "C", turns: 20 }, // Quas An Wis
  negate: { status: "N", turns: 10 }, // In An
  timeStop: { status: "T", turns: 10 }, // An Tym
} as const;

/** Duración de luz en MINUTOS — CAST2:0x08ea (g_light_spell_mins DS:0x58A6). */
export const LIGHT_MINUTES_IN_LOR = 100; // 0x64
export const LIGHT_MINUTES_VAS_LOR = 255; // 0xFF

/**
 * Códigos del viento (g_wind DS:0x5892) — kernel 0x2E96. Rel Hur lee una
 * dirección de flecha (1=O,2=E,3=N,4=S; Space=calma→0) y la REMAPEA a código
 * de viento (0→0,1→4,2→3,3→1,4→2) — CAST2:0x040a 042b.
 */
export const WIND_CALM = 0;
export const WIND_NORTH = 1;
export const WIND_SOUTH = 2;
export const WIND_EAST = 3;
export const WIND_WEST = 4;

/** Remap flecha→viento (CAST2:0x042b): índice = dir de flecha (0..4). */
export const ARROW_TO_WIND: readonly number[] = [0, 4, 3, 1, 2];

/**
 * Tipos invocados por Kal Xen — CAST:0x04b0: `t = rand(0,15)`;
 * t<6→0x14 (rata), t<0xB→0x16, t<0xE→0x15, si no 0x22.
 */
export function kalXenSummonType(t: number): number {
  if (t < 6) return 0x14;
  if (t < 0x0b) return 0x16;
  if (t < 0x0e) return 0x15;
  return 0x22;
}

// (Aquí vivía `MAGIC_DOOR_LOCK = [[0xb8,0x97],[0xba,0x98]]`, con DOS entradas. Se
// RETIRA por ser TABLA MUERTA — ficha #48: no estaba exportada, no la leía nadie, y su
// única ocurrencia en todo el árbol era su propia declaración. El mapeo vivo está en
// `game.ts::applyDoorSpell` y tiene las CUATRO variantes (0xB8/0xB9→0x97 ·
// 0xBA/0xBB→0x98), como el binario: `CAST.OVL 0x0880/0x088a` son `jbe`, no `jb`, así
// que las impares entran. No se re-escribe: mientras la tabla de dos existiera, quien
// grepeara `0xb8` la encontraba y concluía que el clon deja 75 puertas sin sellar —
// que es exactamente lo que le pasó a la ficha. El señuelo se cierra EN ORIGEN.

/**
 * Nivel tras resurrección — CAST2:0x05e0 0680: `cx = exp/100; dx = 1;
 * while (cx>0) { dx++; cx >>= 1 }` → floor(log2(exp/100)) + 1 (mínimo 1).
 */
export function resurrectionLevel(exp: number): number {
  let cx = Math.floor(exp / 100);
  let dx = 1;
  while (cx > 0) {
    dx++;
    cx >>= 1;
  }
  return dx;
}

/** maxHP tras resurrección — CAST2:0x06bb: 30·nivel. */
export function resurrectionMaxHp(level: number): number {
  return 0x1e * level;
}
