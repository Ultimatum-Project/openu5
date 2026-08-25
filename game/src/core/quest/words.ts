/**
 * Words of Power — las 8 mazmorras de Britannia están selladas y sólo se abren
 * pronunciando su Palabra al entrar (U5). El orden de `wordsOfPower` (DATA.OVL)
 * se corresponde 1:1 con las localizaciones de mazmorra 33..40:
 *   33 Deceit   → FALLAX      37 Covetous → AVIDUS
 *   34 Despise  → VILIS       38 Shame    → INFAMA
 *   35 Destard  → INOPIA      39 Hythloth → IGNAVUS
 *   36 Wrong    → MALUM       40 Doom     → VERAMOCOR
 *
 * Núcleo puro: sin DOM, sin I/O. El caller pasa `wordsOfPower` (data.json).
 */

/** Primera localización de mazmorra (Deceit). Doom es 40. */
export const FIRST_DUNGEON_LOCATION = 33;
export const LAST_DUNGEON_LOCATION = 40;

/** Clave estable en questFlags para una mazmorra ya abierta con su palabra. */
export function wordSpokenFlag(location: number): string {
  return `word-spoken:${location}`;
}

/**
 * La Palabra de Poder que sella la mazmorra en `location` (33..40), o `null`
 * si la localización no es una mazmorra sellada.
 */
export function wordForDungeon(location: number, wordsOfPower: string[]): string | null {
  if (location < FIRST_DUNGEON_LOCATION || location > LAST_DUNGEON_LOCATION) return null;
  const word = wordsOfPower[location - FIRST_DUNGEON_LOCATION];
  return word ?? null;
}

/** DS 0x44d7 — se imprime al gritar CUALQUIER palabra de poder válida (CMDS 0x12f2). */
export const WORD_UTTERED = "\nA word of power is uttered\n";
/** DS 0x44f4 — "sin efecto" del yell (CMDS 0x1408) y del ritual. */
export const YELL_NO_EFFECT = "\nNo effect!\n";

export interface YellWordResult {
  /**
   * La palabra gritada CASA una de las 8 Palabras de Poder (CMDS 0x12ea `jg`). En el
   * original esto imprime "A word of power is uttered" (0x12f2) e INMEDIATAMENTE dispara
   * el TERREMOTO (0x12f9 `call 0x70f2` → kernel 0x3072), con independencia de que haya
   * mazmorra adyacente. Ver re/notes/quake-harpsichord.md §4.
   */
  uttered: boolean;
  /** El sello de una mazmorra se ABRE este turno (party adyacente + palabra correcta). */
  opened: boolean;
  /** Localización de la mazmorra cuyo sello se abre (33..40), o null. */
  openedLocation: number | null;
  /** Mensajes en orden de impresión del original. */
  messages: string[];
}

/**
 * (Y)ell de una palabra de poder en el OVERWORLD — CMDS.OVL 0x12c8 `cmd_yell_overworld`.
 * DERIVACIÓN (re/notes/death-resurrection-audit.md §1, disasm CMDS 0x12c8-0x1417):
 *  - La palabra se casa (substring-toupper, kernel 0xffffaf9e — mismo helper que el
 *    mantra) contra la tabla de 8 palabras DS 0x4502 (FALLAX..VERAMOCOR ↔ loc 33..40).
 *  - Si casa CUALQUIER palabra → imprime "\nA word of power is uttered\n" (0x12f2).
 *  - El match posicional NO es direccional y NO usa getdir (#149 corrigió «party+dir» aquí:
 *    era la geometría equivocada, y contradecía a `adjacentDungeonLocations` doce líneas más
 *    abajo). El handler ESCANEA LOS 4 TILES VECINOS en ORDEN FIJO leyendo sus cachés de
 *    terreno — 0xaba6 (O, 0x12fc), g_unk_abc7 (S, 0x131a; el mismo vecino-sur del
 *    clavicémbalo, game.ts:1559), 0xaba8 (E, 0x1338), 0xab87 (N, 0x1354) — y el PRIMERO cuyo
 *    tile case con [si+0x4512] (o sea 0xdf/0x1a) fija el desplazamiento (dx,dy) ∈
 *    {(-1,0),(0,1),(1,0),(0,-1)}. Sólo ESA celda, `party+(dx,dy)`, se compara contra las
 *    tablas de coordenada DS 0x1eaa/0x1ed2 (0x139a-0x13bb). Si casa → togglea el bit de sello
 *    (`xor [0x58d0+i],0x80`), transforma el tile de entrada y **cobra turno** (0x13e2).
 *  - Si la palabra es válida pero NO hay match posicional → además "\nNo effect!\n"
 *    (0x1408, bp-6==0). Palabra inválida → sólo "\nNo effect!\n".
 *
 * `adjacentDungeonLocations` = las localizaciones de mazmorra (33..40) presentes en las
 * 4 celdas adyacentes al party (el caller las resuelve con las tablas locationsX/Y). El
 * sello persiste como estado de mundo: `questFlags["word-spoken:<loc>"]` (equivalente al
 * bit 0x80 de [0x58d0+i]; el tile-transform del original es cosmético/piel).
 */
export function yellWordOfPower(
  wordsOfPower: string[],
  spokenWord: string,
  adjacentDungeonLocations: readonly number[],
): YellWordResult {
  const said = spokenWord.trim().toUpperCase();
  // substring-toupper: la palabra de la tabla debe aparecer DENTRO de lo gritado.
  const idx =
    said.length === 0
      ? -1
      : wordsOfPower.findIndex((w) => w.length > 0 && said.includes(w.toUpperCase()));
  if (idx < 0) {
    return { uttered: false, opened: false, openedLocation: null, messages: [YELL_NO_EFFECT] };
  }
  const dungeonLoc = FIRST_DUNGEON_LOCATION + idx;
  if (dungeonLoc <= LAST_DUNGEON_LOCATION && adjacentDungeonLocations.includes(dungeonLoc)) {
    return { uttered: true, opened: true, openedLocation: dungeonLoc, messages: [WORD_UTTERED] };
  }
  // Palabra válida pero sin entrada adyacente que casa → "uttered" + "No effect!".
  return {
    uttered: true,
    opened: false,
    openedLocation: null,
    messages: [WORD_UTTERED, YELL_NO_EFFECT],
  };
}

