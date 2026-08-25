/**
 * ANCLA DE CORPUS de las etiquetas de HUD de la PIEL FIEL (i18n).
 *
 * La piel (`src/skin/fiel/panel.ts`, `ztats.ts`) blitea unas etiquetas de estado
 * calcadas byte-a-byte del original (caja Food/Gold del panel, página de Provisiones
 * de Ztats). La piel NO puede importar el core en runtime (regla de separación
 * piel↔core, `skin-import-guard`), así que recompone esos literales por su cuenta y
 * los pasa por `t()`. Para que la guarda anti-fabricación (`extract-user-strings`
 * `DISPLAY_CONSTS`) VEA esos strings ingleses y `es.json` pueda traducirlos por su
 * clave exacta, viven AQUÍ como ancla escaneada (mismo patrón que `WIND_BAND_LABELS`
 * en `wind.ts`). Este módulo es SÓLO ancla de corpus: no lo importa nadie en runtime
 * (la piel tiene sus propias constantes espejo). Cada valor lleva su cita al binario.
 */
export const HUD_FAITHFUL_LABELS: readonly string[] = [
  // Caja compacta del panel (panel.ts) — medida en video-diff (orig_fg_date_box.png).
  "F:", // prefijo Food (izquierda)
  "G:", // prefijo Gold (derecha)
  // Página de Provisiones de Ztats (ztats.ts) — DATA.OVL con puntos de relleno.
  " Food: ", //      DS 0x972e
  " Gold: ", //      DS 0x9738
  " Keys.......", // DS 0x9742
  " Gems.......", // DS 0x9752
  " Torches....", // DS 0x9760
  " Grapple", //     DS 0x976e
  // Página de STATS de Ztats (ztats.ts, draw_stat_page 0x0082). La mayoría de las
  // etiquetas ya están en el corpus por un pool de data.json; sólo estas dos faltaban.
  "Dex=", //   DS 0x96f4
  "Magic:", // DS 0x9700 ("\n\n    Magic:")
  // Banner de SELECCIÓN de miembro en Ztats/Ready (ztats.ts, ztatsBannerText).
  "Select:",
];
