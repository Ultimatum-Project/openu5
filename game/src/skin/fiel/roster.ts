/**
 * Roster del panel derecho (F-H) — calco EXACTO de la rutina de fila del kernel
 * `draw_roster_row 0x27ab-0x2849` (verificada instrucción a instrucción) y de la
 * captura `ztats-refs/01-select-player.png`:
 *
 *   cols 0..8 : NOMBRE, izquierda, rellenado con espacios hasta 9 (0x27ad: `ax=9;
 *               sub curCol; N×putchar(' ')`).
 *   col  9    : FLECHA `→` (glifo IBM.CH 0x1a) SI este miembro es el ACTIVO
 *               (`g_active_char`, 0x27c2) Y está VIVO; espacio en caso contrario.
 *               Si el activo está muerto ('D'=0x44) o dormido ('S'=0x53) la flecha
 *               NO se pinta y el asm resetea g_active_char=0xFF (0x27da-0x27ef).
 *   cols 10..13: HP actual, 4 anchos, justificado a la derecha con espacios
 *               (rec+0x10 `0x55b8`, `format_num 0x1a3e` con ancho 4, pad ' ').
 *   col  14   : letra de ESTADO (rec+0x0b `0x55b3`: G/P/C/S/D…).
 *
 * La COLUMNA de la flecha es FIJA (9), NO depende de la longitud del HP — corrige
 * el port previo que la ponía en `hpStart-3` (variaba con los dígitos del HP) y
 * que además marcaba al LÍDER en vez del ACTIVO. QA #69 item 4.
 *
 * NOTA: el vídeo INVERSO de una fila (control 0xfd, `0x2867`) marca DOS contextos —
 * el actor activo en COMBATE (`g_cmb_actor`) Y el cursor del picker
 * `select_party_member` (guardia del Camp). CORREGIDO por el vídeo del usuario
 * (CAMP.mov): durante "Who will stand guard?" el miembro bajo el cursor va en NEGATIVO
 * y la flecha `→` se queda FIJA en el activo (`g_active_char`) — los dos marcadores
 * coexisten. (El `01-select-player.png` de Ztats mostraba la → del activo, no el
 * cursor.) El caller (`skin.ts`) pasa `selectCursor` como fila inversa.
 */
export const ROSTER_ARROW = 0x1a; // flecha → de IBM.CH (miembro activo)
const SPACE = 0x20;
const NAME_WIDTH = 9; // rec name rellenado a 9 (kernel 0x27ad)
const ARROW_COL = NAME_WIDTH; // flecha en la celda 9 (FIJA)
const HP_WIDTH = 4; // HP a 4 celdas, justificado dcha (kernel 0x1a3e ancho 4)

export interface RosterMember {
  name: string;
  hp: number;
  status: string;
}

/**
 * Rejilla `rows×cols` del roster: una fila por miembro con el layout derivado
 * (nombre-9 · flecha-col9 · HP-4-dcha · estado). `activeIdx` = índice del miembro
 * ACTIVO (`g_active_char`); si es 0xFF o cae fuera de la party no se pinta flecha.
 * La flecha se suprime también si el miembro activo está muerto/dormido.
 */
export function rosterGrid(
  members: readonly RosterMember[],
  activeIdx: number,
  cols: number,
  rows: number,
): Uint8Array {
  const cells = new Uint8Array(rows * cols).fill(SPACE);
  for (let r = 0; r < members.length && r < rows; r++) {
    const m = members[r]!;
    const base = r * cols;
    // Nombre a la izquierda, truncado a 9 (el asm rellena hasta 9; un nombre de
    // 9+ ocuparía la celda de la flecha, así que se acota a NAME_WIDTH).
    const name = m.name.slice(0, NAME_WIDTH);
    for (let i = 0; i < name.length && i < cols; i++)
      cells[base + i] = name.charCodeAt(i);
    // Flecha en la columna FIJA 9 si es el activo Y está vivo.
    const alive = m.status !== "D" && m.status !== "S";
    if (r === activeIdx && alive && ARROW_COL < cols)
      cells[base + ARROW_COL] = ROSTER_ARROW;
    // HP (4, dcha) + estado, pegados tras la flecha (cols 10..14).
    const hp = String(m.hp).slice(-HP_WIDTH);
    const hpStart = ARROW_COL + 1 + (HP_WIDTH - hp.length); // col 10 + pad
    for (let i = 0; i < hp.length && hpStart + i < cols; i++) {
      cells[base + hpStart + i] = hp.charCodeAt(i);
    }
    const statusCol = ARROW_COL + 1 + HP_WIDTH; // col 14
    if (statusCol < cols && m.status.length > 0) {
      cells[base + statusCol] = m.status.charCodeAt(0);
    }
  }
  return cells;
}

/**
 * ★ #213 — QUÉ FILA va en VÍDEO INVERSO, con su PRECEDENCIA. Los tres marcadores son
 * la MISMA primitiva del binario (`0x2a28`, inversión del rectángulo de la fila), así
 * que no pueden coexistir en una misma fila y hace falta un orden:
 *
 *   1. `damageFlash` — el flash de `kernel_apply_damage` 0x2a52 (@0x2a59/0x2a6e). Gana
 *      SIEMPRE mientras dura porque 0x2a28 es un XOR sobre el framebuffer: se pinta
 *      encima de lo que hubiera. Es el que faltaba (tick de veneno al andar).
 *   2. `ztatsCursor` — el candidato del modal de Ztats (mismo picker 0x2d7a).
 *   3. `selectCursor` — el cursor del picker publicado por main.ts (guardia del Camp).
 *   4. `combatActor` — el actor cuyo turno es (`g_cmb_actor`).
 *
 * `null` = ninguna fila invertida.
 */
export function rosterInvertRow(m: {
  damageFlash?: number | null;
  ztatsCursor?: number | null;
  selectCursor?: number | null;
  combatActor?: number | null;
}): number | null {
  return (
    m.damageFlash ?? m.ztatsCursor ?? m.selectCursor ?? m.combatActor ?? null
  );
}
