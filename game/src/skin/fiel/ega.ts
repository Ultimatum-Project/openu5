/**
 * Paleta EGA de 16 colores (índice → #rrggbb) — FUENTE ÚNICA (auditoría D2: estaba
 * copiada a mano en gemmap.ts, dungeon.ts, gemmap-overworld.ts y teleportPicker.ts;
 * un verdict de color, como el brown-fix del índice 6, exigía tocar 4 ficheros y
 * olvidar uno divergía colores sin aviso).
 *
 * Valores canónicos del adaptador EGA (paleta runtime de INTRO.OVL 0x09ee, rama
 * 52c8 ∉ {0,3} = EGA/Tandy). Índice 6 = MARRÓN #AA5500 (no #AAAA00: el EGA remapea
 * el amarillo oscuro a marrón — brown-fix, verdict runtime).
 */
export const EGA_PALETTE = [
  "#000000", "#0000aa", "#00aa00", "#00aaaa", "#aa0000", "#aa00aa", "#aa5500", "#aaaaaa",
  "#555555", "#5555ff", "#55ff55", "#55ffff", "#ff5555", "#ff55ff", "#ffff55", "#ffffff",
] as const;
