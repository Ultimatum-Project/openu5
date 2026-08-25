/**
 * DERIVACIÓN PURA de la ESCENA de MUERTE + RESURRECCIÓN de Lord British (party-wipe /
 * "refuge") — el montaje que el original pinta cuando TODA la party cae (BLCKTHRN.OVL
 * `party_refuge` 0x0910): el viewport se ENNEGRECE (0x0962), el Avatar queda SOLO en el
 * centro, y sobre esa "nada" del sueño aparecen dos figuras espectrales flanqueantes y la
 * APARICIÓN cyan mientras Lord British recita el discurso de karma. Presentación PURA
 * (regla #71: pintar no muta el core); `coreview.ts` hornea estos tiles en `window` según
 * la FASE que main.ts va fijando al pacear el guión (`RefugeScript`), y la piel fiel pinta
 * el viewport por el bucle normal (los negativos = negro).
 *
 * Autoridad byte-fiel: `re/notes/death-resurrection-audit.md` §3 + disasm BLCKTHRN.OVL
 * 0x0910. Blits (kernel 0x6dd8 [= CS 0x1068 → ULTIMA.EXE:0x1068, 3 args por pila]
 * `blit(tile,col,row)`):
 *  - 0x0a70: `push 0x5e; push 2; push 7` → figura fantasma IZQUIERDA en (col2,row7).
 *  - 0x0aa2: `push 0x5f; push 8; push 7` → figura fantasma DERECHA  en (col8,row7).
 *  - 0x0ae9: `push 0x174; push 5; push 2` → APARICIÓN cyan (misma familia 0x174-0x177
 *    del camp, distinta CELDA: camp=(5,5), refuge=(5,2)) en (col5,row2).
 * CONFIRMADO en video-M f042 (viewport negro + Avatar solo) y f058 (aparición arriba-
 * centro + las dos figuras espectrales abajo-izq/dcha + discurso entre comillas).
 *
 * Clase C (no aquí): la cadencia real-time (delays 0x7e6a → ms) y el destello de "Vertigo".
 */
import type { RefugeScenePhase } from "../core/game.js";
import { VIEW_HALF } from "./api.js";

/** Tile de la APARICIÓN — "Apparation1" (0x174), grupo cyan de 4 frames (auto-anima). */
const REFUGE_APPARITION_TILE = 0x174;
/** Tile de la figura espectral IZQUIERDA (0x0a70 `push 0x5e`). */
const REFUGE_GHOST_LEFT_TILE = 0x5e;
/** Tile de la figura espectral DERECHA (0x0aa2 `push 0x5f`). */
const REFUGE_GHOST_RIGHT_TILE = 0x5f;

/** Celda de la aparición (0x0ae9 `push 5; push 2`) — arriba-centro. */
const REFUGE_APPARITION_CELL = { col: 5, row: 2 } as const;
/** Celda de la figura espectral izquierda (0x0a70 `push 2; push 7`) — abajo-izquierda. */
const REFUGE_GHOST_LEFT_CELL = { col: 2, row: 7 } as const;
/** Celda de la figura espectral derecha (0x0aa2 `push 8; push 7`) — abajo-derecha. */
const REFUGE_GHOST_RIGHT_CELL = { col: 8, row: 7 } as const;
/** Celda del Avatar — el centro del viewport (VIEW_HALF, VIEW_HALF), solo en la nada. */
const REFUGE_AVATAR_CELL = { col: VIEW_HALF, row: VIEW_HALF } as const;

/** Una figura a hornear en el viewport negro del refuge: celda + tile. */
export interface RefugeSceneFigure {
  col: number;
  row: number;
  tile: number;
}

/**
 * Figuras VISIBLES en una fase dada — ACUMULATIVAS: el Avatar siempre (centro); a partir
 * de `ghostLeft` la figura izquierda (0x5e); `ghostBoth` añade la derecha (0x5f); y
 * `apparition`/`vertigo` la aparición cyan (0x174) arriba-centro. El viewport se pinta
 * NEGRO (celdas no cubiertas = negativas), como el original ennegrece la ventana (0x0962).
 * PURA: no referencia estado externo; `avatarTile` lo resuelve coreview (sprite del líder).
 */
export function buildRefugeSceneFigures(
  phase: RefugeScenePhase,
  avatarTile: number,
): RefugeSceneFigure[] {
  const figures: RefugeSceneFigure[] = [
    { col: REFUGE_AVATAR_CELL.col, row: REFUGE_AVATAR_CELL.row, tile: avatarTile },
  ];
  if (phase === "void") return figures;
  // ghostLeft y superiores: figura espectral izquierda.
  figures.push({
    col: REFUGE_GHOST_LEFT_CELL.col,
    row: REFUGE_GHOST_LEFT_CELL.row,
    tile: REFUGE_GHOST_LEFT_TILE,
  });
  if (phase === "ghostLeft") return figures;
  // ghostBoth y superiores: figura espectral derecha.
  figures.push({
    col: REFUGE_GHOST_RIGHT_CELL.col,
    row: REFUGE_GHOST_RIGHT_CELL.row,
    tile: REFUGE_GHOST_RIGHT_TILE,
  });
  if (phase === "ghostBoth") return figures;
  // apparition / vertigo: la aparición cyan arriba-centro.
  figures.push({
    col: REFUGE_APPARITION_CELL.col,
    row: REFUGE_APPARITION_CELL.row,
    tile: REFUGE_APPARITION_TILE,
  });
  return figures;
}
