/**
 * TRANSPARENCIA DE ACTORES DEL ENDGAME (#367) — modelo PURO del paso (2d-bis) del
 * compose de la piel shader.
 *
 * En las fases de SALA del cierre, coreview HORNEA los sprites (LB + party) sobre la
 * sala del trono (`bakeEndgameRoom`: el tile del actor REEMPLAZA al suelo) y el shader
 * hereda ese frame por RECORTE PLENO (`terrainWindow` no se puebla) → cada actor llega
 * con su cuadrado negro opaco, la MISMA clase que #363 (shrine) y #366 (camp). El fix
 * (Opción A del informe de medición-367) NO puebla la vía motion (que perdería dissolve
 * + tinte fn36 + gate/orb, medido — cuatro efectos, no uno): re-compone LOCALMENTE cada
 * celda de actor sobre la capa mundo ya estampada:
 *   (1) suelo sintetizado = vecino de suelo DOMINANTE ya renderizado (misma maquinaria
 *       que contour-transp, `dominantFloorNeighbor`);
 *   (2) blit del recorte transparente del sprite desde el atlas RECOLOREADO del endgame
 *       (fn36 ax=4) — SEGUNDA instancia de `ActorTransparency`: la clase cachea el
 *       PRIMER atlas para siempre y por tileId, JAMÁS se mezclan atlas en una instancia.
 *
 * Este módulo lleva la parte PURA (predicado de fase + ventana de suelo utilizable);
 * el pintado vive en `ShaderSkin.paintEndgameActorTransp`.
 */

import type { EndgameSceneView } from "../api.js";
import { dominantFloorNeighbor, type FloorNeighbor } from "./contour-transp.js";

/**
 * Fases de SALA cuyo frame lleva actores horneados con su cuadrado negro. `dissolve`
 * NO está: su fondo también es la sala, pero `actors` viaja VACÍO (todos entraron al
 * gate en orbMoongate — endgameScene.ts, `alive()`) y la negrura de la disolución
 * viaja en el recorte pleno: el paso debe ser no-op ahí por PREDICADO además de por
 * construcción. Las fases de pantalla completa (storyHouse, storyDream, scroll,
 * terminalFreeze) no tienen sala ni actores.
 */
export const ENDGAME_TRANSP_PHASES: ReadonlySet<EndgameSceneView["phase"]> = new Set([
  "greenScene",
  "dialogue",
  "orbMoongate",
  "terminalPrison",
]);

/**
 * Fases del cierre en que la piel fiel pinta el FRAME ENTERO (320×200, sin chrome) —
 * `paintSnapshot` retorna ANTES de `paintFaithful` en historia/pergamino, y en
 * `dissolve` ennegrece el frame COMPLETO, chrome incluido (`applyEndgameDissolve`).
 * El binario hace lo mismo: cada página se compone sobre un `putchar(0xFF)` = fill
 * de (0,0)-(319,199) de la ventana 0 y se presenta con copia total (ENDGAME.OVL
 * 0x00b4/0x0185; acta re/notes/endgame-banda-limpieza-187.md §§1-5), y la disolución
 * es el present del backbuffer negro (endgame-derivation.md GAP 5).
 *
 * En estas fases el compose del shader debe PRESENTAR EL FRAME FIEL Y NADA MÁS
 * (paso (1) y retorno): el chrome vectorial (paso 3), el texto HD (1b) y las bandas
 * (4-5) recomponían la UI lateral ENCIMA de la historia/pergamino — el defecto
 * reportado con capturas el 2026-08-22 (marco azul + roster con los oros + G/fecha
 * fijos, y el texto de la consola HD solapado con el de la página, ilegible).
 *
 * PARTICIÓN TOTAL con `ENDGAME_TRANSP_PHASES`: toda fase del guión está en
 * exactamente uno de los dos conjuntos (guarda endgame-shader-fullscreen.test.ts) —
 * una fase nueva sin clasificar rompe la guarda, no cae en silencio a la vía sala.
 */
export const ENDGAME_FULLSCREEN_PHASES: ReadonlySet<EndgameSceneView["phase"]> = new Set([
  "dissolve",
  "storyHouse",
  "storyDream",
  "scroll",
  "terminalFreeze",
]);

/** ¿La fase en curso toma la pantalla ENTERA (el frame fiel es la verdad completa)? */
export function endgameFullScreen(eg: EndgameSceneView): boolean {
  return ENDGAME_FULLSCREEN_PHASES.has(eg.phase);
}

/** Celda FIJA del moongate ROJO del cierre — la misma (5,4) que cablea
 *  `paintEndgameOverlays` (fiel/endgame-frame.ts, primitiva 0x1112). */
export const ENDGAME_GATE_CELL = { col: 5, row: 4 } as const;

/** ¿Procede el paso (2d-bis) con esta escena? Fase de sala + sala montada + actores. */
export function endgameTranspActive(eg: EndgameSceneView): boolean {
  return ENDGAME_TRANSP_PHASES.has(eg.phase) && !!eg.room && (eg.actors?.length ?? 0) > 0;
}

/**
 * Ventana de SUELO UTILIZABLE de la sala (row-major, lado `n`=11), para elegir el
 * vecino dominante bajo cada actor. Parte de `eg.room` (la rejilla SIN actores — el
 * bake sobreescribe `window`, no `room`) y marca `-1` (nunca-candidato) toda celda
 * cuyos píxeles RENDERIZADOS no son suelo puro:
 *   · esquinas 0xff (transparente → negro TILE_HIDDEN);
 *   · celdas OCUPADAS por un actor (sus píxeles muestran el sprite horneado — un
 *     compañero de la formación no puede ser el «suelo» de su vecino);
 *   · la celda del GATE (5,4) mientras la puerta está brotada (`moongate > 0`): el
 *     overlay rojo de la fiel viaja en el recorte pleno y sus píxeles no son suelo;
 *   · la celda del ORB (mismo motivo: estallido rojo encima del suelo).
 * Los MUROS se quedan con su tile: los excluye `isFloorUnderlayCandidate` dentro de
 * `dominantFloorNeighbor` («nunca fondo de pared»).
 */
export function endgameFloorWindow(
  eg: EndgameSceneView,
  n: number,
  out?: Int16Array,
): Int16Array {
  const tw = out ?? new Int16Array(n * n);
  const room = eg.room ?? null;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const t = room?.[r]?.[c] ?? 0xff;
      tw[r * n + c] = t === 0xff ? -1 : t;
    }
  }
  for (const a of eg.actors ?? []) {
    if (a.col >= 0 && a.row >= 0 && a.col < n && a.row < n) tw[a.row * n + a.col] = -1;
  }
  if (eg.moongate != null && eg.moongate > 0) {
    tw[ENDGAME_GATE_CELL.row * n + ENDGAME_GATE_CELL.col] = -1;
  }
  const orb = eg.orb;
  if (orb && orb.col >= 0 && orb.row >= 0 && orb.col < n && orb.row < n) {
    tw[orb.row * n + orb.col] = -1;
  }
  return tw;
}

/**
 * ¿La celda del actor está bajo un OVERLAY de la fiel (gate brotado / orb)? El timeline
 * de `orbMoongate` tiene un frame POR ACTOR con el sprite EN (5,4) y la puerta llena
 * (`moveSpriteToward` da el paso (5,3)→(5,4) ANTES de borrarlo): en 1988 el overlay
 * rojo se pinta ENCIMA del sprite (paintEndgameOverlays va tras el bake) y el actor
 * «desaparece dentro del gate». Recomponer ahí pintaría suelo+sprite TAPANDO el gate
 * un frame (regresión vista en la sonda). Bajo overlay el paso deja la celda intacta.
 */
export function endgameActorUnderOverlay(
  eg: EndgameSceneView,
  col: number,
  row: number,
): boolean {
  if (
    eg.moongate != null &&
    eg.moongate > 0 &&
    col === ENDGAME_GATE_CELL.col &&
    row === ENDGAME_GATE_CELL.row
  ) {
    return true;
  }
  const orb = eg.orb;
  return !!orb && orb.col === col && orb.row === row;
}

/**
 * Suelo a sintetizar bajo la celda `(row,col)` de un actor: el vecino ortogonal de
 * suelo DOMINANTE (empate → orden N,S,O,E), o `null` si no hay vecino utilizable —
 * y entonces la celda se queda horneada como hoy (nunca pared ni negro a ciegas).
 * El veto de celdas no-suelo ya viene marcado en `tw` (-1), por eso `skip` es no-op.
 */
export function endgameActorFloor(
  tw: Int16Array,
  n: number,
  row: number,
  col: number,
): FloorNeighbor | null {
  return dominantFloorNeighbor(tw, n, row, col, () => false);
}
