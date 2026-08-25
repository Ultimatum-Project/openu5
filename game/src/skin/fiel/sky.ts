/**
 * BANDA CELESTE (E1-S8b) — sol + 2 lunas sobre la barra superior, calco de la
 * rutina del kernel `0x4adb` (`re/notes/ui-text-layer.md §9`, cruza con
 * `re/notes/shrines.md` para las fases). Posiciones por HORA (fórmulas del asm),
 * glifos de la fuente RÚNICA (RUNES.CH = fuente 1 del kernel, `0x1c9e(1)` @0x4ac0,
 * no IBM.CH): sol = `0x2A` (ráfaga de 8 rayos), lunas = `0x30 + fase` (0..7 = las 8
 * FASES, círculos crecientes/menguantes). En IBM.CH el 0x2A es un rombo y 0x30-0x37
 * dígitos; la piel imprime el cielo con el atlas `font-runes.png` (ver skin.ts).
 *
 * Sólo aplica en la superficie del overworld (el kernel gatea por `g_location !=
 * 0x19` y `g_floor < 0x80`); la aplicabilidad + las dos fases las provee el core
 * en `snapshot.sky` (info visible: las lunas se ven en el cielo). La CELDA sale
 * de la hora (presentación derivada). El origen exacto de la banda en la barra
 * (col de cursor 6, ventana runtime) es Clase C — píxel-diff.
 */
export const SUN_GLYPH = 0x2a;
export const MOON_PHASE_BASE = 0x30; // RUNES.CH: 0x30+fase → fase lunar 0..7
export const SKY_CELLS = 12; // ancho de la banda (buffer de 12, 0x4adb)
export const SKY_COL = 6; // set_cursor(6,0) @0x4b53 (origen de ventana = Clase C)
export const SKY_ROW = 0;

export interface SkyMark {
  cell: number; // 0..11 dentro de la banda
  code: number; // glifo IBM.CH
  isSun: boolean; // el sol usa otro color (g_unk_13b8) que las lunas (13ba)
}

/**
 * Marcas del cielo por hora + fases (0..7). Derivado de `0x4adb`:
 *  - sol   `17 - hour`               visible si 0..11  (0x4ac8 sub 0x11 + neg)
 *  - felucca `8 - hour` (+24 si <-12) visible si 0..11 (0x4af1, 0x4afb)
 *  - trammel `2 - hour` (+24 si <-12) visible si 0..11 (0x4b28)
 */
export function skyMarks(hour: number, felucca: number, trammel: number): SkyMark[] {
  const out: SkyMark[] = [];
  const sun = 17 - hour;
  if (sun >= 0 && sun < SKY_CELLS) out.push({ cell: sun, code: SUN_GLYPH, isSun: true });

  let fc = 8 - hour;
  if (fc < -12) fc += 24;
  if (fc >= 0 && fc < SKY_CELLS) {
    out.push({ cell: fc, code: MOON_PHASE_BASE + (felucca & 7), isSun: false });
  }

  let tc = 2 - hour;
  if (tc < -12) tc += 24;
  if (tc >= 0 && tc < SKY_CELLS) {
    out.push({ cell: tc, code: MOON_PHASE_BASE + (trammel & 7), isSun: false });
  }
  return out;
}
