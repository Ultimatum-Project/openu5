/**
 * Clavicémbalo (Harpsichord) — TOWN.OVL 0x0E34 (task #54, G2).
 *
 * Derivación: re/notes/interactions-piano-fire-audit.md §1.
 *
 * En un small map, si la party está SENTADA al clavicémbalo (el tile
 * INMEDIATAMENTE AL SUR = `g_unk_abc7` == 0x8D Harpsichord; hay una silla
 * 0x92 al norte donde uno se sienta mirando al sur), los dígitos '0'-'9' tocan
 * una nota (tabla `DS:0x2746`, cue `instrument-note`) SIN consumir turno, en vez
 * de su función normal.
 *
 * El handler ademas lleva un MATCHER de la melodía secreta (`DS:0x275A`):
 * `6 7 8 9 8 7 8 7 6 7 6 5 3` (13 notas). Al completarla —y sólo en el Castillo
 * de Lord British (loc 0x11) planta 2— el original conmuta un tile de muro↔suelo
 * (`xor [0x67b9],0xb`) y revela un PASADIZO secreto.
 *
 * GATE Y CELDA, VERIFICADOS BYTE A BYTE (careo #38, 2026-07-27, sobre
 * `re/disasm/TOWN.OVL.asm`) — antes esta cabecera decía «celda exacta pendiente de
 * fijar con el oráculo» y se contradecía con `HARPSICHORD_PASSAGE` veinte líneas más
 * abajo, que ya la daba por fijada. **No hace falta oráculo: está en el binario.**
 *   0e81  inc byte [0x2767]              ; contador de notas acertadas
 *   0e85  cmp byte [0x2767], 0xd / jne   ; ← 13 NOTAS exactas
 *   0e8c  mov byte [0x2767], ah          ; reset del contador
 *   0e90  cmp byte [g_location], 0x11 / jne ; ← SÓLO castillo de LB
 *   0e97  cmp byte [g_floor], 2 / jne       ; ← SÓLO planta 2
 *   0e9e  xor byte [0x67b9], 0xb         ; muro↔suelo
 *   0ea3  call 0xffffaea2                ; TERREMOTO (el `quake` del clon)
 *   0ea6  mov byte [g_unk_24e6], 1       ; marcador de turno
 * La CELDA sale de la aritmética del buffer, no de un testigo:
 * `0x67b9 − 0x6608 = 0x1B1 = 433 = 13·32 + 17` ⇒ (x=17, y=13) con stride 32.
 */

/** Tile del clavicémbalo (TileData "141"). */
export const HARPSICHORD_TILE = 0x8d;

/**
 * La CELDA del pasadizo secreto que revela la melodía, FIJADA con el oráculo
 * (task #54 G2b): el handler hace `xor [0x67b9],0xb` y `0x67b9` = celda (17,13)
 * del buffer de mapa de la planta actual (base DS 0x6608, stride 32; correlación
 * 1024/1024 vs CASTLE.DAT). En LB castle (loc 0x11) floor 2 esa celda es
 * `0x4F StoneBrickWall` → `0x44 BrickFloor` (0x4F^0xB=0x44): abre el muro al
 * norte del clavicémbalo (corredor 17,17→17,14). Ver interactions-piano-fire-audit.md §1.4.
 */
export const HARPSICHORD_PASSAGE = {
  location: 0x11,
  floor: 2,
  x: 17,
  y: 13,
  closedTile: 0x4f, // StoneBrickWall
  openTile: 0x44, // BrickFloor
} as const;

/**
 * Melodía secreta (DATA.OVL DS:0x275A, 13 dígitos). Al tocarla entera en LB
 * castle floor 2 se revela el pasadizo.
 */
export const HARPSICHORD_MELODY = [6, 7, 8, 9, 8, 7, 8, 7, 6, 7, 6, 5, 3] as const;

export interface MelodyStep {
  /** Nuevo índice de progreso del matcher (0..12). */
  progress: number;
  /** True si esta nota COMPLETÓ la melodía (13 aciertos seguidos, con rebobinado). */
  complete: boolean;
}

/**
 * Avanza el matcher de la melodía con la nota `digit`, desde `progress`.
 * Port byte-a-byte de TOWN 0x0E70-0x0EE8:
 *  - acierto (`digit == MELODY[progress]`): progress++; si llega a 13 → complete,
 *    y el progreso se resetea a 0.
 *  - fallo: rebobinado ESPECIALIZADO (tabla hardcodeada del original):
 *      progress==10 y digit==8 → 3   (0eae/0eb5)
 *      progress==11 y digit==7 → 2   (0ec2/0ec9)
 *      digit==6 (MELODY[0])     → 1  (0ed6/0ee0)
 *      resto                    → 0  (0ee8)
 */
export function advanceMelody(progress: number, digit: number): MelodyStep {
  if (digit === HARPSICHORD_MELODY[progress]) {
    const next = progress + 1;
    if (next === HARPSICHORD_MELODY.length) return { progress: 0, complete: true };
    return { progress: next, complete: false };
  }
  // Fallo: rebobinado hardcodeado del binario (0eae-0ee8).
  if (progress === 10 && digit === 8) return { progress: 3, complete: false };
  if (progress === 11 && digit === 7) return { progress: 2, complete: false };
  if (digit === 6) return { progress: 1, complete: false };
  return { progress: 0, complete: false };
}
