/**
 * Grupos de animación de tiles + frame por fase — dato LÓGICO derivado de
 * `TILE_INFO` (core/tiles) y del reloj maestro del original, compartido por las
 * pieles que animan terreno. Calca `advance_tile_anim_frames 0x44b8` sobre la
 * tabla de remapeo `0x4ee2` (`re/notes/kernel-sweep-4.md §2`,
 * `re/notes/tile-anim-census.md`): cada grupo es una corrida CONSECUTIVA de
 * frames que cicla `base + (offset + phase/divisor) % size`.
 *
 * DIVISOR (nº de ticks de 55 ms por avance de frame) — derivado del reloj:
 * el TICK BASE del original es el timer BIOS a 18.2 Hz (~55 ms); el reloj de
 * animación `0x44b8` corre cada 2 ticks (~110 ms), por eso los ciclos de 4
 * frames (agua/fuente/rótulo) avanzan a 110 ms → `divisor 2`. Los toggles de 2
 * frames (0x80..83, 0xfa..fd) están además gateados por `[0x6a7e]&1/&2` dentro
 * del reloj → avanzan cada 2 llamadas = ~220 ms → `divisor 4`. Así el cursor de
 * consola (que cablea al tick base puro) queda a 55 ms sin acelerar el agua.
 *
 * Vive en `render/` (no en el contrato) a propósito: la piel no puede importar el
 * core en runtime (guard Regla B), pero `render/` sí puede leer `core/tiles`
 * (metadato lógico, Regla C); y `render/` no importa la piel. No usa PixiJS: es
 * puro, apto tanto para el Renderer dev como para la piel fiel (canvas 2D).
 */
import { TILE_INFO } from "../core/tiles.js";
import { WATER_SCROLL_TILES } from "./waterfn32.js";

/**
 * Tiles de agua que NO se ciclan por id: su animación es el SCROLL fn32 (mecanismo B,
 * `waterfn32.ts`), no un ciclo de tile-id. Redux marca 0x01/0x02 como `IsPartOfAnimation`
 * (artefacto de su modelo de anim-por-swap), pero el original NO cambia el id de la celda:
 * scrollea el bitmap del tile EN SU SITIO (`re/notes/water-anim-audit.md`). Si se ciclaran,
 * una celda 0x01 mostraría el frame 0x02 y la capa de scroll pintaría el agua equivocada.
 */
const SCROLL_TILES: ReadonlySet<number> = new Set(WATER_SCROLL_TILES);

export interface AnimGroup {
  base: number;
  size: number;
  /** Ticks de 55 ms por avance de frame (2 = 110 ms ciclo, 4 = 220 ms toggle). */
  divisor: number;
  /**
   * `true` = grupo de SPRITE DE ACTOR (banco alto 0x100..0x1FF: personas, criaturas,
   * party) → su frame NO lo mueve el reloj de render libre, sino el CONTADOR DE TURNOS
   * del mundo (`animatedFrame(…, turn)`), 1 frame por turno. Deriva del original: el
   * reloj maestro de tiles `0x44b8` sólo remapea el banco de terreno (0xd4–0xf0 vía
   * `0x4ee2`); los sprites de actor NO están en él (frame = `base+op−1 < 0x100` en el
   * intérprete `0x4552`). Medido en el DOSBox del usuario (video-C): un actor QUIETO
   * NO cicla a ~110 ms — se congela cuando no pasan turnos (Avatar: 1 cambio en 13 s de
   * reposo) y avanza al andar/actuar. Los grupos de TERRENO (banco bajo) quedan en el
   * reloj de render (`perTurn` ausente/false), que es la cadencia correcta (fuente,
   * antorchas, reloj — «los no-personas van bien», testigo del usuario 2026-07-18).
   * Ver `re/notes/tile-anim-census.md`, `re/notes/sprite-anim-cadence.md`.
   */
  perTurn?: boolean;
}

/**
 * Umbral del BANCO ALTO de sprites del atlas: los tiles `>= 0x100` (256) son los
 * sprites de ACTOR (0x134..0x1ff en `TileData`: personas, criaturas, party). Todo
 * grupo animado con `base >= SPRITE_BANK` avanza por turno del mundo, no por el reloj
 * de render (ver `AnimGroup.perTurn`). El banco bajo (< 0x100) es terreno/decoración.
 */
export const SPRITE_BANK = 0x100;

/**
 * Bases de grupo cuyo avance el reloj `0x44b8` gatea por `[0x6a7e]&1/&2` → medio
 * ritmo (~220 ms, `divisor 4`): los toggles de 2 frames tortura (0x80/0x82) y
 * reloj/fuelle (0xfa/0xfc). El resto de los grupos animados va a `divisor 2`
 * (~110 ms), incluido el agua de superficie 0x01/0x02 (caso ya-correcto de las
 * dos variantes someras/profundas, no se acelera).
 */
const TOGGLE_BASES: ReadonlySet<number> = new Set([0x80, 0x82, 0xfa, 0xfc]);

/**
 * Grupos del reloj maestro `0x44b8` que la tabla `TILE_INFO` (derivada de Redux)
 * NO marca como animados y hay que inyectar para paridad: los rótulos de serpiente
 * 0xec..0xef (`inc [si-0x4ee2]`, wrap `0xf0→0xec`, ciclo de 4 frames). Agua/fuente
 * (0xd4/0xd8) y toggles (0x80/0xfa) sí vienen ya en `TILE_INFO`.
 */
const MISSING_CLOCK_GROUPS: ReadonlyArray<{ base: number; size: number }> = [
  { base: 0xec, size: 4 },
];

/** Divisor derivado del reloj para un grupo dado su base. */
function divisorFor(base: number): number {
  return TOGGLE_BASES.has(base) ? 4 : 2;
}

let cache: readonly (AnimGroup | null)[] | null = null;

/**
 * Tabla de grupos de animación por id de tile (memoizada). Un grupo = corrida
 * consecutiva con `animationIndex` 0,1,2,… en `TILE_INFO`, más los grupos del
 * reloj maestro que `TILE_INFO` omite (`MISSING_CLOCK_GROUPS`). `null` = estático.
 */
export function buildAnimGroups(): readonly (AnimGroup | null)[] {
  if (cache) return cache;
  const count = TILE_INFO.length;
  const groups: (AnimGroup | null)[] = new Array<null>(count).fill(null);
  let i = 0;
  while (i < count) {
    const info = TILE_INFO[i];
    if (SCROLL_TILES.has(i)) {
      // Agua de scroll fn32: nunca cicla por id (la capa de scroll la anima en su sitio).
      i++;
      continue;
    }
    if (info?.isPartOfAnimation && info.animationIndex === 0) {
      let size = 1;
      while (
        i + size < count &&
        TILE_INFO[i + size]?.isPartOfAnimation &&
        TILE_INFO[i + size]!.animationIndex === size &&
        !SCROLL_TILES.has(i + size)
      ) {
        size++;
      }
      const divisor = divisorFor(i);
      const perTurn = i >= SPRITE_BANK;
      for (let j = 0; j < size; j++) groups[i + j] = { base: i, size, divisor, perTurn };
      i += size;
    } else {
      i++;
    }
  }
  // Inyecta los grupos del reloj maestro ausentes de TILE_INFO (p.ej. rótulos
  // de serpiente 0xec..0xef) sin pisar los ya derivados.
  for (const { base, size } of MISSING_CLOCK_GROUPS) {
    if (base + size > count || groups[base]) continue;
    const divisor = divisorFor(base);
    for (let j = 0; j < size; j++) groups[base + j] = { base, size, divisor };
  }
  cache = groups;
  return groups;
}

/**
 * Frame de un tile animado. Dos relojes según el grupo:
 *  - TERRENO (`perTurn` falso): `base + (offset + floor(phase/divisor)) % size` —
 *    el reloj de render libre (55 ms base), con el divisor al ritmo del tile.
 *  - SPRITE DE ACTOR (`perTurn` true, banco alto ≥0x100): `base + (offset + turn) % size`
 *    — avanza 1 frame por TURNO del mundo, no por el reloj de render. Así un actor
 *    quieto se congela (no hay turnos) y anda al ritmo de los pasos, como el original
 *    (ver `AnimGroup.perTurn`). El caller pasa el contador de turnos; por defecto 0
 *    (dev/tests que no animan actores → muestran el frame base, no el parpadeo rápido).
 * Tile estático (o fuera de tabla) → el id tal cual.
 */
export function animatedFrame(
  tile: number,
  phase: number,
  groups: readonly (AnimGroup | null)[],
  turn = 0,
): number {
  const g = groups[tile];
  if (!g) return tile;
  const step = g.perTurn ? turn : Math.floor(phase / (g.divisor || 1));
  return g.base + ((tile - g.base + step) % g.size);
}
