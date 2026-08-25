/**
 * CENSO DE TRANSPARENCIA (piel shader) — tratamiento «B» aprobado por el usuario:
 * alpha .55 del CUERPO. Veredicto sobre `docs/verdicts/sprites-transparencia/candidatos.md`
 * ("Ok a la propuesta B"). Aquí viven las CONSTANTES del censo y la lógica PURA (sin DOM/
 * canvas), testeable; el compositado de canvas vive en `skin.ts` (QA de navegador).
 *
 * 1ª OLA (top del ranking):
 *  · ACTORES: fantasmas 412-415, wisps 468-471, shadowlords 508-511 — cuerpo a .55 sobre
 *    el terreno (el fondo negro ya lo quita `ActorTransparency`).
 *  · TERRENO: force fields 488-491 — sin hook por-tile: se sintetiza el suelo de debajo
 *    (vecino dominante) y se blitea el cuerpo a .55 encima.
 *    🔴 La moongate (0xDC) ESTUVO aquí y se RETIRÓ por veredicto del usuario (2026-07-22,
 *    «El moongate no debe tener transparencia dentro»). `MOONGATE_TILE` sobrevive abajo
 *    SÓLO como exclusión de suelo-donante para los fields vecinos — no como sujeto del
 *    tratamiento. Ver el comentario al final de `overlayTranslucentTerrain`.
 * El boundary del shadowlord 112-127 queda para la 2ª ola.
 */

import { dominantFloorNeighbor as contourDominantFloorNeighbor } from "./contour-transp.js";

/** Factor de alpha del cuerpo (veredicto B). */
export const BODY_ALPHA = 0.55;

/** ACTORES translúcidos por tileId (todos los frames del ciclo de 4). */
export const TRANSLUCENT_ACTOR_TILES: ReadonlySet<number> = new Set([
  412, 413, 414, 415, // Ghost
  468, 469, 470, 471, // Wisp
  508, 509, 510, 511, // Shadowlord
]);

/** TERRENO — force fields (Poison/Magic/Fire/Electric). */
export const TRANSLUCENT_FIELD_TILES: ReadonlySet<number> = new Set([488, 489, 490, 491]);

/**
 * TERRENO — moongate (tile 0xDC). 🔴 NO recibe tratamiento: el usuario RETIRÓ su
 * translucidez el 22-07-2026. Se exporta sólo para que `isCensusTerrainTile` lo excluya
 * como suelo-donante de los fields vecinos.
 */
export const MOONGATE_TILE = 220;

/**
 * 2ª OLA — TERRENO. Mismo tratamiento «B» (alpha .55 + suelo sintetizado del vecino
 * dominante), salvo donde se anota lo contrario:
 *
 *  · BOUNDARY del shadowlord 0x70–0x7F (112-127, «bruma» del encuentro): igual que los
 *    force fields — la bruma deja ver el suelo de debajo. Terreno crudo de la ventana.
 *  · BLUE FLAME 0xDE (222): terreno emisor animado por la capa de RUIDO de fuego (fn32).
 *    Se translucida su FRAME VIVO (no el recorte estático) sobre el suelo sintetizado —
 *    ver `overlayTranslucentTerrain` (variante `blitLiveFlameAlpha`). OJO: 0xDE también
 *    lo recorta la capa `contour-transp` (isFireTile) ANTES; esta pasada corre después y
 *    reescribe la celda entera (suelo re-sintetizado + llama a .55), así que el pintado
 *    del contorno para esa celda queda sobrescrito (redundante, no incorrecto).
 *
 * VENTANAS 0x4A/0x4B (74/75) DESCARTADAS por veredicto del lead: el tratamiento «B» sobre
 * el negro del muro sólo ATENÚA el tile (no es el «cristal luminoso» que se buscaba; un glow
 * sería diseño nuevo). Ver `docs/verdicts/transp-wave2/README.md`.
 */
export const TRANSLUCENT_BOUNDARY_TILES: ReadonlySet<number> = new Set(
  Array.from({ length: 16 }, (_, i) => 112 + i), // 0x70..0x7F ShadowlordBoundary1..16
);

/** TERRENO — blue flame (tile 0xDE), emisor animado por fn32. */
export const BLUE_FLAME_TILE = 222;

/**
 * ACTORES por CONTORNO (no alpha): cadáver 0x11E (DeadBody) y charco de sangre 0x11F
 * (Splat) del botín de la arena de combate (coreview `arenaLoot`, banco alto +0x100).
 * Tratamiento del contorno-transparencia: se recorta el fondo NEGRO exterior (flood-fill),
 * los negros INTERNOS se conservan; el suelo de la arena (ya pintado debajo) asoma
 * alrededor del sprite. Sin alpha en el cuerpo (a diferencia de `TRANSLUCENT_ACTOR_TILES`).
 * Como los demás actores del censo, siempre ON salvo el kill-switch `?transp=off`.
 */
export const CONTOUR_ACTOR_TILES: ReadonlySet<number> = new Set([
  286, // 0x11E DeadBody (cadáver)
  287, // 0x11F Splat (charco de sangre)
]);

/**
 * ¿Es un tile «especial» del censo (no sirve como suelo para el underlay)? Incluye la 2ª
 * ola de emisores (boundary, blue flame) para que un campo o boundary junto a uno de ellos
 * no lo tome por suelo. Las PAREDES (muros/ventanas) ya las excluye el helper compartido
 * (`isFloorUnderlayCandidate`), así que no hace falta enumerarlas aquí. Los tiles de AGUA
 * (river/corner/waterfall) tampoco: los trata la capa de agua (`waterfn32`), no este censo.
 */
export function isCensusTerrainTile(tile: number): boolean {
  return (
    TRANSLUCENT_FIELD_TILES.has(tile) ||
    TRANSLUCENT_BOUNDARY_TILES.has(tile) ||
    tile === MOONGATE_TILE ||
    tile === BLUE_FLAME_TILE
  );
}

/** Vecinos ortogonales (dr,dc). */
const ORTHO: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * Índice de ventana (`row*N+col`) de la celda vecina de suelo DOMINANTE con la que
 * sintetizar el suelo bajo un tile de terreno translúcido, o `-1` si no hay vecino
 * utilizable (tile especial aislado → la celda se deja intacta, nunca se pinta a ciegas).
 *
 * Delegado en la implementación canónica de `contour-transp.ts` (misma heurística del
 * contorno-fuente: empate → primero en orden N,S,O,E); esta variante solo adapta la
 * forma de retorno a índice de ventana. OJO: por herencia histórica el orden de args
 * aquí es (col,row).
 */
export function dominantFloorNeighbor(
  tw: Int16Array,
  n: number,
  col: number,
  row: number,
  isSpecial: (t: number) => boolean,
): number {
  const f = contourDominantFloorNeighbor(tw, n, row, col, isSpecial);
  return f ? f.row * n + f.col : -1;
}
