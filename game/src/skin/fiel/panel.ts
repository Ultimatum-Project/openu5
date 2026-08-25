/**
 * Caja Food/Gold/Fecha del panel (F-D) — formato del original medido en el
 * video-diff (§A-bis punto 2, `orig_fg_date_box.png`): 2 líneas —
 *   L1: `F:{food}` a la IZQUIERDA + `G:{gold}` a la DERECHA (misma línea).
 *   L2: `{m}-{d}-{año}` (fecha de Britannia) MES-DÍA-AÑO, CENTRADA.
 * El orden MES-DÍA lo fija el arnés mismo-estado (#26 f2): el original renderiza
 * `5-4-139` (mes 5, día 4) y el parseo del port es correcto (month=gam[0x2d7]=5,
 * day=gam[0x2d8]=4); ver docs/superpowers/specs/2026-07-15-pixel-diff-samestate-report.md
 * §1 y re/notes/endgame.md (fecha canónica de inicio = Año 139, Mes 4, Día 5).
 * Modelo PURO (rejilla de glifos). Columnas exactas = Clase C (píxel-diff); aquí
 * se calca la ESTRUCTURA (izq/der/centrado).
 */
import { t } from "../../i18n/index.js";

const SPACE = 0x20;

function putStr(cells: Uint8Array, row: number, col: number, s: string, cols: number): void {
  for (let i = 0; i < s.length && col + i < cols && col + i >= 0; i++) {
    cells[row * cols + col + i] = s.charCodeAt(i);
  }
}

export function panelInfoGrid(
  food: number,
  gold: number,
  day: number,
  month: number,
  year: number,
  cols: number,
  rows: number,
): Uint8Array {
  const cells = new Uint8Array(rows * cols).fill(SPACE);
  const fStr = `${t("F:")}${food}`;
  const gStr = `${t("G:")}${gold}`;
  putStr(cells, 0, 0, fStr, cols); // Food a la izquierda
  putStr(cells, 0, cols - gStr.length, gStr, cols); // Gold justificado a la derecha
  if (rows > 1) {
    const date = `${month}-${day}-${year}`; // MES-DÍA-AÑO (orden del original)
    const start = Math.max(0, Math.floor((cols - date.length) / 2));
    putStr(cells, 1, start, date, cols); // fecha centrada
  }
  return cells;
}
