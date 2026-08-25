/**
 * Tablas VERBATIM del binario para el aplicador de hechizos de LÍNEA
 * (CAST.OVL 0x1c36). Derivaciones: `re/notes/cast-line-area-spell-derivation.md`
 * (cadena + tabla 0x6a14) y `re/notes/fx-lineaoe-negate-derivation.md` §1/§3
 * (mecánica re-derivada 2026-07-22: abanico de 21 rayos, la curva es PENDIENTE
 * — sin gate de probabilidad). Las tablas son FIRMES (bytes verbatim); el
 * consumo vive en `areaSpell.ts::spraySpellCells` + `combat.ts::castLineAoe`.
 */

/**
 * Opacidad a LÍNEA-DE-VISIÓN de hechizo (kernel 0x3f6e, bitmap `DS:0x6a14`). El
 * trazado de la línea del aplicador de área/línea de COMBATE (`0x1f60 → 0x1c36 →
 * 0x1df8 call 0x1bb0 → 0x1c28 → 0x7fee → kernel 0x3f6e`) consulta este bitmap por celda
 * y DETIENE la línea en el primer tile OPACO.
 *
 * ⚠ POLARIDAD CORREGIDA (disasm-mata-resumen — el «210 tiles opacos» de los resúmenes
 * y del oráculo estaba INVERTIDO). El kernel 0x3f6e (re/disasm/ULTIMA.EXE.asm 3f7f-3fb1)
 * hace:
 *   `al=tile; mask=0x80>>(tile&7); cl=bm[tile>>3]; ax = mask & cl`
 *   `cmp cx,1 ; sbb ax,ax ; inc ax`  →  devuelve **1 si el bit está SET, 0 si CLEAR**.
 * Y el consumidor (CAST.OVL.asm 1dfb `or ax,ax ; je 0x1e68`): ax==0 (bit CLEAR) salta a
 * 0x1e68 (pone flag de parada, NO registra la celda); ax!=0 (bit SET) cae al bloque
 * 0x1e34 que SÍ registra la celda y la marca 0xff. ⇒
 *   **bit SET  = TRANSPARENTE** (la línea pasa, la celda recibe el efecto) — 210 tiles.
 *   **bit CLEAR = OPACO**       (la línea PARA, la celda NO entra)          —  46 tiles.
 * Sanidad: hierba 0x05 (byte0 0xff, bit set) = transparente (por eso el field-witness
 * sembró sobre hierba sin cortar); montaña 0x0c/0x0d (byte1 0xf3, bits 4/5 clear) = opaca.
 *
 * Es DISTINTA de la opacidad-luz del fog (`ALWAYS_OPAQUE`/0x6a86, kernel 0x5dfe) y de la
 * pasabilidad (0x54d4). Bytes VERBATIM del binario (relevo del oráculo, lote D §Obj 2);
 * SÓLO se corrige el sentido del predicado, no los bytes.
 */
const LOS_OPACITY_BITMAP = [
  0xff, 0xf3, 0xc3, 0x8f, 0xff, 0xff, 0xff, 0xc0, 0xdd, 0xf8, 0x03, 0xdf, 0xff, 0xff, 0x00, 0x00,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x3f, 0xff, 0xff, 0xff, 0xfe, 0xff, 0xff, 0xff, 0xff,
];

/** ¿el bit del tile está SET en el bitmap 0x6a14? (kernel 0x3f6e devuelve esto como «visible»). */
function bitSet(tile: number): boolean {
  return (LOS_OPACITY_BITMAP[(tile & 0xff) >> 3]! & (0x80 >> (tile & 7))) !== 0;
}

/** Tiles TRANSPARENTES a la LOS de hechizo (bit SET, 210 tiles): la línea los cruza. */
export const SPELL_LOS_TRANSPARENT: ReadonlySet<number> = (() => {
  const s = new Set<number>();
  for (let t = 0; t < 256; t++) if (bitSet(t)) s.add(t);
  return s;
})();

/** Tiles OPACOS a la LOS de hechizo (bit CLEAR, 46 tiles): la línea PARA aquí. */
export const SPELL_LOS_OPAQUE: ReadonlySet<number> = (() => {
  const s = new Set<number>();
  for (let t = 0; t < 256; t++) if (!bitSet(t)) s.add(t);
  return s;
})();

/** ¿el tile corta la línea de un hechizo de área/línea? (kernel 0x3f6e / 0x6a14, bit CLEAR). */
export function blocksSpellLine(tile: number): boolean {
  return !bitSet(tile);
}

/**
 * Curva de PENDIENTE de los 21 RAYOS del abanico (DATA.OVL fileoff 0x1d00 =
 * DS 0x1cf0 + 0x10, 21 words; copiada a `0xa9d0` en CAST 0x1caa-0x1cb7). VERBATIM.
 *
 * ⚠ RE-DERIVADA 2026-07-22 (`fx-lineaoe-negate-derivation.md` §1/§3 — SUPERA la
 * lectura «peso radial / gate de probabilidad» de witness-combat-radial.md y del
 * antiguo nombre AREA_RADIAL_WEIGHT): es el ACUMULADOR DE PENDIENTE por rayo del
 * trazador 0x1c36 — por paso de eje `weight -= 10` (0x1e7d); al agotarse (<1) un
 * paso PERPENDICULAR ±1 px y `weight += curve[i]` (0x1eea-0x1ef4) ⇒ pendiente
 * perpendicular = 10/curve[i] px. Rayo 0/20 (10) = diagonal 45°; rayo 10 (2000) =
 * recto. El «gate rand30>=peso» NO existe: el cmp 0x20cb es el contest de veneno
 * del modo 2 (rand30 vs INT del objetivo, 0xbf46 = COMBAT:0x13e2). La MISMA tabla
 * está duplicada como `SPRAY_CURVE` en la piel (skin/fiel/combat.ts, guarda
 * skin-import-guard).
 */
export const SPRAY_SLOPE_CURVE: readonly number[] = [
  10, 12, 14, 16, 20, 25, 35, 50, 80, 190, 2000, 190, 80, 50, 35, 25, 20, 16, 14, 12, 10,
];
