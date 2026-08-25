/**
 * EL RITUAL DE LOS SHADOWLORDS — máquina de estados pura (F1.10-T5).
 *
 * El clímax de la trama: cada uno de los tres Shadowlords se destruye
 * CONVOCÁNDOLO por su nombre (Yell) en la Llama de su Virtud opuesta y
 * arrojando allí el Shard correspondiente (Use). Derivado byte a byte del
 * desensamblado; sin fabricación.
 *
 * Fuentes (citas):
 *   · Convocatoria (Yell)  — CMDS.OVL 0x1030 (llamado desde el Yell handler
 *     0x1418 en 0x1493, sólo tras el prompt de palabra 0x1458).
 *   · Ritual (Use Shard)   — CAST.OVL 0x15b4 (alcanzado por el dispatcher de
 *     (U)se en 0x1a2c con `shardIdx = itemId - 0x1d`).
 *   · Escritura de destrucción — CAST.OVL 0x170b `mov [bx+0x58c8],0xff`
 *     (g_shadowlord_locs), 0x1710 `mov [bx+0x57b6],0` (consume el shard),
 *     0x171d `or [0x5bca],ax` (bitmap de doom de trama).
 *   · Tablas y strings de DATA.OVL: fórmula canónica `fileoff = DS_off + 0x10`
 *     (ver re/notes/dataovl-strings.md). Detalle completo en
 *     re/notes/shadowlord-ritual.md.
 *
 * SIN RNG: ni la convocatoria (CMDS 0x1030: sólo strcmp + 0x7964 slot libre +
 * 0x7af4 place) ni el ritual (CAST 0x15b4: sólo prints + animaciones) tiran el
 * rand del juego. Declarado explícitamente.
 *
 * Índice canónico (idx): 0 = Falsehood, 1 = Hatred, 2 = Cowardice. El
 * emparejamiento shard ↔ Shadowlord ↔ Llama es POSICIONAL por este idx (no hay
 * tabla de indirección): lo fijan los tres `switch(idx)` de CAST.OVL
 * (0x15c5 nombre-shard / 0x1682 nombre-llama / 0x1728 nombre-Shadowlord).
 */

/** Tile del Shadowlord convocado en el mundo (objeto sentinela). CAST 0x16c1 `cmp ax,0xfc`. */
export const SHADOWLORD_TILE = 0xfc;

/**
 * Nombres a GRITAR (Yell) para convocar. CMDS tabla de punteros DS 0x444a →
 * DS 0x43ef/0x43f8/0x4401. El binario los compara con la palabra tecleada vía
 * el helper 0xffffaf9e (mismo patrón substring-toupper que el mantra de
 * Blackthorn, re/notes/blackthorn.md §0x02ea). Modelado como: palabra en
 * MAYÚSCULAS que CONTIENE el nombre.
 */
const YELL_NAMES: readonly string[] = ["FAULINEI", "ASTAROTH", "NOSFENTOR"];

/**
 * Posición EXACTA de cada Llama para el ritual (CAST 0x162f-0x1654). El binario
 * exige `g_party_x/y/location/floor` == estas cuatro tablas byte-exactas.
 * DATA.OVL, cuatro tablas de 3 bytes (una entrada por Llama), volcadas y verificadas
 * byte a byte en t#57: X DS 0x4882 (file 0x4892) = {15,15,15}, Y DS 0x4886 = {9,3,16},
 * tabla location DS 0x488a = {30,31,32}, tabla floor DS 0x488e = {2,1,0xFF};
 * consumidor CAST 0x162f.
 *
 * Las tres salas son KEEPS (mapas 32×32), NO mazmorras: location 30 = The
 * Lycaeum (Falsehood→Truth, floor 2), 31 = Empath Abbey (Hatred→Love, floor 1),
 * 32 = Serpent's Hold (Cowardice→Courage). El byte floor de DATA.OVL para la
 * Llama del Coraje es 0xFF = -1 SIGNED = el SÓTANO (z=-1) de Serpent's Hold
 * (smallmaps.json: floors [-1,0,1]). El clon almacena `position.floor` con signo,
 * así que aquí floor[2] = -1 (equivalente exacto de 0xFF). Grado A.
 */
export const FLAME_X: readonly number[] = [0x0f, 0x0f, 0x0f]; // 15, 15, 15
export const FLAME_Y: readonly number[] = [0x09, 0x03, 0x10]; // 9, 3, 16
export const FLAME_LOCATION: readonly number[] = [0x1e, 0x1f, 0x20]; // 30, 31, 32 = Lycaeum/Empath/Serpent's Hold
export const FLAME_FLOOR: readonly number[] = [2, 1, -1]; // DATA.OVL bytes 0x02/0x01/0xFF(=-1 signed)

/** Bit OR'd al bitmap de doom (0x5bca) por Shadowlord destruido. DATA.OVL DS 0x4892 (file 0x48a2). */
export const DOOM_BIT: readonly number[] = [0x02, 0x04, 0x08];

// --- Strings byte-exactos de DATA.OVL (CAST.OVL los imprime vía kernel 0x58d0) ---
/** 0x4794. Cabecera del ritual (impresa SIEMPRE, antes del check de posición). */
const SHARD_HEADER = "Gem Shard\n\nThou dost hold above thee the evil Shard of ";
/** 0x47cc / 0x47d9 / 0x47e3. Nombre del shard (con los "..." del original). */
const SHARD_NAME: readonly string[] = ["Falsehood...", "Hatred...", "Cowardice..."];
/** 0x47f0. Fallo por Llama equivocada (posición no coincide). */
const RITUAL_NO_EFFECT = "\n\nNo effect!\n";
/** 0x47fe. Al estar en la Llama correcta. */
const CAST_INTO_FLAME = "\n\n...and cast it into the Flame of ";
/** 0x4822 / 0x482a / 0x4831. Nombre de la Llama (Virtud opuesta). */
const FLAME_NAME: readonly string[] = ["Truth!\n", "Love!\n", "Courage!\n"];
/** 0x483b. Prefijo del doom (tras la destrucción). */
const DOOM_PREFIX = "\nThe doom of the Shadowlord ";
/** 0x4858 / 0x4861 / 0x486a. Nombre propio del Shadowlord (mensaje de doom). */
const SHADOWLORD_NAME: readonly string[] = ["Faulinei", "Astaroth", "Nosfentor"];
/** 0x4874. Sufijo del doom. */
const DOOM_SUFFIX = " is wrought!\n";
/** 0x440b / 0x4418 / 0x443c / 0x453a. Todos "\nNo effect!\n". Fallo de convocatoria. */
const SUMMON_NO_EFFECT = "\nNo effect!\n";

// ---------------------------------------------------------------------------
// Convocatoria — Yell nombre en la sala de la Llama (CMDS.OVL 0x1030)
// ---------------------------------------------------------------------------

export interface SummonInput {
  /** Palabra tecleada tras el prompt de Yell. */
  word: string;
  /** g_party_y (CMDS 0x106f exige >= 2: el SL aparece en y-2). */
  partyY: number;
  /** ¿Vive cada Shadowlord? idx 0/1/2 (CMDS 0x1076: `[bx+0x58c8] != 0xff`). */
  alive: readonly boolean[];
  /** ¿Hay ya un Shadowlord (tile 0xFC) presente en el mapa? (CMDS 0x109b). */
  shadowlordPresent: boolean;
}

export interface SummonResult {
  ok: boolean;
  /** idx del Shadowlord convocado (0/1/2) si ok. Se escribe en g_shadowlord_here (0x58cb). */
  idx?: number;
  /** Desplazamiento de aparición: el SL se coloca en (party_x, party_y - dy). CMDS 0x10d4 = 2. */
  spawnDy: number;
  /** Mensaje de fallo ("\nNo effect!\n") si !ok. Éxito = silencioso (aparece el sprite). */
  message?: string;
}

/**
 * Empareja la palabra gritada con un Shadowlord. CMDS 0x105a-0x1091: recorre la
 * tabla de nombres comparando con 0xffffaf9e (substring/toupper). Devuelve el
 * idx o -1.
 */
export function matchYellName(word: string): number {
  const w = word.toUpperCase();
  for (let i = 0; i < YELL_NAMES.length; i++) {
    if (w.includes(YELL_NAMES[i]!)) return i;
  }
  return -1;
}

/**
 * Convocatoria pura (CMDS 0x1030). Gates en orden del binario:
 *   1. La palabra empareja un nombre (si no → "No effect", 0x1052→0x11f4→0x1082).
 *   2. party_y >= 2 (0x106f; el SL se coloca en y-2).
 *   3. Ese Shadowlord sigue vivo (0x1076: `[0x58c8+idx] != 0xff`).
 *   4. No hay ya un Shadowlord (tile 0xFC) en el mundo (0x109b).
 * Éxito → coloca el SL en (party_x, party_y-2) y fija g_shadowlord_here=idx (0x10bd).
 *
 * NOTA: el gate de LOCATION (sólo 0x1e/0x1f/0x20) lo aplica el CALLER (game.ts),
 * reproduciendo que 0x1030 imprime "No effect" (0x443c) fuera de esas salas.
 */
export function summonShadowlord(input: SummonInput): SummonResult {
  const idx = matchYellName(input.word);
  if (idx < 0) return { ok: false, spawnDy: 2, message: SUMMON_NO_EFFECT };
  if (input.partyY < 2) return { ok: false, spawnDy: 2, message: SUMMON_NO_EFFECT };
  if (!input.alive[idx]) return { ok: false, spawnDy: 2, message: SUMMON_NO_EFFECT };
  if (input.shadowlordPresent) return { ok: false, spawnDy: 2, message: SUMMON_NO_EFFECT };
  return { ok: true, idx, spawnDy: 2 };
}

// ---------------------------------------------------------------------------
// Ritual — Use Shard en la Llama (CAST.OVL 0x15b4)
// ---------------------------------------------------------------------------

export interface RitualInput {
  /** idx del shard usado (0/1/2 = itemId - 0x1d, CAST 0x1a2f). */
  shardIdx: number;
  partyX: number;
  partyY: number;
  location: number;
  floor: number;
  /** Tile en (party_x, party_y-1). CAST 0x16b3 lee y-1; destruye sólo si == 0xFC. */
  tileAbove: number;
  /** g_shadowlord_here (0x58cb): idx del SL convocado presente, o -1. CAST 0x16c9. */
  summonedIdx: number;
}

export interface RitualResult {
  /** Segmentos de texto en el orden EXACTO que los imprime CAST.OVL. */
  lines: string[];
  /** ¿Se destruyó el Shadowlord? (rama 0x1708). */
  destroyed: boolean;
  /** Bit a OR'ear en el bitmap de doom si destroyed (0x171d). */
  doomBit: number;
}

/**
 * Ritual puro (CAST.OVL 0x15b4). Flujo:
 *   1. Imprime "Gem Shard…Shard of " + nombre-shard (0x4794 + 0x47cc/d9/e3). SIEMPRE.
 *      [+ animación de elevar/bajar el shard — AV, Clase C.]
 *   2. Check de POSICIÓN (0x162f): party == (FLAME_X,Y,LOC,FLOOR)[idx]. Si no →
 *      "No effect!" (0x47f0) y termina. [+ SFX de fallo.]
 *   3. Imprime "…and cast it into the Flame of " + nombre-llama (0x47fe + 0x4822/2a/31).
 *      [+ pulsos + SFX.]
 *   4. Check del Shadowlord presente: tile en y-1 == 0xFC (0x16c1) Y g_shadowlord_here
 *      == idx (0x16ce). Si falla cualquiera → termina SIN más texto (0x175c).
 *   5. DESTRUCCIÓN (0x1708): marca SL muerto, consume shard, OR doom-bit. Imprime
 *      "The doom of the Shadowlord " + nombre + " is wrought!" (0x483b + 0x4858/61/6a
 *      + 0x4874). [+ flash + pausa.]
 *
 * El caller aplica los efectos (destroyed/doomBit) sobre el estado.
 */
export function castShardIntoFlame(input: RitualInput): RitualResult {
  const i = input.shardIdx;
  const lines: string[] = [];

  // 1. Cabecera + nombre del shard (siempre).
  lines.push(SHARD_HEADER + SHARD_NAME[i]!);

  // 2. Check de posición (Llama correcta).
  if (
    input.partyX !== FLAME_X[i] ||
    input.partyY !== FLAME_Y[i] ||
    input.location !== FLAME_LOCATION[i] ||
    input.floor !== FLAME_FLOOR[i]
  ) {
    lines.push(RITUAL_NO_EFFECT);
    return { lines, destroyed: false, doomBit: 0 };
  }

  // 3. En la Llama correcta.
  lines.push(CAST_INTO_FLAME + FLAME_NAME[i]!);

  // 4. ¿Está el Shadowlord correcto convocado y adyacente al norte?
  if (input.tileAbove !== SHADOWLORD_TILE) return { lines, destroyed: false, doomBit: 0 };
  if (input.summonedIdx !== i) return { lines, destroyed: false, doomBit: 0 };

  // 5. Destrucción.
  lines.push(DOOM_PREFIX + SHADOWLORD_NAME[i]! + DOOM_SUFFIX);
  return { lines, destroyed: true, doomBit: DOOM_BIT[i]! };
}
