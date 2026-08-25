/**
 * Vista de ZODÍACO del catalejo nocturno (RENDER del comando) — descriptor fiel.
 *
 * La MECÁNICA/gate (noche + overworld/pueblo) vive en `game.ts::useSpyglass()`, calcada de
 * CAST.OVL 0x1a3a. El DIBUJO se deriva de `look_sky` (LOOKOBJ.OVL 0x0366) y sus dos helpers
 * `draw_zodiac_star` (0x01ac) y `draw_zodiac_lines` (0x024c) — disasm propio, cotejado con
 * `re/notes/zodiac-derivation.md`. Cosmético puro (cero gameplay): confirma el veredicto de
 * `witness-catalejo.md` (zodíaco decorativo, sin predicción cometa/planeta).
 *
 * ★ ORDEN DE EJES (derivado, no inferido del dibujo): las dos primitivas del kernel toman la
 * X PRIMERO. `plot` (LOOKOBJ 0x69d4 → base 0xa290 → kernel ULTIMA.EXE 0x0c64) hace `ret 4` =
 * limpieza por el callee = PASCAL ⇒ los args se apilan de izquierda a derecha y `[bp+6]` es el
 * PRIMERO empujado; ese primero va a AX→`[0x52cc]` y el segundo a BX→`[0x52ce]`. Que `[0x52cc]`
 * sea X y `[0x52ce]` sea Y está atado por TRES vías independientes del dibujo: (a) `draw_hline`
 * 0x0c9c escribe en `[0x52cc]` su CX, y su recortador 0x0ccd compara AX/CX contra 0x13f=319 =
 * X máxima; (b) `draw_vline` 0x0cf2 escribe en `[0x52ce]` su DX, y su recortador 0x0d2b compara
 * BX/DX contra 0xc7=199 = Y máxima; (c) el recortador de `plot` (0x08ca) acota AX contra el par
 * de ventana `[0x52d0]/[0x52d2]` — el MISMO par que el recorte de hline usa para las X — y BX
 * contra `[0x52d4]/[0x52d6]` — el mismo par que el de vline usa para las Y.
 *
 * Geometría (todo en px lógicos de la pantalla 320×200, dentro de la ventana del mapa):
 *  - 80 estrellas de fondo (look_sky 0x3ea): el PRIMER `rand_range(9,0xb6=182)` es la X y el
 *    segundo `rand_range(9,0xac=172)` la Y (orden de push a `plot`).
 *  - 8 signos del zodíaco en `(row,col)` de las tablas DATA.OVL (verificadas):
 *      x = col*8, y = row*8   (origen de celda; el glifo añade sus offsets). La COLUMNA que
 *    rota con la fecha es la X: cada signo es un «planeta» que corre por su PISTA horizontal
 *    (la fila, fija por signo). El call site empuja `col+1` al glifo ESTRELLA (0x4a9) y, tras
 *    un `dec` (0x4b0), `col` al glifo LÍNEA (0x4ca) ⇒ la línea nace 8 px a la IZQUIERDA.
 *    Una LÍNEA conecta el signo SÓLO si un Shadowlord está en la ciudad del signo
 *    (`g_shadowlord_locs[i] == i+1`) — el zodíaco MARCA a los Shadowlords (display de
 *    estado ya existente, no predicción).
 *  - ROTACIÓN POR FECHA (rueda del zodíaco, look_sky 0x41a-0x48d): la COLUMNA de cada signo
 *    gira con el calendario. Cada día que pasa desde la fecha de referencia (el ARRANQUE:
 *    año%100=39, mes 4, día 5 → 4-5-139) el signo baja UNA posición VÁLIDA de su anillo
 *    (tabla de validez 0x3760, 22 slots por signo). Cada anillo tiene distinto nº de slots
 *    válidos = distinta VELOCIDAD (signo 0/exterior: 3 posiciones; signo 7/interior: las 22
 *    = se mueve a diario) → 8 «planetas» a velocidades distintas. Calendario 13 meses × 28
 *    días. El mapeo calendario DOS↔port es IDENTIDAD (`state.time` = el .gam byte a byte).
 *  - CLASE-C restante: sólo los índices EGA exactos (ver la nota).
 */
import type { GameState } from "../state.js";
import type { RandFn } from "./survival.js";

/** Tablas del zodíaco (DATA.OVL, fileoff = DS+0x10; verificadas byte a byte). 8 signos. */
const ZODIAC_ROW = [18, 17, 15, 13, 11, 8, 5, 1]; // tabla_3758 → y = row*8 (pista fija del signo)
const ZODIAC_COL = [18, 2, 8, 15, 11, 6, 4, 2]; // tabla_3750 → columna BASE (fecha de arranque)

/**
 * Validez de columna por signo (tabla 0x3760, 22 slots/signo, verificada). Las columnas
 * VÁLIDAS (donde el byte ≠ 0) son las posiciones del anillo por las que gira el signo. La
 * rueda avanza UN slot válido por día transcurrido (look_sky 0x479-0x488, decremento con
 * wrap 0→21 saltando slots vacíos). Cada `ZODIAC_COL[i]` es un slot válido (comprobado).
 */
const ZODIAC_VALID_COLS: readonly (readonly number[])[] = [
  [4, 11, 18],
  [2, 7, 11, 15, 20],
  [2, 5, 8, 11, 14, 17, 20],
  [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21],
  [0, 2, 4, 6, 8, 9, 11, 13, 14, 16, 18, 19, 21],
  [1, 2, 3, 5, 6, 7, 9, 10, 11, 12, 13, 15, 16, 17, 19, 20, 21],
  [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
];

/** Fecha de REFERENCIA de la rueda = arranque del juego (4-5-139). El asm compara año%100. */
const REF_YEAR_MOD = 39; // año 139 → 139 % 100
const REF_MONTH = 4;
const REF_DAY = 5;
const DAYS_PER_MONTH = 28; // calendario de Ultima V (13 meses × 28 días)
const MONTHS_PER_YEAR = 13;

/**
 * Días transcurridos desde la fecha de referencia (4-5-139), calendario DOS (13×28). El asm
 * camina día a día hasta año%100=39/mes4/día5; si la fecha es ≤ referencia → 0 (sin rotar).
 */
function daysSinceEpoch(year: number, month: number, day: number): number {
  const d =
    ((year % 100) - REF_YEAR_MOD) * (DAYS_PER_MONTH * MONTHS_PER_YEAR) +
    (month - REF_MONTH) * DAYS_PER_MONTH +
    (day - REF_DAY);
  return d > 0 ? d : 0;
}

/**
 * Columna del signo `i` tras `days` días de rotación: parte de la columna BASE y baja `days`
 * posiciones válidas del anillo (cíclico). En la lista ascendente de válidas, un paso atrás =
 * índice−1 con wrap (la más baja → la más alta), calcado del decremento con salto del asm.
 */
function rotatedColumn(i: number, days: number): number {
  const valid = ZODIAC_VALID_COLS[i]!;
  const n = valid.length;
  const baseIdx = valid.indexOf(ZODIAC_COL[i]!);
  const idx = (((baseIdx - days) % n) + n) % n;
  return valid[idx]!;
}

export interface ZodiacStar {
  x: number;
  y: number;
}
export interface ZodiacSign {
  /** Origen X del glifo ESTRELLA = `(col+1)*8` (look_sky 0x4a9 empuja `col+1` como PRIMER arg). */
  starX: number;
  /** Origen X del glifo LÍNEA = `col*8` (look_sky 0x4b0 hace `dec` antes de llamar a 0x24c). */
  lineX: number;
  /** Origen Y de AMBOS glifos = `row*8` (tabla_3758; segundo arg de las dos llamadas). */
  y: number;
  /** Un Shadowlord está en la ciudad de este signo → se dibuja la línea conectora. */
  hasLine: boolean;
}
export interface ZodiacView {
  bgStars: ZodiacStar[];
  signs: ZodiacSign[];
}

/** Nº de estrellas de fondo (look_sky 0x3ef: si=0x50). */
export const ZODIAC_BG_STARS = 80;

/**
 * Construye el descriptor de la vista celeste. `rand` (inclusivo) siembra las 80 estrellas
 * UNA vez (se congela en el snapshot: no titilan por frame). Las posiciones exactas no son
 * byte-idénticas (dependen del stream RNG vivo del binario) pero la distribución es fiel.
 */
export function buildZodiacView(state: GameState, rand: RandFn): ZodiacView {
  const bgStars: ZodiacStar[] = [];
  for (let i = 0; i < ZODIAC_BG_STARS; i++) {
    const r1 = rand(9, 182); // look_sky 0x3f2: primer rand (rango 0xb6) → PRIMER push
    const r2 = rand(9, 172); // 0x3fe: segundo rand (rango 0xac) → SEGUNDO push
    bgStars.push({ x: r1, y: r2 }); // plot(x=r1, y=r2): el primer push es la X
  }
  const locs = state.shadowlordLocs ?? [];
  const days = daysSinceEpoch(state.time.year, state.time.month, state.time.day);
  const signs: ZodiacSign[] = [];
  for (let i = 0; i < 8; i++) {
    const col = rotatedColumn(i, days); // columna girada por la fecha (rueda del zodíaco)
    signs.push({
      starX: (col + 1) * 8,
      lineX: col * 8,
      y: ZODIAC_ROW[i]! * 8,
      hasLine: locs.some((loc) => loc === i + 1),
    });
  }
  return { bgStars, signs };
}
